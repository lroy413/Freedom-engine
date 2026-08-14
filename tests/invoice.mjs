/* Invoicing: a gig booked, a deposit taken, the balance chased. Plus what
   changes when the business sells goods instead of time, and what changes when
   it keeps its books on accrual instead of cash. */
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
const Y = await p.evaluate(() => todayISO().slice(0, 4));
const sheet = () => p.evaluate(() => { const s = document.getElementById('editSheet');
  return s && !s.hidden ? document.getElementById('editTitle').textContent : null; });

await p.evaluate(Y => {
  db.businesses = [{ id: "b1", name: "L Roy Media", kind: "llc", state: "GA", sells: "service",
    drawPct: 100, linkProfit: true, active: true, color: "#0284c7", created: Y + "-01-01", method: "cash" }];
  db.transactions = []; db.paychecks = []; db.income = []; db.recurring = []; db.accounts = [];
  db.invoices = []; db.clients = [];
  normalize(); saveAll(); setView('business'); bizOpen = "b1"; renderBusiness();
}, Y);
await p.waitForTimeout(800);

console.log('— an empty book says what it is for —');
chk('the invoices section is on the business screen',
  await p.evaluate(() => !!document.getElementById('bizInv')), true);
chk('  and invites the first one',
  await p.evaluate(() => /take a deposit/.test(document.getElementById('bizInv').textContent)), true);

console.log('\n— a gig is booked —');
await p.click('#invNew'); await p.waitForTimeout(600);
chk('+ Invoice opens on a draft',
  await p.evaluate(() => ({ n: db.invoices.length, status: db.invoices[0].status, num: db.invoices[0].number })),
  { n: 1, status: 'draft', num: '0001' });
chk('  and a draft is owed nothing yet',
  await p.evaluate(() => Math.round(receivables("b1").total)), 0);
/* a service business is asked for time, never for quantity of goods */
chk('a service business offers hours, days and a flat fee',
  await p.evaluate(() => [...document.querySelectorAll('[data-iunit] option')].map(o => o.value)),
  ['hour', 'day', 'project']);
chk('  and never asks what the goods cost',
  await p.evaluate(() => !document.querySelector('[data-icost]')), true);

await p.evaluate(() => {
  const v = db.invoices[0];
  v.items = [{ id: "i1", desc: "Wedding — full day", unit: "day", qty: 2, rate: 1500, cost: 0, taxable: false }];
  v.clientId = ""; v.title = "Cordell wedding"; v.terms = "net30"; saveAll(); renderEditor();
});
await p.waitForTimeout(500);
chk('two days at $1,500 is $3,000', await p.evaluate(() => Math.round(invTotals(db.invoices[0]).total)), 3000);
await p.click('#iv-send'); await p.waitForTimeout(600);
chk('marking it sent makes it money you are owed',
  await p.evaluate(() => ({ status: invStatus(db.invoices[0]), owed: Math.round(receivables("b1").total) })),
  { status: 'sent', owed: 3000 });

console.log('\n— the deposit lands —');
/* a deposit is a schedule now, not a one-off half payment: split the invoice,
   then settle the first thing on it */
await p.click('#iv-adddep'); await p.waitForTimeout(600);
chk('splitting it makes two debts out of one',
  await p.evaluate(() => invOutstanding(db.invoices[0]).map(x => `${x.label} ${Math.round(x.amount)}`)),
  ['Deposit 1500', 'Balance 1500']);
chk('  and the quick button offers the deposit by name',
  await p.evaluate(() => { const n = document.querySelector('#iv-paynext'); return n ? n.textContent.trim() : null; }),
  'Deposit — $1,500');
await p.click('#iv-paynext'); await p.waitForTimeout(700);
chk('half up front leaves half outstanding',
  await p.evaluate(() => ({ paid: Math.round(invPaid(db.invoices[0])), due: Math.round(invDue(db.invoices[0])),
    status: invStatus(db.invoices[0]) })), { paid: 1500, due: 1500, status: 'part' });
