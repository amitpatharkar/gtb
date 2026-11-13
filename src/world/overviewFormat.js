// Overview file for the full-screen map and the GPS (public/tiles/overview.bin.gz), written by
// scripts/build-tiles.mjs. One small file for the whole map, so the map and route finding
// never need every tile: vehicle roads (whole OpenStreetMap ways, junctions kept, one-ways),
// main-line railways and simplified land, inland water, parks, beaches and airfield paving.
//
// Varints as in tileFormat.js. Coordinates are world positions on a grid of 1/quant metres;
// every point is a delta from the previous point in the file (lines continue the cursor).
//
//   "GTBO" magic, version, quant (grid units per metre)
//   names[]                    road names (referenced by index)
//   roads[]:  class, flags (1 = one-way), name index + 1 (0 = none), line
//   rails[]:  line
//   layers[]: kind (OVERVIEW_LAYER), polygons[]: rings[] (outer first, with a positive signed
//             area in (x, z) as in tile files; holes negative, so nonzero filling works)
import { ByteReader } from './tileFormat.js';

export const OVERVIEW_VERSION = 1;
export const OVERVIEW_MAGIC = [0x47, 0x54, 0x42, 0x4f]; // "GTBO"
export const OVERVIEW_LAYER = { LAND: 0, WATER: 1, GREEN: 2, SAND: 3, PAVED: 4 };

/** Decode an uncompressed overview into plain objects (Float32Array lines in world metres). */
export function decodeOverview(u8) {
  const r = new ByteReader(u8);
  for (const m of OVERVIEW_MAGIC) if (r.u8() !== m) throw new Error('Not a GTB overview');
  const version = r.uvar();
  if (version !== OVERVIEW_VERSION) throw new Error(`Overview version ${version}, expected ${OVERVIEW_VERSION}`);
  const q = r.uvar();
  let x = 0, z = 0;
  const line = () => {
    const n = r.uvar();
    const out = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      x += r.svar(); z += r.svar();
      out[i * 2] = x / q; out[i * 2 + 1] = z / q;
    }
    return out;
  };
  const names = [];
  for (let i = r.uvar(); i > 0; i--) names.push(r.string());
  const roads = [];
  for (let i = r.uvar(); i > 0; i--) roads.push({ cls: r.u8(), flags: r.u8(), name: r.uvar() - 1, line: line() });
  const rails = [];
  for (let i = r.uvar(); i > 0; i--) rails.push(line());
  const layers = [];
  for (let i = r.uvar(); i > 0; i--) {
    const kind = r.u8(), polys = [];
    for (let k = r.uvar(); k > 0; k--) {
      const rings = [];
      for (let j = r.uvar(); j > 0; j--) rings.push(line());
      polys.push(rings);
    }
    layers.push({ kind, polys });
  }
  return { quant: q, names, roads, rails, layers };
}
