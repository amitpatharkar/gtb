// A drivable car: Rapier rigid-body chassis + raycast suspension (DynamicRayCastVehicleController).
// Real weight, a low centre of mass, per-wheel suspension, tyre grip that lets go under the
// handbrake, engine force that fades towards top speed, brakes, reverse, air drag and rolling
// resistance. Body roll, pitch, kerb bumps and slides come out of the physics, not animations.
import * as THREE from 'three/webgpu';
import { RAPIER, GROUP, groups, STEP } from '../core/physics.js';

/** Handling settings shared by all cars (scaled per car by its spec); edited live by the tuning panel. */
export const TUNE = {
  suspensionRest: 0.22, suspensionTravel: 0.18, stiffness: 32, compression: 3.2, relaxation: 3.6,
  frictionSlip: 2.1, sideStiffness: 1.0, rearGripHandbrake: 0.45,
  engine: 1.0, brake: 1.0, steerMax: 0.62, steerSpeed: 3.2, steerFade: 0.045,
  comHeight: 0.3, drag: 0.42, rolling: 0.015, maxSuspensionForce: 60000, antiRoll: 4, antiRollDamp: 0.7,
};
try { Object.assign(TUNE, JSON.parse(localStorage.getItem('gtb.tune') || '{}')); } catch { /* none saved */ }

const _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _f = new THREE.Vector3();

