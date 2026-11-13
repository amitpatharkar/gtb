import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HOME } from '../game/state.js';
import { Kit, Geo, canvasTexture, font } from './interiors/kit.js';
import { buildTerminus } from './interiors/terminus.js';
import { buildPalace } from './interiors/palace.js';
import { buildCafe } from './interiors/cafe.js';
import { buildFlat } from './interiors/flat.js';

// Places you can walk into. On foot, walk up to a glowing door, press E, and after a short
// fade you are inside a hand-built room; the door inside brings you back to the same spot.
//
// How it fits the open world without touching it:
//  - Rooms are closed boxes parked far outside the map (4 km west of it, 300 m up), built
//    the first time they are entered. Being that far away, nothing of the city can be seen
//    or heard from inside, and no city system finds the player near anything.
//  - While inside, the city keeps running around `anchor` (a stand-in for the player that
//    stays at the street door): traffic, street life, police and tile streaming carry on
//    there, so the taxi, the challans and the clock are exactly as they should be on the
//    way out, and the tiles around the door are still loaded.
//  - The walker gets `world` (walls, furniture and floor heights of the room) in place of the
//    street collisions, and the camera is kept inside with `hits(x, z, r, true)` and `ceiling()`.
//  - Only the room is drawn: its meshes and lights (and the shared people renderers) are also
//    on camera layer 1, and the camera looks at that layer alone while indoors, so the
//    street's instanced props, traffic and crowds cost nothing although they keep moving.
//  - Daylight is switched off indoors: the sun becomes a soft ceiling light that still casts
//    shadows under furniture and people, the sky is replaced by a warm room reflection, and
//    each room brings a few lamps of its own. Everything is put back on the way out.
// Nothing is saved: a loaded game always starts on the street.

const ll = (index, lat, lon) => [(lon - index.origin.lon) * index.metresPerDegree.lon, -(lat - index.origin.lat) * index.metresPerDegree.lat];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const INDOORS = 1; // camera layer of everything that is drawn while indoors

const SITES = [
  {
    id: 'terminus', name: 'Chhatrapati Chai Terminus', deva: 'छत्रपती चाय टर्मिनस', sub: 'Booking office · तिकीट घर', icon: '🚆', color: '#8a5a2b',
    landmark: 'terminus', style: 'gothic', build: buildTerminus,
    // The long front first, then the other sides.
    sides: (L) => [[0, 1, L.d / 2, L.w / 2], [-1, 0, L.w / 2, L.d / 2], [1, 0, L.w / 2, L.d / 2], [0, -1, L.d / 2, L.w / 2]],
  },
  {
    id: 'palace', name: 'Royal Chaj Mahal Palace', deva: 'रॉयल छज महल पॅलेस', sub: 'Lobby · Sea Lounge', icon: '🏨', color: '#9c7a2e',
    landmark: 'palace', style: 'palace', build: buildPalace,
    // The harbour front (the side facing the Gateway; its domed pavilion stands 4 m proud of the wall), then the rest.
    sides: (L, byId) => {
      const gw = byId.get('gateway');
      let f = 1;
      if (gw) { const dx = gw.x - L.x, dz = gw.z - L.z; f = (-dx * Math.sin(L.angle) + dz * Math.cos(L.angle)) >= 0 ? 1 : -1; }
      return [[0, f, L.d / 2, L.w / 2, (a) => (Math.abs(a) < 15.5 ? 4 : 0)], [0, -f, L.d / 2, L.w / 2], [-1, 0, L.w / 2, L.d / 2], [1, 0, L.w / 2, L.d / 2]];
    },
  },
  { id: 'cafe', name: 'Khyaali & Co.', deva: 'ख्याली अँड कं.', sub: 'Irani café · Estd. 1923', icon: '☕', color: '#7a2e2e', at: [18.9441, 72.8288], search: 70, style: 'cafe', build: buildCafe },
  { id: 'flat', name: 'Lake Breeze Tower B', deva: 'लेक ब्रीझ टॉवर बी', sub: 'Flat 1204 · home', icon: '🏠', color: '#2e6a7a', at: HOME.at, search: 220, style: 'tower', build: buildFlat, enter: 'E: go up to your flat (1204, Lake Breeze Tower B)' },
];

