// Flyovers, bridges and tunnels for one tile (roads with heights, scripts/lib/elevation.mjs):
// asphalt decks with lane markings and lamps, box-girder edges with New Jersey crash barriers,
// piers with hammerhead caps every 30 m (footbridges: steel columns), ramps on solid walls,
// open cuts with retaining walls, covered tunnels with lit ceilings and portal walls.
// Concrete goes into the 'compound' mesh (plaster texture tinted by vertex colours, casts
// shadows), asphalt into 'road', paint into 'paint': no extra draw calls except tunnel lights.
import { ROAD, ROAD_FLAG, STRUCT, AREA } from '../tileFormat.js';
import { Y } from '../levels.js';
import { linear, inPolygon, WHITE } from './builder.js';

const STEP = 4;             // metres between cross-sections along a structure
const EDGE = 0.05;          // structure geometry starts this far off the ground (the street takes the rest)
const PIER_GAP = 30, FOOT_PIER_GAP = 14, LAMP_GAP = 36;
const COL = {
  deck: linear(0xc9c4ba), fascia: linear(0xd6d1c6), soffit: linear(0x9e988e), barrier: linear(0xe2ddd3),
  pier: linear(0xbdb7ac), cap: linear(0xc7c1b6), wall: linear(0xc2bcb0), cut: linear(0xb3ada2),
  tube: linear(0xe4e0d6), tubeBand: linear(0x5d5a54), ceiling: linear(0x8c8880), steel: linear(0x5f6b73), rail: linear(0x7d878d),
};

/** Quad a-b-c-d (each [x, y, z]) facing roughly n = [nx, ny, nz]; u/v in metres. */
function quad(m, a, b, c, d, n, ua, ub, va, vb, col) {
  const i0 = m.v(a[0], a[1], a[2], n[0], n[1], n[2], ua, va, col), i1 = m.v(b[0], b[1], b[2], n[0], n[1], n[2], ub, va, col);
  const i2 = m.v(c[0], c[1], c[2], n[0], n[1], n[2], ub, vb, col), i3 = m.v(d[0], d[1], d[2], n[0], n[1], n[2], ua, vb, col);
  // Winding from the geometric normal, so the face looks the way n says.
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], wx = d[0] - a[0], wy = d[1] - a[1], wz = d[2] - a[2];
  const gx = uy * wz - uz * wy, gy = uz * wx - ux * wz, gz = ux * wy - uy * wx;
  if (gx * n[0] + gy * n[1] + gz * n[2] >= 0) { m.tri(i0, i1, i2); m.tri(i0, i2, i3); } else { m.tri(i0, i2, i1); m.tri(i0, i3, i2); }
}

/** Box (axis along (fx, fz)) centred at (x, z) from y0 to y1: half-length a, half-width b. */
function box(m, x, z, y0, y1, fx, fz, a, b, col, bottom = false) {
  const lx = fz, lz = -fx; // left of the axis... any perpendicular will do
  const P = (s, t, y) => [x + fx * s + lx * t, y, z + fz * s + lz * t];
  const sides = [[a, -b, a, b, fx, fz], [a, b, -a, b, lx, lz], [-a, b, -a, -b, -fx, -fz], [-a, -b, a, -b, -lx, -lz]];
  for (const [s0, t0, s1, t1, nx, nz] of sides) {
    const len = Math.hypot((s1 - s0), (t1 - t0));
    quad(m, P(s0, t0, y0), P(s1, t1, y0), P(s1, t1, y1), P(s0, t0, y1), [nx, 0, nz], 0, len, y0, y1, col);
  }
  quad(m, P(-a, -b, y1), P(a, -b, y1), P(a, b, y1), P(-a, b, y1), [0, 1, 0], 0, 2 * a, 0, 2 * b, col);
  if (bottom) quad(m, P(-a, -b, y0), P(a, -b, y0), P(a, b, y0), P(-a, b, y0), [0, -1, 0], 0, 2 * a, 0, 2 * b, col);
}

