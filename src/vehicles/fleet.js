import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { loft, curve, stations, archLine, mergePlain } from './loft.js';

// Mumbai traffic as it really is: budget hatchbacks, compact sedans and MPVs (many of them
// white app cabs with yellow commercial plates), black-and-yellow taxis, a few SUVs, BEST
// buses (red single-deckers and the new electric double-deckers), Tata Ace "chhota haathi"
// mini trucks, and a sea of scooters and commuter bikes. Real dimensions; parody names.
//
// Every vehicle is four parts drawn with one BatchedMesh each (traffic.js): paint (tinted
// per vehicle, clear coat), glass, trim (tyres, rims, bumpers, plates, grilles; vertex
// colours) and lamps (glow at night). Each type also has a coarse far version (LOD).
// Bodies are lofted cross-sections (loft.js): curved bonnets, raked glass, wheel arches.

const RIGHT = -1; // the driver sits on the right (India drives on the left); +z is forward, right is -x

function paint(g, hex) {
  g = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  const c = new THREE.Color(hex), a = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const strip = (g) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); return g; };
const merge = (list) => mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g)));
const cyl = (r, w, seg) => new THREE.CylinderGeometry(r, r, w, seg).rotateZ(Math.PI / 2);

/** A thin beam (pillar, rail) from p0 to p1. */
function beam(p0, p1, thick = 0.05, wide = 0.09) {
  const a = new THREE.Vector3(...p0), b = new THREE.Vector3(...p1);
  const len = a.distanceTo(b), dir = b.clone().sub(a).normalize();
  const g = new THREE.BoxGeometry(thick, wide, len);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir));
  return g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
}

function wheelSet(zs, x, r, w, rimHex, seg) {
  const out = [];
  for (const z of zs) for (const s of [-1, 1]) {
    out.push(paint(cyl(r, w, seg).translate(s * x, r, z), 0x141414));
    out.push(paint(cyl(r * 0.6, w + 0.02, Math.max(8, seg - 4)).translate(s * x, r, z), rimHex));
    if (seg > 10) out.push(paint(cyl(r * 0.2, w + 0.04, 8).translate(s * x, r, z), 0x55585c));
  }
  return out;
}

/**
 * A lofted car. Spec (metres, z along the car, rear = -L/2): L W H wb r fo (front overhang),
 * belt: [[z, y]] top line of the lower body (boot, waist, bonnet, nose),
 * glass: { z0, zr0, zr1, z1 } rear glass base, roof rear, roof front, windscreen base,
 * tumble, shoulder, sill, roundF/roundR (plan rounding), bz (B-pillar), pz (extra pillars),
 * plus look flags: taxi, cab (yellow plates), blackPillars, cladding, spare, rails, rim,
 * tail ('tall' | 'wide'), grille ('wide' | 'tall' | 'slot').
 */
