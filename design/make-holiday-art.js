const fs = require('fs');

/* Decorative banner for the holiday-party popup. The headline and body stay in
   HTML — crisp at any density, selectable, readable by a screen reader — so
   this carries no words at all. Drawn rather than photographed for the same
   reason the cocktail tiles are: it is the site's own palette, and nobody
   else's stock holiday scene. */
/* Red ground rather than the brand navy: the popup it sits in is the one
   place on the site that is deliberately Christmas rather than ELEVENO, and
   a navy banner on a white card read as a web page with tinsel on it. The
   greens are lifted from the navy version's, which went muddy on red. */
const RED = '#C8233A', RED_DEEP = '#8E1120', CREAM = '#F5F0E4', WHITE = '#FFFFFF',
      GOLD = '#F5B70E', PINE = '#2F6B2A', PINE_LIT = '#55A03C',
      BERRY = '#F5F0E4', HOLE = '#7A0E1B';
const W = 900, H = 360;

/* Deterministic jitter. Needles want to look hand-scattered, but the file is
   committed and diffed, so the scatter has to come out the same every build. */
let seed = 20251225;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;

const bez = (p, t) => {
  const u = 1 - t, a = u*u*u, b = 3*u*u*t, c = 3*u*t*t, d = t*t*t;
  return [a*p[0][0]+b*p[1][0]+c*p[2][0]+d*p[3][0], a*p[0][1]+b*p[1][1]+c*p[2][1]+d*p[3][1]];
};
const tangent = (p, t) => {
  const u = 1 - t, a = 3*u*u, b = 6*u*t, c = 3*t*t;
  return [a*(p[1][0]-p[0][0])+b*(p[2][0]-p[1][0])+c*(p[3][0]-p[2][0]),
          a*(p[1][1]-p[0][1])+b*(p[2][1]-p[1][1])+c*(p[3][1]-p[2][1])];
};
const dpath = p => `M${p[0][0]},${p[0][1]} C${p[1][0]},${p[1][1]} ${p[2][0]},${p[2][1]} ${p[3][0]},${p[3][1]}`;

/* A pine bough: needles sprayed off both sides of a curve and swept back
   toward its start, which is what separates a garland from a fish skeleton. */
function bough(p, { n = 150, len = 26, sweep = 52, width = 2.4, taper = 0 } = {}) {
  const out = [`  <path d="${dpath(p)}" fill="none" stroke="${PINE}" stroke-width="${width * 1.6}" stroke-linecap="round"/>`];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const [x, y] = bez(p, t);
    const [tx, ty] = tangent(p, t);
    const ta = Math.atan2(ty, tx);
    const scale = 1 - taper * t;   // shortens toward the tip so a sprig points
    for (const side of [1, -1]) {
      const a = ta + side * (sweep * Math.PI / 180) + (rnd() - .5) * .34;
      const L = (len * (0.62 + rnd() * 0.38)) * scale;
      out.push(`  <line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x + Math.cos(a) * L).toFixed(1)}" y2="${(y + Math.sin(a) * L).toFixed(1)}" stroke="${rnd() > .5 ? PINE_LIT : PINE}" stroke-width="${(width * (0.75 + rnd() * .5)).toFixed(2)}" stroke-linecap="round"/>`);
    }
  }
  return out.join('\n');
}

/* Berry clusters tucked into the greenery. Three to a cluster, which is what
   makes them read as holly rather than as stray dots. */
function berries(p, ts) {
  return ts.map(t => {
    const [x, y] = bez(p, t);
    return [[0,0,4.2],[7,4,3.4],[-5,5,3]].map(([dx,dy,r]) =>
      `  <circle cx="${(x+dx).toFixed(1)}" cy="${(y+dy+4).toFixed(1)}" r="${r}" fill="${BERRY}"/>` +
      `<circle cx="${(x+dx-r*0.3).toFixed(1)}" cy="${(y+dy+4-r*0.3).toFixed(1)}" r="${(r*0.3).toFixed(1)}" fill="#ffffff" opacity=".35"/>`
    ).join('\n');
  }).join('\n');
}

