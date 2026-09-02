# A-frame signs

Ten 24in x 36in portrait A-frame inserts, drawn at 96 px per inch (2304 x 3456)
in the site's own brand system — navy/gold/cream, Anton over Archivo, the
ELEVENO mark in a navy band at the top of every board.

```
*.dc.html        one artboard per sign (Claude Design canvas format)
canvas.json      how the ten lay out on the canvas, plus the placement notes
qr-*.svg         real, scannable QR codes (segno, error correction H)
```

The three `Arrow*.dc.html` boards carry a `direction` tweak (right/left) that
flips the arrow and the text alignment together, so one design covers both
sides of a walkway.

`eleveno-a-frame-signs.html` is GENERATED — it is the whole canvas (editor plus
content) published as an Artifact. Do not edit it by hand: change the `.dc.html`
files and re-seed.

## Regenerating the QR codes

```sh
pip install segno
python3 - <<'PY'
import segno
targets = {
  "qr-book.svg":       "https://eleveno.podplay.app/book",
  "qr-membership.svg": "https://eleveno.podplay.app/account/memberships/eleveno-fall-membership",
  "qr-menu.svg":       "https://www.eleveno.com/menu-food.html",
  "qr-lessons.svg":    "https://eleveno.podplay.app/community/events?tag=Instructional",
  "qr-site.svg":       "https://www.eleveno.com/",
}
for name, url in targets.items():
    segno.make(url, error='h').save(name, kind='svg', border=0, dark='#0E2350',
                                    light=None, xmldecl=False, svgns=True, omitsize=True)
PY
```

## Before printing

- The Free Pickleball board carries a dashed placeholder for which event days
  and what hours. Fill it in.
- The Open Play board states $15 a session, taken from `openPlayRate` in
  `src/data/memberships.json`. Confirm that is the walk-in price.
- The Paddle Down board carries an "OPENING SEPTEMBER 12" bar. Delete it once
  the kitchen is open — it matches the `notice` field in `menu-food.json`.
- PNG/PDF export cannot embed Google Fonts, so exports fall back to Impact for
  the Anton headlines. Headlines are sized with slack for that, but supply the
  real faces to the printer for an exact match.
