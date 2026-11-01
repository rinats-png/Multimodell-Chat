# Multimodell-Chat – Hinweise für KI-Coding-Tools

## idea-to-app

Dieses Repository wurde mit **idea-to-app** (Modus „Bestehende App“) analysiert und saniert. Verbindliche Anweisungen, Sicherheitsregeln, offene Annahmen und die Roadmap stehen in:

- **`docs/idea-to-app/handoff/AGENTS.md`** – vor jeder Aufgabe lesen
- `docs/idea-to-app/` – Projektunterlagen (Ist-Analyse, Sicherheitskonzept, Tests, Prüfberichte)

Kurzfassung der wichtigsten Regeln: Sicherheit auf Server und in der Datenbank (RLS, Column-Grants), keine geheimen Schlüssel mit `NEXT_PUBLIC_`, jede Datenänderung mit Test „anderer Nutzer hat keinen Zugriff“, Schema nur per neuer Migration, vor Abschluss `npm run typecheck && npm test && npm run test:rls && npm run build`.
