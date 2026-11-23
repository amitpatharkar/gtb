// Pause menu (Esc / Start; M opens it on the map), organised like a game's information
// architecture (docs/ui.md): gameplay stays in the HUD; the world, progress and the system live here.
//   MAP       full map, filters, places list, waypoint
//   BRIEF     current objective, recent messages (the notification log)
//   STATS     progress
//   SETTINGS  every setting with one line saying what it does (§20C of the UI study)
//   GAME      controls, credits, back to Apollo Bunder, replay the tutorial
// Mouse, keyboard (Q/E tabs, ↑↓ rows, ←→ values, Esc back) or controller (LB/RB, d-pad, B).
import { TIERS } from '../core/renderer.js';
import { MapView } from './mapView.js';
import { CATEGORIES } from './places.js';
import { glyph } from './glyphs.js';

const $ = (id) => document.getElementById(id);
const TABS = ['map', 'brief', 'stats', 'settings', 'game'];
const SETTINGS_KEY = 'gtb.settings';
const DEFAULTS = { volume: 0.8, sensitivity: 1, invertY: false, hud: 'contextual', guidance: 'auto', vibration: true };

export function loadSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; } catch { return { ...DEFAULTS }; }
}

const CONTROLS = [
  ['Move', 'move'], ['Look around', 'look'], ['Sprint (uses stamina)', 'sprint'], ['Walk slowly', 'walk'], ['Jump', 'jump'],
  ['Get in / out of a car', 'enter'], ['Aim', 'aim'], ['Shoot', 'fire'], ['Reload', 'reload'], ['Weapon wheel (hold)', 'wheel'],
  ['Accelerate', 'throttle'], ['Brake / reverse', 'brake'], ['Handbrake', 'handbrake'], ['Horn', 'horn'], ['Map', 'map'], ['Phone', 'phone'], ['Pause', 'pause'],
];

export class Menu {
  constructor({ tier, backend, credits, nav, area, onResume, onSettings, actions }) {
    this.open = false; this.tab = 'map';
    this.tier = tier; this.backend = backend; this.credits = credits;
    this.onResume = onResume; this.onSettings = onSettings; this.actions = actions;
    this.settings = loadSettings();
    this.mapView = new MapView(nav, area);
    this.row = 0;
    this.ctx = null; // live data: { stats, log, objective, place, timePlayed, places, filters, cars, player, pad }
    $('pause-tabs').innerHTML = TABS.map((t) => `<button data-tab="${t}">${t}</button>`).join('');
    for (const b of $('pause-tabs').children) b.onclick = () => { this.select(b.dataset.tab); this.actions.sound('move'); };
    onSettings(this.settings);
  }

  show(tab = 'map', ctx) {
    this.ctx = ctx; this.open = true; $('pause').hidden = false;
    this.select(tab);
    this.actions.sound('open');
  }
  hide() { this.open = false; $('pause').hidden = true; this.actions.sound('back'); }

  select(tab) {
    this.tab = tab; this.row = 0;
    for (const b of $('pause-tabs').children) b.classList.toggle('on', b.dataset.tab === tab);
    this.render();
  }

