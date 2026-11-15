import * as THREE from 'three';

// Clothes, hair and face details for the real characters, built as extra triangles of the
// character's one skinned mesh (no extra draw calls). Each piece is modelled against the
// template's own body in its adult rest pose (the T-pose after `rig()`/`shapeBody()`): head
// pieces in the head bone's space (the pack's head is a rounded box about one unit wide,
// face towards +z), garments in rest space by ray casts and cross-sections of the body.
// Every vertex gets bone weights (head; spine; hips and legs for skirts, so the front of a
// sari follows the knees and lies on the lap when seated) and is "unskinned" into bind
// space: skinning it again puts it back where it was modelled, and it follows the bones
// (and each person's build) from then on. characters.js draws the pieces a person wears
// by giving each character its own index buffer over the shared vertex buffers.

export const SLOT = { other: 0, skin: 1, shirt: 2, pants: 3, hair: 4, face: 5, thigh: 6, shoe: 7, shin: 8, sock: 9, arm: 10, forearm: 11, accA: 12, accB: 13, vest: 14, lens: 15 };

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/** First hit of a ray with a triangle soup (both sides). Returns distance or -1; normal in `n`. */
function raycast(tris, o, d, n) {
  let best = Infinity, bi = -1;
  const ox = o.x, oy = o.y, oz = o.z, dx = d.x, dy = d.y, dz = d.z;
  for (let i = 0; i < tris.length; i += 9) {
    const ax = tris[i], ay = tris[i + 1], az = tris[i + 2];
    const e1x = tris[i + 3] - ax, e1y = tris[i + 4] - ay, e1z = tris[i + 5] - az;
    const e2x = tris[i + 6] - ax, e2y = tris[i + 7] - ay, e2z = tris[i + 8] - az;
    const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
    const det = e1x * px + e1y * py + e1z * pz;
    if (det > -1e-12 && det < 1e-12) continue;
    const inv = 1 / det, tx = ox - ax, ty = oy - ay, tz = oz - az;
    const u = (tx * px + ty * py + tz * pz) * inv;
    if (u < 0 || u > 1) continue;
    const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
    const v = (dx * qx + dy * qy + dz * qz) * inv;
    if (v < 0 || u + v > 1) continue;
    const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
    if (t > 1e-5 && t < best) { best = t; bi = i; }
  }
  if (bi < 0) return -1;
  if (n) {
    const i = bi;
    n.set((tris[i + 4] - tris[i + 1]) * (tris[i + 8] - tris[i + 2]) - (tris[i + 5] - tris[i + 2]) * (tris[i + 7] - tris[i + 1]),
      (tris[i + 5] - tris[i + 2]) * (tris[i + 6] - tris[i]) - (tris[i + 3] - tris[i]) * (tris[i + 8] - tris[i + 2]),
      (tris[i + 3] - tris[i]) * (tris[i + 7] - tris[i + 1]) - (tris[i + 4] - tris[i + 1]) * (tris[i + 6] - tris[i])).normalize();
    if (n.dot(d) > 0) n.negate();
  }
  return best;
}

/** 2D convex hull (x, z pairs) — monotone chain. */
function hull(pts) {
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of pts) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  up.pop(); lo.pop();
  return lo.concat(up);
}
/** Distance from (cx, cz) along direction angle a (0 = +z, π/2 = +x) to a convex polygon's edge. */
function reach(poly, cx, cz, a) {
  const dx = Math.sin(a), dz = Math.cos(a);
  let best = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const ex = q[0] - p[0], ez = q[1] - p[1];
    const den = dx * ez - dz * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((p[0] - cx) * ez - (p[1] - cz) * ex) / den, s = ((p[0] - cx) * dz - (p[1] - cz) * dx) / den;
    if (t > 0 && s >= -1e-6 && s <= 1 + 1e-6) best = Math.max(best, t);
  }
  return best;
}

/**
 * The template's body in its adult rest pose: bone frames, skin matrices (bind → rest) and
 * rest positions of every vertex, for ray casts and cross-sections.
 */
export class Probe {
  constructor(mesh) {
    const sk = mesh.skeleton, g = mesh.geometry;
    this.sk = sk;
    this.index = new Map(sk.bones.map((b, i) => [b.name.toLowerCase(), i]));
    const B = mesh.bindMatrix, Bi = mesh.bindMatrixInverse;
    this.Bi = Bi;
    this.S = sk.bones.map((b, i) => new THREE.Matrix4().copy(Bi).multiply(b.matrixWorld).multiply(sk.boneInverses[i]).multiply(B));
    const p = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, n = p.count;
    this.rest = new Float32Array(n * 3); this.major = new Uint16Array(n);
    this.slot = g.attributes.aSlot.array;
    const v = V(), acc = V(), t = V();
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(p, i); acc.set(0, 0, 0);
      let best = 0, bw = -1;
      for (let k = 0; k < 4; k++) {
        const w = sw.getComponent(i, k); if (!w) continue;
        const j = si.getComponent(i, k);
        acc.addScaledVector(t.copy(v).applyMatrix4(this.S[j]), w);
        if (w > bw) { bw = w; best = j; }
      }
      this.rest[i * 3] = acc.x; this.rest[i * 3 + 1] = acc.y; this.rest[i * 3 + 2] = acc.z; this.major[i] = best;
    }
    this.count = n;
  }
  i(name) { const i = this.index.get(name.toLowerCase()); return i === undefined ? -1 : i; }
  /** A bone's frame in mesh space (rest). */
  frame(name) { const i = this.i(name); return new THREE.Matrix4().copy(this.Bi).multiply(this.sk.bones[i].matrixWorld); }
  pos(name) { return V().setFromMatrixPosition(this.frame(name)); }
  /** Triangles (rest space, or through `m`) whose first vertex passes `keep(vertex)`. */
  tris(keep, m = null) {
    const out = [], v = V();
    for (let i = 0; i < this.count; i += 3) {
      if (!keep(i)) continue;
      for (let k = 0; k < 3; k++) { v.fromArray(this.rest, (i + k) * 3); if (m) v.applyMatrix4(m); out.push(v.x, v.y, v.z); }
    }
    return new Float32Array(out);
  }
  /** Convex cross-section (x, z) of the vertices passing `keep` within `band` of height y. */
  section(y, band, keep) {
    const pts = [];
    for (let i = 0; i < this.count; i++) if (Math.abs(this.rest[i * 3 + 1] - y) < band && keep(i)) pts.push([this.rest[i * 3], this.rest[i * 3 + 2]]);
    return pts.length >= 3 ? hull(pts) : null;
  }
}

/**
 * Triangles under construction, with per-vertex weights ([[bone, w], …]), slot and colour.
 * `space`: a matrix from the modelling space to rest space (head pieces), or null.
 */
class Piece {
  constructor(space = null) { this.space = space; this.p = []; this.w = []; this.s = []; this.c = []; this.i = []; }
  v(p, w, slot, col = 0xffffff) { this.p.push(p.x, p.y, p.z); this.w.push(w); this.s.push(slot); this.c.push(col); return this.p.length / 3 - 1; }
  at(i) { return V(this.p[i * 3], this.p[i * 3 + 1], this.p[i * 3 + 2]); }
  /** A triangle facing along `hint` (flipped if needed). */
  tri(a, b, c, hint) {
    if (hint) {
      const A = this.at(a), n = this.at(b).sub(A).cross(this.at(c).sub(A));
      if (n.dot(hint) < 0) { this.i.push(a, c, b); return; }
    }
    this.i.push(a, b, c);
  }
  quad(a, b, c, d, hint) { this.tri(a, b, c, hint); this.tri(a, c, d, hint); }
  /** Copy of the triangles with reversed winding (inside faces of skirts and scarves). */
  twoSided(inset = 0.004) {
    const n = this.p.length / 3, g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setIndex(this.i.slice()); g.computeVertexNormals();
    const nr = g.attributes.normal, map = new Int32Array(n);
    for (let k = 0; k < n; k++) map[k] = this.v(this.at(k).addScaledVector(V().fromBufferAttribute(nr, k), -inset), this.w[k], this.s[k], this.c[k]);
    const tri = this.i.length;
    for (let k = 0; k < tri; k += 3) this.i.push(map[this.i[k]], map[this.i[k + 2]], map[this.i[k + 1]]);
    return this;
  }
}

