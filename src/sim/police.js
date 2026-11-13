import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { POSE, FLAG, outfit } from './people.js';
import { LIGHT } from './signals.js';
import { createTaxi } from '../vehicles/taxi.js';
import { Car } from '../vehicles/car.js';
import { Y } from '../world/levels.js';

// Traffic police and the "challan" wanted system.
// - Constables stand under umbrellas at about half of the big signal junctions (8 am to 11 pm).
// - Drivers who jump a red in front of one get whistled at: some pull over and get a
//   challan, others floor it and escape.
// - The player's offences (signal jump, wrong way on a one-way, footpath driving) only count
//   when a constable or a patrol car sees them. Each counts as a star. Stop next to the
//   constable to pay; drive off and a patrol car (fictional "Mumbai City Police") comes after
//   you. Stay out of sight long enough and the stars fade.

const FINES = {
  red: ['Signal jump', 1000], wrong: ['Wrong-way driving', 1000], footpath: ['Driving on the footpath', 500], evade: ['Running from the police', 2000], hitrun: ['Hit and run', 1500],
};
const COP_SAYS = {
  whistle: ['Ae! Ruko!', 'Signal laal hai!', 'Side mein lo!', 'Oye! Ruk!'],
  stopped: ['Licence dikhao!', 'Kagaz dikhao!', 'Gaadi side mein lagao!'],
  fine: ['₹1,000 challan!', 'Challan katega!', 'Online bharo, ₹1,000!'],
  missed: ['Number note kar liya!', 'Agli baar dekh lenge!', 'Arre… gaya!'],
  paid: ['Theek hai, jao.', 'Dhyan se chalao!', 'Agli baar nahi chhodenge!'],
};
const DRIVER_SAYS = { sorry: ['Sorry saheb!', 'Galti ho gayi…', 'Jaldi mein tha, saheb!'], escape: ['Bhaago!', 'Pakad ke dikhao!', 'Late ho raha hai!'] };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const hash = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
const rupees = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const nodeKey = (x, z) => `${Math.round(x * 2)},${Math.round(z * 2)}`;

/** Min-heap for A*. */
class Heap {
  constructor() { this.a = []; }
  push(k, v) { const a = this.a; a.push([k, v]); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) { a[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } }
    return top[1];
  }
  get size() { return this.a.length; }
}

