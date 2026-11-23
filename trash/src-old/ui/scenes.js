// Original dusk illustrations for the title, loading and hub screens (inline SVG, drawn in code): the
// Gateway at sunset, the Sea Link at night, a local-train street, Marine Drive. Everything is made up
// here; no photographs. Lights and windows come from a seeded random so a scene looks the same every time.

const rng = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const f = (n) => Math.round(n * 10) / 10;

const defs = (id, stops) => `<defs><linearGradient id="sky${id}" x1="0" y1="0" x2="0" y2="1">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>
  <radialGradient id="glow${id}"><stop offset="0" stop-color="#ffd27a" stop-opacity=".95"/><stop offset=".45" stop-color="#ff8a3c" stop-opacity=".5"/><stop offset="1" stop-color="#ff3d8b" stop-opacity="0"/></radialGradient>
  <radialGradient id="red${id}"><stop offset="0" stop-color="#ff3b30"/><stop offset=".4" stop-color="#ff3b30" stop-opacity=".55"/><stop offset="1" stop-color="#ff3b30" stop-opacity="0"/></radialGradient>
  <filter id="blur${id}"><feGaussianBlur stdDeviation="6"/></filter><filter id="soft${id}"><feGaussianBlur stdDeviation="2"/></filter></defs>`;

/** Rows of buildings with lit windows. */
function skyline(seed, x0, x1, base, minH, maxH, fill, lit, density = 0.35) {
  const r = rng(seed); let x = x0, out = '';
  while (x < x1) {
    const w = 30 + r() * 70, h = minH + r() * (maxH - minH);
    out += `<rect x="${f(x)}" y="${f(base - h)}" width="${f(w)}" height="${f(h)}" fill="${fill}"/>`;
    if (r() < 0.25) out += `<rect x="${f(x + w * 0.4)}" y="${f(base - h - 18)}" width="3" height="18" fill="${fill}"/>`;
    for (let wy = base - h + 10; wy < base - 6; wy += 13) for (let wx = x + 6; wx < x + w - 8; wx += 11) if (r() < density) out += `<rect x="${f(wx)}" y="${f(wy)}" width="4" height="6" fill="${lit}" opacity="${f(0.5 + r() * 0.5)}"/>`;
    x += w + r() * 6;
  }
  return out;
}

/** A coconut palm silhouette. */
function palm(x, y, s, fill, lean = 1) {
  const fr = [-150, -118, -85, -50, -20, 15, 40, 70].map((a, i) => {
    const r = (a * Math.PI) / 180, L = 150 * s * (0.8 + (i % 3) * 0.12);
    const ex = x + lean * 30 * s + Math.cos(r) * L, ey = y - 330 * s + Math.sin(r) * L * 0.55 + L * 0.35;
    const cx = x + lean * 30 * s + Math.cos(r) * L * 0.55, cy = y - 330 * s + Math.sin(r) * L * 0.5 - 28 * s;
    return `<path d="M${f(x + lean * 30 * s)} ${f(y - 330 * s)} Q${f(cx)} ${f(cy)} ${f(ex)} ${f(ey)} Q${f(cx)} ${f(cy + 26 * s)} ${f(x + lean * 30 * s)} ${f(y - 322 * s)}Z" fill="${fill}"/>`;
  }).join('');
  return `<path d="M${f(x)} ${f(y)} Q${f(x + lean * 14 * s)} ${f(y - 170 * s)} ${f(x + lean * 30 * s)} ${f(y - 330 * s)}" stroke="${fill}" stroke-width="${f(10 * s)}" fill="none" stroke-linecap="round"/>${fr}`;
}

/** Scattered glowing lights (windows far away, street lamps). */
function lights(seed, n, x0, x1, y0, y1, colors, r0 = 1.5, r1 = 3.5) {
  const r = rng(seed); let out = '';
  for (let i = 0; i < n; i++) out += `<circle cx="${f(x0 + r() * (x1 - x0))}" cy="${f(y0 + r() * (y1 - y0))}" r="${f(r0 + r() * (r1 - r0))}" fill="${colors[Math.floor(r() * colors.length)]}" opacity="${f(0.5 + r() * 0.5)}"/>`;
  return out;
}

/** Light streaks on water, below a row of lights. */
function reflections(seed, n, x0, x1, y0, y1, colors) {
  const r = rng(seed); let out = '';
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0), len = 14 + r() * 50;
    out += `<rect x="${f(x)}" y="${f(y)}" width="${f(2 + r() * 3)}" height="${f(len)}" rx="2" fill="${colors[Math.floor(r() * colors.length)]}" opacity="${f(0.18 + r() * 0.3)}"/>`;
  }
  return out;
}

