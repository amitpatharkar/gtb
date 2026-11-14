import * as THREE from 'three';
import { POSE, FLAG, outfit } from './people.js';
import { Y } from '../world/levels.js';
import { trainLoad, waiting, stationWeight, COACH_LOAD } from './railDemand.js';

// Mumbai's suburban locals. Trains run on the real tracks (tiles/trains.json from the map
// converter: one polyline per track and direction, with its stations), stop at the real
// stations and exist only near the player. Where a train is depends on the time alone: every
// line has a run profile (accelerate, cruise, brake, wait at each platform) and a train leaves
// every `period` seconds, so trains never bunch up, arrivals at a terminus leave again as the
// service in the other direction, and nothing has to be simulated out of sight. The game
// clock only thins the timetable (peak, off-peak, no trains from 1:15 to 4:15 am).
// All coaches of all trains are one instanced mesh (one draw call): cab ends and pantographs
// are part of the coach geometry and are collapsed in the vertex shader where not wanted.

const COACHES = 12, PITCH = 21.0, LEN = COACHES * PITCH; // a 12-car rake: 20.73 m coaches, about 252 m over the couplers
const BODY = 10.36, BOGIE = 7.2, HALF_W = 1.83, FLOOR = 1.2; // half body length, bogie centres, half width (3.66 m), floor above rail
const RAIL_Y = Y.KERB + 0.2;                               // top of the rails drawn by the tile mesher
const VMAX = 19.4, ACC = 0.9, DEC = 1.0;                   // 70 km/h; peak acceleration and braking (m/s²)
const DWELL = 20, TURN = 30;                               // seconds at a platform (about 20 s in Mumbai); at a terminus before leaving again
const HEADWAY = 150;                                       // seconds between trains on one track at peak hours
const MASS = 400000;                                       // kg: nothing on the road argues with a local
const DOORS = [-6.6, 0, 6.6], DOOR_HALF = 0.75;
// What each coach is, counted from the town end (Churchgate / CSMT) of a 12-car rake. The
// order is fixed per line and painted on every platform; no primary diagram was found, so this
// is the research notes' approximation: Western Railway's ladies coaches towards the Virar end,
// Central and Harbour with four first-class coaches and the luggage / senior-citizen coach 6th
// from CSMT, compartments for people with disabilities next to the cabs.
// 0 general, 1 first class, 2 ladies, 3 ladies first class, 4 luggage / senior citizens, 5 disabled.
export const COACH_CLASS = {
  W: [5, 0, 0, 1, 0, 0, 1, 0, 0, 2, 3, 4],
  C: [5, 0, 1, 2, 0, 4, 1, 0, 3, 0, 1, 5],
  H: [5, 0, 1, 2, 0, 4, 1, 0, 3, 0, 1, 5],
};
export const CLASS_NAME = ['General', 'First class', 'Ladies', 'Ladies first class', 'Luggage', 'Disabled'];
const AC_SHARE = { W: 0.1, C: 0.1, H: 0.05 };              // about 147 of Western Railway's 1,414 weekday services are AC (2026); Central 92 + 28 Harbour of 1,820
const ROUTE_NO = { W: 1, C: 2, H: 3 };            // about 109 of Western Railway's 1,406 weekday services are AC
const LIVERY = { W: 0x6b3fa0, C: 0x1d5ea8, H: 0x8c2b2b };  // violet, blue, maroon bands on white
const MAP_COLOUR = { W: '#7a3fb0', C: '#1f6fbf', H: '#9b2f2f' };
const SHOUT = ['Arre! Patri pe kaun hai?! Hato!', 'Line cross mat karo, bhai!', 'Yeh platform nahi hai, boss!', 'Horn sunai nahi diya kya?!', 'Local kisi ke liye nahi rukti!', 'Signal dekha karo, saheb!'];
const RUN = ['Train aa rahi hai! Bhaago!', 'Jaldi, jaldi! Local aa gayi!', 'Phatak band hone wala hai!'];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = (a, b = 0, c = 0) => { const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return s - Math.floor(s); };
const rupees = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/** How much of the timetable runs at this hour: 1 every train, 2 every second one…, 0 none. */
function service(hour) {
  if (hour >= 1.25 && hour < 4.25) return 0;
  if ((hour >= 7.5 && hour < 11.5) || (hour >= 16.5 && hour < 21)) return 1;
  return hour >= 6 && hour < 23 ? 2 : 4;
}

class Line {
  constructor(j, index) {
    Object.assign(this, { index, id: j.id, route: j.route, name: j.name, fast: !!j.fast, dir: j.dir, from: j.from, to: j.to, start: !!j.start, end: !!j.end, turn: j.turn, single: j.single || 0 });
    const n = j.pts.length / 2;
    this.x = new Float64Array(n); this.z = new Float64Array(n); this.cum = new Float64Array(n);
    this.box = [Infinity, Infinity, -Infinity, -Infinity];
    for (let i = 0, x = 0, z = 0; i < n; i++) {
      x += j.pts[i * 2]; z += j.pts[i * 2 + 1];
      this.x[i] = x / 10; this.z[i] = z / 10;
      if (i) this.cum[i] = this.cum[i - 1] + Math.hypot(this.x[i] - this.x[i - 1], this.z[i] - this.z[i - 1]);
      this.box = [Math.min(this.box[0], x / 10), Math.min(this.box[1], z / 10), Math.max(this.box[2], x / 10), Math.max(this.box[3], z / 10)];
    }
    this.len = this.cum[n - 1];
    this.livery = new THREE.Color(LIVERY[this.route] ?? 0x555555);
    this.stations = j.stations.map(([name, d, side, off], i) => {
      const p = this.at(d / 10);
      return { name, d: d / 10, side, off: off / 10, line: this, i, x: p[0], z: p[1], fx: p[2], fz: p[3] };
    });
    if (!this.stations.length) this.start = this.end = false;
    this.plan();
  }

  /** Point at distance d along the line: out = [x, z, dirX, dirZ] (straight on beyond the ends). */
  at(d, out = [0, 0, 0, 0]) {
    const c = this.cum;
    let lo = 1, hi = c.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (c[m] < d) lo = m + 1; else hi = m; }
    const l = c[lo] - c[lo - 1] || 1, f = (d - c[lo - 1]) / l, dx = this.x[lo] - this.x[lo - 1], dz = this.z[lo] - this.z[lo - 1];
    out[0] = this.x[lo - 1] + dx * f; out[1] = this.z[lo - 1] + dz * f; out[2] = dx / l; out[3] = dz / l;
    return out;
  }

  /** Nearest point of the line to (x, z) between distances d0 and d1: [distance along, distance away]. */
  locate(x, z, d0 = 0, d1 = Infinity) {
    let best = Infinity, at = 0;
    for (let i = 1; i < this.cum.length; i++) {
      if (this.cum[i] < d0 || this.cum[i - 1] > d1) continue;
      const ax = this.x[i - 1], az = this.z[i - 1], dx = this.x[i] - ax, dz = this.z[i] - az, l2 = dx * dx + dz * dz || 1;
      const t = clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1), dd = Math.hypot(x - ax - dx * t, z - az - dz * t);
      if (dd < best) { best = dd; at = this.cum[i - 1] + Math.sqrt(l2) * t; }
    }
    return [at, best];
  }

  /**
   * The run profile: legs of { t0, T, s0, s1, v, Ta, Tc, Tb } — ease up to speed v over Ta
   * (smoothstep, so the pull-away and the stop are gentle), cruise for Tc, ease down over Tb —
   * and waits at platforms. s is the position of the middle of the train.
   */
  plan() {
    const legs = [], st = this.stations;
    let t = 0;
    const run = (s0, s1, fromRest, toRest) => {
      const D = s1 - s0, k = 0.75 * ((fromRest ? 1 / ACC : 0) + (toRest ? 1 / DEC : 0));
      const v = k && VMAX * VMAX * k > D ? Math.sqrt(D / k) : VMAX; // a short hop never reaches full speed
      const Ta = fromRest ? (1.5 * v) / ACC : 0, Tb = toRest ? (1.5 * v) / DEC : 0, Tc = Math.max(0, (D - (v * (Ta + Tb)) / 2) / v);
      legs.push({ t0: t, T: Ta + Tc + Tb, s0, s1, v, Ta, Tc, Tb, station: -1 });
      t += Ta + Tc + Tb;
    };
    // From a terminus the train starts at rest at its platform; otherwise it rolls in from the map's edge.
    let s = this.start ? st[0].d : -LEN / 2 - 4, rest = this.start;
    for (let i = this.start ? 1 : 0; i < st.length; i++) {
      run(s, st[i].d, rest, true);
      s = st[i].d; rest = true;
      const last = this.end && i === st.length - 1;
      if (last) this.arrive = t;
      legs.push({ t0: t, T: last ? TURN : DWELL, s0: s, s1: s, v: 0, Ta: 0, Tc: last ? TURN : DWELL, Tb: 0, station: i });
      t += last ? TURN : DWELL;
    }
    if (!this.end) run(s, this.len + LEN / 2 + 4, rest, false);
    this.legs = legs; this.dur = t;
  }

  /** Where a train is `tau` seconds after it set off: out.s (m), out.v (m/s), out.leg. */
  state(tau, out) {
    const L = this.legs;
    let lo = 0, hi = L.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (L[m].t0 <= tau) lo = m; else hi = m - 1; }
    const g = L[lo], t = clamp(tau - g.t0, 0, g.T);
    if (t < g.Ta) { const u = t / g.Ta; out.s = g.s0 + g.v * g.Ta * (u * u * u - (u * u * u * u) / 2); out.v = g.v * u * u * (3 - 2 * u); }
    else if (t < g.Ta + g.Tc || !g.Tb) { out.s = g.s0 + (g.v * g.Ta) / 2 + g.v * (t - g.Ta); out.v = g.v; }
    else { const u = Math.max(0, (g.T - t) / g.Tb); out.s = g.s1 - g.v * g.Tb * (u * u * u - (u * u * u * u) / 2); out.v = g.v * u * u * (3 - 2 * u); }
    out.leg = g; out.left = g.T - t;
    return out;
  }

  /** Seconds after setting off at which the middle of the train reaches distance s. */
  timeAt(s) {
    const o = {};
    let a = 0, b = this.dur;
    for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (this.state(m, o).s < s) a = m; else b = m; }
    return b;
  }
}

