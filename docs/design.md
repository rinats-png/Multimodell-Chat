# Design-System „Bühne“ (Bento)

Ein Raster aus Milchglas-Kacheln vor weichen Farbflächen. Die drei KIs sind die Hauptfiguren: je eine große Kachel oben, darunter der Chat und eine Seitenspalte. Die Farbe kommt von den KIs, der Akzent der Oberfläche ist neutral (Tinte).

## Farbwelten (`app/globals.css`)

| Name | Wann | Grund | Akzent |
|---|---|---|---|
| **Hell** | Standard bei heller Systemeinstellung (`data-theme="light"`) | Sandfarben `#f1e8dc`, Farbflächen Pfirsich, Salbei, Butter | Tinte `#2c241b` |
| **Dunkel** | Standard bei dunkler Systemeinstellung (`data-theme="dark"`) | Warmes Anthrazit `#1b1816`, Farbflächen Honig, Moos, Umbra | Elfenbein `#f4eee6` |

- KI-Farben: ChatGPT teal, Claude orange, Gemini limette, andere Modelle sandbraun. Sie erscheinen in der KI-Kachel, am Avatar, am Namen und im Redeanteil.
- Die Farben sind Tokens (`--color-*`, `--glass-*`, `--b1…b3`) und als Tailwind-Klassen nutzbar (`text-openai`, `bg-surface`, …). Kein reines Schwarz.
- Kontrast: Jede Text-Paarung ist je Farbwelt gerechnet (Text mindestens 4,5:1, Haupttext 7:1). `scripts/a11y-check.cjs` prüft zusätzlich im Browser.
- Umschalten: `components/ui/ThemeToggle.tsx` (Wie System / Hell / Dunkel, gespeichert unter `mm-theme`). Ältere gespeicherte Werte `eis` und `zinn` gelten als Dunkel. Ein kleines Inline-Skript mit CSP-Nonce (`lib/theme.ts`) setzt die Wahl vor dem ersten Zeichnen.

## Glas und Schrift

- Bausteine: `glass`, `glass-strong`, `card`, `.tile` (Radius 26 px), `btn-primary` (Tinte, Pillenform), `btn-ghost`, `field` (`app/globals.css`).
- Hintergrund: drei weiche Farbflächen (`body::before`), keine Animation.
- Schrift: DM Sans für Text, DM Serif Display für Überschriften, KI-Namen und die Wortmarke (beide lokal über `@fontsource`, kein Google-Abruf). Die Serifenschrift hat nur einen Schnitt (`font-synthesis: none`). Mindestgröße 11 px.
- Wortmarke „SynthrAI“ (`components/ui/BrandMark.tsx`): „Synthr“ in DM Serif Display, „AI“ größer in DM Sans (800) im Verlauf der drei KI-Farben (`--brand-ai-1…3`, in Hell dunkler gewählt) mit Verlaufslinie darunter; in der Kopfzeile mit Zusatz „AI Discussion Room“, mobil nur das Symbol.
- Bewegung: nur ein sanftes Einblenden neuer Nachrichten und das Leuchten der KI-Kachel, solange diese denkt oder antwortet. Bei „Bewegung reduzieren“ des Systems entfällt alles.

## Aufbau (`components/chat/ChatWorkspace.tsx`)

1. **Kopf-Kachel** (`components/shell/AppHeader.tsx`): Marke, Bereiche (Debatten, Tarif & Verbrauch), Titel und Status der Debatte, Modus, Werkzeuge (API-Prompt, Verlauf leeren, Steuerung), Darstellung, Konto-Menü (E-Mail, Tarif, Rechtliches, Abmelden).
2. **KI-Kacheln** (`AgentTiles.tsx`): je KI Name, Zustand (bereit/denkt/spricht/aus), Tokens, letzte Aussage, Schalter „aktiv“; im Modus Manuell ein Knopf „Antworten lassen“. Auf dem Handy eine waagerechte Wischzeile, auf Laptops unter 800 px Höhe kompakter.
3. **Chat-Kachel** mit Verlauf und schwebender Eingabe.
4. **Seitenkachel** (`SideTile.tsx`): *Konsens* (je KI-Paar der jüngste Bezug: Einig, Streit, Weiter, Offen), *Verbrauch* (Anteil am Monatskontingent, Redeanteil, Kontextfenster), *Debatten* (Liste, neue Debatte, löschen).
5. **Schublade** für Steuerung und Agenten-Studio (`ControlPanel`, `AgentStudio`), geöffnet über das Symbol im Kopf.

Seiten außerhalb des Chats (Tarif & Verbrauch) nutzen dieselbe Kopf-Kachel und eine große Glas-Kachel (`components/shell/AppShell.tsx`). Auf dem Handy stapeln sich alle Kacheln; geschlossene Menüs sind nicht per Tab erreichbar, Escape schließt sie.

## Entscheidungsbericht (F-21)

Der Bericht ist das weitergebbare Ergebnis einer Debatte (`components/report/ReportView.tsx`): Urteil mit Wertung, Einigkeit und Streuung, die Optionen mit der Wertung jeder KI, Einigkeit und Streit, der stärkste Einwand, Bedingungen, nächste Schritte, günstigster Test, Abbruchkriterien. Dieselbe Ansicht dient dem Besitzer (`/report/[id]`) und der Link-Ansicht (`/r/[token]`). Druckansicht: weißer Grund, dunkle Schrift, ohne Navigation (`@media print`). Im Leerzustand der Debatte stehen sechs Entscheidungsvorlagen vor den Hinweisen.

## Ratssitzung (F-23)

Der Schalter „Ratssitzung“ im Eingabefeld (nach der Wahl eines Rats automatisch an) startet drei Runden: Eröffnung, Streit, Abstimmung. Der Moderator-Hinweis im Verlauf nennt die Runde („Runde 2 von 3: Streit“), das Eingabefeld zeigt den Fortschritt, „Stoppen“ beendet die Kette. Am Ende öffnet sich der Entscheidungsbericht.

## Bewertung Zustimmung/Widerspruch (F-19)

Nach jeder KI-Antwort, die auf eine andere KI folgt, wird bewertet, ob sie zustimmt, widerspricht, weiterführt oder neutral bleibt (`lib/stance.ts`; mit Zugang per Router-Modell, sonst per Schlüsselwörtern). Die Bewertung steht als Chip an der Nachricht („widerspricht ChatGPT“) und in der Seitenkachel. Der Moderator wählt nach einem Widerspruch eine dritte KI. Gespeichert wird nur serverseitig (Migration `0006_stance.sql`).

## Referenzen

- Mobbin: Microsoft Copilot (Kachel-Startseite, schwebende Eingabe), hilos (getönte Kennzahl-Kacheln), Perplexity (Eingabe als Glaskapsel), Tana (durchscheinende Flächen auf Farbverlauf).
- Entwurf „A4 · Bühne“ aus den Bento-Varianten des Projektinhabers. Frühere Entwürfe und Mockups unter `docs/mockups/`, `docs/varianten/` und `docs/hintergruende/` zeigen ältere Stände und gelten nicht mehr.
