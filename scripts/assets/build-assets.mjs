#!/usr/bin/env node
/**
 * Asset pipeline: download the free assets listed in docs/research/assets.json, compress
 * them for the web and write them to out/assets. CI publishes that folder to the
 * "assets" branch (see .github/workflows/assets.yml); the deploy copies it to public/media.
 *
 *   node scripts/assets/build-assets.mjs [--only id,id] [--size 1024] [--out out/assets]
 *                                        [--cache .asset-cache] [--list docs/research/assets.json]
 *
 * Stage 1 (now): textures → KTX2 (colour, normal, packed occlusion/roughness/metalness),
 * sky HDRIs → 1K .hdr, sounds → .ogg, fonts → .ttf + licence file.
 * Stage 2 (later): models (trees, vehicles, props, characters) → optimised .glb.
 * Skipped: entries that need a login, fallbacks and heavy source models.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import sharp from 'sharp';
import { unzipSync } from 'fflate';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const LIST = path.resolve(root, args.list || 'docs/research/assets.json');
const OUT = path.resolve(root, args.out || 'out/assets');
const CACHE = path.resolve(root, args.cache || '.asset-cache');
const SIZE = Number(args.size || 1024);
const ONLY = args.only ? new Set(args.only.split(',')) : null;
const STAGE1 = new Set(['texture', 'hdri', 'sound', 'font']);
const MODELS = new Set(['tree', 'vehicle', 'prop', 'character', 'animation']);
const MODEL_BUDGET = 24 * 1024 * 1024; // per asset, so one big pack can't bloat the site
const UA = 'Mozilla/5.0 (compatible; asset-fetcher/1.0)'; // generic: no project details sent out
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0).padStart(4)}s]`, ...a);

// ------------------------------------------------------------------ helpers
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function cacheName(url) {
  const u = new URL(url);
  const file = u.searchParams.get('file') || decodeURIComponent(path.basename(u.pathname)) || 'download';
  return file.replace(/[^\w.\-[\],]+/g, '_');
}

async function download(url, id) {
  const dir = path.join(CACHE, id);
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, cacheName(url));
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return dest;
  if (url.startsWith('file://')) { fs.copyFileSync(fileURLToPath(url), dest); return dest; }
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(180_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (!buf.length) throw new Error('empty response');
      fs.writeFileSync(dest + '.part', buf);
      fs.renameSync(dest + '.part', dest);
      return dest;
    } catch (e) {
      if (attempt >= 3) throw new Error(`${url}: ${e.message}`);
      await sleep(3000 * attempt);
    }
  }
}

async function fetchJson(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30_000) });
    return res.ok ? await res.json() : null;
  } catch { return null; }
}

/** Run async jobs with at most n in flight. */
async function pool(items, n, fn) {
  const results = [];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) { const i = next++; results[i] = await fn(items[i], i); }
  }));
  return results;
}

/** Parallel KTX2 encoding in worker threads. */
class Encoder {
  constructor(n) {
    this.jobs = new Map();
    this.nextId = 1;
    this.queue = [];
    this.idle = [];
    this.workers = Array.from({ length: n }, () => {
      const w = new Worker(new URL('./encode-worker.mjs', import.meta.url));
      w.on('message', ({ id, ktx2, error }) => {
        const job = this.jobs.get(id);
        this.jobs.delete(id);
        error ? job.reject(new Error(error)) : job.resolve(Buffer.from(ktx2));
        this.idle.push(w);
        this.pump();
      });
      this.idle.push(w);
      return w;
    });
  }
  encode(png, preset) {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.jobs.set(id, { resolve, reject });
      this.queue.push({ id, png: new Uint8Array(png), preset }); // own copy, safe to transfer
      this.pump();
    });
  }
  pump() {
    while (this.idle.length && this.queue.length) {
      const w = this.idle.pop();
      const job = this.queue.shift();
      w.postMessage(job, [job.png.buffer]);
    }
  }
  close() { return Promise.all(this.workers.map((w) => w.terminate())); }
}

