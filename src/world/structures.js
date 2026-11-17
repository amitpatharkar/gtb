// Walkable structures above the street: railway platforms, footbridges, stairs, metro
// concourses and viaduct platforms. The map tiles describe one ground height per point;
// these add floors at other heights, so the same spot can have a platform at 1.3 m and a
// footbridge deck at 8 m above it, and the walker is on whichever one they climbed to.
//
// Five kinds of piece, all in world metres:
//   floor  a polygon at height y (platform tops, bridge decks, concourse floors)
//   ramp   a strip whose height runs from y0 to y1 along its length (stairs, end ramps)
//   wall   a vertical slab between heights y0 and y1 (platform faces, railings, booth walls)
//   post   a vertical cylinder between heights y0 and y1 (columns)
//   grid   a walk grid made from a model (scripts/art-station.mjs): per cell the floor heights
//          and the height spans of solid parts, placed at a spot facing a direction
// Pieces belong to an owner (a station) and are added and dropped with it. They are kept in
// a grid of 16 m cells; queries look at one or a few cells and allocate nothing.
//
// Heights: a body standing at y fills y + STEP … y + HEAD. A wall stops it only if it
// reaches into that span, so a platform's 1.3 m face stops someone on the track bed but not
// someone standing on top of it, and a railing at deck height stops nobody on the platform
// underneath. Floors count if their top is no higher than y + STEP (you step up onto a
// kerb-high edge, not a waist-high one); the highest such floor is the one you stand on.

const CELL = 16, STEP = 0.55, HEAD = 1.75;
const key = (gx, gz) => (gx + 32768) * 65536 + gz + 32768;

export class Structures {
  constructor() {
    this.grid = new Map();   // cell key → pieces
    this.owners = new Map(); // owner → { pieces, cells }
    this.version = 0;        // bumps when pieces come or go
  }

  /** Remove every piece of an owner. */
  remove(owner) {
    const o = this.owners.get(owner);
    if (!o) return;
    for (const k of o.cells) {
      const list = this.grid.get(k);
      if (!list) continue;
      let j = 0;
      for (let i = 0; i < list.length; i++) if (list[i].owner !== owner) list[j++] = list[i];
      list.length = j;
      if (!j) this.grid.delete(k);
    }
    this.owners.delete(owner);
    this.version++;
  }

  has(owner) { return this.owners.has(owner); }

  /** Add pieces for an owner: an array of objects made with the helpers below. */
  add(owner, pieces) {
    let o = this.owners.get(owner);
    if (!o) this.owners.set(owner, o = { pieces: [], cells: new Set() });
    for (const p of pieces) {
      p.owner = owner;
      o.pieces.push(p);
      for (let gx = Math.floor(p.x0 / CELL); gx <= Math.floor(p.x1 / CELL); gx++)
        for (let gz = Math.floor(p.z0 / CELL); gz <= Math.floor(p.z1 / CELL); gz++) {
          const k = key(gx, gz);
          let list = this.grid.get(k);
          if (!list) this.grid.set(k, list = []);
          list.push(p);
          o.cells.add(k);
        }
    }
    this.version++;
  }

