#!/usr/bin/env node
/* Eleveno static site build.
   Sources in src/, rendered HTML written to the repo root.
   No dependencies — run with `node build.js` (or `npm run build`).

   Templating is deliberately tiny:
     {{> name}}   include src/partials/name.html
     {{var}}      substitute a value from the page's meta block or globals
   Navigation is generated from src/data/nav.json so it is defined once and
   every page's links resolve correctly relative to that page. */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const read = p => fs.readFileSync(p, 'utf8');

const nav = JSON.parse(read(path.join(SRC, 'data', 'nav.json')));
const site = JSON.parse(read(path.join(SRC, 'data', 'site.json')));
const memberships = JSON.parse(read(path.join(SRC, 'data', 'memberships.json')));
const calendar = JSON.parse(read(path.join(SRC, 'data', 'events.json')));
const reviews = JSON.parse(read(path.join(SRC, 'data', 'reviews.json')));
const visit = JSON.parse(read(path.join(SRC, 'data', 'visit.json')));
const ask = JSON.parse(read(path.join(SRC, 'data', 'ask.json')));
const events = JSON.parse(read(path.join(SRC, 'data', 'private-events.json')));
const pickleball = JSON.parse(read(path.join(SRC, 'data', 'pickleball.json')));
const menus = {
  food: JSON.parse(read(path.join(SRC, 'data', 'menu-food.json'))),
  drinks: JSON.parse(read(path.join(SRC, 'data', 'menu-drinks.json'))),
};

/* Resolve a nav entry to an href that works from the page being rendered,
   whether it is opened over http or straight off disk. Same-page entries stay
   bare fragments so the browser scrolls instead of reloading. */
function href(entry, slug) {
  // "@booking" resolves to site.bookingUrl so the destination lives in one place
  if (entry.href === '@booking') return site.bookingUrl;
  if (entry.href) return entry.href;                       // literal / placeholder
  const hash = entry.hash ? '#' + entry.hash : '';
  if (entry.page === slug) return hash || '#top';
  return entry.page + '.html' + hash;
}

/* Program anchors are derived from the program name so the footer links and
   the section ids can never drift apart. */
const slugify = s => String(s).toLowerCase().replace(/&amp;/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function renderPrimaryNav(slug) {
  return nav.primary
    .map(e => {
      const current = e.page === slug && !e.hash ? ' aria-current="page"' : '';
      return `        <a href="${esc(href(e, slug))}"${current}>${e.label}</a>`;
    })
    .join('\n');
}

// The CTA renders outside the link list so the mobile bar can keep it visible
// while the rest of the nav collapses behind the menu button.
function renderNavCta(slug) {
  const c = nav.cta;
  return `<a class="nav__cta" href="${esc(href(c, slug))}">${c.label}</a>`;
}

function renderFooterNav(slug) {
  return nav.footer.map(col => {
    const links = col.links
      .map(e => {
        const current = e.page === slug && !e.hash ? ' aria-current="page"' : '';
        return `<a href="${esc(href(e, slug))}"${current}>${e.label}</a>`;
      })
      .join('');
    return `          <div class="footer__col"><h3>${col.heading}</h3>${links}</div>`;
  }).join('\n');
}

/* Privacy and terms sit in the footer bar beside the copyright, not in the
   link columns — they are obligations, not things we are inviting people to do. */
function renderLegalNav(slug) {
  return nav.legal
    .map(e => {
      const current = e.page === slug ? ' aria-current="page"' : '';
      return `<a href="${esc(href(e, slug))}"${current}>${e.label}</a>`;
    })
    .join(' &bull; ');
}

/* Expand {{> partial}} first (recursively), then {{vars}}. */
function expand(tpl, vars, depth = 0) {
  if (depth > 10) throw new Error('partial include depth exceeded — cycle?');
  const withPartials = tpl.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, name) => {
    const p = path.join(SRC, 'partials', name + '.html');
    if (!fs.existsSync(p)) throw new Error(`missing partial: ${name}`);
    return expand(read(p), vars, depth + 1);
  });
  return withPartials.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, key) => {
    const val = key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), vars);
    if (val === undefined) throw new Error(`unknown template variable: {{${key}}}`);
    return val;
  });
}

/* Each page begins with <!--meta { ...json... }-->
   Values are substituted into HTML verbatim, so any & < > " in meta strings
   must already be written as entities (&amp;, &lt;, ...) in the JSON. */
