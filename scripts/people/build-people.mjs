// People for the game, built from MakeHuman (CC0) bodies with free (CC0 / CC BY) hair and
// clothes: `node scripts/people/build-people.mjs [--only=id,id] [--force] [--setup]`.
//
// 1. Tools (cached in .people-cache/, never committed): Blender 4.2 LTS, the MakeHuman plugin
//    for Blender (MPFB 2) and the MakeHuman asset packs (`--setup` downloads them).
// 2. Blender (scripts/people/blender/person.py) builds each person of the population
//    (scripts/people/population.mjs): body at the person's height, game skeleton + eye bones,
//    hair and clothes fitted, face expression morphs; one raw GLB per person (rebuilt only
//    when the person's spec or the Blender script changes).
// 3. Here: one shared texture atlas for everybody (public/people/atlas.ktx2). Skin, hair and
//    garments that take a per-person colour are stored as brightness detail around mid-grey
//    (linear 0.5 = the texture's own average), so the game multiplies by any skin tone, hair
//    or cloth colour; eyes, teeth and printed fabrics keep their colours.
// 4. Each person becomes ONE skinned mesh per level of detail (near 0–8 m with face morphs,
//    mid, far), parts simplified with meshoptimizer, a `_PART` attribute saying which colour
//    slot each vertex takes; quantised and meshopt-compressed (public/people/<id>.glb).
// 5. public/people/index.json: the people, colour slots, morph names, the atlas and credits.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';
import { readGlb, readAccessor } from '../lib/glb.mjs';
import { POPULATION, SLOTS } from './population.mjs';
import { setup, TOOLS } from './setup.mjs';
import { Writer } from './glbwriter.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const OUT = path.join(ROOT, 'public/people');
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const CACHE = path.resolve(ROOT, args.cache || '.people-cache');
const RAW = path.join(CACHE, 'raw');
const ATLAS = Number(args.atlas || 4096);
const log = (...a) => console.log('[people]', ...a);

// Triangle budgets per part role and level of detail (0 = drop the part at that level).
const BUDGET = {
  skin: [9000, 2600, 700], hair: [3200, 900, 260], top: [3000, 900, 260], bottom: [2400, 700, 200],
  extra: [3000, 900, 260], shoes: [900, 160, 40], facial: [700, 160, 0], eyebrows: [400, 120, 0],
  eyelashes: [600, 0, 0], eyes: [400, 120, 60], teeth: [500, 0, 0], accessory: [800, 200, 0],
};
// Atlas cell size by role (pixels at a 4096 atlas).
const CELL = { skin: 1024, hair: 512, top: 512, bottom: 256, extra: 512, shoes: 128, facial: 256, eyebrows: 256, eyelashes: 128, eyes: 128, teeth: 128, accessory: 128 };
const MORPHS = ['blinkL', 'blinkR', 'squint', 'wide', 'browDown', 'browInnerUp', 'browUp', 'jawOpen', 'smile', 'frown', 'pucker', 'funnel', 'sneer', 'stretch'];
const LICENCE = { 0: 'AGPL', 1: 'CC0', 2: 'CC-BY' };

const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const srgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12);