// ---------------------------------------------------------------- coach model
/**
 * One EMU coach, about 500 triangles: white body with the line's colour band, a dark window
 * band (lit at night), three open doorways a side that you can see through, grey roof,
 * underframe and bogies; plus a driving cab on the +z end (windscreen, yellow panel with red
 * stripes, headlamp, tail lamps, destination board) and a pantograph, shown per coach.
 * aPart = (group: 0 coach, 1 cab, 2 pantograph; kind: 0 paint, 1 line colour, 2 window,
 * 3 headlamp, 4 interior, 5 destination board, 6 marker / tail lamp).
 */
function coachGeometry() {
  const P = [], N = [], C = [], A = [];
  const rgb = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
  const tri = (a, b, c, col, g, k, want) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    if (nx * want[0] + ny * want[1] + nz * want[2] < 0) { [b, c] = [c, b]; nx = -nx; ny = -ny; nz = -nz; }
    for (const p of [a, b, c]) { P.push(p[0], p[1], p[2]); N.push(nx, ny, nz); C.push(col[0], col[1], col[2]); A.push(g, k); }
  };
  const quad = (a, b, c, d, col, g, k, want) => { tri(a, b, c, col, g, k, want); tri(a, c, d, col, g, k, want); };
  // Rectangles on planes of constant x, y or z, facing `dir` (±1) along that axis.
  const px = (x, y0, y1, z0, z1, col, dir, g = 0, k = 0) => quad([x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1], col, g, k, [dir, 0, 0]);
  const py = (y, x0, x1, z0, z1, col, dir, g = 0, k = 0) => quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], col, g, k, [0, dir, 0]);
  const pz = (z, x0, x1, y0, y1, col, dir, g = 0, k = 0) => quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], col, g, k, [0, 0, dir]);
  const box = (x0, x1, y0, y1, z0, z1, col, g = 0, k = 0, skip = '') => {
    if (!skip.includes('x')) { px(x0, y0, y1, z0, z1, col, -1, g, k); px(x1, y0, y1, z0, z1, col, 1, g, k); }
    if (!skip.includes('b')) py(y0, x0, x1, z0, z1, col, -1, g, k);
    if (!skip.includes('t')) py(y1, x0, x1, z0, z1, col, 1, g, k);
    if (!skip.includes('n')) pz(z0, x0, x1, y0, y1, col, -1, g, k);
    if (!skip.includes('f')) pz(z1, x0, x1, y0, y1, col, 1, g, k);
  };
  const W = HALF_W, SOLE = 1.05, EAVE = 3.2, HEAD = 3.1;
  const white = rgb(0xe9e6dc), line = rgb(0xffffff), glass = rgb(0x18222c), dark = rgb(0x242426), roof = rgb(0x8d9093), under = rgb(0x1c1c1e), inside = rgb(0xb9c2ad), floor = rgb(0x4a4640), steel = rgb(0xb4b8bc);
  // Roof: an arc from eave to eave.
  const arc = [];
  for (let i = 0; i <= 8; i++) { const a = ((i / 8) * 2 - 1) * (Math.PI / 2); arc.push([W * Math.sin(a), EAVE + 0.58 * Math.cos(a)]); }
  const roofStrip = (z0, z1, col, g) => { for (let i = 0; i < 8; i++) { const [xa, ya] = arc[i], [xb, yb] = arc[i + 1]; quad([xa, ya, z0], [xa, ya, z1], [xb, yb, z1], [xb, yb, z0], col, g, 0, [(xa + xb) / 2, 1.2, 0]); } };
  const roofCap = (z, col, dir, g) => { for (let i = 0; i < 8; i++) tri([0, EAVE, z], [arc[i][0], arc[i][1], z], [arc[i + 1][0], arc[i + 1][1], z], col, g, 0, [0, 0, dir]); };
  roofStrip(-BODY, BODY, roof, 0);
  box(-0.5, 0.5, 3.76, 3.86, -8, 8, rgb(0x7c7f82), 0, 0, 'b'); // ventilator duct along the roof
  // Side walls between the doorways: sole bar, colour stripe, white, the window band in the line's colour, white.
  const edges = [-BODY, ...DOORS.flatMap((d) => [d - DOOR_HALF, d + DOOR_HALF]), BODY];
  for (const sx of [-1, 1]) {
    for (let p = 0; p < edges.length; p += 2) {
      const z0 = edges[p], z1 = edges[p + 1];
      px(sx * W, SOLE, FLOOR, z0, z1, dark, sx);
      px(sx * W, FLOOR, 1.36, z0, z1, line, sx, 0, 1);
      px(sx * W, 1.36, 2.0, z0, z1, white, sx, 0, 7); // class band: white, first-class stripes, ladies lime (shader)
      px(sx * W, 2.0, 2.9, z0, z1, line, sx, 0, 1);
      px(sx * W, 2.9, EAVE, z0, z1, white, sx);
      const n = Math.floor((z1 - z0) / 1.35), step = (z1 - z0) / n;
      for (let w = 0; w < n; w++) px(sx * (W + 0.012), 2.12, 2.78, z0 + step * (w + 0.5) - 0.47, z0 + step * (w + 0.5) + 0.47, glass, sx, 0, 2);
    }
    for (const d of DOORS) { px(sx * W, SOLE, FLOOR, d - DOOR_HALF, d + DOOR_HALF, dark, sx); px(sx * W, HEAD, EAVE, d - DOOR_HALF, d + DOOR_HALF, white, sx); }
  }
  // Sliding doors of the AC rakes (group 3, collapsed on the others): two leaves per doorway,
  // kind 8 slides towards -z and kind 9 towards +z as the doors open.
  const leafGrey = rgb(0xc9ccd0), leafGlass = rgb(0x1a242e);
  for (const sx of [-1, 1]) for (const d of DOORS) for (const [k, za, zb] of [[8, d - DOOR_HALF, d], [9, d, d + DOOR_HALF]]) {
    px(sx * (W - 0.03), FLOOR, 2.05, za, zb, leafGrey, sx, 3, k);
    px(sx * (W - 0.03), 2.05, 2.8, za, zb, leafGlass, sx, 3, k);
    px(sx * (W - 0.03), 2.8, HEAD, za, zb, leafGrey, sx, 3, k);
  }
  // Doorways: a passage right across the coach (floor, ceiling, partitions) with a grab pole.
  for (const d of DOORS) {
    py(FLOOR, -W, W, d - DOOR_HALF, d + DOOR_HALF, floor, 1, 0, 4);
    py(HEAD, -W, W, d - DOOR_HALF, d + DOOR_HALF, inside, -1, 0, 4);
    pz(d - DOOR_HALF, -W, W, FLOOR, HEAD, inside, 1, 0, 4);
    pz(d + DOOR_HALF, -W, W, FLOOR, HEAD, inside, -1, 0, 4);
    box(-0.03, 0.03, FLOOR, HEAD, d - 0.03, d + 0.03, steel, 0, 0, 'bt');
  }
  // Ends and the gangway bellows between coaches.
  for (const sz of [-1, 1]) {
    pz(sz * BODY, -W, W, SOLE, EAVE, rgb(0xcfccc3), sz);
    roofCap(sz * BODY, rgb(0xcfccc3), sz, 0);
    box(-0.75, 0.75, FLOOR, 3.05, sz > 0 ? BODY : -BODY - 0.25, sz > 0 ? BODY + 0.25 : -BODY, rgb(0x121212), 0, 0, sz > 0 ? 'bn' : 'bf');
  }
  // Underframe, equipment boxes, bogies and wheels.
  box(-1.4, 1.4, 0.8, SOLE, -9.7, 9.7, under, 0, 0, 't');
  box(-1.3, 1.3, 0.42, 0.8, -3.6, -1.0, dark, 0, 0, 't');
  box(-1.3, 1.3, 0.42, 0.8, 0.4, 3.4, dark, 0, 0, 't');
  for (const zb of [-BOGIE, BOGIE]) {
    box(-1.25, 1.25, 0.34, 0.76, zb - 1.55, zb + 1.55, under, 0, 0, 't');
    for (const sx of [-1, 1]) for (const zw of [zb - 1.25, zb + 1.25]) {
      for (let i = 0; i < 8; i++) {
        const a0 = (i / 8) * Math.PI * 2, a1 = ((i + 1) / 8) * Math.PI * 2;
        tri([sx * 0.95, 0.46, zw], [sx * 0.95, 0.46 + Math.sin(a0) * 0.46, zw + Math.cos(a0) * 0.46], [sx * 0.95, 0.46 + Math.sin(a1) * 0.46, zw + Math.cos(a1) * 0.46], rgb(0x4a4a4e), 0, 0, [sx, 0, 0]);
      }
    }
  }
  // Driving cab (group 1): a nose on the +z end.
  const NOSE = BODY + 0.35, yellow = rgb(0xf0c419), red = rgb(0xc4261d), cream = rgb(0xece8dc);
  for (const sx of [-1, 1]) {
    px(sx * W, SOLE, EAVE, BODY, NOSE, cream, sx, 1);
    // Cab side: plain panel over the last windows, a small cab window, louvres of the motor room, yellow wrap-round.
    px(sx * (W + 0.02), 2.0, 2.9, DOORS[2] + DOOR_HALF, BODY, line, sx, 1, 1);
    px(sx * (W + 0.03), 2.15, 2.8, 8.95, 9.7, glass, sx, 1);
    px(sx * (W + 0.03), 2.15, 2.75, 7.45, 8.55, rgb(0x3b3d40), sx, 1);
    px(sx * (W + 0.02), 1.12, 2.0, 9.45, NOSE, yellow, sx, 1);
  }
  roofStrip(BODY, NOSE, roof, 1);
  pz(NOSE, -W, W, SOLE, EAVE, cream, 1, 1);
  roofCap(NOSE, cream, 1, 1);
  pz(NOSE + 0.012, -1.78, 1.78, 1.12, 2.02, yellow, 1, 1);
  for (const y of [1.28, 1.66]) pz(NOSE + 0.02, -1.78, 1.78, y, y + 0.16, red, 1, 1);
  for (const sx of [-1, 1]) {
    pz(NOSE + 0.012, sx > 0 ? 0.08 : -1.62, sx > 0 ? 1.62 : -0.08, 2.12, 3.02, rgb(0x0e141a), 1, 1);
    pz(NOSE + 0.028, sx * 1.4 - 0.11, sx * 1.4 + 0.11, 1.47, 1.63, rgb(0xffffff), 1, 1, 6);
  }
  pz(NOSE + 0.012, -0.62, 0.62, 3.06, 3.19, rgb(0xff8a1e), 1, 1, 5);
  pz(NOSE + 0.012, -0.17, 0.17, 3.3, 3.52, rgb(0xffffff), 1, 1, 3);
  box(-1.5, 1.5, 0.72, SOLE, BODY, NOSE + 0.1, rgb(0x161618), 1, 0, 't');
  box(-0.18, 0.18, 0.78, 1.0, NOSE + 0.1, NOSE + 0.4, rgb(0x101012), 1);
  // Pantograph (group 2): base frame, two arms and the collector head.
  const grey = rgb(0x4d5257);
  box(-0.7, 0.7, 3.78, 3.86, 3.4, 5.6, grey, 2, 0, 'b');
  const beam = (a, b, t) => {
    // A thin bar in the y-z plane from a to b.
    const dy = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dy, dz), ny = (-dz / l) * t, nz = (dy / l) * t;
    for (const sx of [-1, 1]) quad([sx * t, a[0] + ny, a[1] + nz], [sx * t, b[0] + ny, b[1] + nz], [sx * t, b[0] - ny, b[1] - nz], [sx * t, a[0] - ny, a[1] - nz], grey, 2, 0, [sx, 0, 0]);
    for (const s of [-1, 1]) quad([-t, a[0] + ny * s, a[1] + nz * s], [t, a[0] + ny * s, a[1] + nz * s], [t, b[0] + ny * s, b[1] + nz * s], [-t, b[0] + ny * s, b[1] + nz * s], grey, 2, 0, [0, ny * s, nz * s]);
  };
  beam([3.86, 5.4], [4.55, 3.8], 0.04);
  beam([4.55, 3.8], [5.25, 4.75], 0.035);
  box(-0.85, 0.85, 5.24, 5.3, 4.6, 4.9, rgb(0x2a2c2e), 2);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  geo.setAttribute('aPart', new THREE.Float32BufferAttribute(A, 2));
  return geo;
}

