import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Birds. Two kinds of Mumbai sky life, in one instanced mesh (one draw call):
// - pigeon flocks at the places every Mumbaikar knows them from (the Gateway plaza, the
//   Dadar kabutarkhana, station forecourts, the seafront): they peck about on the ground and
//   take off in a whirl when the player, a honk or a cracker comes too close, circle and
//   land again;
// - black kites ("cheel") soaring in slow circles high above wherever the player is.
// Wings flap in the vertex shader (per-instance: x = flap amount, y = phase).

const SPOTS = [
  ['Gateway plaza', 18.9221, 72.8340, 46], ['Kabutarkhana, Dadar', 19.0178, 72.8437, 50], ['Chai Terminus forecourt', 18.9403, 72.8349, 30],
  ['Marine Drive', 18.9440, 72.8232, 26], ['Girgaum Chowpatty', 18.9548, 72.8125, 30], ['Flora Fountain', 18.9323, 72.8316, 24],
  ['Kabutarkhana, Bhuleshwar', 18.9525, 72.8290, 40], ['Shivaji Park', 19.0267, 72.8384, 26], ['Bandstand', 19.0447, 72.8198, 24],
  ['Juhu Beach', 19.0980, 72.8265, 30], ['Worli Sea Face', 19.0090, 72.8150, 24], ['Carter Road', 19.0650, 72.8228, 22], ['Powai Lake', 19.1241, 72.8977, 20],
];
const MAX = 150, KITES = 7;

function birdGeometry() {
  // Body along +z (beak forward), about 0.3 m long; wings are flat triangles at the shoulders.
  const body = new THREE.SphereGeometry(1, 6, 5).scale(0.06, 0.055, 0.14);
  const head = new THREE.SphereGeometry(0.04, 5, 4).translate(0, 0.045, 0.13);
  const tail = new THREE.ConeGeometry(0.045, 0.14, 4).rotateX(-Math.PI / 2).scale(1, 0.4, 1).translate(0, 0, -0.18);
  const wing = (s) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([s * 0.04, 0.02, 0.09, s * 0.04, 0.02, -0.1, s * 0.42, 0.02, -0.02, s * 0.04, 0.02, -0.1, s * 0.04, 0.02, 0.09, s * 0.42, 0.02, -0.02], 3)); // both faces
    g.computeVertexNormals();
    return g;
  };
  const parts = [body, head, tail].map((g) => { const n = g.toNonIndexed(); n.deleteAttribute('uv'); n.setAttribute('aWing', new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position.count), 1)); return n; });
  for (const s of [-1, 1]) { const w = wing(s); w.setAttribute('aWing', new THREE.Float32BufferAttribute(new Float32Array(6).fill(s), 1)); parts.push(w); }
  return mergeGeometries(parts);
}