/** Octagonal column at (x, z) of radius r from y0 to y1; returns its footprint ring (tile-local, flat array). */
function column(m, x, z, r, y0, y1, col) {
  const ring = [];
  for (let k = 0; k < 8; k++) {
    const a0 = ((k + 0.5) / 8) * Math.PI * 2, a1 = ((k + 1.5) / 8) * Math.PI * 2, am = (a0 + a1) / 2;
    const p0 = [x + Math.cos(a0) * r, z + Math.sin(a0) * r], p1 = [x + Math.cos(a1) * r, z + Math.sin(a1) * r];
    quad(m, [p0[0], y0, p0[1]], [p1[0], y0, p1[1]], [p1[0], y1, p1[1]], [p0[0], y1, p0[1]], [Math.cos(am), 0, Math.sin(am)], k * r * 0.77, (k + 1) * r * 0.77, y0, y1, col);
    ring.push(p0[0], p0[1]);
  }
  return ring;
}

/**
 * @param t decoded tile · ox, oz: tile centre in UV space · get(key) → MeshBuilder
 * @returns { solids: [[ring]] tile-local piers, lamps: [x, y, z, angle, size, …] }
 */
export function buildBridges(t, ox, oz, get, spans = []) {
  const solids = [], lamps = [];
  const roads = t.roads.filter((r) => r.heights);
  if (!roads.length) return { solids, lamps };
  const land = t.areas.filter((a) => a.kind === AREA.LAND);
  const onLand = (x, z) => land.some((a) => inPolygon(x, z, a.rings));
  // Ground vehicle roads (at grade) and rails: piers keep off them.
  const ground = [];
  for (const r of t.roads) {
    if (r.cls > ROAD.SERVICE && r.cls !== ROAD.TRACK) continue;
    const L = r.line, H = r.heights;
    for (let i = 0; i + 3 < L.length; i += 2) {
      if (H && (Math.abs(H[i / 2]) > STRUCT.AT_GRADE || Math.abs(H[i / 2 + 1]) > STRUCT.AT_GRADE)) continue;
      ground.push(L[i], L[i + 1], L[i + 2], L[i + 3], r.width / 2);
    }
  }
  const rails = [];
  for (const r of t.rails) for (let i = 0; i + 3 < r.line.length; i += 2) rails.push(r.line[i], r.line[i + 1], r.line[i + 2], r.line[i + 3]);

  // Dense cross-sections of every structure road: x, z, top y, s (global), left vector, mitre.
  const lines = roads.map((r, ri) => sections(r, ri));
  // Structure footprints, for barrier suppression where two decks meet and for piers.
  const segs = [];
  for (const L of lines) for (let i = 0; i + 1 < L.n; i++) segs.push(L, i);
  const footprintAt = (x, z, y, self, tol) => {
    for (let k = 0; k < segs.length; k += 2) {
      const L = segs[k], i = segs[k + 1];
      if (L === self) continue;
      const ax = L.x[i], az = L.z[i], dx = L.x[i + 1] - ax, dz = L.z[i + 1] - az, l2 = dx * dx + dz * dz || 1;
      const u = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
      const ex = ax + dx * u - x, ez = az + dz * u - z;
      if (ex * ex + ez * ez > (L.hw - tol) * (L.hw - tol)) continue;
      const yy = L.y[i] + (L.y[i + 1] - L.y[i]) * u;
      if (y === null || Math.abs(yy - y) < 1.5) return yy;
    }
    return null;
  };

  const road = get('road'), con = get('compound'), paint = get('paint');
  for (const L of lines) {
    const { r, n, x, z, y, s, lx, lz, k: mit, hw } = L;
    const foot = r.cls === ROAD.FOOTWAY || r.cls === ROAD.PEDESTRIAN;
    const tunnelTag = !!(r.flags & ROAD_FLAG.TUNNEL);
    const P = (i, o, dy) => [x[i] + lx[i] * o * mit[i], y[i] + dy, z[i] + lz[i] * o * mit[i]];
    for (let i = 0; i + 1 < n; i++) {
      const h0 = y[i] - Y.ROAD, h1 = y[i + 1] - Y.ROAD, hm = (h0 + h1) / 2;
      if (Math.abs(h0) < EDGE && Math.abs(h1) < EDGE) continue;
      const len = s[i + 1] - s[i];
      // Asphalt (or paving) on top.
      const top = (o0, o1, dy, m) => {
        const a = P(i, o0, dy), b = P(i + 1, o0, dy), c = P(i + 1, o1, dy), d = P(i, o1, dy);
        const ia = m.v(a[0], a[1], a[2], 0, 1, 0, a[0] + ox, a[2] + oz, WHITE), ib = m.v(b[0], b[1], b[2], 0, 1, 0, b[0] + ox, b[2] + oz, WHITE);
        const ic = m.v(c[0], c[1], c[2], 0, 1, 0, c[0] + ox, c[2] + oz, WHITE), id = m.v(d[0], d[1], d[2], 0, 1, 0, d[0] + ox, d[2] + oz, WHITE);
        m.triUp(ia, ib, ic); m.triUp(ia, ic, id);
      };
      top(hw, -hw, 0.004, road);
      const kind = hm >= STRUCT.CLEAR ? 'deck' : hm > 0 ? 'ramp' : hm > STRUCT.COVER ? 'cut' : 'tube';
      // Each side: skipped where another deck at this level continues (junctions, merging ramps).
      for (const side of [1, -1]) {
        const ex = (x[i] + x[i + 1]) / 2 + ((lx[i] + lx[i + 1]) / 2) * side * hw, ez = (z[i] + z[i + 1]) / 2 + ((lz[i] + lz[i + 1]) / 2) * side * hw;
        const open = footprintAt(ex, ez, (y[i] + y[i + 1]) / 2, L, 0.25) !== null;
        const S = (o) => o * side;
        const q = (o0, d0, o1, d1, no, ny, col, d0b = d0, d1b = d1) => {
          // A strip of the cross-section between (o0, d0) and (o1, d1), along this interval.
          const a = P(i, S(o0), d0), b = P(i + 1, S(o0), d0b), c = P(i + 1, S(o1), d1b), d = P(i, S(o1), d1);
          const nl = Math.hypot(no, ny) || 1, nx = ((lx[i] + lx[i + 1]) / 2) * (no / nl) * side, nz = ((lz[i] + lz[i + 1]) / 2) * (no / nl) * side;
          quad(con, a, b, c, d, [nx, ny / nl, nz], s[i], s[i + 1], 0, Math.hypot(o1 - o0, d1 - d0), col);
        };
        if (kind === 'deck' || kind === 'ramp') {
          const g0 = -0.08 - y[i], g1 = -0.08 - y[i + 1]; // down to the ground (ramps)
          if (!open) {
            if (foot) {
              q(hw - 0.08, 0, hw - 0.08, 1.1, -1, 0, COL.rail);
              q(hw - 0.08, 1.1, hw, 1.1, 0, 1, COL.rail);
              q(hw, 1.1, hw, -0.1, 1, 0, COL.rail);
            } else {
              // New Jersey barrier, then the fascia.
              q(hw - 0.45, 0, hw - 0.3, 0.28, -1, 0.45, COL.barrier);
              q(hw - 0.3, 0.28, hw - 0.22, 0.95, -1, 0.1, COL.barrier);
              q(hw - 0.22, 0.95, hw, 0.95, 0, 1, COL.barrier);
              q(hw, 0.95, hw, -0.45, 1, 0, COL.fascia);
            }
          }
          if (kind === 'deck') {
            const dd = foot ? 0.8 : STRUCT.DECK;
            if (foot) q(hw, -0.1, hw * 0.8, -dd, 1, -0.4, COL.steel);
            else if (!open) q(hw, -0.45, hw * 0.62, -dd, 1.35, -0.38 * hw, COL.soffit);
            else q(hw * 0.95, -0.45, hw * 0.62, -dd, 1.35, -0.38 * hw, COL.soffit);
            // The flat bottom (each side draws its half).
            q(hw * (foot ? 0.8 : 0.62), -dd, 0, -dd, 0, -1, COL.soffit);
          } else if (!open) {
            // Ramp: a solid wall down to the ground.
            q(hw, -0.45, hw, g0, 1, 0, COL.wall, -0.45, g1);
          }
        } else if (kind === 'cut') {
          // Open cut: retaining wall from the road up to a barrier above the street.
          const t0 = Y.KERB + 1.0 - y[i], t1 = Y.KERB + 1.0 - y[i + 1], w = hw + 0.15;
          if (!open) {
            q(w, 0, w, t0, -1, 0, COL.cut, 0, t1);
            q(w, t0, w + 0.4, t0, 0, 1, COL.barrier, t1, t1);
            q(w + 0.4, t0, w + 0.4, t0 - 1.0, 1, 0, COL.barrier, t1, t1 - 1.0);
          }
        } else {
          // Covered tunnel: tiled walls with a dark band low down, ceiling, light strips.
          const w = hw + 0.3, C = STRUCT.CEILING;
          if (!open) {
            q(w, 0, w, 1.1, -1, 0, COL.tubeBand);
            q(w, 1.1, w, C - 0.6, -1, 0, COL.tube);
            q(w, C - 0.6, w - 0.6, C, -1, -1, COL.ceiling);
          }
          q(w - 0.6, C, 0, C, 0, -1, COL.ceiling);
          const lt = get('tunnelLight');
          const a = P(i, S(hw * 0.45), C - 0.06), b = P(i + 1, S(hw * 0.45), C - 0.06), c = P(i + 1, S(hw * 0.45 - 0.35), C - 0.06), d = P(i, S(hw * 0.45 - 0.35), C - 0.06);
          quad(lt, a, b, c, d, [0, -1, 0], 0, 1, 0, 1, [255, 255, 255]);
        }
      }
      // Portal wall where an open cut goes under cover (faces the cut).
      const k0 = h0 > STRUCT.COVER, k1 = h1 > STRUCT.COVER;
      if (h0 < 0 && h1 < 0 && k0 !== k1) {
        const j = k0 ? i + 1 : i, dir = k0 ? -1 : 1, w = hw + 0.7, yTop = Y.KERB + 1.0;
        const a = [x[j] + lx[j] * w, y[j] + STRUCT.CEILING, z[j] + lz[j] * w], b = [x[j] - lx[j] * w, y[j] + STRUCT.CEILING, z[j] - lz[j] * w];
        const c = [b[0], yTop, b[2]], d = [a[0], yTop, a[2]];
        const fx = (x[i + 1] - x[i]) / (len || 1) * dir, fz = (z[i + 1] - z[i]) / (len || 1) * dir;
        quad(con, a, b, c, d, [fx, 0, fz], 0, 2 * w, a[1], yTop, COL.wall);
        quad(con, d, c, [c[0] - fx * 0.6, yTop, c[2] - fz * 0.6], [d[0] - fx * 0.6, yTop, d[2] - fz * 0.6], [0, 1, 0], 0, 2 * w, 0, 0.6, COL.barrier);
      }
      // Lane markings on vehicle decks (in tunnels too).
      if (!foot && hw >= 2.5) {
        const dy = 0.012;
        const strip = (o0, o1, from = 0, to = 1) => {
          const A = (f, o) => { const xx = x[i] + (x[i + 1] - x[i]) * f, zz = z[i] + (z[i + 1] - z[i]) * f, yy = y[i] + (y[i + 1] - y[i]) * f + dy, lxx = lx[i] + (lx[i + 1] - lx[i]) * f, lzz = lz[i] + (lz[i + 1] - lz[i]) * f; return [xx + lxx * o, yy, zz + lzz * o]; };
          const a = A(from, o0), b = A(to, o0), c = A(to, o1), d = A(from, o1);
          const ia = paint.v(a[0], a[1], a[2], 0, 1, 0, a[0] + ox, a[2] + oz, WHITE), ib = paint.v(b[0], b[1], b[2], 0, 1, 0, b[0] + ox, b[2] + oz, WHITE);
          const ic = paint.v(c[0], c[1], c[2], 0, 1, 0, c[0] + ox, c[2] + oz, WHITE), id = paint.v(d[0], d[1], d[2], 0, 1, 0, d[0] + ox, d[2] + oz, WHITE);
          paint.triUp(ia, ib, ic); paint.triUp(ia, ic, id);
        };
        const edge = hm > 0 && hm < STRUCT.CLEAR ? hw - 0.6 : hw - 0.62; // just inside the barrier
        for (const side of [1, -1]) strip(side * edge, side * (edge - 0.15));
        const oneway = !!(r.flags & ROAD_FLAG.ONEWAY);
        const lanes = oneway ? Math.max(1, Math.round((hw * 2 - 1.2) / 3.4)) : 2 * Math.max(1, Math.round((hw - 0.6) / 3.5));
        const w = (2 * edge) / lanes;
        // Dashes: 3 m of paint every 9 m, phased on the global distance so they line up across tiles.
        for (let ln = 1; ln < lanes; ln++) {
          const o = edge - ln * w;
          if (!oneway && ln === lanes / 2) { strip(o + 0.1, o + 0.22); strip(o - 0.1, o - 0.22); continue; } // double centre line
          const a0 = Math.ceil(s[i] / 9) * 9;
          for (let d0 = a0 - 9; d0 < s[i + 1]; d0 += 9) {
            const f0 = Math.max(0, (d0 - s[i]) / len), f1 = Math.min(1, (d0 + 3 - s[i]) / len);
            if (f1 > f0) strip(o + 0.07, o - 0.07, f0, f1);
          }
        }
      }
    }
    // Piers under decks (where it is high enough), off roads and tracks below.
    const gap = foot ? FOOT_PIER_GAP : PIER_GAP;
    const first = Math.ceil(s[0] / gap) * gap;
    for (let sp = first; sp <= s[n - 1]; sp += gap) {
      let placed = false;
      for (const shift of [0, 6, -6, 12, -12]) {
        const at = sp + shift;
        if (at < s[0] || at > s[n - 1]) continue;
        const p = L.at(at);
        if (!p || p.h < STRUCT.CLEAR + 0.3) continue;
        // Cable-stayed spans (the sea link) hang from their pylons: no piers there.
        const wx = p.x + (t.tx + 0.5) * t.size, wz = p.z + (t.tz + 0.5) * t.size;
        if (spans.some((q) => (wx - q.x) ** 2 + (wz - q.z) ** 2 < (q.span + 25) ** 2)) continue;
        const ok = pierFree(p, hw, ground, rails, (px, pz) => footprintAt(px, pz, null, L, 0) !== null && (footprintAt(px, pz, null, L, 0) < p.y - 2));
        if (!ok) continue;
        const wet = !onLand(p.x, p.z), y0 = wet ? Y.SEA - 1.2 : Y.KERB - 0.05;
        const yCap = p.y - (foot ? 0.8 : STRUCT.DECK);
        if (foot) {
          for (const o of [hw * 0.75, -hw * 0.75]) solids.push([column(con, p.x + p.lx * o, p.z + p.lz * o, 0.16, y0, yCap, COL.steel)]);
          box(con, p.x, p.z, yCap - 0.35, yCap, p.lx, p.lz, hw * 0.85, 0.18, COL.steel, true);
        } else {
          const wide = hw > 7.6, rc = Math.min(1.05, 0.55 + hw * 0.06);
          const cols = wide ? [hw * 0.36, -hw * 0.36] : [0];
          for (const o of cols) {
            const cx = p.x + p.lx * o, cz = p.z + p.lz * o;
            solids.push([column(con, cx, cz, rc, y0, yCap - 1.1, COL.pier)]);
            if (wet) box(con, cx, cz, Y.SEA - 1.2, Y.SEA + 0.5, p.fx, p.fz, rc * 2.2, rc * 2.2, COL.cap);
          }
          // Hammerhead cap (or a cross beam on two columns) under the girder.
          box(con, p.x, p.z, yCap - 1.1, yCap, p.lx, p.lz, hw * 0.62, 0.9, COL.cap, true);
        }
        placed = true;
        break;
      }
      if (!placed) continue;
    }
    // Lamps along vehicle decks (on the barrier, arm over the road), alternating sides.
    if (!foot && hw >= 2.5) {
      for (let sl = Math.ceil((s[0] - 15) / LAMP_GAP) * LAMP_GAP + 15; sl <= s[n - 1]; sl += LAMP_GAP) {
        const p = L.at(sl);
        if (!p || p.h < 1.5 || (tunnelTag && p.h < 0)) continue;
        const side = Math.round((sl - 15) / LAMP_GAP) % 2 ? 1 : -1, o = (hw - 0.2) * side;
        const lxp = p.lx * side, lzp = p.lz * side;
        lamps.push(p.x + p.lx * o, p.y + 0.95, p.z + p.lz * o, Math.atan2(-lxp, -lzp), 1);
      }
    }
  }
  return { solids, lamps };
}

