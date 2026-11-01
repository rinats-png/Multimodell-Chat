-- 0008: Ausgabenobergrenze für den Plattform-Key, Gratis-Testkontingent, Tageslimit je Nutzer.
-- Grundlage: Beschluss des Roast Room (docs/roast-room): Obergrenze 50 EUR im Monat mit hartem Stopp,
-- Gratis-Tarif = einmaliger Testlauf mit dem Plattform-Key, danach eigener Zugang.

-- ---------------------------------------------------------------------------
-- 1. Gemeinsame Ausgabenobergrenze (nur Server)
-- ---------------------------------------------------------------------------
-- Eine Zeile je Monat. Getrennt nach Testnutzern (Starter) und zahlenden Tarifen, damit Gratis-Nutzer
-- den Anteil zahlender Kunden nicht aufbrauchen können. Die Grenzwerte setzt die App (lib/platform-budget.ts).
CREATE TABLE public.platform_spend (
  period DATE PRIMARY KEY,
  trial_usd NUMERIC(12, 6) NOT NULL DEFAULT 0 CHECK (trial_usd >= 0),
  paid_usd NUMERIC(12, 6) NOT NULL DEFAULT 0 CHECK (paid_usd >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.platform_spend ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_spend FROM anon, authenticated;
-- Keine Policies: nur service_role (umgeht RLS).

CREATE OR REPLACE FUNCTION public.add_platform_spend(p_cost_usd NUMERIC, p_trial BOOLEAN)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  result JSONB;
BEGIN
  IF p_cost_usd IS NULL OR p_cost_usd < 0 THEN
    RAISE EXCEPTION 'p_cost_usd must be >= 0';
  END IF;
  INSERT INTO public.platform_spend AS s (period, trial_usd, paid_usd)
  VALUES (
    date_trunc('month', NOW())::date,
    CASE WHEN p_trial THEN p_cost_usd ELSE 0 END,
    CASE WHEN p_trial THEN 0 ELSE p_cost_usd END
  )
  ON CONFLICT (period) DO UPDATE
    SET trial_usd = s.trial_usd + EXCLUDED.trial_usd,
        paid_usd = s.paid_usd + EXCLUDED.paid_usd,
        updated_at = NOW()
  RETURNING jsonb_build_object('trial_usd', s.trial_usd, 'paid_usd', s.paid_usd) INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_platform_spend()
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT COALESCE(
    (SELECT jsonb_build_object('trial_usd', trial_usd, 'paid_usd', paid_usd) FROM public.platform_spend WHERE period = date_trunc('month', NOW())::date),
    jsonb_build_object('trial_usd', 0, 'paid_usd', 0)
  );
$$;

REVOKE ALL ON FUNCTION public.add_platform_spend(NUMERIC, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_platform_spend() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_platform_spend(NUMERIC, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_platform_spend() TO service_role;

-- ---------------------------------------------------------------------------
-- 2. Tageslimit je Nutzer (Spalten ohne Client-Grant, 0002 vergibt SELECT nur auf benannte Spalten)
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_profiles
  ADD COLUMN tokens_used_today INT NOT NULL DEFAULT 0 CHECK (tokens_used_today >= 0),
  ADD COLUMN usage_day DATE NOT NULL DEFAULT CURRENT_DATE;

-- ---------------------------------------------------------------------------
-- 3. Gratis-Tarif = einmaliger Testlauf (60.000 Tokens, kein monatlicher Neustart)
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_profiles ALTER COLUMN monthly_token_limit SET DEFAULT 60000;
UPDATE public.user_profiles SET monthly_token_limit = 60000 WHERE subscription_tier = 'free';

-- Der Monatsumbruch gilt nicht für den Starter: sein Kontingent ist ein einmaliger Testlauf.
CREATE OR REPLACE FUNCTION public.roll_usage_period(p_user_id UUID)
RETURNS public.user_profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  profile public.user_profiles;
BEGIN
  UPDATE public.user_profiles
     SET tokens_used_this_month = 0,
         usage_period_start = date_trunc('month', NOW())::date
   WHERE id = p_user_id
     AND subscription_tier <> 'free'
     AND usage_period_start < date_trunc('month', NOW())::date;
  SELECT * INTO profile FROM public.user_profiles WHERE id = p_user_id;
  RETURN profile;
END;
$$;

-- Verbrauch buchen: Monats- und Tageszähler. Negative Werte bleiben verboten.
CREATE OR REPLACE FUNCTION public.increment_token_usage(p_user_id UUID, p_tokens INT)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_total INT;
BEGIN
  IF p_tokens IS NULL OR p_tokens < 0 THEN
    RAISE EXCEPTION 'p_tokens must be >= 0';
  END IF;
  PERFORM public.roll_usage_period(p_user_id);
  UPDATE public.user_profiles
     SET tokens_used_this_month = tokens_used_this_month + p_tokens,
         tokens_used_today = CASE WHEN usage_day = CURRENT_DATE THEN tokens_used_today + p_tokens ELSE p_tokens END,
         usage_day = CURRENT_DATE
   WHERE id = p_user_id
   RETURNING tokens_used_this_month INTO new_total;
  RETURN new_total;
END;
$$;

-- Tarif anwenden: Starter-Testlauf 60.000 Tokens. Beim Wechsel vom Starter zu einem bezahlten Tarif startet der
-- Monatszähler bei 0, damit der Testlauf nicht auf das bezahlte Kontingent angerechnet wird.
CREATE OR REPLACE FUNCTION public.apply_subscription_tier(
  p_user_id UUID,
  p_tier TEXT,
  p_customer_id TEXT DEFAULT NULL,
  p_subscription_id TEXT DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_tier NOT IN ('free', 'pro', 'team') THEN
    RAISE EXCEPTION 'unknown tier %', p_tier;
  END IF;
  UPDATE public.user_profiles SET
    tokens_used_this_month = CASE WHEN subscription_tier = 'free' AND p_tier <> 'free' THEN 0 ELSE tokens_used_this_month END,
    usage_period_start = CASE WHEN subscription_tier = 'free' AND p_tier <> 'free' THEN date_trunc('month', NOW())::date ELSE usage_period_start END,
    subscription_tier = p_tier,
    monthly_token_limit = CASE p_tier WHEN 'free' THEN 60000 WHEN 'pro' THEN 500000 ELSE 2500000 END,
    rate_limit_per_min = CASE p_tier WHEN 'free' THEN 5 WHEN 'pro' THEN 15 ELSE 60 END,
    stripe_customer_id = COALESCE(p_customer_id, stripe_customer_id),
    stripe_subscription_id = CASE WHEN p_tier = 'free' THEN NULL ELSE COALESCE(p_subscription_id, stripe_subscription_id) END
  WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.roll_usage_period(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.increment_token_usage(UUID, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_subscription_tier(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.roll_usage_period(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_token_usage(UUID, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_subscription_tier(UUID, TEXT, TEXT, TEXT) TO service_role;
