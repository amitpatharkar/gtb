// Lists the hand-made / tool-generated models in public/art/models (uploaded by the owner,
// see docs/art-requests.md) into public/art/index.json, so the game only asks for files that
// exist (no 404s). Run by "npm run build" (and so by the deploy workflow) and "npm run dev".
//
// Web tools (TRELLIS, Meshy…) export dense meshes (~30k triangles) with big PNG textures; the
// game repeats each model at every stall nearby. So each upload also gets a light copy in
// public/art/opt/ (not committed): the mesh simplified with meshoptimizer to a triangle budget,
// unused vertices dropped, and the texture shrunk to 512 px (JPEG unless it has transparency).
// The game loads the light copy; if a file cannot be optimised, the original is listed instead.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { MeshoptSimplifier } from 'meshoptimizer';

const dir = path.resolve('public/art/models'), optDir = path.resolve('public/art/opt');
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /\.glb$/i.test(f)) : [];
// Triangle budget by model id (big carts and the shelter get more; small props very few).
const SMALL = /stool|cylinder|milk-can|dustbin|barricade/;
const budget = (id) => (SMALL.test(id) ? 900 : 5000);

const COMP = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

function readGlb(buf) {
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB');
  let o = 12, json = null, bin = null;
  while (o < buf.length) {
    const len = buf.readUInt32LE(o), type = buf.readUInt32LE(o + 4), data = buf.subarray(o + 8, o + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(data.toString('utf8')); else if (type === 0x004e4942) bin = data;
    o += 8 + len;
  }
  return { json, bin };
}

function accessor(json, bin, i) {
  const a = json.accessors[i], bv = json.bufferViews[a.bufferView], T = COMP[a.componentType], n = SIZE[a.type];
  if (!T || !n || a.sparse || (bv.byteStride && bv.byteStride !== n * T.BYTES_PER_ELEMENT)) throw new Error('unsupported accessor');
  const start = bin.byteOffset + (bv.byteOffset || 0) + (a.byteOffset || 0);
  const copy = new Uint8Array(a.count * n * T.BYTES_PER_ELEMENT);
  copy.set(new Uint8Array(bin.buffer, start, copy.length));
  return { arr: new T(copy.buffer), n, a };
}

async function optimise(src, dst, target) {
  const { json, bin } = readGlb(fs.readFileSync(src));
  if ((json.extensionsRequired || []).length) throw new Error('compressed GLB');
  await MeshoptSimplifier.ready;
  const chunks = [], views = [], accs = [];
  let length = 0;
  const push = (bytes, targetKind) => {
    const pad = (4 - (length % 4)) % 4;
    if (pad) { chunks.push(Buffer.alloc(pad)); length += pad; }
    views.push({ buffer: 0, byteOffset: length, byteLength: bytes.byteLength, ...(targetKind ? { target: targetKind } : {}) });
    chunks.push(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)); length += bytes.byteLength;
    return views.length - 1;
  };
  let tris = 0, before = 0;
  const prims = json.meshes.flatMap((m) => m.primitives);
  const total = prims.reduce((s, p) => s + (p.indices !== undefined ? json.accessors[p.indices].count / 3 : json.accessors[p.attributes.POSITION].count / 3), 0);
  for (const p of prims) {
    const pos = accessor(json, bin, p.attributes.POSITION);
    const count = pos.a.count;
    let idx = p.indices !== undefined ? Uint32Array.from(accessor(json, bin, p.indices).arr) : Uint32Array.from({ length: count }, (_, i) => i);
    before += idx.length / 3;
    const want = Math.max(36, Math.floor((target * (idx.length / 3) / total)) * 3);
    if (idx.length > want) {
      const [out] = MeshoptSimplifier.simplify(idx, pos.arr, 3, want, 0.02);
      if (out.length >= 36) idx = out;
    }
    tris += idx.length / 3;
    // Drop unused vertices.
    const remap = new Int32Array(count).fill(-1);
    let used = 0;
    for (let i = 0; i < idx.length; i++) { const v = idx[i]; if (remap[v] < 0) remap[v] = used++; idx[i] = remap[v]; }
    const attributes = {};
    for (const [name, ai] of Object.entries(p.attributes)) {
      if (!['POSITION', 'NORMAL', 'TEXCOORD_0', 'COLOR_0'].includes(name)) continue;
      const { arr, n, a } = accessor(json, bin, ai);
      const outArr = new arr.constructor(used * n);
      for (let v = 0; v < count; v++) if (remap[v] >= 0) for (let k = 0; k < n; k++) outArr[remap[v] * n + k] = arr[v * n + k];
      const acc = { bufferView: push(outArr, 34962), componentType: a.componentType, count: used, type: a.type, ...(a.normalized ? { normalized: true } : {}) };
      if (name === 'POSITION') {
        const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
        for (let v = 0; v < used; v++) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], outArr[v * 3 + k]); max[k] = Math.max(max[k], outArr[v * 3 + k]); }
        acc.min = min; acc.max = max;
      }
      accs.push(acc); attributes[name] = accs.length - 1;
    }
    if (attributes.NORMAL === undefined) {
      // Image-to-3D exports often have no normals (three.js would draw them faceted): smooth
      // normals, shared across texture seams (vertices at the same spot).
      const P = new Float32Array(used * 3);
      for (let v = 0; v < count; v++) if (remap[v] >= 0) for (let k = 0; k < 3; k++) P[remap[v] * 3 + k] = pos.arr[v * 3 + k];
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
      accs.push({ bufferView: push(N, 34962), componentType: 5126, count: used, type: 'VEC3' }); attributes.NORMAL = accs.length - 1;
    }
    const ind = used < 65536 ? Uint16Array.from(idx) : idx;
    accs.push({ bufferView: push(ind, 34963), componentType: used < 65536 ? 5123 : 5125, count: idx.length, type: 'SCALAR' });
    p.attributes = attributes; p.indices = accs.length - 1;
  }
  // Textures: 512 px, JPEG unless the picture has transparency.
  for (const img of json.images || []) {
    let data;
    if (img.bufferView !== undefined) { const bv = json.bufferViews[img.bufferView]; data = bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength); }
    else if (img.uri?.startsWith('data:')) data = Buffer.from(img.uri.split(',')[1], 'base64');
    else throw new Error('external image');
    const pic = sharp(data), meta = await pic.metadata(), stats = meta.hasAlpha ? await sharp(data).stats() : null;
    const alpha = meta.hasAlpha && !stats.isOpaque;
    const size = Math.min(512, meta.width || 512);
    const out = alpha ? await pic.resize(size, size, { fit: 'inside' }).png({ compressionLevel: 9 }).toBuffer() : await pic.resize(size, size, { fit: 'inside' }).flatten({ background: '#808080' }).jpeg({ quality: 82 }).toBuffer();
    img.bufferView = push(new Uint8Array(out)); img.mimeType = alpha ? 'image/png' : 'image/jpeg'; delete img.uri;
  }
  json.bufferViews = views; json.accessors = accs; json.buffers = [{ byteLength: length }];
  delete json.extensionsUsed;
  const jsonBuf = Buffer.from(JSON.stringify(json)), jpad = (4 - (jsonBuf.length % 4)) % 4;
  const binBuf = Buffer.concat(chunks), bpad = (4 - (binBuf.length % 4)) % 4;
  const head = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8);
  const total2 = 12 + 8 + jsonBuf.length + jpad + 8 + binBuf.length + bpad;
  head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(total2, 8);
  jh.writeUInt32LE(jsonBuf.length + jpad, 0); jh.writeUInt32LE(0x4e4f534a, 4);
  bh.writeUInt32LE(binBuf.length + bpad, 0); bh.writeUInt32LE(0x004e4942, 4);
  fs.writeFileSync(dst, Buffer.concat([head, jh, jsonBuf, Buffer.alloc(jpad, 0x20), bh, binBuf, Buffer.alloc(bpad)]));
  return { before: Math.round(before), tris: Math.round(tris) };
}

const models = [];
if (files.length) fs.mkdirSync(optDir, { recursive: true });
for (const f of files) {
  const id = f.replace(/\.glb$/i, '').toLowerCase(), src = path.join(dir, f), dst = path.join(optDir, `${id}.glb`);
  let file = `models/${f}`;
  try {
    if (!fs.existsSync(dst) || fs.statSync(dst).mtimeMs < fs.statSync(src).mtimeMs || fs.statSync(dst).mtimeMs < fs.statSync(new URL(import.meta.url)).mtimeMs) {
      const r = await optimise(src, dst, budget(id));
      console.log(`art: ${f} ${r.before} → ${r.tris} triangles, ${(fs.statSync(src).size / 1e6).toFixed(1)} → ${(fs.statSync(dst).size / 1e6).toFixed(2)} MB`);
    }
    file = `opt/${id}.glb`;
  } catch (e) { console.warn(`art: ${f} not optimised (${e.message}); using it as uploaded`); }
  models.push({ id, file, bytes: fs.statSync(path.join(path.resolve('public/art'), file)).size });
}
fs.writeFileSync(path.resolve('public/art/index.json'), JSON.stringify({ models }, null, 1));
console.log(`art: ${files.length} model(s) listed`);
