import { handleApi, jsonError } from "@/lib/api";
import { runOrchestration } from "@/lib/orchestrator";
import { getSession } from "@/lib/session";
import type { OrchestrateEvent } from "@/lib/types";
import { checkPromptInjection } from "@/lib/usage-guard";
import { orchestrateSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Startet eine Orchestrierungsrunde und streamt Events als NDJSON:
 * user-message → router → turn-start → delta… → turn-end → … → usage → done
 */
export async function POST(request: Request) {
  return handleApi(async () => {
    const { store } = await getSession();
    const body = orchestrateSchema.parse(await request.json());

    const room = await store.getRoom(body.roomId);
    if (!room) return jsonError("Raum nicht gefunden", 404, "not_found");
    const agents = await store.listAgents(room.id);

    const content = body.content?.trim();
    if (content) {
      const injection = checkPromptInjection(content);
      if (injection.flagged) {
        return jsonError(
          `Prompt-Firewall: Nachricht blockiert (${injection.matches.join(", ")}).`,
          400,
          "prompt_injection",
        );
      }
    }
    if (!content && !body.agentId) return jsonError("Nachricht oder Agent erforderlich", 400, "invalid_input");

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
          await runOrchestration({
            store,
            room,
            agents,
            forcedAgentId: body.agentId ?? null,
            userMessage,
            emit,
            signal: request.signal,
          });
        } catch (error) {
          emit({ type: "error", code: "internal", message: error instanceof Error ? error.message : "Interner Fehler" });
        } finally {
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
