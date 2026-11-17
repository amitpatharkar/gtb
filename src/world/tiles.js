import * as THREE from 'three';
import { createProps, buildProps } from './props.js';
import { Y } from './levels.js';
import { POINT, STRUCT } from './tileFormat.js';

// Streams map tiles around the player and answers collision questions.
// Tiles are built by tileWorker.js (download, unzip, decode, mesh) off the main thread.

const LOAD_RADIUS = 700;    // metres from the player to a tile's edge
const UNLOAD_RADIUS = 950;
const MAX_IN_FLIGHT = 3;
const DETAIL_MESHES = new Set(['railSteel', 'paint', 'contact']); // hidden on far tiles
// [cast shadow, receive shadow] by mesh key (walls and roofs cast; ground only receives).
const shadowsFor = (key) => (key.startsWith('walls') || key.startsWith('roof') || key === 'parapet' || key === 'compound' || key === 'sheet' ? [true, true] : [false, true]);
// Floats per road segment: x0 z0 x1 z1 halfWidth flags y0 y1 (flags: 1 vehicle, 2 one-way, 4 main road,
// 8 worn, 16 rough, 32 off the ground, 64 tunnel, 128 covered; y0/y1: road surface height at the ends).
const SEG = 8;
// Levels: a mover climbs onto a surface at most STEP above it (ramps, kerbs); off the ground (more than
// these from the street) it is on a structure and must stay within its barriers or walls.
const STEP = 0.9, ABOVE = Y.KERB + 0.15, BELOW = Y.ROAD - 0.3;
let projT = 0; // where the last segDist landed along its segment (0..1)
/** Numeric tile key (no strings in per-frame lookups); tile indices stay within ±2048. */
const tileKey = (tx, tz) => (tx + 2048) * 4096 + (tz + 2048);

export class TileManager {
  constructor(scene, materials, tier) {
    this.scene = scene;
    this.tier = tier;
    this.materials = materials;
    this.tiles = new Map();    // key "tx,tz" → loaded tile
    this.byKey = new Map();    // numeric tileKey → loaded tile (collision queries)
    this.pending = new Map();  // key → request id
    this.failed = new Set();   // keys that failed to download (blocked while failed)
    this.tries = new Map();    // key → failed attempts (retried after 5, 10, 20 s; given up after 4)
    this.retryAt = new Map();  // key → time (performance.now) of the next attempt
    this.callbacks = new Map();
    this.nextId = 1;
    this.tankGeo = new THREE.CylinderGeometry(0.7, 0.7, 1.5, 10);
    this.tankGeo.translate(0, 0.75, 0);
    this.props = createProps();
    this.detailRadius = tier?.detailRadius ?? 300;
    this.loadRadius = tier?.loadRadius ?? LOAD_RADIUS;   // smaller on Low: fewer tiles, fewer draw calls
    // Scratch state for the collision queries (see roadHit).
    this.roadTile = null; this.roadIndex = -1; this.roadDist = Infinity;
    this.near = new Array(64).fill(null); // tiles found by nearInto (never shrunk: no garbage)
  }

  /** Flyovers and tunnels: the worker needs the cable-stayed spans (no piers under them). */
  configure(index) { this.worker?.postMessage({ spans: index.bridges?.pylons || [] }); }

