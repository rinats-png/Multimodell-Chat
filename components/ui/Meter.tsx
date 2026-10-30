import clsx from "clsx";

export function Meter({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={clsx("h-1.5 overflow-hidden rounded-full bg-surface-3/80", className)}>
      <div
        className={clsx(
          "h-full rounded-full transition-all",
          pct > 90 ? "bg-red-400" : pct > 70 ? "bg-anthropic" : "bg-gradient-to-r from-accent to-openai shadow-[0_0_10px_rgb(79_216_255/0.6)]",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
