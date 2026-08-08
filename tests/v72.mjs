import pkg from 'playwright';
const {chromium}=pkg;
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1440,height:1200}});
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8899/index.html'); await p.waitForTimeout(900);
await p.evaluate(()=>{
  db.accounts=[{id:"a1",name:"Checking",kind:"checking",value:5000,parentId:null}];
  db.income=[{id:"s1",name:"Gig work",model:"daily",rate:650,units:3,payFreq:"weekly",firstPay:"2026-01-09"}];
  db.debts=[{id:"d1",name:"Visa",kind:"card",balance:1450,start:5000,limit:5000,apr:24,payment:120,payments:[]}];
  db.holdings=[{id:"h1",name:"SCHD",ticker:"SCHD",shares:20,price:33,avgCost:30,divPerShare:0.27,divFreq:"quarterly",divBasis:"payment"}];
  db.goals=[{id:"g1",name:"Emergency fund",kind:"cash",target:10000,created:"2026-01-01",link:[],contribs:[],done:false}];
  saveAll(); setView('dash');});
await p.waitForTimeout(800);

console.log('— KPI no longer stale —');
console.log(await p.$$eval('#kpiRow .kpi',e=>e.map(k=>k.querySelector('.label').textContent+' = '+
  k.querySelector('.val').textContent+' ('+k.querySelector('.sub').textContent+')')));

console.log('\n— DELETE NEEDS TWO TAPS —');
await p.evaluate(()=>setView('credit')); await p.waitForTimeout(600);
await p.evaluate(()=>{const t=document.querySelector('[data-dopen]'); if(t)t.click();}); await p.waitForTimeout(600);
const delBtn=await p.$('[data-ddel]');
if(delBtn){
  console.log('before:', await p.evaluate(()=>db.debts.length));
  await delBtn.click(); await p.waitForTimeout(300);
  console.log('after 1 tap:', await p.evaluate(()=>db.debts.length), '· label:', await delBtn.evaluate(e=>e.textContent.trim()));
  await delBtn.click(); await p.waitForTimeout(400);
  console.log('after 2 taps:', await p.evaluate(()=>db.debts.length));
} else console.log('  (no debt delete button exposed at this state)');

console.log('\n— ROW IDIOMS MATCH —');
await p.evaluate(()=>{db.debts=[{id:"d1",name:"Visa",kind:"card",balance:1450,start:5000,limit:5000,apr:24,payment:120,payments:[]}];saveAll();});
await p.waitForTimeout(500);
const metrics=async(view,sel)=>{ await p.evaluate(v=>setView(v),view); await p.waitForTimeout(700);
  return p.evaluate(s=>{const n=document.querySelector(s); if(!n)return null; const c=getComputedStyle(n);
    return {pad:c.padding,font:c.fontSize};},sel);};
console.log('  bills  .bmain  ', await metrics('budget','#billsList .bmain'));
console.log('  income .dtop   ', await metrics('income','#incomeList .dtop'));
console.log('  debts  .dtop   ', await metrics('credit','#debtList .dtop'));
console.log('  accts  .arow   ', await metrics('accounts','#acctList .arow'));
await p.evaluate(()=>setView('accounts')); await p.waitForTimeout(600);
console.log('  names:', await p.evaluate(()=>{
  const g=s=>{const n=document.querySelector(s);return n?getComputedStyle(n).fontSize+'/'+getComputedStyle(n).fontWeight:null;};
  return {bname:g('.bname'),dname:g('.dname'),aname:g('.aname')};}));

console.log('\n— PREFERENCES PERSIST —');
await p.evaluate(()=>setView('expenses')); await p.waitForTimeout(500);
await p.click('#filtToggle'); await p.waitForTimeout(400);
await p.evaluate(()=>setView('goals')); await p.waitForTimeout(400);
await p.selectOption('#goalSort','size'); await p.waitForTimeout(400);
await p.evaluate(()=>setView('budget')); await p.waitForTimeout(400);
const bv=await p.$('[data-bview="all"]'); if(bv){await bv.click(); await p.waitForTimeout(400);}
console.log('saved:', await p.evaluate(()=>db.settings.ui));
await p.reload(); await p.waitForTimeout(1100);
console.log('after reload:', await p.evaluate(()=>({filtOpen,goalSort,billView,horizon,divOpen})));
console.log('filter panel open in DOM:', await p.evaluate(()=>{setView('expenses');
  return !document.getElementById('filtBody').hidden;}));

console.log('\n— NAMING —');
console.log(await p.evaluate(()=>{setView('expenses');
  return {nav:VIEWS.find(v=>v.id==='expenses').label, page:document.querySelector('#view-expenses h1.page').textContent};}));
console.log('\nerrors:', errs.length?errs:'none');
await b.close();
