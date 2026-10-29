import { NextResponse } from "next/server";
import { handleApi, HttpError, readJson } from "@/lib/api";
import { assertAuthAvailable, emailKey, limitByIp } from "@/lib/auth-routes";
import { securityLog } from "@/lib/log";
import { RATE_LIMITS } from "@/lib/rate-limit";
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
    const { error } = await supabase.auth.signInWithPassword({ email: user.email, password });
    if (error) {
      securityLog("reauth_failed", { account: emailKey(user.email) });
      throw new HttpError(401, "invalid_credentials", "Das Passwort ist nicht korrekt.");
    }
    return NextResponse.json({ ok: true });
  });
}
