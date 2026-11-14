// Local train lines for the game (src/sim/trains.js), from OpenStreetMap route relations of
// the Mumbai suburban network: one polyline per physical track and direction, clipped to
// the map box, with the stations along it (distance, platform side).
//
// What the relations look like in the 2026-11 extract: member ways are in order and join end
// to end (no gaps inside the box), stops are stop_position nodes on the track, and every
// service has its own track except the two Harbour branches (shared from the terminus to
// Vadala Road) and the last few hundred metres into Churchgate (one platform track is used
// in both directions).
import { clipPolyline } from 'lineclip';
import * as G from './geometry.mjs';

const TRAIN = 245;       // a 12-coach train (m): how far from the buffers its middle stands
const CLEAR = 3.9;       // least distance between the centres of neighbouring tracks (a coach is 3.66 m wide)
const PLATFORM = 4.9;    // a platform edge this close to the track centre serves that track (m)
const ROUTES = { W: 'Western line', C: 'Central line', H: 'Harbour line' };

/** Suburban services the game runs (the Trans-Harbour and Uran lines are outside the map). */
export const isTrainRoute = (t) => t.type === 'route' && t.route === 'train' && /mumbai suburban/i.test(t.network || '') && !!ROUTES[t.ref];

/**
 * Station names as shown in the game: real place names without the mappers' brackets
 * ("Dadar (Central)", "Santa Cruz (WR)"), and the terminus under the game's altered name.
 */
export function stationName(n) {
  n = (n || '').replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
  if (/\bcsm?t\b|chhatrapati shivaji|victoria terminus/i.test(n)) return 'Chhatrapati Chai Terminus';
  return n;
}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const cumOf = (pts) => { const c = [0]; for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + dist(pts[i], pts[i - 1])); return c; };
const total = (L) => L.cum[L.cum.length - 1];
const setPts = (L, pts) => { L.pts = pts; L.cum = cumOf(pts); };

/** Point at distance d along a line, with the (unnormalised) direction of travel there. */
function pointAt(L, d) {
  const c = L.cum;
  let lo = 1, hi = c.length - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (c[m] < d) lo = m + 1; else hi = m; }
  const a = L.pts[lo - 1], b = L.pts[lo], f = Math.max(0, Math.min(1, (d - c[lo - 1]) / (c[lo] - c[lo - 1] || 1)));
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, b[0] - a[0], b[1] - a[1]];
}

/** Nearest point of a line to p, optionally only between two distances along it: { d, dist }. */
function locate(L, p, from = -Infinity, to = Infinity) {
  let best = { d: 0, dist: Infinity };
  for (let i = 1; i < L.pts.length; i++) {
    if (L.cum[i] < from || L.cum[i - 1] > to) continue;
    const a = L.pts[i - 1], b = L.pts[i], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2));
    const dd = Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t);
    if (dd < best.dist) best = { d: L.cum[i - 1] + Math.sqrt(l2) * t, dist: dd };
  }
  return best;
}

/**
 * @param routes        [{ id, tags, members }] relations accepted by isTrainRoute
 * @param wayRefs       Map way id → node ids, for every member way
 * @param stops         Map node id → { x, z, name } for stop members inside the box
 * @param stationNodes  [[x, z, name]] railway=station / halt nodes (names for unnamed stops)
 * @param platforms     [[[x, z], …]] platform outlines and edges
 * @param resolveLine   node ids → polylines of known points (split where nodes are missing)
 * @param box           [x0, z0, x1, z1] in game metres
 * @returns { lines, json, shift } — json is the object for trains.json (null without lines);
 *          shift(x, z) → [dx, dz] moves a point of a train track clear of its neighbours (for the drawn rails)
 */