/** A kaali-peeli taxi seen from the side, black with a yellow roof, red tail lamps glowing. */
function taxi(x, y, s, id, flip = false) {
  return `<g transform="translate(${x} ${y}) scale(${flip ? -s : s} ${s})">
    <ellipse cx="260" cy="150" rx="300" ry="16" fill="#000" opacity=".5"/>
    <rect x="10" y="62" width="500" height="78" rx="30" fill="#1b1428" stroke="#ff7ab8" stroke-opacity=".55" stroke-width="3"/>
    <path d="M120 66 L170 14 H340 L400 66Z" fill="#f2c200" stroke="#1b1428" stroke-width="9"/>
    <path d="M150 62 L184 24H245V62Z M262 62V24H335L378 62Z" fill="#3a2a55"/><path d="M150 62 L184 24H245V62Z" fill="#ffb347" opacity=".18"/>
    <circle cx="125" cy="140" r="34" fill="#0d0a14" stroke="#b9b4c6" stroke-width="7"/><circle cx="395" cy="140" r="34" fill="#0d0a14" stroke="#b9b4c6" stroke-width="7"/>
    <circle cx="14" cy="92" r="46" fill="url(#red${id})"/><rect x="4" y="84" width="16" height="14" rx="5" fill="#ff5148"/>
    <circle cx="506" cy="96" r="30" fill="#ffe9a8" opacity=".35"/><rect x="498" y="90" width="12" height="12" rx="6" fill="#fff3c8"/>
    <rect x="230" y="100" width="64" height="16" rx="3" fill="#f2c200"/><text x="262" y="113" font-family="Arial Black,Arial" font-size="12" text-anchor="middle" fill="#111">MH 01 T</text></g>`;
}

const SKY_DUSK = [[0, '#1b0f3d'], [0.35, '#6a2275'], [0.6, '#d44a7a'], [0.8, '#ff8a3c'], [1, '#ffcf6b']];
const SKY_NIGHT = [[0, '#060616'], [0.45, '#1a1040'], [0.75, '#5a1f6b'], [1, '#c23d86']];

/** The Gateway at sunset, a taxi on the sea front. */
function gateway() {
  const id = 'A';
  return `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">${defs(id, SKY_DUSK)}
  <rect width="1600" height="900" fill="url(#sky${id})"/>
  <circle cx="860" cy="470" r="360" fill="url(#glow${id})"/><circle cx="860" cy="470" r="170" fill="#ffb347"/>
  ${lights(3, 14, 100, 1500, 60, 340, ['#ffe6c0'], 1, 2)}
  <g fill="#3a1450" opacity=".85">${skyline(11, 1030, 1600, 640, 70, 250, '#34114a', '#ffcf8a', 0.3)}</g>
  <g>${skyline(5, 0, 640, 640, 40, 120, '#2a0f3d', '#ffcf8a', 0.25)}</g>
  <g fill="#1c0d2e"><rect x="690" y="470" width="340" height="170"/><rect x="676" y="430" width="52" height="210"/><rect x="992" y="430" width="52" height="210"/>
    <path d="M676 430 h52 l-6 -26 h-40z M992 430 h52 l-6 -26 h-40z"/><ellipse cx="702" cy="396" rx="24" ry="30"/><ellipse cx="1018" cy="396" rx="24" ry="30"/>
    <rect x="700" y="356" width="4" height="22"/><rect x="1016" y="356" width="4" height="22"/><rect x="740" y="452" width="240" height="22"/><rect x="800" y="420" width="120" height="34"/><ellipse cx="860" cy="414" rx="42" ry="18"/></g>
  <path d="M790 640 V548 a70 70 0 0 1 140 0 V640Z" fill="#ffb347"/><path d="M806 640 V552 a54 54 0 0 1 108 0 V640Z" fill="#ff7a2e"/>
  <rect x="0" y="640" width="1600" height="150" fill="#2b1342"/><rect x="0" y="640" width="1600" height="150" fill="url(#sky${id})" opacity=".25"/>
  <g filter="url(#soft${id})">${reflections(4, 90, 560, 1180, 650, 760, ['#ffb347', '#ff7a2e', '#ffd27a'])}</g>
  ${lights(8, 40, 0, 1600, 636, 646, ['#ffd27a', '#ff9a3c'], 1.5, 3)}
  <path d="M0 740 L1600 700 V900 H0Z" fill="#150a22"/><path d="M0 742 L1600 702" stroke="#d9d4e2" stroke-width="10" stroke-dasharray="46 40" opacity=".85"/>
  <path d="M0 790 Q600 760 1600 760 V900 H0Z" fill="#0d0617"/>
  ${taxi(600, 636, 0.98, id)}
  <g fill="#0b0414">${palm(120, 700, 1.7, '#0b0414', 1)}${palm(1520, 760, 1.5, '#0b0414', -1)}</g>
  <g fill="none" stroke="#2a1038" stroke-width="3" stroke-linecap="round" opacity=".8"><path d="M520 150 q10 -10 20 0 q10 -10 20 0"/><path d="M1180 120 q8 -8 16 0 q8 -8 16 0"/><path d="M1260 200 q8 -8 16 0 q8 -8 16 0"/></g></svg>`;
}

