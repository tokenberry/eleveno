const fs = require('fs');

/* Decorative banner for the holiday-party popup. The headline and body stay in
   HTML — crisp at any density, selectable, readable by a screen reader — so
   this carries no words at all. Drawn rather than photographed for the same
   reason the cocktail tiles are: it is the site's own palette, and nobody
   else's stock holiday scene. */
const NAVY = '#0A1A3A', NAVY_MID = '#17315F', CREAM = '#F5F0E4',
      GOLD = '#F5B70E', BLUE = '#8CBADF', PINE = '#2E5226', PINE_LIT = '#4E8034';
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

/* A pine bough: needles sprayed off both sides of a curve and swept back
   toward its start, which is what separates a garland from a fish skeleton. */
function bough(p, { n = 150, len = 26, sweep = 52, width = 2.4, taper = 0 } = {}) {
  const out = [`  <path d="M${p[0]} ${p[1]}" fill="none"/>`];
  const d = `M${p[0][0]},${p[0][1]} C${p[1][0]},${p[1][1]} ${p[2][0]},${p[2][1]} ${p[3][0]},${p[3][1]}`;
  out.length = 0;
  out.push(`  <path d="${d}" fill="none" stroke="${PINE}" stroke-width="${width * 1.6}" stroke-linecap="round"/>`);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const [x, y] = bez(p, t);
    const [tx, ty] = tangent(p, t);
    const ta = Math.atan2(ty, tx);
    /* taper shortens the needles toward the tip so a sprig comes to a point */
    const scale = 1 - taper * t;
    for (const side of [1, -1]) {
      const a = ta + side * (sweep * Math.PI / 180) + (rnd() - .5) * .34;
      const L = (len * (0.62 + rnd() * 0.38)) * scale;
      out.push(`  <line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x + Math.cos(a) * L).toFixed(1)}" y2="${(y + Math.sin(a) * L).toFixed(1)}" stroke="${rnd() > .5 ? PINE_LIT : PINE}" stroke-width="${(width * (0.75 + rnd() * .5)).toFixed(2)}" stroke-linecap="round"/>`);
    }
  }
  return out.join('\n');
}

/* A pickleball hung as a bauble. The holes are what make it read as a
   pickleball rather than a plain ornament, so they stay even at this size. */
function ornament(cx, cy, r, fill, topY) {
  const holes = [[-0.42,-0.28],[0.06,-0.46],[0.46,-0.08],[0.2,0.4],[-0.32,0.3],[-0.04,0.04]]
    .map(([dx, dy]) => `<circle cx="${(cx+dx*r).toFixed(1)}" cy="${(cy+dy*r).toFixed(1)}" r="${(r*0.115).toFixed(1)}" fill="${NAVY}" opacity=".5"/>`)
    .join('');
  return `  <line x1="${cx}" y1="${topY}" x2="${cx}" y2="${cy-r-7}" stroke="${CREAM}" stroke-width="1.6" opacity=".45"/>
  <rect x="${cx-4.5}" y="${cy-r-9}" width="9" height="9" rx="2.5" fill="${GOLD}"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>
  <circle cx="${(cx-r*0.34).toFixed(1)}" cy="${(cy-r*0.34).toFixed(1)}" r="${(r*0.19).toFixed(1)}" fill="#ffffff" opacity=".3"/>
  ${holes}`;
}

function star(cx, cy, r, fill, op) {
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i, rad = i % 2 ? r * 0.34 : r;
    pts.push(`${(cx + Math.cos(a) * rad).toFixed(1)},${(cy + Math.sin(a) * rad).toFixed(1)}`);
  }
  return `  <polygon points="${pts.join(' ')}" fill="${fill}" opacity="${op}"/>`;
}

const out = [];
out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="presentation">`);
out.push(`  <defs><radialGradient id="g" cx="50%" cy="30%" r="80%">
    <stop offset="0" stop-color="${NAVY_MID}"/><stop offset="1" stop-color="${NAVY}"/>
  </radialGradient></defs>`);
out.push(`  <rect width="${W}" height="${H}" fill="url(#g)"/>`);

// the garland: one swag across the top, dipping just past centre
out.push(bough([[-30, 24], [230, 118], [660, 118], [930, 20]], { n: 190, len: 30, sweep: 58 }));

// ornaments hanging from the swag at three depths
out.push(ornament(214, 168, 27, GOLD, 86));
out.push(ornament(452, 232, 36, CREAM, 112));
out.push(ornament(686, 162, 27, BLUE, 84));
out.push(ornament(330, 124, 18, BLUE, 98));
out.push(ornament(574, 120, 18, GOLD, 98));

// a sprig in each bottom corner, tapering to a tip
out.push(bough([[-24, H + 14], [70, H - 26], [150, H - 34], [214, H - 52]], { n: 56, len: 23, sweep: 56, taper: .45 }));
out.push(`  <g transform="translate(${W},0) scale(-1,1)">
${bough([[-24, H + 14], [70, H - 26], [150, H - 34], [214, H - 52]], { n: 56, len: 23, sweep: 56, taper: .45 })}
  </g>`);

// sparkle
[[104,252,9,.85],[800,246,9,.85],[282,300,7,.6],[620,306,7,.6],[62,150,6,.5],[846,142,6,.5],
 [368,210,5,.45],[540,196,5,.45]].forEach(([x,y,r,o]) => out.push(star(x,y,r,GOLD,o)));
[[172,196,6,.5],[742,300,6,.5]].forEach(([x,y,r,o]) => out.push(star(x,y,r,BLUE,o)));
out.push(`</svg>`);

fs.writeFileSync('/home/user/eleveno/assets/holiday-party.svg', out.join('\n') + '\n');
console.log('wrote assets/holiday-party.svg');
