import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { POINT } from './tileFormat.js';
import { Y } from './levels.js';
import { HOARDING } from './mesh/hoardingMesh.js';
import { facadeNight } from './facade.js';
import { POSE, FLAG, SKIN } from '../sim/people.js';
import { profileOf } from '../sim/traffic.js';

// Street clutter near the player (points from scripts/lib/clutter.mjs, shopfronts from the tile
// worker's shutter boxes): unipole hoardings, blue street-name and direction boards (text drawn
// on demand into one atlas), overhead gantries, cable bundles across the lanes, awnings and blue
// tarpaulins over shopfronts, stalls and bazaar lanes, white puja canopies, small shrines,
// flower sellers, compound gates with a watchman dozing on a plastic chair.
//
// Draw calls: one BatchedMesh for everything solid (vertex colours, tinted per instance), one
// for cloth (two-sided), one instanced mesh for board faces (atlas) and one for unipole ads
// (the rooftop hoardings' atlas) — four in all, refreshed as the player moves.

const SHRINE = { TEMPLE: 0, JAIN: 1, DARGAH: 2, CROSS: 3, BUDDHIST: 4, SIKH: 5 };
const CELL_W = 512, CELL_H = 128; // one board line (name board, or one destination with its arrow)

// ------------------------------------------------------------------ geometry helpers
/** Non-indexed geometry with position, normal and colour only (one layout for a batch). */
function paint(g, hex, jitter = 0, seed = 1) {
  g = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  let s = seed;
  for (let i = 0; i < n; i += 3) {
    const k = jitter ? 1 + (((s = (s * 16807) % 2147483647) / 2147483647) - 0.5) * jitter : 1;
    for (let j = i; j < i + 3 && j < n; j++) { a[j * 3] = c.r * k; a[j * 3 + 1] = c.g * k; a[j * 3 + 2] = c.b * k; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
const box = (w, h, d, x, y, z, hex) => paint(new THREE.BoxGeometry(w, h, d).translate(x, y, z), hex);
/** Cylinder standing on y (bottom radius r0, top r1). */
const cyl = (r0, r1, h, x, y, z, hex, seg = 8) => paint(new THREE.CylinderGeometry(r1, r0, h, seg).translate(x, y + h / 2, z), hex);
const ball = (r, x, y, z, hex, sy = 1, seg = 8) => paint(new THREE.SphereGeometry(r, seg, Math.max(4, seg - 2)).scale(1, sy, 1).translate(x, y, z), hex);
const merge = (list) => mergeGeometries(list);
/** A thin beam from a to b (square section t). */
function beam(a, b, t, hex) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = A.distanceTo(B);
  const g = new THREE.BoxGeometry(t, t, len);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), B.clone().sub(A).normalize()));
  return paint(g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2), hex);
}
/** A flag: a triangle of cloth on a thin pole. */
function flag(x, z, h, hex, w = 0.55) {
  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.Float32BufferAttribute([x, h, z, x, h - 0.35, z, x + w, h - 0.17, z, x, h, z, x + w, h - 0.17, z, x, h - 0.35, z], 3));
  tri.computeVertexNormals();
  return [cyl(0.018, 0.015, h, x, 0, z, 0x6b5a45, 5), paint(tri, hex)];
}
/** Grid sheet over x ∈ [-0.5, 0.5], z ∈ [0, 1] sagging to y = -1 in the middle (cloth, tarps). */
function sheet(nx = 8, nz = 6, hexes = [0xffffff], stripeAxis = 'x', jitter = 0.12) {
  const pos = [], col = [];
  let s = 7;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const y = (u, v) => -(1 - (2 * u) ** 2) * (1 - (2 * v - 1) ** 2);
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const u0 = i / nx - 0.5, u1 = (i + 1) / nx - 0.5, v0 = j / nz, v1 = (j + 1) / nz;
    const c = new THREE.Color(hexes[(stripeAxis === 'x' ? i : j) % hexes.length]).multiplyScalar(1 + (r() - 0.5) * jitter);
    const quad = [[u0, v0], [u1, v0], [u1, v1], [u0, v0], [u1, v1], [u0, v1]];
    for (const [u, v] of quad) { pos.push(u, y(u, v), v); col.push(c.r, c.g, c.b); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------ the kit
/** Unipole: a galvanised pole with a V of two boards opening towards +z (faces drawn as ads). */
const UNI = { W: 11, H: 5.5, Y0: 12.4, GAMMA: 0.62, APEX: 4.4 };
function unipoleBoards() {
  // Board k: from the apex (0, APEX) back along (∓sin γ, −cos γ); outward normal (∓cos γ, sin γ).
  return [-1, 1].map((sgn) => {
    const dx = sgn * Math.sin(UNI.GAMMA), dz = -Math.cos(UNI.GAMMA), nx = sgn * Math.cos(UNI.GAMMA), nz = Math.sin(UNI.GAMMA);
    return { cx: dx * UNI.W / 2, cz: UNI.APEX + dz * UNI.W / 2, dx, dz, nx, nz, yaw: Math.atan2(nx, nz) };
  });
}
const UNI_BOARDS = unipoleBoards();
function unipoleGeometry() {
  const steel = 0x8d9297, dark = 0x4b5056, parts = [box(1.6, 0.5, 1.6, 0, 0.25, 0, 0xb8b2a6), cyl(0.45, 0.32, UNI.Y0, 0, 0, 0, steel, 12)];
  for (const b of UNI_BOARDS) {
    const yaw = b.yaw, back = new THREE.BoxGeometry(UNI.W, UNI.H, 0.16).rotateY(yaw).translate(b.cx - b.nx * 0.1, UNI.Y0 + UNI.H / 2, b.cz - b.nz * 0.1);
    parts.push(paint(back, dark));
    parts.push(paint(new THREE.BoxGeometry(UNI.W, 0.08, 0.9).rotateY(yaw).translate(b.cx + b.nx * 0.2, UNI.Y0 - 0.06, b.cz + b.nz * 0.2), 0x6d7277)); // walkway
    for (const k of [-0.32, 0.32]) {
      const px = b.cx + b.dx * UNI.W * k, pz = b.cz + b.dz * UNI.W * k;
      parts.push(beam([0, UNI.Y0 - 1.6, 0], [px, UNI.Y0 - 0.1, pz], 0.14, steel)); // strut from the pole
      // Floodlight arm over the face.
      parts.push(beam([px - b.nx * 0.1, UNI.Y0 + UNI.H, pz - b.nz * 0.1], [px + b.nx * 1.1, UNI.Y0 + UNI.H + 0.5, pz + b.nz * 1.1], 0.06, dark), box(0.35, 0.18, 0.3, px + b.nx * 1.15, UNI.Y0 + UNI.H + 0.45, pz + b.nz * 1.15, 0x2a2d31));
    }
  }
  parts.push(box(1.2, 0.6, 1.2, 0, UNI.Y0 - 0.3, 0, steel));
  return merge(parts);
}

function shrineGeometry(kind) {
  const white = 0xf2ede2, cream = 0xe9dfc8, saffron = 0xe8862f, sindoor = 0xd2491b, gold = 0xd4a017, green = 0x1f7a4a;
  const parts = [box(1.3, 0.35, 1.0, 0, 0.175, 0, 0xb8b0a2), box(1.15, 0.12, 0.25, 0, 0.06, 0.62, 0xa8a094)]; // plinth and a step
  if (kind === SHRINE.TEMPLE || kind === SHRINE.JAIN) {
    const wall = kind === SHRINE.JAIN ? 0xf6f3ec : white, trim = kind === SHRINE.JAIN ? 0xc9b48a : saffron;
    parts.push(box(1.1, 1.15, 0.12, 0, 0.92, -0.38, wall), box(0.12, 1.15, 0.85, -0.49, 0.92, 0, wall), box(0.12, 1.15, 0.85, 0.49, 0.92, 0, wall));
    parts.push(box(1.24, 0.14, 1.0, 0, 1.56, 0, trim), box(1.1, 0.06, 0.06, 0, 1.45, 0.42, trim));
    // Shikhara: stepped tower with a kalash on top.
    for (let k = 0; k < 4; k++) parts.push(box(0.95 - k * 0.2, 0.22, 0.85 - k * 0.18, 0, 1.74 + k * 0.22, -0.02, k % 2 ? wall : trim));
    parts.push(paint(new THREE.ConeGeometry(0.2, 0.42, 8).translate(0, 2.8, -0.02), trim), ball(0.08, 0, 3.05, -0.02, gold));
    // The deity: a sindoor-orange stone (or white marble image in a Jain shrine), garland, lamps, bell.
    parts.push(ball(0.2, 0, 0.62, -0.12, kind === SHRINE.JAIN ? 0xf4f1ea : sindoor, 1.3), box(0.6, 0.06, 0.4, 0, 0.38, -0.1, 0x8a2a1a));
    parts.push(paint(new THREE.TorusGeometry(0.42, 0.035, 5, 14, Math.PI).rotateZ(Math.PI).translate(0, 1.42, 0.42), 0xff9a1a, 0.4, 3));
    for (const x of [-0.25, 0.25]) parts.push(box(0.06, 0.04, 0.06, x, 0.39, 0.25, 0xffd27a));
    parts.push(cyl(0.004, 0.004, 0.25, 0.3, 1.2, 0.36, 0x6b5a45, 3), paint(new THREE.ConeGeometry(0.06, 0.1, 8).translate(0.3, 1.18, 0.36), gold));
    parts.push(...flag(0.62, -0.42, 3.2, kind === SHRINE.JAIN ? 0xc8102e : 0xff8c1a));
  } else if (kind === SHRINE.DARGAH) {
    parts.push(box(1.1, 1.0, 0.85, 0, 0.85, -0.05, white), box(0.8, 0.75, 0.05, 0, 0.75, 0.38, 0x2d6a4a));
    parts.push(ball(0.42, 0, 1.35, -0.05, green, 0.85, 12), ball(0.06, 0, 1.78, -0.05, gold));
    for (const x of [-0.5, 0.5]) parts.push(cyl(0.06, 0.05, 1.65, x, 0.35, 0.36, white, 6), ball(0.08, x, 2.05, 0.36, green));
    parts.push(box(0.9, 0.08, 0.6, 0, 0.42, 0.62, 0x1d6b3e), box(0.95, 0.03, 0.04, 0, 0.47, 0.92, gold)); // green chadar with a gold edge
    parts.push(...flag(0.6, -0.4, 2.8, 0x1f9a4f));
  } else if (kind === SHRINE.CROSS) {
    parts.push(box(0.9, 1.2, 0.7, 0, 0.95, -0.05, white), box(0.7, 0.75, 0.04, 0, 1.0, 0.31, 0x9cb8cc)); // glass front
    parts.push(box(0.96, 0.1, 0.78, 0, 1.6, -0.05, 0x3b6ea8), box(0.08, 0.95, 0.08, 0, 2.1, -0.05, white), box(0.5, 0.08, 0.08, 0, 2.3, -0.05, white));
    parts.push(box(0.05, 0.4, 0.04, 0, 0.98, 0.25, 0xe9d8a6), box(0.24, 0.05, 0.04, 0, 1.08, 0.25, 0xe9d8a6)); // a little cross inside
    for (const x of [-0.25, -0.08, 0.1, 0.27]) parts.push(cyl(0.025, 0.025, 0.12 + Math.abs(x) * 0.3, x, 0.35, 0.55, 0xf5f0e2, 6)); // candles
    parts.push(ball(0.14, -0.32, 0.45, 0.6, 0xd63a3a, 0.6), ball(0.12, 0.33, 0.45, 0.6, 0xf2c94c, 0.6));
  } else if (kind === SHRINE.BUDDHIST) {
    parts.push(box(1.1, 1.0, 0.85, 0, 0.85, -0.05, white), box(0.6, 0.6, 0.04, 0, 0.85, 0.38, 0x2a4f9e));
    parts.push(paint(new THREE.SphereGeometry(0.45, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 1.35, -0.05), white), box(0.18, 0.12, 0.18, 0, 1.86, -0.05, gold), cyl(0.04, 0.01, 0.4, 0, 1.92, -0.05, gold, 6));
    parts.push(ball(0.16, 0, 0.62, 0.0, 0xd8c79a, 1.2));
    parts.push(...flag(0.62, -0.4, 3.0, 0x1f4fb5));
  } else {
    // Sikh: a small white kiosk and the tall saffron Nishan Sahib.
    parts.push(box(1.1, 1.0, 0.85, 0, 0.85, -0.05, white), box(1.2, 0.12, 0.95, 0, 1.4, -0.05, saffron), ball(0.3, 0, 1.5, -0.05, white, 0.9, 10), ball(0.06, 0, 1.82, -0.05, gold));
    parts.push(cyl(0.07, 0.05, 5.5, 0.55, 0.35, -0.4, saffron, 6), paint(new THREE.ConeGeometry(0.08, 0.3, 4).translate(0.55, 6.0, -0.4), 0xb8bcc2));
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([0.55, 5.7, -0.4, 0.55, 4.9, -0.4, 1.6, 5.3, -0.4, 0.55, 5.7, -0.4, 1.6, 5.3, -0.4, 0.55, 4.9, -0.4], 3));
    tri.computeVertexNormals();
    parts.push(paint(tri, 0xff8c1a));
  }
  return merge(parts);
}

/** Puja stall under a shamiana: table with flowers, garlands, coconuts; the canopy is cloth. */
function pujaStallGeometry() {
  const parts = [];
  for (const [x, z] of [[-1.5, -1.3], [1.5, -1.3], [-1.5, 1.3], [1.5, 1.3]]) parts.push(cyl(0.04, 0.035, 2.75, x, 0, z, 0xc9a86a, 6));
  parts.push(box(2.0, 0.08, 0.8, 0, 0.8, 0.1, 0x8b5a2b), box(2.0, 0.72, 0.04, 0, 0.42, 0.5, 0xb3261e)); // table with a red front cloth
  for (const x of [-0.9, 0.9]) parts.push(box(0.06, 0.78, 0.06, x, 0.39, -0.25, 0x6b4423));
  const heaps = [0xff9a1a, 0xffc61a, 0xd8222a, 0xf6f2ea, 0xff7a10];
  heaps.forEach((h, i) => parts.push(paint(new THREE.SphereGeometry(0.17, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.55, 1).translate(-0.72 + i * 0.36, 0.84, 0.15), h, 0.35, i + 2)));
  for (let i = 0; i < 6; i++) parts.push(ball(0.075, 0.55 + (i % 3) * 0.13, 0.9 + Math.floor(i / 3) * 0.1, -0.15, 0x6b3f1d)); // coconuts
  // Marigold garlands hanging from the canopy's front bar.
  parts.push(box(3.0, 0.05, 0.05, 0, 2.62, 1.3, 0xc9a86a));
  for (let i = 0; i < 9; i++) parts.push(cyl(0.035, 0.035, 0.75 + (i % 3) * 0.12, -1.3 + i * 0.32, 1.85 - (i % 3) * 0.12, 1.3, i % 2 ? 0xff9a1a : 0xffc61a, 5));
  return merge(parts);
}

/** Flower seller's pitch: a jute cloth, wide baskets heaped with marigold, roses and jasmine, a garland stand. */
function flowersGeometry(v) {
  const parts = [box(1.7, 0.02, 1.1, 0, 0.01, 0.1, 0xb59a6a)];
  const sets = [[0xff9a1a, 0xffc61a, 0xd8222a], [0xffc61a, 0xf6f2ea, 0xff7a10], [0xd8222a, 0xff9a1a, 0xf6f2ea]][v % 3];
  [[-0.5, 0.25], [0.15, 0.35], [0.62, 0.0]].forEach(([x, z], i) => {
    parts.push(cyl(0.36, 0.4, 0.12, x, 0.02, z, 0x9a7140, 10));
    parts.push(paint(new THREE.SphereGeometry(0.33, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.38, 1).translate(x, 0.13, z), sets[i], 0.45, 11 + i));
  });
  // Garland stand behind the seller.
  parts.push(cyl(0.02, 0.02, 1.4, -0.75, 0, -0.55, 0x6b5a45, 5), cyl(0.02, 0.02, 1.4, 0.75, 0, -0.55, 0x6b5a45, 5), box(1.55, 0.03, 0.03, 0, 1.38, -0.55, 0x6b5a45));
  for (let i = 0; i < 7; i++) parts.push(cyl(0.03, 0.03, 0.55 + (i % 2) * 0.15, -0.6 + i * 0.2, 0.8 - (i % 2) * 0.15, -0.55, i % 3 === 2 ? 0xf6f2ea : i % 2 ? 0xff9a1a : 0xffc61a, 5));
  parts.push(box(0.36, 0.3, 0.3, 0, 0.15, -0.3, 0x7a5232)); // the seller's low stool (patla)
  return merge(parts);
}

/** Monobloc plastic chair (white; tinted per instance), facing +z. */
function chairGeometry() {
  const c = 0xf2f1ec, parts = [box(0.46, 0.04, 0.44, 0, 0.43, 0, c)];
  for (const [x, z] of [[-0.21, 0.19], [0.21, 0.19], [-0.21, -0.19], [0.21, -0.19]]) parts.push(beam([x, 0.43, z], [x * 1.12, 0, z * 1.15], 0.04, c));
  parts.push(paint(new THREE.BoxGeometry(0.44, 0.46, 0.035).rotateX(-0.18).translate(0, 0.68, -0.25), c));
  for (const x of [-0.23, 0.23]) parts.push(box(0.04, 0.03, 0.4, x, 0.64, -0.02, c), box(0.04, 0.2, 0.04, x, 0.53, 0.16, c));
  return merge(parts);
}

/** Steel gate leaf, hinged at x = 0, 2.05 m long along +x (painted per instance). */
function gateLeafGeometry() {
  const c = 0xffffff, parts = [box(0.06, 1.75, 0.06, 0.03, 0.9, 0, c), box(0.06, 1.75, 0.06, 2.02, 0.9, 0, c), box(2.05, 0.06, 0.06, 1.02, 1.74, 0, c), box(2.05, 0.06, 0.06, 1.02, 0.08, 0, c), box(2.05, 0.05, 0.05, 1.02, 1.05, 0, c)];
  for (let i = 1; i < 10; i++) parts.push(box(0.025, 1.66, 0.025, i * 0.205, 0.91, 0, c));
  for (let i = 0; i < 5; i++) parts.push(ball(0.04, 0.2 + i * 0.4, 1.83, 0, c, 1.6, 5)); // spear tips
  return merge(parts);
}

function cabinGeometry() {
  const parts = [box(1.3, 0.1, 1.3, 0, 0.05, 0, 0x9a948a), box(1.2, 2.2, 1.2, 0, 1.2, 0, 0xe9e6dd), box(1.42, 0.12, 1.42, 0, 2.36, 0, 0x2f5f9e)];
  parts.push(box(0.9, 0.7, 0.03, 0, 1.55, 0.61, 0x2a3440), box(0.03, 0.7, 0.8, 0.61, 1.55, 0, 0x2a3440), box(0.6, 1.8, 0.03, -0.25, 1.0, -0.61, 0x6b7a8a));
  parts.push(box(0.8, 0.22, 0.03, 0, 2.1, 0.62, 0x1d3f8a)); // "SECURITY" board (blue)
  return merge(parts);
}

/** Unit cable from (0,0,0) to (0,0,1) sagging to y = -1 at the middle (matrix gives span, sag and side). */
function cableGeometry(seg = 10) {
  const pos = [], r = 0.02;
  const P = (t, a) => { const ca = Math.cos(a) * r, sa = Math.sin(a) * r; return [ca, -4 * t * (1 - t) + sa, t]; };
  for (let i = 0; i < seg; i++) for (let k = 0; k < 4; k++) {
    const t0 = i / seg, t1 = (i + 1) / seg, a0 = (k / 4) * Math.PI * 2 + Math.PI / 4, a1 = ((k + 1) / 4) * Math.PI * 2 + Math.PI / 4;
    const p = [P(t0, a0), P(t1, a0), P(t1, a1), P(t0, a1)];
    pos.push(...p[0], ...p[1], ...p[2], ...p[0], ...p[2], ...p[3]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return paint(g, 0x141414);
}
/** Unit straight rope / pole from (0,0,0) to (0,0,1). */
const lineGeometry = (r, hex, sides = 5) => paint(new THREE.CylinderGeometry(r, r, 1, sides, 1).rotateX(Math.PI / 2).translate(0, 0, 0.5), hex);

/** Cloth awning: a sloped sheet 1 deep (z) dropping 0.45 m, with a 0.25 m valance at the front. */
function awningCloth(hexes) {
  const g = sheet(hexes.length > 1 ? 10 : 6, 3, hexes, 'x', 0.06);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) * 0.06 - p.getZ(i) * 0.45);
  const val = new THREE.PlaneGeometry(1, 0.25, hexes.length > 1 ? 10 : 6, 1).translate(0, -0.45 - 0.125, 1);
  const vc = [], vp = val.toNonIndexed().attributes.position;
  for (let i = 0; i < vp.count; i++) { const k = Math.floor((vp.getX(i) + 0.5 - 1e-4) * (hexes.length > 1 ? 10 : 6)); const c = new THREE.Color(hexes[Math.max(0, k) % hexes.length]); vc.push(c.r, c.g, c.b); }
  const v2 = val.toNonIndexed();
  v2.deleteAttribute('uv');
  v2.setAttribute('color', new THREE.Float32BufferAttribute(vc, 3));
  g.computeVertexNormals();
  return merge([g, v2]);
}
function shamianaTop() {
  // White top with a ridge along x, scalloped valance in a red-yellow-green print.
  const top = sheet(10, 8, [0xf7f4ec], 'x', 0.05);
  const p = top.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, 0.35 * (1 - Math.abs(p.getZ(i) * 2 - 1)) + p.getY(i) * 0.08);
  top.computeVertexNormals();
  const parts = [top.scale(3.2, 1, 2.8).translate(0, 2.75, -1.4)];
  const print = [0xc8102e, 0xf2c94c, 0x1f7a4a, 0xf2c94c];
  for (const [w, x, z, ry] of [[3.2, 0, 1.4, 0], [3.2, 0, -1.4, Math.PI], [2.8, 1.6, 0, Math.PI / 2], [2.8, -1.6, 0, -Math.PI / 2]]) {
    const v = new THREE.PlaneGeometry(w, 0.32, 12, 1).toNonIndexed();
    const pp = v.attributes.position, col = [];
    for (let i = 0; i < pp.count; i++) {
      const u = (pp.getX(i) / w + 0.5) * 12, k = Math.floor(u - 1e-4);
      if (pp.getY(i) < 0) pp.setY(i, -0.16 - 0.08 * Math.abs(Math.sin(u * Math.PI))); // scallops
      const c = new THREE.Color(print[Math.max(0, k) % print.length]); col.push(c.r, c.g, c.b);
    }
    v.deleteAttribute('uv');
    v.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    v.rotateY(ry).translate(x, 2.6, z);
    v.computeVertexNormals();
    parts.push(v);
  }
  return merge(parts);
}

