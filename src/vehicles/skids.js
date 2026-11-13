import * as THREE from 'three';

// Tyre marks: dark strips laid behind the wheels while they slide (hard braking, sharp
// turns at speed). A ring buffer of quads; old marks are overwritten.

export class SkidMarks {
  constructor(scene, max = 1500) {
    this.max = max;
    this.n = 0;
    const pos = new Float32Array(max * 4 * 3), col = new Float32Array(max * 4 * 4), idx = new Uint32Array(max * 6);
    for (let i = 0; i < max; i++) idx.set([i * 4, i * 4 + 2, i * 4 + 1, i * 4 + 1, i * 4 + 2, i * 4 + 3], i * 6);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, depthWrite: false, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);
    this.last = new Map();
  }

  /** Feed one wheel position each frame; strength 0 lifts the "pen". */
  mark(id, x, y, z, strength, width = 0.17) {
    const prev = this.last.get(id);
    if (strength <= 0.02) { this.last.delete(id); return; }
    if (!prev) { this.last.set(id, { x, y, z }); return; }
    const dx = x - prev.x, dz = z - prev.z, l = Math.hypot(dx, dz);
    if (l < 0.25) return;
    if (l > 3) { this.last.set(id, { x, y, z }); return; }
    const nx = (-dz / l) * width / 2, nz = (dx / l) * width / 2;
    const i = this.n++ % this.max, p = this.mesh.geometry.attributes.position, c = this.mesh.geometry.attributes.color;
    const a = Math.min(0.75, strength * 0.75), pa = prev.a ?? a;
    p.setXYZ(i * 4, prev.x - nx, prev.y, prev.z - nz); p.setXYZ(i * 4 + 1, prev.x + nx, prev.y, prev.z + nz);
    p.setXYZ(i * 4 + 2, x - nx, y, z - nz); p.setXYZ(i * 4 + 3, x + nx, y, z + nz);
    for (let k = 0; k < 4; k++) c.setXYZW(i * 4 + k, 0.025, 0.025, 0.03, k < 2 ? pa : a);
    p.needsUpdate = true; c.needsUpdate = true;
    this.last.set(id, { x, y, z, a });
  }

  /** Marks for a car: rear wheels when sliding, all four under hard braking. */
  track(car, slip, braking, track = 1.24, wheelBase = 2.34) {
    const h = car.heading, fx = Math.sin(h), fz = Math.cos(h), rx = -fz, rz = fx;
    const y = car.pos.y + 0.012;
    const wheels = [[-track / 2, -wheelBase / 2], [track / 2, -wheelBase / 2], [-track / 2, wheelBase / 2], [track / 2, wheelBase / 2]];
    wheels.forEach(([wx, wz], k) => {
      const s = k < 2 ? slip : braking ? slip : 0;
      this.mark(k, car.pos.x + rx * wx + fx * wz, y, car.pos.z + rz * wx + fz * wz, s);
    });
  }
}
