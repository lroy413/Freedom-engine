/* Screenshot every view at phone width, in a theme, against a believable book.
   node shots.mjs [light|dark|bushido] [outdir] */
import pkg from 'playwright';
import { SEED } from './seed-real.mjs';
const { chromium } = pkg;
const theme = process.argv[2] || 'light';
const out = process.argv[3] || '/tmp/shots-' + theme;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 402, height: 874 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://localhost:8899/index.html'); await p.waitForTimeout(900);
await SEED(p);
await p.evaluate(t => { db.settings.theme = t; syncTheme(); saveAll(); }, theme);
await p.waitForTimeout(800);
const views = ['dash', 'accounts', 'income', 'expenses', 'budget', 'goals', 'credit', 'invest', 'retire', 'tax', 'business', 'data'];
for (const v of views) {
  await p.evaluate(x => { setView(x); }, v);
  await p.waitForTimeout(700);
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(250);
  await p.screenshot({ path: `${out}/${v}.png`, fullPage: true });
}
console.log(theme, '→', out, '| page errors:', errs.length ? errs : 'none');
await b.close();
