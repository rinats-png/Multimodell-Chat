"use client";

import clsx from "clsx";
import { Sparkles, Zap, ZapOff } from "lucide-react";
import { useEffect, useState } from "react";
import { EFFECTS_STORAGE_KEY, type EffectsChoice } from "@/lib/effects";

const OPTIONS: { value: EffectsChoice; label: string; Icon: typeof Zap }[] = [
  { value: "live", label: "Bewegung nur bei Antwort", Icon: Zap },
  { value: "always", label: "Bewegung immer", Icon: Sparkles },
  { value: "off", label: "Keine Bewegung", Icon: ZapOff },
];

function apply(choice: EffectsChoice) {
  document.documentElement.dataset.effects = choice;
  try {
    if (choice === "live") localStorage.removeItem(EFFECTS_STORAGE_KEY);
    else localStorage.setItem(EFFECTS_STORAGE_KEY, choice);
  } catch {
    // Speicher gesperrt: Wahl gilt nur für diese Sitzung.
  }
}

/** Effekte wählen: Bewegung nur bei Antwort (Standard), immer oder aus. */
export function EffectsToggle({ className, vertical = false }: { className?: string; vertical?: boolean }) {
  const [choice, setChoice] = useState<EffectsChoice>("live");

  useEffect(() => {
    const e = document.documentElement.dataset.effects;
    if (e === "always" || e === "off") setChoice(e);
  }, []);

  return (
    <div role="radiogroup" aria-label="Bewegung" className={clsx("inline-flex rounded-xl border border-line/70 bg-canvas/30 p-0.5", vertical && "flex-col rounded-[6px]", className)}>
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={choice === value}
          aria-label={label}
          title={label}
          onClick={() => {
            setChoice(value);
            apply(value);
          }}
          className={clsx(
            "flex size-7 items-center justify-center transition-colors",
            vertical ? "rounded-[4px]" : "rounded-lg",
            choice === value ? "bg-accent/15 text-accent ring-1 ring-accent/30" : "text-muted hover:text-ink",
          )}
        >
          <Icon className="size-3.5" />
        </button>
      ))}
    </div>
  );
}
