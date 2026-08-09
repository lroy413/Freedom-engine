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

// per-budget rollover — the editor is its own sheet now, and the all-or-nothing
// checkbox became a share, so "off" is the 0% option
await p.evaluate(()=>openBudgetEditor("Food")); await p.waitForTimeout(600);
console.log('\neditor opens in a sheet:', await p.evaluate(()=>document.querySelectorAll('#editSheetBody .bpanel').length));
console.log('fields:', await p.$$eval('#editSheetBody .field label',e=>e.map(l=>l.textContent)));
console.log('note:', await p.$eval('#editSheetBody .note',e=>e.textContent.trim().replace(/\s+/g,' ')));
await p.selectOption('#editSheetBody [data-brollpct="Food"]','0'); await p.waitForTimeout(600);
console.log('\nrollover OFF ->', await p.evaluate(()=>({stored:db.budgetMeta.Food.roll,rolls:budgetRolls("Food"),carry:carriedInto("Food",monthKey(todayISO()))})));
console.log('  meta line:', await p.$eval('#budgetList .bmeta',e=>e.textContent));
await p.evaluate(()=>{ if(_editor) closeEditor(); }); await p.waitForTimeout(400);
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
/* The editor is a sheet now, so the list never grows: rows stay the same
   height whether or not something is being edited, and Done/back closes the
   sheet rather than collapsing a panel. */
await p.evaluate(()=>{ if(_editor) closeEditor(); }); await p.waitForTimeout(400);
const hClosed=await p.evaluate(()=>[...document.querySelectorAll('#budgetList .brow')].map(r=>Math.round(r.getBoundingClientRect().height)));
await p.click('#budgetList .bmain'); await p.waitForTimeout(500);
const hOpen=await p.evaluate(()=>[...document.querySelectorAll('#budgetList .brow')].map(r=>Math.round(r.getBoundingClientRect().height)));
console.log('\nsheet open:', await p.evaluate(()=>!document.getElementById('editSheet').hidden));
console.log('no panel inside the list:', await p.evaluate(()=>document.querySelectorAll('#budgetList .bpanel').length));
console.log('row heights unchanged by editing:', JSON.stringify(hClosed)===JSON.stringify(hOpen), JSON.stringify(hClosed));
await p.click('[data-buddone]'); await p.waitForTimeout(400);
console.log('Done closes the sheet:', await p.evaluate(()=>document.getElementById('editSheet').hidden));
// delete cleans meta — and now asks twice, like every other destructive path
await p.click('#budgetList .bmain'); await p.waitForTimeout(400);
await p.click('#editSheetBody [data-buddel]'); await p.waitForTimeout(300);
console.log('one tap does not delete:', await p.evaluate(()=>Object.keys(db.budgets).length));
await p.click('#editSheetBody [data-buddel]'); await p.waitForTimeout(600);
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
