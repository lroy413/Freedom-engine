import pkg from 'playwright';
const {chromium}=pkg;
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1440,height:1200}});
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8899/index.html'); await p.waitForTimeout(900);
const Y=await p.evaluate(()=>todayISO().slice(0,4));
await p.evaluate(y=>{
  db.accounts=[{id:"a1",name:"Checking",kind:"checking",value:9000,parentId:null}];
  db.income=[{id:"s1",name:"Studio W2",model:"monthly",amount:2600,payFreq:"monthly",firstPay:y+"-01-15",taxClass:"w2"},
   {id:"s2",name:"Freelance gigs",model:"daily",rate:650,units:3,payFreq:"weekly",firstPay:y+"-01-10",taxClass:"se"},
   {id:"s3",name:"Roommate rent",model:"monthly",amount:900,payFreq:"monthly",taxClass:"exempt",notax:true,passive:true}];
  db.paychecks=[
   {id:"p1",date:y+"-02-14",source:"Studio W2",gross:2600,net:2010},
   {id:"p2",date:y+"-03-14",source:"Studio W2",gross:2600,net:2010},
   {id:"p3",date:y+"-04-10",source:"Freelance gigs",gross:5200,net:5200},
   {id:"p4",date:y+"-06-12",source:"Freelance gigs",gross:3900,net:3900}];
  saveAll(); setView('tax');},Y);
await p.waitForTimeout(800);
console.log('— TAX ESTIMATE —');
console.log(await p.evaluate(()=>{const e=taxEstimate();
  return {year:e.year,fromPay:e.inc.fromPay,fromBiz:e.inc.fromBiz,net:e.net,
    se:+e.se.toFixed(2),halfSE:+e.halfSE.toFixed(2),fed:+e.fed.toFixed(2),state:+e.state.toFixed(2),
    gross:+e.gross.toFixed(2),w2credit:+e.credit.toFixed(2),owed:+e.owed.toFixed(2),rate:+e.rate.toFixed(2)};}));
console.log('  hand-check: SE income 5200+3900=9100; SE base 9100*.9235=8403.85; SE 15.3% = 1285.79');
console.log('              halfSE 642.90; fed 22% of (9100-642.90)=8457.10 -> 1860.56');
console.log('              GA 5.39% of 8457.10 -> 455.84; gross 3602.19');
console.log('              W2 withheld (2600-2010)*2 = 1180; owed 2422.19; rate 26.6%');
console.log('\nauto-reserve on those 1099 paychecks:', await p.evaluate(()=>({
  entries:db.tax.reserve.length, total:+taxReserved().toFixed(2),
  detail:db.tax.reserve.map(r=>r.source+' '+r.amount.toFixed(2))})));
console.log('held:', await p.evaluate(()=>+taxHeld().toFixed(2)),
            '· spendable:', await p.evaluate(()=>+spendableCash().toFixed(2)), 'of', await p.evaluate(()=>totalCash()));
console.log('\nquarters:', await p.evaluate(()=>quarterPlan().map(q=>`Q${q.q} ${q.due} ${Math.round(q.target)}${q.past?' PAST':''}`)));
console.log('next due:', await p.evaluate(()=>nextQuarter()));
console.log('\nhero:', await p.evaluate(()=>document.querySelector('#taxHero .frbig').textContent+' / '+
  document.querySelector('#taxHero .frsub').textContent.trim()));
console.log('stream classes:', await p.evaluate(()=>db.income.map(s=>s.name+'='+streamTaxClass(s))));
console.log('\n— catch up —');
console.log('unreserved before:', await p.evaluate(()=>unreservedPay().length));
await p.evaluate(()=>document.getElementById('taxCatchUp').click()); await p.waitForTimeout(600);
console.log('after catch up:', await p.evaluate(()=>({entries:db.tax.reserve.length,
  total:+taxReserved().toFixed(2), held:+taxHeld().toFixed(2),
  spendable:+spendableCash().toFixed(2), of:totalCash(),
  detail:db.tax.reserve.map(r=>r.source+' '+r.amount.toFixed(2))})));
console.log('  (9100 x 26.6% = 2420ish across the two 1099 checks)');
console.log('  runway now uses spendable:', await p.evaluate(()=>runwayText()));

console.log('\n— pay a quarter —');
await p.evaluate(()=>document.querySelector('[data-qpay="1"]').click()); await p.waitForTimeout(500);
console.log(await p.evaluate(()=>({paid:db.tax.paid.map(x=>'Q'+x.q+' '+x.amount.toFixed(2)),
  held:+taxHeld().toFixed(2), spendable:+spendableCash().toFixed(2)})));
console.log('\n— flat mode —');
await p.evaluate(()=>{db.tax.mode='flat';db.tax.flatRate=30;saveAll();}); await p.waitForTimeout(500);
console.log('rate for a 1099 stream:', await p.evaluate(()=>reserveRateFor(db.income[1])));
await p.evaluate(()=>{db.tax.mode='guided';saveAll();}); await p.waitForTimeout(400);
console.log('\nerrors:', errs.length?errs:'none');
await b.close();