export class Interiors {
  /**
   * @param ctx scene, camera, renderer, tiles, index, lib, tier, env, clock, state, people, characters,
   *   bubbles, audio, hud, phone, view, walker, player (the car), story; `snapCamera()` puts the
   *   camera straight behind the player; `onFoot()` says whether the player is walking.
   */
  constructor(ctx) {
    Object.assign(this, ctx);
    const b = ctx.index.bounds;
    const byId = new Map((ctx.index.landmarks || []).map((l) => [l.id, l]));
    this.sites = SITES.map((s, i) => {
      const L = s.landmark ? byId.get(s.landmark) : null;
      const [x, z] = L ? [L.x, L.z] : ll(ctx.index, s.at[0], s.at[1]);
      return {
        ...s, L, byId, x, z, placed: false, tryT: 0, tries: 0, room: null, door: null, stand: null,
        origin: new THREE.Vector3(b.minX - 4000, 300, b.minZ + 600 * i), // where its room is parked
      };
    }).filter((s) => !s.landmark || s.L);
    // The indoor camera layer: the sun (it becomes the ceiling light) and the crowd are on it too.
    ctx.env.sun.layers.enable(INDOORS);
    ctx.people.mesh.layers.enable(INDOORS);
    this.inside = null;                 // the site the player is in, or null
    this.busy = false;                  // fading in or out
    this.prompt = '';                   // HUD line: what E would do right now
    this.time = 0;
    // Where the city thinks the player is while indoors: standing at the street door.
    this.anchor = { pos: new THREE.Vector3(), heading: 0, speed: 0 };
    this.back = null;
    /** Collisions and floor heights for the walker indoors. */
    this.world = { hits: (x, z, r) => this.busy || this.hits(x, z, r), groundHeight: (x, z) => this.groundHeight(x, z) };
    this.doorMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
    this.glowMat = new THREE.MeshBasicMaterial({ color: 0xffd28a, transparent: true, opacity: 0.8, depthWrite: false, fog: false, side: THREE.DoubleSide });
    // What a room may use: money, clock, speech bubbles, the phone…
    this.api = {
      state: ctx.state, clock: ctx.clock, phone: ctx.phone, view: ctx.view, story: ctx.story, tier: ctx.tier, lib: ctx.lib,
      me: { x: 0, z: 0 },               // the player in room coordinates
      say: (who, text, ttl = 3, kind = '') => ctx.bubbles.say(who, text, ttl, kind),
      msg: (text) => ctx.hud.message(text),
      /** Pay for something if the wallet allows; false (with a HUD line) if not. */
      buy: (price, what) => {
        if (!ctx.state.canAfford(price)) { ctx.hud.message(`₹${price} for ${what.toLowerCase()} — you're short. Drive some fares (J).`); return false; }
        ctx.state.pay(price, what);
        this.tone([1320, 1760], 0.07);
        return true;
      },
      tone: (notes, len, vol) => this.tone(notes, len, vol),
      /** Fade to black, do something (sleep…), fade back. */
      blackout: (fn) => this.blackout(fn),
      leave: () => this.exit(),
    };
  }

  // ------------------------------------------------------------------ outside: doors

  /** Doors on the city map. */
  markers() { return this.sites.map((s) => ({ x: s.door?.x ?? s.x, z: s.door?.z ?? s.z, color: s.color, icon: s.icon, r: 9 })); }

  /** True once every map tile within r of (x, z) is in (so walls and roads can be probed). */
  loaded(x, z, r) {
    const t = this.tiles, s = t.size;
    for (let tx = Math.floor((x - r) / s); tx <= Math.floor((x + r) / s); tx++)
      for (let tz = Math.floor((z - r) / s); tz <= Math.floor((z + r) / s); tz++) {
        const key = `${tx},${tz}`;
        if (t.available.has(key) && !t.tiles.has(key) && !t.failed.has(key)) return false;
      }
    return true;
  }

  /**
   * A doorway on a hand-built landmark: walk the sides of its footprint (front first, from
   * the middle outwards) for a spot against the wall with room to stand, off the
   * carriageway, that can be reached from a road.
   */
  placeOnLandmark(site) {
    const L = site.L, t = this.tiles, c = Math.cos(L.angle), s = Math.sin(L.angle);
    const W = (lx, lz) => [L.x + lx * c - lz * s, L.z + lx * s + lz * c];
    /** How far inside a carriageway a point is, in metres (negative: not on one). */
    const inRoad = (x, z) => { const r = t.roadAt(x, z, 0, true); return r ? t.segment(r.tile, r.index)[4] - r.dist : -1; };
    for (const [nx, nz, half, len, proud = () => 0] of site.sides(L, site.byId)) {
      for (const f of [0, 0.12, -0.12, 0.24, -0.24, 0.36, -0.36]) {
        const along = f * len * 2, wall = half + proud(along);
        const at = (d) => W(nx * (wall + d) - nz * along, nz * (wall + d) + nx * along);
        // Strict: a footpath to stand on. Then: any kerb. Last: the very edge of the road (where taxis pull up).
        for (const [d0, depth, clear] of [[0.8, -1, true], [0.5, 0, false], [0.5, 1.2, false]]) {
          let d = d0;
          while (d < 3.5 && t.hits(...at(d), 0.42)) d += 0.15;
          if (d >= 3.5) break;
          const [sx, sz] = at(d);
          if (inRoad(sx, sz) > depth || (clear && (t.roadAt(sx, sz, 0.5, true) || t.hits(...at(d + 1.2), 0.42)))) continue;
          // Reachable: straight out from the door there is a road, with nothing in between.
          let ok = false;
          for (let q = d; q < d + 45; q += 1) { const [qx, qz] = at(q); if (t.hits(qx, qz, 0.3)) break; if (t.roadAt(qx, qz, 0)) { ok = true; break; } }
          if (!ok) continue;
          const [dx, dz] = at(0.06);
          return this.setDoor(site, dx, dz, Math.atan2(nx * c - nz * s, nx * s + nz * c), sx, sz);
        }
      }
    }
    return false;
  }

