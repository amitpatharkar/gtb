// Geometry helpers for the tile worker: a growable mesh builder plus walls, flat
// polygons and ribbons. Everything is tile-local (metres from the tile centre).
import earcut from 'earcut';

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
/** sRGB hex → linear RGB bytes (vertex colours are linear in three.js). */
export const linear = (hex, k = 1) => [
  Math.min(255, Math.round(srgbToLinear(((hex >> 16) & 255) / 255) * k * 255)),
  Math.min(255, Math.round(srgbToLinear(((hex >> 8) & 255) / 255) * k * 255)),
  Math.min(255, Math.round(srgbToLinear((hex & 255) / 255) * k * 255)),
];
export const WHITE = [255, 255, 255];

/** Deterministic 0..1 hash of two integers. */
export const rand = (a, b) => {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be59b, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
};

export class MeshBuilder {
  /** extra: number of floats in an optional per-vertex "facade" attribute (0 = none). */
  constructor(extra = 0) {
    this.p = []; this.n = []; this.uv = []; this.c = []; this.i = []; this.x = []; this.count = 0; this.extra = extra;
    this.cur = new Array(extra).fill(0);
  }
  v(x, y, z, nx, ny, nz, u, w, col) {
    this.p.push(x, y, z); this.n.push(nx, ny, nz); this.uv.push(u, w);
    this.c.push(col[0], col[1], col[2]);
    for (let k = 0; k < this.extra; k++) this.x.push(this.cur[k]);
    return this.count++;
  }
  /** Triangle forced to face upwards (+y). */
  triUp(a, b, c) {
    const p = this.p;
    const ax = p[a * 3], az = p[a * 3 + 2];
    const cross = (p[b * 3 + 2] - az) * (p[c * 3] - ax) - (p[b * 3] - ax) * (p[c * 3 + 2] - az);
    if (cross >= 0) this.i.push(a, b, c); else this.i.push(a, c, b);
  }
  tri(a, b, c) { this.i.push(a, b, c); }
  finish(transfer) {
    if (!this.count) return null;
    const out = {
      position: new Float32Array(this.p),
      normal: new Float32Array(this.n),
      uv: new Float32Array(this.uv),
      color: new Uint8Array(this.c),
      index: this.count > 65535 ? new Uint32Array(this.i) : new Uint16Array(this.i),
    };
    if (this.extra) out.facade = new Float32Array(this.x);
    for (const k in out) transfer.push(out[k].buffer);
    return out;
  }
}

/** Vertical quad from a to b, facing (nx, nz). */
export function wall(m, ax, az, bx, bz, y0, y1, nx, nz, u0, u1, v0, v1, colBottom, colTop = colBottom) {
  const a0 = m.v(ax, y0, az, nx, 0, nz, u0, v0, colBottom);
  const b0 = m.v(bx, y0, bz, nx, 0, nz, u1, v0, colBottom);
  const b1 = m.v(bx, y1, bz, nx, 0, nz, u1, v1, colTop);
  const a1 = m.v(ax, y1, az, nx, 0, nz, u0, v1, colTop);
  if ((bz - az) * nx - (bx - ax) * nz >= 0) { m.tri(a0, b1, b0); m.tri(a0, a1, b1); }
  else { m.tri(a0, b0, b1); m.tri(a0, b1, a1); }
}

/** Flat polygon (outer + holes) at height y; UVs are metres (ox, oz = tile centre in UV space, see tileWorker.js). */
export function flatPolygon(m, rings, y, col, ox, oz, down = false) {
  const flat = [], holes = [];
  for (let r = 0; r < rings.length; r++) {
    if (r) holes.push(flat.length / 2);
    for (let i = 0; i < rings[r].length; i++) flat.push(rings[r][i]);
  }
  const tris = earcut(flat, holes);
  const base = m.count;
  for (let i = 0; i < flat.length; i += 2) m.v(flat[i], y, flat[i + 1], 0, down ? -1 : 1, 0, flat[i] + ox, flat[i + 1] + oz, col);
  // down: the underside of a canopy, facing the ground (seen from below).
  for (let i = 0; i < tris.length; i += 3) {
    m.triUp(base + tris[i], base + tris[i + 1], base + tris[i + 2]);
    if (down) { const I = m.i, k = I.length; [I[k - 2], I[k - 1]] = [I[k - 1], I[k - 2]]; }
  }
  return tris.length / 3;
}

/**
 * Ribbon along a polyline between lateral offsets left/right (metres, + = left of travel),
 * mitred joins. uvMode 'world' = metres in UV space (tile-local + ox/oz), otherwise u across (0..1) and v along (metres × vScale).
 */
export function ribbon(m, line, left, right, y, col, { vScale = 1, uvMode = 'along', ox = 0, oz = 0 } = {}) {
  const n = line.length / 2;
  if (n < 2) return;
  let dist = 0, prev = -1;
  const seg = (j) => {
    const dx = line[j * 2 + 2] - line[j * 2], dz = line[j * 2 + 3] - line[j * 2 + 1];
    const len = Math.hypot(dx, dz) || 1;
    return [-dz / len, dx / len];
  };
  for (let i = 0; i < n; i++) {
    const x = line[i * 2], z = line[i * 2 + 1];
    let px, pz, k = 1;
    if (i === 0) [px, pz] = seg(0);
    else if (i === n - 1) [px, pz] = seg(n - 2);
    else {
      const [ax, az] = seg(i - 1), [bx, bz] = seg(i);
      px = ax + bx; pz = az + bz;
      const len = Math.hypot(px, pz);
      if (len < 1e-3) { px = ax; pz = az; } else { px /= len; pz /= len; }
      k = 1 / Math.max(0.5, px * ax + pz * az);
    }
    if (i > 0) dist += Math.hypot(x - line[i * 2 - 2], z - line[i * 2 - 1]);
    const lx = x + px * left * k, lz = z + pz * left * k, rx = x + px * right * k, rz = z + pz * right * k;
    let l;
    if (uvMode === 'world') {
      l = m.v(lx, y, lz, 0, 1, 0, lx + ox, lz + oz, col);
      m.v(rx, y, rz, 0, 1, 0, rx + ox, rz + oz, col);
    } else {
      l = m.v(lx, y, lz, 0, 1, 0, 0, dist * vScale, col);
      m.v(rx, y, rz, 0, 1, 0, 1, dist * vScale, col);
    }
    if (prev >= 0) { m.triUp(prev, prev + 1, l); m.triUp(prev + 1, l + 1, l); }
    prev = l;
  }
}

export const signedArea = (r) => {
  let a = 0;
  for (let i = 0, n = r.length / 2, j = n - 1; i < n; j = i++) a += r[j * 2] * r[i * 2 + 1] - r[i * 2] * r[j * 2 + 1];
  return a / 2;
};
export function pointInRing(x, z, r) {
  let inside = false;
  for (let i = 0, n = r.length / 2, j = n - 1; i < n; j = i++) {
    const xi = r[i * 2], zi = r[i * 2 + 1], xj = r[j * 2], zj = r[j * 2 + 1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
export const inPolygon = (x, z, rings) => rings.reduce((inside, r) => (pointInRing(x, z, r) ? !inside : inside), false);
