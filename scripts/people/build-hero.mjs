// The main character (the player's body): `node scripts/people/build-hero.mjs`.
// Source: data/people/indian_man_in_casuals.glb — "Indian Man In Casuals" by Pixel_Monster
// (https://sketchfab.com/ar.jethin), CC BY 4.0, chosen by the owner on 2026-11-17.
// 1. Blender (scripts/people/blender/hero.py): real size, bones renamed to the game skeleton,
//    public/people/hero/hero-{high,medium,low}.glb — high is the model as uploaded.
// 2. The game's animation clips retargeted onto his own skeleton (build-anims.mjs --target)
//    → public/people/hero/anims.glb.
// 3. public/people/hero/info.json: height, triangles per level, credit.
// Needs the tools from `node scripts/people/build-people.mjs --setup` (Blender in .people-cache).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { TOOLS } from './setup.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const SRC = path.join(ROOT, 'data/people/indian_man_in_casuals.glb');
const OUT = path.join(ROOT, 'public/people/hero');
const T = TOOLS(path.join(ROOT, '.people-cache'));
export const HERO_CREDIT = {
  asset: 'Indian Man In Casuals (main character)', role: 'player', license: 'CC-BY',
  author: 'Pixel_Monster', source: 'https://sketchfab.com/3d-models/indian-man-in-casuals-fe7de2e1fbb642c9aebb7c3f698bec5e',
};

function run(cmd, args, env = {}) {
  const r = spawnSync(cmd, args, { env: { ...process.env, ...env }, encoding: 'utf8', maxBuffer: 64 << 20 });
  for (const l of `${r.stdout}\n${r.stderr}`.split('\n')) if (/^\[(hero|anims)\]|Error|Traceback/.test(l)) console.log(l);
  if (r.status !== 0) { console.log(r.stderr.slice(-3000)); process.exit(1); }
}

fs.mkdirSync(OUT, { recursive: true });
run(T.blender, ['--background', '--factory-startup', '--python-exit-code', '1', '--python', path.join(HERE, 'blender/hero.py'), '--', SRC, OUT]);
run(process.execPath, [path.join(HERE, 'build-anims.mjs'), `--target=${path.relative(ROOT, path.join(OUT, 'hero-high.glb'))}`, `--out=${path.relative(ROOT, path.join(OUT, 'anims.glb'))}`]);
const info = JSON.parse(fs.readFileSync(path.join(OUT, 'hero.json'), 'utf8'));
fs.rmSync(path.join(OUT, 'hero.json'));
const files = ['high', 'medium', 'low'].map((q) => `hero-${q}.glb`);
const out = {
  id: 'hero', sex: 'm', age: 30, heightCm: info.heightCm, triangles: info.triangles,
  bytes: Object.fromEntries(files.map((f) => [f, fs.statSync(path.join(OUT, f)).size])),
  version: files.map((f) => fs.statSync(path.join(OUT, f)).size).join('-'), credit: HERO_CREDIT,
};
fs.writeFileSync(path.join(OUT, 'info.json'), JSON.stringify(out, null, 1));
fs.writeFileSync(path.join(OUT, 'CREDITS.md'), `# Main character\n\n"Indian Man In Casuals" by ${HERO_CREDIT.author} (https://sketchfab.com/ar.jethin), ${HERO_CREDIT.source}\nLicence: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Changes: Sketchfab wrapper and scale removed,\nbones renamed to the game skeleton, lighter copies for the medium and low graphics levels, the\ngame's animation clips (Quaternius Universal Animation Library 1 and 2, CC0) retargeted onto it.\n`);
console.log('[hero]', `${out.heightCm} cm`, JSON.stringify(out.triangles), Object.entries(out.bytes).map(([f, b]) => `${f} ${(b / 1048576).toFixed(1)} MB`).join(', '));
