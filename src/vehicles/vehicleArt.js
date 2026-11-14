import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VEHICLE_ART } from './vehicleModels.js';

// Owner-uploaded vehicle models (public/art/vehicles → the build's light copies in
// art/opt/vehicles, already split into the fleet's four parts, in metres, +z forward): loaded
// after play starts and handed to traffic, which draws them in its four batches like the
// procedural fleet. A model named after a fleet type replaces its close-up body; others add a
// new type (VEHICLE_ART in vehicleModels.js). Nothing changes if no models were uploaded.

const PARTS = ['paint', 'glass', 'trim', 'lamps'];
const COLOURED = new Set(['trim', 'lamps']);

/** Float copy of an attribute (the files store quantised integers). */
function floats(attr) {
  const n = attr.itemSize, out = new Float32Array(attr.count * n);
  for (let i = 0; i < attr.count; i++) for (let c = 0; c < n; c++) out[i * n + c] = attr.getComponent(i, c);
  return new THREE.BufferAttribute(out, n);
}

function parts(gltf) {
  const out = {};
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => {
    if (!o.isMesh || !PARTS.includes(o.name)) return;
    // Plain floats in metres, like the procedural fleet (the traffic batches share one layout).
    const g = new THREE.BufferGeometry();
    for (const k of ['position', 'normal', 'color']) if (o.geometry.attributes[k] && (k !== 'color' || COLOURED.has(o.name))) g.setAttribute(k, floats(o.geometry.attributes[k]));
    if (o.geometry.index) g.setIndex(o.geometry.index);
    g.applyMatrix4(o.matrixWorld);
    out[o.name] = g;
  });
  for (const p of PARTS) {
    let g = out[p];
    if (!g) throw new Error(`no ${p} part`);
    g = g.index ? g.toNonIndexed() : g;
    g.attributes.normal.normalized = false;
    out[p] = g;
  }
  return out;
}

export async function loadVehicleArt(base, traffic, started = Promise.resolve(), tier = null) {
  await started;
  const res = await fetch(`${base}art/index.json`, { cache: 'no-cache' }).catch(() => null);
  if (!res?.ok) return [];
  let { vehicles = [] } = await res.json();
  // Most common first (they replace the fleet's own bodies), then the new types by how often
  // they show up; fewer on the lighter tiers (each is ~0.3 MB and grows the traffic batches).
  const weight = (v) => (traffic.types[v.id] ? 10 + traffic.types[v.id].weight : VEHICLE_ART[v.id]?.weight ?? 0);
  vehicles = vehicles.sort((a, b) => weight(b) - weight(a)).slice(0, tier?.name === 'Low' ? 12 : tier?.name === 'Medium' ? 24 : 99);
  const loader = new GLTFLoader(), done = [];
  for (const v of vehicles) {
    try {
      const [near, far] = await Promise.all([v.near, v.far].map((f) => loader.loadAsync(`${base}art/${f}${v.v ? `?v=${v.v}` : ''}`).then(parts)));
      traffic.useModel(v.id, near, far, { ...(VEHICLE_ART[v.id] || {}), len: v.len, wid: v.wid });
      done.push(v.id);
    } catch (e) { console.warn(`Vehicle model ${v.id} not used:`, e.message); }
  }
  return done;
}
