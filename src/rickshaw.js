import * as THREE from 'three';

// Placeholder auto-rickshaw built from primitives. Swap for a real model
// (glTF) later; the physics only cares about position/heading.
export function createRickshaw() {
  const root = new THREE.Group();
  const yellow = new THREE.MeshStandardMaterial({ color: 0xf5c400, roughness: 0.5 });
  const black = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.7 });
  const green = new THREE.MeshStandardMaterial({ color: 0x1f7a3a, roughness: 0.6 });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });

  const add = (geo, mat, x, y, z) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    root.add(mesh);
    return mesh;
  };

  add(new THREE.BoxGeometry(1.3, 0.5, 2.4), green, 0, 0.6, 0);           // lower body
  add(new THREE.BoxGeometry(1.35, 0.9, 1.4), black, 0, 1.3, -0.4);       // rear cabin
  add(new THREE.BoxGeometry(1.4, 0.12, 2.0), yellow, 0, 1.85, -0.2);     // canopy roof
  add(new THREE.BoxGeometry(1.0, 0.7, 0.1), black, 0, 1.3, 0.75);        // windscreen frame
  const nose = add(new THREE.BoxGeometry(0.6, 0.6, 0.4), green, 0, 0.7, 1.25);
  nose.scale.set(1, 1, 1);

  const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [
    add(wheelGeo, tyre, 0, 0.3, 1.1),     // front
    add(wheelGeo, tyre, -0.65, 0.3, -0.8),
    add(wheelGeo, tyre, 0.65, 0.3, -0.8),
  ];

  // Headlight
  const light = add(new THREE.SphereGeometry(0.1, 8, 8), new THREE.MeshBasicMaterial({ color: 0xfff6cc }), 0, 0.95, 1.46);
  light.castShadow = false;

  return { root, wheels };
}

// Simple arcade driving model.
export class Vehicle {
  constructor(mesh) {
    this.mesh = mesh;
    this.pos = new THREE.Vector3(0, 0, 0);
    this.heading = 0;   // radians, 0 = +Z
    this.speed = 0;     // metres per second
    this.radius = 1.0;   // collision circle; narrow Mumbai lanes need a snug fit
  }

  /** world.hits(x, z, radius) → true if that spot is blocked (buildings, sea, map edge). */
  update(dt, input, world) {
    const MAX = 18, REVERSE = -6, ACCEL = 9, BRAKE = 20, DRAG = 0.6;

    if (input.fwd) this.speed += ACCEL * dt;
    if (input.back) this.speed -= (this.speed > 0 ? BRAKE : ACCEL) * dt;
    if (input.brake) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), BRAKE * dt);
    if (!input.fwd && !input.back) this.speed -= this.speed * DRAG * dt;
    this.speed = THREE.MathUtils.clamp(this.speed, REVERSE, MAX);

    // Steering is stronger at low speed — autos turn on a coin.
    const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    const turnRate = 2.4 * (Math.min(Math.abs(this.speed), 6) / 6);
    this.heading += steer * turnRate * dt * Math.sign(this.speed || 1);

    const nx = this.pos.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.pos.z + Math.cos(this.heading) * this.speed * dt;

    // Resolve each axis separately so we slide along walls. If we are already
    // stuck inside something (e.g. a tile loaded around us), let the player drive out.
    const r = this.radius;
    const stuck = world.hits(this.pos.x, this.pos.z, r);
    if (stuck || !world.hits(nx, this.pos.z, r)) this.pos.x = nx;
    else this.speed *= -0.3;
    if (stuck || !world.hits(this.pos.x, nz, r)) this.pos.z = nz;
    else this.speed *= -0.3;

    this.mesh.root.position.copy(this.pos);
    this.mesh.root.rotation.y = this.heading;
    // Body lean into turns
    this.mesh.root.rotation.z = -steer * Math.min(Math.abs(this.speed) / MAX, 1) * 0.08;
    for (const w of this.mesh.wheels) w.rotation.x += (this.speed * dt) / 0.3;
    this.mesh.wheels[0].rotation.y = steer * 0.4;
  }
}
