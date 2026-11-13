#!/usr/bin/env node
/**
 * Map converter: OpenStreetMap extract (.osm.pbf) → compressed game tiles.
 *
 *   npm run tiles
 *   npm run tiles -- --bbox 18.890,72.795,18.975,72.860 --name "South Mumbai"   (quick local build)
 *
 * Reads data/raw/mumbai-region.osm.pbf, keeps the bounding box (south,west,north,east),
 * projects to local metres (x = east, z = south) around a fixed world origin (--origin,
 * Mahim by default, so coordinates and tile numbers never move when the box grows), and
 * writes public/tiles/<tx>_<tz>.bin.gz plus public/tiles/index.json.
 * Tile format: src/world/tileFormat.js.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import polygonClipping from 'polygon-clipping';
import { clipPolyline } from 'lineclip';
import { readOsmPbf } from './lib/osm-pbf.mjs';
import { ByteWriter, quantize } from './lib/byte-writer.mjs';
import * as G from './lib/geometry.mjs';
import * as C from './lib/clip.mjs';
import { FOOTPATH, isVehicle, junctions, markings, streetFurniture, treeKind } from './lib/streets.mjs';
import { districtAt, pickStyle, STYLE } from './lib/districts.mjs';
import { AREA, ROAD, ROAD_FLAG, RAIL, RAIL_FLAG, BUILDING_FLAG, POINT, MAGIC, TILE_VERSION, DM } from '../src/world/tileFormat.js';
import { OVERVIEW_MAGIC, OVERVIEW_VERSION, OVERVIEW_LAYER } from '../src/world/overviewFormat.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(
  process.argv.slice(2).join(' ').split('--').filter(Boolean).map((s) => {
    const [k, ...v] = s.trim().split(/\s+/);
    return [k, v.join(' ')];
  })
);
const CFG = {
  input: path.resolve(root, args.input || 'data/raw/mumbai-region.osm.pbf'),
  out: path.resolve(root, args.out || 'public/tiles'),
  name: args.name || 'Mumbai',
  // The island city from Colaba to Mahim plus Bandra, Juhu, Andheri, Kurla and Powai.
  // (South Mumbai alone, for quick local runs: --bbox 18.890,72.795,18.975,72.860)
  bbox: (args.bbox || '18.890,72.795,19.140,72.920').split(',').map(Number), // south, west, north, east
  // Fixed world origin (Mahim, near the middle of the island city and the suburbs): every
  // box shares one coordinate system, and nothing is more than ~16 km from it.
  origin: (args.origin || '19.03,72.85').split(',').map(Number),
  margin: 0.01, // extra degrees read around the box so features crossing the edge stay whole
  tileSize: 500,
  spawn: (args.spawn || '18.9217,72.8340').split(',').map(Number), // Apollo Bunder, by the Gateway of India
  spawnLabel: args.spawnLabel || 'Gateway of India',
};
const LEVEL = 3.2; // metres per storey
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

// ---------------------------------------------------------------- projection
// Flat (equirectangular) projection with metres per degree taken at the origin: under 0.1 %
// error across the whole city, so the 1:1 scale holds.
const [S, W, N, E] = CFG.bbox;
const [lat0, lon0] = CFG.origin;
const rad = Math.PI / 180;
const M_LAT = 111132.92 - 559.82 * Math.cos(2 * lat0 * rad) + 1.175 * Math.cos(4 * lat0 * rad);
const M_LON = 111412.84 * Math.cos(lat0 * rad) - 93.5 * Math.cos(3 * lat0 * rad);
const project = (lat, lon) => [(lon - lon0) * M_LON, -(lat - lat0) * M_LAT];
const unproject = (x, z) => [lat0 - z / M_LAT, lon0 + x / M_LON];
const districtXZ = (x, z) => { const [la, lo] = unproject(x, z); return districtAt(la, lo); };
const r1 = (v) => Math.round(v * DM) / DM;
const [bx0, bz0] = project(N, W);
const [bx1, bz1] = project(S, E);
const BOX = [r1(bx0), r1(bz0), r1(bx1), r1(bz1)]; // x0, z0 (north edge), x1, z1 (south edge)
const inBox = ([x, z]) => x >= BOX[0] && x <= BOX[2] && z >= BOX[1] && z <= BOX[3];

// ---------------------------------------------------------------- tag rules
function classifyBuilding(t) {
  const b = t.building, part = t['building:part'];
  if (t.location === 'underground' || b === 'underground' || parseFloat(t.layer) < 0) return null;
  if (b && b !== 'no') return 'building';
  if (part && part !== 'no') return 'part';
  return null;
}

const GREEN_LEISURE = new Set(['park', 'garden', 'playground', 'golf_course', 'recreation_ground', 'common', 'dog_park', 'village_green']);
const GREEN_LANDUSE = new Set(['grass', 'recreation_ground', 'village_green', 'meadow', 'cemetery', 'flowerbed', 'plant_nursery']);
const DIRT_LANDUSE = new Set(['construction', 'brownfield', 'landfill', 'greenfield']);
/** Returns an AREA kind, 'water', or null. */
function classifyArea(t) {
  const { natural: n, leisure: l, landuse: u, amenity: am, man_made: mm, railway: rw, highway: hw, waterway: ww } = t;
  if (n === 'water' || ww === 'riverbank' || ww === 'dock' || u === 'reservoir' || u === 'basin') return 'water';
  if (l === 'swimming_pool') return AREA.POOL;
  if (mm === 'pier') return AREA.PIER;
  if (rw === 'platform') return AREA.PLATFORM;
  if ((hw === 'pedestrian' || hw === 'footway' || hw === 'service') && t.area === 'yes') return AREA.PAVED;
  // Racecourses (Mahalaxmi) are tagged as stadiums but are mostly turf.
  if (l === 'stadium' && (t.sport === 'horse_racing' || /race ?course/i.test(t.name || '') || GREEN_LANDUSE.has(u))) return AREA.GRASS;
  // Airfields: grass with paved aprons (runways and taxiways are lines, see AEROWAY_WIDTH).
  if (t.aeroway === 'aerodrome') return AREA.GRASS;
  if (t.aeroway === 'apron' || AEROWAY_WIDTH[t.aeroway] && t.area === 'yes') return AREA.PAVED;
  if (am === 'parking' || l === 'stadium' || hw === 'pedestrian' && t.type === 'multipolygon') return AREA.PAVED;
  if (l === 'pitch' || l === 'track') return AREA.PITCH;
  if (GREEN_LEISURE.has(l) || GREEN_LANDUSE.has(u) || n === 'grassland') return AREA.GRASS;
  if (n === 'wood' || n === 'scrub' || n === 'wetland' || u === 'forest' || u === 'orchard') return AREA.WOOD;
  if (n === 'beach' || n === 'sand') return AREA.SAND;
  if (DIRT_LANDUSE.has(u) || l === 'schoolyard') return AREA.DIRT;
  if (u === 'railway') return AREA.RAILYARD;
  return null;
}

/** Open ground where no trees are scattered (racecourses, airfields, stadiums). */
const openGround = (t) => t.leisure === 'stadium' || t.aeroway === 'aerodrome';
/** Default paved widths of runway and taxiway centre lines (m). */
const AEROWAY_WIDTH = { runway: 45, stopway: 45, taxiway: 23, taxilane: 12 };

