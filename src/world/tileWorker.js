// Web Worker: download a tile, unzip it, decode it and turn it into ready-to-upload
// mesh arrays plus collision data, so the main thread only creates GPU buffers.
import { decodeTile, AREA, ROAD } from './tileFormat.js';
import { Y } from './levels.js';
import { buildGround } from './mesh/ground.js';
import { buildBuildings } from './mesh/buildings.js';

const GRID_CELL = 16; // metres, collision grid

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

  const ground = buildGround(t, ox, oz);
  const { builders, tanks, solid } = buildBuildings(t, ox, oz, toWorld);
  const meshes = {};
  for (const [key, m] of [...ground, ...builders]) meshes[key] = m.finish(transfer);

  // Point features (trees, lights, signals, stops, street clutter), grouped by kind:
  // [x, y, z, angle, size] per instance, tile-local.
  const points = {};
  for (const p of t.points) (points[p.kind] ||= []).push(p.x, Y.KERB, p.z, p.angle, p.size);
  for (const k in points) { points[k] = new Float32Array(points[k]); transfer.push(points[k].buffer); }

  // Walkable ground: land and piers (roads over water are checked separately).
  const walkable = t.areas.filter((a) => a.kind === AREA.LAND || a.kind === AREA.PIER).map((a) => a.rings.map(toWorld));

  // Road centre segments for collisions over water, road names and ground height.
  const segs = [], segName = [], segBox = [];
  for (const r of t.roads) {
    const hw = r.width / 2, n = r.line.length / 2;
    const vehicle = r.cls <= ROAD.SERVICE || r.cls === ROAD.TRACK;
    for (let i = 0; i + 1 < n; i++) {
      const x0 = r.line[i * 2] + ox, z0 = r.line[i * 2 + 1] + oz, x1 = r.line[i * 2 + 2] + ox, z1 = r.line[i * 2 + 3] + oz;
      segs.push(x0, z0, x1, z1, hw, vehicle ? 1 : 0);
      segName.push(vehicle ? r.name : -1);
      segBox.push(Math.min(x0, x1) - hw, Math.min(z0, z1) - hw, Math.max(x0, x1) + hw, Math.max(z0, z1) + hw);
    }
  }
  const segArr = new Float32Array(segs), segNameArr = new Int32Array(segName);
  transfer.push(segArr.buffer, segNameArr.buffer);
  const tankArr = new Float32Array(tanks);
  transfer.push(tankArr.buffer);

  return {
    result: {
      tx: t.tx, tz: t.tz, origin: [ox, oz], names: t.names,
      clip: [t.clip[0] + ox, t.clip[1] + oz, t.clip[2] + ox, t.clip[3] + oz],
      meshes, points, tanks: tankArr,
      collide: {
        solid: packPolys(solid, transfer),
        walkable: packPolys(walkable, transfer),
        roads: { segs: segArr, names: segNameArr, count: segName.length, grid: buildGrid(new Float32Array(segBox), segName.length, transfer) },
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
