// Ragdoll: when the main character is hit hard (a car, a big fall), his body becomes eleven
// Rapier capsules joined at the shoulders, elbows, hips, knees and neck, starting from his current
// pose and speed. Physics throws him; his bones copy the capsules every frame; when he settles,
// the bodies go away and he gets up. Capsules hit the world, cars and props, not each other.
import * as THREE from 'three/webgpu';
import { RAPIER, GROUP, groups } from '../core/physics.js';

export const RAGDOLL_GROUP = 64;
// bone → child bone that ends the capsule, radius, parent part (null = root), joint position bone
const PARTS = [
  ['pelvis', 'spine_02', 0.13, null],
  ['spine_02', 'neck_01', 0.14, 'pelvis'],
  ['head', 'head_end', 0.1, 'spine_02'],
  ['upperarm_l', 'lowerarm_l', 0.05, 'spine_02'], ['lowerarm_l', 'hand_l', 0.045, 'upperarm_l'],
  ['upperarm_r', 'lowerarm_r', 0.05, 'spine_02'], ['lowerarm_r', 'hand_r', 0.045, 'upperarm_r'],
  ['thigh_l', 'calf_l', 0.075, 'pelvis'], ['calf_l', 'foot_l', 0.055, 'thigh_l'],
  ['thigh_r', 'calf_r', 0.075, 'pelvis'], ['calf_r', 'foot_r', 0.055, 'thigh_r'],
];
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _q = new THREE.Quaternion(), _pq = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);

export class Ragdoll {
  constructor(physics, hero) {
    this.physics = physics; this.hero = hero;
    this.parts = null; this.joints = []; this.time = 0;
  }
  get active() { return !!this.parts; }

  /** Start from the current pose, everything moving at (vx, vy, vz), spinning a little. */
  start(vx, vy, vz) {
    if (this.parts) return;
    const { world } = this.physics, bones = this.hero.bones;
    this.hero.root.updateWorldMatrix(true, true);
    this.saved = new Map();
    for (const b of bones.values()) this.saved.set(b, { q: b.quaternion.clone(), p: b.position.clone() });
    this.parts = new Map();
    for (const [name, end, r, parent] of PARTS) {
      const bone = bones.get(name), tip = bones.get(end);
      if (!bone || !tip) continue;
      bone.getWorldPosition(_a); tip.getWorldPosition(_b);
      const len = _a.distanceTo(_b), centre = _c.copy(_a).add(_b).multiplyScalar(0.5);
      const rot = new THREE.Quaternion().setFromUnitVectors(UP, _b.clone().sub(_a).normalize());
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(centre.x, centre.y, centre.z).setRotation(rot)
        .setLinvel(vx, vy, vz).setAngvel({ x: (Math.random() - 0.5) * 4, y: (Math.random() - 0.5) * 4, z: (Math.random() - 0.5) * 4 })
        .setLinearDamping(0.1).setAngularDamping(1.2).setCcdEnabled(true));
      world.createCollider(RAPIER.ColliderDesc.capsule(Math.max(0.01, len / 2 - r), r).setDensity(985).setFriction(0.8).setRestitution(0.05)
        .setCollisionGroups(groups(RAGDOLL_GROUP, GROUP.WORLD | GROUP.VEHICLE | GROUP.PROP)), body);
      const boneQ = bone.getWorldQuaternion(new THREE.Quaternion());
      const offQ = rot.clone().invert().multiply(boneQ);                       // body → bone rotation
      const offP = _a.clone().sub(centre).applyQuaternion(rot.clone().invert()); // bone origin in the body's frame
      this.parts.set(name, { bone, body, offQ, offP });
      if (parent) {
        const p = this.parts.get(parent);
        if (p) {
          const pp = p.body.translation(), pr = p.body.rotation();
          const pq = new THREE.Quaternion(pr.x, pr.y, pr.z, pr.w).invert();
          const a1 = _a.clone().sub(new THREE.Vector3(pp.x, pp.y, pp.z)).applyQuaternion(pq);
          const a2 = _a.clone().sub(centre).applyQuaternion(rot.clone().invert());
          this.joints.push(world.createImpulseJoint(RAPIER.JointData.spherical(a1, a2), p.body, body, true));
        }
      }
    }
    this.time = 0;
  }

  /** Bones follow the capsules (call once per rendered frame while active). */
  sync() {
    if (!this.parts) return;
    for (const { bone, body, offQ, offP } of this.parts.values()) {
      const t = body.translation(), r = body.rotation();
      _q.set(r.x, r.y, r.z, r.w);
      const worldQ = _q.clone().multiply(offQ);
      bone.parent.updateWorldMatrix(true, false);
      bone.parent.getWorldQuaternion(_pq);
      bone.quaternion.copy(_pq.invert().multiply(worldQ));
      if (bone.name === 'pelvis') {
        const wp = offP.clone().applyQuaternion(_q).add(_a.set(t.x, t.y, t.z));
        bone.position.copy(bone.parent.worldToLocal(wp));
      }
      bone.updateMatrixWorld(true);
    }
  }

  /** Pelvis position and how fast the body still moves. */
  state() {
    const p = this.parts?.get('pelvis')?.body;
    if (!p) return null;
    const t = p.translation(), v = p.linvel();
    return { x: t.x, y: t.y, z: t.z, speed: Math.hypot(v.x, v.y, v.z) };
  }

  update(dt) { if (this.parts) this.time += dt; }

  /** Remove the bodies and give the pose back to the animations. */
  stop() {
    if (!this.parts) return;
    const { world } = this.physics;
    for (const j of this.joints) world.removeImpulseJoint(j, true);
    for (const { body } of this.parts.values()) world.removeRigidBody(body);
    for (const [b, s] of this.saved) { b.quaternion.copy(s.q); b.position.copy(s.p); }
    this.parts = null; this.joints = [];
  }
}