/** Bake a piece into bind space: non-indexed geometry with the character attributes. */
function bake(piece, probe) {
  const n = piece.p.length / 3;
  if (!n || !piece.i.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(piece.p, 3));
  g.setIndex(piece.i);
  g.computeVertexNormals();
  const pos = g.attributes.position, nor = g.attributes.normal;
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), slot = new Float32Array(n), base = new Float32Array(n * 3);
  const M = new THREE.Matrix4(), Mi = new THREE.Matrix4(), N3 = new THREE.Matrix3(), v = V(), nv = V(), col = new THREE.Color();
  const sp = piece.space, spN = sp ? new THREE.Matrix3().getNormalMatrix(sp) : null;
  for (let k = 0; k < n; k++) {
    // Up to four influences, strongest first.
    let w = piece.w[k];
    if (typeof w === 'number') w = [[w, 1]];
    w = w.filter(([b, x]) => b >= 0 && x > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = w.reduce((s, [, x]) => s + x, 0) || 1;
    M.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    for (let q = 0; q < w.length; q++) {
      const [b, x] = w[q], e = probe.S[b].elements, me = M.elements, f = x / sum;
      for (let r = 0; r < 16; r++) me[r] += e[r] * f;
      si[k * 4 + q] = b; sw[k * 4 + q] = f;
    }
    Mi.copy(M).invert();
    v.fromBufferAttribute(pos, k); nv.fromBufferAttribute(nor, k);
    if (sp) { v.applyMatrix4(sp); nv.applyMatrix3(spN); }
    v.applyMatrix4(Mi); nv.applyMatrix3(N3.setFromMatrix4(Mi)).normalize();
    pos.setXYZ(k, v.x, v.y, v.z); nor.setXYZ(k, nv.x, nv.y, nv.z);
    slot[k] = piece.s[k];
    col.setHex(piece.c[k]); base[k * 3] = col.r; base[k * 3 + 1] = col.g; base[k * 3 + 2] = col.b;
  }
  g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  g.setAttribute('aSlot', new THREE.BufferAttribute(slot, 1));
  g.setAttribute('aBase', new THREE.BufferAttribute(base, 3));
  return g.toNonIndexed();
}

// ---------------------------------------------------------------- shared shapes
/** An ellipsoid (low poly) at c with radii r, axes rotated by quaternion q. */
function blob(pc, c, r, w, slot, col, q = null, seg = 8, rings = 6) {
  const first = pc.p.length / 3, grid = [];
  for (let j = 0; j <= rings; j++) {
    const ph = (j / rings) * Math.PI, row = [];
    for (let i = 0; i < seg; i++) {
      const th = (i / seg) * Math.PI * 2;
      const d = V(Math.sin(ph) * Math.sin(th) * r.x, Math.cos(ph) * r.y, Math.sin(ph) * Math.cos(th) * r.z);
      if (q) d.applyQuaternion(q);
      row.push(j === 0 || j === rings ? (i === 0 ? pc.v(d.add(c), w, slot, col) : row[0]) : pc.v(d.add(c), w, slot, col));
    }
    grid.push(row);
  }
  for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) {
    const a = grid[j][i], b = grid[j][(i + 1) % seg], cc = grid[j + 1][(i + 1) % seg], d = grid[j + 1][i];
    const mid = pc.at(a).add(pc.at(cc)).multiplyScalar(0.5).sub(c);
    if (j === 0) pc.tri(a, cc, d, mid); else if (j === rings - 1) pc.tri(a, b, d, mid); else pc.quad(a, b, cc, d, mid);
  }
  return first;
}

/** A tube along a path: radius per point, `wf(point)` gives weights. Closed ends. */
function tube(pc, path, radius, wf, slot, col, seg = 7) {
  const rings = [];
  let prevN = null;
  for (let k = 0; k < path.length; k++) {
    const p = path[k], t = (k < path.length - 1 ? path[k + 1].clone().sub(p) : p.clone().sub(path[k - 1])).normalize();
    let n = prevN ? prevN.clone().sub(t.clone().multiplyScalar(prevN.dot(t))).normalize() : (Math.abs(t.y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0)).cross(t).normalize();
    prevN = n;
    const b = t.clone().cross(n);
    const r = typeof radius === 'function' ? radius(k) : radius, ring = [];
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const q = p.clone().addScaledVector(n, Math.cos(a) * r).addScaledVector(b, Math.sin(a) * r);
      ring.push(pc.v(q, wf(p), slot, col));
    }
    rings.push(ring);
  }
  for (let k = 0; k + 1 < rings.length; k++) for (let i = 0; i < seg; i++) {
    const a = rings[k][i], b = rings[k][(i + 1) % seg], c = rings[k + 1][(i + 1) % seg], d = rings[k + 1][i];
    const out = pc.at(a).sub(path[k]);
    pc.quad(a, b, c, d, out);
  }
  for (const [k, sgn] of [[0, -1], [path.length - 1, 1]]) {
    const ctr = pc.v(path[k], wf(path[k]), slot, col);
    const dir = (k ? path[k].clone().sub(path[k - 1]) : path[0].clone().sub(path[1])).normalize();
    for (let i = 0; i < seg; i++) pc.tri(ctr, rings[k][i], rings[k][(i + 1) % seg], dir);
    void sgn;
  }
}

/** A flat band along a path on a surface: `side(k)` = half-width vector, `up(k)` = outward normal. */
function band(pc, path, side, up, wf, slotOf, colOf = () => 0xffffff, thick = 0.018) {
  const top = [], bot = [];
  for (let k = 0; k < path.length; k++) {
    const s = side(k), u = up(k);
    for (const [arr, off] of [[top, 0], [bot, -thick]]) {
      const a = path[k].clone().addScaledVector(u, off);
      arr.push([pc.v(a.clone().add(s), wf(path[k], k), slotOf(k), colOf(k)), pc.v(a.clone().sub(s), wf(path[k], k), slotOf(k), colOf(k))]);
    }
  }
  for (let k = 0; k + 1 < path.length; k++) {
    const u = up(k);
    pc.quad(top[k][0], top[k][1], top[k + 1][1], top[k + 1][0], u);
    pc.quad(bot[k][0], bot[k][1], bot[k + 1][1], bot[k + 1][0], u.clone().negate());
    const s = side(k);
    pc.quad(top[k][0], top[k + 1][0], bot[k + 1][0], bot[k][0], s);
    pc.quad(top[k][1], top[k + 1][1], bot[k + 1][1], bot[k][1], s.clone().negate());
  }
}

/** Catmull-Rom through control points, `per` samples between each pair. */
function spline(ctrl, per = 4) {
  const out = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      out.push(V(
        0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
        0.5 * (2 * p1.z + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3)));
    }
  }
  out.push(ctrl[ctrl.length - 1].clone());
  return out;
}

