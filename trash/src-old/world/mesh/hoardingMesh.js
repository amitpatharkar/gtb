// Rooftop hoardings (billboards): a board on steel posts along the street-facing edge of a
// roof. The ad itself comes from a canvas atlas (src/world/hoardings.js); the last two
// cells of the atlas are steel (lattice for the back of the board, plain for the posts).
import { wall, WHITE } from './builder.js';

export const HOARDING = { COLS: 4, ROWS: 8, ADS: 30, BACK: 30, STEEL: 31 };

/** UV rectangle of an atlas cell, inset a little so neighbours don't bleed in. */
function cell(i, inset = 0.004) {
  const c = i % HOARDING.COLS, r = Math.floor(i / HOARDING.COLS);
  return [c / HOARDING.COLS + inset, (c + 1) / HOARDING.COLS - inset, 1 - (r + 1) / HOARDING.ROWS + inset, 1 - r / HOARDING.ROWS - inset];
}

/**
 * A hoarding above the wall a→b (outward normal n), standing on the roof at height `top`.
 * @param {number} ad atlas cell of the advertisement
 */
export function addHoarding(m, ax, az, bx, bz, nx, nz, top, ad) {
  const len = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / len, dz = (bz - az) / len;
  const W = Math.min(13, Math.max(6, len - 1.5)), H = W / 2, half = W / 2, t = 0.12;
  const mx = (ax + bx) / 2 - nx * 0.55, mz = (az + bz) / 2 - nz * 0.55; // set back from the roof edge
  const y0 = top + 1.1, y1 = y0 + H;
  const Ax = mx - dx * half, Az = mz - dz * half, Bx = mx + dx * half, Bz = mz + dz * half;
  const [u0, u1, v0, v1] = cell(ad), [s0, s1, t0, t1] = cell(HOARDING.BACK), [p0, p1, q0, q1] = cell(HOARDING.STEEL, 0.03);
  // Front: seen from outside, the reader's left is at b.
  wall(m, Ax + nx * t, Az + nz * t, Bx + nx * t, Bz + nz * t, y0, y1, nx, nz, u1, u0, v0, v1, WHITE);
  // Back: steel lattice.
  wall(m, Bx - nx * t, Bz - nz * t, Ax - nx * t, Az - nz * t, y0, y1, -nx, -nz, s0, s1, t0, t1, WHITE);
  // Edges of the board.
  wall(m, Bx + nx * t, Bz + nz * t, Bx - nx * t, Bz - nz * t, y0, y1, dx, dz, p0, p1, q0, q1, WHITE);
  wall(m, Ax - nx * t, Az - nz * t, Ax + nx * t, Az + nz * t, y0, y1, -dx, -dz, p0, p1, q0, q1, WHITE);
  // Posts down to the roof, and a brace behind each.
  const posts = W > 9 ? [-0.38, 0, 0.38] : [-0.32, 0.32];
  for (const k of posts) {
    const px = mx + dx * W * k - nx * (t + 0.1), pz = mz + dz * W * k - nz * (t + 0.1), r = 0.1;
    const c = [[px - dx * r + nx * r, pz - dz * r + nz * r], [px + dx * r + nx * r, pz + dz * r + nz * r], [px + dx * r - nx * r, pz + dz * r - nz * r], [px - dx * r - nx * r, pz - dz * r - nz * r]];
    const nrm = [[nx, nz], [dx, dz], [-nx, -nz], [-dx, -dz]];
    for (let i = 0; i < 4; i++) { const a = c[i], b = c[(i + 1) % 4]; wall(m, a[0], a[1], b[0], b[1], top - 0.2, y0 + H * 0.5, nrm[i][0], nrm[i][1], p0, p1, q0, q1, WHITE); }
    // Brace: a thin strut from the middle of the board back down to the roof.
    const bx2 = px - nx * H * 0.45, bz2 = pz - nz * H * 0.45, w = 0.05;
    for (const sgn of [1, -1]) {
      const i0 = m.v(px - dx * w * sgn, y0 + H * 0.45, pz - dz * w * sgn, dx * sgn, 0, dz * sgn, p0, q0, WHITE);
      const i1 = m.v(px + dx * w * sgn, y0 + H * 0.45, pz + dz * w * sgn, dx * sgn, 0, dz * sgn, p1, q0, WHITE);
      const i2 = m.v(bx2 + dx * w * sgn, top, bz2 + dz * w * sgn, dx * sgn, 0, dz * sgn, p1, q1, WHITE);
      const i3 = m.v(bx2 - dx * w * sgn, top, bz2 - dz * w * sgn, dx * sgn, 0, dz * sgn, p0, q1, WHITE);
      if (sgn > 0) { m.tri(i0, i1, i2); m.tri(i0, i2, i3); } else { m.tri(i0, i2, i1); m.tri(i0, i3, i2); }
    }
  }
}
