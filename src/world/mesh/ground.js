// Ground and streets for one tile: asphalt, raised footpaths and plots, parks, kerbs with
// black-yellow paint, lane markings, sea walls with a Marine Drive-style parapet, rails.
import { AREA, ROAD, ROAD_FLAG } from '../tileFormat.js';
import { Y } from '../levels.js';
import { MeshBuilder, wall, flatPolygon, ribbon, linear, WHITE, inPolygon } from './builder.js';

// Area kind → [material key, height, sRGB tint]
const GROUND = {
  [AREA.ROAD]: ['road', Y.ROAD, 0xffffff],
  [AREA.FOOTPATH]: ['footpath', Y.KERB, 0xffffff],
  [AREA.ROAD_WORN]: ['roadWorn', Y.ROAD, 0xffffff],
  [AREA.ROAD_POOR]: ['roadPoor', Y.ROAD, 0xffffff],
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

/** ox, oz: the tile centre in texture (UV) space; geometry itself is tile-local. */
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
  // Kerb paint by street. The street library (ROAD_FLAG.KERB_*) says black-white, black-yellow or
  // plain; streets it does not cover follow the old rule (main roads black-yellow, the rest plain).
  // Medians — kerbs with another carriageway just beyond — are black-white (survey: almost everywhere).
  const segs = [];
  for (const r of t.roads || []) {
    if (r.cls > ROAD.TRACK || r.cls === ROAD.FOOTWAY || r.cls === ROAD.PEDESTRIAN) continue;
    const f = r.flags || 0;
    const mode = f & ROAD_FLAG.KERB_BW ? 2 : f & ROAD_FLAG.KERB_BY ? 1 : f & ROAD_FLAG.KERB_PLAIN ? 0 : r.cls <= ROAD.TERTIARY ? 1 : 0;
    const median = f & ROAD_FLAG.MEDIAN_BW || r.cls <= ROAD.TERTIARY ? 2 : 0;
    for (let i = 0; i + 3 < r.line.length; i += 2) segs.push(r.line[i], r.line[i + 1], r.line[i + 2], r.line[i + 3], r.width / 2, mode, median);
  }
  const S = 7, CELL = 20, grid = new Map();
  for (let i = 0; i < segs.length; i += S) {
    const r = segs[i + 4] + 10;
    for (let cx = Math.floor((Math.min(segs[i], segs[i + 2]) - r) / CELL); cx <= Math.floor((Math.max(segs[i], segs[i + 2]) + r) / CELL); cx++)
      for (let cz = Math.floor((Math.min(segs[i + 1], segs[i + 3]) - r) / CELL); cz <= Math.floor((Math.max(segs[i + 1], segs[i + 3]) + r) / CELL); cz++) {
        const k = cx * 4096 + cz; let a = grid.get(k); if (!a) grid.set(k, (a = [])); a.push(i);
      }
  }
  /** Nearest road to (x, z) within its half-width + slack: [mode, median, distance beyond its edge] or null. */
  const nearestRoad = (x, z, slack) => {
    let best = null, bd = Infinity;
    for (const i of grid.get(Math.floor(x / CELL) * 4096 + Math.floor(z / CELL)) || []) {
      const ax = segs[i], az = segs[i + 1], dx = segs[i + 2] - ax, dz = segs[i + 3] - az;
      const l2 = dx * dx + dz * dz || 1;
      const k = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
      const d = Math.hypot(ax + k * dx - x, az + k * dz - z) - segs[i + 4];
      if (d < slack && d < bd) { bd = d; best = i; }
    }
    return best === null ? null : [segs[best + 5], segs[best + 6], bd];
  };
  /** Kerb paint for an edge at (x, z) whose outer side (away from the road) is (ox, oz): 0 plain, 1 black-yellow, 2 black-white. */
  const kerbMode = (x, z, ox, oz) => {
    const own = nearestRoad(x, z, 3);
    if (!own) return 0;
    // Another carriageway 1.5–7 m beyond the kerb: this is a median.
    for (const d of [2.5, 4.5, 6.5]) { const o = nearestRoad(x + ox * d, z + oz * d, 0.3); if (o && o[2] < 0.3 && own[1]) return 2; }
    return own[0];
  };

  for (const a of t.areas) {
    const look = GROUND[a.kind];
    if (look) flatPolygon(get(look[0]), a.rings, look[1], linear(look[2]), ox, oz);

    if (a.kind === AREA.ROAD) {
      // Kerbs: every asphalt edge that is not a tile seam gets a vertical face up to
      // footpath level. Along main roads (and their medians) they are painted black and
      // yellow with a strip on top; lanes and side streets get plain concrete kerbs.
      const painted = get('kerb'), bw = get('kerbBW'), plain = get('kerbPlain');
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
          const mode = kerbMode((ax + bx) / 2, (az + bz) / 2, -ix, -iz), main = mode > 0;
          const kerb = mode === 2 ? bw : mode === 1 ? painted : plain;
          wall(kerb, ax, az, bx, bz, Y.ROAD - 0.05, Y.KERB, ix, iz, u, u + len, 0, 0.25, WHITE);
          if (!main) { u += len; continue; }
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
