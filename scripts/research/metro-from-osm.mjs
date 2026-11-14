#!/usr/bin/env node
/**
 * Research extract: Mumbai Metro, Navi Mumbai Metro and Mumbai Monorail as mapped in the local
 * OpenStreetMap extract → docs/research/metro/osm-metro.json (stations, entrances, platforms,
 * route polylines per direction, physical track groups, lengths, the game's map box, data issues).
 *
 *   node scripts/research/metro-from-osm.mjs
 *   node scripts/research/metro-from-osm.mjs --input data/raw/mumbai-region.osm.pbf --out docs/research/metro/osm-metro.json --tolerance 5
 *
 * Reads only; changes nothing else. Needs the npm packages of the repository (pbf, lineclip): `npm ci`.
 *
 * Game coordinates use the tile converter's projection (scripts/build-tiles.mjs, "projection"):
 * flat (equirectangular) metres around the fixed world origin Mahim 19.03 N, 72.85 E,
 * x = east, z = SOUTH (z grows southwards; north is −z), 1 unit = 1 metre.
 *
 * Everything in the output is what the OpenStreetMap data says, except fields whose name or
 * `source` value says "inferred" (links made by distance or name, levels taken from the track).
 * Map data © OpenStreetMap contributors, Open Database License (ODbL).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clipPolyline } from 'lineclip';
import { readOsmPbf } from '../lib/osm-pbf.mjs';
import * as G from '../lib/geometry.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean).map((s) => {
  const [k, ...v] = s.trim().split(/\s+/);
  return [k, v.join(' ')];
}));
const CFG = {
  input: path.resolve(root, args.input || 'data/raw/mumbai-region.osm.pbf'),
  out: path.resolve(root, args.out || 'docs/research/metro/osm-metro.json'),
  tolerance: Number(args.tolerance || 5),          // Douglas–Peucker tolerance for the polylines (m)
  extractDate: '2026-11-13',                       // extract.bbbike.org download date (CLAUDE.md)
  extractBox: { south: 18.52, west: 72.598, north: 19.5, east: 73.533 },
  mapBox: { south: 18.89, west: 72.795, north: 19.14, east: 72.92 }, // build-tiles.mjs default --bbox
  origin: [19.03, 72.85],                          // build-tiles.mjs default --origin (Mahim)
};
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

// ---------------------------------------------------------------- projection (copy of build-tiles.mjs)
const [lat0, lon0] = CFG.origin;
const rad = Math.PI / 180;
const M_LAT = 111132.92 - 559.82 * Math.cos(2 * lat0 * rad) + 1.175 * Math.cos(4 * lat0 * rad);
const M_LON = 111412.84 * Math.cos(lat0 * rad) - 93.5 * Math.cos(3 * lat0 * rad);
const project = (lat, lon) => [(lon - lon0) * M_LON, -(lat - lat0) * M_LAT];
const { south: S, west: W, north: N, east: E } = CFG.mapBox;
const BOX = [...project(N, W), ...project(S, E)]; // x0, z0 (north edge), x1, z1 (south edge)
const inBoxLL = (lat, lon) => lat >= S && lat <= N && lon >= W && lon <= E;
/** Great-circle distance (m), mean Earth radius. */
function hav(a, b) {
  const dl = (b[0] - a[0]) * rad, dn = (b[1] - a[1]) * rad;
  const h = Math.sin(dl / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dn / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.min(1, Math.sqrt(h)));
}
const r1 = (v) => Math.round(v * 10) / 10;
const r6 = (v) => Math.round(v * 1e6) / 1e6;
const km = (m) => Math.round(m) / 1000;
const xzOf = (ll) => project(ll[0], ll[1]).map(r1);
const lenLL = (pts) => { let s = 0; for (let i = 1; i < pts.length; i++) s += hav(pts[i - 1], pts[i]); return s; };
const lenXZ = (pts) => { let s = 0; for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return s; };
/** Metres of a lat/lon polyline inside the game's map box (projected; < 0.2 % error). */
const lenInBox = (pts) => clipPolyline(pts.map((p) => project(p[0], p[1])), BOX).reduce((s, part) => s + lenXZ(part), 0);

