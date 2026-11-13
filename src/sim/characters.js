import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { POSE, HOLI } from './people.js';

// Real rigged, animated characters (Quaternius "Ultimate Animated Character Pack", CC0,
// converted from FBX in the asset pipeline) for the player and everyone near the camera;
// only people far away stay on the light procedural crowd (people.js).
//
// Each character is ONE skinned mesh and one draw call: the pack's per-material meshes are
// merged, and a small shader patch colours each part (skin, top, trousers, hair, eyes) from
// per-character uniforms, so clothes and skin follow the crowd's outfits.
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

// Ordered by priority: Low loads the first two of each, Medium four, High all.
const MODELS = {
  male: ['Casual_Male', 'Casual2_Male', 'Worker_Male', 'Casual3_Male', 'Casual_Bald', 'OldClassy_Male', 'Suit_Male', 'Chef_Male', 'Doctor_Male_Young'],
  female: ['Casual_Female', 'Casual2_Female', 'Casual3_Female', 'Worker_Female', 'OldClassy_Female', 'Suit_Female', 'Doctor_Female_Young'],
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
function pickBuild(p) {
  if (p.isPlayer) return 'fit';
  if (p.kind === 'kid' || (p.scale ?? 1) < 0.85) return 'kid';
  const female = (p.flags || 0) & 2;
  const table = p.kind === 'jogger' ? [['slim', 5], ['average', 3], ['muscular', 2]]
    : p.kind === 'worker' || p.kind === 'driver' ? [['slim', 3], ['average', 4], ['muscular', 2], ['stocky', 2], ['heavy', 1]]
    : p.kind === 'office' ? [['average', 4], ['heavy', 3], ['slim', 2], ['stocky', 2], ['lanky', 1]]
    : female ? [['average', 4], ['slim', 3], ['heavy', 2], ['stocky', 2]]
    : [['average', 4], ['slim', 2.5], ['heavy', 2], ['stocky', 1.2], ['muscular', 1], ['lanky', 1]];
  let r = Math.random() * table.reduce((a, [, w]) => a + w, 0);
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
const SLOT = { other: 0, skin: 1, shirt: 2, pants: 3, hair: 4, face: 5, leg: 6, shoe: 7 };
// Limbs whose swing is amplified when running: [bone name pattern, extra factor at a full run].
const RUN_BONES = [[/^upperleg/i, 0.55], [/^lowerleg/i, 0.35], [/^upperarm/i, 0.7], [/^lowerarm/i, 0.5]];

const slotOf = (name) => {
  const n = (name || '').toLowerCase();
  return /^skin/.test(n) ? SLOT.skin : /^(shirt|clothes|main|top|vest)/.test(n) ? SLOT.shirt : /^(pants|trousers|skirt)/.test(n) ? SLOT.pants : /^hair/.test(n) ? SLOT.hair : /^face/.test(n) ? SLOT.face : SLOT.other;
};

/** One material per character: the same program, different part colours. */
function characterMaterial() {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.82, metalness: 0 });
  const u = { uSkin: { value: new THREE.Color() }, uShirt: { value: new THREE.Color() }, uPants: { value: new THREE.Color() }, uHair: { value: new THREE.Color() }, uLeg: { value: new THREE.Color() }, uShoe: { value: new THREE.Color() } };
  m.userData.u = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aSlot; attribute vec3 aBase; varying float vSlot; varying vec3 vBase;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSlot = aSlot; vBase = aBase;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vSlot; varying vec3 vBase; uniform vec3 uSkin; uniform vec3 uShirt; uniform vec3 uPants; uniform vec3 uHair; uniform vec3 uLeg; uniform vec3 uShoe;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = vSlot < 0.5 ? vBase : vSlot < 1.5 ? uSkin : vSlot < 2.5 ? uShirt : vSlot < 3.5 ? uPants : vSlot < 4.5 ? uHair : vSlot < 5.5 ? vec3(0.05, 0.04, 0.03) : vSlot < 6.5 ? uLeg : uShoe;');
  };
  m.customProgramCacheKey = () => 'gtb-character2';
  return m;
}