  /**
   * A doorway for a shop or a flat: the spot nearest the wanted point that is free, off
   * the carriageway, against a straight stretch of building wall and facing a road.
   */
  placeOnStreet(site) {
    const t = this.tiles;
    for (let r = 0; r <= site.search; r += 2) {
      const n = Math.max(1, Math.round(Math.PI * r)), a0 = r * 0.37;
      let best = null;
      for (let i = 0; i < n; i++) {
        const a = a0 + (i / n) * Math.PI * 2, x = site.x + Math.cos(a) * r, z = site.z + Math.sin(a) * r;
        if (t.hits(x, z, 0.5) || t.roadAt(x, z, 0.3, true) || !t.roadAt(x, z, 10)) continue;
        for (let k = 0; k < 16 && !best; k++) {
          const nx = Math.cos((k * Math.PI) / 8), nz = Math.sin((k * Math.PI) / 8);
          if (!t.hits(x + nx * 1.4, z + nz * 1.4, 0.3) || !t.walkable(x + nx * 2.2, z + nz * 2.2)) continue;
          best = this.wallDoor(x, z, nx, nz);
        }
        if (best) break;
      }
      if (best) return this.setDoor(site, ...best);
    }
    return false;
  }

  /** From a spot near a wall (roughly along n): the exact wall line, if it is straight and faces a road. */
  wallDoor(x, z, nx, nz) {
    const t = this.tiles, tx = -nz, tz = nx;
    const reach = (off) => { for (let d = 0; d < 2.6; d += 0.05) if (t.hits(x + tx * off + nx * d, z + tz * off + nz * d, 0.04)) return d; return -1; };
    const dl = reach(-1.3), dm = reach(0), dr = reach(1.3);
    if (dl < 0 || dm < 0 || dr < 0 || Math.abs((dl + dr) / 2 - dm) > 0.12) return null;   // a corner or a kink
    // The wall's own direction, from where the two outer probes met it.
    const wx = tx * 2.6 + nx * (dr - dl), wz = tz * 2.6 + nz * (dr - dl), wl = Math.hypot(wx, wz);
    let ox = wz / wl, oz = -wx / wl;                       // normal of the wall…
    if (ox * nx + oz * nz > 0) { ox = -ox; oz = -oz; }     // …pointing out into the street
    const px = x + nx * dm, pz = z + nz * dm;              // on the wall
    const sx = px + ox * 0.9, sz = pz + oz * 0.9;
    if (t.hits(sx, sz, 0.42) || t.roadAt(sx, sz, 0.3, true)) return null;
    for (let q = 1; q < 16; q += 0.75) {
      const qx = px + ox * q, qz = pz + oz * q;
      if (t.hits(qx, qz, 0.3)) return null;
      if (t.roadAt(qx, qz, 0)) return [px + ox * 0.06, pz + oz * 0.06, Math.atan2(ox, oz), sx, sz];
    }
    return null;
  }

  /** Put the door at (x, z) on a wall, facing `heading`; (sx, sz) is where one stands in front of it. */
  setDoor(site, x, z, heading, sx, sz) {
    site.door = { x, z, heading, y: this.tiles.groundHeight(sx, sz) };
    site.stand = { x: sx, z: sz };
    site.model = doorModel(site, this.doorMat, this.glowMat);
    site.model.position.set(x, site.door.y, z);
    site.model.rotation.y = heading;
    this.scene.add(site.model);
    site.placed = true;
    return true;
  }

