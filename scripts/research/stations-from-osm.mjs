#!/usr/bin/env node
/**
 * Research extract: suburban railway stations (local trains) and long-distance terminals inside
 * the game's map box, with their full geometry as mapped in the local OpenStreetMap extract
 * → docs/research/metro/osm-stations.json
 *
 *   node scripts/research/stations-from-osm.mjs
 *   node scripts/research/stations-from-osm.mjs --input data/raw/mumbai-region.osm.pbf --out docs/research/metro/osm-stations.json --tolerance 0.5
 *
 * Per station: names (English, Marathi, …), lines (Western, Central, Harbour and long-distance
 * services from the route relations), platforms (outline, length, width, refs, the tracks along
 * each edge), the tracks through the station (cross-sections and clipped centrelines), foot
 * overbridges, skywalks and pedestrian subways (centrelines, widths, steps, escalators, lifts,
 * landings), station buildings and platform roofs, entrances, ticket offices and machines,
 * the station area polygons, the stop area relation, where the game's trains stop today
 * (scripts/lib/trains.mjs run on the same data) and the metro stations nearby
 * (docs/research/metro/osm-metro.json, not duplicated).
 *
 * Reads only; changes nothing else. Needs the npm packages of the repository (pbf, lineclip,
 * clipper-lib): `npm ci --ignore-scripts`.
 *
 * Game coordinates use the tile converter's projection (scripts/build-tiles.mjs): flat
 * (equirectangular) metres around the fixed world origin Mahim 19.03 N, 72.85 E,
 * x = east, z = SOUTH (z grows southwards; north is −z), 1 unit = 1 metre.
 *
 * Everything in the output is what the OpenStreetMap data says, except values whose field name
 * or `link`/`source` text says "inferred" (assignment to a station by distance, name or track,
 * sides, cross-sections, derived lengths and widths) or "default" (widths the data does not give).
 * Map data © OpenStreetMap contributors, Open Database License (ODbL).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clipPolyline } from 'lineclip';
import { readOsmPbf } from '../lib/osm-pbf.mjs';
import * as G from '../lib/geometry.mjs';
import * as C from '../lib/clip.mjs';
import { isTrainRoute, buildTrainLines, stationName as gameStationName } from '../lib/trains.mjs';
import { DM } from '../../src/world/tileFormat.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean).map((s) => {
  const [k, ...v] = s.trim().split(/\s+/);
  return [k, v.join(' ')];
}));
const CFG = {
  input: path.resolve(root, args.input || 'data/raw/mumbai-region.osm.pbf'),
  out: path.resolve(root, args.out || 'docs/research/metro/osm-stations.json'),
  metro: path.resolve(root, args.metro || 'docs/research/metro/osm-metro.json'),
  tolerance: Number(args.tolerance || 0.5),        // Douglas–Peucker tolerance for outlines and centrelines (m)
  extractDate: '2026-11-13',                       // extract.bbbike.org download date (CLAUDE.md)
  extractBox: { south: 18.52, west: 72.598, north: 19.5, east: 73.533 },
  mapBox: { south: 18.89, west: 72.795, north: 19.14, east: 72.92 }, // build-tiles.mjs default --bbox
  margin: 0.01,                                    // degrees read around the box (as the converter does)
  origin: [19.03, 72.85],                          // build-tiles.mjs default --origin (Mahim)
  southMumbai: 19.045,                             // "South Mumbai" (island city) = south of this latitude
};
const DEFAULT_WIDTH = { footbridge: 4, skywalk: 4, steps: 2.5, subway: 4 }; // used only where OSM has no width
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

// ---------------------------------------------------------------- projection (copy of build-tiles.mjs)
const [lat0, lon0] = CFG.origin;
const rad = Math.PI / 180;
const M_LAT = 111132.92 - 559.82 * Math.cos(2 * lat0 * rad) + 1.175 * Math.cos(4 * lat0 * rad);
const M_LON = 111412.84 * Math.cos(lat0 * rad) - 93.5 * Math.cos(3 * lat0 * rad);
const project = (lat, lon) => [(lon - lon0) * M_LON, -(lat - lat0) * M_LAT];
const unproject = (x, z) => [lat0 - z / M_LAT, lon0 + x / M_LON];
const { south: S, west: W, north: N, east: E } = CFG.mapBox;
const MG = CFG.margin;
const inBoxLL = (lat, lon) => lat >= S && lat <= N && lon >= W && lon <= E;
const inMarginLL = (lat, lon) => lat >= S - MG && lat <= N + MG && lon >= W - MG && lon <= E + MG;
const rDM = (v) => Math.round(v * DM) / DM;
const BOXG = [rDM(project(N, W)[0]), rDM(project(N, W)[1]), rDM(project(S, E)[0]), rDM(project(S, E)[1])]; // as the converter's BOX
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;
const r6 = (v) => Math.round(v * 1e6) / 1e6;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const lenXZ = (pts) => { let s = 0; for (let i = 1; i < pts.length; i++) s += dist(pts[i], pts[i - 1]); return s; };
const v = (t, k) => t?.[k] || '';
const pick = (t, keys) => { const o = {}; for (const k of keys) if (t?.[k] != null) o[k] = t[k]; return o; };
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
/** Compass bearing (degrees, 0 = north, clockwise) of a direction in game coordinates. */
const bearingOf = (dx, dz) => ((Math.atan2(dx, -dz) / rad) + 360) % 360;
const compassOf = (dx, dz) => COMPASS[Math.round(bearingOf(dx, dz) / 45) % 8];
function parseLength(val) {
  if (val == null) return null;
  const m = String(val).trim().replace(',', '.').match(/^(\d+(?:\.\d+)?)\s*(m|ft|feet|')?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return m[2] && m[2] !== 'm' ? r2(n * 0.3048) : n;
}

// ---------------------------------------------------------------- tag rules
const isMetroTags = (t) => /^(subway|monorail|light_rail)$/.test(v(t, 'station')) && !/suburban/i.test(v(t, 'network'))
  || t.subway === 'yes' || t.monorail === 'yes' || /\bmetro\b|monorail/i.test(`${v(t, 'network')} ${v(t, 'name')} ${v(t, 'operator')}`);
const SUBURBAN_NET = /mumbai suburban/i;
/** A main-line / suburban station object (node or way): railway=station|halt, or public_transport=station for trains. */
function isRailStation(t) {
  if (isMetroTags(t)) return false;
  if (t.amenity === 'ferry_terminal' || t.amenity === 'bus_station' || ((t.bus === 'yes' || t.ferry === 'yes') && t.train !== 'yes' && !t.railway)) return false;
  if (t.railway === 'station' || t.railway === 'halt') return true;
  return t.public_transport === 'station' && (t.train === 'yes' || t.railway === 'station');
}
const TRACK_RAIL = /^(rail|narrow_gauge|light_rail)$/;
const TRACK_METRO = /^(subway|monorail)$/;
const isPlatformTags = (t) => t.railway === 'platform' || t.public_transport === 'platform' && !(t.bus === 'yes' && t.train !== 'yes') && t.highway !== 'bus_stop';
const WALK = /^(footway|steps|path|pedestrian|corridor|cycleway|elevator)$/;
const isBridge = (t) => (t.bridge && t.bridge !== 'no') || (parseFloat(t.layer) >= 1 && !(t.tunnel && t.tunnel !== 'no'));
const isTunnel = (t) => (t.tunnel && t.tunnel !== 'no' && t.tunnel !== 'building_passage') || parseFloat(t.layer) <= -1 || t.location === 'underground';
const isBuildingTags = (t) => (t.building && t.building !== 'no') || (t['building:part'] && t['building:part'] !== 'no');
const isStationArea = (t) => (t.railway === 'station' || (t.public_transport === 'station' && t.amenity !== 'bus_station' && t.bus !== 'yes')) && !isMetroTags(t);
const NAME_KEYS = ['name', 'name:en', 'name:mr', 'name:hi', 'official_name', 'official_name:en', 'official_name:mr', 'alt_name', 'alt_name:mr', 'old_name', 'old_name:mr', 'short_name', 'loc_name', 'loc_name:mr', 'historic:name'];
const STATION_KEYS = ['ref', 'railway:ref', 'ref:suburban', 'old_ref', 'historic:ref', 'IR:zone', 'operator', 'network', 'station', 'railway', 'public_transport', 'start_date', 'ele', 'wheelchair', 'internet_access', 'wikidata', 'wikipedia'];
const PLATFORM_KEYS = ['ref', 'local_ref', 'name', 'railway', 'public_transport', 'area', 'covered', 'shelter', 'width', 'height', 'level', 'layer', 'surface', 'wheelchair', 'tactile_paving', 'lit', 'bench', 'train', 'note', 'description', 'source'];
const TRACK_KEYS = ['railway', 'service', 'usage', 'name', 'ref', 'railway:track_ref', 'gauge', 'electrified', 'voltage', 'maxspeed', 'bridge', 'tunnel', 'layer', 'operator', 'railway:preferred_direction', 'tracks'];
const WALK_KEYS = ['highway', 'name', 'bridge', 'bridge:structure', 'tunnel', 'layer', 'level', 'width', 'est_width', 'covered', 'lit', 'surface', 'conveying', 'incline', 'step_count', 'handrail', 'ramp', 'wheelchair', 'footway', 'indoor', 'man_made', 'operator', 'ref', 'access', 'foot'];
const BUILDING_KEYS = ['name', 'building', 'building:part', 'building:levels', 'building:min_level', 'height', 'min_height', 'roof:shape', 'roof:colour', 'roof:material', 'building:colour', 'building:material', 'layer', 'level', 'amenity', 'railway', 'public_transport', 'operator', 'covered', 'heritage', 'historic', 'start_date', 'wikidata', 'note'];
const NODE_KEYS = ['name', 'name:mr', 'ref', 'entrance', 'railway', 'highway', 'door', 'level', 'wheelchair', 'shop', 'amenity', 'vending', 'barrier', 'access', 'foot', 'opening_hours', 'operator', 'description', 'note', 'source'];
/** Name key for matching ("Dadar (Central)" ≈ "Dadar", "Kurla Junction" ≈ "Kurla"); keeps "Road" ("Matunga" ≠ "Matunga Road"). */
const loose = (s) => (s || '').toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/\b(railway station|rly station|station|stn|junction|jn)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---------------------------------------------------------------- pass 1: relations
log(`reading ${path.relative(root, CFG.input)}`);
const trainRoutes = [], stopAreas = [], groups = [], mpRels = [];
readOsmPbf(CFG.input, {
  relation(id, tags, members) {
    const t = tags;
    if (t.type === 'route' && t.route === 'train') trainRoutes.push({ id, tags, members });
    else if (t.type === 'public_transport' && t.public_transport === 'stop_area') stopAreas.push({ id, tags, members });
    else if (t.type === 'public_transport' && t.public_transport === 'stop_area_group') groups.push({ id, tags, members });
    else if (t.type === 'multipolygon' && (isBuildingTags(t) || isPlatformTags(t) || isStationArea(t) || t.landuse === 'railway' || t.man_made === 'bridge' || (WALK.test(v(t, 'highway')) && t.area !== 'no'))) mpRels.push({ id, tags, members });
  },
});
const relWays = new Set();
for (const r of mpRels) for (const m of r.members) if (m.type === 'way') relWays.add(m.ref);
log(`pass 1: ${trainRoutes.length} train route relations, ${stopAreas.length} stop areas, ${groups.length} stop area groups, ${mpRels.length} multipolygons of interest`);

// ---------------------------------------------------------------- pass 2: nodes (box + margin)
const coord = new Map();   // node id → [lat, lon]
const nodeTags = new Map(); // tagged nodes of interest
const routeNodeIds = new Set();
for (const r of [...trainRoutes, ...stopAreas]) for (const m of r.members) if (m.type === 'node') routeNodeIds.add(m.ref);
const NODE_OF_INTEREST = (t) => t.railway || t.public_transport || t.entrance || t.highway === 'elevator' || t.shop === 'ticket' || /ticket/.test(v(t, 'vending')) || /ticket/.test(v(t, 'amenity'))
  || t.barrier === 'turnstile' || /booking|ticket|reservation/i.test(`${v(t, 'name')} ${v(t, 'description')}`) || t.train === 'yes';
readOsmPbf(CFG.input, {
  nodeTags: true,
  node(id, lat, lon, tags) {
    if (!inMarginLL(lat, lon)) return;
    coord.set(id, [lat, lon]);
    if (tags && (NODE_OF_INTEREST(tags) || routeNodeIds.has(id))) nodeTags.set(id, tags);
  },
});
log(`pass 2: ${coord.size} node positions in the box + margin, ${nodeTags.size} tagged nodes of interest`);

// ---------------------------------------------------------------- pass 3: ways
const ways = new Map(); // id → { id, tags, refs, kind }
const routeWayIds = new Set();
for (const r of trainRoutes) for (const m of r.members) if (m.type === 'way') routeWayIds.add(m.ref);
readOsmPbf(CFG.input, {
  way(id, tags, refs) {
    let any = false;
    for (const r of refs) if (coord.has(r)) { any = true; break; }
    if (!any) return;
    const t = tags;
    let kind = null;
    if (TRACK_RAIL.test(v(t, 'railway'))) kind = 'track';
    else if (TRACK_METRO.test(v(t, 'railway'))) kind = 'metroTrack';
    else if (isPlatformTags(t) || t.railway === 'platform_edge') kind = 'platform';
    else if (isStationArea(t) || t.landuse === 'railway') kind = 'area';
    else if (isBuildingTags(t)) kind = 'building';
    else if (t.man_made === 'bridge') kind = 'bridgeArea';
    else if (WALK.test(v(t, 'highway')) && (isBridge(t) || isTunnel(t) || t.highway === 'steps' || t.highway === 'elevator' || t.conveying || t.highway === 'corridor' || /sky ?walk|fob|over ?bridge|foot ?bridge|subway/i.test(v(t, 'name')))) kind = 'walk';
    else if (WALK.test(v(t, 'highway'))) kind = 'ground';
    if (!kind && (relWays.has(id) || routeWayIds.has(id))) kind = 'member';
    if (kind) ways.set(id, { id, tags, refs, kind });
  },
});
const byKind = (k) => [...ways.values()].filter((w) => w.kind === k);
log(`pass 3: ${ways.size} ways kept (${['track', 'metroTrack', 'platform', 'area', 'building', 'bridgeArea', 'walk', 'ground'].map((k) => `${byKind(k).length} ${k}`).join(', ')})`);

// ---------------------------------------------------------------- geometry helpers
const xzOfNode = (id) => { const ll = coord.get(id); return ll ? project(ll[0], ll[1]) : null; };
const wayXZ = (w) => w.refs.map(xzOfNode).filter(Boolean);
const closedWay = (w) => w.refs.length >= 4 && w.refs[0] === w.refs[w.refs.length - 1];
const missingNodes = (w) => w.refs.filter((r) => !coord.has(r)).length;
/** Douglas–Peucker on [x, z] points, keeping the original points: { xz, latlon }. */
function outLine(pts, closed = false, tol = CFG.tolerance) {
  const tagged = pts.map((p, i) => [p[0], p[1], i]);
  const kept = closed ? G.simplifyRing(G.openRing(tagged), tol) : G.simplifyLine(tagged, tol);
  return { xz: kept.map((p) => [r1(p[0]), r1(p[1])]), latlon: kept.map((p) => { const ll = unproject(p[0], p[1]); return [r6(ll[0]), r6(ll[1])]; }) };
}
const polyArea = (ring) => Math.abs(G.signedArea(ring));
/** Minimum-area enclosing rectangle of a ring: { length, width, ux, uz (unit along the long side), cx, cz }. */
function minRect(ring) {
  let best = null;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], l = dist(a, b);
    if (l < 1e-6) continue;
    const ux = (b[0] - a[0]) / l, uz = (b[1] - a[1]) / l;
    let u0 = Infinity, u1 = -Infinity, w0 = Infinity, w1 = -Infinity;
    for (const p of ring) { const u = p[0] * ux + p[1] * uz, w = -p[0] * uz + p[1] * ux; u0 = Math.min(u0, u); u1 = Math.max(u1, u); w0 = Math.min(w0, w); w1 = Math.max(w1, w); }
    const area = (u1 - u0) * (w1 - w0);
    if (!best || area < best.area) best = { area, ux, uz, u0, u1, w0, w1 };
  }
  if (!best) return null;
  let { ux, uz, u0, u1, w0, w1 } = best;
  const cu = (u0 + u1) / 2, cw = (w0 + w1) / 2, cx = cu * ux - cw * uz, cz = cu * uz + cw * ux;
  let length = u1 - u0, width = w1 - w0;
  if (width > length) { [length, width] = [width, length]; [ux, uz] = [-uz, ux]; }
  return { length, width, ux, uz, cx, cz };
}
/** Orient an axis so that it points northwards (or east when exactly east–west). */
const northward = (ux, uz) => (uz < -1e-9 || (Math.abs(uz) <= 1e-9 && ux > 0) ? [ux, uz] : [-ux, -uz]);
const axisBearing = (ux, uz) => { const [a, b] = northward(ux, uz); return r1(bearingOf(a, b)); };
function segIntersect(p, q, r, s) {
  const ax = q[0] - p[0], az = q[1] - p[1], bx = s[0] - r[0], bz = s[1] - r[1], den = ax * bz - az * bx;
  if (Math.abs(den) < 1e-12) return null;
  const u = ((r[0] - p[0]) * bz - (r[1] - p[1]) * bx) / den, w = ((r[0] - p[0]) * az - (r[1] - p[1]) * ax) / den;
  return u >= 0 && u <= 1 && w >= 0 && w <= 1 ? [p[0] + ax * u, p[1] + az * u] : null;
}
/** Distance from a point to a ring's boundary, negative inside. */
function ringDist(p, ring) {
  let d2 = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) d2 = Math.min(d2, G.segDist2(p, ring[j], ring[i]));
  const d = Math.sqrt(d2);
  return G.pointInRing(p[0], p[1], ring) ? -d : d;
}
const lineDist = (p, pts) => { let d2 = Infinity; for (let i = 1; i < pts.length; i++) d2 = Math.min(d2, G.segDist2(p, pts[i - 1], pts[i])); return Math.sqrt(d2); };
/** Convex hull (monotone chain) of [x, z] points. */
function hull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.slice().reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
const overlapArea = (a, b) => Math.abs(C.areaOf(C.intersect([C.toPath(a)], [C.toPath(b)])));

