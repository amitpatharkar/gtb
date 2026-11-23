// The main character's body: "Indian Man In Casuals" by Pixel_Monster (CC BY 4.0), built by
// scripts/people/build-hero.mjs into public/people/hero/ with 42 motion clips retargeted onto
// his own skeleton. Clips are turned into deltas from the clip file's rest pose and played
// additively, so the body keeps its own proportions.
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const BASE = import.meta.env.BASE_URL;
const FADE = 0.18;

export async function loadHero(tierKey) {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const info = await fetch(`${BASE}people/hero/info.json`, { cache: 'no-cache' }).then((r) => r.json());
  const q = tierKey === 'low' ? 'low' : tierKey === 'high' ? 'high' : 'medium';
  const [g, a, meta] = await Promise.all([
    loader.loadAsync(`${BASE}people/hero/hero-${q}.glb?v=${info.version}`),
    loader.loadAsync(`${BASE}people/hero/anims.glb?v=${info.version}`),
    fetch(`${BASE}people/hero/anims.json?v=${info.version}`).then((r) => r.json()),
  ]);
  // Clips → deltas from the animation file's rest pose (additive).
  const rest = new Map();
  a.scene.traverse((o) => rest.set(o.name, { q: o.quaternion.clone(), p: o.position.clone() }));
  const qi = new THREE.Quaternion(), q4 = new THREE.Quaternion();
  const clips = new Map();
  for (const clip of a.animations) {
    for (const t of clip.tracks) {
      const [name, prop] = t.name.split('.');
      const r = rest.get(name);
      if (!r) continue;
      const v = t.values;
      if (prop === 'quaternion') { qi.copy(r.q).invert(); for (let i = 0; i < v.length; i += 4) q4.fromArray(v, i).premultiply(qi).normalize().toArray(v, i); }
      else if (prop === 'position') for (let i = 0; i < v.length; i += 3) { v[i] -= r.p.x; v[i + 1] -= r.p.y; v[i + 2] -= r.p.z; }
    }
    clip.blendMode = THREE.AdditiveAnimationBlendMode;
    clip.userData = meta.clips[clip.name] || {};
    clips.set(clip.name, clip);
  }
  const root = g.scene;
  root.traverse((o) => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; }
  });
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
    this.current = null;
    this.hand = bones.get('hand_r');
    this.speedScale = 1;
  }

  action(name) {
    let a = this.actions.get(name);
    if (!a) {
      const clip = this.clips.get(name);
      if (!clip) return null;
      a = this.mixer.clipAction(clip);
      if (clip.userData.once) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
      this.actions.set(name, a);
    }
    return a;
  }

  /** Cross-fade to a looping or one-shot clip; timeScale scales playback (walk speed). */
  play(name, timeScale = 1, fade = FADE) {
    const a = this.action(name);
    if (!a) return;
    a.timeScale = timeScale;
    if (this.current === name) return;
    const prev = this.current && this.action(this.current);
    a.reset().setEffectiveWeight(1).fadeIn(fade).play();
    if (prev) prev.fadeOut(fade);
    this.current = name;
  }

  /** A one-shot clip layered over the current loop (shooting, punching), then back. */
  oneShot(name, timeScale = 1) {
    const a = this.action(name);
    if (!a) return;
    a.reset(); a.timeScale = timeScale; a.setEffectiveWeight(1); a.fadeIn(0.05).play();
    clearTimeout(this._shotTimer);
    this._shotTimer = setTimeout(() => a.fadeOut(0.15), (a.getClip().duration / timeScale) * 1000 * 0.8);
  }

  update(dt) { this.mixer.update(dt); }
}