function lofted(s, far = false) {
  const { L, W, H, wb, r } = s;
  const fz = L / 2 - s.fo, rz = fz - wb;
  const sill = s.sill ?? r + 0.05;
  const belt = curve(s.belt);
  const roundF = s.roundF ?? 0.16, roundR = s.roundR ?? 0.1;
  const hwF = (z) => {
    const d = Math.min(L / 2 - z, z + L / 2), t = Math.max(0, 1 - d / 0.5);
    return W / 2 - (z > 0 ? roundF : roundR) * t * t;
  };
  const n = far ? 1 : 3;
  const zs = far ? stations(-L / 2, L / 2, 0.45, [rz, fz], r + 0.1, 0.12) : stations(-L / 2, L / 2, 0.14, [rz, fz], r + 0.12, 0.045);
  const bottom = archLine([rz, fz], r, sill);
  const shoulder = s.shoulder ?? 0.09;
  const paintParts = [loft(zs, { y0: bottom, y1: belt, hw: hwF, tw: (z) => hwF(z) * 0.955, rb: () => 0.05, rt: () => shoulder }, { n })];

  // Greenhouse (glass) with a raked windscreen and rear glass, tumblehome towards the roof.
  const g = s.glass, roofY = H - 0.03;
  const roofLine = curve([[g.z0, belt(g.z0) + 0.01], [g.zr0, roofY], [g.zr1, roofY], [g.z1, belt(g.z1) + 0.01]], false);
  const ghw = (z) => hwF(z) * 0.935, gtw = (z) => hwF(z) * (s.tumble ?? 0.8);
  const glass = [loft(stations(g.z0, g.z1, far ? 0.6 : 0.12), { y0: (z) => belt(z) - 0.02, y1: roofLine, hw: ghw, tw: gtw, rb: () => 0.01, rt: () => 0.06 }, { n: far ? 1 : 2 })];
  const roof = loft(stations(g.zr0 - 0.05, g.zr1 + 0.05, far ? 0.8 : 0.16), { y0: () => roofY - 0.045, y1: () => roofY + 0.012, hw: (z) => gtw(z) + 0.03, tw: (z) => gtw(z) - 0.03, rb: () => 0.01, rt: () => 0.035 }, { n: far ? 1 : 2 });

  const trim = [], lamps = [];
  const upper = []; // roof + A/C pillars (yellow on a kaali-peeli)
  upper.push(roof);
  if (!far) {
    // Pillars over the glass: A (windscreen), B (doors, black), C (rear), extra for long MPVs.
    const out = 0.014;
    for (const sx of [-1, 1]) {
      const A = beam([sx * (ghw(g.z1) + out), belt(g.z1) + 0.01, g.z1 - 0.02], [sx * (gtw(g.zr1) + out), roofY - 0.02, g.zr1 + 0.02], 0.05, 0.1);
      const C = beam([sx * (ghw(g.z0) + out), belt(g.z0) + 0.01, g.z0 + 0.06], [sx * (gtw(g.zr0) + out), roofY - 0.02, g.zr0 - 0.01], 0.05, s.wideC ?? 0.16);
      if (s.blackPillars) trim.push(paint(A, 0x111111), paint(C, 0x111111)); else upper.push(A, C);
      const bz = s.bz ?? (g.zr1 + g.zr0) / 2 + 0.12;
      for (const z of [bz, ...(s.pz || [])]) trim.push(paint(beam([sx * (ghw(z) + out), belt(z), z], [sx * (gtw(z) + out), roofY - 0.02, z], 0.05, 0.1), 0x121212));
    }
  }
  if (s.taxi) trim.push(...upper.map((x) => paint(x, 0xf2c200))); else paintParts.push(...upper);

  // Wheels, arch liners, underbody.
  const tyreX = W / 2 - 0.12;
  trim.push(...wheelSet([rz, fz], tyreX, r, s.tyreW ?? 0.19, s.rim ?? 0x8d9196, far ? 8 : 18));
  if (!far) {
    for (const wz of [rz, fz]) trim.push(paint(box(W - 0.34, r * 0.9, 2 * r + 0.16, 0, r * 1.25, wz), 0x0a0a0a));
    trim.push(paint(box(W - 0.3, Math.max(0.05, sill - 0.16), wb - 2 * r - 0.1, 0, (sill + 0.16) / 2, (rz + fz) / 2), 0x101010));
  }

  // Nose and tail: bumpers, grille, lamps, plates.
  const noseY = belt(L / 2 - 0.05), tailY = belt(-L / 2 + 0.05);
  const plate = s.cab || s.taxi ? 0xf2c200 : 0xf4f4f4;
  const bumperHex = s.bumperHex ?? null;
  const fb = box(W - 0.2, 0.2, 0.14, 0, sill + 0.04, L / 2 - 0.05), rb = box(W - 0.24, 0.2, 0.14, 0, sill + 0.06, -L / 2 + 0.05);
  if (bumperHex === null) paintParts.push(strip(fb), strip(rb)); else trim.push(paint(fb, bumperHex), paint(rb, bumperHex));
  if (!far) {
    const grilleW = s.grille === 'tall' ? W * 0.5 : s.grille === 'slot' ? W * 0.36 : W * 0.46;
    const grilleH = s.grille === 'tall' ? Math.max(0.16, noseY - sill - 0.22) : 0.1;
    trim.push(paint(box(grilleW, grilleH, 0.03, 0, s.grille === 'tall' ? sill + 0.16 + grilleH / 2 : noseY - 0.12, L / 2 + 0.01), 0x161616));
    trim.push(paint(box(W * 0.5, 0.07, 0.03, 0, sill - 0.02, L / 2 + 0.03), 0x101010)); // lower air dam
    trim.push(paint(box(0.5, 0.12, 0.02, 0, sill + 0.06, L / 2 + 0.13), plate), paint(box(0.4, 0.05, 0.01, 0, sill + 0.06, L / 2 + 0.145), 0x1c1c1c));
    trim.push(paint(box(0.5, 0.12, 0.02, 0, sill + 0.24, -L / 2 - 0.02), plate), paint(box(0.4, 0.05, 0.01, 0, sill + 0.24, -L / 2 - 0.035), 0x1c1c1c));
    // Mirrors, door seams and handles.
    const mz = g.z1 - 0.12, my = belt(g.z1) + 0.07;
    for (const sx of [-1, 1]) {
      trim.push(paint(box(0.1, 0.1, 0.17, sx * (ghw(mz) + 0.1), my, mz), s.blackMirrors ? 0x151515 : 0x2a2a2a));
      const bz = s.bz ?? (g.zr1 + g.zr0) / 2 + 0.12;
      for (const z of [fz - r - 0.14, bz, rz + r + 0.12, ...(s.pz || [])]) {
        const h = belt(z) - sill - 0.07;
        if (h > 0.1) trim.push(paint(box(0.012, h, 0.012, sx * hwF(z) * 0.985, sill + 0.03 + h / 2, z), 0x202020));
      }
      for (const z of [bz + 0.12, bz - 0.55]) if (z > rz + r) trim.push(paint(box(0.02, 0.035, 0.13, sx * (hwF(z) * 0.96 + 0.012), belt(z) - 0.11, z - 0.1), 0x3a3a3a));
      if (s.cladding) trim.push(paint(box(0.03, 0.14, L - 2.1, sx * (hwF(0) - 0.005), sill + 0.06, (rz + fz) / 2), 0x1a1a1a));
    }
    if (s.rails) for (const sx of [-1, 1]) trim.push(paint(box(0.04, 0.04, g.zr1 - g.zr0 - 0.1, sx * (gtw((g.zr0 + g.zr1) / 2) - 0.08), roofY + 0.06, (g.zr0 + g.zr1) / 2), 0x1b1b1b));
    if (s.spare) trim.push(paint(new THREE.CylinderGeometry(r + 0.03, r + 0.03, 0.2, 16).rotateX(Math.PI / 2).translate(0, belt(-L / 2) - 0.05, -L / 2 - 0.12), 0x1a1a1a));
    if (s.rack) for (const x of [-0.45, 0.45]) trim.push(paint(box(0.03, 0.03, g.zr1 - g.zr0, x, roofY + 0.08, (g.zr0 + g.zr1) / 2), 0xbfbfbf));
  }
  // Head and tail lamps (+ amber indicators), on the nose and tail faces.
  const hx = Math.min(W / 2 - 0.26, hwF(L / 2 - 0.06) - 0.2);
  for (const sx of [-1, 1]) {
    lamps.push(paint(box(s.lampW ?? 0.3, 0.12, 0.06, sx * hx, noseY - 0.07, L / 2 - 0.015), 0xfff2d2));
    lamps.push(paint(box(0.08, 0.05, 0.05, sx * (hx + 0.16), noseY - 0.1, L / 2 - 0.03), 0xff9a1a));
    const tx = hwF(-L / 2 + 0.06) - 0.14;
    if (s.tail === 'wide') lamps.push(paint(box(0.34, 0.11, 0.06, sx * (tx - 0.08), tailY - 0.08, -L / 2 + 0.01), 0xc81010));
    else lamps.push(paint(box(0.13, 0.26, 0.06, sx * tx, tailY - 0.02 + (s.tailUp ?? 0), -L / 2 + 0.01), 0xc81010));
  }
  return {
    paint: mergePlain(paintParts.map(strip)),
    glass: mergePlain(glass.map(strip)),
    trim: merge(trim),
    lamps: merge(lamps),
  };
}

