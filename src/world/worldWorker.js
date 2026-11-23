// Web Worker: download a map tile, unzip, decode, and build everything the main thread needs:
// render meshes (ground, kerbs, buildings), one triangle soup for the static physics collider,
// point features and road lines for the minimap. Buildings that stand on a road are dropped
// here (OpenStreetMap outlines sometimes overlap the street).
import { decodeTile, AREA, ROAD, BUILDING_FLAG } from './tileFormat.js';
import { Y } from './levels.js';
import { buildGround } from './mesh/ground.js';
import { buildBlocks } from './mesh/blocks.js';
import { MeshBuilder, flatPolygon, pointInRing, inPolygon, WHITE } from './mesh/builder.js';

// Ground texture coordinates wrap every UV_PERIOD metres (a common multiple of the texture sizes).
const UV_PERIOD = 1872;
// Ground meshes that are solid (the rest are paint or thin decoration on top of a solid one).
const SOLID_GROUND = new Set(['road', 'footpath', 'plot', 'paved', 'grass', 'wood', 'pitch', 'sand', 'dirt', 'railyard', 'pier', 'pool', 'kerb', 'kerbBW', 'kerbPlain', 'seawall', 'parapet', 'railBed']);

function blocksRoad(b, segs) {
  if (b.minHeight > 2.5) return false;
  const outer = b.rings[0];
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < outer.length; i += 2) { x0 = Math.min(x0, outer[i]); x1 = Math.max(x1, outer[i]); z0 = Math.min(z0, outer[i + 1]); z1 = Math.max(z1, outer[i + 1]); }
  for (const s of segs) {
    if (Math.max(s.ax, s.bx) < x0 || Math.min(s.ax, s.bx) > x1 || Math.max(s.az, s.bz) < z0 || Math.min(s.az, s.bz) > z1) continue;
    const len = Math.hypot(s.bx - s.ax, s.bz - s.az), n = Math.max(1, Math.ceil(len / 1.5));
    let run = 0, worst = 0;
    for (let k = 0; k <= n; k++) {
      const f = k / n, x = s.ax + (s.bx - s.ax) * f, z = s.az + (s.bz - s.az) * f;
      if (inPolygon(x, z, b.rings)) { run += len / n; worst = Math.max(worst, run); } else run = 0;
    }
    if (worst > s.limit) return true;
  }
  return false;
}

function buildTile(t) {
  const transfer = [];
  const ox = (t.tx + 0.5) * t.size, oz = (t.tz + 0.5) * t.size;
  const uvX = ox - UV_PERIOD * Math.floor(ox / UV_PERIOD), uvZ = oz - UV_PERIOD * Math.floor(oz / UV_PERIOD);

  // Vehicle road centre lines (tile-local), with how far a building may cover them.
  const segs = [], lines = [];
  for (const r of t.roads) {
    const vehicle = r.cls <= ROAD.SERVICE && r.cls !== ROAD.PEDESTRIAN;
    if (r.cls <= ROAD.TRACK) lines.push(r.cls, r.width, r.line.length / 2, ...r.line);
    if (!vehicle) continue;
    const limit = r.cls === ROAD.SERVICE ? 14 : 5;
    for (let i = 0; i + 3 < r.line.length; i += 2) segs.push({ ax: r.line[i], az: r.line[i + 1], bx: r.line[i + 2], bz: r.line[i + 3], limit });
  }
  const roadAreas = t.areas.filter((a) => a.kind === AREA.ROAD);
  const keep = (b) => {
    if (b.flags & BUILDING_FLAG.WALL) {
      // Compound walls: drop the ones whose middle sits on the asphalt.
      const r = b.rings[0];
      let cx = 0, cz = 0;
      for (let i = 0; i < r.length; i += 2) { cx += r[i]; cz += r[i + 1]; }
      cx /= r.length / 2; cz /= r.length / 2;
      return !roadAreas.some((a) => inPolygon(cx, cz, a.rings));
    }
    return !blocksRoad(b, segs);
  };

  const { builders: ground } = buildGround(t, uvX, uvZ);
  const { builders: blocks, collision, dropped } = buildBlocks(t, keep);

  // Collision soup: solid ground + land underneath (fills any gap between ground polygons) + buildings.
  const pos = collision.pos, idx = collision.idx;
  const addSoup = (m) => {
    const base = pos.length / 3;
    for (let k = 0; k < m.p.length; k++) pos.push(m.p[k]);
    for (let k = 0; k < m.i.length; k++) idx.push(m.i[k] + base);
  };
  for (const [key, m] of ground) if (SOLID_GROUND.has(key)) addSoup(m);
  const land = new MeshBuilder();
  for (const a of t.areas) if (a.kind === AREA.LAND) flatPolygon(land, a.rings, Y.ROAD - 0.01, WHITE, 0, 0);
  addSoup(land);

  const meshes = {};
  for (const [key, m] of [...ground, ...blocks]) meshes[key] = m.finish(transfer);
  const colPos = new Float32Array(pos), colIdx = new Uint32Array(idx);
  transfer.push(colPos.buffer, colIdx.buffer);

  // Point features by kind: [x, z, angle, size] tile-local.
  const points = {};
  for (const p of t.points) (points[p.kind] ||= []).push(p.x, p.z, p.angle, p.size);
  for (const k in points) { points[k] = new Float32Array(points[k]); transfer.push(points[k].buffer); }
  const roadLines = new Float32Array(lines);
  transfer.push(roadLines.buffer);
  const names = t.names;
  // Named road segments for "which street am I on": [x0 z0 x1 z1 halfWidth nameIndex].
  const named = [];
  for (const r of t.roads) {
    if (r.name < 0 || r.cls > ROAD.SERVICE) continue;
    for (let i = 0; i + 3 < r.line.length; i += 2) named.push(r.line[i], r.line[i + 1], r.line[i + 2], r.line[i + 3], r.width / 2, r.name);
  }
  const namedSegs = new Float32Array(named);
  transfer.push(namedSegs.buffer);

  return {
    result: {
      tx: t.tx, tz: t.tz, origin: [ox, oz], meshes, collider: { pos: colPos, idx: colIdx }, points, roadLines, names, namedSegs,
      stats: { buildings: t.buildings.length, dropped, triangles: colIdx.length / 3 },
    },
    transfer,
  };
}

async function gunzipIfNeeded(buf) {
  const u8 = new Uint8Array(buf);
  if (u8[0] !== 0x1f || u8[1] !== 0x8b) return u8; // the server already decompressed it
  const stream = new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

self.onmessage = async (e) => {
  const { id, url } = e.data;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const { result, transfer } = buildTile(decodeTile(await gunzipIfNeeded(await res.arrayBuffer())));
    self.postMessage({ id, result }, transfer);
  } catch (err) {
    self.postMessage({ id, error: String((err && err.stack) || err) });
  }
};
