import pkg from 'playwright';
const {chromium}=pkg;
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:402,height:900}});
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8899/index.html'); await p.waitForTimeout(800);
await p.evaluate(()=>{
  const mk=monthOf(todayISO());
  db.accounts=[{id:"a1",name:"OnePay · Checking",kind:"checking",value:7025,parentId:null},
   {id:"a2",name:"Cash",kind:"cash",value:2400,parentId:null},{id:"a3",name:"OnePay · Savings",kind:"savings",value:51,parentId:null}];
  db.debts=[{id:"d1",name:"Chase",kind:"collection",balance:1900,start:1900,payments:[]},
   {id:"d2",name:"Mission One",kind:"collection",balance:1400,start:1400,payments:[]},
   {id:"d3",name:"Apple Card",kind:"card",balance:612,start:900,limit:2000,payments:[]},
   {id:"d4",name:"Milestone Card",kind:"card",balance:10,start:300,limit:700,payments:[]},
   {id:"d5",name:"Credit One Card",kind:"card",balance:8,start:400,limit:500,payments:[]}];
  db.holdings=[{id:"h1",name:"SCHD",ticker:"SCHD",shares:14.315307,price:33.46,avgCost:30},
   {id:"h2",name:"NViDiA",ticker:"NVDA",shares:2.007034,price:197.10,avgCost:150},
   {id:"h3",name:"VOO",ticker:"VOO",shares:0.547162,price:680.95,avgCost:600},
   {id:"h4",name:"AbbVie",ticker:"ABBV",shares:1.398687,price:259.24,avgCost:200},
   {id:"h5",name:"Apple",ticker:"AAPL",shares:1.03,price:340.09,avgCost:300},
   {id:"h6",name:"SpaceX",ticker:"SPCX",shares:1,price:116.80,avgCost:100},
   {id:"h7",name:"Rivian Auto",ticker:"RIVN",shares:2,price:16.68,avgCost:20}];
  db.transactions=[
   {id:"t1",date:mk+"-02",desc:"Rent",category:"Rent/Mortgage",amount:-1525,acct:"a1"},
   {id:"t2",date:mk+"-05",desc:"Geico",category:"Insurance",amount:-169,acct:"a1"},
   {id:"t3",date:mk+"-07",desc:"Verizon",category:"Phone",amount:-140,acct:"a1"},
   {id:"t4",date:mk+"-08",desc:"Kroger",category:"Food",amount:-310,acct:"a1"},
   {id:"t5",date:mk+"-09",desc:"Shell",category:"Auto & Gas",amount:-95,acct:"a1"},
   {id:"t6",date:mk+"-10",desc:"Netflix",category:"Subscriptions",amount:-46,acct:"a1"},
   {id:"t7",date:mk+"-11",desc:"CVS",category:"Health",amount:-38,acct:"a1"},
   {id:"t8",date:mk+"-12",desc:"Target",category:"Shopping",amount:-27,acct:"a1"}];
  saveAll(); setView('dash');});
await p.waitForTimeout(800);

console.log('— HEADER —');
console.log(await p.evaluate(()=>({stuck:document.getElementById('topbar').classList.contains('stuck'),
  word:getComputedStyle(document.getElementById('brandWord')).opacity,
  view:getComputedStyle(document.getElementById('viewTitle')).opacity,
  viewText:document.getElementById('viewTitle').textContent,
  menuBtn:(()=>{const r=document.getElementById('menuBtn').getBoundingClientRect();return Math.round(r.width)+'x'+Math.round(r.height);})(),
  brandFont:getComputedStyle(document.querySelector('.brand')).fontSize})));
await p.evaluate(()=>window.scrollTo(0,400)); await p.waitForTimeout(400);
console.log('after scroll:', await p.evaluate(()=>({stuck:document.getElementById('topbar').classList.contains('stuck'),
  word:getComputedStyle(document.getElementById('brandWord')).opacity,
  view:getComputedStyle(document.getElementById('viewTitle')).opacity})));
