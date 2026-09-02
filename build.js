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
const estimator = JSON.parse(read(path.join(SRC, 'data', 'estimator.json')));
const partners = JSON.parse(read(path.join(SRC, 'data', 'partners.json')));
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
/* Anything escapeDeep touches is escaped on the way into HTML, so an entity
   written in the JSON gets escaped a second time and ships as literal
   "&amp;amp;". This has bitten three separate data files; fail the build
   instead of finding it in a screenshot. */
function assertNoEntities(name, value, path) {
  path = path || name;
  if (typeof value === 'string') {
    const m = value.match(/&(?:[a-zA-Z][a-zA-Z0-9]+|#\d+|#x[0-9a-fA-F]+);/);
    if (m) {
      throw new Error(
        `${name}: "${m[0]}" at ${path} is an HTML entity in a file that gets escaped.\n` +
        `  Write the character itself (& — é) — the build escapes it for you.`);
    }
    return;
  }
  if (Array.isArray(value)) return value.forEach((v, i) => assertNoEntities(name, v, `${path}[${i}]`));
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) assertNoEntities(name, v, `${path}.${k}`);
  }
}

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
assertNoEntities('memberships', memberships);
Object.assign(memberships, escapeDeep(memberships));

(function decorate() {
  const cur = memberships.pricing.currency;
  for (const plan of Object.values(memberships.plans)) {
    /* A season plan can be sold as one price with no monthly equivalent.
       Deriving a per-month figure anyway put a "/month" on a card that has no
       monthly option, which reads as a subscription. Absent here means absent
       in the template too: a page still asking for {{...monthly}} fails the
       build rather than printing a price nobody can actually pay. */
    if (plan.monthlyAmount != null) plan.monthly = money(plan.monthlyAmount, cur);
    plan.total = money(plan.totalAmount, cur);
  }
  memberships.pricing.prorateAttr = memberships.pricing.prorate ? 'true' : 'false';
})();

assertNoEntities('events.json', calendar);
Object.assign(calendar, escapeDeep(calendar));
assertNoEntities('reviews', reviews);
Object.assign(reviews, escapeDeep(reviews));
assertNoEntities('visit', visit);
Object.assign(visit, escapeDeep(visit));
assertNoEntities('ask', ask);
Object.assign(ask, escapeDeep(ask));
assertNoEntities('pickleball', pickleball);
Object.assign(pickleball, escapeDeep(pickleball));
assertNoEntities('estimator', estimator);
Object.assign(estimator, escapeDeep(estimator));
assertNoEntities('partners', partners);
Object.assign(partners, escapeDeep(partners));

/* The schedule's time column is a fixed width, so a long "when" wraps onto a
   second line and breaks the alignment down the whole list. Space Mono is
   monospaced, so the character count predicts the width exactly: at 15px each
   glyph advances 9.18px, and the 292px column holds 31 before it spills.
   Failing the build is better than shipping a ragged column nobody notices. */
(function checkScheduleWhen() {
  const CHARS = 31;
  const over = (calendar.events || [])
    .filter(e => [...(e.when || '')].length > CHARS)
    .map(e => `  "${e.when}" is ${[...e.when].length} characters (${e.title})`);
  if (over.length) {
    throw new Error(`schedule "when" too long for the ${CHARS}-character time column:\n`
      + over.join('\n')
      + `\nShorten it, or widen .sched__when in src/styles.css and raise CHARS to match.`);
  }
})();

/* The estimator quotes the same numbers the packages page publishes. Catch a
   drift between the two files at build time rather than in front of a customer. */
