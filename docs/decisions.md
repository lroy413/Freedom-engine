# Decisions — FreeBound

Every real decision made while building this, with reasoning and what was rejected. Newest architecture-level items first, then domain decisions, then L's explicit standing rules.

## Architecture

**Single self-contained HTML file, vanilla JS, no build step.**
Reasoning: zero-dependency durability (the app must still open in ten years), trivial deploys (upload one file), works offline, auditable in one read, and the user maintains it with AI assistance rather than a toolchain. Rejected: React/Vue/Svelte (build step, dependency churn), splitting CSS/JS into separate files (breaks the one-file deploy story).

**localStorage as the database (`moneymachine_v1`).**
Reasoning: privacy (finances never touch a server), no accounts, no hosting cost, instant reads. Rejected: any backend, IndexedDB (overkill for <5 MB JSON, worse ergonomics). Consequence accepted: per-origin storage, so sync had to be built separately.

**Credentials in a separate localStorage key (`fe_sync_v1`).**
Reasoning: exported `.json` backups are shared/moved around; keeping tokens, passphrases, SimpleFIN URLs, and API keys in a different key makes it structurally impossible for a backup export to leak credentials. Never merge them.

**Cross-device sync = encrypted GitHub Gist, last-push-wins.**
Reasoning: free, no server of ours, client-side encryption means GitHub holds an unreadable blob. Rejected: real-time sync/merge (complexity not worth it for one user); any third-party sync service. Rule of use: pull when you start, push when you finish. Accepted risk: losing the passphrase loses the cloud copy — mitigated by periodic manual `.json` backups.

**SimpleFIN over Plaid for bank sync.**
Reasoning: ~$15/yr vs. Plaid's aggregator lock-in; user-controlled token; DollarWise's #1 complaint (paying monthly for broken Plaid sync) validated this. Also: CSV import and full manual mode are first-class paths, not fallbacks — the open-banking regulatory mess (Section 1033 enjoined Oct 2025, banks charging for data) makes multi-path insurance, not redundancy. Known ceiling accepted: SimpleFIN carries no investment holdings, so investments stay manual.

**No push notifications; `.ics` calendar export instead.**
Reasoning: push would require a server holding bill names, amounts, and due dates — a privacy cost for a nudge. `.ics` subscription does the job with nothing leaving the device. Local notifications via a native wrap (Capacitor) are acceptable later.

