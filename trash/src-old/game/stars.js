import * as THREE from 'three';
import { POSE, FLAG, outfit } from '../sim/people.js';

// Superstar fan meets, a very Mumbai thing: crowds wait outside a film star's seafront
// villa, and at a set hour the star steps out onto a platform above the gate, waves, and
// the street goes wild. Both stars and their houses are fictional (no real names, faces,
// voices or house designs):
//   - Armaan Raizada, "the Badshah of Romance" — villa "Khwaab" on the Bandra seafront;
//     comes out every day at 11 am and 5 pm.
//   - Vikram Oberoi, "the Legend" — bungalow "Sangam" in Juhu; greets fans on Sundays
//     around 5 pm (every seventh game day).
// Drive up while a star is out for a short cutscene; the first meeting with each brings a
// gift. The cheat DARSHAN calls them out right away.

const ll = (index, lat, lon) => [(lon - index.origin.lon) * index.metresPerDegree.lon, -(lat - index.origin.lat) * index.metresPerDegree.lat];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

const SITES = [
  {
    id: 'romance', star: 'Armaan Raizada', title: 'the Badshah of Romance', villa: 'Khwaab', at: [19.0478, 72.8196],
    hours: [[11, 11.75], [17, 18.25]], sunday: false, fans: 24, wall: 0xf3efe6, trim: 0xd9c9a3, shirt: 0x15151a, pants: 0x15151a,
    when: 'every day at 11 am and 5 pm',
    waiting: ['Paanch baje aayenge!', 'Subah se khada hoon!', 'Armaan! Ek baar bahar aao!', 'Selfie ready rakho!', 'Main Nagpur se aaya hoon!'],
    cheer: ['Armaan! Armaan!', 'We love you!', 'Ek selfie, sir!', 'Idhar dekho, sir!', 'Aaaaah!'],
    lines: [
      ['Fans', 'Armaan! Armaan! We love you!'],
      ['Armaan Raizada', 'Namaste Mumbai! Aap sab ka pyaar hi meri asli kamaai hai.'],
      ['Armaan Raizada', 'Arre… woh kaali-peeli! Meri pehli film mein main bhi taxi chalata tha.'],
      ['You', 'Sir, ek autograph! Meter down hai, par dil up hai.'],
      ['Armaan Raizada', 'Yeh lo, dost. Is sheher ki shaan ho tum log.'],
    ],
    gift: [1500, 'Autographed photo of Armaan Raizada — it goes on the dashboard'],
  },
  {
    id: 'legend', star: 'Vikram Oberoi', title: 'the Legend', villa: 'Sangam', at: [19.1046, 72.8272],
    hours: [[17, 18.5]], sunday: true, fans: 30, wall: 0xcfc8ba, trim: 0x6b7a5a, shirt: 0xf2efe6, pants: 0xf2efe6,
    when: 'Sundays around 5 pm',
    waiting: ['Sunday ko aate hain, sir.', 'Har Ravivaar aata hoon main.', 'Bas ek jhalak mil jaye!', 'Chalees saal se fan hoon!'],
    cheer: ['Sir! Sir!', 'Ek jhalak!', 'Aap mahaan ho!', 'Pranaam, sir!', 'Waah!'],
    lines: [
      ['Fans', 'Sir! Sir! Ek jhalak!'],
      ['Vikram Oberoi', 'Aap sab ko mera pranaam. Itne saalon se, har Ravivaar… aap aate hain, toh main aata hoon.'],
      ['Vikram Oberoi', 'Taxi wale bhaiya! Shooting ke dinon mein aap jaise log hi mujhe studio chhodte the.'],
      ['You', 'Sir, aaj bhi chhod dunga. Meter se!'],
      ['Vikram Oberoi', 'Ha ha! Jeete raho. Yeh rakho, meri taraf se.'],
    ],
    gift: [2500, 'A signed film poster from Vikram Oberoi — framed for the flat in Powai'],
  },
];

export class Stars {
  constructor({ scene, tiles, index, people, bubbles, audio, hud, story, state, crackers, traffic }) {
    Object.assign(this, { scene, tiles, people, bubbles, audio, hud, story, state, crackers, traffic });
    this.sites = SITES.map((s) => { const [x, z] = ll(index, s.at[0], s.at[1]); return { ...s, x, z, placed: false, fansList: [], out: 0, forced: 0, sayT: 0, hinted: false }; });
    this.v = new THREE.Vector3();
  }

