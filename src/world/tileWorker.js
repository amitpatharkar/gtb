// Web Worker: download a tile, unzip it, decode it and turn it into ready-to-upload
// mesh arrays plus collision data, so the main thread only creates GPU buffers.
import earcut from 'earcut';
import { decodeTile, AREA, ROAD, BUILDING_FLAG } from './tileFormat.js';

const BAY = 3.6;    // metres per window column in the facade texture
const FLOOR = 3.2;  // metres per storey
const FACADE_BAYS = 4, FACADE_FLOORS = 4; // the facade texture holds 4 × 4 windows
const SEA_WALL_BOTTOM = -0.7; // sea level (see environment.js)
const GRID_CELL = 16; // metres, collision grid

// kind: [sRGB colour, height above ground]
const AREA_LOOK = {
  [AREA.LAND]: [0xa39c8e, 0],
  [AREA.RAILYARD]: [0x8c8478, 0.012],
  [AREA.DIRT]: [0xa48b68, 0.016],
  [AREA.PAVED]: [0xb3ab9e, 0.02],
  [AREA.PLATFORM]: [0xb8b1a3, 0.024],
  [AREA.GRASS]: [0x6c9a46, 0.028],
  [AREA.SAND]: [0xd8c491, 0.028],
  [AREA.WOOD]: [0x4b7838, 0.032],
  [AREA.PITCH]: [0x8fae5a, 0.036],
  [AREA.POOL]: [0x4fb3cf, 0.04],
  [AREA.PIER]: [0x8e877c, 0.0],
};
// Road class → [height above ground, sRGB colour for unmarked roads]
const ROAD_LOOK = {
  [ROAD.MOTORWAY]: [0.13], [ROAD.TRUNK]: [0.12], [ROAD.PRIMARY]: [0.11], [ROAD.SECONDARY]: [0.1],
  [ROAD.TERTIARY]: [0.09], [ROAD.LINK]: [0.085],
  [ROAD.RESIDENTIAL]: [0.075, 0x4a4a4d], [ROAD.LIVING]: [0.075, 0x58565a], [ROAD.SERVICE]: [0.07, 0x56565a],
  [ROAD.PEDESTRIAN]: [0.06, 0x9c958a], [ROAD.FOOTWAY]: [0.055, 0xaaa398], [ROAD.TRACK]: [0.055, 0x8b7a60],
  [ROAD.PIER]: [0.05, 0x7d6a55],
};
const MARKED = (cls) => cls <= ROAD.LINK;

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linear = (hex, k = 1) => [
  Math.round(srgbToLinear(((hex >> 16) & 255) / 255) * k * 255),
  Math.round(srgbToLinear(((hex >> 8) & 255) / 255) * k * 255),
  Math.round(srgbToLinear((hex & 255) / 255) * k * 255),
];
const rand = (a, b) => {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be59b, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
};

class MeshBuilder {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.i = []; this.count = 0; }
  v(x, y, z, nx, ny, nz, u, w, col) {
    this.p.push(x, y, z); this.n.push(nx, ny, nz); this.uv.push(u, w);
    this.c.push(col[0], col[1], col[2]);
    return this.count++;
  }
  /** Triangle forced to face upwards (+y). */
  triUp(a, b, c) {
    const p = this.p;
    const ax = p[a * 3], az = p[a * 3 + 2];
    const cross = (p[b * 3 + 2] - az) * (p[c * 3] - ax) - (p[b * 3] - ax) * (p[c * 3 + 2] - az);
    if (cross >= 0) this.i.push(a, b, c); else this.i.push(a, c, b);
  }
  tri(a, b, c) { this.i.push(a, b, c); }
  finish(transfer) {
    if (!this.count) return null;
    const out = {
      position: new Float32Array(this.p),
      normal: new Float32Array(this.n),
      uv: new Float32Array(this.uv),
      color: new Uint8Array(this.c),
      index: this.count > 65535 ? new Uint32Array(this.i) : new Uint16Array(this.i),
    };
    for (const k in out) transfer.push(out[k].buffer);
    return out;
  }
}

