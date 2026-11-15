// Building shapes beyond "footprint pushed straight up" (tile worker): Art Deco rounded corners
// and stepped crowns, pitched clay-tile and slate roofs, Gothic gables and corner turrets, and
// chawl galleries. Everything is drawn into the building's wall mesh (facade material), using
// facade codes (facadeRules.js CODE) for what the shader paints on each face, so no extra draw
// calls. Rings are tile-local (x, z), outer rings counter-clockwise (positive signed area).
import { CODE } from '../facadeRules.js';
import { pointInRing } from './builder.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * Any polygon face (3 or 4 points [x, y, z]) facing along nrm, with per-vertex UVs ([u, v]) and
 * bay coordinates (facade attribute 0). Winding is chosen to face the normal.
 */
export function face(m, pts, nrm, uvs, col, bays = null) {
  const idx = pts.map((p, i) => { if (bays) m.cur[0] = bays[i]; return m.v(p[0], p[1], p[2], nrm[0], nrm[1], nrm[2], uvs[i][0], uvs[i][1], col); });
  const [a, b, c] = pts;
  const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  const flip = cr[0] * nrm[0] + cr[1] * nrm[1] + cr[2] * nrm[2] < 0;
  const tri = (p, q, r) => (flip ? m.tri(p, r, q) : m.tri(p, q, r));
  tri(idx[0], idx[1], idx[2]);
  if (idx.length === 4) tri(idx[0], idx[2], idx[3]);
}

const norm3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

/** Normal of a planar face that points away from `inside` (a point behind it). */
function outNormal(a, b, c, inside) {
  let n = norm3(cross3(sub3(b, a), sub3(c, a)));
  if ((inside[0] - a[0]) * n[0] + (inside[1] - a[1]) * n[1] + (inside[2] - a[2]) * n[2] > 0) n = [-n[0], -n[1], -n[2]];
  return n;
}

/**
 * Art Deco corners: convex street corners (one of the two walls faces a street) of 45–120°
 * turn become arcs of radius 1.5–4 m. Returns the new ring, its street-facing flags and the arc
 * groups (edge → group, group length, each edge's start along its group), or null.
 */
export function roundCorners(ring, front) {
  const n = ring.length / 2;
  const plan = new Array(n).fill(null);
  let any = false;
  for (let i = 0; i < n; i++) {
    const p = (i - 1 + n) % n, q = (i + 1) % n;
    const e1x = ring[i * 2] - ring[p * 2], e1z = ring[i * 2 + 1] - ring[p * 2 + 1];
    const e2x = ring[q * 2] - ring[i * 2], e2z = ring[q * 2 + 1] - ring[i * 2 + 1];
    const l1 = Math.hypot(e1x, e1z), l2 = Math.hypot(e2x, e2z);
    if (l1 < 5 || l2 < 5 || e1x * e2z - e1z * e2x <= 0 || (!front[p] && !front[i])) continue;
    const turn = Math.acos(clamp((e1x * e2x + e1z * e2z) / (l1 * l2), -1, 1));
    if (turn < 0.75 || turn > 2.1) continue;
    const tan = Math.tan(turn / 2);
    const R = Math.min(4, 0.24 * Math.min(l1, l2), (0.36 * Math.min(l1, l2)) / tan);
    if (R < 1.5) continue;
    plan[i] = { R, t: R * tan, turn, u1: [e1x / l1, e1z / l1] };
    any = true;
  }
  if (!any) return null;
  const out = [], fr = [], edge = [], start = [], len = [];
  for (let i = 0; i < n; i++) {
    const pl = plan[i];
    if (!pl) { out.push(ring[i * 2], ring[i * 2 + 1]); fr.push(front[i]); edge.push(-1); start.push(0); continue; }
    const sx = ring[i * 2] - pl.u1[0] * pl.t, sz = ring[i * 2 + 1] - pl.u1[1] * pl.t;
    const cx = sx - pl.u1[1] * pl.R, cz = sz + pl.u1[0] * pl.R;
    const k = Math.max(3, Math.ceil(pl.turn / (Math.PI / 12)));
    const a0 = Math.atan2(sz - cz, sx - cx), g = len.length, chord = 2 * pl.R * Math.sin(pl.turn / k / 2);
    const f = front[(i - 1 + n) % n] || front[i] ? 1 : 0;
    for (let j = 0; j <= k; j++) {
      const a = a0 + (pl.turn * j) / k;
      out.push(cx + Math.cos(a) * pl.R, cz + Math.sin(a) * pl.R);
      if (j < k) { fr.push(f); edge.push(g); start.push(j * chord); } else { fr.push(front[i]); edge.push(-1); start.push(0); }
    }
    len.push(k * chord);
  }
  return { ring: new Float32Array(out), front: Uint8Array.from(fr), edge, start, len };
}

