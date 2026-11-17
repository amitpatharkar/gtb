// Binary tile format shared by the converter (scripts/build-tiles.mjs) and the
// game's tile worker. One file per ~500 m tile, gzip-compressed on disk.
//
// All numbers are variable-length integers ("varints", 7 bits per byte).
// Coordinates are decimetres relative to the tile centre; each ring/line stores
// its first point relative to (0,0) and every next point as a delta.
//
// Layout (version 4):
//   "GTB1" magic, version, tx, tz, tileSize (m), clip rect x0 z0 x1 z1 (dm)
//   names[]                                   (road names, referenced by index)
//   buildings[]: height dm, minHeight dm, r g b (sRGB bytes), flags, style byte (low 4 bits style,
//                high 4 bits facade kind, FACADE), levels, rings[], then a bitset over the outer
//                ring's edges: 1 = faces a street
//   areas[]:     kind, rings[]                (first ring outer, others holes)
//   roads[]:     class, width dm, flags, name index + 1 (0 = none), OSM layer + 8, street profile (0 = none,
//                else 1-based index into index.json `profiles`), line; with ROAD_FLAG.ELEVATED also the
//                road surface height per vertex (svar cm, each a delta from the previous, 0 = at grade:
//                flyover decks and ramps above, tunnels and open cuts below) and s0 (uvar dm: distance
//                along the OpenStreetMap way to the first vertex, so piers keep one spacing across tiles)
//   rails[]:     class, flags, line
//   markings[]:  width cm, line               (white road paint)
//   points[]:    kind, x dm, z dm, angle (0–255 = full turn), size (0–255 → 0.5–2.0)
//   labels:      strings[] (text on boards, once per tile), then labelled points[]: point index
//                delta, string index (optional at the end: older tiles stop after the points)

export const TILE_VERSION = 4;
export const MAGIC = [0x47, 0x54, 0x42, 0x31]; // "GTB1"
export const DM = 10; // units per metre

// Ground area kinds. LAND (above sea level, minus inland water) is used for collisions
// and sea walls; PLOT is the visible ground between streets (land minus roads and footpaths).
export const AREA = {
  LAND: 0, PAVED: 1, GRASS: 2, PITCH: 3, WOOD: 4, SAND: 5, POOL: 6,
  PIER: 7, PLATFORM: 8, DIRT: 9, RAILYARD: 10, PLOT: 11, ROAD: 12, FOOTPATH: 13,
  ROAD_WORN: 14, ROAD_POOR: 15, // drawn over ROAD (which keeps the kerbs): patched tertiary roads, rough lanes
};

