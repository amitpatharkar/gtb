import * as THREE from 'three';
import { createProps, buildProps } from './props.js';
import { Y } from './levels.js';

// Streams map tiles around the player and answers collision questions.
// Tiles are built by tileWorker.js (download, unzip, decode, mesh) off the main thread.

const LOAD_RADIUS = 700;    // metres from the player to a tile's edge
const UNLOAD_RADIUS = 950;
const MAX_IN_FLIGHT = 3;
const DETAIL_MESHES = new Set(['railSteel', 'paint']);
// [cast shadow, receive shadow] by mesh key (walls and roofs cast; ground only receives).
const shadowsFor = (key) => (key.startsWith('walls') || key.startsWith('roof') || key === 'parapet' ? [true, true] : [false, true]);
const SEG = 6; // floats per road segment: x0 z0 x1 z1 halfWidth flags (1 vehicle, 2 one-way, 4 main road)

export class TileManager {
  constructor(scene, materials, tier) {
    this.scene = scene;
    this.tier = tier;
    this.materials = materials;
    this.tiles = new Map();    // key → loaded tile
    this.pending = new Map();  // key → request id
    this.failed = new Set();
    this.callbacks = new Map();
    this.nextId = 1;
    this.tankGeo = new THREE.CylinderGeometry(0.7, 0.7, 1.5, 10);
    this.tankGeo.translate(0, 0.75, 0);
    this.props = createProps();
    this.detailRadius = tier?.detailRadius ?? 300;
  }

