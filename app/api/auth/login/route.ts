import { NextResponse } from "next/server";
import { handleApi, HttpError, readJson } from "@/lib/api";
import { assertAuthAvailable, emailKey, limitByIp } from "@/lib/auth-routes";
import { securityLog } from "@/lib/log";
import { peekLimit, rateLimit, RATE_LIMITS, retryAfterSeconds } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validation";

/** Eine Meldung für alle Fehlerfälle – keine Nutzer-Enumeration (Regel 3.4). */
const GENERIC = "E-Mail oder Passwort ist falsch – oder die E-Mail-Adresse ist noch nicht bestätigt.";

export async function POST(request: Request) {
  return handleApi(async () => {
    assertAuthAvailable();
    await limitByIp(request, "login-ip", RATE_LIMITS.loginPerIp.limit, RATE_LIMITS.loginPerIp.windowMs);
    const { email, password } = await readJson(request, loginSchema);

    const key = emailKey(email);
    const { limit, windowMs } = RATE_LIMITS.loginFailuresPerAccount;
    const locked = await peekLimit("login-fail", key, limit, windowMs);
    if (!locked.allowed) {
      securityLog("login_locked", { account: key });
      throw new HttpError(429, "rate_limited", "Zu viele Fehlversuche. Bitte warte einige Minuten.", { "Retry-After": retryAfterSeconds(locked) });
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      await rateLimit("login-fail", key, limit, windowMs);
      securityLog("login_failed", { account: key });
      throw new HttpError(401, "invalid_credentials", GENERIC);
    }
    securityLog("login_succeeded", { account: key });
    return NextResponse.json({ ok: true });
  });
}