/** Vertical wall quad from a to b, facing (nx, nz). */
function wall(m, ax, az, bx, bz, y0, y1, nx, nz, u0, u1, v0, v1, colBottom, colTop) {
  const a0 = m.v(ax, y0, az, nx, 0, nz, u0, v0, colBottom);
  const b0 = m.v(bx, y0, bz, nx, 0, nz, u1, v0, colBottom);
  const b1 = m.v(bx, y1, bz, nx, 0, nz, u1, v1, colTop);
  const a1 = m.v(ax, y1, az, nx, 0, nz, u0, v1, colTop);
  // Winding chosen so the front face points along (nx, nz).
  if ((bz - az) * nx - (bx - ax) * nz >= 0) { m.tri(a0, b1, b0); m.tri(a0, a1, b1); }
  else { m.tri(a0, b0, b1); m.tri(a0, b1, a1); }
}

/** Flat polygon (outer + holes) at height y. */
function flatPolygon(m, rings, y, col, ox, oz, uvScale) {
  const flat = [], holes = [];
  for (let r = 0; r < rings.length; r++) {
    if (r) holes.push(flat.length / 2);
    for (let i = 0; i < rings[r].length; i++) flat.push(rings[r][i]);
  }
  const tris = earcut(flat, holes);
  const base = m.count;
  for (let i = 0; i < flat.length; i += 2) {
    m.v(flat[i], y, flat[i + 1], 0, 1, 0, (flat[i] + ox) * uvScale, (flat[i + 1] + oz) * uvScale, col);
  }
  for (let i = 0; i < tris.length; i += 3) m.triUp(base + tris[i], base + tris[i + 1], base + tris[i + 2]);
  return flat;
}

/**
 * Ribbon along a polyline between lateral offsets `left` and `right` (metres,
 * positive = left of the direction of travel), with mitred joins.
 */
function ribbon(m, line, left, right, y, col, vScale, u0 = 0, u1 = 1) {
  const n = line.length / 2;
  if (n < 2) return;
  let dist = 0;
  let prev = -1;
  for (let i = 0; i < n; i++) {
    const x = line[i * 2], z = line[i * 2 + 1];
    // Unit perpendiculars of the segments before and after this point.
    let px = 0, pz = 0, k = 1;
    const seg = (j) => {
      const dx = line[j * 2 + 2] - line[j * 2], dz = line[j * 2 + 3] - line[j * 2 + 1];
      const len = Math.hypot(dx, dz) || 1;
      return [-dz / len, dx / len];
    };
    if (i === 0) [px, pz] = seg(0);
    else if (i === n - 1) [px, pz] = seg(n - 2);
    else {
      const [ax, az] = seg(i - 1), [bx, bz] = seg(i);
      px = ax + bx; pz = az + bz;
      const len = Math.hypot(px, pz);
      if (len < 1e-3) { px = ax; pz = az; } else { px /= len; pz /= len; }
      k = 1 / Math.max(0.5, px * ax + pz * az); // mitre length, capped at 2×
    }
    if (i > 0) dist += Math.hypot(x - line[i * 2 - 2], z - line[i * 2 - 1]);
    const v = dist * vScale;
    const l = m.v(x + px * left * k, y, z + pz * left * k, 0, 1, 0, u0, v, col);
    m.v(x + px * right * k, y, z + pz * right * k, 0, 1, 0, u1, v, col);
    if (prev >= 0) { m.triUp(prev, prev + 1, l); m.triUp(prev + 1, l + 1, l); }
    prev = l;
  }
}

/** Round end cap (filled circle) so road joins have no wedge-shaped gaps. */
function disc(m, x, z, r, y, col, u, v) {
  const c = m.v(x, y, z, 0, 1, 0, u, v, col);
  const seg = 10;
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    m.v(x + Math.cos(a) * r, y, z + Math.sin(a) * r, 0, 1, 0, u, v, col);
    if (i) m.triUp(c, c + i, c + i + 1);
  }
}

