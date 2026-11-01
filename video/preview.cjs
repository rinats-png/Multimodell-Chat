// Standbilder zu festen Zeiten zur Kontrolle des Layouts.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const times = process.argv.slice(3).map(Number);
  const outDir = process.argv[2];
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('file://' + path.join(__dirname, 'scene.html'));
  await page.evaluate(() => document.fonts.ready);
  for (const t of times) {
    await page.evaluate((t) => window.render(t), t);
    await page.screenshot({ path: path.join(outDir, `still-${t}.jpg`), type: 'jpeg', quality: 70 });
  }
  await browser.close();
})();