// ---------------------------------------------------------------- Blender
function runBlender(people) {
  const script = path.join(HERE, 'blender/person.py');
  const scriptHash = hash(fs.readFileSync(script, 'utf8'));
  fs.mkdirSync(RAW, { recursive: true });
  const todo = people.filter((p) => {
    const h = hash(JSON.stringify(p) + scriptHash);
    const meta = path.join(RAW, `${p.id}.json`);
    p._hash = h;
    if (args.force || !fs.existsSync(meta)) return true;
    try { return JSON.parse(fs.readFileSync(meta, 'utf8')).hash !== h; } catch { return true; }
  });
  if (!todo.length) { log('all people up to date'); return; }
  const pop = path.join(CACHE, 'population.json');
  fs.writeFileSync(pop, JSON.stringify({ people: todo }, null, 1));
  // Four Blender processes at once (each person takes ~5 s, mostly single-threaded).
  const n = Math.min(os.cpus().length, 4, todo.length);
  const groups = Array.from({ length: n }, (_, i) => todo.filter((_, k) => k % n === i).map((p) => p.id));
  log(`building ${todo.length} people in Blender (${n} at once)`);
  const env = { ...process.env, BLENDER_USER_RESOURCES: TOOLS(CACHE).userResources };
  const run = (ids) => new Promise((resolve, reject) => {
    import('node:child_process').then(({ spawn }) => {
      const p = spawn(TOOLS(CACHE).blender, ['--background', '--python-exit-code', '1', '--python', script, '--', pop, RAW, ...ids], { env });
      let tail = '';
      const out = (d) => { const s = d.toString(); tail = (tail + s).slice(-4000); for (const l of s.split('\n')) if (l.startsWith('[people]')) console.log(l); };
      p.stdout.on('data', out); p.stderr.on('data', out);
      p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`Blender failed (${code}):\n${tail}`))));
    });
  });
  return Promise.all(groups.map(run)).then(() => {
    for (const p of todo) {
      const f = path.join(RAW, `${p.id}.json`);
      const m = JSON.parse(fs.readFileSync(f, 'utf8'));
      m.hash = p._hash;
      fs.writeFileSync(f, JSON.stringify(m, null, 1));
    }
  });
}

// ---------------------------------------------------------------- atlas
/**
 * Quadtree packing of power-of-two square cells, largest first (no waste for squares).
 * Returns Map(key → {x, y, s}) in atlas pixels.
 */
function pack(cells, size) {
  const free = [{ x: 0, y: 0, s: size }];
  const out = new Map();
  for (const c of [...cells].sort((a, b) => b.s - a.s)) {
    let best = -1;
    for (let i = 0; i < free.length; i++) if (free[i].s >= c.s && (best < 0 || free[i].s < free[best].s)) best = i;
    if (best < 0) throw new Error(`atlas full (${size}px): make cells smaller or the atlas larger`);
    let f = free.splice(best, 1)[0];
    while (f.s > c.s) {
      const h = f.s / 2;
      free.push({ x: f.x + h, y: f.y, s: h }, { x: f.x, y: f.y + h, s: h }, { x: f.x + h, y: f.y + h, s: h });
      f = { x: f.x, y: f.y, s: h };
    }
    out.set(c.key, f);
  }
  return out;
}

/**
 * One texture → an atlas cell (raw RGBA, `s` pixels square). Tinted modes store detail around
 * linear mid-grey: 'tone' keeps each channel's ratio to the average (skin: lips and cheeks stay
 * redder than the tone), 'grey' only brightness (hair, garments take any colour).
 */
async function cellImage(file, s, mode, fallback) {
  const pad = Math.max(2, Math.round(s / 64));
  const inner = s - pad * 2;
  let img;
  if (file && fs.existsSync(file)) img = sharp(file).ensureAlpha().resize(inner, inner, { fit: 'fill' });
  else {
    const [r, g, b] = (fallback || [0.6, 0.6, 0.6]).map((c) => Math.round(srgb(Math.min(1, c)) * 255));
    img = sharp({ create: { width: inner, height: inner, channels: 4, background: { r, g, b, alpha: 1 } } });
  }
  const { data } = await img.raw().toBuffer({ resolveWithObject: true });
  if (mode !== 'keep') {
    // Average (linear) over opaque pixels.
    const m = [0, 0, 0]; let n = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      m[0] += lin(data[i] / 255); m[1] += lin(data[i + 1] / 255); m[2] += lin(data[i + 2] / 255); n++;
    }
    for (let k = 0; k < 3; k++) m[k] = Math.max(1e-4, m[k] / Math.max(1, n));
    const ml = 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2];
    for (let i = 0; i < data.length; i += 4) {
      const r = lin(data[i] / 255), g = lin(data[i + 1] / 255), b = lin(data[i + 2] / 255);
      let o;
      if (mode === 'tone') o = [r / m[0], g / m[1], b / m[2]];
      else { const l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / ml; o = [l, l, l]; }
      for (let k = 0; k < 3; k++) data[i + k] = Math.round(srgb(Math.min(1, 0.5 * o[k])) * 255);
    }
  }
  // Edge padding (extends the border pixels) so mipmaps don't bleed neighbouring cells in.
  return sharp(data, { raw: { width: inner, height: inner, channels: 4 } }).extend({ top: pad, bottom: pad, left: pad, right: pad, extendWith: 'copy' }).raw().toBuffer();
}