const signedArea = (r) => {
  let a = 0;
  for (let i = 0, n = r.length / 2, j = n - 1; i < n; j = i++) a += r[j * 2] * r[i * 2 + 1] - r[i * 2] * r[j * 2 + 1];
  return a / 2;
};
function pointInRing(x, z, r) {
  let inside = false;
  for (let i = 0, n = r.length / 2, j = n - 1; i < n; j = i++) {
    const xi = r[i * 2], zi = r[i * 2 + 1], xj = r[j * 2], zj = r[j * 2 + 1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** Uniform grid over item bounding boxes, stored as compressed rows (CSR). */
function buildGrid(boxes, count, transfer) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < count; i++) {
    x0 = Math.min(x0, boxes[i * 4]); z0 = Math.min(z0, boxes[i * 4 + 1]);
    x1 = Math.max(x1, boxes[i * 4 + 2]); z1 = Math.max(z1, boxes[i * 4 + 3]);
  }
  if (!count) { x0 = z0 = 0; x1 = z1 = 1; }
  const nx = Math.max(1, Math.ceil((x1 - x0) / GRID_CELL)), nz = Math.max(1, Math.ceil((z1 - z0) / GRID_CELL));
  const cells = Array.from({ length: nx * nz }, () => []);
  const cx = (x) => Math.min(nx - 1, Math.max(0, Math.floor((x - x0) / GRID_CELL)));
  const cz = (z) => Math.min(nz - 1, Math.max(0, Math.floor((z - z0) / GRID_CELL)));
  for (let i = 0; i < count; i++) {
    for (let a = cx(boxes[i * 4]); a <= cx(boxes[i * 4 + 2]); a++)
      for (let b = cz(boxes[i * 4 + 1]); b <= cz(boxes[i * 4 + 3]); b++) cells[b * nx + a].push(i);
  }
  const start = new Uint32Array(nx * nz + 1);
  let total = 0;
  cells.forEach((c, i) => { start[i] = total; total += c.length; });
  start[nx * nz] = total;
  const items = new Uint32Array(total);
  let k = 0;
  for (const c of cells) for (const i of c) items[k++] = i;
  transfer.push(start.buffer, items.buffer);
  return { x0, z0, cell: GRID_CELL, nx, nz, start, items };
}

/** Pack polygons (each a list of rings in world coordinates) for collision tests. */
function packPolys(polys, transfer) {
  let nPts = 0, nRings = 0;
  for (const p of polys) for (const r of p) { nPts += r.length / 2; nRings++; }
  const coords = new Float32Array(nPts * 2);
  const ringStart = new Uint32Array(nRings + 1);
  const polyRing = new Uint32Array(polys.length + 1);
  const box = new Float32Array(polys.length * 4);
  let pi = 0, ri = 0;
  polys.forEach((p, k) => {
    polyRing[k] = ri;
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const r of p) {
      ringStart[ri++] = pi;
      for (let i = 0; i < r.length; i += 2) {
        coords[pi * 2] = r[i]; coords[pi * 2 + 1] = r[i + 1]; pi++;
        x0 = Math.min(x0, r[i]); x1 = Math.max(x1, r[i]); z0 = Math.min(z0, r[i + 1]); z1 = Math.max(z1, r[i + 1]);
      }
    }
    box.set([x0, z0, x1, z1], k * 4);
  });
  ringStart[nRings] = pi;
  polyRing[polys.length] = ri;
  transfer.push(coords.buffer, ringStart.buffer, polyRing.buffer, box.buffer);
  return { coords, ringStart, polyRing, box, count: polys.length, grid: buildGrid(box, polys.length, transfer) };
}

