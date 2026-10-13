# Status — FreeBound

As of **13 October 2026**. The repo's `index.html` on `main` is the source of
truth and is deployed at <https://lroy413.github.io/Freedom-engine/>.

The previous version of this file was written on 8 August and never updated
through the August build run, so it described an app twelve commits behind.
Everything in "Shipped since" below was missing from it.

## Shipped since the last status (August 2026)

- **Autopay** — tick "it pays itself" on a bill and each due date logs its own
  payment. Suggested for Subscriptions/Internet/Phone/Insurance/Streaming.
  `autoSince`/`autoThru` stop it inventing history or re-ticking a manual
  untick; the review queue de-duplicates the real bank charge against the
  generated one.
- **Unplanned spending** — an "episode" groups the eye exam, the frames and the
  lenses under one name with a kind. Refunds net off. Nothing is hidden from
  the budget; what it buys is "was this month expensive or unlucky" and a
  rolling-year figure to size a buffer against.
- **Transaction splitting** — one purchase across several categories, by amount
  or percent. Splits are real transactions sharing a `splitId`, so every
  downstream figure keeps working untouched.
- **Market data split in two** — prices and dividends now take separate keys and
  separate buttons. Alpha Vantage's 25/day stopped being the ceiling on how
  often a portfolio can be priced.
- **Variable bills** — "the amount changes each month" makes the figure a plan
  rather than a price. Overpaying a water bill is no longer treated as credit
  against next month; each month's variance is kept, with a per-bill history,
  an average, and a month-level over/under on the Budget card.
- **Visual pass** — the app's own typeface (Instrument Sans, self-hosted), one
  headline per screen, the ledger grouped by day, the freedom road redrawn as a
  road in perspective, view transitions, the month recap as a card deck, and an
  app-wide contrast pass that took every theme to zero WCAG AA failures.
- **Tooling** — the pre-commit gate grew checks for CSS class collisions, font
  hosting, and asset cache keys; the contrast scanner learned to read gradient
  backgrounds, which is what found most of the contrast work above.

## Fixed in this session

- **"Change saved" on every launch.** Boot ended with `persist()`, which both
  raised the toast and pushed an undo entry — so the app claimed you had
  changed something before you touched it, and the first Cmd+Z undid the
  launch. Boot now uses `persistQuiet()`; the write still happens.

## Test harness

47 suites in `tests/`. Named suites and their assertion counts at the time of
writing: smoke 288, dates 100, biz 58, invoice 54, oneoff 37, forms 37, backup
36, quotes 35, split 31, autopay 23, varies 18 — plus 33 legacy `v*` suites,
`sweep.mjs` (layout overflow) and `polish.mjs` (contrast, overflow, line length
at a given theme and width).

`package.json` pins Playwright **exactly**, not with a caret. These containers
ship one Chromium build and Playwright refuses any revision but its own; 1.56.0
is the release matching revision 1194. If the suites die with "Executable
doesn't exist", check `/opt/pw-browsers` and pin the matching release rather
than downloading a second browser.

## Still open

### Features never built
1. **Debt payoff strategy comparison** — avalanche vs snowball given $X extra a
   month: months to free and interest saved, side by side, no recommendation.
   Five debts at very different APRs; this is worth real money.
2. **Category drill-through** — a donut slice, budget row or insight opens
   Spending pre-filtered to that category and month. The filters already exist
   and only need to be settable from outside.
3. **Sinking funds** — gear replacement and slow-season buffers that fill in
   good months and drain in bad. For lumpy film income this may beat envelopes.

### Unproven rather than unbuilt
4. **SimpleFIN and Alpha Vantage have only ever run against mocks.** The
   arithmetic and the failure messaging are tested; no real request has ever
   been made. The first live key is also the first real exercise of that code.

### Not started
5. **Native wrap (Capacitor) toward TestFlight**, with local bill notifications.
   Blocked on registering freebound.app and a trademark check.

## Open design debt

Measured on 13 October — see the audit in the session notes for detail.

- **Desktop renders identically at 1440 and 1920.** The content column is capped
  at 1120px, so a larger monitor buys nothing. Every view is a single column;
  sheets open as centred modals that block the page behind them. The only
  keyboard affordances are Escape, Cmd+Z/Y and arrow keys in one carousel.
- **The phone's most prominent control is its least useful.** The centre button
  of the bottom bar navigates Home — reachable from anywhere — while logging a
  spend takes a tab change, a scroll and a sheet.
- **The dashboard is 3.8 phone screens tall**, roughly a third of the first
  screen being four one-sentence insight cards.
- **Several screens carry a lot of controls at once**: Budget 59, Settings 51,
  Income 46.

## L's own errand list (not code)

- Register **freebound.app** (and ideally freestride.app as backup).
- Regenerate the SimpleFIN setup token and redeem it in his own browser only.
- Keep periodic `.json` backups (Settings → Backup & data → Save); losing the
  sync passphrase makes the gist copy unrecoverable.
- Confirm tax mechanics with a CPA who knows film-industry 1099 work, including
  whether an S-corp election changes the set-aside math.
