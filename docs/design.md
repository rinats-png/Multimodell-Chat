# Design-System „Tiefsee & Gletscher“

Futuristische Glas-Oberfläche auf dunklem Petrol-Navy. Referenzen (Mobbin): Revolut Business (Navy-Grund mit Lichtschein), Suno (Glaspanels), Emergent und Lovable „Nexus“ (Cyan-Akzente).

## Vorgaben des Projektinhabers
- **Kein** Lila, Pink, Rosa oder Verwandtes.
- **Kein** reines Schwarz – dunkelste Fläche ist `canvas` (#071521).

## Farben (Tokens in `app/globals.css`, als Tailwind-Klassen nutzbar)

| Token | Wert | Verwendung |
|---|---|---|
| `canvas` / `canvas-2` | #071521 / #0a1c2b | Seitengrund (mit Polarlicht-Schein und feinem Raster) |
| `surface` … `surface-3` | #0d2131 … #17344a | feste Flächen, Hover |
| `line` / `line-strong` | #1d3a51 / #2a4d68 | Linien |
| `ink` / `ink-2` / `muted` | #e8f2f9 / #a9c1d3 / #7290a7 | Text |
| `accent` / `accent-strong` / `accent-deep` | #4fd8ff / #93e9ff / #1fa6d6 | Gletscher-Cyan: Aktionen, Fokus, aktive Zustände |
| `on-accent` | #04202f | Text auf Cyan |
| `signal` | #c9f36b | Status-Punkte (sparsam) |
| `openai` / `anthropic` / `google` / `other` | #3ee0a1 / #ffaf5f / #62a9ff / #c9f36b | Agentenfarben (Mint, Amber, Himmelblau, Limette) |

## Glas-Bausteine (`@utility`)
- `glass` – Standard-Panel (Seitenleiste, Kopfzeile, Karten, Nachrichten)
- `glass-strong` – Dialoge, Composer, Schubladen
- `btn-primary` – Hauptaktion (Cyan-Verlauf, Glow) · `btn-ghost` – Nebenaktion
- `field` – Eingabefelder · `text-gradient` – große Überschriften

## Typografie
- Display: **Unbounded** (`font-display`, lokal über `@fontsource-variable/unbounded`) – nur Überschriften, Wortmarke, große Zahlen
- Text: Geist Sans · Daten/Code: Geist Mono

## Regeln
- Schwebende Panels mit Abstand zum Rand (`md:m-3`, `rounded-2xl`); Hintergrund bleibt sichtbar.
- Cyan nur für Interaktion und aktiven Zustand, nie als Fläche für Fließtext.
- Bewegung sparsam (Streaming-Cursor, Live-Punkt), `prefers-reduced-motion` wird respektiert.
- Schriften und Bilder nur lokal (CSP `font-src 'self'`).
