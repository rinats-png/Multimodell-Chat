import { z } from "zod";

/**
 * Entscheidungsbericht (F-21). Zwei Stufen:
 * - `rawReportSchema`: was das Modell liefert (Optionen, Wertungen je KI, Widersprüche, Einwand, nächste Schritte).
 * - `reportSchema`: der gespeicherte Bericht. Zahlen (Durchschnitt, Urteil, Einigkeit) rechnet die App aus den
 *   Wertungen (lib/report/score.ts), das Modell erfindet sie nicht.
 * Jeder Text ist begrenzt; der Bericht wird beim Lesen erneut geprüft, auch in der öffentlichen Ansicht.
 */
const text = (max: number) => z.string().trim().min(1).max(max);

export const OPTION_IDS = ["A", "B", "C", "D", "E"] as const;
export const VERDICTS = ["GO", "GO_WITH_CONDITIONS", "RESHAPE", "DONT"] as const;
export type Verdict = (typeof VERDICTS)[number];

export const VERDICT_LABELS: Record<Verdict, string> = {
  GO: "Empfohlen",
  GO_WITH_CONDITIONS: "Empfohlen mit Bedingungen",
  RESHAPE: "Umbauen",
  DONT: "Nicht empfohlen",
};

const agentScore = z.object({ agent: text(40), score: z.number().min(0).max(10) });

export const rawReportSchema = z.object({
  question: text(240).describe("Die Entscheidung in einem Satz"),
  options: z
    .array(
      z.object({
        id: z.enum(OPTION_IDS),
        label: text(120).describe("Kurzer Name der Option, z. B. „Preis für alle erhöhen“"),
        scores: z.array(agentScore).max(12).describe("Wie stark jede KI diese Option befürwortet (0 bis 10), nur nach dem, was sie gesagt hat"),
        objections: z.array(text(240)).max(3),
      }),
    )
    .min(2)
    .max(5),
  agreements: z.array(text(200)).max(5).describe("Punkte, in denen sich die KIs einig waren"),
  disagreements: z
    .array(
      z.object({
        topic: text(160),
        positions: z.array(z.object({ agent: text(40), position: text(240) })).min(1).max(8),
      }),
    )
    .max(4),
  strongestObjection: z.object({ agent: text(40), text: text(400) }),
  conditions: z.array(text(200)).max(6),
  nextSteps: z.array(text(200)).max(5),
  cheapestTest: text(300),
  killCriteria: text(300),
  assumptions: z.array(text(200)).max(5),
});
export type RawReport = z.infer<typeof rawReportSchema>;

const reportOption = z.object({
  id: z.enum(OPTION_IDS),
  label: text(120),
  /** Durchschnitt der Wertungen, eine Nachkommastelle. */
  score: z.number().min(0).max(10),
  scores: z.array(agentScore).max(12),
  objections: z.array(text(240)).max(3),
});

export const reportSchema = z.object({
  version: z.literal(1),
  generatedAt: z.string().max(40),
  /** true: ohne Modell aus den Zustimmungs-Markierungen gebaut (Demo oder kein Zugang). */
  simulated: z.boolean(),
  question: text(240),
  options: z.array(reportOption).min(2).max(5),
  recommendedOptionId: z.enum(OPTION_IDS),
  verdict: z.enum(VERDICTS),
  /** Warum das Urteil gedeckelt wurde, falls zutreffend. */
  capReason: text(200).nullable(),
  /** Größter Unterschied der Wertungen für die empfohlene Option. */
  spread: z.number().min(0).max(10),
  /** 1 bis 10: Wie einig waren sich die KIs über die empfohlene Option. */
  agreement: z.number().int().min(1).max(10),
  agents: z.array(text(40)).max(12),
  agreements: z.array(text(200)).max(5),
  disagreements: rawReportSchema.shape.disagreements,
  strongestObjection: rawReportSchema.shape.strongestObjection,
  conditions: z.array(text(200)).max(6),
  nextSteps: z.array(text(200)).max(5),
  cheapestTest: text(300),
  killCriteria: text(300),
  assumptions: z.array(text(200)).max(5),
});
export type DecisionReport = z.infer<typeof reportSchema>;

/** Kurzfassung für Listen. */
export interface ReportSummary {
  id: string;
  room_id: string;
  title: string;
  verdict: Verdict | null;
  recommended_label: string | null;
  shared: boolean;
  created_at: string;
}

export interface StoredReport {
  id: string;
  room_id: string;
  title: string;
  report: DecisionReport;
  shared: boolean;
  shared_at: string | null;
  created_at: string;
}

/** Was die öffentliche Ansicht bekommt: nie Raum, Konto oder Nachrichten. */
export interface PublicReport {
  title: string;
  report: DecisionReport;
  created_at: string;
}

/** Kurzfassung eines gespeicherten Berichts für Listen. */
export function summaryOf(r: Pick<StoredReport, "id" | "room_id" | "title" | "report" | "shared" | "created_at">): ReportSummary {
  const recommended = r.report.options.find((o) => o.id === r.report.recommendedOptionId);
  return {
    id: r.id,
    room_id: r.room_id,
    title: r.title,
    verdict: r.report.verdict,
    recommended_label: recommended?.label ?? null,
    shared: r.shared,
    created_at: r.created_at,
  };
}
