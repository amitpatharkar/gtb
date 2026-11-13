import * as THREE from 'three';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

// Real photo-scanned materials (free, CC0) built by the asset pipeline into media/.
// Textures load in the background; materials show their flat colour until then.

export class TextureLibrary {
  constructor(renderer, baseUrl, tier) {
    this.renderer = renderer;
    this.base = baseUrl;
    this.tier = tier;
    this.assets = new Map();
    this.cache = new Map();
    this.pending = 0;
    this.available = false;
  }

  async init() {
    try {
      const res = await fetch(`${this.base}media/manifest.json`);
      if (!res.ok) throw new Error(res.status);
      const manifest = await res.json();
      for (const a of manifest.assets) this.assets.set(a.id, a);
      this.ktx2 = new KTX2Loader().setTranscoderPath(`${this.base}basis/`).detectSupport(this.renderer);
      this.available = true;
    } catch {
      console.info('No media/ assets in this build: using procedural materials only.');
    }
    return this;
  }

  has(id) { return this.assets.has(id); }
  url(id, file = 0) { const a = this.assets.get(id); return a && `${this.base}media/${a.files[file]}`; }

  /** Real-world size of one texture repeat, in metres. */
  metres(id, fallback = 2) {
    const m = this.assets.get(id)?.meta?.metres;
    return m ? m[0] : fallback;
  }

  load(path) {
    if (!this.cache.has(path)) {
      this.pending++;
      const p = this.ktx2.loadAsync(`${this.base}media/${path}`).then((t) => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.anisotropy = this.tier.anisotropy;
        return t;
      }).finally(() => { this.pending--; });
      this.cache.set(path, p);
    }
    return this.cache.get(path);
  }

  /**
   * Put a texture set (colour, normal, occlusion/roughness) on a material once loaded.
   * Geometry UVs are in metres; `size` overrides the texture's real-world size.
   * Each call clones the textures so materials can use different scales.
   */
  apply(material, id, { size, normalScale = 1, aoIntensity = 0.6, onLoad } = {}) {
    if (!this.available || !this.has(id)) return Promise.resolve(false);
    const files = this.assets.get(id).files;
    const pick = (name) => files.find((f) => f.endsWith(`/${name}.ktx2`));
    const repeat = 1 / (size || this.metres(id));
    const jobs = [
      ['map', pick('color')],
      this.tier.normalMaps ? ['normalMap', pick('normal')] : null,
      ['roughnessMap', pick('orm')],
    ].filter((j) => j && j[1]);
    return Promise.all(jobs.map(([slot, f]) => this.load(f).then((t) => [slot, t]))).then((loaded) => {
      for (const [slot, tex] of loaded) {
        const t = tex.clone();
        t.repeat.set(repeat, repeat);
        material[slot] = t;
        if (slot === 'roughnessMap') { material.aoMap = t; material.aoMapIntensity = aoIntensity; material.roughness = 1; }
        if (slot === 'normalMap') material.normalScale.set(normalScale, normalScale);
      }
      material.needsUpdate = true;
      onLoad?.(material);
      return true;
    }).catch((e) => { console.warn(`Texture ${id} failed`, e); return false; });
  }
}

let noiseTex = null;
/** Smooth tiling value noise (canvas, 256 px) used to break up texture repetition. */
export function macroNoiseTexture() {
  if (noiseTex) return noiseTex;
  const S = 256, G = 8;
  const grid = new Float32Array(G * G).map(() => Math.random());
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const img = g.createImageData(S, S);
  const smooth = (t) => t * t * (3 - 2 * t);
  const at = (x, y) => grid[((y % G) + G) % G * G + ((x % G) + G) % G];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let v = 0, amp = 0.6, f = 1;
      for (let o = 0; o < 3; o++) {
        const fx = (x / S) * G * f, fy = (y / S) * G * f;
        const ix = Math.floor(fx), iy = Math.floor(fy), tx = smooth(fx - ix), ty = smooth(fy - iy);
        const a = at(ix, iy), b = at(ix + 1, iy), cc = at(ix, iy + 1), d = at(ix + 1, iy + 1);
        v += amp * ((a * (1 - tx) + b * tx) * (1 - ty) + (cc * (1 - tx) + d * tx) * ty);
        amp *= 0.5; f *= 2;
      }
      const i = (y * S + x) * 4;
      const n = Math.round(Math.min(1, v / 1.05) * 255);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = n;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  noiseTex = new THREE.CanvasTexture(c);
  noiseTex.wrapS = noiseTex.wrapT = THREE.RepeatWrapping;
  return noiseTex;
}

/**
 * Break up tiling on large surfaces: modulate the albedo with two octaves of
 * world-space noise (tens of metres), like dirt and wear patches.
 */
export function addMacroVariation(material, { scale = 1 / 45, strength = 0.22 } = {}) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, r) => {
    prev?.(shader, r);
    shader.uniforms.tMacro = { value: macroNoiseTexture() };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vMacroXZ;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvMacroXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vMacroXZ;\nuniform sampler2D tMacro;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float macroN = texture2D(tMacro, vMacroXZ * ${scale.toFixed(5)}).r * 0.65 + texture2D(tMacro, vMacroXZ * ${(scale * 4.3).toFixed(5)}).r * 0.35;
        diffuseColor.rgb *= 1.0 + (macroN - 0.5) * ${(strength * 2).toFixed(3)};`);
  };
  const prevKey = material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey = () => `${prevKey()}|macro${scale}${strength}`;
  return material;
}
