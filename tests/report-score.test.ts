import { describe, expect, it } from "vitest";
import type { RawReport } from "@/lib/report/schema";
import { reportSchema } from "@/lib/report/schema";
import { ReportScoringError, scoreReport, verdictForScore } from "@/lib/report/score";

const base: Omit<RawReport, "options"> = {
  question: "Preis erhöhen?",
  agreements: ["Alle sehen Spielraum"],
  disagreements: [],
  strongestObjection: { agent: "Claude", text: "Kunden könnten abspringen." },
  conditions: ["Test mit 10 Kunden"],
  nextSteps: ["Diese Woche testen"],
  cheapestTest: "Zehn Bestandskunden fragen.",
  killCriteria: "Mehr als 3 kündigen.",
  assumptions: [],
};
const raw = (a: [string, number][], b: [string, number][]): RawReport => ({
  ...base,
  options: [
    { id: "A", label: "Erhöhen", scores: a.map(([agent, score]) => ({ agent, score })), objections: [] },
    { id: "B", label: "Lassen", scores: b.map(([agent, score]) => ({ agent, score })), objections: [] },
  ],
});
const names = ["ChatGPT", "Claude", "Gemini"];

describe("Entscheidungsbericht: Punkte (F-21)", () => {
  it("Bänder: 7,5 GO · 6 mit Bedingungen · 4,5 umbauen · darunter nicht empfohlen", () => {
    expect(verdictForScore(7.5)).toBe("GO");
    expect(verdictForScore(7.4)).toBe("GO_WITH_CONDITIONS");
    expect(verdictForScore(6)).toBe("GO_WITH_CONDITIONS");
    expect(verdictForScore(5.9)).toBe("RESHAPE");
    expect(verdictForScore(4.5)).toBe("RESHAPE");
    expect(verdictForScore(4.4)).toBe("DONT");
  });

  it("Der Durchschnitt je Option und die Empfehlung kommen aus den Wertungen, nicht vom Modell", () => {
    const r = scoreReport(raw([["ChatGPT", 8], ["Claude", 7], ["Gemini", 9]], [["ChatGPT", 3], ["Claude", 4], ["Gemini", 2]]), names);
    expect(r.options.find((o) => o.id === "A")!.score).toBe(8);
    expect(r.options.find((o) => o.id === "B")!.score).toBe(3);
    expect(r.recommendedOptionId).toBe("A");
    expect(r.verdict).toBe("GO");
    expect(r.spread).toBe(2);
    expect(r.agreement).toBe(8);
    expect(r.capReason).toBeNull();
  });

  it("Erfundene Namen und doppelte Wertungen zählen nicht; Werte werden begrenzt", () => {
    const r = scoreReport(raw([["ChatGPT", 8], ["chatgpt", 2], ["Erfunden", 10], ["Claude", 14], ["Gemini", -3]], [["ChatGPT", 5], ["Claude", 5]]), names);
    const a = r.options.find((o) => o.id === "A")!;
    expect(a.scores.map((s) => s.agent)).toEqual(["ChatGPT", "Claude", "Gemini"]);
    expect(a.scores.map((s) => s.score)).toEqual([8, 10, 0]);
  });

  it("Starker Widerspruch deckelt GO auf „mit Bedingungen“ und sagt warum", () => {
    const r = scoreReport(raw([["ChatGPT", 10], ["Claude", 2], ["Gemini", 10]], [["ChatGPT", 1], ["Claude", 1], ["Gemini", 1]]), names);
    expect(r.options.find((o) => o.id === "A")!.score).toBe(7.3);
    // 7,3 liegt schon im Band „mit Bedingungen“: kein Deckel nötig, aber die Streuung bleibt sichtbar
    expect(r.verdict).toBe("GO_WITH_CONDITIONS");
    const strong = scoreReport(raw([["ChatGPT", 10], ["Claude", 3], ["Gemini", 10], ["Extra", 10]], [["ChatGPT", 1], ["Claude", 1]]), [...names, "Extra"]);
    expect(strong.options.find((o) => o.id === "A")!.score).toBe(8.3);
    expect(strong.verdict).toBe("GO_WITH_CONDITIONS");
    expect(strong.capReason).toMatch(/begrenzt/);
    expect(strong.spread).toBe(7);
  });

  it("Gleichstand: die Option mit dem besseren schlechtesten Wert gewinnt", () => {
    const r = scoreReport(raw([["ChatGPT", 9], ["Claude", 3]], [["ChatGPT", 6], ["Claude", 6]]), names);
    expect(r.recommendedOptionId).toBe("B");
  });

  it("Zu wenige Wertungen → klarer Fehler statt erfundener Zahlen", () => {
    expect(() => scoreReport(raw([["ChatGPT", 8]], [["Claude", 5]]), names)).toThrow(ReportScoringError);
    expect(() => scoreReport(raw([["Niemand", 8], ["Keiner", 5]], [["Wer", 5], ["Was", 4]]), names)).toThrow(/Zu wenige Wertungen/);
  });

  it("Das Ergebnis passt zum gespeicherten Schema", () => {
    const scored = scoreReport(raw([["ChatGPT", 8], ["Claude", 7]], [["ChatGPT", 3], ["Claude", 4]]), names);
    const parsed = reportSchema.safeParse({ version: 1, generatedAt: new Date().toISOString(), simulated: false, agents: names, ...scored });
    expect(parsed.success).toBe(true);
  });
});
