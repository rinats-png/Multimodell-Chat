# Multimodell-Chat – KI-Gruppendebatten (SaaS)

Ein Mensch diskutiert in einem gemeinsamen Raum gleichzeitig mit **ChatGPT (GPT-4o)**, **Claude 3.5 Sonnet** und **Gemini 2.5 Pro**. Jede KI vertritt eine eigene Fachrolle und widerspricht konstruktiv, statt nur zuzustimmen.

**Stack:** Next.js 15 (App Router, TypeScript) · Tailwind CSS 4 · Vercel AI SDK 5 + OpenRouter · Supabase (Postgres, Auth, RLS) · Upstash Redis · Stripe

![Gruppenchat](docs/screenshot-chat.png)

Alle Screens (Desktop und Mobil): [`docs/mockups/`](docs/mockups/) – Galerie in `docs/mockups/index.html`.

## Schnellstart (lokal, ohne Konten)

```bash
npm install
npm run dev          # http://localhost:3000
```

Ohne Umgebungsvariablen läuft ein **Demo-Workspace**: In-Memory-Daten, ein Demo-Nutzer, simulierte Antworten über ein lokales Modell. Streaming, Ledger, Limits, Router und Gedächtnis laufen dabei durch dieselbe Pipeline wie im Produktivbetrieb. Mit `OPENROUTER_API_KEY` in `.env.local` antworten lokal echte Modelle.

> **Produktion fällt geschlossen aus:** Mit `NODE_ENV=production` startet die App nur, wenn Supabase (inkl. `SUPABASE_SERVICE_ROLE_KEY`), Upstash, `APP_ORIGIN` und die Betreiberangaben (`OPERATOR_*`) gesetzt sind. Eine öffentliche Vorschau ohne Supabase ist nur mit `ALLOW_DEMO_MODE=true` möglich: Jeder Besucher bekommt einen eigenen, flüchtigen Demo-Bestand, und es wird nie der Plattform-Key genutzt.

## Produktiv einrichten

1. **Supabase** (Pro-Plan empfohlen, Region EU): Migrationen ausführen (`supabase db push` oder der Reihe nach im SQL-Editor: `supabase/migrations/0001_init.sql`, `0002_hardening.sql`, `0003_billing.sql`, `0004_limits.sql`).
   Im Dashboard: „Confirm email“ an, Mindestlänge 15, „Leaked password protection“ an, Email-OTP-Ablauf 1800 s, Session-Time-box 90 Tage, Redirect-URL `https://<domain>/auth/callback`.
2. **Upstash Redis** anlegen (Pflicht in Produktion für instanzübergreifende Limits).
3. **OpenRouter**: Key anlegen, Credit-Limit setzen, unter Privacy „data collection“ verbieten.
4. **Stripe**: zwei Abo-Preise (Pro, Workspace) und einen Webhook auf `https://<domain>/api/billing/webhook` mit den Events `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`. Kundenportal aktivieren.
5. Variablen aus `.env.example` in Vercel setzen (geheime Werte nie mit `NEXT_PUBLIC_`). `BYOK_ENCRYPTION_KEY` mit `openssl rand -base64 32` erzeugen.

## Befehle

| Befehl | Zweck |
|---|---|
| `npm run dev` / `build` / `start` | Entwicklung / Produktions-Build / Start |
| `npm run typecheck` | TypeScript |
| `npm test` | Vitest: Unit, Integration, Route-Handler, Middleware, Auth, Webhook |
| `npm run test:rls` | RLS- und Rechte-Tests gegen PostgreSQL (temporärer Cluster oder `DATABASE_URL`) |
| `node scripts/smoke-browser.cjs` | Browser-Smoke-Test (Playwright) gegen einen laufenden Server |

CI (`.github/workflows/ci.yml`): Typecheck, Tests, Build, `npm audit`, RLS-Tests mit PostgreSQL-Service, gitleaks.

## Architektur & Sicherheit

Die App wurde mit [idea-to-app](https://github.com/rinats-png/idea-to-app) im Modus „Bestehende App“ analysiert, unabhängig zweitgeprüft und saniert. Alle Unterlagen liegen in [`docs/idea-to-app/`](docs/idea-to-app/):

- [`B1-ist-analyse.md`](docs/idea-to-app/B1-ist-analyse.md): Befunde BF-01 … BF-32 mit Schweregrad
- [`14-sicherheit.md`](docs/idea-to-app/14-sicherheit.md): Bedrohungsmodell, Rate-Limits, Schlüsselliste, Projektwerte
- [`19-tests.md`](docs/idea-to-app/19-tests.md): Akzeptanzkriterien, Rückverfolgungsmatrix, Sicherheitstests
- [`21-roadmap.md`](docs/idea-to-app/21-roadmap.md): erledigte und offene Aufgaben
- [`handoff/AGENTS.md`](docs/idea-to-app/handoff/AGENTS.md): verbindliche Regeln für Coding-Tools

| Modul | Datei |
|---|---|
| Context-Formatter (Perspektiven-Umkehr, Sliding Window, Token-Budget) | `lib/context-builder.ts` |
| Orchestrierung (Router / Round-Robin / Manuell, Streaming, Buchung auch bei Abbruch) | `lib/orchestrator.ts`, `app/api/orchestrate/route.ts` |
| Usage-Guard (Kontingent, Rate-Limits, Sperren) | `lib/usage-guard.ts`, `lib/rate-limit.ts` |
| Tarife | `lib/plans.ts` |
| Sicherheit (CSP/Nonce, Header, Origin, Krypto, Logs) | `middleware.ts`, `lib/security-headers.ts`, `lib/crypto.ts`, `lib/log.ts` |
