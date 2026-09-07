import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL,
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
await page.goto(process.env.RESEARCH_TREE_URL || 'http://localhost:5173', {
  waitUntil: 'networkidle',
});
console.log((await page.locator('body').innerText()).slice(0, 2500));
await page.screenshot({ path: 'work/ui-initial.png' });
await browser.close();