/** A near-rectangular 4-corner ring: corners ordered so that AB is a long side, plus its sizes. */
export function rectOf(ring) {
  if (ring.length !== 8) return null;
  const P = [0, 1, 2, 3].map((i) => [ring[i * 2], ring[i * 2 + 1]]);
  for (let i = 0; i < 4; i++) {
    const a = P[(i + 3) % 4], b = P[i], c = P[(i + 1) % 4];
    const ux = b[0] - a[0], uz = b[1] - a[1], vx = c[0] - b[0], vz = c[1] - b[1];
    if (Math.abs(ux * vx + uz * vz) / (Math.hypot(ux, uz) * Math.hypot(vx, vz) || 1) > 0.17) return null;
  }
  const l01 = Math.hypot(P[1][0] - P[0][0], P[1][1] - P[0][1]), l12 = Math.hypot(P[2][0] - P[1][0], P[2][1] - P[1][1]);
  const p = l01 >= l12 ? P : [P[1], P[2], P[3], P[0]];
  return { p, long: Math.max(l01, l12), short: Math.min(l01, l12) };
}

/**
 * Pitched roof over a rectangle: two tiled slopes (CODE.TILES, vertex colour = tiles) with
 * eaves overhanging by `over`, gable walls at the short ends (code `gableCode`, wall colour) and
 * the underside of the slopes (roof mesh, dark rafters) so the eaves read from the street.
 */
export function pitchedRoof(m, under, rect, eaveY, rise, over, tileCol, wallLow, wallCol, gableCode, darkCol) {
  const [A, B, C, D] = rect.p;
  const L = Math.hypot(B[0] - A[0], B[1] - A[1]), S = Math.hypot(D[0] - A[0], D[1] - A[1]);
  const u = [(B[0] - A[0]) / L, (B[1] - A[1]) / L], v = [(D[0] - A[0]) / S, (D[1] - A[1]) / S];
  const slope = rise / (S / 2), yE = eaveY - over * slope, yR = eaveY + rise;
  const P = (p, du, dv, y) => [p[0] + u[0] * du + v[0] * dv, y, p[1] + u[1] * du + v[1] * dv];
  const M1 = [(A[0] + D[0]) / 2, (A[1] + D[1]) / 2], M2 = [(B[0] + C[0]) / 2, (B[1] + C[1]) / 2];
  const a = P(A, -over, -over, yE), b = P(B, over, -over, yE), c = P(C, over, over, yE), d = P(D, -over, over, yE);
  const r1 = P(M1, -over, 0, yR), r2 = P(M2, over, 0, yR);
  const slopeLen = Math.hypot(S / 2 + over, rise + over * slope);
  const mid = [(A[0] + C[0]) / 2, eaveY, (A[1] + C[1]) / 2];
  m.cur[5] = CODE.TILES;
  for (const [p0, p1, q1, q0] of [[a, b, r2, r1], [c, d, r1, r2]]) {
    const n = outNormal(p0, p1, q1, mid);
    const along = (p) => (p[0] - a[0]) * u[0] + (p[2] - a[2]) * u[1];
    face(m, [p0, p1, q1, q0], n, [[along(p0), 0], [along(p1), 0], [along(q1), slopeLen], [along(q0), slopeLen]], tileCol);
    face(under, [p0, p1, q1, q0], [-n[0], -n[1], -n[2]], [[0, 0], [1, 0], [1, 1], [0, 1]], darkCol);
  }
  // Gable walls in the planes of the short ends.
  m.cur[5] = gableCode; m.cur[3] = rise; m.cur[4] = eaveY; m.cur[6] = S;
  for (const [p, q, mm, sgn] of [[D, A, M1, -1], [B, C, M2, 1]]) {
    const n = [u[0] * sgn, 0, u[1] * sgn];
    face(m, [[p[0], eaveY, p[1]], [q[0], eaveY, q[1]], [mm[0], yR, mm[1]]], n, [[0, eaveY], [S, eaveY], [S / 2, yR]], wallLow, [0, 1, 0.5]);
  }
}

