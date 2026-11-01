# Multimodell-Chat – Anweisungen für das Coding-Tool

> Diese Datei wurde mit **idea-to-app** erstellt (Modus „Bestehende App“). Sie ist verbindlich für jede Aufgabe in diesem Repository.
>
> **Regelwerk-Version:** 1.2.0 · **Erstellt:** 2026-10-29

## 1. Worum geht es?

Ein Mensch diskutiert in einem Raum gleichzeitig mit mehreren KI-Modellen (ChatGPT, Claude, Gemini u. a.), die jeweils eine Fachrolle vertreten und einander konstruktiv widersprechen – als SaaS mit Tarifen, Token-Kontingent und eigenem API-Key.

- **Zielgruppe:** Gründer, Produkt- und Technik-Teams, die Entscheidungen aus mehreren KI-Perspektiven prüfen wollen
- **Kernfunktion:** Gruppenchat mit Orchestrierung (Moderator, Round-Robin, @Mentions) und Kostenkontrolle (F-03 … F-08)
- **Risikostufe:** 2 – Konten, E-Mail, eigene Chat-Inhalte, Zahlung nur über Stripe
- **Plattform:** Web (Next.js 15 auf Vercel)

Ausführliche Unterlagen liegen in `docs/` (relativ zu dieser Datei). Lies vor jeder Aufgabe die dort referenzierten Abschnitte.

| Datei | Inhalt |
|---|---|
| `docs/produkt.md` | Funktionsumfang mit IDs |
| `docs/daten-und-rechte.md` | Datenmodell, Klassifizierung, Berechtigungsmatrix |
| `docs/architektur.md` | Tech-Stack, Dienste, Abläufe |
| `docs/sicherheit.md` | Sicherheitskonzept, Rate-Limits, Schlüsselliste, Projektwerte |
| `docs/recht.md` | Rechtliche Funktionen (Export, Löschung, Rechtstexte, KI-Hinweise) |
| `docs/tests.md` | Akzeptanzkriterien, Teststrategie, Sicherheitstests |
| `docs/betrieb.md` | Deployment, Monitoring, Backups |
| `docs/roadmap.md` | Aufgaben mit IDs und Status |
| `docs/entscheidungen.md` | Entscheidungen und bewusst akzeptierte Risiken |
| `docs/aenderungen.md` | Abweichungen vom Plan während der Umsetzung (Abschnitt 7) |

## 2. Tech-Stack

| Bereich | Technologie |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript 5, Tailwind CSS 4, Lucide |
| Backend | Next.js Route Handler (Node), Middleware (Edge), Vercel AI SDK 5 + OpenRouter |
| Datenbank | Supabase Postgres mit RLS, Migrationen in `supabase/migrations/` |
| Auth | Supabase Auth (E-Mail + Passwort), serverseitig über `/api/auth/*` |
| Zahlung | Stripe (Checkout, Portal, Webhook) |
| Rate-Limits | Upstash Redis (`@upstash/ratelimit`) |
| Hosting | Vercel |
| Tests | Vitest, PostgreSQL-RLS-Tests (`scripts/test-rls.sh`), Playwright-Smoke (`scripts/smoke-browser.cjs`) |

Keine weiteren Frameworks oder Abhängigkeiten ohne Rückfrage.

## 3. Arbeitsweise

1. Arbeite die Aufgaben aus `docs/roadmap.md` **der Reihe nach** ab, eine nach der anderen. Beginne erst eine neue Aufgabe, wenn die vorherige die Definition of Done erfüllt.
2. Kleine Schritte: Eine Aufgabe ändert nur, was für sie nötig ist.
3. Vor dem Umsetzen: kurz sagen, was du vorhast und welche Dateien du änderst.
4. **Tests gehören zur Aufgabe.** Bei Funktionen mit Nutzerdaten immer auch den Test „anderer Nutzer hat keinen Zugriff“ (API-Test **und** `supabase/tests/rls.test.sql`).
5. Nach jeder Aufgabe: Status in `docs/roadmap.md` aktualisieren, in 2–3 Sätzen in einfacher Sprache berichten, was der Projektinhaber jetzt ausprobieren kann. Abweichungen vom Plan nach Abschnitt 7.
6. **Bei Unklarheit fragen, nicht raten.** Offene Annahmen stehen in Abschnitt 6.
7. Nach jedem Meilenstein: Kurze Klick-Checkliste für den Projektinhaber ausgeben und auf seine Abnahme warten.
8. Behaupte nie, etwas funktioniere, ohne es getestet zu haben.
9. Schema-Änderungen nur als neue Datei in `supabase/migrations/` (fortlaufende Nummer), nie bestehende Migrationen ändern.
10. Neue Tarifwerte nur in `lib/plans.ts` **und** `apply_subscription_tier` (Test `tests/plans.test.ts` prüft den Gleichlauf).

