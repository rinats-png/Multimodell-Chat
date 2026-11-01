import { NextResponse } from "next/server";
import { handleApi, readJson } from "@/lib/api";
import { assertAuthAvailable, emailKey, limitByIp } from "@/lib/auth-routes";
import { appOrigin } from "@/lib/billing";
import { logError, securityLog } from "@/lib/log";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resetRequestSchema } from "@/lib/validation";

/** Passwort-Reset anfordern. Gleiche Antwort in jedem Fall (Regel 3.4). */
export async function POST(request: Request) {
  return handleApi(async () => {
    assertAuthAvailable();
    await limitByIp(request, "reset-ip", RATE_LIMITS.resetPerIp.limit, RATE_LIMITS.resetPerIp.windowMs);
    const { email } = await readJson(request, resetRequestSchema);
    const key = emailKey(email);
    const perAccount = await rateLimit("reset", key, RATE_LIMITS.resetPerAccount.limit, RATE_LIMITS.resetPerAccount.windowMs);
    if (perAccount.allowed) {
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${appOrigin(request)}/auth/callback?next=/passwort-neu`,
      });
      if (error) logError("auth.reset", error);
    } else {
      // Limit erreicht: intern nicht versenden, nach außen gleiche Antwort.
      securityLog("rate_limited", { bucket: "reset", account: key });
    }
    return NextResponse.json({ ok: true });
  });
}