// ------------------------------------------------------------------ cars (real sizes)
const B = (pairs) => pairs; // readability: belt lines
const SPECS = {
  // Maruti Alto 800 / K10: 3.45 × 1.49 × 1.47, small upright hatch.
  alto: { L: 3.45, W: 1.49, H: 1.47, wb: 2.36, r: 0.27, fo: 0.6, belt: B([[-1.725, 0.6], [-1.66, 0.84], [0.45, 0.87], [0.62, 0.86], [1.5, 0.74], [1.725, 0.6]]), glass: { z0: -1.64, zr0: -1.5, zr1: -0.1, z1: 0.6 }, tumble: 0.8, rim: 0x6f7378 },
  // Maruti WagonR: 3.66 × 1.62 × 1.68, the tall-boy; the most common kaali-peeli today.
  wagonr: { L: 3.655, W: 1.62, H: 1.675, wb: 2.435, r: 0.28, fo: 0.66, belt: B([[-1.83, 0.62], [-1.79, 0.94], [0.7, 0.98], [0.95, 0.96], [1.62, 0.8], [1.83, 0.62]]), glass: { z0: -1.79, zr0: -1.73, zr1: 0.3, z1: 0.95 }, tumble: 0.86, roundF: 0.18, tail: 'tall', tailUp: 0.15 },
  // Maruti Swift: 3.85 × 1.735 × 1.53, rounded, black pillars ("floating roof").
  swift: { L: 3.845, W: 1.735, H: 1.53, wb: 2.45, r: 0.3, fo: 0.74, belt: B([[-1.92, 0.62], [-1.86, 0.9], [-1.0, 0.95], [0.55, 0.92], [0.8, 0.9], [1.65, 0.74], [1.92, 0.58]]), glass: { z0: -1.86, zr0: -1.38, zr1: 0.0, z1: 0.8 }, tumble: 0.74, blackPillars: true, roundF: 0.22, roundR: 0.16, shoulder: 0.12 },
  // Hyundai Grand i10 / Santro class: 3.8 × 1.68 × 1.52.
  i10: { L: 3.8, W: 1.68, H: 1.52, wb: 2.45, r: 0.29, fo: 0.7, belt: B([[-1.9, 0.62], [-1.85, 0.9], [0.6, 0.92], [0.8, 0.9], [1.65, 0.75], [1.9, 0.6]]), glass: { z0: -1.85, zr0: -1.55, zr1: -0.05, z1: 0.8 }, tumble: 0.78, roundF: 0.2 },
  // Maruti Dzire: 3.995 × 1.735 × 1.515 compact sedan with a stubby boot.
  dzire: { L: 3.995, W: 1.735, H: 1.515, wb: 2.45, r: 0.3, fo: 0.76, belt: B([[-2.0, 0.62], [-1.94, 0.9], [-1.4, 0.94], [0.6, 0.9], [0.85, 0.88], [1.7, 0.74], [2.0, 0.58]]), glass: { z0: -1.36, zr0: -0.78, zr1: 0.08, z1: 0.86 }, tumble: 0.76, tail: 'wide', roundR: 0.14 },
  // Honda City: 4.55 × 1.75 × 1.49 mid-size sedan.
  city: { L: 4.55, W: 1.75, H: 1.49, wb: 2.6, r: 0.31, fo: 0.9, belt: B([[-2.275, 0.64], [-2.2, 0.92], [-1.6, 0.96], [0.8, 0.9], [1.1, 0.88], [1.95, 0.72], [2.275, 0.58]]), glass: { z0: -1.55, zr0: -0.92, zr1: 0.22, z1: 1.08 }, tumble: 0.74, tail: 'wide', roundF: 0.22, roundR: 0.18, shoulder: 0.12, rim: 0xa8acb2 },
  // Maruti Ertiga: 4.395 × 1.735 × 1.69, the app-cab MPV.
  ertiga: { L: 4.395, W: 1.735, H: 1.69, wb: 2.74, r: 0.31, fo: 0.82, belt: B([[-2.2, 0.64], [-2.14, 0.96], [0.8, 0.98], [1.1, 0.96], [1.95, 0.8], [2.2, 0.62]]), glass: { z0: -2.14, zr0: -2.0, zr1: 0.38, z1: 1.12 }, tumble: 0.82, pz: [-1.1], tail: 'tall', tailUp: 0.1, rails: true },
  // Toyota Innova Crysta: 4.735 × 1.83 × 1.795, big MPV.
  innova: { L: 4.735, W: 1.83, H: 1.795, wb: 2.75, r: 0.33, fo: 0.93, belt: B([[-2.37, 0.66], [-2.3, 1.02], [0.9, 1.04], [1.25, 1.02], [2.05, 0.9], [2.37, 0.68]]), glass: { z0: -2.3, zr0: -2.15, zr1: 0.55, z1: 1.3 }, tumble: 0.82, pz: [-1.2], tail: 'tall', tailUp: 0.12, rails: true, grille: 'tall', rim: 0xa8acb2 },
  // Mahindra Bolero: 3.995 × 1.745 × 1.88, the boxy workhorse (police, politicians, everyone).
  bolero: { L: 3.995, W: 1.745, H: 1.88, wb: 2.68, r: 0.36, fo: 0.67, sill: 0.5, belt: B([[-2.0, 0.7], [-1.97, 1.15], [0.6, 1.16], [0.68, 1.14], [1.85, 1.1], [1.995, 1.02]]), glass: { z0: -1.96, zr0: -1.93, zr1: 0.4, z1: 0.66 }, tumble: 0.92, shoulder: 0.04, roundF: 0.06, roundR: 0.05, grille: 'tall', spare: true, cladding: true, bumperHex: 0x2a2a2a, tail: 'tall', tailUp: 0.12, rim: 0x5c6066 },
  // Hyundai Creta / Tata Nexon class compact SUV: 4.3 × 1.79 × 1.635.
  creta: { L: 4.3, W: 1.79, H: 1.635, wb: 2.61, r: 0.34, fo: 0.86, sill: 0.46, belt: B([[-2.15, 0.7], [-2.08, 1.0], [-1.0, 1.04], [0.85, 1.0], [1.05, 0.98], [1.95, 0.86], [2.15, 0.7]]), glass: { z0: -2.0, zr0: -1.62, zr1: 0.35, z1: 1.05 }, tumble: 0.76, cladding: true, rails: true, grille: 'tall', roundF: 0.2, rim: 0x9da1a6 },
  // Maruti Eeco: 3.675 × 1.475 × 1.825, the one-box van (school runs, goods, ambulances).
  eeco: { L: 3.675, W: 1.475, H: 1.825, wb: 2.35, r: 0.27, fo: 0.62, belt: B([[-1.84, 0.62], [-1.8, 0.98], [1.3, 1.0], [1.55, 0.96], [1.8, 0.86], [1.84, 0.66]]), glass: { z0: -1.8, zr0: -1.78, zr1: 1.05, z1: 1.52 }, tumble: 0.9, shoulder: 0.05, roundF: 0.12, roundR: 0.05, pz: [-0.5], tail: 'tall', tailUp: 0.1, rim: 0x6f7378 },
};
// Kaali-peeli today: WagonR / Santro bodies, black with a yellow roof and yellow plates.
SPECS.taxi = { ...SPECS.wagonr, taxi: true, rack: true };
SPECS.taxiI10 = { ...SPECS.i10, taxi: true };
// App cabs: white Dzire / Ertiga / WagonR with yellow commercial plates.
SPECS.cabDzire = { ...SPECS.dzire, cab: true };
SPECS.cabErtiga = { ...SPECS.ertiga, cab: true };
// Mumbai's Cool Cab style: blue body, yellow plates.
SPECS.coolcab = { ...SPECS.ertiga, cab: true };

