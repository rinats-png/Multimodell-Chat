import { assertSensitiveAction } from "@/lib/account";
import { handleApi } from "@/lib/api";
import { securityLog } from "@/lib/log";
import { getSession } from "@/lib/session";

/** Datenexport nur für den angemeldeten Nutzer selbst (DSGVO Art. 20, Regel 7.4). */
export async function GET() {
  return handleApi(async () => {
    const session = await getSession();
    await assertSensitiveAction(session);
    const data = await session.store.exportAccount();
    securityLog("account_exported", { userId: session.userId });
    return new Response(JSON.stringify({ email: session.email, ...data }, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="multimodell-chat-export-${new Date().toISOString().slice(0, 10)}.json"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
