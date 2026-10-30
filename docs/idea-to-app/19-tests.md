# Qualität & Tests

> Stand 2026-10-30: `npm test` → 13 Testdateien, 78 Tests grün · `npm run test:rls` → alle Erwartungen erfüllt (PostgreSQL 16). Testnamen enthalten die IDs, Fundstelle `tests/*.test.ts` bzw. `supabase/tests/rls.test.sql`.

## Akzeptanzkriterien und Tests

### F-01 Registrierung, Anmeldung, Abmeldung
| ID | Kriterium | Test | Ebene |
|---|---|---|---|
| AK-F01-1 | Gegeben falsches Passwort oder unbestätigte/unbekannte E-Mail, wenn ich mich anmelde, dann sehe ich dieselbe Meldung | TEST-F01-1 | Integration (`tests/auth.test.ts`) |
| AK-F01-2 | Gegeben gültige Daten, wenn ich mich anmelde, dann bin ich angemeldet (HttpOnly-Cookie) | TEST-F01-2 | Integration + manuell |
| AK-F01-3 | Gegeben eine bereits registrierte E-Mail, wenn ich mich registriere, dann ist die Antwort dieselbe wie bei einer neuen | TEST-F01-3 | Integration |
| AK-F01-4 | Registrierung nur mit ≥ 15 Zeichen und bestätigtem Datenschutzhinweis | TEST-F01-4 | Integration |

### F-02 Räume
| ID | Kriterium | Test | Ebene |
|---|---|---|---|
| AK-F02-1 | Einstellungen über der Tarifgrenze werden mit 402 abgelehnt, zulässige gespeichert | TEST-F02-1 | Integration (`tests/api.test.ts`) |
| AK-F02-2 | Im Starter-Tarif ist nach 5 Räumen Schluss | TEST-F02-2 | Integration |

### F-03 Gruppenchat mit Streaming
| ID | Kriterium | Test | Ebene |
|---|---|---|---|
| AK-F03-1 | Round-Robin: alle aktiven Agenten antworten nacheinander, Verbrauch wird gebucht | TEST-F03-1 | Integration (`tests/orchestrator.test.ts`) |
| AK-F03-2 | Die API streamt NDJSON in der Reihenfolge user-message … turn-end … usage, done | TEST-F03-2 | Integration |

### F-04 Orchestrierungsmodi
| ID | Kriterium | Test | Ebene |
|---|---|---|---|
| AK-F04-1 | @Mention übersteuert jeden Modus | TEST-F04-1 | Integration |
| AK-F04-2 | Manuell ohne Mention: keine KI-Antwort, Hinweis | TEST-F04-2 | Integration |
| AK-F04-3 | Router: höchstens Max-Auto-Turns, jede Wahl begründet | TEST-F04-3 | Integration |
| AK-F04-4 | Der Moderator wählt nie dieselbe KI zweimal in Folge | TEST-F04-4 | Unit (`tests/router.test.ts`) |

### F-05 Kontext-Formatter
| ID | Kriterium | Test | Ebene |
|---|---|---|---|
| AK-F05-1 | Eigene Antworten = assistant, alle anderen = user mit Sprecher | TEST-F05-1 | Unit (`tests/context-builder.test.ts`) |
| AK-F05-2 | Nur die letzten N Nachrichten | TEST-F05-2 | Unit |
| AK-F05-3 | Prompt beginnt und endet mit user | TEST-F05-3 | Unit |

### F-06 Langzeitgedächtnis
| ID | Kriterium | Test | Ebene |
|---|---|---|---|
| AK-F06-1 | Ab Pro: herausgefallene Nachrichten werden zusammengefasst, Zähler passt | TEST-F06-1 | Integration |
| AK-F06-2 | Starter: kein Gedächtnis (keine Zusatzkosten) | TEST-F06-2 | Integration |

### F-07 Kontingent & Ledger
| ID | Kriterium | Test | Ebene |
|---|---|---|---|
| AK-F07-1 | Ein Aufruf startet nur, wenn das Restkontingent die Schätzung deckt | TEST-F07-1 | Unit (`tests/usage-guard.test.ts`) |

### F-08 Rate-Limits
| ID | Kriterium | Test | Ebene |
|---|---|---|---|
| AK-F08-1 | Über dem Minutenlimit: Ablehnung mit Wartezeit | TEST-F08-1 | Unit |

