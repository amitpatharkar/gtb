// Street clutter from the survey (docs/research/street-library/README.md, key findings 8 and 9;
// docs/research/mumbai-guide.md D1): what hangs over, stands beside and leans against Mumbai's
// streets. Everything becomes map points (src/world/tileFormat.js POINT) that the game draws
// near the player (src/world/clutter.js):
// - blue street-name boards at junction corners (Marathi in Devanagari over English, the real
//   road name; `name:mr` from OpenStreetMap where mapped, else lib/devanagari.mjs),
// - blue direction boards before big junctions and overhead gantries on arterials, with real
//   places picked by the direction each road leads ("↑ Dadar · ← Worli"),
// - unipoles (one steel pole, a V of two hoardings) at big junctions, on highway verges and
//   at flyover approaches,
// - cable bundles sagging across bazaar and chawl lanes, wall to wall or lamp post to wall,
// - blue tarpaulins stretched over bazaar lanes and over hawkers' stalls,
// - small shrines in front of OpenStreetMap places of worship (temple, Jain temple, dargah,
//   wayside cross, Buddhist and Sikh shrines), at peepal trees and in the wadis,
// - flower sellers and white cloth canopies (shamiana) over puja stalls by temples and in
//   Bhuleshwar / Kalbadevi,
// - handcarts parked on the footpath edge of bazaar streets,
// - compound gates (with a watchman on a plastic chair) come from lib/walls.mjs.
import { ROAD, ROAD_FLAG, POINT } from '../../src/world/tileFormat.js';
import { arcLengths } from './streets.mjs';
import { toDevanagari } from './devanagari.mjs';
import * as G from './geometry.mjs';

/**
 * Places for direction boards: [English, Marathi, lat, lon, weight]. Real neighbourhoods and
 * hubs (off-map ones for the long roads out of the city). Weight: how readily a board names it.
 */
export const DESTINATIONS = [
  ['Colaba', 'कुलाबा', 18.9150, 72.8263, 0.9], ['Nariman Point', 'नरिमन पॉइंट', 18.9256, 72.8242, 0.8], ['Mantralaya', 'मंत्रालय', 18.9265, 72.8240, 0.6],
  ['Churchgate', 'चर्चगेट', 18.9322, 72.8264, 0.9], ['Fort', 'फोर्ट', 18.9345, 72.8350, 0.8], ['Ballard Estate', 'बॅलार्ड इस्टेट', 18.9380, 72.8410, 0.5],
  ['Marine Drive', 'मरीन ड्राइव्ह', 18.9440, 72.8230, 0.8], ['Crawford Market', 'क्रॉफर्ड मार्केट', 18.9476, 72.8340, 0.7], ['Kalbadevi', 'काळबादेवी', 18.9500, 72.8290, 0.5],
  ['Masjid Bunder', 'मशीद बंदर', 18.9520, 72.8380, 0.6], ['Girgaon Chowpatty', 'गिरगाव चौपाटी', 18.9548, 72.8135, 0.7], ['Malabar Hill', 'मलबार हिल', 18.9550, 72.8030, 0.7],
  ['Grant Road', 'ग्रँट रोड', 18.9630, 72.8160, 0.6], ['Mazgaon', 'माझगाव', 18.9640, 72.8450, 0.5], ['Nagpada', 'नागपाडा', 18.9670, 72.8270, 0.5],
  ['Tardeo', 'ताडदेव', 18.9700, 72.8130, 0.6], ['Mumbai Central', 'मुंबई सेंट्रल', 18.9710, 72.8195, 0.8], ['Byculla', 'भायखळा', 18.9790, 72.8330, 0.8],
  ['Haji Ali', 'हाजी अली', 18.9827, 72.8090, 0.8], ['Mahalaxmi', 'महालक्ष्मी', 18.9830, 72.8240, 0.7], ['Lalbaug', 'लालबाग', 18.9930, 72.8380, 0.6],
  ['Lower Parel', 'लोअर परळ', 18.9960, 72.8300, 0.8], ['Parel', 'परळ', 19.0000, 72.8420, 0.8], ['Sewri', 'शिवडी', 18.9990, 72.8560, 0.6],
  ['Worli', 'वरळी', 19.0110, 72.8180, 1], ['Prabhadevi', 'प्रभादेवी', 19.0150, 72.8290, 0.6], ['Wadala', 'वडाळा', 19.0170, 72.8650, 0.7],
  ['Dadar', 'दादर', 19.0190, 72.8430, 1], ['Shivaji Park', 'शिवाजी पार्क', 19.0270, 72.8380, 0.6], ['Matunga', 'माटुंगा', 19.0270, 72.8550, 0.7],
  ['Sea Link', 'सी लिंक', 19.0350, 72.8170, 0.8], ['Mahim', 'माहीम', 19.0400, 72.8410, 0.8], ['Dharavi', 'धारावी', 19.0430, 72.8530, 0.6],
  ['Sion', 'शीव', 19.0430, 72.8630, 0.9], ['Bandra', 'वांद्रे', 19.0550, 72.8350, 1], ['Bandra Kurla Complex', 'वांद्रे-कुर्ला संकुल', 19.0660, 72.8650, 0.8],
  ['Khar', 'खार', 19.0710, 72.8360, 0.6], ['Kurla', 'कुर्ला', 19.0650, 72.8790, 0.9], ['Chembur', 'चेंबूर', 19.0620, 72.9000, 0.9],
  ['Santacruz', 'सांताक्रूझ', 19.0820, 72.8410, 0.8], ['Ghatkopar', 'घाटकोपर', 19.0860, 72.9080, 0.9], ['Airport', 'विमानतळ', 19.0960, 72.8740, 1],
  ['Juhu', 'जुहू', 19.1000, 72.8270, 0.8], ['Vile Parle', 'विलेपार्ले', 19.1000, 72.8450, 0.7], ['Saki Naka', 'साकी नाका', 19.1030, 72.8880, 0.7],
  ['Andheri', 'अंधेरी', 19.1190, 72.8470, 1], ['Powai', 'पवई', 19.1180, 72.9050, 0.9],
  // Beyond the map: where the highways go.
  ['Borivali', 'बोरिवली', 19.2307, 72.8567, 0.9], ['Thane', 'ठाणे', 19.2183, 72.9781, 1], ['Navi Mumbai', 'नवी मुंबई', 19.0330, 73.0297, 1],
];