function parsePage(file) {
  const raw = read(file);
  const m = raw.match(/^<!--meta\s*([\s\S]*?)-->\s*/);
  if (!m) throw new Error(`${path.basename(file)} is missing its <!--meta {...}--> block`);
  let meta;
  try { meta = JSON.parse(m[1]); }
  catch (e) { throw new Error(`${path.basename(file)} has invalid meta JSON: ${e.message}`); }
  for (const k of ['slug', 'title', 'description']) {
    if (!meta[k]) throw new Error(`${path.basename(file)} meta is missing "${k}"`);
  }
  return { meta, body: raw.slice(m[0].length) };
}

/* Config is authored as plain text in the CMS, so escape it on the way into
   HTML. Editors type "June – August", not "June &ndash; August". Escaping the
   ampersand is also what makes query-string URLs valid inside an href. */
function escapeDeep(value) {
  if (typeof value === 'string') return esc(value);
  if (Array.isArray(value)) return value.map(escapeDeep);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = escapeDeep(v);
    return out;
  }
  return value;
}

/* Money formats with decimals only when it actually has them: $295, $98.33. */
function money(amount, currency) {
  const n = Number(amount);
  if (!isFinite(n)) throw new Error(`not a number: ${amount}`);
  return currency + (Number.isInteger(n) ? String(n) : n.toFixed(2));
}
/* Expose display strings alongside the raw numbers the page's script needs. */
Object.assign(memberships, escapeDeep(memberships));

(function decorate() {
  const cur = memberships.pricing.currency;
  for (const plan of Object.values(memberships.plans)) {
    plan.monthly = money(plan.monthlyAmount, cur);
    plan.total = money(plan.totalAmount, cur);
  }
  memberships.pricing.prorateAttr = memberships.pricing.prorate ? 'true' : 'false';
})();

Object.assign(calendar, escapeDeep(calendar));
Object.assign(reviews, escapeDeep(reviews));
Object.assign(visit, escapeDeep(visit));
Object.assign(ask, escapeDeep(ask));
Object.assign(pickleball, escapeDeep(pickleball));

/* The response-time badge is a promise, so it renders only when both halves are
   filled in — an empty value hides it rather than showing a blank pill. */
function renderAskBadge() {
  if (!ask.badgeValue || !ask.badgeLabel) return '';
  return `        <p class="ask__badge"><span class="ask__badge-v">${ask.badgeValue}</span>` +
         `<span class="ask__badge-l">${ask.badgeLabel}</span></p>`;
}

function renderHours() {
  const list = Array.isArray(visit.hours) ? visit.hours : [];
  if (!list.length) throw new Error('visit.json has no hours');
  return list.map(h => {
    if (!h.days || !h.time) throw new Error('every hours row needs days and time');
    return `            <li><span class="hours__d">${h.days}</span><span class="hours__t">${h.time}</span></li>`;
  }).join('\n');
}

/* Google reviews. The text is quoted verbatim from the reviewer, so it is only
   ever escaped, never reflowed or trimmed. A star row is decorative once the
   rating is in the label, so the glyphs are hidden from assistive tech. */
/* Reviewers write in paragraphs; collapsing them into one block would be a
   silent edit of how they wrote it. Blank line starts a paragraph, a single
   newline is a line break. */
function paragraphs(text) {
  return String(text).trim().split(/\n{2,}/)
    .map(para => `<p>${para.split(/\n/).map(l => l.trim()).join('<br>')}</p>`)
    .join('');
}

function renderReviews() {
  const list = Array.isArray(reviews.items) ? reviews.items : [];
  if (!list.length) throw new Error('reviews.json has no items');
  return list.map(r => {
    const n = Number(r.stars);
    if (!Number.isInteger(n) || n < 1 || n > 5) throw new Error(`review by ${r.name}: stars must be 1-5, got ${r.stars}`);
    if (!r.text || !r.name) throw new Error('every review needs a name and text');
    const stars = '&#9733;'.repeat(n);
    const initial = r.name.trim().charAt(0).toUpperCase();
    const when = r.when ? `<span class="review__when">${r.when}</span>` : '';
    return `          <li class="review">
            <div class="review__head">
              <span class="review__avatar" aria-hidden="true">${initial}</span>
              <span class="review__who"><span class="review__name">${r.name}</span>${when}</span>
            </div>
            <p class="review__stars" role="img" aria-label="${n} out of 5 stars"><span aria-hidden="true">${stars}</span></p>
            <div class="review__textwrap"><blockquote class="review__text">${paragraphs(r.text)}</blockquote></div>
          </li>`;
  }).join('\n');
}

