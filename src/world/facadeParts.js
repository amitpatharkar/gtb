import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PART_FLOATS, FRAME, SHUTTER, ARCHV, ARCH_SPRING } from './facadeRules.js';

// Real 3D facade parts around the player: window frames (plain casements, aluminium sliders,
// wooden casements with glazing bars, Art Deco steel windows), wooden louvred shutters (shut,
// folded open, one leaf open), stone arch surrounds (Gothic pointed, round), sills, sunshades
// (chajjas), grilles and box grilles, enclosed balconies (aluminium and glass), AC units,
// balconies with railings, clothes on lines (balconies and chawl galleries), shop signboards,
// shutter boxes and drain pipes. Positions come from the tile worker (same rules as the facade
// shader, facadeRules.js). Every part type is one instanced mesh for the whole city; variants of
// a type share one geometry and an instance attribute hides the other variants' triangles.
// Only parts within a radius of the player are drawn, refreshed as the player moves.

const CAP = { frame: 16000, shutter: 5000, arch: 4000, sill: 16000, chajja: 13000, grille: 8000, ac: 5000, balcony: 4000, enclosed: 2500, clothes: 6000, sign: 2500, shutterBox: 2500, pipe: 3000 };
const WHITE = new THREE.Color(1, 1, 1);

function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/**
 * Geometry built from boxes and quads, each tagged with a variant (aVar; -1 = every variant)
 * and an anchor (aEnd: 0 scales with the instance's height, 1 hangs from its top, -1 sits on
 * its bottom; used by the drain pipes). UVs default to the white corner of the parts atlas.
 */
class Kit {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.v = []; this.e = []; this.i = []; }
  quad(pts, nrm, variant = -1, uvs = null, col = [1, 1, 1], end = 0) {
    const s = this.p.length / 3;
    pts.forEach((pt, k) => {
      this.p.push(...pt); this.n.push(...nrm); this.uv.push(...(uvs ? uvs[k] : [0.1, 0.5]));
      this.c.push(...col); this.v.push(variant); this.e.push(end);
    });
    // Wind so the front faces along the normal.
    const [a, b, c] = pts;
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    if (cr[0] * nrm[0] + cr[1] * nrm[1] + cr[2] * nrm[2] >= 0) this.i.push(s, s + 1, s + 2, s, s + 2, s + 3);
    else this.i.push(s, s + 2, s + 1, s, s + 3, s + 2);
  }
  /** Box [x0,x1]×[y0,y1]×[z0,z1]; faces: f front (+z), b back, l/r sides, t top, d bottom. */
  box(x0, x1, y0, y1, z0, z1, variant = -1, { faces = 'flrtd', col, uvFront, end = 0 } = {}) {
    if (faces.includes('f')) this.quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], variant, uvFront, col, end);
    if (faces.includes('b')) this.quad([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], [0, 0, -1], variant, null, col, end);
    if (faces.includes('l')) this.quad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], variant, null, col, end);
    if (faces.includes('r')) this.quad([[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], [1, 0, 0], variant, null, col, end);
    if (faces.includes('t')) this.quad([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [0, 1, 0], variant, null, col, end);
    if (faces.includes('d')) this.quad([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], variant, null, col, end);
  }
  /** Window frame ring around the unit opening (border b, depth d): front faces + inner reveals. */
  ring(b, d, variant) {
    const o = 0.5, i = 0.5 - b;
    this.box(-o, o, -o, -i, 0, d, variant, { faces: 'ft' });
    this.box(-o, o, i, o, 0, d, variant, { faces: 'fd' });
    this.box(-o, -i, -i, i, 0, d, variant, { faces: 'fr' });
    this.box(i, o, -i, i, 0, d, variant, { faces: 'fl' });
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('aVar', new THREE.Float32BufferAttribute(this.v, 1));
    g.setAttribute('aEnd', new THREE.Float32BufferAttribute(this.e, 1));
    g.setIndex(this.i);
    return g;
  }
}

