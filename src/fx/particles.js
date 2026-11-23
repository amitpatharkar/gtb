// GPU particles: tyre smoke, dust, sparks. Each particle is written once (where, how fast, when,
// what kind) into a ring of instanced attributes; the graphics card moves, grows and fades every
// particle every frame from those starting values (TSL vertex code), so thousands cost the CPU
// nothing after they are spawned. Works the same on WebGPU and WebGL 2. The clock is game time,
// so particles freeze in the pause menu and slow down with the weapon wheel.
import * as THREE from 'three/webgpu';
import { attribute, uniform, vec3, float, uv, smoothstep, exp, mix, screenUV, perspectiveDepthToViewZ, positionView, cameraNear, cameraFar } from 'three/tsl';

const MAX = 4096;
// kind → [gravity (m/s²), drag (1/s), start size, end size, life (s), colour, opacity, additive]
const KINDS = {
  smoke: [-0.6, 1.6, 0.6, 3.2, 2.4, [0.62, 0.62, 0.6], 0.32, false],   // tyre smoke: drifts up, spreads
  dust: [2.5, 2.8, 0.25, 1.4, 1.1, [0.62, 0.56, 0.47], 0.45, false],   // bullet and landing dust
  debris: [9.8, 0.6, 0.06, 0.05, 1.2, [0.25, 0.23, 0.2], 0.9, false],  // chips that fall
  spark: [9.8, 0.8, 0.05, 0.02, 0.45, [6, 3.2, 1.2], 1, true],          // hot, bright: blooms
};
const clock = uniform(0); // game time in seconds (pauses and slows with the game)

