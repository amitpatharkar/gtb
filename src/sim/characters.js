import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PeopleLibrary, LOD_DIST, SLOT } from '../people/humans.js';
import { Motion, CLIP_SPEED } from '../people/motion.js';
import { POSE, HOLI, FLAG } from './people.js';

// Real people for the player and everyone near the camera: MakeHuman bodies with adult
// anatomy, faces with expressions, hair and clothes (built by scripts/people/, see
// public/people/index.json), moved by retargeted animation clips (src/people/motion.js).
// Only people further away stay on the light procedural crowd (people.js).
//
// Each body is one skinned mesh per level of detail (near with face morphs, mid, far) and
// one draw call; the person's skin tone, hair and clothes colours are uniforms of one shared
// shader program, so two dozen body templates make a crowd where no two people look alike.
// Templates suit the game's kinds of people (office, casual, worker, sari, kid, police…).

const PRELOAD = { Low: 8, Medium: 14, High: 99 };      // body templates loaded per tier
const PLAYER = 'm_casual_2';
const C = (hex) => new THREE.Color(hex);
const SHOES = [0x1a1a1a, 0x2b1d14, 0x3a2a1e, 0x6b4a32, 0xd8d4cc, 0x20242c].map(C);
// Interiors name the old pack's models; read them as hints about who a person is.
const WEAR = { oldclassy: 'old', bald: 'old', suit: 'office', casual: 'casual', casual2: 'casual', casual3: 'casual', worker: 'worker', chef: 'worker', doctor: 'office' };
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

export class Characters {
  constructor(scene, base, tier, lib = null, started = Promise.resolve()) {
    this.scene = scene;
    this.tier = tier;
    this.poolSize = tier.name === 'High' ? 30 : tier.name === 'Medium' ? 20 : 11;
    this.radius = tier.name === 'Low' ? 34 : 46;
    this.lod = LOD_DIST[tier.name] || LOD_DIST.Medium;
    this.templates = [];
    this.pool = [];
    this.ready = false;
    this.timer = 0;
    this.frame = 0;
    this.camPos = new THREE.Vector3();
    const renderer = lib?.renderer;
    if (!renderer) return;
    this.people = new PeopleLibrary(renderer, base, { msaa: true });
    started.then(() => this.load()).catch((e) => console.warn('People not loaded:', e.message));
  }

  /** Index, atlas, motion clips, then the body templates (most useful first). */
  async load() {
    const L = this.people;
    await L.init();
    await L.anims();
    const want = PRELOAD[this.tier.name] ?? 14;
    // Spread across men, women, children and ages so a small tier still has variety.
    const order = [...L.people].sort((a, b) => (hash(a.id) % 97) - (hash(b.id) % 97));
    const pickOrder = [];
    const buckets = [(p) => p.sex === 'm' && p.age >= 16, (p) => p.sex === 'f' && p.age >= 16, (p) => p.age < 16];
    const quota = [0.45, 0.45, 0.1].map((q) => Math.max(1, Math.round(q * Math.min(want, order.length))));
    buckets.forEach((test, i) => pickOrder.push(...order.filter(test).slice(0, quota[i])));
    if (!pickOrder.some((p) => p.id === PLAYER)) { const pl = L.people.find((p) => p.id === PLAYER); if (pl) pickOrder.unshift(pl); }
    const loaded = await Promise.allSettled(pickOrder.map((p) => L.template(p.id)));
    for (const r of loaded) if (r.status === 'fulfilled') { await L.clipsFor(r.value); this.prepare(r.value); this.templates.push(r.value); }

    this.ready = this.templates.length > 0;
    // The main character (the owner's chosen model, detail by tier: High = as uploaded) loads
    // after the crowd is ready; the player's body switches to him when he arrives.
    try { const h = await L.hero(this.tier.name); this.prepare(h); this.heroT = h; } catch (e) { console.warn('Main character not loaded:', e.message); }
  }

