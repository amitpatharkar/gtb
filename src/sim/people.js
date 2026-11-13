import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Light procedural people for crowds: one instanced mesh, ~500 triangles each, limbs
// swung in the vertex shader (walk, stand, wave, point, argue, bat, sit). Clothes and
// skin colours are per instance, so a few hundred people cost one draw call.

export const POSE = { WALK: 0, STAND: 1, WAVE: 2, POINT: 3, ARGUE: 4, BAT: 5, SIT: 6, CROUCH: 7 };
export const FLAG = { CAP: 1, SARI: 2, BERET: 4 };

// Parts: 0 skin, 1 shirt, 2 trousers, 3 hair, 4 shoes, 5 cap, 6 sari, 7 beret.
// Limbs: 0 body, 1 left leg, 2 right leg, 3 left arm, 4 right arm.
function piece(geo, part, limb) {
  geo = geo.index ? geo.toNonIndexed() : geo;
  const n = geo.attributes.position.count;
  geo.setAttribute('part', new THREE.Float32BufferAttribute(new Float32Array(n).fill(part), 1));
  geo.setAttribute('limb', new THREE.Float32BufferAttribute(new Float32Array(n).fill(limb), 1));
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
  attribute float part;
  attribute float limb;
  attribute vec4 aAnim;   // phase, pose, stride amplitude, flags
  varying float vPart;
  vec3 rotX(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c); }
  vec3 rotZ(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x * c - p.y * s, p.x * s + p.y * c, p.z); }
  // Swing angles (about x, about z) for this vertex's limb.
  vec2 limbAngles() {
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
    return leg ? vec2(-1.1, side * 0.25) : arm ? vec2(-0.9 + sin(ph) * 0.3, side * 0.2) : vec2(0.0);
  }
  vec3 animate(vec3 p, bool isNormal) {
    float flags = aAnim.w;
    bool cap = mod(flags, 2.0) >= 1.0, sari = mod(floor(flags / 2.0), 2.0) >= 1.0, beret = mod(floor(flags / 4.0), 2.0) >= 1.0;
    if ((part == 5.0 && !cap) || (part == 6.0 && !sari) || (part == 7.0 && !beret) || (part == 3.0 && (cap || beret))) return vec3(0.0);
    float pose = aAnim.y;
    if (limb > 0.5) {
      vec2 a = limbAngles();
      vec3 pivot = limb < 2.5 ? vec3(limb == 1.0 ? -0.09 : 0.09, 0.86, 0.0) : vec3(limb == 3.0 ? -0.235 : 0.235, 1.38, 0.0);
      if (isNormal) p = rotZ(rotX(p, a.x), a.y);
      else p = pivot + rotZ(rotX(p - pivot, a.x), a.y);
    }
    if (!isNormal) {
      if (pose > 5.5 && pose < 6.5) p.y -= 0.42;               // sitting on a stool or kerb
      if (pose > 6.5) p.y -= 0.3 + (limb < 0.5 ? 0.0 : 0.0);   // crouching
      if (pose < 0.5) p.y += abs(sin(aAnim.x)) * 0.03 * aAnim.z; // bob while walking
    }
    return p;
  }
`;

export class PeopleRenderer {
  constructor(scene, max = 400) {
    this.max = max;
    const geo = personGeometry();
    this.anim = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
    this.colA = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.colB = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.skin = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    for (const a of [this.anim, this.colA, this.colB, this.skin]) a.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aAnim', this.anim);
    geo.setAttribute('aColA', this.colA);
    geo.setAttribute('aColB', this.colB);
    geo.setAttribute('aSkin', this.skin);

    const vert = (shader, colour) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${ANIM_GLSL}${colour ? 'attribute vec3 aColA; attribute vec3 aColB; attribute vec3 aSkin; varying vec3 vTint;' : ''}`)
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nobjectNormal = animate(objectNormal, true);')
        .replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed = animate(transformed, false);${colour ? `
          vTint = part == 0.0 ? aSkin : part == 1.0 ? aColA : part == 2.0 ? aColB : part == 3.0 ? vec3(0.018, 0.014, 0.012)
            : part == 4.0 ? vec3(0.03, 0.022, 0.018) : part == 5.0 ? vec3(0.9, 0.9, 0.86) : part == 6.0 ? aColB : vec3(0.02, 0.03, 0.12);` : ''}`);
    };
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
    mat.onBeforeCompile = (shader) => {
      vert(shader, true);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vTint;')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vTint;');
    };
    mat.customProgramCacheKey = () => 'gtb-people';
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    depth.onBeforeCompile = (shader) => vert(shader, false);
    depth.customProgramCacheKey = () => 'gtb-people-depth';

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

  begin() { this.n = 0; }

  /** p: { x, y, z, heading, phase, pose, amp, flags, scale, shirt, pants, skin } (colours as THREE.Color). */
  add(p) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, p.heading);
    const sc = p.scale ?? 1;
    this.m.compose(this.p.set(p.x, p.y, p.z), this.q, this.s.set(sc, sc, sc));
    this.mesh.setMatrixAt(i, this.m);
    this.anim.setXYZW(i, p.phase ?? 0, p.pose ?? 0, p.amp ?? 1, p.flags ?? 0);
    this.colA.setXYZ(i, p.shirt.r, p.shirt.g, p.shirt.b);
    this.colB.setXYZ(i, p.pants.r, p.pants.g, p.pants.b);
    this.skin.setXYZ(i, p.skin.r, p.skin.g, p.skin.b);
  }

  end() {
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    for (const a of [this.anim, this.colA, this.colB, this.skin]) a.needsUpdate = true;
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
