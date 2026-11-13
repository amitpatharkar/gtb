// Street details generated from road centrelines: lane markings (trimmed at junctions),
// zebra crossings, street trees and street lights. Coordinates are metres (x east, z south).
import { ROAD, ROAD_FLAG, POINT } from '../../src/world/tileFormat.js';

/** Footpath width on each side of a road, by class (Mumbai footpaths: 1.5–3.5 m). */
export const FOOTPATH = {
  [ROAD.TRUNK]: 3.2, [ROAD.PRIMARY]: 3.2, [ROAD.SECONDARY]: 2.6, [ROAD.TERTIARY]: 2.2,
  [ROAD.RESIDENTIAL]: 1.6, [ROAD.LIVING]: 1.2,
};
export const isVehicle = (cls) => cls <= ROAD.SERVICE || cls === ROAD.TRACK;
const MARKED = (cls) => cls <= ROAD.TERTIARY || cls === ROAD.LINK;

/** Cumulative length at each vertex. */
export function arcLengths(pts) {
  const s = [0];
  for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return s;
}

/** Polyline shifted sideways by o metres (positive = left of travel), mitred joins. */
export function offsetLine(pts, o) {
  if (!o) return pts.map((p) => p.slice());
  const n = pts.length, out = [];
  const perp = (i) => {
    const dx = pts[i + 1][0] - pts[i][0], dz = pts[i + 1][1] - pts[i][1], l = Math.hypot(dx, dz) || 1;
    return [-dz / l, dx / l];
  };
  for (let i = 0; i < n; i++) {
    let px, pz, k = 1;
    if (i === 0) [px, pz] = perp(0);
    else if (i === n - 1) [px, pz] = perp(n - 2);
    else {
      const a = perp(i - 1), b = perp(i);
      px = a[0] + b[0]; pz = a[1] + b[1];
      const l = Math.hypot(px, pz);
      if (l < 1e-3) { [px, pz] = a; } else { px /= l; pz /= l; k = 1 / Math.max(0.5, px * a[0] + pz * a[1]); }
    }
    out.push([pts[i][0] + px * o * k, pts[i][1] + pz * o * k]);
  }
  return out;
}

/** Part of a polyline between arc lengths a and b (s = centreline arc lengths per vertex). */
export function sliceLine(pts, s, a, b) {
  const out = [];
  const at = (t) => {
    let i = 1;
    while (i < s.length - 1 && s[i] < t) i++;
    const f = s[i] > s[i - 1] ? (t - s[i - 1]) / (s[i] - s[i - 1]) : 0;
    return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f];
  };
  out.push(at(a));
  for (let i = 0; i < s.length; i++) if (s[i] > a && s[i] < b) out.push(pts[i].slice());
  out.push(at(b));
  return out;
}

/** Point and unit direction at arc length t. */
function pointAt(pts, s, t) {
  let i = 1;
  while (i < s.length - 1 && s[i] < t) i++;
  const f = s[i] > s[i - 1] ? (t - s[i - 1]) / (s[i] - s[i - 1]) : 0;
  const dx = pts[i][0] - pts[i - 1][0], dz = pts[i][1] - pts[i - 1][1], l = Math.hypot(dx, dz) || 1;
  return { x: pts[i - 1][0] + dx * f, z: pts[i - 1][1] + dz * f, dx: dx / l, dz: dz / l };
}

/** Subtract intervals from [0, L]; returns kept intervals. */
function keep(L, cuts) {
  const sorted = cuts.map(([a, b]) => [Math.max(0, a), Math.min(L, b)]).filter(([a, b]) => b > a).sort((p, q) => p[0] - q[0]);
  const out = [];
  let cur = 0;
  for (const [a, b] of sorted) { if (a > cur) out.push([cur, a]); cur = Math.max(cur, b); }
  if (cur < L) out.push([cur, L]);
  return out.filter(([a, b]) => b - a > 0.5);
}

/**
 * Junction info from node ids: arms per node and widest half-width meeting there.
 * parts: [{ ids, hw, info: { cls } }]
 */
export function junctions(parts) {
  const arms = new Map(), hw = new Map();
  for (const p of parts) {
    if (!isVehicle(p.info.cls)) continue;
    p.ids.forEach((id, i) => {
      arms.set(id, (arms.get(id) || 0) + (i === 0 || i === p.ids.length - 1 ? 1 : 2));
      hw.set(id, Math.max(hw.get(id) || 0, p.hw));
    });
  }
  return { isJunction: (id) => (arms.get(id) || 0) >= 3, radius: (id) => (hw.get(id) || 3) + 1.5 };
}

