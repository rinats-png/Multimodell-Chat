import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-center">
      <span className="font-mono text-[12px] uppercase tracking-[0.2em] text-accent">404</span>
      <h1 className="font-display text-2xl font-medium">Debatte nicht gefunden</h1>
      <Link href="/chat" className="btn-ghost mt-2 px-4 py-2 text-[14px]">
        Zurück zum Chat
      </Link>
    </div>
  );
}
