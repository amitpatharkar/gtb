import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Traffic vehicles, procedural and instanced. Each type is split into four parts so one
// instanced mesh per part can use a fitting material: paint (tinted per vehicle, clear
// coat), glass (dark, reflective), trim (tyres, bumpers, grilles, chrome; vertex colours)
// and lamps (head/tail lights that glow at night). Bodies are side profiles extruded
// across the width with rounded edges, like the player's taxi.
// Shapes are generic Indian-road archetypes (no real makes or badges).

function shape(points) {
  const s = new THREE.Shape();
  points.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  return s;
}
/** Side profile (x = along the car, y = up) extruded across `width`, centred, facing +z. */
function extrude(points, width, bevel = 0.05) {
  const g = new THREE.ExtrudeGeometry(shape(points), { depth: Math.max(0.01, width - bevel * 2), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 4 });
  g.translate(0, 0, -(width - bevel * 2) / 2);
  g.rotateY(-Math.PI / 2);
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g.index ? g.toNonIndexed() : g;
}
function paint(g, hex) {
  g = g.index ? g.toNonIndexed() : g;
  if (g.attributes.uv) g.deleteAttribute('uv');
  const c = new THREE.Color(hex), a = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const strip = (g) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); return g; };
const merge = (list) => mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g)));

function wheels(xs, zs, r, w = 0.2) {
  const out = [];
  for (const x of xs) for (const z of zs) {
    out.push(paint(new THREE.CylinderGeometry(r, r, w, 14).rotateZ(Math.PI / 2).translate(x, r, z), 0x111111));
    out.push(paint(new THREE.CylinderGeometry(r * 0.55, r * 0.55, w + 0.02, 10).rotateZ(Math.PI / 2).translate(x, r, z), 0x9a9da2));
  }
  return out;
}
/** Arch-cut lower body profile for cars: length L, sill y0, waist y1, bonnet/boot heights. */
function carBody(L, wb, r, waist, nose = 0.72, tail = 0.8) {
  const h = L / 2, pts = [];
  const arch = (cx) => { for (let a = 0; a <= Math.PI + 1e-6; a += Math.PI / 8) pts.push([cx + Math.cos(a) * (r + 0.05), 0.12 + Math.sin(a) * (r + 0.05) + r * 0.6]); };
  pts.push([-h, 0.32], [-h - 0.02, tail * 0.9], [-h + 0.12, tail], [-h * 0.55, waist], [h * 0.45, waist], [h - 0.25, nose], [h, nose - 0.1], [h + 0.02, 0.4], [h - 0.1, 0.28]);
  arch(wb / 2);
  pts.push([0.4, 0.28], [-0.4, 0.28]);
  arch(-wb / 2);
  pts.push([-h + 0.1, 0.28]);
  return pts;
}

function lamps(L, w, y, front = 0xfff4d6, back = 0xc81010, size = 0.16) {
  return [
    paint(box(size * 1.4, size * 0.8, 0.04, -w / 2 + 0.2, y, L / 2 + 0.01), front), paint(box(size * 1.4, size * 0.8, 0.04, w / 2 - 0.2, y, L / 2 + 0.01), front),
    paint(box(size * 1.2, size, 0.04, -w / 2 + 0.18, y + 0.04, -L / 2 - 0.01), back), paint(box(size * 1.2, size, 0.04, w / 2 - 0.18, y + 0.04, -L / 2 - 0.01), back),
  ];
}

