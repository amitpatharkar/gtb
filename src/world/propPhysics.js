import * as THREE from 'three';
import { POINT } from './tileFormat.js';

// Street objects you can hit, and what happens when you do:
// - Tree trunks, lamp posts and bus shelters are solid; a hard hit shakes the tree
//   (leaves fall) or bends the lamp post.
// - Thelas are solid too: crash into one and the fruit flies, and the vendor wants money.
// - Garbage piles scatter bags and bottles when you drive through them.
// Loose bits are simple rigid bodies: gravity, bounce, roll, friction.

const TREE = new Set([POINT.RAIN_TREE, POINT.GULMOHAR, POINT.PEEPAL, POINT.PALM]);
const FRUIT = [0xf2b705, 0xd9312b, 0x7cb342, 0xff8f00, 0x8e24aa].map((h) => new THREE.Color(h));

export class PropPhysics {
  constructor(scene, tiles, { bubbles, hud, state, audio }) {
    Object.assign(this, { scene, tiles, bubbles, hud, state, audio });
    this.lastHit = null;
    this.bits = [];
    this.max = 220;
    this.shakes = [];
    this.recent = new Map(); // point id → time last disturbed
    this.time = 0;
    const mk = (geo, mat) => { const m = new THREE.InstancedMesh(geo, mat, this.max); m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.max * 3), 3); m.count = 0; m.frustumCulled = false; m.castShadow = true; scene.add(m); return m; };
    this.meshes = {
      ball: mk(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshStandardMaterial({ roughness: 0.6 })),
      bag: mk(new THREE.IcosahedronGeometry(0.22, 0).scale(1, 0.75, 1), new THREE.MeshStandardMaterial({ roughness: 0.4 })),
      leaf: mk(new THREE.PlaneGeometry(0.12, 0.08), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.8 })),
    };
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.v = new THREE.Vector3(); this.one = new THREE.Vector3(1, 1, 1);
  }

  /** Solid street objects near (x, z). Remembers what was touched for impact effects. */
  hits(x, z, r) {
    for (const t of this.tiles.nearTiles(x, z, r + 3)) {
      const ox = t.origin[0], oz = t.origin[1];
      for (const kind of [POINT.RAIN_TREE, POINT.GULMOHAR, POINT.PEEPAL, POINT.PALM, POINT.LIGHT, POINT.BUS_STOP, POINT.STALL]) {
        const arr = t.points[kind];
        if (!arr) continue;
        for (let i = 0; i < arr.length; i += 5) {
          const px = arr[i] + ox, pz = arr[i + 2] + oz;
          const dx = x - px, dz = z - pz;
          if (dx * dx + dz * dz > (r + 2.4) ** 2) continue;
          let hit = false;
          if (TREE.has(kind)) hit = dx * dx + dz * dz < (r + 0.22 + arr[i + 4] * 0.12) ** 2;
          else if (kind === POINT.LIGHT) hit = dx * dx + dz * dz < (r + 0.14) ** 2;
          else if (kind === POINT.STALL) hit = dx * dx + dz * dz < (r + 0.75) ** 2;
          else {
            // Bus shelter: a 4.4 m × 1.9 m box, rotated.
            const a = arr[i + 3], c = Math.cos(a), s = Math.sin(a);
            const lx = dx * c - dz * s, lz = dx * s + dz * c;
            hit = Math.abs(lx) < 2.2 + r && Math.abs(lz) < 0.95 + r;
          }
          if (hit) { this.lastHit = { t, kind, i: i / 5, x: px, z: pz, time: this.time }; return true; }
        }
      }
    }
    return false;
  }

  spawn(type, x, y, z, vx, vy, vz, colour) {
    if (this.bits.length >= this.max) this.bits.shift();
    this.bits.push({ type, x, y, z, vx, vy, vz, rx: 0, ry: 0, rz: 0, wx: (Math.random() - 0.5) * 10, wy: (Math.random() - 0.5) * 10, wz: (Math.random() - 0.5) * 10, colour, life: 25 + Math.random() * 10, rest: 0 });
  }

  /** The player's car hit something solid at `speed` (m/s), moving along (fx, fz). */
  impact(speed, fx, fz) {
    const h = this.lastHit;
    if (!h || this.time - h.time > 0.2 || speed < 2) return;
    const id = `${h.kind}:${Math.round(h.x)},${Math.round(h.z)}`;
    const first = this.time - (this.recent.get(id) ?? -99) > 4;
    this.recent.set(id, this.time);
    if (TREE.has(h.kind)) {
      this.shake(h, Math.min(1, speed / 10));
      for (let k = 0; k < Math.min(30, speed * 3); k++) this.spawn('leaf', h.x + (Math.random() - 0.5) * 5, 4 + Math.random() * 4, h.z + (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 1.5, -0.3, (Math.random() - 0.5) * 1.5, new THREE.Color(h.kind === POINT.GULMOHAR && Math.random() < 0.5 ? 0xd9461e : 0x4f7d2c));
    } else if (h.kind === POINT.LIGHT && speed > 8) {
      this.shake(h, 1, true);
      if (first) this.hud.message('You bent a street light. BMC will send the bill… eventually.');
    } else if (h.kind === POINT.STALL) {
      for (let k = 0; k < 18; k++) this.spawn('ball', h.x + (Math.random() - 0.5) * 1.2, 1.05, h.z + (Math.random() - 0.5) * 0.6, fx * speed * 0.5 + (Math.random() - 0.5) * 3, 2 + Math.random() * 3, fz * speed * 0.5 + (Math.random() - 0.5) * 3, FRUIT[k % FRUIT.length]);
      if (first) {
        const cost = Math.round(200 + speed * 40);
        this.state.pay(cost, 'Damaged a thela');
        this.bubbles.say({ x: h.x, y: 0.2, z: h.z }, 'Arre! Mera thela! Paise do!', 2.8, 'vendor');
        this.hud.message(`Knocked over a thela — paid the vendor ₹${cost}`);
      }
    }
  }

  /** Garbage piles are not solid: driving through scatters them. */
  sweep(car) {
    const speed = Math.abs(car.speed);
    if (speed < 4) return;
    for (const t of this.tiles.nearTiles(car.pos.x, car.pos.z, 3)) {
      const arr = t.points[POINT.GARBAGE];
      if (!arr) continue;
      for (let i = 0; i < arr.length; i += 5) {
        const x = arr[i] + t.origin[0], z = arr[i + 2] + t.origin[1];
        if ((x - car.pos.x) ** 2 + (z - car.pos.z) ** 2 > 2.2) continue;
        const id = `g:${Math.round(x)},${Math.round(z)}`;
        if (this.time - (this.recent.get(id) ?? -99) < 8) continue;
        this.recent.set(id, this.time);
        const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
        for (let k = 0; k < 9; k++) {
          const c = new THREE.Color([0x1b1b1b, 0x2d4a2d, 0x5a5a5a, 0x9c8a6a, 0x2a3f6b][k % 5]);
          this.spawn(k % 3 ? 'bag' : 'ball', x + (Math.random() - 0.5), 0.4, z + (Math.random() - 0.5), fx * speed * 0.6 + (Math.random() - 0.5) * 3, 1.5 + Math.random() * 2.5, fz * speed * 0.6 + (Math.random() - 0.5) * 3, c);
        }
        this.audio.crash?.(0.15);
      }
    }
  }

  /** Lean a tree or lamp post (instance matrix) and let it spring back, or stay bent. */
  shake(h, amount, permanent = false) {
    const group = h.t.group;
    const meshes = [];
    group.traverse((o) => { if (o.isInstancedMesh && o.userData.kind === h.kind && o.userData.index) { const k = o.userData.index.indexOf(h.i); if (k >= 0) meshes.push([o, k]); } });
    if (!meshes.length) return;
    const base = meshes.map(([o, k]) => { const m = new THREE.Matrix4(); o.getMatrixAt(k, m); return m; });
    this.shakes.push({ meshes, base, t: 0, amount, permanent, dir: Math.random() * Math.PI * 2 });
  }

  update(dt, player) {
    this.time += dt;
    // Shaking trees and bending poles.
    for (const s of [...this.shakes]) {
      s.t += dt;
      const lean = s.permanent ? Math.min(1, s.t * 4) * 0.45 * s.amount : Math.sin(s.t * 9) * Math.exp(-s.t * 2.5) * 0.12 * s.amount;
      s.meshes.forEach(([o, k], j) => {
        const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scl = new THREE.Vector3();
        s.base[j].decompose(pos, quat, scl);
        const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.cos(s.dir) * lean, 0, Math.sin(s.dir) * lean));
        o.setMatrixAt(k, this.m.compose(pos, tilt.multiply(quat), scl));
        o.instanceMatrix.needsUpdate = true;
      });
      if (s.t > (s.permanent ? 0.3 : 2.5)) this.shakes.splice(this.shakes.indexOf(s), 1);
    }
    // Loose bits: gravity, bounce, friction; settle and fade.
    const counts = { ball: 0, bag: 0, leaf: 0 };
    this.bits = this.bits.filter((b) => (b.life -= dt) > 0);
    for (const b of this.bits) {
      if (b.rest < 1) {
        const leaf = b.type === 'leaf';
        b.vy -= (leaf ? 1.2 : 9.8) * dt;
        if (leaf) { b.vx += Math.sin(this.time * 3 + b.x) * dt * 0.8; b.vy = Math.max(b.vy, -0.9); }
        b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
        // Kicked along by the taxi.
        if (player && (b.x - player.pos.x) ** 2 + (b.z - player.pos.z) ** 2 < 1.6 && Math.abs(player.speed) > 1) {
          b.vx += Math.sin(player.heading) * player.speed * 0.5; b.vz += Math.cos(player.heading) * player.speed * 0.5; b.vy += 1.2;
        }
        if (this.tiles.hits(b.x, b.z, 0.05)) { b.vx *= -0.4; b.vz *= -0.4; b.x += b.vx * dt * 2; b.z += b.vz * dt * 2; }
        const g = this.tiles.groundHeight(b.x, b.z) + (leaf ? 0.01 : 0.08);
        if (b.y < g) {
          b.y = g;
          if (leaf) { b.vx = b.vz = b.vy = 0; b.rest = 1; }
          else {
            b.vy = Math.abs(b.vy) > 1 ? -b.vy * 0.35 : 0;
            b.vx *= 0.82; b.vz *= 0.82;
            if (Math.hypot(b.vx, b.vz) < 0.1 && b.vy === 0) b.rest = 1;
          }
        }
        if (!leaf) { b.rx += b.wx * dt; b.ry += b.wy * dt; b.rz += b.wz * dt; b.wx *= 0.98; b.wz *= 0.98; }
        else { b.rx += dt * 3; b.rz += dt * 2; }
      }
      const mesh = this.meshes[b.type];
      const i = counts[b.type]++;
      const fade = Math.min(1, b.life / 3);
      this.q.setFromEuler(this.e.set(b.rx, b.ry, b.rz));
      mesh.setMatrixAt(i, this.m.compose(this.v.set(b.x, b.y, b.z), this.q, this.one.setScalar(fade)));
      mesh.setColorAt(i, b.colour);
    }
    for (const k in this.meshes) {
      const m = this.meshes[k];
      m.count = counts[k];
      m.instanceMatrix.needsUpdate = true;
      m.instanceColor.needsUpdate = true;
    }
  }
}