/* A pickleball hung as a bauble. The holes are what make it read as a
   pickleball rather than a plain ornament, so they stay even at this size. */
function ornament(cx, cy, r, fill, topY) {
  const holes = [[-0.42,-0.28],[0.06,-0.46],[0.46,-0.08],[0.2,0.4],[-0.32,0.3],[-0.04,0.04]]
    .map(([dx, dy]) => `<circle cx="${(cx+dx*r).toFixed(1)}" cy="${(cy+dy*r).toFixed(1)}" r="${(r*0.115).toFixed(1)}" fill="${HOLE}" opacity=".55"/>`)
    .join('');
  return `  <line x1="${cx}" y1="${topY}" x2="${cx}" y2="${cy-r-7}" stroke="${CREAM}" stroke-width="1.6" opacity=".45"/>
  <rect x="${cx-4.5}" y="${cy-r-9}" width="9" height="9" rx="2.5" fill="${GOLD}"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>
  <circle cx="${(cx-r*0.34).toFixed(1)}" cy="${(cy-r*0.34).toFixed(1)}" r="${(r*0.19).toFixed(1)}" fill="#ffffff" opacity=".3"/>
  ${holes}`;
}

/* A bulb on the string: glow, teardrop, cap, highlight. The glow is a separate
   circle behind it so it can pulse without the bulb itself changing. */
function bulb(x, y, colour, glowId, delay) {
  return `  <circle class="glow" cx="${x.toFixed(1)}" cy="${(y+13).toFixed(1)}" r="22" fill="url(#${glowId})" style="animation-delay:${delay}s"/>
  <rect x="${(x-3.5).toFixed(1)}" y="${(y+1).toFixed(1)}" width="7" height="5" rx="1.5" fill="${GOLD}" opacity=".9"/>
  <path d="M${(x-6.5).toFixed(1)},${(y+7).toFixed(1)} q6.5,-5 13,0 q1.5,8 -6.5,13 q-8,-5 -6.5,-13 z" fill="${colour}"/>
  <circle cx="${(x-2).toFixed(1)}" cy="${(y+10).toFixed(1)}" r="2" fill="#ffffff" opacity=".45"/>`;
}

function star(cx, cy, r, fill, op, delay) {
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i, rad = i % 2 ? r * 0.34 : r;
    pts.push(`${(cx + Math.cos(a) * rad).toFixed(1)},${(cy + Math.sin(a) * rad).toFixed(1)}`);
  }
  return `  <polygon class="tw" points="${pts.join(' ')}" fill="${fill}" opacity="${op}" style="animation-delay:${delay}s"/>`;
}

function draw(ANIMATED) {
const out = [];
out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="presentation">`);
out.push(`  <defs>
    <radialGradient id="g" cx="50%" cy="28%" r="82%">
      <stop offset="0" stop-color="${RED}"/><stop offset="1" stop-color="${RED_DEEP}"/>
    </radialGradient>
    <radialGradient id="gw-gold"><stop offset="0" stop-color="${GOLD}" stop-opacity=".85"/><stop offset="1" stop-color="${GOLD}" stop-opacity="0"/></radialGradient>
    <radialGradient id="gw-cream"><stop offset="0" stop-color="${CREAM}" stop-opacity=".8"/><stop offset="1" stop-color="${CREAM}" stop-opacity="0"/></radialGradient>
    <radialGradient id="gw-white"><stop offset="0" stop-color="${WHITE}" stop-opacity=".9"/><stop offset="1" stop-color="${WHITE}" stop-opacity="0"/></radialGradient>
  </defs>`);
/* The twinkle lives inside the file: a CSS animation in an SVG still runs when
   the SVG is used as an <img>, where a script would not. A prefers-reduced-motion
   query in here does NOT work, though — Chrome does not pass the preference into
   an image document, measured at 3591 pixels still changing per frame under
   reduce. So the motion is a separate file and the popup's <picture> picks
   between them, which the page itself is able to evaluate. */
out.push(ANIMATED ? `  <style>
    .tw{animation:elv-tw 3.4s ease-in-out infinite}
    @keyframes elv-tw{0%,100%{opacity:.3}50%{opacity:1}}
    .glow{animation:elv-glow 2.8s ease-in-out infinite}
    @keyframes elv-glow{0%,100%{opacity:.45}50%{opacity:1}}
  </style>` : `  <style>
    /* the sparkles keep the opacity on their own elements; only the bulb glows
       need a resting value, halfway through what the animation would sweep */
    .glow{opacity:.75}
  </style>`);
out.push(`  <rect width="${W}" height="${H}" fill="url(#g)"/>`);

// snowfall, behind everything else
for (let i = 0; i < 70; i++) {
  const x = rnd() * W, y = rnd() * H, r = 1.4 + rnd() * 2.2;
  out.push(`  <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${WHITE}" opacity="${(0.3 + rnd() * 0.45).toFixed(2)}"/>`);
}