/** The Sea Link at night, a man sitting on the sea wall. */
function seaLink() {
  const id = 'B';
  const cables = (px) => [-1, 1].map((s) => Array.from({ length: 9 }, (_, i) => `<line x1="${px}" y1="${250 + i * 8}" x2="${px + s * (60 + i * 44)}" y2="620" />`).join('')).join('');
  return `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">${defs(id, SKY_NIGHT)}
  <rect width="1600" height="900" fill="url(#sky${id})"/>
  ${lights(21, 70, 0, 1600, 0, 380, ['#ffffff', '#cdbfff'], 0.6, 1.4)}
  <circle cx="1040" cy="590" r="260" fill="url(#glow${id})" opacity=".35"/>
  <g>${skyline(31, 0, 820, 620, 60, 330, '#150b30', '#ffd68a', 0.4)}</g>
  <g>${skyline(33, 1400, 1600, 620, 40, 150, '#150b30', '#ffd68a', 0.4)}</g>
  <g stroke="#ff9fd0" stroke-width="3" opacity=".95" fill="none">
    <path d="M1180 620 L1214 250 L1248 620 M1180 620 L1214 250" stroke-width="8" stroke="#ffd2ea"/><path d="M1380 620 L1414 250 L1448 620" stroke-width="8" stroke="#ffd2ea"/>
    <g stroke-width="1.6" stroke="#ffb8de" opacity=".9">${cables(1214)}${cables(1414)}</g></g>
  <rect x="700" y="616" width="900" height="10" fill="#2a1450"/><rect x="700" y="612" width="900" height="4" fill="#ffd27a"/>
  <g>${Array.from({ length: 64 }, (_, i) => `<circle cx="${710 + i * 14}" cy="610" r="2.6" fill="#ffe9b0"/>`).join('')}</g>
  <rect x="0" y="626" width="1600" height="274" fill="#0c0820"/><rect x="0" y="626" width="1600" height="120" fill="url(#sky${id})" opacity=".18"/>
  <g filter="url(#soft${id})">${reflections(9, 120, 0, 1600, 636, 760, ['#ffd27a', '#ff6fb0', '#ffffff', '#ff9a3c'])}</g>
  <path d="M0 800 L1600 760 V900 H0Z" fill="#0a0616"/><path d="M0 802 L1600 762" stroke="#d9d4e2" stroke-width="8" stroke-dasharray="40 36" opacity=".5"/>
  <rect x="820" y="716" width="600" height="36" rx="6" fill="#07040f"/><rect x="820" y="712" width="600" height="5" rx="2" fill="#ff4fd8" opacity=".35"/>
  <g fill="#07040f"><circle cx="1040" cy="548" r="33"/><path d="M1004 574 h72 l6 14 q50 18 44 124 h-176 q-8 -106 44 -124z"/><path d="M1004 588 q-52 22 -44 124" fill="none" stroke="#ff4fd8" stroke-width="3" opacity=".5"/><path d="M1076 586 q52 22 44 126" fill="none" stroke="#7ae6ff" stroke-width="2" opacity=".35"/></g>
  <g fill="#0b0414">${palm(80, 780, 1.6, '#0b0414', 1)}</g></svg>`;
}

