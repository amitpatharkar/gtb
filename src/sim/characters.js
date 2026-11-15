import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { POSE, HOLI } from './people.js';
import { lookFor } from './looks.js';
import { SLOT, buildWardrobe } from './wardrobe.js';

// Real rigged, animated characters (Quaternius "Ultimate Animated Character Pack", CC0,
// converted from FBX in the asset pipeline) for the player and everyone near the camera;
// only people far away stay on the light procedural crowd (people.js).
//
// Each character is ONE skinned mesh and one draw call: the pack's per-material meshes are
// merged with every wearable piece from wardrobe.js (hair styles, moustaches and beards,
// bindis, spectacles, caps and helmets, sari, pallu, kurta, lungi, dupatta, school tie and
// bag, ID lanyard, cricket bat). All characters of a template share those vertex buffers;
// each one has its own index buffer listing only what that person wears (looks.js decides).
// A shader patch colours each part from per-character uniforms (skin, clothes, hair, the
// look's extra colours) with procedural checks, stripes and prints from the bind position.
//
// The pack is drawn with a child's proportions (legs 35 % of the height, a head a quarter of
// it). `rig()` reshapes every body into an adult: legs lengthened along the bone, a smaller
// head, a shorter torso, broader shoulders, longer arms, smaller hands and feet. Bones are
// scaled along and across their own axes, and each child bone cancels its parent's scale
// (`compensate`), so nothing shears when a knee or elbow bends. In this rig the feet are
// separate bones animated in root space (baked IK), so the clips are re-baked: pelvis
// height and foot positions are scaled by the same factor as the legs. On top of the adult
// base every person has a build (slim, average, heavy, muscular, stocky, lanky).
// Height and foot level are measured from the animated poses. There is no run clip:
// running is the walk cycle with a longer stride, faster cadence and a forward lean.
// Riding (scooter, motorbike, auto), pedalling, batting, crouching and arguing are the
// pack's clips with bones turned on top (feet re-attached to the shins where legs move).

// Ordered by priority: Low loads the first two of each, Medium four, High all.
const MODELS = {
  male: ['Casual_Male', 'Casual2_Male', 'Worker_Male', 'Casual3_Male', 'Casual_Bald', 'OldClassy_Male', 'Suit_Male', 'Chef_Male', 'Doctor_Male_Young'],
  female: ['Casual_Female', 'Casual2_Female', 'Casual3_Female', 'Worker_Female', 'OldClassy_Female', 'Suit_Female', 'Doctor_Female_Young'],
};
/** Which bodies suit a look's clothes (looks.js `template`), best first. */
const PREFER = {
  male: { casual: ['Casual_Male', 'Casual_Bald', 'Casual2_Male'], shirt: ['Casual2_Male', 'Casual_Male', 'OldClassy_Male'], vest: ['Casual3_Male', 'Casual_Male'], worker: ['Worker_Male', 'Casual2_Male', 'Casual_Male'], suit: ['Suit_Male', 'Casual2_Male'], blouse: ['Casual_Male'] },
  female: { casual: ['Casual_Female', 'Casual2_Female', 'Casual3_Female'], blouse: ['Casual_Female', 'Casual2_Female'], shirt: ['Casual2_Female', 'Casual_Female'], worker: ['Worker_Female', 'Casual_Female'], suit: ['Suit_Female', 'Casual2_Female'], vest: ['Casual3_Female', 'Casual_Female'] },
};
const CLIP = {
  idle: /^idle$/i, walk: /^walk$/i, run: /^run$/i, punch: /^punch$/i, hit: /recieve|receive/i,
  wave: /^victory$|wave/i, sit: /^sitdown$/i, aim: /shoot_onehanded/i, defeat: /^defeat$/i,
};
const LEG = 1.45;   // leg length factor (thigh and shin), also baked into the clips' pelvis and foot tracks
/**
 * Adult proportions as bone scales [across, along, depth]. Limb bones run along their local
 * Y; spine bones have X = width, Y = up, Z = depth. One number = uniform.
 */
const ADULT = {
  male: { upperleg: [1.02, LEG, 1.02], lowerleg: [0.98, LEG, 0.98], foot: 0.92, hips: [0.96, 1, 0.95], abdomen: [0.94, 0.9, 0.88], torso: [1.12, 0.9, 0.95], neck: [0.85, 1.15, 0.85], head: 0.56, shoulder: [1, 1.22, 1], upperarm: [0.9, 1.12, 0.9], lowerarm: [0.86, 1.12, 0.86], fist: 0.78 },
  female: { upperleg: [0.96, LEG, 0.96], lowerleg: [0.9, LEG, 0.9], foot: 0.84, hips: [1.02, 1, 0.98], abdomen: [0.88, 0.9, 0.85], torso: [0.98, 0.9, 0.92], neck: [0.78, 1.15, 0.78], head: 0.56, shoulder: [1, 1.04, 1], upperarm: [0.8, 1.1, 0.8], lowerarm: [0.78, 1.1, 0.78], fist: 0.72 },
};
/** Body builds: multipliers on top of the adult base (same keys), plus `height`. */
export const BUILDS = {
  average: {},
  slim: { hips: [0.92, 1, 0.9], abdomen: [0.88, 1, 0.84], torso: [0.92, 1, 0.9], upperleg: [0.88, 1, 0.88], lowerleg: [0.9, 1, 0.9], upperarm: [0.86, 1, 0.86], lowerarm: [0.88, 1, 0.88], neck: [0.9, 1, 0.9] },
  heavy: { hips: [1.2, 1, 1.3], abdomen: [1.32, 1, 1.58], torso: [1.14, 1, 1.26], upperleg: [1.24, 1, 1.24], lowerleg: [1.14, 1, 1.14], upperarm: [1.25, 1, 1.25], lowerarm: [1.14, 1, 1.14], neck: [1.3, 0.9, 1.3], head: 1.05 },
  muscular: { hips: [1.02, 1, 1.02], abdomen: [1.0, 1, 0.98], torso: [1.2, 1, 1.16], shoulder: [1, 1.1, 1], upperleg: [1.16, 1, 1.16], lowerleg: [1.1, 1, 1.1], upperarm: [1.38, 1, 1.38], lowerarm: [1.2, 1, 1.2], neck: [1.28, 1, 1.28] },
  stocky: { hips: [1.1, 1, 1.12], abdomen: [1.12, 1, 1.22], torso: [1.1, 1, 1.1], upperleg: [1.12, 1, 1.12], lowerleg: [1.08, 1, 1.08], upperarm: [1.12, 1, 1.12], lowerarm: [1.08, 1, 1.08], neck: [1.15, 0.92, 1.15], height: 0.95 },
  lanky: { hips: [0.92, 1, 0.9], abdomen: [0.9, 1, 0.86], torso: [0.94, 1, 0.9], upperleg: [0.86, 1, 0.86], lowerleg: [0.88, 1, 0.88], upperarm: [0.84, 1, 0.84], lowerarm: [0.86, 1, 0.86], height: 1.06 },
  fit: { torso: [1.06, 1, 1.03], upperarm: [1.12, 1, 1.12], abdomen: [0.97, 1, 0.95] },                 // the player
  kid: { head: 1.4, torso: [0.92, 1, 0.95], shoulder: [1, 0.9, 1], neck: [0.9, 0.85, 0.9] },            // children keep a bigger head
};
/** A build for a person, by who they are: [name, weight]. */
function pickBuild(p, L) {
  if (p.isPlayer) return 'fit';
  if (L.kid || p.kind === 'kid' || (p.scale ?? 1) < 0.85) return 'kid';
  const table = p.kind === 'jogger' ? [['slim', 5], ['average', 3], ['muscular', 2]]
    : p.kind === 'worker' || p.kind === 'driver' ? [['slim', 3], ['average', 4], ['muscular', 2], ['stocky', 2], ['heavy', 1]]
      : p.kind === 'office' ? [['average', 4], ['heavy', 3], ['slim', 2], ['stocky', 2], ['lanky', 1]]
        : L.female ? [['average', 4], ['slim', 3], ['heavy', 2], ['stocky', 2]]
          : [['average', 4], ['slim', 2.5], ['heavy', 2], ['stocky', 1.2], ['muscular', 1], ['lanky', 1]];
  let sum = 0;
  for (const [, w] of table) sum += w;
  let r = L.seed * 7.31 % 1 * sum;
  for (const [name, w] of table) { r -= w; if (r <= 0) return name; }
  return 'average';
}
const HEIGHT = { male: 1.73, female: 1.6 };
const BONE_KEY = (name) => (/^(upperleg|lowerleg|foot|hips|abdomen|torso|neck|head|shoulder|upperarm|lowerarm|fist)[^_]*$/i.exec(name)?.[1] || '').toLowerCase();
const vec = (v) => (typeof v === 'number' ? [v, v, v] : v || [1, 1, 1]);

