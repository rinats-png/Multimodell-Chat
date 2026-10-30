# Design-System „Lounge & Glut“ mit Tron-Schicht

Ein großer Glasrahmen schwebt vor einer Tron-Szene. Darüber liegt eine Tron-Schicht aus Lichtkanten in Orange (statt Cyan), einem Lichtgitter im Rahmen, leuchtenden HUD-Eckklammern an Karten, Orbitron als HUD-Schrift und leuchtenden Avatar-Ringen. Der Aufbau bleibt unverändert; die Formen sind kantig (Radius 4–10 px statt 16–28 px), die Lichtkante des Rahmens wandert langsam (Animation `trail`, bei `prefers-reduced-motion` aus). Zehn Alternativen: `docs/varianten/`.

**Stufe 3:** Rahmen und Karten haben abgeschrägte Ecken (oben links, unten rechts) mit nachgezogener Leuchtlinie. Antworten die KIs, kreist eine helle Lichtspur um den Rahmen (`data-live`, conic-gradient mit `@property --trail-angle`) und der Composer pulsiert. Neue Nachrichten werden eingeblendet (`.scan-in`). Die Kopfzeile zeigt eine HUD-Statuszeile („Bereit // 3 Agenten // Moderator“). Alle Animationen entfallen bei `prefers-reduced-motion`. Links schwebt eine runde Icon-Leiste. Im Rahmen liegen Debatten, Chat und Steuerung nebeneinander, getrennt durch feine Linien statt einzelner Kacheln. Hinter den Inhalten glimmt orange Glut.

- **Hell: „Morgenlicht“** – Sand, Leinen, Terrakotta. Hintergrund: weißer Tron-Digitalraum mit orangen Lichtlinien (`public/bg/tron-light.webp`).
- **Dunkel: „Glut“** – warmes Anthrazit, Orange. Hintergrund: Tron-Gitterlandschaft mit Leuchtspuren (`public/bg/tron-dark.webp`).

Referenzen:
- „Glassy Dashboard“ (code.xr, vom Projektinhaber geschickt): Rahmen, Icon-Leiste mit orangem aktivem Kreis, Kennzahl-Pillen, oranges Glühen.
- Mobbin: Leonardo AI (schmale Icon-Leiste), Sentry (Icon-Leiste plus Liste), hilos (Kennzahlen-Kacheln, Agentenliste, schwebender Composer), Origin (Kennzahlen mit Mono-Labels).

Die Hintergrundbilder sind mit Higgscheap (Nano Banana Pro) gerendert, je 2048 px. Tron-Lichtlinien bewusst in Orange, weil Blau ausgeschlossen ist (wie Clu in *Tron: Legacy*).

**Tron-Schicht** (`app/globals.css`, Abschnitt „Tron-Schicht“): `--tron`, `--tron-soft`, `--tron-glow`, `--grid-tron` je Thema; `.frame::before` (Lichtkante), `.glow-field::after` (Lichtgitter), HUD-Ecken an `.frame .glass`, `.tron-edge` (Icon-Leiste, Composer), `.tron-ring` (Avatare), `.hud` (Mono-Statuszeile). `btn-primary` in Orbitron, Großbuchstaben, mit Leuchtkante. Schrift lokal über `@fontsource/orbitron`. Alternativen zum Tauschen liegen unter `docs/hintergruende/`: Kommandozentrale, Wüste mit Lichtgitter, Atrium. Zum Wechseln die Datei nach `public/bg/` kopieren und `--bg-image` in `app/globals.css` anpassen. Der Rahmen ist bewusst durchscheinend (`--frame-*`, Blur 16 px), die Karten im dunklen Thema dunkel getönt (`--card-*`), damit Text auch vor hellen Lichtbahnen lesbar bleibt.

## Vorgaben des Projektinhabers
- **Kein** Lila, Pink, Rosa, Blau oder Verwandtes; keine übersättigten Farben.
- **Kein** reines oder tiefes Schwarz. Die dunkelste Fläche ist `canvas-2` (#201e1c).

## Hell/Dunkel
- Ohne Wahl folgt die App der Systemeinstellung (`prefers-color-scheme`).
- Der Umschalter (Wie System · Hell · Dunkel) sitzt in der Icon-Leiste, auf dem Handy in der Seitenleiste (`components/ui/ThemeToggle.tsx`).
- Er setzt `<html data-theme>` und merkt sich die Wahl in `localStorage` (`mm-theme`).
- Ein kleines Inline-Skript mit CSP-Nonce (`lib/theme.ts`) setzt das Thema vor dem ersten Zeichnen.

## Aufbau
| Baustein | Datei | Hinweis |
|---|---|---|
| Icon-Leiste | `components/shell/IconRail.tsx` | ab `md`; der aktive Punkt ist ein oranger Kreis mit Glühen |
| Rahmen | Utility `frame` + `.glow-field` | umschließt Seitenleiste, Hauptbereich und Panel |
| Kennzahl-Pillen | `StatPills` in `ChatWorkspace.tsx` | Tokens, Kosten, Antworten der Debatte |
| Karten im Rahmen | Utility `card`; `.frame .glass` wird automatisch zur Karte | kein zweiter Blur |
| Schubladen (Mobil) | Klasse `drawer` + `max-md:glass-strong` | behalten den echten Glas-Blur |

## Farben (Tokens in `app/globals.css`, als Tailwind-Klassen nutzbar)

| Token | Hell | Dunkel | Verwendung |
|---|---|---|---|
| `canvas` / `canvas-2` | #ebe5dd / #f1ece5 | #252220 / #201e1c | Seitengrund unter dem Foto |
| `surface` … `surface-3` | #f7f3ee … #e8e0d6 | #2e2b28 … #403b37 | feste Flächen, Hover |
| `line` / `line-strong` | #d8cec2 / #c0b3a4 | #48423d / #5e5650 | Linien |
| `ink` / `ink-2` / `muted` | #2b2723 / #3e3833 / #5b5148 | #f4efea / #ddd5cd / #b3a89e | Text |
| `accent` / `accent-strong` / `accent-deep` | #b9581d / #873b0e / #d06f2c | #f08c4e / #f7b98f / #c9672e | Orange: Aktionen, Fokus, aktive Zustände |
| `on-accent` | #fffaf5 | #2a1307 | Text auf Orange |
| `signal` | #47733a | #a7cf8e | Status, „verbunden“ |
| `danger` / `warn` | #a8382a / #6b4c0e | #ef8a72 / #e8c77d | Fehler, Warnungen |
| `openai` / `anthropic` / `google` / `other` | #44622f / #7a4417 / #5c574d / #47733a | #abc994 / #eab98c / #d5cdbd / #a7cf8e | Agentenfarben (Salbei, Ocker, Stein, Moos) |

Glas, Rahmen, Karten und Glut haben pro Thema eigene Variablen (`--glass-*`, `--frame-*`, `--card-*`, `--glow-*`).

Kontrast: Alle Texte auf Chat, Tarif und Datenschutz werden automatisch gegen den tatsächlich gerenderten Hintergrund gemessen (Foto, Rahmen, Karte). Ziel ist WCAG AA (4,5:1, große Schrift 3:1).

## Typografie
- Geist Sans für Text und Überschriften (halbfett, enge Laufweite)
- Geist Mono für Zahlen, Labels und Code

## Regeln
- Orange nur für Interaktion, aktiven Zustand und Glut, nie als Fläche für Fließtext.
- Neue Farben nur als Token in `app/globals.css` (beide Themen), keine festen Hex- oder RGB-Werte in Komponenten.
- Bewegung sparsam (Streaming-Cursor, Live-Punkt); `prefers-reduced-motion` wird respektiert.
- Schriften und Bilder nur lokal (CSP `font-src 'self'`, `img-src 'self'`).

## Stufe 4: Tron-Glas mit Eis und Zinn

- **Farbwelten (dunkel):** *Eis* (Standard bei dunkler Systemeinstellung) und *Zinn*, beide kräftig leuchtend. Eis: Eisblau (ChatGPT), Bernstein (Claude), Weiß (Gemini) auf Tiefblau-Dunkel `#0a1118`. Zinn: Silber, Bernstein, Weiß auf Anthrazit `#0a0c0e`. Hell bleibt „Morgenlicht“. Die frühere Vorgabe „keine übersättigten Farben, kein Blau“ gilt für die dunklen Farbwelten nicht mehr (Entscheidung des Projektinhabers).
- **Umschalten:** `components/ui/ThemeToggle.tsx` (Wie System / Hell / Eis / Zinn), gespeichert unter `mm-theme`; der alte Wert `dark` wird als Eis gelesen.
- **Hintergrund:** `components/shell/TronBackdrop.tsx` zeichnet Horizont, Gitterboden und Lichtspuren in den KI-Farben; aktiv, wenn die Farbwelt `--backdrop-grid: 1` setzt. Bei „Bewegung reduzieren“ Standbild.
- **Glas überall:** Rahmen, Karten, Nachrichten, Eingabe und Leisten bleiben Glas; die Rahmen sind durchscheinender, damit das Gitter sichtbar ist.
- **Leiste links vom Chat** (`components/chat/HudRail.tsx`, ab 1280 px Breite): *Denkfeld* (`ThinkField.tsx`, kleines Partikelfeld; ruhend grau, denkend flimmernd, antwortend im Takt des Textes, je KI-Anbieter eigene Wellenform), *Stimmen* (Zustand, Tokens; im Modus Manuell antwortet ein Klick direkt), *Verlauf* (letzte 20 Beiträge, außerhalb des Kontextfensters gedimmt, plus Redeanteil). Es werden nur echte Werte gezeigt; „Konsens“ und „Streit“ aus dem Entwurf fehlen bewusst, weil es dafür noch keine Bewertung gibt.
- Das Steuerungs-Panel rechts öffnet erst ab 1680 px Breite von selbst.