/* the money is real, so it has to reach the books — but only once */
chk('  it books the money coming in',
  await p.evaluate(() => db.transactions.map(t => `${t.desc} ${t.amount} biz=${t.bizId}`)),
  ['Cordell wedding #0001 1500 biz=b1']);
chk('  and the books count it once, not twice',
  await p.evaluate(() => Math.round(bizPL("b1", todayISO().slice(0, 4)).rev)), 1500);
chk('  the deposit is labelled as one',
  await p.evaluate(() => db.invoices[0].payments[0].note), 'deposit');

console.log('\n— the balance after the job —');
await p.evaluate(() => { const g = document.querySelector('#iv-pamt'); g.value = "1500";
  document.querySelector('#iv-paysome').click(); });
await p.waitForTimeout(700);
chk('paying the rest settles it',
  await p.evaluate(() => ({ status: invStatus(db.invoices[0]), due: Math.round(invDue(db.invoices[0])),
    owed: Math.round(receivables("b1").total) })), { status: 'paid', due: 0, owed: 0 });
chk('  and the whole $3,000 is revenue, once',
  await p.evaluate(() => Math.round(bizPL("b1", todayISO().slice(0, 4)).rev)), 3000);
chk('  from two payments and two transactions',
  await p.evaluate(() => [db.invoices[0].payments.length, db.transactions.length]), [2, 2]);
/* removing a payment has to take its transaction with it or the books drift */
chk('deleting a payment removes the money it recorded',
  await p.evaluate(() => { document.querySelector('[data-pdel]').click();
    return [db.invoices[0].payments.length, db.transactions.length, Math.round(bizPL("b1", todayISO().slice(0, 4)).rev)]; }),
  [1, 1, 1500]);
await p.evaluate(() => closeEditor()); await p.waitForTimeout(400);

console.log('\n— late is a different problem from unpaid —');
const ar = await p.evaluate(() => {
  const back = n => { const d = dayOf(todayISO()); d.setDate(d.getDate() - n); return isoOf(d); };
  db.transactions = [];                      // start each section from a clean book
  db.invoices = [
    { id: "v1", bizId: "b1", number: "0002", clientId: "", title: "Recent", issued: back(5), terms: "net30",
      items: [{ id: "a", desc: "x", unit: "project", qty: 1, rate: 1000, cost: 0, taxable: false }], payments: [], status: "sent", discount: 0, taxRate: 0 },
    { id: "v2", bizId: "b1", number: "0003", clientId: "", title: "Chase", issued: back(50), terms: "net30",
      items: [{ id: "b", desc: "x", unit: "project", qty: 1, rate: 2000, cost: 0, taxable: false }], payments: [], status: "sent", discount: 0, taxRate: 0 },
    { id: "v3", bizId: "b1", number: "0004", clientId: "", title: "Bad debt", issued: back(120), terms: "net30",
      items: [{ id: "c", desc: "x", unit: "project", qty: 1, rate: 500, cost: 0, taxable: false }], payments: [], status: "sent", discount: 0, taxRate: 0 }];
  normalize(); saveAll();
  const r = receivables("b1");
  return { total: Math.round(r.total), late: Math.round(r.late), oldest: r.oldest,
    buckets: r.buckets.filter(x => x.amount > 0).map(x => `${x.label} ${Math.round(x.amount)}`) };
});
chk('everything unpaid is owed', ar.total, 3500);
chk('  but only the overdue part is late', ar.late, 2500);
chk('  and it ages into buckets',ar.buckets,
  ['Not due yet 1000', '1–30 days late 2000', 'Over 60 500']);
chk('  the oldest is named in days', ar.oldest, 90);
chk('writing one off stops it being money you are owed', await p.evaluate(() => {
  db.invoices[2].status = "void"; saveAll();
  return [Math.round(receivables("b1").total), Math.round(bizPL("b1", todayISO().slice(0, 4)).rev)]; }), [3000, 0]);

