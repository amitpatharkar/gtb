// The phone (P / d-pad up): a diegetic interface — an object in the character's hand rather than
// another HUD panel (§15–16 of the UI study). Arrow keys / d-pad move, Enter / A opens, Backspace / B
// goes back, P closes. Mouse clicks work too. You can keep walking while it is out.
//   Maps      pick a place → GPS route (recognition rather than recall)
//   Messages  every notification so far
//   Contacts  people you meet (none yet)
//   Settings  opens the pause menu's settings
const $ = (id) => document.getElementById(id);
const APPS = [
  { id: 'maps', label: 'Maps', icon: '🗺️', bg: '#2e7d4f' },
  { id: 'messages', label: 'Messages', icon: '💬', bg: '#2f6fd6' },
  { id: 'contacts', label: 'Contacts', icon: '👤', bg: '#7a5bd6' },
  { id: 'settings', label: 'Settings', icon: '⚙️', bg: '#59606b' },
];

export class Phone {
  constructor({ places, log, onWaypoint, onSettings, sound }) {
    this.places = places; this.log = log; this.onWaypoint = onWaypoint; this.onSettings = onSettings; this.sound = sound;
    this.open = false; this.app = null; this.sel = 0;
  }

  toggle() { if (this.open) this.close(); else { this.open = true; this.app = null; this.sel = 0; $('phone').hidden = false; this.sound('open'); this.render(); } }
  close() { this.open = false; $('phone').hidden = true; this.sound('back'); }

  items() {
    if (!this.app) return APPS;
    if (this.app === 'maps') return this.places.filter((p) => p.kind !== 'fuel');
    if (this.app === 'messages') return this.log();
    return [];
  }

  render() {
    $('phone-time').textContent = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
    const b = $('phone-body');
    if (!this.app) {
      b.innerHTML = `<div class="apps">${APPS.map((a, i) => `<div class="app ${i === this.sel ? 'on' : ''}" data-i="${i}"><i style="background:${a.bg}">${a.icon}</i>${a.label}</div>`).join('')}</div>`;
    } else if (this.app === 'maps') {
      b.innerHTML = `<h3>Where to?</h3><div class="list">${this.items().map((p, i) => `<div class="${i === this.sel ? 'on' : ''}" data-i="${i}">${p.name}<small>${p.kind === 'landmark' ? 'Landmark' : 'Neighbourhood'}</small></div>`).join('')}</div>`;
    } else if (this.app === 'messages') {
      const m = this.items();
      b.innerHTML = `<h3>Messages</h3><div class="list">${m.length ? m.map((x, i) => `<div class="${i === this.sel ? 'on' : ''}">${x.text}<small>${x.t.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</small></div>`).join('') : '<div>No messages yet.</div>'}</div>`;
    } else if (this.app === 'contacts') {
      b.innerHTML = '<h3>Contacts</h3><div class="list"><div>No contacts yet.<small>People you meet in Colaba will appear here.</small></div></div>';
    }
    $('phone-nav').textContent = this.app ? '↑↓ choose · Enter open · Backspace back' : '←→↑↓ choose · Enter open · P put away';
    b.querySelectorAll('[data-i]').forEach((el) => { el.onclick = () => { this.sel = Number(el.dataset.i); this.activate(); }; });
  }

  activate() {
    if (!this.app) {
      const a = APPS[this.sel];
      if (a.id === 'settings') { this.close(); this.onSettings(); return; }
      this.app = a.id; this.sel = 0; this.sound('select'); this.render(); return;
    }
    if (this.app === 'maps') {
      const p = this.items()[this.sel];
      if (p) { this.onWaypoint(p.x, p.z, p.name); this.sound('select'); this.close(); }
    }
  }

  update(input) {
    if (!this.open) return;
    const n = this.items().length || 1, cols = this.app ? 1 : 3;
    const moved = input.pressed('navDown') ? cols : input.pressed('navUp') ? -cols : input.pressed('navRight') && !this.app ? 1 : input.pressed('navLeft') && !this.app ? -1 : 0;
    if (moved) { this.sel = (this.sel + moved + n) % n; this.sound('move'); this.render(); }
    if (input.pressed('select')) this.activate();
    if (input.pressed('cancel')) { if (this.app) { this.app = null; this.sel = 0; this.sound('back'); this.render(); } else this.close(); }
  }
}