/* The strip scrolls one half of the track and loops, so a half has to be wider
   than the widest screen or the tail leaves a visible gap — the same bug the
   keyword marquee had. Four sets means a half is two sets wide. Only the first
   set is real content; the copies are hidden from assistive tech. */
const REVIEW_SETS = 4;
function renderReviewTrack() {
  const items = renderReviews();
  return Array.from({ length: REVIEW_SETS }, (_, i) =>
    `        <ul class="reviews__set"${i ? ' aria-hidden="true"' : ''}>\n${items}\n        </ul>`
  ).join('\n');
}

/* The "Now Playing" rows. Authored in src/data/events.json so events can be
   added and removed without touching markup. */
function renderEvents() {
  const list = Array.isArray(calendar.events) ? calendar.events : [];
  if (!list.length) {
    return '        <div class="sched__row sched__row--empty">\n' +
           '          <span class="sched__what">Nothing on the calendar right now — check back soon.</span>\n' +
           '        </div>';
  }
  return list.map(e => {
    const feature = e.featured ? ' sched__row--feature' : '';
    const ctaClass = e.featured ? 'sched__cta sched__cta--gold' : 'sched__cta';
    const star = e.featured ? ' <span>&#9733;</span>' : '';
    const label = (e.ctaLabel || 'Sign Up').toUpperCase();
    // an event with no link yet still renders, just without a button
    const cta = e.url
      ? `\n          <a class="${ctaClass}" href="${e.url}">${label}</a>`
      : '';
    return `        <div class="sched__row${feature}">\n` +
           `          <span class="sched__when">${e.when}</span>\n` +
           `          <span class="sched__what">${e.title}${star}</span>` +
           `${cta}\n        </div>`;
  }).join('\n');
}

for (const k of Object.keys(menus)) menus[k] = escapeDeep(menus[k]);
Object.assign(events, escapeDeep(events));

const DIET = {
  veg:   ['V',  'Vegetarian'],
  vegan: ['VE', 'Vegan'],
  gf:    ['GF', 'Gluten free'],
  gfa:   ['GFA','Gluten free available'],
  ht:    ['\u2713', 'Healthy Truth — plant based'],
};

/* A menu is a list of sections; a section holds priced items, sub-groups of
   priced items, or a plain list of names (draft beer, sodas). */
function renderMenu(menu) {
  const badges = d => (d || []).map(code => {
    const b = DIET[code];
    if (!b) throw new Error(`unknown diet code: ${code}`);
    return ` <span class="diet diet--${code}" title="${b[1]}" aria-label="${b[1]}">${b[0]}</span>`;
  }).join('');

  const item = i => {
    const raw = i.raw ? ' <span class="menu-raw" title="Shellfish / raw — see disclaimer" aria-label="Shellfish or raw, see disclaimer">&#10033;</span>' : '';
    const cls = i.featured ? ' menu-item--featured' : '';
    const flag = i.featured ? '\n            <p class="menu-item__flag">Signature</p>' : '';
    const price = i.price ? `<span class="menu-item__price">${i.price}</span>` : '';
    const dots = i.price ? '<span class="menu-item__dots" aria-hidden="true"></span>' : '';
    const desc = i.desc ? `\n            <p class="menu-item__desc">${i.desc}</p>` : '';
    const note = i.note ? `\n            <p class="menu-item__note">${i.note}</p>` : '';
    return `          <li class="menu-item${cls}">${flag}
            <p class="menu-item__top"><span class="menu-item__name">${i.name}${badges(i.diet)}${raw}</span>${dots}${price}</p>${desc}${note}
          </li>`;
  };

  const body = sec => {
    const out = [];
    if (sec.lead) out.push(`        <p class="menu-sec__lead">${sec.lead}</p>`);
    if (sec.items) out.push(`        <ul class="menu-list">\n${sec.items.map(item).join('\n')}\n        </ul>`);
    for (const g of sec.groups || []) {
      out.push(`        <p class="menu-group">${g.name}</p>`);
      out.push(`        <ul class="menu-list">\n${g.items.map(item).join('\n')}\n        </ul>`);
    }
    if (sec.names) out.push(`        <ul class="menu-names">\n${sec.names.map(n => `          <li>${n}</li>`).join('\n')}\n        </ul>`);
    if (sec.footnote) out.push(`        <p class="menu-sec__foot">${sec.footnote}</p>`);
    return out.join('\n');
  };

  return menu.sections.map(sec =>
`      <section class="menu-sec">
        <h2>${sec.name}</h2>
${body(sec)}
      </section>`).join('\n\n');
}

