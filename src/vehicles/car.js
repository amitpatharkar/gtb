import * as THREE from 'three';

// Arcade car handling with a bicycle steering model: turning circle depends on speed,
// no spinning on the spot. Two collision circles (front and rear) against the world.
// Fuel and condition are simple gameplay meters (refuel at petrol pumps).

export class Car {
  constructor(model, opts = {}) {
    this.model = model;
    this.pos = new THREE.Vector3();
    this.heading = 0;      // radians, 0 = +z (south)
    this.speed = 0;        // m/s
    this.steer = 0;        // front wheel angle
    this.radius = 0.8;
    this.halfLength = 1.1;
    this.maxSpeed = opts.maxSpeed ?? 25;
    this.accel = opts.accel ?? 5.2;
    this.fuel = opts.fuel ?? 0.6;          // 0..1 (full tank ≈ 40 km)
    this.condition = 1;                    // 0..1, drops in crashes
    this.odometer = 0;
    this.lastBump = 0;
    this.pitch = 0; this.roll = 0;
  }

  /** world.hits(x, z, r) → blocked; world.groundHeight(x, z) → y. */
  update(dt, input, world) {
    const BRAKE = 9, DRAG = 0.35, ROLLING = 0.6;
    const fwd = Math.cos(this.heading), side = Math.sin(this.heading);
    const empty = this.fuel <= 0;
    const top = this.maxSpeed * (0.55 + 0.45 * this.condition);
    let a = 0;
    if (input.fwd && !empty) a += this.speed < 0 ? BRAKE : this.accel * (1 - Math.max(0, this.speed) / top);
    if (input.back) a -= this.speed > 0.5 ? BRAKE : empty ? 0 : this.accel * 0.6;
    if (input.brake) a -= Math.sign(this.speed) * Math.min(Math.abs(this.speed) / dt, BRAKE * 1.2);
    a -= this.speed * DRAG * Math.abs(this.speed) * 0.02 + Math.sign(this.speed) * ROLLING * (input.fwd || input.back ? 0 : 1);
    const prev = this.speed;
    this.speed += a * dt;
    if (Math.sign(prev) !== Math.sign(this.speed) && !input.fwd && !input.back) this.speed = 0;
    this.speed = THREE.MathUtils.clamp(this.speed, -5, top);

    // Steering: full lock at walking pace, much less at speed; wheels return to centre.
    const steerIn = input.steer ?? ((input.left ? 1 : 0) - (input.right ? 1 : 0)); // AI drivers pass an analogue steer
    const want = steerIn * THREE.MathUtils.lerp(0.62, 0.12, Math.min(1, Math.abs(this.speed) / 20));
    this.steer += (want - this.steer) * Math.min(1, dt * 6);
    const yawRate = (this.speed * Math.tan(this.steer)) / this.model.wheelBase;
    this.heading += yawRate * dt;

    const dx = Math.sin(this.heading) * this.speed * dt, dz = Math.cos(this.heading) * this.speed * dt;
    const blocked = (x, z) => {
      const fx = Math.sin(this.heading) * this.halfLength, fz = Math.cos(this.heading) * this.halfLength;
      return world.hits(x + fx, z + fz, this.radius) || world.hits(x - fx, z - fz, this.radius);
    };
    const stuck = blocked(this.pos.x, this.pos.z);
    let hit = false;
    if (stuck || !blocked(this.pos.x + dx, this.pos.z)) this.pos.x += dx; else hit = true;
    if (stuck || !blocked(this.pos.x, this.pos.z + dz)) this.pos.z += dz; else hit = true;
    if (hit) {
      const impact = Math.abs(this.speed);
      // Which side hit, in the car's own frame: mostly the end it was moving towards.
      if (impact > (this.impact || 0)) { this.impact = impact; this.impactLocal = [(Math.random() - 0.5) * 0.8, Math.sign(this.speed) || 1]; }
      if (impact > 4) this.condition = Math.max(0, this.condition - impact * 0.004);
      this.speed *= -0.25;
    }

    // Fuel: ~1 % per 400 m, a trickle when idling.
    const dist = Math.hypot(dx, dz);
    this.odometer += dist;
    this.fuel = Math.max(0, this.fuel - dist / 40000 - dt * 0.00002);

    // Ground: average of front and rear wheels; kerbs give a bump.
    const fx = Math.sin(this.heading) * 1.17, fz = Math.cos(this.heading) * 1.17;
    const gF = world.groundHeight(this.pos.x + fx, this.pos.z + fz), gR = world.groundHeight(this.pos.x - fx, this.pos.z - fz);
    const g = (gF + gR) / 2;
    if (Math.abs(g - this.pos.y) > 0.06 && Math.abs(this.speed) > 3) {
      // Kerbs and potholes: a jolt, some lost speed, and a little damage when taken fast.
      this.speed *= 0.93;
      this.lastBump = 0.25;
      if (Math.abs(this.speed) > 9) this.condition = Math.max(0, this.condition - 0.002 * Math.abs(this.speed));
      this.bumped = true;
    }
    this.pos.y += (g - this.pos.y) * Math.min(1, dt * 12);

    // Body motion: pitch from acceleration and slope, roll from cornering.
    const accelNow = (this.speed - prev) / Math.max(dt, 1e-3);
    this.lastBump = Math.max(0, this.lastBump - dt);
    const targetPitch = THREE.MathUtils.clamp(-accelNow * 0.006, -0.05, 0.05) + Math.atan2(gR - gF, 2.34) + Math.sin(this.lastBump * 40) * this.lastBump * 0.08;
    const targetRoll = THREE.MathUtils.clamp(-yawRate * this.speed * 0.012, -0.07, 0.07);
    // Tyre slip (for marks and squeal): locking up under hard braking, sliding in fast corners.
    const lateral = Math.abs(yawRate * this.speed);
    const braking = (input.brake && Math.abs(this.speed) > 4) || (input.back && this.speed > 4);
    this.braking = braking;
    this.slip = Math.max(braking ? Math.min(1, Math.abs(this.speed) / 12) : 0, THREE.MathUtils.clamp((lateral - 5.5) / 4, 0, 1));
    this.throttle = input.fwd ? 1 : 0;
    this.pitch += (targetPitch - this.pitch) * Math.min(1, dt * 8);
    this.roll += (targetRoll - this.roll) * Math.min(1, dt * 6);

    const m = this.model;
    m.root.position.copy(this.pos);
    m.root.rotation.set(0, this.heading, 0);
    m.body.rotation.set(this.pitch, 0, this.roll);
    for (const w of m.wheels) w.rotation.x += (this.speed * dt) / m.wheelRadius;
    for (const s of m.steerers) s.rotation.y = this.steer;
    m.lights.tailMat.emissiveIntensity = input.brake || (input.back && this.speed > 0.5) ? 2.5 : 0.15;
    return { fwd, side };
  }
}
