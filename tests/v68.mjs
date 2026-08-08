import pkg from 'playwright';
const {chromium}=pkg;
const b=await chromium.launch();
for(const W of [1440,402]){
const p=await b.newPage({viewport:{width:W,height:W===402?874:1300},deviceScaleFactor:2});
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8899/index.html'); await p.waitForTimeout(700);
await p.evaluate(()=>{
  db.accounts=[{id:"i1",name:"Chase",kind:"bank",value:0,parentId:null},
    {id:"a1",name:"Checking",kind:"checking",value:4200,parentId:"i1"},
    {id:"a2",name:"Savings",kind:"savings",value:9000,parentId:"i1"},
    {id:"c1",name:"Visa",kind:"credit",value:1450,parentId:"i1",limit:5000,debtId:"d1"},
    {id:"w1",name:"Cash App",kind:"digital",value:310,parentId:null}];
  db.debts=[{id:"d1",name:"Visa",kind:"card",balance:1450,start:5000,limit:5000,apr:24,payment:120,payments:[]},
    {id:"d2",name:"Auto loan",kind:"auto",balance:14200,start:24000,apr:6.9,payment:420,payments:[]},
    {id:"d3",name:"Old medical",kind:"collection",balance:640,start:640,payments:[]}];
  db.holdings=[{id:"h1",name:"Realty Income",ticker:"O",shares:40,price:58,avgCost:52,divPerShare:0.264,divFreq:"monthly",divBasis:"payment"},
    {id:"h2",name:"Schwab Dividend",ticker:"SCHD",shares:60,price:28.4,avgCost:26,divPerShare:0.2745,divFreq:"quarterly",divBasis:"payment"}];
  db.snapshots=[{m:"2026-04",cash:2100,invest:900,debt:19000,net:-16000,manual:true},
    {m:"2026-05",cash:3000,invest:1800,debt:17800,net:-13000,manual:true},
    {m:"2026-06",cash:5200,invest:2000,debt:16800,net:-9600,manual:true}];
  db.goals=[{id:"g1",name:"Out of the red",kind:"networth",target:0,deadline:"2027-01-31",created:"2026-07-01",link:[],contribs:[],done:false},
    {id:"g2",name:"First $100k",kind:"networth",target:100000,deadline:"",created:"2026-07-01",link:[],contribs:[],done:false}];
  saveAll(); setView('dash');});
await p.waitForTimeout(700);

if(W===1440){
  console.log('— HERO —');
  console.log(await p.evaluate(()=>{const h=document.querySelector('.dashhero');
    return {tappable:!!h.querySelector('[data-nwopen]'), val:h.querySelector('.dh-val').textContent,
      more:h.querySelector('.dh-more').textContent.trim(),
      goalLabel:h.querySelector('.dh-goal .k')?h.querySelector('.dh-goal .k').textContent:null};}));
}
await p.click('[data-nwopen]'); await p.waitForTimeout(600);
if(W===1440){
  console.log('\n— SHEET —');
  console.log('title:', await p.$eval('#nwSheetVal',e=>e.textContent));
  console.log('body locked:', await p.evaluate(()=>document.body.classList.contains('sheetopen')));
  console.log('milestone:', await p.evaluate(()=>{const b=document.getElementById('nwSheetBody');
    const w=b.querySelector('.gbarwrap'); return w?w.textContent.trim().replace(/\s+/g,' '):null;}));
  console.log('sections:', await p.$$eval('#nwSheetBody .nwsec',e=>e.map(x=>x.textContent.trim().replace(/\s+/g,' '))));
  console.log('moved:', await p.$$eval('#nwSheetBody .nwmove',e=>e.map(x=>x.textContent.trim().replace(/\s+/g,' '))));
  console.log('assets:', await p.evaluate(()=>{const secs=[...document.querySelectorAll('#nwSheetBody .deflist')];
    return secs.map(d=>[...d.querySelectorAll('.defrow')].map(r=>r.querySelector('.k').textContent.replace(/\s+/g,' ')+' = '+r.querySelector('.v').textContent));}));
  console.log('\nmaths:', await p.evaluate(()=>{const P=nwParts();
    return {A:P.A,L:P.L,net:P.net,netWorthFn:netWorth(),assetCount:P.assets.length,liabCount:P.liabs.length};}));
  console.log('  (4200+9000+310 cash + 2320+1704 invest = 17534 assets; 1450+14200+640 = 16290 owed; net 1244)');
  console.log('  (Visa is mirrored account->debt, must appear once)');
  console.log('\nhistory form hidden by default:', await p.evaluate(()=>document.getElementById('hsForm').hidden));
  await p.click('#hsFormBtn'); await p.waitForTimeout(350);
  console.log('after button:', await p.evaluate(()=>({hidden:document.getElementById('hsForm').hidden,
    label:document.getElementById('hsFormBtn').textContent})));
  await p.fill('#hs-month','2026-03'); await p.fill('#hs-cash','1500'); await p.fill('#hs-inv','400'); await p.fill('#hs-debt','20000');
  await p.click('#hs-add'); await p.waitForTimeout(500);
  console.log('added:', await p.evaluate(()=>db.snapshots.map(s=>s.m)));
  console.log('rows:', await p.$$eval('#hsList .brow .bname',e=>e.map(x=>x.textContent.trim().replace(/\s+/g,' '))));
  await p.click('.sheetx'); await p.waitForTimeout(400);
  console.log('closed:', await p.evaluate(()=>({hidden:document.getElementById('nwSheet').hidden,
    locked:document.body.classList.contains('sheetopen')})));
  await p.click('[data-nwopen]'); await p.waitForTimeout(400);
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  console.log('escape closes:', await p.evaluate(()=>document.getElementById('nwSheet').hidden));
  await p.click('[data-nwopen]'); await p.waitForTimeout(500);
}
const clip=await p.evaluate(()=>{const out=[];const vw=innerWidth;
  document.querySelectorAll('#nwSheet *').forEach(n=>{const r=n.getBoundingClientRect();
    if(r.width&&r.right>vw+1)out.push(n.tagName.toLowerCase()+'.'+(n.className||'')+' r='+Math.round(r.right));});
  return {vw,over:out.slice(0,6)};});
console.log(`\n${W}px sheet overflow:`, clip.over.length?clip.over:'none');
await p.screenshot({path:`/home/claude/shot-nw-${W}.png`,fullPage:false});
await p.evaluate(()=>{closeNW();setView('goals');}); await p.waitForTimeout(600);
await p.screenshot({path:`/home/claude/shot-goals-${W}.png`,fullPage:W===1440});
console.log(`${W}px errors:`, errs.length?errs:'none');
await p.close();}
await b.close();
