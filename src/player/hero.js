// The main character's body: "Indian Man In Casuals" by Pixel_Monster (CC BY 4.0), built by
// scripts/people/build-hero.mjs into public/people/hero/ with 42 motion clips retargeted onto
// his own skeleton (same rest pose as the body, so clips play as they are, normal blending).
//
// Animation: every clip has a weight that eases towards its target each frame, so changes never
// pop. Walking, jogging and sprinting are one blend space: all three run in step (same phase) and
// their weights and playback rates follow the real ground speed, so the feet don't slide.
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const BASE = import.meta.env.BASE_URL;
// Ground speed (m/s) of each locomotion clip at normal playback (measured stride).
export const CLIP_SPEED = { walk: 1.3, jog: 3.1, sprint: 5.6 };
const LOCO = ['idle', 'walk', 'jog', 'sprint'];
const BLEND = 9; // weight easing per second (≈ 0.25 s cross-fades)

export async function loadHero(tierKey) {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const info = await fetch(`${BASE}people/hero/info.json`, { cache: 'no-cache' }).then((r) => r.json());
  const q = tierKey === 'low' ? 'low' : tierKey === 'high' ? 'high' : 'medium';
  const [g, a, meta] = await Promise.all([
    loader.loadAsync(`${BASE}people/hero/hero-${q}.glb?v=${info.version}`),
    loader.loadAsync(`${BASE}people/hero/anims.glb?v=${info.version}`),
    fetch(`${BASE}people/hero/anims.json?v=${info.version}`).then((r) => r.json()),
  ]);
  const clips = new Map();
  for (const clip of a.animations) { clip.userData = meta.clips[clip.name] || {}; clips.set(clip.name, clip); }
  const root = g.scene;
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
  const bones = new Map();
  root.traverse((o) => { if (o.isBone) bones.set(o.name, o); });
  return new Hero(root, clips, bones, info);
}

export class Hero {
  constructor(root, clips, bones, info) {
    this.root = root; this.clips = clips; this.bones = bones; this.info = info;
    this.object = new THREE.Group();
    this.object.add(root);
    this.mixer = new THREE.AnimationMixer(root);
    this.actions = new Map();
    this.weights = new Map();   // action name → current weight
    this.current = 'idle';      // 'loco' blend or a single clip name
    this.speed = 0;             // ground speed for the locomotion blend
    this.hand = bones.get('hand_r');
    for (const n of LOCO) { const a = this.action(n); a.play(); a.setEffectiveWeight(n === 'idle' ? 1 : 0); this.weights.set(n, n === 'idle' ? 1 : 0); }
    this.mode = 'loco';
  }

  action(name) {
    let a = this.actions.get(name);
    if (!a) {
      const clip = this.clips.get(name);
      if (!clip) return null;
      a = this.mixer.clipAction(clip);
      if (clip.userData.once) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
      a.setEffectiveWeight(0);
      this.actions.set(name, a);
      this.weights.set(name, 0);
    }
    return a;
  }

  /** Walk / jog / sprint / stand by ground speed (m/s). */
  locomotion(speed) {
    this.mode = 'loco'; this.speed = speed; this.current = speed < 0.25 ? 'idle' : speed < 2.2 ? 'walk' : speed < 4.8 ? 'jog' : 'sprint';
  }

  /** One clip on its own (jump, aim, shoot, fall, drive…); `restart` replays a one-shot. */
  play(name, timeScale = 1, fade = 0.2, restart = false) {
    const a = this.action(name);
    if (!a) return;
    a.timeScale = timeScale;
    if (this.mode === 'clip' && this.current === name && !restart) return;
    if (this.current !== name || restart) { a.reset(); a.play(); }
    this.mode = 'clip'; this.current = name; this.fade = fade;
  }

  /** Locomotion targets: two neighbouring clips share the weight by speed. */
  locoTargets(s, out) {
    const W = CLIP_SPEED.walk, J = CLIP_SPEED.jog * 1.2, S = CLIP_SPEED.sprint * 1.15;
    out.idle = 0; out.walk = 0; out.jog = 0; out.sprint = 0;
    if (s < 0.2) out.idle = 1;
    else if (s < 0.8) { const f = (s - 0.2) / 0.6; out.idle = 1 - f; out.walk = f; }
    else if (s < W * 1.4) out.walk = 1;
    else if (s < J) { const f = (s - W * 1.4) / (J - W * 1.4); out.walk = 1 - f; out.jog = f; }
    else if (s < S) { const f = (s - J) / (S - J); out.jog = 1 - f; out.sprint = f; }
    else out.sprint = 1;
    return out;
  }

  update(dt) {
    const target = {};
    if (this.mode === 'loco') this.locoTargets(this.speed, target);
    else target[this.current] = 1;
    const k = 1 - Math.exp(-(this.mode === 'clip' && this.fade ? 0.18 / this.fade : 1) * BLEND * dt);
    // Locomotion clips run in step: rate from speed, phase shared (the dominant clip leads).
    if (this.mode === 'loco') {
      let lead = null, lw = 0;
      for (const n of ['walk', 'jog', 'sprint']) {
        const a = this.actions.get(n);
        a.timeScale = THREE.MathUtils.clamp(Math.max(this.speed, 0.6) / CLIP_SPEED[n], 0.6, 1.5);
        if ((target[n] || 0) > lw) { lw = target[n]; lead = a; }
      }
      if (lead) {
        const phase = lead.time / lead.getClip().duration;
        for (const n of ['walk', 'jog', 'sprint']) { const a = this.actions.get(n); if (a !== lead) a.time = phase * a.getClip().duration; }
      }
    }
    for (const [name, a] of this.actions) {
      const w = this.weights.get(name) + ((target[name] || 0) - this.weights.get(name)) * k;
      this.weights.set(name, w);
      a.setEffectiveWeight(w);
      if (w > 0.001 && !a.isRunning() && !a.getClip().userData.once) a.play();
      if (LOCO.includes(name) && !a.isRunning()) a.play();
    }
    this.mixer.update(dt);
  }
}