function car({ L, W, wb, r, waist, roof, cabin, nose, tail, boxy = false }) {
  const paintParts = [extrude(carBody(L, wb, r, waist, nose, tail), W, 0.06)];
  // Roof and pillars (paint) over a glass house.
  const [c0, c1, c2, c3] = cabin; // rear base, rear top, front top, front base (x along the car)
  const glassProfile = [[c0, waist - 0.02], [c1, roof - 0.04], [c2, roof - 0.04], [c3, waist - 0.02]];
  const roofProfile = boxy ? [[c1 - 0.06, roof - 0.07], [c1 - 0.06, roof], [c2 + 0.02, roof], [c2 + 0.05, roof - 0.07]] : [[c1 - 0.02, roof - 0.06], [c1, roof], [c2, roof], [c2 + 0.04, roof - 0.06]];
  paintParts.push(extrude(roofProfile, W - 0.12, 0.04));
  for (const [x0, x1] of [[c0, c1], [(c0 + c3) / 2 - 0.05, (c1 + c2) / 2 - 0.05], [c3, c2]]) {
    for (const s of [-1, 1]) {
      const p = extrude([[x0 - 0.05, waist - 0.02], [x1 - 0.04, roof - 0.05], [x1 + 0.05, roof - 0.05], [x0 + 0.06, waist - 0.02]], 0.06, 0.01);
      p.translate(s * (W / 2 - 0.1), 0, 0);
      paintParts.push(p);
    }
  }
  const glass = [extrude(glassProfile, W - 0.16, 0.03)];
  const trim = [
    paint(box(W + 0.03, 0.16, 0.14, 0, 0.36, L / 2 - 0.02), 0x2a2a2c), paint(box(W + 0.03, 0.16, 0.14, 0, 0.38, -L / 2 + 0.02), 0x2a2a2c),
    paint(box(W * 0.5, 0.14, 0.03, 0, nose - 0.18, L / 2 + 0.005), 0x161616), // grille
    paint(box(0.42, 0.11, 0.02, 0, 0.42, L / 2 + 0.08), 0xf2f2f2), paint(box(0.42, 0.11, 0.02, 0, 0.48, -L / 2 - 0.08), 0xf2f2f2), // plates
    paint(box(0.06, 0.08, 0.14, -W / 2 - 0.04, waist + 0.08, cabin[3] - 0.1), 0x1a1a1a), paint(box(0.06, 0.08, 0.14, W / 2 + 0.04, waist + 0.08, cabin[3] - 0.1), 0x1a1a1a), // mirrors
    ...wheels([-W / 2 + 0.16, W / 2 - 0.16], [-wb / 2, wb / 2], r),
    paint(box(W - 0.2, 0.4, L * 0.45, 0, waist - 0.05, (c0 + c3) / 2), 0x1b1b1d), // dark interior
  ];
  return { paint: merge(paintParts.map(strip)), glass: merge(glass.map(strip)), trim: merge(trim), lamps: merge(lamps(L, W, nose - 0.12)) };
}

function taxi() {
  const L = 3.73, W = 1.47, wb = 2.34, r = 0.28;
  const t = car({ L, W, wb, r, waist: 0.84, roof: 1.43, cabin: [-1.3, -1.0, 0.5, 0.95], nose: 0.66, tail: 0.66 });
  // Kaali-peeli: the paint part is the black body; the roof goes to trim in yellow.
  const roof = paint(extrude([[-1.02, 1.3], [-0.99, 1.44], [0.52, 1.45], [0.55, 1.31]], 1.36, 0.04), 0xf7c600);
  const rack = [paint(box(0.03, 0.03, 1.2, -0.5, 1.52, -0.25), 0xcfcfcf), paint(box(0.03, 0.03, 1.2, 0.5, 1.52, -0.25), 0xcfcfcf), paint(box(1.03, 0.025, 0.03, 0, 1.52, -0.8), 0xcfcfcf), paint(box(1.03, 0.025, 0.03, 0, 1.52, 0.3), 0xcfcfcf)];
  t.trim = merge([t.trim, roof, ...rack]);
  return t;
}

function bus() {
  // BEST single-decker: red body, cream band, windows all along, route board.
  const L = 11.5, W = 2.55, H = 3.15;
  const paintParts = [box(W, 1.15, L, 0, 0.95, 0), box(W, 0.28, L, 0, H - 0.14, 0), box(W - 0.06, 0.06, L - 0.1, 0, H + 0.02, 0)];
  for (let z = -L / 2 + 0.5; z <= L / 2 - 0.4; z += 1.3) paintParts.push(box(W + 0.01, 1.1, 0.12, 0, 2.05, z)); // window pillars
  const glass = [box(W - 0.02, 1.08, L - 0.6, 0, 2.06, 0), box(W - 0.3, 1.3, 0.05, 0, 2.0, L / 2 + 0.01)];
  const trim = [
    paint(box(W + 0.02, 0.16, L + 0.02, 0, 1.56, 0), 0xe9dfc4), // cream band
    paint(box(W + 0.02, 0.3, 0.12, 0, 0.45, L / 2), 0x2a2a2c), paint(box(W + 0.02, 0.3, 0.12, 0, 0.45, -L / 2), 0x2a2a2c),
    paint(box(1.6, 0.26, 0.04, 0, H - 0.3, L / 2 + 0.03), 0x111111), // route board
    paint(box(0.9, 2.1, 0.04, W / 2 + 0.005, 1.35, L / 2 - 1.6), 0x3a1410), paint(box(0.9, 2.1, 0.04, W / 2 + 0.005, 1.35, -0.5), 0x3a1410), // doors (left side, we keep left)
    ...wheels([-W / 2 + 0.28, W / 2 - 0.28], [-L / 2 + 2.6, L / 2 - 2.4], 0.5, 0.32),
  ];
  const lampList = [paint(box(1.1, 0.16, 0.03, 0, H - 0.3, L / 2 + 0.06), 0xffa020), ...lamps(L, W, 0.75, 0xfff4d6, 0xc81010, 0.2)];
  return { paint: merge(paintParts.map(strip)), glass: merge(glass.map(strip)), trim: merge(trim), lamps: merge(lampList) };
}

