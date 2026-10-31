# Design-System „Tron-Glas“

Ein großer Glasrahmen schwebt vor einer Tron-Gitterlandschaft. Alle Flächen (Rahmen, Karten, Nachrichten, Eingabe, Leisten) sind Milchglas mit Lichtkante und Eckklammern. Die Farbe kommt von den KIs: ChatGPT cyan, Claude bernstein, Gemini mint, andere Modelle limettengrün. Der Akzent der Oberfläche ist neutral und gehört keiner KI.

## Farbwelten (`app/globals.css`)

| Name | Wann | Grund | Akzent |
|---|---|---|---|
| **Eis hell** | Standard bei heller Systemeinstellung (`data-theme="light"`) | Weißglas auf `#d9e6ee` | dunkles Schiefer `#26465a` |
| **Eis** | Standard bei dunkler Systemeinstellung (`data-theme="eis"`) | Tiefblau-Dunkel `#0a1118` | Eisweiß `#dff3ff` |
| **Zinn** | per Auswahl (`data-theme="zinn"`) | Anthrazit `#0a0c0e` | Silber `#e0e8f0` |

- Die Farben sind Tokens (`--color-*`, `--glass-*`, `--tron-*`) und als Tailwind-Klassen nutzbar (`text-openai`, `bg-surface`, …).
- Kein reines Schwarz. Die dunklen Leuchtfarben sind bewusst kräftig (Entscheidung des Projektinhabers, hebt die frühere Vorgabe „keine übersättigten Farben, kein Blau“ auf).
- Kontrast: jede Text-Paarung ist je Farbwelt gerechnet (Text mindestens 4,5:1, Haupttext 7:1). `scripts/a11y-check.cjs` prüft zusätzlich im Browser.

## Umschalten

- Ohne Wahl folgt die App der Systemeinstellung (`prefers-color-scheme`).
- `components/ui/ThemeToggle.tsx`: Wie System / Eis hell / Eis / Zinn, gespeichert in `localStorage` (`mm-theme`). Ein früher gespeicherter Wert `dark` gilt als Eis.
- `components/ui/EffectsToggle.tsx`: Bewegung nur bei Antwort (Standard) / immer / keine, gespeichert unter `mm-effects` (`lib/effects.ts`). „Bewegung reduzieren“ des Systems gilt zusätzlich.
- Ein kleines Inline-Skript mit CSP-Nonce (`lib/theme.ts`, `lib/effects.ts`) setzt beides vor dem ersten Zeichnen.

## Hintergrund und Glas

- `components/shell/TronBackdrop.tsx` zeichnet Horizont, Gitterboden und Lichtspuren in den KI-Farben (Canvas, höchstens ~30 Bilder/s). Bewegung standardmäßig nur, solange KIs antworten, sonst Standbild.
- Glas-Bausteine: `glass`, `glass-strong`, `frame`, `card`, `glass-bar` (`app/globals.css`). Rahmen und Karten haben abgeschrägte Ecken (oben links, unten rechts) mit nachgezogener Leuchtlinie und HUD-Eckklammern.
- Antworten KIs, kreist eine Lichtspur um den Rahmen (`data-live`), und der Composer pulsiert. Neue Nachrichten werden eingeblendet (`.scan-in`).
- Schrift: Orbitron (lokal über `@fontsource/orbitron`) für Überschriften und Knöpfe, Geist für Text, Geist Mono für HUD-Zeilen. Mindestgröße 11 px.

## Aufbau

- Links schwebt eine runde Icon-Leiste (Debatten, neue Debatte, Tarif, Farbwelt, Bewegung).
- Im Rahmen liegen nebeneinander: Seitenleiste (Debatten, Verbrauch), **Leiste links vom Chat** (ab 1280 px, einklappbar), der Chat und das Steuerungs-Panel (öffnet ab 1680 px von selbst).
- Leiste links vom Chat (`components/chat/HudRail.tsx`): *Denkfeld* (kleines Partikelfeld; ruhend grau, denkend flimmernd, antwortend im Takt des Textes, je Anbieter eigene Wellenform), *Konsens* (je KI-Paar der jüngste Bezug: Einig, Streit, Weiter, Offen), *Stimmen* (Zustand und Tokens; im Modus Manuell antwortet ein Klick direkt), *Verlauf* (standardmäßig zu, mit Legende: letzte 20 Beiträge, außerhalb des Kontextfensters gedimmt, plus Redeanteil).
- Auf dem Handy ersetzen Schubladen die Leisten; geschlossene Schubladen sind unsichtbar (nicht per Tab erreichbar), Escape schließt sie.

## Bewertung Zustimmung/Widerspruch (F-19)

Nach jeder KI-Antwort, die auf eine andere KI folgt, wird bewertet, ob sie zustimmt, widerspricht, weiterführt oder neutral bleibt (`lib/stance.ts`; mit Zugang per Router-Modell, sonst per Schlüsselwörtern). Die Bewertung steht als Chip an der Nachricht („widerspricht ChatGPT“) und im Konsens-Panel. Der Moderator wählt nach einem Widerspruch eine dritte KI. Gespeichert wird nur serverseitig (Migration `0006_stance.sql`).

## Referenzen

- „Glassy Dashboard“ (code.xr, vom Projektinhaber geschickt): Rahmen, Icon-Leiste, Kennzahl-Pillen.
- HUD-Bilder des Projektinhabers (Tron, Tron Legacy): Aufbau mit Chat in der Mitte, Informationsleisten, Partikelfeld.
- Mobbin: Leonardo AI (schmale Icon-Leiste), Sentry (Icon-Leiste plus Liste), hilos (Kennzahlen-Kacheln, Agentenliste, schwebender Composer), Origin (Kennzahlen mit Mono-Labels).
- Frühere Entwürfe und Mockups liegen unter `docs/mockups/`, `docs/varianten/` und `docs/hintergruende/`; sie zeigen ältere Stände und gelten nicht mehr.