/* The legend lists only what the menu actually uses, in DIET declaration
   order, so editing the menu never leaves a stale key behind. */
function renderLegend(menu) {
  const items = [];
  for (const sec of menu.sections) {
    items.push(...(sec.items || []), ...(sec.groups || []).flatMap(g => g.items || []));
  }
  const used = new Set(items.flatMap(i => i.diet || []));
  for (const c of used) if (!DIET[c]) throw new Error(`unknown diet code: ${c}`);
  const out = Object.keys(DIET).filter(c => used.has(c))
    .map(c => `<span class="legend__item"><span class="diet diet--${c}" aria-hidden="true">${DIET[c][0]}</span> ${DIET[c][1]}</span>`);
  if (items.some(i => i.raw)) {
    out.push('<span class="legend__item"><span class="menu-raw" aria-hidden="true">&#10033;</span> Shellfish / raw</span>');
  }
  return out.join('');
}

/* --- pickleball page fragments --- */
/* Programs deliberately carry no times or prices: the booking system owns
   those, and a second copy here would drift out of date within a season. */
function renderPrograms() {
  return pickleball.programs.map((p, i) => `        <article class="prog" id="${slugify(p.name)}">
          <p class="prog__n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</p>
          <div class="prog__body">
            <h3>${p.name}</h3>
            <p class="prog__lead">${p.lead}</p>
            <p class="prog__text">${p.body}</p>
            <a class="prog__cta" href="${site.bookingUrl}">${p.ctaLabel} &rarr;</a>
          </div>
        </article>`).join('\n');
}
function renderCoaches() {
  return pickleball.coaches.map(c => `          <article class="coach">
            <p class="coach__name">${c.name}</p>
            <p class="coach__spec"><span>Specializes in</span> ${c.specialty}</p>
            <a class="coach__cta" href="${site.bookingUrl}">Book a lesson &rarr;</a>
          </article>`).join('\n');
}
function renderFaqs() {
  return pickleball.faqs.map(f => `          <div class="faq">
            <h3 class="faq__q">${f.q}</h3>
            ${paragraphs(f.a).replace(/\n/g, '\n            ')}
          </div>`).join('\n');
}
function renderEtiquette() {
  return pickleball.etiquette.map((e, i) => `          <article class="etq">
            <p class="etq__n" aria-hidden="true">${i + 1}</p>
            <h3>${e.name}</h3>
            <p>${e.body}</p>
          </article>`).join('\n');
}

/* --- private events page fragments --- */
/* The narrative sections below are generalised from a client proposal: they
   describe the shape of an evening and carry no prices, so they can never
   contradict the package list or the estimator. */
function renderActs() {
  return events.evening.acts.map((a, i) => `        <article class="act">
          <p class="act__n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</p>
          <div>
            <p class="act__label">${a.label}</p>
            <h3>${a.name}</h3>
            <p>${a.body}</p>
          </div>
        </article>`).join('\n');
}
function renderRunOfShow() {
  return events.runOfShow.rows.map(r => `          <li class="ros">
            <p class="ros__when">${r.when}</p>
            <div><h3>${r.name}</h3><p>${r.body}</p></div>
          </li>`).join('\n');
}
function renderSampleMenu() {
  return events.sampleMenu.parts.map(part => `        <article class="smenu">
          <h3>${part.name}</h3>
          <p class="smenu__when">${part.when}</p>
${part.groups.map(g => `          <p class="smenu__group">${g.name}</p>
          <ul class="smenu__list">
${g.items.map(i => `            <li>${i}</li>`).join('\n')}
          </ul>`).join('\n')}
        </article>`).join('\n');
}
function renderSpace() {
  return events.space.items.map(i => `        <article class="spc">
          <h3>${i.name}</h3>
          <p>${i.body}</p>
        </article>`).join('\n');
}
function renderSwag() {
  return events.swag.items.map((i, n) => `        <article class="swag">
          <p class="swag__n" aria-hidden="true">${String(n + 1).padStart(2, '0')}</p>
          <h3>${i.name}</h3>
          <p>${i.body}</p>
        </article>`).join('\n');
}

