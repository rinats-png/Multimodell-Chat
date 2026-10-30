# Design-System „Hub Center“

Futuristische Glasoberfläche vor einem fotografischen Raum (kreisrunde Halle mit Lichtringen). Die Glasflächen zeichnen den Raum weich, ein Schleier hält Text lesbar.

- **Hell (Standard ohne Systemvorgabe): „Frost & Kupfer“** – Sandstein, Elfenbein, Kupferakzent.
- **Dunkel: „Basalt & Rost“** – warmer Stein, gedämpftes Rost.

Referenzen (Mobbin): Leonardo AI (Icon-Leiste, zentraler Prompt), Emergent (Prompt auf atmosphärischem Grund), Supabase (Status-Kacheln, Knotenansicht), Artlist (schwebende Glaskarten), Neon (Kennzahlenleiste). Die Hintergrundfotos sind mit Higgscheap (Nano Banana Pro) erzeugt und liegen unter `public/bg/` (`hub-light.webp`, `hub-dark.webp`, je 2048 px).

Entwürfe aller Bereiche in beiden Themen: Design-Canvas „Multimodell Hub Center“ (Zeilen D und E).

## Vorgaben des Projektinhabers
- **Kein** Lila, Pink, Rosa, Blau oder Verwandtes; keine übersättigten Farben.
- **Kein** reines oder tiefes Schwarz – dunkelste Fläche ist `canvas` (#2a2624).

## Hell/Dunkel
- Ohne Wahl folgt die App der Systemeinstellung (`prefers-color-scheme`).
- Umschalter in der Seitenleiste (`components/ui/ThemeToggle.tsx`: Wie System · Hell · Dunkel) setzt `<html data-theme>` und merkt sich die Wahl in `localStorage` (`mm-theme`).
- Ein kleines Inline-Skript mit CSP-Nonce (`lib/theme.ts`, eingebunden in `app/layout.tsx`) setzt `data-theme` vor dem ersten Zeichnen – kein Aufblitzen.

## Farben (Tokens in `app/globals.css`, als Tailwind-Klassen nutzbar)

| Token | Hell | Dunkel | Verwendung |
|---|---|---|---|
| `canvas` / `canvas-2` | #e8e4dd / #efebe5 | #2a2624 / #24201e | Seitengrund unter dem Foto |
| `surface` … `surface-3` | #f6f3ee … #e6dfd5 | #322d2a … #463f3b | feste Flächen, Hover |
| `line` / `line-strong` | #d6cdc1 / #bfb3a4 | #4b433e / #615750 | Linien |
| `ink` / `ink-2` / `muted` | #2c2925 / #3f3934 / #5c534a | #efe8e3 / #ddd3cb / #b6a99f | Text |
| `accent` / `accent-strong` / `accent-deep` | #9d5532 / #6e361d / #b4673f | #d6a083 / #e8c0a8 / #a87459 | Kupfer bzw. Rost: Aktionen, Fokus, aktive Zustände |
| `on-accent` | #fffaf4 | #2a1810 | Text auf Akzent |
| `signal` | #4f7a3a | #b9cfa0 | Status-Punkte |
| `danger` / `warn` | #a8382a / #6b4c0e | #e5826c / #e2c27a | Fehler, Warnungen |
| `openai` / `anthropic` / `google` / `other` | #46632f / #66461b / #5f5a50 / #4f7a3a | #adc293 / #d8b07c / #cfc6b0 / #b9cfa0 | Agentenfarben (Salbei, Ocker, Stein, Moos) |
| `on-agent` | #fffaf4 | #241d18 | Initialen auf Agenten-Avataren |

Kontrast: Alle Texte auf Chat, Tarif, Datenschutz und Impressum wurden automatisch gegen den tatsächlich gerenderten Hintergrund (Foto + Glas) gemessen; Ziel WCAG AA (4,5:1, große Schrift 3:1).

## Glas-Bausteine (`@utility`)
- `glass` – Standard-Panel (Seitenleiste, Kopfzeile, Karten, Nachrichten)
- `glass-strong` – Dialoge, Composer, Schubladen
- `glass-bar` – schmale Leisten
- `btn-primary` – Hauptaktion (Kupfer- bzw. Rostverlauf) · `btn-ghost` – Nebenaktion
- `field` – Eingabefelder · `text-gradient` – große Überschriften

Die Glaswerte (`--glass-1`, `--glass-2`, `--glass-edge` …) sind pro Thema als CSS-Variablen definiert.

## Typografie
- Geist Sans für Text und Überschriften (`font-display` = Geist, halbfett, enge Laufweite)
- Geist Mono für Daten, Labels und Code

## Regeln
- Schwebende Panels mit Abstand zum Rand (`md:m-3`, `rounded-2xl`); der Raum dahinter bleibt sichtbar.
- Akzent nur für Interaktion und aktiven Zustand, nie als Fläche für Fließtext.
- Neue Farben nur als Token in `app/globals.css` (beide Themen), keine festen Hex-/RGB-Werte in Komponenten.
- Bewegung sparsam (Streaming-Cursor, Live-Punkt), `prefers-reduced-motion` wird respektiert.
- Schriften und Bilder nur lokal (CSP `font-src 'self'`, `img-src 'self'`).
