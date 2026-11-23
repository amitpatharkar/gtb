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
    // Texture downloads wait at this gate until the sky and the map around the player are
    // in, so they don't compete for bandwidth with what is needed to start playing.
    this.gate = new Promise((r) => { this.openGate = r; });
  }

  /** Resolves when no texture download is pending. */
  idle() {
    return new Promise((resolve) => { const check = () => (this.pending ? setTimeout(check, 100) : resolve()); check(); });
  }

  async init() {
    try {
      // Always revalidated (GitHub Pages lets browsers keep files 10 minutes); every media URL
      // then carries the manifest's version, so a deploy never mixes old and new files.
      const res = await fetch(`${this.base}media/manifest.json`, { cache: 'no-cache' });
      if (!res.ok) throw new Error(res.status);
      const manifest = await res.json();
      for (const a of manifest.assets) this.assets.set(a.id, a);
      this.version = mediaVersion(manifest);
      versionMediaUrls(this.base, this.version);
      this.ktx2 = new KTX2Loader().setTranscoderPath(`${this.base}basis/`).detectSupport(this.renderer);
      this.available = true;
    } catch {
      console.info('No media/ assets in this build: using procedural materials only.');
    }
    return this;
  }

  has(id) { return this.assets.has(id); }
  url(id, file = 0) { const a = this.assets.get(id); return a && `${this.base}media/${a.files[file]}?v=${this.version}`; }

  /** Real-world size of one texture repeat, in metres. */
  metres(id, fallback = 2) {
    const m = this.assets.get(id)?.meta?.metres;
    return m ? m[0] : fallback;
  }

  load(path) {
    if (!this.cache.has(path)) {
      this.pending++;
      const p = this.gate.then(() => this.ktx2.loadAsync(`${this.base}media/${path}?v=${this.version}`)).then((t) => {
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
   *
   * The slots get 1×1 stand-ins straight away (white; flat normal; no occlusion and the
   * material's own roughness), so the shader is compiled with its final set of maps while
   * the loading screen is up (renderer.compileAsync). The real textures only replace the
   * stand-ins: same shader, no compile stall mid-drive when a texture arrives late.
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
    for (const [slot] of jobs) {
      if (slot === 'map') material.map = placeholder('color');
      if (slot === 'normalMap') { material.normalMap = placeholder('normal'); material.normalScale.set(normalScale, normalScale); }
      if (slot === 'roughnessMap') {
        material.roughnessMap = material.aoMap = placeholder('orm', material.roughness);
        material.aoMapIntensity = aoIntensity;
        material.roughness = 1;
      }
    }
    material.needsUpdate = true;
    return Promise.all(jobs.map(([slot, f]) => this.load(f).then((t) => [slot, t]))).then((loaded) => {
      for (const [slot, tex] of loaded) {
        const t = tex.clone();
        t.repeat.set(repeat, repeat);
        material[slot] = t;
        if (slot === 'roughnessMap') material.aoMap = t;
      }
      // Same maps as the stand-ins, so the program cache key is unchanged: this finds the
      // already-compiled shader rather than compiling a new one.
      material.needsUpdate = true;
      onLoad?.(material);
      return true;
    }).catch((e) => { console.warn(`Texture ${id} failed`, e); return false; });
  }
}

/** Version tag of the media folder: the shipped content hash (scripts/ship-media.mjs), else the build date. */
export function mediaVersion(manifest) { return encodeURIComponent(manifest.shipped?.version || manifest.generated || '0'); }

/**
 * Files that three.js loaders fetch from media/ by themselves (a glTF's .bin and textures,
 * the character models) get the same ?v= tag, through the default loading manager.
 */
function versionMediaUrls(base, v) {
  const prefix = new URL(`${base}media/`, location.href).href;
  THREE.DefaultLoadingManager.setURLModifier((url) => {
    if (url.includes('?') || /^(blob|data):/.test(url)) return url;
    return new URL(url, location.href).href.startsWith(prefix) ? `${url}?v=${v}` : url;
  });
}

const stand = new Map();
/**
 * 1×1 stand-in textures (shared): 'color' white (sRGB), 'normal' flat (128, 128, 255),
 * 'orm' no occlusion (red 255) with green = the roughness the material had, blue 0.
 * Plain RGBA like the transcoded KTX2 textures (a packed RG normal map would change the shader).
 */
function placeholder(kind, roughness = 1) {
  const g = Math.round(THREE.MathUtils.clamp(roughness, 0, 1) * 255);
  const key = kind === 'orm' ? `orm${g}` : kind;
  if (!stand.has(key)) {
    const px = { color: [255, 255, 255, 255], normal: [128, 128, 255, 255], [`orm${g}`]: [255, g, 0, 255] }[key];
    const t = new THREE.DataTexture(new Uint8Array(px), 1, 1, THREE.RGBAFormat);
    if (kind === 'color') t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.needsUpdate = true;
    stand.set(key, t);
  }
  return stand.get(key);
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
