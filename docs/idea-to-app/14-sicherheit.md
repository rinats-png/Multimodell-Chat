# Sicherheitskonzept

Risikostufe: 2 | Zielstandard: Checkliste + OWASP ASVS Level 1

> Dieses Konzept beschreibt den **umgesetzten** Stand (Commit nach `022f44c`, Branch `ccr-aab1b190-y70xl3`). Nachweise für Tests: `npm test` (Vitest) und `npm run test:rls` (PostgreSQL), beide grün am 2026-10-29. Gegenprobe (Schutz abgeschaltet → Test rot) für T-SEC-02, T-SEC-04, T-SEC-12 und T-SEC-19 am 2026-10-29 durchgeführt.

## Bedrohungsmodell

| ID | Was ist wertvoll? | Wer greift an? | Wie? (STRIDE) | Folge | Wahrscheinlichkeit | Gegenmaßnahme | Abschnitt | Test / akzeptiert |
|---|---|---|---|---|---|---|---|---|
| BD-01 | Debatten anderer Nutzer | neugieriger Nutzer | Raum-/Agent-ID in URL oder REST-API ändern (I) | Datenleck | hoch | RLS-Besitzkette, 404-Strategie, UUID-Prüfung | C | T-SEC-13, T-SEC-16 |
| BD-02 | Integrität fremder Daten | böswilliger Nutzer | fremde Datensätze ändern/löschen oder unter fremder ID anlegen (T) | Datenverlust | mittel | RLS `USING` + `WITH CHECK`, `user_id DEFAULT auth.uid()` | C | T-SEC-17, T-SEC-18 |
| BD-03 | Abrechnung (Kontingent, Tarif, Ledger) | Nutzer mit eigener Sitzung | direkte REST-Schreibzugriffe auf Profil, Key, Nachrichten, Gedächtnis; Leerzeichen-Key (T, E) | Gratis-Nutzung auf Plattformkosten | hoch | Column-Grants: Clients nur lesen; Schreiben nur Service-Role nach Besitzprüfung; gemeinsame Key-Logik; CHECK `v1:`; harte DB-Obergrenzen (12 Agenten/Raum, 100 Räume) | C, H | T-SEC-04, T-SEC-19, T-SEC-20, T-SEC-21, T-SEC-34 |
| BD-04 | KI-Budget der Plattform | Nutzer / Skript | Stream abbrechen, riesige Kontexte, parallele Runden (D, E) | unbegrenzte Kosten | hoch | Verbrauch bei Abbruch buchen, Vorab-Schätzung, Kontext-Budget, Sperre pro Konto | E | T-SEC-02, T-SEC-05, T-SEC-07, T-SEC-08 |
| BD-05 | KI-Budget der Plattform | Nutzer | teure Modell-IDs oder mehr Agenten/Turns als der Tarif erlaubt (E) | Kosten pro Token vervielfacht | hoch | Modell-Allowlist für Plattform-Key, Tarifgrenzen beim Speichern und beim Aufruf | E, I | T-SEC-03, T-SEC-09 |
| BD-06 | gesamte App | Betreiber-Fehler | Produktion ohne Supabase-Variablen → Demo ohne Login (fail open); öffentliche Demo mit gemeinsamem Datenbestand | offener Proxy, Datenmischung | mittel | Produktionsprüfung „fail closed“ (auch Auth-Routen), Demo nie mit Plattform-Key, eigener Demo-Bestand je Besucher-Cookie | D | T-SEC-01, T-SEC-32 |
| BD-07 | Nutzerkonten | Angreifer | Passwort raten (auch über Reauth), Credential Stuffing, Passwort mit übernommener Sitzung ändern (S) | Kontoübernahme | mittel | Login- und Reauth-Limit pro IP und pro Konto (vorübergehende Sperre), Mindestlänge 15, Leaked-Password-Schutz, Passwortänderung nur mit frischer Anmeldung dieser Sitzung | A, E | T-SEC-24, T-SEC-31 |
| BD-08 | Wissen, wer Kunde ist | Angreifer | unterschiedliche Antworten bei Login/Registrierung/Reset (I) | Nutzer-Enumeration | mittel | einheitliche Antworten | A | T-SEC-23 |
| BD-09 | Verfügbarkeit, Kosten | Bot | Anfrageflut, übergroße Anfragen (D) | Ausfall, Kosten | mittel | Limits pro IP (Middleware) und Konto, 413 bei > 100 KB | E | T-SEC-06, T-SEC-15 |
| BD-10 | Aktionen im Konto | fremde Website | CSRF mit Sitzungs-Cookie (T) | ungewollte Aktionen | niedrig | `SameSite=Lax` + Origin-Prüfung für schreibende API-Aufrufe | F | T-SEC-12 |
| BD-11 | Sitzung, Chat-Inhalte | Angreifer per XSS / Prompt-Injection | Skript-Einschleusung, Markdown-Bilder als Datenkanal (I) | Sitzungsdiebstahl, Datenabfluss | niedrig | CSP mit Nonce, HttpOnly-Cookies, kein Roh-HTML, externe Bilder blockiert | F, G | T-SEC-11, T-SEC-26, T-SEC-28 |
| BD-12 | Bezahlte Tarife | Nutzer / Zustellreihenfolge | Tarif ohne Zahlung setzen (gefälschter oder verspäteter Webhook, Zweit-Abo, Demo-Tarifwechsel) (S, E) | Umsatzverlust, Kosten | mittel | Stripe-Signatur + Zeitstempel, Idempotenz, Abo-Zustand immer live bei Stripe abfragen, nur gespeichertes Abo zählt, kein Zweit-Checkout, Demo-Wechsel nur lokal | I | T-SEC-25, T-SEC-27, T-SEC-30 |
| BD-13 | BYOK-Keys, Stripe-IDs | Angreifer mit DB-/Backup-/Browser-Zugriff | Keys aus Datenbank, Logs oder Profil-Antwort lesen (I) | fremde OpenRouter-Konten belastet | niedrig | AES-256-GCM, Spalte nicht lesbar, nie geloggt, Profil-Allowlist für den Browser | D, H | T-SEC-10, T-SEC-19, T-SEC-33 |
| BD-14 | Vertrauliche Prompts in Logs | Insider / Log-Leck | Fehlerobjekte mit Request-Body landen im Log (I) | Datenleck | mittel | Logging nur mit Typ/Status/Referenz | J | T-SEC-29 |
| BD-15 | Integrität der App | Lieferkette | verwundbare oder untergeschobene Pakete (T) | Kompromittierung | niedrig | Lockfile, `npm audit` in CI, Dependabot, gitleaks, Actions per Commit-SHA | J | E-005 |
| BD-16 | Verlässlichkeit der Antworten | Nutzer selbst / eingefügter Text | Prompt-Injection gegen eigene Agenten (T) | Agenten verhalten sich anders | hoch | Kontext enthält nur eigene Daten des Nutzers; KI-Ausgaben werden nie ausgeführt; Hinweisfilter nur informativ | I | E-008 |

