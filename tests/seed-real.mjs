/* A believable book for a freelance film photographer in Atlanta with mixed
   W-2 and 1099 income. Exported so the visual sweeps and the polish runs all
   look at the same app rather than at empty states. */
export const SEED = (page) => page.evaluate(() => {
  const Y = todayISO().slice(0, 4), MK = monthKey(todayISO());
  const prevM = (() => { const d = dayOf(todayISO()); d.setDate(1); d.setMonth(d.getMonth() - 1); return monthOf(d); })();
  const day = (m, d) => `${Y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const thisM = +MK.slice(5, 7);

  db.accounts = [
    { id: "nf", name: "Navy Federal", kind: "bank", value: 0, parentId: null, collapsed: false },
    { id: "nfc", name: "Everyday Checking", kind: "checking", value: 4182.44, parentId: "nf" },
    { id: "nfs", name: "Emergency", kind: "savings", value: 6250, parentId: "nf" },
    { id: "one", name: "OnePay", kind: "bank", value: 0, parentId: null, collapsed: true },
    { id: "onec", name: "Spending", kind: "checking", value: 318.9, parentId: "one" },
    { id: "cash", name: "Cash on hand", kind: "cash", value: 240, parentId: null },
    { id: "rh", name: "Robinhood", kind: "brokerage", value: 18430, parentId: null, fromHoldings: true },
    { id: "emp", name: "Empower 401(k)", kind: "r401k", value: 33195, parentId: null,
      contribs: [{ id: "c1", date: day(2, 1), amount: 4200, who: "me" },
                 { id: "c2", date: day(5, 1), amount: 4200, who: "me" }] },
    { id: "roth", name: "Roth IRA", kind: "roth", value: 9120, parentId: null,
      contribs: [{ id: "c3", date: day(3, 12), amount: 3500, who: "me" }] },
  ];
  db.debts = [
    { id: "d1", name: "Milestone Card", kind: "card", balance: 412, start: 900, limit: 1500, apr: 24.9, payment: 60, payments: [{ id: "p1", date: day(thisM, 4), amount: 60 }] },
    { id: "d2", name: "Navy Federal Auto", kind: "auto", balance: 8940, start: 24000, apr: 6.4, payment: 412, payments: [] },
  ];
  db.income = [
    { id: "i1", name: "Ozark Law", model: "monthly", amount: 3400, payFreq: "biweekly", firstPay: day(1, 9), taxClass: "w2", active: true },
    { id: "i2", name: "Freelance shoots", model: "daily", rate: 750, units: 2, payFreq: "monthly", firstPay: day(1, 20), taxClass: "se", active: true },
    { id: "i3", name: "Stock footage", model: "monthly", amount: 240, payFreq: "monthly", firstPay: day(1, 1), taxClass: "se", passive: true, active: true },
  ];
  db.paychecks = [];
  for (let m = 1; m <= thisM; m++) {
    db.paychecks.push({ id: "pc" + m + "a", date: day(m, 9), source: "Ozark Law", gross: 1700, net: 1287 });
    db.paychecks.push({ id: "pc" + m + "b", date: day(m, 23), source: "Ozark Law", gross: 1700, net: 1287 });
    if (m % 2) db.paychecks.push({ id: "pc" + m + "c", date: day(m, 20), source: "Freelance shoots", gross: 3000, net: 3000 });
  }
  db.recurring = [
    { id: "r1", name: "Rent", category: "Rent/Mortgage", amount: 1685, dueDay: 1, tier: "essential", group: "Housing" },
    { id: "r2", name: "Georgia Power", category: "Electric", amount: 128, dueDay: 12, tier: "essential", group: "Utilities" },
    { id: "r3", name: "AT&T Fiber", category: "Internet", amount: 80, dueDay: 15, tier: "essential", group: "Utilities" },
    { id: "r4", name: "Mint Mobile", category: "Phone", amount: 30, dueDay: 18, tier: "essential", group: "Utilities" },
    { id: "r5", name: "Car insurance", category: "Insurance", amount: 402, dueDay: 6, freq: "quarterly", anchor: MK, tier: "essential", group: "Insurance" },
    { id: "r6", name: "Adobe CC", category: "Subscriptions", amount: 62, dueDay: 22, tier: "flexible", group: "Subscriptions", bizId: "b1", bizPct: 80, autopay: true, autoSince: Y + "-01" },
    { id: "r7", name: "Spotify", category: "Subscriptions", amount: 12, dueDay: 9, tier: "luxury", group: "Subscriptions", autopay: true, autoSince: Y + "-01" },
    { id: "r8", name: "Planet Fitness", category: "Fitness", amount: 25, dueDay: 17, tier: "luxury", group: "Health" },
  ];
  db.budgets = { Groceries: 480, Restaurants: 220, "Auto & Gas": 180, Gear: 300, Coffee: 60, Entertainment: 120 };
  db.budgetMeta = {}; Object.keys(db.budgets).forEach(c => db.budgetMeta[c] = { since: Y + "-01", roll: true });

  const merchants = [
    ["Kroger", "Groceries", -60, -140], ["Publix", "Groceries", -30, -90],
    ["Waffle House", "Restaurants", -12, -28], ["Ponce City Market", "Restaurants", -24, -60],
    ["Shell", "Auto & Gas", -38, -62], ["QuikTrip", "Auto & Gas", -30, -55],
    ["Chrome Industries", "Gear", -80, -260], ["B&H Photo", "Gear", -120, -480],
    ["Rev Coffee", "Coffee", -5, -9], ["Chattahoochee Coffee", "Coffee", -4, -8],
    ["Plaza Theatre", "Entertainment", -14, -32], ["Netflix", "Entertainment", -16, -16],
  ];
  db.transactions = [];
  let n = 0;
  for (let m = Math.max(1, thisM - 5); m <= thisM; m++) {
    for (let k = 0; k < 22; k++) {
      const [desc, cat, lo, hi] = merchants[(m * 7 + k) % merchants.length];
      const amt = lo + ((m * 13 + k * 29) % 100) / 100 * (hi - lo);
      db.transactions.push({ id: "tx" + (n++), date: day(m, 1 + ((k * 5 + m) % 27)),
        desc, category: cat, amount: +amt.toFixed(2), acctId: k % 5 ? "nfc" : "onec" });
    }
  }
  db.transactions.push(
    { id: "bz1", date: day(Math.max(1, thisM - 3), 14), desc: "Cordell wedding", category: "Income", amount: 4200, bizId: "b1" },
    { id: "bz2", date: day(Math.max(1, thisM - 2), 3), desc: "Brand film — Terminus", category: "Income", amount: 8600, bizId: "b1" },
    { id: "bz3", date: day(Math.max(1, thisM - 2), 19), desc: "Sigma 24-70 Art", category: "Gear", amount: -1180, bizId: "b1" },
    { id: "bz4", date: day(Math.max(1, thisM - 1), 8), desc: "Doc short — Westside", category: "Income", amount: 5400, bizId: "b1" });
  /* the glasses: one thing that happened, spread over three weeks, three
     categories and a partial reimbursement */
  db.oneoffs = [
    { id: "oo1", name: "New glasses", kind: "medical", opened: day(Math.max(1, thisM - 1), 6), closed: "", note: "Sat on them." },
    { id: "oo2", name: "Alternator", kind: "repair", opened: day(Math.max(1, thisM - 4), 11),
      closed: day(Math.max(1, thisM - 4), 13), note: "" }];
  db.transactions.push(
    { id: "oo1a", date: day(Math.max(1, thisM - 1), 6), desc: "Atlanta Eye Care", category: "Health", amount: -145, acctId: "nfc", oneId: "oo1" },
    { id: "oo1b", date: day(Math.max(1, thisM - 1), 14), desc: "Warby Parker frames", category: "Health", amount: -295, acctId: "nfc", oneId: "oo1" },
    { id: "oo1c", date: day(thisM, 4), desc: "Lenses — Pearle", category: "Health", amount: -262, acctId: "nfc", oneId: "oo1" },
    { id: "oo1d", date: day(thisM, 12), desc: "Vision plan reimbursement", category: "Health", amount: 180, acctId: "nfc", oneId: "oo1" },
    { id: "oo2a", date: day(Math.max(1, thisM - 4), 11), desc: "Buckhead Auto", category: "Auto & Gas", amount: -640, acctId: "nfc", oneId: "oo2" },
    { id: "oo2b", date: day(Math.max(1, thisM - 4), 13), desc: "Towing", category: "Auto & Gas", amount: -95, acctId: "nfc", oneId: "oo2" });
  db.transactions.push({ id: "rv1", date: day(thisM, 2), desc: "SQ *UNKNOWN VENDOR", category: "Uncategorized", amount: -74.2, review: true, acctId: "nfc" },
    { id: "rv2", date: day(thisM, 3), desc: "PAYPAL *INST XFER", category: "Uncategorized", amount: -22, review: true, acctId: "nfc" });
  db.transactions.sort((a, b) => b.date.localeCompare(a.date));

  db.holdings = [
    { id: "h1", name: "Realty Income", ticker: "O", shares: 82, price: 58.4, avgCost: 52.1, divPerShare: 0.264, divFreq: "monthly", divBasis: "payment", lastDiv: day(thisM, 15) },
    { id: "h2", name: "Schwab US Dividend", ticker: "SCHD", shares: 140, price: 28.9, avgCost: 24.6, divPerShare: 0.27, divFreq: "quarterly", divBasis: "payment", lastDiv: day(Math.max(1, thisM - 1), 24), drip: true },
    { id: "h3", name: "Vanguard S&P 500", ticker: "VOO", shares: 21, price: 512, avgCost: 421, divPerShare: 1.72, divFreq: "quarterly", divBasis: "payment", drip: true },
  ];
  db.dividends = [{ id: "dv1", date: day(thisM, 15), holdingId: "h1", amount: 21.65 }];
  db.creditLog = [{ id: "cl1", date: day(Math.max(1, thisM - 4), 1), score: 668 },
    { id: "cl2", date: day(Math.max(1, thisM - 2), 1), score: 691 },
    { id: "cl3", date: day(thisM, 1), score: 712 }];
  db.goals = [
    { id: "g1", kind: "cash", name: "Six months of runway", target: 18000, saved: 6250, deadline: (+Y + 1) + "-06-30", created: Y + "-01-01" },
    { id: "g2", kind: "debt", name: "Clear the Milestone card", target: 900, deadline: Y + "-12-31", created: Y + "-01-01" },
    { id: "g3", kind: "custom", name: "Cine lens set", target: 4500, saved: 900, deadline: (+Y + 1) + "-03-01", created: Y + "-02-01" },
  ];
  db.businesses = [{ id: "b1", name: "L Roy Media", kind: "llc", state: "GA", industry: "Photography & video production",
    drawPct: 70, linkProfit: true, active: true, color: "#0284c7", created: Y + "-01-01", started: Y + "-01-01",
    method: "cash", ownerPct: 100, salary: 0, salaryBooked: false, feeBooked: true,
    office: { on: true, method: "simplified", sqft: 120, totalSqft: 0, annualCosts: 0 },
    mileage: { on: true, rate: 0.70, log: [
      { id: "m1", date: day(Math.max(1, thisM - 3), 14), miles: 186, note: "Cordell wedding — Savannah" },
      { id: "m2", date: day(Math.max(1, thisM - 2), 3), miles: 64, note: "Terminus shoot" },
      { id: "m3", date: day(thisM, 6), miles: 42, note: "Scout — Westside" }] } }];
  db.clients = [
    { id: "cl1", bizId: "b1", name: "Terminus Studios", email: "pay@terminus.co", phone: "", note: "always pays at 45 days", created: Y + "-01-08" },
    { id: "cl2", bizId: "b1", name: "The Cordells", email: "", phone: "", note: "", created: Y + "-02-02" },
    { id: "cl3", bizId: "b1", name: "Westside Collective", email: "ap@westside.org", phone: "", note: "", created: Y + "-04-01" }];
  const back = n => { const d = dayOf(todayISO()); d.setDate(d.getDate() - n); return isoOf(d); };
  db.invoices = [
    { id: "iv1", bizId: "b1", number: "0001", clientId: "cl2", title: "Cordell wedding", issued: back(96), terms: "net30",
      items: [{ id: "a1", desc: "Full day coverage", unit: "day", qty: 2, rate: 1500, cost: 0, taxable: false },
              { id: "a2", desc: "Album", unit: "project", qty: 1, rate: 1200, cost: 0, taxable: false }],
      payments: [{ id: "p1", date: back(96), amount: 2100, note: "deposit" },
                 { id: "p2", date: back(58), amount: 2100, note: "" }], status: "sent", discount: 0, taxRate: 0, note: "" },
    { id: "iv2", bizId: "b1", number: "0002", clientId: "cl1", title: "Brand film", issued: back(41), terms: "net45",
      items: [{ id: "b1i", desc: "Two-day shoot", unit: "day", qty: 2, rate: 2400, cost: 0, taxable: false },
              { id: "b2i", desc: "Edit and colour", unit: "hour", qty: 18, rate: 120, cost: 0, taxable: false }],
      payments: [{ id: "p3", date: back(41), amount: 3480, note: "deposit" }], status: "sent", discount: 0, taxRate: 0, note: "Balance on delivery of the final cut" },
    { id: "iv3", bizId: "b1", number: "0003", clientId: "cl3", title: "Doc short — Westside", issued: back(74), terms: "net30",
      items: [{ id: "c1i", desc: "Production", unit: "project", qty: 1, rate: 5400, cost: 0, taxable: false }],
      payments: [], status: "sent", discount: 0, taxRate: 0, note: "" },
    { id: "iv4", bizId: "b1", number: "0004", clientId: "cl1", title: "Q3 retainer", issued: back(4), terms: "net30",
      items: [{ id: "d1i", desc: "Monthly retainer", unit: "project", qty: 1, rate: 1800, cost: 0, taxable: false }],
      payments: [], status: "sent", discount: 0, taxRate: 0, note: "" },
    { id: "iv5", bizId: "b1", number: "0005", clientId: "cl2", title: "Engagement session", issued: todayISO(), terms: "net15",
      items: [{ id: "e1i", desc: "Half day", unit: "day", qty: 0.5, rate: 1500, cost: 0, taxable: false }],
      payments: [], status: "draft", discount: 0, taxRate: 0, note: "" },
    /* booked months out: the deposit holds the date, the balance waits on the work */
    { id: "iv6", bizId: "b1", number: "0006", clientId: "cl1", title: "Winter ball", issued: todayISO(),
      serviceDate: (() => { const d = dayOf(todayISO()); d.setDate(d.getDate() + 92); return isoOf(d); })(),
      terms: "completion", deposit: { pct: 30, when: "booking" },
      items: [{ id: "f1i", desc: "Evening coverage", unit: "project", qty: 1, rate: 4800, cost: 0, taxable: false }],
      payments: [], status: "sent", discount: 0, taxRate: 0, note: "Balance on delivery" }];
  db.snapshots = [];
  for (let m = Math.max(1, thisM - 5); m <= thisM; m++)
    db.snapshots.push({ m: `${Y}-${String(m).padStart(2, "0")}`, net: 28000 + m * 2100 });
  db.tax.stateName = "Georgia"; db.tax.stateRate = 5.39; db.tax.enabled = true;
  db.tax.reserve = [{ id: "tr1", date: day(Math.max(1, thisM - 2), 20), amount: 1180, source: "Freelance shoots", auto: true },
    { id: "tr2", date: day(thisM, 20), amount: 1180, source: "Freelance shoots", auto: true }];
  db.tax.paid = [];
  normalize(); saveAll();
});
