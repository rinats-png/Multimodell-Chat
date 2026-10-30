/** Bewegung der Oberfläche: nur bei Antwort (Standard), immer oder aus. „Bewegung reduzieren“ des Systems gilt zusätzlich. */
export type EffectsChoice = "live" | "always" | "off";

export const EFFECTS_STORAGE_KEY = "mm-effects";

/** Läuft vor dem ersten Zeichnen (app/layout.tsx). */
export const EFFECTS_INIT_SCRIPT = `try{var e=localStorage.getItem("${EFFECTS_STORAGE_KEY}");if(e==="always"||e==="off"||e==="live")document.documentElement.dataset.effects=e}catch(x){}`;

/**
 * Darf gerade etwas animiert werden? Liest die Attribute am <html>:
 * data-effects (live | always | off) und data-live (true, solange KIs antworten).
 */
export function motionAllowed(root: HTMLElement, busy: boolean = root.dataset.live === "true"): boolean {
  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  const mode = root.dataset.effects ?? "live";
  if (mode === "off") return false;
  return mode === "always" || busy;
}
