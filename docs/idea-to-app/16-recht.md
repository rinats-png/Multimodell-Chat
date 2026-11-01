# Recht & Datenschutz (verkürzt, bestehende App)

> Keine Rechtsberatung. Alle Punkte mit **[PRÜFEN]** vor dem Launch mit einer Fachperson klären.

## Einordnung

| Punkt | Festlegung |
|---|---|
| Betreiber | unbekannt – privat oder geschäftlich? [ANNAHME A-010: geschäftlich, Sitz in Deutschland] |
| Zielgruppe | Erwachsene, B2C und B2B, EU |
| Daten | Konto (E-Mail), Chat-Inhalte (Freitext), Vertragsdaten; keine Art.-9-Daten vorgesehen |
| Tracking | keins; nur technisch notwendige Sitzungs-Cookies → kein Cookie-Banner nötig [PRÜFEN] |
| KI | Chatbot-Funktion mit mehreren Drittanbieter-Modellen |

## Checkliste

| ✓ | Punkt | Umsetzung |
|---|---|---|
| ☑ | Impressum (§ 5 DDG) [Q-002] | `/impressum`, Angaben aus `OPERATOR_*`; Produktion startet ohne sie nicht (TEST-F18-1) |
| ☑ | Datenschutzerklärung (Art. 13) [Q-001] | `/datenschutz`, abgeglichen mit `11-daten.md` [PRÜFEN Rechtsgrundlagen und Drittlandtransfer] |
| ☑ | Hinweis bei Registrierung | Pflicht-Haken: Datenschutzerklärung gelesen, Übermittlung an KI-Anbieter bekannt |
| ☑ | Konto löschen (Art. 17) | F-16, inkl. Abo-Kündigung, Kaskade (T-SEC-22) |
| ☑ | Datenexport (Art. 20) | F-15, JSON-Download |
| ☐ | AGB / Nutzungsbedingungen inkl. Widerrufsbelehrung für Abos | **fehlt** – Text durch Fachperson; Seite ergänzen (TASK-019) [PRÜFEN] |
| ☐ | Auftragsverarbeitungsverträge | mit Supabase, Vercel, Upstash, Stripe, OpenRouter abschließen (Dashboard/AGB der Anbieter) [PRÜFEN] |
| ☐ | Verzeichnis der Verarbeitungstätigkeiten | Entwurf unten, Betreiber vervollständigt |
| ☑ | Preisangaben | Preise als Endpreise in € angezeigt [ANNAHME A-011: inkl. MwSt.] [PRÜFEN] |

## Verzeichnis der Verarbeitungstätigkeiten (Entwurf)

| Verarbeitung | Zweck | Kategorien | Empfänger | Löschfrist |
|---|---|---|---|---|
| Konto | Vertragserfüllung | E-Mail, Anmeldezeiten | Supabase | Kontolöschung |
| Debatten & KI-Antworten | Kernleistung | Chat-Inhalte, Agenten-Konfiguration | Supabase, OpenRouter + Modellanbieter | durch Nutzer bzw. Kontolöschung |
| Abrechnung | Vertrag, Steuer | Tarif, Verbrauch, Stripe-IDs | Stripe | Kontolöschung; Rechnungen bei Stripe gesetzlich [PRÜFEN] |
| Missbrauchsschutz | berechtigtes Interesse | IP, Konto-ID, E-Mail-Hash | Upstash, Hosting-Logs | ≤ 1 h (Zähler), 30 Tage (Logs) |

## Dienstleister & AVV

| Dienst | Zweck | Sitz / Transfer | AVV |
|---|---|---|---|
| Supabase | DB, Auth | Region wählbar (EU empfohlen) | [PRÜFEN] |
| Vercel | Hosting | USA/EU, DPF/SCC | [PRÜFEN] |
| Upstash | Rate-Limits | Region wählbar | [PRÜFEN] |
| OpenRouter (+ OpenAI, Anthropic, Google …) | KI-Antworten | USA [Q-003] | [PRÜFEN] |
| Stripe | Zahlung | USA/EU [Q-004] | [PRÜFEN] |

## Löschkonzept (Kurzfassung)

- Nutzer löscht Raum → Agenten und Nachrichten per Kaskade.
- Nutzer leert Verlauf → Nachrichten und Gedächtnis des Raums.
- Konto löschen → `auth.users` → Kaskade auf alle Tabellen; Stripe-Abo gekündigt; Rate-Limit-Zähler laufen ≤ 1 h ab.
- Backups: Supabase-Backups enthalten gelöschte Daten bis zum Ablauf der Backup-Aufbewahrung (Plan-abhängig) [PRÜFEN, in Datenschutzerklärung nennen].
- `billing_events`: Löschung nach 90 Tagen [ANNAHME A-005] (TASK-018).

## Datenschutzerklärung & Impressum (Entwurf)
Umgesetzt als Seiten `app/datenschutz/page.tsx` und `app/impressum/page.tsx`.

## KI-Funktionen (nur falls vorhanden)

| KI-Funktion | Anbieter / Modell | Gesendete Daten | Rolle (Anbieter/Betreiber) [PRÜFEN] | Risikoklasse [PRÜFEN] | Kennzeichnung (Art. 50) | Training ausgeschlossen? |
|---|---|---|---|---|---|---|
| Agenten-Antworten | OpenRouter → GPT-4o, Claude 3.5 Sonnet, Gemini 2.5 Pro u. a. | Sliding Window, System-Prompts, Gedächtnis | Betreiber (deployer) | begrenztes Risiko (Chatbot) | Hinweis im leeren Chat, „KI“-Badge und `data-ai-generated` an jeder Antwort, Datenschutzerklärung | `data_collection: deny` [Q-003] |
| Moderator-Router | OpenRouter → Gemini 2.5 Flash | letzte 4 Nachrichten (gekürzt) | Betreiber | begrenztes Risiko | intern, Begründung sichtbar | ja (deny) |
| Langzeitgedächtnis | OpenRouter → GPT-4o mini | herausgefallene Nachrichten (gekürzt) | Betreiber | begrenztes Risiko | sichtbar im Panel | ja (deny) |

- Zeitplan: Art.-50-Transparenzpflichten gelten seit 2. August 2026 [Q-006] (neu prüfen vor Launch).
- Menschliche Kontrolle / Art. 22 DSGVO: keine automatisierten Entscheidungen mit Rechtswirkung.
- KI-Kompetenz (Art. 4): Betreiber dokumentiert, wer die Modelle konfiguriert [PRÜFEN].

## Nutzerinhalte, Moderation & Meldeverfahren (nur falls vorhanden)
Keine öffentlich geteilten Inhalte → kein Meldeverfahren nötig.

## Datenschutzbeauftragte(r) & Betroffenenanfragen
Anfragen an `OPERATOR_EMAIL`; Export und Löschung als Selbstbedienung. DSB-Pflicht abhängig von Betriebsgröße [PRÜFEN].

## DSFA-Schwellwertprüfung (bei Risikostufe 3 oder sensiblen Daten)
Nicht erforderlich bei Stufe 2 und Hinweis gegen sensible Eingaben [PRÜFEN].

## Quellen
Q-001, Q-002, Q-003, Q-004, Q-006

## Offene Punkte für Fachberatung
AGB/Widerruf, Rechtsgrundlagen, Drittlandtransfer, AVV-Abschluss, Backup-Fristen, DSB-Pflicht.