// ------------------------------------------------------------------ buses, trucks, two-wheelers
/** BEST bus: red, rounded box; single-decker (12 m) or the new electric double-decker. */
function bestBus(deck2, far = false) {
  const L = deck2 ? 9.8 : 11.6, W = 2.55, H = deck2 ? 4.72 : 3.2, r = 0.5;
  const fz = L / 2 - 2.3, rz = deck2 ? -L / 2 + 2.2 : -L / 2 + 3.0;
  const zs = stations(-L / 2, L / 2, far ? 1.2 : 0.5, [rz, fz], r + 0.15, 0.1);
  const bottom = archLine([rz, fz], r, 0.36, 0.08);
  const hw = (z) => { const d = Math.min(L / 2 - z, z + L / 2), t = Math.max(0, 1 - d / 0.4); return W / 2 - 0.08 * t * t; };
  const body = loft(zs, { y0: bottom, y1: () => H, hw, tw: (z) => hw(z) - 0.03, rb: () => 0.06, rt: () => 0.22 }, { n: far ? 1 : 2 });
  // Window bands (glass, a little proud of the body) with red pillars.
  const glass = [], trim = [], lamps = [], paintParts = [body];
  const bands = deck2 ? [[1.15, 2.2], [2.75, 3.95]] : [[1.2, 2.45]];
  for (const [y0, y1] of bands) glass.push(box(W + 0.02, y1 - y0, L - 1.0, 0, (y0 + y1) / 2, -0.25));
  glass.push(box(W - 0.2, deck2 ? 1.3 : 1.45, 0.04, 0, deck2 ? 1.65 : 1.75, L / 2 + 0.005)); // windscreen
  if (deck2) glass.push(box(W - 0.3, 1.0, 0.04, 0, 3.4, L / 2 + 0.005)); // upper front window
  if (!far) {
    for (const [y0, y1] of bands) for (let z = -L / 2 + 0.55; z < L / 2 - 0.9; z += 1.15) for (const sx of [-1, 1]) paintParts.push(box(0.04, y1 - y0, 0.14, sx * (W / 2 + 0.015), (y0 + y1) / 2, z));
    trim.push(paint(box(W + 0.03, 0.1, L - 0.3, 0, bands[0][0] - 0.1, 0), 0xf0e6cc)); // cream band
    trim.push(paint(box(1.7, 0.28, 0.04, 0, deck2 ? 4.4 : 2.85, L / 2 + 0.03), 0x111111)); // destination board
    trim.push(paint(box(0.95, 2.0, 0.03, W / 2 + 0.01, 1.35, L / 2 - 1.2), 0x2a0e0b), paint(box(0.95, 2.0, 0.03, W / 2 + 0.01, 1.35, -0.6), 0x2a0e0b)); // doors (left side)
    trim.push(paint(box(W + 0.02, 0.28, 0.14, 0, 0.5, L / 2), 0x2a2a2c), paint(box(W + 0.02, 0.28, 0.14, 0, 0.5, -L / 2), 0x2a2a2c));
    for (const wz of [rz, fz]) trim.push(paint(box(W - 0.4, r, 2 * r + 0.2, 0, r * 1.3, wz), 0x0a0a0a));
    lamps.push(paint(box(1.3, 0.14, 0.03, 0, deck2 ? 4.4 : 2.85, L / 2 + 0.05), 0xffa020));
  }
  trim.push(...wheelSet([rz, fz], W / 2 - 0.2, r, 0.3, 0x7a7d82, far ? 8 : 16));
  for (const sx of [-1, 1]) {
    lamps.push(paint(box(0.3, 0.16, 0.05, sx * (W / 2 - 0.3), 0.75, L / 2 + 0.01), 0xfff2d2));
    lamps.push(paint(box(0.18, 0.3, 0.05, sx * (W / 2 - 0.2), 0.95, -L / 2 - 0.01), 0xc81010));
  }
  return { paint: mergePlain(paintParts.map(strip)), glass: mergePlain(glass.map(strip)), trim: merge(trim), lamps: merge(lamps) };
}