// Road classes, ordered roughly by importance.
export const ROAD = {
  MOTORWAY: 0, TRUNK: 1, PRIMARY: 2, SECONDARY: 3, TERTIARY: 4, LINK: 5,
  RESIDENTIAL: 6, LIVING: 7, SERVICE: 8, PEDESTRIAN: 9, FOOTWAY: 10, TRACK: 11, PIER: 12,
};
// KERB_*: how the kerbs along this road are painted (street library; none set = by road class).
// ELEVATED: heights per vertex follow (scripts/lib/elevation.mjs); TUNNEL: OpenStreetMap tunnel (covered
// where deeper than STRUCT.COVER, an open cut above that).
export const ROAD_FLAG = { BRIDGE: 1, ONEWAY: 2, KERB_BW: 4, KERB_BY: 8, KERB_PLAIN: 16, MEDIAN_BW: 32, ELEVATED: 64, TUNNEL: 128 };
// Elevated and sunken roads (converter, tile worker and collisions agree on these, metres):
// AT_GRADE: parts within this of the ground are ordinary street (asphalt, kerbs, footpaths);
// CLEAR: decks lower than this stand on solid walls (ramps), higher ones on piers with room beneath;
// COVER: open cuts deeper than this become covered tunnel; CEILING: tunnel height over the road.
export const STRUCT = { AT_GRADE: 0.22, CLEAR: 4.6, COVER: -5.6, CEILING: 5.4, DECK: 1.8 };
export const RAIL = { MAIN: 0, SERVICE: 1 };
export const RAIL_FLAG = { BRIDGE: 1 };
export const BUILDING_FLAG = { NO_COLLIDE: 1, HERITAGE: 2, SHOPS: 4, HIDDEN: 8, NETTING: 16, ARCADE: 32, WALL: 64 }; // WALL: compound wall, pillar, hoarding or fence (style = kind, lib/walls.mjs); // ARCADE: ground floor set back behind piers on street-facing walls (Fort, Causeway); // NETTING: under repair (green netting + scaffolding); // HIDDEN: collide only (a hand-built landmark stands there)
// Facade kind (high 4 bits of a building's style byte; scripts/lib/facades.mjs): which windows,
// details and roof a building gets (src/world/facadeRules.js, mesh/buildings.js, facade.js).
// MODERN: aluminium sliders, box grilles, enclosed balconies · OLD: wooden casements and louvres ·
// DECO: steel windows, rounded corners, eyebrows, stepped parapet · GOTHIC: pointed arches, gables,
// turrets · CHAWL: open galleries with doors in a row on the street or courtyard side.
export const FACADE = { MODERN: 0, OLD: 1, DECO: 2, GOTHIC: 3, CHAWL: 4 };
export const POINT = {
  RAIN_TREE: 0, GULMOHAR: 1, PEEPAL: 2, PALM: 3, LIGHT: 4, SIGNAL: 5, BUS_STOP: 6,
  POTHOLE: 7, PUDDLE: 8, GARBAGE: 9, STALL: 10, FUEL: 11, TETRAPOD: 12,
  HEDGE: 13, // clipped hedge in a planted median: size = length (m) along the angle
  CRANE: 14, // tower crane on a construction site: size scales it (height ≈ 32 m × size)
  BARRIER: 15, // orange-and-white water-filled plastic barrier (lane divider in bazaars)
  BARRICADE: 16, // yellow steel traffic-police barricade with a blue board
  BANNER: 17, // flex banner on a lamp post; size picks one of 8 designs
  // Street clutter (scripts/lib/clutter.mjs → src/world/clutter.js). Angles: the side that faces the street.
  UNIPOLE: 18,    // roadside unipole: a V of two hoardings on one steel pole; angle = where the V opens; size scales it
  CABLES: 19,     // cable bundle sagging across a lane: centre, angle = span direction, size × 12 = span (m)
  NAME_BOARD: 20, // blue street-name board at a junction corner; label "English|मराठी"
  DIR_BOARD: 21,  // blue direction board by the kerb facing approaching traffic; label "Dadar|दादर|^;Worli|वरळी|<" (^ < >)
  DIR_GANTRY: 22, // overhead direction gantry: centre of the span, faces traffic, size × 16 = span (m); label as DIR_BOARD
  TARP: 23,       // blue tarpaulin stretched over a bazaar lane: centre, angle = span direction, size × 10 = span (m)
  STALL_TARP: 24, // tarpaulin on bamboo poles over a hawker's stall
  SHAMIANA: 25,   // white cloth canopy on poles over a puja stall
  SHRINE: 26,     // small street shrine: size = 0.5 + 0.25 × kind (lib/clutter.mjs SHRINE)
  FLOWERS: 27,    // flower seller with baskets on the footpath
  GATE: 28,       // compound gate (open steel leaves) with a watchman on a plastic chair
  HANDCART: 29,   // handcart parked on a bazaar footpath (traffic.js: solid, can be taken); angle = heading
  // Owner-made models placed whole (src/world/art.js `at`): angle = the model's local +X, size = scale.
  SITE_FRAME_A: 40, // concrete frame going up, wrapped in scaffolding (owner's SB CITY 10 scene), on a construction site
  SITE_FRAME_B: 41, // the same, a wider block
};
export const LABELLED = new Set([POINT.NAME_BOARD, POINT.DIR_BOARD, POINT.DIR_GANTRY]);

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
    const flags = r.u8(), sb = r.u8(), levels = r.u8();
    const style = sb & 15, facade = sb >> 4;
    const rings = r.rings();
    const n = rings.length ? rings[0].length / 2 : 0;
    const front = new Uint8Array(n);
    for (let b = 0; b < Math.ceil(n / 8); b++) {
      const byte = r.u8();
      for (let k = 0; k < 8 && b * 8 + k < n; k++) front[b * 8 + k] = (byte >> k) & 1;
    }
    tile.buildings.push({ height, minHeight, color, flags, style, facade, levels, rings, front });
  }
  tile.areas = [];
  for (let i = r.uvar(); i > 0; i--) tile.areas.push({ kind: r.u8(), rings: r.rings() });
  tile.roads = [];
  for (let i = r.uvar(); i > 0; i--) {
    const road = { cls: r.u8(), width: r.uvar() / DM, flags: r.u8(), name: r.uvar() - 1, layer: r.u8() - 8, profile: r.u8(), line: r.points(), heights: null, s0: 0 };
    if (road.flags & ROAD_FLAG.ELEVATED) {
      const n = road.line.length / 2, h = (road.heights = new Float32Array(n));
      let v = 0;
      for (let k = 0; k < n; k++) { v += r.svar(); h[k] = v / 100; }
      road.s0 = r.uvar() / DM;
    }
    tile.roads.push(road);
  }
  tile.rails = [];
  for (let i = r.uvar(); i > 0; i--) tile.rails.push({ cls: r.u8(), flags: r.u8(), line: r.points() });
  tile.markings = [];
  for (let i = r.uvar(); i > 0; i--) tile.markings.push({ width: r.uvar() / 100, line: r.points() });
  tile.points = [];
  for (let i = r.uvar(); i > 0; i--) {
    tile.points.push({ kind: r.u8(), x: r.svar() / DM, z: r.svar() / DM, angle: (r.u8() / 256) * Math.PI * 2, size: 0.5 + (r.u8() / 255) * 1.5 });
  }
  if (r.p < r.b.length) {
    const strings = [];
    for (let i = r.uvar(); i > 0; i--) strings.push(r.string());
    let at = 0;
    for (let i = r.uvar(); i > 0; i--) { at += r.uvar(); const s = strings[r.uvar()]; if (tile.points[at]) tile.points[at].label = s; }
  }
  return tile;
}
