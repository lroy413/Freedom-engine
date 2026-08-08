# FreeBound test suites (from the dev sandbox)

Playwright headless suites. Not part of the deployed app — keep out of GitHub Pages or in a /tests folder (Pages will serve them but they are harmless).

Run: start a static server (python3 -m http.server 8899) serving the folder that contains the app HTML, then: node tests/smoke.mjs

smoke.mjs = core regression (32 asserts). sweep.mjs = layout overflow scan (ignores overflow-x scroller children by design). v45–v77 = per-feature suites, newest most authoritative. Suites load http://localhost:8899/index.html and import playwright normally — run `npm i playwright` in this folder (or globally) first.