function renderPackages() {
  return events.packages.map(p => `        <article class="pkgcard">
          <h3>${p.name}</h3>
          <p class="pkgcard__lead">${p.lead}</p>
          <ul class="pkgcard__list">
${p.items.map(i => `            <li><span class="pkgcard__name">${i.name}${i.desc ? ` <small>${i.desc}</small>` : ''}</span><span class="pkgcard__dots" aria-hidden="true"></span><span class="pkgcard__price">${i.price}</span></li>`).join('\n')}
          </ul>
          <p class="pkgcard__note">${p.note}</p>
        </article>`).join('\n');
}
function renderUpgrades() {
  return events.upgrades.map(u => `        <div class="upgrade"><h3>${u.name}</h3><p>${u.body}</p></div>`).join('\n');
}
function renderVenueFeatures() {
  return events.venue.features.map(f => `          <li>${f}</li>`).join('\n');
}
function renderEnhancements() {
  return events.enhancements.groups.map(g => `        <article class="enh">
          <p class="enh__script">${g.script}</p>
          <h3>${g.name}</h3>
          <ul class="enh__list">
${g.items.map(i => `            <li>${i}</li>`).join('\n')}
          </ul>${g.note ? `\n          <p class="enh__note">*${g.note}</p>` : ''}
        </article>`).join('\n');
}
function renderOptions(list) {
  return list.map(o => `            <option value="${o}">${o}</option>`).join('\n');
}

/* The marquee scrolls one half of the track and loops. That only reads as
   continuous if a half is wider than the viewport, so the keyword list is
   repeated until it comfortably exceeds any screen. */
function renderMarquee() {
  const words = site.marquee || [];
  if (!words.length) return '';
  const set = words.map(w =>
    `<span>${w}</span><span class="marquee__dot">&#9679;</span>`).join('');
  const half = set.repeat(2);          // one half, wide enough for ultrawide displays
  return `      <div class="marquee__half">${half}</div>\n      <div class="marquee__half" aria-hidden="true">${half}</div>`;
}

/* ---------- stylesheet: route background images through Netlify Image CDN ----------
   Thirteen of the fifteen photographs are CSS backgrounds, so there is no
   srcset to reach for. Netlify's image endpoint resizes on demand and picks
   AVIF or WebP from the request's Accept header, which is where most of the
   saving comes from. Widths below are the measured maximum CSS size each image
   renders at, plus headroom, capped at the source's own width so we never ask
   the CDN to upscale.

   The endpoint only exists on Netlify. Opening a built page straight off disk
   shows no photographs — use the Netlify deploy or the bundled preview. */
/* A number is one width for every screen. An object adds a narrow-viewport
   width for the three full-bleed images, where a phone was otherwise pulling
   the desktop-sized file: the hero alone was 153 KB on a 390px screen that
   needs 58 KB. Reach for the mobile variant from source CSS by writing
   url('name.jpg@mobile') inside a max-width media query. */
const IMG_WIDTH = {
  'hero-net.jpg': { w: 1600, mobile: 600 },
  'community-champs.jpg': { w: 1500, mobile: 600 },
  'social-beers.jpg': { w: 1200, mobile: 500 },
  'courts-flag.jpg': 1000,
  'event-venue.jpg': 1000,
  'garden-party.jpg': 820,
  'event-inquiry.jpg': 800,
  'pkg-1.jpg': 700,
  'pkg-2.jpg': 700,
  'pkg-3.jpg': 700,
  'start-beginners.jpg': 700,
  'start-social.jpg': 700,
  'start-competitive.jpg': 700,
  'garden-beers.jpg': 600,
  'garden-crowd.jpg': 600,
};

/* A page names its own LCP background image. It is a CSS background, so the
   preloader cannot see it until the stylesheet has parsed — on a throttled
   phone that delayed the request by ~800ms and made it the whole LCP. The
   densities here must match the image-set the stylesheet emits, or the browser
   fetches the file twice. */