  /** Each frame outdoors: find places for doors as the map loads, show the near ones, offer E. */
  streetUpdate(dt, onFoot) {
    const w = this.walker, me = onFoot ? w.pos : this.player.pos;
    const night = this.clock.night;
    this.glowMat.color.setRGB(1, 0.8, 0.5).multiplyScalar((0.75 + 0.2 * Math.sin(this.time * 2.4)) * (1 + night * 1.6));
    for (const s of this.sites) {
      const far = Math.hypot(me.x - s.x, me.z - s.z);
      if (!s.placed) {
        s.tryT -= dt;
        if (far > 260 || s.tryT > 0 || s.tries > 8 || !this.loaded(s.x, s.z, (s.search || 90) + 30)) continue;
        s.tryT = 3; s.tries++;
        if (!(s.L ? this.placeOnLandmark(s) : this.placeOnStreet(s))) continue;
      }
      const d = Math.hypot(me.x - s.door.x, me.z - s.door.z);
      s.model.visible = d < 90;
      if (!s.model.visible) continue;
      // The name floats over the door within about 40 m.
      s.label.material.opacity = THREE.MathUtils.clamp((42 - d) / 6, 0, 1);
      s.label.visible = s.label.material.opacity > 0.01;
      if (onFoot && !this.busy && Math.hypot(w.pos.x - s.stand.x, w.pos.z - s.stand.z) < 3) { this.prompt = s.enter || `E: enter ${s.name}`; this.near = s; }
    }
  }

  // ------------------------------------------------------------------ inside: collisions

  /**
   * True if a circle (x, z, r) is blocked indoors: outside the rooms, or in furniture.
   * `camera` = only what also stops the camera (walls and tall things).
   */
  hits(x, z, r = 0.3, camera = false) {
    const R = this.inside?.room;
    if (!R) return false;
    const lx = x - R.o.x, lz = z - R.o.z;
    let ok = false;
    for (const q of R.rooms) if (lx - r >= q[0] && lx + r <= q[2] && lz - r >= q[1] && lz + r <= q[3]) { ok = true; break; }
    if (!ok) return true;
    for (const s of R.solids) if ((!camera || s[4]) && lx + r > s[0] && lx - r < s[2] && lz + r > s[1] && lz - r < s[3]) return true;
    for (const p of R.posts) if ((!camera || p[3]) && (lx - p[0]) ** 2 + (lz - p[1]) ** 2 < (r + p[2]) ** 2) return true;
    return false;
  }

  /** Floor height indoors (stairs are ramps). */
  groundHeight(x, z) {
    const R = this.inside?.room;
    if (!R) return this.tiles.groundHeight(x, z);
    const lx = x - R.o.x, lz = z - R.o.z;
    for (const [x0, z0, x1, z1, ya, yb, axis] of R.ramps) {
      if (lx < x0 || lx > x1 || lz < z0 || lz > z1) continue;
      const k = axis === 'x' ? (lx - x0) / (x1 - x0) : (lz - z0) / (z1 - z0);
      return R.o.y + ya + (yb - ya) * k;
    }
    return R.o.y;
  }

  /** Ceiling height over (x, z), for the camera. */
  ceiling(x, z) {
    const R = this.inside?.room;
    if (!R) return Infinity;
    const lx = x - R.o.x, lz = z - R.o.z;
    let h = 0;
    for (const q of R.rooms) if (lx >= q[0] && lx <= q[2] && lz >= q[1] && lz <= q[3]) h = Math.max(h, q[4]);
    return R.o.y + (h || R.height);
  }

  /**
   * Keep the camera in the room: `target` (where the camera wants to be) is pulled back
   * along the line from the player until it is clear of the walls and tall furniture, and
   * kept under the ceiling.
   */
  keepCamera(from, target) {
    const dx = target.x - from.x, dz = target.z - from.z;
    let t = 1;
    while (t > 0 && this.hits(from.x + dx * t, from.z + dz * t, 0.24, true)) t -= 0.08;
    t = Math.max(0, t);
    target.x = from.x + dx * t; target.z = from.z + dz * t;
    target.y = Math.min(target.y, this.ceiling(target.x, target.z) - 0.3);
  }

  /** Indoors only the room's people are drawn: drop everyone else from this frame's list (in place). */
  cull(list) {
    const R = this.inside?.room;
    if (!R) return;
    let n = 0;
    for (const p of list) if (Math.abs(p.x - R.centre.x) < R.radius + 4 && Math.abs(p.z - R.centre.z) < R.radius + 4) list[n++] = p;
    list.length = n;
  }

  /** Keys that do nothing indoors: vehicles, taxi duty, crackers, kicks and insults. */
  blocks(code) { return !!this.inside && ['KeyF', 'KeyJ', 'KeyX', 'KeyZ', 'KeyV', 'KeyG', 'KeyH'].includes(code); }

  // ------------------------------------------------------------------ going in and out

