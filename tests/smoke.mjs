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

console.log(`\n${pass} passed, ${fail} failed`);
console.log('page errors:',errs.length?errs:'none');
await b.close();
if(fail||errs.length) process.exitCode=1;
