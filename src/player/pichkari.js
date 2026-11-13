import * as THREE from 'three';
import { POSE } from '../sim/people.js';
import { APOSE } from '../sim/animals.js';

// Holi pichkari (water-colour squirt gun), used on foot: hold Space (or the 💦 button) to
// spray, C to change colour. Colour drops arc through the air and splat on the ground,
// walls, cars and people. People react: some laugh "Bura na mano, Holi hai!", some get
// angry; colour a policeman and it's a challan. The tank refills slowly.

export const HOLI = [0xff2e88, 0x1fbf4f, 0xffd400, 0x1e7bff, 0xff7a00, 0x9b30ff].map((h) => new THREE.Color(h));
const NAMES = ['Gulabi', 'Hara', 'Peela', 'Neela', 'Kesari', 'Jamuni'];
const HAPPY = ['Bura na mano, Holi hai!', 'Holi hai! Haha!', 'Rang barse!', 'Arre waah, mujhe bhi do!'];
const ANGRY = ['Arre! Mere kapde!', 'Holi nahi hai aaj!', 'Office jaana hai, yaar!', 'Pagal hai kya?!'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

function blotchTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * 38;
    g.globalAlpha = 0.5 + Math.random() * 0.5;
    g.beginPath(); g.arc(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 6 + Math.random() * 20, 0, 7); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  return t;
}