/** Frames: plain casement with a mullion, aluminium slider, wooden casement, Art Deco steel. */
function frameGeometry() {
  const k = new Kit();
  k.ring(0.07, 0.06, FRAME.PLAIN);
  k.box(-0.015, 0.015, -0.43, 0.43, 0, 0.045, FRAME.PLAIN, { faces: 'flr' });
  k.ring(0.045, 0.05, FRAME.SLIDER);
  k.box(-0.028, 0.028, -0.455, 0.455, 0, 0.04, FRAME.SLIDER, { faces: 'flr' });          // meeting stiles
  k.box(-0.455, 0.455, -0.455, -0.43, 0, 0.03, FRAME.SLIDER, { faces: 'ft' });          // bottom track
  k.ring(0.06, 0.06, FRAME.CASEMENT);
  k.box(-0.44, 0.44, 0.2, 0.245, 0, 0.045, FRAME.CASEMENT, { faces: 'ftd' });           // transom
  k.box(-0.018, 0.018, -0.44, 0.2, 0, 0.045, FRAME.CASEMENT, { faces: 'flr' });         // meeting stiles
  for (const y of [-0.17, 0.02]) k.box(-0.44, 0.44, y - 0.01, y + 0.01, 0, 0.025, FRAME.CASEMENT, { faces: 'ft' });
  for (const x of [-0.22, 0.22]) k.box(x - 0.01, x + 0.01, -0.44, 0.2, 0, 0.025, FRAME.CASEMENT, { faces: 'f' });
  for (const x of [-0.15, 0.15]) k.box(x - 0.01, x + 0.01, 0.245, 0.44, 0, 0.025, FRAME.CASEMENT, { faces: 'f' });
  k.ring(0.035, 0.04, FRAME.DECO);
  for (const y of [-0.22, 0.02, 0.24]) k.box(-0.465, 0.465, y - 0.008, y + 0.008, 0, 0.03, FRAME.DECO, { faces: 'ft' });
  for (const x of [-0.167, 0.167]) k.box(x - 0.008, x + 0.008, -0.465, 0.465, 0, 0.03, FRAME.DECO, { faces: 'f' });
  return k.geometry();
}

/** Wooden louvred shutters: a frame plus two leaves, shut in the opening or folded flat on the wall. */
function shutterGeometry() {
  const k = new Kit();
  k.ring(0.05, 0.05, -1);
  const slats = [[0.52, 0], [0.98, 0], [0.98, 1], [0.52, 1]]; // right half of the parts atlas
  const leaf = (x0, x1, variant, z0 = 0.005) => k.box(x0, x1, -0.45, 0.45, z0, z0 + 0.035, variant, { faces: 'flrtd', uvFront: slats });
  leaf(-0.45, 0, SHUTTER.SHUT); leaf(0, 0.45, SHUTTER.SHUT);
  leaf(-0.94, -0.5, SHUTTER.OPEN); leaf(0.5, 0.94, SHUTTER.OPEN);
  leaf(-0.45, 0, SHUTTER.HALF); leaf(0.5, 0.94, SHUTTER.HALF);
  return k.geometry();
}

/** Outline of an arched opening in the unit square (x, y in -0.5..0.5), from the left foot round to the right foot. */
export function archOutline(pointed, segs = 8) {
  const s = ARCH_SPRING, pts = [[0, 0], [0, s]];
  if (pointed) {
    const kk = (1 - s) / 0.866;
    for (let i = 1; i <= segs; i++) { const t = Math.PI - (Math.PI / 3) * (i / segs); pts.push([1 + Math.cos(t), s + kk * Math.sin(t)]); }
    for (let i = 1; i <= segs; i++) { const t = (Math.PI / 3) * (1 - i / segs); pts.push([Math.cos(t), s + kk * Math.sin(t)]); }
  } else {
    for (let i = 1; i <= segs * 2; i++) { const t = Math.PI * (1 - i / (segs * 2)); pts.push([0.5 + 0.5 * Math.cos(t), s + (1 - s) * Math.sin(t)]); }
  }
  pts.push([1, 0]);
  return pts.map(([x, y]) => [x - 0.5, y - 0.5]);
}

