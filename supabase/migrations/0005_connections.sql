-- 0005: Eigene Zugänge in allen Tarifen und weitere Anbieter-Keys.
-- - provider_keys: verschlüsselter JSON-Wert (App-seitig AES-256-GCM, Format "v1:…") mit Keys für
--   Vercel AI Gateway, OpenAI, Anthropic, Google und xAI. Nur der Server (Service-Role) liest/schreibt;
--   für authenticated gibt es bewusst KEINEN Spalten-Grant (0002 vergibt SELECT nur auf benannte Spalten).
-- - Tarifwechsel entfernt eigene Keys nicht mehr: eigene Zugänge sind in jedem Tarif erlaubt.

ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS provider_keys TEXT;
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_provider_keys_encrypted CHECK (provider_keys IS NULL OR provider_keys LIKE 'v1:%');

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
    stripe_customer_id = COALESCE(p_customer_id, stripe_customer_id),
    stripe_subscription_id = CASE WHEN p_tier = 'free' THEN NULL ELSE COALESCE(p_subscription_id, stripe_subscription_id) END
  WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_subscription_tier(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_subscription_tier(UUID, TEXT, TEXT, TEXT) TO service_role;
