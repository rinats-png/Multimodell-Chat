import { beforeEach, describe, expect, it } from "vitest";
import { POST as applyCouncil } from "@/app/api/rooms/[roomId]/council/route";
import { COUNCIL_PRESETS, getCouncilPreset } from "@/lib/council-presets";
import { isPlatformModel } from "@/lib/models";
import { checkPromptInjection } from "@/lib/prompt-firewall";
import { createMemoryStore, memoryStore, resetMemoryDb } from "@/lib/store/memory-store";
import { agentCreateSchema } from "@/lib/validation";
import { demoRoom, jsonRequest, userMessage } from "./support/fixtures";

const params = (roomId: string) => ({ params: Promise.resolve({ roomId }) });
const UNKNOWN = "11111111-1111-4111-8111-111111111111";
const call = (roomId: string, body: unknown) => applyCouncil(jsonRequest(`/api/rooms/${roomId}/council`, "POST", body), params(roomId));

beforeEach(() => resetMemoryDb());

describe("Vorgefertigte Räte", () => {
  it("jeder Rat ist gültig: Grenzen der Agenten-Felder, Katalog-Modelle, eindeutige Namen, Starttext mit Optionen", () => {
    expect(COUNCIL_PRESETS.length).toBeGreaterThanOrEqual(8);
    expect(new Set(COUNCIL_PRESETS.map((p) => p.id)).size).toBe(COUNCIL_PRESETS.length);
    for (const preset of COUNCIL_PRESETS) {
      expect(preset.agents.length).toBeGreaterThanOrEqual(5);
      expect(preset.agents.length).toBeLessThanOrEqual(12);
      expect(new Set(preset.agents.map((a) => a.display_name)).size).toBe(preset.agents.length);
      for (const agent of preset.agents) {
        expect(isPlatformModel(agent.model_identifier), `${preset.id}/${agent.display_name}: Modell im Katalog`).toBe(true);
        expect(agentCreateSchema.safeParse({ ...agent }).success, `${preset.id}/${agent.display_name}: gültiger Agent`).toBe(true);
      }
      expect(new Set(preset.agents.map((a) => a.model_identifier.split("/")[0])).size).toBeGreaterThanOrEqual(3);
      expect(preset.starter.length).toBeLessThanOrEqual(4000);
      expect(checkPromptInjection(preset.starter).flagged).toBe(false);
      expect(preset.turns).toBeGreaterThanOrEqual(1);
    }
  });

  it("keine Nachbildung echter Personen: weder Namen noch Rollenbeschreibungen nennen bekannte Persönlichkeiten", () => {
    const text = JSON.stringify(COUNCIL_PRESETS);
    expect(text).not.toMatch(/Bezos|Hormozi|Buffett|Musk|Vaynerchuk|Gary V|Graham|Naval|Blakely|Wickman|Martell/i);
  });

  it("setzt einen Rat in einer leeren Debatte ein: Agenten ersetzt, Modus und Turns passend, Starttext geliefert", async () => {
    const room = await demoRoom("round-robin");
    const res = await call(room.id, { preset: "entscheidung" });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { agents: { display_name: string; is_active: boolean }[]; room: { orchestration_mode: string; max_auto_turns: number }; starter: string };
    expect(data.agents.map((a) => a.display_name)).toEqual(getCouncilPreset("entscheidung")!.agents.map((a) => a.display_name));
    // Starter: nur die ersten drei Rollen aktiv, höchstens 3 Turns
    expect(data.agents.filter((a) => a.is_active)).toHaveLength(3);
    expect(data.agents.slice(0, 3).every((a) => a.is_active)).toBe(true);
    expect(data.room.orchestration_mode).toBe("router");
    expect(data.room.max_auto_turns).toBeLessThanOrEqual(3);
    expect(data.starter).toMatch(/Optionen: A\)/);
    expect((await memoryStore.listAgents(room.id)).map((a) => a.display_name)).toEqual(data.agents.map((a) => a.display_name));
  });

  it("Roast: reihum, nur so viele Turns wie aktive Rollen; höherer Tarif schaltet alle Rollen ein", async () => {
    await memoryStore.setTier!("pro");
    const room = await demoRoom("router");
    const data = (await (await call(room.id, { preset: "roast" })).json()) as { agents: { is_active: boolean }[]; room: { orchestration_mode: string; max_auto_turns: number } };
    expect(data.agents.every((a) => a.is_active)).toBe(true);
    expect(data.room.orchestration_mode).toBe("round-robin");
    expect(data.room.max_auto_turns).toBe(5);
  });

  it("in einer Debatte mit Verlauf: 409, nichts verändert", async () => {
    const room = await demoRoom();
    const before = (await memoryStore.listAgents(room.id)).map((a) => a.id);
    await userMessage(room.id, "Schon etwas geschrieben");
    const res = await call(room.id, { preset: "roast" });
    expect(res.status).toBe(409);
    expect((await memoryStore.listAgents(room.id)).map((a) => a.id)).toEqual(before);
  });

  it("unbekannter Rat und unbekannte Felder → 400, unbekannter oder fremder Raum → 404", async () => {
    const room = await demoRoom();
    expect((await call(room.id, { preset: "gibt-es-nicht" })).status).toBe(400);
    expect((await call(room.id, { preset: "roast", user_id: UNKNOWN })).status).toBe(400);
    expect((await call(UNKNOWN, { preset: "roast" })).status).toBe(404);
    expect((await call("keine-uuid", { preset: "roast" })).status).toBe(404);
    // Ein anderer Nutzer sieht den Raum nicht: sein Bestand ist leer
    const other = createMemoryStore("33333333-3333-4333-8333-333333333333");
    expect(await other.getRoom(room.id)).toBeNull();
  });
});
