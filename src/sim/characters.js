import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { POSE, HOLI } from './people.js';

// Real rigged, animated characters (Quaternius "Ultimate Animated Character Pack", CC0,
// converted from FBX in the asset pipeline) for the player and the people nearest the
// camera. Everyone further away stays on the light procedural crowd (people.js), so a
// busy street costs a few skinned meshes, not hundreds. Clothes are recoloured per person
// (shirt, trousers, skin) to match the crowd's outfits.

// Ordered by priority: Low loads the first two of each, Medium four, High all.
const MODELS = {
  male: ['Casual_Male', 'Casual2_Male', 'Worker_Male', 'Casual3_Male', 'Casual_Bald', 'OldClassy_Male', 'Suit_Male', 'Chef_Male', 'Doctor_Male_Young'],
  female: ['Casual_Female', 'Casual2_Female', 'Casual3_Female', 'Worker_Female', 'OldClassy_Female', 'Suit_Female', 'Doctor_Female_Young'],
};
// The pack's clips: Idle, Walk, Punch, RecieveHit, Shoot_OneHanded, SitDown, Victory, Defeat ...
// The pack is chunky and big-headed; shrink the head (and lengthen the legs a little) so the
// bodies sit with the city's more realistic crowd.
const HEAD = 0.66, LEG = 1.14;
function shape(root) {
  const out = new Map();
  root.traverse((o) => {
    if (!o.isBone) return;
    const k = /^head$/i.test(o.name) ? [HEAD, HEAD, HEAD] : /^(upperleg|lowerleg)[^_]*$/i.test(o.name) ? [1, LEG, 1] : /^foot[^_]*$/i.test(o.name) ? [1, 1 / LEG, 1] : null;
    if (!k) return;
    o.scale.multiply(new THREE.Vector3(...k));
    out.set(o.name, o.scale.toArray());
  });
  return out;
}
const CLIP = {
  idle: /^idle$/i, walk: /^walk$/i, run: /^run$/i, punch: /^punch$/i, hit: /recieve|receive/i,
  death: /^death$/i, wave: /^victory$|wave/i, sit: /^sitdown$/i, aim: /shoot_onehanded/i, defeat: /^defeat$/i,
};

export class Characters {
  constructor(scene, base, tier, lib = null, started = Promise.resolve()) {
    this.scene = scene;
    this.poolSize = tier.name === 'High' ? 12 : tier.name === 'Medium' ? 7 : 3;
    this.templates = [];
    this.pool = [];
    this.ready = false;
    this.timer = 0;
    const loader = new GLTFLoader();
    const dir = `${base}media/models/character-quaternius-animated-pack/converted/`;
    // Only ask for models the asset manifest says were built (no 404s while they're missing).
    const files = new Set(lib?.assets?.get('character-quaternius-animated-pack')?.files || []);
    const per = tier.name === 'High' ? 9 : tier.name === 'Medium' ? 4 : 2;
    const names = [...MODELS.male.slice(0, per), ...MODELS.female.slice(0, per)].filter((n) => files.has(`models/character-quaternius-animated-pack/converted/${n}.glb`));
    if (!names.length) return;
    started.then(() => Promise.allSettled(names.map((n) => loader.loadAsync(`${dir}${n}.glb`).then((g) => ({ name: n, gltf: g, female: MODELS.female.includes(n) }))))
      .then((res) => {
        this.templates = res.filter((r) => r.status === 'fulfilled').map((r) => r.value);
        if (!this.templates.length) return;
        for (const t of this.templates) this.prepare(t);
        this.ready = true;
      }));
  }

