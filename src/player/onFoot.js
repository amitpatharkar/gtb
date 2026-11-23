// On foot: a Rapier kinematic character controller (capsule) that climbs kerbs, slides along
// walls, pushes loose objects, falls and jumps; the hero's animations follow its real speed.
// Health (falls and cars hurt; it recovers slowly up to half), stamina (sprinting uses it).
import * as THREE from 'three/webgpu';
import { RAPIER, GROUP, groups, STEP } from '../core/physics.js';
import { Ragdoll } from './ragdoll.js';

const RADIUS = 0.3, HALF = 0.55; // capsule: 1.7 m tall
const SPEED = { walk: 1.5, run: 4.0, sprint: 6.9, aim: 1.7 };
const ACCEL = 8, DECEL = 11, AIR_ACCEL = 2.5, JUMP = 4.4, GRAVITY = 18;

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
    this.ragdoll = new Ragdoll(physics, hero);
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.vy = 0;
    this.heading = 0;       // radians, 0 = facing +z
    this.grounded = false;
    this.active = true;
    this.speed = 0;
    this.airTime = 0;
    this.health = 100; this.armour = 0; this.stamina = 100;
    this.tired = false;      // ran out of stamina: no sprinting until it is back to 30
    this.sinceHurt = 99;
    this.knocked = 0;        // seconds left lying down after a car hit
    this.ghost = 0;          // seconds the capsule ignores cars (so a car that hit you drives on)
    this.damage = [];        // [amount] since the last read (main.js turns them into feedback)
    this.move = { x: 0, z: 0 };
  }

  hurt(amount) {
    if (amount <= 0) return;
    const a = Math.min(this.armour, amount * 0.6);
    this.armour -= a; this.health = Math.max(0, this.health - (amount - a));
    this.sinceHurt = 0; this.damage.push(amount);
  }

  /** Knocked over by a car: flung along (dx, dz) at `speed`, down for a moment. Hard hits → ragdoll. */
  knock(dx, dz, speed) {
    if (speed > 6) {
      this.hurt(Math.min(90, (speed - 3) * 7));
      this.goLimp(dx * speed * 0.75, 2.5 + speed * 0.18, dz * speed * 0.75);
      return;
    }
    this.vel.set(dx * speed * 0.6, 0, dz * speed * 0.6);
    this.vy = 3 + speed * 0.15; this.grounded = false;
    this.knocked = 1.6; this.ghost = 0.8;
    this.collider.setCollisionGroups(groups(GROUP.PLAYER, GROUP.WORLD | GROUP.PROP | GROUP.PED));
    this.hurt(Math.min(90, (speed - 3) * 7));
    this.hero.play('fall', 1.2, 0.08);
  }

  /** Become a ragdoll moving at (vx, vy, vz): the capsule steps aside until he gets up. */
  goLimp(vx, vy, vz) {
    if (this.ragdoll.active) return;
    this.collider.setEnabled(false);
    this.ragdoll.start(vx, vy, vz);
    this.knocked = 99;
  }

  place(x, y, z, heading = this.heading) {
    if (this.ragdoll.active) { this.ragdoll.stop(); this.collider.setEnabled(this.active); this.knocked = 0; }
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
    if (this.ragdoll.active) {
      // Lying there until the body settles (or 5 s), then up where the hips came to rest.
      this.ragdoll.update(dt);
      const st = this.ragdoll.state();
      if (st && ((this.ragdoll.time > 2 && st.speed < 0.7) || this.ragdoll.time > 5) && this.health > 0) {
        const g = this.physics.groundAt(st.x, st.z, st.y + 1, 4) ?? st.y - 0.2;
        this.ragdoll.stop();
        this.collider.setEnabled(true);
        this.place(st.x, g, st.z, this.heading);
        this.knocked = 0.7; this.ghost = 0.3;
      }
      this.speed = 0;
      return;
    }
    // Camera-relative direction: forward = where the camera looks.
    const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
    const mx = input.move.x, my = input.move.y;
    let dx = fx * my - fz * mx, dz = fz * my + fx * mx;
    const amount = Math.min(1, Math.hypot(dx, dz));
    if (amount > 0) { const l = Math.hypot(dx, dz); dx /= l; dz /= l; }
    const walk = input.down('walk');
    // Stamina: sprinting uses it, it comes back when you stop; empty = jog until it is back to 30.
    if (this.stamina <= 0) this.tired = true;
    if (this.tired && this.stamina > 30) this.tired = false;
    const sprint = input.down('sprint') && !aiming && my > 0.3 && !this.tired && this.knocked <= 0;
    this.stamina = Math.max(0, Math.min(100, this.stamina + (sprint && this.speed > 4 ? -16 : this.speed > 4 ? 0 : 14) * dt));
    // Health comes back slowly up to half, a few seconds after the last hurt.
    this.sinceHurt += dt;
    if (this.sinceHurt > 5 && this.health < 50 && this.health > 0) this.health = Math.min(50, this.health + 2 * dt);
    if (this.ghost > 0) { this.ghost -= dt; if (this.ghost <= 0) this.collider.setCollisionGroups(groups(GROUP.PLAYER, GROUP.WORLD | GROUP.VEHICLE | GROUP.PROP | GROUP.PED)); }
    const down = this.knocked > 0;
    if (down) { this.knocked -= dt; if (this.grounded) { this.vel.multiplyScalar(0.85); } }
    const target = down ? 0 : amount * (aiming ? SPEED.aim : walk ? SPEED.walk : sprint ? SPEED.sprint : SPEED.run);
    // Momentum: away from aiming he runs where he faces and turns in an arc (quicker when slow);
    // a sharp change of direction slows him first. Aiming: he faces the camera and strides sideways.
    const want = down ? this.heading : aiming ? camYaw : amount > 0.1 ? Math.atan2(dx, dz) : this.heading;
    let turn = want - this.heading;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    const cur = Math.hypot(this.vel.x, this.vel.z);
    const rate = aiming ? 25 : down ? 0 : THREE.MathUtils.lerp(14, 6.5, Math.min(1, cur / SPEED.sprint));
    this.heading += turn * (1 - Math.exp(-rate * dt));
    let speedWanted = target;
    if (!aiming && amount > 0.1 && Math.abs(turn) > 1.6 && cur > 2.5) speedWanted *= 0.35; // pivot: slow down to turn round
    const accel = !this.grounded ? AIR_ACCEL : speedWanted > cur ? ACCEL : DECEL;
    const k = 1 - Math.exp(-accel * dt);
    if (!down) {
      if (aiming) {
        this.vel.x += (dx * target - this.vel.x) * k;
        this.vel.z += (dz * target - this.vel.z) * k;
      } else if (this.grounded) {
        const sp = cur + (speedWanted - cur) * k;
        this.vel.x = Math.sin(this.heading) * sp; this.vel.z = Math.cos(this.heading) * sp;
      }
    }

    if (this.grounded) {
      this.vy = -1;
      this.airTime = 0;
      if (input.pressed('jump') && !aiming && !down) { this.vy = JUMP; this.grounded = false; this.jumped = true; this.jumps = (this.jumps || 0) + 1; }
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
    if (this.grounded && !wasGrounded && this.airTime > 0.25) {
      this.landed = true;
      // Falls hurt: more than about 3.5 m (landing faster than 8.5 m/s); a big fall knocks him flat.
      if (this.fallSpeed > 8.5) this.hurt((this.fallSpeed - 8.5) * 14);
      if (this.fallSpeed > 12) this.goLimp(this.vel.x, 0, this.vel.z);
    }
    this.fallSpeed = this.grounded ? 0 : Math.max(this.fallSpeed || 0, -this.vy);
    // Real speed after collisions (walking into a wall stops the legs).
    this.speed = Math.hypot(mv.x, mv.z) / dt;
    if (this.speed < Math.hypot(this.vel.x, this.vel.z) * 0.5) { this.vel.x = mv.x / dt; this.vel.z = mv.z / dt; }
    if (mv.y > this.vy * dt + 0.001 && this.vy > 0) this.vy = 0; // bumped head

    this.sprinting = sprint && this.speed > 4.5;
  }

  /** Copy the physics pose to the hero and choose his animation (once per rendered frame). */
  sync(dt, aiming, firing) {
    if (this.ragdoll.active) {
      this.ragdoll.sync();
      const st = this.ragdoll.state();
      if (st) this.pos.set(st.x, st.y - 0.9, st.z);
      return;
    }
    const p = this.body.translation();
    this.pos.set(p.x, p.y - HALF - RADIUS, p.z);
    const o = this.hero.object;
    o.position.copy(this.pos);
    o.rotation.y = this.heading;
    const h = this.hero, s = this.speed;
    if (this.knocked > 0) { h.play(this.knocked > 0.7 ? 'fall' : 'getUp', 1.2, 0.15); h.update(dt); return; }
    if (!this.grounded && this.airTime > 0.15) h.play('jump', 1, 0.15);
    else if (aiming && s < 0.4) h.play(firing ? 'shoot' : 'aimIdle', firing ? 1.6 : 1, 0.08);
    else h.locomotion(s);
    if (this.grounded) this.jumped = false;
    h.update(dt);
  }

  get eye() { return this.pos.y + 1.55; }
}
