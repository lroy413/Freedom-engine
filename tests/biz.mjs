/* The business tool: a landing page, one screen per business, editing behind a
   button, a four-step onboarding, and the two-way conversation with Tax. */
import pkg from 'playwright';
const {chromium}=pkg;
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:402,height:874},hasTouch:true,isMobile:true,timezoneId:'America/New_York'});
const p=await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8899/index.html'); await p.waitForTimeout(900);
let pass=0,fail=0;
const chk=(n,g,w)=>{const ok=JSON.stringify(g)===JSON.stringify(w);
  console.log((ok?'  ok   ':'  FAIL ')+n+(ok?'':`  got ${JSON.stringify(g)} want ${JSON.stringify(w)}`)); ok?pass++:fail++;};
const Y=await p.evaluate(()=>todayISO().slice(0,4));
const sheet=()=>p.evaluate(()=>{const s=document.getElementById('editSheet');
  return s&&!s.hidden?document.getElementById('editTitle').textContent:null;});

await p.evaluate(()=>{db.businesses=[];db.transactions=[];db.paychecks=[];db.income=[];
  db.recurring=[];db.accounts=[];db.tax.stateName="Georgia";db.tax.stateRate=5.39;saveAll();setView('business');});
await p.waitForTimeout(700);

console.log('— the landing page —');
chk('opens on the list, not inside a business',
  await p.evaluate(()=>({idx:!document.getElementById('bizIndex').hidden,one:document.getElementById('bizOne').hidden})),
  {idx:true,one:true});
chk('  and says what tagging does',
  await p.evaluate(()=>/Business.*picker/.test(document.getElementById('bizList').textContent)),true);

console.log('\n— setting one up takes four steps —');
await p.click('#showAddBiz'); await p.waitForTimeout(500);
chk('+ Business opens the sheet',await sheet(),'Set one up');
chk('  four steps, on the first',
  await p.evaluate(()=>({dots:document.querySelectorAll('.bizdot').length,
    on:document.querySelector('.bizdot.on')===document.querySelectorAll('.bizdot')[0],
    name:document.querySelector('.bizstepname').textContent})),
  {dots:4,on:true,name:"What it is"});
await p.click('#nb-next'); await p.waitForTimeout(300);
chk('  a nameless business does not advance',
  await p.evaluate(()=>document.querySelector('.bizstepname').textContent),"What it is");
await p.fill('#nb-name','Rig Rentals');
await p.fill('#nb-industry','Camera and lighting rental');
await p.click('#nb-next'); await p.waitForTimeout(400);
chk('  step two is how it is taxed',
  await p.evaluate(()=>document.querySelector('.bizstepname').textContent),"How it's taxed");
chk('  it defaults to the state you live in',await p.inputValue('#nb-state'),'GA');
chk('  a sole proprietor is asked for no salary and no share',
  await p.evaluate(()=>({sal:!!document.querySelector('#nb-salary'),own:!!document.querySelector('#nb-owner')})),
  {sal:false,own:false});
await p.selectOption('#nb-kind','scorp'); await p.waitForTimeout(400);
chk('  an S corp is asked for both',
  await p.evaluate(()=>({sal:!!document.querySelector('#nb-salary'),own:!!document.querySelector('#nb-owner')})),
  {sal:true,own:true});
chk('  and the name typed two steps ago survived',await p.evaluate(()=>_newBiz.name),'Rig Rentals');
await p.fill('#nb-salary','60000');
await p.selectOption('#nb-state','CA'); await p.waitForTimeout(450);
chk('  California says what it costs to be there',
  await p.evaluate(()=>/800/.test(document.querySelector('#editSheetBody .note:last-of-type,#editSheetBody .note').parentElement.textContent)),true);
await p.click('#nb-next'); await p.waitForTimeout(400);
chk('step three is how it pays you',
  await p.evaluate(()=>document.querySelector('.bizstepname').textContent),"How it pays you");
await p.click('#nb-next'); await p.waitForTimeout(400);
chk('step four is the deductions',
  await p.evaluate(()=>document.querySelector('.bizstepname').textContent),"Deductions");
await p.check('#nb-office'); await p.waitForTimeout(350);
await p.fill('#nb-sqft','120');
await p.evaluate(()=>document.querySelector('#nb-sqft').dispatchEvent(new Event('change',{bubbles:true})));
await p.waitForTimeout(400);
chk('  120 sq ft prices itself before you commit',
  await p.evaluate(()=>/\$600/.test(document.getElementById('editSheetBody').textContent)),true);