function renderPreload(meta) {
  if (!meta.preloadImage) return '';
  const file = meta.preloadImage;
  const wide = widthsFor(file, false);
  const narrow = widthsFor(file, true);
  /* imagesizes lets the preloader pick the same file the media query will:
     without it a phone preloads the desktop image and then fetches the mobile
     one as well. The 700px breakpoint must match the stylesheet's. */
  return `<link rel="preload" as="image" fetchpriority="high"\n`
    + `      imagesizes="(max-width: 700px) ${narrow.one}px, ${wide.one}px"\n`
    + `      imagesrcset="${cdnUrl(file, narrow.one)} ${narrow.one}w, ${cdnUrl(file, narrow.two)} ${narrow.two}w, `
    + `${cdnUrl(file, wide.one)} ${wide.one}w, ${cdnUrl(file, wide.two)} ${wide.two}w">`;
}

function cdnUrl(file, w) {
  return `/.netlify/images?url=/assets/${file}&w=${w}`;
}

/* Widths for one background reference. Netlify clamps to the source's own
   width, so the 2x entry can never fetch an upscale — but on mobile a full 2x
   would land back at the desktop file, so that one steps up by half instead. */
function widthsFor(file, mobile) {
  const spec = IMG_WIDTH[file];
  if (!spec) throw new Error(`no width set for background image "${file}" — add it to IMG_WIDTH in build.js`);
  if (typeof spec === 'number') return { one: spec, two: Math.min(spec * 2, 2400) };
  if (!mobile) return { one: spec.w, two: Math.min(spec.w * 2, 2400) };
  if (!spec.mobile) throw new Error(`"${file}@mobile" used but IMG_WIDTH has no mobile width for it`);
  /* Exactly double, so the preload's `sizes` can state the real slot width and
     still resolve to the same candidate the image-set picks. A 1.5x step made
     a 2x phone preload one file and then paint another. */
  return { one: spec.mobile, two: spec.mobile * 2 };
}

function buildStylesheet() {
  const src = read(path.join(SRC, 'styles.css'));
  const seen = new Set();
  const out = src.replace(/url\('([\w.-]+\.(?:jpg|jpeg|png))(@mobile)?'\)/g, (whole, file, mobile) => {
    // PNGs are the logo and the watermark: small, and they need their alpha.
    if (!/\.jpe?g$/i.test(file)) return whole;
    const { one, two } = widthsFor(file, !!mobile);
    seen.add(file);
    // image-set lets a retina screen ask for the denser file and everyone else skip it
    return `image-set(url('${cdnUrl(file, one)}') 1x, url('${cdnUrl(file, two)}') 2x)`;
  });
  const unused = Object.keys(IMG_WIDTH).filter(f => !seen.has(f));
  if (unused.length) throw new Error(`IMG_WIDTH lists images the stylesheet never uses: ${unused.join(', ')}`);
  fs.writeFileSync(path.join(ROOT, 'assets', 'styles.css'), out);
  return { count: seen.size, bytes: out.length };
}

const layout = read(path.join(SRC, 'layouts', 'base.html'));
const pageFiles = fs.readdirSync(path.join(SRC, 'pages')).filter(f => f.endsWith('.html')).sort();
if (!pageFiles.length) throw new Error('no pages found in src/pages');