### F-10 Agenten-Studio
| ID | Kriterium | Test | Ebene |
|---|---|---|---|
| AK-F10-1 | Ohne eigenen Key nur Katalog-Modelle | TEST-F10-1 | Integration |
| AK-F10-2 | Aktive Agenten höchstens laut Tarif; inaktive dürfen angelegt werden | TEST-F10-2 | Integration |

### F-12 Tarife & Zahlung
| ID | Kriterium | Test | Ebene |
|---|---|---|---|
| AK-F12-1 | Demo (lokal): Tarifwechsel setzt Limits; Downgrade entfernt BYOK | TEST-F12-1 | Integration |
| AK-F12-2 | Gültiges Stripe-Abo-Update setzt den Tarif serverseitig | TEST-F12-2 | Integration (`tests/webhook.test.ts`) |
| AK-F12-3 | Kündigung → Starter; Event nur einmal verarbeitet | TEST-F12-3 | Integration |

### F-13 BYOK
| ID | Kriterium | Test | Ebene |
|---|---|---|---|
| AK-F13-1 | Key wird nur verschlüsselt gespeichert | TEST-F13-1 | Unit (`tests/crypto.test.ts`) |
| AK-F13-2 | Nur im Workspace-Tarif; Antwort enthält nie den Klartext | TEST-F13-2 | Integration |

### F-15 Datenexport
| ID | Kriterium | Test | Ebene |
|---|---|---|---|
| AK-F15-1 | Export als Datei mit allen eigenen Räumen, Agenten, Nachrichten, ohne Key | TEST-F15-1 | Integration |

### F-16 Konto löschen
| ID | Kriterium | Test | Ebene |
|---|---|---|---|
| AK-F16-1 | Nach dem Löschen sind keine Daten des Nutzers mehr vorhanden | TEST-F16-1 | Integration + DB (T-SEC-22) |

### F-17 Passwort-Reset
| ID | Kriterium | Test | Ebene |
|---|---|---|---|
| AK-F17-1 | Gleiche Antwort für jede Adresse; Versand pro Konto begrenzt; Link führt auf „Neues Passwort“ | TEST-F17-1 | Integration |
| AK-F17-2 | Neues Passwort beendet alle anderen Sitzungen | TEST-F17-2 | Integration |

### F-18 Rechtstexte & KI-Transparenz
| ID | Kriterium | Test | Ebene |
|---|---|---|---|
| AK-F18-1 | Produktion startet nicht ohne Betreiberangaben | TEST-F18-1 | Unit (`tests/config.test.ts`) |
| AK-F18-2 | Impressum zeigt Angaben oder deutlichen Hinweis | TEST-F18-2 | Unit + manuell |

## Rückverfolgungsmatrix

| Funktion | Priorität | Kriterien | Tests | Aufgaben (Phase 21) |
|---|---|---|---|---|
| F-01 | Muss | AK-F01-1 … AK-F01-4 | TEST-F01-1 … TEST-F01-4, T-SEC-23, T-SEC-24, T-SEC-26 | TASK-008, TASK-009 |
| F-02 | Muss | AK-F02-1, AK-F02-2 | TEST-F02-1, TEST-F02-2 | TASK-003 |
| F-03 | Muss | AK-F03-1, AK-F03-2 | TEST-F03-1, TEST-F03-2, T-SEC-02 | TASK-002 |
| F-04 | Muss | AK-F04-1 … AK-F04-4 | TEST-F04-1 … TEST-F04-4 | TASK-003 |
| F-05 | Muss | AK-F05-1 … AK-F05-3 | TEST-F05-1 … TEST-F05-3, T-SEC-08 | TASK-003 |
| F-06 | Muss | AK-F06-1, AK-F06-2 | TEST-F06-1, TEST-F06-2 | TASK-003 |
| F-07 | Muss | AK-F07-1 | TEST-F07-1, T-SEC-04, T-SEC-05 | TASK-002, TASK-003, TASK-004 |
| F-08 | Muss | AK-F08-1 | TEST-F08-1, T-SEC-06, T-SEC-07 | TASK-005 |
| F-10 | Muss | AK-F10-1, AK-F10-2 | TEST-F10-1, TEST-F10-2, T-SEC-03 | TASK-003 |
| F-12 | Muss | AK-F12-1 … AK-F12-3 | TEST-F12-1 … TEST-F12-3, T-SEC-25, T-SEC-27 | TASK-012 |
| F-13 | Muss | AK-F13-1, AK-F13-2 | TEST-F13-1, TEST-F13-2, T-SEC-10 | TASK-004 |
| F-15 | Muss | AK-F15-1 | TEST-F15-1 | TASK-010 |
| F-16 | Muss | AK-F16-1 | TEST-F16-1, T-SEC-22 | TASK-010 |
| F-17 | Muss | AK-F17-1, AK-F17-2 | TEST-F17-1, TEST-F17-2 | TASK-009 |
| F-18 | Muss | AK-F18-1, AK-F18-2 | TEST-F18-1, TEST-F18-2 | TASK-011 |