  /** Stars on the city map. */
  markers() { return this.sites.map((s) => ({ x: s.x, z: s.z, color: '#b8860b', icon: '★', r: 9 })); }

  /** Cheat: both stars step out now, for a couple of minutes. */
  callOut() { for (const s of this.sites) s.forced = 150; }

  /** Find a free spot beside the nearest road, build the gate and platform, gather the fans. */
  place(s) {
    // Try the roads around the site, nearest first, for a stretch with open ground beside it.
    const segs = (this.traffic.segList || []).map((q) => q.s).filter((q) => q[4] >= 2.5)
      .map((q) => [q, Math.hypot((q[0] + q[2]) / 2 - s.x, (q[1] + q[3]) / 2 - s.z)]).filter(([, d]) => d < 230).sort((a, b) => a[1] - b[1]).slice(0, 60);
    let spot = null, fx = 0, fz = 0, hw = 3;
    for (const [sg] of segs) {
      const len = Math.hypot(sg[2] - sg[0], sg[3] - sg[1]) || 1;
      if (len < 12) continue;
      fx = (sg[2] - sg[0]) / len; fz = (sg[3] - sg[1]) / len; hw = sg[4];
      for (const along of [0.5, 0.3, 0.7]) {
        for (const side of [1, -1]) {
          const nx = -fz * side, nz = fx * side;
          const px = sg[0] + (sg[2] - sg[0]) * along, pz = sg[1] + (sg[3] - sg[1]) * along;
          const cx = px + nx * (hw + 3.6), cz = pz + nz * (hw + 3.6);
          // The wall line must be clear of buildings and of other roads.
          let ok = true;
          for (const t of [-7, -3.5, 0, 3.5, 7]) if (this.tiles.hits(cx + fx * t, cz + fz * t, 0.6) || this.tiles.roadAt(cx + fx * t, cz + fz * t, 0.5, true)) ok = false;
          if (ok) { spot = { cx, cz, nx, nz, px, pz }; break; }
        }
        if (spot) break;
      }
      if (spot) break;
    }
    if (!spot) { s.tryT = 5; return false; }
    // Local frame: +z faces the road, +x runs along the wall.
    s.cx = spot.cx; s.cz = spot.cz;
    s.heading = Math.atan2(-spot.nx, -spot.nz);
    s.y = this.tiles.groundHeight(spot.cx - spot.nx * 2, spot.cz - spot.nz * 2);
    const g = new THREE.Group();
    g.position.set(s.cx, s.y, s.cz);
    g.rotation.y = s.heading;
    const wall = new THREE.MeshStandardMaterial({ color: s.wall, roughness: 0.85 });
    const trim = new THREE.MeshStandardMaterial({ color: s.trim, roughness: 0.7 });
    const iron = new THREE.MeshStandardMaterial({ color: 0x1b1b1d, roughness: 0.5, metalness: 0.6 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x1a2530, roughness: 0.1, metalness: 0.5, emissive: 0xffd9a0, emissiveIntensity: 0 });
    s.glass = glass;
    const box = (w, h, d, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; g.add(b); return b; };
    // Compound wall with a gate in the middle.
    box(5.6, 2.7, 0.35, -5.2, 1.35, 0, wall); box(5.6, 2.7, 0.35, 5.2, 1.35, 0, wall);
    box(16.4, 0.14, 0.5, 0, 2.77, 0, trim);
    for (const x of [-2.4, 2.4]) { box(0.6, 3.3, 0.6, x, 1.65, 0, trim); box(0.8, 0.18, 0.8, x, 3.35, 0, trim); }
    for (let x = -2.0; x <= 2.01; x += 0.25) box(0.05, 2.4, 0.05, x, 1.25, 0.05, iron);
    box(4.2, 0.08, 0.08, 0, 2.45, 0.05, iron); box(4.2, 0.08, 0.08, 0, 0.3, 0.05, iron);
    box(1.5, 0.42, 0.06, -3.6, 1.75, 0.2, new THREE.MeshStandardMaterial({ map: nameplate(s.villa), roughness: 0.5 }));
    // The platform the star waves from, just behind the wall, with a railing.
    box(6.4, 0.25, 2.6, 0, 3.15, -1.9, trim);
    for (const x of [-3, 3]) for (const z of [-0.8, -3]) box(0.3, 3.05, 0.3, x, 1.52, z, wall);
    box(6.4, 0.07, 0.07, 0, 4.25, -0.65, iron);
    for (let x = -3.1; x <= 3.11; x += 0.31) box(0.04, 1.0, 0.04, x, 3.75, -0.65, iron);
    // A villa front behind it: two floors, tall windows, a cornice.
    box(17, 9.5, 0.6, 0, 4.75, -6.2, wall); box(17.6, 0.35, 1.0, 0, 9.6, -6.1, trim); box(17.3, 0.25, 0.8, 0, 4.9, -6.1, trim);
    for (const y of [2.6, 7.1]) for (let x = -6.4; x <= 6.41; x += 3.2) { box(1.5, 2.6, 0.1, x, y, -5.86, glass); box(1.8, 0.16, 0.3, x, y + 1.45, -5.82, trim); }
    this.scene.add(g);
    s.group = g;
    // Collision: the wall line (people and cars can't pass through it).
    const wx = Math.cos(s.heading), wz = -Math.sin(s.heading); // local +x in world
    s.seg = [s.cx - wx * 8.2, s.cz - wz * 8.2, s.cx + wx * 8.2, s.cz + wz * 8.2];
    // Fans in front of the gate, two constables holding the line.
    const world = (lx, lz) => [s.cx + wx * lx + Math.sin(s.heading) * lz, s.cz + wz * lx + Math.cos(s.heading) * lz];
    s.world = world;
    s.fansList = [];
    for (let i = 0; i < s.fans; i++) {
      const kind = pick(['casual', 'casual', 'casual', 'sari', 'office', 'kid']);
      const [x, z] = world((Math.random() - 0.5) * 12, 1.0 + Math.random() * Math.min(4.2, hw + 1.5));
      s.fansList.push({ ...outfit(kind), kind, flags: kind === 'sari' ? FLAG.SARI : 0, scale: kind === 'kid' ? 0.7 : 0.93 + Math.random() * 0.12, x, z, y: this.tiles.groundHeight(x, z), heading: s.heading + Math.PI + (Math.random() - 0.5) * 0.5, phase: Math.random() * 6, pose: POSE.STAND, amp: 1, h: kind === 'kid' ? 1.5 : 2.1, fan: true });
    }
    for (const lx of [-4.6, 4.6]) {
      const [x, z] = world(lx, 0.9);
      s.fansList.push({ ...outfit('police'), flags: FLAG.CAP, scale: 1, x, z, y: this.tiles.groundHeight(x, z), heading: s.heading, phase: 0, pose: POSE.STAND, amp: 1, h: 2.2, cop: true });
    }
    const [sx, sz] = world(0, -1.6);
    s.person = { shirt: new THREE.Color(s.shirt), pants: new THREE.Color(s.pants), skin: new THREE.Color(0xb98a66), hair: new THREE.Color(s.id === 'legend' ? 0xb8b8b8 : 0x120d0a), flags: 0, scale: 1.03, x: sx, z: sz, y: s.y + 3.28, heading: s.heading, phase: 0, pose: POSE.WAVE, amp: 1, h: 2.2, model: s.id === 'legend' ? 5 : 3 };
    s.placed = true;
    return true;
  }

