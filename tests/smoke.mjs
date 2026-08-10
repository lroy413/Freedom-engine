/* One consolidated regression pass against the CURRENT markup.
   The older suites were written against DOM that has since been replaced
   twice over; this checks the maths and the wiring that actually matter. */
import pkg from 'playwright';
const {chromium}=pkg;
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:1440,height:1200},timezoneId:'America/New_York'});
const p=await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8899/index.html'); await p.waitForTimeout(800);

let pass=0,fail=0;
const chk=(name,got,want)=>{const ok=JSON.stringify(got)===JSON.stringify(want);
  console.log((ok?'  ok   ':'  FAIL ')+name+(ok?'':`  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`));
  ok?pass++:fail++;};

const MK=await p.evaluate(()=>monthOf(todayISO()));
await p.evaluate((MK)=>{
  db.accounts=[{id:"i1",name:"Chase",kind:"bank",value:0,parentId:null},
    {id:"a1",name:"Checking",kind:"checking",value:4200,parentId:"i1"},
    {id:"a2",name:"Savings",kind:"savings",value:9000,parentId:"i1"},
    {id:"c1",name:"Chase Visa",kind:"credit",value:1450,parentId:"i1",limit:5000},
    {id:"l1",name:"Auto loan",kind:"autoloan",value:14200,parentId:null,orig:24000,apr:6.9,payment:420}];
  db.debts=[];
  db.income=[{id:"s1",name:"Gig work",model:"monthly",amount:2600,payFreq:"monthly",firstPay:"2026-08-07"},
    {id:"s2",name:"Roommate rent",model:"monthly",amount:900,payFreq:"monthly",notax:true,firstPay:"2026-08-01"}];
  db.recurring=[{id:"r1",name:"Rent",category:"Rent",amount:1650,dueDay:1},
    {id:"r2",name:"Netflix",category:"Subscriptions",amount:23,dueDay:8},
    {id:"r3",name:"Car insurance",category:"Insurance",amount:390,dueDay:15,freq:"quarterly",anchor:MK},
    {id:"r4",name:"Domain",category:"Business",amount:60,dueDay:20,freq:"annual",anchor:"2026-11",biz:true}];
  db.budgets={"Food":500,"Auto & Gas":180};
  db.holdings=[{id:"h1",name:"Realty Income",ticker:"O",shares:40,price:58,avgCost:52,
    divPerShare:0.264,divFreq:"monthly",divBasis:"payment",lastDiv:"2026-07-15"}];
  db.transactions=[{id:"t1",date:"2026-07-05",desc:"Kroger",category:"Food",amount:-120,acct:"a1"},
    {id:"t2",date:"2026-07-11",desc:"Shell",category:"Auto & Gas",amount:-64,acct:"c1"},
    {id:"t3",date:"2026-07-12",desc:"Move to savings",category:"Transfer",amount:-500,acct:"a1"}];
  db.settings.taxEnabled=true; db.settings.taxRate=18;
  saveAll();},MK);
await p.waitForTimeout(500);

console.log('\n— core maths —');
const m=await p.evaluate(()=>{const mk=monthOf(todayISO());return{
  cash:totalCash(), invest:investTotal(), unlinked:unlinkedCardDebt(), net:netWorth(),
  billsThisMonth:db.recurring.reduce((s,x)=>s+billAmountIn(x,mk),0),
  trueMonthly:Math.round(db.recurring.reduce((s,x)=>s+billMonthly(x),0)),
  divAnnual:Math.round(estAnnualDiv()), today:todayISO(), mk};});
chk('cash = 4200 + 9000',m.cash,13200);
chk('investments = 40 × 58',m.invest,2320);
/* every liability not yet mirrored into Debt — card 1450 + auto loan 14200 —
   counted positive so net worth can subtract it without a double negative */
chk('unmirrored liabilities counted positive',m.unlinked,15650);
chk('net worth = 13200 + 2320 - 15650',m.net,-130);
chk('bills due this month (rent + netflix + quarterly)',m.billsThisMonth,1650+23+390);
chk('amortised true monthly (1650+23+130+5)',m.trueMonthly,1808);
chk('dividends 0.264 × 12 × 40',m.divAnnual,127);
chk('todayISO is a plain local date',/^\d{4}-\d{2}-\d{2}$/.test(m.today),true);

console.log('\n— transfers are neither income nor spending —');
const tr=await p.evaluate(()=>{const mk="2026-07";
  return {tot:monthTotals(mk),food:spentFor("Food",mk),xfer:spentFor("Transfer",mk)};});