  /** Measurements a template needs: seat offset when sitting. */
  prepare(t) {
    const rest = [];
    t.scene.traverse((o) => { if (o.isBone) rest.push([o, o.position.clone(), o.quaternion.clone()]); });
    const mixer = new THREE.AnimationMixer(t.scene);
    const pelvis = t.scene.getObjectByName('pelvis');
    t.sitPelvis = 0.5;
    const sit = t.clips.get('sit');
    if (sit && pelvis) {
      const a = mixer.clipAction(sit); a.play(); mixer.setTime(sit.duration * 0.5);
      t.scene.updateMatrixWorld(true);
      t.sitPelvis = pelvis.getWorldPosition(new THREE.Vector3()).y;
      mixer.stopAllAction(); mixer.uncacheRoot(t.scene);
    }
    // Bones back to rest (the measuring pose must not leak into the template's clones).
    for (const [o, pos, q] of rest) { o.position.copy(pos); o.quaternion.copy(q); }
    t.scene.updateMatrixWorld(true);
  }

  make(t) {
    const person = t.hero ? this.people.instantiateHero(t) : this.people.instantiate(t);
    const holder = new THREE.Group();
    holder.add(person.root);
    holder.visible = false;
    this.scene.add(holder);
    const motion = new Motion(person, this.people);
    return { t, person, holder, motion, who: null, hats: {}, cap: null, swingN: -1, hitFor: 0 };
  }

  /** Pick a body template for a person (stable per person). */
  templateFor(p) {
    if (p.isPlayer) return (p._tpl = this.heroT || this.templates.find((t) => t.info.id === PLAYER) || this.templates[0]);
    if (p._tpl && this.templates.includes(p._tpl)) return p._tpl;
    const female = !!(p.flags & FLAG.SARI) || p.kind === 'sari';
    const kid = p.kind === 'kid' || (p.scale ?? 1) < 0.85;
    const hints = (p.wear || []).map((w) => WEAR[w]).filter(Boolean);
    let list = this.templates.filter((t) => (t.info.sex === 'f') === female && (kid ? t.info.age < 16 : t.info.age >= 16));
    if (!list.length) list = this.templates.filter((t) => (kid ? t.info.age < 16 : t.info.age >= 16));
    if (!list.length) list = this.templates;
    const kind = p.kind === 'cop' ? 'police' : p.kind;
    for (const h of [...hints, kind]) {
      const f = h === 'old' ? list.filter((t) => t.info.age > 55) : list.filter((t) => t.info.kinds?.includes(h));
      if (f.length) { list = f; break; }
    }
    if (p.build && !kid) { const f = list.filter((t) => t.info.build === p.build); if (f.length) list = f; }
    p.model ??= Math.floor(Math.random() * 1000);
    return (p._tpl = list[Math.abs(p.model) % list.length]);
  }

  /** Colours for this person (skin, hair, clothes; Holi colour where they've been hit). */
  dress(c, p) {
    if (c.t.hero) { c.who = p; return; }   // the main character keeps his own look
    const n = p.patches?.length || 0;
    if (c.who === p && c.patchN === n && c.shirtHex === p.shirt?.getHex()) return;
    c.who = p; c.patchN = n; c.shirtHex = p.shirt?.getHex();
    const t = c.person.tints;
    const tint = (target, base) => { target.copy(base); for (const [, code] of p.patches || []) target.lerp(HOLI[Math.floor(code)], 0.18); };
    t[SLOT.skin].copy(p.skin || C(0xa26a47));
    const old = c.t.info.age > 55;
    p.hair ??= c.t.info.palette?.hair === 'white' ? C(0xd8d4cc) : c.t.info.palette?.hair === 'grey' || (old && Math.random() < 0.5) ? C(0x8a847e) : new THREE.Color().setHSL(0.07, 0.35, Math.random() < 0.08 ? 0.12 : 0.025 + Math.random() * 0.03);
    t[SLOT.hair].copy(p.hair);
    tint(t[SLOT.top], p.shirt || C(0xdddddd));
    tint(t[SLOT.bottom], p.pants || C(0x333333));
    p.shoe ??= SHOES[Math.floor(Math.random() * SHOES.length)];
    t[SLOT.shoes].copy(p.shoe);
    tint(t[SLOT.extra], p.pants || C(0xb03a2e));
    t[SLOT.accent].setHex(0xd9a21b);
    // A police cap or a helmet; the scalp hair hides under it.
    const hat = (p.flags || 0) & FLAG.CAP ? 'cap' : (p.flags || 0) & FLAG.BERET ? 'helmet' : null;
    if (c.cap) c.cap.visible = false;
    c.cap = null;
    c.person.material.userData.u.uHideScalp.value = hat ? 1 : 0;
    const head = c.person.bones.get('head');
    if (hat && head) {
      if (!c.hats[hat]) { c.hats[hat] = makeHat(hat, c.t); head.add(c.hats[hat]); }
      c.cap = c.hats[hat];
      c.cap.visible = true;
      c.cap.material.color.copy(hat === 'cap' ? p.pants || C(0x1f2a44) : p.hatColor || (p.hatColor = new THREE.Color().setHSL(Math.random(), 0.5, 0.25)));
    }
  }

