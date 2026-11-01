# Rollen & Berechtigungen

## Rollen

| Rolle | Wer | Zugriff auf fremde Daten? |
|---|---|---|
| Gast | nicht angemeldet | nein – nur Login, Registrierung, Reset, Impressum, Datenschutz |
| Nutzer | angemeldetes Konto | nein – nur eigene Räume, Agenten, Nachrichten, Profilwerte |
| Server | API-Routen mit Service-Role | ja, technisch – nur nach Prüfung der Nutzer-Sitzung bzw. Stripe-Signatur |
| Betreiber | Supabase-/Vercel-/Stripe-Dashboard | ja – nur für Support und Betrieb, 2FA Pflicht (E-003) |

Es gibt keine Admin-Rolle in der App selbst.

## Berechtigungsmatrix

| Ressource | Gast | Nutzer (eigene) | Nutzer (fremde) | Server |
|---|---|---|---|---|
| Raum lesen / anlegen / ändern (Titel, Einstellungen) / löschen | – | ✅ | ❌ 404 | ✅ |
| Raum-Gedächtnis (`running_summary`) schreiben | – | ❌ | ❌ | ✅ |
| Agent lesen / anlegen / ändern / löschen | – | ✅ (Tarifgrenzen, Modell-Allowlist) | ❌ 404 | ✅ |
| Nachricht lesen / Verlauf leeren | – | ✅ | ❌ 404 | ✅ |
| Nachricht schreiben (Ledger) | – | ❌ (nur über `/api/orchestrate`) | ❌ | ✅ |
| Profil lesen (Tarif, Verbrauch) | – | ✅ (ohne Key, ohne Stripe-IDs) | ❌ | ✅ |
| Tarif / Limits / Verbrauch ändern | – | ❌ | ❌ | ✅ (nur Webhook) |
| Eigenen API-Key setzen | – | ✅ (nur Workspace-Tarif, über API) | ❌ | ✅ |
| Export / Konto löschen | – | ✅ (frische Anmeldung ≤ 15 min) | ❌ | ✅ |

## Grundsätze
- Deny by default: RLS auf allen Tabellen; anon hat keinerlei Tabellenrechte.
- Besitz wird über die Kette `chat_rooms.user_id = auth.uid()` geprüft, nie über IDs aus der Anfrage.
- Fremde oder ungültige IDs antworten wie „nicht vorhanden“ (404, Zugriffs-Antwortstrategie).

## Teilen
Nicht vorgesehen.

## Pflicht-Testfälle (für Phase 19)

| Test | Erwartung | Bezug |
|---|---|---|
| T-SEC-13 | fremde/ungültige Agent-, Raum-IDs über API → 404 ohne Details | Matrix Zeilen 1–3 |
| T-SEC-16 | Nutzer A sieht über die Datenbank nur eigene Räume, Agenten, Nachrichten, Summen; anon nichts | RLS |
| T-SEC-17 | A kann fremde Räume, Agenten, Nachrichten weder ändern noch löschen | RLS |
| T-SEC-18 | A kann nichts in fremde Räume oder unter fremder `user_id` anlegen | RLS |
| T-SEC-19 | Ledger, Gedächtnis, Profil, Key: für Clients nicht schreibbar / Key nicht lesbar | Column-Grants |
| T-SEC-20 | Verbrauchs- und Tariffunktionen nur für service_role | Function-Grants |