export class Vehicle {
  constructor(physics, model, x, y, z, heading) {
    this.physics = physics; this.model = model; this.spec = model.spec;
    const { world } = physics;
    const d = model.dims, mass = this.spec.mass;
    this.object = new THREE.Group();
    this.object.add(model.root);
    // Chassis: body origin = the car's ground-level centre in model space (so the model needs no offset).
    const desc = RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z).setRotation(yawQuat(heading))
      .setLinearDamping(0.05).setAngularDamping(0.6).setCcdEnabled(true).setCanSleep(true);
    this.body = world.createRigidBody(desc);
    const clear = Math.max(0.22, model.wheels[0].radius * 0.75);
    const lowerTop = d.y * 0.58, cabinTop = d.y * 0.96;
    const lower = RAPIER.ColliderDesc.cuboid(d.x * 0.47, (lowerTop - clear) / 2, d.z * 0.48)
      .setTranslation(0, (lowerTop + clear) / 2, 0)
      .setMassProperties(mass, { x: 0, y: TUNE.comHeight, z: 0 }, inertia(mass, d), { w: 1, x: 0, y: 0, z: 0 })
      .setFriction(0.45).setRestitution(0.1)
      .setCollisionGroups(groups(GROUP.VEHICLE)).setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS);
    const cabin = RAPIER.ColliderDesc.cuboid(d.x * 0.42, (cabinTop - lowerTop) / 2, d.z * 0.28)
      .setTranslation(0, (cabinTop + lowerTop) / 2, -d.z * 0.03).setDensity(0).setFriction(0.3)
      .setCollisionGroups(groups(GROUP.VEHICLE));
    this.colliders = [world.createCollider(lower, this.body), world.createCollider(cabin, this.body)];

    const vc = world.createVehicleController(this.body);
    vc.indexUpAxis = 1;
    vc.setIndexForwardAxis = 2;
    this.vc = vc;
    this.wheels = model.wheels;
    for (const w of this.wheels) {
      // Connection point so that, at rest under the car's weight, the wheel centre sits where the model has it.
      const sag = 9.81 / (4 * TUNE.stiffness);
      vc.addWheel({ x: w.centre.x, y: w.centre.y + TUNE.suspensionRest - sag, z: w.centre.z }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, TUNE.suspensionRest, w.radius);
    }
    this.applyTune();
    this.steer = 0; this.throttle = 0; this.brakeIn = 0; this.handbrake = 0;
    this.speed = 0; this.prevVel = new THREE.Vector3();
    this.crash = 0; this.driver = null; this.parked = true;
    this.flippedTime = 0;
    this.gear = 1;
  }

  applyTune() {
    const vc = this.vc;
    for (let i = 0; i < vc.numWheels(); i++) {
      vc.setWheelSuspensionRestLength(i, TUNE.suspensionRest);
      vc.setWheelMaxSuspensionTravel(i, TUNE.suspensionTravel);
      vc.setWheelSuspensionStiffness(i, TUNE.stiffness);
      vc.setWheelSuspensionCompression(i, TUNE.compression);
      vc.setWheelSuspensionRelaxation(i, TUNE.relaxation);
      vc.setWheelMaxSuspensionForce(i, TUNE.maxSuspensionForce);
      vc.setWheelFrictionSlip(i, TUNE.frictionSlip);
      vc.setWheelSideFrictionStiffness(i, TUNE.sideStiffness);
    }
  }

  get heading() {
    const r = this.body.rotation();
    _q.set(r.x, r.y, r.z, r.w);
    _f.set(0, 0, 1).applyQuaternion(_q);
    return Math.atan2(_f.x, _f.z);
  }

  /** Driver controls (null input = parked: handbrake on, nothing else). */
  control(input) {
    if (!input) { this.throttle = 0; this.brakeIn = 0; this.handbrake = 1; this.steerIn = 0; return; }
    this.throttle = input.throttle; this.brakeIn = input.brake; this.handbrake = input.down('handbrake') ? 1 : 0;
    this.steerIn = input.steer;
  }

  step() {
    const dt = STEP, vc = this.vc, spec = this.spec, mass = spec.mass;
    const v = this.body.linvel();
    const fwdSpeed = vc.currentVehicleSpeed();
    this.speed = fwdSpeed;
    const abs = Math.abs(fwdSpeed);
    if (this.driver || abs > 0.05 || !this.body.isSleeping()) {
      // Steering: slower and smaller at speed.
      const max = TUNE.steerMax / (1 + abs * TUNE.steerFade);
      const target = -(this.steerIn || 0) * max;
      this.steer += Math.max(-TUNE.steerSpeed * dt, Math.min(TUNE.steerSpeed * dt, target - this.steer));
      // Engine: full force at low speed, fading to zero at top speed. S brakes, then reverses.
      const driven = this.wheels.map((w) => (spec.drive === 'rear' ? !w.front : spec.drive === 'front' ? w.front : true));
      const nDriven = driven.filter(Boolean).length;
      let engine = 0, brake = 0;
      const F = mass * spec.accel * TUNE.engine;
      if (this.throttle > 0.02) {
        if (fwdSpeed < -0.5) brake = this.throttle;
        else engine = this.throttle * F * Math.max(0, 1 - (fwdSpeed / spec.top) ** 2);
      }
      if (this.brakeIn > 0.02) {
        if (fwdSpeed > 0.8) brake = Math.max(brake, this.brakeIn);
        else engine = -this.brakeIn * F * 0.5 * Math.max(0, 1 - (-fwdSpeed / 9) ** 2);
      }
      const brakeForce = brake * TUNE.brake * mass * 0.028; // ≈ 0.8 g on dry asphalt
      for (let i = 0; i < this.wheels.length; i++) {
        const w = this.wheels[i];
        vc.setWheelSteering(i, w.front ? this.steer : 0);
        vc.setWheelEngineForce(i, driven[i] ? engine / nDriven : 0);
        const hb = !w.front && this.handbrake ? mass * 0.05 : 0;
        vc.setWheelBrake(i, Math.max(brakeForce, hb, !this.driver ? mass * 0.02 : 0));
        vc.setWheelFrictionSlip(i, !w.front && this.handbrake && abs > 3 ? TUNE.frictionSlip * TUNE.rearGripHandbrake : TUNE.frictionSlip);
      }
      // Air drag and rolling resistance against the direction of travel.
      const sp = Math.hypot(v.x, v.y, v.z);
      this.body.resetForces(false);
      this.body.resetTorques(false);
      // Anti-roll bars: while the wheels are on the ground, a spring pulls the body's up axis
      // back towards vertical and damps roll and pitch. Real cars rarely tip in a turn; a big
      // crash or a ramp can still roll one (then F puts it back).
      let contacts = 0;
      for (let i = 0; i < this.wheels.length; i++) if (vc.wheelIsInContact(i)) contacts++;
      if (contacts >= 2) {
        const r = this.body.rotation(), w = this.body.angvel();
        _q.set(r.x, r.y, r.z, r.w);
        _f.set(0, 1, 0).applyQuaternion(_q); // body up
        const k = mass * TUNE.antiRoll, c = mass * TUNE.antiRollDamp;
        // cross(up, worldUp) = (-up.z, 0, up.x); damping on the horizontal part of the spin.
        this.body.addTorque({ x: -_f.z * k - w.x * c, y: 0, z: _f.x * k - w.z * c }, true);
      }
      if (sp > 0.1) {
        const drag = TUNE.drag * sp * sp + TUNE.rolling * mass * 9.81 * Math.min(1, sp);
        this.body.addForce({ x: (-v.x / sp) * drag, y: (-v.y / sp) * drag, z: (-v.z / sp) * drag }, true);
      }
    }
    vc.updateVehicle(dt, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, groups(GROUP.VEHICLE, GROUP.WORLD | GROUP.PROP | GROUP.VEHICLE), (c) => !this.colliders.includes(c));

    // Crash strength: sudden change of velocity this step (m/s).
    _v.set(v.x, v.y, v.z);
    const dv = _v.distanceTo(this.prevVel);
    this.crash = dv > 2.2 ? dv : 0;
    this.prevVel.copy(_v);
    // Gear for the speedometer (a 5-speed box).
    const kmh = abs * 3.6;
    this.gear = fwdSpeed < -0.5 ? -1 : kmh < 18 ? 1 : kmh < 36 ? 2 : kmh < 58 ? 3 : kmh < 82 ? 4 : 5;
    // Upside down?
    const r = this.body.rotation();
    _q.set(r.x, r.y, r.z, r.w);
    _f.set(0, 1, 0).applyQuaternion(_q);
    this.flippedTime = _f.y < 0.3 && abs < 2 ? this.flippedTime + dt : 0;
  }

  /** Put the car back on its wheels (after a roll-over). */
  rightUp() {
    const p = this.body.translation();
    this.body.setTranslation({ x: p.x, y: p.y + 1.2, z: p.z }, true);
    this.body.setRotation(yawQuat(this.heading), true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  /** Copy the physics pose to the model, wheels included (once per rendered frame). */
  sync() {
    const p = this.body.translation(), r = this.body.rotation();
    this.object.position.set(p.x, p.y, p.z);
    this.object.quaternion.set(r.x, r.y, r.z, r.w);
    const vc = this.vc;
    for (let i = 0; i < this.wheels.length; i++) {
      const w = this.wheels[i];
      if (!w.pivot) continue;
      const len = vc.wheelSuspensionLength(i), conn = vc.wheelChassisConnectionPointCs(i);
      if (len === null || !conn) continue;
      w.pivot.position.set(w.centre.x, conn.y - len, w.centre.z);
      w.pivot.rotation.set(vc.wheelRotation(i) || 0, vc.wheelSteering(i) || 0, 0, 'YXZ');
    }
  }

  /** World position of a point given in the car's model space. */
  toWorld(x, y, z, out = new THREE.Vector3()) {
    const p = this.body.translation(), r = this.body.rotation();
    _q.set(r.x, r.y, r.z, r.w);
    return out.set(x, y, z).applyQuaternion(_q).add(_v.set(p.x, p.y, p.z));
  }

  get position() { const p = this.body.translation(); return _v.set(p.x, p.y, p.z); }

  remove() {
    this.physics.world.removeVehicleController(this.vc);
    this.physics.world.removeRigidBody(this.body);
    this.object.removeFromParent();
  }
}

function yawQuat(h) { return { x: 0, y: Math.sin(h / 2), z: 0, w: Math.cos(h / 2) }; }
function inertia(m, d) {
  const x = d.x, y = d.y * 0.6, z = d.z;
  return { x: (m / 12) * (y * y + z * z), y: (m / 12) * (x * x + z * z), z: (m / 12) * (x * x + y * y) };
}
