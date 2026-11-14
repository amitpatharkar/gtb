// Railway stations for the game (src/world/stations.js): raised platforms, foot overbridges,
// stairs and footbridge piers, from what OpenStreetMap maps at every station in the box.
// Research: docs/research/metro/reports/Mumbai local trains and stations.md and the station
// geometry notes (research_notes/…/osm_station_data.md).
//
//  - Platforms are the mapped outlines, grown 1 m and then cut back to PLATFORM_EDGE from every
//    track centre, so their edges sit where a real coping does (the coach body overhangs it; the
//    mapped outlines are 2.2 m from the track on average). Tops are 0.9 m above the rail
//    (Mumbai's 840–920 mm platforms). The spine (the long axis, sampled every 4 m with the
//    platform's width there) carries roofs, name boards and indicators; edges that face a
//    track get the coping and the yellow line.
//  - Foot overbridges are the mapped footways on bridges, chained; a span over the railway is
//    7.5 m above the rail (25 kV wires below), one over roads 6 m. Mapped steps that start at
//    a deck become stairs down to the platform or street they reach; a platform under a deck
//    with no stairs mapped gets a stair, and so does a deck end that has none.
//  - The flat footway strips the tiles would otherwise draw for those bridges and steps are
//    left out of the roads (skipRoads).
import { createRequire } from 'node:module';
import * as C from './clip.mjs';
import * as G from './geometry.mjs';
import { stationName } from './trains.mjs';

const ClipperLib = createRequire(import.meta.url)('clipper-lib');
const { ClipperOffset, JoinType, EndType, Paths } = ClipperLib;

export const RAIL_TOP = 0.4;                 // rail top in the game (levels.js KERB + 0.2)
export const PLATFORM_TOP = RAIL_TOP + 0.9;  // 1.3 m
export const PLATFORM_EDGE = 1.7;            // platform edge from the track centre (coach half width 1.83 overhangs it)
export const DECK_RAIL = RAIL_TOP + 7.5;     // footbridge floor over the railway
export const DECK_ROAD = 6.2;                // footbridge floor over roads
const GROUND = 0.2;
const SLOPE = 0.62;                          // stair rise per metre (about 32°)
const r1 = (v) => Math.round(v * 10) / 10;

/** Grow (d > 0) or shrink a polygon ring. */
function offsetRing(ring, d) {
  const co = new ClipperOffset(2, 0.05 * C.SCALE);
  co.AddPaths([C.toPath(ring)], JoinType.jtMiter, EndType.etClosedPolygon);
  const out = new Paths();
  co.Execute(out, d * C.SCALE);
  return out;
}

/** Principal axis of a set of points: [cx, cz, ux, uz]. */
function axisOf(pts) {
  let cx = 0, cz = 0;
  for (const [x, z] of pts) { cx += x; cz += z; }
  cx /= pts.length; cz /= pts.length;
  let sxx = 0, szz = 0, sxz = 0;
  for (const [x, z] of pts) { const dx = x - cx, dz = z - cz; sxx += dx * dx; szz += dz * dz; sxz += dx * dz; }
  const a = 0.5 * Math.atan2(2 * sxz, sxx - szz);
  return [cx, cz, Math.cos(a), Math.sin(a)];
}

/** Where the line p + t·v crosses a ring: sorted t values. */
function crossings(ring, px, pz, vx, vz) {
  const out = [];
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const ax = ring[j][0], az = ring[j][1], bx = ring[i][0], bz = ring[i][1], ex = bx - ax, ez = bz - az;
    const den = vx * ez - vz * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((ax - px) * ez - (az - pz) * ex) / den, u = ((ax - px) * vz - (az - pz) * vx) / den;
    if (u >= 0 && u < 1) out.push(t);
  }
  return out.sort((a, b) => a - b);
}

/** Nearest point on a polyline: { d (distance away), a (distance along), x, z, i (segment) }. */
function nearestOn(pts, x, z) {
  let best = { d: Infinity, a: 0, x: 0, z: 0, i: 0 }, acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i], dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1e-9;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (l * l))), qx = ax + dx * t, qz = az + dz * t, d = Math.hypot(x - qx, z - qz);
    if (d < best.d) best = { d, a: acc + l * t, x: qx, z: qz, i };
    acc += l;
  }
  return best;
}