/** Tata Ace "chhota haathi": cab-over mini truck with a load bed (tarp or open). */
function ace(far = false) {
  const L = 3.8, W = 1.5, r = 0.31, fz = 1.25, rz = fz - 2.1;
  const cab = loft(stations(0.55, 1.9, far ? 0.6 : 0.12), { y0: () => 0.55, y1: curve([[0.55, 1.85], [1.4, 1.85], [1.75, 1.6], [1.9, 1.0]]), hw: () => W / 2 - 0.02, tw: () => W / 2 - 0.1, rb: () => 0.05, rt: () => 0.12 }, { n: far ? 1 : 2 });
  const glass = [loft(stations(1.45, 1.86, 0.1), { y0: () => 1.1, y1: curve([[1.45, 1.78], [1.78, 1.55], [1.86, 1.12]]), hw: () => W / 2 - 0.0, tw: () => W / 2 - 0.08, rb: () => 0.01, rt: () => 0.05 }, { n: 1 })];
  const trim = [
    paint(box(W, 0.12, 2.6, 0, 0.62, -0.75), 0x2a2a2a), // chassis / bed floor
    paint(box(0.04, 0.4, 2.55, W / 2 - 0.02, 0.88, -0.75), 0x8a6a3c), paint(box(0.04, 0.4, 2.55, -W / 2 + 0.02, 0.88, -0.75), 0x8a6a3c), paint(box(W, 0.4, 0.04, 0, 0.88, -2.04), 0x8a6a3c), // wooden sides
    paint(box(W - 0.1, 0.55, 2.3, 0, 1.0, -0.8), 0x3b5e8c), // tarpaulin-covered load
    paint(box(0.5, 0.12, 0.02, 0, 0.75, 1.91), 0xf2c200),
    ...wheelSet([rz, fz], W / 2 - 0.12, r, 0.17, 0x6f7378, far ? 8 : 14),
  ];
  const lamps = [];
  for (const sx of [-1, 1]) { lamps.push(paint(box(0.22, 0.12, 0.04, sx * 0.55, 1.05, 1.9), 0xfff2d2), paint(box(0.12, 0.18, 0.04, sx * 0.62, 0.8, -2.07), 0xc81010)); }
  return { paint: mergePlain([cab].map(strip)), glass: mergePlain(glass.map(strip)), trim: merge(trim), lamps: merge(lamps) };
}

