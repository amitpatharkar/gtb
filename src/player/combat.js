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
  /** Left-right-heavy: the third punch in a quick chain lands much harder. */
  punch() {
    if (this.cool > 0 || this.walker.down > 0) return;
    this.combo = this.time - (this.lastPunch ?? -9) < 0.8 ? (this.combo % 3) + 1 : 1;
    this.lastPunch = this.time;
    const heavy = this.combo === 3;
    this.cool = heavy ? 0.55 : 0.32;
    this.walker.action = { pose: POSE.PUNCH, t: heavy ? 0.42 : 0.27, phase: (this.punchSide = -(this.punchSide || 1)) * Math.PI / 2, n: (this.swings = (this.swings || 0) + 1) };
    this.walker.attacking = 0.9;
    this.audio.whoosh?.();
    const t = this.inFront(heavy ? 1.5 : 1.35)[0];
    if (!t) return;
    this.strike(t, heavy ? 0.5 : 0.2, heavy ? 2.8 : 1.0, heavy ? 0.4 : 0.03, heavy);
    if (heavy) this.say(this.walker, ['Dhishoom!', 'Yeh le!', 'Aur le!']);
  }

  /** A kick; straight after two or more punches it is a finisher. */
  kick() {
    if (this.cool > 0 || this.walker.down > 0) return;
    const finisher = this.combo >= 2 && this.time - (this.lastPunch ?? -9) < 0.9;
    this.cool = 0.7; this.combo = 0;
    this.walker.action = { pose: POSE.KICK, t: 0.45, phase: 0, n: (this.swings = (this.swings || 0) + 1) };
    this.walker.attacking = 0.9;
    this.audio.whoosh?.();
    const t = this.inFront(1.6)[0];
    if (t) this.strike(t, finisher ? 0.65 : 0.4, finisher ? 3.4 : 2.4, finisher ? 0.7 : 0.3, finisher);
  }

  abuse() {
    if (this.cool > 0) return;
    this.cool = 0.8;
    // Gandhigiri: with a rose in hand (from the stall at Mani Bhavan), offer it instead.
    if (this.foe && this.giveRose?.(this.foe)) { this.foe.combat.mode = 'flee'; this.foe.combat.t = 4; this.foe.hp = 1; return; }
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
  strike(t, damage, push, knockChance, heavy = false) {
    const o = t.o, w = this.walker;
    const dx = o.x - w.pos.x, dz = o.z - w.pos.z, l = Math.hypot(dx, dz) || 1;
    this.audio.punch?.(heavy ? 1.4 : 0.9);
    o.hitT = 0.32; // flinch (real characters play their hit reaction)
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
      const ko = o.hp <= 0;
      this.free(o, 'down');
      o.combat.t = ko ? 6 + Math.random() * 2 : 3 + Math.random() * 1.5;
      this.say(o, ko ? ['💫 …', 'Bas… bas…', 'Maa…!'] : HURT);
      if (ko) { this.hud.message('Knockout! 💫'); this.kos = (this.kos || 0) + 1; }
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
        if (p.hitT > 0) { c.wind = 0; break; } // staggered: the swing is interrupted
        if (c.cool <= 0 && w.down <= 0 && !(c.wind > 0)) {
          // Wind up first: the player gets a moment to block (right mouse) or step back.
          c.wind = 0.42; c.push = Math.random() < 0.35; p.swingN = (p.swingN || 0) + 1;
        }
        if (c.wind > 0) {
          c.wind -= dt;
          p.pose = c.push ? POSE.PUSH : POSE.PUNCH;
          if (c.wind <= 0) {
            c.cool = 0.8 + Math.random() * 0.8;
            if (d < 1.45 && w.down <= 0) {
              const l = d || 1, blocked = this.blocking;
              if (blocked) {
                w.hitBy(c.push ? 0.004 : 0.01, dx / l, dz / l, c.push ? 1.6 : 0.5);
                this.audio.punch?.(0.35);
                if (Math.random() < 0.4) this.say(w, ['Block!', 'Bas itna hi?', 'Aur zor se!']);
              } else {
                w.hitBy(c.push ? 0.03 : 0.06, dx / l, dz / l, c.push ? 4.5 : 1.6);
                if (c.push && Math.random() < 0.2) w.knock(0.02);
                this.audio.punch?.(0.8);
                if (Math.random() < 0.35) this.say(p, c.push ? ['Hatt!', 'Chal nikal!', 'Dhakka!'] : FIGHT);
              }
            } else if (Math.random() < 0.5) this.say(p, ['Ruk!', 'Bhaag mat!', 'Idhar aa!']);
          }
        }
        // A long fight draws in a friend of theirs.
        if (c.life > 7 && !c.calledFriend) {
          c.calledFriend = true;
          if (Math.random() < 0.35) {
            const pal = this.street.peds.find((q) => q !== p && !q.combat && this.adult(q) && Math.hypot(q.x - p.x, q.z - p.z) < 12);
            if (pal) { this.free(pal, 'fight'); pal.rolled = true; this.say(pal, ['Mere dost ko maarega?!', 'Ek pe do? Chalega!', 'Ruk, main aata hoon!']); }
          }
        }
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

  /**
   * The player's vehicle meets people: at a crawl they jump aside and shout; faster and
   * they are knocked over (they get up again, no blood) and it is a hit-and-run if seen.
   * Children are always pulled clear.
   */
  carVsPeople(car) {
    const sp = Math.hypot(car.vx || 0, car.vz || 0);
    if (sp < 1.2) return;
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading), HL = car.halfLength, R = car.radius + 0.28;
    const test = (o, kind) => {
      if (!o || o.combat?.mode === 'down' || o.downT > 0) return;
      const dx = o.x - car.pos.x, dz = o.z - car.pos.z;
      if (Math.abs(dx) > 9 || Math.abs(dz) > 9 || car.vx * dx + car.vz * dz <= 0) return;
      const along = Math.max(-HL, Math.min(HL, dx * fx + dz * fz));
      let ex = dx - fx * along, ez = dz - fz * along;
      const d = Math.hypot(ex, ez);
      if (d > R) return;
      if (d < 0.05) { ex = -fz; ez = fx; } else { ex /= d; ez /= d; }
      const hard = sp > 4.2 && this.adult(o) && kind !== 'npcKid';
      if (!hard) {
        // Jump clear, sideways out of the car's path.
        const nx = o.x + ex * (R - d + 0.25), nz = o.z + ez * (R - d + 0.25);
        if (!this.tiles.hits(nx, nz, 0.2)) { o.x = nx; o.z = nz; }
        if (!o.yelledAt || performance.now() - o.yelledAt > 2500) { o.yelledAt = performance.now(); this.say(o, kind === 'cop' ? 'Ae! Gaadi peeche lo!' : ['Arre! Dekh ke!', 'Oye! Marega kya?!', 'Footpath pe chadha dega kya?!'], kind === 'cop' ? 'cop' : ''); }
        if (kind === 'ped' && !o.combat) { o.state = 'angry'; o.timer = 2; }
        return;
      }
      // Knocked off their feet, thrown a little along the car's way.
      const ux = car.vx / sp, uz = car.vz / sp, throwD = Math.min(3, 0.6 + sp * 0.18);
      const nx = o.x + ux * throwD + ex * 0.6, nz = o.z + uz * throwD + ez * 0.6;
      if (!this.tiles.hits(nx, nz, 0.2)) { o.x = nx; o.z = nz; }
      car.vx *= 0.86; car.vz *= 0.86; car.lastSpeed = NaN; // the car loses some speed
      this.audio.punch?.(1);
      this.say(o, HURT);
      if (kind === 'cop') { o.task = null; this.police.offence('assault', car); return; }
      if (kind === 'ped') { this.free(o, 'down'); o.combat.t = 3.5 + Math.random() * 2.5; o.hp = 0.5; }
      else { o.basePose ??= o.pose; o.pose = POSE.FALLEN; o.downT = 4 + Math.random() * 2; this.knocked.push(o); }
      this.police.offence('hitrun', car);
    };
    for (const p of this.street.peds) test(p, 'ped');
    for (const f of this.street.fixtures.values()) for (const p of f.people || []) test(p, 'npc');
    for (const c of this.police.cops) test(c, 'cop');
  }

  // ------------------------------------------------------------------ frame
  update(dt, input, onFoot) {
    this.onFoot = onFoot;
    this.time = (this.time || 0) + dt;
    this.cool -= dt;
    this.offenceCool -= dt;
    const w = this.walker;
    if (w.action) { w.action.t -= dt; if (w.action.t <= 0) w.action = null; }
    if (w.hurt > 0) w.hurt -= dt;
    w.aiming = onFoot && (this.view.aim || (this.weapon === 'fists' && w.attacking > 0));
    // Guard up (right mouse with fists): blows do a fraction of the damage and don't knock you back.
    this.blocking = onFoot && this.weapon === 'fists' && (this.view.aim || input.aim) && !w.action && w.down <= 0;
    // Who we're fighting (for the HUD), flinch timers, and the crowd a fight draws.
    this.foe = null;
    let fd = 9;
    for (const p of this.street.peds) {
      if (p.hitT > 0) p.hitT -= dt;
      if (p.free && p.combat?.mode === 'fight') { const d = Math.hypot(p.x - w.pos.x, p.z - w.pos.z); if (d < fd) { fd = d; this.foe = p; } }
    }
    for (const f of this.street.fixtures.values()) for (const p of f.people || []) if (p.hitT > 0) p.hitT -= dt;
    if (this.foe && onFoot) {
      this.crowdT = (this.crowdT || 0) - dt;
      if (this.crowdT <= 0) {
        this.crowdT = 1.2 + Math.random() * 1.2;
        const near = this.street.peds.filter((q) => !q.combat && q.state === 'walk' && Math.hypot(q.x - w.pos.x, q.z - w.pos.z) < 14);
        const q = near[Math.floor(Math.random() * near.length)];
        if (q) {
          q.state = 'watch'; q.watch = w.pos; q.timer = 4 + Math.random() * 3;
          if (Math.random() < 0.6) this.say(q, ['Maar! Maar!', 'Arre chhodo yaar!', 'Reel bana raha hoon!', 'Police ko bulao!', 'Wah! Kya punch tha!', 'Jhagda! Jhagda!', 'Sahi ja raha hai!']);
        }
      }
    }
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
