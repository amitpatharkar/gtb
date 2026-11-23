// Materials: real photo-scanned textures (Poly Haven / ambientCG, KTX2 from media/) with
// physically based shading, written in TSL (Three.js Shading Language) for the WebGPU renderer.
// Texture coordinates are metres everywhere, so each texture is scaled by its real-world size.
import * as THREE from 'three/webgpu';
import {
  texture, uv, vec2, vec3, float, attribute, vertexColor, positionWorld, normalMap, normalView, mix, step,
  fract, floor, mod, hash, mx_noise_float, smoothstep, max, min, sin, time, transformNormalToView,
} from 'three/tsl';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

const BASE = import.meta.env.BASE_URL;

// Texture set per use. The ids must appear literally here: scripts/ship-media.mjs ships only
// the media ids named in src/.
export const TEX = {
  road: 'tex-ph-asphalt-02', roadWorn: 'tex-ph-asphalt-03', roadPoor: 'tex-ph-road-damaged',
  footpath: 'tex-ph-patterned-paving', footway: 'tex-acg-pavingstones152', plot: 'tex-ph-dirty-concrete',
  paved: 'tex-ph-concrete-pavement', grass: 'tex-acg-grass004', pitch: 'tex-ph-grass-path-2',
  sand: 'tex-ph-coast-sand-01', dirt: 'tex-ph-brown-mud-dry', gravel: 'tex-ph-gravel-floor-02',
  kerb: 'tex-ph-concrete-wall-008', stone: 'tex-ph-stone-block-wall',
  plaster: 'tex-ph-painted-plaster-wall', peeling: 'tex-ph-peeling-painted-wall', plastered: 'tex-ph-plastered-wall-02',
  sandstone: 'tex-ph-sandstone-blocks-08', tileFacade: 'tex-ph-concrete-tile-facade', corrugated: 'tex-ph-rusty-corrugated-iron',
  brick: 'tex-ph-red-brick', shutter: 'tex-ph-painted-metal-shutter',
};

export class TextureLibrary {
  constructor(renderer) {
    this.loader = new KTX2Loader().setTranscoderPath(`${BASE}basis/`).detectSupport(renderer);
    this.sets = new Map();
  }
  async init(onProgress) {
    const manifest = await fetch(`${BASE}media/manifest.json`, { cache: 'no-cache' }).then((r) => r.json());
    this.version = manifest.shipped?.version || manifest.generated || '';
    const meta = new Map(manifest.assets.map((a) => [a.id, a]));
    const ids = [...new Set(Object.values(TEX))];
    let done = 0;
    const total = ids.length * 3;
    const load = (id, file, srgb) => this.loader.loadAsync(`${BASE}media/textures/${id}/${file}.ktx2?v=${encodeURIComponent(this.version)}`).then((t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 8;
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      onProgress?.(++done / total);
      return t;
    });
    await Promise.all(ids.map(async (id) => {
      const [color, normal, orm] = await Promise.all([load(id, 'color', true), load(id, 'normal', false), load(id, 'orm', false)]);
      this.sets.set(id, { color, normal, orm, metres: meta.get(id)?.meta?.metres?.[0] || 2 });
    }));
  }
  get(key) { return this.sets.get(TEX[key] || key); }
}

/** Large-scale brightness variation in world space: breaks up visible texture repeats. */
const macro = (scale = 0.03, amount = 0.16) => mx_noise_float(positionWorld.xz.mul(scale)).mul(amount).add(1);

/** A ground or wall surface from one texture set. */
function surface(set, { tint = vec3(1), rough = 1, normalScale = 1, variation = 0.16, metresScale = 1, offset = false, sat = 1 } = {}) {
  const tuv = uv().div(set.metres * metresScale);
  const orm = texture(set.orm, tuv);
  const m = new THREE.MeshStandardNodeMaterial();
  let col = texture(set.color, tuv).rgb;
  if (sat !== 1) col = mix(vec3(col.dot(vec3(0.2126, 0.7152, 0.0722))), col, sat);
  m.colorNode = col.mul(vertexColor()).mul(tint).mul(macro(0.03, variation));
  m.normalNode = normalMap(texture(set.normal, tuv), vec2(normalScale));
  m.roughnessNode = orm.g.mul(rough).clamp(0.04, 1);
  m.metalnessNode = float(0);
  m.aoNode = orm.r;
  if (offset) { m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -2; }
  return m;
}

/** Kerb stones: painted in 1 m blocks (black-yellow, black-white) or plain concrete. */
function kerb(set, a, b) {
  const m = surface(set, { variation: 0.08 });
  if (a) {
    const stripe = step(0.5, fract(uv().x.div(1.0)));
    const paint = mix(vec3(...a), vec3(...b), stripe);
    m.colorNode = paint.mul(texture(set.color, uv().div(set.metres)).rgb.mul(0.5).add(0.6));
    m.roughnessNode = float(0.75);
  }
  return m;
}

