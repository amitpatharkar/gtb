import * as THREE from 'three';
import { G, SURFACE, handlingFor } from './handling.js';

// Vehicle physics, GTA V style: believable and fun rather than a strict simulation.
// - One rigid body (the chassis) in 2D with velocity separate from heading and a yaw rate.
//   Wheels are not rolling objects: each axle is a tyre on a grip curve (grip rises with the
//   slip angle to a peak, then falls to a sliding value), loaded by four raycast-style
//   suspension springs, so braking moves weight to the front, cornering to the outside, and a
//   kerb strike or pothole briefly unloads a wheel.
// - Every number comes from a handling table entry (handling.js, like handling.meta): mass,
//   centre of mass, drag, drive force, gears (flat torque to 80 % of the revs, then down to
//   60 %), front/rear drive, brakes and bias, handbrake, steering lock, grip, suspension,
//   anti-roll bars and damage multipliers.
// - Arcade assists, like GTA's hidden ones: grip-aware steering lock, a stability helper that
//   damps yaw the steering did not ask for (except while the handbrake is on), tip assist
//   (cars slide rather than roll; autos are allowed up on two wheels, and over if pushed),
//   downforce rising with speed.
// - Collisions: impulses at the contact point with restitution and friction, so an
//   off-centre hit spins the car; other vehicles exchange momentum by mass; breakable street
//   props give way (world.breakable) and only cost some speed.
// - Two-wheelers lean into corners, wheelie with Shift held, and throw the rider off in a hard
//   crash; autos tip up in fast corners; potholes can puncture a tyre; a battered engine misfires.
// Forces are integrated in fixed sub-steps (≤ 1/120 s), so the feel is the same at any frame rate.

const SUB = 1 / 120;      // physics sub-step (s)
const V_MIN = 3;          // slip-angle regularisation at walking pace (m/s): no jitter when slow
const NRM = [0, 0];       // freeDirection result (no array per contact)

/** Grip curve (GTA's traction curve): rises to 1 at the peak slip, then falls to `min` (0..1). */
function gripCurve(x, min) {
  if (x < 1) return x * (2 - x);
  const t = Math.min(1, (x - 1) / 1.6);
  return 1 - (1 - min) * t * t * (3 - 2 * t);
}

export class Car {
  constructor(model, opts = {}) {
    this.model = model;
    this.pos = new THREE.Vector3();
    this.heading = 0;      // radians, 0 = +z (south); increasing = turning left
    this.speed = 0;        // m/s along the heading
    this.vx = 0; this.vz = 0; // world velocity
    this.yaw = 0;          // yaw rate (rad/s)
    this.lastSpeed = 0;
    this.steer = 0;        // front wheel angle (rad)
    this.radius = 0.8;
    this.halfLength = 1.1;
    this.circles = null;
    this.fuel = opts.fuel ?? 0.6;          // 0..1 (full tank ≈ 300 km)
    this.condition = 1;                    // 0..1, drops in crashes
    this.odometer = 0;
    this.lastBump = 0;
    this.pitch = 0; this.roll = 0;         // body angles as drawn
    this.lateral = 0; this.slip = 0; this.braking = false; this.throttle = 0;
    this.impact = 0; this.impactLocal = [0, 0];
    // Gearbox and engine.
    this.gear = 1; this.rpm = 0.2; this.shiftT = 0; this.misfireT = 0; this.backfire = false;
    // Suspension (heave m, pitch nose-up rad, roll left-up rad) and their rates.
    this.hz = 0; this.hzV = 0; this.pt = 0; this.ptV = 0; this.rl = 0; this.rlV = 0;
    this.ax = 0; this.ay = 0;              // body accelerations (m/s², forward / left)
    this.load = new Float32Array(4);       // wheel loads (N): FL FR RL RR
    this.gy = new Float32Array(4); this.gyPrev = new Float32Array(4); this.gs = new Uint8Array(4);
    this.hole = new Uint8Array(4); this.holePrev = new Uint8Array(4); this.kerbPrev = new Float32Array(4);
    this.gMean = 0; this.probed = false;
    this.tip = 0; this.tipV = 0; this.tipSide = 1; // inside wheels lifted (autos), rad
    this.lean = 0;                         // two-wheelers: lean into the corner (rad)
    this.wheelie = 0; this.wheelieV = 0;   // two-wheelers: front wheel up (rad)
    this.flat = -1;                        // punctured wheel (0 FL, 1 FR, 2 RL, 3 RR), -1 none
    this.fallen = 0;                       // ±1: lying on its side (dropped bike, tipped auto)
    this.crash = null;                     // event for main.js: 'thrown' | 'tip' | 'loop'
    this.puncture = false;                 // event: a tyre just went
    this.scrape = 0; this.scrapeX = 0; this.scrapeZ = 0; // sliding along a wall (sparks)
    this.handT = 1;                        // seconds since the handbrake was let go (drift hold)
    this.spinF = false; this.spinR = false; this.slipNow = 0; this.accelNow = 0;
    this.hitBody = null; this.hitO = 0; this.bumped = false; this.frameDt = 1 / 60;
    this.gv = new Float32Array(4);         // how fast the ground rises under each wheel (m/s)
    this.setHandling(handlingFor('kaali'));
    if (opts.maxSpeed) this.maxSpeed = opts.maxSpeed;
    if (opts.accel) this.accel = opts.accel;
  }

