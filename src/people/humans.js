import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

// The game's people: MakeHuman bodies built by scripts/people/build-people.mjs
// (public/people/: index.json, one GLB per body template, a shared two-page texture atlas).
//
// Every template is one skinned mesh per level of detail (near with face morphs, mid, far),
// all sharing ONE material program: the `_part` attribute says which colour slot a vertex
// takes (skin, hair, top, bottom, shoes, extra, accent — or keep the texture's colours), so
// each person gets their own skin tone, hair and clothes colours from a uniform array while
// the atlas only stores brightness detail (linear 0.5 = the texture's average).

export const SLOT = { keep: 0, skin: 1, hair: 2, top: 3, bottom: 4, shoes: 5, extra: 6, accent: 7 };
/** Distances (m) where a person switches to the mid and far meshes, by tier. */
export const LOD_DIST = { High: [9, 24], Medium: [7, 18], Low: [5, 13] };

/** Skin tones (sRGB) across the range seen on Mumbai streets, light wheatish to deep brown. */
export const SKIN_TONES = [0xd3a07c, 0xc98f69, 0xbd8460, 0xb07650, 0xa26a47, 0x95603f, 0x875437, 0x7a4a30, 0x6b402a, 0x5c3523];
export const HAIR_COLOURS = { black: 0x141110, darkBrown: 0x2a1d16, brown: 0x3d2a1e, grey: 0x8a847e, white: 0xd8d4cc, henna: 0x5a2a17 };

const PATCH = /* glsl */`
  uniform sampler2D uAtlas1;
  uniform vec3 uTint[8];
  uniform float uHideScalp;
  flat varying vec4 vPart;
`;

/**
 * The people material: a MeshStandardMaterial patched to read the two atlas pages, tint per
 * slot, alpha-test only hair-like parts and take roughness from the vertex.
 */
export function humanMaterial(lib, tints) {
  // Two-sided: a garment is a single sheet, so looking into a sleeve, collar or hem showed
  // straight through it.
  const m = new THREE.MeshStandardMaterial({ map: lib.pages[0], roughness: 0.8, metalness: 0, alphaTest: 0.5, side: THREE.DoubleSide });
  // Hard cutout for hair cards (alpha to coverage would leave partial alpha in the game's
  // post-processing buffer and the final pass would blend hair with the background).
  const u = { uAtlas1: { value: lib.pages[1] }, uTint: { value: tints }, uHideScalp: { value: 0 }, uPatch: { value: 0 } };
  m.userData.u = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 _part;\nflat varying vec4 vPart;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvPart = _part;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${PATCH}`)
      .replace('#include <map_fragment>', /* glsl */`
        vec2 auv = vec2(vMapUv.x, fract(vMapUv.y * 2.0));
        vec4 t0 = texture2D(map, auv), t1 = texture2D(uAtlas1, auv);
        vec4 texel = vMapUv.y < 0.5 ? t0 : t1;
        int slot = int(vPart.x + 0.5);
        diffuseColor.rgb = slot == 0 ? texel.rgb : texel.rgb * 2.0 * uTint[slot];
        diffuseColor.a = vPart.y > 0.5 ? texel.a : 1.0;
        if (uHideScalp > 0.5 && vPart.w > 0.5) discard;   // scalp hair under a cap or helmet`)
      .replace('#include <alphatest_fragment>', '#include <alphatest_fragment>\ndiffuseColor.a = 1.0;')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vPart.z / 255.0;');
  };
  m.customProgramCacheKey = () => 'gtb-human-1';
  return m;
}

/** Shadow-casting depth material that cuts hair cards by the atlas alpha like the colour pass. */
function humanDepthMaterial(lib) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: lib.pages[0], alphaTest: 0.5, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uAtlas1 = { value: lib.pages[1] };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 _part;\nflat varying vec4 vPart;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvPart = _part;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uAtlas1;\nflat varying vec4 vPart;')
      .replace('#include <map_fragment>', /* glsl */`
        vec2 auv = vec2(vMapUv.x, fract(vMapUv.y * 2.0));
        float a = vMapUv.y < 0.5 ? texture2D(map, auv).a : texture2D(uAtlas1, auv).a;
        diffuseColor.a = vPart.y > 0.5 ? a : 1.0;`);
  };
  m.customProgramCacheKey = () => 'gtb-human-depth-1';
  return m;
}