function buildTile(t) {
  const transfer = [];
  const ox = (t.tx + 0.5) * t.size, oz = (t.tz + 0.5) * t.size; // tile centre in world metres
  const toWorld = (r) => { const w = new Float32Array(r.length); for (let i = 0; i < r.length; i += 2) { w[i] = r[i] + ox; w[i + 1] = r[i + 1] + oz; } return w; };

  // ---- buildings
  const walls = new MeshBuilder(), roofs = new MeshBuilder();
  const tanks = [];
  const solid = [];
  t.buildings.forEach((b, bi) => {
    const r0 = rand(t.tx * 7919 + bi, t.tz);
    const area = Math.abs(signedArea(b.rings[0]));
    const hex = (b.color[0] << 16) | (b.color[1] << 8) | b.color[2];
    const base = linear(hex);
    const bottom = linear(hex, 0.78);
    const small = area < 500;
    const roofHex = small && r0 < 0.08 ? 0x3d6ea8 : small && r0 < 0.14 ? 0x8a5a44 : 0x8f8a84; // blue tarpaulin, rust, concrete
    const roof = linear(roofHex, 0.85 + rand(bi, 3) * 0.3);
    const y0 = b.minHeight > 0.2 ? b.minHeight : -0.4;
    const y1 = b.height;
    const uOff = Math.floor(rand(bi, 5) * FACADE_BAYS) / FACADE_BAYS;
    const vOff = Math.floor(rand(bi, 9) * FACADE_FLOORS) / FACADE_FLOORS;
    const vScale = 1 / (FLOOR * FACADE_FLOORS);
    const v0 = (Math.max(0, y0) - 0.6) * vScale + vOff, v1 = (y1 - 0.6) * vScale + vOff; // first floor starts 0.6 m up
    for (const ring of b.rings) {
      let u = uOff;
      const n = ring.length / 2;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const ax = ring[i * 2], az = ring[i * 2 + 1], bx = ring[j * 2], bz = ring[j * 2 + 1];
        const len = Math.hypot(bx - ax, bz - az);
        if (len < 0.05) continue;
        // Bays snap to whole windows per wall so windows never get cut at corners.
        const bays = Math.max(1, Math.round(len / BAY)) / FACADE_BAYS;
        wall(walls, ax, az, bx, bz, y0, y1, (bz - az) / len, -(bx - ax) / len, u, u + bays, v0, v1, bottom, base);
        u += bays;
      }
    }
    flatPolygon(roofs, b.rings, y1, roof, ox, oz, 0.25);
    if (y0 > 0) flatPolygon(roofs, b.rings, y0, bottom, ox, oz, 0.25); // underside of canopies
    if (!(b.flags & BUILDING_FLAG.NO_COLLIDE)) solid.push(b.rings.map(toWorld));

    // Black plastic water tanks on Mumbai roofs.
    if (area > 60 && y1 > 6 && y0 <= 0.2) {
      let cx = 0, cz = 0;
      const r = b.rings[0];
      for (let i = 0; i < r.length; i += 2) { cx += r[i]; cz += r[i + 1]; }
      cx /= r.length / 2; cz /= r.length / 2;
      const count = 1 + Math.floor(rand(bi, 11) * Math.min(4, area / 150));
      for (let k = 0; k < count; k++) {
        const px = cx + (rand(bi, 20 + k) - 0.5) * Math.sqrt(area) * 0.4;
        const pz = cz + (rand(bi, 40 + k) - 0.5) * Math.sqrt(area) * 0.4;
        if (pointInRing(px, pz, r)) tanks.push(px, y1, pz, 0.8 + rand(bi, 60 + k) * 0.6);
      }
    }
  });

  // ---- ground: areas, sea walls along the land edge
  const ground = new MeshBuilder();
  const walkable = [];
  const [cx0, cz0, cx1, cz1] = t.clip;
  // Bit mask of the tile clip edges a point lies on (corners lie on two).
  const onClipEdge = (x, z) =>
    (Math.abs(x - cx0) < 0.06 ? 1 : 0) | (Math.abs(x - cx1) < 0.06 ? 2 : 0) |
    (Math.abs(z - cz0) < 0.06 ? 4 : 0) | (Math.abs(z - cz1) < 0.06 ? 8 : 0);
  const seaWallTop = linear(0x9a948a), seaWallBottom = linear(0x5f5a52);
  for (const a of t.areas) {
    const [hex, y] = AREA_LOOK[a.kind] || AREA_LOOK[AREA.LAND];
    flatPolygon(ground, a.rings, y, linear(hex), ox, oz, 0.25);
    if (a.kind === AREA.LAND || a.kind === AREA.PIER) walkable.push(a.rings.map(toWorld));
    if (a.kind !== AREA.LAND) continue;
    for (const ring of a.rings) {
      const n = ring.length / 2;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const ax = ring[i * 2], az = ring[i * 2 + 1], bx = ring[j * 2], bz = ring[j * 2 + 1];
        if (onClipEdge(ax, az) & onClipEdge(bx, bz)) continue; // tile seam, not a coast
        const len = Math.hypot(bx - ax, bz - az);
        if (len < 0.05) continue;
        wall(ground, ax, az, bx, bz, SEA_WALL_BOTTOM, 0.001, (bz - az) / len, -(bx - ax) / len, 0, len / 4, 0, 0.4, seaWallBottom, seaWallTop);
      }
    }
  }

  // ---- roads
  const marked = new MeshBuilder(), plain = new MeshBuilder();
  const white = [255, 255, 255];
  const segs = [], segName = [];
  for (const r of t.roads) {
    const [baseY, hex] = ROAD_LOOK[r.cls] || ROAD_LOOK[ROAD.RESIDENTIAL];
    const y = baseY + r.layer * 0.003;
    const hw = r.width / 2;
    const isMarked = MARKED(r.cls);
    const m = isMarked ? marked : plain;
    const col = isMarked ? white : linear(hex);
    ribbon(m, r.line, hw, -hw, y, col, 1 / 9);
    const n = r.line.length / 2;
    if (r.cls < ROAD.FOOTWAY || r.cls === ROAD.PIER) {
      for (const k of [0, n - 1]) {
        const x = r.line[k * 2], z = r.line[k * 2 + 1];
        if (!onClipEdge(x, z)) disc(m, x, z, hw, y - 0.002, col, 0.3, 0.75);
      }
    }
    for (let i = 0; i + 1 < n; i++) {
      segs.push(r.line[i * 2] + ox, r.line[i * 2 + 1] + oz, r.line[i * 2 + 2] + ox, r.line[i * 2 + 3] + oz, hw);
      segName.push(r.cls >= ROAD.FOOTWAY && r.cls !== ROAD.PIER ? -1 : r.name);
    }
  }

  // ---- railways: ballast bed with sleepers, two steel rails (Indian broad gauge 1.676 m)
  const bed = new MeshBuilder(), steel = new MeshBuilder();
  const ballast = linear(0x8a8070);
  for (const r of t.rails) {
    ribbon(bed, r.line, 1.7, -1.7, 0.065, ballast, 1 / 0.65);
    for (const s of [1, -1]) ribbon(steel, r.line, s * 0.9, s * 0.8, 0.2, white, 0.1);
  }

  // ---- collision data (world coordinates)
  const segArr = new Float32Array(segs);
  const segBox = new Float32Array((segs.length / 5) * 4);
  for (let i = 0; i < segs.length / 5; i++) {
    const [x0, z0, x1, z1, hw] = segs.slice(i * 5, i * 5 + 5);
    segBox.set([Math.min(x0, x1) - hw, Math.min(z0, z1) - hw, Math.max(x0, x1) + hw, Math.max(z0, z1) + hw], i * 4);
  }
  const segNameArr = new Int32Array(segName);
  transfer.push(segArr.buffer, segNameArr.buffer);
  const tankArr = new Float32Array(tanks);
  transfer.push(tankArr.buffer);

  return {
    result: {
      tx: t.tx, tz: t.tz, origin: [ox, oz], names: t.names,
      clip: [cx0 + ox, cz0 + oz, cx1 + ox, cz1 + oz],
      meshes: {
        walls: walls.finish(transfer), roofs: roofs.finish(transfer), ground: ground.finish(transfer),
        roadsMarked: marked.finish(transfer), roadsPlain: plain.finish(transfer),
        railBed: bed.finish(transfer), railSteel: steel.finish(transfer),
      },
      tanks: tankArr,
      collide: {
        solid: packPolys(solid, transfer),
        walkable: packPolys(walkable, transfer),
        roads: { segs: segArr, names: segNameArr, count: segs.length / 5, grid: buildGrid(segBox, segs.length / 5, transfer) },
      },
      stats: { buildings: t.buildings.length, roads: t.roads.length },
    },
    transfer,
  };
}

async function gunzipIfNeeded(buf) {
  const u8 = new Uint8Array(buf);
  if (u8[0] !== 0x1f || u8[1] !== 0x8b) return u8; // server already decompressed it
  const stream = new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

self.onmessage = async (e) => {
  const { id, url } = e.data;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const tile = decodeTile(await gunzipIfNeeded(await res.arrayBuffer()));
    const { result, transfer } = buildTile(tile);
    self.postMessage({ id, result }, transfer);
  } catch (err) {
    self.postMessage({ id, error: String(err && err.stack || err) });
  }
};
