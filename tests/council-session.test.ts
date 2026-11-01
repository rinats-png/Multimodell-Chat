import { beforeEach, describe, expect, it, vi } from "vitest";

// Modellaufruf ersetzen: kein Netz; jede Antwort enthält eine Wertung, und die Aufrufe werden aufgezeichnet.
const calls: { system: string }[] = [];
vi.mock("ai", async (importOriginal) => {
  const original = await importOriginal<typeof import("ai")>();
  return {
    ...original,
    streamText: (args: { system: string }) => {
      calls.push({ system: args.system });
      return {
        textStream: (async function* () {
          yield "Meine Antwort aus der Rolle. Wertung: A 7, B 3.";
        })(),
        usage: Promise.resolve({ inputTokens: 100, outputTokens: 50 }),
      };
    },
  };
});

import { POST as orchestrate } from "@/app/api/orchestrate/route";
import { buildAgentMessages } from "@/lib/context-builder";
import { COUNCIL_ROUNDS, councilRoundLabel, councilWindowSize } from "@/lib/council-session";
import { memoryStore, resetMemoryDb, resetPlatformSpend } from "@/lib/store/memory-store";
import type { OrchestrateEvent } from "@/lib/types";
import { demoRoom, jsonRequest, readNdjson } from "./support/fixtures";

const UNKNOWN = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  resetMemoryDb();
  resetPlatformSpend();
  calls.length = 0;
});

async function round(roomId: string, round: number, content?: string) {
  const res = await orchestrate(jsonRequest("/api/orchestrate", "POST", { roomId, round, ...(content ? { content } : {}) }));
  return { res, events: res.status === 200 ? await readNdjson(res) : ([] as OrchestrateEvent[]) };
}
const replies = async (roomId: string) => (await memoryStore.listMessages(roomId)).filter((m) => m.sender_type === "agent");

