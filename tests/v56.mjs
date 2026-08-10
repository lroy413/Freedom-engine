import pkg from 'playwright';
const { chromium } = pkg;
const b = await chromium.launch();
const errs=[];
const p=await b.newPage({viewport:{width:1440,height:1300}});
p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(()=>{try{localStorage.clear();}catch(e){}});
await p.goto('http://localhost:8899/index.html'); await p.waitForTimeout(800);
console.log('Transfer in categories:', await p.evaluate(()=>db.categories.includes("Transfer")));
console.log('auto-categorize:', await p.evaluate(()=>[
  "ONLINE TRANSFER TO SAVINGS","XFER FROM CHECKING 1234","Internal Transfer","KROGER #123",
  "PAYROLL DEPOSIT","AUTOPAY PAYMENT","Zelle to Mom"
].map(d=>'  '+d.padEnd(30)+'-> '+categorize(d,d.includes("DEPOSIT")||d.includes("FROM")?500:-500)).join('\n')));

await p.evaluate(()=>{
  db.accounts=[{id:"a1",name:"Chase Checking",kind:"checking",value:4000,parentId:null},
               {id:"a2",name:"Chase Savings",kind:"savings",value:2000,parentId:null}];
  const m="2026-07-";
  db.transactions=[
    {id:"t1",date:m+"05",desc:"Groceries",amount:-260,category:"Food",acctId:"a1"},
    {id:"t2",date:m+"08",desc:"Gas",amount:-90,category:"Auto & Gas",acctId:"a1"},
    {id:"t3",date:m+"15",desc:"Paycheck",amount:2900,category:"Income",acctId:"a1"},
    {id:"t4",date:m+"16",desc:"ONLINE TRANSFER TO SAVINGS",amount:-1000,category:"Transfer",acctId:"a1"},
    {id:"t5",date:m+"16",desc:"ONLINE TRANSFER FROM CHECKING",amount:1000,category:"Transfer",acctId:"a2"}];
  db.budgets={Food:400,"Auto & Gas":150};
  saveAll();});
await p.waitForTimeout(700);
console.log('\nWITH a $1,000 transfer in and out:');
console.log(await p.evaluate(()=>{const mt=monthTotals("2026-07");
  return `  monthTotals: income ${mt.inc} · spending ${mt.exp} · surplus ${mt.surplus}`;}));
await p.evaluate(()=>setView('dash')); await p.waitForTimeout(600);
console.log('  dash KPIs:', await p.$$eval('#kpiRow .kpi',e=>e.slice(0,2).map(x=>x.querySelector('.label').textContent+'='+x.querySelector('.val').textContent)));
console.log('  spending by category:', await p.$$eval('#spendByCat .catpill',e=>e.map(x=>x.textContent)));
await p.evaluate(()=>setView('budget')); await p.waitForTimeout(600);
console.log('  budget income card:', await p.$eval('#budgetKpis .kpi .val',e=>e.textContent));
// flip one to Income and watch the numbers move
await p.evaluate(()=>{db.transactions.find(t=>t.id==="t5").category="Income";saveAll();}); await p.waitForTimeout(600);
console.log('\nif that transfer were miscategorised as Income:');
console.log(await p.evaluate(()=>{const mt=monthTotals("2026-07");return `  income would read ${mt.inc} instead of 2900`;}));
await p.evaluate(()=>{db.transactions.find(t=>t.id==="t5").category="Transfer";saveAll();}); await p.waitForTimeout(500);

// ---- editable date ----
await p.evaluate(()=>setView('expenses')); await p.waitForTimeout(600);
/* the row is a line you read now — the editors live in the sheet it opens */
console.log('\nrows are read-only lines:', await p.evaluate(()=>({
  rows:document.querySelectorAll('#txTable .trow').length,
  inlineInputs:document.querySelectorAll('#txTable input,#txTable select').length})));
await p.click('[data-txopen="t1"]'); await p.waitForTimeout(400);
await p.fill('#tx-date','2026-06-03'); await p.evaluate(()=>document.querySelector('#tx-date').dispatchEvent(new Event('change',{bubbles:true})));
await p.waitForTimeout(500);
console.log('date edit:', await p.evaluate(()=>db.transactions.find(t=>t.id==="t1").date));
await p.evaluate(()=>closeEditor()); await p.waitForTimeout(300);
await p.click('[data-txopen="t2"]'); await p.waitForTimeout(400);
await p.fill('#tx-amt','-125.50'); await p.evaluate(()=>document.querySelector('#tx-amt').dispatchEvent(new Event('change',{bubbles:true})));
await p.waitForTimeout(500);
console.log('amount edit:', await p.evaluate(()=>db.transactions.find(t=>t.id==="t2").amount));
await p.evaluate(()=>closeEditor()); await p.waitForTimeout(300);
console.log('summary:', await p.$$eval('#txSummary .sumitem',e=>e.map(x=>x.querySelector('.k').textContent+'='+x.querySelector('.v').textContent)));
console.log('  footnote:', await p.$eval('#txSummary .sumfoot',e=>e.textContent.trim()));

// ---- bill paid uses the due date, and moving the tx moves the tick ----
await p.evaluate(()=>{db.recurring=[{id:"r1",name:"Rent",category:"Rent/Mortgage",amount:1450,dueDay:1}];
  db.transactions=db.transactions.filter(t=>!t.billRef); saveAll();});
await p.waitForTimeout(500);
await p.evaluate(()=>{setView('budget');}); await p.waitForTimeout(500);
await p.click('[data-billtog="r1"]'); await p.waitForTimeout(600);
console.log('\nmarking Rent paid (today is', await p.evaluate(()=>todayISO()), '· due the 1st):');
console.log('  transaction dated:', await p.evaluate(()=>{const t=db.transactions.find(x=>x.billRef);return t?t.date+' ref='+t.billRef:'none';}));
// move it to last month and confirm the tick follows
await p.evaluate(()=>setView('expenses')); await p.waitForTimeout(500);
const bid=await p.evaluate(()=>db.transactions.find(t=>t.billRef).id);
await p.click(`[data-txopen="${bid}"]`); await p.waitForTimeout(400);
await p.fill('#tx-date','2026-06-01');
await p.evaluate(()=>document.querySelector('#tx-date').dispatchEvent(new Event('change',{bubbles:true})));
await p.waitForTimeout(600);
await p.evaluate(()=>closeEditor()); await p.waitForTimeout(300);
console.log('  after moving it to 2026-06-01:', await p.evaluate(()=>{const t=db.transactions.find(x=>x.billRef);return t.date+' ref='+t.billRef;}));
console.log('  July shows paid?', await p.evaluate(()=>billPaid(db.recurring[0],"2026-07")), '| June shows paid?', await p.evaluate(()=>billPaid(db.recurring[0],"2026-06")));
await p.evaluate(()=>setView('expenses')); await p.waitForTimeout(500);
await p.screenshot({path:'/home/claude/xfer.png',fullPage:true});
console.log('\nERRORS:',errs.length?errs:'none');
await b.close();
