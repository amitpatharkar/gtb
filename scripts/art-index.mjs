// Lists the hand-made / tool-generated models in public/art/models (uploaded by the owner,
// see docs/art-requests.md) into public/art/index.json, so the game only asks for files that
// exist (no 404s). Run by "npm run build" (and so by the deploy workflow).
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve('public/art/models');
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /\.(glb|gltf)$/i.test(f)) : [];
const out = { models: files.map((f) => ({ id: f.replace(/\.(glb|gltf)$/i, '').toLowerCase(), file: `models/${f}`, bytes: fs.statSync(path.join(dir, f)).size })) };
fs.writeFileSync(path.resolve('public/art/index.json'), JSON.stringify(out, null, 1));
console.log(`art: ${files.length} model(s) listed`);