/**
 * Gothic street gable on top of a wall (Fort): a stone triangle (CODE.GABLE: round window) on
 * the parapet with a coped top, and behind it a short steep tiled roof running back into the
 * building as far as the footprint allows. ax..bx: the gable's base on the wall line.
 */
export function gable(m, outer, holes, ax, az, bx, bz, nx, nz, baseY, tileCol, wallCol) {
  const w = Math.hypot(bx - ax, bz - az), gh = 0.62 * w, T = 0.4;
  const cx = (ax + bx) / 2, cz = (az + bz) / 2;
  const inside = (x, z) => pointInRing(x, z, outer) && !holes.some((h) => pointInRing(x, z, h));
  let D = 0;
  for (const d of [10, 7, 5, 3.4]) if (inside(ax - nx * d + (bx - ax) * 0.05, az - nz * d + (bz - az) * 0.05) && inside(bx - nx * d - (bx - ax) * 0.05, bz - nz * d - (bz - az) * 0.05) && inside(cx - nx * d, cz - nz * d)) { D = d; break; }
  const A = [ax, baseY, az], B = [bx, baseY, bz], X = [cx, baseY + gh, cz];
  const back = (p, d) => [p[0] - nx * d, p[1], p[2] - nz * d];
  m.cur[5] = CODE.GABLE; m.cur[3] = gh; m.cur[4] = baseY; m.cur[6] = w;
  face(m, [A, B, X], [nx, 0, nz], [[0, baseY], [w, baseY], [w / 2, baseY + gh]], wallCol, [0, 1, 0.5]);
  m.cur[5] = CODE.BLANK; m.cur[0] = 0;
  // Coping: the two sloped top faces of the gable's thickness.
  const rake = Math.hypot(w / 2, gh);
  for (const [p, q] of [[A, X], [X, B]]) {
    const n = outNormal(p, q, back(q, T), [cx - nx * T / 2, baseY, cz - nz * T / 2]);
    face(m, [p, q, back(q, T), back(p, T)], n, [[0, 0], [rake, 0], [rake, T], [0, T]], wallCol);
  }
  if (!D) { face(m, [back(A, T), back(B, T), back(X, T)], [-nx, 0, -nz], [[0, baseY], [w, baseY], [w / 2, baseY + gh]], wallCol); return; }
  // Steep roof behind the gable, its ridge just under the coping, closed by a plain back gable.
  const Xr = [cx, baseY + gh - 0.12, cz], len = Math.hypot(w / 2, gh - 0.12);
  m.cur[5] = CODE.TILES;
  for (const p of [A, B]) {
    const p0 = back(p, T), p1 = back(p, D), q1 = back(Xr, D), q0 = back(Xr, T);
    const n = outNormal(p0, p1, q1, [cx - nx * D / 2, baseY, cz - nz * D / 2]);
    face(m, [p0, p1, q1, q0], n, [[0, 0], [D, 0], [D, len], [0, len]], tileCol);
  }
  m.cur[5] = CODE.BLANK;
  face(m, [back(A, D), back(B, D), back(Xr, D)], [-nx, 0, -nz], [[0, baseY], [w, baseY], [w / 2, baseY + gh]], wallCol);
}

/**
 * Corner turret: an octagonal stone shaft corbelled out at a building corner from a few metres
 * below the roof, with arched windows (window code on its faces) and a slate spire.
 */