  /** Use a handling table entry (handling.js). maxSpeed and accel stay writable (cheats). */
  setHandling(h) {
    this.h = h;
    this.maxSpeed = h.topSpeed; this.accel = h.driveForce; this.mass = h.mass;
    const L = h.wheelBase;
    this.cgF = L * (1 - h.front);  // centre of mass → front axle
    this.cgR = L * h.front;        // centre of mass → rear axle
    this.iz = h.mass * Math.max(0.3, this.cgF * this.cgR) * h.inertia;
    const nW = h.twoWheeler ? 2 : 4, w = 2 * Math.PI * h.spring;
    this.kSpring = (h.mass / nW) * w * w;
    this.cSpring = 2 * h.damping * Math.sqrt(this.kSpring * h.mass / nW);
    this.ip = h.mass * (L * L) * 0.16;
    this.ir = h.mass * ((h.track / 2) ** 2 + h.comHeight ** 2) * 0.55;
    this.kArb = h.antiRoll * this.kSpring * 0.8; // N per metre of side-to-side compression difference
    this.gear = 1; this.shiftT = 0; this.tip = this.tipV = 0; this.wheelie = this.wheelieV = 0; this.lean = 0;
    this.hz = this.hzV = this.pt = this.ptV = this.rl = this.rlV = 0;
    this.probed = false;
    this.gearTop = new Float32Array(h.gears + 1);
    this.gearMul = new Float32Array(h.gears + 1);
    this.topFor = -1;
  }

  /** Gear speeds for the current top speed (cheats and a battered engine change it). */
  gears(top) {
    if (top === this.topFor) return;
    this.topFor = top;
    const n = this.h.gears;
    for (let i = 1; i <= n; i++) this.gearTop[i] = top * (i / n) ** 0.8;
    for (let i = 1; i <= n; i++) this.gearMul[i] = (this.gearTop[1] / this.gearTop[i]) ** 0.45;
  }

  /** Back on its wheels (the player picks up a dropped bike or rights a tipped auto). */
  rightUp() { this.fallen = 0; this.tip = this.tipV = 0; this.vx = this.vz = this.yaw = 0; this.speed = this.lastSpeed = 0; }

  /** world.hits(x, z, r) → blocked; world.groundHeight / world.wheel(x, z) → y; world.bodyAt, world.breakable optional. */
  update(dt, input, world) {
    const h = this.h;
    if (!(dt > 0)) { this.draw(0, input); return { fwd: Math.cos(this.heading), side: Math.sin(this.heading) }; } // a zero-length frame (the first one)
    // Someone set `speed` directly (teleports, respawn, cheats, AI resets): re-sync the velocity.
    if (this.speed !== this.lastSpeed && !Number.isNaN(this.lastSpeed)) { this.vx = Math.sin(this.heading) * this.speed; this.vz = Math.cos(this.heading) * this.speed; this.yaw = 0; }
    this.crash = null; this.puncture = false; this.backfire = false; this.scrape = 0;
    const oldHeading = this.heading;
    const x0 = this.pos.x, z0 = this.pos.z;

    // Ground under the four wheels (raycast wheels): heights, surfaces, potholes.
    this.frameDt = Math.max(dt, 1e-3);
    this.probe(world);

    const steerIn = this.fallen ? 0 : input.steer ?? ((input.left ? 1 : 0) - (input.right ? 1 : 0)); // AI drivers pass an analogue steer
    const speedNow = Math.hypot(this.vx, this.vz);
    // Grip-aware steering lock: full lock at walking pace; at speed about what the tyres can
    // use, so a keyboard tap takes the car to its limit, not far past it.
    // Top-heavy vehicles (autos) steer to about where the inside wheels would lift, not to the tyres' limit.
    const mu = Math.min(h.gripMax, h.tipAssist < 1 && !h.twoWheeler ? (h.tipTrack / 2 / h.comHeight) * 1.15 : 9) * this.surfGrip(0);
    const lock = Math.min(h.steerLock, Math.max(0.08, (h.wheelBase * mu * G) / Math.max(1, speedNow * speedNow) + h.slipPeak * 0.85));
    this.steer += (steerIn * lock - this.steer) * Math.min(1, dt * 6);
    if (input.brake && Math.abs(steerIn) > 0.1 && speedNow > 5 && !h.twoWheeler) this.handT = 0; else this.handT += dt;

    if (this.fallen) this.slideFallen(dt);
    else {
      const n = Math.max(1, Math.ceil(dt / SUB)), hdt = dt / n;
      for (let i = 0; i < n; i++) this.integrate(hdt, input, steerIn);
    }
    this.move(dt, world, oldHeading);
    if (!Number.isFinite(this.vx + this.vz + this.yaw + this.heading)) { this.vx = this.vz = this.yaw = 0; if (!Number.isFinite(this.heading)) this.heading = oldHeading || 0; this.ax = this.ay = 0; this.hz = this.hzV = this.pt = this.ptV = this.rl = this.rlV = 0; } // never let a NaN stick

    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const prev = this.lastSpeed || 0;
    this.speed = this.vx * fx + this.vz * fz;
    this.lastSpeed = this.speed;
    this.lateral = this.vx * fz - this.vz * fx;

    // Fuel: ~1 % per 3 km, a trickle when idling.
    const dist = Math.hypot(this.pos.x - x0, this.pos.z - z0);
    this.odometer += dist;
    this.fuel = Math.max(0, this.fuel - dist / 300000 - dt * 0.000004); // ~300 km per tank (35 L, ~8.5 km/L)
    this.jolts(world);
    this.pos.y += (this.gMean - this.pos.y) * Math.min(1, dt * 12);

    // Tyre slip for marks and squeal: sliding axles, wheelspin, handbrake, locking up.
    const braking = (input.brake && speedNow > 4) || (input.back && this.speed > 4);
    this.braking = braking && !this.fallen;
    this.throttle = input.fwd && !this.fallen ? 1 : 0;
    this.slip = this.fallen ? 0 : Math.max(this.slipNow || 0, braking && input.brake ? Math.min(1, speedNow / 12) : 0);
    this.accelNow = (this.speed - prev) / Math.max(dt, 1e-3);
    this.draw(dt, input);
    return { fwd: fz, side: fx };
  }