  async init(baseUrl) {
    this.baseUrl = new URL(baseUrl, location.href).href;
    const res = await fetch(this.baseUrl + 'index.json');
    if (!res.ok) throw new Error(`Map index missing (${res.status}). Run "npm run tiles" first.`);
    this.index = await res.json();
    this.size = this.index.tileSize;
    this.bounds = this.index.bounds;
    this.available = new Map(this.index.tiles.map(([tx, tz, bytes]) => [`${tx},${tz}`, bytes]));
    this.worker = new Worker(new URL('./tileWorker.js', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e) => this.callbacks.get(e.data.id)?.(e.data);
    return this.index;
  }

  /** Distance from (x, z) to the nearest point of a tile. */
  tileDistance(tx, tz, x, z) {
    const s = this.size;
    const dx = Math.max(tx * s - x, 0, x - (tx + 1) * s);
    const dz = Math.max(tz * s - z, 0, z - (tz + 1) * s);
    return Math.hypot(dx, dz);
  }

  update(x, z) {
    const s = this.size, r = Math.ceil(LOAD_RADIUS / s) + 1;
    const ptx = Math.floor(x / s), ptz = Math.floor(z / s);
    const wanted = [];
    for (let tx = ptx - r; tx <= ptx + r; tx++) {
      for (let tz = ptz - r; tz <= ptz + r; tz++) {
        const key = `${tx},${tz}`;
        if (!this.available.has(key) || this.tiles.has(key) || this.pending.has(key) || this.failed.has(key)) continue;
        const d = this.tileDistance(tx, tz, x, z);
        if (d <= LOAD_RADIUS) wanted.push([d, tx, tz, key]);
      }
    }
    wanted.sort((a, b) => a[0] - b[0]);
    for (const [, tx, tz, key] of wanted) {
      if (this.pending.size >= MAX_IN_FLIGHT) break;
      this.load(tx, tz, key);
    }
    for (const [key, tile] of this.tiles) {
      const d = this.tileDistance(tile.tx, tile.tz, x, z);
      if (d > UNLOAD_RADIUS) this.unload(key);
      else tile.detail.visible = d < this.detailRadius;
    }
  }

  load(tx, tz, key) {
    const id = this.nextId++;
    this.pending.set(key, id);
    this.callbacks.set(id, (msg) => {
      this.callbacks.delete(id);
      if (this.pending.get(key) !== id) return; // cancelled
      this.pending.delete(key);
      if (msg.error) {
        console.error(`Tile ${key} failed:`, msg.error);
        this.failed.add(key);
        return;
      }
      this.add(key, msg.result);
    });
    this.worker.postMessage({ id, url: `${this.baseUrl}${tx}_${tz}.bin.gz` });
  }

  add(key, t) {
    const group = new THREE.Group();
    group.position.set(t.origin[0], 0, t.origin[1]);
    group.name = `tile ${key}`;
    // Level of detail, Rockstar style: cheap props live in their own group that is
    // hidden once the tile is far from the player.
    const detail = new THREE.Group();
    group.add(detail);
    for (const [name, data] of Object.entries(t.meshes)) {
      if (!data) continue;
      const mat = name.startsWith('walls') ? this.materials.walls[Number(name.slice(5))] : this.materials[name];
      if (!mat) { console.warn('No material for', name); continue; }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(data.position, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(data.normal, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(data.uv, 2));
      geo.setAttribute('color', new THREE.BufferAttribute(data.color, 3, true));
      if (data.facade) {
        // Facade data, 6 floats per vertex: bay, style, seed, storey, roof height, shop flag.
        const ib = new THREE.InterleavedBuffer(data.facade, 6);
        geo.setAttribute('facadeBay', new THREE.InterleavedBufferAttribute(ib, 1, 0));
        geo.setAttribute('facadeA', new THREE.InterleavedBufferAttribute(ib, 4, 1));
        geo.setAttribute('facadeShop', new THREE.InterleavedBufferAttribute(ib, 1, 5));
      }
      geo.setIndex(new THREE.BufferAttribute(data.index, 1));
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, mat);
      [mesh.castShadow, mesh.receiveShadow] = shadowsFor(name);
      mesh.matrixAutoUpdate = false;
      (DETAIL_MESHES.has(name) ? detail : group).add(mesh);
    }
    const props = buildProps(this.props, t.points, this.tier?.trees ?? 1);
    // Trees and lights stay visible far away; small clutter only near the player.
    for (const m of [...props.children]) (m.userData.kind >= 7 && m.userData.kind <= 10 ? detail : group).add(m);
    const n = t.tanks.length / 4;
    if (n) {
      const tanks = new THREE.InstancedMesh(this.tankGeo, this.materials.tank, n);
      const m = new THREE.Matrix4();
      for (let i = 0; i < n; i++) {
        const k = t.tanks[i * 4 + 3];
        m.makeScale(k, k, k).setPosition(t.tanks[i * 4], t.tanks[i * 4 + 1], t.tanks[i * 4 + 2]);
        tanks.setMatrixAt(i, m);
      }
      tanks.castShadow = true;
      tanks.computeBoundingSphere();
      detail.add(tanks);
    }
    group.updateMatrixWorld(true);
    this.scene.add(group);
    this.tiles.set(key, { ...t, group, detail });
    this.version = (this.version || 0) + 1;
  }

  unload(key) {
    const tile = this.tiles.get(key);
    if (!tile) return;
    this.scene.remove(tile.group);
    // Shared geometry (tanks, props) stays; tile geometry and instance buffers go.
    tile.group.traverse((o) => {
      if (o.isInstancedMesh) o.dispose();
      else if (o.geometry && o.geometry !== this.tankGeo) o.geometry.dispose();
    });
    this.tiles.delete(key);
    this.version = (this.version || 0) + 1;
  }

  /** Resolves once every tile within `radius` of (x, z) is loaded (or failed). */
  whenReady(x, z, radius, onProgress) {
    return new Promise((resolve) => {
      const check = () => {
        let total = 0, done = 0;
        for (const key of this.available.keys()) {
          const [tx, tz] = key.split(',').map(Number);
          if (this.tileDistance(tx, tz, x, z) > radius) continue;
          total++;
          if (this.tiles.has(key) || this.failed.has(key)) done++;
        }
        onProgress?.(done, total);
        if (done >= total) resolve();
        else { this.update(x, z); setTimeout(check, 50); }
      };
      check();
    });
  }

  // ------------------------------------------------------------ collisions

  /** Loaded tiles whose content might touch the circle (x, z, r). */
  *nearTiles(x, z, r) {
    const s = this.size;
    for (let tx = Math.floor((x - r) / s) - 1; tx <= Math.floor((x + r) / s) + 1; tx++)
      for (let tz = Math.floor((z - r) / s) - 1; tz <= Math.floor((z + r) / s) + 1; tz++) {
        const t = this.tiles.get(`${tx},${tz}`);
        if (t) yield t;
      }
  }

  /** True if a circle at (x, z) with radius r is blocked: buildings, sea, map edge. */
  hits(x, z, r) {
    const b = this.bounds;
    if (x - r < b.minX || x + r > b.maxX || z - r < b.minZ || z + r > b.maxZ) return true;
    for (const t of this.nearTiles(x, z, r)) {
      if (gridAny(t.collide.solid, x, z, r, (i) => polyHit(t.collide.solid, i, x, z, r))) return true;
    }
    return !this.walkable(x, z);
  }

  /** On land, on a pier, or on a road (bridges, causeways). Unknown tiles count as walkable. */
  walkable(x, z) {
    const s = this.size;
    const key = `${Math.floor(x / s)},${Math.floor(z / s)}`;
    if (!this.available.has(key)) return false; // open sea
    const own = this.tiles.get(key);
    if (!own) return true; // not loaded yet
    const w = own.collide.walkable;
    if (gridAny(w, x, z, 0, (i) => polyContains(w, i, x, z))) return true;
    return !!this.roadAt(x, z, 0);
  }

  /** Nearest road segment within its own half-width + slack: { tile, index, dist }. */
  roadAt(x, z, slack, vehicleOnly = false) {
    let best = null;
    for (const t of this.nearTiles(x, z, 20)) {
      const rd = t.collide.roads;
      gridAny(rd, x, z, slack, (i) => {
        const s = rd.segs, o = i * SEG;
        if (vehicleOnly && !(s[o + 5] & 1)) return false;
        const d = segDist(x, z, s[o], s[o + 1], s[o + 2], s[o + 3]);
        if (d <= s[o + 4] + slack && (!best || d < best.dist)) best = { tile: t, index: i, dist: d };
        return false;
      });
    }
    return best;
  }

  /** Name of the road the player is on, or ''. */
  roadNameAt(x, z) {
    let best = null;
    for (const t of this.nearTiles(x, z, 20)) {
      const rd = t.collide.roads;
      gridAny(rd, x, z, 6, (i) => {
        const n = rd.names[i];
        if (n < 0) return false;
        const s = rd.segs, o = i * SEG;
        const d = segDist(x, z, s[o], s[o + 1], s[o + 2], s[o + 3]) - s[o + 4];
        if (d < 6 && (!best || d < best.d)) best = { d, name: t.names[n] };
        return false;
      });
    }
    return best ? best.name : '';
  }

  /** Ground height under (x, z): asphalt on carriageways, kerb level elsewhere. */
  groundHeight(x, z) {
    return this.roadAt(x, z, -0.15, true) ? Y.ROAD : Y.KERB;
  }

  /** Segment geometry helper for tools and traffic: [x0, z0, x1, z1, halfWidth, vehicle]. */
  segment(tile, i) { return tile.collide.roads.segs.subarray(i * SEG, i * SEG + SEG); }

  get loadedCount() { return this.tiles.size; }
}

/** Visit grid items near (x, z) ± r; stops early when fn returns true. */
function gridAny(set, x, z, r, fn) {
  const g = set.grid;
  if (!set.count) return false;
  const a0 = Math.max(0, Math.floor((x - r - g.x0) / g.cell)), a1 = Math.min(g.nx - 1, Math.floor((x + r - g.x0) / g.cell));
  const b0 = Math.max(0, Math.floor((z - r - g.z0) / g.cell)), b1 = Math.min(g.nz - 1, Math.floor((z + r - g.z0) / g.cell));
  for (let b = b0; b <= b1; b++) {
    for (let a = a0; a <= a1; a++) {
      const c = b * g.nx + a;
      for (let k = g.start[c]; k < g.start[c + 1]; k++) if (fn(g.items[k])) return true;
    }
  }
  return false;
}

function polyContains(p, i, x, z) {
  const bx = p.box;
  if (x < bx[i * 4] || x > bx[i * 4 + 2] || z < bx[i * 4 + 1] || z > bx[i * 4 + 3]) return false;
  let inside = false;
  const c = p.coords;
  for (let r = p.polyRing[i]; r < p.polyRing[i + 1]; r++) {
    const s = p.ringStart[r], e = p.ringStart[r + 1];
    for (let k = s, j = e - 1; k < e; j = k++) {
      const xi = c[k * 2], zi = c[k * 2 + 1], xj = c[j * 2], zj = c[j * 2 + 1];
      if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
    }
  }
  return inside;
}

function polyHit(p, i, x, z, r) {
  const bx = p.box;
  if (x + r < bx[i * 4] || x - r > bx[i * 4 + 2] || z + r < bx[i * 4 + 1] || z - r > bx[i * 4 + 3]) return false;
  if (polyContains(p, i, x, z)) return true;
  const c = p.coords;
  for (let ri = p.polyRing[i]; ri < p.polyRing[i + 1]; ri++) {
    const s = p.ringStart[ri], e = p.ringStart[ri + 1];
    for (let k = s, j = e - 1; k < e; j = k++) {
      if (segDist(x, z, c[j * 2], c[j * 2 + 1], c[k * 2], c[k * 2 + 1]) < r) return true;
    }
  }
  return false;
}

function segDist(x, z, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz;
  let t = len2 ? ((x - ax) * dx + (z - az) * dz) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(ax + t * dx - x, az + t * dz - z);
}