// ---------------------------------------------------------------- the body in rest space
/** Landmarks and helpers shared by the builders of one template. */
function body(probe) {
  const K = { probe };
  const b = (n) => probe.i(n);
  K.bone = { head: b('Head'), neck: b('Neck'), torso: b('Torso'), abdomen: b('Abdomen'), hips: b('Hips'), thighL: b('UpperLegL'), thighR: b('UpperLegR'), shinL: b('LowerLegL'), shinR: b('LowerLegR'), fistR: b('FistR'), fistL: b('FistL'), shoulderL: b('ShoulderL'), shoulderR: b('ShoulderR') };
  K.p = {};
  for (const n of ['Head', 'Neck', 'Torso', 'Abdomen', 'Hips', 'UpperLegL', 'UpperLegR', 'LowerLegL', 'LowerLegR', 'LowerLegL_end', 'LowerLegR_end', 'ShoulderL', 'ShoulderR', 'UpperArmL', 'UpperArmR', 'FistR', 'FistR_end']) K.p[n] = probe.pos(n);
  K.H = probe.frame('Head');
  const major = probe.major, slot = probe.slot, B = K.bone;
  const legBones = new Set([B.hips, B.thighL, B.thighR, B.shinL, B.shinR]);
  const trunkBones = new Set([B.hips, B.abdomen, B.torso, B.neck, B.shoulderL, B.shoulderR]);
  K.isLeg = (i) => legBones.has(major[i]) && slot[i] !== SLOT.shoe;
  K.isTrunk = (i) => trunkBones.has(major[i]) && slot[i] !== SLOT.face && slot[i] !== SLOT.hair;
  K.headTris = probe.tris((i) => major[i] === B.head && (slot[i] === SLOT.skin || slot[i] === SLOT.face), new THREE.Matrix4().copy(K.H).invert());
  K.trunkTris = probe.tris(K.isTrunk);
  // Waist: the top of the trousers (or the belt).
  let top = -Infinity;
  const ys = [];
  for (let i = 0; i < probe.count; i++) if ((slot[i] === SLOT.pants || slot[i] === SLOT.thigh) && major[i] === B.hips) ys.push(probe.rest[i * 3 + 1]);
  ys.sort((a, b2) => a - b2);
  top = ys.length ? ys[Math.floor(ys.length * 0.92)] : K.p.Hips.y + 0.1;
  K.waist = Math.min(top, K.p.Abdomen.y);
  K.cx = (K.p.UpperLegL.x + K.p.UpperLegR.x) / 2; K.cz = K.p.Hips.z;
  K.knee = (K.p.LowerLegL.y + K.p.LowerLegR.y) / 2;
  K.ankle = (K.p['LowerLegL_end'].y + K.p['LowerLegR_end'].y) / 2;
  K.hipW = Math.abs(K.p.UpperLegL.x - K.p.UpperLegR.x) / 2;
  // Model units per metre: the base of the head sits about 1.42 m above the ankle of a 1.73 m
  // adult. Sizes below are in metres of that adult (children and builds scale with the bones).
  K.u = (K.p.Head.y - K.ankle) / 1.42;
  K.headS = V().setFromMatrixScale(K.H).x;
  // Envelope of the legs and hips at height y (convex): radius along angle a around (cx, cz).
  const inBody = (i) => K.isLeg(i) || K.isTrunk(i);
  K.sec = new Map();
  K.legR = (a, y) => {
    const key = Math.round(y * 40);
    let poly = K.sec.get(key);
    if (poly === undefined) { poly = probe.section(key / 40, 0.05, inBody); K.sec.set(key, poly); }
    return poly ? reach(poly, K.cx, K.cz, a) : 0;
  };
  // Half-widths of the trunk at the waist, the chest and the neck.
  K.ch = (K.p.Torso.y + K.p.Neck.y) / 2;
  const halfW = (y) => { const s = probe.section(y, 0.04, K.isTrunk); return s ? Math.max(reach(s, K.cx, K.cz, Math.PI / 2), reach(s, K.cx, K.cz, -Math.PI / 2)) : 0.3 * K.u; };
  K.wHalf = halfW(K.waist); K.cHalf = halfW(K.ch); K.nHalf = halfW(K.p.Neck.y + 0.02 * K.u);
  K.sx = K.p.UpperArmL.x; // the shoulder joint (edge of the trunk)
  // The head's widest reach (head space) between two heights: hats sit just outside it.
  K.headR = (y0, y1) => {
    let r = 0;
    const t = K.headTris;
    for (let i = 0; i < t.length; i += 3) if (t[i + 1] >= y0 && t[i + 1] <= y1) r = Math.max(r, Math.hypot(t[i], t[i + 2]));
    return r || 0.6;
  };
  // Front/back surface of the trunk at (x, y) and the top of a shoulder at (x, z).
  K.hit = (o, d) => { const n = V(); const t = raycast(K.trunkTris, o, d, n); return t < 0 ? null : { p: o.clone().addScaledVector(d, t), n }; };
  K.front = (x, y) => K.hit(V(x, y, K.cz + 3), V(0, 0, -1));
  K.back = (x, y) => K.hit(V(x, y, K.cz - 3), V(0, 0, 1));
  K.top = (x, z) => K.hit(V(x, K.p.Head.y + 1, z), V(0, -1, 0));
  // Weights along the spine by height (hips → abdomen → torso → neck).
  const jy = [[B.hips, K.p.Hips.y], [B.abdomen, K.p.Abdomen.y], [B.torso, K.p.Torso.y], [B.neck, K.p.Neck.y]];
  K.spine = (y) => {
    if (y <= jy[0][1]) return [[B.hips, 1]];
    for (let k = 0; k + 1 < jy.length; k++) if (y < jy[k + 1][1]) { const t = smooth(jy[k][1], jy[k + 1][1], y); return [[jy[k][0], 1 - t], [jy[k + 1][0], t]]; }
    return [[B.torso, 0.5], [B.neck, 0.5]];
  };
  return K;
}

/**
 * Skirt weights: the hips at the waist; lower down, the front follows the legs (thigh, then
 * shin below the knee), the back much less; left/right by the side the cloth hangs on.
 */
function skirtW(K, a, y, legShare = 0.85, backShare = 0.3) {
  const B = K.bone, depth = smooth(K.waist - 0.05 * K.u, K.waist - 0.55 * (K.waist - K.ankle), y);
  const front = (Math.cos(a) + 1) / 2;
  const s = depth * (backShare + (legShare - backShare) * front);
  const side = Math.sin(a), l = s * clamp01(0.5 + 0.48 * side), r = s - l;
  const shin = smooth(K.knee + 0.08 * K.u, K.knee - 0.12 * K.u, y);
  return [[B.hips, 1 - s], [B.thighL, l * (1 - shin)], [B.shinL, l * shin], [B.thighR, r * (1 - shin)], [B.shinR, r * shin]];
}

/**
 * A skirt: rings from the waist to `hemY`, never narrower than the body above, flaring out.
 * opt: flare, pleats(a, y) extra radius, border (rings at the hem with slot accB), slit
 * (side slits below this height), seg, legShare.
 */
function skirt(K, hemY, opt = {}) {
  const pc = new Piece(), seg = opt.seg || 28, rows = opt.rows || 7, top = opt.top ?? K.waist;
  const u = K.u, flare = (opt.flare ?? 0.12) * u, ease = (opt.ease ?? 0.035) * u;
  const ring = [];
  const widest = new Float32Array(seg);
  for (let j = 0; j <= rows; j++) {
    const f = j / rows, y = top + (hemY - top) * f, row = [];
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      let r = Math.max(K.legR(a, y), widest[i]);
      widest[i] = r;
      r += ease * (j === 0 ? 0.55 : 1) + flare * f * f * (0.6 + 0.4 * Math.abs(Math.cos(a)));
      if (opt.pleats) r += opt.pleats(a, f) * u;
      const slot = opt.border && j >= rows - opt.border ? SLOT.accB : opt.slot ?? SLOT.pants;
      row.push(pc.v(V(K.cx + Math.sin(a) * r, y, K.cz + Math.cos(a) * r), skirtW(K, a, y, opt.legShare, opt.backShare), slot));
    }
    ring.push(row);
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    if (opt.slit !== undefined && top + (hemY - top) * (j / rows) <= opt.slit && Math.abs(Math.cos(a)) < 0.16) continue; // side slits
    const p = ring[j][i], q = ring[j][(i + 1) % seg], r = ring[j + 1][(i + 1) % seg], s = ring[j + 1][i];
    pc.quad(p, q, r, s, V(Math.sin(a), 0, Math.cos(a)));
  }
  return pc.twoSided(0.006 * u);
}

/** A path over the trunk's surface through control points [x, y, 'front'|'back'|'top', z?]. */
function surfacePath(K, ctrl, lift, per = 4) {
  const pts = [], nrm = [];
  for (const [x, y, face, z] of ctrl) {
    const h = face === 'front' ? K.front(x, y) : face === 'back' ? K.back(x, y) : K.top(x, z ?? K.cz);
    if (!h) continue;
    pts.push(h.p.addScaledVector(h.n, lift)); nrm.push(h.n);
  }
  const path = spline(pts, per), normals = spline(nrm, per).map((n) => n.normalize());
  // Pull the samples back onto the surface (a smooth curve can cut corners).
  for (let k = 0; k < path.length; k++) {
    const h = K.hit(path[k].clone().addScaledVector(normals[k], 1.2), normals[k].clone().negate());
    if (h && h.p.distanceTo(path[k]) < 0.6) { path[k].copy(h.p.addScaledVector(h.n, lift)); normals[k].lerp(h.n, 0.5).normalize(); }
  }
  return { path, normals };
}