chk('transfer left out of month income',tr.tot.inc,0);
chk('transfer left out of month expense (only 120+64)',tr.tot.exp,184);
chk('Food spend tracked',tr.food,120);
chk('Transfer category spends nothing',tr.xfer,0);

console.log('\n— every view renders —');
for(const v of ['dash','accounts','income','expenses','budget','goals','credit','invest','data']){
  const r=await p.evaluate(async v=>{setView(v);await new Promise(r=>setTimeout(r,220));
    const s=document.getElementById('view-'+v); return !!s&&s.offsetHeight>200;},v);
  chk(`view ${v} renders`,r,true);
}

console.log('\n— bill partial payments —');
const bp=await p.evaluate(async()=>{const mk=monthOf(todayISO()),bill=db.recurring[0];
  logBillPayment(bill,mk,900); saveAll(); await new Promise(r=>setTimeout(r,120));
  const mid={paid:billPaid(bill,mk),amt:billPaidAmt(bill,mk),left:Math.round(billRemaining(bill,mk))};
  logBillPayment(bill,mk,750); saveAll(); await new Promise(r=>setTimeout(r,120));
  return {mid,after:{paid:billPaid(bill,mk),amt:billPaidAmt(bill,mk)}};});
chk('900 of 1650 → partial, 750 left',[bp.mid.paid,bp.mid.amt,bp.mid.left],[false,900,750]);
chk('+750 → paid in full',[bp.after.paid,bp.after.amt],[true,1650]);

console.log('\n— linked accounts generate typed debts —');
const dz=await p.evaluate(async()=>{cardAccounts().forEach(a=>{if(!linkedDebt(a))makeDebtFor(a);});
  syncLinkedDebts(); saveAll();
  await new Promise(r=>setTimeout(r,200));
  return db.debts.map(d=>[d.name,d.kind,Math.round(num(d.balance))]);});
console.log('   debts:',JSON.stringify(dz));
chk('the visa became a credit-card debt',!!dz.find(d=>/Visa/.test(d[0])&&d[1]==='card'&&d[2]===1450),true);
chk('the auto loan became an auto debt',!!dz.find(d=>/Auto/.test(d[0])&&d[1]==='auto'&&d[2]===14200),true);
chk('no double count once linked',await p.evaluate(()=>unlinkedCardDebt()),0);

console.log('\n— projection respects the non-taxable stream —');
const pr=await p.evaluate(()=>{const from=todayISO(),to=(()=>{const d=dayOf(from);d.setMonth(d.getMonth()+3);return isoOf(d);})();
  const a=projectIncome(from,to);
  return {parts:a.parts.map(x=>[x.name,Math.round(x.amt),Math.round(x.net),!!x.notax])};});
console.log('   ',JSON.stringify(pr.parts));
const rent=pr.parts.find(x=>x[0]==='Roommate rent'), gig=pr.parts.find(x=>x[0]==='Gig work');
chk('rent is flagged non-taxable',rent[3],true);
chk('rent net = rent gross (untaxed)',rent[1],rent[2]);
chk('gig work net is reduced by tax',gig[2]<gig[1],true);

console.log('\n— backup carries the book, not the credentials —');
const bk=await p.evaluate(()=>{const j=JSON.parse(JSON.stringify(db)); const s=JSON.stringify(j);
  return {hasAccounts:Array.isArray(j.accounts)&&j.accounts.length>0,
    leaksToken:/github_pat|ghp_|passphrase|accessUrl/i.test(s)};});
chk('backup includes accounts',bk.hasAccounts,true);
chk('backup leaks no credentials',bk.leaksToken,false);
chk('credentials live in their own key',
  await p.evaluate(()=>Object.keys(localStorage).includes('fe_sync_v1')||!localStorage.getItem('moneymachine_v1').includes('github_pat')),true);

