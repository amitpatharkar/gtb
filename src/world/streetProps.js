import * as THREE from 'three';
import { POINT } from './tileFormat.js';
import { Y } from './levels.js';
import { loadParts, Instancer } from './models.js';

// Photo-scanned street clutter from Poly Haven around the player: plastic monobloc chairs
// and crates at every thela, trash bags heaped at garbage spots, metal bins at bus stops
// and grey utility boxes at the foot of some lamp posts. Placed from the map's points,
// refreshed as the player moves (only within ~140 m).

const rand = (a, b) => { const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return s - Math.floor(s); };

export class StreetProps {
  constructor(scene, tiles, base, tier, started = Promise.resolve()) {
    this.scene = scene;
    this.tiles = tiles;
    this.radius = tier.name === 'High' ? 160 : 120;
    this.ready = {};
    this.timer = 0;
    this.last = new THREE.Vector3(1e9, 0, 0);
    const url = (dir, file) => `${base}media/models/${dir}/${file}`;
    const load = (key, dir, file, opts, max) => started.then(() => loadParts(url(dir, file), opts)).then((parts) => { this.ready[key] = new Instancer(scene, parts, max); this.version = -1; }).catch(() => {});
    // Lighter set on Low. Loads only once play has started (after the loading screen).
    load('chair', 'prop-ph-plastic-monobloc-chair-01', 'plastic_monobloc_chair_01_1k.gltf', { size: 0.82 }, 260);
    load('crate', 'prop-ph-plastic-crate-02', 'plastic_crate_02_1k.gltf', { size: 0.3 }, 260);
    load('bag', 'prop-ph-trashbag', 'trashbag_1k.gltf', { size: 0.55 }, 400);
    load('bin', 'prop-ph-metal-trash-can', 'metal_trash_can_1k.gltf', { size: 0.95 }, 120);
    load('box', 'prop-ph-utility-box-01', 'utility_box_01_1k.gltf', { size: 1.25 }, 120);
    if (tier.name !== 'Low') {
      load('wcrate', 'prop-ph-wooden-crate-02', 'wooden_crate_02_1k.gltf', { size: 0.45 }, 200);
    }
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.s = new THREE.Vector3(1, 1, 1); this.p = new THREE.Vector3();
  }

  place(key, x, z, yaw, scale = 1, y = Y.KERB) {
    const inst = this.ready[key];
    if (!inst) return;
    this.q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
    inst.put(this.m.compose(this.p.set(x, y, z), this.q, this.s.setScalar(scale)));
  }

  update(dt, focus) {
    this.timer -= dt;
    if (this.timer > 0 && this.last.distanceToSquared(focus) < 400 && this.version === this.tiles.version) return;
    this.timer = 1;
    this.last.copy(focus);
    this.version = this.tiles.version;
    for (const inst of Object.values(this.ready)) inst.begin();
    const R2 = this.radius ** 2;
    for (const t of this.tiles.tiles.values()) {
      const [x0, z0, x1, z1] = t.clip;
      if (focus.x < x0 - this.radius || focus.x > x1 + this.radius || focus.z < z0 - this.radius || focus.z > z1 + this.radius) continue;
      const each = (kind, fn) => {
        const arr = t.points[kind];
        if (!arr) return;
        for (let i = 0; i < arr.length; i += 5) {
          const x = arr[i] + t.origin[0], z = arr[i + 2] + t.origin[1];
          if ((x - focus.x) ** 2 + (z - focus.z) ** 2 < R2) fn(x, z, arr[i + 3], i / 5);
        }
      };
      // Thelas: chairs for the customers and crates of stock.
      each(POINT.STALL, (x, z, a) => {
        const c = Math.cos(a), s = Math.sin(a);
        const at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
        for (const [lx, lz, yaw] of [[-1.5, 0.6, 0.4], [1.6, 0.4, -0.5], [-2.2, -0.2, 1.2]].slice(0, 1 + Math.floor(rand(x, z) * 3))) { const [px, pz] = at(lx, lz); if (!this.tiles.hits(px, pz, 0.3)) this.place('chair', px, pz, a + yaw + Math.PI); }
        const [cx, cz] = at(0.7, -0.75);
        if (!this.tiles.hits(cx, cz, 0.2)) { this.place('crate', cx, cz, a); this.place('crate', cx, cz, a + 0.2, 1, Y.KERB + 0.3); this.place('wcrate', ...at(-0.8, -0.75), a + 0.3); }
      });
      // Garbage spots: a heap of bags.
      each(POINT.GARBAGE, (x, z, a) => {
        for (let k = 0; k < 5; k++) this.place('bag', x + (rand(x + k, z) - 0.5) * 1.6, z + (rand(z, x + k) - 0.5) * 1.6, rand(k, x) * 6.28, 0.8 + rand(x, k) * 0.5, Y.KERB - 0.02);
      });
      // Bus stops: a bin.
      each(POINT.BUS_STOP, (x, z, a) => { const px = x + Math.cos(a) * 2.6, pz = z - Math.sin(a) * 2.6; if (!this.tiles.hits(px, pz, 0.3)) this.place('bin', px, pz, a); });
      // Every few lamp posts: a utility box beside it.
      each(POINT.LIGHT, (x, z, a, i) => {
        if (rand(x, z) > 0.18) return;
        const px = x + Math.cos(a) * 0.9, pz = z - Math.sin(a) * 0.9;
        if (!this.tiles.hits(px, pz, 0.4) && !this.tiles.roadAt(px, pz, 0.3, true)) this.place('box', px, pz, a + Math.PI / 2);
      });
    }
    for (const inst of Object.values(this.ready)) inst.end();
  }
}