  save() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch { /* private mode */ }
    this.onSettings(this.settings);
  }

  render() {
    const c = this.ctx, pad = c?.pad;
    const now = new Date();
    $('pause-info').innerHTML = `<b>${c?.place || 'Colaba'}</b><br>${now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })} Mumbai · played ${Math.floor((c?.stats.s.timePlayed || 0) / 60)} min`;
    const hints = { map: [['tabs', 'Switch tab'], ['select', 'Set waypoint'], ['back', 'Back']], settings: [['tabs', 'Switch tab'], ['↑↓', 'Choose'], ['←→', 'Change'], ['back', 'Back']] };
    $('pause-hints').innerHTML = (hints[this.tab] || [['tabs', 'Switch tab'], ['back', 'Back']]).map(([a, t]) => `<span>${a.length > 2 ? glyph(a, pad) : `<kbd>${a}</kbd>`} ${t}</span>`).join('');
    const body = $('pause-body');
    if (this.tab === 'map') this.renderMap(body);
    else if (this.tab === 'brief') this.renderBrief(body);
    else if (this.tab === 'stats') body.innerHTML = `<h2>Progress</h2><div class="list">${c.stats.rows().map(([k, v]) => `<div class="row">${k}<span>${v}</span></div>`).join('')}</div>`;
    else if (this.tab === 'settings') this.renderSettings(body);
    else this.renderGame(body);
  }

  renderMap(body) {
    const c = this.ctx;
    body.innerHTML = `<div class="cols"><div id="map-host"></div><div><h2>Show on map</h2><div class="legend">${Object.entries(CATEGORIES).map(([k, v]) => `<label><input type="checkbox" data-cat="${k}" ${c.filters.has(k) ? 'checked' : ''}><i style="color:${v.colour}">${v.icon}</i>${v.label}</label>`).join('')}</div>
      <h2>Places</h2><div class="places">${c.places.filter((p) => p.kind !== 'fuel').map((p) => `<div data-x="${p.x}" data-z="${p.z}" data-name="${p.name}">${CATEGORIES[p.kind].icon} ${p.name}</div>`).join('')}</div>
      ${c.nav.target ? '<p><button class="btn" id="clear-wp">Clear waypoint</button></p>' : ''}</div></div>`;
    const host = body.querySelector('#map-host');
    host.style.height = '100%';
    const mv = this.mapView;
    mv.player = c.player; mv.cars = c.cars;
    if (!this.mapCentred) { mv.centreOn(c.player.x, c.player.z); this.mapCentred = true; }
    mv.mount(host, { places: c.places, filters: c.filters, onPick: (x, z) => this.actions.waypoint(x, z) });
    for (const cb of body.querySelectorAll('.legend input')) cb.onchange = () => { if (cb.checked) c.filters.add(cb.dataset.cat); else c.filters.delete(cb.dataset.cat); mv.draw(); this.actions.sound('move'); };
    for (const p of body.querySelectorAll('.places div')) p.onclick = () => { this.actions.waypoint(Number(p.dataset.x), Number(p.dataset.z), p.dataset.name); mv.centreOn(Number(p.dataset.x), Number(p.dataset.z)); mv.draw(); };
    const clr = body.querySelector('#clear-wp');
    if (clr) clr.onclick = () => { this.actions.waypoint(null); this.render(); };
  }

  renderBrief(body) {
    const c = this.ctx;
    body.innerHTML = `<h2>Current objective</h2><div class="brief-objective">${c.objective || 'Free roam: explore Colaba. Set a destination on the Map.'}</div>
      <h2>Recent messages</h2><div class="log">${c.log.length ? c.log.map((m) => `<div><small>${m.t.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</small>${m.text}</div>`).join('') : '<p class="note">Nothing yet.</p>'}</div>`;
  }

  /** Each setting: label, what it does, and a control. */
  settingRows() {
    const s = this.settings, t = this.tier;
    return [
      { key: 'quality', label: 'Graphics quality', help: `High: sharp cascaded shadows, ambient occlusion, temporal anti-aliasing (smooth edges). Medium: lighter on the graphics card. Low: for phones and older laptops. Changing it restarts the game. Running on ${this.backend}.`,
        options: Object.entries(TIERS).map(([k, v]) => [k, v.name]), value: t.key, set: (v) => { try { localStorage.setItem('gtb.quality', v); } catch { /* */ } const u = new URL(location.href); u.searchParams.delete('quality'); location.href = u.href; } },
      { key: 'hud', label: 'HUD', help: 'Full: everything stays on screen. Contextual: health, weapon and street names show up when they change or matter, then fade. Minimal: the radar only appears with a route.',
        options: [['full', 'Full'], ['contextual', 'Contextual'], ['minimal', 'Minimal']], value: s.hud, set: (v) => { s.hud = v; } },
      { key: 'guidance', label: 'Guidance', help: 'How much the game explains. More: objectives with the buttons to press. Less: objectives only. Off: no tutorial. Auto: more on your first visit, then less, then off.',
        options: [['auto', 'Auto'], ['more', 'More'], ['less', 'Less'], ['off', 'Off']], value: s.guidance, set: (v) => { s.guidance = v; } },
      { key: 'sensitivity', label: 'Camera sensitivity', help: 'How quickly the camera turns when you move the mouse or the right stick.', range: [0.3, 2.5, 0.05], value: s.sensitivity, set: (v) => { s.sensitivity = v; } },
      { key: 'invertY', label: 'Invert vertical look', help: 'Moving the mouse up looks down (like a flight stick).', options: [[false, 'Off'], [true, 'On']], value: s.invertY, set: (v) => { s.invertY = v; } },
      { key: 'volume', label: 'Volume', help: 'Everything you hear: street, engine, shots, menus.', range: [0, 1, 0.05], value: s.volume, set: (v) => { s.volume = v; } },
      { key: 'vibration', label: 'Controller vibration', help: 'The controller rumbles on shots, crashes and when you get hurt.', options: [[true, 'On'], [false, 'Off']], value: s.vibration, set: (v) => { s.vibration = v; } },
    ];
  }

  renderSettings(body) {
    const rows = this.settingRows();
    this.row = Math.min(this.row, rows.length - 1);
    body.innerHTML = rows.map((r, i) => `<div class="setting ${i === this.row ? 'on' : ''}" data-i="${i}"><div class="top">${r.label}${r.range
      ? `<input type="range" min="${r.range[0]}" max="${r.range[1]}" step="${r.range[2]}" value="${r.value}">`
      : `<div class="choice">${r.options.map(([v, l]) => `<button data-v="${v}" class="${String(v) === String(r.value) ? 'on' : ''}">${l}</button>`).join('')}</div>`}</div><p>${r.help}</p></div>`).join('');
    body.querySelectorAll('.setting').forEach((el) => {
      const r = rows[Number(el.dataset.i)];
      el.onmouseenter = () => { this.row = Number(el.dataset.i); body.querySelectorAll('.setting').forEach((x) => x.classList.toggle('on', x === el)); };
      const range = el.querySelector('input');
      if (range) range.oninput = () => { r.set(Number(range.value)); this.save(); };
      for (const b of el.querySelectorAll('button')) b.onclick = () => { const v = r.options.find(([x]) => String(x) === b.dataset.v)[0]; r.set(v); this.save(); this.actions.sound('select'); if (r.key !== 'quality') this.render(); };
    });
  }

  renderGame(body) {
    const pad = this.ctx.pad;
    body.innerHTML = `<div class="cols"><div><h2>Controls (${pad ? 'controller' : 'keyboard and mouse'})</h2><div class="list">${CONTROLS.map(([l, a]) => `<div class="row">${l}<span>${glyph(a, pad)}</span></div>`).join('')}</div></div>
      <div><h2>Game</h2><p><button class="btn primary" id="g-resume">Resume</button></p><p><button class="btn" id="g-home">Back to Apollo Bunder</button></p><p><button class="btn" id="g-tutorial">Replay the tutorial</button></p>
      <p><button class="btn" id="g-tuning">Car tuning panel (F2)</button></p><h2>Credits</h2><div class="note">${this.credits}</div></div></div>`;
    body.querySelector('#g-resume').onclick = () => { this.hide(); this.onResume(); };
    body.querySelector('#g-home').onclick = () => { this.actions.home(); this.hide(); this.onResume(); };
    body.querySelector('#g-tutorial').onclick = () => { this.actions.tutorial(); this.hide(); this.onResume(); };
    body.querySelector('#g-tuning').onclick = () => this.actions.tuning();
  }

  /** Keyboard and controller navigation while open (mouse works directly). */
  update(input) {
    if (!this.open) return;
    const i = TABS.indexOf(this.tab);
    if (input.pressed('tabPrev')) { this.select(TABS[(i + TABS.length - 1) % TABS.length]); this.actions.sound('move'); }
    if (input.pressed('tabNext')) { this.select(TABS[(i + 1) % TABS.length]); this.actions.sound('move'); }
    if (input.pressed('cancel') || input.pressed('pause')) { this.hide(); this.onResume(); return; }
    if (this.tab === 'settings') {
      const rows = this.settingRows();
      if (input.pressed('navUp')) { this.row = (this.row + rows.length - 1) % rows.length; this.actions.sound('move'); this.render(); }
      if (input.pressed('navDown')) { this.row = (this.row + 1) % rows.length; this.actions.sound('move'); this.render(); }
      const dir = input.pressed('navRight') ? 1 : input.pressed('navLeft') ? -1 : 0;
      if (dir) {
        const r = rows[this.row];
        if (r.range) r.set(Math.min(r.range[1], Math.max(r.range[0], Number((r.value + dir * r.range[2] * 2).toFixed(2)))));
        else { const k = r.options.findIndex(([v]) => String(v) === String(r.value)); r.set(r.options[(k + dir + r.options.length) % r.options.length][0]); }
        if (r.key !== 'quality') { this.save(); this.render(); }
        this.actions.sound('select');
      }
    } else if (this.tab === 'map') {
      const mv = this.mapView, k = 14;
      if (input.down('navUp')) mv.pan(0, -k); if (input.down('navDown')) mv.pan(0, k);
      if (input.down('navLeft')) mv.pan(-k, 0); if (input.down('navRight')) mv.pan(k, 0);
      if (input.pad) { const ax = input.pad.axes[0] || 0, ay = input.pad.axes[1] || 0; if (Math.abs(ax) > 0.2 || Math.abs(ay) > 0.2) mv.pan(ax * 16, ay * 16); const z = (input.pad.buttons[7]?.value || 0) - (input.pad.buttons[6]?.value || 0); if (Math.abs(z) > 0.1) mv.zoom(1 + z * 0.04); }
      if (input.pressed('select')) { this.actions.waypoint(mv.cx, mv.cz); }
    }
  }
}
