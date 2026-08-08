import pkg from 'playwright';
const { chromium } = pkg;
const b = await chromium.launch();
const errs=[];
const p=await b.newPage({viewport:{width:1440,height:1300}});
p.on('pageerror',e=>errs.push(e.message));
// mock SimpleFIN with L's real-shaped accounts (negative balances, as banks report them)
await p.route(/simplefin\.org/, r=>r.fulfill({contentType:'application/json',body:JSON.stringify({accounts:[
  {id:"sf1",org:{name:"Navy Federal Credit Union"},name:"Navy Federal Credit Union Used Vehicle Loan - 5344",balance:"-3477.68",transactions:[]},
  {id:"sf2",org:{name:"Concora Credit Inc."},name:"Concora Credit Inc. Credit Card (2135)",balance:"-9.95","available-balance":"740.05",transactions:[
    {id:"t1",posted:1785000000,description:"AMAZON MKTPL",amount:"-9.95"}]},
  {id:"sf3",org:{name:"Chase"},name:"Chase Total Checking",balance:"4210.11",transactions:[]},
  {id:"sf4",org:{name:"Chase"},name:"Chase Savings",balance:"2556.40",transactions:[]}
],errors:[]})}));
await p.addInitScript(()=>{try{localStorage.clear();}catch(e){}});
await p.goto('http://localhost:8899/index.html'); await p.waitForTimeout(700);
console.log('name/type guesses:');
console.log(await p.evaluate(()=>[
  "Navy Federal Credit Union Used Vehicle Loan - 5344",
  "Concora Credit Inc. Credit Card (2135)",
  "Chase Total Checking","Chase Savings","Sallie Mae Student Loan",
  "Wells Fargo Home Mortgage","Personal Line of Credit","Discover it Card"
].map(n=>'  '+n.padEnd(50)+' -> '+sfKind(n)).join('\n')));
console.log('\nname dedupe:', await p.evaluate(()=>sfName({name:"Navy Federal Credit Union Used Vehicle Loan - 5344",org:{name:"Navy Federal Credit Union"}})));
// run the sync
await p.evaluate(async()=>{ syncCfg.sfAccess="https://u:p@beta-bridge.simplefin.org/simplefin";
  window.__r=await sfSync(90); saveAll(); });
await p.waitForTimeout(800);
console.log('\nsync result:', await p.evaluate(()=>({newAcct:__r.newAcct,newDebt:__r.newDebt,newTx:__r.newTx})));
console.log('\naccounts:');
console.log(await p.evaluate(()=>db.accounts.map(a=>'  '+String(a.name).slice(0,44).padEnd(46)+kindOf(a).label.padEnd(14)+'value='+a.value+(a.limit?' limit='+a.limit:'')+(a.debtId?' → debt':'')).join('\n')));
console.log('\ndebts generated:');
console.log(await p.evaluate(()=>db.debts.map(d=>'  '+String(d.name).slice(0,44).padEnd(46)+'kind='+d.kind.padEnd(11)+'bal='+d.balance+' start='+d.start+(d.limit?' limit='+d.limit:'')).join('\n')));
await p.evaluate(()=>setView('accounts')); await p.waitForTimeout(600);
console.log('\ngroups:', await p.$$eval('#acctList .grouphead',e=>e.map(x=>x.textContent)));
console.log('money on hand:', await p.$eval('.hval',e=>e.textContent));
console.log('hero:', await p.$$eval('.hitem',e=>e.map(x=>x.querySelector('.k').textContent+'='+x.querySelector('.v').textContent)));
console.log('rows:', await p.$$eval('#acctList .arow',e=>e.map(x=>x.querySelector('.aname').textContent.slice(0,34)+' | '+x.querySelector('.ameta').textContent+' | '+x.querySelector('.abal').textContent)));
console.log('net worth:', await p.evaluate(()=>({assets:totalAssets(),debt:totalDebt(),unlinked:unlinkedCardDebt(),net:netWorth()})));
// add APR + payment to the auto loan, check payoff estimate
const carId=await p.evaluate(()=>db.accounts.find(a=>a.kind==='autoloan').id);
await p.evaluate(i=>{editAcct=i;renderCash();},carId); await p.waitForTimeout(400);
console.log('\nloan fields:', await p.$$eval('.aedit-panel .field label',e=>e.map(l=>l.textContent)));
await p.fill(`[data-caorig="${carId}"]`,'24000'); await p.evaluate(i=>document.querySelector(`[data-caorig="${i}"]`).dispatchEvent(new Event('change',{bubbles:true})),carId); await p.waitForTimeout(400);
await p.evaluate(i=>{editAcct=i;renderCash();},carId); await p.waitForTimeout(300);
await p.fill(`[data-caapr="${carId}"]`,'7.9'); await p.evaluate(i=>document.querySelector(`[data-caapr="${i}"]`).dispatchEvent(new Event('change',{bubbles:true})),carId); await p.waitForTimeout(400);
await p.evaluate(i=>{editAcct=i;renderCash();},carId); await p.waitForTimeout(300);
await p.fill(`[data-capay="${carId}"]`,'173'); await p.evaluate(i=>document.querySelector(`[data-capay="${i}"]`).dispatchEvent(new Event('change',{bubbles:true})),carId); await p.waitForTimeout(500);
await p.evaluate(i=>{editAcct=i;renderCash();},carId); await p.waitForTimeout(400);
console.log('payoff note:', await p.$eval('.aedit-panel .note',e=>e.textContent.trim().replace(/\s+/g,' ')));
console.log('flowed to debt:', await p.evaluate(()=>{const d=db.debts.find(x=>x.kind==='auto');return {start:d.start,apr:d.apr,payment:d.payment,bal:d.balance};}));
await p.evaluate(()=>{editAcct=null;renderCash();setView('credit');}); await p.waitForTimeout(600);
console.log('\ndebt cards:', await p.$$eval('#debtList .dcard',e=>e.map(x=>x.querySelector('.dname').textContent.slice(0,28)+' | '+x.querySelector('.dmeta').textContent+' | '+x.querySelector('.dbal').textContent)));
await p.screenshot({path:'/home/claude/loans.png',fullPage:true});
console.log('\nERRORS:',errs.length?errs:'none');
await b.close();
