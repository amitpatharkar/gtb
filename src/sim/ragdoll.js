import { POSE } from './people.js';

// "Euphoria-lite": how people react physically when something hits them. GTA V hands a hit
// character to NaturalMotion's Euphoria, which picks a behaviour (keep balance, stagger,
// protect the head, brace for the fall) and synthesises the motion, so no two falls look the
// same. Here the same idea is done cheaply: a behaviour is picked from the impact (speed,
// the hitter's mass) with randomness, and the body is moved as one ballistic point with a
// tumble angle, landing, a slide and a get-up — no limbs simulated, no blood, comedy falls.
//
// Behaviours:
//  STAGGER  keeps their feet: pushed back a few steps, arms going (slow bumps, shoves, blows)
//  STUMBLE  staggers, then goes over backwards and lies there a moment
//  FLING    knocked off their feet: airborne, tumbling, lands, slides, lies, gets up
//  BONNET   hit fast by a car: thrown up and over the bonnet (the car passes under them)
//  DIVE     an agile person leaps clear sideways at the last moment
//
// A person object needs x, y, z (or pos), heading; the module writes pose, tilt (rad, falling
// back = positive), hitT (flinch) and rag (this person's state) while it is in charge.
// Characters (characters.js) and the far crowd (people.js) draw the tilt.

export const REACT = { STAGGER: 1, STUMBLE: 2, FLING: 3, BONNET: 4, DIVE: 5 };
const STAGE = { STAGGER: 0, AIR: 1, LIE: 2, UP: 3 }; // each body is in exactly one
const LIE = Math.PI / 2;
const rnd = (a, b) => a + Math.random() * (b - a);

export class Ragdolls {
  constructor({ tiles, audio = null, bubbles = null }) {
    this.tiles = tiles; this.audio = audio; this.bubbles = bubbles;
    this.list = [];
  }

  /**
   * Hit person p with (vx, vz): the hitter's velocity at contact (m/s, world). Options:
   * mass (hitter, kg; a person is ~70), react (force a behaviour), agile (may dive clear),
   * y (start height, e.g. a rider on a seat), down (seconds lying, else random), side (±1:
   * which way a dive goes), done(p) (called when they are back on their feet).
   * Returns the behaviour used.
   */
  hit(p, vx, vz, o = {}) {
    const sp = Math.hypot(vx, vz), mass = o.mass ?? 900;
    // Momentum passed on: a scooter hit throws less far than a bus hit; capped either way.
    const s = sp * Math.min(1, mass / (mass + 75));
    const roll = Math.random();
    let r = o.react;
    if (!r) {
      if (s < 2.2) r = roll < 0.82 ? REACT.STAGGER : REACT.STUMBLE;
      else if (s < 5) r = o.agile && roll < 0.15 ? REACT.DIVE : roll < 0.55 ? REACT.STUMBLE : REACT.FLING;
      else if (s < 10) r = o.agile && roll < 0.07 ? REACT.DIVE : REACT.FLING;
      else r = roll < 0.45 ? REACT.BONNET : REACT.FLING;
    }
    const ux = sp > 0.01 ? vx / sp : Math.sin(p.heading || 0), uz = sp > 0.01 ? vz / sp : Math.cos(p.heading || 0);
    const px = p.pos ? p.pos.x : p.x, pz = p.pos ? p.pos.z : p.z;
    const ground = this.tiles.groundHeight(px, pz);
    const st = p.rag || { p, r: 0, stage: 0, t: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, tilt: 0, spin: 0, phase: 0, lie: 0, lieT: 0, up: 0, stagger: 0, done: null, bounced: 0 };
    Object.assign(st, { r, stage: STAGE.AIR, t: 0, x: px, y: Math.max(ground, o.y ?? (p.pos ? p.pos.y : p.y ?? ground)), z: pz, tilt: p.tilt || 0, phase: 0, up: 0, bounced: 0, done: o.done || null, lieT: 0, stagger: 0 });
    st.lie = o.down ?? rnd(2.2, 4.2);
    const side = o.side ?? (Math.random() < 0.5 ? -1 : 1);
    switch (r) {
      case REACT.STAGGER: {
        const push = Math.min(2.6, 0.7 + s * 0.6);
        st.vx = ux * push; st.vz = uz * push; st.vy = 0;
        st.stagger = rnd(0.55, 0.95); st.spin = 0; st.stage = STAGE.STAGGER;
        break;
      }
      case REACT.STUMBLE: {
        const push = Math.min(3.2, 1 + s * 0.5);
        st.vx = ux * push + uz * side * 0.4; st.vz = uz * push - ux * side * 0.4; st.vy = 0;
        st.stagger = rnd(0.3, 0.6); st.spin = 0; st.stage = STAGE.STAGGER;
        break;
      }
      case REACT.FLING: {
        const k = rnd(0.72, 0.98);
        st.vx = ux * s * k + uz * side * rnd(0.3, 1.6); st.vz = uz * s * k - ux * side * rnd(0.3, 1.6);
        st.vy = 1.1 + s * rnd(0.16, 0.28);
        st.spin = (2.5 + s * 0.45) * rnd(0.7, 1.3);
        st.y += 0.1; st.stagger = 0;
        break;
      }
      case REACT.BONNET: {
        // Up and over: the car carries on underneath, so they end up beside or behind it.
        st.vx = ux * s * rnd(0.35, 0.55) + uz * side * rnd(0.5, 1.5); st.vz = uz * s * rnd(0.35, 0.55) - ux * side * rnd(0.5, 1.5);
        st.vy = 2.6 + s * rnd(0.2, 0.3);
        st.spin = rnd(6, 9.5);
        st.y += 0.4; st.stagger = 0;
        break;
      }
      case REACT.DIVE: {
        // Sideways out of the path, a forward roll: hands first, small bruises.
        st.vx = uz * side * rnd(3.2, 4.4) + ux * 1.2; st.vz = -ux * side * rnd(3.2, 4.4) + uz * 1.2;
        st.vy = rnd(1.8, 2.6); st.spin = rnd(5, 7); st.stagger = 0;
        st.lie = o.down ?? rnd(0.6, 1.2);
        break;
      }
    }
    p.rag = st;
    p.hitT = 0.4;
    if (!this.list.includes(st)) this.list.push(st);
    return r;
  }

