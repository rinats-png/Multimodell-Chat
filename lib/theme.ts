/** system = Systemeinstellung (dunkel → Eis), light = Morgenlicht, eis/zinn = die beiden dunklen Farbwelten. */
export type ThemeChoice = "system" | "light" | "eis" | "zinn";

export const THEME_STORAGE_KEY = "mm-theme";

/**
 * Läuft vor dem ersten Zeichnen (app/layout.tsx), damit beim Laden nichts aufblitzt.
 * Ältere Speicherwerte: "dark" war die frühere dunkle Farbwelt und gilt jetzt als Eis.
 */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="dark")t="eis";if(t==="light"||t==="eis"||t==="zinn")document.documentElement.dataset.theme=t}catch(e){}`;
