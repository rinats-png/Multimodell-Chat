export type ThemeChoice = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "mm-theme";

/** Läuft vor dem ersten Zeichnen (app/layout.tsx), damit beim Laden nichts aufblitzt. */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
