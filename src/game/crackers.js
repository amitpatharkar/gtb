import * as THREE from 'three';

// Phatake! Firecrackers the player can light on foot (X lights, Z changes type), and that
// the city lights by itself on evenings: sky shots over the rooftops, anars and chakris on
// the footpath. All light and noise, no harm: people flinch and scold, car alarms chirp,
// and after 10 pm a constable who sees you fines you (Mumbai's real cut-off).
//
//   ladi    string of small crackers: crackles along its length
//   anar    flower pot: a fountain of golden sparks
//   chakri  ground spinner: a wheel of sparks
//   bomb    sutli bomb: long fuse, one very loud bang
//   rocket  sky shot: whistles up and bursts into a coloured shell
//
// Everything is drawn with one Points object (additive sparks) and sounds are synthesised.

export const CRACKERS = [
  { id: 'anar', name: 'Anar (flower pot)', fuse: 0.8 },
  { id: 'chakri', name: 'Chakri (ground spinner)', fuse: 0.8 },
  { id: 'ladi', name: 'Ladi (cracker string)', fuse: 1.0 },
  { id: 'bomb', name: 'Sutli bomb', fuse: 2.2 },
  { id: 'rocket', name: 'Sky shot', fuse: 1.2 },
];
const PALETTE = [[1, 0.78, 0.3], [1, 0.25, 0.2], [0.3, 1, 0.45], [0.35, 0.6, 1], [0.85, 0.4, 1], [1, 0.55, 0.85], [0.95, 0.95, 1], [1, 0.6, 0.15]];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const rnd = (a, b) => a + Math.random() * (b - a);

