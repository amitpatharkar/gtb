// Motion for the game's people: `node scripts/people/build-anims.mjs` retargets free
// animation libraries onto the MakeHuman game skeleton in Blender (scripts/people/blender/
// retarget.py) and writes public/people/anims.glb (one glTF animation per clip, on the
// reference skeleton; the game plays them as deltas from each body's own rest pose).
// Sources: Quaternius Universal Animation Library 1 and 2 (CC0), downloaded into the cache.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { TOOLS, download } from './setup.mjs';
import { Writer } from './glbwriter.mjs';
import { readGlb, readAccessor } from '../lib/glb.mjs';
import { MeshoptEncoder } from 'meshoptimizer';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const CACHE = path.resolve(ROOT, process.argv.find((a) => a.startsWith('--cache='))?.slice(8) || '.people-cache');
const OUT = path.join(ROOT, 'public/people/anims.glb');

const UAL1 = { zip: 'https://opengameart.org/sites/default/files/universal_animation_librarystandard.zip', file: 'Animation Library[Standard]/Unreal Engine/AL_Standard.fbx' };
const UAL2 = { zip: 'https://opengameart.org/sites/default/files/universal_animation_library_2standard.zip', file: 'Universal Animation Library 2 [Standard]/Unreal-Godot/UAL2_Standard.glb' };

/** [game name, source clip, options] — `once`: plays once and holds; `inPlace: false` keeps hip travel. */
const CLIPS = {
  UAL1: [
    ['idle', 'Idle_Loop'], ['talk', 'Idle_Talking_Loop'], ['walk', 'Walk_Loop'], ['walkFormal', 'Walk_Formal_Loop'],
    ['jog', 'Jog_Fwd_Loop'], ['sprint', 'Sprint_Loop'], ['crouch', 'Crouch_Idle_Loop'], ['crouchWalk', 'Crouch_Fwd_Loop'],
    ['sitDown', 'Sitting_Enter', { once: true }], ['sit', 'Sitting_Idle_Loop'], ['sitTalk', 'Sitting_Talking_Loop'], ['standUp', 'Sitting_Exit', { once: true }],
    ['guard', 'Punch_Enter', { once: true }], ['jab', 'Punch_Jab', { once: true }], ['cross', 'Punch_Cross', { once: true }],
    ['hitChest', 'Hit_Chest', { once: true }], ['hitHead', 'Hit_Head', { once: true }], ['fall', 'Death01', { once: true, inPlace: false }],
    ['drive', 'Driving_Loop'], ['push', 'Push_Loop'], ['interact', 'Interact', { once: true }], ['pickUp', 'PickUp_Table', { once: true }],
    ['dance', 'Dance_Loop'], ['fix', 'Fixing_Kneeling'], ['aim', 'Pistol_Aim_Neutral'], ['aimIdle', 'Pistol_Idle_Loop'], ['shoot', 'Pistol_Shoot', { once: true }],
    ['jumpStart', 'Jump_Start', { once: true }], ['jump', 'Jump_Loop'], ['jumpLand', 'Jump_Land', { once: true }],
  ],
  UAL2: [
    ['foldArms', 'Idle_FoldArms_Loop'], ['no', 'Idle_No_Loop'], ['phone', 'Idle_TalkingPhone_Loop'], ['rail', 'Idle_Rail_Loop'],
    ['railCall', 'Idle_Rail_Call', { once: true }], ['knockback', 'Hit_Knockback', { once: true, inPlace: false }], ['getUp', 'LayToIdle', { once: true, inPlace: false }],
    ['hook', 'Melee_Hook', { once: true }], ['throw', 'OverhandThrow', { once: true }], ['consume', 'Consume', { once: true }], ['yes', 'Yes', { once: true }],
    ['carry', 'Walk_Carry_Loop'], ['water', 'Farm_Watering'],
  ],
};
export const CLIP_INFO = Object.fromEntries(Object.values(CLIPS).flat().map(([name, , o = {}]) => [name, { once: !!o.once }]));

async function main() {
  const T = TOOLS(CACHE);
  const dir = path.join(CACHE, 'anim-src');
  fs.mkdirSync(dir, { recursive: true });
  const files = {};
  for (const [key, src] of Object.entries({ UAL1, UAL2 })) {
    const zip = path.join(T.downloads, path.basename(src.zip));
    await download([src.zip], zip, 2);
    const target = path.join(dir, key);
    if (!fs.existsSync(path.join(target, src.file))) execFileSync('unzip', ['-q', '-o', zip, '-d', target]);
    files[key] = path.join(target, src.file);
  }
  const spec = {
    sources: Object.entries(CLIPS).map(([key, list]) => ({
      file: files[key],
      clips: list.map(([name, from, o = {}]) => ({ name, from, ...o })),
    })),
  };
  const specFile = path.join(CACHE, 'clips.json');
  fs.writeFileSync(specFile, JSON.stringify(spec, null, 1));
  const r = spawnSync(T.blender, ['--background', '--python-exit-code', '1', '--python', path.join(HERE, 'blender/retarget.py'), '--', specFile, OUT],
    { env: { ...process.env, BLENDER_USER_RESOURCES: T.userResources }, encoding: 'utf8', maxBuffer: 64 << 20 });
  for (const l of `${r.stdout}\n${r.stderr}`.split('\n')) if (l.startsWith('[anims]') || /Error|Traceback/.test(l)) console.log(l);
  if (r.status !== 0) { console.log(r.stderr.slice(-3000)); process.exit(1); }
  await slim(OUT);
  fs.writeFileSync(path.join(ROOT, 'public/people/anims.json'), JSON.stringify({ clips: CLIP_INFO, bytes: fs.statSync(OUT).size }, null, 1));
  console.log('[anims]', `${(fs.statSync(OUT).size / 1048576).toFixed(2)} MB`);
}

