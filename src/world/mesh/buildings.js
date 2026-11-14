// Buildings for one tile. Walls carry per-vertex facade data that the facade shader
// (src/world/facade.js) turns into windows, balconies, AC units, shopfronts and signs.
import { BUILDING_FLAG } from '../tileFormat.js';
import { Y } from '../levels.js';
import { MeshBuilder, wall, flatPolygon, linear, rand, signedArea, pointInRing, WHITE } from './builder.js';
import { WINDOW_RECT, SHOP_STOREY, K, cellHash, cellFeatures } from '../facadeRules.js';
import { addHoarding, HOARDING } from './hoardingMesh.js';

// 3D facade parts (instanced near the player): 7 floats each — x, y, z, yaw, width, height, colour/extra.
export const PART_TYPES = ['frame', 'sill', 'chajja', 'grille', 'ac', 'balcony', 'sign', 'shutterBox'];
const PARTS_MAX_Y = 27;   // real geometry on the lower ~8 floors; higher up the shader carries the detail
const CHAJJA_STYLES = new Set([0, 1, 2, 5]);
const CORNICE_STYLES = new Set([0, 2, 3, 4, 5]);

/** Horizontal strip sticking out of a wall (cornice/band): front, top and bottom faces, blank facade. */
function strip(m, ax, az, bx, bz, nx, nz, y, height, depth, u0, u1, col) {
  const fx = nx * depth, fz = nz * depth;
  const y0 = y - height / 2, y1 = y + height / 2;
  const q = (p, nrm, uv) => p.map(([x, yy, z], i) => m.v(x, yy, z, nrm[0], nrm[1], nrm[2], uv[i][0], uv[i][1], col));
  const front = q([[ax + fx, y0, az + fz], [bx + fx, y0, bz + fz], [bx + fx, y1, bz + fz], [ax + fx, y1, az + fz]], [nx, 0, nz], [[u0, y0], [u1, y0], [u1, y1], [u0, y1]]);
  const top = q([[ax, y1, az], [bx, y1, bz], [bx + fx, y1, bz + fz], [ax + fx, y1, az + fz]], [0, 1, 0], [[u0, 0], [u1, 0], [u1, depth], [u0, depth]]);
  const bot = q([[ax, y0, az], [bx, y0, bz], [bx + fx, y0, bz + fz], [ax + fx, y0, az + fz]], [0, -1, 0], [[u0, 0], [u1, 0], [u1, depth], [u0, depth]]);
  for (const [a, b, c, d] of [front, top, bot]) {
    // Pick the winding that faces along the quad's normal.
    const p = m.p, nI = m.n;
    const e1 = [p[b * 3] - p[a * 3], p[b * 3 + 1] - p[a * 3 + 1], p[b * 3 + 2] - p[a * 3 + 2]];
    const e2 = [p[c * 3] - p[a * 3], p[c * 3 + 1] - p[a * 3 + 1], p[c * 3 + 2] - p[a * 3 + 2]];
    const cx = e1[1] * e2[2] - e1[2] * e2[1], cy = e1[2] * e2[0] - e1[0] * e2[2], cz = e1[0] * e2[1] - e1[1] * e2[0];
    if (cx * nI[a * 3] + cy * nI[a * 3 + 1] + cz * nI[a * 3 + 2] >= 0) { m.tri(a, b, c); m.tri(a, c, d); } else { m.tri(a, c, b); m.tri(a, d, c); }
  }
}

// Styles (same order as scripts/lib/districts.mjs STYLE).
export const STYLES = ['plaster', 'weathered', 'deco', 'stone', 'basalt', 'concrete', 'glass', 'shed', 'brick'];
const BAY = [3.3, 3.0, 3.4, 3.7, 3.7, 3.4, 1.6, 4.0, 3.2]; // metres per window column
const PARAPET = 0.9;
export const FACADE_FLOATS = 7; // bay coordinate, style, seed (integer), storey height, roof height, shop (1) / blank (2), bay width

