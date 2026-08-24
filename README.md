# ELEVENO — Home Page

Static implementation of the **Eleveno Home** design from Claude Design.

```
src/pages/*.html            page content — one file per page
src/partials/*.html         header and footer, defined once
src/layouts/base.html       the HTML shell every page is poured into
src/data/nav.json           navigation, defined once
src/data/site.json          address, phone, email and other shared values
build.js                    the build (no dependencies)

index.html                  GENERATED — do not edit by hand
assets/styles.css           all styling (extracted from the design's inline styles)
assets/*.jpg, *.png         web-optimized imagery
design/Eleveno Home.dc.html original design source (canvas format)
design/support.js           Claude Design canvas runtime, for opening the source
```

## Building

```sh
npm run build     # or: node build.js
```

Requires Node; installs nothing. Rendered HTML is written to the repo root and
committed, so the site can be opened straight off disk and served by GitHub
Pages with no configuration. Files in the root carry a "generated" banner —
edit the matching file under `src/` and rebuild.

The templating is deliberately small: `{{> name}}` includes
`src/partials/name.html`, and `{{var}}` substitutes a value from the page's
meta block or `src/data/site.json`. Each page begins with a
`<!--meta {...}-->` block carrying at least `slug`, `title` and `description`.
Meta values land in HTML verbatim, so write `&amp;` rather than a bare `&`.
The build fails loudly on a missing partial, unknown variable or absent
required meta field, rather than emitting a broken page.

**Navigation lives in `src/data/nav.json`.** A nav entry names a `page` slug
and an optional `hash`; the build resolves the href relative to whichever page
is being rendered, so a link to the home page's `#play` anchor stays a bare
fragment on the home page and becomes `index.html#play` everywhere else. Add a
page to that file once and every page's header and footer pick it up.

## The calendar

`src/data/events.json` holds the "Now Playing" list on the home page. Each
event carries its day and time, name, sign-up link, button text and whether to
highlight it; they render in the order listed. An event with no link renders
without a button, and an empty list renders a "nothing on right now" row rather
than an empty rule. `/admin` edits this as a drag-to-reorder list.

The calendar page (`calendar.html`) repeats the same list at the top, then
offers three "start here" routes into the booking system by player level.

## Private events

`src/data/private-events.json` holds the food and beverage packages, the venue
facts, the enhancement lists and the inquiry form's dropdown options.

The inquiry form is a plain HTML form marked `data-netlify="true"`, so Netlify
captures submissions and lists them under Forms — no server, no JavaScript. It
carries a honeypot field for spam and redirects to `thanks.html` on success.
Nothing is emailed automatically; set up a notification in Netlify under
**Forms → Form notifications** to have submissions reach an inbox.

## The menus

`src/data/menu-food.json` and `src/data/menu-drinks.json` hold the two menus,
transcribed from the PDFs. A section carries either priced `items`, `groups` of
priced items (Bourbon, Rye, Scotch), or a plain list of `names` (draft beer,
sodas). Items may carry `diet` codes — `veg`, `vegan`, `gf`, `ht` — and `raw`
for the shellfish/raw disclaimer; the build renders the badges and the legend
from the same table, so the two cannot disagree.

Sections are never split across the column break: a reader must not meet dishes
at the top of a column with no heading above them. That leaves the column
bottoms uneven, which is how printed menus set anyway.

## The membership season

`src/data/memberships.json` holds everything that changes between seasons —
the season's start and end dates, its label, and each plan's monthly price,
total, and subscription link. Editing that one file and rebuilding updates the
eyebrow, both plan cards, the day counts and both Get Membership buttons.

Prices are prorated: someone joining mid-season pays for the days that are
left, rounded to whole dollars. `pricing.prorate` turns that off, in which case
the full season price shows regardless of the join date.

The day count ("$295 for 8 days starting today") is the one piece of runtime
JavaScript on the site, in `assets/season.js`, loaded only by the membership
page. It has to run in the browser: a number baked in at build time would be
wrong the next day. The markup ships a correct static line ("$295 · June –
August") and the script only replaces it while the season is actually open, so
the page still reads correctly with JavaScript disabled, before the season
opens, and after it closes.

Pages opt into a script with `"script": "name"` in their meta block, which
loads `assets/name.js`. Every other page ships none.

## How this maps to the design

The design source is a Claude Design canvas file: markup wrapped in `<x-dc>`,
with a `<helmet>` block that `support.js` hoists into `<head>` at render time.
That runtime is authoring scaffolding, so the implementation drops it and
ships plain HTML instead.

Two deliberate changes were made in translation:

**Styles were extracted to a stylesheet.** The design carries every rule in
`style="..."` attributes. Inline styles can't be targeted by media queries, so
they were moved into classes in `assets/styles.css`. Desktop rendering is
unchanged.

**Responsive behavior was added.** The design is a fixed-width desktop artboard
with no media queries and hard-coded multi-column grids. Breakpoints at 1080px,
860px and 520px were added so the page works on tablets and phones; the layout
is pixel-faithful to the design at >=1240px. The nav wraps to a second row on
small screens rather than collapsing into a menu, so no JavaScript is needed.

Also added, none of which alter the design: semantic landmarks and heading
structure, alt text, `:focus-visible` outlines, a `prefers-reduced-motion`
block that stops the marquee and floating animations, intrinsic `width`/`height`
on images to prevent layout shift, `loading="lazy"` below the fold, and page
metadata (title, description, Open Graph).

## Imagery

Source photography from the design bundle was camera/print resolution — about
10MB across six files, including a 5468px JPEG and an 8630px logo displayed at
40px tall. One file, `community-champs.jpg`, was actually a PNG behind a `.jpg`
extension. All were resized and re-encoded for web delivery, bringing the page
to roughly 970KB of imagery.

`hero-net.jpg` was already correctly sized and is the untouched original.

Originals live in the design project, not in this repo.

## Hosting and the admin editor

The site deploys to Netlify. `netlify.toml` sets the build to `node build.js`
and publishes the repo root; nothing is installed at build time.

`/admin` runs Decap CMS, which edits `src/data/memberships.json` through a form
— the season's three months, the pricing rules, and each plan's Get Membership
link — and commits the change back to the branch. That commit triggers a
Netlify rebuild, so the site updates without anyone touching code.

Setting it up on Netlify, once:

1. **Add new site → Import an existing project**, and pick this repo. The build
   command and publish directory come from `netlify.toml`.
2. In the new site, open **Site configuration → Access & identity → OAuth**,
   **Install provider**, choose **GitHub**, and authorise it. This is what lets
   `/admin` sign editors in; without it the editor loads but cannot log in.
3. Visit `https://<site>.netlify.app/admin` and sign in with GitHub. Anyone who
   can push to the repo can edit.

`admin/config.yml` names the branch it writes to. It currently points at
`claude/eleveno-home-design-2ej8rc`; change `branch:` to `main` once this work
merges, or the CMS will keep editing the feature branch.

## Content notes

Copy, pricing and schedule are transcribed verbatim from the design and should
be confirmed against current operations before launch. Several links are
placeholders (`href="#"`) where the design had no destination: Food Menu,
Cocktails, Gift Cards, Memberships, About, Partners, Careers, and the social
handle. The footer's social row is plain text in the design, not links.