/**
 * Lane markings and zebra crossings. Returns [{ width, pts }] (white paint).
 * signals/crossings: Sets of node ids with highway=traffic_signals / highway=crossing.
 */
export function markings(parts, junc, signalNear, crossingIds) {
  const out = [];
  for (const p of parts) {
    const { cls, width, flags } = p.info;
    if (!MARKED(cls) || width < 5 || p.pts.length < 2) continue;
    const s = arcLengths(p.pts), L = s[s.length - 1];
    if (L < 6) continue;
    const hw = width / 2;
    const cuts = [], zebras = [];
    p.ids.forEach((id, i) => {
      if (junc.isJunction(id)) {
        const r = junc.radius(id);
        cuts.push([s[i] - r, s[i] + r]);
        // Zebra crossings on the arms of signal-controlled junctions (main roads only).
        if (cls <= ROAD.TERTIARY && signalNear(p.pts[i])) {
          if (s[i] - r - 3.2 > 0) { zebras.push([s[i] - r - 3.2, s[i] - r - 0.2]); cuts.push([s[i] - r - 4, s[i] - r]); }
          if (s[i] + r + 3.2 < L) { zebras.push([s[i] + r + 0.2, s[i] + r + 3.2]); cuts.push([s[i] + r, s[i] + r + 4]); }
        }
      } else if (crossingIds.has(id) && s[i] > 2 && s[i] < L - 2) {
        zebras.push([s[i] - 1.5, s[i] + 1.5]);
        cuts.push([s[i] - 2.3, s[i] + 2.3]);
      }
    });
    const spans = keep(L, cuts);
    const oneway = flags & ROAD_FLAG.ONEWAY;
    const lanes = Math.max(oneway ? 1 : 2, Math.min(8, parseInt(p.tags.lanes, 10) || (oneway ? Math.round(width / 3.4) : 2 * Math.max(1, Math.round(width / 7)))));
    const laneW = width / lanes;
    const lines = [];
    for (let k = 1; k < lanes; k++) lines.push({ o: -hw + k * laneW, dash: true, w: 0.13 });
    if (cls <= ROAD.SECONDARY && width >= 7) for (const sgn of [1, -1]) lines.push({ o: sgn * (hw - 0.35), dash: false, w: 0.15 });
    for (const ln of lines) {
      const op = offsetLine(p.pts, ln.o);
      for (const [a, b] of spans) {
        if (!ln.dash) { out.push({ width: ln.w, pts: sliceLine(op, s, a, b) }); continue; }
        // 3 m dashes every 8 m, phase tied to the road so tiles line up.
        for (let t = Math.ceil(a / 8) * 8; t < b; t += 8) {
          const e = Math.min(b, t + 3);
          if (e - t > 0.8) out.push({ width: ln.w, pts: sliceLine(op, s, t, e) });
        }
      }
    }
    for (const [a, b] of zebras) {
      for (let o = -hw + 0.7; o <= hw - 0.6; o += 1.0) out.push({ width: 0.5, pts: sliceLine(offsetLine(p.pts, o), s, a, b) });
    }
  }
  return out;
}

/**
 * Street trees and lights along roads with footpaths.
 * opts: { district(x,z), blocked(x,z) → bool, junc, rand(seed) → 0..1 }
 */
