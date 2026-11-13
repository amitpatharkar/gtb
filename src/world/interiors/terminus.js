import * as THREE from 'three';
import { Geo, POSE, person, hex, font, canvasTexture } from './kit.js';

// Chhatrapati Chai Terminus (the game's take on the great Gothic railway terminus).
//  - The booking hall, the "Star Chamber": a vaulted nave between pointed arcades, the
//    ceiling painted deep blue with gold stars, stained glass, ticket windows with brass
//    grilles, a clerk, a queue.
//  - Through the big arch, the concourse: indicator boards that follow the game clock
//    (time, destination, F/S = fast or slow, 12 or 15 cars, platform), the station clock,
//    a book stall and a tiffin stall, benches.
//  - Beyond, the train shed: five platforms, four tracks ending at buffer stops, one
//    suburban local standing with its doors open, porters in red, commuters.
// E at ticket window 3: a platform ticket (₹10) and an announcement.

const STONE = 0xd8dadb, STONE2 = 0xb4b3ae, GRANITE = 0x6a4b4b, GOLD = 0xc9a24a, GREEN = 0x2f4a3a, PURPLE = 0x6a3d9a;
const HX = 8, HZ = 18, AX = 5.2;                 // booking hall half-width, length, arcade line
const C0 = 18.6, C1 = 30, S1 = 66, SX = 22;      // concourse from C0 to C1, shed to S1, half-width
// Tracks (centre lines) with a platform on each side.
const TRACKS = [-14.4, -4.8, 4.8, 14.4], TW = 2;  // half-width of the track pit
const PLATS = [[-22, -16.4], [-12.4, -6.8], [-2.8, 2.8], [6.8, 12.4], [16.4, 22]];

