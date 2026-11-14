// Lists the hand-made / tool-generated models the owner uploads (docs/art-requests.md) into
// public/art/index.json, so the game only asks for files that exist (no 404s). Run by
// "npm run build" (and so by the deploy workflow) and "npm run dev".
//
// - public/art/models/<id>.glb (carts, shelter, small props): web tools (TRELLIS, Meshy…)
//   export dense meshes (~30k triangles) with big PNG textures, and the game repeats each model
//   at every stall nearby. Each gets a light copy in public/art/opt/ (not committed): simplified
//   with meshoptimizer to a triangle budget, unused vertices dropped, smooth normals added if
//   missing, texture shrunk to 512 px (JPEG unless it has transparency).
// - public/art/vehicles/<id>.glb (free vehicle models): split into the fleet's four parts with
//   a far version (scripts/art-vehicles.mjs) → public/art/opt/vehicles/<id>.glb and <id>-far.glb.
// If a file cannot be processed, a model is listed as uploaded and a vehicle is left out.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { MeshoptSimplifier } from 'meshoptimizer';
import { readGlb, readAccessor, imageBytes, GlbWriter } from './lib/glb.mjs';
import { buildVehicle } from './art-vehicles.mjs';

const ART = path.resolve('public/art');
const dir = path.join(ART, 'models'), vdir = path.join(ART, 'vehicles'), optDir = path.join(ART, 'opt');
const glbs = (d) => (fs.existsSync(d) ? fs.readdirSync(d).filter((f) => /\.glb$/i.test(f)) : []);
const files = glbs(dir), vfiles = glbs(vdir);
// Triangle budget by model id (big carts and the shelter get more; small props very few).
const SMALL = /stool|cylinder|milk-can|dustbin|barricade/;
const budget = (id) => (SMALL.test(id) ? 900 : 5000);
const scripts = ['art-index.mjs', 'art-vehicles.mjs', 'lib/glb.mjs'].map((f) => fs.statSync(new URL(f, import.meta.url)).mtimeMs);
const stale = (src, ...outs) => outs.some((o) => !fs.existsSync(o) || fs.statSync(o).mtimeMs < Math.max(fs.statSync(src).mtimeMs, ...scripts));

async function optimise(src, dst, target) {
  const { json, bin } = readGlb(fs.readFileSync(src));
  if ((json.extensionsRequired || []).length) throw new Error('compressed GLB');
  await MeshoptSimplifier.ready;
  const w = new GlbWriter();
  let tris = 0, before = 0;
  const prims = json.meshes.flatMap((m) => m.primitives);
  const total = prims.reduce((s, p) => s + (p.indices !== undefined ? json.accessors[p.indices].count / 3 : json.accessors[p.attributes.POSITION].count / 3), 0);
  for (const p of prims) {
    const pos = readAccessor(json, bin, p.attributes.POSITION, { float: true }).arr;
    const count = pos.length / 3;
    let idx = p.indices !== undefined ? Uint32Array.from(readAccessor(json, bin, p.indices).arr) : Uint32Array.from({ length: count }, (_, i) => i);
    before += idx.length / 3;
    const want = Math.max(36, Math.floor((target * (idx.length / 3)) / total) * 3);
    if (idx.length > want) {
      const [out] = MeshoptSimplifier.simplify(idx, pos, 3, want, 0.02);
      if (out.length >= 36) idx = out;
    }
    tris += idx.length / 3;
    // Drop unused vertices.
    const remap = new Int32Array(count).fill(-1);
    let used = 0;
    for (let i = 0; i < idx.length; i++) { const v = idx[i]; if (remap[v] < 0) remap[v] = used++; idx[i] = remap[v]; }
    const attributes = {};
    for (const [name, ai] of Object.entries(p.attributes)) {
      if (!['POSITION', 'NORMAL', 'TEXCOORD_0'].includes(name)) continue;
      const { arr, n } = readAccessor(json, bin, ai, { float: true });
      const outArr = new Float32Array(used * n);
      for (let v = 0; v < count; v++) if (remap[v] >= 0) for (let k = 0; k < n; k++) outArr[remap[v] * n + k] = arr[v * n + k];
      attributes[name] = w.attribute(outArr, n, name === 'POSITION');
    }
    if (attributes.NORMAL === undefined) {
      // Image-to-3D exports often have no normals (three.js would draw them faceted): smooth
      // normals, shared across texture seams (vertices at the same spot).
      const P = new Float32Array(used * 3);
      for (let v = 0; v < count; v++) if (remap[v] >= 0) for (let k = 0; k < 3; k++) P[remap[v] * 3 + k] = pos[v * 3 + k];
      const key = new Map(), group = new Int32Array(used);
      for (let v = 0; v < used; v++) { const q = `${Math.round(P[v * 3] * 1e4)},${Math.round(P[v * 3 + 1] * 1e4)},${Math.round(P[v * 3 + 2] * 1e4)}`; if (!key.has(q)) key.set(q, key.size); group[v] = key.get(q); }
      const acc = new Float32Array(key.size * 3), N = new Float32Array(used * 3);
      for (let i = 0; i < idx.length; i += 3) {
        const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
        const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], wx = P[c] - P[a], wy = P[c + 1] - P[a + 1], wz = P[c + 2] - P[a + 2];
        const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
        for (const v of [idx[i], idx[i + 1], idx[i + 2]]) { const g = group[v] * 3; acc[g] += nx; acc[g + 1] += ny; acc[g + 2] += nz; }
      }
      for (let v = 0; v < used; v++) { const g = group[v] * 3, l = Math.hypot(acc[g], acc[g + 1], acc[g + 2]) || 1; N[v * 3] = acc[g] / l; N[v * 3 + 1] = acc[g + 1] / l; N[v * 3 + 2] = acc[g + 2] / l; }
      attributes.NORMAL = w.attribute(N, 3);
    }
    p.attributes = attributes; p.indices = w.indices(idx, used);
  }
  // Textures: 512 px, JPEG unless the picture has transparency.
  for (let i = 0; i < (json.images || []).length; i++) {
    const img = json.images[i], data = imageBytes(json, bin, i);
    if (!data) throw new Error('external image');
    const pic = sharp(data), meta = await pic.metadata();
    const alpha = meta.hasAlpha && !(await sharp(data).stats()).isOpaque;
    const size = Math.min(512, meta.width || 512);
    const out = alpha ? await pic.resize(size, size, { fit: 'inside' }).png({ compressionLevel: 9 }).toBuffer() : await pic.resize(size, size, { fit: 'inside' }).flatten({ background: '#808080' }).jpeg({ quality: 82 }).toBuffer();
    img.bufferView = w.view(new Uint8Array(out)); img.mimeType = alpha ? 'image/png' : 'image/jpeg'; delete img.uri;
  }
  delete json.extensionsUsed;
  fs.writeFileSync(dst, w.build(json));
  return { before: Math.round(before), tris: Math.round(tris) };
}