console.log('\n— cash basis against accrual —');
const basis = await p.evaluate(() => {
  const Y2 = todayISO().slice(0, 4);
  db.transactions = [];
  db.invoices = [{ id: "w1", bizId: "b1", number: "0009", clientId: "", title: "Big job", issued: Y2 + "-02-01", terms: "net30",
    items: [{ id: "z", desc: "x", unit: "project", qty: 1, rate: 6000, cost: 0, taxable: false }],
    payments: [{ id: "pp", date: Y2 + "-03-05", amount: 2000 }], status: "sent", discount: 0, taxRate: 0 }];
  normalize(); saveAll();
  const cash = Math.round(bizPL("b1", Y2).rev);
  db.businesses[0].method = "accrual"; saveAll();
  const accrual = Math.round(bizPL("b1", Y2).rev);
  db.businesses[0].method = "cash"; saveAll();
  return { cash, accrual };
});
/* the accounting method the business already carried now changes an answer */
chk('on cash basis only what landed is revenue', basis.cash, 2000);
chk('  on accrual the whole invoice is', basis.accrual, 6000);

console.log('\n— a business that sells goods —');
const prod = await p.evaluate(() => {
  const Y2 = todayISO().slice(0, 4);
  db.transactions = [];
  db.businesses[0].sells = "product"; db.businesses[0].taxRate = 8.9;
  db.invoices = [{ id: "g1", bizId: "b1", number: "0010", clientId: "", title: "Print order", issued: Y2 + "-04-01", terms: "receipt",
    items: [{ id: "g", desc: "Framed prints", unit: "item", qty: 10, rate: 120, cost: 45, taxable: true }],
    payments: [], status: "sent", discount: 0, taxRate: 8.9 }];
  normalize(); saveAll();
  const t = invTotals(db.invoices[0]);
  db.invoices[0].payments = [{ id: "q", date: Y2 + "-04-02", amount: t.total }];
  saveAll();
  const pl = bizPL("b1", Y2);
  return { sub: Math.round(t.sub), cogs: Math.round(t.cogs), tax: +t.tax.toFixed(2), total: +t.total.toFixed(2),
    rev: Math.round(pl.rev), plCogs: Math.round(pl.cogs), held: Math.round(pl.salesTax),
    sched: Object.keys(pl.bySched), profit: Math.round(pl.profit) };
});
chk('ten prints at $120 is $1,200', prod.sub, 1200);
chk('  8.9% sales tax on top', prod.tax, 106.8);
chk('  so the client pays $1,306.80', prod.total, 1306.8);
/* the one that catches people out */
chk('sales tax is not revenue — it was never yours', prod.rev, 1200);
chk('  it is shown as money you are holding for the state', prod.held, 107);
chk('what the stock cost you is cost of goods sold', [prod.cogs, prod.plCogs], [450, 450]);
chk('  which lands on Schedule C line 4', prod.sched.includes('cogs'), true);
/* $1,200 of sales less $450 of stock less Georgia's $50 to keep the LLC
   registered — the takings were $1,306.80 and none of that is the answer */
chk('  and profit is the margin, not the takings', prod.profit, 700);

console.log('\n— clients —');
chk('a client can be added and owes what their invoices owe', await p.evaluate(() => {
  db.clients = [{ id: "c1", bizId: "b1", name: "Terminus Studios", email: "pay@terminus.co", note: "", created: todayISO() }];
  db.invoices[0].clientId = "c1"; db.invoices[0].payments = []; saveAll();
  const inv = db.invoices.filter(v => v.clientId === "c1");
  return { name: clientName("c1"), owed: Math.round(inv.reduce((s, v) => s + invDue(v), 0)) };
}), { name: 'Terminus Studios', owed: 1307 });
chk('deleting a client keeps the invoice, drops the link', await p.evaluate(() => {
  db.invoices.forEach(v => { if (v.clientId === "c1") v.clientId = ""; });
  db.clients = db.clients.filter(c => c.id !== "c1"); saveAll();
  return [db.invoices.length, db.invoices[0].clientId]; }), [1, '']);

