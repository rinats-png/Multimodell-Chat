import clsx from "clsx";

/** Bildmarke: drei Stimmen (Knoten), die sich in einem Gespräch treffen. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        "relative inline-flex shrink-0 items-center justify-center rounded-xl border border-accent/30 bg-gradient-to-br from-accent/25 via-surface-2 to-openai/20 shadow-[0_0_24px_-6px_rgb(79_216_255/0.7)]",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="size-[62%]" fill="none">
        <path d="M6 15.5 12 6l6 9.5" stroke="url(#bm-line)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6 15.5h12" stroke="url(#bm-line)" strokeWidth="1.6" strokeLinecap="round" opacity="0.55" />
        <circle cx="12" cy="6" r="2.6" fill="#4fd8ff" />
        <circle cx="6" cy="15.5" r="2.6" fill="#3ee0a1" />
        <circle cx="18" cy="15.5" r="2.6" fill="#ffaf5f" />
        <defs>
          <linearGradient id="bm-line" x1="6" y1="6" x2="18" y2="16" gradientUnits="userSpaceOnUse">
            <stop stopColor="#93e9ff" />
            <stop offset="1" stopColor="#3ee0a1" />
          </linearGradient>
        </defs>
      </svg>
    </span>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={clsx("font-display tracking-tight", className)}>
      Multi<span className="text-accent">modell</span>
    </span>
  );
}