/** Shrine kinds (POINT.SHRINE size = 0.5 + 0.25 × kind; src/world/clutter.js draws them). */
export const SHRINE = { TEMPLE: 0, JAIN: 1, DARGAH: 2, CROSS: 3, BUDDHIST: 4, SIKH: 5 };

/** Small uniform grid of items with an [x, z] position or a bounding box. */
class Grid {
  constructor(cell) { this.cell = cell; this.map = new Map(); }
  add(x0, z0, x1, z1, item) {
    const c = this.cell;
    for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++) for (let j = Math.floor(z0 / c); j <= Math.floor(z1 / c); j++) {
      const k = i * 100003 + j;
      (this.map.get(k) || this.map.set(k, []).get(k)).push(item);
    }
  }
  near(x, z, r, fn) {
    const c = this.cell, seen = new Set();
    for (let i = Math.floor((x - r) / c); i <= Math.floor((x + r) / c); i++) for (let j = Math.floor((z - r) / c); j <= Math.floor((z + r) / c); j++) {
      for (const it of this.map.get(i * 100003 + j) || []) { if (seen.has(it)) continue; seen.add(it); if (fn(it)) return true; }
    }
    return false;
  }
}

/** Point and unit tangent (drawing direction) at arc length t of a polyline. */
function pointAt(pts, s, t) {
  t = Math.max(0, Math.min(s[s.length - 1], t));
  let i = 1;
  while (i < s.length - 1 && s[i] < t) i++;
  const f = s[i] > s[i - 1] ? (t - s[i - 1]) / (s[i] - s[i - 1]) : 0;
  const dx = pts[i][0] - pts[i - 1][0], dz = pts[i][1] - pts[i - 1][1], l = Math.hypot(dx, dz) || 1;
  return { x: pts[i - 1][0] + dx * f, z: pts[i - 1][1] + dz * f, dx: dx / l, dz: dz / l };
}

const ROADWORD = /\b(road|rd|marg|lane|street|st|path|gal+i|gully|cross|avenue|chowk|nagar|wadi|bazaa?r|drive|walk|highway|link|flyover|bridge|bunder|bandar|peth|mohalla|sadak|rasta|circle|square|park|colony)\b/i;
const BAZAAR_PROFILES = new Set(['bazaar-wholesale', 'kalbadevi-gully', 'muslim-quarter-bazaar', 'electronics-strip', 'byculla-mill-market', 'fort-narrow-commercial']);

/**
 * All clutter points. o: { vparts, junc, district(x, z), onRoad(x, z, m), inBuilding(x, z, pad),
 * onTrack(x, z, m), onLand(x, z), inBox(x, z), heightAt(x, z), hash(n, salt), project(lat, lon),
 * points (trees, lamps, stalls… already placed), worship [{ x, z, religion, name, area }],
 * gates [{ x, z, angle }], nameOf(part), nameMrOf(part), log }.
 * Returns points ({ kind, x, z, angle, size, label? }).
 */
