// Weapon wheel (§14 of the UI study: recognition rather than recall). Hold Tab / LB: every
// weapon slot is visible at once with its name and ammo; point with the mouse or the right stick,
// let go to equip. The game slows down while it is open. Empty slots show what will come later.
import { ICONS } from './icons.js';

const $ = (id) => document.getElementById(id);
// Eight slots round the wheel, clockwise from the top. `weapon` is an index into WEAPONS or null.
const SLOTS = [
  { id: 'pistol', label: 'Pistol', weapon: 1 }, { id: 'smg', label: 'SMG', weapon: null }, { id: 'rifle', label: 'Rifle', weapon: null },
  { id: 'heavy', label: 'Heavy', weapon: null }, { id: 'throwable', label: 'Throwables', weapon: null }, { id: 'melee', label: 'Melee', weapon: null },
  { id: 'fists', label: 'Fists', weapon: 0 }, { id: 'shotgun', label: 'Shotgun', weapon: null },
];
const R = 165;

export class WeaponWheel {
  constructor(weapons, sound) {
    this.weapons = weapons; this.sound = sound;
    this.open = false; this.hover = -1; this.cx = 0; this.cy = 0;
    $('wheel-ring').innerHTML = SLOTS.map((s, i) => {
      const a = (i / SLOTS.length) * Math.PI * 2 - Math.PI / 2;
      return `<div class="slot ${s.weapon === null ? 'empty' : ''}" style="left:${220 + Math.cos(a) * R}px;top:${220 + Math.sin(a) * R}px"><div class="ico"></div><span>${s.label}</span></div>`;
    }).join('');
    this.els = [...$('wheel-ring').children];
    this.els.forEach((el, i) => { el.querySelector('.ico').style.backgroundImage = ICONS[SLOTS[i].id]; });
  }

  show() {
    this.open = true; this.cx = 0; this.cy = 0;
    this.hover = SLOTS.findIndex((s) => s.weapon === this.weapons.current);
    $('wheel').hidden = false; this.paint(); this.sound('open');
  }

  /** Close and equip what is highlighted. Returns true if a weapon was picked. */
  hide() {
    this.open = false; $('wheel').hidden = true;
    const s = SLOTS[this.hover];
    if (s && s.weapon !== null) { this.weapons.select(s.weapon); this.sound('select'); return true; }
    return false;
  }

  /** Mouse movement (pixels) or right-stick deflection points at a slot. */
  update(input) {
    if (!this.open) return;
    let x = this.cx + input.look.x, y = this.cy + input.look.y;
    if (input.pad) { const ax = input.pad.axes[2] || 0, ay = input.pad.axes[3] || 0; if (Math.hypot(ax, ay) > 0.5) { x = ax * 100; y = ay * 100; } }
    const len = Math.hypot(x, y);
    if (len > 100) { x = (x / len) * 100; y = (y / len) * 100; }
    this.cx = x; this.cy = y;
    if (Math.hypot(x, y) > 35) {
      const a = Math.atan2(y, x) + Math.PI / 2;
      const i = ((Math.round((a / (Math.PI * 2)) * SLOTS.length) % SLOTS.length) + SLOTS.length) % SLOTS.length;
      if (i !== this.hover) { this.hover = i; this.sound('tick'); this.paint(); }
    }
  }

  paint() {
    this.els.forEach((el, i) => el.classList.toggle('on', i === this.hover));
    const s = SLOTS[this.hover];
    let info = '';
    if (s && s.weapon !== null) {
      const w = this.weapons.list[s.weapon], a = this.weapons.ammo[s.weapon];
      info = `<b>${w.name}</b><span>${w.clip ? `${a.clip} / ${a.reserve}` : 'Always with you'}</span>`;
    } else if (s) info = `<b>${s.label}</b><span>Nothing here yet</span>`;
    $('wheel-centre').innerHTML = info;
  }
}