function ribbon(K, ctrl, halfW, slotOf, colOf, wf, lift = 0.022, per = 4) {
  const pc = new Piece();
  const { path, normals } = surfacePath(K, ctrl, lift * K.u, per);
  if (path.length < 2) return pc;
  const tan = (k) => (k < path.length - 1 ? path[k + 1].clone().sub(path[k]) : path[k].clone().sub(path[k - 1])).normalize();
  const hw = typeof halfW === 'function' ? halfW : () => halfW;
  band(pc, path, (k) => tan(k).cross(normals[k]).normalize().multiplyScalar(hw(k, path.length) * K.u), (k) => normals[k], wf || ((p) => K.spine(p.y)), (k) => slotOf(k, path.length), (k) => colOf(k, path.length), 0.016 * K.u);
  return pc;
}

// ---------------------------------------------------------------- hair (head space)
const HC = V(0, 0.42, 0); // centre of the head box in head space

/** The head's surface along a direction from its centre (head space). */
function headPoint(K, dir, out, n) {
  const t = raycast(K.headTris, HC, dir, n);
  if (t < 0) return false;
  out.copy(HC).addScaledVector(dir, t);
  if (n) n.negate(); // cast from inside: the outward normal
  return true;
}
const dirOf = (th, ph) => V(Math.sin(ph) * Math.sin(th), Math.cos(ph), Math.sin(ph) * Math.cos(th));

/**
 * A hair shell on the head: columns around the head (th from front = 0 towards the left),
 * rows from the crown (or `top(th)`) down to the hairline `line(th)` (heights in head space);
 * `thick(pt, th, s)` = thickness at a surface point (s 0 crown … 1 hairline).
 */
function cap(K, { line, top = null, thick, th0 = 0, th1 = Math.PI * 2, cols = 28, rows = 9, slot = SLOT.hair, inset = 0.03 }) {
  const pc = new Piece(K.H), full = th1 - th0 >= Math.PI * 2 - 1e-6, w = K.bone.head;
  const ncol = full ? cols : cols + 1, grid = [], surf = [], nor = [];
  const p = V(), n = V();
  const phiAt = (th, y) => {
    // First angle from the crown where the surface drops below y.
    let lo = 0, hi = Math.PI * 0.95, prev = 0;
    for (let ph = 0.05; ph <= hi; ph += 0.05) { if (headPoint(K, dirOf(th, ph), p, null) && p.y < y) { lo = prev; hi = ph; break; } prev = ph; }
    for (let k = 0; k < 7; k++) { const m = (lo + hi) / 2; if (headPoint(K, dirOf(th, m), p, null) && p.y < y) hi = m; else lo = m; }
    return (lo + hi) / 2;
  };
  for (let i = 0; i < ncol; i++) {
    const th = th0 + ((th1 - th0) * i) / cols;
    const ph1 = phiAt(th, line(th)), ph0 = top ? Math.min(ph1 - 0.05, phiAt(th, top(th))) : 0;
    const col = [], sc = [], nc = [];
    for (let j = 0; j <= rows; j++) {
      const s = j / rows, ph = ph0 + (ph1 - ph0) * s;
      if (!headPoint(K, dirOf(th, Math.max(ph, 0.001)), p, n)) { p.copy(HC).addScaledVector(dirOf(th, ph), 0.5); n.copy(dirOf(th, ph)); }
      const out = n.clone().add(p.clone().sub(HC).normalize()).normalize();
      const t = thick(p, th, s);
      sc.push(p.clone()); nc.push(out);
      col.push(!top && j === 0 && i > 0 ? grid[0][0] : pc.v(p.clone().addScaledVector(out, t), w, slot));
    }
    grid.push(col); surf.push(sc); nor.push(nc);
  }
  const C = (i) => (full ? i % cols : i);
  const quads = full ? cols : cols;
  for (let i = 0; i < quads; i++) for (let j = 0; j < rows; j++) {
    const a = grid[C(i)][j], b = grid[C(i + 1)][j], c = grid[C(i + 1)][j + 1], d = grid[C(i)][j + 1];
    const hint = nor[C(i)][j + 1];
    if (a === b) pc.tri(a, c, d, hint); else pc.quad(a, b, c, d, hint);
  }
  // Rims: the hair's edge turns in under the skin at the hairline (and the crown edge of a band).
  const rim = (j, dirSign) => {
    for (let i = 0; i < quads; i++) {
      const i0 = C(i), i1 = C(i + 1);
      const a = grid[i0][j], b = grid[i1][j];
      const ia = pc.v(surf[i0][j].clone().addScaledVector(nor[i0][j], -inset), w, slot), ib = pc.v(surf[i1][j].clone().addScaledVector(nor[i1][j], -inset), w, slot);
      const along = surf[i0][j].clone().sub(surf[i0][j - dirSign] || surf[i0][j]).normalize();
      pc.quad(a, b, ib, ia, along.lengthSq() > 0 ? along : nor[i0][j]);
    }
  };
  rim(rows, 1);
  if (top) rim(0, -1);
  if (!full) for (const i of [0, cols]) for (let j = 0; j < rows; j++) {
    const a = grid[i][j], b = grid[i][j + 1];
    const ia = pc.v(surf[i][j].clone().addScaledVector(nor[i][j], -inset), w, slot), ib = pc.v(surf[i][j + 1].clone().addScaledVector(nor[i][j + 1], -inset), w, slot);
    const side = V(Math.cos(th0 + ((th1 - th0) * i) / cols), 0, -Math.sin(th0 + ((th1 - th0) * i) / cols)).multiplyScalar(i ? 1 : -1);
    pc.quad(a, b, ib, ia, side);
  }
  return pc;
}

/** Hairline height around the head: front, temples, back (head space). */
const lineOf = (front, side, back, extra = null) => (th) => {
  const c = Math.cos(th);
  const y = c >= 0 ? side + (front - side) * c * c : side + (back - side) * c * c;
  return extra ? y + extra(th) : y;
};
const topness = (p) => smooth(0.55, 0.98, p.y);

const HAIR = {
  // Short with a side parting on the left: fuller on the right of the parting, swept over.
  short: (K) => cap(K, {
    line: lineOf(0.76, 0.46, 0.2), thick: (p, th, s) => {
      const part = 0.17, onTop = smooth(0.62, 0.8, p.y) * smooth(-0.25, 0.1, p.z);
      let t = 0.035 + 0.05 * topness(p) + 0.03 * smooth(0.1, 0.45, p.z) * smooth(0.6, 0.85, p.y);
      if (p.x < part) t += 0.02 * onTop;
      t *= 1 - 0.75 * onTop * Math.exp(-(((p.x - part) / 0.03) ** 2));
      return t;
    },
  }),
  // Oiled and combed straight back: thin, glossy, comb lines.
  slick: (K) => cap(K, { line: lineOf(0.8, 0.48, 0.22), thick: (p) => 0.024 + 0.022 * topness(p) + 0.005 * Math.sin(p.x * 70) * smooth(0.6, 0.9, p.y) }),
  // Short crop.
  crop: (K) => cap(K, { line: lineOf(0.78, 0.47, 0.2), thick: (p) => 0.028 + 0.02 * topness(p) }),
  // Curly and full.
  curly: (K) => cap(K, { line: lineOf(0.74, 0.44, 0.16), rows: 10, cols: 32, thick: (p, th, s) => 0.055 + 0.045 * topness(p) + 0.03 * Math.max(0, Math.sin(th * 11) * Math.sin(s * 19 + th * 3)) }),
  // Receding: high M-shaped hairline.
  receding: (K) => cap(K, { line: lineOf(0.86, 0.5, 0.2, (th) => 0.07 * Math.exp(-(((Math.abs(th > Math.PI ? th - Math.PI * 2 : th) - 0.55) / 0.22) ** 2))), thick: (p) => 0.022 + 0.012 * topness(p) }),
  // Bald on top: a horseshoe round the sides and back.
  bald: (K) => cap(K, { th0: 1.05, th1: Math.PI * 2 - 1.05, cols: 18, rows: 4, line: lineOf(0.5, 0.42, 0.18), top: lineOf(0.66, 0.62, 0.66), thick: () => 0.022 }),
  // Women: centre parting, pulled back to a low bun or a plait (the bun / braid is added below).
  back: (K) => cap(K, { line: lineOf(0.74, 0.36, 0.12), thick: (p) => (0.03 + 0.03 * topness(p)) * (1 - 0.7 * smooth(0.0, 0.3, p.z) * smooth(0.7, 0.9, p.y) * Math.exp(-((p.x / 0.03) ** 2))) }),
  // Loose long hair: centre parting, falling over the sides to the jaw and on down the back.
  long: (K) => cap(K, { line: lineOf(0.74, 0.08, -0.08), rows: 11, thick: (p) => (0.04 + 0.035 * topness(p) + 0.03 * smooth(0.5, 0.1, p.y)) * (1 - 0.7 * smooth(0.0, 0.3, p.z) * smooth(0.7, 0.9, p.y) * Math.exp(-((p.x / 0.03) ** 2))) }),
  // A bob: to the jaw, fuller at the ends, fringe swept to one side.
  bob: (K) => cap(K, { line: lineOf(0.72, 0.12, 0.1), rows: 10, thick: (p) => 0.045 + 0.03 * topness(p) + 0.045 * smooth(0.45, 0.12, p.y) }),
  // Pulled back for a ponytail.
  pony: (K) => cap(K, { line: lineOf(0.75, 0.4, 0.2), thick: (p) => 0.03 + 0.025 * topness(p) }),
};

