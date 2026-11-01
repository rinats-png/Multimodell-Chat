import clsx from "clsx";

/** Bildmarke: ein Kern (Moderator), um den die Stimmen kreisen – Farben folgen dem aktiven Thema. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        "relative inline-flex shrink-0 items-center justify-center rounded-xl shadow-[0_0_22px_-6px_var(--color-accent)]",
        "bg-[conic-gradient(from_210deg,var(--color-accent-strong),var(--color-accent),var(--color-anthropic),var(--color-openai),var(--color-accent-strong))]",
        className,
      )}
      aria-hidden
    >
      <span className="size-[38%] rounded-full bg-canvas" />
    </span>
  );
}

/**
 * Wortmarke „SynthrAI“: „Synthr“ in der Serifenschrift, „AI“ größer in serifenloser Schrift im Verlauf der drei KI-Farben
 * mit Linie darunter. Optional steht die Zeile „AI Discussion Room“ darunter. Die Schriftgröße kommt von der umgebenden Klasse.
 */
export function Wordmark({ className, tagline = false }: { className?: string; tagline?: boolean }) {
  return (
    <span className={clsx("inline-flex flex-col leading-none", className)}>
      <span className="inline-flex items-end gap-0.5 font-display font-semibold tracking-tight">
        Synthr
        <span className="inline-flex flex-col items-stretch">
          <span className="brand-ai font-sans text-[1.2em] font-extrabold leading-none tracking-[-0.02em]">AI</span>
          <span aria-hidden className="brand-ai-bar mt-[2px] h-[3px] rounded-sm" />
        </span>
      </span>
      {tagline && (
        <span className="mt-1 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted">AI Discussion Room</span>
      )}
    </span>
  );
}
