import pkg from 'playwright';
const {chromium}=pkg;
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1440,height:1200}});
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8899/index.html'); await p.waitForTimeout(900);
const M=await p.evaluate(()=>monthOf(todayISO()));
const PREV=await p.evaluate(()=>{const [y,mm]=monthOf(todayISO()).split("-").map(Number);
  const d=new Date(y,mm-1,1); d.setMonth(d.getMonth()-1); return monthOf(d);});
await p.evaluate(([m,pm])=>{
  db.accounts=[{id:"a1",name:"Checking",kind:"checking",value:6000,parentId:null}];
  db.income=[{id:"s1",name:"Freelance",model:"daily",rate:650,units:3,payFreq:"weekly",firstPay:m+"-03",taxClass:"se"}];
  db.paychecks=[{id:"p1",date:m+"-03",source:"Freelance",gross:1950,net:1950}];
  db.recurring=[
   {id:"r1",name:"Rent",category:"Rent/Mortgage",amount:1500,dueDay:1,tier:"essential"},
   {id:"r2",name:"Power",category:"Electric",amount:150,dueDay:28,tier:"essential"}];
  db.budgets={"Food":500,"Auto & Gas":200};
  db.budgetMeta={"Food":{since:m,roll:false},"Auto & Gas":{since:m,roll:false}};
  db.transactions=[
   {id:"t1",date:m+"-05",desc:"Kroger",category:"Food",amount:-430},
   {id:"t2",date:pm+"-06",desc:"Kroger",category:"Food",amount:-260},
   {id:"t3",date:m+"-06",desc:"NEWCO COFFEE 0042",category:"Uncategorized",amount:-18.4,review:true},
   {id:"t4",date:m+"-07",desc:"SHELL OIL 5551",category:"Auto & Gas",amount:-52,review:true},
   {id:"t5",date:m+"-08",desc:"PAYPAL TRANSFER",category:"Uncategorized",amount:-99,review:true}];
  logBillPayment(db.recurring[0],m,1500);  // rent paid
  catchUpReserve(); saveAll(); setView('dash');},[M,PREV]);
await p.waitForTimeout(900);

console.log('— SAFE TO SPEND —');
const st=await p.evaluate(()=>safeToSpend());
console.log({cash:+st.cash.toFixed(2),tax:+st.tax.toFixed(2),bills:st.bills,env:st.env,safe:+st.safe.toFixed(2),perDay:+st.perDay.toFixed(2),daysLeft:st.daysLeft});
console.log('hand check: cash 6000 (account balances are set, not derived); tax reserve off 1950 of 1099 pay');
console.log('            bills left 150 (rent paid); envelopes left (500-430)+(200-52)=218; safe = cash-tax-150-218');
console.log('KPI card:', await p.evaluate(()=>{const k=[...document.querySelectorAll('#kpiRow .kpi')].find(x=>/Safe to spend/.test(x.textContent));
  return {present:!!k,val:k.querySelector('.val').textContent,sub:k.querySelector('.sub').textContent,opens:k.hasAttribute('data-stsopen')};}));
await p.evaluate(()=>document.querySelector('[data-stsopen]').click()); await p.waitForTimeout(500);
console.log('sheet:', await p.evaluate(()=>({title:document.getElementById('stsVal').textContent,
  rows:[...document.querySelectorAll('#stsBody .defrow')].map(r=>r.querySelector('.k').textContent.split('\n')[0].trim()+' = '+r.querySelector('.v').textContent),
  note:document.querySelector('#stsBody .note').textContent.slice(0,80)})));
await p.evaluate(()=>closeSTS());

console.log('\n— REVIEW QUEUE —');
await p.evaluate(()=>setView('expenses')); await p.waitForTimeout(600);
console.log(await p.evaluate(()=>({count:reviewQueue().length,cardShown:!document.getElementById('reviewCard').hidden,
  header:document.getElementById('rvToggle').textContent.trim().replace(/\s+/g,' ').slice(0,60)})));
// correcting one teaches a rule
await p.evaluate(()=>{const sel=document.querySelector('[data-rvcat="t3"]'); sel.value='Food'; sel.dispatchEvent(new Event('change'));});
await p.waitForTimeout(500);
console.log('after correcting t3 -> Food:', await p.evaluate(()=>({queue:reviewQueue().length,
  cat:db.transactions.find(t=>t.id==='t3').category,
  learned:db.rules.filter(r=>/newco/.test(r.m)).map(r=>r.m+'->'+r.c)})));
// accept one as guessed
await p.evaluate(()=>document.querySelector('[data-rvok="t4"]').click()); await p.waitForTimeout(400);
console.log('after ✓ on t4:', await p.evaluate(()=>({queue:reviewQueue().length,stillGas:db.transactions.find(t=>t.id==='t4').category})));
// accept all
await p.evaluate(()=>document.getElementById('rvAll').click()); await p.waitForTimeout(400);
console.log('after accept all:', await p.evaluate(()=>({queue:reviewQueue().length,cardHidden:document.getElementById('reviewCard').hidden})));

console.log('\n— INSIGHTS —');
await p.evaluate(()=>{db.transactions.push({id:"t9",date:monthOf(todayISO())+"-09",desc:"IMPORTED",category:"Misc",amount:-5,review:true});saveAll();setView('dash');});
await p.waitForTimeout(700);
console.log(await p.evaluate(()=>insights().map(i=>i.kind+': '+i.text.replace(/<[^>]+>/g,'').slice(0,80))));
console.log('rendered:', await p.evaluate(()=>({shown:!document.getElementById('insightRow').hidden,
  cards:document.querySelectorAll('#insightRow .insight').length})));
// dismiss the first, stays gone
const firstId=await p.evaluate(()=>insights()[0].id);
await p.evaluate(()=>document.querySelector('[data-idismiss]').click()); await p.waitForTimeout(500);
console.log('after dismiss:', await p.evaluate(id=>({stillThere:insights().some(i=>i.id===id),
  cards:document.querySelectorAll('#insightRow .insight').length,saved:db.settings.insightsGone}),firstId));
await p.reload(); await p.waitForTimeout(1000);
console.log('dismissal survives reload:', await p.evaluate(id=>!insights().some(i=>i.id===id),firstId));
console.log('insight click navigates:', await p.evaluate(()=>{const t=document.querySelector('#insightRow .itext');
  if(!t)return 'no cards'; t.click(); return currentView;}));
console.log('\nerrors:', errs.length?errs:'none');
await b.close();
