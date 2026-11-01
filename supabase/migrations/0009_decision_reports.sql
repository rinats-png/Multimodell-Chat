-- 0009: Entscheidungsberichte (F-21). Aus einer Debatte entsteht ein bewerteter Bericht, den der Besitzer per Link
-- teilen kann. Grundsätze:
-- - Berichte schreibt nur der Server (Service-Role); Clients dürfen eigene Berichte lesen und löschen.
-- - Der Freigabe-Link besteht aus einem zufälligen Token. In der Datenbank steht nur dessen Hash; die Spalte hat
--   keinen Client-Grant (0002-Prinzip: SELECT nur auf benannte Spalten).
-- - Die öffentliche Ansicht liest der Server per Hash und gibt nur Titel, Bericht und Datum zurück.

CREATE TABLE public.decision_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  report JSONB NOT NULL CHECK (octet_length(report::text) <= 60000),
  share_token_hash TEXT UNIQUE CHECK (share_token_hash IS NULL OR share_token_hash ~ '^[0-9a-f]{64}$'),
  shared_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX decision_reports_user_idx ON public.decision_reports(user_id, created_at DESC);
CREATE INDEX decision_reports_room_idx ON public.decision_reports(room_id);

ALTER TABLE public.decision_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own reports read" ON public.decision_reports
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "own reports delete" ON public.decision_reports
  FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

REVOKE ALL ON public.decision_reports FROM anon, authenticated;
GRANT SELECT (id, room_id, user_id, title, report, shared_at, created_at) ON public.decision_reports TO authenticated;
GRANT DELETE ON public.decision_reports TO authenticated;

-- Höchstens 500 Berichte je Konto (die Tarifgrenze prüft zusätzlich der Server).
CREATE OR REPLACE FUNCTION public.enforce_report_limit()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM public.decision_reports WHERE user_id = NEW.user_id) >= 500 THEN
    RAISE EXCEPTION 'Höchstens 500 Berichte pro Konto' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER decision_reports_limit BEFORE INSERT ON public.decision_reports
  FOR EACH ROW EXECUTE FUNCTION public.enforce_report_limit();

REVOKE ALL ON FUNCTION public.enforce_report_limit() FROM PUBLIC, anon, authenticated;
