import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Light procedural people for crowds: one instanced mesh, ~500 triangles each, limbs
// swung in the vertex shader. Clothes and skin colours are per instance, plus up to six
// Holi colour patches per person (blotchy splats that move with the limbs), so a few
// hundred people cost one draw call.

export const POSE = { WALK: 0, STAND: 1, WAVE: 2, POINT: 3, ARGUE: 4, BAT: 5, SIT: 6, CROUCH: 7, FALLEN: 8, KICK: 9, PUSH: 10, PUNCH: 11, FIGHT: 12, THROW: 13, PEDAL: 14 };
export const FLAG = { CAP: 1, SARI: 2, BERET: 4 };

/** Holi colours (pichkari, gulal, tomatoes use index 6 = red). */
export const HOLI_HEX = [0xff2e88, 0x1fbf4f, 0xffd400, 0x1e7bff, 0xff7a00, 0x9b30ff, 0xd8141c, 0x19c6c0, 0xff4fd8, 0xd4a017, 0x7cff3a, 0xffffff];
export const HOLI_NAMES = ['Gulabi', 'Hara', 'Peela', 'Neela', 'Kesari', 'Jamuni', 'Laal', 'Firozi', 'Rani', 'Sunehri', 'Tota hara', 'Safed'];
export const HOLI = HOLI_HEX.map((h) => new THREE.Color(h));
const SPLATS = 6;

/**
 * Add a colour patch to a person (object with x, y, z, heading, scale) at a world-space hit
 * point. Patches live in the person's rest-pose space (packed into one float each).
 */
export function addPatch(person, wx, wy, wz, colour, radius = 0.12) {
  const sc = person.scale || 1, h = person.heading || 0;
  const dx = wx - person.x, dz = wz - person.z;
  let lx = (dx * Math.cos(h) - dz * Math.sin(h)) / sc, lz = (dx * Math.sin(h) + dz * Math.cos(h)) / sc;
  const ly = Math.max(0.05, Math.min(1.85, (wy - (person.y || 0)) / sc));
  // Pull the point onto the body surface (around the body axis).
  const d = Math.hypot(lx, lz), surf = ly > 1.45 ? 0.1 : ly > 0.85 ? 0.16 : 0.12;
  if (d > surf) { lx *= surf / d; lz *= surf / d; }
  const xi = Math.round(Math.max(0, Math.min(1, lx + 0.5)) * 127), yi = Math.round((ly / 2) * 255), zi = Math.round(Math.max(0, Math.min(1, lz + 0.5)) * 127);
  const packed = xi + yi * 128 + zi * 32768;
  const code = colour + Math.max(0.05, Math.min(0.24, radius)) * 2;
  (person.patches ||= []).push([packed, code]);
  if (person.patches.length > SPLATS) person.patches.shift();
}

function piece(geo, part, limb) {
  geo = geo.index ? geo.toNonIndexed() : geo;
  const n = geo.attributes.position.count;
  const pl = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { pl[i * 2] = part; pl[i * 2 + 1] = limb; }
  geo.setAttribute('partLimb', new THREE.Float32BufferAttribute(pl, 2)); // packed to save attribute slots
  geo.deleteAttribute('uv');
  return geo;
}
const cyl = (r0, r1, h, seg, x, y, z) => new THREE.CylinderGeometry(r1, r0, h, seg).translate(x, y + h / 2, z);

