import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { POSE, HOLI } from './people.js';

// Real rigged, animated characters (Quaternius "Ultimate Animated Character Pack", CC0,
// converted from FBX in the asset pipeline) for the player and the people nearest the
// camera. Everyone further away stays on the light procedural crowd (people.js), so a
// busy street costs a few skinned meshes, not hundreds. Clothes are recoloured per person
// (shirt, trousers, skin) to match the crowd's outfits.

const MODELS = {
  male: ['Casual_Male', 'Casual2_Male', 'Casual3_Male', 'Worker_Male', 'OldClassy_Male', 'Suit_Male'],
  female: ['Casual_Female', 'Casual2_Female', 'Casual3_Female', 'OldClassy_Female', 'Suit_Female'],
};
const CLIP = {
  idle: /^(idle|idle_neutral|standing)$|idle/i, walk: /^walk$|walk(?!_carry)/i, run: /^run$|run(?!_carry)/i,
  punch: /punch|attack|sword/i, hit: /recieve|receive|hit/i, death: /death|dead|die/i, wave: /wave|victory|yes/i, sit: /sit/i,
};

export class Characters {
  constructor(scene, base, tier, lib = null) {
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
    const names = [...MODELS.male, ...MODELS.female].filter((n) => files.has(`models/character-quaternius-animated-pack/converted/${n}.glb`));
    if (!names.length) return;
    Promise.allSettled(names.map((n) => loader.loadAsync(`${dir}${n}.glb`).then((g) => ({ name: n, gltf: g, female: MODELS.female.includes(n) }))))
      .then((res) => {
        this.templates = res.filter((r) => r.status === 'fulfilled').map((r) => r.value);
        if (!this.templates.length) return;
        for (const t of this.templates) this.prepare(t);
        this.ready = true;
      });
  }

  /** Measure the model (scale to 1.72 m) and sort its materials into clothes slots. */
  prepare(t) {
    const box = new THREE.Box3().setFromObject(t.gltf.scene);
    const h = box.max.y - box.min.y || 1;
    t.scale = 1.72 / h;
    t.lift = -box.min.y * t.scale;
    t.clips = {};
    for (const [k, re] of Object.entries(CLIP)) t.clips[k] = t.gltf.animations.find((a) => re.test(a.name)) || null;
    t.clips.idle ||= t.gltf.animations[0];
  }

  make(t) {
    const root = cloneSkinned(t.gltf.scene);
    root.scale.setScalar(t.scale);
    const slots = { skin: [], shirt: [], pants: [], other: [] };
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
      for (const m of [o.material].flat()) {
        const n = (m.name || '').toLowerCase();
        if (/skin|face|hand|head/.test(n)) slots.skin.push(m);
        else if (/shirt|top|jacket|coat|shirt|tshirt|body|suit|dress|apron/.test(n)) slots.shirt.push(m);
        else if (/pant|trouser|leg|jean|skirt|short/.test(n)) slots.pants.push(m);
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
    if (actions.death) { actions.death.setLoop(THREE.LoopOnce, 1); actions.death.clampWhenFinished = true; }
    return { t, holder, root, mixer, actions, slots, current: null, who: null };
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
      const near = people.filter((p) => !p.isPlayer && !p.noHero && p.pose !== undefined && p.pose !== POSE.SIT).map((p) => [p, (p.x - cam.x) ** 2 + (p.z - cam.z) ** 2]).filter(([, d]) => d < 28 * 28).sort((a, b) => a[1] - b[1]).slice(0, this.poolSize).map(([p]) => p);
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
      c.holder.position.set(p.x, (p.y || 0) + c.t.lift, p.z);
      c.holder.rotation.y = p.heading;
      const s = (p.scale || 1);
      c.root.scale.setScalar(c.t.scale * s);
      const pose = p.pose ?? POSE.STAND;
      const moving = pose === POSE.WALK;
      const speed = p.speed ?? 1.3;
      this.play(c, pose === POSE.FALLEN ? 'death' : pose === POSE.PUNCH || pose === POSE.PUSH || pose === POSE.KICK ? 'punch' : pose === POSE.WAVE ? 'wave' : pose === POSE.SIT ? 'sit' : moving ? (speed > 3 ? 'run' : 'walk') : 'idle');
      if (c.current && moving) c.current.timeScale = Math.max(0.6, Math.min(1.6, speed / (speed > 3 ? 4.5 : 1.4)));
      c.mixer.update(dt);
    }
    for (const c of free) { c.holder.visible = false; c.who = null; }
  }
}