// ---------------------------------------------------------------- tag rules
const MT = /^(subway|light_rail|monorail)$/;
const v = (t, k) => t[k] || '';
const metroWords = (t) => /metro|monorail/i.test(`${v(t, 'network')} ${v(t, 'name')} ${v(t, 'name:en')} ${v(t, 'operator')}`);
const metroTagged = (t) => t.subway === 'yes' || t.monorail === 'yes' || t.light_rail === 'yes' || MT.test(v(t, 'station')) || MT.test(v(t, 'construction:station'));
const suburban = (t) => /suburban/i.test(v(t, 'network')) || (t.train === 'yes' && !metroTagged(t));
/** A metro/monorail track way (any lifecycle). */
function isTrack(t) {
  if (t.area === 'yes' || t.building || /platform|station/.test(v(t, 'public_transport') + v(t, 'railway') + v(t, 'construction'))) return false;
  if (MT.test(v(t, 'railway')) || MT.test(v(t, 'disused:railway'))) return true;
  if (t.railway === 'construction' || t.railway === 'proposed') {
    if (MT.test(v(t, 'construction')) || MT.test(v(t, 'construction:railway')) || MT.test(v(t, 'proposed')) || MT.test(v(t, 'proposed:railway'))) return true;
    return v(t, 'gauge') === '1435' && t.highspeed !== 'yes'; // standard gauge = metro here (main line is 1676 mm)
  }
  return MT.test(v(t, 'proposed:railway'));
}
/** Lifecycle of a track way as tagged: operational | construction | proposed | disused. */
function lifecycle(t) {
  if (t.railway === 'proposed' || t['proposed:railway']) return 'proposed';
  if (t.railway === 'construction' || t.construction === 'yes' || t['construction:railway']) return 'construction';
  if (t.railway === 'disused' || t['disused:railway'] || t.disused === 'yes') return 'disused';
  return 'operational';
}
/** elevated | underground | at-grade from bridge/tunnel/layer/location tags. */
function structure(t) {
  const layer = parseFloat(t.layer);
  if ((t.tunnel && t.tunnel !== 'no') || t.location === 'underground' || layer < 0) return 'underground';
  if ((t.bridge && t.bridge !== 'no') || layer > 0) return 'elevated';
  return 'at-grade';
}
/** Station-like object (node or way), any lifecycle. */
function isStationLike(t) {
  const rw = v(t, 'railway'), pt = v(t, 'public_transport'), c = v(t, 'construction');
  if (rw === 'station' || rw === 'halt' || pt === 'station') return true;
  if (t['construction:railway'] === 'station' || t['proposed:railway'] === 'station') return true;
  if ((rw === 'construction' || pt === 'construction' || t.building === 'construction') && /station/.test(c)) return true;
  if (rw === 'proposed' && /station/.test(v(t, 'proposed'))) return true;
  if ((t.building === 'train_station' || t.building === 'transportation') && (metroTagged(t) || metroWords(t))) return true;
  return false;
}
/** Stop-position-like node, any lifecycle. */
function isStopLike(t) {
  const rw = v(t, 'railway'), pt = v(t, 'public_transport'), c = v(t, 'construction');
  return pt === 'stop_position' || rw === 'stop' || (pt === 'construction' && /stop/.test(c)) || t['construction:railway'] === 'stop';
}
const isPlatformLike = (t) => /platform/.test(v(t, 'public_transport') + v(t, 'railway') + v(t, 'construction'));
const isEntrance = (t) => t.railway === 'subway_entrance' || (t.railway === 'train_station_entrance' && metroTagged(t));
function stationLifecycle(t) {
  if (t.railway === 'proposed' || t['proposed:railway']) return 'proposed';
  if (t.railway === 'construction' || t.public_transport === 'construction' || t.construction || t['construction:railway'] || t.building === 'construction') return 'construction';
  if (t.disused === 'yes' || t['disused:railway']) return 'disused';
  return 'operational';
}
const levelFromTags = (t) => {
  const layer = parseFloat(t.layer), lvl = parseFloat(t['building:min_level'] ?? t.level);
  if (t.location === 'underground' || layer < 0 || lvl < 0) return 'underground';
  if (layer > 0 || lvl > 0) return 'elevated';
  return null;
};
/** Route relation of the metro/monorail family (any lifecycle). */
function isMetroRoute(t) {
  if (t.type !== 'route') return false;
  if (['bus', 'road', 'trolleybus', 'share_taxi', 'ferry', 'bicycle', 'foot', 'hiking'].includes(t.route)) return false;
  if (MT.test(v(t, 'route')) || MT.test(v(t, 'disused:route')) || MT.test(v(t, 'construction')) || MT.test(v(t, 'proposed:route'))) return true;
  return metroWords(t) && !/suburban/i.test(v(t, 'network'));
}
const isMetroMaster = (t) => t.type === 'route_master' && (MT.test(v(t, 'route_master')) || (metroWords(t) && t.route_master !== 'bus'));
const pick = (t, keys) => { const o = {}; for (const k of keys) if (t[k] != null) o[k] = t[k]; return o; };
const NAME_KEYS = ['name', 'name:en', 'name:mr', 'name:hi', 'official_name', 'official_name:en', 'alt_name', 'old_name', 'short_name', 'ref'];
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/** Name keys for matching stops, stations and stop areas ("Kurla Terminal Station" ≈ "Kurla Terminal"). */
const strict = (s) => (s || '').toLowerCase().replace(/\b(metro|monorail)\s+(station|stn)\b|\bstation\b|\bstn\b|\bmetro\b/g, ' ').replace(/[^a-z0-9()[\]]+/g, ' ').replace(/\s+/g, ' ').trim();
const loose = (s) => strict(s).replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').replace(/\b(east|west|e|w|l1|l3|line \d+)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

// ---------------------------------------------------------------- pass 1: relations
log(`reading ${path.relative(root, CFG.input)}`);
const allRoutes = [];   // every route relation that is not obviously road transport (filtered after pass 2)
const masters = [], networks = [], stopAreas = [], polyRels = [];
readOsmPbf(CFG.input, {
  relation(id, tags, members) {
    const t = tags;
    if (t.type === 'route' && !['bus', 'road', 'trolleybus', 'share_taxi', 'ferry', 'bicycle', 'foot', 'hiking', 'mtb', 'power'].includes(t.route)) allRoutes.push({ id, tags, members });
    else if (t.type === 'route_master') masters.push({ id, tags, members });
    else if (t.type === 'network') networks.push({ id, tags, members });
    else if (t.type === 'public_transport' && /stop_area/.test(v(t, 'public_transport'))) stopAreas.push({ id, tags, members });
    else if (t.type === 'multipolygon' && (isPlatformLike(t) || isStationLike(t))) polyRels.push({ id, tags, members });
  },
});
const candRoutes = new Map(allRoutes.filter((r) => isMetroRoute(r.tags)).map((r) => [r.id, r]));
log(`pass 1: ${candRoutes.size} metro/monorail route relations by tags, ${stopAreas.length} stop areas, ${masters.length} route masters`);

// ---------------------------------------------------------------- pass 2: ways
const ways = new Map(); // id → { id, tags, refs }
const trackIds = new Set();
function readWays(wanted) {
  readOsmPbf(CFG.input, {
    way(id, tags, refs) {
      const track = isTrack(tags);
      if (track) trackIds.add(id);
      const keep = track || wanted.has(id) || ((isPlatformLike(tags) || isStationLike(tags)) && (metroTagged(tags) || metroWords(tags) || isStationLike(tags)));
      if (keep && !ways.has(id)) ways.set(id, { id, tags, refs });
    },
  });
}
const wantWays = new Set();
const addMembers = (r) => { for (const m of r.members) if (m.type === 'way') wantWays.add(m.ref); };
[...candRoutes.values(), ...stopAreas, ...polyRels].forEach(addMembers);
readWays(wantWays);
// Route relations not caught by their tags but running on metro track (e.g. a "Pink Line" with route=construction).
const extra = allRoutes.filter((r) => !candRoutes.has(r.id) && r.members.some((m) => m.type === 'way' && trackIds.has(m.ref))
  && r.members.filter((m) => m.type === 'way').every((m) => trackIds.has(m.ref) || !ways.has(m.ref) || isPlatformLike(ways.get(m.ref).tags)));
for (const r of extra) { candRoutes.set(r.id, r); r.byTrack = true; addMembers(r); }
if (extra.some((r) => r.members.some((m) => m.type === 'way' && !ways.has(m.ref)))) readWays(wantWays);
log(`pass 2: ${ways.size} ways kept, ${trackIds.size} metro/monorail track ways; ${extra.length} route relation(s) found by their track: ${extra.map((r) => r.id).join(', ') || '-'}`);