/** Extras in head space: bun, ponytail, flowers. */
function bun(K, flowers) {
  const pc = new Piece(K.H), w = K.bone.head, c = V(0, 0.3, -0.64);
  blob(pc, c, V(0.24, 0.2, 0.17), w, SLOT.hair, 0, null, 10, 7);
  // Coils on the bun.
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; blob(pc, c.clone().add(V(Math.cos(a) * 0.12, Math.sin(a) * 0.1, -0.11)), V(0.07, 0.07, 0.05), w, SLOT.hair, 0, null, 6, 4); }
  if (flowers) {
    // A gajra round the bun: jasmine, with orange aboli for the Koli style.
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2;
      blob(pc, c.clone().add(V(Math.cos(a) * 0.25, Math.sin(a) * 0.21, -0.02)), V(0.04, 0.04, 0.04), w, SLOT.other, k % 3 === 2 ? 0xff8f1f : 0xf6f3e8, null, 5, 3);
    }
  }
  return pc;
}
function pony(K) {
  const pc = new Piece(K.H), w = K.bone.head;
  const path = spline([V(0, 0.62, -0.5), V(0, 0.55, -0.72), V(0, 0.32, -0.8), V(0, 0.06, -0.74), V(0, -0.12, -0.66)], 3);
  tube(pc, path, (k) => 0.11 - 0.06 * (k / (path.length - 1)), () => w, SLOT.hair, 0, 8);
  tube(pc, [V(0, 0.64, -0.47), V(0, 0.6, -0.56)], 0.1, () => w, SLOT.accB, 0, 8); // hair tie
  return pc;
}

/** A braid from the back of the head down the back (rest space, head → neck → torso). */
function braid(K, x0, side, len, ribbon, flowers) {
  const pc = new Piece(), u = K.u, B = K.bone;
  const start = V(x0, 0.12, -0.52).applyMatrix4(K.H);
  const backAt = (y) => { const h = K.back(start.x * 0.7, y); return h ? h.p.z : K.cz - 0.15 * u; };
  const pts = [];
  const steps = 12, y1 = start.y - len * u;
  for (let k = 0; k <= steps; k++) {
    const y = start.y + (y1 - start.y) * (k / steps);
    const z = Math.min(start.z, backAt(y) - 0.035 * u) - 0.005 * u;
    pts.push(V(start.x + side * 0.02 * u * k / steps, y, k === 0 ? start.z : z));
  }
  const wf = (p) => {
    const hy = K.p.Head.y, ny = K.p.Neck.y, ty = K.p.Torso.y;
    if (p.y >= hy) return [[B.head, 1]];
    if (p.y >= ny) { const t = smooth(ny, hy, p.y); return [[B.head, t], [B.neck, 1 - t]]; }
    const t = smooth(ty, ny, p.y); return [[B.neck, t * 0.5], [B.torso, 1 - t * 0.5]];
  };
  // Lobes of the braid, alternating left and right.
  for (let k = 0; k < pts.length - 1; k++) {
    const c = pts[k].clone().lerp(pts[k + 1], 0.5), r = (0.036 - 0.01 * (k / steps)) * u;
    c.x += (k % 2 ? 1 : -1) * 0.009 * u;
    blob(pc, c, V(r, (pts[k].y - pts[k + 1].y) * 0.62, r * 0.85), wf(c), SLOT.hair, 0, new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), (k % 2 ? 1 : -1) * 0.35), 6, 4);
  }
  const end = pts[pts.length - 1];
  if (ribbon) { blob(pc, end.clone().add(V(-0.03 * u, 0, -0.01 * u)), V(0.035 * u, 0.022 * u, 0.012 * u), wf(end), SLOT.accB, 0); blob(pc, end.clone().add(V(0.03 * u, 0, -0.01 * u)), V(0.035 * u, 0.022 * u, 0.012 * u), wf(end), SLOT.accB, 0); }
  else tube(pc, [end, end.clone().add(V(0, -0.06 * u, 0))], 0.018 * u, () => wf(end), SLOT.hair, 0, 6);
  if (flowers) for (let k = 0; k < 5; k++) { const p = pts[k].clone().lerp(pts[k + 1], 0.5); p.z -= 0.03 * u; p.x += (k % 2 ? 1 : -1) * 0.02 * u; blob(pc, p, V(0.018 * u, 0.018 * u, 0.015 * u), wf(p), SLOT.other, 0xf6f3e8, null, 5, 3); }
  return pc;
}

/** Loose long hair falling down the back from the head (rest space). */
function fall(K) {
  const pc = new Piece(), u = K.u, B = K.bone;
  const cols = 9, rows = 6;
  const yTop = V(0, -0.02, -0.5).applyMatrix4(K.H).y, yBot = K.p.Torso.y + 0.05 * u;
  const grid = [];
  for (let j = 0; j <= rows; j++) {
    const f = j / rows, y = yTop + (yBot - yTop) * f, row = [];
    const w = (0.5 - 0.14 * f) * K.headS;
    for (let i = 0; i <= cols; i++) {
      const x = -w + (2 * w * i) / cols;
      const h = K.back(x, y);
      const headZ = V(0, 0, -0.52).applyMatrix4(K.H).z;
      const z = Math.min(h ? h.p.z - 0.015 * u : K.cz - 0.15 * u, f < 0.25 ? headZ : 1e9) - 0.01 * u - 0.006 * u * Math.sin(i * 2.3);
      const wt = f < 0.2 ? [[B.head, 1 - f * 2.5], [B.neck, f * 2.5]] : [[B.neck, 0.4 * (1 - f)], [B.torso, 1 - 0.4 * (1 - f)]];
      row.push(pc.v(V(x, y, z), wt, SLOT.hair));
    }
    grid.push(row);
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) pc.quad(grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i], V(0, 0, -1));
  return pc.twoSided(0.01 * u);
}

