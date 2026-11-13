import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HOLI, HOLI_NAMES, addPatch } from '../sim/people.js';

// Holi pichkari, shaped like a toy water gun (pistol grip, trigger, long barrel, clear
// colour tank on top, pump under the barrel). On foot: left mouse / Space sprays where the
// camera looks (right mouse to aim over the shoulder), C or the colour button picks one of
// twelve colours, the mouse wheel or [ ] sets the pressure (range and flow). Drops arc,
// splat on roads, walls and cars, and leave colour patches on people, who react. A few
// people carry their own pichkari and spray back.

export { HOLI };
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
  return new THREE.CanvasTexture(c);
}

/** Toy water-gun geometry (+z = barrel), split into body (bright plastic) and tank (clear). */
export function gunGeometry() {
  const body = mergeGeometries([
    new THREE.BoxGeometry(0.05, 0.14, 0.07).rotateX(0.35).translate(0, -0.08, -0.06),       // grip
    new THREE.BoxGeometry(0.045, 0.07, 0.3).translate(0, 0.0, 0.07),                          // receiver
    new THREE.CylinderGeometry(0.022, 0.026, 0.28, 10).rotateX(Math.PI / 2).translate(0, 0.012, 0.34), // barrel
    new THREE.CylinderGeometry(0.008, 0.016, 0.06, 8).rotateX(Math.PI / 2).translate(0, 0.012, 0.51),  // nozzle
    new THREE.BoxGeometry(0.012, 0.05, 0.05).translate(0, -0.05, 0.02),                        // trigger
    new THREE.TorusGeometry(0.035, 0.007, 4, 10, Math.PI).rotateY(Math.PI / 2).rotateX(Math.PI).translate(0, -0.035, 0.02), // guard
    new THREE.CylinderGeometry(0.03, 0.03, 0.12, 10).rotateX(Math.PI / 2).translate(0, -0.035, 0.27), // pump slide
  ].map((g) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); return g; }));
  const tank = new THREE.CylinderGeometry(0.055, 0.055, 0.2, 12).rotateX(Math.PI / 2).translate(0, 0.085, 0.06);
  return { body, tank };
}

