# A-frame signs

Ten 24in x 36in portrait A-frame inserts, drawn at 96 px per inch (2304 x 3456)
in the site's own brand system — navy/gold/cream, Anton over Archivo, the
ELEVENO mark in a navy band at the top of every board.

```
*.dc.html        one artboard per sign (Claude Design canvas format)
canvas.json      how the ten lay out on the canvas, plus the placement notes
mark-v.png       the logo, copied from assets/ so the artboards resolve it
qr-*.svg         real, scannable QR codes (segno, error correction H)
```

The three `Arrow*.dc.html` boards carry a `direction` tweak (right/left) that
flips the arrow and the text alignment together, so one design covers both
sides of a walkway.

`eleveno-a-frame-signs.html` is GENERATED — it is the whole canvas (editor plus
content) published as an Artifact. Do not edit it by hand: change the `.dc.html`
files and re-seed.

`mark-v.png` is a copy, not a reference. The artboards load it by bare filename,
so it has to sit beside them; the seeder inlines it. If the logo in `assets/`
changes, copy it here again.

## Regenerating the QR codes

`border=4` is not optional — it is the four-module quiet zone the QR spec
requires. Without it a phone at arm's length may fail to lock on, whatever
padding the card around it has.

```sh
pip install segno
python3 - <<'PY'
import segno
targets = {
  "qr-book.svg":       "https://eleveno.podplay.app/book",
  "qr-membership.svg": "https://eleveno.podplay.app/account/memberships/eleveno-fall-membership",
  "qr-menu.svg":       "https://www.eleveno.com/menu-food.html",
  "qr-lessons.svg":    "https://eleveno.podplay.app/community/events?tag=Instructional",
  "qr-events.svg":     "https://eleveno.podplay.app/community/events",
  "qr-site.svg":       "https://www.eleveno.com/",
}
for name, url in targets.items():
    segno.make(url, error='h').save(name, kind='svg', border=4, dark='#0E2350',
                                    light=None, xmldecl=False, svgns=True, omitsize=True)
PY
```

Scan every code with a phone after regenerating. Nothing in the build checks
that a QR points where its board says it does.

## Before printing

Two figures on the boards are not settled:

- The Free Pickleball board carries a dashed placeholder for which event days
  and what hours. Nothing in `src/data/` defines "event days" — fill it in.
- The Open Play board states $15 a session, taken from `openPlayRate` in
  `src/data/memberships.json`. That value is the credit-bundle unit rate; no
  data file states a walk-in price. Confirm it before printing.

Three claims go stale on a known date:

- "OPENING SEPTEMBER 12" on the Paddle Down board — delete the bar once the
  kitchen is open. It matches the `notice` field in `menu-food.json`.
- "SATURDAYS 1–3 PM, ALL SEPTEMBER" on the Kids Play Free board, from the
  Kids Play Free note in `pickleball.json`.
- The Fall Membership board stops being sellable about 30 days before the
  season ends, because `pricing.minDays` in `memberships.json` closes the
  season below 30 days remaining.

And one production note: PNG/PDF export cannot embed Google Fonts, so exports
fall back to Impact for the Anton headlines. Headlines are sized with slack for
that, but supply the real faces to the printer for an exact match.