export function buildTrainLines({ routes, wayRefs, stops, stationNodes, platforms, resolveLine, box, log }) {
  const inBox = (p) => p[0] >= box[0] - 0.01 && p[0] <= box[2] + 0.01 && p[1] >= box[1] - 0.01 && p[1] <= box[3] + 0.01;
  const wayLen = new Map(); // way id → metres inside the box
  const lenIn = (id) => {
    if (!wayLen.has(id)) {
      let s = 0;
      for (const pts of resolveLine(wayRefs.get(id) || [])) for (const part of clipPolyline(pts, box)) s += total({ cum: cumOf(part) });
      wayLen.set(id, s);
    }
    return wayLen.get(id);
  };

  // 1. Chain each relation's ways into node lists; keep the longest run inside the box.
  const lines = [];
  let gaps = 0;
  for (const rel of [...routes].sort((a, b) => a.id - b.id)) {
    const ids = rel.members.filter((m) => m.type === 'way' && !/platform/.test(m.role) && wayRefs.has(m.ref)).map((m) => m.ref);
    const chains = [];
    let cur = null;
    ids.forEach((id, i) => {
      let refs = wayRefs.get(id);
      const last = cur?.[cur.length - 1];
      if (cur && refs[0] === last) cur.push(...refs.slice(1));
      else if (cur && refs[refs.length - 1] === last) cur.push(...refs.slice(0, -1).reverse());
      else {
        // A new chain (the first way, or after a gap): face it towards the next way.
        const nx = wayRefs.get(ids[i + 1]);
        if (nx && (refs[0] === nx[0] || refs[0] === nx[nx.length - 1])) refs = refs.slice().reverse();
        if (cur) gaps++;
        chains.push(cur = [...refs]);
      }
    });
    let best = null;
    for (const chain of chains) {
      const runs = resolveLine(chain);
      runs.forEach((pts, ri) => {
        for (const part of clipPolyline(pts, box)) {
          const len = total({ cum: cumOf(part) });
          if (best && len <= best.len) continue;
          // A line that starts or ends inside the box does so at the buffers of a terminus.
          best = {
            pts: part, len,
            termStart: ri === 0 && inBox(pts[0]) && dist(part[0], pts[0]) < 0.01 && chain === chains[0],
            termEnd: ri === runs.length - 1 && inBox(pts[pts.length - 1]) && dist(part[part.length - 1], pts[pts.length - 1]) < 0.01 && chain === chains[chains.length - 1],
          };
        }
      });
    }
    if (!best || best.len < 600) continue;
    const t = rel.tags, route = t.ref;
    const L = {
      rel: rel.id, route, name: ROUTES[route], fast: /fast/i.test(t.name || ''), from: stationName(t.from), to: stationName(t.to),
      ways: new Set(ids), termStart: best.termStart, termEnd: best.termEnd, turn: null, single: 0,
      stopNodes: rel.members.filter((m) => m.type === 'node' && /^stop/.test(m.role)).map((m) => stops.get(m.ref)).filter(Boolean),
    };
    setPts(L, G.simplifyLine(best.pts, 0.15).map(([x, z]) => [Math.round(x * 10) / 10, Math.round(z * 10) / 10]));
    L.len = ids.reduce((s, id) => s + lenIn(id), 0);
    // Services on the same track in the same direction (Kalyan, Kasara and Khopoli fasts): the first one stands for all.
    const twin = lines.find((o) => {
      let shared = 0;
      for (const id of L.ways) if (o.ways.has(id)) shared += lenIn(id);
      return shared > 0.8 * L.len && dist(o.pts[0], L.pts[0]) < dist(o.pts[0], L.pts[L.pts.length - 1]);
    });
    if (twin) continue;
    lines.push(L);
  }
  if (!lines.length) return { lines, json: null, shift: null };

  // 2. Termini. A train that arrives leaves again as the service in the other direction, so
  // both must use one platform track. Churchgate is mapped that way; at the other terminus
  // the relations use neighbouring platforms, so the arriving line is led across to the
  // departing line's track where the two run side by side outside the station.
  for (const L of lines) {
    L.dir = L.termEnd ? 'up' : L.termStart ? 'down' : /terminus|churchgate/i.test(L.to) ? 'up' : 'down';
    L.far = (L.dir === 'up' ? L.from : L.to).toLowerCase().replace(/[^a-z]+/g, '-');
  }
  for (const U of lines) {
    if (!U.termEnd) continue;
    const end = U.pts[U.pts.length - 1];
    const D = lines.find((d) => d.termStart && d.route === U.route && d.fast === U.fast && d.far === U.far && dist(d.pts[0], end) < 40);
    if (!D) continue;
    if (dist(D.pts[0], end) > 0.5 && !crossOver(U, D)) continue;
    U.turn = D;
    // Length of single track before the buffers that both directions use.
    let x = 0;
    while (x + 10 < Math.min(total(U), total(D)) && dist(pointAt(U, total(U) - x - 10), pointAt(D, x + 10)) < 0.5) x += 10;
    U.single = x;
  }

  // 2b. Neighbouring tracks are sometimes mapped closer together than a train is wide (the
  // Central fast lines for kilometres): move them apart, so that passing trains do not touch.
  const shift = spreader(lines);
  let moved = 0, most = 0;
  for (const L of lines) {
    const pts = [];
    for (let i = 0; i < L.pts.length; i++) {
      if (i) {
        const n = Math.ceil((L.cum[i] - L.cum[i - 1]) / 20);
        for (let k = 1; k < n; k++) pts.push(pointAt(L, L.cum[i - 1] + ((L.cum[i] - L.cum[i - 1]) * k) / n).slice(0, 2));
      }
      pts.push(L.pts[i]);
    }
    L.spread = pts.map(([x, z]) => { const [dx, dz] = shift(x, z); if (dx || dz) moved++; most = Math.max(most, Math.hypot(dx, dz)); return [x + dx, z + dz]; });
  }
  for (const L of lines) setPts(L, G.simplifyLine(L.spread, 0.1).map(([x, z]) => [Math.round(x * 10) / 10, Math.round(z * 10) / 10]));
  if (moved) log(`trains: ${(moved * 0.02).toFixed(1)} km of track moved sideways (${most.toFixed(1)} m at most) to give passing trains room`);

  // 2c. Where different lines cross on the level (flyovers are flat in the game): the timetable keeps trains apart there.
  const crossings = [];
  for (let a = 0; a < lines.length; a++) for (let b = a + 1; b < lines.length; b++) {
    const A = lines[a], B = lines[b], bb = G.bboxOf(B.pts);
    for (let i = 1; i < A.pts.length; i++) {
      const p = A.pts[i - 1], q = A.pts[i];
      if (Math.max(p[0], q[0]) < bb[0] || Math.min(p[0], q[0]) > bb[2] || Math.max(p[1], q[1]) < bb[1] || Math.min(p[1], q[1]) > bb[3]) continue;
      for (let j = 1; j < B.pts.length; j++) {
        const r = B.pts[j - 1], s = B.pts[j];
        if (Math.max(r[0], s[0]) < Math.min(p[0], q[0]) || Math.min(r[0], s[0]) > Math.max(p[0], q[0]) || Math.max(r[1], s[1]) < Math.min(p[1], q[1]) || Math.min(r[1], s[1]) > Math.max(p[1], q[1])) continue;
        const ax = q[0] - p[0], az = q[1] - p[1], bx = s[0] - r[0], bz = s[1] - r[1], den = ax * bz - az * bx;
        if (Math.abs(den) < 0.02 * Math.hypot(ax, az) * Math.hypot(bx, bz)) continue; // the same track, or side by side
        const u = ((r[0] - p[0]) * bz - (r[1] - p[1]) * bx) / den, v = ((r[0] - p[0]) * az - (r[1] - p[1]) * ax) / den;
        if (u < 0 || u > 1 || v < 0 || v > 1) continue;
        const da = A.cum[i - 1] + u * Math.hypot(ax, az), db = B.cum[j - 1] + v * Math.hypot(bx, bz);
        // Two lines on one track (a branch's trunk, the single line into a terminus) only seem to cross.
        if ([-15, 15].every((o) => locate(B, pointAt(A, da + o), db - 40, db + 40).dist < 0.7)) continue;
        if (!crossings.some((c) => c[0] === a && c[2] === b && Math.abs(c[1] - da) < 30)) crossings.push([a, da, b, db]);
      }
    }
  }

  // 3. Stations: the relation's stop positions, moved to the middle of their platform.
  const edges = []; // platform edge segments
  for (const pl of platforms) for (let i = 1; i < pl.length; i++) edges.push([pl[i - 1], pl[i]]);
  for (const L of lines) {
    const tot = total(L), seen = new Set();
    L.stations = [];
    for (const s of L.stopNodes) {
      const at = locate(L, [s.x, s.z]);
      if (at.dist > 15) continue;
      const near = edges.filter(([a]) => Math.abs(a[0] - s.x) < 450 && Math.abs(a[1] - s.z) < 450);
      // Clearance to the nearest platform edge on each side, every 5 m along the track.
      const scan = [];
      for (let o = -350; o <= 350; o += 5) {
        const d = at.d + o;
        if (d < 0 || d > tot) continue;
        const [px, pz, fx, fz] = pointAt(L, d), fl = Math.hypot(fx, fz) || 1;
        const gap = [Infinity, Infinity]; // left, right of travel
        for (const [a, b] of near) {
          const mx = (a[0] + b[0]) / 2 - px, mz = (a[1] + b[1]) / 2 - pz;
          if (Math.abs(mx) > 60 || Math.abs(mz) > 60) continue;
          const right = (mx * -fz + mz * fx) / fl > 0 ? 1 : 0;
          const dd = Math.sqrt(G.segDist2([px, pz], a, b));
          if (dd < gap[right]) gap[right] = dd;
        }
        scan.push({ o, gap });
      }
      // The stretch of platform next to the stop, per side: [from, to, clearance].
      const stretch = (k) => {
        let best = null, run = null;
        const flush = () => { if (run && (!best || Math.max(0, run[0], -run[1]) < Math.max(0, best[0], -best[1]))) best = run; run = null; };
        for (const { o, gap } of scan) {
          if (gap[k] < PLATFORM) { if (!run) run = [o, o, gap[k]]; run[1] = o; run[2] = Math.min(run[2], gap[k]); } else flush();
        }
        flush();
        return best && Math.max(0, best[0], -best[1]) <= 60 && best[1] - best[0] >= 40 ? best : null;
      };
      const left = stretch(0), right = stretch(1);
      const pf = left && right ? (Math.abs(left[2] - right[2]) < 1.5 ? [Math.max(left[0], right[0]), Math.min(left[1], right[1]), Math.max(left[2], right[2])] : left[2] < right[2] ? left : right) : left || right;
      let d = at.d;
      if (pf) {
        // A train stands in the middle of the platform (or around the stop on a very long one).
        const half = Math.max(0, (pf[1] - pf[0] - TRAIN) / 2), mid = (pf[0] + pf[1]) / 2;
        d = at.d + Math.max(mid - half, Math.min(mid + half, 0));
      }
      if (L.termStart) d = Math.max(d, TRAIN / 2 + 6);
      if (L.termEnd) d = Math.min(d, tot - TRAIN / 2 - 6);
      if (d < 20 || d > tot - 20) continue;
      let name = stationName(s.name);
      if (!name) {
        // Unnamed stop: the station node next to it.
        let bd = 400;
        for (const [x, z, n] of stationNodes) { const dd = Math.hypot(x - s.x, z - s.z); if (dd < bd && stationName(n)) { bd = dd; name = stationName(n); } }
      }
      if (!name || seen.has(name)) continue;
      seen.add(name);
      // side: -1 platform on the left of travel, 1 on the right, 2 both, 0 not mapped.
      const side = !pf ? 0 : left && right && Math.abs(left[2] - right[2]) < 1.5 ? 2 : pf === left ? -1 : 1;
      L.stations.push({ name, d, side, off: Math.max(3.4, (pf ? pf[2] : 2) + 1.4) });
    }
    L.stations.sort((a, b) => a.d - b.d);
  }
  // An arriving train stops exactly where the departing one stands.
  for (const U of lines) {
    const D = U.turn;
    if (!D || !D.stations.length) continue;
    const f = D.stations[0], st = { name: f.name, d: total(U) - f.d, side: Math.abs(f.side) === 1 ? -f.side : f.side, off: f.off };
    const i = U.stations.findIndex((s) => s.name === f.name);
    if (i >= 0) U.stations[i] = st; else U.stations.push(st);
  }

  // 4. Names and the file.
  const used = new Set();
  for (const L of lines) {
    let id = `${L.route}${L.route === 'H' ? `-${L.far}` : ''}-${L.fast ? 'fast' : 'slow'}-${L.dir}`;
    if (used.has(id)) id += `-${L.rel}`;
    used.add(id);
    L.id = id;
  }
  const dm = (v) => Math.round(v * 10);
  const json = {
    version: 1,
    note: 'Local train lines: pts are decimetres (first point, then steps); stations are [name, decimetres along the line, platform side (-1 left, 1 right, 2 both, 0 unknown), stand-off from the track centre in decimetres].',
    lines: lines.map((L) => {
      const pts = [];
      let px = 0, pz = 0;
      for (const [x, z] of L.pts) { pts.push(dm(x) - px, dm(z) - pz); px = dm(x); pz = dm(z); }
      return {
        id: L.id, route: L.route, name: L.name, fast: L.fast ? 1 : 0, dir: L.dir, from: L.from, to: L.to,
        start: L.termStart ? 1 : 0, end: L.termEnd ? 1 : 0, turn: L.turn ? lines.indexOf(L.turn) : -1, single: Math.round(L.single),
        pts, stations: L.stations.map((s) => [s.name, dm(s.d), s.side, dm(s.off)]),
      };
    }),
    // Level crossings between lines: [line, decimetres along it, other line, decimetres along that].
    crossings: crossings.map(([a, da, b, db]) => [a, dm(da), b, dm(db)]),
  };
  const names = new Set(lines.flatMap((L) => L.stations.map((s) => s.name)));
  log(`trains: ${lines.length} lines (${[...new Set(lines.map((L) => L.name))].join(', ')}), ${(lines.reduce((s, L) => s + total(L), 0) / 1000).toFixed(1)} km of track, ${names.size} stations (${lines.reduce((s, L) => s + L.stations.length, 0)} stops), ${lines.filter((L) => L.turn).length} turn-rounds${gaps ? `, ${gaps} gaps in the relations` : ''}`);
  return { lines, json, shift };
}

