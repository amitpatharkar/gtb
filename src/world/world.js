// The world: streams map tiles around the player (built in worldWorker.js), adds their meshes
// to the scene and one fixed triangle-mesh collider per tile to the physics world, and keeps
// the player inside the playable area (Colaba for now) with invisible walls.
import * as THREE from 'three/webgpu';
import { RAPIER, GROUP, groups } from '../core/physics.js';
import { Y } from './levels.js';
import { dressTile } from './trees.js';

const BASE = import.meta.env.BASE_URL;
// Playable area for the first slice: Colaba Causeway, Apollo Bunder (Gateway of India) and
// Kala Ghoda. World metres (x = east, z = south) around the converter's origin (Mahim).
export const AREA = { minX: -3380, maxX: -1040, minZ: 10500, maxZ: 13850, name: 'Colaba' };
const MAX_IN_FLIGHT = 3;
const SHADOWS = (key) => key.startsWith('walls') || key === 'roof' || key === 'wall' || key === 'parapet' || key === 'seawall';

export class World {
  constructor(scene, physics, materials, tier) {
    this.scene = scene; this.physics = physics; this.materials = materials;
    this.loadRadius = tier.drawDistance;
    this.tierKey = tier.key;
    this.tiles = new Map(); this.pending = new Map(); this.failed = new Map();
    this.callbacks = new Map(); this.nextId = 1;
    this.version = 0;
    this.stats = { buildings: 0, dropped: 0 };
  }

