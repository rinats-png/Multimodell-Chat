-- 0007: Indizes für die Fremdschlüssel von messages auf room_agents.
-- Beim Löschen eines Agenten (oder Raums) setzt Postgres ON DELETE SET NULL für agent_id und stance_target_id.
-- Ohne Index scannt jeder gelöschte Agent die gesamte, von allen Nutzern geteilte Tabelle messages.

CREATE INDEX IF NOT EXISTS messages_agent_idx ON public.messages(agent_id) WHERE agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS messages_stance_target_idx ON public.messages(stance_target_id) WHERE stance_target_id IS NOT NULL;