  /** Measure the model (scale to 1.72 m) and sort its materials into clothes slots. */
  prepare(t) {
    // Measure the skinned mesh in its bind pose (bones alone mislead: the IK pole targets
    // sit well away from the body).
    t.shaped = shape(t.gltf.scene);
    t.gltf.scene.updateMatrixWorld(true);
    const box = new THREE.Box3(), tmp = new THREE.Box3();
    t.gltf.scene.traverse((o) => {
      if (o.isSkinnedMesh) { o.computeBoundingBox(); box.union(tmp.copy(o.boundingBox).applyMatrix4(o.matrixWorld)); }
      else if (o.isMesh) box.union(tmp.setFromObject(o));
    });
    const h = box.max.y - box.min.y || 1;
    t.scale = 1.7 / h;
    t.lift = -box.min.y * t.scale;
    t.clips = {};
    for (const [k, re] of Object.entries(CLIP)) t.clips[k] = t.gltf.animations.find((a) => re.test(a.name)) || null;
    t.clips.idle ||= t.gltf.animations[0];
  }

  make(t) {
    const root = cloneSkinned(t.gltf.scene);
    root.scale.setScalar(t.scale);
    const slots = { skin: [], shirt: [], pants: [], hair: [], other: [] };
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
      for (const m of [o.material].flat()) {
        // The FBX → glTF step leaves alpha at 0 on these materials; they are plain opaque cloth/skin.
        m.opacity = 1; m.transparent = false; m.alphaTest = 0; m.side = THREE.FrontSide;
        m.metalness = 0; m.roughness = Math.max(m.roughness ?? 1, 0.75);
        const n = (m.name || '').toLowerCase();
        // Recolour skin, the main top and the trousers; faces (eyes), hair, belts keep theirs.
        if (/^face/.test(n)) m.color.setHex(0x17110d); // eyes and brows (converted white)
        if (/^skin/.test(n)) slots.skin.push(m);
        else if (/^(shirt|clothes|main|top|vest)/.test(n)) slots.shirt.push(m);
        else if (/^(pants|trousers|skirt)/.test(n)) slots.pants.push(m);
        else if (/^hair/.test(n)) slots.hair.push(m);
        else slots.other.push(m);
      }
    });
    const holder = new THREE.Group();
    holder.add(root);
    holder.visible = false;
    this.scene.add(holder);
    const mixer = new THREE.AnimationMixer(root);
    const actions = {};
    for (const [k, clip] of Object.entries(t.clips)) if (clip) { actions[k] = mixer.clipAction(clip); }
    for (const k of ['death', 'sit', 'defeat']) if (actions[k]) { actions[k].setLoop(THREE.LoopOnce, 1); actions[k].clampWhenFinished = true; }
    let hand = null;
    root.traverse((o) => { if (o.isBone && /^fist\.?r$|^hand\.?r$|righthand/i.test(o.name)) hand = o; });
    // Shaped bones get their scale put back after the mixer runs (clips carry scale keys).
    const scaled = [];
    root.traverse((o) => { if (o.isBone && t.shaped.has(o.name)) scaled.push([o, ...t.shaped.get(o.name)]); });
    return { t, holder, root, mixer, actions, slots, hand, scaled, current: null, who: null };
  }

  play(c, name) {
    const a = c.actions[name] || c.actions.idle;
    if (!a || c.current === a) return;
    a.reset().fadeIn(0.2).play();
    if (c.current) c.current.fadeOut(0.2);
    c.current = a;
  }

  dress(c, p) {
    const n = p.patches?.length || 0;
    if (c.who === p && c.patchN === n && c.shirtHex === p.shirt.getHex()) return;
    c.who = p; c.patchN = n; c.shirtHex = p.shirt.getHex();
    // Holi colour on a real character: the clothes take on the colours thrown at them.
    const tint = (base) => { const col = base.clone(); for (const [, code] of p.patches || []) col.lerp(HOLI[Math.floor(code)], 0.18); return col; };
    for (const m of c.slots.skin) m.color?.copy(p.skin);
    for (const m of c.slots.shirt) m.color?.copy(tint(p.shirt));
    for (const m of c.slots.pants) m.color?.copy(tint(p.pants));
    // Black to dark-brown hair, a little grey on some.
    p.hair ??= new THREE.Color().setHSL(0.07, 0.35, Math.random() < 0.1 ? 0.2 : 0.03 + Math.random() * 0.04);
    for (const m of c.slots.hair) m.color?.copy(p.hair);
  }

  /**
   * Uniforms stay on the procedural crowd (police caps, helmets), and so do about half the
   * women in saris (the pack has no sari; the rest wear its casual clothes).
   */
  canHero(p) {
    if ((p.flags || 0) & 5) return false;
    if ((p.flags || 0) & 2) return (p.sariHero ??= Math.random() < 0.5);
    return true;
  }

  /** Pick a body for a person: female models for saris, a stable choice per person. */
  templateFor(p) {
    const female = p.flags & 2 || p.kind === 'sari';
    const list = this.templates.filter((t) => t.female === !!female);
    const pool = list.length ? list : this.templates;
    p.model ??= Math.floor(Math.random() * 1000);
    return pool[p.model % pool.length];
  }

  /**
   * Each frame: the player (if on foot) and the nearest people get a real character; the
   * procedural crowd skips them (person.hero = true).
   */
  update(dt, cam, people, player) {
    if (!this.ready) return;
    this.timer -= dt;
    const want = [];
    if (player) want.push(player);
    if (this.timer <= 0) {
      this.timer = 0.4;
      const near = people.filter((p) => !p.isPlayer && !p.noHero && this.canHero(p) && p.pose !== undefined && p.pose !== POSE.SIT && p.pose !== POSE.BAT && p.pose !== POSE.CROUCH).map((p) => [p, (p.x - cam.x) ** 2 + (p.z - cam.z) ** 2]).filter(([, d]) => d < 28 * 28).sort((a, b) => a[1] - b[1]).slice(0, this.poolSize).map(([p]) => p);
      this.chosen = near;
    }
    want.push(...(this.chosen || []));
    for (const p of people) p.hero = false;
    // Reuse bodies already showing the same person; hand out the rest.
    const free = this.pool.filter((c) => !want.includes(c.who));
    for (const p of want) {
      let c = this.pool.find((x) => x.who === p);
      if (!c) {
        const t = this.templateFor(p);
        c = free.find((x) => x.t === t) || null;
        if (c) free.splice(free.indexOf(c), 1);
        else if (this.pool.length < this.poolSize + 1) { c = this.make(t); this.pool.push(c); }
        else continue;
        c.who = null;
        this.dress(c, p);
      }
      this.dress(c, p);
      p.hero = true;
      c.holder.visible = true;
      const s = (p.scale || 1);
      c.holder.position.set(p.x, (p.y || 0) + c.t.lift * s, p.z);
      c.holder.rotation.y = p.heading;
      c.root.scale.setScalar(c.t.scale * s);
      const pose = p.pose ?? POSE.STAND;
      const moving = pose === POSE.WALK;
      const speed = p.speed ?? 1.3;
      const run = moving && speed > 3;
      const clip = pose === POSE.FALLEN ? (c.actions.death ? 'death' : 'defeat')
        : pose === POSE.PUNCH || pose === POSE.PUSH || pose === POSE.KICK || pose === POSE.FIGHT || pose === POSE.THROW ? 'punch'
        : pose === POSE.POINT ? 'aim' : pose === POSE.WAVE ? 'wave'
        : moving ? (run && c.actions.run ? 'run' : 'walk') : 'idle';
      this.play(c, clip);
      // No run clip in the pack: a fast walk cycle stands in for it.
      if (c.current && moving) c.current.timeScale = run && !c.actions.run ? Math.min(2.3, speed / 2.2) : Math.max(0.6, Math.min(1.6, speed / (run ? 4.5 : 1.4)));
      else if (c.current) c.current.timeScale = 1;
      c.mixer.update(dt);
      if (c.scaled) for (const [b, x, y, z] of c.scaled) b.scale.set(x, y, z);
      // Where the right hand is (the player's pichkari is held there).
      if (p.isPlayer && c.hand) { c.holder.updateMatrixWorld(true); (p.handPos ||= new THREE.Vector3()); c.hand.getWorldPosition(p.handPos); }
    }
    for (const c of free) { c.holder.visible = false; c.who = null; }
  }
}