function encodeKtx2(png, preset = 'color') {
  return new Promise((resolve, reject) => {
    const w = new Worker(path.join(ROOT, 'scripts/assets/encode-worker.mjs'));
    w.once('message', (m) => { w.terminate(); m.error ? reject(new Error(m.error)) : resolve(Buffer.from(m.ktx2)); });
    w.once('error', reject);
    w.postMessage({ id: 1, png, preset });
  });
}

// ---------------------------------------------------------------- geometry
/** A raw person GLB → its parts: { role, pos, nrm, uv, joints, weights, idx, morphs: Map(name → Float32Array) }. */
function readParts(file, meta) {
  const { json, bin } = readGlb(fs.readFileSync(file));
  const parts = [];
  for (const node of json.nodes) {
    if (node.mesh === undefined) continue;
    const role = node.extras?.gtb_role || node.name.split('__')[0];
    const info = meta.parts.find((p) => `${p.role}__${p.asset}` === node.name) || meta.parts.find((p) => p.role === role);
    const mesh = json.meshes[node.mesh];
    const names = mesh.extras?.targetNames || [];
    for (const prim of mesh.primitives) {
      const A = prim.attributes;
      const get = (i) => readAccessor(json, bin, i, { float: true }).arr;
      const part = {
        role, info, name: node.name,
        pos: get(A.POSITION), nrm: get(A.NORMAL), uv: A.TEXCOORD_0 !== undefined ? get(A.TEXCOORD_0) : null,
        joints: readAccessor(json, bin, A.JOINTS_0).arr, weights: get(A.WEIGHTS_0),
        idx: Uint32Array.from(readAccessor(json, bin, prim.indices).arr), morphs: new Map(),
      };
      (prim.targets || []).forEach((t, k) => { if (names[k] && t.POSITION !== undefined) part.morphs.set(names[k], get(t.POSITION)); });
      parts.push(part);
    }
  }
  return { json, bin, parts };
}

/** Simplify a part to about `tris` triangles; returns new indices (vertices unchanged). */
function simplify(part, tris, lockBorder) {
  const n = part.idx.length / 3;
  if (tris >= n) return part.idx;
  const vc = part.pos.length / 3;
  const attr = new Float32Array(vc * 5);
  for (let i = 0; i < vc; i++) {
    attr[i * 5] = part.nrm[i * 3] * 0.3; attr[i * 5 + 1] = part.nrm[i * 3 + 1] * 0.3; attr[i * 5 + 2] = part.nrm[i * 3 + 2] * 0.3;
    attr[i * 5 + 3] = part.uv ? part.uv[i * 2] : 0; attr[i * 5 + 4] = part.uv ? part.uv[i * 2 + 1] : 0;
  }
  const flags = lockBorder ? ['LockBorder'] : [];
  const [out] = MeshoptSimplifier.simplifyWithAttributes(part.idx, part.pos, 3, attr, 5, [0.5, 0.5, 0.5, 1, 1], null, tris * 3, 0.05, flags);
  return out.length >= 3 ? out : part.idx;
}

/**
 * Merge parts (with their simplified indices) into one geometry: compact vertices, atlas UVs,
 * colour slot per vertex, morph deltas (LOD 0 only).
 */
