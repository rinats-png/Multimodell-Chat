# Soll & Lücken

## Ziel

Erst absichern und sanieren (alle kritischen und hohen Befunde), dann die Pflichtfunktionen für eine Veröffentlichung ergänzen: Konto löschen, Datenexport, Passwort-Reset, Rechtstexte, Bezahlstrecke. Der Projektinhaber hat „alle Fehler und Probleme beheben“ beauftragt. Deshalb werden auch mittlere Befunde behoben, wo das mit vertretbarem Aufwand geht [ANNAHME A-004].

## Ist → Soll

| Bereich | Ist (B1) | Soll | Bezug |
|---|---|---|---|
| Konfiguration | fällt offen (Demo ohne Login in Produktion) | fällt geschlossen; Demo nur lokal oder ausdrücklich, dann nie mit Plattform-Key | BF-01 |
| Kostenkontrolle | Kontingent umgehbar (Abbruch, Leerzeichen-Key, große Kontexte, teure Modelle, parallele Runden) | Verbrauch immer gebucht, Schätzung vorab, Kontext-Budget, Modell-Allowlist, eine Runde pro Konto | BF-02, BF-03, BF-04, BF-24 |
| Datenbankrechte | Clients schreiben Ledger, Gedächtnis, Profil, Keys | nur lesen bzw. eigene Inhalte; Abrechnung nur serverseitig (Service-Role) + Längen-CHECKs | BF-12, BF-24 |
| Rate-Limits | pro Instanz, nur Konto, kein 429 | Konto + IP, HTTP 429 + Retry-After, Upstash Pflicht, Auth-Limits | BF-06, BF-25 |
| Browser-Schutz | keine Header, keine Origin-Prüfung | CSP mit Nonce, HSTS u. a., Origin-Prüfung, Body-Limit | BF-07 |
| Sitzungen | Cookies lesbar für Skripte, 400 Tage | HttpOnly, Secure, SameSite=Lax, 30 Tage Inaktivität | BF-26 |
| Login | kein Reset, Länge 8, rohe Fehlermeldungen | Reset-Ablauf, Länge 15, einheitliche Antworten, Sperre nach Fehlversuchen | BF-13 |
| Datenschutz | kein Export, keine Löschung, keine Rechtstexte | Export (JSON), Löschung mit Kaskade, Impressum, Datenschutzerklärung, KI-Hinweis | BF-16, BF-17 |
| Bezahlung | Checkout ohne Zuordnung, kein Webhook | Stripe-Checkout mit Nutzer-ID, signierter idempotenter Webhook, Kundenportal | BF-27 |
| Qualität | keine Tests, keine CI | Unit-, Integrations-, Routen- und RLS-Tests; CI mit Audit und Secret-Scan | BF-09 |
| Oberfläche | unter 1280 px Funktionen unerreichbar | Schubladen für Navigation und Panel, Tastaturbedienung | BF-14 |

## Befunde: Entscheidung

| Befund | Schweregrad | Entscheidung | Bezug |
|---|---|---|---|
| BF-01 | kritisch | beheben | TASK-001 |
| BF-02 | hoch | beheben | TASK-003 |
| BF-03 | hoch | beheben | TASK-003 |
| BF-04 | kritisch | beheben | TASK-002 |
| BF-05 | mittel | beheben | TASK-003 |
| BF-06 | hoch | beheben | TASK-005 |
| BF-07 | hoch | beheben | TASK-006 |
| BF-08 | mittel | beheben | TASK-004 |
| BF-09 | hoch | beheben | TASK-015, TASK-016 |
| BF-10 | mittel | beheben | TASK-007 |
| BF-11 | mittel | beheben | TASK-007 |
| BF-12 | hoch | beheben | TASK-004 |
| BF-13 | mittel | beheben | TASK-009 |
| BF-14 | mittel | beheben | TASK-013 |
| BF-15 | hoch | teilweise beheben (zod), Rest akzeptiert | TASK-017, E-005 |
| BF-16 | hoch | beheben | TASK-010, TASK-011 |
| BF-17 | mittel | beheben | TASK-011 |
| BF-18 | niedrig | beheben | TASK-005 |
| BF-19 | niedrig | später | Parkplatz |
| BF-20 | mittel | Konzept (Phase 20), Umsetzung beim Deployment | TASK-018 |
| BF-21 | niedrig | beheben | TASK-003 |
| BF-22 | niedrig | beheben | TASK-004 |
| BF-23 | mittel | beheben | TASK-007 |
| BF-24 | kritisch | beheben | TASK-004 |
| BF-25 | hoch | beheben | TASK-005 |
| BF-26 | mittel | beheben | TASK-008 |
| BF-27 | mittel | beheben | TASK-012 |
| BF-28 | mittel | beheben | TASK-003 |
| BF-29 | mittel | beheben | TASK-003 |
| BF-30 | mittel | beheben | TASK-007 |
| BF-31 | niedrig | beheben | TASK-006 |
| BF-32 | niedrig | beheben (als Hinweisfunktion eingestuft) | TASK-007 |

## Ablauf

Phasen: 5 (Funktionsliste aus B1 + neue Pflichtfunktionen), 11, 12, 14, 16 (verkürzt), 17 (verkürzt, nur Kosten und Limits), 19, 20, 21, 22.
Übersprungen (B2): 1–4, 6–10, 13, 15, 18, 23, 24. Das Produkt, die Flows und das Design existieren und werden nicht neu geplant. Architektur und Integrationen sind in `14-sicherheit.md`, `17-kosten.md` und `20-betrieb.md` mit abgedeckt. Phase 23 (Launch) folgt erst mit einem echten Deployment.

Begründung: Ziel „Absichern + Pflichtfunktionen“ laut Tabelle in `modes/bestehende-app.md`, ergänzt um 5 und 17. Neue Funktionen kommen dazu, und die Kosten sind bei einer KI-SaaS der Kern des Missbrauchsrisikos.
