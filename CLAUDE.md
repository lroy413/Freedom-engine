# CLAUDE.md — FreeBound

## What this app is

FreeBound (formerly "Freedom Engine") is a private personal-finance app built for one user — L, a freelance film-industry photographer/videographer in Atlanta with mixed W-2 and 1099 income. It tracks accounts, irregular income, envelope budgets, bills, debts, investments with dividends, a self-employment tax reserve, multiple businesses, and goals — all oriented around one question: how close is passive income to covering expenses ("financial freedom"). It is a single self-contained HTML file with no server, no build step, and no account; all data lives in the browser's localStorage on the user's own devices.

## Stack and structure

**There is no stack.** One HTML file (~490 KB) containing all CSS in one `<style>` block and all JS in one `<script>` block. Vanilla JavaScript, no framework, no dependencies, no bundler, no npm. This is deliberate (see docs/decisions.md) — do not introduce a build step, a framework, or external runtime dependencies.

Files in the repo:

- `index.html` — the entire application. During development it has been named `budget.html` / `freebound.html`; deploying means renaming the new version to `index.html`.
- `apple-touch-icon.png` — 180px home-screen icon. Must sit next to `index.html`. Users must remove + re-add the app to the iOS home screen to pick up a new icon.
- `freebound-icon-512.png` — master icon (may or may not be committed).

There is **no Supabase, no database, no backend, no API of ours**. The "schema" section below documents localStorage.

### How the pieces connect (inside the one file)

Order of the file: CSS → HTML markup for every view → JS. The JS is organized roughly as: utilities (dates, formatting, uid) → seed/migrate/persist (data layer) → domain logic (tax, business, bills, safe-to-spend, insights) → per-view render functions → wiring/boot.

- **State**: a single global `db` object, loaded at boot via `migrate()` → `repairIds()` → `normalize()` (in that order — normalize assumes migrated shape, repairIds must run before anything trusts ids). `persist()` writes `db` to localStorage and pushes an undo snapshot; every toast offers Undo.
- **Rendering is lazy per view.** `VIEW_RENDERERS` maps view id → render function(s). `renderAll()` marks every view dirty (`_dirty`), renders only `currentView` (plus any open sheet), and `setView(id)` renders a dirty view on entry. This took a save from 2.4 s to ~58 ms at 2,500 transactions. If you add a view, register it in `VIEW_RENDERERS` — otherwise it never re-renders after saves.
- **Scroll preservation**: `captureScrolls()` / `restoreScrolls()` snapshot every `.scrollrows`, `.scrolllist`, `.sheetscroll` keyed by `(host id)#index`. All 13 top-level renderers are wrapped **once at boot** via `window[name] = _keepScroll(window[name])`. If you add a renderer that is called directly (not just via renderAll), add it to the boot wrap list, or lists will snap to the top on every interaction — this bug shipped twice.
- **Sheets**: bottom-sheet drill-downs (net worth `renderNWSheet`, safe-to-spend `renderSTS`). Open-sheet state (`nwOpen`, `stsOpen`) is checked in `renderAll` so an open sheet re-renders with fresh data.
- **Views**: dash, accounts, income, expenses (nav label "Spending"), budget, goals, credit, invest, tax, business, data — plus settings.

## Data "schema" (localStorage)

Two keys, deliberately separate:

### `moneymachine_v1` — the entire database (JSON). FROZEN NAME — never rename.

Top-level shape (from `seed()` + `normalize()`):

