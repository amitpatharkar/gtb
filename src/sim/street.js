import * as THREE from 'three';
import { POSE, FLAG, outfit } from './people.js';
import { APOSE, DOG_COATS, COW_COATS } from './animals.js';
import { LIGHT } from './signals.js';
import { POINT } from '../world/tileFormat.js';
import { Y } from '../world/levels.js';

// Street life near the player, Rockstar style: pedestrians on the footpaths plus small
// hand-made "scenarios" placed from the map data, all spawned only near the player:
// - chai / vada pav / fruit thelas with a vendor calling out and customers around
// - commuters waiting at BEST bus stops
// - stray dogs napping by garbage piles who wake up, bark and chase the taxi
// - a cow sitting on a lane, holding up traffic
// - gully cricket on quiet lanes (kids clear the pitch when a car comes)
// - a broken-down taxi being push-started ("dhakka start")
// - hawkers at red lights selling gajras and phone chargers at your window
// - jaywalkers, pedestrians jumping out of the way, puddle splashes
// - bump a car and its driver gets out to argue and ask for money

const pick = (a, r = Math.random()) => a[Math.floor(r * a.length) % a.length];
const hash = (x, z, k = 0) => { const s = Math.sin(x * 12.9898 + z * 78.233 + k * 37.719) * 43758.5453; return s - Math.floor(s); };
const rupees = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;

const CALLS = [
  ['Garam chai!', 'Cutting chai, das rupaye!', 'Chai-chai-chai!'],
  ['Vada pav! Garam garam!', 'Vada pav, pandrah rupaye!', 'Mirchi ke saath!'],
  ['Bhutta! Garam bhutta!', 'Nimbu-masala bhutta!'],
  ['Kele lo, kele! Darjan chaalis!', 'Taaze aam! Hapus!', 'Chikoo, papita, sab taaza!'],
  ['Nimbu paani, thanda!', 'Ganne ka juice!', 'Kokum sharbat!'],
  ['Pav bhaji tayyar!', 'Bhel puri! Sev puri!', 'Pani puri, chhe ka das!'],
];
const HAWKER = ['Gajra lo, saheb! Das rupaye!', 'Mobile charger, sirf sau rupaye!', 'Aaj ka akhbaar!', 'Gubbare lo, bachchon ke liye!', 'Car ke liye cover, sasta!', 'Kitaab lo, saheb! Bestseller!', 'Tissue paper, bees ka teen!'];
const DODGE = ['Arre! Dekh ke chala!', 'Andha hai kya?!', 'Oye! Footpath hai yeh!', 'Marega kya?!', 'Taxi wale, dhyan se!'];
const BARK = ['Bhow! Bhow!', 'Grrr… bhow!', 'Bhow-bhow-bhow!'];
const CRICKET = ['Out hai!', 'Chhakka!', 'Ball idhar de!', 'Wide hai, wide!', 'Tip-tip, one tip one hand!', 'Run le, run le!'];
const PUSH = ['Dhakka maaro!', 'Ek, do, teen… zor se!', 'Start ho ja yaar!', 'Thoda aur!'];
const ARGUE = ['Ae! Andha hai kya?!', 'Meri gaadi thok di!', 'Nuksaan kaun dega?', 'Paanch sau nikaal, chal!'];

