import { POSE } from './people.js';
import { COACH_CLASS, CLASS_NAME } from './trains.js';
import { localFare } from '../game/tickets.js';

// Riding a local: step in at an open door (F or E) while the train stands at a platform, ride in
// the doorway the Mumbai way with the city going past, and get off (F) wherever it stops. A
// moving non-AC train can be jumped onto or off at a crawl (people do; you may land on your
// face). Space skips ahead to the station on your ticket (or the next stop): a fade, and the
// clock moves on by the time the train takes.
// Ticket checkers board some trains and stand at some exits; travelling without a ticket that
// covers the trip in that class costs ₹500 plus the fare, and a man in the ladies' coach ₹2,500.

const COACHES = 12, HALF_W = 1.83, RAIL_Y = 0.4, FLOOR = 1.2, DOORS = [-6.6, 0, 6.6];
const NEED = ['II', 'I', 'II', 'I', 'II', 'II'];  // ticket class each coach kind needs (COACH_CLASS order)
const TC_LINES = ['Ticket dikhao, bhai.', 'Ticket, please. Pass bhi chalega.', 'Haan ji, ticket?'];
const FINE = 500, LADIES_FINE = 2500;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const rupees = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export class TrainRide {
  constructor(trains, ctx) {
    this.T = trains;
    Object.assign(this, ctx); // walker, tiles, structures, tickets, hud, bubbles, clock, audio, view, people, snap
    this.r = null;            // the ride: { tr, phys, a, l, cls, from, checked }
    this.prompt = '';
    this.pos = [0, 0];
    addEventListener('keydown', (e) => {
      if (!this.r || e.code !== 'Space' || e.repeat) return;
      e.preventDefault(); e.stopPropagation();
      this.skip();
    }, true);
  }

  get active() { return !!this.r; }

  /** Unit vector along a coach towards the town end, and its right-hand side. */
  frame(tr, i) {
    const up = tr.line.dir === 'up', tx = up ? tr.sn[i] : -tr.sn[i], tz = up ? tr.cs[i] : -tr.cs[i];
    return [tx, tz, -tz, tx];
  }

  /** The open doorway nearest to (x, z) within reach: { tr, i, phys, a, l, x, z, d } or null. */
  door(x, z, reach = 2.4) {
    let best = null;
    for (const tr of this.T.trains.values()) {
      if (!tr.n || (tr.x - x) ** 2 + (tr.z - z) ** 2 > 160 * 160) continue;
      for (let i = 0; i < COACHES; i++) {
        if (!tr.on[i]) continue;
        const cx = tr.cx[i], cz = tr.cz[i];
        if ((cx - x) ** 2 + (cz - z) ** 2 > 14 * 14) continue;
        const [tx, tz, rx, rz] = this.frame(tr, i);
        for (const a of DOORS) for (const l of [-1, 1]) {
          const dx = cx + tx * a + rx * l * HALF_W, dz = cz + tz * a + rz * l * HALF_W, d = Math.hypot(dx - x, dz - z);
          if (d < reach && (!best || d < best.d)) best = { tr, i, phys: tr.line.dir === 'up' ? i : COACHES - 1 - i, a, l, x: dx, z: dz, d };
        }
      }
    }
    return best;
  }

  /** Which station a train is at (or last left): its stop object. */
  stopOf(tr) {
    const L = tr.line, st = L.stations;
    if (tr.leg?.station >= 0) return st[tr.leg.station];
    let best = null;
    for (const s of st) if (s.d <= tr.s + 5) best = s;
    return best || st[0];
  }

  /** HUD hint and the F/E action on foot next to a train. */
  update(dt, onFoot) {
    this.prompt = '';
    if (this.r) { this.ride(dt); return; }
    if (!onFoot || this.T.riding) return;
    const w = this.walker, d = this.door(w.pos.x, w.pos.z);
    if (!d) return;
    const tr = d.tr, cls = (COACH_CLASS[tr.line.route] || COACH_CLASS.C)[d.phys];
    const open = tr.ac ? tr.doors > 0.8 : tr.v < 3;
    if (!open) return;
    const L = tr.line, to = L.end && tr.leg?.station === L.stations.length - 1 ? this.T.lines[L.turn] : L;
    this.prompt = `F: board — ${to?.to || L.to} ${to?.fast ? 'fast' : 'slow'}${tr.ac ? ' (AC)' : ''} · ${CLASS_NAME[cls]} coach`;
  }

  /** F or E next to an open door: step in. */
  tryBoard() {
    if (this.r || this.T.riding) return false;
    const w = this.walker, d = this.door(w.pos.x, w.pos.z);
    if (!d) return false;
    const tr = d.tr;
    if (tr.ac && tr.doors < 0.8) { this.hud.message(tr.v > 0.3 ? 'AC local: the doors are shut.' : 'Wait for the doors to open.'); return true; }
    if (tr.v > 3) { this.hud.message('Too fast to jump on — wait for the next one.'); return true; }
    const cls = (COACH_CLASS[tr.line.route] || COACH_CLASS.C)[d.phys];
    const from = this.stopOf(tr)?.name;
    this.r = { tr, phys: d.phys, a: d.a, l: d.l, cls, from, checked: false, at: from, warned: false, ac: tr.ac };
    this.T.rider = this.r;
    if (tr.v > 0.6 && Math.random() < 0.25) {
      // Running onto a moving local: half in, half out — and then in.
      this.bubbles.say(this.walker, 'Arre arre — pakdo!', 2);
    }
    this.hud.message(`On the ${tr.line.name} ${tr.ac ? 'AC ' : ''}local (${CLASS_NAME[cls]} coach). F: get off at a stop · Space: skip to ${this.target()?.name || 'the next stop'}`);
    if (cls === 2 || cls === 3) this.bubbles.say(this.walker, 'Ladies dabba hai, bhaiyya! Utro!', 3);
    this.ride(0);
    return true;
  }

  /** The station the player's ticket goes to, if this train calls there ahead; else the next stop. */
  target() {
    const r = this.r;
    if (!r) return null;
    const L = r.tr.line, s = r.tr.s;
    const ahead = L.stations.filter((o) => o.d > s + 3 || (r.tr.leg?.station >= 0 && o.i > r.tr.leg.station));
    const t = this.tickets?.list.find((k) => k.sys === 'local' && (k.from === r.from || k.to === r.from));
    const destName = t ? (t.from === r.from ? t.to : t.from) : null;
    return (destName && ahead.find((o) => o.name === destName)) || ahead[0] || null;
  }

  /** Ticket class this coach (or this AC train) needs. */
  need() { return this.r.ac ? 'AC' : NEED[this.r.cls]; }

  /** Rail distance between two stations (the network graph of the trains module). */
  dist(a, b) { return a === b ? 0 : this.T.routes(a).get(b)?.d ?? Infinity; }

  // ---------------------------------------------------------------- riding
  ride(dt) {
    const r = this.r, tr = r.tr, w = this.walker, L = tr.line;
    const i = L.dir === 'up' ? r.phys : COACHES - 1 - r.phys;
    // The train left the map (it runs on to Virar, Kalyan or Panvel): off at the last stop.
    if (!this.T.trains.has(tr.key) || !tr.on[i]) { this.offAtLast(); return; }
    const [tx, tz, rx, rz] = this.frame(tr, i), lat = (HALF_W - 0.42) * r.l;
    w.pos.set(tr.cx[i] + tx * r.a + rx * lat, RAIL_Y + FLOOR, tr.cz[i] + tz * r.a + rz * lat);
    w.speed = 0; w.vx = w.vz = 0;
    // Face out of the door when stopped, along the train (holding the pole, looking ahead) when moving.
    const out = Math.atan2(rx * r.l, rz * r.l), fwd = Math.atan2(tx * (L.dir === 'up' ? 1 : -1), tz * (L.dir === 'up' ? 1 : -1));
    const want = tr.v > 1 ? fwd + r.l * 0.5 * (L.dir === 'up' ? 1 : -1) : out;
    let dh = want - w.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    w.heading += dh * Math.min(1, dt * 3);
    // Arriving somewhere.
    const st = tr.leg?.station ?? -1;
    if (st >= 0 && st !== r.lastStop) {
      r.lastStop = st;
      const s = L.stations[st];
      if (s.name !== r.from) this.atStation(s);
    }
    if (st < 0 && r.lastStop != null && r.lastStop >= 0) {
      r.lastStop = -1;
      const next = L.stations.find((o) => o.d > tr.s);
      if (next) this.hud.message(`Next station: ${next.name} · पुढील स्टेशन ${next.name} · अगला स्टेशन ${next.name}`);
      // Leaving the last stop in the map on a line that runs on beyond it: off here.
      if (!next && !L.end) { this.offAtLast(); return; }
    }
    this.prompt = tr.v < 0.3 && (!tr.ac || tr.doors > 0.8) ? `F: get off at ${this.stopOf(tr)?.name} · Space: skip to ${this.target()?.name || 'next stop'}` : tr.v < 5 && !tr.ac ? 'F: jump off (careful!) · Space: skip ahead' : `Space: skip to ${this.target()?.name || 'next stop'}`;
  }

  /** At each stop: ladies-coach constables, ticket checkers boarding. */
  atStation(s) {
    const r = this.r;
    if ((r.cls === 2 || r.cls === 3) && !r.ladiesFined && Math.random() < 0.7) {
      r.ladiesFined = true;
      this.bubbles.say(this.walker, 'RPF: Gents in the ladies compartment? Chalo, utro. Fine bharo.', 4);
      this.tickets.fine(LADIES_FINE, 'Railway Protection Force: travelling in the ladies coach');
    }
    const odds = r.ac ? 0.3 : r.cls === 1 || r.cls === 3 ? 0.18 : 0.06;
    if (!r.checked && Math.random() < odds) this.check(s.name, 'On board');
  }

  /** A ticket checker looks at your ticket for the trip so far (from → here). */
  check(here, where) {
    const r = this.r;
    r.checked = true;
    const need = this.need(), t = this.tickets.findLocal(r.from, here, need, (a, b) => this.dist(a, b));
    this.bubbles.say(this.walker, `TC: ${TC_LINES[Math.floor(Math.random() * TC_LINES.length)]}`, 3);
    if (t) { this.hud.message(`${where}: the ticket checker looks at your ${t.kind === 'pass' ? 'pass' : 'ticket'} and nods. ✅`); r.ticket = t; return true; }
    const fare = localFare(this.dist(r.from, here) || 1000, need);
    this.tickets.fine(FINE + fare, `Ticketless travel (${need === 'AC' ? 'AC local' : need === 'I' ? 'first class' : 'second class'}), ${r.from} → ${here}: ₹${FINE} penalty + ₹${fare} fare`);
    r.paidTo = here;
    return false;
  }

  /** F while riding: off at the platform (or at a crawl, onto the ballast). */
  alight() {
    const r = this.r;
    if (!r) return false;
    const tr = r.tr, w = this.walker;
    if (tr.ac && tr.doors < 0.8) { this.hud.message('Doors are shut. Wait for the next station.'); return true; }
    if (tr.v > 5) { this.hud.message('Much too fast to jump off!'); return true; }
    const i = tr.line.dir === 'up' ? r.phys : COACHES - 1 - r.phys, [tx, tz, rx, rz] = this.frame(tr, i);
    // Step out on the platform side if there is one.
    let spot = null;
    for (const l of [r.l, -r.l]) for (const off of [HALF_W + 0.7, HALF_W + 1.4]) {
      const x = tr.cx[i] + tx * r.a + rx * l * off, z = tr.cz[i] + tz * r.a + rz * l * off;
      if (this.tiles.hits(x, z, 0.3)) continue;
      const g = this.tiles.groundHeight(x, z), y = this.structures ? this.structures.groundHeight(x, z, 1.6, g) : g;
      if (!spot || (y > 0.9 && spot.y < 0.9)) spot = { x, z, y };
    }
    spot ||= { x: tr.cx[i] + rx * r.l * 3, z: tr.cz[i] + rz * r.l * 3, y: this.tiles.groundHeight(tr.cx[i], tr.cz[i]) };
    w.pos.set(spot.x, spot.y, spot.z);
    w.speed = 0;
    const s = this.stopOf(tr), here = tr.v < 0.3 ? s?.name : null;
    this.r = null; this.T.rider = null;
    if (tr.v > 2) { w.knock(0.05 + tr.v * 0.02); this.hud.message('Jumped off a moving local. Ouch. Don\'t try this at home (or anywhere).'); }
    else if (here && here !== r.from) this.leave(r, here);
    return true;
  }

  /** Off the train at a station: the ticket for the trip is used up, maybe a checker at the exit. */
  leave(r, here) {
    const need = r.ac ? 'AC' : NEED[r.cls], t = r.ticket || this.tickets.findLocal(r.from, here, need, (a, b) => this.dist(a, b));
    if (t) this.tickets.spend(t);
    if (r.paidTo === here) return;
    const big = /Churchgate|Terminus|Dadar|Andheri|Kurla|Bandra|Mumbai Central|Ghatkopar/.test(here);
    if (!r.checked && Math.random() < (big ? 0.2 : 0.07)) {
      if (!t) { r.checked = false; this.check(here, `${here} exit`); }
      else this.bubbles.say(this.walker, 'TC: Theek hai, jao.', 2);
    }
  }

  /** The train runs on beyond the map: the player gets off at the last stop inside it. */
  async offAtLast() {
    const r = this.r, L = r.tr.line, last = L.stations[L.stations.length - 1];
    this.r = null; this.T.rider = null;
    const w = this.walker;
    const p = L.at(last.d), side = last.side === 1 || last.side === -1 ? last.side : 1, off = last.off + 0.8;
    const x = p[0] - p[3] * side * off, z = p[1] + p[2] * side * off;
    this.stations?.()?.buildNow(x, z);
    w.pos.set(x, this.structures ? this.structures.groundHeight(x, z, 2, this.tiles.groundHeight(x, z)) : this.tiles.groundHeight(x, z), z);
    this.hud.message(`This local runs on to ${L.to} — beyond the edge of the map. You got off at ${last.name}.`);
    this.leave(r, last.name);
    this.snap?.();
  }

  /** Space while riding: on to the ticket's station (or the next stop) in a fade. */
  async skip() {
    const r = this.r;
    if (!r || this.busy) return;
    const tr = r.tr, L = tr.line, dest = this.target();
    if (!dest) return;
    const leg = L.legs.find((g) => g.station === dest.i);
    if (!leg) return;
    const tau = this.T.t - L.offset - tr.k * L.period, dt = leg.t0 + 3 - tau;
    if (dt <= 1) return;
    this.busy = true;
    const fade = document.getElementById('fade');
    fade?.classList.add('on');
    await wait(300);
    this.T.t += dt;                       // the timetable moves on (every train is placed by time)
    // The clock moves on by the trip's real-life duration (trains run at real speeds), not by
    // the game's 60× clock, which would turn a 20-minute ride into most of a day.
    this.clock.hour += dt / 3600;
    // Stand by the destination at once, so the train (and the tiles) are found there.
    this.walker.pos.set(dest.x, this.walker.pos.y, dest.z);
    // The stops on the way: checkers may get on at any of them.
    for (const s of L.stations) if (s.i > (r.lastStop ?? -1) && s.i < dest.i && s.name !== r.from && this.r) this.atStation(s);
    await this.tiles.whenReady(dest.x, dest.z, Math.min(300, (this.tiles.loadRadius || 500) - 40));
    this.stations?.()?.buildNow(dest.x, dest.z);
    this.T.fresh = true; this.T.scanT = 0;
    fade?.classList.remove('on');
    this.busy = false;
    this.hud.message(`${dest.name}. ${Math.max(1, Math.round(dt / 60))} minutes on the train.`);
  }

  /** Draw the player standing in the doorway (main.js draws the walker; nothing else needed). */
  get pose() { return POSE.STAND; }
}

export { rupees };