export class Trains {
  /** Loads tiles/trains.json; resolves to null when the map has no train lines. */
  static async create(ctx) {
    const res = await fetch(ctx.tiles?.fileUrl ? ctx.tiles.fileUrl('trains.json') : `${ctx.base}tiles/trains.json`).catch(() => null);
    if (!res?.ok) return null;
    const json = await res.json();
    if (!json.lines?.length) return null;
    const t = new Trains(ctx, json);
    // Compile the coach shader before the first train comes into view (no hitch then).
    // ctx.compile (post.compile) picks the variant the post-processing pipeline draws.
    await (ctx.compile ? ctx.compile(t.mesh) : ctx.renderer?.compileAsync?.(t.mesh, ctx.camera, ctx.scene))?.catch(() => {});
    return t;
  }

  constructor(ctx, json) {
    Object.assign(this, ctx); // scene, tiles, traffic, street, people, bubbles, audio, hud, state, clock, walker, player, view, snap, renderer, camera
    this.lines = json.lines.map((j, i) => new Line(j, i));
    this.timetable(json.crossings);
    this.t = 0;
    this.lastX = this.lastZ = 1e9;
    this.trains = new Map();   // key "line:k" → train near the player
    this.fresh = true;         // first look, or after a ride: everything in range appears at once
    this.scanT = 0;
    this.tmp = {};
    this.a = [0, 0, 0, 0]; this.b = [0, 0, 0, 0];
    this.rIn = clamp((this.tiles.loadRadius || 700) + 400, 900, 1100); // trains appear in the haze at this range…
    this.rOut = this.rIn + 250;                                         // …and are dropped beyond this
    this.max = 20 * COACHES;

    const geo = coachGeometry();
    const inst = (n) => new THREE.InstancedBufferAttribute(new Float32Array(this.max * n), n).setUsage(THREE.DynamicDrawUsage);
    this.livery = inst(3); this.opt = inst(4); this.opt2 = inst(4);
    geo.setAttribute('aLivery', this.livery);
    geo.setAttribute('aOpt', this.opt);
    geo.setAttribute('aOpt2', this.opt2);
    this.uNight = { value: 0 };
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.2 });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uNight = this.uNight;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
          attribute vec2 aPart; attribute vec3 aLivery; attribute vec4 aOpt; // aOpt: cab, pantograph, lamps (1 front, -1 rear), doors lit
          attribute vec4 aOpt2; // coach class (COACH_CLASS), AC rake, doors open (0–1), load
          uniform float uNight; varying vec3 vGlow; varying vec3 vLocal; varying float vCls; varying float vBand;`)
        .replace('#include <color_vertex>', `#include <color_vertex>
          if (aPart.y > 0.5 && aPart.y < 1.5) vColor.rgb *= aLivery;
          if (aPart.y < 0.5 || (aPart.y > 6.5 && aPart.y < 7.5)) vColor.rgb *= mix(vec3(1.0), vec3(0.8, 0.82, 0.86), aOpt2.y); // AC rakes: brushed steel
          vLocal = position; vCls = aOpt2.x; vBand = aPart.y > 6.5 && aPart.y < 7.5 ? 1.0 : 0.0;
          vGlow = aPart.y > 6.5 || aPart.y < 1.5 ? vec3(0.0)
            : aPart.y < 2.5 ? vec3(1.0, 0.86, 0.6) * uNight * 1.5
            : aPart.y < 3.5 ? (aOpt.z > 0.5 ? vec3(1.0, 0.95, 0.82) * (1.2 + 7.0 * uNight) : vec3(0.0))
            : aPart.y < 4.5 ? vec3(1.0, 0.9, 0.7) * uNight * 0.3
            : aPart.y < 5.5 ? vec3(1.0, 0.45, 0.06) * (0.7 + 1.6 * uNight)
            : (aOpt.z > 0.5 ? vec3(1.0, 0.9, 0.7) : aOpt.z < -0.5 ? vec3(1.0, 0.04, 0.02) : vec3(0.0)) * (0.6 + 2.4 * uNight);`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          if (aPart.y > 7.5) transformed.z += (aPart.y < 8.5 ? -1.0 : 1.0) * aOpt2.z * ${(DOOR_HALF * 0.96).toFixed(3)};
          transformed *= aPart.x < 0.5 ? 1.0 : aPart.x < 1.5 ? aOpt.x : aPart.x < 2.5 ? aOpt.y : aOpt2.y; // cab, pantograph, AC doors only where wanted`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vGlow; varying vec3 vLocal; varying float vCls; varying float vBand;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          if (vBand > 0.5 && vCls > 0.5) {
            // First class: red and yellow diagonal stripes; ladies: lime; luggage: grey; disabled: blue.
            float st = step(0.5, fract((vLocal.z + vLocal.y) * 1.6));
            vec3 c = vCls < 1.5 ? mix(vec3(0.75, 0.08, 0.06), vec3(0.95, 0.75, 0.1), st)
              : vCls < 2.5 ? vec3(0.45, 0.78, 0.16)
              : vCls < 3.5 ? mix(vec3(0.45, 0.78, 0.16), vec3(0.75, 0.08, 0.06), st)
              : vCls < 4.5 ? vec3(0.42, 0.4, 0.37) : vec3(0.12, 0.35, 0.75);
            diffuseColor.rgb = c * c;
          }`)
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vGlow;');
    };
    mat.customProgramCacheKey = () => 'gtb-train-v2';
    this.mesh = new THREE.InstancedMesh(geo, mat, this.max);
    this.mesh.count = 0;
    this.mesh.castShadow = this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false; // instances move across the city; a stale bounding sphere would hide them
    this.scene.add(this.mesh);

    // Every stop of every line (for tickets, crowds and map markers), and the network graph.
    this.stops = this.lines.flatMap((L) => L.stations);
    this.names = [...new Set(this.stops.map((s) => s.name))];
    this.graph = new Map(this.names.map((n) => [n, new Map()]));
    for (const L of this.lines) for (let i = 1; i < L.stations.length; i++) {
      const a = L.stations[i - 1], b = L.stations[i], d = b.d - a.d;
      for (const [u, v] of [[a.name, b.name], [b.name, a.name]]) if (!(this.graph.get(u).get(v) <= d)) this.graph.get(u).set(v, d);
    }
    const looks = ['office', 'casual', 'casual', 'sari', 'worker', 'office', 'casual', 'sari'];
    this.looks = Array.from({ length: 24 }, (_, i) => ({ ...outfit(looks[i % looks.length]), flags: looks[i % looks.length] === 'sari' ? FLAG.SARI : 0 }));
    this.pool = []; this.poolN = 0;
    this.crossings = []; this.clusters = [];
    this.xAt = { x: 1e9, z: 1e9, v: -1 };
    this.here = null;          // the station the player is standing at
    this.hereT = 0; this.hornT = 0; this.clackT = 0; this.bellT = 0; this.shoutT = 0;
    this.lowTier = ctx.tier?.name === 'Low';
  }

  /**
   * Departure times. Lines that end on the same terminal track take turns to arrive, `h`
   * seconds apart, and each arrival leaves again after `turn` seconds as its return service;
   * `h` (the same for every line, so the whole timetable repeats) is long enough for the
   * leaving train to clear the single track before the next one comes in.
   * Flyovers are flat in the game, so lines cross each other on the level: the start times of
   * the groups and their waits at the terminus are then chosen so that no two trains are on a
   * crossing together (a small search; `this.clash` is what could not be avoided, in seconds
   * per round of the timetable).
   */
  timetable(crossings) {
    const lines = this.lines, groups = [];
    for (const U of lines) {
      const D = lines[U.turn];
      if (!D || U.arrive == null) continue;
      const key = `${Math.round(D.x[0])},${Math.round(D.z[0])}`;
      let g = groups.find((o) => o.key === key);
      if (!g) groups.push(g = { key, ups: [], need: 0, base: 0, turn: TURN });
      g.ups.push(U);
      // Seconds for a departure to clear the single track, plus those the next arrival spends on it.
      g.need = Math.max(g.need, D.timeAt(U.single + LEN / 2 + 20) + U.arrive - U.timeAt(U.len - U.single - LEN / 2 - 20) + 8);
    }
    const h = Math.ceil(Math.max(HEADWAY, ...groups.map((g) => g.need + TURN)) / 5) * 5;
    this.headway = h;
    const apply = (g) => g.ups.forEach((U, j) => {
      const D = lines[U.turn];
      U.g = D.g = g; U.period = D.period = g.ups.length * h;
      U.offset = g.base + j * h - U.arrive;
      D.offset = g.base + j * h + g.turn;
    });
    groups.forEach((g, i) => { g.base = (i * 47) % h; apply(g); });
    for (const L of lines) if (L.period == null) { L.period = h; L.offset = L.index * 23; }

    // When a train of each line is on each crossing: [line, start (s after it set off), seconds].
    const win = (L, d) => { const t0 = L.timeAt(d - LEN / 2 - 15); return [t0, L.timeAt(d + LEN / 2 + 15) - t0]; };
    const X = (crossings || []).map(([a, da, b, db]) => [lines[a], lines[b], win(lines[a], da / 10), win(lines[b], db / 10)])
      .filter(([A, B]) => A && B && A.g !== B.g || (A.g && A.turn !== B.index && B.turn !== A.index));
    const lap = (A, wa, B, wb) => {
      // Seconds per round that two trains (one of each line) are on the crossing together.
      const P = Math.max(A.period, B.period);
      let sum = 0;
      for (let i = 0; i < P / A.period; i++) for (let j = 0; j < P / B.period; j++) {
        let d = (B.offset + wb[0] + j * B.period - A.offset - wa[0] - i * A.period) % P;
        if (d < 0) d += P;
        sum += Math.max(0, Math.min(wa[1], d + wb[1]) - d) + Math.max(0, Math.min(wa[1], d - P + wb[1]) - Math.max(0, d - P));
      }
      return sum;
    };
    const cost = (g) => { let c = 0; for (const [A, B, wa, wb] of X) if (!g || A.g === g || B.g === g) c += lap(A, wa, B, wb); return c; };
    for (let round = 0; round < 3 && cost() > 0.01; round++) {
      for (const g of groups) {
        let best = { c: cost(g), base: g.base, turn: g.turn };
        for (let turn = TURN - 5; turn <= Math.min(TURN + 45, h - g.need) && best.c > 0.01; turn += 5) {
          for (let base = 0; base < g.ups.length * h && best.c > 0.01; base += 3) {
            g.base = base; g.turn = turn; apply(g);
            const c = cost(g);
            if (c < best.c - 1e-6) best = { c, base, turn };
          }
        }
        g.base = best.base; g.turn = best.turn; apply(g);
      }
    }
    this.clash = cost();
    // The wait at the terminus is part of the arriving line's run.
    for (const g of groups) for (const U of g.ups) { const last = U.legs[U.legs.length - 1]; last.T = last.Tc = g.turn; U.dur = U.arrive + g.turn; }
  }

  scheduled(k, q) { return q > 0 && ((k % q) + q) % q === 0; }

  // ---------------------------------------------------------------- frame
  update(dt, active, onFoot) {
    this.t += dt;
    const P = active.pos, night = this.clock.night;
    this.uNight.value = night;
    this.structuresV = this.structures?.version;
    // A jump (tow, cheat, mission): the trains already near the new place are simply there.
    if (Math.hypot(P.x - this.lastX, P.z - this.lastZ) > 150) { this.fresh = true; this.scanT = 0; }
    this.lastX = P.x; this.lastZ = P.z;
    this.scanT -= dt;
    if (this.scanT <= 0) { this.scanT = 0.5; this.scan(P); }

    const M = this.mesh.instanceMatrix.array, LV = this.livery.array, OP = this.opt.array, O2 = this.opt2.array, a = this.a, b = this.b, st = this.tmp;
    let n = 0, nearest = null, nd = 1e9;
    for (const tr of this.trains.values()) {
      let L = tr.line, tau = this.t - L.offset - tr.k * L.period;
      if (tau >= L.dur) {
        // End of the line: at a terminus the same rake leaves as the return service.
        const D = L.end ? this.lines[L.turn] : null;
        this.trains.delete(tr.key);
        if (!D) continue;
        tr.line = L = D; tr.key = `${D.index}:${tr.k}`; tr.flip ^= 1; tr.hornFor = -1;
        this.trains.set(tr.key, tr);
        tau = this.t - L.offset - tr.k * L.period;
      }
      L.state(tau, st);
      const was = tr.leg;
      tr.s = st.s; tr.v = st.v; tr.leg = st.leg; tr.left = st.left;
      if (!((tr.loadT -= dt) > 0)) { tr.loadT = 2; tr.load = this.loadOf(tr); }
      // AC rakes open their doors a moment after stopping and close them before leaving.
      if (tr.leg.station >= 0) { const inT = tr.leg.T - tr.left; tr.doors = clamp((inT - 1.2) / 1.6, 0, 1) * clamp((tr.left - 2.5) / 1.6, 0, 1); } else tr.doors = 0;
      if (!tr.ac) tr.doors = tr.v < 0.3 ? 1 : 0.5; // the others never close their doors
      L.at(clamp(tr.s, 0, L.len), a);
      tr.x = a[0]; tr.z = a[1];
      const d = Math.hypot(tr.x - P.x, tr.z - P.z);
      if (d > this.rOut) { this.trains.delete(tr.key); continue; }
      tr.n = 0;
      for (let i = 0; i < COACHES; i++) {
        const c = tr.s + LEN / 2 - PITCH / 2 - i * PITCH;
        tr.on[i] = 0;
        if (c < BODY + 0.4 || c > L.len - BODY - 0.4 || n >= this.max) continue; // not on the map (yet)
        L.at(c - BOGIE, a); L.at(c + BOGIE, b);
        const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, x = (a[0] + b[0]) / 2, z = (a[1] + b[1]) / 2;
        let sn = dx / l, cs = dz / l;
        tr.cx[i] = x; tr.cz[i] = z; tr.sn[i] = sn; tr.cs[i] = cs; tr.on[i] = 1; tr.n++;
        // End coaches face outwards (cab at the far end); the others keep facing the way they were built.
        if (i === COACHES - 1 || (tr.flip && i > 0)) { sn = -sn; cs = -cs; }
        const o = n * 16;
        M[o] = cs; M[o + 1] = 0; M[o + 2] = -sn; M[o + 3] = 0; M[o + 4] = 0; M[o + 5] = 1; M[o + 6] = 0; M[o + 7] = 0;
        M[o + 8] = sn; M[o + 9] = 0; M[o + 10] = cs; M[o + 11] = 0; M[o + 12] = x; M[o + 13] = RAIL_Y; M[o + 14] = z; M[o + 15] = 1;
        LV[n * 3] = L.livery.r; LV[n * 3 + 1] = L.livery.g; LV[n * 3 + 2] = L.livery.b;
        const end = i === 0 || i === COACHES - 1;
        OP[n * 4] = end ? 1 : 0; OP[n * 4 + 1] = i % 3 === 1 ? 1 : 0; OP[n * 4 + 2] = i === 0 ? 1 : i === COACHES - 1 ? -1 : 0; OP[n * 4 + 3] = 0;
        const phys = L.dir === 'up' ? i : COACHES - 1 - i; // counted from the town end
        O2[n * 4] = (COACH_CLASS[L.route] || COACH_CLASS.C)[phys]; O2[n * 4 + 1] = tr.ac ? 1 : 0; O2[n * 4 + 2] = tr.ac ? tr.doors : 0; O2[n * 4 + 3] = 0;
        if (tr.ac) { LV[n * 3] = 0.16; LV[n * 3 + 1] = 0.36; LV[n * 3 + 2] = 0.72; } // AC locals: a blue band
        n++;
      }
      if (!tr.n) continue;
      // Sounds and manners: a horn before each platform, a hiss when it stops.
      const g = tr.leg;
      if (g !== was && was) {
        if (g.station >= 0 && d < 260) { this.hiss(1 / (1 + d / 40)); this.announce(tr, d); }
      }
      if (g.station < 0 && g.Tb && tr.left < g.Tb + 4 && tr.hornFor !== g && d < 420) { tr.hornFor = g; this.horn(1 / (1 + d / 90)); }
      if (tr.v > 1 && d < nd + LEN / 2) { const dd = this.gap(tr, P.x, P.z); if (dd < nd) { nd = dd; nearest = tr; } }
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = this.livery.needsUpdate = this.opt.needsUpdate = this.opt2.needsUpdate = true;

    this.hornT -= dt; this.shoutT -= dt;
    this.sounds(dt, nearest, nd);
    this.shove(dt, P, onFoot);
    this.levelCrossings(dt, P);
    this.riders(P);
    this.stationLife(dt, P, onFoot);
    this.fresh = false;
  }

  /** Which timetable slots are in range of the player: make their trains. */
  scan(P) {
    const q = service(this.clock.hour), st = this.tmp, a = this.a, R = this.rIn;
    for (const L of this.lines) {
      if (P.x < L.box[0] - R || P.x > L.box[2] + R || P.z < L.box[1] - R || P.z > L.box[3] + R) continue;
      const k1 = Math.floor((this.t - L.offset) / L.period), k0 = Math.ceil((this.t - L.offset - L.dur) / L.period);
      for (let k = k0; k <= k1; k++) {
        const key = `${L.index}:${k}`;
        if (this.trains.has(key) || (key !== this.force && !this.scheduled(k, q))) continue;
        L.state(this.t - L.offset - k * L.period, st);
        L.at(clamp(st.s, 0, L.len), a);
        const d = Math.hypot(a[0] - P.x, a[1] - P.z);
        // New trains come in from the haze (or from the map's edge); never out of thin air close by.
        if (d > R || !(this.fresh || key === this.force || d > R - 220 || (!L.start && st.s < 0))) continue;
        const ac = hash(ROUTE_NO[L.route] || 4, L.fast ? 7 : 3, k) < (AC_SHARE[L.route] ?? 0.05);
        this.trains.set(key, { line: L, k, key, flip: 0, seed: hash(L.index, k), ac, doors: 0, s: st.s, v: st.v, leg: null, left: 0, x: a[0], z: a[1], n: 0, hornFor: -1,
          cx: new Float64Array(COACHES), cz: new Float64Array(COACHES), sn: new Float32Array(COACHES), cs: new Float32Array(COACHES), on: new Uint8Array(COACHES), h: 4.4 });
      }
    }
  }

  /** Distance from (x, z) to the nearest coach of a train (to its centre line, along its length). */
  gap(tr, x, z) {
    let best = 1e9;
    for (let i = 0; i < COACHES; i++) {
      if (!tr.on[i]) continue;
      const dx = x - tr.cx[i], dz = z - tr.cz[i], al = clamp(dx * tr.sn[i] + dz * tr.cs[i], -PITCH / 2, PITCH / 2);
      const d = Math.hypot(dx - tr.sn[i] * al, dz - tr.cs[i] * al);
      if (d < best) best = d;
    }
    return best;
  }

  /** The coach of any train that a circle touches: [train, coach index], or null. */
  touch(x, z, r) {
    for (const tr of this.trains.values()) {
      if (!tr.n || (x - tr.x) ** 2 + (z - tr.z) ** 2 > (LEN / 2 + 16 + r) ** 2) continue;
      for (let i = 0; i < COACHES; i++) {
        if (!tr.on[i]) continue;
        const dx = x - tr.cx[i], dz = z - tr.cz[i];
        if (Math.abs(dx * tr.sn[i] + dz * tr.cs[i]) < PITCH / 2 + (i === 0 || i === COACHES - 1 ? 0.3 : 0) + r * 0.6 && Math.abs(dx * tr.cs[i] - dz * tr.sn[i]) < HALF_W + r) return [tr, i];
      }
    }
    return null;
  }

  /** Trains are solid for vehicles and people (world.hits / footWorld.hits in main.js). */
  hits(x, z, r) { return !!this.touch(x, z, r); }

  /** A train as a physics body for the player's car (see car.js): far too heavy to push. */
  bodyAt(x, z, r) {
    const hit = this.touch(x, z, r);
    if (!hit) return null;
    const [tr, i] = hit;
    return { train: tr, mass: MASS, vx: tr.sn[i] * tr.v, vz: tr.cs[i] * tr.v, push() {} };
  }

  /**
   * A moving train does not stop for anything on the track: the player's vehicle is shoved
   * aside and dented, the player on foot is knocked over, traffic is pushed out of the way.
   */
  shove(dt, P, onFoot) {
    const car = this.player, w = this.walker, cars = this.traffic.cars;
    for (const tr of this.trains.values()) {
      if (tr.v < 1 || !tr.n) continue;
      const reach = LEN / 2 + 20;
      // Push something of radius r at (x, z) sideways out of the train's way: [nx, nz, depth] or null.
      const out = (x, z, r) => {
        if ((x - tr.x) ** 2 + (z - tr.z) ** 2 > reach * reach) return null;
        for (let i = 0; i < COACHES; i++) {
          if (!tr.on[i]) continue;
          const dx = x - tr.cx[i], dz = z - tr.cz[i], al = dx * tr.sn[i] + dz * tr.cs[i], lat = dx * tr.cs[i] - dz * tr.sn[i];
          if (al < -PITCH / 2 || al > PITCH / 2 + (i === 0 ? 0.4 + tr.v * dt : 0) || Math.abs(lat) > HALF_W + r) continue;
          let side = lat >= 0 ? 1 : -1;
          const depth = HALF_W + r + 0.15 - Math.abs(lat);
          // Never into a wall: try the other side of the train.
          if (this.tiles.hits(x + tr.cs[i] * side * (depth + 0.3), z - tr.sn[i] * side * (depth + 0.3), r * 0.6)) side = -side;
          return [tr.cs[i] * side, -tr.sn[i] * side, side * lat >= 0 ? depth : 2 * (HALF_W + r) - depth, tr.sn[i], tr.cs[i]];
        }
        return null;
      };
      // The player's vehicle (also when it stands empty on the track).
      const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
      for (const o of car.circles || [car.halfLength, -car.halfLength]) {
        const hit = out(car.pos.x + fx * o, car.pos.z + fz * o, car.radius);
        if (!hit) continue;
        const [nx, nz, depth, tx, tz] = hit, step = Math.min(depth, 1.6);
        car.pos.x += nx * step; car.pos.z += nz * step;
        const rel = Math.hypot((car.vx || 0) - tx * tr.v, (car.vz || 0) - tz * tr.v);
        car.vx = (car.vx || 0) * 0.4 + tx * tr.v * 0.45 + nx * 5; car.vz = (car.vz || 0) * 0.4 + tz * tr.v * 0.45 + nz * 5;
        car.lastSpeed = NaN; // keep this velocity (see Car.update)
        if (!(tr.hitT > 0)) {
          car.impact = Math.max(car.impact || 0, 4 + rel * 0.6);
          car.impactLocal = [clamp(-(nx * -fz + nz * fx), -0.8, 0.8), o < 0 ? -1 : 1];
          car.condition = Math.max(0, car.condition - 0.03 - rel * 0.004);
          this.shout(tr);
          tr.hitT = 1.2;
        }
        break;
      }
      tr.hitT = Math.max(0, (tr.hitT || 0) - dt);
      // The player on foot: knocked down beside the track (no worse than a bruise and a scolding).
      if (onFoot && w.down <= 0) {
        const hit = out(w.pos.x, w.pos.z, 0.35);
        if (hit) {
          w.pos.x += hit[0] * (hit[2] + 0.5); w.pos.z += hit[1] * (hit[2] + 0.5);
          w.knock(0.12 + tr.v * 0.012);
          this.audio.punch?.(1);
          this.shout(tr);
        }
      }
      // Traffic caught on a crossing, and anything parked or left on the track: slid aside
      // (gently enough that riders keep their seats).
      if ((tr.x - P.x) ** 2 + (tr.z - P.z) ** 2 > 480 * 480) continue;
      for (const [kind, list] of [['traffic', cars], ['parked', this.traffic.parked], ['left', this.traffic.left]]) {
        for (let i = list.length - 1; i >= 0; i--) {
          const c = list[i], T = this.traffic.types[c.type], hit = out(c.x, c.z, (T?.wid ?? 1.6) / 2 + 0.3);
          if (!hit) continue;
          const [nx, nz, depth] = hit, dv = T?.rider ? 1.6 : 4.5;
          c.x += nx * Math.min(depth, 1.5); c.z += nz * Math.min(depth, 1.5);
          if (c.knock > 0) continue;
          this.traffic.shove(c, kind, nx * dv, nz * dv, c.x - nx, c.z - nz);
          if (kind === 'traffic' && c.seg && c.knock > 0) this.clearCrossing(c);
        }
      }
      // People on the track step (or are bundled) clear.
      for (const p of this.street.peds) {
        if (p.free) continue;
        const hit = out(p.x, p.z, 0.4);
        if (hit) { p.ox += hit[0] * (hit[2] + 0.3); p.oz += hit[1] * (hit[2] + 0.3); }
      }
    }
  }

  /**
   * A driver knocked about on a level crossing gets back on the road beyond it (traffic.js
   * steers a shunted car back to its place on its road, which would be on the tracks again).
   */
  clearCrossing(c) {
    const x = this.clusters.find((q) => (q.x - c.x) ** 2 + (q.z - c.z) ** 2 < (q.rad + 4) ** 2);
    if (!x || !(c.seg.len > 0) || !(c.t >= 0)) return;
    const s = c.seg.s, fx = ((s[2] - s[0]) / c.seg.len) * c.dir, fz = ((s[3] - s[1]) / c.seg.len) * c.dir;
    const need = x.rad + 6 - ((c.x - x.x) * fx + (c.z - x.z) * fz);
    if (need > 0) c.t += need / c.seg.len; // traffic.js moves it on to the next road piece if this runs past the end
  }

  shout(tr) {
    this.horn(1);
    if (this.shoutT > 0) return;
    this.shoutT = 4;
    const i = tr.on[0] ? 0 : tr.on.indexOf(1);
    if (i < 0) return;
    this.bubbles.say({ x: tr.cx[i] + tr.sn[i] * 9, y: RAIL_Y, z: tr.cz[i] + tr.cs[i] * 9, h: 4.4 }, SHOUT[Math.floor(Math.random() * SHOUT.length)], 3, 'driver');
  }

  /** A stopping train says where it is going (seen from the platform). */
  announce(tr, d) {
    if (d > 110 || !tr.on[0]) return;
    const L = tr.line, last = L.end && tr.leg.station === L.stations.length - 1;
    const to = last ? this.lines[L.turn]?.to : L.to;
    if (to) this.bubbles.say({ x: tr.cx[0], y: RAIL_Y, z: tr.cz[0], h: 4.6 }, `${to} ${(last ? this.lines[L.turn] : L).fast ? 'fast' : 'slow'}!`, 4);
  }

  // ---------------------------------------------------------------- level crossings
  /**
   * Road bridges over the railway are flat for now, so roads cross the tracks on the level.
   * Where vehicle roads cross a train line near the player, traffic and pedestrians wait while
   * a train is coming or passing: stop obstacles for traffic.js on the way in (those already
   * on the crossing drive off it), and the 'wait' state for pedestrians.
   */
  findCrossings(P) {
    this.xAt = { x: P.x, z: P.z, v: this.traffic.graphVersion };
    const R = 330, cell = 60, grid = new Map(), found = [];
    for (const L of this.lines) {
      if (P.x < L.box[0] - R || P.x > L.box[2] + R || P.z < L.box[1] - R || P.z > L.box[3] + R) continue;
      for (let i = 1; i < L.x.length; i++) {
        const x0 = Math.min(L.x[i - 1], L.x[i]), x1 = Math.max(L.x[i - 1], L.x[i]), z0 = Math.min(L.z[i - 1], L.z[i]), z1 = Math.max(L.z[i - 1], L.z[i]);
        if (x0 > P.x + R || x1 < P.x - R || z0 > P.z + R || z1 < P.z - R) continue;
        const piece = [L, i];
        for (let gx = Math.floor(Math.max(x0, P.x - R) / cell); gx <= Math.floor(Math.min(x1, P.x + R) / cell); gx++)
          for (let gz = Math.floor(Math.max(z0, P.z - R) / cell); gz <= Math.floor(Math.min(z1, P.z + R) / cell); gz++) {
            const k = (gx + 4096) * 8192 + gz + 4096;
            (grid.get(k) || grid.set(k, []).get(k)).push(piece);
          }
      }
    }
    if (grid.size) for (const seg of this.traffic.segList || []) {
      const s = seg.s, x0 = Math.min(s[0], s[2]), x1 = Math.max(s[0], s[2]), z0 = Math.min(s[1], s[3]), z1 = Math.max(s[1], s[3]);
      if (x0 > P.x + R || x1 < P.x - R || z0 > P.z + R || z1 < P.z - R) continue;
      const seen = new Set();
      for (let gx = Math.floor(x0 / cell); gx <= Math.floor(x1 / cell); gx++) for (let gz = Math.floor(z0 / cell); gz <= Math.floor(z1 / cell); gz++) {
        for (const piece of grid.get((gx + 4096) * 8192 + gz + 4096) || []) {
          if (seen.has(piece)) continue;
          seen.add(piece);
          const [L, i] = piece, ax = L.x[i - 1], az = L.z[i - 1], bx = L.x[i] - ax, bz = L.z[i] - az, rx = s[2] - s[0], rz = s[3] - s[1];
          const den = rx * bz - rz * bx;
          if (Math.abs(den) < 1e-6) continue;
          const u = ((ax - s[0]) * bz - (az - s[1]) * bx) / den, v = ((ax - s[0]) * rz - (az - s[1]) * rx) / den;
          if (u < 0 || u > 1 || v < 0 || v > 1) continue;
          found.push({ x: s[0] + rx * u, z: s[1] + rz * u, line: L, d: L.cum[i - 1] + v * Math.hypot(bx, bz), seg, c: -1 });
        }
      }
    }
    // Crossings within 30 m of each other are one level crossing (a road over several tracks).
    const clusters = [];
    for (const f of found) {
      if (f.c >= 0) continue;
      const list = [f];
      f.c = clusters.length;
      for (let i = 0; i < list.length; i++) for (const o of found) if (o.c < 0 && Math.hypot(o.x - list[i].x, o.z - list[i].z) < 30) { o.c = f.c; list.push(o); }
      const cx = list.reduce((s, o) => s + o.x, 0) / list.length, cz = list.reduce((s, o) => s + o.z, 0) / list.length;
      const gates = [], done = new Set();
      let rad = 0;
      for (const o of list) {
        rad = Math.max(rad, Math.hypot(o.x - cx, o.z - cz) + o.seg.s[4] + 3.5);
        if (done.has(o.seg)) continue;
        done.add(o.seg);
        const s = o.seg.s, dx = (s[2] - s[0]) / o.seg.len, dz = (s[3] - s[1]) / o.seg.len, hw = s[4], oneway = s[5] & 2;
        // The stretch of this road that lies on the tracks; stop lines 6.5 m before the first track's centre.
        let a0 = Infinity, a1 = -Infinity;
        for (const q of list) {
          const qx = q.x - s[0], qz = q.z - s[1];
          if (Math.abs(qx * dz - qz * dx) > hw + 12) continue;
          const al = qx * dx + qz * dz;
          a0 = Math.min(a0, al); a1 = Math.max(a1, al);
        }
        // Left-hand traffic: the way in is on the left half of the road for each direction.
        for (let off = oneway ? -1.5 : 0.9; off <= hw + 0.4; off += 2.4) {
          gates.push([s[0] + dx * (a0 - 6.5) + dz * off, s[1] + dz * (a0 - 6.5) - dx * off, 1]);
          if (!oneway) gates.push([s[0] + dx * (a1 + 6.5) - dz * off, s[1] + dz * (a1 + 6.5) + dx * off, 1]);
        }
      }
      clusters.push({ x: cx, z: cz, rad, list, gates, closed: false });
    }
    this.crossings = found; this.clusters = clusters;
  }

  levelCrossings(dt, P) {
    // The search (a few ms) waits a moment after the road graph changes, and never runs in a
    // frame in which tiles were loaded (that frame already rebuilt the traffic graph).
    if (this.xWait == null && (this.traffic.graphVersion !== this.xAt.v || Math.hypot(P.x - this.xAt.x, P.z - this.xAt.z) > 120)) this.xWait = 0.3;
    const tv = this.tiles.version, loaded = tv !== this.tileV;
    this.tileV = tv;
    if (this.xWait != null && (this.xWait -= dt) <= 0 && !loaded) { this.xWait = null; this.findCrossings(P); this.parkedSeen = null; }
    if (!this.clusters.length) return;
    // Nobody parks on a level crossing (traffic.js lines the kerbs of wide roads with parked cars).
    if (this.traffic.parked !== this.parkedSeen) {
      this.traffic.parked = this.parkedSeen = this.traffic.parked.filter((v) => !this.clusters.some((c) => (v.x - c.x) ** 2 + (v.z - c.z) ** 2 < (c.rad + 4) ** 2));
    }
    for (const c of this.clusters) c.closed = false;
    for (const tr of this.trains.values()) {
      if (!tr.n || Math.hypot(tr.x - P.x, tr.z - P.z) > 330 + LEN) continue;
      const rear = tr.s - LEN / 2 - 8, front = tr.s + LEN / 2 + Math.max(tr.v, 6) * 11 + 20; // about 12 s of warning at full speed
      for (const f of this.crossings) if (f.line === tr.line && f.d > rear && f.d < front) this.clusters[f.c].closed = true;
    }
    let bell = 1e9;
    for (const c of this.clusters) {
      if (!c.closed) continue;
      for (const g of c.gates) this.traffic.obstacles.push(g);
      bell = Math.min(bell, Math.hypot(c.x - P.x, c.z - P.z));
      for (const p of this.street.peds) {
        if (p.free || (p.state !== 'walk' && p.state !== 'wait')) continue;
        const dx = c.x - p.x, dz = c.z - p.z, d = Math.hypot(dx, dz);
        if (d > c.rad + 2.2) continue;
        if (d < c.rad - 0.4) {
          // Already on the crossing: hurry across.
          if (p.state === 'walk') { p.t += (p.speed * 1.6 * dt) / p.seg.len; p.phase += dt * p.speed * 6; if (!p.ran && Math.random() < 0.3) this.bubbles.say(p, RUN[Math.floor(Math.random() * RUN.length)], 2); p.ran = true; }
        } else if (Math.sin(p.heading) * dx + Math.cos(p.heading) * dz > 0) { p.state = 'wait'; p.timer = 0.4; p.ran = false; }
      }
    }
    this.bellT -= dt;
    if (bell < 90 && this.bellT <= 0) { this.bellT = 0.42; this.bell(1 / (1 + bell / 25)); }
  }

  // ---------------------------------------------------------------- people
  person() { return this.pool[this.poolN++] || (this.pool[this.poolN - 1] = { noHero: true, amp: 1, phase: 0, scale: 1, flags: 0 }); }

  /** Load of a train (1 = full, ~1.4 crush) by the hour, its direction and how far into town it is. */
  loadOf(tr) {
    const L = tr.line, toTown = L.dir === 'up';
    return trainLoad({ hour: this.clock.hour, toTown, fromTown: toTown ? L.len - tr.s : tr.s, lineLen: L.len, fast: L.fast, weekend: this.weekend() });
  }

  weekend() { return ((this.state?.s.day ?? 1) % 7) === 0; } // every seventh game day is a Sunday

  /**
   * Commuters in the open doorways of coaches near the player: how many depends on how full
   * the train is (the hour, the direction, the kind of coach); at crush load they hang out of
   * the doors holding the pole. AC locals show people only while the doors are open.
   */
  riders(P) {
    this.poolN = 0;
    const cap = this.lowTier ? 70 : 150;
    for (const tr of this.trains.values()) {
      if (!tr.n || (tr.x - P.x) ** 2 + (tr.z - P.z) ** 2 > (LEN / 2 + 70) ** 2) continue;
      if (tr.ac && tr.doors < 0.3) continue;
      const load = tr.load ??= this.loadOf(tr), cls = COACH_CLASS[tr.line.route] || COACH_CLASS.C, up = tr.line.dir === 'up';
      for (let i = 0; i < COACHES && this.poolN < cap; i++) {
        if (!tr.on[i] || (tr.cx[i] - P.x) ** 2 + (tr.cz[i] - P.z) ** 2 > 60 * 60) continue;
        const phys = up ? i : COACHES - 1 - i, l = load * COACH_LOAD[cls[phys]] * (tr.ac ? 0.8 : 1);
        const tx = up ? tr.sn[i] : -tr.sn[i], tz = up ? tr.cs[i] : -tr.cs[i]; // towards the town end
        const look0 = Math.floor(hash(tr.seed * 91 + phys) * 977), ladies = cls[phys] === 2 || cls[phys] === 3;
        for (let dr = 0; dr < 3; dr++) for (const side of [-1, 1]) {
          if (this.rider && this.rider.tr === tr && this.rider.phys === phys && this.rider.a === DOORS[dr] && this.rider.l === side) continue;
          const r0 = hash(tr.seed * 91 + phys, dr, side), inDoor = Math.min(4, Math.floor(l * 2.6 + r0)), hang = !tr.ac && l > 1.12 ? Math.min(2, Math.floor((l - 1.05) * 6 + r0)) : 0;
          for (let k = 0; k < inDoor + hang && this.poolN < cap; k++) {
            const r = hash(r0 * 13 + k, phys, dr), out = k >= inDoor;
            const look = this.looks[(look0 + k * 7 + dr * 3) % this.looks.length];
            const p = this.person();
            const along = DOORS[dr] + (out ? (k - inDoor - 0.5) * 0.55 : (r - 0.5) * 1.2), lat = side * (out ? HALF_W + 0.18 : HALF_W - 0.3 - (k % 2) * 0.55);
            p.x = tr.cx[i] + tx * along - tz * lat; p.z = tr.cz[i] + tz * along + tx * lat; p.y = RAIL_Y + FLOOR;
            p.heading = out ? Math.atan2(tx * (tr.v > 0.5 ? 1 : 0) - tz * side, tz * (tr.v > 0.5 ? 1 : 0) + tx * side) : Math.atan2(-tz * side, tx * side) + (r - 0.5) * 2;
            p.pose = out ? POSE.POINT : POSE.STAND; p.phase = this.t * 1.5 + r * 40;
            p.shirt = look.shirt; p.pants = look.pants; p.skin = look.skin; p.scale = 0.94 + (r * 7 % 1) * 0.1;
            p.flags = ladies ? FLAG.SARI : look.flags;
            this.people.add(p);
          }
        }
      }
    }
  }

  /** Seconds since the last train of line L left stop s (from the timetable alone). */
  sinceTrain(s, q) {
    const L = s.line, leg = this.dwell(s), P = L.period * Math.max(1, q);
    let d = (this.t - L.offset - leg.t0 - leg.T) % P;
    if (d < 0) d += P;
    return d;
  }

  /**
   * People on the platforms near the player: as many as the hour, the direction and the size
   * of the station bring, growing until the next train takes them away. When a train stands at
   * the platform they hurry to its doors and are gone; those getting off walk away along the
   * platform.
   */
  stationLife(dt, P, onFoot) {
    this.hereT -= dt;
    const q = service(this.clock.hour);
    if (this.hereT <= 0) {
      this.hereT = 0.5;
      let here = null, hd = 14;
      const busy = [];
      for (const s of this.stops) {
        const d = Math.hypot(s.x - P.x, s.z - P.z);
        if (d > 190) { s.crowd = null; continue; }
        const [, away] = s.line.locate(P.x, P.z, s.d - 135, s.d + 135);
        if (away < hd) { hd = away; here = s; }
        if (d > 150 || !s.side) continue;
        busy.push(s);
      }
      busy.sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z));
      busy.length = Math.min(busy.length, 6);
      const capAll = this.lowTier ? 70 : 170;
      let used = 0;
      for (const s of busy) {
        const toTown = s.line.dir === 'up';
        const want = !q ? 0 : Math.min(this.lowTier ? 30 : 60, capAll - used, Math.round(waiting({ name: s.name, hour: this.clock.hour, toTown, sinceTrain: this.sinceTrain(s, q), weekend: this.weekend() }) * 0.55));
        used += want;
        this.fillPlatform(s, want);
      }
      for (const s of this.busy || []) if (!busy.includes(s)) s.crowd = null;
      this.busy = busy;
      if (here && here.name !== this.here?.name && onFoot && !this.rider) this.hud.message(`🚆 ${here.name} station (${here.line.name}) — E: ticket window · F at an open train door: board`);
      this.here = onFoot ? here : null;
    }
    // Trains standing at these platforms: people board and get off.
    for (const s of this.busy || []) {
      let at = null;
      for (const tr of this.trains.values()) if (tr.line === s.line && tr.leg?.station === s.i && tr.n) { at = tr; break; }
      if (at && at !== s.served) { s.served = at; this.alighting(s, at); }
      if (!at) s.served = null;
      const doorsOpen = at && (!at.ac || at.doors > 0.6);
      for (let k = s.crowd.length - 1; k >= 0; k--) {
        const p = s.crowd[k];
        if (p.mode === 0 && doorsOpen && p.door == null) this.toDoor(p, s, at);
        if (p.mode === 0) { p.phase += dt * 2; this.people.add(p); continue; }
        // Walking: to a door (and in), or away along the platform after getting off.
        const dx = p.tx - p.x, dz = p.tz - p.z, d = Math.hypot(dx, dz), step = p.speed * dt;
        if (d < 0.5 || (p.mode === 1 && !doorsOpen) || (p.life -= dt) < 0) {
          if (p.mode === 1 && !doorsOpen && d >= 0.5) { p.mode = 0; p.door = null; p.pose = POSE.STAND; } // missed it: wait for the next one
          else { s.crowd.splice(k, 1); continue; }
        } else {
          p.x += (dx / d) * Math.min(step, d); p.z += (dz / d) * Math.min(step, d);
          p.heading = Math.atan2(dx, dz); p.phase += dt * p.speed * 4.3;
          p.y = this.floorY(p.x, p.z, p.y);
        }
        this.people.add(p);
      }
    }
    if (this.tickets?.cfg?.where === 'window' && this.tickets.cfg.from !== this.here?.name) this.tickets.close();
  }

  /** Floor height for someone on a platform (the raised platform if there is one here). */
  floorY(x, z, y = 1.5) {
    const g = this.tiles.groundHeight(x, z);
    return this.structures ? this.structures.groundHeight(x, z, Math.max(y, 1.4), g) : g;
  }

  /** Bring the people waiting on a platform to `want` (keeping those already there). */
  fillPlatform(s, want) {
    s.crowd ||= [];
    const waitingN = s.crowd.reduce((n, p) => n + (p.mode === 0 ? 1 : 0), 0);
    if (s.crowdV !== this.tiles.version || s.crowdS !== this.structuresV) { s.crowd = s.crowd.filter((p) => p.mode !== 0); s.crowdV = this.tiles.version; s.crowdS = this.structuresV; }
    let have = s.crowd.reduce((n, p) => n + (p.mode === 0 ? 1 : 0), 0);
    if (have > want + 4) { let drop = have - want; s.crowd = s.crowd.filter((p) => p.mode !== 0 || drop-- <= 0); have = want; }
    void waitingN;
    for (let k = 0; have < want && k < want * 3; k++) {
      const r = hash(s.x + k * 3.1, s.z, (s.seedN = (s.seedN || 0) + 1));
      const side = s.side === 2 ? (r < 0.5 ? -1 : 1) : s.side;
      // Thickest around the middle of the platform (the foot-overbridge stairs), thinning to the ends.
      const along = (hash(s.z, k, s.seedN) - 0.5) * (hash(k, s.x, 7) < 0.6 ? 110 : 230);
      const p0 = s.line.at(s.d + along), off = s.off + 0.3 + hash(k, s.seedN, 2) * (r < 0.3 ? 4.5 : 2.2);
      const x = p0[0] - p0[3] * side * off, z = p0[1] + p0[2] * side * off; // right of travel is (-dirZ, dirX)
      if (this.tiles.hits(x, z, 0.3) || this.structures?.hits(x, z, 0.3, 1.4)) continue;
      const look = this.looks[Math.floor(r * 991) % this.looks.length];
      s.crowd.push({ noHero: hash(k, s.seedN) > 0.25, mode: 0, x, z, y: this.floorY(x, z), heading: Math.atan2(p0[3] * side, -p0[2] * side) + (hash(k, s.x) - 0.5) * 1.6, pose: r * 17 % 1 < 0.15 ? POSE.ARGUE : POSE.STAND, phase: r * 30, amp: 1, flags: look.flags, scale: 0.93 + (r * 5 % 1) * 0.12, shirt: look.shirt, pants: look.pants, skin: look.skin, h: 2.1, speed: 1.4, door: null });
      have++;
    }
  }

  /** A waiting passenger heads for the nearest door of the train at the platform (if near enough). */
  toDoor(p, s, tr) {
    let best = null, bd = 26;
    for (let i = 0; i < COACHES; i++) {
      if (!tr.on[i] || (tr.cx[i] - p.x) ** 2 + (tr.cz[i] - p.z) ** 2 > 40 * 40) continue;
      for (const a of DOORS) {
        const cx = tr.cx[i] + tr.sn[i] * a, cz = tr.cz[i] + tr.cs[i] * a;
        const lat = (p.x - cx) * tr.cs[i] - (p.z - cz) * tr.sn[i], side = lat >= 0 ? 1 : -1;
        const x = cx + tr.cs[i] * side * (HALF_W - 0.2), z = cz - tr.sn[i] * side * (HALF_W - 0.2), d = Math.hypot(x - p.x, z - p.z);
        if (d < bd) { bd = d; best = [x, z]; }
      }
    }
    if (!best) { p.door = false; return; }
    p.door = true; p.mode = 1; p.tx = best[0]; p.tz = best[1];
    p.speed = 1.5 + hash(p.x, p.z) * 1.6; p.pose = POSE.WALK; p.life = 14;
  }

  /** People getting off a train that has just stopped near the player. */
  alighting(s, tr) {
    if (Math.hypot(tr.x - this.lastX, tr.z - this.lastZ) > 170 || !s.side) return;
    const load = tr.load ?? this.loadOf(tr), w = stationWeight(s.name);
    const n = Math.min(this.lowTier ? 14 : 34, Math.round(load * w * 9));
    for (let k = 0; k < n; k++) {
      const i = Math.floor(hash(k, tr.seed, 5) * COACHES);
      if (!tr.on[i]) continue;
      const a = DOORS[k % 3], side = s.side === 2 ? (k % 2 ? 1 : -1) : s.side;
      // Platform side of the track, in this line's travel frame: right of travel is (-dirZ, dirX).
      const nx = -tr.cs[i] * side, nz = tr.sn[i] * side;
      const x = tr.cx[i] + tr.sn[i] * a + nx * (HALF_W + 0.3), z = tr.cz[i] + tr.cs[i] * a + nz * (HALF_W + 0.3);
      const dir = hash(k, 3, tr.seed) < 0.5 ? -1 : 1, go = 25 + hash(k, tr.seed) * 60;
      const look = this.looks[(k * 5 + 3) % this.looks.length];
      s.crowd.push({ noHero: true, mode: 2, x, z, y: this.floorY(x, z), tx: x + tr.sn[i] * dir * go + nx * (2 + hash(k, 9) * 3), tz: z + tr.cs[i] * dir * go + nz * (2 + hash(k, 9) * 3), heading: 0, pose: POSE.WALK, phase: k, amp: 1, flags: look.flags, scale: 0.95, shirt: look.shirt, pants: look.pants, skin: look.skin, h: 2.1, speed: 1.3 + hash(k, 2) * 0.9, life: 16 + hash(k) * 8 });
    }
  }

  // ---------------------------------------------------------------- tickets and rides
  /** Shortest rail distance (m) from one station to every other. */
  routes(from) {
    const dist = new Map([[from, { d: 0 }]]), todo = new Set(this.names);
    while (todo.size) {
      let u = null;
      for (const n of todo) if (dist.has(n) && (u === null || dist.get(n).d < dist.get(u).d)) u = n;
      if (u === null) break;
      todo.delete(u);
      for (const [v, w] of this.graph.get(u)) if (!dist.has(v) || dist.get(u).d + w < dist.get(v).d) dist.set(v, { d: dist.get(u).d + w });
    }
    return dist;
  }

  /** When a train stands at a stop, in seconds after it set off: { t0, T } (a departing train waits at its terminus before time 0). */
  dwell(s) { return s.line.legs.find((g) => g.station === s.i) || { t0: -(s.line.g?.turn ?? TURN), T: s.line.g?.turn ?? TURN }; }

  /** Second-class fare by distance. */
  fare(d) { return d <= 4000 ? 5 : d <= 10000 ? 10 : d <= 18000 ? 15 : 20; }

  /** Seconds until the next trains stop at a station: [[seconds, line], …], soonest first. */
  nextTrains(name) {
    const q = service(this.clock.hour), out = [];
    if (!q) return out;
    for (const s of this.stops) {
      if (s.name !== name) continue;
      const L = s.line, leg = this.dwell(s);
      if (L.end && s.i === L.stations.length - 1) continue; // arrivals at a terminus go nowhere
      const P = L.period * q, k = Math.ceil((this.t - L.offset - leg.t0 - leg.T + 6) / P);
      out.push([L.offset + k * P + leg.t0 - this.t, L]);
    }
    return out.sort((a, b) => a[0] - b[0]);
  }

  /** E on foot at a station: the booking office. Returns false when there is no station here. */
  interact() {
    const s = this.here;
    if (!s || this.rider || !this.tickets) return false;
    if (this.tickets.isOpen) { this.tickets.close(); return true; }
    const q = service(this.clock.hour);
    const next = this.nextTrains(s.name).slice(0, 3).map(([sec, L]) => `${L.to} ${L.fast ? 'fast' : 'slow'} ${sec < 8 ? 'now' : `in ${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`}`).join(' · ');
    this.tickets.open({
      title: `🚆 ${s.name} — booking office`, sub: q ? `Next trains: ${next || '—'}` : 'The last local has gone; first train at 4:15 am. The machine still sells tickets.',
      sys: 'local', from: s.name, groups: this.ticketGroups(s.name), where: 'window',
    });
    return true;
  }

  /** Destinations from a station for the ticket panel: per route, in line order, with rail distances. */
  ticketGroups(from) {
    const dist = this.routes(from), routes = [...new Set([...this.stops.filter((o) => o.name === from).map((o) => o.line.route), 'W', 'C', 'H'])];
    return routes.filter((r) => this.lines.some((L) => L.route === r)).map((r) => {
      const names = [];
      for (const L of this.lines) if (L.route === r && !L.fast && L.dir === 'down') for (const o of L.stations) if (!names.includes(o.name)) names.push(o.name);
      for (const L of this.lines) if (L.route === r) for (const o of L.stations) if (!names.includes(o.name)) names.push(o.name);
      const line = this.lines.find((L) => L.route === r);
      return { name: line.name, colour: MAP_COLOUR[r], stops: names.filter((n) => n !== from && dist.get(n)).map((n) => ({ name: n, m: dist.get(n).d })) };
    });
  }

  /** The station nearest to (x, z) and how far it is. */
  nearestStation(x, z) {
    let best = null, bd = Infinity;
    for (const s of this.stops) { const d = Math.hypot(s.x - x, s.z - z); if (d < bd) { bd = d; best = s; } }
    return best ? { name: best.name, d: bd, stop: best } : null;
  }

  /**
   * Quick travel for tests and missions: fade, the clock moves on by the journey time, and the
   * player stands on the platform at `to` next to the train they came on.
   */
  async ride(from, o) {
    if (this.riding) return;
    this.riding = true;
    const w = this.walker, fade = document.getElementById('fade');
    fade?.classList.add('on');
    await new Promise((r) => setTimeout(r, 300));
    const stops = this.stops.filter((s) => s.name === o.name && (!o.route || s.line.route === o.route));
    const best = stops.find((s) => !s.line.fast && s.line.stations.some((p) => p.name === from && p.d < s.d)) || stops.find((s) => s.line.stations.some((p) => p.name === from && p.d < s.d)) || stops.find((s) => !s.line.fast) || stops[0];
    w.pos.set(best.x, this.tiles.groundHeight(best.x, best.z), best.z);
    w.speed = 0; w.vx = w.vz = 0;
    this.clock.hour += (o.mins || 10) / 60;
    await this.tiles.whenReady(best.x, best.z, Math.min(300, (this.tiles.loadRadius || 500) - 40));
    this.stations?.()?.buildNow(best.x, best.z);
    const L = best.line, sides = best.side === 1 || best.side === -1 ? [best.side, -best.side] : [1, -1];
    let spot = null;
    search: for (const along of [0, 18, -18, 40, -40, 70, -70]) for (const side of sides) for (const off of [best.off, best.off + 1.2, best.off + 2.6]) {
      const p = L.at(best.d + along), x = p[0] - p[3] * side * off, z = p[1] + p[2] * side * off;
      if (!this.tiles.hits(x, z, 0.4)) { spot = [x, z, Math.atan2(p[2], p[3])]; break search; }
    }
    spot ||= [best.x + best.fz * 4, best.z - best.fx * 4, 0];
    w.pos.set(spot[0], this.floorY(spot[0], spot[1]), spot[1]);
    w.heading = spot[2];
    if (this.view) this.view.yaw = spot[2];
    const leg = this.dwell(best);
    const k = Math.ceil((this.t - L.offset - leg.t0) / L.period);
    this.t = L.offset + k * L.period + leg.t0 + Math.max(2, leg.T - 9);
    this.force = `${L.index}:${k}`;
    this.trains.clear();
    this.fresh = true; this.scanT = 0; this.hereT = 0; this.here = best;
    this.snap?.();
    fade?.classList.remove('on');
    this.riding = false;
  }

  /** Stations for the full-screen map: one marker per station, in its line's colour. */
  markers() {
    return (this.marks ||= this.names.map((name) => {
      const at = this.stops.filter((s) => s.name === name);
      return { x: at.reduce((s, o) => s + o.x, 0) / at.length, z: at.reduce((s, o) => s + o.z, 0) / at.length, color: MAP_COLOUR[at[0].line.route] || '#555', icon: '🚆', r: 7, label: name };
    }));
  }

  // ---------------------------------------------------------------- sound (synthesised, like audio.js)
  sounds(dt, tr, d) {
    const A = this.audio, ctx = A.ctx;
    if (!ctx) return;
    const level = tr ? clamp(tr.v / VMAX, 0, 1) / (1 + (d / 22) ** 2) : 0;
    if (!this.rumbleNode) {
      if (level < 0.01) return;
      const src = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = A.noiseBuf(); src.loop = true;
      lp.type = 'lowpass'; lp.frequency.value = 200;
      g.gain.value = 0;
      src.connect(lp).connect(g).connect(A.master);
      src.start();
      this.rumbleNode = { lp, g };
    }
    this.rumbleNode.lp.frequency.setTargetAtTime(150 + (tr ? tr.v * 24 : 0), ctx.currentTime, 0.2);
    this.rumbleNode.g.gain.setTargetAtTime(level * 0.7, ctx.currentTime, 0.15);
    // Wheels over the rail joints: tak-tak… tak-tak.
    this.clackT -= dt;
    if (tr && d < 110 && this.clackT <= 0) {
      this.clackT = 12.5 / Math.max(tr.v, 3);
      const t0 = ctx.currentTime, vol = 0.5 / (1 + (d / 18) ** 2);
      for (const at of [0, 0.09]) {
        const src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
        src.buffer = A.noiseBuf(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 2.5;
        g.gain.setValueAtTime(vol, t0 + at); g.gain.exponentialRampToValueAtTime(0.001, t0 + at + 0.07);
        src.connect(bp).connect(g).connect(A.master); src.start(t0 + at, Math.random() * 0.3, 0.08);
      }
    }
    // A long blast when the player (or the vehicle they left) is on the track ahead of a moving train.
    if (tr && tr.on[0] && this.hornT <= 0) {
      for (const p of [this.player.pos, this.walker.pos]) {
        const dx = p.x - tr.cx[0], dz = p.z - tr.cz[0], ahead = dx * tr.sn[0] + dz * tr.cs[0];
        if (ahead > 0 && ahead < 150 && Math.abs(dx * tr.cs[0] - dz * tr.sn[0]) < 6) { this.horn(1); this.hornT = 2.5; break; }
      }
    }
  }

  /** The EMU's electric horn: a flat two-note blare. */
  horn(vol) {
    const ctx = this.audio.ctx;
    if (!ctx || vol < 0.03 || this.hornT > 1.5) return;
    this.hornT = Math.max(this.hornT, 1.6);
    const t0 = ctx.currentTime, dur = 0.85, lp = ctx.createBiquadFilter(), g = ctx.createGain();
    lp.type = 'lowpass'; lp.frequency.value = 1700;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.11 * vol, t0 + 0.04); g.gain.setValueAtTime(0.11 * vol, t0 + dur - 0.1); g.gain.linearRampToValueAtTime(0, t0 + dur);
    for (const f of [311, 392, 622]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(t0); o.stop(t0 + dur + 0.05); }
    lp.connect(g).connect(this.audio.master);
  }

  /** Brakes letting go of their air as the train stops. */
  hiss(vol) {
    const A = this.audio, ctx = A.ctx;
    if (!ctx || vol < 0.03) return;
    const t0 = ctx.currentTime, src = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = A.noiseBuf(); src.loop = true; hp.type = 'highpass'; hp.frequency.value = 3200;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.16 * vol, t0 + 0.05); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.9);
    src.connect(hp).connect(g).connect(A.master); src.start(t0); src.stop(t0 + 0.95);
  }

  /** Level-crossing bell. */
  bell(vol) {
    const ctx = this.audio.ctx;
    if (!ctx || vol < 0.03) return;
    const t0 = ctx.currentTime;
    for (const [f, a] of [[1250, 0.07], [1880, 0.035]]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(a * vol, t0); g.gain.exponentialRampToValueAtTime(0.0005, t0 + 0.3);
      o.connect(g).connect(this.audio.master); o.start(t0); o.stop(t0 + 0.32);
    }
  }
}