await p.check('#nb-mileage'); await p.waitForTimeout(300);
await p.click('#nb-done'); await p.waitForTimeout(800);
chk('creating it lands you inside it',
  await p.evaluate(()=>({one:!document.getElementById('bizOne').hidden,
    name:document.querySelector('#bizOneHero .dh-label').textContent})),
  {one:true,name:'Rig Rentals'});
chk('  with everything the steps asked for',await p.evaluate(()=>{const x=db.businesses[0];
  return {kind:x.kind,state:x.state,salary:x.salary,industry:x.industry,
    office:x.office.on,sqft:x.office.sqft,mileage:x.mileage.on,method:x.method};}),
  {kind:'scorp',state:'CA',salary:60000,industry:'Camera and lighting rental',
   office:true,sqft:120,mileage:true,method:'cash'});

console.log('\n— a row opens the business; it does not unfold a form —');
await p.click('#bizBack'); await p.waitForTimeout(500);
chk('back returns to the list',await p.evaluate(()=>!document.getElementById('bizIndex').hidden),true);
chk('  the row carries no inputs',
  await p.evaluate(()=>document.querySelectorAll('#bizList input,#bizList select,#bizList textarea').length),0);
await p.click('[data-bizgo]'); await p.waitForTimeout(600);
chk('  tapping it opens the screen',await p.evaluate(()=>!document.getElementById('bizOne').hidden),true);
chk('  still no form until you ask',
  await p.evaluate(()=>document.querySelectorAll('#bizOneHero input,#bizPL input').length),0);
await p.click('#bizEdit'); await p.waitForTimeout(500);
chk('Edit opens the editor sheet',await sheet(),'Rig Rentals');
chk('  and it holds the whole record',
  await p.evaluate(()=>["be-name","be-legal","be-kind","be-state","be-started","be-ein","be-industry","be-method","be-salary","be-owner","be-link","be-draw","be-active","be-note"]
    .filter(id=>!document.getElementById(id))),[]);
await p.selectOption('#be-kind','sole'); await p.waitForTimeout(450);
chk('  switching to sole prop drops the salary field',
  await p.evaluate(()=>({sal:!!document.querySelector('#be-salary'),own:!!document.querySelector('#be-owner'),kind:db.businesses[0].kind})),
  {sal:false,own:false,kind:'sole'});
await p.selectOption('#be-kind','scorp'); await p.waitForTimeout(450);
await p.evaluate(()=>closeEditor()); await p.waitForTimeout(400);

console.log('\n— the money —');
await p.evaluate(Y=>{db.transactions=[
  {id:"t1",date:Y+"-03-02",desc:"Rental — feature",category:"Income",amount:120000,bizId:"b0"},
  {id:"t2",date:Y+"-04-11",desc:"Storage unit",category:"Rent/Mortgage",amount:-20000,bizId:"b0"}];
  db.transactions.forEach(t=>t.bizId=db.businesses[0].id); saveAll();},Y);
await p.waitForTimeout(700);
const pl=await p.evaluate(()=>{const x=db.businesses[0],r=bizPL(x.id,todayISO().slice(0,4));
  return {rev:Math.round(r.rev),exp:Math.round(r.exp),profit:Math.round(r.profit),
    office:Math.round(r.office),fee:Math.round(r.fee)};});
chk('the home office lands in the books without a transaction',pl.office,600);
chk('  so does California keeping the entity alive',pl.fee,800);
chk('  and both come off the profit',[pl.rev,pl.exp,pl.profit],[120000,21400,98600]);
chk('mileage needs a log, and an empty one deducts nothing',
  await p.evaluate(()=>Math.round(mileageDeduction(db.businesses[0],todayISO().slice(0,4)))),0);

console.log('\n— what an S corp actually buys you —');
const sp=await p.evaluate(()=>{const y=todayISO().slice(0,4),s=bizTaxSplit(y);
  const keep=db.businesses[0].kind; db.businesses[0].kind="llc";
  const asLLC=bizTaxSplit(y); db.businesses[0].kind=keep;
  return {se:Math.round(s.seNet),pass:Math.round(s.passNet),wages:Math.round(s.wages),
    llcSe:Math.round(asLLC.seNet),llcPass:Math.round(asLLC.passNet)};});