## Projektwerte (aus security/standardwerte.md übernommen bzw. angepasst)

| Punkt | Wert | Abweichung vom Standard? Begründung |
|---|---|---|
| Zugriffs-Antwortstrategie | **404** für alle Nutzerdaten (Räume, Agenten, Nachrichten), auch bei ungültiger ID; nicht angemeldet → 401 | – |
| Login | Anbieter: Supabase Auth (E-Mail + Passwort), alle Abläufe serverseitig über `/api/auth/*` | – |
| Passwort-Hashing / Mindestlänge | bcrypt durch Supabase; Mindestlänge **15** (einziger Faktor, kein 2FA), Höchstlänge 72 (bcrypt-Grenze), alle Zeichen erlaubt, keine Kompositionsregeln, „Leaked password protection“ im Dashboard an | Höchstlänge 72 statt „mindestens 64“: erfüllt den Standard |
| Reset-Link-Laufzeit | Supabase-Einstellung „Email OTP Expiration“ auf **1800 s (30 min)**, einmalig; nach Passwortänderung `signOut({scope:"others"})` | – |
| E-Mail-Bestätigung | Pflicht (Dashboard „Confirm email“ an), Link ≤ 24 h | – |
| Sitzungen | Cookie `HttpOnly`, `Secure` (Produktion), `SameSite=Lax`, Inaktivität **30 Tage**; absolute Höchstdauer **90 Tage** (Dashboard „Time-box user sessions“); Refresh-Token-Rotation an | **Abweichung:** Standard sieht 30 Tage nur mit „angemeldet bleiben“ vor, sonst 24 h → E-012 |
| Erneute Anmeldung | Konto löschen, Export und Passwort ändern nur, wenn **diese Sitzung** sich vor ≤ **15 min** angemeldet hat (`amr`-Zeitstempel des Tokens; beim Reset-Link der Zeitpunkt des Links) | – |
| 2FA | nicht angeboten (Stufe 2: „anbieten“) | Abweichung, akzeptiert als E-004 |
| Betreiber-Zugänge | 2FA Pflicht auf GitHub, Vercel, Supabase, Stripe, OpenRouter, Upstash, Domain, E-Mail | – |
| Größenlimits | JSON-Anfrage **100 KB** (Webhook 256 KB); Nachricht 4.000 Zeichen; System-Prompt 4.000; Titel 120; Agentenname 40; Räume max. 100 pro Konto und Abruf (Nachrichtenlisten pro Raum ungeteilt, siehe Parkplatz); DB: Nachricht ≤ 20.000 Zeichen | – |
| KI-Kontext | max. **12.000** geschätzte Input-Tokens pro Aufruf, max. **700** Output-Tokens; Router 120, Summary 300 Output-Tokens; Summary-Eingabe max. 30 Nachrichten à 1.500 Zeichen | projektspezifisch |
| Security-Header | `Content-Security-Policy` mit Nonce (`script-src 'self' 'nonce-…' 'strict-dynamic'`, `frame-ancestors 'none'`, `img-src 'self' data: blob:`, `connect-src 'self' <Supabase>`), `Strict-Transport-Security: max-age=63072000; includeSubDomains`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`, `X-Frame-Options: DENY` | `style-src 'unsafe-inline'` – E-007 |
| CORS | keine CORS-Freigaben (nur gleiche Herkunft); schreibende API-Aufrufe nur mit eigenem `Origin` | – |
| Protokollierung | Sicherheitsereignisse als JSON (`level: security`): Login ok/fehlgeschlagen/gesperrt, Reset, Passwortänderung, Rate-Limit-Treffer, Firewall-Treffer, Webhook-Signatur ungültig, Tarif gesetzt, Export, Konto gelöscht; **nie** Inhalte, Passwörter, Keys; Aufbewahrung 30 Tage | – |

## Rate Limits

| Endpunkt | Pro Konto | Pro IP | Reaktion |
|---|---|---|---|
| alle `/api/*` | – | 300 / min | `429` + `Retry-After` |
| schreibende API-Aufrufe (Räume, Agenten, Profil, Tarif) | 60 / min | (s. o.) | `429` + `Retry-After` |
| `/api/orchestrate` (Runden) | Tarif: 5 / 15 / 60 pro min | 20 / min | `429` + `Retry-After` **vor** dem Stream |
| Agenten-Antworten (teuer) | Tarif: 5 / 15 / 60 pro min + Monatskontingent 15k / 500k / 2,5 Mio. Tokens | – | Fehler-Event `rate_limited` bzw. `quota_exceeded` |
| parallele Runden | 1 gleichzeitig | – | `409` |
| Login | 5 Fehlversuche / 15 min → vorübergehend gesperrt (kein Dauer-Lock) | 20 / 15 min | `429` + `Retry-After` |
| Registrierung | – | 5 / h | `429` |
| Passwort-Reset | 3 / h (darüber: gleiche Antwort, kein Versand) | 10 / h | gleiche Antwort |
| Export / Konto löschen | 5 / h | – | `429` |
| Supabase Auth intern | Dashboard-Limits (E-Mail-Versand, Token-Refresh) aktiv lassen | | |

Zähler liegen in Upstash Redis (Produktion Pflicht, instanzübergreifend), lokal im Speicher.

## Schlüssel

| Name der Umgebungsvariable | Öffentlich / geheim | Wo gespeichert | Wer nutzt ihn |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | öffentlich | Vercel Env | Browser-Build, Server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | öffentlich (nur mit RLS) | Vercel Env | Server (Sitzung) |
| `SUPABASE_SERVICE_ROLE_KEY` | **geheim** (umgeht RLS) | Vercel Env (Production/Preview getrennt) | Server: Ledger, Verbrauch, Profil, Konto löschen, Webhook |
| `OPENROUTER_API_KEY` | **geheim** | Vercel Env | Server: Modellaufrufe mit Plattform-Key |
| `BYOK_ENCRYPTION_KEY` | **geheim** (32 Byte base64) | Vercel Env | Server: Ver-/Entschlüsselung der Nutzer-Keys (OpenRouter-Spalte und `provider_keys` für Gateway/OpenAI/Anthropic/Google/xAI) |
| `LOCAL_SUBSCRIPTION_MODE` | nicht geheim, Schalter | nur `.env.local` auf dem eigenen Rechner | Lokaler Abo-Modus (CLI-Brücke). Wirkt nur ohne `NODE_ENV=production` und ohne Supabase – nie auf einem Server setzen |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | **geheim** | Vercel Env | Server + Middleware: Rate-Limits, Sperren |
| `STRIPE_SECRET_KEY` | **geheim** | Vercel Env | Server: Checkout, Portal, Abo-Abfrage, Kündigung |
| `STRIPE_WEBHOOK_SECRET` | **geheim** | Vercel Env | Server: Signaturprüfung |
| `STRIPE_PRICE_PRO` / `_TEAM` | öffentlich | Vercel Env | Server: Preiswahl (nie vom Client) |
| `OPERATOR_*` | öffentlich | Vercel Env | Impressum, Datenschutz |
| `LOG_HASH_SECRET` | **geheim** | Vercel Env | Server: HMAC für E-Mail-Kennungen in Limits und Logs |
| `APP_ORIGIN` | öffentlich, **Pflicht in Produktion** | Vercel Env | Origin-Prüfung, Links in Mails, Checkout |
| `OPENROUTER_DATA_COLLECTION` | öffentlich, **sicherheitsrelevant** (Standard `deny`; `allow` nur nach Datenschutzprüfung) | Vercel Env | Server |
| `TRUSTED_PROXY_HOPS` | öffentlich (Standard 0 = Vercel) | Vercel Env | Client-IP für IP-Limits hinter eigenen Proxys |
| `ALLOW_DEMO_MODE`, `ROUTER_MODEL`, `SUMMARY_MODEL` | öffentlich | Vercel Env | Server |

Getrennte Schlüssel für Entwicklung, Vorschau und Produktion. Bei Verdacht auf Leck: Schlüssel beim Anbieter widerrufen und neu erzeugen. Für `BYOK_ENCRYPTION_KEY` gilt zusätzlich: Alle Nutzer-Keys werden damit unlesbar, die Nutzer müssen sie neu hinterlegen.

## Festlegungen A–K

- **A Login:** Supabase Auth, nur serverseitige Abläufe (kein Browser-Client), einheitliche Antworten, Fehlversuchs-Sperre pro Konto (E-Mail-HMAC) und IP. Dashboard [ANNAHME A-015]: Confirm email an, Mindestlänge 15, Leaked-Password-Schutz an (Supabase-Pro-Funktion [Q-005]), Redirect-Allowlist nur eigene Domain.
- **B Sitzungen:** siehe Projektwerte; Abmelden widerruft die Refresh-Tokens serverseitig.
- **C Zugriffskontrolle:** RLS deny-by-default auf allen Tabellen, Column-Grants für Profil/Ledger/Gedächtnis, Service-Role nur nach Sitzungsprüfung (`assertOwnRoom`), 404-Strategie.
- **D Secrets:** Liste oben; keine geheimen Werte mit `NEXT_PUBLIC_`; `.env*` in `.gitignore`; gitleaks in CI.
- **E Missbrauch (Ergänzung nach Zweitprüfung):** Abbruch bucht die volle Ausgabe-Reservierung (700 Tokens), Router- und Summary-Aufrufe werden auch bei Abbruch/Fehler mit Schätzung gebucht; Rundensperre mit Besitzer-Token; Client-IP per `TRUSTED_PROXY_HOPS` konfigurierbar.
- **E Missbrauch:** Rate-Limits oben, Kontingent mit Vorab-Schätzung, Verbrauch auch bei Abbruch, Kontext-Budget, Modell-Allowlist, Tarifgrenzen, eine Runde pro Konto, **Budget-Grenze im OpenRouter-Konto** (Credit-Limit) als letzte Sicherung [ANNAHME A-009].
- **F Eingaben/Ausgaben:** Zod-Schemas mit `.strict()` auf allen Routen, Pfad-IDs als UUID, Längen-CHECKs in der DB, Query-Builder statt SQL, Markdown ohne Roh-HTML und ohne externe Bilder, Origin-Prüfung.
- **G Transport:** HTTPS (Vercel), HSTS, CSP mit Nonce, alle Seiten dynamisch gerendert (Nonce pro Anfrage).
- **H Daten:** BYOK verschlüsselt (AES-256-GCM), Export und Löschung für den Nutzer, Kaskadenlöschung, keine Uploads.
- **I Zahlung/KI:** Preis- und Tarifwahl nur serverseitig, Stripe-Webhook mit Signatur, Zeitstempel und Idempotenz; KI-Ausgaben nur als Text angezeigt, nie ausgeführt; KI erhält nur Daten des aktuellen Nutzers; OpenRouter `data_collection: deny`.
- **J Lieferkette/Logging/Fehler:** Lockfile, `npm audit` (CI bricht bei kritisch ab), Dependabot, Actions mit Commit-SHA und `contents: read`; Fehler an Nutzer allgemein mit Referenz-ID, Details nur im Log, keine Inhalte in Logs.
- **K Verifikation:** 78 automatisierte Tests + RLS-Tests, Gegenprobe, Zweitprüfung (siehe unten), Abgleich ASVS L1 vor Launch (Phase 23).

## Bewusst akzeptierte Risiken

| ID | Bezug | Risiko | Warum akzeptiert | Neu bewerten bis |
|---|---|---|---|---|
| E-004 | Projektwerte 2FA | Kontoübernahme nur mit Passwort | Mindestlänge 15 + Leaked-Password-Schutz + Sperre; 2FA (TOTP über Supabase MFA) ist Parkplatz | 2027-01-31 |
| E-005 | BF-15, BD-15 | `postcss` in Next 15 (Build-Zeit) und `undici`/`@fastify/busboy` in `@ai-sdk/provider-utils` (Multipart) mit bekannten hohen Schwachstellen | kein Fix ohne Major-Upgrade (Next 16 / AI SDK 6+); betroffene Pfade werden zur Laufzeit nicht mit Fremddaten genutzt | 2026-12-31 |
| E-007 | Projektwerte CSP | `style-src 'unsafe-inline'` | React-Style-Attribute (Fortschrittsbalken); Skripte bleiben streng per Nonce | 2027-03-31 |
| E-008 | BD-16 | Prompt-Injection gegen eigene Agenten | Kontext enthält nur eigene Daten, keine Werkzeuge/Aktionen; Restrisiko trifft nur den Nutzer selbst | 2027-03-31 |
| E-012 | Projektwerte Sitzungen | Sitzung 30 Tage ohne „angemeldet bleiben“ | übliche SaaS-Erwartung; Ausgleich: HttpOnly, 90-Tage-Höchstdauer, frische Anmeldung für sensible Aktionen | 2027-03-31 |
| E-013 | Z14-01 | Modell-Allowlist und Tarifgrenzen nur in der App, nicht in der DB | Laufzeit prüft vor jedem Aufruf erneut; DB setzt harte Obergrenzen (12 Agenten, 100 Räume, Längen) | 2027-03-31 |

## Pflicht-Sicherheitstests (für Phase 19)

| Test | Sichert ab | Erwartung |
|---|---|---|
| T-SEC-01 | BD-06 | Produktion ohne Supabase startet nicht; Demo nutzt nie den Plattform-Key |
| T-SEC-02 | BD-04 | Abbruch mitten im Stream bucht Verbrauch, Teilantwort markiert |
| T-SEC-03 | BD-05 | Plattform-Key + Modell außerhalb Katalog → abgelehnt vor Kosten (API 403, Runde `model_not_allowed`) |
| T-SEC-04 | BD-03 | Leerzeichen-Key / Key im falschen Tarif hebt Kontingent nicht auf |
| T-SEC-05 | BD-04 | Restkontingent < Schätzung → kein Modellaufruf |
| T-SEC-06 | BD-09 | Rundenlimit → HTTP 429 + `Retry-After`; Minutenlimit pro Konto |
| T-SEC-07 | BD-04 | zweite parallele Runde → 409 |
| T-SEC-08 | BD-04 | Kontext ≤ Budget, älteste Nachrichten fallen zuerst |
| T-SEC-09 | BD-05 | manipulierte Raumwerte überschreiten Tarifgrenzen nicht |
| T-SEC-10 | BD-13 | Key nur verschlüsselt, Manipulation erkannt |
| T-SEC-11 | BD-11 | CSP mit Nonce und Security-Header auf jeder Antwort |
| T-SEC-12 | BD-10 | fremde Herkunft bei schreibenden API-Aufrufen → 403 |
| T-SEC-13 | BD-01 | fremde/ungültige IDs → 404 ohne Details |
| T-SEC-14 | BD-02 | unbekannte Felder (z. B. `user_id`) → 400 |
| T-SEC-15 | BD-09 | Anfrage > 100 KB → 413 |
| T-SEC-16 | BD-01 | DB: A sieht nur eigene Daten, anon nichts |
| T-SEC-17 | BD-02 | DB: A ändert/löscht keine fremden Daten |
| T-SEC-18 | BD-02 | DB: A legt nichts in fremden Räumen / unter fremder ID an |
| T-SEC-19 | BD-03, BD-13 | DB: Ledger, Gedächtnis, Profil, Key nicht schreibbar; Key/Stripe-IDs nicht lesbar; Klartext-Key abgelehnt |
| T-SEC-20 | BD-03 | DB: Verbrauchs-/Tariffunktionen nur service_role |
| T-SEC-21 | BD-04 | DB: Längengrenzen (System-Prompt, Window) |
| T-SEC-22 | BD-02 | DB: Konto löschen entfernt alle eigenen Daten, fremde bleiben |
| T-SEC-36 | BD-01 | Eigene Anbieter-Keys: ein anderer Nutzer sieht und nutzt sie nicht |
| T-SEC-37 | BD-01 | Anbieter-Keys liegen im Speicher nur verschlüsselt; DB lehnt Klartext und Client-Zugriff ab |
| T-SEC-38 | BD-01 | „Mit OpenRouter verbinden“: Rückleitung nur mit passendem state (PKCE, HttpOnly-Cookie) |
| T-SEC-39 | BD-03 | Abo-Modelle laufen ohne Schalter nie über ein lokales Programm; Prompt nur über stdin |
| T-SEC-23 | BD-08 | Login/Registrierung/Reset antworten einheitlich |
| T-SEC-24 | BD-07 | 5 Fehlversuche → vorübergehende Sperre mit `Retry-After` |
| T-SEC-25 | BD-12 | Webhook: falsche Signatur → 400; Event-ID nur einmal verarbeitet |
| T-SEC-26 | BD-11 | Sitzungs-Cookies HttpOnly, SameSite=Lax |
| T-SEC-27 | BD-12 | Tarifwechsel ohne Zahlung in Produktion gesperrt |
| T-SEC-28 | BD-11 | Markdown: keine externen Bilder, kein HTML |
| T-SEC-29 | BD-14 | Fehlerprotokoll ohne Request-Body |
| T-SEC-30 | BD-12 | Webhook: Zustand live von Stripe; veraltete/fremde Abo-Events ohne Wirkung |
| T-SEC-31 | BD-07 | Passwortänderung ohne frische Anmeldung dieser Sitzung → 403 |
| T-SEC-32 | BD-06 | Öffentliche Demo: eigener Bestand je Besucher, ohne Cookie kein Zugriff, kein Plattform-Key |
| T-SEC-33 | BD-13 | Browser-Profil ohne Key und Stripe-IDs |
| T-SEC-34 | BD-03 | Service-Role schreibt nur nach Besitzprüfung und nur für die eigene ID |

## Zweitprüfung
Bericht B1: `pruefungen/zweitpruefung-b1-2026-10-29.md` · alle 26 Befunde bearbeitet (Zuordnung in `B1-ist-analyse.md`).
Bericht Phase 14 (Prüfung des umgesetzten Stands): `pruefungen/zweitpruefung-14-2026-10-29.md` · Urteil „freigabefähig mit Auflagen“; alle 18 Befunde bearbeitet (Abschnitt „Bearbeitung“ im Bericht), Auflagen Z14-02 … Z14-05, Z14-07, Z14-10 behoben.

## Externe Fachprüfung (nur Stufe 3)
Nicht erforderlich (Stufe 2).
