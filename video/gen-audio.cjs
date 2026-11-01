// Erzeugt die Tonspur (Effekte + leiser Musikteppich) rein per Code, ohne fremde Samples.
// Die Zeitpunkte entsprechen den Animationen in scene.html.
const fs = require('fs');
const path = require('path');

const SR = 48000;
const DUR = 50;
const N = SR * DUR;
const L = new Float32Array(N);
const R = new Float32Array(N);

let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const TAU = Math.PI * 2;

function add(i, v, pan = 0) {
  if (i < 0 || i >= N) return;
  L[i] += v * (1 - Math.max(0, pan));
  R[i] += v * (1 + Math.min(0, pan));
}

// Einfacher Zustandsvariablen-Filter
function svf() {
  let low = 0, band = 0;
  return (x, f, q = 0.7) => {
    const F = 2 * Math.sin(Math.PI * Math.min(f, SR / 6) / SR);
    low += F * band;
    const high = x - low - q * band;
    band += F * high;
    return { low, band, high };
  };
}

// --- Effekte (eigener Kanal mit Hall, weiche Klangfarben statt reiner Sinus/Rechteck) ---
const FL = new Float32Array(N), FR = new Float32Array(N);
function fx(i, v, pan = 0) {
  if (i < 0 || i >= N) return;
  FL[i] += v * (1 - Math.max(0, pan) * 0.7);
  FR[i] += v * (1 + Math.min(0, pan) * 0.7);
}
function onePole() { let y = 0; return (x, fc) => { const a = 1 - Math.exp((-TAU * fc) / SR); y += a * (x - y); return y; }; }
// Weicher Ton: gefilterte Sägezahn-Mischung mit leicht verstimmter Kopie -> warm, nicht metallisch
function softTone(t, freq, dur, vol, { attack = 0.004, decay = 6, cutoff = 2200, cutoffEnd = 600, pan = 0, glide = 0 } = {}) {
  const s = Math.floor(t * SR), n = Math.floor(dur * SR);
  const lp1 = onePole(), lp2 = onePole();
  let p1 = 0, p2 = 0;
  for (let k = 0; k < n; k++) {
    const tt = k / SR;
    const fr = freq * (1 + glide * Math.exp(-tt * 40));
    p1 = (p1 + fr / SR) % 1; p2 = (p2 + (fr * 1.006) / SR) % 1;
    const raw = (p1 * 2 - 1) * 0.5 + (p2 * 2 - 1) * 0.5;
    const fc = cutoffEnd + (cutoff - cutoffEnd) * Math.exp(-tt * decay * 0.8);
    const y = lp2(lp1(raw, fc), fc);
    const env = Math.min(1, tt / attack) * Math.exp(-tt * decay);
    fx(s + k, y * env * vol, pan);
  }
}
function whoosh(t, dur = 0.7, vol = 0.35, up = true) {
  const fA = svf(), fB = svf();
  const s = Math.floor(t * SR), n = Math.floor(dur * SR);
  for (let k = 0; k < n; k++) {
    const p = k / n;
    const env = Math.pow(Math.sin(Math.PI * Math.pow(p, up ? 0.8 : 1.2)), 2);
    const fc = up ? 250 + 3200 * p * p : 3400 - 3100 * p;
    const a = fA(rnd(), fc, 0.9).band, b = fB(rnd(), fc * 1.15, 0.9).band;
    const pan = (p - 0.5) * 1.4;
    fx(s + k, (a * (1 - pan) * 0.5 + b * 0.2) * env * vol * 1.6, pan);
  }
}
// "Bubble"-Pop: kurzer Tonhöhen-Aufstieg, gefiltert, mit weichem Anschlag
function pop(t, freq = 700, vol = 0.35, pan = 0) {
  const s = Math.floor(t * SR), n = Math.floor(0.16 * SR);
  const lp = onePole();
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const tt = k / SR;
    const fr = freq * (0.75 + 0.5 * (1 - Math.exp(-tt * 45)));
    ph += (TAU * fr) / SR;
    const tri = (2 / Math.PI) * Math.asin(Math.sin(ph));
    const env = Math.min(1, tt / 0.003) * Math.exp(-tt * 28);
    fx(s + k, lp(tri, 3000) * env * vol, pan);
  }
}
function tick(t, freq = 2400, vol = 0.12) {
  const s = Math.floor(t * SR), n = Math.floor(0.03 * SR);
  const f = svf();
  for (let k = 0; k < n; k++) { const tt = k / SR; fx(s + k, f(rnd(), freq, 1.2).band * Math.exp(-tt * 180) * vol * 2.2); }
}
// Bestätigung: zwei weiche Töne im Abstand einer großen Terz, leicht versetzt
function ding(t, base = 880, vol = 0.22) {
  softTone(t, base, 0.9, vol, { decay: 7, cutoff: 3200, cutoffEnd: 900, pan: 0.2 });
  softTone(t + 0.07, base * 1.26, 0.9, vol * 0.9, { decay: 7, cutoff: 3200, cutoffEnd: 900, pan: 0.35 });
}
// Widerspruch: tiefer, abwärts gleitender weicher Doppelton (statt Brummen)
function contra(t, vol = 0.3) {
  softTone(t, 311, 0.5, vol, { decay: 9, cutoff: 1400, cutoffEnd: 300, pan: -0.25 });
  softTone(t + 0.09, 233, 0.6, vol, { decay: 8, cutoff: 1200, cutoffEnd: 250, pan: -0.35 });
  thud(t, vol * 0.8);
}
function thud(t, vol = 0.45) {
  const s = Math.floor(t * SR), n = Math.floor(0.35 * SR);
  const lp = onePole();
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const tt = k / SR;
    ph += (TAU * (55 + 60 * Math.exp(-tt * 25))) / SR;
    const env = Math.min(1, tt / 0.004) * Math.exp(-tt * 11);
    fx(s + k, (Math.sin(ph) + lp(rnd(), 400) * 0.6) * env * vol, -0.1);
  }
}
function buzz() {}
function impact(t, vol = 0.8) {
  const s = Math.floor(t * SR), n = Math.floor(2.4 * SR);
  const lp = onePole(), lp2 = onePole();
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const tt = k / SR;
    ph += (TAU * (34 + 55 * Math.exp(-tt * 9))) / SR;
    const sub = Math.sin(ph) * Math.min(1, tt / 0.006) * Math.exp(-tt * 1.9);
    const body = lp2(lp(rnd(), 1800 * Math.exp(-tt * 6) + 120), 1800) * Math.exp(-tt * 5) * 2.2;
    const v = Math.tanh((sub * 1.1 + body) * 1.2) * vol;
    fx(s + k, v, 0);
  }
}
// Schimmer: weiche Akkordtöne mit langsamem Einsatz (Pad-Glanz, keine Glocke)
function chime(t, vol = 0.18) {
  [659.25, 830.61, 987.77, 1318.5].forEach((fr, i) => {
    softTone(t + i * 0.06, fr, 2.4, vol * 0.8, { attack: 0.03, decay: 1.8, cutoff: 3600, cutoffEnd: 1500, pan: i % 2 ? 0.5 : -0.5 });
  });
}
function riser(t, dur, vol = 0.22) {
  const f = svf();
  const s = Math.floor(t * SR), n = Math.floor(dur * SR);
  const lp = onePole();
  let p1 = 0, p2 = 0;
  for (let k = 0; k < n; k++) {
    const p = k / n;
    const fr = 110 + 440 * p * p;
    p1 = (p1 + fr / SR) % 1; p2 = (p2 + (fr * 1.01) / SR) % 1;
    const saw = lp((p1 + p2 - 1), 400 + 4000 * p);
    const no = f(rnd(), 600 + 6000 * p, 0.8).band;
    fx(s + k, (saw * 0.5 + no * 0.8) * p * p * vol, (p - 0.5) * 0.6);
  }
}
function sweep(t, dur = 1.1, vol = 0.1) {
  softTone(t, 392, dur, vol, { attack: 0.3, decay: 2.5, cutoff: 1800, cutoffEnd: 900, pan: 0.2, glide: 0 });
}

