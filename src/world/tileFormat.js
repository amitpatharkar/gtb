// Binary tile format shared by the converter (scripts/build-tiles.mjs) and the
// game's tile worker. One file per ~500 m tile, gzip-compressed on disk.
//
// All numbers are variable-length integers ("varints", 7 bits per byte).
// Coordinates are decimetres relative to the tile centre; each ring/line stores
// its first point relative to (0,0) and every next point as a delta.
//
// Layout:
//   "GTB1" magic, version, tx, tz, tileSize (m), clip rect x0 z0 x1 z1 (dm)
//   names[]                                   (road names, referenced by index)
//   buildings[]: height dm, minHeight dm, r g b (sRGB bytes), flags, rings[]
//   areas[]:     kind, rings[]                (first ring outer, others holes)
//   roads[]:     class, width dm, flags, name index + 1 (0 = none), layer, line
//   rails[]:     class, flags, line

export const TILE_VERSION = 1;
export const MAGIC = [0x47, 0x54, 0x42, 0x31]; // "GTB1"
export const DM = 10; // units per metre

// Ground area kinds. LAND is everything above sea level that is not water.
export const AREA = {
  LAND: 0, PAVED: 1, GRASS: 2, PITCH: 3, WOOD: 4, SAND: 5, POOL: 6,
  PIER: 7, PLATFORM: 8, DIRT: 9, RAILYARD: 10,
};

// Road classes, ordered roughly by importance.
export const ROAD = {
  MOTORWAY: 0, TRUNK: 1, PRIMARY: 2, SECONDARY: 3, TERTIARY: 4, LINK: 5,
  RESIDENTIAL: 6, LIVING: 7, SERVICE: 8, PEDESTRIAN: 9, FOOTWAY: 10, TRACK: 11, PIER: 12,
};
export const ROAD_FLAG = { BRIDGE: 1, ONEWAY: 2 };
export const RAIL = { MAIN: 0, SERVICE: 1 };
export const RAIL_FLAG = { BRIDGE: 1 };
export const BUILDING_FLAG = { NO_COLLIDE: 1, HERITAGE: 2 };

export class ByteReader {
  constructor(u8) { this.b = u8; this.p = 0; }
  u8() { return this.b[this.p++]; }
  uvar() {
    let v = 0, mul = 1, c;
    do { c = this.b[this.p++]; v += (c & 0x7f) * mul; mul *= 128; } while (c & 0x80);
    return v;
  }
  svar() { const v = this.uvar(); return v % 2 ? -(v + 1) / 2 : v / 2; }
  string() {
    const n = this.uvar();
    const s = new TextDecoder().decode(this.b.subarray(this.p, this.p + n));
    this.p += n;
    return s;
  }
  // Ring or polyline -> Float32Array [x0, z0, x1, z1, ...] in metres, tile-local.
  points() {
    const n = this.uvar();
    const out = new Float32Array(n * 2);
    let x = 0, z = 0;
    for (let i = 0; i < n; i++) {
      x += this.svar(); z += this.svar();
      out[i * 2] = x / DM; out[i * 2 + 1] = z / DM;
    }
    return out;
  }
  rings() {
    const n = this.uvar();
    const rings = [];
    for (let i = 0; i < n; i++) rings.push(this.points());
    return rings;
  }
}

/** Decode an uncompressed tile into plain objects (coordinates in metres, tile-local). */
export function decodeTile(u8) {
  const r = new ByteReader(u8);
  for (const m of MAGIC) if (r.u8() !== m) throw new Error('Not a GTB tile');
  const version = r.uvar();
  if (version !== TILE_VERSION) throw new Error(`Tile version ${version}, expected ${TILE_VERSION}`);
  const tile = { tx: r.svar(), tz: r.svar(), size: r.uvar() };
  tile.clip = [r.svar() / DM, r.svar() / DM, r.svar() / DM, r.svar() / DM];
  tile.names = [];
  for (let i = r.uvar(); i > 0; i--) tile.names.push(r.string());
  tile.buildings = [];
  for (let i = r.uvar(); i > 0; i--) {
    const height = r.uvar() / DM, minHeight = r.uvar() / DM;
    const color = [r.u8(), r.u8(), r.u8()];
    const flags = r.u8();
    tile.buildings.push({ height, minHeight, color, flags, rings: r.rings() });
  }
  tile.areas = [];
  for (let i = r.uvar(); i > 0; i--) tile.areas.push({ kind: r.u8(), rings: r.rings() });
  tile.roads = [];
  for (let i = r.uvar(); i > 0; i--) {
    tile.roads.push({ cls: r.u8(), width: r.uvar() / DM, flags: r.u8(), name: r.uvar() - 1, layer: r.u8(), line: r.points() });
  }
  tile.rails = [];
  for (let i = r.uvar(); i > 0; i--) tile.rails.push({ cls: r.u8(), flags: r.u8(), line: r.points() });
  return tile;
}