function merge(parts, cellOf, withMorphs) {
  const used = parts.map((p) => { const m = new Int32Array(p.pos.length / 3).fill(-1); for (const i of p.lodIdx) m[i] = 0; return m; });
  let vc = 0;
  parts.forEach((p, k) => { for (let i = 0; i < used[k].length; i++) if (used[k][i] === 0) used[k][i] = vc++; });
  const pos = new Float32Array(vc * 3), nrm = new Float32Array(vc * 3), uv = new Float32Array(vc * 2);
  const joints = new Uint8Array(vc * 4), weights = new Float32Array(vc * 4), partAttr = new Uint8Array(vc * 4);
  const morphs = withMorphs ? MORPHS.map(() => new Float32Array(vc * 3)) : [];
  const idx = [];
  parts.forEach((p, k) => {
    const map = used[k], cell = cellOf(p), slot = p.slot;
    for (let i = 0; i < map.length; i++) {
      const o = map[i];
      if (o < 0) continue;
      pos.set(p.pos.subarray(i * 3, i * 3 + 3), o * 3);
      nrm.set(p.nrm.subarray(i * 3, i * 3 + 3), o * 3);
      const u = p.uv ? Math.min(1, Math.max(0, p.uv[i * 2])) : 0.5, v = p.uv ? Math.min(1, Math.max(0, p.uv[i * 2 + 1])) : 0.5;
      uv[o * 2] = (cell.x + cell.pad + u * cell.inner) / ATLAS;
      uv[o * 2 + 1] = (cell.y + cell.pad + v * cell.inner) / ATLAS;
      for (let c = 0; c < 4; c++) { joints[o * 4 + c] = p.joints[i * 4 + c]; weights[o * 4 + c] = p.weights[i * 4 + c]; }
      partAttr[o * 4] = slot; partAttr[o * 4 + 1] = p.alpha ? 1 : 0; partAttr[o * 4 + 2] = p.roughness; partAttr[o * 4 + 3] = p.role === 'hair' ? 1 : 0; // 1 = scalp hair (hidden under caps)
      if (withMorphs) MORPHS.forEach((name, m) => { const d = p.morphs.get(name); if (d) morphs[m].set(d.subarray(i * 3, i * 3 + 3), o * 3); });
    }
    for (const i of p.lodIdx) idx.push(map[i]);
  });
  // Vertex cache order (faster drawing, better compression): reorderMesh reorders the
  // triangles and renumbers the indices in place; `remap[old] = new` for the attributes.
  const ix = Uint32Array.from(idx);
  const [remap, unique] = MeshoptEncoder.reorderMesh(ix, true, false);
  return { pos, nrm, uv, joints, weights, partAttr, morphs, idx: ix, remap, vc: unique };
}

/** Apply reorderMesh's vertex remap to every attribute (the indices are already renumbered). */
function reorder(g) {
  const { remap, vc } = g;
  const re = (arr, n) => { const out = new arr.constructor(vc * n); for (let i = 0; i < remap.length; i++) if (remap[i] !== 0xffffffff) out.set(arr.subarray(i * n, i * n + n), remap[i] * n); return out; };
  return {
    vc, pos: re(g.pos, 3), nrm: re(g.nrm, 3), uv: re(g.uv, 2), joints: re(g.joints, 4), weights: re(g.weights, 4),
    partAttr: re(g.partAttr, 4), morphs: g.morphs.map((m) => re(m, 3)), idx: g.idx,
  };
}

