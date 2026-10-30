"use client";

import clsx from "clsx";
import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { THEME_STORAGE_KEY, type ThemeChoice } from "@/lib/theme";

function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "system") delete root.dataset.theme;
  else root.dataset.theme = choice;
  try {
    if (choice === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Speicher gesperrt (privates Fenster): Wahl gilt nur für diese Sitzung.
  }
}

const OPTIONS: { value: ThemeChoice; label: string; Icon: typeof Sun }[] = [
  { value: "system", label: "Wie System", Icon: Monitor },
  { value: "light", label: "Hell", Icon: Sun },
  { value: "dark", label: "Dunkel", Icon: Moon },
];

/** Darstellung wählen: wie System (Standard), hell oder dunkel. */
export function ThemeToggle({ className, vertical = false }: { className?: string; vertical?: boolean }) {
  const [choice, setChoice] = useState<ThemeChoice>("system");

  useEffect(() => {
    const t = document.documentElement.dataset.theme;
    if (t === "light" || t === "dark") setChoice(t);
  }, []);

  return (
    <div role="radiogroup" aria-label="Darstellung" className={clsx("inline-flex rounded-xl border border-line/70 bg-canvas/30 p-0.5", vertical && "flex-col rounded-full", className)}>
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
            applyTheme(value);
          }}
          className={clsx(
            "flex size-7 items-center justify-center transition-colors",
            vertical ? "rounded-full" : "rounded-lg",
            choice === value ? "bg-accent/15 text-accent ring-1 ring-accent/30" : "text-muted hover:text-ink",
          )}
        >
          <Icon className="size-3.5" />
        </button>
      ))}
    </div>
  );
}
