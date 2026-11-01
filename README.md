# Multimodell-Chat – KI-Gruppendebatten (SaaS)

Ein Mensch diskutiert in einem gemeinsamen Raum gleichzeitig mit **ChatGPT**, **Claude**, **Gemini** (und weiteren wie Grok, Kimi, Llama, DeepSeek). Jede KI vertritt eine eigene Fachrolle und widerspricht konstruktiv, statt nur zuzustimmen.

**Stack:** Next.js 15 (App Router, TypeScript) · Tailwind CSS 4 · Vercel AI SDK 5 + OpenRouter · Supabase (Postgres, Auth, RLS) · Upstash Redis · Stripe

![Gruppenchat](docs/screenshot-chat.png)

Alle Screens (Desktop und Mobil, hell und dunkel): [`docs/mockups/hell/`](docs/mockups/hell/) und [`docs/mockups/dunkel/`](docs/mockups/dunkel/) – Galerie in `docs/mockups/index.html`. Design-System: [`docs/design.md`](docs/design.md).

## Schnellstart (lokal, ohne Konten)

```bash
npm install
npm run dev          # http://localhost:3000
```

Ohne Umgebungsvariablen läuft ein **Demo-Workspace**: In-Memory-Daten, ein Demo-Nutzer, simulierte Antworten über ein lokales Modell. Streaming, Ledger, Limits, Router und Gedächtnis laufen dabei durch dieselbe Pipeline wie im Produktivbetrieb. Mit `OPENROUTER_API_KEY` in `.env.local` antworten lokal echte Modelle.

> **Produktion fällt geschlossen aus:** Mit `NODE_ENV=production` startet die App nur, wenn Supabase (inkl. `SUPABASE_SERVICE_ROLE_KEY`), Upstash, `APP_ORIGIN` und die Betreiberangaben (`OPERATOR_*`) gesetzt sind. Eine öffentliche Vorschau ohne Supabase ist nur mit `ALLOW_DEMO_MODE=true` möglich: Jeder Besucher bekommt einen eigenen, flüchtigen Demo-Bestand, und es wird nie der Plattform-Key genutzt.

## Eigene KI-Zugänge

Unter **Tarif & Verbrauch → Deine KI-Zugänge** verbinden Nutzer ihren eigenen Zugang – in jedem Tarif:

| Zugang | Wie | Deckt ab |
|---|---|---|
| **OpenRouter** (empfohlen) | Knopf „Mit OpenRouter verbinden“ (OAuth mit PKCE, kein Kopieren) oder Key einfügen | alle Modelle |
| Vercel AI Gateway | Key einfügen | alle Modelle |
| OpenAI · Anthropic · Google AI Studio · xAI | Key einfügen | Modelle dieses Anbieters direkt |

Pro Modell gilt: direkter Anbieter-Key → OpenRouter → Gateway → Plattform-Key (mit Kontingent) → Demo (`lib/ai/provider.ts`). Keys liegen nur verschlüsselt (AES-256-GCM) in der Datenbank und gehen nie zurück an den Browser. Für „Mit OpenRouter verbinden“ muss `APP_ORIGIN` (bzw. lokal `http://localhost:3000`) als Rückleitungsadresse erreichbar sein.

## Lokaler Abo-Modus (nur für dich, ohne API-Keys)

Wer ChatGPT-, Claude-, Gemini- oder Kimi-Abos hat und **keine API-Keys** bezahlen will, kann die App auf dem eigenen Rechner so starten, dass die Agenten über die Kommandozeilen-Programme der Anbieter antworten – mit deinem Abo-Login:

```bash
npm install -g @anthropic-ai/claude-code @openai/codex @google/gemini-cli   # einmalig
claude          # einmal starten und mit dem Claude-Abo anmelden
codex login     # „Sign in with ChatGPT“
gemini          # einmal starten und mit Google anmelden
# Kimi CLI nach Anleitung von Moonshot installieren und anmelden

echo "LOCAL_SUBSCRIPTION_MODE=true" >> .env.local
npm run dev     # http://localhost:3000
```

Neue Debatten starten dann mit ChatGPT, Claude, Gemini und Kimi über `abo/chatgpt`, `abo/claude`, `abo/gemini`, `abo/kimi`. Unter „Tarif & Verbrauch“ zeigt die App, welche Programme gefunden wurden. Befehle lassen sich in `.env.local` anpassen (`ABO_CMD_*`, siehe `.env.example`).

- **Nur lokal:** Der Modus ist in Produktion und mit Supabase immer aus – ein öffentlicher Server darf nie fremde Anfragen über dein Abo ausführen.
- **Sicherheit:** Der Prompt geht nur über stdin an das Programm (nie als Argument), das Programm läuft in einem leeren Ordner und wird angewiesen, keine Werkzeuge zu nutzen.
- **Grauzone:** Diese Programme sind für deine eigene Arbeit gedacht. Für den persönlichen Gebrauch ok – nicht als Angebot für andere verwenden. Antworten dauern je Agent einige Sekunden bis ca. eine halbe Minute, die Abo-Nutzungsgrenzen gelten.
- Der Befehl für Kimi (`kimi --print`) ist ein Startwert – prüfe ihn mit `kimi --help` und passe `ABO_CMD_KIMI` an.

## Produktiv einrichten

1. **Supabase** (Pro-Plan empfohlen, Region EU): Migrationen ausführen (`supabase db push` oder der Reihe nach im SQL-Editor: alle Dateien in `supabase/migrations/` aufsteigend, zuletzt `0005_connections.sql`, `0006_stance.sql`, `0007_message_fk_indexes.sql`).
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
| `node scripts/smoke-browser.cjs` | Browser-Smoke-Test gegen einen laufenden Server (braucht Playwright + Chromium: `npm i -D playwright && npx playwright install chromium`) |
| `npm run build && node scripts/a11y-check.cjs` | Barrierefreiheits-Prüfung (Namen, Kontrast, Fokus, Überlauf) in allen Farbwelten und Breiten; startet die gebaute App selbst, braucht Playwright |

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
| Eigene Zugänge (OpenRouter-OAuth, Anbieter-Keys) | `lib/ai/provider.ts`, `lib/openrouter-oauth.ts`, `app/api/connections/`, `app/api/connect/openrouter/` |
| Lokaler Abo-Modus (CLI-Brücke) | `lib/ai/local-cli.ts` |
| Sicherheit (CSP/Nonce, Header, Origin, Krypto, Logs) | `middleware.ts`, `lib/security-headers.ts`, `lib/crypto.ts`, `lib/log.ts` |