/** A street under a local-train viaduct, with a taxi. */
function train() {
  const id = 'C';
  const win = Array.from({ length: 17 }, (_, i) => `<rect x="${24 + i * 58}" y="150" width="38" height="34" rx="5" fill="#ffd68a"/><rect x="${24 + i * 58}" y="150" width="38" height="34" rx="5" fill="#ff9a3c" opacity=".35"/>`).join('');
  return `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">${defs(id, SKY_NIGHT)}
  <rect width="1600" height="900" fill="url(#sky${id})"/><circle cx="1100" cy="560" r="300" fill="url(#glow${id})" opacity=".4"/>
  ${lights(41, 40, 0, 1600, 0, 300, ['#fff'], 0.5, 1.2)}
  <g>${skyline(45, 600, 1600, 640, 120, 420, '#190c34', '#ffcf8a', 0.38)}</g>
  <g><rect x="-20" y="108" width="1010" height="118" rx="22" fill="#e9dfee"/><rect x="-20" y="196" width="1010" height="16" fill="#a21caf"/><rect x="-20" y="132" width="1010" height="6" fill="#a21caf" opacity=".6"/>${win}
    <rect x="-20" y="226" width="1010" height="34" fill="#1d1033"/><rect x="-20" y="226" width="1010" height="4" fill="#ff4fd8" opacity=".5"/></g>
  <g fill="#150a2a">${Array.from({ length: 11 }, (_, i) => `<rect x="${40 + i * 96}" y="258" width="26" height="390"/>`).join('')}</g>
  <rect x="0" y="640" width="1600" height="260" fill="#120a24"/>
  <g>${Array.from({ length: 7 }, (_, i) => `<rect x="${30 + i * 130}" y="${470 - (i % 3) * 30}" width="104" height="${170 + (i % 3) * 30}" fill="${['#2a1450', '#3a1a5e', '#24103f'][i % 3]}"/><rect x="${40 + i * 130}" y="${500 - (i % 3) * 30}" width="84" height="26" rx="3" fill="${['#ff4f9a', '#ffd27a', '#7ae6ff'][i % 3]}" opacity=".85"/>`).join('')}</g>
  <g><rect x="1130" y="410" width="250" height="150" rx="10" fill="#1d57a8" stroke="#e8edf5" stroke-width="6"/><text x="1255" y="480" font-size="48" fill="#fff" text-anchor="middle" font-family="Noto Sans Devanagari,Mangal,sans-serif" font-weight="700">मुंबई</text><text x="1255" y="535" font-size="32" fill="#fff" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700">MUMBAI</text><rect x="1246" y="560" width="14" height="260" fill="#241638"/></g>
  <g fill="#0b0414">${palm(1480, 740, 1.7, '#0b0414', -1)}</g>
  <g filter="url(#soft${id})">${reflections(49, 70, 0, 1600, 700, 860, ['#ff4f9a', '#ffd27a', '#ff3b30'])}</g>
  ${taxi(640, 630, 1.15, id)}</svg>`;
}

/** Marine Drive: the curve of lights along the bay. */
function marineDrive() {
  const id = 'D';
  const road = 'M1600 900 C1300 820 1000 700 520 640 C300 616 100 620 -40 640';
  return `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">${defs(id, [[0, '#0b0724'], [0.4, '#3a1a6e'], [0.7, '#b8357f'], [1, '#ff9a5c']])}
  <rect width="1600" height="900" fill="url(#sky${id})"/>
  ${lights(61, 50, 0, 1600, 0, 300, ['#ffffff', '#e0d6ff'], 0.5, 1.3)}
  <g>${skyline(63, 760, 1600, 640, 100, 420, '#150a2e', '#ffe0a0', 0.42)}</g>
  <g>${skyline(65, 300, 760, 640, 30, 130, '#1b0d36', '#ffe0a0', 0.3)}</g>
  <rect x="0" y="640" width="1600" height="260" fill="#0d0820"/>
  <g filter="url(#soft${id})">${reflections(67, 160, 100, 1500, 650, 880, ['#ffd27a', '#ff6fb0', '#ff9a3c', '#ffffff'])}</g>
  <path d="${road}" stroke="#08040f" stroke-width="84" fill="none" opacity=".85"/>
  <path d="${road}" stroke="#ff9a3c" stroke-width="10" fill="none" stroke-dasharray="3 22" stroke-linecap="round" filter="url(#blur${id})" opacity=".9"/>
  <path d="${road}" stroke="#ffe9b0" stroke-width="5" fill="none" stroke-dasharray="3 22" stroke-linecap="round"/>
  <path d="${road}" stroke="#ff3b30" stroke-width="30" fill="none" stroke-dasharray="160 420" stroke-linecap="round" transform="translate(0 40)" filter="url(#blur${id})" opacity=".55"/>
  <path d="${road}" stroke="#ffffff" stroke-width="26" fill="none" stroke-dasharray="120 500" stroke-dashoffset="-200" stroke-linecap="round" transform="translate(0 -36)" filter="url(#blur${id})" opacity=".55"/>
  ${Array.from({ length: 26 }, (_, i) => { const t = i / 25; const x = 1560 - t * 1600; const y = 860 - Math.sin(t * 1.6) * 230 - t * 20; return `<circle cx="${f(x)}" cy="${f(y)}" r="3.4" fill="#ffe9b0"/><circle cx="${f(x)}" cy="${f(y)}" r="12" fill="#ffe9b0" opacity=".18"/>`; }).join('')}
  <g fill="#07040f">${palm(1480, 900, 1.9, '#07040f', -1)}${palm(60, 900, 1.4, '#07040f', 1)}</g></svg>`;
}

/** [title, loading ...]: the Sea Link for the title (like the mock-up), the others cycle on the loading screen. */
export const SCENE_LIST = { gateway, seaLink, train, marineDrive };
export const LOADING_ORDER = ['gateway', 'train', 'marineDrive', 'seaLink'];