  /** Grip of the ground under the front (0) or rear (1) axle, with off-road loss and puddles. */
  surfGrip(axle) {
    return (this.wheelGrip(this.gs[axle * 2]) + this.wheelGrip(this.gs[axle * 2 + 1])) * 0.5;
  }

  /** A surface's grip as this vehicle feels it: loose ground costs more or less (fTractionLossMult). */
  wheelGrip(s) {
    const S = SURFACE[s], loss = 1 - S.grip;
    return 1 - loss * (S.loose ? 1 + S.loose * (this.h.offroadLoss / 0.6 - 1) : 1);
  }

  probe(world) {
    const h = this.h, fx = Math.sin(this.heading), fz = Math.cos(this.heading), lx = fz, lz = -fx;
    const tw = h.track / 2;
    let sum = 0;
    for (let i = 0; i < 4; i++) {
      this.gyPrev[i] = this.gy[i];
      this.holePrev[i] = this.hole[i];
      if (h.twoWheeler && (i & 1)) { this.gy[i] = this.gy[i - 1]; this.gs[i] = this.gs[i - 1]; this.hole[i] = 0; sum += this.gy[i]; continue; }
      const along = i < 2 ? this.cgF : -this.cgR, side = h.twoWheeler ? 0 : (i & 1 ? -tw : tw);
      const x = this.pos.x + fx * along + lx * side, z = this.pos.z + fz * along + lz * side;
      let y;
      if (world.wheel) { y = world.wheel(x, z); this.gs[i] = world.surface ?? 0; this.hole[i] = world.pothole ? 1 : 0; }
      else { world.pothole = false; y = world.groundHeight(x, z); this.gs[i] = 0; this.hole[i] = world.pothole ? 1 : 0; }
      this.gy[i] = y;
      sum += y;
    }
    this.gMean = sum / 4;
    if (!this.probed || Math.abs(this.gMean - this.pos.y) > 1) { this.probed = true; this.gyPrev.set(this.gy); this.holePrev.set(this.hole); this.pos.y = this.gMean; }
    for (let i = 0; i < 4; i++) this.gv[i] = Math.max(-2, Math.min(2, (this.gy[i] - this.gyPrev[i]) / this.frameDt));
  }

  /** One fixed sub-step of forces: tyres, engine, brakes, drag, suspension, assists. */
  integrate(hdt, input, steerIn) {
    const h = this.h, m = this.mass, W = m * G, a = this.cgF, b = this.cgR, L = h.wheelBase;
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading), lx = fz, lz = -fx;
    let vf = this.vx * fx + this.vz * fz, vl = this.vx * lx + this.vz * lz;
    const r = this.yaw, speed = Math.hypot(vf, vl);
    const empty = this.fuel <= 0;
    const top = this.maxSpeed * (0.8 + 0.2 * this.condition) * (this.flat >= 0 ? 0.75 : 1);
    this.gears(top);

    // --- suspension: four springs on the ground the wheels found (raycast wheels).
    this.suspension(hdt);
    const ld = this.load;
    const down = h.downforce * vf * vf * W;
    let nF = ld[0] + ld[1] + down * (b / L), nR = ld[2] + ld[3] + down * (a / L);
    // Load sensitivity: an unevenly loaded axle grips a little less in total (anti-roll bias).
    const xF = nF > 1 ? (ld[0] - ld[1]) / nF : 0, xR = nR > 1 ? (ld[2] - ld[3]) / nR : 0;
    const sensF = h.twoWheeler ? 1 : 1 - 0.24 * xF * xF, sensR = h.twoWheeler ? 1 : 1 - 0.24 * xR * xR;
    // Tip assist: near the load that would lift the inside wheels, grip falls away instead.
    let tipCut = 1;
    if (!h.twoWheeler && h.tipAssist < 1) {
      const tipA = (G * h.tipTrack * 0.5) / h.comHeight, k = Math.abs(this.ay) / tipA;
      if (k > 0.72) tipCut = 1 - h.tipAssist * Math.min(1, (k - 0.72) / 0.28) * 0.5;
      // Up on two wheels the driver backs off and the tyres scrub: it usually comes back down.
      if (this.tip > 0) tipCut *= Math.max(0.3, 1 - (1.4 * this.tip) / Math.atan2(h.tipTrack / 2, h.comHeight));
    }
    const gF = this.surfGrip(0), gR = this.surfGrip(1);
    const flatF = this.flat === 0 || this.flat === 1 ? 0.72 : 1, flatR = this.flat >= 2 ? 0.72 : 1;
    const wheelieCut = this.wheelie > 0 ? Math.max(0.2, 1 - this.wheelie * 4) : 1;
    const muF = h.gripMax * (h.gripBias * 2) * gF * sensF * tipCut * flatF * wheelieCut;
    const muR = h.gripMax * ((1 - h.gripBias) * 2) * gR * sensR * tipCut * flatR;
    const capF = muF * nF, capR = muR * nR;

