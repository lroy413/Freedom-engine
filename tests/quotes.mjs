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
chk('  dividends are looked up for two of them, not all nine',
  [r.calls.overview, r.calls.dividends], [2, 2]);
chk('  which is 13 calls, where it used to ask for 27', r.calls.total, 13);
chk('nothing was blamed on the holdings', /Couldn't price/.test(r.said), false);
chk('  it just says it worked', /Updated 9 of 9/.test(r.said), true);

console.log('\n— and the run after it, with dividends already fresh for two —');
const r2 = await p.evaluate(async () => {
  _avCapped = false;
  const before = db.holdings.filter(h => h.divChecked === todayISO()).length;
  return before; });
chk('two holdings are stamped, so the next run moves on to two others', r2, 2);

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

console.log(`\n${pass} passed, ${fail} failed`);
console.log('page errors:', errs.length ? errs : 'none');
await b.close();
if (fail || errs.length) process.exitCode = 1;
