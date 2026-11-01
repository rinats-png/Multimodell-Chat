import type { DecisionReport, RawReport, Verdict } from "./schema";

/** Verdict-Bänder wie im Roast Room (scoring.md), auf den Durchschnitt der empfohlenen Option. */
export function verdictForScore(score: number): Verdict {
  if (score >= 7.5) return "GO";
  if (score >= 6) return "GO_WITH_CONDITIONS";
  if (score >= 4.5) return "RESHAPE";
  return "DONT";
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export class ReportScoringError extends Error {}

export interface ScoredReport extends Omit<DecisionReport, "version" | "generatedAt" | "simulated" | "agents"> {}

/**
 * Rechnet aus den Wertungen je KI die Zahlen des Berichts:
 * - nur Wertungen echter Teilnehmer zählen (erfundene Namen fallen weg), je KI und Option höchstens eine;
 * - Option-Wert = Durchschnitt; die Option mit dem höchsten Wert wird empfohlen (bei Gleichstand der höhere schlechteste Wert);
 * - Urteil nach festen Bändern; ein starker Widerspruch (Streuung ab 4 und eine Wertung bis 3) deckelt auf „mit Bedingungen“.
 */
export function scoreReport(raw: RawReport, participants: string[]): ScoredReport {
  const known = new Map(participants.map((p) => [p.trim().toLowerCase(), p] as const));
  const options = raw.options.map((option) => {
    const seen = new Set<string>();
    const scores: { agent: string; score: number }[] = [];
    for (const entry of option.scores) {
      const agent = known.get(entry.agent.trim().toLowerCase());
      if (!agent || seen.has(agent)) continue;
      seen.add(agent);
      scores.push({ agent, score: round1(Math.min(10, Math.max(0, entry.score))) });
    }
    const mean = scores.length > 0 ? scores.reduce((s, e) => s + e.score, 0) / scores.length : 0;
    return { id: option.id, label: option.label, objections: option.objections, scores, mean };
  });

  const scored = options.filter((o) => o.scores.length >= 2);
  if (scored.length < 2) {
    throw new ReportScoringError("Zu wenige Wertungen: Für mindestens zwei Optionen braucht es die Einschätzung von mindestens zwei KIs.");
  }
  const min = (o: (typeof options)[number]) => Math.min(...o.scores.map((s) => s.score));
  const best = [...scored].sort((a, b) => b.mean - a.mean || min(b) - min(a) || a.id.localeCompare(b.id))[0]!;

  const values = best.scores.map((s) => s.score);
  const spread = round1(Math.max(...values) - Math.min(...values));
  let verdict = verdictForScore(round1(best.mean));
  let capReason: string | null = null;
  if (verdict === "GO" && spread >= 4 && Math.min(...values) <= 3) {
    verdict = "GO_WITH_CONDITIONS";
    capReason = "Mindestens eine KI hält die empfohlene Option für schwach (Wertung bis 3 bei großer Streuung). Das Urteil ist deshalb auf „mit Bedingungen“ begrenzt.";
  }

  return {
    question: raw.question,
    options: options.map((o) => ({ id: o.id, label: o.label, score: round1(o.mean), scores: o.scores, objections: o.objections })),
    recommendedOptionId: best.id,
    verdict,
    capReason,
    spread,
    agreement: Math.max(1, Math.min(10, Math.round(10 - spread))),
    agreements: raw.agreements,
    disagreements: raw.disagreements,
    strongestObjection: raw.strongestObjection,
    conditions: raw.conditions,
    nextSteps: raw.nextSteps,
    cheapestTest: raw.cheapestTest,
    killCriteria: raw.killCriteria,
    assumptions: raw.assumptions,
  };
}