  /** The clip, its speed and the face for a person's state. */
  choose(c, p, dt) {
    const pose = p.pose ?? POSE.STAND;
    const m = c.motion;
    const speed = p.speed ?? 1.3;
    let clip = 'idle', rate = 1, expression = 'neutral', talking = false, wave = false, kick = false, once = false, restart = false;
    const fallen = pose === POSE.FALLEN, sitting = pose === POSE.SIT;
    const flinch = p.hitT > 0 && !fallen && !sitting;
    const newHit = (p.hitT || 0) > (c.hitFor || 0) + 1e-6;   // hitT jumps up on every hit, then runs down
    if (newHit) c.hitClip = Math.random() < 0.5 ? 'hitHead' : 'hitChest';
    if (fallen) { clip = 'fall'; expression = 'pain'; }
    else if (flinch) { clip = c.hitClip || 'hitChest'; expression = 'pain'; restart = newHit; } else if (pose === POSE.WALK) {
      const formal = c.t.info.kinds?.[0] === 'office';
      clip = speed > 4.3 ? 'sprint' : speed > 2.2 ? 'jog' : formal ? 'walkFormal' : 'walk';
      rate = THREE.MathUtils.clamp(speed / CLIP_SPEED[clip], 0.55, 1.8);
      if (clip !== 'walk' && clip !== 'walkFormal') expression = 'effort';
    } else if (sitting) { clip = p.talking ? 'sitTalk' : 'sit'; talking = !!p.talking; }
    else if (pose === POSE.CROUCH) clip = 'crouch';
    else if (pose === POSE.WAVE) { clip = 'idle'; wave = true; expression = 'smile'; }
    else if (pose === POSE.POINT) clip = p.isPlayer ? 'aimIdle' : 'aim';
    else if (pose === POSE.ARGUE) { clip = 'talk'; talking = true; expression = 'angry'; }
    else if (pose === POSE.FIGHT) { clip = 'jab'; rate = 0; expression = 'angry'; }
    else if (pose === POSE.PUNCH) {
      clip = ['jab', 'cross', 'hook'][(p.swingN ?? 0) % 3]; expression = 'angry';
      restart = c.swingN !== p.swingN; c.swingN = p.swingN;
    } else if (pose === POSE.KICK) { clip = 'jab'; rate = 0; kick = true; expression = 'angry'; }
    else if (pose === POSE.PUSH) { clip = 'push'; expression = 'effort'; }
    else if (pose === POSE.THROW) { clip = 'throw'; restart = c.swingN !== p.swingN; c.swingN = p.swingN; expression = 'angry'; }
    else {
      // Standing: each person has their own way of waiting.
      p.idle ??= ['idle', 'idle', 'idle', 'foldArms', 'phone', 'idle', 'talk'][Math.floor(Math.random() * 7)];
      clip = p.idle; talking = clip === 'talk' || clip === 'phone';
      if (p.isPlayer) clip = 'idle';
    }
    c.hitFor = p.hitT;
    const a = m.play(clip, { fade: fallen ? 0.12 : 0.25, speed: rate });
    if (a && rate === 0) { a.timeScale = 0; a.time = a.getClip().duration * 0.08; }   // guard: the first frames of a jab
    if (a && restart) m.restart();
    return { expression, talking, wave, kick, fallen, sitting };
  }