/**
 * Building facade: the wall texture tinted by the building's colour, with storeys, window bays,
 * frames, glass that reflects the sky, curtains and ground-floor shop shutters, all laid out in
 * metres from the per-vertex `facade` attribute [seed, storey height, flags, bay width]
 * (src/world/mesh/blocks.js).
 */
function facade(set, shutterSet, { tintAmount = 1, glassWall = false } = {}) {
  const F = attribute('facade', 'vec4');
  const seed = F.x, storey = F.y, flags = F.z, bayW = F.w;
  const shops = mod(flags, 2), blank = mod(floor(flags.div(2)), 2);
  const u = uv().x, v = uv().y;
  const level = floor(v.div(storey)), fy = fract(v.div(storey));
  const bay = floor(u.div(bayW)), fx = fract(u.div(bayW));
  const h = hash(seed.mul(9173).add(bay.mul(31.7)).add(level.mul(7.31)));
  const hBay = hash(seed.mul(5113).add(bay.mul(17.3)));

  const tuv = uv().div(set.metres);
  const orm = texture(set.orm, tuv);
  const tint = mix(vec3(1), vertexColor(), tintAmount);
  let wallCol = texture(set.color, tuv).rgb.mul(tint).mul(macro(0.05, 0.12));
  // Monsoon streaks under each window and grime near the street.
  const streak = smoothstep(0.25, 0.0, fy).mul(step(0.22, fx)).mul(step(fx, 0.78)).mul(0.18);
  const grime = smoothstep(2.2, 0.0, v).mul(0.25);
  wallCol = wallCol.mul(float(1).sub(streak).sub(grime));

  // Window opening (upper floors) and its frame.
  const wx = step(0.24, fx).mul(step(fx, 0.76)), wy = step(0.28, fy).mul(step(fy, 0.84));
  const fxo = step(0.2, fx).mul(step(fx, 0.8)), fyo = step(0.24, fy).mul(step(fy, 0.88));
  const upper = step(1, level).mul(float(1).sub(blank)).mul(step(0.1, hBay)); // some bays are blank wall
  const win = glassWall ? float(1).sub(blank) : wx.mul(wy).mul(upper);
  const frame = glassWall ? float(0) : fxo.mul(fyo).mul(upper).sub(win).max(0);
  // Glass: dark, reflective; some with curtains or half-closed shutters behind.
  const curtain = step(0.55, h).mul(smoothstep(0.84, 0.5, fy).add(0.3).min(1));
  const curtainCol = mix(vec3(0.55, 0.45, 0.32), vec3(0.75, 0.72, 0.62), hash(h.mul(13)));
  const glassCol = mix(vec3(0.03, 0.04, 0.05), curtainCol.mul(0.35), curtain);
  // Sunshade shadow at the top of each window.
  const shade = smoothstep(0.84, 0.66, fy).mul(0.6).add(0.4);
  // Glass curtain walls: mullions every bay and storey.
  const mullion = glassWall ? max(step(fx, 0.04), step(fy, 0.05)) : float(0);

  // Ground floor: shops with rolling shutters (some open, showing a lit shop inside).
  const groundFloor = float(1).sub(step(1, level)).mul(shops);
  const sx = step(0.06, fx).mul(step(fx, 0.94)), sy = step(0.25, v).mul(step(v, storey.sub(0.6)));
  const shopMask = groundFloor.mul(sx).mul(sy);
  const open = step(0.45, h);
  const shutterUv = vec2(u.div(1.6), v.div(1.6));
  const shutterCol = texture(shutterSet.color, shutterUv).rgb.mul(mix(vec3(0.55, 0.6, 0.65), vec3(0.35, 0.5, 0.45), hBay));
  const shopInside = mix(vec3(0.35, 0.3, 0.22), vec3(0.55, 0.5, 0.42), hash(h.mul(7))).mul(0.6);
  const shopCol = mix(shutterCol, shopInside, open);
  const signBand = groundFloor.mul(step(storey.sub(0.55), v)).mul(step(v, storey.sub(0.05))).mul(step(0.3, hBay));
  const signCol = mix(vec3(0.75, 0.12, 0.08), vec3(0.08, 0.2, 0.55), step(0.6, hash(hBay.mul(3)))).mul(0.8);

  let col = mix(wallCol, vec3(0.78, 0.76, 0.72).mul(tint.mul(0.3).add(0.7)), frame);
  col = mix(col, glassCol.mul(shade), win);
  col = mix(col, vec3(0.12), mullion.mul(win));
  col = mix(col, shopCol, shopMask);
  col = mix(col, signCol, signBand);

  const m = new THREE.MeshStandardNodeMaterial();
  m.colorNode = col;
  const glassy = win.mul(float(1).sub(mullion)).mul(float(1).sub(curtain.mul(0.6)));
  m.roughnessNode = mix(orm.g, float(0.06), glassy).sub(shopMask.mul(open.oneMinus()).mul(0.2)).clamp(0.04, 1);
  m.metalnessNode = mix(float(0), float(0.6), shopMask.mul(open.oneMinus()).mul(0.5));
  m.normalNode = mix(normalMap(texture(set.normal, tuv)), normalView, max(win, shopMask)).normalize();
  // Recessed look: windows and shop openings sit in shadow.
  m.aoNode = mix(orm.r, float(0.55), max(win.mul(0.6), shopMask.mul(open)));
  return m;
}

