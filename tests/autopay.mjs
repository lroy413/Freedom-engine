/* Bills that pay themselves: a subscription comes out whether or not you
   remember it, so the app should stop asking you to confirm that it did. */
import pkg from 'playwright';
const { chromium } = pkg;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 402, height: 874 }, hasTouch: true, isMobile: true, timezoneId: 'America/New_York' });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://localhost:8899/index.html'); await p.waitForTimeout(900);
let pass = 0, fail = 0;
const chk = (n, g, w) => { const ok = JSON.stringify(g) === JSON.stringify(w);
  console.log((ok ? '  ok   ' : '  FAIL ') + n + (ok ? '' : `  got ${JSON.stringify(g)} want ${JSON.stringify(w)}`)); ok ? pass++ : fail++; };
const MK = await p.evaluate(() => monthKey(todayISO()));
const prevMK = await p.evaluate(() => { const d = dayOf(todayISO()); d.setDate(1); d.setMonth(d.getMonth() - 1); return monthOf(d); });

const reset = () => p.evaluate(() => {
  db.recurring = []; db.transactions = []; db.accounts = []; db.income = [];
  db.paychecks = []; db.debts = []; db.businesses = []; db.invoices = [];
  saveAll();
});

console.log('— it only ever starts from the month you switch it on —');
await reset();
chk('a bill due earlier this month, autopay on today, pays that month', await p.evaluate(() => {
  db.recurring = [{ id: "s1", name: "Spotify", category: "Subscriptions", amount: 12, dueDay: 1, tier: "luxury" }];
  normalize(); saveAll();
  const b2 = db.recurring[0];
  b2.autopay = true; b2.autoSince = monthKey(todayISO());
  const changed = runAutopay();
  const mk = monthKey(todayISO());
  return { changed, paid: billPaid(b2, mk), txs: db.transactions.length,
    amount: db.transactions[0] ? db.transactions[0].amount : null,
    auto: !!(db.transactions[0] || {}).auto, ref: (db.transactions[0] || {}).billRef === b2.id + "|" + mk };
}), { changed: true, paid: true, txs: 1, amount: -12, auto: true, ref: false });

chk('  it never reaches backwards into months before it was on', await p.evaluate((prev) => {
  db.transactions = [];
  const b2 = db.recurring[0];
  b2.autoSince = monthKey(todayISO()); delete b2.autoThru;
  runAutopay();
  return { thisMonth: billPaid(b2, monthKey(todayISO())), lastMonth: billPaid(b2, prev),
    txs: db.transactions.length }; }, prevMK), { thisMonth: true, lastMonth: false, txs: 1 });

chk('  and a month switched on earlier is caught up', await p.evaluate((prev) => {
  db.transactions = [];
  const b2 = db.recurring[0];
  b2.autoSince = prev; delete b2.autoThru;
  runAutopay();
  return { last: billPaid(b2, prev), now: billPaid(b2, monthKey(todayISO())), txs: db.transactions.length };
}, prevMK), { last: true, now: true, txs: 2 });

console.log('\n— nothing is paid before its due date —');
await reset();
chk('a bill due later this month is not paid yet', await p.evaluate(() => {
  const d = dayOf(todayISO()); const today = d.getDate();
  const later = Math.min(28, today + 3);
  if (later <= today) return 'skip';                       // too late in the month to test
  db.recurring = [{ id: "s2", name: "Later", category: "Subscriptions", amount: 20, dueDay: later,
    autopay: true, autoSince: monthKey(todayISO()) }];
  normalize(); runAutopay();
  return { paid: billPaid(db.recurring[0], monthKey(todayISO())), txs: db.transactions.length };
}), { paid: false, txs: 0 });

console.log('\n— unticking it by hand stays unticked —');
await reset();
const un = await p.evaluate(() => {
  db.recurring = [{ id: "s3", name: "Netflix", category: "Subscriptions", amount: 16, dueDay: 1,
    autopay: true, autoSince: monthKey(todayISO()) }];
  normalize(); runAutopay();
  const mk = monthKey(todayISO()), b2 = db.recurring[0];
  const afterAuto = billPaid(b2, mk);
  setBillPaid(b2, mk, false);                              // the user unticks it
  const afterUndo = billPaid(b2, mk);
  runAutopay(); runAutopay();                              // and the app runs again, twice
  return { afterAuto, afterUndo, stillOff: !billPaid(b2, mk), txs: db.transactions.length };
});
chk('autopay ticks it', un.afterAuto, true);
chk('  unticking clears it', un.afterUndo, false);
chk('  and it does not spring back', [un.stillOff, un.txs], [true, 0]);

console.log('\n— switching it off leaves the past alone —');
chk('turning autopay off keeps what it already recorded', await p.evaluate(() => {
  db.transactions = []; const b2 = db.recurring[0];
  b2.autopay = true; b2.autoSince = monthKey(todayISO()); delete b2.autoThru;
  runAutopay();
  const had = db.transactions.length;
  b2.autopay = false; delete b2.autoSince; delete b2.autoThru;
  runAutopay();
  return { had, kept: db.transactions.length, paid: billPaid(b2, monthKey(todayISO())) };
}), { had: 1, kept: 1, paid: true });

