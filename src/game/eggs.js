import * as THREE from 'three';
import { POSE, FLAG, outfit } from '../sim/people.js';
import { Y } from '../world/levels.js';

// Things to find. Two kinds:
//  - "Sone ki cutting": golden cutting-chai glasses at famous spots all over the map
//    (hidden-package style). Walk or drive through one to collect it; each pays a little,
//    every eighth pays a lot, and finding them all pays best.
//  - Easter eggs: one-off discoveries with something to see — the Powai Lake crocodile,
//    the Old Woman's Shoe, the talkies that has shown one film for thirty years, flamingos
//    at Sewri, a wax taxi at the hilltop church, a tycoon's tower with a stern guard, and
//    roses for a little Gandhigiri (G with a rose in hand ends a fight peacefully).
// Found things are saved in state.s.eggs.

const ll = (index, lat, lon) => [(lon - index.origin.lon) * index.metresPerDegree.lon, -(lat - index.origin.lat) * index.metresPerDegree.lat];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

const CHAI = [
  ['Gateway of Indiyaa', 18.9219, 72.8346], ['Colaba Causeway', 18.9227, 72.8317], ['Sassoon Dock', 18.9118, 72.8265], ['Kala Ghoda', 18.9280, 72.8322],
  ['Flora Fountain', 18.9323, 72.8316], ['Oval Maidan', 18.9290, 72.8280], ['Chai Terminus', 18.9400, 72.8355], ['Crawford Market', 18.9475, 72.8340],
  ['the cricket stadium', 18.9388, 72.8258], ['Marine Drive', 18.9440, 72.8232], ['Girgaum Chowpatty', 18.9548, 72.8125], ['Hanging Gardens', 18.9565, 72.8052],
  ['Mani Bhavan', 18.9598, 72.8115], ['Chor-Chor Bazaar', 18.9594, 72.8299], ['Minaar Gali', 18.9545, 72.8331], ['the ferry wharf', 18.9568, 72.8495],
  ['Haji Wali Juice Corner', 18.9784, 72.8112], ['the racecourse', 18.9856, 72.8187], ['Dhulai Ghat', 18.9820, 72.8247], ['the zoo gate', 18.9777, 72.8349],
  ['Worli Sea Face', 19.0090, 72.8150], ['the Tuesday temple', 19.0169, 72.8304], ['Shivaji Park', 19.0267, 72.8384], ['Dadar flower market', 19.0119, 72.8371],
  ['Kumbharwada, Dharavi', 19.0444, 72.8555], ['Bandra Fort', 19.0421, 72.8186], ['the hilltop church, Bandra', 19.0466, 72.8226], ['Carter Road', 19.0650, 72.8228],
  ['Juhu Beach', 19.0980, 72.8265], ['Powai Lake', 19.1241, 72.8977], ['the Sewri mudflats', 18.9956, 72.8615], ['the airport road', 19.0990, 72.8740],
];