export function streetClutter(o) {
  const { vparts, junc, district, onRoad, inBuilding, onTrack, onLand, inBox, heightAt, hash } = o;
  const out = [];
  const R = (n, salt = 0) => hash(Math.abs(Math.round(n * 7.31)) % 2147483647, salt);
  // Everything already standing on the footpath (trees, lamps, stalls, barricades…) and what we add.
  const taken = new Grid(6);
  for (const p of o.points) taken.add(p.x, p.z, p.x, p.z, [p.x, p.z]);
  const clearOf = (x, z, r) => !taken.near(x, z, r, ([px, pz]) => (px - x) ** 2 + (pz - z) ** 2 < r * r);
  const take = (x, z) => taken.add(x, z, x, z, [x, z]);
  const free = (x, z, pad = 0.4) => inBox(x, z) && !onRoad(x, z, 0.25) && !inBuilding(x, z, pad) && onLand(x, z) && !onTrack(x, z);
  const push = (p) => { out.push(p); take(p.x, p.z); return p; };
  const count = (k) => out.filter((p) => p.kind === k).length;
  const plain = (n) => String(n || '').split('(')[0].replace(/\s+/g, ' ').trim(); // "X Road (Y Road)" → "X Road"
  const marathi = (p, en) => { const mr = o.nameMrOf(p); return mr && !/[()]/.test(mr) ? mr.trim() : toDevanagari(en); };
  // Context: the street profile (library) or the district's shop density.
  const bazaarOf = (p) => (p.profile ? (BAZAAR_PROFILES.has(p.profile.id) ? 1 : p.profile.shops >= 0.85 ? 0.6 : 0.15) : Math.max(0, (district(p.pts[0][0], p.pts[0][1]).shops - 0.55) / 0.4));

  // Road segments for nearest-road questions (shrines, stalls, trees).
  const segs = new Grid(25);
  for (const p of vparts) for (let i = 1; i < p.pts.length; i++) {
    const a = p.pts[i - 1], b = p.pts[i];
    segs.add(Math.min(a[0], b[0]) - p.hw, Math.min(a[1], b[1]) - p.hw, Math.max(a[0], b[0]) + p.hw, Math.max(a[1], b[1]) + p.hw, { a, b, p });
  }
  const nearestRoad = (x, z, r) => {
    let best = null;
    segs.near(x, z, r, (it) => {
      if (it.p.info.cls > ROAD.SERVICE || it.p.info.flags & ROAD_FLAG.BRIDGE) return false;
      const d2 = G.segDist2([x, z], it.a, it.b);
      if (d2 < r * r && (!best || d2 < best.d2)) best = { ...it, d2 };
      return false;
    });
    if (!best) return null;
    const { a, b } = best, dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2)), fx = a[0] + dx * t, fz = a[1] + dz * t, d = Math.sqrt(best.d2) || 1;
    return { p: best.p, fx, fz, nx: (x - fx) / d, nz: (z - fz) / d, d, tx: dx / Math.sqrt(l2), tz: dz / Math.sqrt(l2) };
  };

  // ------------------------------------------------------------------ junctions and their arms
  const nodes = new Map();
  for (const p of vparts) {
    if (p.pts.length < 2) continue;
    const s = p.s || (p.s = arcLengths(p.pts)), L = s[s.length - 1];
    p.ids.forEach((id, i) => {
      if (!junc.isJunction(id)) return;
      let n = nodes.get(id);
      if (!n) nodes.set(id, (n = { id, x: p.pts[i][0], z: p.pts[i][1], arms: [] }));
      for (const dir of [-1, 1]) {
        if ((dir < 0 && i === 0) || (dir > 0 && i === p.pts.length - 1)) continue;
        const avail = dir > 0 ? L - s[i] : s[i], q = pointAt(p.pts, s, s[i] + dir * Math.min(60, avail));
        const dx = q.x - n.x, dz = q.z - n.z, l = Math.hypot(dx, dz) || 1;
        const oneway = !!(p.info.flags & ROAD_FLAG.ONEWAY);
        n.arms.push({ p, s, i, dir, ux: dx / l, uz: dz / l, avail, cls: p.info.cls, hw: p.hw, fw: p.fw || 0, name: plain(o.nameOf(p)), bridge: !!(p.info.flags & ROAD_FLAG.BRIDGE), in: !oneway || dir < 0, out: !oneway || dir > 0 });
      }
    });
  }
  const along = (arm, d) => { const q = pointAt(arm.p.pts, arm.s, arm.s[arm.i] + arm.dir * d); return { x: q.x, z: q.z, tx: q.dx * arm.dir, tz: q.dz * arm.dir }; };
  const major = (n) => n.arms.length >= 3 && n.arms.filter((a) => a.cls <= ROAD.SECONDARY).length >= 2;

  // ------------------------------------------------------------------ street-name boards
  const named = new Map(); // name → Grid of boards (one board per name within 90 m)
  for (const n of nodes.values()) {
    const seen = new Set();
    const arms = n.arms.slice().sort((a, b) => R(a.ux * 91 + n.x, 3) - R(b.ux * 91 + n.x, 3));
    for (const arm of arms) {
      if (!arm.name || arm.cls > ROAD.LIVING || arm.cls === ROAD.LINK || arm.bridge || arm.avail < 10 || seen.has(arm.name)) continue;
      // Lanes named after a building ("Shyam Nivas") have no municipal board.
      if (arm.cls >= ROAD.RESIDENTIAL && !ROADWORD.test(arm.name)) continue;
      seen.add(arm.name);
      const g = named.get(arm.name) || named.set(arm.name, new Grid(100)).get(arm.name);
      if (g.near(n.x, n.z, 90, ([x, z]) => (x - n.x) ** 2 + (z - n.z) ** 2 < 8100)) continue;
      const q = along(arm, junc.radius(n.id) + 1.4);
      const first = R(n.x * 3 + n.z, 5) < 0.5 ? 1 : -1;
      for (const side of [first, -first]) {
        const off = arm.hw + Math.max(arm.fw, 1) - 0.45, x = q.x - q.tz * side * off, z = q.z + q.tx * side * off;
        if (!free(x, z, 0.45) || !clearOf(x, z, 1.1)) continue;
        // The plate runs along the road it names, so drivers on the cross street read it.
        push({ kind: POINT.NAME_BOARD, x, z, angle: Math.atan2(q.tz * side, -q.tx * side), size: 1, label: `${arm.name}|${marathi(arm.p, arm.name)}` });
        g.add(n.x, n.z, n.x, n.z, [n.x, n.z]);
        break;
      }
    }
  }

  // ------------------------------------------------------------------ direction boards and gantries
  const dest = DESTINATIONS.map(([en, mr, lat, lon, w]) => { const [x, z] = o.project(lat, lon); return { en, mr, x, z, w, far: !inBox(x, z) }; });
  /** Destination lines for traffic arriving at node n along arm A: ahead, left, right. */
  const lines = (n, A) => {
    const fx = -A.ux, fz = -A.uz, used = new Set(), found = [];
    for (const B of n.arms) {
      if (B === A || !B.out || B.cls > ROAD.TERTIARY) continue;
      const turn = fx * B.uz - fz * B.ux, dot = fx * B.ux + fz * B.uz, ang = Math.atan2(turn, dot);
      if (Math.abs(ang) > 2.6) continue; // a U-turn
      const arrow = Math.abs(ang) < 0.6 ? '^' : turn < 0 ? '<' : '>';
      // Where the road leads: its direction a few hundred metres out.
      const far = along(B, Math.min(300, B.avail)), vx = far.x - n.x, vz = far.z - n.z, vl = Math.hypot(vx, vz) || 1;
      let best = null, bs = -1e9;
      for (const D of dest) {
        const dx = D.x - n.x, dz = D.z - n.z, dist = Math.hypot(dx, dz) / 1000;
        // Beyond the map (Thane, Navi Mumbai, Borivali) only on the roads that get there.
        if (dist < 1.3 || dist > (D.far ? 16 : 30) || used.has(D.en)) continue;
        const cos = (dx * vx + dz * vz) / (dist * 1000 * vl);
        if (cos < 0.74) continue;
        const sc = (cos - 0.74) * 3 + D.w - Math.abs(Math.log(dist / 4)) * 0.5 + (arrow === '^' && dist > 3 ? 0.2 : 0);
        if (sc > bs) { bs = sc; best = D; }
      }
      if (!best || found.some((f) => f.arrow === arrow && f.score >= bs)) continue;
      const old = found.findIndex((f) => f.arrow === arrow);
      if (old >= 0) { used.delete(found[old].D.en); found.splice(old, 1); }
      used.add(best.en);
      found.push({ arrow, D: best, score: bs });
    }
    const order = { '^': 0, '<': 1, '>': 2 };
    return found.sort((a, b) => order[a.arrow] - order[b.arrow]).map((f) => `${f.D.en}|${f.D.mr}|${f.arrow}`);
  };
  const boardGrid = new Grid(80);
  for (const n of nodes.values()) {
    if (!major(n)) continue;
    for (const A of n.arms) {
      if (A.cls > ROAD.SECONDARY || !A.in || A.bridge || A.avail < 70) continue;
      const L = lines(n, A);
      if (!L.length) continue;
      const label = L.join(';');
      // Side board on the left kerb (India keeps left), 40–50 m before the junction.
      if (R(n.x + A.ux * 13, 11) < 0.7 && L.length >= 2) {
        const q = along(A, 40 + R(n.z + A.uz, 12) * 10), fx = -q.tx, fz = -q.tz; // travel direction
        const off = A.hw + Math.min(Math.max(A.fw, 1), 2.4) * 0.5, x = q.x + fz * off, z = q.z - fx * off;
        if (free(x, z, 0.5) && clearOf(x, z, 1.6) && !boardGrid.near(x, z, 40, ([bx, bz]) => (bx - x) ** 2 + (bz - z) ** 2 < 1600)) {
          push({ kind: POINT.DIR_BOARD, x, z, angle: Math.atan2(-fx, -fz), size: 1, label });
          boardGrid.add(x, z, x, z, [x, z]);
        }
      }
      // Overhead gantry on arterials, ~110 m out, where the road is straight.
      if (A.cls <= ROAD.PRIMARY && A.avail >= 150 && R(n.x - A.uz * 17, 13) < 0.55) {
        const d = 105 + R(n.z * 3, 14) * 20, q = along(A, d), q0 = along(A, d - 18), q1 = along(A, d + 18);
        if (q0.tx * q1.tx + q0.tz * q1.tz < 0.985) continue;
        const fx = -q.tx, fz = -q.tz, oneway = !A.out;
        const span = oneway ? 2 * A.hw : A.hw, shift = oneway ? 0 : A.hw / 2;
        if (span < 7 || span > 30) continue;
        const x = q.x + fz * shift, z = q.z - fx * shift;
        const ends = [[x + fz * (span / 2 + 0.6), z - fx * (span / 2 + 0.6)], [x - fz * (span / 2 + 0.6), z + fx * (span / 2 + 0.6)]];
        if (ends.some(([ex, ez]) => inBuilding(ex, ez, 0.5) || !onLand(ex, ez))) continue;
        if (boardGrid.near(x, z, 60, ([bx, bz]) => (bx - x) ** 2 + (bz - z) ** 2 < 3600)) continue;
        push({ kind: POINT.DIR_GANTRY, x, z, angle: Math.atan2(-fx, -fz), size: span / 16, label });
        boardGrid.add(x, z, x, z, [x, z]);
      }
    }
  }

  // ------------------------------------------------------------------ unipoles
  const poles = new Grid(150);
  const poleOk = (x, z) => free(x, z, 7.5) && !onRoad(x, z, 2.5) && !onTrack(x, z, 6) && clearOf(x, z, 2) && !poles.near(x, z, 130, ([px, pz]) => (px - x) ** 2 + (pz - z) ** 2 < 130 * 130);
  const addPole = (x, z, angle, salt) => { push({ kind: POINT.UNIPOLE, x, z, angle, size: 0.9 + R(x + z, salt) * 0.35 }); poles.add(x, z, x, z, [x, z]); };
  for (const n of nodes.values()) {
    if (!(major(n) || n.arms.some((a) => a.cls <= ROAD.PRIMARY)) || R(n.x * 5 - n.z, 21) > 0.4) continue;
    const arms = n.arms.slice().sort((a, b) => Math.atan2(a.uz, a.ux) - Math.atan2(b.uz, b.ux));
    for (let k = 0; k < arms.length; k++) {
      const a = arms[k], b = arms[(k + 1) % arms.length];
      let bx = a.ux + b.ux, bz = a.uz + b.uz, bl = Math.hypot(bx, bz);
      if (bl < 0.25) { bx = -a.uz; bz = a.ux; bl = 1; } // straight through: square off to one side
      bx /= bl; bz /= bl;
      const half = Math.acos(Math.max(-1, Math.min(1, a.ux * b.ux + a.uz * b.uz))) / 2;
      const dist = (Math.max(a.hw, b.hw) + Math.max(a.fw, b.fw) + 5) / Math.max(0.4, Math.sin(half));
      const x = n.x + bx * dist, z = n.z + bz * dist;
      if (dist > 45 || !poleOk(x, z)) continue;
      addPole(x, z, Math.atan2(n.x - x, n.z - z), 22);
      break;
    }
  }
  for (const p of vparts) {
    const s = p.s || (p.s = arcLengths(p.pts)), L = s[s.length - 1];
    if (p.info.cls <= ROAD.TRUNK && !(p.info.flags & ROAD_FLAG.BRIDGE)) {
      // Highway verges: a unipole every few hundred metres, sides taking turns.
      for (let t = 120 + (p.id % 97); t < L - 40; t += 330 + R(p.id + t, 23) * 160) {
        const q = pointAt(p.pts, s, t), side = R(t + p.id, 24) < 0.5 ? 1 : -1, off = p.hw + (p.fw || 0) + 7;
        const x = q.x - q.dz * side * off, z = q.z + q.dx * side * off;
        if (poleOk(x, z)) addPole(x, z, Math.atan2(q.dz * side, -q.dx * side), 25);
      }
    }
    if (p.info.flags & ROAD_FLAG.BRIDGE && p.info.cls <= ROAD.SECONDARY && L > 60) {
      // Flyover approaches: a board where the ramp starts climbing.
      for (const end of [0, 1]) {
        if (R(p.id * 2 + end, 26) > 0.6) continue;
        const a = end ? p.pts[p.pts.length - 1] : p.pts[0], b = end ? p.pts[p.pts.length - 2] : p.pts[1];
        const l = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, ux = (a[0] - b[0]) / l, uz = (a[1] - b[1]) / l; // outwards, along the approach
        const side = R(p.id + end * 7, 27) < 0.5 ? 1 : -1, off = p.hw + 8;
        const x = a[0] + ux * 45 - uz * side * off, z = a[1] + uz * 45 + ux * side * off;
        if (poleOk(x, z)) addPole(x, z, Math.atan2(-ux, -uz), 28);
      }
    }
  }

  // ------------------------------------------------------------------ cables and tarps across lanes
  const lamps = new Grid(10);
  for (const p of o.points) if (p.kind === POINT.LIGHT) lamps.add(p.x, p.z, p.x, p.z, [p.x, p.z]);
  /** First wall from the road centre q outwards along (nx, nz) within reach: [x, z, height] or null. */
  const wall = (qx, qz, nx, nz, from, to) => {
    for (let d = from; d <= to; d += 0.5) {
      const x = qx + nx * d, z = qz + nz * d;
      if (inBuilding(x, z, 0)) { const h = heightAt(x + nx * 0.4, z + nz * 0.4); return [qx + nx * (d - 0.35), qz + nz * (d - 0.35), h]; }
    }
    return null;
  };
  const lampAt = (x, z, r) => { let f = null; lamps.near(x, z, r, ([lx, lz]) => { if ((lx - x) ** 2 + (lz - z) ** 2 < r * r) { f = [lx, lz]; return true; } return false; }); return f; };
  for (const p of vparts) {
    const { cls, width, flags } = p.info;
    if (cls < ROAD.SECONDARY || cls > ROAD.LIVING || cls === ROAD.LINK || width > 14 || flags & ROAD_FLAG.BRIDGE) continue;
    const s = p.s || (p.s = arcLengths(p.pts)), L = s[s.length - 1];
    if (L < 20) continue;
    const baz = bazaarOf(p), prof = p.profile;
    const cableShare = prof ? Math.max((prof.cables || 0) * 0.8, baz * 0.5) : baz > 0 ? 0.25 + baz * 0.55 : 0.05;
    const tarpShare = width <= 10.5 && cls >= ROAD.TERTIARY ? (prof ? prof.tarps || 0 : baz >= 0.75 ? 0.22 : 0) : 0;
    const near = [];
    p.ids.forEach((id, i) => { if (junc.isJunction(id)) near.push([s[i], junc.radius(id) + 3]); });
    const clearJ = (t) => near.every(([q, r]) => Math.abs(q - t) > r);
    for (let t = 8 + (p.id % 11); t < L - 6; t += 16 + R(p.id * 3 + t, 31) * 20) {
      if (!clearJ(t)) continue;
      const tarp = R(p.id + t * 5, 32) < tarpShare, cable = !tarp && R(p.id * 7 + t, 33) < cableShare;
      if (!tarp && !cable) continue;
      const q = pointAt(p.pts, s, t), nx = -q.dz, nz = q.dx, reach = p.hw + (p.fw || 0) + 8;
      const A = wall(q.x, q.z, nx, nz, p.hw * 0.6, reach), B = wall(q.x, q.z, -nx, -nz, p.hw * 0.6, reach);
      let a = A && A[2] >= (tarp ? 5.5 : 7.5) ? A : null, b = B && B[2] >= (tarp ? 5.5 : 7.5) ? B : null;
      if (cable && (!a || !b)) {
        // One end on a lamp post across the street.
        const la = !a && lampAt(q.x + nx * (p.hw + 0.5), q.z + nz * (p.hw + 0.5), 4), lb = !b && lampAt(q.x - nx * (p.hw + 0.5), q.z - nz * (p.hw + 0.5), 4);
        if (la) a = [la[0], la[1], 8]; else if (lb) b = [lb[0], lb[1], 8];
      }
      if (!a || !b) continue;
      const span = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const angle = Math.atan2(b[0] - a[0], b[1] - a[1]), x = (a[0] + b[0]) / 2, z = (a[1] + b[1]) / 2;
      if (tarp && span >= 5 && span <= 19) out.push({ kind: POINT.TARP, x, z, angle, size: span / 10 });
      else if (cable && span >= 6 && span <= 23.5) out.push({ kind: POINT.CABLES, x, z, angle, size: span / 12 });
    }
  }

  // ------------------------------------------------------------------ stall tarps, flowers, puja canopies
  for (const st of o.points) {
    if (st.kind !== POINT.STALL) continue;
    const r = nearestRoad(st.x, st.z, 14);
    if (!r) continue;
    const baz = bazaarOf(r.p), share = r.p.profile?.tarps ? 0.5 : baz * 0.45;
    if (R(st.x * 3 + st.z, 41) < share) out.push({ kind: POINT.STALL_TARP, x: st.x, z: st.z, angle: st.angle, size: 0.9 + R(st.z, 42) * 0.4 });
  }
  const flowerStreet = (p) => p.profile?.flowers || (/^(Kalbadevi|Dadar|Prabhadevi)$/.test(district(p.pts[0][0], p.pts[0][1]).name) ? 0.22 : 0);
  /** A seller (FLOWERS) or a puja stall under a cloth canopy (SHAMIANA) on the footpath beside the road at arc length t. */
  const footStall = (p, s, t, side, kind) => {
    const q = pointAt(p.pts, s, t), off = p.hw + p.fw * (kind === POINT.SHAMIANA ? 0.55 : 0.6);
    if (p.fw < (kind === POINT.SHAMIANA ? 1.8 : 1.3)) return false;
    const x = q.x - q.dz * side * off, z = q.z + q.dx * side * off;
    if (!free(x, z, kind === POINT.SHAMIANA ? 0.8 : 0.4) || !clearOf(x, z, kind === POINT.SHAMIANA ? 2.2 : 1.4)) return false;
    push({ kind, x, z, angle: Math.atan2(q.dz * side, -q.dx * side), size: 0.9 + R(x - z, 43) * 0.3 });
    return true;
  };
  for (const p of vparts) {
    const share = flowerStreet(p);
    if (!share || !p.fw || p.info.cls > ROAD.LIVING) continue;
    const s = p.s || (p.s = arcLengths(p.pts)), L = s[s.length - 1];
    for (let t = 12 + (p.id % 13); t < L - 8; t += 30 + R(p.id + t, 44) * 30) {
      if (R(p.id * 5 + t, 45) > share) continue;
      const side = R(t - p.id, 46) < 0.5 ? 1 : -1;
      footStall(p, s, t, side, R(t * 3 + p.id, 47) < 0.4 ? POINT.SHAMIANA : POINT.FLOWERS);
    }
  }

  // ------------------------------------------------------------------ shrines
  const religion = (w) => {
    const r = String(w.religion || '').toLowerCase(), n = String(w.name || '').toLowerCase();
    if (r === 'hindu' || (!r && /mandir|temple|devi|ganesh|ganpati|hanuman|maruti|shiv|sai |sai$|mata|vitthal|ram /.test(n))) return SHRINE.TEMPLE;
    if (r === 'jain' || /derasar|jain/.test(n)) return SHRINE.JAIN;
    if (r === 'muslim' || /masjid|mosque|dargah|darga/.test(n)) return SHRINE.DARGAH;
    if (r === 'christian' || /church|chapel|cross|st\.? /.test(n)) return SHRINE.CROSS;
    if (r === 'buddhist' || /vihar|buddh/.test(n)) return SHRINE.BUDDHIST;
    if (r === 'sikh' || /gurudwara|gurdwara/.test(n)) return SHRINE.SIKH;
    return -1;
  };
  const shrineAt = (x, z, kind, r, sellers) => {
    push({ kind: POINT.SHRINE, x, z, angle: Math.atan2(-r.nx, -r.nz), size: 0.5 + 0.25 * kind });
    if (!sellers || kind > SHRINE.JAIN) return;
    // Temples: flower and garland sellers on the footpath beside, sometimes a puja stall under a canopy.
    const side = r.tx * r.nz - r.tz * r.nx > 0 ? 1 : -1; // the shrine's side of the road
    const p2 = { ...r.p, pts: [[r.fx - r.tx * 50, r.fz - r.tz * 50], [r.fx + r.tx * 50, r.fz + r.tz * 50]] }, sl = arcLengths(p2.pts);
    footStall(p2, sl, 50 + 2.6, side, POINT.FLOWERS);
    if (R(x + z * 3, 48) < 0.6) footStall(p2, sl, 50 - 2.6, side, POINT.FLOWERS);
    if (R(x * 3 - z, 49) < 0.5) footStall(p2, sl, 50 + 6.5, side, POINT.SHAMIANA);
  };
  let shrines = 0;
  for (const w of o.worship) {
    const kind = religion(w);
    if (kind < 0 || !inBox(w.x, w.z)) continue;
    const r = nearestRoad(w.x, w.z, 35);
    if (!r || r.p.info.cls > ROAD.LIVING) continue;
    // A mapped point that stands free and off the road is the shrine itself; a building (or a
    // point inside one) gets its shrine front at the back of the footpath in front of it.
    if (!w.area && r.d > r.p.hw + 0.8 && free(w.x, w.z, 0.5) && clearOf(w.x, w.z, 1.2)) { shrineAt(w.x, w.z, kind, r, true); shrines++; continue; }
    for (const k of [1.05, 0.95, 0.6]) {
      const off = r.p.hw + r.p.fw * k + (k > 1 ? 0.5 : 0), x = r.fx + r.nx * off, z = r.fz + r.nz * off;
      if (!free(x, z, 0.55) || !clearOf(x, z, 1.4)) continue;
      shrineAt(x, z, kind, r, true); shrines++;
      break;
    }
  }
  // A small shrine at the foot of some peepal trees in the busy districts, and wayside crosses in the wadis.
  for (const t of o.points) {
    if (t.kind !== POINT.PEEPAL || R(t.x * 7 + t.z, 51) > 0.14 || district(t.x, t.z).shops < 0.6) continue;
    const r = nearestRoad(t.x, t.z, 12);
    if (!r) continue;
    const x = t.x - r.nx * 0.95, z = t.z - r.nz * 0.95;
    if (free(x, z, 0.4) && !onRoad(x, z, 0.4)) { shrineAt(x, z, SHRINE.TEMPLE, r, false); shrines++; }
  }
  for (const p of vparts) {
    if (p.profile?.id !== 'wadi-lane') continue;
    const s = p.s || (p.s = arcLengths(p.pts)), L = s[s.length - 1];
    for (let t = 20 + (p.id % 30); t < L - 10; t += 110 + R(p.id + t, 52) * 90) {
      const q = pointAt(p.pts, s, t), side = R(t + p.id * 3, 53) < 0.5 ? 1 : -1, off = p.hw + (p.fw || 0) + 0.7;
      const x = q.x - q.dz * side * off, z = q.z + q.dx * side * off;
      if (!free(x, z, 0.4) || !clearOf(x, z, 1.2)) continue;
      const r = nearestRoad(x, z, 15);
      if (r) { shrineAt(x, z, SHRINE.CROSS, r, false); shrines++; }
    }
  }

  // ------------------------------------------------------------------ handcarts parked on bazaar footpaths
  for (const p of vparts) {
    const { cls } = p.info;
    if (cls < ROAD.SECONDARY || cls > ROAD.LIVING || cls === ROAD.LINK || p.fw < 1.3 || p.info.flags & ROAD_FLAG.BRIDGE) continue;
    const share = p.profile ? (p.profile.handcarts || 0) * 0.7 : district(p.pts[0][0], p.pts[0][1]).shops >= 0.9 ? 0.16 : 0;
    if (!share) continue;
    const s = p.s || (p.s = arcLengths(p.pts)), L = s[s.length - 1];
    for (const side of [1, -1]) {
      for (let t = 10 + (p.id % 17); t < L - 8; t += 30 + R(p.id * side + t, 61) * 40) {
        if (R(p.id + t * 3 + side, 62) > share) continue;
        const n = R(t + p.id, 63) < 0.35 ? 2 : 1, heading = R(t * 7 + side, 64) < 0.5 ? 0 : Math.PI;
        for (let k = 0; k < n; k++) {
          const q = pointAt(p.pts, s, t + k * 3.1), off = p.hw + 0.62, x = q.x - q.dz * side * off, z = q.z + q.dx * side * off;
          if (!free(x, z, 0.65) || !clearOf(x, z, 1.6)) break;
          push({ kind: POINT.HANDCART, x, z, angle: Math.atan2(q.dx, q.dz) + heading, size: 1 });
        }
      }
    }
  }

  // ------------------------------------------------------------------ compound gates (lib/walls.mjs)
  for (const g of o.gates) if (inBox(g.x, g.z)) out.push({ kind: POINT.GATE, x: g.x, z: g.z, angle: g.angle, size: 1 });

  o.log?.(`street clutter: ${count(POINT.NAME_BOARD)} street-name boards, ${count(POINT.DIR_BOARD)} direction boards, ${count(POINT.DIR_GANTRY)} gantries, ${count(POINT.UNIPOLE)} unipoles, ${count(POINT.CABLES)} cable bundles, ${count(POINT.TARP)} lane tarps, ${count(POINT.STALL_TARP)} stall tarps, ${shrines} shrines, ${count(POINT.FLOWERS)} flower sellers, ${count(POINT.SHAMIANA)} puja canopies, ${count(POINT.HANDCART)} handcarts, ${count(POINT.GATE)} gates`);
  return out;
}
