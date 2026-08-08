import pkg from 'playwright';
const { chromium } = pkg;
const b = await chromium.launch();
const errs=[];
const p=await b.newPage({viewport:{width:1440,height:1400},acceptDownloads:true});
p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(()=>{try{localStorage.clear();}catch(e){}});
await p.goto('http://localhost:8899/index.html'); await p.waitForTimeout(800);
await p.evaluate(()=>{
  db.recurring=[
   {id:"r1",name:"Rent",category:"Rent/Mortgage",amount:1450,dueDay:1,freq:"monthly"},
   {id:"r2",name:"Car Insurance",category:"Insurance",amount:1020,dueDay:15,freq:"semiannual",anchor:"2026-07"},
   {id:"r3",name:"Water",category:"Water",amount:180,dueDay:20,freq:"quarterly",anchor:"2026-07"},
   {id:"r4",name:"Domain renewal",category:"Subscriptions",amount:96,dueDay:9,freq:"annual",anchor:"2026-11",biz:true},
   {id:"r5",name:"Netflix",category:"Subscriptions",amount:23,dueDay:8,freq:"monthly"}];
  saveAll(); setView('budget');});
await p.waitForTimeout(800);
console.log('DUE-MONTH MATH (anchor sets the cycle):');
console.log(await p.evaluate(()=>{
  const ms=["2026-07","2026-08","2026-09","2026-10","2026-11","2027-01"];
  return '  bill'.padEnd(20)+ms.map(m=>m.slice(2)).join('  ')+'\n'+
   db.recurring.map(b=>'  '+b.name.slice(0,17).padEnd(18)+ms.map(m=>(billDueIn(b,m)?'  YES ':'   .  ')).join(' ')).join('\n');}));
console.log('\namortised vs due-now:');
console.log(await p.evaluate(()=>db.recurring.map(b=>'  '+b.name.padEnd(16)+fmt(b.amount).padEnd(8)+billFreq(b).label.padEnd(15)+
  ('true monthly '+fmt(billMonthly(b))).padEnd(22)+'due in July '+fmt(billAmountIn(b,"2026-07"))).join('\n')));
console.log('\n  floor (amortised):', await p.evaluate(()=>fmt(monthlyFloor())));
console.log('  July actually due:', await p.evaluate(()=>fmt(db.recurring.reduce((s,b)=>s+billAmountIn(b,"2026-07"),0))));
console.log('  Aug actually due: ', await p.evaluate(()=>fmt(db.recurring.reduce((s,b)=>s+billAmountIn(b,"2026-08"),0))));
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
await p.fill('[data-billanchor="r3"]','2026-08');
await p.evaluate(()=>{const el=document.querySelector('[data-billanchor="r3"]'); if(el)el.dispatchEvent(new Event('change',{bubbles:true}));});
await p.waitForTimeout(600);
console.log('anchor -> Aug:', await p.evaluate(()=>["2026-07","2026-08","2026-09","2026-10","2026-11"].map(m=>m.slice(5)+'='+(billDueIn(db.recurring[2],m)?'Y':'.')).join(' ')));
console.log('  bill stays visible while its editor is open:', await p.evaluate(()=>!!document.querySelector('[data-billanchor="r3"]')));
await p.click('[data-billdone]'); await p.waitForTimeout(400);
// mark all paid skips off-months
await p.click('#billMoreBtn'); await p.waitForTimeout(250); await p.click('#markAllBillsBtn'); await p.waitForTimeout(700);
console.log('\nmark-all-paid marked:', await p.evaluate(()=>db.transactions.filter(t=>t.billRef).map(t=>t.desc+' '+t.date)));
console.log('  (Domain renewal is a November bill — must NOT be marked)');
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