/** Spatial grid of segments or boxes. */
class Grid {
  constructor(cell) { this.cell = cell; this.m = new Map(); }
  add(bb, item) {
    const c = this.cell;
    for (let gx = Math.floor(bb[0] / c); gx <= Math.floor(bb[2] / c); gx++) for (let gz = Math.floor(bb[1] / c); gz <= Math.floor(bb[3] / c); gz++) {
      const k = gx * 100003 + gz;
      (this.m.get(k) || this.m.set(k, []).get(k)).push(item);
    }
  }
  query(bb) {
    const c = this.cell, out = new Set();
    for (let gx = Math.floor(bb[0] / c); gx <= Math.floor(bb[2] / c); gx++) for (let gz = Math.floor(bb[1] / c); gz <= Math.floor(bb[3] / c); gz++) for (const it of this.m.get(gx * 100003 + gz) || []) out.add(it);
    return out;
  }
}

// ---------------------------------------------------------------- multipolygon relations → rings
/** Outer rings ([[x, z]…], open) of a multipolygon relation, merged from its member ways; and inner rings. */
function relRings(r) {
  const outer = [], inner = [];
  for (const m of r.members) if (m.type === 'way' && ways.has(m.ref)) (m.role === 'inner' ? inner : outer).push(ways.get(m.ref).refs);
  const toRings = (list) => G.mergeChains(list).closed.map((c) => G.openRing(c.map(xzOfNode).filter(Boolean))).filter((r) => r.length >= 3);
  return { outer: toRings(outer), inner: toRings(inner) };
}

// ---------------------------------------------------------------- tracks
const tracks = byKind('track').map((w) => ({ w, pts: wayXZ(w) })).filter((t) => t.pts.length > 1);
const metroTracks = byKind('metroTrack').map((w) => ({ w, pts: wayXZ(w), metro: true })).filter((t) => t.pts.length > 1);
const trackGrid = new Grid(50);
for (const t of [...tracks, ...metroTracks]) for (let i = 1; i < t.pts.length; i++) {
  const a = t.pts[i - 1], b = t.pts[i];
  trackGrid.add([Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])], [t, i]);
}
/** Track ways (non-metro unless asked) with a segment within r of point p: [{ t, d }] nearest first. */
function tracksNear(p, r, metroToo = false) {
  const best = new Map();
  for (const [t, i] of trackGrid.query([p[0] - r, p[1] - r, p[0] + r, p[1] + r])) {
    if (t.metro && !metroToo) continue;
    const d = Math.sqrt(G.segDist2(p, t.pts[i - 1], t.pts[i]));
    if (d <= r && !(best.get(t) <= d)) best.set(t, d);
  }
  return [...best].map(([t, d]) => ({ t, d })).sort((a, b) => a.d - b.d);
}
// Lines on each track way, from the route relations.
const SUB_LINE = { W: 'Western', C: 'Central', H: 'Harbour', T: 'Trans-Harbour', U: 'Nerul–Uran', MEMU: 'Vasai Road–Diva', VR: 'Vasai Road–Diva' };
const routeKind = (t) => SUBURBAN_NET.test(v(t, 'network')) ? 'suburban' : /pune suburban/i.test(v(t, 'network')) ? 'other-suburban' : (t.ref || t.name ? 'long-distance' : 'unknown');
const routeLabel = (t) => {
  if (routeKind(t) !== 'suburban') return routeKind(t) === 'long-distance' ? 'long-distance' : routeKind(t);
  const ref = t.ref || '?', speed = /fast/i.test(t.name || '') ? ' fast' : /slow/i.test(t.name || '') ? ' slow' : '';
  return `${ref}${speed}`;
};
const trackLines = new Map(); // way id → Set of labels ("W slow", "C fast", "H", "long-distance")
for (const r of trainRoutes) for (const m of r.members) if (m.type === 'way' && !/platform/.test(m.role)) (trackLines.get(m.ref) || trackLines.set(m.ref, new Set()).get(m.ref)).add(routeLabel(r.tags));
const linesOfTrack = (id) => [...(trackLines.get(id) || [])].sort();
const lineLetters = (labels) => new Set(labels.map((l) => l.split(' ')[0]));

