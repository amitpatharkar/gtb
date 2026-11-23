// Third-person camera: orbit on foot, over-the-shoulder when aiming, chase behind vehicles
// (swings back behind the car when you stop steering the view). A ray from the pivot to the
// camera pulls it in front of any wall, so it never looks through buildings.
import * as THREE from 'three/webgpu';
import { GROUP, groups } from '../core/physics.js';

const PITCH_MIN = -1.2, PITCH_MAX = 0.9;

export class ChaseCamera {
  constructor(camera, physics) {
    this.camera = camera; this.physics = physics;
    this.yaw = 0; this.pitch = -0.18;
    this.dist = 3.4;
    this.idle = 0;            // seconds since the player last moved the view
    this.pos = new THREE.Vector3();
    this.pivot = new THREE.Vector3();
    this.fov = 62;
    this.shake = 0;
    this.sensitivity = 0.0022;
    this.invertY = false;
  }

  /** Mouse/stick look; recoil kicks the view up. */
  look(input) {
    const dx = input.look.x, dy = input.look.y;
    if (dx || dy) this.idle = 0;
    this.yaw -= dx * this.sensitivity;
    this.pitch -= dy * this.sensitivity * (this.invertY ? -1 : 1);
    this.pitch = Math.min(PITCH_MAX, Math.max(PITCH_MIN, this.pitch));
  }

  kick(amount) { this.pitch = Math.min(PITCH_MAX, this.pitch + amount); this.shake = Math.max(this.shake, amount * 0.5); }

  /**
   * target: point to orbit (world); mode: 'foot' | 'aim' | 'car'; heading: the car's heading
   * (for auto-follow); speed: m/s; size: vehicle length.
   */
  update(dt, target, mode, heading = 0, speed = 0, size = 4, exclude = null) {
    this.idle += dt;
    let dist, height, side = 0, fov = 62;
    if (mode === 'aim') { dist = 1.7; height = 0; side = 0.55; fov = 48; }
    else if (mode === 'car') {
      dist = size * 1.25 + 2.2 + Math.min(speed, 30) * 0.05; height = 0.9; fov = 62 + Math.min(speed, 40) * 0.25;
      // Swing back behind the car while driving, unless the player is looking around.
      if (this.idle > 1.2 && speed > 2) {
        let d = heading - this.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        this.yaw += d * (1 - Math.exp(-2.5 * dt));
        this.pitch += (-0.2 - this.pitch) * (1 - Math.exp(-1.5 * dt));
      }
    } else { dist = 3.4; height = 0.15; side = 0.15; }
    this.dist += (dist - this.dist) * (1 - Math.exp(-10 * dt));
    this.fov += (fov - this.fov) * (1 - Math.exp(-8 * dt));

    this.pivot.copy(target); this.pivot.y += height;
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    // Camera sits behind the view direction: view dir = (sin yaw·cp, sp, cos yaw·cp) pointing away from camera.
    const bx = -Math.sin(this.yaw) * cp, by = -sp, bz = -Math.cos(this.yaw) * cp;
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw); // right of the view
    const sx = this.pivot.x - rx * side, sz = this.pivot.z - rz * side;
    let d = this.dist;
    // Pull in front of walls (the vehicle being driven and the player do not count).
    const filter = groups(0xffff, GROUP.WORLD | GROUP.PROP | (mode === 'car' ? 0 : GROUP.VEHICLE));
    const hit = this.physics.cast(sx, this.pivot.y, sz, bx, by, bz, d + 0.3, filter, exclude);
    if (hit) d = Math.max(0.4, hit.toi - 0.3);
    this.pos.set(sx + bx * d, this.pivot.y + by * d, sz + bz * d);
    // Keep above the ground.
    const g = this.physics.groundAt(this.pos.x, this.pos.z, this.pos.y + 2, 4);
    if (g !== null && this.pos.y < g + 0.3) this.pos.y = g + 0.3;

    const cam = this.camera;
    cam.position.copy(this.pos);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2);
      cam.position.x += (Math.random() - 0.5) * this.shake * 0.1;
      cam.position.y += (Math.random() - 0.5) * this.shake * 0.1;
    }
    cam.lookAt(sx - bx * 10, this.pivot.y - by * 10, sz - bz * 10);
    if (Math.abs(cam.fov - this.fov) > 0.01) { cam.fov = this.fov; cam.updateProjectionMatrix(); }
  }

  /** Unit vector the camera looks along (for shooting). */
  forward(out = new THREE.Vector3()) { return this.camera.getWorldDirection(out); }
}