export function turret(m, cx, cz, r, yb, yt, low, wallCol, slateCol) {
  const N = 8, pts = [];
  for (let k = 0; k <= N; k++) { const a = (k / N) * Math.PI * 2 + Math.PI / N; pts.push([Math.cos(a), Math.sin(a)]); }
  const side = 2 * r * Math.sin(Math.PI / N);
  let u = 0;
  for (let k = 0; k < N; k++) {
    const [c0, s0] = pts[k], [c1, s1] = pts[k + 1];
    const am = ((k + 0.5) / N) * Math.PI * 2 + Math.PI / N, nx = Math.cos(am), nz = Math.sin(am);
    const p0 = [cx + c0 * r, cz + s0 * r], p1 = [cx + c1 * r, cz + s1 * r];
    // Shaft (windows below the roof line, as on the building's own walls).
    m.cur[5] = CODE.WINDOWS; m.cur[6] = side;
    face(m, [[p0[0], yb, p0[1]], [p1[0], yb, p1[1]], [p1[0], yt, p1[1]], [p0[0], yt, p0[1]]], [nx, 0, nz], [[u, yb], [u + side, yb], [u + side, yt], [u, yt]], wallCol, [0, 1, 1, 0]);
    // Corbel: tapering to a point 1.3 m below.
    m.cur[5] = CODE.BLANK; m.cur[0] = 0;
    const tip = [cx, yb - 1.3, cz];
    face(m, [[p0[0], yb, p0[1]], [p1[0], yb, p1[1]], tip], norm3([nx, -0.8, nz]), [[u, yb], [u + side, yb], [u + side / 2, yb - 1.3]], low);
    // Spire (slate) with a small overhang.
    const R = r + 0.15, q0 = [cx + c0 * R, cz + s0 * R], q1 = [cx + c1 * R, cz + s1 * R], H = 2.6 * r, sl = Math.hypot(H, R);
    m.cur[5] = CODE.TILES;
    face(m, [[q0[0], yt, q0[1]], [q1[0], yt, q1[1]], [cx, yt + H, cz]], norm3([nx * H, R, nz * H]), [[0, 0], [side, 0], [side / 2, sl]], slateCol);
    m.cur[5] = CODE.BLANK;
    face(m, [[p0[0], yt, p0[1]], [p1[0], yt, p1[1]], [q1[0], yt, q1[1]], [q0[0], yt, q0[1]]], [0, -1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], low);
    u += side;
  }
}

/** Box-shaped block of wall (plain): ax..bx on the wall line, `depth` m into the building, ya..yb. */
export function block(m, ax, az, bx, bz, nx, nz, ya, yb, depth, col) {
  const w = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / w, dz = (bz - az) / w;
  const ix = -nx * depth, iz = -nz * depth;
  m.cur[5] = CODE.BLANK; m.cur[0] = 0;
  const q = (p0, p1, n, ww) => face(m, [[p0[0], ya, p0[1]], [p1[0], ya, p1[1]], [p1[0], yb, p1[1]], [p0[0], yb, p0[1]]], n, [[0, ya], [ww, ya], [ww, yb], [0, yb]], col);
  q([ax, az], [bx, bz], [nx, 0, nz], w);
  q([bx + ix, bz + iz], [ax + ix, az + iz], [-nx, 0, -nz], w);
  q([ax + ix, az + iz], [ax, az], [-dx, 0, -dz], depth);
  q([bx, bz], [bx + ix, bz + iz], [dx, 0, dz], depth);
  face(m, [[ax, yb, az], [bx, yb, bz], [bx + ix, yb, bz + iz], [ax + ix, yb, az + iz]], [0, 1, 0], [[0, 0], [w, 0], [w, depth], [0, depth]], col);
}

/**
 * Thin horizontal slab sticking out of a wall (Art Deco eyebrow over the windows): front, top,
 * bottom and (caps) both end caps, plain wall.
 */
export function slab(m, ax, az, bx, bz, nx, nz, y, thick, depth, col, caps = true) {
  const w = Math.hypot(bx - ax, bz - az);
  const fx = nx * depth, fz = nz * depth, y0 = y - thick / 2, y1 = y + thick / 2;
  m.cur[5] = CODE.BLANK; m.cur[0] = 0;
  face(m, [[ax + fx, y0, az + fz], [bx + fx, y0, bz + fz], [bx + fx, y1, bz + fz], [ax + fx, y1, az + fz]], [nx, 0, nz], [[0, y0], [w, y0], [w, y1], [0, y1]], col);
  face(m, [[ax, y1, az], [bx, y1, bz], [bx + fx, y1, bz + fz], [ax + fx, y1, az + fz]], [0, 1, 0], [[0, 0], [w, 0], [w, depth], [0, depth]], col);
  face(m, [[ax, y0, az], [bx, y0, bz], [bx + fx, y0, bz + fz], [ax + fx, y0, az + fz]], [0, -1, 0], [[0, 0], [w, 0], [w, depth], [0, depth]], col);
  if (!caps) return;
  const dx = (bx - ax) / w, dz = (bz - az) / w;
  face(m, [[ax, y0, az], [ax + fx, y0, az + fz], [ax + fx, y1, az + fz], [ax, y1, az]], [-dx, 0, -dz], [[0, y0], [depth, y0], [depth, y1], [0, y1]], col);
  face(m, [[bx, y0, bz], [bx + fx, y0, bz + fz], [bx + fx, y1, bz + fz], [bx, y1, bz]], [dx, 0, dz], [[0, y0], [depth, y0], [depth, y1], [0, y1]], col);
}
