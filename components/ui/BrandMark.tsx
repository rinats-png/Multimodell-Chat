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

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={clsx("font-display font-semibold tracking-tight", className)}>
      Multi<span className="text-accent-strong">modell</span>
    </span>
  );
}