  /** The compound walls are solid. */
  hits(x, z, r) {
    for (const s of this.sites) {
      if (!s.placed || Math.abs(x - s.cx) > 12 || Math.abs(z - s.cz) > 12) continue;
      const [ax, az, bx, bz] = s.seg, dx = bx - ax, dz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
      if (Math.hypot(ax + t * dx - x, az + t * dz - z) < r + 0.25) return true;
    }
    return false;
  }

  cheerSound(vol) {
    const A = this.audio, ctx = A.ctx;
    if (!ctx || vol < 0.03) return;
    const t = ctx.currentTime, src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = A.noiseBuf(); src.loop = true; bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 0.6;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol * 0.5, t + 0.6); g.gain.linearRampToValueAtTime(vol * 0.3, t + 2.4); g.gain.linearRampToValueAtTime(0.0001, t + 4);
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 7; lg.gain.value = 300; lfo.connect(lg).connect(bp.frequency);
    src.connect(bp).connect(g).connect(A.master); src.start(t); src.stop(t + 4.1); lfo.start(t); lfo.stop(t + 4.1);
    A.whistle?.(vol * 0.5);
  }

  update(dt, clock, me, night) {
    for (const s of this.sites) {
      const d = Math.hypot(me.pos.x - s.x, me.pos.z - s.z);
      if (d > 260) { if (s.group) s.group.visible = false; continue; }
      if (!s.placed) { s.tryT = (s.tryT || 0) - dt; if (s.tryT > 0 || !this.place(s)) continue; }
      s.group.visible = true;
      s.glass.emissiveIntensity = night * 0.9;
      const dist = Math.hypot(me.pos.x - s.cx, me.pos.z - s.cz);
      // Is the star out? By the clock (and the day, for the Sunday legend), or called by cheat.
      s.forced = Math.max(0, s.forced - dt);
      const sunday = !s.sunday || this.state.s.day % 7 === 0;
      const due = sunday && s.hours.some(([a, b]) => clock.hour >= a && clock.hour < b);
      const out = due || s.forced > 0;
      if (out && !s.wasOut) {
        this.cheerSound(1 / (1 + dist / 25));
        if (night > 0.4 && this.crackers) for (let k = 0; k < 4; k++) this.crackers.shell(s.cx + (Math.random() - 0.5) * 40, 12, s.cz + (Math.random() - 0.5) * 40);
      }
      s.wasOut = out;
      // Fans: waiting quietly, or waving and shouting.
      s.sayT -= dt;
      for (const p of s.fansList) {
        p.phase += dt * (out ? 6 : 2);
        if (!p.cop) p.pose = out ? (p.cheer ??= Math.random() < 0.7 ? POSE.WAVE : POSE.POINT) : POSE.STAND;
        if (dist < 90) this.people.add(p);
      }
      if (dist < 45 && s.sayT <= 0) {
        s.sayT = out ? 0.9 + Math.random() : 3.5 + Math.random() * 3;
        const p = pick(s.fansList);
        this.bubbles.say(p, p.cop ? pick(['Peeche raho! Line mein!', 'Dhakka mat do!', 'Gaadi aage lo, saheb.']) : pick(out ? s.cheer : s.waiting), 2.2, p.cop ? 'cop' : '');
        if (out && Math.random() < 0.3) this.cheerSound(0.5 / (1 + dist / 25));
      }
      if (out) {
        const st = s.person;
        st.phase += dt * 4;
        st.pose = Math.sin(st.phase * 0.25) > -0.3 ? POSE.WAVE : POSE.STAND;
        if (dist < 90) this.people.add(st);
      }
      if (dist < 70 && !s.hinted) { s.hinted = true; this.hud.message(`"${s.villa}" — fans wait here for ${s.star}, ${s.title}. He comes out ${s.when}.`); }
      // The meeting: a short cutscene, once per appearance; a gift the first time ever.
      if (out && dist < 26 && Math.abs(me.speed || 0) < 3 && s.metAt !== this.state.s.day && !this.story.busy) {
        s.metAt = this.state.s.day;
        const t0 = performance.now();
        const [px, pz] = s.world(0, -1.6), [fx, fz] = s.world(5.5, 9), [gx, gz] = s.world(-2.5, 4.5);
        const cam = () => {
          const k = Math.min(1, (performance.now() - t0) / 9000), e = k * k * (3 - 2 * k);
          // From behind the crowd up towards the star on the platform.
          return { pos: this.v.set(fx + (gx - fx) * e, s.y + 2.2 + e * 2.4, fz + (gz - fz) * e).clone(), look: new THREE.Vector3(px, s.y + 4.3 - (1 - e) * 1.2, pz) };
        };
        this.story.playScene(s.lines, cam, () => {
          const met = (this.state.s.fanMeets ||= {});
          if (!met[s.id]) {
            met[s.id] = this.state.s.day;
            this.state.earn(s.gift[0], `Gift from ${s.star}`);
            this.state.message?.(s.star, `${s.gift[1]}. Shukriya for coming!`);
            this.hud.message(`${s.gift[1]} · +₹${s.gift[0].toLocaleString('en-IN')}`);
          } else this.hud.message(`${s.star} waved at you again!`);
          this.state.save?.();
        });
      }
    }
  }
}

/** Brass nameplate with the villa's name. */
function nameplate(text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 72;
  const g = c.getContext('2d');
  g.fillStyle = '#b08a3a'; g.fillRect(0, 0, 256, 72);
  g.strokeStyle = '#5a4312'; g.lineWidth = 6; g.strokeRect(5, 5, 246, 62);
  g.fillStyle = '#2a1f08'; g.font = 'bold 40px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 128, 38);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
