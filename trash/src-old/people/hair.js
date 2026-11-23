import * as THREE from 'three';

// Hair that swings: the bone chains the people build adds down braids, ponytails and long
// hair (`hair_0…`, or `hairL_…` / `hairR_…` for two strands) are simulated as Verlet
// particle chains in world space, at a fixed 60 steps a second:
// - each joint keeps its length to the one above (the hair doesn't stretch);
// - gravity pulls it down, it keeps its momentum with a little air drag, and a weak spring
//   pulls it back towards where the animated head would carry it (so a braid keeps its
//   shape and settles where it hangs);
// - spheres on the head, neck, shoulders and upper back push it out (no hair through
//   the body).
// Each bone is then turned to point at its simulated joint. Only people near the camera run it.

const STEP = 1 / 60;
const G = new THREE.Vector3(0, -9.81, 0);
const _h = new THREE.Vector3(), _goal = new THREE.Vector3(), _n = new THREE.Vector3(), _d = new THREE.Vector3(), _ax = new THREE.Vector3();
const _q = new THREE.Quaternion(), _qw = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _qa = new THREE.Quaternion();
const Y = new THREE.Vector3(0, 1, 0);

/** Body spheres the hair can't enter: [bone, offset along the bone (m), radius (m)]. */
const BODY = [['head', 0.08, 0.1], ['neck_01', 0.03, 0.065], ['spine_03', 0.12, 0.12], ['spine_03', 0.0, 0.13], ['spine_02', 0.05, 0.13], ['clavicle_l', 0.1, 0.06], ['clavicle_r', 0.1, 0.06]];

export class HairSprings {
  constructor(person) {
    this.chains = [];
    for (const [name, bone] of person.bones) {
      const m = /^(hair[LR]?)_0$/.exec(name);
      if (!m) continue;
      const bones = [];
      for (let k = 0, b = bone; b; k++, b = person.bones.get(`${m[1]}_${k + 1}`)) bones.push(b);
      const lens = bones.map((b, k) => (bones[k + 1] ? bones[k + 1].position.length() : 0));
      lens[lens.length - 1] = lens[lens.length - 2] || 0.08;
      this.chains.push({ bones, lens, rest: bones.map((b) => b.quaternion.clone()), tail: bones.map(() => new THREE.Vector3()), prev: bones.map(() => new THREE.Vector3()), live: false });
    }
    this.body = BODY.map(([n, off, r]) => [person.bones.get(n), off, r]).filter(([b]) => b);
    this.centres = this.body.map(() => new THREE.Vector3());
    this.radii = this.body.map(([, , r]) => r);
    this.fitted = false;
    this.acc = 0;
    this.root = person.root;
  }

  get active() { return this.chains.length > 0; }

  /** Forget the motion (after a teleport or when the body is handed to someone else). */
  reset() { for (const c of this.chains) c.live = false; }

  /**
   * Fit the body spheres to this person: none may reach the joints where the hair rests
   * (spheres sized for an average man sat outside a slim woman's back and pushed her hair aside).
   */
  fit() {
    this.radii = this.body.map(([, , r]) => r);
    for (const c of this.chains) {
      c.bones.forEach((b, i) => {
        b.quaternion.copy(c.rest[i]);
        b.updateWorldMatrix(false, false);
        b.getWorldPosition(_h); b.getWorldQuaternion(_qw);
        _goal.copy(Y).applyQuaternion(_qw).multiplyScalar(c.lens[i]).add(_h);
        this.centres.forEach((ctr, k) => { this.radii[k] = Math.min(this.radii[k], ctr.distanceTo(_goal) * 0.9 - 0.012); });
      });
    }
    this.fitted = true;
  }

  update(dt) {
    if (!this.chains.length) return;
    this.root.updateMatrixWorld(true);
    this.body.forEach(([b, off], i) => { this.centres[i].set(0, off, 0).applyMatrix4(b.matrixWorld); });
    if (!this.fitted) this.fit();
    this.acc = Math.min(this.acc + dt, STEP * 4);
    const steps = Math.floor(this.acc / STEP);
    this.acc -= steps * STEP;
    for (const c of this.chains) this.chain(c, steps);
  }

  chain(c, steps) {
    const { bones, lens, rest, tail, prev } = c;
    // Pose the chain from the animated head: the goal of each joint.
    for (let i = 0; i < bones.length; i++) {
      const b = bones[i];
      b.quaternion.copy(rest[i]);
      b.updateWorldMatrix(false, false);
      b.getWorldPosition(_h);
      b.getWorldQuaternion(_qw);
      _goal.copy(Y).applyQuaternion(_qw).multiplyScalar(lens[i]).add(_h);
      if (!c.live || tail[i].distanceToSquared(_goal) > 1) { tail[i].copy(_goal); prev[i].copy(_goal); }
      for (let s = 0; s < steps; s++) {
        // Verlet: momentum with air drag, gravity, a weak pull back to the goal.
        _n.copy(tail[i]).sub(prev[i]).multiplyScalar(0.9).add(tail[i]).addScaledVector(G, STEP * STEP);
        _n.addScaledVector(_d.copy(_goal).sub(tail[i]), 0.14);
        prev[i].copy(tail[i]);
        // Keep the length and stay out of the body.
        this.constrain(_n, _h, lens[i]);
        for (let k = 0; k < this.centres.length; k++) {
          const ctr = this.centres[k], r = this.radii[k] + 0.012;
          if (r <= 0.02) continue;
          _d.copy(_n).sub(ctr);
          const l = _d.length();
          if (l < r && l > 1e-6) { _n.copy(ctr).addScaledVector(_d, r / l); this.constrain(_n, _h, lens[i]); }
        }
        tail[i].copy(_n);
      }
      // Turn the bone (world space) so it points at its simulated joint.
      _ax.copy(Y).applyQuaternion(_qw);
      _d.copy(tail[i]).sub(_h).normalize();
      _q.setFromUnitVectors(_ax, _d);
      b.parent.getWorldQuaternion(_qp);
      b.quaternion.premultiply(_qa.copy(_qp).invert().multiply(_q).multiply(_qp));
      b.updateWorldMatrix(false, false);
    }
    c.live = true;
  }

  constrain(p, head, len) {
    _d.copy(p).sub(head);
    const l = _d.length() || 1;
    p.copy(head).addScaledVector(_d, len / l);
  }
}
