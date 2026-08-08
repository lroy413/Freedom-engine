import pkg from 'playwright';
const {chromium}=pkg;
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:402,height:900}});
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8899/index.html'); await p.waitForTimeout(900);
const M=await p.evaluate(()=>monthOf(todayISO()));
const PREV=await p.evaluate(()=>{const [y,mm]=monthOf(todayISO()).split("-").map(Number);
  const d=new Date(y,mm-1,1); d.setMonth(d.getMonth()-1); return monthOf(d);});
await p.evaluate(([m,pm])=>{
  db.recurring=[
   {id:"r1",name:"Water",category:"Water",amount:60,dueDay:15,tier:"essential"},
   {id:"r2",name:"Prepaid electric",category:"Electric",amount:120,dueDay:1,tier:"essential",open:true},
   {id:"r3",name:"Rent",category:"Rent/Mortgage",amount:1450,dueDay:1,tier:"essential"},
   {id:"r4",name:"Netflix",category:"Subscriptions",amount:23,dueDay:8,tier:"luxury"},
   {id:"r5",name:"Phone",category:"Phone",amount:135,dueDay:1,tier:"essential"},
   {id:"r6",name:"Spotify",category:"Subscriptions",amount:12,dueDay:12,tier:"luxury"},
   {id:"r7",name:"Adobe",category:"Subscriptions",amount:60,dueDay:20,tier:"flexible"}];
  // last month: water overpaid by $25 (paid 85 of 60)
  logBillPayment(db.recurring[0],pm,85,pm+"-14");
  saveAll(); setView('budget');},[M,PREV]);
await p.waitForTimeout(900);

console.log('— OVERPAY CARRIES —');
console.log(await p.evaluate(m=>{const w=db.recurring[0];
  return {credit:+billCredit(w,m).toFixed(2), paidEff:+billPaidAmt(w,m).toFixed(2),
    remaining:+billRemaining(w,m).toFixed(2), paid:billPaid(w,m)};},M));
console.log('  (paid 85 of 60 last month -> $25 credit; water this month needs 60-25=35)');
await p.evaluate(m=>{logBillPayment(db.recurring[0],m,35);saveAll();},M); await p.waitForTimeout(500);
console.log('after paying the remaining 35:', await p.evaluate(m=>({paid:billPaid(db.recurring[0],m),
  rem:+billRemaining(db.recurring[0],m).toFixed(2)}),M));

console.log('\n— OPEN BILL —');
console.log(await p.evaluate(m=>{const e=db.recurring[1];
  return {status:billStatus(e,m), remaining:billRemaining(e,m), overdueEver:billStatus(e,m).cls==='bad'};},M));
await p.evaluate(m=>{logBillPayment(db.recurring[1],m,45,m+"-05");logBillPayment(db.recurring[1],m,50,m+"-18");saveAll();},M);
await p.waitForTimeout(500);
console.log('after two prepay top-ups (45+50 of ~120):', await p.evaluate(m=>{const e=db.recurring[1];
  return {raw:billPaidRaw(e,m), status:billStatus(e,m).label, paid:billPaid(e,m)};},M));
console.log('row shows:', await p.evaluate(()=>{const r=[...document.querySelectorAll('#billsList .brow')].find(x=>/Prepaid/.test(x.textContent));
  return {amt:r.querySelector('.bamt').textContent.trim().replace(/\s+/g,' '), meta:r.querySelector('.bmeta').textContent.trim().replace(/\s+/g,' ').slice(0,70),
    hasChk:!!r.querySelector('[data-billtog]'), hasPay:!!r.querySelector('[data-billpay]'), payg:!!r.querySelector('.payg')};}));

console.log('\n— CARD COPY —');
console.log(await p.evaluate(()=>{const k=[...document.querySelectorAll('#budgetKpis .kpi')].find(x=>/Bills/.test(x.textContent));
  return {label:k.querySelector('.label').textContent, val:k.querySelector('.val').textContent,
    sub:k.querySelector('.sub').textContent.replace(/\s+/g,' ')};}));
// overpay water heavily -> "ahead" wording
await p.evaluate(m=>{logBillPayment(db.recurring[0],m,80);saveAll();},M); await p.waitForTimeout(500);
console.log('after overpaying water $80 more:', await p.evaluate(()=>{const k=[...document.querySelectorAll('#budgetKpis .kpi')].find(x=>/Bills/.test(x.textContent));
  return k.querySelector('.sub').textContent.replace(/\s+/g,' ');}));
console.log('next month water remaining:', await p.evaluate(m=>{const [y,mm]=m.split("-").map(Number);
  const d=new Date(y,mm-1,1); d.setMonth(d.getMonth()+1); const nm=monthOf(d);
  return {month:nm, credit:+billCredit(db.recurring[0],nm).toFixed(2), rem:+billRemaining(db.recurring[0],nm).toFixed(2)};},M));

console.log('\n— TOOLBAR —');
console.log(await p.evaluate(()=>({menuHidden:document.getElementById('billMore').hidden,
  segGone:!document.getElementById('billViewSeg'),
  chipRow:[...document.querySelectorAll('#billFloor .chiprow > *')].map(x=>x.textContent.trim().slice(0,12)||x.className),
  noteHidden:document.querySelector('#billFloor .floornote').hidden})));
await p.evaluate(()=>document.getElementById('billMoreBtn').click()); await p.waitForTimeout(300);
console.log('menu open:', await p.evaluate(()=>({hidden:document.getElementById('billMore').hidden,
  items:[...document.querySelectorAll('#billMore .popitem')].map(x=>x.textContent.trim())})));
await p.evaluate(()=>document.body.click()); await p.waitForTimeout(300);
console.log('outside click closes:', await p.evaluate(()=>document.getElementById('billMore').hidden));
await p.evaluate(()=>{const i=document.querySelector('[data-floorinfo]'); i.click();}); await p.waitForTimeout(300);
console.log('floor (i) reveals:', await p.evaluate(()=>!document.querySelector('#billFloor .floornote').hidden));

console.log('\n— SCROLL SURVIVES A TICK —');
await p.evaluate(()=>{const sc=document.querySelector('#billsList .scrollrows'); if(sc)sc.scrollTop=140;});
const before=await p.evaluate(()=>{const sc=document.querySelector('#billsList .scrollrows'); return sc?sc.scrollTop:'no scroller';});
await p.evaluate(m=>{setBillPaid(db.recurring[4],m,true);saveAll();},M); await p.waitForTimeout(600);
const after=await p.evaluate(()=>{const sc=document.querySelector('#billsList .scrollrows'); return sc?sc.scrollTop:'no scroller';});
console.log({before, after, preserved: before===after});
console.log('\nerrors:', errs.length?errs:'none');
await b.close();
