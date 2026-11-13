// Buildings for one tile. Walls carry per-vertex facade data that the facade shader
// (src/world/facade.js) turns into windows, balconies, AC units, shopfronts and signs.
import { BUILDING_FLAG } from '../tileFormat.js';
import { Y } from '../levels.js';
import { MeshBuilder, wall, flatPolygon, linear, rand, signedArea, pointInRing, WHITE } from './builder.js';

// Styles (same order as scripts/lib/districts.mjs STYLE).
export const STYLES = ['plaster', 'weathered', 'deco', 'stone', 'basalt', 'concrete', 'glass', 'shed', 'brick'];
const BAY = [3.3, 3.0, 3.4, 3.7, 3.7, 3.4, 1.6, 4.0, 3.2]; // metres per window column
const PARAPET = 0.9;
export const FACADE_FLOATS = 7; // bay coordinate, style, seed (integer), storey height, roof height, shop (1) / blank (2), bay width

/** Wall quad whose vertices carry a running "bay" coordinate for the window grid. */
function facadeWall(m, ax, az, bx, bz, y0, y1, nx, nz, u0, u1, b0, b1, cBottom, cTop) {
  m.cur[0] = b0; const a0 = m.v(ax, y0, az, nx, 0, nz, u0, y0, cBottom);
  m.cur[0] = b1; const v0 = m.v(bx, y0, bz, nx, 0, nz, u1, y0, cBottom);
  m.cur[0] = b1; const v1 = m.v(bx, y1, bz, nx, 0, nz, u1, y1, cTop);
  m.cur[0] = b0; const a1 = m.v(ax, y1, az, nx, 0, nz, u0, y1, cTop);
  if ((bz - az) * nx - (bx - ax) * nz >= 0) { m.tri(a0, v1, v0); m.tri(a0, a1, v1); }
  else { m.tri(a0, v0, v1); m.tri(a0, v1, a1); }
}

/** Ring moved inwards by d metres (mitred). Outer rings have positive signed area. */
function inset(ring, d) {
  const n = ring.length / 2, out = new Float32Array(ring.length);
  for (let i = 0; i < n; i++) {
    const p = (i - 1 + n) % n, q = (i + 1) % n;
    const ex = ring[i * 2] - ring[p * 2], ez = ring[i * 2 + 1] - ring[p * 2 + 1];
    const fx = ring[q * 2] - ring[i * 2], fz = ring[q * 2 + 1] - ring[i * 2 + 1];
    const le = Math.hypot(ex, ez) || 1, lf = Math.hypot(fx, fz) || 1;
    // Inward normals of the two edges: (-dz, dx).
    let nx = -ez / le - fz / lf, nz = ex / le + fx / lf;
    const ln = Math.hypot(nx, nz) || 1;
    nx /= ln; nz /= ln;
    const k = d / Math.max(0.35, nx * (-ez / le) + nz * (ex / le));
    out[i * 2] = ring[i * 2] + nx * k; out[i * 2 + 1] = ring[i * 2 + 1] + nz * k;
  }
  return out;
}

