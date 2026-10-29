"use client";

interface RangeFieldProps {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (value: number) => void;
}

export function RangeField({ label, hint, value, min, max, suffix, onChange }: RangeFieldProps) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-medium text-ink">{label}</span>
        <span className="font-mono text-xs text-accent-strong">
          {value} {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-[var(--color-accent)]"
      />
      <p className="mt-1 text-xs leading-relaxed text-muted">{hint}</p>
    </label>
  );
}