function system(additive, sceneDepth) {
  const geo = new THREE.PlaneGeometry(1, 1);
  const a = (n) => new THREE.InstancedBufferAttribute(new Float32Array(MAX * n), n).setUsage(THREE.DynamicDrawUsage);
  const start = a(4), vel = a(4), look = a(4), colour = a(4);
  geo.setAttribute('pStart', start); geo.setAttribute('pVel', vel); geo.setAttribute('pLook', look); geo.setAttribute('pColour', colour);
  const S = attribute('pStart', 'vec4'), V = attribute('pVel', 'vec4'), L = attribute('pLook', 'vec4'), C = attribute('pColour', 'vec4');
  // pStart: xyz + birth time; pVel: xyz + life; pLook: gravity, drag, size0, size1; pColour: rgb + opacity
  const age = clock.sub(S.w), t = age.max(0), life = V.w, k = L.y;
  const alive = float(1).sub(smoothstep(life.mul(0.6), life, t)).mul(smoothstep(0, 0.05, t)).mul(t.lessThan(life).select(1, 0));
  const drift = V.xyz.mul(float(1).sub(exp(k.negate().mul(t))).div(k.max(0.001)));
  const pos = S.xyz.add(drift).sub(vec3(0, L.x.mul(t).mul(t).mul(0.5), 0));
  const m = new THREE.SpriteNodeMaterial({ transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
  m.positionNode = pos;
  m.scaleNode = mix(L.z, L.w, t.div(life).min(1)).mul(alive.greaterThan(0).select(1, 0));
  const r = uv().sub(0.5).length();
  m.colorNode = C.rgb;
  let opacity = C.a.mul(alive).mul(smoothstep(0.5, additive ? 0.1 : 0.2, r));
  // Drawn in their own pass (renderer.js fxScene): fade out where the scene is in front, softly
  // over the last 0.6 m so smoke meets the ground and walls without a hard line.
  if (sceneDepth) {
    const sceneZ = perspectiveDepthToViewZ(sceneDepth.sample(screenUV), cameraNear, cameraFar);
    opacity = opacity.mul(smoothstep(0, 0.6, positionView.z.sub(sceneZ)));
  }
  m.opacityNode = opacity;
  const mesh = new THREE.InstancedMesh(geo, m, MAX);
  mesh.frustumCulled = false;
  mesh.count = MAX;
  mesh.renderOrder = 10;
  return { mesh, start, vel, look, colour, next: 0, dirty: [] };
}

export class Particles {
  /** scene: renderer.js fxScene; sceneDepth: the main pass's depth (null on Low). */
  constructor(scene, sceneDepth) {
    this.normal = system(false, sceneDepth);
    this.add = system(true, sceneDepth);
    // Park every slot far away until used (dead: birth in the far future).
    for (const s of [this.normal, this.add]) { s.start.array.fill(0); for (let i = 0; i < MAX; i++) { s.start.array[i * 4 + 3] = 1e9; s.vel.array[i * 4 + 3] = 1; s.look.array[i * 4 + 1] = 1; } s.start.needsUpdate = true; s.vel.needsUpdate = true; s.look.needsUpdate = true; }
    scene.add(this.normal.mesh, this.add.mesh);
    this.clock = 0;
  }

  /** Spawn n particles of a kind at (x, y, z) with base velocity (vx, vy, vz) ± spread. */
  emit(kind, x, y, z, n = 1, vx = 0, vy = 0, vz = 0, spread = 1, now) {
    const K = KINDS[kind];
    const s = K[7] ? this.add : this.normal;
    const t = now ?? this.clock;
    for (let i = 0; i < n; i++) {
      const j = s.next; s.next = (s.next + 1) % MAX;
      const r = () => (Math.random() * 2 - 1) * spread;
      s.start.array.set([x + r() * 0.15, y + r() * 0.1, z + r() * 0.15, t + Math.random() * 0.03], j * 4);
      s.vel.array.set([vx + r(), vy + Math.abs(r()) * 0.6, vz + r(), K[4] * (0.7 + Math.random() * 0.6)], j * 4);
      s.look.array.set([K[0], K[1], K[2] * (0.8 + Math.random() * 0.4), K[3] * (0.8 + Math.random() * 0.4)], j * 4);
      const shade = 0.85 + Math.random() * 0.3;
      s.colour.array.set([K[5][0] * shade, K[5][1] * shade, K[5][2] * shade, K[6]], j * 4);
      s.dirty.push(j);
    }
  }

  /** Per frame: keep the shader clock and upload only the slots written this frame. */
  update(t) {
    this.clock = t; clock.value = t;
    for (const s of [this.normal, this.add]) {
      if (!s.dirty.length) continue;
      const lo = Math.min(...s.dirty), hi = Math.max(...s.dirty);
      for (const a of [s.start, s.vel, s.look, s.colour]) {
        a.clearUpdateRanges();
        if (hi - lo < MAX / 2) a.addUpdateRange(lo * 4, (hi - lo + 1) * 4);
        a.needsUpdate = true;
      }
      s.dirty.length = 0;
    }
  }

  // ---- effects
  impact(p, n, hard) {
    this.emit('dust', p.x + n.x * 0.05, p.y + n.y * 0.05, p.z + n.z * 0.05, 6, n.x * 1.5, n.y * 1.5 + 0.3, n.z * 1.5, 0.6);
    this.emit('debris', p.x, p.y, p.z, 5, n.x * 3, n.y * 3 + 1.5, n.z * 3, 1.5);
    if (hard) this.emit('spark', p.x, p.y, p.z, 10, n.x * 4, n.y * 4 + 1, n.z * 4, 3);
  }
  tyreSmoke(x, y, z, amount) { this.emit('smoke', x, y + 0.15, z, Math.ceil(amount * 2), 0, 0.3, 0, 0.6); }
  crash(x, y, z, strength) {
    this.emit('spark', x, y, z, Math.min(40, Math.round(strength * 3)), 0, 2, 0, 4);
    this.emit('dust', x, y - 0.3, z, Math.min(20, Math.round(strength * 1.5)), 0, 0.5, 0, 1.5);
  }
  puff(x, y, z, n = 8) { this.emit('dust', x, y + 0.05, z, n, 0, 0.3, 0, 1); }
}