// ---------------------------------------------------------------- pass 3: nodes
const needNodes = new Set();
for (const w of ways.values()) for (const r of w.refs) needNodes.add(r);
const memberNodes = new Set();
for (const r of [...candRoutes.values(), ...stopAreas]) for (const m of r.members) if (m.type === 'node') { needNodes.add(m.ref); memberNodes.add(m.ref); }
const coord = new Map();     // node id → [lat, lon]
const nodeTags = new Map();  // node id → tags, for interesting nodes
const railStations = [];     // other (main-line / suburban) stations, for interchanges
readOsmPbf(CFG.input, {
  nodeTags: true,
  node(id, lat, lon, tags) {
    const t = tags || {};
    const interesting = memberNodes.has(id) || (tags && (isStationLike(t) || isStopLike(t) || isEntrance(t) || isPlatformLike(t)));
    if (needNodes.has(id) || interesting) coord.set(id, [lat, lon]);
    if (tags && interesting) nodeTags.set(id, t);
    if (tags && (t.railway === 'station' || t.railway === 'halt') && !metroTagged(t) && t.name && !/metro|monorail/i.test(t.name)) railStations.push({ id, name: t.name, lat, lon, network: t.network || null });
  },
});
log(`pass 3: ${coord.size} node positions, ${nodeTags.size} tagged nodes of interest, ${railStations.length} main-line stations`);

const wayLL = (w) => w.refs.map((r) => coord.get(r)).filter(Boolean);
const missingNodes = (w) => w.refs.filter((r) => !coord.has(r)).length;

// ---------------------------------------------------------------- track ways and their groups
// A group = one OSM `name` of track ways (unnamed ways take the name of the route relations they
// belong to, else of the named track they touch). Lifecycle, structure and service are per way.
const tracks = [...trackIds].map((id) => ways.get(id)).filter(Boolean);
const trackRoutesOf = new Map(); // way id → route relation ids
for (const r of candRoutes.values()) for (const m of r.members) if (m.type === 'way' && trackIds.has(m.ref)) (trackRoutesOf.get(m.ref) || trackRoutesOf.set(m.ref, []).get(m.ref)).push(r.id);
const groupOf = new Map();
const groupHow = new Map();
for (const w of tracks) if (w.tags.name) { groupOf.set(w.id, w.tags.name); groupHow.set(w.id, 'name'); }
const nodeWays = new Map();
for (const w of tracks) for (const r of [w.refs[0], w.refs[w.refs.length - 1], ...w.refs]) (nodeWays.get(r) || nodeWays.set(r, new Set()).get(r)).add(w.id);
for (const w of tracks) {
  if (groupOf.has(w.id)) continue;
  // Unnamed main track in a route relation: the most common group name among the relation's ways.
  if (!w.tags.service) for (const rid of trackRoutesOf.get(w.id) || []) {
    const names = candRoutes.get(rid).members.filter((m) => m.type === 'way' && groupOf.has(m.ref) && groupHow.get(m.ref) === 'name').map((m) => groupOf.get(m.ref));
    if (names.length) { groupOf.set(w.id, names.sort((a, b) => names.filter((x) => x === b).length - names.filter((x) => x === a).length)[0]); groupHow.set(w.id, 'inferred: route relation'); break; }
  }
}
for (let changed = true; changed;) { // the rest: from connected track ways
  changed = false;
  for (const w of tracks) {
    if (groupOf.has(w.id)) continue;
    const near = new Map();
    for (const r of w.refs) for (const o of nodeWays.get(r) || []) if (groupOf.has(o)) near.set(groupOf.get(o), (near.get(groupOf.get(o)) || 0) + 1);
    if (near.size) { groupOf.set(w.id, [...near].sort((a, b) => b[1] - a[1])[0][0]); groupHow.set(w.id, 'inferred: connected track'); changed = true; }
  }
}
const groups = new Map();
for (const w of tracks) {
  const g = groupOf.get(w.id) || '(unnamed, not connected to a named track)';
  (groups.get(g) || groups.set(g, []).get(g)).push(w);
}

/** Simplified polyline of lat/lon points: { latlon, xz } (original vertices kept by Douglas–Peucker in metres). */
function simplify(ll, tol = CFG.tolerance) {
  const pts = ll.map((p, i) => [...project(p[0], p[1]), i]);
  const kept = G.simplifyLine(pts, tol);
  return { latlon: kept.map((p) => [r6(ll[p[2]][0]), r6(ll[p[2]][1])]), xz: kept.map((p) => [r1(p[0]), r1(p[1])]) };
}
/** Lengths (km) of ways by a key function. */
function kmBy(list, key) {
  const o = {};
  for (const w of list) { const k = key(w); o[k] = (o[k] || 0) + lenLL(wayLL(w)); }
  for (const k in o) o[k] = km(o[k]);
  return o;
}

// ---------------------------------------------------------------- route relations → ordered polylines
/** Chain a relation's ways in member order (as public-transport validators do); gaps start new segments. */
function chainOrdered(wayIds) {
  const chains = [];
  let cur = null, gaps = 0;
  wayIds.forEach((id, i) => {
    let refs = ways.get(id).refs;
    const last = cur?.[cur.length - 1];
    if (cur && refs[0] === last) cur.push(...refs.slice(1));
    else if (cur && refs[refs.length - 1] === last) cur.push(...refs.slice(0, -1).reverse());
    else if (cur && cur.single && (refs[0] === cur[0] || refs[refs.length - 1] === cur[0])) {
      // The chain so far is one way that was the wrong way round.
      cur.reverse();
      if (refs[0] === cur[cur.length - 1]) cur.push(...refs.slice(1)); else cur.push(...refs.slice(0, -1).reverse());
      cur.single = false;
    } else {
      const nx = ways.get(wayIds[i + 1])?.refs;
      if (nx && (refs[0] === nx[0] || refs[0] === nx[nx.length - 1])) refs = refs.slice().reverse();
      if (cur) gaps++;
      chains.push(cur = [...refs]);
      cur.single = true;
      return;
    }
    cur.single = false;
  });
  return { chains, gaps };
}

/** Nearest point of a projected polyline to p: { d (m along), dist (m off) }. */
function locate(pts, cum, p) {
  let best = { d: 0, dist: Infinity };
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2));
    const dd = Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t);
    if (dd < best.dist) best = { d: cum[i - 1] + Math.sqrt(l2) * t, dist: dd };
  }
  return best;
}
const cumOf = (pts) => { const c = [0]; for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return c; };