// ------------------------------------------------------------------ sign atlas
function drawArrow(g, kind, x, y, s) {
  g.save(); g.translate(x, y);
  if (kind === '<') g.rotate(-Math.PI / 2); else if (kind === '>') g.rotate(Math.PI / 2);
  g.beginPath();
  g.moveTo(0, -s * 0.5); g.lineTo(s * 0.42, -s * 0.05); g.lineTo(s * 0.14, -s * 0.05); g.lineTo(s * 0.14, s * 0.5);
  g.lineTo(-s * 0.14, s * 0.5); g.lineTo(-s * 0.14, -s * 0.05); g.lineTo(-s * 0.42, -s * 0.05); g.closePath();
  g.fill(); g.restore();
}
function fitText(g, text, x, y, maxW, size, weight, family, align) {
  let s = size;
  g.textAlign = align;
  do { g.font = `${weight} ${s}px ${family}`; s -= 2; } while (s > 12 && g.measureText(text).width > maxW);
  g.fillText(text, x, y);
}

const hash = (x, z, k = 0) => { const s = Math.sin(x * 12.9898 + z * 78.233 + k * 37.719) * 43758.5453; return s - Math.floor(s); };
const AWN_DEFAULT = [0.1, 0, 0.06, 0.03];
const AWN_BAZAAR = [0.08, 0, 0.24, 0.04]; // streets outside the library in tiles packed with shops (Dadar, Kurla, Dharavi…)
const CLOTH = [[0xc8102e, 0xf4f1ea], [0x1f7a4a, 0xf4f1ea], [0x1d4fa3, 0xf4f1ea], [0xf2c200, 0x1f7a4a]];
const PLAIN = [0x7a1a1a, 0x1f6b3a, 0x2a4f9e, 0xd2691e, 0x5a2a6b, 0x2e6e78];
const TARPS = [0x2f62b5, 0x2f62b5, 0x2f62b5, 0x3a70c2, 0x2a57a0, 0xd9772a, 0x2f8a4a, 0xc9ccd0];
const GATES = [0x1d1d1d, 0x1d1d1d, 0x1f4a2b, 0x5d6166, 0x5a1f1f, 0x9a9da2, 0x23365e];
const CHAIRS = [0xf2f1ec, 0xf2f1ec, 0xf2f1ec, 0xc8261e, 0x2a5fb0, 0x2f8a4a];