// ------------------------------------------------------------------ textures
/** Which PBR map a file name is, or null. */
function mapKind(name) {
  const n = path.basename(name).toLowerCase();
  if (!/\.(jpe?g|png)$/.test(n)) return null;
  if (/(normal|nor)[_\-.]?(gl|opengl)|normalgl/.test(n)) return 'normalGL';
  if (/(normal|nor)[_\-.]?(dx|directx)|normaldx/.test(n)) return 'normalDX';
  if (/normal|_nor[_.]/.test(n)) return 'normalGL';
  if (/rough/.test(n)) return 'rough';
  if (/ambientocclusion|occlusion|[_\-]ao[_\-.]/.test(n)) return 'ao';
  if (/(disp|height|displacement|metal|opacity|bump|spec|_arm[_.])/.test(n)) return null;
  if (/(color|colour|albedo|basecolor|base_color|_diff[_.]|diffuse)/.test(n)) return 'color';
  return null;
}

/** Collect { color, normalGL|normalDX, rough, ao } buffers for one texture entry. */
async function textureMaps(a) {
  const maps = {};
  const urls = [a.download_url, ...(a.extra_urls || [])];
  for (const url of urls) {
    const file = await download(url, a.id);
    if (/\.zip$/i.test(file)) {
      const entries = unzipSync(new Uint8Array(fs.readFileSync(file)));
      for (const [name, data] of Object.entries(entries)) {
        const k = mapKind(name);
        if (k && !maps[k]) maps[k] = Buffer.from(data);
      }
    } else {
      const k = mapKind(file) || (url === a.download_url ? 'color' : null);
      if (k && !maps[k]) maps[k] = fs.readFileSync(file);
    }
  }
  if (!maps.color) throw new Error('no colour map found');
  return maps;
}

