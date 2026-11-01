# Produkt

Multimodell-Chat: KI-Gruppendebatten mit ChatGPT, Claude, Gemini u. a. als SaaS (Starter 0 €, Pro 29 €, Workspace/BYOK 79 €). Zielgruppe: Gründer, Produkt- und Technik-Teams.


> Bestehende App: F-01 bis F-14 rekonstruiert aus B1, F-15 bis F-18 neu (Pflichtfunktionen für die Veröffentlichung, B2).
> 🔒 = Funktion teilt, versendet oder kostet Geld → im Bedrohungsmodell (Phase 14) berücksichtigt.

| ID | Funktion | Priorität | Status | 🔒 | Bezug |
|---|---|---|---|---|---|
| F-01 | Registrierung, Anmeldung, Abmeldung (E-Mail + Passwort, Supabase Auth, serverseitig) | Muss | umgesetzt | 🔒 | BF-13, BF-26 |
| F-02 | Debatten-Räume anlegen, umbenennen, löschen (Tarifgrenze Räume) | Muss | umgesetzt | | BF-28 |
| F-03 | Gruppenchat mit Streaming mehrerer KI-Agenten | Muss | umgesetzt | 🔒 | BF-03, BF-04 |
| F-04 | Orchestrierung: KI-Moderator, Round-Robin, Manuell/@Mentions, Schnell-Buttons | Muss | umgesetzt | 🔒 | BF-25 |
| F-05 | Kontext-Formatter (Perspektiven-Umkehr, Sliding Window, Kontext-Budget) | Muss | umgesetzt | | BF-03 |
| F-06 | Langzeitgedächtnis (Running Summary, ab Pro) | Muss | umgesetzt | 🔒 | BF-29 |
| F-07 | Token-Ledger, Kostenschätzung, Monatskontingent | Muss | umgesetzt | 🔒 | BF-02, BF-03, BF-04, BF-24 |
| F-08 | Rate-Limits je Tarif (Agenten-Antworten/Minute, Runden, IP) | Muss | umgesetzt | 🔒 | BF-06, BF-25 |
| F-09 | Prompt-Hinweisfilter (Muster-Erkennung, keine Sicherheitsgrenze) | Kann | umgesetzt | | BF-32 |
| F-10 | Agenten-Studio (Rolle, Modell aus Katalog, System-Prompt, aktiv, hinzufügen/entfernen) | Muss | umgesetzt | 🔒 | BF-02, BF-28 |
| F-11 | API-Prompt-Inspector | Soll | umgesetzt | | – |
| F-12 | Tarife: Checkout, Webhook, Kundenportal, Verbrauchs-Dashboard | Muss | umgesetzt | 🔒 | BF-27 |
| F-13 | Eigene Zugänge (OpenRouter per OAuth, weitere Anbieter-Keys; verschlüsselt; in jedem Tarif) | Muss | umgesetzt | 🔒 | BF-08, BF-24 |
| F-14 | Demo-Workspace (lokal, simuliertes Modell) | Kann | umgesetzt | | BF-01 |
| F-15 | Datenexport der eigenen Daten (JSON) | Muss | umgesetzt | 🔒 | BF-16 |
| F-16 | Konto endgültig löschen (inkl. Abo-Kündigung) | Muss | umgesetzt | 🔒 | BF-16 |
| F-17 | Passwort vergessen / neues Passwort | Muss | umgesetzt | 🔒 | BF-13 |
| F-18 | Impressum, Datenschutzerklärung, KI-Transparenzhinweis | Muss | umgesetzt | | BF-16, BF-17 |
| F-19 | Zustimmung/Widerspruch: jede KI-Antwort auf eine andere KI wird bewertet (stimmt zu, widerspricht, baut weiter, neutral), als Chip an der Nachricht und im Konsens-Panel | Soll | umgesetzt | 🔒 | – |
| F-20 | Lokaler Abo-Modus: Modelle `abo/*` über Claude Code, Codex, Gemini CLI, Kimi CLI auf dem eigenen Rechner (nur Entwicklung, ohne Supabase) | Kann | umgesetzt | 🔒 | – |
| F-21 | Entscheidungsbericht: aus einer Debatte entsteht ein bewerteter Bericht (Optionen mit Wertung jeder KI, Einigkeit, Widerspruch, stärkster Einwand, Bedingungen, nächste Schritte, günstigster Test, Abbruchkriterien) – Zahlen rechnet die App aus den Wertungen; Link zum Teilen (widerrufbar, nur Hash gespeichert) und Druck/PDF; Entscheidungsvorlagen für den Start | Muss | umgesetzt | 🔒 | – |

## Nicht im Umfang (Parkplatz)
- Router-Begründungen dauerhaft speichern (BF-19)
- Zwei-Faktor-Anmeldung (E-004)
- Geteilte Räume / Teams mit mehreren Personen
- Kontingent in Euro statt Tokens (E-006)
