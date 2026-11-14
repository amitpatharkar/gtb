import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VEHICLE_ART } from './vehicleModels.js';

// Owner-uploaded vehicle models (public/art/vehicles → the build's light copies in
// art/opt/vehicles, already split into the fleet's four parts, in metres, +z forward): loaded
// after play starts and handed to traffic, which draws them in its four batches like the
// procedural fleet. A model named after a fleet type replaces its close-up body; others add a
// new type (VEHICLE_ART in vehicleModels.js). Nothing changes if no models were uploaded.

const PARTS = ['paint', 'glass', 'trim', 'lamps'];
const COLOURED = new Set(['trim', 'lamps']);

function parts(gltf) {
  const out = {};
  gltf.scene.traverse((o) => { if (o.isMesh && PARTS.includes(o.name)) out[o.name] = o.geometry; });
  for (const p of PARTS) {
    let g = out[p];
    if (!g) throw new Error(`no ${p} part`);
    g = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && !(k === 'color' && COLOURED.has(p))) g.deleteAttribute(k);
    out[p] = g;
  }
  return out;
}

export async function loadVehicleArt(base, traffic, started = Promise.resolve()) {
  await started;
  const res = await fetch(`${base}art/index.json`).catch(() => null);
  if (!res?.ok) return [];
  const { vehicles = [] } = await res.json();
  const loader = new GLTFLoader(), done = [];
  for (const v of vehicles) {
    try {
      const [near, far] = await Promise.all([v.near, v.far].map((f) => loader.loadAsync(`${base}art/${f}`).then(parts)));
      traffic.useModel(v.id, near, far, { ...(VEHICLE_ART[v.id] || {}), len: v.len, wid: v.wid });
      done.push(v.id);
    } catch (e) { console.warn(`Vehicle model ${v.id} not used:`, e.message); }
  }
  return done;
}
