"""The FreeBound mark, in one place, rendered everywhere it is needed.

The mark: a road running away from you in perspective, and a market line
climbing out over it. The road is where the app started — the freedom road on
the dashboard is the same idea — and the line is what the road is for.

Everything downstream is generated from the definition below, so the favicon,
the home-screen icon, the manifest icons and the mark in the app's own header
can never drift apart the way a folder of hand-exported PNGs does.

    python3 tools/icons.py          write the icons and print the markup
    python3 tools/icons.py --check  fail if index.html has drifted from this

Note for whoever runs this: iOS only picks up a new home-screen icon when the
app is removed and re-added. Changing apple-touch-icon.png is not free.
"""
import io
import math
import re
import sys
import urllib.parse

import cairosvg

# ---------------------------------------------------------------- the mark
# Drawn in a 64 unit box. Stroke widths are part of the drawing: the road's
# dashes get thinner as they recede, which is what sells the perspective.
ROAD = [
    ("M15 57 L26 35", 5.4),      # left edge
    ("M49 57 L38 35", 5.4),      # right edge
    ("M32 56 V50.5", 5.2),       # centre line, nearest
    ("M32 46.5 V43", 4.2),       # and receding
]
CHART = ("M15 28 L24 19 L31 24 L45 10", 5.4)
TIP, FROM, BARB_LEN, BARB_SPREAD = (45, 10), (31, 24), 7.2, 34


def barb_path(tip, frm, length, spread):
    """Two strokes swept back from the tip along the line arriving at it.

    An L-shaped bracket at the corner is the usual shortcut and it renders as a
    solid block; barbs that follow the line's own angle read as an arrow.
    """
    tx, ty = tip
    fx, fy = frm
    d = math.hypot(fx - tx, fy - ty)
    rx, ry = (fx - tx) / d, (fy - ty) / d
    pts = []
    for s in (spread, -spread):
        a = math.radians(s)
        pts.append((tx + (rx * math.cos(a) - ry * math.sin(a)) * length,
                    ty + (rx * math.sin(a) + ry * math.cos(a)) * length))
    (x1, y1), (x2, y2) = pts
    return f"M{x1:.2f} {y1:.2f} L{tx} {ty} L{x2:.2f} {y2:.2f}"


STROKES = ROAD + [CHART, (barb_path(TIP, FROM, BARB_LEN, BARB_SPREAD), 5.4)]

# The ground it sits on. A light source in the top-left and a deeper foot is
# what gives a flat square the look of an object rather than a swatch.
SURFACE = (
    "<defs><linearGradient id='g' x1='0.1' y1='0' x2='0.9' y2='1'>"
    "<stop offset='0' stop-color='#2ecf95'/>"
    "<stop offset='0.45' stop-color='#0f9f6e'/>"
    "<stop offset='1' stop-color='#046046'/></linearGradient>"
    "<radialGradient id='h' cx='0.24' cy='0.14' r='0.85'>"
    "<stop offset='0' stop-color='#ffffff' stop-opacity='0.26'/>"
    "<stop offset='0.6' stop-color='#ffffff' stop-opacity='0.04'/>"
    "<stop offset='1' stop-color='#ffffff' stop-opacity='0'/></radialGradient></defs>")


def svg(rx=15, scale=1.0):
    """The whole icon. `scale` shrinks the glyph for the maskable variant."""
    glyph = "".join(f"<path d='{d}' stroke-width='{w}'/>" for d, w in STROKES)
    t = "" if scale == 1.0 else f" transform='translate(32,32) scale({scale}) translate(-32,-32)'"
    return ("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>" + SURFACE +
            f"<rect width='64' height='64' rx='{rx}' fill='url(#g)'/>"
            f"<rect width='64' height='64' rx='{rx}' fill='url(#h)'/>"
            f"<g{t} stroke='#fff' fill='none' stroke-linecap='round' stroke-linejoin='round'>"
            + glyph + "</g></svg>")


def favicon_href():
    """The icon as a data: URI, for the <link rel=icon> in index.html."""
    return "data:image/svg+xml," + urllib.parse.quote(svg(), safe="")


def brandmark_svg():
    """The same mark at the size the app's own header draws it.

    Classed rather than coloured, so the themes can restyle it — bushido paints
    it gold. Everything is a `blade`; there is no separate head class, which is
    what left the arrow with no stroke and a default black fill in two themes.
    """
    k = 24 / 64
    out = []
    for d, w in STROKES:
        scaled = re.sub(r"-?\d+\.?\d*", lambda m: f"{float(m.group()) * k:.2f}".rstrip("0").rstrip("."), d)
        out.append(f'<path class="blade" d="{scaled}" stroke-width="{w * k:.2f}"/>')
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + "".join(out) + "</svg>"


def main():
    check = "--check" in sys.argv
    html = io.open("index.html", encoding="utf-8").read()

    want_icon = favicon_href()
    want_mark = brandmark_svg()
    drifted = []
    if want_icon not in html:
        drifted.append("the favicon data: URI")
    if html.count(want_mark) < 1:
        drifted.append("the in-app brandmark")

    if check:
        if drifted:
            print("index.html has drifted from tools/icons.py: " + ", ".join(drifted))
            sys.exit(1)
        print("icons in index.html match tools/icons.py")
        return

    for name, kw, size in [("freebound-icon-512.png", {}, 512),
                           ("icon-192.png", {}, 192),
                           ("apple-touch-icon.png", {}, 180),
                           ("icon-maskable-512.png", {"rx": 0, "scale": 0.78}, 512)]:
        cairosvg.svg2png(bytestring=svg(**kw).encode(), write_to=name,
                         output_width=size, output_height=size)
        print("wrote", name)

    print("\n--- <link rel=\"icon\"> href, paste into index.html:\n" + want_icon)
    print("\n--- brandmark markup:\n" + want_mark)


main()
