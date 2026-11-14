import * as THREE from 'three';
import { POINT } from './tileFormat.js';
import { loadParts, Instancer } from './models.js';

// Models the owner makes with free online tools (docs/art-requests.md) and uploads to
// public/art/models/<id>.glb. The build lists what is there (scripts/art-index.mjs →
// art/index.json); this loads whatever is listed and uses it near the player:
// - `swap`: stands in for a procedural prop of that map point kind (food carts for the
//   thela, a bus shelter for the procedural one); the procedural instance is shrunk to
//   nothing while the model stands in for it, and put back when the player moves on;
// - `near`: extra clutter around points of that kind (stools and gas cylinders by stalls,
//   bins at garbage spots, police barricades at signal junctions).
// Missing files are simply not used — everything still works without any of them.

export const ART = {
  'vada-pav-cart': { swap: POINT.STALL, height: 2.3 },
  'chai-tapri': { swap: POINT.STALL, height: 2.3 },
  'coconut-cart': { swap: POINT.STALL, height: 1.5 },
  'sugarcane-juice-cart': { swap: POINT.STALL, height: 2.1 },
  'fruit-cart': { swap: POINT.STALL, height: 1.6 },
  'bus-shelter': { swap: POINT.BUS_STOP, height: 2.7 },
  'plastic-stool': { near: POINT.STALL, height: 0.45, count: 2, ring: 1.7, share: 0.8 },
  'lpg-cylinder': { near: POINT.STALL, height: 0.85, count: 1, ring: 1.2, share: 0.5 },
  'milk-can': { near: POINT.STALL, height: 0.6, count: 1, ring: 1.4, share: 0.35 },
  'handcart': { near: POINT.GARBAGE, height: 1.0, count: 1, ring: 3.2, share: 0.35 },
  'community-dustbin': { near: POINT.GARBAGE, height: 1.25, count: 1, ring: 1.8, share: 0.7 },
  'police-barricade': { near: POINT.SIGNAL, height: 1.1, count: 2, ring: 5, share: 0.45 },
};

const hash = (x, z, k = 0) => { const s = Math.sin(x * 12.9898 + z * 78.233 + k * 37.719) * 43758.5453; return s - Math.floor(s); };

export class Art {
  constructor(scene, tiles, base, tier, started = Promise.resolve()) {
    this.scene = scene;
    this.tiles = tiles;
    this.radius = tier.name === 'High' ? 110 : tier.name === 'Medium' ? 85 : 60;
    this.models = {};   // id → { def, inst }
    this.swaps = {};    // point kind → [ids]
    this.at = new THREE.Vector3(1e9, 0, 0);
    this.version = -1;
    this.m = new THREE.Matrix4(); this.p = new THREE.Vector3(); this.q = new THREE.Quaternion(); this.s = new THREE.Vector3(1, 1, 1);
    this.zero = new THREE.Matrix4().makeScale(0, 0, 0);
    started.then(() => fetch(`${base}art/index.json`)).then((r) => (r.ok ? r.json() : { models: [] })).then(({ models }) => Promise.all(models.map(async ({ id, file }) => {
      const def = ART[id];
      if (!def) return;
      const parts = await loadParts(`${base}art/${file}`, { size: def.height });
      this.models[id] = { def, inst: new Instancer(scene, parts, def.swap !== undefined ? 80 : 240) };
      if (def.swap !== undefined) (this.swaps[def.swap] ||= []).push(id);
    }))).then(() => { this.version = -1; this.at.set(1e9, 0, 0); this.count = Object.keys(this.models).length; }).catch(() => {});
  }

  update(focus) {
    if (!this.count) return;
    if (this.at.distanceToSquared(focus) < 12 * 12 && this.version === this.tiles.version) return;
    this.at.copy(focus); this.version = this.tiles.version;
    for (const { inst } of Object.values(this.models)) inst.begin();
    const R = this.radius, R2 = R * R;
    for (const t of this.tiles.tiles.values()) {
      const [x0, z0, x1, z1] = t.clip;
      const near = !(focus.x < x0 - R || focus.x > x1 + R || focus.z < z0 - R || focus.z > z1 + R);
      // Stand-ins: hide the procedural instance, put the model in its place.
      t.group?.traverse?.((o) => {
        const ids = o.isInstancedMesh && this.swaps[o.userData.kind];
        if (!ids) return;
        if (!o.userData.orig) o.userData.orig = o.instanceMatrix.array.slice();
        const orig = o.userData.orig, arr = o.instanceMatrix.array;
        let changed = false;
        for (let k = 0; k < o.count; k++) {
          const e = k * 16, wx = orig[e + 12] + t.origin[0], wz = orig[e + 14] + t.origin[1];
          const swap = near && (wx - focus.x) ** 2 + (wz - focus.z) ** 2 < R2;
          const hidden = arr[e] === 0 && arr[e + 5] === 0 && arr[e + 10] === 0;
          if (swap) {
            if (!hidden) { o.setMatrixAt(k, this.zero); changed = true; }
            if (o.userData.part === 0) {
              const id = ids[Math.floor(hash(wx, wz) * ids.length) % ids.length];
              this.m.fromArray(orig, e).decompose(this.p, this.q, this.s);
              this.models[id].inst.put(this.m.compose(this.p.set(wx, this.p.y, wz), this.q, this.s.set(1, 1, 1)));
            }
          } else if (hidden) { arr.set(orig.subarray(e, e + 16), e); changed = true; }
        }
        if (changed) o.instanceMatrix.needsUpdate = true;
      });
      if (!near) continue;
      // Extra clutter around map points.
      for (const [id, { def, inst }] of Object.entries(this.models)) {
        if (def.near === undefined) continue;
        const pts = t.points[def.near];
        if (!pts) continue;
        for (let i = 0; i < pts.length; i += 5) {
          const x = pts[i] + t.origin[0], z = pts[i + 2] + t.origin[1];
          if ((x - focus.x) ** 2 + (z - focus.z) ** 2 > R2 || hash(x, z, id.length) > def.share) continue;
          for (let c = 0; c < (def.count || 1); c++) {
            const a = pts[i + 3] + Math.PI * (0.6 + hash(x, z, c + 3) * 0.8) * (c % 2 ? 1 : -1);
            const r = def.ring * (0.8 + hash(z, x, c) * 0.4);
            const px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r;
            if (this.tiles.hits(px, pz, 0.3) || this.tiles.roadAt(px, pz, 0.2, true)) continue;
            this.q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, hash(px, pz, 9) * Math.PI * 2);
            inst.put(this.m.compose(this.p.set(px, this.tiles.groundHeight(px, pz), pz), this.q, this.s.set(1, 1, 1)));
          }
        }
      }
    }
    for (const { inst } of Object.values(this.models)) inst.end();
  }
}
