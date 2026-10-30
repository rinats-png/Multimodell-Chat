import Link from "next/link";

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-5">
      <Link href="/chat" className="text-[13px] text-accent-strong hover:underline">
        ← Zurück zur App
      </Link>
      <h1 className="mt-4 font-display text-[28px] font-medium tracking-tight">{title}</h1>
      <div className="glass legal mt-6 space-y-5 rounded-2xl p-5 text-[14.5px] leading-relaxed text-ink-2 sm:p-7">{children}</div>
    </main>
  );
}
