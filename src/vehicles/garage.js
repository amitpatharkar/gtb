import * as THREE from 'three';

// Any vehicle on the street can be taken and driven, GTA-style (F next to it on foot).
// The player's Car object stays the same; the Garage swaps what it is: model, size,
// handling, fuel and condition. The kaali-peeli stays parked where it was left and is the
// only vehicle that can do taxi duty; a borrowed vehicle left behind stays on the street.
// Drivers pulled out of their cars shout, chase or run for the police; taking a vehicle in
// front of a constable is a challan.

const OWNER_SAYS = ['Arre! Meri gaadi!', 'Chor! Chor! Pakdo!', 'Oye! Gaadi chhod!', 'Police! Police!', 'EMI abhi baaki hai!'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

/** Handling by type: top speed (m/s) and acceleration; everything else comes from its size. */
const DRIVE = {
  alto: [27, 5.6], wagonr: [28, 5.8], taxi: [28, 5.8], taxiI10: [29, 6], i10: [30, 6.2], swift: [34, 7.2], dzire: [33, 6.8], cabDzire: [33, 6.8],
  city: [38, 7.8], ertiga: [31, 6], cabErtiga: [31, 6], coolcab: [31, 6], innova: [34, 6.4], bolero: [29, 5.4], creta: [36, 7], eeco: [25, 5],
  padmini: [26, 6.2], bus: [18, 2.6], decker: [16, 2.3], ace: [20, 3.6], tempo: [21, 3.2],
  scooter: [22, 6.5], delivery: [22, 6.5], bike: [27, 8], bullet: [30, 7.2],
  auto: [17, 4.2], cycle: [8, 3.2], dabba: [8, 3], ambulance: [30, 6], school: [17, 2.5], tanker: [19, 2.8], compactor: [17, 2.6],
};
/** Rough kerb weights (kg) for collisions. */
export const MASS = {
  alto: 760, wagonr: 850, taxi: 850, taxiI10: 900, i10: 900, swift: 900, dzire: 950, cabDzire: 950, city: 1150, ertiga: 1200, cabErtiga: 1200, coolcab: 1200,
  innova: 1800, bolero: 1650, creta: 1300, eeco: 950, padmini: 900, bus: 11000, decker: 15000, ace: 1100, tempo: 3200, scooter: 110, delivery: 120, bike: 115, bullet: 195,
  auto: 380, cycle: 20, dabba: 40, ambulance: 1000, school: 9000, tanker: 7500, compactor: 8000,
};

export class Garage {
  /**
   * @param {object} o scene, player (Car), taxi (the taxi model), traffic, street, police,
   *   bubbles, audio, hud, combat getter, lamps (objects to move onto the current model)
   */
  constructor(o) {
    Object.assign(this, o);
    this.type = 'taxi';            // what the player Car currently is ('taxi' = the kaali-peeli)
    this.model = null;             // borrowed vehicle model (null in the taxi)
    this.tint = null;
    this.home = null;              // where the taxi is parked while the player drives something else
    this.taxiShape = { radius: this.player.radius, halfLength: this.player.halfLength, maxSpeed: this.player.maxSpeed, accel: this.player.accel, circles: this.player.circles };
    this.paintMats = new Map();
  }

  get inTaxi() { return this.type === 'taxi'; }
  get spec() { return this.traffic.types[this.type === 'taxi' ? 'padmini' : this.type]; }
  get name() { return this.inTaxi ? 'your kaali-peeli' : this.spec.name; }
  get rider() { return !this.inTaxi && !!this.spec.rider; }
  /** The player can be seen driving: two-wheelers and open autos. */
  get seated() { return !this.inTaxi && !!(this.spec.rider || this.spec.open); }

  /** A drivable model built from the fleet's geometry (same four parts as traffic). */
  build(type, tint) {
    const T = this.traffic.types[type], M = this.traffic.mats;
    const key = tint.getHex();
    let paint = this.paintMats.get(key);
    if (!paint) { paint = M.paint.clone(); paint.color.copy(tint); this.paintMats.set(key, paint); }
    const root = new THREE.Group(), body = new THREE.Group();
    for (const [part, mat] of [['paint', paint], ['glass', M.glass], ['trim', M.trim], ['lamps', M.lamps]]) {
      const mesh = new THREE.Mesh(T.parts[part], mat);
      mesh.castShadow = part === 'paint' || part === 'trim';
      mesh.receiveShadow = part !== 'lamps';
      body.add(mesh);
    }
    root.add(body);
    return { root, body, wheels: [], steerers: [], lights: { tailMat: {} }, wheelRadius: 0.3, wheelBase: Math.max(1.2, T.len * 0.62) };
  }

  /** Give the player Car the size and handling of a fleet type (and the engine and horn that go with it). */
  shape(type) {
    const p = this.player, S = type === 'taxi' ? null : this.traffic.types[type];
    if (this.audio) {
      this.audio.engineKind = !S ? 'car' : S.pedal ? 'cycle' : S.rider ? 'bike' : S.open ? 'auto' : S.big ? 'big' : 'car';
      this.audio.hornKind = !S ? null : S.pedal ? 'bell' : S.rider || S.open ? 'peep' : null;
    }
    if (type === 'taxi') { Object.assign(p, this.taxiShape); p.mass = MASS.padmini; return; }
    const T = this.traffic.types[type], [top, accel] = DRIVE[type] || DRIVE[T.base] || [28, 6];
    p.radius = Math.max(0.35, T.wid / 2);
    p.halfLength = Math.max(0, T.len / 2 - p.radius);
    // Long vehicles get extra collision circles between the two ends.
    const n = Math.max(2, Math.ceil((2 * p.halfLength) / (1.6 * p.radius)) + 1);
    p.circles = Array.from({ length: n }, (_, i) => -p.halfLength + (2 * p.halfLength * i) / (n - 1 || 1));
    p.maxSpeed = top; p.accel = accel;
    p.mass = MASS[type] || MASS[T.base] || 1000;
  }

  /**
   * The vehicle a person at (x, z) could get into: the nearest of traffic cars, parked and
   * abandoned vehicles within reach. Returns { kind, v, d } or null.
   */
  nearest(x, z, reach = 2.4) {
    let best = null;
    const test = (v, kind) => {
      if (Math.abs(v.x - x) > 9 || Math.abs(v.z - z) > 9) return;
      const T = this.traffic.types[v.type];
      if (!T) return;
      const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
      const along = THREE.MathUtils.clamp((x - v.x) * fx + (z - v.z) * fz, -T.len / 2, T.len / 2);
      const d = Math.hypot(x - v.x - fx * along, z - v.z - fz * along) - T.wid / 2;
      if (d < reach && (!best || d < best.d)) best = { kind, v, d };
    };
    for (const c of this.traffic.cars) test(c, 'traffic');
    for (const c of this.traffic.parked) test(c, 'parked');
    for (const c of this.traffic.left) test(c, 'left');
    return best;
  }

  /** Leave what we're driving where it stands (the taxi keeps its own model; others join the street). */
  park() {
    const p = this.player;
    if (this.inTaxi) {
      this.home = { x: p.pos.x, z: p.pos.z, heading: p.heading, fuel: p.fuel, condition: p.condition };
      this.homeBody = { pos: new THREE.Vector3(p.pos.x, p.pos.y, p.pos.z), heading: p.heading, condition: p.condition, speed: 0 };
    } else {
      this.traffic.left.push({ type: this.type, x: p.pos.x, z: p.pos.z, heading: p.heading, tint: this.tint, fuel: p.fuel, condition: p.condition, taken: true });
      this.scene.remove(this.model.root);
      this.model = null;
    }
  }

  /** Put the player Car into a vehicle from the street. */
  take(target, walker) {
    const { kind, v } = target, tr = this.traffic, p = this.player;
    this.park();
    if (kind === 'traffic') {
      tr.cars.splice(tr.cars.indexOf(v), 1);
      this.eject(v, walker);
    } else if (kind === 'parked') {
      tr.parked.splice(tr.parked.indexOf(v), 1);
      if (v.key) tr.movedKeys.add(v.key);
      this.audio.horn?.(0.5); // the alarm chirps
    } else tr.left.splice(tr.left.indexOf(v), 1);
    this.type = v.type; this.tint = v.tint.clone();
    this.model = this.build(v.type, this.tint);
    this.scene.add(this.model.root);
    p.model = this.model;
    this.shape(v.type);
    p.pos.set(v.x, p.pos.y, v.z); p.heading = v.heading; p.speed = 0; p.vx = p.vz = 0; p.lastSpeed = 0; p.steer = 0;
    p.fuel = v.fuel ?? 0.35 + Math.random() * 0.55;
    p.condition = v.condition ?? 0.9 + Math.random() * 0.1;
    this.moveLamps(this.model.root, this.spec);
    // Not yours: taking it in front of the police is a challan (not for one you already took).
    if (!v.taken) this.police.offence('theft', walker || p);
    this.hud.message(`${v.taken ? 'Back in' : 'Borrowed'}: ${this.spec.name}${this.spec.big ? ' — wide turns!' : ''}`);
  }

  /** Back into the kaali-peeli (from on foot, standing next to it). */
  toTaxi() {
    if (this.inTaxi) return;
    const p = this.player, h = this.home;
    this.park();
    this.type = 'taxi'; this.tint = null;
    p.model = this.taxi;
    this.shape('taxi');
    p.pos.set(h.x, p.pos.y, h.z); p.heading = h.heading; p.speed = 0; p.vx = p.vz = 0; p.lastSpeed = 0;
    p.fuel = h.fuel; p.condition = h.condition;
    this.home = null;
    this.moveLamps(this.taxi.root, null);
  }

  /** Headlamp lights ride on whatever is being driven. */
  moveLamps(root, spec) {
    const z = spec ? spec.len / 2 - 0.1 : 1.8;
    for (const l of this.lamps || []) { root.add(l, l.target); l.position.z = z; l.target.position.z = z + (l.userData.reach || 20); }
  }

  /** The driver is pulled out: stands by the door, shouts, then chases, fights or flees. */
  eject(car, walker, mode = null) {
    const h = car.heading, rx = -Math.cos(h), rz = Math.sin(h); // driver's side (right-hand drive)
    const look = car.look || this.outfit('casual');
    const ped = {
      ...look, kind: 'driver', flags: 0, scale: 0.96 + Math.random() * 0.1, x: car.x + rx * 1.5, z: car.z + rz * 1.5, y: 0.2,
      heading: Math.atan2(-rx, -rz), phase: 0, pose: 4, state: 'walk', timer: 0, ox: 0, oz: 0, h: 2.1, speed: 1.3, rolled: true, hp: 1,
      seg: car.seg, dir: 1, t: 0.5, side: 1, off: 0,
    };
    this.street.peds.push(ped);
    const r = Math.random();
    this.combat.free(ped, mode || (r < 0.45 ? 'fight' : r < 0.6 ? 'throw' : 'flee'));
    if (mode === 'down') { ped.combat.t = 3 + Math.random() * 2; this.bubbles.say(ped, pick(['Aah! Meri bike!', 'Arre baap re!', 'Andha hai kya?!']), 2.5); return ped; }
    this.bubbles.say(ped, pick(OWNER_SAYS), 3);
    this.audio.bleep?.();
    return ped;
  }

  /** Each step: lean a bike into corners; autos are not allowed in the island city. */
  update(dt = 0.016) {
    if (this.model && this.rider) this.model.body.rotation.z = THREE.MathUtils.clamp(-(this.player.yaw || 0) * Math.abs(this.player.speed) * 0.03, -0.5, 0.5);
    if (this.type === 'auto' && !this.traffic.inSuburbs(this.player.pos.z)) {
      // South of Bandra and Sion: a constable who sees the auto writes a challan (every so often).
      if (!this.townWarned) { this.townWarned = true; this.hud.message('Autos are not allowed in town (south of Bandra and Sion) — a constable who sees you will write a challan'); }
      this.townT = (this.townT || 0) - dt;
      if (this.townT <= 0) { this.townT = 25; this.police.offence('autozone', this.player); }
    } else { this.townWarned = false; this.townT = 0; }
  }

  /** Circles other things should avoid for the parked taxi (while the player drives something else). */
  taxiHits(x, z, r) {
    const h = this.home;
    if (!h) return false;
    const fx = Math.sin(h.heading) * 1.1, fz = Math.cos(h.heading) * 1.1;
    return (x - h.x - fx) ** 2 + (z - h.z - fz) ** 2 < (r + 0.8) ** 2 || (x - h.x + fx) ** 2 + (z - h.z + fz) ** 2 < (r + 0.8) ** 2;
  }
}
