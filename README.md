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

There is no runtime JavaScript — the build runs at authoring time only.

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

## Content notes

Copy, pricing and schedule are transcribed verbatim from the design and should
be confirmed against current operations before launch. Several links are
placeholders (`href="#"`) where the design had no destination: Food Menu,
Cocktails, Gift Cards, Memberships, About, Partners, Careers, and the social
handle. The footer's social row is plain text in the design, not links.
