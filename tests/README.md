# FreeBound test suites (from the dev sandbox)

Playwright headless suites. Not part of the deployed app — keep out of GitHub Pages or in a /tests folder (Pages will serve them but they are harmless).

The app itself still has no dependencies and no build step (see CLAUDE.md). The `package.json` in this folder is dev-only tooling and covers the harness, never the app.

## Run

```
cd tests && npm install          # installs the pinned playwright
python3 -m http.server 8899 --directory ..   # serve the repo root
node tests/smoke.mjs             # from the repo root
```

**Playwright is pinned to 1.56.0 on purpose.** Each release hard-codes one Chromium build (1.56.0 → build 1194), and it refuses to launch anything else. A bare `npm i playwright` takes the newest release, which demands a different build and dies with "Executable doesn't exist". If you bump the pin, expect to re-download browsers.

## What's here

- `smoke.mjs` — core regression, 32 assertions, exits non-zero on failure. **The only suite with real assertions**; treat it as the authoritative one.
- `sweep.mjs` — layout overflow scan across 9 views × mobile/desktop. Detection-based: it prints `⚠ hscroll`, `clipped:`, or `ERRORS` when something is wrong, so silence is the pass. Ignores descendants of `overflow-x` scrollers by design.
- `v45`–`v77` — per-feature suites, newest most authoritative. (`v49` was never carried over from the sandbox.)

## Reading the v-suite results

These print state for a human to read — they have **no assertions**. A zero exit means "ran to completion without throwing", not "the app is correct". Don't mistake a green run for verified behavior.

Several also hard-code a calendar month and go red once real time moves past it, which looks like an app bug and isn't. Known cases as of August 2026:

- **v47** expects a scroll container in Coming Up; that only appears at ≥6 upcoming items, and its fixture's due-days yield 4 in the current 14-day window.
- **v61** clicks bill `r3` (Water, quarterly, `anchor:"2026-07"` → due Jul/Oct/Jan). Correctly not rendered in an August month view.
- **v62** selects `2026-07` in `#budgetMonthSel`, which is data-derived; the fixture seeds no July transactions, so that option doesn't exist.

Seeds must anchor month arithmetic to day 1 — `setMonth(-1)` on the 31st skips a month. `smoke.mjs` was fixed for this (its quarterly anchor is computed, not hard-coded); the three above were not.

Suites write screenshots and `.ics` exports to a hard-coded `/home/claude/`, a leftover sandbox path.
