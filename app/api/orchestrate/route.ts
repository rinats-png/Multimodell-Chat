import { clientIp, handleApi, HttpError, notFound, readJson } from "@/lib/api";
import { runCouncilRound } from "@/lib/council-session";
import { logError, securityLog } from "@/lib/log";
import { runOrchestration } from "@/lib/orchestrator";
import { checkPromptInjection } from "@/lib/prompt-firewall";
import { acquireLock, rateLimit, RATE_LIMITS, releaseLock, retryAfterSeconds } from "@/lib/rate-limit";
import { getSession } from "@/lib/session";
import type { OrchestrateEvent } from "@/lib/types";
import { orchestrateSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 120;
const LOCK_TTL_SECONDS = maxDuration + 30;

/**
 * Startet eine Orchestrierungsrunde und streamt Events als NDJSON:
 * user-message → router → turn-start → delta… → turn-end → … → usage → done
 * Limits und Sperre werden VOR dem Stream geprüft, damit echte 429/409-Antworten möglich sind.
 */
export async function POST(request: Request) {
  return handleApi(async () => {
    const { store, userId, allowPlatformKey } = await getSession();
    const body = await readJson(request, orchestrateSchema);

    // Rate-Limit pro IP und pro Konto (Runden), bevor irgendetwas Kosten verursacht.
    const ip = clientIp(request);
    const ipResult = await rateLimit("rounds-ip", ip, RATE_LIMITS.roundsPerIp.limit, RATE_LIMITS.roundsPerIp.windowMs);
    const profile = await store.getProfile();
    const accountResult = await rateLimit("rounds", userId, profile.rate_limit_per_min);
    for (const result of [ipResult, accountResult]) {
      if (!result.allowed) {
        securityLog("rate_limited", { bucket: "rounds", userId });
        throw new HttpError(429, "rate_limited", `Zu viele Anfragen. Bitte in ${retryAfterSeconds(result)} s erneut versuchen.`, {
          "Retry-After": retryAfterSeconds(result),
        });
      }
    }

    const room = await store.getRoom(body.roomId);
    if (!room) throw notFound();
    const agents = await store.listAgents(room.id);

    const content = body.content?.trim();
    if (content && checkPromptInjection(content).flagged) {
      // Hinweisfunktion, keine Sicherheitsgrenze (BF-32) – Regelnamen werden nicht verraten.
      securityLog("prompt_firewall", { userId });
      throw new HttpError(400, "prompt_injection", "Die Nachricht enthält Muster, die wie ein Angriff auf die KI-Anweisungen aussehen, und wurde nicht gesendet.");
    }
    if (!content && !body.agentId && !body.round) throw new HttpError(400, "invalid_input", "Nachricht oder Agent erforderlich");
    if (body.round === 1 && !content) throw new HttpError(400, "invalid_input", "Beschreibe zuerst die Entscheidung, über die der Rat beraten soll.");
    if (body.round === 1) {
      // Eine Ratssitzung löst viele Modellaufrufe aus: Starts pro Konto begrenzen.
      const council = await rateLimit("council", userId, RATE_LIMITS.councilPerAccount.limit, RATE_LIMITS.councilPerAccount.windowMs);
      if (!council.allowed) {
        securityLog("rate_limited", { bucket: "council", userId });
        throw new HttpError(429, "rate_limited", `Du hast in der letzten Stunde viele Ratssitzungen gestartet. Bitte in ${Math.ceil(Number(retryAfterSeconds(council)) / 60)} min erneut versuchen.`, {
          "Retry-After": retryAfterSeconds(council),
        });
      }
    }

    // Höchstens eine laufende Runde pro Konto (BF-03, BF-21).
    const lockKey = `round:${userId}`;
    const lockToken = await acquireLock(lockKey, LOCK_TTL_SECONDS);
    if (!lockToken) {
      throw new HttpError(409, "busy", "Es läuft bereits eine Antwortrunde. Warte, bis sie fertig ist, oder stoppe sie.");
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const emit = (event: OrchestrateEvent) => {
          try {
            controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
          } catch {
            // Client hat die Verbindung bereits geschlossen.
          }
        };
        try {
          let userMessage = null;
          if (content) {
            userMessage = await store.insertMessage({
              room_id: room.id,
              sender_type: "user",
              agent_id: null,
              sender_name: "Du",
              content,
              input_tokens: 0,
              output_tokens: 0,
              estimated_cost_usd: 0,
            });
            emit({ type: "user-message", message: userMessage });
          }
          const run = { store, room, agents, forcedAgentId: body.agentId ?? null, userMessage, allowPlatformKey, emit, signal: request.signal };
          if (body.round) await runCouncilRound({ ...run, round: body.round as 1 | 2 | 3 });
          else await runOrchestration(run);
        } catch (error) {
          logError("orchestrate.stream", error, { userId, roomId: room.id });
          emit({ type: "error", code: "internal", message: "Die Runde konnte nicht abgeschlossen werden. Bitte erneut versuchen." });
        } finally {
          await releaseLock(lockKey, lockToken).catch((error) => logError("lock.release", error));
          emit({ type: "done" });
          try {
            controller.close();
          } catch {
            // bereits geschlossen
          }
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  });
}
