import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Ambient traffic, Rockstar style: a few dozen vehicles live only near the player,
// driving on the LEFT along the real road network, slowing behind each other and for
// the player. Density follows the clock (rush hours). One instanced mesh per type.

const LEFT = (fx, fz) => [fz, -fx]; // left-hand perpendicular of a heading (x east, z south)

function part(w, h, d, x, y, z, color) {
  const g = new THREE.BoxGeometry(w, h, d).translate(x, y, z).toNonIndexed();
  const c = new THREE.Color(color), arr = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < arr.length; i += 3) { arr[i] = c.r; arr[i + 1] = c.g; arr[i + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}
function wheels(xs, zs, r, color = 0x151515) {
  const out = [];
  for (const x of xs) for (const z of zs) {
    const g = new THREE.CylinderGeometry(r, r, 0.2, 10).rotateZ(Math.PI / 2).translate(x, r, z).toNonIndexed();
    const arr = new Float32Array(g.attributes.position.count * 3).fill(0.06);
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    out.push(g);
  }
  return out;
}
const merge = (parts) => mergeGeometries(parts);

// type → { geometry (body coloured white where tinted), lamps, length, width, speed, weight, tint palette }
function vehicleTypes() {
  const glass = 0x16191c, chrome = 0xb8b8b8;
  return {
    taxi: {
      geo: merge([part(1.47, 0.55, 3.7, 0, 0.55, 0, 0x0c0c0c), part(1.3, 0.5, 2.0, 0, 1.08, -0.2, 0xf7c600), part(1.32, 0.34, 1.9, 0, 1.06, -0.2, glass),
        part(1.5, 0.1, 0.1, 0, 0.36, 1.86, chrome), part(1.5, 0.1, 0.1, 0, 0.36, -1.86, chrome), ...wheels([-0.65, 0.65], [-1.17, 1.17], 0.28)]),
      len: 3.7, wid: 1.5, speed: 11, weight: 4, tints: [0xffffff],
    },
    hatch: {
      geo: merge([part(1.62, 0.7, 3.7, 0, 0.62, 0, 0xffffff), part(1.5, 0.62, 2.2, 0, 1.28, -0.15, 0xffffff), part(1.52, 0.42, 2.0, 0, 1.3, -0.15, glass),
        part(1.62, 0.2, 0.1, 0, 0.45, 1.86, 0x222222), ...wheels([-0.68, 0.68], [-1.2, 1.2], 0.3)]),
      len: 3.7, wid: 1.62, speed: 12, weight: 5, tints: [0xf2f2f2, 0xc0c4c8, 0x8a8f95, 0xb32020, 0x1d3f7a, 0x2b2b2b, 0x6b1f2a],
    },
    sedan: {
      geo: merge([part(1.75, 0.7, 4.5, 0, 0.62, 0, 0xffffff), part(1.6, 0.55, 2.4, 0, 1.24, -0.25, 0xffffff), part(1.62, 0.38, 2.2, 0, 1.25, -0.25, glass),
        ...wheels([-0.74, 0.74], [-1.45, 1.45], 0.31)]),
      len: 4.5, wid: 1.75, speed: 13, weight: 3, tints: [0xf5f5f5, 0x1b1b1b, 0x9aa0a6, 0x5a6a7a, 0xd9d4c7],
    },
    bus: {
      // BEST single-decker: red body, cream band, dark windows.
      geo: merge([part(2.55, 2.4, 11.5, 0, 1.75, 0, 0xc0281f), part(2.57, 0.9, 11.2, 0, 2.15, 0, glass), part(2.58, 0.18, 11.52, 0, 1.6, 0, 0xe9dfc4),
        part(2.4, 0.2, 11.4, 0, 3.0, 0, 0xb02218), ...wheels([-1.05, 1.05], [-3.6, 3.4], 0.5)]),
      len: 11.5, wid: 2.55, speed: 9, weight: 1.2, tints: [0xffffff],
    },
    tempo: {
      // Small goods carrier: cab and a tarpaulin-covered box.
      geo: merge([part(1.9, 1.35, 1.6, 0, 1.1, 1.9, 0xf2f2f2), part(1.92, 0.5, 1.2, 0, 1.45, 2.05, glass), part(2.0, 1.7, 3.4, 0, 1.45, -0.6, 0x3b5e8c),
        part(2.0, 0.3, 5.2, 0, 0.5, 0.3, 0x2a2a2a), ...wheels([-0.85, 0.85], [-1.6, 2.0], 0.38)]),
      len: 5.3, wid: 2.0, speed: 9, weight: 1, tints: [0xffffff, 0xe8e8e8],
    },
  };
}

export class Traffic {
  constructor(scene, tiles, tier) {
    this.scene = scene;
    this.tiles = tiles;
    this.max = tier.name === 'High' ? 56 : tier.name === 'Medium' ? 36 : 20;
    this.types = vehicleTypes();
    this.typeNames = Object.keys(this.types);
    this.totalWeight = this.typeNames.reduce((s, n) => s + this.types[n].weight, 0);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.15 });
    this.meshes = {};
    for (const name of this.typeNames) {
      const m = new THREE.InstancedMesh(this.types[name].geo, mat, this.max);
      m.count = 0;
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.max * 3).fill(1), 3);
      scene.add(m);
      this.meshes[name] = m;
    }
    this.cars = [];
    this.graphVersion = -1;
    this.matrix = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.honks = [];
  }

  /** Junction graph: segment ends that meet (0.5 m grid) across all loaded tiles. */
  rebuildGraph() {
    this.ends = new Map();
    this.segList = [];
    for (const t of this.tiles.tiles.values()) {
      const rd = t.collide.roads;
      for (let i = 0; i < rd.count; i++) {
        const s = this.tiles.segment(t, i);
        if (!(s[5] & 1)) continue;
        const seg = { t, i, s, len: Math.hypot(s[2] - s[0], s[3] - s[1]) };
        if (seg.len < 0.3) continue;
        this.segList.push(seg);
        for (const end of [0, 1]) {
          const k = `${Math.round(s[end * 2] * 2)},${Math.round(s[end * 2 + 1] * 2)}`;
          (this.ends.get(k) || this.ends.set(k, []).get(k)).push({ seg, end });
        }
      }
    }
    this.graphVersion = this.tiles.version;
  }

  pickType() {
    let r = Math.random() * this.totalWeight;
    for (const n of this.typeNames) { r -= this.types[n].weight; if (r <= 0) return n; }
    return 'hatch';
  }

  spawn(player) {
    for (let tries = 0; tries < 30; tries++) {
      const seg = this.segList[Math.floor(Math.random() * this.segList.length)];
      if (!seg) return;
      const s = seg.s;
      const mx = (s[0] + s[2]) / 2, mz = (s[1] + s[3]) / 2;
      const d = Math.hypot(mx - player.pos.x, mz - player.pos.z);
      if (d < 60 || d > 260) continue;
      const type = this.pickType();
      if (type === 'bus' && !(s[5] & 4)) continue; // buses stick to main roads
      const oneway = s[5] & 2;
      const dir = oneway || Math.random() < 0.5 ? 1 : -1;
      const tints = this.types[type].tints;
      const car = { type, seg, dir, t: Math.random(), speed: 0, tint: new THREE.Color(tints[Math.floor(Math.random() * tints.length)]), wait: 0, x: mx, z: mz, heading: 0 };
      if (this.cars.some((c) => Math.hypot(c.x - mx, c.z - mz) < 12)) continue;
      this.cars.push(car);
      return;
    }
  }

  /** Continue onto a connected segment at the end we are driving towards (prefer straight on). */
  advance(car) {
    const s = car.seg.s;
    const endIdx = car.dir > 0 ? 1 : 0;
    const k = `${Math.round(s[endIdx * 2] * 2)},${Math.round(s[endIdx * 2 + 1] * 2)}`;
    const fx = (s[2] - s[0]) * car.dir, fz = (s[3] - s[1]) * car.dir, fl = Math.hypot(fx, fz) || 1;
    const options = (this.ends.get(k) || []).filter((o) => o.seg !== car.seg).map((o) => {
      const dir = o.end === 0 ? 1 : -1;
      if (dir < 0 && (o.seg.s[5] & 2)) return null; // no wrong-way on one-way roads
      const ox = (o.seg.s[2] - o.seg.s[0]) * dir, oz = (o.seg.s[3] - o.seg.s[1]) * dir;
      const dot = (ox * fx + oz * fz) / (fl * (Math.hypot(ox, oz) || 1));
      return { o, dir, score: dot + Math.random() * 0.9 };
    }).filter(Boolean).sort((a, b) => b.score - a.score);
    if (!options.length) { car.dir *= -1; return; } // dead end: turn round
    car.seg = options[0].o.seg;
    car.dir = options[0].dir;
    car.t = 0;
  }

  update(dt, player, clock) {
    if (this.graphVersion !== this.tiles.version) {
      this.rebuildGraph();
      // Drop cars whose road tile was unloaded.
      this.cars = this.cars.filter((c) => this.tiles.tiles.has(`${c.seg.t.tx},${c.seg.t.tz}`));
    }
    const target = Math.round(this.max * clock.traffic);
    this.cars = this.cars.filter((c) => Math.hypot(c.x - player.pos.x, c.z - player.pos.z) < 320);
    if (this.cars.length < target && this.segList.length) this.spawn(player);
    if (this.cars.length > target + 4) this.cars.pop();

    const night = clock.night;
    for (const car of this.cars) {
      const s = car.seg.s;
      const type = this.types[car.type];
      const fx = ((s[2] - s[0]) / car.seg.len) * car.dir, fz = ((s[3] - s[1]) / car.seg.len) * car.dir;
      // Look ahead for other vehicles and the player in our lane.
      let gap = 40;
      const check = (x, z, len) => {
        const dx = x - car.x, dz = z - car.z;
        const along = dx * fx + dz * fz, lateral = Math.abs(dx * fz - dz * fx);
        if (along > 0 && lateral < 1.9) gap = Math.min(gap, along - (type.len + len) / 2);
      };
      for (const o of this.cars) if (o !== car) check(o.x, o.z, this.types[o.type].len);
      check(player.pos.x, player.pos.z, 3.7);
      const cruise = (s[5] & 4 ? type.speed : type.speed * 0.6) * (night > 0.5 ? 1.15 : 1);
      const want = gap < 2 ? 0 : Math.min(cruise, (gap - 2) * 0.8);
      car.speed += THREE.MathUtils.clamp(want - car.speed, -7 * dt, 2.5 * dt);
      car.wait = car.speed < 0.5 && gap < 6 ? car.wait + dt : 0;
      if (car.wait > 2.5) { this.honks.push([car.x, car.z]); car.wait = -4; }
      car.t += (car.speed * dt) / car.seg.len;
      while (car.t >= 1) { car.t -= 1; this.advance(car); }
      const s2 = car.seg.s;
      const t = car.dir > 0 ? car.t : 1 - car.t;
      const gx = ((s2[2] - s2[0]) / car.seg.len) * car.dir, gz = ((s2[3] - s2[1]) / car.seg.len) * car.dir;
      const [lx, lz] = LEFT(gx, gz);
      const two = !(s2[5] & 2);
      const lane = two ? Math.min(s2[4] * 0.5, 1.9) : 0;
      const px = s2[0] + (s2[2] - s2[0]) * t + lx * lane, pz = s2[1] + (s2[3] - s2[1]) * t + lz * lane;
      // Smooth position and heading through corners.
      const k = Math.min(1, dt * 8);
      car.x += (px - car.x) * k; car.z += (pz - car.z) * k;
      const h = Math.atan2(gx, gz);
      let dh = h - car.heading;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      car.heading += dh * Math.min(1, dt * 6);
    }

    // Write instances.
    const counts = {};
    for (const n of this.typeNames) counts[n] = 0;
    for (const car of this.cars) {
      const m = this.meshes[car.type], i = counts[car.type]++;
      this.q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, car.heading);
      this.matrix.compose(new THREE.Vector3(car.x, 0.02, car.z), this.q, new THREE.Vector3(1, 1, 1));
      m.setMatrixAt(i, this.matrix);
      m.setColorAt(i, car.tint);
    }
    for (const n of this.typeNames) {
      const m = this.meshes[n];
      m.count = counts[n];
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  /** Is a circle at (x, z) touching any traffic vehicle? */
  hits(x, z, r) {
    for (const car of this.cars) {
      const type = this.types[car.type];
      const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
      const dx = x - car.x, dz = z - car.z;
      const along = THREE.MathUtils.clamp(dx * fx + dz * fz, -type.len / 2 + type.wid / 2, type.len / 2 - type.wid / 2);
      const cx = car.x + fx * along, cz = car.z + fz * along;
      if ((x - cx) ** 2 + (z - cz) ** 2 < (r + type.wid / 2) ** 2) return true;
    }
    return false;
  }
}
