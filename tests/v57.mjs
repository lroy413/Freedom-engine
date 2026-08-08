import pkg from 'playwright';
const { chromium } = pkg;
const b = await chromium.launch();
const errs=[];
const p=await b.newPage({viewport:{width:1440,height:1400}});
p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(()=>{try{localStorage.clear();}catch(e){}});
await p.goto('http://localhost:8899/index.html'); await p.waitForTimeout(800);
// two months of history, no budget yet
await p.evaluate(()=>{
  db.transactions=[
    {id:"t1",date:"2026-05-10",desc:"Kroger",amount:-180,category:"Food"},
    {id:"t2",date:"2026-06-12",desc:"Kroger",amount:-210,category:"Food"},
    {id:"t3",date:"2026-07-05",desc:"Kroger",amount:-90,category:"Food"}];
  db.budgets={}; db.budgetMeta={}; saveAll(); setView('budget');});
await p.waitForTimeout(600);
// add a Food budget now — must NOT carry two months in
await p.click('#showAddBudget'); await p.waitForTimeout(250); await p.selectOption('#budCat','Food'); await p.fill('#budLimit','400');
await p.click('#addBudBtn'); await p.waitForTimeout(700);
console.log('THE BUG — new $400 Food budget with May/June history behind it:');
console.log(await p.evaluate(()=>{const m=monthKey(todayISO());
  return `  since=${budgetSince("Food")} rolledIn=${carriedInto("Food",m)} budgeted=${budgetedFor("Food",m)} spent=${spentFor("Food",m)} available=${availableFor("Food",m)}`;}));
console.log('  row reads:', await p.$$eval('#budgetList .brow',e=>e.map(x=>x.querySelector('.bname').textContent+' | '+x.querySelector('.bmeta').textContent+' | '+x.querySelector('.dbal').textContent+' '+x.querySelector('.dof').textContent)));
console.log('  (before the fix this rolled in $400 + $190 = $590 it never had)');

// per-budget rollover toggle
console.log('\neditor opened on add:', await p.evaluate(()=>document.querySelectorAll('.bpanel').length));
console.log('fields:', await p.$$eval('.bpanel .field label',e=>e.map(l=>l.textContent)));
console.log('note:', await p.$eval('.bpanel .note',e=>e.textContent.trim().replace(/\s+/g,' ')));
await p.uncheck('[data-broll="Food"]'); await p.waitForTimeout(600);
console.log('\nrollover OFF ->', await p.evaluate(()=>({stored:db.budgetMeta.Food.roll,rolls:budgetRolls("Food"),carry:carriedInto("Food",monthKey(todayISO()))})));
console.log('  meta line:', await p.$eval('#budgetList .bmeta',e=>e.textContent));
// second budget keeps its own setting
await p.click('#showAddBudget'); await p.waitForTimeout(250); await p.selectOption('#budCat','Auto & Gas'); await p.fill('#budLimit','150');
await p.click('#addBudBtn'); await p.waitForTimeout(700);
console.log('\nindependent settings:', await p.evaluate(()=>Object.entries(db.budgetMeta).map(([k,v])=>k+': roll='+v.roll+' since='+v.since)));
// carry actually works when on: spend less than budget in a past month
await p.evaluate(()=>{ db.budgetMeta.Food.roll=true; db.budgetMeta.Food.since="2026-05"; saveAll(); });
await p.waitForTimeout(600);
console.log('\nwith since=May and rollover on:', await p.evaluate(()=>({
  may:budgetedFor("Food","2026-05")-spentFor("Food","2026-05"),
  jun:budgetedFor("Food","2026-06")-spentFor("Food","2026-06"),
  carriedIntoJul:carriedInto("Food","2026-07")})));
// collapse behaviour
await p.click('[data-buddone]'); await p.waitForTimeout(400);
console.log('\npanels after Done:', await p.evaluate(()=>document.querySelectorAll('.bpanel').length));
await p.click('#budgetList .bmain'); await p.waitForTimeout(400);
console.log('tap row opens:', await p.evaluate(()=>document.querySelectorAll('.bpanel').length));
console.log('row height collapsed vs open:', await p.evaluate(()=>{
  const rs=[...document.querySelectorAll('#budgetList .brow')];
  return rs.map(r=>Math.round(r.getBoundingClientRect().height));}));
await p.click('[data-buddone]'); await p.waitForTimeout(400);
// delete cleans meta
await p.click('#budgetList .bmain'); await p.waitForTimeout(300);
await p.click('[data-buddel]'); await p.waitForTimeout(600);
console.log('\nafter delete:', await p.evaluate(()=>({budgets:Object.keys(db.budgets),meta:Object.keys(db.budgetMeta)})));

// ---- income streams collapse ----
await p.evaluate(()=>{db.income=[
  {id:"i1",name:"Ozark Law - AC",type:"Production",model:"daily",rate:350,units:5,payFreq:"biweekly",firstPay:"2026-06-05",start:"2026-05-20",end:"2026-10-01",extras:[{label:"Per diem",type:"Per diem",amount:45,cadence:"day",days:5}]},
  {id:"i2",name:"Roommate",type:"Other",model:"monthly",amount:1517,payFreq:"monthly",firstPay:"2026-07-01",start:"2026-01-01",extras:[],notax:true}];
  saveAll(); setView('income');});
await p.waitForTimeout(700);
console.log('\nincome cards collapsed:', await p.$$eval('#incomeList .dcard',e=>e.map(x=>({
  n:x.querySelector('.dname').textContent, m:x.querySelector('.dmeta').textContent,
  amt:x.querySelector('.dbal').textContent, h:Math.round(x.getBoundingClientRect().height)}))));
await p.click('#incomeList .dtop'); await p.waitForTimeout(600);
console.log('expanded has editor:', await p.evaluate(()=>({panel:!!document.querySelector('#incomeList .dpanel'),
  fields:document.querySelectorAll('#incomeList .dpanel .field').length,
  notaxBox:!!document.getElementById('e-notax'),
  h:Math.round(document.querySelector('#incomeList .dcard').getBoundingClientRect().height)})));
// edit through it and confirm it stays open
await p.selectOption('#e-freq','weekly'); await p.click('#e-save'); await p.waitForTimeout(700);
console.log('after saving from the panel:', await p.evaluate(()=>({freq:db.income[0].payFreq,
  stillOpen:!!document.querySelector('#incomeList .dpanel')})));
await p.click('[data-idone]'); await p.waitForTimeout(400);
console.log('closed:', await p.evaluate(()=>!document.querySelector('#incomeList .dpanel')));
await p.screenshot({path:'/home/claude/budg.png',fullPage:true});
console.log('\nERRORS:',errs.length?errs:'none');
await b.close();