// ---------------------------------------------------------------- face (head space)
function moustache(K) {
  const pc = new Piece(K.H), w = K.bone.head, n = 9, top = [], bot = [], topB = [], botB = [];
  for (let k = 0; k <= n; k++) {
    const x = -0.22 + (0.44 * k) / n, e = Math.abs(x) / 0.22;
    const yc = 0.215 - 0.075 * e * e, h = 0.04 * (1 - 0.55 * e * e), z = 0.505 + 0.035 * (1 - e * e);
    top.push(pc.v(V(x, yc + h, z), w, SLOT.hair)); bot.push(pc.v(V(x, yc - h, z + 0.008), w, SLOT.hair));
    topB.push(pc.v(V(x, yc + h, 0.48), w, SLOT.hair)); botB.push(pc.v(V(x, yc - h, 0.48), w, SLOT.hair));
  }
  for (let k = 0; k < n; k++) {
    pc.quad(top[k], top[k + 1], bot[k + 1], bot[k], V(0, 0, 1));
    pc.quad(topB[k], topB[k + 1], top[k + 1], top[k], V(0, 1, 0));
    pc.quad(bot[k], bot[k + 1], botB[k + 1], botB[k], V(0, -1, 0));
  }
  return pc;
}
function beard(K, full) {
  // The jaw and chin below the cheeks; the full beard is thicker and longer at the chin.
  return cap(K, {
    th0: -2.0, th1: 2.0, cols: 20, rows: 6, inset: 0.025,
    top: (th) => { const c = Math.cos(th); return c > 0.6 ? 0.17 - 0.03 * (c - 0.6) : 0.4 - 0.23 * smooth(0.0, 0.6, c); },
    line: (th) => -0.14 + 0.1 * smooth(0.2, -0.5, Math.cos(th)),
    thick: (p, th, s) => (full ? 0.06 + 0.08 * smooth(0.3, 1, s) * smooth(0.3, 0.9, Math.cos(th)) : 0.03 + 0.015 * s),
  });
}
function bindi(K) {
  const pc = new Piece(K.H), w = K.bone.head, c = pc.v(V(0, 0.565, 0.518), w, SLOT.other, 0xb3001b), ring = [];
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; ring.push(pc.v(V(Math.cos(a) * 0.034, 0.565 + Math.sin(a) * 0.034, 0.5), w, SLOT.other, 0xb3001b)); }
  for (let k = 0; k < 10; k++) pc.tri(c, ring[k], ring[(k + 1) % 10], V(0, 0, 1));
  return pc;
}
function glasses(K, dark) {
  const pc = new Piece(K.H), w = K.bone.head, frame = dark ? 0x101010 : 0x1d1712;
  const z = 0.545, r = 0.016;
  for (const sx of [-1, 1]) {
    const cx = 0.245 * sx, cy = 0.385, hw = 0.125, hh = 0.1, pts = [];
    for (let k = 0; k <= 16; k++) {
      const a = (k / 16) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      const ex = Math.sign(c) * Math.abs(c) ** 0.55, ey = Math.sign(s) * Math.abs(s) ** 0.55; // a rounded rectangle
      pts.push(V(cx + ex * hw, cy + ey * hh, z));
    }
    tube(pc, pts, r, () => w, SLOT.other, frame, 5);
    if (dark) {
      const ctr = pc.v(V(cx, cy, z - 0.004), w, SLOT.lens, 0x0b0c10), ring = pts.slice(0, 16).map((p) => pc.v(p.clone().setZ(z - 0.004), w, SLOT.lens, 0x0b0c10));
      for (let k = 0; k < 16; k++) pc.tri(ctr, ring[k], ring[(k + 1) % 16], V(0, 0, 1));
    }
    // Arm back over the side of the head.
    tube(pc, [V(cx + sx * hw, cy + 0.04, z), V(0.515 * sx, cy + 0.06, 0.44), V(0.515 * sx, cy + 0.07, -0.18)], r * 0.8, () => w, SLOT.other, frame, 4);
  }
  tube(pc, [V(-0.12, 0.42, z), V(0, 0.44, z + 0.01), V(0.12, 0.42, z)], r * 0.8, () => w, SLOT.other, frame, 4);
  return pc;
}

// ---------------------------------------------------------------- headwear (head space)
function dome(pc, w, c, rx, ry, rz, slot, col = 0xffffff, from = 0, to = Math.PI / 2, seg = 20, rings = 6, cut = null) {
  const grid = [];
  for (let j = 0; j <= rings; j++) {
    const ph = to - ((to - from) * j) / rings, row = [];
    for (let i = 0; i < seg; i++) {
      const th = (i / seg) * Math.PI * 2;
      const p = V(Math.cos(ph) * Math.sin(th) * rx, Math.sin(ph) * ry, Math.cos(ph) * Math.cos(th) * rz).add(c);
      row.push(pc.v(p, w, slot, col));
    }
    grid.push(row);
  }
  for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) {
    if (cut && cut((i + 0.5) / seg * Math.PI * 2, j / rings)) continue;
    const a = grid[j][i], b = grid[j][(i + 1) % seg], cc = grid[j + 1][(i + 1) % seg], d = grid[j + 1][i];
    pc.quad(a, b, cc, d, pc.at(a).sub(c));
  }
  return grid;
}
function disc(pc, w, c, rx, rz, y0, y1, slot, col, seg = 20, a0 = 0, a1 = Math.PI * 2, inner = 0) {
  const full = a1 - a0 >= Math.PI * 2 - 1e-6, n = full ? seg : seg + 1, top = [], bot = [], ti = [], bi = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + ((a1 - a0) * i) / seg, s = Math.sin(a), co = Math.cos(a);
    top.push(pc.v(V(c.x + s * rx, y1, c.z + co * rz), w, slot, col)); bot.push(pc.v(V(c.x + s * rx, y0, c.z + co * rz), w, slot, col));
    ti.push(pc.v(V(c.x + s * inner * rx, y1, c.z + co * inner * rz), w, slot, col)); bi.push(pc.v(V(c.x + s * inner * rx, y0, c.z + co * inner * rz), w, slot, col));
  }
  const m = full ? seg : seg;
  for (let i = 0; i < m; i++) {
    const j = full ? (i + 1) % seg : i + 1, a = a0 + ((a1 - a0) * (i + 0.5)) / seg;
    pc.quad(top[i], top[j], ti[j], ti[i], V(0, 1, 0)); pc.quad(bot[i], bot[j], bi[j], bi[i], V(0, -1, 0));
    pc.quad(top[i], top[j], bot[j], bot[i], V(Math.sin(a), 0, Math.cos(a)));
  }
}
const HATS = {
  // Peaked police cap (khaki or navy) with a dark peak.
  police: (K) => {
    const pc = new Piece(K.H), w = K.bone.head, r = K.headR(0.62, 1.05) + 0.05;
    disc(pc, w, V(0, 0, 0.01), r, r, 0.66, 0.98, SLOT.accA, 0, 24); disc(pc, w, V(0, 0, 0.01), r + 0.05, r + 0.05, 0.96, 1.06, SLOT.accA, 0, 24);
    disc(pc, w, V(0, 0, r * 0.42), r * 0.85, r * 0.85, 0.66, 0.7, SLOT.other, 0x15140f, 12, -1.1, 1.1); return pc;
  },
  // Motorbike helmet: open face.
  helmet: (K) => {
    const pc = new Piece(K.H), w = K.bone.head, r = K.headR(0.1, 1.0) + 0.07;
    dome(pc, w, V(0, 0.4, -0.02), r, 0.72, r * 1.02, SLOT.accA, 0, -0.38, Math.PI / 2, 22, 8, (a, f) => Math.cos(a) > 0.5 && f > 0.5);
    disc(pc, w, V(0, 0, r * 0.15), r * 0.92, r * 0.92, 0.7, 0.76, SLOT.other, 0x111111, 12, -0.85, 0.85); return pc;
  },
  // Construction hard hat with a brim and a ridge.
  hardhat: (K) => {
    const pc = new Piece(K.H), w = K.bone.head, r = K.headR(0.6, 1.05) + 0.06;
    dome(pc, w, V(0, 0.68, 0), r, 0.46, r * 1.03, SLOT.accA, 0, 0, Math.PI / 2, 22, 6);
    disc(pc, w, V(0, 0, 0.07), r + 0.08, r + 0.14, 0.66, 0.7, SLOT.accA, 0, 24); disc(pc, w, V(0, 0, 0), 0.07, r * 0.8, 1.08, 1.16, SLOT.accA, 0, 8); return pc;
  },
  // Gandhi topi: a white boat-shaped cap, pointed front and back.
  gandhi: (K) => {
    // Upright sides round the head, folded to a ridge on top; pointed at the front and back.
    const pc = new Piece(K.H), w = K.bone.head, col = 0xf4f2ea, n = 14, R = K.headR(0.7, 0.95) + 0.04, lowL = [], lowR = [], midL = [], midR = [], ridge = [];
    for (let k = 0; k <= n; k++) {
      const t = k / n, z = 0.78 - 1.56 * t, e = Math.max(0.02, 1 - Math.abs(t - 0.5) * 2);
      const hw = R * Math.pow(e, 0.3), y0 = 0.7 + 0.05 * (1 - e), y1 = 0.92 + 0.02 * e, y2 = 1.06 + 0.02 * e;
      lowL.push(pc.v(V(hw, y0, z), w, SLOT.other, col)); lowR.push(pc.v(V(-hw, y0, z), w, SLOT.other, col));
      midL.push(pc.v(V(hw * 0.97, y1, z), w, SLOT.other, col)); midR.push(pc.v(V(-hw * 0.97, y1, z), w, SLOT.other, col));
      ridge.push(pc.v(V(0, y2, z), w, SLOT.other, col));
    }
    for (let k = 0; k < n; k++) {
      pc.quad(lowL[k], lowL[k + 1], midL[k + 1], midL[k], V(1, 0, 0)); pc.quad(lowR[k], lowR[k + 1], midR[k + 1], midR[k], V(-1, 0, 0));
      pc.quad(midL[k], midL[k + 1], ridge[k + 1], ridge[k], V(1, 1.2, 0)); pc.quad(midR[k], midR[k + 1], ridge[k + 1], ridge[k], V(-1, 1.2, 0));
    }
    return pc;
  },
  // Safa / turban: wound layers and a knot at the front.
  turban: (K) => {
    const pc = new Piece(K.H), w = K.bone.head, r = K.headR(0.55, 1.05) + 0.06;
    for (let k = 0; k < 4; k++) disc(pc, w, V(0, 0, -0.02 + k * 0.01), r - k * 0.04, r + 0.02 - k * 0.04, 0.6 + k * 0.12, 0.74 + k * 0.12, SLOT.accA, 0, 22);
    dome(pc, w, V(0, 1.08, 0.02), r - 0.16, 0.14, r - 0.14, SLOT.accA, 0, 0, Math.PI / 2, 18, 4);
    blob(pc, V(0, 0.9, r + 0.02), V(0.12, 0.14, 0.07), w, SLOT.accA, 0);
    return pc;
  },
  // Baseball cap.
  cap: (K) => {
    const pc = new Piece(K.H), w = K.bone.head, r = K.headR(0.62, 1.05) + 0.04;
    dome(pc, w, V(0, 0.66, -0.02), r, 0.4, r * 1.02, SLOT.accA, 0, 0, Math.PI / 2, 20, 5);
    disc(pc, w, V(0, 0, r * 0.98), r * 0.75, r * 0.6, 0.68, 0.71, SLOT.accA, 0, 12, -1.3, 1.3); return pc;
  },
};