const HIGHWAYS = {
  motorway: [ROAD.MOTORWAY, 15], trunk: [ROAD.TRUNK, 14], primary: [ROAD.PRIMARY, 12],
  secondary: [ROAD.SECONDARY, 10], tertiary: [ROAD.TERTIARY, 8.5],
  motorway_link: [ROAD.LINK, 7], trunk_link: [ROAD.LINK, 7], primary_link: [ROAD.LINK, 6.5],
  secondary_link: [ROAD.LINK, 6.5], tertiary_link: [ROAD.LINK, 6],
  unclassified: [ROAD.RESIDENTIAL, 6.5], residential: [ROAD.RESIDENTIAL, 6], road: [ROAD.RESIDENTIAL, 6],
  living_street: [ROAD.LIVING, 5], service: [ROAD.SERVICE, 4.5], pedestrian: [ROAD.PEDESTRIAN, 5],
  footway: [ROAD.FOOTWAY, 2.2], path: [ROAD.FOOTWAY, 2], cycleway: [ROAD.FOOTWAY, 2.2],
  steps: [ROAD.FOOTWAY, 2], bridleway: [ROAD.FOOTWAY, 2], track: [ROAD.TRACK, 3.5],
};
function classifyRoad(t) {
  if (t.man_made === 'pier') return { cls: ROAD.PIER, width: num(t.width, 2, 30) || 4 };
  const def = HIGHWAYS[t.highway];
  if (!def || t.area === 'yes') return null;
  if (t.tunnel && t.tunnel !== 'no' && t.tunnel !== 'building_passage') return null;
  if (t.footway === 'crossing' || t.highway === 'footway' && t.footway === 'access_aisle') return null;
  let [cls, width] = def;
  if (cls === ROAD.SERVICE && (t.service === 'driveway' || t.service === 'parking_aisle')) width = 3.5;
  const lanes = parseInt(t.lanes, 10);
  if (lanes > 0 && cls <= ROAD.SERVICE) width = Math.max(width, Math.min(lanes, 10) * 3.2 + 1);
  width = num(t.width, 2, 40) || width;
  let flags = 0;
  if (t.bridge && t.bridge !== 'no') flags |= ROAD_FLAG.BRIDGE;
  if (t.oneway === 'yes' || t.oneway === '1') flags |= ROAD_FLAG.ONEWAY;
  return { cls, width, flags };
}

function classifyRail(t) {
  // Main-line railways only. The Metro (railway=subway) and the monorail run on viaducts here;
  // they are left out until they can be raised on piers (flat track would block the roads).
  if (t.railway !== 'rail' && t.railway !== 'narrow_gauge') return null;
  if ((t.tunnel && t.tunnel !== 'no') || t.location === 'underground' || parseFloat(t.layer) < 0) return null;
  return { cls: t.service ? RAIL.SERVICE : RAIL.MAIN, flags: t.bridge && t.bridge !== 'no' ? RAIL_FLAG.BRIDGE : 0 };
}