console.log('\n— it reaches the rest of the app —');
chk('what you are owed lands in the cash-flow forecast', await p.evaluate(() => {
  const Y2 = todayISO().slice(0, 4);
  const fwd = n => { const d = dayOf(todayISO()); d.setDate(d.getDate() + n); return isoOf(d); };
  db.businesses[0].sells = "service"; db.businesses[0].drawPct = 100;
  db.transactions = [];
  db.accounts = [{ id: "a1", name: "Checking", kind: "checking", value: 1000 }];
  db.invoices = [{ id: "f1", bizId: "b1", number: "0020", clientId: "", title: "Later", issued: todayISO(), terms: "net30",
    items: [{ id: "k", desc: "x", unit: "project", qty: 1, rate: 5000, cost: 0, taxable: false }], payments: [], status: "sent", discount: 0, taxRate: 0 }];
  normalize(); saveAll();
  const f = forecastTo(fwd(60));
  return Math.round(f.owedIn); }), 5000);
chk('  but a business kept separate does not pay you it', await p.evaluate(() => {
  const fwd = n => { const d = dayOf(todayISO()); d.setDate(d.getDate() + n); return isoOf(d); };
  db.businesses[0].linkProfit = false; saveAll();
  const r = Math.round(forecastTo(fwd(60)).owedIn);
  db.businesses[0].linkProfit = true; saveAll(); return r; }), 0);
chk('  and a half-drawn business passes half of it', await p.evaluate(() => {
  const fwd = n => { const d = dayOf(todayISO()); d.setDate(d.getDate() + n); return isoOf(d); };
  db.businesses[0].drawPct = 50; saveAll();
  const r = Math.round(forecastTo(fwd(60)).owedIn);
  db.businesses[0].drawPct = 100; saveAll(); return r; }), 2500);
/* nothing has landed, so there is no revenue — and the year still carries the
   $50 registration, which makes the taxable figure a small loss, not zero */
chk('an unpaid invoice is not yet taxable on cash basis', await p.evaluate(() => {
  const Y2 = todayISO().slice(0, 4);
  return [Math.round(bizPL("b1", Y2).rev), Math.round(bizTaxSplit(Y2).seNet)]; }), [0, -50]);
chk('  and paying it is what makes it taxable', await p.evaluate(() => {
  const Y2 = todayISO().slice(0, 4);
  db.invoices[0].payments = [{ id: "pz", date: todayISO(), amount: 5000 }];
  normalize(); saveAll();
  const r = [Math.round(bizPL("b1", Y2).rev), Math.round(bizTaxSplit(Y2).seNet)];
  db.invoices[0].payments = []; saveAll(); return r; }), [5000, 4950]);

console.log('\n— the landing page says what you are owed —');
await p.evaluate(() => { bizOpen = null; setView('business'); renderBusiness(); });
await p.waitForTimeout(700);
chk('the hero carries it',
  await p.evaluate(() => /Owed to you/i.test(document.getElementById('bizHero').textContent)), true);
chk('  and the row says it instead of revenue',
  await p.evaluate(() => /owed/i.test(document.querySelector('#bizList [data-bizgo]').textContent)), true);

console.log('\n— a gig booked months out —');
/* The case this was built for: a November ball booked in August. The deposit
   holds the date and lands now; the balance is not owed until the job is done.
   Counting from the invoice would have the whole thing overdue all autumn. */