    // --- engine and gearbox (automatic): flat torque to 80 % of the revs, 60 % at the limiter.
    const n = h.gears, vAbs = Math.abs(vf);
    if (this.shiftT > 0) this.shiftT -= hdt;
    if (this.gear < 1) this.gear = 1;
    let rpm = vAbs / this.gearTop[this.gear];
    if (input.fwd && rpm > 0.94 && this.gear < n && this.shiftT <= 0) { this.gear++; this.shiftT = h.shift; }
    else if (rpm < 0.42 && this.gear > 1) this.gear--;
    rpm = Math.max(0.18 + (input.fwd ? 0.12 : 0), vAbs / this.gearTop[this.gear]);
    this.rpm = rpm;
    const torque = rpm < 0.8 ? 1 : rpm < 1 ? 1 - 2 * (rpm - 0.8) : rpm < 1.04 ? 0.6 * (1 - (rpm - 1) / 0.04) : 0;
    // A battered engine loses power and misfires now and then (bangs out of the exhaust).
    if (this.misfireT > 0) this.misfireT -= hdt;
    else if (input.fwd && this.condition < 0.4 && Math.random() < hdt * (0.4 - this.condition) * 7 * h.engineDamage) { this.misfireT = 0.1 + Math.random() * 0.25; this.backfire = true; }
    const power = (1 - (1 - (0.7 + 0.3 * this.condition)) * h.engineDamage) * (this.misfireT > 0 ? 0 : 1);

    let driveF = 0, brakeF = 0, brakeR = 0, hand = false;
    const reversing = vf < 0.5 && input.back && !input.fwd;
    if (input.fwd && !empty && vf > -0.5) {
      if (this.shiftT <= 0) driveF = m * this.accel * this.gearMul[this.gear] * torque * power;
    } else if (reversing && !empty) {
      this.gear = 1;
      driveF = vf > -5 ? -m * this.accel * h.reverse * power : 0;
    }
    if (input.back && vf > 0.5) { brakeF = m * h.brakeForce * h.brakeBias; brakeR = m * h.brakeForce * (1 - h.brakeBias); }
    if (input.fwd && vf < -0.5) { brakeF = m * h.brakeForce * h.brakeBias; brakeR = m * h.brakeForce * (1 - h.brakeBias); }
    if (input.brake) {
      // Space: the handbrake locks the rear for a slide when steering at speed; otherwise a
      // hard stop on all four (the old taxi's habit, and how the game always played).
      if (Math.abs(steerIn) > 0.1 && speed > 5 && !h.twoWheeler) hand = true;
      else { brakeF = m * h.brakeForce * 1.2 * h.brakeBias; brakeR = m * h.brakeForce * 1.2 * (1 - h.brakeBias); driveF = 0; }
    }
    // --- tyres: slip angles → lateral forces on the grip curve, inside the friction circle.
    const d = this.steer, cs = Math.cos(d), sn = Math.sin(d);
    const vfl = vl + a * r, vrl = vl - b * r;
    const wLong = vf * cs + vfl * sn, wLat = -vf * sn + vfl * cs;
    const alphaF = Math.atan2(wLat, Math.max(Math.abs(wLong), V_MIN));
    const alphaR = Math.atan2(vrl, Math.max(vAbs, V_MIN));
    const kF = Math.abs(alphaF) / h.slipPeak, kR = Math.abs(alphaR) / h.slipPeak;
    const minK = h.gripMin / h.gripMax;
    let fyF = -Math.sign(alphaF) * gripCurve(kF, minK) * capF;
    let fyR = -Math.sign(alphaR) * gripCurve(kR, minK) * capR;
    const mF = m * b / L, mR = m * a / L; // axle shares of the mass
    // Never more sideways force than stops the axle's sideways sliding within this sub-step.
    const stopF = Math.abs(wLat) * mF / hdt, stopR = Math.abs(vrl) * mR / hdt;
    if (Math.abs(fyF) > stopF) fyF = Math.sign(fyF) * stopF;
    if (Math.abs(fyR) > stopR) fyR = Math.sign(fyR) * stopR;
    // Drive split between the axles; each axle can only push what its tyres grip (wheelspin).
    let dF = driveF * h.driveBias, dR = driveF * (1 - h.driveBias);
    this.spinF = Math.abs(dF) > capF * 0.95; this.spinR = Math.abs(dR) > capR * 0.95;
    // Traction help (arcade): in a corner the drive leaves the tyres the grip they need sideways,
    // so full throttle through a bend does not spin a rear-wheel-drive Padmini round.
    if (h.stability > 0 && !hand) {
      const keepF = Math.max(capF * 0.25, Math.sqrt(Math.max(0, capF * capF - fyF * fyF))), keepR = Math.max(capR * 0.25, Math.sqrt(Math.max(0, capR * capR - fyR * fyR)));
      if (Math.abs(dF) > keepF) dF = Math.sign(dF) * keepF;
      if (Math.abs(dR) > keepR) dR = Math.sign(dR) * keepR;
    }
    if (this.spinF) dF = Math.sign(dF) * capF * 0.9;
    if (this.spinR) dR = Math.sign(dR) * capR * 0.9;
    // Brakes with an ABS-like limit (no lock-ups on the foot brake).
    const sv = vf > 0 ? 1 : -1;
    let fxF = dF - sv * Math.min(brakeF, capF * 0.97, Math.abs(vf) * m * 0.5 / hdt);
    let fxR = hand ? 0 : dR - sv * Math.min(brakeR, capR * 0.97, Math.abs(vf) * m * 0.5 / hdt);

