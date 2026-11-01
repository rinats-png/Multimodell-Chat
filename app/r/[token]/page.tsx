import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandMark, Wordmark } from "@/components/ui/BrandMark";
import { ReportView } from "@/components/report/ReportView";
import { clientIpFromHeaders, rateLimit } from "@/lib/rate-limit";
import { getPublicReport } from "@/lib/report/shared";

export const dynamic = "force-dynamic";

/** Geteilte Berichte gehören nicht in Suchmaschinen und geben den Link nicht über den Referer weiter. */
export const metadata: Metadata = {
  title: "Entscheidungsbericht – SynthrAI",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

/** Öffentliche Ansicht eines freigegebenen Berichts. Ohne Anmeldung; nur der Bericht selbst, nie die Debatte oder das Konto. */
export default async function SharedReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // Raten des Tokens erschweren: Aufrufe pro IP begrenzen (192-Bit-Token sind ohnehin nicht erratbar).
  const ip = clientIpFromHeaders(await headers());
  const limit = await rateLimit("share-view", ip, 60, 60_000);
  if (!limit.allowed) {
    return (
      <main className="mx-auto max-w-md p-8 text-center text-[14px] text-ink-2">
        <p>Zu viele Aufrufe. Bitte warte einen Moment und lade die Seite dann neu.</p>
      </main>
    );
  }
  const shared = await getPublicReport(token);
  if (!shared) notFound();
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1100px] flex-col gap-4 p-3 sm:p-5">
      <header className="no-print flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2.5" aria-label="SynthrAI">
          <BrandMark className="size-8" />
          <Wordmark className="text-[24px]" />
        </Link>
        <Link href="/login" className="btn-primary px-4 py-2 text-[13px] font-semibold">
          Eigene Entscheidung prüfen
        </Link>
      </header>
      <main className="pb-8">
        <ReportView report={shared.report} title={shared.title} createdAt={shared.created_at} />
      </main>
    </div>
  );
}