function num(v, min, max) {
  const n = parseLength(v);
  return n >= min && n <= max ? n : 0;
}
function parseLength(v) {
  if (v == null) return NaN;
  const m = String(v).trim().replace(',', '.').match(/^(-?\d+(?:\.\d+)?)\s*(m|ft|feet|')?/);
  if (!m) return NaN;
  const n = parseFloat(m[1]);
  return m[2] && m[2] !== 'm' ? n * 0.3048 : n;
}
const hash01 = (id, salt = 0) => (Math.imul((id % 4294967296) ^ salt, 2654435761) >>> 0) / 4294967296;

// ---------------------------------------------------------------- building looks
const WALLS = [0xeee6d3, 0xe9dcc0, 0xf2eee6, 0xe6d3a3, 0xdcc8a0, 0xe8c4a8, 0xd9b8a0, 0xc9d3d8,
  0xd2dccb, 0xe3d9c6, 0xcfc6b8, 0xf0e2c0, 0xbfc8cc, 0xe0cfb8, 0xf3f1ea, 0xd7cfe0];
const HERITAGE = [0xc9b48e, 0xb8a582, 0xd1bf98, 0xa89880, 0xc2ae8a];
const NAMED = {
  white: 0xf2f0ea, grey: 0xa9a9a9, gray: 0xa9a9a9, yellow: 0xead27a, red: 0xb85c4c, brown: 0x8b6a4f,
  beige: 0xe3d6b4, cream: 0xefe4c8, blue: 0x7f9fc0, green: 0x8fb08a, orange: 0xe0a060, pink: 0xe3b1b8,
  black: 0x3a3a3a, maroon: 0x7a3b36, silver: 0xc0c0c0, tan: 0xd2b48c, lightgrey: 0xcfcfcf, darkgrey: 0x6f6f6f,
};
const WORSHIP = new Set(['church', 'cathedral', 'chapel', 'mosque', 'temple', 'synagogue', 'shrine', 'religious']);
const SMALL = new Set(['hut', 'shed', 'kiosk', 'garage', 'garages', 'cabin', 'toilets', 'container', 'service',
  'transformer_tower', 'guardhouse', 'shelter', 'gatehouse', 'booth']);
const HOUSE = new Set(['house', 'detached', 'bungalow', 'semidetached_house', 'terrace', 'villa', 'farm']);
const BIG_SHED = new Set(['industrial', 'warehouse', 'hangar', 'manufacture', 'train_station', 'transportation', 'depot']);
const TOWER_TYPES = new Set(['yes', 'apartments', 'residential', 'commercial', 'office', 'hotel', 'mixed']);

function wallColour(t, id) {
  const c = (t['building:colour'] || t.colour || '').toLowerCase().trim();
  if (/^#[0-9a-f]{6}$/.test(c)) return parseInt(c.slice(1), 16);
  if (/^#[0-9a-f]{3}$/.test(c)) return parseInt(c.slice(1).split('').map((d) => d + d).join(''), 16);
  if (NAMED[c.replace(/[\s_-]/g, '')]) return NAMED[c.replace(/[\s_-]/g, '')];
  const heritage = t.heritage || t.historic || WORSHIP.has(t.building);
  const pal = heritage ? HERITAGE : WALLS;
  return pal[Math.floor(hash01(id, 7) * pal.length)];
}

function buildingHeights(t, id, area, d) {
  const type = t.building && t.building !== 'yes' ? t.building : t['building:part'] || 'yes';
  let h = parseLength(t.height ?? t['building:height']);
  const levels = parseFloat(t['building:levels']);
  let minH = parseLength(t.min_height ?? t['building:min_height']);
  if (!(minH >= 0)) minH = parseFloat(t['building:min_level']) * LEVEL;
  if (!(minH >= 0)) minH = 0;
  const canopy = type === 'roof' || type === 'carport';
  if (canopy && !minH) minH = 3;
  if (!(h > 0) && levels > 0) h = Math.min(levels, 120) * LEVEL + 0.8;
  if (!(h > 0)) {
    const r = hash01(id);
    if (canopy) h = minH + 0.6;
    else if (SMALL.has(type)) h = 3 + r * 1.5;
    else if (HOUSE.has(type)) h = (1 + Math.floor(r * 3)) * LEVEL + 0.8;
    else if (WORSHIP.has(type)) h = 10 + r * 10;
    else if (BIG_SHED.has(type)) h = 7 + r * 7;
    else if (type === 'stadium' || type === 'grandstand') h = 18;
    else if (type === 'construction') h = 4 + r * 16;
    else if (type === 'storage_tank' || type === 'silo') h = 10;
    else {
      // Dense South Mumbai: mostly 3–7 storey blocks, more for big footprints.
      let lv = area < 50 ? 1 + r * 2 : area < 150 ? 2 + r * 3 : area < 400 ? 3 + r * 4 : area < 1200 ? 4 + r * 4 : 4 + r * 6;
      if (type === 'apartments') lv += 2;
      // District rules: suburban bungalows, self-built low-rise, and towers on big plots
      // (Worli, Lower Parel, Hiranandani); only 3–10 % of suburban outlines carry real heights.
      const rule = d?.lv;
      if (rule?.bungalows && area < rule.bungalows && (HOUSE.has(type) || type === 'yes' || type === 'residential')) lv = 1 + r * 2.4;
      const tw = rule?.towers;
      if (tw && area >= tw[0] && TOWER_TYPES.has(type) && hash01(id, 5) < tw[1]) lv = tw[2] + hash01(id, 9) * (tw[3] - tw[2]);
      if (rule?.cap) lv = Math.min(lv, 1 + r * (rule.cap - 0.6));
      h = Math.floor(lv) * LEVEL + 0.8;
    }
  }
  if (h <= minH + 0.3) h = minH + 1;
  let flags = 0;
  if (canopy || minH >= 2.5) flags |= BUILDING_FLAG.NO_COLLIDE;
  if (t.heritage || t.historic) flags |= BUILDING_FLAG.HERITAGE;
  return { h, minH, flags, type };
}

/** Style (wall material + window type), wall colour, storeys and shop likelihood. */
const STYLE_COLOURS = {
  [STYLE.STONE]: ['#F3EEE4', '#EFE6D6', '#E8DECC', '#F6F2EA'],   // tint over buff sandstone texture
  [STYLE.BASALT]: ['#C9C5BF', '#BDB8B1', '#D3CFC8'],             // tint over dark stone texture
  [STYLE.CONCRETE]: ['#D6D2C8', '#C9C4B8', '#B9B4A9', '#DDD8CE', '#CFC7B8'],
  [STYLE.GLASS]: ['#7B8C99', '#5C6C78', '#8FA7A0', '#6F8796', '#9AA7AE'],
  [STYLE.SHED]: ['#B9B1A6', '#A8A39A', '#C2B6A2'],
  [STYLE.BRICK]: ['#F1EBE2', '#E8DED2'],
};
const hex = (c) => parseInt(c.slice(1), 16);
function buildingLook(b, type, h, area, d) {
  const t = b.tags, r = hash01(b.id, 3);
  let style;
  if (type === 'construction') style = STYLE.BRICK;
  else if (SMALL.has(type) || BIG_SHED.has(type) && type !== 'train_station') style = r < 0.6 ? STYLE.SHED : STYLE.PLASTER;
  else if (type === 'church' || type === 'cathedral' || type === 'chapel') style = STYLE.STONE;
  else if (h > 32 && d.tall && !(t.heritage || t.historic)) style = pickStyle(d.tall, r); // district towers (Hiranandani, Worli…)
  else if (h > 60) style = r < 0.4 ? STYLE.GLASS : r < 0.7 ? STYLE.CONCRETE : STYLE.PLASTER;
  else if ((t.heritage || t.historic) && h < 40) style = r < 0.8 ? STYLE.STONE : STYLE.BASALT;
  else if (h > 32) style = pickStyle({ CONCRETE: 4, PLASTER: 4, GLASS: d.styles.GLASS ? 3 : 1 }, r);
  else style = pickStyle(d.styles, r);
  let color;
  const named = (t['building:colour'] || t.colour || '').toLowerCase().trim();
  if (/^#[0-9a-f]{6}$/.test(named) && style !== STYLE.STONE && style !== STYLE.GLASS) color = hex(named);
  else {
    const pal = STYLE_COLOURS[style] || d.colours;
    color = hex(pal[Math.floor(hash01(b.id, 7) * pal.length)]);
  }
  const levels = Math.max(1, Math.min(250, Math.round(parseFloat(t['building:levels']) || (h - 0.8) / LEVEL)));
  const shopType = ['commercial', 'retail', 'yes', 'apartments', 'residential', 'mixed', 'hotel'].includes(type);
  return { style, color, levels, shops: shopType && h < 60 && hash01(b.id, 11) < d.shops };
}

// ---------------------------------------------------------------- read OpenStreetMap
log(`Reading ${path.relative(root, CFG.input)} for ${CFG.name} [${CFG.bbox.join(', ')}]`);

// Pass 1: multipolygon relations we care about, and the ways they need.
const relations = [];
const relWays = new Set();
readOsmPbf(CFG.input, {
  relation(id, tags, members) {
    if (tags.type !== 'multipolygon') return;
    const kind = classifyBuilding(tags) || classifyArea(tags);
    if (kind == null) return;
    const ways = members.filter((m) => m.type === 'way');
    relations.push({ id, tags, ways, open: openGround(tags) });
    ways.forEach((m) => relWays.add(m.ref));
  },
});
log(`pass 1: ${relations.length} multipolygon relations`);

// Pass 2: node coordinates inside the box (plus margin), then ways.
const M = CFG.margin;
const nodeX = new Map();
const nodeZ = new Map();
const wayRefs = new Map();
const buildingsRaw = []; // { id, tags, polys: [[outer, ...holes]] }
const areasRaw = [];     // { id, kind, polys }
const roadsRaw = [];     // { id, tags, info, pts }
const railsRaw = [];
const coastWays = [];
const aeroLines = [];     // runway and taxiway centre lines: { pts, width, runway }
const treeNodes = [], signalNodes = [], signalIds = new Set(), crossingIds = new Set(), busStops = [], fuel = [];
readOsmPbf(CFG.input, {
  nodeTags: true,
  node(id, lat, lon, tags) {
    if (lat < S - M || lat > N + M || lon < W - M || lon > E + M) return;
    const [x, z] = project(lat, lon);
    nodeX.set(id, x);
    nodeZ.set(id, z);
    if (!tags || !inBox([x, z])) return;
    if (tags.natural === 'tree') treeNodes.push([x, z, id]);
    else if (tags.highway === 'traffic_signals') { signalNodes.push([x, z]); signalIds.add(id); }
    else if (tags.highway === 'crossing') crossingIds.add(id);
    else if (tags.highway === 'bus_stop') busStops.push([x, z]);
    if (tags.amenity === 'fuel') fuel.push([x, z]);
  },
  way(id, tags, refs) {
    if (relWays.has(id)) wayRefs.set(id, refs);
    let any = false;
    for (const r of refs) if (nodeX.has(r)) { any = true; break; }
    if (!any) return;
    const closed = refs.length >= 4 && refs[0] === refs[refs.length - 1];
    if (tags.natural === 'coastline') { coastWays.push(refs); return; }
    if (tags.amenity === 'fuel') { const r = resolveRing(refs, false); if (r) fuel.push(G.centroid(r)); }
    if (closed) {
      const b = classifyBuilding(tags);
      if (b) {
        const ring = resolveRing(refs, true);
        if (ring) buildingsRaw.push({ id, tags, part: b === 'part', polys: [[ring]] });
        return;
      }
      const a = classifyArea(tags);
      if (a != null) {
        const ring = resolveRing(refs, false);
        if (ring) areasRaw.push({ id, kind: a, polys: [[ring]], open: openGround(tags), aero: !!tags.aeroway });
        return;
      }
    }
    const road = classifyRoad(tags);
    if (road) {
      for (const { pts, ids } of resolveLine(refs, true)) roadsRaw.push({ id, tags, info: road, pts, ids, hw: road.width / 2 });
      return;
    }
    const rail = classifyRail(tags);
    if (rail) for (const pts of resolveLine(refs)) railsRaw.push({ id, info: rail, pts });
    const aw = AEROWAY_WIDTH[tags.aeroway];
    if (aw) for (const pts of resolveLine(refs)) aeroLines.push({ pts, width: num(tags.width, 5, 100) || aw, runway: tags.aeroway === 'runway' || tags.aeroway === 'stopway' });
  },
});
log(`pass 2: ${nodeX.size} nodes, ${buildingsRaw.length} building ways, ${areasRaw.length} areas, ${roadsRaw.length} roads, ${railsRaw.length} rails, ${coastWays.length} coastline ways`);
log(`points: ${treeNodes.length} trees, ${signalNodes.length} traffic signals, ${crossingIds.size} crossings, ${busStops.length} bus stops`);

/** Node ids → open ring of [x, z]; strict = give up if any node is missing. */
function resolveRing(refs, strict) {
  const out = [];
  for (let i = 0; i < refs.length - 1; i++) {
    const x = nodeX.get(refs[i]);
    if (x === undefined) { if (strict) return null; continue; }
    out.push([x, nodeZ.get(refs[i])]);
  }
  return out.length >= 3 ? out : null;
}
/** Node ids → polylines, split wherever nodes are missing (outside the margin). withIds: { pts, ids }. */
function resolveLine(refs, withIds = false) {
  const lines = [];
  let cur = [], ids = [];
  const flush = () => { if (cur.length > 1) lines.push(withIds ? { pts: cur, ids } : cur); cur = []; ids = []; };
  for (const r of refs) {
    const x = nodeX.get(r);
    if (x === undefined) { flush(); continue; }
    cur.push([x, nodeZ.get(r)]);
    ids.push(r);
  }
  flush();
  return lines;
}

// Multipolygon relations → polygons with holes.
for (const rel of relations) {
  const outerWays = [], innerWays = [];
  for (const m of rel.ways) {
    const refs = wayRefs.get(m.ref);
    if (refs) (m.role === 'inner' ? innerWays : outerWays).push(refs);
  }
  const b = classifyBuilding(rel.tags);
  const strict = !!b;
  const outers = G.mergeChains(outerWays).closed.map((r) => resolveRing(r, strict)).filter(Boolean);
  if (!outers.length) continue;
  const inners = G.mergeChains(innerWays).closed.map((r) => resolveRing(r, strict)).filter(Boolean);
  const polys = outers.map((o) => [o]);
  for (const inner of inners) {
    const p = polys.find((pp) => G.pointInRing(inner[0][0], inner[0][1], pp[0]));
    if (p) p.push(inner);
  }
  if (b) buildingsRaw.push({ id: rel.id, tags: rel.tags, part: b === 'part', polys });
  else areasRaw.push({ id: rel.id, kind: classifyArea(rel.tags), polys, open: rel.open, aero: !!rel.tags.aeroway });
}

// Runways and taxiways: centre lines with a width → paved airfield polygons (square-cut runway ends).
if (aeroLines.length) {
  const groups = new Map();
  for (const l of aeroLines) {
    const k = `${Math.round(l.width * 5) / 10}|${l.runway}`;
    (groups.get(k) || groups.set(k, { delta: Math.round(l.width * 5) / 10, butt: l.runway, lines: [] }).get(k)).lines.push(l.pts);
  }
  const polys = C.toPolygons(C.bufferLines([...groups.values()], 0.5), 20);
  for (const poly of polys) areasRaw.push({ id: 0, kind: AREA.PAVED, polys: [poly], open: true, aero: true });
  log(`airfields: ${aeroLines.length} runway/taxiway lines → ${polys.length} paved areas`);
}

// ---------------------------------------------------------------- coastline → land
function coastToLand() {
  const { closed, open } = G.mergeChains(coastWays, true);
  const pieces = [], islands = [];
  const clipInto = (pts) => {
    for (const part of clipPolyline(pts, BOX)) if (part.length >= 2) pieces.push(part);
  };
  for (const chain of open) for (const pts of resolveLine(chain)) clipInto(pts);
  for (const ringIds of closed) {
    const lines = resolveLine(ringIds);
    if (lines.length !== 1 || lines[0].length !== ringIds.length) { lines.forEach(clipInto); continue; }
    const ring = G.openRing(lines[0]);
    const outside = ring.findIndex((p) => !inBox(p));
    if (outside < 0) {
      // Island fully inside: land is on the left, which is a negative signed area in (x, z).
      if (G.signedArea(ring) < 0) islands.push(ring);
      continue;
    }
    const rot = ring.slice(outside).concat(ring.slice(0, outside));
    rot.push(rot[0]);
    clipInto(rot);
  }
  if (!pieces.length && !islands.length) {
    log('no coastline in the box: treating the whole box as land');
    return [[[BOX[0], BOX[1]], [BOX[2], BOX[1]], [BOX[2], BOX[3]], [BOX[0], BOX[3]]]];
  }
  return G.buildLand(pieces, islands, BOX);
}
const landRings = coastToLand();
log(`land: ${landRings.length} polygons, ${landRings.reduce((s, r) => s + r.length, 0)} points`);

// ---------------------------------------------------------------- tiles
const T = CFG.tileSize;
const tiles = new Map(); // "tx,tz" → tile
const tileRange = {
  x0: Math.floor(BOX[0] / T), x1: Math.floor((BOX[2] - 1e-6) / T),
  z0: Math.floor(BOX[1] / T), z1: Math.floor((BOX[3] - 1e-6) / T),
};
function getTile(tx, tz) {
  const key = `${tx},${tz}`;
  let t = tiles.get(key);
  if (!t) {
    const clip = [Math.max(tx * T, BOX[0]), Math.max(tz * T, BOX[1]), Math.min((tx + 1) * T, BOX[2]), Math.min((tz + 1) * T, BOX[3])];
    t = { tx, tz, cx: (tx + 0.5) * T, cz: (tz + 0.5) * T, clip, buildings: [], areas: [], roads: [], rails: [], names: new Map(), land: [] };
    tiles.set(key, t);
  }
  return t;
}
const rectPoly = (b) => [[[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]]];
const tilesOverlapping = (bb) => {
  const out = [];
  for (let tx = Math.max(tileRange.x0, Math.floor(bb[0] / T)); tx <= Math.min(tileRange.x1, Math.floor(bb[2] / T)); tx++)
    for (let tz = Math.max(tileRange.z0, Math.floor(bb[1] / T)); tz <= Math.min(tileRange.z1, Math.floor(bb[3] / T)); tz++)
      out.push(getTile(tx, tz));
  return out;
};
const safe = (fn, what) => {
  try { return fn(); } catch (e) { console.warn(`  polygon operation failed (${what}): ${e.message}`); return []; }
};
const round2 = (mp) => mp.map((poly) => poly.map((ring) => ring.map(([x, z]) => [Math.round(x * 100) / 100, Math.round(z * 100) / 100])));

// Land minus inland water, per tile. Clip by column strips first to keep polygons small.
const water = areasRaw.filter((a) => a.kind === 'water').flatMap((a) => a.polys);
const waterBoxes = water.map((p) => G.bboxOf(p[0]));
const landMP = round2(landRings.map((r) => [r]));
for (let tx = tileRange.x0; tx <= tileRange.x1; tx++) {
  const strip = safe(() => polygonClipping.intersection(landMP, rectPoly([tx * T, BOX[1], (tx + 1) * T, BOX[3]])), `land strip ${tx}`);
  if (!strip.length) continue;
  for (let tz = tileRange.z0; tz <= tileRange.z1; tz++) {
    const tile = getTile(tx, tz);
    let land = safe(() => polygonClipping.intersection(strip, rectPoly(tile.clip)), `land ${tx},${tz}`);
    const wet = water.filter((_, i) => G.bboxOverlap(waterBoxes[i], tile.clip));
    if (land.length && wet.length) land = safe(() => polygonClipping.difference(land, ...round2(wet)), `water ${tx},${tz}`);
    tile.land = land;
  }
}
log('land clipped to tiles');

// ---------------------------------------------------------------- streets
// Vehicle roads become one merged asphalt surface per tile, with raised footpaths
// (paver blocks) on both sides; everything else on land is a raised "plot".
// Dual carriageways leave a raised median between them automatically.

/** Uniform grid for nearest-segment and point-in-footprint queries. */
class Grid {
  constructor(cell) { this.cell = cell; this.map = new Map(); }
  key(i, j) { return i * 100003 + j; }
  add(bb, item) {
    const c = this.cell;
    for (let i = Math.floor(bb[0] / c); i <= Math.floor(bb[2] / c); i++)
      for (let j = Math.floor(bb[1] / c); j <= Math.floor(bb[3] / c); j++) {
        const k = this.key(i, j);
        (this.map.get(k) || this.map.set(k, []).get(k)).push(item);
      }
  }
  near(x, z, r, fn) {
    const c = this.cell, seen = new Set();
    for (let i = Math.floor((x - r) / c); i <= Math.floor((x + r) / c); i++)
      for (let j = Math.floor((z - r) / c); j <= Math.floor((z + r) / c); j++)
        for (const it of this.map.get(this.key(i, j)) || []) {
          if (seen.has(it)) continue;
          seen.add(it);
          if (fn(it)) return true;
        }
    return false;
  }
}

const vparts = roadsRaw.filter((r) => isVehicle(r.info.cls));
for (const p of vparts) { p.fw = FOOTPATH[p.info.cls] || 0; p.bbox = G.bboxOf(p.pts); }
const segGrid = new Grid(25);
for (const p of vparts) {
  for (let i = 1; i < p.pts.length; i++) {
    const a = p.pts[i - 1], b = p.pts[i];
    segGrid.add([Math.min(a[0], b[0]) - p.hw, Math.min(a[1], b[1]) - p.hw, Math.max(a[0], b[0]) + p.hw, Math.max(a[1], b[1]) + p.hw], { a, b, p });
  }
}
/** Is (x, z) on a carriageway (within margin metres of its edge)? */
const onRoad = (x, z, margin = 0) => segGrid.near(x, z, 12, ({ a, b, p }) => G.segDist2([x, z], a, b) < (p.hw + margin) ** 2);

const buildingGrid = new Grid(30);
for (const b of buildingsRaw) for (const poly of b.polys) buildingGrid.add(G.bboxOf(poly[0]), poly[0]);
const inBuilding = (x, z, pad = 0) => buildingGrid.near(x, z, pad + 1, (ring) => {
  if (G.pointInRing(x, z, ring)) return true;
  if (!pad) return false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) if (G.segDist2([x, z], ring[j], ring[i]) < pad * pad) return true;
  return false;
});
const inMP = (mp, x, z) => mp.some((poly) => poly.reduce((inside, ring) => (G.pointInRing(x, z, ring) ? !inside : inside), false));
const onLand = (x, z) => {
  const t = tiles.get(`${Math.floor(x / T)},${Math.floor(z / T)}`);
  return !!t && inMP(t.land, x, z);
};

const streetMs = Date.now();
const areaPaths = areasRaw.filter((a) => a.kind !== 'water').map((a) => ({ kind: a.kind, bb: G.bboxOf(a.polys.flatMap((p) => p[0])), paths: C.mpToPaths(a.polys) }));
let areaCount = 0;
for (const tile of tiles.values()) {
  const R = [tile.clip[0] - 40, tile.clip[1] - 40, tile.clip[2] + 40, tile.clip[3] + 40];
  const near = vparts.filter((p) => G.bboxOverlap(p.bbox, R));
  const byWidth = (w) => {
    const groups = new Map();
    for (const p of near) {
      const d = Math.round(w(p) * 10) / 10;
      if (d > 0) (groups.get(d) || groups.set(d, []).get(d)).push(p.pts);
    }
    return [...groups].map(([delta, lines]) => ({ delta, lines }));
  };
  const carriage = C.bufferLines(byWidth((p) => p.hw));
  // Road quality: main roads are smooth; tertiary roads are worn and patched; lanes in the
  // colonies and gallis are rough. Better surfaces win where roads meet.
  const quality = (p) => (p.info.cls <= ROAD.SECONDARY ? 0 : p.info.cls <= ROAD.LINK ? 1 : 2);
  const good = C.bufferLines(byWidth((p) => (quality(p) === 0 ? p.hw : 0)));
  const wornAll = C.bufferLines(byWidth((p) => (quality(p) === 1 ? p.hw : 0)));
  const worn = C.intersect(C.difference(wornAll, good), [C.rectPath(tile.clip)]);
  const poor = C.intersect(C.difference(C.difference(carriage, good), wornAll), [C.rectPath(tile.clip)]);
  const outer = C.union(C.bufferLines(byWidth((p) => (p.fw ? p.hw + p.fw : 0))), carriage);
  const clipRect = [C.rectPath(tile.clip)];
  const land = C.mpToPaths(tile.land);
  const road = C.intersect(carriage, clipRect);
  const footpath = C.intersect(C.difference(outer, carriage), land);
  const plot = C.difference(land, outer);

  // Parks, maidans, beaches…: only on the plot (never over roads or footpaths). Piers sit over the sea.
  const pieces = [];
  let covered = [];
  for (const a of areaPaths) {
    if (!G.bboxOverlap(a.bb, tile.clip)) continue;
    const mask = a.kind === AREA.PIER ? C.difference(clipRect, carriage) : plot;
    const part = C.intersect(a.paths, mask);
    if (!part.length) continue;
    if (a.kind !== AREA.PIER) covered = C.union(covered, part);
    for (const p of C.toPolygons(part, 1)) { pieces.push({ kind: a.kind, poly: p }); areaCount++; }
  }
  // LAND first (collisions and sea walls, not drawn), then the visible ground layers.
  for (const p of tile.land) tile.areas.push({ kind: AREA.LAND, poly: p });
  for (const p of C.toPolygons(C.difference(plot, covered), 1)) tile.areas.push({ kind: AREA.PLOT, poly: p });
  for (const p of C.toPolygons(footpath, 0.5)) tile.areas.push({ kind: AREA.FOOTPATH, poly: p });
  for (const p of C.toPolygons(road, 0.5)) tile.areas.push({ kind: AREA.ROAD, poly: p });
  for (const p of C.toPolygons(worn, 0.5)) tile.areas.push({ kind: AREA.ROAD_WORN, poly: p });
  for (const p of C.toPolygons(poor, 0.5)) tile.areas.push({ kind: AREA.ROAD_POOR, poly: p });
  tile.areas.push(...pieces);
}
log(`streets and areas: ${areaCount} area pieces (${((Date.now() - streetMs) / 1000).toFixed(1)}s)`);

// Junctions, lane markings and zebra crossings (signals within 25 m of a junction).
const junc = junctions(vparts);
const signalGrid = new Grid(50);
for (const [x, z] of signalNodes) signalGrid.add([x, z, x, z], [x, z]);
const signalNear = ([x, z]) => signalGrid.near(x, z, 25, ([sx, sz]) => (sx - x) ** 2 + (sz - z) ** 2 < 625);
const paint = markings(vparts, junc, signalNear, crossingIds);
log(`markings: ${paint.length} painted lines`);

// Street trees, lights and real tree positions from OpenStreetMap.
const rand = (seed) => hash01(Math.floor(Math.abs(seed) * 1000) % 2147483647, 99);
const blocked = (x, z) => !inBox([x, z]) || onRoad(x, z, 0.3) || inBuilding(x, z, 0.8) || !onLand(x, z);
const { trees, lights, clutter } = streetFurniture(vparts, { district: districtXZ, blocked, junc, rand });
const treeGrid = new Grid(10);
const points = [];
const addTree = (t) => {
  if (treeGrid.near(t.x, t.z, 5, ([x, z]) => (x - t.x) ** 2 + (z - t.z) ** 2 < 25)) return;
  treeGrid.add([t.x, t.z, t.x, t.z], [t.x, t.z]);
  points.push(t);
};
for (const [x, z, id] of treeNodes) {
  if (onRoad(x, z, 0.2) || inBuilding(x, z, 0.5)) continue;
  const d = districtXZ(x, z);
  addTree({ kind: d.palms && rand(id) < 0.6 ? POINT.PALM : treeKind(rand(id * 3)), x, z, angle: rand(id * 5) * Math.PI * 2, size: 0.8 + rand(id * 7) * 0.6 });
}
trees.forEach(addTree);
// Trees scattered in parks and gardens (maidans keep their open centres: pitches are excluded by blocked()).
const pitchGrid = new Grid(50);
for (const a of areasRaw) if (a.kind === AREA.PITCH) for (const poly of a.polys) { const bb = G.bboxOf(poly[0]); pitchGrid.add([bb[0] - 3, bb[1] - 3, bb[2] + 3, bb[3] + 3], poly); }
for (const a of areasRaw) {
  if (a.kind !== AREA.GRASS && a.kind !== AREA.WOOD || a.open) continue;
  for (const poly of a.polys) {
    const bb = G.bboxOf(poly[0]);
    const ar = Math.abs(G.signedArea(poly[0]));
    const count = Math.min(400, Math.floor(ar / (a.kind === AREA.WOOD ? 70 : 320)));
    for (let k = 0, placed = 0; k < count * 3 && placed < count; k++) {
      const x = bb[0] + rand(a.id * 13 + k * 2) * (bb[2] - bb[0]), z = bb[1] + rand(a.id * 17 + k * 2 + 1) * (bb[3] - bb[1]);
      if (!inMP([poly], x, z) || blocked(x, z) || inPitch(x, z)) continue;
      addTree({ kind: treeKind(rand(x * 7 + z)), x, z, angle: rand(x + z) * Math.PI * 2, size: 0.85 + rand(x * 3 - z) * 0.6 });
      placed++;
    }
  }
}
function inPitch(x, z) {
  return pitchGrid.near(x, z, 3, (poly) => inMP([poly], x, z));
}
points.push(...lights);
for (const c of clutter) {
  if (c.kind === POINT.STALL && treeGrid.near(c.x, c.z, 3, ([x, z]) => (x - c.x) ** 2 + (z - c.z) ** 2 < 6)) continue;
  points.push(c);
}
for (const [x, z] of fuel) points.push({ kind: POINT.FUEL, x, z, angle: 0, size: 1 });
for (const [x, z] of signalNodes) points.push({ kind: POINT.SIGNAL, x, z, angle: 0, size: 1 });
for (const [x, z] of busStops) if (!onRoad(x, z, 0.5) && !inBuilding(x, z, 0.5)) points.push({ kind: POINT.BUS_STOP, x, z, angle: 0, size: 1 });
for (const pt of points) {
  if (!inBox([pt.x, pt.z])) continue;
  (getTile(Math.floor(pt.x / T), Math.floor(pt.z / T)).points ||= []).push(pt);
}
const count = (k) => points.filter((p) => p.kind === k).length;
log(`points: ${count(POINT.RAIN_TREE) + count(POINT.GULMOHAR) + count(POINT.PEEPAL) + count(POINT.PALM)} trees, ${lights.length} lights, ${count(POINT.STALL)} stalls, ${count(POINT.GARBAGE)} garbage piles, ${count(POINT.POTHOLE)} potholes, ${count(POINT.PUDDLE)} puddles, ${fuel.length} petrol pumps`);
const fuelStations = fuel.map(([x, z]) => [r1(x), r1(z)]);

// Landmarks: hand-built models replace these OpenStreetMap outlines (names are parodies).
// The outline stays for collisions; the model is fitted to its oriented bounding box.
// Only outlines within LANDMARK_RADIUS of the map point count (a bigger map has namesakes,
// such as "BMC Building No E4" in Sion).
const LANDMARK_RADIUS = 300;
const LANDMARKS = [
  { id: 'gateway', name: 'Gateway of Indiyaa', match: /gateway of india/i, at: [18.9220, 72.8347], hide: true },
  { id: 'palace', name: 'Royal Chaj Mahal Palace', match: /taj mahal palace|taj mahal hotel/i, at: [18.9217, 72.8330], hide: true },
  { id: 'terminus', name: 'Chhatrapati Chai Terminus', match: /chhatrapati shivaji (maharaj )?terminus|victoria terminus|^cs[m]?t$/i, at: [18.9400, 72.8355], hide: true },
  { id: 'bmc', name: 'Big Mumbai Council HQ', match: /municipal corporation (building|head|of greater mumbai)|bmc (building|head)/i, at: [18.9405, 72.8344], hide: true },
  { id: 'clocktower', name: 'Rajabhai Tick-Tock Tower', match: /rajabai/i, at: [18.9297, 72.8305], hide: false, size: [16, 16] },
];
function orientedBox(ring) {
  // Minimum-area rectangle over the outline's edge directions.
  let best = null;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), c = Math.cos(ang), s = Math.sin(ang);
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const [x, z] of ring) { const u = x * c + z * s, v = -x * s + z * c; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    const area = (u1 - u0) * (v1 - v0);
    if (!best || area < best.area) {
      const um = (u0 + u1) / 2, vm = (v0 + v1) / 2;
      best = { area, x: um * c - vm * s, z: um * s + vm * c, angle: ang, w: u1 - u0, d: v1 - v0 };
    }
  }
  return best;
}
const landmarks = [];
for (const L of LANDMARKS) {
  const [px, pz] = project(L.at[0], L.at[1]);
  const near = (b) => { const c = G.centroid(b.polys[0][0]); return (c[0] - px) ** 2 + (c[1] - pz) ** 2 < LANDMARK_RADIUS ** 2; };
  const named = buildingsRaw.filter((b) => (L.match.test(b.tags.name || '') || L.match.test(b.tags['name:en'] || '')) && near(b));
  const containing = buildingsRaw.filter((b) => !b.part && b.polys.some((p) => G.pointInRing(px, pz, p[0])));
  const pickBig = (list) => list.sort((a, b) => Math.abs(G.signedArea(b.polys[0][0])) - Math.abs(G.signedArea(a.polys[0][0])))[0];
  const b = pickBig(named.filter((x) => !x.part)) || pickBig(named) || pickBig(containing);
  if (!b || L.size) {
    landmarks.push({ id: L.id, name: L.name, x: Math.round(px * 10) / 10, z: Math.round(pz * 10) / 10, angle: 0, w: L.size?.[0] ?? 20, d: L.size?.[1] ?? 20 });
    log(`landmark ${L.id}: placed at its map point${b ? '' : ' (no outline found)'}`);
    continue;
  }
  const ring = b.polys[0][0];
  const box = orientedBox(ring);
  landmarks.push({ id: L.id, name: L.name, x: Math.round(box.x * 10) / 10, z: Math.round(box.z * 10) / 10, angle: Math.round(box.angle * 1000) / 1000, w: Math.round(box.w * 10) / 10, d: Math.round(box.d * 10) / 10 });
  if (L.hide) {
    // Hide the outline and any building parts standing inside it.
    for (const o of buildingsRaw) {
      const c = G.centroid(o.polys[0][0]);
      if (o === b || G.pointInRing(c[0], c[1], ring)) o.hidden = true;
    }
  }
  log(`landmark ${L.id}: ${b.tags.name || 'outline'} ${box.w.toFixed(0)} × ${box.d.toFixed(0)} m`);
}

// Buildings: whole footprints, assigned to the tile holding their centre.
// Simple 3D Buildings rule: if an outline contains building:part pieces, draw the parts instead.
const partGrid = new Grid(50);
for (const b of buildingsRaw) if (b.part) { const [x, z] = G.centroid(b.polys[0][0]); partGrid.add([x, z, x, z], [x, z]); }
let bCount = 0, bSkipped = 0, bWithHeight = 0;
for (const b of buildingsRaw) {
  for (const poly of b.polys) {
    const outer = poly[0];
    const c = G.centroid(outer);
    if (!inBox(c)) continue;
    if (!b.part) {
      const bb = G.bboxOf(outer);
      const hasPart = partGrid.near((bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2, Math.max(bb[2] - bb[0], bb[3] - bb[1]) / 2,
        ([x, z]) => x >= bb[0] && x <= bb[2] && z >= bb[1] && z <= bb[3] && G.pointInRing(x, z, outer));
      if (hasPart) { bSkipped++; continue; }
    }
    const area = Math.abs(G.signedArea(outer));
    if (area < 4) continue;
    const d = districtXZ(c[0], c[1]);
    const { h, minH, flags, type } = buildingHeights(b.tags, b.id, area, d);
    if (b.tags.height || b.tags['building:levels']) bWithHeight++;
    const tile = getTile(Math.floor(c[0] / T), Math.floor(c[1] / T));
    const look = buildingLook(b, type, h, area, d);
    const rings = poly.map((ring, i) => {
      let r = quantize(G.simplifyRing(ring, 0.15), tile.cx, tile.cz, true);
      // Outer rings positive signed area in (x, z), holes negative (the worker relies on this).
      if ((G.signedArea(r) > 0) !== (i === 0)) r = r.reverse();
      return r;
    }).filter((r) => r.length >= 3);
    if (!rings.length || rings[0].length < 3) continue;
    // Which outer walls face a street (for shopfronts and signboards).
    const front = rings[0].map((p, k) => {
      const q = rings[0][(k + 1) % rings[0].length];
      const ax = p[0] + tile.cx, az = p[1] + tile.cz, bx = q[0] + tile.cx, bz = q[1] + tile.cz;
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 3) return 0;
      const mx = (ax + bx) / 2, mz = (az + bz) / 2, ex = (bx - ax) / len, ez = (bz - az) / len;
      return segGrid.near(mx, mz, 16, ({ a, b: e, p: rp }) => {
        if (rp.info.cls > ROAD.SERVICE) return false;
        const sl = Math.hypot(e[0] - a[0], e[1] - a[1]) || 1;
        const par = Math.abs(((e[0] - a[0]) * ex + (e[1] - a[1]) * ez) / sl);
        return par > 0.75 && G.segDist2([mx, mz], a, e) < (rp.hw + rp.fw + 7) ** 2;
      }) ? 1 : 0;
    });
    let f2 = flags;
    if (look.shops && front.some(Boolean) && minH < 1) f2 |= BUILDING_FLAG.SHOPS;
    if (b.hidden) f2 |= BUILDING_FLAG.HIDDEN;
    tile.buildings.push({ h, minH, color: look.color, flags: f2, style: look.style, levels: look.levels, rings, front });
    bCount++;
  }
}
log(`buildings: ${bCount} (${bWithHeight} with height or levels tagged, ${bSkipped} outlines replaced by parts)`);

// Roads and rails: polylines clipped to each tile. Junction points shared by two or more
// roads are never simplified away, so the road graph stays connected.
const nodeUse = new Map();
for (const r of roadsRaw) for (let i = 0; i < r.pts.length; i++) {
  const k = `${r.pts[i][0]},${r.pts[i][1]}`;
  nodeUse.set(k, (nodeUse.get(k) || 0) + (i === 0 || i === r.pts.length - 1 ? 2 : 1));
}
const isJunction = (p) => (nodeUse.get(`${p[0]},${p[1]}`) || 0) >= 2;
function addLines(list, put, tolerance = 0.2, mustKeep = null) {
  let n = 0;
  for (const item of list) {
    const bb = G.bboxOf(item.pts);
    for (const tile of tilesOverlapping(bb)) {
      for (const part of clipPolyline(item.pts, tile.clip)) {
        const q = quantize(tolerance ? G.simplifyLine(part, tolerance, mustKeep) : part, tile.cx, tile.cz, false);
        if (q.length >= 2) { put(tile, item, q); n++; }
      }
    }
  }
  return n;
}
// Names of private homes of film stars (and the like) are never shown, even on a lane.
const PRIVATE_NAMES = /\b(mannat|jalsa|antilia|prateeksha)\b/i;
const roadName = (t) => { const n = t.name || t['name:en'] || t.ref || ''; return PRIVATE_NAMES.test(n) ? '' : n; }; // one name per road: the signposted `name` first

// OSM often spells one road several ways along its length ("P J Ramchandani Marg",
// "Prem J. Ramchandani Road", "Apollo Bandar Road/P J Ramchandani Marg"). Pieces that touch
// and share a distinctive word are merged and all get the name used along most of them.
{
  const COMMON = new Set(['road', 'marg', 'street', 'lane', 'cross', 'flyover', 'bridge', 'chowk', 'nagar', 'galli', 'gully', 'path', 'avenue', 'station', 'east', 'west', 'north', 'south', 'first', 'second', 'third', 'fourth', 'fifth', 'raod', 'service', 'maharshi', 'maharaj', 'shivaji', 'gandhi', 'mahatma', 'sardar', 'netaji', 'subhash']);
  const words = (n) => new Set(n.toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter((w) => w.length >= 7 && !COMMON.has(w)));
  const named = roadsRaw.filter((r) => roadName(r.tags));
  const parent = new Map(named.map((r) => [r, r]));
  const find = (r) => { while (parent.get(r) !== r) { parent.set(r, parent.get(parent.get(r))); r = parent.get(r); } return r; };
  const byNode = new Map();
  for (const r of named) {
    r.words = words(roadName(r.tags));
    for (const id of r.ids) (byNode.get(id) || byNode.set(id, []).get(id)).push(r);
  }
  for (const list of byNode.values()) {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (roadName(a.tags) === roadName(b.tags) || [...a.words].some((w) => b.words.has(w))) parent.set(find(a), find(b));
    }
  }
  // Same name apart from punctuation ("P D' Mello Road" / "P D Mello Road"), or a shared
  // distinctive word with ends within 40 m of each other (pieces joined by unnamed links).
  const key = (r) => roadName(r.tags).toLowerCase().replace(/[^a-z0-9]/g, '');
  const byKey = new Map();
  for (const r of named) { const k = key(r); if (byKey.has(k)) parent.set(find(r), find(byKey.get(k))); else byKey.set(k, r); }
  const byWord = new Map();
  for (const r of named) for (const w of r.words) (byWord.get(w) || byWord.set(w, []).get(w)).push(r);
  for (const list of byWord.values()) {
    if (list.length > 60) continue;
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (find(a) === find(b)) continue;
      const close = (u, v) => [u.pts[0], u.pts[u.pts.length - 1]].some((p) => v.pts.some((q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 < 1600));
      const near = close(a, b) || close(b, a);
      if (near) parent.set(find(a), find(b));
    }
  }
  const groups = new Map();
  for (const r of named) (groups.get(find(r)) || groups.set(find(r), []).get(find(r))).push(r);
  let renamed = 0;
  for (const g of groups.values()) {
    const score = new Map();
    for (const r of g) {
      let len = 0;
      for (let i = 1; i < r.pts.length; i++) len += Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]);
      const n = roadName(r.tags);
      score.set(n, (score.get(n) || 0) + len - (n.includes('/') || n.includes('(') ? 1e5 : 0));
    }
    const best = [...score].sort((a, b) => b[1] - a[1])[0][0];
    for (const r of g) if (roadName(r.tags) !== best) { r.canon = best; renamed++; }
  }
  // Combined names ("Apollo Bandar Road/P J Ramchandani Marg (Strand Raod)"): use the part
  // that is the name of a road elsewhere.
  const finalName = (r) => r.canon || roadName(r.tags);
  const known = new Set(named.map(finalName).filter((n) => !/[/(]/.test(n)));
  for (const r of named) {
    const n = finalName(r);
    if (!/[/(]/.test(n)) continue;
    const part = n.split(/[/()]/).map((x) => x.trim()).find((x) => known.has(x));
    if (part) { r.canon = part; renamed++; }
  }
  log(`road names: ${renamed} pieces renamed to their road's main name`);
}
const nRoads = addLines(roadsRaw, (tile, r, line) => {
  const name = r.canon || roadName(r.tags);
  let idx = -1;
  if (name) {
    if (!tile.names.has(name)) tile.names.set(name, tile.names.size);
    idx = tile.names.get(name);
  }
  tile.roads.push({ ...r.info, name: idx, layer: r.id % 5, line });
}, 0.2, isJunction);
const nRails = addLines(railsRaw, (tile, r, line) => tile.rails.push({ ...r.info, line }));
const nPaint = addLines(paint, (tile, m, line) => (tile.markings ||= []).push({ width: m.width, line }), 0);
log(`roads: ${nRoads} pieces, rails: ${nRails} pieces, paint: ${nPaint} pieces`);

// ---------------------------------------------------------------- spawn point
function findSpawn() {
  const [sx, sz] = project(CFG.spawn[0], CFG.spawn[1]);
  let best = null;
  for (const r of roadsRaw) {
    if (r.info.cls > ROAD.SERVICE || r.info.cls === ROAD.LINK) continue;
    for (let i = 1; i < r.pts.length; i++) {
      const a = r.pts[i - 1], b = r.pts[i];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 8) continue;
      const d = G.segDist2([sx, sz], a, b) + (r.info.cls > ROAD.TERTIARY ? 900 : 0); // prefer main roads
      if (!best || d < best.d) best = { d, a, b, len };
    }
  }
  if (!best) return { x: 0, z: 0, heading: 0, label: CFG.spawnLabel };
  const { a, b, len } = best;
  const t = Math.max(4 / len, Math.min(1 - 4 / len, ((sx - a[0]) * (b[0] - a[0]) + (sz - a[1]) * (b[1] - a[1])) / (len * len)));
  return {
    x: r1(a[0] + (b[0] - a[0]) * t), z: r1(a[1] + (b[1] - a[1]) * t),
    heading: Math.round(Math.atan2(b[0] - a[0], b[1] - a[1]) * 1000) / 1000, label: CFG.spawnLabel,
  };
}
const spawn = findSpawn();

