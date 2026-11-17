// An uploaded elevated metro station model (public/art/stations/<id>.glb) → the game's station
// shell and its walk grid. Called by scripts/art-index.mjs; the game places the shell at every
// elevated metro station whose two tracks run straight through it (src/world/metro.js).
//
// The shell: ground, footpaths and the approach viaducts cut off, moved into the station frame
// (a along the tracks, t across, metres, y = height in the game: platform 13.6, concourse 7.6),
// one flat colour per face from what it is (platform granite, concourse floor, track bed,
// soffits, white walls and fins), the roof a separate primitive; meshopt-compressed.
//
// The walk grid (<id>.walk.bin): cells of G metres over the station; per cell the heights of the
// floors in it (anything facing up: platforms, concourse, stair treads, escalators, landings)
// and the height spans of everything solid (walls, fins, railings, columns, stair undersides),
// so the walker climbs exactly the stairs that are drawn and stops at exactly the walls that
// are drawn (structures.js, kind 4). Cells repeat a lot: a table of distinct cells + run lengths.
//   header: 'GTBW' u32 version, nx, nz (u32), a0, t0, G (f32), table count (u32)
//   table:  per entry u8 floors, u8 spans, then i16 floor heights (cm), then i16 span lo/hi (cm)
//   cells:  runs (u16 length, u16 table index), row by row (t outer, a inner)
import { readGlb, readAccessor, identity, mul, nodeMatrix, det3 } from './lib/glb.mjs';
import { Writer } from './people/glbwriter.mjs';
import { MeshoptEncoder } from 'meshoptimizer';

/**
 * Where the station is in each uploaded file (measured once with cross-sections of the model,
 * in the file's units × scale): the body's ends along x, the middle between the two tracks
 * (z), how far apart the tracks are, and the height shift that puts its platform at 13.6 m.
 */
export const STATION_FITS = {
  'elevated-metro-station': {
    scale: 0.001, x0: 10.4, x1: 195.4, zc: -36.875, sep: 4.55, dy: -0.3,
    platforms: [[-10.225, -3.8], [3.75, 10.275]], concourse: [-10.225, 10.275], ground: 0.55,
  },
};

const G = 0.25, STEP_CM = 5;