(function checkEstimatorPrices() {
  /* The estimator and the private events page publish the same numbers from the
     2026 sales kit. Parse the published strings and hold the two in step, so a
     price can never be changed in one place only. */
  const pub = {};
  for (const grp of events.packages) {
    for (const it of grp.items) {
      const p = String(it.price);
      const perHour = p.match(/\$(\d+)\/pp per hour/);
      if (perHour) { pub[it.name.toLowerCase()] = { pph: Number(perHour[1]) }; continue; }
      const byDur = [...p.matchAll(/\$(\d+)\s*\/\s*(\d)hr/g)];
      if (byDur.length) {
        const rates = {};
        for (const m of byDur) rates[m[2]] = Number(m[1]);
        pub[it.name.toLowerCase()] = { rates };
      }
    }
  }

  for (const opt of estimator.food) {
    const key = opt.label.toLowerCase();
    if (!pub[key] || !pub[key].rates) throw new Error(`estimator food "${opt.label}" has no published per-duration price on the private events page`);
    for (const [hours, rate] of Object.entries(opt.rates)) {
      if (pub[key].rates[hours] !== rate) {
        throw new Error(`price drift: estimator has ${opt.label} at $${rate} for ${hours}hr, the private events page says $${pub[key].rates[hours]}`);
      }
    }
  }

  for (const opt of estimator.beverage) {
    if (opt.pph == null) continue;                 // quoted, nothing to check
    const key = opt.label.toLowerCase();
    if (!pub[key] || pub[key].pph == null) throw new Error(`estimator bar "${opt.label}" has no published hourly price on the private events page`);
    if (pub[key].pph !== opt.pph) {
      throw new Error(`price drift: estimator has ${opt.label} at $${opt.pph}/hr, the private events page says $${pub[key].pph}/hr`);
    }
  }
})();

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

/* ---------- partners strip ---------- */

/* Logos are third-party artwork of unknown size, so read the real pixel
   dimensions off the file and write them onto the <img>. Without width/height
   the strip reflows as each logo decodes — nine of them, right above the fold
   of the community band. PNG and SVG cover everything we have; anything else
   ships without the attributes rather than guessing wrong. */