export function buildBuildings(t, ox, oz, toWorld) {
  const b = new Map();
  const walls = (style) => b.get(`walls${style}`) || b.set(`walls${style}`, new MeshBuilder(FACADE_FLOATS)).get(`walls${style}`);
  const get = (key) => b.get(key) || b.set(key, new MeshBuilder()).get(key);
  const tanks = [], solid = [];

  t.buildings.forEach((bd, bi) => {
    const style = Math.min(bd.style, STYLES.length - 1);
    const outer = bd.rings[0];
    const area = Math.abs(signedArea(outer));
    const seed = rand(t.tx * 7919 + bi, t.tz * 104729 + bi);
    const hex = (bd.color[0] << 16) | (bd.color[1] << 8) | bd.color[2];
    const base = linear(hex, 0.96 + seed * 0.08);
    const low = linear(hex, 0.82);
    const canopy = bd.minHeight > 0.2;
    const y0 = canopy ? bd.minHeight : -0.4;
    const h = bd.height;
    const parapet = !canopy && h > 5 && area > 30 && style !== 7;
    const top = parapet ? h + PARAPET : h;
    const levels = Math.max(1, bd.levels);
    const storey = Math.min(4.6, Math.max(2.7, (h - 0.6) / levels));
    const m = walls(style);
    m.cur[1] = style + 0.5; m.cur[2] = Math.floor(seed * 997); m.cur[3] = storey; m.cur[4] = h;

    bd.rings.forEach((ring, ri) => {
      const n = ring.length / 2;
      let u = seed * 7;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const ax = ring[i * 2], az = ring[i * 2 + 1], bx = ring[j * 2], bz = ring[j * 2 + 1];
        const len = Math.hypot(bx - ax, bz - az);
        if (len < 0.05) continue;
        const bays = Math.round(len / BAY[style]);
        const shop = ri === 0 && (bd.flags & BUILDING_FLAG.SHOPS) && bd.front[i] && len > 2.5;
        m.cur[5] = bays < 1 || canopy ? 2 : shop ? 1 : 0;
        m.cur[6] = len / Math.max(1, bays);
        facadeWall(m, ax, az, bx, bz, y0, top, (bz - az) / len, -(bx - ax) / len, u, u + len, 0, Math.max(1, bays), low, base);
        u += len;
      }
    });

    // Roof: concrete terrace, sometimes blue tarpaulin or rusty sheets on small buildings.
    const r0 = rand(bi * 31 + t.tx, t.tz + 7);
    const roofKey = area < 400 && r0 < 0.12 ? 'roofTarp' : area < 400 && r0 < 0.2 ? 'roofRust' : 'roof';
    const roofTint = linear(roofKey === 'roof' ? 0xd6d0c6 : 0xffffff, 0.8 + rand(bi, 3) * 0.3);
    flatPolygon(get(roofKey), bd.rings, h, roofTint, ox, oz);
    if (canopy) flatPolygon(get('roof'), bd.rings, y0 - 0.01, linear(0x9a948c), ox, oz);

    let inner = null;
    if (parapet) {
      // Inner face and coping of the roof parapet.
      inner = inset(outer, 0.22);
      const rm = get('roof');
      const n = outer.length / 2;
      const cap = linear(0xe2ddd3);
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const ax = inner[i * 2], az = inner[i * 2 + 1], bx = inner[j * 2], bz = inner[j * 2 + 1];
        const len = Math.hypot(bx - ax, bz - az);
        if (len < 0.05) continue;
        wall(rm, ax, az, bx, bz, h, top, -(bz - az) / len, (bx - ax) / len, 0, len, h, top, roofTint);
        const o0 = rm.v(outer[i * 2], top, outer[i * 2 + 1], 0, 1, 0, outer[i * 2] + ox, outer[i * 2 + 1] + oz, cap);
        const o1 = rm.v(outer[j * 2], top, outer[j * 2 + 1], 0, 1, 0, outer[j * 2] + ox, outer[j * 2 + 1] + oz, cap);
        const i1 = rm.v(bx, top, bz, 0, 1, 0, bx + ox, bz + oz, cap), i0 = rm.v(ax, top, az, 0, 1, 0, ax + ox, az + oz, cap);
        rm.triUp(o0, o1, i1); rm.triUp(o0, i1, i0);
      }
    }
    if (!(bd.flags & BUILDING_FLAG.NO_COLLIDE)) solid.push(bd.rings.map(toWorld));
    if (canopy || h < 6) return;

    let cx = 0, cz = 0;
    for (let i = 0; i < outer.length; i += 2) { cx += outer[i]; cz += outer[i + 1]; }
    cx /= outer.length / 2; cz /= outer.length / 2;
    const roofRing = inner || outer;

    // Stair/lift room on mid-rise roofs (a small box, same wall style, no windows).
    if (levels >= 5 && area > 160 && style !== 6 && pointInRing(cx, cz, roofRing) && rand(bi, 77) < 0.85) {
      const s = 1.6 + rand(bi, 78) * 0.6, hh = 2.8;
      const ang = rand(bi, 79) * Math.PI;
      const c = Math.cos(ang), sn = Math.sin(ang);
      const pts = [[-s, -s], [s, -s], [s, s], [-s, s]].map(([x, z]) => [cx + x * c - z * sn, cz + x * sn + z * c]);
      if (pts.every(([x, z]) => pointInRing(x, z, roofRing))) {
        m.cur[4] = h + hh; m.cur[5] = 2;
        for (let i = 0; i < 4; i++) {
          // Corners go clockwise in (x, z) here, so (dz, -dx) points outwards.
          const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % 4];
          const len = Math.hypot(bx - ax, bz - az);
          facadeWall(m, ax, az, bx, bz, h, h + hh, (bz - az) / len, -(bx - ax) / len, 0, len, 0, 1, base, base);
        }
        const ring = new Float32Array(pts.flat());
        flatPolygon(get('roof'), [ring], h + hh, roofTint, ox, oz);
        m.cur[4] = h;
      }
    }

    // Black plastic water tanks (Sintex-style) on almost every roof.
    if (area > 50) {
      const count = 1 + Math.floor(rand(bi, 11) * Math.min(5, area / 120));
      const spread = Math.sqrt(area) * 0.35;
      for (let k = 0; k < count; k++) {
        const px = cx + (rand(bi, 20 + k) - 0.5) * spread, pz = cz + (rand(bi, 40 + k) - 0.5) * spread;
        if (pointInRing(px, pz, roofRing)) tanks.push(px, h, pz, 0.8 + rand(bi, 60 + k) * 0.6);
      }
    }
  });
  return { builders: b, tanks, solid };
}
