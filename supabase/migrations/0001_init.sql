-- Multi-LLM Group-Chat SaaS – Basisschema
-- Im Supabase SQL-Editor ausführen oder per `supabase db push`.

-- 1. User-Profile & Token-Kontingente (SaaS-Tiers)
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'team')),
  monthly_token_limit INT NOT NULL DEFAULT 15000,
  tokens_used_this_month INT NOT NULL DEFAULT 0,
  usage_period_start DATE NOT NULL DEFAULT date_trunc('month', NOW())::date,
  rate_limit_per_min INT NOT NULL DEFAULT 5,
  custom_openrouter_key TEXT, -- "Bring Your Own Key" (Team-Tarif)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Chat-Räume (Debatten-Sessions)
CREATE TABLE public.chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Neue KI-Debatte',
  orchestration_mode TEXT NOT NULL DEFAULT 'router' CHECK (orchestration_mode IN ('router', 'round-robin', 'manual')),
  sliding_window_size INT NOT NULL DEFAULT 12 CHECK (sliding_window_size BETWEEN 2 AND 100),
  max_auto_turns INT NOT NULL DEFAULT 3 CHECK (max_auto_turns BETWEEN 1 AND 10),
  running_summary TEXT NOT NULL DEFAULT '', -- komprimiertes Langzeitgedächtnis
  summarized_message_count INT NOT NULL DEFAULT 0, -- wie viele Nachrichten bereits in running_summary stecken
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX chat_rooms_user_idx ON public.chat_rooms(user_id, created_at DESC);

-- 3. Konfigurierte KI-Agenten pro Raum
CREATE TABLE public.room_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  model_identifier TEXT NOT NULL, -- z. B. 'openai/gpt-4o', 'anthropic/claude-3.5-sonnet'
  display_name TEXT NOT NULL,
  role_title TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0
);
CREATE INDEX room_agents_room_idx ON public.room_agents(room_id, sort_order);

-- 4. Nachrichten-Verlauf & Token-Abrechnung (Ledger)
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'agent', 'system')),
  agent_id UUID REFERENCES public.room_agents(id) ON DELETE SET NULL,
  sender_name TEXT NOT NULL,
  content TEXT NOT NULL,
  input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX messages_room_idx ON public.messages(room_id, created_at);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own profile read" ON public.user_profiles
  FOR SELECT USING (id = auth.uid());
CREATE POLICY "own profile update" ON public.user_profiles
  FOR UPDATE USING (id = auth.uid());
-- Tarif, Limits und Verbrauch darf der User NICHT selbst ändern – nur den BYOK-Key.
REVOKE UPDATE ON public.user_profiles FROM authenticated, anon;
GRANT UPDATE (custom_openrouter_key) ON public.user_profiles TO authenticated;

CREATE POLICY "own rooms" ON public.chat_rooms
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "agents of own rooms" ON public.room_agents
  FOR ALL USING (EXISTS (SELECT 1 FROM public.chat_rooms r WHERE r.id = room_id AND r.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.chat_rooms r WHERE r.id = room_id AND r.user_id = auth.uid()));

CREATE POLICY "messages of own rooms" ON public.messages
  FOR ALL USING (EXISTS (SELECT 1 FROM public.chat_rooms r WHERE r.id = room_id AND r.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.chat_rooms r WHERE r.id = room_id AND r.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- Profil automatisch bei Registrierung anlegen
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_profiles (id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Monatlicher Reset + Token-Verbrauch atomar verbuchen
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.roll_usage_period()
RETURNS public.user_profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  profile public.user_profiles;
BEGIN
  UPDATE public.user_profiles
     SET tokens_used_this_month = 0,
         usage_period_start = date_trunc('month', NOW())::date
   WHERE id = auth.uid()
     AND usage_period_start < date_trunc('month', NOW())::date;
  SELECT * INTO profile FROM public.user_profiles WHERE id = auth.uid();
  RETURN profile;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_token_usage(p_tokens INT)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_total INT;
BEGIN
  IF p_tokens IS NULL OR p_tokens < 0 THEN
    RAISE EXCEPTION 'p_tokens must be >= 0';
  END IF;
  PERFORM public.roll_usage_period();
  UPDATE public.user_profiles
     SET tokens_used_this_month = tokens_used_this_month + p_tokens
   WHERE id = auth.uid()
   RETURNING tokens_used_this_month INTO new_total;
  RETURN new_total;
END;
$$;

REVOKE ALL ON FUNCTION public.roll_usage_period() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.increment_token_usage(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.roll_usage_period() TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_token_usage(INT) TO authenticated;