/**
 * shift(x, z) → [dx, dz] for a point on a train track: half of what is missing to CLEAR from
 * each neighbouring line that runs alongside closer than that. Tracks that are about to meet
 * (points, a crossing) are left alone, and the shift fades in over 70 m beyond them.
 * Works on the geometry as it is when called, so every track is judged against the original
 * position of its neighbours and both move half way.
 */
function spreader(lines) {
  const cell = 16, grid = new Map(), F = lines.map((L) => ({ pts: L.pts, cum: L.cum }));
  F.forEach((L, li) => {
    for (let i = 1; i < L.pts.length; i++) {
      const a = L.pts[i - 1], b = L.pts[i];
      for (let gx = Math.floor((Math.min(a[0], b[0]) - 5) / cell); gx <= Math.floor((Math.max(a[0], b[0]) + 5) / cell); gx++)
        for (let gz = Math.floor((Math.min(a[1], b[1]) - 5) / cell); gz <= Math.floor((Math.max(a[1], b[1]) + 5) / cell); gz++) {
          const k = `${gx},${gz}`;
          (grid.get(k) || grid.set(k, []).get(k)).push([li, i]);
        }
    }
  });
  /** Nearest point of every line within 5 m of (x, z): Map line → { d, x, z, tx, tz, at }. */
  const near = (x, z) => {
    const out = new Map();
    for (const [li, i] of grid.get(`${Math.floor(x / cell)},${Math.floor(z / cell)}`) || []) {
      const L = F[li], a = L.pts[i - 1], b = L.pts[i], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (l * l))), qx = a[0] + dx * t, qz = a[1] + dz * t, d = Math.hypot(x - qx, z - qz);
      if (d < 5 && !(out.get(li)?.d <= d)) out.set(li, { d, x: qx, z: qz, tx: dx / l, tz: dz / l, at: L.cum[i - 1] + l * t });
    }
    return out;
  };
  return (x, z) => {
    const all = near(x, z);
    let self = -1, me = null;
    for (const [li, n] of all) if (n.d < 0.5 && (self < 0 || n.d < me.d)) { self = li; me = n; }
    let sx = 0, sz = 0;
    if (self < 0) return [0, 0];
    for (const [li, n] of all) {
      if (n.d < 0.5 || n.d >= CLEAR || Math.abs(n.tx * me.tx + n.tz * me.tz) < 0.99) continue;
      // How far along our own line until the two tracks (nearly) touch?
      let meet = 200;
      for (let o = 20; o <= 100 && meet > 100; o += 20) for (const sgn of [-1, 1]) {
        const at = me.at + o * sgn;
        if (at < 0 || at > total(F[self])) continue;
        const p = pointAt(F[self], at), g = near(p[0], p[1]).get(li);
        if (g && g.d < 1.3) meet = Math.min(meet, o);
      }
      const k = Math.max(0, Math.min(1, (meet - 30) / 70)), w = (k * k * (3 - 2 * k) * (CLEAR - n.d)) / 2 / n.d;
      sx += (x - n.x) * w; sz += (z - n.z) * w;
    }
    return [sx, sz];
  };
}

