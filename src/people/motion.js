import * as THREE from 'three';

// How a person moves and looks alive: animation clips (retargeted, played as
// deltas from the body's own rest pose) cross-faded by an AnimationMixer, then on top:
// - blinking at a natural rate (every 2–6 s, sometimes twice), 70 ms down and 100 ms up;
// - eyes that look at a target within what eyes can turn (about ±32°), with small saccades;
// - the head and neck turning towards what the person looks at (yaw ±70°, pitch ±30°),
//   which also lifts the slightly head-down idle of the source library;
// - facial expressions eased in and out (smile, anger, pain, surprise) and a talking mouth;
// - moves the libraries lack, layered on the bones: a wave and a front kick.

const _v = new THREE.Vector3(), _t = new THREE.Vector3(), _p = new THREE.Vector3(), _f = new THREE.Vector3(), _a = new THREE.Vector3();
const _q = new THREE.Quaternion(), _qw = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _qa = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);

/** Expressions as face-morph weights. */
export const EXPRESSIONS = {
  neutral: {},
  smile: { smile: 0.75, squint: 0.25, browUp: 0.1 },
  grin: { smile: 1, squint: 0.4, jawOpen: 0.15 },
  angry: { browDown: 0.9, sneer: 0.45, frown: 0.35, squint: 0.35, stretch: 0.15 },
  pain: { squint: 0.9, browInnerUp: 0.7, stretch: 0.6, frown: 0.3, jawOpen: 0.15 },
  surprised: { wide: 0.9, browUp: 0.9, browInnerUp: 0.4, jawOpen: 0.4, funnel: 0.2 },
  sad: { browInnerUp: 0.85, frown: 0.65, squint: 0.15 },
  effort: { squint: 0.6, browDown: 0.5, stretch: 0.45 },
};

/** Ground speed (m/s) each locomotion clip shows at time scale 1. */
export const CLIP_SPEED = { walk: 1.3, walkFormal: 1.35, carry: 1.1, crouchWalk: 0.75, jog: 3.1, sprint: 5.6 };

export class Motion {
  static LIST = ['idle'];

  /** @param person from PeopleLibrary.make/instantiate; `lib` loads the clips. */
  constructor(person, lib) {
    this.p = person;
    this.mixer = new THREE.AnimationMixer(person.root);
    this.actions = new Map();
    this.current = null;
    this.clipName = '';
    this.blinkT = 1 + Math.random() * 3;
    this.blink = 0;
    this.sacc = new THREE.Vector2();
    this.saccT = 0;
    this.eyes = ['eye_l', 'eye_r'].map((n) => person.bones.get(n)).filter(Boolean);
    this.eyeRest = this.eyes.map((b) => b.quaternion.clone());
    this.neck = person.bones.get('neck_01');
    this.head = person.bones.get('head');
    this.yaw = 0; this.pitch = 0;
    this.face = {};                     // current morph weights (eased)
    this.talk = 0; this.talkT = Math.random() * 10;
    this.waveT = 0; this.kickT = 0;
    // Layered turns are undone before the mixer runs again: it only writes a bone when its
    // own result changes, so a turn on a bone the clip holds still would otherwise build up.
    this.saved = new Map();             // bone → { q: value before layering, on }
    this.ready = false;
    const attach = (clips) => { this.clips = clips; Motion.LIST = [...clips.keys(), 'wave', 'kick']; this.ready = true; this.play(this.want || 'idle'); };
    if (person.template?.clips) attach(person.template.clips);
    else if (lib) lib.clipsFor(person.template).then(attach);
  }

  /**
   * Cross-fade to a clip. Options: fade (s), time (0…1 of the clip, else a random phase for
   * loops), speed (time scale). `once` clips hold their last frame.
   */
  play(name, { fade = 0.25, time, speed = 1 } = {}) {
    this.want = name;
    if (!this.clips) return null;
    this.undo();   // a newly bound bone must record its clean pose, not a layered one
    const clip = this.clips.get(name) || this.clips.get('idle');
    let a = this.actions.get(clip.name);
    if (!a) {
      a = this.mixer.clipAction(clip);
      if (clip.userData.once) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
      this.actions.set(clip.name, a);
    }
    a.timeScale = speed;
    if (a === this.current) return a;
    a.reset().setEffectiveWeight(1).play();
    if (this.current && fade > 0) { a.fadeIn(fade); this.current.fadeOut(fade); } else if (this.current) this.current.stop();
    a.time = time !== undefined ? time * clip.duration : clip.userData.once ? 0 : Math.random() * clip.duration;
    this.current = a;
    this.clipName = clip.name;
    return a;
  }

