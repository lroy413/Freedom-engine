/* Bills whose amount is an estimate rather than a price.

   The bug underneath this feature: paying $92 on a $75 water bill rolled $17
   forward as credit, so the app believed next month's water was already part
   paid. It never was — the meter does not care what you paid last month. What
   you wanted to see instead was that you plan 75 and pay 88. */
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
await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1400);

/* a water bill planned at 75, paid at what the meter actually said */
const MONTHS = await ev(() => {
  const d = dayOf(todayISO());
  const mk = i => monthOf(new Date(d.getFullYear(), d.getMonth() - i, 1));
  db.recurring = db.recurring.filter(x => x.name !== 'Water');
  db.recurring.push({ id: 'w1', name: 'Water', category: 'Water', amount: 75,
    dueDay: 12, tier: 'essential', group: 'Utilities', varies: true });
  db.transactions = db.transactions.filter(t => !String(t.billRef || '').startsWith('w1|'));
  /* 92, 68, 104 across the three most recent months, oldest first */
  [[3, 92], [2, 68], [1, 104]].forEach(([back, amt]) => {
    const m = mk(back);
    db.transactions.push({ id: 'wt' + back, date: m + '-12', desc: 'Water', category: 'Water',
      amount: -amt, billRef: 'w1|' + m });
  });
  saveAll();
  return [mk(3), mk(2), mk(1), mk(0)];
});
await p.waitForTimeout(500);

console.log('— what each month actually cost —');
chk('the variance is kept per month', await ev(m =>
  [m[3 - 3], m[3 - 2], m[3 - 1]].map(x => Math.round(billVarianceIn(db.recurring.find(b2 => b2.id === 'w1'), x))),
  MONTHS), [17, -7, 29]);
chk('an unpaid month is not an underspend', await ev(m =>
  billVarianceIn(db.recurring.find(b2 => b2.id === 'w1'), m[3]), MONTHS), null);
chk('history reads newest first', await ev(() =>
  billHistory(db.recurring.find(b2 => b2.id === 'w1'), 6).map(x => Math.round(x.paid))), [104, 68, 92]);
chk('  with the plan it was measured against', await ev(() =>
  billHistory(db.recurring.find(b2 => b2.id === 'w1'), 6).map(x => x.planned)), [75, 75, 75]);
chk('what it really costs is the average of what you paid', await ev(() =>
  Math.round(billTypical(db.recurring.find(b2 => b2.id === 'w1'), 6))), 88);

console.log('\n— and the money does NOT roll forward —');
chk('paying over an estimate is not credit against next month', await ev(m => {
  const w = db.recurring.find(b2 => b2.id === 'w1');
  return [billCredit(w, m[3]), Math.round(billRemaining(w, m[3]))]; }, MONTHS), [0, 75]);
chk('  which is the whole point: next month still owes the full plan', await ev(m =>
  billPaid(db.recurring.find(b2 => b2.id === 'w1'), m[3]), MONTHS), false);
chk('a FIXED bill still carries its overpayment forward', await ev(m => {
  const w = db.recurring.find(b2 => b2.id === 'w1');
  w.varies = false;
  const credit = Math.round(billCredit(w, m[3]));
  w.varies = true;
  return credit; }, MONTHS), 39);

console.log('\n— across every bill in a month —');
chk('the month knows what ran over', await ev(m => {
  const v = billsVarianceIn(m[2]);
  return [Math.round(v.over), Math.round(v.under), v.n]; }, MONTHS), [29, 0, 1]);
chk('  and what came in under', await ev(m => {
  const v = billsVarianceIn(m[1]);
  return [Math.round(v.over), Math.round(v.under)]; }, MONTHS), [0, 7]);

console.log('\n— on the screen —');
chk('the row says it went over', await ev(async m => {
  /* put a payment in the current month so the row shows this month's variance */
  const cur = monthKey(todayISO());
  db.transactions.push({ id: 'wtc', date: cur + '-12', desc: 'Water', category: 'Water',
    amount: -95, billRef: 'w1|' + cur });
  saveAll(); setView('budget'); await new Promise(r => setTimeout(r, 700));
  const row = [...document.querySelectorAll('#billsList .brow')].find(x => /Water/.test(x.textContent));
  return !!row && /\$20 over/.test(row.textContent); }, MONTHS), true);
chk('the editor shows the months and the average', await ev(async () => {
  editBill = 'w1'; renderBudget(); await new Promise(r => setTimeout(r, 500));
  const box = document.querySelector('.varbox');
  return { rows: box ? box.querySelectorAll('.varrow').length : 0,
    avg: box ? /\$(8|9)[0-9]/.test(box.querySelector('.varhead .v').textContent) : false,
    offersPlan: !!document.querySelector('[data-billadopt]') }; }),
  { rows: 4, avg: true, offersPlan: true });
chk('  and one tap adopts what it really costs', await ev(async () => {
  const btn = document.querySelector('[data-billadopt]');
  const want = Number(btn.dataset.amt);
  btn.click(); await new Promise(r => setTimeout(r, 600));
  return db.recurring.find(b2 => b2.id === 'w1').amount === want && want >= 85 && want <= 95; }), true);

console.log('\n— a metered category suggests it —');
chk('water suggests the flag, rent does not', await ev(() =>
  ['Water', 'Electric', 'Gas (Utility)', 'Rent/Mortgage', 'Subscriptions'].map(c => CAT_VARIES.test(c))),
  [true, true, true, false, false]);
chk('an open bill is never treated as varying', await ev(() =>
  billVaries({ varies: true, open: true })), false);

console.log(`\n${pass} passed, ${fail} failed`);
console.log('page errors:', errs.length ? errs : 'none');
await b.close();
if (fail || errs.length) process.exitCode = 1;
