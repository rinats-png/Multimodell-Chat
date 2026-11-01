/**
 * Sitzungs-Cookies (Regel 3.6, BF-26): HttpOnly, Secure (in Produktion), SameSite=Lax.
 * Laufzeit = Inaktivitäts-Timeout aus docs/idea-to-app/14-sicherheit.md; jede Anfrage
 * mit gültiger Sitzung verlängert sie. Die absolute Höchstdauer setzt das Supabase-Dashboard.
 * HttpOnly ist möglich, weil alle Auth-Abläufe serverseitig laufen (kein Browser-Client).
 */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 30 * 24 * 60 * 60,
};
