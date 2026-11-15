import * as THREE from 'three';
import { floor, ramp, wall, post } from './structures.js';
import { Buf, corrugated } from './stations.js';
import { metroFare } from '../game/tickets.js';
import { trainLoad } from '../sim/railDemand.js';
import { POSE, FLAG, outfit } from '../sim/people.js';

// The Mumbai Metro and Monorail as they run in November 2026 (tiles/metro.json from
// scripts/lib/metro.mjs; research: docs/research/metro/reports/Mumbai Metro A to Z.md):
//  - Line 1 (blue), the ends of Lines 2A, 7 (yellow, red) and 2B: twin U-girders on single
//    piers, rails 13 m above the road; trains of 4 (Line 1) or 6 cars, 3.2 m wide, every 3 min
//    20 s at peak on Line 1, 5–9 min on the others; 5:30 am to about midnight.
//  - Elevated stations at the real places: concourse 7 m up with ticket counters, security and
//    fare gates, side platforms at 14 m under a roof, stairs to the street on both footpaths.
//    You walk up, buy a QR ticket (E), tap through the gate, wait, board (F), ride, get off and
//    tap out (the fare is settled at the exit gate).
//  - Line 3 (aqua) is underground: its street entrances stand where they are mapped; E at one
//    sells a ticket and takes you down for the ride, and you come up at the other station.
//  - The Monorail's beam and stations stand, but it has carried no passengers since
//    20 September 2025: trains parked, shutters down.

const RAIL = 13.0, MONO = 9.6, PLAT = RAIL + 1.05, CONC = 7.0, GROUND = 0.2;
const HALF_W = 1.6, CAR_H = 3.85, FLOORH = 1.05;              // metro car: 3.2 m wide, floor 1.05 m over the rail
const VMAX = 22, ACC = 1.0, DEC = 1.0, DWELL = 28, TURN = 90;  // 80 km/h; doors open about half a minute
const CHUNK = 400, BUILD = 750, DROP = 1050;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = (a, b = 0, c = 0) => { const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return s - Math.floor(s); };
const rupees = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Share of the timetable running at this hour (1 every train, 2 every second…, 0 none). */
function service(spec, hour) {
  if (spec.closed) return 0;
  const h = ((hour % 24) + 24) % 24;
  if (h < spec.first || h > spec.last) return 0;
  if ((h >= 7.5 && h < 11) || (h >= 17 && h < 21)) return 1;
  return Math.max(1, Math.round(spec.off / spec.peak));
}

// ---------------------------------------------------------------- a line (one direction)
class MLine {
  constructor(j, index) {
    Object.assign(this, { index, ref: j.ref, name: j.name, colour: j.colour, kind: j.kind, from: j.from, to: j.to, start: !!j.start, end: !!j.end, closed: !!j.closed, spec: j });
    const n = j.pts.length / 2;
    this.x = new Float64Array(n); this.z = new Float64Array(n); this.cum = new Float64Array(n);
    for (let i = 0, x = 0, z = 0; i < n; i++) {
      x += j.pts[i * 2]; z += j.pts[i * 2 + 1];
      this.x[i] = x / 10; this.z[i] = z / 10;
      if (i) this.cum[i] = this.cum[i - 1] + Math.hypot(this.x[i] - this.x[i - 1], this.z[i] - this.z[i - 1]);
    }
    this.len = this.cum[n - 1];
    this.cars = j.cars; this.car = j.car; this.trainLen = j.cars * j.car;
    this.rail = j.kind === 'monorail' ? MONO : RAIL;
    this.livery = new THREE.Color(j.colour);
    this.stations = j.stations.map(([name, d], i) => ({ name, d: d / 10, i, line: this }));
    this.period = j.peak;
    this.offset = (index * 37) % this.period;
    this.plan();
  }

  at(d, out = [0, 0, 0, 0]) {
    const c = this.cum;
    let lo = 1, hi = c.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (c[m] < d) lo = m + 1; else hi = m; }
    const l = c[lo] - c[lo - 1] || 1, f = (d - c[lo - 1]) / l, dx = this.x[lo] - this.x[lo - 1], dz = this.z[lo] - this.z[lo - 1];
    out[0] = this.x[lo - 1] + dx * f; out[1] = this.z[lo - 1] + dz * f; out[2] = dx / l; out[3] = dz / l;
    return out;
  }

  /** Run profile: dwell at the first station if it is a terminus, then legs and dwells (see trains.js). */
  plan() {
    const legs = [], st = this.stations, LEN = this.trainLen;
    let t = 0;
    const run = (s0, s1, fromRest, toRest) => {
      const D = s1 - s0, k = 0.75 * ((fromRest ? 1 / ACC : 0) + (toRest ? 1 / DEC : 0));
      const v = k && VMAX * VMAX * k > D ? Math.sqrt(D / k) : VMAX;
      const Ta = fromRest ? (1.5 * v) / ACC : 0, Tb = toRest ? (1.5 * v) / DEC : 0, Tc = Math.max(0, (D - (v * (Ta + Tb)) / 2) / v);
      legs.push({ t0: t, T: Ta + Tc + Tb, s0, s1, v, Ta, Tc, Tb, station: -1 });
      t += Ta + Tc + Tb;
    };
    let s, rest;
    if (this.start && st.length) { s = st[0].d; legs.push({ t0: 0, T: TURN, s0: s, s1: s, v: 0, Ta: 0, Tc: TURN, Tb: 0, station: 0 }); t = TURN; rest = true; }
    else { s = -LEN / 2 - 4; rest = false; }
    for (let i = this.start ? 1 : 0; i < st.length; i++) {
      run(s, st[i].d, rest, true);
      s = st[i].d; rest = true;
      const last = this.end && i === st.length - 1;
      legs.push({ t0: t, T: last ? TURN : DWELL, s0: s, s1: s, v: 0, Ta: 0, Tc: last ? TURN : DWELL, Tb: 0, station: i });
      t += last ? TURN : DWELL;
    }
    if (!this.end) run(s, this.len + LEN / 2 + 4, rest, false);
    this.legs = legs; this.dur = t;
  }

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
}

// ---------------------------------------------------------------- the car
/**
 * One metro car, along +z, rail at y = 0: stainless body with the line's colour band, a long
 * window band, four doors a side (sliding leaves, kinds 8/9), a cab nose (group 1).
 * aPart = (group: 0 car, 1 cab, 3 door leaves; kind: 0 body, 1 line colour, 2 window, 3 headlamp, 6 tail lamp, 8/9 leaves).
 */