/** Wall quad whose vertices carry a running "bay" coordinate for the window grid. */
function facadeWall(m, ax, az, bx, bz, y0, y1, nx, nz, u0, u1, b0, b1, cBottom, cTop) {
  m.cur[0] = b0; const a0 = m.v(ax, y0, az, nx, 0, nz, u0, y0, cBottom);
  m.cur[0] = b1; const v0 = m.v(bx, y0, bz, nx, 0, nz, u1, y0, cBottom);
  m.cur[0] = b1; const v1 = m.v(bx, y1, bz, nx, 0, nz, u1, y1, cTop);
  m.cur[0] = b0; const a1 = m.v(ax, y1, az, nx, 0, nz, u0, y1, cTop);
  if ((bz - az) * nx - (bx - ax) * nz >= 0) { m.tri(a0, v1, v0); m.tri(a0, a1, v1); }
  else { m.tri(a0, v0, v1); m.tri(a0, v1, a1); }
}

/** Ring moved inwards by d metres (mitred). Outer rings have positive signed area. */
function inset(ring, d) {
  const n = ring.length / 2, out = new Float32Array(ring.length);
  for (let i = 0; i < n; i++) {
    const p = (i - 1 + n) % n, q = (i + 1) % n;
    const ex = ring[i * 2] - ring[p * 2], ez = ring[i * 2 + 1] - ring[p * 2 + 1];
    const fx = ring[q * 2] - ring[i * 2], fz = ring[q * 2 + 1] - ring[i * 2 + 1];
    const le = Math.hypot(ex, ez) || 1, lf = Math.hypot(fx, fz) || 1;
    // Inward normals of the two edges: (-dz, dx).
    let nx = -ez / le - fz / lf, nz = ex / le + fx / lf;
    const ln = Math.hypot(nx, nz) || 1;
    nx /= ln; nz /= ln;
    const k = d / Math.max(0.35, nx * (-ez / le) + nz * (ex / le));
    out[i * 2] = ring[i * 2] + nx * k; out[i * 2 + 1] = ring[i * 2 + 1] + nz * k;
  }
  return out;
}