function writePerson(spec, raw, lods) {
  const w = new Writer();
  const { json: rj, bin: rb } = raw;
  const skin0 = rj.skins[0];
  // Skeleton: copy the armature root and its joint nodes (TRS), re-indexed.
  const keep = new Set();
  const addTree = (i) => { keep.add(i); for (const c of rj.nodes[i].children || []) if (rj.nodes[c].mesh === undefined) addTree(c); };
  const rootIdx = rj.scenes[0].nodes.find((i) => (rj.nodes[i].children || []).some((c) => skin0.joints.includes(c)) || skin0.joints.includes(i));
  addTree(rootIdx);
  const order = [...keep];
  const newIdx = new Map(order.map((o, k) => [o, k]));
  const nodes = order.map((o) => {
    const n = rj.nodes[o], out = { name: n.name };
    for (const k of ['translation', 'rotation', 'scale']) if (n[k]) out[k] = n[k].map((x) => Math.round(x * 1e6) / 1e6);
    const ch = (n.children || []).filter((c) => keep.has(c)).map((c) => newIdx.get(c));
    if (ch.length) out.children = ch;
    return out;
  });
  const ibm = readAccessor(rj, rb, skin0.inverseBindMatrices, { float: true }).arr;
  const ibmView = w.plain(ibm);
  const ibmAcc = w.accessor({ bufferView: ibmView, componentType: 5126, count: skin0.joints.length, type: 'MAT4' });
  const skin = { joints: skin0.joints.map((j) => newIdx.get(j)), inverseBindMatrices: ibmAcc, skeleton: newIdx.get(rootIdx) };
  const meshes = [];
  const meshNodes = [];
  lods.forEach((g, lod) => {
    // Weights: renormalise after quantising so they sum to exactly 255.
    const wq = new Float32Array(g.weights.length);
    for (let i = 0; i < g.vc; i++) {
      const s = g.weights[i * 4] + g.weights[i * 4 + 1] + g.weights[i * 4 + 2] + g.weights[i * 4 + 3] || 1;
      const b = [0, 1, 2, 3].map((c) => Math.round((g.weights[i * 4 + c] / s) * 255));
      const diff = 255 - (b[0] + b[1] + b[2] + b[3]);
      b[b.indexOf(Math.max(...b))] += diff;
      for (let c = 0; c < 4; c++) wq[i * 4 + c] = b[c] / 255;
    }
    const attributes = {
      POSITION: w.f32(g.pos, 3, true), NORMAL: w.q(g.nrm, 3, 'i8'), TEXCOORD_0: w.q(g.uv, 2, 'u16'),
      JOINTS_0: w.q(g.joints, 4, 'u8', { normalized: false }), WEIGHTS_0: w.q(wq, 4, 'u8'),
      _PART: w.q(g.partAttr, 4, 'u8', { normalized: false }),
    };
    const prim = { attributes, indices: w.indices(g.idx, g.vc), mode: 4 };
    let extras;
    if (g.morphs.length) {
      prim.targets = g.morphs.map((d) => ({ POSITION: w.q(d, 3, 'i16', { minMax: true }) }));
      extras = { targetNames: MORPHS };
    }
    meshes.push({ name: `${spec.id}_lod${lod}`, primitives: [prim], ...(extras ? { extras } : {}), ...(g.morphs.length ? { weights: MORPHS.map(() => 0) } : {}) });
    nodes.push({ name: `lod${lod}`, mesh: meshes.length - 1, skin: 0 });
    meshNodes.push(nodes.length - 1);
  });
  const json = {
    asset: { version: '2.0', generator: 'gtb people (MakeHuman + Blender + meshoptimizer)' },
    extensionsUsed: ['KHR_mesh_quantization', 'EXT_meshopt_compression'],
    extensionsRequired: ['KHR_mesh_quantization', 'EXT_meshopt_compression'],
    scene: 0, scenes: [{ nodes: [newIdx.get(rootIdx), ...meshNodes] }], nodes, meshes, skins: [skin],
  };
  return w.glb(json);
}