function carGeometry(L) {
  const P = [], N = [], C = [], A = [];
  const col = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
  const quad = (a, b, c, d, cl, g, k, want) => {
    for (const [p, q, r] of [[a, b, c], [a, c, d]]) {
      const ux = q[0] - p[0], uy = q[1] - p[1], uz = q[2] - p[2], vx = r[0] - p[0], vy = r[1] - p[1], vz = r[2] - p[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      let tri = [p, q, r];
      if (nx * want[0] + ny * want[1] + nz * want[2] < 0) { tri = [p, r, q]; nx = -nx; ny = -ny; nz = -nz; }
      for (const v of tri) { P.push(v[0], v[1], v[2]); N.push(nx, ny, nz); C.push(cl[0], cl[1], cl[2]); A.push(g, k); }
    }
  };
  const W = HALF_W, Z = L / 2 - 0.3, y0 = 0.75, y1 = CAR_H, white = col(0xdfe2e4), glass = col(0x16202a), stripe = col(0xffffff), dark = col(0x222326), roof = col(0xb5b9bc);
  const doors = [-7.9, -2.65, 2.65, 7.9].map((d) => d * (L / 21.9)), DH = 0.7;
  const edges = [-Z, ...doors.flatMap((d) => [d - DH, d + DH]), Z];
  for (const sx of [-1, 1]) {
    for (let p = 0; p < edges.length; p += 2) {
      const z0 = edges[p], z1 = edges[p + 1];
      const side = (ya, yb, cl, k) => quad([sx * W, ya, z0], [sx * W, ya, z1], [sx * W, yb, z1], [sx * W, yb, z0], cl, 0, k, [sx, 0, 0]);
      side(y0, 1.25, white, 0); side(1.25, 1.45, stripe, 1); side(1.45, 1.75, white, 0); side(1.75, 2.85, glass, 2); side(2.85, 3.05, stripe, 1); side(3.05, y1 - 0.2, white, 0);
    }
    for (const d of doors) {
      quad([sx * W, 3.0, d - DH], [sx * W, 3.0, d + DH], [sx * W, y1 - 0.2, d + DH], [sx * W, y1 - 0.2, d - DH], white, 0, 0, [sx, 0, 0]);
      quad([sx * W, y0, d - DH], [sx * W, y0, d + DH], [sx * W, FLOORH, d + DH], [sx * W, FLOORH, d - DH], dark, 0, 0, [sx, 0, 0]);
      // Leaves: closed across the doorway; they slide apart by the doors-open fraction.
      for (const [k, za, zb] of [[8, d - DH, d], [9, d, d + DH]]) {
        quad([sx * (W - 0.02), FLOORH, za], [sx * (W - 0.02), FLOORH, zb], [sx * (W - 0.02), 1.9, zb], [sx * (W - 0.02), 1.9, za], white, 3, k, [sx, 0, 0]);
        quad([sx * (W - 0.02), 1.9, za], [sx * (W - 0.02), 1.9, zb], [sx * (W - 0.02), 2.75, zb], [sx * (W - 0.02), 2.75, za], glass, 3, k, [sx, 0, 0]);
        quad([sx * (W - 0.02), 2.75, za], [sx * (W - 0.02), 2.75, zb], [sx * (W - 0.02), 3.0, zb], [sx * (W - 0.02), 3.0, za], white, 3, k, [sx, 0, 0]);
      }
      // Inside the doorway: floor and a lit back wall (seen when open).
      quad([-W, FLOORH, d - DH], [W, FLOORH, d - DH], [W, FLOORH, d + DH], [-W, FLOORH, d + DH], col(0x5a5c60), 0, 0, [0, 1, 0]);
      quad([-sx * (W - 0.3), FLOORH, d - DH], [-sx * (W - 0.3), FLOORH, d + DH], [-sx * (W - 0.3), 3.0, d + DH], [-sx * (W - 0.3), 3.0, d - DH], col(0xc9ccc4), 0, 2, [sx, 0, 0]);
    }
  }
  // Roof (slightly curved), ends, underframe.
  const arc = [];
  for (let i = 0; i <= 6; i++) { const a = ((i / 6) * 2 - 1) * (Math.PI / 2); arc.push([W * Math.sin(a), y1 - 0.2 + 0.2 * Math.cos(a)]); }
  for (let i = 0; i < 6; i++) quad([arc[i][0], arc[i][1], -Z], [arc[i][0], arc[i][1], Z], [arc[i + 1][0], arc[i + 1][1], Z], [arc[i + 1][0], arc[i + 1][1], -Z], roof, 0, 0, [(arc[i][0] + arc[i + 1][0]) / 2, 1, 0]);
  for (const sz of [-1, 1]) quad([-W, y0, sz * Z], [W, y0, sz * Z], [W, y1 - 0.2, sz * Z], [-W, y1 - 0.2, sz * Z], col(0xcfd2d4), 0, 0, [0, 0, sz]);
  quad([-1.4, 0.35, -Z], [1.4, 0.35, -Z], [1.4, 0.35, Z], [-1.4, 0.35, Z], dark, 0, 0, [0, -1, 0]);
  for (const sx of [-1, 1]) quad([sx * 1.4, 0.35, -Z], [sx * 1.4, 0.35, Z], [sx * 1.4, y0, Z], [sx * 1.4, y0, -Z], dark, 0, 0, [sx, 0, 0]);
  // Cab nose (group 1) on +z: sloping windscreen, lamps.
  const NZ = Z + 1.0;
  quad([-W, y0, NZ], [W, y0, NZ], [W, 1.9, NZ], [-W, 1.9, NZ], white, 1, 1, [0, 0, 1]);
  quad([-W, 1.9, NZ], [W, 1.9, NZ], [W, y1 - 0.25, Z + 0.2], [-W, y1 - 0.25, Z + 0.2], glass, 1, 2, [0, 0.6, 1]);
  for (const sx of [-1, 1]) {
    quad([sx * W, y0, Z], [sx * W, y0, NZ], [sx * W, 1.9, NZ], [sx * W, 1.9, Z], white, 1, 0, [sx, 0, 0]);
    quad([sx * W, 1.9, Z], [sx * W, 1.9, NZ], [sx * W, y1 - 0.25, Z + 0.2], [sx * W, y1 - 0.2, Z], glass, 1, 2, [sx, 0, 0]);
    quad([sx * 1.15 - 0.2, 1.3, NZ + 0.01], [sx * 1.15 + 0.2, 1.3, NZ + 0.01], [sx * 1.15 + 0.2, 1.5, NZ + 0.01], [sx * 1.15 - 0.2, 1.5, NZ + 0.01], col(0xffffff), 1, 6, [0, 0, 1]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(A, 2));
  return g;
}

// ---------------------------------------------------------------- the metro
export class Metro {
  static async create(ctx) {
    const res = await fetch(ctx.tiles.fileUrl('metro.json')).catch(() => null);
    if (!res?.ok) return null;
    const json = await res.json();
    if (!json.lines?.length) return null;
    const m = new Metro(ctx, json);
    await (ctx.compile ? ctx.compile(m.mesh) : null)?.catch?.(() => {});
    return m;
  }

  /** ctx: scene, tiles, structures, materials, clock, tier, state, tickets, hud, bubbles, people, walker, view, audio, compile, snap. */
  constructor(ctx, json) {
    Object.assign(this, ctx);
    this.lines = json.lines.map((j, i) => new MLine(j, i));
    this.stations = json.stations.map((s, i) => ({ ...s, i, built: null }));
    this.t = 0;
    this.trains = new Map();
    this.tmp = {}; this.a = [0, 0, 0, 0]; this.b = [0, 0, 0, 0];
    this.lowTier = ctx.tier?.name === 'Low';
    this.chunks = new Map();     // viaduct chunks near the player
    this.scanT = 0; this.buildT = 0;
    this.r = null;               // the player's ride
    this.prompt = '';
    this.inside = null;          // { station, entered: ticket } once through a gate (paid area)
    this.gateOpenT = 0;
    // Viaduct pieces per chunk: each elevated/monorail line's segments, cut at chunk borders.
    this.pieces = new Map();
    for (const L of this.lines) {
      if (L.kind === 'underground') continue;
      for (let i = 1; i < L.x.length; i++) {
        const cx = Math.floor((L.x[i - 1] + L.x[i]) / 2 / CHUNK), cz = Math.floor((L.z[i - 1] + L.z[i]) / 2 / CHUNK), k = `${cx},${cz}`;
        (this.pieces.get(k) || this.pieces.set(k, []).get(k)).push([L, i]);
      }
    }
    // The car mesh: every car of every metro train near the player.
    this.max = 160;
    const geo = carGeometry(21.9);
    const inst = (n) => new THREE.InstancedBufferAttribute(new Float32Array(this.max * n), n).setUsage(THREE.DynamicDrawUsage);
    this.livery = inst(3); this.opt = inst(4);
    geo.setAttribute('aLivery', this.livery);
    geo.setAttribute('aOpt', this.opt);
    this.uNight = { value: 0 };
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.45 });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uNight = this.uNight;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
          attribute vec2 aPart; attribute vec3 aLivery; attribute vec4 aOpt; // aOpt: cab, lamps (1 front, -1 rear), doors open, length scale
          uniform float uNight; varying vec3 vGlow;`)
        .replace('#include <color_vertex>', `#include <color_vertex>
          if (aPart.y > 0.5 && aPart.y < 1.5) vColor.rgb *= aLivery;
          vGlow = aPart.y > 1.5 && aPart.y < 2.5 ? vec3(1.0, 0.95, 0.85) * (0.08 + uNight * 0.9)
            : aPart.y > 5.5 && aPart.y < 6.5 ? (aOpt.y > 0.5 ? vec3(1.0, 0.95, 0.85) : aOpt.y < -0.5 ? vec3(1.0, 0.05, 0.03) : vec3(0.0)) * (0.8 + 2.5 * uNight) : vec3(0.0);`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          if (aPart.y > 7.5) transformed.z += (aPart.y < 8.5 ? -1.0 : 1.0) * aOpt.z * 0.66 * aOpt.w;
          transformed.z *= aOpt.w;
          transformed *= aPart.x < 0.5 ? 1.0 : aPart.x < 1.5 ? aOpt.x : 1.0;`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vGlow;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vGlow;');
    };
    mat.customProgramCacheKey = () => 'gtb-metro-v1';
    this.mesh = new THREE.InstancedMesh(geo, mat, this.max);
    this.mesh.count = 0;
    this.mesh.castShadow = this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
    // Materials of the structures.
    const M = ctx.materials;
    this.mat = {
      concrete: M.parapet, top: M.paved,
      roof: new THREE.MeshStandardMaterial({ vertexColors: true, map: corrugated(), roughness: 0.5, metalness: 0.35, side: THREE.DoubleSide }),
      flat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }),
      steel: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.4 }),
      glass: new THREE.MeshStandardMaterial({ color: 0x8fb4c4, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }),
      glow: new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xfff4e0, emissiveIntensity: 0.2, roughness: 0.4 }),
    };
    this.looks = Array.from({ length: 16 }, (_, i) => outfit(['office', 'casual', 'sari', 'casual', 'office', 'worker'][i % 6]));
    this.pool = [];
    addEventListener('keydown', (e) => {
      if (!this.r || e.code !== 'Space' || e.repeat) return;
      e.preventDefault(); e.stopPropagation();
      this.skip();
    }, true);
  }

  // ---------------------------------------------------------------- frame
  update(dt, active, onFoot) {
    this.t += dt;
    const P = active.pos, night = this.clock.night ?? 0;
    this.uNight.value = night;
    this.mat.glow.emissiveIntensity = 0.2 + night * 2;
    if ((this.scanT -= dt) <= 0) { this.scanT = 0.5; this.scan(P); this.stream(P); }
    // Station and viaduct building is spread over frames.
    if (this.job) {
      const j = this.job, t0 = performance.now();
      while (j.i < j.tasks.length && performance.now() - t0 < 3) j.tasks[j.i++]();
      if (j.i >= j.tasks.length) { this.job = null; j.done(); }
    }
    this.moveTrains(dt, P);
    this.passengers(P);
    this.prompt = '';
    if (this.r) this.ride(dt);
    else if (onFoot) this.onFoot(dt);
    this.gateOpenT = Math.max(0, this.gateOpenT - dt);
  }

  /** Make the trains of every timetable slot near the player. */
  scan(P) {
    const st = this.tmp, a = this.a;
    for (const L of this.lines) {
      if (L.kind === 'underground') continue;
      const q = service(L.spec, this.clock.hour);
      if (L.closed) { this.parked(L, P); continue; }
      if (!q) continue;
      const per = L.period, k1 = Math.floor((this.t - L.offset) / per), k0 = Math.ceil((this.t - L.offset - L.dur) / per);
      for (let k = k0; k <= k1; k++) {
        const key = `${L.index}:${k}`;
        if (this.trains.has(key) || k % q !== 0) continue;
        L.state(this.t - L.offset - k * per, st);
        L.at(clamp(st.s, 0, L.len), a);
        if (Math.hypot(a[0] - P.x, a[1] - P.z) > 1100) continue;
        this.trains.set(key, { key, line: L, k, s: st.s, v: st.v, leg: null, left: 0, doors: 0, x: a[0], z: a[1], seed: hash(L.index, k), cx: new Float64Array(8), cz: new Float64Array(8), sn: new Float32Array(8), cs: new Float32Array(8), on: new Uint8Array(8), n: 0 });
      }
    }
  }

  /** The closed monorail: two trains parked at its terminus platforms. */
  parked(L, P) {
    const s = L.stations[L.end ? L.stations.length - 1 : 0];
    if (!s) return;
    const key = `${L.index}:parked`, p = L.at(s.d);
    if (Math.hypot(p[0] - P.x, p[1] - P.z) > 1100) { this.trains.delete(key); return; }
    if (!this.trains.has(key)) this.trains.set(key, { key, line: L, k: 0, parked: s.d, s: s.d, v: 0, leg: { station: s.i }, left: 1e9, doors: 0, x: p[0], z: p[1], seed: 1, cx: new Float64Array(8), cz: new Float64Array(8), sn: new Float32Array(8), cs: new Float32Array(8), on: new Uint8Array(8), n: 0 });
  }

  moveTrains(dt, P) {
    const M = this.mesh.instanceMatrix.array, LV = this.livery.array, OP = this.opt.array, a = this.a, b = this.b, st = this.tmp;
    let n = 0;
    for (const tr of this.trains.values()) {
      const L = tr.line;
      if (tr.parked == null) {
        const tau = this.t - L.offset - tr.k * L.period;
        if (tau >= L.dur || tau < 0) { if (this.r?.tr !== tr) { this.trains.delete(tr.key); continue; } }
        L.state(clamp(tau, 0, L.dur), st);
        tr.s = st.s; tr.v = st.v; tr.leg = st.leg; tr.left = st.left;
        if (tr.leg.station >= 0) { const inT = tr.leg.T - tr.left; tr.doors = clamp((inT - 2) / 1.8, 0, 1) * clamp((tr.left - 4) / 1.8, 0, 1); } else tr.doors = 0;
      }
      L.at(clamp(tr.s, 0, L.len), a);
      tr.x = a[0]; tr.z = a[1];
      if (Math.hypot(tr.x - P.x, tr.z - P.z) > 1300 && this.r?.tr !== tr) { this.trains.delete(tr.key); continue; }
      tr.n = 0;
      const cars = L.cars, car = L.car, scale = car / 21.9, y = L.kind === 'monorail' ? L.rail - 1.15 : L.rail; // monorail cars straddle the beam
      for (let i = 0; i < cars; i++) {
        const c = tr.s + L.trainLen / 2 - car / 2 - i * car;
        tr.on[i] = 0;
        if (c < 2 || c > L.len - 2 || n >= this.max) continue;
        L.at(c - car * 0.35, a); L.at(c + car * 0.35, b);
        const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, x = (a[0] + b[0]) / 2, z = (a[1] + b[1]) / 2;
        let sn = dx / l, cs = dz / l;
        tr.cx[i] = x; tr.cz[i] = z; tr.sn[i] = sn; tr.cs[i] = cs; tr.on[i] = 1; tr.n++;
        if (i === cars - 1) { sn = -sn; cs = -cs; } // the rear car's cab faces backwards
        const o = n * 16, ws = L.kind === 'monorail' ? 0.95 : 1;
        M[o] = cs * ws; M[o + 1] = 0; M[o + 2] = -sn * ws; M[o + 3] = 0; M[o + 4] = 0; M[o + 5] = 1; M[o + 6] = 0; M[o + 7] = 0;
        M[o + 8] = sn; M[o + 9] = 0; M[o + 10] = cs; M[o + 11] = 0; M[o + 12] = x; M[o + 13] = y; M[o + 14] = z; M[o + 15] = 1;
        LV[n * 3] = L.livery.r; LV[n * 3 + 1] = L.livery.g; LV[n * 3 + 2] = L.livery.b;
        OP[n * 4] = i === 0 || i === cars - 1 ? 1 : 0; OP[n * 4 + 1] = tr.parked != null ? 0 : i === 0 ? 1 : i === cars - 1 ? -1 : 0; OP[n * 4 + 2] = tr.doors; OP[n * 4 + 3] = scale;
        n++;
      }
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = this.livery.needsUpdate = this.opt.needsUpdate = true;
  }

  /** People standing at the doors of trains near the player (how many: the hour and the line). */
  passengers(P) {
    let n = 0;
    const cap = this.lowTier ? 30 : 70;
    for (const tr of this.trains.values()) {
      if (!tr.n || tr.parked != null || (tr.x - P.x) ** 2 + (tr.z - P.z) ** 2 > 90 * 90) continue;
      const L = tr.line, load = trainLoad({ hour: this.clock.hour, toTown: L.index % 2 === 0, fromTown: tr.s, lineLen: L.len, metro: L.ref === '1' ? 1.05 : 0.45 });
      for (let i = 0; i < L.cars && n < cap; i++) {
        if (!tr.on[i]) continue;
        const per = Math.min(5, Math.floor(load * 4 + hash(tr.seed, i)));
        for (let k = 0; k < per && n < cap; k++) {
          const p = this.pool[n] ||= { noHero: true, amp: 1, phase: 0, scale: 1, flags: 0, pose: POSE.STAND };
          const r = hash(tr.seed * 7 + i, k), along = (r - 0.5) * L.car * 0.8, lat = (hash(k, i, tr.seed) - 0.5) * 2.2;
          p.x = tr.cx[i] + tr.sn[i] * along + tr.cs[i] * lat; p.z = tr.cz[i] + tr.cs[i] * along - tr.sn[i] * lat; p.y = L.rail + FLOORH;
          p.heading = Math.atan2(tr.sn[i], tr.cs[i]) + (r > 0.5 ? Math.PI : 0); p.phase = this.t + r * 30;
          const look = this.looks[Math.floor(r * 97) % this.looks.length];
          p.shirt = look.shirt; p.pants = look.pants; p.skin = look.skin; p.flags = look.flags || 0;
          this.people.add(p);
          n++;
        }
      }
    }
  }

  // ---------------------------------------------------------------- streaming: viaducts and stations
  stream(P) {
    if (this.job) return;
    const cx = Math.floor(P.x / CHUNK), cz = Math.floor(P.z / CHUNK), R = Math.ceil(BUILD / CHUNK);
    for (const [k, c] of this.chunks) if (Math.hypot(c.x - P.x, c.z - P.z) > DROP + CHUNK) this.dropChunk(k, c);
    for (const s of this.stations) if (s.built && Math.hypot(s.x - P.x, s.z - P.z) > DROP) this.dropStation(s);
    // Nearest missing piece first: a station, or a viaduct chunk.
    let best = null, bd = Infinity;
    for (const s of this.stations) {
      if (s.built || s.building) continue;
      const d = Math.hypot(s.x - P.x, s.z - P.z);
      if (d < BUILD && d < bd) { bd = d; best = { station: s }; }
    }
    for (let x = cx - R; x <= cx + R; x++) for (let z = cz - R; z <= cz + R; z++) {
      const k = `${x},${z}`;
      if (this.chunks.has(k) || !this.pieces.has(k)) continue;
      const d = Math.hypot((x + 0.5) * CHUNK - P.x, (z + 0.5) * CHUNK - P.z);
      if (d < BUILD + CHUNK / 2 && d < bd) { bd = d; best = { chunk: k }; }
    }
    if (best?.station) this.buildStation(best.station);
    else if (best?.chunk) this.buildChunk(best.chunk);
  }

  /** Build everything near (x, z) at once (after a teleport, a ride, a test). */
  buildNow(x, z) {
    for (let guard = 0; guard < 60; guard++) {
      if (this.job) { const j = this.job; while (j.i < j.tasks.length) j.tasks[j.i++](); this.job = null; j.done(); continue; }
      this.stream({ x, z });
      if (!this.job) break;
    }
  }

  meshes(B, key) {
    const group = new THREE.Group();
    group.name = key;
    for (const [k, buf] of Object.entries(B)) {
      if (buf.empty) continue;
      const mesh = new THREE.Mesh(buf.geometry(), this.mat[k] || this.mat.flat);
      mesh.castShadow = k !== 'glass' && k !== 'glow';
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    this.scene.add(group);
    return group;
  }

  buildChunk(k) {
    const B = { concrete: new Buf(), steel: new Buf(), flat: new Buf() }, pieces = [], tasks = [];
    const list = this.pieces.get(k), owner = `metro:${k}`;
    for (const [L, i] of list) tasks.push(() => this.girder(L, i, B, pieces));
    tasks.push(() => this.piers(list, B, pieces));
    const [x, z] = k.split(',').map(Number);
    this.chunks.set(k, { x: (x + 0.5) * CHUNK, z: (z + 0.5) * CHUNK, group: null, owner });
    this.job = { tasks, i: 0, done: () => { const c = this.chunks.get(k); if (!c) return; c.group = this.meshes(B, owner); this.structures.add(owner, pieces); } };
  }

  dropChunk(k, c) {
    if (c.group) { this.scene.remove(c.group); c.group.traverse((o) => o.isMesh && o.geometry.dispose()); }
    this.structures.remove(c.owner);
    this.chunks.delete(k);
  }

  /** One segment of a line's girder: a U-trough (metro) or the monorail beam. */
  girder(L, i, B) {
    const ax = L.x[i - 1], az = L.z[i - 1], bx = L.x[i], bz = L.z[i], len = Math.hypot(bx - ax, bz - az);
    if (len < 0.05) return;
    const ux = (bx - ax) / len, uz = (bz - az) / len, cx = (ax + bx) / 2, cz = (az + bz) / 2;
    if (L.kind === 'monorail') { B.concrete.box(cx, cz, ux, uz, len / 2 + 0.05, 0.42, L.rail - 1.5, L.rail, 0xd8d4cc); return; }
    const y = L.rail;
    B.concrete.box(cx, cz, ux, uz, len / 2 + 0.05, 2.2, y - 1.6, y - 0.95, 0xcfcac2);            // trough floor
    for (const s of [-1, 1]) B.concrete.box(cx - uz * s * 2.05, cz + ux * s * 2.05, ux, uz, len / 2 + 0.05, 0.16, y - 1.6, y + 0.9, 0xd8d3ca); // side walls
    // Rails.
    for (const s of [-0.72, 0.72]) B.steel.box(cx - uz * s, cz + ux * s, ux, uz, len / 2 + 0.05, 0.04, y - 0.95, y, 0x6d6e70);
  }

  /** Piers every ~28 m: one between the two tracks where both run close, else one per track. */
  piers(list, B, pieces) {
    const lines = [...new Set(list.map(([L]) => L))];
    const done = [];
    for (const L of lines) {
      const near = list.filter(([M]) => M === L).map(([, i]) => i);
      const d0 = Math.min(...near.map((i) => L.cum[i - 1])), d1 = Math.max(...near.map((i) => L.cum[i]));
      for (let d = Math.ceil(d0 / 28) * 28; d <= d1; d += 28) {
        const p = L.at(d);
        if (done.some(([x, z]) => Math.hypot(x - p[0], z - p[1]) < 14)) continue;
        // The other direction of the same line close by: share the pier, under the middle.
        let x = p[0], z = p[1];
        for (const O of this.lines) {
          if (O === L || O.ref !== L.ref || O.kind !== L.kind) continue;
          const q = this.nearest(O, x, z);
          if (q && q.dist < 9) { x = (x + q.x) / 2; z = (z + q.z) / 2; break; }
        }
        done.push([x, z]);
        const top = L.rail - (L.kind === 'monorail' ? 1.5 : 1.6), base = this.tiles.groundHeight(x, z) - 0.2;
        if (L.kind === 'monorail') {
          B.concrete.box(x, z, p[2], p[3], 0.6, 0.6, base, top - 0.8, 0xd4d0c6);
          B.concrete.box(x, z, p[2], p[3], 0.7, 3.2, top - 0.8, top, 0xd4d0c6);
          pieces.push(post(x, z, 0.75, base, top));
        } else {
          B.concrete.box(x, z, p[2], p[3], 0.95, 0.95, base, top - 1.3, 0xd2cdc4);
          B.concrete.box(x, z, p[2], p[3], 1.1, 4.8, top - 1.3, top, 0xd2cdc4);                // pier cap under both troughs
          pieces.push(post(x, z, 1.2, base, top));
        }
      }
    }
  }

  /** Nearest point of a line to (x, z): { x, z, d (along), dist }. */
  nearest(L, x, z) {
    let best = null;
    for (let i = 1; i < L.x.length; i++) {
      const ax = L.x[i - 1], az = L.z[i - 1], dx = L.x[i] - ax, dz = L.z[i] - az;
      if (Math.min(ax, ax + dx) > x + 40 || Math.max(ax, ax + dx) < x - 40 || Math.min(az, az + dz) > z + 40 || Math.max(az, az + dz) < z - 40) continue;
      const l2 = dx * dx + dz * dz || 1, t = clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1), qx = ax + dx * t, qz = az + dz * t, dd = Math.hypot(x - qx, z - qz);
      if (!best || dd < best.dist) best = { x: qx, z: qz, d: L.cum[i - 1] + Math.sqrt(l2) * t, dist: dd };
    }
    return best;
  }

  // ---------------------------------------------------------------- stations
  buildStation(s) {
    s.building = true;
    const B = { concrete: new Buf(), top: new Buf(), roof: new Buf(), flat: new Buf(), steel: new Buf(), glass: new Buf(), glow: new Buf() }, pieces = [], owner = `metro-station:${s.i}`;
    const tasks = s.kind === 'underground' ? [() => this.entrances(s, B, pieces)] : [() => this.elevated(s, B, pieces)];
    this.job = { tasks, i: 0, done: () => { s.building = false; s.built = { group: this.meshes(B, owner), owner }; this.structures.add(owner, pieces); s.sign = this.signFor(s); } };
  }

  dropStation(s) {
    this.scene.remove(s.built.group);
    s.built.group.traverse((o) => o.isMesh && o.geometry.dispose());
    this.structures.remove(s.built.owner);
    if (s.sign) { this.scene.remove(s.sign); s.sign.material.map.dispose(); s.sign.material.dispose(); s.sign.geometry.dispose(); s.sign = null; }
    s.built = null;
  }

  /**
   * An elevated station in its own frame: s along the tracks, t across (+ to the left of the
   * axis). Side platforms outside the two tracks at 14 m, a concourse at 7 m across the road
   * with the counters, the security check and two lines of fare gates, stairs to the street on
   * both sides and from the paid area up to each platform, a roof over it all.
   */
  elevated(s, B, pieces) {
    const [ux, uz] = s.axis, vx = -uz, vz = ux, mono = s.ref === 'Mono 1';
    const P = (a, t, y) => [s.x + ux * a + vx * t, y, s.z + uz * a + vz * t];
    const L = this.lines.find((l) => l.ref === s.ref), cars = L?.cars || 6, half = Math.max(45, (cars * (L?.car || 21.9)) / 2 + 8);
    const tr = s.tracks?.length === 2 ? s.tracks.slice().sort((a, b) => a - b) : [-2.5, 2.5];
    const yr = mono ? MONO : RAIL, yp = mono ? MONO + 0.3 : PLAT, yc = mono ? 4.6 : CONC;
    const tIn = [tr[0] - 1.7, tr[1] + 1.7], tOut = [tIn[0] - (mono ? 3.5 : 4.5), tIn[1] + (mono ? 3.5 : 4.5)];
    const rect = (a0, a1, t0, t1, y) => [P(a0, t0, y), P(a1, t0, y), P(a1, t1, y), P(a0, t1, y)];
    const slab = (buf, a0, a1, t0, t1, y0, y1, col) => {
      const cx = (a0 + a1) / 2, ct = (t0 + t1) / 2, c = P(cx, ct, 0);
      buf.box(c[0], c[2], ux, uz, (a1 - a0) / 2, (t1 - t0) / 2, y0, y1, col);
    };
    const floorRect = (a0, a1, t0, t1, y) => pieces.push(floor(rect(a0, a1, t0, t1, y).map((p) => [p[0], p[2]]), y));
    const wallLine = (a0, t0, a1, t1, y0, y1, buf, col, thick = 0.08) => {
      const p = P(a0, t0, 0), q = P(a1, t1, 0);
      pieces.push(wall(p[0], p[2], q[0], q[2], thick, y0, y1));
      if (buf) { const cx = (p[0] + q[0]) / 2, cz = (p[2] + q[2]) / 2, len = Math.hypot(q[0] - p[0], q[2] - p[2]), dx = (q[0] - p[0]) / (len || 1), dz = (q[2] - p[2]) / (len || 1); buf.box(cx, cz, dx, dz, len / 2, thick, y0, y1, col); }
    };
    // Track bed through the station (a floor 1 m below the platform edge) and the box under it.
    slab(B.concrete, -half, half, tIn[0], tIn[1], yr - 1.7, yr - 0.95, 0xcbc6bd);
    floorRect(-half, half, tIn[0], tIn[1], yr - 0.95);
    // Platforms (both sides), with a hole where the stair from the concourse comes up.
    const stairA = mono ? 4 : 6, stairL = (yp - yc) / 0.62, holeT = 1.4;
    for (const side of [0, 1]) {
      const t0 = side ? tIn[1] : tOut[0], t1 = side ? tOut[1] : tIn[0], tc = (t0 + t1) / 2;
      const aTop = stairA - stairL;
      for (const [a0, a1, q0, q1] of [[-half, aTop, t0, t1], [stairA, half, t0, t1], [aTop, stairA, t0, tc - holeT], [aTop, stairA, tc + holeT, t1]]) {
        slab(B.concrete, a0, a1, q0, q1, yp - 0.5, yp - 0.02, 0xbdb8ae);
        for (const p of [rect(a0, a1, q0, q1, yp)]) B.top.face(p[0], p[1], p[2], p[3], 0xf0ece4, 0, 1, 0);
        floorRect(a0, a1, q0, q1, yp);
      }
      // Rails round the hole, the platform edge line, the outer glass wall.
      wallLine(aTop, tc - holeT, stairA, tc - holeT, yp, yp + 1.1, B.steel, 0x3a3d40, 0.04);
      wallLine(aTop, tc + holeT, stairA, tc + holeT, yp, yp + 1.1, B.steel, 0x3a3d40, 0.04);
      wallLine(stairA, tc - holeT, stairA, tc + holeT, yp, yp + 1.1, B.steel, 0x3a3d40, 0.04);
      const edge = side ? tIn[1] : tIn[0], inward = side ? 0.5 : -0.5;
      B.flat.face(...rect(-half, half, edge + inward * 0.2, edge + inward * 0.6, yp + 0.01), 0xf2c21a, 0, 1, 0);
      wallLine(-half, side ? tOut[1] : tOut[0], half, side ? tOut[1] : tOut[0], yp, yp + 2.2, null, 0, 0.1);
      B.glass.face(P(-half, side ? tOut[1] : tOut[0], yp), P(half, side ? tOut[1] : tOut[0], yp), P(half, side ? tOut[1] : tOut[0], yp + 2.2), P(-half, side ? tOut[1] : tOut[0], yp + 2.2), 0xffffff, side ? vx : -vx, 0, side ? vz : -vz);
      for (const a of [-half, half]) wallLine(a, t0, a, t1, yp, yp + 1.2, B.steel, 0x3a3d40, 0.05);
      // The stair up from the paid concourse.
      const b = P(stairA, tc, 0), u = [-ux, -uz];
      this.stairMesh(B, pieces, b[0], b[2], u[0], u[1], stairL, holeT - 0.1, yc, yp);
      // Benches and the station name boards along the platform.
      for (const a of [-half * 0.6, half * 0.6]) slab(B.steel, a - 1, a + 1, tc + (side ? 1 : -1) * 0.8 - 0.25, tc + (side ? 1 : -1) * 0.8 + 0.25, yp + 0.42, yp + 0.47, 0x7b8085);
    }
    // Roof over platforms and tracks, on columns along the platform outer edges.
    const yR = yp + 5.2;
    for (const [q0, q1, ya, yb] of [[tOut[0] - 0.6, 0, yR, yR + 1.4], [0, tOut[1] + 0.6, yR + 1.4, yR]]) {
      const c = [P(-half - 2, q0, ya), P(half + 2, q0, ya), P(half + 2, q1, yb), P(-half - 2, q1, yb)];
      B.roof.quad(c[0], c[1], c[2], c[3], 0xe8eaec);
    }
    for (let a = -half; a <= half + 0.1; a += 12) for (const t of [tOut[0] + 0.3, tOut[1] - 0.3]) {
      const p = P(a, t, 0);
      B.steel.cyl(p[0], p[2], 0.18, yp, yR + 0.3, 0x5b6268, 8);
      pieces.push(post(p[0], p[2], 0.22, yp, yR));
    }
    for (const t of [tOut[0] - 0.6, tOut[1] + 0.6]) slab(B.flat, -half - 2, half + 2, t - 0.08, t + 0.08, yR - 0.55, yR + 0.05, mono ? 0x4bb7c9 : (L ? `#${L.livery.getHexString()}` : 0x2f73d1));
    for (let a = -half + 6; a < half; a += 10) for (const t of [tIn[0] - 2, tIn[1] + 2]) slab(B.glow, a - 1, a + 1, t - 0.05, t + 0.05, yR - 0.2, yR - 0.12, 0xffffff);
    // Concourse: a slab across the road under the platforms.
    const cw = Math.max(tOut[1], -tOut[0]) + 7, ca = mono ? 14 : 24;
    slab(B.concrete, -ca, ca, -cw, cw, yc - 0.5, yc - 0.02, 0xc4bfb6);
    B.top.face(...rect(-ca, ca, -cw, cw, yc), 0xe6e2da, 0, 1, 0);
    floorRect(-ca, ca, -cw, cw, yc);
    // Walls round the concourse (glass above a parapet), open where the street stairs arrive.
    const streetT = cw - 1.6, gap = 1.5;
    const sideWalls = () => {
      for (const t of [-cw, cw]) {
        const opens = (s.sideOpen || []).filter(([, sd]) => Math.sign(t) === sd).map(([a]) => a).sort((p, q) => p - q);
        let a0 = -ca;
        for (const o of opens) { wallLine(a0, t, o - 1.5, t, yc, yc + 3, null, 0, 0.1); a0 = o + 1.5; }
        wallLine(a0, t, ca, t, yc, yc + 3, null, 0, 0.1);
      }
    };
    // The ends stay open to the stairs (a railing on the stair takes over); a low parapet elsewhere.
    for (const a of [-ca, ca]) {
      wallLine(a, -cw, a, -streetT - gap, yc, yc + 1.2, B.flat, 0xd9d4c8, 0.12);
      wallLine(a, streetT + gap, a, cw, yc, yc + 1.2, B.flat, 0xd9d4c8, 0.12);
    }
    for (const t of [-cw, cw]) B.glass.face(P(-ca, t, yc), P(ca, t, yc), P(ca, t, yc + 3), P(-ca, t, yc + 3), 0xffffff, t > 0 ? vx : -vx, 0, t > 0 ? vz : -vz);
    slab(B.flat, -ca, ca, -cw, cw, yc + 3.6, yc + 3.75, 0xd8d6d0); // ceiling under the track box
    // Fare gates: two lines across the concourse; the paid area is between them.
    if (!mono) {
      const gateA = 9;
      s.gates = [];
      for (const ga of [-gateA, gateA]) {
        let t = -cw;
        const lanes = [-3.6, -1.8, 0, 1.8, 3.6];
        for (const lt of lanes) {
          wallLine(ga, t, ga, lt - 0.45, yc, yc + 1.1, B.steel, 0x2c2f33, 0.12);
          const g = wall(...(() => { const p = P(ga, lt - 0.45, 0), q = P(ga, lt + 0.45, 0); return [p[0], p[2], q[0], q[2]]; })(), 0.1, yc, yc + 1.1);
          g.pass = () => this.gateOpenT > 0;
          pieces.push(g);
          slab(B.steel, ga - 0.6, ga + 0.6, lt - 0.55, lt - 0.45, yc, yc + 1.05, 0xa9b0b6); // gate cabinets
          slab(B.flat, ga - 0.05, ga + 0.05, lt - 0.42, lt + 0.42, yc + 0.6, yc + 0.95, 0xd23b2f); // flaps (drawn closed)
          s.gates.push(P(ga, lt, yc));
          t = lt + 0.45;
        }
        wallLine(ga, t, ga, cw, yc, yc + 1.1, B.steel, 0x2c2f33, 0.12);
      }
      // Ticket counters and QR machines in the unpaid area, a security arch at each end.
      for (const a of [-ca + 7, ca - 7]) {
        slab(B.flat, a - 1.5, a + 1.5, -1.2, 1.2, yc, yc + 1.15, 0x3f6f9c);
        slab(B.glass, a - 1.5, a + 1.5, -1.2, -1.15, yc + 1.15, yc + 2.4, 0xffffff);
        slab(B.flat, a - 1.5, a + 1.5, -1.2, 1.2, yc + 2.4, yc + 2.7, 0x18b5b0);
        wallLine(a - 1.5, -1.2, a + 1.5, -1.2, yc, yc + 2.4, null);
        wallLine(a - 1.5, 1.2, a + 1.5, 1.2, yc, yc + 2.4, null);
        for (const t of [-streetT + 3, streetT - 3]) slab(B.steel, a - 0.4, a + 0.4, t - 0.3, t + 0.3, yc, yc + 1.8, 0x2b3f55); // QR ticket machine
      }
      s.counters = [P(-ca + 7, -2, yc), P(ca - 7, -2, yc), P(-ca + 7, 2, yc), P(ca - 7, 2, yc)];
    }
    // Stairs from the concourse down to the street, on both sides, at both ends (if they land clear).
    // Each stair runs along the road from a concourse end and must land clear of buildings: try
    // nearer the middle of the road too, then a flight straight out across the footpath.
    let n = 0;
    const L2 = (yc - GROUND) / 0.62, endOpen = {};
    const clear = (x0, z0, dx, dz, len) => { for (let k = 0; k <= 4; k++) { const f = 0.35 + (0.65 * k) / 4, x = x0 + dx * len * f, z = z0 + dz * len * f; if (this.tiles.hits(x, z, k === 4 ? 0.9 : 0.6)) return false; } return this.tiles.walkable ? this.tiles.walkable(x0 + dx * (len + 1.5), z0 + dz * (len + 1.5)) !== false : true; };
    for (const end of [-1, 1]) for (const side of [-1, 1]) {
      let done = false;
      for (let t = streetT; t >= 3 && !done; t -= 1.5) {
        const top = P(end * ca, side * t, 0);
        if (!clear(top[0], top[2], ux * end, uz * end, L2)) continue;
        this.stairMesh(B, pieces, top[0], top[2], ux * end, uz * end, L2, 1.4, yc, GROUND);
        (endOpen[end] ||= []).push(side * t);
        n++; done = true;
      }
      if (done) continue;
      const top = P(end * (ca - 3), side * cw, 0);
      if (clear(top[0], top[2], vx * side, vz * side, L2)) {
        this.stairMesh(B, pieces, top[0], top[2], vx * side, vz * side, L2, 1.3, yc, GROUND);
        // Open the side wall there.
        n++;
        s.sideOpen = (s.sideOpen || []).concat([[end * (ca - 3), side]]);
      }
    }
    s.streetStairs = n;
    sideWalls();
    // Railings across the open ends, except where a stair goes down.
    for (const end of [-1, 1]) {
      const opens = (endOpen[end] || []).sort((p, q) => p - q);
      let t0 = -streetT - gap;
      for (const o of opens) { if (o - 1.5 > t0) wallLine(end * ca, t0, end * ca, o - 1.5, yc, yc + 1.1, B.steel, 0x3a3d40, 0.05); t0 = o + 1.5; }
      if (streetT + gap > t0) wallLine(end * ca, t0, end * ca, streetT + gap, yc, yc + 1.1, B.steel, 0x3a3d40, 0.05);
    }
    // Columns under the station in the median.
    for (let a = -half + 8; a <= half - 8; a += 16) {
      const p = P(a, 0, 0), base = this.tiles.groundHeight(p[0], p[2]) - 0.2;
      B.concrete.box(p[0], p[2], ux, uz, 0.9, 0.9, base, yc - 0.5, 0xd2cdc4);
      pieces.push(post(p[0], p[2], 1.2, base, yc - 0.5));
    }
    s.frame = { ux, uz, vx, vz, half, tIn, tOut, yp, yc, ca, cw, mono };
  }

  /** A straight flight with railings: from (x, z) at height y0 along (ux, uz) for L metres to height y1. */
  stairMesh(B, pieces, x, z, ux, uz, L, hw, y0, y1) {
    const vx = -uz, vz = ux, n = Math.max(2, Math.round(Math.abs(y1 - y0) / 0.17)), run = L / n, h = (y1 - y0) / n;
    const P = (a, t, y) => [x + ux * a + vx * t, y, z + uz * a + vz * t];
    const up = h > 0;
    for (let k = 0; k < n; k++) {
      const a0 = k * run, a1 = (k + 1) * run, yb = y0 + k * h, yt = yb + h, yy = up ? yt : yt;
      B.top.face(P(a0, -hw, yb), P(a0, hw, yb), P(a0, hw, yy), P(a0, -hw, yy), 0xd9d4ca, up ? -ux : ux, 0, up ? -uz : uz);
      B.top.face(P(a0, -hw, yy), P(a0, hw, yy), P(a1, hw, yy), P(a1, -hw, yy), 0xe6e1d8, 0, 1, 0);
    }
    for (const t of [-hw, hw]) {
      B.steel.quad2(P(0, t, y0), P(L, t, y1), P(L, t, y1 + 1.05), P(0, t, y0 + 1.05), 0x3a3d40);
      B.concrete.quad2(P(0, t, y0 - 0.4), P(L, t, y1 - 0.4), P(L, t, y1), P(0, t, y0), 0xc9c4ba);
      const a = P(0, t, 0), b = P(L, t, 0);
      pieces.push(wall(a[0], a[2], b[0], b[2], 0.07, Math.min(y0, y1) - 0.5, Math.max(y0, y1) + 1.1));
    }
    B.concrete.quad2(P(0, -hw, y0 - 0.4), P(0, hw, y0 - 0.4), P(L, hw, y1 - 0.4), P(L, -hw, y1 - 0.4), 0xbdb8ae);
    // Nobody walks up the underside from below.
    const low = Math.min(y0, y1), lowAt = y1 < y0 ? L : 0, back = (2.2 / Math.abs(y1 - y0)) * L;
    if (back < L - 0.5) { const aa = lowAt ? L - back : back, p = P(aa, -hw, 0), q = P(aa, hw, 0); pieces.push(wall(p[0], p[2], q[0], q[2], 0.1, low, low + 1.6)); }
    pieces.push(ramp(x, z, ux, uz, L, hw, y0, y1));
  }

  /** Street entrances of an underground (Line 3) station: a glass canopy over the stairs going down. */
  entrances(s, B, pieces) {
    const list = s.entrances?.length ? s.entrances : [[s.x, s.z, '', '']];
    s.doors = [];
    for (const [ex, ez, ref] of list.slice(0, 6)) {
      // Face the nearest road.
      let fx = 0, fz = 1, bd = Infinity;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2, x = ex + Math.sin(a) * 6, z = ez + Math.cos(a) * 6;
        const r = this.tiles.roadAt?.(x, z, 3);
        const d = r ? 0 : 1;
        if (d < bd) { bd = d; fx = Math.sin(a); fz = Math.cos(a); }
      }
      const vx = -fz, vz = fx, g = this.tiles.groundHeight(ex, ez);
      const P = (a, t, y) => [ex + fx * a + vx * t, y, ez + fz * a + vz * t];
      // Glass box 3.6 × 6 m, roof slab, an aqua band with the station's name, dark stair mouth.
      for (const [a0, a1, t0, t1] of [[-3, 3, -1.9, -1.8], [-3, 3, 1.8, 1.9], [-3.1, -3, -1.9, 1.9]]) {
        const c = P((a0 + a1) / 2, (t0 + t1) / 2, 0);
        B.glass.box(c[0], c[2], fx, fz, (a1 - a0) / 2, (t1 - t0) / 2, g, g + 2.8, 0xffffff);
        const p = P(a0, t0, 0), q = P(a1, t1, 0);
        pieces.push(wall(p[0], p[2], q[0], q[2], 0.05, g, g + 2.8));
      }
      const r = P(0, 0, 0);
      B.steel.box(r[0], r[2], fx, fz, 3.3, 2.1, g + 2.8, g + 3.05, 0xe8e8e8);
      B.flat.box(r[0], r[2], fx, fz, 3.32, 2.12, g + 3.05, g + 3.4, 0x18b5b0);
      B.flat.face(P(-2.6, -1.4, g + 0.02), P(1.6, -1.4, g + 0.02), P(1.6, 1.4, g + 0.02), P(-2.6, 1.4, g + 0.02), 0x141618, 0, 1, 0);
      s.doors.push({ x: ex + fx * 3.6, z: ez + fz * 3.6, ref, fx, fz });
    }
  }

  /** A floating name board over each elevated station (and on Line 3 entrances). */
  signFor(s) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 96;
    const g = c.getContext('2d'), L = this.lines.find((l) => l.ref === s.ref);
    g.fillStyle = '#111418'; g.fillRect(0, 0, 512, 96);
    g.fillStyle = L?.colour || '#18b5b0'; g.fillRect(0, 0, 18, 96);
    g.fillStyle = '#fff'; g.textBaseline = 'middle';
    g.font = '700 30px "Baloo 2", "Noto Sans Devanagari", sans-serif'; if (s.mr) g.fillText(s.mr, 34, 30);
    g.font = '700 30px "Oswald", Arial, sans-serif'; g.fillText((s.name || '').toUpperCase(), 34, s.mr ? 70 : 48);
    g.font = '600 22px Arial, sans-serif'; g.fillStyle = L?.colour || '#18b5b0'; g.textAlign = 'right'; g.fillText(L?.name || 'Metro', 500, 30);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.5), new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.4, side: THREE.DoubleSide }));
    const f = s.frame;
    if (f) { mesh.position.set(s.x + f.ux * (f.ca + 0.3), f.yc + 4.4, s.z + f.uz * (f.ca + 0.3)); mesh.rotation.y = Math.atan2(f.ux, f.uz); }
    else if (s.doors?.[0]) { const d = s.doors[0]; mesh.scale.setScalar(0.45); mesh.position.set(d.x - d.fx * 3.6, this.tiles.groundHeight(d.x, d.z) + 3.25, d.z - d.fz * 3.6); mesh.rotation.y = Math.atan2(d.fx, d.fz); }
    this.scene.add(mesh);
    return mesh;
  }

  // ---------------------------------------------------------------- on foot: tickets, gates, boarding
  /** The elevated station whose concourse or platforms the walker is on. */
  stationAt(x, z, y) {
    for (const s of this.stations) {
      const f = s.frame;
      if (!s.built || !f) continue;
      const dx = x - s.x, dz = z - s.z, a = dx * f.ux + dz * f.uz, t = dx * f.vx + dz * f.vz;
      if (Math.abs(a) < Math.max(f.half, f.ca) + 14 && Math.abs(t) < f.cw + 2 && y > f.yc - 1.5) return { s, a, t };
    }
    return null;
  }

  onFoot(dt) {
    const w = this.walker, here = this.stationAt(w.pos.x, w.pos.z, w.pos.y);
    this.here = here;
    // Line 3 entrances on the street.
    if (!here) {
      for (const s of this.stations) {
        if (!s.doors || !s.built) continue;
        for (const d of s.doors) if (Math.hypot(w.pos.x - d.x, w.pos.z - d.z) < 3.2) { this.prompt = `E: ${s.name} — ${this.lineName(s)} (buy a ticket and go down)`; this.door = s; return; }
      }
      this.door = null;
      return;
    }
    const { s, a } = here, f = s.frame;
    if (f.mono) { this.prompt = `${s.name} monorail — services suspended since 20 September 2025. "Restart next month," says the board.`; return; }
    const onConcourse = Math.abs(w.pos.y - f.yc) < 0.8, paid = onConcourse && Math.abs(a) < 9;
    if (onConcourse && !paid) {
      const ticket = this.tickets.findMetro(s.ref, s.name);
      const nearGate = Math.abs(Math.abs(a) - 9) < 2.2;
      if (nearGate && ticket) { this.gateOpenT = 0.6; if (!this.tapped) { this.tapped = ticket; ticket.entered = true; this.chime(); this.hud.message(`Beep. QR ticket ${ticket.from} → ${ticket.to} accepted.`); } }
      if (!this.tapped || this.tapped.from !== s.name) this.prompt = ticket ? 'Walk through a fare gate (tap the QR ticket)' : 'E: buy a QR ticket at the counter';
      if (Math.abs(a) > 9 + 3 && this.tapped?.used) this.tapped = null;
      if (!this.frisked && Math.abs(a) > f.ca - 6) { this.frisked = true; this.bubbles.say(this.walker, 'Security: Bag scanner pe rakho. Haath upar… theek hai, jao.', 3); }
    } else if (paid) {
      // Leaving the paid area: tap out at the gate (the fare is settled here).
      const nearGate = Math.abs(Math.abs(a) - 9) < 2.2;
      if (nearGate && this.tapped && this.tapped.entered && !this.tapped.used && this.tapped.exitAt === s.name) {
        this.gateOpenT = 0.6;
        this.settle(this.tapped, s.name);
      } else if (nearGate && this.tapped && this.tapped.from === s.name && !this.tapped.used && !this.tapped.exitAt) this.gateOpenT = 0.6; // changed your mind: back out
      else if (nearGate && !this.tapped) {
        // In the paid area without a ticket: the gate staff let you out, with a penalty.
        this.gateOpenT = 1.5;
        if (!this.finedAt || this.t - this.finedAt > 20) { this.finedAt = this.t; this.tickets.fine(500, `Metro: no valid ticket at the ${s.name} exit gate`); }
      }
      if (!this.prompt) this.prompt = 'Paid area — stairs up to the platforms';
    }
    if (Math.abs(w.pos.y - f.yp) < 0.8) {
      const d = this.door2(w.pos.x, w.pos.z);
      this.prompt = d ? `F: board — ${d.tr.line.name} to ${d.tr.line.to}` : `${s.name} · ${this.lineName(s)} · next train ${this.nextTrain(s)}`;
    }
  }

  lineName(s) { return this.lines.find((l) => l.ref === s.ref)?.name || 'Metro'; }

  nextTrain(s) {
    let best = Infinity;
    for (const L of this.lines) {
      if (L.ref !== s.ref) continue;
      const st = L.stations.find((o) => o.name === s.name), q = service(L.spec, this.clock.hour);
      if (!st || !q) continue;
      const leg = L.legs.find((g) => g.station === st.i);
      if (!leg) continue;
      const per = L.period * q, k = Math.ceil((this.t - L.offset - leg.t0 - leg.T + 6) / per);
      best = Math.min(best, L.offset + k * per + leg.t0 - this.t);
    }
    return best === Infinity ? '— service over for the night' : best < 20 ? 'arriving' : `in ${Math.floor(best / 60)}:${String(Math.floor(best % 60)).padStart(2, '0')}`;
  }

  /** E: buy a ticket at a counter or machine, or go down at a Line 3 entrance. */
  interact() {
    const w = this.walker;
    if (this.r) return false;
    if (this.door && !this.here) { this.line3(this.door); return true; }
    const here = this.here;
    if (!here || here.s.frame.mono) return !!here;
    const { s, a } = here;
    if (Math.abs(w.pos.y - s.frame.yc) > 0.8 || Math.abs(a) < 9) return false;
    this.tickets.open({ title: `🚇 ${s.name} — ${this.lineName(s)} ticket counter`, sub: `QR ticket for one trip. Next train ${this.nextTrain(s)}.`, sys: 'metro', from: s.name, groups: this.groups(s), where: 'counter' });
    return true;
  }

  /** Destinations on the station's line, with rail distances. */
  groups(s) {
    const L = this.lines.find((l) => l.ref === s.ref && l.stations.some((o) => o.name === s.name));
    if (!L) return [];
    const me = L.stations.find((o) => o.name === s.name);
    return [{ name: L.name, colour: L.colour, line: s.ref, stops: L.stations.filter((o) => o !== me).map((o) => ({ name: o.name, m: Math.abs(o.d - me.d) })) }];
  }

  /** Tapping out: a trip longer than the ticket pays the difference at the gate. */
  settle(t, exit) {
    const L = this.lines.find((l) => l.ref === t.line), a = L?.stations.find((o) => o.name === t.from), b = L?.stations.find((o) => o.name === exit);
    const due = a && b ? metroFare(Math.abs(b.d - a.d), t.line) : t.price;
    t.used = true; t.uses = 0;
    this.tickets.prune();
    this.chime();
    if (due > t.price) { this.tickets.fine(due - t.price, `Excess fare at ${exit} (ticket was to ${t.to})`); }
    else this.hud.message(`Beep. Thank you for travelling with ${this.lineName({ ref: t.line })}.`);
    this.tapped = null; this.frisked = false;
  }

  chime() {
    const ctx = this.audio?.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime;
    for (const [f, at] of [[1320, 0], [1760, 0.09]]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f; g.gain.setValueAtTime(0.05, t0 + at); g.gain.exponentialRampToValueAtTime(0.0005, t0 + at + 0.12);
      o.connect(g).connect(this.audio.master); o.start(t0 + at); o.stop(t0 + at + 0.13);
    }
  }

  /** The open door of a stopped metro train next to (x, z). */
  door2(x, z) {
    let best = null;
    for (const tr of this.trains.values()) {
      if (tr.parked != null || tr.doors < 0.8 || (tr.x - x) ** 2 + (tr.z - z) ** 2 > 140 * 140) continue;
      const L = tr.line, sc = L.car / 21.9;
      for (let i = 0; i < L.cars; i++) {
        if (!tr.on[i]) continue;
        for (const dz of [-7.9, -2.65, 2.65, 7.9]) for (const side of [-1, 1]) {
          const al = dz * sc, px = tr.cx[i] + tr.sn[i] * al + tr.cs[i] * side * (HALF_W + 0.4), pz = tr.cz[i] + tr.cs[i] * al - tr.sn[i] * side * (HALF_W + 0.4), d = Math.hypot(px - x, pz - z);
          if (d < 1.8 && (!best || d < best.d)) best = { tr, i, al, side, d };
        }
      }
    }
    return best;
  }

  /** F on a platform next to an open door: board. */
  tryBoard() {
    if (this.r) return false;
    const w = this.walker, d = this.door2(w.pos.x, w.pos.z);
    if (!d) return false;
    if (!this.tapped) this.hud.message('No ticket tapped in? The gates are how you got here, surely… (ticketless metro travel: ₹500 fine at the exit)');
    this.r = { tr: d.tr, i: d.i, al: d.al, side: d.side, last: d.tr.leg?.station ?? -1, from: this.here?.s.name || this.stopOf(d.tr)?.name };
    this.hud.message(`Aboard the ${d.tr.line.name} to ${d.tr.line.to}. F: get off at a station · Space: skip to the next one`);
    this.chime();
    return true;
  }

  stopOf(tr) { const L = tr.line; if (tr.leg?.station >= 0) return L.stations[tr.leg.station]; let b = L.stations[0]; for (const s of L.stations) if (s.d <= tr.s) b = s; return b; }

  /** Riding: stand inside the car by the door; announcements; off at the end of the line. */
  ride() {
    const r = this.r, tr = r.tr, w = this.walker, L = tr.line;
    if (!this.trains.has(tr.key) || !tr.on[r.i]) { this.offTrain(true); return; }
    w.pos.set(tr.cx[r.i] + tr.sn[r.i] * r.al + tr.cs[r.i] * r.side * 0.9, L.rail + FLOORH, tr.cz[r.i] + tr.cs[r.i] * r.al - tr.sn[r.i] * r.side * 0.9);
    w.speed = 0;
    const st = tr.leg?.station ?? -1;
    if (st >= 0 && st !== r.last) {
      r.last = st;
      const s = L.stations[st];
      if (s.name !== r.from) this.hud.message(`${s.name} · ${s.name === L.to ? 'This train terminates here. ' : ''}Doors will open on the ${r.side > 0 ? 'right' : 'left'} · दरवाजे उघडतील`);
    }
    if (st < 0 && r.last >= 0) { r.last = -1; const next = L.stations.find((o) => o.d > tr.s); if (next) this.hud.message(`Next station: ${next.name} · पुढील स्टेशन ${next.name} · अगला स्टेशन ${next.name}`); }
    // The end of the line (or the last stop before the line runs off the map): everybody off.
    if (tr.leg?.station === L.stations.length - 1 && tr.left < 6 && tr.doors > 0.5) { this.offTrain(!L.end); return; }
    this.prompt = tr.doors > 0.8 ? `F: get off at ${this.stopOf(tr)?.name} · Space: skip ahead` : 'Space: skip to the next station';
  }

  /** F while riding: step off onto the platform (only with the doors open). */
  alight() {
    const r = this.r;
    if (!r) return false;
    if (r.tr.doors < 0.8) { this.hud.message('Doors are closed. Please wait for the next station.'); return true; }
    this.offTrain(false);
    return true;
  }

  offTrain(lost) {
    const r = this.r, tr = r.tr, w = this.walker, L = tr.line, i = r.i;
    const s = this.stopOf(tr);
    if (lost || !tr.on[i]) {
      // Onto the platform of the last station in the map.
      const rec = this.stations.find((o) => o.name === s?.name && o.ref === L.ref), f = rec?.frame;
      this.r = null;
      if (f) { const t = (f.tIn[1] + f.tOut[1]) / 2; w.pos.set(rec.x + f.vx * t, f.yp, rec.z + f.vz * t); }
      if (this.tapped) this.tapped.exitAt = s?.name;
      this.hud.message(`This train runs on to ${L.to}, beyond the map: off at ${s?.name}.`);
      return;
    }
    let x = tr.cx[i] + tr.sn[i] * r.al + tr.cs[i] * r.side * (HALF_W + 1.2), z = tr.cz[i] + tr.cs[i] * r.al - tr.sn[i] * r.side * (HALF_W + 1.2);
    let y = this.structures.groundHeight(x, z, L.rail + 1.5, this.tiles.groundHeight(x, z));
    if (y < L.rail - 2) { x = tr.cx[i] - tr.cs[i] * r.side * (HALF_W + 1.2); z = tr.cz[i] + tr.sn[i] * r.side * (HALF_W + 1.2); y = this.structures.groundHeight(x, z, L.rail + 1.5, this.tiles.groundHeight(x, z)); }
    w.pos.set(x, y, z);
    this.r = null;
    if (this.tapped) this.tapped.exitAt = s?.name;
    if (lost) this.hud.message(`End of the line in the map: off at ${s?.name}.`);
    else this.hud.message(`${s?.name}. Mind the gap. Tap out at the gates on the concourse.`);
  }

  async skip() {
    const r = this.r;
    if (!r || this.busy) return;
    const tr = r.tr, L = tr.line, next = L.stations.find((o) => o.d > tr.s + 3);
    if (!next) return;
    const leg = L.legs.find((g) => g.station === next.i), tau = this.t - L.offset - tr.k * L.period, dt = leg.t0 + 5 - tau;
    if (!(dt > 1)) return;
    this.busy = true;
    const fade = document.getElementById('fade');
    fade?.classList.add('on');
    await wait(300);
    this.t += dt;
    this.clock.hour += dt / 3600;
    this.walker.pos.set(L.at(next.d)[0], this.walker.pos.y, L.at(next.d)[1]);
    await this.tiles.whenReady(this.walker.pos.x, this.walker.pos.z, 250);
    this.buildNow(this.walker.pos.x, this.walker.pos.z);
    fade?.classList.remove('on');
    this.busy = false;
  }

  // ---------------------------------------------------------------- Line 3 (underground)
  /**
   * E at a Line 3 entrance: a QR ticket from the counter downstairs (bought here), the security
   * check, the gates, and the ride; you come up at the other station's nearest entrance. The
   * clock moves on by the real trip time (about 2 minutes a station plus the walk down and up).
   */
  line3(s) {
    const groups = this.groups(s);
    if (!groups.length) return;
    const q = service(this.lines.find((l) => l.ref === s.ref).spec, this.clock.hour);
    if (!q) { this.hud.message(`${s.name}: Line 3 is closed for the night. First train at 5:55 am.`); return; }
    this.tickets.open({
      title: `🚇 ${s.name} — Line 3 (underground)`, sub: 'Pick where you are going: QR ticket, security check, gates, and down to the platform.',
      sys: 'metro', from: s.name, groups, where: 'counter',
      onBuy: (t) => this.underground(s, t),
    });
  }

  async underground(s, t) {
    const L = this.lines.find((l) => l.ref === s.ref && l.stations.some((o) => o.name === t.to));
    const a = L?.stations.find((o) => o.name === s.name), b = L?.stations.find((o) => o.name === t.to);
    const dest = this.stations.find((o) => o.ref === s.ref && o.name === t.to);
    if (!L || !a || !b || !dest) return;
    const stops = Math.abs(b.i - a.i), secs = 240 + Math.abs(b.d - a.d) / 13 + stops * 30 + this.waitFor(s);
    const fade = document.getElementById('fade');
    this.busy = true;
    fade?.classList.add('on');
    this.hud.message(`Security check… gates… platform ${a.i < b.i ? 1 : 2}. The train (8 cars, aqua) pulls in. Next: ${L.stations[a.i + (b.i > a.i ? 1 : -1)]?.name}…`);
    await wait(900);
    // Up at the destination's entrance nearest its centre.
    const door = dest.entrances?.[0] ? { x: dest.entrances[0][0], z: dest.entrances[0][1] } : { x: dest.x, z: dest.z };
    this.walker.pos.set(door.x, this.tiles.groundHeight(door.x, door.z), door.z);
    this.clock.hour += secs / 3600;
    await this.tiles.whenReady(door.x, door.z, 250);
    if (!dest.built) { this.buildStation(dest); this.buildNow(door.x, door.z); }
    const d0 = dest.doors?.[0];
    if (d0) this.walker.pos.set(d0.x + d0.fx * 1.5, this.tiles.groundHeight(d0.x + d0.fx * 1.5, d0.z + d0.fz * 1.5), d0.z + d0.fz * 1.5);
    t.used = true; t.uses = 0; this.tickets.prune();
    this.snap?.();
    fade?.classList.remove('on');
    this.busy = false;
    this.hud.message(`${dest.name}. ${Math.round(secs / 60)} minutes on Line 3, ${stops} stop${stops === 1 ? '' : 's'}. Phone signal is back.`);
  }

  /** Seconds until the next Line 3 train at a station (part of the trip). */
  waitFor(s) { return 60 + hash(this.t) * 180; }

  /** Stations for the full-screen map. */
  markers() {
    return (this.marks ||= this.stations.map((s) => ({ x: s.x, z: s.z, color: s.ref === 'Mono 1' ? '#8aa' : (this.lines.find((l) => l.ref === s.ref)?.colour || '#18b5b0'), icon: s.ref === 'Mono 1' ? '🚝' : '🚇', r: 6, label: `${s.name} (${this.lineName(s)})` })));
  }

  /** Metro trains run on the viaduct, over everyone's head: nothing on the street touches them. */
  hits() { return false; }
}

export { rupees, FLAG };