// the garland: two overlapping swags so it reads as a rope, not a branch
const SWAG = [[-30, 22], [230, 116], [660, 116], [930, 18]];
const SWAG2 = [[-30, 34], [240, 128], [650, 128], [930, 30]];
out.push(bough(SWAG2, { n: 150, len: 26, sweep: 62 }));
out.push(bough(SWAG,  { n: 190, len: 30, sweep: 58 }));
out.push(berries(SWAG, [0.12, 0.36, 0.62, 0.88]));

// a string of lights draped below the garland
const WIRE = [[-20, 56], [220, 196], [670, 196], [920, 50]];
out.push(`  <path d="${dpath(WIRE)}" fill="none" stroke="${CREAM}" stroke-width="1.6" opacity=".35"/>`);
const BULBS = [GOLD, CREAM, WHITE];
const GLOWS = ['gw-gold', 'gw-cream', 'gw-white'];
for (let i = 1; i <= 11; i++) {
  const t = i / 12, [x, y] = bez(WIRE, t), k = i % 3;
  out.push(bulb(x, y, BULBS[k], GLOWS[k], (i * 0.27).toFixed(2)));
}

// ornaments hanging from the garland at three depths
out.push(ornament(214, 236, 27, CREAM, 92));
out.push(ornament(452, 288, 34, WHITE, 120));
out.push(ornament(686, 232, 27, GOLD, 90));

// a sprig in each bottom corner, tapering to a tip
const SPRIG = [[-24, H + 14], [70, H - 26], [150, H - 34], [214, H - 52]];
out.push(bough(SPRIG, { n: 56, len: 23, sweep: 56, taper: .45 }));
out.push(berries(SPRIG, [0.55, 0.95]));
out.push(`  <g transform="translate(${W},0) scale(-1,1)">
${bough(SPRIG, { n: 56, len: 23, sweep: 56, taper: .45 })}
${berries(SPRIG, [0.55, 0.95])}
  </g>`);

// sparkle
[[104,268,9,.85,0],[800,262,9,.85,1.1],[286,322,7,.6,2.0],[620,326,7,.6,.6],
 [60,158,6,.5,1.6],[846,150,6,.5,2.6],[352,246,5,.45,.3],[552,238,5,.45,1.9]]
  .forEach(([x,y,r,o,d]) => out.push(star(x,y,r,CREAM,o,d)));
[[168,212,6,.5,.9],[742,316,6,.5,2.3]].forEach(([x,y,r,o,d]) => out.push(star(x,y,r,GOLD,o,d)));
out.push(`</svg>`);

return out.join('\n') + '\n';
}

/* Both files are drawn from one seed, so the needles and sparkles land in the
   same places and swapping between them is invisible but for the motion. */
for (const [file, animated] of [['holiday-party.svg', true], ['holiday-party-still.svg', false]]) {
  seed = 20251225;
  fs.writeFileSync('/home/user/eleveno/assets/' + file, draw(animated));
  console.log('wrote assets/' + file);
}