export async function buildStation(buf, id) {
  const fit = STATION_FITS[id];
  if (!fit) throw new Error(`no fit for ${id} (add it to STATION_FITS in scripts/art-station.mjs)`);
  const { json, bin } = readGlb(buf);
  if ((json.extensionsRequired || []).length) throw new Error('compressed GLB');
  const xc = (fit.x0 + fit.x1) / 2, half = (fit.x1 - fit.x0) / 2;
  // Every triangle in the file's world space, then into the station frame.
  const tris = []; // [ax, ay, at, bx…] per triangle + roof flag
  const walk = (ni, parent) => {
    const node = json.nodes[ni], m = mul(parent, nodeMatrix(node));
    if (node.mesh !== undefined) for (const p of json.meshes[node.mesh].primitives) {
      if (p.mode !== undefined && p.mode !== 4) continue;
      const pos = readAccessor(json, bin, p.attributes.POSITION, { float: true }).arr;
      const n = pos.length / 3, idx = p.indices !== undefined ? readAccessor(json, bin, p.indices).arr : Uint32Array.from({ length: n }, (_, i) => i);
      const mat = json.materials?.[p.material]?.name || '';
      const roof = /gold/i.test(mat);
      const W = new Float64Array(n * 3);
      for (let i = 0; i < n; i++) {
        const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
        const wx = (m[0] * x + m[4] * y + m[8] * z + m[12]) * fit.scale, wy = (m[1] * x + m[5] * y + m[9] * z + m[13]) * fit.scale, wz = (m[2] * x + m[6] * y + m[10] * z + m[14]) * fit.scale;
        W[i * 3] = wx - xc; W[i * 3 + 1] = wy; W[i * 3 + 2] = wz - fit.zc;
      }
      const flip = det3(m) < 0;
      for (let i = 0; i < idx.length; i += 3) {
        const a = idx[i], b = flip ? idx[i + 2] : idx[i + 1], c = flip ? idx[i + 1] : idx[i + 2];
        const ys = [W[a * 3 + 1], W[b * 3 + 1], W[c * 3 + 1]];
        // Ground and footpath slabs go (the game has its own streets); so do the approach viaducts.
        if (Math.max(...ys) <= fit.ground) continue;
        // Long pieces (track beds, parapets) run on along the approach viaducts: cut them at the
        // station's ends (the game's own viaduct carries on); street stairs may reach a few metres out.
        const lim = Math.min(...ys) > 9 ? half + 0.3 : half + 6;
        for (const poly of clip([a, b, c].map((k) => [W[k * 3], W[k * 3 + 1] + fit.dy, W[k * 3 + 2]]), lim))
          for (let q = 1; q + 1 < poly.length; q++) tris.push({ v: [...poly[0], ...poly[q], ...poly[q + 1]], roof });
      }
    }
    for (const c of node.children || []) walk(c, m);
  };
  for (const r of json.scenes[json.scene || 0].nodes) walk(r, identity());

  // ---- the shell
  const colour = (t) => {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = t.v;
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    t.n = [nx, ny, nz];
    t.area = l / 2;
    const y = (ay + by + cy) / 3;
    if (t.roof) return ny > 0 ? 0x8e989f : 0xc9ccce;                       // sheet roof: grey top, light underside
    if (ny > 0.7) {
      if (Math.abs(y - 13.6) < 0.08) return 0xc9c2b6;                         // platform granite (the yellow edge line is drawn by the game)
      if (Math.abs(y - 7.6) < 0.08) return 0xd3cdc1;                          // concourse floor
      if (y > 11.5 && y < 12.3) return 0x6f6b66;                              // track bed
      if (y > 17) return 0xe2e0dc;                                            // fin and beam tops
      return 0xb8b1a5;                                                        // treads, landings
    }
    if (ny < -0.7) return 0xbab5ac;                                           // soffits
    if (y < 6.4) return 0xd6d1c8;                                             // columns, stair walls
    return 0xeceae5;                                                          // walls, fins, railings
  };
  const groups = { body: { P: [], N: [], C: [], key: new Map(), I: [] }, roof: { P: [], N: [], C: [], key: new Map(), I: [] } };
  for (const t of tris) {
    const col = colour(t), g = groups[t.roof ? 'roof' : 'body'];
    const r = ((col >> 16) & 255) / 255, gg = ((col >> 8) & 255) / 255, b = (col & 255) / 255;
    for (let k = 0; k < 3; k++) {
      const x = t.v[k * 3], y = t.v[k * 3 + 1], z = t.v[k * 3 + 2];
      const key = `${Math.round(x * 500)},${Math.round(y * 500)},${Math.round(z * 500)},${Math.round(t.n[0] * 60)},${Math.round(t.n[1] * 60)},${Math.round(t.n[2] * 60)},${col}`;
      let vi = g.key.get(key);
      if (vi === undefined) { vi = g.P.length / 3; g.key.set(key, vi); g.P.push(x, y, z); g.N.push(...t.n); g.C.push(r, gg, b); }
      g.I.push(vi);
    }
  }
  await MeshoptEncoder.ready;
  const w = new Writer(), meshes = [], nodes = [];
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const g of Object.values(groups)) for (let i = 0; i < g.P.length; i++) { lo[i % 3] = Math.min(lo[i % 3], g.P[i]); hi[i % 3] = Math.max(hi[i % 3], g.P[i]); }
  const mid = lo.map((v, i) => (v + hi[i]) / 2), ext = lo.map((v, i) => Math.max(0.01, (hi[i] - v) / 2));
  for (const [name, g] of Object.entries(groups)) {
    if (!g.I.length) continue;
    const Q = g.P.map((v, i) => (v - mid[i % 3]) / ext[i % 3]);
    const attributes = { POSITION: w.q(Q, 3, 'i16', { minMax: true }), NORMAL: w.q(g.N, 3, 'i8'), COLOR_0: w.q(g.C, 3, 'u8') };
    meshes.push({ name, primitives: [{ attributes, indices: w.indices(g.I, g.P.length / 3), material: 0 }] });
    nodes.push({ name, mesh: meshes.length - 1, translation: mid, scale: ext });
  }
  const glb = w.glb({
    asset: { version: '2.0', generator: 'gtb art-station', extras: { note: 'Adapted from a CC BY-SA 4.0 model; this file is CC BY-SA 4.0 too (public/art/CREDITS.md).' } },
    extensionsUsed: ['EXT_meshopt_compression', 'KHR_mesh_quantization'], extensionsRequired: ['EXT_meshopt_compression', 'KHR_mesh_quantization'],
    scene: 0, scenes: [{ nodes: nodes.map((_, i) => i) }], nodes, meshes,
    materials: [{ name: 'station', pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.8 } }],
  });

  // ---- the walk grid
  let a0 = Infinity, a1 = -Infinity, t0 = Infinity, t1 = -Infinity;
  for (const t of tris) for (let k = 0; k < 3; k++) { a0 = Math.min(a0, t.v[k * 3]); a1 = Math.max(a1, t.v[k * 3]); t0 = Math.min(t0, t.v[k * 3 + 2]); t1 = Math.max(t1, t.v[k * 3 + 2]); }
  a0 = Math.floor(a0) - 1; t0 = Math.floor(t0) - 1;
  const nx = Math.ceil((a1 + 1 - a0) / G), nz = Math.ceil((t1 + 1 - t0) / G);
  const floors = new Map();           // cell → Set of heights (cm)
  const BINS = 280, B0 = -2;          // solid spans: 0.1 m bins from -2 m to 26 m
  const solid = new Uint8Array(nx * nz * Math.ceil(BINS / 8));
  const BW = Math.ceil(BINS / 8);
  const mark = (x, y, z) => {
    const i = Math.floor((x - a0) / G), j = Math.floor((z - t0) / G), b = Math.floor((y - B0) * 10);
    if (i < 0 || j < 0 || i >= nx || j >= nz || b < 0 || b >= BINS) return;
    solid[(j * nx + i) * BW + (b >> 3)] |= 1 << (b & 7);
  };
  for (const t of tris) {
    if (t.roof) continue;
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = t.v;
    if (t.n[1] > 0.5) {
      // Floors: the height at each cell centre inside the triangle.
      const i0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) - a0) / G)), i1 = Math.min(nx - 1, Math.floor((Math.max(ax, bx, cx) - a0) / G));
      const j0 = Math.max(0, Math.floor((Math.min(az, bz, cz) - t0) / G)), j1 = Math.min(nz - 1, Math.floor((Math.max(az, bz, cz) - t0) / G));
      const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(d) < 1e-9) continue;
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const px = a0 + (i + 0.5) * G, pz = t0 + (j + 0.5) * G;
        const l1 = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) / d, l2 = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) / d, l3 = 1 - l1 - l2;
        if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
        const y = l1 * ay + l2 * by + l3 * cy;
        if (y < 0.2 || y > 16) continue;
        const k = j * nx + i;
        let s = floors.get(k);
        if (!s) floors.set(k, s = new Set());
        s.add(Math.round((y * 100) / STEP_CM) * STEP_CM);
      }
      continue;
    }
    // Solids: points over the triangle every ≤ 0.08 m.
    const lab = Math.hypot(bx - ax, by - ay, bz - az), lac = Math.hypot(cx - ax, cy - ay, cz - az);
    const nu = Math.max(1, Math.ceil(lab / 0.08)), nv = Math.max(1, Math.ceil(lac / 0.08));
    for (let u = 0; u <= nu; u++) for (let v = 0; v <= nv - (u * nv) / nu + 1e-9; v++) {
      const fu = u / nu, fv = v / nv;
      if (fu + fv > 1 + 1e-9) continue;
      mark(ax + (bx - ax) * fu + (cx - ax) * fv, ay + (by - ay) * fu + (cy - ay) * fv, az + (bz - az) * fu + (cz - az) * fv);
    }
  }
  // Distinct cells and runs.
  const table = new Map(), entries = [], runs = [];
  let last = -1, len = 0;
  for (let k = 0; k < nx * nz; k++) {
    const fl = floors.get(k) ? [...floors.get(k)].sort((p, q) => p - q) : [];
    // Merge floors closer than 6 cm (two faces of one slab).
    const f2 = []; for (const h of fl) if (!f2.length || h - f2[f2.length - 1] > 6) f2.push(h); else f2[f2.length - 1] = Math.max(f2[f2.length - 1], h);
    const sp = [];
    let open = -1;
    for (let b = 0; b <= BINS; b++) {
      const on = b < BINS && (solid[k * BW + (b >> 3)] >> (b & 7)) & 1;
      if (on && open < 0) open = b;
      if (!on && open >= 0) { const lo2 = Math.round((B0 + open / 10) * 100), hi2 = Math.round((B0 + b / 10) * 100); if (sp.length && lo2 - sp[sp.length - 1][1] <= 20) sp[sp.length - 1][1] = hi2; else sp.push([lo2, hi2]); open = -1; }
    }
    const key = `${f2.join(',')}|${sp.map((s) => s.join(':')).join(',')}`;
    let id = table.get(key);
    if (id === undefined) { id = entries.length; table.set(key, id); entries.push([f2, sp]); }
    if (id === last && len < 65535) len++;
    else { if (len) runs.push(len, last); last = id; len = 1; }
  }
  if (len) runs.push(len, last);
  if (entries.length > 65535) throw new Error('walk grid: too many distinct cells');
  let size = 32;
  for (const [f, s] of entries) size += 2 + f.length * 2 + s.length * 4;
  size += runs.length * 2;
  const out = Buffer.alloc(size);
  let o = 0;
  out.write('GTBW', 0); o = 4;
  out.writeUInt32LE(1, o); o += 4; out.writeUInt32LE(nx, o); o += 4; out.writeUInt32LE(nz, o); o += 4;
  out.writeFloatLE(a0, o); o += 4; out.writeFloatLE(t0, o); o += 4; out.writeFloatLE(G, o); o += 4; out.writeUInt32LE(entries.length, o); o += 4;
  for (const [f, s] of entries) {
    out.writeUInt8(f.length, o++); out.writeUInt8(s.length, o++);
    for (const h of f) { out.writeInt16LE(h, o); o += 2; }
    for (const [l, h] of s) { out.writeInt16LE(l, o); o += 2; out.writeInt16LE(h, o); o += 2; }
  }
  for (const r of runs) { out.writeUInt16LE(r, o); o += 2; }
  const reach = connected(nx, nz, entries, runs, G, t0);
  return {
    glb, walk: out, reach,
    info: { half, sep: fit.sep, platforms: fit.platforms, concourse: fit.concourse, platform: 13.6, concourseY: 7.6, triangles: tris.length, cells: nx * nz, distinct: entries.length, runs: runs.length / 2 },
  };
}

