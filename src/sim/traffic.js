import * as THREE from 'three';
import { LIGHT } from './signals.js';
import { buildFleet } from '../vehicles/fleet.js';
import { MASS } from '../vehicles/garage.js';
import { endKey, keyXZ } from './roadKeys.js';

// Ambient traffic, Rockstar style: a few dozen vehicles live only near the player,
// driving on the LEFT along the real road network, slowing behind each other and for
// the player. Density follows the clock (rush hours). One instanced mesh per type.

const LEFT = (fx, fz) => [fz, -fx]; // left-hand perpendicular of a heading (x east, z south)

const FORWARD = new THREE.Vector3(0, 0, 1);

/**
 * Lanes of a segment for traffic going `dir` along it, as painted by the converter
 * (scripts/lib/streets.mjs): one-way roads have round(width / 3.4) lanes, two-way roads
 * 2 × round(width / 7). India keeps LEFT: our lanes lie left of the centre line; lane 0 is the
 * kerb lane (two-wheelers, autos, buses), the highest is next to the centre line (overtaking).
 * Parked cars take the kerb lane on wide streets (as in traffic.placeParked).
 * Returns { n, w, lo, hi }: lane count, lane width, lowest and highest usable lane.
 */
function lanesOf(seg, dir) {
  const s = seg.s, hw = s[4], oneway = !!(s[5] & 2);
  const n = oneway ? Math.max(1, Math.min(8, Math.round((hw * 2) / 3.4))) : Math.max(1, Math.min(4, Math.round((hw * 2) / 7)));
  const w = oneway ? (hw * 2) / n : hw / n;
  const parks = hw >= 4.5 && seg.len >= 22;
  const parkLeft = parks && (dir > 0 || oneway || hw >= 6), parkRight = parks && oneway;
  const lo = parkLeft && n > 1 ? 1 : 0, hi = parkRight && n - 2 >= lo ? n - 2 : n - 1;
  return { n, w, lo, hi, parkLeft: parkLeft && n === 1 };
}
/** Offset (left of travel, metres from the centre line) of lane i. */
const laneOffset = (seg, L, i) => seg.s[4] - (i + 0.5) * L.w;

function riderLook() {
  const shirts = [0xc0392b, 0x2e86c1, 0xf2f2f2, 0x34495e, 0x27ae60, 0x7f8c8d, 0xe67e22];
  const skin = [0x8d5a3b, 0x7a4a2f, 0xa06a46, 0x6b3f26][Math.floor(Math.random() * 4)];
  return { shirt: new THREE.Color(shirts[Math.floor(Math.random() * shirts.length)]), pants: new THREE.Color(Math.random() < 0.5 ? 0x24324a : 0x2b2b2b), skin: new THREE.Color(skin), helmet: Math.random() < 0.75 };
}

/** Auto-rickshaw drivers wear khaki; dabbawalas white with a Gandhi cap. */
function driverLook(type) {
  const skin = new THREE.Color([0x8d5a3b, 0x7a4a2f, 0xa06a46, 0x6b3f26][Math.floor(Math.random() * 4)]);
  if (type.dabbawala) return { shirt: new THREE.Color(0xf1eee6), pants: new THREE.Color(0xe9e5da), skin, cap: true };
  if (type.open) return { shirt: new THREE.Color(0xb39a68), pants: new THREE.Color(0x9a8457), skin };
  return riderLook();
}

/** Someone on the back bench of an auto. */
function paxLook() {
  const r = riderLook();
  return { shirt: r.shirt, pants: r.pants, skin: r.skin, sari: Math.random() < 0.3 };
}