console.log('\n— income typed in Spending is actual income too —');
const ai=await p.evaluate(()=>{
  const rel=n=>{const d=dayOf(todayISO());d.setDate(d.getDate()+n);return isoOf(d);};
  const mk=monthKey(todayISO());
  db.paychecks=[{id:"ap",date:rel(-4),source:"Ozark Law",gross:2100,net:1720}];
  db.transactions=[
    {id:"ai1",date:rel(-2),desc:"Cash gig",amount:800,category:"Income"},
    {id:"ai2",date:rel(-1),desc:"Kroger",amount:-60,category:"Groceries"},
    {id:"ai3",date:rel(-3),desc:"Moved money",amount:500,category:"Transfer"},
    {id:"ai4",date:rel(-5),desc:"Rent refund",amount:75,category:"Rent/Mortgage",billRef:"b1|"+mk}];
  saveAll();
  const es=actualIncomeEntries();
  return {kinds:es.map(e=>e.kind).join(","),
    names:es.map(e=>e.source),
    received:Math.round(actualIncomeIn(mk)),
    excludesTransfer:!es.some(e=>e.source==="Moved money"),
    excludesSpend:!es.some(e=>e.source==="Kroger"),
    excludesBillRefund:!es.some(e=>e.source==="Rent refund")};});
chk('a cash gig typed in Spending shows as income',ai.names.includes("Cash gig"),true);
chk('  beside the logged paycheck',ai.names.includes("Ozark Law"),true);
chk('received counts both',ai.received,2520);
chk('a transfer is not income',ai.excludesTransfer,true);
chk('nor is a purchase',ai.excludesSpend,true);
chk('nor is money coming back off a bill',ai.excludesBillRefund,true);

console.log('\n— rollover is a share, not a switch —');
const rl=await p.evaluate(()=>{
  const relM=n=>{const d=dayOf(todayISO());d.setDate(1);d.setMonth(d.getMonth()+n);return monthOf(d);};
  const on=(mo,day)=>{const d=dayOf(todayISO());d.setDate(1);d.setMonth(d.getMonth()+mo);d.setDate(day);return isoOf(d);};
  const now=monthKey(todayISO());
  db.accounts=[{id:"rk",name:"Chk",kind:"checking",value:5000,parentId:null}];
  db.recurring=[]; db.debts=[]; db.goals=[]; db.budgets={Food:400};
  db.transactions=[{id:"q1",date:on(-2,5),desc:"shop",amount:-300,category:"Food"},
                   {id:"q2",date:on(-1,5),desc:"shop",amount:-300,category:"Food"}];
  const out={};
  for(const pct of [100,50,0]){
    db.budgetMeta={Food:{since:relM(-2),roll:pct>0,rollPct:pct}}; saveAll();
    out["p"+pct]=Math.round(carriedInto("Food",now));
  }
  db.transactions=[{id:"q3",date:on(-1,5),desc:"blowout",amount:-700,category:"Food"}];
  db.budgetMeta={Food:{since:relM(-1),roll:true,rollPct:50}}; saveAll();
  out.overspend=Math.round(carriedInto("Food",now));
  db.budgetMeta={Food:{since:relM(-1),roll:true}};  saveAll(); out.legacyOn=budgetRollPct("Food");
  db.budgetMeta={Food:{since:relM(-1),roll:false}}; saveAll(); out.legacyOff=budgetRollPct("Food");
  return out;});
chk('all of it still rolls all of it',rl.p100,200);
chk('half compounds correctly month to month',rl.p50,75);
chk('none rolls nothing',rl.p0,0);
chk('an overspend carries in full whatever the share',rl.overspend,-300);
chk('a book with only the old switch reads 100',rl.legacyOn,100);
chk('  and 0 when it was off',rl.legacyOff,0);

console.log('\n— month in review reads the month back —');
const rc=await p.evaluate(()=>{
  const rel=n=>{const d=dayOf(todayISO());d.setDate(d.getDate()+n);return isoOf(d);};
  const mk=monthKey(todayISO());
  db.budgets={}; db.budgetMeta={}; db.goals=[]; db.debts=[];
  db.recurring=[{id:"rr",name:"Rent",category:"Rent/Mortgage",amount:1000,dueDay:1,freq:"monthly",tier:"essential"}];
  db.paychecks=[{id:"rp",date:rel(-2),source:"Gig",gross:1200,net:1000}];
  db.transactions=[
    {id:"r1",date:rel(-1),desc:"Kroger",amount:-40,category:"Groceries"},
    {id:"r2",date:rel(-1),desc:"Kroger",amount:-30,category:"Groceries"},
    {id:"r3",date:rel(-2),desc:"Kroger",amount:-30,category:"Groceries"},
    {id:"r4",date:rel(-3),desc:"B&H Photo",amount:-500,category:"Gear"},
    {id:"r5",date:rel(-1),desc:"Moved money",amount:-999,category:"Transfer"}];
  saveAll();
  const r=monthRecap(mk);
  return {income:r.income, spend:Math.round(r.spend), count:r.spendCount,
    topCat:r.cats[0][0], topMerchName:r.merch[0][0], topMerchN:r.merch[0][1].n,
    biggest:r.biggest.desc, titleIsString:typeof recapTitle(r).t==="string"};});