  /** Build a site's room (first visit): geometry, lamps, people. */
  construct(site) {
    const k = new Kit(this.lib, this.tier);
    const info = site.build(k, this.api) || {};
    const o = site.origin;
    const group = new THREE.Group();
    group.name = `interior ${site.id}`;
    group.position.copy(o);
    const stats = k.finish(group);
    // The room's own lights live beside the meshes, so hiding them takes them out of every shader.
    const rig = new THREE.Group();
    rig.position.copy(o);
    const [sky, ground, amb] = info.ambient || [0xfff2e0, 0x8a7a66, 2];
    rig.add(new THREE.HemisphereLight(sky, ground, amb));
    const maxLamps = this.tier.name === 'Low' ? 2 : this.tier.name === 'Medium' ? 4 : 6;
    for (const [x, y, z, c, i, d] of k.lamps.slice(0, maxLamps)) { const l = new THREE.PointLight(c, i, d, 1.5); l.position.set(x, y, z); rig.add(l); }
    group.traverse((obj) => obj.layers.enable(INDOORS)); rig.traverse((obj) => obj.layers.enable(INDOORS));
    group.visible = rig.visible = false;
    group.updateMatrixWorld(true);
    this.scene.add(group, rig);
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity, height = 0;
    for (const q of k.rooms) { x0 = Math.min(x0, q[0]); z0 = Math.min(z0, q[1]); x1 = Math.max(x1, q[2]); z1 = Math.max(z1, q[3]); height = Math.max(height, q[4]); }
    for (const p of k.people) { p.lx = p.x; p.ly = p.y || 0; p.lz = p.z; }
    return {
      o, group, rig, stats, info, height,
      rooms: k.rooms, solids: k.solids, posts: k.posts, ramps: k.ramps, spots: k.spots, people: k.people, daylit: k.daylit, ticks: k.ticks,
      centre: new THREE.Vector3(o.x + (x0 + x1) / 2, o.y, o.z + (z0 + z1) / 2), radius: Math.hypot(x1 - x0, z1 - z0) / 2 + 2,
      spawn: info.spawn || { x: 0, z: 1.2, heading: 0 },
    };
  }

  fade(on) { document.getElementById('fade')?.classList.toggle('on', on); return wait(on ? 270 : 60); }