// Suburban services out of the terminus: [destination, Devanagari, F/S, cars, every n minutes, first at minute, platform].
const LINES = [
  { name: 'HARBOUR LINE', deva: 'हार्बर मार्ग', list: [['Panvel', 'पनवेल', 'S', 12, 12, 4, 1], ['Vashi', 'वाशी', 'S', 12, 15, 9, 1], ['Goregaon', 'गोरेगाव', 'S', 12, 20, 2, 1], ['Belapur', 'बेलापूर', 'S', 12, 30, 17, 1]] },
  { name: 'MAIN LINE · SLOW', deva: 'मुख्य मार्ग · धीमी', list: [['Thane', 'ठाणे', 'S', 12, 10, 1, 2], ['Kalyan', 'कल्याण', 'S', 15, 14, 6, 3], ['Titwala', 'टिटवाळा', 'S', 12, 30, 19, 3], ['Kurla', 'कुर्ला', 'S', 12, 16, 11, 2]] },
  { name: 'MAIN LINE · FAST', deva: 'मुख्य मार्ग · जलद', list: [['Kalyan', 'कल्याण', 'F', 12, 15, 3, 4], ['Ambernath', 'अंबरनाथ', 'F', 12, 20, 13, 4], ['Karjat', 'कर्जत', 'F', 12, 40, 22, 4], ['Kasara', 'कसारा', 'F', 15, 45, 31, 4], ['Khopoli', 'खोपोली', 'F', 12, 60, 50, 4]] },
];
const hhmm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.floor(m) % 60).padStart(2, '0')}`;
/** The next departures of a line after minute-of-day `now`: [[minute, destination, deva, F/S, cars, platform]]. */
function departures(line, now, count = 5) {
  const out = [];
  for (const [dest, deva, fs, cars, every, first, pf] of line.list) {
    let t = first + Math.ceil((now - first) / every) * every;
    for (let k = 0; k < 3; k++, t += every) out.push([t, dest, deva, fs, cars, pf]);
  }
  return out.sort((a, b) => a[0] - b[0]).slice(0, count);
}

/** One indicator board: amber letters on black. */
function paintBoard(g, w, h, line, now) {
  g.fillStyle = '#060606'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#16233a'; g.fillRect(0, 0, w, 54);
  g.textBaseline = 'middle'; g.textAlign = 'left';
  g.fillStyle = '#ffffff'; g.font = font(34, 800); g.fillText(line.name, 18, 28);
  g.fillStyle = '#ffd98a'; g.font = font(30, 700); g.textAlign = 'right'; g.fillText(line.deva, w - 18, 28);
  const X = [18, 150, 640, 760, 900];
  g.fillStyle = '#8fb0d8'; g.font = font(21, 700); g.textAlign = 'left';
  ['वेळ TIME', 'गंतव्य DESTINATION', 'F/S', 'डबे CARS', 'फलाट PF'].forEach((t, i) => g.fillText(t, X[i], 74));
  departures(line, now).forEach(([t, dest, deva, fs, cars, pf], i) => {
    const y = 112 + i * 43;
    g.fillStyle = i === 0 ? '#ffe27a' : '#ffb000'; g.font = font(34, 700, '"Teko", "Baloo 2", monospace');
    g.fillText(hhmm(t), X[0], y);
    g.font = font(33, 700); g.fillText(`${dest.toUpperCase()}  ${deva}`, X[1], y, 470);
    g.fillStyle = fs === 'F' ? '#ff5a4a' : '#6dff8a'; g.fillText(fs, X[2] + 10, y);
    g.fillStyle = '#ffb000'; g.fillText(String(cars), X[3] + 12, y); g.fillText(String(pf), X[4] + 20, y);
  });
}

/** A stained-glass panel: lead lines, jewel colours, a wheel in the middle. */
function stainedGlass(g, w, h) {
  g.fillStyle = '#1a1410'; g.fillRect(0, 0, w, h);
  const cols = ['#b3202a', '#1f4fa3', '#e0a020', '#2e8a4a', '#7a2f8a', '#d9d2b0', '#c2571a'];
  const s = w / 6;
  for (let j = 0; j * s < h + s; j++) for (let i = 0; i < 7; i++) {
    const x = i * s - (j % 2 ? s / 2 : 0), y = j * s * 0.86;
    g.fillStyle = cols[(i * 3 + j * 5) % cols.length];
    g.beginPath(); g.moveTo(x + s / 2, y + 3); g.lineTo(x + s - 3, y + s * 0.43); g.lineTo(x + s / 2, y + s * 0.86 - 3); g.lineTo(x + 3, y + s * 0.43); g.fill();
    g.fillStyle = cols[(i * 5 + j * 2 + 3) % cols.length];
    g.beginPath(); g.arc(x, y + s * 0.43, s * 0.2, 0, 7); g.fill();
  }
  const cx = w / 2, cy = h * 0.3, r = w * 0.36;
  g.fillStyle = '#1a1410'; g.beginPath(); g.arc(cx, cy, r + 8, 0, 7); g.fill();
  for (let i = 0; i < 12; i++) { g.fillStyle = cols[i % cols.length]; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r, (i / 12) * 6.283 + 0.03, ((i + 1) / 12) * 6.283 - 0.03); g.fill(); }
  g.fillStyle = '#e0a020'; g.beginPath(); g.arc(cx, cy, r * 0.3, 0, 7); g.fill();
  g.strokeStyle = '#1a1410'; g.lineWidth = 5; g.beginPath(); g.arc(cx, cy, r * 0.3, 0, 7); g.stroke(); g.beginPath(); g.arc(cx, cy, r * 0.66, 0, 7); g.stroke();
}

export function buildTerminus(k, api) {
  // ------------------------------------------------------------------ materials
  // Encaustic floor tiles of the booking hall (1 m repeat).
  k.painted('tiles', 1, 256, (g) => {
    g.fillStyle = '#c9b48a'; g.fillRect(0, 0, 256, 256);
    for (const [x, y] of [[0, 0], [128, 128]]) { g.fillStyle = '#8c3b2a'; g.fillRect(x, y, 128, 128); }
    g.fillStyle = '#1f1c1a';
    for (const [x, y] of [[64, 64], [192, 64], [64, 192], [192, 192]]) { g.beginPath(); g.moveTo(x, y - 30); g.lineTo(x + 30, y); g.lineTo(x, y + 30); g.lineTo(x - 30, y); g.fill(); }
    g.fillStyle = '#e8dcc0'; for (const [x, y] of [[64, 64], [192, 64], [64, 192], [192, 192]]) { g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(40,30,20,0.6)'; g.lineWidth = 2; for (const v of [0, 128]) { g.beginPath(); g.moveTo(v, 0); g.lineTo(v, 256); g.moveTo(0, v); g.lineTo(256, v); g.stroke(); }
  }, { roughness: 0.4 });
  // The star ceiling: deep blue, gold stars (2 m repeat).
  k.painted('stars', 2, 256, (g) => {
    g.fillStyle = '#16306e'; g.fillRect(0, 0, 256, 256);
    const star = (x, y, r) => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = (i / 10) * 6.283 - 1.571, q = i % 2 ? r * 0.42 : r; g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } g.fill(); };
    g.fillStyle = '#e8c35a';
    for (const [x, y, r] of [[32, 32, 13], [160, 32, 13], [96, 96, 13], [224, 96, 13], [32, 160, 13], [160, 160, 13], [96, 224, 13], [224, 224, 13]]) star(x, y, r);
    g.fillStyle = '#b89a4a'; for (const [x, y] of [[96, 32], [224, 32], [32, 96], [160, 96], [96, 160], [224, 160], [32, 224], [160, 224]]) star(x, y, 5);
  }, { roughness: 0.75 });
  k.scanned('pave', 'tex-ph-concrete-pavement', 2.4, 0xb9b2a6, { loaded: 0xf1ece2 });
  k.scanned('ballast', 'tex-ph-gravel-floor-02', 2, 0x8c8478, { loaded: 0xc9c1b4 });
  k.painted('roof', 3, 64, (g) => { g.fillStyle = '#4a5550'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#3a4440'; for (let x = 0; x < 64; x += 8) g.fillRect(x, 0, 3, 64); }, { roughness: 0.8 });
  const stainedMat = k.mat('stained', new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, map: canvasTexture(256, 512, stainedGlass) }));
  k.daylit.push({ set: (d) => stainedMat.color.setScalar(0.1 + 1.25 * d) });
  const stone = k.to('stone'), paint = k.to('paint'), wood = k.to('wood'), flat = k.to('flat'), satin = k.to('satin'), gloss = k.to('gloss');
  const brass = k.to('brass'), steel = k.to('steel'), glow = k.to('glow'), stars = k.to('stars'), pave = k.to('pave'), stained = k.to('stained');
  const A = k.atlas('signs', 2048, 1024);
  const board = (w, h, bg, fg, lines, frame) => A.draw(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    if (frame) { g.strokeStyle = frame; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8); }
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach(([text, px, y, colour]) => { g.font = font(px, 800); if (colour) g.fillStyle = colour; g.fillText(text, w / 2, y, w - 24); });
  });

  // ------------------------------------------------------------------ booking hall: shell
  k.rooms.push([-HX, 0, HX, HZ, 12], [-2.3, 17.2, 2.3, 19.4, 6.3], [-7.6, 17.2, -5.6, 19.4, 3.7], [5.6, 17.2, 7.6, 19.4, 3.7], [-SX, C0, SX, S1, 8.5]);
  k.to('tiles').floor(-HX, 0, HX, C0, 0);
  // Arcades of pointed arches on stone piers, with polished granite colonnettes.
  const bays = [2.25, 6.75, 11.25, 15.75];
  for (const s of [-1, 1]) {
    stone.arches(s * AX, 0, s * AX, HZ, 0, 8.5, 0.7, bays.map((z) => [z, 3.5, 4.6, 7.0]), STONE);
    for (const z of [0.15, 4.5, 9, 13.5, 17.85]) {
      const x = s * (AX - 0.45);
      satin.box(x, 0, z, 0.5, 0.5, 0.5, 0x8a857c); gloss.cyl(x, 0.5, z, 0.16, 3.75, GRANITE, 10); brass.cyl(x, 4.25, z, 0.2, 0.12, GOLD, 10);
      stone.box(x, 4.37, z, 0.56, 0.3, 0.56, STONE2);
      k.posts.push([s * AX, z, 0.56, true]);
    }
    stone.span(s * (AX - 0.38), 7.25, 0, s * (AX - 0.33), 7.45, HZ, STONE2); brass.span(s * (AX - 0.37), 7.45, 0, s * (AX - 0.34), 7.5, HZ, GOLD);
    // Aisle ceilings, also starred.
    stars.ceiling(s > 0 ? AX + 0.35 : -HX, 0, s > 0 ? HX : -AX - 0.35, HZ, 7.0);
  }
  // The nave vault, its ribs and gilded bosses.
  stars.vault(-AX + 0.35, AX - 0.35, 0, HZ, 8.5, 12.3, 0xffffff, 'pointed', 16);
  for (const z of [0.16, 4.5, 9, 13.5, 17.84]) { stone.rib(-AX + 0.35, AX - 0.35, z, 8.5, 12.3, 0.32, 0.3, STONE2, 'pointed', 14); brass.ball(0, 11.95, z, 0.24, GOLD); }
  stone.span(-0.13, 12.02, 0, 0.13, 12.3, HZ, STONE2);
  // Street wall: the door under a great stained-glass window, a lancet in each aisle.
  stone.arches(-HX - 0.3, -0.2, HX + 0.3, -0.2, 0, 12.6, 0.4, [[HX + 0.3, 2.9, 2.3, 3.9], [HX + 0.3, 3.4, 8.3, 11.3, 5.0], [1.7, 1.3, 4.9, 6.3, 2.7], [2 * HX - 1.1, 1.3, 4.9, 6.3, 2.7]], STONE);
  stained.quad(0, 8.15, -0.32, 3.4, 6.3, 0, 0xffffff, [0, 0, 1, 1]);
  for (const x of [-6.6, 6.6]) stained.quad(x, 4.5, -0.32, 1.3, 3.6, 0, 0xffffff, [0.2, 0.35, 0.8, 1]);
  for (const x of [-0.6, 0.6]) stone.box(x, 5.0, -0.22, 0.14, 3.6, 0.2, STONE2);   // mullions of the great window
  stone.box(0, 4.86, -0.05, 3.9, 0.16, 0.5, STONE2);
  const spawn = k.exitDoor(0, 0, { w: 2.4, h: 2.4, frame: 0x4a2c1a, leaf: 0x5b3a22, label: 'E: go out to the street' });
  k.day().quad(0, 3.15, -0.3, 2.9, 1.5, 0, 0xe6e8dc);
  // Far wall: the great arch to the concourse, a smaller one from each aisle.
  stone.arches(-HX - 0.3, HZ + 0.3, HX + 0.3, HZ + 0.3, 0, 12.6, 0.6, [[HX + 0.3, 5.0, 4.2, 6.7], [1.7, 2.3, 2.6, 4.0], [2 * HX - 1.1, 2.3, 2.6, 4.0]], STONE);
  k.to('signs').quad(0, 7.6, HZ - 0.02, 4.4, 0.8, Math.PI, undefined, board(880, 160, '#1d3a5c', '#f4e7c3', [['गाड्यांकडे · TO TRAINS', 78, 84]], '#d9b24a'));
  k.to('signs').quad(0, 7.4, C0 + 0.02, 6.4, 1.0, 0, undefined, board(1024, 160, '#1d3a5c', '#f4e7c3', [['तिकीट घर · BOOKING OFFICE · WAY OUT', 70, 84]], '#d9b24a'));
  // Side walls: ticket windows on one side, high lancets of coloured glass on both.
  const lancets = bays.map((z) => [z, 1.1, 5.0, 6.2, 3.7]);
  stone.arches(-HX - 0.15, 0, -HX - 0.15, HZ, 0, 8.5, 0.3, [...bays.map((z) => [z, 1.5, 1.95, 2.6, 1.05]), ...lancets], STONE);
  stone.arches(HX + 0.15, 0, HX + 0.15, HZ, 0, 8.5, 0.3, lancets, STONE);
  for (const s of [-1, 1]) {
    for (const z of bays) stained.quad(s * (HX + 0.2), 4.95, z, 1.1, 2.6, -s * Math.PI / 2, 0xffffff, [0.25, 0.3, 0.75, 0.95]);
    gloss.span(s * (HX - 0.03), 0, 0, s * HX, 1.0, HZ, 0x3d5a48); satin.span(s * (HX - 0.05), 1.0, 0, s * HX, 1.07, HZ, 0x2a3f33); // glazed tile dado
  }

  // ------------------------------------------------------------------ booking hall: ticket windows and the booths behind them
  paint.span(-HX - 2.0, 0, 0, -HX - 1.9, 3.2, HZ, 0xcfd8c4); paint.ceiling(-HX - 2, 0, -HX - 0.3, HZ, 3.2, 0xf1ede2);
  flat.floor(-HX - 2, 0, -HX - 0.3, HZ, 0.001, 0x6b6257);
  paint.span(-HX - 2, 0, -0.1, -HX - 0.3, 3.2, 0, 0xcfd8c4); paint.span(-HX - 2, 0, HZ, -HX - 0.3, 3.2, HZ + 0.1, 0xcfd8c4);
  const signs = [['१  पास · PASS', true], ['२  तिकीट · TICKETS', false], ['३  प्लॅटफॉर्म तिकीट · PLATFORM TICKETS', false], ['४  चौकशी · ENQUIRY', true]];
  bays.forEach((z, i) => {
    satin.box(-HX + 0.08, 1.0, z, 0.5, 0.07, 1.9, 0xd8d0bc);                                  // counter ledge
    for (let b = -0.66; b <= 0.661; b += 0.12) brass.box(-HX - 0.1, 1.32, z + b, 0.018, 1.3 - Math.abs(b) * 0.5, 0.018, GOLD); // grille
    brass.box(-HX - 0.1, 1.3, z, 0.02, 0.025, 1.4, GOLD);
    k.to('signs').quad(-HX + 0.03, 3.0, z, 2.3, 0.42, Math.PI / 2, undefined, board(700, 128, '#1d3a5c', '#f4e7c3', [[signs[i][0], 54, 66]], '#d9b24a'));
    glow.box(-HX - 1.0, 3.1, z, 0.9, 0.05, 0.12, [0xf2f6ff, 1.8]);                             // tube light in the booth
    if (signs[i][1]) { wood.span(-HX - 0.24, 1.07, z - 0.74, -HX - 0.2, 2.6, z + 0.74, 0x8a6a48); k.to('signs').quad(-HX - 0.19, 1.7, z, 0.9, 0.3, Math.PI / 2, undefined, board(300, 100, '#f3e7c6', '#7a1f1f', [['बंद · CLOSED', 50, 52]], '#7a1f1f')); }
    else { wood.span(-HX - 0.95, 0.7, z - 0.6, -HX - 0.32, 0.76, z + 0.6, 0x8a6a48); satin.box(-HX - 1.3, 0, z, 0.4, 0.5, 0.4, 0x3a3a40); flat.box(-HX - 0.55, 0.76, z + 0.3, 0.3, 0.1, 0.22, 0xe9e2cf); satin.box(-HX - 0.6, 0.76, z - 0.25, 0.3, 0.2, 0.3, 0x2a2a2e); }
  });
  k.solids.push([-HX, 0, -HX + 0.36, HZ, false]);

  // ------------------------------------------------------------------ booking hall: the other wall — route map, ticket machines, benches, the weighing machine
  const map = A.draw(640, 380, (g, w, h) => {
    g.fillStyle = '#f4efe0'; g.fillRect(0, 0, w, h); g.strokeStyle = '#4a2c1a'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = '#1d3a5c'; g.textAlign = 'center'; g.font = font(30, 800); g.fillText('उपनगरीय रेल्वे · SUBURBAN RAILWAY', w / 2, 42);
    const lineOf = (pts, c) => { g.strokeStyle = c; g.lineWidth = 7; g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); for (const [x, y] of pts) { g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); g.strokeStyle = c; g.lineWidth = 3; g.stroke(); } };
    lineOf([[90, 330], [140, 270], [190, 215], [250, 160], [330, 120], [420, 95], [520, 80], [600, 70]], '#c0392b');
    lineOf([[90, 330], [150, 310], [220, 290], [300, 285], [380, 300], [460, 320], [560, 340]], '#2e7d4f');
    lineOf([[60, 300], [70, 240], [78, 180], [84, 120], [90, 70]], '#1f4fa3');
    g.fillStyle = '#222'; g.font = font(17, 700); g.textAlign = 'left';
    [['CCT', 98, 352], ['Thane', 255, 150], ['Kalyan', 425, 86], ['Kasara', 560, 60], ['Kurla', 196, 206], ['Vashi', 300, 274], ['Panvel', 520, 364], ['Andheri', 96, 184], ['Borivali', 100, 76]].forEach(([t, x, y]) => g.fillText(t, x, y));
  });
  k.to('signs').quad(HX - 0.03, 2.6, 6.75, 3.2, 1.9, -Math.PI / 2, undefined, map);
  k.to('signs').quad(HX - 0.03, 2.6, 11.25, 2.4, 1.5, -Math.PI / 2, undefined, board(520, 320, '#23402f', '#f4e7c3', [['छत्रपती चाय टर्मिनस', 46, 60], ['CHHATRAPATI CHAI TERMINUS', 34, 112], ['opened 1888', 28, 156, '#e0c36a'], ['“Chai, chai, garam chai” since day one.', 24, 210, '#f4e7c3'], ['Please mind the gap. And the queue.', 24, 250], ['कृपया रांगेत उभे राहा', 30, 292, '#e0c36a']], '#d9b24a'));
  for (const z of [2.6, 3.7]) {  // ticket machines
    satin.box(HX - 0.35, 0, z, 0.5, 1.65, 0.7, 0x1f4fa3); glow.box(HX - 0.61, 1.0, z, 0.02, 0.42, 0.5, [0x9fd0ff, 1.3]); satin.box(HX - 0.62, 0.62, z, 0.03, 0.2, 0.36, 0xd8d8d4);
    k.solids.push([HX - 0.65, z - 0.4, HX, z + 0.4, false]);
  }
  for (const z of [14.2, 16.4]) {  // long wooden benches
    wood.box(HX - 0.45, 0.42, z, 0.5, 0.06, 1.9, 0xa07850); wood.box(HX - 0.22, 0.48, z, 0.06, 0.5, 1.9, 0xa07850);
    for (const dz of [-0.85, 0.85]) satin.box(HX - 0.45, 0, z + dz, 0.5, 0.42, 0.06, 0x1c1c1c);
    k.solids.push([HX - 0.75, z - 1.0, HX, z + 1.0, false]);
  }
  // The weighing machine: red, a glass eye, a row of little lamps (E for your weight and fortune).
  const WX = 6.9, WZ = 0.75;
  satin.box(WX, 0, WZ, 0.6, 1.25, 0.5, 0xb3261e); satin.box(WX, 1.25, WZ + 0.05, 0.6, 0.75, 0.4, 0xb3261e); satin.box(WX, 0, WZ - 0.32, 0.5, 0.06, 0.4, 0x3a3a3c);
  glow.add(new THREE.CircleGeometry(0.19, 16).rotateY(Math.PI).translate(WX, 1.62, WZ - 0.16), [0xfff0c0, 1.6]);
  for (let i = 0; i < 5; i++) glow.ball(WX - 0.2 + i * 0.1, 1.92, WZ - 0.16, 0.022, [[0xff4030, 0x30ff60, 0xffd020, 0x40a0ff, 0xff4030][i], 2.5], 1, 6);
  k.solids.push([WX - 0.35, WZ - 0.3, WX + 0.35, WZ + 0.3, false]);
  // Hanging lanterns down the nave.
  for (const z of [4.5, 9, 13.5]) { brass.cyl(0, 6.6, z, 0.015, 5.3, GOLD, 5); brass.box(0, 5.95, z, 0.5, 0.06, 0.5, GOLD); brass.box(0, 6.6, z, 0.36, 0.05, 0.36, GOLD); glow.box(0, 6.02, z, 0.36, 0.56, 0.36, [0xffdfa8, 2.6]); }
  k.lamp(0, 5.6, 5.5, 0xffd9a0, 30, 18); k.lamp(0, 5.6, 13, 0xffd9a0, 30, 18); k.lamp(0, 6.4, 24.5, 0xfff0d8, 40, 26); k.lamp(-13, 6.4, 24.5, 0xfff0d8, 26, 22);
  k.lamp(13, 6.4, 24.5, 0xfff0d8, 26, 22); k.lamp(0, 6.5, 42, 0xfff0d8, 30, 26);

  // ------------------------------------------------------------------ concourse
  pave.floor(-SX, C0, SX, C1 + 0.3, 0);
  for (const s of [-1, 1]) {
    stone.wall(s * (HX + 0.3), C0 - 0.15, s * (SX + 0.3), C0 - 0.15, 0, 8.6, 0.3, [], STONE);
    stone.wall(s * (SX + 0.15), C0 - 0.3, s * (SX + 0.15), S1, 0, 8.6, 0.3, [], STONE);
    gloss.span(s * (HX + 0.3), 0, C0, s * SX, 1.0, C0 + 0.03, 0x3d5a48);
  }
  k.to('roof').ceiling(-SX, C0, SX, C1, 8.5);
  for (let x = -18; x <= 18.01; x += 6) { steel.span(x - 0.12, 8.2, C0, x + 0.12, 8.5, C1, GREEN); k.day().add(new THREE.PlaneGeometry(1.6, 7).rotateX(Math.PI / 2).translate(x + 3, 8.48, 24.3), 0xf2f0e2); }
  for (const x of [-15, -7.5, 7.5, 15]) { steel.cyl(x, 0, 25.2, 0.15, 8.2, GREEN, 10); steel.cyl(x, 0, 25.2, 0.24, 0.5, GREEN, 10); k.posts.push([x, 25.2, 0.26, true]); }
  // Indicator boards over the way to the platforms, and the station clock.
  const B = k.atlas('boards', 1024, 1024, true);
  const minute = () => Math.floor(api.clock.hour * 60);
  const boards = LINES.map((line, i) => {
    const uv = B.draw(1024, 330, (g, w, h) => paintBoard(g, w, h, line, minute()));
    const x = (1 - i) * 13.6;
    k.to('boards').quad(x, 5.7, C1 - 1.25, 6.4, 2.06, Math.PI, undefined, uv);
    flat.box(x, 4.56, C1 - 1.1, 6.7, 2.3, 0.24, 0x101010);
    for (const dx of [-2.6, 2.6]) steel.cyl(x + dx, 6.86, C1 - 1.1, 0.03, 1.6, 0x2a2a2a, 5);
    return { line, uv, key: '' };
  });
  const face = A.draw(256, 256, (g, w) => {
    g.fillStyle = '#f7f3e6'; g.beginPath(); g.arc(w / 2, w / 2, 124, 0, 7); g.fill();
    g.fillStyle = '#1a1a1a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = font(30, 800, 'Georgia, serif');
    ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'].forEach((n, i) => { const a = (i / 12) * 6.283; g.fillText(n, w / 2 + Math.sin(a) * 98, w / 2 - Math.cos(a) * 98); });
    for (let i = 0; i < 60; i++) { const a = (i / 60) * 6.283, r0 = i % 5 ? 116 : 110; g.fillRect(w / 2 + Math.sin(a) * r0 - 1, w / 2 - Math.cos(a) * r0 - 1, 2, 2); }
  });
  const CK = [0, 6.5, 22.6];
  brass.add(new THREE.CylinderGeometry(0.78, 0.78, 0.3, 24).rotateX(Math.PI / 2).translate(CK[0], CK[1], CK[2]), GOLD); brass.cyl(0, CK[1] + 0.78, CK[2], 0.03, 8.5 - CK[1] - 0.78, GOLD, 5);
  for (const s of [-1, 1]) k.to('signs').add(new THREE.CircleGeometry(0.7, 28).rotateY(s > 0 ? 0 : Math.PI).translate(CK[0], CK[1], CK[2] + s * 0.156), 0xffffff, false);
  // (Box-projected UVs would smear the face: map the disc onto its picture by hand.)
  { const geo = k.to('signs').list.slice(-2); for (const g of geo) { const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) { const sx = (p.getX(i) - CK[0]) / 0.7 * (p.getZ(i) > CK[2] ? 1 : -1), sy = (p.getY(i) - CK[1]) / 0.7; uv.setXY(i, face[0] + (sx * 0.5 + 0.5) * (face[2] - face[0]), face[1] + (sy * 0.5 + 0.5) * (face[3] - face[1])); } } }
  const handMat = new THREE.MeshBasicMaterial({ color: 0x141414 });
  const hands = [-1, 1].flatMap((s) => [[0.42, 0.05], [0.6, 0.032]].map(([len, w]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.012).translate(0, len / 2 - 0.05, 0), handMat);
    m.position.set(CK[0], CK[1], CK[2] + s * 0.165); m.userData = { s, minute: len > 0.5 };
    k.meshes.push(m);
    return m;
  }));
  // Book stall and tiffin stall against the back wall; benches facing the boards.
  const stall = (x0, x1, colour, title, sub) => {
    const cx = (x0 + x1) / 2;
    wood.span(x0, 0, C0 + 0.9, x1, 0.95, C0 + 1.5, colour); wood.span(x0, 0.95, C0 + 0.85, x1, 1.0, C0 + 1.6, 0xc9a878);
    for (const x of [x0 + 0.06, x1 - 0.06]) wood.span(x - 0.06, 0, C0 + 0.05, x + 0.06, 2.9, C0 + 1.5, colour);
    wood.span(x0, 2.5, C0 + 0.05, x1, 3.0, C0 + 1.62, colour);
    k.to('signs').quad(cx, 2.76, C0 + 1.63, x1 - x0 - 0.2, 0.42, 0, undefined, board(900, 110, '#f4e7c3', '#7a1f1f', [[title, 54, 40], [sub, 30, 88]], '#7a1f1f'));
    k.solids.push([x0, C0, x1, C0 + 1.65, true]);
    return cx;
  };
  const BX = stall(-19, -14.4, 0x6a4a30, 'B. H. WHEELIE & SONS', 'पुस्तके · मासिके · BOOKS · MAGAZINES · TIMETABLES');
  for (let j = 0; j < 3; j++) for (let i = 0; i < 26; i++) flat.box(-18.8 + i * 0.165, 1.02 + j * 0.44, C0 + 0.3, 0.13, 0.3 + ((i * 7 + j) % 3) * 0.03, 0.2, [0xc0392b, 0x2e86c1, 0xf1c40f, 0x27ae60, 0x8e44ad, 0xe67e22, 0xecf0f1, 0x34495e][(i * 3 + j * 5) % 8]);
  for (let j = 0; j < 2; j++) wood.span(-18.9, 1.42 + j * 0.44, C0 + 0.15, -14.5, 1.45 + j * 0.44, C0 + 0.45, 0x6a4a30);
  for (let i = 0; i < 9; i++) flat.box(-18.6 + i * 0.5, 1.0, C0 + 1.2, 0.34, 0.02, 0.44, [0xf4f1e6, 0xd9a520, 0xb3261e, 0x1d5c8a][i % 4], 0.1 * (i % 3));
  const TX = stall(13.6, 18.4, 0x7a2e2e, 'TERMINUS TIFFIN', 'चहा · वडा पाव · समोसा · CHAI ₹10 · VADA PAV ₹25');
  k.to('glass').span(13.9, 1.0, C0 + 0.95, 15.6, 1.4, C0 + 1.45, 0xd8ecea);
  for (let i = 0; i < 12; i++) flat.ball(14.05 + (i % 6) * 0.27, 1.06 + Math.floor(i / 6) * 0.14, C0 + 1.2, 0.07, i % 3 ? 0xc98a3c : 0xd9a05a, 0.75, 6);
  steel.cyl(16.5, 1.0, C0 + 1.2, 0.17, 0.3, 0xc8cccc, 10); steel.cyl(16.5, 1.3, C0 + 1.2, 0.05, 0.1, 0xc8cccc, 6); steel.cyl(17.4, 1.0, C0 + 1.2, 0.22, 0.2, 0x8f9696, 10);
  for (let i = 0; i < 6; i++) satin.cyl(17.9 - (i % 3) * 0.09, 1.0 + Math.floor(i / 3) * 0.085, C0 + 1.0, 0.035, 0.08, 0xe8e2d2, 6);
  const benchG = new Geo();
  benchG.box(0, 0.4, 0, 3.0, 0.05, 0.48, 0x8a9499); benchG.add(new THREE.BoxGeometry(3.0, 0.5, 0.04).rotateX(-0.15).translate(0, 0.72, -0.27), 0x8a9499);
  for (const x of [-1.3, 0, 1.3]) { benchG.box(x, 0, 0, 0.06, 0.4, 0.44, 0x3a4044); benchG.box(x, 0.0, 0, 0.5, 0.03, 0.5, 0x3a4044); }
  const benches = [[-11, 22.4, 0], [-6.4, 22.4, 0], [6.4, 22.4, 0], [11, 22.4, 0], [-9.6, 45, Math.PI / 2], [0, 39, Math.PI / 2], [0, 53, -Math.PI / 2], [9.6, 43, -Math.PI / 2], [19.4, 40, -Math.PI / 2], [-19.4, 48, Math.PI / 2]];
  k.instances(benchG.merge(), 'steel', benches.map(([x, z, ry]) => [x, 0, z, ry]));
  for (const [x, z, ry] of benches) k.solids.push(ry ? [x - 0.3, z - 1.5, x + 0.3, z + 1.5, false] : [x - 1.5, z - 0.3, x + 1.5, z + 0.3, false]);

  // ------------------------------------------------------------------ train shed: platforms, tracks, roof
  for (const [x0, x1] of PLATS) {
    pave.floor(x0, C1 + 0.3, x1, S1, 0);
    for (const x of [x0, x1]) if (Math.abs(x) < SX - 0.1) {
      const s = x === x0 ? 1 : -1; // towards the middle of the platform
      satin.span(x, 0.001, C1 + 0.3, x + s * 0.3, 0.012, S1, 0xe8e2d2); flat.span(x + s * 0.45, 0.001, C1 + 0.3, x + s * 0.75, 0.014, S1, 0xe0b420);
      stone.span(x - s * 0.02, -1.1, C1 + 0.3, x + s * 0.2, 0, S1, 0x9a948a);
    }
  }
  const sleepers = [];
  for (const cx of TRACKS) {
    k.to('ballast').floor(cx - TW, C1 + 0.3, cx + TW, S1, -1.1);
    stone.span(cx - TW, -1.1, C1 + 0.28, cx + TW, 0, C1 + 0.5, 0x9a948a);
    for (const s of [-1, 1]) steel.span(cx + s * 0.84 - 0.035, -1.02, C1 + 1.4, cx + s * 0.84 + 0.035, -0.87, S1, 0xb0b4b8);
    for (let z = C1 + 1.6; z < S1; z += 0.66) sleepers.push([cx, -1.09, z, 0]);
    // Buffer stop: a striped beam and a red lamp.
    for (const s of [-1, 1]) { satin.box(cx + s * 0.84, -1.1, C1 + 1.0, 0.16, 1.1, 0.5, 0x8c2020); satin.cyl(cx + s * 0.84, -0.42, C1 + 1.32, 0.16, 0.08, 0x2a2a2a, 10); }
    for (let i = 0; i < 6; i++) satin.box(cx - 1.0 + i * 0.4, -0.3, C1 + 1.0, 0.4, 0.3, 0.2, i % 2 ? 0xf2efe6 : 0xc0392b);
    glow.ball(cx, 0.12, C1 + 1.0, 0.07, [0xff3020, 3], 1, 8);
    k.solids.push([cx - TW, C1 + 0.2, cx + TW, S1, false]);
    steel.span(cx - 0.015, 5.5, C1 + 1, cx + 0.015, 5.53, S1, 0x3a3a3a);   // the overhead wire
  }
  k.instances(new THREE.BoxGeometry(2.6, 0.14, 0.24).translate(0, 0.07, 0), 'flat', sleepers, { cast: false }).name = 'sleepers';
  // Roof: two slopes of corrugated sheet with glazed strips, on steel trusses and cast-iron columns.
  const slope = (s) => {
    const g = new THREE.PlaneGeometry(SX + 0.4, S1 - C1, 6, 9); // local x across, y along
    g.rotateX(Math.PI / 2).rotateZ(-s * Math.atan2(3.2, SX)).translate(s * SX / 2, 9.6, (C1 + S1) / 2);
    return g;
  };
  for (const s of [-1, 1]) {
    k.to('roof').add(slope(s), 0xffffff);
    for (const f of [0.3, 0.68]) k.day().add(new THREE.PlaneGeometry(1.8, S1 - C1 - 2).rotateX(Math.PI / 2).rotateZ(-s * Math.atan2(3.2, SX)).translate(s * SX * f, 11.2 - 3.2 * f - 0.06, (C1 + S1) / 2), 0xf4f2e4);
  }
  stone.wall(-SX, C1, SX, C1, 8.5, 11.4, 0.3, [], 0x8f8a80);   // gable over the concourse edge
  for (let z = C1 + 6; z < S1; z += 6) {
    steel.span(-SX, 7.9, z - 0.08, SX, 8.1, z + 0.08, GREEN);
    for (const s of [-1, 1]) { const g = new THREE.BoxGeometry(SX + 0.3, 0.16, 0.14).rotateZ(-s * Math.atan2(3.2, SX)).translate(s * SX / 2, 9.55, z); steel.add(g, GREEN); }
    for (const x of [-14.6, -7.3, 0, 7.3, 14.6]) steel.span(x - 0.05, 8.1, z - 0.05, x + 0.05, 11.1 - Math.abs(x) * (3.2 / SX), z + 0.05, GREEN);
    for (const x of [-9.6, 0, 9.6]) { steel.cyl(x, 0, z, 0.14, 7.9, GREEN, 10); steel.cyl(x, 0, z, 0.22, 0.45, GREEN, 10); k.posts.push([x, z, 0.24, true]); }
  }
  // The far end: daylight (or the night) beyond the shed.
  stone.wall(-SX, S1 + 0.15, SX, S1 + 0.15, 0, 11.6, 0.3, TRACKS.map((cx) => [cx + SX - 1.95, cx + SX + 1.95, -1.1, 5.9]), 0x7f7a70);
  flat.span(-SX, -1.3, S1 - 0.2, SX, -1.1, S1 + 0.3, 0x55504a);
  for (const cx of TRACKS) k.day().quad(cx, 2.4, S1 + 0.25, 3.9, 7.0, Math.PI, 0xdfe6e6);
  // Platform number boards and the station's name board.
  TRACKS.forEach((cx, i) => {
    const uv = board(160, 160, '#1d3a5c', '#ffffff', [[String(i + 1), 120, 86]], '#ffffff');
    k.to('signs').quad(cx, 4.3, C1 + 0.9, 0.9, 0.9, Math.PI, undefined, uv); flat.box(cx, 3.82, C1 + 0.95, 0.96, 0.96, 0.06, 0x101820); steel.cyl(cx, 4.78, C1 + 0.95, 0.02, 3.3, 0x2a2a2a, 5);
  });
  const nameBoard = board(1000, 250, '#f2c200', '#141414', [['छत्रपती चाय टर्मिनस', 84, 62], ['CHHATRAPATI CHAI TERMINUS', 62, 142], ['समुद्रसपाटीपासून उंची 4 मी · 4 m above sea level', 30, 210]], '#141414');
  for (const [x, z, ry] of [[0, 60, Math.PI], [-9.6, 34.2, 0], [9.6, 61, Math.PI]]) { k.to('signs').quad(x, 2.3, z, 3.6, 0.9, ry, undefined, nameBoard); k.to('signs').quad(x, 2.3, z + (ry ? 0.08 : -0.08), 3.6, 0.9, ry ? 0 : Math.PI, undefined, nameBoard); for (const dx of [-1.6, 1.6]) { satin.box(x + dx, 0, z + (ry ? 0.04 : -0.04), 0.1, 2.75, 0.1, 0x2a2a2a); k.posts.push([x + dx, z, 0.12, false]); } }
  // Water taps, bins, a porter's luggage pile.
  for (const [x, z] of [[-9.6, 38.5], [9.6, 50], [0, 47]]) { satin.box(x, 0, z, 0.9, 1.0, 0.5, 0x2e6f8c); steel.box(x, 1.0, z, 1.0, 0.04, 0.6, 0xc8cccc); for (const dx of [-0.3, 0, 0.3]) steel.cyl(x + dx, 1.04, z, 0.015, 0.2, 0xc8cccc, 5); k.solids.push([x - 0.5, z - 0.3, x + 0.5, z + 0.3, false]); }
  for (const [x, z, c] of [[-5.2, 20.2, 0x2e7d4f], [5.4, 29.3, 0x1f4fa3], [-9.6, 52, 0x2e7d4f], [9.6, 36.5, 0x1f4fa3], [0, 33.5, 0x2e7d4f]]) { satin.cyl(x, 0, z, 0.22, 0.7, c, 10, 0.26); k.posts.push([x, z, 0.3, false]); }
  flat.box(-3.6, 0, 27.4, 0.9, 0.35, 0.5, 0x6a3a22); flat.box(-3.55, 0.35, 27.4, 0.75, 0.3, 0.5, 0x2f4a6a); flat.box(-3.7, 0.65, 27.45, 0.55, 0.28, 0.45, 0x7a1f1f);
  flat.box(-2.5, 0, 26.9, 0.55, 0.42, 0.42, 0x4a4a52); // the trunk a porter is sitting on
  k.solids.push([-4.2, 27.0, -3.0, 27.8, false]);

  // ------------------------------------------------------------------ the local train on track 2
  const TXC = TRACKS[1], BW = 1.65, F0 = 0.1;      // centre line, half body width, floor height
  const coach = (z0, z1, ladies) => {
    const len = z1 - z0, doors = [3.2, len / 2, len - 3.2];
    const holes = [], band = [];
    doors.forEach((c) => { holes.push([c - 0.7, c + 0.7, F0, 2.05]); band.push([c - 0.7, c + 0.7, -9, 9]); });
    for (let i = 0; i < doors.length - 1; i++) { const a = doors[i] + 0.7, b = doors[i + 1] - 0.7, n = Math.max(1, Math.floor((b - a - 0.4) / 1.5)), w = (b - a - 0.4) / n; for (let j = 0; j < n; j++) holes.push([a + 0.3 + j * w, a + 0.1 + (j + 1) * w, 1.0, 1.78]); }
    holes.push([0.5, 1.9, 1.0, 1.78], [len - 1.9, len - 0.5, 1.0, 1.78]);
    for (const s of [-1, 1]) {
      const x = TXC + s * BW;
      satin.wall(x, z0, x, z1, -0.25, 2.75, 0.07, holes, 0xe9e9e4);
      satin.wall(x + s * 0.04, z0, x + s * 0.04, z1, 0.5, 0.86, 0.02, band, PURPLE); satin.wall(x + s * 0.04, z0, x + s * 0.04, z1, 2.2, 2.34, 0.02, band, PURPLE);
      for (const [h0, h1, b, t] of holes) {
        if (b > F0 + 0.1) for (const y of [1.2, 1.4, 1.6]) steel.box(x, y, z0 + (h0 + h1) / 2, 0.02, 0.02, h1 - h0, 0x8a8f94);                        // window bars
        else { steel.cyl(TXC + s * (BW - 0.2), F0, z0 + (h0 + h1) / 2, 0.02, 2.0, 0xc8cccc, 6); for (const e of [h0 + 0.03, h1 - 0.03]) satin.box(x, F0 + 0.6, z0 + e, 0.09, 1.0, 0.05, 0xf2c200); }  // door pole, yellow handles
      }
      if (ladies) { satin.wall(x + s * 0.045, z0 + 0.5, x + s * 0.045, z0 + 2.4, 0.9, 1.0, 0.02, [], 0x2e8a4a); k.to('signs').quad(x + s * 0.05, 2.02, z0 + 1.25, 1.3, 0.24, s * Math.PI / 2, undefined, board(420, 80, '#2e8a4a', '#fff', [['महिला · LADIES', 52, 42]])); }
      // Long benches inside, under the windows.
      for (let i = 0; i < doors.length - 1; i++) { const a = doors[i] + 0.9, b = doors[i + 1] - 0.9; flat.span(TXC + s * (BW - 0.5), F0, z0 + a, TXC + s * (BW - 0.06), F0 + 0.44, z0 + b, 0x2f6b4a); }
    }
    flat.span(TXC - BW, F0 - 0.1, z0, TXC + BW, F0, z1, 0x6b6e70);                                // floor
    satin.span(TXC - BW, 2.62, z0, TXC + BW, 2.75, z1, 0xdcdcd6); glow.span(TXC - 0.08, 2.6, z0 + 1, TXC + 0.08, 2.62, z1 - 1, [0xf4f8ff, 1.4]); // ceiling and its strip light
    satin.span(TXC - BW + 0.05, 2.75, z0, TXC + BW - 0.05, 2.95, z1, 0xb9bcbc); satin.span(TXC - BW + 0.5, 2.95, z0 + 0.3, TXC + BW - 0.5, 3.08, z1 - 0.3, 0xa9acac);   // roof
    satin.span(TXC - BW + 0.15, -0.85, z0 + 4, TXC + BW - 0.15, -0.25, z1 - 4, 0x2a2c2e);         // under-floor gear
    for (const zb of [z0 + 2.6, z1 - 2.6]) { satin.span(TXC - 1.1, -0.9, zb - 1.5, TXC + 1.1, -0.3, zb + 1.5, 0x1c1d1f); for (const dz of [-1.0, 1.0]) for (const s of [-1, 1]) steel.add(new THREE.CylinderGeometry(0.46, 0.46, 0.13, 14).rotateZ(Math.PI / 2).translate(TXC + s * 0.84, -0.42, zb + dz), 0x55585c); }
    return doors.map((c) => z0 + c);
  };
  const doorsA = coach(31.9, 51.6, false), doorsB = coach(52.2, S1, true);
  satin.span(TXC - 1.2, 0, 51.6, TXC + 1.2, 2.6, 52.2, 0x1c1d1f);
  // The cab end, facing the buffers.
  satin.wall(TXC - BW, 31.9, TXC + BW, 31.9, -0.25, 2.75, 0.08, [[0.3, 1.5, 1.15, 2.1], [1.8, 3.0, 1.15, 2.1]], 0xe9e9e4);
  satin.span(TXC - BW, -0.25, 31.82, TXC + BW, 1.0, 31.86, 0xf2c200); satin.span(TXC - BW, 0.5, 31.8, TXC + BW, 0.86, 31.84, PURPLE);
  gloss.span(TXC - BW + 0.3, 1.15, 31.93, TXC + BW - 0.3, 2.1, 31.95, 0x10161c);
  for (const s of [-1, 1]) { glow.add(new THREE.CircleGeometry(0.11, 12).rotateY(Math.PI).translate(TXC + s * 1.1, 0.2, 31.81), [0xfff2d0, 2.5]); glow.add(new THREE.CircleGeometry(0.06, 10).rotateY(Math.PI).translate(TXC + s * 1.35, 0.2, 31.81), [0xff3020, 2]); satin.cyl(TXC + s * 0.9, -0.6, 31.6, 0.1, 0.25, 0x1c1d1f, 8); }
  const dest = k.atlas('boards2', 512, 128, true);
  k.to('boards2').quad(TXC, 2.42, 31.84, 2.2, 0.3, Math.PI, undefined, dest.draw(512, 72, (g, w, h) => { g.fillStyle = '#050505'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffb000'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = font(46, 800); g.fillText('ठाणे  THANE   S  12', w / 2, h / 2 + 2); }));
  // Pantograph on the second coach.
  for (const s of [-1, 1]) { steel.add(new THREE.BoxGeometry(0.04, 1.75, 0.04).rotateX(s * 0.75).translate(TXC, 4.25, 57 + s * 0.6), 0x3a3a3a); steel.add(new THREE.BoxGeometry(0.04, 1.75, 0.04).rotateX(-s * 0.75).translate(TXC, 4.25 - 0.0, 57 + s * 0.6 - s * 1.2), 0x3a3a3a); }
  steel.box(TXC, 5.42, 57, 1.5, 0.05, 0.3, 0x3a3a3a);
  k.solids.push([TXC - BW - 0.05, 31.4, TXC + BW + 0.05, S1, true]);

  // ------------------------------------------------------------------ people
  const red = hex(0xc0281e), white = hex(0xf4f2ea);
  // Clerks behind windows 2 and 3; a queue at window 2.
  const clerk = k.add(person('office', -HX - 1.3, bays[2], Math.PI / 2, POSE.SIT, { y: 0.08, shirt: hex(0xbcd3ea), wear: ['casual2', 'oldclassy'] }));
  k.add(person('office', -HX - 1.3, bays[1], Math.PI / 2, POSE.SIT, { y: 0.08, shirt: white, wear: ['bald', 'casual'] }));
  const queue = [0, 1, 2, 3].map((i) => k.add(person(['office', 'sari', 'casual', 'worker'][i], -HX + 0.95 + i * 0.78, bays[1] + (i % 2 ? 0.08 : -0.06), -Math.PI / 2, POSE.STAND)));
  // People looking up at the boards, seated on the benches, waiting on the platforms.
  const standing = [[-13.4, 26.6, 0], [-12.2, 27.2, 0.2], [0.8, 26.4, 0], [-0.9, 27, -0.1], [12.6, 26.8, 0], [14.3, 27.3, -0.2], [3.4, 20.6, 2.6], [-17.2, 20.9, 3.14], [15.2, 20.9, 3.14],
    [-20.4, 37, 1.57], [-19.6, 51, 1.57], [-10.8, 41.5, -1.57], [-8.2, 36.2, 1.57], [-8.6, 56, 1.57], [-1.6, 43, -1.57], [1.7, 37.5, 1.57], [1.5, 55.5, 1.57], [-1.4, 50, -1.57], [8.2, 40, 1.57], [10.9, 47, -1.57], [10.6, 57, -1.57], [19.8, 45, -1.57], [20.3, 58, -1.57]]
    .map(([x, z, h], i) => k.add(person(['office', 'casual', 'sari', 'casual', 'office', 'kid', 'worker'][i % 7], x, z, h, POSE.STAND)));
  const sitting = [[-11.6, 22.4, 0], [-10.4, 22.4, 0], [-6.9, 22.4, 0], [6.0, 22.4, 0], [11.4, 22.4, 0], [10.2, 22.4, 0], [0, 38.4, 1.57], [0, 39.8, 1.57], [-9.6, 45.6, 1.57], [9.6, 43.2, -1.57], [19.4, 40.4, -1.57]]
    .map(([x, z, h], i) => k.add(person(['sari', 'office', 'casual', 'kid', 'office', 'sari'][i % 6], x, z, h, POSE.SIT, { y: 0.03 })));
  // Standing in the open doors of the train.
  const riders = [doorsA[0], doorsA[2], doorsB[1]].map((z, i) => k.add(person(['office', 'casual', 'office'][i], TXC + BW - 0.45, z + (i - 1) * 0.25, Math.PI / 2, POSE.STAND, { y: F0 }), false));
  // The ticket checker by the middle platform, stall keepers, porters in red.
  const tc = k.add(person('office', 3.4, C1 - 0.4, Math.PI, POSE.STAND, { shirt: hex(0x15151a), pants: white, wear: ['suit', 'oldclassy', 'casual2'] }));
  const bookman = k.add(person('office', BX, C0 + 0.55, 0, POSE.STAND, { wear: ['oldclassy', 'casual3'] }), false);
  const tiffin = k.add(person('worker', TX + 0.6, C0 + 0.55, 0, POSE.STAND, { shirt: white, wear: ['casual', 'casual2'] }), false);
  const porter1 = k.add(person('worker', -2.5, 26.9, 0.6, POSE.SIT, { y: 0.0, shirt: red, pants: hex(0x8a2a20), wear: ['casual', 'casual2'] }));
  const porter2 = k.add(person('worker', 0, 34, 0, POSE.WALK, { shirt: red, pants: hex(0x8a2a20), wear: ['casual2', 'casual'] }));
  const chaiwala = k.add(person('worker', 10.9, 33, 0, POSE.WALK, { shirt: hex(0xd9d2c0), wear: ['casual3', 'casual'] }));
  // The trunk the walking porter carries on his head follows him.
  const load = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.3, 0.42), new THREE.MeshStandardMaterial({ color: 0x2f4a6a, roughness: 0.7 }));
  load.castShadow = true; k.meshes.push(load);
  const walker = (p, route, speed) => { let leg = 0, rest = 0; p.speed = speed; return (dt, a) => {
    if (rest > 0) { rest -= dt; p.pose = POSE.STAND; return; }
    const [tx, tz] = route[leg], dx = tx - p.lx, dz = tz - p.lz, d = Math.hypot(dx, dz);
    if (d < 0.25) { leg = (leg + 1) % route.length; if (Math.random() < 0.25) rest = 1 + Math.random() * 4; return; }
    if (Math.hypot(a.me.x - p.lx, a.me.z - p.lz) < 0.9) { p.pose = POSE.STAND; return; }
    p.lx += (dx / d) * speed * dt; p.lz += (dz / d) * speed * dt; p.heading = Math.atan2(dx, dz); p.phase += dt * speed * 4.3; p.pose = POSE.WALK;
  }; };
  const strollers = [
    [[0, 3], [0, 16], [0, 21], [-8.4, 24], [-8.4, 33], [-8.4, 58], [-10.8, 58], [-10.8, 33], [-9, 24.5], [0, 21], [0, 16]],
    [[1.2, 15], [1.4, 4], [3.2, 2.2], [3.4, 15.5], [2, 21], [8.4, 24.6], [8.4, 55], [10.8, 55], [10.8, 33], [8, 24.6], [1.6, 20.6]],
    [[-19, 33], [-19.4, 60], [-19, 33], [-17, 27], [-4, 25.6], [-17, 26.4]],
    [[19.2, 60], [19, 33], [10, 26], [-12, 25.8], [10, 26.4], [19, 33]],
    [[-1.2, 60], [-1.4, 34], [-4, 28.6], [-1.4, 34]],
  ].map((route, i) => { const p = k.add(person(['office', 'casual', 'sari', 'office', 'casual'][i], route[0][0], route[0][1], 0, POSE.WALK)); k.ticks.push(walker(p, route, 1.15 + (i % 3) * 0.15)); return p; });
  k.ticks.push(walker(porter2, [[1.4, 34], [1.6, 58], [1.4, 34], [1.2, 27], [-1, 20.4], [0.6, 26]], 1.25), walker(chaiwala, [[10.9, 33.4], [10.9, 59], [8.3, 59], [8.3, 34], [6, 26.2], [-6, 26.6], [6, 27]], 0.9));
  // A speaker to hang announcements on (not drawn).
  const speaker = k.add({ hidden: true, x: 0, z: C1 - 1.4, y: 4.3, h: 0.3, pose: undefined }, false);

  // ------------------------------------------------------------------ life: boards, clock, announcements, barks
  let ticket = false, announceT = 14, barkT = 5, tcT = 0;
  const announce = (a) => {
    const now = minute(), line = LINES[Math.floor(Math.random() * LINES.length)], [t, dest, , fs, cars, pf] = departures(line, now, 2)[Math.floor(Math.random() * 2)];
    a.tone([659, 523, 784], 0.22, 0.07);
    a.say(speaker, [`Yatrigan kripya dhyan dein: platform kramank ${pf} par, ${hhmm(t)} ki ${dest} jaane wali ${cars} dibbon ki ${fs === 'F' ? 'jald' : 'dheemi'} local khadi hai.`,
      `Attention please: the ${hhmm(t)} ${fs === 'F' ? 'fast' : 'slow'} local for ${dest} will leave from platform ${pf}. ${cars} cars.`,
      `Pravasi krupaya laksha dya: falat kramank ${pf} varun ${dest} kade jaanari ${fs === 'F' ? 'jalad' : 'dhimi'} local ${hhmm(t)} la sutel.`][Math.floor(Math.random() * 3)], 6, 'radio');
  };
  k.ticks.push((dt, a) => {
    const now = minute();
    // Boards: repaint when the list of departures moves on.
    for (const b of boards) { const key = departures(b.line, now).map((d) => d[0]).join(); if (key !== b.key) { b.key = key; B.repaint(b.uv, (g, w, h) => paintBoard(g, w, h, b.line, now)); } }
    // Clock hands (the two faces turn opposite ways).
    const hr = a.clock.hour % 12, mn = (a.clock.hour * 60) % 60;
    for (const m of hands) m.rotation.z = -m.userData.s * (m.userData.minute ? mn / 60 : hr / 12) * Math.PI * 2;
    for (const p of [...sitting, ...standing, ...queue, ...riders]) p.phase += dt;
    load.position.set(porter2.lx, 1.86, porter2.lz); load.rotation.y = porter2.heading;
    announceT -= dt;
    if (announceT <= 0) { announceT = 30 + Math.random() * 25; announce(a); }
    // The ticket checker has a word as you head for the platforms.
    tcT -= dt;
    tc.heading = Math.atan2(a.me.x - tc.lx, a.me.z - tc.lz);
    if (tcT <= 0 && Math.hypot(a.me.x - tc.lx, a.me.z - tc.lz) < 4 && a.me.z > C1 - 3) { tcT = 25; a.say(tc, ticket ? 'Platform ticket? …Theek hai, jaiye.' : 'Ticket? Platform ticket dikhao! Window number teen. Dus rupaye.', 3.5, 'cop'); }
    barkT -= dt;
    if (barkT > 0) return;
    barkT = 5 + Math.random() * 6;
    const near = (p) => Math.hypot(a.me.x - p.lx, a.me.z - p.lz);
    const who = [porter1, porter2, chaiwala, bookman, tiffin, ...queue, ...standing, ...strollers].filter((p) => near(p) < 7).sort((p, q) => near(p) - near(q))[Math.floor(Math.random() * 2)];
    if (!who) return;
    const lines = who === porter1 || who === porter2 ? ['Coolie! Saaman, saheb?', 'Bees rupaye, platform tak!', 'Hato, hato! Saaman aa raha hai!']
      : who === chaiwala ? ['Chai! Garam chai!', 'Chai-chai-chai! Kadak chai!', 'Ek cutting, saheb?']
      : who === bookman ? ['Timetable, sir? Naya edition!', 'Aaj ka paper! Mumbai Bawaal Times!']
      : who === tiffin ? ['Vada pav! Garam vada pav!', 'Samosa, chai! Train se pehle kha lo!']
      : queue.includes(who) ? ['Line mein aao, bhai!', 'Ek Thane return.', 'Chhutta nahi hai kya?', 'Yeh window band kab hui?']
      : ['Fast hai ya slow?', 'Kaunse platform pe aayegi?', 'Aaj phir late hai.', 'Chauthi seat pe adjust karo!', 'Utarne ka hai? Chalo aage!', 'Virar fast pakadni hai.', 'Indicator dekho na!'];
    a.say(who, lines[Math.floor(Math.random() * lines.length)], 2.6);
  });

  // ------------------------------------------------------------------ things to do
  k.spot(-HX + 0.95, bays[2], 1.4, () => (ticket ? 'Window 3 · you have a platform ticket (E: buy another, ₹10)' : 'E: platform ticket at window 3 (₹10)'), (a) => {
    if (!a.buy(10, 'Platform ticket')) return;
    ticket = true;
    a.say(clerk, 'Dus rupaye. Platform ticket — do ghante chalega.', 3);
    a.msg('Platform ticket — ₹10. Good for two hours on the platforms. Don’t lose it.');
    announceT = 2.2;
  });
  k.spot(WX, WZ + 0.9, 1.1, 'E: weighing machine (₹2)', (a) => {
    if (!a.buy(2, 'Weighing machine')) return;
    a.msg(`Your weight: ${68 + Math.floor(Math.random() * 9)} kg. Fortune: “${['A long journey begins with a short queue.', 'You will meet a tall, dark traffic constable.', 'Avoid the Virar fast today.', 'Money will come. Then the landlord will call.', 'Someone will ask you “kidhar?” Say yes.'][Math.floor(Math.random() * 5)]}”`);
  });
  k.spot(TX + 0.6, C0 + 2.3, 1.5, 'E: cutting chai + vada pav at Terminus Tiffin (₹35)', (a) => {
    if (!a.buy(35, 'Chai + vada pav, Terminus Tiffin')) return;
    a.state.eat(0.3); a.state.rest(0.15);
    a.say(tiffin, 'Ek cutting, ek vada pav! Mirchi alag se.', 2.8);
    a.msg('Cutting chai + vada pav — ₹35. Food and energy up.');
  });
  k.spot(BX, C0 + 2.3, 1.4, 'B. H. Wheelie & Sons: timetables, magazines, and a novel for every delay.', () => {});

  return {
    spawn,
    ambient: [0xfbf6ee, 0xc9c2b4, 1.6], key: [0.1, 1, -0.2, 1.3, 0xfff8ee], env: 0.5, exposure: 0.95,
    sound: [0.02, 0.32, 0],
  };
}
