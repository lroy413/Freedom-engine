import pkg from 'playwright';
const { chromium } = pkg;
const b = await chromium.launch();
const errs=[];
const p=await b.newPage({viewport:{width:1440,height:1400}});
p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(()=>{try{localStorage.clear();}catch(e){}});
await p.goto('http://localhost:8899/index.html'); await p.waitForTimeout(700);
await p.evaluate(()=>{
  db.accounts=[{id:"a1",name:"Chase Checking",kind:"checking",value:4210,parentId:null},
    {id:"c1",name:"Concora Card",kind:"credit",value:410,limit:750,parentId:null}];
  const cats=["Food","Auto & Gas","Shopping","Entertainment","Household"];
  db.transactions=[];
  for(let i=0;i<45;i++){ const d=new Date(2026,6,29); d.setDate(d.getDate()-i*3);
    db.transactions.push({id:"t"+i,date:d.toISOString().slice(0,10),desc:(i%5===0?"Kroger ":"Merchant ")+(i+1),
      amount:i%9===0?300+i*10:-(12+i*4),category:i%9===0?"Income":cats[i%5],
      acctId:i%3===0?"a1":i%3===1?"c1":undefined}); }
  db.transactions.push({id:"tu",date:"2026-07-28",desc:"Mystery charge",amount:-88,category:"Uncategorized"});
  saveAll(); setView('expenses');});
await p.waitForTimeout(700);
const sum=async t=>console.log(t, await p.evaluate(()=>({
  n:document.querySelectorAll('#txTable tbody tr').length,
  s:[...document.querySelectorAll('#txSummary .sumitem')].map(x=>x.querySelector('.k').textContent+'='+x.querySelector('.v').textContent).join(' '),
  chips:[...document.querySelectorAll('.fchip')].map(x=>x.textContent.replace('✕','').trim())})));
await sum('ALL:');
await p.click('#filtToggle'); await p.waitForTimeout(300);
console.log('\naccount options:', await p.$$eval('#f-acct option',e=>e.map(o=>o.textContent)));
console.log('category options (first 5):', await p.$$eval('#f-cat option',e=>e.slice(0,5).map(o=>o.textContent)));

await p.selectOption('#f-acct','c1'); await p.waitForTimeout(400); await sum('\nAccount = Concora Card:');
await p.selectOption('#f-cat','Food'); await p.waitForTimeout(400); await sum('+ Category = Food:');
await p.selectOption('#f-when','90'); await p.waitForTimeout(400); await sum('+ last 3 months:');
await p.selectOption('#f-dir','out'); await p.waitForTimeout(400); await sum('+ money out:');
console.log('\nrows show account:', await p.$$eval('#txTable tbody tr',e=>e.slice(0,3).map(r=>r.children[0].textContent+' | '+r.children[1].textContent+' | '+r.children[3].textContent)));
// drop one chip
await p.click('[data-fdrop="cat"]'); await p.waitForTimeout(400); await sum('\nafter dropping the Category chip:');
// amount range
await p.fill('#f-min','100'); await p.waitForTimeout(500); await sum('+ min $100:');
// search
await p.click('#fClearAll'); await p.waitForTimeout(400);
await p.fill('#txSearch','kroger'); await p.waitForTimeout(500); await sum('\nsearch "kroger":');
// uncategorized
await p.click('#fClearAll'); await p.waitForTimeout(300);
await p.selectOption('#f-cat','uncat'); await p.waitForTimeout(400); await sum('\nUncategorized only:');
// unassigned account
await p.click('#fClearAll'); await p.waitForTimeout(300);
await p.selectOption('#f-acct','none'); await p.waitForTimeout(400); await sum('Not linked to an account:');
// sorting
await p.click('#fClearAll'); await p.waitForTimeout(300);
await p.selectOption('#f-sort','big'); await p.waitForTimeout(400);
console.log('\nbiggest first:', await p.$$eval('#txTable tbody tr',e=>e.slice(0,3).map(r=>r.children[3].textContent)));
await p.selectOption('#f-sort','old'); await p.waitForTimeout(400);
console.log('oldest first:', await p.$$eval('#txTable tbody tr',e=>e.slice(0,2).map(r=>r.children[0].textContent.slice(0,10))));
await p.selectOption('#f-sort','new'); await p.waitForTimeout(400);
// nothing matches
await p.fill('#txSearch','zzzz'); await p.waitForTimeout(500);
console.log('\nno matches:', await p.$eval('#txTable',e=>e.textContent.trim()));
await p.fill('#txSearch',''); await p.waitForTimeout(400);
await p.screenshot({path:'/home/claude/filters.png',fullPage:true});
console.log('\nERRORS:',errs.length?errs:'none');
await b.close();
