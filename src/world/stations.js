import * as THREE from 'three';
import { floor, ramp, wall, post } from './structures.js';

// Railway stations near the player, built from tiles/stations.json (scripts/lib/stations.mjs):
// raised platforms with the coping and the yellow line, platform roofs on a row of columns,
// foot overbridges on piers with parapets and roofs, stairs, ramps at the platform ends, the
// yellow station boards (Marathi, Hindi, English), train indicators, benches and stalls.
// Everything you can stand on or bump into is also registered with the walkable structures
// (src/world/structures.js), so the player walks up the stairs, across the bridge and down to
// the platform at the real heights. Stations are built one per frame as the player comes within
// BUILD metres and dropped beyond DROP.
//
// Sizes (research: docs/research/metro/reports/Mumbai local trains and stations.md): platform
// top 0.9 m above the rail (840–920 mm), footbridge floor 7.5 m above the rail, roofs about 4.4 m
// over the platform, boards black on yellow in three languages.

const BUILD = 560, DROP = 820;
const GROUND = 0.2, RISE = 0.17;
const COL = { coping: 0xd9d4c8, yellow: 0xf2c21a, side: 0x9b968c, sideDark: 0x5d5a55, steel: 0x3f6e7c, cream: 0xe8dcc0, roofUnder: 0xb8bcbf, parapet: 0xd8cfbd, rail: 0x2f5c6c, bench: 0x6d7378, stall: 0x2e6b9c };

/** Names the game shows in Devanagari where the station's real name was altered. */
const DEVA = { 'Chhatrapati Chai Terminus': ['छत्रपती चाय टर्मिनस', 'छत्रपति चाय टर्मिनस'] };
/** Destination codes on the indicators (Central Railway letters; Western Railway station codes). */
const CODE = { Churchgate: 'CCG', Virar: 'VR', Borivali: 'BO', 'Chhatrapati Chai Terminus': 'CSMT', 'Kalyan Junction': 'K', Kalyan: 'K', Panvel: 'PL', Goregaon: 'GN', Andheri: 'A', Thane: 'T' };

