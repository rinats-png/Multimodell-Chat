# Projektstatus: Multimodell-Chat

> Gedächtnis des Projekts (idea-to-app, Modus „Bestehende App“).

| Feld | Wert |
|---|---|
| Slug | `multimodell-chat` |
| Erstellt | 2026-10-29 |
| Zuletzt aktualisiert | 2026-10-30 |
| Einstieg | Bestehende App |
| Erfahrung | Entwickler |
| Arbeitsweise | Adaptiv |
| Umfang | Voll |
| Plattform | Web-App (Next.js 15, Vercel) |
| Risikostufe | 2 – Konten, E-Mail, eigene Chat-Inhalte, Zahlung nur über Stripe (E-002) |
| Sprache | Deutsch |
| Regelwerk-Version | 1.2.0 |

## Aktueller Stand
- **Aktuelle Phase:** 22 – Build-Handoff (Übergabepaket in `handoff/`)
- **Nächster Schritt:** offene Aufgaben TASK-018 … TASK-023 (Deployment, Dashboards, AGB, Launch-Freigabe)
- **Fortschritt:** ▓▓▓▓▓▓▓▓▓░ B0–B2 + 11 Phasen erledigt bzw. übersprungen; offen: 23, 24

## Fortschritt

| Nr | Phase | Status | Datei |
|---|---|---|---|
| B0 | Ziel & Zugang | fertig | B0-ziel.md |
| B1 | Ist-Analyse | fertig | B1-ist-analyse.md |
| B2 | Soll & Lücken | fertig | B2-soll-und-luecken.md |
| 0 | Start & Einstellungen | fertig (in B0) | B0-ziel.md |
| 1 | Idee & Problem | übersprungen (B2) | – |
| 2 | Idee validieren | übersprungen (B2) | – |
| 3 | Zielgruppe | übersprungen (B2) | – |
| 4 | Markt & Wettbewerb | übersprungen (B2) | – |
| 5 | MVP-Umfang | fertig | 05-mvp.md |
| 6 | User-Flows | übersprungen (B2) | – |
| 7 | Screens & Navigation | übersprungen (B2) | – |
| 8 | Mockups | übersprungen (B2) | – |
| 9 | Design-System | übersprungen (B2) | – |
| 10 | Barrierefreiheit & Sprachen | übersprungen (B2; Prüfung als TASK-020) | – |
| 11 | Daten & Inhalte | fertig | 11-daten.md |
| 12 | Rollen & Berechtigungen | fertig | 12-berechtigungen.md |
| 13 | Tech-Stack & Architektur | übersprungen (B2; Ist in B1) | – |
| 14 | Sicherheitsarchitektur | fertig | 14-sicherheit.md |
| 15 | Login, Zahlung, Integrationen | übersprungen (B2; in 14/17 abgedeckt) | – |
| 16 | Recht & Datenschutz | fertig | 16-recht.md |
| 17 | Monetarisierung & Kosten | fertig | 17-kosten.md |
| 18 | Performance, Offline, Benachrichtigungen | übersprungen (B2) | – |
| 19 | Qualität & Tests | fertig | 19-tests.md |
| 20 | Betrieb | fertig | 20-betrieb.md |
| 21 | Roadmap & Aufgaben | fertig | 21-roadmap.md |
| 22 | Build-Handoff | fertig | handoff/AGENTS.md |
| 23 | Launch & Freigabe | offen | 23-launch.md |
| 24 | Iteration & Wartung | offen | 24-iteration.md |

## Kernentscheidungen (Kurzfassung – Details in ENTSCHEIDUNGEN.md)
- E-002 Risikostufe 2 · E-006 Kontingent in Tokens + Modell-Allowlist · E-009 Abrechnung nur serverseitig (Service-Role) · E-010 Stripe · E-011 Passwort 15, Auth serverseitig
- Akzeptierte Risiken: E-004 (kein 2FA), E-005 (Restschwachstellen Abhängigkeiten), E-007 (CSP style), E-008 (Prompt-Injection gegen eigene Agenten)

## Annahmen

| ID | Annahme | Phase | Bestätigt |
|---|---|---|---|
| A-001 | Die App läuft noch nicht live mit echten Nutzern | B0 | nein |
| A-002 | Gates gelten durch den Auftrag als freigegeben; adaptive Arbeitsweise | B0 | nein |
| A-003 | Hosting auf Vercel | B1, 20 | nein |
| A-004 | Auch mittlere Befunde werden behoben („alle Fehler und Probleme“) | B2 | nein |
| A-005 | `billing_events` werden nach 90 Tagen gelöscht | 11, 16 | nein |
| A-006 | Sicherheitslogs: Aufbewahrung 30 Tage über Hosting-Logs | 11 | nein |
| A-007 | Abrechnungsmonat nach UTC | 11 | nein |
| A-008 | Supabase- und Upstash-Region EU (Frankfurt) | 11, 20 | nein |
| A-009 | Credit-Limit und Alarme im OpenRouter-Konto werden gesetzt | 14, 17, 20 | nein |
| A-010 | Betreiber ist geschäftlich mit Sitz in Deutschland | 16 | nein |
| A-011 | Angezeigte Preise sind Endpreise inkl. MwSt. | 16 | nein |
| A-012 | Beta-Test mit 5–10 Nutzern im Stripe-Testmodus | 19 | nein |
| A-013 | RPO 24 h / RTO 4 h reichen | 20 | nein |
| A-014 | Support per E-Mail, Störungshinweis auf der Login-Seite | 20 | nein |
| A-015 | Supabase-Dashboard wird wie in `14-sicherheit.md` eingestellt (Confirm email, Länge 15, Leaked-Password-Schutz, OTP 1800 s, Time-box 90 Tage, Redirect-Allowlist, Auth-Rate-Limits) | 14 | nein |

## Offene Fragen
- Wer ist Betreiber (Name, Anschrift, E-Mail für Impressum)?
- AGB/Widerruf: wer liefert die Texte (TASK-019)?
- Sollen 2FA (E-004) und geteilte Team-Räume in die nächste Ausbaustufe?

## Parkplatz (Ideen für später)
- Router-Begründungen dauerhaft speichern (BF-19)
- 2FA per TOTP (Supabase MFA)
- Paginierung langer Nachrichtenverläufe
- CAPTCHA bei Registrierungs-Missbrauch
- Kontingent in Euro statt Tokens
