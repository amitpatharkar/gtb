import * as THREE from 'three';

// Visible damage on the player's taxi, driven by crashes and the car's condition:
// dents pushed into the panels where it hit, bumpers hanging loose, headlamps that flicker
// and then die, and smoke from the bonnet (grey, then black). A full repair at a petrol
// pump or with a JhatPat kit straightens everything out again.

function smokeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class TaxiDamage {
  constructor(scene, model) {
    this.model = model;
    this.originals = model.dentable.map((m) => m.geometry.attributes.position.array.slice());
    this.front = 0; this.rear = 0; this.left = 0; this.right = 0;
    this.flicker = 0;
    // Smoke puffs (points).
    this.max = 70;
    this.puffs = [];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.max * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.max * 4), 4)); // rgba: puffs fade near the camera
    this.smoke = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.6, map: smokeTexture(), vertexColors: true, transparent: true, depthWrite: false, opacity: 0.55 }));
    this.smoke.frustumCulled = false;
    scene.add(this.smoke);
    this.emitT = 0;
  }

  /** A crash: local direction of the hit (+z front, -z rear, ±x sides) and how hard (m/s). */
  impact(lx, lz, speed) {
    const depth = Math.min(0.14, speed * 0.008);
    if (depth < 0.01) return;
    const L = this.model.length / 2;
    // Where it hit, in model space.
    const px = THREE.MathUtils.clamp(lx * 0.8, -0.75, 0.75), pz = THREE.MathUtils.clamp(lz * L, -L, L), py = 0.6;
    const radius = 0.45 + speed * 0.02;
    for (const m of this.model.dentable) {
      const pos = m.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        const d = Math.hypot(x - px, (y - py) * 0.7, z - pz);
        if (d > radius) continue;
        const k = (1 - d / radius) ** 2 * depth * (0.7 + Math.random() * 0.6);
        // Push the panel in, away from the hit side.
        pos.setXYZ(i, x - Math.sign(lx) * k * Math.abs(lx), y - k * 0.3, z - Math.sign(lz) * k * Math.abs(lz));
      }
      pos.needsUpdate = true;
      m.geometry.computeVertexNormals();
    }
    if (lz > 0.5) this.front += speed; else if (lz < -0.5) this.rear += speed;
    if (lx > 0.5) this.left += speed; else if (lx < -0.5) this.right += speed;
    const b = this.model.bumpers;
    if (this.front > 12) { b.front.rotation.z = Math.min(0.25, (this.front - 12) * 0.01); b.front.position.y = -Math.min(0.08, (this.front - 12) * 0.003); }
    if (this.rear > 12) { b.rear.rotation.z = -Math.min(0.25, (this.rear - 12) * 0.01); b.rear.position.y = -Math.min(0.08, (this.rear - 12) * 0.003); }
  }

  repair() {
    this.model.dentable.forEach((m, k) => { m.geometry.attributes.position.array.set(this.originals[k]); m.geometry.attributes.position.needsUpdate = true; m.geometry.computeVertexNormals(); });
    this.front = this.rear = this.left = this.right = 0;
    for (const b of Object.values(this.model.bumpers)) { b.rotation.set(0, 0, 0); b.position.set(0, 0, 0); }
  }

  /** Headlamps flicker below half condition and die below a quarter, or after a hard front hit. */
  headlampFactor(condition) {
    if (condition < 0.25 || this.front > 40) return 0;
    if (condition < 0.5) { this.flicker = Math.random() < 0.12 ? 0.15 : 1; return this.flicker; }
    return 1;
  }

  update(dt, car, camera = null) {
    // A thin wisp from under the bonnet when the engine is suffering; the puffs move with
    // the car (so they never trail back over the camera) and fade out close to the lens.
    const c = car.condition;
    const rate = c < 0.35 ? (0.35 - c) * 30 : 0;
    this.emitT += dt * rate;
    const h = car.heading, fx = Math.sin(h), fz = Math.cos(h);
    const vx = fx * car.speed, vz = fz * car.speed;
    while (this.emitT >= 1 && this.puffs.length < this.max) {
      this.emitT -= 1;
      const dark = c < 0.15;
      this.puffs.push({ x: car.pos.x + fx * 1.55 + (Math.random() - 0.5) * 0.3, y: car.pos.y + 0.85, z: car.pos.z + fz * 1.55 + (Math.random() - 0.5) * 0.3, vx: vx + (Math.random() - 0.5) * 0.3, vy: 0.7 + Math.random() * 0.4, vz: vz + (Math.random() - 0.5) * 0.3, life: 1.3, shade: dark ? 0.15 : 0.7 });
    }
    if (this.emitT > 1) this.emitT = 1;
    const pos = this.smoke.geometry.attributes.position, col = this.smoke.geometry.attributes.color;
    let n = 0;
    this.puffs = this.puffs.filter((p) => (p.life -= dt) > 0);
    for (const p of this.puffs) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.vx += (vx - p.vx) * Math.min(1, dt * 3); p.vz += (vz - p.vz) * Math.min(1, dt * 3);
      const fade = Math.min(1, p.life / 0.8);
      const near = camera ? Math.min(1, Math.max(0, (camera.position.distanceTo(new THREE.Vector3(p.x, p.y, p.z)) - 2.5) / 3)) : 1;
      pos.setXYZ(n, p.x, p.y, p.z);
      const g = p.shade;
      col.setXYZW(n, g, g, g * 1.03, fade * near);
      n++;
    }
    this.smoke.geometry.setDrawRange(0, n);
    pos.needsUpdate = true; col.needsUpdate = true;
  }
}