## 4. Definition of Done (jede Aufgabe)

- [ ] Akzeptanzkriterien (`AK-…`) aus `docs/tests.md` erfüllt; zugehörige Tests (`TEST-…`, `T-SEC-…`) grün
- [ ] `npm run typecheck`, `npm test`, `npm run test:rls`, `npm run build` grün
- [ ] Sicherheitsregeln (Abschnitt 5) eingehalten
- [ ] Keine Fehler/Warnungen in Konsole (inkl. CSP-Verstöße)
- [ ] Barrierefreiheit beachtet (Beschriftungen, Kontrast, Tastatur, Fokus)
- [ ] Texte deutsch und verständlich (eine Sprache, keine i18n-Dateien vorgesehen – Abweichung vom Vorlagenpunkt, siehe `docs/aenderungen.md` Nr. 1)
- [ ] `docs/roadmap.md` aktualisiert

## 5. Nicht verhandelbare Sicherheitsregeln

## Grundsatz

Der Client (Browser, App) ist **nicht vertrauenswürdig**. Alles, was von dort kommt – IDs, Rollen, Preise, Formularfelder, Header – kann manipuliert sein. Sicherheit wird **auf dem Server** und in der **Datenbank** durchgesetzt.

## 1. Geheimnisse

- 1.1 Geheime Schlüssel (Service-Role/Secret Keys, API-Keys für KI/SMS/E-Mail, Datenbank-Passwörter, Webhook-Secrets) MÜSSEN ausschließlich serverseitig verwendet werden. Sie DÜRFEN NIE im Frontend-Code, in Umgebungsvariablen mit Client-Präfix (z. B. `VITE_`, `NEXT_PUBLIC_`, `EXPO_PUBLIC_`), im App-Paket oder im Repository stehen.
- 1.2 Öffentliche Schlüssel (z. B. Supabase Publishable/Anon Key) DÜRFEN im Frontend stehen, aber NUR wenn die zugehörigen Zugriffsregeln (Row Level Security / Security Rules) aktiv sind.
- 1.3 `.env*` MUSS in `.gitignore` stehen. Eine `.env.example` mit Platzhaltern MUSS existieren.
- 1.4 Wird ein Geheimnis versehentlich committet, MUSS es sofort widerrufen und neu erzeugt werden. Nur aus der Git-Historie löschen reicht nicht.

## 2. Zugriffskontrolle

- 2.1 Jeder Endpunkt bzw. jede Datenbankabfrage, die nutzerbezogene Daten liest, ändert oder löscht, MUSS serverseitig prüfen, ob der angemeldete Nutzer dazu berechtigt ist (Besitz, Gruppenmitgliedschaft, Rolle) – gemäß `docs/daten-und-rechte.md`.
- 2.2 Standard ist **verweigern** (deny by default). Neue Tabellen MÜSSEN mit aktivierter Row Level Security bzw. gesperrten Security Rules angelegt werden.
- 2.3 Eine ID aus URL, Query, Body oder Header ist KEIN Berechtigungsnachweis.
- 2.4 Fehlt die Berechtigung, MUSS die Antwort der in `docs/sicherheit.md` festgelegten Zugriffs-Antwortstrategie folgen (Standard: 404 wie bei „nicht vorhanden“). In keinem Fall dürfen Inhalte, Metadaten oder Hinweise auf den fremden Datensatz zurückgegeben werden.
- 2.5 Listen- und Suchendpunkte MÜSSEN serverseitig auf erlaubte Datensätze filtern.
- 2.6 Felder wie `id`, `owner_id`, `user_id`, `role`, `is_admin`, `plan`, `status`, `price`, `created_at` DÜRFEN NICHT aus Client-Eingaben übernommen werden. Eingaben werden über eine Allowlist erlaubter Felder verarbeitet (kein Mass Assignment).
- 2.7 Rollen und Berechtigungen MÜSSEN aus der serverseitigen Sitzung bzw. Datenbank kommen, nie aus dem Client.
- 2.8 Dateien MÜSSEN privat gespeichert und nur über kurzlebige, signierte URLs nach Berechtigungsprüfung ausgeliefert werden.
- 2.9 Das Verstecken von Buttons oder Menüpunkten ist KEINE Zugriffskontrolle.
- 2.10 Admin-Aktionen MÜSSEN protokolliert werden (wer, was, wann).

