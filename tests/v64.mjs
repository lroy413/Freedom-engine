import pkg from 'playwright';
const { chromium } = pkg;
const b = await chromium.launch();
const errs=[];
const p=await b.newPage({viewport:{width:1440,height:1500}});
p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(()=>{try{localStorage.clear();}catch(e){}});
await p.goto('http://localhost:8899/index.html'); await p.waitForTimeout(800);
console.log('DEBT KINDS:', await p.evaluate(()=>Object.entries(DEBT_KINDS).map(([k,v])=>v.label+(v.revolving?'*':'')+' → '+v.cat).join('\n  ')));
console.log('  (* = revolving: counts toward utilization and gets a minimum payment)');
// a synced credit card should land in Bills on its own
await p.evaluate(()=>{
  db.accounts=[{id:"c1",name:"Concora Credit Card",kind:"credit",value:612,limit:750,parentId:null}];
  const d={id:"d1",name:"Concora Credit Card",balance:612,start:612,kind:"card",limit:750,payments:[]};
  db.debts=[d]; db.accounts[0].debtId="d1";
  db.recurring=[{id:"r1",name:"Rent",category:"Rent/Mortgage",amount:1450,dueDay:1,freq:"monthly"}];
  saveAll();});
await p.waitForTimeout(800);
console.log('\nAUTO — active card populated Bills by itself:');
console.log(await p.evaluate(()=>db.recurring.map(b=>'  '+b.name.padEnd(24)+fmt(b.amount).padEnd(8)+'cat='+b.category.padEnd(14)+'group='+b.group+' tier='+b.tier+(b.estimated?' [estimated]':'')+(b.debtId?' →debt':''))));
console.log('  min payment on $612 =', await p.evaluate(()=>fmt(minPayment(db.debts[0]))), '(2% floor $25)');
console.log('  bills due now:', await p.evaluate(()=>fmt(db.recurring.reduce((s,b)=>s+billAmountIn(b,budgetMonth||monthKey(todayISO())),0))));
// balance grows -> estimate follows
await p.evaluate(()=>{db.accounts[0].value=2000;saveAll();});
await p.waitForTimeout(700);
console.log('\n  balance → $2,000, estimate follows:', await p.evaluate(()=>fmt(db.recurring.find(b=>b.debtId).amount)));
// typing a real payment locks it
await p.evaluate(()=>setView('budget')); await p.waitForTimeout(600);
const bid=await p.evaluate(()=>db.recurring.find(b=>b.debtId).id);
await p.click(`[data-billopen="${bid}"]`); await p.waitForTimeout(500);
console.log('  bill note:', await p.$eval('.bpanel .note',e=>e.textContent.trim().replace(/\s+/g,' ')));
await p.fill(`[data-billamt="${bid}"]`,'150');
await p.evaluate(i=>document.querySelector(`[data-billamt="${i}"]`).dispatchEvent(new Event('change',{bubbles:true})),bid);
await p.waitForTimeout(700);
console.log('  typed $150 →', await p.evaluate(()=>({amount:db.recurring.find(b=>b.debtId).amount,estimated:!!db.recurring.find(b=>b.debtId).estimated,debtPayment:db.debts[0].payment})));
await p.evaluate(()=>{db.accounts[0].value=2500;saveAll();});
await p.waitForTimeout(700);
console.log('  balance → $2,500, amount stays locked:', await p.evaluate(()=>fmt(db.recurring.find(b=>b.debtId).amount)));
// deleting the bill must not resurrect it
await p.evaluate(()=>{editBill=db.recurring.find(b=>b.debtId).id;renderBudget();}); await p.waitForTimeout(400);
await p.click('[data-billdel]'); await p.waitForTimeout(800);
console.log('\n  deleted the bill:', await p.evaluate(()=>({bills:db.recurring.map(b=>b.name),noBill:db.debts[0].noBill,billId:db.debts[0].billId})));
await p.evaluate(()=>saveAll()); await p.waitForTimeout(700);
console.log('  still gone after another save:', await p.evaluate(()=>db.recurring.map(b=>b.name)));
// manual "Add to budget" from the debt side
await p.evaluate(()=>{setView('credit');editDebt="d1";renderCredit();}); await p.waitForTimeout(600);
console.log('\n  debt editor shows:', await p.$$eval('.dcard.editing .note',e=>e.map(x=>x.textContent.trim().replace(/\s+/g,' ').slice(0,90))));
console.log('  buttons:', await p.$$eval('.dcard.editing .toolbar button',e=>e.map(x=>x.textContent.trim())));
await p.click('[data-dbilladd="d1"]'); await p.waitForTimeout(800);
console.log('  after + Add to budget:', await p.evaluate(()=>db.recurring.map(b=>b.name+' '+fmt(b.amount)+(b.estimated?' [est]':''))));
console.log('  debt meta:', await p.$eval('#debtList .dmeta',e=>e.textContent.trim()));
/* a loan with a set payment now bills itself too — a car note is a fixed
   monthly obligation as much as rent, and leaving it out flattered the plan */
