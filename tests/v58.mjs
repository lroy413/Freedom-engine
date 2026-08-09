import pkg from 'playwright';
const { chromium } = pkg;
const b = await chromium.launch();
const errs=[];
const p=await b.newPage({viewport:{width:1440,height:1300}});
p.on('pageerror',e=>errs.push(e.message));
// existing saved data holding ANNUAL figures, as the old build stored them
await p.evaluate(()=>0).catch(()=>{});
await p.goto('http://localhost:8899/index.html'); await p.waitForTimeout(400);
await p.evaluate(()=>{localStorage.setItem('moneymachine_v1',JSON.stringify({version:2,
  categories:["Income","Uncategorized"],rules:[],budgets:{},recurring:[],transactions:[],income:[],debts:[],
  accounts:[],dividends:[],creditLog:[],paychecks:[],goal:{target:15000,deadline:"2026-09-21"},settings:{},
  holdings:[
    {id:"h1",name:"Realty Income",ticker:"O",shares:40,price:58,avgCost:55,divPerShare:3.168,divFreq:"monthly",lastDiv:"2026-07-15"},
    {id:"h2",name:"Schwab Div",ticker:"SCHD",shares:60,price:28.4,avgCost:26,divPerShare:1.098,divFreq:"quarterly",lastDiv:"2026-07-15"},
    {id:"h3",name:"Annual payer",ticker:"XYZ",shares:10,price:100,avgCost:90,divPerShare:2.00,divFreq:"annual",lastDiv:"2026-03-01"}]}));});
await p.reload(); await p.waitForTimeout(900);
console.log('MIGRATION — old annual figures converted to per-payment:');
console.log(await p.evaluate(()=>db.holdings.map(h=>
  '  '+h.ticker.padEnd(6)+divFreqOf(h).label.padEnd(12)+'perPayment='+h.divPerShare+
  '  ×'+divFreqN(h)+' = '+divAnnualPerShare(h).toFixed(3)+'/yr per share  basis='+h.divBasis).join('\n')));
console.log('\nmoney figures:');
console.log(await p.evaluate(()=>db.holdings.map(h=>
  '  '+h.ticker.padEnd(6)+'each payment '+fmt2(divPerPayment(h)).padEnd(10)+'annual '+fmt2(divAnnualFor(h))).join('\n')));
console.log('  total est annual:', await p.evaluate(()=>fmt2(estAnnualDiv())));
console.log('  (O: 40 sh × $0.264 × 12 = $126.72 · SCHD: 60 × $0.2745 × 4 = $65.88 · XYZ: 10 × $2 × 1 = $20)');
// reload again — must not double-convert
await p.reload(); await p.waitForTimeout(900);
console.log('\nafter a second load (no double conversion):', await p.evaluate(()=>db.holdings.map(h=>h.ticker+'='+h.divPerShare)));
// the editor
/* editHolding too: a holding opens read-only and the fields sit behind Edit */
await p.evaluate(()=>{setView('invest');expHolding="h1";editHolding="h1";renderInvest();}); await p.waitForTimeout(600);
console.log('\nfield label:', await p.$$eval('.hdetail .field label',e=>e.map(l=>l.textContent.trim())));
/* the breakdown lives only in the Projected dividends card now */
console.log('note:', await p.evaluate(()=>{divOpen=true;expDiv="h1";renderInvest();
  const n=document.querySelector('#divProjected .bpanel .note');
  expDiv=null;renderInvest();
  return n?n.textContent.trim().replace(/\s+/g,' '):'(none)';}));
// change frequency -> annual figure must move, per-payment must stay
await p.selectOption('[data-hfreq="h1"]','quarterly'); await p.waitForTimeout(600);
console.log('\nswitched O to quarterly:', await p.evaluate(()=>({perShare:db.holdings[0].divPerShare,
  annual:fmt2(divAnnualFor(db.holdings[0])), perPayment:fmt2(divPerPayment(db.holdings[0]))})));
console.log('  (per-share payment unchanged, annual drops from $126.72 to $42.24 — 4 payments not 12)');
await p.selectOption('[data-hfreq="h1"]','monthly'); await p.waitForTimeout(500);
// typed value
await p.fill('[data-hdiv="h1"]','0.27'); await p.evaluate(()=>document.querySelector('[data-hdiv="h1"]').dispatchEvent(new Event('change',{bubbles:true})));
await p.waitForTimeout(600);
console.log('\ntyping 0.27 per payment on a monthly payer:', await p.evaluate(()=>({stored:db.holdings[0].divPerShare,annual:fmt2(divAnnualFor(db.holdings[0]))})));
await p.evaluate(()=>{expHolding=null;renderInvest();}); await p.waitForTimeout(500);
console.log('\npayers table:');
console.log(await p.$$eval('#divProjected tr',rs=>rs.map(r=>'  '+[...r.children].map(c=>c.textContent.trim().replace(/\s+/g,' ')).join(' | ')).join('\n')));
console.log('\nupcoming:', await p.$$eval('#divUpcoming .upitem',e=>e.slice(0,4).map(x=>x.querySelector('.upname').textContent+' '+x.querySelector('.upamt').textContent)));
console.log('KPI:', await p.$$eval('#investKpis .kpi',e=>e.map(x=>x.querySelector('.label').textContent+'='+x.querySelector('.val').textContent)));
await p.screenshot({path:'/home/claude/div2.png',fullPage:true});
console.log('\nERRORS:',errs.length?errs:'none');
await b.close();