/**
 * Keep what the game uses: bone rotations (as 16-bit normalised quaternions) and the hip
 * position; drop tracks that never leave the rest pose; meshopt-compress the keys.
 */
async function slim(file) {
  await MeshoptEncoder.ready;
  const { json, bin } = readGlb(fs.readFileSync(file));
  const w = new Writer();
  const nodes = json.nodes.map((n) => { const o = { name: n.name }; for (const k of ['translation', 'rotation', 'scale', 'children']) if (n[k]) o[k] = n[k]; return o; });
  const same = (a, b, eps) => a.every((v, i) => Math.abs(v - b[i]) < eps);
  // All keys go into three shared blocks (times, rotations, hip positions): one buffer view
  // per sampler would make the JSON bigger than the data.
  const pools = { t: [], r: [], p: [] };
  const sizes = { t: 0, r: 0, p: 0 };
  const pending = [];
  const animations = json.animations.map((a) => {
    const channels = [], samplers = [];
    for (const c of a.channels) {
      const node = json.nodes[c.target.node], path = c.target.path;
      if (!(path === 'rotation' || (path === 'translation' && node.name === 'pelvis'))) continue;
      const s = a.samplers[c.sampler];
      const times = readAccessor(json, bin, s.input, { float: true }).arr;
      const vals = readAccessor(json, bin, s.output, { float: true }).arr;
      const n = path === 'rotation' ? 4 : 3;
      const rest = path === 'rotation' ? node.rotation || [0, 0, 0, 1] : node.translation || [0, 0, 0];
      let constant = true;
      for (let i = n; i < vals.length && constant; i += n) if (!same(Array.from(vals.subarray(i, i + n)), Array.from(vals.subarray(0, n)), 1e-4)) constant = false;
      if (constant && same(Array.from(vals.subarray(0, n)), rest, 1e-4)) continue;   // never leaves rest
      const t = constant ? times.subarray(0, 1) : times, v = constant ? vals.subarray(0, n) : vals;
      const sampler = { interpolation: 'LINEAR' };
      pending.push({ sampler, t, v, kind: path === 'rotation' ? 'r' : 'p' });
      samplers.push(sampler);
      channels.push({ sampler: samplers.length - 1, target: { node: c.target.node, path } });
    }
    return { name: a.name, channels, samplers };
  });
  for (const x of pending) {
    x.tOff = sizes.t; pools.t.push(x.t); sizes.t += x.t.length;
    x.vOff = sizes[x.kind]; pools[x.kind].push(x.v); sizes[x.kind] += x.v.length;
  }
  const cat = (list, T, total) => { const out = new T(total); let o = 0; for (const a of list) { out.set(a, o); o += a.length; } return out; };
  const tAll = cat(pools.t, Float32Array, sizes.t);
  const rAll = new Int16Array(sizes.r); { const f = cat(pools.r, Float32Array, sizes.r); for (let i = 0; i < f.length; i++) rAll[i] = Math.round(Math.max(-1, Math.min(1, f[i])) * 32767); }
  const pAll = cat(pools.p, Float32Array, sizes.p);
  const vT = w.view(tAll, tAll.length, 4, 'ATTRIBUTES');
  const vR = rAll.length ? w.view(rAll, rAll.length / 4, 8, 'ATTRIBUTES') : null;
  const vP = pAll.length ? w.view(pAll, pAll.length / 3, 12, 'ATTRIBUTES') : null;
  for (const x of pending) {
    let lo = Infinity, hi = -Infinity; for (const t of x.t) { lo = Math.min(lo, t); hi = Math.max(hi, t); }
    x.sampler.input = w.accessor({ bufferView: vT, byteOffset: x.tOff * 4, componentType: 5126, count: x.t.length, type: 'SCALAR', min: [lo], max: [hi] });
    x.sampler.output = x.kind === 'r'
      ? w.accessor({ bufferView: vR, byteOffset: x.vOff * 2, componentType: 5122, normalized: true, count: x.v.length / 4, type: 'VEC4' })
      : w.accessor({ bufferView: vP, byteOffset: x.vOff * 4, componentType: 5126, count: x.v.length / 3, type: 'VEC3' });
  }
  const out = {
    asset: { version: '2.0', generator: 'gtb people anims' },
    extensionsUsed: ['KHR_mesh_quantization', 'EXT_meshopt_compression'], extensionsRequired: ['KHR_mesh_quantization', 'EXT_meshopt_compression'],
    scene: 0, scenes: [{ nodes: json.scenes[0].nodes }], nodes, animations,
  };
  fs.writeFileSync(file, w.glb(out));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(e); process.exit(1); });