export class Pichkari {
  constructor(scene, ctx) {
    this.ctx = ctx; // { tiles, street, police, traffic, bubbles, audio, hud, combat }
    this.max = 420;
    this.drops = [];
    this.colour = 0;
    this.pressure = 3;     // 1..5
    this.tank = 1;
    this.emitT = 0;
    this.npcEmit = new Map();
    const dropMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, transparent: true, opacity: 0.88 });
    this.dropMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.04, 6, 4), dropMat, this.max);
    this.dropMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.max * 3), 3);
    this.dropMesh.frustumCulled = false;
    this.dropMesh.count = 0;
    this.splatMax = 360;
    this.splatN = 0;
    const splatMat = new THREE.MeshStandardMaterial({ map: blotchTexture(), transparent: true, depthWrite: false, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
    this.splats = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), splatMat, this.splatMax);
    this.splats.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.splatMax * 3), 3);
    this.splats.frustumCulled = false;
    this.splats.count = 0;
    this.splats.receiveShadow = true;
    // The player's gun.
    const { body, tank } = gunGeometry();
    this.gun = new THREE.Group();
    this.tankMat = new THREE.MeshStandardMaterial({ color: HOLI[0], roughness: 0.15, transparent: true, opacity: 0.8 });
    this.gun.add(new THREE.Mesh(body, new THREE.MeshStandardMaterial({ color: 0x19a7e0, roughness: 0.35 })), new THREE.Mesh(tank, this.tankMat));
    this.gun.children.forEach((m) => (m.castShadow = true));
    this.gun.visible = false;
    // NPC guns (a few people carry one).
    this.npcGuns = new THREE.InstancedMesh(mergeGeometries([body, (() => { const t = tank.clone(); t.deleteAttribute('uv'); return t.index ? t.toNonIndexed() : t; })()]), new THREE.MeshStandardMaterial({ color: 0xff8a00, roughness: 0.35 }), 12);
    this.npcGuns.count = 0;
    this.npcGuns.frustumCulled = false;
    scene.add(this.dropMesh, this.splats, this.gun, this.npcGuns);
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.s = new THREE.Vector3(); this.p = new THREE.Vector3(); this.e = new THREE.Euler();
  }

  get colourName() { return HOLI_NAMES[this.colour]; }

  nextColour(dir = 1) {
    this.colour = (this.colour + dir + HOLI.length) % HOLI.length;
    this.tankMat.color.copy(HOLI[this.colour]);
  }

  setPressure(p) { this.pressure = Math.max(1, Math.min(5, p)); }

  addSplat(x, y, z, nx, ny, nz, size, colour) {
    const i = this.splatN++ % this.splatMax;
    this.q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), this.p.set(nx, ny, nz).normalize());
    this.q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.random() * 6.28));
    this.m.compose(new THREE.Vector3(x + nx * 0.01, y + ny * 0.01, z + nz * 0.01), this.q, this.s.set(size, size, size));
    this.splats.setMatrixAt(i, this.m);
    this.splats.setColorAt(i, HOLI[colour]);
    this.splats.count = Math.min(this.splatMax, this.splatN);
    this.splats.instanceMatrix.needsUpdate = true;
    this.splats.instanceColor.needsUpdate = true;
  }

  /** People, animals and cars within reach this frame. */
  targets(walker) {
    const out = [];
    const near = (o) => Math.abs(o.x - walker.pos.x) < 22 && Math.abs(o.z - walker.pos.z) < 22;
    const { street, police, traffic } = this.ctx;
    for (const p of street.peds) if (near(p)) out.push({ o: p, kind: p.kind === 'kid' ? 'kid' : 'ped', r: 0.32 * (p.scale || 1), h: 1.75 * (p.scale || 1) });
    for (const f of street.fixtures.values()) {
      for (const p of f.people || []) if (near(p)) out.push({ o: p, kind: 'npc', r: 0.32, h: 1.7 });
      for (const k of f.kids || []) if (near(k)) out.push({ o: k, kind: 'kid', r: 0.26, h: 1.2 });
      for (const d of f.dogs || []) if (near(d)) out.push({ o: d, kind: 'dog', r: 0.4, h: 0.6 });
      if (f.cow && near(f.cow)) out.push({ o: f.cow, kind: 'cow', r: 0.9, h: 1.5 });
    }
    for (const c of police.cops) if (near(c)) out.push({ o: c, kind: 'cop', r: 0.32, h: 1.8 });
    for (const c of traffic.cars) if (near(c)) out.push({ o: c, kind: 'car', r: 1.1, h: 1.5 });
    return out;
  }

  /** Emit drops from a nozzle along a direction; owner is 'player' or the NPC object. */
  emit(dt, nozzle, dir, colour, pressure, owner) {
    const key = owner === 'player' ? 'player' : owner;
    let acc = (this.npcEmit.get(key) || 0) + dt * (22 + pressure * 9);
    const sp = 6 + pressure * 2.4;
    while (acc >= 1) {
      acc -= 1;
      if (this.drops.length >= this.max) this.drops.shift();
      const j = 0.04 + 0.03 * (5 - pressure) / 4;
      this.drops.push({ x: nozzle.x, y: nozzle.y, z: nozzle.z, vx: (dir[0] + (Math.random() - 0.5) * j) * sp, vy: (dir[1] + (Math.random() - 0.5) * j) * sp + 1.2, vz: (dir[2] + (Math.random() - 0.5) * j) * sp, c: colour, life: 2, owner });
    }
    this.npcEmit.set(key, acc);
  }

  update(dt, walker, firing, view) {
    this.time = (this.time || 0) + dt;
    const active = !!walker && this.ctx.combat?.weapon === 'pichkari';
    this.gun.visible = active;
    let shooting = false;
    if (active) {
      // Gun in the hand: raised along the aim while aiming or spraying, lowered otherwise.
      const raised = walker.spraying || view?.aim;
      const h = walker.heading, fx = Math.sin(h), fz = Math.cos(h), rx = -Math.cos(h), rz = Math.sin(h);
      const side = -0.235; // the arm used by the POINT pose sits on the character's right
      const lx = -side, ly = raised ? 1.32 : 0.92, lz = raised ? 0.5 : 0.12;
      this.gun.position.set(walker.pos.x + lx * Math.cos(h) + lz * fx, walker.pos.y + ly, walker.pos.z - lx * Math.sin(h) + lz * fz);
      const pitch = raised && view ? -view.pitch * 0.9 : 1.1;
      this.gun.rotation.set(0, 0, 0);
      this.gun.quaternion.setFromEuler(this.e.set(raised ? -pitch : 1.1, h, 0, 'YXZ'));
      void rx; void rz;
      shooting = firing && this.tank > 0.01 && walker.down <= 0;
      walker.spraying = firing;
      if (firing && this.tank <= 0.01 && !this.emptyWarned) { this.ctx.hud.message('Pichkari is empty — it refills in a few seconds'); this.emptyWarned = true; }
      if (!firing) this.emptyWarned = false;
      this.tank = shooting ? Math.max(0, this.tank - dt * (0.05 + this.pressure * 0.025)) : Math.min(1, this.tank + dt * 0.07);
      this.tankMat.opacity = 0.35 + this.tank * 0.5;
      if (shooting) {
        const dir = view ? view.forward() : [Math.sin(h), 0, Math.cos(h)];
        // Aim from the nozzle towards the point the camera looks at.
        const nozzle = new THREE.Vector3(0, 0.012, 0.54).applyQuaternion(this.gun.quaternion).add(this.gun.position);
        this.emit(dt, nozzle, dir, this.colour, this.pressure, 'player');
      }
    } else if (walker) walker.spraying = false;
    this.ctx.audio.spray?.(shooting ? 0.5 + this.pressure * 0.1 : 0);
    this.updateDrops(dt, walker);
  }

  /** NPC sprayers (from combat): draw their gun and spray at the player. */
  npcSpray(dt, npc, target, colour) {
    const h = npc.heading, fx = Math.sin(h), fz = Math.cos(h);
    const nozzle = { x: npc.x + Math.cos(h) * 0.235 + fx * 0.95, y: (npc.y || 0) + 1.34, z: npc.z - Math.sin(h) * 0.235 + fz * 0.95 };
    const dx = target.x - nozzle.x, dy = (target.y || 0) + 1.2 - nozzle.y, dz = target.z - nozzle.z, l = Math.hypot(dx, dy, dz) || 1;
    this.emit(dt, nozzle, [dx / l, dy / l - 0.05, dz / l], colour, 3, npc);
  }

  drawNpcGuns(list) {
    let n = 0;
    for (const npc of list) {
      if (n >= 12) break;
      const h = npc.heading, fx = Math.sin(h), fz = Math.cos(h);
      this.q.setFromEuler(this.e.set(0, h, 0, 'YXZ'));
      this.m.compose(this.p.set(npc.x + Math.cos(h) * 0.235 + fx * 0.5, (npc.y || 0) + 1.32, npc.z - Math.sin(h) * 0.235 + fz * 0.5), this.q, this.s.set(1, 1, 1));
      this.npcGuns.setMatrixAt(n++, this.m);
    }
    this.npcGuns.count = n;
    this.npcGuns.instanceMatrix.needsUpdate = true;
  }

  updateDrops(dt, walker) {
    const playerDrops = this.drops.some((d) => d.owner === 'player');
    const targets = walker && playerDrops ? this.targets(walker) : [];
    const { tiles } = this.ctx;
    const alive = [];
    for (const d of this.drops) {
      d.life -= dt;
      d.vy -= 9.8 * dt;
      d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
      let dead = d.life <= 0;
      if (!dead && d.owner === 'player') {
        for (const t of targets) {
          const o = t.o, oy = o.y ?? 0;
          if (Math.abs(d.x - o.x) < t.r && Math.abs(d.z - o.z) < t.r && d.y > oy && d.y < oy + t.h) { this.hit(t, d, walker); dead = true; break; }
        }
      } else if (!dead && walker) {
        // NPC drops hit the player.
        if (Math.abs(d.x - walker.pos.x) < 0.32 && Math.abs(d.z - walker.pos.z) < 0.32 && d.y > walker.pos.y && d.y < walker.pos.y + 1.8) {
          if (Math.random() < 0.18) addPatch(walker, d.x, d.y, d.z, d.c, 0.1 + Math.random() * 0.06);
          dead = true;
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
      this.dropMesh.setColorAt(i++, HOLI[d.c]);
    }
    this.dropMesh.count = i;
    this.dropMesh.instanceMatrix.needsUpdate = true;
    if (this.dropMesh.instanceColor) this.dropMesh.instanceColor.needsUpdate = true;
  }

  hit(t, d, walker) {
    const o = t.o;
    if (t.kind === 'car') { if (o.tint) o.tint.lerp(HOLI[d.c], 0.04); }
    else if (t.kind === 'dog' || t.kind === 'cow') { if (o.coat) o.coat = o.coat.clone().lerp(HOLI[d.c], 0.08); }
    else if (Math.random() < 0.22) addPatch(o, d.x, d.y, d.z, d.c, 0.09 + Math.random() * 0.08 + this.pressure * 0.01);
    this.ctx.combat?.onSprayed(t, walker);
  }
}