function imageSize(rel) {
  const abs = path.join(ROOT, 'assets', rel);
  if (!fs.existsSync(abs)) throw new Error(`assets/${rel} does not exist`);
  const buf = fs.readFileSync(abs);
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  /* JPEG: walk the segment chain to the start-of-frame, which is the only
     place the real pixel dimensions live. */
  if (buf[0] === 0xFF && buf[1] === 0xD8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xFF) { i++; continue; }
      const m = buf[i + 1];
      /* Standalone markers carry no length field. Treating them as if they did
         reads two bytes of unrelated data as a segment length and walks the
         pointer into the middle of the file — which is how a 2048px photo
         reported itself as 25111x46430. */
      if (m === 0xFF || m === 0x01 || (m >= 0xD0 && m <= 0xD9)) { i += 2; continue; }
      if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
        return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      }
      const len = buf.readUInt16BE(i + 2);
      if (len < 2) break;                       // malformed; stop rather than loop
      i += 2 + len;
    }
  }
  /* WebP: a RIFF container whose dimensions live in the VP8 chunk, and the three
     variants store them three different ways. Without this a .webp logo renders
     with no width/height and shifts the row as it decodes. */
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = buf.toString('ascii', 12, 16);
    if (chunk === 'VP8 ') return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') {
      const bits = buf.readUInt32LE(21);
      return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (chunk === 'VP8X') return { w: buf.readUIntLE(24, 3) + 1, h: buf.readUIntLE(27, 3) + 1 };
  }
  if (/\.svg$/i.test(rel)) {
    const head = buf.toString('utf8', 0, 2000);
    const box = head.match(/viewBox\s*=\s*["']\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)/i);
    if (box) return { w: Math.round(+box[1]), h: Math.round(+box[2]) };
  }
  return null;
}
function logoSize(file) { return imageSize(path.join('partners', file)); }

/* A partner with no artwork yet renders as a wordmark rather than a gap, so
   the strip is never waiting on a file to look finished. */
function renderPartners() {
  const list = Array.isArray(partners.items) ? partners.items : [];
  return list.map(p => {
    const inner = p.logo
      ? (function () {
          const size = logoSize(p.logo);
          const dims = size ? ` width="${size.w}" height="${size.h}"` : '';
          return `<img src="assets/partners/${p.logo}" alt="${p.name}" loading="lazy" decoding="async"${dims}>`;
        }())
      : `<span class="plogo__word">${p.name}</span>`;
    const body = p.url
      ? `<a class="plogo__link" href="${p.url}" rel="noopener noreferrer">${inner}</a>`
      : inner;
    const kind = p.logo ? '' : ' plogo--word';
    return `        <li class="plogo${kind}">${body}</li>`;
  }).join('\n');
}

/* Two partners in a strip sized for nine reads like something failed to load.
   Fewer logos get a bigger box so the row still carries the width. */
function partnersMod() {
  const n = (partners.items || []).length;
  return n && n <= 4 ? ' plogos--few' : '';
}

/* The "Now Playing" rows. Authored in src/data/events.json so events can be
   added and removed without touching markup. */
function schedRow(e) {
  const feature = e.featured ? ' sched__row--feature' : '';
  const ctaClass = e.featured ? 'sched__cta sched__cta--gold' : 'sched__cta';
  const star = e.featured ? ' <span>&#9733;</span>' : '';
  const label = (e.ctaLabel || 'Sign Up').toUpperCase();
  // an event with no link yet still renders, just without a button
  const cta = e.url ? `\n          <a class="${ctaClass}" href="${e.url}">${label}</a>` : '';
  return `        <div class="sched__row${feature}">\n` +
         `          <span class="sched__when">${e.when}</span>\n` +
         `          <span class="sched__what">${e.title}</span>` +
         `${cta}\n        </div>`;
}

function emptyRow() {
  return '        <div class="sched__row sched__row--empty">\n' +
         '          <span class="sched__what">Nothing on the calendar right now — check back soon.</span>\n' +
         '        </div>';
}

/* The home page carries a short spread, not the whole programme — the section
   says "this week" and links to the calendar for the rest. */
function renderEvents() {
  const list = (calendar.events || []).filter(e => e.home);
  return list.length ? list.map(schedRow).join('\n') : emptyRow();
}

/* The calendar page shows everything, grouped. Twenty-six rows in one list is a
   wall, so each category is its own panel and the chips above show one at a
   time. Every row stays in the markup either way: the filtering is a class on
   the wrapper, so with no JavaScript all six panels are simply visible. */
function renderCalendar() {
  const list = calendar.events || [];
  if (!list.length) return emptyRow();
  const order = calendar.categoryOrder || [];
  const cats = order.filter(c => list.some(e => e.category === c))
    .concat([...new Set(list.map(e => e.category))].filter(c => !order.includes(c)));

  const chips = ['        <div class="calfilter" id="calfilter" hidden>',
    `          <button class="calchip is-on" type="button" data-cat="all">All <span>${list.length}</span></button>`]
    .concat(cats.map(c => {
      const n = list.filter(e => e.category === c).length;
      return `          <button class="calchip" type="button" data-cat="${slugify(c)}">${c} <span>${n}</span></button>`;
    }))
    .concat('        </div>').join('\n');

  const groups = cats.map(c => {
    const rows = list.filter(e => e.category === c).map(schedRow).join('\n');
    return `        <section class="calgroup" data-cat="${slugify(c)}" aria-labelledby="cal-${slugify(c)}">\n` +
           `          <h3 class="calgroup__h" id="cal-${slugify(c)}">${c}</h3>\n` +
           `          <div class="sched">\n${rows}\n          </div>\n        </section>`;
  }).join('\n');

  return chips + '\n' + `        <div class="calgroups" id="calgroups">\n${groups}\n        </div>`;
}


for (const k of Object.keys(menus)) { assertNoEntities(`menu-${k}`, menus[k]); menus[k] = escapeDeep(menus[k]); }
assertNoEntities('private-events', events);
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

  /* A drink with a photo gets a card; the text list is unchanged for everything
     else. Switching on the data rather than a flag means the cocktails page
     turns into a picture menu the moment the photos land, and the food menu —
     which has none — never changes shape. */
  const card = i => {
    /* A section only needs one photo to become a picture menu, so a card may
       well arrive without one. Dropping the <img> keeps that item in the grid
       instead of asking imageSize for the dimensions of undefined. */
    const size = i.photo ? imageSize(i.photo) : null;
    const img = size
      ? `<img class="menu-card__img" src="assets/${i.photo}" alt="" width="${size.w}" height="${size.h}" loading="lazy" decoding="async">`
      : '';
    return `          <li class="menu-card">
            ${img}
            <div class="menu-card__body">
              <p class="menu-card__name">${i.name}${badges(i.diet)}</p>
              ${i.desc ? `<p class="menu-card__desc">${i.desc}</p>` : ''}
              ${i.price ? `<p class="menu-card__price">${i.price}</p>` : ''}
            </div>
          </li>`;
  };

  const body = sec => {
    const out = [];
    if (sec.lead) out.push(`        <p class="menu-sec__lead">${sec.lead}</p>`);
    if (sec.items && sec.items.some(i => i.photo)) {
      out.push(`        <ul class="menu-cards">\n${sec.items.map(card).join('\n')}\n        </ul>`);
    } else if (sec.items) out.push(`        <ul class="menu-list">\n${sec.items.map(item).join('\n')}\n        </ul>`);
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
/* Anything leaving eleveno.com gets rel="noopener noreferrer": the tournament
   entries live on pickleballtournaments.com. */
function progLink(l) {
  if (!l.url) {
    return `              <span class="prog__info"><b>${l.label}</b> ${l.note}</span>`;
  }
  const offsite = !/^https?:\/\/(eleveno\.com|[\w.-]*\.?eleveno\.podplay\.app)/.test(l.url);
  const rel = offsite ? ' rel="noopener noreferrer"' : '';
  return `              <a class="prog__btn" href="${l.url}"${rel}>${l.label} &rarr;</a>`;
}

function renderPrograms() {
  return pickleball.programs.map((p, i) => {
    /* One call to action, or a row of them. A program with several events has
       nothing sensible to put in a single button. */
    const actions = p.links
      ? `            <div class="prog__btns">\n${p.links.map(progLink).join('\n')}\n            </div>`
      : `            <a class="prog__cta" href="${p.ctaUrl}">${p.ctaLabel} &rarr;</a>`;
    return `        <article class="prog" id="${slugify(p.name)}">
          <p class="prog__n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</p>
          <div class="prog__body">
            <h3>${p.name}</h3>
            <p class="prog__lead">${p.lead}</p>
            <p class="prog__text">${p.body}</p>
${actions}
          </div>
        </article>`;
  }).join('\n');
}
/* A coach with no headshot yet renders without one rather than leaving a hole,
   so someone can go up before their photo is taken. Dimensions come off the
   file; the three we have are 0.67 and 0.87, and a hardcoded pair would be
   wrong for at least one of them. */
/* A full-bleed pair between two content sections — a breath, not a gallery, so
   it carries no captions. The photos are described rather than hidden: they
   show the courts and the gear, which is worth having if you cannot see them. */
function renderStrip() {
  return (pickleball.strip || []).map(x => {
    const size = imageSize(x.photo);
    return `      <img class="pstrip__img" src="assets/${x.photo}" alt="${x.alt}"`
      + ` width="${size.w}" height="${size.h}" loading="lazy" decoding="async">`;
  }).join('\n');
}

function renderCoaches() {
  return pickleball.coaches.map(c => {
    let photo = '';
    if (c.photo) {
      const s = imageSize(path.join('coaches', c.photo));
      const focus = c.focus ? ` style="object-position:${c.focus}"` : '';
      photo = `            <div class="coach__photo">\n`
        + `              <img src="assets/coaches/${c.photo}" alt="${c.name}"`
        + ` width="${s.w}" height="${s.h}"${focus} loading="lazy" decoding="async">\n`
        + `            </div>\n`;
    }
    return `          <article class="coach">\n${photo}`
      + `            <div class="coach__body">\n`
      + `              <p class="coach__name">${c.name}</p>\n`
      + `              <p class="coach__spec"><span>Specializes in</span> ${c.specialty}</p>\n`
      + `              <a class="coach__cta" href="${pickleball.lessonsUrl}">Book a lesson &rarr;</a>\n`
      + `            </div>\n          </article>`;
  }).join('\n');
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

/* Credit bundles. The row is named by the saving, so that number must be
   derived rather than typed — and `was` is checked against the open-play rate,
   which catches a typo in any of the four figures. */
/* The fall perks arrive as two named groups rather than one list, so the card
   mirrors the flyer: pickleball on one side, food and drink on the other. */
function renderPlanPerks(plan) {
  return plan.perkGroups.map(g => `            <section class="perkgrp">
              <h4>${g.name}</h4>
              <ul>
${g.items.map(i => `                <li><span>${i.t}</span>${i.d ? `<small>${i.d}</small>` : ''}</li>`).join('\n')}
              </ul>
            </section>`).join('\n');
}

function renderCredits() {
  const c = memberships.credits;
  return c.bundles.map(b => {
    const plays = b.buy + b.free;
    const save = b.was - b.now;
    if (b.was !== plays * c.openPlayRate) {
      throw new Error(`credit bundle "buy ${b.buy} get ${b.free}": ${plays} plays at $${c.openPlayRate} is $${plays * c.openPlayRate}, not the $${b.was} listed`);
    }
    if (save <= 0) throw new Error(`credit bundle "buy ${b.buy} get ${b.free}" saves nothing`);
    return `            <tr>
              <th scope="row">Save $${save}<small>${plays} open plays &mdash; buy ${b.buy}, get ${b.free} free</small></th>
              <td class="was">$${b.was}</td><td class="now">$${b.now}</td>
            </tr>`;
  }).join('\n');
}

/* --- estimator fragments ---
   Every control is rendered up front, all four steps at once. The script hides
   the steps you are not on; with no script the whole form is simply visible and
   still submits. Netlify parses the built HTML for fields, so they must all be
   present at build time regardless. */
function estCards(list, name, cls) {
  return list.map((o, i) => `            <label class="${cls}">
              <input type="radio" name="${name}" value="${o.value}"${o.minGuests ? ` data-min="${o.minGuests}"` : ''}${o.hours ? ` data-hours="${o.hours}"` : ''}${i === 0 ? ' checked' : ''}>
              <span>${o.label}${o.desc ? `<small>${o.desc}</small>` : ''}</span>
            </label>`).join('\n');
}
function estChecks(list, name) {
  return list.map(o => {
    /* An add-on may open a panel of its own (swag does). Marking the control
       here rather than matching on its label keeps the wiring in the data. */
    const ex = o.expands ? ` data-expands="${o.expands}"` : '';
    const label = `            <label class="echk">
              <input type="checkbox" name="${name}" value="${o.value || o}"${ex}>
              <span>${o.label || o}</span>
            </label>`;
    return o.expands ? label + '\n' + renderSwagPanel() : label;
  }).join('\n');
}

/* The swag panel captures what goes in the bag, not what it costs — it is
   quoted like every other add-on and feeds nothing into the total. Rendered
   inline and visible with no JavaScript; the script hides it until the parent
   box is ticked. Custom Ink pay to be here, so their mark is part of the panel
   rather than a footnote under it. */
function renderSwagPanel() {
  const s = estimator.swag;
  const rows = s.items.map(i => `                <label class="eswag__row">
                  <input type="checkbox" name="swag" value="${i.value}">
                  <span class="eswag__name">${i.label}</span>
                </label>`).join('\n');
  const by = s.poweredBy;
  return `            <div class="eswag" id="e-swag-panel">
              <p class="eswag__h">${s.heading}</p>
              <p class="eswag__note">${s.note}</p>
              <div class="eswag__rows">
${rows}
              </div>
              <p class="eswag__by">
                <span>${by.label}</span>
                <img src="assets/partners/${by.logo}" alt="${by.name}" width="490" height="182" loading="lazy" decoding="async">
              </p>
            </div>`;
}
/* Food is priced per person by duration, the bar per person per hour, so the
   card carries a rate per duration (data-pp2, data-pp3 …) or one hourly rate.
   A duration the kit does not publish simply has no attribute, and the script
   quotes rather than inventing a number. The visible price shows the shortest
   booking so the card has something concrete on it; the live figure in the
   sidebar is what actually reflects their choices. */
function estPkgCards(list, name) {
  return list.map((o, i) => {
    let attrs = '', price;
    if (o.rates) {
      attrs = Object.entries(o.rates).map(([h, v]) => ` data-pp${h}="${v}"`).join('');
      /* "from" because this is the shortest booking's rate — with JavaScript on,
         the script rewrites it to the rate for the duration they actually chose. */
      const low = Math.min(...Object.values(o.rates));
      price = `from $${low}<small>/pp</small>`;
    } else if (o.pph != null) {
      attrs = ` data-pph="${o.pph}"`;
      price = `$${o.pph}<small>/pp/hr</small>`;
    } else {
      price = 'On inquiry';
    }
    return `            <label class="epkg${o.popular ? ' epkg--popular' : ''}">
              <input type="radio" name="${name}" value="${o.value}"${attrs}${i === 0 ? ' checked' : ''}>
              <span class="epkg__body">
                <span class="epkg__name">${o.label}</span>
                <span class="epkg__desc">${o.desc}</span>
              </span>
              <span class="epkg__price">${price}</span>
            </label>`;
  }).join('\n');
}
function renderAddonGroups() {
  return estimator.addonGroups.map(g => `          <div class="eaddg">
            <p class="eaddg__h">${g.name}</p>
${estChecks(g.items, 'addons')}
          </div>`).join('\n');
}
function renderReceive() {
  return estimator.receive.map(r => `            <li><strong>${r.name}</strong><span>${r.body}</span></li>`).join('\n');
}
function renderStepDots() {
  return estimator.steps.map((s, i) => `          <li data-step="${i}"><span>${i + 1}</span>${s.label}</li>`).join('\n');
}

/* --- private events page fragments --- */

/* The page rebuilt from the 2026 sales kit mockups. Every list below is data,
   so copy and photos change in private-events.json rather than in markup. */
function peNav(active) {
  return events.nav.map(n => {
    const on = n.hash === active ? ' pestep--on' : '';
    return `        <a class="pestep${on}" href="#${n.hash}"><b>${n.n}</b> ${n.label}</a>`;
  }).join('\n');
}
function pePillars() {
  return events.hero.pillars.map(x => `          <article class="pepillar pepillar--${x.tone}">
            <h3>${x.name}</h3>
            <p>${x.body}</p>
          </article>`).join('\n');
}
function peStats() {
  return events.hero.stats.map(x => `          <p class="pestat"><span class="pestat__n pestat__n--${x.tone}">${x.n}</span><span class="pestat__l">${x.l}</span></p>`).join('\n');
}
function peSteps() {
  return events.steps.items.map((x, i) => `          <article class="pecard${i === 0 ? ' pecard--on' : ''}">
            <span class="pecard__n" aria-hidden="true">${i + 1}</span>
            <p class="pecard__label">${x.label}</p>
            <h3>${x.name}</h3>
          </article>`).join('\n');
}
function pePerfectFor() {
  return events.steps.perfectFor.map(x => `          <li>${x}</li>`).join('\n');
}
function peTiers() {
  return events.foodSection.tiers.map(t => {
    const size = imageSize(t.photo);
    return `        <article class="petier${t.popular ? ' petier--popular' : ''}">
          ${t.popular ? '<span class="petier__flag">Most Popular</span>\n          ' : ''}<img class="petier__img" src="assets/${t.photo}" alt="" width="${size.w}" height="${size.h}" loading="lazy" decoding="async">
          <div class="petier__body">
            <h3>${t.name}</h3>
            <p class="petier__desc">${t.body}</p>
            <p class="petier__price"><span class="petier__n petier__n--${t.tone}">${t.two}</span></p>
            <p class="petier__dur">2HR &middot; <b>${t.three}</b> / 3HR</p>
          </div>
        </article>`;
  }).join('\n');
}
function peGallery() {
  const g = events.gallery;
  const f = imageSize(g.feature.photo);
  const feature = `        <figure class="peshot peshot--feature">
          <img src="assets/${g.feature.photo}" alt="${g.feature.alt}" width="${f.w}" height="${f.h}" loading="lazy" decoding="async">
          <figcaption>
            <h3>${g.feature.tag}</h3>
            <p>${g.feature.body}</p>
          </figcaption>
        </figure>`;
  const tiles = g.tiles.map(t => {
    const s = imageSize(t.photo);
    return `        <figure class="peshot">
          <img src="assets/${t.photo}" alt="${t.alt}" width="${s.w}" height="${s.h}" loading="lazy" decoding="async">
          <figcaption class="peshot__tag peshot__tag--${t.tone}">${t.tag}</figcaption>
        </figure>`;
  }).join('\n');
  return feature + '\n' + tiles;
}


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
          ${i.price ? `<p class="swag__price">${i.price} <span>per guest</span></p>` : ''}
        </article>`).join('\n');
}

/* A group can sit in the data without appearing here. The food prices are still
   the estimator's reference — the build cross-checks the two — so they stay in
   packages[] even though this section no longer shows them.
   showPrices:false drops the price column and the dotted leader with it; a
   leader running to nothing reads as a missing value rather than a deliberate
   omission. */
function renderPackages() {
  return events.packages.filter(p => p.publish !== false).map(p => {
    const row = i => {
      const name = `<span class="pkgcard__name">${i.name}${i.desc ? ` <small>${i.desc}</small>` : ''}</span>`;
      if (p.showPrices === false) return `            <li class="pkgcard__row--bare">${name}</li>`;
      return `            <li>${name}<span class="pkgcard__dots" aria-hidden="true"></span>`
        + `<span class="pkgcard__price">${i.price}</span></li>`;
    };
    return `        <article class="pkgcard">
          <h3>${p.name}</h3>
          <p class="pkgcard__lead">${p.lead}</p>
          <ul class="pkgcard__list">
${p.items.map(row).join('\n')}
          </ul>
          <p class="pkgcard__note">${p.note}</p>
        </article>`;
  }).join('\n');
}

/* Dormant until the photo lands: an empty string keeps the card centred on its
   own rather than sitting in half of a two-column grid. */
function renderDrinkShot() {
  const d = events.drinks;
  if (!d.photo) return '';
  const s = imageSize(d.photo);
  return `        <img class="pkgshot" src="assets/${d.photo}" alt="${d.photoAlt}"`
    + ` width="${s.w}" height="${s.h}" loading="lazy" decoding="async">`;
}
/* One line of copy and two photographs, rather than the two text panels this
   section used to carry: the enhancements are things you look at, and a list
   of them reads shorter than it sounds. */
function renderUpgrades() {
  const u = events.upgrades;
  const shots = u.photos.map(p => {
    const s = imageSize(p.file);
    return `          <img class="upshot" src="assets/${p.file}" alt="${p.alt}"`
      + ` width="${s.w}" height="${s.h}" loading="lazy" decoding="async">`;
  }).join('\n');
  return `        <p class="upgrade__lead">${u.lead}</p>\n`
    + `        <div class="upgrade__shots">\n${shots}\n        </div>`;
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
  /* the photo is 1280px wide, so 2x of a 640px slot is exactly the source */
  'hero-bar.jpg': { w: 1440, mobile: 700 },
  /* the source is only 820px wide, so asking for more just gets 820 back */
  'block-party.jpg': { w: 820, mobile: 430 },
  'community-champs.jpg': { w: 1500, mobile: 600 },
  'social-beers.jpg': { w: 1200, mobile: 500 },
  'courts-flag.jpg': 1000,
  'event-venue.jpg': 1000,
  'event-inquiry.jpg': 800,
  'pkg-1.jpg': 700,
  'pkg-2.jpg': 700,
  'pkg-3.jpg': 700,
  'start-beginners.jpg': 700,
  'start-social.jpg': 700,
  'start-competitive.jpg': 700,
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
    pickleballStrip: renderStrip(),
    coaches: renderCoaches(),
    faqs: renderFaqs(),
    etiquette: renderEtiquette(),
    acts: renderActs(),
    runOfShow: renderRunOfShow(),
    sampleMenu: renderSampleMenu(),
    spaceItems: renderSpace(),
    swagItems: renderSwag(),
    creditRows: renderCredits(),
    estimator,
    estStepDots: renderStepDots(),
    estVenueEnv: estCards(estimator.venue.environments, 'venue-environment', 'ecard'),
    estVenueSpace: estCards(estimator.venue.spaces, 'venue-space', 'ecard'),
    estEventTypes: estCards(estimator.eventTypes, 'event-type', 'ecard'),
    estTimes: estChecks(estimator.times, 'preferred-time'),
    estDurations: estCards(estimator.durations, 'duration', 'epill'),
    estExperience: estCards(estimator.experience, 'experience', 'echip'),
    estFood: estPkgCards(estimator.food, 'food'),
    estBeverage: estPkgCards(estimator.beverage, 'beverage'),
    estAddons: renderAddonGroups(),
    estReceive: renderReceive(),
    peNavSpace: peNav("space"),
    peNavFood: peNav("food"),
    peNavDrinks: peNav("drinks"),
    peNavExtras: peNav("extras"),
    pePillars: pePillars(),
    peStats: peStats(),
    peSteps: peSteps(),
    pePerfectFor: pePerfectFor(),
    peTiers: peTiers(),
    peGallery: peGallery(),
    eventPackages: renderPackages(),
    eventDrinkShot: renderDrinkShot(),
    eventUpgrades: renderUpgrades(),
    venueFeatures: renderVenueFeatures(),
    eventEnhancements: renderEnhancements(),
    eventTypeOptions: renderOptions(events.form.eventTypes),
    referralOptions: renderOptions(events.form.referrals),
    /* An empty string when the menu has no notice, so the banner is present
       or absent with the data rather than needing the markup edited too. */
    foodNotice: menus.food.notice
      ? `      <p class="phero__notice">${menus.food.notice}</p>` : '',
    foodMenu: renderMenu(menus.food),
    drinksMenu: renderMenu(menus.drinks),
    foodLegend: renderLegend(menus.food),
    foodNotes: menus.food.notes.map(n => `        <p>${n}</p>`).join('\n'),
    drinksNotes: menus.drinks.notes.map(n => `        <p>${n}</p>`).join('\n'),
    eventRows: renderEvents(),
    calendarRows: renderCalendar(),
    marqueeTrack: renderMarquee(),
    partners,
    partnerLogos: renderPartners(),
    partnersMod: partnersMod(),
    reviews,
    reviewTrack: renderReviewTrack(),
    visit,
    hoursRows: renderHours(),
    ask,
    askBadge: renderAskBadge(),
    /* read off the file: the markup used to hardcode 1200x1400, which was wrong
       for the photo that was there and wrong again for the one that replaced it */
    askPhotoW: imageSize(ask.photo).w,
    askPhotoH: imageSize(ask.photo).h,
    viewAllUrl: calendar.viewAllUrl || site.bookingUrl,
    ...meta,
    // sensible derivations so each page's meta block stays to the essentials
    canonical: meta.canonical || site.baseUrl + (meta.slug === 'index' ? '' : meta.slug + '.html'),
    ogTitle: meta.ogTitle || meta.title,
    ogDescription: meta.ogDescription || meta.description,
    // Open Graph needs an absolute URL — a relative one yields no preview image
    ogImage: meta.ogImage || site.baseUrl + 'assets/hero-bar.jpg',
    // pages that exist only as a destination (form confirmations) stay out of
    // search results but still pass link equity through
    robots: meta.noindex ? 'noindex, follow' : 'index, follow',
    preload: renderPreload(meta),
    homeHref: meta.slug === 'index' ? '#top' : 'index.html',
    // a page opts into a script by name; every other page ships none
    fallPerks: renderPlanPerks(memberships.plans.fall),
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
