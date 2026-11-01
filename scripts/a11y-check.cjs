// Barrierefreiheits- und Darstellungsprüfung im Browser (Playwright + Chromium nötig).
// Startet die gebaute App selbst (Demo-Modus, freier Port) und prüft Seiten in Hell und Dunkel auf
// Desktop- und Handybreite: Sprache/Titel, Namen für Bedienelemente, Bild-Alternativtexte, seitliches Scrollen,
// Konsolen-/CSP-Fehler, sichtbarer Tastaturfokus und grob den Textkontrast.
// Aufruf: npm run build && node scripts/a11y-check.cjs
// Ausgabe bei Erfolg: "A11Y-CHECK PASSED"; sonst Exit-Code 1 mit der Liste der Befunde.
const { spawn } = require('node:child_process');
const net = require('node:net');
const { chromium } = require('playwright');

const THEMES = [
  { name: 'hell', scheme: 'light', stored: null },
  { name: 'dunkel', scheme: 'dark', stored: null },
  { name: 'dunkel-gewaehlt', scheme: 'light', stored: 'dark' },
];
const WIDTHS = [1440, 390];
const PATHS = ['/billing', '/reports', '/datenschutz', '/impressum', '/login'];
const MIN_CONTRAST = 3; // harte Grenze; der Hintergrund ist Glas über Bewegtbild, daher nur grob geprüft

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
    s.on('error', reject);
  });
}

async function waitFor(url, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const r = await fetch(url, { redirect: 'manual' });
      if (r.status < 500) return;
    } catch {
      /* Server startet noch */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error('Server nicht erreichbar: ' + url);
}

/** Läuft im Browser: sammelt Befunde zu einer geladenen Seite. */
function inspectPage(minContrast) {
  const out = [];
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
  };
  if (!document.documentElement.lang) out.push('html ohne lang');
  if (!document.title.trim()) out.push('Seite ohne Titel');
  if (document.documentElement.scrollWidth > window.innerWidth + 1) {
    out.push(`seitliches Scrollen (${document.documentElement.scrollWidth} > ${window.innerWidth})`);
  }
  const nameOf = (el) => {
    const labelled = el.getAttribute('aria-labelledby');
    if (labelled) return labelled.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ').trim();
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label').trim();
    if (el.labels && el.labels.length) return [...el.labels].map((l) => l.textContent).join(' ').trim();
    if (el.textContent && el.textContent.trim()) return el.textContent.trim();
    if (el.getAttribute('title')) return el.getAttribute('title').trim();
    const img = el.querySelector('img[alt]');
    if (img && img.getAttribute('alt').trim()) return img.getAttribute('alt').trim();
    return '';
  };
  document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=radio], [role=tab]').forEach((el) => {
    if (!visible(el)) return;
    if (!nameOf(el)) out.push(`Bedienelement ohne Namen: <${el.tagName.toLowerCase()} class="${(el.className || '').toString().slice(0, 60)}">`);
  });
  document.querySelectorAll('img').forEach((img) => {
    if (visible(img) && !img.hasAttribute('alt')) out.push('Bild ohne alt: ' + (img.getAttribute('src') || '').slice(0, 60));
  });

  // Grober Kontrast: Hintergründe der Vorfahren übereinanderlegen, unterster Grund ist die Seitenfarbe
  const parse = (c) => {
    const m = c.match(/[\d.]+/g);
    return m ? { r: +m[0], g: +m[1], b: +m[2], a: m[3] === undefined ? 1 : +m[3] } : null;
  };
  const over = (top, base) => ({
    r: top.r * top.a + base.r * (1 - top.a),
    g: top.g * top.a + base.g * (1 - top.a),
    b: top.b * top.a + base.b * (1 - top.a),
    a: 1,
  });
  const lum = (c) => {
    const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const page = parse(getComputedStyle(document.documentElement).getPropertyValue('--color-canvas').trim().startsWith('#')
    ? hexToRgb(getComputedStyle(document.documentElement).getPropertyValue('--color-canvas').trim())
    : 'rgb(128,128,128)') || { r: 128, g: 128, b: 128, a: 1 };
  function hexToRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return `rgb(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255})`;
  }
  let checked = 0;
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode() && checked < 500) {
    const node = walker.currentNode;
    const text = node.textContent.trim();
    const el = node.parentElement;
    if (!text || !el || seen.has(el) || !visible(el)) continue;
    seen.add(el);
    const cs = getComputedStyle(el);
    if (+cs.opacity < 0.2) continue;
    let bg = { ...page };
    const chain = [];
    for (let e = el; e; e = e.parentElement) chain.push(e);
    for (const e of chain.reverse()) {
      const b = parse(getComputedStyle(e).backgroundColor);
      if (b && b.a > 0) bg = over(b, bg);
    }
    const fg = parse(cs.color);
    if (!fg || fg.a === 0) continue; // transparent: Verlaufstext (background-clip)
    // Verlauf oder Bild als Hintergrund: Farbe nicht bestimmbar, daher nicht bewertet
    if (chain.some((e) => getComputedStyle(e).backgroundImage !== 'none')) continue;
    const eff = over({ ...fg, a: fg.a * (+cs.opacity || 1) }, bg);
    const r = ratio(eff, bg);
    checked++;
    if (r < minContrast) out.push(`Kontrast ${r.toFixed(2)}:1 bei „${text.slice(0, 40)}“`);
  }
  return out;
}