## 3. Authentisierung & Sitzungen

- 3.1 Es MUSS der in `docs/sicherheit.md` festgelegte Login-Anbieter bzw. die festgelegte Bibliothek verwendet werden. Keine selbst geschriebene Krypto.
- 3.2 Falls Passwörter selbst gespeichert werden: nur mit einem Passwort-Hashing-Verfahren (Argon2id bevorzugt; sonst scrypt oder bcrypt) mit den Parametern aus `docs/sicherheit.md`. Niemals Klartext, Verschlüsselung statt Hashing, MD5 oder einfache SHA-Hashes.
- 3.3 Passwortregeln gemäß `docs/sicherheit.md`: Mindest- und Maximallänge, alle Zeichen erlaubt, Einfügen erlaubt (Passwort-Manager), Prüfung gegen bekannte geleakte Passwörter, keine Pflicht-Sonderzeichen.
- 3.4 Login, Registrierung und Passwort-Reset MÜSSEN identisch antworten, unabhängig davon, ob ein Konto existiert (keine Nutzer-Enumeration).
- 3.5 Reset-, Bestätigungs- und Einladungs-Tokens: kryptografisch zufällig, gehasht gespeichert, einmalig, mit Ablaufzeit gemäß `docs/sicherheit.md`. Nach Passwortänderung alle Sitzungen beenden.
- 3.6 Sitzungs-Cookies: `HttpOnly`, `Secure`, `SameSite=Lax` oder strenger. Neue Sitzungs-ID nach Login. Logout beendet die Sitzung serverseitig. Laufzeiten und erneute Anmeldung für sensible Aktionen gemäß `docs/sicherheit.md`.
- 3.7 Admins MÜSSEN Zwei-Faktor-Authentisierung nutzen; für normale Nutzer gilt die Festlegung in `docs/sicherheit.md`.

## 4. Missbrauchsschutz

- 4.1 Login, Registrierung, Passwort-Reset, E-Mail-/SMS-Versand und alle kostenverursachenden Endpunkte MÜSSEN serverseitig rate-limitiert sein – pro Konto **und** pro IP – gemäß der Tabelle in `docs/sicherheit.md`.
- 4.2 Bei wiederholten Fehlanmeldungen: steigende Wartezeit und vorübergehende Sperre, ggf. CAPTCHA. KEINE dauerhafte automatische Kontosperre.
- 4.3 Überschreitung → HTTP 429 mit `Retry-After`.
- 4.4 Anfragegröße, Upload-Größe und Seitengröße von Listen MÜSSEN gemäß `docs/sicherheit.md` begrenzt sein.
- 4.5 Nutzungsabhängige Dienste (KI, SMS, Karten) MÜSSEN ein Limit pro Nutzer und eine Budget-Grenze haben.

## 5. Eingaben & Ausgaben

- 5.1 Alle Eingaben MÜSSEN serverseitig mit einem Schema validiert werden (Typ, Länge, Format, erlaubte Werte).
- 5.2 Datenbankzugriffe NUR parametrisiert bzw. über ORM/Query-Builder. Keine String-Verkettung mit Eingaben.
- 5.3 Nutzerinhalte MÜSSEN beim Ausgeben escaped werden. Kein `innerHTML`/`dangerouslySetInnerHTML`/`v-html` mit ungefilterten Nutzerdaten; wenn HTML nötig ist, mit einer Sanitizer-Bibliothek bereinigen.
- 5.4 Bei cookie-basierten Sitzungen MUSS CSRF-Schutz aktiv sein.
- 5.5 Uploads: Typ anhand des Inhalts prüfen, Größenlimit, zufälliger Dateiname, privat speichern, nie ausführen.
- 5.6 Serverseitige Abrufe fremder URLs NUR über Allowlist; interne Adressen sperren (SSRF).
- 5.7 Weiterleitungen NUR auf eigene, bekannte Ziele.

