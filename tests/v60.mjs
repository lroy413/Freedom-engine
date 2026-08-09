import pkg from 'playwright';
const { chromium } = pkg;
const b = await chromium.launch();
const errs=[];
const p=await b.newPage({viewport:{width:1440,height:1500},acceptDownloads:true});
p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(()=>{try{localStorage.clear();}catch(e){}});
await p.goto('http://localhost:8899/index.html'); await p.waitForTimeout(800);
await p.evaluate(()=>{
  db.recurring=[
   {id:"r1",name:"Rent",category:"Rent/Mortgage",amount:1450,dueDay:1},
   {id:"r2",name:"Car Insurance",category:"Insurance",amount:169,dueDay:1},
   {id:"r3",name:"Cell Phone",category:"Phone",amount:140,dueDay:3},
   {id:"r4",name:"Car Note",category:"Car Payment",amount:173,dueDay:5},
   {id:"r5",name:"Georgia Power",category:"Electric",amount:95,dueDay:10},
   {id:"r6",name:"Netflix",category:"Subscriptions",amount:23,dueDay:8},
   {id:"r7",name:"Spotify",category:"Subscriptions",amount:12,dueDay:14},
   {id:"r8",name:"Adobe CC",category:"Subscriptions",amount:60,dueDay:20,biz:true},
   {id:"r9",name:"Hulu",category:"Subscriptions",amount:18,dueDay:22},
   {id:"r10",name:"Internet",category:"Internet",amount:70,dueDay:12}];
  saveAll(); setView('budget');});
await p.waitForTimeout(800);
console.log('FLOOR note:', await p.$eval('#billFloor .floornote',e=>e.textContent.trim().replace(/\s+/g,' ')));
console.log('tier chips:', await p.$$eval('#billFloor .tchip',e=>e.map(x=>x.textContent.trim().replace(/\s+/g,' '))));
console.log('tabs:', await p.$$eval('#billTabs .btab',e=>e.map(x=>x.textContent.trim().replace(/\s+/g,' '))));
console.log('\ndefault tiers/groups:', await p.evaluate(()=>db.recurring.map(b=>b.name.padEnd(15)+billGroup(b).padEnd(15)+BILL_TIERS[billTier(b)].label)));
// tab filter
/* the bill filters collapse behind one summary line now — open the panel
   before reaching for a chip */
await p.evaluate(()=>{setBillFiltOpen(true);renderBudget();}); await p.waitForTimeout(300);
await p.click('[data-btab="Subscriptions"]'); await p.waitForTimeout(500);
console.log('\nSubscriptions tab:', await p.$$eval('#billsList .brow:not(.sum)',e=>e.map(x=>x.querySelector('.bname').textContent.trim())));
console.log('  footer:', await p.$eval('#billsList .brow.sum',e=>e.textContent.trim().replace(/\s+/g,' ')));
// tier filter
await p.click('[data-btab="all"]'); await p.waitForTimeout(400);
await p.click('[data-btier="luxury"]'); await p.waitForTimeout(500);
console.log('\nLuxury filter:', await p.$$eval('#billsList .brow:not(.sum)',e=>e.map(x=>x.querySelector('.bname').textContent.trim())));
await p.click('[data-btier="biz"]'); await p.waitForTimeout(500);
console.log('Business filter:', await p.$$eval('#billsList .brow:not(.sum)',e=>e.map(x=>x.querySelector('.bname').textContent.trim())));
await p.click('[data-btier=""]'); await p.waitForTimeout(400);
// scroll when >5
console.log('\nscroll container:', await p.evaluate(()=>{const s=document.querySelector('#billsList .scrollrows');
  return s?{h:Math.round(s.getBoundingClientRect().height),sh:s.scrollHeight,scrolls:s.scrollHeight>s.clientHeight}:'none'}));
// editor fields
await p.click('[data-billopen="r6"]'); await p.waitForTimeout(500);
console.log('\neditor fields:', await p.$$eval('.bpanel .field label',e=>e.map(l=>l.textContent.trim().replace(/\s+/g,' '))));
await p.selectOption('[data-billtier="r6"]','essential'); await p.waitForTimeout(600);
console.log('Netflix -> essential:', await p.evaluate(()=>({tier:db.recurring.find(x=>x.id==='r6').tier,floor:fmt(monthlyFloor())})));
await p.selectOption('[data-billtier="r6"]','luxury'); await p.waitForTimeout(500);
await p.check('[data-billbiz="r6"]'); await p.waitForTimeout(600);
console.log('Netflix marked business:', await p.evaluate(()=>({biz:!!db.recurring.find(x=>x.id==='r6').biz,bizTotal:fmt(bizTotal())})));
await p.uncheck('[data-billbiz="r6"]'); await p.waitForTimeout(400);
await p.click('[data-billdone]'); await p.waitForTimeout(400);

// compact add panels
console.log('\nadd panels hidden at rest:', await p.evaluate(()=>({
  bill:document.getElementById('addBillPanel').style.display,
  budget:document.getElementById('addBudgetPanel').style.display})));
await p.click('#showAddBill'); await p.waitForTimeout(500);
console.log('after + Bill:', await p.evaluate(()=>document.getElementById('addBillPanel').style.display));
await p.fill('#recName','Gym'); await p.fill('#recAmt','35'); await p.fill('#recDay','15');
await p.selectOption('#recCat','Health'); await p.click('#addRecBtn'); await p.waitForTimeout(700);
console.log('added:', await p.evaluate(()=>{const b=db.recurring[db.recurring.length-1];
  return {name:b.name,group:b.group,tier:b.tier,panelClosed:document.getElementById('addBillPanel').style.display==='none'};}));
await p.click('#showAddBudget'); await p.waitForTimeout(400);
console.log('+ Budget opens:', await p.evaluate(()=>document.getElementById('addBudgetPanel').style.display));
await p.click('[data-hideadd="addBudgetPanel"]'); await p.waitForTimeout(300);
console.log('cancel closes:', await p.evaluate(()=>document.getElementById('addBudgetPanel').style.display));

// ---- calendar export ----
const dl=p.waitForEvent('download');
await p.click('#billMoreBtn'); await p.waitForTimeout(250); await p.click('#calBillsBtn');
const d=await dl;
const fs=await import('fs');
const path='/home/claude/bills.ics'; await d.saveAs(path);
const ics=fs.readFileSync(path,'utf8');
console.log('\nICS filename:', d.suggestedFilename());
console.log('CRLF endings:', ics.includes('\r\n'));
console.log('events:', (ics.match(/BEGIN:VEVENT/g)||[]).length, 'alarms:', (ics.match(/BEGIN:VALARM/g)||[]).length);
console.log('\n--- Rent event ---');
console.log(ics.split('BEGIN:VEVENT')[1].split('END:VEVENT')[0].trim().split('\r\n').map(l=>'  '+l).join('\n'));
console.log('\nmessage:', await p.$eval('#calMsg',e=>e.textContent.trim().replace(/\s+/g,' ')));
await p.screenshot({path:'/home/claude/bills2.png',fullPage:true});
console.log('\nERRORS:',errs.length?errs:'none');
await b.close();
