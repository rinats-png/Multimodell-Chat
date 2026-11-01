import { NextResponse } from "next/server";
import { handleApi } from "@/lib/api";
import { checkCliStatus, isLocalSubscriptionMode } from "@/lib/ai/local-cli";
import { getSession } from "@/lib/session";

/** Lokaler Abo-Modus: Welche Programme sind installiert? (Nur lokal aktiv.) */
export async function GET() {
  return handleApi(async () => {
    await getSession();
    if (!isLocalSubscriptionMode()) return NextResponse.json({ enabled: false, programs: [] });
    return NextResponse.json({ enabled: true, programs: await checkCliStatus() });
  });
}
