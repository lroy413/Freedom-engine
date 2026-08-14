"""One-shot: lift the stylesheet and the reference tables out of index.html.

The rule that matters is the comment rule. Every table in this app carries a
block comment above it explaining why the numbers are what they are, and that
prose has to travel with the table — but only if the block is COMPLETE. A
half-captured comment leaves an unclosed /* in one file and an orphan */ in the
other, which is exactly the failure this whole exercise is meant to prevent.

So: walk upward from the declaration only while the lines above form a balanced
/* ... */ block that belongs to it, and stop at the first line that doesn't.
"""
import io, re, sys

SRC = "index.html"
TABLES = ["DEFAULT_RULES", "DEFAULT_CATS", "ACCT_KINDS", "HOLDER_KINDS", "LEAF_KINDS",
          "ACCT_GROUPS", "INVEST_HINTS", "NEUTRAL_CATS", "ACCT_FILLER", "ACCT_TYPE",
          "CAT_GROUP", "DEFAULT_TIER", "BILL_FREQ", "DEBT_KINDS", "SCHED_C",
          "CAT_TO_SCHED", "US_STATES", "BIZ_KINDS", "ACCT_METHODS", "BIZ_COLORS",
          "TAX_CLASS", "GOAL_KINDS", "ICONS", "VIEWS", "NAV_DEFAULTS"]


def decl_span(lines, name):
    """The lines of `const NAME = ...` up to where its brackets balance."""
    start = next((i for i, l in enumerate(lines) if re.match(r"const " + name + r"\s*=", l)), None)
    if start is None:
        sys.exit("not found: " + name)
    depth, opened = 0, False
    for j in range(start, len(lines)):
        for ch in lines[j]:
            if ch in "{[(":
                depth += 1
                opened = True
            elif ch in "}])":
                depth -= 1
        if opened and depth == 0:
            return start, j
        if not opened and lines[j].rstrip().endswith(";"):
            return start, j
    sys.exit("unterminated: " + name)


def comment_above(lines, start):
    """Index of the first line of the complete comment block above `start`.

    Returns `start` itself when the line above is not the end of a whole block.
    """
    i = start - 1
    if i < 0 or not lines[i].rstrip().endswith("*/"):
        return start
    # walk up to the matching /*, counting so nested-looking text can't fool us
    depth = lines[i].count("*/") - lines[i].count("/*")
    while depth > 0 and i > 0:
        i -= 1
        depth += lines[i].count("*/") - lines[i].count("/*")
    if depth != 0 or "/*" not in lines[i]:
        return start                      # unbalanced — leave the whole thing alone
    # a section rule like /* ---- seed ---- */ introduces what follows, not this
    if re.match(r"\s*/\*\s*-{3,}", lines[i]):
        return start
    return i


def main():
    s = io.open(SRC, encoding="utf-8").read()

    # ---- stylesheet ----
    a = s.index("<style>")
    b = s.index("</style>") + len("</style>")
    css = s[a + len("<style>"): b - len("</style>")]
    io.open("styles.css", "w", encoding="utf-8").write(
        "/* FreeBound — the whole stylesheet.\n"
        "   Lifted out of index.html so a rule can be found without scrolling past\n"
        "   eight thousand lines of JavaScript. Nothing else changed: it is still one\n"
        "   render-blocking sheet in <head>, so there is no flash of unstyled content,\n"
        "   and no build step went near it. */\n" + css.lstrip("\n"))
    s = s[:a] + '<link rel="stylesheet" href="styles.css">' + s[b:]

    # ---- reference tables ----
    lines = s.split("\n")
    spans = []
    for name in TABLES:
        st, en = decl_span(lines, name)
        spans.append((comment_above(lines, st), en, name))
    spans.sort()

    taken = set()
    for lead, en, _ in spans:
        taken.update(range(lead, en + 1))

    chunks = ["\n".join(lines[lead:en + 1]) for lead, en, _ in spans]
    kept = [l for i, l in enumerate(lines) if i not in taken]

    head = """/* FreeBound — the tables the app is built on.
   ============================================
   Reference data only: category lists, account and entity types, Schedule C
   line numbers, state tax rates and fees, icons, the default nav. No logic, no
   dependencies, nothing that reads `db`.

   It lives apart from index.html for two reasons. These are the things most
   often edited for reasons that have nothing to do with the app — a state
   changes its rate, the IRS moves a line number — and doing that inside nine
   thousand lines is how a stray keystroke takes down a page holding real money.
   And they are worth reading on their own.

   Loaded as a plain <script> BEFORE the app, not a module: a top-level const in
   a classic script joins the shared global lexical scope, so every name here is
   visible to index.html with no import and no build step. The order is
   load-bearing — index.html cannot resolve these names until this has run.

   Every rate here is a starting point, dated 2026, and editable in the app. */

"""
    io.open("data.js", "w", encoding="utf-8").write(head + "\n\n".join(chunks) + "\n")
    out = "\n".join(kept).replace(
        "\n<script>\n",
        "\n<!-- reference tables first: index.html cannot resolve those names\n"
        "     until data.js has run, so the order is load-bearing -->\n"
        "<script src=\"data.js\"></script>\n<script>\n", 1)
    io.open(SRC, "w", encoding="utf-8").write(out)
    print("styles.css %d B  ·  data.js %d B  ·  index.html %d B" %
          (len(css), len(head) + sum(len(c) for c in chunks), len(out)))


main()
