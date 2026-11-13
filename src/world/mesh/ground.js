// Ground and streets for one tile: asphalt, raised footpaths and plots, parks, kerbs with
// black-yellow paint, lane markings, sea walls with a Marine Drive-style parapet, rails.
import { AREA, ROAD } from '../tileFormat.js';
import { Y } from '../levels.js';
import { MeshBuilder, wall, flatPolygon, ribbon, linear, WHITE, inPolygon } from './builder.js';

// Area kind → [material key, height, sRGB tint]
const GROUND = {
  [AREA.ROAD]: ['road', Y.ROAD, 0xffffff],
  [AREA.FOOTPATH]: ['footpath', Y.KERB, 0xffffff],
  [AREA.PLOT]: ['plot', Y.KERB, 0xffffff],
  [AREA.PAVED]: ['paved', Y.KERB + 0.006, 0xffffff],
  [AREA.PLATFORM]: ['paved', Y.KERB + 0.01, 0xe8e2d6],
  [AREA.GRASS]: ['grass', Y.KERB + 0.004, 0xffffff],
  [AREA.WOOD]: ['wood', Y.KERB + 0.008, 0xffffff],
  [AREA.PITCH]: ['pitch', Y.KERB + 0.012, 0xffffff],
  [AREA.SAND]: ['sand', Y.KERB - 0.12, 0xffffff],
  [AREA.DIRT]: ['dirt', Y.KERB + 0.004, 0xffffff],
  [AREA.RAILYARD]: ['railyard', Y.KERB + 0.004, 0xffffff],
  [AREA.PIER]: ['pier', Y.KERB, 0xd8d2c8],
  [AREA.POOL]: ['pool', Y.KERB + 0.02, 0xffffff],
};
const KERB_PAINT = 0.24;   // painted strip on top of the kerb (m)
const PARAPET_H = 0.65, PARAPET_W = 0.5;

