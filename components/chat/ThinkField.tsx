"use client";

import { useEffect, useRef } from "react";
import { motionAllowed } from "@/lib/effects";
import type { ProviderKey } from "@/lib/models";

export type FieldState = "idle" | "think" | "talk";

interface ThinkFieldProps {
  state: FieldState;
  /** Anbieter der gerade aktiven KI; bestimmt Farbe und Wellenform. */
  provider: ProviderKey | null;
  /** Wächst mit jedem empfangenen Textstück: lässt das Feld im Takt der Antwort schwingen. */
  pulse: number;
  className?: string;
}

type Kind = "swell" | "ridge" | "ring" | "idle";
type Rgb = [number, number, number];

const KIND: Record<ProviderKey, Kind> = { openai: "swell", anthropic: "ridge", google: "ring", other: "swell" };
const VAR: Record<ProviderKey, string> = {
  openai: "--color-openai",
  anthropic: "--color-anthropic",
  google: "--color-google",
  other: "--color-other",
};

function toRgb(value: string, fallback: Rgb): Rgb {
  const v = value.trim();
  if (v.startsWith("#")) {
    const n = parseInt(v.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = v.match(/[\d.]+/g);
  return m && m.length >= 3 ? [Number(m[0]), Number(m[1]), Number(m[2])] : fallback;
}
const rgba = (c: Rgb, a: number) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const hash = (a: number, b: number, c: number) => {
  const n = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return n - Math.floor(n);
};

const COLS = 58;
const ROWS = 22;

/**
 * Kleines Partikelfeld („Denkfeld“): ruht grau, flimmert in der Farbe der KI, die gerade denkt,
 * und schwingt im Takt des Textes, solange sie antwortet. Jede KI hat ihre eigene Wellenform.
 */
export function ThinkField({ state, provider, pulse, className }: ThinkFieldProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef({ state, provider, pulse });
  live.current = { state, provider, pulse };
  const kick = useRef<() => void>(() => {});

  // Zustandswechsel: Zeichnen neu anstoßen (auch wenn es zuvor als Standbild ruhte)
  useEffect(() => {
    kick.current();
  }, [state, provider]);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const cv = canvas;
    const g = ctx;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const start = performance.now();
    let w = 0;
    let h = 0;
    let raf = 0;
    let energy = 0;
    let lastPulse = live.current.pulse;
    const rgb: Rgb = [160, 175, 190];
    const weights: Record<Kind, number> = { swell: 0, ridge: 0, ring: 0, idle: 1 };
    let amp = 0.38;
    let idleColor: Rgb = [150, 165, 180];
    let colorAt = 0;
    const cache: Partial<Record<ProviderKey, Rgb>> = {};

    function resize() {
      const r = cv.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = r.width;
      h = r.height;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function colors(now: number) {
      if (now - colorAt < 600) return;
      colorAt = now;
      const cs = getComputedStyle(document.documentElement);
      idleColor = toRgb(cs.getPropertyValue("--color-muted"), idleColor);
      (Object.keys(VAR) as ProviderKey[]).forEach((k) => (cache[k] = toRgb(cs.getPropertyValue(VAR[k]), rgb)));
    }

    function frame(now: number) {
      // Unsichtbar (Leiste ausgeblendet, 0×0): nichts zeichnen; ein ResizeObserver stößt neu an
      if (w === 0 || h === 0) return;
      colors(now);
      const { state: st, provider: pv, pulse: pl } = live.current;
      const animating = motionAllowed(document.documentElement, st !== "idle");
      const ease = (k: number) => (animating ? k : 1);
      const t = animating ? (now - start) / 1000 : 3;
      if (pl !== lastPulse) {
        lastPulse = pl;
        energy = 1;
      }
      energy *= 0.9;

      const active = st !== "idle" && pv;
      const kind: Kind = active && pv ? KIND[pv] : "idle";
      (Object.keys(weights) as Kind[]).forEach((k) => (weights[k] += ((k === kind ? 1 : 0) - weights[k]) * ease(0.06)));
      const target = active && pv ? (cache[pv] ?? rgb) : idleColor;
      for (let i = 0; i < 3; i++) rgb[i] = (rgb[i] ?? 0) + ((target[i] ?? 0) - (rgb[i] ?? 0)) * ease(0.07);

      const amplitude = st === "think" ? 0.62 + 0.2 * Math.sin(t * 7) : st === "talk" ? 0.5 + 0.5 * energy + 0.1 * Math.sin(t * 8) : 0.38;
      amp += (amplitude - amp) * ease(0.12);

      g.clearRect(0, 0, w, h);
      g.globalCompositeOperation = "lighter";
      const hz = h * 0.3;
      const fl = h * 0.88;
      const hf = h * 0.7;
      const jit = st === "think" ? 0.4 : 0;
      const jt = Math.floor(t * 12);
      for (let j = 0; j < ROWS; j++) {
        const z = j / (ROWS - 1);
        const zf = Math.pow(z, 1.5);
        const sy0 = hz + (fl - hz) * zf;
        const wsc = 0.4 + 0.62 * zf;
        const sz = 0.6 + 1.5 * zf;
        for (let i = 0; i < COLS; i++) {
          const u = (i / (COLS - 1) - 0.5) * 2;
          const fade = 1 - Math.pow(Math.abs(u), 3);
          if (fade <= 0) continue;
          const hS = 0.5 * Math.sin(u * 2.6 + t * 0.8 + z * 2) + 0.35 * Math.sin(z * 6 - t * 0.6) + 0.2 * Math.sin(u * 7 + t * 1.2);
          const hR = (1 - Math.abs(Math.sin(u * 3.2 + t * 0.7 + z * 3))) * 1.3 - 0.5 + 0.3 * (1 - Math.abs(Math.sin(z * 7 - t)));
          const rr = Math.hypot(u * 0.9, (z - 0.55) * 1.4);
          const hG = 0.8 * Math.sin(rr * 16 - t * 2.4) * Math.exp(-rr * 1.6);
          const hI = 0.2 * Math.sin(u * 2 + t * 0.3) + 0.15 * Math.sin(z * 4 - t * 0.25);
          let hh = hS * weights.swell + hR * weights.ridge + hG * weights.ring + hI * weights.idle;
          if (jit) hh += (hash(i, j, jt) - 0.5) * jit;
          const sx = w / 2 + u * w * 0.5 * wsc;
          const sy = sy0 - hh * amp * hf * (0.25 + zf);
          const a = (0.2 + 0.8 * zf) * fade * (0.55 + 0.45 * Math.min(1, Math.abs(hh) * 1.2 + 0.3));
          g.fillStyle = rgba(rgb, Number(a.toFixed(2)));
          g.fillRect(sx - sz / 2, sy - sz / 2, sz, sz);
        }
      }
      g.globalCompositeOperation = "source-over";

      // Ringe um das Feld
      const cx = w / 2;
      const cy = h * 0.5;
      const rx = w * 0.47;
      const ry = h * 0.42;
      g.lineWidth = 1;
      g.setLineDash([]);
      g.strokeStyle = rgba(rgb, 0.4);
      g.beginPath();
      g.ellipse(cx, cy, rx, ry, 0, 0, 7);
      g.stroke();
      g.setLineDash([3, 7]);
      g.lineDashOffset = -t * 14;
      g.strokeStyle = rgba(rgb, 0.35);
      g.beginPath();
      g.ellipse(cx, cy, rx * 0.93, ry * 0.9, 0, 0, 7);
      g.stroke();
      g.setLineDash([]);
      g.strokeStyle = rgba(rgb, 0.5);
      for (let k = 0; k < 36; k++) {
        const an = (k / 36) * Math.PI * 2;
        const l = k % 3 === 0 ? 7 : 4;
        g.beginPath();
        g.moveTo(cx + Math.cos(an) * rx, cy + Math.sin(an) * ry);
        g.lineTo(cx + Math.cos(an) * (rx - l), cy + Math.sin(an) * (ry - (l * ry) / rx));
        g.stroke();
      }
      if (active) {
        const ma = -Math.PI / 2 + t * 0.9;
        g.fillStyle = rgba(rgb, 1);
        g.beginPath();
        g.arc(cx + Math.cos(ma) * rx, cy + Math.sin(ma) * ry, 3.2, 0, 7);
        g.fill();
      }
      if (animating) raf = requestAnimationFrame(frame);
    }

    const restart = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    };
    kick.current = restart;
    resize();
    restart();
    const ro = new ResizeObserver(() => {
      resize();
      restart();
    });
    ro.observe(cv);
    motion.addEventListener("change", restart);
    // Einstellung „Bewegung“ am <html> geändert
    const observer = new MutationObserver(restart);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-effects", "data-live", "data-theme"] });
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      observer.disconnect();
      motion.removeEventListener("change", restart);
      kick.current = () => {};
    };
  }, []);

  return <canvas ref={ref} aria-hidden className={className} />;
}