function personGeometry() {
  const parts = [];
  for (const s of [-1, 1]) {
    const leg = s < 0 ? 1 : 2, arm = s < 0 ? 3 : 4;
    parts.push(piece(cyl(0.062, 0.078, 0.8, 7, s * 0.09, 0.06, 0), 2, leg));
    parts.push(piece(new THREE.BoxGeometry(0.1, 0.07, 0.24).translate(s * 0.09, 0.035, 0.04), 4, leg));
    parts.push(piece(cyl(0.048, 0.055, 0.3, 6, s * 0.235, 1.08, 0), 1, arm));        // sleeve
    parts.push(piece(cyl(0.036, 0.044, 0.3, 6, s * 0.235, 0.8, 0), 0, arm));         // forearm
    parts.push(piece(new THREE.SphereGeometry(0.045, 6, 4).translate(s * 0.235, 0.78, 0), 0, arm)); // hand
  }
  parts.push(piece(cyl(0.15, 0.135, 0.12, 10, 0, 0.84, 0).scale(1, 1, 0.7), 2, 0));   // hips
  parts.push(piece(cyl(0.14, 0.175, 0.46, 10, 0, 0.94, 0).scale(1, 1, 0.66), 1, 0));  // torso
  parts.push(piece(new THREE.SphereGeometry(0.17, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.45, 0.66).translate(0, 1.39, 0), 1, 0)); // shoulders
  parts.push(piece(cyl(0.05, 0.05, 0.1, 6, 0, 1.42, 0), 0, 0));                       // neck
  parts.push(piece(new THREE.SphereGeometry(0.105, 12, 9).scale(0.95, 1.18, 1.05).translate(0, 1.6, 0.01), 0, 0)); // head
  parts.push(piece(new THREE.SphereGeometry(0.112, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.55).scale(0.98, 1.1, 1.08).translate(0, 1.62, -0.005), 3, 0)); // hair
  parts.push(piece(new THREE.CylinderGeometry(0.115, 0.118, 0.07, 12).translate(0, 1.75, 0), 5, 0)); // police cap
  parts.push(piece(new THREE.BoxGeometry(0.2, 0.012, 0.09).translate(0, 1.72, 0.13), 5, 0));         // cap visor
  parts.push(piece(new THREE.SphereGeometry(0.12, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.05, 0.5, 1.1).translate(0.015, 1.7, 0), 7, 0)); // beret
  parts.push(piece(cyl(0.3, 0.16, 0.78, 12, 0, 0.06, 0).scale(1, 1, 0.75), 6, 0));    // sari / long skirt
  return mergeGeometries(parts);
}

