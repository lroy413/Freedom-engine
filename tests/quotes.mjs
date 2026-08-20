/* Refreshing prices against a free API key that really does run out.

   The bug this exists for: nine holdings came back "Updated 1 of 9 — couldn't
   price VOO, ABBV, NVDA…". Not a bad symbol between them. The refresh was
   spending three Alpha Vantage calls per holding (quote, then OVERVIEW, then
   DIVIDENDS) against a free tier of 25 a day, so the budget was gone partway
   down the list — and the keyless sources behind the key are CORS-blocked in a
   browser, so there was nothing to catch the fall.

   The mock below enforces the real limit: 25 calls, then the rate-limit reply. */
import pkg from 'playwright';
const { chromium } = pkg;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 402, height: 900 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://localhost:8899/index.html'); await p.waitForTimeout(900);
let pass = 0, fail = 0;
const chk = (n, g, w) => { const ok = JSON.stringify(g) === JSON.stringify(w);
  console.log((ok ? '  ok   ' : '  FAIL ') + n + (ok ? '' : `  got ${JSON.stringify(g)} want ${JSON.stringify(w)}`)); ok ? pass++ : fail++; };

const TICKERS = ['AAPL', 'VOO', 'ABBV', 'NVDA', 'SPCX', 'SCHD', 'ORC', 'RIVN', 'LCID'];

/* dayLimit: how many calls the key has left before it starts refusing */
const run = (dayLimit) => p.evaluate(async ({ TICKERS, dayLimit }) => {
  db.holdings = TICKERS.map((t, i) => ({ id: 'h' + i, name: t, ticker: t, shares: 1,
    price: 100, avgCost: 100, divPerShare: 0, divFreq: 'quarterly', divBasis: 'payment' }));
  db.settings.mdKey = 'TESTKEY'; db.settings.mdProvider = 'alphavantage';
  _avCapped = false;
  const calls = { quote: 0, overview: 0, dividends: 0, other: 0, total: 0 };
  window.fetch = async (url) => {
    const u = String(url); calls.total++;
    const fn = /function=([A-Z_]+)/.exec(u);
    if (!/alphavantage/.test(u)) { calls.other++; throw new TypeError('Failed to fetch'); }
    const k = fn ? fn[1] : '';
    if (k === 'GLOBAL_QUOTE') calls.quote++;
    else if (k === 'OVERVIEW') calls.overview++;
    else if (k === 'DIVIDENDS') calls.dividends++;
    const body = calls.total > dayLimit
      ? { Information: 'Thank you for using Alpha Vantage! Our standard API rate limit is 25 requests per day.' }
      : k === 'GLOBAL_QUOTE' ? { 'Global Quote': { '05. price': '123.45' } }
      : k === 'OVERVIEW' ? { Symbol: 'X', DividendPerShare: '1.00', DividendYield: '0.02' }
      : { data: [{ ex_dividend_date: todayISO(), amount: '0.25' }] };
    return { ok: true, json: async () => body, text: async () => JSON.stringify(body) };
  };
  setView('invest'); await new Promise(r => setTimeout(r, 400));
  document.getElementById('refreshAllBtn').click();
  await new Promise(r => setTimeout(r, 9000));
  const st = document.getElementById('quoteStatus');
  return { calls, said: st.textContent.replace(/\s+/g, ' ').trim(),
    priced: db.holdings.filter(h => h.lastQuote === todayISO()).length,
    capped: _avCapped };
}, { TICKERS, dayLimit });

