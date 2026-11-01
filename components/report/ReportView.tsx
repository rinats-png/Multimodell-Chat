import clsx from "clsx";
import { AlertTriangle, Flag, Handshake, Scale, ShieldAlert, Swords } from "lucide-react";
import { VERDICT_LABELS, type DecisionReport, type Verdict } from "@/lib/report/schema";

const VERDICT_STYLE: Record<Verdict, string> = {
  GO: "border-signal/40 bg-signal/15 text-signal",
  GO_WITH_CONDITIONS: "border-warn/40 bg-warn/15 text-warn",
  RESHAPE: "border-warn/40 bg-warn/10 text-warn",
  DONT: "border-danger/40 bg-danger/15 text-danger",
};

function Block({ title, icon: Icon, children, className }: { title: string; icon?: typeof Scale; children: React.ReactNode; className?: string }) {
  return (
    <section className={clsx("report-block glass rounded-2xl p-4 sm:p-5", className)}>
      <h2 className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">
        {Icon && <Icon className="size-4" aria-hidden />}
        {title}
      </h2>
      <div className="mt-3 text-[14px] leading-relaxed text-ink">{children}</div>
    </section>
  );
}

const List = ({ items }: { items: string[] }) => (
  <ul className="space-y-1.5">
    {items.map((item, i) => (
      <li key={i} className="flex gap-2">
        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-ink-2" aria-hidden />
        <span>{item}</span>
      </li>
    ))}
  </ul>
);

/**
 * Der Entscheidungsbericht (F-21): Urteil, Optionen mit Wertung jeder KI, Einigkeit und Widerspruch, stärkster Einwand,
 * Bedingungen, nächste Schritte, günstigster Test, Abbruchkriterien. Reine Anzeige ohne Zustand – wird vom Besitzer
 * und von der öffentlichen Link-Ansicht genutzt. Alle Texte werden von React escaped.
 */
