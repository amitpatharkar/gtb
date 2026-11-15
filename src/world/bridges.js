import * as THREE from 'three';
import { Y } from './levels.js';

// The sea link's cable-stayed spans: two inverted-Y concrete pylons over Mahim Bay (the Bandra
// channel tower, 126 m, and the smaller Worli channel tower) with fans of stay cables down to
// the deck edges. Built once on the main thread from index.json `bridges.pylons` (the converter
// finds where the carriageways pass each pylon and how high the deck rises there), so the towers
// stand on the skyline from kilometres away, whatever tiles are loaded. Decks, piers and
// barriers come with the tiles (mesh/bridges.js). Two draw calls: concrete and cables.

const COLOUR = new THREE.Color(0xdcd7cc);

export class Bridges {
  constructor(scene, pylons, material) {
    this.pylons = pylons || [];
    if (!this.pylons.length) return;
    const pos = [], nor = [], uv = [], col = [], idx = [];
    const cables = [];
    for (const p of this.pylons) build(p, { pos, nor, uv, col, idx }, cables);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Uint8BufferAttribute(col, 3, true));
    g.setIndex(idx);
    g.computeBoundingSphere();
    this.towers = new THREE.Mesh(g, material || new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
    this.towers.castShadow = true;
    this.towers.receiveShadow = true;
    this.towers.name = 'sea link pylons';
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(cables, 3));
    cg.computeBoundingSphere();
    this.cables = new THREE.LineSegments(cg, new THREE.LineBasicMaterial({ color: 0xe8e4da, transparent: true, opacity: 0.75 }));
    this.cables.name = 'sea link stays';
    scene.add(this.towers, this.cables);
    this.cableCount = cables.length / 6;
  }

  /** Deck height (surface y) of the cable-stayed spans at distance d from a pylon (as the converter made it). */
  static deckAt(p, d) {
    const w = d < p.reach ? 0.5 * (1 + Math.cos((Math.PI * d) / p.reach)) : 0;
    return Y.ROAD + p.base + (p.deck - p.base) * w;
  }
}

function build(p, m, cables) {
  const fx = Math.sin(p.angle), fz = Math.cos(p.angle); // along the bridge
  const lx = fz, lz = -fx;                              // across
  const deckY = Y.ROAD + p.deck, top = Y.SEA + p.top, foot = Y.SEA - 1.2;
  const legOut = p.half + 3.2;                           // legs stand clear of both carriageways
  const join = deckY + 6 + (top - deckY - 6) * 0.42;     // where the legs meet
  const at = (a, o, y) => [p.x + fx * a + lx * o, y, p.z + fz * a + lz * o];
  // Pile caps in the sea, the legs (leaning in), a cross beam under the deck, the shaft.
  // (The legs rise straight past the deck edges, then lean in above the traffic.)
  for (const s of [1, -1]) {
    prism(m, at(0, s * legOut, foot), at(0, s * legOut, Y.SEA + 1.5), [fx, fz], [lx, lz], 7, 9, 7, 9);
    prism(m, at(0, s * legOut, Y.SEA + 1.5), at(0, s * legOut, deckY + 6), [fx, fz], [lx, lz], 2.8, 3.2, 2.6, 3.0);
    prism(m, at(0, s * legOut, deckY + 6), at(0, s * 2.2, join), [fx, fz], [lx, lz], 2.6, 3.0, 1.7, 2.4);
  }
  prism(m, at(0, -legOut + 1.5, deckY - 4.2), at(0, legOut - 1.5, deckY - 4.2), [fx, fz], [0, 1, 0], 2.2, 1.6, 2.2, 1.6, true);
  prism(m, at(0, 0, join - 3), at(0, 0, top - 9), [fx, fz], [lx, lz], 3.4, 2.6, 2.2, 1.8);
  prism(m, at(0, 0, top - 9), at(0, 0, top), [fx, fz], [lx, lz], 2.2, 1.8, 0.4, 0.4); // the pinnacle
  // Stay cables: four planes (both edges of each carriageway), semi-harp, both ways along.
  const hw = Math.min(p.hw || 7.5, p.half);
  const planes = p.half - 2 * hw > 3 ? [p.half - 0.6, p.half - 2 * hw + 0.6] : [p.half - 0.6, Math.max(0.8, p.half * 0.35)];
  const n = Math.max(10, Math.round(p.span / 11));
  const a0 = join + 6, a1 = top - 12;
  for (const dir of [1, -1]) for (const o of planes) for (const s of [1, -1]) {
    for (let k = 0; k < n; k++) {
      const f = k / (n - 1), d = 18 + f * (p.span - 30);
      const ty = a0 + (a1 - a0) * f;
      const t = at(dir * 1.1, s * 0.9, ty), b = at(dir * d, s * o, Bridges.deckAt(p, d) + 0.9);
      cables.push(t[0], t[1], t[2], b[0], b[1], b[2]);
    }
  }
}

/**
 * A tapered box from bottom centre a to top centre b: half sizes (u along `uDir`, v along `vDir`)
 * at the bottom (u0, v0) and top (u1, v1). With `beam`, vDir is the up axis (a horizontal beam).
 */
function prism(m, a, b, uDir, vDir, u0, v0, u1, v1, beam = false) {
  const U = [uDir[0], 0, uDir[1]], V = beam ? [0, 1, 0] : [vDir[0], 0, vDir[1]];
  const corner = (c, su, sv, hu, hv) => [c[0] + U[0] * su * hu + V[0] * sv * hv, c[1] + U[1] * su * hu + V[1] * sv * hv, c[2] + U[2] * su * hu + V[2] * sv * hv];
  const ring = (c, hu, hv) => [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([su, sv]) => corner(c, su, sv, hu, hv));
  const A = ring(a, u0, v0), B = ring(b, u1, v1);
  const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(m, [A[i], A[j], B[j], B[i]], mid, 0, Math.hypot(A[j][0] - A[i][0], A[j][2] - A[i][2]) + Math.abs(A[j][1] - A[i][1]), len);
  }
  face(m, [B[0], B[1], B[2], B[3]], mid, 0, 2 * u1, 2 * v1);
  face(m, [A[3], A[2], A[1], A[0]], mid, 0, 2 * u0, 2 * v0);
}

/** A flat quad facing away from `centre`, UVs in metres. */
function face(m, q, centre, u0, du, dv) {
  const e1 = [q[1][0] - q[0][0], q[1][1] - q[0][1], q[1][2] - q[0][2]], e2 = [q[3][0] - q[0][0], q[3][1] - q[0][1], q[3][2] - q[0][2]];
  let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  const l = Math.hypot(n[0], n[1], n[2]) || 1;
  n = n.map((v) => v / l);
  const c = [(q[0][0] + q[2][0]) / 2 - centre[0], (q[0][1] + q[2][1]) / 2 - centre[1], (q[0][2] + q[2][2]) / 2 - centre[2]];
  const flip = n[0] * c[0] + n[1] * c[1] + n[2] * c[2] < 0;
  if (flip) n = n.map((v) => -v);
  const base = m.pos.length / 3;
  const uvs = [[u0, 0], [u0 + du, 0], [u0 + du, dv], [u0, dv]];
  q.forEach((v, i) => {
    m.pos.push(v[0], v[1], v[2]); m.nor.push(n[0], n[1], n[2]); m.uv.push(uvs[i][0], uvs[i][1]);
    m.col.push(Math.round(COLOUR.r * 255), Math.round(COLOUR.g * 255), Math.round(COLOUR.b * 255));
  });
  if (flip) m.idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
  else m.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}