// ---------------------------------------------------------------- stations
// Objects: station nodes and ways (any lifecycle) in metro context, stop positions, platforms, entrances.
const objs = new Map(); // "node/1" → { key, type, id, tags, ll, kind }
const keyOf = (type, id) => `${type}/${id}`;
const centroidLL = (w) => {
  const ll = wayLL(w);
  if (!ll.length) return null;
  const closed = w.refs.length > 3 && w.refs[0] === w.refs[w.refs.length - 1];
  if (closed) { const ring = G.openRing(ll.map((p) => project(p[0], p[1]))); const c = G.centroid(ring); return [lat0 - c[1] / M_LAT, lon0 + c[0] / M_LON]; }
  return [ll.reduce((s, p) => s + p[0], 0) / ll.length, ll.reduce((s, p) => s + p[1], 0) / ll.length];
};
// Spatial index of track ways (projected segments in 100 m cells) for "near a metro track" tests.
const CELL = 100, grid = new Map();
const trackXZ = new Map();
for (const w of tracks) {
  const pts = wayLL(w).map((p) => project(p[0], p[1]));
  trackXZ.set(w.id, pts);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    for (let gx = Math.floor(Math.min(a[0], b[0]) / CELL); gx <= Math.floor(Math.max(a[0], b[0]) / CELL); gx++)
      for (let gz = Math.floor(Math.min(a[1], b[1]) / CELL); gz <= Math.floor(Math.max(a[1], b[1]) / CELL); gz++) {
        const k = `${gx},${gz}`;
        (grid.get(k) || grid.set(k, []).get(k)).push([w.id, i]);
      }
  }
}
/** Track ways within r metres of a lat/lon point: [{ way, dist }] nearest first (one entry per way). */
function tracksNear(ll, r) {
  const [x, z] = project(ll[0], ll[1]), best = new Map();
  for (let gx = Math.floor((x - r) / CELL); gx <= Math.floor((x + r) / CELL); gx++)
    for (let gz = Math.floor((z - r) / CELL); gz <= Math.floor((z + r) / CELL); gz++)
      for (const [id, i] of grid.get(`${gx},${gz}`) || []) {
        const pts = trackXZ.get(id), d = Math.sqrt(G.segDist2([x, z], pts[i - 1], pts[i]));
        if (d <= r && !(best.get(id) <= d)) best.set(id, d);
      }
  return [...best].map(([id, dist]) => ({ way: ways.get(id), dist })).sort((a, b) => a.dist - b.dist);
}

