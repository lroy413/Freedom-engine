# fonts

`instrument-sans.woff2` — Instrument Sans, the app's typeface.

Designed by Rodrigo Fuenzalida and Jordan Egstad. Licensed under the SIL Open
Font License 1.1, the full text of which is in `OFL.txt` beside it.

This is the Latin subset of the variable font (weight axis 400–700), about 32 KB.
It is **served from this repo, not from a font CDN**, on purpose: the whole
premise of the app is that using it tells nobody anything. A stylesheet link to
someone else's server would announce every launch to them, which is a strange
thing for a private ledger to do — and it would stop working offline, which the
app otherwise does completely.

Weights above 700 in the stylesheet clamp to 700; the axis stops there.