async function processTexture(a, enc) {
  const maps = await textureMaps(a);
  const meta = await sharp(maps.color).metadata();
  const w = Math.min(SIZE, meta.width);
  const h = Math.max(4, Math.round((w * meta.height) / meta.width / 4) * 4);
  const fit = { width: w, height: h, fit: 'fill' }; // never crop: keeps the texture tileable
  const dir = path.join(OUT, 'textures', a.id);
  fs.mkdirSync(dir, { recursive: true });
  const jobs = [];
  const files = [];

  const colorPng = await sharp(maps.color).resize(fit).removeAlpha().png().toBuffer();
  jobs.push(enc.encode(colorPng, 'color').then((k) => { fs.writeFileSync(path.join(dir, 'color.ktx2'), k); files.push('color.ktx2'); }));

  const nBuf = maps.normalGL || maps.normalDX;
  if (nBuf) {
    const { data, info } = await sharp(nBuf).resize(fit).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    if (!maps.normalGL) for (let i = 1; i < data.length; i += info.channels) data[i] = 255 - data[i]; // DirectX → OpenGL
    const png = await sharp(data, { raw: info }).png().toBuffer();
    jobs.push(enc.encode(png, 'normal').then((k) => { fs.writeFileSync(path.join(dir, 'normal.ktx2'), k); files.push('normal.ktx2'); }));
  }

  if (maps.rough || maps.ao) {
    // Packed like glTF: red = ambient occlusion, green = roughness, blue = metalness (0).
    const grey = async (buf, fill) => buf
      ? (await sharp(buf).resize(fit).greyscale().raw().toBuffer())
      : Buffer.alloc(w * h, fill);
    const ao = await grey(maps.ao, 255), rough = await grey(maps.rough, 204);
    const orm = Buffer.alloc(w * h * 3);
    for (let i = 0; i < w * h; i++) { orm[i * 3] = ao[i]; orm[i * 3 + 1] = rough[i]; }
    const png = await sharp(orm, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
    jobs.push(enc.encode(png, 'data').then((k) => { fs.writeFileSync(path.join(dir, 'orm.ktx2'), k); files.push('orm.ktx2'); }));
  }
  await Promise.all(jobs);

  // Real-world size helps set texture scale. Poly Haven publishes it in millimetres.
  const extra = { pixels: [w, h], hasAO: !!maps.ao, hasRoughness: !!maps.rough };
  const ph = a.source_page.match(/polyhaven\.com\/a\/([\w-]+)/);
  if (ph) {
    const info = await fetchJson(`https://api.polyhaven.com/info/${ph[1]}`);
    if (info?.dimensions) extra.metres = info.dimensions.map((mm) => mm / 1000);
  }
  return { files: files.sort().map((f) => `textures/${a.id}/${f}`), meta: extra };
}

// ------------------------------------------------------------------ other categories
async function processHdri(a) {
  // 1K is plenty for sky lighting and reflections; fall back to the listed 2K file.
  const oneK = a.download_url.replace('/2k/', '/1k/').replace('_2k.hdr', '_1k.hdr');
  let file;
  try { file = await download(oneK, a.id); } catch { file = await download(a.download_url, a.id); }
  const rel = `hdri/${a.id}.hdr`;
  fs.mkdirSync(path.join(OUT, 'hdri'), { recursive: true });
  fs.copyFileSync(file, path.join(OUT, rel));
  return { files: [rel], meta: { resolution: file.includes('_1k') ? '1k' : '2k' } };
}

async function processSound(a) {
  const file = await download(a.download_url, a.id);
  const ext = path.extname(file) || '.ogg';
  const rel = `sounds/${a.id}${ext}`;
  fs.mkdirSync(path.join(OUT, 'sounds'), { recursive: true });
  fs.copyFileSync(file, path.join(OUT, rel));
  return { files: [rel] };
}

async function processFont(a) {
  const file = await download(a.download_url, a.id);
  fs.mkdirSync(path.join(OUT, 'fonts'), { recursive: true });
  const rel = `fonts/${a.id}${path.extname(file)}`;
  fs.copyFileSync(file, path.join(OUT, rel));
  const files = [rel];
  // The Open Font License must travel with the font.
  if (a.download_url.includes('/google/fonts/')) {
    try {
      const lic = await download(a.download_url.replace(/\/[^/]+$/, '/OFL.txt'), a.id);
      fs.copyFileSync(lic, path.join(OUT, `fonts/${a.id}.OFL.txt`));
      files.push(`fonts/${a.id}.OFL.txt`);
    } catch (e) { log(`  ${a.id}: licence file not found (${e.message})`); }
  }
  return { files };
}

// ------------------------------------------------------------------ models (stage 2)
const safeName = (n) => n.replace(/[^\w.\-/]+/g, '_').replace(/^\/+/, '');

/**
 * Models: Poly Haven glTF (with its .bin and textures), or a zip pack. Packs get a full
 * contents listing (_contents.txt) and their .glb files (else .gltf + sibling files).
 * FBX/OBJ-only packs are listed but not converted yet.
 */
async function processModel(a) {
  const files = [];
  let budget = MODEL_BUDGET, count = 0;
  const put = (name, data) => {
    if (budget - data.length < 0) return false;
    const rel = `models/${a.id}/${safeName(name)}`;
    fs.mkdirSync(path.dirname(path.join(OUT, rel)), { recursive: true });
    fs.writeFileSync(path.join(OUT, rel), data);
    files.push(rel);
    budget -= data.length;
    return true;
  };
  const ph = a.source_page.match(/polyhaven\.com\/a\/([\w-]+)/);
  if (ph && a.format === 'gltf') {
    const info = await fetchJson(`https://api.polyhaven.com/files/${ph[1]}`);
    const g = info?.gltf?.['1k']?.gltf;
    if (!g) throw new Error('Poly Haven file list has no 1k glTF');
    put(path.basename(new URL(g.url).pathname), fs.readFileSync(await download(g.url, a.id)));
    for (const [rel, inc] of Object.entries(g.include || {})) put(rel, fs.readFileSync(await download(inc.url, a.id)));
    return { files, meta: { models: 1 } };
  }
  const file = await download(a.download_url, a.id);
  if (!/\.zip$/i.test(file) && a.format !== 'zip') {
    put(path.basename(file), fs.readFileSync(file));
    return { files, meta: { models: 1 } };
  }
  const entries = unzipSync(new Uint8Array(fs.readFileSync(file)));
  const names = Object.keys(entries).filter((n) => !n.startsWith('__MACOSX') && !n.endsWith('/'));
  const listing = names.map((n) => `${entries[n].length}\t${n}`);
  const glbs = names.filter((n) => /\.glb$/i.test(n));
  const gltfs = names.filter((n) => /\.gltf$/i.test(n));
  if (glbs.length) {
    for (const n of glbs.sort()) if (put(n, Buffer.from(entries[n]))) count++;
  } else {
    for (const n of gltfs.sort()) {
      const dir = path.dirname(n);
      const sib = names.filter((m) => path.dirname(m) === dir && /\.(bin|png|jpe?g|webp)$/i.test(m));
      if (put(n, Buffer.from(entries[n]))) { count++; for (const m of sib) if (!files.includes(`models/${a.id}/${safeName(m)}`)) put(m, Buffer.from(entries[m])); }
    }
  }
  const listPath = `models/${a.id}/_contents.txt`;
  fs.mkdirSync(path.join(OUT, 'models', a.id), { recursive: true });
  fs.writeFileSync(path.join(OUT, listPath), listing.join('\n'));
  files.push(listPath);
  return { files, meta: { models: count, packFiles: names.length, formats: [...new Set(names.map((n) => path.extname(n).toLowerCase()))].filter(Boolean) } };
}

// ------------------------------------------------------------------ main
const list = JSON.parse(fs.readFileSync(LIST, 'utf8'));
const selected = [], skipped = [];
for (const a of list) {
  const why = ONLY && !ONLY.has(a.id) ? null
    : a.login_required ? 'needs a login'
    : a.fallback ? 'fallback entry'
    : a.heavy ? 'heavy source model'
    : !STAGE1.has(a.category) && !MODELS.has(a.category) ? 'unknown category'
    : '';
  if (why === null) continue;
  if (why) skipped.push({ id: a.id, reason: why });
  else selected.push(a);
}
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const threads = Math.max(1, Math.min(8, (os.availableParallelism?.() || os.cpus().length)));
log(`${selected.length} assets to build (${skipped.length} skipped), ${threads} encoder threads, textures at ${SIZE}px`);

const enc = new Encoder(threads);
const built = [], failed = [];
await pool(selected, threads + 2, async (a) => {
  try {
    const fn = MODELS.has(a.category) ? processModel : { texture: (x) => processTexture(x, enc), hdri: processHdri, sound: processSound, font: processFont }[a.category];
    const r = await fn(a);
    const kb = r.files.reduce((s, f) => s + fs.statSync(path.join(OUT, f)).size, 0) / 1024;
    log(`ok   ${a.id} (${kb.toFixed(0)} KB)`);
    built.push({
      id: a.id, category: a.category, title: a.title, use: a.use, licence: a.licence, author: a.author,
      attribution: a.attribution, source_page: a.source_page, files: r.files, ...(r.meta ? { meta: r.meta } : {}),
    });
  } catch (e) {
    log(`FAIL ${a.id}: ${e.message.split('\n')[0]}`);
    failed.push({ id: a.id, error: e.message.split('\n')[0] });
  }
});
await enc.close();

built.sort((a, b) => a.category.localeCompare(b.category) || a.id.localeCompare(b.id));
const manifest = { generated: new Date().toISOString(), textureSize: SIZE, assets: built, skipped, failed };
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));