// ---------------------------------------------------------------- stations
// 1. Station nodes and station ways (railway=station|halt / public_transport=station for trains).
const objs = [];
for (const [id, t] of nodeTags) if (isRailStation(t)) { const ll = coord.get(id); objs.push({ key: `node/${id}`, type: 'node', id, tags: t, ll, xz: project(ll[0], ll[1]) }); }
const areaPolys = []; // { key, tags, rings: { outer, inner }, area, kind: 'station' | 'landuse' }
for (const w of byKind('area')) {
  if (!closedWay(w)) continue;
  const ring = G.openRing(wayXZ(w));
  if (ring.length < 3) continue;
  areaPolys.push({ key: `way/${w.id}`, tags: w.tags, rings: { outer: [ring], inner: [] }, area: polyArea(ring), kind: w.tags.landuse === 'railway' && !isStationArea(w.tags) ? 'landuse' : 'station', missing: missingNodes(w) });
}
for (const r of mpRels) {
  if (!(isStationArea(r.tags) || r.tags.landuse === 'railway')) continue;
  const rings = relRings(r);
  if (!rings.outer.length) continue;
  areaPolys.push({ key: `relation/${r.id}`, tags: r.tags, rings, area: rings.outer.reduce((s, x) => s + polyArea(x), 0) - rings.inner.reduce((s, x) => s + polyArea(x), 0), kind: r.tags.landuse === 'railway' && !isStationArea(r.tags) ? 'landuse' : 'station' });
}
const inArea = (a, p) => a.rings.outer.some((o) => G.pointInRing(p[0], p[1], o)) && !a.rings.inner.some((h) => G.pointInRing(p[0], p[1], h));
const stations = [];
const stationByKey = new Map();
function newStation(primary, how) {
  const st = { primary, how, key: primary.key, names: primary.tags, xz: primary.xz, ll: primary.ll, stopAreas: [], routeStops: [], platforms: [], areas: [], fobs: [], buildings: [], nodes: [], links: {} };
  stations.push(st);
  stationByKey.set(primary.key, st);
  return st;
}
for (const o of objs.sort((a, b) => a.id - b.id)) if (inMarginLL(o.ll[0], o.ll[1])) newStation(o, 'osm: station node');
// Station area polygons: attach to a station node inside them or of the same name within 400 m; else they are stations of their own.
for (const a of areaPolys.filter((x) => x.kind === 'station')) {
  const c = G.centroid(a.rings.outer[0]);
  let best = null, bd = Infinity;
  for (const st of stations) {
    const d = dist(st.xz, c), inside = inArea(a, st.xz), same = a.tags.name && loose(a.tags.name) === loose(st.names.name);
    if ((inside || (same && d < 400)) && d < bd) { bd = d; best = st; }
  }
  if (best) { best.areas.push(a); best.links[a.key] = `inferred: ${inArea(a, best.xz) ? 'contains the station node' : `same name, ${Math.round(bd)} m`}`; continue; }
  const ll = unproject(c[0], c[1]);
  if (!inMarginLL(ll[0], ll[1])) continue;
  // Only an operational railway station area stands for a station of its own (not public_transport=station
  // alone: metro buildings, ferry wharfs, the high-speed rail site under construction).
  if (!((a.tags.railway === 'station' || a.tags.railway === 'halt') || a.tags.train === 'yes') || /construction|proposed/.test(`${v(a.tags, 'railway')} ${v(a.tags, 'construction')}`)) { a.unused = true; continue; }
  const st = newStation({ key: a.key, type: a.key.split('/')[0], id: Number(a.key.split('/')[1]), tags: a.tags, ll, xz: c }, 'osm: station area (no station node); position = centroid of its outline');
  st.areas.push(a);
  st.links[a.key] = 'osm: the station object itself';
}
// 2. Stop areas: tie their members to the station; suburban stop areas without a station object become stations.
const memberKey = (m) => `${m.type}/${m.ref}`;
const saOfMember = new Map();
for (const sa of stopAreas) {
  const nodes = sa.members.filter((m) => m.type === 'node' && coord.has(m.ref));
  const stMember = sa.members.map(memberKey).map((k) => stationByKey.get(k)).find(Boolean);
  const metroSA = isMetroTags(sa.tags) || sa.members.some((m) => m.type === 'node' && nodeTags.has(m.ref) && isMetroTags(nodeTags.get(m.ref)) && !isRailStation(nodeTags.get(m.ref)));
  let st = stMember;
  if (!st && !metroSA && nodes.length) {
    const c = nodes.map((m) => xzOfNode(m.ref)).reduce((s, p) => [s[0] + p[0] / nodes.length, s[1] + p[1] / nodes.length], [0, 0]);
    let bd = 800;
    for (const o of stations) { const d = dist(o.xz, c); if (sa.tags.name && loose(sa.tags.name) === loose(o.names.name) && d < bd) { bd = d; st = o; } }
    const trainy = sa.members.some((m) => m.type === 'node' && nodeTags.has(m.ref) && (nodeTags.get(m.ref).train === 'yes' || nodeTags.get(m.ref).railway === 'stop')) || SUBURBAN_NET.test(v(sa.tags, 'network'));
    if (!st && trainy) {
      const ll = unproject(c[0], c[1]);
      st = newStation({ key: `relation/${sa.id}`, type: 'relation', id: sa.id, tags: sa.tags, ll, xz: c, synthetic: true }, 'inferred: stop area relation without a station object; position = mean of its member nodes');
    }
  }
  if (!st) continue;
  st.stopAreas.push(sa);
  for (const m of sa.members) if (!saOfMember.has(memberKey(m))) saOfMember.set(memberKey(m), st);
}
const inBoxSt = (st) => inBoxLL(st.ll[0], st.ll[1]);
log(`stations: ${stations.length} in box + margin (${stations.filter(inBoxSt).length} inside the map box)`);

// 3. Route relations → which services stop at each station.
const stationsSameName = (name) => stations.filter((s) => loose(s.names.name) && loose(s.names.name) === loose(name));
for (const r of trainRoutes) {
  const kind = routeKind(r.tags), label = routeLabel(r.tags);
  const stopMembers = r.members.filter((m) => m.type === 'node' && (/stop/.test(m.role) || !m.role) && coord.has(m.ref));
  const first = r.members.find((m) => m.type === 'node' && (/stop/.test(m.role) || !m.role)), last = [...r.members].reverse().find((m) => m.type === 'node' && (/stop/.test(m.role) || !m.role));
  for (const m of stopMembers) {
    const p = xzOfNode(m.ref), t = nodeTags.get(m.ref) || {};
    let st = saOfMember.get(memberKey(m)), how = 'osm: stop area member';
    if (!st) {
      let bd = 800;
      for (const o of stationsSameName(t.name)) { const d = dist(o.xz, p); if (d < bd) { bd = d; st = o; how = `inferred: same name, ${Math.round(d)} m`; } }
    }
    if (!st) {
      let bd = 350;
      for (const o of stations) { const d = dist(o.xz, p); if (d < bd) { bd = d; st = o; how = `inferred: nearest station, ${Math.round(d)} m`; } }
    }
    if (!st) continue;
    st.routeStops.push({ rel: r.id, kind, label, name: r.tags.name || null, ref: r.tags.ref || null, node: m.ref, stopName: t.name || null, how, terminus: m.ref === first?.ref || m.ref === last?.ref });
  }
}

// ---------------------------------------------------------------- platforms
const platformsAll = [];
function platformFrom(key, tags, rings, line, members) {
  const o = { key, tags, rings, line, members };
  if (rings) {
    const outer = rings.outer;
    const all = outer.flat();
    o.area = outer.reduce((s, x) => s + polyArea(x), 0) - rings.inner.reduce((s, x) => s + polyArea(x), 0);
    o.rect = minRect(hull(all));
    // Length and width of the rectangle with the same area and perimeter: follows curved platforms
    // (the bounding rectangle of a curved platform is far too wide).
    const per = [...outer, ...rings.inner].reduce((s, r) => s + lenXZ([...r, r[0]]), 0), disc = per * per - 16 * o.area;
    o.eqWidth = disc >= 0 ? (per - Math.sqrt(disc)) / 4 : Math.sqrt(o.area);
    o.eqLength = o.area / (o.eqWidth || 1);
    o.centre = [o.rect.cx, o.rect.cz];
    o.pts = all;
  } else {
    o.length = lenXZ(line);
    const mr = minRect(line);
    o.rect = mr && { ...mr, width: 0, length: Math.max(mr.length, 0) };
    o.centre = mr ? [mr.cx, mr.cz] : line[0];
    o.pts = line;
  }
  return o;
}
for (const w of byKind('platform')) {
  if (missingNodes(w) === w.refs.length) continue;
  const pts = wayXZ(w);
  if (pts.length < 2) continue;
  if (closedWay(w) && w.tags.area !== 'no' && w.tags.railway !== 'platform_edge') platformsAll.push(platformFrom(`way/${w.id}`, w.tags, { outer: [G.openRing(pts)], inner: [] }, null));
  else platformsAll.push(platformFrom(`way/${w.id}`, w.tags, null, pts));
}
for (const r of mpRels) {
  if (!isPlatformTags(r.tags)) continue;
  const rings = relRings(r);
  if (rings.outer.length) platformsAll.push(platformFrom(`relation/${r.id}`, r.tags, rings, null, r.members.filter((m) => m.type === 'way').map((m) => m.ref)));
}
for (const [id, t] of nodeTags) if (isPlatformTags(t) && !isMetroTags(t)) { const p = xzOfNode(id); platformsAll.push({ key: `node/${id}`, tags: t, node: true, centre: p, pts: [p] }); }
// Keep the ones beside a main-line track (not metro, not bus).
const platforms = [];
for (const p of platformsAll) {
  const near = tracksNear(p.centre, (p.rect?.length || 0) / 2 + 20, true);
  let best = null;
  for (const { t } of near) {
    const d = p.rings ? Math.min(...t.pts.map((q) => Math.max(0, ringDist(q, p.rings.outer[0])))) : Math.min(...t.pts.map((q) => lineDist(q, p.pts)));
    // (vertices only: a quick test; the segment test below is exact)
    let dd = d;
    for (let i = 1; i < t.pts.length; i++) for (const q of p.pts) dd = Math.min(dd, Math.sqrt(G.segDist2(q, t.pts[i - 1], t.pts[i])));
    if (!best || dd < best.d) best = { t, d: dd };
  }
  if (!best || best.d > 12) continue;
  if (best.t.metro || isMetroTags(p.tags)) continue;
  p.nearestTrack = best;
  platforms.push(p);
}
log(`platforms: ${platformsAll.length} platform objects in box + margin, ${platforms.length} beside a main-line track`);

/** Tracks along a platform: samples every 2 m of each nearby track that lie beside the platform. */
function adjacentTracks(p) {
  const out = [];
  const R = p.rect;
  if (!R) return out;
  const ux = R.ux, uz = R.uz, nx = -uz, nz = ux, half = R.length / 2;
  const near = tracksNear(p.centre, half + 15);
  for (const { t } of near) {
    const samples = [];
    for (let i = 1; i < t.pts.length; i++) {
      const a = t.pts[i - 1], b = t.pts[i], L = dist(a, b), n = Math.max(1, Math.ceil(L / 2));
      for (let k = 0; k <= n; k++) {
        if (k === n && i < t.pts.length - 1) continue;
        const q = [a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n];
        const u = (q[0] - p.centre[0]) * ux + (q[1] - p.centre[1]) * uz, w = (q[0] - p.centre[0]) * nx + (q[1] - p.centre[1]) * nz;
        if (Math.abs(u) > half - 1) continue;
        const d = p.rings ? ringDist(q, p.rings.outer[0]) : lineDist(q, p.pts);
        if (d > (p.rings ? 4 : 6)) continue;
        samples.push({ u, w, d });
      }
    }
    if (samples.length < 3) continue;
    const span = Math.max(...samples.map((s) => s.u)) - Math.min(...samples.map((s) => s.u));
    if (span < Math.min(40, 0.3 * R.length)) continue;
    const ds = samples.map((s) => s.d).sort((a, b) => a - b), med = ds[Math.floor(ds.length / 2)];
    const wMean = samples.reduce((s, x) => s + x.w, 0) / samples.length;
    out.push({
      osm: `way/${t.w.id}`, side: compassOf(nx * Math.sign(wMean), nz * Math.sign(wMean)),
      edgeToCentreM: p.rings ? r2(med) : null, centreToLineM: p.rings ? null : r2(med),
      alongM: Math.round(span), lines: linesOfTrack(t.w.id), ...pick(t.w.tags, ['service', 'usage', 'name', 'ref', 'railway:track_ref']),
      insidePlatformSamples: samples.filter((s) => s.d < 0).length || undefined,
    });
  }
  return out.sort((a, b) => a.side.localeCompare(b.side));
}
for (const p of platforms) p.adjacent = p.node ? [] : adjacentTracks(p);

/** Platform numbers from ref / local_ref / name ("Platform 2,3", "PF No. 4"). */
function platformRefs(t) {
  const src = t.ref ? 'ref' : t.local_ref ? 'local_ref' : null;
  let s = t.ref || t.local_ref || '';
  if (!s) { const m = (t.name || '').match(/(?:platform|pf|plat)\.?\s*(?:no\.?|number)?\s*([0-9a-z][0-9a-z ,;/&+-]*)/i); if (m) { s = m[1]; } }
  const refs = s.split(/\s*(?:[;,/&+]|\band\b)\s*/).map((x) => x.trim()).filter(Boolean);
  // "1-3" → 1, 2, 3
  const out = [];
  for (const x of refs) { const m = x.match(/^(\d+)\s*-\s*(\d+)$/); if (m && +m[2] - +m[1] < 10) for (let i = +m[1]; i <= +m[2]; i++) out.push(String(i)); else out.push(x); }
  return { refs: out, refSource: src || (out.length ? 'name' : null) };
}