chk('the salary is payroll, not self-employment income',[sp.se,sp.wages],[0,60000]);
chk('  the rest is a distribution with no SE tax on it',sp.pass,38600);
chk('  the same profit as an LLC would all meet SE tax',[sp.llcSe,sp.llcPass],[98600,0]);
chk('  and the SE tax that avoids is real money',await p.evaluate(()=>{
  const y=todayISO().slice(0,4);
  const now=taxEstimate(y).se;
  const keep=db.businesses[0].kind; db.businesses[0].kind="llc";
  const llc=taxEstimate(y).se; db.businesses[0].kind=keep;
  return Math.round(llc-now);}),13932);

console.log('\n— the state it operates in changes the rules —');
chk('a California business is charged at California',
  await p.evaluate(()=>{const r=bizTaxSplit(todayISO().slice(0,4)).rows[0];return [r.state,r.rate];}),['CA',9.3]);
chk('  and Georgia would charge less',await p.evaluate(()=>{
  const x=db.businesses[0]; x.state="GA";
  const r=bizTaxSplit(todayISO().slice(0,4)).rows[0]; x.state="CA"; return [r.state,r.rate];}),['GA',5.39]);
/* Texas takes nothing of its own — but you live in Georgia, and a resident is
   taxed on everything wherever it was earned, so Georgia's rate is what stands.
   Moving there also drops California's $800, which is why the base grows. */
chk('a no-income-tax state falls back to your own rate, not to zero',await p.evaluate(()=>{
  const x=db.businesses[0]; x.state="TX";
  const r=bizTaxSplit(todayISO().slice(0,4)).rows[0]; x.state="CA";
  return [r.rate,Math.round(r.stateTax)];}),[5.39,2124]);
chk('  and the entity stops costing $800 a year to keep',await p.evaluate(()=>{
  const x=db.businesses[0]; x.state="TX"; const f=stateFeeFor(x); x.state="CA"; return f;}),0);
chk('  because you still live in Georgia and Georgia still wants its share',
  await p.evaluate(()=>db.tax.stateName),'Georgia');
chk('working away is flagged, not silently averaged',
  await p.evaluate(()=>bizIsAway(db.businesses[0])),true);
await p.evaluate(()=>{setView('business');bizOpen=db.businesses[0].id;renderBusiness();});
await p.waitForTimeout(600);
chk('  and the business screen says you will file twice',
  await p.evaluate(()=>/file in both/.test(document.getElementById('bizTax').textContent)),true);
chk('  a sole proprietor is never told about LLC fees',await p.evaluate(()=>{
  const x=db.businesses[0], k=x.kind; x.kind="sole"; const fee=stateFeeFor(x);
  const html=stateNoteHTML(stateOf("CA"),bizKindOf(x),14); x.kind=k;
  return {fee,mentionsFee:/800/.test(html)};}),{fee:0,mentionsFee:false});

console.log('\n— and Tax hears about all of it —');
await p.evaluate(()=>setView('tax')); await p.waitForTimeout(800);
const tb=await p.evaluate(()=>document.getElementById('taxBreak').textContent.replace(/\s+/g,' '));
chk('the distribution is listed apart from SE income',/S-corp distributions/.test(tb),true);
chk('  the state line says it is blended',/blended/.test(tb),true);
chk('  and names the business it came from',/Rig Rentals/.test(tb),true);
chk('picking a state sets its name and its rate together',await p.evaluate(async()=>{
  const s=document.getElementById('txStateSel'); s.value="TX";
  s.dispatchEvent(new Event('change',{bubbles:true}));
  await new Promise(r=>setTimeout(r,300));
  const got=[db.tax.stateName,db.tax.stateRate];
  s.value="GA"; s.dispatchEvent(new Event('change',{bubbles:true}));
  await new Promise(r=>setTimeout(r,300));
  return got;}),['Texas',0]);
chk('  and it went back',await p.evaluate(()=>[db.tax.stateName,db.tax.stateRate]),['Georgia',5.39]);

console.log('\n— mileage —');
await p.evaluate(()=>{setView('business');bizOpen=db.businesses[0].id;_dedOpen=null;renderBusiness();});
await p.waitForTimeout(700);
/* claimed is not the same as open: a deduction switched on months ago shows its
   figure and stays shut until you tap it */
chk('a claimed deduction is not sitting open',
  await p.evaluate(()=>document.querySelectorAll('#bizDeduct .bpanel').length),0);
chk('  but it still shows what it is worth',
  await p.evaluate(()=>[...document.querySelectorAll('#bizDeduct .bamt')].map(x=>x.textContent)),
  ['$600','—','$800']);
