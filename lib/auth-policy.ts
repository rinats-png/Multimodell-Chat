/**
 * Passwortregeln (Projektwerte aus docs/idea-to-app/14-sicherheit.md):
 * Ohne Zwei-Faktor-Anmeldung ist das Passwort der einzige Faktor → Mindestlänge 15.
 * Obergrenze 72: Supabase Auth hasht mit bcrypt (verarbeitet max. 72 Byte).
 * Keine Pflicht zu Sonderzeichen. Prüfung gegen geleakte Passwörter übernimmt
 * Supabase („Leaked password protection“ im Dashboard aktivieren).
 */
export const PASSWORD_MIN_LENGTH = 15;
export const PASSWORD_MAX_LENGTH = 72;
