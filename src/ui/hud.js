// Heads-up display, organised by priority (docs/ui.md, from the GTA V UI study):
//   high priority, always there   — radar with GPS route, health/armour/stamina, weapon + ammo, wanted
//   contextual, when relevant     — objective, prompts with the right button, notifications, area name,
//                                   speedometer in a car, crosshair when aiming
//   secondary                     — stats, settings, log: in the pause menu, not on screen
// HUD modes (Settings): full (everything stays), contextual (default: secondary-status items fade
// out when nothing changes), minimal (radar only with a route; status only when it matters).
import { CATEGORIES } from './places.js';
import { Nav } from './nav.js';
import { withGlyphs } from './glyphs.js';
import { ICONS } from './icons.js';

const $ = (id) => document.getElementById(id);
const TILE_PX = 1.1;        // pixels per metre in the cached tile road images
const ROAD_W = [7, 6, 5, 4.2, 3.4, 3, 2.4, 2, 1.6, 1.4, 1, 1, 1.4];

export class Hud {
  constructor(world, nav, places) {
    this.world = world; this.nav = nav; this.places = places;
    this.el = $('hud');
    this.map = $('minimap'); this.ctx = this.map.getContext('2d');
    this.tileCanvas = new Map();
    this.mode = 'contextual';
    this.last = {};
    this.show = { weapon: 0, bars: 0, area: 0, radar: 0 };
    this.log = [];            // every notification, for Brief and the phone's Messages
    this.onMessage = null;    // sound hook
    this.filters = new Set(Object.keys(CATEGORIES));
    this.pad = false;
    this.messageCount = 0;
  }

  start() { this.el.hidden = false; }
  setMode(m) { this.mode = m; }

  // ---------------------------------------------------------------- contextual pieces
  /** Notification: appears, says its piece, leaves (and goes into the log). */
  message(text, seconds = 5, { sound = true } = {}) {
    const html = withGlyphs(text, this.pad);
    this.log.unshift({ t: new Date(), text: html });
    if (this.log.length > 60) this.log.pop();
    const box = $('messages');
    while (box.children.length >= 3) box.firstElementChild.remove(); // never a wall of text
    const d = document.createElement('div');
    d.innerHTML = html; d.className = 'new';
    box.append(d);
    requestAnimationFrame(() => d.classList.remove('new'));
    setTimeout(() => { d.style.opacity = 0; setTimeout(() => d.remove(), 700); }, seconds * 1000);
    if (sound) this.onMessage?.('message');
    this.messageCount++;
  }

  /** The current objective (null hides it). done: flash it green before it goes. */
  objective(text, done = false) {
    const el = $('objective');
    if (done) { el.classList.add('done'); setTimeout(() => el.classList.remove('done'), 900); return; }
    if (text === this.last.objective) return;
    this.last.objective = text;
    el.hidden = !text;
    el.querySelector('span').innerHTML = text ? withGlyphs(text, this.pad) : '';
    this.show.radar = 6;
  }

  /** One contextual prompt at a time: "{enter} Get in". */
  prompt(text) {
    const html = text ? withGlyphs(text, this.pad) : '';
    if (html === this.last.prompt) return;
    this.last.prompt = html;
    $('prompt').hidden = !html;
    $('prompt').innerHTML = html;
  }

  vehicleName(name) {
    const el = $('vehicle-name');
    el.textContent = name; el.classList.add('show');
    clearTimeout(this._vn); this._vn = setTimeout(() => el.classList.remove('show'), 2500);
  }

  /** Red edges of the screen when hurt (visual feedback, §12). */
  hurt(amount) {
    const v = $('vignette');
    v.style.opacity = Math.min(1, 0.35 + amount / 40);
    clearTimeout(this._hurt); this._hurt = setTimeout(() => { v.style.opacity = this.lowHealth ? 0.35 : 0; }, 350);
    this.show.bars = 6;
  }