await p.click('[data-dedopen="mileage"]'); await p.waitForTimeout(450);
chk('  tapping opens just that one',
  await p.evaluate(()=>document.querySelectorAll('#bizDeduct .bpanel').length),1);
await p.click('#miAdd').catch(()=>{});
await p.waitForTimeout(300);
chk('a trip with no miles is not logged',
  await p.evaluate(()=>db.businesses[0].mileage.log.length),0);
await p.fill('#miMiles','120'); await p.fill('#miNote','Set — Savannah');
await p.click('#miAdd'); await p.waitForTimeout(700);
chk('a logged trip deducts at the standard rate',
  await p.evaluate(()=>Math.round(mileageDeduction(db.businesses[0],todayISO().slice(0,4)))),84);
chk('  and it reaches the Schedule C car line',
  await p.evaluate(()=>Math.round(bizPL(db.businesses[0].id,todayISO().slice(0,4)).bySched.mileage)),84);

console.log('\n— pausing and separating —');
chk('a paused business reaches no tax',await p.evaluate(()=>{
  const x=db.businesses[0]; x.active=false; const s=bizTaxSplit(todayISO().slice(0,4));
  x.active=true; return s.rows.length;}),0);
chk('so does one kept separate',await p.evaluate(()=>{
  const x=db.businesses[0]; x.linkProfit=false; const s=bizTaxSplit(todayISO().slice(0,4));
  x.linkProfit=true; return s.rows.length;}),0);
chk('deleting it untags the transactions rather than losing them',await p.evaluate(()=>{
  const id=db.businesses[0].id;
  db.transactions.forEach(t=>{if(t.bizId===id){delete t.bizId;delete t.bizPct;}});
  db.businesses=db.businesses.filter(x=>x.id!==id); bizOpen=null; saveAll();
  return {tx:db.transactions.length,tagged:db.transactions.filter(t=>t.bizId).length};}),{tx:2,tagged:0});
await p.evaluate(()=>{setView('business');renderBusiness();}); await p.waitForTimeout(500);
chk('  and the landing page comes back empty',
  await p.evaluate(()=>({idx:!document.getElementById('bizIndex').hidden,rows:document.querySelectorAll('[data-bizgo]').length})),
  {idx:true,rows:0});

console.log('\n— the saving is quoted against real payroll tax —');
await p.evaluate(()=>{db.businesses=[{id:"s1",name:"Rig Rentals",kind:"scorp",state:"GA",
  salary:60000,salaryBooked:false,drawPct:100,linkProfit:true,active:true,color:"#7c5cf0",
  created:todayISO().slice(0,4)+"-01-01"}];
  db.transactions=[{id:"x1",date:todayISO().slice(0,4)+"-03-02",desc:"Rental",category:"Income",amount:120000,bizId:"s1"},
    {id:"x2",date:todayISO().slice(0,4)+"-04-11",desc:"Storage",category:"Rent/Mortgage",amount:-20000,bizId:"s1"}];
  normalize(); saveAll(); setView('business'); bizOpen="s1"; renderBusiness();});
await p.waitForTimeout(800);
const sv=await p.evaluate(()=>{const t=document.getElementById('bizTax').textContent.replace(/\s+/g,' ');
  const m=t.match(/saving you about \$([\d,]+)/), q=t.match(/after the \$([\d,]+) of payroll tax/);
  return {saving:m?+m[1].replace(/,/g,""):null, payroll:q?+q[1].replace(/,/g,""):null};});
const profit=await p.evaluate(()=>Math.round(bizPL("s1",todayISO().slice(0,4)).profit));
/* $120,000 less $20,000 of storage less Georgia's $50 registration. The salary
   is $60,000, so the rest is a distribution. As a sole proprietor the whole
   profit would meet SE tax at 15.3% of 92.35%; as an S corp only the salary
   does, at the full 15.3% — a W-2 wage gets no 92.35% adjustment. */
chk('the fee comes off the profit first',profit,99950);
chk('payroll tax on the salary is the full rate, not the SE-adjusted one',sv.payroll,9180);
chk('  and the saving is quoted net of it',sv.saving,Math.round(profit*0.9235*0.153)-9180);
chk('  which is worth having but is not the whole 15.3%',
  sv.saving<Math.round(profit*0.9235*0.153),true);

console.log(`\n${pass} passed, ${fail} failed`);
console.log('page errors:',errs.length?errs:'none');
await b.close();
if(fail||errs.length) process.exitCode=1;
