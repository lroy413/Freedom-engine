import pkg from 'playwright';
const { chromium } = pkg;
const b = await chromium.launch();
const errs=[];
const ctx=await b.newContext({viewport:{width:1440,height:1400},timezoneId:'America/New_York'});
const p=await ctx.newPage();
p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(()=>{try{localStorage.clear();}catch(e){}});
await p.goto('http://localhost:8899/index.html'); await p.waitForTimeout(800);
console.log('TIMEZONE — 11pm Jul 29 in New York:');
console.log('  todayISO =', await p.evaluate(()=>todayISO()), '| raw UTC slice =', await p.evaluate(()=>new Date().toISOString().slice(0,10)));

await p.evaluate(()=>{
  db.income=[{id:"i1",name:"Ozark Law AC",type:"Production",model:"daily",rate:450,units:5,payFreq:"biweekly",firstPay:"2026-06-05",start:"2026-05-20",end:"2026-10-01",extras:[]},
             {id:"i2",name:"Roommate",type:"Other",model:"monthly",amount:350,payFreq:"weekly",firstPay:"2026-07-02",start:"2026-01-01",extras:[],notax:true}];
  db.paychecks=[
    {id:"p1",date:"2026-07-24",source:"Ozark Law (Lucky8 TV)",gross:5270,net:4080},
    {id:"p2",date:"2026-07-23",source:"Roommate",gross:350,net:350},
    {id:"p3",date:"2026-07-10",source:"Ozark Law (Lucky8 TV)",gross:5270,net:4080},
    {id:"p4",date:"2026-07-09",source:"Roommate",gross:350,net:350},
    {id:"p5",date:"2026-07-02",source:"Roommate",gross:350,net:350},
    {id:"p6",date:"2025-12-20",source:"Old gig",gross:900,net:760}];
  db.settings.taxEnabled=true; db.settings.taxRate=17;
  saveAll(); setView('income');});
await p.waitForTimeout(900);
console.log('\nNEXT PAYDAY card:', await p.evaluate(()=>{const k=[...document.querySelectorAll('#incomeKpis .kpi')].find(x=>/Next payday/i.test(x.textContent));
  return k.querySelector('.val').textContent+' — '+k.querySelector('.sub').textContent;}));
console.log('  (was "Jul 30 / today" when it should be Jul 29 or later)');
console.log('\nprojection box:', await p.evaluate(()=>{const b=document.getElementById('projBox');
  return {figureFirst:b.firstElementChild.className, text:b.textContent.trim().replace(/\s+/g,' ').slice(0,120)};}));
console.log('control row below:', await p.$$eval('.projctl .seg',e=>e.map(x=>x.textContent.trim())));
console.log('+ Stream button is by Your streams:', await p.evaluate(()=>{
  const st=[...document.querySelectorAll('.sectiontitle')].find(x=>/Your streams/.test(x.textContent));
  return !!(st&&st.querySelector('#addIncomeBtn'));}));

console.log('\nPAYCHECK ROWS:');
console.log(await p.$$eval('.paylist .brow',e=>e.map(x=>'  '+x.querySelector('.bname').textContent.trim().padEnd(24)+
  x.querySelector('.bmeta').textContent.padEnd(46)+x.querySelector('.bamt').textContent)));
console.log('  scroll container (6 > 5):', await p.evaluate(()=>{const s=document.querySelector('.paylist.scrollrows');
  return s?{h:Math.round(s.getBoundingClientRect().height),scrolls:s.scrollHeight>s.clientHeight}:'none';}));
console.log('  add form hidden at rest:', await p.evaluate(()=>document.getElementById('addPayPanel').style.display));
// edit
await p.click('[data-payopen="p1"]'); await p.waitForTimeout(500);
console.log('\n  editor fields:', await p.$$eval('.paylist .bpanel .field label',e=>e.map(l=>l.textContent)));
console.log('  withholding note:', await p.$eval('.paylist .bpanel .muted',e=>e.textContent.trim()));
await p.fill('[data-paynet="p1"]','4200'); await p.evaluate(()=>document.querySelector('[data-paynet="p1"]').dispatchEvent(new Event('change',{bubbles:true})));
await p.waitForTimeout(600);
console.log('  edited net ->', await p.evaluate(()=>db.paychecks.find(x=>x.id==='p1').net), '| stayed open:', await p.evaluate(()=>editPay==='p1'));
// duplicate
await p.click('[data-paydup="p1"]'); await p.waitForTimeout(700);
console.log('\n  duplicate (biweekly source -> +14 days):', await p.evaluate(()=>{
    const l=[...db.paychecks].sort((a,b)=>b.date.localeCompare(a.date));
    return {newest:l[0].date+' '+l[0].source+' net '+l[0].net, count:db.paychecks.length, opensEditor:editPay===l[0].id};}));
await p.click('[data-paydone]'); await p.waitForTimeout(400);
// add via button
await p.click('#showAddPaycheck'); await p.waitForTimeout(500);
console.log('\n  + Paycheck opens the form:', await p.evaluate(()=>document.getElementById('addPayPanel').style.display));
await p.fill('#pc-source','Concrete Films'); await p.fill('#pc-gross','2200'); await p.fill('#pc-net','1850');
await p.click('#pc-add'); await p.waitForTimeout(700);
console.log('  added + closed:', await p.evaluate(()=>({last:db.paychecks[db.paychecks.length-1].source,panel:document.getElementById('addPayPanel').style.display})));
// About pane no longer scrolls
await p.evaluate(()=>{setView('data');openSetting('about');}); await p.waitForTimeout(600);
console.log('\nABOUT pane:', await p.evaluate(()=>{const c=document.getElementById('aboutBox');
  return {scrollW:c.scrollWidth,clientW:c.clientWidth,overflows:c.scrollWidth>c.clientWidth+1,
    rows:[...c.querySelectorAll('.defrow')].map(r=>r.querySelector('.k').textContent+' = '+r.querySelector('.v').textContent)};}));
console.log('\nERRORS:',errs.length?errs:'none');
await b.close();