const stopAreaOf = new Map(); // object key → stop area relation
const metroStopAreas = [];
const routeStopIds = new Set();
for (const r of candRoutes.values()) for (const m of r.members) if (m.type === 'node' && (/stop/.test(m.role) || !m.role)) routeStopIds.add(m.ref);
for (const n of nodeTags.keys()) {
  const t = nodeTags.get(n), ll = coord.get(n);
  let kind = null;
  if (isEntrance(t)) kind = 'entrance';
  else if (isStopLike(t)) kind = 'stop';
  else if (isStationLike(t)) kind = 'station';
  else if (isPlatformLike(t)) kind = 'platform';
  else if (routeStopIds.has(n)) kind = 'other';
  if (kind) objs.set(keyOf('node', n), { key: keyOf('node', n), type: 'node', id: n, tags: t, ll, kind });
}
for (const w of ways.values()) {
  if (trackIds.has(w.id)) continue;
  const t = w.tags;
  const kind = isPlatformLike(t) ? 'platform' : isStationLike(t) ? 'station' : null;
  if (!kind) continue;
  objs.set(keyOf('way', w.id), { key: keyOf('way', w.id), type: 'way', id: w.id, tags: t, ll: centroidLL(w), kind, way: w });
}
for (const r of polyRels) { // multipolygon platforms/stations: centroid of the outer ways' nodes
  const pts = r.members.filter((m) => m.type === 'way' && m.role !== 'inner' && ways.has(m.ref)).flatMap((m) => wayLL(ways.get(m.ref)));
  if (!pts.length) continue;
  const ll = [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
  objs.set(keyOf('relation', r.id), { key: keyOf('relation', r.id), type: 'relation', id: r.id, tags: r.tags, ll, kind: isPlatformLike(r.tags) ? 'platform' : 'station' });
}
const memberKey = (m) => keyOf(m.type, m.ref);
for (const sa of stopAreas) {
  const mem = sa.members.map(memberKey).filter((k) => objs.has(k));
  const metro = mem.some((k) => { const o = objs.get(k); return metroTagged(o.tags) || metroWords(o.tags) || (o.type === 'node' && routeStopIds.has(o.id)); }) || metroWords(sa.tags);
  const suburbanOnly = /suburban/i.test(v(sa.tags, 'network')) || mem.some((k) => suburban(objs.get(k).tags) && objs.get(k).kind === 'station');
  if (!metro || suburbanOnly) continue;
  metroStopAreas.push(sa);
  for (const k of mem) if (!stopAreaOf.has(k)) stopAreaOf.set(k, sa);
}

/** Is an object in metro context? (stop area, route membership, tags, or — under construction / proposed only — within 200 m of a metro track). */
function metroContext(o) {
  if (stopAreaOf.has(o.key) || (o.type === 'node' && routeStopIds.has(o.id))) return true;
  if (suburban(o.tags)) return false;
  if (metroTagged(o.tags) || metroWords(o.tags)) return true;
  if (o.kind === 'entrance') return true; // railway=subway_entrance is only used for the metro here
  // Untagged objects count only when under construction or proposed and close to a metro track
  // (an operational station, stop or platform must say it is metro: suburban ones stand under the viaducts).
  if (stationLifecycle(o.tags) === 'operational') return false;
  return !!o.ll && tracksNear(o.ll, o.kind === 'platform' ? 15 : 200).length > 0;
}
const metroObjs = [...objs.values()].filter((o) => o.ll && metroContext(o));

// Station records. Each OSM station object becomes one station, except that station buildings
// (ways) attach to a station node of the same place; stop areas tie their members together.
const stations = [];
const stationOf = new Map(); // object key → station
function newStation(primary, how) {
  const st = { primary, how, members: new Set([primary.key]), buildings: [], stops: [], platforms: [], entrances: [], stopArea: null, links: {} };
  stations.push(st);
  stationOf.set(primary.key, st);
  return st;
}
const attach = (st, o, list, how) => { if (stationOf.has(o.key)) return; stationOf.set(o.key, st); st.members.add(o.key); st[list].push(o); st.links[o.key] = how; };
const rankStation = (o) => (o.type === 'node' ? 0 : 1) + (metroTagged(o.tags) ? 0 : 0.5) + (o.tags.name ? 0 : 2);
// 1. Stop areas.
for (const sa of metroStopAreas) {
  const mem = sa.members.map(memberKey).filter((k) => objs.has(k)).map((k) => objs.get(k));
  const sts = mem.filter((o) => o.kind === 'station').sort((a, b) => rankStation(a) - rankStation(b));
  let st;
  if (sts.length) { st = stationOf.get(sts[0].key) || newStation(sts[0], 'osm: station object'); for (const o of sts.slice(1)) attach(st, o, 'buildings', 'osm: same stop area'); }
  else {
    const anchor = mem.find((o) => o.kind === 'stop') || mem[0];
    if (!anchor) continue;
    st = newStation({ ...anchor, key: `synthetic:${anchor.key}`, synthetic: true }, 'inferred: stop area without a station object (position = mean of its stop positions)');
  }
  st.stopArea = sa;
  for (const o of mem) {
    if (o.kind === 'stop' || o.kind === 'other') attach(st, o, 'stops', 'osm: same stop area');
    else if (o.kind === 'platform') attach(st, o, 'platforms', 'osm: same stop area');
    else if (o.kind === 'entrance') attach(st, o, 'entrances', 'osm: same stop area');
  }
}
// 2. Station nodes, then station ways that match none of them.
const freeStations = metroObjs.filter((o) => o.kind === 'station' && !stationOf.has(o.key)).sort((a, b) => rankStation(a) - rankStation(b));
for (const o of freeStations) {
  if (stationOf.has(o.key)) continue;
  if (o.type !== 'node') {
    // A station building/area: belongs to a station of the same name within 300 m, or an unnamed one to the nearest within 150 m.
    let best = null, bd = Infinity;
    for (const st of stations) {
      const d = hav(o.ll, st.primary.ll), same = o.tags.name && (strict(o.tags.name) === strict(st.primary.tags.name) || loose(o.tags.name) === loose(st.primary.tags.name));
      if ((same && d < 300) || (!o.tags.name && d < 150)) if (d < bd) { bd = d; best = st; }
    }
    if (best) { attach(best, o, 'buildings', `inferred: ${o.tags.name ? 'same name' : 'unnamed'} within ${Math.round(bd)} m`); continue; }
  }
  newStation(o, `osm: station ${o.type}`);
}
// 3. Stop positions: same name nearby, else nearest station within 150 m, else stations made from stops.
const stopObjs = metroObjs.filter((o) => (o.kind === 'stop' || ((o.kind === 'other' || (o.kind === 'platform' && o.type === 'node')) && routeStopIds.has(o.id))) && !stationOf.has(o.key));
for (const o of stopObjs) {
  let best = null, bd = Infinity, how = '';
  for (const st of stations) {
    if (st.primary.synthetic) continue;
    const d = hav(o.ll, st.primary.ll);
    const nm = [st.primary.tags.name, st.stopArea?.tags.name, ...st.buildings.map((b) => b.tags.name)].filter(Boolean);
    const sameStrict = nm.some((n) => strict(n) === strict(o.tags.name)), sameLoose = nm.some((n) => loose(n) && loose(n) === loose(o.tags.name));
    const score = d - (sameStrict ? 1000 : sameLoose ? 500 : 0);
    if (((sameStrict || sameLoose) && d < 400) || d < 150) if (score < bd) { bd = score; best = st; how = sameStrict || sameLoose ? `inferred: same name, ${Math.round(d)} m` : `inferred: nearest station, ${Math.round(d)} m`; }
  }
  if (best) attach(best, o, 'stops', how);
}
for (const o of stopObjs) {
  if (stationOf.has(o.key)) continue;
  const st = newStation({ ...o, key: `synthetic:${o.key}`, synthetic: true }, 'inferred: no station object; position = mean of the stop positions of the same name within 400 m');
  attach(st, o, 'stops', 'inferred: stop of this place');
  for (const p of stopObjs) if (!stationOf.has(p.key) && loose(p.tags.name) && loose(p.tags.name) === loose(o.tags.name) && hav(p.ll, o.ll) < 400) attach(st, p, 'stops', 'inferred: same name');
}
// 4. Platforms and entrances not in a stop area: nearest station.
const nearestStation = (ll, maxD, filter = () => true) => {
  let best = null, bd = maxD;
  for (const st of stations) { if (!filter(st)) continue; const d = hav(ll, posOf(st)); if (d < bd) { bd = d; best = st; } }
  return best ? { st: best, d: bd } : null;
};
function posOf(st) {
  if (!st.primary.synthetic) return st.primary.ll;
  const ll = st.stops.map((s) => s.ll);
  return ll.length ? [ll.reduce((s, p) => s + p[0], 0) / ll.length, ll.reduce((s, p) => s + p[1], 0) / ll.length] : st.primary.ll;
}
for (const o of metroObjs) {
  if (stationOf.has(o.key)) continue;
  if (o.kind === 'platform' && (metroTagged(o.tags) || metroWords(o.tags) || tracksNear(o.ll, 15).length)) {
    const n = nearestStation(o.ll, 250);
    if (n) attach(n.st, o, 'platforms', `inferred: nearest station, ${Math.round(n.d)} m`);
  } else if (o.kind === 'entrance') {
    const n = nearestStation(o.ll, 350, (st) => stationLifecycle(st.primary.tags) === 'operational');
    if (n) attach(n.st, o, 'entrances', `inferred: nearest operational station, ${Math.round(n.d)} m`);
  }
}
log(`stations: ${stations.length} (from ${metroStopAreas.length} stop areas, ${freeStations.length} free station objects, ${stopObjs.length} free stop positions)`);

// ---------------------------------------------------------------- routes
const routes = [];
const issues = [];
const issue = (kind, subject, text) => issues.push({ kind, subject, text });
for (const r of [...candRoutes.values()].sort((a, b) => a.id - b.id)) {
  const t = r.tags;
  const wayMembers = r.members.filter((m) => m.type === 'way');
  const trackMembers = wayMembers.filter((m) => trackIds.has(m.ref) && !/platform/.test(m.role));
  const strays = wayMembers.filter((m) => !trackIds.has(m.ref) && !(ways.has(m.ref) && isPlatformLike(ways.get(m.ref).tags)));
  for (const m of strays) issue('relation member', `relation/${r.id}`, `way/${m.ref} (role "${m.role}") is not a metro track or platform${ways.has(m.ref) ? `: ${JSON.stringify(pick(ways.get(m.ref).tags, ['name', 'railway', 'highway', 'building', 'amenity', 'healthcare']))}` : ''}`);
  const missWays = trackMembers.filter((m) => !ways.has(m.ref));
  if (missWays.length) issue('relation member', `relation/${r.id}`, `${missWays.length} track way(s) not in the extract`);
  const ids = trackMembers.map((m) => m.ref).filter((id) => ways.has(id));
  const { chains, gaps } = ids.length ? chainOrdered(ids) : { chains: [], gaps: 0 };
  let segs = chains, how = 'member order';
  if (gaps) { const merged = G.mergeChains(ids.map((id) => ways.get(id).refs)); const alt = [...merged.open, ...merged.closed]; if (alt.length < chains.length) { segs = alt; how = 'merged by shared nodes (member order has gaps)'; } }
  const segLL = segs.map((c) => c.map((n) => coord.get(n)).filter(Boolean)).filter((p) => p.length > 1).sort((a, b) => lenLL(b) - lenLL(a));
  // Stops in member order.
  const stopMembers = r.members.filter((m) => m.type === 'node' && (/stop/.test(m.role) || (!m.role && objs.has(keyOf('node', m.ref)))));
  const segXZ = segLL.map((p) => p.map((q) => project(q[0], q[1]))), segCum = segXZ.map(cumOf);
  const stops = [];
  for (const m of stopMembers) {
    const ll = coord.get(m.ref), o = objs.get(keyOf('node', m.ref)), st = stationOf.get(keyOf('node', m.ref));
    if (!ll) { issue('relation member', `relation/${r.id}`, `stop node/${m.ref} is not in the extract (deleted or outside it)`); stops.push({ node: m.ref, role: m.role, missing: true }); continue; }
    let at = null;
    segXZ.forEach((pts, si) => { const a = locate(pts, segCum[si], project(ll[0], ll[1])); if (!at || a.dist < at.dist) at = { ...a, seg: si }; });
    stops.push({
      node: m.ref, role: m.role || null, name: o?.tags.name || null, station: st ? stationId(st) : null,
      lat: r6(ll[0]), lon: r6(ll[1]), x: r1(project(ll[0], ll[1])[0]), z: r1(project(ll[0], ll[1])[1]), inBox: inBoxLL(ll[0], ll[1]),
      seg: at ? at.seg : null, chainage: at ? Math.round(at.d) : null, offTrack: at ? r1(at.dist) : null,
    });
    if (at && at.dist > 30) issue('stop off track', `relation/${r.id}`, `stop node/${m.ref} "${o?.tags.name || ''}" is ${Math.round(at.dist)} m from the route's track`);
  }
  const main = segLL[0] || [];
  const total = segLL.reduce((s, p) => s + lenLL(p), 0);
  const firstLast = stops.filter((s) => s.chainage != null && s.seg === 0);
  const wayStatus = kmBy(ids.map((id) => ways.get(id)), (w) => lifecycle(w.tags));
  const wayStructure = kmBy(ids.map((id) => ways.get(id)), (w) => structure(w.tags));
  let status = t.route === 'construction' || /u\/c/i.test(v(t, 'name')) ? 'construction' : !t.route && t['disused:route'] ? 'disused' : null;
  if (!status) status = Object.entries(wayStatus).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';
  if (gaps) issue('route gaps', `relation/${r.id}`, `${gaps} gap(s) between consecutive member ways (${segLL.length} piece(s) after merging)`);
  routes.push({
    id: r.id,
    tags: pick(t, ['name', 'ref', 'route', 'disused:route', 'construction', 'network', 'operator', 'colour', 'from', 'to', 'via', 'disused', 'note', 'opening_hours', 'interval', 'duration', 'name:mr', 'wikidata', 'public_transport:version']),
    foundBy: r.byTrack ? 'inferred: member ways are metro track (tags do not say metro)' : 'tags',
    statusFromTags: status, wayKmByLifecycle: wayStatus, wayKmByStructure: wayStructure,
    ways: ids, chaining: how, gaps, pieces: segLL.length,
    lengthKm: km(total), mainPieceKm: km(lenLL(main)), inBoxKm: km(segLL.reduce((s, p) => s + lenInBox(p), 0)),
    firstToLastStopKm: firstLast.length > 1 ? km(Math.abs(firstLast[firstLast.length - 1].chainage - firstLast[0].chainage)) : null,
    stopCount: stops.length, stops,
    polylines: segLL.map((p) => ({ lengthKm: km(lenLL(p)), ...simplify(p) })),
  });
}
function stationId(st) { return st.primary.synthetic ? `stops:${st.stops.map((s) => s.id).sort((a, b) => a - b)[0]}` : st.primary.key; }

// Route masters and lines.
const routeById = new Map(routes.map((r) => [r.id, r]));
const metroMasters = masters.filter((m) => isMetroMaster(m.tags) || m.members.some((x) => routeById.has(x.ref)));
const lines = [];
const inMaster = new Set();
for (const m of metroMasters) {
  const rs = m.members.filter((x) => x.type === 'relation' && routeById.has(x.ref)).map((x) => routeById.get(x.ref));
  rs.forEach((r) => inMaster.add(r.id));
  lines.push({ master: m, routes: rs, tags: m.tags });
}
for (const r of routes) if (!inMaster.has(r.id)) lines.push({ master: null, routes: [r], tags: r.tags });
const groupUsed = new Set();
for (const L of lines) for (const r of L.routes) for (const id of r.ways) groupUsed.add(groupOf.get(id));

const isMono = (t) => /monorail/i.test(`${v(t, 'route')} ${v(t, 'route_master')} ${v(t, 'disused:route')} ${v(t, 'name')}`);
const lineOut = [];
const usedIds = new Set();
for (const L of lines) {
  const t = L.tags;
  let id = isMono(t) ? `mumbai-monorail-${slug(v(t, 'ref').replace(/mono/i, '') || '1')}` : `${slug(v(t, 'network') || 'metro')}-${slug(v(t, 'ref') || v(t, 'name'))}`;
  if (!L.master) id += `-relation-${L.routes[0].id}`;
  while (usedIds.has(id)) id += '-x';
  usedIds.add(id);
  L.id = id;
  const dirs = L.routes.filter((r) => r.pieces);
  const stOrder = [];
  const first = [...L.routes].sort((a, b) => b.stopCount - a.stopCount)[0];
  for (const s of first?.stops || []) if (s.station && !stOrder.includes(s.station)) stOrder.push(s.station);
  for (const r of L.routes) for (const s of r.stops) if (s.station && !stOrder.includes(s.station)) stOrder.push(s.station);
  const statuses = [...new Set(L.routes.map((r) => r.statusFromTags))];
  lineOut.push({
    id, kind: L.master ? 'route_master' : 'route relation without route_master',
    osm: L.master ? `relation/${L.master.id}` : `relation/${L.routes[0].id}`,
    name: t.name || null, ref: t.ref || null, network: t.network || null, operator: t.operator || null, colour: t.colour || null,
    mode: isMono(t) ? 'monorail' : 'metro', statusFromTags: statuses.length === 1 ? statuses[0] : statuses,
    routes: L.routes.map((r) => r.id),
    routeLengthKm: dirs.length ? km(dirs.reduce((s, r) => s + r.lengthKm * 1000, 0) / dirs.length) : null,
    firstToLastStopKm: dirs.length && dirs.every((r) => r.firstToLastStopKm != null) ? km(dirs.reduce((s, r) => s + r.firstToLastStopKm * 1000, 0) / dirs.length) : null,
    inBoxKm: dirs.length ? km(dirs.reduce((s, r) => s + r.inBoxKm * 1000, 0) / dirs.length) : null,
    stations: stOrder,
  });
}
// Track groups not used by any route relation = lines mapped only as ways.
const groupOut = [];
for (const [name, list] of [...groups].sort((a, b) => a[0].localeCompare(b[0]))) {
  const mainWays = list.filter((w) => !w.tags.service || w.tags.service === 'spur');
  const chainsOf = (ws) => { const m = G.mergeChains(ws.map((w) => w.refs)); return [...m.open, ...m.closed].map((c) => c.map((n) => coord.get(n)).filter(Boolean)).filter((p) => p.length > 1).sort((a, b) => lenLL(b) - lenLL(a)); };
  const mainChains = chainsOf(mainWays), svcChains = chainsOf(list.filter((w) => !mainWays.includes(w)));
  const tagsSeen = (k) => [...new Set(list.map((w) => w.tags[k]).filter(Boolean))];
  groupOut.push({
    name, inRouteRelations: groupUsed.has(name),
    wayCount: list.length, ways: list.map((w) => w.id),
    groupedBy: [...new Set(list.map((w) => groupHow.get(w.id) || 'none'))],
    km: km(list.reduce((s, w) => s + lenLL(wayLL(w)), 0)),
    kmByLifecycle: kmBy(list, (w) => lifecycle(w.tags)), kmByStructure: kmBy(list, (w) => structure(w.tags)),
    kmByService: kmBy(list, (w) => w.tags.service || 'main'), kmByLayer: kmBy(list, (w) => w.tags.layer || 'none'),
    inBoxKm: km(list.reduce((s, w) => s + lenInBox(wayLL(w)), 0)),
    tags: { railway: tagsSeen('railway'), bridge: tagsSeen('bridge'), tunnel: tagsSeen('tunnel'), layer: tagsSeen('layer'), opening_date: tagsSeen('opening_date'), start_date: tagsSeen('start_date'), gauge: tagsSeen('gauge'), electrified: tagsSeen('electrified'), voltage: tagsSeen('voltage'), operator: tagsSeen('operator'), colour: tagsSeen('colour'), tracks: tagsSeen('tracks') },
    mainTrack: mainChains.map((p) => ({ lengthKm: km(lenLL(p)), ...simplify(p) })),
    serviceTrack: svcChains.map((p) => ({ lengthKm: km(lenLL(p)), ...simplify(p) })),
  });
  for (const w of list) {
    if (w.tags.railway === 'subway' && (w.tags.construction || w.tags['construction:railway'])) issue('lifecycle tags', `way/${w.id}`, `railway=subway with construction=${w.tags.construction || ''} construction:railway=${w.tags['construction:railway'] || ''} ("${name}"): open or under construction?`);
    if (missingNodes(w)) issue('missing nodes', `way/${w.id}`, `${missingNodes(w)} node(s) not in the extract`);
  }
}

// ---------------------------------------------------------------- station output
const linesOfStation = new Map();
for (const L of lines) for (const r of L.routes) for (const s of routeById.get(r.id).stops) if (s.station) (linesOfStation.get(s.station) || linesOfStation.set(s.station, new Set()).get(s.station)).add(L.id);
const routesOfStation = new Map();
for (const r of routes) for (const s of r.stops) if (s.station) (routesOfStation.get(s.station) || routesOfStation.set(s.station, new Set()).get(s.station)).add(r.id);
const outlineOf = (o) => {
  if (o.type !== 'way') return null;
  const ll = wayLL(o.way);
  const s = simplify(ll, 0.5);
  return { closed: o.way.refs[0] === o.way.refs[o.way.refs.length - 1], latlon: s.latlon, xz: s.xz };
};
const stationOut = stations.map((st) => {
  const p = st.primary, t = p.synthetic ? {} : p.tags, ll = posOf(st), id = stationId(st);
  const names = pick(t, NAME_KEYS);
  if (p.synthetic) names.name = st.stopArea?.tags.name || p.tags.name || null;
  const allNames = new Set([t.name, st.stopArea?.tags.name, ...st.stops.map((s) => s.tags.name), ...st.buildings.map((b) => b.tags.name)].filter(Boolean));
  // Level: from the track at the stop positions (or the station point), and from the station's own tags.
  const probe = st.stops.length ? st.stops.map((s) => s.ll) : [ll];
  const near = probe.flatMap((q) => tracksNear(q, 60).slice(0, 1));
  const lv = near.map((n) => structure(n.way.tags));
  const trackLevel = lv.length ? lv.sort((a, b) => lv.filter((q) => q === b).length - lv.filter((q) => q === a).length)[0] : null;
  const tagLevel = levelFromTags(t) || st.buildings.map((b) => levelFromTags(b.tags)).find(Boolean) || null;
  const lc = p.synthetic ? stationLifecycle(st.stops[0]?.tags || {}) : stationLifecycle(t);
  const nearTracks = [...new Set(tracksNear(ll, 150).map((n) => groupOf.get(n.way.id)).filter(Boolean))];
  const x = project(ll[0], ll[1]);
  const ix = stations.filter((o) => o !== st && hav(posOf(o), ll) < 400).map((o) => ({ station: stationId(o), name: o.primary.tags.name || o.stopArea?.tags.name || null, distM: Math.round(hav(posOf(o), ll)) }));
  const rail = railStations.filter((r) => hav([r.lat, r.lon], ll) < 600).map((r) => ({ osm: `node/${r.id}`, name: r.name, distM: Math.round(hav([r.lat, r.lon], ll)) })).sort((a, b) => a.distM - b.distM);
  return {
    id, osm: p.synthetic ? null : p.key, ...names,
    stopAreaName: st.stopArea?.tags.name || null, stopArea: st.stopArea ? `relation/${st.stopArea.id}` : null,
    namesSeen: [...allNames],
    network: t.network || st.stopArea?.tags.network || null, operator: t.operator || st.stopArea?.tags.operator || null,
    station: t.station || null, lifecycle: lc, dates: pick(t, ['start_date', 'opening_date']),
    lines: [...(linesOfStation.get(id) || [])], routes: [...(routesOfStation.get(id) || [])],
    nearTracks, // inferred: track groups within 150 m
    lat: r6(ll[0]), lon: r6(ll[1]), x: r1(x[0]), z: r1(x[1]), inBox: inBoxLL(ll[0], ll[1]),
    position: p.synthetic ? 'inferred: mean of stop positions' : `osm: ${p.type === 'node' ? 'station node' : 'centroid of station way'}`,
    level: trackLevel || tagLevel || 'unknown', levelFromTrack: trackLevel, levelFromTags: tagLevel,
    layer: t.layer ?? st.buildings.map((b) => b.tags.layer).find((l) => l != null) ?? null,
    wikidata: t.wikidata || null,
    link: st.how,
    buildings: st.buildings.map((b) => ({ osm: b.key, ...pick(b.tags, ['name', 'building', 'layer', 'building:levels', 'building:min_level', 'location']), link: st.links[b.key], outline: outlineOf(b) })),
    stops: st.stops.map((s) => ({ osm: s.key, name: s.tags.name || null, lifecycle: stationLifecycle(s.tags), lat: r6(s.ll[0]), lon: r6(s.ll[1]), x: r1(project(...s.ll)[0]), z: r1(project(...s.ll)[1]), routes: routes.filter((r) => r.stops.some((q) => q.node === s.id)).map((r) => r.id), link: st.links[s.key] })),
    platforms: st.platforms.map((pl) => ({ osm: pl.key, ...pick(pl.tags, ['ref', 'name', 'layer', 'level', 'area']), lat: r6(pl.ll[0]), lon: r6(pl.ll[1]), x: r1(project(...pl.ll)[0]), z: r1(project(...pl.ll)[1]), link: st.links[pl.key], outline: outlineOf(pl) })),
    entrances: st.entrances.map((e) => ({ osm: e.key, ...pick(e.tags, ['name', 'ref', 'level', 'wheelchair', 'highway', 'entrance']), lat: r6(e.ll[0]), lon: r6(e.ll[1]), x: r1(project(...e.ll)[0]), z: r1(project(...e.ll)[1]), distM: Math.round(hav(e.ll, ll)), link: st.links[e.key] })),
    interchanges: ix, nearbyRailStations: rail, // inferred by distance (400 m metro, 600 m rail)
  };
});
const unlinkedEntrances = metroObjs.filter((o) => o.kind === 'entrance' && !stationOf.has(o.key)).map((e) => ({ osm: e.key, ...pick(e.tags, ['name', 'ref']), lat: r6(e.ll[0]), lon: r6(e.ll[1]), x: r1(project(...e.ll)[0]), z: r1(project(...e.ll)[1]) }));

// Data checks on stations.
for (const s of stationOut) {
  if (!s.name) issue('station name', s.id, `station without a name (${s.lifecycle}${s.nearTracks.length ? `, near ${s.nearTracks.join(', ')}` : ''})`);
  const keys = new Set(s.namesSeen.map(loose));
  if (keys.size > 1) issue('station name', s.id, `different names on the station's objects: ${s.namesSeen.map((n) => `"${n}"`).join(', ')}`);
  if (s.lifecycle === 'operational' && !s.routes.length) issue('station not in a route', s.id, `"${s.name || s.stopAreaName}" (${s.lifecycle}) is not a stop of any route relation`);
  for (const q of s.stops) { const d = hav([q.lat, q.lon], [s.lat, s.lon]); if (d > 150) issue('stop far from station', s.id, `stop ${q.osm} "${q.name}" is ${Math.round(d)} m from the station point`); }
  if (s.levelFromTags && s.levelFromTrack && s.levelFromTags !== s.levelFromTrack) issue('station level', s.id, `tags say ${s.levelFromTags}, the track at the stop is ${s.levelFromTrack}`);
  if (s.lifecycle !== 'operational') {
    const op = stationOut.filter((o) => o.lifecycle === 'operational' && hav([o.lat, o.lon], [s.lat, s.lon]) < 250);
    if (op.length) issue('stale lifecycle', s.id, `"${s.name || ''}" is tagged ${s.lifecycle} but operational station(s) ${op.map((o) => `"${o.name || o.stopAreaName}" (${Math.round(hav([o.lat, o.lon], [s.lat, s.lon]))} m)`).join(', ')} stand next to it`);
  }
}
for (const o of objs.values()) if (o.kind === 'station' && !metroContext(o) && (o.tags.station === 'light_rail' || o.tags.light_rail === 'yes')) issue('mode tags', o.key, `"${o.tags.name}" is station=light_rail but its network is "${o.tags.network}" (a suburban station; left out)`);
for (const sa of stopAreas) if (/suburban/i.test(v(sa.tags, 'network')) && sa.members.some((m) => objs.get(memberKey(m))?.tags.station === 'light_rail')) issue('mode tags', `relation/${sa.id}`, `suburban stop area "${sa.tags.name}" holds a station=light_rail station`);

// ---------------------------------------------------------------- write
const out = {
  meta: {
    title: 'Mumbai Metro, Navi Mumbai Metro and Mumbai Monorail as mapped in OpenStreetMap',
    source: 'OpenStreetMap contributors, ODbL (https://www.openstreetmap.org/copyright). Map data © OpenStreetMap contributors.',
    extract: { file: path.relative(root, CFG.input), date: CFG.extractDate, from: 'extract.bbbike.org', box: CFG.extractBox },
    generated: new Date().toISOString().slice(0, 10), script: 'scripts/research/metro-from-osm.mjs',
    projection: {
      note: 'Same as scripts/build-tiles.mjs: flat (equirectangular) projection, metres per degree taken at the origin. x = east, z = SOUTH (north is −z); 1 unit = 1 m.',
      origin: { lat: lat0, lon: lon0 }, metresPerDegree: { lat: M_LAT, lon: M_LON },
      formula: 'x = (lon − 72.85) × metresPerDegree.lon;  z = −(lat − 19.03) × metresPerDegree.lat',
    },
    mapBox: { ...CFG.mapBox, game: { x0: r1(BOX[0]), z0: r1(BOX[1]), x1: r1(BOX[2]), z1: r1(BOX[3]) }, note: 'the converter default --bbox (south,west,north,east)' },
    lengths: 'lengthKm values: great-circle length of the full-resolution OSM geometry. inBoxKm: length inside mapBox after clipping in game coordinates. Polylines are simplified (Douglas–Peucker) to the tolerance below; latlon and xz hold the same points.',
    simplifyToleranceM: CFG.tolerance,
    inferred: 'Fields named "inferred*", values starting "inferred:", nearTracks, interchanges, nearbyRailStations and levelFromTrack are derived by distance, name or geometry, not tagged in OSM.',
    counts: {
      routes: routes.length, lines: lineOut.length, trackGroups: groupOut.length, trackWays: tracks.length,
      stations: stationOut.length, stationsInBox: stationOut.filter((s) => s.inBox).length,
      entrances: stationOut.reduce((s, x) => s + x.entrances.length, 0) + unlinkedEntrances.length,
      platforms: stationOut.reduce((s, x) => s + x.platforms.length, 0), issues: issues.length,
    },
  },
  lines: lineOut,
  routes,
  stations: stationOut,
  unlinkedEntrances,
  trackGroups: groupOut,
  issues,
};
fs.mkdirSync(path.dirname(CFG.out), { recursive: true });
fs.writeFileSync(CFG.out, stringify(out) + '\n');
log(`wrote ${path.relative(root, CFG.out)}: ${(fs.statSync(CFG.out).size / 1e6).toFixed(2)} MB; ${routes.length} routes, ${lineOut.length} lines, ${stationOut.length} stations, ${groupOut.length} track groups, ${issues.length} data issues`);

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