// --- Musikteppich: Pad (Am – F – C – G) und Puls ab der Debatte ---
const chords = [[220, 261.63, 329.63], [174.61, 220, 261.63], [261.63, 329.63, 392], [196, 246.94, 293.66]];
const BPM = 110, beat = 60 / BPM, bar = beat * 4;
{
  // Warmer Pad: je Akkordton zwei leicht verstimmte Sägezähne, doppelt tiefpassgefiltert, langsam atmend
  const voices = [0, 1, 2].map(() => ({ p1: 0, p2: 0, lpA: 0, lpB: 0 }));
  const lpL = { y: 0 };
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const ci = Math.floor(t / (bar * 2)) % 4;
    const c = chords[ci];
    const posInChord = (t % (bar * 2)) / (bar * 2);
    const xf = Math.min(1, posInChord * 12) * Math.min(1, (1 - posInChord) * 12);
    const fadeIn = Math.min(1, t / 3), fadeOut = Math.min(1, Math.max(0, (DUR - t) / 2.5));
    const fc = 700 + 350 * Math.sin(TAU * 0.11 * t);
    const a = 1 - Math.exp((-TAU * fc) / SR);
    let v = 0;
    c.forEach((fr, j) => {
      const vo = voices[j];
      vo.p1 = (vo.p1 + (fr / 2) / SR) % 1; vo.p2 = (vo.p2 + (fr / 2 * 1.004) / SR) % 1;
      const raw = (vo.p1 + vo.p2 - 1);
      vo.lpA += a * (raw - vo.lpA); vo.lpB += a * (vo.lpA - vo.lpB);
      v += vo.lpB;
    });
    lpL.y += 0.02 * (v - lpL.y);
    const level = t > 44.2 ? 0.16 : t > 11.2 ? 0.1 : 0.13;
    add(i, v * level * xf * fadeIn * fadeOut, Math.sin(t * 0.5) * 0.3);
  }
}
for (let bt = 11.2; bt < 44.0; bt += beat) {
  const s = Math.floor(bt * SR), n = Math.floor(0.22 * SR);
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const tt = k / SR;
    ph += (TAU * (48 + 80 * Math.exp(-tt * 40))) / SR;
    add(s + k, Math.sin(ph) * Math.min(1, tt / 0.003) * Math.exp(-tt * 14) * 0.26);
  }
  const hs = Math.floor((bt + beat / 2) * SR);
  // Hi-Hat: hochpassgefiltertes, kurz abklingendes Rauschen, leise (kein breitbandiges Klicken)
  const hf = svf();
  for (let k = 0; k < 0.06 * SR; k++) { const tt = k / SR; add(hs + k, hf(rnd(), 8000, 0.7).high * Math.min(1, tt / 0.002) * Math.exp(-tt * 70) * 0.03, 0.3); }
}