    const roomF = Math.sqrt(Math.max(0, capF * capF - fxF * fxF));
    if (Math.abs(fyF) > roomF) fyF = Math.sign(fyF) * roomF;
    let handX = 0, handY = 0;
    if (hand) {
      // Locked rear wheels slide: friction against the rear contact's whole velocity.
      const vr = Math.hypot(vf, vrl), slideMu = h.gripMin * 0.78 * gR * h.handbrake;
      if (vr > 0.3) { handX = (-vf / vr) * slideMu * nR; handY = (-vrl / vr) * slideMu * nR; }
      fyR = 0;
    } else {
      const roomR = Math.sqrt(Math.max(0, capR * capR - fxR * fxR));
      if (Math.abs(fyR) > roomR) fyR = Math.sign(fyR) * roomR;
    }
    // Body-frame forces and the yaw moment.
    const fLong = fxF * cs - fyF * sn + fxR + handX;
    const fLat = fxF * sn + fyF * cs + fyR + handY;
    let mz = a * (fxF * sn + fyF * cs) - b * (fyR + handY);
    // A flat tyre drags its corner (the car pulls that way).
    if (this.flat >= 0 && vAbs > 0.5) mz += (this.flat & 1 ? -1 : 1) * (h.track / 2) * sv * m * 0.9;

    // Rolling resistance, engine braking when coasting in gear, and air drag.
    const roll = (SURFACE[this.gs[0]].roll + SURFACE[this.gs[1]].roll + SURFACE[this.gs[2]].roll + SURFACE[this.gs[3]].roll) / 4 + (this.flat >= 0 ? 0.8 : 0);
    const coast = roll + (input.fwd || reversing || brakeF > 0 || hand ? 0 : 0.45 + 0.4 * rpm); // engine braking only when coasting
    const ax = fLong / m, ay = fLat / m;
    vf += ax * hdt; vl += ay * hdt;
    const stop = Math.min(Math.abs(vf), coast * hdt);
    vf -= Math.sign(vf) * stop;
    const dragK = h.drag * speed * hdt;
    vf -= vf * dragK; vl -= vl * dragK;
    if (vf > top * 1.12) vf = top * 1.12;
    if (vf < -6) vf = -6;
    this.vx = vf * fx + vl * lx; this.vz = vf * fz + vl * lz;

    // Yaw, with GTA's stability helper: yaw the steering did not ask for is damped (not while
    // the handbrake is on, and gently for a moment after it, so a drift can be held).
    let yaw = r + (mz / this.iz) * hdt;
    if (vAbs > 2.5) {
      const want = (vf * Math.tan(d)) / L, lim = (h.gripMax * gF * G) / Math.max(vAbs, 2) * 1.08;
      const ref = Math.max(-lim, Math.min(lim, want));
      const over = yaw - ref;
      if (!hand && (over * yaw > 0 || ref * yaw < 0)) {
        const k = h.stability * Math.min(1, this.handT / 0.8) * (input.fwd ? 2.2 : 3.2);
        yaw -= over * Math.min(1, k * hdt);
      }
      // …and a car sliding sideways is turned back towards where it is going (no easy spins).
      const beta = Math.atan2(vl, vAbs);
      if (!hand && Math.abs(beta) > 0.1) yaw += (beta - Math.sign(beta) * 0.1) * h.stability * Math.min(1, this.handT / 0.8) * 4 * hdt * Math.sign(vf);
    }
    // Parked or crawling with nothing pressed: tyres hold it still.
    if (!input.fwd && !input.back && Math.abs(vf) < 0.25 && Math.abs(vl) < 0.4) { this.vx *= 0.5; this.vz *= 0.5; yaw *= 0.5; if (Math.abs(vf) < 0.05) { this.vx = this.vz = 0; yaw = 0; } }
    this.yaw = yaw;
    this.heading += yaw * hdt;

    // Body accelerations (for weight transfer, tipping and lean), smoothed a little.
    this.ax += (ax - this.ax) * Math.min(1, hdt * 16);
    const ayLim = h.gripMax * G * 1.1, ayNow = ay > ayLim ? ayLim : ay < -ayLim ? -ayLim : ay;
    this.ay += (ayNow - this.ay) * Math.min(1, hdt * 16); // felt lateral acceleration (smoothed: no sub-step spikes)
    this.slipNow = Math.max(
      Math.min(1, Math.max(0, kF - 1.2) * 0.8), Math.min(1, Math.max(0, kR - 1.1) * 0.8),
      hand && vAbs > 4 ? Math.min(1, vAbs / 10) : 0,
      (this.spinF || this.spinR) && input.fwd ? 0.7 : 0,
    );

