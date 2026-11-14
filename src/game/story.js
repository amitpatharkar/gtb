import * as THREE from 'three';
import { POSE, FLAG, outfit } from '../sim/people.js';
import { buildMissions } from './missions.js';
import { HOME } from './state.js';

// The mission engine. The script lives in missions.js: a STORY strand (yellow markers) and
// SIDE missions (blue markers); every mission whose turn has come shows a marker in the
// world and on the map, with whoever gives it standing there. Drive or walk into a marker
// to start. Steps are cutscenes (letterbox, camera on the speaker, subtitles; Space skips),
// drives, passengers, fragile cargo, multi-stop errands, checkpoint races, chases on foot
// and counters. Failing sends you back to the marker to try again. Progress is saved
// (mission and step); a save taken mid-step re-enters that step.

const MARK = { story: 0xf7c600, side: 0x35b6ff, target: 0x9cf0ff };
const ON_TEXT = { foot: 'on foot', vehicle: 'in a vehicle', taxi: 'in your taxi', two: 'on a two-wheeler', swift: 'in a Maroti Swyft', auto: 'in the auto-rickshaw', tanker: 'in the water tanker', ambulance: 'in the ambulance', school: 'in the school bus', cycle: 'on the bicycle', bus: 'in the BEST bus', decker: 'in the double-decker' };
const inHours = (h, [a, b]) => (a <= b ? h >= a && h < b : h >= a || h < b);
const clockText = (h) => `${((Math.floor(h) + 11) % 12) + 1}${h % 1 ? ':30' : ''} ${h >= 12 && h < 24 ? 'pm' : 'am'}`;

