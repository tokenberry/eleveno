const fs = require('fs');
const OUT = '/home/user/eleveno/assets/cocktails';

/* One drawing vocabulary for all six, so the row reads as a set: same square,
   same navy ground, same cream line weight, same baseline. Only the glass
   silhouette, the liquid colour and the garnish change — which is exactly the
   information a menu photo would carry. */
const NAVY = '#0A1A3A', NAVY_MID = '#16305F', CREAM = '#F5F0E4', GOLD = '#F5B70E', GREEN = '#A6B62F';
const LINE = 5;

const GLASS = {
  // tall tapered tumbler
  collins: {
    path: 'M154,88 L162,324 A16,16 0 0 0 178,340 L222,340 A16,16 0 0 0 238,324 L246,88 Z',
    rim: [154, 246, 88], top: 96, bottom: 334,
  },
  // short and wide
  rocks: {
    path: 'M138,182 L146,322 A16,16 0 0 0 162,338 L238,338 A16,16 0 0 0 254,322 L262,182 Z',
    rim: [138, 262, 182], top: 190, bottom: 332,
  },
  // flared cone on a stem
  coupe: {
    path: 'M112,146 L200,266 L288,146 Z',
    rim: [112, 288, 146], top: 154, bottom: 258, stem: true,
  },
  // straight-sided mug with a handle
  mug: {
    path: 'M152,142 L152,322 A18,18 0 0 0 170,340 L230,340 A18,18 0 0 0 248,322 L248,142 Z',
    rim: [152, 248, 142], top: 150, bottom: 334, handle: true,
  },
};

/* The liquid is the glass path again, clipped to a fill line. Reusing the same
   geometry is what keeps the surface exactly flush with the glass walls at
   whatever height each drink is poured to. */
function liquid(g, level, id) {
  const y = g.top + (g.bottom - g.top) * (1 - level);
  return `  <clipPath id="c${id}"><path d="${g.path}"/></clipPath>
  <g clip-path="url(#c${id})">
    <rect x="100" y="${y.toFixed(0)}" width="200" height="${(g.bottom - y + 8).toFixed(0)}" fill="url(#g${id})"/>
    <rect x="100" y="${y.toFixed(0)}" width="200" height="7" fill="#ffffff" opacity=".30"/>
  </g>`;
}

/* Bubbles and ice are positioned by hand, so one of them will always drift
   past a glass wall. Clipping them to the same path the liquid uses means a
   stray never escapes the glass — one bubble was sitting under the mug. */
function bubbles(g, level, seedList, id) {
  const y0 = g.top + (g.bottom - g.top) * (1 - level);
  const dots = seedList.map(([x, y, r, o]) =>
    `    <circle cx="${x}" cy="${(y0 + y).toFixed(0)}" r="${r}" fill="${CREAM}" opacity="${o}"/>`).join('\n');
  return `  <g clip-path="url(#c${id})">\n${dots}\n  </g>`;
}

function ice(cubes, id) {
  const box = cubes.map(([x, y, s, rot]) =>
    `    <rect x="${x}" y="${y}" width="${s}" height="${s}" rx="4" transform="rotate(${rot} ${x + s / 2} ${y + s / 2})" fill="#ffffff" opacity=".26" stroke="#ffffff" stroke-opacity=".38" stroke-width="2"/>`).join('\n');
  return `  <g clip-path="url(#c${id})">\n${box}\n  </g>`;
}

/* A citrus wheel: rind ring, flesh, and spokes. Used for lime and lemon, which
   differ only in colour. */
function wheel(cx, cy, r, flesh, rind) {
  const spokes = Array.from({ length: 8 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 8;
    return `      <line x1="${cx.toFixed(1)}" y1="${cy.toFixed(1)}" x2="${(cx + Math.cos(a) * r * 0.72).toFixed(1)}" y2="${(cy + Math.sin(a) * r * 0.72).toFixed(1)}" stroke="${rind}" stroke-width="2.4" stroke-linecap="round" opacity=".75"/>`;
  }).join('\n');
  return `    <g>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${flesh}" stroke="${rind}" stroke-width="4"/>
${spokes}
      <circle cx="${cx}" cy="${cy}" r="${(r * 0.2).toFixed(1)}" fill="${rind}" opacity=".55"/>
    </g>`;
}