export class Crackers {
  constructor({ scene, tiles, audio, bubbles, street, police, traffic, hud, tier, renderer }) {
    Object.assign(this, { scene, tiles, audio, bubbles, street, police, traffic, hud, renderer });
    this.index = 0;
    this.items = [];       // lit crackers and flying shells
    this.max = tier.name === 'High' ? 9000 : tier.name === 'Medium' ? 6000 : 3500;
    this.n = 0;            // live particle count (packed at the front of the arrays)
    const M = this.max;
    this.pos = new Float32Array(M * 3); this.vel = new Float32Array(M * 3); this.col = new Float32Array(M * 3); this.base = new Float32Array(M * 3);
    this.size = new Float32Array(M); this.life = new Float32Array(M); this.span = new Float32Array(M);
    this.drag = new Float32Array(M); this.grav = new Float32Array(M); this.twinkle = new Float32Array(M);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 600 } },
      vertexShader: 'attribute float size; attribute vec3 color; varying vec3 vC; uniform float uScale; void main() { vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = clamp(size * uScale / -mv.z, 1.0, 64.0); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying vec3 vC; void main() { vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(d)); gl_FragColor = vec4(vC * a * a, 1.0); }',
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
    // The crackers themselves (small props on the ground) and the glow they throw.
    this.props = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.09, 0.2, 8).translate(0, 0.1, 0), new THREE.MeshStandardMaterial({ color: 0xb3261e, roughness: 0.8 }), 24);
    this.props.count = 0; this.props.frustumCulled = false;
    scene.add(this.props);
    this.glow = new THREE.PointLight(0xffc27a, 0, 22, 1.6);
    scene.add(this.glow);
    this.m = new THREE.Matrix4(); this.v = new THREE.Vector3(); this.q = new THREE.Quaternion(); this.s = new THREE.Vector3(1, 1, 1);
    this.ambientT = 6; this.streetT = 20; this.noiseCool = 0;
  }

  get current() { return CRACKERS[this.index]; }
  next() { this.index = (this.index + 1) % CRACKERS.length; this.hud.message(`🎆 ${this.current.name} — X to light it`); }

  // ------------------------------------------------------------------ particles
  spark(x, y, z, vx, vy, vz, life, size, c, drag = 1, grav = 9.8, twinkle = 0) {
    if (this.n >= this.max) return;
    const i = this.n++, j = i * 3;
    this.pos[j] = x; this.pos[j + 1] = y; this.pos[j + 2] = z;
    this.vel[j] = vx; this.vel[j + 1] = vy; this.vel[j + 2] = vz;
    this.base[j] = c[0]; this.base[j + 1] = c[1]; this.base[j + 2] = c[2];
    this.life[i] = this.span[i] = life; this.size[i] = size; this.drag[i] = drag; this.grav[i] = grav; this.twinkle[i] = twinkle;
  }

  stepParticles(dt) {
    const { pos, vel, col, base, life, span, drag, grav, twinkle, size } = this;
    let n = this.n;
    for (let i = 0; i < n; i++) {
      life[i] -= dt;
      if (life[i] <= 0) {
        // Swap the last live particle into this slot.
        n--;
        if (i < n) {
          const a = i * 3, b = n * 3;
          for (let k = 0; k < 3; k++) { pos[a + k] = pos[b + k]; vel[a + k] = vel[b + k]; base[a + k] = base[b + k]; }
          life[i] = life[n]; span[i] = span[n]; drag[i] = drag[n]; grav[i] = grav[n]; twinkle[i] = twinkle[n]; size[i] = size[n];
          i--;
        }
        continue;
      }
      const j = i * 3, f = Math.max(0, 1 - drag[i] * dt);
      vel[j] *= f; vel[j + 1] = vel[j + 1] * f - grav[i] * dt; vel[j + 2] *= f;
      pos[j] += vel[j] * dt; pos[j + 1] += vel[j + 1] * dt; pos[j + 2] += vel[j + 2] * dt;
      if (pos[j + 1] < 0.03 && vel[j + 1] < 0) { pos[j + 1] = 0.03; vel[j + 1] *= -0.25; vel[j] *= 0.5; vel[j + 2] *= 0.5; }
      // Fade out over the last part of life; glitter flickers.
      const t = life[i] / span[i];
      let k = Math.min(1, t * 2.2) * 2.2;
      if (twinkle[i] > 0 && Math.random() < twinkle[i]) k *= 0.15;
      col[j] = base[j] * k; col[j + 1] = base[j + 1] * k; col[j + 2] = base[j + 2] * k;
    }
    this.n = n;
    const g = this.points.geometry;
    g.setDrawRange(0, n);
    if (n || this.hadParticles) { g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; g.attributes.size.needsUpdate = true; }
    this.hadParticles = n > 0;
  }

  // ------------------------------------------------------------------ sound (synthesised)
  /** Volume and delay for a sound at distance d (sound takes its time across the city). */
  heard(d) { return [1 / (1 + (d / 30) ** 1.6), d / 343]; }

  bang(vol, delay = 0, deep = 1) {
    const A = this.audio, ctx = A.ctx;
    if (!ctx || vol < 0.01) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = A.noiseBuf();
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(2600 / deep, t); lp.frequency.exponentialRampToValueAtTime(180, t + 0.4);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.min(1.2, vol * 1.4), t + 0.005); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.5 * deep);
    src.connect(lp).connect(g).connect(A.master); src.start(t, Math.random() * 0.4, 0.6 * deep);
    const o = ctx.createOscillator(), og = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(110 / deep, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.25);
    og.gain.setValueAtTime(Math.min(1, vol), t); og.gain.exponentialRampToValueAtTime(0.0008, t + 0.3 * deep);
    o.connect(og).connect(A.master); o.start(t); o.stop(t + 0.35 * deep);
  }

  tick(vol, delay = 0) {
    const A = this.audio, ctx = A.ctx;
    if (!ctx || vol < 0.02) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = A.noiseBuf(); hp.type = 'highpass'; hp.frequency.value = 1500 + Math.random() * 1500;
    g.gain.setValueAtTime(Math.min(0.9, vol), t); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.05);
    src.connect(hp).connect(g).connect(A.master); src.start(t, Math.random() * 0.4, 0.06);
  }

  hiss(vol, dur, whistle = false) {
    const A = this.audio, ctx = A.ctx;
    if (!ctx || vol < 0.02) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = A.noiseBuf(); src.loop = true; bp.type = 'bandpass'; bp.frequency.value = 5200; bp.Q.value = 0.8;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol * 0.35, t + 0.15); g.gain.setValueAtTime(vol * 0.35, t + dur - 0.3); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(g).connect(A.master); src.start(t); src.stop(t + dur + 0.05);
    if (whistle) {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(2600, t + dur);
      og.gain.setValueAtTime(0.0001, t); og.gain.linearRampToValueAtTime(vol * 0.12, t + 0.1); og.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(og).connect(A.master); o.start(t); o.stop(t + dur + 0.05);
    }
  }

  // ------------------------------------------------------------------ lighting crackers
  /** Light a cracker at a spot on the ground. `by` is 'player' or 'npc'. */
  light(kind, x, z, by = 'npc', heading = 0) {
    const def = CRACKERS.find((c) => c.id === kind) || CRACKERS[0];
    const y = this.tiles.groundHeight(x, z);
    this.items.push({ kind: def.id, x, y, z, t: -def.fuse, by, heading, seed: Math.random() * 100, done: false });
  }

  /** The player lights the selected cracker a step ahead. */
  playerLight(walker, clock) {
    if (walker.down > 0) return;
    if (this.items.filter((i) => i.by === 'player' && !i.shell).length >= 6) { this.hud.message('Let those finish first!'); return; }
    const fx = Math.sin(walker.heading), fz = Math.cos(walker.heading);
    let x = walker.pos.x + fx * 1.3, z = walker.pos.z + fz * 1.3;
    if (this.tiles.hits(x, z, 0.15)) { x = walker.pos.x; z = walker.pos.z; }
    this.light(this.current.id, x, z, 'player', walker.heading);
    this.tick(0.3);
    // Mumbai's rule: no crackers after 10 pm.
    const late = clock.hour >= 22 || clock.hour < 6;
    if (late && this.noiseCool <= 0) { this.noiseCool = 20; this.police.offence('noise', walker); }
  }

  /** A sky shot from somewhere in the city (rooftops, lanes): the shell is already climbing. */
  shell(x, y, z, power = 1) {
    this.items.push({ kind: 'rocket', shell: true, x, y, z, vx: rnd(-2, 2), vy: rnd(26, 34) * power, vz: rnd(-2, 2), t: 0, fuseUp: rnd(1.5, 2.1), by: 'npc', seed: Math.random() * 100 });
  }

  burst(x, y, z, cam) {
    const d = Math.hypot(x - cam.x, y - cam.y, z - cam.z);
    const [vol, delay] = this.heard(d);
    this.bang(vol * 0.9, delay, 1.6);
    const type = Math.random();
    const c1 = pick(PALETTE), c2 = Math.random() < 0.4 ? pick(PALETTE) : c1;
    const far = d > 220 ? 0.5 : 1;
    // Stars are glows, not grains: bigger with distance so a shell 300 m away still reads.
    const N = Math.floor((type < 0.2 ? 90 : 170) * far), sz = THREE.MathUtils.clamp(d / 80, 0.7, 3.2);
    if (type < 0.2) {
      // Willow: slow golden streamers that hang and fall.
      for (let i = 0; i < N; i++) { const [ux, uy, uz] = sphere(); const sp = rnd(9, 13); this.spark(x, y, z, ux * sp, uy * sp + 2, uz * sp, rnd(2.6, 3.6), sz * 0.9, [1, 0.72, 0.28], 1.1, 3.2, 0.25); }
    } else if (type < 0.4) {
      // Ring.
      const tilt = rnd(-0.6, 0.6), spin = rnd(0, Math.PI);
      const R = Math.min(N, 44); // few enough stars that the ring reads as dots
      for (let i = 0; i < R; i++) { const a = (i / R) * Math.PI * 2, sp = 17; const rx = Math.cos(a), rz = Math.sin(a); this.spark(x, y, z, (rx * Math.cos(spin) - rz * Math.sin(spin)) * sp, rz * Math.sin(tilt) * sp + 1, (rx * Math.sin(spin) + rz * Math.cos(spin)) * sp * Math.cos(tilt), rnd(1.5, 2), sz, c1, 1.3, 2.5, 0); }
      for (let i = 0; i < 30 * far; i++) { const [ux, uy, uz] = sphere(); this.spark(x, y, z, ux * 6, uy * 6, uz * 6, rnd(1, 1.6), sz * 0.8, c2, 1.5, 2.5, 0.3); }
    } else {
      // Peony / chrysanthemum, sometimes two colours, sometimes with crackling glitter.
      const glitter = type > 0.8 ? 0.35 : 0;
      for (let i = 0; i < N; i++) { const [ux, uy, uz] = sphere(); const sp = rnd(14, 21) * (i % 3 === 0 ? 0.55 : 1); this.spark(x, y, z, ux * sp, uy * sp, uz * sp, rnd(1.6, 2.5), sz, i % 3 === 0 ? c2 : c1, 1.35, 3, glitter); }
      if (glitter && d < 150) for (let k = 0; k < 10; k++) this.tick(vol * 0.5, delay + 0.6 + Math.random() * 1.2);
    }
    this.spark(x, y, z, 0, 0, 0, 0.1, sz * 9, [1, 1, 0.9], 0, 0, 0); // flash
  }

  /** People close to a loud bang flinch and scold; parked cars chirp. */
  startle(x, z, radius, by) {
    for (const p of this.street.peds) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d > radius || p.combat) continue;
      p.state = 'angry'; p.timer = 2;
      if (Math.random() < 0.5) this.bubbles.say(p, pick(by === 'player' ? ['Arre baap re!', 'Kaan phat gaye!', 'Itna bada bomb?!', 'Bachhe darr gaye!'] : ['Happy Diwali!', 'Wah! Ek aur!', 'Kaan phat gaye!']), 2.2);
    }
    for (const v of this.traffic.parked) if (Math.hypot(v.x - x, v.z - z) < radius * 0.7 && Math.random() < 0.35) this.traffic.honks.push([v.x, v.z]);
  }

  // ------------------------------------------------------------------ frame
  update(dt, clock, focus, cam, walker = null) {
    this.noiseCool -= dt;
    const camD = (x, y, z) => Math.hypot(x - cam.x, y - cam.y, z - cam.z);
    let glowAt = null, glowI = 0, propN = 0;
    for (const it of this.items) {
      it.t += dt;
      const { x, y, z } = it;
      if (it.shell) {
        // A climbing shell: gravity, a spark trail, then the burst.
        it.vy -= 9.8 * dt; it.x += it.vx * dt; it.y += it.vy * dt; it.z += it.vz * dt;
        if (Math.random() < 0.8) this.spark(it.x, it.y, it.z, rnd(-0.6, 0.6), rnd(-3, -1), rnd(-0.6, 0.6), rnd(0.3, 0.6), 0.3 + camD(it.x, it.y, it.z) / 260, [1, 0.7, 0.3], 1, 4, 0);
        if (it.t >= it.fuseUp || it.vy < 1) { this.burst(it.x, it.y, it.z, cam); it.done = true; }
        continue;
      }
      if (it.t < 0) {
        // Fuse burning.
        if (propN < 24) { this.m.compose(this.v.set(x, y, z), this.q.identity(), this.s); this.props.setMatrixAt(propN++, this.m); }
        if (Math.random() < 0.5) this.spark(x, y + 0.22, z, rnd(-0.4, 0.4), rnd(0.3, 1), rnd(-0.4, 0.4), 0.25, 0.1, [1, 0.8, 0.4], 2, 3, 0);
        continue;
      }
      const d = camD(x, y, z), [vol] = this.heard(d);
      if (it.kind === 'anar') {
        const k = Math.min(1, it.t / 0.6) * Math.min(1, (6.5 - it.t) / 1.2), n = Math.round(rnd(5, 9) * k);
        for (let i = 0; i < n; i++) { const a = rnd(0, 6.28), s = rnd(0.3, 1.5); this.spark(x, y + 0.2, z, Math.cos(a) * s, rnd(5.5, 9) * (0.5 + 0.5 * k), Math.sin(a) * s, rnd(0.7, 1.2), 0.16, Math.random() < 0.8 ? [1, 0.72, 0.28] : [1, 0.95, 0.8], 0.6, 9.8, 0.2); }
        if (!it.snd) { it.snd = true; this.hiss(vol, 6.3); }
        if (propN < 24) { this.m.compose(this.v.set(x, y, z), this.q.identity(), this.s); this.props.setMatrixAt(propN++, this.m); }
        if (d < 40 && k > glowI) { glowI = k; glowAt = it; }
        if (it.t > 6.5) it.done = true;
      } else if (it.kind === 'chakri') {
        const k = Math.min(1, it.t / 0.4) * Math.min(1, (5 - it.t) / 0.8), ang = it.seed + it.t * 26;
        for (let i = 0; i < Math.round(7 * k); i++) { const a = ang + i * 2.1, s = rnd(3.5, 5.5); this.spark(x + Math.cos(a) * 0.12, y + 0.06, z + Math.sin(a) * 0.12, -Math.sin(a) * s, rnd(0.4, 1.6), Math.cos(a) * s, rnd(0.35, 0.6), 0.14, i % 2 ? [1, 0.8, 0.35] : [0.5, 0.9, 1], 1.6, 6, 0.1); }
        if (!it.snd) { it.snd = true; this.hiss(vol * 0.8, 4.8); }
        if (d < 40 && k * 0.7 > glowI) { glowI = k * 0.7; glowAt = it; }
        if (it.t > 5) it.done = true;
      } else if (it.kind === 'ladi') {
        // The fire runs along a 2.4 m string; each cracker pops with a flash.
        const fx = Math.sin(it.heading), fz = Math.cos(it.heading), along = it.t * 0.6;
        it.popT = (it.popT || 0) - dt;
        while (it.popT <= 0) {
          it.popT += rnd(0.03, 0.09);
          const o = along + rnd(-0.15, 0.15), px = x + fx * o, pz = z + fz * o;
          for (let i = 0; i < 5; i++) this.spark(px, y + 0.06, pz, rnd(-2.5, 2.5), rnd(0.5, 3.5), rnd(-2.5, 2.5), rnd(0.15, 0.35), 0.13, [1, 0.85, 0.5], 2, 9.8, 0);
          this.spark(px, y + 0.1, pz, 0, 0, 0, 0.06, 1.1, [1, 0.95, 0.8], 0, 0, 0);
          this.tick(vol * 0.9);
        }
        if (d < 40) { glowI = Math.max(glowI, 0.6 + Math.random() * 0.4); glowAt = { x: x + fx * along, y, z: z + fz * along }; }
        if (it.t > 4) it.done = true;
      } else if (it.kind === 'bomb') {
        for (let i = 0; i < 90; i++) { const [ux, uy, uz] = sphere(); const s = rnd(4, 15); this.spark(x, y + 0.15, z, ux * s, Math.abs(uy) * s, uz * s, rnd(0.25, 0.7), 0.2, [1, 0.8, 0.45], 2.5, 9.8, 0); }
        this.spark(x, y + 0.4, z, 0, 0, 0, 0.14, 9, [1, 0.95, 0.85], 0, 0, 0);
        this.bang(vol * 1.5, d / 343, 1.2);
        this.startle(x, z, 16, it.by);
        if (walker && Math.hypot(walker.pos.x - x, walker.pos.z - z) < 1.6) { walker.hitBy?.(0.03, (walker.pos.x - x) || 0.1, (walker.pos.z - z) || 0.1, 3); this.bubbles.say(walker, 'Arre! Door se, door se!', 2); }
        glowI = 2; glowAt = it;
        it.done = true;
      } else if (it.kind === 'rocket') {
        // Lift-off: the shell takes over.
        this.hiss(vol * 0.9, 1.5, true);
        const s = { kind: 'rocket', shell: true, x, y: y + 0.4, z, vx: rnd(-1.5, 1.5), vy: rnd(30, 36), vz: rnd(-1.5, 1.5), t: 0, fuseUp: rnd(1.7, 2.1), by: it.by };
        this.items.push(s);
        if (it.by === 'player') this.startle(x, z, 6, 'npc');
        it.done = true;
      }
    }
    this.items = this.items.filter((i) => !i.done);
    this.props.count = propN; this.props.instanceMatrix.needsUpdate = true;
    // One warm light for the nearest burning cracker.
    if (glowAt) { this.glow.position.set(glowAt.x, (glowAt.y || 0) + 0.8, glowAt.z); this.glow.intensity = 40 * glowI * (0.8 + Math.random() * 0.4); } else this.glow.intensity *= Math.max(0, 1 - dt * 12);

    // The city's own fireworks: sky shots over the rooftops on evenings, a few on the street.
    const evening = clock.hour >= 18.8 && clock.hour < 23.2;
    if (evening) {
      this.ambientT -= dt;
      if (this.ambientT <= 0) {
        this.ambientT = rnd(2.5, 9);
        const a = rnd(0, 6.28), r = rnd(90, 420), n = Math.random() < 0.25 ? 3 : 1;
        for (let k = 0; k < n; k++) this.shell(focus.x + Math.cos(a) * r + rnd(-12, 12), rnd(8, 30), focus.z + Math.sin(a) * r + rnd(-12, 12), rnd(0.85, 1.1));
      }
      this.streetT -= dt;
      if (this.streetT <= 0) {
        this.streetT = rnd(14, 32);
        const near = this.street.peds.filter((p) => !p.combat && Math.hypot(p.x - focus.x, p.z - focus.z) < 45 && Math.hypot(p.x - focus.x, p.z - focus.z) > 8);
        const p = pick(near);
        if (p) {
          const kind = pick(['anar', 'anar', 'chakri', 'ladi', 'rocket']);
          this.light(kind, p.x + Math.sin(p.heading) * 1.4, p.z + Math.cos(p.heading) * 1.4, 'npc', p.heading + 1.57);
          this.bubbles.say(p, pick(['Happy Diwali!', 'Phataka phodo!', 'Door hato, door hato!', 'Ek aur anar!']), 2.5);
          p.state = 'angry'; p.timer = 3; // stops and watches
        }
      }
    }
    this.mat.uniforms.uScale.value = this.renderer.domElement.height * 0.9;
    this.stepParticles(dt);
  }
}

function sphere() {
  const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
  return [s * Math.cos(a), u, s * Math.sin(a)];
}