  /** Restart the current one-shot clip (a new punch, a new flinch). */
  restart(time = 0) { if (this.current) { this.current.reset().play(); this.current.time = time * this.current.getClip().duration; } }

  /**
   * Advance. Options: lookAt (Vector3 or Object3D; null = straight ahead), heading (body yaw,
   * radians, for the head turn), expression (EXPRESSIONS key), talking (bool), wave / kick
   * (bool), skipMixer (true on frames a far person's motion isn't stepped), dtMixer.
   */
  update(dt, o = {}) {
    this.updateFace(dt, o);
    if (o.skipMixer) return;            // far people: keep last frame's pose and layers
    this.undo();
    this.mixer.update(o.dtMixer ?? dt);
    // Layered moves (the mixer has just written every keyed bone).
    this.waveT = o.wave ? this.waveT + dt : 0;
    if (this.waveT > 0) this.layerWave(o.heading ?? 0, this.waveT);
    this.kickT = o.kickAt ?? (o.kick ? Math.min(this.kickT + dt, 1) : 0);
    if (this.kickT > 0) this.layerKick(o.heading ?? 0, this.kickT);
    if (!o.noHead) this.lookHead(dt, o.lookAt, o.heading ?? 0, o.headUp ?? 0.12);
    this.lookEyes(dt, o.lookAt);
  }

