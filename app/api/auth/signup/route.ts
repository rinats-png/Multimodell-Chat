import { NextResponse } from "next/server";
import { handleApi, readJson } from "@/lib/api";
import { assertAuthAvailable, emailKey, limitByIp } from "@/lib/auth-routes";
import { appOrigin } from "@/lib/billing";
import { logError, securityLog } from "@/lib/log";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signupSchema } from "@/lib/validation";

/** Registrierung. Antwortet immer gleich, egal ob die E-Mail schon existiert (Regel 3.4). */
export async function POST(request: Request) {
  return handleApi(async () => {
    assertAuthAvailable();
    await limitByIp(request, "signup-ip", RATE_LIMITS.signupPerIp.limit, RATE_LIMITS.signupPerIp.windowMs);
    const { email, password } = await readJson(request, signupSchema);

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${appOrigin(request)}/auth/callback` },
    });
    if (error) {
      // Auch Fehler (z. B. „bereits registriert“, Passwort zu schwach laut Dashboard) nicht unterscheidbar machen.
      logError("auth.signup", error);
      if (error.code === "weak_password") {
        return NextResponse.json({ error: "Dieses Passwort ist zu schwach oder in bekannten Datenlecks enthalten. Bitte wähle ein anderes.", code: "weak_password" }, { status: 400 });
      }
    }
    securityLog("signup_requested", { account: emailKey(email) });
    return NextResponse.json({ ok: true, signedIn: Boolean(data?.session) });
  });
}