/** Goods truck (Tata 407 class) for night deliveries. */
function truck(far = false) {
  const L = 5.6, W = 2.0, r = 0.4, fz = 1.75, rz = -1.65;
  const cab = loft(stations(1.2, 2.8, far ? 0.6 : 0.15), { y0: () => 0.7, y1: curve([[1.2, 2.25], [2.2, 2.25], [2.65, 1.95], [2.8, 1.2]]), hw: () => W / 2 - 0.03, tw: () => W / 2 - 0.12, rb: () => 0.05, rt: () => 0.14 }, { n: far ? 1 : 2 });
  const glass = [loft(stations(2.25, 2.75, 0.1), { y0: () => 1.35, y1: curve([[2.25, 2.15], [2.62, 1.9], [2.75, 1.38]]), hw: () => W / 2 - 0.02, tw: () => W / 2 - 0.1, rb: () => 0.01, rt: () => 0.05 }, { n: 1 })];
  const trim = [
    paint(box(W, 0.18, 4.0, 0, 0.78, -0.75), 0x2a2a2a),
    paint(box(W + 0.04, 1.5, 3.8, 0, 1.65, -0.8), 0xd9c27a), // load body (painted wooden box, truck art below)
    paint(box(W + 0.06, 0.2, 3.82, 0, 2.45, -0.8), 0x8b2a1a),
    paint(box(1.4, 0.4, 0.02, 0, 1.2, -2.72), 0xf6f1e3), // "Horn OK Please" board
    paint(box(0.5, 0.12, 0.02, 0, 0.82, 2.84), 0xf2c200),
    ...wheelSet([rz, fz], W / 2 - 0.16, r, 0.24, 0x6f7378, far ? 8 : 14),
  ];
  const lamps = [];
  for (const sx of [-1, 1]) { lamps.push(paint(box(0.24, 0.14, 0.04, sx * 0.7, 1.25, 2.82), 0xfff2d2), paint(box(0.14, 0.2, 0.04, sx * 0.8, 0.95, -2.72), 0xc81010)); }
  return { paint: mergePlain([cab].map(strip)), glass: mergePlain(glass.map(strip)), trim: merge(trim), lamps: merge(lamps) };
}

/** Scooter (Activa class): front apron, floorboard, rear body; optional delivery box. */
function scooter(delivery = false, far = false) {
  const r = 0.25;
  const n = far ? 1 : 2;
  const apron = loft(stations(0.38, 0.62, 0.06), { y0: () => 0.3, y1: curve([[0.38, 1.0], [0.55, 1.08], [0.62, 0.9]]), hw: () => 0.2, tw: () => 0.12, rb: () => 0.05, rt: () => 0.06 }, { n });
  const rear = loft(stations(-0.68, 0.0, 0.08), { y0: curve([[-0.68, 0.48], [-0.3, 0.32], [0.0, 0.36]]), y1: curve([[-0.68, 0.7], [-0.4, 0.78], [0.0, 0.72]]), hw: curve([[-0.68, 0.12], [-0.3, 0.19], [0.0, 0.17]]), rb: () => 0.06, rt: () => 0.08 }, { n });
  const paintParts = [apron, rear, box(0.3, 0.06, 0.45, 0, 0.32, 0.17)];
  const trim = [
    paint(cyl(r, 0.1, far ? 8 : 14).translate(0, r, 0.66), 0x141414), paint(cyl(r, 0.1, far ? 8 : 14).translate(0, r, -0.6), 0x141414),
    paint(cyl(r * 0.55, 0.12, 8).translate(0, r, 0.66), 0x8a8d92), paint(cyl(r * 0.55, 0.12, 8).translate(0, r, -0.6), 0x8a8d92),
    paint(box(0.26, 0.09, 0.62, 0, 0.8, -0.32), 0x1a1a1a), // seat
    paint(box(0.62, 0.04, 0.04, 0, 1.08, 0.52), 0x2a2a2a), // handlebar
    paint(box(0.05, 0.7, 0.05, 0, 0.66, 0.6), 0x3a3a3a), // fork
  ];
  if (delivery) trim.push(paint(box(0.42, 0.42, 0.4, 0, 1.06, -0.62), 0xe8611a)); // insulated food box ("Bhookh" orange)
  const glass = [box(0.2, 0.1, 0.02, 0, 1.12, 0.6)];
  const lamps = [paint(box(0.14, 0.08, 0.03, 0, 1.0, 0.63), 0xfff2d2), paint(box(0.12, 0.05, 0.03, 0, 0.66, -0.69), 0xc81010)];
  return { paint: mergePlain(paintParts.map(strip)), glass: mergePlain(glass.map(strip)), trim: merge(trim), lamps: merge(lamps) };
}

