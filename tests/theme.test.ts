import { describe, expect, it } from "vitest";
import { EFFECTS_INIT_SCRIPT, motionAllowed } from "@/lib/effects";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

/** Führt ein Init-Skript gegen einen Fake-Speicher aus und liefert die gesetzten data-Attribute. */
function run(script: string, stored: Record<string, string>) {
  const dataset: Record<string, string> = {};
  new Function("localStorage", "document", script)({ getItem: (k: string) => stored[k] ?? null }, { documentElement: { dataset } });
  return dataset;
}

describe("Farbwelten und Bewegung (Design)", () => {
  it("TEST-DESIGN-1: gespeicherte Farbwelt wird vor dem Zeichnen gesetzt, alter Wert „dark“ gilt als Eis", () => {
    expect(run(THEME_INIT_SCRIPT, { "mm-theme": "zinn" })).toEqual({ theme: "zinn" });
    expect(run(THEME_INIT_SCRIPT, { "mm-theme": "dark" })).toEqual({ theme: "eis" });
    expect(run(THEME_INIT_SCRIPT, { "mm-theme": "light" })).toEqual({ theme: "light" });
    expect(run(THEME_INIT_SCRIPT, { "mm-theme": "<script>" })).toEqual({});
    expect(run(THEME_INIT_SCRIPT, {})).toEqual({});
  });

  it("TEST-DESIGN-2: gespeicherte Bewegungs-Einstellung wird übernommen, Unbekanntes ignoriert", () => {
    expect(run(EFFECTS_INIT_SCRIPT, { "mm-effects": "off" })).toEqual({ effects: "off" });
    expect(run(EFFECTS_INIT_SCRIPT, { "mm-effects": "always" })).toEqual({ effects: "always" });
    expect(run(EFFECTS_INIT_SCRIPT, { "mm-effects": "wild" })).toEqual({});
  });

  it("TEST-DESIGN-3: Bewegung läuft standardmäßig nur während der Antwort", () => {
    const root = (effects?: string) => ({ dataset: effects ? { effects } : {} }) as unknown as HTMLElement;
    expect(motionAllowed(root(), false)).toBe(false);
    expect(motionAllowed(root(), true)).toBe(true);
    expect(motionAllowed(root("always"), false)).toBe(true);
    expect(motionAllowed(root("off"), true)).toBe(false);
  });
});