export class Traffic {
  constructor(scene, tiles, tier) {
    this.scene = scene;
    this.tiles = tiles;
    this.max = tier.name === 'High' ? 110 : tier.name === 'Medium' ? 80 : 55; // Mumbai is busy
    this.types = buildFleet();
    this.typeNames = Object.keys(this.types);
    this.totalWeight = this.typeNames.reduce((s, n) => s + this.types[n].weight, 0);
    // All vehicle types share one BatchedMesh per part (paint, glass, trim, lamps): four draw
    // calls for the whole fleet; each instance picks its type's near or far geometry.
    this.mats = {
      paint: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.36, metalness: 0.15, clearcoat: 0.6, clearcoatRoughness: 0.16 }),
      glass: new THREE.MeshStandardMaterial({ color: 0x141a20, roughness: 0.05, metalness: 0.6 }),
      trim: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.15 }),
      lamps: new THREE.MeshBasicMaterial({ vertexColors: true }),
    };
    this.parkMax = tier.name === 'High' ? 140 : tier.name === 'Medium' ? 100 : 60;
    this.cap = this.max + 24 + this.parkMax; // traffic, extras (broken-down taxis) and parked vehicles
    this.batches = {};
    this.geo = {};
    for (const part of ['paint', 'glass', 'trim', 'lamps']) {
      let verts = 0;
      for (const n of this.typeNames) verts += this.types[n].parts[part].attributes.position.count + this.types[n].far[part].attributes.position.count;
      const b = new THREE.BatchedMesh(this.cap, verts, 0, this.mats[part]);
      b.castShadow = part === 'paint' || part === 'trim';
      b.receiveShadow = part !== 'lamps';
      b.sortObjects = false;
      // The batch's own bounding sphere is computed once (around wherever the first cars were):
      // far from there the whole fleet would be culled. Each instance is still culled by itself.
      b.frustumCulled = false;
      this.geo[part] = {};
      for (const n of this.typeNames) this.geo[part][n] = [b.addGeometry(this.types[n].parts[part]), b.addGeometry(this.types[n].far[part])];
      for (let i = 0; i < this.cap; i++) { b.addInstance(this.geo[part][this.typeNames[0]][0]); b.setVisibleAt(i, false); }
      scene.add(b);
      this.batches[part] = b;
    }
    this.shown = 0;
    this.riders = [];      // people on motorbikes (drawn by main.js with the people renderer)
    this.cars = [];
    this.graphVersion = -1;
    this.matrix = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.pos = new THREE.Vector3();
    this.q2 = new THREE.Quaternion();
    this.unit = new THREE.Vector3(1, 1, 1);
    this.honks = [];
    this.events = [];      // { type: 'jump', car, ap } for the police
    this.signals = null;   // set by main.js
    this.obstacles = [];   // [x, z, length]: cows, cricket pitches, jaywalkers (set by street life)
    this.extras = [];      // broken-down vehicles drawn with the traffic meshes
    this.parked = [];      // parked cars and two-wheelers along wide streets near the player
    this.left = [];        // vehicles the player took and left somewhere, or shoved out of their parking spot
    this.movedKeys = new Set(); // parking spots whose vehicle was taken or shoved (not re-created)
    this.parkAt = { x: 1e9, z: 1e9, v: -1 };
    this.night = 0;
  }

  /**
   * Junction graph: segment ends that meet (0.5 m grid) across all loaded tiles. Runs every
   * time a tile loads or unloads, so it must be cheap: each tile's segments (with their end
   * keys and end records) are made once and cached on the tile; keys are numbers.
   */
  rebuildGraph() {
    const ends = new Map(), segList = [];
    for (const t of this.tiles.tiles.values()) {
      let g = t.graph;
      if (!g) {
        g = t.graph = [];
        const rd = t.collide.roads;
        for (let i = 0; i < rd.count; i++) {
          const s = this.tiles.segment(t, i);
          if (!(s[5] & 1)) continue;
          const len = Math.hypot(s[2] - s[0], s[3] - s[1]);
          if (len < 0.3) continue;
          const seg = { t, i, s, len, k0: endKey(s[0], s[1]), k1: endKey(s[2], s[3]) };
          seg.e0 = { seg, end: 0 }; seg.e1 = { seg, end: 1 };
          g.push(seg);
        }
      }
      for (const seg of g) {
        segList.push(seg);
        let l = ends.get(seg.k0); if (!l) ends.set(seg.k0, (l = [])); l.push(seg.e0);
        l = ends.get(seg.k1); if (!l) ends.set(seg.k1, (l = [])); l.push(seg.e1);
      }
    }
    // Join loose ends that almost touch (tile seams, slightly offset OSM nodes) so cars and
    // police don't hit invisible dead ends: both keys then share one list of segment ends.
    // The grid holds keys only; lists are always looked up again (they change as ends join).
    const cell = (x, z) => (Math.floor(x / 5) + 32768) * 65536 + (Math.floor(z / 5) + 32768);
    const grid = new Map();
    for (const k of ends.keys()) {
      const [x, z] = keyXZ(k), c = cell(x, z);
      let a = grid.get(c); if (!a) grid.set(c, (a = [])); a.push(k);
    }
    for (const [k, list] of ends) {
      if (list.length !== 1) continue;
      const [x, z] = keyXZ(k), seg = list[0].seg;
      let best = null, bd = 6.25; // within 2.5 m
      for (let gx = -1; gx <= 1; gx++) for (let gz = -1; gz <= 1; gz++) {
        for (const k2 of grid.get(cell(x + gx * 5, z + gz * 5)) || []) {
          if (k2 === k) continue;
          const l2 = ends.get(k2);
          if (l2 === list || l2.some((e) => e.seg === seg)) continue;
          const [x2, z2] = keyXZ(k2), d = (x2 - x) ** 2 + (z2 - z) ** 2;
          if (d < bd) { bd = d; best = k2; }
        }
      }
      if (best !== null) { const other = ends.get(best); other.push(...list); ends.set(k, other); }
    }
    this.ends = ends;
    this.segList = segList;
    this.graphVersion = this.tiles.version;
  }

  /**
   * North of the Bandra–Sion line (about 19.046° N) is "the suburbs": autos are allowed there
   * and only there, and they take most of the kaali-peelis' work.
   */
  inSuburbs(z) {
    if (this.suburbZ === undefined) {
      const ix = this.tiles.index;
      this.suburbZ = ix?.origin ? -(19.046 - ix.origin.lat) * ix.metresPerDegree.lat : -1e9;
    }
    return z < this.suburbZ;
  }

  /** Vehicle mix by hour: goods tempos run at night, BEST buses and private cars by day. */
  pickType(z = 0) {
    const night = this.hour >= 22 || this.hour < 6, suburb = this.inSuburbs(z);
    const w = (n) => { const T = this.types[n]; return T.weight * (night ? T.night ?? 1 : 1) * (suburb ? T.suburb ?? 1 : T.city ?? 1) * (T.hours ? T.hours(this.hour) : 1); };
    let r = Math.random() * this.typeNames.reduce((s, n) => s + w(n), 0);
    for (const n of this.typeNames) { r -= w(n); if (r <= 0) return n; }
    return 'wagonr';
  }

  spawn(player) {
    for (let tries = 0; tries < 30; tries++) {
      const seg = this.segList[Math.floor(Math.random() * this.segList.length)];
      if (!seg) return;
      const s = seg.s;
      const mx = (s[0] + s[2]) / 2, mz = (s[1] + s[3]) / 2;
      const d = Math.hypot(mx - player.pos.x, mz - player.pos.z);
      if (d < 45 || d > 220) continue;
      const type = this.pickType(mz);
      if (this.types[type].mainRoad && !(s[5] & 4)) continue; // buses stick to main roads
      const oneway = s[5] & 2;
      const dir = oneway || Math.random() < 0.5 ? 1 : -1;
      const tints = this.types[type].tints;
      const car = {
        type, seg, dir, t: Math.random(), speed: 0, tint: new THREE.Color(tints[Math.floor(Math.random() * tints.length)]), wait: 0, x: mx, z: mz, heading: 0,
        // Some drivers jump red lights (more at night, never buses); many stop on the zebra.
        jumper: !this.types[type].big && Math.random() < 0.1 + this.night * 0.12, creep: Math.random() < 0.35 ? 2.5 : 0,
        pulled: null, boost: 0, lane: 0, laneIdx: -1, lastSig: null, lastDist: 0,
        kerb: this.types[type].rider ? 0.3 + Math.random() * 0.6 : this.types[type].open ? 0.25 : 0, // two-wheelers hug the left of their lane
        // Preferred lane: slow and big vehicles keep to the kerb lane, cars spread over the rest.
        pref: this.types[type].rider || this.types[type].open || this.types[type].big || this.types[type].slow ? 0 : Math.random() < 0.45 ? 0 : Math.random() < 0.6 ? 1 : 2,
        look: this.types[type].rider || this.types[type].open ? driverLook(this.types[type]) : null,
        pax: this.types[type].pax && Math.random() < 0.6 ? paxLook() : null,
      };
      if (this.cars.some((c) => Math.hypot(c.x - mx, c.z - mz) < 12)) continue;
      this.cars.push(car);
      return;
    }
  }

  /** Is the lane at `offset` (left of travel) free of same-direction traffic close behind and ahead? */
  laneFree(car, fx, fz, offset) {
    const lx = fz, lz = -fx;
    for (const o of this.cars) {
      if (o === car) continue;
      const dx = o.x - car.x, dz = o.z - car.z;
      if (dx * dx + dz * dz > 900) continue;
      const along = dx * fx + dz * fz, side = car.lane + dx * lx + dz * lz;
      if (Math.sin(o.heading) * fx + Math.cos(o.heading) * fz < 0.3) continue; // not going our way
      if (along > -8 && along < 14 && Math.abs(side - offset) < 1.6) return false;
    }
    return true;
  }

  /** No oncoming traffic within `dist` metres ahead (for overtaking on a two-lane road). */
  oncomingClear(car, fx, fz, dist) {
    const lx = fz, lz = -fx;
    for (const o of this.cars) {
      if (o === car) continue;
      const dx = o.x - car.x, dz = o.z - car.z, along = dx * fx + dz * fz;
      if (along < -2 || along > dist) continue;
      if (Math.sin(o.heading) * fx + Math.cos(o.heading) * fz > -0.3) continue;
      if (car.lane + dx * lx + dz * lz < 1.5) return false; // on our right: the oncoming lane
    }
    return true;
  }

  /** Continue onto a connected segment at the end we are driving towards (prefer straight on). */
  advance(car) {
    const s = car.seg.s;
    const endIdx = car.dir > 0 ? 1 : 0;
    const k = endKey(s[endIdx * 2], s[endIdx * 2 + 1]);
    const fx = (s[2] - s[0]) * car.dir, fz = (s[3] - s[1]) * car.dir, fl = Math.hypot(fx, fz) || 1;
    const options = (this.ends.get(k) || []).filter((o) => o.seg !== car.seg).map((o) => {
      const dir = o.end === 0 ? 1 : -1;
      if (dir < 0 && (o.seg.s[5] & 2)) return null; // no wrong-way on one-way roads
      const ox = (o.seg.s[2] - o.seg.s[0]) * dir, oz = (o.seg.s[3] - o.seg.s[1]) * dir;
      const dot = (ox * fx + oz * fz) / (fl * (Math.hypot(ox, oz) || 1));
      return { o, dir, score: dot + Math.random() * 0.9 };
    }).filter(Boolean).sort((a, b) => b.score - a.score);
    if (!options.length) { car.dir *= -1; return; } // dead end: turn round
    car.seg = options[0].o.seg;
    car.dir = options[0].dir;
    car.t = 0;
  }

  update(dt, player, clock) {
    this.night = clock.night;
    this.hour = clock.hour;
    const jam = clock.jam;
    if (this.graphVersion !== this.tiles.version) {
      this.rebuildGraph();
      // Drop cars whose road tile was unloaded.
      this.cars = this.cars.filter((c) => this.tiles.tiles.has(`${c.seg.t.tx},${c.seg.t.tz}`));
    }
    if (Math.hypot(player.pos.x - this.parkAt.x, player.pos.z - this.parkAt.z) > 35 || this.parkAt.v !== this.tiles.version) this.placeParked(player);
    const target = Math.round(this.max * clock.traffic);
    this.cars = this.cars.filter((c) => Math.hypot(c.x - player.pos.x, c.z - player.pos.z) < 320);
    if (this.cars.length < target && this.segList.length) this.spawn(player);
    if (this.cars.length > target + 4) { const i = this.cars.findLastIndex((c) => !c.pulled); if (i >= 0) this.cars.splice(i, 1); }

    const night = clock.night;
    for (const v of this.parked) if (v.pvx || v.pvz) this.slide(v, dt);
    for (const v of this.left) if (v.pvx || v.pvz || v.spin) this.slide(v, dt);
    for (const car of this.cars) {
      const s = car.seg.s;
      const type = this.types[car.type];
      if (car.knock > 0) {
        // Shunted: slides and spins with the blow; the driver brakes, then steers back into lane.
        car.knock -= dt; car.speed = 0;
        this.slide(car, dt);
        continue;
      }
      if (car.recover > 0) car.recover -= dt;
      const fx = ((s[2] - s[0]) / car.seg.len) * car.dir, fz = ((s[3] - s[1]) / car.seg.len) * car.dir;
      // Look ahead for other vehicles and the player in our lane.
      let gap = 40;
      let slowAhead = false;
      const check = (x, z, len, slow) => {
        const dx = x - car.x, dz = z - car.z;
        const along = dx * fx + dz * fz, lateral = Math.abs(dx * fz - dz * fx);
        if (along > 0 && lateral < (type.rider ? 1.0 : 1.6)) { const g = along - (type.len + len) / 2; if (g < gap) { gap = g; slowAhead = !!slow; } }
      };
      for (const o of this.cars) if (o !== car) check(o.x, o.z, this.types[o.type].len, this.types[o.type].slow && !type.slow);
      check(player.pos.x, player.pos.z, 3.7);
      if (this.taxi && this.taxi !== player) check(this.taxi.pos.x, this.taxi.pos.z, 3.7); // the parked taxi while on foot
      for (const o of this.obstacles) check(o[0], o[1], o[2]);
      // Signals: stop at red (and at amber if there is room); jumpers just go.
      let atRed = false;
      if (this.signals && !car.pulled) {
        const sig = this.signals.ahead(car.x, car.z, fx, fz, 40);
        if (sig && sig.light !== LIGHT.GREEN) {
          const stopGap = sig.dist + car.creep - type.len / 2 - 0.3;
          // At amber some drivers gamble and go for it (and cross on red).
          if (sig.light === LIGHT.AMBER && car.decideAp !== sig.ap) { car.decideAp = sig.ap; car.gamble = sig.dist < 30 && Math.random() < 0.45; }
          const going = (car.jumper && sig.light === LIGHT.RED) || (car.gamble && car.decideAp === sig.ap);
          if (going) {
            if (sig.light === LIGHT.RED && car.lastSig === sig.ap && car.lastDist > 0 && sig.dist <= 0) { this.events.push({ type: 'jump', car, ap: sig.ap }); car.boost = Math.max(car.boost, 2); }
          } else if (stopGap > -0.5 && (sig.light === LIGHT.RED || stopGap > car.speed * 1.2)) { gap = Math.min(gap, Math.max(0, stopGap) + 2); atRed = true; }
        }
        car.lastSig = sig ? sig.ap : null;
        car.lastDist = sig ? sig.dist : 0;
      }
      const cruise = (s[5] & 4 ? type.speed : type.speed * 0.6) * (night > 0.5 ? 1.15 : 1) * (car.boost > 0 ? 1.45 : 1) * (1 - 0.4 * jam);
      car.boost = Math.max(0, car.boost - dt);
      let want = gap < 2 ? 0 : Math.min(cruise, (gap - 2) * 0.8);
      let decel = 7;
      if (car.pulled) {
        // Pulled over by the traffic police: ease to the kerb and wait for the challan.
        car.pulled.t += dt;
        want = car.pulled.t < car.pulled.dur ? 0 : want;
        decel = 2.6;
        if (car.pulled.t >= car.pulled.dur) { car.pulled = null; car.jumper = Math.random() < 0.3; }
      }
      car.speed += THREE.MathUtils.clamp(want - car.speed, -decel * dt, 2.5 * dt);
      car.wait = car.speed < 0.5 && gap < 6 && !atRed && !car.pulled ? car.wait + dt : 0;
      if (car.wait > 2.5) { this.honks.push([car.x, car.z]); car.wait = -4; }
      // Stuck behind someone slower (not at a red light)? Overtake on the RIGHT, as in India:
      // into the next lane if it is free, or — on a two-lane road — into the oncoming lane only
      // when nothing is coming. Otherwise wait and honk. Drift back left when there is room.
      if (gap < 9 && (car.speed < 2.5 || slowAhead) && !atRed && !car.pulled && !type.big) car.blockedT = (car.blockedT || 0) + dt; else car.blockedT = Math.max(0, (car.blockedT || 0) - dt * 0.5);
      if (car.blockedT > (slowAhead ? 0.6 : 2) && !car.overtake) {
        const L = lanesOf(car.seg, car.dir);
        if (car.laneIdx < L.hi && this.laneFree(car, fx, fz, laneOffset(car.seg, L, car.laneIdx + 1))) { car.laneIdx++; car.blockedT = 0; }
        else if (!(s[5] & 2) && car.laneIdx >= L.hi && this.oncomingClear(car, fx, fz, 55)) { car.overtake = 3.5 + Math.random() * 1.5; car.blockedT = 0; }
        else if (Math.random() < 0.6) { this.honks.push([car.x, car.z]); car.blockedT = -1.5; }
      }
      if (car.overtake) { car.overtake -= dt; if (car.overtake <= 0) car.overtake = 0; }
      car.keepLeftT = (car.keepLeftT || 0) - dt;
      if (car.keepLeftT <= 0) {
        car.keepLeftT = 2 + Math.random() * 2;
        const L = lanesOf(car.seg, car.dir);
        if (car.laneIdx > Math.max(L.lo, Math.min(car.pref, L.hi)) && this.laneFree(car, fx, fz, laneOffset(car.seg, L, car.laneIdx - 1))) car.laneIdx--;
      }
      if (Math.random() < dt * 0.015 * (0.3 + jam)) this.honks.push([car.x, car.z]);
      car.t += (car.speed * dt) / car.seg.len;
      while (car.t >= 1) { car.t -= 1; this.advance(car); }
      const s2 = car.seg.s;
      const t = car.dir > 0 ? car.t : 1 - car.t;
      const gx = ((s2[2] - s2[0]) / car.seg.len) * car.dir, gz = ((s2[3] - s2[1]) / car.seg.len) * car.dir;
      const [lx, lz] = LEFT(gx, gz);
      const two = !(s2[5] & 2);
      if (car.yield) { car.yield = Math.max(0, car.yield - dt); }
      const L = lanesOf(car.seg, car.dir);
      if (car.laneIdx < 0) car.laneIdx = Math.min(Math.max(car.pref, L.lo), L.hi); // first placement
      car.laneIdx = Math.min(Math.max(car.laneIdx, L.lo), L.hi);
      let laneWant = laneOffset(car.seg, L, car.laneIdx) + Math.min(car.kerb, L.w * 0.25);
      if (L.parkLeft) laneWant = Math.min(laneWant, s2[4] - 2.2 - type.wid / 2); // single lane past parked cars
      if (car.overtake) laneWant = two ? -Math.min(L.w * 0.5, 1.8) : laneWant;   // round the slow one, on the right
      if (car.pulled || car.yield) laneWant = Math.max(0, s2[4] - type.wid / 2 - 0.3); // pull over to the left kerb
      car.lane += (laneWant - car.lane) * Math.min(1, dt * 1.2);
      const lane = car.lane;
      const px = s2[0] + (s2[2] - s2[0]) * t + lx * lane, pz = s2[1] + (s2[3] - s2[1]) * t + lz * lane;
      // Smooth position and heading through corners.
      const k = Math.min(1, dt * (car.recover > 0 ? 1.6 : 8));
      car.x += (px - car.x) * k; car.z += (pz - car.z) * k;
      const h = Math.atan2(gx, gz);
      let dh = h - car.heading;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      car.heading += dh * Math.min(1, dt * (car.recover > 0 ? 2 : 6));
    }

    // Write instances: near geometry within ~90 m of the player, the coarse version beyond.
    this.riders.length = 0;
    const B = this.batches, px = player.pos.x, pz = player.pos.z;
    let i = 0;
    const put = (v) => {
      if (i >= this.cap || !this.types[v.type]) return;
      const lod = (v.x - px) ** 2 + (v.z - pz) ** 2 > 90 * 90 ? 1 : 0;
      this.q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, v.heading);
      if (v.roll) this.q.multiply(this.q2.setFromAxisAngle(FORWARD, v.roll)); // a two-wheeler lying on its side
      this.matrix.compose(this.pos.set(v.x, v.roll ? 0.2 : 0.02, v.z), this.q, this.unit);
      for (const part in B) {
        B[part].setGeometryIdAt(i, this.geo[part][v.type][lod]);
        B[part].setMatrixAt(i, this.matrix);
        B[part].setVisibleAt(i, true);
      }
      B.paint.setColorAt(i, v.tint);
      if (v.look && !v.roll && (this.types[v.type].rider || this.types[v.type].open)) this.riders.push(v);
      i++;
    };
    for (const car of this.cars) put(car);
    for (const e of this.extras) put(e);
    for (const p of this.parked) put(p);
    for (const p of this.left) put(p);
    for (let k = i; k < this.shown; k++) for (const part in B) B[part].setVisibleAt(k, false);
    this.shown = i;
    this.mats.lamps.color.setScalar(0.7 + this.night * 3.5);
  }

  /** The player honked: the car right ahead moves over to the left to let them pass. */
  honkedBy(player) {
    const fx = Math.sin(player.heading), fz = Math.cos(player.heading);
    let best = null, bd = 18;
    for (const c of this.cars) {
      const dx = c.x - player.pos.x, dz = c.z - player.pos.z, along = dx * fx + dz * fz;
      if (along < 2 || along > bd || Math.abs(dx * fz - dz * fx) > 2.5) continue;
      bd = along; best = c;
    }
    if (best && !best.pulled) { best.yield = 4; if (Math.random() < 0.4) this.honks.push([best.x, best.z]); }
    return best;
  }

  /** Is a circle at (x, z) touching any traffic vehicle? */
  /**
   * Parked vehicles along streets at least ~9 m wide (narrower lanes would block traffic):
   * cars nose-to-tail at the kerb, rows of scooters and bikes angled in front of shops.
   * Placement is seeded per road segment, so the same cars are there when you come back.
   */
  placeParked(player) {
    this.parkAt = { x: player.pos.x, z: player.pos.z, v: this.tiles.version };
    const R = 130, out = [];
    const carTypes = ['wagonr', 'alto', 'swift', 'i10', 'dzire', 'city', 'ertiga', 'innova', 'creta', 'bolero', 'eeco', 'wagonr', 'swift', 'cabDzire'];
    const twoTypes = ['scooter', 'scooter', 'bike', 'scooter', 'bullet', 'scooter', 'bike', 'cycle'];
    const suburbTypes = [...carTypes, 'auto', 'auto', 'auto', 'auto', 'auto'];
    const tint = (type, h) => { const t = this.types[type].tints; return new THREE.Color(t[Math.floor(h * t.length) % t.length]); };
    for (const seg of this.segList || []) {
      const s = seg.s, hw = s[4];
      if (hw < 4.5 || seg.len < 22) continue;
      const mx = (s[0] + s[2]) / 2, mz = (s[1] + s[3]) / 2;
      if (Math.hypot(mx - player.pos.x, mz - player.pos.z) > R + seg.len / 2) continue;
      const fx = (s[2] - s[0]) / seg.len, fz = (s[3] - s[1]) / seg.len;
      let seed = (Math.abs(Math.round(s[0] * 7 + s[1] * 13 + s[2] * 3)) % 9973) + 1;
      const segKey = `${Math.round(s[0])},${Math.round(s[1])},${Math.round(s[2])},${Math.round(s[3])}`;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (const side of [1, -1]) {
        if (side < 0 && !(s[5] & 2) && hw < 6) continue; // two-way streets under 12 m: one side only
        // Left kerb when facing along the segment: right vector is (-fz, fx) → left is (fz, -fx).
        const lx = fz * side, lz = -fx * side;
        let d = 8 + rnd() * 6;
        while (d < seg.len - 8 && out.length < this.parkMax) {
          const x0 = s[0] + fx * d, z0 = s[1] + fz * d;
          const pd = Math.hypot(x0 - player.pos.x, z0 - player.pos.z);
          if (pd > R || pd < 7) { d += 6; continue; } // not on top of the player's taxi
          const r = rnd();
          if (r < 0.28) { d += 4 + rnd() * 8; continue; } // gap: a gate, a shop front, a hydrant
          const heading = Math.atan2(fx * side, fz * side) + (rnd() < 0.15 ? Math.PI : 0);
          if (r < 0.5) {
            // A row of two-wheelers, angled to the kerb.
            const n = 2 + Math.floor(rnd() * 5);
            for (let k = 0; k < n && out.length < this.parkMax; k++) {
              const type = twoTypes[Math.floor(rnd() * twoTypes.length)], o = hw - 0.9, th = rnd();
              const key = `${segKey}:${side}:${Math.round(d * 10)}:${k}`;
              if (this.movedKeys.has(key)) continue;
              out.push({ type, x: x0 + fx * k * 0.85 + lx * o, z: z0 + fz * k * 0.85 + lz * o, heading: Math.atan2(lx, lz) + Math.PI + 0.5, tint: tint(type, th), parked: true, key });
            }
            d += n * 0.85 + 1.5;
          } else {
            const list = this.inSuburbs(z0) ? suburbTypes : carTypes;
            const type = list[Math.floor(rnd() * list.length)], T = this.types[type], o = hw - T.wid / 2 - 0.25, th = rnd();
            const key = `${segKey}:${side}:${Math.round(d * 10)}`;
            if (!this.movedKeys.has(key)) out.push({ type, x: x0 + fx * T.len / 2 + lx * o, z: z0 + fz * T.len / 2 + lz * o, heading, tint: tint(type, th), parked: true, key });
            d += T.len + 0.6 + rnd() * 1.2;
          }
        }
      }
    }
    this.parked = out;
    // Vehicles left far behind are towed away (their parking spots stay empty).
    this.left = this.left.filter((v) => Math.hypot(v.x - player.pos.x, v.z - player.pos.z) < 350);
  }

  /** A pushed vehicle slides and spins to a stop (friction), and stops dead against buildings. */
  slide(v, dt) {
    const nx = v.x + (v.pvx || 0) * dt, nz = v.z + (v.pvz || 0) * dt;
    if (this.tiles.hits(nx, nz, this.types[v.type].wid / 2)) { v.pvx = v.pvz = 0; } else { v.x = nx; v.z = nz; }
    v.heading += (v.spin || 0) * dt;
    const f = Math.exp(-2.6 * dt);
    v.pvx = (v.pvx || 0) * f; v.pvz = (v.pvz || 0) * f; v.spin = (v.spin || 0) * f;
    if (Math.hypot(v.pvx, v.pvz) < 0.15 && Math.abs(v.spin) < 0.05) { v.pvx = v.pvz = v.spin = 0; }
  }

  /**
   * The vehicle a circle touches, as a physics body for the player's car: its mass and
   * velocity, and push(dvx, dvz, cx, cz) to apply a change of velocity at a contact point.
   */
  bodyAt(x, z, r) {
    const hit = (list) => {
      for (const car of list) {
        if (Math.abs(x - car.x) > 8 || Math.abs(z - car.z) > 8) continue;
        const type = this.types[car.type];
        const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
        const along = THREE.MathUtils.clamp((x - car.x) * fx + (z - car.z) * fz, -type.len / 2 + type.wid / 2, type.len / 2 - type.wid / 2);
        if ((x - car.x - fx * along) ** 2 + (z - car.z - fz * along) ** 2 < (r + type.wid / 2) ** 2) return car;
      }
      return null;
    };
    let kind = 'traffic', v = hit(this.cars);
    if (!v) { kind = 'parked'; v = hit(this.parked); }
    if (!v) { kind = 'left'; v = hit(this.left); }
    if (!v) return null;
    const moving = kind === 'traffic' && !(v.knock > 0);
    return {
      v, kind, mass: MASS[v.type] || 1000,
      vx: moving ? Math.sin(v.heading) * v.speed : v.pvx || 0, vz: moving ? Math.cos(v.heading) * v.speed : v.pvz || 0,
      push: (dvx, dvz, cx, cz) => this.shove(v, kind, dvx, dvz, cx, cz),
    };
  }

  shove(v, kind, dvx, dvz, cx, cz) {
    const type = this.types[v.type], dv = Math.hypot(dvx, dvz);
    v.pvx = (v.pvx || 0) + dvx; v.pvz = (v.pvz || 0) + dvz;
    // Off-centre blows spin the vehicle.
    const rx = cx - v.x, rz = cz - v.z;
    v.spin = THREE.MathUtils.clamp((v.spin || 0) + ((rz * dvx - rx * dvz) * 2.2) / (type.len * type.len), -3, 3);
    if (type.rider && dv > 2.2 && !v.roll) {
      // Two-wheelers go over; a rider comes off (and gets up again, swearing).
      v.roll = (rx * Math.cos(v.heading) - rz * Math.sin(v.heading)) > 0 ? -1.45 : 1.45;
      if (kind === 'traffic') {
        this.cars.splice(this.cars.indexOf(v), 1);
        this.left.push(v);
        this.onRiderDown?.(v);
        return;
      }
    }
    if (kind === 'traffic') {
      v.knock = Math.min(2.2, 0.5 + dv * 0.25); v.recover = 3; v.wait = 0;
      if (dv > 0.8) { this.honks.push([v.x, v.z]); this.onShunt?.(v, dv); }
    } else if (kind === 'parked') {
      // Pushed out of its spot: it stays where it ends up.
      this.parked.splice(this.parked.indexOf(v), 1);
      if (v.key) this.movedKeys.add(v.key);
      this.left.push(v);
    }
  }

  hits(x, z, r) {
    for (const car of this.parked.concat(this.left)) {
      if (Math.abs(x - car.x) > 8 || Math.abs(z - car.z) > 8) continue;
      const type = this.types[car.type];
      const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
      const dx = x - car.x, dz = z - car.z;
      const along = THREE.MathUtils.clamp(dx * fx + dz * fz, -type.len / 2 + type.wid / 2, type.len / 2 - type.wid / 2);
      const cx = car.x + fx * along, cz = car.z + fz * along;
      if ((x - cx) ** 2 + (z - cz) ** 2 < (r + type.wid / 2) ** 2) return true;
    }
    for (const car of this.cars) {
      const type = this.types[car.type];
      const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
      const dx = x - car.x, dz = z - car.z;
      const along = THREE.MathUtils.clamp(dx * fx + dz * fz, -type.len / 2 + type.wid / 2, type.len / 2 - type.wid / 2);
      const cx = car.x + fx * along, cz = car.z + fz * along;
      if ((x - cx) ** 2 + (z - cz) ** 2 < (r + type.wid / 2) ** 2) return true;
    }
    return false;
  }
}