export function ReportView({ report, title, createdAt }: { report: DecisionReport; title?: string; createdAt: string }) {
  const recommended = report.options.find((o) => o.id === report.recommendedOptionId) ?? report.options[0]!;
  const date = new Date(createdAt).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });
  return (
    <article className="report mx-auto w-full max-w-3xl space-y-3.5" aria-label={title ?? "Entscheidungsbericht"}>
      {report.simulated && (
        <p role="note" className="flex items-start gap-2 rounded-xl border border-warn/30 bg-warn/10 px-3 py-2 text-[12.5px] text-warn">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>Musterbericht: Er wurde ohne KI-Modell aus den Zustimmungs-Markierungen der Debatte gebaut. Verbinde einen Zugang für einen echten Bericht.</span>
        </p>
      )}

      <header className="glass tile p-5 sm:p-6">
        <p className="text-[12px] text-muted">
          Entscheidungsbericht · {date} · {report.agents.length} KIs
        </p>
        <h1 className="mt-1 font-display text-[26px] leading-tight sm:text-[32px]">{report.question}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className={clsx("rounded-full border px-3.5 py-1.5 text-[14px] font-semibold", VERDICT_STYLE[report.verdict])}>{VERDICT_LABELS[report.verdict]}</span>
          <span className="text-[14px]">
            <span className="text-muted">Empfehlung: </span>
            <strong className="font-semibold">
              {recommended.id}: {recommended.label}
            </strong>
          </span>
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-surface-2/50 p-2.5">
            <dt className="text-[11px] text-muted">Wertung</dt>
            <dd className="font-display text-[22px]">{recommended.score.toFixed(1)}<span className="text-[12px] text-muted"> /10</span></dd>
          </div>
          <div className="rounded-xl bg-surface-2/50 p-2.5">
            <dt className="text-[11px] text-muted">Einigkeit</dt>
            <dd className="font-display text-[22px]">{report.agreement}<span className="text-[12px] text-muted"> /10</span></dd>
          </div>
          <div className="rounded-xl bg-surface-2/50 p-2.5">
            <dt className="text-[11px] text-muted">Streuung</dt>
            <dd className="font-display text-[22px]">{report.spread.toFixed(1)}</dd>
          </div>
        </dl>
        {report.capReason && <p className="mt-3 text-[12.5px] text-ink-2">{report.capReason}</p>}
      </header>

      <Block title="Optionen und Wertungen" icon={Scale}>
        <ul className="space-y-3">
          {[...report.options]
            .sort((a, b) => b.score - a.score)
            .map((option) => (
              <li key={option.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">
                    {option.id}: {option.label}
                    {option.id === report.recommendedOptionId && <span className="ml-2 text-[11.5px] font-semibold text-signal">Empfohlen</span>}
                  </span>
                  <span className="shrink-0 font-display text-[18px] tabular-nums">{option.score.toFixed(1)}</span>
                </div>
                <div
                  className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-3/70"
                  role="img"
                  aria-label={`Option ${option.id}: durchschnittliche Wertung ${option.score.toFixed(1)} von 10`}
                >
                  <div className="h-full rounded-full bg-ink-2" style={{ width: `${Math.round(option.score * 10)}%` }} />
                </div>
                {option.scores.length > 0 && (
                  <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-ink-2">
                    {option.scores.map((s) => (
                      <span key={s.agent}>
                        {s.agent} <strong className="font-semibold text-ink">{s.score}</strong>
                      </span>
                    ))}
                  </p>
                )}
                {option.objections.length > 0 && <p className="mt-1 text-[12.5px] text-muted">Einwand: {option.objections.join(" · ")}</p>}
              </li>
            ))}
        </ul>
        <p className="mt-3 text-[11.5px] text-muted">Die Wertung jeder KI ist ihre Einschätzung nach ihrer Fachrolle. Die App bildet daraus den Durchschnitt.</p>
      </Block>

      <div className="grid gap-3.5 sm:grid-cols-2">
        <Block title="Hier waren sie einig" icon={Handshake}>
          {report.agreements.length > 0 ? <List items={report.agreements} /> : <p className="text-muted">Kein gemeinsamer Punkt benannt.</p>}
        </Block>
        <Block title="Hier haben sie gestritten" icon={Swords}>
          {report.disagreements.length > 0 ? (
            <ul className="space-y-3">
              {report.disagreements.map((d, i) => (
                <li key={i}>
                  <p className="font-medium">{d.topic}</p>
                  <ul className="mt-1 space-y-1 text-[13px] text-ink-2">
                    {d.positions.map((p, j) => (
                      <li key={j}>
                        <strong className="font-semibold text-ink">{p.agent}:</strong> {p.position}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">Kein Streitpunkt benannt.</p>
          )}
        </Block>
      </div>

      <Block title="Der stärkste Einwand" icon={ShieldAlert}>
        <p>
          <strong className="font-semibold">{report.strongestObjection.agent}:</strong> {report.strongestObjection.text}
        </p>
      </Block>

      <div className="grid gap-3.5 sm:grid-cols-2">
        <Block title="Bedingungen">{report.conditions.length > 0 ? <List items={report.conditions} /> : <p className="text-muted">Keine Bedingungen benannt.</p>}</Block>
        <Block title="Nächste Schritte" icon={Flag}>
          {report.nextSteps.length > 0 ? (
            <ol className="list-decimal space-y-1.5 pl-5">
              {report.nextSteps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          ) : (
            <p className="text-muted">Keine Schritte benannt.</p>
          )}
        </Block>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2">
        <Block title="Günstigster Test">{report.cheapestTest}</Block>
        <Block title="Abbruchkriterien">{report.killCriteria}</Block>
      </div>

      {report.assumptions.length > 0 && (
        <Block title="Annahmen">
          <List items={report.assumptions} />
        </Block>
      )}

      <p className="px-1 pb-2 text-[11.5px] leading-relaxed text-muted">
        Dieser Bericht stammt von KI-Modellen, die in der Debatte eine Fachrolle gespielt haben. Sie können irren und sind keine Fachberatung. Prüfe Zahlen und
        Annahmen, bevor du entscheidest. Erstellt mit SynthrAI.
      </p>
    </article>
  );
}