/**
 * Lead line U (arriving) across to line D's track (departing) outside the terminus, where
 * the two are closest and parallel, and let it run in on D's platform track.
 */
function crossOver(U, D) {
  const tot = total(U), HALF = 50;
  let best = null;
  for (let s = 300; s <= Math.min(900, tot - 200, total(D) - 200); s += 10) {
    const p = pointAt(U, tot - s), q = locate(D, p, 0, s + 150);
    const score = q.dist + s * 0.003;
    if (!best || score < best.score) best = { s, score, dist: q.dist };
  }
  if (!best || best.dist > 9) return false;
  const head = U.pts.filter((_, i) => U.cum[i] < tot - best.s - HALF - 1);
  const cross = [];
  let join = 0;
  for (let s = best.s + HALF; s >= best.s - HALF; s -= 10) {
    const p = pointAt(U, tot - s), at = locate(D, p, 0, s + 150), q = pointAt(D, at.d);
    const k = (best.s + HALF - s) / (2 * HALF), w = k * k * (3 - 2 * k);
    cross.push([Math.round((p[0] + (q[0] - p[0]) * w) * 10) / 10, Math.round((p[1] + (q[1] - p[1]) * w) * 10) / 10]);
    join = at.d;
  }
  const tail = D.pts.filter((_, i) => D.cum[i] < join - 1).reverse();
  setPts(U, [...head, ...cross, ...tail]);
  return true;
}