  /** Let a couple of frames draw behind the black screen (shaders for the new lights compile there). */
  settle() { return Promise.race([new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))), wait(160)]); }

  /** Walk into a site ('terminus', 'palace', 'cafe', 'flat'). Resolves true once inside. */
  async enter(id) {
    const site = this.sites.find((s) => s.id === id);
    if (!site || this.busy || this.inside) return false;
    if (!this.onFoot()) { this.hud.message('Get out of the vehicle first (F)'); return false; }
    this.busy = true;
    try {
      await this.fade(true);
      const room = (site.room ||= this.construct(site));
      const w = this.walker;
      // Come back out at the door (or, when sent in from afar by a cheat, right where you stood).
      const atDoor = site.placed && Math.hypot(w.pos.x - site.door.x, w.pos.z - site.door.z) < 15;
      this.back = atDoor ? { x: site.stand.x, z: site.stand.z, heading: site.door.heading } : { x: w.pos.x, z: w.pos.z, heading: w.heading };
      this.anchor.pos.set(this.back.x, this.tiles.groundHeight(this.back.x, this.back.z), this.back.z);
      this.anchor.heading = this.back.heading;
      this.inside = site;
      room.group.visible = room.rig.visible = true;
      this.lights(true);
      const s = room.spawn;
      w.pos.set(room.o.x + s.x, 0, room.o.z + s.z);
      w.pos.y = this.groundHeight(w.pos.x, w.pos.z);
      w.heading = s.heading || 0; w.speed = 0; w.vx = w.vz = 0; w.spraying = false;
      this.view.yaw = w.heading; this.view.pitch = 0.1;
      this.snapCamera();
      this.entered = this.time;
      room.info.enter?.(this.api);
      await this.settle();
    } finally {
      this.busy = false;
      this.fade(false);
    }
    return true;
  }

  /** Back to the street. */
  async exit() {
    if (!this.inside || this.busy) return false;
    this.busy = true;
    try {
      await this.fade(true);
      this.leave(true);
      await this.settle();
    } finally {
      this.busy = false;
      this.fade(false);
    }
    return true;
  }

  /** Put the city back. `walk` = also put the player back at the door. */
  leave(walk) {
    const site = this.inside;
    if (!site) return;
    site.room.group.visible = site.room.rig.visible = false;
    this.lights(false);
    this.inside = null;
    this.prompt = '';
    if (!walk) return;
    const w = this.walker, b = this.back;
    w.pos.set(b.x, this.tiles.groundHeight(b.x, b.z), b.z);
    w.heading = b.heading; w.speed = 0; w.vx = w.vz = 0;
    // Look along the pavement rather than straight out: the camera would otherwise sit inside the wall behind.
    this.view.yaw = b.heading + Math.PI / 2; this.view.pitch = 0.12;
    this.snapCamera();
  }

  async blackout(fn) {
    if (this.busy) return;
    this.busy = true;
    try { await this.fade(true); await wait(350); fn(); } finally { this.busy = false; this.fade(false); }
  }

  /** Indoor lighting on or off (see the notes at the top). */
  lights(on) {
    const { scene, env, renderer } = this, sun = env.sun, cam = sun.shadow.camera;
    if (!on) {
      const s = this.saved;
      if (!s) return;
      this.camera.layers.mask = s.layers;
      scene.environment = s.environment;
      Object.assign(cam, s.shadow);
      cam.updateProjectionMatrix();
      this.saved = null;
      return; // the sky, the sun, the haze and the exposure are set again by the next env.update()
    }
    const room = this.inside.room, info = room.info;
    this.saved = { environment: scene.environment, layers: this.camera.layers.mask, shadow: { left: cam.left, right: cam.right, top: cam.top, bottom: cam.bottom, near: cam.near, far: cam.far } };
    this.camera.layers.set(INDOORS);
    scene.environment = this.roomEnv();
    scene.environmentIntensity = info.env ?? 0.5;
    scene.environmentRotation.set(0, 0, 0);
    scene.backgroundIntensity = 0;
    scene.fog.density = 0;
    env.hemi.intensity = 0; env.moon.intensity = 0;
    // The sun stands in for the room's ceiling light: nearly straight down, soft, shadows on.
    const [cx, cy, cz, power = 1.6, colour = 0xfff0dc] = info.key || [0.25, 1, 0.18];
    sun.color.set(colour);
    sun.intensity = power;
    sun.target.position.copy(room.centre);
    sun.position.copy(room.centre).add(new THREE.Vector3(cx, cy, cz).normalize().multiplyScalar(120));
    const r = room.radius;
    Object.assign(cam, { left: -r, right: r, top: r, bottom: -r, near: 20, far: 200 });
    cam.updateProjectionMatrix();
    renderer.toneMappingExposure = (info.exposure ?? 0.95) * (renderer.exposureScale || 1);
  }

  /** A warm, dim room to reflect in polished floors, brass and glass instead of the sky. */
  roomEnv() {
    if (this.envMap) return this.envMap;
    const s = new THREE.Scene();
    const face = (hex, k) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), side: THREE.BackSide });
    // +x, -x, +y (ceiling), -y (floor), +z, -z
    s.add(new THREE.Mesh(new THREE.BoxGeometry(12, 7, 12), [face(0xe8d9c0, 0.55), face(0xe8d9c0, 0.5), face(0xfff3dd, 0.95), face(0x6b5038, 0.35), face(0xe8d9c0, 0.6), face(0xe8d9c0, 0.45)]));
    for (const [x, z] of [[-3, -3], [3, -3], [-3, 3], [3, 3], [0, 0]]) {
      const lampShade = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd9a0).multiplyScalar(3.5) }));
      lampShade.position.set(x, 2.6, z);
      s.add(lampShade);
    }
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envMap = pmrem.fromScene(s, 0.03, 0.1, 50).texture;
    pmrem.dispose();
    return this.envMap;
  }

  /** A few soft notes (purchase ding, station chime). */
  tone(notes, len = 0.12, vol = 0.12) {
    const A = this.audio, ctx = A?.ctx;
    if (!ctx || A.muted) return;
    notes.forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + i * len * 1.15;
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + len * 2.2);
      o.connect(g).connect(A.master); o.start(t); o.stop(t + len * 2.3);
    });
  }

  /** Indoors the street is a murmur behind the walls (each room sets its own mix). */
  ambience(audio) {
    const [traffic = 0.03, street = 0.03, crows = 0] = this.inside?.room.info.sound || [];
    audio.set('traffic', traffic); audio.set('street', street); audio.set('waves', 0); audio.set('crows', crows * this.clock.daylight);
  }

  // ------------------------------------------------------------------ frame

  /** E: go in, go out, or use the nearest thing in the room. True if E was taken. */
  interact() {
    if (this.busy) return true;
    if (this.inside) { this.spot?.act(this.api); return true; }
    if (this.near && this.prompt) { this.enter(this.near.id); return true; }
    return false;
  }

  /** Once per simulation step, between people.begin() and people.end(). */
  update(dt, onFoot) {
    this.time += dt;
    this.prompt = ''; this.near = null; this.spot = null;
    const site = this.inside;
    if (!site) { this.streetUpdate(dt, onFoot); return; }
    const room = site.room, w = this.walker, o = room.o, api = this.api;
    // Left some other way (tow truck, hospital, a teleport cheat)? Then just put the city back.
    if (!onFoot || Math.abs(w.pos.x - room.centre.x) > room.radius + 30 || Math.abs(w.pos.z - room.centre.z) > room.radius + 30) { this.leave(false); return; }
    api.me.x = w.pos.x - o.x; api.me.z = w.pos.z - o.z; api.dt = dt; api.time = this.time; api.sinceEnter = this.time - this.entered;
    for (const f of room.ticks) f(dt, api);
    // People live in room coordinates; the crowd renderer and the speech bubbles want world ones.
    for (const p of room.people) {
      p.x = o.x + p.lx; p.y = o.y + p.ly; p.z = o.z + p.lz;
      if (!p.hidden) this.people.add(p);
    }
    // Rigged characters (and the caps they are given later) join the indoor layer as they appear.
    for (const c of this.characters?.pool || []) if (c.holder.visible) c.holder.traverse((obj) => obj.layers.enable(INDOORS));
    // Windows follow the daylight outside.
    const day = this.clock.daylight;
    for (const d of room.daylit) d.set(day);
    // The nearest thing to use.
    if (!this.busy) {
      let best = Infinity;
      for (const s of room.spots) {
        const d = Math.hypot(api.me.x - s.x, api.me.z - s.z);
        if (d < s.r && d < best) { best = d; this.spot = s; }
      }
      if (this.spot) this.prompt = typeof this.spot.prompt === 'function' ? this.spot.prompt(api) : this.spot.prompt;
    }
  }
}

