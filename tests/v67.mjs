import pkg from 'playwright';
const {chromium}=pkg;
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1440,height:1300}});
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8899/index.html'); await p.waitForTimeout(800);
await p.evaluate(()=>{
  db.accounts=[{id:"i1",name:"Chase",kind:"bank",value:0,parentId:null},
    {id:"a1",name:"Checking",kind:"checking",value:4200,parentId:"i1"},
    {id:"a2",name:"Savings",kind:"savings",value:9000,parentId:"i1"},
    {id:"c1",name:"Visa",kind:"credit",value:1450,parentId:"i1",limit:5000}];
  db.debts=[{id:"d1",name:"Visa",kind:"card",balance:1450,start:5000,limit:5000,apr:24,payment:120,payments:[]},
    {id:"d2",name:"Auto loan",kind:"auto",balance:14200,start:24000,apr:6.9,payment:420,payments:[]}];
  db.income=[{id:"s1",name:"Gig work",model:"monthly",amount:2600,payFreq:"monthly",firstPay:"2026-08-07"},
    {id:"s2",name:"Roommate rent",model:"monthly",amount:900,payFreq:"monthly",notax:true,passive:true,firstPay:"2026-08-01"}];
  db.recurring=[{id:"r1",name:"Rent",category:"Rent/Mortgage",amount:1650,dueDay:1,tier:"essential"},
    {id:"r2",name:"Power",category:"Electric",amount:140,dueDay:5,tier:"essential"},
    {id:"r3",name:"Netflix",category:"Subscriptions",amount:23,dueDay:8,tier:"luxury"},
    {id:"r4",name:"Insurance",category:"Insurance",amount:180,dueDay:15,tier:"essential"}];
  db.budgets={"Food":500,"Auto & Gas":180};
  db.holdings=[{id:"h1",name:"Realty Income",ticker:"O",shares:40,price:58,avgCost:52,divPerShare:0.264,divFreq:"monthly",divBasis:"payment"}];
  db.snapshots=[{m:"2026-05",cash:3000,invest:1800,debt:17000,net:-12200,manual:true},
    {m:"2026-06",cash:5200,invest:2000,debt:16200,net:-9000,manual:true}];
  saveAll(); setView('goals');});
await p.waitForTimeout(700);

console.log('— FREEDOM CARD —');
console.log(await p.evaluate(()=>{const c=document.getElementById('freedomCard');
  return {big:c.querySelector('.frbig').textContent, sub:c.querySelector('.frsub').textContent.trim().replace(/\s+/g,' '),
    tiers:[...c.querySelectorAll('.frtier')].map(t=>t.querySelector('.frname').textContent.trim()+' '+
      t.querySelector('.frpct').textContent+' · '+(t.querySelector('.frgap')||{textContent:'—'}).textContent)};}));
console.log('maths check:', await p.evaluate(()=>{const st=freedomState();
  return {passive:+st.passive.total.toFixed(2), fromDiv:+st.passive.fromDiv.toFixed(2), fromStreams:st.passive.fromStreams,
    need:{survive:st.need.survive,maintain:st.need.maintain,thrive:st.need.thrive}, nextTier:st.next.key};}));
console.log('  (rent 1650 + power 140 + insurance 180 = 1970 survive; +23 netflix = 1993 maintain; +680 budgets = 2673 thrive)');
console.log('  (passive = 900 rent + 40×0.264 = 10.56/mo dividends = 910.56)');

await p.click('[data-frtier="survive"]'); await p.waitForTimeout(400);
console.log('\nsurvive panel:', await p.evaluate(()=>{const c=document.getElementById('freedomCard');
  return {rows:[...c.querySelectorAll('.frpanel .deflist .defrow')].map(r=>r.querySelector('.k').textContent+'='+r.querySelector('.v').textContent),
    capital:c.querySelector('.frcapval')?c.querySelector('.frcapval').textContent:null,
    sources:[...c.querySelectorAll('.frwhere .defrow')].map(r=>r.querySelector('.k').textContent+'='+r.querySelector('.v').textContent)};}));
console.log('  (gap 1059.44 × 12 ÷ 4% = $318k)');
await p.fill('#frYield','8'); await p.dispatchEvent('#frYield','change'); await p.waitForTimeout(400);
console.log('at 8% yield:', await p.$eval('.frcapval',e=>e.textContent));