export function buildGround(t, ox, oz) {
  const b = new Map();
  const get = (key) => b.get(key) || b.set(key, new MeshBuilder()).get(key);
  const [cx0, cz0, cx1, cz1] = t.clip;
  // Bit mask of the tile clip edges a point lies on (corners lie on two).
  const onClip = (x, z) =>
    (Math.abs(x - cx0) < 0.06 ? 1 : 0) | (Math.abs(x - cx1) < 0.06 ? 2 : 0) |
    (Math.abs(z - cz0) < 0.06 ? 4 : 0) | (Math.abs(z - cz1) < 0.06 ? 8 : 0);
  const sand = t.areas.filter((a) => a.kind === AREA.SAND);
  const tetrapods = [];
  let seed = (t.tx * 73856093) ^ (t.tz * 19349663);
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const roads = t.areas.filter((a) => a.kind === AREA.ROAD);

  for (const a of t.areas) {
    const look = GROUND[a.kind];
    if (look) flatPolygon(get(look[0]), a.rings, look[1], linear(look[2]), ox, oz);

    if (a.kind === AREA.ROAD) {
      // Kerbs: every asphalt edge that is not a tile seam gets a vertical face up to
      // footpath level, plus a painted strip on top. Faces point into the road.
      const kerb = get('kerb');
      for (const ring of a.rings) {
        const n = ring.length / 2;
        let u = 0;
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          const ax = ring[i * 2], az = ring[i * 2 + 1], bx = ring[j * 2], bz = ring[j * 2 + 1];
          const len = Math.hypot(bx - ax, bz - az);
          if (len < 0.02) continue;
          if (onClip(ax, az) & onClip(bx, bz)) { u += len; continue; }
          const ix = -(bz - az) / len, iz = (bx - ax) / len; // into the road (outer rings are positive area)
          wall(kerb, ax, az, bx, bz, Y.ROAD - 0.05, Y.KERB, ix, iz, u, u + len, 0, 0.25, WHITE);
          // Painted top strip, on the footpath side.
          const px = -ix * KERB_PAINT, pz = -iz * KERB_PAINT, y = Y.KERB + 0.004;
          const v0 = kerb.v(ax, y, az, 0, 1, 0, u, 0.5, WHITE), v1 = kerb.v(bx, y, bz, 0, 1, 0, u + len, 0.5, WHITE);
          const v2 = kerb.v(bx + px, y, bz + pz, 0, 1, 0, u + len, 0.75, WHITE), v3 = kerb.v(ax + px, y, az + pz, 0, 1, 0, u, 0.75, WHITE);
          kerb.triUp(v0, v1, v2); kerb.triUp(v0, v2, v3);
          u += len;
        }
      }
    }

    if (a.kind === AREA.LAND) {
      // Sea walls down to the water, and a sitting-height parapet (except at beaches).
      const sw = get('seawall'), par = get('parapet');
      for (const ring of a.rings) {
        const n = ring.length / 2;
        let u = 0;
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          const ax = ring[i * 2], az = ring[i * 2 + 1], bx = ring[j * 2], bz = ring[j * 2 + 1];
          const len = Math.hypot(bx - ax, bz - az);
          if (len < 0.05 || onClip(ax, az) & onClip(bx, bz)) { u += len; continue; }
          const nx = (bz - az) / len, nz = -(bx - ax) / len; // towards the water
          wall(sw, ax, az, bx, bz, Y.SEA - 0.3, Y.KERB, nx, nz, u, u + len, Y.SEA - 0.3, Y.KERB, WHITE);
          const mx = (ax + bx) / 2 - nx * 3, mz = (az + bz) / 2 - nz * 3;
          const beach = sand.some((s) => inPolygon(mx, mz, s.rings));
          const onRoad = roads.some((r) => inPolygon((ax + bx) / 2 - nx * 0.6, (az + bz) / 2 - nz * 0.6, r.rings));
          if (!beach && !onRoad && len > 0.3) {
            const top = Y.KERB + PARAPET_H, ix = -nx * PARAPET_W, iz = -nz * PARAPET_W;
            wall(par, ax, az, bx, bz, Y.KERB, top, nx, nz, u, u + len, 0, PARAPET_H, WHITE);
            wall(par, ax + ix, az + iz, bx + ix, bz + iz, Y.KERB, top, -nx, -nz, u, u + len, 0, PARAPET_H, WHITE);
            const t0 = par.v(ax, top, az, 0, 1, 0, u, 0, WHITE), t1 = par.v(bx, top, bz, 0, 1, 0, u + len, 0, WHITE);
            const t2 = par.v(bx + ix, top, bz + iz, 0, 1, 0, u + len, PARAPET_W, WHITE), t3 = par.v(ax + ix, top, az + iz, 0, 1, 0, u, PARAPET_W, WHITE);
            par.triUp(t0, t1, t2); par.triUp(t0, t2, t3);
            // Concrete tetrapods piled against west-facing sea walls (Marine Drive, Nariman Point).
            if (nx < -0.35) {
              for (let d = 0.8; d < len; d += 1.5) {
                const f = d / len, ex = ax + (bx - ax) * f, ez = az + (bz - az) * f;
                for (const row of [1.3, 2.7, 4.1]) {
                  if (row > 3 && rnd() < 0.5) continue;
                  const o = row + (rnd() - 0.5) * 0.6, j = (rnd() - 0.5) * 0.8;
                  tetrapods.push(ex + nx * o + (bx - ax) / len * j, Y.SEA - 0.6 + row * 0.12 + rnd() * 0.4, ez + nz * o + (bz - az) / len * j, rnd() * 6.28, 0.85 + rnd() * 0.3);
                }
              }
            }
          }
          u += len;
        }
      }
    }
  }

  // Lane markings and zebra crossings: thin paint ribbons on the asphalt.
  const paint = get('paint');
  for (const m of t.markings) ribbon(paint, m.line, m.width / 2, -m.width / 2, Y.ROAD + 0.008, WHITE, { uvMode: 'world', ox, oz });

  // Footways and pedestrian streets from the map (skipping bits that cross the asphalt), piers.
  const walk = get('footway'), pier = get('pier');
  for (const r of t.roads) {
    if (r.cls !== ROAD.FOOTWAY && r.cls !== ROAD.PEDESTRIAN && r.cls !== ROAD.PIER) continue;
    const L = r.line, keep = [];
    let cur = [];
    for (let i = 0; i < L.length / 2; i++) {
      const x = L[i * 2], z = L[i * 2 + 1];
      if (roads.some((rd) => inPolygon(x, z, rd.rings))) { if (cur.length > 2) keep.push(cur); cur = []; continue; }
      cur.push(x, z);
    }
    if (cur.length > 2) keep.push(cur);
    const hw = r.width / 2, m = r.cls === ROAD.PIER ? pier : walk;
    for (const line of keep) ribbon(m, new Float32Array(line), hw, -hw, Y.KERB + (r.cls === ROAD.PIER ? 0 : 0.012), WHITE, { uvMode: 'world', ox, oz });
  }

  // Railways: ballast bed with sleepers, two steel rails (Indian broad gauge 1.676 m).
  const bed = get('railBed'), steel = get('railSteel');
  const ballast = linear(0x8a8070);
  for (const r of t.rails) {
    ribbon(bed, r.line, 1.7, -1.7, Y.KERB + 0.03, ballast, { vScale: 1 / 0.65 });
    for (const s of [1, -1]) ribbon(steel, r.line, s * 0.9, s * 0.8, Y.KERB + 0.18, WHITE, { vScale: 0.1 });
  }
  return { builders: b, tetrapods };
}
