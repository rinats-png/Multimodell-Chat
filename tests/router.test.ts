import { describe, expect, it } from "vitest";
import { findMentionedAgent, heuristicRoute } from "@/lib/router";
import type { ChatMessage, RoomAgent } from "@/lib/types";

const agents: RoomAgent[] = ["openai/gpt-4o", "anthropic/claude-3.5-sonnet", "google/gemini-2.5-pro"].map((model, i) => ({
  id: `a${i}`,
  room_id: "r",
  model_identifier: model,
  display_name: ["ChatGPT", "Claude", "Gemini"][i]!,
  role_title: ["Produkt-Stratege", "Kritischer Architekt", "Kreativer Synthesizer"][i]!,
  system_prompt: "x".repeat(20),
  is_active: true,
  sort_order: i,
}));

const reply = (agentIdx: number, content: string): ChatMessage => ({
  id: `m${agentIdx}`,
  room_id: "r",
  sender_type: "agent",
  agent_id: agents[agentIdx]!.id,
  sender_name: agents[agentIdx]!.display_name,
  content,
  input_tokens: 0,
  output_tokens: 0,
  estimated_cost_usd: 0,
  stance: null,
  stance_target_id: null,
  created_at: "2026-10-30T00:00:00Z",
});

describe("Moderator-Heuristik (F-04)", () => {
  it("TEST-F04-4: wählt nie dieselbe KI zweimal in Folge – auch wenn ihr eigener Text zum Thema passt", () => {
    for (let turn = 0; turn < 5; turn++) {
      const decision = heuristicRoute([reply(2, "Mein Fazit: kreative Alternative")], agents, turn);
      expect(decision.nextSpeakerId).not.toBe("a2");
      expect(decision.reason).toBe("Nächste Perspektive in der Runde");
    }
  });

  it("wählt nach Themen: Architektur → Claude, Business → ChatGPT", () => {
    const user = (content: string): ChatMessage => ({ ...reply(0, content), sender_type: "user", agent_id: null, sender_name: "Du" });
    expect(heuristicRoute([user("Welche Datenbank-Architektur?")], agents, 0).nextSpeakerId).toBe("a1");
    expect(heuristicRoute([user("Wie bepreisen wir das für Kunden?")], agents, 0).nextSpeakerId).toBe("a0");
  });

  it("@Mention findet Agenten auch mit Präfix und Groß-/Kleinschreibung", () => {
    expect(findMentionedAgent("Was meinst du, @gem?", agents)?.id).toBe("a2");
    expect(findMentionedAgent("ohne Erwähnung", agents)).toBeNull();
  });
});

describe("Moderator bei Streit (F-19)", () => {
  it("TEST-F19-5: nach einem Widerspruch wählt die Heuristik die dritte KI", () => {
    const fight = { ...reply(1, "Das halte ich für zu knapp."), stance: "disagree" as const, stance_target_id: agents[0]!.id };
    const decision = heuristicRoute([fight], agents, 0);
    expect(decision.nextSpeakerId).toBe(agents[2]!.id);
    expect(decision.reason).toMatch(/Streit/);
  });

  it("TEST-F19-6: ohne Widerspruch bleibt die bisherige Wahl unverändert", () => {
    const calm = { ...reply(1, "Einverstanden."), stance: "agree" as const, stance_target_id: agents[0]!.id };
    expect(heuristicRoute([calm], agents, 0).reason).not.toMatch(/Streit/);
  });
});