export class Birds {
  /**
   * @param {THREE.Scene} scene
   * @param {object} tiles TileManager (index for coordinates, groundHeight, hits)
   * @param {object} [audio] for the flutter of a flock taking off
   */
  constructor(scene, tiles, audio) {
    this.tiles = tiles; this.audio = audio;
    const ix = tiles.index;
    this.spots = ix?.origin ? SPOTS.map(([name, lat, lon, n]) => ({ name, x: (lon - ix.origin.lon) * ix.metresPerDegree.lon, z: -(lat - ix.origin.lat) * ix.metresPerDegree.lat, n, birds: null, alarm: 0 })) : [];
    this.time = { value: 0 };
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = this.time;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aWing; attribute vec2 aFlap; uniform float uTime;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          if (aWing != 0.0) {
            // Folded against the body on the ground; beating (or held out, gliding) in the air.
            float beat = sin(uTime * (aFlap.x > 1.5 ? 2.2 : 17.0) + aFlap.y) * (aFlap.x > 1.5 ? 0.12 : 0.9);
            float ang = mix(-1.35, beat, min(aFlap.x, 1.0)) * aWing;
            float c = cos(ang), s = sin(ang);
            vec2 p = vec2(transformed.x - aWing * 0.04, transformed.y - 0.02);
            transformed.x = aWing * 0.04 + p.x * c - p.y * s;
            transformed.y = 0.02 + p.x * s + p.y * c;
          }`);
    };
    const geo = birdGeometry();
    this.flap = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 2), 2);
    this.flap.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aFlap', this.flap);
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    scene.add(this.mesh);
    this.kites = Array.from({ length: KITES }, (_, i) => ({ a: Math.random() * 6.28, r: 35 + Math.random() * 90, h: 55 + Math.random() * 70, cx: 0, cz: 0, w: (0.1 + Math.random() * 0.08) * (i % 2 ? 1 : -1), set: false }));
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.p = new THREE.Vector3(); this.s = new THREE.Vector3();
  }

  /** A loud noise or something fast at (x, z): flocks within `radius` take off. */
  scare(x, z, radius = 14) {
    for (const sp of this.spots) if (sp.birds && Math.hypot(sp.x - x, sp.z - z) < radius + 14) this.lift(sp);
  }

  lift(sp) {
    if (sp.alarm > 6) return;
    if (sp.alarm <= 0) this.audio?.flutter?.(Math.min(1, sp.n / 40));
    sp.alarm = 11 + Math.random() * 5;
    for (const b of sp.birds) if (b.state === 'ground') { b.state = 'up'; b.t = Math.random() * 0.6; b.ang = Math.atan2(b.x - sp.x, b.z - sp.z); b.rad = 4 + Math.random() * 9; b.h = 0; b.top = 7 + Math.random() * 12; b.w = (0.9 + Math.random() * 0.5) * (sp.dir || 1); }
  }

  /** Put a flock on the ground around its spot (on walkable ground, not inside buildings). */
  settle(sp) {
    sp.birds = []; sp.dir = Math.random() < 0.5 ? 1 : -1;
    for (let i = 0, tries = 0; i < sp.n && tries < sp.n * 6; tries++) {
      const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 9;
      const x = sp.x + Math.sin(a) * r, z = sp.z + Math.cos(a) * r;
      if (this.tiles.hits(x, z, 0.3)) continue;
      const grey = 0.32 + Math.random() * 0.3, white = Math.random() < 0.08;
      sp.birds.push({ x, z, y: this.tiles.groundHeight(x, z), gx: x, gz: z, heading: Math.random() * 6.28, state: 'ground', t: Math.random() * 3, phase: Math.random() * 6.28, col: white ? [0.9, 0.9, 0.88] : [grey * 0.92, grey * 0.96, grey * 1.05], s: 0.9 + Math.random() * 0.25 });
      i++;
    }
  }

  /**
   * @param {number} dt
   * @param {{pos: THREE.Vector3, speed?: number}} me the player's vehicle or walker
   * @param {number} daylight 0..1 (pigeons roost and kites go home at night)
   */
  update(dt, me, daylight = 1) {
    this.time.value += dt;
    const px = me.pos.x, pz = me.pos.z, fast = Math.abs(me.speed || 0) > 3;
    let n = 0;
    const put = (x, y, z, heading, pitch, roll, scale, flap, phase, col) => {
      if (n >= MAX) return;
      this.q.setFromEuler(this.e.set(pitch, heading, roll, 'YXZ'));
      this.m.compose(this.p.set(x, y, z), this.q, this.s.set(scale, scale, scale));
      this.mesh.setMatrixAt(n, this.m);
      this.flap.setXY(n, flap, phase);
      this.mesh.instanceColor.setXYZ(n, col[0], col[1], col[2]);
      n++;
    };
    for (const sp of this.spots) {
      const d = Math.hypot(sp.x - px, sp.z - pz);
      if (d > 170 || daylight < 0.12) { sp.birds = null; sp.alarm = 0; continue; }
      if (!sp.birds) { if (d < 150 && this.tiles.roadAt && this.tiles.groundHeight) this.settle(sp); if (!sp.birds) continue; }
      if (sp.alarm > 0) sp.alarm -= dt;
      for (const b of sp.birds) {
        b.t -= dt;
        if (b.state === 'ground') {
          // Peck, turn, take a step now and then; fly up when something comes close.
          const dp = Math.hypot(b.x - px, b.z - pz);
          if (dp < (fast ? 9 : 3.2)) { this.lift(sp); }
          if (b.t <= 0) { b.t = 0.6 + Math.random() * 2.8; b.heading += (Math.random() - 0.5) * 2.4; b.step = Math.random() < 0.6 ? 0.35 : 0; }
          if (b.step > 0) { const k = Math.min(b.step, dt * 0.5); b.step -= k; const nx = b.x + Math.sin(b.heading) * k, nz = b.z + Math.cos(b.heading) * k; if (!this.tiles.hits(nx, nz, 0.2) && Math.hypot(nx - sp.x, nz - sp.z) < 11) { b.x = nx; b.z = nz; } }
          const peck = Math.max(0, Math.sin(this.time.value * 5 + b.phase)) * 0.5;
          put(b.x, b.y + 0.07 * b.s, b.z, b.heading, peck, 0, b.s, 0, b.phase, b.col);
        } else {
          // In the air: spiral up around the spot, circle, then glide back down to where it stood.
          if (b.t > 0 && b.state === 'up') { put(b.x, b.y + 0.07, b.z, b.heading, 0, 0, b.s, 0, b.phase, b.col); continue; }
          b.ang += b.w * dt * (b.state === 'down' ? 0.7 : 1);
          if (b.state === 'up') { b.h = Math.min(b.top, b.h + dt * 5.5); b.rad += dt * 1.2; if (sp.alarm <= 0) b.state = 'down'; }
          else { b.h -= dt * 3.2; b.rad += (Math.hypot(b.gx - sp.x, b.gz - sp.z) - b.rad) * Math.min(1, dt * 0.8); }
          const tx = sp.x + Math.sin(b.ang) * b.rad, tz = sp.z + Math.cos(b.ang) * b.rad;
          const k = b.state === 'down' ? Math.max(0, 1 - b.h / 4) : 0; // close to the ground: home in on the old spot
          b.x = tx + (b.gx - tx) * k; b.z = tz + (b.gz - tz) * k;
          const heading = b.ang + (b.w > 0 ? Math.PI / 2 : -Math.PI / 2);
          if (b.state === 'down' && b.h <= 0) { b.state = 'ground'; b.x = b.gx; b.z = b.gz; b.t = 1; b.heading = heading; }
          put(b.x, b.y + 0.1 + Math.max(0, b.h), b.z, heading, b.state === 'up' && b.h < b.top ? -0.35 : 0.05, (b.w > 0 ? -1 : 1) * 0.35, b.s, 1, b.phase, b.col);
        }
      }
    }
    // Kites: wide slow circles drifting with the player, wings held out.
    if (daylight > 0.2) {
      for (const k of this.kites) {
        if (!k.set || Math.hypot(k.cx - px, k.cz - pz) > 260) { k.cx = px + (Math.random() - 0.5) * 240; k.cz = pz + (Math.random() - 0.5) * 240; k.set = true; }
        k.a += k.w * dt;
        put(k.cx + Math.sin(k.a) * k.r, k.h + Math.sin(k.a * 0.7) * 6, k.cz + Math.cos(k.a) * k.r, k.a + (k.w > 0 ? Math.PI / 2 : -Math.PI / 2), 0, (k.w > 0 ? -1 : 1) * 0.3, 2.3, 2, k.a, [0.16, 0.12, 0.09]);
      }
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
    this.flap.needsUpdate = true;
  }
}
