// Heads-up display: rotating minimap (roads pre-drawn per tile), health and armour, weapon and
// ammo, speed and gear, one context prompt, short messages, street name and the crosshair.
const $ = (id) => document.getElementById(id);
const PX = 0.55;           // minimap pixels per metre
const ROAD_W = [7, 6, 5, 4.2, 3.4, 3, 2.4, 2, 1.6, 1.4, 1, 1, 1.4]; // line width by road class (px)

export class Hud {
  constructor(world) {
    this.world = world;
    this.el = $('hud');
    this.map = $('minimap'); this.ctx = this.map.getContext('2d');
    this.tileCanvas = new Map();
    this.lastPrompt = ''; this.lastStreet = '';
  }

  show() { this.el.hidden = false; }

  message(text, seconds = 4) {
    const d = document.createElement('div');
    d.textContent = text;
    $('messages').append(d);
    setTimeout(() => { d.style.opacity = 0; setTimeout(() => d.remove(), 700); }, seconds * 1000);
  }

  prompt(html) {
    if (html === this.lastPrompt) return;
    this.lastPrompt = html;
    $('prompt').hidden = !html;
    $('prompt').innerHTML = html || '';
  }

  vehicleName(name) {
    const el = $('vehicle-name');
    el.textContent = name; el.classList.add('show');
    clearTimeout(this._vn); this._vn = setTimeout(() => el.classList.remove('show'), 2500);
  }

  update({ health, armour, weapon, ammo, reloading, aiming, speed, gear, inCar, x, z, yaw, cars, hit }) {
    $('weapon-name').textContent = weapon.name;
    $('weapon-ammo').innerHTML = weapon.clip ? (reloading ? 'Reloading…' : `<b>${ammo.clip}</b> / ${ammo.reserve}`) : '';
    this.el.querySelector('.health i').style.width = `${Math.max(0, health)}%`;
    this.el.querySelector('.armour i').style.width = `${Math.max(0, armour)}%`;
    $('crosshair').hidden = !aiming;
    $('crosshair').classList.toggle('hit', !!hit);
    $('speedo').hidden = !inCar;
    if (inCar) { $('speed').textContent = Math.round(Math.abs(speed) * 3.6); $('gear').textContent = gear < 0 ? 'R' : gear; }
    const street = this.world.roadNameAt(x, z);
    if (street !== this.lastStreet) { this.lastStreet = street; $('street').textContent = street; }
    this.drawMap(x, z, yaw, cars);
  }

  tileImage(t) {
    let c = this.tileCanvas.get(t.key);
    if (c && c.version === t) return c;
    const size = this.world.size, W = Math.ceil(size * PX);
    c = document.createElement('canvas'); c.width = c.height = W; c.version = t;
    const g = c.getContext('2d');
    g.lineCap = 'round'; g.lineJoin = 'round';
    const L = t.roadLines;
    // Two passes: dark casing, then the road colour.
    for (const pass of [0, 1]) {
      for (let i = 0; i < L.length;) {
        const cls = L[i], n = L[i + 2];
        g.beginPath();
        for (let k = 0; k < n; k++) {
          const x = (L[i + 3 + k * 2] + size / 2) * PX, y = (L[i + 4 + k * 2] + size / 2) * PX;
          if (k) g.lineTo(x, y); else g.moveTo(x, y);
        }
        const w = ROAD_W[cls] ?? 1;
        g.lineWidth = pass ? w : w + 2;
        g.strokeStyle = pass ? (cls <= 2 ? '#c9b46a' : cls <= 4 ? '#bdbdb4' : '#8d908a') : 'rgba(0,0,0,0.55)';
        g.stroke();
        i += 3 + n * 2;
      }
    }
    this.tileCanvas.set(t.key, c);
    return c;
  }

  drawMap(x, z, yaw, cars = []) {
    const g = this.ctx, W = this.map.width, R = W / 2;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, W);
    g.save();
    g.beginPath(); g.arc(R, R, R, 0, Math.PI * 2); g.clip();
    g.fillStyle = 'rgba(28, 46, 52, 0.85)'; g.fillRect(0, 0, W, W); // sea
    // Rotate so the camera's view points up: screen up = view direction (sin yaw, cos yaw).
    // Screen up = view direction (sin yaw, cos yaw); screen right = the view's right (−cos yaw, sin yaw).
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    g.setTransform(-cy, -sy, sy, -cy, R, R);
    const size = this.world.size;
    for (const t of this.world.tiles.values()) {
      const ox = (t.origin[0] - x) * PX, oz = (t.origin[1] - z) * PX;
      if (Math.abs(ox) > W + size * PX || Math.abs(oz) > W + size * PX) continue;
      const img = this.tileImage(t);
      g.fillStyle = 'rgba(58, 62, 58, 0.9)';
      g.fillRect(ox - (size / 2) * PX, oz - (size / 2) * PX, size * PX, size * PX); // land
      g.drawImage(img, ox - (size / 2) * PX, oz - (size / 2) * PX);
    }
    for (const c of cars) {
      g.fillStyle = '#4fa3ff';
      g.fillRect((c.x - x) * PX - 3, (c.z - z) * PX - 3, 6, 6);
    }
    g.restore();
    // Player arrow (always up) and north marker.
    g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(R, R - 9); g.lineTo(R + 6, R + 7); g.lineTo(R, R + 3); g.lineTo(R - 6, R + 7); g.closePath(); g.fill();
    // North (world −z) on screen: (−sin yaw, cos yaw).
    const nx = R - Math.sin(yaw) * (R - 12), ny = R + Math.cos(yaw) * (R - 12);
    g.fillStyle = '#f2b705'; g.font = '700 13px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('N', nx, ny);
  }
}
