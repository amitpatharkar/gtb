// After "vite build": ship only the media the game uses, and lighter street props.
// Run by "npm run build" (so by the deploy); works on dist/media only — public/media (the
// copy of the "assets" branch) is never touched, so "npm run dev" still sees everything.
//
// 1. Which assets ship: every asset whose id appears in the game's code (src/**/*.js and
//    index.html). The code names its assets by id as plain strings — lib.apply(mat,
//    'tex-ph-asphalt-02'), lib.url('font-baloo2'), the sound table in audio.js, the model
//    folders in streetProps.js — so a scan finds them without a hand-kept list that could
//    drift. An id built at run time (`tex-${name}`) cannot be seen by the scan: the script
//    warns about such template strings and then keeps every asset with that prefix.
//    Model packs ship only the converted models named in the code ('Casual_Male', …).
// 2. Everything else in dist/media is deleted, and manifest.json + CREDITS.md are rewritten
//    to list exactly what ships (the in-game Credits panel reads the manifest).
// 3. Poly Haven street props (scanned, 3–14k triangles each, repeated hundreds of times near
//    the player) are simplified with meshoptimizer to a triangle budget, their textures cut to
//    512 px, and the packed roughness/metalness/occlusion maps (which models.js drops anyway)
//    replaced by their average values.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { MeshoptSimplifier } from 'meshoptimizer';
import { readAccessor, GlbWriter } from './lib/glb.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DIST = path.join(ROOT, 'dist'), MEDIA = path.join(DIST, 'media');
const MANIFEST = path.join(MEDIA, 'manifest.json');
// Triangle budgets for the scanned props (whole model; the metal bin file holds two bins).
const PROP_BUDGET = { 'prop-ph-trashbag': 600, 'prop-ph-plastic-crate-02': 1200, 'prop-ph-plastic-monobloc-chair-01': 1100, 'prop-ph-metal-trash-can': 2400, 'prop-ph-utility-box-01': 700, 'prop-ph-wooden-crate-02': 700 };
const PROP_TEXTURE = 512;

if (!fs.existsSync(MANIFEST)) { console.log('ship-media: no media in dist/ (no assets branch yet) — nothing to trim'); process.exit(0); }
// Never follow a link out of dist/ (a symlinked public/media must not be emptied).
const real = (p) => fs.realpathSync(p);
if (fs.lstatSync(MEDIA).isSymbolicLink() || !real(MEDIA).startsWith(real(DIST) + path.sep)) {
  console.error('ship-media: dist/media is a link outside dist/ — refusing to delete anything'); process.exit(1);
}

const walk = (d, out = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p, out); else out.push(p); } return out; };
const size = (files) => files.reduce((s, f) => s + fs.statSync(f).size, 0);
const MB = (b) => `${(b / 1048576).toFixed(1)} MB`;
const before = size(walk(MEDIA));

