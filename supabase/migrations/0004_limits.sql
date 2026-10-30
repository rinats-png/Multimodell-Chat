-- Harte Obergrenzen auch für direkte REST-Zugriffe (Z14-01).
-- Tarifgrenzen (aktive Agenten, Turns, Window, Räume je Tarif) prüft der Server beim Speichern
-- und erneut beim Modellaufruf; die Datenbank setzt zusätzlich absolute Höchstwerte.

-- room_agents: nur fachliche Spalten schreibbar, room_id nach dem Anlegen unveränderlich
REVOKE ALL ON public.room_agents FROM authenticated;
GRANT SELECT, DELETE ON public.room_agents TO authenticated;
GRANT INSERT (room_id, model_identifier, display_name, role_title, system_prompt, is_active, sort_order) ON public.room_agents TO authenticated;
GRANT UPDATE (model_identifier, display_name, role_title, system_prompt, is_active, sort_order) ON public.room_agents TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_hard_limits()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'room_agents' THEN
    IF (SELECT count(*) FROM public.room_agents WHERE room_id = NEW.room_id) >= 12 THEN
      RAISE EXCEPTION 'Höchstens 12 Agenten pro Raum' USING ERRCODE = 'check_violation';
    END IF;
  ELSIF TG_TABLE_NAME = 'chat_rooms' THEN
    IF (SELECT count(*) FROM public.chat_rooms WHERE user_id = NEW.user_id) >= 100 THEN
      RAISE EXCEPTION 'Höchstens 100 Räume pro Konto' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER room_agents_hard_limit BEFORE INSERT ON public.room_agents
  FOR EACH ROW EXECUTE FUNCTION public.enforce_hard_limits();
CREATE TRIGGER chat_rooms_hard_limit BEFORE INSERT ON public.chat_rooms
  FOR EACH ROW EXECUTE FUNCTION public.enforce_hard_limits();

REVOKE ALL ON FUNCTION public.enforce_hard_limits() FROM PUBLIC, anon;
