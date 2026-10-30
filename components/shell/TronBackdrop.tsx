"use client";

import { useEffect, useRef } from "react";
import { motionAllowed } from "@/lib/effects";

type Rgb = [number, number, number];

/** Liest "#rrggbb" oder "rgb(r g b / a)" aus einem CSS-Wert. */
function toRgb(value: string): Rgb {
  const v = value.trim();
  if (v.startsWith("#")) {
    const n = parseInt(v.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = v.match(/[\d.]+/g);
  return m && m.length >= 3 ? [Number(m[0]), Number(m[1]), Number(m[2])] : [160, 220, 250];
}
const rgba = (c: Rgb, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

interface Palette {
  on: boolean;
  /** helle Farbwelt: schwächere Leuchtflächen, damit der Boden nicht schmutzig wirkt */
  light: boolean;
  bg: string;
  hud: Rgb;
  trails: Rgb[];
}

function readPalette(): Palette {
  const cs = getComputedStyle(document.documentElement);
  const get = (name: string) => cs.getPropertyValue(name);
  const bg = get("--color-canvas").trim() || "#0a1118";
  const [r, g, b] = toRgb(bg);
  return {
    on: get("--backdrop-grid").trim() === "1",
    light: r * 0.3 + g * 0.59 + b * 0.11 > 140,
    bg,
    hud: toRgb(get("--color-accent")),
    trails: [get("--color-openai"), get("--color-anthropic"), get("--color-google")].map(toRgb),
  };
}

/** Zeitpunkt des Standbilds, wenn gerade nichts animiert wird. */
const STILL_AT = 2.5;

const TRAILS = [
  { c: 0, line: -3, speed: 0.11, offset: 0.1 },
  { c: 1, line: 2, speed: 0.15, offset: 0.55 },
  { c: 2, line: 6, speed: 0.09, offset: 0.8 },
  { c: 1, line: -7, speed: 0.13, offset: 0.3 },
  { c: 0, line: 9, speed: 0.12, offset: 0.65 },
];

/**
 * Tron-Gitterlandschaft hinter der ganzen App: leuchtender Horizont, Gitterboden, Lichtspuren in den Farben der KIs.
 * Aktiv in allen Farbwelten, die --backdrop-grid: 1 setzen (Eis hell, Eis, Zinn).
 * Rein dekorativ (aria-hidden). Bewegung nur nach Einstellung (lib/effects.ts): Standard nur, solange KIs antworten; sonst Standbild.
 */
export function TronBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const cv = canvas;
    const g = ctx;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let palette = readPalette();
    let w = 0;
    let h = 0;
    let raf = 0;
    const start = performance.now();

    function resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = window.innerWidth;
      h = window.innerHeight;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw(t: number) {
      const { hud, bg, trails, light } = palette;
      const k = light ? 0.55 : 1;
      const hz = h * 0.46;
      g.clearRect(0, 0, w, h);

      const sky = g.createLinearGradient(0, 0, 0, hz);
      sky.addColorStop(0, bg);
      sky.addColorStop(1, rgba(hud, 0.2 * k));
      g.fillStyle = sky;
      g.fillRect(0, 0, w, hz);

      const floor = g.createLinearGradient(0, hz, 0, h);
      floor.addColorStop(0, rgba(hud, 0.18 * k));
      floor.addColorStop(0.25, bg);
      floor.addColorStop(1, bg);
      g.fillStyle = floor;
      g.fillRect(0, hz, w, h - hz);

      const glow = g.createRadialGradient(w / 2, hz, 0, w / 2, hz, w * 0.55);
      glow.addColorStop(0, rgba(hud, 0.5 * k));
      glow.addColorStop(0.4, rgba(hud, 0.12 * k));
      glow.addColorStop(1, rgba(hud, 0));
      g.fillStyle = glow;
      g.fillRect(0, hz - w * 0.3, w, w * 0.6);

      // Horizont
      g.strokeStyle = rgba(hud, 0.9);
      g.lineWidth = 1.4;
      g.shadowColor = rgba(hud, 1);
      g.shadowBlur = 14;
      g.beginPath();
      g.moveTo(0, hz);
      g.lineTo(w, hz);
      g.stroke();
      g.shadowBlur = 0;

      // Querlinien laufen langsam auf den Betrachter zu
      const rows = 16;
      for (let k = 0; k < rows; k++) {
        const z = (k + ((t * 0.35) % 1)) / rows;
        const y = hz + (h - hz) * Math.pow(z, 2.3);
        g.strokeStyle = rgba(hud, (0.06 + 0.34 * z) * (light ? 0.8 : 1));
        g.lineWidth = 0.6 + z * 1.1;
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(w, y);
        g.stroke();
      }

      // Längslinien
      const lg = g.createLinearGradient(0, hz, 0, h);
      lg.addColorStop(0, rgba(hud, 0));
      lg.addColorStop(0.3, rgba(hud, 0.18));
      lg.addColorStop(1, rgba(hud, 0.36));
      g.strokeStyle = lg;
      g.lineWidth = 1;
      for (let i = -16; i <= 16; i++) {
        g.beginPath();
        g.moveTo(w / 2 + i * w * 0.012, hz);
        g.lineTo(w / 2 + i * w * 0.14, h);
        g.stroke();
      }

      // Lichtspuren in den Farben der KIs
      for (const tr of TRAILS) {
        const f = (t * tr.speed + tr.offset) % 1;
        const f0 = Math.max(0, f - 0.22);
        const point = (q: number): [number, number] => [
          w / 2 + tr.line * (w * 0.012 + w * 0.128 * Math.pow(q, 1.9)),
          hz + (h - hz) * Math.pow(q, 1.9),
        ];
        const a = point(f0);
        const b = point(f);
        const c = trails[tr.c] ?? hud;
        const lg2 = g.createLinearGradient(a[0], a[1], b[0], b[1]);
        lg2.addColorStop(0, rgba(c, 0));
        lg2.addColorStop(1, rgba(c, 0.95));
        g.strokeStyle = lg2;
        g.lineWidth = 1.5 + f * 3;
        g.shadowColor = rgba(c, 1);
        g.shadowBlur = 14;
        g.beginPath();
        g.moveTo(a[0], a[1]);
        g.lineTo(b[0], b[1]);
        g.stroke();
        g.shadowBlur = 0;
      }
    }

    function frame(now: number) {
      const animate = palette.on && motionAllowed(document.documentElement);
      draw(animate ? (now - start) / 1000 : STILL_AT);
      if (animate) raf = requestAnimationFrame(frame);
    }

    function refresh() {
      cancelAnimationFrame(raf);
      palette = readPalette();
      cv.style.display = palette.on ? "block" : "none";
      if (palette.on) raf = requestAnimationFrame(frame);
    }

    resize();
    refresh();
    const onResize = () => {
      resize();
      refresh();
    };
    window.addEventListener("resize", onResize);
    // Farbwelt-Wechsel: data-theme am <html> bzw. Systemeinstellung
    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-effects", "data-live"] });
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", refresh);
    motion.addEventListener("change", refresh);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      observer.disconnect();
      scheme.removeEventListener("change", refresh);
      motion.removeEventListener("change", refresh);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 -z-10 hidden size-full" />;
}