// ---------------------------------------------------------------- main
async function main() {
  if (args.setup) await setup(CACHE);
  const only = args.only ? new Set(String(args.only).split(',')) : null;
  const people = POPULATION.filter((p) => !only || only.has(p.id));
  if (!args['skip-blender']) {
    if (!fs.existsSync(TOOLS(CACHE).blender)) throw new Error(`Blender not found in ${CACHE}: run with --setup first`);
    await runBlender(people);
  }
  await MeshoptSimplifier.ready; await MeshoptEncoder.ready;
  MeshoptSimplifier.useExperimentalFeatures = true;
  fs.mkdirSync(OUT, { recursive: true });

  // Read every person (also the ones not rebuilt: the atlas is shared).
  const all = POPULATION.map((spec) => {
    const meta = JSON.parse(fs.readFileSync(path.join(RAW, `${spec.id}.json`), 'utf8'));
    return { spec, meta, raw: readParts(path.join(RAW, `${spec.id}.glb`), meta) };
  });

  // Atlas cells: one per distinct texture file (by role and colour mode).
  const cells = new Map();
  const credits = new Map();
  for (const person of all) {
    for (const part of person.raw.parts) {
      const info = part.info || {};
      const lic = typeof info.license === 'number' ? LICENCE[info.license] : info.license || 'CC0';
      if (lic === 'AGPL') throw new Error(`${person.spec.id}: ${info.asset} is AGPL-licensed; pick another asset`);
      const garment = person.spec.clothes?.find((c) => c[1] === info.asset);
      const opts = garment?.[2] || {};
      const role = part.role in BUDGET ? part.role : 'accessory';
      part.role = role;
      part.slot = SLOTS[opts.slot ?? (role === 'skin' ? 'skin' : ['hair', 'eyebrows', 'eyelashes', 'facial'].includes(role) ? 'hair' : role === 'top' ? 'top' : role === 'bottom' ? 'bottom' : role === 'extra' ? 'extra' : role === 'shoes' && opts.tint ? 'shoes' : 'keep')];
      const mode = part.slot === SLOTS.keep ? 'keep' : part.slot === SLOTS.skin ? 'tone' : 'grey';
      part.roughness = Math.round(255 * (role === 'skin' ? 0.55 : role === 'eyes' ? 0.08 : role === 'teeth' ? 0.45 : ['hair', 'eyebrows', 'eyelashes', 'facial'].includes(role) ? 0.5 : role === 'shoes' ? 0.6 : 0.88));
      part.alpha = ['hair', 'eyebrows', 'eyelashes', 'facial', 'accessory'].includes(role) || (info.transparent && ['top', 'bottom', 'extra'].includes(role) && !!opts.alpha);
      const key = `${info.diffuse || 'flat:' + role + ':' + (info.color || []).join(',')}|${mode}`;
      part.cellKey = key;
      const s = Math.round((CELL[role] * ATLAS) / 4096);
      const prev = cells.get(key);
      if (!prev || prev.s < s) cells.set(key, { key, s, file: info.diffuse, mode, color: info.color });
      if (info.asset) credits.set(info.asset, { asset: info.asset, role, license: lic, author: info.author && info.author !== 'unknown' ? info.author : 'MakeHuman team' });
    }
  }
  const placed = pack([...cells.values()], ATLAS);
  log(`atlas ${ATLAS}px: ${cells.size} textures`);
  const composites = [];
  for (const [key, c] of cells) {
    const r = placed.get(key);
    const pad = Math.max(2, Math.round(c.s / 64));
    Object.assign(c, r, { pad, inner: c.s - pad * 2 });
    composites.push({ input: await cellImage(c.file, c.s, c.mode, c.color), raw: { width: c.s, height: c.s, channels: 4 }, left: r.x, top: r.y });
  }
  const png = await sharp({ create: { width: ATLAS, height: ATLAS, channels: 4, background: { r: 128, g: 128, b: 128, alpha: 1 } } }).composite(composites).png().toBuffer();
  if (args.png) fs.writeFileSync(path.join(CACHE, 'atlas.png'), png);
  // Two pages (top and bottom half): the encoder takes at most 12 megapixels per image, and
  // quadtree cells never cross the middle line.
  const pages = [];
  for (let k = 0; k < 2; k++) {
    const half = await sharp(png).extract({ left: 0, top: (k * ATLAS) / 2, width: ATLAS, height: ATLAS / 2 }).png().toBuffer();
    fs.writeFileSync(path.join(OUT, `atlas${k}.ktx2`), await encodeKtx2(half));
    pages.push(`atlas${k}.ktx2`);
  }
  // Small preview copy for the lineup page's fallback and for humans to look at.
  fs.writeFileSync(path.join(CACHE, 'atlas-preview.jpg'), await sharp(png).resize(1024).flatten({ background: '#808080' }).jpeg({ quality: 80 }).toBuffer());

  // People.
  const index = [];
  for (const person of all) {
    const { spec, meta, raw } = person;
    if (only && !only.has(spec.id) && fs.existsSync(path.join(OUT, `${spec.id}.glb`)) && !args.remerge) {
      index.push(JSON.parse(fs.readFileSync(path.join(CACHE, `merged-${spec.id}.json`), 'utf8')));
      continue;
    }
    const cellOf = (p) => cells.get(p.cellKey);
    const lods = [0, 1, 2].map((lod) => {
      const parts = raw.parts.filter((p) => BUDGET[p.role][lod] > 0);
      for (const p of parts) p.lodIdx = simplify(p, BUDGET[p.role][lod], lod === 0 && p.role === 'skin');
      return reorder(merge(parts, cellOf, lod === 0));
    });
    const glb = writePerson(spec, raw, lods);
    fs.writeFileSync(path.join(OUT, `${spec.id}.glb`), glb);
    const entry = {
      id: spec.id, file: `${spec.id}.glb`, bytes: glb.length, sex: spec.sex, age: spec.ageYears, build: spec.build,
      heightCm: meta.heightCm, kinds: spec.kinds, palette: spec.palette || {}, tris: lods.map((g) => g.idx.length / 3),
      eyes: meta.eyes, hairChain: meta.hairChain || null,
    };
    fs.writeFileSync(path.join(CACHE, `merged-${spec.id}.json`), JSON.stringify(entry));
    index.push(entry);
    log(spec.id, `${(glb.length / 1024).toFixed(0)} KB`, 'triangles', entry.tris.join(' / '));
  }
  const out = {
    version: hash(index.map((p) => `${p.id}:${p.bytes}`).join() + pages.map((f) => fs.statSync(path.join(OUT, f)).size).join()),
    atlas: pages, atlasSize: ATLAS, slots: SLOTS, morphs: MORPHS, people: index,
    credits: [...credits.values()].sort((a, b) => a.asset.localeCompare(b.asset)),
  };
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(out, null, 1));
  const line = (c) => `- ${c.asset} — ${c.author} — ${c.license === 'CC-BY' ? 'CC BY 4.0' : 'CC0'} (${c.role})`;
  fs.writeFileSync(path.join(OUT, 'CREDITS.md'), [
    '# People: sources and licences', '',
    'Generated by scripts/people/build-people.mjs. Bodies, faces, eyes, teeth and skins: MakeHuman (CC0),',
    'built with MPFB 2 (the MakeHuman plugin for Blender). Hair and clothes: MakeHuman asset packs',
    '(https://static.makehumancommunity.org/assets/assetpacks/index.html). Motion: Universal Animation',
    'Library 1 and 2 by Quaternius (CC0), retargeted (scripts/people/build-anims.mjs).', '',
    '## CC BY 4.0 (credit required; fitted to each body and recoloured)', ...out.credits.filter((c) => c.license === 'CC-BY').map(line), '',
    '## CC0', ...out.credits.filter((c) => c.license !== 'CC-BY').map(line), '',
  ].join('\n'));
  const total = index.reduce((a, p) => a + p.bytes, 0) + pages.reduce((a, f) => a + fs.statSync(path.join(OUT, f)).size, 0);
  log(`${index.length} people, ${(total / 1048576).toFixed(1)} MB with the atlas`);
}

main().catch((e) => { console.error(e); process.exit(1); });
