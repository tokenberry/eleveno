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
