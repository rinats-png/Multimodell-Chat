import { memoryStore } from "@/lib/store/memory-store";
import type { OrchestrateEvent } from "@/lib/types";

export async function demoRoom(mode: "router" | "round-robin" | "manual" = "round-robin") {
  const room = await memoryStore.createRoom("Test");
  return memoryStore.updateRoom(room.id, { orchestration_mode: mode });
}

export function collector() {
  const events: OrchestrateEvent[] = [];
  return { events, emit: (e: OrchestrateEvent) => events.push(e) };
}

export async function userMessage(roomId: string, content: string) {
  return memoryStore.insertMessage({
    room_id: roomId,
    sender_type: "user",
    agent_id: null,
    sender_name: "Du",
    content,
    input_tokens: 0,
    output_tokens: 0,
    estimated_cost_usd: 0,
  });
}

export function jsonRequest(url: string, method: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json", origin: "http://localhost", ...headers },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
}

export async function readNdjson(res: Response): Promise<OrchestrateEvent[]> {
  const text = await res.text();
  return text.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as OrchestrateEvent);
}
