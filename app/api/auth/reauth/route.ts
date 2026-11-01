import { NextResponse } from "next/server";
import { handleApi, HttpError, readJson } from "@/lib/api";
import { assertAuthAvailable, emailKey, limitByIp } from "@/lib/auth-routes";
import { securityLog } from "@/lib/log";
import { peekLimit, rateLimit, RATE_LIMITS, retryAfterSeconds } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { reauthSchema } from "@/lib/validation";

/** Erneute Anmeldung vor sensiblen Aktionen (Konto löschen, Export). */
export async function POST(request: Request) {
  return handleApi(async () => {
    assertAuthAvailable();
    await limitByIp(request, "login-ip", RATE_LIMITS.loginPerIp.limit, RATE_LIMITS.loginPerIp.windowMs);
    const { password } = await readJson(request, reauthSchema);
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) throw new HttpError(401, "unauthorized", "Nicht angemeldet");
    // Z14-09: dieselbe Fehlversuchs-Sperre pro Konto wie beim Login.
    const key = emailKey(user.email);
    const { limit, windowMs } = RATE_LIMITS.loginFailuresPerAccount;
    const locked = await peekLimit("login-fail", key, limit, windowMs);
    if (!locked.allowed) {
      securityLog("login_locked", { account: key });
      throw new HttpError(429, "rate_limited", "Zu viele Fehlversuche. Bitte warte einige Minuten.", { "Retry-After": retryAfterSeconds(locked) });
    }
    const { error } = await supabase.auth.signInWithPassword({ email: user.email, password });
    if (error) {
      await rateLimit("login-fail", key, limit, windowMs);
      securityLog("reauth_failed", { account: key });
      throw new HttpError(401, "invalid_credentials", "Das Passwort ist nicht korrekt.");
    }
    securityLog("reauth_succeeded", { account: key });
    return NextResponse.json({ ok: true });
  });
}
