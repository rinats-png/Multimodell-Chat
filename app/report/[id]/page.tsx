import { notFound } from "next/navigation";
import { AppHeader } from "@/components/shell/AppHeader";
import { ReportActions } from "@/components/report/ReportActions";
import { ReportView } from "@/components/report/ReportView";
import { reportFileName, reportToMarkdown } from "@/lib/report/markdown";
import { getSession } from "@/lib/session";
import { uuidSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Entscheidungsbericht – SynthrAI" };

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const parsed = uuidSchema.safeParse((await params).id);
  if (!parsed.success) notFound();
  const { store, email, isDemoStore } = await getSession();
  const stored = await store.getReport(parsed.data);
  if (!stored) notFound();
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1400px] flex-col gap-3.5 p-3 sm:p-4">
      <div className="no-print">
        <AppHeader active="reports" email={email} isDemoStore={isDemoStore} />
      </div>
      <main className="flex flex-1 flex-col gap-3.5 pb-6">
        <ReportActions
          reportId={stored.id}
          shared={stored.shared}
          markdown={reportToMarkdown(stored.title, stored.report, stored.created_at)}
          fileName={reportFileName(stored.title, stored.created_at)}
        />
        <ReportView report={stored.report} title={stored.title} createdAt={stored.created_at} />
      </main>
    </div>
  );
}
