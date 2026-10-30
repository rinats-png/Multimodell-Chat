# Entscheidungs-Log: Multimodell-Chat

| ID | Datum | Phase | Entscheidung | Begründung | Verworfene Alternativen | Folgen / Risiken | Betrifft |
|---|---|---|---|---|---|---|---|
| E-001 | 2026-10-29 | 0 / B0 | Modus „Bestehende App“, Arbeitsweise adaptiv, Gates durch den Auftrag („komplett bearbeiten, bis du zufrieden bist“) freigegeben | ausdrücklicher Auftrag ohne Zwischenrückfragen | geführt mit Gate je Phase | Annahmen A-… müssen nachträglich bestätigt werden | alle |
| E-002 | 2026-10-29 | B1 / 11 | Risikostufe 2 | Konten, E-Mail, eigene Inhalte, Zahlung nur über Stripe; keine Art.-9-Daten vorgesehen | Stufe 3 (Freitext könnte sensibel sein) | Hinweis gegen sensible Eingaben nötig; bei Vermarktung für Gesundheit/Recht neu bewerten | 12, 14, 16 |
| E-003 | 2026-10-29 | 12 | Keine Admin-Rolle in der App; Betreiberzugriff nur über Anbieter-Dashboards mit 2FA | kleinste Angriffsfläche | Admin-Bereich in der App | Support nur über Dashboards | 12, 14 |
| E-006 | 2026-10-29 | 17 | Kontingent bleibt in Tokens (Masterprompt), abgesichert durch Modell-Allowlist | Vorgabe des Projektinhabers; Allowlist begrenzt Kosten pro Token | Kontingent in Euro/Cent | neue teure Modelle nur nach Preisprüfung in den Katalog | 14, 17 |
| E-009 | 2026-10-29 | 14 | Abrechnungsrelevante Schreibzugriffe nur serverseitig mit Service-Role-Key | Clients konnten über die REST-API Ledger, Key und Gedächtnis manipulieren (BF-12, BF-24) | SECURITY-DEFINER-RPCs für Clients | Service-Role-Key ist zusätzlicher geheimer Schlüssel; jede Nutzung prüft vorher die Sitzung | 11, 12, 14 |
| E-010 | 2026-10-29 | 15 / 17 | Stripe als Zahlungsanbieter (`stripe`-SDK, Checkout + Portal + Webhook) | Masterprompt nennt Tarife, aber keinen Anbieter; Stripe ist Standard für SaaS-Abos | Paddle, LemonSqueezy (Merchant of Record) | neue Abhängigkeit (Regel 9.1); Steuerfragen beim Betreiber [PRÜFEN] | 16, 17 |
| E-011 | 2026-10-29 | 14 | Passwort-Mindestlänge 15, Auth vollständig serverseitig | ohne 2FA ist das Passwort der einzige Faktor; HttpOnly-Cookies nur ohne Browser-Client möglich | 12 Zeichen + 2FA | etwas höhere Hürde bei Registrierung | 14 |

## Bewusst akzeptierte Risiken

| ID | Datum | Bezug | Empfehlung | Warum nicht umgesetzt | Risiko | Neu bewerten bis |
|---|---|---|---|---|---|---|
| E-004 | 2026-10-29 | Standardwerte §5, Stufe 2 | 2FA für Nutzer anbieten | Umfang; Mindestlänge 15, Leaked-Password-Schutz und Fehlversuchs-Sperre als Ausgleich | Kontoübernahme bei wiederverwendetem Passwort | 2027-01-31 |
| E-005 | 2026-10-29 | BF-15, BD-15 | alle hohen `npm audit`-Befunde beheben | `postcss` in Next 15 (nur Build-Zeit) und `undici`/`@fastify/busboy` in `@ai-sdk/provider-utils` (Multipart-Parsing, nicht genutzt) nur per Major-Upgrade behebbar | gering, betroffene Pfade verarbeiten keine Fremddaten zur Laufzeit | 2026-12-31 |
| E-007 | 2026-10-29 | CSP | `style-src` ohne `unsafe-inline` | React-Style-Attribute; Skripte bleiben per Nonce geschützt | CSS-Injection mit geringer Wirkung | 2027-03-31 |
| E-012 | 2026-10-30 | Standardwerte §4 | Sitzung 24 h ohne „angemeldet bleiben“ | 30 Tage sind übliche SaaS-Erwartung; Ausgleich: HttpOnly, Höchstdauer 90 Tage, frische Anmeldung für sensible Aktionen | längeres Fenster bei gestohlenem Gerät | 2027-03-31 |
| E-013 | 2026-10-30 | Z14-01 | Modell-Allowlist/Tarifgrenzen auch in der DB | Laufzeit prüft vor jedem Aufruf; DB hat harte Obergrenzen (12 Agenten, 100 Räume, Längen) | über die REST-API gespeicherte Werte wirken nicht, belegen aber Speicher | 2027-03-31 |
| E-008 | 2026-10-29 | BD-16, BF-32 | Prompt-Injection wirksam verhindern | technisch nicht vollständig möglich; Agenten haben keine Werkzeuge, Kontext enthält nur eigene Daten | Agenten folgen eingefügten Anweisungen – betrifft nur den Nutzer selbst | 2027-03-31 |
