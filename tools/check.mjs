/* The gate. Runs in well under a second and catches the class of mistake that
   has actually broken this app: not bad logic — logic is what the Playwright
   suites are for — but structural damage from an edit landing in the wrong
   place. A stray comment terminator that swallows half a file, a two-line
   handler deleted as one, a renamed function with callers left behind, a
   getElementById for an element that no longer exists.
   Every one of those took the WHOLE app down, because it is one page. This runs
   before every commit so none of them can reach one.

   node tools/check.mjs            check
   node tools/check.mjs --quiet    only speak up when something is wrong */
import { readFileSync, existsSync, writeFileSync as _write } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const quiet = process.argv.includes("--quiet");
if (process.argv.includes("--stamp")) {
  const { readFileSync: rf, writeFileSync: wf, existsSync: ex } = await import("node:fs");
  const { createHash: ch } = await import("node:crypto");
  let src = rf("index.html", "utf8");
  for (const f of ["styles.css", "data.js"]) {
    if (!ex(f)) continue;
    const v = ch("sha1").update(rf(f)).digest("hex").slice(0, 8);
    src = src.replace(new RegExp(f.replace(".", "\\.") + '(\\?v=[0-9a-f]{8})?(?=")'), f + "?v=" + v);
  }
  wf("index.html", src);
  console.log("stamped index.html with the current asset hashes");
  process.exit(0);
}
const problems = [];
const notes = [];
const fail = (where, msg) => problems.push(`${where}: ${msg}`);
const ok = msg => { if (!quiet) notes.push("  ok   " + msg); };

const read = f => existsSync(f) ? readFileSync(f, "utf8") : null;
const html = read("index.html");
if (html === null) { console.error("no index.html here — run from the repo root"); process.exit(2); }

/* ---------- 1. every script parses ---------- */
/* The failure mode this exists for: an edit leaves the file syntactically
   broken and the entire application is a blank screen. */
const scripts = [];
{
  const re = /<script(?<attrs>[^>]*)>(?<body>[\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    const src = /src=["']([^"']+)["']/.exec(m.groups.attrs);
    if (src) { const f = src[1].split("?")[0]; scripts.push({ name: f, body: read(f), external: true }); }
    else scripts.push({ name: `index.html inline @${html.slice(0, m.index).split("\n").length}`, body: m.groups.body });
  }
}
for (const s of scripts) {
  if (s.body === null) { fail(s.name, "referenced but the file is missing"); continue; }
  const tmp = join(tmpdir(), "fb-check-" + s.name.replace(/\W/g, "_") + ".js");
  writeFileSync(tmp, s.body);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); ok(`${s.name} parses`); }
  catch (e) {
    const out = String(e.stderr || e.stdout || e.message).split("\n").slice(0, 4).join("\n   ");
    fail(s.name, "does not parse\n   " + out);
  }
}

/* ---------- 2. no unbalanced block comments ---------- */
/* --check catches most of these, but an unclosed comment that happens to leave
   valid syntax behind silently deletes working code. */