// --- Ereignisse (Zeiten aus scene.html) ---
// S1
whoosh(0.15, 0.6, 0.15);
pop(0.8, 620, 0.32, 0.3);
pop(1.6, 520, 0.32, -0.3);
for (let k = 0; k < 16; k++) tick(1.9 + k * 0.062, 2200 + (k % 3) * 300, 0.07);
whoosh(3.0, 0.6, 0.15);
contra(4.0, 0.34);
whoosh(5.55, 0.6, 0.32);
// S2
whoosh(6.25, 0.7, 0.18);
riser(7.2, 1.55, 0.25);
impact(8.75, 0.85);
chime(8.8, 0.13);
sweep(9.0, 0.8, 0.06);
whoosh(10.75, 0.6, 0.32);
// S3
whoosh(11.35, 0.6, 0.16);
for (let i = 0; i < 5; i++) tick(11.7 + i * 0.12, 1800 + i * 200, 0.1);
const chipKind = ['neutral', 'contra', 'contra', 'pro', 'pro'];
for (let i = 0; i < 5; i++) {
  const s = 12.6 + i * 1.55;
  pop(s, 560 + i * 40, 0.3, 0.35);
  if (chipKind[i] === 'contra') contra(s + 0.45, 0.3);
  else if (chipKind[i] === 'pro') ding(s + 0.45, 880, 0.2);
  else tick(s + 0.45, 1500, 0.1);
}
whoosh(20.95, 0.6, 0.32);
// S4
whoosh(21.55, 0.6, 0.16);
for (let i = 0; i < 4; i++) {
  const s = 22.6 + i * 1.7;
  thud(s, 0.3);
  ding(s + 0.55, 659.25 * Math.pow(2, (i * 2) / 12), 0.22);
}
chime(29.6, 0.09);
whoosh(30.55, 0.6, 0.32);
// S5
whoosh(31.15, 0.6, 0.16);
[31.6, 32.35, 33.1].forEach((t, i) => { pop(t, 600 + i * 150, 0.28); tick(t + 0.2, 2600, 0.08); });
whoosh(33.75, 0.6, 0.22, false);
[34.4, 34.65, 34.9].forEach((t) => sweep(t, 1.1, 0.07));
impact(36.0, 0.65);
pop(36.6, 700, 0.22); pop(37.1, 640, 0.22); pop(37.6, 760, 0.2);
whoosh(38.95, 0.6, 0.32);
// S6
whoosh(39.55, 0.6, 0.16);
for (let i = 0; i < 13; i++) pop(40.0 + i * 0.18, 500 + i * 45, 0.2, i % 2 ? 0.4 : -0.4);
whoosh(43.75, 0.6, 0.32);
// S7
thud(44.4, 0.4);
riser(44.4, 0.9, 0.16);
impact(45.3, 0.95);
chime(46.5, 0.14);
pop(47.3, 880, 0.3);
chime(48.2, 0.07);

