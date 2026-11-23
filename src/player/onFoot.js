// On foot: a Rapier kinematic character controller (capsule) that climbs kerbs, slides along
// walls, pushes loose objects, falls and jumps; the hero's animations follow its real speed.
import * as THREE from 'three/webgpu';
import { RAPIER, GROUP, groups, STEP } from '../core/physics.js';

const RADIUS = 0.3, HALF = 0.55; // capsule: 1.7 m tall
const SPEED = { walk: 1.5, run: 3.6, sprint: 6.4, aim: 1.6 };
const ACCEL = 14, AIR_ACCEL = 3, JUMP = 4.4, GRAVITY = 18;

export class OnFoot {
  constructor(physics, hero) {
    this.physics = physics; this.hero = hero;
    const { world } = physics;
    this.body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 5, 0));
    this.collider = world.createCollider(
      RAPIER.ColliderDesc.capsule(HALF, RADIUS).setCollisionGroups(groups(GROUP.PLAYER, GROUP.WORLD | GROUP.VEHICLE | GROUP.PROP | GROUP.PED)),
      this.body,
    );
    const c = world.createCharacterController(0.03);
    c.enableAutostep(0.38, 0.15, false);
    c.enableSnapToGround(0.35);
    c.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
    c.setMinSlopeSlideAngle((60 * Math.PI) / 180);
    c.setApplyImpulsesToDynamicBodies(true);
    c.setCharacterMass(80);
    c.setSlideEnabled(true);
    this.ctrl = c;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.vy = 0;
    this.heading = 0;       // radians, 0 = facing +z
    this.grounded = false;
    this.active = true;
    this.speed = 0;
    this.airTime = 0;
    this.health = 100; this.armour = 0;
    this.move = { x: 0, z: 0 };
  }

  place(x, y, z, heading = this.heading) {
    this.body.setTranslation({ x, y: y + HALF + RADIUS + 0.05, z }, true);
    this.body.setNextKinematicTranslation({ x, y: y + HALF + RADIUS + 0.05, z });
    this.pos.set(x, y, z);
    this.heading = heading; this.vy = 0; this.vel.set(0, 0, 0);
  }

  setActive(on) {
    this.active = on;
    this.collider.setEnabled(on);
    this.hero.object.visible = on;
  }

  /**
   * One physics step. input: the Input object; camYaw: camera heading (radians); aiming: face
   * the camera direction and walk slowly.
   */
  step(input, camYaw, aiming) {
    const dt = STEP;
    // Camera-relative direction: forward = where the camera looks.
    const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
    const mx = input.move.x, my = input.move.y;
    let dx = fx * my - fz * mx, dz = fz * my + fx * mx;
    const amount = Math.min(1, Math.hypot(dx, dz));
    if (amount > 0) { const l = Math.hypot(dx, dz); dx /= l; dz /= l; }
    const walk = input.down('walk');
    const sprint = input.down('sprint') && !aiming && my > 0.3;
    const target = amount * (aiming ? SPEED.aim : walk ? SPEED.walk : sprint ? SPEED.sprint : SPEED.run);
    const a = this.grounded ? ACCEL : AIR_ACCEL;
    const k = 1 - Math.exp(-a * dt);
    this.vel.x += (dx * target - this.vel.x) * k;
    this.vel.z += (dz * target - this.vel.z) * k;

    if (this.grounded) {
      this.vy = -1;
      this.airTime = 0;
      if (input.pressed('jump') && !aiming) { this.vy = JUMP; this.grounded = false; this.jumped = true; }
    } else {
      this.vy -= GRAVITY * dt;
      this.airTime += dt;
    }

    const desired = { x: this.vel.x * dt, y: this.vy * dt, z: this.vel.z * dt };
    this.ctrl.computeColliderMovement(this.collider, desired, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, groups(GROUP.PLAYER, GROUP.WORLD | GROUP.VEHICLE | GROUP.PROP | GROUP.PED));
    const mv = this.ctrl.computedMovement();
    const p = this.body.translation();
    this.body.setNextKinematicTranslation({ x: p.x + mv.x, y: p.y + mv.y, z: p.z + mv.z });
    const wasGrounded = this.grounded;
    this.grounded = this.ctrl.computedGrounded();
    if (this.grounded && !wasGrounded && this.airTime > 0.25) this.landed = true;
    // Real speed after collisions (walking into a wall stops the legs).
    this.speed = Math.hypot(mv.x, mv.z) / dt;
    if (this.speed < Math.hypot(this.vel.x, this.vel.z) * 0.5) { this.vel.x = mv.x / dt; this.vel.z = mv.z / dt; }
    if (mv.y > this.vy * dt + 0.001 && this.vy > 0) this.vy = 0; // bumped head

    // Facing: towards movement, or the camera when aiming.
    const want = aiming ? camYaw : amount > 0.1 ? Math.atan2(dx, dz) : this.heading;
    let d = want - this.heading;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.heading += d * (1 - Math.exp(-(aiming ? 25 : 12) * dt));
    this.sprinting = sprint && this.speed > 4.5;
  }

  /** Copy the physics pose to the hero and choose his animation (once per rendered frame). */
  sync(dt, aiming, firing) {
    const p = this.body.translation();
    this.pos.set(p.x, p.y - HALF - RADIUS, p.z);
    const o = this.hero.object;
    o.position.copy(this.pos);
    o.rotation.y = this.heading;
    const h = this.hero, s = this.speed;
    if (!this.grounded && this.airTime > 0.15) h.play(this.jumped ? 'jump' : 'jump', 1);
    else if (aiming) h.play(firing ? 'shoot' : s > 0.4 ? 'walk' : 'aimIdle', firing ? 1.6 : s > 0.4 ? s / 1.4 : 1, 0.1);
    else if (s < 0.25) h.play('idle');
    else if (s < 2.2) h.play('walk', s / 1.4);
    else if (s < 5) h.play('jog', s / 3.4);
    else h.play('sprint', s / 6.2);
    if (this.grounded) this.jumped = false;
    h.update(dt);
  }

  get eye() { return this.pos.y + 1.55; }
}
