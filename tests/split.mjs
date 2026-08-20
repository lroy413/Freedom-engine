/* Splitting one purchase across categories.

   The invariant that matters: a split changes where the money is filed and
   nothing else. Same month total, same account, same date, same everything the
   rest of the app adds up. If a split can move the monthly total by a penny,
   every figure built on it is now arguing with the bank statement. */
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
const ev = (fn, a) => p.evaluate(fn, a);

await SEED(p); await p.waitForTimeout(400);
await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1300);

/* one Walmart run, filed entirely under Groceries */
await ev(() => {
  const mk = monthKey(todayISO());
  db.transactions.push({ id: 'wm', date: mk + '-08', desc: 'Walmart Supercenter',
    category: 'Groceries', amount: -140, acctId: 'nfc' });
  saveAll();
}); await p.waitForTimeout(500);

console.log('— the arithmetic —');
chk('a third of $140 lands on the cent', await ev(() => evenAmounts(140, 3)), [46.67, 46.67, 46.66]);
chk('  and always sums back', await ev(() =>
  [3, 4, 6, 7].every(n => Math.abs(evenAmounts(140, n).reduce((a, c) => a + c, 0) - 140) < 0.0001)), true);
chk('percentages do too, remainder on the biggest part', await ev(() =>
  pctToAmounts(140, [33.3, 33.3, 33.4])), [46.62, 46.62, 46.76]);
chk('  a 1/3 each split of 100 gives 33.34/33.33/33.33', await ev(() => {
  const a = pctToAmounts(100, [33.333, 33.333, 33.333]);
  return [a.reduce((x, y) => x + y, 0), a.length]; }), [100, 3]);

console.log('\n— splitting the Walmart run —');
const before = await ev(() => ({
  month: Math.round(monthTotals(monthKey(todayISO())).exp * 100) / 100,
  groceries: Math.round(spentFor('Groceries', monthKey(todayISO())) * 100) / 100,
  count: db.transactions.length }));
await ev(() => { openTxEditor('wm'); }); await p.waitForTimeout(400);
chk('the editor offers it', await ev(() => !!document.getElementById('tx-split')), true);
await ev(() => document.getElementById('tx-split').click()); await p.waitForTimeout(400);
chk('it opens on the whole amount in one part', await ev(() =>
  [_txSplit.parts.length, _txSplit.parts[0].amt, _txSplit.parts[1].amt]), [2, 140, 0]);
/* the footer and the button have to say the same thing — a button that refuses
   next to a line reading "adds up" looks broken rather than strict */
chk('  the footer says why it cannot save yet', await ev(() =>
  document.getElementById('spFoot').textContent.trim()),
  'Give a second part an amount — a split needs at least two.');
chk('  and the button agrees', await ev(() => document.getElementById('sp-save').disabled), true);
chk('  so nothing happens if you press it', await ev(async () => {
  document.getElementById('sp-save').click();
  await new Promise(r => setTimeout(r, 300));
  return db.transactions.filter(t => t.splitId).length; }), 0);
chk('  and an over-assigned split says that instead', await ev(async () => {
  const a = document.querySelector('[data-spval="1"]'); a.value = '50';
  a.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise(r => setTimeout(r, 200));
  const said = document.getElementById('spFoot').textContent.trim();
  a.value = '0'; a.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise(r => setTimeout(r, 150));
  return said; }), '$50.00 more than the transaction');

chk('90 / 30 / 20 across three categories', await ev(async () => {
  document.getElementById('sp-add').click();
  await new Promise(r => setTimeout(r, 250));
  const set = (i, v, cat) => {
    const a = document.querySelector(`[data-spval="${i}"]`); a.value = String(v);
    a.dispatchEvent(new Event('input', { bubbles: true }));
    const c = document.querySelector(`[data-spcat="${i}"]`); c.value = cat;
    c.dispatchEvent(new Event('change', { bubbles: true })); };
  set(0, 90, 'Groceries'); set(1, 30, 'Household'); set(2, 20, 'Clothing');
  await new Promise(r => setTimeout(r, 200));
  return document.getElementById('spFoot').textContent.trim(); }), 'Adds up to the whole amount.');

await ev(() => document.getElementById('sp-save').click()); await p.waitForTimeout(700);
const after = await ev(() => {
  const mk = monthKey(todayISO());
  const parts = db.transactions.filter(t => t.desc === 'Walmart Supercenter');
  return { n: parts.length,
    sum: Math.round(parts.reduce((s, t) => s + t.amount, 0) * 100) / 100,
    cats: parts.map(t => t.category).sort(),
    sameGroup: new Set(parts.map(t => t.splitId)).size,
    keptId: parts.some(t => t.id === 'wm'),
    sameDate: new Set(parts.map(t => t.date)).size,
    sameAcct: new Set(parts.map(t => t.acctId)).size,
    month: Math.round(monthTotals(mk).exp * 100) / 100,
    groceries: Math.round(spentFor('Groceries', mk) * 100) / 100,
    household: Math.round(spentFor('Household', mk) * 100) / 100 };
});
chk('three transactions now', after.n, 3);
chk('  adding up to the original', after.sum, -140);
chk('  filed where you put them', after.cats, ['Clothing', 'Groceries', 'Household']);
chk('  under one split', after.sameGroup, 1);
chk('  the row you edited is still the row it was', after.keptId, true);
chk('  same day, same account', [after.sameDate, after.sameAcct], [1, 1]);

console.log('\n— and the month has not moved a penny —');
chk('the monthly total is untouched', after.month, before.month);
chk('  only the filing changed', [after.groceries, after.household],
  [Math.round((before.groceries - 50) * 100) / 100, 30]);
