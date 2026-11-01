import { describe, expect, it } from "vitest";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

/** Führt das Init-Skript gegen einen Fake-Speicher aus und liefert die gesetzten data-Attribute. */
function run(script: string, stored: Record<string, string>) {
  const dataset: Record<string, string> = {};
  new Function("localStorage", "document", script)({ getItem: (k: string) => stored[k] ?? null }, { documentElement: { dataset } });
  return dataset;
}

describe("Darstellung (Design)", () => {
  it("TEST-DESIGN-1: gespeicherte Wahl wird vor dem Zeichnen gesetzt, alte dunkle Farbwelten gelten als dunkel", () => {
    expect(run(THEME_INIT_SCRIPT, { "mm-theme": "light" })).toEqual({ theme: "light" });
    expect(run(THEME_INIT_SCRIPT, { "mm-theme": "dark" })).toEqual({ theme: "dark" });
    expect(run(THEME_INIT_SCRIPT, { "mm-theme": "eis" })).toEqual({ theme: "dark" });
    expect(run(THEME_INIT_SCRIPT, { "mm-theme": "zinn" })).toEqual({ theme: "dark" });
    expect(run(THEME_INIT_SCRIPT, { "mm-theme": "<script>" })).toEqual({});
    expect(run(THEME_INIT_SCRIPT, {})).toEqual({});
  });
});
