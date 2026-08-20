/* Does a backup actually bring everything back?

   Worth proving rather than assuming: this is the file standing between a
   reinstall and losing a year of books. Seed a full app, download the backup,
   wipe storage the way removing a home-screen app does, reload into an empty
   app, load the file, and compare every collection. */
import pkg from 'playwright';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { SEED } from './seed-real.mjs';
const { chromium } = pkg;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1200, height: 900 }, acceptDownloads: true });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://localhost:8899/index.html'); await p.waitForTimeout(900);
let pass = 0, fail = 0;
const chk = (n, g, w) => { const ok = JSON.stringify(g) === JSON.stringify(w);
  console.log((ok ? '  ok   ' : '  FAIL ') + n + (ok ? '' : `  got ${JSON.stringify(g)} want ${JSON.stringify(w)}`)); ok ? pass++ : fail++; };

await SEED(p); await p.waitForTimeout(700);
/* pretend sync has been set up, so we can prove the backup leaves it out */
await p.evaluate(() => {
  localStorage.setItem('fe_sync_v1', JSON.stringify({
    token: 'ghp_EXAMPLEEXAMPLEEXAMPLEEXAMPLE00', gistId: 'abc123',
    pass: 'correct horse battery staple', device: 'Phone' }));
});

const COUNTS = () => p.evaluate(() => ({
  accounts: db.accounts.length, transactions: db.transactions.length,
  recurring: db.recurring.length, income: db.income.length, paychecks: db.paychecks.length,
  debts: db.debts.length, holdings: db.holdings.length, goals: db.goals.length,
  businesses: db.businesses.length, invoices: db.invoices.length, clients: db.clients.length,
  budgets: Object.keys(db.budgets).length, reserve: db.tax.reserve.length,
  mileage: db.businesses[0] ? db.businesses[0].mileage.log.length : 0,
  net: Math.round(netWorth()), owed: Math.round(allReceivable()),
  tax: Math.round(taxEstimate().owed), sts: Math.round(safeToSpend().safe) }));

/* Snapshot after the app has settled, not before. Autopay catches a bill up on
   the first view it is asked for, so a count taken the instant the seed lands
   describes a book that never existed on disk — and the file downloaded a
   moment later would fairly "fail" to match it. */
await p.evaluate(() => setView('data')); await p.waitForTimeout(600);
const before = await COUNTS();
console.log('— a full book, backed up —');
chk('there is a real app to lose', before.transactions > 100 && before.invoices > 3, true);

const dl = await Promise.all([p.waitForEvent('download'),
  p.evaluate(() => document.getElementById('saveBtn').click())]);
const path = '/tmp/fb-backup.json';
await dl[0].saveAs(path);
const raw = readFileSync(path, 'utf8');
console.log('  file:', dl[0].suggestedFilename(), Math.round(raw.length / 1024) + ' KB');

/* the one thing that must NOT be in it */
console.log('\n— what the backup does and does not carry —');
/* the local file is the database itself; the app:"freedom-engine" tag belongs
   to the encrypted sync payload, which is a different format */
chk('it carries the whole book', ['transactions','accounts','invoices','businesses']
  .filter(k => !Array.isArray(JSON.parse(raw)[k])), []);
chk('no GitHub token in the file', /ghp_[A-Za-z0-9]/.test(raw), false);
chk('no passphrase either', /battery staple/.test(raw), false);
chk('  because credentials live in their own key, never in an export',
  Object.keys(JSON.parse(raw)).includes('token'), false);

console.log('\n— removing the app: storage goes with it —');
await p.evaluate(() => { localStorage.clear(); });
await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1200);
const empty = await COUNTS();
chk('a wiped device really is empty',
  [empty.transactions, empty.invoices, empty.businesses, empty.accounts], [0, 0, 0, 0]);

console.log('\n— loading the backup back in —');
await p.evaluate(() => setView('data')); await p.waitForTimeout(500);
await p.setInputFiles('#loadFile', path);
await p.waitForTimeout(1500);
/* one click, because there was nothing here to protect — a fresh install always
   stamps itself newer than the backup it is about to restore */
chk('an empty app restores on the first click', (await COUNTS()).transactions > 0, true);
const after = await COUNTS();
for (const k of Object.keys(before)) chk(`${k} restored`, after[k], before[k]);

console.log('\n— and the detail survives, not just the counts —');
chk('an invoice keeps its schedule', await p.evaluate(() => {
  const v = db.invoices.find(x => x.title === 'Winter ball');
  return { gig: !!v.serviceDate, terms: v.terms, dep: v.deposit.pct,
    inst: invOutstanding(v).map(x => `${x.label} ${Math.round(x.amount)}`) }; }),
  { gig: true, terms: 'completion', dep: 30, inst: ['Deposit 1440', 'Balance 3360'] });
chk('  a business keeps its deductions', await p.evaluate(() => {
  const x = db.businesses[0];
  return [x.office.sqft, x.mileage.log.length, x.state, x.method]; }), [120, 3, 'GA', 'cash']);
chk('  and a mixed-use bill keeps its split', await p.evaluate(() => {
  const r = db.recurring.find(x => x.name === 'Adobe CC'); return [r.bizPct, !!r.bizId]; }), [80, true]);

console.log('\n— but a book with something in it still asks —');
chk('restoring over real data wants a second look', await p.evaluate(async () => {
  const older = JSON.parse(JSON.stringify(db));
  older.updatedAt = "2020-01-01T00:00:00.000Z"; older.transactions = older.transactions.slice(0, 3);
  const f = new File([JSON.stringify(older)], "old.json", { type: "application/json" });
  const dt = new DataTransfer(); dt.items.add(f);
  const el = document.getElementById('loadFile'); el.files = dt.files;
  el.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 600));
  const asked = /older \(/.test(document.body.textContent), kept = db.transactions.length;
  /* the handler clears the input so the same file can be picked again — the
     second attempt has to hand it the file afresh, exactly as the file dialog
     would */
  const dt2 = new DataTransfer(); dt2.items.add(f); el.files = dt2.files;
  el.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 600));
  return { asked, keptFirst: kept > 3, tookSecond: db.transactions.length === 3 };
}), { asked: true, keptFirst: true, tookSecond: true });

console.log('\n— loading the wrong file changes nothing —');
/* Before the guard, any valid JSON was accepted: migrate + normalize turned it
   into an empty book and saved that over everything. */
const wrong = '/tmp/not-a-backup.json';
const standing = (await COUNTS()).transactions;   // whatever is loaded right now
writeFileSync(wrong, JSON.stringify({ hello: 'world', items: [1, 2, 3] }));
await p.setInputFiles('#loadFile', wrong); await p.waitForTimeout(900);
chk('a stranger\'s JSON is refused', (await COUNTS()).transactions, standing);
chk('  and it says so', await p.evaluate(() =>
  /doesn't look like a FreeBound backup/.test(document.body.textContent)), true);

writeFileSync(wrong, JSON.stringify({ app: 'freedom-engine', v: 1, enc: true, salt: 'x', iv: 'y', data: 'z' }));
await p.setInputFiles('#loadFile', wrong); await p.waitForTimeout(900);
chk('the encrypted cloud copy is refused too', (await COUNTS()).transactions, standing);
chk('  and points at Pull instead', await p.evaluate(() =>
  /encrypted cloud copy/.test(document.body.textContent)), true);
try { unlinkSync(wrong); } catch (e) { }

console.log(`\n${pass} passed, ${fail} failed`);
console.log('page errors:', errs.length ? errs : 'none');
try { unlinkSync(path); } catch (e) { }
await b.close();
if (fail || errs.length) process.exitCode = 1;
