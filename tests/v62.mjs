import pkg from 'playwright';
const { chromium } = pkg;
const b = await chromium.launch();
const errs=[];
const p=await b.newPage({viewport:{width:1440,height:1400}});
p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(()=>{try{localStorage.clear();}catch(e){}});
await p.goto('http://localhost:8899/index.html'); await p.waitForTimeout(800);
/* Months come from the page so the fixture never rots: the two long-cycle
   bills are anchored to the current month (so they are due now) and the two
   yearly ones to months well away from it (so they are correctly absent). */
const M=await p.evaluate(()=>[0,3,9].map(o=>{
  const d=dayOf(todayISO()); d.setDate(1); d.setMonth(d.getMonth()+o); return monthOf(d);}));
const [M0,M3,M9]=M;
await p.evaluate(M=>{
  const [M0,M3,M9]=M;
  db.recurring=[
   {id:"r1",name:"Rent",category:"Rent/Mortgage",amount:1450,dueDay:1,freq:"monthly"},
   {id:"r2",name:"Car Insurance",category:"Insurance",amount:1020,dueDay:15,freq:"semiannual",anchor:M0},
   {id:"r3",name:"Water",category:"Water",amount:180,dueDay:20,freq:"quarterly",anchor:M0},
   {id:"r4",name:"Domain renewal",category:"Subscriptions",amount:96,dueDay:9,freq:"annual",anchor:M3,biz:true},
   {id:"r5",name:"LLC filing",category:"Fees",amount:50,dueDay:5,freq:"annual",anchor:M9,biz:true},
   {id:"r6",name:"Netflix",category:"Subscriptions",amount:23,dueDay:8,freq:"monthly"}];
  saveAll(); setView('budget');},M);
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
await view(`DEFAULT — This month (${M0}):`);
console.log(`  → 2 yearly bills (${M3} + ${M9}) correctly absent`);
await p.click('[data-bview="all"]'); await p.waitForTimeout(500);
await view('All bills:');
// the note should switch the view
await p.click('[data-bview="month"]'); await p.waitForTimeout(500);
await p.click('#showAllBills'); await p.waitForTimeout(500);
console.log('\ntapping the note switched to:', await p.evaluate(()=>billView));
// a month where a yearly bill IS due
await p.click('[data-bview="month"]'); await p.waitForTimeout(400);
/* the month picker only offers months that have data (plus the current one),
   so seed a transaction in the yearly bill's month to make it selectable */
await p.evaluate(m=>{db.transactions.push({id:"tfar",date:m+"-02",desc:"seed",amount:-1,category:"Misc"});saveAll();},M3);
await p.waitForTimeout(600);
await p.selectOption('#budgetMonthSel',M3); await p.waitForTimeout(600);
await view(`This month, viewing ${M3} (Domain renewal is due):`);
// tab counts follow the view
await p.selectOption('#budgetMonthSel',M0); await p.waitForTimeout(600);
await p.click('[data-btab="Subscriptions"]'); await p.waitForTimeout(500);
console.log('\nSubscriptions tab in month view:', await p.$$eval('#billsList .brow:not(.sum)',e=>e.map(x=>x.querySelector('.bname').textContent.trim())));
await p.click('[data-bview="all"]'); await p.waitForTimeout(500);
console.log('same tab in all view:', await p.$$eval('#billsList .brow:not(.sum)',e=>e.map(x=>x.querySelector('.bname').textContent.trim())));
console.log('ERRORS:',errs.length?errs:'none');
await b.close();
