// Buildings for one tile. Walls carry per-vertex facade data that the facade shader
// (src/world/facade.js) turns into windows, balconies, AC units, shopfronts and signs.
import { BUILDING_FLAG, FACADE } from '../tileFormat.js';
import { Y } from '../levels.js';
import { MeshBuilder, wall, flatPolygon, linear, rand, signedArea, pointInRing, WHITE } from './builder.js';
import { SHOP_STOREY, K, CODE, WIN, FRAME, ARCHV, PIPE_X, WOOD_PAINT, ALU, STEEL, STONE_TRIM, pick, cellHash, cellFeatures, windowRect, acCentre, pipeAt } from '../facadeRules.js';
import { roundCorners, rectOf, pitchedRoof, gable, turret, block, slab } from './facadeShapes.js';
import { addHoarding, HOARDING } from './hoardingMesh.js';

// 3D facade parts (instanced near the player, facadeParts.js): PART_FLOATS floats each — x, y, z,
// yaw, width, height, colour (or sign index), variant (frame/shutter/arch kind, or depth scale).
export const PART_TYPES = ['frame', 'shutter', 'arch', 'sill', 'chajja', 'grille', 'ac', 'balcony', 'enclosed', 'clothes', 'sign', 'shutterBox', 'pipe'];
const PARTS_MAX_Y = 27;   // real geometry on the lower ~8 floors; higher up the shader carries the detail
const CHAJJA_STYLES = new Set([0, 1, 2, 5]);
const ARCADE_DEPTH = 2.8; // m from the street wall back to the shopfronts
const GALLERY_DEPTH = 1.6; // chawl corridor depth
const WALL = { COMPOUND: 0, SHEET: 1, MESH: 2, DOCK: 3, STONE: 4, PILLAR: 5, POST: 6, GATEPOST: 7 }; // scripts/lib/walls.mjs
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
export const FACADE_FLOATS = 7; // bay coordinate, style + 16 × facade kind, seed (integer), storey height, roof height, facade code (CODE), bay width

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

  /**
   * Walls (scripts/lib/walls.mjs): compound walls with pillars and a coping, dock walls with
   * barbed wire, blue sheet hoardings and green mesh fences on steel posts, gate posts. The
   * outline is a thin strip (left edge, then right edge reversed), so its centre line is the
   * midpoint of vertex i and vertex n-1-i.
   */
  function drawWall(bd, bi) {
    const kind = bd.style, ring = bd.rings[0], n = ring.length / 2, y0 = Y.KERB - 0.05, top = Y.KERB + bd.height;
    const hex = (bd.color[0] << 16) | (bd.color[1] << 8) | bd.color[2];
    const col = linear(hex), low = linear(hex, kind === WALL.DOCK ? 0.62 : 0.78);
    const key = kind === WALL.SHEET ? 'sheet' : kind === WALL.MESH ? 'netting' : 'compound';
    const m = get(key), cm = get('compound');
    let u = rand(bi, 5) * 10;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, ax = ring[i * 2], az = ring[i * 2 + 1], bx = ring[j * 2], bz = ring[j * 2 + 1];
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 0.01) continue;
      wall(m, ax, az, bx, bz, y0, top, (bz - az) / len, -(bx - ax) / len, u, u + len, y0, top, key === 'compound' ? low : WHITE, key === 'compound' ? col : WHITE);
      u += len;
    }
    if (kind === WALL.MESH) return posts(0.04, 2.5, top + 0.05, linear(0x6d6f71));
    if (kind === WALL.SHEET) { flatPolygon(cm, bd.rings, top, linear(0x2a3f66), ox, oz); return posts(0.05, 3, top + 0.08, linear(0x3c4a5e)); }
    // Coping on top (a shade lighter), then pillars or gate-post caps.
    flatPolygon(cm, bd.rings, top, linear(hex, 1.08), ox, oz);
    if (kind === WALL.GATEPOST) return;
    if (kind === WALL.DOCK) return wire(top);
    posts(0.21, 3.2 + rand(bi, 9), top + 0.22, linear(hex, 0.92), true);

    // Along the centre line every `every` m: square posts of half-width hw up to height yt.
    function posts(hw, every, yt, c, cap = false) {
      if (n < 4) return;
      const k = n / 2;
      for (let i = 0; i + 1 < k; i++) {
        const cx0 = (ring[i * 2] + ring[(n - 1 - i) * 2]) / 2, cz0 = (ring[i * 2 + 1] + ring[(n - 1 - i) * 2 + 1]) / 2;
        const cx1 = (ring[(i + 1) * 2] + ring[(n - 2 - i) * 2]) / 2, cz1 = (ring[(i + 1) * 2 + 1] + ring[(n - 2 - i) * 2 + 1]) / 2;
        const L = Math.hypot(cx1 - cx0, cz1 - cz0);
        if (L < 0.5) continue;
        const dx = (cx1 - cx0) / L, dz = (cz1 - cz0) / L;
        for (let t = i === 0 ? 0.2 : every / 2; t < L; t += every) {
          const px = cx0 + dx * t, pz = cz0 + dz * t;
          box(cm, px, pz, dx, dz, hw, y0, yt, c);
          if (cap) box(cm, px, pz, dx, dz, hw + 0.05, yt, yt + 0.07, linear(0xf2efe8));
        }
      }
    }
    // Concertina wire along the top of a dock wall: a see-through coil strip.
    function wire(y) {
      const wm = get('wire'), k = n / 2;
      let wu = 0;
      for (let i = 0; i + 1 < k; i++) {
        const ax = (ring[i * 2] + ring[(n - 1 - i) * 2]) / 2, az = (ring[i * 2 + 1] + ring[(n - 1 - i) * 2 + 1]) / 2;
        const bx = (ring[(i + 1) * 2] + ring[(n - 2 - i) * 2]) / 2, bz = (ring[(i + 1) * 2 + 1] + ring[(n - 2 - i) * 2 + 1]) / 2;
        const len = Math.hypot(bx - ax, bz - az);
        if (len < 0.1) continue;
        wall(wm, ax, az, bx, bz, y, y + 0.55, (bz - az) / len, -(bx - ax) / len, wu, wu + len, 0, 1, WHITE);
        wu += len;
      }
    }
  }
  function box(mm, x, z, dx, dz, hw, ya, yb, c) {
    const nx = dz, nz = -dx; // right of the direction
    const p = [[x - dx * hw - nx * hw, z - dz * hw - nz * hw], [x + dx * hw - nx * hw, z + dz * hw - nz * hw], [x + dx * hw + nx * hw, z + dz * hw + nz * hw], [x - dx * hw + nx * hw, z - dz * hw + nz * hw]];
    for (let i = 0; i < 4; i++) {
      const a = p[i], b = p[(i + 1) % 4], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      wall(mm, b[0], b[1], a[0], a[1], ya, yb, -(b[1] - a[1]) / l, (b[0] - a[0]) / l, 0, l, ya, yb, c);
    }
    flatPolygon(mm, [[p[0][0], p[0][1], p[1][0], p[1][1], p[2][0], p[2][1], p[3][0], p[3][1]]], yb, c, ox, oz);
  }

  t.buildings.forEach((bd, bi) => {
    // Landmark outlines: collide, but a hand-built model is drawn instead.
    if (bd.flags & BUILDING_FLAG.HIDDEN) { if (!(bd.flags & BUILDING_FLAG.NO_COLLIDE)) solid.push(bd.rings.map(toWorld)); return; }
    if (bd.flags & BUILDING_FLAG.WALL) { drawWall(bd, bi); solid.push(bd.rings.map(toWorld)); return; }
    const style = Math.min(bd.style, STYLES.length - 1);
    const fk = Math.min(bd.facade || 0, FACADE.CHAWL);
    const area = Math.abs(signedArea(bd.rings[0]));
    const seed = rand(t.tx * 7919 + bi, t.tz * 104729 + bi);
    const seedInt = Math.floor(seed * 997);
    const hex = (bd.color[0] << 16) | (bd.color[1] << 8) | bd.color[2];
    const base = linear(hex, 0.96 + seed * 0.08);
    const low = linear(hex, 0.82);
    const canopy = bd.minHeight > 0.2;
    const y0 = canopy ? bd.minHeight : -0.4;
    const h = bd.height;
    const levels = Math.max(1, bd.levels);
    const storey = Math.min(4.6, Math.max(2.7, (h - 0.6) / levels));
    const heritage = (bd.flags & BUILDING_FLAG.HERITAGE) !== 0;

    // Art Deco: rounded street corners (walls, roof, parapet and collisions follow the curve).
    let rings = bd.rings, front = bd.front, arcs = null;
    if (fk === FACADE.DECO && !canopy && h > 6 && h < 40) {
      const rc = roundCorners(rings[0], front);
      if (rc) { arcs = rc; rings = [rc.ring, ...rings.slice(1)]; front = rc.front; }
    }
    const outer = rings[0];

    // Roofs: clay tiles on simple rectangular chawls and old cottages; Gothic blocks get a steep
    // slate or tile roof with stone gables (rectangles) or street gables and corner turrets.
    const rect = rings.length === 1 && !arcs && !canopy ? rectOf(outer) : null;
    const gothic = fk === FACADE.GOTHIC && !canopy && h >= 8 && h <= 36 && area >= 120 && (heritage || cellHash(-9, -9, seedInt, K.GABLE) < 0.55);
    const rh = cellHash(-9, -9, seedInt, K.ROOF);
    let roofKind = null;
    if (rect && gothic && rect.short <= 24 && area <= 2600) roofKind = 'gothic';
    else if (rect && fk === FACADE.CHAWL && levels <= 4 && rect.short <= 20 && rh < 0.45) roofKind = 'tiles';
    else if (rect && fk === FACADE.OLD && levels <= 2 && area < 260 && rh < 0.6 && style !== 3 && style !== 4) roofKind = 'tiles';
    const parapet = !canopy && !roofKind && h > 5 && area > 30 && style !== 7;
    const top = parapet ? h + PARAPET : h;
    const m = walls(style);
    const setCur = () => { m.cur[1] = style + 0.5 + fk * 16; m.cur[2] = seedInt; m.cur[3] = storey; m.cur[4] = h; };
    setCur();
    const shopsFlag = (bd.flags & BUILDING_FLAG.SHOPS) !== 0;
    const raise = arcs && parapet ? 1.0 : 0; // Deco: the parapet rises around the rounded corner

    // Chawl galleries: the longest street wall (or else the courtyard walls, or the longest wall)
    // is an open corridor on every floor above the ground floor, rooms off it.
    const gallery = new Set();
    if (fk === FACADE.CHAWL && !canopy && h - storey > 2.5) {
      let best = -1, bl = 9.5;
      const n0 = outer.length / 2;
      for (let i = 0; i < n0; i++) { const j = (i + 1) % n0, len = Math.hypot(outer[j * 2] - outer[i * 2], outer[j * 2 + 1] - outer[i * 2 + 1]); if (front[i] && len > bl) { bl = len; best = i; } }
      if (best < 0 && rings.length > 1) {
        rings.slice(1).forEach((ring, k) => { if (Math.abs(signedArea(ring)) > 50) for (let i = 0; i < ring.length / 2; i++) gallery.add(`${k + 1}:${i}`); });
      } else if (best < 0) {
        for (let i = 0; i < n0; i++) { const j = (i + 1) % n0, len = Math.hypot(outer[j * 2] - outer[i * 2], outer[j * 2 + 1] - outer[i * 2 + 1]); if (len > bl) { bl = len; best = i; } }
      }
      if (best >= 0) gallery.add(`0:${best}`);
    }
    const holes = rings.slice(1);
    const insideBuilding = (x, z) => pointInRing(x, z, outer) && !holes.some((r) => pointInRing(x, z, r));

    rings.forEach((ring, ri) => {
      const n = ring.length / 2;
      let u = seed * 7;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const ax = ring[i * 2], az = ring[i * 2 + 1], bx = ring[j * 2], bz = ring[j * 2 + 1];
        const len = Math.hypot(bx - ax, bz - az);
        if (len < 0.05) continue;
        const nx = (bz - az) / len, nz = -(bx - ax) / len;
        // Window grid: straight walls get their own bays; the walls of a rounded corner share one
        // grid so windows wrap round the curve.
        const g = ri === 0 && arcs ? arcs.edge[i] : -1;
        let bays, b0, b1, bw;
        if (g >= 0) { const L = arcs.len[g]; bays = Math.max(1, Math.round(L / BAY[style])); b0 = (bays * arcs.start[i]) / L; b1 = (bays * (arcs.start[i] + len)) / L; bw = L / bays; }
        else { bays = Math.round(len / BAY[style]); b0 = 0; b1 = Math.max(1, bays); bw = len / Math.max(1, bays); }
        const isFront = ri === 0 && !!front[i];
        const shop = ri === 0 && shopsFlag && isFront && (g >= 0 ? arcs.len[g] > 2.5 : len > 2.5);
        m.cur[5] = bays < 1 || canopy ? CODE.BLANK : shop ? CODE.SHOPS : CODE.WINDOWS;
        m.cur[6] = bw;
        const arcade = ri === 0 && g < 0 && (bd.flags & BUILDING_FLAG.ARCADE) && isFront && len > 5 && bays >= 2 && !canopy && h > 8;
        const gal = gallery.has(`${ri}:${i}`) && len > 4 && bays >= 1 && galleryFits(ax, az, bx, bz, nx, nz);
        if (gal) galleryWall(ax, az, bx, bz, nx, nz, len, bays, u, shop, isFront);
        else if (arcade) arcadeWall(ax, az, bx, bz, nx, nz, len, bays, u);
        else facadeWall(m, ax, az, bx, bz, y0, top + (g >= 0 ? raise : 0), nx, nz, u, u + len, b0, b1, low, base);
        if (ri === 0 && !canopy && bays >= 1 && style < 7) addParts(ax, az, bx, bz, nx, nz, len, bays, shop || arcade, u, isFront, { arc: g >= 0, arcade, gallery: gal, bw });
        u += len;
      }
    });
    setCur();

    // Contact shade: a soft dark band on the ground along the walls (multiplied over it; stands in
    // for ambient occlusion on the tiers without it, where buildings looked pasted on).
    if (!canopy) {
      const cm = get('contact'), n = outer.length / 2, yb = Y.KERB + 0.012, W = 0.85;
      const DARK = [118, 118, 122], CLEAR = WHITE;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n, ax = outer[i * 2], az = outer[i * 2 + 1], bx = outer[j * 2], bz = outer[j * 2 + 1];
        const len = Math.hypot(bx - ax, bz - az);
        if (len < 0.3) continue;
        const nx = (bz - az) / len, nz = -(bx - ax) / len;
        const a0 = cm.v(ax, yb, az, 0, 1, 0, 0, 0, DARK), b0 = cm.v(bx, yb, bz, 0, 1, 0, 1, 0, DARK);
        const b1 = cm.v(bx + nx * W, yb, bz + nz * W, 0, 1, 0, 1, 1, CLEAR), a1 = cm.v(ax + nx * W, yb, az + nz * W, 0, 1, 0, 0, 1, CLEAR);
        cm.triUp(a0, b0, b1); cm.triUp(a0, b1, a1);
      }
    }

    /** Is there room for a 1.6 m deep gallery behind this wall (the building is deep enough)? */
    function galleryFits(ax, az, bx, bz, nx, nz) {
      const d = GALLERY_DEPTH + 1.2;
      return [0.15, 0.5, 0.85].every((f) => insideBuilding(ax + (bx - ax) * f - nx * d, az + (bz - az) * f - nz * d));
    }

    /**
     * Chawl gallery: the ground floor stays on the wall line; above it each floor has an open
     * corridor GALLERY_DEPTH deep: a railing (painted balusters with a view into the corridor),
     * the slab edge, the floor and ceiling, square posts, and the corridor's back wall with a door
     * and a barred window per room (CODE.GALLERY). Clothes lines hang near the player (parts).
     */
    function galleryWall(ax, az, bx, bz, nx, nz, len, bays, u, shop, isFront) {
      const g1 = shop ? Math.max(storey, SHOP_STOREY) : storey, tall = g1 > storey + 0.01 ? CODE.TALL_GF : 0;
      const Y1 = Y.KERB + g1, ix = -nx * GALLERY_DEPTH, iz = -nz * GALLERY_DEPTH, dx = (bx - ax) / len, dz = (bz - az) / len;
      const rooms = Math.max(1, Math.round(len / 3.1)), rw = len / rooms;
      m.cur[5] = shop ? CODE.SHOPS : CODE.WINDOWS; m.cur[6] = len / bays;
      facadeWall(m, ax, az, bx, bz, y0, Y1, nx, nz, u, u + len, 0, bays, low, base);
      m.cur[5] = CODE.BLANK;
      facadeWall(m, ax, az, bx, bz, h - 0.22, top, nx, nz, u, u + len, 0, 1, base, base);
      m.cur[5] = CODE.GALLERY + tall; m.cur[6] = rw;
      facadeWall(m, ax + ix, az + iz, bx + ix, bz + iz, Y1, h - 0.22, nx, nz, u, u + len, 0, rooms, low, base);
      const floorCol = linear(0x9a6a52, 0.9), ceilCol = linear(0xe8e4da), rm = get('roof');
      for (let y = Y1, k = 0; y < h - 1.5; y += storey, k++) {
        if (k > 0) { m.cur[5] = CODE.BLANK; facadeWall(m, ax, az, bx, bz, y - 0.22, y, nx, nz, u, u + len, 0, 1, base, base); }
        m.cur[5] = CODE.RAILING + tall; m.cur[6] = rw;
        facadeWall(m, ax, az, bx, bz, y, y + 1.0, nx, nz, u, u + len, 0, rooms, base, base);
        const quad = [ax, az, bx, bz, bx + ix, bz + iz, ax + ix, az + iz];
        flatPolygon(rm, [quad], y + 0.005, floorCol, ox, oz);
        flatPolygon(rm, [quad], Math.min(y + storey, h) - 0.22, ceilCol, ox, oz, true);
      }
      // Ends of the corridor and posts every two rooms.
      m.cur[5] = CODE.BLANK; m.cur[0] = 0;
      wall(m, ax, az, ax + ix, az + iz, Y1, h, dx, dz, 0, GALLERY_DEPTH, Y1, h, low, base);
      wall(m, bx + ix, bz + iz, bx, bz, Y1, h, -dx, -dz, 0, GALLERY_DEPTH, Y1, h, low, base);
      for (let c = 2; c < rooms; c += 2) {
        const px = ax + dx * c * rw - nx * 0.15, pz = az + dz * c * rw - nz * 0.15;
        box(m, px, pz, dx, dz, 0.15, Y1, h - 0.22, base);
      }
      if (isFront && h <= 45) {
        // Clothes drying on lines across the corridor (3D, near the player).
        for (let y = Y1, k = 0; y < h - 1.5 && y < PARTS_MAX_Y; y += storey, k++) {
          for (let c = 0; c < rooms; c++) {
            if (cellHash(c, k, seedInt, K.CLOTHES) > 0.55) continue;
            const along = (c + 0.5) * rw;
            parts.clothes.push(ax + dx * along - nx * 0.45, y + 2.05, az + dz * along - nz * 0.45, Math.atan2(nx, nz), 0.85 * rw, 1, 0, 0);
          }
        }
      }
    }

    /**
     * Arcaded street wall (Fort, Colaba Causeway): the upper floors stay on the street line, the
     * ground floor (shops) steps back ARCADE_DEPTH behind piers at the bay lines, under a ceiling.
     */
    function arcadeWall(ax, az, bx, bz, nx, nz, len, bays, u) {
      const G = Y.KERB + Math.max(storey, SHOP_STOREY), ix = -nx * ARCADE_DEPTH, iz = -nz * ARCADE_DEPTH;
      const dx = (bx - ax) / len, dz = (bz - az) / len;
      m.cur[5] = CODE.WINDOWS; m.cur[6] = len / bays;
      facadeWall(m, ax, az, bx, bz, G, top, nx, nz, u, u + len, 0, bays, low, base);
      m.cur[5] = CODE.SHOPS; // shops on the back wall of the walkway
      facadeWall(m, ax + ix, az + iz, bx + ix, bz + iz, y0, G, nx, nz, u, u + len, 0, bays, low, low);
      m.cur[5] = CODE.BLANK; m.cur[0] = 0; // piers, ends: plain wall
      const pw = 0.32, pd = 0.62;
      for (let c = 0; c <= bays; c++) {
        const along = Math.min(len - pw, Math.max(pw, (c * len) / bays));
        const px = ax + dx * along, pz = az + dz * along, qx = px - nx * pd, qz = pz - nz * pd;
        wall(m, px - dx * pw, pz - dz * pw, px + dx * pw, pz + dz * pw, y0, G, nx, nz, 0, 2 * pw, y0, G, low, base);
        wall(m, qx + dx * pw, qz + dz * pw, qx - dx * pw, qz - dz * pw, y0, G, -nx, -nz, 0, 2 * pw, y0, G, low, low);
        wall(m, px + dx * pw, pz + dz * pw, qx + dx * pw, qz + dz * pw, y0, G, dx, dz, 0, pd, y0, G, low, base);
        wall(m, qx - dx * pw, qz - dz * pw, px - dx * pw, pz - dz * pw, y0, G, -dx, -dz, 0, pd, y0, G, low, base);
      }
      // Closed ends of the walkway, and its ceiling.
      wall(m, ax, az, ax + ix, az + iz, y0, G, dx, dz, 0, ARCADE_DEPTH, y0, G, low, low);
      wall(m, bx + ix, bz + iz, bx, bz, y0, G, -dx, -dz, 0, ARCADE_DEPTH, y0, G, low, low);
      flatPolygon(get('roof'), [[ax, az, bx, bz, bx + ix, bz + iz, ax + ix, az + iz]], G - 0.01, linear(0xe9e3d6), ox, oz, true);
    }

    /**
     * Cornices, Deco eyebrows, and the 3D window parts near the player on street walls: frames,
     * shutters, arches, sills, sunshades, grilles and box grilles, enclosed balconies, AC units,
     * shop signs, clothes and drain pipes. Same per-cell rules as the shader (facadeRules.js).
     */
    function addParts(ax, az, bx, bz, nx, nz, len, bays, shop, u0, isFront, { arc, arcade, gallery: gal, bw: bwArc }) {
      const dx = (bx - ax) / len, dz = (bz - az) / len, bw = arc ? bwArc : len / bays;
      const yaw = Math.atan2(nx, nz), Yb = Y.KERB;
      const gf = shop ? Math.max(storey, SHOP_STOREY) : 0;
      const at = (along) => [ax + dx * along, az + dz * along];
      const push = (type, along, y, w, hgt, extra, variant = 0, out = 0) => { const [x, z] = at(along); parts[type].push(x + nx * out, y, z + nz * out, yaw, w, hgt, extra, variant); };
      const wallCol = hex, deco = fk === FACADE.DECO;
      m.cur[5] = CODE.BLANK; m.cur[0] = 0; // cornices, pilasters and eyebrows are blank wall
      if (CORNICE_STYLES.has(style) && !gal) {
        const stone = style === 3 || style === 4, dc = style === 2;
        if (!arc || !deco) for (let y = Yb + gf + (gf ? 0 : storey); y < h - 0.6; y += storey) strip(m, ax, az, bx, bz, nx, nz, y, dc ? 0.22 : 0.14, dc ? 0.16 : 0.08, u0, u0 + len, base);
        strip(m, ax, az, bx, bz, nx, nz, h - 0.12, stone || dc ? 0.3 : 0.14, stone || dc ? 0.22 : 0.1, u0, u0 + len, base);
        if (stone && !arc) {
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
      // Art Deco "eyebrow" sunshades: thin slabs 0.55 m deep over the windows, running round the
      // curved corners (most blocks) or one per window.
      if (deco && (isFront || arc) && h <= 45) {
        const r = windowRect(style, WIN.DECO), ribbon = arc || cellHash(-9, -9, seedInt, K.EYEBROW) < 0.65;
        for (let row = 0; ; row++) {
          const y = Yb + gf + (row + r[3]) * storey + 0.12;
          if (y > h - 0.6) break;
          if (ribbon) slab(m, ax, az, bx, bz, nx, nz, y, 0.07, 0.55, base, false);
          else for (let c = 0; c < bays; c++) {
            const s0 = (c + r[0] - 0.05) * bw, s1 = (c + r[1] + 0.05) * bw;
            slab(m, ax + dx * s0, az + dz * s0, ax + dx * s1, az + dz * s1, nx, nz, y, 0.07, 0.5, base, false);
          }
        }
      }
      if (!isFront || h > 45 || arc) return; // 3D window parts on straight street-facing walls; towers and back walls: shader only
      if (gal) return;
      const wood = pick(WOOD_PAINT, seedInt), alu = pick(ALU, seedInt), steel = pick(STEEL, seedInt), trim = pick(STONE_TRIM, seedInt);
      const pipeCol = fk === FACADE.MODERN ? (cellHash(-9, -9, seedInt, K.PIPE) < 0.5 ? 0x8d8f8c : 0xd2cdc2) : fk === FACADE.DECO ? hex : 0x3d3732;
      const pipeTop = h + (parapet ? 0.35 : -0.15);
      for (let c = 0; c < bays; c++) {
        if (shop) {
          const signBot = gf - 1.15;
          push('sign', (c + 0.5) * bw, Yb + gf - 0.675, 0.88 * bw, 0.95, Math.floor(cellHash(c, -1, seedInt, K.SIGN) * 128));
          if (!arcade) push('shutterBox', (c + 0.5) * bw, Yb + signBot - 0.17, 0.88 * bw, 0.28, 0x6b6e70); // arcades: the sign hangs in the opening
        }
        // Drain pipe from the roof (behind the signboard on shop walls), same rule as the shader.
        const pipeBot = shop ? Yb + gf - 0.6 : Yb;
        if (style !== 6 && pipeAt(fk, c, seedInt) && !arcade && pipeTop - pipeBot > 3) push('pipe', c * bw + PIPE_X, pipeBot, 1, pipeTop - pipeBot, pipeCol, parapet && cellHash(c, -7, seedInt, K.PIPE) < 0.4 ? 1 : 0, 0.1);
        for (let row = 0; ; row++) {
          const f = cellFeatures(style, fk, c, row, seedInt);
          const r = windowRect(style, f.kind);
          const yTop = Yb + gf + (row + r[3]) * storey;
          if (yTop > h - 0.3 || yTop > PARTS_MAX_Y) break;
          const cellY = Yb + gf + row * storey;
          if (f.balcony) {
            push('balcony', (c + 0.5) * bw, cellY + 0.06 * storey, 0.84 * bw, 1, wallCol);
            if (cellHash(c, row, seedInt, K.CLOTHES) < 0.55) push('clothes', (c + 0.5) * bw, cellY + 0.06 * storey + 1.85, 0.7 * bw, 1, 0, 0, 0.6);
            continue;
          }
          if (f.enclosed) {
            if (cellHash(c, row, seedInt, K.CAGE) < 0.3) push('grille', (c + 0.5) * bw, cellY + 0.49 * storey, 0.84 * bw, 0.86 * storey, 0, 2.3);
            else push('enclosed', (c + 0.5) * bw, cellY + 0.06 * storey, 0.84 * bw, 0.86 * storey, alu, 0.75);
            continue;
          }
          const yBot = Yb + gf + (row + r[2]) * storey;
          const wx = (c + (r[0] + r[1]) / 2) * bw, ww = (r[1] - r[0]) * bw, wh = yTop - yBot, wy = (yBot + yTop) / 2;
          const stoneSt = style === 3 || style === 4;
          if (f.kind === WIN.LOUVRE) push('shutter', wx, wy, ww, wh, wood, f.state);
          else if (f.kind === WIN.ARCH || f.kind === WIN.ROUND) push('arch', wx, wy, ww, wh, trim, f.kind === WIN.ARCH ? ARCHV.POINTED : ARCHV.ROUND);
          else if (f.kind !== WIN.PORTHOLE) {
            const v = f.kind === WIN.SLIDER ? FRAME.SLIDER : f.kind === WIN.CASEMENT ? FRAME.CASEMENT : f.kind === WIN.DECO ? FRAME.DECO : FRAME.PLAIN;
            const col = v === FRAME.SLIDER ? alu : v === FRAME.CASEMENT ? wood : v === FRAME.DECO ? steel : stoneSt ? 0x4a3524 : 0xe6e2da;
            push('frame', wx, wy, ww, wh, col, v);
          }
          if (f.kind !== WIN.PORTHOLE) push('sill', wx, yBot, ww, 1, stoneSt ? 0xd8ccb0 : wallCol);
          if (CHAJJA_STYLES.has(style) && !deco && f.kind !== WIN.PORTHOLE) push('chajja', wx, yTop + 0.13, ww, 1, wallCol);
          if (f.cage) push('grille', wx, wy, ww + 0.14, wh + 0.12, 0, 1.5);
          else if (f.grille) push('grille', wx, wy, ww, wh, 0, 0.25);
          if (f.ac) { const [cx, cy] = acCentre(r, bw, storey); push('ac', (c + cx) * bw, Yb + gf + (row + cy) * storey, 1, 1, 0); }
        }
      }
    }

    // Roof: concrete terrace, sometimes blue tarpaulin or rusty sheets on small buildings.
    const r0 = rand(bi * 31 + t.tx, t.tz + 7);
    const roofKey = area < 400 && r0 < 0.12 ? 'roofTarp' : area < 400 && r0 < 0.2 ? 'roofRust' : 'roof';
    const roofTint = linear(roofKey === 'roof' ? 0xd6d0c6 : 0xffffff, 0.8 + rand(bi, 3) * 0.3);
    if (roofKind) {
      // Pitched roof: Mangalore clay tiles (chawls, cottages) or slate / tiles on Gothic blocks.
      const slate = roofKind === 'gothic' && rh < 0.3;
      const tile = linear(slate ? 0x59626b : rh < 0.7 ? 0xa4532f : 0x8a4630, 0.85 + rand(bi, 5) * 0.25);
      const rise = rect.short * (roofKind === 'gothic' ? 0.55 : 0.27);
      pitchedRoof(m, get('roof'), rect, h, rise, roofKind === 'gothic' ? 0.25 : 0.5, tile, low, base, roofKind === 'gothic' ? CODE.GABLE : cellHash(-9, -9, seedInt, K.GABLE) < 0.5 ? CODE.GABLE : CODE.BLANK, linear(0x5a4636));
      setCur();
    } else flatPolygon(get(roofKey), rings, h, roofTint, ox, oz);
    if (canopy) flatPolygon(get('roof'), rings, y0 - 0.01, linear(0xf2eee6), ox, oz, true); // underside, seen from below (lit only by the sky's bounce)

    let inner = null;
    if (parapet) {
      // Inner face and coping of the roof parapet (higher round a Deco corner).
      inner = inset(outer, 0.22);
      const rm = get('roof');
      const n = outer.length / 2;
      const cap = linear(0xe2ddd3);
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const ax = inner[i * 2], az = inner[i * 2 + 1], bx = inner[j * 2], bz = inner[j * 2 + 1];
        const len = Math.hypot(bx - ax, bz - az);
        if (len < 0.05) continue;
        const tp = top + (arcs && arcs.edge[i] >= 0 ? raise : 0);
        wall(rm, ax, az, bx, bz, h, tp, -(bz - az) / len, (bx - ax) / len, 0, len, h, tp, roofTint);
        const o0 = rm.v(outer[i * 2], tp, outer[i * 2 + 1], 0, 1, 0, outer[i * 2] + ox, outer[i * 2 + 1] + oz, cap);
        const o1 = rm.v(outer[j * 2], tp, outer[j * 2 + 1], 0, 1, 0, outer[j * 2] + ox, outer[j * 2 + 1] + oz, cap);
        const i1 = rm.v(bx, tp, bz, 0, 1, 0, bx + ox, bz + oz, cap), i0 = rm.v(ax, tp, az, 0, 1, 0, ax + ox, az + oz, cap);
        rm.triUp(o0, o1, i1); rm.triUp(o0, i1, i0);
        // Ends of the raised corner parapet.
        if (arcs && raise) {
          const ga = arcs.edge[i], gp = arcs.edge[(i - 1 + n) % n];
          if (ga >= 0 && gp < 0) wall(m, ax, az, outer[i * 2], outer[i * 2 + 1], top, tp, -(bx - ax) / len, -(bz - az) / len, 0, 0.22, top, tp, base);
          const gn = arcs.edge[j];
          if (ga >= 0 && gn < 0) wall(m, outer[j * 2], outer[j * 2 + 1], bx, bz, top, tp, (bx - ax) / len, (bz - az) / len, 0, 0.22, top, tp, base);
        }
      }
    }
    if (!(bd.flags & BUILDING_FLAG.NO_COLLIDE)) solid.push(rings.map(toWorld));
    if (canopy || h < 6) return;

    let cx = 0, cz = 0;
    for (let i = 0; i < outer.length; i += 2) { cx += outer[i]; cz += outer[i + 1]; }
    cx /= outer.length / 2; cz /= outer.length / 2;
    const roofRing = inner || outer;
    const n0 = outer.length / 2;
    const edge = (i) => { const j = (i + 1) % n0, ax = outer[i * 2], az = outer[i * 2 + 1], bx = outer[j * 2], bz = outer[j * 2 + 1], len = Math.hypot(bx - ax, bz - az); return { ax, az, bx, bz, len, nx: (bz - az) / (len || 1), nz: -(bx - ax) / (len || 1) }; };

    // Art Deco crown: a stepped parapet in the middle of the longest street wall with the
    // building's name on a plaque (made-up names, facade atlas).
    let crowned = false;
    if (fk === FACADE.DECO && parapet && h < 40) {
      let best = -1, bl = 10;
      for (let i = 0; i < n0; i++) { const e = edge(i); if (front[i] && (!arcs || arcs.edge[i] < 0) && e.len > bl) { bl = e.len; best = i; } }
      if (best >= 0) {
        const e = edge(best), dx = (e.bx - e.ax) / e.len, dz = (e.bz - e.az) / e.len;
        const W = Math.min(10, Math.max(4, 0.32 * e.len)), steps = cellHash(-9, -9, seedInt, K.EYEBROW) < 0.5 ? 2 : 3;
        for (let k = 0; k < steps; k++) {
          const w = W * (1 - 0.3 * k), s0 = e.len / 2 - w / 2, s1 = e.len / 2 + w / 2;
          block(m, e.ax + dx * s0, e.az + dz * s0, e.ax + dx * s1, e.az + dz * s1, e.nx, e.nz, top + 0.55 * k, top + 0.55 * (k + 1), 0.35, base);
        }
        const pw = Math.min(0.85 * W, 5.5), s0 = e.len / 2 - pw / 2, s1 = e.len / 2 + pw / 2;
        m.cur[5] = CODE.PLAQUE; m.cur[3] = 0.4; m.cur[4] = top + 0.08; m.cur[6] = pw;
        facadeWall(m, e.ax + dx * s0 + e.nx * 0.03, e.az + dz * s0 + e.nz * 0.03, e.ax + dx * s1 + e.nx * 0.03, e.az + dz * s1 + e.nz * 0.03, top + 0.08, top + 0.48, e.nx, e.nz, 0, pw, 0, 1, base, base);
        setCur();
        crowned = true;
      }
    }

    // Gothic: stone street gables with steep roofs behind them, and slate-spired corner turrets.
    if (gothic) {
      const slateCol = linear(rh < 0.5 ? 0x59626b : 0x7a4430, 0.9);
      const gTop = roofKind ? h : top;
      if (!roofKind) {
        for (let i = 0; i < n0; i++) {
          const e = edge(i);
          if (!front[i] || e.len < 9) continue;
          const nG = Math.max(1, Math.min(3, Math.round(e.len / 12))), seg = e.len / nG, gw = Math.min(8.5, seg - 1.6);
          if (gw < 4) continue;
          const dx = (e.bx - e.ax) / e.len, dz = (e.bz - e.az) / e.len;
          for (let k = 0; k < nG; k++) {
            const c = (k + 0.5) * seg, s0 = c - gw / 2, s1 = c + gw / 2;
            gable(m, outer, holes, e.ax + dx * s0, e.az + dz * s0, e.ax + dx * s1, e.az + dz * s1, e.nx, e.nz, gTop, slateCol, base);
          }
        }
        setCur();
      }
      let made = 0;
      for (let i = 0; i < n0 && made < 2; i++) {
        const p = (i - 1 + n0) % n0, ep = edge(p), ei = edge(i);
        if ((!front[p] && !front[i]) || ep.len < 6 || ei.len < 6) continue;
        const u1x = (ep.bx - ep.ax) / ep.len, u1z = (ep.bz - ep.az) / ep.len, u2x = (ei.bx - ei.ax) / ei.len, u2z = (ei.bz - ei.az) / ei.len;
        const crs = u1x * u2z - u1z * u2x, dot = u1x * u2x + u1z * u2z;
        if (crs <= 0 || dot > 0.5 || dot < -0.5) continue; // convex corners of 60–120°
        if (!heritage && cellHash(i, -6, seedInt, K.GABLE) > 0.6) continue;
        let bxv = -u1z - u2z, bzv = u1x + u2x; // inward bisector
        const bl2 = Math.hypot(bxv, bzv) || 1; bxv /= bl2; bzv /= bl2;
        const r = 1.35, tx = outer[i * 2] + bxv * r * 0.45, tz = outer[i * 2 + 1] + bzv * r * 0.45;
        turret(m, tx, tz, r, Math.max(y0 + 3.5, h - Math.min(7, 0.35 * h)), gTop + 1.6, low, base, slateCol);
        made++;
      }
      setCur();
    }

    if (roofKind) return; // pitched roofs: no terrace clutter

    // Stair/lift room on mid-rise roofs (a small box, same wall style, no windows).
    if (levels >= 5 && area > 160 && style !== 6 && !gothic && pointInRing(cx, cz, roofRing) && rand(bi, 77) < 0.85) {
      const s = 1.6 + rand(bi, 78) * 0.6, hh = 2.8;
      const ang = rand(bi, 79) * Math.PI;
      const c = Math.cos(ang), sn = Math.sin(ang);
      const pts = [[-s, -s], [s, -s], [s, s], [-s, s]].map(([x, z]) => [cx + x * c - z * sn, cz + x * sn + z * c]);
      if (pts.every(([x, z]) => pointInRing(x, z, roofRing))) {
        m.cur[4] = h + hh; m.cur[5] = CODE.BLANK;
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
    if (!canopy && !crowned && hoardings < 8 && levels >= 2 && h >= 7 && h <= 60 && ![3, 4, 6, 7].includes(style) && rand(bi, 91) < (bd.flags & BUILDING_FLAG.SHOPS ? 0.2 : 0.1)) {
      let best = -1, bl = 9;
      for (let i = 0; i < n0; i++) {
        if (!front[i]) continue;
        const len = edge(i).len;
        if (len > bl) { bl = len; best = i; }
      }
      if (best >= 0) {
        const e = edge(best);
        addHoarding(get('hoarding'), e.ax, e.az, e.bx, e.bz, e.nx, e.nz, top, Math.floor(rand(bi, 92) * HOARDING.ADS));
        hoardings++;
      }
    }

    // Under repair (street library: about one building in ten on many streets): green safety
    // netting hung 0.4 m off the walls over the upper floors, past the parapet.
    if (bd.flags & BUILDING_FLAG.NETTING) {
      const net = get('netting'), yb = Math.max(y0 + 3, h * (0.25 + rand(bi, 31) * 0.3)), yt = top + 0.7;
      let u = 0;
      for (let i = 0; i < n0; i++) {
        const { ax, az, bx, bz, len, nx, nz } = edge(i);
        if (len < 0.3) continue;
        const o = 0.4;
        wall(net, ax + nx * o - (bx - ax) / len * o, az + nz * o - (bz - az) / len * o, bx + nx * o + (bx - ax) / len * o, bz + nz * o + (bz - az) / len * o, yb, yt, nx, nz, u, u + len + 2 * o, yb, yt, WHITE);
        u += len;
      }
    }

    // Black plastic water tanks (Sintex-style) on almost every roof.
    // (Not under the steep roofs behind Gothic street gables.)
    const clearOfGables = (px, pz) => !gothic || !Array.from({ length: n0 }, (_, i) => i).some((i) => {
      if (!front[i]) return false;
      const e = edge(i), t2 = Math.max(0, Math.min(1, ((px - e.ax) * (e.bx - e.ax) + (pz - e.az) * (e.bz - e.az)) / (e.len * e.len || 1)));
      return Math.hypot(px - e.ax - (e.bx - e.ax) * t2, pz - e.az - (e.bz - e.az) * t2) < 11;
    });
    if (area > 50) {
      const count = 1 + Math.floor(rand(bi, 11) * Math.min(5, area / 120));
      const spread = Math.sqrt(area) * 0.35;
      for (let k = 0; k < count; k++) {
        const px = cx + (rand(bi, 20 + k) - 0.5) * spread, pz = cz + (rand(bi, 40 + k) - 0.5) * spread;
        if (pointInRing(px, pz, roofRing) && clearOfGables(px, pz)) tanks.push(px, h, pz, 0.8 + rand(bi, 60 + k) * 0.6);
      }
    }
  });
  return { builders: b, tanks, solid, parts };
}
