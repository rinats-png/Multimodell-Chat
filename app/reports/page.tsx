import clsx from "clsx";
import { FileText, Link2 } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { VERDICT_LABELS } from "@/lib/report/schema";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Berichte – SynthrAI" };

export default async function ReportsPage() {
  const { store, email, isDemoStore } = await getSession();
  const reports = await store.listReports();
  return (
    <AppShell email={email} isDemoStore={isDemoStore} active="reports">
      <div className="mx-auto w-full max-w-3xl p-4 sm:p-6">
        <h1 className="font-display text-[28px] leading-tight">Deine Entscheidungsberichte</h1>
        <p className="mt-1 text-[14px] text-muted">Aus jeder Debatte kannst du einen Bericht erstellen, ausdrucken oder per Link weitergeben.</p>
        {reports.length === 0 ? (
          <div className="glass mt-6 rounded-2xl p-6 text-center">
            <FileText className="mx-auto size-8 text-muted" aria-hidden />
            <p className="mt-3 text-[14px] text-ink-2">Noch kein Bericht. Lass die KIs eine Entscheidung debattieren und klicke oben in der Debatte auf „Bericht“.</p>
            <Link href="/chat" className="btn-primary mt-4 inline-flex px-4 py-2 text-[13.5px] font-semibold">
              Zu den Debatten
            </Link>
          </div>
        ) : (
          <ul className="mt-6 space-y-2.5">
            {reports.map((r) => (
              <li key={r.id}>
                <Link href={`/report/${r.id}`} className="glass flex items-center justify-between gap-3 rounded-2xl p-4 transition-colors hover:bg-surface-3/40">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{r.title}</span>
                    <span className="mt-0.5 block truncate text-[12.5px] text-muted">
                      {r.recommended_label ? `Empfehlung: ${r.recommended_label} · ` : ""}
                      {new Date(r.created_at).toLocaleDateString("de-DE")}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {r.shared && <Link2 className="size-4 text-muted" aria-label="Per Link geteilt" />}
                    {r.verdict && (
                      <span
                        className={clsx(
                          "rounded-full border px-2.5 py-0.5 text-[12px] font-semibold",
                          r.verdict === "GO" && "border-signal/40 bg-signal/10 text-signal",
                          (r.verdict === "GO_WITH_CONDITIONS" || r.verdict === "RESHAPE") && "border-warn/40 bg-warn/10 text-warn",
                          r.verdict === "DONT" && "border-danger/40 bg-danger/10 text-danger",
                        )}
                      >
                        {VERDICT_LABELS[r.verdict]}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