chk('a logged paycheck counts as income',rc.income,1000);
chk('transfers are left out of the spend',rc.spend,600);
chk('  and out of the count',rc.count,4);
chk('the biggest category is found',rc.topCat,'Gear');
chk('so is the most-visited merchant',rc.topMerchName,'Kroger');
chk('  with its visit count',rc.topMerchN,3);
chk('and the single largest purchase',rc.biggest,'B&H Photo');
chk('every month earns a title',rc.titleIsString,true);

console.log('\n— temporary envelopes and goal savings plans —');
const tb=await p.evaluate(()=>{
  const relM=n=>{const d=dayOf(todayISO());d.setDate(1);d.setMonth(d.getMonth()+n);return monthOf(d);};
  const rel=n=>{const d=dayOf(todayISO());d.setDate(d.getDate()+n);return isoOf(d);};
  const now=monthKey(todayISO());
  db.accounts=[{id:"tb",name:"Chk",kind:"checking",value:5000,parentId:null}];
  db.recurring=[]; db.debts=[]; db.goals=[]; db.transactions=[];
  db.budgets={Groceries:400,Vacation:600};
  db.budgetMeta={Groceries:{since:relM(-3),roll:true,tier:"essential"},
    Vacation:{since:relM(-1),until:relM(1),roll:true,tier:"luxury"}};
  saveAll();
  const during=Math.round(freedomNeed().maintain);
  const heldInItsMonth=budgetedFor("Vacation",relM(0));
  db.budgetMeta.Vacation.until=relM(-1); saveAll();      // now finished
  return {during, after:Math.round(freedomNeed().maintain), heldInItsMonth,
    pastMonthKept:budgetedFor("Vacation",relM(-1)),
    askedForNow:budgetedFor("Vacation",now)};});
chk('a temporary envelope counts while it runs',tb.during,1000);
chk('and stops counting once it has ended',tb.after,400);
chk('the months it covered keep their figure',tb.pastMonthKept,600);
chk('it asks for nothing after its last month',tb.askedForNow,0);

const gp=await p.evaluate(()=>{
  const rel=n=>{const d=dayOf(todayISO());d.setDate(d.getDate()+n);return isoOf(d);};
  db.budgets={}; db.budgetMeta={};
  db.goals=[{id:"gp1",kind:"custom",name:"Japan trip",target:3600,link:[],contribs:[],deadline:rel(365)}];
  saveAll();
  const g=db.goals[0];
  const reservedUnplanned=Math.round(safeToSpend().goals);
  attachGoalPlan(g,goalPlanAmount(g,"date")); saveAll();
  const out={monthly:db.budgets[g.planCat], endsWithGoal:budgetUntil(g.planCat)===monthKey(g.deadline),
    reservedUnplanned, reservedOncePlanned:Math.round(safeToSpend().goals),
    envelope:Math.round(safeToSpend().env)};
  detachGoalPlan(g); saveAll();
  out.reservedAgainAfterRemoving=Math.round(safeToSpend().goals);
  out.budgetRemoved=db.budgets[g.planCat]===undefined;
  return out;});
chk('a deadline sets the monthly figure',gp.monthly,300);
chk("the envelope ends when the goal is due",gp.endsWithGoal,true);
chk('an unplanned goal is reserved by its pace',gp.reservedUnplanned,300);
chk('a planned goal is not reserved twice',gp.reservedOncePlanned,0);
chk('  because the envelope holds it instead',gp.envelope,300);
chk('removing the plan removes the envelope',gp.budgetRemoved,true);
chk('and the pace reserve comes back',gp.reservedAgainAfterRemoving,300);

console.log('\n— the category list grows without disturbing what is already tagged —');
const cats=await p.evaluate(()=>{
  db.categories=["Income","Food","Misc","Uncategorized"];      // an older, shorter list
  db.budgets={Food:400}; db.budgetMeta={};
  db.transactions=[{id:"ct1",date:todayISO(),desc:"old",amount:-20,category:"Food"}];
  saveAll(); normalize();
  return {hasGroceries:db.categories.includes("Groceries"),
    hasRestaurants:db.categories.includes("Restaurants"),
    keptFood:db.categories.includes("Food"),
    txStillFood:db.transactions[0].category==="Food",
    budgetKept:db.budgets.Food===400,
    groceriesTier:budgetTier("Groceries"), restaurantsTier:budgetTier("Restaurants"),
    hueDiffers:catColorOf("Groceries")!==catColorOf("Restaurants")};});