for (const s of scripts) {
  if (!s.body) continue;
  const opens = (s.body.match(/\/\*/g) || []).length;
  const closes = (s.body.match(/\*\//g) || []).length;
  if (opens !== closes) fail(s.name, `${opens} /* against ${closes} */ — a comment is swallowing code`);
}
ok("block comments balance");

/* ---------- 3. the stylesheet is whole ---------- */
const css = read("styles.css");
if (css === null) fail("styles.css", "missing");
else {
  const braces = (css.match(/\{/g) || []).length - (css.match(/\}/g) || []).length;
  if (braces !== 0) fail("styles.css", `${braces > 0 ? braces + " unclosed" : -braces + " extra"} brace(s)`);
  else ok("styles.css braces balance");
  if (!/<link[^>]+styles\.css/.test(html)) fail("index.html", "does not link styles.css");
}

/* ---------- 3b. two components must not claim one class name ---------- */
/* One stylesheet, no scoping, and names get reused by accident: a new `.hdot`
   for holding colours landed on top of the hero carousel's `.hdot`, inheriting
   its shape and a 38px invisible tap target. A `.hero` for a KPI card picked up
   the dashboard's green gradient and painted itself solid emerald. Both looked
   like CSS mysteries and were really name collisions.
   Only bare `.foo{` counts — `.foo.bar`, `.foo:hover`, `.a .foo` are variants of
   one component, and anything inside @media or a theme override is a legitimate
   restatement. */
if (css !== null) {
  const lines = css.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, " ")).split("\n");
  let depth = 0, skipUntil = -1;
  const owners = new Map();
  lines.forEach((ln, i) => {
    const opensContext = /^\s*(@media|@supports|html\[data-theme|:root)/.test(ln);
    if (opensContext && skipUntil < 0) skipUntil = depth;
    const bare = /^\s*\.([A-Za-z][\w-]*)\s*\{/.exec(ln);
    if (bare && skipUntil < 0) {
      if (!owners.has(bare[1])) owners.set(bare[1], []);
      owners.get(bare[1]).push(i + 1);
    }
    depth += (ln.match(/\{/g) || []).length - (ln.match(/\}/g) || []).length;
    if (skipUntil >= 0 && depth <= skipUntil) skipUntil = -1;
  });
  /* styles.css declares its intentional restatements in one comment */
  const allowed = new Set((/restated-by-design:\s*([^\n*]+)/.exec(css) || [, ""])[1]
    .split(",").map(x => x.trim()).filter(Boolean));
  const clashes = [...owners].filter(([c, at]) =>
    at.length > 1 && at[at.length - 1] - at[0] > 40 && !allowed.has(c));
  if (clashes.length) fail("styles.css", "one class, two components — rename one:\n   " +
    clashes.map(([c, at]) => `.${c} defined at lines ${at.join(", ")}`).join("\n   "));
  else ok(`${owners.size} component class names are each defined in one place`);
}

/* ---------- 4. data.js runs before the app needs it ---------- */
/* A classic script's top-level const joins the shared global scope, but only
   once it has run. Getting the order wrong is a blank page. */
{
  const dataAt = html.search(/src="data\.js(\?[^"]*)?"/);
  const appAt = html.lastIndexOf("\n<script>\n");
  if (dataAt < 0) fail("index.html", "does not load data.js");
  else if (dataAt > appAt) fail("index.html", "loads data.js AFTER the app — the tables will not exist yet");
  else ok("data.js loads before the app");
}

/* ---------- 5. every element the code reaches for exists ---------- */
/* The straggler check. Rename a panel, miss a caller, and the failure is a
   silent no-op months later rather than an error. */
const markup = html.replace(/<script[\s\S]*?<\/script>/g, "");
const declaredIds = new Set([...markup.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
const jsAll = scripts.map(s => s.body || "").join("\n");
/* ids created at render time are written into template literals, so anything
   quoted anywhere in the JS counts as existing */
const madeInJs = new Set([...jsAll.matchAll(/\bid="([\w-]+)"/g)].map(m => m[1]));
const wanted = new Map();
for (const m of jsAll.matchAll(/getElementById\(\s*["']([\w-]+)["']\s*\)/g))
  wanted.set(m[1], (wanted.get(m[1]) || 0) + 1);
const missing = [...wanted.keys()].filter(id => !declaredIds.has(id) && !madeInJs.has(id));
if (missing.length) fail("index.html", `getElementById for ids nothing ever creates: ${missing.join(", ")}`);
else ok(`${wanted.size} referenced element ids all exist`);

/* ---------- 6. no duplicate ids in the markup ---------- */
{
  const seen = new Set(), dupes = new Set();
  for (const m of markup.matchAll(/\sid="([^"]+)"/g)) {
    if (seen.has(m[1])) dupes.add(m[1]); else seen.add(m[1]);
  }
  if (dupes.size) fail("index.html", `duplicate ids: ${[...dupes].join(", ")}`);
  else ok(`${seen.size} markup ids are unique`);
}

/* ---------- 7. every view has a renderer and a section ---------- */
/* CLAUDE.md calls this out by name: a view missing from VIEW_RENDERERS never
   re-renders after a save, and the screen quietly goes stale. */
{
  const rend = /const VIEW_RENDERERS=\{([\s\S]*?)\n\};/.exec(jsAll);
  const views = /const VIEWS=\[([\s\S]*?)\];/.exec(jsAll);
  if (!rend || !views) notes.push("  --   VIEWS/VIEW_RENDERERS not found, skipped");
  else {
    const registered = new Set([...rend[1].matchAll(/^\s*(\w+):/gm)].map(m => m[1]));
    const declared = [...views[1].matchAll(/\bid:"(\w+)"/g)].map(m => m[1]);
    if (!declared.length) fail("VIEWS", "parsed no view ids — this check has gone blind, fix the pattern");
    const noRenderer = declared.filter(v => !registered.has(v));
    const noSection = declared.filter(v => !markup.includes(`id="view-${v}"`));
    if (noRenderer.length) fail("VIEW_RENDERERS", `no renderer for: ${noRenderer.join(", ")} — these go stale after a save`);
    if (noSection.length) fail("index.html", `no <section id="view-…"> for: ${noSection.join(", ")}`);
    if (!noRenderer.length && !noSection.length) ok(`${declared.length} views each have a renderer and a section`);
  }
}

/* ---------- 8. the frozen protocol identifiers are still frozen ---------- */
/* Renaming any of these orphans real data on real devices: synced phones,
   gist backups, subscribed calendars. They carry pre-rebrand names on purpose. */
{
  const frozen = ["moneymachine_v1", "fe_sync_v1", "freedom-engine.json", "@freedom-engine"];
  const gone = frozen.filter(f => !jsAll.includes(f));
  if (gone.length) fail("protocol", `frozen identifier missing — this orphans live data: ${gone.join(", ")}`);
  else ok("frozen storage/sync identifiers intact");
}

/* ---------- 9. the manifest points at files that exist ---------- */
/* A manifest naming an icon that isn't there costs you the install prompt, and
   nothing on screen ever says so. */
{
  const mf = read("manifest.webmanifest");
  if (!/<link[^>]+manifest\.webmanifest/.test(html)) fail("index.html", "does not link the manifest");
  else if (mf === null) fail("manifest.webmanifest", "linked but missing");
  else {
    let j = null;
    try { j = JSON.parse(mf); } catch (e) { fail("manifest.webmanifest", "is not valid JSON — " + e.message); }
    if (j) {
      const icons = Array.isArray(j.icons) ? j.icons : [];
      const gone = icons.map(i => i.src).filter(src => src && !existsSync(src));
      if (gone.length) fail("manifest.webmanifest", "names icons that do not exist: " + gone.join(", "));
      else if (!icons.length) fail("manifest.webmanifest", "lists no icons");
      else if (!icons.some(i => String(i.purpose || "").includes("maskable")))
        fail("manifest.webmanifest", "has no maskable icon — Android will crop the corners off a rounded one");
      else ok(`manifest lists ${icons.length} icons, all present`);
      for (const k of ["name", "start_url", "display"]) if (!j[k]) fail("manifest.webmanifest", "has no " + k);
    }
  }
}

/* ---------- 10. the typeface is actually there ---------- */
/* A @font-face pointing at a file that is not in the repo fails silently: the
   app falls back to the system stack and simply stops looking like itself. */
if (css !== null) {
  const faces = [...css.matchAll(/url\(([^)]+\.woff2?)\)/g)].map(m => m[1].replace(/["']/g, ""));
  const gone = faces.filter(f => !/^https?:/.test(f) && !existsSync(f));
  if (gone.length) fail("styles.css", "@font-face names files that are not here: " + gone.join(", "));
  else if (faces.length) {
    const remote = faces.filter(f => /^https?:/.test(f));
    if (remote.length) fail("styles.css", "a font is loaded from another server: " + remote.join(", ") +
      " — this app fetches nothing at runtime, and a font CDN would announce every launch");
    else ok(`${faces.length} self-hosted font file(s) present`);
  }
}

/* ---------- 10b. the cache keys match the files they stand for ---------- */
/* index.html and styles.css are cached independently, so a returning browser
   can pair new markup with an old stylesheet and the app simply looks broken.
   A content hash in the query makes a changed file a different URL. Forgetting
   to bump it is the whole failure mode, so it is checked rather than trusted. */
{
  const shortHash = f => createHash("sha1").update(readFileSync(f)).digest("hex").slice(0, 8);
  const stale = [];
  for (const f of ["styles.css", "data.js"]) {
    if (!existsSync(f)) continue;
    const m = new RegExp(f.replace(".", "\\.") + '\\?v=([0-9a-f]{8})').exec(html);
    const want = shortHash(f);
    if (!m) stale.push(`${f} is linked without a ?v= cache key (should be ?v=${want})`);
    else if (m[1] !== want) stale.push(`${f} is stamped ?v=${m[1]} but its contents hash to ${want}`);
  }
  if (stale.length) fail("index.html", "stale cache key — run node tools/check.mjs --stamp\n   " + stale.join("\n   "));
  else ok("asset cache keys match their files");
}

/* ---------- 9. nothing secret got committed ---------- */
{
  const leaks = [
    [/gh[pousr]_[A-Za-z0-9]{20,}/, "a GitHub token"],
    [/bridge\.simplefin\.org\/simplefin\/[A-Za-z0-9+/=]{20,}/, "a SimpleFIN access URL"],
  ];
  const hits = leaks.filter(([re]) => re.test(html) || re.test(jsAll) || (css && re.test(css)));
  if (hits.length) fail("secrets", hits.map(h => h[1]).join(", ") + " appears in the source");
  else ok("no credentials in the source");
}

/* ---------- report ---------- */
if (!quiet) console.log(notes.join("\n"));
if (problems.length) {
  console.error("\n" + problems.map(p => "  FAIL " + p).join("\n"));
  console.error(`\n${problems.length} problem${problems.length === 1 ? "" : "s"}. Nothing was committed.`);
  process.exit(1);
}
if (!quiet) console.log("\nall clear");