// ---------------------------------------------------------------- garments (rest space)
function sari(K) {
  // Pleats tucked in at the front, a border along the hem.
  return skirt(K, K.ankle + 0.03 * K.u, { seg: 40, rows: 8, flare: 0.17, border: 1, pleats: (a, f) => (Math.cos(a) > 0.82 ? 0.012 * Math.abs(Math.sin(a * 26)) * smooth(0.05, 0.3, f) : 0) });
}
function pallu(K) {
  // From the right hip across the chest, over the left shoulder and down the back.
  const u = K.u, w = K.waist, ch = K.ch, sh = K.sx * 0.62, top = K.p.Neck.y - 0.02 * u;
  const ctrl = [[-0.62 * K.wHalf, w + 0.03 * u, 'front'], [-0.25 * K.cHalf, (w + ch) / 2, 'front'], [0.25 * K.cHalf, ch + 0.02 * u, 'front'], [sh * 0.95, top - 0.05 * u, 'front'], [sh, 0, 'top', K.cz],
    [sh * 0.95, top - 0.07 * u, 'back'], [0.45 * K.cHalf, ch - 0.06 * u, 'back'], [0.5 * K.wHalf, w - 0.1 * u, 'back']];
  return ribbon(K, ctrl, (k, n) => 0.075 + 0.035 * Math.sin((k / (n - 1)) * Math.PI), (k, n) => (k >= n - 2 ? SLOT.accB : SLOT.pants), () => 0xffffff, null, 0.024, 4);
}
function dupatta(K) {
  // Over both shoulders: a U across the chest, the ends hanging down the back.
  const u = K.u, ch = K.ch, sh = K.sx * 0.64, top = K.p.Neck.y - 0.02 * u;
  const ctrl = [[0.55 * K.cHalf, K.waist - 0.08 * u, 'back'], [0.6 * K.cHalf, ch, 'back'], [sh, top - 0.06 * u, 'back'], [sh * 1.02, 0, 'top', K.cz],
    [sh * 0.9, top - 0.07 * u, 'front'], [0.35 * K.cHalf, ch - 0.02 * u, 'front'], [0, ch - 0.07 * u, 'front'], [-0.35 * K.cHalf, ch - 0.02 * u, 'front'], [-sh * 0.9, top - 0.07 * u, 'front'], [-sh * 1.02, 0, 'top', K.cz],
    [-sh, top - 0.06 * u, 'back'], [-0.6 * K.cHalf, ch, 'back'], [-0.55 * K.cHalf, K.waist - 0.08 * u, 'back']];
  return ribbon(K, ctrl, 0.06, () => SLOT.accA, () => 0xffffff, null, 0.03, 3);
}
function lanyard(K) {
  const u = K.u, n = K.p.Neck, ch = K.ch, nx = K.nHalf + 0.012 * u;
  const ctrl = [[0.18 * K.cHalf, ch - 0.07 * u, 'front'], [nx, n.y - 0.02 * u, 'front'], [nx, 0, 'top', n.z], [0, n.y + 0.02 * u, 'back'], [-nx, 0, 'top', n.z], [-nx, n.y - 0.02 * u, 'front'], [-0.18 * K.cHalf, ch - 0.07 * u, 'front']];
  const pc = ribbon(K, ctrl, 0.008, () => SLOT.accB, () => 0xffffff, null, 0.02, 3);
  // The ID card.
  const h = K.front(0, ch - 0.11 * u);
  if (h) {
    const c = h.p.addScaledVector(h.n, 0.02 * u), wts = K.spine(c.y), hw = 0.035 * u, hh = 0.05 * u, d = 0.005 * u;
    const corners = [[-hw, hh], [hw, hh], [hw, -hh], [-hw, -hh]].map(([x, y]) => [pc.v(c.clone().add(V(x, y, d)), wts, SLOT.other, y > 0 ? 0x1565c0 : 0xf4f4f2), pc.v(c.clone().add(V(x, y, -d)), wts, SLOT.other, 0xe8e8e6)]);
    pc.quad(corners[0][0], corners[1][0], corners[2][0], corners[3][0], V(0, 0, 1));
    pc.quad(corners[0][1], corners[1][1], corners[2][1], corners[3][1], V(0, 0, -1));
  }
  return pc;
}
function tie(K) {
  const u = K.u, ch = K.ch;
  const ctrl = [[0, K.p.Neck.y - 0.01 * u, 'front'], [0, ch, 'front'], [0, K.p.Abdomen.y + 0.04 * u, 'front']];
  return ribbon(K, ctrl, (k, n) => 0.016 + 0.016 * (k / (n - 1)), () => SLOT.accA, () => 0xffffff, null, 0.02, 4);
}
function schoolBag(K) {
  const pc = new Piece(), u = K.u, ch = K.ch;
  const h = K.back(0, ch - 0.06 * u);
  if (!h) return pc;
  const hw = 0.72 * K.cHalf, hh = 0.2 * u, hd = 0.07 * u;
  const c = h.p.clone().add(V(0, -0.04 * u, -hd - 0.02 * u));
  const wts = [[K.bone.torso, 0.8], [K.bone.abdomen, 0.2]];
  const v = (x, y, z) => pc.v(c.clone().add(V(x, y, z)), wts, SLOT.accB);
  const P = [v(-hw, -hh, -hd), v(hw, -hh, -hd), v(hw, hh, -hd), v(-hw, hh, -hd), v(-hw, -hh, hd), v(hw, -hh, hd), v(hw, hh, hd), v(-hw, hh, hd)];
  const f = (a, b, cc, d, n) => pc.quad(P[a], P[b], P[cc], P[d], n);
  f(0, 1, 2, 3, V(0, 0, -1)); f(5, 4, 7, 6, V(0, 0, 1)); f(4, 0, 3, 7, V(-1, 0, 0)); f(1, 5, 6, 2, V(1, 0, 0)); f(3, 2, 6, 7, V(0, 1, 0)); f(4, 5, 1, 0, V(0, -1, 0));
  // Straps over the shoulders.
  for (const sgn of [1, -1]) {
    const x = sgn * K.sx * 0.6;
    const strap = ribbon(K, [[x * 0.9, c.y + hh * 0.7, 'back'], [x, 0, 'top', K.cz], [x * 0.95, K.p.Neck.y - 0.1 * u, 'front'], [x * 1.05, ch - 0.1 * u, 'front']], 0.018, () => SLOT.accB, () => 0xffffff, null, 0.02, 3);
    merge(pc, strap);
  }
  return pc;
}
function nauvariTuck(K) {
  // The pleats gathered at the front waist, falling between the knees (both thighs).
  const pc = new Piece(), u = K.u, B = K.bone;
  const top = K.waist, bot = K.knee + 0.1 * u, rows = 4, cols = 6, grid = [];
  for (let j = 0; j <= rows; j++) {
    const f = j / rows, y = top + (bot - top) * f, row = [];
    for (let i = 0; i <= cols; i++) {
      const a = -0.35 + (0.7 * i) / cols;
      const r = Math.max(K.legR(a, y), K.legR(a, top)) + (0.025 + 0.04 * f) * u + 0.01 * u * Math.abs(Math.sin(i * 1.7));
      const lw = smooth(0, 0.6, f) * 0.9;
      row.push(pc.v(V(K.cx + Math.sin(a) * r, y, K.cz + Math.cos(a) * r), [[B.hips, 1 - lw], [B.thighL, lw / 2], [B.thighR, lw / 2]], j === rows ? SLOT.accB : SLOT.pants));
    }
    grid.push(row);
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) pc.quad(grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i], V(0, 0, 1));
  return pc.twoSided(0.006 * u);
}
function bat(K) {
  // Held in the right hand, the blade hanging below the fist (the pose turns it).
  const pc = new Piece(), u = K.u, f = K.p.FistR, e = K.p.FistR_end, w = K.bone.fistR;
  const along = e.clone().sub(f).normalize(), grip = f.clone().lerp(e, 0.45);
  const down = V(0, -1, 0), side = along.clone().cross(down).normalize();
  const dir = down.clone().multiplyScalar(0.94).addScaledVector(V(0, 0, 1), 0.34).normalize();
  const box = (c, ax, ay, az, hx, hy, hz, col) => {
    const P = [];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) P.push(pc.v(c.clone().addScaledVector(ax, sx * hx).addScaledVector(ay, sy * hy).addScaledVector(az, sz * hz), w, SLOT.other, col));
    const F = [[0, 1, 3, 2, ax.clone().negate()], [4, 6, 7, 5, ax], [0, 4, 5, 1, ay.clone().negate()], [2, 3, 7, 6, ay], [0, 2, 6, 4, az.clone().negate()], [1, 5, 7, 3, az]];
    for (const [a, b, c2, d, n] of F) pc.quad(P[a], P[b], P[c2], P[d], n);
  };
  const across = dir.clone().cross(side).normalize();
  box(grip.clone().addScaledVector(dir, 0.04 * u), side, dir, across, 0.016 * u, 0.12 * u, 0.016 * u, 0x1e1e1e);
  box(grip.clone().addScaledVector(dir, 0.43 * u), side, dir, across, 0.055 * u, 0.28 * u, 0.018 * u, 0xd9b77c);
  return pc;
}
function merge(a, b) {
  const off = a.p.length / 3;
  a.p.push(...b.p); a.w.push(...b.w); a.s.push(...b.s); a.c.push(...b.c);
  for (const i of b.i) a.i.push(i + off);
  return a;
}
function joined(...pieces) { const out = new Piece(pieces[0].space); for (const p of pieces) merge(out, p); return out; }