## Teststrategie

| Ebene | Werkzeug | Was | Wann |
|---|---|---|---|
| Unit | Vitest | Kontext, Kontingent, Rate-Limit, Krypto, Header, Tarife, Konfiguration | jeder Push (CI) |
| Integration | Vitest + In-Memory-Store + Demo-Modell; Supabase/Stripe per Mock | Orchestrierung, Route-Handler, Middleware, Auth, Webhook | jeder Push (CI) |
| Datenbank | PostgreSQL 16 + Supabase-Stub (`scripts/test-rls.sh`) | RLS, Grants, Funktionen, Kaskade | jeder Push (CI, Service-Container) |
| Browser | Playwright (`scripts/smoke-browser.cjs`, manuell gestartet) | Chat-Fluss, Mobil-Layout, CSP ohne Konsolenfehler | vor Release |
| Lieferkette | `npm audit`, gitleaks, Dependabot | Schwachstellen, Geheimnisse | jeder Push / wöchentlich |
| Barrierefreiheit | Tastatur-Test + Lighthouse | Fokus, Beschriftungen, Kontrast | vor Release (TASK-020) |

## Pflicht-Sicherheitstests

| ID | Test | Erwartung | Sichert ab |
|---|---|---|---|
| T-SEC-01 | `config.test.ts`, `usage-guard.test.ts` | Produktion ohne Supabase startet nicht; Demo ohne Plattform-Key | BD-06 |
| T-SEC-02 | `orchestrator.test.ts` | Abbruch bucht Verbrauch | BD-04 |
| T-SEC-03 | `orchestrator.test.ts`, `api.test.ts`, `plans.test.ts` | Katalog-Allowlist | BD-05 |
| T-SEC-04 | `usage-guard.test.ts` | Leerzeichen-/Fremdtarif-Key ohne Wirkung | BD-03 |
| T-SEC-05 | `orchestrator.test.ts`, `usage-guard.test.ts` | Vorab-Schätzung gegen Rest | BD-04 |
| T-SEC-06 | `api.test.ts`, `usage-guard.test.ts` | 429 + Retry-After | BD-09 |
| T-SEC-07 | `api.test.ts`, `usage-guard.test.ts` | 409 bei paralleler Runde | BD-04 |
| T-SEC-08 | `context-builder.test.ts` | Kontext-Budget | BD-04 |
| T-SEC-09 | `orchestrator.test.ts` | Tarifgrenzen trotz manipulierter Raumwerte | BD-05 |
| T-SEC-10 | `crypto.test.ts` | Verschlüsselung + Manipulationserkennung | BD-13 |
| T-SEC-11 | `middleware.test.ts`, `security-headers.test.ts` | CSP/Nonce + Header | BD-11 |
| T-SEC-12 | `middleware.test.ts`, `security-headers.test.ts` | Origin-Prüfung | BD-10 |
| T-SEC-13 | `api.test.ts` | 404-Strategie | BD-01 |
| T-SEC-14 | `api.test.ts` | Mass Assignment → 400 | BD-02 |
| T-SEC-15 | `middleware.test.ts` | 413 | BD-09 |
| T-SEC-16 | `rls.test.sql` | nur eigene Daten sichtbar | BD-01 |
| T-SEC-17 | `rls.test.sql` | fremde Daten nicht änderbar | BD-02 |
| T-SEC-18 | `rls.test.sql` | nichts in fremden Räumen anlegbar | BD-02 |
| T-SEC-19 | `rls.test.sql` | Abrechnungsdaten schreibgeschützt, Key nicht lesbar | BD-03, BD-13 |
| T-SEC-20 | `rls.test.sql` | Funktionen nur service_role | BD-03 |
| T-SEC-21 | `rls.test.sql` | Längengrenzen in der DB | BD-04 |
| T-SEC-22 | `rls.test.sql` | Kaskadenlöschung | BD-02 |
| T-SEC-23 | `auth.test.ts` | keine Enumeration | BD-08 |
| T-SEC-24 | `auth.test.ts` | Fehlversuchs-Sperre | BD-07 |
| T-SEC-25 | `webhook.test.ts` | Signatur + Idempotenz | BD-12 |
| T-SEC-26 | `misc-security.test.ts` | Cookie-Optionen (prüft die zentrale Konstante, die alle Supabase-Cookies setzt – kein echter Set-Cookie-Header, siehe Release-Checkliste) | BD-11 |
| T-SEC-27 | `misc-security.test.ts` | kein Gratis-Tarifwechsel in Produktion | BD-12 |
| T-SEC-28 | `misc-security.test.ts` | Markdown ohne Bilder/HTML | BD-11 |
| T-SEC-29 | `misc-security.test.ts` | Logs ohne Request-Body | BD-14 |
| T-SEC-30 | `webhook.test.ts` | Live-Zustand, veraltete/fremde Abo-Events ohne Wirkung | BD-12 |
| T-SEC-31 | `auth.test.ts` | Passwortänderung nur mit frischer Anmeldung dieser Sitzung | BD-07 |
| T-SEC-32 | `misc-security.test.ts` | Demo-Bestand je Besucher, kein Zugriff ohne Cookie | BD-06 |
| T-SEC-33 | `misc-security.test.ts` | Browser-Profil ohne Key/Stripe-IDs | BD-13 |
| T-SEC-34 | `supabase-store.test.ts` | Service-Role nur nach Besitzprüfung, nur eigene ID | BD-03 |

