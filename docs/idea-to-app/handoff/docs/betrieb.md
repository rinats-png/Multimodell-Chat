# Betrieb, Monitoring, Backups

## Deployment

| Punkt | Festlegung |
|---|---|
| Hosting | Vercel (Next.js, Node-Runtime für API-Routen, Edge für Middleware) [ANNAHME A-003] |
| Datenbank | Supabase Pro, Region EU (Frankfurt) [ANNAHME A-008] |
| Rate-Limits | Upstash Redis (Region EU), in Produktion Pflicht (App startet sonst nicht) |
| Zahlung | Stripe (Test- und Live-Modus mit getrennten Schlüsseln) |
| Domain / HTTPS | Vercel-Zertifikat, HSTS per Header |
| `maxDuration` | 120 s für `/api/orchestrate` (Vercel-Plan muss das erlauben) [PRÜFEN] |

Ablauf eines Releases:
1. PR → CI grün (Typecheck, Tests, Build, Audit, RLS-Tests, gitleaks).
2. Vorschau-Deployment (Vercel Preview mit eigener Supabase-Branch- oder Staging-Datenbank, Stripe-Testmodus).
3. Manuelle Release-Checkliste (`19-tests.md`).
4. **Backup** der Produktions-DB, dann Migrationen: `supabase db push` (nur versionierte Dateien aus `supabase/migrations/`, Regel 9.7).
5. Merge → Produktions-Deployment.
6. Rollback: in Vercel das vorherige Deployment „Promote to Production“; Migrationen sind vorwärts gerichtet – bei Bedarf Gegen-Migration schreiben, nie von Hand ändern.

## Monitoring & Alarme

| Was | Wie | Alarm |
|---|---|---|
| Fehler (500, `level:error`) | Vercel Logs / Log Drain | > 10/min |
| Sicherheitsereignisse (`level:security`) | Vercel Logs, Filter auf `login_locked`, `rate_limited`, `webhook_signature_invalid` | Häufung → prüfen |
| KI-Kosten | OpenRouter-Dashboard, Credit-Limit | 50 % / 80 % des Monatsbudgets [ANNAHME A-009] |
| Stripe-Webhooks | Stripe-Dashboard „Webhook attempts“ | fehlgeschlagene Zustellungen |
| Verfügbarkeit | externer Uptime-Check auf `/login` | > 2 min down |
| Supabase | Security Advisor & Performance Advisor | wöchentlich ansehen |

Logs enthalten keine Chat-Inhalte, Passwörter oder Keys (`lib/log.ts`). Aufbewahrung 30 Tage.

## Umgebungen

| Umgebung | Datenbank | Schlüssel | Zweck |
|---|---|---|---|
| Lokal | keine (In-Memory-Demo) oder lokale Supabase | eigene Test-Keys | Entwicklung |
| Vorschau | Supabase Staging | Test-Keys, Stripe-Testmodus | Abnahme |
| Produktion | Supabase Produktion | Produktions-Keys | echte Nutzer |

## Pipeline (CI/CD)
`.github/workflows/ci.yml`: Jobs `check` (npm ci, typecheck, test, build, audit ≥ kritisch), `rls` (PostgreSQL-Service, `scripts/test-rls.sh`), `secrets` (gitleaks). Actions per Commit-SHA gepinnt, `permissions: contents: read`. Dependabot wöchentlich (npm) und monatlich (Actions).

## Backups & Wiederherstellung

| Punkt | Festlegung |
|---|---|
| Häufigkeit | täglich (Supabase Pro), PITR optional |
| Aufbewahrung | laut Plan (7 Tage Pro) – in Datenschutzerklärung nennen [PRÜFEN] |
| RPO / RTO | 24 h / 4 h [ANNAHME A-013] |
| Wiederherstellungstest | vor Launch, dann vierteljährlich (TASK-018) |

## Notfall
Incident-Plan nach Vorlage `templates/incident-plan.md` (idea-to-app) vor Launch ausfüllen (TASK-018). Sofortmaßnahmen bei Schlüssel-Leck: Schlüssel beim Anbieter widerrufen, neu setzen, neu deployen; bei `BYOK_ENCRYPTION_KEY` Nutzer informieren (Keys neu hinterlegen).

## Support
Kanal: E-Mail an `OPERATOR_EMAIL`; Störungen per Hinweis auf der Login-Seite [ANNAHME A-014].
