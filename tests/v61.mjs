import pkg from 'playwright';
const { chromium } = pkg;
const b = await chromium.launch();
const errs=[];
const p=await b.newPage({viewport:{width:1440,height:1400},acceptDownloads:true});
p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(()=>{try{localStorage.clear();}catch(e){}});
await p.goto('http://localhost:8899/index.html'); await p.waitForTimeout(800);
/* Month keys come from the page, using the app's own date helpers, so the
   fixture stays correct whatever month it is run in and can never disagree
   with the app about "today". Anchoring to day 1 before adding months keeps
   setMonth off the 29th-31st, where it skips a month. */
const M=await p.evaluate(()=>[0,1,2,3,4,5,6,9].map(o=>{
  const d=dayOf(todayISO()); d.setDate(1); d.setMonth(d.getMonth()+o); return monthOf(d);}));
const [M0,M1,M2,M3,M4,M5,M6,M9]=M;
await p.evaluate(M=>{
  const [M0,,,M3]=M;
  db.recurring=[
   {id:"r1",name:"Rent",category:"Rent/Mortgage",amount:1450,dueDay:1,freq:"monthly"},
   {id:"r2",name:"Car Insurance",category:"Insurance",amount:1020,dueDay:15,freq:"semiannual",anchor:M0},
   {id:"r3",name:"Water",category:"Water",amount:180,dueDay:20,freq:"quarterly",anchor:M0},
   {id:"r4",name:"Domain renewal",category:"Subscriptions",amount:96,dueDay:9,freq:"annual",anchor:M3,biz:true},
   {id:"r5",name:"Netflix",category:"Subscriptions",amount:23,dueDay:8,freq:"monthly"}];
  saveAll(); setView('budget');},M);
await p.waitForTimeout(800);
console.log('DUE-MONTH MATH (anchor sets the cycle):');
console.log(await p.evaluate(ms=>{
  return '  bill'.padEnd(20)+ms.map(m=>m.slice(2)).join('  ')+'\n'+
   db.recurring.map(b=>'  '+b.name.slice(0,17).padEnd(18)+ms.map(m=>(billDueIn(b,m)?'  YES ':'   .  ')).join(' ')).join('\n');},
  [M0,M1,M2,M3,M4,M6]));
console.log('\namortised vs due-now:');
console.log(await p.evaluate(m0=>db.recurring.map(b=>'  '+b.name.padEnd(16)+fmt(b.amount).padEnd(8)+billFreq(b).label.padEnd(15)+
  ('true monthly '+fmt(billMonthly(b))).padEnd(22)+('due in '+m0+' ')+fmt(billAmountIn(b,m0))).join('\n'),M0));
console.log('\n  floor (amortised):', await p.evaluate(()=>fmt(monthlyFloor())));
console.log(`  ${M0} actually due:`, await p.evaluate(m=>fmt(db.recurring.reduce((s,b)=>s+billAmountIn(b,m),0)),M0));
console.log(`  ${M1} actually due:`, await p.evaluate(m=>fmt(db.recurring.reduce((s,b)=>s+billAmountIn(b,m),0)),M1));
console.log('\nBills KPI:', await p.evaluate(()=>{const k=[...document.querySelectorAll('#budgetKpis .kpi')].find(x=>/Bills/.test(x.textContent));
  return k.querySelector('.label').textContent+' '+k.querySelector('.val').textContent+' — '+k.querySelector('.sub').textContent;}));
console.log('\nrows:', await p.$$eval('#billsList .brow:not(.sum)',e=>e.map(x=>
  (x.classList.contains('offmonth')?'off ':'due ')+x.querySelector('.bname').textContent.trim().padEnd(18)+
  x.querySelector('.bmeta').textContent.padEnd(52)+x.querySelector('.bamt').textContent)));
console.log('footer:', await p.$eval('#billsList .brow.sum',e=>e.textContent.trim().replace(/\s+/g,' ')));
console.log('\ncheckbox present only when due:', await p.evaluate(()=>[...document.querySelectorAll('#billsList .brow:not(.sum)')].map(r=>
  r.querySelector('.bname').textContent.trim()+'='+(r.querySelector('button.chk')?'tickable':'ghosted'))));
// editor
await p.click('[data-billopen="r3"]'); await p.waitForTimeout(500);
console.log('\nWater editor fields:', await p.$$eval('.bpanel .field label',e=>e.map(l=>l.textContent.trim().replace(/\s+/g,' '))));
console.log('note:', await p.$eval('.bpanel .note',e=>e.textContent.trim().replace(/\s+/g,' ')));
await p.selectOption('[data-billfreq="r3"]','annual'); await p.waitForTimeout(600);
console.log('switched to yearly:', await p.evaluate(()=>({freq:db.recurring[2].freq,monthly:fmt(billMonthly(db.recurring[2])),next:nextBillDate(db.recurring[2])})));
await p.selectOption('[data-billfreq="r3"]','quarterly'); await p.waitForTimeout(500);
// change the anchor and watch the cycle move
await p.fill('[data-billanchor="r3"]',M1);
await p.evaluate(()=>{const el=document.querySelector('[data-billanchor="r3"]'); if(el)el.dispatchEvent(new Event('change',{bubbles:true}));});
await p.waitForTimeout(600);
console.log(`anchor -> ${M1}:`, await p.evaluate(ms=>ms.map(m=>m.slice(5)+'='+(billDueIn(db.recurring[2],m)?'Y':'.')).join(' '),[M0,M1,M2,M3,M4]));
console.log('  bill stays visible while its editor is open:', await p.evaluate(()=>!!document.querySelector('[data-billanchor="r3"]')));
await p.click('[data-billdone]'); await p.waitForTimeout(400);
// mark all paid skips off-months
await p.click('#billMoreBtn'); await p.waitForTimeout(250); await p.click('#markAllBillsBtn'); await p.waitForTimeout(700);
console.log('\nmark-all-paid marked:', await p.evaluate(()=>db.transactions.filter(t=>t.billRef).map(t=>t.desc+' '+t.date)));
console.log(`  (Domain renewal is a ${M3} bill — must NOT be marked)`);
// ICS
const dl=p.waitForEvent('download'); await p.click('#billMoreBtn'); await p.waitForTimeout(250); await p.click('#calBillsBtn'); const d=await dl;
await d.saveAs('/home/claude/bills2.ics');
const fs=await import('fs');
const ics=fs.readFileSync('/home/claude/bills2.ics','utf8');
console.log('\nRRULEs + first occurrence:');
ics.split('BEGIN:VEVENT').slice(1).forEach(bk=>{
  const g=r=>((bk.match(r)||[])[1]||'').trim();
  console.log('  '+g(/SUMMARY:(.*)/).slice(0,34).padEnd(36)+'DTSTART='+g(/DTSTART;VALUE=DATE:(\d+)/)+'  '+g(/(RRULE:.*)/));});
console.log('\nERRORS:',errs.length?errs:'none');
await b.close();
