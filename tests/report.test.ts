import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Berichtsanfrage ersetzen: kein Netz, feste Wertungen und Token-Zahlen (3.000 Eingabe, 900 Ausgabe).
const RAW = {
  question: "Soll der Preis für alle steigen?",
  options: [
    { id: "A", label: "Für alle erhöhen", scores: [{ agent: "ChatGPT", score: 8 }, { agent: "Claude", score: 6 }, { agent: "Gemini", score: 7 }], objections: ["Kündigungen möglich"] },
    { id: "B", label: "Preis lassen", scores: [{ agent: "ChatGPT", score: 3 }, { agent: "Claude", score: 4 }, { agent: "Gemini", score: 3 }], objections: [] },
  ],
  agreements: ["Der Preis ist niedrig"],
  disagreements: [{ topic: "Tempo", positions: [{ agent: "Claude", position: "Erst testen" }] }],
  strongestObjection: { agent: "Claude", text: "Bestandskunden könnten abspringen." },
  conditions: ["Test mit zehn Kunden"],
  nextSteps: ["Diese Woche zehn Kunden fragen"],
  cheapestTest: "Zehn Bestandskunden fragen.",
  killCriteria: "Mehr als drei kündigen.",
  assumptions: ["Abschlussquote bleibt gleich"],
};
vi.mock("ai", async (importOriginal) => {
  const original = await importOriginal<typeof import("ai")>();
  return { ...original, generateObject: async () => ({ object: RAW, usage: { inputTokens: 3000, outputTokens: 900 } }) };
});

import { POST as createReportRoute } from "@/app/api/rooms/[roomId]/report/route";
import { DELETE as deleteReportRoute } from "@/app/api/reports/[reportId]/route";
import { POST as shareRoute } from "@/app/api/reports/[reportId]/share/route";
import { DECISION_TEMPLATES } from "@/lib/decision-templates";
import { SUMMARY_MODEL } from "@/lib/ai/provider";
import { estimateCostUsd } from "@/lib/models";
import { platformBudget } from "@/lib/platform-budget";
import { checkPromptInjection } from "@/lib/prompt-firewall";
import { runOrchestration } from "@/lib/orchestrator";
import { createReportForRoom } from "@/lib/report/service";
import { getPublicReport, hashShareToken, newShareToken } from "@/lib/report/shared";
import { createMemoryStore, memoryStore, resetMemoryDb, resetPlatformSpend } from "@/lib/store/memory-store";
import { collector, demoRoom, jsonRequest, userMessage } from "./support/fixtures";

const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });
const UNKNOWN = "11111111-1111-4111-8111-111111111111";
const OTHER_VISITOR = "22222222-2222-4222-8222-222222222222";

/** Debatte mit drei Antworten im Demo-Modus (kein Modellaufruf). */
async function debateRoom() {
  const room = await demoRoom("round-robin");
  const agents = await memoryStore.listAgents(room.id);
  const msg = await userMessage(room.id, "Preis für alle erhöhen oder lassen?");
  await runOrchestration({ store: memoryStore, room, agents, forcedAgentId: null, userMessage: msg, allowPlatformKey: false, emit: collector().emit, signal: new AbortController().signal });
  return { room, agents };
}

beforeEach(() => {
  resetMemoryDb();
  resetPlatformSpend();
});
afterEach(() => {
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.APP_ORIGIN;
});