(async () => {
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const server = spawn('npx', ['next', 'start', '-p', String(port)], {
    env: { ...process.env, ALLOW_DEMO_MODE: 'true', NODE_ENV: 'production' },
    stdio: 'ignore',
  });
  const failures = [];
  let browser;
  try {
    await waitFor(base + '/login', 60000);
    browser = await chromium.launch();
    let pagesChecked = 0;
    for (const theme of THEMES) {
      for (const width of WIDTHS) {
        const ctx = await browser.newContext({ viewport: { width, height: 860 }, colorScheme: theme.scheme });
        if (theme.stored) await ctx.addInitScript((t) => localStorage.setItem('mm-theme', t), theme.stored);
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
        page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
        const targets = ['/', ...PATHS];
        for (const path of targets) {
          errors.length = 0;
          const res = await page.goto(base + path, { waitUntil: 'load' });
          if (path === '/') await page.waitForURL(/\/chat\/.+/, { timeout: 15000 }).catch(() => {});
          await page.waitForTimeout(500);
          const where = `${theme.name}/${width}px ${page.url().replace(base, '')}`;
          if (!res || res.status() >= 400) {
            // Geschützte Seiten ohne Anmeldung dürfen umleiten; Fehlerseiten nicht
            if (res && res.status() >= 500) failures.push(`${where}: HTTP ${res.status()}`);
          }
          (await page.evaluate(inspectPage, MIN_CONTRAST)).forEach((f) => failures.push(`${where}: ${f}`));
          errors.forEach((e) => failures.push(`${where}: ${e}`));
          // Tastaturfokus: die ersten Stationen müssen sichtbar markiert sein
          await page.keyboard.press('Tab');
          for (let i = 0; i < 12; i++) {
            const info = await page.evaluate(() => {
              const el = document.activeElement;
              if (!el || el === document.body) return null;
              const cs = getComputedStyle(el);
              const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== 'none');
              return { tag: el.tagName.toLowerCase(), label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30), ring };
            });
            if (info && !info.ring) failures.push(`${where}: Fokus nicht sichtbar bei <${info.tag}> „${info.label}“`);
            await page.keyboard.press('Tab');
          }
          pagesChecked++;
        }
        await ctx.close();
      }
    }
    if (failures.length === 0) console.log(`A11Y-CHECK PASSED (${pagesChecked} Seitenansichten, ${THEMES.length} Farbwelten, ${WIDTHS.length} Breiten)`);
    else {
      const unique = [...new Set(failures)];
      console.log(`A11Y-CHECK FAILED: ${unique.length} Befunde`);
      unique.slice(0, 60).forEach((f) => console.log(' - ' + f));
      process.exitCode = 1;
    }
  } catch (e) {
    console.log('A11Y-CHECK ERROR: ' + e.message);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    server.kill('SIGTERM');
  }
})();
