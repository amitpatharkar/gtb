import * as THREE from 'three';

// Lofted vehicle bodies. A body is a list of stations along the car (z, front = +z); each
// station is a rounded-rectangle cross-section with its own bottom, top, half-width and
// tumblehome (how much narrower the top is than the bottom). Lofting stations gives smooth,
// car-like surfaces: curved bonnets, raked windscreens, wheel arches (the bottom line rises
// over each wheel) and rounded corners in plan — much closer to a real car than extruded
// side profiles, and still only a few hundred triangles.

/**
 * Smoothly sample a piecewise-linear function given as [[x, y], ...] (x ascending), with
 * a cosine ease between keys so curves don't show kinks.
 */
export function curve(keys, ease = true) {
  return (x) => {
    if (x <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [x1, y1] = keys[i];
      if (x <= x1) {
        const [x0, y0] = keys[i - 1];
        const t = (x - x0) / (x1 - x0 || 1);
        const s = ease ? (1 - Math.cos(t * Math.PI)) / 2 : t;
        return y0 + (y1 - y0) * s;
      }
    }
    return keys[keys.length - 1][1];
  };
}

/** Points of a rounded-rectangle ring (x across, y up), counter-clockwise seen from the front. */
function ring(y0, y1, hw, topW, rb, rt, n) {
  const pts = [];
  const h = Math.max(0.02, y1 - y0);
  rb = Math.min(rb, h * 0.45, hw * 0.9);
  rt = Math.min(rt, h * 0.45, topW * 0.9);
  const arc = (cx, cy, r, a0, a1) => { for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * (i / n); pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } };
  // Bottom-right corner → right side → top-right → top → top-left → left side → bottom-left.
  arc(hw - rb, y0 + rb, rb, -Math.PI / 2, 0);
  arc(topW - rt, y1 - rt, rt, 0, Math.PI / 2);
  arc(-topW + rt, y1 - rt, rt, Math.PI / 2, Math.PI);
  arc(-hw + rb, y0 + rb, rb, Math.PI, Math.PI * 1.5);
  return pts;
}

/**
 * Loft a body.
 * @param {number[]} zs stations along the car (ascending, rear to front)
 * @param {object} f functions of z: y0 (bottom), y1 (top), hw (half-width at the bottom),
 *   tw (half-width at the top), rb, rt (corner radii); missing ones get defaults
 * @param {object} [o] { n: points per corner arc, caps: close the ends }
 */
export function loft(zs, f, o = {}) {
  const n = o.n ?? 3;
  const rings = zs.map((z) => {
    const hw = f.hw(z), tw = f.tw ? f.tw(z) : hw;
    return ring(f.y0(z), f.y1(z), hw, tw, f.rb ? f.rb(z) : 0.08, f.rt ? f.rt(z) : 0.12, n);
  });
  const m = rings[0].length;
  const pos = [], idx = [];
  for (let s = 0; s < rings.length; s++) for (const [x, y] of rings[s]) pos.push(x, y, zs[s]);
  for (let s = 0; s < rings.length - 1; s++) {
    for (let i = 0; i < m; i++) {
      const a = s * m + i, b = s * m + ((i + 1) % m), c = (s + 1) * m + i, d = (s + 1) * m + ((i + 1) % m);
      idx.push(a, b, c, b, d, c);
    }
  }
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g = g.toNonIndexed();
  if (o.caps !== false) {
    // Flat end caps (separate vertices so they shade flat).
    const parts = [g];
    for (const [s, dir] of [[0, -1], [rings.length - 1, 1]]) {
      const r = rings[s], z = zs[s], cx = 0, cy = r.reduce((a, p) => a + p[1], 0) / m, cap = [];
      for (let i = 0; i < m; i++) {
        const p = r[i], q = r[(i + 1) % m];
        if (dir > 0) cap.push(cx, cy, z, p[0], p[1], z, q[0], q[1], z);
        else cap.push(cx, cy, z, q[0], q[1], z, p[0], p[1], z);
      }
      const cg = new THREE.BufferGeometry();
      cg.setAttribute('position', new THREE.Float32BufferAttribute(cap, 3));
      cg.computeVertexNormals();
      parts.push(cg);
    }
    g = mergePlain(parts);
  }
  return g;
}

/** Merge non-indexed geometries that only have position + normal. */
export function mergePlain(list) {
  let n = 0;
  for (const g of list) n += g.attributes.position.count;
  const p = new Float32Array(n * 3), nn = new Float32Array(n * 3);
  let o = 0;
  for (let g of list) {
    if (g.index) g = g.toNonIndexed();
    if (!g.attributes.normal) g.computeVertexNormals();
    p.set(g.attributes.position.array, o * 3);
    nn.set(g.attributes.normal.array, o * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(p, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nn, 3));
  return out;
}

/** Evenly spaced stations, plus extra ones packed around the given z values (wheel arches). */
export function stations(z0, z1, step, dense = [], denseHalf = 0.5, denseStep = 0.08) {
  const s = new Set();
  for (let z = z0; z < z1; z += step) s.add(+z.toFixed(3));
  s.add(+z1.toFixed(3));
  for (const c of dense) for (let z = c - denseHalf; z <= c + denseHalf + 1e-6; z += denseStep) if (z > z0 && z < z1) s.add(+z.toFixed(3));
  return [...s].sort((a, b) => a - b);
}

/** Bottom line with arches over wheels at zs (radius r, arch clearance), sill height `sill`. */
export function archLine(wheelZs, r, sill, clear = 0.06) {
  return (z) => {
    let y = sill;
    for (const wz of wheelZs) {
      const d = Math.abs(z - wz), R = r + clear;
      if (d < R) y = Math.max(y, r + Math.sqrt(R * R - d * d) * 0.92);
    }
    return y;
  };
}
