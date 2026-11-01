-- RLS- und Rechte-Tests (T-SEC-16 … T-SEC-22). Ausführung: scripts/test-rls.sh
-- Jeder Block bricht mit RAISE EXCEPTION ab, wenn eine Erwartung verletzt ist.
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null

-- Testdaten als Superuser: zwei Nutzer A und B mit je einem Raum, Agent und Nachricht.
INSERT INTO auth.users (id, email) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@test.local'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b@test.local');
INSERT INTO public.chat_rooms (id, user_id, title) VALUES
  ('a0000000-0000-4000-8000-00000000000a', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Raum A'),
  ('b0000000-0000-4000-8000-00000000000b', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Raum B');
INSERT INTO public.room_agents (id, room_id, model_identifier, display_name, role_title, system_prompt) VALUES
  ('a1000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'openai/gpt-4o', 'GPT', 'Rolle', 'System-Prompt A'),
  ('b1000000-0000-4000-8000-00000000000b', 'b0000000-0000-4000-8000-00000000000b', 'openai/gpt-4o', 'GPT', 'Rolle', 'System-Prompt B');
INSERT INTO public.messages (room_id, sender_type, sender_name, content, input_tokens) VALUES
  ('a0000000-0000-4000-8000-00000000000a', 'user', 'Du', 'Geheim A', 10),
  ('b0000000-0000-4000-8000-00000000000b', 'user', 'Du', 'Geheim B', 20);

CREATE OR REPLACE FUNCTION pg_temp.expect_denied(stmt TEXT, label TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE stmt;
  RAISE EXCEPTION 'FEHLER %: Anweisung war erlaubt: %', label, stmt;
EXCEPTION
  WHEN insufficient_privilege OR check_violation THEN NULL;
  WHEN raise_exception THEN RAISE;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.expect_rows(stmt TEXT, expected BIGINT, label TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE got BIGINT;
BEGIN
  EXECUTE format('SELECT count(*) FROM (%s) t', stmt) INTO got;
  IF got <> expected THEN RAISE EXCEPTION 'FEHLER %: erwartet % Zeilen, erhalten %', label, expected, got; END IF;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.expect_affected(stmt TEXT, expected BIGINT, label TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE got BIGINT;
BEGIN
  EXECUTE stmt;
  GET DIAGNOSTICS got = ROW_COUNT;
  IF got <> expected THEN RAISE EXCEPTION 'FEHLER %: erwartet % betroffene Zeilen, erhalten %', label, expected, got; END IF;
END $$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pg_temp TO authenticated, anon, service_role;

-- ---------------------------------------------------------------------------
-- Als Nutzer A
-- ---------------------------------------------------------------------------
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}', true);

-- T-SEC-16: A sieht nur eigene Räume, Agenten, Nachrichten – fremde IDs liefern 0 Zeilen
SELECT pg_temp.expect_rows('SELECT * FROM public.chat_rooms', 1, 'T-SEC-16 eigene Räume');
SELECT pg_temp.expect_rows($q$SELECT * FROM public.chat_rooms WHERE id = 'b0000000-0000-4000-8000-00000000000b'$q$, 0, 'T-SEC-16 fremder Raum per ID');
SELECT pg_temp.expect_rows('SELECT * FROM public.room_agents', 1, 'T-SEC-16 eigene Agenten');
SELECT pg_temp.expect_rows('SELECT * FROM public.messages', 1, 'T-SEC-16 eigene Nachrichten');
SELECT pg_temp.expect_rows('SELECT * FROM public.user_usage_totals', 1, 'T-SEC-16 nur eigene Summen');

-- T-SEC-17: A kann fremde Daten weder ändern noch löschen
SELECT pg_temp.expect_affected($q$UPDATE public.chat_rooms SET title = 'gekapert' WHERE id = 'b0000000-0000-4000-8000-00000000000b'$q$, 0, 'T-SEC-17 fremden Raum ändern');
SELECT pg_temp.expect_affected($q$DELETE FROM public.messages WHERE room_id = 'b0000000-0000-4000-8000-00000000000b'$q$, 0, 'T-SEC-17 fremde Nachrichten löschen');
SELECT pg_temp.expect_affected($q$UPDATE public.room_agents SET system_prompt = 'gekapert!!' WHERE id = 'b1000000-0000-4000-8000-00000000000b'$q$, 0, 'T-SEC-17 fremden Agenten ändern');

-- T-SEC-18: A kann keine Datensätze in fremde Räume oder unter fremder ID anlegen
SELECT pg_temp.expect_denied($q$INSERT INTO public.room_agents (room_id, model_identifier, display_name, role_title, system_prompt) VALUES ('b0000000-0000-4000-8000-00000000000b', 'openai/gpt-4o', 'X', 'X', 'Eingeschleust')$q$, 'T-SEC-18 Agent in fremdem Raum');
SELECT pg_temp.expect_denied($q$INSERT INTO public.chat_rooms (user_id, title) VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'fremd')$q$, 'T-SEC-18 Raum unter fremder user_id');

-- T-SEC-19: Ledger, Gedächtnis und Profil sind für Clients schreibgeschützt (BF-12, BF-24)
SELECT pg_temp.expect_denied($q$INSERT INTO public.messages (room_id, sender_type, sender_name, content, input_tokens) VALUES ('a0000000-0000-4000-8000-00000000000a', 'agent', 'Fake', 'x', 0)$q$, 'T-SEC-19 Nachricht direkt einfügen');
SELECT pg_temp.expect_denied($q$UPDATE public.messages SET input_tokens = 0$q$, 'T-SEC-19 Ledger ändern');
SELECT pg_temp.expect_denied($q$UPDATE public.chat_rooms SET running_summary = repeat('x', 100000)$q$, 'T-SEC-19 Gedächtnis setzen');
SELECT pg_temp.expect_denied($q$UPDATE public.user_profiles SET custom_openrouter_key = ' '$q$, 'T-SEC-19 BYOK-Key setzen (Leerzeichen-Angriff)');
SELECT pg_temp.expect_denied($q$UPDATE public.user_profiles SET subscription_tier = 'team', monthly_token_limit = 99999999$q$, 'T-SEC-19 Tarif selbst setzen');
SELECT pg_temp.expect_denied($q$SELECT custom_openrouter_key FROM public.user_profiles$q$, 'T-SEC-19 BYOK-Spalte lesen');
SELECT pg_temp.expect_denied($q$SELECT provider_keys FROM public.user_profiles$q$, 'T-SEC-19 Anbieter-Keys lesen');
SELECT pg_temp.expect_denied($q$UPDATE public.user_profiles SET provider_keys = 'v1:iv:tag:data'$q$, 'T-SEC-19 Anbieter-Keys setzen');
SELECT pg_temp.expect_denied($q$SELECT provider_keys FROM public.user_profiles WHERE id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'$q$, 'T-SEC-19 fremde Anbieter-Keys lesen');
SELECT pg_temp.expect_denied($q$SELECT stripe_customer_id FROM public.user_profiles$q$, 'T-SEC-19 Stripe-ID lesen');
SELECT pg_temp.expect_rows($q$SELECT subscription_tier, tokens_used_this_month FROM public.user_profiles$q$, 1, 'T-SEC-19 eigene Profilwerte lesbar');

-- T-SEC-20: Verbrauchs- und Tariffunktionen nur für den Server
SELECT pg_temp.expect_denied($q$SELECT public.increment_token_usage('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 0)$q$, 'T-SEC-20 increment_token_usage');
SELECT pg_temp.expect_denied($q$SELECT public.roll_usage_period('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$q$, 'T-SEC-20 roll_usage_period');
SELECT pg_temp.expect_denied($q$SELECT public.apply_subscription_tier('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'team')$q$, 'T-SEC-20 apply_subscription_tier');
SELECT pg_temp.expect_denied($q$SELECT * FROM public.billing_events$q$, 'T-SEC-20 billing_events lesen');

-- T-SEC-21: Längengrenzen in der Datenbank (gegen aufgeblähte Prompts über die REST-API)
SELECT pg_temp.expect_denied($q$UPDATE public.room_agents SET system_prompt = repeat('x', 5000) WHERE id = 'a1000000-0000-4000-8000-00000000000a'$q$, 'T-SEC-21 System-Prompt > 4000');
SELECT pg_temp.expect_denied($q$UPDATE public.chat_rooms SET sliding_window_size = 100 WHERE id = 'a0000000-0000-4000-8000-00000000000a'$q$, 'T-SEC-21 Window > 40');
SELECT pg_temp.expect_affected($q$UPDATE public.chat_rooms SET title = 'Umbenannt' WHERE id = 'a0000000-0000-4000-8000-00000000000a'$q$, 1, 'eigenen Raum umbenennen');
SELECT pg_temp.expect_denied($q$UPDATE public.room_agents SET room_id = 'a0000000-0000-4000-8000-00000000000a' WHERE id = 'a1000000-0000-4000-8000-00000000000a'$q$, 'T-SEC-21 room_id eines Agenten ändern');
DO $$
BEGIN
  FOR i IN 1..11 LOOP
    INSERT INTO public.room_agents (room_id, model_identifier, display_name, role_title, system_prompt)
    VALUES ('a0000000-0000-4000-8000-00000000000a', 'openai/gpt-4o', 'A' || i, 'Rolle', 'Zusätzlicher Agent');
  END LOOP;
END $$;
SELECT pg_temp.expect_denied($q$INSERT INTO public.room_agents (room_id, model_identifier, display_name, role_title, system_prompt) VALUES ('a0000000-0000-4000-8000-00000000000a', 'openai/gpt-4o', 'Zu viel', 'Rolle', 'Dreizehnter Agent')$q$, 'T-SEC-21 mehr als 12 Agenten pro Raum');
DO $$
BEGIN
  FOR i IN 1..99 LOOP
    INSERT INTO public.chat_rooms (title) VALUES ('Raum ' || i);
  END LOOP;
END $$;
SELECT pg_temp.expect_denied($q$INSERT INTO public.chat_rooms (title) VALUES ('Raum 101')$q$, 'T-SEC-21 mehr als 100 Räume');
ROLLBACK;

-- ---------------------------------------------------------------------------
-- Anonym
-- ---------------------------------------------------------------------------
BEGIN;
SET LOCAL ROLE anon;
SELECT pg_temp.expect_denied('SELECT * FROM public.messages', 'T-SEC-16 anon liest Nachrichten');
SELECT pg_temp.expect_denied('SELECT * FROM public.user_profiles', 'T-SEC-16 anon liest Profile');
SELECT pg_temp.expect_denied('SELECT * FROM public.chat_rooms', 'T-SEC-16 anon liest Räume');
SELECT pg_temp.expect_denied('SELECT * FROM public.room_agents', 'T-SEC-16 anon liest Agenten');
ROLLBACK;

-- ---------------------------------------------------------------------------
-- Server (service_role)
-- ---------------------------------------------------------------------------
BEGIN;
SET LOCAL ROLE service_role;
DO $$
DECLARE total INT; prof public.user_profiles;
BEGIN
  total := public.increment_token_usage('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 123);
  IF total <> 123 THEN RAISE EXCEPTION 'FEHLER increment_token_usage: %', total; END IF;
  BEGIN
    PERFORM public.increment_token_usage('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', -5);
    RAISE EXCEPTION 'FEHLER: negativer Verbrauch erlaubt';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FEHLER%' THEN RAISE; END IF;
  END;

  UPDATE public.user_profiles SET custom_openrouter_key = 'v1:iv:tag:data' WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  PERFORM public.apply_subscription_tier('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'team', 'cus_123', 'sub_123');
  SELECT * INTO prof FROM public.user_profiles WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  IF prof.monthly_token_limit <> 2500000 OR prof.rate_limit_per_min <> 60 OR prof.custom_openrouter_key IS NULL THEN
    RAISE EXCEPTION 'FEHLER apply_subscription_tier team';
  END IF;
  PERFORM public.apply_subscription_tier('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'free');
  SELECT * INTO prof FROM public.user_profiles WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  -- 0005: Eigene Zugänge sind in jedem Tarif erlaubt – der Downgrade lässt den Key stehen.
  IF prof.monthly_token_limit <> 60000 OR prof.custom_openrouter_key IS NULL OR prof.stripe_subscription_id IS NOT NULL THEN
    RAISE EXCEPTION 'FEHLER Downgrade setzt Limits nicht zurück oder entfernt eigenen Key';
  END IF;
END $$;
-- T-SEC-19: Klartext-Key wird auch serverseitig von der DB abgelehnt
SELECT pg_temp.expect_denied($q$UPDATE public.user_profiles SET custom_openrouter_key = 'sk-or-klartext' WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$q$, 'T-SEC-19 Klartext-Key');
SELECT pg_temp.expect_denied($q$UPDATE public.user_profiles SET provider_keys = '{"openai":"sk-klartext"}' WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$q$, 'T-SEC-19 Klartext-Anbieter-Keys');
ROLLBACK;

-- ---------------------------------------------------------------------------
-- T-SEC-22: Konto löschen entfernt alle Daten des Nutzers (Kaskade), fremde bleiben
-- ---------------------------------------------------------------------------
BEGIN;
DELETE FROM auth.users WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
SELECT pg_temp.expect_rows($q$SELECT * FROM public.user_profiles WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$q$, 0, 'T-SEC-22 Profil gelöscht');
SELECT pg_temp.expect_rows($q$SELECT * FROM public.chat_rooms WHERE user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$q$, 0, 'T-SEC-22 Räume gelöscht');
SELECT pg_temp.expect_rows($q$SELECT * FROM public.messages WHERE content = 'Geheim A'$q$, 0, 'T-SEC-22 Nachrichten gelöscht');
SELECT pg_temp.expect_rows($q$SELECT * FROM public.messages WHERE content = 'Geheim B'$q$, 1, 'T-SEC-22 fremde Daten unberührt');
ROLLBACK;


-- ---------------------------------------------------------------------------
-- T-SEC-35: Bewertung (stance) – Clients dürfen sie lesen, aber nicht schreiben; fremde Nachrichten bleiben unsichtbar
-- ---------------------------------------------------------------------------
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';
SELECT pg_temp.expect_denied($q$UPDATE public.messages SET stance = 'disagree' WHERE content = 'Geheim A'$q$, 'T-SEC-35 Client darf stance nicht schreiben');
SELECT pg_temp.expect_rows($q$SELECT stance FROM public.messages WHERE content = 'Geheim B'$q$, 0, 'T-SEC-35 fremde Nachricht samt Bewertung unsichtbar');
ROLLBACK;


-- ---------------------------------------------------------------------------
-- T-SEC-40: Ausgabenobergrenze (platform_spend) und Tageslimit – nur der Server darf lesen und schreiben
-- ---------------------------------------------------------------------------
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';
SELECT pg_temp.expect_denied($q$SELECT * FROM public.platform_spend$q$, 'T-SEC-40 platform_spend lesen');
SELECT pg_temp.expect_denied($q$INSERT INTO public.platform_spend (period) VALUES (CURRENT_DATE)$q$, 'T-SEC-40 platform_spend schreiben');
SELECT pg_temp.expect_denied($q$SELECT public.add_platform_spend(1, true)$q$, 'T-SEC-40 add_platform_spend');
SELECT pg_temp.expect_denied($q$SELECT public.get_platform_spend()$q$, 'T-SEC-40 get_platform_spend');
SELECT pg_temp.expect_denied($q$SELECT tokens_used_today FROM public.user_profiles$q$, 'T-SEC-40 Tageszähler lesen');
SELECT pg_temp.expect_denied($q$UPDATE public.user_profiles SET tokens_used_today = 0$q$, 'T-SEC-40 Tageszähler zurücksetzen');
ROLLBACK;

BEGIN;
SET LOCAL ROLE anon;
SELECT pg_temp.expect_denied($q$SELECT public.add_platform_spend(1, true)$q$, 'T-SEC-40 anon add_platform_spend');
SELECT pg_temp.expect_denied($q$SELECT * FROM public.platform_spend$q$, 'T-SEC-40 anon platform_spend lesen');
ROLLBACK;

BEGIN;
SET LOCAL ROLE service_role;
DO $$
DECLARE r JSONB; prof public.user_profiles;
BEGIN
  r := public.get_platform_spend();
  IF (r->>'trial_usd')::numeric <> 0 OR (r->>'paid_usd')::numeric <> 0 THEN RAISE EXCEPTION 'FEHLER get_platform_spend leer: %', r; END IF;
  r := public.add_platform_spend(1.5, true);
  r := public.add_platform_spend(2, false);
  r := public.add_platform_spend(0.25, true);
  IF (r->>'trial_usd')::numeric <> 1.75 OR (r->>'paid_usd')::numeric <> 2 THEN RAISE EXCEPTION 'FEHLER add_platform_spend: %', r; END IF;
  r := public.get_platform_spend();
  IF (r->>'trial_usd')::numeric <> 1.75 OR (r->>'paid_usd')::numeric <> 2 THEN RAISE EXCEPTION 'FEHLER get_platform_spend: %', r; END IF;
  BEGIN
    PERFORM public.add_platform_spend(-1, true);
    RAISE EXCEPTION 'FEHLER: negative Ausgabe erlaubt';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FEHLER%' THEN RAISE; END IF;
  END;

  -- Starter: Testlauf ohne Monatsumbruch; Tageszähler läuft mit
  UPDATE public.user_profiles SET subscription_tier = 'free', monthly_token_limit = 60000, tokens_used_this_month = 0, tokens_used_today = 0,
         usage_period_start = date_trunc('month', NOW() - interval '2 months')::date, usage_day = CURRENT_DATE - 1
   WHERE id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  PERFORM public.increment_token_usage('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 1000);
  PERFORM public.increment_token_usage('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 500);
  SELECT * INTO prof FROM public.user_profiles WHERE id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  IF prof.tokens_used_this_month <> 1500 OR prof.tokens_used_today <> 1500 OR prof.usage_day <> CURRENT_DATE THEN
    RAISE EXCEPTION 'FEHLER Tageszähler: monat %, tag %, tag-datum %', prof.tokens_used_this_month, prof.tokens_used_today, prof.usage_day;
  END IF;
  -- Starter erhält keinen Monatsumbruch (der Testlauf bleibt verbraucht)
  prof := public.roll_usage_period('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  IF prof.tokens_used_this_month <> 1500 THEN RAISE EXCEPTION 'FEHLER Starter-Testlauf wurde zurückgesetzt: %', prof.tokens_used_this_month; END IF;
  -- Bezahlter Tarif: Wechsel vom Starter startet bei 0, danach gilt der Monatsumbruch
  PERFORM public.apply_subscription_tier('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'pro');
  SELECT * INTO prof FROM public.user_profiles WHERE id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  IF prof.tokens_used_this_month <> 0 OR prof.monthly_token_limit <> 500000 THEN RAISE EXCEPTION 'FEHLER Wechsel Starter zu Pro: %, %', prof.tokens_used_this_month, prof.monthly_token_limit; END IF;
  UPDATE public.user_profiles SET tokens_used_this_month = 9999, usage_period_start = date_trunc('month', NOW() - interval '1 month')::date
   WHERE id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  prof := public.roll_usage_period('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  IF prof.tokens_used_this_month <> 0 THEN RAISE EXCEPTION 'FEHLER Pro: Monatsumbruch fehlt'; END IF;
END $$;
ROLLBACK;

\o
\echo 'RLS-Tests: alle Erwartungen erfüllt'