  async init(baseUrl) {
    this.baseUrl = new URL(baseUrl, location.href).href;
    // GitHub Pages lets browsers keep files for 10 minutes: always revalidate the index, and
    // version every other map file by it, so a deploy never mixes old and new tiles.
    const res = await fetch(this.baseUrl + 'index.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Map index missing (${res.status}). Run "npm run tiles" first.`);
    this.index = await res.json();
    this.fileTag = encodeURIComponent(this.index.generated || '');
    this.size = this.index.tileSize;
    this.bounds = this.index.bounds;
    this.available = new Map(this.index.tiles.map(([tx, tz, bytes]) => [`${tx},${tz}`, bytes]));
    this.availableKeys = new Set(this.index.tiles.map(([tx, tz]) => tileKey(tx, tz)));
    this.worker = new Worker(new URL('./tileWorker.js', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e) => this.callbacks.get(e.data.id)?.(e.data);
    this.configure(this.index);
    return this.index;
  }

  /** URL of a map file next to index.json (tiles, overview, skyline, trains), versioned. */
  fileUrl(name) { return `${this.baseUrl}${name}${this.fileTag ? `?v=${this.fileTag}` : ''}`; }

  /** Distance from (x, z) to the nearest point of a tile. */
  tileDistance(tx, tz, x, z) {
    const s = this.size;
    const dx = Math.max(tx * s - x, 0, x - (tx + 1) * s);
    const dz = Math.max(tz * s - z, 0, z - (tz + 1) * s);
    return Math.hypot(dx, dz);
  }

  update(x, z) {
    const s = this.size, r = Math.ceil(this.loadRadius / s) + 1;
    const ptx = Math.floor(x / s), ptz = Math.floor(z / s);
    const wanted = [];
    for (let tx = ptx - r; tx <= ptx + r; tx++) {
      for (let tz = ptz - r; tz <= ptz + r; tz++) {
        const k = tileKey(tx, tz);
        if (!this.availableKeys.has(k) || this.byKey.has(k)) continue; // most tiles: no string key needed
        const key = `${tx},${tz}`;
        if (this.pending.has(key)) continue;
        if (this.failed.has(key)) {
          if (!(performance.now() >= this.retryAt.get(key))) continue; // waiting, or given up
          this.failed.delete(key); // try again
        }
        const d = this.tileDistance(tx, tz, x, z);
        if (d <= this.loadRadius) wanted.push([d, tx, tz, key]);
      }
    }
    wanted.sort((a, b) => a[0] - b[0]);
    for (const [, tx, tz, key] of wanted) {
      if (this.pending.size >= MAX_IN_FLIGHT) break;
      this.load(tx, tz, key);
    }
    for (const tile of this.tiles.values()) {
      const d = this.tileDistance(tile.tx, tile.tz, x, z);
      if (d > this.loadRadius + (UNLOAD_RADIUS - LOAD_RADIUS)) this.unload(tile.key);
      else tile.detail.visible = d < this.detailRadius;
    }
    // A tile that failed far away gets a fresh set of tries when the player comes back.
    for (const key of this.failed) {
      const [tx, tz] = key.split(',').map(Number);
      if (this.tileDistance(tx, tz, x, z) > this.loadRadius + (UNLOAD_RADIUS - LOAD_RADIUS)) { this.failed.delete(key); this.tries.delete(key); this.retryAt.delete(key); }
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
        // Retry with back-off (5 s, 10 s, 20 s); meanwhile the tile counts as blocked (hits).
        const n = (this.tries.get(key) || 0) + 1;
        this.tries.set(key, n);
        this.failed.add(key);
        if (n < 4) { this.retryAt.set(key, performance.now() + 5000 * 2 ** (n - 1)); console.warn(`Tile ${key} failed (try ${n}, retrying):`, msg.error); }
        else { this.retryAt.delete(key); console.error(`Tile ${key} failed:`, msg.error); }
        return;
      }
      this.tries.delete(key); this.retryAt.delete(key);
      this.add(key, msg.result);
    });
    this.worker.postMessage({ id, url: this.fileUrl(`${tx}_${tz}.bin.gz`) });
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
        // Facade data, 7 floats per vertex: bay, style, seed, storey, roof height, shop flag, bay width.
        const ib = new THREE.InterleavedBuffer(data.facade, 7);
        geo.setAttribute('facadeBay', new THREE.InterleavedBufferAttribute(ib, 1, 0));
        geo.setAttribute('facadeA', new THREE.InterleavedBufferAttribute(ib, 4, 1));
        geo.setAttribute('facadeB', new THREE.InterleavedBufferAttribute(ib, 2, 5));
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
    const tile = { ...t, key, group, detail };
    this.tiles.set(key, tile);
    this.byKey.set(tileKey(t.tx, t.tz), tile);
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
    this.byKey.delete(tileKey(tile.tx, tile.tz));
    this.near.fill(null); // let the unloaded tile go
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
  // These run hundreds of times per frame (cars, people, police), so they allocate nothing:
  // numeric tile keys, plain loops instead of generators and closures, results in fields.

  /** Loaded tiles whose content might touch the circle (x, z, r), as a new array. */
  nearTiles(x, z, r) {
    return this.near.slice(0, this.nearInto(x, z, r));
  }

  /**
   * nearTiles without garbage: fills this.near from index 0 and returns how many it found.
   * Each query reads them before the next one starts (none of them nest).
   */
  nearInto(x, z, r) {
    const s = this.size, out = this.near, tx1 = Math.floor((x + r) / s) + 1, tz0 = Math.floor((z - r) / s) - 1, tz1 = Math.floor((z + r) / s) + 1;
    let n = 0;
    for (let tx = Math.floor((x - r) / s) - 1; tx <= tx1; tx++)
      for (let tz = tz0; tz <= tz1; tz++) {
        const t = this.byKey.get(tileKey(tx, tz));
        if (t) out[n++] = t; // grows the array once if ever needed
      }
    return n;
  }

  /**
   * True if a circle at (x, z) with radius r is blocked: buildings, sea, map edge, a tile that failed
   * to load. y is the mover's height: on a deck, ramp or in a tunnel (off the street level) only the
   * structure's own barriers and walls count; at street level also ramp walls, piers and open cuts.
   * vehicle: only vehicle decks carry it (cars don't climb footbridge stairs).
   */
  hits(x, z, r, y = Y.ROAD, vehicle = false) {
    const b = this.bounds;
    if (x - r < b.minX || x + r > b.maxX || z - r < b.minZ || z + r > b.maxZ) return true;
    if (this.failed.size && this.failedAt(x, z, r)) return true; // no data there: a wall, not a void
    if (y > ABOVE || y < BELOW) return !this.supported(x, z, r, y, vehicle);
    const near = this.near, count = this.nearInto(x, z, r);
    for (let n = 0; n < count; n++) {
      const p = near[n].collide.solid;
      if (!p.count) continue;
      const g = p.grid;
      const a0 = Math.max(0, Math.floor((x - r - g.x0) / g.cell)), a1 = Math.min(g.nx - 1, Math.floor((x + r - g.x0) / g.cell));
      const b0 = Math.max(0, Math.floor((z - r - g.z0) / g.cell)), b1 = Math.min(g.nz - 1, Math.floor((z + r - g.z0) / g.cell));
      for (let gb = b0; gb <= b1; gb++) for (let ga = a0; ga <= a1; ga++) {
        const c = gb * g.nx + ga;
        for (let k = g.start[c]; k < g.start[c + 1]; k++) if (polyHit(p, g.items[k], x, z, r)) return true;
      }
    }
    if (this.structWall(x, z, r, y)) return true;
    return !this.walkable(x, z, y);
  }

  /**
   * On a structure at height y: is the circle within the barriers (or tunnel walls) of a deck at
   * about that level? Low ends of ramps are lenient (the street takes over there).
   */
  supported(x, z, r, y, vehicle) {
    const near = this.near, count = this.nearInto(x, z, 20);
    for (let n = 0; n < count; n++) {
      const dk = near[n].collide.decks;
      if (!dk || !dk.count) continue;
      const g = dk.grid, s = near[n].collide.roads.segs;
      const ga = Math.floor((x - g.x0) / g.cell), gb = Math.floor((z - g.z0) / g.cell);
      if (ga < 0 || ga >= g.nx || gb < 0 || gb >= g.nz) continue;
      const c = gb * g.nx + ga;
      for (let k = g.start[c]; k < g.start[c + 1]; k++) {
        const o = dk.index[g.items[k]] * SEG, f = s[o + 5];
        if (vehicle && !(f & 1)) continue;
        const d = segDist(x, z, s[o], s[o + 1], s[o + 2], s[o + 3]), hw = s[o + 4];
        if (d > hw + 0.3) continue;
        const sy = s[o + 6] + (s[o + 7] - s[o + 6]) * projT;
        if (sy > y + STEP || sy < y - 1.5) continue;
        const h = sy - Y.ROAD;
        const room = h > 0 && h < 0.6 ? hw + 0.3 : h > 0 ? hw - 0.45 - r * 0.5 : h > STRUCT.COVER ? hw - 0.1 - r * 0.5 : hw - 0.2 - r * 0.5;
        if (d <= room) return true;
      }
    }
    return false;
  }

  /**
   * At street level: the walls of a ramp or a low deck in the way, or the edge of an open cut
   * (tunnel approach) — but not the deck high overhead, nor a covered tunnel below.
   */
  structWall(x, z, r, y) {
    const near = this.near, count = this.nearInto(x, z, 20);
    for (let n = 0; n < count; n++) {
      const dk = near[n].collide.decks;
      if (!dk || !dk.count) continue;
      const g = dk.grid, s = near[n].collide.roads.segs;
      const a0 = Math.max(0, Math.floor((x - r - g.x0) / g.cell)), a1 = Math.min(g.nx - 1, Math.floor((x + r - g.x0) / g.cell));
      const b0 = Math.max(0, Math.floor((z - r - g.z0) / g.cell)), b1 = Math.min(g.nz - 1, Math.floor((z + r - g.z0) / g.cell));
      for (let gb = b0; gb <= b1; gb++) for (let ga = a0; ga <= a1; ga++) {
        const c = gb * g.nx + ga;
        for (let k = g.start[c]; k < g.start[c + 1]; k++) {
          const o = dk.index[g.items[k]] * SEG, f = s[o + 5];
          if (f & 128) continue; // covered tunnel: the street above is ordinary
          const d = segDist(x, z, s[o], s[o + 1], s[o + 2], s[o + 3]), hw = s[o + 4];
          if (d > hw + 0.6 + r) continue;
          const sy = s[o + 6] + (s[o + 7] - s[o + 6]) * projT;
          if (sy > y + 0.45 && sy < y + STRUCT.CLEAR && d < hw + r) return true;  // ramp wall
          if (sy < y - 0.2 && sy < Y.ROAD - STRUCT.AT_GRADE && d > hw - r) return true; // edge of an open cut
        }
      }
    }
    return false;
  }

  /**
   * Highest deck, ramp or tunnel floor at (x, z) no higher than `top` (within the half-width +
   * slack), left in surfY (-Infinity: none) with surfTile/surfIndex; `hole` says whether (x, z)
   * is in an open cut (no street surface there).
   */
  levelScan(x, z, top, slack, vehicle) {
    this.surfY = -Infinity; this.surfTile = null; this.surfIndex = -1; this.hole = false;
    const near = this.near, count = this.nearInto(x, z, 20);
    for (let n = 0; n < count; n++) {
      const t = near[n], dk = t.collide.decks;
      if (!dk || !dk.count) continue;
      const g = dk.grid, s = t.collide.roads.segs;
      const ga = Math.floor((x - g.x0) / g.cell), gb = Math.floor((z - g.z0) / g.cell);
      if (ga < 0 || ga >= g.nx || gb < 0 || gb >= g.nz) continue;
      const c = gb * g.nx + ga;
      for (let k = g.start[c]; k < g.start[c + 1]; k++) {
        const i = dk.index[g.items[k]], o = i * SEG, f = s[o + 5];
        const d = segDist(x, z, s[o], s[o + 1], s[o + 2], s[o + 3]), hw = s[o + 4];
        if (d > hw + 0.6) continue;
        const sy = s[o + 6] + (s[o + 7] - s[o + 6]) * projT;
        if (!(f & 128) && sy < Y.ROAD - STRUCT.AT_GRADE) this.hole = true;
        if (d > hw + slack || sy > top || (vehicle && !(f & 1))) continue;
        if (sy > this.surfY) { this.surfY = sy; this.surfTile = t; this.surfIndex = i; }
      }
    }
    return this.surfY;
  }

  /** Under a tunnel ceiling at (x, z, y)? Its height (for the camera), else Infinity. */
  ceilingAt(x, z, y) {
    this.levelScan(x, z, y + STEP, 0.5, false);
    if (!this.surfTile || this.surfY < y - 2) return Infinity;
    const f = this.surfTile.collide.roads.segs[this.surfIndex * SEG + 5];
    return f & 128 || this.surfY - Y.ROAD < STRUCT.COVER + 0.5 ? this.surfY + STRUCT.CEILING - 0.35 : Infinity;
  }

  /** True if the circle touches a tile that failed to download. */
  failedAt(x, z, r) {
    const s = this.size;
    for (let tx = Math.floor((x - r) / s); tx <= Math.floor((x + r) / s); tx++)
      for (let tz = Math.floor((z - r) / s); tz <= Math.floor((z + r) / s); tz++) if (this.failed.has(`${tx},${tz}`)) return true;
    return false;
  }

  /** On land, on a pier, or on a road (bridges, causeways). Tiles not loaded yet count as walkable, failed ones not. */
  walkable(x, z, y = Y.ROAD) {
    const s = this.size;
    const k = tileKey(Math.floor(x / s), Math.floor(z / s));
    if (!this.availableKeys.has(k)) return false; // open sea
    const own = this.byKey.get(k);
    if (this.failed.size && this.failed.has(`${Math.floor(x / s)},${Math.floor(z / s)}`)) return false; // no data
    if (!own) return true; // not loaded yet
    const w = own.collide.walkable;
    if (w.count) {
      const g = w.grid;
      const ga = Math.floor((x - g.x0) / g.cell), gb = Math.floor((z - g.z0) / g.cell);
      if (ga >= 0 && ga < g.nx && gb >= 0 && gb < g.nz) {
        const c = gb * g.nx + ga;
        for (let i = g.start[c]; i < g.start[c + 1]; i++) if (polyContains(w, g.items[i], x, z)) return true;
      }
    }
    return this.roadHit(x, z, 0, false, y);
  }

  /**
   * Allocation-free core of roadAt: true if a road segment is within its own half-width +
   * slack of (x, z); the nearest is left in roadTile / roadIndex / roadDist.
   */
  roadHit(x, z, slack, vehicleOnly = false, y = Y.ROAD) {
    this.roadTile = null; this.roadIndex = -1;
    let best = Infinity;
    const near = this.near, count = this.nearInto(x, z, 20);
    for (let n = 0; n < count; n++) {
      const t = near[n], rd = t.collide.roads;
      if (!rd.count) continue;
      // Cells around the point itself even for a negative slack (a negative range used to skip
      // every cell within 0.15 m of a 16 m grid line: roads read as kerb there).
      const g = rd.grid, s = rd.segs, r = slack > 0 ? slack : 0;
      const a0 = Math.max(0, Math.floor((x - r - g.x0) / g.cell)), a1 = Math.min(g.nx - 1, Math.floor((x + r - g.x0) / g.cell));
      const b0 = Math.max(0, Math.floor((z - r - g.z0) / g.cell)), b1 = Math.min(g.nz - 1, Math.floor((z + r - g.z0) / g.cell));
      for (let gb = b0; gb <= b1; gb++) for (let ga = a0; ga <= a1; ga++) {
        const c = gb * g.nx + ga;
        for (let k = g.start[c]; k < g.start[c + 1]; k++) {
          const i = g.items[k], o = i * SEG;
          if (vehicleOnly && !(s[o + 5] & 1)) continue;
          const d = segDist(x, z, s[o], s[o + 1], s[o + 2], s[o + 3]);
          if (d <= s[o + 4] + slack && d < best) {
            // Decks overhead and tunnels below are other levels: only roads at about height y count.
            if (s[o + 5] & 32) { const sy = s[o + 6] + (s[o + 7] - s[o + 6]) * projT; if (sy > y + 1.2 || sy < y - 1.2) continue; }
            best = d; this.roadTile = t; this.roadIndex = i;
          }
        }
      }
    }
    this.roadDist = best;
    return this.roadTile !== null;
  }

  /** Nearest road segment within its own half-width + slack: { tile, index, dist }. */
  roadAt(x, z, slack, vehicleOnly = false, y = Y.ROAD) {
    return this.roadHit(x, z, slack, vehicleOnly, y) ? { tile: this.roadTile, index: this.roadIndex, dist: this.roadDist } : null;
  }

  /** Name of the road the player is on, or '' (y: on a flyover, its name; under it, the street's). */
  roadNameAt(x, z, y = Y.ROAD) {
    let best = Infinity, name = '';
    const near = this.near, count = this.nearInto(x, z, 20);
    for (let n = 0; n < count; n++) {
      const t = near[n], rd = t.collide.roads;
      if (!rd.count) continue;
      const g = rd.grid, s = rd.segs;
      const a0 = Math.max(0, Math.floor((x - 6 - g.x0) / g.cell)), a1 = Math.min(g.nx - 1, Math.floor((x + 6 - g.x0) / g.cell));
      const b0 = Math.max(0, Math.floor((z - 6 - g.z0) / g.cell)), b1 = Math.min(g.nz - 1, Math.floor((z + 6 - g.z0) / g.cell));
      for (let gb = b0; gb <= b1; gb++) for (let ga = a0; ga <= a1; ga++) {
        const c = gb * g.nx + ga;
        for (let k = g.start[c]; k < g.start[c + 1]; k++) {
          const i = g.items[k], nm = rd.names[i];
          if (nm < 0) continue;
          const o = i * SEG;
          const d = segDist(x, z, s[o], s[o + 1], s[o + 2], s[o + 3]) - s[o + 4];
          if (d < 6 && d < best) {
            if (s[o + 5] & 32) { const sy = s[o + 6] + (s[o + 7] - s[o + 6]) * projT; if (sy > y + 2 || sy < y - 2) continue; }
            best = d; name = t.names[nm];
          }
        }
      }
    }
    return name;
  }

  /**
   * Ground height under (x, z) for someone at height y: asphalt on carriageways, kerb level
   * elsewhere — or the highest deck, ramp or tunnel floor there no more than STEP above y (so a
   * car at street level drives under a flyover and up its ramp, and one on the deck stays on it).
   */
  groundHeight(x, z, y = Y.ROAD, vehicle = false) {
    const sy = this.levelScan(x, z, y + STEP, -0.15, vehicle);
    const g = this.hole ? -Infinity : this.roadHit(x, z, -0.15, true) ? Y.ROAD : Y.KERB;
    if (sy > g || (g > y + STEP && sy > -Infinity)) return sy;
    return g > -Infinity ? g : Y.KERB;
  }

  /** Ground height felt by the player's wheels: rough lanes undulate, potholes dip (decks are smooth). */
  wheelHeight(x, z, atY = Y.ROAD, vehicle = true) {
    this.inPothole = false;
    const sy = this.levelScan(x, z, atY + STEP, -0.15, vehicle);
    if (sy > -Infinity) {
      const g = this.hole ? -Infinity : this.roadHit(x, z, -0.15, true) ? Y.ROAD : Y.KERB;
      if (sy > g || g > atY + STEP) return sy;
    }
    if (!this.roadHit(x, z, -0.15, true)) return Y.KERB;
    const f = this.roadTile.collide.roads.segs[this.roadIndex * SEG + 5];
    let y = Y.ROAD;
    if (f & 16) y += 0.028 * Math.sin(x * 1.7 + Math.sin(z * 0.6) * 2.2) * Math.sin(z * 2.1 + x * 0.35) + 0.012 * Math.sin(x * 5.3 - z * 4.1);
    else if (f & 8) y += 0.01 * Math.sin(x * 1.2 + z * 0.9) * Math.sin(z * 1.6);
    const near = this.near, count = this.nearInto(x, z, 2);
    for (let n = 0; n < count; n++) {
      const t = near[n], arr = t.points[POINT.POTHOLE];
      if (!arr) continue;
      for (let i = 0; i < arr.length; i += 5) {
        const dx = x - arr[i] - t.origin[0], dz = z - arr[i + 2] - t.origin[1], rad = arr[i + 4] * 0.45;
        const d2 = dx * dx + dz * dz;
        if (d2 < rad * rad) { y -= 0.09 * (1 - Math.sqrt(d2) / rad); this.inPothole = true; }
      }
    }
    return y;
  }

  /** Segment geometry helper for tools and traffic: [x0, z0, x1, z1, halfWidth, flags, y0, y1]. */
  segment(tile, i) { return tile.collide.roads.segs.subarray(i * SEG, i * SEG + SEG); }

  get loadedCount() { return this.tiles.size; }
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
  projT = t;
  const ex = ax + t * dx - x, ez = az + t * dz - z;
  return Math.sqrt(ex * ex + ez * ez);
}
