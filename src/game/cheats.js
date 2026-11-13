// Development cheats. Press ` (backquote) — or double-tap the clock on a phone — and type a
// code; also callable from the console as window.__gtb.cheat('PAISAHIPAISA').
// Names are Mumbai / Bollywood jokes. Toggles show ON/OFF; nothing here is saved except money.

export const CHEATS = [
  { code: 'PAISAHIPAISA', what: '+₹1,00,000', run: (g) => { g.state.earn(100000, 'Paisa hi paisa (cheat)'); return 'Paisa hi paisa! +₹1,00,000'; } },
  { code: 'CHALANMAAF', what: 'clear wanted stars and fines', run: (g) => { clearWanted(g.police); return 'Challan maaf. Hawaldar ne aankh band kar li.'; } },
  { code: 'MAAMUCHUTTI', what: 'police on holiday (toggle)', toggle: 'noPolice', run: (g, on) => { if (on) clearWanted(g.police); g.police.off = on; return on ? 'Maamu chhutti pe hai — no challans' : 'Maamu wapas duty pe'; } },
  { code: 'PETROLBHARO', what: 'full tank + taxi repaired', run: (g) => { g.player.fuel = 1; g.player.condition = 1; g.damage.repair(); return 'Tanki full, gaadi chakachak'; } },
  { code: 'AMRUT', what: 'health, stamina, food, energy full', run: (g) => { g.walker.health = 1; g.walker.stamina = 1; g.state.s.hunger = 1; g.state.s.energy = 1; g.state.save?.(); return 'Amrut pi liya — full power'; } },
  { code: 'SHAKTIMAAN', what: 'god mode (toggle)', toggle: 'god', run: (g, on) => (on ? 'Shaktimaan mode — nothing hurts' : 'Wapas aam aadmi') },
  { code: 'DHOOMMACHALE', what: 'turbo taxi (toggle)', toggle: 'turbo', run: (g, on) => { g.player.maxSpeed = on ? 44 : 26; g.player.accel = on ? 11 : 6.2; return on ? 'Dhoom machale! Turbo taxi' : 'Turbo off'; } },
  { code: 'JADOO', what: 'teleport to the map waypoint', run: (g) => teleport(g) },
  { code: 'SUBAHHOGAYI', what: 'time 7:00 am', run: (g) => { g.clock.hour = 7; return 'Subah ho gayi, mamu!'; } },
  { code: 'DOPEHER', what: 'time 1:00 pm', run: (g) => { g.clock.hour = 13; return 'Dopeher — dhoop kadak'; } },
  { code: 'RAATHOGAYI', what: 'time 9:00 pm', run: (g) => { g.clock.hour = 21; return 'Raat ho gayi — lights on'; } },
  { code: 'TRAFFICJAM', what: 'rush-hour traffic now', run: (g) => { g.clock.hour = 9.5; return 'Peak hour. Best of luck.'; } },
  { code: 'DARSHAN', what: 'the film stars step out to wave now', run: (g) => { g.stars.callOut(); return 'Darshan! The stars are coming out (Bandra and Juhu)'; } },
  { code: 'DEBUGKARO', what: 'frame stats overlay (toggle)', toggle: 'stats', run: (g, on) => (on ? 'Stats on' : 'Stats off') },
];

function clearWanted(police) {
  police.stars = 0; police.fines = 0; police.stopT = 0; police.flagger = null;
  for (const p of police.patrols || []) p.mode = 'leave';
}

function teleport(g) {
  const w = g.cityMap.waypoint;
  if (!w) return 'Set a waypoint on the map first (Tab)';
  const a = g.onFoot ? g.walker : g.player;
  a.pos.set(w.x, g.tiles.groundHeight(w.x, w.z), w.z);
  if (!g.onFoot) a.speed = 0;
  const fade = document.getElementById('fade');
  if (fade) { fade.classList.add('on'); setTimeout(() => fade.classList.remove('on'), 450); }
  return 'Jadoo! Teleported';
}

export class Cheats {
  constructor(game, say) {
    this.g = game;
    this.say = say;
    this.on = {};
    this.box = document.getElementById('cheat');
    this.input = this.box?.querySelector('input');
    this.stats = document.getElementById('stats');
    this.frames = 0; this.acc = 0; this.fps = 0;
    this.input?.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.code === 'Enter') { this.enter(this.input.value); this.close(); }
      if (e.code === 'Escape' || e.code === 'Backquote') { e.preventDefault(); this.close(); }
    });
    addEventListener('keydown', (e) => {
      if (e.code !== 'Backquote' || this.isOpen) return;
      e.preventDefault();
      this.open();
    });
    let last = 0;
    document.getElementById('clock')?.addEventListener('pointerdown', () => { const t = performance.now(); if (t - last < 350) this.open(); last = t; });
  }

  get isOpen() { return !!this.box && !this.box.hidden; }
  open() { if (!this.box) return; this.box.hidden = false; this.input.value = ''; this.input.focus(); this.g.view?.release?.(); }
  close() { if (!this.box) return; this.box.hidden = true; this.input.blur(); }

  /** Run a cheat by code (case and spaces ignored). Returns the message, or null if unknown. */
  enter(text) {
    const code = String(text || '').toUpperCase().replace(/[^A-Z]/g, '');
    if (!code) return null;
    const c = CHEATS.find((x) => x.code === code);
    if (!c) { this.say('Galat code, boss', 1.5); return null; }
    let msg;
    if (c.toggle) { this.on[c.toggle] = !this.on[c.toggle]; msg = c.run(this.g, this.on[c.toggle]); } else msg = c.run(this.g);
    this.say(`🎬 ${msg}`, 2.5);
    return msg;
  }

  /** Every step: keep toggles in force. */
  update(dt) {
    const g = this.g;
    if (this.on.god) { g.walker.health = 1; g.walker.stamina = Math.max(g.walker.stamina, 0.5); g.player.condition = Math.max(g.player.condition, 0.99); }
    if (this.on.noPolice && g.police.stars) clearWanted(g.police);
    if (this.on.stats && this.stats) {
      this.frames++; this.acc += dt;
      if (this.acc >= 0.5) {
        this.fps = Math.round(this.frames / this.acc); this.frames = 0; this.acc = 0;
        const info = g.renderer.info.render, a = g.onFoot ? g.walker : g.player;
        this.stats.textContent = `${this.fps} fps · ${info.calls} calls · ${(info.triangles / 1000).toFixed(0)}k tris · step ${g.stepMs?.toFixed(2) ?? '?'} ms · ${a.pos.x.toFixed(0)}, ${a.pos.z.toFixed(0)} · tiles ${g.tiles.loadedCount} · cars ${g.traffic.cars.length} · peds ${g.street.peds.length}`;
      }
    }
    if (this.stats) this.stats.hidden = !this.on.stats;
  }
}
