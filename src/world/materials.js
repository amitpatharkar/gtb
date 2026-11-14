import * as THREE from 'three';
import { addMacroVariation } from './textures.js';
import { makeFacadeMaterial, makeSignAtlas } from './facade.js';
import { makeHoardingAtlas, makeHoardingMaterial } from './hoardings.js';
import { addNightLight } from './nightLights.js';

// Materials for tile meshes, keyed like the worker's mesh keys. Each starts with a flat
// colour and switches to a real photo-scanned texture set when it has loaded.

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
const seeded = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
function canvasTexture(c, { srgb = true, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  return t;
}

/** Kerb paint: alternating black and yellow, 0.6 m each, a bit dirty. u = metres along the kerb. */
function kerbTexture() {
  const [c, g] = canvas(128, 64);
  const rnd = seeded(5);
  g.fillStyle = '#1b1b1b'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#e8b800'; g.fillRect(64, 0, 64, 64);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(${rnd() < 0.5 ? '40,35,30' : '200,190,170'},${rnd() * 0.25})`;
    g.fillRect(rnd() * 128, rnd() * 64, 1 + rnd() * 3, 1 + rnd() * 3);
  }
  const t = canvasTexture(c);
  t.repeat.set(1 / 1.2, 4);
  return t;
}

/** Speckled alpha for worn road paint. */
function wornPaint() {
  const [c, g] = canvas(256, 256);
  const rnd = seeded(9);
  g.fillStyle = '#e0e0e0'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const v = Math.floor(rnd() * 140);
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.beginPath(); g.arc(rnd() * 256, rnd() * 256, 0.5 + rnd() * 3.5, 0, 7); g.fill();
  }
  const t = canvasTexture(c, { srgb: false });
  t.repeat.set(1 / 3, 1 / 3);
  return t;
}

/** Ballast with one concrete sleeper; v repeats every 0.65 m along the track. */
function sleeperTexture() {
  const [c, g] = canvas(64, 64);
  const rnd = seeded(11);
  g.fillStyle = '#8a8070'; g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 600; i++) {
    const v = 90 + rnd() * 90;
    g.fillStyle = `rgb(${v},${v - 8},${v - 20})`;
    g.fillRect(rnd() * 64, rnd() * 64, 2, 2);
  }
  g.fillStyle = '#b4afa6'; g.fillRect(8, 22, 48, 20);
  return canvasTexture(c);
}

// Wall texture for each building style (see src/world/mesh/buildings.js STYLES).
const WALL_TEXTURES = [
  ['tex-ph-painted-plaster-wall', 2.2], ['tex-ph-peeling-painted-wall', 2.4], ['tex-ph-beige-wall-001', 3],
  ['tex-ph-sandstone-blocks-08', 3], ['tex-ph-stone-block-wall', 2.4], ['tex-ph-concrete-wall-008', 2.7],
  ['tex-ph-concrete-tile-facade', 2.1], ['tex-ph-rusty-corrugated-iron', 2], ['tex-ph-red-brick', 1.4],
];