export class StreetLife {
  constructor({ scene, tiles, traffic, signals, people, animals, bubbles, audio, police, tier, hud }) {
    Object.assign(this, { scene, tiles, traffic, signals, people, animals, bubbles, audio, police, hud });
    this.maxPeds = tier.name === 'High' ? 170 : tier.name === 'Medium' ? 120 : 75; // crowds, not a ghost town
    this.peds = [];
    this.fixtures = new Map();
    this.scanT = 0;
    this.prevSpeed = 0;
    this.hawker = null;
    this.argument = null;
    this.redWait = 0;
    this.time = 0;
    // Small extras: cricket stumps and ball, hazard lamps on broken-down cars.
    const mk = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.count = 0; m.frustumCulled = false; m.castShadow = true; scene.add(m); return m; };
    this.stumps = mk(new THREE.CylinderGeometry(0.018, 0.018, 0.7, 5).translate(0, 0.35, 0), new THREE.MeshStandardMaterial({ color: 0xd8c08a, roughness: 0.7 }), 30);
    this.ball = mk(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshStandardMaterial({ color: 0xd4e157, roughness: 0.6 }), 4);
    this.hazard = mk(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), 16);
    this.hazard.castShadow = false;
    this.hazard.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(16 * 3), 3);
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.v = new THREE.Vector3(); this.one = new THREE.Vector3(1, 1, 1);
  }

  // ------------------------------------------------------------------ helpers
  free(x, z, r = 0.3) { return !this.tiles.hits(x, z, r); }
  activity(hour) {
    // People out and about: quiet 1–5 am, busy 8 am – 10 pm.
    if (hour < 5) return 0.12;
    if (hour < 7) return 0.25 + (hour - 5) * 0.2;
    if (hour < 22) return 1;
    return Math.max(0.2, 1 - (hour - 22) * 0.4);
  }
  segPoint(seg, t, dir, side, off) {
    const s = seg.s, len = seg.len;
    const u = dir > 0 ? t : 1 - t;
    const gx = ((s[2] - s[0]) / len) * dir, gz = ((s[3] - s[1]) / len) * dir;
    const lx = gz * side, lz = -gx * side;
    return [s[0] + (s[2] - s[0]) * u + lx * off, s[1] + (s[3] - s[1]) * u + lz * off, Math.atan2(gx, gz), lx, lz];
  }

  // ------------------------------------------------------------------ pedestrians
  kindFor(hour, r) {
    if (hour >= 6 && hour < 9 && r < 0.18) return 'jogger';
    const office = (hour >= 8 && hour < 11) || (hour >= 17 && hour < 20) ? 0.4 : 0.15;
    if (r < office) return 'office';
    if (r < office + 0.22) return 'sari';
    if (r < office + 0.3) return 'worker';
    if (hour > 7 && hour < 20 && r < office + 0.36) return 'kid';
    return 'casual';
  }

  footOffset(seg, side) {
    // On the footpath if there is one (off the carriageway, not in a building); in narrow
    // lanes without footpaths people walk along the edge of the road, like everywhere in Mumbai.
    const hw = seg.s[4];
    const lane = !(seg.s[5] & 4) && hw < 4;
    for (const [off, onRoadOk] of [[hw + 1.1, false], [hw + 0.6, false], [hw + 1.8, false], [hw - 0.5, lane]]) {
      let ok = true;
      for (const t of [0.15, 0.5, 0.85]) {
        const [x, z] = this.segPoint(seg, t, 1, side, off);
        if (!this.free(x, z, 0.25) || (!onRoadOk && this.tiles.roadAt(x, z, 0.3, true))) { ok = false; break; }
      }
      if (ok) return off + (Math.random() - 0.5) * 0.3;
    }
    return null;
  }

  spawnPed(player, hour) {
    const segs = this.traffic.segList;
    for (let tries = 0; tries < 30 && segs.length; tries++) {
      const seg = segs[Math.floor(Math.random() * segs.length)], s = seg.s;
      const mx = (s[0] + s[2]) / 2, mz = (s[1] + s[3]) / 2;
      const d = Math.hypot(mx - player.pos.x, mz - player.pos.z);
      if (d < 18 || d > 120 || seg.len < 6) continue;
      const side = Math.random() < 0.5 ? 1 : -1;
      const off = this.footOffset(seg, side);
      if (off == null) continue;
      const kind = this.kindFor(hour, Math.random());
      const look = outfit(kind === 'jogger' ? 'casual' : kind);
      const speed = kind === 'jogger' ? 2.6 + Math.random() * 0.6 : kind === 'kid' ? 1.4 : 1.05 + Math.random() * 0.45;
      this.peds.push({
        seg, dir: Math.random() < 0.5 ? 1 : -1, t: Math.random(), side, off, speed, kind, ...look,
        flags: kind === 'sari' ? FLAG.SARI : 0, scale: kind === 'kid' ? 0.68 + Math.random() * 0.1 : 0.93 + Math.random() * 0.12,
        x: mx, z: mz, y: Y.KERB, heading: 0, phase: Math.random() * 6, pose: POSE.WALK, state: 'walk', timer: 0, ox: 0, oz: 0,
        h: kind === 'kid' ? 1.5 : 2.1,
      });
      return;
    }
  }

  nextSeg(p) {
    const s = p.seg.s;
    const endIdx = p.dir > 0 ? 1 : 0;
    const k = `${Math.round(s[endIdx * 2] * 2)},${Math.round(s[endIdx * 2 + 1] * 2)}`;
    const opts = (this.traffic.ends.get(k) || []).filter((o) => o.seg !== p.seg);
    if (!opts.length) { p.dir = -p.dir; p.side = -p.side; p.t = 0; return; }
    const o = pick(opts);
    p.seg = o.seg;
    p.dir = o.end === 0 ? 1 : -1;
    p.t = 0;
    const off = this.footOffset(p.seg, p.side);
    if (off == null) { p.dead = true; return; }
    p.off = off;
  }

  updatePeds(dt, player, hour) {
    const want = Math.round(this.maxPeds * this.activity(hour));
    this.peds = this.peds.filter((p) => !p.dead && Math.hypot(p.x - player.pos.x, p.z - player.pos.z) < 150);
    for (let k = 0; k < 3 && this.peds.length < want; k++) this.spawnPed(player, hour);
    const pfx = Math.sin(player.heading), pfz = Math.cos(player.heading);
    for (const p of this.peds) {
      if (p.free) continue; // fighting, fleeing or knocked down: driven by the combat system
      p.timer -= dt;
      if (p.state === 'walk' || p.state === 'cross') {
        if (p.state === 'walk') {
          p.t += (p.speed * dt) / p.seg.len;
          if (p.t >= 1) this.nextSeg(p);
          // A few cross the road wherever they like.
          if (p.kind !== 'jogger' && Math.random() < dt * 0.012 && !(p.seg.s[5] & 4 && Math.random() < 0.6)) { p.state = 'cross'; p.crossTo = -p.off; }
        } else {
          const step = 1.35 * dt * Math.sign(p.crossTo - p.off);
          p.off += step;
          if (Math.abs(p.crossTo - p.off) < 0.1) { p.off = -p.crossTo; p.side = -p.side; p.state = 'walk'; }
        }
        p.pose = POSE.WALK;
        p.phase += dt * p.speed * 4.3;
      } else if (p.state === 'dodge') {
        p.pose = POSE.CROUCH;
        p.phase += dt * 6;
        if (p.timer <= 0) { p.state = 'angry'; p.timer = 2.2; }
      } else if (p.state === 'angry' || p.state === 'watch') {
        p.pose = POSE.ARGUE;
        p.phase += dt * 3;
        const t = p.state === 'angry' ? player.pos : p.watch;
        if (t) p.heading = Math.atan2(t.x - p.x, t.z - p.z);
        if (p.timer <= 0) p.state = 'walk';
      }
      if (p.dead) continue;
      const [bx, bz, h] = this.segPoint(p.seg, Math.min(p.t, 1), p.dir, p.side, p.off);
      p.ox *= Math.exp(-dt * 0.8); p.oz *= Math.exp(-dt * 0.8);
      if (p.state === 'dodge') { p.ox += p.vx * dt; p.oz += p.vz * dt; }
      p.x = bx + p.ox; p.z = bz + p.oz;
      if (p.state === 'cross') p.heading = h + (p.crossTo > p.off ? -Math.PI / 2 : Math.PI / 2) * p.side;
      else if (p.state === 'walk') p.heading = h;
      p.y = this.tiles.groundHeight(p.x, p.z);
      // Jump out of the taxi's way.
      if (p.state === 'walk' || p.state === 'cross') {
        const dx = p.x - player.pos.x, dz = p.z - player.pos.z, d = Math.hypot(dx, dz);
        if (!this.onFoot && d < 5 && Math.abs(player.speed) > 2.5 && (dx * pfx + dz * pfz) * Math.sign(player.speed) > 0) {
          const side = (dx * pfz - dz * pfx) > 0 ? 1 : -1;
          p.vx = pfz * side * 4.5; p.vz = -pfx * side * 4.5;
          p.state = 'dodge'; p.timer = 0.55;
          if (Math.random() < 0.7) this.bubbles.say(p, pick(DODGE), 2.4);
        }
      }
    }
  }

  // ------------------------------------------------------------------ fixtures (scenarios)
  scan(player, hour) {
    const px = player.pos.x, pz = player.pos.z;
    const seen = new Set();
    const add = (id, make) => { seen.add(id); if (!this.fixtures.has(id)) { const f = make(); if (f) this.fixtures.set(id, f); } };
    for (const t of this.tiles.tiles.values()) {
      const [x0, z0, x1, z1] = t.clip;
      if (px < x0 - 120 || px > x1 + 120 || pz < z0 - 120 || pz > z1 + 120) continue;
      const pts = (kind, r, fn) => {
        const arr = t.points[kind];
        if (!arr) return;
        for (let i = 0; i < arr.length; i += 5) {
          const x = arr[i] + t.origin[0], z = arr[i + 2] + t.origin[1];
          if ((x - px) ** 2 + (z - pz) ** 2 < r * r) fn(x, z, arr[i + 3], `${kind}:${Math.round(x)},${Math.round(z)}`);
        }
      };
      pts(POINT.STALL, 90, (x, z, a, id) => add(id, () => this.makeStall(x, z, a, hour)));
      pts(POINT.BUS_STOP, 80, (x, z, a, id) => add(id, () => this.makeBusStop(x, z, hour)));
      pts(POINT.GARBAGE, 90, (x, z, a, id) => { if (hash(x, z, 1) < 0.65) add(id, () => this.makeDogs(x, z)); });
    }
    let cows = 0, crickets = 0, breakdowns = 0;
    for (const f of this.fixtures.values()) { if (f.type === 'cow') cows++; if (f.type === 'cricket') crickets++; if (f.type === 'breakdown') breakdowns++; }
    for (const seg of this.traffic.segList) {
      const s = seg.s;
      const mx = (s[0] + s[2]) / 2, mz = (s[1] + s[3]) / 2;
      const d2 = (mx - px) ** 2 + (mz - pz) ** 2;
      if (d2 > 170 * 170 || d2 < 50 * 50 || seg.len < 16) continue;
      const id = `seg:${Math.round(mx)},${Math.round(mz)}`;
      if (this.fixtures.has(id)) { seen.add(id); continue; }
      const r = hash(mx, mz, 7), main = s[5] & 4;
      if (!main && r < 0.03 && cows < 2) { add(id, () => this.makeCow(seg)); cows++; }
      else if (!main && r > 0.97 && hour >= 7 && hour < 19 && seg.len > 24 && crickets < 1) { add(id, () => this.makeCricket(seg)); crickets++; }
      else if (main && r > 0.4 && r < 0.42 && breakdowns < 1) { add(id, () => this.makeBreakdown(seg)); breakdowns++; }
      else if (r > 0.6 && r < 0.63 && (hour >= 19 || hour < 1) && ![...this.fixtures.values()].some((f) => f.type === 'baraat')) add(id, () => this.makeBaraat(seg));
    }
    for (const [id, f] of this.fixtures) {
      const far = Math.hypot(f.x - px, f.z - pz) > 200;
      if (far || (!seen.has(id) && Math.hypot(f.x - px, f.z - pz) > 120) || f.done) this.fixtures.delete(id);
    }
  }

  person(kind, x, z, heading, pose, rnd = Math.random) {
    return { x, z, y: this.tiles.groundHeight(x, z), heading, pose, phase: rnd() * 6, amp: 1, flags: kind === 'sari' ? FLAG.SARI : 0, scale: kind === 'kid' ? 0.7 + rnd() * 0.08 : 0.94 + rnd() * 0.1, h: kind === 'kid' ? 1.5 : 2.1, ...outfit(kind, rnd) };
  }

  local(x, z, a, lx, lz) { const c = Math.cos(a), s = Math.sin(a); return [x + lx * c + lz * s, z - lx * s + lz * c]; }

  makeStall(x, z, a, hour) {
    let seed = Math.floor(hash(x, z, 3) * 1e6) || 1;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    if (hour < 6 || hour >= 23.5) return { type: 'stall', x, z, people: [], calls: [] };
    const people = [];
    // Vendor behind the cart (or beside it when the footpath is narrow).
    let [vx, vz] = this.local(x, z, a, 0, -0.9);
    if (!this.free(vx, vz, 0.25)) [vx, vz] = this.local(x, z, a, -1.3, -0.1);
    people.push(this.person('worker', vx, vz, Math.atan2(x - vx, z - vz), POSE.STAND, rnd));
    const busy = (hour >= 7 && hour < 11) || (hour >= 16 && hour < 21);
    const n = Math.floor(rnd() * 3) + (busy ? 2 : 0);
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      const [cx, cz] = this.local(x, z, a, side * (1.3 + rnd() * 0.9), 0.2 + rnd() * 0.7);
      if (!this.free(cx, cz, 0.25)) continue;
      const kind = pick(['office', 'casual', 'casual', 'worker', 'sari'], rnd());
      people.push(this.person(kind, cx, cz, Math.atan2(x - cx, z - cz) + (rnd() - 0.5) * 0.8, rnd() < 0.35 ? POSE.ARGUE : POSE.STAND, rnd));
    }
    return { type: 'stall', x, z, people, calls: CALLS[Math.floor(hash(x, z, 9) * CALLS.length)], callT: 2 + rnd() * 8 };
  }

  makeBusStop(x, z, hour) {
    let seed = Math.floor(hash(x, z, 4) * 1e6) || 1;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const people = [];
    const n = hour < 6 || hour > 23 ? 0 : Math.floor(rnd() * 4) + ((hour >= 8 && hour < 11) || (hour >= 17 && hour < 21) ? 3 : 1);
    for (let i = 0; i < n; i++) {
      const px = x + (rnd() - 0.5) * 3.5, pz = z + (rnd() - 0.5) * 1.6;
      if (!this.free(px, pz, 0.25)) continue;
      const p = this.person(pick(['office', 'casual', 'sari', 'kid'], rnd()), px, pz, rnd() * 6.28, rnd() < 0.25 ? POSE.SIT : POSE.STAND, rnd);
      if (p.pose === POSE.SIT) p.y += 0.0;
      people.push(p);
    }
    return { type: 'busstop', x, z, people };
  }

  makeDogs(x, z) {
    const dogs = [];
    const n = hash(x, z, 2) < 0.5 ? 1 : 2;
    for (let i = 0; i < n; i++) {
      const hx = x + (hash(x, z, 10 + i) - 0.5) * 3, hz = z + (hash(x, z, 20 + i) - 0.5) * 3;
      if (!this.free(hx, hz, 0.3)) continue;
      dogs.push({ x: hx, z: hz, y: Y.KERB, homeX: hx, homeZ: hz, heading: hash(x, z, 30 + i) * 6.28, phase: 0, pose: hash(x, z, 40 + i) < 0.65 ? APOSE.LIE : APOSE.SIT, state: 'rest', timer: 0, coat: DOG_COATS[Math.floor(hash(x, z, 50 + i) * DOG_COATS.length)], scale: 0.9 + hash(x, z, 60 + i) * 0.25, h: 1.1 });
    }
    return dogs.length ? { type: 'dogs', x, z, dogs } : null;
  }

  makeCow(seg) {
    const hw = seg.s[4];
    const lateral = Math.max(0, hw - 0.9);
    const [x, z, h] = this.segPoint(seg, 0.5, 1, Math.random() < 0.5 ? 1 : -1, lateral);
    const cow = { x, z, y: this.tiles.groundHeight(x, z), heading: h + (Math.random() - 0.5) * 1.2, phase: 0, pose: Math.random() < 0.5 ? APOSE.LIE : APOSE.STAND, coat: pick(COW_COATS), scale: 0.95 + Math.random() * 0.1, h: 2.0 };
    return { type: 'cow', x, z, cow, mooT: 5 + Math.random() * 20 };
  }

  makeCricket(seg) {
    const kids = [];
    const pitch = 13;
    const t0 = 0.5 - pitch / 2 / seg.len, t1 = 0.5 + pitch / 2 / seg.len;
    const [ax, az, h] = this.segPoint(seg, t0, 1, 1, 0);
    const [bx, bz] = this.segPoint(seg, t1, 1, 1, 0);
    const fx = Math.sin(h), fz = Math.cos(h);
    const mk = (x, z, heading, pose, role) => ({ ...this.person('kid', x, z, heading, pose), role, homeX: x, homeZ: z, baseHeading: heading, basePose: pose });
    kids.push(mk(ax - fx * 0.6, az - fz * 0.6, h, POSE.BAT, 'bat'));
    kids.push(mk(ax - fx * 2.2, az - fz * 2.2, h, POSE.CROUCH, 'keeper'));
    kids.push(mk(bx + fx * 5, bz + fz * 5, h + Math.PI, POSE.STAND, 'bowl'));
    const hw = seg.s[4];
    for (const [along, lat] of [[0.35, 1], [0.7, -1], [1.2, 1]]) {
      const x = ax + (bx - ax) * along + fz * lat * Math.max(1, hw - 0.5), z = az + (bz - az) * along - fx * lat * Math.max(1, hw - 0.5);
      kids.push(mk(x, z, Math.atan2(ax - x, az - z), POSE.STAND, 'field'));
    }
    return { type: 'cricket', x: (ax + bx) / 2, z: (az + bz) / 2, seg, ax, az, bx, bz, fx, fz, hw, kids, t: Math.random() * 8, clear: 0, ball: [bx, 0.5, bz] };
  }

  makeBreakdown(seg) {
    const hw = seg.s[4];
    const [x, z, h, lx, lz] = this.segPoint(seg, 0.45, 1, 1, Math.max(0, hw - 1.0));
    const fx = Math.sin(h), fz = Math.cos(h);
    const car = { type: 'taxi', x, z, heading: h, tint: new THREE.Color(0x060606) };
    const driver = { ...this.person('casual', x + fx * 2.8 - lx * 0.3, z + fz * 2.8 - lz * 0.3, h + Math.PI, POSE.ARGUE), role: 'driver' };
    const pushers = [0.5, -0.5].map((s) => ({ ...this.person(pick(['worker', 'casual']), x - fx * 2.4 + lx * s * 0.5, z - fz * 2.4 + lz * s * 0.5, h, POSE.CROUCH), role: 'push' }));
    return { type: 'breakdown', x, z, car, fx, fz, people: [driver, ...pushers], t: 0, pushes: 0, sayT: 1 };
  }

  /** A wedding procession: dancers, a band and the groom, taking over the road at night. */
  makeBaraat(seg) {
    const people = [];
    const [cx, cz, h, lx, lz] = this.segPoint(seg, 0.5, 1, 1, 0);
    const fx = Math.sin(h), fz = Math.cos(h);
    for (let i = 0; i < 16; i++) {
      const along = (i % 6) * 1.6 - 4, side = (Math.floor(i / 6) - 1) * 1.4 + (Math.random() - 0.5) * 0.6;
      const kind = i < 3 ? 'worker' : pick(['casual', 'sari', 'office', 'sari']);
      const p = this.person(kind, cx + fx * along + lx * side, cz + fz * along + lz * side, h + Math.PI + (Math.random() - 0.5), i < 3 ? POSE.POINT : pick([POSE.ARGUE, POSE.WAVE, POSE.ARGUE]));
      p.dance = Math.random() * 6;
      if (i < 3) { p.shirt = new THREE.Color(0xb22222); p.pants = new THREE.Color(0xf2f2f2); p.flags = 1; } // band in red with caps
      people.push(p);
    }
    const groom = this.person('office', cx - fx * 7, cz - fz * 7, h + Math.PI, POSE.STAND);
    groom.shirt = new THREE.Color(0xf3e5c0); groom.pants = new THREE.Color(0xf3e5c0); groom.flags = 4;
    people.push(groom);
    return { type: 'baraat', x: cx, z: cz, fx, fz, people, t: 0, sayT: 2 };
  }

  updateFixtures(dt, player, hour) {
    const P = player.pos;
    const obstacles = [];
    const extras = [];
    let stumpN = 0, ballN = 0, hazN = 0;
    const blink = Math.floor(this.time * 2.5) % 2 === 0;
    for (const f of this.fixtures.values()) {
      const near = Math.hypot(f.x - P.x, f.z - P.z) < 50;
      if (f.type === 'stall') {
        for (const p of f.people) { p.phase += dt * 2.5; this.people.add(p); }
        f.callT -= dt;
        if (f.callT <= 0 && f.people.length) { f.callT = 9 + Math.random() * 10; if (near) this.bubbles.say(f.people[0], pick(f.calls), 2.6, 'vendor'); }
      } else if (f.type === 'busstop') {
        for (const p of f.people) { p.phase += dt * 2; this.people.add(p); }
      } else if (f.type === 'dogs') {
        for (const d of f.dogs) this.updateDog(d, dt, player);
      } else if (f.type === 'cow') {
        const c = f.cow;
        c.phase += dt * 1.5;
        this.animals.cows.add(c);
        obstacles.push([c.x, c.z, 2.3]);
        f.mooT -= dt;
        if (f.mooT <= 0) { f.mooT = 15 + Math.random() * 25; if (near) this.bubbles.say(c, 'Mooo…', 2); }
      } else if (f.type === 'cricket') {
        this.updateCricket(f, dt, player);
        for (const k of f.kids) this.people.add(k);
        if (!f.clear) obstacles.push([f.x, f.z, 16]);
        for (const [sx, sz] of [[f.ax, f.az], [f.bx, f.bz]]) for (const o of [-0.1, 0, 0.1]) {
          if (stumpN < 30) { this.m.compose(this.v.set(sx + f.fz * o, Y.ROAD, sz - f.fx * o), this.q.identity(), this.one); this.stumps.setMatrixAt(stumpN++, this.m); }
        }
        if (ballN < 4) { this.m.compose(this.v.set(...f.ball), this.q.identity(), this.one); this.ball.setMatrixAt(ballN++, this.m); }
      } else if (f.type === 'baraat') {
        // Dancing in the street: bob, spin and shuffle forward; the band keeps the dhol going.
        f.t += dt;
        for (const p of f.people) {
          p.phase += dt * (p.dance !== undefined ? 7 : 2);
          if (p.dance !== undefined) { p.heading += Math.sin(f.t * 2 + p.dance) * dt * 1.5; p.y = this.tiles.groundHeight(p.x, p.z) + Math.abs(Math.sin(f.t * 6 + p.dance)) * 0.08; }
          p.x += f.fx * dt * 0.15; p.z += f.fz * dt * 0.15;
          this.people.add(p);
        }
        f.x += f.fx * dt * 0.15; f.z += f.fz * dt * 0.15;
        obstacles.push([f.x, f.z, 14]);
        const dist = Math.hypot(f.x - P.x, f.z - P.z);
        if (dist < 70 && Math.floor(f.t * 3.2) !== f.beat) { f.beat = Math.floor(f.t * 3.2); if (f.beat % 4 !== 3) this.audio.punch?.(0.35 / (1 + dist / 15)); }
        f.sayT -= dt;
        if (f.sayT <= 0 && dist < 60) { f.sayT = 5 + Math.random() * 4; this.bubbles.say(pick(f.people), pick(['Aaj mere yaar ki shaadi hai!', 'Nacho! Nacho!', 'Dhol bajao!', 'Baraat aa gayi!', 'Side de do, baraat hai!']), 2.4); }
      } else if (f.type === 'breakdown') {
        this.updateBreakdown(f, dt, player);
        extras.push(f.car);
        obstacles.push([f.car.x, f.car.z, 4]);
        for (const p of f.people) this.people.add(p);
        const fx = Math.sin(f.car.heading), fz = Math.cos(f.car.heading);
        for (const [a, l] of [[1.75, 0.6], [1.75, -0.6], [-1.8, 0.6], [-1.8, -0.6]]) {
          if (hazN >= 16) break;
          this.m.compose(this.v.set(f.car.x + fx * a + fz * l, 0.65, f.car.z + fz * a - fx * l), this.q.identity(), this.one);
          this.hazard.setMatrixAt(hazN, this.m);
          this.hazard.setColorAt(hazN++, blink && !f.started ? new THREE.Color(5, 2.2, 0.2) : new THREE.Color(0.25, 0.12, 0.02));
        }
      }
    }
    for (const [m, n] of [[this.stumps, stumpN], [this.ball, ballN], [this.hazard, hazN]]) {
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    return { obstacles, extras };
  }

  updateDog(d, dt, player) {
    const P = player.pos;
    const dist = Math.hypot(d.x - P.x, d.z - P.z);
    d.y = this.tiles.groundHeight(d.x, d.z);
    if (d.state === 'rest') {
      d.phase += dt;
      if (dist < 10 && Math.abs(player.speed) > 4 && d.timer <= 0) {
        // Woken by the taxi: bark, and sometimes give chase.
        this.bubbles.say(d, pick(BARK), 1.8);
        this.audio.bark?.(1 / (1 + dist / 12));
        d.state = Math.random() < 0.45 ? 'chase' : 'alert';
        d.timer = d.state === 'chase' ? 5 : 3;
      }
      d.timer -= dt;
    } else if (d.state === 'alert') {
      d.pose = APOSE.STAND;
      d.heading = Math.atan2(P.x - d.x, P.z - d.z);
      d.timer -= dt;
      if (d.timer <= 0) { d.state = 'home'; }
    } else if (d.state === 'chase') {
      d.pose = APOSE.RUN;
      d.phase += dt * 16;
      const tx = P.x - Math.sin(player.heading) * 3, tz = P.z - Math.cos(player.heading) * 3;
      const dx = tx - d.x, dz = tz - d.z, l = Math.hypot(dx, dz) || 1;
      const step = Math.min(l, 7.5 * dt);
      const nx = d.x + (dx / l) * step, nz = d.z + (dz / l) * step;
      if (this.free(nx, nz, 0.2)) { d.x = nx; d.z = nz; }
      d.heading = Math.atan2(dx, dz);
      d.timer -= dt;
      if (Math.random() < dt * 0.8) { this.bubbles.say(d, pick(BARK), 1.2); this.audio.bark?.(1 / (1 + dist / 12)); }
      if (d.timer <= 0 || Math.hypot(d.x - d.homeX, d.z - d.homeZ) > 45) d.state = 'home';
    } else if (d.state === 'home') {
      d.pose = APOSE.WALK;
      d.phase += dt * 7;
      const dx = d.homeX - d.x, dz = d.homeZ - d.z, l = Math.hypot(dx, dz);
      if (l < 0.3) { d.state = 'rest'; d.pose = APOSE.LIE; d.timer = 8; }
      else { const step = Math.min(l, 1.6 * dt); d.x += (dx / l) * step; d.z += (dz / l) * step; d.heading = Math.atan2(dx, dz); }
    }
    this.animals.dogs.add(d);
  }

  updateCricket(f, dt, player) {
    // A car (or the taxi) coming: everyone to the side until it has passed.
    let carNear = Math.hypot(player.pos.x - f.x, player.pos.z - f.z) < 26;
    if (!carNear) for (const c of this.traffic.cars) if (Math.hypot(c.x - f.x, c.z - f.z) < 24) { carNear = true; break; }
    if (carNear && !f.clear) { f.clear = 1; this.bubbles.say(f.kids[2], pick(['Gaadi aayi! Side!', 'Car! Car! Side ho jao!']), 2, 'kid'); }
    if (!carNear && f.clear) { f.clear -= dt * 0.35; if (f.clear <= 0) f.clear = 0; }
    for (const k of f.kids) {
      k.y = this.tiles.groundHeight(k.x, k.z);
      if (f.clear) {
        // Step to the edge of the lane.
        const lat = (k.x - f.x) * f.fz - (k.z - f.z) * f.fx;
        const side = lat >= 0 ? 1 : -1;
        const tx = k.homeX + f.fz * side * (f.hw + 0.6), tz = k.homeZ - f.fx * side * (f.hw + 0.6);
        const dx = tx - k.x, dz = tz - k.z, l = Math.hypot(dx, dz);
        if (l > 0.2) { const s = Math.min(l, 2.5 * dt); k.x += (dx / l) * s; k.z += (dz / l) * s; k.pose = POSE.WALK; k.phase += dt * 9; k.heading = Math.atan2(dx, dz); }
        else { k.pose = POSE.STAND; }
        continue;
      }
      const dx = k.homeX - k.x, dz = k.homeZ - k.z, l = Math.hypot(dx, dz);
      if (l > 0.2) { const s = Math.min(l, 2 * dt); k.x += (dx / l) * s; k.z += (dz / l) * s; k.pose = POSE.WALK; k.phase += dt * 9; k.heading = Math.atan2(dx, dz); continue; }
      k.heading = k.baseHeading;
      k.pose = k.basePose;
    }
    if (f.clear) return;
    // One ball every 8 seconds: run-up, delivery, shot, fetch.
    f.t = (f.t + dt) % 8;
    const t = f.t;
    const bowler = f.kids[2], bat = f.kids[0];
    if (t < 2) {
      const k = t / 2;
      bowler.x = f.bx + f.fx * (5 - 5 * k); bowler.z = f.bz + f.fz * (5 - 5 * k);
      bowler.pose = POSE.WALK; bowler.phase += dt * 11;
      f.ball = [bowler.x, 1.1, bowler.z];
      bat.phase = -Math.PI / 2;
    } else if (t < 2.7) {
      const k = (t - 2) / 0.7;
      const bounce = k < 0.7 ? 1.8 * (1 - k / 0.7) + 0.05 : 0.05 + Math.sin(((k - 0.7) / 0.3) * Math.PI) * 0.5;
      f.ball = [f.bx + (f.ax - f.bx) * k, Math.max(0.04, bounce * (k < 0.7 ? 1 - k / 0.7 : 1)), f.bz + (f.az - f.bz) * k];
      bowler.pose = POSE.POINT;
      bat.phase = -Math.PI / 2 + k * 0.5;
    } else {
      if (!f.shot || f.lastT > t) {
        const a = Math.random() * Math.PI * 2;
        f.shot = { dx: Math.sin(a), dz: Math.cos(a), dist: 6 + Math.random() * 14 };
        if (Math.hypot(player.pos.x - f.x, player.pos.z - f.z) < 60 && Math.random() < 0.6) this.bubbles.say(pick(f.kids), pick(CRICKET), 2, 'kid');
        // Now and then the ball goes through someone's window.
        if (f.shot.dist > 15 && Math.random() < 0.25 && Math.hypot(player.pos.x - f.x, player.pos.z - f.z) < 60) {
          f.smash = 1.4;
        }
      }
      const k = Math.min(1, (t - 2.7) / 1.4);
      bat.phase = Math.min(Math.PI / 2, -Math.PI / 2 + (t - 2.7) * 9);
      f.ball = [f.ax + f.shot.dx * f.shot.dist * k, 0.05 + Math.sin(k * Math.PI) * 3.2, f.az + f.shot.dz * f.shot.dist * k];
      if (t > 6.5) {
        const r = (t - 6.5) / 1.5;
        const sx = f.ax + f.shot.dx * f.shot.dist, sz = f.az + f.shot.dz * f.shot.dist;
        f.ball = [sx + (f.bx - sx) * r, 0.5 + Math.sin(r * Math.PI) * 2.5, sz + (f.bz - sz) * r];
      }
    }
    if (f.smash !== undefined && (f.smash -= dt) <= 0) {
      f.smash = undefined;
      this.audio.glass?.();
      this.bubbles.say(f.kids[0], 'Kaanch tod diya! Bhaago!', 2.2, 'kid');
      setTimeout(() => this.bubbles.say({ x: f.ax + f.fz * 8, y: 4, z: f.az - f.fx * 8 }, 'Kaun hai?! Ruko, batata hoon!', 2.6), 900);
    }
    f.lastT = t;
  }

  updateBreakdown(f, dt, player) {
    f.t += dt;
    const [driver, ...pushers] = f.people;
    for (const p of f.people) p.phase += dt * (p.pose === POSE.WALK ? 8 : 3);
    const near = Math.hypot(f.x - player.pos.x, f.z - player.pos.z) < 60;
    if (f.started) {
      // It started! Drive off and leave the helpers waving.
      f.car.x += f.fx * dt * Math.min(8, f.t - f.started); f.car.z += f.fz * dt * Math.min(8, f.t - f.started);
      for (const p of pushers) p.pose = POSE.WAVE;
      if (f.t - f.started > 6) f.done = true;
      return;
    }
    const cycle = f.t % 9;
    const pushing = cycle < 5;
    for (const p of pushers) p.pose = pushing ? POSE.CROUCH : POSE.STAND;
    driver.pose = pushing ? POSE.POINT : POSE.ARGUE;
    if (pushing) {
      const d = dt * 0.7;
      f.car.x += f.fx * d; f.car.z += f.fz * d;
      for (const p of f.people) { p.x += f.fx * d; p.z += f.fz * d; }
      f.x = f.car.x; f.z = f.car.z;
    }
    f.sayT -= dt;
    if (f.sayT <= 0 && near) { f.sayT = 4 + Math.random() * 3; this.bubbles.say(pick(f.people), pick(PUSH), 2.2); }
    if (!pushing && f.lastPushing) {
      f.pushes++;
      if (f.pushes >= 3 && Math.random() < 0.5) { f.started = f.t; if (near) this.bubbles.say(driver, 'Ho gaya start! Shukriya!', 2.5); }
    }
    f.lastPushing = pushing;
  }

  // ------------------------------------------------------------------ situations around the player
  /** Bumping into a car: its driver gets out and demands money. */
  checkBump(dt, player) {
    const drop = this.prevSpeed - Math.abs(player.speed);
    this.prevSpeed = Math.abs(player.speed);
    if (this.argument || drop < 2.2 || this.onFoot) return;
    let car = null, bd = 5;
    for (const c of this.traffic.cars) { const d = Math.hypot(c.x - player.pos.x, c.z - player.pos.z); if (d < bd) { bd = d; car = c; } }
    if (!car) return;
    car.pulled = { t: 0, dur: 30 };
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    const driver = this.person(pick(['casual', 'office', 'worker']), car.x - fz * 1.3, car.z + fx * 1.3, car.heading, POSE.ARGUE);
    this.argument = { car, driver, t: 0, said: 0, stay: 0 };
    // Bystanders turn to watch.
    for (const p of this.peds) if (Math.hypot(p.x - car.x, p.z - car.z) < 25 && p.state === 'walk' && Math.random() < 0.7) { p.state = 'watch'; p.watch = driver; p.timer = 10; }
  }

  updateArgument(dt, player) {
    const a = this.argument;
    if (!a) return;
    a.t += dt;
    const d = a.driver;
    d.phase += dt * 3;
    d.y = this.tiles.groundHeight(d.x, d.z);
    const dist = Math.hypot(d.x - player.pos.x, d.z - player.pos.z);
    if (a.state !== 'leave') {
      // Walk up to the taxi's window and shout.
      const tx = player.pos.x - Math.cos(player.heading) * 1.5, tz = player.pos.z + Math.sin(player.heading) * 1.5;
      const dx = tx - d.x, dz = tz - d.z, l = Math.hypot(dx, dz);
      if (l > 0.6 && dist < 30) { const s = Math.min(l, 1.6 * dt); d.x += (dx / l) * s; d.z += (dz / l) * s; d.pose = POSE.WALK; d.phase += dt * 5; d.heading = Math.atan2(dx, dz); }
      else { d.pose = POSE.ARGUE; d.heading = Math.atan2(player.pos.x - d.x, player.pos.z - d.z); }
      const lines = ARGUE;
      if (a.said < lines.length && a.t > a.said * 2.6 + 0.5) this.bubbles.say(d, lines[a.said++], 2.5);
      a.stay = Math.abs(player.speed) < 1 && dist < 6 ? a.stay + dt : 0;
      if (a.stay > 2.5 && a.said >= 3) {
        if (player.pay) player.pay(500, 'Settled a fender-bender'); else player.money -= 500;
        this.hud.message(`Paid ${rupees(500)} to settle it ("compromise")`);
        this.bubbles.say(d, 'Chal, theek hai. Dhyan se chala!', 2.6);
        a.state = 'leave';
      } else if (dist > 35) {
        this.bubbles.say(d, 'Bhaag gaya! Number note kiya!', 2.5);
        this.police.offence?.('hitrun', player);
        a.state = 'leave';
      }
    } else {
      const c = a.car;
      const dx = c.x - d.x, dz = c.z - d.z, l = Math.hypot(dx, dz);
      if (l > 1.2) { const s = Math.min(l, 1.6 * dt); d.x += (dx / l) * s; d.z += (dz / l) * s; d.pose = POSE.WALK; d.phase += dt * 5; d.heading = Math.atan2(dx, dz); }
      else { if (c.pulled) c.pulled.dur = c.pulled.t + 0.5; this.argument = null; return; }
    }
    if (!this.traffic.cars.includes(a.car)) { this.argument = null; return; }
    this.people.add(d);
  }

  /** Hawkers walk up to the window while you wait at a red light. */
  updateHawker(dt, player) {
    const fx = Math.sin(player.heading), fz = Math.cos(player.heading);
    const sig = this.signals.ahead(player.pos.x, player.pos.z, fx, fz, 20);
    const waiting = !this.onFoot && sig && sig.light !== LIGHT.GREEN && sig.dist > -2 && Math.abs(player.speed) < 0.5;
    this.redWait = waiting ? this.redWait + dt : 0;
    if (!this.hawker && this.redWait > 1.5 && Math.random() < dt * 0.8 && this.time > 3) {
      const hw = sig.ap.hw;
      const sx = player.pos.x + fz * (hw + 1) + fx * 3, sz = player.pos.z - fx * (hw + 1) + fz * 3;
      const look = pick(['worker', 'kid', 'casual', 'sari']);
      this.hawker = { ...this.person(look, sx, sz, 0, POSE.WALK), line: pick(HAWKER), t: 0, homeX: sx, homeZ: sz, said: false };
    }
    const h = this.hawker;
    if (!h) return;
    h.t += dt;
    const leaving = !waiting || h.t > 20;
    // Driver's window: right-hand side of the taxi.
    const tx = leaving ? h.homeX : player.pos.x - fz * 1.25 + fx * 0.2;
    const tz = leaving ? h.homeZ : player.pos.z + fx * 1.25 + fz * 0.2;
    const dx = tx - h.x, dz = tz - h.z, l = Math.hypot(dx, dz);
    if (l > 0.3) { const s = Math.min(l, 1.4 * dt); h.x += (dx / l) * s; h.z += (dz / l) * s; h.pose = POSE.WALK; h.phase += dt * 6; h.heading = Math.atan2(dx, dz); }
    else if (leaving) { this.hawker = null; return; }
    else {
      h.pose = POSE.POINT; h.phase += dt * 2;
      h.heading = Math.atan2(player.pos.x - h.x, player.pos.z - h.z);
      if (!h.said) { this.bubbles.say(h, h.line, 3); h.said = true; }
    }
    h.y = this.tiles.groundHeight(h.x, h.z);
    this.people.add(h);
  }

  onHorn() {
    if (this.hawker?.said) this.bubbles.say(this.hawker, pick(['Arre, gussa kyun? Mat lo!', 'Theek hai saheb, jaata hoon!']), 2.2);
    for (const p of this.peds) if (p.state === 'walk' && Math.hypot(p.x - this.player.pos.x, p.z - this.player.pos.z) < 12 && Math.random() < 0.3) this.bubbles.say(p, pick(['Haan haan, ja na!', 'Horn mat bajao!', 'Kitna horn!']), 1.8);
  }

  /** Splashing pedestrians through puddles. */
  checkPuddles(player) {
    if (Math.abs(player.speed) < 6) return;
    const P = player.pos;
    for (const t of this.tiles.nearTiles(P.x, P.z, 4)) {
      const arr = t.points[POINT.PUDDLE];
      if (!arr) continue;
      for (let i = 0; i < arr.length; i += 5) {
        const x = arr[i] + t.origin[0], z = arr[i + 2] + t.origin[1];
        if ((x - P.x) ** 2 + (z - P.z) ** 2 > 2.2) continue;
        for (const p of this.peds) {
          if (Math.hypot(p.x - x, p.z - z) < 5 && p.state !== 'angry') {
            p.state = 'angry'; p.timer = 3;
            this.bubbles.say(p, pick(['Arre! Kapde kharab kar diye!', 'Paani uda diya, bhai!', 'Oye! Dekh ke!']), 2.6);
          }
        }
      }
    }
  }

  hits(x, z, r) {
    for (const f of this.fixtures.values()) {
      if (f.type === 'cow') {
        const c = f.cow, fx = Math.sin(c.heading) * 0.6, fz = Math.cos(c.heading) * 0.6;
        if ((x - c.x - fx) ** 2 + (z - c.z - fz) ** 2 < (r + 0.6) ** 2 || (x - c.x + fx) ** 2 + (z - c.z + fz) ** 2 < (r + 0.6) ** 2) return true;
      } else if (f.type === 'baraat') {
        // Dancing in the street: bob, spin and shuffle forward; the band keeps the dhol going.
        f.t += dt;
        for (const p of f.people) {
          p.phase += dt * (p.dance !== undefined ? 7 : 2);
          if (p.dance !== undefined) { p.heading += Math.sin(f.t * 2 + p.dance) * dt * 1.5; p.y = this.tiles.groundHeight(p.x, p.z) + Math.abs(Math.sin(f.t * 6 + p.dance)) * 0.08; }
          p.x += f.fx * dt * 0.15; p.z += f.fz * dt * 0.15;
          this.people.add(p);
        }
        f.x += f.fx * dt * 0.15; f.z += f.fz * dt * 0.15;
        obstacles.push([f.x, f.z, 14]);
        const dist = Math.hypot(f.x - P.x, f.z - P.z);
        if (dist < 70 && Math.floor(f.t * 3.2) !== f.beat) { f.beat = Math.floor(f.t * 3.2); if (f.beat % 4 !== 3) this.audio.punch?.(0.35 / (1 + dist / 15)); }
        f.sayT -= dt;
        if (f.sayT <= 0 && dist < 60) { f.sayT = 5 + Math.random() * 4; this.bubbles.say(pick(f.people), pick(['Aaj mere yaar ki shaadi hai!', 'Nacho! Nacho!', 'Dhol bajao!', 'Baraat aa gayi!', 'Side de do, baraat hai!']), 2.4); }
      } else if (f.type === 'breakdown') {
        const c = f.car, fx = Math.sin(c.heading) * 1.1, fz = Math.cos(c.heading) * 1.1;
        if ((x - c.x - fx) ** 2 + (z - c.z - fz) ** 2 < (r + 0.75) ** 2 || (x - c.x + fx) ** 2 + (z - c.z + fz) ** 2 < (r + 0.75) ** 2) return true;
      }
    }
    return false;
  }

  update(dt, player, clock) {
    this.time += dt;
    this.player = player;
    const hour = clock.hour;
    this.scanT -= dt;
    if (this.scanT <= 0) { this.scanT = 1; this.scan(player, hour); }
    this.animals.begin();
    this.updatePeds(dt, player, hour);
    for (const p of this.peds) this.people.add(p);
    const { obstacles, extras } = this.updateFixtures(dt, player, hour);
    // Jaywalkers on the road are obstacles too.
    for (const p of this.peds) if (p.state === 'cross') obstacles.push([p.x, p.z, 0.8]);
    if (this.hawker) obstacles.push([this.hawker.x, this.hawker.z, 0.6]);
    this.traffic.obstacles = obstacles;
    this.traffic.extras = extras;
    this.checkBump(dt, player);
    this.updateArgument(dt, player);
    this.updateHawker(dt, player);
    this.checkPuddles(player);
    this.animals.end();
  }
}