const lengthOf = (pts) => { let s = 0; for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return s; };

/** Do two segments cross? */
function segCross(p, q, r, s) {
  const ax = q[0] - p[0], az = q[1] - p[1], bx = s[0] - r[0], bz = s[1] - r[1], den = ax * bz - az * bx;
  if (Math.abs(den) < 1e-9) return null;
  const u = ((r[0] - p[0]) * bz - (r[1] - p[1]) * bx) / den, v = ((r[0] - p[0]) * az - (r[1] - p[1]) * ax) / den;
  return u >= 0 && u <= 1 && v >= 0 && v <= 1 ? u : null;
}

/**
 * @param platforms  [{ id, ring, tags }] railway=platform outlines (open rings)
 * @param bridges    [{ id, refs, pts, tags }] footways, paths and steps on bridges (bridge=* or layer ≥ 1)
 * @param steps      [{ id, refs, pts, tags }] highway=steps (any)
 * @param rails      [{ id, pts }] railway tracks at ground level
 * @param roofs      [ring] mapped canopies (building=roof) — platforms under them get no generated roof
 * @param stationNodes [[x, z, name, mr, hi]]
 * @param box        [x0, z0, x1, z1]
 */
export function buildStations({ platforms, bridges, steps, rails, roofs, stationNodes, box, log }) {
  const inBox = ([x, z]) => x >= box[0] && x <= box[2] && z >= box[1] && z <= box[3];
  // Tracks in a 50 m grid for clearance and "does this cross the railway" tests.
  const cell = 50, grid = new Map();
  for (const r of rails) for (let i = 1; i < r.pts.length; i++) {
    const a = r.pts[i - 1], b = r.pts[i];
    for (let gx = Math.floor(Math.min(a[0], b[0]) / cell); gx <= Math.floor(Math.max(a[0], b[0]) / cell); gx++)
      for (let gz = Math.floor(Math.min(a[1], b[1]) / cell); gz <= Math.floor(Math.max(a[1], b[1]) / cell); gz++) {
        const k = `${gx},${gz}`;
        (grid.get(k) || grid.set(k, []).get(k)).push([a, b]);
      }
  }
  const segsNear = (bb, pad = 0) => {
    const out = new Set();
    for (let gx = Math.floor((bb[0] - pad) / cell); gx <= Math.floor((bb[2] + pad) / cell); gx++)
      for (let gz = Math.floor((bb[1] - pad) / cell); gz <= Math.floor((bb[3] + pad) / cell); gz++) for (const s of grid.get(`${gx},${gz}`) || []) out.add(s);
    return [...out];
  };
  const trackDist = (x, z, pad = 6) => { let d = Infinity; for (const [a, b] of segsNear([x, z, x, z], pad)) d = Math.min(d, Math.sqrt(G.segDist2([x, z], a, b))); return d; };
  const crossesRail = (pts) => {
    for (let i = 1; i < pts.length; i++) for (const [a, b] of segsNear(G.bboxOf([pts[i - 1], pts[i]]), 2)) if (segCross(pts[i - 1], pts[i], a, b) != null) return true;
    return false;
  };

  // 1. Platforms: grown and cut back to the coping line.
  const outPl = [];
  const metro = (t) => t.subway === 'yes' || t.monorail === 'yes' || t.light_rail === 'yes' || /subway|monorail|light_rail/.test(t.station || '')
    || (t.layer && parseFloat(t.layer) !== 0) || parseFloat(t.level) < 0 || t.location === 'underground' || (t.tunnel && t.tunnel !== 'no');
  for (const p of platforms) {
    if (metro(p.tags)) continue; // metro and monorail platforms are elevated or underground (src/world/metro.js)
    const ring = G.simplifyRing(p.ring, 0.2);
    if (ring.length < 3 || !ring.some(inBox)) continue;
    const bb = G.bboxOf(ring), near = segsNear(bb, 8);
    // Only platforms beside a railway track at ground level (the metro's tracks are not in `rails`).
    if (!ring.some(([x, z]) => trackDist(x, z, 8) < PLATFORM_EDGE + 4)) continue;
    const grown = offsetRing(ring, 1.0);
    const cut = near.length ? C.bufferLines([{ delta: PLATFORM_EDGE, lines: near.map(([a, b]) => [a, b]), butt: false }]) : [];
    const pieces = C.toPolygons(C.difference(grown, cut), 12).filter((poly) => {
      // Keep what overlaps the mapped platform (not slivers between neighbouring tracks).
      const c = G.centroid(poly[0]);
      return G.pointInRing(c[0], c[1], ring) || poly[0].some(([x, z]) => G.pointInRing(x, z, ring));
    });
    for (const poly of pieces) {
      const outer = G.simplifyRing(poly[0], 0.15);
      if (outer.length < 3 || Math.abs(G.signedArea(outer)) < 25) continue;
      const [cx, cz, ux, uz] = axisOf(outer);
      let s0 = Infinity, s1 = -Infinity;
      for (const [x, z] of outer) { const s = (x - cx) * ux + (z - cz) * uz; s0 = Math.min(s0, s); s1 = Math.max(s1, s); }
      // Width across the platform every 4 m: [s, t0, t1] (t to the left of the axis, +(−uz, ux)).
      const spine = [];
      for (let s = s0 + 1; s <= s1 - 1; s += 4) {
        const px = cx + ux * s, pz = cz + uz * s, ts = crossings(outer, px, pz, -uz, ux);
        let best = null;
        for (let k = 0; k + 1 < ts.length; k += 2) if (!best || ts[k + 1] - ts[k] > best[1] - best[0]) best = [ts[k], ts[k + 1]];
        if (best && best[1] - best[0] > 1.5) spine.push([s, best[0], best[1]]);
      }
      if (spine.length < 3) continue;
      // Edges along a track get the coping and yellow line.
      const edges = outer.map((a, i) => {
        const b = outer[(i + 1) % outer.length], mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
        return trackDist(mx, mz) < PLATFORM_EDGE + 0.8 ? 1 : 0;
      });
      // Under a mapped canopy for most of its length? Then no roof is generated.
      let roofed = 0;
      for (const [s, t0, t1] of spine) {
        const t = (t0 + t1) / 2, x = cx + ux * s - uz * t, z = cz + uz * s + ux * t;
        if (roofs.some((r) => G.pointInRing(x, z, r))) roofed++;
      }
      // Ramps down to the track bed at the platform ends (staff and stragglers use them), where they
      // stay clear of the trains.
      const ramps = [];
      for (const dir of [-1, 1]) {
        const end = dir < 0 ? spine[0] : spine[spine.length - 1];
        let sEnd = dir < 0 ? Infinity : -Infinity;
        for (const [x, z] of outer) { const sv = (x - cx) * ux + (z - cz) * uz; sEnd = dir < 0 ? Math.min(sEnd, sv) : Math.max(sEnd, sv); }
        const t = (end[1] + end[2]) / 2;
        for (const w of [Math.min(2.6, end[2] - end[1] - 0.4), 1.4]) {
          if (w < 1.4) continue;
          const sx = cx + ux * sEnd - uz * t, sz = cz + uz * sEnd + ux * t, L = 6;
          let ok = true;
          for (let k = 0; k <= L && ok; k++) for (const o of [-w / 2, 0, w / 2]) {
            const x = sx + ux * dir * k - uz * o, z = sz + uz * dir * k + ux * o;
            if (trackDist(x, z) < 1.95) { ok = false; break; }
          }
          if (ok) { ramps.push([r1(sx), r1(sz), r1(sx + ux * dir * L), r1(sz + uz * dir * L), r1(w)]); break; }
        }
      }
      outPl.push({ id: p.id, ref: p.tags.ref || p.tags['railway:ref'] || p.tags.local_ref || '', covered: p.tags.covered || '', ring: outer, cx, cz, ux, uz, spine, edges, ramps, mappedRoof: roofed / spine.length > 0.35, orig: ring });
    }
  }
  const inPlatform = (x, z) => outPl.find((p) => G.pointInRing(x, z, p.ring));

  // 2. Stations: platforms gather round the nearest named station node.
  const stations = [];
  const nodeFor = (x, z) => {
    let best = null, bd = 420;
    for (const [sx, sz, name, mr, hi] of stationNodes) { const d = Math.hypot(sx - x, sz - z); if (d < bd && name) { bd = d; best = { name, mr, hi, x: sx, z: sz }; } }
    return best;
  };
  for (const p of outPl) {
    const n = nodeFor(p.cx, p.cz), name = n ? stationName(n.name) : null;
    let st = stations.find((s) => (name ? s.name === name : !s.name) && Math.hypot(s.x - p.cx, s.z - p.cz) < 700);
    if (!st) stations.push(st = { name, mr: n?.mr || '', hi: n?.hi || '', x: n ? n.x : p.cx, z: n ? n.z : p.cz, pl: [] });
    st.pl.push(p);
    p.st = st;
  }

  // 3. Footbridges: chain the bridge ways, keep those over the railway or onto platforms.
  const chains = G.mergeChains(bridges.filter((b) => b.tags.highway !== 'steps').map((b) => b.refs));
  const ptsOf = new Map();
  for (const b of bridges) b.refs.forEach((r, i) => ptsOf.set(r, b.pts[i] || ptsOf.get(r)));
  const wayOfRef = new Map();
  for (const b of bridges) for (const r of b.refs) if (!wayOfRef.has(r)) wayOfRef.set(r, b);
  const decks = [];
  for (const refs of [...chains.open, ...chains.closed]) {
    const pts = refs.map((r) => ptsOf.get(r)).filter(Boolean);
    if (pts.length < 2 || !pts.some(inBox)) continue;
    const len = lengthOf(pts);
    if (len < 12) continue;
    const overRail = crossesRail(pts), onPl = pts.some(([x, z]) => inPlatform(x, z));
    if (!overRail && !onPl) continue;
    const tags = wayOfRef.get(refs[Math.floor(refs.length / 2)])?.tags || {};
    const w = Math.min(12, Math.max(2.5, parseFloat(tags.width) || (overRail ? 4 : 3)));
    const y = overRail || onPl ? DECK_RAIL : DECK_ROAD;
    const mid = pts[Math.floor(pts.length / 2)];
    let st = null, sd = 600;
    for (const s of stations) { const d = Math.hypot(s.x - mid[0], s.z - mid[1]); if (d < sd) { sd = d; st = s; } }
    decks.push({ pts: G.simplifyLine(pts, 0.3), w, y, covered: /yes/.test(tags.covered || '') || overRail, st, gaps: [], ids: new Set(refs.map((r) => wayOfRef.get(r)?.id)), len });
  }

  // 4. Stairs: mapped steps that start at a deck; generated ones where a deck has none.
  const stairs = [], usedSteps = new Set();
  const addStair = (deck, top, bottom, w, gen, esc = false) => {
    const dx = bottom[0] - top[0], dz = bottom[1] - top[1], l = Math.hypot(dx, dz) || 1;
    const y1 = inPlatform(bottom[0], bottom[1]) ? PLATFORM_TOP : GROUND, rise = deck.y - y1, need = rise / SLOPE;
    const L = Math.max(l, need), ux = dx / l, uz = dz / l;
    const b = [top[0] + ux * L, top[1] + uz * L];
    const on = nearestOn(deck.pts, top[0], top[1]);
    const segA = deck.pts[Math.max(0, on.i - 1)], segB = deck.pts[on.i];
    const sx = segB[0] - segA[0], sz = segB[1] - segA[1], sl = Math.hypot(sx, sz) || 1;
    const side = Math.abs((ux * sx + uz * sz) / sl) > 0.7 ? 0 : (ux * -sz + uz * sx) / sl > 0 ? 1 : -1; // 0: off the end of the deck
    deck.gaps.push([r1(on.a), side, r1(w)]);
    stairs.push({ deck, x0: top[0], z0: top[1], y0: deck.y, x1: b[0], z1: b[1], y1: inPlatform(b[0], b[1]) ? PLATFORM_TOP : y1, w, gen, esc });
  };
  for (const s of steps) {
    if (s.pts.length < 2) continue;
    const a = s.pts[0], b = s.pts[s.pts.length - 1];
    for (const deck of decks) {
      const na = nearestOn(deck.pts, a[0], a[1]), nb = nearestOn(deck.pts, b[0], b[1]);
      const reach = deck.w / 2 + 2.5;
      if (Math.min(na.d, nb.d) > reach || (na.d < reach && nb.d < reach)) continue;
      const [top, bot] = na.d < nb.d ? [a, b] : [b, a];
      // Start the stair at the deck's edge, heading away from it.
      const dx = bot[0] - top[0], dz = bot[1] - top[1], l = Math.hypot(dx, dz) || 1, nn = na.d < nb.d ? na : nb;
      const t0 = [nn.x + (dx / l) * (deck.w / 2), nn.z + (dz / l) * (deck.w / 2)];
      addStair(deck, t0, bot, Math.min(4, Math.max(1.8, parseFloat(s.tags.width) || 2.5)), false, s.tags.conveying === 'yes' || s.tags.highway === 'escalator');
      usedSteps.add(s.id);
      break;
    }
  }
  for (const deck of decks) {
    // A platform under the deck with no stair down to it: one along the platform.
    for (const p of outPl) {
      if (Math.hypot(p.cx - deck.pts[0][0], p.cz - deck.pts[0][1]) > deck.len + 400) continue;
      const hit = [];
      for (let i = 1; i < deck.pts.length; i++) {
        const A = deck.pts[i - 1], B = deck.pts[i];
        for (let k = 0; k < p.ring.length; k++) {
          const u = segCross(A, B, p.ring[k], p.ring[(k + 1) % p.ring.length]);
          if (u != null) hit.push([A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u]);
        }
      }
      if (deck.pts.some(([x, z]) => G.pointInRing(x, z, p.ring))) hit.push(...deck.pts.filter(([x, z]) => G.pointInRing(x, z, p.ring)));
      if (!hit.length) continue;
      const has = stairs.some((s) => s.deck === deck && G.pointInRing(s.x1, s.z1, p.ring));
      if (has) continue;
      // Where the deck passes over the platform's middle: stair along the platform's axis, to the longer side.
      const mx = hit.reduce((s, q) => s + q[0], 0) / hit.length, mz = hit.reduce((s, q) => s + q[1], 0) / hit.length;
      const sc = (mx - p.cx) * p.ux + (mz - p.cz) * p.uz, s0 = p.spine[0][0], s1 = p.spine[p.spine.length - 1][0];
      const dir = s1 - sc > sc - s0 ? 1 : -1, rise = deck.y - PLATFORM_TOP, L = rise / SLOPE;
      if ((dir > 0 ? s1 - sc : sc - s0) < L + deck.w / 2 + 2) continue;
      const sp = p.spine.reduce((b, q) => (Math.abs(q[0] - sc) < Math.abs(b[0] - sc) ? q : b));
      if (sp[2] - sp[1] < 4.2) continue; // too narrow for a stair beside the crowd
      const t = (sp[1] + sp[2]) / 2, ox = p.cx + p.ux * sc - p.uz * t, oz = p.cz + p.uz * sc + p.ux * t;
      const top = [ox + p.ux * dir * (deck.w / 2), oz + p.uz * dir * (deck.w / 2)];
      addStair(deck, top, [top[0] + p.ux * dir * L, top[1] + p.uz * dir * L], Math.min(3, sp[2] - sp[1] - 1.6), true);
    }
    // Deck ends with nothing going down: a stair straight on, to the ground (or platform).
    for (const end of [0, 1]) {
      const P = end ? deck.pts[deck.pts.length - 1] : deck.pts[0], Q = end ? deck.pts[deck.pts.length - 2] : deck.pts[1];
      if (stairs.some((s) => s.deck === deck && Math.hypot(s.x0 - P[0], s.z0 - P[1]) < deck.w + 4)) continue;
      if (decks.some((o) => o !== deck && o.pts.some((q) => Math.hypot(q[0] - P[0], q[1] - P[1]) < 3))) continue;
      const dx = P[0] - Q[0], dz = P[1] - Q[1], l = Math.hypot(dx, dz) || 1;
      addStair(deck, P, [P[0] + (dx / l) * 12, P[1] + (dz / l) * 12], Math.min(3, deck.w), true);
    }
  }
  // Piers under the decks: every ~18 m where nothing runs (not on a track).
  for (const deck of decks) {
    deck.piers = [];
    const L = lengthOf(deck.pts), n = Math.max(2, Math.round(L / 18));
    for (let k = 0; k <= n; k++) {
      let a = (L * k) / n;
      for (const shift of [0, 2, -2, 4, -4, 6, -6]) {
        const aa = Math.max(0, Math.min(L, a + shift));
        let acc = 0, x = 0, z = 0;
        for (let i = 1; i < deck.pts.length; i++) {
          const [ax, az] = deck.pts[i - 1], [bx, bz] = deck.pts[i], l = Math.hypot(bx - ax, bz - az);
          if (acc + l >= aa) { const f = (aa - acc) / (l || 1); x = ax + (bx - ax) * f; z = az + (bz - az) * f; break; }
          acc += l;
        }
        if (trackDist(x, z) < 2.6 || stairs.some((s) => s.deck === deck && G.segDist2([x, z], [s.x0, s.z0], [s.x1, s.z1]) < (s.w / 2 + 0.6) ** 2)) continue;
        deck.piers.push([r1(x), r1(z), inPlatform(x, z) ? PLATFORM_TOP : GROUND]);
        break;
      }
    }
  }

  // 5. Roads not to draw (the bridges and steps are built as decks and stairs).
  const skipRoads = new Set();
  for (const d of decks) for (const id of d.ids) if (id != null) skipRoads.add(id);
  for (const id of usedSteps) skipRoads.add(id);

  const json = {
    version: 1,
    note: 'Railway stations: raised platforms (ring, spine samples [s, t0, t1] along the axis, edges facing a track), foot overbridge decks with gaps for stairs [along, side, width] and piers [x, z, base], stairs from (x0, z0, y0) down to (x1, z1, y1). Metres in game coordinates.',
    platformTop: PLATFORM_TOP, deckRail: DECK_RAIL, deckRoad: DECK_ROAD,
    stations: stations.map((s) => ({ name: s.name || '', mr: s.mr, hi: s.hi, x: r1(s.x), z: r1(s.z) })),
    platforms: outPl.filter((p) => p.st).map((p) => ({
      st: stations.indexOf(p.st), ref: p.ref, ring: p.ring.map(([x, z]) => [r1(x), r1(z)]), axis: [r1(p.cx), r1(p.cz), +p.ux.toFixed(4), +p.uz.toFixed(4)],
      spine: p.spine.map(([s, a, b]) => [r1(s), r1(a), r1(b)]), edges: p.edges.join(''), roof: p.mappedRoof ? 0 : 1, ramps: p.ramps,
    })),
    decks: decks.map((d) => ({ st: stations.indexOf(d.st), pts: d.pts.map(([x, z]) => [r1(x), r1(z)]), w: r1(d.w), y: d.y, covered: d.covered ? 1 : 0, gaps: d.gaps, piers: d.piers })),
    stairs: stairs.map((s) => ({ deck: decks.indexOf(s.deck), x0: r1(s.x0), z0: r1(s.z0), y0: s.y0, x1: r1(s.x1), z1: r1(s.z1), y1: s.y1, w: r1(s.w), gen: s.gen ? 1 : 0, esc: s.esc ? 1 : 0 })),
  };
  log(`stations: ${stations.length} stations, ${json.platforms.length} raised platforms (${json.platforms.filter((p) => p.roof).length} with generated roofs), ${decks.length} foot overbridges, ${stairs.length} stairs (${stairs.filter((s) => s.gen).length} generated), ${skipRoads.size} flat footways replaced`);
  return { json, skipRoads, platforms: outPl };
}