/** ox, oz: the tile centre in texture (UV) space (roofs); toWorld: tile-local ring → world metres (collisions). */
export function buildBuildings(t, ox, oz, toWorld) {
  const b = new Map();
  const walls = (style) => b.get(`walls${style}`) || b.set(`walls${style}`, new MeshBuilder(FACADE_FLOATS)).get(`walls${style}`);
  const get = (key) => b.get(key) || b.set(key, new MeshBuilder()).get(key);
  const tanks = [], solid = [];
  let hoardings = 0; // per tile
  const parts = Object.fromEntries(PART_TYPES.map((k) => [k, []]));

  t.buildings.forEach((bd, bi) => {
    // Landmark outlines: collide, but a hand-built model is drawn instead.
    if (bd.flags & BUILDING_FLAG.HIDDEN) { if (!(bd.flags & BUILDING_FLAG.NO_COLLIDE)) solid.push(bd.rings.map(toWorld)); return; }
    const style = Math.min(bd.style, STYLES.length - 1);
    const outer = bd.rings[0];
    const area = Math.abs(signedArea(outer));
    const seed = rand(t.tx * 7919 + bi, t.tz * 104729 + bi);
    const hex = (bd.color[0] << 16) | (bd.color[1] << 8) | bd.color[2];
    const base = linear(hex, 0.96 + seed * 0.08);
    const low = linear(hex, 0.82);
    const canopy = bd.minHeight > 0.2;
    const y0 = canopy ? bd.minHeight : -0.4;
    const h = bd.height;
    const parapet = !canopy && h > 5 && area > 30 && style !== 7;
    const top = parapet ? h + PARAPET : h;
    const levels = Math.max(1, bd.levels);
    const storey = Math.min(4.6, Math.max(2.7, (h - 0.6) / levels));
    const m = walls(style);
    m.cur[1] = style + 0.5; m.cur[2] = Math.floor(seed * 997); m.cur[3] = storey; m.cur[4] = h;

    bd.rings.forEach((ring, ri) => {
      const n = ring.length / 2;
      let u = seed * 7;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const ax = ring[i * 2], az = ring[i * 2 + 1], bx = ring[j * 2], bz = ring[j * 2 + 1];
        const len = Math.hypot(bx - ax, bz - az);
        if (len < 0.05) continue;
        const bays = Math.round(len / BAY[style]);
        const shop = ri === 0 && (bd.flags & BUILDING_FLAG.SHOPS) && bd.front[i] && len > 2.5;
        m.cur[5] = bays < 1 || canopy ? 2 : shop ? 1 : 0;
        m.cur[6] = len / Math.max(1, bays);
        const nx = (bz - az) / len, nz = -(bx - ax) / len;
        facadeWall(m, ax, az, bx, bz, y0, top, nx, nz, u, u + len, 0, Math.max(1, bays), low, base);
        if (ri === 0 && !canopy && bays >= 1 && style < 7) addParts(ax, az, bx, bz, nx, nz, len, bays, shop, u, bd.front[i]);
        u += len;
      }
    });

    function addParts(ax, az, bx, bz, nx, nz, len, bays, shop, u0, front) {
      const dx = (bx - ax) / len, dz = (bz - az) / len, bw = len / bays;
      const yaw = Math.atan2(nx, nz), Yb = Y.KERB;
      const seedInt = Math.floor(seed * 997);
      const gf = shop ? Math.max(storey, SHOP_STOREY) : 0;
      const at = (along) => [ax + dx * along, az + dz * along];
      const push = (type, along, y, w, hgt, extra) => { const [x, z] = at(along); parts[type].push(x, y, z, yaw, w, hgt, extra); };
      const r = WINDOW_RECT[style];
      const wallCol = hex, frameCol = style === 3 || style === 4 ? 0x4a3524 : 0xe6e2da;
      m.cur[5] = 2; m.cur[0] = 0; // cornices and pilasters are blank wall
      if (CORNICE_STYLES.has(style)) {
        const deco = style === 2, stone = style === 3 || style === 4;
        for (let y = Yb + gf + (gf ? 0 : storey); y < h - 0.6; y += storey) strip(m, ax, az, bx, bz, nx, nz, y, deco ? 0.22 : 0.14, deco ? 0.16 : 0.08, u0, u0 + len, base);
        strip(m, ax, az, bx, bz, nx, nz, h - 0.12, stone || deco ? 0.3 : 0.14, stone || deco ? 0.22 : 0.1, u0, u0 + len, base);
        if (stone) {
          for (let c = 1; c < bays; c++) {
            // Pilasters between the bays of Gothic stone buildings.
            const [px, pz] = at(c * bw);
            const hw = 0.22;
            wall(m, px - dx * hw + nx * 0.14, pz - dz * hw + nz * 0.14, px + dx * hw + nx * 0.14, pz + dz * hw + nz * 0.14, y0, h - 0.27, nx, nz, u0 + c * bw - hw, u0 + c * bw + hw, y0, h - 0.27, low, base);
            wall(m, px - dx * hw, pz - dz * hw, px - dx * hw + nx * 0.14, pz - dz * hw + nz * 0.14, y0, h - 0.27, -dx, -dz, 0, 0.14, y0, h - 0.27, low, base);
            wall(m, px + dx * hw + nx * 0.14, pz + dz * hw + nz * 0.14, px + dx * hw, pz + dz * hw, y0, h - 0.27, dx, dz, 0, 0.14, y0, h - 0.27, low, base);
          }
        }
      }
      if (!front || h > 45) return; // 3D window parts on street-facing walls; towers and back walls: shader only
      for (let c = 0; c < bays; c++) {
        if (shop) {
          const signBot = gf - 1.15;
          push('sign', (c + 0.5) * bw, Yb + gf - 0.675, 0.88 * bw, 0.95, Math.floor(cellHash(c, -1, seedInt, K.SIGN) * 128));
          push('shutterBox', (c + 0.5) * bw, Yb + signBot - 0.17, 0.88 * bw, 0.28, 0x6b6e70);
        }
        for (let row = 0; ; row++) {
          const yTop = Yb + gf + (row + r[3]) * storey;
          if (yTop > h - 0.3 || yTop > PARTS_MAX_Y) break;
          const f = cellFeatures(style, c, row, seedInt);
          const yBot = Yb + gf + (row + r[2]) * storey;
          if (f.balcony) {
            push('balcony', (c + 0.5) * bw, Yb + gf + (row + 0.06) * storey, 0.84 * bw, 1, wallCol);
            continue;
          }
          const wx = (c + (r[0] + r[1]) / 2) * bw, ww = (r[1] - r[0]) * bw, wh = yTop - yBot;
          push('frame', wx, (yBot + yTop) / 2, ww, wh, frameCol);
          push('sill', wx, yBot, ww, 1, wallCol);
          if (CHAJJA_STYLES.has(style)) push('chajja', wx, yTop + 0.13, ww, 1, wallCol);
          if (f.grille) push('grille', wx, (yBot + yTop) / 2, ww, wh, 0);
          if (f.ac) push('ac', (c + r[1] + 0.135) * bw, Yb + gf + (row + 0.425) * storey, 1, 1, 0);
        }
      }
    }

    // Roof: concrete terrace, sometimes blue tarpaulin or rusty sheets on small buildings.
    const r0 = rand(bi * 31 + t.tx, t.tz + 7);
    const roofKey = area < 400 && r0 < 0.12 ? 'roofTarp' : area < 400 && r0 < 0.2 ? 'roofRust' : 'roof';
    const roofTint = linear(roofKey === 'roof' ? 0xd6d0c6 : 0xffffff, 0.8 + rand(bi, 3) * 0.3);
    flatPolygon(get(roofKey), bd.rings, h, roofTint, ox, oz);
    if (canopy) flatPolygon(get('roof'), bd.rings, y0 - 0.01, linear(0xf2eee6), ox, oz, true); // underside, seen from below (lit only by the sky's bounce)

    let inner = null;
    if (parapet) {
      // Inner face and coping of the roof parapet.
      inner = inset(outer, 0.22);
      const rm = get('roof');
      const n = outer.length / 2;
      const cap = linear(0xe2ddd3);
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const ax = inner[i * 2], az = inner[i * 2 + 1], bx = inner[j * 2], bz = inner[j * 2 + 1];
        const len = Math.hypot(bx - ax, bz - az);
        if (len < 0.05) continue;
        wall(rm, ax, az, bx, bz, h, top, -(bz - az) / len, (bx - ax) / len, 0, len, h, top, roofTint);
        const o0 = rm.v(outer[i * 2], top, outer[i * 2 + 1], 0, 1, 0, outer[i * 2] + ox, outer[i * 2 + 1] + oz, cap);
        const o1 = rm.v(outer[j * 2], top, outer[j * 2 + 1], 0, 1, 0, outer[j * 2] + ox, outer[j * 2 + 1] + oz, cap);
        const i1 = rm.v(bx, top, bz, 0, 1, 0, bx + ox, bz + oz, cap), i0 = rm.v(ax, top, az, 0, 1, 0, ax + ox, az + oz, cap);
        rm.triUp(o0, o1, i1); rm.triUp(o0, i1, i0);
      }
    }
    if (!(bd.flags & BUILDING_FLAG.NO_COLLIDE)) solid.push(bd.rings.map(toWorld));
    if (canopy || h < 6) return;

    let cx = 0, cz = 0;
    for (let i = 0; i < outer.length; i += 2) { cx += outer[i]; cz += outer[i + 1]; }
    cx /= outer.length / 2; cz /= outer.length / 2;
    const roofRing = inner || outer;

    // Stair/lift room on mid-rise roofs (a small box, same wall style, no windows).
    if (levels >= 5 && area > 160 && style !== 6 && pointInRing(cx, cz, roofRing) && rand(bi, 77) < 0.85) {
      const s = 1.6 + rand(bi, 78) * 0.6, hh = 2.8;
      const ang = rand(bi, 79) * Math.PI;
      const c = Math.cos(ang), sn = Math.sin(ang);
      const pts = [[-s, -s], [s, -s], [s, s], [-s, s]].map(([x, z]) => [cx + x * c - z * sn, cz + x * sn + z * c]);
      if (pts.every(([x, z]) => pointInRing(x, z, roofRing))) {
        m.cur[4] = h + hh; m.cur[5] = 2;
        for (let i = 0; i < 4; i++) {
          // Corners go clockwise in (x, z) here, so (dz, -dx) points outwards.
          const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % 4];
          const len = Math.hypot(bx - ax, bz - az);
          facadeWall(m, ax, az, bx, bz, h, h + hh, (bz - az) / len, -(bx - ax) / len, 0, len, 0, 1, base, base);
        }
        const ring = new Float32Array(pts.flat());
        flatPolygon(get('roof'), [ring], h + hh, roofTint, ox, oz);
        m.cur[4] = h;
      }
    }

    // A rooftop hoarding over the longest street-facing wall of some mid-rise buildings
    // (more on shopping streets; not on heritage stone, sheds, glass towers or huts).
    if (!canopy && hoardings < 8 && levels >= 2 && h >= 7 && h <= 60 && ![3, 4, 6, 7].includes(style) && rand(bi, 91) < (bd.flags & BUILDING_FLAG.SHOPS ? 0.2 : 0.1)) {
      let best = -1, bl = 9;
      const n = outer.length / 2;
      for (let i = 0; i < n; i++) {
        if (!bd.front[i]) continue;
        const j = (i + 1) % n, len = Math.hypot(outer[j * 2] - outer[i * 2], outer[j * 2 + 1] - outer[i * 2 + 1]);
        if (len > bl) { bl = len; best = i; }
      }
      if (best >= 0) {
        const j = (best + 1) % n, ax = outer[best * 2], az = outer[best * 2 + 1], bx = outer[j * 2], bz = outer[j * 2 + 1];
        addHoarding(get('hoarding'), ax, az, bx, bz, (bz - az) / bl, -(bx - ax) / bl, top, Math.floor(rand(bi, 92) * HOARDING.ADS));
        hoardings++;
      }
    }

    // Under repair (street library: about one building in ten on many streets): green safety
    // netting hung 0.4 m off the walls over the upper floors, past the parapet.
    if (bd.flags & BUILDING_FLAG.NETTING) {
      const net = get('netting'), n = outer.length / 2, yb = Math.max(y0 + 3, h * (0.25 + rand(bi, 31) * 0.3)), yt = top + 0.7;
      let u = 0;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n, ax = outer[i * 2], az = outer[i * 2 + 1], bx = outer[j * 2], bz = outer[j * 2 + 1];
        const len = Math.hypot(bx - ax, bz - az);
        if (len < 0.3) continue;
        const nx = (bz - az) / len, nz = -(bx - ax) / len, o = 0.4;
        wall(net, ax + nx * o - (bx - ax) / len * o, az + nz * o - (bz - az) / len * o, bx + nx * o + (bx - ax) / len * o, bz + nz * o + (bz - az) / len * o, yb, yt, nx, nz, u, u + len + 2 * o, yb, yt, WHITE);
        u += len;
      }
    }

    // Black plastic water tanks (Sintex-style) on almost every roof.
    if (area > 50) {
      const count = 1 + Math.floor(rand(bi, 11) * Math.min(5, area / 120));
      const spread = Math.sqrt(area) * 0.35;
      for (let k = 0; k < count; k++) {
        const px = cx + (rand(bi, 20 + k) - 0.5) * spread, pz = cz + (rand(bi, 40 + k) - 0.5) * spread;
        if (pointInRing(px, pz, roofRing)) tanks.push(px, h, pz, 0.8 + rand(bi, 60 + k) * 0.6);
      }
    }
  });
  return { builders: b, tanks, solid, parts };
}
