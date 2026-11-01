import { NextResponse } from "next/server";
import { handleApi, limitMutations, notFound, parseParam, readJson } from "@/lib/api";
import { securityLog } from "@/lib/log";
import { hashShareToken, newShareToken } from "@/lib/report/shared";
import { getSession } from "@/lib/session";
import { reportShareSchema, uuidSchema } from "@/lib/validation";

interface Params {
  params: Promise<{ reportId: string }>;
}

function publicOrigin(request: Request): string {
  return (process.env.APP_ORIGIN?.trim() || new URL(request.url).origin).replace(/\/$/, "");
}

/**
 * Freigabe-Link anlegen (`enabled: true`) oder widerrufen (`enabled: false`).
 * Der Link wird nur in dieser Antwort ausgegeben; gespeichert ist ausschließlich sein Hash. Ein neuer Link macht den alten ungültig.
 */
export async function POST(request: Request, { params }: Params) {
  return handleApi(async () => {
    const reportId = parseParam((await params).reportId, uuidSchema);
    const { store, userId } = await getSession();
    await limitMutations(userId);
    const { enabled } = await readJson(request, reportShareSchema);

    if (!enabled) {
      if (!(await store.setReportShare(reportId, null))) throw notFound();
      securityLog("report_share_revoked", { userId });
      return NextResponse.json({ shared: false });
    }
    const token = newShareToken();
    if (!(await store.setReportShare(reportId, hashShareToken(token)))) throw notFound();
    securityLog("report_share_created", { userId });
    return NextResponse.json({ shared: true, url: `${publicOrigin(request)}/r/${token}` }, { headers: { "Cache-Control": "no-store" } });
  });
}
