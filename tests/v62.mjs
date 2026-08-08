import pkg from 'playwright';
const { chromium } = pkg;
const b = await chromium.launch();
const errs=[];
const p=await b.newPage({viewport:{width:1440,height:1400}});
p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(()=>{try{localStorage.clear();}catch(e){}});
await p.goto('http://localhost:8899/index.html'); await p.waitForTimeout(800);
await p.evaluate(()=>{
  db.recurring=[
   {id:"r1",name:"Rent",category:"Rent/Mortgage",amount:1450,dueDay:1,freq:"monthly"},
   {id:"r2",name:"Car Insurance",category:"Insurance",amount:1020,dueDay:15,freq:"semiannual",anchor:"2026-07"},
   {id:"r3",name:"Water",category:"Water",amount:180,dueDay:20,freq:"quarterly",anchor:"2026-07"},
   {id:"r4",name:"Domain renewal",category:"Subscriptions",amount:96,dueDay:9,freq:"annual",anchor:"2026-11",biz:true},
   {id:"r5",name:"LLC filing",category:"Fees",amount:50,dueDay:5,freq:"annual",anchor:"2027-04",biz:true},
   {id:"r6",name:"Netflix",category:"Subscriptions",amount:23,dueDay:8,freq:"monthly"}];
  saveAll(); setView('budget');});
await p.waitForTimeout(800);
const view=async t=>{const r=await p.evaluate(()=>({
  seg:[...document.querySelectorAll('[data-bview]')].map(x=>x.textContent+(x.classList.contains('active')?' ←':'')),
  rows:[...document.querySelectorAll('#billsList .brow:not(.sum)')].map(x=>
    (x.classList.contains('offmonth')?'off ':'due ')+x.querySelector('.bname').textContent.trim()),
  tabs:[...document.querySelectorAll('#billTabs .btab')].map(x=>x.textContent.trim().replace(/\s+/g,' ')),
  footer:(document.querySelector('#billsList .brow.sum')||{}).textContent?.trim().replace(/\s+/g,' '),
  hidden:document.getElementById('billHidden').textContent.trim()}));
  console.log('\n'+t); console.log('  seg:',r.seg.join(' | '));
  console.log('  rows:',r.rows.join(', ')); console.log('  tabs:',r.tabs.join('  '));
  console.log('  footer:',r.footer); console.log('  note:',r.hidden||'(none)');};
await view('DEFAULT — This month (July):');
console.log('  → 2 yearly bills (Nov + next April) correctly absent');
await p.click('[data-bview="all"]'); await p.waitForTimeout(500);
await view('All bills:');
// the note should switch the view
await p.click('[data-bview="month"]'); await p.waitForTimeout(500);
await p.click('#showAllBills'); await p.waitForTimeout(500);
console.log('\ntapping the note switched to:', await p.evaluate(()=>billView));
// a month where a yearly bill IS due
await p.click('[data-bview="month"]'); await p.waitForTimeout(400);
await p.evaluate(()=>{db.transactions.push({id:"tnov",date:"2026-11-02",desc:"seed",amount:-1,category:"Misc"});saveAll();});
await p.waitForTimeout(600);
await p.selectOption('#budgetMonthSel','2026-11'); await p.waitForTimeout(600);
await view('This month, viewing November (Domain renewal is due):');
// tab counts follow the view
await p.selectOption('#budgetMonthSel','2026-07'); await p.waitForTimeout(600);
await p.click('[data-btab="Subscriptions"]'); await p.waitForTimeout(500);
console.log('\nSubscriptions tab in month view:', await p.$$eval('#billsList .brow:not(.sum)',e=>e.map(x=>x.querySelector('.bname').textContent.trim())));
await p.click('[data-bview="all"]'); await p.waitForTimeout(500);
console.log('same tab in all view:', await p.$$eval('#billsList .brow:not(.sum)',e=>e.map(x=>x.querySelector('.bname').textContent.trim())));
console.log('ERRORS:',errs.length?errs:'none');
await b.close();