## 6. Transport & Browser

- 6.1 Nur HTTPS; HSTS aktiv.
- 6.2 Security-Header gemäß `docs/sicherheit.md` MÜSSEN gesetzt sein: mindestens `Content-Security-Policy` (inkl. `frame-ancestors`), `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
- 6.3 CORS NUR für eigene Domains. Kein `*` bei Endpunkten mit Anmeldung.

## 7. Daten & Datenschutz

- 7.1 Nur die in `docs/daten-und-rechte.md` definierten Daten speichern (Datensparsamkeit).
- 7.2 Keine Passwörter, Tokens, Gesundheits- oder andere sensible Daten in Logs, URLs, Fehlermeldungen, Analytics oder Push-Texten.
- 7.3 „Konto löschen“ MUSS alle personenbezogenen Daten inkl. Dateien tatsächlich löschen (bzw. nach der dokumentierten Backup-Frist).
- 7.4 Datenexport NUR für den angemeldeten Nutzer selbst.
- 7.5 Schriften, Icons und Skripte möglichst lokal ausliefern statt von Drittservern.

## 8. Zahlungen, Webhooks, KI

- 8.1 Preise, Produkte und Freischaltungen bestimmt ausschließlich der Server. Freischaltung NUR nach verifizierter Zahlungsbestätigung (Webhook/Server-API), nie über Client-Parameter.
- 8.2 Webhooks: Signatur prüfen, Zeitstempel prüfen, idempotent verarbeiten.
- 8.3 Keine Kartendaten selbst speichern.
- 8.4 KI-Funktionen: Ausgaben eines Sprachmodells sind nicht vertrauenswürdig – nie ungeprüft als Code, SQL, HTML oder Berechtigungsentscheidung verwenden. Dem Modell nur Daten geben, die der aktuelle Nutzer sehen darf.

## 9. Abhängigkeiten & Fehler

- 9.1 Neue Abhängigkeiten nur mit Begründung; verbreitete, gepflegte Pakete bevorzugen; Lockfile einchecken.
- 9.2 Bekannte Schwachstellen (z. B. `npm audit` hoch/kritisch) MÜSSEN vor einem Release behoben oder dokumentiert werden.
- 9.3 Nutzer sehen allgemeine Fehlermeldungen; technische Details nur im Server-Log.
- 9.4 Sicherheitsereignisse (Logins, Fehlversuche, verweigerte Zugriffe, Admin-Aktionen, Rate-Limit-Treffer) werden protokolliert.
- 9.5 Vor dem Installieren einer neuen Abhängigkeit prüfen, dass das Paket wirklich existiert und das gemeinte ist (genauer Name, Herausgeber, Pflegestand). Sprachmodelle erfinden Paketnamen, und Angreifer registrieren solche Namen. Im Zweifel nachfragen.
- 9.6 CI-Workflows, Aktionen und Skripte von Dritten nur aus vertrauenswürdigen Quellen, mit festgelegter Version und minimalen Rechten. Geheimnisse erscheinen nie in Build- oder Testprotokollen.
- 9.7 Änderungen am Datenbankschema nur über versionierte Migrationen, nie von Hand in Produktion, und vor jeder Migration ein Backup.

## 10. Arbeitsweise

- 10.1 Für jede Funktion, die nutzerbezogene Daten liest oder schreibt, MUSS ein automatisierter Test existieren, der den Zugriff eines **anderen** Nutzers prüft (erwartet: verweigert).
- 10.2 Sicherheitstests aus `docs/tests.md` MÜSSEN in der CI laufen und grün sein, bevor eine Aufgabe als erledigt gilt.
- 10.3 Wenn eine Anforderung mit diesen Regeln kollidiert: NICHT eigenmächtig abweichen, sondern den Projektinhaber fragen und die Entscheidung dokumentieren.
- 10.4 Keine Sicherheitsregel „vorübergehend“ abschalten, um etwas zum Laufen zu bringen (z. B. RLS deaktivieren, CORS auf `*`, Validierung auskommentieren).
- 10.5 Behaupte nie, eine Sicherheitsanforderung sei erfüllt, ohne Nachweis (Testergebnis, Konfiguration, Fundstelle).

Alle konkreten Werte, auf die diese Regeln verweisen (Passwort-Hashing, Längen, Laufzeiten, Rate-Limits, Größenlimits, Header, Zugriffs-Antwortstrategie, Schlüsselliste), stehen in **`docs/sicherheit.md`**. Gibt es dort für eine Regel keinen Wert: nicht raten, sondern nachfragen.

## 6. Offene Annahmen – vor Umsetzung beim Projektinhaber klären

| ID | Annahme | Betrifft |
|---|---|---|
| A-001 | Die App läuft noch nicht live mit echten Nutzern | Dringlichkeit, Migration |
| A-002 | Gates gelten durch den Auftrag als freigegeben; adaptive Arbeitsweise | Prozess |
| A-003 | Hosting auf Vercel | Betrieb, `maxDuration` |
| A-004 | Auch mittlere Befunde werden behoben | Umfang |
| A-005 | `billing_events` werden nach 90 Tagen gelöscht | TASK-018 |
| A-006 | Sicherheitslogs: 30 Tage über Hosting-Logs | Datenschutz |
| A-007 | Abrechnungsmonat nach UTC | Kontingent |
| A-008 | Supabase-/Upstash-Region EU | Datenschutz |
| A-009 | Credit-Limit/Alarme im OpenRouter-Konto | Kosten (TASK-022) |
| A-010 | Betreiber geschäftlich mit Sitz in Deutschland | Recht |
| A-011 | Preise sind Endpreise inkl. MwSt. | Preisangaben |
| A-012 | Beta-Test mit 5–10 Nutzern im Stripe-Testmodus | Launch |
| A-013 | RPO 24 h / RTO 4 h | Betrieb |
| A-014 | Support per E-Mail, Störungshinweis auf Login-Seite | Betrieb |
| A-015 | Supabase-Dashboard wie in `docs/sicherheit.md` eingestellt | Login, Sitzungen (TASK-021) |

## 7. Abweichungen vom Plan (Rückweg)

Der Plan in `docs/` ist die verbindliche Grundlage. Wenn sich beim Bauen zeigt, dass etwas anders gemacht werden muss:

1. **Kleine Abweichung** (Detail ohne Auswirkung auf Daten, Rechte, Sicherheit, Kosten oder Umfang): umsetzen, in `docs/aenderungen.md` eintragen und das betroffene Dokument in `docs/` anpassen.
2. **Wesentliche Abweichung** (neue oder geänderte Funktion, Rolle, Datenfeld, externer Dienst, Kosten, oder eine Sicherheitsregel ist berührt): **anhalten und den Projektinhaber fragen.** Erst nach Zustimmung umsetzen, dann `docs/aenderungen.md`, betroffene Dokumente, Akzeptanzkriterien und Tests aktualisieren.
3. **Größere Erweiterung:** dem Projektinhaber empfehlen, sie mit idea-to-app im Modus „Bestehende App“ zu planen.

Jeder Eintrag in `docs/aenderungen.md` nennt die betroffenen IDs (`F-…`, `AK-…`, `T-SEC-…`, `TASK-…`, `E-…`). Ein Plan, der nicht mehr zum Code passt, ist ein Fehler – kein Detail.

## 8. Vor einer Veröffentlichung zusätzlich nötig

- Offene Aufgaben TASK-018 … TASK-023 (Deployment, Backups, Supabase-/OpenRouter-Einstellungen, AGB, Barrierefreiheit, Launch-Freigabe).
- Launch-Checkliste (Phase 23) mit **nachprüfbaren Nachweisen** (Datum, Link, Dateipfad, ID oder Commit-Nummer) für jeden Haken.
- Alle `[PRÜFEN]`-Punkte in `docs/recht.md` mit einer Fachperson klären.
