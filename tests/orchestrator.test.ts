import { describe, expect, it } from "vitest";
import { MAX_OUTPUT_TOKENS } from "@/lib/models";
import { runOrchestration } from "@/lib/orchestrator";
import { memoryStore } from "@/lib/store/memory-store";
import { collector, demoRoom, userMessage } from "./support/fixtures";

describe("Orchestrierung (F-03, F-04)", () => {
  it("TEST-F03-1: Round-Robin – alle aktiven Agenten antworten, Verbrauch wird gebucht", async () => {
    const room = await demoRoom("round-robin");
    const agents = await memoryStore.listAgents(room.id);
    const msg = await userMessage(room.id, "Preise erhöhen?");
    const { events, emit } = collector();
    await runOrchestration({ store: memoryStore, room, agents, forcedAgentId: null, userMessage: msg, allowPlatformKey: false, emit, signal: new AbortController().signal });

    const replies = (await memoryStore.listMessages(room.id)).filter((m) => m.sender_type === "agent");
    expect(replies.map((m) => m.sender_name)).toEqual(["ChatGPT", "Claude", "Gemini"]);
    expect(events.some((e) => e.type === "delta")).toBe(true);
    const profile = await memoryStore.getProfile();
    expect(profile.tokens_used_this_month).toBe(replies.reduce((s, m) => s + m.input_tokens + m.output_tokens, 0));
  });

  it("TEST-F04-1: @Mention übersteuert den Modus – nur der genannte Agent antwortet", async () => {
    const room = await demoRoom("round-robin");
    const agents = await memoryStore.listAgents(room.id);
    const msg = await userMessage(room.id, "@Claude was denkst du?");
    const { emit } = collector();
    await runOrchestration({ store: memoryStore, room, agents, forcedAgentId: null, userMessage: msg, allowPlatformKey: false, emit, signal: new AbortController().signal });
    const replies = (await memoryStore.listMessages(room.id)).filter((m) => m.sender_type === "agent");
    expect(replies.map((m) => m.sender_name)).toEqual(["Claude"]);
  });

  it("TEST-F04-2: Manueller Modus ohne Mention startet keine KI", async () => {
    const room = await demoRoom("manual");
    const agents = await memoryStore.listAgents(room.id);
    const msg = await userMessage(room.id, "Hallo zusammen");
    const { events, emit } = collector();
    await runOrchestration({ store: memoryStore, room, agents, forcedAgentId: null, userMessage: msg, allowPlatformKey: false, emit, signal: new AbortController().signal });
    expect(events.find((e) => e.type === "router")).toBeTruthy();
    expect((await memoryStore.listMessages(room.id)).filter((m) => m.sender_type === "agent")).toHaveLength(0);
  });

  it("TEST-F04-3: Router-Modus begrenzt auf Max-Auto-Turns und begründet die Wahl", async () => {
    const room = await memoryStore.updateRoom((await demoRoom("router")).id, { max_auto_turns: 2 });
    const agents = await memoryStore.listAgents(room.id);
    const msg = await userMessage(room.id, "Welche Datenbank-Architektur?");
    const { events, emit } = collector();
    await runOrchestration({ store: memoryStore, room, agents, forcedAgentId: null, userMessage: msg, allowPlatformKey: false, emit, signal: new AbortController().signal });
    const routerEvents = events.filter((e) => e.type === "router");
    expect(routerEvents).toHaveLength(2);
    // jede Wahl ist begründet
    expect(routerEvents.every((e) => e.type === "router" && e.reason.trim().length > 0)).toBe(true);
    expect((await memoryStore.listMessages(room.id)).filter((m) => m.sender_type === "agent")).toHaveLength(2);
  });

  it("T-SEC-02: Abbruch mitten im Stream bucht den Verbrauch trotzdem (BF-04)", async () => {
    const room = await demoRoom("round-robin");
    const agents = await memoryStore.listAgents(room.id);
    const msg = await userMessage(room.id, "Lange Antwort bitte");
    const controller = new AbortController();
    const { emit } = collector();
    const emitAndAbort = (e: Parameters<typeof emit>[0]) => {
      emit(e);
      if (e.type === "delta") controller.abort();
    };
    await runOrchestration({ store: memoryStore, room, agents, forcedAgentId: null, userMessage: msg, allowPlatformKey: false, emit: emitAndAbort, signal: controller.signal });

    const profile = await memoryStore.getProfile();
    const replies = (await memoryStore.listMessages(room.id)).filter((m) => m.sender_type === "agent");
    expect(replies).toHaveLength(1);
    expect(replies[0]!.content).toContain("abgebrochen");
    // Z14-03: konservativ – mindestens die volle Ausgabe-Reservierung wird gebucht.
    expect(replies[0]!.output_tokens).toBeGreaterThanOrEqual(MAX_OUTPUT_TOKENS);
    expect(profile.tokens_used_this_month).toBe(replies[0]!.input_tokens + replies[0]!.output_tokens);
  });

  it("T-SEC-05: Kontingent erschöpft → kein Modellaufruf, verständlicher Fehler", async () => {
    const room = await demoRoom("round-robin");
    const agents = await memoryStore.listAgents(room.id);
    await memoryStore.incrementTokens(14_999);
    const msg = await userMessage(room.id, "Noch eine Frage");
    const { events, emit } = collector();
    await runOrchestration({ store: memoryStore, room, agents, forcedAgentId: null, userMessage: msg, allowPlatformKey: false, emit, signal: new AbortController().signal });
    const error = events.find((e) => e.type === "error");
    expect(error && "code" in error && error.code).toBe("quota_exceeded");
    expect((await memoryStore.listMessages(room.id)).filter((m) => m.sender_type === "agent")).toHaveLength(0);
  });

  it("T-SEC-03: Plattform-Key + Modell außerhalb des Katalogs → abgelehnt, bevor Kosten entstehen", async () => {
    process.env.OPENROUTER_API_KEY = "sk-or-platform-key-1234567890";
    try {
      const room = await demoRoom("round-robin");
      const [first] = await memoryStore.listAgents(room.id);
      await memoryStore.updateAgent(first!.id, { model_identifier: "openai/o1-pro" });
      const agents = await memoryStore.listAgents(room.id);
      const msg = await userMessage(room.id, "Hallo");
      const { events, emit } = collector();
      await runOrchestration({ store: memoryStore, room, agents, forcedAgentId: null, userMessage: msg, allowPlatformKey: true, emit, signal: new AbortController().signal });
      const error = events.find((e) => e.type === "error");
      expect(error && "code" in error && error.code).toBe("model_not_allowed");
      expect((await memoryStore.getProfile()).tokens_used_this_month).toBe(0);
    } finally {
      delete process.env.OPENROUTER_API_KEY;
    }
  });

  it("T-SEC-09: Tarifgrenzen gelten auch bei manipulierten Raumwerten (Gratis: max. 3 Turns, 3 Agenten)", async () => {
    const room = await memoryStore.updateRoom((await demoRoom("round-robin")).id, { max_auto_turns: 10 });
    for (let i = 0; i < 3; i++) {
      await memoryStore.createAgent({ room_id: room.id, model_identifier: "openai/gpt-4o-mini", display_name: `Extra${i}`, role_title: "x", system_prompt: "Zusätzlicher Agent", is_active: true, sort_order: 10 + i });
    }
    const agents = await memoryStore.listAgents(room.id);
    const msg = await userMessage(room.id, "Alle bitte");
    const { emit } = collector();
    await runOrchestration({ store: memoryStore, room, agents, forcedAgentId: null, userMessage: msg, allowPlatformKey: false, emit, signal: new AbortController().signal });
    const replies = (await memoryStore.listMessages(room.id)).filter((m) => m.sender_type === "agent");
    expect(replies).toHaveLength(3);
    expect(replies.some((m) => m.sender_name.startsWith("Extra"))).toBe(false);
  });

  it("TEST-F06-1: Langzeitgedächtnis fasst herausgefallene Nachrichten zusammen (ab Pro)", async () => {
    await memoryStore.setTier!("pro");
    const room = await memoryStore.updateRoom((await demoRoom("round-robin")).id, { sliding_window_size: 4, max_auto_turns: 3 });
    const agents = await memoryStore.listAgents(room.id);
    for (let i = 0; i < 2; i++) {
      const msg = await userMessage(room.id, `Runde ${i}`);
      const { emit } = collector();
      const fresh = (await memoryStore.getRoom(room.id))!;
      await runOrchestration({ store: memoryStore, room: fresh, agents, forcedAgentId: null, userMessage: msg, allowPlatformKey: false, emit, signal: new AbortController().signal });
    }
    const after = (await memoryStore.getRoom(room.id))!;
    expect(after.running_summary.length).toBeGreaterThan(0);
    expect(after.summarized_message_count).toBe(8 - 4);
  });

  it("TEST-F06-2: Im Gratis-Tarif entsteht kein Langzeitgedächtnis", async () => {
    const room = await memoryStore.updateRoom((await demoRoom("round-robin")).id, { sliding_window_size: 2 });
    const agents = await memoryStore.listAgents(room.id);
    const msg = await userMessage(room.id, "Hallo");
    const { emit } = collector();
    await runOrchestration({ store: memoryStore, room, agents, forcedAgentId: null, userMessage: msg, allowPlatformKey: false, emit, signal: new AbortController().signal });
    expect((await memoryStore.getRoom(room.id))!.running_summary).toBe("");
  });
});
