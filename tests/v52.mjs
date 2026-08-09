import pkg from 'playwright';
const { chromium } = pkg;
const b = await chromium.launch();
const errs=[];
const p=await b.newPage({viewport:{width:1440,height:1300}});
p.on('pageerror',e=>errs.push(e.message));
// mock Alpha Vantage: O pays monthly, SCHD quarterly
await p.route(/alphavantage\.co/, r=>{
  const u=r.request().url();
  const sym=(u.match(/symbol=([A-Z]+)/)||[])[1]||'';
  if(/function=DIVIDENDS/.test(u)){
    const n=sym==='O'?12:sym==='SCHD'?4:0;
    const step=sym==='O'?1:3, amt=sym==='O'?0.264:0.2745;
    const data=Array.from({length:n},(_,i)=>{const d=new Date(2026,6,15);d.setMonth(d.getMonth()-i*step);
      return {ex_dividend_date:d.toISOString().slice(0,10),amount:String(amt)};});
    return r.fulfill({contentType:'application/json',body:JSON.stringify({symbol:sym,data})});
  }
  if(/function=OVERVIEW/.test(u))
    return r.fulfill({contentType:'application/json',body:JSON.stringify({Symbol:sym,Name:sym+" Corp",DividendPerShare:sym==='O'?"3.17":"1.10",DividendYield:"0.055"})});
  return r.fulfill({contentType:'application/json',body:JSON.stringify({"Global Quote":{"05. price":sym==='O'?"58.20":"28.40"}})});
});
await p.addInitScript(()=>{try{localStorage.clear();}catch(e){}});
await p.goto('http://localhost:8899/index.html'); await p.waitForTimeout(700);
await p.evaluate(()=>{
  db.settings.mdKey="TESTKEY"; db.settings.mdProvider="alphavantage";
  db.holdings=[{id:"h1",name:"Realty Income",ticker:"O",shares:40,price:58,avgCost:55,divPerShare:3.17,divFreq:"quarterly"},
               {id:"h2",name:"Schwab Dividend",ticker:"SCHD",shares:60,price:28.4,avgCost:26,divPerShare:1.10,divFreq:"quarterly"}];
  saveAll(); setView('invest');});
await p.waitForTimeout(600);
const table=async t=>console.log('\n'+t+'\n'+(await p.$$eval('#divProjected tr',rs=>rs.map(r=>[...r.children].map(c=>c.textContent.trim().replace(/\s+/g,' ')).join(' | ')).join('\n'))));
await table('BEFORE refresh (both defaulted to quarterly):');

// refresh O -> should detect monthly
await p.evaluate(()=>{expHolding="h1";renderInvest();}); await p.waitForTimeout(400);
await p.click('[data-href="h1"]'); await p.waitForTimeout(1200);
console.log('\nstatus:', await p.$eval('#quoteStatus',e=>e.textContent.trim()));
console.log('O stored:', await p.evaluate(()=>{const h=db.holdings[0];return {freq:h.divFreq,auto:h.divFreqAuto,last:h.lastDiv,dps:+h.divPerShare.toFixed(3)};}));
await p.evaluate(()=>{expHolding="h2";renderInvest();}); await p.waitForTimeout(400);
await p.click('[data-href="h2"]'); await p.waitForTimeout(1200);
console.log('SCHD stored:', await p.evaluate(()=>{const h=db.holdings[1];return {freq:h.divFreq,auto:h.divFreqAuto,last:h.lastDiv,dps:+h.divPerShare.toFixed(3)};}));
await p.evaluate(()=>{expHolding=null;renderInvest();}); await p.waitForTimeout(500);
await table('AFTER refresh (detected):');
console.log('\nupcoming 4 months:');
console.log(await p.$$eval('#divUpcoming .upitem',e=>e.map(x=>'  '+x.querySelector('.upname').textContent.padEnd(24)+x.querySelector('.upwhen').textContent.padEnd(24)+x.querySelector('.upamt').textContent).join('\n')));
// manual override
/* the editable fields live behind the Edit button now — a holding opens
   read-only, so the form has to be asked for before it can be driven */
await p.evaluate(()=>{expHolding="h2";editHolding="h2";renderInvest();}); await p.waitForTimeout(400);
await p.selectOption('[data-hfreq="h2"]','semiannual'); await p.waitForTimeout(500);
console.log('\nafter manual override to semiannual:', await p.evaluate(()=>({freq:db.holdings[1].divFreq,auto:db.holdings[1].divFreqAuto})));
/* the breakdown lives only in the Projected dividends card now */
await p.evaluate(()=>{divOpen=true;expDiv="h2";renderInvest();}); await p.waitForTimeout(400);
console.log('note:', await p.$eval('#divProjected .bpanel .note',e=>e.textContent.trim().replace(/\s+/g,' ')));
await p.evaluate(()=>{expHolding=null;renderInvest();}); await p.waitForTimeout(400);
await p.screenshot({path:'/home/claude/divfreq.png',fullPage:true});
console.log('\nERRORS:',errs.length?errs:'none');
await b.close();