/** A pier at p is fine if no road crosses beneath it, no track runs there and no lower deck is in the way. */
function pierFree(p, hw, ground, rails, lowerDeck) {
  for (let k = 0; k < ground.length; k += 5) {
    const ax = ground[k], az = ground[k + 1], dx = ground[k + 2] - ax, dz = ground[k + 3] - az, l2 = dx * dx + dz * dz || 1;
    const u = Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.z - az) * dz) / l2));
    const ex = ax + dx * u - p.x, ez = az + dz * u - p.z, r = ground[k + 4] + 1.4;
    if (ex * ex + ez * ez > r * r) continue;
    // A road running along beneath (the flyover over its median) may have piers; one crossing may not.
    const along = Math.abs((dx * p.fx + dz * p.fz) / Math.sqrt(l2));
    if (along < 0.9) return false;
  }
  for (let k = 0; k < rails.length; k += 4) {
    const ax = rails[k], az = rails[k + 1], dx = rails[k + 2] - ax, dz = rails[k + 3] - az, l2 = dx * dx + dz * dz || 1;
    const u = Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.z - az) * dz) / l2));
    const ex = ax + dx * u - p.x, ez = az + dz * u - p.z;
    if (ex * ex + ez * ez < (hw * 0.4 + 3.2) ** 2) return false;
  }
  return !lowerDeck(p.x, p.z);
}

