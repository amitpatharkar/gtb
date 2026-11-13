import * as THREE from 'three';
import { POSE, addPatch } from '../sim/people.js';

// Street fights, Bollywood-comedy style (no weapons, no blood): on foot the player can
// punch (left mouse with fists), kick (V) and hurl insults (G, bleeped). People react:
// most swear back or walk off, some shove or throw punches, a few chuck a tomato or a
// chappal, and about 1.5 % carry their own pichkari and spray back. Roughly 4–5 % of the
// people you walk past are spoiling for a fight and start it themselves. Knocked-down
// people get up and limp away; kids and animals are never targets. Hitting anyone in
// front of the police is a challan; hitting a policeman is a bigger one.

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const INSULTS = ['Abey #@$%!', 'Ullu ke pathe!', 'Chal hatt, @#$%!', 'Bewakoof!', 'Teri toh… #@$%!', 'Gadha kahin ka!', 'Nalayak!', 'Pagal hai kya?!', 'Dimaag kharab hai kya?!', 'Tere jaise bahut dekhe!'];
const HURT = ['Aah!', 'Oye!', 'Arre baap re!', 'Ouch!', 'Maar diya!'];
const FIGHT = ['Aaja, aaja!', 'Ab dekh!', 'Le!', 'Dhishoom!', 'Bahut garmi hai kya?'];
const SORRY = ['Maaf karo bhai!', 'Bas, bas!', 'Main chala!', 'Dekh lunga tujhe!'];
const SPRAY = ['Holi hai! Le tu bhi!', 'Bura na mano!', 'Ab tera number!'];