/**
 * A sari for the real characters: a skirt from waist to ankle and the pallu, the end of the
 * cloth that crosses the chest and falls over the left shoulder. One small rigid mesh in
 * metres (child of the character's holder); `mask` marks the border, coloured per person.
 */
function sariGeometry() {
  const pos = [], mask = [], idx = [];
  const v = (x, y, z, m) => { pos.push(x, y, z); mask.push(m); return pos.length / 3 - 1; };
  // Skirt: rings of an elliptical cone, a border band at the hem.
  const N = 14, rings = [[0.985, 0.168, 0.128, 0], [0.62, 0.215, 0.185, 0], [0.16, 0.285, 0.275, 0], [0.155, 0.287, 0.277, 1], [0.045, 0.292, 0.282, 1]];
  const start = [];
  for (const [y, rx, rz, m] of rings) {
    start.push(pos.length / 3);
    for (let i = 0; i <= N; i++) { const a = (i / N) * Math.PI * 2; v(Math.sin(a) * rx, y, Math.cos(a) * rz + 0.012, m); }
  }
  for (let r = 0; r + 1 < rings.length; r++) for (let i = 0; i < N; i++) { const a = start[r] + i, b = start[r + 1] + i; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  // Pallu: a ribbon from the right hip, across the chest, over the left shoulder and down the back.
  const path = [[-0.15, 0.97, 0.125], [-0.04, 1.14, 0.15], [0.09, 1.3, 0.125], [0.165, 1.405, 0.03], [0.17, 1.39, -0.07], [0.16, 1.12, -0.135], [0.15, 0.78, -0.15]];
  const w = 0.085;
  let prev = null;
  path.forEach(([x, y, z], i) => {
    // Width runs across the body on the chest, and across the back behind.
    const a = v(x - w, y - (i < 3 ? 0.03 : 0), z, i === path.length - 1 ? 1 : 0), b = v(x + w, y + (i < 3 ? 0.03 : 0), z, i === path.length - 1 ? 1 : 0);
    if (prev) idx.push(prev[0], a, prev[1], prev[1], a, b);
    prev = [a, b];
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(pos.length), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.userData.mask = mask;
  return g;
}
let SARI_GEO = null;

export class Characters {
  constructor(scene, base, tier, lib = null, started = Promise.resolve()) {
    this.scene = scene;
    this.poolSize = tier.name === 'High' ? 30 : tier.name === 'Medium' ? 20 : 11;
    this.radius = tier.name === 'Low' ? 34 : 46;
    this.templates = [];
    this.pool = [];
    this.ready = false;
    this.timer = 0;
    this.frame = 0;
    this.q = new THREE.Quaternion(); this.qp = new THREE.Quaternion(); this.qLean = new THREE.Quaternion(); this.axis = new THREE.Vector3();
    const loader = new GLTFLoader();
    const dir = `${base}media/models/character-quaternius-animated-pack/converted/`;
    // Only ask for models the asset manifest says were built (no 404s while they're missing).
    const files = new Set(lib?.assets?.get('character-quaternius-animated-pack')?.files || []);
    const per = tier.name === 'High' ? 9 : tier.name === 'Medium' ? 4 : 2;
    const names = [...MODELS.male.slice(0, per), ...MODELS.female.slice(0, per)].filter((n) => files.has(`models/character-quaternius-animated-pack/converted/${n}.glb`));
    if (!names.length) return;
    started.then(() => Promise.allSettled(names.map((n) => loader.loadAsync(`${dir}${n}.glb`).then((g) => ({ name: n, gltf: g, female: MODELS.female.includes(n) }))))
      .then((res) => {
        const ok = [];
        for (const r of res) {
          if (r.status !== 'fulfilled') continue;
          try { this.prepare(r.value); ok.push(r.value); } catch (e) { console.warn(`Character ${r.value.name} skipped:`, e.message); }
        }
        this.templates = ok;
        this.ready = ok.length > 0;
      }));
  }

  /** Merge the model into one mesh, find its bones, and measure it in the animated poses. */
  prepare(t) {
    const scene = t.gltf.scene;
    scene.updateMatrixWorld(true);
    // --- one skinned mesh: merge the per-material meshes (they share a skeleton)
    const meshes = [];
    scene.traverse((o) => { if (o.isSkinnedMesh) meshes.push(o); });
    if (!meshes.length) throw new Error('no skinned mesh');
    const skeleton = meshes[0].skeleton;
    const geos = [];
    for (const m of meshes) {
      if (m.skeleton !== skeleton) throw new Error('several skeletons');
      const mats = [m.material].flat();
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'skinIndex', 'skinWeight'].includes(k)) g.deleteAttribute(k);
      if (!g.attributes.normal) g.computeVertexNormals();
      const n = g.attributes.position.count, slot = new Float32Array(n), base = new Float32Array(n * 3);
      // The mesh's material → per-vertex slot and base colour.
      const mat = mats[0], s = slotOf(mat.name), c = mat.color || new THREE.Color(0.5, 0.5, 0.5);
      for (let i = 0; i < n; i++) { slot[i] = s; base[i * 3] = c.r; base[i * 3 + 1] = c.g; base[i * 3 + 2] = c.b; }
      g.setAttribute('aSlot', new THREE.BufferAttribute(slot, 1));
      g.setAttribute('aBase', new THREE.BufferAttribute(base, 3));
      g.morphAttributes = {};
      geos.push(g);
    }
    const merged = geos.length > 1 ? mergeGeometries(geos) : geos[0];
    if (!merged) throw new Error('merge failed');
    // The pack's people wear shorts and no shoes. Bare skin on the legs becomes its own slot
    // (trouser legs for adults, skin for children) and the feet become footwear.
    {
      const si = merged.attributes.skinIndex, sw = merged.attributes.skinWeight, sl = merged.attributes.aSlot;
      const kind = skeleton.bones.map((b) => (/^(upperleg|lowerleg)/i.test(b.name) ? 1 : /^(foot|toe)/i.test(b.name) ? 2 : 0));
      for (let i = 0; i < sl.count; i++) {
        let best = 0, bw = -1;
        for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } }
        const s0 = sl.getX(i);
        if (kind[best] === 2 && (s0 === SLOT.skin || s0 === SLOT.other)) sl.setX(i, SLOT.shoe);
        else if (kind[best] === 1 && s0 === SLOT.skin) sl.setX(i, SLOT.leg);
      }
    }
    const mesh = new THREE.SkinnedMesh(merged, new THREE.MeshStandardMaterial());
    mesh.name = 'body';
    meshes[0].parent.add(mesh);
    mesh.position.copy(meshes[0].position); mesh.quaternion.copy(meshes[0].quaternion); mesh.scale.copy(meshes[0].scale);
    mesh.updateMatrixWorld(true);
    mesh.bind(skeleton, meshes[0].bindMatrix);
    for (const m of meshes) m.parent.remove(m);
    mesh.frustumCulled = false;
    t.mesh = mesh;

    // --- adult body shape, re-baked clips
    t.parts = rig(scene);
    shapeBody(t.parts, t.female, 'average');
    const hips = skeleton.bones.find((b) => /^hips$/i.test(b.name));
    let bodyBone = null; const feet = [];
    scene.traverse((o) => { if (/^body(_\d+)?$/i.test(o.name) && !o.isMesh && o.children.some((c) => /^hips$/i.test(c.name))) bodyBone = o; if (/^foot[^_]*$/i.test(o.name)) feet.push(o.name); });
    const names = { body: bodyBone?.name, feet };
    t.clips = {};
    for (const [k, re] of Object.entries(CLIP)) { const clip = t.gltf.animations.find((a) => re.test(a.name)); t.clips[k] = clip ? bake(clip, names, LEG) : null; }
    t.clips.idle ||= bake(t.gltf.animations[0], names, LEG);

    // --- measure in the animated poses (the bind pose is an A-pose and the clips move the hips)
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
    t.scale = HEIGHT[t.female ? 'female' : 'male'] / (i1 - i0 || 1);
    t.liftIdle = -i0 * t.scale;
    t.liftWalk = -walkMin * t.scale;
    t.sitLift = -sitMin * t.scale;
    t.sitHip = sitHip * t.scale; // hips above the feet when seated
    // Ground covered by one walk cycle (from the feet's fore-aft travel): the speed the clip suits.
    t.walkSpeed = 1.3;
    const ft = t.clips.walk?.tracks.find((tr) => feet.some((n) => tr.name === `${n}.position`));
    if (ft) { let lo = Infinity, hi = -Infinity; for (let i = 2; i < ft.values.length; i += 3) { lo = Math.min(lo, ft.values[i]); hi = Math.max(hi, ft.values[i]); } t.walkSpeed = Math.max(0.6, (2 * (hi - lo) * t.scale) / t.clips.walk.duration); }
    t.debug = { i0, i1, walkMin, sitMin, sitHip, walkSpeed: t.walkSpeed, body: names.body || 'none', feet: feet.length };
  }

  make(t) {
    const root = cloneSkinned(t.gltf.scene);
    let mesh = null;
    const bones = new Map();
    root.traverse((o) => { if (o.isSkinnedMesh) mesh = o; if (o.isBone) bones.set(o.name, o); });
    mesh.material = characterMaterial();
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
    return { t, holder, root, mesh, mixer, actions, parts, build: 'average', u: mesh.material.userData.u, head: find(/^head$/i), spine: find(/^abdomen$/i) || find(/^torso$/i), hand: find(/^fist\.?r$|^hand\.?r$|righthand/i), legR: find(/^upperleg\.?r$/i), run, lift: t.liftIdle, current: null, who: null, cap: null, adds: [] };
  }

  play(c, name) {
    const a = c.actions[name] || c.actions.idle;
    if (!a || c.current === a) return;
    // A freshly assigned body starts at full weight (a fade-in from zero shows the bind pose).
    if (c.current) { a.reset().fadeIn(0.18).play(); c.current.fadeOut(0.18); } else a.reset().setEffectiveWeight(1).play();
    if (name === 'sit') a.time = Math.max(0, a.getClip().duration - 0.02); // already seated
    c.current = a;
  }

  /** Colours for this person; a police cap or helmet on the head where their flags say so. */
  dress(c, p) {
    const n = p.patches?.length || 0;
    if (c.who === p && c.patchN === n && c.shirtHex === p.shirt.getHex()) return;
    c.who = p; c.patchN = n; c.shirtHex = p.shirt.getHex();
    // Everyone has their own build (slim … heavy … muscular), kept for as long as they exist.
    p.build ??= pickBuild(p);
    if (c.build !== p.build) { c.build = p.build; shapeBody(c.parts, c.t.female, p.build); }
    // Holi colour on a real character: the clothes take on the colours thrown at them.
    const tint = (target, base) => { target.copy(base); for (const [, code] of p.patches || []) target.lerp(HOLI[Math.floor(code)], 0.18); };
    c.u.uSkin.value.copy(p.skin);
    tint(c.u.uShirt.value, p.shirt);
    tint(c.u.uPants.value, p.pants);
    // Full-length trousers (or salwar / leggings) on adults; children keep their shorts.
    c.u.uLeg.value.copy(p.build === 'kid' ? p.skin : c.u.uPants.value);
    p.shoe ??= new THREE.Color([0x1a1a1a, 0x2b1d14, 0x3a2a1e, 0x6b4a32, 0xd8d4cc, 0x20242c][Math.floor(Math.random() * 6)]);
    c.u.uShoe.value.copy(p.shoe);
    // Black to dark-brown hair, a little grey on some.
    p.hair ??= new THREE.Color().setHSL(0.07, 0.35, Math.random() < 0.1 ? 0.2 : 0.03 + Math.random() * 0.04);
    c.u.uHair.value.copy(p.hair);
    // Most women wear a sari over the blouse (the rest: salwar or trousers).
    if (c.t.female && p.build !== 'kid' && !p.isPlayer) p.sari ??= Math.random() < 0.62;
    c.wearSari = !!p.sari && c.t.female;
    if (c.wearSari) {
      if (!c.sari) {
        SARI_GEO ||= sariGeometry();
        const geo = SARI_GEO.clone(); geo.userData.mask = SARI_GEO.userData.mask;
        c.sari = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.78 }));
        c.sari.castShadow = true; c.sari.frustumCulled = false;
        c.holder.add(c.sari);
      }
      p.sariBorder ??= new THREE.Color([0xd9a21b, 0xe8c15a, 0xb3122a, 0x0f6b4f, 0xf2efe6][Math.floor(Math.random() * 5)]);
      const col = c.sari.geometry.attributes.color, mask = c.sari.geometry.userData.mask, body = c.u.uPants.value, edge = p.sariBorder;
      for (let i = 0; i < col.count; i++) { const k = mask[i] ? edge : body; col.setXYZ(i, k.r, k.g, k.b); }
      col.needsUpdate = true;
    }
    if (c.sari) c.sari.visible = c.wearSari;
    const hat = (p.flags || 0) & 1 ? 'cap' : (p.flags || 0) & 4 ? 'helmet' : null;
    if (c.cap) c.cap.visible = false;
    c.cap = null;
    if (hat && c.head) {
      c.hats ||= {};
      if (!c.hats[hat]) { c.hats[hat] = this.makeHat(c, hat); c.head.add(c.hats[hat]); }
      c.cap = c.hats[hat];
      c.cap.visible = true;
      c.cap.material.color.copy(hat === 'cap' ? p.pants : p.hatColor || (p.hatColor = new THREE.Color().setHSL(Math.random(), 0.5, 0.25)));
    }
  }

  /** A peaked cap (police, drivers) or a helmet, sized in the head bone's own space. */
  makeHat(c, kind) {
    const end = c.head.children.find((b) => b.isBone);
    const top = end ? end.position.length() : 1;
    const r = top * 0.62;
    let geo;
    if (kind === 'cap') {
      const crown = new THREE.CylinderGeometry(r * 0.98, r * 1.02, top * 0.22, 14).translate(0, top * 0.93, 0);
      const peak = new THREE.CylinderGeometry(r * 0.75, r * 0.75, top * 0.03, 12, 1, false, -0.9, 1.8).translate(0, top * 0.83, r * 0.62);
      geo = mergeGeometries([crown, peak]);
    } else geo = new THREE.SphereGeometry(r * 1.12, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62).translate(0, top * 0.52, 0);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ roughness: kind === 'cap' ? 0.9 : 0.35 }));
    m.castShadow = true;
    // The bone's long axis is +Y in the pack (Blender bones); follow the head-end bone if not.
    if (end && Math.abs(end.position.y) < Math.max(Math.abs(end.position.x), Math.abs(end.position.z))) m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.position.clone().normalize());
    return m;
  }

  /**
   * Extra rotation of one bone about the character's right axis (world space), remembered so
   * it can be undone next frame if the clip doesn't key that bone.
   */
  bend(c, bone, heading, angle) {
    if (!bone || !angle) return;
    let a = c.adds.find((x) => x.bone === bone);
    if (!a) { a = { bone, clean: new THREE.Quaternion(), applied: new THREE.Quaternion(), on: false }; c.adds.push(a); }
    if (!a.on) a.clean.copy(bone.quaternion);
    bone.parent.getWorldQuaternion(this.qp);
    this.qLean.setFromAxisAngle(this.axis.set(Math.cos(heading), 0, -Math.sin(heading)), angle);
    bone.quaternion.premultiply(this.q.copy(this.qp).invert().multiply(this.qLean).multiply(this.qp));
    a.applied.copy(bone.quaternion); a.on = true;
  }

  /** Pick a body for a person: female models for saris, a stable choice per person. */
  templateFor(p) {
    const female = p.flags & 2 || p.kind === 'sari';
    const list = this.templates.filter((t) => t.female === !!female);
    const pool = list.length ? list : this.templates;
    p.model ??= Math.floor(Math.random() * 1000);
    return pool[p.model % pool.length];
  }

  /**
   * Each frame: the player (if on foot) and the people nearest the camera get a real
   * character; the procedural crowd skips them (person.hero = true).
   */
  update(dt, cam, people, player) {
    if (!this.ready) return;
    this.timer -= dt; this.frame++;
    const want = [];
    if (player) want.push(player);
    if (this.timer <= 0) {
      this.timer = 0.35;
      const R2 = this.radius * this.radius;
      this.chosen = people.filter((p) => !p.isPlayer && !p.noHero && p.pose !== undefined && p.pose !== POSE.BAT && p.pose !== POSE.CROUCH)
        .map((p) => [p, (p.x - cam.x) ** 2 + (p.z - cam.z) ** 2]).filter(([, d]) => d < R2).sort((a, b) => a[1] - b[1]).slice(0, this.poolSize).map(([p]) => p);
    }
    for (const p of this.chosen || []) if (people.includes(p)) want.push(p);
    for (const p of people) p.hero = false;
    // Reuse bodies already showing the same person; hand out the rest.
    const free = this.pool.filter((c) => !want.includes(c.who));
    for (const p of want) {
      let c = this.pool.find((x) => x.who === p);
      if (!c) {
        const t = this.templateFor(p);
        c = free.find((x) => x.t === t) || null;
        if (c) free.splice(free.indexOf(c), 1);
        else if (this.pool.length < this.poolSize + 1) { c = this.make(t); this.pool.push(c); }
        else continue;
        c.who = null; c.mixer.stopAllAction(); c.current = null;
      }
      this.dress(c, p);
      p.hero = true;
      const t = c.t, s = (p.scale || 1) * (BUILDS[p.build]?.height || 1), sc = t.scale * s;
      const pose = p.pose ?? POSE.STAND;
      const moving = pose === POSE.WALK, sitting = pose === POSE.SIT, fallen = pose === POSE.FALLEN;
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
      if (sitting) y = (p.y || 0) + 0.42 + (t.sitLift - t.sitHip) * s; // callers give the seat height minus 0.42 (the procedural pelvis)
      if (fallen) y = (p.y || 0) + 0.16;
      y += 0.025 * run;
      if (run > 0 && c.current) y += Math.abs(Math.sin((c.current.time * Math.PI * 2) / c.current.getClip().duration)) * 0.045 * run;
      c.holder.position.set(p.x, y, p.z);
      if (c.sari) { c.sari.visible = c.wearSari && !fallen && !sitting; c.sari.scale.setScalar(s * (c.t.female ? 1 : 1.08)); }
      // Far characters animate at half rate.
      const far = (p.x - cam.x) ** 2 + (p.z - cam.z) ** 2 > 24 * 24 && !p.isPlayer;
      if (!far || (this.frame & 1) === 0) {
        c.mixer.update(far ? dt * 2 : dt);
        // The clips don't key every bone: undo last frame's extra rotations where the mixer left them.
        for (const a of c.adds) { if (a.on && a.bone.quaternion.equals(a.applied)) a.bone.quaternion.copy(a.clean); a.on = false; }
        if (run > 0) {
          for (const [b, ref, k] of c.run) b.quaternion.copy(this.q.copy(ref).slerp(b.quaternion, 1 + k * run));
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
      }
      // Where the right hand is (the player's pichkari is held there).
      if (p.isPlayer && c.hand) { c.holder.updateMatrixWorld(true); (p.handPos ||= new THREE.Vector3()); c.hand.getWorldPosition(p.handPos); }
    }
    for (const c of free) { if (c.holder.visible) { c.holder.visible = false; c.who = null; c.mixer.stopAllAction(); c.current = null; } }
  }
}