export function streetFurniture(parts, opts) {
  const trees = [], lights = [], clutter = [];
  for (const p of parts) {
    const { cls, width } = p.info;
    const fw = FOOTPATH[cls];
    if (!fw || p.pts.length < 2) continue;
    const s = arcLengths(p.pts), L = s[s.length - 1];
    if (L < 10) continue;
    const hw = width / 2;
    const near = [];
    p.ids.forEach((id, i) => { if (opts.junc.isJunction(id)) near.push([s[i], opts.junc.radius(id)]); });
    const clear = (t, gap) => near.every(([q, r]) => Math.abs(q - t) > r + gap);
    const marineDrive = /marine drive|netaji subhash/i.test(p.tags.name || '') || /marine drive/i.test(p.tags['name:en'] || '');
    for (const side of [1, -1]) {
      // Trees: every ~17 m, thinned by the district's greenery.
      for (let t = 6 + (p.id % 7); t < L - 4; t += 13 + opts.rand(p.id * 31 + t) * 9) {
        if (!clear(t, 5)) continue;
        const q = pointAt(p.pts, s, t);
        const x = q.x - q.dz * side * (hw + fw * 0.6), z = q.z + q.dx * side * (hw + fw * 0.6);
        const d = opts.district(x, z);
        const r = opts.rand(p.id * 7 + Math.round(t * 10) + side);
        const palm = marineDrive || d.palms;
        if (r > (palm ? 0.75 : d.trees) || opts.blocked(x, z)) continue;
        trees.push({ kind: palm && opts.rand(r * 1e6) < 0.85 ? POINT.PALM : treeKind(opts.rand(x * 13.1 + z)), x, z, angle: r * Math.PI * 2, size: 0.8 + opts.rand(x + z * 7.7) * 0.5 });
      }
      // Thelas and stalls on busy footpaths (fruit, vada pav, chai), facing the road.
      const d0 = opts.district(p.pts[0][0], p.pts[0][1]);
      if (cls <= ROAD.RESIDENTIAL && fw >= 1.6) {
        for (let t = 15 + (p.id % 13); t < L - 8; t += 23 + opts.rand(p.id * 3 + t) * 30) {
          if (!clear(t, 4) || opts.rand(p.id * 11 + t * 3 + side) > d0.shops * 0.35) continue;
          const q = pointAt(p.pts, s, t);
          const x = q.x - q.dz * side * (hw + fw * 0.55), z = q.z + q.dx * side * (hw + fw * 0.55);
          if (opts.blocked(x, z)) continue;
          clutter.push({ kind: POINT.STALL, x, z, angle: Math.atan2(q.dz * side, -q.dx * side), size: 0.7 + opts.rand(x * 3 + z) * 0.8 });
        }
      }
      // Garbage piles near junction corners in dense districts.
      if (cls >= ROAD.TERTIARY && d0.shops > 0.5) {
        for (const [q0, r] of near) {
          for (const dir of [-1, 1]) {
            const t = q0 + dir * (r + 2.5);
            if (t < 1 || t > L - 1 || opts.rand(p.id * 5 + q0 + dir * 7 + side) > 0.18) continue;
            const q = pointAt(p.pts, s, t);
            const x = q.x - q.dz * side * (hw + fw + 0.6), z = q.z + q.dx * side * (hw + fw + 0.6);
            if (opts.blocked(x, z)) continue;
            clutter.push({ kind: POINT.GARBAGE, x, z, angle: opts.rand(x + z) * 6.28, size: 0.7 + opts.rand(x - z) * 0.9 });
          }
        }
      }
      // Lights: main roads, ~32 m apart, on the kerb facing the road.
      if (cls <= ROAD.TERTIARY && (side === 1 || width >= 11)) {
        for (let t = 10 + (p.id % 11); t < L - 5; t += 32) {
          if (!clear(t, 2)) continue;
          const q = pointAt(p.pts, s, t);
          const x = q.x - q.dz * side * (hw + 0.5), z = q.z + q.dx * side * (hw + 0.5);
          if (opts.blocked(x, z)) continue;
          lights.push({ kind: POINT.LIGHT, x, z, angle: Math.atan2(q.dz * side, -q.dx * side), size: 1 });
        }
      }
    }
  }
  // Potholes and waterlogged patches on the asphalt (lanes and side streets suffer most).
  for (const p of parts) {
    const { cls, width } = p.info;
    if (!isVehicle(p.info.cls) || p.pts.length < 2 || cls === ROAD.TRACK) continue;
    const s = arcLengths(p.pts), L = s[s.length - 1], hw = width / 2;
    // Main roads: the odd pothole; tertiary: some; colony lanes and gallis: plenty.
    const rate = cls <= ROAD.SECONDARY ? 0.07 : cls <= ROAD.LINK ? 0.4 : 0.85;
    const gap = cls <= ROAD.SECONDARY ? 60 : cls <= ROAD.LINK ? 35 : 14;
    for (let t = 8 + (p.id % 17); t < L - 4; t += gap + opts.rand(p.id * 13 + t) * gap * 2) {
      const r = opts.rand(p.id * 17 + t * 7);
      if (r > rate) continue;
      const q = pointAt(p.pts, s, t);
      const puddle = opts.rand(t * 3 + p.id) < 0.3;
      const o = puddle ? (opts.rand(t + p.id) < 0.5 ? -1 : 1) * Math.max(0, hw - 0.9) : (opts.rand(t * 5 - p.id) - 0.5) * Math.max(0, 2 * hw - 1.8);
      clutter.push({ kind: puddle ? POINT.PUDDLE : POINT.POTHOLE, x: q.x - q.dz * o, z: q.z + q.dx * o, angle: opts.rand(t + 1) * 6.28, size: puddle ? 1.0 + r * 0.9 : 0.6 + r * 0.9 });
    }
  }
  return { trees, lights, clutter };
}

export function treeKind(r) {
  return r < 0.5 ? POINT.RAIN_TREE : r < 0.75 ? POINT.GULMOHAR : POINT.PEEPAL;
}