export class Eggs {
  constructor({ scene, tiles, index, state, hud, bubbles, people, audio, clock, damage }) {
    Object.assign(this, { scene, tiles, state, hud, bubbles, people, audio, clock, damage });
    const s = (state.s.eggs ||= { chai: [], found: {}, roses: 0 });
    s.chai ||= []; s.found ||= {}; s.roses ||= 0;
    this.t = 0;
    // Golden glasses: instanced, with a soft beam so they can be spotted from down the street.
    this.spots = CHAI.map(([name, lat, lon], i) => { const [x, z] = ll(index, lat, lon); return { i, name, at: [x, z] }; });
    const glass = new THREE.CylinderGeometry(0.2, 0.14, 0.42, 14).translate(0, 0.21, 0);
    this.glasses = new THREE.InstancedMesh(glass, new THREE.MeshStandardMaterial({ color: 0xffc83a, emissive: 0xffa000, emissiveIntensity: 1.4, metalness: 0.9, roughness: 0.25 }), 8);
    this.beams = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.12, 14, 8, 1, true).translate(0, 7, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc040).multiplyScalar(1.6), transparent: true, opacity: 0.22, depthWrite: false }), 8);
    for (const m of [this.glasses, this.beams]) { m.count = 0; m.frustumCulled = false; scene.add(m); }
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.v = new THREE.Vector3(); this.one = new THREE.Vector3(1, 1, 1);
    // Easter eggs: built when the player first comes near.
    const E = (id, name, lat, lon, o) => ({ id, name, at: ll(index, lat, lon), ...o });
    this.eggs = [
      E('croc', 'Powai ka magarmach', 19.1262, 72.9042, { build: (e) => this.buildCroc(e), in: 'water', reach: 30, reward: 1000, text: 'Easter egg: the crocodile of Powai Lake is real. Do not feed him vada pav.' }),
      E('shoe', 'The Old Woman\'s Shoe', 18.9568, 72.8049, { build: (e) => this.buildShoe(e), reach: 22, reward: 500, text: 'Easter egg: the Old Woman\'s Shoe. Generations of children have climbed it.' }),
      E('talkies', 'Mahaan Mandir Talkies', 18.9711, 72.8221, { build: (e) => this.buildMarquee(e), reach: 28, reward: 500, text: 'Easter egg: Mahaan Mandir Talkies — the same film, every day, for thirty years. Houseful.' }),
      E('flamingos', 'Sewri flamingos', 18.9950, 72.8640, { build: (e) => this.buildFlamingos(e), in: 'water', reach: 90, reward: 500, text: 'Easter egg: the flamingos of Sewri, pink all the way to the horizon.' }),
      E('wax', 'Wax taxi', 19.0466, 72.8226, { build: (e) => this.buildStall(e, 0xf2efe6, 'मोम की गाड़ी · WAX TAXI ₹50'), reach: 9, daily: true, act: (e, c) => this.waxTaxi(e, c) }),
      E('roses', 'Gandhigiri roses', 18.9598, 72.8115, { build: (e) => this.buildStall(e, 0xc0392b, 'गुलाब · ROSES FOR PEACE'), reach: 9, daily: true, act: () => this.takeRoses() }),
      E('tower', 'Seth Dhanraj Tower', 18.9681, 72.8095, { build: (e) => this.buildGuard(e), reach: 16, reward: 0, text: 'Easter egg: Seth Dhanraj Tower. Twenty-seven floors, one family, and you may use the service gate.' }),
    ];
  }

  get s() { return this.state.s.eggs; }
  get chaiFound() { return this.s.chai.length; }
  get eggsFound() { return Object.keys(this.s.found).length; }

  /** Spots close enough to "smell" (shown on the city map), and nothing else: they are hidden. */
  markers(me) {
    return this.spots.filter((p) => !this.s.chai.includes(p.i) && (this.reveal || Math.hypot(p.at[0] - me.pos.x, p.at[1] - me.pos.z) < 450)).map((p) => ({ x: p.at[0], z: p.at[1], color: '#c9951a', icon: '☕', r: 7 }));
  }

  chime() {
    const ctx = this.audio.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    for (const [f, d] of [[880, 0], [1320, 0.09], [1760, 0.18]]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + d); g.gain.linearRampToValueAtTime(0.16, t + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0008, t + d + 0.5);
      o.connect(g).connect(this.audio.master); o.start(t + d); o.stop(t + d + 0.55);
    }
  }

  /** Put a point on the nearest road (or leave it) once the map there has loaded. */
  snap(o, me, mode) {
    if (o.snapped || Math.hypot(me.pos.x - o.at[0], me.pos.z - o.at[1]) > 280) return o.snapped;
    const [x, z] = o.at;
    if (mode === 'water') {
      // The nearest water a little way off the shore.
      for (let r = 0; r < 160; r += 8) for (let a = 0; a < 12; a++) {
        const px = x + Math.cos(a * 0.524) * r, pz = z + Math.sin(a * 0.524) * r;
        if (!this.tiles.walkable(px, pz) && !this.tiles.walkable(px + 6, pz) && !this.tiles.walkable(px - 6, pz) && !this.tiles.walkable(px, pz + 6)) { o.at = [px, pz]; return (o.snapped = true); }
      }
      return false;
    }
    const r = this.tiles.roadAt(x, z, 120, true) || this.tiles.roadAt(x, z, 500, true);
    if (!r) return false;
    const s = this.tiles.segment(r.tile, r.index), dx = s[2] - s[0], dz = s[3] - s[1], l2 = dx * dx + dz * dz || 1, len = Math.sqrt(l2);
    const k = Math.max(0.15, Math.min(0.85, ((x - s[0]) * dx + (z - s[1]) * dz) / l2));
    o.road = { x: s[0] + dx * k, z: s[1] + dz * k, fx: dx / len, fz: dz / len, hw: s[4] };
    if (mode === 'side') {
      // Beside the road, on whichever side is free.
      for (const side of [1, -1]) {
        const px = o.road.x - o.road.fz * side * (o.road.hw + 3.2), pz = o.road.z + o.road.fx * side * (o.road.hw + 3.2);
        if (!this.tiles.hits(px, pz, 1.5)) { o.at = [px, pz]; o.face = Math.atan2(o.road.x - px, o.road.z - pz); return (o.snapped = true); }
      }
      return false;
    }
    o.at = [o.road.x, o.road.z];
    return (o.snapped = true);
  }

  // ------------------------------------------------------------------ easter egg builders
  group(e, y = 0) {
    const g = new THREE.Group();
    g.position.set(e.at[0], y, e.at[1]);
    if (e.face !== undefined) g.rotation.y = e.face;
    this.scene.add(g);
    e.group = g;
    return g;
  }

  mesh(g, geo, color, x, y, z, opts = {}) {
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: opts.rough ?? 0.8, ...opts.mat }));
    m.position.set(x, y, z);
    if (opts.rot) m.rotation.set(...opts.rot);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
    return m;
  }

  buildCroc(e) {
    const g = this.group(e, Y.SEA - 0.05), c = 0x4a5a32;
    this.mesh(g, new THREE.CapsuleGeometry(0.42, 2.2, 6, 12).rotateX(Math.PI / 2), c, 0, 0.1, 0);                          // body
    this.mesh(g, new THREE.ConeGeometry(0.34, 2.4, 8).rotateX(-Math.PI / 2), c, 0, 0.08, -2.5);                            // tail
    e.head = new THREE.Group(); e.head.position.set(0, 0.16, 1.4); g.add(e.head);
    this.mesh(e.head, new THREE.BoxGeometry(0.62, 0.2, 1.3), c, 0, 0.1, 0.65);                                             // upper jaw
    e.jaw = this.mesh(e.head, new THREE.BoxGeometry(0.56, 0.12, 1.2), 0x5c6b3c, 0, -0.06, 0.6);                            // lower jaw
    for (const s of [-1, 1]) {
      this.mesh(e.head, new THREE.SphereGeometry(0.09, 8, 6), 0xd8c020, s * 0.2, 0.26, 0.12, { mat: { emissive: 0x443800 } }); // eyes
      for (let k = 0; k < 5; k++) this.mesh(e.head, new THREE.ConeGeometry(0.03, 0.09, 5), 0xf2f2e6, s * 0.26, 0.0, 0.25 + k * 0.22, { rot: [Math.PI, 0, 0] }); // teeth
      for (const z of [0.8, -0.9]) this.mesh(g, new THREE.BoxGeometry(0.5, 0.14, 0.3), c, s * 0.55, -0.05, z);             // legs
    }
    for (let k = 0; k < 9; k++) this.mesh(g, new THREE.ConeGeometry(0.07, 0.14, 4), 0x3c4a28, 0, 0.55, -1.2 + k * 0.3);    // back ridges
    g.rotation.y = Math.random() * 6.28;
  }

  buildShoe(e) {
    const g = this.group(e, Y.KERB), red = 0x9c3b22, tan = 0xc9a26b;
    this.mesh(g, new THREE.BoxGeometry(3.6, 0.5, 7.6), 0x3a2a1c, 0, 0.25, 0);                                             // sole
    this.mesh(g, new THREE.CapsuleGeometry(1.7, 3.6, 6, 14).rotateX(Math.PI / 2), red, 0, 1.7, 0.6, { rot: [0, 0, 0] });   // foot
    this.mesh(g, new THREE.CylinderGeometry(1.55, 1.75, 4.2, 16), red, 0, 4.0, -1.9);                                      // ankle tower
    this.mesh(g, new THREE.ConeGeometry(2.0, 1.6, 16), tan, 0, 6.9, -1.9);                                                 // roof
    this.mesh(g, new THREE.BoxGeometry(1.0, 1.9, 0.2), 0x2a1a10, 0, 1.45, 3.95);                                           // door in the toe
    for (const [x, y, z] of [[1.56, 4.4, -1.9], [-1.56, 4.4, -1.9], [0, 4.6, -0.36]]) this.mesh(g, new THREE.BoxGeometry(0.7, 0.9, 0.25), 0x1c2a34, x, y, z, { rot: [0, x ? Math.PI / 2 : 0, 0] });
    for (let k = 0; k < 5; k++) this.mesh(g, new THREE.BoxGeometry(1.9, 0.12, 0.12), 0xf2efe6, 0, 3.1 + Math.abs(2 - k) * 0.08, 1.4 - k * 0.55, { rot: [0, k % 2 ? 0.25 : -0.25, 0] }); // laces
    g.rotation.y = e.face ?? 0;
  }

  buildMarquee(e) {
    const g = this.group(e, Y.KERB);
    const c = document.createElement('canvas'); c.width = 1024; c.height = 384;
    const x = c.getContext('2d');
    x.fillStyle = '#7a1420'; x.fillRect(0, 0, 1024, 384);
    x.strokeStyle = '#f2c94c'; x.lineWidth = 14; x.strokeRect(12, 12, 1000, 360);
    x.textAlign = 'center'; x.fillStyle = '#f2c94c'; x.font = 'bold 74px Georgia, serif'; x.fillText('महान मंदिर TALKIES', 512, 96);
    x.fillStyle = '#fff'; x.font = 'bold 96px Georgia, serif'; x.fillText('PYAAR KI TRAIN', 512, 208);
    x.fillStyle = '#ffd9a0'; x.font = 'italic 52px Georgia, serif'; x.fillText('30th glorious year · daily 11:30 · HOUSEFUL', 512, 300);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    this.mesh(g, new THREE.BoxGeometry(8, 3, 0.25), 0xffffff, 0, 5.6, 0, { mat: { map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.35 } });
    for (const sx of [-3.4, 3.4]) this.mesh(g, new THREE.BoxGeometry(0.3, 5.6, 0.3), 0x3a3a3e, sx, 2.8, 0);
    e.bulbs = [];
    for (let k = 0; k < 16; k++) e.bulbs.push(this.mesh(g, new THREE.SphereGeometry(0.09, 8, 6), 0xffe08a, -3.75 + k * 0.5, 7.2, 0.16, { mat: { emissive: 0xffc040, emissiveIntensity: 2 } }));
  }

  buildFlamingos(e) {
    const g = this.group(e, Y.SEA);
    const body = new THREE.SphereGeometry(0.22, 8, 6).scale(1, 0.75, 1.5), leg = new THREE.CylinderGeometry(0.012, 0.012, 0.75, 4), neck = new THREE.CylinderGeometry(0.03, 0.035, 0.55, 5), head = new THREE.SphereGeometry(0.07, 6, 5);
    const pink = new THREE.MeshStandardMaterial({ color: 0xf29bb0, roughness: 0.8 }), dark = new THREE.MeshStandardMaterial({ color: 0xd0607a, roughness: 0.8 });
    const N = 70, parts = [[body, pink, 0, 0.85, 0, 0], [leg, dark, 0.05, 0.38, 0, 0], [leg, dark, -0.05, 0.38, 0.03, 0], [neck, pink, 0, 1.2, 0.3, 0.5], [head, pink, 0, 1.45, 0.46, 0]];
    for (const [geo, mat, x, y, z, tilt] of parts) {
      const im = new THREE.InstancedMesh(geo, mat, N);
      for (let i = 0; i < N; i++) {
        const a = (i * 2.399) % 6.283, r = 4 + Math.sqrt(i) * 3.4, h = (i * 1.7) % 6.283, sc = 0.9 + ((i * 37) % 10) / 40;
        this.q.setFromEuler(new THREE.Euler(tilt, h, 0, 'YXZ'));
        const ox = x * Math.cos(h) + z * Math.sin(h), oz = -x * Math.sin(h) + z * Math.cos(h);
        this.m.compose(this.v.set(Math.cos(a) * r + ox * sc, y * sc - 0.15, Math.sin(a) * r + oz * sc), this.q, new THREE.Vector3(sc, sc, sc));
        im.setMatrixAt(i, this.m);
      }
      im.frustumCulled = false;
      g.add(im);
    }
  }

  /** A small stall with a banner and its keeper. */
  buildStall(e, color, text) {
    const g = this.group(e, Y.KERB);
    this.mesh(g, new THREE.BoxGeometry(1.8, 0.9, 0.8), 0x8a6a3c, 0, 0.45, 0);
    const c = document.createElement('canvas'); c.width = 512; c.height = 96;
    const x = c.getContext('2d'); x.fillStyle = `#${color.toString(16).padStart(6, '0')}`; x.fillRect(0, 0, 512, 96);
    x.fillStyle = color === 0xf2efe6 ? '#7a1420' : '#fff'; x.font = 'bold 40px system-ui, sans-serif'; x.textAlign = 'center'; x.fillText(text, 256, 62);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    this.mesh(g, new THREE.BoxGeometry(2.0, 0.4, 0.05), 0xffffff, 0, 2.25, 0, { mat: { map: tex } });
    for (const sx of [-0.95, 0.95]) this.mesh(g, new THREE.CylinderGeometry(0.03, 0.03, 2.4, 6), 0x555555, sx, 1.2, 0);
    // Wares on the table: little wax taxis, or bunches of roses.
    for (let k = 0; k < 6; k++) {
      if (color === 0xf2efe6) { this.mesh(g, new THREE.BoxGeometry(0.2, 0.09, 0.1), 0x111111, -0.6 + k * 0.24, 0.95, 0.1); this.mesh(g, new THREE.BoxGeometry(0.12, 0.05, 0.09), 0xf2c200, -0.6 + k * 0.24, 1.02, 0.1); }
      else this.mesh(g, new THREE.SphereGeometry(0.07, 6, 5), 0xd0182a, -0.6 + k * 0.24, 1.0, 0.1 + (k % 2) * 0.12);
    }
    const look = outfit(color === 0xf2efe6 ? 'sari' : 'casual');
    e.person = { ...look, flags: color === 0xf2efe6 ? FLAG.SARI : 0, scale: 1, x: e.at[0] - Math.sin(e.face || 0) * 0.9, z: e.at[1] - Math.cos(e.face || 0) * 0.9, y: Y.KERB, heading: e.face || 0, phase: 0, pose: POSE.STAND, amp: 1, h: 2.1 };
  }

  buildGuard(e) {
    this.group(e, Y.KERB);
    e.person = { ...outfit('police'), shirt: new THREE.Color(0x1d2a44), pants: new THREE.Color(0x1d2a44), flags: FLAG.CAP, scale: 1.04, x: e.at[0], z: e.at[1], y: Y.KERB, heading: e.face || 0, phase: 0, pose: POSE.STAND, amp: 1, h: 2.2 };
    e.lines = ['Service gate se aao.', 'Photo allowed nahi hai.', 'Seth ji so rahe hain. Sattaaisvi manzil pe.', 'Gaadi yahan mat lagao.'];
  }

  waxTaxi(e, ctx) {
    if (!this.state.canAfford(50)) { this.hud.message('A wax taxi costs ₹50. Even blessings have a price.'); return false; }
    this.state.pay(50, 'Wax taxi offering');
    ctx.player.condition = 1; this.damage?.repair();
    this.bubbles.say(e.person, 'God bless your gaadi, son.', 3);
    this.hud.message('You offered a wax taxi at the hilltop church: the taxi feels brand new. (Once a day.)');
    this.chime();
    return true;
  }

  takeRoses() {
    this.s.roses = 3;
    this.hud.message('Three roses for Gandhigiri: in a fight, press G to offer one instead of an insult.');
    this.chime();
    return true;
  }

  /** In a fight with a rose in hand: the opponent melts. Returns true if a rose was given. */
  useRose(foe, say) {
    if (!foe || !(this.s.roses > 0)) return false;
    this.s.roses--;
    say(foe, pick(['Arre… gulaab? Sorry bhai, galti ho gayi.', 'Tu toh dil jeet gaya yaar.', 'Gandhigiri! Chal, chai pilata hoon.']));
    this.hud.message(`Gandhigiri: the fight is over. Roses left: ${this.s.roses}`);
    this.chime();
    return true;
  }

  found(e) {
    this.s.found[e.id] = this.state.s.day || 1;
    if (e.reward) this.state.earn(e.reward, `Found: ${e.name}`);
    this.hud.message(`${e.text} (${this.eggsFound}/${this.eggs.length} easter eggs${e.reward ? ` · +₹${e.reward}` : ''})`);
    this.chime();
    this.state.save?.();
  }

  // ------------------------------------------------------------------ frame
  update(dt, ctx) {
    const me = ctx.onFoot ? ctx.walker : ctx.player;
    this.t += dt;
    // Golden cutting chai.
    let n = 0;
    for (const p of this.spots) {
      if (this.s.chai.includes(p.i)) continue;
      const d = Math.hypot(me.pos.x - p.at[0], me.pos.z - p.at[1]);
      if (d > 300) continue;
      this.snap(p, me);
      if (d < 3.4 && p.snapped) {
        this.s.chai.push(p.i);
        const c = this.chaiFound, total = this.spots.length;
        let pay = 300, extra = '';
        if (c === total) { pay += 25000; extra = ' — ALL FOUND! Mumbai ka asli chai-baaz. +₹25,000'; }
        else if (c % 8 === 0) { pay += 4000; extra = ` — ${c} glasses! Bonus +₹4,000`; }
        this.state.earn(pay, 'Golden cutting chai');
        this.hud.message(`☕ Golden cutting chai ${c}/${total}: ${p.name}${extra || ' · +₹300'}`);
        this.chime();
        this.state.save?.();
        continue;
      }
      if (n < 8 && d < 220) {
        const y = this.tiles.groundHeight(p.at[0], p.at[1]) + 0.9 + Math.sin(this.t * 2.4 + p.i) * 0.14;
        this.q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, this.t * 1.8 + p.i);
        this.m.compose(this.v.set(p.at[0], y, p.at[1]), this.q, this.one);
        this.glasses.setMatrixAt(n, this.m); this.beams.setMatrixAt(n, this.m);
        n++;
      }
    }
    this.glasses.count = this.beams.count = n;
    this.glasses.instanceMatrix.needsUpdate = this.beams.instanceMatrix.needsUpdate = true;

    // Easter eggs.
    for (const e of this.eggs) {
      const d0 = Math.hypot(me.pos.x - e.at[0], me.pos.z - e.at[1]);
      if (d0 > 320) { if (e.group) e.group.visible = false; continue; }
      if (!e.group) {
        if (!this.snap(e, me, e.in === 'water' ? 'water' : 'side')) continue;
        e.build(e);
      }
      e.group.visible = true;
      const d = Math.hypot(me.pos.x - e.at[0], me.pos.z - e.at[1]);
      if (e.person) { e.person.phase += dt * 2; e.person.pose = d < 12 ? POSE.WAVE : POSE.STAND; if (d < 120) this.people.add(e.person); }
      if (e.id === 'croc') {
        // He drifts; when someone comes close he lifts his head and opens up.
        const k = THREE.MathUtils.clamp(1 - (d - 8) / 22, 0, 1);
        e.group.position.y = Y.SEA - 0.12 + Math.sin(this.t * 0.8) * 0.04 + k * 0.1;
        e.head.rotation.x = -0.25 * k; e.jaw.rotation.x = 0.5 * k * (0.6 + 0.4 * Math.sin(this.t * 3));
        e.group.rotation.y += dt * 0.05;
      }
      if (e.bulbs) e.bulbs.forEach((b, i) => { b.material.emissiveIntensity = (Math.floor(this.t * 4) + i) % 3 === 0 ? 3 : 0.4; });
      if (e.lines && d < e.reach && (e.sayT = (e.sayT || 0) - dt) <= 0) { e.sayT = 4.5; this.bubbles.say(e.person, pick(e.lines), 3, 'cop'); }
      if (d < e.reach && Math.abs(ctx.player.speed) < 6) {
        if (e.act) {
          // Things you can do once a day.
          if (e.day !== this.state.s.day && Math.abs(ctx.player.speed) < 1.5 && e.act(e, ctx)) { e.day = this.state.s.day; if (!this.s.found[e.id]) { this.s.found[e.id] = e.day; this.state.save?.(); } }
        } else if (!this.s.found[e.id]) this.found(e);
      }
    }
  }
}
