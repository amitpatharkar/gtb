import * as THREE from 'three';

// Arcade car handling: a bicycle steering model (turning circle depends on speed) on a 2D
// rigid body — world velocity is separate from heading, tyres grip sideways (handbrake
// drifts with Space), and the car slides along walls instead of bouncing off or passing
// through. Two collision circles (front and rear) against the world, moved in sub-steps.
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
    this.maxSpeed = opts.maxSpeed ?? 26;   // ~90 km/h flat out; 60–70 km/h comes quickly
    this.accel = opts.accel ?? 6.2;
    this.fuel = opts.fuel ?? 0.6;          // 0..1 (full tank ≈ 300 km)
    this.condition = 1;                    // 0..1, drops in crashes
    this.odometer = 0;
    this.lastBump = 0;
    this.pitch = 0; this.roll = 0;
  }

  /** world.hits(x, z, r) → blocked; world.groundHeight(x, z) → y. */
  update(dt, input, world) {
    const BRAKE = 9, DRAG = 0.35, ROLLING = 0.6;
    const empty = this.fuel <= 0;
    const top = this.maxSpeed * (0.8 + 0.2 * this.condition);
    // World velocity (the car can slip sideways); re-synced if someone set `speed` directly
    // (teleports, respawn, cheats, AI resets).
    if (this.vx === undefined || (this.speed !== this.lastSpeed && !Number.isNaN(this.lastSpeed))) { this.vx = Math.sin(this.heading) * this.speed; this.vz = Math.cos(this.heading) * this.speed; this.yaw = 0; }
    const oldHeading = this.heading;

    // Steering: full lock at walking pace, much less at speed; wheels return to centre.
    const steerIn = input.steer ?? ((input.left ? 1 : 0) - (input.right ? 1 : 0)); // AI drivers pass an analogue steer
    const speedNow = Math.abs(this.speed);
    const want = steerIn * THREE.MathUtils.lerp(0.62, 0.12, Math.min(1, speedNow / 20));
    this.steer += (want - this.steer) * Math.min(1, dt * 6);
    // Handbrake turn: Space at speed while steering lets the rear step out.
    const drift = !!input.brake && speedNow > 7 && steerIn !== 0;
    const yawTarget = (this.speed * Math.tan(this.steer)) / this.model.wheelBase * (drift ? 1.3 : 1);
    this.yaw = (this.yaw || 0) + (yawTarget - (this.yaw || 0)) * Math.min(1, dt * (drift ? 4 : 10));
    this.heading += this.yaw * dt;

    // Velocity in the new frame: forward part takes engine/brakes/drag, sideways part is
    // eaten by tyre grip (less when drifting or with a battered car).
    let fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    let vf = this.vx * fx + this.vz * fz, vl = this.vx * -fz + this.vz * fx;
    let a = 0;
    if (input.fwd && !empty) a += vf < 0 ? BRAKE : this.accel * (1 - (Math.max(0, vf) / top) ** 2);
    if (input.back) a -= vf > 0.5 ? BRAKE : empty ? 0 : this.accel * 0.6;
    if (input.brake && !drift) a -= Math.sign(vf) * Math.min(Math.abs(vf) / dt, BRAKE * 1.2);
    if (drift) a -= Math.sign(vf) * 2.2;
    a -= vf * DRAG * Math.abs(vf) * 0.007 + Math.sign(vf) * ROLLING * (input.fwd || input.back ? 0 : 1);
    const prev = this.speed;
    vf += a * dt;
    if (Math.sign(prev) !== Math.sign(vf) && !input.fwd && !input.back) vf = 0;
    vf = THREE.MathUtils.clamp(vf, -5, top);
    const grip = drift ? 2.8 : 9 + 3 * this.condition;
    vl *= Math.max(0, 1 - grip * dt);
    this.vx = fx * vf - fz * vl; this.vz = fz * vf + fx * vl;
    this.lateral = vl;

    // Move in small steps; on contact, cancel the velocity going into the obstacle and slide
    // along it (the contact normal is found by probing free space, so any world.hits works).
    const HL = this.halfLength, R = this.radius;
    // Collision circles along the car: both ends, plus some in between on long vehicles.
    // Returns ±1 for the end that touches (0 = clear).
    const circles = this.circles || (this.circles = [HL, -HL]);
    const blockedAt = (x, z, h) => {
      const sh = Math.sin(h), ch = Math.cos(h);
      for (const o of circles) if (world.hits(x + sh * o, z + ch * o, R)) { hitOffset = o; return o < 0 ? -1 : 1; }
      return 0;
    };
    let hitOffset = 0;
    // Turning into a wall: keep the old heading.
    if (blockedAt(this.pos.x, this.pos.z, this.heading) && !blockedAt(this.pos.x, this.pos.z, oldHeading)) {
      this.heading = oldHeading; this.yaw = 0; fx = Math.sin(this.heading); fz = Math.cos(this.heading);
    }
    const len = Math.hypot(this.vx, this.vz) * dt, n = Math.max(1, Math.ceil(len / 0.35));
    let impact = 0, hitEnd = 0, hitN = null;
    const moved0 = this.pos.clone();
    for (let i = 0; i < n; i++) {
      let sx = (this.vx * dt) / n, sz = (this.vz * dt) / n;
      const end = blockedAt(this.pos.x + sx, this.pos.z + sz, this.heading);
      if (!end) { this.pos.x += sx; this.pos.z += sz; continue; }
      const cx = this.pos.x + sx + fx * hitOffset, cz = this.pos.z + sz + fz * hitOffset;
      const [nx, nz] = freeDirection(world, cx, cz, R, -this.vx, -this.vz);
      // Another vehicle: exchange momentum by mass (a scooter flies, a bus barely notices).
      const body = world.bodyAt?.(cx, cz, R);
      if (body) {
        const m = this.mass || 900, M = body.mass;
        const rel = (this.vx - body.vx) * nx + (this.vz - body.vz) * nz;
        if (rel < 0) {
          const j = (-1.25 * rel) / (1 / m + 1 / M);
          this.vx += (nx * j) / m; this.vz += (nz * j) / m;
          body.push((-nx * j) / M, (-nz * j) / M, cx, cz);
          const sev = (-rel * M) / (m + M) * 1.3;
          if (sev > impact) { impact = sev; hitEnd = end; hitN = [nx, nz]; }
          this.hitBody = body;
        }
        sx = (this.vx * dt) / n; sz = (this.vz * dt) / n;
        if (!blockedAt(this.pos.x + sx, this.pos.z + sz, this.heading)) { this.pos.x += sx; this.pos.z += sz; }
        continue;
      }
      const vn = this.vx * nx + this.vz * nz;
      if (vn < 0) {
        if (-vn > impact) { impact = -vn; hitEnd = end; hitN = [nx, nz]; }
        this.vx -= nx * vn * 1.12; this.vz -= nz * vn * 1.12; // a little bounce off the wall
        this.vx *= 0.985; this.vz *= 0.985;                   // scraping along it
        // A glancing blow turns the car along the wall instead of pinning it there.
        const vfNow = this.vx * fx + this.vz * fz;
        if (Math.hypot(this.vx, this.vz) > 1 && end === (Math.sign(vfNow) || 1)) {
          const along = Math.atan2(this.vx, this.vz) + (vfNow < 0 ? Math.PI : 0);
          const d = Math.atan2(Math.sin(along - this.heading), Math.cos(along - this.heading));
          const h2 = this.heading + d * 0.35;
          if (Math.abs(d) < 1.2 && !blockedAt(this.pos.x, this.pos.z, h2)) { this.heading = h2; this.yaw *= 0.5; fx = Math.sin(h2); fz = Math.cos(h2); }
        }
      }
      sx = (this.vx * dt) / n; sz = (this.vz * dt) / n;
      if (!blockedAt(this.pos.x + sx, this.pos.z + sz, this.heading)) { this.pos.x += sx; this.pos.z += sz; }
    }
    // Already overlapping something (spawned or pushed into it): ease out towards free space.
    const ov = blockedAt(this.pos.x, this.pos.z, this.heading);
    if (ov) {
      const [nx, nz] = freeDirection(world, this.pos.x + fx * hitOffset, this.pos.z + fz * hitOffset, R, -fx * ov, -fz * ov);
      this.pos.x += nx * Math.min(0.25, 3 * dt); this.pos.z += nz * Math.min(0.25, 3 * dt);
    }
    if (impact > 0.5) {
      // Which side hit, in the car's own frame: across from the wall normal, at the end that touched.
      const side = THREE.MathUtils.clamp(-(hitN[0] * -fz + hitN[1] * fx), -0.8, 0.8);
      if (impact > (this.impact || 0)) { this.impact = impact; this.impactLocal = [side, hitEnd]; }
      if (impact > 4) this.condition = Math.max(0, this.condition - (impact - 3) * 0.004);
    }
    this.speed = this.vx * fx + this.vz * fz;
    this.lastSpeed = this.speed;
    const dx = this.pos.x - moved0.x, dz = this.pos.z - moved0.z;
    const yawRate = this.yaw;

    // Fuel: ~1 % per 400 m, a trickle when idling.
    const dist = Math.hypot(dx, dz);
    this.odometer += dist;
    this.fuel = Math.max(0, this.fuel - dist / 300000 - dt * 0.000004); // ~300 km per tank (35 L, ~8.5 km/L)

    // Ground: average of front and rear wheels; kerbs give a bump.
    const wx = Math.sin(this.heading) * 1.17, wz = Math.cos(this.heading) * 1.17;
    world.pothole = false;
    const gF = world.groundHeight(this.pos.x + wx, this.pos.z + wz), gR = world.groundHeight(this.pos.x - wx, this.pos.z - wz);
    const g = (gF + gR) / 2;
    if (Math.abs(g - this.pos.y) > 0.06 && Math.abs(this.speed) > 3) {
      // Kerbs and potholes: a jolt, some lost speed, and a little damage when taken fast.
      this.speed *= 0.93;
      this.lastBump = 0.25;
      // Only potholes hurt the car (kerbs and rough patches just jolt it).
      if (world.pothole && Math.abs(this.speed) > 9) this.condition = Math.max(0, this.condition - 0.0012 * Math.abs(this.speed));
      this.bumped = true;
    }
    this.pos.y += (g - this.pos.y) * Math.min(1, dt * 12);

    // Body motion: pitch from acceleration and slope, roll from cornering.
    const accelNow = (this.speed - prev) / Math.max(dt, 1e-3);
    this.lastBump = Math.max(0, this.lastBump - dt);
    const targetPitch = THREE.MathUtils.clamp(-accelNow * 0.009, -0.075, 0.06) + Math.atan2(gR - gF, 2.34) + Math.sin(this.lastBump * 40) * this.lastBump * 0.08;
    const targetRoll = THREE.MathUtils.clamp(-yawRate * this.speed * 0.016, -0.1, 0.1); // old taxi, soft springs
    // Tyre slip (for marks and squeal): locking up under hard braking, sliding in fast corners.
    const lateral = Math.abs(yawRate * this.speed);
    const braking = (input.brake && Math.abs(this.speed) > 4) || (input.back && this.speed > 4);
    this.braking = braking;
    this.slip = Math.max(braking ? Math.min(1, Math.abs(this.speed) / 12) : 0, THREE.MathUtils.clamp((lateral - 5.5) / 4, 0, 1), THREE.MathUtils.clamp((Math.abs(this.lateral) - 1.2) / 2.5, 0, 1));
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
    return { fwd: Math.cos(this.heading), side: Math.sin(this.heading) };
  }
}

/**
 * Direction from a blocked circle towards free space: probe 8 directions and average the
 * free ones. Falls back to `(bx, bz)` (e.g. against the motion) when everything is blocked.
 */
export function freeDirection(world, x, z, r, bx, bz) {
  let nx = 0, nz = 0, free = 0;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2, cx = Math.cos(a), cz = Math.sin(a);
    if (!world.hits(x + cx * r * 0.7, z + cz * r * 0.7, r * 0.45)) { nx += cx; nz += cz; free++; }
  }
  if (!free || free === 8 || Math.hypot(nx, nz) < 1e-3) { nx = bx; nz = bz; }
  const l = Math.hypot(nx, nz) || 1;
  return [nx / l, nz / l];
}