/** Stone surround of an arched window (hood moulding): a band outside the opening's outline plus its reveal. */
function archGeometry() {
  const k = new Kit();
  for (const [variant, pointed] of [[ARCHV.POINTED, true], [ARCHV.ROUND, false]]) {
    const pts = archOutline(pointed), b = 0.07, d = 0.07;
    const off = pts.map((p, i) => {
      const a = pts[Math.max(0, i - 1)], c = pts[Math.min(pts.length - 1, i + 1)];
      let nx = c[1] - a[1], ny = -(c[0] - a[0]);
      const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      // Outward: away from the opening's centre.
      if (nx * p[0] + ny * (p[1] + 0.2) < 0) { nx = -nx; ny = -ny; }
      return [p[0] + nx * b, p[1] + ny * b];
    });
    for (let i = 0; i + 1 < pts.length; i++) {
      const [a, c] = [pts[i], pts[i + 1]], [ao, co] = [off[i], off[i + 1]];
      k.quad([[a[0], a[1], d], [c[0], c[1], d], [co[0], co[1], d], [ao[0], ao[1], d]], [0, 0, 1], variant);
      let nx = -(c[1] - a[1]), ny = c[0] - a[0];
      const l = Math.hypot(nx, ny) || 1;
      if (nx * a[0] + ny * (a[1] + 0.2) > 0) { nx = -nx; ny = -ny; }
      k.quad([[a[0], a[1], 0], [c[0], c[1], 0], [c[0], c[1], d], [a[0], a[1], d]], [nx / l, ny / l, 0], variant);
    }
  }
  return k.geometry();
}

/** Enclosed balcony (unit: x ±0.5, y 0..1, z 0..1 out from the wall): slab, solid lower panel, sliding glass, canopy. */
function enclosedGeometry() {
  const k = new Kit();
  const GLASS = [0.1, 0.14, 0.15], PANEL = [0.92, 0.9, 0.86], FRAMEC = [1, 1, 1], SLAB = [0.8, 0.78, 0.74];
  k.box(-0.52, 0.52, -0.04, 0.03, 0, 1.02, -1, { col: SLAB, faces: 'flrtd' });
  k.box(-0.5, 0.5, 0.03, 0.32, 0.97, 1, -1, { col: PANEL, faces: 'f' });
  for (const s of [-1, 1]) k.quad([[0.5 * s, 0.03, 0], [0.5 * s, 0.03, 1], [0.5 * s, 0.32, 1], [0.5 * s, 0.32, 0]], [s, 0, 0], -1, null, PANEL);
  // Glass front in three panes and glass sides, aluminium frames.
  k.quad([[-0.5, 0.32, 1], [0.5, 0.32, 1], [0.5, 0.96, 1], [-0.5, 0.96, 1]], [0, 0, 1], -1, null, GLASS);
  for (const s of [-1, 1]) k.quad([[0.5 * s, 0.32, 0], [0.5 * s, 0.32, 1], [0.5 * s, 0.96, 1], [0.5 * s, 0.96, 0]], [s, 0, 0], -1, null, GLASS);
  for (const x of [-0.5, -0.17, 0.17, 0.5]) k.box(x - 0.018, x + 0.018, 0.32, 0.96, 0.99, 1.02, -1, { col: FRAMEC, faces: 'flr' });
  for (const y of [0.32, 0.96]) k.box(-0.5, 0.5, y - 0.02, y + 0.02, 0.99, 1.02, -1, { col: FRAMEC, faces: 'ftd' });
  for (const s of [-1, 1]) k.box(0.5 * s - 0.02, 0.5 * s + 0.02, 0.32, 0.96, 0.4, 0.44, -1, { col: FRAMEC, faces: 'flr' });
  k.box(-0.56, 0.56, 0.96, 1.03, 0, 1.08, -1, { col: SLAB, faces: 'ftdlr' });
  return k.geometry();
}

