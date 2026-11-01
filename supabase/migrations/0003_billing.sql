-- Zahlungsanbindung (BF-27): Tarif wird ausschließlich serverseitig nach verifiziertem
-- Stripe-Webhook gesetzt (Regel 8.1/8.2).

ALTER TABLE public.user_profiles
  ADD COLUMN stripe_customer_id TEXT UNIQUE,
  ADD COLUMN stripe_subscription_id TEXT;
-- Bewusst KEIN Grant an authenticated: Stripe-IDs bleiben serverseitig.

-- Idempotenz: jede Stripe-Event-ID wird genau einmal verarbeitet.
CREATE TABLE public.billing_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_events FROM anon, authenticated;
-- Keine Policies: nur service_role (umgeht RLS) darf lesen und schreiben.

-- Tarif anwenden: Limits aus einer Quelle (Spiegel von lib/plans.ts, Test: tests/plans.test.ts).
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
    subscription_tier = p_tier,
    monthly_token_limit = CASE p_tier WHEN 'free' THEN 15000 WHEN 'pro' THEN 500000 ELSE 2500000 END,
    rate_limit_per_min = CASE p_tier WHEN 'free' THEN 5 WHEN 'pro' THEN 15 ELSE 60 END,
    -- BYOK nur im Team-Tarif: beim Downgrade wird der Key entfernt.
    custom_openrouter_key = CASE WHEN p_tier = 'team' THEN custom_openrouter_key ELSE NULL END,
    stripe_customer_id = COALESCE(p_customer_id, stripe_customer_id),
    stripe_subscription_id = CASE WHEN p_tier = 'free' THEN NULL ELSE COALESCE(p_subscription_id, stripe_subscription_id) END
  WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_subscription_tier(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_subscription_tier(UUID, TEXT, TEXT, TEXT) TO service_role;