chk('a new default reaches an existing book',cats.hasGroceries,true);
chk('eating out is its own category now',cats.hasRestaurants,true);
chk('the old catch-all is never removed',cats.keptFood,true);
chk('transactions keep the category they had',cats.txStillFood,true);
chk('so do budgets',cats.budgetKept,true);
chk('groceries count toward Survive',cats.groceriesTier,'essential');
chk('eating out does not',cats.restaurantsTier,'luxury');
chk('and they are told apart by colour',cats.hueDiffers,true);

console.log('\n— safe to spend reserves what is already promised —');
const sts=await p.evaluate(()=>{
  const rel=n=>{const d=dayOf(todayISO());d.setDate(d.getDate()+n);return isoOf(d);};
  db.accounts=[{id:"sa",name:"Checking",kind:"checking",value:5000,parentId:null}];
  db.recurring=[]; db.budgets={}; db.budgetMeta={}; db.holdings=[]; db.income=[];
  db.debts=[{id:"sd",name:"Loan",kind:"auto",balance:9000,start:12000,payment:400,payments:[]}];
  db.goals=[{id:"sg",kind:"cash",name:"Cushion",target:5600,link:[],contribs:[],deadline:rel(365)},
    {id:"sg2",kind:"custom",name:"Someday",target:9999,link:[],contribs:[]}];  // no deadline
  saveAll();
  const a=safeToSpend();
  /* a debt the app mirrored into Bills must not be counted twice */
  const mirrored=db.debts.some(d=>debtBill(d));
  return {cash:Math.round(a.cash),debt:Math.round(a.debt),goals:Math.round(a.goals),
    safe:Math.round(a.safe),bills:Math.round(a.bills),mirrored};});
chk('a debt payment is reserved',sts.debt>0,true);
chk('a dated goal reserves its monthly share',sts.goals,50);
chk('an undated goal reserves nothing',sts.goals<100,true);
chk('safe = cash − bills − envelopes − debt − goals',
  sts.safe, sts.cash-sts.bills-sts.debt-sts.goals);
chk('promised money is no longer counted as spendable',sts.safe<sts.cash,true);
const sts2=await p.evaluate(()=>{db.goals=[];db.debts=[];saveAll();return Math.round(safeToSpend().safe);});
chk('with nothing promised it returns to cash',sts2,5000);

console.log('\n— freedom tiers: envelopes carry a tier, and Thrive needs margin —');
const fr=await p.evaluate(()=>{
  db.recurring=[{id:"f1",name:"Rent",category:"Rent/Mortgage",amount:1000,dueDay:1,freq:"monthly",tier:"essential"},
    {id:"f2",name:"Netflix",category:"Subscriptions",amount:20,dueDay:8,freq:"monthly",tier:"luxury"}];
  db.budgets={Food:400,Entertainment:100};      // Food defaults essential, Entertainment luxury
  db.budgetMeta={};                              // force the category defaults
  db.income=[{id:"fi",name:"Rent from roommate",model:"monthly",amount:100,payFreq:"monthly",passive:true,notax:true}];
  /* earlier sections leave linked debts (and the bills that mirror them) in the
     book — the tier maths must be read against this fixture alone */
  db.debts=[]; db.holdings=[]; saveAll();
  const n=freedomNeed();
  return {foodTier:budgetTier("Food"), entTier:budgetTier("Entertainment"),
    essBills:Math.round(n.essBills), essBudget:Math.round(n.essBudget),
    survive:Math.round(n.survive), maintain:Math.round(n.maintain),
    thrive:Math.round(n.thrive), margin:Math.round(n.margin)};});
chk('the fixture owns the bills',fr.essBills,1000);
chk('groceries default to essential',fr.foodTier,'essential');
chk('going out does not',fr.entTier,'luxury');
chk('survive = essential bills + essential envelopes',fr.survive,1400);
chk('  (essential envelopes counted, luxury ones not)',fr.essBudget,400);
chk('maintain = every bill + every envelope',fr.maintain,1520);
chk('thrive = maintain + 25% margin',fr.thrive,1900);
chk('margin is reported for the tracker',fr.margin,380);
const fr2=await p.evaluate(()=>{db.settings.thriveMargin=50;saveAll();
  return Math.round(freedomNeed().thrive);});
