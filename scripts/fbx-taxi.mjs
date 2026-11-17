// One-off converter: the owner's kaali-peeli taxi (FBX + baked photo texture, 555k triangles)
// → public/art/vehicles/padmini.glb, ready for scripts/art-vehicles.mjs.
//   node scripts/fbx-taxi.mjs <model.fbx> <texture.png> [out.glb]
// The texture is sampled into vertex colours at the full 2048 px size, the mesh is welded and
// simplified, and each vertex colour decides the part (paint = black body, glass = pale panes
// above the beltline, lamps = orange, trim = everything else incl. the yellow roof and chrome).
import fs from 'fs';
import sharp from 'sharp';
import { MeshoptSimplifier } from 'meshoptimizer';
import { GlbWriter } from './lib/glb.mjs';
globalThis.document = { createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, set src(v) {} }) };
const { FBXLoader } = await import('three/addons/loaders/FBXLoader.js');
const [fbx, tex, out = 'public/art/vehicles/padmini.glb'] = process.argv.slice(2);
const buf = fs.readFileSync(fbx);
const root = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
root.updateMatrixWorld(true);
let mesh; root.traverse((o) => { if (o.isMesh) mesh = o; });
const g = mesh.geometry, P = g.attributes.position.array, UV = g.attributes.uv.array, n = g.attributes.position.count;
const { data, info } = await sharp(tex).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const LUT = Float32Array.from({ length: 256 }, (_, i) => lin(i / 255));
// Weld by position, average colour.
let ymin = Infinity, ymax = -Infinity;
for (let i = 0; i < n; i++) { ymin = Math.min(ymin, P[i * 3 + 1]); ymax = Math.max(ymax, P[i * 3 + 1]); }
const q = 0.0002, key = new Map(), pos = [], col = [], cnt = [], idx = [];
for (let i = 0; i < n; i++) {
  const k = `${Math.round(P[i * 3] / q)},${Math.round(P[i * 3 + 1] / q)},${Math.round(P[i * 3 + 2] / q)}`;
  let v = key.get(k);
  if (v === undefined) { v = pos.length / 3; key.set(k, v); pos.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); col.push(0, 0, 0); cnt.push(0); }
  let u = UV[i * 2] % 1, w = UV[i * 2 + 1] % 1; if (u < 0) u += 1; if (w < 0) w += 1;
  const px = Math.min(info.width - 1, Math.floor(u * info.width)), py = Math.min(info.height - 1, Math.floor((1 - w) * info.height)), o = (py * info.width + px) * 3;
  col[v * 3] += LUT[data[o]]; col[v * 3 + 1] += LUT[data[o + 1]]; col[v * 3 + 2] += LUT[data[o + 2]]; cnt[v]++;
  idx.push(v);
}
for (let v = 0; v < cnt.length; v++) for (let c = 0; c < 3; c++) col[v * 3 + c] /= cnt[v];
console.log('welded', n, '→', cnt.length, 'vertices,', idx.length / 3, 'triangles');
await MeshoptSimplifier.ready; MeshoptSimplifier.useExperimentalFeatures = true;
const positions = Float32Array.from(pos), colours = Float32Array.from(col);
const TARGET = 60000;
const [simple] = MeshoptSimplifier.simplifyWithAttributes(Uint32Array.from(idx), positions, 3, colours, 3, [0.6, 0.6, 0.6], null, TARGET * 3, 0.05, []);
console.log('simplified to', simple.length / 3, 'triangles');
// Compact + classify each triangle by the mean colour of its corners.
const H = ymax - ymin, groups = { paint: [], glass: [], trim: [], lamps: [] };
for (let t = 0; t < simple.length; t += 3) {
  let r = 0, gg = 0, b = 0, y = 0;
  for (let k = 0; k < 3; k++) { const v = simple[t + k]; r += col[v * 3]; gg += col[v * 3 + 1]; b += col[v * 3 + 2]; y += pos[v * 3 + 1]; }
  r /= 3; gg /= 3; b /= 3; y = (y / 3 - ymin) / H;
  const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), lum = 0.2126 * r + 0.7152 * gg + 0.0722 * b, sat = mx ? (mx - mn) / mx : 0;
  let part = 'trim';
  if (sat > 0.6 && r > 0.35 && gg < r * 0.62 && b < 0.1) part = 'lamps';              // orange indicators
  else if (sat > 0.45 && r > 0.3 && gg > 0.2) part = 'trim';                           // yellow roof and pillars
  else if (sat < 0.3 && lum > 0.2 && y > 0.5 && y < 0.93) part = 'glass';             // pale panes above the belt
  else if (lum < 0.03 && sat < 0.5 && y > 0.12) part = 'paint';                        // black body
  groups[part].push(simple[t], simple[t + 1], simple[t + 2]);
}
const w = new GlbWriter(), nodes = [], meshes = [];
for (const [name, tri] of Object.entries(groups)) {
  if (!tri.length) continue;
  const map = new Map(), P2 = [], C2 = [], I2 = [];
  for (const v of tri) {
    let k = map.get(v);
    if (k === undefined) { k = P2.length / 3; map.set(v, k); P2.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]); C2.push(col[v * 3], col[v * 3 + 1], col[v * 3 + 2]); }
    I2.push(k);
  }
  console.log(name, I2.length / 3, 'triangles');
  const mat = { name, pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, name === 'glass' ? 0.4 : 1] }, ...(name === 'glass' ? { alphaMode: 'BLEND' } : {}) };
  meshes.push({ name, primitives: [{ attributes: { POSITION: w.attribute(Float32Array.from(P2), 3, true), COLOR_0: w.attribute(Float32Array.from(C2), 3) }, indices: w.indices(Uint32Array.from(I2), P2.length / 3), material: meshes.length }], _mat: mat });
  nodes.push({ name, mesh: meshes.length - 1 });
}
const glb = w.build({ asset: { version: '2.0', generator: 'Bombay Bawaal taxi converter' }, scene: 0, scenes: [{ nodes: nodes.map((_, i) => i) }], nodes, meshes: meshes.map(({ _mat, ...m }) => m), materials: meshes.map((m) => m._mat) });
fs.writeFileSync(out, glb);
console.log('wrote', out, (glb.length / 1e6).toFixed(2), 'MB');
