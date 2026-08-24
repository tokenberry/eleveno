# ELEVENO — Home Page

Static implementation of the **Eleveno Home** design from Claude Design.

```
index.html                  the page
assets/styles.css           all styling (extracted from the design's inline styles)
assets/*.jpg, *.png         web-optimized imagery
design/Eleveno Home.dc.html original design source (canvas format)
design/support.js           Claude Design canvas runtime, for opening the source
```

Open `index.html` directly in a browser, or serve the repo root with any static
file server. There is no build step and no runtime JavaScript.

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