  /**
   * Each frame: the player (if on foot) and the people nearest the camera get a real body;
   * the procedural crowd skips them (person.hero = true).
   */
  update(dt, cam, people, player) {
    if (!this.ready) return;
    this.timer -= dt; this.frame++;
    const want = [];
    if (player) want.push(player);
    if (this.timer <= 0) {
      this.timer = 0.35;
      const R2 = this.radius * this.radius;
      this.chosen = people.filter((p) => !p.isPlayer && !p.noHero && p.pose !== undefined && p.pose !== POSE.BAT && p.pose !== POSE.PEDAL)
        .map((p) => [p, (p.x - cam.x) ** 2 + (p.z - cam.z) ** 2]).filter(([, d]) => d < R2).sort((a, b) => a[1] - b[1]).slice(0, this.poolSize).map(([p]) => p);
    }
    for (const p of this.chosen || []) if (people.includes(p)) want.push(p);
    for (const p of people) p.hero = false;
    // Reuse bodies already showing the same person; hand out the rest.
    const free = this.pool.filter((c) => !want.includes(c.who));
    let builds = 0;
    this.camPos.copy(cam);
    for (const p of want) {
      let c = this.pool.find((x) => x.who === p);
      // The player changes body once the main character has loaded.
      if (c && p.isPlayer && c.t !== this.templateFor(p)) { c.holder.visible = false; c.who = null; c.motion.stop(); free.push(c); c = null; }
      if (!c) {
        const t = this.templateFor(p);
        c = free.find((x) => x.t === t) || null;
        if (c) free.splice(free.indexOf(c), 1);
        else if (builds < 2 && this.pool.length < this.poolSize + 1) { c = this.make(t); this.pool.push(c); builds++; }
        else if (builds < 2 && free.length) {
          // Swap a free body of another template for one of this template.
          const old = free.pop();
          this.scene.remove(old.holder); old.motion.stop(); old.person.material.dispose();
          this.pool.splice(this.pool.indexOf(old), 1);
          c = this.make(t); this.pool.push(c); builds++;
        } else continue;
        c.who = null; c.motion.stop();
      }
      this.dress(c, p);
      p.hero = true;
      this.place(c, p, dt, cam);
    }
    for (const c of free) { if (c.holder.visible) { c.holder.visible = false; c.who = null; c.motion.stop(); } }
  }

  place(c, p, dt, cam) {
    const t = c.t;
    const s = p.isPlayer ? 1 : t.info.age < 16 ? 1 : 1 + ((p.scale ?? 1) - 0.99) * 0.35;   // real heights; a little spread
    const st = this.choose(c, p, dt);
    c.holder.visible = true;
    c.holder.scale.setScalar(s);
    c.holder.rotation.set(0, p.heading, 0);
    let y = p.y || 0;
    if (st.sitting) y = (p.y || 0) + 0.42 - (t.sitPelvis - 0.1) * s;   // callers give the seat height minus 0.42
    c.holder.position.set(p.x, y, p.z);
    // Level of detail by distance; far bodies step their motion every other frame.
    const d = Math.hypot(p.x - cam.x, (p.y || 0) + 1.5 - cam.y, p.z - cam.z);
    c.person.setLod(d < this.lod[0] || p.isPlayer ? 0 : d < this.lod[1] ? 1 : 2);
    const far = d > 24 && !p.isPlayer;
    const step = !far || (this.frame & 1) === 0;
    c.holder.updateMatrixWorld(true);
    // Who they look at: the camera if it's near and in front, else ahead.
    const lookCam = d < 9 && !p.isPlayer && !st.fallen;
    c.motion.update(dt, {
      skipMixer: !step, dtMixer: far ? dt * 2 : dt, heading: p.heading, expression: st.expression, talking: st.talking,
      wave: st.wave, kick: st.kick, lookAt: lookCam ? cam : null, noHead: st.fallen || d > 30, hair: d < 18,
    });
    // Where the right hand is (the player's pichkari is held there).
    if (p.isPlayer) { const hand = c.person.bones.get('hand_r'); if (hand) { (p.handPos ||= new THREE.Vector3()); hand.getWorldPosition(p.handPos); } }
  }
}

/** A peaked cap (police, drivers) or a helmet, in metres on the head bone (+Y up the head). */
function makeHat(kind, t) {
  const r = 0.105;
  let geo;
  if (kind === 'cap') {
    const crown = new THREE.CylinderGeometry(r * 0.98, r * 1.03, 0.07, 16).translate(0, 0.165, 0.005);
    const peak = new THREE.CylinderGeometry(r * 0.8, r * 0.8, 0.008, 14, 1, false, -0.9, 1.8).translate(0, 0.14, 0.07);
    geo = mergeGeometries([crown, peak]);
  } else geo = new THREE.SphereGeometry(r * 1.18, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.6).translate(0, 0.1, 0.0);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ roughness: kind === 'cap' ? 0.9 : 0.35 }));
  m.castShadow = true;
  return m;
}
