import "server-only";
import { HttpError } from "./api";
import { rateLimit, RATE_LIMITS, retryAfterSeconds } from "./rate-limit";
import { isRecentSignIn, type AppSession } from "./session";

/** Konto löschen / Export: frische Anmeldung (≤ 15 min) und eigenes Limit (Regel 7.4, Standardwerte §4). */
export async function assertSensitiveAction(session: AppSession): Promise<void> {
  const { limit, windowMs } = RATE_LIMITS.accountActionsPerAccount;
  const result = await rateLimit("account", session.userId, limit, windowMs);
  if (!result.allowed) {
    throw new HttpError(429, "rate_limited", "Zu viele Versuche. Bitte später erneut.", { "Retry-After": retryAfterSeconds(result) });
  }
  if (!isRecentSignIn(session)) {
    throw new HttpError(403, "reauth_required", "Bitte bestätige dein Passwort, um fortzufahren.");
  }
}
