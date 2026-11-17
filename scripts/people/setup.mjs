// Tools for scripts/people/build-people.mjs, downloaded once into the cache folder
// (`node scripts/people/build-people.mjs --setup`, or this file directly):
// Blender 4.2 LTS, the MakeHuman plugin for Blender (MPFB 2, GPL program; its bodies and
// assets are CC0) and the MakeHuman asset packs the population uses (CC0 and CC BY).
// The MakeHuman file server drops connections often, so big files come in parallel
// byte ranges, each resumed until complete.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const BLENDER = { version: '4.2.3', url: 'https://download.blender.org/release/Blender4.2/blender-4.2.3-linux-x64.tar.xz' };
export const MPFB = { version: '2.0.18', url: 'https://extensions.blender.org/download/sha256:c075b3e9b94b8e5556a5f03f4653602d02ea306de08126e8f55ed6dee28a2dad/add-on-mpfb-v2.0.18.zip?repository=%2Fapi%2Fv1%2Fextensions%2F&blender_version_min=4.2.0' };
const PACK_HOSTS = ['https://files.makehumancommunity.org', 'https://files2.makehumancommunity.org'];
/** Asset packs: [file path on the MakeHuman file server, licence]. */
export const PACKS = [
  ['asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip', 'CC0'],
  ['functional/faceunits01.zip', 'CC0'],
  ['asset_packs/skins01/skins01_cc0.zip', 'CC0'],
  ['asset_packs/skins02/skins02_cc0.zip', 'CC0'],
  ['asset_packs/eyebrows01/eyebrows01_cc0.zip', 'CC0'],
  ['asset_packs/eyelashes01/eyelashes01_cc0.zip', 'CC0'],
  ['asset_packs/hair03/hair03_ccby.zip', 'CC-BY'],
  ['asset_packs/bodyparts05/bodyparts05_cc0.zip', 'CC0'],
  ['asset_packs/bodyparts06/bodyparts06_cc-by.zip', 'CC-BY'],
  ['asset_packs/shirts01/shirts01_cc0.zip', 'CC0'],
  ['asset_packs/shirts02/shirts02_ccby.zip', 'CC-BY'],
  ['asset_packs/shirts03/shirts03_ccby.zip', 'CC-BY'],
  ['asset_packs/pants01/pants01_cc0.zip', 'CC0'],
  ['asset_packs/pants02/pants02_ccby.zip', 'CC-BY'],
  ['asset_packs/shoes01/shoes01_cc0.zip', 'CC0'],
  ['asset_packs/shoes02/shoes02_ccby.zip', 'CC-BY'],
  ['asset_packs/skirts01/skirts01_cc0.zip', 'CC0'],
  ['asset_packs/glasses01/glasses01_cc0.zip', 'CC0'],
];

export const TOOLS = (cache) => {
  const userResources = path.join(cache, 'bl_user');
  return {
    blender: path.join(cache, `blender-${BLENDER.version}-linux-x64`, 'blender'),
    userResources,
    data: path.join(userResources, 'extensions/.user/user_default/mpfb/data'),
    downloads: path.join(cache, 'downloads'),
  };
};

const log = (...a) => console.log('[people setup]', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function size(url) {
  for (let t = 0; t < 8; t++) {
    try { const r = await fetch(url, { method: 'HEAD' }); if (r.ok) return Number(r.headers.get('content-length')); } catch { /* retry */ }
    await sleep(1000 * (t + 1));
  }
  throw new Error(`no size for ${url}`);
}

/** Download `urls` (mirrors) to `file` in `parts` parallel ranges, resuming each range. */
export async function download(urls, file, parts = 8) {
  if (fs.existsSync(file)) return;
  const total = await size(urls[0]).catch(() => size(urls[1]));
  const chunk = Math.ceil(total / parts);
  const bufs = await Promise.all(Array.from({ length: parts }, async (_, i) => {
    const a = i * chunk, b = Math.min(total, a + chunk) - 1;
    const got = [];
    let have = 0;
    for (let t = 0; have < b - a + 1; t++) {
      if (t > 300) throw new Error(`gave up on ${file} part ${i}`);
      const url = urls[t % urls.length];
      try {
        const r = await fetch(url, { headers: { Range: `bytes=${a + have}-${b}` } });
        if (r.status !== 206 && !(r.status === 200 && parts === 1)) throw new Error(`HTTP ${r.status}`);
        const reader = r.body.getReader();
        for (;;) { const { done, value } = await reader.read(); if (done) break; got.push(Buffer.from(value)); have += value.length; }
      } catch { await sleep(500 + 200 * Math.min(t, 10)); }
    }
    return Buffer.concat(got).subarray(0, b - a + 1);
  }));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.part`, Buffer.concat(bufs));
  fs.renameSync(`${file}.part`, file);
  log('downloaded', path.basename(file), `${(total / 1048576).toFixed(0)} MB`);
}

export async function setup(cache) {
  const T = TOOLS(cache);
  fs.mkdirSync(T.downloads, { recursive: true });
  if (!fs.existsSync(T.blender)) {
    const tar = path.join(T.downloads, `blender-${BLENDER.version}.tar.xz`);
    await download([BLENDER.url], tar, 4);
    execFileSync('tar', ['-xJf', tar, '-C', cache]);
  }
  const ext = path.join(T.userResources, 'extensions/user_default/mpfb');
  if (!fs.existsSync(ext)) {
    const zip = path.join(T.downloads, `mpfb-${MPFB.version}.zip`);
    await download([MPFB.url], zip, 1);
    execFileSync(T.blender, ['--background', '--factory-startup', '-c', 'extension', 'install-file', '-r', 'user_default', '-e', zip], { env: { ...process.env, BLENDER_USER_RESOURCES: T.userResources }, stdio: 'ignore' });
  }
  fs.mkdirSync(T.data, { recursive: true });
  for (const [p] of PACKS) {
    const zip = path.join(T.downloads, path.basename(p));
    const mark = path.join(T.data, 'packs', `.gtb-${path.basename(p)}`);
    if (fs.existsSync(mark)) continue;
    await download(PACK_HOSTS.map((h) => `${h}/${p}`), zip);
    execFileSync('unzip', ['-q', '-o', zip, '-d', T.data]);
    fs.mkdirSync(path.dirname(mark), { recursive: true });
    fs.writeFileSync(mark, '');
  }
  log('tools ready in', cache);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  setup(path.resolve(process.argv[2] || '.people-cache')).catch((e) => { console.error(e); process.exit(1); });
}