    // Two-wheelers: lean, and a wheelie when Shift leans the rider back.
    if (h.twoWheeler) {
      const leanWant = Math.max(-0.8, Math.min(0.8, Math.atan2(this.ay, G)));
      this.lean += (leanWant - this.lean) * Math.min(1, hdt * 7);
      if (h.wheelie > 0) this.wheelieStep(hdt, input, driveF / m);
    } else if (h.tipAssist < 1) this.tipStep(hdt);
  }

  /** Raycast-style suspension: heave, pitch and roll on four springs; fills this.load. */
  suspension(hdt) {
    const h = this.h, m = this.mass, a = this.cgF, b = this.cgR, tw = h.track / 2, two = h.twoWheeler;
    const k = this.kSpring, c = this.cSpring, W = m * G;
    let sumF = 0, sumP = 0, sumR = 0;
    let arbF = 0, arbR = 0;
    if (!two) {
      // Anti-roll bars resist one side compressing more than the other, moving load across the
      // axle (more at the front = understeer, rollBias / fAntiRollBarBiasFront).
      const rollComp = 2 * tw * this.rl;
      arbF = this.kArb * h.rollBias * rollComp; arbR = this.kArb * (1 - h.rollBias) * rollComp;
    }
    for (let i = 0; i < 4; i++) {
      if (two && (i & 1)) { this.load[i] = 0; continue; } // two-wheelers: one spring per axle
      const front = i < 2, x = front ? a : -b, y = two ? 0 : (i & 1 ? -tw : tw);
      const share = (front ? b : a) / h.wheelBase / (two ? 1 : 2); // static load share
      const gRel = this.gy[i] - this.gMean - (this.flat === i ? 0.05 : 0);
      const comp = gRel - (this.hz + x * this.pt + y * this.rl);
      const compV = this.gv[i] * 0.3 - (this.hzV + x * this.ptV + y * this.rlV);
      let F = W * share + k * comp + c * compV - (y > 0 ? 1 : y < 0 ? -1 : 0) * (front ? arbF : arbR);
      if (comp > h.travel) F += k * 5 * (comp - h.travel); // bump stop
      if (F < 0) F = 0;                                    // the wheel has left the ground
      this.load[i] = F;
      sumF += F; sumP += F * x; sumR += F * y;
    }
    // Accelerating squats, braking dives, cornering rolls the body outwards.
    const hzA = (sumF - W) / m;
    const ptA = (sumP + m * this.ax * h.comHeight * 0.6) / this.ip;
    const rlA = two ? 0 : (sumR + m * this.ay * h.comHeight * 0.6) / this.ir;
    this.hzV += hzA * hdt; this.ptV += ptA * hdt; this.rlV += rlA * hdt;
    this.hz += this.hzV * hdt; this.pt += this.ptV * hdt; this.rl += this.rlV * hdt;
    // Keep the body sane (and settle fast after a teleport).
    if (this.hz < -0.25 || this.hz > 0.35) { this.hz = Math.max(-0.25, Math.min(0.35, this.hz)); this.hzV = 0; }
    if (this.pt < -0.12 || this.pt > 0.12) { this.pt = Math.max(-0.12, Math.min(0.12, this.pt)); this.ptV = 0; }
    if (this.rl < -0.14 || this.rl > 0.14) { this.rl = Math.max(-0.14, Math.min(0.14, this.rl)); this.rlV = 0; }
  }

  /** Autos (and anything top-heavy without the assist): up on two wheels, maybe over. */
  tipStep(hdt) {
    const h = this.h, d = h.tipTrack / 2, hc = h.comHeight;
    const side = this.tip > 0 ? this.tipSide : Math.sign(this.ay) || 1;
    const aSide = this.ay * side; // lateral acceleration pushing towards the outside wheels
    const lift = aSide * (d * Math.sin(this.tip) + hc * Math.cos(this.tip)) - G * (d * Math.cos(this.tip) - hc * Math.sin(this.tip));
    if (this.tip <= 0 && lift <= 0) { this.tip = 0; this.tipV = 0; return; }
    if (this.tip <= 0) this.tipSide = side;
    // GTA-style help: a righting moment (stronger with more tip assist) and a damped roll.
    this.tipV += ((lift - 12 * this.tip * (0.5 + h.tipAssist)) / ((d * d + hc * hc) * 1.3)) * hdt;
    this.tipV *= 1 - Math.min(1, hdt * 4);
    this.tip += this.tipV * hdt;
    if (this.tip <= 0) { if (this.tipV < -0.6) this.lastBump = 0.25; this.tip = 0; this.tipV = 0; }
    if (this.tip > Math.atan2(d, hc) + 0.08) { this.fallen = this.tipSide; this.crash = 'tip'; this.tip = 0; this.tipV = 0; }
  }

  /** Front wheel up: drive torque lifts it, gravity pulls it down; the rider eases off near the top. */
  wheelieStep(hdt, input, driveA) {
    const h = this.h, b = this.cgR, hc = h.comHeight, w = this.wheelie;
    const back = input.run && input.fwd ? 1.8 : 0.12;
    const ease = Math.max(0, 1 - w / 0.65);
    const lift = (Math.max(0, driveA) * back * h.wheelie * ease) / G - (Math.cos(w) * b - Math.sin(w) * hc) / hc;
    this.wheelieV += (9 * lift - 2.5 * this.wheelieV) * hdt;
    if (input.back || input.brake) this.wheelieV -= 6 * hdt;
    this.wheelie += this.wheelieV * hdt;
    if (this.wheelie <= 0) { if (this.wheelieV < -1.2) this.lastBump = 0.2; this.wheelie = 0; this.wheelieV = Math.max(0, this.wheelieV); }
    if (this.wheelie > 1.25) { this.crash = 'loop'; this.fallen = Math.random() < 0.5 ? 1 : -1; this.wheelie = 0; this.wheelieV = 0; }
  }

  /** On its side: slides to a stop on the road (sparks), no driving. */
  slideFallen(dt) {
    const sp = Math.hypot(this.vx, this.vz);
    if (sp > 0.05) {
      const dec = Math.min(sp, 4.4 * dt) / sp;
      this.vx -= this.vx * dec; this.vz -= this.vz * dec;
      if (sp > 2) { this.scrape = sp; this.scrapeX = this.pos.x; this.scrapeZ = this.pos.z; }
    } else this.vx = this.vz = 0;
    this.heading += this.yaw * dt;
    this.yaw *= Math.exp(-dt * 3);
    this.steer = 0;
  }

  /**
   * Move with the world: small steps; on contact an impulse at the contact point (restitution
   * and friction) stops the velocity going in and spins the car about its centre of mass.
   * Other vehicles exchange momentum by mass; breakable props give way.
   */
  move(dt, world, oldHeading) {
    const h = this.h, m = this.mass, I = this.iz, R = this.radius;
    let fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    // Turning into a wall: keep the old heading (and bounce the rotation back a little).
    if (this.blocked(world, this.pos.x, this.pos.z, this.heading) && !this.blocked(world, this.pos.x, this.pos.z, oldHeading)) {
      this.heading = oldHeading; this.yaw *= -0.2; fx = Math.sin(this.heading); fz = Math.cos(this.heading);
    }
    const len = Math.hypot(this.vx, this.vz) * dt, n = Math.max(1, Math.ceil(len / 0.35));
    let impact = 0, hitEnd = 0, hnx = 0, hnz = 0;
    for (let i = 0; i < n; i++) {
      let sx = (this.vx * dt) / n, sz = (this.vz * dt) / n;
      const end = this.blocked(world, this.pos.x + sx, this.pos.z + sz, this.heading);
      if (!end) { this.pos.x += sx; this.pos.z += sz; continue; }
      const o = this.hitO, cx = this.pos.x + sx + fx * o, cz = this.pos.z + sz + fz * o;
      freeDirection(world, cx, cz, R, -this.vx, -this.vz);
      const nx = NRM[0], nz = NRM[1];
      // Contact point and the car's velocity there (v + ω × r).
      const rx = cx - nx * R - this.pos.x, rz = cz - nz * R - this.pos.z;
      const vpx = this.vx + this.yaw * rz, vpz = this.vz - this.yaw * rx;
      const rn = rz * nx - rx * nz, tx = -nz, tz = nx, rt = rz * tx - rx * tz;
      const body = world.bodyAt?.(cx, cz, R);
      let ovx = 0, ovz = 0, invM = 0, e = h.restitution, fric = 0.35;
      if (body) { ovx = body.vx; ovz = body.vz; invM = 1 / body.mass; e = 0.25; fric = 0.5; }
      const relN = (vpx - ovx) * nx + (vpz - ovz) * nz;
      if (relN < 0) {
        // A lamp post, sign or thela can give way: through it, a little slower.
        const keep = !body && relN < -2 && world.breakable ? world.breakable(cx, cz, R, -relN, m, this.vx, this.vz) : -1;
        if (keep >= 0) {
          this.vx += nx * -relN * (1 - keep); this.vz += nz * -relN * (1 - keep);
          if (-relN * (1 - keep) > impact) { impact = -relN * (1 - keep); hitEnd = end; hnx = nx; hnz = nz; }
        } else {
          const j = (-(1 + e) * relN) / (1 / m + (rn * rn) / I + invM);
          const relT = (vpx - ovx) * tx + (vpz - ovz) * tz;
          let jt = -relT / (1 / m + (rt * rt) / I + invM);
          if (jt > fric * j) jt = fric * j; else if (jt < -fric * j) jt = -fric * j;
          const px = nx * j + tx * jt, pz = nz * j + tz * jt;
          this.vx += px / m; this.vz += pz / m;
          this.yaw += (rn * j + rt * jt) / I;
          if (this.yaw > 6) this.yaw = 6; else if (this.yaw < -6) this.yaw = -6;
          const sev = body ? (-relN * body.mass) / (m + body.mass) * 1.3 : -relN;
          if (sev > impact) { impact = sev; hitEnd = end; hnx = nx; hnz = nz; }
          if (body) { body.push(-px / body.mass, -pz / body.mass, cx - nx * R, cz - nz * R); this.hitBody = body; }
          else if (Math.abs(relT) > 3 && Math.abs(relT) > this.scrape) { this.scrape = Math.abs(relT); this.scrapeX = cx - nx * R; this.scrapeZ = cz - nz * R; }
        }
      }
      sx = (this.vx * dt) / n; sz = (this.vz * dt) / n;
      if (!this.blocked(world, this.pos.x + sx, this.pos.z + sz, this.heading)) { this.pos.x += sx; this.pos.z += sz; }
    }
    // Already overlapping something (spawned or pushed into it): ease out towards free space.
    const ov = this.blocked(world, this.pos.x, this.pos.z, this.heading);
    if (ov) {
      freeDirection(world, this.pos.x + fx * this.hitO, this.pos.z + fz * this.hitO, R, -fx * ov, -fz * ov);
      this.pos.x += NRM[0] * Math.min(0.25, 3 * dt); this.pos.z += NRM[1] * Math.min(0.25, 3 * dt);
    }
    if (impact > 0.5) {
      // Which side hit, in the car's own frame: across from the wall normal, at the end that touched.
      const side = THREE.MathUtils.clamp(-(hnx * -fz + hnz * fx), -0.8, 0.8);
      if (impact > (this.impact || 0)) { this.impact = impact; this.impactLocal[0] = side; this.impactLocal[1] = hitEnd; }
      if (impact > 4) this.condition = Math.max(0, this.condition - (impact - 3) * 0.004 * h.collisionDamage);
      // Riders come off in a hard crash (GTA's bike crashes): main.js throws them.
      if (h.twoWheeler && !this.fallen && impact > (h.mass < 60 ? 3.5 : 4.5)) { this.crash = 'thrown'; this.fallen = hnx * -fz + hnz * fx > 0 ? -1 : 1; }
      // A hard hit can unsettle the suspension too.
      this.ptV += -this.impactLocal[1] * Math.min(1.5, impact * 0.08); this.rlV += side * Math.min(1.5, impact * 0.06);
    }
  }

  /** ±1 for the end of the vehicle whose collision circle touches something at (x, z, heading); 0 = clear. */
  blocked(world, x, z, heading) {
    const sh = Math.sin(heading), ch = Math.cos(heading), R = this.radius;
    const circles = this.circles || (this.circles = [this.halfLength, -this.halfLength]);
    for (let i = 0; i < circles.length; i++) {
      const o = circles[i];
      if (world.hits(x + sh * o, z + ch * o, R)) { this.hitO = o; return o < 0 ? -1 : 1; }
    }
    return 0;
  }

  /**
   * Jolts come from the ground itself changing under a wheel — a kerb edge, a wheel dropping
   * into a pothole — once per wheel and event, so the speed lost is the same at any frame rate.
   * A fast pothole can puncture a tyre.
   */
  jolts(world) {
    world.pothole = this.hole[0] || this.hole[1] || this.hole[2] || this.hole[3];
    const sp = Math.abs(this.speed);
    if (sp <= 3 || this.fallen) return;
    let loss = 1, holes = 0;
    for (let i = 0; i < 4; i++) {
      if (this.h.twoWheeler && i % 2) continue;
      const kerb = Math.abs(this.gy[i] - this.gyPrev[i]) > 0.06 && !this.hole[i] && !this.holePrev[i];
      if (kerb) loss *= this.h.twoWheeler ? 0.93 : 0.965;
      if (this.hole[i] && !this.holePrev[i]) {
        loss *= this.h.twoWheeler ? 0.97 : 0.985; holes++;
        // Randomness from physics: the harder the hit, the likelier the tyre goes.
        if (this.flat < 0 && sp > 11 && Math.random() < (0.035 * (sp - 11)) / 8 / this.h.tyres) { this.flat = i; this.puncture = true; }
        if (this.wheelie > 0 && i >= 2) this.wheelieV += 1.5 + Math.random() * 1.5; // kicked up in a wheelie
      }
    }
    if (loss < 1) {
      // Velocity and speed together (a lone change to `speed` reads as a teleport next frame).
      this.vx *= loss; this.vz *= loss; this.speed *= loss; this.lastSpeed = this.speed;
      this.lastBump = 0.25;
      // Only potholes hurt the car (kerbs and rough patches just jolt it).
      if (holes && sp > 9) this.condition = Math.max(0, this.condition - 0.0006 * holes * sp * this.h.collisionDamage);
      this.bumped = true;
    }
  }

  /** Body, wheels and lamps as the physics left them. */
  draw(dt, input) {
    const h = this.h, m = this.model;
    this.lastBump = Math.max(0, this.lastBump - dt);
    const shake = Math.sin(this.lastBump * 40) * this.lastBump * 0.08;
    const rough = SURFACE[this.gs[0]].bump * Math.min(1, Math.abs(this.speed) / 8) * 0.012 * Math.sin(this.odometer * 9.1);
    let pitch = -this.pt + shake + rough, roll = this.rl, y = this.hz, z = 0;
    if (h.twoWheeler) {
      roll = -this.lean;
      pitch -= this.wheelie;
      const half = h.wheelBase / 2;
      y += half * Math.sin(this.wheelie); z = half * (Math.cos(this.wheelie) - 1);
    } else if (this.tip > 0) {
      roll += this.tip * this.tipSide;
      y += (h.tipTrack / 2) * Math.sin(this.tip);
    }
    if (this.fallen) { roll = this.fallen * (h.twoWheeler ? 1.42 : 1.5); pitch = 0; y = (h.width / 2) * 0.9; z = 0; }
    this.pitch = pitch; this.roll = roll;
    m.root.position.copy(this.pos);
    m.root.rotation.set(0, this.heading, 0);
    m.body.rotation.set(pitch, 0, roll);
    m.body.position.set(0, y, z);
    for (const w of m.wheels) w.rotation.x += (this.speed * dt) / m.wheelRadius;
    for (const s of m.steerers) s.rotation.y = this.steer;
    if (m.lights?.tailMat) m.lights.tailMat.emissiveIntensity = input.brake || (input.back && this.speed > 0.5) ? 2.5 : 0.15;
  }
}

/**
 * Direction from a blocked circle towards free space: probe 8 directions and average the
 * free ones. Falls back to `(bx, bz)` (e.g. against the motion) when everything is blocked.
 * Returns the module's scratch pair [nx, nz] (read it before the next call).
 */
export function freeDirection(world, x, z, r, bx, bz) {
  let nx = 0, nz = 0, free = 0;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2, cx = Math.cos(a), cz = Math.sin(a);
    if (!world.hits(x + cx * r * 0.7, z + cz * r * 0.7, r * 0.45)) { nx += cx; nz += cz; free++; }
  }
  if (!free || free === 8 || Math.hypot(nx, nz) < 1e-3) { nx = bx; nz = bz; }
  const l = Math.hypot(nx, nz) || 1;
  NRM[0] = nx / l; NRM[1] = nz / l;
  return NRM;
}
