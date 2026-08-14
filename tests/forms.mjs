import pkg from 'playwright';
const {chromium}=pkg;
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:402,height:874},hasTouch:true,isMobile:true});
const p=await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8899/index.html'); await p.waitForTimeout(900);
await p.evaluate(()=>{db.accounts=[];db.recurring=[];db.budgets={};db.budgetMeta={};db.transactions=[];db.debts=[];saveAll();});
await p.waitForTimeout(400);
let pass=0,fail=0;
const chk=(n,g,w)=>{const ok=JSON.stringify(g)===JSON.stringify(w);
  console.log((ok?'  ok   ':'  FAIL ')+n+(ok?'':`  got ${JSON.stringify(g)} want ${JSON.stringify(w)}`)); ok?pass++:fail++;};
const sheet=()=>p.evaluate(()=>{const s=document.getElementById('editSheet');
  return s&&!s.hidden?{title:document.getElementById('editTitle').textContent,
    close:document.querySelector('#editSheet .sheetx span').textContent}:null;});

console.log('— bank + account —');
await p.evaluate(()=>setView('accounts')); await p.waitForTimeout(500);
chk('no add panel left in the page',await p.evaluate(()=>!document.getElementById('addPanel')),true);
await p.click('#addInstBtn'); await p.waitForTimeout(400);
chk('+ Bank opens the sheet',await sheet(),{title:'Add a bank',close:'Cancel'});
await p.fill('#ni-name','Navy Federal');
await p.click('#ni-add'); await p.waitForTimeout(600);
chk('  it lands',await p.evaluate(()=>db.accounts.map(a=>a.name+'/'+a.kind)),['Navy Federal/bank']);
chk('  and the sheet closes',await sheet(),null);

await p.click('#addAcctBtn'); await p.waitForTimeout(400);
chk('+ Account offers the bank as a parent',
  await p.evaluate(()=>[...document.querySelectorAll('#na-parent option')].map(o=>o.textContent)),
  ['On its own (no institution)','Navy Federal']);
await p.fill('#na-name','Checking'); await p.fill('#na-bal','4200');
await p.selectOption('#na-parent',{label:'Navy Federal'});
await p.click('#na-add'); await p.waitForTimeout(700);
chk('  it nests',await p.evaluate(()=>{const a=db.accounts.find(x=>x.name==='Checking');
  return a?[a.value,a.parentId===db.accounts.find(y=>y.name==='Navy Federal').id]:null;}),[4200,true]);

console.log('\n  a card grows a limit field and keeps what was typed');
await p.click('#addAcctBtn'); await p.waitForTimeout(400);
await p.fill('#na-name','Milestone'); await p.fill('#na-bal','480');
chk('  no limit field on a checking account',await p.evaluate(()=>!document.querySelector('#na-lim')),true);
await p.selectOption('#na-kind','credit'); await p.waitForTimeout(400);
chk('  the name survives the redraw',await p.inputValue('#na-name'),'Milestone');
chk('  and the balance',await p.inputValue('#na-bal'),'480');
chk('  a limit field appears',await p.evaluate(()=>!!document.querySelector('#na-lim')),true);
await p.fill('#na-lim','750');
await p.click('#na-add'); await p.waitForTimeout(800);
chk('  it saves as a liability and makes a debt',await p.evaluate(()=>{
  const a=db.accounts.find(x=>x.name==='Milestone');
  return [a.value,a.limit,db.debts.some(d=>d.name==='Milestone')];}),[480,750,true]);

console.log('\n— a transaction by hand —');
await p.evaluate(()=>setView('expenses')); await p.waitForTimeout(500);
await p.click('#addTxBtn'); await p.waitForTimeout(400);
chk('the sheet says Done, not Cancel',await sheet(),{title:'Add by hand',close:'Done'});
chk('  the date is today',await p.inputValue('#mt-date'),await p.evaluate(()=>todayISO()));
chk('  it does not open on Income',await p.inputValue('#mt-cat'),'Uncategorized');
await p.fill('#mt-desc','Kroger'); await p.waitForTimeout(300);
chk('  a known merchant files itself',await p.inputValue('#mt-cat'),'Food');
/* a rule beats the sign, so this needs a description nothing matches */
await p.fill('#mt-desc','Wedding shoot'); await p.fill('#mt-amt','250'); await p.waitForTimeout(300);
chk('  and unfamiliar money coming in reads as income',await p.inputValue('#mt-cat'),'Income');
await p.selectOption('#mt-cat','Food'); await p.waitForTimeout(200);
await p.fill('#mt-desc','Nothing familiar'); await p.waitForTimeout(300);
chk('  once you pick one it stops guessing',await p.inputValue('#mt-cat'),'Food');
await p.evaluate(()=>closeEditor()); await p.waitForTimeout(300);
await p.click('#addTxBtn'); await p.waitForTimeout(400);
await p.fill('#mt-desc','Kroger'); await p.fill('#mt-amt','-42.10');
await p.selectOption('#mt-cat','Food'); await p.click('#mt-add'); await p.waitForTimeout(700);
chk('  it lands',await p.evaluate(()=>db.transactions.map(t=>t.desc+' '+t.amount+' '+t.category)),['Kroger -42.1 Food']);
chk('  the sheet stays open for the next one',!!(await sheet()),true);
chk('  description and amount cleared',[await p.inputValue('#mt-desc'),await p.inputValue('#mt-amt')],['','']);
chk('  date and category kept',[await p.inputValue('#mt-date'),await p.inputValue('#mt-cat')],
  [await p.evaluate(()=>todayISO()),'Food']);