export class StreetClutter {
  /**
   * @param {object} o scene, renderer, tiles, materials (hoarding atlas + sign fonts), tier, people
   */
  constructor({ scene, renderer, tiles, materials, tier, people }) {
    Object.assign(this, { scene, renderer, tiles, people });
    const low = tier.name === 'Low';
    this.R = { big: low ? 360 : 460, near: low ? 120 : 170, awn: low ? 70 : 110, folk: low ? 45 : 60 };
    this.at = new THREE.Vector3(1e9, 0, 1e9);
    this.version = -1;
    this.timer = 0;
    this.m = new THREE.Matrix4(); this.m2 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.p = new THREE.Vector3(); this.s = new THREE.Vector3(); this.c = new THREE.Color();
    this.up = new THREE.Vector3(0, 1, 0);

    // ---------------------------------------------------------------- solid batch
    const solidGeo = {
      unipole: unipoleGeometry(),
      gantryPost: merge([box(0.7, 0.3, 0.7, 0, 0.15, 0, 0xa8a399), cyl(0.2, 0.16, 7.7, 0, 0, 0, 0x9a9fa5, 10)]),
      gantryBeam: merge([box(1, 0.14, 0.14, 0, 6.65, 0, 0x8e9399), box(1, 0.14, 0.14, 0, 7.45, 0, 0x8e9399), box(1, 0.8, 0.04, 0, 7.05, -0.12, 0x7c8187)]),
      panelBack: box(1, 1, 1, 0, 0, 0, 0x5d6268),
      dirPosts: merge([cyl(0.065, 0.06, 4.7, -1.05, 0, 0, 0x8a8f94, 8), cyl(0.065, 0.06, 4.7, 1.05, 0, 0, 0x8a8f94, 8)]),
      namePosts: merge([cyl(0.035, 0.035, 2.62, -0.72, 0, 0, 0x2b2f33, 6), cyl(0.035, 0.035, 2.62, 0.72, 0, 0, 0x2b2f33, 6), box(1.66, 0.46, 0.018, 0, 2.33, 0, 0xe8e8e8)]),
      cable: cableGeometry(),
      rope: lineGeometry(0.008, 0xd9cfae, 4),
      bamboo: lineGeometry(0.035, 0xc9a86a, 6),
      awningArms: merge([beam([-0.47, -0.78, 0.02], [-0.47, -0.47, 0.97], 0.025, 0x55595d), beam([0.47, -0.78, 0.02], [0.47, -0.47, 0.97], 0.025, 0x55595d)]),
      metalAwning: (() => {
        const parts = [];
        for (let i = 0; i < 12; i++) parts.push(paint(new THREE.BoxGeometry(1 / 12, 0.025, 1).translate(-0.5 + (i + 0.5) / 12, (i % 2) * 0.02, 0.5), 0xa9adb1, 0.15, i + 3));
        const g = merge(parts); g.rotateX(0.32);
        return merge([g, beam([-0.45, -0.5, 0.02], [-0.45, -0.3, 0.9], 0.03, 0x55595d), beam([0.45, -0.5, 0.02], [0.45, -0.3, 0.9], 0.03, 0x55595d)]);
      })(),
      puja: pujaStallGeometry(),
      flowers0: flowersGeometry(0), flowers1: flowersGeometry(1), flowers2: flowersGeometry(2),
      gateLeaf: gateLeafGeometry(),
      chair: chairGeometry(),
      cabin: cabinGeometry(),
    };
    for (let k = 0; k <= 5; k++) solidGeo[`shrine${k}`] = shrineGeometry(k);
    this.solid = this.batch(solidGeo, low ? 1400 : 2200, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.15 }), true);

    // ---------------------------------------------------------------- cloth batch
    const clothGeo = { tarp: sheet(8, 6, [0xffffff], 'x', 0.16), shamiana: shamianaTop(), plain: awningCloth([0xffffff]) };
    CLOTH.forEach((h, i) => { clothGeo[`striped${i}`] = awningCloth(h); });
    this.cloth = this.batch(clothGeo, low ? 600 : 1000, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, side: THREE.DoubleSide }), true);

    // ---------------------------------------------------------------- board faces (text atlas)
    const cols = 4, rows = low ? 8 : 16;
    this.atlas = { cols, rows, canvas: document.createElement('canvas'), cells: new Map(), owner: new Array(cols * rows).fill(null), used: new Int32Array(cols * rows).fill(-1), families: {} };
    this.atlas.canvas.width = cols * CELL_W; this.atlas.canvas.height = rows * CELL_H;
    { const g = this.atlas.canvas.getContext('2d'); g.fillStyle = '#1d3f8f'; g.fillRect(0, 0, cols * CELL_W, rows * CELL_H); }
    this.atlasTex = new THREE.CanvasTexture(this.atlas.canvas);
    this.atlasTex.colorSpace = THREE.SRGBColorSpace;
    this.atlasTex.anisotropy = 4;
    this.scratch = document.createElement('canvas');
    this.scratch.width = CELL_W; this.scratch.height = CELL_H;
    this.scratchTex = new THREE.CanvasTexture(this.scratch);
    this.dst = new THREE.Vector2();
    const boardMat = new THREE.MeshStandardMaterial({ map: this.atlasTex, emissiveMap: this.atlasTex, emissive: 0xffffff, emissiveIntensity: 0.18, roughness: 0.45, metalness: 0.05 });
    boardMat.onBeforeCompile = (sh) => {
      sh.uniforms.uNight = facadeNight;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aRect;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\n vMapUv = aRect.xy + uv * aRect.zw;\n#endif\n#ifdef USE_EMISSIVEMAP\n vEmissiveMapUv = aRect.xy + uv * aRect.zw;\n#endif');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uNight;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance *= uNight; // retro-reflective paint in the headlights');
    };
    boardMat.customProgramCacheKey = () => 'gtb-clutter-board';
    this.boardCap = low ? 260 : 420;
    const plane = new THREE.PlaneGeometry(1, 1);
    this.rect = new THREE.InstancedBufferAttribute(new Float32Array(this.boardCap * 4), 4);
    plane.setAttribute('aRect', this.rect);
    this.boards = new THREE.InstancedMesh(plane, boardMat, this.boardCap);
    this.boards.count = 0; this.boards.frustumCulled = false; this.boards.receiveShadow = true;
    scene.add(this.boards);

    // ---------------------------------------------------------------- unipole ads (hoarding atlas)
    const adTex = materials.hoarding?.map;
    const adMat = new THREE.MeshStandardMaterial({ map: adTex, emissiveMap: adTex, emissive: 0xffffff, emissiveIntensity: 0.7, roughness: 0.7 });
    adMat.onBeforeCompile = (sh) => {
      sh.uniforms.uNight = facadeNight;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\nattribute float aAd;`)
        .replace('#include <uv_vertex>', `#include <uv_vertex>
          vec2 adCell = vec2(mod(aAd, ${HOARDING.COLS}.0), floor(aAd / ${HOARDING.COLS}.0));
          vec2 adUv = vec2((adCell.x + 0.004 + uv.x * 0.992) / ${HOARDING.COLS}.0, 1.0 - (adCell.y + 1.0 - 0.004 - uv.y * 0.992) / ${HOARDING.ROWS}.0);
          #ifdef USE_MAP
            vMapUv = adUv;
          #endif
          #ifdef USE_EMISSIVEMAP
            vEmissiveMapUv = adUv;
          #endif`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uNight;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance *= 0.14 + uNight; // floodlit after dark');
    };
    adMat.customProgramCacheKey = () => 'gtb-clutter-ad';
    this.adCap = 160;
    const adPlane = new THREE.PlaneGeometry(UNI.W - 0.2, UNI.H - 0.2);
    this.adIdx = new THREE.InstancedBufferAttribute(new Float32Array(this.adCap), 1);
    adPlane.setAttribute('aAd', this.adIdx);
    this.ads = new THREE.InstancedMesh(adPlane, adMat, this.adCap);
    this.ads.count = 0; this.ads.frustumCulled = false;
    scene.add(this.ads);

    // Board text uses the sign fonts once they are in (src/main.js loadSignFonts → signs.redraw).
    if (materials.signs) {
      const prev = materials.signs.redraw;
      materials.signs.redraw = (families) => { prev(families); this.setFonts(families); };
    }

    this.folk = new Map();       // key → person (watchmen, flower sellers, puja stall keepers)
    this.folkList = [];
    this.solids = new Float32Array(3 * 1500); // [x, z, r] of things to bump into
    this.nSolid = 0;
    this.grid = new Map();       // cell → list of solid indices
    this.counts = {};
    this.boardsVersion = 0;
  }

  /** A BatchedMesh holding `geos` (name → geometry), with `cap` instances ready (hidden). */
  batch(geos, cap, mat, shadow) {
    let verts = 0;
    for (const g of Object.values(geos)) verts += g.attributes.position.count;
    const b = new THREE.BatchedMesh(cap, verts, 0, mat);
    b.frustumCulled = false; b.sortObjects = false; b.castShadow = shadow; b.receiveShadow = true;
    const ids = {};
    for (const [k, g] of Object.entries(geos)) ids[k] = b.addGeometry(g);
    const first = Object.values(ids)[0];
    for (let i = 0; i < cap; i++) { b.addInstance(first); b.setVisibleAt(i, false); }
    this.scene.add(b);
    return { b, ids, cap, n: 0, shown: 0 };
  }

  setFonts(families) {
    this.atlas.families = families || {};
    // Redraw every cell in use with the real fonts.
    for (let i = 0; i < this.atlas.owner.length; i++) if (this.atlas.owner[i]) this.drawCell(i, this.atlas.owner[i]);
  }

  // ------------------------------------------------------------------ atlas
  /** Draw one label into atlas cell i ("English|मराठी" for a name board; "English|मराठी|^" for a direction line). */
  drawCell(i, label) {
    const g = this.scratch.getContext('2d'), W = CELL_W, H = CELL_H, F = this.atlas.families;
    const q = (f) => (f ? `"${f}", ` : '');
    const deva = `${q(F.deva)}"Noto Sans Devanagari", "Nirmala UI", sans-serif`, latin = `${q(F.latin3)}"Arial Narrow", Arial, sans-serif`;
    const [en, mr, arrow] = label.split('|');
    g.textBaseline = 'middle';
    if (!arrow) {
      // BMC street-name board: dark blue, white border, Marathi over English.
      g.fillStyle = '#1b3a8c'; g.fillRect(0, 0, W, H);
      g.strokeStyle = '#f4f4f0'; g.lineWidth = 5; g.strokeRect(9, 9, W - 18, H - 18);
      g.fillStyle = '#ffffff';
      fitText(g, mr || en, W / 2, 46, W - 50, 46, '700', deva, 'center');
      fitText(g, (en || '').toUpperCase(), W / 2, 94, W - 50, 40, '600', latin, 'center');
    } else {
      // Direction line: arrow on the side it points, Marathi over English.
      g.fillStyle = '#1d4ea8'; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(0, H - 4, W, 4);
      g.fillStyle = '#ffffff';
      const right = arrow === '>', ax = right ? W - 62 : 62, tx = right ? 24 : 124;
      drawArrow(g, arrow, ax, H / 2, 86);
      fitText(g, mr || en, tx, 42, W - 150, 44, '700', deva, 'left');
      fitText(g, en, tx, 92, W - 150, 40, '600', latin, 'left');
    }
    const col = i % this.atlas.cols, row = Math.floor(i / this.atlas.cols);
    try {
      if (!this.atlasReady) { this.renderer.initTexture(this.atlasTex); this.atlasReady = true; }
      this.renderer.copyTextureToTexture(this.scratchTex, this.atlasTex, null, this.dst.set(col * W, (this.atlas.rows - 1 - row) * H));
    } catch {
      // No partial upload: draw into the big canvas and upload it whole.
      this.atlas.canvas.getContext('2d').drawImage(this.scratch, col * W, row * H);
      this.atlasTex.needsUpdate = true;
    }
  }

  /** Atlas cell for a label (drawn on first use; least recently used cells are recycled). */
  cell(label, stamp, budget) {
    const A = this.atlas;
    let i = A.cells.get(label);
    if (i !== undefined) { A.used[i] = stamp; return i; }
    if (budget.n <= 0) return -1;
    let best = -1, bestUse = Infinity;
    for (let k = 0; k < A.owner.length; k++) {
      if (!A.owner[k]) { best = k; break; }
      if (A.used[k] < bestUse && A.used[k] !== stamp) { bestUse = A.used[k]; best = k; }
    }
    if (best < 0) return -1;
    if (A.owner[best]) A.cells.delete(A.owner[best]);
    A.owner[best] = label; A.cells.set(label, best); A.used[best] = stamp;
    budget.n--;
    this.drawCell(best, label);
    return best;
  }

  // ------------------------------------------------------------------ per frame
  update(dt, focus, night = 0) {
    this.timer -= dt;
    const changed = this.version !== this.tiles.version;
    if (!changed && (this.timer > 0 || this.at.distanceToSquared(focus.pos) < 144)) return;
    this.timer = 0.5;
    this.at.copy(focus.pos);
    this.version = this.tiles.version;
    this.rebuild(focus.pos.x, focus.pos.z, night);
  }

  /** People who belong to the clutter (called between people.begin() and people.end()). */
  drawPeople(hour) {
    const day = hour >= 6.5 && hour < 21.5;
    for (let i = 0; i < this.folkList.length; i++) {
      const p = this.folkList[i];
      if (!p.allDay && !day) continue;
      this.people.add(p);
    }
  }

  // ------------------------------------------------------------------ building the instances
  put(B, geo, x, y, z, yaw, sx = 1, sy = 1, sz = 1, tint = null) {
    if (B.n >= B.cap) return;
    this.q.setFromAxisAngle(this.up, yaw);
    this.m.compose(this.p.set(x, y, z), this.q, this.s.set(sx, sy, sz));
    this.putMatrix(B, geo, this.m, tint);
  }
  putMatrix(B, geo, m, tint = null) {
    if (B.n >= B.cap) return;
    const i = B.n++;
    B.b.setGeometryIdAt(i, B.ids[geo]);
    B.b.setMatrixAt(i, m);
    B.b.setColorAt(i, tint ? this.c.setHex(tint) : this.c.setRGB(1, 1, 1));
    B.b.setVisibleAt(i, true);
  }
  /** A unit line geometry (cable, rope, pole) from a to b: z along the span, y = sag, x = side. */
  putSpan(B, geo, ax, ay, az, bx, by, bz, sag, side = 1) {
    const dx = bx - ax, dy = by - ay, dz = bz - az, l = Math.hypot(dx, dz) || 1;
    this.m.set(-dz / l * side, 0, dx, ax, 0, sag || 1, dy, ay, dx / l * side, 0, dz, az, 0, 0, 0, 1);
    this.putMatrix(B, geo, this.m);
  }
  /** A board face: a unit plane scaled to w × h, rotated to face yaw, showing atlas cell i. */
  putBoard(x, y, z, yaw, w, h, i) {
    if (this.nb >= this.boardCap || i < 0) return;
    const A = this.atlas, col = i % A.cols, row = Math.floor(i / A.cols);
    const iu = 2 / (A.cols * CELL_W), iv = 2 / (A.rows * CELL_H);
    this.rect.setXYZW(this.nb, col / A.cols + iu, (A.rows - 1 - row) / A.rows + iv, 1 / A.cols - 2 * iu, 1 / A.rows - 2 * iv);
    this.q.setFromAxisAngle(this.up, yaw);
    this.m.compose(this.p.set(x, y, z), this.q, this.s.set(w, h, 1));
    this.boards.setMatrixAt(this.nb++, this.m);
  }
  addSolid(x, z, r) {
    if (this.nSolid * 3 >= this.solids.length) return;
    const k = this.nSolid++ * 3;
    this.solids[k] = x; this.solids[k + 1] = z; this.solids[k + 2] = r;
  }
  person(key, make) {
    let p = this.folk.get(key);
    if (!p) { p = make(); p.key = key; this.folk.set(key, p); }
    p.seen = this.stamp;
    this.folkList.push(p);
    return p;
  }

  rebuild(px, pz, night) {
    this.stamp = (this.stamp || 0) + 1;
    const stamp = this.stamp, T = this.tiles;
    for (const B of [this.solid, this.cloth]) B.n = 0;
    this.nb = 0; this.na = 0; this.nSolid = 0; this.folkList.length = 0;
    const counts = this.counts;
    for (const k in counts) counts[k] = 0;
    const budget = { n: 14 }; // new atlas cells drawn per refresh (no hitch while driving)
    const Rb = this.R.big, Rn = this.R.near;
    const labelled = []; // boards wait until every label near the player has a cell (nearest first)
    for (const t of T.tiles.values()) {
      const [x0, z0, x1, z1] = t.clip;
      const gap = Math.max(x0 - px, 0, px - x1, z0 - pz, 0, pz - z1);
      if (gap > Rb) continue;
      const ox = t.origin[0], oz = t.origin[1], P = t.points;
      for (const kind of KINDS) {
        const arr = P[kind];
        if (!arr) continue;
        const R = kind === POINT.UNIPOLE || kind === POINT.DIR_GANTRY ? Rb : kind === POINT.CABLES || kind === POINT.TARP ? Rn * 0.85 : Rn;
        if (gap > R) continue;
        const labels = t.labels?.[kind];
        for (let i = 0, j = 0; i < arr.length; i += 5, j++) {
          const x = arr[i] + ox, z = arr[i + 2] + oz, d2 = (x - px) ** 2 + (z - pz) ** 2;
          if (d2 > R * R) continue;
          if (labels) labelled.push({ kind, x, z, a: arr[i + 3], s: arr[i + 4], label: labels[j], d2 });
          else this.add(kind, x, z, arr[i + 3], arr[i + 4], d2);
          counts[kind] = (counts[kind] || 0) + 1;
        }
      }
      // Awnings and tarps over shopfronts, from the worker's shutter boxes (one per shop bay).
      const sb = t.facadeParts?.shutterBox;
      if (sb && gap < this.R.awn) this.awnings(sb, ox, oz, px, pz);
    }
    labelled.sort((a, b) => a.d2 - b.d2);
    for (const L of labelled) this.addBoard(L, stamp, budget);
    this.finish(this.solid); this.finish(this.cloth);
    this.boards.count = this.nb; this.boards.instanceMatrix.needsUpdate = true; this.rect.needsUpdate = true;
    this.ads.count = this.na; this.ads.instanceMatrix.needsUpdate = true; this.adIdx.needsUpdate = true;
    // People who are no longer near go.
    for (const [k, p] of this.folk) if (p.seen !== stamp) this.folk.delete(k);
    this.indexSolids();
    if (budget.n <= 0) this.timer = 0.15; // more labels waiting: come back soon
  }

  finish(B) {
    for (let i = B.n; i < B.shown; i++) B.b.setVisibleAt(i, false);
    B.shown = B.n;
  }

  /** One clutter point. */
  add(kind, x, z, a, s, d2) {
    const S = this.solid, C = this.cloth, ca = Math.cos(a), sa = Math.sin(a), y = Y.KERB;
    // Local (lx along the face, lz towards the street) → world.
    const wx = (lx, lz) => x + lx * ca + lz * sa, wz = (lx, lz) => z - lx * sa + lz * ca;
    switch (kind) {
      case POINT.UNIPOLE: {
        const sc = s;
        this.put(S, 'unipole', x, y, z, a, sc, sc, sc);
        this.addSolid(x, z, 0.5 * sc);
        for (let k = 0; k < UNI_BOARDS.length; k++) {
          const b = UNI_BOARDS[k];
          if (this.na >= this.adCap) break;
          const lx = b.cx + b.nx * 0.03, lz = b.cz + b.nz * 0.03;
          this.q.setFromAxisAngle(this.up, a + b.yaw);
          this.m.compose(this.p.set(wx(lx * sc, lz * sc), y + (UNI.Y0 + UNI.H / 2) * sc, wz(lx * sc, lz * sc)), this.q, this.s.set(sc, sc, sc));
          this.ads.setMatrixAt(this.na, this.m);
          this.adIdx.array[this.na++] = Math.floor(hash(x, z, k + 5) * HOARDING.ADS);
        }
        break;
      }
      case POINT.CABLES: {
        // A bundle of 2–5 cables between two walls (or a lamp post), each its own sag.
        const span = s * 12, n = 2 + Math.floor(hash(x, z, 1) * 4), hA = 4.8 + hash(x, z, 2) * 2, hB = 4.8 + hash(z, x, 3) * 2;
        const ax = x - sa * span / 2, az = z - ca * span / 2, bx = x + sa * span / 2, bz = z + ca * span / 2;
        for (let k = 0; k < n; k++) {
          const o = (k - (n - 1) / 2) * 0.09, sag = 0.35 + span * 0.025 + hash(x + k, z, 4) * 0.5;
          this.putSpan(S, 'cable', ax + ca * o, hA + k * 0.05, az - sa * o, bx + ca * o, hB - k * 0.04, bz - sa * o, sag);
        }
        break;
      }
      case POINT.TARP: {
        const span = s * 10, depth = 3 + hash(x, z, 6) * 2.5, h = 4.3 + hash(x, z, 7) * 0.8, sag = 0.35 + hash(z, x, 8) * 0.4;
        // Sheet z ∈ [0, 1] runs across the lane (A → B), x along the street (depth).
        this.m.set(ca * depth, 0, sa * span, x - sa * span / 2, 0, sag, 0, h, -sa * depth, 0, ca * span, z - ca * span / 2, 0, 0, 0, 1);
        this.putMatrix(C, 'tarp', this.m, TARPS[Math.floor(hash(x, z, 9) * TARPS.length)]);
        // Ropes from the corners to the walls a little higher up.
        for (const e of [0, 1]) for (const sd of [-1, 1]) {
          const cx = x + (e ? 1 : -1) * sa * span / 2 + sd * ca * depth / 2, cz = z + (e ? 1 : -1) * ca * span / 2 - sd * sa * depth / 2;
          this.putSpan(S, 'rope', cx, h, cz, cx + (e ? 1 : -1) * sa * 0.3 + sd * ca * 0.4, h + 0.9, cz + (e ? 1 : -1) * ca * 0.3 - sd * sa * 0.4, 1);
        }
        break;
      }
      case POINT.STALL_TARP: this.tarpCanopy(x, z, a, s, wx, wz); break;
      case POINT.SHAMIANA: {
        this.put(S, 'puja', x, y, z, a);
        this.put(C, 'shamiana', x, y, z, a);
        this.addSolid(x, z, 0.9);
        if (d2 < this.R.folk ** 2) {
          const p = this.person(`sh${Math.round(x * 10)},${Math.round(z * 10)}`, () => this.local(wx(0.2, -0.75), wz(0.2, -0.75), a, POSE.STAND, x, z, 'vendor'));
          p.phase += 0.5;
        }
        break;
      }
      case POINT.FLOWERS: {
        this.put(S, `flowers${Math.floor(hash(x, z, 11) * 3)}`, x, y, z, a);
        this.addSolid(x, z, 0.75);
        if (d2 < this.R.folk ** 2) this.person(`fl${Math.round(x * 10)},${Math.round(z * 10)}`, () => this.local(wx(0, -0.3), wz(0, -0.3), a, POSE.SIT, x, z, 'flowers'));
        break;
      }
      case POINT.SHRINE: {
        const k = Math.max(0, Math.min(5, Math.round((s - 0.5) / 0.25)));
        this.put(S, `shrine${k}`, x, y, z, a);
        this.addSolid(x, z, 0.7);
        break;
      }
      case POINT.GATE: this.gate(x, z, a, d2, wx, wz); break;
      default: break;
    }
  }

  /** Bamboo poles and a blue tarpaulin sloping over a hawker's stall, tied down with ropes. */
  tarpCanopy(x, z, a, s, wx, wz) {
    const S = this.solid, C = this.cloth, y = Y.KERB, w = 2.6 * s, back = -1.35, front = 1.15, hb = 3.15, hf = 2.62;
    const depth = front - back, ca = Math.cos(a), sa = Math.sin(a);
    // Sheet: x across (w), z from the back edge to the front edge, dropping hb → hf.
    this.m.set(ca * w, 0, sa * depth, wx(0, back), 0, 0.14, hf - hb, y + hb, -sa * w, 0, ca * depth, wz(0, back), 0, 0, 0, 1);
    this.putMatrix(C, 'tarp', this.m, TARPS[Math.floor(hash(x, z, 13) * TARPS.length)]);
    for (const lx of [-w / 2, w / 2]) {
      for (const [lz, h] of [[back, hb], [front, hf]]) this.putSpan(S, 'bamboo', wx(lx, lz), y, wz(lx, lz), wx(lx, lz), y + h + 0.05, wz(lx, lz) + 1e-4, 1);
      // Guy ropes from the front poles to pegs in front.
      this.putSpan(S, 'rope', wx(lx, front), y + hf, wz(lx, front), wx(lx * 1.15, front + 0.7), y + 0.02, wz(lx * 1.15, front + 0.7), 1);
    }
  }

  gate(x, z, a, d2, wx, wz) {
    const S = this.solid, y = Y.KERB, tint = GATES[Math.floor(hash(x, z, 21) * GATES.length)];
    // Both leaves swung open into the compound (local -z), hinged at the gate posts.
    for (const [hx, yaw] of [[-2.1, 1.35], [2.1, Math.PI - 1.35]]) this.put(S, 'gateLeaf', wx(hx, -0.12), y, wz(hx, -0.12), a + yaw, 1, 1, 1, tint);
    // The watchman's plastic chair just inside the gate, facing the street.
    const cx = wx(1.35, -0.85), cz = wz(1.35, -0.85);
    this.put(S, 'chair', cx, y, cz, a + (hash(x, z, 22) - 0.5) * 0.5, 1, 1, 1, CHAIRS[Math.floor(hash(z, x, 23) * CHAIRS.length)]);
    if (hash(x, z, 24) < 0.3) { this.put(S, 'cabin', wx(-3.45, -1.25), y, wz(-3.45, -1.25), a); this.addSolid(wx(-3.45, -1.25), wz(-3.45, -1.25), 0.8); }
    if (d2 < this.R.folk ** 2 && hash(x, z, 25) < 0.85) {
      const p = this.person(`gt${Math.round(x * 10)},${Math.round(z * 10)}`, () => this.local(cx, cz, a, POSE.SIT, x, z, 'watchman'));
      p.allDay = true;
    }
  }

  /** A person who belongs to a place: kind 'watchman' | 'flowers' | 'vendor'. */
  local(x, z, heading, pose, sx, sz, kind) {
    const h = (k) => hash(sx, sz, k + 40), skin = SKIN[Math.floor(h(1) * SKIN.length)].clone();
    const C = (hex) => new THREE.Color(hex);
    let shirt, pants, flags = 0, y = Y.KERB;
    if (kind === 'watchman') {
      // Security guards: light blue, grey or khaki shirts, navy trousers, a cap.
      shirt = C([0x9db7d6, 0xa9aeb5, 0xb8a27a, 0x9db7d6][Math.floor(h(2) * 4)]); pants = C([0x1f2a44, 0x2b2f36][Math.floor(h(3) * 2)]);
      flags = h(4) < 0.7 ? FLAG.CAP : 0;
    } else if (kind === 'flowers') {
      const woman = h(2) < 0.6;
      shirt = C(woman ? [0xc0392b, 0x8e44ad, 0x16a085, 0xd35400, 0x1f618d][Math.floor(h(3) * 5)] : [0xf2f2f0, 0xe8e2d0, 0x95a5a6][Math.floor(h(3) * 3)]);
      pants = C(woman ? [0xe74c3c, 0xf39c12, 0x9b59b6, 0x2980b9][Math.floor(h(4) * 4)] : [0xe9e5da, 0x4d4d4d][Math.floor(h(4) * 2)]);
      flags = woman ? FLAG.SARI : 0;
      y = Y.KERB - 0.12; // on a low stool (patla)
    } else {
      shirt = C([0xf2f2f0, 0xe8a33a, 0xc0392b, 0xefe3c6][Math.floor(h(2) * 4)]); pants = C([0xf4f1ea, 0x3b3f47, 0x5d4e3c][Math.floor(h(3) * 3)]);
    }
    return { x, y, z, heading, pose, phase: h(5) * 6, amp: pose === POSE.SIT ? 1 : 0.6, flags, scale: 0.95 + h(6) * 0.08, shirt, pants, skin, h: 2.1, allDay: false, seen: 0, key: '' };
  }

  /** A direction board, gantry or street-name board (their text needs atlas cells). */
  addBoard({ kind, x, z, a, s, label, d2 }, stamp, budget) {
    const S = this.solid, y = Y.KERB, ca = Math.cos(a), sa = Math.sin(a);
    const wx = (lx, lz) => x + lx * ca + lz * sa, wz = (lx, lz) => z - lx * sa + lz * ca;
    if (!label) return;
    if (kind === POINT.NAME_BOARD) {
      const i = this.cell(label, stamp, budget);
      this.put(S, 'namePosts', x, y, z, a);
      this.addSolid(x, z, 0.12);
      if (i < 0) return;
      this.putBoard(wx(0, 0.011), y + 2.33, wz(0, 0.011), a, 1.6, 0.4, i);
      this.putBoard(wx(0, -0.011), y + 2.33, wz(0, -0.011), a + Math.PI, 1.6, 0.4, i);
      return;
    }
    const lines = label.split(';').slice(0, 3);
    const cells = lines.map((l) => this.cell(l, stamp, budget));
    if (kind === POINT.DIR_BOARD) {
      const lh = 0.62, top = 4.55, n = lines.length;
      this.put(S, 'dirPosts', x, y, z, a);
      this.addSolid(wx(-1.05, 0), wz(-1.05, 0), 0.1); this.addSolid(wx(1.05, 0), wz(1.05, 0), 0.1);
      this.put(S, 'panelBack', wx(0, -0.05), y + top - (n * lh) / 2, wz(0, -0.05), a, 2.6, n * lh + 0.08, 0.06);
      cells.forEach((i, k) => this.putBoard(wx(0, 0), y + top - (k + 0.5) * lh, wz(0, 0), a, 2.5, lh - 0.02, i));
      return;
    }
    // Gantry: posts at both edges of the span, a truss across, one panel per destination.
    const span = s * 16, half = span / 2 + 0.6, n = lines.length;
    for (const sd of [-1, 1]) { this.put(S, 'gantryPost', wx(sd * half, 0), y, wz(sd * half, 0), a); this.addSolid(wx(sd * half, 0), wz(sd * half, 0), 0.25); }
    this.put(S, 'gantryBeam', x, y, z, a, span + 1.4, 1, 1);
    const pw = Math.min(3.6, span / n - 0.3), ph = pw * 0.29;
    cells.forEach((i, k) => {
      const lx = (k - (n - 1) / 2) * (span / n);
      this.put(S, 'panelBack', wx(lx, 0.12), y + 6.2, wz(lx, 0.12), a, pw + 0.1, ph + 0.1, 0.06);
      this.putBoard(wx(lx, 0.16), y + 6.2, wz(lx, 0.16), a, pw, ph, i);
    });
  }

  /** Cloth awnings, blue tarpaulins and metal awnings over some shopfronts. */
  awnings(sb, ox, oz, px, pz) {
    const S = this.solid, C = this.cloth, R2 = this.R.awn ** 2, T = this.tiles;
    const dense = sb.length / 7 > 260; // shop bays in this 500 m tile
    for (let i = 0; i < sb.length; i += 7) {
      const x = sb[i] + ox, z = sb[i + 2] + oz;
      if ((x - px) ** 2 + (z - pz) ** 2 > R2) continue;
      const r = hash(x, z, 31);
      if (r > 0.75) continue; // most shops have nothing; the shares below are of the rest
      // The street this shop opens onto: its profile says what shades the shopfronts.
      const nxw = Math.sin(sb[i + 3]), nzw = Math.cos(sb[i + 3]);
      const prof = T.roadHit(x + nxw * 4, z + nzw * 4, 6, true) ? profileOf(T.segment(T.roadTile, T.roadIndex)) : null;
      const sh = prof?.awn || (dense ? AWN_BAZAAR : AWN_DEFAULT);
      const u = r / 0.75;
      const yaw = sb[i + 3], w = sb[i + 4], top = sb[i + 1] + 0.16, ca = Math.cos(yaw), sa = Math.sin(yaw);
      let acc = sh[0];
      if (u < acc) { // plain cloth awning
        const d = 0.9 + hash(z, x, 32) * 0.4;
        this.put(C, 'plain', x, top, z, yaw, w, 1, d, PLAIN[Math.floor(hash(x, z, 33) * PLAIN.length)]);
        this.put(S, 'awningArms', x, top, z, yaw, w, 1, d);
        continue;
      }
      if (u < (acc += sh[1])) { // striped café awning
        const d = 1.0 + hash(z, x, 34) * 0.4;
        this.put(C, `striped${Math.floor(hash(x, z, 35) * CLOTH.length)}`, x, top, z, yaw, w, 1, d);
        this.put(S, 'awningArms', x, top, z, yaw, w, 1, d);
        continue;
      }
      if (u < (acc += sh[2])) { // blue tarpaulin on bamboo poles, sagging
        const d = 1.7 + hash(z, x, 36) * 0.7, drop = 0.6 + hash(x, z, 37) * 0.35, ww = w * 1.05, gy = Y.KERB;
        this.m.set(ca * ww, 0, sa * d, x, 0, 0.18 + hash(x, z, 38) * 0.15, -drop, top - 0.05, -sa * ww, 0, ca * d, z, 0, 0, 0, 1);
        this.putMatrix(C, 'tarp', this.m, TARPS[Math.floor(hash(x, z, 39) * TARPS.length)]);
        for (const sd of [-0.5, 0.5]) {
          const fx = x + ca * ww * sd + sa * d, fz = z - sa * ww * sd + ca * d;
          this.putSpan(S, 'bamboo', fx, gy, fz, fx, top - drop, fz + 1e-4, 1);
          this.putSpan(S, 'rope', fx, top - drop - 0.05, fz, fx + sa * 0.5, gy + 0.02, fz + ca * 0.5, 1);
        }
        continue;
      }
      if (u < (acc += sh[3])) { // corrugated metal awning on brackets
        this.put(S, 'metalAwning', x, top + 0.05, z, yaw, w, 1, 1.2);
      }
    }
  }

  // ------------------------------------------------------------------ collisions
  indexSolids() {
    this.grid.clear();
    for (let i = 0; i < this.nSolid; i++) {
      const k = this.cellKey(this.solids[i * 3], this.solids[i * 3 + 1]);
      let l = this.grid.get(k);
      if (!l) this.grid.set(k, (l = []));
      l.push(i);
    }
  }
  cellKey(x, z) { return (Math.floor(x / 8) + 32768) * 65536 + (Math.floor(z / 8) + 32768); }
  /** Is a circle at (x, z) touching a pole, shrine, stall or cabin? (No allocation.) */
  hits(x, z, r) {
    if (!this.nSolid) return false;
    const cx = Math.floor(x / 8), cz = Math.floor(z / 8), S = this.solids;
    for (let i = cx - 1; i <= cx + 1; i++) for (let j = cz - 1; j <= cz + 1; j++) {
      const l = this.grid.get((i + 32768) * 65536 + (j + 32768));
      if (!l) continue;
      for (let k = 0; k < l.length; k++) {
        const o = l[k] * 3, dx = x - S[o], dz = z - S[o + 1], rr = r + S[o + 2];
        if (dx * dx + dz * dz < rr * rr) return true;
      }
    }
    return false;
  }
}

const KINDS = [POINT.UNIPOLE, POINT.CABLES, POINT.NAME_BOARD, POINT.DIR_BOARD, POINT.DIR_GANTRY, POINT.TARP, POINT.STALL_TARP, POINT.SHAMIANA, POINT.SHRINE, POINT.FLOWERS, POINT.GATE];