/** Sutherland–Hodgman: the part of a polygon with -lim ≤ x ≤ lim. */
function clip(poly, lim) {
  for (const s of [1, -1]) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length], pin = p[0] * s <= lim, qin = q[0] * s <= lim;
      if (pin) out.push(p);
      if (pin !== qin) { const f = (lim * s - p[0]) / (q[0] - p[0]); out.push([lim * s, p[1] + (q[1] - p[1]) * f, p[2] + (q[2] - p[2]) * f]); }
    }
    poly = out;
    if (poly.length < 3) return [];
  }
  return [poly];
}

/**
 * Self-check: walking by the game's rules (steps up to 0.55 m, a body 0.55–1.75 m above its
 * feet, 0.3 m wide) from the street, which platform cells can be reached?
 */
function connected(nx, nz, entries, runs, G, t0) {
  const cell = new Uint32Array(nx * nz);
  for (let r = 0, k = 0; r < runs.length; r += 2) { cell.fill(runs[r + 1], k, k + runs[r]); k += runs[r]; }
  const floorsOf = (i, j) => [20, ...entries[cell[j * nx + i]][0]];
  const blocked = (i, j, h) => {
    for (let jj = j - 1; jj <= j + 1; jj++) for (let ii = i - 1; ii <= i + 1; ii++) {
      if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
      for (const [lo, hi] of entries[cell[jj * nx + ii]][1]) if (lo < h + 175 && hi > h + 55) return true;
    }
    return false;
  };
  const seen = new Set([0]), queue = [[0, 0, 20]];
  const out = { concourse: 0, platformA: 0, platformB: 0 };
  while (queue.length) {
    const [i, j, h] = queue.pop();
    if (Math.abs(h - 1360) < 10) out[t0 + (j + 0.5) * G < 0 ? 'platformA' : 'platformB']++;
    if (Math.abs(h - 760) < 10) out.concourse++;
    for (const [a, b] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) {
      if (a < 0 || b < 0 || a >= nx || b >= nz) continue;
      let nh = -1;
      for (const f of floorsOf(a, b)) if (f <= h + 55 && f > nh) nh = f;
      const k = (b * nx + a) * 4096 + nh;
      if (nh < 0 || seen.has(k) || blocked(a, b, nh)) continue;
      seen.add(k); queue.push([a, b, nh]);
    }
  }
  return out;
}
