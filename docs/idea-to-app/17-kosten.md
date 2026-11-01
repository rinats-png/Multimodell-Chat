# Monetarisierung & Betriebskosten (verkürzt)

## Modell
Abo in drei Stufen, Abrechnung über Stripe (E-010).

## Preise

| Tarif | Preis | Tokens/Monat | KI-Antworten/min | Agenten aktiv | Turns | Window | Räume | Gedächtnis | BYOK |
|---|---|---|---|---|---|---|---|---|---|
| Starter | 0 € | 15.000 | 5 | 3 | 3 | 12 | 5 | – | – |
| Pro | 29 € | 500.000 | 15 | 6 | 10 | 40 | 100 | ✓ | – |
| Workspace/BYOK | 79 € | 2.500.000 (mit eigenem Key unbegrenzt) | 60 | 8 | 10 | 40 | 100 | ✓ | ✓ |

Einzige Quelle im Code: `lib/plans.ts` (SQL-Spiegel in `apply_subscription_tier`, Test `tests/plans.test.ts`).

## Verkaufsweg und Store-Gebühren (falls zutreffend)
Web, Stripe-Gebühren laut Stripe-Preisliste [PRÜFEN].

## Laufende Kosten (Schätzung, Preise prüfen)

Modellpreise (USD/1k Tokens, `lib/models.ts`, Stand ungeprüft [Q-007]): GPT-4o 0,0025/0,01 · Claude 3.5 Sonnet 0,003/0,015 · Gemini 2.5 Pro 0,00125/0,01.

| Szenario | Rechnung | Kosten/Monat |
|---|---|---|
| Pro-Nutzer schöpft 500k Tokens voll aus, Mix 80 % Input / 20 % Output, teuerstes Katalogmodell (Claude 3.5 Sonnet) | 400k × 0,003/1k + 100k × 0,015/1k | ≈ 2,70 USD |
| Team ohne BYOK, 2,5 Mio. Tokens, gleicher Mix | 5 × obiger Wert | ≈ 13,50 USD |
| Starter, 15k Tokens | | ≈ 0,08 USD |

Ergebnis: Mit Modell-Allowlist und Token-Kontingent liegen die KI-Kosten im ungünstigsten Fall deutlich unter dem Preis. Die Allowlist ist zwingend: Ein Modell mit 10-fachem Preis würde Pro unrentabel machen (BF-02).

## Feste Kosten
Supabase Pro (nötig für Leaked-Password-Schutz [Q-005] und Backups), Vercel Pro, Upstash, Domain – Beträge laut aktuellen Preislisten [PRÜFEN].

## Kostenlimits & Alarme
- Pro Nutzer: Kontingent + Minutenlimit (siehe `14-sicherheit.md`).
- Plattform: **Credit-Limit im OpenRouter-Konto** und Benachrichtigung bei 50/80 % [ANNAHME A-009]; Upstash- und Vercel-Spend-Limits setzen.
- Registrierungen pro IP begrenzt (5/h) gegen Gratis-Konten-Farmen; bei Missbrauch CAPTCHA nachrüsten (Parkplatz).

## Wirtschaftlichkeit (Rechnung)
Deckungsbeitrag pro Pro-Nutzer ≈ 29 € − Stripe-Gebühr − ≤ 3 USD KI-Kosten − anteilige Fixkosten. Gratis-Nutzer kosten ≤ 0,10 USD/Monat an KI.
