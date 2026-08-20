/* Unplanned spending: does grouping the glasses actually answer the question?

   The point of tagging is not the tag. It is that a month with a $700 medical
   episode in it should stop reading as a spending problem, and that a year of
   those episodes should add up to a number you can hold a buffer against.
   These assertions check the arithmetic behind both, and that nothing is
   hidden from the totals to get there. */
import pkg from 'playwright';
import { SEED } from './seed-real.mjs';
const { chromium } = pkg;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 402, height: 900 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://localhost:8899/index.html'); await p.waitForTimeout(800);
let pass = 0, fail = 0;
const chk = (n, g, w) => { const ok = JSON.stringify(g) === JSON.stringify(w);
  console.log((ok ? '  ok   ' : '  FAIL ') + n + (ok ? '' : `  got ${JSON.stringify(g)} want ${JSON.stringify(w)}`)); ok ? pass++ : fail++; };
const ev = fn => p.evaluate(fn);

await SEED(p); await p.waitForTimeout(400);
await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1300);

console.log('— an episode is one thing, not three —');
chk('it gathers what it took', await ev(() => oneoffTxs('oo1').length), 4);
/* 145 + 295 + 262 = 702, less the 180 the vision plan sent back */
chk('and nets off what came back', await ev(() => Math.round(oneoffNet('oo1'))), 522);
chk('a closed one still counts', await ev(() => Math.round(oneoffNet('oo2'))), 735);
chk('the span reads from the first to the last', await ev(() => {
  const s = oneoffSpan('oo1'); return s.from < s.to; }), true);
chk('running vs settled', await ev(() =>
  [oneoffRunning(oneoffOf('oo1')), oneoffRunning(oneoffOf('oo2'))]), [true, false]);

console.log('\n— nothing is hidden from the real totals —');
chk('the money still left the envelope', await ev(() => {
  const mk = monthKey(todayISO());
  /* the lenses are Health spending in this month whether or not they are tagged */
  return spentFor('Health', mk) >= 262; }), true);
chk('but the habit figure leaves it out', await ev(() => {
  const mk = monthKey(todayISO());
  return Math.round(spentFor('Health', mk) - plannedSpentFor('Health', mk)); }), 262);
chk('  and a refund is not counted as spending either', await ev(() => {
  const mk = monthKey(todayISO());
  return spentFor('Health', mk) === plannedSpentFor('Health', mk) + 262; }), true);

console.log('\n— the questions tagging was for —');
chk('this month knows what was unplanned', await ev(() => {
  const mk = monthKey(todayISO());
  /* 262 out, 180 back */
  return Math.round(unplannedIn(mk)); }), 82);
chk('a rolling year adds up', await ev(() => {
  const y = unplannedYear(12);
  return [Math.round(y.total), y.episodes, y.months]; }), [1257, 2, 12]);
chk('  and reduces to a monthly figure', await ev(() => {
  const y = unplannedYear(12); return Math.abs(y.perMonth - y.total / 12) < 0.01; }), true);
chk('  broken down by kind, biggest first', await ev(() =>
  unplannedYear(12).byKind.map(x => x[0])), ['repair', 'medical']);

console.log('\n— the card on Spending —');
await ev(() => setView('expenses')); await p.waitForTimeout(700);
chk('both episodes are listed', await ev(() =>
  document.querySelectorAll('#oneoffCard [data-oneopen]').length), 2);
chk('the headline is the rolling year, not the month', await ev(() =>
  /last 12 months/.test(document.getElementById('oneoffCard').textContent)), true);
chk('a settled one says so', await ev(() =>
  /settled/.test(document.getElementById('oneoffCard').textContent)), true);
chk('the transaction row names what it belongs to', await ev(() => {
  const r = [...document.querySelectorAll('#txTable .trow')]
    .find(x => /Lenses/.test(x.textContent));
  return !!r && /New glasses/.test(r.textContent); }), true);

console.log('\n— filtering down to one thing —');
chk('unplanned only', await ev(() => {
  txFilter.one = 'any'; renderTx();
  return document.querySelectorAll('#txTable .trow').length; }), 6);
chk('just the glasses', await ev(() => {
  txFilter.one = 'oo1'; renderTx();
  return document.querySelectorAll('#txTable .trow').length; }), 4);
chk('planned only leaves them all out', await ev(() => {
  txFilter.one = 'none'; renderTx();
  return [...document.querySelectorAll('#txTable .trow')].some(r => /Warby|Lenses|Towing/.test(r.textContent)); }), false);
chk('  and it shows as a chip you can clear', await ev(() => {
  const had = !!document.querySelector('#txChips [data-fdrop="one"]');
  document.querySelector('#txChips [data-fdrop="one"]').click();
  return [had, txFilter.one]; }), [true, 'all']);

console.log('\n— the sheet —');
await ev(() => openOneoff('oo1')); await p.waitForTimeout(500);
chk('it opens on the episode', await ev(() =>
  document.getElementById('editTitle').textContent), 'New glasses');
chk('it shows what it cost, net', await ev(() =>
  /\$522\.00/.test(document.getElementById('editSheetBody').textContent)), true);
chk('  and says the refund was taken off', await ev(() =>
  /came back/.test(document.getElementById('editSheetBody').textContent)), true);
chk('every item is listed', await ev(() =>
  document.querySelectorAll('#editSheetBody [data-onedrop]').length), 4);