// Hall (Freeverb-Prinzip: parallele Kammfilter + Allpässe) auf dem Effekt-Kanal, dann zur Summe
function reverb(inp, offset) {
  const combs = [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116].map((d) => Math.round((d + offset) * SR / 44100));
  const aps = [556, 441, 341, 225].map((d) => Math.round((d + offset) * SR / 44100));
  const out = new Float32Array(N);
  const fb = 0.8, damp = 0.35;
  for (const d of combs) {
    const buf = new Float32Array(d); let idx = 0, store = 0;
    for (let i = 0; i < N; i++) {
      const y = buf[idx];
      store = y * (1 - damp) + store * damp;
      buf[idx] = inp[i] * 0.015 + store * fb;
      idx = (idx + 1) % d;
      out[i] += y;
    }
  }
  for (const d of aps) {
    const buf = new Float32Array(d); let idx = 0;
    for (let i = 0; i < N; i++) {
      const b = buf[idx];
      const y = -out[i] + b;
      buf[idx] = out[i] + b * 0.5;
      idx = (idx + 1) % d;
      out[i] = y;
    }
  }
  return out;
}
const RL = reverb(FL, 0), RR = reverb(FR, 23);
const WET = 0.55;
for (let i = 0; i < N; i++) { L[i] += FL[i] + RL[i] * WET; R[i] += FR[i] + RR[i] * WET; }

// Normalisieren mit weicher Begrenzung
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const g = 0.9 / Math.max(peak, 1e-6);
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8);
buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  buf.writeInt16LE(Math.round(Math.tanh(L[i] * g * 1.1) * 32000), 44 + i * 4);
  buf.writeInt16LE(Math.round(Math.tanh(R[i] * g * 1.1) * 32000), 46 + i * 4);
}
const out = path.join(__dirname, 'out', 'audio.wav');
fs.writeFileSync(out, buf);
console.log('Tonspur geschrieben:', out, 'Spitze vor Normalisierung', peak.toFixed(2));