/** Commuter motorcycle (Splendor / Pulsar class); `bullet` for the heavy classic. */
function motorbike(bullet = false, far = false) {
  const r = bullet ? 0.33 : 0.3;
  const tank = loft(stations(-0.05, 0.42, 0.06), { y0: () => 0.72, y1: curve([[-0.05, 0.9], [0.2, 0.98], [0.42, 0.92]]), hw: curve([[-0.05, 0.1], [0.2, 0.15], [0.42, 0.11]]), rb: () => 0.04, rt: () => 0.06 }, { n: far ? 1 : 2 });
  const paintParts = [tank, box(0.16, 0.12, 0.42, 0, 0.72, -0.5), box(0.2, 0.05, 0.3, 0, 0.62, 0.72)];
  const trim = [
    paint(cyl(r, 0.1, far ? 8 : 16).translate(0, r, 0.68), 0x141414), paint(cyl(r, 0.11, far ? 8 : 16).translate(0, r, -0.64), 0x141414),
    paint(cyl(r * 0.72, 0.12, 10).translate(0, r, 0.68), 0x6f7378), paint(cyl(r * 0.72, 0.12, 10).translate(0, r, -0.64), 0x6f7378),
    paint(box(0.24, 0.3, 0.36, 0, 0.5, 0.02), bullet ? 0x2b2b2b : 0x4a4d52), // engine
    paint(new THREE.CylinderGeometry(0.045, 0.05, 0.85, 8).rotateX(Math.PI / 2).translate(0.15, 0.38, -0.35), 0xb8bcc2), // exhaust
    paint(box(0.24, 0.08, 0.58, 0, 0.86, -0.3), 0x161616), // seat
    paint(box(0.05, 0.62, 0.05, 0, 0.66, 0.62), 0x7a7d82), // fork
    paint(box(0.66, 0.035, 0.035, 0, 1.06, 0.5), 0x2a2a2a), // handlebar
  ];
  const glass = [box(0.16, 0.1, 0.02, 0, 1.08, 0.66)];
  const lamps = [paint(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 10).rotateX(Math.PI / 2).translate(0, 0.94, 0.72), 0xfff2d2), paint(box(0.12, 0.06, 0.03, 0, 0.78, -0.74), 0xc81010)];
  return { paint: mergePlain(paintParts.map(strip)), glass: mergePlain(glass.map(strip)), trim: merge(trim), lamps: merge(lamps) };
}

/** The vintage Premier Padmini kaali-peeli (the player's taxi is one of the last). */
function padmini() {
  return lofted({ L: 3.73, W: 1.47, H: 1.43, wb: 2.34, r: 0.28, fo: 0.68, belt: [[-1.865, 0.62], [-1.8, 0.82], [-1.3, 0.84], [0.95, 0.84], [1.7, 0.8], [1.865, 0.62]], glass: { z0: -1.3, zr0: -1.0, zr1: 0.5, z1: 0.95 }, tumble: 0.8, shoulder: 0.06, taxi: true, rack: true, tail: 'wide', bumperHex: 0xc9ccd1, rim: 0xc9ccd1, roundF: 0.1, roundR: 0.1 });
}

/** Commercial white is the most common car colour in India by far, then silver and grey. */
const PRIVATE = [0xf4f4f2, 0xf4f4f2, 0xf4f4f2, 0xf4f4f2, 0xc5c8cc, 0xc5c8cc, 0x8a8f95, 0x9b1b1b, 0x1d3f7a, 0x1b1b1b, 0x6b4a32, 0xd9d4c7, 0x8c1c2a];

/**
 * type → { parts, far, name, len, wid, speed, weight, night, tints, rider, big, mainRoad }.
 * weight: share in South Mumbai daytime traffic; night: multiplier after 10 pm.
 */