- `version` — schema version (2). `migrate()` handles v1→v2.
- `categories[]` — strings; `DEFAULT_CATS` seeds ~23. "Transfer" counts as neither income nor spending.
- `transactions[]` — `{id, date, desc, amount, cat, note, billRef, review, biz…}`.
  - `billRef` = `"<billId>|<monthKey>"` — links a payment transaction to a bill for a given month. This string format is load-bearing (bill paid math, id repair) — don't change it.
  - `review: true` = sitting in the import review queue (CSV imports and bank-sync arrivals get it; manual entries don't).
  - Business tagging: business id + percentage for mixed-use splits (`personalAmt`/`bizAmt` derived; 70%-work gear is the normal case).
- `rules[]` — merchant→category auto-categorization; seeded with `DEFAULT_RULES`; correcting a category in the review queue or table teaches a rule via `merchantKey`.
- `budgets{cat: amount}` + `budgetMeta{cat: {since, roll}}` + `monthBudgets{}` — envelope budgets; rollover is per-budget, and `since` prevents a new budget from "carrying in" months it didn't exist.
- `recurring[]` — bills: name, amount, `dueDay`, frequency (monthly/quarterly/annual with anchor month), group tabs, tier (Essential/Flexible/Luxury), business link, and `open: true` for pay-as-you-go bills (no fixed amount, no due date, no overdue state; a typical-month figure is used for planning only). Overpayment carries forward: `billCredit()` walks months cumulatively from the first recorded payment, clamped at ≥0; `billPaidAmt = billPaidRaw + billCredit`.
- `income[]` — streams: pay models (day rate × days/week, salary, one-off gig), gig start/end windows, pay frequency + first-paycheck date (payday prediction), per diem / reimbursement extras, tax class **w2 / se / exempt**, `passive` flag (feeds the freedom tracker).
- `paychecks[]` — logged pay; logging a 1099 (`se`) paycheck creates a tax-reserve ledger entry; deleting the paycheck removes its reserve entry.
- `debts[]` — kind-typed (card/auto/loan/collection/…), APR, payment, payoff date, partial payments with history; two-way linked to synced credit-card/loan accounts.
- `accounts[]` — banks with `parentId` nesting (sub-accounts), digital wallets, cash. Liabilities live in `debts`, not here.
- `holdings[]` + `dividends[]` — cost basis, dividend **per payment** with auto-detected frequency; `divChecked` date gates dividend re-lookups to weekly (protects the Alpha Vantage 25/day free tier).
- `creditLog[]` — credit score history.
- `snapshots[]` — net worth history with attribution.
- `goals[]` (+ legacy `goal` kept in sync by `normalize()`) — six kinds, links, contribs; the freedom tracker (Survive/Maintain/Thrive vs passive income) lives on the Goals view.
- `businesses[]` — multiple; entity type; **`drawPct`** = what share of profit flows to personal (rest reinvested). P&L, Schedule C line mapping (`SCHED_C`), CSV export.
- `tax{}` — `mode: "guided"|"flat"`, editable rates (SE 15.3% on 92.35% base, half-SE deduction, marginal fed default 22%, GA 5.39%, optional QBI, W-2 withholding credit), `reserve[]` ledger + `paid[]` quarterly payments. The reserve is **virtual**: `spendableCash() = totalCash() − taxHeld()`; nothing actually moves between accounts.
- `settings{}` — theme, `ui` (persisted view preferences), `insightsGone{id: monthKey}` (per-month insight dismissals), `passiveYield`, legacy flags.

Derived, not stored: `safeToSpend()` = spendableCash − bills remaining this month − Σ max(0, envelope available), with a per-day figure for the rest of the month.

### `fe_sync_v1` — credentials. FROZEN NAME — never rename.

GitHub token (fine-grained, Gists r/w), backup/gist id, encryption passphrase, SimpleFIN access URL, Alpha Vantage key. Kept in a separate key **so credentials can never appear in exported backups**. Never merge these into `moneymachine_v1` or into any export.

### Security model (the RLS equivalent)

There is no server-side anything. The model is: data never leaves the device except (a) user-initiated `.json` backup downloads and (b) the cross-device sync gist, which is **encrypted client-side before upload** — GitHub stores an unreadable blob. Last push wins; no merge. Losing the passphrase makes the cloud copy unrecoverable.

## Conventions actually in use

- Row pattern: compact row that expands (`.brow`) everywhere — 11px/15px padding, 15.5px/620 names. Earlier idioms (`.dcard`, `.arow`) were consolidated into it; don't reintroduce them.
- All HTML injection goes through `esc()`. Money formatting: `fmt` ($1,234) for headlines, `fmt2` only where cents matter, `fmtK` ($1.2k) in shared-line rows.
- **All date math is local-calendar-date, never UTC instants**: `dayOf()` (parses at local noon), `isoOf()`, `monthOf()`, `monthKey()`. "Previous month" must anchor to day 1 first — `setMonth(-1)` on the 31st skips a month.
- Destructive actions use `armConfirm(btn, fn)` two-tap confirm, and it must be **called on click** (`b.onclick = () => armConfirm(b, fn)`), never attached at wire time — attaching at render time arms every button and the first real click deletes.
- Help/expandable notes: `(i)` chips expanding inline; `collapseHelp()` + a MutationObserver keep long help collapsed (HELP_MIN=34).
- Theming: CSS custom properties per theme (light/dark/bushido/auto). Accent is emerald (light `#059669`, dark `#10b981` with dark ink `#032b1f` on bright controls). Layered shadow tokens: `--shadow`, `--shadow-sm`, `--card-hi`, `--card-grad`, `--inset`. Prefer `color-mix(in srgb, var(--accent) …)` over hardcoded accent colors.
- A global `[hidden]{display:none !important}` exists because class display rules kept beating the attribute. Use `hidden` freely; don't fight it with display rules.
- iOS behavior is protected by four layers: viewport `maximum-scale=1, user-scalable=no`; `gesturestart/change/end` preventDefault; `html{touch-action:manipulation}`; and **all inputs ≥16px on coarse pointers** (iOS auto-zooms on focus of smaller inputs). Keep new inputs at 16px on mobile.
- Long lists render capped (transactions table caps at 250 rows) — keep render work bounded.

## Fragile areas — what breaks when touched

1. **Frozen protocol identifiers.** Existing synced devices, gist backups, and calendar subscriptions depend on: localStorage keys `moneymachine_v1` and `fe_sync_v1`; gist file name `freedom-engine.json` (`FILE_NAME`); backup format tag `app:"freedom-engine"`; calendar UIDs `…@freedom-engine`. These carry pre-rebrand names **on purpose** — they are protocol, not branding. Renaming any of them orphans real data.
2. **The render/scroll machinery** (lazy `VIEW_RENDERERS` + `_dirty` + `_keepScroll` boot wrap). Adding views or renderers without registering them causes stale screens or scroll-snap regressions.
3. **`billRef` string format and `billCredit()`** — the overpay-carry walk is cumulative and clamped; it also honors quarterly/annual frequency via `billAmountIn`. Touch bill math only with the test suites running.
4. **Date handling.** Any `new Date(isoString)` without `dayOf()` reintroduces UTC off-by-one-day bugs; any month arithmetic without anchoring to day 1 breaks on the 29th–31st.
5. **Quote refresh** (`fetchQuote`): keyed Alpha Vantage first, falls through to keyless free sources on *error or miss*; `_avCapped` session flag stops burning calls after a rate-limit note; `divChecked` is stamped on **attempt** (not success) so no-dividend holdings aren't re-queried weekly. Naive "improvements" here re-break the 25-calls/day budget.
6. **migrate → repairIds → normalize order** at boot, and `repairIds()`'s positional capture of account parent links and billRefs.
7. **Single-file size.** ~490 KB and growing; there is no code-splitting escape hatch. Prefer tightening over adding libraries.

## Run locally / test / deploy

- **Run**: any static server — `python3 -m http.server 8899` and open `http://localhost:8899/index.html`. No build. State persists per browser origin.
- **Test**: Playwright headless suites (Node, `*.mjs`) exercise the app against a local server with seeded localStorage. Pattern: launch chromium, `page.goto`, `page.evaluate` to seed `moneymachine_v1`, reload, assert DOM/functions. Suites: `smoke.mjs` (32 assertions), `sweep.mjs` (layout-overflow scan — deliberately ignores descendants of `overflow-x` scrollers, that overflow is design), and feature suites `v45`–`v77` (older ones are not authoritative). Note: these suites lived in the dev sandbox, not the repo, unless they've since been committed.
- **Deploy**: GitHub Pages from this repo — rename the new build to `index.html`, commit, push. Live at `https://lroy413.github.io/Freedom-engine/` (capital F, case-sensitive). Data is untouched by deploys (it's in localStorage + the encrypted gist).
- **Never commit**: `.json` backups (real finances), tokens, SimpleFIN URLs, passphrases. The repo is public; it holds the app, never the data.

## External services (all optional, all client-side)

- **SimpleFIN Bridge** (~$15/yr) for bank sync — accounts, balances, transactions only. **The protocol carries no investment holdings**; the investment side is manual by design of the plumbing. Setup token is single-use and must be redeemed only by the user's own browser — never accept or use one in a chat/session. Synced transactions land in the review queue; synced cards/loans auto-create linked Debt entries; negative balances normalized.
- **GitHub Gist** for encrypted cross-device sync (token + Backup ID + passphrase must match on both devices).
- **Alpha Vantage** (free key, 25 req/day) + keyless fallbacks for quotes/dividends.
- **`.ics` export** for bill due dates (chosen over push notifications — see decisions).

SimpleFIN and Alpha Vantage have only ever been exercised against mocks — see docs/status.md.