const ANIM_GLSL = `
  attribute vec2 partLimb;
  attribute vec4 aAnim;   // phase, pose, stride amplitude, flags
  vec3 rotX(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c); }
  vec3 rotZ(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x * c - p.y * s, p.x * s + p.y * c, p.z); }
  // Swing angles (about x, about z) for this vertex's limb.
  vec2 limbAngles(float limb) {
    float ph = aAnim.x, pose = aAnim.y, amp = aAnim.z;
    float side = (limb == 1.0 || limb == 3.0) ? -1.0 : 1.0;
    bool leg = limb > 0.5 && limb < 2.5, arm = limb > 2.5;
    float sw = sin(ph);
    if (pose < 0.5) return leg ? vec2(sw * 0.5 * amp * side, 0.0) : vec2(-sw * 0.38 * amp * side, side * 0.06);
    if (pose < 1.5) return arm ? vec2(sin(ph * 0.5) * 0.04, side * 0.07) : vec2(0.0);
    if (pose < 2.5) return limb == 4.0 ? vec2(-1.55, 0.25 + sin(ph * 2.2) * 0.45) : arm ? vec2(0.0, -0.07) : vec2(0.0);
    if (pose < 3.5) return limb == 4.0 ? vec2(-1.5, 0.15) : arm ? vec2(0.0, -0.07) : vec2(0.0);
    if (pose < 4.5) return arm ? vec2(-0.7 - 0.55 * max(0.0, sin(ph * 1.7 + side * 1.6)), side * 0.35) : vec2(0.0);
    if (pose < 5.5) return arm ? vec2(-0.9 + sin(ph) * 0.9, side < 0.0 ? 0.35 : -0.35) : vec2(0.0);
    if (pose < 6.5) return leg ? vec2(-1.45, side * 0.08) : arm ? vec2(-0.45, side * 0.1) : vec2(0.0);
    if (pose < 7.5) return leg ? vec2(-1.1, side * 0.25) : arm ? vec2(-0.9 + sin(ph) * 0.3, side * 0.2) : vec2(0.0);
    if (pose < 8.5) return arm ? vec2(-0.2, side * 0.6) : leg ? vec2(0.0, side * 0.12) : vec2(0.0);               // fallen (body rotated below)
    if (pose < 9.5) return limb == 2.0 ? vec2(-1.3, 0.0) : leg ? vec2(0.25, 0.0) : arm ? vec2(-0.6, side * 0.5) : vec2(0.0); // kick
    if (pose < 10.5) return arm ? vec2(-1.45, -side * 0.12) : leg ? vec2(side * 0.25, 0.0) : vec2(0.0);       // push
    if (pose < 11.5) return arm ? vec2((sw * side > 0.0) ? -1.55 : -0.85, -side * 0.15) : leg ? vec2(side * 0.18, 0.0) : vec2(0.0); // punches
    if (pose < 12.5) return arm ? vec2(-0.95 + sin(ph * 2.0 + side) * 0.12, -side * 0.2) : leg ? vec2(side * 0.22, 0.0) : vec2(0.0); // guard
    if (pose < 13.5) return limb == 4.0 ? vec2(-2.7 + max(0.0, sin(ph)) * 1.6, 0.1) : arm ? vec2(-0.3, -0.1) : vec2(0.0);     // throw
    return leg ? vec2(-0.52 + sw * 0.34 * side, side * 0.07) : vec2(-0.95, side * 0.1);                       // pedalling a bicycle
  }
  vec3 animate(vec3 p, bool isNormal) {
    float part = partLimb.x, limb = partLimb.y;
    float flags = aAnim.w;
    bool cap = mod(flags, 2.0) >= 1.0, sari = mod(floor(flags / 2.0), 2.0) >= 1.0, beret = mod(floor(flags / 4.0), 2.0) >= 1.0;
    if ((part == 5.0 && !cap) || (part == 6.0 && !sari) || (part == 7.0 && !beret) || (part == 3.0 && (cap || beret))) return vec3(0.0);
    float pose = aAnim.y;
    if (limb > 0.5) {
      vec2 a = limbAngles(limb);
      vec3 pivot = limb < 2.5 ? vec3(limb == 1.0 ? -0.09 : 0.09, 0.86, 0.0) : vec3(limb == 3.0 ? -0.235 : 0.235, 1.38, 0.0);
      if (isNormal) p = rotZ(rotX(p, a.x), a.y);
      else p = pivot + rotZ(rotX(p - pivot, a.x), a.y);
    }
    if (pose > 7.5 && pose < 8.5) {
      // Knocked down: lying on the back.
      p = rotX(p, -1.5);
      if (!isNormal) p += vec3(0.0, 0.14, 0.9);
    } else if (!isNormal) {
      if (pose > 5.5 && pose < 6.5) p.y -= 0.42;               // sitting on a stool, kerb or bike
      if (pose > 6.5 && pose < 7.5) p.y -= 0.3;                // crouching
      if (pose > 11.5 && pose < 12.5) p.y += abs(sin(aAnim.x * 2.0)) * 0.03; // bouncing in a fight
      if (pose < 0.5) p.y += abs(sin(aAnim.x)) * 0.03 * aAnim.z; // bob while walking
    }
    return p;
  }
`;