/**
 * A child bone cancels its parent's (non-uniform) scale, keeping its own offset in the
 * parent's stretched space: the parent's part of the mesh stretches, the joint moves with
 * it, and everything below stays rigid — no shear when the joint bends.
 */
function compensate(bone) {
  bone.updateMatrix = function updateMatrix() {
    this.matrix.compose(this.position, this.quaternion, this.scale);
    const s = this.parent.scale;
    if (s.x !== 1 || s.y !== 1 || s.z !== 1) {
      const te = this.matrix.elements, ix = 1 / s.x, iy = 1 / s.y, iz = 1 / s.z;
      te[0] *= ix; te[4] *= ix; te[8] *= ix;
      te[1] *= iy; te[5] *= iy; te[9] *= iy;
      te[2] *= iz; te[6] *= iz; te[10] *= iz;
    }
    this.matrixWorldNeedsUpdate = true;
  };
}

/** Find the shaped bones of a body and make their children compensate. Returns Map(key → bones). */
function rig(root) {
  const parts = new Map();
  root.traverse((o) => {
    const k = o.isBone ? BONE_KEY(o.name) : '';
    if (!k) return;
    (parts.get(k) || parts.set(k, []).get(k)).push(o);
    for (const c of o.children) compensate(c);
  });
  return parts;
}

/** Set a body's bone scales: adult base × build. */
function shapeBody(parts, female, build) {
  const base = ADULT[female ? 'female' : 'male'], b = BUILDS[build] || BUILDS.average;
  for (const [k, bones] of parts) {
    const a = vec(base[k]), m = vec(b[k]);
    for (const bone of bones) bone.scale.set(a[0] * m[0], a[1] * m[1], a[2] * m[2]);
  }
}

/**
 * Re-bake a clip for longer legs: no scale keys (the body shape lives in the bone scales),
 * pelvis height and foot positions (root space, baked IK) scaled like the legs.
 */
function bake(clip, names, k) {
  const c = clip.clone();
  c.tracks = c.tracks.filter((t) => !t.name.endsWith('.scale'));
  const body = c.tracks.find((t) => t.name === `${names.body}.position`);
  const bodyZ = (time) => { if (!body) return 0; let i = 0; while (i < body.times.length - 1 && body.times[i + 1] <= time) i++; return body.values[i * 3 + 2]; };
  for (const t of c.tracks) {
    if (!names.feet.some((n) => t.name === `${n}.position`)) continue;
    for (let i = 0; i < t.times.length; i++) { const bz = bodyZ(t.times[i]); t.values[i * 3 + 1] *= k; t.values[i * 3 + 2] = bz + (t.values[i * 3 + 2] - bz) * k; }
  }
  if (body) for (let i = 0; i < body.times.length; i++) body.values[i * 3 + 1] *= k;
  return c;
}
const GUARD_AT = 0.3; // fraction of the punch clip held as the guard stance
// Limbs whose swing is amplified when running: [bone name pattern, extra factor at a full run].
const RUN_BONES = [[/^upperleg/i, 0.55], [/^lowerleg/i, 0.35], [/^upperarm/i, 0.7], [/^lowerarm/i, 0.5]];

/** The pack's materials → slot ('drop' = not used: its own hair and hats). */
const slotOf = (name) => {
  const n = (name || '').toLowerCase();
  if (/^(hair|hat|helmet)/.test(n)) return 'drop';
  return /^skin/.test(n) ? SLOT.skin : /^(shirt|clothes|main|top)/.test(n) ? SLOT.shirt : /^vest/.test(n) ? SLOT.vest
    : /^(pants|trousers|skirt|darkclothes)/.test(n) ? SLOT.pants : /^face/.test(n) ? SLOT.face : SLOT.other;
};

/**
 * Auto-smooth a non-indexed mesh: each vertex gets the average of the face normals around it
 * that are within `angle` of its own face (sharp creases stay sharp). The pack's characters
 * are flat-shaded, which is most of what makes them look low-poly.
 */
function autoSmooth(g, angle = 62) {
  const p = g.attributes.position, n = p.count, cos = Math.cos((angle * Math.PI) / 180);
  const fn = new Float32Array(n * 3), out = new Float32Array(n * 3);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < n; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    b.sub(a); c.sub(a); b.cross(c); // area-weighted face normal
    for (let k = 0; k < 3; k++) fn.set([b.x, b.y, b.z], (i + k) * 3);
  }
  const bins = new Map(), q = (v) => Math.round(v * 1e4);
  for (let i = 0; i < n; i++) {
    const key = `${q(p.getX(i))},${q(p.getY(i))},${q(p.getZ(i))}`;
    let l = bins.get(key); if (!l) bins.set(key, (l = [])); l.push(i);
  }
  for (const list of bins.values()) {
    for (const i of list) {
      const ix = fn[i * 3], iy = fn[i * 3 + 1], iz = fn[i * 3 + 2], il = Math.hypot(ix, iy, iz) || 1;
      let sx = 0, sy = 0, sz = 0;
      for (const j of list) {
        const jx = fn[j * 3], jy = fn[j * 3 + 1], jz = fn[j * 3 + 2], jl = Math.hypot(jx, jy, jz) || 1;
        if ((ix * jx + iy * jy + iz * jz) / (il * jl) >= cos) { sx += jx; sy += jy; sz += jz; }
      }
      const l = Math.hypot(sx, sy, sz) || 1;
      out[i * 3] = sx / l; out[i * 3 + 1] = sy / l; out[i * 3 + 2] = sz / l;
    }
  }
  g.setAttribute('normal', new THREE.BufferAttribute(out, 3));
}