chk('the margin is settable',fr2,2280);
chk('re-tiering an envelope moves the floor',
  await p.evaluate(()=>{db.settings.thriveMargin=25;
    db.budgetMeta.Entertainment={since:monthKey(todayISO()),roll:true,tier:"essential"};saveAll();
    return Math.round(freedomNeed().survive);}),1500);

console.log('\n— a reinvested dividend compounds but does not arrive —');
const dr=await p.evaluate(()=>{
  const t=todayISO();
  db.holdings=[
    {id:"d1",name:"Realty Income",ticker:"O",shares:100,price:60,avgCost:55,divPerShare:0.25,divFreq:"monthly",lastDiv:t},
    {id:"d2",name:"Schwab Div",ticker:"SCHD",shares:100,price:28,avgCost:26,divPerShare:0.25,divFreq:"quarterly",lastDiv:t,drip:true}];
  db.income=[{id:"dp",name:"Rent from roommate",model:"monthly",amount:100,payFreq:"monthly",passive:true,notax:true}];
  db.goals=[{id:"dg",name:"Passive covers rent",kind:"income",target:2000,passiveOnly:true,link:[]}];
  saveAll();
  const m=passiveMonthly();
  return {all:estAnnualDiv(),cash:estAnnualDivCash(),drip:estAnnualDivDrip(),
    fromDiv:+m.fromDiv.toFixed(2),fromDrip:+m.fromDrip.toFixed(2),total:+m.total.toFixed(2),
    goal:+goalNow(db.goals[0]).toFixed(2),
    up:upcomingDividends(120).filter(x=>x.name==="SCHD").every(x=>x.drip===true),
    sharesYr:+dripSharesPerYear(db.holdings[1]).toFixed(4)};});
chk('the portfolio total still counts every payer',dr.all,400);
chk('  but the cash half is only what pays out',dr.cash,300);
chk('  and the rest is reported as reinvested',dr.drip,100);
chk('passive income counts the cash dividends',dr.fromDiv,25);
chk('  and leaves the reinvested ones out of the total',dr.total,125);
chk('  while still reporting them separately',dr.fromDrip,8.33);
chk('a passive-income goal measures money that arrives',dr.goal,125);
chk('the schedule marks a reinvested payment',dr.up,true);
chk('a year of reinvestment is priced in shares',dr.sharesYr,3.5714);
/* the point of the flag: logging a payment has to move the share count, or the
   position drifts away from the brokerage one dividend at a time */
const dl=await p.evaluate(()=>{
  const set=(id,v)=>{const el=document.getElementById(id);el.value=v;};
  setView('invest');
  set('divName','SCHD'); set('divAmt','28'); document.getElementById('addDivBtn').click();
  const after={shares:db.holdings[1].shares,avgCost:+db.holdings[1].avgCost.toFixed(4),
    note:!document.getElementById('divLogNote').hidden};
  set('divName','O'); set('divAmt','25'); document.getElementById('addDivBtn').click();
  return {...after,plainShares:db.holdings[0].shares,
    plainNote:!document.getElementById('divLogNote').hidden,logged:db.dividends.length};});
chk('logging $28 on a $28 reinvesting holding buys a share',dl.shares,101);
chk('  and the money paid joins the cost basis',dl.avgCost,26.0198);
chk('  and it says so',dl.note,true);
chk('a holding that pays out in cash keeps its share count',dl.plainShares,100);
chk('  with nothing to explain',dl.plainNote,false);
chk('both payments are still logged as dividends',dl.logged,2);

console.log('\n— the debt bar is what you still owe, against what it can reach —');
const db1=await p.evaluate(()=>{
  db.accounts=[]; db.recurring=[];
  db.debts=[
    {id:"x1",name:"Visa",kind:"card",balance:250,limit:1000,start:400},
    {id:"x2",name:"Amex",kind:"card",balance:600,limit:1000},
    {id:"x3",name:"Store card",kind:"store",balance:50,limit:1000},
    {id:"x4",name:"No-limit card",kind:"card",balance:300,start:800},
    {id:"x5",name:"Car loan",kind:"auto",balance:3478,start:10500},
    {id:"x6",name:"Collection",kind:"collection",balance:1900},
    {id:"x7",name:"Cleared card",kind:"card",balance:0,limit:1000,start:900}];
  saveAll(); setView('credit');
  const f=id=>db.debts.find(d=>d.id===id);
  return {ceil:db.debts.map(d=>debtCeiling(d)),
    owed:db.debts.map(d=>+debtOwedPct(d).toFixed(1)),
    col:db.debts.map(d=>debtBarColor(d).replace(/var\(--|\)/g,''))};});
