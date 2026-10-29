"use client";

import Link from "next/link";

/** Allgemeine Fehlerseite – keine technischen Details (Regel 9.3). */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-xl font-semibold">Da ist etwas schiefgelaufen</h1>
      <p className="max-w-md text-[14px] text-muted">
        Bitte lade die Seite neu. Wenn der Fehler bleibt, nenne dem Support diese Referenz: <code className="font-mono">{error.digest ?? "–"}</code>
      </p>
      <div className="flex gap-3 text-[14px]">
        <button onClick={reset} className="rounded-lg bg-ink px-3 py-1.5 font-semibold text-canvas">
          Erneut versuchen
        </button>
        <Link href="/chat" className="rounded-lg border border-line px-3 py-1.5 text-ink-2">
          Zum Chat
        </Link>
      </div>
    </main>
  );
}
