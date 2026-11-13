import * as THREE from 'three';
import { POSE, outfit } from '../sim/people.js';

// Story missions, chapter 1 "Naya Shehar": you've just arrived in Mumbai and Mamaji hands
// you his old kaali-peeli. Missions start at a yellow marker (on the map too); each is a
// list of steps: cutscenes (letterbox, camera on the speakers, subtitles; Space skips),
// drive-to, pick-up/drop-off, wait-for-time, and custom goals. Progress is saved.

const ll = (index, lat, lon) => [(lon - index.origin.lon) * index.metresPerDegree.lon, -(lat - index.origin.lat) * index.metresPerDegree.lat];

export class Story {
  constructor({ scene, tiles, index, state, cityMap, hud, bubbles, people, jobs, street, clock, audio }) {
    Object.assign(this, { scene, tiles, index, state, cityMap, hud, bubbles, people, jobs, street, clock, audio });
    state.s.story ||= { done: [], active: null, step: 0 };
    this.el = document.getElementById('objective');
    this.cut = document.getElementById('cutscene');
    this.cast = {};
    this.camera = null;      // { pos, look } while a cutscene runs
    this.markerT = 0;
    this.stepT = 0;
    this.entered = false;    // a mission loaded from a save is re-entered on the first update
    const g = new THREE.CylinderGeometry(1.6, 1.6, 0.25, 24, 1, true);
    this.marker = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(0xf7c600).multiplyScalar(2), transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 30, 8, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xf7c600).multiplyScalar(1.5), transparent: true, opacity: 0.25, depthWrite: false }));
    scene.add(this.marker, this.beam);
    const L = (id) => index.landmarks?.find((l) => l.id === id);
    const term = L('terminus'), gw = L('gateway');
    const P = {
      start: index.spawn ? [index.spawn.x + 8, index.spawn.z + 4] : [0, 0],
      crawford: ll(index, 18.9475, 72.8340),
      terminus: term ? [term.x, term.z] : ll(index, 18.9400, 72.8355),
      marine: ll(index, 18.9440, 72.8230),
      maidan: ll(index, 18.9395, 72.8325),
      gateway: gw ? [gw.x, gw.z] : ll(index, 18.9220, 72.8347),
    };
    this.places = P;
    this.missions = [
      {
        id: 'welcome', title: 'Mumbai Meri Jaan', at: P.start,
        steps: [
          { cut: [['mamaji', 'Aa gaya bhanje! Welcome to Bombay. Yeh shehar sabko kuch na kuch deta hai.'], ['mamaji', 'Yeh meri purani kaali-peeli. Ab se teri. Dhyan se chalana, iski umar mujhse zyada hai.'], ['you', 'Thank you, Mamaji! Main aapko nirash nahi karunga.'], ['mamaji', 'Pehla kaam: Crawford Market se Shabbir bhai ko utha, unko Chai Terminus chhodna hai. Jaldi!']] },
          { goto: P.crawford, label: 'Pick up Shabbir bhai at Crawford Market', taxi: true },
          { pickup: 'shabbir', at: P.crawford, line: 'Arre, Mamaji ka bhanja! Chal, station chal. Train nahi chhootni chahiye!' },
          { goto: P.terminus, label: 'Drop Shabbir bhai at Chhatrapati Chai Terminus', taxi: true, limit: 240, fail: 'Shabbir bhai missed his train!' },
          { dropoff: 'shabbir', line: 'Shabaash! Time pe pahuncha diya. Yeh le, chai-paani.' },
          { reward: 500 },
        ],
      },
      {
        id: 'sunset', title: 'Marine Drive Ki Shaam', after: 'welcome', at: P.start,
        steps: [
          { cut: [['mamaji', 'Bhanje, Bombay aaya aur Marine Drive ki shaam nahi dekhi? Chal, mujhe le chal.'], ['mamaji', 'Suraj doobne se pehle pahunchna. Wahan ki cutting chai jaisi chai kahin nahi.']] },
          { pickup: 'mamaji', at: P.start, line: 'Chal, Queen\'s Necklace dekhte hain!' },
          { goto: P.marine, label: 'Drive Mamaji to Marine Drive (before 7:30 PM)', taxi: true },
          { waitHour: [17.5, 19.5], label: 'Wait for sunset on Marine Drive (T skips an hour)' },
          { dropoff: 'mamaji', line: 'Dekh, yeh hai Mumbai. Mehnat kar, yeh shehar tera bhi hoga.' },
          { reward: 300 },
        ],
      },
      {
        id: 'firstrides', title: 'Pehli Sawaari', after: 'sunset', at: P.start,
        steps: [
          { cut: [['mamaji', 'Ab asli kaam. Kidhar Driver app pe duty laga (J), teen sawaari utha.'], ['mamaji', 'Aaraam se chalana. Rating achhi hogi toh kamaai achhi hogi.']] },
          { task: 'rides', count: 3, label: 'Complete 3 Kidhar rides with an average of 3.5★ or more' },
          { reward: 1000, line: 'Teen sawaari, achhi rating! Mamaji proud hai.' },
        ],
      },
      {
        id: 'holi', title: 'Holi Hai!', after: 'firstrides', at: P.maidan,
        steps: [
          { cut: [['mamaji', 'Aaj Holi hai, bhanje! Maidan pe sab rang khel rahe hain.'], ['mamaji', 'Taxi chhod (F), pichkari utha (2) aur das logon ko rang laga. Bura na mano, Holi hai!']] },
          { goto: P.maidan, label: 'Go to Azad Maidan', taxi: false },
          { task: 'colour', count: 10, limit: 150, label: 'Colour 10 people with the pichkari', fail: 'Holi khatam ho gayi! Try again.' },
          { reward: 500, line: 'Wah! Poora maidan rangeen kar diya!' },
        ],
      },
    ];
  }

  get s() { return (this.state.s.story ||= { done: [], active: null, step: 0 }); }

  /** The next mission waiting to start, if any. */
  available() {
    if (this.s.active) return null;
    return this.missions.find((m) => !this.s.done.includes(m.id) && (!m.after || this.s.done.includes(m.after))) || null;
  }

  person(id) {
    if (this.cast[id]) return this.cast[id];
    const look = id === 'mamaji' ? { ...outfit('office'), shirt: new THREE.Color(0xf2efe6), pants: new THREE.Color(0xf2efe6) } : outfit('casual');
    return (this.cast[id] = { ...look, x: 0, y: 0.2, z: 0, heading: 0, phase: 0, pose: POSE.STAND, amp: 1, flags: id === 'mamaji' ? 1 : 0, scale: 1, h: 2.2, name: id === 'mamaji' ? 'Mamaji' : 'Shabbir bhai' });
  }

  start(m, ctx) {
    this.s.active = m.id; this.s.step = 0; this.stepT = 0; this.entered = true;
    this.hud.message(`Mission: ${m.title}`);
    this.audio?.whistle?.(0.2);
    this.enterStep(ctx);
  }

  fail(why) {
    this.hud.message(`Mission failed: ${why || 'try again'}`);
    this.s.active = null; this.s.step = 0;
    this.cityMap.setWaypoint(null);
    this.cast = {};
  }

  enterStep(ctx, resume = false) {
    const m = this.missions.find((x) => x.id === this.s.active);
    if (!m) { this.s.active = null; this.s.step = 0; return; }
    const st = m.steps[this.s.step];
    this.stepT = 0;
    if (!st) { this.s.done.push(m.id); this.s.active = null; this.cast = {}; this.hud.message(`Mission complete: ${m.title}`); this.state.save(); return; }
    if (st.goto) this.cityMap.routeTo(st.goto[0], st.goto[1], st.label);
    if (st.cut) { this.lines = st.cut.slice(); this.lineT = 0; this.showLine(ctx); }
    if (st.task === 'rides') { this.base = { rides: this.state.s.rides, sum: this.state.s.ratingSum }; if (!this.jobs.onDuty) this.jobs.toggleDuty(ctx.player, 'taxi'); }
    if (st.task === 'colour') { this.coloured = new Set(); }
    if (st.pickup) {
      const p = this.person(st.pickup);
      const r = this.tiles.roadAt(st.at[0], st.at[1], 30, true);
      p.x = st.at[0] + 3; p.z = st.at[1] + 2;
      if (r) { const sg = this.tiles.segment(r.tile, r.index); p.x = (sg[0] + sg[2]) / 2 + 2.5; p.z = (sg[1] + sg[3]) / 2 + 2.5; }
      if (st.pickup === 'mamaji' && this.cast.mamaji?.seen) { p.x = ctx.player.pos.x + 3; p.z = ctx.player.pos.z + 2; }
      p.y = this.tiles.groundHeight(p.x, p.z);
      p.inTaxi = false;
      this.cityMap.routeTo(p.x, p.z, p.name);
    }
    if (st.reward && !resume) {
      this.state.earn(st.reward, `Mission: ${m.title}`);
      if (st.line) this.bubbles.say(ctx.player.pos, st.line, 3);
      this.hud.message(`Mission complete: ${m.title} · +₹${st.reward}`);
    }
  }

  showLine(ctx) {
    const [who, text] = this.lines[0];
    const name = who === 'you' ? 'You' : this.person(who).name;
    this.cut.innerHTML = `<div class="bar top"></div><div class="bar bottom"><p><b>${name}:</b> ${text}</p><small>Space to continue</small></div>`;
    this.cut.hidden = false;
    const p = who === 'you' ? null : this.person(who);
    if (p && !p.inTaxi) { p.pose = POSE.ARGUE; }
    this.lineT = Math.max(2.5, text.length * 0.06);
  }

  skip() { if (this.lines?.length || this.ext) this.lineT = 0; }

  /** True while a mission cutscene or an ad-hoc scene is playing. */
  get busy() { return !!this.camera || !!this.ext; }

  /**
   * An ad-hoc cutscene outside the missions (fan meets, easter eggs): `lines` are
   * [speaker name, text], `cam()` gives { pos, look } each frame, `done()` runs at the end.
   * Same letterbox and subtitles as mission cutscenes; Space skips a line.
   */
  playScene(lines, cam, done) {
    if (this.busy) return false;
    this.ext = { lines: lines.slice(), cam, done };
    this.camera = cam();
    this.extLine();
    return true;
  }

  extLine() {
    const [name, text] = this.ext.lines[0];
    this.cut.innerHTML = `<div class="bar top"></div><div class="bar bottom"><p><b>${name}:</b> ${text}</p><small>Space to continue</small></div>`;
    this.cut.hidden = false;
    this.lineT = Math.max(2.6, text.length * 0.065);
  }

  next(ctx) { this.s.step++; this.enterStep(ctx); }

  update(dt, ctx) {
    const { player, onFoot, walker } = ctx;
    const me = onFoot ? walker : player;
    // A save taken mid-mission: rebuild the step's state (cutscene lines, task counters, cast).
    if (this.s.active && !this.entered) { this.entered = true; this.enterStep(ctx, true); }
    if (this.ext) {
      // An ad-hoc scene has the camera until its lines run out.
      this.camera = this.ext.cam();
      this.lineT -= dt;
      if (this.lineT <= 0) {
        this.ext.lines.shift();
        if (this.ext.lines.length) this.extLine();
        else { const done = this.ext.done; this.ext = null; this.cut.hidden = true; this.camera = null; done?.(); }
      }
      return;
    }
    // Mission marker at the next start.
    const avail = this.available();
    this.marker.visible = this.beam.visible = !!avail;
    if (avail) {
      this.markerT += dt;
      const [x, z] = avail.at;
      const y = this.tiles.groundHeight(x, z);
      this.marker.position.set(x, y + 0.2 + Math.sin(this.markerT * 3) * 0.1, z);
      this.beam.position.set(x, y + 15, z);
      if (Math.hypot(me.pos.x - x, me.pos.z - z) < 7 && Math.abs(player.speed) < 3) this.start(avail, ctx);
      this.el.hidden = false;
      this.el.innerHTML = `<b>★ Story:</b> ${avail.title} — go to the yellow marker`;
      return;
    }
    const m = this.missions.find((x) => x.id === this.s.active);
    if (!m) { this.el.hidden = true; return; }
    const st = m.steps[this.s.step];
    if (!st) return;
    this.stepT += dt;
    // Cast: Mamaji waits by the start; passengers stand at the kerb until they get in.
    if (m.id !== 'firstrides') {
      const mam = this.person('mamaji');
      if (!mam.seen) {
        // Stand on the footpath next to the marker, facing the taxi.
        let best = [m.at[0] + 4, m.at[1]];
        for (let a = 0; a < 12; a++) {
          const x = m.at[0] + Math.cos(a * 0.52) * 4.5, z = m.at[1] + Math.sin(a * 0.52) * 4.5;
          if (!this.tiles.hits(x, z, 0.4) && !this.tiles.roadAt(x, z, 0.3, true)) { best = [x, z]; break; }
        }
        [mam.x, mam.z] = best;
        mam.y = this.tiles.groundHeight(mam.x, mam.z); mam.heading = Math.atan2(me.pos.x - mam.x, me.pos.z - mam.z); mam.seen = true;
      }
    }
    for (const p of Object.values(this.cast)) if (!p.inTaxi && !p.gone) { p.phase += dt * 2; this.people.add(p); }
    let objective = st.label || '';
    if (st.cut) {
      // Camera between the speakers; subtitles advance by time or Space.
      const [who] = this.lines[0];
      const p = who === 'you' ? null : this.person(who);
      const fx = p ? p.x : me.pos.x, fz = p ? p.z : me.pos.z;
      // Frame the speaker from the side away from the taxi so nothing blocks them.
      const away = Math.atan2(fz - me.pos.z, fx - me.pos.x);
      const ang = away + Math.PI + 0.75 + Math.sin(this.stepT * 0.2) * 0.2; // in front of the speaker, off to one side
      this.camera = { pos: new THREE.Vector3(fx + Math.cos(ang) * 4.2, (p?.y ?? me.pos.y) + 1.9, fz + Math.sin(ang) * 4.2), look: new THREE.Vector3(fx, (p?.y ?? me.pos.y) + 1.45, fz) };
      this.lineT -= dt;
      if (this.lineT <= 0) {
        this.lines.shift();
        if (this.lines.length) this.showLine(ctx);
        else { this.cut.hidden = true; this.camera = null; for (const p of Object.values(this.cast)) p.pose = POSE.STAND; this.next(ctx); }
      }
      return;
    }
    this.camera = null;
    if (st.limit && this.stepT > st.limit) { this.fail(st.fail); return; }
    if (st.goto) {
      const d = Math.hypot(me.pos.x - st.goto[0], me.pos.z - st.goto[1]);
      if (st.limit) objective += ` · ${Math.max(0, Math.ceil(st.limit - this.stepT))} s`;
      if (d < 22 && (st.taxi === false || !onFoot) && Math.abs(player.speed) < 2.5) this.next(ctx);
    } else if (st.pickup) {
      const p = this.person(st.pickup);
      objective = `Pick up ${p.name} (stop next to them)`;
      if (!onFoot && Math.hypot(player.pos.x - p.x, player.pos.z - p.z) < 8 && Math.abs(player.speed) < 1) {
        p.inTaxi = true;
        this.bubbles.say(player.pos, st.line, 3, 'driver');
        this.next(ctx);
      }
    } else if (st.dropoff) {
      const p = this.person(st.dropoff);
      p.inTaxi = false; p.gone = true;
      this.bubbles.say(player.pos, st.line, 3, 'driver');
      this.next(ctx);
    } else if (st.waitHour) {
      const h = this.clock.hour;
      objective = `${st.label} · now ${this.clock.label}`;
      if (h >= st.waitHour[0] && h <= st.waitHour[1]) this.next(ctx);
      else if (h > st.waitHour[1] && h < 23) objective = 'Missed the sunset — wait for tomorrow evening (T skips hours)';
    } else if (st.task === 'rides') {
      const n = this.state.s.rides - this.base.rides, avg = n ? (this.state.s.ratingSum - this.base.sum) / n : 0;
      objective = `${st.label} · ${n}/${st.count}${n ? ` · avg ${avg.toFixed(1)}★` : ''}`;
      if (n >= st.count) { if (avg >= 3.5) this.next(ctx); else { this.hud.message('Rating too low — Mamaji says: aaraam se! Three more.'); this.base = { rides: this.state.s.rides, sum: this.state.s.ratingSum }; } }
    } else if (st.task === 'colour') {
      for (const p of [...this.street.peds, ...[...this.street.fixtures.values()].flatMap((f) => f.people || [])]) if (p.patches?.length) this.coloured.add(p);
      objective = `${st.label} · ${this.coloured.size}/${st.count} · ${Math.max(0, Math.ceil(st.limit - this.stepT))} s`;
      if (this.coloured.size >= st.count) this.next(ctx);
    } else if (st.reward) {
      this.next(ctx);
    }
    this.el.hidden = !objective;
    this.el.innerHTML = `<b>★ ${m.title}:</b> ${objective}`;
  }
}