// Assign platforms to stations: stop area membership, else the nearest station (≤ 600 m) whose
// lines run on the platform's tracks, else the nearest station within 350 m.
for (const p of platforms) {
  let st = saOfMember.get(p.key), how = 'osm: stop area member';
  const lines = lineLetters(p.adjacent.flatMap((a) => a.lines));
  if (!st) {
    // A station named in the platform's name, note or description ("LTT platform 0").
    const text = ` ${loose(`${v(p.tags, 'name')} ${v(p.tags, 'note')} ${v(p.tags, 'description')}`)} `;
    let bd = 900;
    for (const o of stations) {
      const keys = [o.names.name, o.names.ref, o.names['short_name']].filter(Boolean).flatMap((n) => n.split(';')).map(loose).filter((k) => k.length >= 3);
      const d = dist(o.xz, p.centre);
      if (d < bd && keys.some((k) => text.includes(` ${k} `))) { bd = d; st = o; how = `inferred: the platform's name/note names the station, ${Math.round(d)} m`; }
    }
  }
  if (!st) {
    let bd = 600;
    for (const o of stations) {
      const d = dist(o.xz, p.centre);
      const oLines = lineLetters(o.routeStops.map((s) => s.label));
      if (d < bd && [...lines].some((l) => oLines.has(l))) { bd = d; st = o; how = `inferred: nearest station served by the platform's tracks (${[...lines].filter((l) => oLines.has(l)).join(', ')}), ${Math.round(d)} m`; }
    }
  }
  if (!st) {
    let bd = 350;
    for (const o of stations) { const d = dist(o.xz, p.centre); if (d < bd) { bd = d; st = o; how = `inferred: nearest station, ${Math.round(d)} m`; } }
  }
  p.station = st || null;
  if (st) { st.platforms.push(p); st.links[p.key] = how; }
}
// Per station: platform edges (railway=platform_edge, one per track side, ref = the platform number of
// that side) go to the platform outline they run along; duplicate outlines and platform nodes that
// repeat an outline are marked and left out of the counts.
for (const st of stations) {
  const outlines = st.platforms.filter((p) => p.rings);
  for (const e of st.platforms.filter((p) => p.tags.railway === 'platform_edge')) {
    let best = null, bd = 2.5;
    for (const p of outlines) { const d = e.pts.reduce((s, q) => s + Math.abs(ringDist(q, p.rings.outer[0])), 0) / e.pts.length; if (d < bd) { bd = d; best = p; } }
    if (best) { (best.edges ||= []).push(e); e.edgeOf = best; }
  }
  st.platforms = st.platforms.filter((p) => !p.edgeOf);
  const refsOf = (p) => platformRefs(p.tags).refs;
  const rank = (p) => (refsOf(p).length ? 0 : 4) + (p.tags.railway === 'platform' ? 0 : 2) + (p.key.startsWith('way/') ? 0 : 1);
  const areas = st.platforms.filter((p) => p.rings).sort((a, b) => rank(a) - rank(b));
  for (let i = 0; i < areas.length; i++) for (let k = 0; k < i; k++) {
    const a = areas[k], b = areas[i];
    if (a.duplicateOf || b.duplicateOf) continue;
    const o = overlapArea(a.rings.outer[0], b.rings.outer[0]);
    if (o >= 0.8 * Math.min(a.area, b.area)) {
      b.duplicateOf = a.key; b.dupShare = o / Math.min(a.area, b.area);
      if (b.edges) { (a.edges ||= []).push(...b.edges); b.edges = null; }
    }
  }
  for (const n of st.platforms.filter((p) => p.node)) {
    const twin = st.platforms.find((p) => !p.node && ((p.rings && G.pointInRing(n.centre[0], n.centre[1], p.rings.outer[0])) || (refsOf(n).length && refsOf(n).join() === refsOf(p).join())));
    if (twin) n.duplicateOf = twin.key;
  }
}

// ---------------------------------------------------------------- station frame (axis, span) and footprint
for (const st of stations) {
  let real = st.platforms.filter((p) => !p.node && p.rect && !p.duplicateOf);
  // Leave out platforms far longer than the others (Dadar's 922 m platform 5) so that the frame sits on the main group.
  const lens = real.map((p) => p.eqLength || p.length || 0).sort((a, b) => a - b), med = lens[Math.floor((lens.length - 1) / 2)];
  st.frameLeftOut = real.length >= 3 ? real.filter((p) => (p.eqLength || p.length) > 1.5 * med).map((p) => p.key) : [];
  if (st.frameLeftOut.length) real = real.filter((p) => !st.frameLeftOut.includes(p.key));
  let ux, uz;
  if (real.length) {
    const longest = real.reduce((a, b) => (b.rect.length > a.rect.length ? b : a));
    [ux, uz] = northward(longest.rect.ux, longest.rect.uz);
  } else {
    const t = tracksNear(st.xz, 120)[0];
    if (t) {
      let bi = 1, bd = Infinity;
      for (let i = 1; i < t.t.pts.length; i++) { const d = G.segDist2(st.xz, t.t.pts[i - 1], t.t.pts[i]); if (d < bd) { bd = d; bi = i; } }
      const a = t.t.pts[bi - 1], b = t.t.pts[bi], l = dist(a, b) || 1;
      [ux, uz] = northward((b[0] - a[0]) / l, (b[1] - a[1]) / l);
    } else [ux, uz] = [0, -1];
  }
  const nx = -uz, nz = ux; // +offset side: to the right of a northward axis (east-ish)
  const pts = real.flatMap((p) => p.pts);
  let c = st.xz, span = 0, lat = 0;
  if (pts.length) {
    const c0 = G.centroid(pts);
    const us = pts.map((q) => (q[0] - c0[0]) * ux + (q[1] - c0[1]) * uz), ws = pts.map((q) => (q[0] - c0[0]) * nx + (q[1] - c0[1]) * nz);
    const umid = (Math.min(...us) + Math.max(...us)) / 2, wmid = (Math.min(...ws) + Math.max(...ws)) / 2;
    c = [c0[0] + umid * ux + wmid * nx, c0[1] + umid * uz + wmid * nz];
    span = Math.max(...us) - Math.min(...us);
    lat = (Math.max(...ws) - Math.min(...ws)) / 2;
  }
  st.frame = { c, ux, uz, nx, nz, span, lat };
  // Footprint (inferred): convex hull of the platforms, station areas (not railway land) and the station node.
  const fp = [...pts, st.xz, ...st.areas.filter((a) => a.kind === 'station').flatMap((a) => a.rings.outer.flat())];
  st.footprint = fp.length >= 3 ? hull(fp) : null;
}
const toLocal = (st, p) => { const f = st.frame; return [(p[0] - f.c[0]) * f.ux + (p[1] - f.c[1]) * f.uz, (p[0] - f.c[0]) * f.nx + (p[1] - f.c[1]) * f.nz]; };
const toWorld = (st, u, w) => { const f = st.frame; return [f.c[0] + u * f.ux + w * f.nx, f.c[1] + u * f.uz + w * f.nz]; };
/** Distance from a point to a station's footprint (platform outlines and lines, station areas, station node). */
function footDist(st, p) {
  let d = dist(p, st.xz);
  for (const pl of st.platforms) d = Math.min(d, pl.rings ? Math.max(0, ringDist(p, pl.rings.outer[0])) : pl.node ? dist(p, pl.centre) : lineDist(p, pl.pts));
  for (const a of st.areas) if (a.kind === 'station') d = Math.min(d, inArea(a, p) ? 0 : Math.max(0, ringDist(p, a.rings.outer[0])));
  return d;
}