**Gegenprobe** (2026-10-29): Abbruchbuchung entfernt → T-SEC-02 rot; BYOK-Prüfung gelockert → T-SEC-04 rot (2 Tests); Origin-Prüfung entfernt → T-SEC-12 rot (2 Tests); `GRANT ALL ON messages` → T-SEC-19 rot. Nach Rücknahme alle grün.

## Manuelle Release-Checkliste
- [ ] Registrieren (neue Adresse), Bestätigungsmail öffnen, anmelden
- [ ] „Passwort vergessen“ → Mail → neues Passwort → anderes Gerät ist abgemeldet
- [ ] Debatte im Moderator-Modus: 3 Antworten, Moderator-Hinweise, Token-Chips
- [ ] Während einer Antwort „Stopp“ → Teilantwort mit „(abgebrochen)“, Verbrauch im Dashboard gestiegen
- [ ] @Claude-Mention und „Lass Gemini antworten“
- [ ] Handy-Breite: Menü und Panel öffnen/schließen, Nachricht senden
- [ ] Tarif-Seite: Checkout (Stripe-Testmodus) → Tarif nach Webhook aktiv; Abo im Portal kündigen → Starter
- [ ] Export herunterladen und Inhalt prüfen; Konto löschen (mit Passwortbestätigung) → Login-Seite
- [ ] Impressum/Datenschutz mit echten Betreiberangaben
- [ ] Browser-Konsole: keine CSP-Fehler
- [ ] DevTools → Application → Cookies: `sb-…`-Cookies sind HttpOnly, Secure, SameSite=Lax (T-SEC-26 am echten Header)

## Beta-Test
5–10 Testnutzer im Stripe-Testmodus, 2 Wochen, Fokus: Kosten pro Nutzer (Ledger), Verständlichkeit der Limits [ANNAHME A-012].

## Definition of Done (pro Aufgabe)
- Akzeptanzkriterien erfüllt, zugehörige TEST-/T-SEC-Tests grün (`npm test`, `npm run test:rls`)
- Typecheck und Build grün, keine Konsolenfehler
- Bei Nutzerdaten: Test „anderer Nutzer hat keinen Zugriff“
- `docs/idea-to-app/21-roadmap.md` und betroffene Dokumente aktualisiert
