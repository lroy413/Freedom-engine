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

- `smoke.mjs` — core regression, 32 assertions, exits non-zero on failure.
- `dates.mjs` — 100 assertions. Runs the shared fixture date logic under a fake clock at every month end, a leap day and a year boundary. Guards the rot class described below.
- `sweep.mjs` — layout overflow scan across 9 views × mobile/desktop. Detection-based: it prints `⚠ hscroll`, `clipped:`, or `ERRORS` when something is wrong, so silence is the pass. Ignores descendants of `overflow-x` scrollers by design.
- `v45`–`v77` — per-feature suites, newest most authoritative. (`v49` was never carried over from the sandbox.)

`smoke.mjs` and `dates.mjs` are the two suites with real assertions — treat them as authoritative.

## Reading the v-suite results

These print state for a human to read — they have **no assertions**. A zero exit means "ran to completion without throwing", not "the app is correct". Don't mistake a green run for verified behavior.

## Fixtures must compute their dates

A fixture pinned to a calendar month goes red once real time moves past it, and it reads as an app bug when it isn't. This bit v47, v61 and v62, each of which had been authored in July 2026 and failed the following August:

- **v47** wanted a scroll container in Coming Up, which only appears at ≥6 upcoming items; its fixed due-days had drifted to 4 in the 14-day window.
- **v61** clicked a quarterly bill anchored to `2026-07`, correctly not rendered in an August month view.
- **v62** selected `2026-07` in the data-derived `#budgetMonthSel`, a month its own fixture never seeded.

All three now derive months and offsets **inside the page** from `dayOf`/`todayISO`/`monthOf`/`isoOf`, the pattern `smoke.mjs` already used. Doing it in the page rather than in Node also stops the harness and the app disagreeing about "today" when their timezones differ.

Two rules for new fixtures:

- Anchor to day 1 before adding or subtracting months. `setMonth(-1)` on the 31st skips a month.
- Use `isoOf(d)`, never `d.toISOString().slice(0,10)` — the latter shifts the day in any timezone behind UTC.

Suites write screenshots and `.ics` exports to a hard-coded `/home/claude/`, a leftover sandbox path.