const models = [];
if (files.length || vfiles.length) fs.mkdirSync(path.join(optDir, 'vehicles'), { recursive: true });
for (const f of files) {
  const id = f.replace(/\.glb$/i, '').toLowerCase(), src = path.join(dir, f), dst = path.join(optDir, `${id}.glb`);
  let file = `models/${f}`;
  try {
    if (stale(src, dst)) {
      const r = await optimise(src, dst, budget(id));
      console.log(`art: ${f} ${r.before} → ${r.tris} triangles, ${(fs.statSync(src).size / 1e6).toFixed(1)} → ${(fs.statSync(dst).size / 1e6).toFixed(2)} MB`);
    }
    file = `opt/${id}.glb`;
  } catch (e) { console.warn(`art: ${f} not optimised (${e.message}); using it as uploaded`); }
  models.push({ id, file, bytes: fs.statSync(path.join(ART, file)).size });
}

// Vehicles: fleet lengths for scaling replacements of existing types.
const vehicles = [];
if (vfiles.length) {
  const { buildFleet } = await import('../src/vehicles/fleet.js');
  const T = buildFleet(), fleetLen = Object.fromEntries(Object.entries(T).map(([k, v]) => [k, v.len]));
  for (const f of vfiles) {
    const id = f.replace(/\.glb$/i, '').toLowerCase(), src = path.join(vdir, f);
    const near = path.join(optDir, 'vehicles', `${id}.glb`), far = path.join(optDir, 'vehicles', `${id}-far.glb`), meta = path.join(optDir, 'vehicles', `${id}.json`);
    try {
      if (stale(src, near, far, meta)) {
        const r = await buildVehicle(fs.readFileSync(src), id, fleetLen);
        fs.writeFileSync(near, r.near); fs.writeFileSync(far, r.far); fs.writeFileSync(meta, JSON.stringify(r.info));
        const sum = (c) => Object.values(c).reduce((s, x) => s + x, 0);
        console.log(`art: vehicle ${f} → ${r.info.len} × ${r.info.wid} × ${r.info.hgt} m, ${sum(r.info.near)} / ${sum(r.info.far)} triangles${r.info.paint ? '' : ', no paint part found'}${r.info.notes.length ? ` (${r.info.notes.join(', ')})` : ''}`);
      }
      const info = JSON.parse(fs.readFileSync(meta, 'utf8'));
      vehicles.push({ id, near: `opt/vehicles/${id}.glb`, far: `opt/vehicles/${id}-far.glb`, len: info.len, wid: info.wid, hgt: info.hgt });
    } catch (e) { console.warn(`art: vehicle ${f} left out (${e.message})`); }
  }
}
fs.writeFileSync(path.join(ART, 'index.json'), JSON.stringify({ models, vehicles }, null, 1));
console.log(`art: ${files.length} model(s), ${vehicles.length} vehicle(s) listed`);