function wedge(cx, cy, r, rot, flesh, rind) {
  return `    <g transform="rotate(${rot} ${cx} ${cy})">
      <path d="M${cx},${cy} m-${r},0 a${r},${r} 0 0 1 ${r * 2},0 Z" fill="${flesh}" stroke="${rind}" stroke-width="4" stroke-linejoin="round"/>
      <line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - r * 0.78}" stroke="${rind}" stroke-width="2.4" opacity=".7"/>
    </g>`;
}

function build(d) {
  const g = GLASS[d.glass];
  const [rx0, rx1, ry] = g.rim;
  const parts = [];

  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400" role="img" aria-label="${d.label}">`);
  parts.push(`  <defs>
    <radialGradient id="bg" cx="50%" cy="38%" r="72%">
      <stop offset="0" stop-color="${NAVY_MID}"/><stop offset="1" stop-color="${NAVY}"/>
    </radialGradient>
    <linearGradient id="g${d.id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${d.top}"/><stop offset="1" stop-color="${d.bot}"/>
    </linearGradient>
  </defs>`);
  parts.push(`  <rect width="400" height="400" fill="url(#bg)"/>`);
  // the halo echoes the watermark arc used across the site
  parts.push(`  <circle cx="200" cy="196" r="150" fill="#ffffff" opacity=".045"/>`);
  /* The glassware is drawn on a 400 grid but only spans the middle ~45% of it,
     which left the drink looking lost in a 150px card. Scaling the artwork —
     not the halo, which stays put as the ground — about the glass's own centre
     fills the tile without redrawing every coordinate. */
  parts.push(`  <g transform="translate(200,216) scale(1.2) translate(-200,-216)">`);

  if (g.stem) {
    parts.push(`  <path d="M196,258 L196,318" stroke="${CREAM}" stroke-width="${LINE + 3}" stroke-linecap="round" opacity=".92"/>`);
    parts.push(`  <path d="M204,258 L204,318" stroke="${CREAM}" stroke-width="${LINE + 3}" stroke-linecap="round" opacity=".92"/>`);
    parts.push(`  <ellipse cx="200" cy="326" rx="52" ry="10" fill="none" stroke="${CREAM}" stroke-width="${LINE}" opacity=".92"/>`);
  }
  if (g.handle) {
    parts.push(`  <path d="M248,186 q58,0 58,52 q0,52 -58,52" fill="none" stroke="${CREAM}" stroke-width="${LINE}" stroke-linecap="round" opacity=".92"/>`);
  }

  parts.push(liquid(g, d.level, d.id));
  if (d.ice) parts.push(ice(d.ice, d.id));
  if (d.bubbles) parts.push(bubbles(g, d.level, d.bubbles, d.id));
  if (d.inner) parts.push(d.inner);

  // the glass outline goes on last so nothing paints over the walls
  parts.push(`  <path d="${g.path}" fill="none" stroke="${CREAM}" stroke-width="${LINE}" stroke-linejoin="round" opacity=".92"/>`);
  parts.push(`  <line x1="${rx0}" y1="${ry}" x2="${rx1}" y2="${ry}" stroke="${CREAM}" stroke-width="${LINE}" stroke-linecap="round" opacity=".92"/>`);
  if (d.rim) parts.push(d.rim);
  if (d.garnish) parts.push(d.garnish);

  parts.push(`  </g>`);
  parts.push(`</svg>`);
  return parts.join('\n') + '\n';
}

const LIME = ['#C7E06B', '#5C8A1B'], LEMON = ['#FBE58A', '#C9971A'], PINE = ['#F7D25E', '#C9891A'];

