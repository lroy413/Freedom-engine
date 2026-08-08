import pkg from 'playwright';
const {chromium}=pkg;
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1200,height:900}});
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8899/index.html'); await p.waitForTimeout(900);
await p.evaluate(()=>{
  db.settings.mdKey="TESTKEY"; db.settings.mdProvider="alphavantage";
  db.holdings=["AAPL","VOO","ABBV","NVDA","SPCX","SCHD","ORC"].map((t,i)=>({id:"h"+i,name:t,ticker:t,shares:1,price:10,avgCost:10}));
  saveAll(); setView('invest');
  // simulate: AV answers once then rate-limits; Yahoo knows most tickers, not SPCX
  window._calls={av:0,yahoo:0,div:0,sched:0};
  window.jget=async url=>{
    if(/alphavantage/.test(url)){
      if(/GLOBAL_QUOTE/.test(url)){ _calls.av++;
        if(_calls.av===1) return {"Global Quote":{"05. price":"313.33"}};
        return {Note:"rate limited"}; }
      if(/OVERVIEW/.test(url)){ _calls.div++; return {Symbol:"X",DividendPerShare:"1.0",DividendYield:"0.02",Name:"X"}; }
      if(/DIVIDENDS/.test(url)){ _calls.sched++; return {data:[]}; }
    }
    if(/yahoo/.test(url)){ _calls.yahoo++;
      const t=url.match(/chart\/([A-Z.]+)\?/)[1];
      if(t==="SPCX") return {chart:{result:[{meta:{}}]}};
      return {chart:{result:[{meta:{regularMarketPrice:100+_calls.yahoo}}]}}; }
    throw new Error("blocked "+url);
  };});
await p.waitForTimeout(400);
await p.evaluate(()=>document.getElementById('refreshAllBtn').click());
await p.waitForTimeout(6000);
console.log('status:', await p.evaluate(()=>document.getElementById('quoteStatus').textContent.trim().replace(/\s+/g,' ')));
console.log('calls:', await p.evaluate(()=>window._calls));
console.log('prices:', await p.evaluate(()=>db.holdings.map(h=>h.ticker+'='+h.price)));
console.log('  expect: AAPL via AV (313.33), 5 more via Yahoo fallback, SPCX failed — 6 of 7');
console.log('  AV quote calls should be 2 (first ok, second trips cap, rest skip); div calls gated weekly:');
console.log('divChecked set:', await p.evaluate(()=>db.holdings.filter(h=>h.divChecked).length));
// second run same session: AV skipped entirely (capped), Yahoo serves
await p.evaluate(()=>document.getElementById('refreshAllBtn').click());
await p.waitForTimeout(6000);
console.log('second run status:', await p.evaluate(()=>document.getElementById('quoteStatus').textContent.trim().replace(/\s+/g,' ')));
console.log('AV calls after 2nd run (should still be 2):', await p.evaluate(()=>window._calls.av));
console.log('div calls after 2nd run (should stay 6 — weekly gate):', await p.evaluate(()=>({div:window._calls.div,sched:window._calls.sched})));
console.log('errors:', errs.length?errs:'none');
await b.close();