describe("Entscheidungsbericht erstellen (F-21)", () => {
  it("ohne Debatte: 400, mit unbekanntem Raum: 404", async () => {
    const room = await demoRoom();
    const empty = await createReportRoute(jsonRequest(`/api/rooms/${room.id}/report`, "POST"), params({ roomId: room.id }));
    expect(empty.status).toBe(400);
    expect(((await empty.json()) as { code: string }).code).toBe("not_enough_debate");
    expect((await createReportRoute(jsonRequest(`/api/rooms/${UNKNOWN}/report`, "POST"), params({ roomId: UNKNOWN }))).status).toBe(404);
    expect((await createReportRoute(jsonRequest("/api/rooms/x/report", "POST"), params({ roomId: "keine-uuid" }))).status).toBe(404);
  });

  it("Demo ohne Zugang: ein als Muster gekennzeichneter Bericht, ohne Modellaufruf und ohne Verbrauch", async () => {
    const { room } = await debateRoom();
    const before = (await memoryStore.getProfile()).tokens_used_this_month;
    const res = await createReportRoute(jsonRequest(`/api/rooms/${room.id}/report`, "POST"), params({ roomId: room.id }));
    expect(res.status).toBe(201);
    const { report } = (await res.json()) as { report: { id: string } };
    const stored = (await memoryStore.getReport(report.id))!;
    expect(stored.report.simulated).toBe(true);
    expect(stored.report.options.length).toBeGreaterThanOrEqual(2);
    expect(stored.report.agents).toEqual(["ChatGPT", "Claude", "Gemini"]);
    expect((await memoryStore.getProfile()).tokens_used_this_month).toBe(before);
    expect((await memoryStore.listReports())[0]).toMatchObject({ id: report.id, shared: false });
  });

  it("Starter: höchstens 3 Berichte, der vierte → 402", async () => {
    const { room } = await debateRoom();
    for (let i = 0; i < 3; i++) {
      expect((await createReportRoute(jsonRequest(`/api/rooms/${room.id}/report`, "POST"), params({ roomId: room.id }))).status).toBe(201);
    }
    const res = await createReportRoute(jsonRequest(`/api/rooms/${room.id}/report`, "POST"), params({ roomId: room.id }));
    expect(res.status).toBe(402);
    expect(((await res.json()) as { code: string }).code).toBe("plan_limit");
  });

  it("Eigener Zugang: Bericht vom Modell, Wertungen zu Zahlen gerechnet, nichts gegen Kontingent oder Obergrenze", async () => {
    const { room, agents } = await debateRoom(); // Debatte im Demo-Modus, erst danach den eigenen Zugang setzen
    await memoryStore.setCustomKey("sk-or-v1-abcdefghijklmnop");
    const tokensBefore = (await memoryStore.getProfile()).tokens_used_this_month;
    const stored = await createReportForRoom({ store: memoryStore, room, agents, allowPlatformKey: true, signal: new AbortController().signal });
    expect(stored.report.simulated).toBe(false);
    expect(stored.report.recommendedOptionId).toBe("A");
    expect(stored.report.options.find((o) => o.id === "A")!.score).toBe(7);
    expect(stored.report.verdict).toBe("GO_WITH_CONDITIONS");
    expect((await memoryStore.getProfile()).tokens_used_this_month).toBe(tokensBefore);
    expect(await memoryStore.getPlatformSpend()).toEqual({ trial_usd: 0, paid_usd: 0 });
  });

  it("Plattform-Key, Starter: nicht vom Testlauf-Kontingent abhängig, aber gebucht und gegen den Testtopf gezählt", async () => {
    process.env.OPENROUTER_API_KEY = "sk-or-platform-key-1234567890";
    const { room, agents } = await debateRoom();
    await memoryStore.incrementTokens(60_000); // Testlauf aufgebraucht
    const stored = await createReportForRoom({ store: memoryStore, room, agents, allowPlatformKey: true, signal: new AbortController().signal });
    expect(stored.report.simulated).toBe(false);
    expect((await memoryStore.getPlatformSpend()).trial_usd).toBeCloseTo(estimateCostUsd(SUMMARY_MODEL, 3000, 900), 6);
  });

  it("Plattform-Key, bezahlter Tarif: das Kontingent gilt (402), die Obergrenze gilt (503)", async () => {
    process.env.OPENROUTER_API_KEY = "sk-or-platform-key-1234567890";
    await memoryStore.setTier!("pro");
    const { room, agents } = await debateRoom();
    const input = { store: memoryStore, room, agents, allowPlatformKey: true, signal: new AbortController().signal };
    await memoryStore.incrementTokens(500_000);
    await expect(createReportForRoom(input)).rejects.toMatchObject({ status: 402, code: "quota_exceeded" });
    resetMemoryDb();
    resetPlatformSpend();
    await memoryStore.setTier!("pro");
    const second = await debateRoom();
    await memoryStore.addPlatformSpend(platformBudget().totalUsd, false);
    await expect(createReportForRoom({ ...input, room: second.room, agents: second.agents })).rejects.toMatchObject({ status: 503, code: "budget_exhausted" });
  });
});