// ---------------------------------------------------------------------- street doors

/** Floating name over a door. */
function labelSprite(site) {
  const tex = canvasTexture(512, 160, (g) => {
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(20,14,8,0.72)';
    g.beginPath(); g.roundRect(6, 6, 500, 148, 26); g.fill();
    g.strokeStyle = '#f2c66a'; g.lineWidth = 4; g.stroke();
    g.fillStyle = '#ffe9b8'; g.font = font(40, 800);
    g.fillText(site.name, 256, 50, 470);
    g.fillStyle = '#f4d9a0'; g.font = font(30, 600);
    g.fillText(site.deva, 256, 96, 470);
    g.fillStyle = '#d8c7a4'; g.font = font(22, 500);
    g.fillText(site.sub, 256, 132, 470);
  });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
  sp.scale.set(3.6, 1.125, 1);
  return sp;
}

/**
 * The doorway on the street. Local frame: the wall is the plane z = 0, +z points out into
 * the street. Four draw calls: frame, signboard, the warm glow in the opening, the label.
 */
function doorModel(site, frameMat, glowMat) {
  const group = new THREE.Group();
  const g = new Geo();
  const style = site.style;
  let w = 1.7, h = 2.5, top = 3.2;          // opening width and height, top of the frame
  if (style === 'gothic') {
    // A stone porch with a pointed arch and two steps.
    w = 2.4; h = 3.9; top = 5.2;
    g.arches(-2.3, 0.28, 2.3, 0.28, 0, top, 0.56, [[2.3, w, 2.3, h]], 0xc9ad7e);
    g.box(-2.05, 0, 0.36, 0.5, top + 0.5, 0.72, 0xb89a6c); g.box(2.05, 0, 0.36, 0.5, top + 0.5, 0.72, 0xb89a6c);
    g.add(new THREE.ConeGeometry(0.42, 1.1, 4).rotateY(Math.PI / 4).translate(-2.05, top + 1.05, 0.36), 0x6d7a70);
    g.add(new THREE.ConeGeometry(0.42, 1.1, 4).rotateY(Math.PI / 4).translate(2.05, top + 1.05, 0.36), 0x6d7a70);
    g.box(0, top, 0.3, 4.9, 0.3, 0.8, 0x8f8a80);
    g.box(0, 0, 0.9, 3.4, 0.09, 0.9, 0x9a958c);
  } else if (style === 'palace') {
    // Brass and glass under a cream canopy, with a red runner and two planters.
    w = 2.2; h = 2.7; top = 3.3;
    g.box(-1.25, 0, 0.1, 0.22, top, 0.24, 0xb8913a); g.box(1.25, 0, 0.1, 0.22, top, 0.24, 0xb8913a);
    g.box(0, h, 0.1, 2.72, top - h, 0.24, 0xb8913a);
    g.box(0, top, 0.36, 3.6, 0.16, 0.74, 0xf1e6cc); g.box(0, top - 0.2, 0.7, 3.6, 0.22, 0.06, 0x8c1c1c);
    g.box(0, 0.005, 0.36, 1.6, 0.02, 0.7, 0x9c1f24);
    for (const x of [-1.62, 1.62]) { g.cyl(x, 0, 0.26, 0.2, 0.5, 0xc9b28a, 10, 0.26); g.ball(x, 0.86, 0.26, 0.34, 0x2f6b34, 1.1); }
  } else if (style === 'cafe') {
    // An old wooden shopfront: panelled frame, striped awning.
    w = 1.8; h = 2.45; top = 3.5;
    g.box(-1.05, 0, 0.08, 0.3, top, 0.2, 0x4a2c1a); g.box(1.05, 0, 0.08, 0.3, top, 0.2, 0x4a2c1a);
    g.box(0, h, 0.08, 2.4, 0.16, 0.2, 0x4a2c1a);
    for (let i = 0; i < 8; i++) g.add(new THREE.BoxGeometry(0.36, 0.04, 0.95).rotateX(0.38).translate(-1.26 + i * 0.36, h + 0.36, 0.52), i % 2 ? 0xf2ead8 : 0x9c2a2a);
    g.box(0, 0, 0.3, 2.2, 0.07, 0.5, 0x8a857c);
  } else {
    // A plain modern lobby door: steel frame, glass, a concrete canopy and a name plinth.
    w = 1.9; h = 2.5; top = 3.1;
    g.box(-1.05, 0, 0.07, 0.14, top, 0.16, 0x4b5257); g.box(1.05, 0, 0.07, 0.14, top, 0.16, 0x4b5257);
    g.box(0, h, 0.07, 2.24, top - h, 0.16, 0x4b5257);
    g.box(0, top, 0.45, 3.2, 0.14, 0.9, 0xd8d4cc);
    g.box(0, 0, 0.35, 2.4, 0.06, 0.6, 0xa9a59c);
    g.box(1.7, 0, 0.16, 0.5, 1.25, 0.2, 0x2f3a40);
  }
  const frame = new THREE.Mesh(g.merge(), frameMat);
  frame.castShadow = true; frame.receiveShadow = true;
  group.add(frame);
  // The opening: warm light spilling out (a filled door shape, brighter at night) and a pool of it on the ground.
  const glow = new THREE.Mesh(mergeGeometries([
    style === 'gothic' ? gothicFill(w, 2.3, h) : new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0),
    new THREE.CircleGeometry(w * 0.75, 20, 0, Math.PI).rotateX(Math.PI / 2).translate(0, 0.03, 0.1),
  ].map((x) => (x.index ? x.toNonIndexed() : x))), glowMat);
  glow.position.z = 0.05;
  group.add(glow);
  // Signboard over the door.
  const sw = style === 'gothic' ? 3.2 : style === 'palace' ? 3.2 : 2.6, sh = 0.62;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshStandardMaterial({ map: signTexture(site), roughness: 0.6 }));
  sign.position.set(0, style === 'gothic' ? top + 0.72 : style === 'cafe' ? top + 0.34 : top + 0.5, style === 'gothic' ? 0.72 : style === 'cafe' ? 0.2 : 0.83);
  group.add(sign);
  site.label = labelSprite(site);
  site.label.position.set(0, sign.position.y + 1.2, 1.6); // clear of cornices and awnings
  group.add(site.label);
  return group;
}

