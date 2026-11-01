-- Härtung nach Ist-Analyse (BF-03, BF-08, BF-12, BF-22)
-- Grundsatz: Abrechnungsrelevante Daten (Profil, Token-Zähler, Nachrichten-Ledger,
-- Langzeitgedächtnis) schreibt nur noch der Server mit dem Service-Role-Key.
-- Clients mit eigener Sitzung dürfen nur lesen bzw. ihre eigenen Inhalte verwalten.

-- ---------------------------------------------------------------------------
-- 1. user_profiles: Clients lesen nur unkritische Spalten, schreiben gar nicht
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "own profile update" ON public.user_profiles;
REVOKE ALL ON public.user_profiles FROM anon, authenticated;
GRANT SELECT (id, subscription_tier, monthly_token_limit, tokens_used_this_month, usage_period_start, rate_limit_per_min, created_at)
  ON public.user_profiles TO authenticated;

-- BYOK-Key wird ab jetzt verschlüsselt gespeichert (App-seitig AES-256-GCM, Format "v1:…").
-- Klartext-Altbestände sind wertlos für die App und werden entfernt.
UPDATE public.user_profiles SET custom_openrouter_key = NULL
 WHERE custom_openrouter_key IS NOT NULL AND custom_openrouter_key NOT LIKE 'v1:%';
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_key_encrypted CHECK (custom_openrouter_key IS NULL OR custom_openrouter_key LIKE 'v1:%');

-- ---------------------------------------------------------------------------
-- 2. chat_rooms: Nutzer verwalten Titel und Einstellungen, nicht das Gedächtnis
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.chat_rooms FROM anon, authenticated;
GRANT SELECT, DELETE ON public.chat_rooms TO authenticated;
GRANT INSERT (user_id, title) ON public.chat_rooms TO authenticated;
GRANT UPDATE (title, orchestration_mode, sliding_window_size, max_auto_turns) ON public.chat_rooms TO authenticated;

ALTER TABLE public.chat_rooms ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.chat_rooms DROP CONSTRAINT IF EXISTS chat_rooms_sliding_window_size_check;
ALTER TABLE public.chat_rooms ADD CONSTRAINT chat_rooms_sliding_window_size_check CHECK (sliding_window_size BETWEEN 2 AND 40);
ALTER TABLE public.chat_rooms ADD CONSTRAINT chat_rooms_title_length CHECK (char_length(title) BETWEEN 1 AND 120);

-- ---------------------------------------------------------------------------
-- 3. room_agents: Inhalte des Nutzers, aber mit Längengrenzen
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.room_agents FROM anon;
ALTER TABLE public.room_agents
  ADD CONSTRAINT room_agents_display_name_length CHECK (char_length(display_name) BETWEEN 1 AND 40),
  ADD CONSTRAINT room_agents_role_title_length CHECK (char_length(role_title) BETWEEN 1 AND 120),
  ADD CONSTRAINT room_agents_system_prompt_length CHECK (char_length(system_prompt) BETWEEN 10 AND 4000),
  ADD CONSTRAINT room_agents_model_length CHECK (char_length(model_identifier) BETWEEN 3 AND 100);

-- ---------------------------------------------------------------------------
-- 4. messages: Ledger – Clients lesen und löschen (Verlauf leeren), schreiben nicht
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.messages FROM anon, authenticated;
GRANT SELECT, DELETE ON public.messages TO authenticated;
ALTER TABLE public.messages ADD CONSTRAINT messages_content_length CHECK (char_length(content) BETWEEN 1 AND 20000);
ALTER TABLE public.messages ADD CONSTRAINT messages_tokens_non_negative CHECK (input_tokens >= 0 AND output_tokens >= 0 AND estimated_cost_usd >= 0);

-- ---------------------------------------------------------------------------
-- 5. Verbrauchsfunktionen nur noch für den Server (service_role)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.increment_token_usage(INT);
DROP FUNCTION IF EXISTS public.roll_usage_period();

CREATE OR REPLACE FUNCTION public.roll_usage_period(p_user_id UUID)
RETURNS public.user_profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  profile public.user_profiles;
BEGIN
  UPDATE public.user_profiles
     SET tokens_used_this_month = 0,
         usage_period_start = date_trunc('month', NOW())::date
   WHERE id = p_user_id
     AND usage_period_start < date_trunc('month', NOW())::date;
  SELECT * INTO profile FROM public.user_profiles WHERE id = p_user_id;
  RETURN profile;
END;
$$;

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
     SET tokens_used_this_month = tokens_used_this_month + p_tokens
   WHERE id = p_user_id
   RETURNING tokens_used_this_month INTO new_total;
  RETURN new_total;
END;
$$;

REVOKE ALL ON FUNCTION public.roll_usage_period(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.increment_token_usage(UUID, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.roll_usage_period(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_token_usage(UUID, INT) TO service_role;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Verbrauchssummen ohne N+1-Abfragen (BF-22); RLS greift über security_invoker
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.user_usage_totals WITH (security_invoker = true) AS
SELECT r.user_id,
       COALESCE(SUM(m.input_tokens), 0)::BIGINT AS input_tokens,
       COALESCE(SUM(m.output_tokens), 0)::BIGINT AS output_tokens,
       COALESCE(SUM(m.estimated_cost_usd), 0)::NUMERIC(12, 6) AS cost_usd,
       COUNT(*) FILTER (WHERE m.sender_type = 'agent')::BIGINT AS agent_replies
  FROM public.chat_rooms r
  JOIN public.messages m ON m.room_id = r.id
 GROUP BY r.user_id;

REVOKE ALL ON public.user_usage_totals FROM anon, authenticated;
GRANT SELECT ON public.user_usage_totals TO authenticated;
