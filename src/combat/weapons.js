// Weapons: fists and a pistol. Shots are hitscan rays from the camera through the crosshair
// (what you aim at is what you hit), traced from the gun's muzzle, with a muzzle flash, a tracer,
// bullet holes and dust where they land, and an impulse on anything that can move.
import * as THREE from 'three/webgpu';
import { GROUP, groups } from '../core/physics.js';

export const WEAPONS = [
  { id: 'fists', name: 'Fists', clip: 0, rate: 0.45, range: 1.4 },
  { id: 'pistol', name: 'Pistol', clip: 12, reserve: 60, rate: 0.16, range: 180, reload: 1.4, impulse: 9, spread: 0.004 },
];
const HOLES = 64;

function pistolMesh() {
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardNodeMaterial({ color: 0x1b1c1e, roughness: 0.35, metalness: 0.85 });
  const grip = new THREE.MeshStandardNodeMaterial({ color: 0x2a2622, roughness: 0.8, metalness: 0.1 });
  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.032, 0.19), dark); slide.position.set(0, 0.025, 0.06);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.1, 0.04), grip); handle.position.set(0, -0.02, -0.005); handle.rotation.x = -0.25;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.012, 0.05), dark); guard.position.set(0, -0.005, 0.03);
  g.add(slide, handle, guard);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.025, 0.16); g.add(muzzle);
  g.userData.muzzle = muzzle;
  return g;
}