// Human-readable credits (CC-BY needs attribution wherever the files are distributed).
const credits = ['# Asset credits', '', 'Generated from docs/research/assets.json by scripts/assets/build-assets.mjs.', ''];
const byLicence = (l) => built.filter((a) => a.licence === l);
const ccby = built.filter((a) => a.licence.startsWith('CC-BY'));
if (ccby.length) credits.push('## Creative Commons Attribution', '', ...ccby.map((a) => `- ${a.attribution || `"${a.title}" by ${a.author} (${a.source_page}), ${a.licence}`}`), '');
if (byLicence('OFL-1.1').length) credits.push('## Fonts (SIL Open Font License 1.1, licence files in fonts/)', '', ...byLicence('OFL-1.1').map((a) => `- ${a.title} by ${a.author}`), '');
if (byLicence('CC0-1.0').length) credits.push('## Public domain (CC0), with thanks', '', ...byLicence('CC0-1.0').map((a) => `- ${a.title} by ${a.author} — ${a.source_page}`), '');
fs.writeFileSync(path.join(OUT, 'CREDITS.md'), credits.join('\n'));

let total = 0;
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => e.isDirectory() ? walk(path.join(d, e.name)) : (total += fs.statSync(path.join(d, e.name)).size));
walk(OUT);
const summary = `Built ${built.length} assets (${(total / 1024 / 1024).toFixed(1)} MB), ${failed.length} failed, ${skipped.length} skipped.`;
log(summary);
for (const f of failed) log(`  failed: ${f.id}: ${f.error}`);
if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Assets\n\n${summary}\n\n${failed.map((f) => `- ❌ \`${f.id}\`: ${f.error}`).join('\n')}\n`);
}
