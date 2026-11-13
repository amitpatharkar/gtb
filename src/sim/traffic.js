import * as THREE from 'three';
import { LIGHT } from './signals.js';
import { buildFleet } from '../vehicles/fleet.js';

// Ambient traffic, Rockstar style: a few dozen vehicles live only near the player,
// driving on the LEFT along the real road network, slowing behind each other and for
// the player. Density follows the clock (rush hours). One instanced mesh per type.

const LEFT = (fx, fz) => [fz, -fx]; // left-hand perpendicular of a heading (x east, z south)

function riderLook() {
  const shirts = [0xc0392b, 0x2e86c1, 0xf2f2f2, 0x34495e, 0x27ae60, 0x7f8c8d, 0xe67e22];
  const skin = [0x8d5a3b, 0x7a4a2f, 0xa06a46, 0x6b3f26][Math.floor(Math.random() * 4)];
  return { shirt: new THREE.Color(shirts[Math.floor(Math.random() * shirts.length)]), pants: new THREE.Color(Math.random() < 0.5 ? 0x24324a : 0x2b2b2b), skin: new THREE.Color(skin), helmet: Math.random() < 0.75 };
}

export class Traffic {
  constructor(scene, tiles, tier) {
    this.scene = scene;
    this.tiles = tiles;
    this.max = tier.name === 'High' ? 110 : tier.name === 'Medium' ? 80 : 55; // Mumbai is busy
    this.types = buildFleet();
    this.typeNames = Object.keys(this.types);
    this.totalWeight = this.typeNames.reduce((s, n) => s + this.types[n].weight, 0);
    // One instanced mesh per vehicle type and part (paint, glass, trim, lamps).
    this.mats = {
      paint: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.38, metalness: 0.2, clearcoat: 0.5, clearcoatRoughness: 0.18 }),
      glass: new THREE.MeshStandardMaterial({ color: 0x0d1115, roughness: 0.06, metalness: 0.7 }),
      trim: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.2 }),
      lamps: new THREE.MeshBasicMaterial({ vertexColors: true }),
    };
    this.meshes = {};
    for (const name of this.typeNames) {
      this.meshes[name] = {};
      for (const part of ['paint', 'glass', 'trim', 'lamps']) {
        const m = new THREE.InstancedMesh(this.types[name].parts[part], this.mats[part], this.max);
        m.count = 0;
        m.castShadow = part === 'paint' || part === 'trim';
        m.receiveShadow = part !== 'lamps';
        m.frustumCulled = false;
        if (part === 'paint') m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.max * 3).fill(1), 3);
        scene.add(m);
        this.meshes[name][part] = m;
      }
    }
    this.riders = [];      // people on motorbikes (drawn by main.js with the people renderer)
    this.cars = [];
    this.graphVersion = -1;
    this.matrix = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.honks = [];
    this.events = [];      // { type: 'jump', car, ap } for the police
    this.signals = null;   // set by main.js
    this.obstacles = [];   // [x, z, length]: cows, cricket pitches, jaywalkers (set by street life)
    this.extras = [];      // parked/broken-down vehicles drawn with the traffic meshes
    this.night = 0;
  }

  /** Junction graph: segment ends that meet (0.5 m grid) across all loaded tiles. */
  rebuildGraph() {
    this.ends = new Map();
    this.segList = [];
    for (const t of this.tiles.tiles.values()) {
      const rd = t.collide.roads;
      for (let i = 0; i < rd.count; i++) {
        const s = this.tiles.segment(t, i);
        if (!(s[5] & 1)) continue;
        const seg = { t, i, s, len: Math.hypot(s[2] - s[0], s[3] - s[1]) };
        if (seg.len < 0.3) continue;
        this.segList.push(seg);
        for (const end of [0, 1]) {
          const k = `${Math.round(s[end * 2] * 2)},${Math.round(s[end * 2 + 1] * 2)}`;
          (this.ends.get(k) || this.ends.set(k, []).get(k)).push({ seg, end });
        }
      }
    }
    // Join loose ends that almost touch (tile seams, slightly offset OSM nodes) so cars and
    // police don't hit invisible dead ends: both keys then share one list of segment ends.
    const grid = new Map();
    for (const [k, list] of this.ends) {
      const [x, z] = k.split(',').map(Number);
      const g = `${Math.floor(x / 10)},${Math.floor(z / 10)}`; // 5 m cells (keys are in half metres)
      (grid.get(g) || grid.set(g, []).get(g)).push([k, x, z, list]);
    }
    for (const [k, list] of this.ends) {
      if (list.length !== 1) continue;
      const [x, z] = k.split(',').map(Number);
      let best = null, bd = 25; // within 2.5 m (5 half-metres)
      for (let gx = Math.floor(x / 10) - 1; gx <= Math.floor(x / 10) + 1; gx++) for (let gz = Math.floor(z / 10) - 1; gz <= Math.floor(z / 10) + 1; gz++) {
        for (const [k2, x2, z2, l2] of grid.get(`${gx},${gz}`) || []) {
          if (k2 === k || l2 === list || l2.some((e) => e.seg === list[0].seg)) continue;
          const d = (x2 - x) ** 2 + (z2 - z) ** 2;
          if (d < bd) { bd = d; best = k2; }
        }
      }
      if (best) {
        const other = this.ends.get(best);
        other.push(...list);
        this.ends.set(k, other);
        for (const cell of grid.values()) for (const e of cell) if (e[3] === list) e[3] = other;
      }
    }
    this.graphVersion = this.tiles.version;
  }

  /** Vehicle mix by hour: goods tempos run at night, BEST buses and private cars by day. */
  pickType() {
    const night = this.hour >= 22 || this.hour < 6;
    const w = (n) => this.types[n].weight * (night ? { tempo: 3, bus: 0.3, taxi: 1.5, hatch: 0.6, sedan: 0.6 }[n] ?? 1 : 1);
    let r = Math.random() * this.typeNames.reduce((s, n) => s + w(n), 0);
    for (const n of this.typeNames) { r -= w(n); if (r <= 0) return n; }
    return 'hatch';
  }

  spawn(player) {
    for (let tries = 0; tries < 30; tries++) {
      const seg = this.segList[Math.floor(Math.random() * this.segList.length)];
      if (!seg) return;
      const s = seg.s;
      const mx = (s[0] + s[2]) / 2, mz = (s[1] + s[3]) / 2;
      const d = Math.hypot(mx - player.pos.x, mz - player.pos.z);
      if (d < 45 || d > 220) continue;
      const type = this.pickType();
      if (type === 'bus' && !(s[5] & 4)) continue; // buses stick to main roads
      const oneway = s[5] & 2;
      const dir = oneway || Math.random() < 0.5 ? 1 : -1;
      const tints = this.types[type].tints;
      const car = {
        type, seg, dir, t: Math.random(), speed: 0, tint: new THREE.Color(tints[Math.floor(Math.random() * tints.length)]), wait: 0, x: mx, z: mz, heading: 0,
        // Some drivers jump red lights (more at night, never buses); many stop on the zebra.
        jumper: type !== 'bus' && Math.random() < 0.1 + this.night * 0.12, creep: Math.random() < 0.35 ? 2.5 : 0,
        pulled: null, boost: 0, lane: oneway ? 0 : Math.min(s[4] * 0.5, 1.9), lastSig: null, lastDist: 0,
        kerb: type === 'bike' ? 0.6 + Math.random() * 0.8 : 0, // bikes keep further left and squeeze through
        look: type === 'bike' ? riderLook() : null,
      };
      if (this.cars.some((c) => Math.hypot(c.x - mx, c.z - mz) < 12)) continue;
      this.cars.push(car);
      return;
    }
  }

  /** Continue onto a connected segment at the end we are driving towards (prefer straight on). */
  advance(car) {
    const s = car.seg.s;
    const endIdx = car.dir > 0 ? 1 : 0;
    const k = `${Math.round(s[endIdx * 2] * 2)},${Math.round(s[endIdx * 2 + 1] * 2)}`;
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
    const target = Math.round(this.max * clock.traffic);
    this.cars = this.cars.filter((c) => Math.hypot(c.x - player.pos.x, c.z - player.pos.z) < 320);
    if (this.cars.length < target && this.segList.length) this.spawn(player);
    if (this.cars.length > target + 4) { const i = this.cars.findLastIndex((c) => !c.pulled); if (i >= 0) this.cars.splice(i, 1); }

    const night = clock.night;
    for (const car of this.cars) {
      const s = car.seg.s;
      const type = this.types[car.type];
      const fx = ((s[2] - s[0]) / car.seg.len) * car.dir, fz = ((s[3] - s[1]) / car.seg.len) * car.dir;
      // Look ahead for other vehicles and the player in our lane.
      let gap = 40;
      const check = (x, z, len) => {
        const dx = x - car.x, dz = z - car.z;
        const along = dx * fx + dz * fz, lateral = Math.abs(dx * fz - dz * fx);
        if (along > 0 && lateral < (car.squeeze ? 1.3 : 1.9)) gap = Math.min(gap, along - (type.len + len) / 2);
      };
      for (const o of this.cars) if (o !== car) check(o.x, o.z, this.types[o.type].len);
      check(player.pos.x, player.pos.z, 3.7);
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
      // Mumbai driving: stuck behind someone (not at a red light)? Squeeze past on the right,
      // into the oncoming lane if need be. And honk for no reason now and then.
      if (gap < 7 && car.speed < 2.5 && !atRed && !car.pulled && type.len < 6) car.blockedT = (car.blockedT || 0) + dt; else car.blockedT = Math.max(0, (car.blockedT || 0) - dt * 0.5);
      if (car.blockedT > 1.8 && !car.squeeze) { car.squeeze = 4 + Math.random() * 3; if (Math.random() < 0.6) this.honks.push([car.x, car.z]); }
      if (car.squeeze) { car.squeeze -= dt; if (car.squeeze <= 0) car.squeeze = 0; }
      if (Math.random() < dt * 0.015 * (0.3 + jam)) this.honks.push([car.x, car.z]);
      car.t += (car.speed * dt) / car.seg.len;
      while (car.t >= 1) { car.t -= 1; this.advance(car); }
      const s2 = car.seg.s;
      const t = car.dir > 0 ? car.t : 1 - car.t;
      const gx = ((s2[2] - s2[0]) / car.seg.len) * car.dir, gz = ((s2[3] - s2[1]) / car.seg.len) * car.dir;
      const [lx, lz] = LEFT(gx, gz);
      const two = !(s2[5] & 2);
      if (car.yield) { car.yield = Math.max(0, car.yield - dt); }
      const laneWant = car.pulled ? Math.max(0, s2[4] - type.wid / 2 - 0.25)
        : car.yield ? Math.max(0, s2[4] - type.wid / 2 - 0.3)
        : car.squeeze ? (two ? Math.min(s2[4] * 0.5, 1.9) : 0) - 2.4
        : (two ? Math.min(s2[4] * 0.5, 1.9) : 0) + Math.min(car.kerb, Math.max(0, s2[4] - 1.2));
      car.lane += (laneWant - car.lane) * Math.min(1, dt * 1.5);
      const lane = car.lane;
      const px = s2[0] + (s2[2] - s2[0]) * t + lx * lane, pz = s2[1] + (s2[3] - s2[1]) * t + lz * lane;
      // Smooth position and heading through corners.
      const k = Math.min(1, dt * 8);
      car.x += (px - car.x) * k; car.z += (pz - car.z) * k;
      const h = Math.atan2(gx, gz);
      let dh = h - car.heading;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      car.heading += dh * Math.min(1, dt * 6);
    }

    // Write instances.
    const counts = {};
    for (const n of this.typeNames) counts[n] = 0;
    this.riders.length = 0;
    const put = (v) => {
      const ms = this.meshes[v.type];
      if (!ms || counts[v.type] >= this.max) return;
      const i = counts[v.type]++;
      this.q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, v.heading);
      this.matrix.compose(new THREE.Vector3(v.x, 0.02, v.z), this.q, new THREE.Vector3(1, 1, 1));
      for (const part in ms) ms[part].setMatrixAt(i, this.matrix);
      ms.paint.setColorAt(i, v.tint);
      if (this.types[v.type].rider) this.riders.push(v);
    };
    for (const car of this.cars) put(car);
    for (const e of this.extras) put(e);
    this.mats.lamps.color.setScalar(0.7 + this.night * 3.5);
    for (const n of this.typeNames) {
      for (const part in this.meshes[n]) {
        const m = this.meshes[n][part];
        m.count = counts[n];
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
      }
    }
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
  hits(x, z, r) {
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
