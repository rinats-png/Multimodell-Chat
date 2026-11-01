import { VERDICT_LABELS, type DecisionReport } from "./schema";

/**
 * Entscheidungsbericht als Markdown, passend zu `ENTSCHEIDUNGEN.md` aus idea-to-app:
 * ein Eintrag mit Entscheidung, Begründung, verworfenen Alternativen und offenen Annahmen, darunter der volle Bericht.
 * Reiner Text ohne HTML; Tabellenzellen werden entschärft (Pipe, Zeilenumbruch), damit die Tabelle nicht zerfällt.
 */
const cell = (s: string): string => s.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ").trim();
const line = (s: string): string => s.replace(/\s*\n\s*/g, " ").trim();
const list = (items: string[]): string => (items.length ? items.map((i) => `- ${line(i)}`).join("\n") : "- –");

export function reportToMarkdown(title: string, report: DecisionReport, createdAt: string, entryId = "E-001"): string {
  const date = createdAt.slice(0, 10);
  const recommended = report.options.find((o) => o.id === report.recommendedOptionId);
  const rejected = report.options.filter((o) => o.id !== report.recommendedOptionId);
  const verdict = VERDICT_LABELS[report.verdict];

  const scoreHeader = `| Option | Schnitt | ${report.agents.map(cell).join(" | ")} |`;
  const scoreDivider = `|---|---|${report.agents.map(() => "---|").join("")}`;
  const scoreRows = report.options.map((o) => {
    const perAgent = report.agents.map((a) => {
      const s = o.scores.find((x) => x.agent === a);
      return s ? String(s.score) : "–";
    });
    return `| ${o.id}) ${cell(o.label)} | ${o.score.toFixed(1)} | ${perAgent.join(" | ")} |`;
  });

  const parts = [
    `# ${line(title)}`,
    "",
    `> Entscheidungsbericht aus SynthrAI vom ${date}. Wertungen stammen von KI-Modellen und ersetzen keine eigene Prüfung.${report.simulated ? " Ohne Modell aus den Markierungen der Debatte erstellt." : ""}`,
    "",
    "## Eintrag für ENTSCHEIDUNGEN.md",
    "",
    "| ID | Datum | Entscheidung | Begründung | Verworfene Alternativen | Status |",
    "|---|---|---|---|---|---|",
    `| ${entryId} | ${date} | ${cell(`${report.question} → ${recommended ? `${recommended.id}) ${recommended.label}` : "–"}`)} | ${cell(`${verdict}, Schnitt ${recommended?.score.toFixed(1) ?? "–"} von 10, Einigkeit ${report.agreement} von 10${report.capReason ? `; ${report.capReason}` : ""}`)} | ${cell(rejected.map((o) => `${o.id}) ${o.label} (${o.score.toFixed(1)})`).join("; ") || "–")} | vorgeschlagen |`,
    "",
    "## Urteil",
    "",
    `**${verdict}:** ${recommended ? `${recommended.id}) ${line(recommended.label)}` : "–"}`,
    "",
    "## Wertungen",
    "",
    scoreHeader,
    scoreDivider,
    ...scoreRows,
    "",
    "## Stärkster Einwand",
    "",
    `${line(report.strongestObjection.agent)}: ${line(report.strongestObjection.text)}`,
    "",
    "## Bedingungen",
    "",
    list(report.conditions),
    "",
    "## Nächste Schritte",
    "",
    list(report.nextSteps),
    "",
    "## Günstigster Test",
    "",
    line(report.cheapestTest),
    "",
    "## Abbruchkriterium",
    "",
    line(report.killCriteria),
    "",
    "## Einigkeit",
    "",
    list(report.agreements),
    "",
    "## Streitpunkte",
    "",
    report.disagreements.length
      ? report.disagreements.map((d) => `- **${line(d.topic)}:** ${d.positions.map((p) => `${line(p.agent)}: ${line(p.position)}`).join(" · ")}`).join("\n")
      : "- –",
    "",
    "## Offene Annahmen",
    "",
    "| ID | Annahme | Bestätigt |",
    "|---|---|---|",
    ...(report.assumptions.length ? report.assumptions.map((a, i) => `| A-${String(i + 1).padStart(3, "0")} | ${cell(a)} | nein |`) : ["| – | – | – |"]),
    "",
  ];
  return parts.join("\n");
}

/** Dateiname ohne Sonderzeichen, z. B. `bericht-preis-erhoehen-2026-11-01.md`. */
export function reportFileName(title: string, createdAt: string): string {
  const slug =
    title
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "bericht";
  return `bericht-${slug}-${createdAt.slice(0, 10)}.md`;
}