  /**
   * Height of the floor under (x, z) for someone whose feet are at y (or the street level
   * `base` if nothing higher is in reach). With y undefined: the lowest structure floor, if
   * any, is ignored and `base` is returned (vehicles and the street stay on the ground).
   */
  groundHeight(x, z, y, base) {
    if (y === undefined) return base;
    const list = this.grid.get(key(Math.floor(x / CELL), Math.floor(z / CELL)));
    if (!list) return base;
    let best = base;
    const reach = y + STEP;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (x < p.x0 || x > p.x1 || z < p.z0 || z > p.z1) continue;
      let h;
      if (p.kind === 0) {
        if (p.y > reach || p.y <= best || !inRing(x, z, p.ring)) continue;
        h = p.y;
      } else if (p.kind === 1) {
        const dx = x - p.ax, dz = z - p.az, al = dx * p.ux + dz * p.uz;
        if (al < 0 || al > p.len || Math.abs(dx * p.uz - dz * p.ux) > p.hw) continue;
        h = p.y0 + (p.y1 - p.y0) * (al / p.len);
        if (h > reach || h <= best) continue;
      } else if (p.kind === 4) {
        const W = p.W, e = gridCell(p, x, z);
        if (e < 0) continue;
        h = -Infinity;
        for (let q = W.fOff[e], q1 = W.fOff[e + 1]; q < q1; q++) { const f = W.fl[q]; if (f > reach) break; h = f; }
        if (h <= best) continue;
      } else continue;
      best = h;
    }
    return best;
  }

  /** The floor (piece) a point at height y stands on, or null (for "am I on platform 3?"). */
  floorAt(x, z, y) {
    const list = this.grid.get(key(Math.floor(x / CELL), Math.floor(z / CELL)));
    if (!list) return null;
    let best = null, bh = -Infinity;
    for (const p of list) {
      if (p.kind !== 0 || x < p.x0 || x > p.x1 || z < p.z0 || z > p.z1) continue;
      if (p.y > y + STEP || p.y < y - 0.8 || p.y <= bh || !inRing(x, z, p.ring)) continue;
      best = p; bh = p.y;
    }
    return best;
  }

  /** Does a body of radius r with feet at y touch a wall or post? (y undefined = street level.) */
  hits(x, z, r, y = 0.2) {
    const lo = y + STEP, hi = y + HEAD;
    const g0x = Math.floor((x - r) / CELL), g1x = Math.floor((x + r) / CELL), g0z = Math.floor((z - r) / CELL), g1z = Math.floor((z + r) / CELL);
    for (let gx = g0x; gx <= g1x; gx++) for (let gz = g0z; gz <= g1z; gz++) {
      const list = this.grid.get(key(gx, gz));
      if (!list) continue;
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        if (p.kind < 2 || p.y1 <= lo || p.y0 >= hi || x + r < p.x0 || x - r > p.x1 || z + r < p.z0 || z - r > p.z1) continue;
        if (p.pass && p.pass()) continue; // a fare gate that is open for this traveller
        if (p.kind === 4) { if (gridHits(p, x, z, r, lo, hi)) return true; continue; }
        if (p.kind === 2) {
          const dx = p.bx - p.ax, dz = p.bz - p.az, l2 = dx * dx + dz * dz || 1;
          const t = Math.max(0, Math.min(1, ((x - p.ax) * dx + (z - p.az) * dz) / l2)), ex = x - p.ax - dx * t, ez = z - p.az - dz * t;
          if (ex * ex + ez * ez < (r + p.t) * (r + p.t)) return true;
        } else if ((x - p.x) * (x - p.x) + (z - p.z) * (z - p.z) < (r + p.r) * (r + p.r)) return true;
      }
    }
    return false;
  }
}

/** Table entry of the walk-grid cell under (x, z), or -1 outside the grid. */
function gridCell(p, x, z) {
  const W = p.W, dx = x - p.ox, dz = z - p.oz, a = dx * p.ux + dz * p.uz, t = (dz * p.ux - dx * p.uz) / p.k;
  const i = Math.floor((a - W.a0) / W.G), j = Math.floor((t - W.t0) / W.G);
  return i < 0 || j < 0 || i >= W.nx || j >= W.nz ? -1 : W.cell[j * W.nx + i];
}

/** Does a body of radius r spanning heights lo…hi touch a solid cell of a walk grid? */
function gridHits(p, x, z, r, lo, hi) {
  const W = p.W, dx = x - p.ox, dz = z - p.oz, a = dx * p.ux + dz * p.uz, t = (dz * p.ux - dx * p.uz) / p.k, rt = r / p.k;
  const i0 = Math.max(0, Math.floor((a - r - W.a0) / W.G)), i1 = Math.min(W.nx - 1, Math.floor((a + r - W.a0) / W.G));
  const j0 = Math.max(0, Math.floor((t - rt - W.t0) / W.G)), j1 = Math.min(W.nz - 1, Math.floor((t + rt - W.t0) / W.G));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const e = W.cell[j * W.nx + i];
    for (let q = W.sOff[e], q1 = W.sOff[e + 1]; q < q1; q += 2) if (W.sp[q] < hi && W.sp[q + 1] > lo) return true;
  }
  return false;
}