/** Cross-sections every STEP metres (plus the cut points where a structure changes kind). */
function sections(r, ri) {
  const L = r.line, H = r.heights, n0 = L.length / 2;
  const X = [], Z = [], Yy = [], S = [];
  let s = r.s0;
  const push = (x, z, h, sv) => { X.push(x); Z.push(z); Yy.push(Y.ROAD + h); S.push(sv); };
  const CUTS = [EDGE, -EDGE, STRUCT.CLEAR, STRUCT.COVER];
  for (let i = 0; i < n0; i++) {
    const x = L[i * 2], z = L[i * 2 + 1], h = H[i];
    if (i) {
      const px = L[i * 2 - 2], pz = L[i * 2 - 1], ph = H[i - 1], len = Math.hypot(x - px, z - pz);
      const ts = [];
      const k = Math.ceil(len / STEP);
      for (let j = 1; j < k; j++) ts.push(j / k);
      for (const c of CUTS) if ((ph - c) * (h - c) < 0) ts.push((c - ph) / (h - ph));
      ts.sort((a, b) => a - b);
      for (const t of ts) push(px + (x - px) * t, pz + (z - pz) * t, ph + (h - ph) * t, s + len * t);
      s += len;
    }
    push(x, z, h, s);
  }
  const n = X.length, lx = new Float32Array(n), lz = new Float32Array(n), mit = new Float32Array(n).fill(1);
  const dirAt = (j) => { const dx = X[j + 1] - X[j], dz = Z[j + 1] - Z[j], l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l]; };
  for (let i = 0; i < n; i++) {
    let fx, fz;
    if (i === 0) [fx, fz] = dirAt(0);
    else if (i === n - 1) [fx, fz] = dirAt(n - 2);
    else {
      const a = dirAt(i - 1), b = dirAt(i);
      fx = a[0] + b[0]; fz = a[1] + b[1];
      const l = Math.hypot(fx, fz);
      if (l < 1e-3) [fx, fz] = a; else { fx /= l; fz /= l; mit[i] = 1 / Math.max(0.5, fx * a[0] + fz * a[1]); }
    }
    lx[i] = fz; lz[i] = -fx; // left of travel (x east, z south)
  }
  const line = { r, ri, n, x: X, z: Z, y: Yy, s: S, lx, lz, k: mit, hw: r.width / 2 };
  /** Point at global distance sv: { x, z, y, h, lx, lz, fx, fz } or null. */
  line.at = (sv) => {
    if (sv < S[0] || sv > S[n - 1]) return null;
    let i = 0;
    while (i < n - 2 && S[i + 1] < sv) i++;
    const f = (sv - S[i]) / (S[i + 1] - S[i] || 1), y = Yy[i] + (Yy[i + 1] - Yy[i]) * f;
    const [fx, fz] = dirAt(Math.min(i, n - 2));
    return { x: X[i] + (X[i + 1] - X[i]) * f, z: Z[i] + (Z[i + 1] - Z[i]) * f, y, h: y - Y.ROAD, lx: fz, lz: -fx, fx, fz };
  };
  return line;
}