await p.fill('#mt-desc','Shell'); await p.fill('#mt-amt','-30');
await p.click('#mt-add'); await p.waitForTimeout(700);
chk('  a second one too',await p.evaluate(()=>db.transactions.length),2);
chk('  and it counts them',await p.evaluate(()=>document.querySelector('#mt-said b').textContent),'2');
await p.evaluate(()=>closeEditor()); await p.waitForTimeout(400);

console.log('\n— a bill —');
await p.evaluate(()=>setView('budget')); await p.waitForTimeout(600);
await p.click('#showAddBill'); await p.waitForTimeout(400);
chk('+ Bill opens the sheet',await sheet(),{title:'Add a bill',close:'Cancel'});
await p.fill('#recName','Car insurance'); await p.fill('#recAmt','390'); await p.fill('#recDay','15');
await p.selectOption('#recFreq','quarterly'); await p.waitForTimeout(400);
chk('  the name survives the redraw',await p.inputValue('#recName'),'Car insurance');
chk('  and it prices the month',await p.evaluate(()=>{
  const n=document.querySelector('#editSheetBody .note'); return n?/\$130\.00\/mo/.test(n.textContent):null;}),true);
await p.click('#addRecBtn'); await p.waitForTimeout(800);
chk('  it lands quarterly with an anchor',await p.evaluate(()=>{
  const r=db.recurring.find(x=>x.name==='Car insurance');
  return [r.name,r.amount,r.freq,r.dueDay,r.anchor===monthKey(todayISO())];}),
  ['Car insurance',390,'quarterly',15,true]);
chk('  and opens on the list',
  await p.evaluate(()=>editBill===db.recurring.find(x=>x.name==='Car insurance').id),true);

console.log('\n— an envelope —');
await p.click('#showAddBudget'); await p.waitForTimeout(400);
chk('+ Budget opens the sheet',await sheet(),{title:'Add a budget',close:'Cancel'});
chk('  no name field until you ask for a new category',await p.evaluate(()=>!document.querySelector('#budNew')),true);
await p.selectOption('#budCat','__new'); await p.waitForTimeout(400);
chk('  then there is one',await p.evaluate(()=>!!document.querySelector('#budNew')),true);
await p.fill('#budNew','Date nights'); await p.fill('#budLimit','120');
await p.click('#addBudBtn'); await p.waitForTimeout(800);
chk('  the category joins the real list',await p.evaluate(()=>db.categories.includes('Date nights')),true);
chk('  the envelope starts this month, rolling',await p.evaluate(()=>{
  const m=db.budgetMeta['Date nights']; return [db.budgets['Date nights'],m.since===monthKey(todayISO()),m.roll];}),[120,true,true]);

console.log('\n  an already-budgeted category warns before it overwrites');
await p.click('#showAddBudget'); await p.waitForTimeout(400);
await p.selectOption('#budCat','Date nights'); await p.waitForTimeout(400);
chk('  the note says what it replaces',await p.evaluate(()=>{
  const n=document.querySelector('#editSheetBody .note.warn'); return n?/already has an envelope/.test(n.textContent):false;}),true);
chk('  and the button says so',await p.evaluate(()=>document.querySelector('#addBudBtn').textContent),'Replace budget');
await p.evaluate(()=>closeEditor()); await p.waitForTimeout(300);

console.log('\n— the calendar lead time found a home —');
chk('hidden until you export',await p.evaluate(()=>document.getElementById('calLead').hidden),true);
await p.evaluate(()=>{document.getElementById('calBillsBtn').click();}); await p.waitForTimeout(600);
chk('  shown after',await p.evaluate(()=>({hidden:document.getElementById('calLead').hidden,
  val:document.getElementById('billAlertDays').value})),{hidden:false,val:'3'});

console.log(`\n${pass} passed, ${fail} failed`);
console.log('page errors:',errs.length?errs:'none');
await b.close();
if(fail||errs.length) process.exitCode=1;