console.log('\n— attaching and detaching —');
chk('taking one out leaves the transaction alone', await ev(async () => {
  document.querySelector('[data-onedrop="oo1c"]').click();
  await new Promise(r => setTimeout(r, 300));
  const t = db.transactions.find(x => x.id === 'oo1c');
  return { stillThere: !!t, untagged: !t.oneId, now: Math.round(oneoffNet('oo1')) }; }),
  { stillThere: true, untagged: true, now: 260 });
chk('the picker offers it back', await ev(async () => {
  document.getElementById('one-addtoggle').click();
  await new Promise(r => setTimeout(r, 300));
  return !!document.querySelector('[data-oneadd="oo1c"]'); }), true);
chk('  and adding it puts the total back', await ev(async () => {
  document.querySelector('[data-oneadd="oo1c"]').click();
  await new Promise(r => setTimeout(r, 300));
  return Math.round(oneoffNet('oo1')); }), 522);
chk('the search narrows the picker', await ev(async () => {
  _oneQ = 'kroger'; renderEditor();
  await new Promise(r => setTimeout(r, 250));
  const rows = [...document.querySelectorAll('[data-oneadd]')];
  return rows.length > 0 && rows.every(r => /kroger/i.test(r.textContent)); }), true);
chk('already-attached spending is never offered twice', await ev(() => {
  _oneQ = ''; renderEditor();
  return [...document.querySelectorAll('[data-oneadd]')]
    .some(el => db.transactions.find(t => t.id === el.dataset.oneadd).oneId); }), false);

console.log('\n— settling and deleting —');
chk('mark settled, then reopen', await ev(async () => {
  document.getElementById('one-close').click();
  await new Promise(r => setTimeout(r, 250));
  const shut = !!oneoffOf('oo1').closed;
  document.getElementById('one-close').click();
  await new Promise(r => setTimeout(r, 250));
  return [shut, !!oneoffOf('oo1').closed]; }), [true, false]);
chk('deleting the group keeps the spending', await ev(async () => {
  const btn = document.getElementById('one-del');
  btn.click(); await new Promise(r => setTimeout(r, 120));
  btn.click(); await new Promise(r => setTimeout(r, 500));
  return { gone: !oneoffOf('oo1'),
    txKept: ['oo1a', 'oo1b', 'oo1c', 'oo1d'].every(id => db.transactions.some(t => t.id === id)),
    untagged: !db.transactions.some(t => t.oneId === 'oo1') }; }),
  { gone: true, txKept: true, untagged: true });

console.log('\n— a link that points at nothing is worse than no link —');
chk('normalize drops a dangling tag rather than orphaning the spend', await ev(() => {
  db.transactions[0].oneId = 'does-not-exist';
  normalize();
  return db.transactions[0].oneId === undefined; }), true);

console.log('\n— an unlucky month is not a splurge —');
/* A believable month, so the earlier naming rules do not win on a technicality:
   spending on every elapsed day (no quiet streak), a different merchant each
   time (no "Regular"), and rotating categories (no category taking 40%). */
const MONTH = (tagged) => p.evaluate((tagged) => {
  const mk = monthKey(todayISO()), elapsed = dayOf(todayISO()).getDate();
  const cats = ['Groceries', 'Restaurants', 'Coffee', 'Entertainment'];
  db.oneoffs = [{ id: 'x1', name: 'Root canal', kind: 'medical', opened: todayISO(), closed: '', note: '' }];
  db.transactions = [];
  for (let d = 1; d <= elapsed; d++)
    db.transactions.push({ id: 'd' + d, date: `${mk}-${String(d).padStart(2, '0')}`,
      desc: 'Shop ' + d, category: cats[d % 4], amount: -20 });
  /* the same three big-ticket items either way — only the tag changes */
  [['Endodontist', 'Health', -500], ['Burst pipe', 'Home Maintenance', -500], ['Rental car', 'Auto & Gas', -400]]
    .forEach(([desc, category, amount], k) => db.transactions.push({
      id: 'big' + k, date: `${mk}-${String(Math.min(elapsed, 10 + k)).padStart(2, '0')}`,
      desc, category, amount, ...(tagged ? { oneId: 'x1' } : {}) }));
  const pm = (() => { const d = dayOf(todayISO()); d.setDate(1); d.setMonth(d.getMonth() - 1); return monthOf(d); })();
  db.transactions.push({ id: 'prev', date: pm + '-05', desc: 'Last month', category: 'Groceries', amount: -20 * elapsed });
  const r = monthRecap(mk);
  return { title: recapTitle(r).t, line: recapTitle(r).s, unplanned: Math.round(r.unplanned), spend: Math.round(r.spend) };
}, tagged);

const unlucky = await MONTH(true);
chk('a month carried by one medical episode', unlucky.title, 'The Unlucky One');
chk('  and the recap says what it was without it', /Take that out and you spent/.test(unlucky.line), true);
chk('  the unplanned figure is the tagged spending', unlucky.unplanned, 1400);
const splurge = await MONTH(false);
chk('the same month untagged is a splurge', splurge.title, 'The Splurge');
chk('  identical spending either way — only the label moved',
  [splurge.spend, unlucky.spend, splurge.unplanned], [unlucky.spend, unlucky.spend, 0]);

console.log(`\n${pass} passed, ${fail} failed`);
console.log('page errors:', errs.length ? errs : 'none');
await b.close();
if (fail || errs.length) process.exitCode = 1;