chk('  the ledger says which part it is', await ev(() => {
  setView('expenses'); renderTx();
  const r = [...document.querySelectorAll('#txTable .trow')].find(x => /Walmart/.test(x.textContent));
  return /split \d\/3/.test(r.textContent); }), true);

console.log('\n— percent mode —');
chk('switching shows the same money as percentages', await ev(async () => {
  openTxEditor('wm'); await new Promise(r => setTimeout(r, 300));
  document.getElementById('tx-unsplit').click();
  document.getElementById('tx-unsplit').click();
  await new Promise(r => setTimeout(r, 500));
  const id = db.transactions.find(t => t.desc === 'Walmart Supercenter').id;
  openTxEditor(id); await new Promise(r => setTimeout(r, 300));
  document.getElementById('tx-split').click(); await new Promise(r => setTimeout(r, 300));
  document.querySelector('[data-spmode="percent"]').click();
  await new Promise(r => setTimeout(r, 300));
  return document.querySelector('[data-spval="0"]').value; }), '100');
chk('  typing 25% puts $35 on that part', await ev(async () => {
  const a = document.querySelector('[data-spval="0"]'); a.value = '25';
  a.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise(r => setTimeout(r, 200));
  return [_txSplit.parts[0].amt, document.querySelector('[data-spsub="0"]').textContent]; }),
  [35, '$35.00']);
chk('  even split fills the rest', await ev(async () => {
  document.getElementById('sp-even').click();
  await new Promise(r => setTimeout(r, 300));
  return [_txSplit.parts.map(x => x.amt), document.getElementById('spFoot').textContent.trim()]; }),
  [[70, 70], 'Adds up to the whole amount.']);

console.log('\n— undoing it —');
chk('the parts fold back into one', await ev(async () => {
  document.getElementById('sp-save').click(); await new Promise(r => setTimeout(r, 600));
  const id = db.transactions.find(t => t.desc === 'Walmart Supercenter').id;
  openTxEditor(id); await new Promise(r => setTimeout(r, 350));
  const b2 = document.getElementById('tx-unsplit');
  b2.click(); await new Promise(r => setTimeout(r, 120)); b2.click();
  await new Promise(r => setTimeout(r, 600));
  const left = db.transactions.filter(t => t.desc === 'Walmart Supercenter');
  return { n: left.length, amount: left[0].amount, tagged: !!left[0].splitId }; }),
  { n: 1, amount: -140, tagged: false });
chk('  and the month still has not moved', await ev(() =>
  Math.round(monthTotals(monthKey(todayISO())).exp * 100) / 100), before.month);
await ev(() => closeEditor());

console.log('\n— the awkward cases —');
chk('a bill payment keeps exactly one bill link', await ev(async () => {
  const mk = monthKey(todayISO()), bill = db.recurring[0];
  const t = { id: 'bp', date: mk + '-03', desc: 'Combined utility', category: 'Electric',
    amount: -200, billRef: bill.id + '|' + mk };
  db.transactions.push(t);
  applySplit(t, [{ cat: 'Electric', amt: 120 }, { cat: 'Water', amt: 80 }]);
  const parts = db.transactions.filter(x => x.desc === 'Combined utility');
  return parts.filter(x => x.billRef).length; }), 1);
chk('  and undoing it hands the link back', await ev(() => {
  const gid = db.transactions.find(x => x.desc === 'Combined utility').splitId;
  unsplit(gid);
  const left = db.transactions.filter(x => x.desc === 'Combined utility');
  return [left.length, !!left[0].billRef, left[0].amount]; }), [1, true, -200]);
chk('a business tag carries to every part', await ev(() => {
  const t = { id: 'bg', date: todayISO(), desc: 'B&H order', category: 'Gear',
    amount: -600, bizId: 'b1', bizPct: 80 };
  db.transactions.push(t);
  applySplit(t, [{ cat: 'Gear', amt: 400 }, { cat: 'Household', amt: 200 }]);
  const parts = db.transactions.filter(x => x.desc === 'B&H order');
  return parts.every(x => x.bizId === 'b1' && x.bizPct === 80); }), true);
chk('income splits the same way, sign intact', await ev(() => {
  const t = { id: 'in1', date: todayISO(), desc: 'Two gigs, one deposit', category: 'Income', amount: 900 };
  db.transactions.push(t);
  applySplit(t, [{ cat: 'Income', amt: 500 }, { cat: 'Income', amt: 400 }]);
  return db.transactions.filter(x => x.desc === 'Two gigs, one deposit').map(x => x.amount); }), [500, 400]);
chk('a split that lost its siblings is a transaction again', await ev(() => {
  db.transactions = db.transactions.filter(x => x.desc !== 'Two gigs, one deposit' || x.id === 'in1');
  normalize();
  return db.transactions.find(x => x.id === 'in1').splitId === undefined; }), true);
chk('splitting something already split re-splits it cleanly', await ev(() => {
  const t = db.transactions.find(x => x.desc === 'B&H order');
  applySplit(t, [{ cat: 'Gear', amt: 300 }, { cat: 'Gear', amt: 100 }]);
  const parts = db.transactions.filter(x => x.desc === 'B&H order');
  return [parts.length, Math.round(parts.reduce((s, x) => s + x.amount, 0))]; }), [3, -600]);

console.log(`\n${pass} passed, ${fail} failed`);
console.log('page errors:', errs.length ? errs : 'none');
await b.close();
if (fail || errs.length) process.exitCode = 1;
