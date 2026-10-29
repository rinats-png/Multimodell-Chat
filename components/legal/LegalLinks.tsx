import Link from "next/link";

export function LegalLinks({ className = "" }: { className?: string }) {
  return (
    <nav aria-label="Rechtliches" className={`flex gap-3 text-[11.5px] text-muted ${className}`}>
      <Link href="/impressum" className="hover:text-ink-2 hover:underline">
        Impressum
      </Link>
      <Link href="/datenschutz" className="hover:text-ink-2 hover:underline">
        Datenschutz
      </Link>
    </nav>
  );
}