/** A pointed-arch shape filling the terminus doorway. */
function gothicFill(w, spring, peak) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(-w / 2, spring);
  for (let i = 1; i < 12; i++) { const th = (i / 12) * (Math.PI / 3); s.lineTo(-(2 * Math.cos(th) - 1) * w / 2, spring + (peak - spring) * Math.sin(th) / Math.sin(Math.PI / 3)); }
  s.lineTo(0, peak);
  for (let i = 11; i >= 1; i--) { const th = (i / 12) * (Math.PI / 3); s.lineTo((2 * Math.cos(th) - 1) * w / 2, spring + (peak - spring) * Math.sin(th) / Math.sin(Math.PI / 3)); }
  s.lineTo(w / 2, spring); s.lineTo(w / 2, 0);
  return new THREE.ShapeGeometry(s);
}

/** Painted board over a street door: English over Devanagari, in the site's colours. */
function signTexture(site) {
  const look = {
    gothic: ['#1d3a5c', '#f4e7c3', '#d9b24a'], palace: ['#f4ecd8', '#5a3c0e', '#b8913a'],
    cafe: ['#7a1f1f', '#fbe9c4', '#e0b354'], tower: ['#263238', '#eceff1', '#80cbc4'],
  }[site.style];
  return canvasTexture(768, 160, (g) => {
    g.fillStyle = look[0]; g.fillRect(0, 0, 768, 160);
    g.strokeStyle = look[2]; g.lineWidth = 8; g.strokeRect(8, 8, 752, 144);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = look[1]; g.font = font(62, 800);
    g.fillText(site.name.toUpperCase(), 384, 62, 720);
    g.fillStyle = look[2]; g.font = font(40, 600);
    g.fillText(`${site.deva} · ${site.sub}`, 384, 120, 720);
  });
}