/**
 * The pack's eyebrows slant down to the nose, so every face looked cross. Level each brow
 * (outer end a touch lower, raised a little): calm, friendly faces. Head-bone space.
 */
function calmBrows(g, skeleton, bindMatrix) {
  const hi = skeleton.bones.findIndex((b) => /^head$/i.test(b.name));
  if (hi < 0) return;
  const toHead = new THREE.Matrix4().multiplyMatrices(skeleton.boneInverses[hi], bindMatrix), back = toHead.clone().invert();
  const p = g.attributes.position, sl = g.attributes.aSlot, v = new THREE.Vector3();
  for (const side of [1, -1]) {
    const idx = [], pts = [];
    for (let i = 0; i < p.count; i++) {
      if (sl.getX(i) !== SLOT.face) continue;
      v.fromBufferAttribute(p, i).applyMatrix4(toHead);
      if (v.y > 0.49 && v.x * side > 0.05) { idx.push(i); pts.push(v.clone()); }
    }
    if (pts.length < 6) continue;
    let mx = 0, my = 0;
    for (const q of pts) { mx += Math.abs(q.x); my += q.y; }
    mx /= pts.length; my /= pts.length;
    let sxx = 0, sxy = 0;
    for (const q of pts) { const dx = Math.abs(q.x) - mx; sxx += dx * dx; sxy += dx * (q.y - my); }
    const da = Math.atan(-0.08) - Math.atan(sxy / (sxx || 1)), c = Math.cos(da), s = Math.sin(da);
    pts.forEach((q, k) => {
      const ax = Math.abs(q.x) - mx, ay = q.y - my;
      q.x = side * (mx + ax * c - ay * s); q.y = my + ax * s + ay * c + 0.015;
      q.applyMatrix4(back); p.setXYZ(idx[k], q.x, q.y, q.z);
    });
  }
}

/** Plain attribute types (Float32 weights, Uint16 joints), so templates and pieces merge. */
function plainSkin(g) {
  const si = g.attributes.skinIndex, sw = g.attributes.skinWeight, n = si.count;
  const I = new Uint16Array(n * 4), W = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) { I[i * 4 + k] = si.getComponent(i, k); W[i * 4 + k] = sw.getComponent(i, k); }
  g.setAttribute('skinIndex', new THREE.BufferAttribute(I, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(W, 4));
}

/**
 * One material per character: the same program, different part colours. uCol[slot] are the
 * slot colours (slot 0 uses the vertex colour); uPat[slot] = (pattern, period x, period y)
 * with uPatCol the second colour: 1 checks, 2 stripes, 3 small print, 4 diagonal stripes.
 */
