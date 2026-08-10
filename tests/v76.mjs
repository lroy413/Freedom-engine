import pkg from 'playwright';
const {chromium}=pkg;
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:402,height:874},hasTouch:true,isMobile:true,deviceScaleFactor:2});
const p=await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8899/index.html'); await p.waitForTimeout(900);
const M=await p.evaluate(()=>monthOf(todayISO()));
await p.evaluate(m=>{
  db.recurring=Array.from({length:9},(_,i)=>({id:"r"+i,name:"Bill "+i,category:"Subscriptions",amount:20+i,dueDay:1+i,tier:"luxury"}));
  db.paychecks=Array.from({length:8},(_,i)=>({id:"p"+i,date:m+"-"+String(2+i).padStart(2,"0"),source:"Gig",gross:500,net:500}));
  saveAll(); setView('budget');},M);
await p.waitForTimeout(800);

console.log('— SCROLL SURVIVES DIRECT RENDERS —');
const scTop=()=>p.evaluate(()=>{const sc=document.querySelector('#billsList .scrollrows');return sc?Math.round(sc.scrollTop):null;});
await p.evaluate(()=>{document.querySelector('#billsList .scrollrows').scrollTop=150;});
console.log('set 150, expand a mid-list bill (direct renderBudget path):');
await p.evaluate(()=>{document.querySelector('[data-billopen="r5"]').click();}); await p.waitForTimeout(400);
console.log('  after expand:', await scTop());
await p.evaluate(()=>{document.querySelector('[data-billedit="r5"]')?.click();}); await p.waitForTimeout(300);
await p.evaluate(()=>{const pay=document.querySelector('[data-billpay="r6"]'); if(pay)pay.click();}); await p.waitForTimeout(400);
console.log('  after Pay open:', await scTop());
await p.evaluate(()=>{document.querySelector('[data-billtog="r7"]').click();}); await p.waitForTimeout(500);
console.log('  after tick (saveAll path):', await scTop());

console.log('\n— paychecks list too —');
await p.evaluate(()=>setView('income')); await p.waitForTimeout(600);
const paySc=()=>p.evaluate(()=>{const sc=document.querySelector('#view-income .scrollrows');return sc?Math.round(sc.scrollTop):null;});
await p.evaluate(()=>{const sc=document.querySelector('#view-income .scrollrows'); if(sc)sc.scrollTop=100;});
console.log('  set 100 · rows found:', await p.evaluate(()=>document.querySelectorAll('#view-income [data-payopen]').length));
await p.evaluate(()=>{const r=document.querySelectorAll('#view-income [data-payopen]')[5]; if(r)r.click();}); await p.waitForTimeout(400);
console.log('  after opening paycheck 6:', await paySc());

console.log('\n— ZOOM DEFENCES —');
console.log(await p.evaluate(()=>({
  viewport:document.querySelector('meta[name=viewport]').content,
  touchAction:getComputedStyle(document.documentElement).touchAction,
  coarse:matchMedia('(hover:none) and (pointer:coarse)').matches})));
console.log('control font sizes on touch:', await p.evaluate(()=>{
  const pick=s=>{const el=document.querySelector(s); return el?getComputedStyle(el).fontSize:null;};
  return {fieldInput:pick('.field input'),select:pick('select'),miniedit:pick('.miniedit'),monthSel:pick('#monthSel')};}));
await p.evaluate(()=>setView('expenses')); await p.waitForTimeout(600);
await p.evaluate(()=>{db.transactions=[{id:"t1",date:monthOf(todayISO())+"-05",desc:"Kroger",category:"Food",amount:-30}];saveAll();});
await p.waitForTimeout(500);
/* the transaction editors moved into the sheet the row opens — check the sizes
   where they actually live now */
await p.click('[data-txopen="t1"]'); await p.waitForTimeout(400);
console.log('tx editor inputs:', await p.evaluate(()=>{
  const pick=s=>{const el=document.querySelector(s); return el?getComputedStyle(el).fontSize:null;};
  return {date:pick('#tx-date'),desc:pick('#tx-desc'),amt:pick('#tx-amt'),cat:pick('#tx-cat')};}));
await p.evaluate(()=>closeEditor()); await p.waitForTimeout(300);
console.log('search box:', await p.evaluate(()=>getComputedStyle(document.getElementById('txSearch')).fontSize));
// overflow with 16px controls
for(const v of ['dash','budget','expenses','tax','income']){
  await p.evaluate(x=>setView(x),v); await p.waitForTimeout(450);
  const over=await p.evaluate(()=>{const de=document.documentElement;
    return [...document.querySelectorAll('.view.active *')].filter(el=>{
      const b2=el.getBoundingClientRect();
      if(!(b2.width>0&&b2.right>de.clientWidth+2))return false;
      for(let a=el.parentElement;a;a=a.parentElement){const o=getComputedStyle(a).overflowX;if(o==='auto'||o==='scroll')return false;}
      return true;}).slice(0,3).map(el=>el.tagName+'.'+String(el.className).split(' ')[0]);});
  console.log(`  ${v.padEnd(9)} overflow: ${over.length?over.join(', '):'none'}`);
}
console.log('\nerrors:', errs.length?errs:'none');
await b.close();
