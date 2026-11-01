// Browser-Smoke-Test (manuell vor Releases): Chat-Fluss, Mobil-Layout, CSP-/Konsolenfehler.
// Aufruf: ALLOW_DEMO_MODE=true npm run build && ALLOW_DEMO_MODE=true npx next start -p 3200 &
//         BASE_URL=http://localhost:3200 node scripts/smoke-browser.cjs   (Playwright + Chromium nötig)
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://localhost:3200';
const OUT = process.env.SCREENSHOT_DIR || '.';
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1480, height: 920 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => m.type() === 'error' && errors.push('console: ' + m.text()));
  await page.goto(BASE + '/');
  await page.waitForURL(/\/chat\/.+/);
  await page.waitForTimeout(800);
  await page.screenshot({ path: OUT + '/v2-empty.png' });
  await page.fill('textarea', 'Wir planen ein SaaS: Monolith oder Microservices für die Architektur?');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelectorAll('[aria-label="Senden"]').length === 1, null, { timeout: 60000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + '/v2-router.png' });
  const replies = await page.locator('[data-ai-generated="true"]').count();
  console.log('ai replies', replies);
  // second message immediately: free tier 5/min → expect rate limit error banner eventually
  await page.fill('textarea', '@Claude was meinst du?');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);
  const banner = await page.locator('.text-red-300').allTextContents();
  console.log('banner', banner);
  // mobile
  // Gleicher Kontext = gleicher Demo-Besucher (eigener Datenbestand je Besucher-Cookie).
  const m = await ctx.newPage();
  await m.setViewportSize({ width: 390, height: 844 });
  m.on('console', msg => msg.type() === 'error' && errors.push('mobile console: ' + msg.text()));
  await m.goto(page.url());
  await m.waitForTimeout(800);
  await m.screenshot({ path: OUT + '/v2-mobile.png' });
  await m.click('[aria-label="Navigation öffnen"]');
  await m.waitForTimeout(300);
  await m.screenshot({ path: OUT + '/v2-mobile-nav.png' });
  await m.click('[aria-label="Navigation schließen"]');
  await m.click('[aria-label="Steuerung & Agenten-Studio"]');
  await m.waitForTimeout(300);
  await m.screenshot({ path: OUT + '/v2-mobile-panel.png' });
  await page.goto(BASE + '/billing');
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + '/v2-billing.png', fullPage: true });
  await page.goto(BASE + '/datenschutz');
  await page.screenshot({ path: OUT + '/v2-datenschutz.png' });
  console.log('errors', JSON.stringify(errors, null, 1));
  if (errors.length || replies < 1) process.exitCode = 1;
  await browser.close();
})();