chk('a card measures against its limit',db1.ceil[0],1000);
chk('  a card without one falls back to the most owed',db1.ceil[3],800);
chk('  a loan measures against what it was written for',db1.ceil[4],10500);
chk('  a debt with neither measures against itself',db1.ceil[5],1900);
chk('the bar is the balance, not the progress',db1.owed,[25,60,5,37.5,33.1,100,0]);
chk('  so an untouched collection reads full, not empty',db1.owed[5],100);
chk('  and a car loan 67% paid shows the third that is left',db1.owed[4],33.1);
chk('under 10% utilization is healthy',db1.col[2],'pos');
chk('  over 10% is worth watching',db1.col[0],'debt');
chk('  over 30% is the one a score reacts to',db1.col[1],'neg');
chk('a loan is not coloured by how early it is',db1.col[4],'debt');
chk('a cleared debt is green',db1.col[6],'pos');
const db2=await p.evaluate(()=>{
  const rows=[...document.querySelectorAll('#debtList .dcard')];
  const at=i=>({meta:rows[i].querySelector('.dmeta').textContent,
    of:(rows[i].querySelector('.dof')||{textContent:''}).textContent.trim(),
    w:rows[i].querySelector('.bar>span').style.width});
  return {visa:at(0),loan:at(4),cleared:at(6)};});
chk('a card row reports utilization',db2.visa.meta.includes('25% of limit used'),true);
chk('  and names the limit under the balance',db2.visa.of,'of $1,000 limit');
chk('  and draws it',db2.visa.w,'25%');
chk('a loan row still reports progress',db2.loan.meta.includes('67% paid off'),true);
chk('  while drawing what is left',db2.loan.w,'33%');
chk('a cleared debt keeps its full green bar',db2.cleared.w,'100%');
/* the point of the change: using the card has to move the bar */
await p.evaluate(()=>{db.debts.find(x=>x.id==="x1").balance=700;saveAll();});
await p.waitForTimeout(300);                       // saveAll re-renders on the next tick
const db3=await p.evaluate(()=>({
  w:document.querySelectorAll('#debtList .dcard')[0].querySelector('.bar>span').style.width,
  col:debtBarColor(db.debts.find(x=>x.id==="x1")).replace(/var\(--|\)/g,'')}));
chk('spending on the card fills the bar',db3.w,'70%');
chk('  and turns it red',db3.col,'neg');

console.log('\n— adding a debt is a sheet, not a form parked under the list —');
await p.evaluate(()=>{db.debts=[];saveAll();setView('credit');});
await p.waitForTimeout(400);
chk('nothing owed says so',await p.$eval('#debtList',e=>/Nothing owed here yet/.test(e.textContent)),true);
chk('  and the form is not sitting open',await p.evaluate(()=>!document.querySelector('#view-credit #nd-name')),true);
await p.click('#addDebtBtn'); await p.waitForTimeout(400);
chk('+ Add debt pulls the sheet out',await p.evaluate(()=>!document.getElementById('editSheet').hidden),true);
chk('  titled for what it does',await p.$eval('#editTitle',e=>e.textContent),'Add a debt');
chk('  and leaving it says Cancel, not Done',await p.$eval('#editSheet .sheetx span',e=>e.textContent),'Cancel');
chk('  offering every debt kind, not four',await p.$$eval('#nd-kind option',e=>e.length),11);
chk('a card is asked for its limit',await p.$$eval('#editSheetBody .field label',
  e=>e.map(l=>l.textContent.trim().replace(/\s+/g,' ')).pop()),'Credit limit optional');
await p.fill('#nd-name','Navy Federal'); await p.fill('#nd-bal','3478');
await p.selectOption('#nd-kind','auto'); await p.waitForTimeout(350);
chk('switching the type asks for the original instead',await p.$$eval('#editSheetBody .field label',
  e=>e.map(l=>l.textContent.trim().replace(/\s+/g,' ')).pop()),'Original amount optional');
