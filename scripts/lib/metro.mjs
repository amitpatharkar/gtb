// Metro and monorail lines for the game (src/world/metro.js), from the OpenStreetMap route
// relations of the Mumbai Metro and the Mumbai Monorail: one polyline per line and direction,
// clipped to the map box, with its stations, and every station's place, axis and entrances.
// Research: docs/research/metro/reports/Mumbai Metro A to Z.md (lines, timings, crowding),
// research_notes/…/physical_design.md (viaduct 13 m above the road, 3.2 m cars, station sizes).
//
// Lines running in November 2026 inside the map: Line 1 (elevated, all 12 stations), Line 3
// (underground, all 27), the ends of Lines 2A, 7 and 2B (elevated) and the Monorail (elevated,
// closed to passengers since 20 September 2025). Lines under construction are left out.
import { clipPolyline } from 'lineclip';
import * as G from './geometry.mjs';

/** Line facts the game uses (research report): colour, cars, car length, peak and off-peak headway (s), first/last train (hours). */
export const METRO_LINES = {
  '1': { name: 'Line 1', colour: '#2f73d1', cars: 4, car: 21.9, peak: 200, off: 420, first: 5.5, last: 23.85, kind: 'elevated' },
  '2': { name: 'Line 2A', colour: '#f2c41a', cars: 6, car: 21.9, peak: 330, off: 540, first: 5.5, last: 23.0, kind: 'elevated' },
  '7': { name: 'Line 7', colour: '#d8312c', cars: 6, car: 21.9, peak: 330, off: 540, first: 5.5, last: 23.0, kind: 'elevated' },
  '2B': { name: 'Line 2B', colour: '#f2c41a', cars: 6, car: 21.9, peak: 570, off: 570, first: 6.0, last: 22.5, kind: 'elevated' },
  '3': { name: 'Line 3', colour: '#18b5b0', cars: 8, car: 22.15, peak: 265, off: 420, first: 5.92, last: 22.5, kind: 'underground' },
  'Mono 1': { name: 'Monorail', colour: '#4bb7c9', cars: 4, car: 10.8, peak: 480, off: 480, first: 6, last: 22, kind: 'monorail', closed: true },
};

/** A metro or monorail route relation (the closed monorail is mapped as disused:route=monorail). */
export const isMetroRoute = (t) => /route/.test(t.type || 'route') && /^(subway|monorail|light_rail)$/.test(t.route || t['disused:route'] || '') && !!METRO_LINES[t.ref] && !/construction|proposed/i.test(`${t.name || ''} ${t.state || ''}`);

/**
 * Station names as the game shows them: the operators' "L1"/"Metro" suffixes dropped, sponsor
 * prefixes never used (only `name` is read, never `official_name`), and the names the game
 * alters (CSMT, the airport, Siddhivinayak, a company-named monorail stop).
 */
export function metroName(n) {
  n = (n || '').replace(/\s+L\d+$/, '').replace(/\s*\(Line \w+\)$/i, '').replace(/\s+Metro( Station)?$/i, '').replace(/\s+Station$/i, '').replace(/\s+/g, ' ').trim();
  if (/chhatrapati shivaji maharaj terminus|\bcsmt?\b/i.test(n)) return 'Chhatrapati Chai Terminus';
  if (/\bcsmia\b/i.test(n)) return `Chhatrapati Udaan Airport ${/international|\bt2\b/i.test(n) ? 'T2' : 'T1'}`; // the airport's stops: "CSMIA Domestic" (T1), "CSMIA International T2"
  const air = n.match(/international airport.*\b(T[12])\b/i);
  if (air) return `Chhatrapati Udaan Airport ${air[1].toUpperCase()}`;
  if (/siddhivinayak/i.test(n)) return 'Siddhi-Vinayaka Mandir';
  if (/bharat petroleum/i.test(n)) return 'Refinery Gate';
  if (/^sbi[- ]/i.test(n)) return '';
  return n;
}
const DEVA = {
  'Chhatrapati Chai Terminus': 'छत्रपती चाय टर्मिनस', 'Chhatrapati Udaan Airport T1': 'छत्रपती उडान विमानतळ T1', 'Chhatrapati Udaan Airport T2': 'छत्रपती उडान विमानतळ T2',
  'Siddhi-Vinayaka Mandir': 'सिद्धी-विनायक मंदिर', 'Refinery Gate': 'रिफायनरी गेट',
};

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const cumOf = (pts) => { const c = [0]; for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + dist(pts[i], pts[i - 1])); return c; };