const DRINKS = [
  {
    id: 'bc', file: 'blue-crush.svg', glass: 'collins', label: 'Blue Crush, a tall blue cocktail with a lime wheel',
    top: '#3FBBF2', bot: '#0C5FB8', level: 0.84,
    bubbles: [[178, 40, 4, '.5'], [206, 74, 5, '.42'], [190, 118, 3.5, '.5'], [216, 150, 4, '.38'], [180, 176, 3, '.45']],
    ice: [[168, 128, 44, -12], [200, 176, 40, 9]],
    garnish: wheel(246, 104, 30, LIME[0], LIME[1]),
  },
  {
    id: 'cf', file: 'cucumber-fizz.svg', glass: 'collins', label: 'Cucumber Fizz, a tall pale green cocktail with a cucumber ribbon',
    top: '#DCEE9E', bot: '#8CBB43', level: 0.86,
    bubbles: [[182, 46, 4.5, '.55'], [212, 88, 4, '.45'], [192, 132, 3.5, '.55'], [176, 168, 4, '.4'], [214, 190, 3, '.5']],
    // a cucumber ribbon curled against the inside wall
    inner: `  <g clip-path="url(#ccf)">
    <path d="M172,124 q26,26 -2,54 q-28,28 0,56 q26,26 2,52" fill="none" stroke="#3F7A22" stroke-width="13" stroke-linecap="round" opacity=".8"/>
    <path d="M172,124 q26,26 -2,54 q-28,28 0,56 q26,26 2,52" fill="none" stroke="#9FCB56" stroke-width="6" stroke-linecap="round" opacity=".9"/>
  </g>`,
    garnish: wheel(244, 106, 28, '#CFE68C', '#3F7A22'),
  },
  {
    id: 'mm', file: 'milagroso-margarita.svg', glass: 'coupe', label: 'Milagroso Margarita, a salt-rimmed coupe with a lime wedge',
    top: '#FFC24D', bot: '#E4611A', level: 0.9,
    // the salt rim: a scatter of cream dots riding the rim line
    rim: `  <g>${Array.from({ length: 26 }, (_, i) => {
      const x = 112 + (176 / 25) * i, r = 2 + ((i * 7) % 5) * 0.55, dy = ((i * 5) % 7) - 3;
      return `<circle cx="${x.toFixed(1)}" cy="${(146 + dy).toFixed(1)}" r="${r.toFixed(1)}" fill="${CREAM}" opacity=".95"/>`;
    }).join('')}</g>`,
    garnish: wedge(276, 152, 30, 150, LIME[0], LIME[1]),
  },
  {
    id: 'al', file: 'agave-limonada.svg', glass: 'collins', label: 'Agave Limonada, a tall lemonade with a lemon wheel and a straw',
    top: '#FDEBA4', bot: '#EFB42E', level: 0.87,
    ice: [[166, 132, 42, 14], [198, 182, 38, -8]],
    // one continuous straw, drawn over the glass the way it sits in the drink
    garnish: `  <path d="M206,300 L250,44" stroke="${GOLD}" stroke-width="12" stroke-linecap="round" opacity=".95"/>
${wheel(248, 112, 30, LEMON[0], LEMON[1])}`,
  },
  {
    id: 'ss', file: 'spiced-n-stormy.svg', glass: 'mug', label: "Spiced 'n' Stormy, a mug of ginger beer and dark rum with a lime wedge",
    top: '#D98B45', bot: '#7A3D12', level: 0.82,
    bubbles: [[184, 52, 4, '.4'], [214, 96, 4.5, '.34'], [192, 140, 3.5, '.4'], [222, 178, 3, '.34']],
    ice: [[172, 188, 40, -10]],
    garnish: wedge(238, 148, 28, 205, LIME[0], LIME[1]),
  },
  {
    id: 'wb', file: 'whisky-beach.svg', glass: 'rocks', label: 'Whisky Beach, a rocks glass of golden whisky with a pineapple wedge',
    top: '#F3B255', bot: '#B4650F', level: 0.78,
    ice: [[164, 224, 56, -8], [206, 250, 46, 12]],
    garnish: `${wedge(252, 194, 30, 160, PINE[0], PINE[1])}
    <g stroke="${GREEN}" stroke-width="7" stroke-linecap="round" fill="none">
      <path d="M262,176 L250,140"/><path d="M262,176 L272,144"/><path d="M262,176 L286,152"/>
    </g>`,
  },
];

for (const d of DRINKS) {
  fs.writeFileSync(`${OUT}/${d.file}`, build(d));
  console.log('  ', d.file);
}
console.log('wrote', DRINKS.length, 'files');
