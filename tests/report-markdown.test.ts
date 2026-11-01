import { describe, expect, it } from "vitest";
import { reportFileName, reportToMarkdown } from "@/lib/report/markdown";
import { reportSchema, type DecisionReport } from "@/lib/report/schema";
import { scoreReport } from "@/lib/report/score";

const names = ["ChatGPT", "Claude", "Gemini"];
const scored = scoreReport(
  {
    question: "Preis | erhöhen?",
    options: [
      { id: "A", label: "Erhöhen | sofort", scores: names.map((agent, i) => ({ agent, score: 8 - i })), objections: [] },
      { id: "B", label: "Lassen", scores: names.map((agent) => ({ agent, score: 3 })), objections: [] },
    ],
    agreements: ["Alle sehen Spielraum"],
    disagreements: [{ topic: "Tempo", positions: [{ agent: "Claude", position: "Erst testen" }] }],
    strongestObjection: { agent: "Claude", text: "Kunden könnten\nabspringen." },
    conditions: ["Test mit 10 Kunden"],
    nextSteps: ["Diese Woche testen"],
    cheapestTest: "Zehn Bestandskunden fragen.",
    killCriteria: "Mehr als 3 kündigen.",
    assumptions: ["Kunden vergleichen kaum"],
  },
  names,
);
const report: DecisionReport = reportSchema.parse({ ...scored, version: 1, generatedAt: "2026-11-01T10:00:00Z", simulated: false, agents: names });

describe("Bericht als Markdown (idea-to-app ENTSCHEIDUNGEN.md)", () => {
  const md = reportToMarkdown("Preis erhöhen", report, "2026-11-01T10:00:00Z");

  it("enthält einen Entscheidungseintrag mit ID, Empfehlung, verworfener Alternative und offener Annahme", () => {
    expect(md).toContain("## Eintrag für ENTSCHEIDUNGEN.md");
    const row = md.split("\n").find((l) => l.startsWith("| E-001 |"))!;
    expect(row).toContain("2026-11-01");
    expect(row).toContain("A) Erhöhen \\| sofort");
    expect(row).toContain("B) Lassen (3.0)");
    expect(md).toContain("| A-001 | Kunden vergleichen kaum | nein |");
  });

  it("Pipes und Zeilenumbrüche zerstören die Tabellen nicht", () => {
    for (const l of md.split("\n").filter((x) => x.startsWith("| E-001"))) {
      expect(l.replace(/\\\|/g, "").split("|").length).toBe(8);
    }
    expect(md).toContain("Kunden könnten abspringen.");
    expect(md).toContain("| A) Erhöhen \\| sofort | 7.0 | 8 | 7 | 6 |");
  });

  it("Dateiname ohne Sonderzeichen", () => {
    expect(reportFileName("Preis erhöhen: Ja/Nein?", "2026-11-01T10:00:00Z")).toBe("bericht-preis-erhoehen-ja-nein-2026-11-01.md");
    expect(reportFileName("!!!", "2026-11-01")).toBe("bericht-bericht-2026-11-01.md");
  });
});