// ---------------------------------------------------------------- footbridges, skywalks, subways
const walkWays = byKind('walk').map((w) => ({ w, pts: wayXZ(w) })).filter((x) => x.pts.length > 1);
const groundWays = byKind('ground');
const nodeWalk = new Map(); // node → walk ways
for (const x of walkWays) for (const r of x.w.refs) (nodeWalk.get(r) || nodeWalk.set(r, []).get(r)).push(x);
const nodeGround = new Map();
for (const w of groundWays) for (const r of w.refs) (nodeGround.get(r) || nodeGround.set(r, []).get(r)).push(w);
const roadNodes = new Set(); // not stored: any node of a ground footway counts as "ground"
/** Rail track ways a polyline crosses (in plan): [{ way, at: [x, z] }]. */
function crossings(pts, metroToo = false) {
  const out = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    for (const [t, j] of trackGrid.query([Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])])) {
      if (t.metro && !metroToo) continue;
      const q = segIntersect(a, b, t.pts[j - 1], t.pts[j]);
      if (q && !out.some((o) => o.t === t && dist(o.at, q) < 1)) out.push({ t, at: q });
    }
  }
  return out;
}
// Components: bridge ways joined through shared nodes with other bridge ways and with steps / lifts.
const used = new Set();
const comps = [];
for (const x of walkWays) {
  if (used.has(x) || !(isBridge(x.w.tags) || isTunnel(x.w.tags))) continue;
  const tunnel = isTunnel(x.w.tags) && !isBridge(x.w.tags), side = x.w.tags.footway === 'sidewalk';
  const comp = [], todo = [x];
  used.add(x);
  while (todo.length) {
    const y = todo.pop();
    comp.push(y);
    for (const r of y.w.refs) for (const z of nodeWalk.get(r) || []) {
      if (used.has(z)) continue;
      const zt = z.w.tags, ok = tunnel ? isTunnel(zt) || zt.highway === 'steps' || zt.conveying || zt.highway === 'elevator' : isBridge(zt) || zt.highway === 'steps' || zt.conveying || zt.highway === 'elevator';
      // Sidewalks of road overbridges (footway=sidewalk) stay apart from footbridges.
      if (ok && !(tunnel ? isBridge(zt) : isTunnel(zt)) && (zt.highway === 'steps' || (zt.footway === 'sidewalk') === side)) { used.add(z); todo.push(z); }
    }
  }
  comps.push({ ways: comp, tunnel, sidewalk: side });
}
const bridgeAreas = byKind('bridgeArea').filter(closedWay).map((w) => ({ w, ring: G.openRing(wayXZ(w)) })).filter((b) => b.ring.length >= 3);
for (const r of mpRels) if (r.tags.man_made === 'bridge') { const rr = relRings(r); for (const o of rr.outer) bridgeAreas.push({ w: { id: r.id, tags: r.tags, rel: true }, ring: o }); }
const elevatorNodes = [...nodeTags].filter(([, t]) => t.highway === 'elevator').map(([id, t]) => ({ id, t, p: xzOfNode(id) }));
for (const c of comps) {
  const deck = c.ways.filter((x) => (c.tunnel ? isTunnel(x.w.tags) : isBridge(x.w.tags)) && x.w.tags.highway !== 'steps');
  c.crossed = deck.length ? crossings(deck.flatMap((x, i) => (i ? [null] : []).concat(x.pts)).filter(Boolean)) : [];
  c.crossed = [];
  for (const x of deck) for (const q of crossings(x.pts)) if (!c.crossed.some((o) => o.t === q.t)) c.crossed.push(q);
  c.deckLen = deck.reduce((s, x) => s + lenXZ(x.pts), 0);
  c.allPts = c.ways.flatMap((x) => x.pts);
  const named = c.ways.map((x) => x.w.tags.name).find(Boolean) || '';
  c.kind = c.sidewalk ? 'road-bridge sidewalk' : c.tunnel ? (c.crossed.length ? 'subway' : 'tunnel') : c.crossed.length ? 'footbridge' : /sky ?walk/i.test(named) || c.deckLen >= 100 ? 'skywalk' : 'other';
}
// Assign: a component that passes over, or lands on, platforms of a station belongs to it (to each
// such station: one footbridge can join two stations, as at Dadar). Otherwise footbridges and subways
// that cross tracks within 150 m of a station's platforms/area, skywalks within 300 m (or joined to a
// footbridge of the station); others only when they touch a platform.
/** Platforms of a station that a component's lines touch (a point inside, or an edge crossed). */
function contacts(st, c) {
  const hit = new Set();
  for (const pl of st.platforms) {
    if (pl.node) continue;
    for (const x of c.ways) {
      if (hit.has(pl)) break;
      if (pl.rings) {
        const ring = pl.rings.outer[0];
        if (x.pts.some((q) => G.pointInRing(q[0], q[1], ring))) { hit.add(pl); break; }
        for (let i = 1; i < x.pts.length && !hit.has(pl); i++) for (let k = 0, j = ring.length - 1; k < ring.length; j = k++) if (segIntersect(x.pts[i - 1], x.pts[i], ring[j], ring[k])) { hit.add(pl); break; }
      } else if (x.pts.some((q) => lineDist(q, pl.pts) < 3)) hit.add(pl);
    }
  }
  return hit.size;
}
for (const c of comps) {
  const c0 = c.allPts[0];
  const cands = stations.filter((st) => Math.abs(st.xz[0] - c0[0]) < 1500 && Math.abs(st.xz[1] - c0[1]) < 1500);
  const touch = cands.map((st) => ({ st, n: contacts(st, c) })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
  if (touch.length) {
    c.stations = touch.map((x) => x.st);
    c.station = touch[0].st;
    c.link = `inferred: passes over or lands on ${touch.map((x) => `${x.n} platform(s) of ${x.st.names.name}${x.st.names.ref ? ` (${x.st.names.ref})` : ''}`).join(' and ')}`;
    for (const x of touch) x.st.fobs.push(c);
    continue;
  }
  let best = null, bd = Infinity;
  const probe = c.crossed.length ? c.crossed.map((q) => q.at) : c.allPts;
  for (const st of cands) {
    let d = Infinity;
    for (const p of probe) d = Math.min(d, footDist(st, p));
    if (d < bd) { bd = d; best = st; }
  }
  c.nearest = best ? { st: best, d: bd } : null;
  const lim = c.kind === 'footbridge' || c.kind === 'subway' || c.kind === 'road-bridge sidewalk' ? 150 : c.kind === 'skywalk' ? 300 : 5;
  if (best && bd <= lim) { c.station = best; c.stations = [best]; c.link = `inferred: ${c.crossed.length ? 'track crossing' : 'nearest point'} ${Math.round(bd)} m from the station's platforms/area (touches none of its platforms)`; best.fobs.push(c); }
}
// Skywalks that join a footbridge assigned to a station follow it.
for (const c of comps) {
  if (c.station || c.kind !== 'skywalk') continue;
  const nodes = new Set(c.ways.flatMap((x) => x.w.refs));
  for (const o of comps) if (o.station && o !== c && o.ways.some((x) => x.w.refs.some((r) => nodes.has(r)))) { c.station = o.station; c.stations = [o.station]; c.link = 'inferred: joins a footbridge of the station'; o.station.fobs.push(c); break; }
}
log(`footbridges: ${comps.length} bridge/tunnel components; ${comps.filter((c) => c.station).length} assigned to stations (${['footbridge', 'skywalk', 'subway', 'tunnel', 'road-bridge sidewalk', 'other'].map((k) => `${comps.filter((c) => c.station && c.kind === k).length} ${k}`).join(', ')})`);

// ---------------------------------------------------------------- buildings and roofs
const buildings = [];
for (const w of byKind('building')) {
  if (!closedWay(w)) continue;
  const ring = G.openRing(wayXZ(w));
  if (ring.length >= 3) buildings.push({ key: `way/${w.id}`, tags: w.tags, rings: { outer: [ring], inner: [] }, missing: missingNodes(w), refs: new Set(w.refs) });
}
for (const r of mpRels) {
  if (!isBuildingTags(r.tags)) continue;
  const rings = relRings(r);
  if (rings.outer.length) buildings.push({ key: `relation/${r.id}`, tags: r.tags, rings, refs: new Set(r.members.filter((m) => m.type === 'way' && ways.has(m.ref)).flatMap((m) => ways.get(m.ref).refs)) });
}
const bGrid = new Grid(60);
for (const b of buildings) {
  b.area = b.rings.outer.reduce((s, x) => s + polyArea(x), 0) - b.rings.inner.reduce((s, x) => s + polyArea(x), 0);
  b.c = G.centroid(b.rings.outer[0]);
  b.bb = G.bboxOf(b.rings.outer.flat());
  bGrid.add(b.bb, b);
}
const isRoofTags = (t) => t.building === 'roof' || t['building:part'] === 'roof' || t.building === 'canopy';
const isStationBuildingTags = (t) => !(t.amenity === 'bus_station' || t.bus === 'yes' || isMetroTags(t)) && (/^(train_station|transportation|station)$/.test(v(t, 'building')) || t.railway === 'station' || t.public_transport === 'station')
  || /\b(station|booking|ticket|railway|rly|terminus|platform|rpf|grp|station ?master|reservation)\b/i.test(v(t, 'name'));
/** Metres of track centreline (non-metro) inside a ring. */
function trackInside(ring) {
  const bb = G.bboxOf(ring);
  let m = 0;
  const seen = new Set();
  for (const [t, i] of trackGrid.query(bb)) {
    if (t.metro || seen.has(`${t.w.id}:${i}`)) continue;
    seen.add(`${t.w.id}:${i}`);
    const a = t.pts[i - 1], b = t.pts[i], L = dist(a, b), n = Math.max(1, Math.ceil(L / 1));
    for (let k = 0; k < n; k++) { const q = [a[0] + ((b[0] - a[0]) * (k + 0.5)) / n, a[1] + ((b[1] - a[1]) * (k + 0.5)) / n]; if (G.pointInRing(q[0], q[1], ring)) m += L / n; }
  }
  return m;
}
for (const b of buildings) {
  // Candidates: near a station's footprint.
  let best = null, bd = Infinity;
  for (const st of stations) {
    if (Math.abs(st.frame.c[0] - b.c[0]) > 900 || Math.abs(st.frame.c[1] - b.c[1]) > 900) continue;
    const d = Math.min(footDist(st, b.c), ...b.rings.outer[0].map((q) => footDist(st, q)));
    if (d < bd) { bd = d; best = st; }
  }
  if (!best || bd > 150) continue;
  const st = best, t = b.tags, reasons = [];
  const over = [];
  for (const pl of st.platforms) {
    if (!pl.rings) continue;
    const o = overlapArea(b.rings.outer[0], pl.rings.outer[0]);
    if (o > 0.5) over.push({ platform: pl.key, refs: platformRefs(pl.tags).refs, overlapM2: Math.round(o), shareOfBuilding: r2(o / b.area) });
  }
  const share = over.reduce((s, o) => s + o.shareOfBuilding, 0);
  const inAreaSt = st.areas.filter((a) => a.kind === 'station').some((a) => inArea(a, b.c));
  const onTrackM = trackInside(b.rings.outer[0]);
  if (isRoofTags(t) && bd <= 40) reasons.push('roof tags');
  if (share >= 0.2) reasons.push('over a platform');
  if (isStationBuildingTags(t) && bd <= 150) reasons.push('station tags or name');
  if (inAreaSt) reasons.push('inside the station area');
  if (onTrackM >= 8 && bd <= 60) reasons.push('over the tracks');
  if (!reasons.length) continue;
  b.station = st;
  b.cls = isRoofTags(t) || (share >= 0.5 && !(isStationBuildingTags(t) && /train_station|transportation/.test(v(t, 'building')))) ? 'roof or platform structure' : isStationBuildingTags(t) ? 'station building' : onTrackM >= 8 ? 'over the tracks' : share >= 0.2 ? 'on a platform' : 'inside the station area';
  b.reasons = reasons; b.over = over; b.onTrackM = onTrackM; b.dist = bd;
  st.buildings.push(b);
}

// ---------------------------------------------------------------- entrances, lifts, tickets
const stationOutlineNodes = (st) => {
  const s = new Set();
  for (const b of st.buildings) for (const r of b.refs) s.add(r);
  for (const a of st.areas) if (a.key.startsWith('way/')) for (const r of ways.get(+a.key.slice(4))?.refs || []) s.add(r);
  for (const c of st.fobs) for (const x of c.ways) for (const r of x.w.refs) s.add(r);
  for (const p of st.platforms) if (p.key.startsWith('way/')) for (const r of ways.get(+p.key.slice(4))?.refs || []) s.add(r);
  return s;
};
const stNodeSets = new Map(stations.map((st) => [st, stationOutlineNodes(st)]));
for (const [id, t] of nodeTags) {
  const kind = t.railway === 'train_station_entrance' || t.entrance ? 'entrance' : t.highway === 'elevator' ? 'lift' : (t.shop === 'ticket' || /ticket/.test(v(t, 'vending')) || /ticket/.test(v(t, 'amenity')) || /booking|ticket|reservation/i.test(v(t, 'name'))) ? 'ticket' : t.barrier === 'turnstile' ? 'gate' : null;
  if (!kind) continue;
  if (t.railway === 'subway_entrance' || isMetroTags(t)) continue;
  const p = xzOfNode(id);
  let best = null, bd = Infinity, how = '';
  for (const st of stations) {
    if (Math.abs(st.xz[0] - p[0]) > 900 || Math.abs(st.xz[1] - p[1]) > 900) continue;
    if (stNodeSets.get(st).has(id)) { const d = footDist(st, p); if (d - 1000 < bd) { bd = d - 1000; best = st; how = 'osm: a vertex of the station\'s building, area, platform or footbridge'; } continue; }
    const d = footDist(st, p);
    if (d <= (kind === 'ticket' ? 60 : 25) && d < bd) { bd = d; best = st; how = `inferred: ${Math.round(d)} m from the station's platforms/area`; }
  }
  if (!best) continue;
  best.nodes.push({ id, t, p, kind, how });
}

// ---------------------------------------------------------------- the game's train stops (scripts/lib/trains.mjs on the same data)
function gameStops() {
  const routes = trainRoutes.filter((r) => isTrainRoute(r.tags));
  const wayRefs = new Map();
  for (const r of routes) for (const m of r.members) if (m.type === 'way' && ways.has(m.ref)) wayRefs.set(m.ref, ways.get(m.ref).refs);
  const stops = new Map();
  for (const r of routes) for (const m of r.members) if (m.type === 'node' && coord.has(m.ref)) { const p = xzOfNode(m.ref), t = nodeTags.get(m.ref); stops.set(m.ref, { x: p[0], z: p[1], name: t?.name || t?.['name:en'] || '' }); }
  const stationNodes = [];
  for (const [id, t] of nodeTags) if ((t.railway === 'station' || t.railway === 'halt') && t.name) { const p = xzOfNode(id); stationNodes.push([p[0], p[1], t.name]); }
  const resolveLine = (refs) => {
    const lines = [];
    let cur = [];
    for (const r of refs) { const p = xzOfNode(r); if (!p) { if (cur.length > 1) lines.push(cur); cur = []; continue; } cur.push(p); }
    if (cur.length > 1) lines.push(cur);
    return lines;
  };
  const plat = [];
  for (const w of byKind('platform')) if (w.tags.railway === 'platform' || (w.tags.public_transport === 'platform' && w.tags.train === 'yes')) plat.push(...resolveLine(w.refs));
  for (const r of mpRels) if (r.tags.railway === 'platform') for (const o of relRings(r).outer) plat.push([...o, o[0]]);
  const { lines } = buildTrainLines({ routes, wayRefs, stops, stationNodes, platforms: plat, resolveLine, box: BOXG, log: () => {} });
  const out = [];
  for (const L of lines) {
    const cum = [0];
    for (let i = 1; i < L.pts.length; i++) cum.push(cum[i - 1] + dist(L.pts[i], L.pts[i - 1]));
    for (const s of L.stations) {
      let i = 1;
      while (i < cum.length - 1 && cum[i] < s.d) i++;
      const a = L.pts[i - 1], b = L.pts[i], f = Math.max(0, Math.min(1, (s.d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1)));
      out.push({ line: L.id, name: s.name, x: a[0] + (b[0] - a[0]) * f, z: a[1] + (b[1] - a[1]) * f, side: s.side, off: s.off });
    }
  }
  return { lines, stops: out };
}
const game = gameStops();
log(`game (trains.mjs on this data): ${game.lines.length} lines, ${new Set(game.stops.map((s) => s.name)).size} station names, ${game.stops.length} stops`);

// ---------------------------------------------------------------- metro cross-reference
let metro = [];
try {
  metro = JSON.parse(fs.readFileSync(CFG.metro, 'utf8')).stations;
} catch { log(`no ${path.relative(root, CFG.metro)}: metro cross-reference skipped`); }

// ---------------------------------------------------------------- output per station
const issues = [];
const issue = (kind, subject, text) => issues.push({ kind, subject, text });
const xzOut = (p) => ({ x: r1(p[0]), z: r1(p[1]) });
const llOut = (p) => { const ll = unproject(p[0], p[1]); return { lat: r6(ll[0]), lon: r6(ll[1]) }; };
function clipToWindow(st, pts, margin = 40) {
  const f = st.frame, half = f.span / 2 + margin, H = Math.max(f.lat + 25, 40);
  const loc = pts.map((p) => toLocal(st, p));
  return clipPolyline(loc, [-half, -H, half, H]).map((part) => part.map(([u, w]) => toWorld(st, u, w)));
}
function crossSections(st) {
  const f = st.frame, H = Math.max(f.lat + 25, 40);
  const at = f.span >= 90 ? [-f.span / 3, 0, f.span / 3] : [0];
  const near = tracksNear(f.c, f.span / 2 + H + 20);
  const served = new Map();
  for (const p of st.platforms) if (!p.duplicateOf) for (const a of p.adjacent || []) (served.get(a.osm) || served.set(a.osm, []).get(a.osm)).push(platformRefs(p.tags).refs.join('/') || p.key);
  return at.map((s) => {
    const items = [];
    for (const { t } of near) {
      const loc = t.pts.map((p) => toLocal(st, p));
      for (let i = 1; i < loc.length; i++) {
        const [ua, wa] = loc[i - 1], [ub, wb] = loc[i];
        if ((ua - s) * (ub - s) > 0 || ua === ub) continue;
        const w = wa + ((s - ua) / (ub - ua)) * (wb - wa);
        if (Math.abs(w) > H || items.some((o) => o.track === `way/${t.w.id}` && Math.abs(o.offsetM - w) < 0.5)) continue;
        items.push({ type: 'track', track: `way/${t.w.id}`, offsetM: r1(w), lines: linesOfTrack(t.w.id), ...pick(t.w.tags, ['service', 'usage', 'railway:track_ref', 'bridge', 'layer']), servedBy: served.get(`way/${t.w.id}`) });
      }
    }
    for (const p of st.platforms) {
      if (!p.rings || p.duplicateOf) continue;
      const ws = [];
      for (const ring of p.rings.outer) {
        const loc = ring.map((q) => toLocal(st, q));
        for (let i = 0, j = loc.length - 1; i < loc.length; j = i++) {
          const [ua, wa] = loc[j], [ub, wb] = loc[i];
          if ((ua - s) * (ub - s) > 0 || ua === ub) continue;
          ws.push(wa + ((s - ua) / (ub - ua)) * (wb - wa));
        }
      }
      ws.sort((a, b) => a - b);
      for (let k = 0; k + 1 < ws.length; k += 2) items.push({ type: 'platform', platform: p.key, refs: platformRefs(p.tags).refs, fromM: r1(ws[k]), toM: r1(ws[k + 1]), widthM: r1(ws[k + 1] - ws[k]) });
    }
    for (const p of st.platforms) {
      if (p.rings || p.node || p.duplicateOf) continue;
      const loc = p.pts.map((q) => toLocal(st, q));
      for (let i = 1; i < loc.length; i++) {
        const [ua, wa] = loc[i - 1], [ub, wb] = loc[i];
        if ((ua - s) * (ub - s) > 0 || ua === ub) continue;
        items.push({ type: 'platform (line)', platform: p.key, refs: platformRefs(p.tags).refs, offsetM: r1(wa + ((s - ua) / (ub - ua)) * (wb - wa)) });
      }
    }
    items.sort((a, b) => (a.offsetM ?? a.fromM) - (b.offsetM ?? b.fromM));
    const centre = toWorld(st, s, 0);
    return { alongM: r1(s), centre: xzOut(centre), halfWidthM: r1(H), trackCount: items.filter((i) => i.type === 'track').length, items };
  });
}
const stationOut = [];
for (const st of stations.filter(inBoxSt).sort((a, b) => a.xz[1] - b.xz[1])) {
  const t = st.primary.synthetic ? st.stopAreas[0]?.tags || {} : st.primary.tags;
  const sa = st.stopAreas.find((x) => x.tags.name) || st.stopAreas[0];
  const names = pick(t, NAME_KEYS);
  if (!names.name && sa?.tags.name) names.name = sa.tags.name;
  if (!names['name:mr']) for (const x of [...st.stopAreas, ...st.areas]) if (x.tags['name:mr']) { names['name:mr'] = x.tags['name:mr']; names['name:mr (from)'] = `${x.id ? `relation/${x.id}` : x.key} (stop area or station area, not the station node)`; break; }
  const id = slug(`${names['name:en'] || names.name || st.key}-${t.ref || st.key.split('/')[1]}`);
  // Lines.
  const sub = {}, ld = new Map(), other = new Set();
  for (const s of st.routeStops) {
    if (s.kind === 'suburban') {
      const [ref, speed] = s.label.split(' ');
      sub[ref] ||= { line: SUB_LINE[ref] || ref, stops: [], relations: [] };
      if (speed && !sub[ref].stops.includes(speed)) sub[ref].stops.push(speed);
      if (!sub[ref].relations.includes(s.rel)) sub[ref].relations.push(s.rel);
    } else if (s.kind === 'long-distance') ld.set(s.rel, { rel: s.rel, ref: s.ref, name: s.name, terminus: s.terminus });
    else other.add(s.label);
  }
  const ldList = [...ld.values()];
  // Platforms.
  const pls = st.platforms.map((p) => {
    const pr = platformRefs(p.tags), o = { osm: p.key, link: st.links[p.key], ...pr, tags: pick(p.tags, PLATFORM_KEYS) };
    if (p.duplicateOf) o.duplicateOf = `inferred: ${p.node ? 'a platform node inside, or with the refs of,' : `${Math.round(p.dupShare * 100)} % of its area overlaps`} ${p.duplicateOf} (left out of the counts)`;
    if (p.node) return { ...o, geometry: 'node (position only)', centre: xzOut(p.centre), ...llOut(p.centre), tracks: [] };
    if (p.rings) {
      Object.assign(o, {
        geometry: p.rings.outer.length > 1 || p.rings.inner.length ? `area (multipolygon: ${p.rings.outer.length} outer, ${p.rings.inner.length} inner)` : 'area',
        lengthM: r1(p.eqLength), widthM: r1(p.eqWidth), boundingLengthM: r1(p.rect.length), boundingWidthM: r1(p.rect.width), areaM2: Math.round(p.area), bearingDeg: axisBearing(p.rect.ux, p.rect.uz),
        centre: xzOut(p.centre), ...llOut(p.centre),
        outline: p.rings.outer.map((r) => outLine(r, true)), holes: p.rings.inner.length ? p.rings.inner.map((r) => outLine(r, true)) : undefined,
      });
    } else {
      Object.assign(o, { geometry: p.tags.railway === 'platform_edge' ? 'line (platform edge only; no outline beside it)' : 'line (width not mapped)', lengthM: r1(p.length), widthM: parseLength(p.tags.width), bearingDeg: p.rect ? axisBearing(p.rect.ux, p.rect.uz) : null, centre: xzOut(p.centre), ...llOut(p.centre), line: outLine(p.pts) });
    }
    if (p.edges) o.edges = p.edges.map((e) => ({ osm: e.key, ref: e.tags.ref || null, ...pick(e.tags, ['height', 'tactile_paving', 'layer']), lengthM: r1(e.length), track: e.adjacent.map((a) => ({ osm: a.osm, centreToEdgeM: a.centreToLineM, lines: a.lines })), line: outLine(e.pts) }));
    o.tracks = p.adjacent;
    o.island = new Set(p.adjacent.map((a) => a.side)).size > 1 || undefined;
    return o;
  }).sort((a, b) => (parseInt(a.refs[0]) || 99) - (parseInt(b.refs[0]) || 99) || (a.centre?.x ?? 0) - (b.centre?.x ?? 0));
  // Tracks through the station: the clipped centrelines of tracks in the cross-sections or along the platforms.
  const xs = crossSections(st);
  const trackIds = new Set([...xs.flatMap((x) => x.items.filter((i) => i.type === 'track').map((i) => i.track)), ...pls.flatMap((p) => (p.tracks || []).map((a) => a.osm))]);
  const trk = [...trackIds].map((k) => {
    const t = tracks.find((x) => `way/${x.w.id}` === k);
    const parts = clipToWindow(st, t.pts).filter((pp) => pp.length > 1);
    return { osm: k, tags: pick(t.w.tags, TRACK_KEYS), lines: linesOfTrack(t.w.id), servesPlatforms: pls.filter((p) => (p.tracks || []).some((a) => a.osm === k)).map((p) => p.refs.join('/') || p.osm), centreline: parts.map((pp) => outLine(pp)) };
  }).filter((x) => x.centreline.length);
  // Footbridges etc.
  const fobs = st.fobs.map((c) => {
    const nodeCount = new Map();
    for (const x of c.ways) for (const r of x.w.refs) nodeCount.set(r, (nodeCount.get(r) || 0) + 1);
    const ends = [];
    for (const x of c.ways) for (const r of [x.w.refs[0], x.w.refs[x.w.refs.length - 1]]) {
      if (nodeCount.get(r) > 1 || ends.some((e) => e.node === r) || !coord.has(r)) continue;
      const p = xzOfNode(r), on = st.platforms.find((pl) => pl.rings && G.pointInRing(p[0], p[1], pl.rings.outer[0]));
      const ground = (nodeGround.get(r) || []).filter((w) => !c.ways.some((y) => y.w === w));
      ends.push({ node: r, ...xzOut(p), ...llOut(p), onPlatform: on ? (platformRefs(on.tags).refs.join('/') || on.key) : undefined, joinsGroundWays: ground.length || undefined, via: x.w.tags.highway === 'steps' ? (x.w.tags.conveying ? 'escalator' : 'steps') : x.w.tags.highway });
    }
    const widths = c.ways.map((x) => parseLength(x.w.tags.width) ?? parseLength(x.w.tags.est_width)).filter((w) => w != null);
    const deck = c.ways.filter((x) => x.w.tags.highway !== 'steps' && !x.w.tags.conveying);
    const lifts = elevatorNodes.filter((e) => c.allPts.some((q) => dist(q, e.p) < 5)).map((e) => ({ osm: `node/${e.id}`, ...xzOut(e.p), ...pick(e.t, ['name', 'level', 'wheelchair']) }));
    const outlines = bridgeAreas.filter((b) => deck.some((x) => x.pts.filter((q) => G.pointInRing(q[0], q[1], b.ring)).length >= 2)).map((b) => ({ osm: `${b.w.rel ? 'relation' : 'way'}/${b.w.id}`, ...pick(b.w.tags, ['name', 'man_made', 'layer', 'width']), areaM2: Math.round(polyArea(b.ring)), outline: outLine(b.ring, true) }));
    const name = c.ways.map((x) => x.w.tags.name).find(Boolean) || null;
    const others = (c.stations || []).filter((o) => o !== st);
    // Separate spans over the tracks: track crossings grouped by where they lie along the station (gaps > 10 m).
    const us = c.crossed.map((q) => ({ u: toLocal(st, q.at)[0], q })).sort((a, b) => a.u - b.u), spans = [];
    for (const x of us) { const last = spans[spans.length - 1]; if (last && x.u - last.u1 <= 10) { last.u1 = x.u; last.n++; } else spans.push({ u0: x.u, u1: x.u, n: 1 }); }
    return {
      kind: c.kind, name, link: c.link, sharedWith: others.length ? others.map((o) => `${o.names.name}${o.names.ref ? ` (${o.names.ref})` : ''}`) : undefined,
      touchesPlatforms: contacts(st, c),
      skywalkNamedWays: c.ways.filter((x) => /sky ?walk/i.test(v(x.w.tags, 'name'))).length || undefined,
      crossesTracks: c.crossed.length, spansOverTracks: spans.map((x) => ({ alongM: r1((x.u0 + x.u1) / 2), tracksCrossed: x.n })), crossedTracks: c.crossed.map((q) => ({ osm: `way/${q.t.w.id}`, ...xzOut(q.at), lines: linesOfTrack(q.t.w.id), service: q.t.w.tags.service })),
      deckLengthM: r1(c.deckLen), widthTaggedM: widths.length ? [...new Set(widths)] : null,
      widthM: widths.length ? Math.max(...widths) : DEFAULT_WIDTH[c.kind === 'tunnel' || c.kind === 'other' ? 'footbridge' : c.kind],
      widthSource: widths.length ? 'osm: width/est_width tag (largest)' : 'default: not mapped in OSM; script default',
      covered: [...new Set(c.ways.map((x) => x.w.tags.covered).filter(Boolean))],
      steps: c.ways.filter((x) => x.w.tags.highway === 'steps' && !x.w.tags.conveying).length, escalators: c.ways.filter((x) => x.w.tags.conveying).length, lifts,
      ends, outlines: outlines.length ? outlines : undefined,
      ways: c.ways.map((x) => ({ osm: `way/${x.w.id}`, tags: pick(x.w.tags, WALK_KEYS), lengthM: r1(lenXZ(x.pts)), line: outLine(x.pts) })),
    };
  }).sort((a, b) => b.crossesTracks - a.crossesTracks || b.deckLengthM - a.deckLengthM);
  // Buildings and roofs.
  const bl = st.buildings.map((b) => ({
    osm: b.key, class: b.cls, why: b.reasons.map((r) => `inferred: ${r}`), tags: pick(b.tags, BUILDING_KEYS), areaM2: Math.round(b.area),
    ...xzOut(b.c), overPlatforms: b.over.length ? b.over : undefined, overTrackM: b.onTrackM >= 1 ? Math.round(b.onTrackM) : undefined,
    outline: b.rings.outer.map((r) => outLine(r, true)), holes: b.rings.inner.length ? b.rings.inner.map((r) => outLine(r, true)) : undefined,
  })).sort((a, b) => a.class.localeCompare(b.class) || b.areaM2 - a.areaM2);
  // Station areas: station polygons, and railway land (landuse=railway) holding the station node or its platforms.
  const areas = st.areas.map((a) => ({ osm: a.key, kind: 'station area', link: st.links[a.key], tags: pick(a.tags, ['name', 'name:mr', 'railway', 'public_transport', 'landuse', 'operator', 'building']), areaM2: Math.round(a.area), outline: a.rings.outer.map((r) => outLine(r, true)), holes: a.rings.inner.length ? a.rings.inner.map((r) => outLine(r, true)) : undefined }));
  const probes = [st.xz, ...st.platforms.map((p) => p.centre)];
  for (const a of areaPolys.filter((x) => x.kind === 'landuse')) {
    if (!probes.some((p) => inArea(a, p))) continue;
    const big = a.area > 250000;
    let outline;
    if (big) {
      const f = st.frame, half = f.span / 2 + 150, H = Math.max(f.lat + 120, 150);
      const win = [toWorld(st, -half, -H), toWorld(st, half, -H), toWorld(st, half, H), toWorld(st, -half, H)];
      const parts = C.toPolygons(C.intersect(a.rings.outer.map((r) => C.toPath(r)), [C.toPath(win)]));
      outline = parts.map((pp) => outLine(pp[0], true));
    } else outline = a.rings.outer.map((r) => outLine(r, true));
    areas.push({ osm: a.key, kind: 'railway land (landuse=railway)', link: 'inferred: contains the station node or a platform', tags: pick(a.tags, ['name', 'landuse', 'operator']), areaM2: Math.round(a.area), outline, outlineNote: big ? `clipped to a window of ${Math.round(st.frame.span + 300)} m along the platforms (the polygon is larger)` : undefined });
  }
  // Points.
  const nodesOut = (kind) => st.nodes.filter((n) => n.kind === kind).map((n) => ({ osm: `node/${n.id}`, ...pick(n.t, NODE_KEYS), ...xzOut(n.p), ...llOut(n.p), link: n.how }));
  // Game stops (inferred: by name and distance).
  const gname = gameStationName(names.name);
  const gs = game.stops.filter((s) => s.name === gname && dist([s.x, s.z], st.frame.c) < 600).map((s) => ({ line: s.line, ...xzOut([s.x, s.z]), platformSide: s.side === -1 ? 'left of travel' : s.side === 1 ? 'right of travel' : s.side === 2 ? 'both' : 'not found (no platform edge within 4.9 m)', standOffM: r1(s.off) }));
  // Metro nearby.
  const mnear = metro.map((m) => ({ m, d: Math.min(dist([m.x, m.z], st.frame.c), dist([m.x, m.z], st.xz)) })).filter((x) => x.d < 700).sort((a, b) => a.d - b.d).map(({ m, d }) => ({ id: m.id, name: m.name || m.stopAreaName, lines: m.lines, lifecycle: m.lifecycle, level: m.level, distM: Math.round(d) }));
  const groupsOf = groups.filter((g) => g.members.some((m) => st.stopAreas.some((s) => s.id === m.ref))).map((g) => ({ osm: `relation/${g.id}`, name: g.tags.name || null, members: g.members.map(memberKey) }));
  // Detail and gaps.
  const real = pls.filter((p) => !p.duplicateOf);
  const area = real.filter((p) => p.geometry.startsWith('area')), lineP = real.filter((p) => p.geometry.startsWith('line')), noRef = real.filter((p) => !p.refs.length);
  const roofs = bl.filter((b) => b.class === 'roof or platform structure'), sbs = bl.filter((b) => b.class === 'station building');
  const fobN = fobs.filter((f) => f.kind === 'footbridge').length, spanN = fobs.filter((f) => f.kind === 'footbridge').reduce((s, f) => s + f.spansOverTracks.length, 0);
  const gaps = [];
  if (!real.length) gaps.push('no platforms mapped');
  const dups = pls.filter((p) => p.duplicateOf && !p.geometry.startsWith('node'));
  if (dups.length) gaps.push(`${dups.length} duplicate platform outline(s) (same platform mapped twice)`);
  if (lineP.length) gaps.push(`${lineP.length} platform(s) mapped as lines only (no outline, no width)`);
  if (noRef.length && real.length) gaps.push(`${noRef.length} of ${real.length} platform(s) without a number (ref/local_ref/name)`);
  const unserved = real.filter((p) => p.tracks && !p.tracks.length && !p.geometry.startsWith('node'));
  if (unserved.length) gaps.push(`${unserved.length} platform(s) with no track found along an edge`);
  if (!fobN) gaps.push('no foot overbridge crossing the tracks mapped');
  if (fobs.length && fobs.every((f) => f.widthSource.startsWith('default'))) gaps.push('no footbridge width tagged');
  if (!roofs.length) gaps.push('no platform roofs mapped');
  if (!sbs.length) gaps.push('no station building identified');
  if (!areas.some((a) => a.kind === 'station area')) gaps.push('no station area polygon (railway=station / public_transport=station)');
  if (!st.nodes.some((n) => n.kind === 'entrance')) gaps.push('no entrances mapped');
  if (!names['name:mr']) gaps.push('no Marathi name (name:mr)');
  if (!st.stopAreas.length) gaps.push('no stop_area relation');
  const refsSeen = real.flatMap((p) => p.refs).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (refsSeen.length) { const miss = []; for (let i = 1; i <= refsSeen[refsSeen.length - 1]; i++) if (!refsSeen.includes(i)) miss.push(i); if (miss.length) gaps.push(`platform numbers missing from the mapped refs: ${miss.join(', ')}`); }
  const score = Math.min(1, area.length / Math.max(1, real.length)) * 3 + (real.length ? 1 : 0) + (noRef.length === 0 && real.length ? 1 : 0) + (fobN ? 2 : 0) + (roofs.length ? 1 : 0) + (sbs.length ? 1 : 0) + (st.areas.some((a) => a.kind === 'station') ? 0.5 : 0) + (st.nodes.some((n) => n.kind === 'entrance') ? 0.5 : 0);
  // Data checks.
  for (const p of dups) issue('duplicate platform', p.osm, `${names.name}: ${p.duplicateOf.replace('inferred: ', '')}`);
  for (const p of real) for (const a of p.tracks || []) if (a.insidePlatformSamples) issue('track inside platform', p.osm, `${a.insidePlatformSamples} sample(s) of track ${a.osm} lie inside the platform outline (outline overlaps the track)`);
  for (const p of real) if (p.geometry.startsWith('area') && (p.widthM > 20 || p.widthM < 3)) issue('platform size', p.osm, `${names.name}: platform ${p.refs.join('/') || '(no ref)'} is ${p.widthM} m wide and ${p.lengthM} m long (equal-area rectangle)${!p.tracks.length ? ', with no track along it: a concourse or forecourt mapped as a platform?' : ''}`);
  for (const p of real) if (!p.geometry.startsWith('node') && !p.tracks.length && p.widthM <= 20) issue('platform without track', p.osm, `${names.name}: platform ${p.refs.join('/') || '(no ref)'} has no main-line track along an edge`);
  stationOut.push({
    id, osm: st.primary.synthetic ? null : st.key, link: st.how, ...names,
    ...pick(t, STATION_KEYS.filter((k) => !['railway', 'public_transport'].includes(k))),
    southMumbai: st.ll[0] < CFG.southMumbai,
    position: { ...xzOut(st.xz), lat: r6(st.ll[0]), lon: r6(st.ll[1]), source: st.primary.synthetic ? 'inferred' : `osm: ${st.primary.type}` },
    lines: { suburban: sub, longDistance: ldList.length ? { services: ldList.length, terminusOf: ldList.filter((x) => x.terminus).length, examples: ldList.slice(0, 6).map((x) => `${x.ref || ''} ${x.name || ''}`.trim()) } : null, other: other.size ? [...other] : undefined, source: 'osm: route relations whose stops are at this station (stop matched by stop area, name or distance: see routeStops)' },
    routeStops: st.routeStops.filter((s) => s.kind === 'suburban').map((s) => ({ rel: s.rel, label: s.label, node: s.node, link: s.how })),
    stopAreas: st.stopAreas.map((s) => ({ osm: `relation/${s.id}`, name: s.tags.name || null, ref: s.tags.ref || null, members: s.members.length, roles: [...new Set(s.members.map((m) => m.role || '(none)'))] })),
    stopAreaGroups: groupsOf.length ? groupsOf : undefined,
    frame: { centre: xzOut(st.frame.c), ...llOut(st.frame.c), axisBearingDeg: r1(bearingOf(st.frame.ux, st.frame.uz)), offsetsPositiveTowards: compassOf(st.frame.nx, st.frame.nz), platformSpanM: r1(st.frame.span), platformsLeftOut: st.frameLeftOut.length ? st.frameLeftOut : undefined, source: 'inferred: centre of the mapped platforms (else the station node), axis of the longest platform (else the nearest track); platforms over 1.5 × the median length are left out of the frame (platformsLeftOut)' },
    summary: {
      platforms: real.length, platformsAsAreas: area.length, platformsAsLines: lineP.length, platformNodes: real.length - area.length - lineP.length, duplicatesLeftOut: pls.length - real.length,
      platformEdges: real.reduce((s, p) => s + (p.edges?.length || 0), 0), platformRefs: [...new Set(real.flatMap((p) => p.refs))],
      longestPlatformM: area.length || lineP.length ? Math.max(...real.map((p) => p.lengthM || 0)) : null,
      platformWidthsM: area.map((p) => p.widthM),
      tracksInMiddleSection: xs[Math.floor(xs.length / 2)].trackCount, tracksAlongPlatforms: new Set(real.flatMap((p) => (p.tracks || []).map((a) => a.osm))).size,
      footbridges: fobN, footbridgeSpansOverTracks: spanN, roadBridgeSidewalks: fobs.filter((f) => f.kind === 'road-bridge sidewalk').length, skywalks: fobs.filter((f) => f.kind === 'skywalk').length, subways: fobs.filter((f) => f.kind === 'subway').length, otherBridges: fobs.filter((f) => f.kind === 'other' || f.kind === 'tunnel').length,
      roofs: roofs.length, stationBuildings: sbs.length, otherBuildings: bl.length - roofs.length - sbs.length,
      entrances: st.nodes.filter((n) => n.kind === 'entrance').length, lifts: st.nodes.filter((n) => n.kind === 'lift').length, ticketPoints: st.nodes.filter((n) => n.kind === 'ticket').length,
      stationArea: areas.some((a) => a.kind === 'station area'), detailScore: r1(score), detailScoreNote: 'inferred: 0–10 from platforms as areas (3), any platform (1), all numbered (1), footbridge (2), roof (1), station building (1), station area (0.5), entrance (0.5)',
    },
    gaps,
    platforms: pls,
    crossSections: xs,
    tracks: trk,
    footbridges: fobs,
    buildings: bl,
    stationAreas: areas,
    entrances: nodesOut('entrance'), lifts: nodesOut('lift'), tickets: nodesOut('ticket'), gates: nodesOut('gate'),
    game: { stops: gs, note: 'inferred: where scripts/lib/trains.mjs (the converter) puts the stopping train today, matched by name within 600 m' },
    metroNearby: mnear.length ? mnear : undefined,
  });
}
// Stations just outside the box (in the margin read around it).
const outside = stations.filter((st) => !inBoxSt(st)).map((st) => ({ osm: st.key, name: st.names.name || st.stopAreas[0]?.tags.name || null, 'name:mr': st.names['name:mr'] || null, ref: st.names.ref || null, ...xzOut(st.xz), lat: r6(st.ll[0]), lon: r6(st.ll[1]), platforms: st.platforms.length }));
// Platforms beside main-line tracks inside the box that no station took.
const unassigned = platforms.filter((p) => !p.station && inBoxLL(...unproject(p.centre[0], p.centre[1]))).map((p) => ({ osm: p.key, ...pick(p.tags, ['name', 'ref', 'railway', 'public_transport']), ...xzOut(p.centre), lengthM: p.rect ? r1(p.rect.length) : null }));
const fobsUnassigned = comps.filter((c) => !c.station && c.crossed.length && c.allPts.some((q) => inBoxLL(...unproject(q[0], q[1])))).map((c) => ({
  kind: c.kind, name: c.ways.map((x) => x.w.tags.name).find(Boolean) || null, crossesTracks: c.crossed.length, ...xzOut(c.crossed[0].at), ...llOut(c.crossed[0].at), deckLengthM: r1(c.deckLen),
  widthTaggedM: [...new Set(c.ways.map((x) => parseLength(x.w.tags.width)).filter((w) => w != null))], footway: [...new Set(c.ways.map((x) => x.w.tags.footway).filter(Boolean))],
  nearestStation: c.nearest ? `${c.nearest.st.names.name}${c.nearest.st.names.ref ? ` (${c.nearest.st.names.ref})` : ''}` : null, nearestStationM: c.nearest ? Math.round(c.nearest.d) : null,
  ways: c.ways.map((x) => `way/${x.w.id}`),
}));
const otherAreas = areaPolys.filter((a) => a.unused).map((a) => { const c = G.centroid(a.rings.outer[0]); return { osm: a.key, tags: pick(a.tags, ['name', 'name:mr', 'railway', 'public_transport', 'building', 'construction', 'amenity', 'operator']), ...xzOut(c), ...llOut(c), areaM2: Math.round(a.area), inBox: inBoxLL(...unproject(c[0], c[1])), why: 'public_transport=station area that is not an operational railway station (metro building, ferry wharf, construction) and lies by no station' }; });

// ---------------------------------------------------------------- write
const out = {
  meta: {
    title: 'Mumbai suburban railway stations and long-distance terminals in the game\'s map box, as mapped in OpenStreetMap',
    source: 'OpenStreetMap contributors, ODbL (https://www.openstreetmap.org/copyright). Map data © OpenStreetMap contributors.',
    extract: { file: path.relative(root, CFG.input), date: CFG.extractDate, from: 'extract.bbbike.org', box: CFG.extractBox },
    generated: new Date().toISOString().slice(0, 10), script: 'scripts/research/stations-from-osm.mjs',
    projection: {
      note: 'Same as scripts/build-tiles.mjs: flat (equirectangular) projection, metres per degree taken at the origin. x = east, z = SOUTH (north is −z); 1 unit = 1 m.',
      origin: { lat: lat0, lon: lon0 }, metresPerDegree: { lat: M_LAT, lon: M_LON },
      formula: 'x = (lon − 72.85) × metresPerDegree.lon;  z = −(lat − 19.03) × metresPerDegree.lat',
    },
    mapBox: { ...CFG.mapBox, note: 'the converter default --bbox (south, west, north, east); stations are listed when their station node lies inside' },
    southMumbai: `southMumbai = true for stations south of ${CFG.southMumbai} N`,
    geometry: `Outlines (outline/holes) and centrelines (line/centreline) hold the same points twice: xz (game metres, 0.1 m) and latlon. Simplified with Douglas–Peucker at ${CFG.tolerance} m, keeping original OSM vertices. Outlines are open rings (the first point is not repeated).`,
    fields: {
      'platforms[].lengthM / widthM': 'inferred: sides of the rectangle with the same area and perimeter as the outline (follows curved platforms); boundingLengthM / boundingWidthM: the smallest rectangle around the outline (too wide for curved platforms). For line platforms, lengthM is the line length and widthM the width tag (null when untagged).',
      'platforms[].tracks': 'inferred: track ways whose centreline runs beside the platform (within 4 m of an outline, 6 m of a line) for at least 40 m or 30 % of its length; side = compass side of the platform the track is on; edgeToCentreM = median distance from the platform edge to the track centre line (negative = the track centreline is inside the outline).',
      crossSections: 'inferred: lines across the station at right angles to its axis (alongM from the frame centre, northwards positive), with every track and platform they cut; offsetM / fromM / toM are metres from the axis, positive towards frame.offsetsPositiveTowards.',
      tracks: 'osm geometry, clipped (inferred window) to the platforms ± 40 m along the axis and ± (half the platform spread + 25 m) across it.',
      footbridges: 'osm: highway=footway/steps/path/pedestrian/corridor ways with bridge (or layer ≥ 1), joined through shared nodes with the steps, escalators (conveying) and lift ways attached to them (one entry = one connected network, which can hold several physical bridges: see spansOverTracks); kind = footbridge (crosses a main-line track), skywalk (does not cross a track; name says skywalk or deck ≥ 100 m), road-bridge sidewalk (footway=sidewalk: the pavement of a road overbridge, kept apart), subway (tunnel under the tracks), tunnel or other. Assignment to a station is inferred (link): the platforms it passes over or lands on, else distance; sharedWith = another station it also touches.',
      'footbridges[].spansOverTracks': 'inferred: the track crossings of the network grouped by position along the station axis (a gap over 10 m starts a new span) = physical bridges over the tracks; alongM as in crossSections.',
      'footbridges[].widthM': `width tag when mapped; otherwise a script default (${JSON.stringify(DEFAULT_WIDTH)} m), marked widthSource "default".`,
      buildings: 'osm outlines; class and why are inferred (roof tags, over a platform ≥ 20 % of its area, station tags or name, inside the station area polygon, ≥ 8 m of track centreline under it). "roof or platform structure" = building=roof/building:part=roof/canopy or mostly over a platform.',
      lines: 'osm: suburban route relations (network Mumbai Suburban Railway; W Western, C Central, H Harbour) and long-distance route relations that list a stop at the station; "fast"/"slow" from the relation names. A station missing here may still be served: the relations can be incomplete.',
      game: 'inferred: the stop that scripts/lib/trains.mjs computes for the game from the same data (the converter writes it to tiles/trains.json).',
      metroNearby: 'from docs/research/metro/osm-metro.json (same projection): metro and monorail stations (any lifecycle) within 700 m of the station node or the frame centre; distM is the smaller distance. Not duplicated here.',
    },
    defaults: { widthM: DEFAULT_WIDTH, note: 'script defaults, not OpenStreetMap data' },
    counts: {
      stationsInBox: stationOut.length, stationsSouthMumbai: stationOut.filter((s) => s.southMumbai).length,
      platforms: stationOut.reduce((s, x) => s + x.summary.platforms, 0), platformsAsAreas: stationOut.reduce((s, x) => s + x.summary.platformsAsAreas, 0),
      ...(() => {
        // Networks shared by two stations (listed under both) are counted once here.
        const seen = new Map();
        for (const st of stationOut) for (const f of st.footbridges) { const k = f.ways.map((w) => w.osm).sort().join(); if (!seen.has(k)) seen.set(k, f); }
        const all = [...seen.values()], fb = all.filter((f) => f.kind === 'footbridge');
        return {
          footbridges: fb.length, footbridgeSpansOverTracks: fb.reduce((s, f) => s + f.spansOverTracks.length, 0), footbridgesSharedByTwoStations: fb.filter((f) => f.sharedWith).length,
          footbridgesWithWidthTag: fb.filter((f) => f.widthTaggedM).length, footbridgesCovered: fb.filter((f) => f.covered.includes('yes')).length,
          skywalks: all.filter((f) => f.kind === 'skywalk').length, subways: all.filter((f) => f.kind === 'subway').length,
          stepsWays: all.reduce((s, f) => s + f.steps, 0), escalatorWays: all.reduce((s, f) => s + f.escalators, 0), liftNodes: new Set(all.flatMap((f) => f.lifts.map((l) => l.osm))).size,
        };
      })(),
      buildings: stationOut.reduce((s, x) => s + x.buildings.length, 0), roofs: stationOut.reduce((s, x) => s + x.summary.roofs, 0),
      entrances: stationOut.reduce((s, x) => s + x.entrances.length, 0), issues: issues.length,
    },
  },
  index: stationOut.map((s) => ({ id: s.id, name: s.name, 'name:mr': s['name:mr'] || null, ref: s.ref || null, x: s.position.x, z: s.position.z, lines: Object.keys(s.lines.suburban), longDistance: s.lines.longDistance?.services || 0, ...s.summary, gaps: s.gaps.length })),
  stations: stationOut,
  nearbyOutsideBox: outside,
  unassignedPlatforms: unassigned,
  unassignedFootbridges: fobsUnassigned,
  otherStationAreas: otherAreas,
  issues,
};
fs.mkdirSync(path.dirname(CFG.out), { recursive: true });
fs.writeFileSync(CFG.out, stringify(out) + '\n');
log(`wrote ${path.relative(root, CFG.out)}: ${(fs.statSync(CFG.out).size / 1e6).toFixed(2)} MB; ${stationOut.length} stations, ${out.meta.counts.platforms} platforms, ${out.meta.counts.footbridges} footbridges, ${out.meta.counts.buildings} buildings, ${issues.length} data issues`);

/** JSON with objects indented and arrays of numbers / number pairs on one line. */
function stringify(val, ind = '') {
  const flat = (a) => Array.isArray(a) && a.every((x) => typeof x !== 'object' || x === null || (Array.isArray(x) && x.every((y) => typeof y !== 'object' || y === null)));
  if (Array.isArray(val)) {
    if (!val.length) return '[]';
    if (flat(val)) return JSON.stringify(val);
    const i2 = ind + ' ';
    return `[\n${val.map((x) => i2 + stringify(x, i2)).join(',\n')}\n${ind}]`;
  }
  if (val && typeof val === 'object') {
    const ks = Object.keys(val).filter((k) => val[k] !== undefined);
    if (!ks.length) return '{}';
    const i2 = ind + ' ';
    return `{\n${ks.map((k) => `${i2}${JSON.stringify(k)}: ${stringify(val[k], i2)}`).join(',\n')}\n${ind}}`;
  }
  return JSON.stringify(val);
}
