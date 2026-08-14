/* A machine pass over every screen, looking for the small things that make an
   app feel unfinished: a raw ISO date where a person would write "Aug 14",
   "in 1 days", a name clipped to an ellipsis, a row of cards that wraps
   ragged, a tap target too small for a thumb, text that doesn't meet contrast.
   node polish.mjs [theme] [width] */
import pkg from 'playwright';
import { SEED } from './seed-real.mjs';
const { chromium } = pkg;
const theme = process.argv[2] || 'light';
const W = +(process.argv[3] || 402);
const phone = W < 820;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: W, height: phone ? 874 : 950 },
  hasTouch: phone, isMobile: phone });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://localhost:8899/index.html'); await p.waitForTimeout(900);
await SEED(p);
await p.evaluate(t => { db.settings.theme = t; syncTheme(); saveAll(); }, theme);
await p.waitForTimeout(700);

const VIEWS = ['dash', 'accounts', 'income', 'expenses', 'budget', 'goals', 'credit', 'invest', 'retire', 'tax', 'business', 'data'];
const found = { iso: [], plural: [], clipped: [], ragged: [], tiny: [], contrast: [], overflow: [], wide: [], stranded: [] };

for (const v of VIEWS) {
  await p.evaluate(x => setView(x), v);
  await p.waitForTimeout(600);
  const r = await p.evaluate((view) => {
    const root = document.querySelector('.view.active');
    const out = { iso: [], plural: [], clipped: [], ragged: [], tiny: [], contrast: [], overflow: [], wide: [], stranded: [] };
    if (!root) return out;
    const vis = el => { const s = getComputedStyle(el); const b = el.getBoundingClientRect();
      return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > .05 && b.width > 0 && b.height > 0; };

    /* raw ISO dates in text a person reads */
    const ISO = /\b(19|20)\d\d-\d\d-\d\d\b/;
    for (const el of root.querySelectorAll('*')) {
      if (!vis(el) || el.children.length) continue;
      const t = (el.textContent || '').trim();
      if (ISO.test(t)) out.iso.push(view + ' · ' + (el.className || el.tagName) + ' · ' + t.slice(0, 60));
      /* "in 1 days", "1 items", "1 payments" */
      const m = t.match(/\b1\s+(days?|items?|payments?|months?|years?|weeks?|holdings?|accounts?|transactions?|businesses)\b/i);
      if (m && /s$/i.test(m[1])) out.plural.push(view + ' · ' + t.slice(0, 60));
    }
    /* text clipped by an ellipsis */
    for (const el of root.querySelectorAll('*')) {
      if (!vis(el)) continue;
      const s = getComputedStyle(el);
      if (s.textOverflow !== 'ellipsis') continue;
      if (el.scrollWidth > el.clientWidth + 1)
        out.clipped.push(view + ' · .' + String(el.className).split(' ')[0] + ' · ' + (el.textContent || '').trim().slice(0, 44));
    }
    /* a grid of cards whose last row is short — three in a two-across grid */
    for (const g of root.querySelectorAll('.grid, .kpis, .dh-stats')) {
      if (!vis(g)) continue;
      const kids = [...g.children].filter(vis);
      if (kids.length < 3) continue;
      const rows = {};
      kids.forEach(k => { const y = Math.round(k.getBoundingClientRect().top); (rows[y] = rows[y] || []).push(k); });
      const counts = Object.values(rows).map(r => r.length);
      /* a short last row is only ragged if it leaves a hole — a last card that
         deliberately spans the full width is finished, not left over */
      const lastRow = Object.values(rows)[Object.values(rows).length - 1];
      const fills = lastRow.length === 1 &&
        Math.abs(lastRow[0].getBoundingClientRect().width - g.getBoundingClientRect().width) < 3;
      if (counts.length > 1 && counts[counts.length - 1] < counts[0] && !fills)
        out.ragged.push(view + ' · .' + String(g.className).split(' ')[0] + ' · ' + counts.join('+') + ' of ' + kids.length);
    }
    /* Tap targets, measured as the thumb meets them. This app grows hit areas
       with an invisible ::before rather than by making controls bigger, so the
       element's own box is the wrong thing to measure — take the union. */
    const hitBox = el => {
      const b = el.getBoundingClientRect();
      let w = b.width, h = b.height;
      for (const pseudo of ['::before', '::after']) {
        const s = getComputedStyle(el, pseudo);
        if (!s || s.content === 'none' || s.position !== 'absolute') continue;
        const px = v => (v && v.endsWith('px')) ? parseFloat(v) : 0;
        w = Math.max(w, b.width - px(s.left) - px(s.right));
        h = Math.max(h, b.height - px(s.top) - px(s.bottom));
      }
      return { w, h };
    };
    for (const el of root.querySelectorAll('button, a, select, input[type=checkbox], [role=button]')) {
      if (!vis(el)) continue;
      /* a checkbox wrapped in a label is tapped by the whole label */
      const lab = el.type === 'checkbox' ? el.closest('label') : null;
      const { w, h } = hitBox(lab || el);
      if (h < 30 || w < 26)
        out.tiny.push(view + ' · ' + el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0] +
          ' · ' + Math.round(w) + '×' + Math.round(h) + ' · ' + (el.textContent || '').trim().slice(0, 26));
    }
    /* contrast: body text against what is actually behind it */
    /* color-mix() computes to `color(srgb 0.94 0.92 0.87)` — 0-to-1 channels,
       not 0-to-255. Reading those as bytes makes a cream background look
       near-black and invents contrast failures that aren't there. */
    const lumRGB = ([r, g, bl]) => {
      const f = x => { x /= 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); };
      return .2126 * f(r) + .7152 * f(g) + .0722 * f(bl); };
    /* A gradient is a background-image, not a background-color, so walking for
       a colour sails straight past every hero and compares white text against
       the page behind it. There is no single colour to compare against there —
       skip rather than report a number that is not true. */
    /* Returns [r,g,b] 0-255, compositing every translucent layer over the one
       behind it. A 12% wash read as its own pure colour is how a perfectly
       legible badge gets reported at 1.5:1. */
    const chan = c => { const n = (c.match(/[\d.]+/g) || []).map(Number);
      const sc = /^color\(/.test(c.trim()) ? 255 : 1;
      const a = /^(rgba|color)/.test(c.trim()) && n.length > 3 ? n[3] : 1;
      return { rgb: [n[0] * sc, n[1] * sc, n[2] * sc], a }; };
    const bgOf = el => {
      const stack = [];
      let n = el;
      while (n && n !== document.documentElement) {
        const s = getComputedStyle(n);
        if (s.backgroundImage && s.backgroundImage !== 'none') return null;   // a gradient: no one colour
        const c = s.backgroundColor;
        if (c && c !== 'transparent') { const { rgb, a } = chan(c); if (a > 0) { stack.push({ rgb, a }); if (a >= 1) break; } }
        n = n.parentElement;
      }
      const base = chan(getComputedStyle(document.body).backgroundColor).rgb;
      let out = (stack.length && stack[stack.length - 1].a >= 1) ? stack.pop().rgb : base;
      for (let i = stack.length - 1; i >= 0; i--) {
        const { rgb, a } = stack[i];
        out = out.map((v, k) => rgb[k] * a + v * (1 - a));
      }
      return out;
    };
    for (const el of root.querySelectorAll('*')) {
      if (!vis(el) || el.children.length) continue;
      const t = (el.textContent || '').trim(); if (t.length < 4) continue;
      const s = getComputedStyle(el);
      const size = parseFloat(s.fontSize), weight = +s.fontWeight || 400;
      const large = size >= 24 || (size >= 18.66 && weight >= 700);
      const bg = bgOf(el); if (!bg) continue;
      try {
        const L1 = lumRGB(chan(s.color).rgb), L2 = lumRGB(bg);
        const ratio = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
        if (ratio < (large ? 3 : 4.5))
          out.contrast.push(view + ' · ' + ratio.toFixed(2) + ':1 · ' + Math.round(size) + 'px · ' + t.slice(0, 44));
      } catch (e) { }
    }
    /* ---- what only goes wrong on a big screen ---- */
    if (window.innerWidth >= 820) {
      /* A line of prose past about 90 characters is measurably harder to read:
         the eye loses the start of the next line on the way back. Newspapers
         use columns for exactly this reason and a 1440px card does not. */
      for (const el of root.querySelectorAll('p, .note, .lead, .muted, .empty, .hint')) {
        if (!vis(el)) continue;
        const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (t.length < 90) continue;
        /* Count the lines the browser actually drew rather than estimating an
           average character width — a guess at the advance was reporting a
           645px note as 166 characters wide. */
        let lines = 1;
        try {
          const r = document.createRange(); r.selectNodeContents(el);
          const ys = new Set([...r.getClientRects()].filter(x => x.height > 1).map(x => Math.round(x.top)));
          lines = Math.max(1, ys.size);
        } catch (e) { }
        const chars = t.length / lines;
        if (chars > 95) out.wide.push(view + ' · ' + Math.round(chars) + ' chars a line · ' + t.slice(0, 50));
      }
      /* A control or a value marooned in a sea of card. Fine on a phone where
         the card is 370px; at 1400px it reads as a layout that never grew up. */
      for (const el of root.querySelectorAll('.card')) {
        if (!vis(el)) continue;
        const cw = el.getBoundingClientRect().width;
        if (cw < 700) continue;
        const kids = [...el.children].filter(vis);
        if (kids.length !== 1) continue;
        const k = kids[0].getBoundingClientRect().width;
        if (k < cw * 0.55) out.stranded.push(view + ' · .' + String(el.className).split(' ')[1 ] + ' · content ' + Math.round(k / cw * 100) + '% of a ' + Math.round(cw) + 'px card');
      }
    }
    /* anything pushing the page sideways */
    const de = document.documentElement;
    for (const el of root.querySelectorAll('*')) {
      if (!vis(el)) continue;
      const bb = el.getBoundingClientRect();
      if (bb.right <= de.clientWidth + 2) continue;
      let scroller = false;
      for (let a = el.parentElement; a; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if (o === 'auto' || o === 'scroll') { scroller = true; break; } }
      if (!scroller) out.overflow.push(view + ' · .' + String(el.className).split(' ')[0] + ' · +' + Math.round(bb.right - de.clientWidth) + 'px');
    }
    return out;
  }, v);
  for (const k of Object.keys(found)) found[k].push(...r[k]);
}

const uniq = a => [...new Set(a)];
const show = (title, list, cap = 14) => {
  const u = uniq(list);
  console.log(`\n${title} — ${u.length}`);
  u.slice(0, cap).forEach(x => console.log('   ' + x));
  if (u.length > cap) console.log(`   … ${u.length - cap} more`);
};
console.log(`\n===== ${theme} · ${W}px =====`);
show('RAW ISO DATES shown to the reader', found.iso);
show('PLURAL SLIPS', found.plural);
show('TEXT CLIPPED BY ELLIPSIS', found.clipped);
show('RAGGED CARD GRIDS', found.ragged);
show('TAP TARGETS UNDER 30px', found.tiny, 18);
show('CONTRAST BELOW WCAG AA', found.contrast, 18);
show('HORIZONTAL OVERFLOW', found.overflow);
if (!phone) { show('LINES TOO LONG TO READ COMFORTABLY', found.wide); show('CONTENT MAROONED IN A WIDE CARD', found.stranded); }
console.log('\npage errors:', errs.length ? errs : 'none');
await b.close();