console.log('\n— ADDING GOALS —');
await p.click('#showAddGoal'); await p.waitForTimeout(300);
console.log('kinds:', await p.$$eval('#ngKind option',e=>e.map(o=>o.textContent)));
for(const [kind,name,target,dl] of [
  ['cash','Emergency fund','10000','2027-06-30'],
  ['networth','First $100k','100000',''],
  ['invest','Portfolio to 50k','50000','2029-12-31'],
  ['debt','','0',''],
  ['income','$2k passive','2000',''],
  ['custom','New camera body','3200','2026-12-01']]){
  if(!await p.$('#ngKind')){ await p.click('#showAddGoal'); await p.waitForTimeout(250); }
  await p.selectOption('#ngKind',kind); await p.waitForTimeout(300);
  if(kind==='debt'){ console.log('  debt picker:', await p.$$eval('#ngDebt option',e=>e.map(o=>o.textContent)));
    console.log('  auto name  :', await p.$eval('#ngName',e=>e.placeholder));
    await p.selectOption('#ngDebt', await p.$$eval('#ngDebt option',e=>e[1]?e[1].value:e[0].value)); await p.waitForTimeout(200);
    console.log('  after pick :', await p.$eval('#ngName',e=>e.placeholder)); }
  if(name) await p.fill('#ngName',name);
  if(kind!=='debt') await p.fill('#ngTarget',target||'1');
  if(dl) await p.fill('#ngDl',dl);
  await p.click('#ngAdd'); await p.waitForTimeout(350);
}
console.log('goal rows:', await p.$$eval('#goalsList .brow',e=>e.map(x=>
  x.querySelector('.gring span').textContent.padStart(3)+'% | '+
  x.querySelector('.bname').textContent.padEnd(20)+'| '+x.querySelector('.bmeta').textContent.trim().replace(/\s+/g,' '))));
console.log('\ncomputed:', await p.evaluate(()=>db.goals.map(g=>({n:g.name,k:g.kind,now:Math.round(goalNow(g)),
  t:num(g.target),pct:Math.round(goalPct(g)),left:Math.round(goalLeft(g))}))));

console.log('\n— PACE / MILESTONE —');
await p.click('[data-goalopen]'); await p.waitForTimeout(400);
console.log('first panel:', await p.evaluate(()=>{const pa=document.querySelector('#goalsList .bpanel');
  return {nums:[...pa.querySelectorAll('.gbarnums span')].map(s=>s.textContent),
    next:pa.querySelector('.gnext')?pa.querySelector('.gnext').textContent.trim().replace(/\s+/g,' '):null,
    note:pa.querySelector('.note').textContent.trim().replace(/\s+/g,' '),
    fields:[...pa.querySelectorAll('.field label')].map(l=>l.textContent.trim().replace(/\s+/g,' '))};}));

console.log('\n— CUSTOM GOAL DEPOSITS —');
await p.evaluate(()=>{openGoal=null;logGoal=db.goals.find(g=>g.kind==='custom').id;renderGoalsList();});
await p.waitForTimeout(300);
await p.fill('#gcAmt','800'); await p.fill('#gcNote','tax refund'); await p.click('#gcAdd'); await p.waitForTimeout(400);
await p.fill('#gcAmt','450'); await p.click('#gcAdd'); await p.waitForTimeout(400);
console.log(await p.evaluate(()=>{const g=db.goals.find(x=>x.kind==='custom');
  return {contribs:g.contribs.length,total:contribTotal(g),pct:Math.round(goalPct(g)),left:goalLeft(g)};}));

console.log('\n— REACHED FLOW —');
await p.evaluate(()=>{const g=db.goals.find(x=>x.kind==='custom'); g.contribs.push({id:uid(),date:todayISO(),amount:2000,note:''}); logGoal=null; saveAll();});
await p.waitForTimeout(400);
console.log('reached badge:', await p.evaluate(()=>{const g=db.goals.find(x=>x.kind==='custom');
  const row=[...document.querySelectorAll('#goalsList .brow')].find(r=>r.textContent.includes('camera'));
  return {reached:goalReached(g),hasDoneBtn:!!row.querySelector('[data-goaldone]')};}));
await p.click('[data-goaldone]'); await p.waitForTimeout(500);
console.log('after Done:', await p.evaluate(()=>({active:goalsActive().length,done:goalsDone().length,
  wrapShown:!document.getElementById('doneGoalsWrap').hidden,
  label:document.getElementById('doneLabel').textContent.trim().replace(/\s+/g,' ')})));
await p.click('#doneToggle'); await p.waitForTimeout(300);
console.log('done list:', await p.$$eval('#doneBody .bname',e=>e.map(x=>x.textContent)));

console.log('\n— SORTING —');
for(const v of ['pct','deadline','size','added']){
  await p.selectOption('#goalSort',v); await p.waitForTimeout(300);
  console.log(' ',v.padEnd(9),(await p.$$eval('#goalsList .bname',e=>e.map(x=>x.textContent))).join(' | '));
}
console.log('\nerrors:', errs.length?errs:'none');
await b.close();