describe("Teilen per Link (T-SEC-43)", () => {
  async function makeReport() {
    const { room } = await debateRoom();
    const res = await createReportRoute(jsonRequest(`/api/rooms/${room.id}/report`, "POST"), params({ roomId: room.id }));
    return ((await res.json()) as { report: { id: string } }).report.id;
  }
  const share = (id: string, enabled: boolean) => shareRoute(jsonRequest(`/api/reports/${id}/share`, "POST", { enabled }), params({ reportId: id }));

  it("Der Link zeigt nur den Bericht; gespeichert wird nur der Hash; der Browser sieht nie Hash oder Raum-Inhalt", async () => {
    process.env.APP_ORIGIN = "https://synthrai.example";
    const id = await makeReport();
    const res = await share(id, true);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const { url } = (await res.json()) as { url: string };
    const token = url.replace("https://synthrai.example/r/", "");
    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);

    const publicView = (await getPublicReport(token))!;
    expect(Object.keys(publicView).sort()).toEqual(["created_at", "report", "title"]);
    expect(JSON.stringify(publicView)).not.toMatch(/room_id|user_id|token_hash/);
    const stored = (await memoryStore.getReport(id))!;
    expect(stored.shared).toBe(true);
    expect(JSON.stringify(stored)).not.toContain(token);
    expect(JSON.stringify(stored)).not.toContain(hashShareToken(token));
  });

  it("Falsche, ungültige und fremde Token liefern nichts", async () => {
    const id = await makeReport();
    await share(id, true);
    expect(await getPublicReport(newShareToken())).toBeNull();
    for (const bad of ["", "kurz", "x".repeat(33), "../../etc/passwd", "a".repeat(31) + "!"]) expect(await getPublicReport(bad)).toBeNull();
  });

  it("Widerruf macht den Link sofort ungültig; ein neuer Link ersetzt den alten", async () => {
    const id = await makeReport();
    const first = ((await (await share(id, true)).json()) as { url: string }).url.split("/r/")[1]!;
    expect(await getPublicReport(first)).not.toBeNull();
    const second = ((await (await share(id, true)).json()) as { url: string }).url.split("/r/")[1]!;
    expect(second).not.toBe(first);
    expect(await getPublicReport(first)).toBeNull();
    expect(await getPublicReport(second)).not.toBeNull();
    expect(((await (await share(id, false)).json()) as { shared: boolean }).shared).toBe(false);
    expect(await getPublicReport(second)).toBeNull();
    expect((await memoryStore.getReport(id))!.shared).toBe(false);
  });

  it("Löschen entfernt Bericht und Link", async () => {
    const id = await makeReport();
    const token = ((await (await share(id, true)).json()) as { url: string }).url.split("/r/")[1]!;
    expect((await deleteReportRoute(jsonRequest(`/api/reports/${id}`, "DELETE"), params({ reportId: id }))).status).toBe(204);
    expect(await memoryStore.getReport(id)).toBeNull();
    expect(await getPublicReport(token)).toBeNull();
    expect((await deleteReportRoute(jsonRequest(`/api/reports/${id}`, "DELETE"), params({ reportId: id }))).status).toBe(404);
  });

  it("Das Löschen der Debatte entfernt ihre Berichte samt Link", async () => {
    const { room } = await debateRoom();
    const res = await createReportRoute(jsonRequest(`/api/rooms/${room.id}/report`, "POST"), params({ roomId: room.id }));
    const id = ((await res.json()) as { report: { id: string } }).report.id;
    const token = ((await (await share(id, true)).json()) as { url: string }).url.split("/r/")[1]!;
    await memoryStore.deleteRoom(room.id);
    expect(await memoryStore.listReports()).toHaveLength(0);
    expect(await getPublicReport(token)).toBeNull();
  });

  it("Unbekannte, ungültige und fremde IDs: 404 ohne Details; ein anderer Nutzer kann nichts lesen, teilen oder löschen", async () => {
    for (const id of [UNKNOWN, "keine-uuid", "' OR 1=1 --"]) {
      expect((await share(id, true)).status).toBe(404);
      expect((await deleteReportRoute(jsonRequest(`/api/reports/${id}`, "DELETE"), params({ reportId: id }))).status).toBe(404);
    }
    const id = await makeReport();
    const other = createMemoryStore(OTHER_VISITOR);
    expect(await other.getReport(id)).toBeNull();
    expect(await other.listReports()).toHaveLength(0);
    expect(await other.deleteReport(id)).toBe(false);
    expect(await other.setReportShare(id, hashShareToken(newShareToken()))).toBe(false);
    expect(await memoryStore.getReport(id)).not.toBeNull();
    expect((await memoryStore.getReport(id))!.shared).toBe(false);
  });

  it("Ungültige Eingaben beim Teilen: unbekannte Felder → 400", async () => {
    const id = await makeReport();
    const res = await shareRoute(jsonRequest(`/api/reports/${id}/share`, "POST", { enabled: true, user_id: UNKNOWN }), params({ reportId: id }));
    expect(res.status).toBe(400);
  });

  it("Der Konto-Export enthält die Berichte ohne Freigabe-Hash", async () => {
    const id = await makeReport();
    await share(id, true);
    const exported = await memoryStore.exportAccount();
    expect(exported.reports.map((r) => r.id)).toEqual([id]);
    expect(JSON.stringify(exported.reports)).not.toMatch(/token_hash/);
  });
});

describe("Entscheidungsvorlagen", () => {
  it("jede Vorlage nennt Optionen A bis C, bittet um Wertungen, passt in die Eingabegrenze und löst die Prompt-Prüfung nicht aus", () => {
    expect(DECISION_TEMPLATES.length).toBeGreaterThanOrEqual(5);
    const ids = new Set<string>();
    for (const t of DECISION_TEMPLATES) {
      ids.add(t.id);
      expect(t.text).toMatch(/A\)/);
      expect(t.text).toMatch(/B\)/);
      expect(t.text).toMatch(/C\)/);
      expect(t.text).toMatch(/Zahl von 0 bis 10/);
      expect(t.text.length).toBeLessThanOrEqual(4000);
      expect(checkPromptInjection(t.text).flagged).toBe(false);
    }
    expect(ids.size).toBe(DECISION_TEMPLATES.length);
  });
});