export class Weapons {
  constructor(scene, physics, audio) {
    this.scene = scene; this.physics = physics; this.audio = audio;
    this.current = 0;
    this.ammo = WEAPONS.map((w) => ({ clip: w.clip, reserve: w.reserve || 0 }));
    this.cool = 0; this.reloading = 0;
    this.gun = pistolMesh();
    this.gun.visible = false;
    // Muzzle flash: a short point light + a bright quad.
    this.flash = new THREE.PointLight(0xffb060, 0, 8, 2);
    scene.add(this.flash);
    const flashMat = new THREE.MeshBasicNodeMaterial({ color: 0xffd38a, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
    this.flashQuad = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), flashMat);
    this.flashQuad.visible = false;
    scene.add(this.flashQuad);
    // Tracer: one thin stretched box.
    const tracerMat = new THREE.MeshBasicNodeMaterial({ color: 0xfff0c0, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending });
    this.tracer = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 1), tracerMat);
    this.tracer.visible = false;
    scene.add(this.tracer);
    // Bullet holes (instanced dark discs on the surface).
    const holeMat = new THREE.MeshStandardNodeMaterial({ color: 0x0c0b0a, roughness: 1, transparent: true, opacity: 0.85, depthWrite: false });
    holeMat.polygonOffset = true; holeMat.polygonOffsetFactor = -4;
    this.holes = new THREE.InstancedMesh(new THREE.CircleGeometry(0.045, 10), holeMat, HOLES);
    this.holes.count = 0; this.holes.frustumCulled = false;
    scene.add(this.holes);
    this.holeNext = 0;
    // Dust puffs: a few pooled sprites.
    this.dust = [];
    const dustMat = new THREE.MeshBasicNodeMaterial({ color: 0xb8aa94, transparent: true, opacity: 0.5, depthWrite: false });
    for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), dustMat.clone()); m.visible = false; scene.add(m); this.dust.push({ m, t: 0 }); }
    this.flashT = 0; this.tracerT = 0;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._v = new THREE.Vector3(); this._d = new THREE.Vector3();
  }

  get list() { return WEAPONS; }
  get weapon() { return WEAPONS[this.current]; }
  get state() { return this.ammo[this.current]; }

  /** Attach the gun to the hero's right hand. */
  attach(hand) {
    if (!hand) return;
    hand.add(this.gun);
    this.gun.position.set(0.02, 0.07, 0.04);
    this.gun.rotation.set(Math.PI / 2, 0, Math.PI / 2);
  }

  select(i) {
    if (i === this.current || !WEAPONS[i]) return;
    this.current = i; this.reloading = 0; this.cool = 0.25;
    this.gun.visible = this.weapon.id === 'pistol';
    this.audio.click();
  }

  reload() {
    const w = this.weapon, s = this.state;
    if (!w.reload || this.reloading || s.clip >= w.clip || s.reserve <= 0) return false;
    this.reloading = w.reload;
    return true;
  }

  /**
   * Update timers; if firing, shoot from the camera. Returns a hit description or null.
   * exclude: the player's rigid body.
   */
  update(dt, firing, camera, exclude) {
    this.cool = Math.max(0, this.cool - dt);
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) { const w = this.weapon, s = this.state; const n = Math.min(w.clip - s.clip, s.reserve); s.clip += n; s.reserve -= n; this.reloading = 0; }
    }
    this.fx(dt);
    if (!firing || this.cool > 0 || this.reloading) return null;
    const w = this.weapon, s = this.state;
    if (w.id === 'fists') { this.cool = w.rate; return { punch: true }; }
    if (s.clip <= 0) { this.audio.click(); this.cool = 0.3; this.reload(); return null; }
    s.clip--; this.cool = w.rate;
    if (s.clip === 0) setTimeout(() => this.reload(), 250);
    // Aim ray from the camera, with a little spread.
    const dir = camera.getWorldDirection(this._d);
    dir.x += (Math.random() - 0.5) * w.spread; dir.y += (Math.random() - 0.5) * w.spread; dir.z += (Math.random() - 0.5) * w.spread; dir.normalize();
    const o = camera.position;
    const hit = this.physics.cast(o.x, o.y, o.z, dir.x, dir.y, dir.z, w.range, groups(0xffff, GROUP.WORLD | GROUP.VEHICLE | GROUP.PROP | GROUP.PED), exclude);
    const end = hit ? new THREE.Vector3(hit.point.x, hit.point.y, hit.point.z) : o.clone().addScaledVector(dir, w.range);
    const muzzle = this.gun.userData.muzzle.getWorldPosition(new THREE.Vector3());
    this.audio.shot();
    this.flashT = 0.05; this.tracerT = 0.04;
    this.flash.position.copy(muzzle); this.flash.intensity = 30;
    this.flashQuad.position.copy(muzzle); this.flashQuad.quaternion.copy(camera.quaternion); this.flashQuad.visible = true; this.flashQuad.rotation.z = Math.random() * 6;
    const len = muzzle.distanceTo(end);
    this.tracer.position.copy(muzzle).lerp(end, 0.5);
    this.tracer.scale.set(1, 1, len);
    this.tracer.lookAt(end);
    this.tracer.visible = true;
    if (hit) {
      const n = hit.normal;
      this._v.set(n.x, n.y, n.z);
      // Push whatever was hit (cars, crates) at the hit point.
      const body = hit.collider.parent();
      if (body && body.isDynamic()) body.applyImpulseAtPoint({ x: dir.x * w.impulse, y: dir.y * w.impulse, z: dir.z * w.impulse }, hit.point, true);
      else this.hole(end, this._v);
      this.puff(end, this._v);
      return { point: end, normal: this._v.clone(), collider: hit.collider, dir: dir.clone() };
    }
    return { point: end, normal: null };
  }

  hole(p, n) {
    this._q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    this._m.compose(p.clone().addScaledVector(n, 0.01), this._q, new THREE.Vector3(1, 1, 1).multiplyScalar(0.7 + Math.random() * 0.6));
    this.holes.setMatrixAt(this.holeNext, this._m);
    this.holeNext = (this.holeNext + 1) % HOLES;
    this.holes.count = Math.min(HOLES, this.holes.count + 1);
    this.holes.instanceMatrix.needsUpdate = true;
  }

  puff(p, n) {
    const d = this.dust.find((x) => x.t <= 0) || this.dust[0];
    d.t = 0.6; d.m.visible = true; d.m.position.copy(p).addScaledVector(n, 0.1); d.m.scale.setScalar(0.3);
    d.v = n.clone().multiplyScalar(0.8);
  }

  fx(dt) {
    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) { this.flash.intensity = 0; this.flashQuad.visible = false; } }
    if (this.tracerT > 0) { this.tracerT -= dt; if (this.tracerT <= 0) this.tracer.visible = false; }
    for (const d of this.dust) {
      if (d.t <= 0) continue;
      d.t -= dt;
      d.m.position.addScaledVector(d.v, dt);
      d.m.scale.setScalar(0.3 + (0.6 - d.t) * 2.2);
      d.m.material.opacity = Math.max(0, d.t) * 0.7;
      if (d.t <= 0) d.m.visible = false;
    }
  }
}