export function buildFleet() {
  const T = {};
  const car = (key, spec, o) => { T[key] = { parts: lofted(spec), far: lofted(spec, true), len: spec.L, wid: spec.W, ...o }; };
  car('taxi', SPECS.taxi, { name: 'Kaali-peeli (Maroti WagonAar)', speed: 11, weight: 2.6, night: 1.5, tints: [0x070707] });
  car('taxiI10', SPECS.taxiI10, { name: 'Kaali-peeli (Hundai Santaro)', speed: 11, weight: 1.0, night: 1.5, tints: [0x070707] });
  car('alto', SPECS.alto, { name: 'Maroti Altu', speed: 11.5, weight: 1.4, night: 0.6, tints: PRIVATE });
  car('wagonr', SPECS.wagonr, { name: 'Maroti WagonAar', speed: 11.5, weight: 1.5, night: 0.6, tints: PRIVATE });
  car('swift', SPECS.swift, { name: 'Maroti Swyft', speed: 12.5, weight: 1.4, night: 0.7, tints: [...PRIVATE, 0xc0281f, 0x2a59b8] });
  car('i10', SPECS.i10, { name: 'Hundai Grand Aai-10', speed: 12, weight: 0.9, night: 0.6, tints: PRIVATE });
  car('dzire', SPECS.dzire, { name: 'Maroti Desire', speed: 12.5, weight: 0.9, night: 0.7, tints: PRIVATE });
  car('cabDzire', SPECS.cabDzire, { name: 'Kidhar cab (Maroti Desire)', speed: 12.5, weight: 1.2, night: 1.2, tints: [0xf4f4f2, 0xf4f4f2, 0xc5c8cc] });
  car('city', SPECS.city, { name: 'Handa Citi', speed: 13, weight: 0.5, night: 0.6, tints: PRIVATE });
  car('ertiga', SPECS.ertiga, { name: 'Maroti Urtiga', speed: 12, weight: 0.5, night: 0.6, tints: PRIVATE });
  car('cabErtiga', SPECS.cabErtiga, { name: 'Kidhar XL (Maroti Urtiga)', speed: 12, weight: 0.8, night: 1.2, tints: [0xf4f4f2, 0xc5c8cc] });
  car('coolcab', SPECS.coolcab, { name: 'Kool Kab', speed: 12, weight: 0.25, night: 1, tints: [0x1f5fa8] });
  car('innova', SPECS.innova, { name: 'Toyoda Innovaa', speed: 12.5, weight: 0.6, night: 0.8, tints: [0xf4f4f2, 0xf4f4f2, 0xc5c8cc, 0x8a8f95, 0x5a2a1a] });
  car('bolero', SPECS.bolero, { name: 'Mahendra Bolerro', speed: 11.5, weight: 0.45, night: 0.7, tints: [0xf4f4f2, 0xf4f4f2, 0x8a8f95, 0x1b1b1b, 0x6b4a32] });
  car('creta', SPECS.creta, { name: 'Hundai Kreta', speed: 13, weight: 0.6, night: 0.7, tints: [0xf4f4f2, 0x1b1b1b, 0x8a8f95, 0xc0281f, 0x2a59b8] });
  car('eeco', SPECS.eeco, { name: 'Maroti Eko van', speed: 10.5, weight: 0.4, night: 1.2, tints: [0xf4f4f2, 0xf4f4f2, 0xc5c8cc] });
  T.padmini = { parts: padmini(), far: lofted({ L: 3.73, W: 1.47, H: 1.43, wb: 2.34, r: 0.28, fo: 0.68, belt: [[-1.865, 0.62], [-1.8, 0.82], [0.95, 0.84], [1.865, 0.62]], glass: { z0: -1.3, zr0: -1.0, zr1: 0.5, z1: 0.95 }, taxi: true }, true), name: 'Premiyar Padmini kaali-peeli', len: 3.73, wid: 1.47, speed: 10.5, weight: 0.12, night: 1, tints: [0x070707] };
  T.bus = { parts: bestBus(false), far: bestBus(false, true), name: 'BEST bus', len: 11.6, wid: 2.55, speed: 9, weight: 0.8, night: 0.3, tints: [0xc0281f], big: true, mainRoad: true };
  T.decker = { parts: bestBus(true), far: bestBus(true, true), name: 'BEST electric double-decker', len: 9.8, wid: 2.55, speed: 8.5, weight: 0.35, night: 0.2, tints: [0xc0281f], big: true, mainRoad: true };
  T.ace = { parts: ace(), far: ace(true), name: 'Tota Ase "chhota haathi"', len: 3.8, wid: 1.5, speed: 9.5, weight: 0.7, night: 2.5, tints: [0xf4f4f2, 0xf2f2f2, 0x2d6cb5, 0xd8d8d8] };
  T.tempo = { parts: truck(), far: truck(true), name: 'Tempo (Tota 407)', len: 5.6, wid: 2.0, speed: 9, weight: 0.3, night: 3.5, tints: [0xf2c200, 0x2d6cb5, 0xe8e8e8, 0x2f8f4e] };
  T.scooter = { parts: scooter(), far: scooter(false, true), name: 'Handa Aktiva', len: 1.85, wid: 0.7, speed: 12, weight: 3.0, night: 0.5, tints: [0xf4f4f2, 0x1b1b1b, 0xc5c8cc, 0x8c1c2a, 0x1d3f7a, 0x6b4a32], rider: true, seat: 0.8 };
  T.delivery = { parts: scooter(true), far: scooter(true, true), name: 'Bhookh delivery scooter', len: 1.9, wid: 0.7, speed: 12.5, weight: 0.8, night: 1.4, tints: [0x1b1b1b, 0xc5c8cc, 0xf4f4f2], rider: true, seat: 0.8 };
  T.bike = { parts: motorbike(), far: motorbike(false, true), name: 'Hiro Splendour', len: 2.0, wid: 0.75, speed: 13, weight: 2.0, night: 0.6, tints: [0x1b1b1b, 0x1b1b1b, 0xb32020, 0x1d3f7a, 0x2e2e2e, 0x5a5a5a], rider: true, seat: 0.86 };
  T.bullet = { parts: motorbike(true), far: motorbike(true, true), name: 'Royal Enfeeld Bullet', len: 2.15, wid: 0.8, speed: 12.5, weight: 0.35, night: 0.6, tints: [0x111111, 0x5a1a14, 0x2e3a2a], rider: true, seat: 0.86 };
  return T;
}