function tempo() {
  // Small goods carrier: cab, flatbed with a tarpaulin-covered load.
  const paintParts = [extrude([[1.0, 0.55], [1.0, 1.95], [1.55, 2.0], [2.55, 1.8], [2.62, 1.0], [2.6, 0.55]], 1.9, 0.06)];
  const glass = [extrude([[1.6, 1.25], [1.62, 1.9], [2.45, 1.75], [2.55, 1.25]], 1.86, 0.02)];
  const trim = [
    paint(box(2.0, 0.22, 5.1, 0, 0.6, 0.15), 0x2a2a2a), paint(box(2.0, 1.4, 3.3, 0, 1.45, -0.75), 0x3b5e8c), paint(box(2.04, 0.1, 3.34, 0, 2.16, -0.75), 0x2e4a6e),
    paint(box(1.9, 0.18, 0.1, 0, 0.62, 2.65), 0x222222),
    ...wheels([-0.82, 0.82], [-1.55, 1.95], 0.38, 0.24),
  ];
  return { paint: merge(paintParts.map(strip)), glass: merge(glass.map(strip)), trim: merge(trim), lamps: merge(lamps(5.3, 1.9, 0.95)) };
}

function bike() {
  // Motorcycle or scooter; the rider is drawn separately (sitting person).
  const paintParts = [box(0.26, 0.28, 0.75, 0, 0.66, 0.08), box(0.22, 0.12, 0.5, 0, 0.82, -0.3), box(0.2, 0.3, 0.22, 0, 0.8, 0.62)];
  const trim = [
    paint(new THREE.CylinderGeometry(0.3, 0.3, 0.09, 14).rotateZ(Math.PI / 2).translate(0, 0.3, 0.68), 0x111111),
    paint(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 14).rotateZ(Math.PI / 2).translate(0, 0.3, -0.62), 0x111111),
    paint(box(0.04, 0.6, 0.04, 0, 0.62, 0.66), 0x888888), paint(box(0.62, 0.04, 0.04, 0, 1.02, 0.55), 0x333333),
    paint(box(0.24, 0.06, 0.55, 0, 0.92, -0.18), 0x1a1a1a), // seat
  ];
  const glass = [box(0.18, 0.12, 0.02, 0, 1.06, 0.66)];
  const lampList = [paint(box(0.13, 0.1, 0.03, 0, 0.92, 0.75), 0xfff4d6), paint(box(0.14, 0.06, 0.03, 0, 0.8, -0.56), 0xc81010)];
  return { paint: merge(paintParts.map(strip)), glass: merge(glass.map(strip)), trim: merge(trim), lamps: merge(lampList) };
}

/** type → { parts, len, wid, speed, weight, tints, rider } */
export function buildFleet() {
  const COMMON = [0xf4f4f2, 0xf4f4f2, 0xf4f4f2, 0xc5c8cc, 0xc5c8cc, 0x8a8f95, 0x9b1b1b, 0x1d3f7a, 0x1b1b1b, 0x6b4a32, 0xd9d4c7];
  return {
    taxi: { parts: taxi(), len: 3.7, wid: 1.5, speed: 11, weight: 4, tints: [0x060606] },
    hatch: { parts: car({ L: 3.85, W: 1.7, wb: 2.43, r: 0.3, waist: 0.92, roof: 1.5, cabin: [-1.55, -1.3, 0.55, 1.0], nose: 0.82, tail: 0.95 }), len: 3.85, wid: 1.7, speed: 12, weight: 5, tints: [...COMMON, 0xb32020, 0xf2b705] },
    sedan: { parts: car({ L: 4.4, W: 1.72, wb: 2.6, r: 0.31, waist: 0.9, roof: 1.47, cabin: [-1.2, -0.85, 0.75, 1.2], nose: 0.8, tail: 0.88 }), len: 4.4, wid: 1.72, speed: 13, weight: 3, tints: COMMON },
    suv: { parts: car({ L: 4.6, W: 1.85, wb: 2.75, r: 0.36, waist: 1.08, roof: 1.82, cabin: [-2.15, -2.1, 0.55, 1.05], nose: 1.0, tail: 1.05, boxy: true }), len: 4.6, wid: 1.85, speed: 12.5, weight: 2, tints: [0xf4f4f2, 0xf4f4f2, 0x1b1b1b, 0x8a8f95, 0x5a2a1a, 0xc5c8cc] },
    bus: { parts: bus(), len: 11.5, wid: 2.55, speed: 9, weight: 1.2, tints: [0xc0281f] },
    tempo: { parts: tempo(), len: 5.3, wid: 2.0, speed: 9, weight: 1, tints: [0xf2f2f2, 0xf2c200, 0x2d6cb5, 0xe8e8e8] },
    bike: { parts: bike(), len: 1.9, wid: 0.75, speed: 13, weight: 3.5, tints: [0x1b1b1b, 0xb32020, 0x1d3f7a, 0xc5c8cc, 0x2e2e2e, 0xf4f4f2], rider: true },
  };
}