  areaName(x, z) {
    let best = null, bd = 260;
    for (const p of this.places) {
      if (p.kind !== 'area' && p.kind !== 'landmark') continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bd) { bd = d; best = p.name; }
    }
    return best || 'Colaba';
  }

  // ---------------------------------------------------------------- per frame
  update(dt, s) {
    this.pad = s.pad;
    for (const k in this.show) this.show[k] = Math.max(0, this.show[k] - dt);
    const full = this.mode === 'full', minimal = this.mode === 'minimal';

    // Weapon and ammo: shown when it matters (aiming, shooting, reloading, low, just changed).
    const w = s.weapon, a = s.ammo;
    const ammoKey = `${w.id}:${a.clip}:${a.reserve}:${s.reloading}`;
    if (ammoKey !== this.last.ammo) { this.last.ammo = ammoKey; this.show.weapon = 4; }
    if (s.aiming || s.reloading || (w.clip && a.clip <= w.clip / 4)) this.show.weapon = Math.max(this.show.weapon, 2);
    if (w.id !== this.last.weaponId) { this.last.weaponId = w.id; $('weapon-icon').style.backgroundImage = ICONS[w.id] || ''; $('weapon-name').textContent = w.name; }
    $('weapon-ammo').innerHTML = w.clip ? (s.reloading ? 'Reloading…' : `<b>${a.clip}</b> / ${a.reserve}`) : '';
    $('weapon-ammo').classList.toggle('low', !!w.clip && a.clip <= w.clip / 4);
    $('weapon').classList.toggle('gone', s.inCar || (!full && !this.show.weapon));

    // Health, armour, stamina strip under the radar.
    const bars = `${Math.round(s.health)}:${Math.round(s.armour)}:${Math.round(s.stamina)}`;
    if (bars !== this.last.bars) { this.last.bars = bars; this.show.bars = 4; }
    if (s.health < 100 || s.stamina < 100) this.show.bars = Math.max(this.show.bars, 1);
    this.el.querySelector('.health i').style.width = `${Math.max(0, s.health)}%`;
    this.el.querySelector('.armour i').style.width = `${Math.max(0, s.armour)}%`;
    this.el.querySelector('.stamina i').style.width = `${Math.max(0, s.stamina)}%`;
    this.lowHealth = s.health < 30;
    this.el.querySelector('.bar.health').classList.toggle('low', this.lowHealth);
    if (this.lowHealth && $('vignette').style.opacity < 0.3) $('vignette').style.opacity = 0.35;
    if (!this.lowHealth && $('vignette').style.opacity == 0.35) $('vignette').style.opacity = 0;
    this.el.querySelector('.strip').classList.toggle('gone', !full && !this.show.bars);

    // Wanted level (police are not in the game yet: nothing to show).
    $('wanted').hidden = !s.wanted;
    if (s.wanted) $('wanted').textContent = '★'.repeat(s.wanted) + '☆'.repeat(5 - s.wanted);

    $('crosshair').hidden = !s.aiming;
    $('crosshair').classList.toggle('hit', !!s.hit);
    $('speedo').hidden = !s.inCar;
    if (s.inCar) { $('speed').textContent = Math.round(Math.abs(s.speed) * 3.6); $('gear').textContent = s.gear < 0 ? 'R' : s.gear; }

    // Area and street: appear when they change (always in full mode).
    const area = this.areaName(s.x, s.z), street = this.world.roadNameAt(s.x, s.z);
    if (area !== this.last.area || (street && street !== this.last.street)) {
      if (area !== this.last.area) { this.last.area = area; $('area-name').textContent = area; }
      if (street) { this.last.street = street; $('street').textContent = street; }
      this.show.area = 5;
    }
    $('area').classList.toggle('gone', !full && !this.show.area);

    // Radar (minimal mode: only with a route, or just after something changed).
    const hasRoute = !!this.nav.target;
    $('radar').classList.toggle('gone', minimal && !hasRoute && !this.show.radar);
    $('radar-distance').hidden = !hasRoute;
    if (hasRoute) $('radar-distance').textContent = Nav.distance(this.nav.remaining);
    this.drawRadar(s);
  }

  // ---------------------------------------------------------------- radar
  tileImage(t) {
    let c = this.tileCanvas.get(t.key);
    if (c && c.tile === t) return c;
    const size = this.world.size, W = Math.ceil(size * TILE_PX);
    c = document.createElement('canvas'); c.width = c.height = W; c.tile = t;
    const g = c.getContext('2d');
    g.lineCap = 'round'; g.lineJoin = 'round';
    const L = t.roadLines;
    for (const pass of [0, 1]) {
      for (let i = 0; i < L.length;) {
        const cls = L[i], n = L[i + 2];
        g.beginPath();
        for (let k = 0; k < n; k++) {
          const x = (L[i + 3 + k * 2] + size / 2) * TILE_PX, y = (L[i + 4 + k * 2] + size / 2) * TILE_PX;
          if (k) g.lineTo(x, y); else g.moveTo(x, y);
        }
        const w = (ROAD_W[cls] ?? 1) * 1.6;
        g.lineWidth = pass ? w : w + 3;
        g.strokeStyle = pass ? (cls <= 2 ? '#d8d0b0' : cls <= 4 ? '#b9bcb6' : '#8a8f8a') : 'rgba(0,0,0,0.5)';
        g.stroke();
        i += 3 + n * 2;
      }
    }
    this.tileCanvas.set(t.key, c);
    return c;
  }

  drawRadar(s) {
    const g = this.ctx, W = this.map.width, H = this.map.height;
    const cx = W / 2, cy = H * 0.64;                      // player sits low: more road ahead
    const S = TILE_PX * (s.inCar ? 1 - Math.min(0.4, Math.abs(s.speed) / 60) : 1); // zoom out at speed
    const yaw = s.yaw, c = Math.cos(yaw), sn = Math.sin(yaw);
    // World (dx, dz) → screen: view direction up, its right to the right (see camera.js yaw).
    const toScreen = (dx, dz) => [cx + (-c * dx + sn * dz) * S, cy + (-sn * dx - c * dz) * S];
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#1f3a44'; g.fillRect(0, 0, W, H); // sea
    g.save();
    g.setTransform(-c * S, -sn * S, sn * S, -c * S, cx, cy);
    const size = this.world.size;
    for (const t of this.world.tiles.values()) {
      const ox = t.origin[0] - s.x, oz = t.origin[1] - s.z;
      if (Math.hypot(ox, oz) > size + Math.hypot(W, H) / S) continue;
      g.fillStyle = '#2f3532';
      g.fillRect(ox - size / 2, oz - size / 2, size, size); // land (tiles cover the coast; good enough on a radar)
      g.drawImage(this.tileImage(t), ox - size / 2, oz - size / 2, size, size);
    }
    // GPS route.
    const R = this.nav.route;
    if (R && this.filters.has('waypoint')) {
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath();
      for (let i = Math.max(0, (this.nav.nearest || 0)); i < R.length; i += 2) { const x = R[i] - s.x, z = R[i + 1] - s.z; if (i === (this.nav.nearest || 0)) g.moveTo(0, 0); g.lineTo(x, z); }
      g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 9 / S; g.stroke();
      g.strokeStyle = '#c46bff'; g.lineWidth = 6 / S; g.stroke();
    }
    g.restore();
    // Blips (always upright), clamped to the edge when off the radar.
    const blip = (wx, wz, colour, icon, size = 15, clamp = false) => {
      let [x, y] = toScreen(wx - s.x, wz - s.z);
      const inside = x > 12 && x < W - 12 && y > 12 && y < H - 12;
      if (!inside) { if (!clamp) return; x = Math.max(12, Math.min(W - 12, x)); y = Math.max(12, Math.min(H - 12, y)); }
      g.font = `700 ${size * 1.6}px system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,0.8)'; g.strokeText(icon, x, y);
      g.fillStyle = colour; g.fillText(icon, x, y);
    };
    for (const p of this.places) if (this.filters.has(p.kind)) blip(p.x, p.z, CATEGORIES[p.kind].colour, CATEGORIES[p.kind].icon, p.kind === 'fuel' ? 12 : 13);
    if (this.filters.has('car')) for (const p of s.cars) blip(p.x, p.z, CATEGORIES.car.colour, '■', 9);
    const t = this.nav.target;
    if (t) blip(t.x, t.z, t.objective ? '#f2b705' : '#c46bff', '◉', 16, true);
    // Player arrow and north.
    g.save(); g.translate(cx, cy);
    g.rotate(s.yaw - s.heading);
    g.beginPath(); g.moveTo(0, -16); g.lineTo(11, 12); g.lineTo(0, 6); g.lineTo(-11, 12); g.closePath();
    g.fillStyle = '#fff'; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.lineWidth = 3; g.stroke(); g.fill();
    g.restore();
    const [nx, ny] = toScreen(0, -1e6);
    const ang = Math.atan2(ny - cy, nx - cx);
    const px = Math.max(16, Math.min(W - 16, cx + Math.cos(ang) * 1000)), py = Math.max(16, Math.min(H - 16, cy + Math.sin(ang) * 1000));
    g.beginPath(); g.arc(px, py, 13, 0, Math.PI * 2); g.fillStyle = 'rgba(0,0,0,0.7)'; g.fill();
    g.fillStyle = '#fff'; g.font = '700 17px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('N', px, py + 1);
  }
}