const written = [];
for (const f of pageFiles) {
  const { meta: rawMeta, body } = parsePage(path.join(SRC, 'pages', f));
  /* A meta value may reference config, e.g. "{{menus.food.intro}}" as the
     description. The layout is filled in a single pass, so such a reference
     would otherwise survive into the output verbatim — two menu pages shipped
     a literal "{{menus.food.intro}}" to Google that way. Resolve meta against
     the data first; an unknown key still fails the build. */
  const metaSources = { ...site, memberships, calendar, menus, events, reviews, visit, ask };
  const meta = Object.fromEntries(Object.entries(rawMeta).map(
    ([k, v]) => [k, typeof v === 'string' ? expand(v, metaSources) : v]));
  const vars = {
    ...site,
    memberships,
    calendar,
    menus,
    events,
    pickleball,
    programs: renderPrograms(),
    coaches: renderCoaches(),
    faqs: renderFaqs(),
    etiquette: renderEtiquette(),
    acts: renderActs(),
    runOfShow: renderRunOfShow(),
    sampleMenu: renderSampleMenu(),
    spaceItems: renderSpace(),
    swagItems: renderSwag(),
    eventPackages: renderPackages(),
    eventUpgrades: renderUpgrades(),
    venueFeatures: renderVenueFeatures(),
    eventEnhancements: renderEnhancements(),
    eventTypeOptions: renderOptions(events.form.eventTypes),
    referralOptions: renderOptions(events.form.referrals),
    foodMenu: renderMenu(menus.food),
    drinksMenu: renderMenu(menus.drinks),
    foodLegend: renderLegend(menus.food),
    foodNotes: menus.food.notes.map(n => `        <p>${n}</p>`).join('\n'),
    drinksNotes: menus.drinks.notes.map(n => `        <p>${n}</p>`).join('\n'),
    eventRows: renderEvents(),
    marqueeTrack: renderMarquee(),
    reviews,
    reviewTrack: renderReviewTrack(),
    visit,
    hoursRows: renderHours(),
    ask,
    askBadge: renderAskBadge(),
    viewAllUrl: calendar.viewAllUrl || site.bookingUrl,
    ...meta,
    // sensible derivations so each page's meta block stays to the essentials
    canonical: meta.canonical || site.baseUrl + (meta.slug === 'index' ? '' : meta.slug + '.html'),
    ogTitle: meta.ogTitle || meta.title,
    ogDescription: meta.ogDescription || meta.description,
    // Open Graph needs an absolute URL — a relative one yields no preview image
    ogImage: meta.ogImage || site.baseUrl + 'assets/hero-net.jpg',
    // pages that exist only as a destination (form confirmations) stay out of
    // search results but still pass link equity through
    robots: meta.noindex ? 'noindex, follow' : 'index, follow',
    preload: renderPreload(meta),
    homeHref: meta.slug === 'index' ? '#top' : 'index.html',
    // a page opts into a script by name; every other page ships none
    scriptTag: ['nav'].concat(meta.script ? [meta.script] : [])
      .map(name => `<script src="assets/${name}.js" defer></script>`).join('\n'),
    primaryNav: renderPrimaryNav(meta.slug),
    navCta: renderNavCta(meta.slug),
    footerNav: renderFooterNav(meta.slug),
    legalNav: renderLegalNav(meta.slug),
    content: '',
  };
  vars.content = expand(body, vars);
  const html = expand(layout, vars);
  /* The ported legal text arrived with blanks the business still has to fill
     (cancellation window, governing state). Shipping "[Insert State]" on a live
     terms page is worse than not shipping the page, so fail loudly instead. */
  const blanks = html.match(/\[(?:Insert [^\]]+|24\/48|Business Address|City, State, ZIP|Email Address|Phone Number)\]/g);
  if (blanks && !process.env.ALLOW_LEGAL_BLANKS) {
    throw new Error(
      `${meta.slug}.html still has unfilled legal blanks: ${[...new Set(blanks)].join(', ')}\n` +
      `  Fill them in src/pages/${meta.slug}.html, or set ALLOW_LEGAL_BLANKS=1 to build a draft anyway.`);
  }

  const out = path.join(ROOT, meta.slug + '.html');
  fs.writeFileSync(out, html);
  written.push({ file: meta.slug + '.html', bytes: html.length, canonical: vars.canonical, noindex: !!meta.noindex });
}

const css = buildStylesheet();
console.log(`assets/styles.css: ${css.count} background image(s) routed through Netlify Image CDN`);

/* robots.txt and sitemap.xml are generated rather than hand-kept so they can
   never fall out of step with the page list. */
const indexable = written.filter(w => !w.noindex)
  .sort((a, b) => (a.file === 'index.html' ? -1 : b.file === 'index.html' ? 1 : a.file.localeCompare(b.file)));
if (!indexable.length) throw new Error('every page is noindex — refusing to write an empty sitemap');

const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  indexable.map(w => `  <url><loc>${esc(w.canonical)}</loc></url>`).join('\n') +
  '\n</urlset>\n';
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap);

// /admin is the CMS, not content; keep it out of the index
const robotsTxt = [
  'User-agent: *',
  'Allow: /',
  'Disallow: /admin/',
  '',
  'Sitemap: ' + site.baseUrl + 'sitemap.xml',
  '',
].join('\n');
fs.writeFileSync(path.join(ROOT, 'robots.txt'), robotsTxt);
console.log(`sitemap.xml: ${indexable.length} url(s); ${written.length - indexable.length} noindex page(s) excluded`);

console.log('built ' + written.length + ' page(s):');
for (const w of written) console.log('  ' + w.file.padEnd(20) + (w.bytes / 1024).toFixed(1) + ' KB');