/**
 * Every wearable piece for one template, baked into bind space: { name → geometry }.
 * Names: hair:<style>, hairx:<extra>, moustache, beard1, beard2, bindi, glasses, shades,
 * hat:<kind>, sari, pallu, kurta, kurtaShort, lungi, lungiShort, skirt, dupatta, lanyard,
 * tie, bag, nauvari, bat.
 */
const HEAD_CACHE = new Map(); // head-space pieces per head shape (the pack shares one head)
export function buildWardrobe(mesh, female) {
  const probe = new Probe(mesh), K = body(probe), out = {};
  const add = (name, pc) => { try { const g = bake(pc, probe); if (g) out[name] = g; } catch (e) { console.warn(`wardrobe ${name}:`, e.message); } };
  const t = K.headTris, sig = `${K.bone.head}:${t.length}:${t[0]?.toFixed(4)}:${t[1]?.toFixed(4)}:${t[t.length - 1]?.toFixed(4)}`;
  let hc = HEAD_CACHE.get(sig);
  if (!hc) HEAD_CACHE.set(sig, (hc = new Map()));
  const head = (name, make) => { let pc = hc.get(name); if (!pc) hc.set(name, (pc = make())); pc.space = K.H; add(name, pc); };
  const men = ['short', 'slick', 'crop', 'curly', 'receding', 'bald'], women = ['back', 'long', 'bob', 'pony'];
  for (const h of female ? women.concat(['crop', 'short']) : men.concat(['back', 'bob', 'pony'])) head(`hair:${h}`, () => HAIR[h](K));
  head('hairx:bun', () => bun(K, false)); head('hairx:bunFlowers', () => bun(K, true)); head('hairx:pony', () => pony(K));
  add('hairx:plait', braid(K, 0, 1, 0.55, false, false)); add('hairx:plaitFlowers', braid(K, 0, 1, 0.55, false, true));
  add('hairx:twoPlaits', joined(braid(K, 0.34, 1, 0.3, true, false), braid(K, -0.34, -1, 0.3, true, false)));
  add('hairx:long', fall(K));
  if (!female) { head('moustache', () => moustache(K)); head('beard1', () => beard(K, false)); head('beard2', () => beard(K, true)); }
  head('bindi', () => bindi(K)); head('glasses', () => glasses(K, false)); head('shades', () => glasses(K, true));
  for (const h of Object.keys(HATS)) head(`hat:${h}`, () => HATS[h](K));
  const u = K.u;
  add('kurta', skirt(K, K.knee + 0.02 * u, { slot: SLOT.shirt, flare: 0.06, slit: K.waist - 0.22 * (K.waist - K.knee), legShare: 0.8, backShare: 0.15 }));
  add('kurtaShort', skirt(K, K.waist - 0.48 * (K.waist - K.knee), { slot: SLOT.shirt, flare: 0.04, slit: K.waist - 0.3 * (K.waist - K.knee), legShare: 0.75, backShare: 0.15 }));
  add('lungi', skirt(K, K.ankle + 0.06 * u, { slot: SLOT.accA, flare: 0.05, ease: 0.03, border: 1, pleats: (a) => (Math.abs(a - 0.5) < 0.12 ? 0.012 : 0) }));
  add('lungiShort', skirt(K, K.knee - 0.02 * u, { slot: SLOT.accA, flare: 0.05, ease: 0.04, border: 1, rows: 5, pleats: (a) => (Math.abs(a - 0.5) < 0.12 ? 0.012 : 0) }));
  add('skirt', skirt(K, K.knee - 0.04 * u, { slot: SLOT.pants, flare: 0.1, ease: 0.04, rows: 5, seg: 36, pleats: (a) => 0.012 * Math.abs(Math.sin(a * 18)) }));
  add('sari', sari(K)); add('pallu', pallu(K)); add('dupatta', dupatta(K)); add('lanyard', lanyard(K)); add('tie', tie(K)); add('bag', schoolBag(K));
  add('nauvari', nauvariTuck(K)); add('bat', bat(K));
  return out;
}