  async init() {
    const res = await fetch(`${BASE}tiles/index.json`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Map index missing (${res.status}). Run "npm run tiles".`);
    this.index = await res.json();
    this.size = this.index.tileSize;
    this.tag = encodeURIComponent(this.index.generated || '');
    this.available = new Set(this.index.tiles.map(([tx, tz]) => `${tx},${tz}`));
    this.worker = new Worker(new URL('./worldWorker.js', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e) => this.callbacks.get(e.data.id)?.(e.data);

    // Sea all round (the land tiles cover it where there is ground).
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(20000, 20000), this.materials.sea);
    sea.rotation.x = -Math.PI / 2;
    sea.position.set((AREA.minX + AREA.maxX) / 2, Y.SEA, (AREA.minZ + AREA.maxZ) / 2);
    sea.receiveShadow = true;
    this.scene.add(sea);
    this.sea = sea;

    // Invisible walls round the playable area.
    const { world } = this.physics;
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const cx = (AREA.minX + AREA.maxX) / 2, cz = (AREA.minZ + AREA.maxZ) / 2, hx = (AREA.maxX - AREA.minX) / 2, hz = (AREA.maxZ - AREA.minZ) / 2;
    for (const [x, z, sx, sz] of [[AREA.minX - 1, cz, 1, hz + 2], [AREA.maxX + 1, cz, 1, hz + 2], [cx, AREA.minZ - 1, hx + 2, 1], [cx, AREA.maxZ + 1, hx + 2, 1]]) {
      world.createCollider(RAPIER.ColliderDesc.cuboid(sx, 60, sz).setTranslation(x, 50, z).setCollisionGroups(groups(GROUP.WORLD, GROUP.PLAYER | GROUP.VEHICLE | GROUP.PED)), body);
    }
    return this.index;
  }

  get spawn() { return this.index.spawn; }

  inArea(tx, tz) {
    const s = this.size;
    return (tx + 1) * s > AREA.minX - 200 && tx * s < AREA.maxX + 200 && (tz + 1) * s > AREA.minZ - 200 && tz * s < AREA.maxZ + 200;
  }

  tileDistance(tx, tz, x, z) {
    const s = this.size;
    return Math.hypot(Math.max(tx * s - x, 0, x - (tx + 1) * s), Math.max(tz * s - z, 0, z - (tz + 1) * s));
  }

  update(x, z) {
    const s = this.size, r = Math.ceil(this.loadRadius / s) + 1;
    const ptx = Math.floor(x / s), ptz = Math.floor(z / s);
    const wanted = [];
    for (let tx = ptx - r; tx <= ptx + r; tx++) for (let tz = ptz - r; tz <= ptz + r; tz++) {
      const key = `${tx},${tz}`;
      if (!this.available.has(key) || !this.inArea(tx, tz) || this.tiles.has(key) || this.pending.has(key)) continue;
      if ((this.failed.get(key) || 0) > performance.now()) continue;
      const d = this.tileDistance(tx, tz, x, z);
      if (d <= this.loadRadius) wanted.push([d, tx, tz, key]);
    }
    wanted.sort((a, b) => a[0] - b[0]);
    for (const [, tx, tz, key] of wanted) { if (this.pending.size >= MAX_IN_FLIGHT) break; this.load(tx, tz, key); }
    for (const t of this.tiles.values()) if (this.tileDistance(t.tx, t.tz, x, z) > this.loadRadius + 250) this.unload(t.key);
  }

  load(tx, tz, key) {
    const id = this.nextId++;
    this.pending.set(key, id);
    this.callbacks.set(id, (msg) => {
      this.callbacks.delete(id);
      if (this.pending.get(key) !== id) return;
      this.pending.delete(key);
      if (msg.error) { console.warn(`Tile ${key} failed, retrying in 5 s:`, msg.error); this.failed.set(key, performance.now() + 5000); return; }
      this.add(key, msg.result);
    });
    this.worker.postMessage({ id, url: `${BASE}tiles/${tx}_${tz}.bin.gz${this.tag ? `?v=${this.tag}` : ''}` });
  }

  add(key, t) {
    const group = new THREE.Group();
    group.position.set(t.origin[0], 0, t.origin[1]);
    for (const [name, d] of Object.entries(t.meshes)) {
      if (!d) continue;
      const mat = name.startsWith('walls') ? this.materials.walls[Number(name.slice(5))] : this.materials[name];
      if (!mat) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(d.position, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(d.normal, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(d.uv, 2));
      geo.setAttribute('color', new THREE.BufferAttribute(d.color, 3, true));
      if (d.facade) geo.setAttribute('facade', new THREE.BufferAttribute(d.facade, 4));
      geo.setIndex(new THREE.BufferAttribute(d.index, 1));
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = name;
      mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      const cast = SHADOWS(name);
      mesh.castShadow = cast; mesh.receiveShadow = true;
      group.add(mesh);
    }
    const body = this.physics.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(t.origin[0], 0, t.origin[1]));
    if (t.collider.idx.length) {
      const desc = RAPIER.ColliderDesc.trimesh(t.collider.pos, t.collider.idx).setCollisionGroups(groups(GROUP.WORLD)).setFriction(0.9);
      this.physics.world.createCollider(desc, body);
    }
    dressTile(t, group, body, this.physics.world, this.tierKey);
    group.updateMatrixWorld(true);
    this.scene.add(group);
    this.tiles.set(key, { key, tx: t.tx, tz: t.tz, origin: t.origin, group, body, points: t.points, roadLines: t.roadLines, names: t.names, namedSegs: t.namedSegs });
    this.stats.buildings += t.stats.buildings; this.stats.dropped += t.stats.dropped;
    this.version++;
  }

  unload(key) {
    const t = this.tiles.get(key);
    if (!t) return;
    this.scene.remove(t.group);
    t.group.traverse((o) => { if (o.isMesh && !o.isInstancedMesh) o.geometry.dispose(); else if (o.isInstancedMesh) o.dispose(); });
    if (t.body) this.physics.world.removeRigidBody(t.body);
    this.tiles.delete(key);
    this.version++;
  }

  /** Resolves when every tile within r metres of (x, z) has loaded (or failed). */
  whenReady(x, z, r = 300) {
    return new Promise((resolve) => {
      const check = () => {
        this.update(x, z);
        const s = this.size;
        let missing = 0;
        for (let tx = Math.floor((x - r) / s); tx <= Math.floor((x + r) / s); tx++) for (let tz = Math.floor((z - r) / s); tz <= Math.floor((z + r) / s); tz++) {
          const key = `${tx},${tz}`;
          if (this.available.has(key) && this.inArea(tx, tz) && !this.tiles.has(key) && !this.failed.has(key)) missing++;
        }
        if (!missing) resolve(); else setTimeout(check, 50);
      };
      check();
    });
  }

  /** Named vehicle-road segments within r metres of (x, z), in world coordinates. */
  segmentsNear(x, z, r) {
    const out = [];
    for (const t of this.tiles.values()) {
      const s = t.namedSegs, ox = t.origin[0], oz = t.origin[1];
      for (let i = 0; i < s.length; i += 6) {
        const ax = s[i] + ox, az = s[i + 1] + oz, bx = s[i + 2] + ox, bz = s[i + 3] + oz;
        const mx = (ax + bx) / 2, mz = (az + bz) / 2;
        if (Math.hypot(mx - x, mz - z) > r) continue;
        out.push({ ax, az, bx, bz, hw: s[i + 4], name: t.names[s[i + 5]] || '', len: Math.hypot(bx - ax, bz - az) });
      }
    }
    return out;
  }

  /** Name of the street at (x, z), or ''. */
  roadNameAt(x, z) {
    let best = '', bd = Infinity;
    for (const t of this.tiles.values()) {
      const lx = x - t.origin[0], lz = z - t.origin[1];
      if (Math.abs(lx) > this.size || Math.abs(lz) > this.size) continue;
      const s = t.namedSegs;
      for (let i = 0; i < s.length; i += 6) {
        const ax = s[i], az = s[i + 1], dx = s[i + 2] - ax, dz = s[i + 3] - az;
        const k = Math.max(0, Math.min(1, ((lx - ax) * dx + (lz - az) * dz) / (dx * dx + dz * dz || 1)));
        const d = Math.hypot(ax + dx * k - lx, az + dz * k - lz) - s[i + 4];
        if (d < bd && d < 8) { bd = d; best = t.names[s[i + 5]] || ''; }
      }
    }
    return best;
  }
}
