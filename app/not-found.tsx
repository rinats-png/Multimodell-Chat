import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-xl font-semibold">Debatte nicht gefunden</h1>
      <Link href="/chat" className="text-[14px] text-accent-strong hover:underline">
        Zurück zum Chat
      </Link>
    </div>
  );
}
