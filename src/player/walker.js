import * as THREE from 'three';
import { POSE } from '../sim/people.js';

// The player on foot: walk (W/S, A/D to turn), run with Shift (uses stamina, which bad air
// and low energy shrink), bump into walls, get knocked over by careless drivers.
// Drawn with the same procedural people as everyone else.

export class Walker {
  constructor(tiles) {
    this.tiles = tiles;
    this.pos = new THREE.Vector3();
    this.heading = 0;
    this.speed = 0;
    this.phase = 0;
    this.stamina = 1;
    this.health = 1;
    this.down = 0;          // knocked over: seconds left on the ground
    this.spraying = false;
    this.look = {
      shirt: new THREE.Color(0x1f8a8a), pants: new THREE.Color(0x24324a), skin: new THREE.Color(0x8d5a3b),
    };
    this.h = 2.2;
  }

  get x() { return this.pos.x; }
  get z() { return this.pos.z; }
  get y() { return this.pos.y; }

  /** Move relative to the camera (GTA style): W away from the camera, A/D sideways. */
  update(dt, input, world, energy = 1, aqi = 100, view = null) {
    if (this.down > 0) {
      this.down -= dt;
      this.speed = 0;
      this.vx = this.vz = 0;
      return;
    }
    const yaw = view ? view.yaw : this.heading;
    const mz = (input.fwd ? 1 : 0) - (input.back ? 1 : 0), mx = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    const aiming = view?.aim || this.spraying || this.attacking > 0;
    let dirx = 0, dirz = 0;
    if (mz || mx) {
      dirx = Math.sin(yaw) * mz + Math.cos(yaw) * mx;
      dirz = Math.cos(yaw) * mz - Math.sin(yaw) * mx;
      const l = Math.hypot(dirx, dirz); dirx /= l; dirz /= l;
    }
    // Face where you walk, or where the camera points while aiming and fighting.
    const want = aiming ? yaw : (mz || mx) ? Math.atan2(dirx, dirz) : this.heading;
    let d = want - this.heading; d = Math.atan2(Math.sin(d), Math.cos(d));
    this.heading += d * Math.min(1, dt * (aiming ? 14 : 9));
    const moving = mz || mx;
    const canRun = this.stamina > 0.05 && moving && !aiming;
    const run = input.run && canRun;
    const top = !moving ? 0 : aiming ? 1.4 : run ? 5.2 * (0.7 + 0.3 * energy) : 1.9;
    this.speed += Math.max(-8 * dt, Math.min(6 * dt, top - this.speed));
    // Stamina: running drains it (faster in bad air), walking and standing restore it.
    const drain = (0.11 + aqi / 2500) * (1.3 - energy * 0.3);
    this.stamina = Math.max(0, Math.min(1, this.stamina + (run ? -drain : 0.12) * dt));
    const mvx = moving ? dirx : Math.sin(this.heading) * 0, mvz = moving ? dirz : 0;
    // Pushes from fights slide you along too.
    this.vx = (this.vx || 0) * Math.exp(-dt * 5); this.vz = (this.vz || 0) * Math.exp(-dt * 5);
    const dx = mvx * this.speed * dt + this.vx * dt, dz = mvz * this.speed * dt + this.vz * dt;
    // Slide along walls instead of stopping dead.
    if (!world.hits(this.pos.x + dx, this.pos.z, 0.3)) this.pos.x += dx;
    if (!world.hits(this.pos.x, this.pos.z + dz, 0.3)) this.pos.z += dz;
    // The floor: the street, or the room's own (stairs included) when the world provides it.
    const ground = world.groundHeight ? world.groundHeight(this.pos.x, this.pos.z) : this.tiles.groundHeight(this.pos.x, this.pos.z);
    this.pos.y += (ground - this.pos.y) * Math.min(1, dt * 15);
    this.phase += dt * Math.abs(this.speed) * 4.3;
    this.attacking = Math.max(0, (this.attacking || 0) - dt);
  }

  /** A shove or a blow from someone: knock back along (fx, fz). */
  hitBy(amount, fx, fz, push = 2.5) {
    this.health = Math.max(0, this.health - amount);
    this.vx = (this.vx || 0) + fx * push; this.vz = (this.vz || 0) + fz * push;
    this.hurt = 0.25;
  }

  knock(amount) {
    if (this.down > 0) return;
    this.down = 1.6;
    this.health = Math.max(0, this.health - amount);
  }

  draw(people, weapon = 'fists') {
    const moving = Math.abs(this.speed) > 0.15;
    let pose = moving ? POSE.WALK : POSE.STAND;
    if (this.action && this.action.t > 0) pose = this.action.pose;
    else if (this.spraying || (this.aiming && weapon === 'pichkari')) pose = POSE.POINT;
    else if (this.aiming) pose = POSE.FIGHT;
    if (this.down > 0) pose = POSE.FALLEN;
    // One persistent object, so the real character model keeps following the same person.
    const p = (this.person ||= { isPlayer: true, flags: 0, scale: 1, model: 0, hair: new THREE.Color(0x17110c) });
    p.hitT = this.hurt > 0 ? this.hurt : 0; p.swingN = this.action?.n || p.swingN || 0;
    Object.assign(p, { x: this.pos.x, y: this.pos.y, z: this.pos.z, heading: this.heading, phase: this.action?.t > 0 ? this.action.phase : this.phase, pose, amp: Math.min(1.7, Math.abs(this.speed) / 1.3 + 0.2), speed: Math.abs(this.speed), shirt: this.look.shirt, pants: this.look.pants, skin: this.look.skin, patches: this.patches });
    people.add(p);
  }
}
