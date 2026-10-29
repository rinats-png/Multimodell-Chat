"use client";

import clsx from "clsx";
import type { LucideIcon } from "lucide-react";

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

interface SegmentedProps<T extends string> {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  size?: "sm" | "md";
  ariaLabel: string;
}

export function Segmented<T extends string>({ value, options, onChange, size = "md", ariaLabel }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex rounded-full border border-line bg-surface-2 p-0.5">
      {options.map(({ value: v, label, icon: Icon }) => (
        <button
          key={v}
          role="radio"
          aria-checked={v === value}
          onClick={() => onChange(v)}
          className={clsx(
            "inline-flex items-center gap-1.5 rounded-full font-medium transition-colors",
            size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-[13px]",
            v === value ? "bg-surface-3 text-ink shadow-sm ring-1 ring-line-strong" : "text-muted hover:text-ink-2",
          )}
        >
          {Icon && <Icon className="size-3.5" />}
          {label}
        </button>
      ))}
    </div>
  );
}
