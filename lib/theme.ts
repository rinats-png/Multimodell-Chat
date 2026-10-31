/** system = Systemeinstellung, light = hell, dark = dunkel (beide im Stil „Bühne“). */
export type ThemeChoice = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "mm-theme";

/**
 * Läuft vor dem ersten Zeichnen (app/layout.tsx), damit beim Laden nichts aufblitzt.
 * Ältere Speicherwerte: „eis“ und „zinn“ waren dunkle Farbwelten und gelten jetzt als dunkel.
 */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="eis"||t==="zinn")t="dark";if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
