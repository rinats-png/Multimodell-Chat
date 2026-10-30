import { NextResponse } from "next/server";
import { handleApi, HttpError, readJson } from "@/lib/api";
import { sessionAuthTime } from "@/lib/auth-time";
import { REAUTH_MAX_AGE_MS } from "@/lib/session";
import { assertAuthAvailable } from "@/lib/auth-routes";
import { logError, securityLog } from "@/lib/log";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { passwordUpdateSchema } from "@/lib/validation";

/** Neues Passwort setzen (nach Reset-Link). Danach alle anderen Sitzungen beenden (Regel 3.5). */
export async function POST(request: Request) {
  return handleApi(async () => {
    assertAuthAvailable();
    const { password } = await readJson(request, passwordUpdateSchema);
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new HttpError(401, "unauthorized", "Der Link ist abgelaufen. Fordere einen neuen an.");
    // Z14-02: nur direkt nach dem Reset-Link bzw. einer frischen Anmeldung DIESER Sitzung.
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const authTime = sessionAuthTime(session?.access_token);
    if (!authTime || Date.now() - new Date(authTime).getTime() > REAUTH_MAX_AGE_MS) {
      securityLog("password_change_denied", { userId: user.id });
      throw new HttpError(403, "reauth_required", "Der Link ist abgelaufen. Fordere über „Passwort vergessen“ einen neuen an.");
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      logError("auth.password", error);
      throw new HttpError(400, "weak_password", "Das Passwort konnte nicht gesetzt werden. Wähle ein anderes, längeres Passwort.");
    }
    await supabase.auth.signOut({ scope: "others" });
    securityLog("password_changed", { userId: user.id });
    return NextResponse.json({ ok: true });
  });
}
