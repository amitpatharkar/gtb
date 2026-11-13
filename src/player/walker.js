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

  update(dt, input, world, energy = 1, aqi = 100) {
    if (this.down > 0) {
      this.down -= dt;
      this.speed = 0;
      return;
    }
    const turn = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    this.heading += turn * dt * 2.8;
    const move = (input.fwd ? 1 : 0) - (input.back ? 0.6 : 0);
    const canRun = this.stamina > 0.05 && move > 0;
    const run = input.run && canRun;
    const top = move === 0 ? 0 : move < 0 ? -1.2 : run ? 4.6 * (0.7 + 0.3 * energy) : 1.6;
    this.speed += THREE.MathUtils.clamp(top - this.speed, -8 * dt, 6 * dt);
    // Stamina: running drains it (faster in bad air), walking and standing restore it.
    const drain = (0.11 + aqi / 2500) * (1.3 - energy * 0.3);
    this.stamina = THREE.MathUtils.clamp(this.stamina + (run ? -drain : 0.12) * dt, 0, 1);
    const dx = Math.sin(this.heading) * this.speed * dt, dz = Math.cos(this.heading) * this.speed * dt;
    // Slide along walls instead of stopping dead.
    if (!world.hits(this.pos.x + dx, this.pos.z, 0.3)) this.pos.x += dx;
    if (!world.hits(this.pos.x, this.pos.z + dz, 0.3)) this.pos.z += dz;
    this.pos.y += (this.tiles.groundHeight(this.pos.x, this.pos.z) - this.pos.y) * Math.min(1, dt * 15);
    this.phase += dt * Math.abs(this.speed) * 4.3;
  }

  knock(amount) {
    if (this.down > 0) return;
    this.down = 1.6;
    this.health = Math.max(0, this.health - amount);
  }

  draw(people) {
    const moving = Math.abs(this.speed) > 0.15;
    const pose = this.down > 0 ? POSE.CROUCH : this.spraying ? POSE.POINT : moving ? POSE.WALK : POSE.STAND;
    people.add({ x: this.pos.x, y: this.pos.y, z: this.pos.z, heading: this.heading, phase: this.phase, pose, amp: Math.min(1.7, Math.abs(this.speed) / 1.3 + 0.2), flags: 0, scale: 1, ...this.look });
  }
}