**Lazy per-view rendering** (`VIEW_RENDERERS` + `_dirty`), replacing render-everything-on-save.
Reasoning: at 2,500 transactions a save took 2.4 s; after, ~58 ms. Rejected: virtual DOM / framework migration (see decision #1); fine-grained reactive state (too invasive).

**Scroll preservation by wrapping all renderers at boot** rather than inside `renderAll` only.
Reasoning: 18 call sites invoked `renderBudget` directly and bypassed the first fix; wrapping `window[name]` once at boot catches every path. This shipped wrong once — the lesson is recorded as a fragile area in CLAUDE.md.

**iOS zoom lockout, four layers** (viewport clamp, gesture events, `touch-action:manipulation`, 16px inputs).
Reasoning: accidental pinch/double-tap zoom during use. Rejected mid-build: a touchend second-tap preventDefault — it would have swallowed the "tap again to confirm" pattern, which *is* a fast double tap.

**Transactions table capped at 250 rendered rows.** Performance guard; filters/search reach the rest.

## Product / domain

**Naming: FreeBound (app), FreeBound Financial (full/company name).** Decided Aug 8, 2026 after three research rounds. The brief that won: the name must represent the road/journey to financial freedom; it did not need to be film-related or money-literal. Rejected rounds: film-industry names (Residuals, Dailies, WrapCheck — L rejected the lane), Japanese names (Fueru, Tamaru, Yutaka — rejected as a set), and DollarTrek (available, but "Dollar Track" clutter + Dollar Tree phonetics + Trek Bicycles' policed mark). Standing do-not-use list (conflicts found in checks): Greenlight, Runway, Slate*, Per Diem, Dayrate, Callsheet, Keylight, FreeFrame, TakeHome, Coast, Slipstream, Ippo, Perennial, Landfall, Greenway, Cairn, Ronin, Bushido, Glidepath, Freehold, Homestretch, Breakaway, Tabi, Openroad, Michinori; avoid echoing Keeper, Catch, Steady, Wrapbook, Kachinga, DollarWise. freebound.app was unregistered at decision time — registration is on L, urgently. Trademark clearance (~$500–1,500) required before any public launch.

**Rebrand did NOT rename protocol identifiers.** Gist file `freedom-engine.json`, backup tag `app:"freedom-engine"`, calendar UIDs `@freedom-engine`, and both localStorage keys keep their old names forever — existing devices, backups, and calendar subscriptions depend on them. Branding is display strings, filenames of *new* exports (`freebound-*.json/.ics`), and the ICS PRODID only.

**Brand mark (v2): road × climb.** Two road edges converging to a vanishing point; the dashed center line doubles as the shaft of an upward arrow; wide chevron head floating in negative space above (wider than the edges so it doesn't read as a letter "A" — the first icon attempt did). Story: the road's own center line becomes the climb — the line leaves the road, i.e. unbound. v1 (road toward a rising sun) was rejected by L: "I wouldn't understand it just by looking at it." Green identity chosen by L over the original indigo: light `#059669`, dark `#10b981` with dark-green ink `#032b1f` on bright controls (the ink choice is what makes it feel designed, not recolored). Bushido theme renders the chevron gold `#c9a227`.

**Freedom tracker is three tiers (Survive / Maintain / Thrive)**, chosen by L over a single freedom number. Reasoning: a tiered meter gives a milestone reachable this decade; a single 4%-style number stays discouraging for years. No mainstream app ships a live passive-income coverage meter at all — this is the app's centerpiece differentiator.

**Goals is its own tool; net worth got promoted to the dashboard.** L's call: "let goals be its own tool and we'll break away networth into the main dashboard… rebrand the dashboard around networth." The dashboard hero is net worth; the old single "Cash goal" card became freedom coverage.

**Tax reserve is a virtual envelope, not moved money.** L chose this over auto-transfers. Logging a 1099 paycheck writes a ledger entry; `spendableCash()` subtracts the held total from money on hand, runway, and forecast opening balance. Pre-existing paychecks are never silently backfilled — the screen offers a catch-up and states the amount first. Estimate mode is **guided and editable** (L's choice over a black-box number): every rate is a visible field with its assumption printed, calculation shown line by line so a CPA can check it. Marginal federal rate on purpose — being short in April is worse than being early. Flat-rate mode exists for when the number is already known.

**Businesses connect to personal via a per-business draw percentage.** L's requirement: profit *optionally* flows to personal net worth, at a chosen percentage, because some profit is reinvested. No dedicated business bank account required — tagging builds the books. Mixed-use splits (a lens that's 70% work) are a first-class case, with the business share leaving personal spending and the remainder staying. Schedule C line mapping + CSV export an accountant can use. Rejected: full double-entry bookkeeping (out of scope), forcing separate accounts.

**Bill overpayment carries forward as credit** (`billCredit`), computed cumulatively from the first recorded payment, clamped at ≥0 monthly (a shortfall is just unpaid, never negative), correct across quarterly/annual frequencies. **Pay-as-you-go bills** (`open` flag) exist because L's electric is prepaid — "enough that the lights stay on": no fixed amount, no due date, no overdue state, payments logged whenever, a typical-month figure used only for planning. The Budget card reads "Bills left" (what's still unpaid), never total-when-paid.

**DollarWise-inspired trio, adapted rather than copied** (from a competitive teardown of Caleb Hammer's DollarWise, which is beatable on features but right about daily-use ergonomics):
- *Safe to Spend*: one number — cash on hand minus tax reserve minus bills still due minus envelope remainders, with per-day for the rest of the month and a tap-open arithmetic sheet. Built from cash, never projected income ("a promised invoice isn't spendable"). Better-founded than DollarWise's because it subtracts the tax reserve.
- *Import review queue*: imports land flagged `review`; one tap accepts the guessed category; correcting teaches an auto-cat rule. Manual entries skip review. Rejected: Tinder-style swipe mechanics.
- *Insight cards*: locally computed rules only — no AI, no server. Capped at four, warnings first, dismissible per month. Rejected: DollarWise-style high-volume nagging.

**Investments track dividends per payment with auto-detected frequency**, feeding the freedom number. Quote refresh: keyed Alpha Vantage first with keyless fallbacks, weekly dividend re-check gating (`divChecked`), session-level rate-limit memory (`_avCapped`). Reasoning: AV free tier is 25 calls/day; the original design burned 3 calls per holding and broke at 7 holdings.

**Two-tap confirm (`armConfirm`) on all sixteen destructive deletes**, plus undo on every save. Earlier state (confirm only on goals) was ruled inconsistent in the audit.

**View preferences persist in `db.settings.ui`.** The audit found persistence was arbitrary (only dashboard collapse saved); now filter panel, bills view, goal sort, dividend collapse, net worth lists, projection horizon all persist.

**One row idiom (`.brow`) everywhere.** The audit found three (`brow`/`dcard`/`arow`); consolidated. Don't reintroduce.

**Expandable `(i)` help chips** throughout, extras hidden until selected (L: "extras should only show up when selected").

**No investment advice, no debt-ordering recommendation — ever.** For debt payoff strategy (planned): show avalanche vs snowball tradeoffs (months, interest saved); L picks. The app shows tradeoffs; it does not recommend.

## L's explicit standing rules (verbatim intent — never violate)

1. **Never accept, request, or use tokens/passwords/credentials pasted into chat.** The SimpleFIN setup token in particular is single-use — whoever redeems it first gets permanent bank access — and must be redeemed only by L's own browser. If one is ever exposed, tell him to regenerate it.
2. **The GitHub access token must never be pasted into chat**, including to the assistant.
3. **Backup `.json` files contain real finances and must never be committed to the public repo.** The repo holds the app, never the data.
4. **Credentials live only in `fe_sync_v1`** so they can never ride along in exported backups.
5. **No investment or financial advice**; show tradeoffs, he decides. (Also: he corrected stale market knowledge twice — SpaceX IPO'd June 2026 as SPCX/NASDAQ; NVDA and VOO both pay dividends. Verify current market facts before contradicting him.)
6. **No server-based push notifications** (privacy); `.ics` export is the pattern; local notifications via native wrap acceptable.
7. **Frozen identifiers** (see CLAUDE.md) are never renamed.
8. **Don't rename or "clean up" the live URL casing** — `https://lroy413.github.io/Freedom-engine/` is case-sensitive.
9. Tone he asked for in collaboration: direct, casual, critical — don't hold back.