// ---------------------------------------------------------------- write
fs.mkdirSync(CFG.out, { recursive: true });
for (const f of fs.readdirSync(CFG.out)) if (f.endsWith('.bin.gz') || f === 'index.json') fs.unlinkSync(path.join(CFG.out, f));

const index = [];
let total = 0;
const ordered = [...tiles.values()].sort((a, b) => a.tz - b.tz || a.tx - b.tx);
for (const t of ordered) {
  if (!t.areas.length && !t.buildings.length && !t.roads.length && !t.rails.length && !t.points?.length) continue;
  const w = new ByteWriter();
  MAGIC.forEach((m) => w.u8(m));
  w.uvar(TILE_VERSION);
  w.svar(t.tx); w.svar(t.tz); w.uvar(T);
  for (const [v, o] of [[t.clip[0], t.cx], [t.clip[1], t.cz], [t.clip[2], t.cx], [t.clip[3], t.cz]]) w.svar(Math.round((v - o) * DM));
  const names = [...t.names.keys()];
  w.uvar(names.length);
  names.forEach((n) => w.string(n));

  w.uvar(t.buildings.length);
  for (const b of t.buildings) {
    w.uvar(Math.round(b.h * DM)); w.uvar(Math.round(b.minH * DM));
    w.u8(b.color >> 16); w.u8(b.color >> 8); w.u8(b.color);
    w.u8(b.flags); w.u8(b.style); w.u8(b.levels);
    w.rings(b.rings);
    for (let k = 0; k < b.front.length; k += 8) {
      let byte = 0;
      for (let j = 0; j < 8 && k + j < b.front.length; j++) byte |= b.front[k + j] << j;
      w.u8(byte);
    }
  }

  const areas = [];
  for (const a of t.areas) {
    const rings = a.poly.map((ring, i) => {
      const tol = a.kind === AREA.ROAD || a.kind === AREA.ROAD_WORN || a.kind === AREA.ROAD_POOR || a.kind === AREA.FOOTPATH || a.kind === AREA.PLOT ? 0.06 : 0.3;
      let r = quantize(G.simplifyRing(G.openRing(ring), tol), t.cx, t.cz, true);
      if ((G.signedArea(r) > 0) !== (i === 0)) r = r.reverse();
      return r;
    }).filter((r) => r.length >= 3);
    if (rings.length && Math.abs(G.signedArea(rings[0])) > 1) areas.push({ kind: a.kind, rings });
  }
  w.uvar(areas.length);
  for (const a of areas) { w.u8(a.kind); w.rings(a.rings); }

  w.uvar(t.roads.length);
  for (const r of t.roads) {
    w.u8(r.cls); w.uvar(Math.round(r.width * DM)); w.u8(r.flags); w.uvar(r.name + 1); w.u8(r.layer);
    w.points(r.line);
  }
  w.uvar(t.rails.length);
  for (const r of t.rails) { w.u8(r.cls); w.u8(r.flags); w.points(r.line); }
  const marks = t.markings || [];
  w.uvar(marks.length);
  for (const m of marks) { w.uvar(Math.round(m.width * 100)); w.points(m.line); }
  const pts = t.points || [];
  w.uvar(pts.length);
  for (const p of pts) {
    w.u8(p.kind); w.svar(Math.round((p.x - t.cx) * DM)); w.svar(Math.round((p.z - t.cz) * DM));
    w.u8(Math.round((((p.angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI) * 256) % 256);
    w.u8(Math.max(0, Math.min(255, Math.round(((p.size - 0.5) / 1.5) * 255))));
  }

  const gz = zlib.gzipSync(w.result(), { level: 9 });
  fs.writeFileSync(path.join(CFG.out, `${t.tx}_${t.tz}.bin.gz`), gz);
  index.push([t.tx, t.tz, gz.length]);
  total += gz.length;
}

// ---------------------------------------------------------------- overview (full map + GPS)
// One small file for the full-screen map and route finding (src/ui/mapWorker.js), so neither
// needs every tile. Format: src/world/overviewFormat.js.
const OQ = 2; // grid units per metre
function writeOverview() {
  const w = new ByteWriter();
  OVERVIEW_MAGIC.forEach((m) => w.u8(m));
  w.uvar(OVERVIEW_VERSION);
  w.uvar(OQ);
  let cx = 0, cz = 0;
  const grid = (pts) => {
    const q = [];
    for (const [x, z] of pts) {
      const a = Math.round(x * OQ), b = Math.round(z * OQ), l = q[q.length - 1];
      if (!l || l[0] !== a || l[1] !== b) q.push([a, b]);
    }
    return q;
  };
  const put = (q) => { w.uvar(q.length); for (const [a, b] of q) { w.svar(a - cx); w.svar(b - cz); cx = a; cz = b; } };
  const cell = (q) => Math.floor(q[0][1] / (T * OQ)) * 100000 + Math.floor(q[0][0] / (T * OQ)); // tile order compresses better

  // Vehicle roads: whole ways clipped to the box, junction points kept so the graph connects.
  const roads = [], names = new Map();
  for (const r of roadsRaw) {
    if (!isVehicle(r.info.cls)) continue;
    const name = r.canon || roadName(r.tags);
    for (const part of clipPolyline(r.pts, BOX)) {
      const q = grid(G.simplifyLine(part, 1, isJunction));
      if (q.length < 2) continue;
      if (name && !names.has(name)) names.set(name, names.size);
      roads.push({ cls: r.info.cls, flags: r.info.flags & ROAD_FLAG.ONEWAY ? 1 : 0, name: name ? names.get(name) : -1, q });
    }
  }
  roads.sort((a, b) => cell(a.q) - cell(b.q));
  w.uvar(names.size);
  for (const n of names.keys()) w.string(n);
  w.uvar(roads.length);
  for (const r of roads) { w.u8(r.cls); w.u8(r.flags); w.uvar(r.name + 1); put(r.q); }

  const rails = [];
  for (const r of railsRaw) {
    if (r.info.cls !== RAIL.MAIN) continue;
    for (const part of clipPolyline(r.pts, BOX)) { const q = grid(G.simplifyLine(part, 3)); if (q.length >= 2) rails.push(q); }
  }
  rails.sort((a, b) => cell(a) - cell(b));
  w.uvar(rails.length);
  rails.forEach(put);

  // Areas: outer rings positive, holes negative; small ones left out.
  const polysOf = (list, tol, minArea) => {
    const out = [];
    for (const poly of list) {
      const rings = [];
      for (let i = 0; i < poly.length; i++) {
        const ring = G.openRing(poly[i]);
        if (Math.abs(G.signedArea(ring)) < (i ? minArea / 2 : minArea)) { if (!i) break; continue; }
        let q = grid(G.simplifyRing(ring, tol));
        if (q.length > 1 && q[0][0] === q[q.length - 1][0] && q[0][1] === q[q.length - 1][1]) q.pop();
        if (q.length < 3) { if (!i) break; continue; }
        if ((G.signedArea(q) > 0) !== (i === 0)) q = q.reverse();
        rings.push(q);
      }
      if (rings.length) out.push(rings);
    }
    return out.sort((a, b) => cell(a[0]) - cell(b[0]));
  };
  const of = (pred) => areasRaw.filter(pred).flatMap((a) => a.polys);
  const layers = [
    [OVERVIEW_LAYER.LAND, polysOf(landRings.map((r) => [r]), 3, 50)],
    [OVERVIEW_LAYER.WATER, polysOf(water, 3, 300)],
    [OVERVIEW_LAYER.GREEN, polysOf(of((a) => a.kind === AREA.GRASS || a.kind === AREA.WOOD || a.kind === AREA.PITCH), 2, 150)],
    [OVERVIEW_LAYER.SAND, polysOf(of((a) => a.kind === AREA.SAND), 2, 150)],
    [OVERVIEW_LAYER.PAVED, polysOf(of((a) => a.aero && a.kind === AREA.PAVED), 2, 150)],
  ];
  w.uvar(layers.length);
  for (const [kind, polys] of layers) {
    w.u8(kind);
    w.uvar(polys.length);
    for (const rings of polys) { w.uvar(rings.length); rings.forEach(put); }
  }
  const gz = zlib.gzipSync(w.result(), { level: 9 });
  fs.writeFileSync(path.join(CFG.out, 'overview.bin.gz'), gz);
  log(`overview: ${roads.length} roads, ${names.size} names, ${rails.length} rails, ${layers.map(([, p]) => p.length).join('/')} land/water/green/sand/paved polygons → ${(gz.length / 1024).toFixed(0)} KB`);
  return { file: 'overview.bin.gz', bytes: gz.length };
}
const overview = writeOverview();

const meta = {
  format: TILE_VERSION,
  name: CFG.name,
  attribution: 'Map data © OpenStreetMap contributors (Open Database License)',
  source: path.basename(CFG.input),
  generated: new Date().toISOString(),
  bbox: { south: S, west: W, north: N, east: E },
  origin: { lat: lat0, lon: lon0 },
  metresPerDegree: { lat: M_LAT, lon: M_LON },
  tileSize: T,
  bounds: { minX: BOX[0], minZ: BOX[1], maxX: BOX[2], maxZ: BOX[3] },
  spawn,
  overview,
  fuel: fuelStations,
  landmarks,
  tiles: index,
};
fs.writeFileSync(path.join(CFG.out, 'index.json'), JSON.stringify(meta));
log(`wrote ${index.length} tiles, ${(total / 1024 / 1024).toFixed(2)} MB total, largest ${(Math.max(...index.map((i) => i[2])) / 1024).toFixed(0)} KB → ${path.relative(root, CFG.out)}`);
log(`spawn: ${JSON.stringify(spawn)}`);