export class PeopleRenderer {
  constructor(scene, max = 400) {
    this.max = max;
    const geo = personGeometry();
    const dyn = (n) => new THREE.InstancedBufferAttribute(new Float32Array(max * n), n).setUsage(THREE.DynamicDrawUsage);
    this.anim = dyn(4); this.colA = dyn(3); this.colB = dyn(3); this.skin = dyn(3);
    this.splat = [dyn(4), dyn(4), dyn(4)]; // 6 patches: (packed position, colour code) × 2 per vec4
    geo.setAttribute('aAnim', this.anim);
    geo.setAttribute('aColA', this.colA);
    geo.setAttribute('aColB', this.colB);
    geo.setAttribute('aSkin', this.skin);
    this.splat.forEach((a, i) => geo.setAttribute(`aSplat${i}`, a));

    const vert = (shader, colour) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${ANIM_GLSL}${colour ? `attribute vec3 aColA; attribute vec3 aColB; attribute vec3 aSkin;
          attribute vec4 aSplat0; attribute vec4 aSplat1; attribute vec4 aSplat2;
          varying vec3 vTint; varying vec3 vRest; flat varying vec4 vS0; flat varying vec4 vS1; flat varying vec4 vS2;` : ''}`)
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nobjectNormal = animate(objectNormal, true);')
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n${colour ? 'vRest = position; vS0 = aSplat0; vS1 = aSplat1; vS2 = aSplat2;' : ''}\ntransformed = animate(transformed, false);${colour ? `
          float part = partLimb.x;
          vTint = part == 0.0 ? aSkin : part == 1.0 ? aColA : part == 2.0 ? aColB : part == 3.0 ? vec3(0.018, 0.014, 0.012)
            : part == 4.0 ? vec3(0.03, 0.022, 0.018) : part == 5.0 ? vec3(0.9, 0.9, 0.86) : part == 6.0 ? aColB : vec3(0.02, 0.03, 0.12);` : ''}`);
    };
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
    const holi = { value: HOLI.map((c) => c.clone()) };
    mat.onBeforeCompile = (shader) => {
      vert(shader, true);
      shader.uniforms.uHoli = holi;
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec3 vTint; varying vec3 vRest; flat varying vec4 vS0; flat varying vec4 vS1; flat varying vec4 vS2;
          uniform vec3 uHoli[12];
          float blotch(vec3 p) { return fract(sin(dot(floor(p * 22.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
          vec4 patchAt(float packed, float code) {
            if (code < 0.0) return vec4(0.0);
            float zi = floor(packed / 32768.0), rem = packed - zi * 32768.0, yi = floor(rem / 128.0), xi = rem - yi * 128.0;
            vec3 c = vec3(xi / 127.0 - 0.5, yi / 255.0 * 2.0, zi / 127.0 - 0.5);
            float ci = floor(code), r = (code - ci) * 0.5;
            float d = distance(vRest * vec3(1.0, 0.8, 1.0), c * vec3(1.0, 0.8, 1.0));
            float edge = r * (0.65 + 0.55 * blotch(vRest + c));
            float a = 1.0 - smoothstep(edge * 0.75, edge, d);
            return vec4(uHoli[int(ci)], a * 0.92);
          }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          diffuseColor.rgb *= vTint;
          vec4 sp;
          sp = patchAt(vS0.x, vS0.y); diffuseColor.rgb = mix(diffuseColor.rgb, sp.rgb, sp.a);
          sp = patchAt(vS0.z, vS0.w); diffuseColor.rgb = mix(diffuseColor.rgb, sp.rgb, sp.a);
          sp = patchAt(vS1.x, vS1.y); diffuseColor.rgb = mix(diffuseColor.rgb, sp.rgb, sp.a);
          sp = patchAt(vS1.z, vS1.w); diffuseColor.rgb = mix(diffuseColor.rgb, sp.rgb, sp.a);
          sp = patchAt(vS2.x, vS2.y); diffuseColor.rgb = mix(diffuseColor.rgb, sp.rgb, sp.a);
          sp = patchAt(vS2.z, vS2.w); diffuseColor.rgb = mix(diffuseColor.rgb, sp.rgb, sp.a);`);
    };
    mat.customProgramCacheKey = () => 'gtb-people-v2';
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    depth.onBeforeCompile = (shader) => vert(shader, false);
    depth.customProgramCacheKey = () => 'gtb-people-depth-v2';

    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.customDepthMaterial = depth;
    this.mesh.count = 0;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.n = 0;
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.p = new THREE.Vector3(); this.s = new THREE.Vector3();
  }

  begin() { this.n = 0; this.pending = []; }

  /** p: { x, y, z, heading, phase, pose, amp, flags, scale, shirt, pants, skin, patches } (colours as THREE.Color). */
  /** Hide people right in front of the lens or between the camera and the player. */
  occludes(p) {
    if (!this.cam || p.isPlayer) return false;
    const c = this.cam, f = this.focus;
    const px = p.x - c.x, py = (p.y || 0) + 1.2 - c.y, pz = p.z - c.z;
    if (px * px + py * py + pz * pz < 4) return true;
    if (!f) return false;
    const fx = f.x - c.x, fy = f.y + 1 - c.y, fz = f.z - c.z, ff = fx * fx + fy * fy + fz * fz || 1;
    const t = (px * fx + py * fy + pz * fz) / ff;
    if (t <= 0 || t >= 0.92) return false;
    const dx = px - fx * t, dy = py - fy * t, dz = pz - fz * t;
    return dx * dx + dy * dy + dz * dz < 1.0;
  }

  /** Queue a person for this frame (written in end(), after real characters pick theirs). */
  add(p) { (this.pending ||= []).push(p); }

  write(p) {
    if (this.n >= this.max || this.occludes(p)) return;
    const i = this.n++;
    this.q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, p.heading);
    const sc = p.scale ?? 1;
    this.m.compose(this.p.set(p.x, p.y, p.z), this.q, this.s.set(sc, sc, sc));
    this.mesh.setMatrixAt(i, this.m);
    this.anim.setXYZW(i, p.phase ?? 0, p.pose ?? 0, p.amp ?? 1, p.flags ?? 0);
    this.colA.setXYZ(i, p.shirt.r, p.shirt.g, p.shirt.b);
    this.colB.setXYZ(i, p.pants.r, p.pants.g, p.pants.b);
    this.skin.setXYZ(i, p.skin.r, p.skin.g, p.skin.b);
    const pt = p.patches;
    for (let k = 0; k < 3; k++) {
      const a = pt?.[k * 2], b = pt?.[k * 2 + 1];
      this.splat[k].setXYZW(i, a ? a[0] : 0, a ? a[1] : -1, b ? b[0] : 0, b ? b[1] : -1);
    }
  }

  end() {
    const list = this.pending || [];
    this.beforeEnd?.(list);   // real rigged characters take the nearest people (p.hero)
    for (const p of list) if (!p.hero) this.write(p);
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    for (const a of [this.anim, this.colA, this.colB, this.skin, ...this.splat]) a.needsUpdate = true;
  }
}

// Clothing palettes (linear colours) by kind of person.
const C = (hex) => new THREE.Color(hex);
export const SKIN = [0x8d5a3b, 0x7a4a2f, 0xa06a46, 0x6b3f26, 0xb07a52, 0x5e3720].map(C);
export const OUTFIT = {
  office: { shirt: [0xf2f2f0, 0xbcd3ea, 0xe8e2d0, 0x9fb4c8, 0xd9c9e8], pants: [0x2a2d33, 0x3b3f47, 0x4a4036, 0x1d2430] },
  casual: { shirt: [0xc0392b, 0x2e86c1, 0x27ae60, 0xf1c40f, 0x8e44ad, 0x34495e, 0xe67e22, 0xecf0f1, 0x16a085], pants: [0x2c3e50, 0x34495e, 0x5d4e3c, 0x1c1c1c, 0x4f5b66] },
  sari: { shirt: [0xb03a2e, 0xd35400, 0x7d3c98, 0x1f618d, 0x117a65, 0xd4ac0d, 0xc0392b], pants: [0xe74c3c, 0xf39c12, 0x9b59b6, 0x2980b9, 0x1abc9c, 0xf4d03f, 0xe91e63] },
  worker: { shirt: [0x7f8c8d, 0x95a5a6, 0xa04000, 0x566573], pants: [0x4d4d4d, 0x3e3a33, 0x5b5045] },
  trafficCop: { shirt: [0xf4f4f0], pants: [0x1f2a44] },
  police: { shirt: [0xb59a62], pants: [0xa88d58] },
  kid: { shirt: [0xffffff, 0xe74c3c, 0x3498db, 0x2ecc71], pants: [0x2c3e50, 0x7f8c8d, 0x1e3799] },
};
export function outfit(kind, rnd = Math.random) {
  const o = OUTFIT[kind] || OUTFIT.casual;
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  return { shirt: C(pick(o.shirt)), pants: C(pick(o.pants)), skin: pick(SKIN) };
}
