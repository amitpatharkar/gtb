import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Street animals: stray dogs and humped (zebu) cows. Procedural, instanced, legs swung in
// the vertex shader like the people. Poses: walk, stand, lie down, run, sit.

export const APOSE = { WALK: 0, STAND: 1, LIE: 2, RUN: 3, SIT: 4 };

// Parts: 0 coat (instance colour), 1 dark (nose, hooves, eyes), 2 horn, 3 pale (belly, patches).
function piece(geo, part, limb, pivotZ = 0) {
  geo = geo.index ? geo.toNonIndexed() : geo;
  const n = geo.attributes.position.count;
  geo.setAttribute('part', new THREE.Float32BufferAttribute(new Float32Array(n).fill(part), 1));
  geo.setAttribute('limb', new THREE.Float32BufferAttribute(new Float32Array(n).fill(limb), 1));
  geo.setAttribute('pivotZ', new THREE.Float32BufferAttribute(new Float32Array(n).fill(pivotZ), 1));
  geo.deleteAttribute('uv');
  return geo;
}
const ell = (rx, ry, rz, x, y, z, seg = 10) => new THREE.SphereGeometry(1, seg, Math.max(6, seg - 3)).scale(rx, ry, rz).translate(x, y, z);
const leg = (r0, r1, len, x, top, z) => new THREE.CylinderGeometry(r0, r1, len, 6).translate(x, top - len / 2, z);

function dogGeometry() {
  const p = [];
  p.push(piece(ell(0.13, 0.13, 0.33, 0, 0.42, 0), 0, 0));                 // body
  p.push(piece(ell(0.1, 0.07, 0.25, 0, 0.35, 0.02), 3, 0));               // pale belly
  p.push(piece(ell(0.07, 0.07, 0.09, 0, 0.5, 0.3), 0, 0));                // neck
  p.push(piece(ell(0.08, 0.08, 0.1, 0, 0.58, 0.4), 0, 0));                // head
  p.push(piece(ell(0.045, 0.04, 0.08, 0, 0.55, 0.5), 3, 0));              // snout
  p.push(piece(ell(0.018, 0.016, 0.016, 0, 0.56, 0.575), 1, 0));          // nose
  for (const s of [-1, 1]) {
    p.push(piece(new THREE.ConeGeometry(0.03, 0.08, 4).translate(s * 0.05, 0.67, 0.37), 0, 0)); // ears
    p.push(piece(ell(0.012, 0.012, 0.01, s * 0.035, 0.61, 0.48), 1, 0));                       // eyes
  }
  p.push(piece(new THREE.CylinderGeometry(0.015, 0.025, 0.28, 5).rotateX(-0.9).translate(0, 0.55, -0.4), 0, 0)); // tail
  const legs = [[-0.07, 0.24, 1], [0.07, 0.24, 2], [-0.07, -0.24, 3], [0.07, -0.24, 4]];
  for (const [x, z, l] of legs) {
    p.push(piece(leg(0.03, 0.022, 0.36, x, 0.38, z), 0, l, z));
    p.push(piece(ell(0.025, 0.018, 0.035, x, 0.02, z + 0.015, 6), 3, l, z));
  }
  return mergeGeometries(p);
}

function cowGeometry() {
  const p = [];
  p.push(piece(ell(0.36, 0.38, 0.85, 0, 1.0, 0, 12), 0, 0));             // body
  p.push(piece(ell(0.2, 0.22, 0.25, 0, 1.38, 0.42, 10), 0, 0));           // zebu hump
  p.push(piece(ell(0.14, 0.32, 0.12, 0, 0.82, 0.7), 3, 0));               // dewlap
  p.push(piece(ell(0.15, 0.17, 0.28, 0, 1.18, 0.95), 0, 0));              // head
  p.push(piece(ell(0.11, 0.1, 0.12, 0, 1.08, 1.18), 3, 0));               // muzzle
  p.push(piece(ell(0.06, 0.04, 0.03, 0, 1.06, 1.29), 1, 0));              // nose
  for (const s of [-1, 1]) {
    p.push(piece(new THREE.ConeGeometry(0.035, 0.28, 6).rotateZ(-s * 0.5).translate(s * 0.15, 1.42, 0.85), 2, 0)); // horns
    p.push(piece(ell(0.09, 0.04, 0.05, s * 0.18, 1.27, 0.88), 0, 0));                                             // ears
    p.push(piece(ell(0.02, 0.02, 0.02, s * 0.11, 1.24, 1.08), 1, 0));                                             // eyes
  }
  p.push(piece(new THREE.CylinderGeometry(0.02, 0.03, 0.75, 5).rotateX(0.15).translate(0, 0.85, -0.86), 0, 0)); // tail
  p.push(piece(ell(0.04, 0.08, 0.04, 0, 0.47, -0.92), 1, 0));                                                   // tail tuft
  const legs = [[-0.2, 0.55, 1], [0.2, 0.55, 2], [-0.2, -0.55, 3], [0.2, -0.55, 4]];
  for (const [x, z, l] of legs) {
    p.push(piece(leg(0.075, 0.05, 0.78, x, 0.8, z), 0, l, z));
    p.push(piece(new THREE.CylinderGeometry(0.055, 0.06, 0.06, 6).translate(x, 0.03, z), 1, l, z));
  }
  return mergeGeometries(p);
}