  /** Stop controlling a person (they were removed, or another system takes over). */
  release(p) {
    const st = p.rag;
    if (!st) return;
    p.rag = null; p.tilt = 0;
    const i = this.list.indexOf(st);
    if (i >= 0) this.list.splice(i, 1);
  }

  update(dt) {
    const tiles = this.tiles;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const st = this.list[i], p = st.p;
      if (p.dead || p.rag !== st) { this.list.splice(i, 1); continue; }
      st.t += dt;
      const ground = tiles.groundHeight(st.x, st.z);
      let pose = POSE.STAND;
      if (st.stage === STAGE.STAGGER) {
        // Feet still on the ground: staggering steps back, then (stumble) over backwards.
        st.stagger -= dt;
        st.phase += dt * 14;
        this.slide(st, dt, 2.5);
        st.tilt = -0.28 * Math.sin(st.t * 9) * Math.exp(-st.t * 2) + 0.18 * Math.sin(st.t * 5.5); // windmilling for balance
        pose = POSE.WALK;
        st.y = ground;
        if (st.stagger <= 0) {
          if (st.r === REACT.STAGGER) { this.finish(st, i); continue; }
          st.vy = 0.6; st.spin = rnd(3.5, 5); st.stage = STAGE.AIR; // balance lost: over backwards
        }
      } else if (st.stage === STAGE.AIR) {
        // In the air: gravity, tumbling, walls.
        st.vy -= 9.81 * dt;
        st.y += st.vy * dt;
        const nx = st.x + st.vx * dt, nz = st.z + st.vz * dt;
        if (tiles.hits(nx, nz, 0.25)) { st.vx *= -0.3; st.vz *= -0.3; st.spin *= 0.6; this.thud(st, 0.7); }
        else { st.x = nx; st.z = nz; }
        st.tilt += st.spin * dt;
        if (st.r === REACT.STUMBLE && st.tilt > LIE) st.tilt = LIE;
        if (st.y <= ground) {
          st.y = ground;
          if (st.vy < -3 && st.bounced < 2) {
            // Bounce once or twice (comedy, not injury).
            st.bounced++; st.vy = -st.vy * 0.28; st.vx *= 0.6; st.vz *= 0.6; st.spin *= 0.5;
            this.thud(st, Math.min(1, st.vy * 0.4));
          } else {
            st.vy = 0;
            st.lieT = st.lie; st.stage = STAGE.LIE;
            // Land on the back, whatever the tumble angle was (eased there while sliding).
            st.tilt = Math.atan2(Math.sin(st.tilt), Math.cos(st.tilt));
            this.thud(st, 0.5);
          }
        }
        if (st.t > 6) { st.y = ground; st.vy = 0; st.lieT = st.lie; st.stage = STAGE.LIE; } // never stuck in the air
        pose = POSE.STAND;
      } else if (st.stage === STAGE.LIE) {
        // Down: slide to a stop on the ground, lie there.
        st.y = ground;
        this.slide(st, dt, 6.5);
        st.lieT -= dt;
        st.tilt += (LIE - st.tilt) * Math.min(1, dt * 10);
        pose = Math.abs(st.tilt - LIE) < 0.15 ? POSE.FALLEN : POSE.STAND;
        if (st.lieT <= 0) { st.stage = STAGE.UP; st.up = 0; }
      } else {
        // Getting up: from flat back to standing in about half a second.
        st.y = ground;
        st.up += dt;
        st.tilt = LIE * Math.max(0, 1 - st.up / 0.55);
        pose = st.up < 0.15 ? POSE.FALLEN : POSE.STAND;
        if (st.up >= 0.55) { this.finish(st, i); continue; }
      }
      this.write(p, st, pose);
    }
  }

  /** Ground friction on a sliding body (m/s²). */
  slide(st, dt, decel) {
    const v = Math.hypot(st.vx, st.vz);
    if (v > 0.01) {
      const k = Math.max(0, v - decel * dt) / v;
      st.vx *= k; st.vz *= k;
      const nx = st.x + st.vx * dt, nz = st.z + st.vz * dt;
      if (!this.tiles.hits(nx, nz, 0.25)) { st.x = nx; st.z = nz; } else { st.vx = st.vz = 0; }
    }
  }

  thud(st, v) { this.audio?.punch?.(0.35 + v * 0.5); }

  write(p, st, pose) {
    if (p.pos) p.pos.set(st.x, st.y, st.z); else { p.x = st.x; p.y = st.y; p.z = st.z; }
    p.tilt = st.tilt;
    p.ragPose = pose;
    p.pose = pose;
    if (pose !== POSE.FALLEN) p.hitT = Math.max(p.hitT || 0, 0.2);
    p.phase = st.phase;
  }

  finish(st, i) {
    const p = st.p;
    this.list.splice(i, 1);
    p.rag = null; p.tilt = 0;
    if (p.pos) p.pos.y = st.y; else p.y = st.y;
    p.pose = POSE.STAND;
    st.done?.(p);
  }
}