/** Sea: dark water with moving ripples (analytic wave normals) that mirror the sky. */
function sea() {
  const p = positionWorld.xz, t = time;
  const dx = sin(p.x.mul(0.21).add(t.mul(1.3))).mul(0.21 * 0.5).add(sin(p.x.add(p.y).mul(0.37).add(t.mul(2.1))).mul(0.37 * 0.25));
  const dz = sin(p.y.mul(0.17).sub(t.mul(1.1))).mul(0.17 * 0.5).add(sin(p.x.add(p.y).mul(0.37).add(t.mul(2.1))).mul(0.37 * 0.25));
  const fine = mx_noise_float(vec3(p.mul(0.9), t.mul(0.6))).mul(0.15);
  const n = vec3(dx.mul(-0.6).add(fine), 1, dz.mul(-0.6).sub(fine)).normalize();
  const m = new THREE.MeshStandardNodeMaterial();
  m.colorNode = vec3(0.02, 0.06, 0.065);
  m.roughnessNode = float(0.06);
  m.metalnessNode = float(0);
  m.normalNode = transformNormalToView(n);
  return m;
}

export function createMaterials(lib) {
  const g = (k, o) => surface(lib.get(k), o);
  const M = {
    // Mumbai asphalt is a dusty dark grey: the scans are desaturated and darkened a little.
    road: g('road', { rough: 1.05, variation: 0.22, sat: 0.3, tint: vec3(0.8) }),
    roadWorn: g('roadWorn', { variation: 0.22, offset: true, sat: 0.35, tint: vec3(0.85) }),
    roadPoor: g('roadPoor', { variation: 0.22, offset: true, sat: 0.4, tint: vec3(0.85) }),
    footpath: g('footpath', { variation: 0.14 }),
    footway: g('footway', { offset: true }),
    plot: g('plot'),
    paved: g('paved'),
    grass: g('grass', { variation: 0.25 }),
    wood: g('grass', { tint: vec3(0.8, 0.9, 0.75), variation: 0.3 }),
    pitch: g('pitch'),
    sand: g('sand'),
    dirt: g('dirt'),
    railyard: g('gravel'),
    railBed: g('gravel'),
    pier: g('paved'),
    pool: g('paved', { tint: vec3(0.6, 0.8, 0.9) }),
    seawall: g('stone', { tint: vec3(0.55, 0.55, 0.52) }),
    parapet: g('kerb'),
    kerb: kerb(lib.get('kerb'), [0.02, 0.02, 0.02], [0.85, 0.65, 0.05]),
    kerbBW: kerb(lib.get('kerb'), [0.02, 0.02, 0.02], [0.8, 0.8, 0.78]),
    kerbPlain: kerb(lib.get('kerb')),
    roof: g('plot', { variation: 0.25 }),
    wall: g('plastered', { variation: 0.1 }),
    sea: sea(),
  };
  const paint = new THREE.MeshStandardNodeMaterial();
  paint.colorNode = vec3(0.82, 0.82, 0.78).mul(mx_noise_float(positionWorld.xz.mul(1.7)).mul(0.25).add(0.85));
  paint.roughnessNode = float(0.65);
  paint.polygonOffset = true; paint.polygonOffsetFactor = -2; paint.polygonOffsetUnits = -4;
  M.paint = paint;
  const steel = new THREE.MeshStandardNodeMaterial({ color: 0x8a8a88, roughness: 0.35, metalness: 0.9 });
  M.railSteel = steel;
  // Walls by building style (blocks.js STYLES).
  const sh = lib.get('shutter');
  M.walls = [
    facade(lib.get('plaster'), sh),
    facade(lib.get('peeling'), sh),
    facade(lib.get('plastered'), sh),
    facade(lib.get('sandstone'), sh, { tintAmount: 0.35 }),
    facade(lib.get('stone'), sh, { tintAmount: 0.2 }),
    facade(lib.get('kerb'), sh, { tintAmount: 0.6 }),
    facade(lib.get('tileFacade'), sh, { tintAmount: 0.4, glassWall: true }),
    facade(lib.get('corrugated'), sh, { tintAmount: 0.5 }),
    facade(lib.get('brick'), sh, { tintAmount: 0.15 }),
  ];
  return M;
}