console.log('\n— a pay-as-you-go bill cannot autopay —');
chk('there is no amount to take, so it is refused', await p.evaluate(() => {
  db.recurring = [{ id: "s4", name: "Prepaid power", category: "Electric", amount: 90, dueDay: 1,
    open: true, autopay: true, autoSince: monthKey(todayISO()) }];
  db.transactions = []; normalize(); runAutopay();
  return { on: autopayOn(db.recurring[0]), txs: db.transactions.length };
}), { on: false, txs: 0 });

console.log('\n— the imported charge replaces the placeholder —');
await reset();
const dedupe = await p.evaluate(() => {
  const mk = monthKey(todayISO());
  db.recurring = [{ id: "s5", name: "Spotify", category: "Subscriptions", amount: 12, dueDay: 1,
    autopay: true, autoSince: mk }];
  normalize(); runAutopay();
  const placeholder = db.transactions.length;
  /* the bank's version turns up two days later, as an import does */
  const d = dayOf(billDue(db.recurring[0], mk)); d.setDate(d.getDate() + 2);
  db.transactions.push({ id: "imp", date: isoOf(d), desc: "SPOTIFY P0A1B2C3",
    category: "Uncategorized", amount: -12, review: true, sfTid: "x1" });
  const t = db.transactions.find(x => x.id === "imp");
  const twin = autopayTwin(t);
  adoptAutopay(t); delete t.review;
  const left = db.transactions.filter(x => Math.abs(num(x.amount)) === 12);
  return { placeholder, sawTwin: !!twin, count: left.length,
    /* payments are tagged "<billId>|<month>|<seq>" so a bill can be paid in
       pieces; the prefix is what billTxs matches on */
    survivor: left[0].desc, keptRef: String(left[0].billRef || "").startsWith("s5|" + mk),
    stillPaid: billPaid(db.recurring[0], mk),
    spent: Math.round(monthTotals(mk).exp) };
});
chk('autopay left a placeholder', dedupe.placeholder, 1);
chk('  the import is recognised as the same charge', dedupe.sawTwin, true);
chk('  one transaction survives, not two', dedupe.count, 1);
chk('  and it is the bank\'s, carrying the bill link', [dedupe.survivor, dedupe.keptRef],
  ['SPOTIFY P0A1B2C3', true]);
chk('  the bill is still paid', dedupe.stillPaid, true);
chk('  and the month is charged once', dedupe.spent, 12);

chk('an unrelated import of the same size is left alone', await p.evaluate(() => {
  const mk = monthKey(todayISO());
  db.transactions = []; delete db.recurring[0].autoThru;
  db.recurring[0].autoSince = mk; runAutopay();
  const d = dayOf(todayISO()); d.setDate(d.getDate() + 40);   // well outside the window
  db.transactions.push({ id: "far", date: isoOf(d), desc: "Something else", category: "Misc",
    amount: -12, review: true });
  const t = db.transactions.find(x => x.id === "far");
  return { twin: !!autopayTwin(t), adopted: adoptAutopay(t) }; }), { twin: false, adopted: false });

console.log('\n— a subscription suggests it, on the form —');
await reset();
await p.evaluate(() => { setView('budget'); }); await p.waitForTimeout(600);
await p.click('#showAddBill'); await p.waitForTimeout(500);
chk('the add form offers autopay', await p.evaluate(() => !!document.getElementById('recAuto')), true);
await p.selectOption('#recCat', 'Subscriptions'); await p.waitForTimeout(400);
chk('  and ticks it for a subscription', await p.evaluate(() => document.getElementById('recAuto').checked), true);
chk('  saying why', await p.evaluate(() =>
  /whether or not you remember/.test(document.getElementById('editSheetBody').textContent)), true);
await p.selectOption('#recCat', 'Groceries'); await p.waitForTimeout(400);
chk('  but not for groceries', await p.evaluate(() => document.getElementById('recAuto').checked), false);
/* a choice you make yourself must survive the next category change */
await p.check('#recAuto'); await p.waitForTimeout(200);
await p.selectOption('#recCat', 'Coffee'); await p.waitForTimeout(400);
chk('  and your own tick is not overwritten', await p.evaluate(() => document.getElementById('recAuto').checked), true);

await p.selectOption('#recCat', 'Subscriptions'); await p.waitForTimeout(300);
await p.fill('#recName', 'Disney+'); await p.fill('#recAmt', '14'); await p.fill('#recDay', '1');
await p.click('#addRecBtn'); await p.waitForTimeout(800);
chk('creating it switches autopay on from this month', await p.evaluate(() => {
  const b2 = db.recurring.find(x => x.name === 'Disney+');
  return { on: !!b2.autopay, since: b2.autoSince === monthKey(todayISO()) }; }), { on: true, since: true });

console.log('\n— the row says it pays itself —');
await p.evaluate(() => { editBill = null; billView = 'all'; renderBudget(); }); await p.waitForTimeout(600);
chk('the list marks it', await p.evaluate(() =>
  /autopay/.test(document.getElementById('billsList').textContent)), true);

console.log(`\n${pass} passed, ${fail} failed`);
console.log('page errors:', errs.length ? errs : 'none');
await b.close();
if (fail || errs.length) process.exitCode = 1;
