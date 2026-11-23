// Loose physics props (Poly Haven, CC0): crates and bins you can kick, push with a car or shoot.
// Each is a real model on a dynamic rigid body with a box collider fitted to it.
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RAPIER, GROUP, groups } from '../core/physics.js';

const BASE = import.meta.env.BASE_URL;
// Ids must appear literally: scripts/ship-media.mjs ships only media named in src/.
const KINDS = {
  crate: { path: 'prop-ph-wooden-crate-02/wooden_crate_02_1k.gltf', mass: 18 },
  plastic: { path: 'prop-ph-plastic-crate-02/plastic_crate_02_1k.gltf', mass: 2.5 },
  bin: { path: 'prop-ph-metal-trash-can/metal_trash_can_1k.gltf', mass: 9 },
};

export class Props {
  constructor(scene, physics) {
    this.scene = scene; this.physics = physics; this.items = [];
    this.loader = new GLTFLoader();
    this.protos = new Map();
  }

  async proto(kind) {
    if (!this.protos.has(kind)) this.protos.set(kind, this.loader.loadAsync(`${BASE}media/models/${KINDS[kind].path}`).then((g) => {
      const root = g.scene;
      root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      const box = new THREE.Box3().setFromObject(root);
      const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
      root.position.sub(c); // centre on the body origin
      const holder = new THREE.Group(); holder.add(root);
      return { holder, half: s.multiplyScalar(0.5) };
    }));
    return this.protos.get(kind);
  }

  async add(kind, x, y, z, yaw = 0) {
    const p = await this.proto(kind);
    const obj = p.holder.clone(true);
    this.scene.add(obj);
    const body = this.physics.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y + p.half.y + 0.02, z)
      .setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }).setCanSleep(true).setLinearDamping(0.1).setAngularDamping(0.3));
    this.physics.world.createCollider(RAPIER.ColliderDesc.cuboid(p.half.x, p.half.y, p.half.z).setMass(KINDS[kind].mass).setFriction(0.7).setRestitution(0.15)
      .setCollisionGroups(groups(GROUP.PROP)), body);
    this.items.push({ obj, body });
  }

  sync() {
    for (const { obj, body } of this.items) {
      if (body.isSleeping()) continue;
      const p = body.translation(), r = body.rotation();
      obj.position.set(p.x, p.y, p.z); obj.quaternion.set(r.x, r.y, r.z, r.w);
    }
  }

  /** First sync for sleeping bodies too. */
  syncAll() { for (const { obj, body } of this.items) { const p = body.translation(), r = body.rotation(); obj.position.set(p.x, p.y, p.z); obj.quaternion.set(r.x, r.y, r.z, r.w); } }
}
