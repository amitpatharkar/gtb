// Car models for the game: each upload in public/art/vehicles/ (named in src/vehicles/cars.js) becomes
// a light copy in public/art/cars/<id>.glb with glTF-Transform and meshoptimizer:
//   - textures removed (they carry real badges and number plates); each colour texture's average
//     colour is folded into its material's base colour, so tyres stay dark and glass stays tinted
//   - duplicate meshes and materials merged, unused data pruned, vertices welded
//   - simplified to a triangle budget (node names are kept: the game finds the wheels by name)
//   - compressed with EXT_meshopt_compression (decoded in the browser by three.js' MeshoptDecoder)
// Skips a car whose output is newer than its upload and this script. Run by `npm run build`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { NodeIO, Logger } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, prune, weld, simplify, reorder, quantize, getBounds } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { CARS } from '../src/vehicles/cars.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'public/art/vehicles'), OUT = path.join(ROOT, 'public/art/cars');
const BUDGET = 70000; // triangles per car (the player looks at them up close)
const force = process.argv.includes('--force');

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const quiet = new Logger(Logger.Verbosity.WARN);
const io = new NodeIO().setLogger(quiet).registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
fs.mkdirSync(OUT, { recursive: true });
const self = fs.statSync(fileURLToPath(import.meta.url)).mtimeMs;
const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

async function averageColour(texture) {
  const img = texture.getImage();
  if (!img) return null;
  try {
    const { data, info } = await sharp(Buffer.from(img)).resize(16, 16, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < data.length; i += info.channels) { if (data[i + 3] < 16) continue; r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; }
    return n ? [srgbToLinear(r / n / 255), srgbToLinear(g / n / 255), srgbToLinear(b / n / 255)] : null;
  } catch { return null; }
}

const triangles = (doc) => doc.getRoot().listMeshes().reduce((s, m) => s + m.listPrimitives().reduce((t, p) => t + (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3, 0), 0);

for (const [id, car] of Object.entries(CARS)) {
  const src = path.join(SRC, car.file), out = path.join(OUT, `${id}.glb`);
  if (!fs.existsSync(src)) { console.warn(`cars: ${car.file} missing`); continue; }
  if (!force && fs.existsSync(out) && fs.statSync(out).mtimeMs > Math.max(fs.statSync(src).mtimeMs, self)) continue;
  const doc = (await io.read(src)).setLogger(quiet);
  const before = triangles(doc);
  // Textures → average colours, then away.
  for (const m of doc.getRoot().listMaterials()) {
    const base = m.getBaseColorTexture();
    if (base) { const c = await averageColour(base); if (c) { const f = m.getBaseColorFactor(); m.setBaseColorFactor([f[0] * c[0], f[1] * c[1], f[2] * c[2], f[3]]); } }
    const em = m.getEmissiveTexture();
    if (em) { const c = await averageColour(em); if (c) { const f = m.getEmissiveFactor(); m.setEmissiveFactor([f[0] * c[0], f[1] * c[1], f[2] * c[2]]); } }
    for (const k of ['BaseColor', 'Emissive', 'Normal', 'Occlusion', 'MetallicRoughness']) m[`set${k}Texture`](null);
  }
  for (const t of doc.getRoot().listTextures()) t.dispose();
  await doc.transform(dedup(), prune(), weld());
  const mid = triangles(doc);
  if (mid > BUDGET) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: BUDGET / mid, error: 0.002, lockBorder: true }));
  await doc.transform(prune(), reorder({ encoder: MeshoptEncoder }), quantize());
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  await io.write(out, doc);
  const b = getBounds(doc.getRoot().listScenes()[0]);
  console.log(`cars: ${id} ${(fs.statSync(src).size / 1e6).toFixed(1)} MB → ${(fs.statSync(out).size / 1e6).toFixed(2)} MB, ${Math.round(before / 1000)}k → ${Math.round(triangles(doc) / 1000)}k triangles, ${b.max.map((v, i) => (v - b.min[i]).toFixed(2)).join(' × ')}`);
}