console.log('— nine holdings, a key with its full 25 left —');
const r = await run(25);
chk('every one of them gets a price', r.priced, 9);
chk('  one price lookup each, no more', r.calls.quote, 9);
chk('  and the whole run fits inside the daily limit', r.calls.total <= 25, true);
chk('  and not one dividend call rides along', [r.calls.overview, r.calls.dividends], [0, 0]);
chk('  which is 9 calls, where it used to ask for 27', r.calls.total, 9);
chk('nothing was blamed on the holdings', /Couldn't price/.test(r.said), false);
chk('  it just says it worked', /Updated 9 of 9/.test(r.said), true);

console.log('\n— dividends are their own button now —');
chk('a price refresh leaves them all unchecked', await p.evaluate(() =>
  db.holdings.filter(h => h.divChecked).length), 0);

console.log('\n— a key that is genuinely spent says so, and says what to do —');
const c = await run(0);
chk('it does not pretend the tickers are at fault', c.priced, 0);
chk('the cap is recognised', c.capped, true);
chk('  it names the real limit', /25 lookups a day/.test(c.said), true);
chk('  and points at a provider that can serve the list',
  /Finnhub/.test(c.said) && /Twelve Data/.test(c.said), true);
chk('  rather than only "enter it by hand"', /that is Alpha Vantage's daily limit/i.test(c.said), true);

console.log('\n— the old behaviour, for the record —');
/* Three calls a holding against 25 is 27 for this list: the arithmetic alone
   guaranteed the failure, whatever the network did. */
chk('3 calls x 9 holdings would have overrun the day', 3 * 9 > 25, true);

console.log('\n— one key for prices, another for dividends —');
/* Alpha Vantage is the only one carrying dividends, and prices are the thing
   you refresh daily. Two buttons, two keys, two budgets — so a spent dividend
   key never reads as a price problem. */
const two = await p.evaluate(async ({ TICKERS }) => {
  db.holdings = TICKERS.map((t, i) => ({ id: 'h' + i, name: t, ticker: t, shares: 1,
    price: 100, avgCost: 100, divPerShare: 0, divFreq: 'quarterly', divBasis: 'payment' }));
  db.settings.mdProvider = 'finnhub'; db.settings.mdKey = 'FINN';
  db.settings.divKey = 'AVKEY'; _avCapped = false; _avDivCapped = false;
  const seen = { finnhub: 0, avOverview: 0, avDividends: 0, avQuote: 0 };
  const keys = { finnhub: new Set(), av: new Set() };
  window.fetch = async (url) => {
    const u = String(url);
    if (/finnhub/.test(u)) { seen.finnhub++; keys.finnhub.add(/token=([^&]+)/.exec(u)[1]);
      return { ok: true, json: async () => ({ c: 200.5 }) }; }
    if (/alphavantage/.test(u)) {
      keys.av.add(/apikey=([^&]+)/.exec(u)[1]);
      const fn = /function=([A-Z_]+)/.exec(u)[1];
      if (fn === 'GLOBAL_QUOTE') { seen.avQuote++; return { ok: true, json: async () => ({}) }; }
      if (fn === 'OVERVIEW') { seen.avOverview++;
        return { ok: true, json: async () => ({ Symbol: 'X', DividendPerShare: '2.00', DividendYield: '0.03' }) }; }
      seen.avDividends++;
      return { ok: true, json: async () => ({ data: [{ ex_dividend_date: todayISO(), amount: '0.50' }] }) };
    }
    throw new TypeError('Failed to fetch');
  };
  setView('invest'); await new Promise(r => setTimeout(r, 400));
  document.getElementById('refreshAllBtn').click();
  await new Promise(r => setTimeout(r, 9000));
  const priceSaid = document.getElementById('quoteStatus').textContent.replace(/\s+/g, ' ').trim();
  const afterPrices = JSON.parse(JSON.stringify(seen));
  /* now the other button */
  document.getElementById('refreshDivBtn').click();
  await new Promise(r => setTimeout(r, 8000));
  return { afterPrices, seen, finnKeys: [...keys.finnhub], avKeys: [...keys.av],
    priced: db.holdings.filter(h => h.lastQuote === todayISO()).length,
    checked: db.holdings.filter(h => h.divChecked === todayISO()).length,
    paying: db.holdings.filter(h => h.divPerShare > 0).length,
    priceSaid, divSaid: document.getElementById('divStatusLine').textContent.replace(/\s+/g, ' ').trim(),
    budget: divBudgetPerRun() };
}, { TICKERS });

chk('all nine priced by the quote provider', [two.priced, two.afterPrices.finnhub], [9, 9]);
chk('  and Alpha Vantage was never asked for a price', two.seen.avQuote, 0);
chk('and prices ask Alpha Vantage for nothing at all',
  [two.afterPrices.avOverview, two.afterPrices.avDividends], [0, 0]);
chk('  dividends get a bigger share per run now that prices are elsewhere', two.budget, 6);
chk('nothing failed', /Couldn't price/.test(two.priceSaid), false);

console.log('\n— and the dividend button does the other half —');
chk('it checks a run\'s worth', two.checked, 6);
chk('  using the dividend key, and only that one',
  [two.finnKeys, two.avKeys], [['FINN'], ['AVKEY']]);
chk('  two calls each, no prices among them',
  [two.seen.avOverview, two.seen.avDividends, two.seen.avQuote], [6, 6, 0]);
chk('  the per-share figure came back', two.paying, 6);
chk('  and it says how many are still waiting',
  /3 holdings still to check/.test(two.divSaid), true);
chk('the price line was not touched by any of it',
  /Updated 9 of 9/.test(two.priceSaid), true);

console.log('\n— a spent dividend key is not a price problem —');
const spent = await p.evaluate(async () => {
  _avCapped = false; _avDivCapped = false;
  db.holdings.forEach(h => { delete h.divChecked; });
  window.fetch = async (url) => {
    const u = String(url);
    if (/finnhub/.test(u)) return { ok: true, json: async () => ({ c: 200.5 }) };
    return { ok: true, json: async () => ({ Information: 'rate limit is 25 requests per day' }) };
  };
  document.getElementById('refreshDivBtn').click();
  await new Promise(r => setTimeout(r, 6000));
  const divSaid = document.getElementById('divStatusLine').textContent.replace(/\s+/g, ' ').trim();
  document.getElementById('refreshAllBtn').click();
  await new Promise(r => setTimeout(r, 9000));
  return { divSaid, priceSaid: document.getElementById('quoteStatus').textContent.replace(/\s+/g, ' ').trim(),
    priced: db.holdings.filter(h => h.lastQuote === todayISO()).length, divCapped: _avDivCapped, quoteCapped: _avCapped };
});
chk('the dividend line says it is out for the day', /out of lookups for today/.test(spent.divSaid), true);
chk('  and says prices are unaffected', /Prices are unaffected/.test(spent.divSaid), true);
chk('  naming the provider actually doing them', /Finnhub/.test(spent.divSaid), true);
chk('the two caps are tracked apart', [spent.divCapped, spent.quoteCapped], [true, false]);
chk('prices still refresh perfectly well', spent.priced, 9);
/* the bug this whole section exists for: being told to switch to Finnhub while
   already on Finnhub */
chk('  and nothing tells you to switch to what you already use',
  /switch to/.test(spent.priceSaid) || /Twelve Data/.test(spent.priceSaid), false);

console.log('\n— a book that predates any of this —');
chk('an Alpha Vantage quote key still does dividends with nothing else set', await p.evaluate(() => {
  db.settings.mdProvider = 'alphavantage'; db.settings.mdKey = 'OLDKEY'; delete db.settings.divKey;
  return [divKeyOf(), divBudgetPerRun()]; }), ['OLDKEY', 2]);
chk('  and moving prices to Finnhub carries that key over by itself', await p.evaluate(async () => {
  setView('settings'); await new Promise(r => setTimeout(r, 300));
  if (typeof openSetPane === 'function') openSetPane('market');
  renderMarketSettings(); await new Promise(r => setTimeout(r, 200));
  const sel = document.getElementById('mdProvider');
  sel.value = 'finnhub'; sel.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 350));
  return { carried: db.settings.divKey, stillWorks: divKeyOf(),
    boxShown: !document.getElementById('divKeyBox').hidden,
    field: document.getElementById('divKey').value }; }),
  { carried: 'OLDKEY', stillWorks: 'OLDKEY', boxShown: true, field: 'OLDKEY' });
chk('  the dividend panel is hidden again when Alpha Vantage does both', await p.evaluate(async () => {
  const sel = document.getElementById('mdProvider');
  sel.value = 'alphavantage'; sel.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 300));
  return document.getElementById('divKeyBox').hidden; }), true);
chk('no key at all means no dividend calls, but prices still go out', await p.evaluate(() => {
  db.settings.mdProvider = 'finnhub'; db.settings.mdKey = 'FINN'; db.settings.divKey = '';
  return [divKeyOf(), divBudgetPerRun()]; }), ['', 6]);

console.log(`\n${pass} passed, ${fail} failed`);
console.log('page errors:', errs.length ? errs : 'none');
await b.close();
if (fail || errs.length) process.exitCode = 1;