/** Clothes on a line (unit width; y 0 = the line, hanging down). */
function clothesGeometry() {
  const k = new Kit();
  const COLS = [[0.75, 0.16, 0.12], [0.16, 0.42, 0.7], [0.92, 0.78, 0.2], [0.18, 0.6, 0.3], [0.95, 0.95, 0.92], [0.5, 0.22, 0.6], [0.9, 0.48, 0.15], [0.85, 0.35, 0.5]];
  k.box(-0.5, 0.5, -0.006, 0.006, -0.006, 0.006, -1, { col: [0.3, 0.3, 0.3], faces: 'fbtd' });
  for (let i = 0; i < 6; i++) {
    const x = -0.45 + i * 0.17 + (i % 2) * 0.02, w = 0.12 + (i % 3) * 0.02, hh = 0.42 + ((i * 7) % 4) * 0.1;
    k.quad([[x, -hh, 0], [x + w, -hh, 0], [x + w, 0, 0], [x, 0, 0]], [0, 0, 1], -1, null, COLS[(i * 3) % COLS.length]);
  }
  return k.geometry();
}

/**
 * Drain pipe, 10 cm (unit height; the axis 0.1 m off the wall). Top (anchored to the top):
 * variant 0 a rainwater head with its outlet into the wall, variant 1 a swan-neck bend back
 * into the parapet. Foot (anchored to the bottom): a shoe bending out over the drain; collars
 * at the joints every 2 m.
 */
function pipeGeometry() {
  const k = new Kit(), N = 6, r = 0.05;
  const tube = (y0, y1, end0, end1, variant = -1) => {
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2, am = (a0 + a1) / 2;
      const s = k.p.length / 3;
      k.quad([[Math.cos(a0) * r, y0, Math.sin(a0) * r], [Math.cos(a1) * r, y0, Math.sin(a1) * r], [Math.cos(a1) * r, y1, Math.sin(a1) * r], [Math.cos(a0) * r, y1, Math.sin(a0) * r]], [Math.cos(am), 0, Math.sin(am)], variant);
      k.e[s] = k.e[s + 1] = end0; k.e[s + 2] = k.e[s + 3] = end1;
    }
  };
  tube(0.13, -0.3, -1, 1, 0);       // body: from the shoe (bottom-anchored) to under the head (top-anchored)
  tube(0.13, -0.42, -1, 1, 1);      // body under the swan neck
  // Rainwater head with its outlet into the wall.
  k.box(-0.12, 0.12, -0.32, -0.06, -0.1, 0.12, 0, { end: 1 });
  k.box(-0.05, 0.05, -0.12, -0.02, -0.12, -0.1, 0, { end: 1, faces: 'ftd' });
  // Swan neck: up, a bend back to the wall, into the parapet.
  k.box(-0.05, 0.05, -0.42, -0.3, -0.05, 0.05, 1, { end: 1, faces: 'flr' });
  k.box(-0.05, 0.05, -0.32, -0.2, -0.1, 0.05, 1, { end: 1, faces: 'flrtd' });
  k.box(-0.05, 0.05, -0.22, -0.1, -0.12, -0.02, 1, { end: 1, faces: 'flrt' });
  // Collars at the joints (bottom-anchored, every 2 m up to 12 m; those above the pipe's top are dropped).
  for (let y = 2; y <= 12; y += 2) k.box(-0.062, 0.062, y, y + 0.06, -0.062, 0.062, -1, { end: -1, faces: 'flrtd' });
  // Shoe: bends out over the drain.
  k.box(-0.055, 0.055, 0, 0.13, -0.055, 0.2, -1, { end: -1, faces: 'flrtd' });
  return k.geometry();
}

/** Hide the triangles of other variants (instance attribute iVar vs vertex attribute aVar). */
function variants(mat, key) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (s, r) => {
    prev?.call(mat, s, r);
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute float aVar; attribute float iVar;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nif (aVar > -0.5 && abs(aVar - iVar) > 0.5) transformed = vec3(0.0);');
  };
  mat.customProgramCacheKey = () => key;
  return mat;
}

/** Drain pipes: parts anchored to the top or bottom keep their size whatever the pipe's length. */
const PIPE_VERTEX = `#include <begin_vertex>
  { float sy = length(instanceMatrix[1].xyz);
    if (aEnd > 0.5) transformed.y = 1.0 + transformed.y / sy;
    else if (aEnd < -0.5) transformed = transformed.y > sy - 0.5 ? vec3(0.0) : vec3(transformed.x, transformed.y / sy, transformed.z); }`;