await p.evaluate(()=>{db.debts.push({id:"d2",name:"Navy Federal Auto",balance:3477,start:24000,kind:"auto",payment:173,payments:[]});saveAll();});
await p.waitForTimeout(800);
console.log('\n  auto loan bills itself:', await p.evaluate(()=>db.recurring.map(b=>b.name+' '+fmt(b.amount)+' cat='+b.category)));
await p.evaluate(()=>{setView('credit');editDebt="d2";renderCredit();}); await p.waitForTimeout(500);
console.log('  so there is nothing left to add by hand:', await p.evaluate(()=>!document.querySelector('[data-dbilladd="d2"]')));
console.log('  (auto loan payments file under Car Payment, not Debt Payment)');
// opting out keeps it out
await p.evaluate(()=>{const bl=db.recurring.find(x=>x.debtId==="d2"); editBill=bl.id; setView('budget'); renderBudget();});
await p.waitForTimeout(400);
await p.click('[data-billdel]'); await p.waitForTimeout(700);
await p.evaluate(()=>saveAll()); await p.waitForTimeout(700);
console.log('  deleting it opts the loan out for good:', await p.evaluate(()=>({bills:db.recurring.map(b=>b.name),noBill:db.debts.find(d=>d.id==="d2").noBill})));
// utilization covers store cards + LOC
await p.evaluate(()=>{db.debts.push({id:"d3",name:"Store card",balance:200,start:200,kind:"store",limit:500,payments:[]});saveAll();});
await p.waitForTimeout(700);
console.log('\n  utilization now spans revolving kinds:', await p.evaluate(()=>{const u=utilization();return fmt(u.bal)+' of '+fmt(u.lim)+' = '+u.pct.toFixed(0)+'%';}));
// old "loan" kind migrates — check on a fresh page with no init-script clearing
const p2=await b.newPage({viewport:{width:1200,height:900}});
await p2.goto('http://localhost:8899/index.html'); await p2.waitForTimeout(500);
await p2.evaluate(()=>{localStorage.setItem('moneymachine_v1',JSON.stringify({version:2,
  categories:["Income","Uncategorized"],rules:[],budgets:{},recurring:[],transactions:[],income:[],
  debts:[{id:"x1",name:"Old loan",balance:500,start:500,kind:"loan"},
         {id:"x2",name:"Weird",balance:100,start:100,kind:"bogus"}],
  accounts:[],holdings:[],dividends:[],creditLog:[],paychecks:[],goal:{target:1,deadline:"2026-12-31"},settings:{}}));});
await p2.reload(); await p2.waitForTimeout(900);
console.log('\n  legacy kinds migrated:', await p2.evaluate(()=>db.debts.map(d=>d.name+' -> '+d.kind+' ('+debtKindOf(d).label+')')));
await p2.close();
console.log('ERRORS:',errs.length?errs:'none');
await b.close();