const N_SLOT = 16;
function characterMaterial() {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.82, metalness: 0 });
  const u = {
    uCol: { value: Array.from({ length: N_SLOT }, () => new THREE.Color()) },
    uPatCol: { value: Array.from({ length: N_SLOT }, () => new THREE.Color()) },
    uPat: { value: Array.from({ length: N_SLOT }, () => new THREE.Vector3()) },
    uGloss: { value: 0 },
    uCuts: { value: new THREE.Vector4(9, 9, 9, 0) }, uLegCuts: { value: new THREE.Vector3(-9, -9, 9) },
  };
  m.userData.u = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aSlot; attribute vec3 aBase; flat varying float vSlot; varying vec3 vBase; varying vec3 vRest;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSlot = aSlot; vBase = aBase; vRest = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        flat varying float vSlot; varying vec3 vBase; varying vec3 vRest;
        uniform vec3 uCol[${N_SLOT}]; uniform vec3 uPatCol[${N_SLOT}]; uniform vec3 uPat[${N_SLOT}]; uniform float uGloss; uniform vec4 uCuts; uniform vec3 uLegCuts;
        // Woven and printed patterns from the bind-pose position; they fade to their average
        // colour once a repeat is smaller than a pixel or two (no shimmer at a distance).
        float pattern(vec3 pat, vec3 p) {
          if (pat.x < 0.5) return 0.0;
          vec2 q = vec2(p.x + p.z * 0.6, p.y) / pat.yz;
          vec2 w = fwidth(q) + 1e-4;
          float m, avg;
          if (pat.x < 1.5) { vec2 f = abs(fract(q) - 0.5); vec2 l = smoothstep(0.36 - w, 0.36 + w, f); vec2 l2 = 1.0 - smoothstep(vec2(0.0), vec2(0.03) + w, abs(f - 0.18)); m = max(max(l.x, l.y), 0.6 * max(l2.x, l2.y)); avg = 0.38; }
          else if (pat.x < 2.5) { float f = abs(fract(q.x) - 0.5); m = smoothstep(0.4 - w.x, 0.4 + w.x, f); avg = 0.2; }
          else if (pat.x < 3.5) { vec2 g = q * 2.0; g.x += floor(g.y) * 0.5; float d = length(fract(g) - 0.5); m = 1.0 - smoothstep(0.17 - 2.0 * w.x, 0.17 + 2.0 * w.x, d); avg = 0.09; w *= 2.0; }
          else { float f = abs(fract(q.x + q.y) - 0.5); m = smoothstep(0.32 - w.x - w.y, 0.32 + w.x + w.y, f); avg = 0.36; }
          return mix(m, avg, smoothstep(0.18, 0.4, max(w.x, w.y)));
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        int si = int(vSlot + 0.5);
        // Sleeves, knees and socks end on straight lines of the T-pose, not along triangles.
        if ((si == ${SLOT.skin} || si == ${SLOT.arm} || si == ${SLOT.forearm}) && vRest.y > uLegCuts.z && vRest.y < uCuts.w) {
          float ax = abs(vRest.x);
          if (ax > uCuts.x) si = ax < uCuts.y ? ${SLOT.arm} : ax < uCuts.z ? ${SLOT.forearm} : ${SLOT.skin};
        }
        if (si == ${SLOT.thigh} || si == ${SLOT.shin} || si == ${SLOT.sock}) si = vRest.y > uLegCuts.x ? ${SLOT.thigh} : vRest.y > uLegCuts.y ? ${SLOT.shin} : ${SLOT.sock};
        vec3 col = si == 0 ? vBase : uCol[si];
        if (si > 0) col = mix(col, uPatCol[si], pattern(uPat[si], vRest));
        diffuseColor.rgb = col;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        if (si == ${SLOT.hair}) roughnessFactor = mix(0.62, 0.32, uGloss);
        else if (si == ${SLOT.skin} || si == ${SLOT.arm} || si == ${SLOT.forearm}) roughnessFactor = 0.6;
        else if (si == ${SLOT.lens}) roughnessFactor = 0.08;
        else if (si == 0 && vBase.r > 0.7 && vBase.g > 0.3 && vBase.b < 0.2) roughnessFactor = 0.5;`);
  };
  m.customProgramCacheKey = () => 'gtb-character3';
  return m;
}

const tmp = new THREE.Color();
export class Characters {
  constructor(scene, base, tier, lib = null, started = Promise.resolve()) {
    this.scene = scene;
    this.poolSize = tier.name === 'High' ? 30 : tier.name === 'Medium' ? 20 : 11;
    this.radius = tier.name === 'Low' ? 34 : 46;
    this.templates = [];
    this.byName = new Map();
    this.pool = [];
    this.ready = false;
    this.timer = 0;
    this.frame = 0;
    this.want = []; this.chosen = []; this.dist = [];
    this.q = new THREE.Quaternion(); this.qp = new THREE.Quaternion(); this.qLean = new THREE.Quaternion(); this.axis = new THREE.Vector3();
    this.v = new THREE.Vector3(); this.m4 = new THREE.Matrix4();
    const loader = new GLTFLoader();
    const dir = `${base}media/models/character-quaternius-animated-pack/converted/`;
    // Only ask for models the asset manifest says were built (no 404s while they're missing).
    const files = new Set(lib?.assets?.get('character-quaternius-animated-pack')?.files || []);
    const per = tier.name === 'High' ? 9 : tier.name === 'Medium' ? 4 : 2;
    const names = [...MODELS.male.slice(0, per), ...MODELS.female.slice(0, per)].filter((n) => files.has(`models/character-quaternius-animated-pack/converted/${n}.glb`));
    if (!names.length) return;
    started.then(() => Promise.allSettled(names.map((n) => loader.loadAsync(`${dir}${n}.glb`).then((g) => ({ name: n, gltf: g, female: MODELS.female.includes(n) }))))
      .then(async (res) => {
        const ok = [];
        for (const r of res) {
          if (r.status !== 'fulfilled') continue;
          await new Promise((done) => setTimeout(done, 0)); // one template per task: no long frame
          try { this.prepare(r.value); ok.push(r.value); } catch (e) { console.warn(`Character ${r.value.name} skipped:`, e.message); }
        }
        this.setTemplates(ok);
      }));
  }

  setTemplates(ok) {
    this.templates = ok;
    for (const t of ok) this.byName.set(t.name, t);
    this.lists = { male: ok.filter((t) => !t.female), female: ok.filter((t) => t.female) };
    this.ready = ok.length > 0;
  }

  /** Merge the model into one mesh with its wardrobe, find its bones, and measure it in the animated poses. */
  prepare(t) {
    const scene = t.gltf.scene;
    scene.updateMatrixWorld(true);
    // --- one skinned mesh: merge the per-material meshes (they share a skeleton)
    const meshes = [];
    scene.traverse((o) => { if (o.isSkinnedMesh) meshes.push(o); });
    if (!meshes.length) throw new Error('no skinned mesh');
    const skeleton = meshes[0].skeleton;
    const body = [], belt = [];
    for (const m of meshes) {
      if (m.skeleton !== skeleton) throw new Error('several skeletons');
      const mat = [m.material].flat()[0], s = slotOf(mat.name);
      if (s === 'drop') continue;
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'skinIndex', 'skinWeight'].includes(k)) g.deleteAttribute(k);
      if (!g.attributes.normal) g.computeVertexNormals();
      plainSkin(g);
      const n = g.attributes.position.count, slot = new Float32Array(n), base = new Float32Array(n * 3);
      // The mesh's material → per-vertex slot and base colour.
      const c = mat.color || new THREE.Color(0.5, 0.5, 0.5);
      for (let i = 0; i < n; i++) { slot[i] = s; base[i * 3] = c.r; base[i * 3 + 1] = c.g; base[i * 3 + 2] = c.b; }
      g.setAttribute('aSlot', new THREE.BufferAttribute(slot, 1));
      g.setAttribute('aBase', new THREE.BufferAttribute(base, 3));
      g.morphAttributes = {};
      (/^belt/i.test(mat.name) ? belt : body).push(g);
    }
    const merged = mergeGeometries(body);
    if (!merged) throw new Error('merge failed');
    autoSmooth(merged);
    calmBrows(merged, skeleton, meshes[0].bindMatrix);
    // The pack's people wear shorts and no shoes. Bare skin on the legs and arms becomes its
    // own slots (thigh, shin, sock band at the ankle; upper arm, forearm), coloured by the
    // look: trousers, a salwar or a sari over the legs, shorts for children, sleeves.
    {
      const si = merged.attributes.skinIndex, sw = merged.attributes.skinWeight, sl = merged.attributes.aSlot, pos = merged.attributes.position;
      const kind = skeleton.bones.map((b) => (/^upperleg/i.test(b.name) ? 1 : /^lowerleg/i.test(b.name) ? 3 : /^(foot|toe)/i.test(b.name) ? 2 : /^upperarm/i.test(b.name) ? 4 : /^lowerarm/i.test(b.name) ? 5 : 0));
      const ank = skeleton.bones.find((b) => /^lowerlegl_end$/i.test(b.name)), knee = skeleton.bones.find((b) => /^lowerlegl$/i.test(b.name));
      const v = new THREE.Vector3(), ankleY = ank ? v.setFromMatrixPosition(ank.matrixWorld).y : 0.02, kneeY = knee ? new THREE.Vector3().setFromMatrixPosition(knee.matrixWorld).y : 0.55;
      const sockY = ankleY + (kneeY - ankleY) * 0.32;
      // Bind-pose (T-pose) planes the shader cuts sleeves, knees and socks along: clean edges.
      const bx = (re) => { const b = skeleton.bones.find((o) => re.test(o.name)); return b ? Math.abs(v.setFromMatrixPosition(b.matrixWorld).x) : 1; };
      const by = (re) => { const b = skeleton.bones.find((o) => re.test(o.name)); return b ? v.setFromMatrixPosition(b.matrixWorld).y : 0; };
      t.cuts = new THREE.Vector4(bx(/^upperarml$/i) + 0.05, bx(/^lowerarml$/i), bx(/^fistl$/i) - 0.04, by(/^head$/i) - 0.08);
      t.legCuts = new THREE.Vector3(kneeY - 0.03, sockY, by(/^upperarml$/i) - 0.4);
      const slotFor = (i) => {
        let best = 0, bw = -1;
        for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } }
        const s0 = sl.getX(i), kd = kind[best];
        if (kd === 2 && (s0 === SLOT.skin || s0 === SLOT.other)) return SLOT.shoe;
        if (s0 === SLOT.pants && kd === 3) return pos.getY(i) < sockY ? SLOT.sock : SLOT.shin; // long trousers below the knee
        if (s0 !== SLOT.skin) return s0;
        if (kd === 1) return SLOT.thigh;
        if (kd === 3) return pos.getY(i) < sockY ? SLOT.sock : SLOT.shin;
        if (kd === 4) return SLOT.arm;
        if (kd === 5) return SLOT.forearm;
        return s0;
      };
      // One slot per triangle (the most common of its corners): clean edges at cuffs and hems.
      for (let i = 0; i < sl.count; i += 3) {
        const a = slotFor(i), b = slotFor(i + 1), c = slotFor(i + 2);
        const s = a === b || a === c ? a : b === c ? b : sl.getX(i) === SLOT.skin ? SLOT.skin : a;
        sl.setX(i, s); sl.setX(i + 1, s); sl.setX(i + 2, s);
      }
    }
    const beltGeo = belt.length ? mergeGeometries(belt) : null;
    const baseGeo = beltGeo ? mergeGeometries([merged, beltGeo]) : merged;
    const mesh = new THREE.SkinnedMesh(baseGeo, new THREE.MeshStandardMaterial());
    mesh.name = 'body';
    meshes[0].parent.add(mesh);
    mesh.position.copy(meshes[0].position); mesh.quaternion.copy(meshes[0].quaternion); mesh.scale.copy(meshes[0].scale);
    mesh.updateMatrixWorld(true);
    mesh.bind(skeleton, meshes[0].bindMatrix);
    for (const m of meshes) m.parent.remove(m);
    mesh.frustumCulled = false;
    t.mesh = mesh;

    // --- adult body shape; the wardrobe is modelled on it in the rest pose
    t.parts = rig(scene);
    shapeBody(t.parts, t.female, 'average');
    scene.updateMatrixWorld(true);
    const pieces = buildWardrobe(mesh, t.female);
    const order = Object.keys(pieces);
    const full = mergeGeometries([baseGeo, ...order.map((k) => pieces[k])]);
    if (!full) throw new Error('wardrobe merge failed');
    t.ranges = { body: [0, merged.attributes.position.count] };
    if (beltGeo) t.ranges.belt = [merged.attributes.position.count, beltGeo.attributes.position.count];
    let at = baseGeo.attributes.position.count;
    for (const k of order) { const n = pieces[k].attributes.position.count; t.ranges[k] = [at, n]; at += n; }
    t.full = full;
    t.vertices = at;

    const hips = skeleton.bones.find((b) => /^hips$/i.test(b.name));
    let bodyBone = null; const feet = [];
    scene.traverse((o) => { if (/^body(_\d+)?$/i.test(o.name) && !o.isMesh && o.children.some((c) => /^hips$/i.test(c.name))) bodyBone = o; if (/^foot[^_]*$/i.test(o.name)) feet.push(o.name); });
    const names = { body: bodyBone?.name, feet };
    t.clips = {};
    for (const [k, re] of Object.entries(CLIP)) { const clip = t.gltf.animations.find((a) => re.test(a.name)); t.clips[k] = clip ? bake(clip, names, LEG) : null; }
    t.clips.idle ||= bake(t.gltf.animations[0], names, LEG);

    // --- measure in the animated poses (the bind pose is a T-pose and the clips move the hips)
    const mixer = new THREE.AnimationMixer(scene);
    const box = new THREE.Box3(), v = new THREE.Vector3();
    const pose = (clip, time) => {
      mixer.stopAllAction();
      const a = mixer.clipAction(clip); a.reset().play(); mixer.setTime(time);
      scene.updateMatrixWorld(true);
      mesh.computeBoundingBox();
      box.copy(mesh.boundingBox).applyMatrix4(mesh.matrixWorld);
      return [box.min.y, box.max.y];
    };
    const [i0, i1] = pose(t.clips.idle, 0.01);
    // Standing-pose rotations of the limbs: the reference the run stride is amplified around.
    t.ref = new Map();
    for (const b of skeleton.bones) if (RUN_BONES.some(([re]) => re.test(b.name))) t.ref.set(b.name, b.quaternion.clone());
    let walkMin = i0;
    if (t.clips.walk) { walkMin = Infinity; for (let k = 0; k < 8; k++) walkMin = Math.min(walkMin, pose(t.clips.walk, (t.clips.walk.duration * k) / 8)[0]); }
    let sitHip = 0.5, sitMin = i0;
    if (t.clips.sit && hips) { [sitMin] = pose(t.clips.sit, t.clips.sit.duration - 0.01); sitHip = hips.getWorldPosition(v).y - sitMin; }
    mixer.stopAllAction(); mixer.uncacheRoot(scene);
    mesh.geometry = full; // clones share it until make() gives each its own index
    t.scale = HEIGHT[t.female ? 'female' : 'male'] / (i1 - i0 || 1);
    t.liftIdle = -i0 * t.scale;
    t.liftWalk = -walkMin * t.scale;
    t.sitLift = -sitMin * t.scale;
    t.sitHip = sitHip * t.scale; // hips above the feet when seated
    // Ground covered by one walk cycle (from the feet's fore-aft travel): the speed the clip suits.
    t.walkSpeed = 1.3;
    const ft = t.clips.walk?.tracks.find((tr) => feet.some((n) => tr.name === `${n}.position`));
    if (ft) { let lo = Infinity, hi = -Infinity; for (let i = 2; i < ft.values.length; i += 3) { lo = Math.min(lo, ft.values[i]); hi = Math.max(hi, ft.values[i]); } t.walkSpeed = Math.max(0.6, (2 * (hi - lo) * t.scale) / t.clips.walk.duration); }
    t.debug = { i0, i1, walkMin, sitMin, sitHip, walkSpeed: t.walkSpeed, body: names.body || 'none', feet: feet.length, vertices: t.vertices, pieces: order.length };
  }

  make(t) {
    const root = cloneSkinned(t.gltf.scene);
    let mesh = null;
    const bones = new Map();
    root.traverse((o) => { if (o.isSkinnedMesh) mesh = o; if (o.isBone) bones.set(o.name, o); });
    // Own index buffer over the template's shared vertex buffers: what this person wears.
    const geo = new THREE.BufferGeometry();
    for (const [k, a] of Object.entries(t.full.attributes)) geo.setAttribute(k, a);
    const index = new THREE.BufferAttribute(t.vertices > 65535 ? new Uint32Array(t.vertices) : new Uint16Array(t.vertices), 1);
    index.setUsage(THREE.DynamicDrawUsage);
    geo.setIndex(index);
    geo.setDrawRange(0, 0);
    mesh.geometry = geo;
    mesh.material = characterMaterial();
    mesh.material.userData.u.uCuts.value.copy(t.cuts); mesh.material.userData.u.uLegCuts.value.copy(t.legCuts);
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
    const holder = new THREE.Group();
    holder.add(root);
    holder.visible = false;
    this.scene.add(holder);
    const mixer = new THREE.AnimationMixer(root);
    const actions = {};
    for (const [k, clip] of Object.entries(t.clips)) if (clip) actions[k] = mixer.clipAction(clip);
    for (const k of ['sit', 'defeat']) if (actions[k]) { actions[k].setLoop(THREE.LoopOnce, 1); actions[k].clampWhenFinished = true; }
    const find = (re) => { for (const [n, b] of bones) if (re.test(n)) return b; return null; };
    const run = [];
    for (const [n, b] of bones) { const r = RUN_BONES.find(([re]) => re.test(n)); if (r && t.ref.has(n)) run.push([b, t.ref.get(n), r[1]]); }
    const parts = rig(root);
    shapeBody(parts, t.female, 'average');
    const limb = (side) => ({ thigh: find(new RegExp(`^upperleg\\.?${side}$`, 'i')), shin: find(new RegExp(`^lowerleg\\.?${side}$`, 'i')), end: find(new RegExp(`^lowerleg\\.?${side}_end$`, 'i')), foot: find(new RegExp(`^foot\\.?${side}$`, 'i')), arm: find(new RegExp(`^upperarm\\.?${side}$`, 'i')), fore: find(new RegExp(`^lowerarm\\.?${side}$`, 'i')) });
    return {
      t, holder, root, mesh, geo, index, mixer, actions, parts, build: 'average', u: mesh.material.userData.u,
      head: find(/^head$/i), spine: find(/^abdomen$/i) || find(/^torso$/i), chest: find(/^torso$/i), hand: find(/^fist\.?r$|^hand\.?r$|righthand/i), legR: find(/^upperleg\.?r$/i),
      L: limb('L'), R: limb('R'), run, lift: t.liftIdle, current: null, who: null, keep: false, adds: [], dressKey: '', look: null,
      patchN: -1, shirtHex: -1,
    };
  }

  play(c, name) {
    const a = c.actions[name] || c.actions.idle;
    if (!a || c.current === a) return;
    // A freshly assigned body starts at full weight (a fade-in from zero shows the bind pose).
    if (c.current) { a.reset().fadeIn(0.18).play(); c.current.fadeOut(0.18); } else a.reset().setEffectiveWeight(1).play();
    if (name === 'sit') a.time = Math.max(0, a.getClip().duration - 0.02); // already seated
    c.current = a;
  }

  /** The pieces a look wears on this template, as ranges into the shared vertex buffer. */
  wearList(c, L, p) {
    const R = c.t.ranges, out = [R.body];
    const add = (k) => { if (R[k]) out.push(R[k]); };
    if (L.belt) add('belt');
    const hatOn = !!L.hat || (p.flags & 1) || (p.flags & 4);
    const hair = L.hair;
    const female = c.t.female;
    // Hair: under a hat only the band round the sides and back shows.
    if (hatOn && hair !== 'bald') add(R['hair:bald'] ? 'hair:bald' : 'hair:crop');
    else if (hair === 'long') { add('hair:long'); add('hairx:long'); }
    else if (hair === 'bun' || hair === 'plait' || hair === 'twoPlaits') add('hair:back');
    else if (hair === 'pony') add('hair:pony');
    else add(`hair:${R[`hair:${hair}`] ? hair : female ? 'back' : 'short'}`);
    if (hair === 'bun' && !(hatOn && L.hat === 'helmet')) add(L.flowers ? 'hairx:bunFlowers' : 'hairx:bun');
    if (hair === 'plait') add(L.flowers ? 'hairx:plaitFlowers' : 'hairx:plait');
    if (hair === 'twoPlaits') add('hairx:twoPlaits');
    if (hair === 'pony' && !hatOn) add('hairx:pony');
    if (hatOn && hair === 'long') add('hairx:long');
    if (L.moustache) add('moustache');
    if (L.beard) add(L.beard === 2 ? 'beard2' : 'beard1');
    if (L.bindi) add('bindi');
    if (L.glasses) add(L.glasses === 2 ? 'shades' : 'glasses');
    const hat = p.flags & 1 ? 'police' : L.hat || (p.flags & 4 ? 'turban' : '');
    if (hat) add(`hat:${hat}`);
    if (L.garment && L.garment !== 'nauvari') add(L.garment);
    if (L.garment === 'nauvari') add('nauvari');
    if (L.pallu) add('pallu');
    if (L.dupatta) add('dupatta');
    if (L.lanyard) add('lanyard');
    if (L.tie) add('tie');
    if (L.bag) add('bag');
    if (p.pose === POSE.BAT) add('bat');
    return out;
  }

  /** Colours, pieces and build for this person (only when the person or their clothes change). */
  dress(c, p) {
    const n = p.patches?.length || 0, hex = p.shirt.getHex();
    const bat = p.pose === POSE.BAT, L = p.look || lookFor(p);
    if (c.who === p && c.look === L && c.patchN === n && c.shirtHex === hex && c.bat === bat) return;
    const fresh = c.who !== p || c.look !== L;
    c.who = p; c.patchN = n; c.shirtHex = hex; c.bat = bat; c.look = L;
    // Everyone has their own build (slim … heavy … muscular), kept for as long as they exist.
    p.build ??= pickBuild(p, L);
    if (c.build !== p.build) { c.build = p.build; shapeBody(c.parts, c.t.female, p.build); }
    if (fresh || bat !== c.wasBat) {
      // The pieces this person wears → this character's index buffer.
      const list = this.wearList(c, L, p), arr = c.index.array;
      let k = 0;
      for (const [start, count] of list) for (let i = 0; i < count; i++) arr[k++] = start + i;
      c.geo.setDrawRange(0, k);
      c.index.clearUpdateRanges(); c.index.addUpdateRange(0, k); c.index.needsUpdate = true;
      c.wasBat = bat;
    }
    // Holi colour on a real character: the clothes take on the colours thrown at them.
    const tint = (target, base) => { target.copy(base); for (const [, code] of p.patches || []) target.lerp(HOLI[Math.floor(code)], 0.18); return target; };
    const U = c.u.uCol.value, P = c.u.uPat.value, PC = c.u.uPatCol.value;
    const skin = p.skin, shirt = tint(U[SLOT.shirt], p.shirt), pants = tint(U[SLOT.pants], p.pants);
    U[SLOT.skin].copy(skin);
    U[SLOT.hair].copy(p.hair || L.hairColor);
    U[SLOT.face].setRGB(0.05, 0.04, 0.03);
    // Look colour A: dupatta, lungi, tie, hard hat; a police cap takes the uniform's trousers,
    // a turban without a look of its own the person's hat colour.
    tint(U[SLOT.accA], p.flags & 1 ? p.pants : p.flags & 4 && !L.hat ? p.hatColor || tmp.setHex(0xd84315) : L.accA);
    U[SLOT.accB].copy(L.accB);
    if (L.garment === 'lungi' || L.garment === 'lungiShort') pants.copy(U[SLOT.accA]); // under the wrap
    U[SLOT.vest].copy(L.vest || shirt);
    U[SLOT.lens].setRGB(0.02, 0.02, 0.025);
    for (let s = 0; s < N_SLOT; s++) P[s].set(0, 1, 1);
    // Legs: trousers / salwar / pyjama, shorts (children), bare below the knee (folded lungi,
    // nauvari), or the sari's own cloth (seen when she sits).
    const legCol = L.garment === 'lungi' ? U[SLOT.accA] : pants;
    U[SLOT.thigh].copy(L.legs === 1 ? skin : legCol);
    U[SLOT.shin].copy(L.legs === 1 || L.legs === 2 ? skin : legCol);
    U[SLOT.sock].copy(L.socks ? tmp.setHex(0xf2f2f0) : L.legs === 1 || L.legs === 2 ? skin : legCol);
    U[SLOT.shoe].copy(p.shoe || L.shoe);
    U[SLOT.arm].copy(L.sleeves >= 1 ? shirt : skin);
    U[SLOT.forearm].copy(L.sleeves >= 2 ? shirt : skin);
    // Patterns: shirt checks / stripes / print, lungi checks, sari and nauvari prints, tie stripes.
    const u = c.t.female ? 1 : 1.08;
    if (L.patShirt) { const per = L.patShirt === 1 ? 0.11 : L.patShirt === 2 ? 0.045 : 0.09; for (const s of [SLOT.shirt, SLOT.arm, SLOT.forearm]) { P[s].set(L.patShirt, per * u, per * u); PC[s].copy(L.patCol); } }
    if (L.patAcc) { const per = L.patAcc === 1 ? 0.2 : L.patAcc === 4 ? 0.06 : 0.12; P[SLOT.accA].set(L.patAcc, per, per * 0.75); PC[SLOT.accA].copy(L.patCol); }
    if (L.patLegs) {
      const per = L.patLegs === 1 ? 0.13 : 0.1;
      for (const s of [SLOT.pants, SLOT.thigh, SLOT.shin]) { P[s].set(L.patLegs, per, per * 0.8); PC[s].copy(L.patCol); }
    } else if (L.garment === 'lungi' && L.patAcc) for (const s of [SLOT.pants, SLOT.thigh, SLOT.shin]) { P[s].copy(P[SLOT.accA]); PC[s].copy(L.patCol); }
    if (L.garment === 'lungiShort' && L.patAcc) { P[SLOT.pants].copy(P[SLOT.accA]); PC[SLOT.pants].copy(L.patCol); }
    // Bare skin takes no pattern (shorts, a folded lungi, a nauvari hitched to the knee).
    if (L.legs === 1) P[SLOT.thigh].set(0, 1, 1);
    if (L.legs === 1 || L.legs === 2) { P[SLOT.shin].set(0, 1, 1); P[SLOT.sock].set(0, 1, 1); }
    c.u.uGloss.value = L.gloss;
  }

  /**
   * Turn a bone about a world axis (through its own joint), after the clip has posed it.
   * World matrices up the chain are refreshed first so turns on parent and child compose.
   */
  turn(bone, ax, ay, az, angle) {
    if (!bone || !angle) return;
    bone.parent.updateWorldMatrix(true, false);
    bone.parent.getWorldQuaternion(this.qp);
    this.qLean.setFromAxisAngle(this.axis.set(ax, ay, az), angle);
    bone.quaternion.premultiply(this.q.copy(this.qp).invert().multiply(this.qLean).multiply(this.qp));
  }

  /**
   * Extra rotation of one bone about the character's right axis (world space), remembered so
   * it can be undone next frame if the clip doesn't key that bone.
   */
  bend(c, bone, heading, angle) {
    if (!bone || !angle) return;
    let a = null;
    for (let i = 0; i < c.adds.length; i++) if (c.adds[i].bone === bone) { a = c.adds[i]; break; }
    if (!a) { a = { bone, clean: new THREE.Quaternion(), applied: new THREE.Quaternion(), on: false }; c.adds.push(a); }
    if (!a.on) a.clean.copy(bone.quaternion);
    this.turn(bone, Math.cos(heading), 0, -Math.sin(heading), angle);
    a.applied.copy(bone.quaternion); a.on = true;
  }

  /** After the legs were turned: put each foot (a root-space bone) back on the end of its shin. */
  feet(c) {
    for (const s of [c.L, c.R]) {
      if (!s.end || !s.foot) continue;
      s.end.updateWorldMatrix(true, false);
      this.v.setFromMatrixPosition(s.end.matrixWorld);
      s.foot.parent.updateWorldMatrix(true, false);
      s.foot.position.copy(this.v.applyMatrix4(this.m4.copy(s.foot.parent.matrixWorld).invert()));
    }
  }

  /** Bone turns on top of the clip for poses the pack has no clip for. */
  pose(c, p, pose) {
    const h = p.heading, rx = Math.cos(h), rz = -Math.sin(h), fx = Math.sin(h), fz = Math.cos(h);
    const L = c.L, R = c.R, ph = p.phase || 0;
    if (pose === POSE.RIDE || pose === POSE.PEDAL) {
      // Hands forward on the handlebar; a little lean; knees a touch apart astride a bike.
      this.bend(c, c.spine, h, 0.12);
      for (const s of [L, R]) { this.bend(c, s.arm, h, -0.95); this.bend(c, s.fore, h, -0.55); }
      if (pose === POSE.PEDAL) {
        const k = Math.sin(ph);
        this.bend(c, L.thigh, h, 0.28 * k); this.bend(c, L.shin, h, -0.4 * k);
        this.bend(c, R.thigh, h, -0.28 * k); this.bend(c, R.shin, h, 0.4 * k);
      } else {
        this.turn(L.thigh, 0, 1, 0, 0.14); this.turn(R.thigh, 0, 1, 0, -0.14);
      }
      this.feet(c);
    } else if (pose === POSE.CROUCH) {
      // Wicket-keeper / pushing a car: squat, lean in, hands forward.
      this.bend(c, c.spine, h, 0.55);
      for (const s of [L, R]) { this.bend(c, s.arm, h, -0.8); this.bend(c, s.fore, h, -0.35); }
    } else if (pose === POSE.BAT) {
      // Gully cricket: a forward lean, hands together low in front, the swing from the phase.
      const sw = Math.sin(ph);
      this.bend(c, c.spine, h, 0.3);
      this.turn(c.chest, 0, 1, 0, -0.45 * sw);
      for (const s of [L, R]) { this.bend(c, s.arm, h, -0.75 + 0.45 * sw); this.bend(c, s.fore, h, -0.5); }
      this.turn(L.arm, fx, 0, fz, 0.35); this.turn(R.arm, fx, 0, fz, -0.35);
    } else if (pose === POSE.ARGUE) {
      // Hands up and talking with them.
      const a = Math.max(0, Math.sin(ph * 1.7 + 1.6)), b = Math.max(0, Math.sin(ph * 1.7 - 1.6));
      this.bend(c, L.arm, h, -0.45 - 0.6 * a); this.bend(c, L.fore, h, -0.7 - 0.3 * a);
      this.bend(c, R.arm, h, -0.45 - 0.6 * b); this.bend(c, R.fore, h, -0.7 - 0.3 * b);
      this.turn(L.arm, fx, 0, fz, 0.2 * a); this.turn(R.arm, fx, 0, fz, -0.2 * b);
    }
    void rx; void rz;
  }

  /** A body for a person: their look's clothes pick the template; stable per person. */
  templateFor(p) {
    const L = lookFor(p);
    const female = L.female || (p.flags & 2) || p.kind === 'sari';
    const list = (female ? this.lists.female : this.lists.male).length ? (female ? this.lists.female : this.lists.male) : this.templates;
    if (typeof p.model === 'number') {
      // Asked for by number (interiors): the model of that index in MODELS, else any.
      const name = MODELS[female ? 'female' : 'male'][p.model];
      return this.byName.get(name) || list[p.model % list.length];
    }
    if (p.tpl && this.byName.has(p.tpl)) return this.byName.get(p.tpl);
    const prefs = PREFER[female ? 'female' : 'male'][L.template] || [];
    let t = null;
    for (const name of prefs) { const x = this.byName.get(name); if (x && x.female === !!female) { t = x; break; } }
    if (!t || (L.template === 'casual' && L.seed > 0.6)) t = list[Math.floor(L.seed * 977) % list.length];
    p.tpl = t.name;
    return t;
  }

  /** Nearest people (within the radius) into this.chosen, without allocating. */
  choose(cam, people) {
    const R2 = this.radius * this.radius, max = this.poolSize, ch = this.chosen, dist = this.dist;
    ch.length = 0; dist.length = 0;
    for (let i = 0; i < people.length; i++) {
      const p = people[i];
      if (p.isPlayer || p.noHero) continue;
      const d = (p.x - cam.x) ** 2 + (p.z - cam.z) ** 2;
      if (d >= R2) continue;
      if (ch.length === max && d >= dist[max - 1]) continue;
      let k = ch.length < max ? ch.length : max - 1;
      while (k > 0 && dist[k - 1] > d) { ch[k] = ch[k - 1]; dist[k] = dist[k - 1]; k--; }
      ch[k] = p; dist[k] = d;
    }
  }

  /**
   * Each frame: the player (if on foot) and the people nearest the camera get a real
   * character; the procedural crowd skips them (person.hero = true).
   */
  update(dt, cam, people, player) {
    if (!this.ready) return;
    this.timer -= dt;
    const stamp = ++this.frame;
    for (let i = 0; i < people.length; i++) { const p = people[i]; p.hero = false; p.drawn = stamp; }
    const want = this.want;
    want.length = 0;
    if (player) want.push(player);
    if (this.timer <= 0) { this.timer = 0.35; this.choose(cam, people); }
    for (let i = 0; i < this.chosen.length; i++) { const p = this.chosen[i]; if (p.drawn === stamp) want.push(p); }
    // Reuse bodies already showing the same person; hand out the rest.
    const pool = this.pool;
    for (let i = 0; i < pool.length; i++) pool[i].keep = false;
    for (let i = 0; i < want.length; i++) { const c = want[i].body; if (c && c.who === want[i]) c.keep = true; }
    for (let w = 0; w < want.length; w++) {
      const p = want[w];
      let c = p.body && p.body.who === p ? p.body : null;
      if (!c) {
        const t = this.templateFor(p);
        for (let i = 0; i < pool.length; i++) if (!pool[i].keep && pool[i].t === t) { c = pool[i]; break; }
        if (!c && pool.length < this.poolSize + 1) { c = this.make(t); pool.push(c); }
        if (!c) continue;
        c.keep = true; c.who = null; c.mixer.stopAllAction(); c.current = null;
        p.body = c;
      }
      this.dress(c, p);
      p.hero = true;
      this.animate(c, p, dt, cam);
    }
    for (let i = 0; i < pool.length; i++) { const c = pool[i]; if (!c.keep && c.holder.visible) { c.holder.visible = false; if (c.who) c.who.body = null; c.who = null; c.mixer.stopAllAction(); c.current = null; } }
  }

  animate(c, p, dt, cam) {
    const t = c.t, s = (p.scale || 1) * (BUILDS[p.build]?.height || 1), sc = t.scale * s;
    const pose = p.pose ?? POSE.STAND;
    const moving = pose === POSE.WALK, fallen = pose === POSE.FALLEN;
    const riding = pose === POSE.RIDE || pose === POSE.PEDAL, crouch = pose === POSE.CROUCH;
    const sitting = pose === POSE.SIT || riding || crouch;
    const speed = p.speed ?? 1.3;
    const run = moving ? THREE.MathUtils.clamp((speed - 2.2) / 2.6, 0, 1) : 0; // 0 walk … 1 full run
    const guard = pose === POSE.FIGHT, kick = pose === POSE.KICK;
    const swing = pose === POSE.PUNCH || pose === POSE.PUSH || pose === POSE.THROW;
    const flinch = p.hitT > 0 && c.actions.hit && !fallen && !sitting;
    const clip = fallen ? 'idle' : flinch ? 'hit' : sitting ? 'sit' : swing || guard || kick ? 'punch'
      : pose === POSE.POINT ? 'aim' : pose === POSE.WAVE ? 'wave' : moving ? (run > 0.5 && c.actions.run ? 'run' : 'walk') : 'idle';
    this.play(c, clip);
    if (c.current) {
      c.current.timeScale = sitting ? 0 : moving ? THREE.MathUtils.clamp(speed / (t.walkSpeed * s * (1 + run * 0.6)), 0.55, 2.2) : 1;
      if (clip === 'punch') {
        const dur = c.current.getClip().duration;
        if (swing) {
          // Every swing starts the punch from the top.
          if (c.swingN !== p.swingN || c.wasGuard) { c.swingN = p.swingN; c.current.time = dur * 0.12; }
          c.current.timeScale = 1.6;
        } else { c.current.timeScale = 0; c.current.time = dur * GUARD_AT; } // guard up (also the base of a kick)
        c.wasGuard = !swing;
      } else if (clip === 'hit' && c.hitFor !== p.hitT && p.hitT > (c.hitFor || 0)) c.current.time = 0;
      c.hitFor = p.hitT;
    }
    // Feet on the ground: the standing and walking poses sit at slightly different heights.
    const liftWant = sitting ? t.sitLift : moving ? t.liftWalk : t.liftIdle;
    c.lift += (liftWant - c.lift) * Math.min(1, dt * 10);
    c.holder.visible = true;
    c.root.scale.setScalar(sc);
    c.holder.rotation.set(0, p.heading, 0);
    c.root.rotation.x = fallen ? -Math.PI / 2 : 0; // knocked down: flat on the back
    let y = (p.y || 0) + c.lift * s;
    // Callers give the seat height minus 0.42 (the procedural pelvis); pedalling, minus 0.86.
    if (sitting) y = (p.y || 0) + (pose === POSE.PEDAL ? 0.86 : 0.42) + (t.sitLift - t.sitHip) * s;
    if (crouch) y = (p.y || 0) + t.sitLift * s * 0.98; // squatting: feet on the ground
    if (fallen) y = (p.y || 0) + 0.16;
    y += 0.025 * run;
    if (run > 0 && c.current) y += Math.abs(Math.sin((c.current.time * Math.PI * 2) / c.current.getClip().duration)) * 0.045 * run;
    c.holder.position.set(p.x, y, p.z);
    // Far characters animate at half rate.
    const far = (p.x - cam.x) ** 2 + (p.z - cam.z) ** 2 > 24 * 24 && !p.isPlayer;
    if (!far || (this.frame & 1) === 0) {
      c.mixer.update(far ? dt * 2 : dt);
      // The clips don't key every bone: undo last frame's extra rotations where the mixer left them.
      for (let i = 0; i < c.adds.length; i++) { const a = c.adds[i]; if (a.on && a.bone.quaternion.equals(a.applied)) a.bone.quaternion.copy(a.clean); a.on = false; }
      c.holder.updateMatrixWorld(true);
      if (run > 0) {
        for (let i = 0; i < c.run.length; i++) { const e = c.run[i], b = e[0]; b.quaternion.copy(this.q.copy(e[1]).slerp(b.quaternion, 1 + e[2] * run)); }
        // Lean the upper body into the run, leaving the legs where the walk cycle puts them.
        this.bend(c, c.spine, p.heading, 0.34 * run);
      }
      if (kick) {
        // No kick clip in the pack: swing the right leg up from the guard pose and lean back a little.
        const k = Math.sin(Math.min(1, ((p.kickT = (p.kickN === p.swingN ? p.kickT : 0) + dt) / 0.4)) * Math.PI);
        p.kickN = p.swingN;
        this.bend(c, c.legR, p.heading, -1.35 * k);
        this.bend(c, c.spine, p.heading, -0.22 * k);
      }
      if (riding || crouch || pose === POSE.BAT || pose === POSE.ARGUE) this.pose(c, p, pose);
    }
    // Where the right hand is (the player's pichkari is held there).
    if (p.isPlayer && c.hand) { c.holder.updateMatrixWorld(true); (p.handPos ||= new THREE.Vector3()); c.hand.getWorldPosition(p.handPos); }
  }
}