/** Grey corrugated roof sheeting (ribs every 0.2 m), weathered in streaks. */
export function corrugated() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const g = c.getContext('2d');
  for (let x = 0; x < 64; x++) { const k = 0.5 + 0.5 * Math.cos((x / 64) * Math.PI * 2 * 4); const v = Math.round(150 + 60 * k); g.fillStyle = `rgb(${v},${v + 3},${v + 6})`; g.fillRect(x, 0, 1, 256); }
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(90,70,50,${0.04 + Math.random() * 0.08})`; g.fillRect(Math.random() * 64, Math.random() * 256, 2 + Math.random() * 4, 20 + Math.random() * 80); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1.25, 0.25); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Positions, normals, colours and uvs for one material (uv in metres, projected along the normal). */
const COLOURS = new Map();
const rgbOf = (hex) => { let c = COLOURS.get(hex); if (!c) { const k = new THREE.Color(hex); COLOURS.set(hex, c = [k.r, k.g, k.b]); } return c; };

export class Buf {
  constructor() { this.p = []; this.n = []; this.c = []; this.u = []; }
  tri(a, b, c, col) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const C = rgbOf(col), ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz), proj = ay >= ax && ay >= az ? 0 : ax >= az ? 1 : 2;
    for (let k = 0; k < 3; k++) {
      const q = k === 0 ? a : k === 1 ? b : c;
      this.p.push(q[0], q[1], q[2]); this.n.push(nx, ny, nz); this.c.push(C[0], C[1], C[2]);
      if (proj === 0) this.u.push(q[0], q[2]); else if (proj === 1) this.u.push(q[2], q[1]); else this.u.push(q[0], q[1]);
    }
  }
  /** Quad a b c d (counter-clockwise seen from the side it faces). */
  quad(a, b, c, d, col) { this.tri(a, b, c, col); this.tri(a, c, d, col); }
  /** Quad facing along (nx, ny, nz), whatever order its corners come in. */
  face(a, b, c, d, col, nx, ny, nz) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    if (cx * nx + cy * ny + cz * nz < 0) this.quad(a, d, c, b, col); else this.quad(a, b, c, d, col);
  }
  /** Triangle facing up. */
  up(a, b, c, col) {
    const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    if (ny < 0) this.tri(a, c, b, col); else this.tri(a, b, c, col);
  }
  /** Both faces. */
  quad2(a, b, c, d, col) { this.quad(a, b, c, d, col); this.quad(a, d, c, b, col); }
  /** An oriented box: centre (x, y0…y1, z), half sizes along (ux, uz) and across. */
  box(x, z, ux, uz, hl, hw, y0, y1, col) {
    const vx = -uz, vz = ux, P = (s, t, y) => [x + ux * s + vx * t, y, z + uz * s + vz * t];
    const c = [P(-hl, -hw, 0), P(hl, -hw, 0), P(hl, hw, 0), P(-hl, hw, 0)];
    const at = (k, y) => [c[k][0], y, c[k][2]];
    this.face(at(0, y1), at(1, y1), at(2, y1), at(3, y1), col, 0, 1, 0);
    this.face(at(0, y0), at(1, y0), at(2, y0), at(3, y0), col, 0, -1, 0);
    for (let k = 0; k < 4; k++) { const j = (k + 1) % 4; this.face(at(k, y0), at(j, y0), at(j, y1), at(k, y1), col, (c[k][0] + c[j][0]) / 2 - x, 0, (c[k][2] + c[j][2]) / 2 - z); }
  }
  /** Upright cylinder. */
  cyl(x, z, r, y0, y1, col, seg = 8) {
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const p0 = [x + Math.cos(a0) * r, z + Math.sin(a0) * r], p1 = [x + Math.cos(a1) * r, z + Math.sin(a1) * r];
      this.face([p0[0], y0, p0[1]], [p0[0], y1, p0[1]], [p1[0], y1, p1[1]], [p1[0], y0, p1[1]], col, (p0[0] + p1[0]) / 2 - x, 0, (p0[1] + p1[1]) / 2 - z);
    }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.computeBoundingSphere();
    return g;
  }
  get empty() { return !this.p.length; }
}

export class Stations {
  static async create(ctx) {
    const res = await fetch(ctx.tiles.fileUrl('stations.json')).catch(() => null);
    if (!res?.ok) return null;
    const json = await res.json();
    if (!json.platforms?.length) return null;
    return new Stations(ctx, json);
  }

  /** ctx: scene, tiles, structures, materials, clock, tier, trains() → the local trains (for indicators). */
  constructor(ctx, json) {
    Object.assign(this, ctx);
    this.top = json.platformTop;
    this.list = json.stations.map((s, i) => ({ ...s, i, platforms: [], decks: [], stairs: [], built: null, x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity }));
    const grow = (st, x, z) => { st.x0 = Math.min(st.x0, x); st.x1 = Math.max(st.x1, x); st.z0 = Math.min(st.z0, z); st.z1 = Math.max(st.z1, z); };
    for (const p of json.platforms) { const st = this.list[p.st]; if (!st) continue; st.platforms.push(p); for (const [x, z] of p.ring) grow(st, x, z); }
    json.decks.forEach((d, i) => {
      // A bridge between two stations (or none mapped) goes with the nearest station.
      let st = this.list[d.st];
      if (!st) { let bd = Infinity; for (const s of this.list) { const dd = Math.hypot(s.x - d.pts[0][0], s.z - d.pts[0][1]); if (dd < bd) { bd = dd; st = s; } } }
      d.i = i; d.stairs = [];
      st.decks.push(d);
      for (const [x, z] of d.pts) grow(st, x, z);
    });
    for (const s of json.stairs) { const d = json.decks[s.deck]; if (d) d.stairs.push(s); }
    for (const st of this.list) { st.cx = (st.x0 + st.x1) / 2; st.cz = (st.z0 + st.z1) / 2; st.r = Math.hypot(st.x1 - st.x0, st.z1 - st.z0) / 2; }
    const M = ctx.materials;
    this.mat = {
      top: M.paved, side: M.parapet, roof: new THREE.MeshStandardMaterial({ vertexColors: true, map: corrugated(), roughness: 0.55, metalness: 0.35, side: THREE.DoubleSide }),
      flat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.05 }),
      steel: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.35 }),
      paint: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      glow: new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xfff2d8, emissiveIntensity: 0, roughness: 0.4 }),
    };
    this.scanT = 0;
    this.indT = 0;
  }

  update(dt, P) {
    const night = this.clock.night ?? 0;
    // Right after a jump (tow, ride, cheat) the tiles are busy: start building a few frames later.
    if (Math.hypot(P.x - (this.lastX ?? 1e9), P.z - (this.lastZ ?? 1e9)) > 150) { this.quiet = 3; this.scanT = 0.15; }
    this.lastX = P.x; this.lastZ = P.z;
    if (this.quiet > 0) { this.quiet--; return; }
    this.mat.glow.emissiveIntensity = 0.15 + night * 2.2;
    if ((this.scanT -= dt) <= 0) {
      this.scanT = 0.5;
      let todo = null, td = Infinity;
      for (const st of this.list) {
        const d = Math.max(0, Math.hypot(st.cx - P.x, st.cz - P.z) - st.r);
        if (st.built && d > DROP) this.drop(st);
        else if (!st.built && !st.building && d < BUILD && d < td) { td = d; todo = st; }
      }
      if (todo && !this.job) this.build(todo); // one station at a time
    }
    // Building is spread over frames: a few milliseconds of it per step.
    // (The metro waits while a station is being built: one builder, about 2 ms, per frame.)
    if (this.job) {
      const j = this.job, t0 = performance.now();
      while (j.i < j.tasks.length && performance.now() - t0 < 2) j.tasks[j.i++]();
      if (j.i >= j.tasks.length) { this.job = null; this.finish(j); }
    }
    // Indicators of the station the player is nearest to: the next trains, every 2 s.
    if ((this.indT -= dt) <= 0) {
      this.indT = 2;
      for (const st of this.list) if (st.built?.indicator && Math.hypot(st.cx - P.x, st.cz - P.z) < st.r + 220) this.drawIndicator(st);
    }
  }

  /** Build the stations within r of (x, z) at once (after a teleport onto a platform). */
  buildNow(x, z, r = 250) {
    for (const st of this.list) {
      if (st.built || Math.max(0, Math.hypot(st.cx - x, st.cz - z) - st.r) > r) continue;
      if (this.job?.st !== st) { if (this.job) this.finishJob(); this.build(st); }
      this.finishJob();
    }
  }

  finishJob() {
    const j = this.job;
    if (!j) return;
    while (j.i < j.tasks.length) j.tasks[j.i++]();
    this.job = null;
    this.finish(j);
  }

  drop(st) {
    this.structures.remove(st);
    this.scene.remove(st.built.group);
    st.built.group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    for (const t of st.built.textures) t.dispose();
    for (const m of st.built.mats) m.dispose();
    st.built = null; st.indicatorCanvas = st.indicatorTex = null;
  }

  // ---------------------------------------------------------------- building
  build(st) {
    const B = { top: new Buf(), side: new Buf(), roof: new Buf(), flat: new Buf(), steel: new Buf(), paint: new Buf(), glow: new Buf(), board: new Buf(), ind: new Buf() };
    const pieces = [], top = this.top, tasks = [];
    for (const p of st.platforms) tasks.push(() => this.platform(p, B, pieces, top));
    for (const d of st.decks) { tasks.push(() => this.deck(d, B, pieces)); for (const s of d.stairs) tasks.push(() => this.stair(s, B, pieces)); }
    st.building = true;
    const job = this.job = { st, B, pieces, tasks, i: 0, group: new THREE.Group(), textures: [], mats: [] };
    // Finishing is spread over frames too: one mesh per task, the walkable pieces 400 at a time.
    for (const k of Object.keys(B)) tasks.push(() => this.meshFor(job, k));
    let at = 0;
    const register = () => { this.structures.add(st, pieces.slice(at, at + 400)); at += 400; if (at < pieces.length) job.tasks.splice(job.i, 0, register); };
    tasks.push(register);
  }

  /** One material's mesh of a station being built. */
  meshFor(job, k) {
    const { st, B, group, textures, mats } = job, buf = B[k];
    if (buf.empty) return;
    let mat = this.mat[k];
    if (k === 'board') { const t = this.boardTexture(st); textures.push(t); mat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.55, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.05 + (this.clock.night ?? 0) * 0.35 }); mats.push(mat); }
    if (k === 'ind') {
      const c = document.createElement('canvas'); c.width = 512; c.height = 128;
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; textures.push(t);
      mat = new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 1.1, roughness: 0.4 }); mats.push(mat);
      st.indicatorCanvas = c; st.indicatorTex = t;
    }
    const mesh = new THREE.Mesh(buf.geometry(), mat);
    mesh.castShadow = k === 'roof' || k === 'side' || k === 'steel';
    mesh.receiveShadow = true;
    group.add(mesh);
    B[k] = null; // the arrays can go
  }

  finish({ st, group, textures, mats }) {
    st.building = false;
    group.name = `station ${st.name}`;
    this.scene.add(group);
    st.built = { group, textures, mats, indicator: !!st.indicatorCanvas };
    if (st.built.indicator) this.drawIndicator(st);
  }

  /** One raised platform: slab, coping, yellow line, end ramps, roof, boards, benches, a stall. */
  platform(p, B, pieces, y) {
    const ring = p.ring, n = ring.length;
    // Counter-clockwise in (x, z) seen from above (y up, z south): signed area < 0 in x-z maths.
    let area = 0;
    for (let i = 0; i < n; i++) { const a = ring[i], b = ring[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
    const ccw = area < 0; // with z pointing south, "anticlockwise from above" has negative x-z area
    // Top: triangulated outline.
    const tris = THREE.ShapeUtils.triangulateShape(ring.map(([x, z]) => new THREE.Vector2(x, z)), []);
    for (const [a, b, c] of tris) B.top.up([ring[a][0], y, ring[a][1]], [ring[b][0], y, ring[b][1]], [ring[c][0], y, ring[c][1]], 0xffffff);
    pieces.push(floor(ring, y));
    // Ramps at the ends: the wall has a gap where each starts.
    const ramps = p.ramps || [];
    for (const [x0, z0, x1, z1, w] of ramps) {
      const L = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / L, uz = (z1 - z0) / L, vx = -uz * w / 2, vz = ux * w / 2;
      pieces.push(ramp(x0, z0, ux, uz, L, w / 2, y, GROUND + 0.05));
      B.side.face([x0 + vx, y, z0 + vz], [x0 - vx, y, z0 - vz], [x1 - vx, GROUND + 0.05, z1 - vz], [x1 + vx, GROUND + 0.05, z1 + vz], 0xc9c3b8, 0, 1, 0);
      for (const s of [-1, 1]) B.side.quad2([x0 + vx * s, y, z0 + vz * s], [x1 + vx * s, GROUND + 0.05, z1 + vz * s], [x1 + vx * s, GROUND, z1 + vz * s], [x0 + vx * s, GROUND, z0 + vz * s], COL.side);
    }
    for (let i = 0; i < n; i++) {
      const a = ring[i], b = ring[(i + 1) % n], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 0.05) continue;
      const ex = (b[0] - a[0]) / len, ez = (b[1] - a[1]) / len;
      // Outward normal (the platform is on the other side).
      let ox = ez, oz = -ex;
      if (!ccw) { ox = -ox; oz = -oz; }
      // Side face, split around ramp mouths.
      let cuts = [];
      for (const [x0, z0, , , w] of ramps) {
        const al = (x0 - a[0]) * ex + (z0 - a[1]) * ez, off = Math.abs((x0 - a[0]) * ox + (z0 - a[1]) * oz);
        if (off < 1.2 && al > -w && al < len + w) cuts.push([al - w / 2, al + w / 2]);
      }
      cuts = cuts.sort((q, r) => q[0] - r[0]);
      let u = 0;
      const face = (u0, u1) => {
        if (u1 - u0 < 0.05) return;
        const p0 = [a[0] + ex * u0, a[1] + ez * u0], p1 = [a[0] + ex * u1, a[1] + ez * u1];
        B.side.face([p0[0], GROUND - 0.1, p0[1]], [p1[0], GROUND - 0.1, p1[1]], [p1[0], y, p1[1]], [p0[0], y, p0[1]], COL.side, ox, 0, oz);
        pieces.push(wall(p0[0], p0[1], p1[0], p1[1], 0.04, -1, y));
      };
      for (const [c0, c1] of cuts) { face(u, Math.max(u, c0)); u = Math.max(u, c1); }
      face(u, len);
      // Coping and yellow line along edges that face a track.
      if (p.edges[i] === '1') {
        const ix = -ox, iz = -oz, yy = y + 0.006;
        const strip = (d0, d1, col) => B.paint.face([a[0] + ix * d0, yy, a[1] + iz * d0], [b[0] + ix * d0, yy, b[1] + iz * d0], [b[0] + ix * d1, yy, b[1] + iz * d1], [a[0] + ix * d1, yy, a[1] + iz * d1], col, 0, 1, 0);
        strip(0, 0.32, COL.coping);
        strip(0.55, 0.7, COL.yellow);
        // A dark lip under the coping (the edge seen from the track).
        B.side.face([a[0] + ox * 0.06, y - 0.12, a[1] + oz * 0.06], [b[0] + ox * 0.06, y - 0.12, b[1] + oz * 0.06], [b[0] + ox * 0.06, y, b[1] + oz * 0.06], [a[0] + ox * 0.06, y, a[1] + oz * 0.06], COL.sideDark, ox, 0, oz);
      }
    }
    // Along the platform: roof, boards, indicators, benches, a stall.
    const [cx, cz, ux, uz] = p.axis, vx = -uz, vz = ux, sp = p.spine;
    const at = (s, t, yy) => [cx + ux * s + vx * t, yy, cz + uz * s + vz * t];
    const L = sp[sp.length - 1][0] - sp[0][0];
    if (p.roof && L > 30) {
      const s0 = sp[0][0] + L * 0.12, s1 = sp[sp.length - 1][0] - L * 0.12;
      const hC = y + 4.35, hE = y + 4.7;
      let prev = null, col = 0;
      for (const [s, t0, t1] of sp) {
        if (s < s0 || s > s1 || t1 - t0 < 3) { prev = null; continue; }
        const c = { s, l: t0 + 0.25, r: t1 - 0.25, m: (t0 + t1) / 2 };
        if (prev) {
          // Butterfly roof: low over the column row, rising to the edges.
          for (const [ea, eb] of [['l', 'm'], ['m', 'r']]) {
            const ya = ea === 'm' ? hC : hE, yb = eb === 'm' ? hC : hE;
            B.roof.quad(at(prev.s, prev[ea], ya), at(c.s, c[ea], ya), at(c.s, c[eb], yb), at(prev.s, prev[eb], yb), 0xe6e8ea);
          }
          // Fascia along both edges.
          for (const e of ['l', 'r']) B.paint.quad2(at(prev.s, prev[e], hE - 0.4), at(c.s, c[e], hE - 0.4), at(c.s, c[e], hE + 0.05), at(prev.s, prev[e], hE + 0.05), COL.cream);
          // Tube lights under each side.
          const ms = (prev.s + c.s) / 2;
          for (const e of [-1, 1]) { const tt = (c.m + (e < 0 ? c.l : c.r)) / 2, q = at(ms, tt, hC - 0.15); B.glow.box(q[0], q[2], ux, uz, 1.2, 0.05, hC - 0.25, hC - 0.18, 0xffffff); }
        }
        if (col++ % 3 === 0) {
          const q = at(s, c.m, y);
          B.steel.cyl(q[0], q[2], 0.16, y, hC, COL.steel, 8);
          B.steel.box(q[0], q[2], ux, uz, 0.2, (c.r - c.l) / 2 - 0.2, hC - 0.25, hC, COL.steel); // cross beam
          pieces.push(post(q[0], q[2], 0.2, y, hC));
        }
        prev = c;
      }
    }
    // Station boards every ~60 m, indicators near the middle, benches, one stall.
    const mid = sp[Math.floor(sp.length / 2)];
    for (let k = 0; k < sp.length; k++) {
      const [s, t0, t1] = sp[k], w = t1 - t0, t = (t0 + t1) / 2;
      if (w < 2.6) continue;
      if (k % 15 === 7) this.board(B, pieces, at(s, t, y), ux, uz, y);
      else if (k % 6 === 3 && w > 4) {
        // A steel bench, back to back with the column row.
        const q = at(s, t + 0.9, y);
        B.steel.box(q[0], q[2], ux, uz, 0.9, 0.22, y + 0.42, y + 0.47, COL.bench);
        for (const e of [-0.75, 0.75]) B.steel.box(q[0] + ux * e, q[2] + uz * e, ux, uz, 0.04, 0.18, y, y + 0.42, COL.bench);
        B.steel.box(q[0] + vx * 0.2, q[2] + vz * 0.2, ux, uz, 0.9, 0.03, y + 0.47, y + 0.85, COL.bench);
        pieces.push(wall(q[0] - ux * 0.9, q[2] - uz * 0.9, q[0] + ux * 0.9, q[2] + uz * 0.9, 0.25, y, y + 0.5));
      }
    }
    if (mid && mid[2] - mid[1] > 3.2) {
      const q = at(mid[0], (mid[1] + mid[2]) / 2, y + 3.2);
      // Indicator hanging over the middle of the platform: two faces of the LED board.
      for (const side of [-1, 1]) {
        const ox = vx * side * 0.06, oz = vz * side * 0.06, hx = ux * 1.3, hz = uz * 1.3;
        const quad = [[q[0] - hx + ox, y + 2.75, q[2] - hz + oz], [q[0] + hx + ox, y + 2.75, q[2] + hz + oz], [q[0] + hx + ox, y + 3.4, q[2] + hz + oz], [q[0] - hx + ox, y + 3.4, q[2] - hz + oz]];
        if (side < 0) quad.reverse();
        const before = B.ind.u.length;
        B.ind.quad(quad[0], quad[1], quad[2], quad[3]);
        // uvs: the whole canvas on each face (mirrored correctly per side).
        const uvs = side < 0 ? [1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0] : [0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1];
        for (let k = 0; k < 12; k++) B.ind.u[before + k] = uvs[k];
      }
      B.steel.box(q[0], q[2], ux, uz, 1.35, 0.08, y + 2.7, y + 2.76, 0x1b1b1d);
      B.steel.box(q[0], q[2], ux, uz, 1.35, 0.08, y + 3.39, y + 3.45, 0x1b1b1d);
      for (const e of [-1.1, 1.1]) B.steel.box(q[0] + ux * e, q[2] + uz * e, ux, uz, 0.02, 0.02, y + 3.45, y + 4.4, 0x333333);
      // A stall by the indicator: books, water, vada pav.
      const sq = sp[Math.min(sp.length - 1, Math.floor(sp.length / 2) + 4)];
      if (sq[2] - sq[1] > 5) {
        const c = at(sq[0], (sq[1] + sq[2]) / 2, y);
        B.flat.box(c[0], c[2], ux, uz, 1.5, 0.9, y, y + 2.3, COL.stall);
        B.flat.box(c[0], c[2], ux, uz, 1.7, 1.15, y + 2.3, y + 2.45, 0xc23b22);
        B.flat.box(c[0] + vx * 0.92, c[2] + vz * 0.92, ux, uz, 1.3, 0.03, y + 0.9, y + 2.0, 0xe8e2d0);
        pieces.push(wall(c[0] - ux * 1.5, c[2] - uz * 1.5, c[0] + ux * 1.5, c[2] + uz * 1.5, 0.95, y, y + 2.3));
      }
    }
  }

  /** A yellow station board on two posts, across the platform. */
  board(B, pieces, q, ux, uz, y) {
    const hx = ux * 1.15, hz = uz * 1.15, y0 = y + 2.2, y1 = y + 3.0;
    for (const side of [-1, 1]) {
      const ox = -uz * side * 0.04, oz = ux * side * 0.04;
      const quad = [[q[0] - hx + ox, y0, q[2] - hz + oz], [q[0] + hx + ox, y0, q[2] + hz + oz], [q[0] + hx + ox, y1, q[2] + hz + oz], [q[0] - hx + ox, y1, q[2] - hz + oz]];
      if (side < 0) quad.reverse();
      const before = B.board.u.length;
      B.board.quad(quad[0], quad[1], quad[2], quad[3], 0xffffff);
      const uvs = side < 0 ? [1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0] : [0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1];
      for (let k = 0; k < 12; k++) B.board.u[before + k] = uvs[k];
    }
    for (const e of [-1.05, 1.05]) {
      B.steel.box(q[0] + ux * e, q[2] + uz * e, ux, uz, 0.04, 0.04, y, y1 + 0.05, 0x2a2a2c);
      pieces.push(post(q[0] + ux * e, q[2] + uz * e, 0.08, y, y1));
    }
  }

  /** A foot overbridge: deck, parapets (open where stairs join), roof, piers, and its stairs. */
  deck(d, B, pieces) {
    const pts = d.pts, w = d.w, y = d.y, hw = w / 2;
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1], [bx, bz] = pts[i], len = cum[i] - cum[i - 1];
      if (len < 0.05) continue;
      const ux = (bx - ax) / len, uz = (bz - az) / len, vx = -uz, vz = ux;
      // Deck slab, overlapping the next piece at the joints.
      const e0 = i > 1 ? hw : 0, e1 = i < pts.length - 1 ? hw : 0;
      const sx = ax - ux * e0, sz = az - uz * e0, tx = bx + ux * e1, tz = bz + uz * e1, L = len + e0 + e1;
      B.side.box((sx + tx) / 2, (sz + tz) / 2, ux, uz, L / 2, hw, y - 0.55, y, COL.parapet);
      pieces.push(floor([[sx + vx * hw, sz + vz * hw], [tx + vx * hw, tz + vz * hw], [tx - vx * hw, tz - vz * hw], [sx - vx * hw, sz - vz * hw]], y));
      // Parapets both sides, with gaps where stairs join.
      for (const side of [-1, 1]) {
        let spans = [[cum[i - 1], cum[i]]];
        for (const [ga, gs, gw] of d.gaps) {
          if (gs !== side && gs !== 0) continue;
          const g0 = ga - gw / 2 - 0.2, g1 = ga + gw / 2 + 0.2;
          spans = spans.flatMap(([a0, a1]) => (g1 <= a0 || g0 >= a1 ? [[a0, a1]] : [[a0, Math.max(a0, g0)], [Math.min(a1, g1), a1]]).filter(([q0, q1]) => q1 - q0 > 0.1));
        }
        for (const [a0, a1] of spans) {
          const p0 = [ax + ux * (a0 - cum[i - 1]) + vx * side * (hw - 0.08), az + uz * (a0 - cum[i - 1]) + vz * side * (hw - 0.08)];
          const p1 = [ax + ux * (a1 - cum[i - 1]) + vx * side * (hw - 0.08), az + uz * (a1 - cum[i - 1]) + vz * side * (hw - 0.08)];
          B.steel.box((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, ux, uz, (a1 - a0) / 2, 0.06, y, y + 1.15, COL.rail);
          pieces.push(wall(p0[0], p0[1], p1[0], p1[1], 0.08, y, y + 1.2));
        }
      }
      // Roof on posts, if covered.
      if (d.covered) {
        B.roof.box((ax + bx) / 2, (az + bz) / 2, ux, uz, len / 2 + hw * 0.5, hw + 0.4, y + 3.1, y + 3.2, 0xe0e2e4);
        const n = Math.max(1, Math.round(len / 6));
        for (let k = 0; k <= n; k++) for (const side of [-1, 1]) {
          const q = [ax + ux * (len * k / n) + vx * side * (hw - 0.05), az + uz * (len * k / n) + vz * side * (hw - 0.05)];
          B.steel.box(q[0], q[1], ux, uz, 0.06, 0.06, y, y + 3.1, COL.rail);
        }
      }
    }
    // Ends: a parapet across a deck end with no stair.
    for (const end of [0, 1]) {
      const i = end ? pts.length - 1 : 0, j = end ? pts.length - 2 : 1, a = cum[i];
      if (d.gaps.some(([ga, gs]) => gs === 0 && Math.abs(ga - a) < w + 3)) continue;
      const ux = pts[i][0] - pts[j][0], uz = pts[i][1] - pts[j][1], l = Math.hypot(ux, uz) || 1, vx = -uz / l, vz = ux / l;
      const p0 = [pts[i][0] + vx * hw, pts[i][1] + vz * hw], p1 = [pts[i][0] - vx * hw, pts[i][1] - vz * hw];
      B.steel.box(pts[i][0], pts[i][1], vx, vz, hw, 0.06, y, y + 1.15, COL.rail);
      pieces.push(wall(p0[0], p0[1], p1[0], p1[1], 0.08, y, y + 1.2));
    }
    // Piers.
    for (const [x, z, base] of d.piers) {
      B.side.box(x, z, 1, 0, 0.35, 0.35, base, y - 0.55, COL.parapet);
      pieces.push(post(x, z, 0.5, base - 0.5, y - 0.55));
    }
  }

  /** A straight flight from the deck (x0, z0, y0) down to (x1, z1, y1). */
  stair(s, B, pieces) {
    const L = Math.hypot(s.x1 - s.x0, s.z1 - s.z0), ux = (s.x1 - s.x0) / L, uz = (s.z1 - s.z0) / L, vx = -uz, vz = ux, hw = s.w / 2;
    const rise = s.y0 - s.y1, n = Math.max(2, Math.round(rise / RISE)), run = L / n, h = rise / n;
    const P = (al, t, yy) => [s.x0 + ux * al + vx * t, yy, s.z0 + uz * al + vz * t];
    // Treads and risers, going down.
    for (let k = 0; k < n; k++) {
      const a0 = k * run, a1 = (k + 1) * run, yt = s.y0 - k * h, yb = yt - h;
      B.top.face(P(a0, hw, yt), P(a0, -hw, yt), P(a0, -hw, yb), P(a0, hw, yb), 0xd7d1c6, ux, 0, uz);       // riser
      B.top.face(P(a0, -hw, yb), P(a0, hw, yb), P(a1, hw, yb), P(a1, -hw, yb), 0xe2ddd3, 0, 1, 0);        // tread
    }
    // Underside, sides and parapets.
    B.side.quad2(P(0, -hw, s.y0 - 0.5), P(0, hw, s.y0 - 0.5), P(L, hw, s.y1 - 0.2), P(L, -hw, s.y1 - 0.2), COL.parapet);
    for (const t of [-hw, hw]) {
      B.side.quad2(P(0, t, s.y0 - 0.5), P(L, t, s.y1 - 0.2), P(L, t, s.y1), P(0, t, s.y0), COL.parapet);
      B.steel.quad2(P(0, t, s.y0), P(L, t, s.y1), P(L, t, s.y1 + 1.05), P(0, t, s.y0 + 1.05), COL.rail);
      const a = P(0, t, 0), b = P(L, t, 0);
      pieces.push(wall(a[0], a[2], b[0], b[2], 0.08, s.y1 - 0.5, s.y0 + 1.1));
    }
    // Under the high end, a wall keeps people on the platform from walking up the underside.
    const back = (2.2 / rise) * L;
    if (back < L - 0.5) { const a = P(L - back, -hw, 0), b = P(L - back, hw, 0); pieces.push(wall(a[0], a[2], b[0], b[2], 0.1, s.y1, s.y1 + 1.6)); }
    pieces.push(ramp(s.x0, s.z0, ux, uz, L, hw, s.y0, s.y1));
  }

  // ---------------------------------------------------------------- signs
  boardTexture(st) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 176;
    const g = c.getContext('2d');
    g.fillStyle = '#f5c518'; g.fillRect(0, 0, 512, 176);
    g.strokeStyle = '#1a1a1a'; g.lineWidth = 8; g.strokeRect(6, 6, 500, 164);
    g.fillStyle = '#111'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const [mr, hi] = DEVA[st.name] || [st.mr, st.hi || st.mr];
    const fit = (text, px, yy, fam) => { let s = px; do { g.font = `700 ${s}px ${fam}`; s -= 2; } while (g.measureText(text).width > 470 && s > 12); g.fillText(text, 256, yy); };
    const deva = '"Baloo 2", "Noto Sans Devanagari", "Mukta", sans-serif', latin = '"Oswald", "Arial Narrow", Arial, sans-serif';
    if (mr) { fit(mr, 44, 40, deva); fit(hi || mr, 38, 88, deva); fit((st.name || '').toUpperCase(), 40, 138, latin); }
    else fit((st.name || 'STATION').toUpperCase(), 64, 88, latin);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }

  /** The next trains at a station, in amber LED letters: destination code, slow/fast, cars, minutes. */
  drawIndicator(st) {
    const c = st.indicatorCanvas, T = this.trains?.();
    if (!c) return;
    const g = c.getContext('2d');
    g.fillStyle = '#050505'; g.fillRect(0, 0, 512, 128);
    g.font = '700 40px "Courier New", monospace'; g.textBaseline = 'middle';
    const rows = T?.nextTrains ? T.nextTrains(st.name).slice(0, 2) : [];
    if (!rows.length) { g.fillStyle = '#ff9a1a'; g.fillText(T ? '  NO TRAINS' : ' ', 14, 64); }
    rows.forEach(([sec, L], k) => {
      const to = CODE[L.to] || (L.to || '').slice(0, 3).toUpperCase(), mins = Math.max(0, Math.floor(sec / 60));
      g.fillStyle = k ? '#ff7a10' : '#ffb21a';
      g.fillText(`${to.padEnd(5)}${L.fast ? 'F' : 'S'}  12  ${sec < 20 ? 'NOW' : `${mins}m`}`, 18, 34 + k * 60);
    });
    st.indicatorTex.needsUpdate = true;
  }
}
