// Small 2D geometry helpers for the tile converter. Points are [x, z] arrays.

/** Signed area in (x, z). Positive = clockwise when seen on a north-up map. */
export function signedArea(ring) {
  let a = 0;
  for (let i = 0, n = ring.length, j = n - 1; i < n; j = i++) {
    a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return a / 2;
}

export function bboxOf(points, b = [Infinity, Infinity, -Infinity, -Infinity]) {
  for (const [x, z] of points) {
    if (x < b[0]) b[0] = x;
    if (z < b[1]) b[1] = z;
    if (x > b[2]) b[2] = x;
    if (z > b[3]) b[3] = z;
  }
  return b;
}

export const bboxOverlap = (a, b) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

export function pointInRing(x, z, ring) {
  let inside = false;
  for (let i = 0, n = ring.length, j = n - 1; i < n; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function centroid(ring) {
  let x = 0, z = 0;
  for (const p of ring) { x += p[0]; z += p[1]; }
  return [x / ring.length, z / ring.length];
}

/** Drop the closing duplicate point of a ring, if present. */
export function openRing(ring) {
  if (ring.length > 1) {
    const a = ring[0], b = ring[ring.length - 1];
    if (a[0] === b[0] && a[1] === b[1]) return ring.slice(0, -1);
  }
  return ring;
}

/** Douglas–Peucker simplification of an open polyline. */
export function simplifyLine(pts, tol, mustKeep = null) {
  if (pts.length <= 2) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  // Points that must survive (junctions shared with other roads) split the line into runs.
  const anchors = [0];
  if (mustKeep) for (let i = 1; i < pts.length - 1; i++) if (mustKeep(pts[i])) { keep[i] = 1; anchors.push(i); }
  anchors.push(pts.length - 1);
  const stack = [];
  for (let i = 0; i < anchors.length - 1; i++) if (anchors[i + 1] - anchors[i] > 1) stack.push([anchors[i], anchors[i + 1]]);
  const tol2 = tol * tol;
  while (stack.length) {
    const [a, b] = stack.pop();
    let maxD = -1, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = segDist2(pts[i], pts[a], pts[b]);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > tol2) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

/** Simplify a closed ring (given without the closing point). */
export function simplifyRing(ring, tol) {
  if (ring.length <= 4) return ring;
  // Split at the point farthest from the first one so both halves are well defined.
  let far = 0, best = -1;
  for (let i = 1; i < ring.length; i++) {
    const d = (ring[i][0] - ring[0][0]) ** 2 + (ring[i][1] - ring[0][1]) ** 2;
    if (d > best) { best = d; far = i; }
  }
  const a = simplifyLine(ring.slice(0, far + 1), tol);
  const b = simplifyLine(ring.slice(far).concat([ring[0]]), tol);
  return a.concat(b.slice(1, -1));
}

export function segDist2(p, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const len2 = dx * dx + dz * dz;
  let t = len2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const x = a[0] + t * dx - p[0], z = a[1] + t * dz - p[1];
  return x * x + z * z;
}

/**
 * Join ways (arrays of node ids) that share end points into longer chains.
 * keepDirection: only join end→start (needed for coastlines, whose direction matters).
 */
export function mergeChains(ways, keepDirection = false) {
  const open = [];
  const closed = [];
  for (const w of ways) {
    if (w.length < 2) continue;
    if (w[0] === w[w.length - 1]) closed.push(w.slice());
    else open.push(w.slice());
  }
  // Index chains by their end points so merging is close to linear.
  const byStart = new Map(), byEnd = new Map();
  const add = (c) => {
    (byStart.get(c[0]) || byStart.set(c[0], new Set()).get(c[0])).add(c);
    (byEnd.get(c[c.length - 1]) || byEnd.set(c[c.length - 1], new Set()).get(c[c.length - 1])).add(c);
  };
  const remove = (c) => { byStart.get(c[0])?.delete(c); byEnd.get(c[c.length - 1])?.delete(c); };
  const first = (set) => { if (!set) return null; for (const c of set) return c; return null; };
  open.forEach(add);
  const alive = new Set(open);
  const result = [];
  for (const start of open) {
    if (!alive.has(start)) continue;
    alive.delete(start); remove(start);
    let cur = start;
    for (;;) {
      if (cur[0] === cur[cur.length - 1]) break;
      let next = first(byStart.get(cur[cur.length - 1]));
      if (next) { alive.delete(next); remove(next); cur = cur.concat(next.slice(1)); continue; }
      next = first(byEnd.get(cur[0]));
      if (next) { alive.delete(next); remove(next); cur = next.concat(cur.slice(1)); continue; }
      if (keepDirection) break;
      next = first(byEnd.get(cur[cur.length - 1]));
      if (next) { alive.delete(next); remove(next); cur = cur.concat(next.slice(0, -1).reverse()); continue; }
      next = first(byStart.get(cur[0]));
      if (next) { alive.delete(next); remove(next); cur = next.slice(1).reverse().concat(cur); continue; }
      break;
    }
    (cur[0] === cur[cur.length - 1] ? closed : result).push(cur);
  }
  return { closed, open: result };
}

/**
 * Build land polygons from coastline pieces clipped to a box.
 * OpenStreetMap coastlines have land on the LEFT when walking along them on a
 * north-up map. Our z axis points south, so "left" flips; the walk below goes
 * around the box boundary anticlockwise on a north-up map.
 * pieces: open polylines whose first and last points lie on the box boundary.
 * islands: closed rings fully inside the box.
 */
export function buildLand(pieces, islands, box) {
  const [x0, z0, x1, z1] = box;
  const W = x1 - x0, H = z1 - z0, P = 2 * W + 2 * H;
  const eps = 1e-6;
  // Perimeter parameter, anticlockwise on a north-up map, starting at the south-west corner.
  const param = ([x, z]) => {
    if (Math.abs(z - z1) < eps) return x - x0;               // south edge, heading east
    if (Math.abs(x - x1) < eps) return W + (z1 - z);         // east edge, heading north
    if (Math.abs(z - z0) < eps) return W + H + (x1 - x);     // north edge, heading west
    if (Math.abs(x - x0) < eps) return 2 * W + H + (z - z0); // west edge, heading south
    return NaN;
  };
  const corners = [[0, [x0, z1]], [W, [x1, z1]], [W + H, [x1, z0]], [2 * W + H, [x0, z0]]];

  const parts = pieces
    .filter((p) => p.length >= 2)
    .map((pts) => ({ pts, tIn: param(pts[0]), tOut: param(pts[pts.length - 1]) }))
    .filter((p) => {
      const ok = Number.isFinite(p.tIn) && Number.isFinite(p.tOut);
      if (!ok) console.warn(`  coastline piece with an end inside the box was dropped (${p.pts.length} points)`);
      return ok;
    });

  const polys = [];
  const used = new Set();
  for (const start of parts) {
    if (used.has(start)) continue;
    used.add(start);
    const ring = start.pts.slice();
    let cur = start;
    for (let guard = 0; guard < 10000; guard++) {
      // Next entry point anticlockwise from where the coastline left the box.
      let best = null, bestD = Infinity;
      for (const p of parts) {
        if (used.has(p) && p !== start) continue;
        let d = (p.tIn - cur.tOut + P) % P;
        if (d < 1e-9 && p === cur && p !== start) d = P;
        if (d < bestD) { bestD = d; best = p; }
      }
      // Box corners passed on the way, in walk order.
      corners
        .map(([t, c]) => [(t - cur.tOut + P) % P, c])
        .filter(([d]) => d > 1e-9 && d < bestD)
        .sort((a, b) => a[0] - b[0])
        .forEach(([, c]) => ring.push(c));
      if (best === start) break;
      used.add(best);
      ring.push(...best.pts);
      cur = best;
    }
    polys.push(ring);
  }
  for (const isl of islands) polys.push(isl);
  return polys;
}
