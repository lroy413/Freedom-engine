import pkg from 'playwright';
const {chromium}=pkg;
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1440,height:1300}});
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8899/index.html'); await p.waitForTimeout(900);
const Y=await p.evaluate(()=>todayISO().slice(0,4));
const M=await p.evaluate(()=>monthOf(todayISO()));
await p.evaluate(([y,m])=>{
  db.accounts=[{id:"a1",name:"Checking",kind:"checking",value:9000,parentId:null}];
  db.businesses=[];
  db.transactions=[
   {id:"t1",date:m+"-03",desc:"Client wedding film",category:"Income",amount:4200},
   {id:"t2",date:m+"-05",desc:"Sigma 24-70 lens",category:"Shopping",amount:-1100},
   {id:"t3",date:m+"-06",desc:"Adobe CC",category:"Subscriptions",amount:-60},
   {id:"t4",date:m+"-07",desc:"Kroger",category:"Food",amount:-310},
   {id:"t5",date:m+"-08",desc:"Gas to set",category:"Auto & Gas",amount:-95},
   {id:"t6",date:m+"-09",desc:"Rent",category:"Rent/Mortgage",amount:-1525}];
  db.budgets={"Food":500,"Shopping":300};
  saveAll(); setView('business');},[Y,M]);
await p.waitForTimeout(700);

console.log('— BEFORE tagging: personal spending —');
console.log(await p.evaluate(m=>({month:monthTotals(m),food:spentFor("Food",m),shopping:spentFor("Shopping",m)}),M));

console.log('\n— ADD A BUSINESS —');
await p.click('#showAddBiz'); await p.waitForTimeout(300);
await p.fill('#nbName','L Roy Media'); await p.selectOption('#nbKind','sole');
await p.click('#nbAdd'); await p.waitForTimeout(600);
console.log('created:', await p.evaluate(()=>db.businesses.map(b=>({n:b.name,k:b.kind,draw:b.drawPct,link:b.linkProfit}))));

console.log('\n— TAG TRANSACTIONS —');
await p.evaluate(()=>{const id=db.businesses[0].id;
  db.transactions.find(t=>t.id==='t1').bizId=id;                          // revenue
  db.transactions.find(t=>t.id==='t2').bizId=id;                          // lens, 100%
  Object.assign(db.transactions.find(t=>t.id==='t3'),{bizId:id,bizPct:70}); // Adobe 70/30
  Object.assign(db.transactions.find(t=>t.id==='t5'),{bizId:id,bizPct:80}); // gas 80/20
  saveAll();});
await p.waitForTimeout(700);
console.log('P&L:', await p.evaluate(y=>{const pl=bizPL(db.businesses[0].id,y);
  return {rev:pl.rev,exp:+pl.exp.toFixed(2),profit:+pl.profit.toFixed(2),byCat:pl.byCat,sched:pl.bySched};},Y));
console.log('  (rev 4200; exp 1100 + 60*0.7=42 + 95*0.8=76 = 1218; profit 2982)');
console.log('\npersonal spending AFTER tagging:', await p.evaluate(m=>({
  month:monthTotals(m), food:spentFor("Food",m), shopping:spentFor("Shopping",m),
  autoGas:spentFor("Auto & Gas",m), subs:spentFor("Subscriptions",m)}),M));
console.log('  (Shopping should be 0 — lens is fully business. Auto & Gas 19 = the personal 20%. Subs 18 = 30%.)');

console.log('\n— DRAW PERCENTAGE —');
for(const pct of [100,60,0]){
  await p.evaluate(v=>{db.businesses[0].drawPct=v;saveAll();},pct); await p.waitForTimeout(400);
  console.log(`  draw ${String(pct).padStart(3)}% -> counts as income: ${await p.evaluate(y=>Math.round(bizDraw(db.businesses[0].id,y)),Y)}`);
}
await p.evaluate(()=>{db.businesses[0].linkProfit=false;saveAll();}); await p.waitForTimeout(400);
console.log('  unlinked      -> counts as income:', await p.evaluate(y=>bizDraw(db.businesses[0].id,y),Y));
await p.evaluate(()=>{db.businesses[0].linkProfit=true;db.businesses[0].drawPct=60;saveAll();}); await p.waitForTimeout(400);

console.log('\n— SECOND BUSINESS —');
await p.click('#showAddBiz'); await p.waitForTimeout(300);
await p.fill('#nbName','Stock Footage LLC'); await p.selectOption('#nbKind','llc');
await p.click('#nbAdd'); await p.waitForTimeout(600);
await p.evaluate(m=>{const id=db.businesses[1].id;
  db.transactions.push({id:"t7",date:m+"-10",desc:"Pond5 payout",category:"Income",amount:820,bizId:id});
  db.transactions.push({id:"t8",date:m+"-11",desc:"Drone repair",category:"Misc",amount:-240,bizId:id});
  db.businesses[1].drawPct=0; saveAll();},M);
await p.waitForTimeout(600);
console.log('businesses:', await p.evaluate(y=>db.businesses.map(b=>{const pl=bizPL(b.id,y);
  return {n:b.name,rev:pl.rev,exp:+pl.exp.toFixed(2),profit:+pl.profit.toFixed(2),draw:Math.round(bizDraw(b.id,y))};}),Y));
console.log('total profit:', await p.evaluate(y=>Math.round(allBizProfit(y)),Y),
            '· total draw:', await p.evaluate(y=>Math.round(allBizDraw(y)),Y));

console.log('\n— TAX PICKS UP BUSINESS PROFIT —');
console.log(await p.evaluate(()=>{const e=taxEstimate();
  return {fromPay:e.inc.fromPay,fromBiz:+e.inc.fromBiz.toFixed(2),net:+e.net.toFixed(2),owed:+e.owed.toFixed(2)};}));

console.log('\n— SCHEDULE C —');
await p.evaluate(()=>{bizDetail=db.businesses[0].id;renderBusiness();}); await p.waitForTimeout(600);
console.log(await p.$$eval('#bizSched .defrow',e=>e.map(r=>r.querySelector('.k').textContent+' = '+r.querySelector('.v').textContent)));

console.log('\n— HERO CAROUSEL —');
await p.evaluate(()=>setView('dash')); await p.waitForTimeout(700);
console.log(await p.evaluate(()=>({slides:document.querySelectorAll('.heroslide').length,
  dots:document.querySelectorAll('.hdot').length,
  labels:[...document.querySelectorAll('.heroslide .dh-label')].map(x=>x.textContent),
  vals:[...document.querySelectorAll('.heroslide .dh-val')].map(x=>x.textContent),
  snap:getComputedStyle(document.getElementById('heroTrack')).scrollSnapType})));
await p.evaluate(()=>{const t=document.getElementById('heroTrack');t.scrollLeft=t.clientWidth;t.dispatchEvent(new Event('scroll'));});
await p.waitForTimeout(500);
console.log('after scrolling to slide 2, active dot:', await p.evaluate(()=>[...document.querySelectorAll('.hdot')].findIndex(d=>d.classList.contains('on'))));
console.log('\nerrors:', errs.length?errs:'none');
await b.close();