function locate(pts, cum, p) {
  let best = { d: 0, dist: Infinity, i: 1 };
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2)), dd = Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t);
    if (dd < best.dist) best = { d: cum[i - 1] + Math.sqrt(l2) * t, dist: dd, i };
  }
  return best;
}

/**
 * @param routes      [{ id, tags, members }] relations accepted by isMetroRoute
 * @param ways        Map way id → { refs, tags } for every member way
 * @param nodePos     (id) → [x, z] or undefined
 * @param stops       Map node id → { x, z, name }
 * @param stationNodes [[x, z, name, mr, hi, kind]] metro and monorail station nodes
 * @param entrances   [[x, z, ref, name]] railway=subway_entrance nodes
 * @param box         [x0, z0, x1, z1]
 */
export function buildMetro({ routes, ways, nodePos, stops, stationNodes, entrances, box, log }) {
  const inBox = (p) => p[0] >= box[0] - 0.01 && p[0] <= box[2] + 0.01 && p[1] >= box[1] - 0.01 && p[1] <= box[3] + 0.01;
  const lines = [];
  for (const rel of [...routes].sort((a, b) => a.id - b.id)) {
    const spec = METRO_LINES[rel.tags.ref];
    const ids = rel.members.filter((m) => m.type === 'way' && !/platform/.test(m.role) && ways.has(m.ref)).map((m) => m.ref);
    // Chain the ways end to end (they come in order).
    let cur = null;
    const chains = [];
    ids.forEach((id, i) => {
      let refs = ways.get(id).refs;
      const last = cur?.[cur.length - 1];
      if (cur && refs[0] === last) cur.push(...refs.slice(1));
      else if (cur && refs[refs.length - 1] === last) cur.push(...refs.slice(0, -1).reverse());
      else {
        const nx = ways.get(ids[i + 1])?.refs;
        if (nx && (refs[0] === nx[0] || refs[0] === nx[nx.length - 1])) refs = refs.slice().reverse();
        chains.push(cur = [...refs]);
      }
    });
    // Underground share (Line 3 is all tunnel; Aarey's approach is at grade).
    let under = 0, total = 0;
    for (const id of ids) { const t = ways.get(id).tags, n = ways.get(id).refs.length; total += n; if ((t.tunnel && t.tunnel !== 'no') || parseFloat(t.layer) < 0 || t.location === 'underground') under += n; }
    let best = null;
    for (const chain of chains) {
      const pts = chain.map(nodePos).filter(Boolean);
      for (const part of clipPolyline(pts, box)) {
        const len = cumOf(part).pop();
        if (!best || len > best.len) best = { pts: part, len, start: inBox(pts[0]) && dist(part[0], pts[0]) < 0.01, end: inBox(pts[pts.length - 1]) && dist(part[part.length - 1], pts[pts.length - 1]) < 0.01 };
      }
    }
    if (!best || best.len < 300) continue;
    const pts = G.simplifyLine(best.pts, 0.3).map(([x, z]) => [Math.round(x * 10) / 10, Math.round(z * 10) / 10]);
    const cum = cumOf(pts);
    // Stations: the relation's stops, named after the nearest station node.
    const st = [];
    for (const m of rel.members) {
      if (m.type !== 'node' || !/^stop/.test(m.role)) continue;
      const s = stops.get(m.ref);
      if (!s) continue;
      const at = locate(pts, cum, [s.x, s.z]);
      if (at.dist > 25) continue;
      // The stop's own name first (the nearest station node may belong to another line at an
      // interchange: Line 1's D. N. Nagar stands next to Line 2A's Andheri West).
      let name = metroName((s.name || '').replace(/\s*\((east|west|north|south)bound\)/i, '')), node = null, bd = 220;
      for (const n of stationNodes) {
        const d = Math.hypot(n[0] - s.x, n[1] - s.z), same = name && metroName(n[2]) === name;
        if (same && d < 400 && bd >= 0) { bd = -1; node = n; } else if (bd >= 0 && d < Math.min(bd, 60) && metroName(n[2])) { bd = d; node = n; }
      }
      if (!name && node) name = metroName(node[2]);
      if (node && name && metroName(node[2]) !== name && bd > 60) node = null; // another station's node: don't borrow its Marathi name
      if (!name || st.some((o) => o.name === name)) continue;
      st.push({ name, d: Math.max(20, Math.min(cum[cum.length - 1] - 20, at.d)), node });
    }
    st.sort((a, b) => a.d - b.d);
    lines.push({ rel: rel.id, ref: rel.tags.ref, spec, kind: spec.kind === 'underground' || under / Math.max(1, total) > 0.5 ? (spec.kind === 'monorail' ? 'monorail' : 'underground') : spec.kind, from: metroName(rel.tags.from), to: metroName(rel.tags.to), start: best.start, end: best.end, pts, cum, stations: st });
  }

  // Stations: one record per name and line, at the middle of its stops, with the track axis and entrances.
  const stations = [];
  for (const L of lines) for (const s of L.stations) {
    let rec = stations.find((o) => o.name === s.name && o.ref === L.ref);
    if (!rec) {
      const n = s.node;
      rec = { name: s.name, ref: L.ref, kind: L.kind, mr: DEVA[s.name] || n?.[3] || '', hi: n?.[4] || '', at: [] };
      stations.push(rec);
    }
    // The point at d and the direction there.
    let k = 1;
    while (k < L.cum.length - 1 && L.cum[k] < s.d) k++;
    const a = L.pts[k - 1], b = L.pts[k], f = (s.d - L.cum[k - 1]) / ((L.cum[k] - L.cum[k - 1]) || 1);
    rec.at.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, b[0] - a[0], b[1] - a[1]]);
  }
  for (const rec of stations) {
    const n = rec.at.length;
    rec.x = rec.at.reduce((s, p) => s + p[0], 0) / n; rec.z = rec.at.reduce((s, p) => s + p[1], 0) / n;
    let ux = rec.at[0][2], uz = rec.at[0][3];
    const l = Math.hypot(ux, uz) || 1; ux /= l; uz /= l;
    rec.axis = [+ux.toFixed(4), +uz.toFixed(4)];
    // Where each track runs past the station, across the axis (+ to the left: (−uz, ux)).
    rec.tracks = rec.at.map(([x, z]) => Math.round(((x - rec.x) * -uz + (z - rec.z) * ux) * 100) / 100);
    rec.entrances = entrances.filter(([x, z]) => Math.hypot(x - rec.x, z - rec.z) < (rec.kind === 'underground' ? 320 : 120))
      .map(([x, z, ref, name]) => [Math.round(x * 10) / 10, Math.round(z * 10) / 10, ref || '', name || '']);
    delete rec.at;
  }

  const dm = (v) => Math.round(v * 10);
  const json = {
    version: 1,
    note: 'Metro and monorail: pts are decimetres (first point, then steps); stations [name, decimetres along the line]. Station records: centre, axis, track offsets across the axis (m, + to the left), entrances [x, z, ref, name].',
    lines: lines.map((L) => {
      const pts = [];
      let px = 0, pz = 0;
      for (const [x, z] of L.pts) { pts.push(dm(x) - px, dm(z) - pz); px = dm(x); pz = dm(z); }
      return { rel: L.rel, ref: L.ref, ...L.spec, kind: L.kind, from: L.from, to: L.to, start: L.start ? 1 : 0, end: L.end ? 1 : 0, pts, stations: L.stations.map((s) => [s.name, dm(s.d)]) };
    }),
    stations: stations.map((s) => ({ ...s, x: Math.round(s.x * 10) / 10, z: Math.round(s.z * 10) / 10 })),
  };
  log(`metro: ${lines.length} lines (${[...new Set(lines.map((L) => L.spec.name))].join(', ')}), ${(lines.reduce((s, L) => s + L.cum[L.cum.length - 1], 0) / 1000).toFixed(1)} km of track, ${stations.length} stations, ${stations.reduce((s, r) => s + r.entrances.length, 0)} entrances`);
  return { json, lines };
}