describe("Ratssitzung (F-23)", () => {
  it("die Aufgabe der Runde steht nur dann im Prompt, wenn sie gesetzt ist", async () => {
    const room = await demoRoom();
    const [agent] = await memoryStore.listAgents(room.id);
    const plain = buildAgentMessages(agent!, [], 12, {});
    const withTask = buildAgentMessages(agent!, [], 12, { roundInstruction: COUNCIL_ROUNDS[2].instruction });
    expect(plain.system).not.toContain("Deine Aufgabe in dieser Runde");
    expect(withTask.system).toContain("## Deine Aufgabe in dieser Runde");
    expect(withTask.system).toContain("Runde 2 von 3: Streit");
  });

  it("jede Runde bittet um eine Wertung; Runde 3 ist die kürzeste und endgültige", () => {
    for (const r of [1, 2, 3] as const) expect(COUNCIL_ROUNDS[r].instruction).toMatch(/Wertung: A x, B y, C z/);
    expect(COUNCIL_ROUNDS[3].instruction).toMatch(/höchstens 70 Wörtern/);
    expect(COUNCIL_ROUNDS[3].instruction).toMatch(/endgültige Wertung/);
    expect(councilRoundLabel(2)).toBe("Runde 2 von 3: Streit");
  });

  it("das Kontextfenster wächst mit der Zahl der KIs, bleibt aber im Rahmen des Tarifs", () => {
    expect(councilWindowSize(12, 3, 12)).toBe(12); // 3 KIs brauchen 11 Nachrichten, das Fenster von 12 reicht
    expect(councilWindowSize(12, 6, 40)).toBe(20);
    expect(councilWindowSize(12, 6, 12)).toBe(12);
    expect(councilWindowSize(30, 2, 40)).toBe(30);
  });

  it("drei Runden: jede aktive KI antwortet je Runde einmal, in der Reihenfolge des Studios; die Aufgaben wechseln", async () => {
    const room = await demoRoom("router");
    const names = (await memoryStore.listAgents(room.id)).map((a) => a.display_name);
    for (const n of [1, 2, 3]) {
      const { res, events } = await round(room.id, n, n === 1 ? "Preis erhöhen: A) ja, B) nein?" : undefined);
      expect(res.status).toBe(200);
      expect(events.find((e) => e.type === "router" && e.reason === councilRoundLabel(n as 1 | 2 | 3))).toBeTruthy();
      expect(events.some((e) => e.type === "error")).toBe(false);
      expect((await replies(room.id)).slice(-names.length).map((m) => m.sender_name)).toEqual(names);
    }
    expect(await replies(room.id)).toHaveLength(names.length * 3);
    // Reihenfolge der Aufgaben in den Modellaufrufen
    const tasks = calls.map((c) => /Runde (\d) von 3/.exec(c.system)?.[1]);
    expect(tasks.slice(0, 3)).toEqual(["1", "1", "1"]);
    expect(tasks.slice(3, 6)).toEqual(["2", "2", "2"]);
    expect(tasks.slice(6, 9)).toEqual(["3", "3", "3"]);
  });

  it("der Verbrauch wird gebucht, und das Minutenlimit des Starters (5/min) blockiert die Antworten innerhalb der Runden nicht", async () => {
    const room = await demoRoom("router");
    for (const n of [1, 2, 3]) {
      const { events } = await round(room.id, n, n === 1 ? "Frage" : undefined);
      expect(events.some((e) => e.type === "error")).toBe(false);
    }
    expect((await memoryStore.getProfile()).tokens_used_this_month).toBeGreaterThanOrEqual(9 * 150);
  });

  it("ist das Kontingent mittendrin aufgebraucht, endet die Runde mit klarem Fehler und ohne weitere Antworten", async () => {
    const room = await demoRoom("router");
    await memoryStore.incrementTokens(59_800);
    const { events } = await round(room.id, 1, "Frage");
    const error = events.find((e) => e.type === "error");
    expect(error && "code" in error && error.code).toBe("quota_exceeded");
    expect((await replies(room.id)).length).toBeLessThan(3);
  });

  it("weniger als zwei aktive KIs: Fehler statt Sitzung", async () => {
    const room = await demoRoom("router");
    const agents = await memoryStore.listAgents(room.id);
    for (const a of agents.slice(1)) await memoryStore.updateAgent(a.id, { is_active: false });
    const { events } = await round(room.id, 1, "Frage");
    const error = events.find((e) => e.type === "error");
    expect(error && "code" in error && error.code).toBe("council_needs_agents");
    expect(await replies(room.id)).toHaveLength(0);
  });

  it("Eingaben: Runde und Agent schließen sich aus, nur Runde 1 nimmt eine Nachricht, Runde 1 braucht sie, Runde nur 1 bis 3", async () => {
    const room = await demoRoom("router");
    const agent = (await memoryStore.listAgents(room.id))[0]!;
    const bad = async (body: unknown) => (await orchestrate(jsonRequest("/api/orchestrate", "POST", body))).status;
    expect(await bad({ roomId: room.id, round: 1, content: "x", agentId: agent.id })).toBe(400);
    expect(await bad({ roomId: room.id, round: 2, content: "heimliche Nachricht" })).toBe(400);
    expect(await bad({ roomId: room.id, round: 1 })).toBe(400);
    expect(await bad({ roomId: room.id, round: 4 })).toBe(400);
    expect(await bad({ roomId: room.id, round: 0 })).toBe(400);
    expect(await bad({ roomId: room.id, round: "1" })).toBe(400);
    expect(await replies(room.id)).toHaveLength(0);
    expect((await round(UNKNOWN, 2)).res.status).toBe(404);
  });

  it("Starts von Ratssitzungen sind pro Konto begrenzt (6 je Stunde), spätere Runden zählen nicht", async () => {
    await memoryStore.setTier!("pro");
    const room = await demoRoom("router");
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) statuses.push((await round(room.id, 1, `Frage ${i}`)).res.status);
    expect(statuses.slice(0, 6)).toEqual([200, 200, 200, 200, 200, 200]);
    expect(statuses[6]).toBe(429);
    expect((await round(room.id, 2)).res.status).toBe(200);
  });
});