export class Story {
  constructor({ scene, tiles, index, state, cityMap, hud, bubbles, people, jobs, street, clock, audio }) {
    Object.assign(this, { scene, tiles, index, state, cityMap, hud, bubbles, people, jobs, street, clock, audio });
    state.s.story ||= { done: [], active: null, step: 0 };
    this.el = document.getElementById('objective');
    this.cut = document.getElementById('cutscene');
    this.cast = {};
    this.givers = new Map();   // mission id → the person waiting at its marker
    this.camera = null;        // { pos, look } while a cutscene runs
    this.markerT = 0;
    this.stepT = 0;
    this.entered = false;      // a mission loaded from a save is re-entered on the first update
    this.cargo = null;         // { name, icon, min, v } something fragile on board
    this.runner = null;        // a runaway being chased
    this.world = { state, clock }; // main.js adds the systems missions can reach: stars, garage, crackers, police
    const { missions, places } = buildMissions(index, HOME.at);
    this.missions = missions;
    this.places = places;
    // Marker pool: a ring on the ground with a beam of light, tinted per use.
    const ringG = new THREE.CylinderGeometry(1.6, 1.6, 0.25, 24, 1, true), beamG = new THREE.CylinderGeometry(0.25, 0.25, 30, 8, 1, true);
    this.marks = Array.from({ length: 8 }, () => {
      const ring = new THREE.Mesh(ringG, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
      const beam = new THREE.Mesh(beamG, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.25, depthWrite: false }));
      ring.visible = beam.visible = false;
      scene.add(ring, beam);
      return { ring, beam };
    });
  }

  get s() { return (this.state.s.story ||= { done: [], active: null, step: 0 }); }
  get active() { return this.missions.find((m) => m.id === this.s.active) || null; }

  /** Missions that can be started now (their turn has come), nearest first if `at` is given. */
  available(at = null) {
    if (this.s.active) return [];
    const list = this.missions.filter((m) => !this.s.done.includes(m.id) && (!m.after || this.s.done.includes(m.after)));
    if (at) list.sort((a, b) => Math.hypot(a.at[0] - at.x, a.at[1] - at.z) - Math.hypot(b.at[0] - at.x, b.at[1] - at.z));
    return list;
  }

  /** Mission starts for the city map. */
  markers() { return this.available().map((m) => ({ x: m.at[0], z: m.at[1], color: m.strand === 'story' ? '#d4a900' : '#1f8fd6', icon: m.strand === 'story' ? 'M' : '?', r: 9 })); }

  /** Another system reports something missions may count (a cracker lit, …). */
  event(type, what) {
    const st = this.active?.steps[this.s.step];
    if (type === 'cracker' && st?.task === 'crackers' && this.lit) this.lit[what] = (this.lit[what] || 0) + 1;
  }

  // ------------------------------------------------------------------ people
  /** A cast member of a mission (created on first use from the mission's cast list). */
  makePerson(id, m) {
    const def = m?.cast?.[id] || (id === 'mamaji' ? { name: 'Mamaji', kind: 'office', cap: true, white: true } : id === 'shabbir' ? { name: 'Shabbir bhai', kind: 'casual' } : { name: id, kind: 'casual' });
    const look = outfit(def.kind || 'casual');
    if (def.white) { look.shirt = new THREE.Color(0xf2efe6); look.pants = new THREE.Color(0xf2efe6); }
    return { ...look, kind: def.kind === 'sari' ? 'sari' : def.kind, x: 0, y: 0.2, z: 0, heading: 0, phase: 0, pose: POSE.STAND, amp: 1, flags: (def.cap ? FLAG.CAP : 0) | (def.kind === 'sari' ? FLAG.SARI : 0), scale: def.kind === 'kid' ? 0.72 : 1, h: def.kind === 'kid' ? 1.7 : 2.2, name: def.name, placed: false };
  }

  person(id) { return (this.cast[id] ||= this.makePerson(id, this.active)); }

  /** A free spot on the footpath next to (x, z), a few metres off. */
  spotNear(x, z, r = 4.5, skip = 0) {
    for (let a = skip; a < 12 + skip; a++) {
      const px = x + Math.cos(a * 0.52) * r, pz = z + Math.sin(a * 0.52) * r;
      if (!this.tiles.hits(px, pz, 0.4) && !this.tiles.roadAt(px, pz, 0.3, true)) return [px, pz];
    }
    return [x + r, z];
  }

  /**
   * Move a point onto the nearest drivable road (script coordinates are places, not
   * kerbs). Only possible once the map there has streamed in; returns true when done.
   */
  snap(pt) {
    const r = this.tiles.roadAt(pt[0], pt[1], 120, true) || this.tiles.roadAt(pt[0], pt[1], 600, true); // parks and maidans are big
    if (!r) return false;
    const s = this.tiles.segment(r.tile, r.index), dx = s[2] - s[0], dz = s[3] - s[1], l2 = dx * dx + dz * dz || 1;
    const k = Math.max(0.1, Math.min(0.9, ((pt[0] - s[0]) * dx + (pt[1] - s[1]) * dz) / l2));
    pt[0] = s[0] + dx * k; pt[1] = s[1] + dz * k;
    return true;
  }

  /** Snap a point the first time the player is close enough for its tiles to be loaded. */
  snapNear(pt, me) {
    if (pt.snapped || Math.hypot(me.pos.x - pt[0], me.pos.z - pt[1]) > 280) return;
    if (this.snap(pt)) pt.snapped = true;
  }

  place(p, x, z, face) {
    p.x = x; p.z = z; p.y = this.tiles.groundHeight(x, z); p.placed = true;
    if (face) p.heading = Math.atan2(face.x - x, face.z - z);
  }

  // ------------------------------------------------------------------ flow
  start(m, ctx) {
    this.s.active = m.id; this.s.step = 0; this.stepT = 0; this.entered = true;
    this.cast = {};
    const g = this.givers.get(m.id);
    if (g && m.giver) this.cast[m.giver] = g;
    this.hud.message(`${m.strand === 'story' ? 'Story' : 'Side mission'}: ${m.title}`);
    this.audio?.whistle?.(0.2);
    this.enterStep(ctx);
  }

  clearStep() {
    this.lent = null;
    this.cargo = null; this.todo = null; this.cp = 0; this.lit = null; this.armed = false; this.target = null;
    if (this.runner) { this.scene.remove(this.runner.mesh); this.runner = null; }
  }

  fail(why) {
    this.hud.message(`Mission failed: ${why || 'try again'} — go back to the marker to retry`);
    this.s.active = null; this.s.step = 0;
    this.cityMap.setWaypoint(null, 'mission');
    this.cast = {};
    this.clearStep();
  }

  /**
   * A vehicle for the mission, parked at the kerb near `at` (or near the player) — lent, so
   * taking it is no challan. Only one loan stands around at a time.
   */
  lend(type, at, ctx) {
    const g = this.world.garage, tr = g?.traffic, T = tr?.types[type];
    this.lent = type;
    if (!T || g.type === type) return;
    const me = ctx.onFoot ? ctx.walker : ctx.player;
    const [ax, az] = at || [me.pos.x, me.pos.z];
    tr.left = tr.left.filter((v) => !v.lent);
    const r = this.tiles.roadAt(ax, az, 45, true);
    let x = ax + 4, z = az + 4, heading = 0;
    if (r) {
      // The nearest point of that road, moved out to its left kerb.
      const sg = this.tiles.segment(r.tile, r.index), len = Math.hypot(sg[2] - sg[0], sg[3] - sg[1]) || 1, fx = (sg[2] - sg[0]) / len, fz = (sg[3] - sg[1]) / len;
      const d0 = (ax - sg[0]) * fx + (az - sg[1]) * fz, o = Math.max(0, sg[4] - T.wid / 2 - 0.3), half = T.len / 2 + 1;
      // A little way along the road, clear of whatever the player arrived in.
      let d = THREE.MathUtils.clamp(d0, half, Math.max(half, len - half));
      for (const off of [11, -11, 17, -17, 7, -7, 24, -24]) {
        const k = d0 + off;
        if (k < half || k > len - half) continue;
        const px = sg[0] + fx * k + fz * o, pz = sg[1] + fz * k - fx * o;
        if (Math.hypot(px - ctx.player.pos.x, pz - ctx.player.pos.z) > T.len / 2 + 5) { d = k; break; }
      }
      x = sg[0] + fx * d + fz * o; z = sg[1] + fz * d - fx * o; heading = Math.atan2(fx, fz);
    }
    tr.left.push({ type, x, z, heading, tint: new THREE.Color(T.tints[0]), taken: true, lent: true, fuel: 0.9, condition: 1 });
  }

  /** The vehicle lent by the last `lend` step before step i (missions resumed from a save). */
  lendBefore(m, i) {
    for (let k = i - 1; k >= 0; k--) if (m.steps[k].lend) return m.steps[k].lend;
    return null;
  }

  /** The cargo set by the last cargo step before step i (missions resumed from a save). */
  cargoBefore(m, i) {
    for (let k = i - 1; k >= 0; k--) if ('cargo' in m.steps[k]) return m.steps[k].cargo ? { ...m.steps[k].cargo, v: 1 } : null;
    return null;
  }

  enterStep(ctx, resume = false) {
    const m = this.active;
    if (!m) { this.s.active = null; this.s.step = 0; return; }
    const st = m.steps[this.s.step];
    this.stepT = 0; this.armed = false; this.target = null; this.todo = null; this.lit = null;
    if (resume) { this.cargo = this.cargoBefore(m, this.s.step); const type = this.lendBefore(m, this.s.step); if (type) this.lend(type, null, ctx); }
    if (st?.lend) this.lend(st.lend, typeof st.at === 'function' ? st.at(this.world) : st.at, ctx);
    if (!st) { this.s.done.push(m.id); this.s.active = null; this.cast = {}; this.clearStep(); this.cityMap.setWaypoint(null, 'mission'); this.hud.message(`Mission complete: ${m.title}`); this.state.save(); return; }
    if (st.goto) { this.target = [...(typeof st.goto === 'function' ? st.goto(this.world) : st.goto)]; this.cityMap.routeTo(this.target[0], this.target[1], st.label, 'mission'); }
    if (st.cut) { this.lines = st.cut.slice(); this.lineT = 0; this.showLine(ctx); }
    if ('cargo' in st) { this.cargo = st.cargo ? { ...st.cargo, v: 1 } : null; this.lastSp = undefined; }
    if (st.visit) { this.todo = st.visit.map(([x, z, label]) => ({ x, z, label, done: false })); this.routeNearest(ctx); }
    if (st.race) { this.cp = 0; this.cps = st.race.map((c) => [...c]); this.cityMap.routeTo(st.race[0][0], st.race[0][1], 'Checkpoint 1', 'mission'); }
    if (st.catch) this.spawnRunner(st);
    if (st.task === 'rides') { this.base = { rides: this.state.s.rides, sum: this.state.s.ratingSum }; if (!this.jobs.onDuty) this.jobs.toggleDuty(ctx.player, 'taxi'); }
    if (st.task === 'colour') this.coloured = new Set();
    if (st.task === 'crackers') this.lit = {};
    if (st.pickup) {
      const p = this.person(st.pickup);
      if (!p.placed) {
        const r = this.tiles.roadAt(st.at[0], st.at[1], 30, true);
        let x = st.at[0] + 3, z = st.at[1] + 2;
        if (r) { const sg = this.tiles.segment(r.tile, r.index); x = (sg[0] + sg[2]) / 2 + 2.5; z = (sg[1] + sg[3]) / 2 + 2.5; }
        this.place(p, x, z);
      }
      p.inTaxi = false;
      this.cityMap.routeTo(p.x, p.z, p.name, 'mission');
    }
    if (st.reward && !resume) {
      this.state.earn(st.reward, `Mission: ${m.title}`);
      st.also?.(this.world);
      if (st.line) this.bubbles.say(ctx.player.pos, st.line, 3.5);
      this.hud.message(`Mission complete: ${m.title} · +₹${st.reward.toLocaleString('en-IN')}`);
    }
  }

  routeNearest(ctx) {
    const me = ctx.onFoot ? ctx.walker : ctx.player;
    const left = this.todo.filter((t) => !t.done).sort((a, b) => Math.hypot(a.x - me.pos.x, a.z - me.pos.z) - Math.hypot(b.x - me.pos.x, b.z - me.pos.z));
    if (left[0]) this.cityMap.routeTo(left[0].x, left[0].z, left[0].label, 'mission');
  }

  showLine(ctx) {
    const [who, text] = this.lines[0];
    const p = who === 'you' ? null : this.person(who);
    if (p && !p.placed) {
      // Someone new to the scene stands near whoever is already there.
      const near = Object.values(this.cast).find((q) => q.placed) || { x: ctx.player.pos.x, z: ctx.player.pos.z };
      const [x, z] = this.spotNear(near.x, near.z, 1.6, 3);
      this.place(p, x, z, ctx.onFoot ? ctx.walker.pos : ctx.player.pos);
    }
    this.cut.innerHTML = `<div class="bar top"></div><div class="bar bottom"><p><b>${who === 'you' ? 'You' : p.name}:</b> ${text}</p><small>Space to continue</small></div>`;
    this.cut.hidden = false;
    if (p && !p.inTaxi) p.pose = POSE.ARGUE;
    this.lineT = Math.max(2.5, text.length * 0.06);
  }

  skip() { if (this.lines?.length || this.ext) this.lineT = 0; }

  /** True while a mission cutscene or an ad-hoc scene is playing. */
  get busy() { return !!this.camera || !!this.ext; }

  /**
   * An ad-hoc cutscene outside the missions (fan meets, easter eggs): `lines` are
   * [speaker name, text], `cam()` gives { pos, look } each frame, `done()` runs at the end.
   * Same letterbox and subtitles as mission cutscenes; Space skips a line.
   */
  playScene(lines, cam, done) {
    if (this.busy) return false;
    this.ext = { lines: lines.slice(), cam, done };
    this.camera = cam();
    this.extLine();
    return true;
  }

  extLine() {
    const [name, text] = this.ext.lines[0];
    this.cut.innerHTML = `<div class="bar top"></div><div class="bar bottom"><p><b>${name}:</b> ${text}</p><small>Space to continue</small></div>`;
    this.cut.hidden = false;
    this.lineT = Math.max(2.6, text.length * 0.065);
  }

  next(ctx) { this.s.step++; this.enterStep(ctx); }

  /** Is the player travelling the way the step asks (on foot, in the taxi, on a two-wheeler, …)? */
  onOk(st, ctx) {
    const on = st.on, g = this.world.garage;
    if (!on) return true;
    if (on === 'foot') return ctx.onFoot;
    if (ctx.onFoot) return false;
    if (on === 'vehicle') return true;
    if (on === 'taxi') return !g || g.inTaxi;
    if (on === 'two') return !!g?.rider;
    return Array.isArray(on) ? on.includes(g?.type) : g?.type === on || (on === 'cycle' && g?.type === 'dabba');
  }

  // ------------------------------------------------------------------ markers
  mark(i, x, z, color, scale = 1) {
    const mk = this.marks[i];
    if (!mk) return;
    const y = this.tiles.groundHeight(x, z);
    mk.ring.visible = mk.beam.visible = true;
    mk.ring.material.color.setHex(color).multiplyScalar(2); mk.beam.material.color.setHex(color).multiplyScalar(1.5);
    mk.ring.scale.set(scale, 1, scale);
    mk.ring.position.set(x, y + 0.2 + Math.sin(this.markerT * 3 + i) * 0.1, z);
    mk.beam.position.set(x, y + 15, z);
  }

  // ------------------------------------------------------------------ the runaway
  spawnRunner(st) {
    const g = new THREE.Group();
    const black = new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.6 }), white = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.7 }), orange = new THREE.MeshStandardMaterial({ color: 0xf2901c, roughness: 0.6 });
    const add = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; g.add(m); return m; };
    add(new THREE.CapsuleGeometry(0.19, 0.3, 6, 12), black, 0, 0.42, 0, 1, 1, 0.9);
    add(new THREE.SphereGeometry(0.17, 12, 10), white, 0, 0.38, 0.06, 0.85, 1.35, 0.75);
    add(new THREE.SphereGeometry(0.13, 12, 10), black, 0, 0.78, 0.01);
    add(new THREE.ConeGeometry(0.035, 0.12, 8).rotateX(Math.PI / 2), orange, 0, 0.77, 0.16);
    for (const s of [-1, 1]) {
      add(new THREE.BoxGeometry(0.1, 0.03, 0.16), orange, s * 0.09, 0.03, 0.05);
      add(new THREE.SphereGeometry(0.06, 8, 6), black, s * 0.21, 0.45, 0, 0.35, 2.4, 1);          // flippers
      add(new THREE.SphereGeometry(0.018, 6, 6), white, s * 0.06, 0.82, 0.11);                     // eyes
    }
    const at = this.active?.at || st.at; // the (road-snapped) mission start
    const [x, z] = this.spotNear(at[0], at[1], 9, 2);
    g.position.set(x, this.tiles.groundHeight(x, z), z);
    this.scene.add(g);
    this.runner = { mesh: g, x, z, home: [x, z], heading: 0, burst: 0, rest: 0, t: 0, said: 0 };
  }

  updateRunner(dt, ctx) {
    const r = this.runner, me = ctx.onFoot ? ctx.walker : ctx.player;
    const dx = r.x - me.pos.x, dz = r.z - me.pos.z, d = Math.hypot(dx, dz) || 1;
    r.t += dt; r.said -= dt;
    let speed = 0, want = r.heading;
    const fromHome = Math.hypot(r.x - r.home[0], r.z - r.home[1]);
    if (d < 12) {
      // Flee in bursts with jinks; then he has to catch his breath.
      if (r.rest > 0) { r.rest -= dt; speed = 1.1; } else { r.burst += dt; speed = 4.9; if (r.burst > 2.6 + Math.sin(r.t) * 0.5) { r.burst = 0; r.rest = 1.5; } }
      want = Math.atan2(dx, dz) + Math.sin(r.t * 2.3) * 0.7;
      if (fromHome > 70) want = Math.atan2(r.home[0] - r.x, r.home[1] - r.z) + (Math.sin(r.t) > 0 ? 0.9 : -0.9); // not too far from the zoo
      if (r.said <= 0 && d < 6) { r.said = 2.5; this.bubbles.say({ x: r.x, y: 0.6, z: r.z }, ['Kwaak!', 'Kwek kwek!', '🐧!'][Math.floor(Math.random() * 3)], 1.5); }
    } else if (fromHome > 25) { want = Math.atan2(r.home[0] - r.x, r.home[1] - r.z); speed = 1.2; } else { speed = Math.sin(r.t * 0.7) > 0.3 ? 0.8 : 0; want = r.heading + Math.sin(r.t * 0.9) * dt; }
    // Waddle around obstacles: try the wanted heading, then either side of it.
    for (const off of [0, 0.7, -0.7, 1.4, -1.4, 2.2, -2.2]) {
      const h = want + off, nx = r.x + Math.sin(h) * speed * dt, nz = r.z + Math.cos(h) * speed * dt;
      if (speed === 0 || !this.tiles.hits(nx, nz, 0.3)) { r.x = nx; r.z = nz; r.heading = h; break; }
    }
    r.mesh.position.set(r.x, this.tiles.groundHeight(r.x, r.z), r.z);
    r.mesh.rotation.set(0, r.heading, Math.sin(r.t * (6 + speed * 3)) * (speed ? 0.2 : 0.04));
    return d;
  }

  // ------------------------------------------------------------------ frame
  update(dt, ctx) {
    const { player, onFoot, walker } = ctx;
    const me = onFoot ? walker : player;
    this.markerT += dt;
    for (const mk of this.marks) mk.ring.visible = mk.beam.visible = false;
    // A save taken mid-mission: rebuild the step's state (cutscene lines, task counters, cast).
    if (this.s.active && !this.entered) { this.entered = true; this.enterStep(ctx, true); }
    if (this.ext) {
      // An ad-hoc scene has the camera until its lines run out.
      this.camera = this.ext.cam();
      this.lineT -= dt;
      if (this.lineT <= 0) {
        this.ext.lines.shift();
        if (this.ext.lines.length) this.extLine();
        else { const done = this.ext.done; this.ext = null; this.cut.hidden = true; this.camera = null; done?.(); }
      }
      return;
    }
    const m = this.active;
    if (!m) { this.offer(dt, ctx, me); return; }
    const st = m.steps[this.s.step];
    if (!st) return;
    const timed = st.limit && (!st.race || this.armed);
    if (!st.race || this.armed) this.stepT += dt;
    for (const p of Object.values(this.cast)) if (p.placed && !p.inTaxi && !p.gone) { p.phase += dt * 2; this.people.add(p); }
    // A passenger in an open vehicle (an auto) can be seen on the bench.
    const pax = !onFoot && this.world.garage && !this.world.garage.inTaxi ? this.world.garage.spec?.pax : null;
    if (pax) for (const p of Object.values(this.cast)) if (p.inTaxi && !p.gone) {
      const h = player.heading, sh = Math.sin(h), ch = Math.cos(h);
      this.people.add({ ...p, noHero: true, keep: true, x: player.pos.x + sh * pax.z - ch * 0.22, y: player.pos.y + pax.seat - 0.42, z: player.pos.z + ch * pax.z + sh * 0.22, heading: h, phase: 0, pose: POSE.SIT });
    }
    let objective = st.label || '';
    if (st.cut) {
      // Camera on whoever is speaking, from the side away from the vehicle; subtitles advance by time or Space.
      const [who] = this.lines[0];
      const p = who === 'you' ? null : this.person(who);
      const fx = p ? p.x : me.pos.x, fz = p ? p.z : me.pos.z;
      const away = Math.atan2(fz - me.pos.z, fx - me.pos.x);
      const ang = away + Math.PI + 0.75 + Math.sin(this.stepT * 0.2) * 0.2;
      this.camera = { pos: new THREE.Vector3(fx + Math.cos(ang) * 4.2, (p?.y ?? me.pos.y) + 1.9, fz + Math.sin(ang) * 4.2), look: new THREE.Vector3(fx, (p?.y ?? me.pos.y) + 1.45, fz) };
      this.lineT -= dt;
      if (this.lineT <= 0) {
        this.lines.shift();
        if (this.lines.length) this.showLine(ctx);
        else { this.cut.hidden = true; this.camera = null; for (const q of Object.values(this.cast)) q.pose = POSE.STAND; this.next(ctx); }
      }
      return;
    }
    this.camera = null;
    if (timed && this.stepT > st.limit) { this.fail(st.fail); return; }
    const left = timed ? ` · ⏱ ${Math.max(0, Math.ceil(st.limit - this.stepT))} s` : '';
    const need = st.on && !this.onOk(st, ctx) ? ` — you need to be ${ON_TEXT[st.on] || `in a ${st.on}`}` : '';
    // Fragile cargo: hard braking, crashes, bumps and sliding around all take their toll.
    if (this.cargo && !onFoot) {
      const c = this.cargo, sp = player.speed, dv = (sp - (this.lastSp ?? sp)) / Math.max(dt, 1e-3);
      this.lastSp = sp;
      let loss = 0;
      if (dv < -11.5) loss += Math.min(0.3, (-dv - 11.5) * 0.004);
      if ((player.slip || 0) > 0.6) loss += 0.05 * dt;
      if ((player.lastBump || 0) > (this.prevBump || 0)) loss += 0.035;
      this.prevBump = player.lastBump || 0;
      if (loss > 0) { c.v = Math.max(0, c.v - loss); if (loss > 0.03 && (this.cargoSay || 0) < this.markerT) { this.cargoSay = this.markerT + 2.5; this.bubbles.say(player.pos, ['Arre! Sambhal ke!', 'Dheere, dheere!', 'Oho! Jhatka!'][Math.floor(Math.random() * 3)], 1.8, 'driver'); } }
      if (c.v < c.min) { this.fail(`${c.name}: ruined on the way`); return; }
    }
    if (this.lent && this.world.garage && this.world.garage.type !== this.lent) {
      const tr = this.world.garage.traffic, v = tr.left.find((q) => q.lent || q.type === this.lent);
      if (v) this.mark(7, v.x, v.z, MARK.side, 0.8);
      else if (onFoot || this.world.garage.inTaxi) this.lend(this.lent, null, ctx);
    }
    const cargoText = this.cargo ? ` · ${this.cargo.icon || '📦'} ${this.cargo.name} ${Math.round(this.cargo.v * 100)}%` : '';

    if (st.goto) {
      this.snapNear(this.target, me);
      const [tx, tz] = this.target;
      this.mark(0, tx, tz, MARK.target, (st.radius || 22) / 6);
      const d = Math.hypot(me.pos.x - tx, me.pos.z - tz);
      objective += need + left + cargoText;
      if (d < (st.radius || 22) && this.onOk(st, ctx) && Math.abs(player.speed) < 2.5) {
        if (st.minCondition && player.condition < st.minCondition) objective = `${st.label} — this one is too scratched (${Math.round(player.condition * 100)}%), find a cleaner one${left}`;
        else this.next(ctx);
      }
    } else if (st.pickup) {
      const p = this.person(st.pickup);
      objective = `Pick up ${p.name} (stop next to them ${ON_TEXT[st.on || 'taxi'] || `in the ${st.on}`})`;
      if (!onFoot && this.onOk({ on: st.on || 'taxi' }, ctx) && Math.hypot(player.pos.x - p.x, player.pos.z - p.z) < 8 && Math.abs(player.speed) < 1) {
        p.inTaxi = true;
        this.bubbles.say(player.pos, st.line, 3, 'driver');
        this.next(ctx);
      }
    } else if (st.dropoff) {
      const p = this.person(st.dropoff);
      p.inTaxi = false; p.gone = true;
      this.bubbles.say(player.pos, st.line, 3, 'driver');
      this.next(ctx);
    } else if (st.pay) {
      // A fee: waits until the player can afford it.
      const have = this.state.s.money;
      objective = `${st.label || 'Pay'} — ₹${st.pay.toLocaleString('en-IN')} (you have ₹${Math.max(0, have).toLocaleString('en-IN')}${have < st.pay ? '; earn the rest with fares, J' : ''})`;
      if (have >= st.pay) { this.state.earn(-st.pay, st.what || `Mission: ${m.title}`); if (st.line) this.bubbles.say(me.pos, st.line, 3); this.next(ctx); }
    } else if (st.waitHour) {
      const h = this.clock.hour;
      objective = `${st.label} · now ${this.clock.label}`;
      if (h >= st.waitHour[0] && h <= st.waitHour[1]) this.next(ctx);
      else if (h > st.waitHour[1] && h < 23) objective = 'Missed the sunset — wait for tomorrow evening (T skips hours)';
    } else if ('cargo' in st || st.call || st.lend) {
      st.call?.(this.world);
      this.next(ctx);
    } else if (st.visit) {
      let i = 0, n = 0;
      for (const t of this.todo) {
        if (t.done) { n++; continue; }
        if (!t.snapped && Math.hypot(me.pos.x - t.x, me.pos.z - t.z) < 280) { const pt = [t.x, t.z]; if (this.snap(pt)) { t.x = pt[0]; t.z = pt[1]; t.snapped = true; } }
        this.mark(i++, t.x, t.z, MARK.target, 2.2);
        if (Math.hypot(me.pos.x - t.x, me.pos.z - t.z) < 16 && this.onOk(st, ctx) && Math.abs(player.speed) < 2.5) {
          t.done = true; n++;
          this.audio?.whistle?.(0.15);
          this.hud.message(`Delivered: ${t.label} (${n}/${this.todo.length})`);
          this.routeNearest(ctx);
        }
      }
      objective += ` · ${n}/${this.todo.length}${need}${left}${cargoText}`;
      if (n >= this.todo.length) this.next(ctx);
    } else if (st.race) {
      const ok = this.onOk(st, ctx);
      if (!this.armed) {
        objective = `${st.label} — get ${ON_TEXT[st.on] || 'ready'} (F on foot next to one); the clock starts when you ride off`;
        this.snapNear(this.cps[0], me);
        this.mark(0, this.cps[0][0], this.cps[0][1], MARK.target, 2.5);
        if (ok && Math.abs(player.speed) > 3) { this.armed = true; this.stepT = 0; this.audio?.whistle?.(0.3); this.hud.message('Go! Go! Go!'); }
      } else {
        this.snapNear(this.cps[this.cp], me);
        const [cx, cz] = this.cps[this.cp];
        this.mark(0, cx, cz, MARK.target, 3.2);
        objective += ` · checkpoint ${this.cp + 1}/${st.race.length}${need} · ⏱ ${Math.max(0, Math.ceil(st.limit - this.stepT))} s`;
        if (ok && Math.hypot(player.pos.x - cx, player.pos.z - cz) < 16) {
          this.cp++;
          this.audio?.whistle?.(0.15);
          if (this.cp >= st.race.length) { this.hud.message(`Finished with ${Math.ceil(st.limit - this.stepT)} s to spare!`); this.next(ctx); }
          else this.cityMap.routeTo(this.cps[this.cp][0], this.cps[this.cp][1], `Checkpoint ${this.cp + 1}`, 'mission');
        }
      }
    } else if (st.catch) {
      const d = this.updateRunner(dt, ctx);
      objective += ` · ${Math.round(d)} m away${onFoot ? '' : ' — get out (F) and chase on foot'}`;
      if (onFoot && d < 1.25) {
        this.bubbles.say(walker.pos, 'Pakad liya!', 2);
        this.scene.remove(this.runner.mesh); this.runner = null;
        this.next(ctx);
      }
    } else if (st.task === 'rides') {
      const n = this.state.s.rides - this.base.rides, avg = n ? (this.state.s.ratingSum - this.base.sum) / n : 0;
      objective = `${st.label} · ${n}/${st.count}${n ? ` · avg ${avg.toFixed(1)}★` : ''}`;
      if (n >= st.count) { if (avg >= 3.5) this.next(ctx); else { this.hud.message('Rating too low — Mamaji says: aaraam se! Three more.'); this.base = { rides: this.state.s.rides, sum: this.state.s.ratingSum }; } }
    } else if (st.task === 'colour') {
      for (const p of [...this.street.peds, ...[...this.street.fixtures.values()].flatMap((f) => f.people || [])]) if (p.patches?.length) this.coloured.add(p);
      objective = `${st.label} · ${this.coloured.size}/${st.count}${left}`;
      if (this.coloured.size >= st.count) this.next(ctx);
    } else if (st.task === 'crackers') {
      const names = { anar: 'anar', chakri: 'chakri', ladi: 'ladi', bomb: 'bomb', rocket: 'sky shot' };
      const parts = Object.entries(st.need).map(([k, n]) => `${names[k] || k} ${Math.min(n, this.lit[k] || 0)}/${n}`);
      objective = `${st.label} · ${parts.join(' · ')}${left}`;
      if (Object.entries(st.need).every(([k, n]) => (this.lit[k] || 0) >= n)) this.next(ctx);
    } else if (st.reward) {
      this.next(ctx);
    }
    this.el.hidden = !objective;
    this.el.innerHTML = `<b>${m.strand === 'story' ? '★' : '◆'} ${m.title}:</b> ${objective}`;
  }

  /** No mission running: show the markers of those on offer, their givers, and start one when the player arrives. */
  offer(dt, ctx, me) {
    const list = this.available(me.pos);
    let i = 0;
    for (const m of list) {
      this.snapNear(m.at, me);
      const [x, z] = m.at, d = Math.hypot(me.pos.x - x, me.pos.z - z);
      if (d > 700) continue;
      this.mark(i++, x, z, MARK[m.strand] || MARK.side);
      // Whoever gives the mission waits by the marker.
      if (m.giver && d < 110) {
        let g = this.givers.get(m.id);
        if (!g) { g = this.makePerson(m.giver, m); this.givers.set(m.id, g); }
        if (!g.placed && d < 90) { const [px, pz] = this.spotNear(x, z); this.place(g, px, pz); }
        if (g.placed) { g.heading = Math.atan2(me.pos.x - g.x, me.pos.z - g.z); g.phase += dt * 2; g.pose = d < 25 ? POSE.WAVE : POSE.STAND; this.people.add(g); }
      }
      // Rolling through the ring doesn't start it: say so (new players drive straight past).
      if (d < 24 && Math.abs(ctx.player.speed) >= 3 && (this.stopSay || 0) < this.markerT) { this.stopSay = this.markerT + 8; this.hud.message(`Stop inside the ${m.strand === 'story' ? 'yellow' : 'blue'} ring to start "${m.title}"`); }
      if (d < 7 && Math.abs(ctx.player.speed) < 3) {
        if (m.hours && !inHours(this.clock.hour, m.hours)) {
          if ((this.hoursSay || 0) < this.markerT) { this.hoursSay = this.markerT + 6; this.hud.message(`${m.title}: come back between ${clockText(m.hours[0])} and ${clockText(m.hours[1])} (T skips an hour)`); }
        } else { this.start(m, ctx); return; }
      }
    }
    const story = list.find((m) => m.strand === 'story'), near = list[0];
    const show = near && Math.hypot(me.pos.x - near.at[0], me.pos.z - near.at[1]) < 350 ? near : story;
    this.el.hidden = !show;
    if (show) {
      const d = Math.hypot(me.pos.x - show.at[0], me.pos.z - show.at[1]);
      this.el.innerHTML = `<b>${show.strand === 'story' ? '★ Story' : '◆ Side mission'}:</b> ${show.title} — go to the ${show.strand === 'story' ? 'yellow' : 'blue'} marker (${d < 1000 ? `${Math.round(d / 10) * 10} m` : `${(d / 1000).toFixed(1)} km`})`;
    }
  }
}
