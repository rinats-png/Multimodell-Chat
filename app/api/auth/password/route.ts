import { NextResponse } from "next/server";
import { handleApi, HttpError, readJson } from "@/lib/api";
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
