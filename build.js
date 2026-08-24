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
const events = JSON.parse(read(path.join(SRC, 'data', 'private-events.json')));
const menus = {
  food: JSON.parse(read(path.join(SRC, 'data', 'menu-food.json'))),
  drinks: JSON.parse(read(path.join(SRC, 'data', 'menu-drinks.json'))),
};

/* Resolve a nav entry to an href that works from the page being rendered,
   whether it is opened over http or straight off disk. Same-page entries stay
   bare fragments so the browser scrolls instead of reloading. */
function href(entry, slug) {
  if (entry.href) return entry.href;                       // literal / placeholder
  const hash = entry.hash ? '#' + entry.hash : '';
  if (entry.page === slug) return hash || '#top';
  return entry.page + '.html' + hash;
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function renderPrimaryNav(slug) {
  const items = nav.primary.map(e => {
    const current = e.page === slug && !e.hash ? ' aria-current="page"' : '';
    return `        <a href="${esc(href(e, slug))}"${current}>${e.label}</a>`;
  });
  const c = nav.cta;
  items.push(`        <a class="nav__cta" href="${esc(href(c, slug))}">${c.label}</a>`);
  return items.join('\n');
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
    const price = i.price ? `<span class="menu-item__price">${i.price}</span>` : '';
    const dots = i.price ? '<span class="menu-item__dots" aria-hidden="true"></span>' : '';
    const desc = i.desc ? `\n            <p class="menu-item__desc">${i.desc}</p>` : '';
    const note = i.note ? `\n            <p class="menu-item__note">${i.note}</p>` : '';
    return `          <li class="menu-item">
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

function renderLegend(codes) {
  return codes.map(c => `<span class="legend__item"><span class="diet diet--${c}" aria-hidden="true">${DIET[c][0]}</span> ${DIET[c][1]}</span>`).join('')
    + '<span class="legend__item"><span class="menu-raw" aria-hidden="true">&#10033;</span> Shellfish / raw</span>';
}

/* --- private events page fragments --- */
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

const layout = read(path.join(SRC, 'layouts', 'base.html'));
const pageFiles = fs.readdirSync(path.join(SRC, 'pages')).filter(f => f.endsWith('.html')).sort();
if (!pageFiles.length) throw new Error('no pages found in src/pages');

const written = [];
for (const f of pageFiles) {
  const { meta, body } = parsePage(path.join(SRC, 'pages', f));
  const vars = {
    ...site,
    memberships,
    calendar,
    menus,
    events,
    eventPackages: renderPackages(),
    eventUpgrades: renderUpgrades(),
    venueFeatures: renderVenueFeatures(),
    eventEnhancements: renderEnhancements(),
    eventTypeOptions: renderOptions(events.form.eventTypes),
    referralOptions: renderOptions(events.form.referrals),
    foodMenu: renderMenu(menus.food),
    drinksMenu: renderMenu(menus.drinks),
    foodLegend: renderLegend(['veg','vegan','gf','ht']),
    foodNotes: menus.food.notes.map(n => `        <p>${n}</p>`).join('\n'),
    drinksNotes: menus.drinks.notes.map(n => `        <p>${n}</p>`).join('\n'),
    eventRows: renderEvents(),
    viewAllUrl: calendar.viewAllUrl || '#book',
    ...meta,
    // sensible derivations so each page's meta block stays to the essentials
    canonical: meta.canonical || site.baseUrl + (meta.slug === 'index' ? '' : meta.slug + '.html'),
    ogTitle: meta.ogTitle || meta.title,
    ogDescription: meta.ogDescription || meta.description,
    homeHref: meta.slug === 'index' ? '#top' : 'index.html',
    // a page opts into a script by name; every other page ships none
    scriptTag: meta.script ? `<script src="assets/${meta.script}.js" defer></script>` : '',
    primaryNav: renderPrimaryNav(meta.slug),
    footerNav: renderFooterNav(meta.slug),
    content: '',
  };
  vars.content = expand(body, vars);
  const html = expand(layout, vars);
  const out = path.join(ROOT, meta.slug + '.html');
  fs.writeFileSync(out, html);
  written.push({ file: meta.slug + '.html', bytes: html.length });
}

console.log('built ' + written.length + ' page(s):');
for (const w of written) console.log('  ' + w.file.padEnd(20) + (w.bytes / 1024).toFixed(1) + ' KB');