chk('  without losing what was typed above it',
  await p.evaluate(()=>document.getElementById('nd-name').value+'|'+document.getElementById('nd-bal').value),'Navy Federal|3478');
await p.fill('#nd-orig','10500'); await p.click('#nd-add'); await p.waitForTimeout(500);
chk('saving closes the sheet',await p.evaluate(()=>document.getElementById('editSheet').hidden),true);
chk('  with the debt on the list',await p.evaluate(()=>db.debts.map(d=>[d.name,d.kind,d.balance,d.start,d.limit])),
  [['Navy Federal','auto',3478,10500,0]]);
chk('  drawn as what is left',await p.$eval('#debtList .bar>span',e=>e.style.width),'33%');
await p.click('#addDebtBtn'); await p.waitForTimeout(350);
await p.fill('#nd-name','Milestone'); await p.fill('#nd-bal','10'); await p.fill('#nd-limit','700');
await p.click('#nd-add'); await p.waitForTimeout(500);
chk('a card keeps its limit',await p.evaluate(()=>{const d=db.debts[1];return [d.kind,d.limit];}),['card',700]);
chk('  which switches utilization on',await p.evaluate(()=>+utilization().pct.toFixed(1)),1.4);
await p.click('#addDebtBtn'); await p.waitForTimeout(350);
await p.fill('#nd-name','Scratch'); await p.keyboard.press('Escape'); await p.waitForTimeout(400);
chk('backing out keeps nothing',await p.evaluate(()=>db.debts.length),2);
await p.click('#addDebtBtn'); await p.waitForTimeout(350);
await p.fill('#nd-bal','99'); await p.click('#nd-add'); await p.waitForTimeout(400);
chk('a debt with no name is refused',await p.evaluate(()=>({n:db.debts.length,open:!document.getElementById('editSheet').hidden})),{n:2,open:true});
await p.evaluate(()=>closeEditor()); await p.waitForTimeout(300);

console.log('\n— the badge says where a debt stands, and red means one thing —');
await p.evaluate(()=>{db.recurring=[];
  db.debts=[
    {id:"b1",name:"Credit Card",kind:"card",balance:246,limit:750},
    {id:"b2",name:"Mission Lane",kind:"collection",balance:1400},
    {id:"b3",name:"Car loan",kind:"auto",balance:3478,start:10500},
    {id:"b4",name:"Milestone",kind:"card",balance:10,limit:500},
    {id:"b5",name:"Old medical",kind:"medical",balance:0,start:400}];
  saveAll(); setView('credit');});
await p.waitForTimeout(500);
const bg=await p.$$eval('#debtList .dcard',rs=>rs.map(r=>{const t=r.querySelector('.tag');
  return {txt:(t.querySelector('.tshort')||t).textContent.trim(),
    cls:[...t.classList].filter(c=>c!=='tag')[0],
    meta:r.querySelector('.dmeta').textContent.trim()};}));
chk('an open card is neutral, not a warning',[bg[0].txt,bg[0].cls],['OPEN','neutral']);
chk('  and so is a loan being paid down',[bg[2].txt,bg[2].cls],['OPEN','neutral']);
chk('a collection is red',[bg[1].txt,bg[1].cls],['COLLECTION','bad']);
chk('  and is not called open — it is a closed account',bg[1].meta,'Closed account');
chk('the smallest balance is still the one to attack',[bg[3].txt,bg[3].cls],['NEXT','warn']);
chk('a cleared debt is green',[bg[4].txt,bg[4].cls],['PAID','ok']);
chk('nothing else is red',bg.filter(x=>x.cls==='bad').length,1);
/* standing outranks strategy: being in collections matters more than being
   next in line, so the target marker moves into the meta */
await p.evaluate(()=>{db.debts.find(d=>d.id==="b4").balance=5000;
  db.debts.find(d=>d.id==="b2").balance=80;saveAll();});
await p.waitForTimeout(500);
const bg2=await p.$$eval('#debtList .dcard',rs=>{const t=rs[1].querySelector('.tag');
  return [(t.querySelector('.tshort')||t).textContent.trim(),rs[1].querySelector('.dmeta').textContent.trim()];});
chk('a collection that is also the target keeps its badge',bg2[0],'COLLECTION');
chk('  and picks the target up in the meta',bg2[1],'Attack next · Closed account');

console.log(`\n${pass} passed, ${fail} failed`);
console.log('page errors:',errs.length?errs:'none');
await b.close();
if(fail||errs.length) process.exitCode=1;