  updateFace(dt, o) {
    // Blink.
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blink = 0.17; this.blinkT = Math.random() < 0.15 ? 0.3 : 2 + Math.random() * 4; }
    let b = 0;
    if (this.blink > 0) { this.blink -= dt; const k = 0.17 - this.blink; b = k < 0.07 ? k / 0.07 : Math.max(0, 1 - (k - 0.07) / 0.1); }
    // Expression, eased.
    const want = EXPRESSIONS[o.expression || 'neutral'] || EXPRESSIONS.neutral;
    const k = Math.min(1, dt * 6);
    for (const name of Object.keys(this.p.morphs)) {
      const cur = this.face[name] || 0, target = want[name] || 0;
      this.face[name] = cur + (target - cur) * k;
    }
    // Talking: the jaw and lips move in syllables (about 5 a second).
    this.talk += ((o.talking ? 1 : 0) - this.talk) * Math.min(1, dt * 8);
    let jaw = 0, funnel = 0;
    if (this.talk > 0.01) {
      this.talkT += dt;
      jaw = Math.max(0, Math.sin(this.talkT * 11) * 0.6 + Math.sin(this.talkT * 6.3) * 0.4) * 0.32 * this.talk;
      funnel = Math.max(0, Math.sin(this.talkT * 4.1)) * 0.25 * this.talk;
    }
    for (const [name, v] of Object.entries(this.face)) {
      let w = v;
      if (name === 'blinkL' || name === 'blinkR') w = Math.max(v, b);
      else if (name === 'jawOpen') w = Math.max(v, jaw);
      else if (name === 'funnel') w = Math.max(v, funnel);
      this.p.face(name, w);
    }
  }

  /** Put back every bone layered last frame. */
  undo() {
    for (const [bone, s] of this.saved) if (s.on) { bone.quaternion.copy(s.q); s.on = false; }
  }

  /** Turn a bone by a world-space rotation (keeps the clip's pose underneath). */
  turn(bone, q) {
    let s = this.saved.get(bone);
    if (!s) this.saved.set(bone, (s = { q: new THREE.Quaternion(), on: false }));
    if (!s.on) { s.q.copy(bone.quaternion); s.on = true; }
    bone.parent.getWorldQuaternion(_qp);
    bone.quaternion.premultiply(_qa.copy(_qp).invert().multiply(q).multiply(_qp));
  }

  lookHead(dt, target, heading, headUp) {
    if (!this.head || !this.neck) return;
    let yaw = 0, pitch = headUp;
    if (target) {
      const tw = target.isObject3D ? target.getWorldPosition(_t) : _t.copy(target);
      this.head.getWorldPosition(_p);
      _v.copy(tw).sub(_p);
      const fx = Math.sin(heading), fz = Math.cos(heading);
      const fwd = _v.x * fx + _v.z * fz, side = _v.x * fz - _v.z * fx, flat = Math.hypot(_v.x, _v.z);
      if (fwd > -0.2 * flat && flat > 0.3) {   // only things in front (or just beside)
        yaw = THREE.MathUtils.clamp(Math.atan2(side, fwd), -1.2, 1.2);
        pitch = THREE.MathUtils.clamp(Math.atan2(_v.y, flat), -0.5, 0.5) + headUp * 0.5;
      }
    }
    const k = Math.min(1, dt * 4);
    this.yaw += (yaw - this.yaw) * k; this.pitch += (pitch - this.pitch) * k;
    // Yaw about world up; pitch about the body's right axis. Neck takes 40 %, head 60 %.
    _a.set(Math.cos(heading), 0, -Math.sin(heading));
    for (const [bone, share] of [[this.neck, 0.4], [this.head, 0.6]]) {
      _q.setFromAxisAngle(UP, this.yaw * share);
      this.turn(bone, _q);
      _q.setFromAxisAngle(_a, -this.pitch * share);
      this.turn(bone, _q);
    }
  }

  lookEyes(dt, lookAt) {
    if (!this.eyes.length) return;
    this.saccT -= dt;
    if (this.saccT <= 0) { this.saccT = 0.4 + Math.random() * 1.6; this.sacc.set((Math.random() - 0.5) * 0.06, (Math.random() - 0.5) * 0.04); }
    this.eyes.forEach((eye, i) => {
      eye.quaternion.copy(this.eyeRest[i]);
      if (!lookAt) return;
      const target = lookAt.isObject3D ? lookAt.getWorldPosition(_t) : _t.copy(lookAt);
      eye.updateWorldMatrix(true, false);
      eye.getWorldPosition(_p);
      eye.getWorldQuaternion(_qw);
      const fwd = _f.set(0, 1, 0).applyQuaternion(_qw);           // glTF bones point along +Y
      const want = _v.copy(target).sub(_p).normalize();
      want.x += this.sacc.x; want.y += this.sacc.y; want.normalize();
      const a = fwd.angleTo(want);
      if (a > 0.55) want.lerp(fwd, 1 - 0.55 / a).normalize();      // eyes turn about ±32°
      _q.setFromUnitVectors(fwd, want);
      this.turn(eye, _q);
    });
  }

  /** Right arm raised and the hand waving side to side. */
  layerWave(heading, t) {
    const up = this.p.bones.get('upperarm_r'), low = this.p.bones.get('lowerarm_r');
    if (!up || !low) return;
    const k = Math.min(1, t / 0.3);
    _a.set(Math.sin(heading), 0, Math.cos(heading));               // body forward
    _q.setFromAxisAngle(_a, 2.3 * k);                              // raise the arm out and up
    this.turn(up, _q);
    _q.setFromAxisAngle(_a, (0.5 + Math.sin(t * 9) * 0.45) * k);   // forearm swings
    this.turn(low, _q);
  }

  /** A front kick with the right leg from the guard stance. */
  layerKick(heading, t) {
    const thigh = this.p.bones.get('thigh_r'), calf = this.p.bones.get('calf_r'), spine = this.p.bones.get('spine_01');
    if (!thigh || !calf) return;
    const k = Math.sin(Math.min(1, t / 0.45) * Math.PI);
    _a.set(Math.cos(heading), 0, -Math.sin(heading));              // body right
    _q.setFromAxisAngle(_a, 1.25 * k); this.turn(thigh, _q);
    _q.setFromAxisAngle(_a, -0.9 * k * (1 - k)); this.turn(calf, _q);
    if (spine) { _q.setFromAxisAngle(_a, -0.1 * k); this.turn(spine, _q); }
  }

  stop() { this.undo(); this.mixer.stopAllAction(); this.current = null; this.clipName = ''; }
}
