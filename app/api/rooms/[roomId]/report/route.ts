import { NextResponse } from "next/server";
import { clientIp, handleApi, HttpError, limitMutations, notFound, parseParam } from "@/lib/api";
import { securityLog } from "@/lib/log";
import { acquireLock, rateLimit, RATE_LIMITS, releaseLock, retryAfterSeconds } from "@/lib/rate-limit";
import { createReportForRoom } from "@/lib/report/service";
import { getSession } from "@/lib/session";
import { uuidSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 60;
const LOCK_TTL_SECONDS = maxDuration + 30;

interface Params {
  params: Promise<{ roomId: string }>;
}

/** Erstellt den Entscheidungsbericht einer eigenen Debatte (F-21). Antwort: `{ report: { id } }`. */
export async function POST(request: Request, { params }: Params) {
  return handleApi(async () => {
    const roomId = parseParam((await params).roomId, uuidSchema);
    const { store, userId, allowPlatformKey } = await getSession();
    await limitMutations(userId);

    // Wie eine Antwortrunde: teurer Endpunkt, daher auch pro IP begrenzt.
    const ipResult = await rateLimit("rounds-ip", clientIp(request), RATE_LIMITS.roundsPerIp.limit, RATE_LIMITS.roundsPerIp.windowMs);
    if (!ipResult.allowed) {
      securityLog("rate_limited", { bucket: "report-ip", userId });
      throw new HttpError(429, "rate_limited", `Zu viele Anfragen. Bitte in ${retryAfterSeconds(ipResult)} s erneut versuchen.`, { "Retry-After": retryAfterSeconds(ipResult) });
    }

    const room = await store.getRoom(roomId);
    if (!room) throw notFound();
    const agents = await store.listAgents(room.id);

    // Nicht parallel zu einer laufenden Antwortrunde desselben Kontos.
    const lockKey = `round:${userId}`;
    const lockToken = await acquireLock(lockKey, LOCK_TTL_SECONDS);
    if (!lockToken) throw new HttpError(409, "busy", "Es läuft bereits eine Antwortrunde oder ein Bericht. Warte, bis sie fertig ist.");
    try {
      const stored = await createReportForRoom({ store, room, agents, allowPlatformKey, signal: request.signal });
      return NextResponse.json({ report: { id: stored.id, title: stored.title } }, { status: 201 });
    } finally {
      await releaseLock(lockKey, lockToken).catch(() => undefined);
    }
  });
}
