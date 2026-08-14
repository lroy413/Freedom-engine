import pkg from 'playwright';
const {chromium}=pkg;
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1440,height:1200}});
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8899/index.html'); await p.waitForTimeout(1000);
await p.evaluate(()=>{
  db.accounts=[{id:"a1",name:"Checking",kind:"checking",value:5000,parentId:null}];
  db.debts=[{id:"d1",name:"Visa",kind:"card",balance:1450,start:5000,limit:5000,apr:24,payment:120,payments:[]}];
  db.budgets={"Food":500}; db.income=[{id:"s1",name:"Gig work",model:"daily",rate:650,units:3,payFreq:"weekly",firstPay:"2026-01-09",extras:[{label:"Per diem",type:"Per diem",amount:50,cadence:"day",days:13}]}];
  saveAll();});
await p.waitForTimeout(800);
let total=0;
for(const v of ['dash','accounts','income','expenses','budget','goals','credit','invest','tax','business','data']){
  await p.evaluate(x=>setView(x),v); await p.waitForTimeout(500);
  const r=await p.evaluate(()=>{const sec=document.querySelector('.view.active');
    const btns=[...sec.querySelectorAll('.infobtn.tiny')];
    return {n:btns.length, near:btns.slice(0,4).map(b2=>{
      const h=b2.parentElement.textContent.replace(/\s+/g,' ').replace(/i$/,'').trim();
      return h.slice(0,34);})};});
  total+=r.n;
  console.log(`${v.padEnd(10)} ${String(r.n).padStart(2)} info buttons  ${r.near.join(' | ')}`);
}
console.log('\ntotal:',total);

console.log('\n— ON-DEMAND PANELS —');
await p.evaluate(()=>{setView('income');expStream='s1';renderIncome();renderIncomeEditor('s1');});
await p.waitForTimeout(900);
console.log('income editor:', await p.evaluate(()=>[...document.querySelectorAll('#view-income .infobtn.tiny')]
  .map(b2=>b2.parentElement.textContent.replace(/\s+/g,' ').replace(/i$/,'').trim().slice(0,40))));
await p.evaluate(()=>{setView('business');addBizOpen=true;renderBusiness();}); await p.waitForTimeout(900);
console.log('business add panel:', await p.evaluate(()=>[...document.querySelectorAll('#view-business .infobtn.tiny')]
  .map(b2=>b2.parentElement.textContent.replace(/\s+/g,' ').replace(/i$/,'').trim().slice(0,40))));
/* the accounts add form moved into the editor sheet, so its help chips are
   collapsed there rather than on the view */
await p.evaluate(()=>{setView('accounts');openAddInst();}); await p.waitForTimeout(900);
console.log('accounts add sheet:', await p.evaluate(()=>[...document.querySelectorAll('#editSheetBody .infobtn.tiny')]
  .map(b2=>b2.parentElement.textContent.replace(/\s+/g,' ').replace(/i$/,'').trim().slice(0,40))));
await p.evaluate(()=>closeEditor()); await p.waitForTimeout(400);

console.log('\n— TOGGLE BEHAVIOUR —');
await p.evaluate(()=>setView('credit')); await p.waitForTimeout(600);
console.log(await p.evaluate(()=>{
  const b2=[...document.querySelectorAll('#view-credit .infobtn.tiny')].find(x=>/Card utilization/.test(x.parentElement.textContent));
  if(!b2)return 'not found';
  const before=b2.nextElementSibling||b2.parentElement.nextElementSibling;
  b2.click();
  const tip=b2.parentElement.nextElementSibling;
  return {tag:tip.tagName,cls:tip.className,shown:!tip.hidden,text:tip.textContent.slice(0,60),armed:b2.classList.contains('on')};}));
await p.evaluate(()=>{const b2=[...document.querySelectorAll('#view-credit .infobtn.tiny')].find(x=>/Card utilization/.test(x.parentElement.textContent)); b2.click();});
console.log('closes again:', await p.evaluate(()=>{
  const b2=[...document.querySelectorAll('#view-credit .infobtn.tiny')].find(x=>/Card utilization/.test(x.parentElement.textContent));
  return b2.parentElement.nextElementSibling.hidden;}));

console.log('\n— SHORT HINTS STAY VISIBLE —');
await p.evaluate(()=>setView('dash')); await p.waitForTimeout(500);
console.log(await p.$$eval('.view.active .sectiontitle .hint',e=>e.map(x=>x.textContent.trim())));

console.log('\n— SECTION FOLD STILL WORKS AND ISN\'T TRIGGERED BY (i) —');
await p.evaluate(()=>{const s=document.querySelector('[data-sect="io"]'); const i=s.querySelector('.infobtn'); if(i)i.click();});
await p.waitForTimeout(400);
console.log('after clicking the (i) inside a foldable header:', await p.evaluate(()=>({
  folded:document.querySelector('[data-sect="io"]').classList.contains('shut'),
  tipShown:!!document.querySelector('[data-sect="io"]+.helptext:not([hidden])')})));

console.log('\n— EXTRAS COLLAPSED —');
await p.evaluate(()=>{setView('income');expStream='s1';renderIncome();renderIncomeEditor('s1');}); await p.waitForTimeout(700);
console.log(await p.evaluate(()=>({
  toggle:document.getElementById('exToggle')?document.getElementById('exToggle').textContent.trim().replace(/\s+/g,' '):null,
  bodyHidden:document.getElementById('exBody')?document.getElementById('exBody').hidden:null})));
await p.evaluate(()=>document.getElementById('exToggle').click()); await p.waitForTimeout(500);
console.log('after opening:', await p.evaluate(()=>({hidden:document.getElementById('exBody').hidden,
  rows:document.querySelectorAll('#exBody tbody tr').length, saved:db.settings.ui.exOpen})));

console.log('\n— IDEMPOTENT —');
const c1=await p.evaluate(()=>document.querySelectorAll('.infobtn.tiny').length);
await p.evaluate(()=>{collapseHelp();collapseHelp();renderAll();});
await p.waitForTimeout(700);
const c2=await p.evaluate(()=>document.querySelectorAll('.infobtn.tiny').length);
console.log(`buttons before ${c1}, after three more sweeps ${c2}`);
console.log('\nerrors:', errs.length?errs:'none');
await b.close();
