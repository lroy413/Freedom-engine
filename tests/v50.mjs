import pkg from 'playwright';
const { chromium } = pkg;
const b = await chromium.launch();
const errs=[];
const p = await b.newPage({viewport:{width:1440,height:1300}});
p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(()=>{try{localStorage.clear();}catch(e){}});
await p.goto('http://localhost:8899/index.html'); await p.waitForTimeout(700);
await p.evaluate(()=>{
  db.accounts=[{id:"b1",name:"Chase",kind:"bank",value:0,parentId:null},
               {id:"a1",name:"Chase Checking",kind:"checking",value:9476,parentId:"b1"}];
  db.debts=[{id:"d1",name:"Credit Card",balance:600,start:730,kind:"card",limit:750,payments:[{id:"p1",date:"2026-07-10",amount:130}]},
            {id:"d2",name:"Mission Lane",balance:1400,start:1400,kind:"collection",payments:[]},
            {id:"d3",name:"Navy Federal Car",balance:3150,start:24000,kind:"auto",payments:[]}];
  saveAll(); setView('credit');});
await p.waitForTimeout(600);
const cards=async t=>console.log(t, await p.$$eval('#debtList .dcard',c=>c.map(x=>({
  name:x.querySelector('.dname').textContent, meta:x.querySelector('.dmeta').textContent,
  bal:x.querySelector('.dbal').textContent, of:(x.querySelector('.dof')||{}).textContent||'',
  h:Math.round(x.getBoundingClientRect().height), editing:x.classList.contains('editing')}))));
await cards('COLLAPSED:');
// click card to expand
await p.click('.dcard:nth-child(3) .dtop'); await p.waitForTimeout(350);
console.log('\nexpanded 3rd:', await p.evaluate(()=>({editing:document.querySelectorAll('.dcard.editing').length,
  fields:[...document.querySelectorAll('.dcard.editing .field label')].map(l=>l.textContent)})));
// edit original — the debt fields live behind the Edit button now
await p.evaluate(()=>{editDebtFields="d3";renderCredit();}); await p.waitForTimeout(300);
await p.fill('[data-dstart="d3"]','30000'); await p.evaluate(()=>document.querySelector('[data-dstart="d3"]').dispatchEvent(new Event('change',{bubbles:true})));
await p.waitForTimeout(400);
console.log('after orig=30000:', await p.$eval('.dcard:nth-child(3) .dmeta',e=>e.textContent), '|', await p.$eval('.dcard:nth-child(3) .dof',e=>e.textContent));
// close
await p.click('[data-ddone]'); await p.waitForTimeout(300);
console.log('closed:', await p.evaluate(()=>document.querySelectorAll('.dcard.editing').length));
// pay button
await p.click('[data-dpay="d2"]'); await p.waitForTimeout(300);
await p.fill('#pay-amt','200'); await p.click('[data-dpaysave="d2"]'); await p.waitForTimeout(500);
await cards('\nafter paying 200 on Mission Lane:');
console.log('history auto-open:', await p.evaluate(()=>!!document.querySelector('[data-dpaydel]')));
await p.click('[data-ddone]'); await p.waitForTimeout(300);

// ---- credit card ACCOUNT ----
await p.evaluate(()=>setView('accounts')); await p.waitForTimeout(400);
/* the add form is a sheet now — open it to prove the button still works, then
   get out of its way so the clicks below have a target */
await p.click('#addAcctBtn').catch(()=>{});
await p.evaluate(()=>closeEditor()); await p.waitForTimeout(300);
console.log('\n-- accounts --');
await p.evaluate(()=>{
  const a={id:"c1",name:"Milestone Card",kind:"credit",value:410,limit:500,parentId:null};
  const d={id:"d4",name:"Milestone Card",balance:410,start:410,kind:"card",limit:500,payments:[]};
  a.debtId=d.id; db.accounts.push(a); db.debts.push(d); saveAll();});
await p.waitForTimeout(500);
console.log('groups:', await p.$$eval('#acctList .grouphead',e=>e.map(x=>x.textContent)));
console.log('money on hand:', await p.$eval('.hval',e=>e.textContent));
console.log('hero items:', await p.$$eval('.hitem',e=>e.map(x=>x.querySelector('.k').textContent+'='+x.querySelector('.v').textContent)));
console.log('card row:', await p.evaluate(()=>{const r=[...document.querySelectorAll('.arow')].find(x=>x.textContent.includes('Milestone'));
  return {bal:r.querySelector('.abal').textContent, meta:r.querySelector('.ameta').textContent};}));
// change the account balance -> debt follows
await p.evaluate(()=>{const a=db.accounts.find(x=>x.id==='c1'); a.value=275; saveAll();});
await p.waitForTimeout(500);
console.log('after account balance -> 275, debt balance:', await p.evaluate(()=>db.debts.find(d=>d.id==='d4').balance));
// pay it from the debt side -> account follows
await p.evaluate(()=>setView('credit')); await p.waitForTimeout(400);
await p.click('[data-dpay="d4"]'); await p.waitForTimeout(300);
await p.fill('#pay-amt','75'); await p.click('[data-dpaysave="d4"]'); await p.waitForTimeout(500);
console.log('after $75 payment -> debt/account:', await p.evaluate(()=>({d:db.debts.find(x=>x.id==='d4').balance,a:db.accounts.find(x=>x.id==='c1').value})));
console.log('utilization:', await p.$eval('#utilVal',e=>e.textContent));
console.log('net worth:', await p.evaluate(()=>({assets:totalAssets(),debt:totalDebt(),unlinked:unlinkedCardDebt(),net:netWorth()})));
await p.evaluate(()=>{document.querySelectorAll('[data-ddone]').forEach(b=>b.click());}); await p.waitForTimeout(300);
await p.screenshot({path:'/home/claude/debt-cards.png',fullPage:true});
console.log('\nERRORS:',errs.length?errs:'none');
await b.close();
