import Link from "next/link";

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <Link href="/chat" className="text-[13px] text-accent-strong hover:underline">
        ← Zurück zur App
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="legal mt-6 space-y-4 text-[14.5px] leading-relaxed text-ink-2">{children}</div>
    </main>
  );
}