function umbrellaGeometry() {
  const parts = [];
  const paint = (g, hex) => {
    g = g.toNonIndexed();
    const c = new THREE.Color(hex), arr = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < arr.length; i += 3) { arr[i] = c.r; arr[i + 1] = c.g; arr[i + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    g.deleteAttribute('uv');
    return g;
  };
  parts.push(paint(new THREE.CylinderGeometry(0.03, 0.03, 2.5, 6).translate(0, 1.25, 0), 0x777777));
  for (let i = 0; i < 8; i++) {
    const seg = new THREE.ConeGeometry(1.25, 0.45, 1, 1, true, (i / 8) * Math.PI * 2, Math.PI / 4).translate(0, 2.55, 0);
    parts.push(paint(seg, i % 2 ? 0xf4f4f0 : 0x1d3f8f));
  }
  parts.push(paint(new THREE.CylinderGeometry(0.55, 0.6, 0.15, 12).translate(0, 0.075, 0), 0xd9d4c4)); // small platform
  return mergeGeometries(parts);
}

export class Police {
  constructor({ scene, tiles, traffic, signals, people, audio, bubbles, hud }) {
    Object.assign(this, { scene, tiles, traffic, signals, people, audio, bubbles, hud });
    this.stars = 0;
    this.fines = 0;
    this.unseen = 0;
    this.seenTimer = 0;
    this.seen = false;
    this.cooldown = { red: 0, wrong: 0, footpath: 0 };
    this.wrongT = 0; this.footT = 0; this.stopT = 0;
    this.pSig = null;
    this.flagger = null;    // constable flagging the player down
    this.patrols = [];
    this.graphVersion = -1;
    this.time = 0;
    this.cops = [];
    const umat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide });
    this.umbrellas = new THREE.InstancedMesh(umbrellaGeometry(), umat, 120);
    this.umbrellas.count = 0;
    this.umbrellas.castShadow = true;
    this.umbrellas.receiveShadow = true;
    this.umbrellas.frustumCulled = false;
    scene.add(this.umbrellas);
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion();
  }

  // ------------------------------------------------------------------ constables
  /** A constable for about half of the main signal junctions, placed on a corner footpath. */
  copFor(site) {
    if (site.copChecked) return site.cop;
    site.copChecked = true;
    site.cop = null;
    if (!site.main || site.approaches.length < 3 || hash(site.x, site.z) > 0.55) return null;
    const ap = site.approaches.find((a) => a.main) || site.approaches[0];
    const lx = ap.fz, lz = -ap.fx;
    // A free spot on the corner footpath next to the signal pole (not inside a building).
    let hx = ap.poleX + ap.fx * 0.8, hz = ap.poleZ + ap.fz * 0.8;
    search: for (const side of [1.0, 0.6, 0.3]) for (const along of [0.8, 2.2, -1.2, 3.5]) {
      const x = ap.poleX + lx * side + ap.fx * along, z = ap.poleZ + lz * side + ap.fz * along;
      if (!this.tiles.hits(x, z, side > 0.5 ? 1.3 : 0.4)) { hx = x; hz = z; break search; }
    }
    const look = outfit('trafficCop');
    site.cop = {
      site, x: hx, y: Y.KERB, z: hz, h: 2.3, homeX: hx, homeZ: hz, ux: hx + lx * 0.5 - ap.fx * 0.3, uz: hz + lz * 0.5 - ap.fz * 0.3, heading: Math.atan2(site.x - hx, site.z - hz),
      phase: Math.random() * 6, pose: POSE.STAND, task: null, idleT: 0, ...look,
    };
    return site.cop;
  }

  activeCops(px, pz, hour) {
    if (hour < 8 || hour > 23) return [];
    const out = [];
    for (const site of this.signals.sites) {
      if ((site.x - px) ** 2 + (site.z - pz) ** 2 > 260 * 260) continue;
      const cop = this.copFor(site);
      if (cop) out.push(cop);
    }
    return out;
  }

  /** Is the straight line between two points free of buildings? */
  los(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 4);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (this.tiles.hits(ax + (bx - ax) * t, az + (bz - az) * t, 0.05)) return false;
    }
    return true;
  }

  /** Nearest constable or chasing patrol car that can see (x, z). */
  witness(x, z) {
    let best = null, bd = Infinity;
    for (const c of this.cops) {
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < 70 && d < bd && this.los(c.x, c.z, x, z)) { best = c; bd = d; }
    }
    for (const p of this.patrols) {
      if (p.mode === 'leave') continue;
      const d = Math.hypot(p.car.pos.x - x, p.car.pos.z - z);
      if (d < 110 && d < bd && this.los(p.car.pos.x, p.car.pos.z, x, z)) { best = p; bd = d; }
    }
    return best;
  }

  whistle(at, player) {
    const d = Math.hypot(at.x - player.pos.x, at.z - player.pos.z);
    this.audio.whistle(1 / (1 + d / 25));
  }

  /** Red-light jumpers in front of a constable: caught or escaped. */
  handleTrafficEvents(player) {
    for (const e of this.traffic.events.splice(0)) {
      if (e.type !== 'jump') continue;
      const car = e.car;
      if (Math.random() < 0.5) this.traffic.honks.push([car.x, car.z]);
      const cop = this.cops.find((c) => c.site === e.ap.site);
      const near = Math.hypot(car.x - player.pos.x, car.z - player.pos.z) < 160;
      if (!cop || cop.task) {
        if (near && Math.random() < 0.35) this.bubbles.say(car, pick(['Chalta hai!', 'Koi nahi dekh raha!', 'Jaldi hai bhai!']), 2.2, 'driver');
        continue;
      }
      this.whistle(cop, player);
      this.bubbles.say(cop, pick(COP_SAYS.whistle), 2.4, 'cop');
      car.h = 2.0;
      if (Math.random() < 0.5) {
        car.pulled = { t: 0, dur: 17 + Math.random() * 6 };
        car.boost = 0;
        cop.task = { type: 'challan', car, t: 0, said: 0 };
        if (near) this.hud.message('Traffic police caught a red-light jumper');
      } else {
        car.boost = 8;
        cop.task = { type: 'shout', car, t: 0, said: 0 };
        setTimeout(() => this.bubbles.say(car, pick(DRIVER_SAYS.escape), 2, 'driver'), 700);
        if (near) this.hud.message('A red-light jumper got away from the traffic police');
      }
    }
  }

  updateCop(cop, dt, player) {
    cop.phase += dt * (cop.pose === POSE.WALK ? 7.5 : 3);
    const task = cop.task;
    const face = (x, z) => {
      const want = Math.atan2(x - cop.x, z - cop.z);
      let d = want - cop.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      cop.heading += d * Math.min(1, dt * 5);
    };
    const walkTo = (x, z, speed = 1.5) => {
      const dx = x - cop.x, dz = z - cop.z, d = Math.hypot(dx, dz);
      if (d < 0.35) return true;
      const step = Math.min(d, speed * dt);
      cop.x += (dx / d) * step; cop.z += (dz / d) * step;
      cop.pose = POSE.WALK;
      face(x, z);
      return false;
    };
    cop.y = this.tiles.groundHeight(cop.x, cop.z);
    if (task?.type === 'challan') {
      const car = task.car;
      task.t += dt;
      const gone = !this.traffic.cars.includes(car) || !car.pulled;
      if (gone) { cop.task = { type: 'home' }; return; }
      if (car.speed > 0.6) { cop.pose = POSE.POINT; face(car.x, car.z); return; }
      // Walk to the driver's window (right-hand drive: road side).
      const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
      const tx = car.x - fz * 1.25 + fx * 0.3, tz = car.z + fx * 1.25 + fz * 0.3;
      if (walkTo(tx, tz)) {
        task.at = (task.at || 0) + dt;
        face(car.x, car.z);
        cop.pose = task.at % 6 < 3 ? POSE.POINT : POSE.ARGUE;
        const near = Math.hypot(cop.x - player.pos.x, cop.z - player.pos.z) < 90;
        if (near && task.said === 0) { this.bubbles.say(cop, pick(COP_SAYS.stopped), 2.6, 'cop'); task.said = 1; }
        if (near && task.said === 1 && task.at > 3) { this.bubbles.say(car, pick(DRIVER_SAYS.sorry), 2.6, 'driver'); task.said = 2; }
        if (near && task.said === 2 && task.at > 6.5) { this.bubbles.say(cop, pick(COP_SAYS.fine), 3, 'cop'); task.said = 3; }
        if (task.at > 10 && car.pulled) car.pulled.dur = Math.min(car.pulled.dur, car.pulled.t + 1.5);
      }
      return;
    }
    if (task?.type === 'shout') {
      task.t += dt;
      cop.pose = POSE.POINT;
      if (this.traffic.cars.includes(task.car)) face(task.car.x, task.car.z);
      if (task.t > 1.6 && task.said === 0) { this.bubbles.say(cop, pick(COP_SAYS.missed), 2.6, 'cop'); task.said = 1; }
      if (task.t > 4) cop.task = null;
      return;
    }
    if (task?.type === 'flag') {
      // Waving the player down.
      task.t += dt;
      cop.pose = POSE.WAVE;
      face(player.pos.x, player.pos.z);
      if (task.t > 14) { cop.task = null; if (this.flagger === cop) this.flagger = null; }
      return;
    }
    if (task?.type === 'home') {
      if (walkTo(cop.homeX, cop.homeZ)) cop.task = null;
      return;
    }
    // Idle: direct the traffic now and then, otherwise stand and watch the junction.
    cop.idleT -= dt;
    if (cop.idleT <= 0) {
      cop.idleT = 3 + Math.random() * 6;
      cop.pose = Math.random() < 0.45 ? POSE.WAVE : POSE.STAND;
      const ap = cop.site.approaches[Math.floor(Math.random() * cop.site.approaches.length)];
      cop.lookAt = ap ? [ap.x - ap.fx * 10, ap.z - ap.fz * 10] : [cop.site.x, cop.site.z];
    }
    if (cop.lookAt) face(cop.lookAt[0], cop.lookAt[1]);
  }

  // ------------------------------------------------------------------ player offences
  offence(kind, player) {
    const [name, amount] = FINES[kind];
    const w = this.witness(player.pos.x, player.pos.z);
    if (!w) {
      if (kind === 'red' && Math.random() < 0.6) this.hud.message(`${name}. Nobody saw… this time.`);
      return;
    }
    this.stars = Math.min(5, this.stars + 1);
    this.fines += amount;
    this.unseen = 0;
    this.hud.message(`Challan! ${name}: ${rupees(amount)}`);
    if (w.site) {
      // A constable saw it: whistle and wave the player down.
      this.whistle(w, player);
      this.bubbles.say(w, kind === 'red' ? 'Ae taxi! Signal laal hai!' : pick(['Ae taxi! Ruko!', 'Side mein lo!']), 2.8, 'cop');
      if (w.task?.type !== 'challan') {
        w.task = { type: 'flag', t: 0 };
        this.flagger = w;
      }
    } else {
      this.bubbles.say(w.car.pos, pick(['Gaadi side mein lo!', 'Ruko! Police!']), 2.6, 'cop');
    }
  }

  checkPlayer(dt, player) {
    for (const k in this.cooldown) this.cooldown[k] = Math.max(0, this.cooldown[k] - dt);
    const fx = Math.sin(player.heading), fz = Math.cos(player.heading);
    const speed = player.speed;
    // Red light: crossing a stop line while red.
    const sig = this.signals.ahead(player.pos.x, player.pos.z, fx, fz, 30);
    if (sig && this.pSig && sig.ap === this.pSig.ap && this.pSig.dist > 0 && sig.dist <= 0 && sig.light === LIGHT.RED && speed > 2 && !this.cooldown.red) {
      this.cooldown.red = 6;
      this.offence('red', player);
    }
    this.pSig = sig;
    // Wrong way on a one-way street.
    const r = this.tiles.roadAt(player.pos.x, player.pos.z, 0, true);
    if (r) {
      const s = this.tiles.segment(r.tile, r.index);
      const len = Math.hypot(s[2] - s[0], s[3] - s[1]) || 1;
      const against = (s[5] & 2) && ((s[2] - s[0]) * fx + (s[3] - s[1]) * fz) / len < -0.5;
      this.wrongT = against && speed > 3 ? this.wrongT + dt : 0;
      this.footT = 0;
    } else {
      // Off the road but next to one: on the footpath.
      const nearRoad = this.tiles.roadAt(player.pos.x, player.pos.z, 4, true);
      this.footT = nearRoad && Math.abs(speed) > 2.5 ? this.footT + dt : 0;
      this.wrongT = 0;
    }
    if (this.wrongT > 2 && !this.cooldown.wrong) { this.cooldown.wrong = 20; this.offence('wrong', player); }
    if (this.footT > 1.2 && !this.cooldown.footpath) { this.cooldown.footpath = 15; this.offence('footpath', player); }

    if (!this.stars) return;
    // Pay up: stop next to the constable who flagged you, or get stopped by a patrol car.
    const slow = Math.abs(speed) < 1.2;
    const f = this.flagger;
    if (f && f.task?.type === 'flag') {
      const d = Math.hypot(f.x - player.pos.x, f.z - player.pos.z);
      this.stopT = slow && d < 20 ? this.stopT + dt : 0;
      if (this.stopT > 1.5) { this.pay(false, f, player); return; }
      if (d > 45) {
        // Drove off from a constable: patrol car incoming.
        this.flagger = null;
        f.task = { type: 'shout', car: { x: player.pos.x, z: player.pos.z }, t: 0, said: 0 };
        this.stars = Math.min(5, this.stars + 1);
        this.fines += FINES.evade[1];
        this.hud.message(`Ran from the traffic police! +${rupees(FINES.evade[1])}`);
      }
      return;
    }
    const close = this.patrols.find((p) => p.mode === 'chase' && p.car.pos.distanceTo(player.pos) < 9);
    this.stopT = close && slow ? this.stopT + dt : 0;
    if (this.stopT > 2) this.pay(true, close, player);
  }

  pay(caught, by, player) {
    const extra = caught ? 500 * this.stars : 0;
    const total = this.fines + extra;
    player.money -= total;
    this.hud.message(caught ? `Pakde gaye! Paid ${rupees(total)} in challans` : `Paid ${rupees(total)} challan`);
    const anchor = by.site ? by : by.car.pos;
    this.bubbles.say(anchor, pick(COP_SAYS.paid), 2.8, 'cop');
    if (by.site) by.task = { type: 'home' };
    this.stars = 0; this.fines = 0; this.stopT = 0; this.flagger = null;
    for (const p of this.patrols) p.mode = 'leave';
  }

  // ------------------------------------------------------------------ patrol cars
  buildGraph() {
    this.graphVersion = this.traffic.graphVersion;
    // One node per junction list (joined loose ends share a list), edges along segments.
    const byList = new Map(), byKey = new Map();
    for (const [k, list] of this.traffic.ends) {
      let n = byList.get(list);
      if (!n) {
        const [x, z] = k.split(',').map((v) => Number(v) / 2);
        n = { x, z, adj: [], comp: 0 };
        byList.set(list, n);
      }
      byKey.set(k, n);
    }
    for (const seg of this.traffic.segList) {
      const s = seg.s;
      const a = byKey.get(nodeKey(s[0], s[1])), b = byKey.get(nodeKey(s[2], s[3]));
      if (a && b && a !== b) { a.adj.push([b, seg.len]); b.adj.push([a, seg.len]); } // police ignore one-ways
    }
    this.nodes = [...byList.values()];
    // Connected components, so patrols only appear where they can reach the player.
    let comp = 0;
    for (const n of this.nodes) {
      if (n.comp) continue;
      comp++;
      const stack = [n];
      n.comp = comp;
      while (stack.length) for (const [nb] of stack.pop().adj) if (!nb.comp) { nb.comp = comp; stack.push(nb); }
    }
    this.grid = new Map();
    for (const n of this.nodes) {
      const g = `${Math.floor(n.x / 30)},${Math.floor(n.z / 30)}`;
      (this.grid.get(g) || this.grid.set(g, []).get(g)).push(n);
    }
  }

  nearestNode(x, z, r = 60) {
    let best = null, bd = r * r;
    for (let gx = Math.floor((x - r) / 30); gx <= Math.floor((x + r) / 30); gx++) for (let gz = Math.floor((z - r) / 30); gz <= Math.floor((z + r) / 30); gz++) {
      for (const n of this.grid.get(`${gx},${gz}`) || []) { const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd) { bd = d; best = n; } }
    }
    return best;
  }

  /** Best graph node in front of a car (close, and not behind it). */
  nodeAhead(pos, heading) {
    const fx = Math.sin(heading), fz = Math.cos(heading);
    let best = null, bs = Infinity;
    for (let gx = Math.floor((pos.x - 50) / 30); gx <= Math.floor((pos.x + 50) / 30); gx++) for (let gz = Math.floor((pos.z - 50) / 30); gz <= Math.floor((pos.z + 50) / 30); gz++) {
      for (const n of this.grid.get(`${gx},${gz}`) || []) {
        const dx = n.x - pos.x, dz = n.z - pos.z, d = Math.hypot(dx, dz);
        if (d > 50) continue;
        const score = d - 25 * ((dx * fx + dz * fz) / (d || 1));
        if (score < bs) { bs = score; best = n; }
      }
    }
    return best;
  }

  leaveNode(pos, player) {
    const dx = pos.x - player.pos.x, dz = pos.z - player.pos.z, l = Math.hypot(dx, dz) || 1;
    return this.nearestNode(pos.x + (dx / l) * 250, pos.z + (dz / l) * 250, 150);
  }

  path(from, to) {
    if (!from || !to) return null;
    const g = new Map([[from, 0]]), prev = new Map(), open = new Heap();
    open.push(0, from);
    let n = 0;
    while (open.size && n++ < 6000) {
      const cur = open.pop();
      if (cur === to) break;
      const gc = g.get(cur);
      for (const [nb, len] of cur.adj) {
        const ng = gc + len;
        if (ng < (g.get(nb) ?? Infinity)) { g.set(nb, ng); prev.set(nb, cur); open.push(ng + Math.hypot(nb.x - to.x, nb.z - to.z), nb); }
      }
    }
    if (!prev.has(to)) return null;
    const out = [];
    for (let c = to; c; c = prev.get(c)) out.push(c);
    return out.reverse();
  }

  spawnPatrol(player) {
    const fx = Math.sin(player.heading), fz = Math.cos(player.heading);
    const home = this.nearestNode(player.pos.x, player.pos.z);
    if (!home) return;
    const nodes = this.nodes.filter((n) => n.comp === home.comp && n.adj.length >= 2);
    for (let tries = 0; tries < 60 && nodes.length; tries++) {
      const node = nodes[Math.floor(Math.random() * nodes.length)];
      const x = node.x, z = node.z;
      const d = Math.hypot(x - player.pos.x, z - player.pos.z);
      if (d < 110 || d > 230) continue;
      if (tries < 40 && ((x - player.pos.x) * fx + (z - player.pos.z) * fz) > 0) continue; // prefer behind
      if (tries < 50 && this.los(x, z, player.pos.x, player.pos.z)) continue;           // appear out of sight
      if (this.tiles.hits(x, z, 1.2)) continue;
      const model = createTaxi({ police: true });
      this.scene.add(model.root);
      const car = new Car(model, { maxSpeed: 23, accel: 6.5, fuel: 1 });
      car.pos.set(x, Y.ROAD, z);
      const next = node.adj[0][0];
      car.heading = Math.atan2(next.x - x, next.z - z);
      this.patrols.push({ car, model, mode: 'chase', route: null, routeT: 0, stuck: 0, reverse: 0, flash: 0, gone: 0 });
      this.hud.message('Police patrol on the way!');
      return;
    }
  }

  drivePatrol(p, dt, player, world) {
    const car = p.car;
    const pos = car.pos;
    const dPlayer = pos.distanceTo(player.pos);
    let tx, tz, cruise = 19;
    if (p.mode === 'chase' && dPlayer < 40 && this.los(pos.x, pos.z, player.pos.x, player.pos.z)) {
      tx = player.pos.x + Math.sin(player.heading) * player.speed * 0.4;
      tz = player.pos.z + Math.cos(player.heading) * player.speed * 0.4;
      cruise = dPlayer < 14 ? Math.max(2.5, Math.abs(player.speed) + 1.5) : 16;
      if (dPlayer < 6.5) cruise = 0;
    } else {
      p.routeT -= dt;
      const goal = p.mode === 'chase' ? this.nearestNode(player.pos.x, player.pos.z) : (p.leaveGoal ||= this.leaveNode(pos, player));
      if (p.routeT <= 0 || !p.route?.length) {
        p.routeT = 1.2;
        if (!p.route?.length || goal !== p.goal) {
          // Plan from the node we are already driving to (or the best one ahead), never from behind.
          const from = p.route?.[0] || this.nodeAhead(pos, car.heading);
          const route = this.path(from, goal);
          p.route = route;
          p.goal = goal;
          if (!route) p.lost = (p.lost || 0) + 1;
        }
      }
      while (p.route?.length > 1 && Math.hypot(p.route[0].x - pos.x, p.route[0].z - pos.z) < 6) p.route.shift();
      if (p.route?.length === 1 && Math.hypot(p.route[0].x - pos.x, p.route[0].z - pos.z) < 6) p.route = null;
      const t = p.route?.[0] ? [p.route[0].x, p.route[0].z] : [player.pos.x, player.pos.z];
      [tx, tz] = t;
    }
    let a = Math.atan2(tx - pos.x, tz - pos.z) - car.heading;
    a = Math.atan2(Math.sin(a), Math.cos(a));
    const want = cruise * THREE.MathUtils.lerp(1, 0.35, Math.min(1, Math.abs(a) / 1.2));
    const input = { steer: THREE.MathUtils.clamp(a * 2.2, -1, 1), fwd: car.speed < want, brake: car.speed > want + 1.5 };
    // Unstick: reverse with opposite lock for a moment.
    if (p.reverse > 0) {
      p.reverse -= dt;
      Object.assign(input, { fwd: false, brake: false, back: true, steer: -input.steer });
    } else if (want > 2 && Math.abs(car.speed) < 0.7) {
      p.stuck += dt;
      if (p.stuck > 1.8) { p.reverse = 1.3; p.stuck = 0; p.stuckCount = (p.stuckCount || 0) + 1; }
    } else p.stuck = 0;
    car.update(dt, input, world);
    // Light bar and siren.
    p.flash += dt;
    const on = p.mode === 'chase';
    const bar = p.model.lights.bar;
    bar.red.emissiveIntensity = on && Math.floor(p.flash * 4) % 2 ? 6 : 0;
    bar.blue.emissiveIntensity = on && !(Math.floor(p.flash * 4) % 2) ? 6 : 0;
    // Teleport-behind cheat when hopelessly stuck or left far behind (hidden from view).
    if (p.mode === 'chase' && ((p.stuckCount || 0) > 3 || dPlayer > 320 || (p.lost || 0) > 3) && !this.los(pos.x, pos.z, player.pos.x, player.pos.z)) {
      p.dead = true;
    }
    if (p.mode === 'leave') {
      p.gone = dPlayer > 160 || !this.los(pos.x, pos.z, player.pos.x, player.pos.z) ? p.gone + dt : 0;
      if (p.gone > 4) p.dead = true;
    }
  }

  hits(x, z, r) {
    for (const p of this.patrols) {
      const c = p.car.pos, fx = Math.sin(p.car.heading) * 1.1, fz = Math.cos(p.car.heading) * 1.1;
      if ((x - c.x - fx) ** 2 + (z - c.z - fz) ** 2 < (r + 0.8) ** 2 || (x - c.x + fx) ** 2 + (z - c.z + fz) ** 2 < (r + 0.8) ** 2) return true;
    }
    return false;
  }

  // ------------------------------------------------------------------ frame
  update(dt, player, clock) {
    this.time += dt;
    this.cops = this.activeCops(player.pos.x, player.pos.z, clock.hour);
    this.handleTrafficEvents(player);
    for (const c of this.cops) this.updateCop(c, dt, player);
    this.checkPlayer(dt, player);

    // Seen or not: stars fade after a while out of sight (longer for more stars).
    if (this.stars) {
      this.seenTimer -= dt;
      if (this.seenTimer <= 0) { this.seenTimer = 0.5; this.seen = !!this.witness(player.pos.x, player.pos.z); }
      // Out of sight: stars fade (slower while a patrol car is searching close by).
      const searching = this.patrols.some((p) => p.mode === 'chase' && p.car.pos.distanceTo(player.pos) < 90);
      this.unseen = this.seen ? 0 : this.unseen + dt * (searching ? 0.4 : 1);
      if (this.unseen > 14 + this.stars * 5) {
        this.stars--;
        this.unseen = 0;
        if (!this.stars) {
          this.fines = 0;
          if (this.flagger) { this.flagger.task = { type: 'home' }; this.flagger = null; }
          for (const p of this.patrols) p.mode = 'leave';
          this.hud.message('Bach gaye! The police lost you.');
        } else this.hud.message('Out of sight… ★ down');
      }
    }

    // Patrol cars: one after you evade, two at four stars.
    if (this.graphVersion !== this.traffic.graphVersion) this.buildGraph();
    const want = this.flagger ? 0 : this.stars >= 4 ? 2 : this.stars >= 2 ? 1 : 0;
    const chasing = this.patrols.filter((p) => p.mode === 'chase').length;
    if (chasing < want && Math.random() < dt * 0.6) this.spawnPatrol(player);
    const world = {
      hits: (x, z, r) => this.tiles.hits(x, z, r) || this.traffic.hits(x, z, r) || Math.hypot(x - player.pos.x, z - player.pos.z) < r + 1.1,
      groundHeight: (x, z) => this.tiles.groundHeight(x, z),
    };
    let siren = 0;
    for (const p of this.patrols) {
      this.drivePatrol(p, dt, player, world);
      if (p.mode === 'chase') siren = Math.max(siren, 1 / (1 + p.car.pos.distanceTo(player.pos) / 40));
    }
    for (const p of this.patrols.filter((p) => p.dead)) this.scene.remove(p.model.root);
    this.patrols = this.patrols.filter((p) => !p.dead);
    this.audio.siren(siren);

    // Draw constables and their umbrellas.
    let n = 0;
    for (const c of this.cops) {
      this.people.add({ x: c.x, y: c.y, z: c.z, heading: c.heading, phase: c.phase, pose: c.pose, amp: 1, flags: FLAG.CAP, shirt: c.shirt, pants: c.pants, skin: c.skin });
      if (n < 120) {
        this.q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, 0);
        this.m.compose(new THREE.Vector3(c.ux, Y.KERB, c.uz), this.q, new THREE.Vector3(1, 1, 1));
        this.umbrellas.setMatrixAt(n++, this.m);
      }
    }
    this.umbrellas.count = n;
    this.umbrellas.instanceMatrix.needsUpdate = true;
  }
}