await p.evaluate(()=>window.scrollTo(0,0)); await p.waitForTimeout(400);
console.log('back to top stuck:', await p.evaluate(()=>document.getElementById('topbar').classList.contains('stuck')));
console.log('month label gone:', await p.evaluate(()=>{
  const f=document.getElementById('monthSel').closest('.field');
  return getComputedStyle(f.querySelector('label')).display==='none';}));

console.log('\n— DONUT —');
console.log(await p.evaluate(()=>({
  slices:[...document.querySelectorAll('.dslice')].length,
  centre:document.querySelector('.dcval').textContent+' / '+document.querySelector('.dclab').textContent,
  legend:[...document.querySelectorAll('.dlrow')].map(r=>r.querySelector('.dlname').textContent.trim()+' '+
    r.querySelector('.dlpct').textContent+' '+r.querySelector('.dlamt').textContent)})));
console.log('  (8 categories -> 5 named + Other with 3 folded; total 2350)');
console.log('hit test (is the row actually clickable where it sits?):', await p.evaluate(()=>{
  const r=document.querySelector('.dlrow[data-slice="Rent/Mortgage"]').getBoundingClientRect();
  const el=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
  return el?el.className+'|'+(el.closest('.dlrow')?'reaches row':'BLOCKED'):'offscreen';}));
await p.evaluate(()=>document.querySelector('.dlrow[data-slice="Rent/Mortgage"]').click()); await p.waitForTimeout(400);
console.log('after selecting Rent:', await p.evaluate(()=>({
  centre:document.querySelector('.dcval').textContent+' / '+document.querySelector('.dclab').textContent,
  dimmed:[...document.querySelectorAll('.dslice')].filter(x=>!x.classList.contains('on')).length,
  rowOn:document.querySelector('.dlrow.on').textContent.trim().slice(0,20)})));
await p.evaluate(()=>document.querySelector('.dlrow[data-slice="Rent/Mortgage"]').click()); await p.waitForTimeout(400);
console.log('deselect returns total:', await p.$eval('.dcval',e=>e.textContent));
console.log('colours in band:', await p.evaluate(()=>[...document.querySelectorAll('.dlsw')].map(s=>getComputedStyle(s).backgroundColor)));

console.log('\n— SECTIONS —');
console.log('all open:', await p.$$eval('[data-sect]',e=>e.map(x=>x.dataset.sect+':'+(x.classList.contains('shut')?'shut':'open'))));
await p.evaluate(()=>document.querySelector('[data-sect="recent"]').click()); await p.waitForTimeout(400);
console.log('after collapsing recent:', await p.evaluate(()=>({
  shut:document.querySelector('[data-sect="recent"]').classList.contains('shut'),
  bodyHidden:document.querySelector('[data-sectbody="recent"]').hidden,
  saved:db.settings.dashShut})));
await p.reload(); await p.waitForTimeout(900);
console.log('survives reload:', await p.evaluate(()=>({
  shut:document.querySelector('[data-sect="recent"]').classList.contains('shut'),
  bodyHidden:document.querySelector('[data-sectbody="recent"]').hidden})));

console.log('\n— NET WORTH LISTS —');
await p.evaluate(()=>openNW()); await p.waitForTimeout(700);
console.log('collapsed banners:', await p.$$eval('.nwhead',e=>e.map(x=>x.textContent.trim().replace(/\s+/g,' '))));
console.log('rows hidden:', await p.evaluate(()=>[...document.querySelectorAll('#nwSheetBody .deflist')].map(d=>d.hidden)));
await p.evaluate(()=>document.querySelector('[data-nwlist="assets"]').click()); await p.waitForTimeout(400);
console.log('assets open:', await p.evaluate(()=>{const d=document.querySelector('#nwSheetBody .deflist');
  return {hidden:d.hidden,rows:d.querySelectorAll('.defrow').length,scrolls:d.classList.contains('scrollrows'),
    h:Math.round(d.getBoundingClientRect().height)};}));
const sheetH=await p.evaluate(()=>Math.round(document.getElementById('nwSheetBody').scrollHeight));
console.log('sheet body scroll height:',sheetH);
console.log('\nerrors:',errs.length?errs:'none');
await b.close();
