-- 0006: Bewertung, wie eine KI-Antwort auf die vorherige KI-Antwort Bezug nimmt.
-- - stance: 'agree' (stimmt zu), 'disagree' (widerspricht), 'extend' (baut weiter), 'neutral'; NULL = nicht bewertet
--   (z. B. Antwort auf den Menschen).
-- - stance_target_id: die KI, auf die sich die Antwort bezieht.
-- Geschrieben wird nur serverseitig (Service-Role, wie bei allen Nachrichten). Clients behalten SELECT/DELETE
-- aus 0002 und haben weiterhin kein INSERT/UPDATE; die RLS-Regel „messages of own rooms“ gilt für die neuen Spalten mit.

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS stance TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS stance_target_id UUID REFERENCES public.room_agents(id) ON DELETE SET NULL;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_stance_valid CHECK (stance IS NULL OR stance IN ('agree', 'disagree', 'extend', 'neutral'));