export class PeopleLibrary {
  /**
   * @param renderer WebGLRenderer (for KTX2 support detection)
   * @param base site base URL ('/gtb/')
   */
  constructor(renderer, base, { msaa = false } = {}) {
    this.renderer = renderer;
    this.base = base;
    this.msaa = msaa;
    this.templates = new Map();
    this.loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  }

  async init() {
    const res = await fetch(`${this.base}people/index.json`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`people/index.json: ${res.status}`);
    this.index = await res.json();
    this.v = this.index.version;
    const ktx2 = new KTX2Loader().setTranscoderPath(`${this.base}basis/`).detectSupport(this.renderer);
    this.pages = await Promise.all(this.index.atlas.map((f) => ktx2.loadAsync(`${this.base}people/${f}?v=${this.v}`)));
    for (const t of this.pages) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.needsUpdate = true; }
    ktx2.dispose();
    this.depth = humanDepthMaterial(this);
    this.people = this.index.people;
    return this;
  }

  /**
   * The motion clips (public/people/anims.glb), converted once into deltas from the reference
   * skeleton's rest pose and played additively: every body keeps its own rest proportions
   * and only takes the motion. Resolves to Map(name → AnimationClip).
   */
  anims() {
    this._anims ||= this.loadClips(`${this.base}people/anims.glb?v=${this.v}`, `${this.base}people/anims.json?v=${this.v}`)
      .then(({ clips, rest }) => { this.refPelvis = rest.get('pelvis')?.p.clone(); return clips; });
    return this._anims;
  }

  /** Clips from a GLB, turned into deltas from that file's skeleton rest pose (additive). */
  loadClips(url, metaUrl) {
    return Promise.all([this.loader.loadAsync(url), fetch(metaUrl).then((r) => r.json())]).then(([g, meta]) => {
      const rest = new Map();
      g.scene.traverse((o) => rest.set(o.name, { q: o.quaternion.clone(), p: o.position.clone() }));
      const qi = new THREE.Quaternion(), q = new THREE.Quaternion();
      const clips = new Map();
      for (const clip of g.animations) {
        for (const t of clip.tracks) {
          const [name, prop] = t.name.split('.');
          const r = rest.get(name);
          if (!r) continue;
          const v = t.values;
          if (prop === 'quaternion') {
            qi.copy(r.q).invert();
            for (let i = 0; i < v.length; i += 4) { q.fromArray(v, i).premultiply(qi).normalize().toArray(v, i); }
          } else if (prop === 'position') {
            for (let i = 0; i < v.length; i += 3) { v[i] -= r.p.x; v[i + 1] -= r.p.y; v[i + 2] -= r.p.z; }
          }
        }
        clip.blendMode = THREE.AdditiveAnimationBlendMode;
        clip.userData = meta.clips[clip.name] || {};
        clips.set(clip.name, clip);
      }
      return { clips, rest };
    });
  }

  /**
   * The main character (public/people/hero/, scripts/people/build-hero.mjs): the owner's chosen
   * model with its own materials and textures, at a detail level by graphics tier (High = the
   * model as uploaded), with the game's clips retargeted onto its own skeleton.
   */
  hero(tierName = 'Medium') {
    this._hero ||= (async () => {
      const info = await fetch(`${this.base}people/hero/info.json`, { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(`hero: ${r.status}`); return r.json(); });
      const q = tierName === 'High' ? 'high' : tierName === 'Low' ? 'low' : 'medium';
      const v = info.version;
      const [g, { clips }] = await Promise.all([
        this.loader.loadAsync(`${this.base}people/hero/hero-${q}.glb?v=${v}`),
        this.loadClips(`${this.base}people/hero/anims.glb?v=${v}`, `${this.base}people/hero/anims.json?v=${v}`),
      ]);
      return { hero: true, info: { ...info, kinds: ['player'], palette: {}, build: 'fit' }, gltf: g, scene: g.scene, clips, lods: [] };
    })();
    return this._hero;
  }

  /** A person from the main character's template: its own materials, one level of detail, no face morphs. */
  instantiateHero(t) {
    const root = cloneSkinned(t.scene);
    const meshes = [];
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      o.material = [o.material].flat().map((m) => {
        const c = m.clone();
        // Cut-out parts (eyelashes, glasses) write full alpha: partial alpha leaked into the
        // game's post-processing buffer and showed the background through (the hair bug).
        if (c.alphaTest > 0 && !c.transparent) {
          c.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <alphatest_fragment>', '#include <alphatest_fragment>\ndiffuseColor.a = 1.0;'); };
          c.customProgramCacheKey = () => 'gtb-hero-cutout';
        }
        return c;
      });
      if (o.material.length === 1) o.material = o.material[0];
      meshes.push(o);
    });
    const bones = new Map();
    root.traverse((o) => { if (o.isBone) bones.set(o.name, o); });
    return {
      id: 'hero', hero: true, info: t.info, root, meshes, bones, morphs: {}, tints: [], material: null, lod: 0, template: t,
      setLod() {}, face() {},
    };
  }

  /** Clips for one template: shared tracks, the hip track scaled to its leg length. */
  async clipsFor(t) {
    const clips = await this.anims();
    if (t.clips) return t.clips;
    const pelvis = t.scene.getObjectByName('pelvis');
    const k = pelvis && this.refPelvis ? pelvis.position.length() / this.refPelvis.length() : 1;
    t.clips = new Map();
    for (const [name, c] of clips) {
      const tracks = c.tracks.map((tr) => {
        if (!tr.name.endsWith('.position')) return tr;
        const copy = tr.clone();
        for (let i = 0; i < copy.values.length; i++) copy.values[i] *= k;
        return copy;
      });
      const clip = new THREE.AnimationClip(name, c.duration, tracks, THREE.AdditiveAnimationBlendMode);
      clip.userData = c.userData;
      t.clips.set(name, clip);
    }
    return t.clips;
  }

  /** Load one body template (cached): { info, scene, lods: [SkinnedMesh…] }. */
  template(id) {
    if (!this.templates.has(id)) {
      const info = this.people.find((p) => p.id === id);
      this.templates.set(id, this.loader.loadAsync(`${this.base}people/${info.file}?v=${this.v}`).then((g) => {
        const lods = [];
        g.scene.traverse((o) => { if (o.isSkinnedMesh) lods[Number(o.name.match(/lod(\d)/)?.[1] ?? lods.length)] = o; });
        return { info, gltf: g, scene: g.scene, lods };
      }));
    }
    return this.templates.get(id);
  }

  /**
   * A person from a template: { root, meshes, bones, morphs, tints, material, setLod(i) }.
   * `look`: { skin, hair, top, bottom, shoes, extra, accent } colours (anything THREE.Color takes).
   */
  async make(id, look = {}) {
    return this.instantiate(await this.template(id), look);
  }

  /** A person from an already loaded template (synchronous). */
  instantiate(t, look = {}) {
    const id = t.info.id;
    const root = cloneSkinned(t.scene);
    const tints = Array.from({ length: 8 }, () => new THREE.Color(0.5, 0.5, 0.5));
    const material = humanMaterial(this, tints);
    const meshes = [];
    root.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      o.material = material;
      o.customDepthMaterial = this.depth;
      o.castShadow = true; o.receiveShadow = true;
      o.frustumCulled = false;
      meshes[Number(o.name.match(/lod(\d)/)?.[1] ?? meshes.length)] = o;
    });
    const bones = new Map();
    root.traverse((o) => { if (o.isBone) bones.set(o.name, o); });
    const morphs = meshes[0]?.morphTargetDictionary || {};
    const person = {
      id, info: t.info, root, meshes, bones, morphs, tints, material, lod: -1, template: t,
      setLod(i) { if (i === this.lod) return; this.lod = i; meshes.forEach((m, k) => { m.visible = k === i; }); },
      /** Set a face morph (0…1) by name on the near mesh. */
      face(name, v) { const k = morphs[name]; if (k !== undefined) meshes[0].morphTargetInfluences[k] = v; },
    };
    person.setLod(0);
    dress(person, look);
    return person;
  }
}

/** Colours for a person's slots (linear tints; 0.5 grey = the texture as drawn). */
export function dress(person, look) {
  if (person.hero) return;      // the main character keeps his own clothes and colours
  const t = person.tints;
  const set = (slot, c) => { if (c !== undefined && c !== null) t[slot].set(c); };
  set(SLOT.skin, look.skin ?? SKIN_TONES[4]);
  set(SLOT.hair, look.hair ?? HAIR_COLOURS.black);
  set(SLOT.top, look.top ?? 0x8899aa);
  set(SLOT.bottom, look.bottom ?? 0x2b2f38);
  set(SLOT.shoes, look.shoes ?? 0x2a2420);
  set(SLOT.extra, look.extra ?? 0xb03a2e);
  set(SLOT.accent, look.accent ?? 0xd9a21b);
}