export function createMaterials(renderer, lib, tier) {
  const std = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, ...o });
  const tex = (mat, id, size, opts = {}) => { lib.apply(mat, id, { size, ...opts }); return mat; };
  const offset = (mat, f) => Object.assign(mat, { polygonOffset: true, polygonOffsetFactor: f, polygonOffsetUnits: f * 2 });

  const signs = makeSignAtlas();
  const m = {
    // Road quality: smooth dark asphalt on main roads, worn and patched tertiary roads,
    // broken rough lanes (drawn over the main surface with a small depth offset).
    road: addMacroVariation(tex(std({ color: 0x4a4a4e, roughness: 0.85 }), 'tex-acg-asphalt025c', 2.6, { normalScale: 0.3, onLoad: (x) => x.color.set(0x7c7c80) }), { scale: 1 / 45, strength: 0.14 }),
    roadWorn: offset(addMacroVariation(tex(std({ color: 0x55555a }), 'tex-ph-asphalt-02', 3.2, { normalScale: 0.75, onLoad: (x) => x.color.set(0x9a9a9e) }), { scale: 1 / 30, strength: 0.3 }), -1),
    roadPoor: offset(addMacroVariation(tex(std({ color: 0x5a5a5c }), 'tex-ph-asphalt-02', 2.2, { normalScale: 1.0, onLoad: (x) => x.color.set(0x8a8884) }), { scale: 1 / 9, strength: 0.42 }), -1), // grey, patchy, broken asphalt (the "damaged road" texture read as red mud)
    footpath: addMacroVariation(tex(std({ color: 0x8f8c86 }), 'tex-ph-patterned-concrete-pavers', 1.8, { onLoad: (x) => x.color.set(0xd8d4cc) }), { strength: 0.25 }),
    plot: addMacroVariation(tex(std({ color: 0xa39c8e }), 'tex-ph-dirty-concrete', 3.0, { onLoad: (x) => x.color.set(0xe0d8c8) }), { strength: 0.3 }),
    paved: addMacroVariation(tex(std({ color: 0xb3ab9e }), 'tex-ph-concrete-pavement', 2.4, { onLoad: (x) => x.color.set(0xe8e2d8) })),
    grass: addMacroVariation(tex(std({ color: 0x6c9a46 }), 'tex-ph-grass-path-2', 1.6, { onLoad: (x) => x.color.set(0xd8e6c0) }), { scale: 1 / 30, strength: 0.35 }),
    wood: addMacroVariation(tex(std({ color: 0x4b7838 }), 'tex-acg-grass004', 1.5, { onLoad: (x) => x.color.set(0xa8c090) }), { strength: 0.3 }),
    pitch: offset(addMacroVariation(tex(std({ color: 0x8fae5a }), 'tex-ph-grass-path-2', 2.2, { onLoad: (x) => x.color.set(0xe6e0b0) }), { strength: 0.3 }), -1),
    sand: addMacroVariation(tex(std({ color: 0xd8c491 }), 'tex-ph-coast-sand-01', 6, { onLoad: (x) => x.color.set(0xf0e6d0) })),
    dirt: addMacroVariation(tex(std({ color: 0xa48b68 }), 'tex-ph-brown-mud-dry', 2.2, { onLoad: (x) => x.color.set(0xe8dcc8) })),
    railyard: tex(std({ color: 0x8c8478 }), 'tex-ph-gravel-floor-02', 2.0, { onLoad: (x) => x.color.set(0xd0c8bc) }),
    pier: tex(std({ color: 0x9a948a }), 'tex-ph-concrete-pavement', 2.4, { onLoad: (x) => x.color.set(0xcfc8bc) }),
    pool: std({ color: 0x4fb3cf, roughness: 0.05 }),
    footway: offset(tex(std({ color: 0xa8a196 }), 'tex-ph-patterned-paving', 2, { onLoad: (x) => x.color.set(0xe0dbd2) }), -1),
    kerb: std({ map: kerbTexture(), roughness: 0.85 }),
    // Lanes and side streets: plain weathered concrete kerbs (paint is for main roads).
    kerbPlain: tex(std({ color: 0x8e8a84, roughness: 0.9 }), 'tex-ph-concrete-pavement', 1.5, { onLoad: (x) => x.color.set(0xb4aea6) }),
    seawall: tex(std({ color: 0x8a847a }), 'tex-ph-castle-brick-07', 2.5, { onLoad: (x) => x.color.set(0xb0aaa0) }),
    parapet: tex(std({ color: 0xb8b2a8 }), 'tex-ph-concrete-pavement', 1.8, { onLoad: (x) => x.color.set(0xe8e2d8) }),
    paint: offset(addMacroVariation(std({ color: 0xe9e7e0, roughness: 0.6, transparent: true, depthWrite: false, alphaMap: wornPaint() })), -2),
    railBed: offset(std({ map: sleeperTexture() }), -0.5),
    railSteel: std({ color: 0xa6abb0, metalness: 0.85, roughness: 0.3 }),
    roof: addMacroVariation(tex(std({ color: 0x9a948c }), 'tex-ph-dirty-concrete', 3, { onLoad: (x) => x.color.set(0xd8d2c8) }), { scale: 1 / 12, strength: 0.3 }),
    roofTarp: tex(std({ color: 0x3d6ea8, roughness: 0.6 }), 'tex-texturecan-plastic-0019', 2.5, { onLoad: (x) => x.color.set(0xffffff) }),
    roofRust: tex(std({ color: 0x8a5a44 }), 'tex-ph-rusty-corrugated-iron', 2, { onLoad: (x) => x.color.set(0xffffff) }),
    tank: new THREE.MeshStandardMaterial({ color: 0x1d1d1f, roughness: 0.55 }),
    walls: WALL_TEXTURES.map(([id, size]) => {
      const w = makeFacadeMaterial(signs.texture);
      lib.apply(w, id, { size, normalScale: 0.9, aoIntensity: 0.5 });
      return w;
    }),
  };
  // Street lamps and headlights light the ground and the walls at night (nightLights.js).
  for (const k of ['road', 'roadWorn', 'roadPoor', 'footpath', 'plot', 'paved', 'grass', 'wood', 'pitch', 'sand', 'dirt', 'railyard', 'pier', 'footway', 'kerb', 'kerbPlain', 'seawall', 'parapet', 'paint']) if (m[k]) addNightLight(m[k]);
  for (const w of m.walls) addNightLight(w);
  // Rooftop hoardings share the sign fonts: redrawing the shop signs redraws the ads too.
  const ads = makeHoardingAtlas();
  m.hoarding = makeHoardingMaterial(ads.texture);
  const redrawSigns = signs.redraw;
  signs.redraw = (families) => { redrawSigns(families); ads.redraw(families); };
  m.signs = signs;
  return m;
}
