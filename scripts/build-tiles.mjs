#!/usr/bin/env node
/**
 * Map converter: OpenStreetMap extract (.osm.pbf) → compressed game tiles.
 *
 *   npm run tiles
 *   npm run tiles -- --bbox 18.890,72.795,18.975,72.860 --name "South Mumbai"
 *
 * Reads data/raw/mumbai-region.osm.pbf, keeps the bounding box (south,west,north,east),
 * projects to local metres (x = east, z = south, origin = box centre), and writes
 * public/tiles/<tx>_<tz>.bin.gz plus public/tiles/index.json.
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
import { AREA, ROAD, ROAD_FLAG, RAIL, RAIL_FLAG, BUILDING_FLAG, MAGIC, TILE_VERSION, DM } from '../src/world/tileFormat.js';

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
  name: args.name || 'South Mumbai',
  bbox: (args.bbox || '18.890,72.795,18.975,72.860').split(',').map(Number), // south, west, north, east
  margin: 0.01, // extra degrees read around the box so features crossing the edge stay whole
  tileSize: 500,
  spawn: (args.spawn || '18.9217,72.8340').split(',').map(Number), // Apollo Bunder, by the Gateway of India
  spawnLabel: args.spawnLabel || 'Gateway of India',
};
const LEVEL = 3.2; // metres per storey
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

// ---------------------------------------------------------------- projection
const [S, W, N, E] = CFG.bbox;
const lat0 = (S + N) / 2, lon0 = (W + E) / 2;
const rad = Math.PI / 180;
const M_LAT = 111132.92 - 559.82 * Math.cos(2 * lat0 * rad) + 1.175 * Math.cos(4 * lat0 * rad);
const M_LON = 111412.84 * Math.cos(lat0 * rad) - 93.5 * Math.cos(3 * lat0 * rad);
const project = (lat, lon) => [(lon - lon0) * M_LON, -(lat - lat0) * M_LAT];
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
  if (am === 'parking' || l === 'stadium' || hw === 'pedestrian' && t.type === 'multipolygon') return AREA.PAVED;
  if (l === 'pitch' || l === 'track') return AREA.PITCH;
  if (GREEN_LEISURE.has(l) || GREEN_LANDUSE.has(u) || n === 'grassland') return AREA.GRASS;
  if (n === 'wood' || n === 'scrub' || n === 'wetland' || u === 'forest' || u === 'orchard') return AREA.WOOD;
  if (n === 'beach' || n === 'sand') return AREA.SAND;
  if (DIRT_LANDUSE.has(u) || l === 'schoolyard') return AREA.DIRT;
  if (u === 'railway') return AREA.RAILYARD;
  return null;
}

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
  if (!['rail', 'light_rail', 'narrow_gauge', 'subway', 'tram'].includes(t.railway)) return null;
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

function wallColour(t, id) {
  const c = (t['building:colour'] || t.colour || '').toLowerCase().trim();
  if (/^#[0-9a-f]{6}$/.test(c)) return parseInt(c.slice(1), 16);
  if (/^#[0-9a-f]{3}$/.test(c)) return parseInt(c.slice(1).split('').map((d) => d + d).join(''), 16);
  if (NAMED[c.replace(/[\s_-]/g, '')]) return NAMED[c.replace(/[\s_-]/g, '')];
  const heritage = t.heritage || t.historic || WORSHIP.has(t.building);
  const pal = heritage ? HERITAGE : WALLS;
  return pal[Math.floor(hash01(id, 7) * pal.length)];
}

function buildingHeights(t, id, area) {
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
      h = Math.floor(lv) * LEVEL + 0.8;
    }
  }
  if (h <= minH + 0.3) h = minH + 1;
  let flags = 0;
  if (canopy || minH >= 2.5) flags |= BUILDING_FLAG.NO_COLLIDE;
  if (t.heritage || t.historic) flags |= BUILDING_FLAG.HERITAGE;
  return { h, minH, flags };
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
    relations.push({ id, tags, ways });
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
readOsmPbf(CFG.input, {
  node(id, lat, lon) {
    if (lat < S - M || lat > N + M || lon < W - M || lon > E + M) return;
    const [x, z] = project(lat, lon);
    nodeX.set(id, x);
    nodeZ.set(id, z);
  },
  way(id, tags, refs) {
    if (relWays.has(id)) wayRefs.set(id, refs);
    let any = false;
    for (const r of refs) if (nodeX.has(r)) { any = true; break; }
    if (!any) return;
    const closed = refs.length >= 4 && refs[0] === refs[refs.length - 1];
    if (tags.natural === 'coastline') { coastWays.push(refs); return; }
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
        if (ring) areasRaw.push({ id, kind: a, polys: [[ring]] });
        return;
      }
    }
    const road = classifyRoad(tags);
    if (road) {
      for (const pts of resolveLine(refs)) roadsRaw.push({ id, tags, info: road, pts });
      return;
    }
    const rail = classifyRail(tags);
    if (rail) for (const pts of resolveLine(refs)) railsRaw.push({ id, info: rail, pts });
  },
});
log(`pass 2: ${nodeX.size} nodes, ${buildingsRaw.length} building ways, ${areasRaw.length} areas, ${roadsRaw.length} roads, ${railsRaw.length} rails, ${coastWays.length} coastline ways`);

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
/** Node ids → polylines, split wherever nodes are missing (outside the margin). */
function resolveLine(refs) {
  const lines = [];
  let cur = [];
  for (const r of refs) {
    const x = nodeX.get(r);
    if (x === undefined) { if (cur.length > 1) lines.push(cur); cur = []; continue; }
    cur.push([x, nodeZ.get(r)]);
  }
  if (cur.length > 1) lines.push(cur);
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
  else areasRaw.push({ id: rel.id, kind: classifyArea(rel.tags), polys });
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

// Ground areas, clipped to each tile's land (piers stay over the sea).
let areaCount = 0;
for (const a of areasRaw) {
  if (a.kind === 'water') continue;
  const polys = round2(a.polys);
  const bb = G.bboxOf(polys.flatMap((p) => p[0]));
  for (const tile of tilesOverlapping(bb)) {
    const mask = a.kind === AREA.PIER ? rectPoly(tile.clip) : tile.land;
    if (!mask.length) continue;
    const parts = safe(() => polygonClipping.intersection(polys, mask), `area ${a.id}`);
    for (const p of parts) { tile.areas.push({ kind: a.kind, poly: p }); areaCount++; }
  }
}
for (const tile of tiles.values()) for (const p of tile.land) tile.areas.unshift({ kind: AREA.LAND, poly: p });
log(`areas: ${areaCount} pieces`);

// Buildings: whole footprints, assigned to the tile holding their centre.
// Simple 3D Buildings rule: if an outline contains building:part pieces, draw the parts instead.
const parts = buildingsRaw.filter((b) => b.part).map((b) => G.centroid(b.polys[0][0]));
let bCount = 0, bSkipped = 0, bWithHeight = 0;
for (const b of buildingsRaw) {
  for (const poly of b.polys) {
    const outer = poly[0];
    const c = G.centroid(outer);
    if (!inBox(c)) continue;
    if (!b.part && parts.length) {
      const bb = G.bboxOf(outer);
      if (parts.some(([x, z]) => x >= bb[0] && x <= bb[2] && z >= bb[1] && z <= bb[3] && G.pointInRing(x, z, outer))) { bSkipped++; continue; }
    }
    const area = Math.abs(G.signedArea(outer));
    if (area < 4) continue;
    const { h, minH, flags } = buildingHeights(b.tags, b.id, area);
    if (b.tags.height || b.tags['building:levels']) bWithHeight++;
    const tile = getTile(Math.floor(c[0] / T), Math.floor(c[1] / T));
    const rings = poly.map((ring, i) => {
      let r = quantize(G.simplifyRing(ring, 0.15), tile.cx, tile.cz, true);
      // Outer rings positive signed area in (x, z), holes negative (the worker relies on this).
      if ((G.signedArea(r) > 0) !== (i === 0)) r = r.reverse();
      return r;
    }).filter((r) => r.length >= 3);
    if (!rings.length || rings[0].length < 3) continue;
    tile.buildings.push({ h, minH, color: wallColour(b.tags, b.id), flags, rings });
    bCount++;
  }
}
log(`buildings: ${bCount} (${bWithHeight} with height or levels tagged, ${bSkipped} outlines replaced by parts)`);

// Roads and rails: polylines clipped to each tile.
function addLines(list, put) {
  let n = 0;
  for (const item of list) {
    const bb = G.bboxOf(item.pts);
    for (const tile of tilesOverlapping(bb)) {
      for (const part of clipPolyline(item.pts, tile.clip)) {
        const q = quantize(G.simplifyLine(part, 0.2), tile.cx, tile.cz, false);
        if (q.length >= 2) { put(tile, item, q); n++; }
      }
    }
  }
  return n;
}
const roadName = (t) => t['name:en'] || t.name || t.ref || '';
const nRoads = addLines(roadsRaw, (tile, r, line) => {
  const name = roadName(r.tags);
  let idx = -1;
  if (name) {
    if (!tile.names.has(name)) tile.names.set(name, tile.names.size);
    idx = tile.names.get(name);
  }
  tile.roads.push({ ...r.info, name: idx, layer: r.id % 5, line });
});
const nRails = addLines(railsRaw, (tile, r, line) => tile.rails.push({ ...r.info, line }));
log(`roads: ${nRoads} pieces, rails: ${nRails} pieces`);

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
  if (!t.areas.length && !t.buildings.length && !t.roads.length && !t.rails.length) continue;
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
    w.u8(b.flags);
    w.rings(b.rings);
  }

  const areas = [];
  for (const a of t.areas) {
    const rings = a.poly.map((ring, i) => {
      let r = quantize(G.simplifyRing(G.openRing(ring), 0.3), t.cx, t.cz, true);
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

  const gz = zlib.gzipSync(w.result(), { level: 9 });
  fs.writeFileSync(path.join(CFG.out, `${t.tx}_${t.tz}.bin.gz`), gz);
  index.push([t.tx, t.tz, gz.length]);
  total += gz.length;
}

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
  tiles: index,
};
fs.writeFileSync(path.join(CFG.out, 'index.json'), JSON.stringify(meta));
log(`wrote ${index.length} tiles, ${(total / 1024 / 1024).toFixed(2)} MB total, largest ${(Math.max(...index.map((i) => i[2])) / 1024).toFixed(0)} KB → ${path.relative(root, CFG.out)}`);
log(`spawn: ${JSON.stringify(spawn)}`);
