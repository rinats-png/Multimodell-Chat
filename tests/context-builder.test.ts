import { describe, expect, it } from "vitest";
import { buildAgentMessages, estimatePromptTokens, stripSpeakerPrefix } from "@/lib/context-builder";
import type { ChatMessage, RoomAgent } from "@/lib/types";

const agent = (id: string, name: string): RoomAgent => ({
  id,
  room_id: "r",
  model_identifier: "openai/gpt-4o",
  display_name: name,
  role_title: `${name}-Rolle`,
  system_prompt: `Du bist ${name}.`,
  is_active: true,
  sort_order: 0,
});
const claude = agent("a-claude", "Claude");
const gpt = agent("a-gpt", "ChatGPT");

let n = 0;
const msg = (partial: Partial<ChatMessage>): ChatMessage => ({
  id: `m${++n}`,
  room_id: "r",
  sender_type: "user",
  agent_id: null,
  sender_name: "Du",
  content: "Hallo",
  input_tokens: 0,
  output_tokens: 0,
  estimated_cost_usd: 0,
  stance: null,
  stance_target_id: null,
  created_at: new Date(2026, 0, 1, 0, 0, n).toISOString(),
  ...partial,
});

describe("buildAgentMessages – Perspektiven-Umkehr (F-05)", () => {
  it("TEST-F05-1: eigene Antworten → assistant, Mensch und andere KIs → user mit Sprecher-Präfix", () => {
    const history = [
      msg({ content: "Frage?" }),
      msg({ sender_type: "agent", agent_id: gpt.id, sender_name: "ChatGPT", content: "MVP!" }),
      msg({ sender_type: "agent", agent_id: claude.id, sender_name: "Claude", content: "Widerspruch." }),
      msg({ content: "Und jetzt?" }),
    ];
    const prompt = buildAgentMessages(claude, history, 12, { agents: [claude, gpt] });
    expect(prompt.messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(prompt.messages[0]!.content).toContain("[Mensch – Du]: Frage?");
    expect(prompt.messages[0]!.content).toContain("[KI – ChatGPT]: MVP!");
    expect(prompt.messages[1]!.content).toBe("Widerspruch.");
    expect(prompt.system).toContain("NIEMALS mit deinem eigenen Namen");
    expect(prompt.system).toContain("ChatGPT: ChatGPT-Rolle");
  });

  it("TEST-F05-2: Sliding Window schneidet auf die letzten N Nachrichten", () => {
    const history = Array.from({ length: 10 }, (_, i) => msg({ content: `N${i}` }));
    const prompt = buildAgentMessages(claude, history, 3);
    const text = prompt.messages.map((m) => m.content).join("\n");
    expect(text).not.toContain("N6");
    expect(text).toContain("N7");
    expect(text).toContain("N9");
  });

  it("TEST-F05-3: Prompt beginnt und endet immer mit user (strikte Provider)", () => {
    const history = [msg({ sender_type: "agent", agent_id: claude.id, sender_name: "Claude", content: "Eigene Antwort" })];
    const prompt = buildAgentMessages(claude, history, 12);
    expect(prompt.messages[0]!.role).toBe("user");
    expect(prompt.messages.at(-1)!.role).toBe("user");
  });

  it("T-SEC-08: Kontext wird auf das Token-Budget gekürzt, älteste Nachrichten fallen zuerst", () => {
    const big = "x".repeat(8_000); // ≈ 2.000 Tokens
    const history = Array.from({ length: 20 }, (_, i) => msg({ content: `${i}:${big}` }));
    const prompt = buildAgentMessages(claude, history, 40, { maxInputTokens: 6_000 });
    expect(estimatePromptTokens(prompt)).toBeLessThanOrEqual(6_000);
    expect(prompt.messages.at(-1)!.content).toContain("19:");
  });

  it("T-SEC-08: auch eine einzelne riesige Nachricht wird auf das Budget gekürzt", () => {
    const prompt = buildAgentMessages(claude, [msg({ content: "y".repeat(100_000) })], 40, { maxInputTokens: 6_000 });
    expect(estimatePromptTokens(prompt)).toBeLessThanOrEqual(6_000);
    expect(prompt.messages.at(-1)!.content).toContain("[gekürzt]");
  });

  it("entfernt ein vom Modell vorangestelltes [Name]:-Präfix", () => {
    expect(stripSpeakerPrefix("[Claude]: Hallo")).toBe("Hallo");
    expect(stripSpeakerPrefix("Kein [Präfix]: hier")).toBe("Kein [Präfix]: hier");
  });

  it("Langzeitgedächtnis steht im System-Prompt", () => {
    const prompt = buildAgentMessages(claude, [msg({})], 12, { runningSummary: "Bisher: Streit über MVP." });
    expect(prompt.system).toContain("Bisher: Streit über MVP.");
  });
});