export class Pichkari {
  constructor(scene, ctx) {
    this.ctx = ctx; // { tiles, street, police, traffic, bubbles, audio, hud, player }
    this.max = 360;
    this.drops = [];
    this.colour = 0;
    this.tank = 1;
    this.emitT = 0;
    this.reactT = new WeakMap();
    const dropMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, transparent: true, opacity: 0.85 });
    this.dropMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 6, 4), dropMat, this.max);
    this.dropMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.max * 3), 3);
    this.dropMesh.frustumCulled = false;
    this.dropMesh.count = 0;
    this.splatMax = 320;
    this.splatN = 0;
    const splatMat = new THREE.MeshStandardMaterial({ map: blotchTexture(), transparent: true, depthWrite: false, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
    this.splats = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), splatMat, this.splatMax);
    this.splats.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.splatMax * 3), 3);
    this.splats.frustumCulled = false;
    this.splats.count = 0;
    this.splats.receiveShadow = true;
    // The pichkari itself: a bright plastic body with a long nozzle and a tank.
    this.gun = new THREE.Group();
    const plastic = new THREE.MeshStandardMaterial({ color: 0x18b6e8, roughness: 0.35 });
    this.tankMat = new THREE.MeshStandardMaterial({ color: HOLI[0], roughness: 0.2, transparent: true, opacity: 0.85 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.32, 10).rotateX(Math.PI / 2), plastic);
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.22, 8).rotateX(Math.PI / 2).translate(0, 0.01, 0.26), plastic);
    const tank = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8).translate(0, 0.07, -0.04), this.tankMat);
    this.gun.add(body, nozzle, tank);
    this.gun.visible = false;
    scene.add(this.dropMesh, this.splats, this.gun);
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.s = new THREE.Vector3(); this.p = new THREE.Vector3();
  }

  nextColour() {
    this.colour = (this.colour + 1) % HOLI.length;
    this.tankMat.color.copy(HOLI[this.colour]);
    this.ctx.hud.message(`Pichkari colour: ${NAMES[this.colour]}`);
  }

  addSplat(x, y, z, nx, ny, nz, size, colour) {
    const i = this.splatN++ % this.splatMax;
    this.q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), this.p.set(nx, ny, nz).normalize());
    this.q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.random() * 6.28));
    this.m.compose(new THREE.Vector3(x + nx * 0.01, y + ny * 0.01, z + nz * 0.01), this.q, this.s.set(size, size, size));
    this.splats.setMatrixAt(i, this.m);
    this.splats.setColorAt(i, colour);
    this.splats.count = Math.min(this.splatMax, this.splatN);
    this.splats.instanceMatrix.needsUpdate = true;
    this.splats.instanceColor.needsUpdate = true;
  }

  /** People and animals within reach this frame, with how to react to a hit. */
  targets(walker) {
    const out = [];
    const near = (o) => Math.abs(o.x - walker.pos.x) < 16 && Math.abs(o.z - walker.pos.z) < 16;
    const { street, police, traffic } = this.ctx;
    for (const p of street.peds) if (near(p)) out.push({ o: p, kind: 'ped', r: 0.35, h: 1.75 * (p.scale || 1) });
    for (const f of street.fixtures.values()) {
      for (const p of f.people || []) if (near(p)) out.push({ o: p, kind: 'npc', r: 0.35, h: 1.7 });
      for (const k of f.kids || []) if (near(k)) out.push({ o: k, kind: 'kid', r: 0.3, h: 1.2 });
      for (const d of f.dogs || []) if (near(d)) out.push({ o: d, kind: 'dog', r: 0.4, h: 0.6 });
      if (f.cow && near(f.cow)) out.push({ o: f.cow, kind: 'cow', r: 0.9, h: 1.5 });
    }
    for (const c of police.cops) if (near(c)) out.push({ o: c, kind: 'cop', r: 0.35, h: 1.8 });
    for (const c of traffic.cars) if (near(c)) out.push({ o: c, kind: 'car', r: 1.2, h: 1.5 });
    return out;
  }

  hit(t, colour, walker) {
    const o = t.o;
    if (o.shirt) { o.shirt = o.shirt.clone().lerp(colour, 0.3); if (o.pants) o.pants = o.pants.clone().lerp(colour, 0.12); if (o.skin) o.skin = o.skin.clone().lerp(colour, 0.06); }
    if (o.coat) o.coat = o.coat.clone().lerp(colour, 0.25);
    if (o.tint) o.tint.lerp(colour, 0.15);
    const last = this.reactT.get(o) || 0;
    if (this.time - last < 3) return;
    this.reactT.set(o, this.time);
    const { bubbles, police, traffic, audio } = this.ctx;
    if (t.kind === 'cop') {
      bubbles.say(o, pick(['Arre! Pulis waale pe rang?!', 'Holi khatam ho gayi, bhai!', 'Ruk, challan kaatta hoon!']), 2.6, 'cop');
      police.offence('holiCop', walker);
    } else if (t.kind === 'car') {
      traffic.honks.push([o.x, o.z]);
      if (Math.random() < 0.5) bubbles.say(o, pick(['Oye! Gaadi pe rang!', 'Abhi wash karayi thi!']), 2.2, 'driver');
    } else if (t.kind === 'dog') {
      bubbles.say(o, 'Kai-kai-kai!', 1.5);
      audio.bark?.(0.6);
      o.state = 'home'; o.pose = APOSE.RUN;
    } else if (t.kind === 'cow') {
      bubbles.say(o, 'Mooo… (unimpressed)', 2);
    } else {
      const happy = t.kind === 'kid' ? Math.random() < 0.85 : Math.random() < 0.55;
      bubbles.say(o, pick(happy ? HAPPY : ANGRY), 2.4, t.kind === 'kid' ? 'kid' : '');
      if ('state' in o && o.state !== undefined) { o.state = 'angry'; o.timer = 2.5; }
      else { o.pose = POSE.ARGUE; }
    }
  }

  update(dt, walker, firing) {
    this.time = (this.time || 0) + dt;
    const active = !!walker;
    this.gun.visible = active;
    if (!active) { this.ctx.audio.spray?.(0); return; }
    // Gun in the raised hand.
    const h = walker.heading, fx = Math.sin(h), fz = Math.cos(h);
    const raised = walker.spraying;
    const lx = 0.235, ly = raised ? 1.33 : 0.95, lz = raised ? 0.62 : 0.15;
    this.gun.position.set(walker.pos.x + lx * Math.cos(h) + lz * fx, walker.pos.y + ly, walker.pos.z - lx * Math.sin(h) + lz * fz);
    this.gun.rotation.set(raised ? 0 : 1.2, h, 0);
    const shooting = firing && this.tank > 0.01 && walker.down <= 0;
    walker.spraying = firing;
    if (firing && this.tank <= 0.01 && !this.emptyWarned) { this.ctx.hud.message('Pichkari is empty — it refills in a few seconds'); this.emptyWarned = true; }
    if (!firing) this.emptyWarned = false;
    this.tank = shooting ? Math.max(0, this.tank - dt * 0.12) : Math.min(1, this.tank + dt * 0.07);
    this.ctx.audio.spray?.(shooting ? 1 : 0);
    if (shooting) {
      this.emitT += dt * 45;
      const col = HOLI[this.colour];
      while (this.emitT >= 1) {
        this.emitT -= 1;
        if (this.drops.length >= this.max) this.drops.shift();
        const nx = this.gun.position.x + fx * 0.38, nz = this.gun.position.z + fz * 0.38;
        const sp = 9 + Math.random() * 1.5;
        this.drops.push({ x: nx, y: this.gun.position.y + 0.02, z: nz, vx: fx * sp + (Math.random() - 0.5) * 0.7, vy: 1.6 + Math.random() * 0.8, vz: fz * sp + (Math.random() - 0.5) * 0.7, c: col, life: 1.6 });
      }
    }
    // Fly, fall, hit.
    const targets = this.drops.length ? this.targets(walker) : [];
    const { tiles } = this.ctx;
    const alive = [];
    for (const d of this.drops) {
      d.life -= dt;
      d.vy -= 9.8 * dt;
      d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
      let dead = d.life <= 0;
      if (!dead) {
        for (const t of targets) {
          const o = t.o, oy = o.y ?? 0;
          if (Math.abs(d.x - o.x) < t.r && Math.abs(d.z - o.z) < t.r && d.y > oy && d.y < oy + t.h) { this.hit(t, d.c, walker); dead = true; break; }
        }
      }
      if (!dead && d.y < 12 && tiles.hits(d.x, d.z, 0.02)) {
        const l = Math.hypot(d.vx, d.vz) || 1;
        if (Math.random() < 0.25) this.addSplat(d.x - (d.vx / l) * 0.05, d.y, d.z - (d.vz / l) * 0.05, -d.vx / l, 0, -d.vz / l, 0.35 + Math.random() * 0.3, d.c);
        dead = true;
      }
      if (!dead) {
        const g = tiles.groundHeight(d.x, d.z);
        if (d.y <= g + 0.01) { if (Math.random() < 0.3) this.addSplat(d.x, g + 0.012, d.z, 0, 1, 0, 0.3 + Math.random() * 0.45, d.c); dead = true; }
      }
      if (!dead) alive.push(d);
    }
    this.drops = alive;
    let i = 0;
    for (const d of this.drops) {
      this.m.makeTranslation(d.x, d.y, d.z);
      this.dropMesh.setMatrixAt(i, this.m);
      this.dropMesh.setColorAt(i++, d.c);
    }
    this.dropMesh.count = i;
    this.dropMesh.instanceMatrix.needsUpdate = true;
    if (this.dropMesh.instanceColor) this.dropMesh.instanceColor.needsUpdate = true;
  }
}