const GLSL = `
  attribute float part;
  attribute float limb;
  attribute float pivotZ;
  attribute vec4 aAnim; // phase, pose, stride, hip height
  vec3 rotX(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c); }
  vec3 animate(vec3 p, bool isNormal) {
    float ph = aAnim.x, pose = aAnim.y, amp = aAnim.z, hip = aAnim.w;
    if (limb > 0.5) {
      // Diagonal pairs move together (trot): front-left with back-right.
      float pair = (limb == 1.0 || limb == 4.0) ? 1.0 : -1.0;
      float a = 0.0;
      if (pose < 0.5) a = sin(ph) * 0.45 * amp * pair;
      else if (pose > 2.5 && pose < 3.5) a = sin(ph) * 0.8 * amp * (limb < 2.5 ? 1.0 : -1.0); // gallop
      else if (pose > 1.5 && pose < 2.5) a = limb < 2.5 ? -1.45 : 1.45;                      // folded under
      else if (pose > 3.5) a = limb < 2.5 ? 0.0 : 1.3;                                       // sitting
      vec3 pivot = vec3(0.0, hip, pivotZ);
      p = isNormal ? rotX(p, a) : pivot + rotX(p - pivot, a);
    }
    if (!isNormal) {
      if (pose > 1.5 && pose < 2.5) p.y -= hip * 0.82;
      if (pose > 3.5) { p = vec3(p.x, (p.y - hip * 0.5) * 0.92 + hip * 0.12, p.z) ; p = rotX(p, -0.35) + vec3(0.0, hip * 0.25, 0.0); }
      if (pose < 0.5 || (pose > 2.5 && pose < 3.5)) p.y += abs(sin(ph)) * 0.02 * amp;
    }
    return p;
  }
`;

class Herd {
  constructor(scene, geo, max, hip) {
    this.max = max;
    this.hip = hip;
    this.anim = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aAnim', this.anim);
    const vert = (shader, colour) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${GLSL}${colour ? 'varying float vPart;' : ''}`)
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nobjectNormal = animate(objectNormal, true);')
        .replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed = animate(transformed, false);${colour ? 'vPart = part;' : ''}`);
    };
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
    mat.onBeforeCompile = (shader) => {
      vert(shader, true);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vPart;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          if (vPart > 0.5 && vPart < 1.5) diffuseColor.rgb = vec3(0.03, 0.025, 0.02);
          else if (vPart > 1.5 && vPart < 2.5) diffuseColor.rgb = vec3(0.55, 0.5, 0.42);
          else if (vPart > 2.5) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.75, 0.7, 0.62), 0.55);`);
    };
    mat.customProgramCacheKey = () => `gtb-animal-${hip}`;
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    depth.onBeforeCompile = (shader) => vert(shader, false);
    depth.customProgramCacheKey = () => `gtb-animal-depth-${hip}`;
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.customDepthMaterial = depth;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3).fill(1), 3);
    this.mesh.count = 0;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.n = 0;
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.p = new THREE.Vector3(); this.s = new THREE.Vector3();
  }
  begin() { this.n = 0; }
  add(a) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, a.heading);
    const sc = a.scale ?? 1;
    this.m.compose(this.p.set(a.x, a.y, a.z), this.q, this.s.set(sc, sc, sc));
    this.mesh.setMatrixAt(i, this.m);
    this.mesh.setColorAt(i, a.coat);
    this.anim.setXYZW(i, a.phase ?? 0, a.pose ?? 1, a.amp ?? 1, this.hip);
  }
  end() {
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
    this.anim.needsUpdate = true;
  }
}

export class Animals {
  constructor(scene) {
    this.dogs = new Herd(scene, dogGeometry(), 60, 0.38);
    this.cows = new Herd(scene, cowGeometry(), 12, 0.8);
  }
  begin() { this.dogs.begin(); this.cows.begin(); }
  end() { this.dogs.end(); this.cows.end(); }
}

const C = (h) => new THREE.Color(h);
export const DOG_COATS = [0xb07a3c, 0xc8955a, 0x3a2a20, 0xd9c7a8, 0x8a5a2e, 0x1e1a18, 0xa36b35].map(C);
export const COW_COATS = [0xe8e2d6, 0xd9cfbf, 0xb8a58c, 0x8a6a4a, 0xf1ede4].map(C);