const gig = await p.evaluate(() => {
  const fwd = n => { const d = dayOf(todayISO()); d.setDate(d.getDate() + n); return isoOf(d); };
  db.transactions = [];
  db.invoices = [{ id: "nv", bizId: "b1", number: "0100", clientId: "", title: "The ball",
    issued: todayISO(), serviceDate: fwd(90), terms: "completion",
    deposit: { pct: 30, when: "booking" },
    items: [{ id: "n1", desc: "Coverage", unit: "project", qty: 1, rate: 6000, cost: 0, taxable: false }],
    payments: [], status: "sent", discount: 0, taxRate: 0 }];
  normalize(); saveAll();
  const v = db.invoices[0];
  return { gig: gigDate(v), balanceDue: invDueDate(v), depDue: depositDueDate(v),
    inst: invOutstanding(v).map(x => `${x.label} ${Math.round(x.amount)} due ${x.due}`),
    late: invDaysLate(v), status: invStatus(v),
    nextDue: invNextDue(v), owed: Math.round(receivables("b1").total),
    lateAmt: Math.round(receivables("b1").late) };
});
const in90 = await p.evaluate(() => { const d = dayOf(todayISO()); d.setDate(d.getDate() + 90); return isoOf(d); });
chk('the balance falls due on the job, not 30 days from today', gig.balanceDue, in90);
chk('  the deposit is owed now', gig.depDue, await p.evaluate(() => todayISO()));
chk('  and they are two debts with two dates',gig.inst,
  [`Deposit 1800 due ${await p.evaluate(() => todayISO())}`, `Balance 4200 due ${in90}`]);
chk('  nothing is late, because nothing is past its date', [gig.late, gig.status], [0, 'sent']);
chk('  all $6,000 is owed to you', gig.owed, 6000);
chk('  and none of it is past due', gig.lateAmt, 0);

console.log('\n  the deposit lands, the balance keeps its date');
chk('paying the deposit leaves the balance on the job date', await p.evaluate(() => {
  const v = db.invoices[0];
  v.payments = [{ id: "d1", date: todayISO(), amount: 1800, note: "deposit" }];
  saveAll();
  const open = invOutstanding(v).filter(x => x.remaining > 0.005);
  return { status: invStatus(v), left: Math.round(invDue(v)),
    next: open[0].label, nextDue: open[0].due, late: invDaysLate(v) }; }),
  { status: 'part', left: 4200, next: 'Balance', nextDue: in90, late: 0 });

console.log('\n  a missed deposit is chased on its own');
chk('the deposit can be late while the balance is not owed at all', await p.evaluate(() => {
  const back = n => { const d = dayOf(todayISO()); d.setDate(d.getDate() - n); return isoOf(d); };
  const v = db.invoices[0];
  v.payments = []; v.issued = back(20); v.deposit = { pct: 30, when: "booking" };
  saveAll();
  const r = receivables("b1");
  return { total: Math.round(r.total), late: Math.round(r.late), oldest: r.oldest,
    status: invStatus(v) }; }), { total: 6000, late: 1800, oldest: 20, status: 'overdue' });

console.log('\n  and the forecast puts each half on its own date');
const fc = await p.evaluate(() => {
  const fwd = n => { const d = dayOf(todayISO()); d.setDate(d.getDate() + n); return isoOf(d); };
  db.businesses[0].drawPct = 100; db.businesses[0].linkProfit = true;
  db.accounts = [{ id: "a1", name: "Checking", kind: "checking", value: 500 }];
  saveAll();
  return { soon: Math.round(forecastTo(fwd(30)).owedIn),
    later: Math.round(forecastTo(fwd(120)).owedIn) };
});
chk('within a month only the deposit is expected', fc.soon, 1800);
chk('  past the job date, the whole thing is', fc.later, 6000);

console.log('\n— a date you type yourself —');
chk('custom terms take the date you give them', await p.evaluate(() => {
  const v = db.invoices[0];
  v.terms = "custom"; v.due = "2027-01-15"; delete v.deposit; v.payments = [];
  saveAll();
  return [invDueDate(v), invNextDue(v)]; }), ['2027-01-15', '2027-01-15']);
chk('  clearing the job date drops terms that needed it', await p.evaluate(() => {
  const v = db.invoices[0];
  v.terms = "gig14"; v.serviceDate = ""; normalize(); saveAll();
  return v.terms; }), 'net30');

console.log(`\n${pass} passed, ${fail} failed`);
console.log('page errors:', errs.length ? errs : 'none');
await b.close();
if (fail || errs.length) process.exitCode = 1;
