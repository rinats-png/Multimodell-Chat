import { describe, expect, it } from "vitest";
import { runOrchestration } from "@/lib/orchestrator";
import { heuristicStance, rateStance, stanceTarget } from "@/lib/stance";
import { createMemoryStore, memoryStore } from "@/lib/store/memory-store";
import type { ChatMessage } from "@/lib/types";
import { collector, demoRoom, userMessage } from "./support/fixtures";

const base: ChatMessage = {
  id: "m",
  room_id: "r",
  sender_type: "agent",
  agent_id: "a1",
  sender_name: "ChatGPT",
  content: "x",
  input_tokens: 0,
  output_tokens: 0,
  estimated_cost_usd: 0,
  stance: null,
  stance_target_id: null,
  created_at: "2026-10-30T00:00:00Z",
};

describe("Zustimmung und Widerspruch (F-19)", () => {
  it("TEST-F19-1: Schlüsselwörter ergeben Widerspruch, Zustimmung, Weiterführung oder neutral", () => {
    expect(heuristicStance("Da muss ich widersprechen, das ist zu knapp.")).toBe("disagree");
    expect(heuristicStance("Einverstanden, so machen wir es.")).toBe("agree");
    expect(heuristicStance("Dazu passt ein Pilot mit zwei Kanzleien.")).toBe("extend");
    expect(heuristicStance("Hier ist meine Einschätzung zum Thema.")).toBe("neutral");
  });

  it("TEST-F19-2: bewertet wird nur, wenn eine KI direkt auf eine andere KI folgt", () => {
    const prev = { ...base, agent_id: "a1" };
    expect(stanceTarget({ ...base, agent_id: "a2" }, prev)).toBe("a1");
    expect(stanceTarget({ ...base, agent_id: "a1" }, prev)).toBeNull(); // dieselbe KI
    expect(stanceTarget({ ...base, agent_id: "a2" }, { ...base, sender_type: "user", agent_id: null })).toBeNull(); // Antwort auf den Menschen
    expect(stanceTarget({ ...base, agent_id: "a2" }, undefined)).toBeNull();
  });

  it("TEST-F19-3: ohne Zugang wird ohne Modellaufruf bewertet (kein Verbrauch)", async () => {
    const rating = await rateStance({ ...base, agent_id: "a2", content: "Das sehe ich anders, zu knapp." }, { ...base, agent_id: "a1" }, null);
    expect(rating).toEqual({ stance: "disagree", targetId: "a1", inputTokens: 0, outputTokens: 0 });
  });

  it("TEST-F19-4: Round-Robin speichert die Bewertung ab der zweiten KI und meldet sie per Event", async () => {
    const room = await demoRoom("round-robin");
    const agents = await memoryStore.listAgents(room.id);
    const msg = await userMessage(room.id, "Preise erhöhen?");
    const { events, emit } = collector();
    await runOrchestration({ store: memoryStore, room, agents, forcedAgentId: null, userMessage: msg, allowPlatformKey: false, emit, signal: new AbortController().signal });
    const replies = (await memoryStore.listMessages(room.id)).filter((m) => m.sender_type === "agent");
    expect(replies).toHaveLength(3);
    expect(replies[0]!.stance).toBeNull(); // Antwort auf den Menschen
    expect(replies[1]!.stance_target_id).toBe(replies[0]!.agent_id);
    expect(replies[2]!.stance_target_id).toBe(replies[1]!.agent_id);
    expect(events.filter((e) => e.type === "stance")).toHaveLength(2);
    // Bewertung ohne Modellaufruf bucht nichts zusätzlich
    const profile = await memoryStore.getProfile();
    expect(profile.tokens_used_this_month).toBe(replies.reduce((s, m) => s + m.input_tokens + m.output_tokens, 0));
  });

  it("T-SEC-35: ein anderer Nutzer kann fremde Nachrichten nicht bewerten und nicht lesen", async () => {
    const room = await demoRoom("round-robin");
    const msg = await userMessage(room.id, "Geheim");
    const other = createMemoryStore("cccccccc-cccc-4ccc-8ccc-cccccccccccc");
    await expect(other.setMessageStance(msg.id, "disagree", "x")).rejects.toThrow();
    expect(await other.listMessages(room.id)).toEqual([]);
  });
});
