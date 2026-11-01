/**
 * Zeitpunkt der Anmeldung DIESER Sitzung (Z14-08) aus dem `amr`-Claim des Supabase-Access-Tokens
 * (Liste der Anmeldemethoden mit Unix-Zeitstempel). Das Token wurde zuvor per `auth.getUser()`
 * serverseitig bestätigt; hier wird es nur noch gelesen.
 */
export function sessionAuthTime(accessToken: string | null | undefined): string | null {
  const payload = accessToken?.split(".")[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      amr?: { method?: string; timestamp?: number }[];
    };
    const latest = Math.max(...(claims.amr ?? []).map((a) => a.timestamp ?? 0));
    return latest > 0 ? new Date(latest * 1000).toISOString() : null;
  } catch {
    return null;
  }
}