function anchored(mat, key) {
  mat.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute float aEnd;').replace('#include <begin_vertex>', PIPE_VERTEX);
  };
  mat.customProgramCacheKey = () => key;
  return mat;
}

const box = (w, h, d, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

export class FacadeParts {
  constructor(scene, lib, signAtlas, tier) {
    this.scene = scene;
    this.radius = tier.partsRadius ?? 0;
    this.meshes = {};
    this.timer = 0;
    this.last = new THREE.Vector3(1e9, 0, 0);
    if (!this.radius) return;
    const plaster = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92 });
    lib.apply(plaster, 'tex-ph-painted-plaster-wall', { size: 1.2 });
    const bars = canvasTex(64, 64, (g) => {
      g.clearRect(0, 0, 64, 64);
      g.fillStyle = '#2a1d16';
      for (let x = 2; x < 64; x += 8) g.fillRect(x, 0, 2.5, 64);
      g.fillRect(0, 0, 64, 3); g.fillRect(0, 30, 64, 2); g.fillRect(0, 61, 64, 3);
    });
    // Parts atlas: left half plain white (frames, tinted per instance), right half louvre slats.
    const atlas = canvasTex(64, 128, (g) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 128);
      for (let y = 0; y < 128; y += 5.33) {
        const gr = g.createLinearGradient(0, y, 0, y + 5.33);
        gr.addColorStop(0, '#f4f4f4'); gr.addColorStop(0.7, '#b8b8b8'); gr.addColorStop(1, '#3a3a3a');
        g.fillStyle = gr; g.fillRect(33, y, 31, 5.33);
      }
      g.fillStyle = '#d8d8d8'; g.fillRect(32, 0, 2, 128); g.fillRect(62, 0, 2, 128);
    });
    atlas.wrapS = atlas.wrapT = THREE.ClampToEdgeWrapping;
    const paint = variants(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, map: atlas }), 'gtb-part-frame');
    const shutterMat = variants(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, map: atlas }), 'gtb-part-shutter');
    const archMat = variants(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), 'gtb-part-arch');
    const grilleMat = new THREE.MeshStandardMaterial({ map: bars, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.7, metalness: 0.4 });
    const railMat = new THREE.MeshStandardMaterial({ map: bars, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.5, color: 0x9a9a9a });
    const vents = canvasTex(64, 32, (g) => {
      g.fillStyle = '#d9d9d4'; g.fillRect(0, 0, 64, 32);
      g.fillStyle = '#8c8c88'; for (let y = 3; y < 30; y += 3) g.fillRect(4, y, 56, 1.2);
      g.fillStyle = '#6a6a66'; g.beginPath(); g.arc(46, 16, 11, 0, 7); g.fill();
    });
    const acMat = new THREE.MeshStandardMaterial({ map: vents, roughness: 0.5 });
    const vc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide });
    const glassMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.22, metalness: 0.35 });
    const pipeMat = variants(anchored(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.1 }), 'gtb-part-pipe'), 'gtb-part-pipe');
    const pipeDepth = variants(anchored(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), 'gtb-part-pipe-depth'), 'gtb-part-pipe-depth');
    const metal = new THREE.MeshStandardMaterial({ color: 0x5d6063, roughness: 0.5, metalness: 0.5 });

    // Grille cage (unit: ±0.5, ±0.5, depth 0.3 before the instance's depth scale): front, sides,
    // top in bars, and a solid ledge at the bottom (box grilles hold plants and buckets).
    const ledgeUV = [[0.5, 0.99], [0.5, 0.99], [0.5, 0.99], [0.5, 0.99]];
    const ledge = new THREE.PlaneGeometry(1, 0.3).rotateX(-Math.PI / 2).translate(0, -0.5, 0.15);
    ledge.setAttribute('uv', new THREE.Float32BufferAttribute(ledgeUV.flat(), 2));
    const cage = mergeGeometries([
      new THREE.PlaneGeometry(1, 1).translate(0, 0, 0.3),
      new THREE.PlaneGeometry(0.3, 1).rotateY(Math.PI / 2).translate(-0.5, 0, 0.15),
      new THREE.PlaneGeometry(0.3, 1).rotateY(Math.PI / 2).translate(0.5, 0, 0.15),
      new THREE.PlaneGeometry(1, 0.3).rotateX(-Math.PI / 2).translate(0, 0.5, 0.15),
      ledge,
    ]);
    // Balcony railing (bars texture).
    const rail = mergeGeometries([
      new THREE.PlaneGeometry(1, 1).translate(0, 0.55, 1.0),
      new THREE.PlaneGeometry(1.0, 1).rotateY(Math.PI / 2).translate(-0.5, 0.55, 0.5),
      new THREE.PlaneGeometry(1.0, 1).rotateY(Math.PI / 2).translate(0.5, 0.55, 0.5),
    ]);
    const ac = mergeGeometries([box(0.82, 0.55, 0.32, 0, 0, 0.16), box(0.05, 0.05, 0.45, -0.3, -0.3, 0.22), box(0.05, 0.05, 0.45, 0.3, -0.3, 0.22)]);
    const signFace = new THREE.PlaneGeometry(1, 1).translate(0, 0, 0.13);
    const signBack = box(1.02, 1.02, 0.11, 0, 0, 0.06);

    const signMat = new THREE.MeshStandardMaterial({ map: signAtlas, roughness: 0.45, emissive: 0xffffff, emissiveMap: signAtlas, emissiveIntensity: 0 });
    signMat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float signIdx;')
        .replace('#include <uv_vertex>', `#include <uv_vertex>
          vec2 cellXY = vec2(mod(signIdx, 8.0), floor(signIdx / 8.0));
          #ifdef USE_MAP
            vMapUv = (cellXY + uv) / vec2(8.0, 16.0);
          #endif
          #ifdef USE_EMISSIVEMAP
            vEmissiveMapUv = (cellXY + uv) / vec2(8.0, 16.0);
          #endif`);
    };
    signMat.customProgramCacheKey = () => 'gtb-signboard';
    this.signMat = signMat;

    const make = (geo, mat, cap, shadow, extraAttr, colour = false, depthMat = null) => {
      const m = new THREE.InstancedMesh(geo, mat, cap);
      m.count = 0;
      m.castShadow = shadow;
      m.receiveShadow = true;
      m.frustumCulled = false;
      if (depthMat) m.customDepthMaterial = depthMat;
      if (extraAttr) geo.setAttribute(extraAttr, new THREE.InstancedBufferAttribute(new Float32Array(cap), 1));
      if (colour) m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
      scene.add(m);
      return m;
    };
    this.meshes = {
      frame: [make(frameGeometry(), paint, CAP.frame, false, 'iVar', true)],
      shutter: [make(shutterGeometry(), shutterMat, CAP.shutter, false, 'iVar', true)],
      arch: [make(archGeometry(), archMat, CAP.arch, false, 'iVar', true)],
      sill: [make(box(1.12, 0.07, 0.16, 0, -0.035, 0.08), plaster, CAP.sill, false, null, true)],
      chajja: [make(box(1.3, 0.08, 0.55, 0, 0, 0.27), plaster, CAP.chajja, true, null, true)],
      grille: [make(cage, grilleMat, CAP.grille, true)],
      ac: [make(ac, acMat, CAP.ac, true)],
      balcony: [make(box(1, 0.16, 1.05, 0, -0.08, 0.52), plaster, CAP.balcony, true, null, true), make(rail, railMat, CAP.balcony, true)],
      enclosed: [make(enclosedGeometry(), glassMat, CAP.enclosed, true, null, true)],
      clothes: [make(clothesGeometry(), vc, CAP.clothes, true)],
      sign: [make(signFace, signMat, CAP.sign, false, 'signIdx'), make(signBack, metal, CAP.sign, true)],
      shutterBox: [make(box(1, 1, 0.3, 0, 0, 0.15), metal, CAP.shutterBox, true)],
      pipe: [make(pipeGeometry(), pipeMat, CAP.pipe, true, 'iVar', true, pipeDepth)],
    };
    this.types = Object.keys(this.meshes);
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.s = new THREE.Vector3(); this.p = new THREE.Vector3(); this.c = new THREE.Color();
  }

  /** Swap a part's simple geometry for a real model (parts from models.js, already in metres). */
  useModel(type, parts, fit) {
    const old = this.meshes[type];
    if (!old) return;
    const cap = old[0].instanceMatrix.count;
    this.meshes[type] = parts.map(({ geometry, material }) => {
      const g = geometry.clone();
      fit?.(g);
      const m = new THREE.InstancedMesh(g, material, cap);
      m.count = 0; m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
      this.scene.add(m);
      return m;
    });
    for (const m of old) this.scene.remove(m);
    this.version = -1; // rebuild instances next frame
  }

  update(dt, player, tiles, night = 0) {
    if (!this.radius) return;
    this.signMat.emissiveIntensity = night * 0.9;
    this.timer -= dt;
    const changed = this.version !== tiles.version; // tiles loaded or unloaded: refresh at once
    if (this.timer > 0 && !changed) return;
    if (this.last.distanceToSquared(player.pos) < 100 && !changed) return;
    this.timer = 0.5;
    this.last.copy(player.pos);
    this.version = tiles.version;
    this.rebuild(player.pos.x, player.pos.z, tiles);
  }

  rebuild(px, pz, tiles) {
    const R = this.radius, R2 = R * R, F = PART_FLOATS;
    const up = THREE.Object3D.DEFAULT_UP;
    for (const type of this.types) {
      const meshes = this.meshes[type];
      let n = 0;
      const cap = meshes[0].instanceMatrix.count;
      const signAttr = type === 'sign' ? meshes[0].geometry.attributes.signIdx : null;
      const varAttr = meshes[0].geometry.attributes.iVar || null;
      const tint = type === 'sill' || type === 'chajja' || type === 'balcony' ? 0.25 : 0;
      for (const t of tiles.tiles.values()) {
        const arr = t.facadeParts?.[type];
        if (!arr) continue;
        const [x0, z0, x1, z1] = t.clip;
        if (Math.max(x0 - px, 0, px - x1) > R + 60 || Math.max(z0 - pz, 0, pz - z1) > R + 60) continue;
        const ox = t.origin[0], oz = t.origin[1];
        for (let i = 0; i < arr.length && n < cap; i += F) {
          const x = arr[i] + ox, z = arr[i + 2] + oz;
          if ((x - px) ** 2 + (z - pz) ** 2 > R2) continue;
          const w = arr[i + 4], h = arr[i + 5], v = arr[i + 7];
          this.q.setFromAxisAngle(up, arr[i + 3]);
          switch (type) {
            case 'sill': case 'chajja': case 'balcony': this.s.set(w, 1, 1); break;
            case 'shutterBox': this.s.set(w, h, 1); break;
            case 'ac': this.s.set(1, 1, 1); break;
            case 'grille': this.s.set(w, h, v || 1); break;
            case 'enclosed': this.s.set(w, h, v || 0.75); break;
            case 'clothes': this.s.set((((i / F) | 0) % 2 ? -w : w), 1, 1); break;
            case 'pipe': this.s.set(1, h, 1); break;
            default: this.s.set(w, h, 1);
          }
          this.m.compose(this.p.set(x, arr[i + 1], z), this.q, this.s);
          for (const m of meshes) {
            m.setMatrixAt(n, this.m);
            if (m.instanceColor) m.setColorAt(n, this.c.setHex(arr[i + 6]).lerp(WHITE, tint));
          }
          if (signAttr) signAttr.array[n] = arr[i + 6];
          if (varAttr) varAttr.array[n] = v;
          n++;
        }
      }
      for (const m of meshes) {
        m.count = n;
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
      }
      if (signAttr) signAttr.needsUpdate = true;
      if (varAttr) varAttr.needsUpdate = true;
    }
  }
}
