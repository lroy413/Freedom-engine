import pkg from 'playwright';
const { chromium } = pkg;
const b = await chromium.launch();
const errs=[];
const p=await b.newPage({viewport:{width:1440,height:1400}});
p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(()=>{try{localStorage.clear();}catch(e){}});
await p.goto('http://localhost:8899/index.html'); await p.waitForTimeout(800);
await p.evaluate(()=>{db.holdings=[
  {id:"h1",name:"Realty Income",ticker:"O",shares:40,price:58,avgCost:52,divPerShare:0.264,divFreq:"monthly",divFreqAuto:true,lastDiv:"2026-07-15",divBasis:"payment"},
  {id:"h2",name:"Schwab Div",ticker:"SCHD",shares:60,price:28.4,avgCost:26,divPerShare:0.2745,divFreq:"quarterly",divFreqAuto:true,lastDiv:"2026-07-15",divBasis:"payment"},
  {id:"h3",name:"Growth fund",ticker:"QQQ",shares:5,price:480,avgCost:440,divPerShare:0,divFreq:"quarterly",divBasis:"payment"}];
  saveAll(); setView('invest');});
await p.waitForTimeout(700);
console.log('BANNER:', await p.evaluate(()=>{const h=document.getElementById('divToggle');
  return h.textContent.trim().replace(/\s+/g,' ');}));
console.log('open by default:', await p.evaluate(()=>!document.getElementById('divBody').hidden));
console.log('rows:', await p.$$eval('#divProjected .brow',e=>e.map(x=>
  x.querySelector('.bname').textContent.trim().replace(/\s+/g,' ').padEnd(16)+'| '+
  x.querySelector('.bmeta').textContent.padEnd(46)+'| '+x.querySelector('.dbal').textContent)));
console.log('  (QQQ pays nothing so it is not listed)');
// collapse (list ships collapsed, so expand first to measure the open state)
await p.click('#divToggle'); await p.waitForTimeout(400);
console.log('after 1st toggle open:', await p.evaluate(()=>!document.getElementById('divBody').hidden));
await p.click('#divToggle'); await p.waitForTimeout(400);
console.log('\ncollapsed:', await p.evaluate(()=>({hidden:document.getElementById('divBody').hidden,
  cardH:Math.round(document.getElementById('divProjected').getBoundingClientRect().height),
  banner:document.getElementById('divToggle').textContent.trim().replace(/\s+/g,' ')})));
await p.click('#divToggle'); await p.waitForTimeout(400);
console.log('expanded height:', await p.evaluate(()=>Math.round(document.getElementById('divProjected').getBoundingClientRect().height)));
// open a holding's dividend card
await p.click('[data-divopen="h1"]'); await p.waitForTimeout(500);
console.log('\nO dividend card:');
console.log('  stats:', await p.$$eval('#divProjected .bpanel .hstat',e=>e.map(x=>x.querySelector('.k').textContent+'='+x.querySelector('.v').textContent)));
console.log('  fields:', await p.$$eval('#divProjected .bpanel .field label',e=>e.map(l=>l.textContent.trim().replace(/\s+/g,' '))));
console.log('  note:', await p.$eval('#divProjected .bpanel .note',e=>e.textContent.trim().replace(/\s+/g,' ')));
console.log('  (yield now = 0.264×12 ÷ 58 = 5.46% · on cost ÷52 = 6.09%)');
// edit through the dividend-only card
await p.fill('[data-xdiv="h1"]','0.27'); await p.evaluate(()=>document.querySelector('[data-xdiv="h1"]').dispatchEvent(new Event('change',{bubbles:true})));
await p.waitForTimeout(600);
console.log('\nafter typing 0.27:', await p.evaluate(()=>({stored:db.holdings[0].divPerShare,
  annual:fmt2(divAnnualFor(db.holdings[0])), stillOpen:!!document.querySelector('#divProjected .bpanel')})));
await p.selectOption('[data-xfreq="h1"]','quarterly'); await p.waitForTimeout(600);
console.log('freq -> quarterly:', await p.evaluate(()=>({freq:db.holdings[0].divFreq,auto:db.holdings[0].divFreqAuto,annual:fmt2(divAnnualFor(db.holdings[0]))})));
await p.selectOption('[data-xfreq="h1"]','monthly'); await p.waitForTimeout(500);
await p.fill('[data-xlast="h1"]','2026-07-20'); await p.evaluate(()=>document.querySelector('[data-xlast="h1"]').dispatchEvent(new Event('change',{bubbles:true})));
await p.waitForTimeout(600);
console.log('last payment ->', await p.evaluate(()=>({stored:db.holdings[0].lastDiv,next:nextDivDate(db.holdings[0])})));
// only one open at a time
await p.click('[data-divopen="h2"]'); await p.waitForTimeout(500);
console.log('\nopening SCHD closes O:', await p.evaluate(()=>document.querySelectorAll('#divProjected .bpanel').length));
await p.click('[data-xdone]'); await p.waitForTimeout(400);
console.log('done closes it:', await p.evaluate(()=>document.querySelectorAll('#divProjected .bpanel').length));
// holdings list unaffected
await p.click('#holdingTable .hrow'); await p.waitForTimeout(500);
console.log('\nholdings list still opens independently:', await p.evaluate(()=>({
  holdingPanels:document.querySelectorAll('.hdetail').length, divPanels:document.querySelectorAll('#divProjected .bpanel').length})));
await p.evaluate(()=>{expHolding=null;renderInvest();}); await p.waitForTimeout(400);
await p.screenshot({path:'/home/claude/div3.png',fullPage:true});
console.log('\nERRORS:',errs.length?errs:'none');
await b.close();
