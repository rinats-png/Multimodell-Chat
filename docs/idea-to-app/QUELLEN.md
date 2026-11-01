# Quellen & Belege: Multimodell-Chat

> Jede externe Tatsachenbehauptung wird im Dokument mit `[Q-…]` referenziert. Preise und Richtlinien spätestens vor dem Launch neu prüfen.

| ID | Aussage | Quelle (URL / Werk) | Veröffentlicht | Geprüft am | Art | Verlässlichkeit (h/m/n) | Neu prüfen bis | Verwendet in |
|---|---|---|---|---|---|---|---|---|
| Q-001 | Informationspflichten (Art. 13), Recht auf Löschung (Art. 17) und Datenübertragbarkeit (Art. 20) DSGVO | https://eur-lex.europa.eu/eli/reg/2016/679/oj | 2016-05-04 | 2026-10-29 | Primärquelle | h | 2027-10-29 | B1-ist-analyse.md, 16-recht.md |
| Q-002 | Anbieterkennzeichnung (Impressum) nach § 5 Digitale-Dienste-Gesetz | https://www.gesetze-im-internet.de/ddg/__5.html | 2024-05-14 | 2026-10-29 (nicht online nachgeprüft, aus Regelwerk `guides/recht-eu-ueberblick.md`) | Annahme | m | vor Launch | B1-ist-analyse.md, 16-recht.md |
| Q-003 | OpenRouter: `provider.data_collection = "deny"` leitet nur an Anbieter, die keine Nutzerdaten speichern/trainieren; ohne passenden Anbieter schlägt die Anfrage fehl; auch als Kontoeinstellung verfügbar | https://openrouter.ai/docs/features/provider-routing | – | 2026-10-29 (Websuche) | Primärquelle | h | vor Launch | B1-ist-analyse.md, 11-daten.md, 16-recht.md, lib/ai/provider.ts |
| Q-004 | Stripe verarbeitet Zahlungsdaten selbst (Payment-Page/Checkout), Händler speichert keine Kartendaten | https://docs.stripe.com/payments/checkout | – | 2026-10-29 (nicht online nachgeprüft) | Annahme | m | vor Launch | 11-daten.md, 16-recht.md |
| Q-005 | Supabase „Leaked password protection“ (HaveIBeenPwned, k-Anonymität) ist nur ab dem Pro-Plan verfügbar | https://supabase.com/docs/guides/auth/password-security | – | 2026-10-29 (Websuche, Sekundärquellen übereinstimmend) | Primärquelle | m | vor Launch | 14-sicherheit.md, 17-kosten.md |
| Q-006 | EU-KI-Verordnung Art. 50: Transparenzpflichten für Chatbots/KI-erzeugte Inhalte gelten seit 2. August 2026 | idea-to-app `guides/recht-eu-ueberblick.md` (Stand 2026-10-14) mit dort genannten Quellen | 2026-10-14 | 2026-10-29 | Bericht/Artikel | m | vor Launch | 16-recht.md |
| Q-007 | Modellpreise (USD pro 1.000 Tokens) in `lib/models.ts` | https://openrouter.ai/models | – | nicht geprüft (Stand der Erstellung) | Annahme | n | vor Launch | 17-kosten.md, lib/models.ts |
