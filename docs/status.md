# Status — FreeBound

As of August 8, 2026 (end of the green rebrand session). The build delivered that day is the current source of truth; if the repo's `index.html` predates the rebrand (indigo accent, "Freedom Engine" title), it is stale and should be replaced with the delivered `freebound.html` renamed to `index.html`.

## Finished and verified

- **Dashboard**: net-worth hero as a scroll-snap carousel (personal first, one card per business), Safe to Spend KPI with tap-open arithmetic sheet, insight cards (7 local rules, cap 4, warn-first, per-month dismissal), KPI cards that click through, spending donut, Coming up, charts, recent transactions, foldable sections with persisted state.
- **Accounts**: nested bank sub-accounts, wallets, cash; liabilities separate.
- **Income**: multi-stream, day-rate × days, gig windows, payday prediction, per diem/reimbursement extras (hidden until selected), W-2/1099/exempt classing, passive flag, pay-stub reader, paycheck duplicate-stepping.
- **Spending**: CSV import with learning auto-categorization, import review queue (accept/correct/accept-all; corrections teach rules), filter chips, search, business tagging with mixed-use percentage splits, Transfer category.
- **Budget**: envelopes with per-budget rollover + start month, bills with frequencies/anchors/groups/tiers, partial payments, overpay carry-forward credit, pay-as-you-go (`open`) bills, "Bills left" card, consolidated one-row toolbar (⋯ menu: calendar export, mark-all-paid), `.ics` bill calendar export.
- **Credit & Debt**: typed debts, partial payments with history/undo, payoff dates, score log, utilization.
- **Investments**: holdings, cost basis, per-payment dividends with frequency auto-detect, annual projection, repaired multi-source quote refresh.
- **Tax**: per-stream classification, guided line-by-line editable estimate (hand-verified to the cent), virtual reserve ledger, catch-up offer for pre-feature paychecks, quarterly targets with weekend-shifted due dates, flat-rate mode.
- **Business**: multiple businesses, entity types, draw percentage into personal, P&L, Schedule C mapping + CSV export, dashboard carousel cards.
- **Goals**: multi-goal (six kinds), Survive/Maintain/Thrive freedom tracker, pace/milestones, runway, cash-flow forecast (opening balance is tax-reserve-aware).
- **Cross-cutting**: two-tap delete confirm on all 16 destructive paths, undo on every save, lazy per-view rendering (58 ms taps at 2,500 transactions), scroll preservation on all 13 renderers, 4-layer iOS zoom lockout, persisted view preferences, `(i)` help chips with auto-collapse, premium shadow/depth pass, FreeBound rebrand + green identity + new road-mark, icons (180/512).
- **Test harness**: `smoke.mjs` (32 assertions), `sweep.mjs` layout scan, feature suites v45–v77 — all green on the shipped build. (These lived in the dev sandbox; commit them to the repo if they made it over.)

## Half-built / built-but-unproven

- **SimpleFIN bank sync** — fully coded (accounts, balances, transactions, auto-typed cards/loans with two-way debt links, negative-balance normalization, review-queue landing) but **only ever run against mocked servers**. Never exercised against a live SimpleFIN bridge. L still needs to generate a fresh setup token and redeem it in his own browser.
- **Alpha Vantage quotes/dividends** — same: logic tested against mocks, never against the live API with his real key. The 25/day budgeting logic is untested in the wild.
- **Gist sync** — in real use by L (it works), but has no automated test coverage; last-push-wins with no merge is by design, not an accident.
- **Business tool at scale** — built and tested with seeded data; L had not yet fully populated his real businesses at session end.

## Known bugs / gotchas (with repro)

No open confirmed bugs at session end — the shipped build passed smoke + sweep + v74–v77. Things that look like bugs but aren't, plus watch-items:

1. **Bills list "scroll snap to top"** — fixed twice; the second fix (boot-time wrapping of all renderers) is the real one. Repro if it regresses: Budget → scroll the bills list down → tap any checkbox; list must not jump. Any new directly-called renderer can reintroduce it.
2. **"Tap again to confirm" showing unprompted** — happens if anyone wires `armConfirm` at render time. Repro: open a screen and look for pre-armed delete buttons. Correct shape is in CLAUDE.md.
3. **Quote refresh partially failing** — if only some holdings refresh, suspect Alpha Vantage rate limiting; the app should fall through to keyless sources and remember the cap for the session (`_avCapped`). Repro of the fixed bug: 7+ holdings, free AV key, refresh all.
4. **Phantom month-off transactions in tests** — `setMonth(-1)` on the 31st. App code anchors to day 1; test seeds must too (smoke.mjs was fixed for this after an August-rollover failure — quarterly anchor is now computed, not hardcoded).
5. **iOS icon not updating** — not a bug: Safari caches home-screen icons; remove and re-add the app.

## Next 5, in priority order

1. **Debt payoff strategy comparison** — avalanche vs snowball given $X extra/month: months to freedom and interest saved for each, side by side. Show the tradeoff only; no recommendation (standing rule). L has five debts with wildly different APRs — this is worth real money. (Top remaining item from the market review.)
2. **Category → transaction drill-through** — donut slice / budget row / insight card opens Spending pre-filtered to that category+month. Fastest build on the list; the Spending filters already exist and just need to be settable from outside. Consider the sheet pattern (like net worth) for a category's month.
3. **Sinking funds** — gear-replacement and slow-season buffers that fill in good months and drain in bad; percentage-of-good-month funding. For lumpy film income this is arguably more useful than any envelope.
4. **Live-service verification** — run SimpleFIN end-to-end with a real token (L redeems it himself) and Alpha Vantage with the real key; fix whatever reality breaks. Until this happens, sync is a demo.
5. **Native wrap (Capacitor) toward the App Store** — L has an Apple developer account. Wrap the single file, add local notifications for bill due dates (allowed — no server), TestFlight it. Precondition for any public release: register freebound.app (on L, urgent — availability was a July snapshot), trademark clearance, and an onboarding/simple-mode pass (the Essential/Flexible/Luxury tiers could power a "simple mode" that grows into the full app).

## L's own errand list (not code)

- Register **freebound.app** (and ideally freestride.app as backup) — urgent, availability decays.
- Upload `apple-touch-icon.png` next to `index.html`; remove + re-add the home-screen app.
- Regenerate the SimpleFIN setup token and redeem it in his own browser only.
- Keep periodic `.json` backups on a schedule (Settings → Backup & data → Save); losing the sync passphrase makes the gist copy unrecoverable.
- Confirm tax mechanics with a CPA who knows film-industry 1099 work, incl. whether an S-corp election changes the set-aside math.