/** Point in polygon (flat array x0, z0, x1, z1 …). */
function inRing(x, z, r) {
  let inside = false;
  for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
    const xi = r[i], zi = r[i + 1], xj = r[j], zj = r[j + 1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

// ---------------------------------------------------------------- piece helpers

/** A floor: ring [[x, z], …] or a flat array, top at y. */
export function floor(ring, y) {
  const r = Array.isArray(ring[0]) ? ring.flat() : ring;
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < r.length; i += 2) { x0 = Math.min(x0, r[i]); x1 = Math.max(x1, r[i]); z0 = Math.min(z0, r[i + 1]); z1 = Math.max(z1, r[i + 1]); }
  return { kind: 0, ring: Float64Array.from(r), y, x0, z0, x1, z1 };
}

/** A ramp (stairs): from (ax, az) along unit (ux, uz) for len metres, half width hw, height y0 → y1. */
export function ramp(ax, az, ux, uz, len, hw, y0, y1) {
  const bx = ax + ux * len, bz = az + uz * len, px = uz * hw, pz = -ux * hw;
  return {
    kind: 1, ax, az, ux, uz, len, hw, y0, y1,
    x0: Math.min(ax, bx) - Math.abs(px), x1: Math.max(ax, bx) + Math.abs(px), z0: Math.min(az, bz) - Math.abs(pz), z1: Math.max(az, bz) + Math.abs(pz),
  };
}

/** A wall from (ax, az) to (bx, bz), half thickness t, from height y0 to y1. */
export function wall(ax, az, bx, bz, t, y0, y1) {
  return { kind: 2, ax, az, bx, bz, t, y0, y1, x0: Math.min(ax, bx) - t, x1: Math.max(ax, bx) + t, z0: Math.min(az, bz) - t, z1: Math.max(az, bz) + t };
}

/** A post (column) at (x, z), radius r, from height y0 to y1. */
export function post(x, z, r, y0, y1) {
  return { kind: 3, x, z, r, y0, y1, x0: x - r, x1: x + r, z0: z - r, z1: z + r };
}

/**
 * A walk grid placed at (ox, oz), its a axis along (ux, uz), the across axis (t, toward
 * (-uz, ux)) stretched by k. W comes from readWalkGrid().
 */
export function grid(W, ox, oz, ux, uz, k = 1) {
  const p = { kind: 4, W, ox, oz, ux, uz, k, y0: -3, y1: 30, x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity };
  for (const a of [W.a0, W.a0 + W.nx * W.G]) for (const t of [W.t0, W.t0 + W.nz * W.G]) {
    const x = ox + ux * a - uz * t * k, z = oz + uz * a + ux * t * k;
    p.x0 = Math.min(p.x0, x); p.x1 = Math.max(p.x1, x); p.z0 = Math.min(p.z0, z); p.z1 = Math.max(p.z1, z);
  }
  return p;
}

/** Decode a walk grid file (format in scripts/art-station.mjs). */
export function readWalkGrid(buf) {
  const v = new DataView(buf instanceof ArrayBuffer ? buf : buf.buffer, buf.byteOffset || 0, buf.byteLength);
  if (v.getUint32(0, true) !== 0x57425447) throw new Error('not a walk grid'); // 'GTBW'
  let o = 8;
  const nx = v.getUint32(o, true), nz = v.getUint32(o + 4, true), a0 = v.getFloat32(o + 8, true), t0 = v.getFloat32(o + 12, true), G = v.getFloat32(o + 16, true), n = v.getUint32(o + 20, true);
  o += 24;
  const fOff = new Uint32Array(n + 1), sOff = new Uint32Array(n + 1), fl = [], sp = [];
  for (let e = 0; e < n; e++) {
    const nf = v.getUint8(o), ns = v.getUint8(o + 1);
    o += 2;
    fOff[e] = fl.length; sOff[e] = sp.length;
    for (let q = 0; q < nf; q++, o += 2) fl.push(v.getInt16(o, true) / 100);
    for (let q = 0; q < ns * 2; q++, o += 2) sp.push(v.getInt16(o, true) / 100);
  }
  fOff[n] = fl.length; sOff[n] = sp.length;
  const cell = new Uint16Array(nx * nz);
  for (let k = 0; k < nx * nz && o < v.byteLength; o += 4) { const len = v.getUint16(o, true), id = v.getUint16(o + 2, true); cell.fill(id, k, k + len); k += len; }
  return { nx, nz, a0, t0, G, cell, fOff, fl: Float32Array.from(fl), sOff, sp: Float32Array.from(sp) };
}