// ------------------------------------------------------------------ 1. what the code uses
const code = [path.join(ROOT, 'index.html'), ...walk(path.join(ROOT, 'src')).filter((f) => f.endsWith('.js'))].map((f) => fs.readFileSync(f, 'utf8')).join('\n');
const words = new Set(code.match(/[a-z0-9]+(?:-[a-z0-9]+)+/g));
const quoted = new Set([...code.matchAll(/['"`]([A-Za-z0-9_]+)['"`]/g)].map((m) => m[1]));
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const prefixes = new Set(manifest.assets.map((a) => a.id.split('-')[0]));
const dynamic = new Set();
for (const m of code.matchAll(/`[^`]*?\b([a-z]+)-\$\{/g)) if (prefixes.has(m[1])) dynamic.add(m[1]);
for (const p of dynamic) console.warn(`ship-media: WARNING: the code builds "${p}-…" asset ids at run time; keeping every ${p}-* asset`);

const kept = [], removed = [];
for (const a of manifest.assets) {
  if (!words.has(a.id) && !dynamic.has(a.id.split('-')[0])) { removed.push(a); continue; }
  // Packs of converted models: only the models the code names.
  const files = a.files.filter((f) => { const m = f.match(/\/converted\/([^/]+)\.glb$/); return !m || quoted.has(m[1]); });
  kept.push({ ...a, files });
}

// ------------------------------------------------------------------ 2. delete the rest
const keep = new Set(['manifest.json', 'CREDITS.md', ...kept.flatMap((a) => a.files)].map((f) => path.join(MEDIA, f)));
for (const f of walk(MEDIA)) if (!keep.has(f)) fs.rmSync(f);
const prune = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) if (e.isDirectory()) { prune(path.join(d, e.name)); if (!fs.readdirSync(path.join(d, e.name)).length) fs.rmdirSync(path.join(d, e.name)); } };
prune(MEDIA);

// ------------------------------------------------------------------ 3. lighter street props
await MeshoptSimplifier.ready;
for (const a of kept) {
  if (!PROP_BUDGET[a.id]) continue;
  const gltf = a.files.find((f) => f.endsWith('.gltf'));
  if (!gltf) continue;
  try {
    const r = await lightenGltf(path.join(MEDIA, gltf), PROP_BUDGET[a.id]);
    a.files = a.files.filter((f) => !r.dropped.includes(f));
    console.log(`ship-media: ${a.id}: ${r.before} → ${r.after} triangles, ${MB(r.bytesBefore)} → ${MB(r.bytesAfter)}`);
  } catch (e) { console.warn(`ship-media: ${a.id} left as it is (${e.message})`); }
}

/**
 * Simplify every primitive of a .gltf (external .bin, uncompressed) to share `budget`
 * triangles; textures to PROP_TEXTURE px; metallic-roughness/occlusion maps → factors.
 * Rewrites the .gltf and .bin in place; returns the dropped files (relative to media/).
 */
async function lightenGltf(file, budget) {
  const dir = path.dirname(file), json = JSON.parse(fs.readFileSync(file, 'utf8'));
  if ((json.extensionsRequired || []).length || json.buffers?.length !== 1 || !json.buffers[0].uri) throw new Error('unsupported glTF');
  const binFile = path.join(dir, decodeURIComponent(json.buffers[0].uri));
  const images = (json.images || []).map((img) => img.uri && path.join(dir, decodeURIComponent(img.uri)));
  const bytesBefore = size([file, binFile, ...new Set(images.filter(Boolean))]);
  const bin = fs.readFileSync(binFile);
  const prims = json.meshes.flatMap((m) => m.primitives);
  const tris = (p) => (p.indices !== undefined ? json.accessors[p.indices].count : json.accessors[p.attributes.POSITION].count) / 3;
  const total = prims.reduce((s, p) => s + tris(p), 0);
  const w = new GlbWriter(), done = new Map();
  let after = 0;
  for (const p of prims) {
    const key = JSON.stringify([p.attributes, p.indices]);
    if (done.has(key)) { Object.assign(p, done.get(key)); after += p._tris; delete p._tris; continue; }
    const pos = readAccessor(json, bin, p.attributes.POSITION, { float: true }).arr, count = pos.length / 3;
    let idx = p.indices !== undefined ? Uint32Array.from(readAccessor(json, bin, p.indices).arr) : Uint32Array.from({ length: count }, (_, i) => i);
    const want = Math.max(36, Math.floor((budget * tris(p)) / total) * 3);
    if (idx.length > want) {
      const [out] = MeshoptSimplifier.simplify(idx, pos, 3, want, 0.03);
      if (out.length >= 36) idx = out;
    }
    // Keep only the vertices still used (positions, normals, texture coordinates).
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
    const result = { attributes, indices: w.indices(idx, used) };
    after += idx.length / 3;
    done.set(key, { ...result, _tris: idx.length / 3 });
    Object.assign(p, result);
  }
  // Materials: the packed AO/roughness/metalness map becomes two numbers (its average).
  const texImage = (t) => json.textures[t.index].source;
  for (const m of json.materials || []) {
    const pbr = m.pbrMetallicRoughness || (m.pbrMetallicRoughness = {});
    if (pbr.metallicRoughnessTexture) {
      const src = images[texImage(pbr.metallicRoughnessTexture)];
      const { channels } = await sharp(src).stats();
      pbr.roughnessFactor = +((pbr.roughnessFactor ?? 1) * channels[1].mean / 255).toFixed(3);
      pbr.metallicFactor = +((pbr.metallicFactor ?? 1) * channels[2].mean / 255).toFixed(3);
      delete pbr.metallicRoughnessTexture;
    }
    delete m.occlusionTexture;
  }
  // Drop textures and images nothing refers to any more; renumber the rest.
  const usedTex = new Set();
  const refs = (o) => { if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { if (/Texture$/.test(k) && v && v.index !== undefined) usedTex.add(v.index); else refs(v); } };
  refs(json.materials);
  const texMap = new Map(), imgMap = new Map(), textures = [], keepImages = [];
  [...usedTex].sort((x, y) => x - y).forEach((t) => {
    const tex = json.textures[t];
    if (!imgMap.has(tex.source)) { imgMap.set(tex.source, keepImages.length); keepImages.push(tex.source); }
    texMap.set(t, textures.length); textures.push({ ...tex, source: imgMap.get(tex.source) });
  });
  const renumber = (o) => { if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { if (/Texture$/.test(k) && v && v.index !== undefined) v.index = texMap.get(v.index); else renumber(v); } };
  renumber(json.materials);
  const dropped = [];
  for (let i = 0; i < images.length; i++) if (!keepImages.includes(i) && images[i] && fs.existsSync(images[i])) { fs.rmSync(images[i]); dropped.push(path.relative(MEDIA, images[i])); }
  json.textures = textures;
  json.images = keepImages.map((i) => json.images[i]);
  // Textures: 512 px is plenty for objects under a metre and a half.
  for (const img of json.images) {
    const src = path.join(dir, decodeURIComponent(img.uri));
    const meta = await sharp(src).metadata();
    if ((meta.width || 0) <= PROP_TEXTURE) continue;
    const out = await sharp(src).resize(PROP_TEXTURE, PROP_TEXTURE, { fit: 'inside' }).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
    fs.writeFileSync(src, out); // same name, so the manifest and the .gltf stay valid
    img.mimeType = 'image/jpeg';
  }
  // Geometry: new buffer views and accessors in the same .bin file.
  json.bufferViews = w.views; json.accessors = w.accessors;
  json.buffers = [{ uri: json.buffers[0].uri, byteLength: w.length }];
  fs.writeFileSync(binFile, Buffer.concat(w.chunks));
  fs.writeFileSync(file, JSON.stringify(json));
  const imagesNow = json.images.map((img) => path.join(dir, decodeURIComponent(img.uri)));
  return { before: Math.round(total), after: Math.round(after), dropped, bytesBefore, bytesAfter: size([file, binFile, ...new Set(imagesNow)]) };
}

// ------------------------------------------------------------------ manifest + credits
const shipped = { ...manifest, assets: kept, shipped: { by: 'scripts/ship-media.mjs', assets: kept.length, removed: removed.map((a) => a.id) } };
fs.writeFileSync(MANIFEST, JSON.stringify(shipped, null, 1));
const credits = ['# Asset credits', '', 'The assets this build ships (generated from docs/research/assets.json by scripts/assets/build-assets.mjs, trimmed by scripts/ship-media.mjs).', ''];
const byLicence = (l) => kept.filter((a) => a.licence === l);
const ccby = kept.filter((a) => a.licence.startsWith('CC-BY'));
if (ccby.length) credits.push('## Creative Commons Attribution', '', ...ccby.map((a) => `- ${a.attribution || `"${a.title}" by ${a.author} (${a.source_page}), ${a.licence}`}`), '');
if (byLicence('OFL-1.1').length) credits.push('## Fonts (SIL Open Font License 1.1, licence files in fonts/)', '', ...byLicence('OFL-1.1').map((a) => `- ${a.title} by ${a.author}`), '');
if (byLicence('CC0-1.0').length) credits.push('## Public domain (CC0), with thanks', '', ...byLicence('CC0-1.0').map((a) => `- ${a.title} by ${a.author} — ${a.source_page}`), '');
fs.writeFileSync(path.join(MEDIA, 'CREDITS.md'), credits.join('\n'));

const afterBytes = size(walk(MEDIA));
console.log(`ship-media: ${kept.length} of ${manifest.assets.length} assets ship, media ${MB(before)} → ${MB(afterBytes)}${removed.length ? ` (left out: ${removed.map((a) => a.id).join(', ')})` : ''}`);