export class Combat {
  constructor({ scene, street, police, bubbles, audio, hud, tiles, walker, pichkari, view }) {
    Object.assign(this, { street, police, bubbles, audio, hud, tiles, walker, pichkari, view });
    this.weapon = 'fists';
    this.cool = 0;
    this.projectiles = [];
    this.knocked = [];      // fixture people (stall customers…) lying down for a while
    this.offenceCool = 0;
    const mk = (geo, color) => { const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.5 }), 16); m.count = 0; m.frustumCulled = false; m.castShadow = true; scene.add(m); return m; };
    this.tomatoMesh = mk(new THREE.SphereGeometry(0.06, 10, 8), 0xd8141c);
    this.chappalMesh = mk(new THREE.BoxGeometry(0.1, 0.025, 0.26), 0x3b2a1e);
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.v = new THREE.Vector3(); this.one = new THREE.Vector3(1, 1, 1);
  }

  setWeapon(w) {
    this.weapon = w;
    this.hud.message(w === 'pichkari' ? `Pichkari (${this.pichkari.colourName}) — left mouse or Space to spray, right mouse to aim` : 'Fists — left mouse to punch, V to kick, G to insult');
  }
  toggleWeapon() { this.setWeapon(this.weapon === 'fists' ? 'pichkari' : 'fists'); }

  // ------------------------------------------------------------------ helpers
  adult(o) { return o.kind !== 'kid' && (o.scale ?? 1) > 0.85; }

  /** Things the player can hit right in front: [{ o, kind }] nearest first. */
  inFront(range) {
    const w = this.walker, fx = Math.sin(w.heading), fz = Math.cos(w.heading);
    const out = [];
    const test = (o, kind) => {
      if (!o || o.combat?.mode === 'down' || o.downT > 0) return;
      const dx = o.x - w.pos.x, dz = o.z - w.pos.z, d = Math.hypot(dx, dz);
      if (d > range || (dx * fx + dz * fz) / (d || 1) < 0.45) return;
      out.push({ o, kind, d });
    };
    for (const p of this.street.peds) if (this.adult(p)) test(p, 'ped');
    for (const f of this.street.fixtures.values()) for (const p of f.people || []) if (this.adult(p)) test(p, 'npc');
    for (const c of this.police.cops) test(c, 'cop');
    return out.sort((a, b) => a.d - b.d);
  }

  say(o, list, kind = '') { this.bubbles.say(o, typeof list === 'string' ? list : pick(list), 2.2, kind); }

  free(p, mode, t = 0) {
    p.free = true;
    p.combat = { mode, t, cool: 0.6 + Math.random() * 0.5, shots: 0, life: 0 };
    p.hp ??= 1;
  }

  moveTo(p, tx, tz, speed, dt) {
    const dx = tx - p.x, dz = tz - p.z, l = Math.hypot(dx, dz);
    if (l < 0.05) return l;
    const s = Math.min(l, speed * dt);
    const nx = p.x + (dx / l) * s, nz = p.z + (dz / l) * s;
    if (!this.tiles.hits(nx, nz, 0.25)) { p.x = nx; p.z = nz; }
    p.heading = Math.atan2(dx, dz);
    return l;
  }

  crime(kind) {
    if (this.offenceCool > 0) return;
    this.offenceCool = 8;
    this.police.offence(kind, this.walker);
  }

  // ------------------------------------------------------------------ player actions
  punch() {
    if (this.cool > 0 || this.walker.down > 0) return;
    this.cool = 0.4;
    this.walker.action = { pose: POSE.PUNCH, t: 0.32, phase: (this.punchSide = -(this.punchSide || 1)) * Math.PI / 2 };
    this.walker.attacking = 0.6;
    this.audio.whoosh?.();
    const t = this.inFront(1.35)[0];
    if (t) this.strike(t, 0.3, 1.2, 0.08);
  }

  kick() {
    if (this.cool > 0 || this.walker.down > 0) return;
    this.cool = 0.7;
    this.walker.action = { pose: POSE.KICK, t: 0.45, phase: 0 };
    this.walker.attacking = 0.8;
    this.audio.whoosh?.();
    const t = this.inFront(1.6)[0];
    if (t) this.strike(t, 0.5, 2.4, 0.35);
  }

  abuse() {
    if (this.cool > 0) return;
    this.cool = 0.8;
    this.say(this.walker, INSULTS);
    this.audio.bleep?.();
    for (const p of this.street.peds) {
      const d = Math.hypot(p.x - this.walker.pos.x, p.z - this.walker.pos.z);
      if (d > 8 || p.combat || p.kind === 'kid') continue;
      const r = Math.random();
      if (r < 0.45) { p.state = 'angry'; p.timer = 2.5; setTimeout(() => this.say(p, INSULTS), 500 + Math.random() * 700); }
      else if (r < 0.6 && this.adult(p)) { this.free(p, 'fight'); this.say(p, FIGHT); }
    }
    for (const c of this.police.cops) if (Math.hypot(c.x - this.walker.pos.x, c.z - this.walker.pos.z) < 8) this.say(c, 'Zubaan sambhal ke!', 'cop');
  }

  /** The player hit someone: damage, knockback, reaction. */
  strike(t, damage, push, knockChance) {
    const o = t.o, w = this.walker;
    const dx = o.x - w.pos.x, dz = o.z - w.pos.z, l = Math.hypot(dx, dz) || 1;
    this.audio.punch?.(1);
    if (t.kind === 'cop') {
      this.say(o, 'Pulis pe haath?! Ab toh andar!', 'cop');
      this.police.offence('assault', w);
      return;
    }
    o.hp = (o.hp ?? 1) - damage;
    if (t.kind === 'npc') {
      // People standing at a thela or bus stop: knocked over, then back up, swearing.
      o.basePose ??= o.pose;
      if (o.hp <= 0 || Math.random() < knockChance) { o.pose = POSE.FALLEN; o.downT = 4; this.knocked.push(o); }
      else o.pose = POSE.ARGUE;
      this.say(o, Math.random() < 0.5 ? HURT : INSULTS);
      this.crime('brawl');
      return;
    }
    // Pedestrians fight back, flee, or go down.
    o.x += (dx / l) * push * 0.4; o.z += (dz / l) * push * 0.4;
    this.crime('brawl');
    if (o.hp <= 0 || Math.random() < knockChance) {
      this.free(o, 'down');
      o.combat.t = 3.5 + Math.random() * 2;
      this.say(o, HURT);
      return;
    }
    if (!o.combat || o.combat.mode === 'flee') {
      const r = Math.random();
      if (o.sprayer && r < 0.6) { this.free(o, 'spray'); this.say(o, SPRAY); }
      else if (r < 0.45) { this.free(o, 'fight'); this.say(o, FIGHT); }
      else if (r < 0.6) { this.free(o, 'throw'); this.say(o, INSULTS); }
      else { this.free(o, 'flee'); this.say(o, Math.random() < 0.5 ? HURT : INSULTS); }
    } else this.say(o, HURT);
  }

  /** Called by the pichkari when the player's colour hits someone. */
  onSprayed(t, walker) {
    const o = t.o;
    const now = performance.now();
    if (now - (o.reactAt || 0) < 3000) return;
    o.reactAt = now;
    const { bubbles, police, traffic, audio } = this.pichkari.ctx;
    if (t.kind === 'cop') { bubbles.say(o, pick(['Arre! Pulis waale pe rang?!', 'Holi khatam ho gayi, bhai!', 'Ruk, challan kaatta hoon!']), 2.6, 'cop'); police.offence('holiCop', walker); return; }
    if (t.kind === 'car') { traffic.honks.push([o.x, o.z]); if (Math.random() < 0.5) bubbles.say(o, pick(['Oye! Gaadi pe rang!', 'Abhi wash karayi thi!']), 2.2, 'driver'); return; }
    if (t.kind === 'dog') { bubbles.say(o, 'Kai-kai-kai!', 1.5); audio.bark?.(0.6); o.state = 'home'; return; }
    if (t.kind === 'cow') { bubbles.say(o, 'Mooo… (unimpressed)', 2); return; }
    if (t.kind === 'kid') { bubbles.say(o, pick(['Holi hai! Haha!', 'Aur daalo!', 'Mujhe bhi pichkari chahiye!']), 2, 'kid'); return; }
    const happy = Math.random() < 0.5;
    if (t.kind === 'ped' && !o.combat) {
      if (o.sprayer) { this.free(o, 'spray'); this.say(o, SPRAY); return; }
      if (!happy) {
        const r = Math.random();
        if (r < 0.25 && this.adult(o)) { this.free(o, 'fight'); this.say(o, INSULTS); return; }
        if (r < 0.4 && this.adult(o)) { this.free(o, 'throw'); this.say(o, INSULTS); return; }
      }
      o.state = 'angry'; o.timer = 2.5;
    } else o.pose = POSE.ARGUE;
    bubbles.say(o, happy ? pick(['Bura na mano, Holi hai!', 'Holi hai! Haha!', 'Rang barse!', 'Arre waah, mujhe bhi do!']) : pick(['Arre! Mere kapde!', 'Holi nahi hai aaj!', 'Office jaana hai, yaar!', ...INSULTS]), 2.4);
  }

  // ------------------------------------------------------------------ NPC fighters
  updateFighter(p, dt) {
    const c = p.combat, w = this.walker;
    c.life += dt; c.t -= dt; c.cool -= dt;
    const dx = w.pos.x - p.x, dz = w.pos.z - p.z, d = Math.hypot(dx, dz);
    p.y = this.tiles.groundHeight(p.x, p.z);
    p.phase = (p.phase || 0) + dt * 6;
    const far = d > 16 || !this.onFoot;
    switch (c.mode) {
      case 'down':
        p.pose = POSE.FALLEN;
        if (c.t <= 0) { c.mode = 'flee'; c.t = 6; p.hp = 0.6; this.say(p, SORRY); }
        break;
      case 'flee': {
        p.pose = POSE.WALK; p.amp = 1.5;
        const l = d || 1;
        this.moveTo(p, p.x - (dx / l) * 5, p.z - (dz / l) * 5, 3.2, dt);
        p.phase += dt * 8;
        if (c.t <= 0 || d > 40) p.dead = true;
        break;
      }
      case 'fight':
        if (far || c.life > 25) { c.mode = 'flee'; c.t = 5; this.say(p, d > 16 ? 'Bhaag gaya darpok!' : SORRY); break; }
        if (d > 1.05) { this.moveTo(p, w.pos.x, w.pos.z, 3.0, dt); p.pose = POSE.WALK; p.amp = 1.4; p.phase += dt * 8; break; }
        p.heading = Math.atan2(dx, dz);
        p.pose = POSE.FIGHT;
        if (c.cool <= 0 && w.down <= 0) {
          c.cool = 1.0 + Math.random() * 0.7;
          const push = Math.random() < 0.4;
          p.pose = push ? POSE.PUSH : POSE.PUNCH;
          c.swing = 0.3;
          const l = d || 1;
          w.hitBy(push ? 0.03 : 0.055, dx / l, dz / l, push ? 4.5 : 1.6);
          if (push && Math.random() < 0.2) w.knock(0.02);
          this.audio.punch?.(0.8);
          if (Math.random() < 0.35) this.say(p, push ? ['Hatt!', 'Chal nikal!', 'Dhakka!'] : FIGHT);
        }
        if (c.swing > 0) { c.swing -= dt; p.pose = POSE.PUNCH; }
        break;
      case 'throw': {
        if (far) { c.mode = 'flee'; c.t = 5; break; }
        p.heading = Math.atan2(dx, dz);
        if (d > 14) { this.moveTo(p, w.pos.x, w.pos.z, 2.6, dt); p.pose = POSE.WALK; break; }
        p.pose = c.cool > 0.5 ? POSE.STAND : POSE.THROW;
        if (c.cool <= 0) {
          c.cool = 1.6; c.shots++;
          this.throwAt(p, Math.random() < 0.55 ? 'tomato' : 'chappal');
          if (c.shots >= 2 + Math.floor(Math.random() * 2)) { c.mode = Math.random() < 0.5 ? 'fight' : 'flee'; c.t = 5; }
        }
        break;
      }
      case 'spray': {
        if (far || c.life > 14) { c.mode = 'flee'; c.t = 5; break; }
        p.heading = Math.atan2(dx, dz);
        if (d > 7) { this.moveTo(p, w.pos.x, w.pos.z, 2.8, dt); p.pose = POSE.WALK; p.phase += dt * 8; break; }
        p.pose = POSE.POINT;
        p.sprayColour ??= Math.floor(Math.random() * 11);
        if ((c.life % 3) < 2) this.pichkari.npcSpray(dt, p, w.pos, p.sprayColour);
        this.sprayers.push(p);
        break;
      }
    }
  }

  throwAt(p, type) {
    const w = this.walker;
    const sx = p.x, sy = (p.y || 0) + 1.9, sz = p.z;
    const tx = w.pos.x + (Math.random() - 0.5) * 0.6, ty = w.pos.y + 1.2, tz = w.pos.z + (Math.random() - 0.5) * 0.6;
    const T = Math.max(0.5, Math.hypot(tx - sx, tz - sz) / 11);
    this.projectiles.push({ type, x: sx, y: sy, z: sz, vx: (tx - sx) / T, vy: (ty - sy) / T + 4.9 * T, vz: (tz - sz) / T, spin: 0, life: 3 });
    this.audio.whoosh?.();
  }

  updateProjectiles(dt) {
    const w = this.walker, P = this.pichkari;
    let nt = 0, nc = 0;
    this.projectiles = this.projectiles.filter((pr) => {
      pr.life -= dt; pr.vy -= 9.8 * dt;
      pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.z += pr.vz * dt; pr.spin += dt * 12;
      if (this.onFoot && Math.abs(pr.x - w.pos.x) < 0.35 && Math.abs(pr.z - w.pos.z) < 0.35 && pr.y > w.pos.y && pr.y < w.pos.y + 1.85) {
        if (pr.type === 'tomato') { addPatch(w, pr.x, pr.y, pr.z, 6, 0.16); w.hitBy(0.015, 0, 0, 0); this.bubbles.say(w, 'Chhapaak!', 1.2); }
        else { w.hitBy(0.045, pr.vx * 0.05, pr.vz * 0.05, 1); this.bubbles.say(w, 'Thwack!', 1.2); }
        this.audio.punch?.(0.5);
        return false;
      }
      const g = this.tiles.groundHeight(pr.x, pr.z);
      if (pr.y < g + 0.05 || this.tiles.hits(pr.x, pr.z, 0.03) || pr.life <= 0) {
        if (pr.type === 'tomato') P.addSplat(pr.x, g + 0.012, pr.z, 0, 1, 0, 0.35, 6);
        return false;
      }
      const mesh = pr.type === 'tomato' ? this.tomatoMesh : this.chappalMesh;
      const i = pr.type === 'tomato' ? nt++ : nc++;
      if (i < 16) mesh.setMatrixAt(i, this.m.compose(this.v.set(pr.x, pr.y, pr.z), this.q.setFromEuler(this.e.set(pr.spin, pr.spin * 0.6, 0)), this.one));
      return true;
    });
    this.tomatoMesh.count = Math.min(16, nt); this.chappalMesh.count = Math.min(16, nc);
    this.tomatoMesh.instanceMatrix.needsUpdate = true; this.chappalMesh.instanceMatrix.needsUpdate = true;
  }

  // ------------------------------------------------------------------ frame
  update(dt, input, onFoot) {
    this.onFoot = onFoot;
    this.cool -= dt;
    this.offenceCool -= dt;
    const w = this.walker;
    if (w.action) { w.action.t -= dt; if (w.action.t <= 0) w.action = null; }
    w.aiming = onFoot && (this.view.aim || (this.weapon === 'fists' && w.attacking > 0));
    if (onFoot && this.weapon === 'fists' && input.fire) this.punch();
    // Some people are spoiling for a fight (about 4–5 %); 1.5 % carry a pichkari.
    if (onFoot) {
      for (const p of this.street.peds) {
        if (p.rolled || p.kind === 'kid') continue;
        if (Math.hypot(p.x - w.pos.x, p.z - w.pos.z) > 5) continue;
        p.rolled = true;
        p.sprayer = Math.random() < 0.015;
        if (Math.random() < 0.045 && !p.combat) {
          const r = Math.random();
          const mode = p.sprayer || r < 0.15 ? 'spray' : r < 0.6 ? 'fight' : r < 0.9 ? 'throw' : 'abuse';
          if (mode === 'abuse') { p.state = 'angry'; p.timer = 3; this.say(p, INSULTS); this.audio.bleep?.(); continue; }
          this.free(p, mode);
          this.say(p, mode === 'spray' ? SPRAY : mode === 'throw' ? ['Le, tamatar kha!', 'Ruk zara!', INSULTS[0]].flat() : ['Kya dekh raha hai?!', 'Oye! Idhar aa!', 'Dhakka kyun maara?!']);
        }
      }
    }
    this.sprayers = [];
    for (const p of this.street.peds) if (p.free && p.combat) this.updateFighter(p, dt);
    this.pichkari.drawNpcGuns(this.sprayers);
    // Knocked-over bystanders get back up.
    this.knocked = this.knocked.filter((o) => { o.downT -= dt; if (o.downT <= 0) { o.pose = POSE.ARGUE; setTimeout(() => { o.pose = o.basePose ?? POSE.STAND; }, 2500); this.say(o, INSULTS); return false; } return true; });
    this.updateProjectiles(dt);
  }
}
