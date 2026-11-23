// Full-screen city map (Tab, or tap the radar), GTA style: pan and zoom over the whole map,
// tap to drop a waypoint, and the GPS draws the shortest legal route (one-ways respected)
// on the map and on the radar. The game pauses while the map is open.
// The map and the route finding use one small overview file, loaded the first time they are
// needed and handled by a Web Worker (src/ui/mapWorker.js): roads, rails, land, water, parks.
// Buildings come from the tiles already loaded around the player.

const LABELS = [
  ['Colaba', 18.9105, 72.8165], ['Cuffe Parade', 18.9145, 72.8205], ['Apollo Bunder', 18.9225, 72.8335], ['Nariman Point', 18.9255, 72.8225],
  ['Fort', 18.9345, 72.8355], ['Ballard Estate', 18.9395, 72.8425], ['Churchgate', 18.9335, 72.8265], ['Marine Drive', 18.9440, 72.8230],
  ['Azad Maidan', 18.9395, 72.8325], ['Kalbadevi', 18.9485, 72.8290], ['Girgaon', 18.9545, 72.8180], ['Malabar Hill', 18.9560, 72.8040],
  ['Dongri', 18.9580, 72.8370], ['Grant Road', 18.9630, 72.8160], ['Mazgaon', 18.9660, 72.8450], ['Back Bay', 18.9300, 72.8150],
  // The island city north of Byculla and the suburbs.
  ['Byculla', 18.9770, 72.8330], ['Haji Ali', 18.9800, 72.8130], ['Mahalaxmi', 18.9850, 72.8230], ['Lower Parel', 18.9980, 72.8280],
  ['Worli', 19.0080, 72.8160], ['Worli Sea Face', 19.0200, 72.8150], ['Parel', 19.0010, 72.8410], ['Prabhadevi', 19.0160, 72.8290],
  ['Dadar', 19.0190, 72.8430], ['Shivaji Park', 19.0270, 72.8385], ['Wadala', 19.0170, 72.8580], ['Matunga', 19.0270, 72.8550],
  ['Mahim', 19.0390, 72.8420], ['Dharavi', 19.0440, 72.8555], ['Sion', 19.0430, 72.8650], ['Bandra', 19.0560, 72.8330],
  ['Bandstand', 19.0505, 72.8215], ['BKC', 19.0650, 72.8650], ['Khar', 19.0710, 72.8350], ['Santacruz', 19.0830, 72.8390],
  ['Juhu', 19.1030, 72.8270], ['Vile Parle', 19.1000, 72.8440], ['Airport', 19.0920, 72.8660], ['Kurla', 19.0700, 72.8830],
  ['Andheri', 19.1190, 72.8460], ['Chembur', 19.0560, 72.9000], ['Ghatkopar', 19.0860, 72.9080], ['Saki Naka', 19.1040, 72.8870],
  ['Powai', 19.1240, 72.8990], ['Hiranandani', 19.1170, 72.9100],
];

import { drawIcon, EMOJI, icon } from './icons.js';

// Look: a dark, moody map. Black land, teal sea, grey lanes, pale roads, orange main roads.
const SEA = '#0c262c', LAND = '#121a19';

export class CityMap {
  constructor({ index, baseUrl, fuel, hud, tiles = null }) {
    Object.assign(this, { index, baseUrl, fuel, hud, tiles });
    this.open = false;
    this.waypoint = null;
    this.route = null;
    this.routeT = 0;
    this.routeSeq = 0;
    this.routing = false;
    this.calls = new Map();
    this.nextCall = 1;
    this.buildingPaths = new WeakMap(); // loaded tile → Path2D of its building footprints
    this.el = document.createElement('div');
    this.el.id = 'map-screen';
    this.el.hidden = true;
    this.el.innerHTML = `
      <canvas></canvas>
      <div class="map-top"><div class="map-tabs"><b>Map</b><span class="chip on">All</span><span class="map-name">${index.name || 'Mumbai'}</span></div><span class="map-hint">Drag to move · scroll or pinch to zoom · tap to set a waypoint</span>
        <button class="map-clear">Clear route</button><button class="map-close" aria-label="Close">${icon('x')}</button></div>
      <div class="map-legend"><i style="background:#e0902f"></i>Main road <i style="background:#cfd2a8"></i>Road <i style="background:#7d8782"></i>Lane <i style="background:#2f4a36"></i>Park
        <i style="background:#c13bd9"></i>GPS route <span>${icon('fuel')} Petrol</span><span>${icon('star')} Landmark</span></div>
      <div class="map-bar"><button data-z="0.7"><kbd>−</kbd>Zoom out</button><button data-z="1.43"><kbd>+</kbd>Zoom in</button><button class="map-back"><kbd>Esc</kbd>Back</button></div>
      <div class="map-credit">Map data © OpenStreetMap contributors</div>`;
    document.body.appendChild(this.el);
    this.canvas = this.el.querySelector('canvas');
    this.g = this.canvas.getContext('2d');
    this.el.querySelector('.map-close').onclick = () => this.toggle(false);
    this.el.querySelector('.map-back').onclick = () => this.toggle(false);
    for (const b of this.el.querySelectorAll('[data-z]')) b.onclick = () => { this.view.scale = Math.min(4, Math.max(0.05, this.view.scale * Number(b.dataset.z))); this.draw(); };
    this.el.querySelector('.map-clear').onclick = () => { this.setWaypoint(null, this.waypoint?.owner); this.draw(); };
    this.view = { x: 0, z: 0, scale: 0.12 };
    this.W = innerWidth; this.H = innerHeight;
    this.host = null; // set by the game: the map then lives inside the hub menu ({ open(), close() })
    this.bindInput();
    const refit = () => { if (this.open) { this.resize(); this.draw(); } };
    addEventListener('resize', refit);
    new ResizeObserver(refit).observe(this.el);
  }

  // ------------------------------------------------------------------ data (in the worker)
  /** Ask the map worker; resolves with its result. */
  call(type, msg = {}) {
    if (!this.worker) {
      this.worker = new Worker(new URL('./mapWorker.js', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e) => {
        const cb = this.calls.get(e.data.id);
        this.calls.delete(e.data.id);
        if (cb) (e.data.error ? cb.reject(new Error(e.data.error)) : cb.resolve(e.data.result));
      };
    }
    const id = this.nextCall++;
    return new Promise((resolve, reject) => {
      this.calls.set(id, { resolve, reject });
      this.worker.postMessage({ id, type, ...msg });
    });
  }

  /** Download the overview and build the road graph (once). Resolves with the map chunks. */
  async load() {
    if (this.data) return this.data;
    if (this.loading) return this.loading;
    this.loading = (async () => {
      const file = this.index.overview?.file || 'overview.bin.gz';
      const v = this.index.generated ? `?v=${encodeURIComponent(this.index.generated)}` : ''; // versioned like the tiles (tiles.js fileUrl)
      const res = await this.call('load', { url: new URL(this.baseUrl + file + v, location.href).href });
      this.labels = res.labels;
      this.stats = res.stats;
      this.data = res.chunks;
      return this.data;
    })();
    this.loading.catch((err) => { console.error('City map failed to load:', err); this.loading = null; });
    return this.loading;
  }

  /** A random spot on the road network min..max metres from (x, z) (taxi fares): { x, z } or null. */
  async randomPlace(x, z, min, max) {
    try { await this.load(); } catch { return null; }
    return this.call('random', { x, z, min, max });
  }

  /**
   * Several things can want the GPS at once (a mission, a taxi fare, a place you tapped): each
   * owner keeps its own target, the newest one shows, and when it is done the one before returns.
   */
  setWaypoint(p, owner = 'user') {
    this.targets = (this.targets || []).filter((t) => t.owner !== owner);
    if (p) this.targets.push({ ...p, owner });
    this.waypoint = this.targets[this.targets.length - 1] || null;
    this.route = null;
    this.routeT = 0;
    this.routeSeq++;
  }

  /** Called every frame: keep the GPS route fresh while driving (the worker finds it). */
  update(dt, player) {
    if (!this.waypoint || !this.data) return;
    if (Math.hypot(player.pos.x - this.waypoint.x, player.pos.z - this.waypoint.z) < 25) {
      this.hud.message(this.waypoint.label ? `Arrived: ${this.waypoint.label}` : 'You have arrived');
      this.setWaypoint(null, this.waypoint.owner);
      return;
    }
    this.routeT -= dt;
    if (this.routeT > 0 || this.routing) return;
    this.routeT = 1.5;
    const wp = this.waypoint, seq = this.routeSeq;
    this.routing = true;
    this.call('route', { fx: player.pos.x, fz: player.pos.z, heading: player.heading ?? null, gx: wp.x, gz: wp.z }).then((res) => {
      this.routing = false;
      if (seq !== this.routeSeq) return; // the waypoint changed meanwhile
      const r = [];
      const p = res?.path;
      if (p) for (let i = 0; i < p.length; i += 2) r.push([p[i], p[i + 1]]);
      // Drop route nodes right next to the player so the line starts cleanly ahead.
      const P = player.pos;
      while (r.length > 2 && Math.hypot(r[0][0] - P.x, r[0][1] - P.z) < 8) r.shift();
      this.route = p ? [[P.x, P.z], ...r, [wp.x, wp.z]] : null;
      if (this.open) this.draw();
    }, (err) => { this.routing = false; console.error('GPS route failed:', err); });
  }

  /** Route to a place from outside the map (phone apps, missions). */
  async routeTo(x, z, label, owner = 'user') {
    try { await this.load(); } catch { this.hud.message('GPS unavailable right now'); return; }
    this.setWaypoint({ x, z, label }, owner);
  }

  // ------------------------------------------------------------------ screen
  /** Open or close the map. With a host (the hub menu) this asks the host, which calls activate()/deactivate(). */
  toggle(on = !this.open, player = this.player) {
    if (player) this.player = player;
    if (this.host) { if (on) this.host.open(); else this.host.close(); return; }
    return on ? this.activate(player) : this.deactivate();
  }

  deactivate() { this.open = false; this.el.hidden = true; }

  async activate(player = this.player) {
    this.open = true;
    this.el.hidden = false;
    this.el.classList.toggle('embedded', !!this.host);
    this.player = player;
    this.resize();
    if (player) { this.view.x = player.pos.x; this.view.z = player.pos.z; this.view.scale = Math.max(this.view.scale, 0.35); }
    this.g.setTransform(1, 0, 0, 1, 0, 0);
    this.g.fillStyle = SEA; this.g.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.g.fillStyle = '#fff'; this.g.font = '20px sans-serif'; this.g.fillText('Loading map…', 30, 90);
    try { await this.load(); } catch { this.g.fillText('Map unavailable — try again in a moment', 30, 120); return; }
    this.draw();
  }

  resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    this.dpr = dpr;
    this.W = this.el.clientWidth || innerWidth;
    this.H = this.el.clientHeight || innerHeight;
    this.canvas.width = this.W * dpr;
    this.canvas.height = this.H * dpr;
    this.canvas.style.width = `${this.W}px`;
    this.canvas.style.height = `${this.H}px`;
  }

  /** Screen (client) position to world metres. */
  toWorld(cx, cy) {
    const { x, z, scale } = this.view, r = this.canvas.getBoundingClientRect();
    return { x: x + (cx - r.left - this.W / 2) / scale, z: z + (cy - r.top - this.H / 2) / scale };
  }

  bindInput() {
    const c = this.canvas;
    const pts = new Map();
    let moved = 0, pinch = null;
    c.addEventListener('pointerdown', (e) => { c.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); moved = 0; if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), s: this.view.scale }; } });
    c.addEventListener('pointermove', (e) => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p[0], dy = e.clientY - p[1];
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2 && pinch) {
        const [a, b] = [...pts.values()];
        this.view.scale = Math.min(4, Math.max(0.05, pinch.s * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d));
        moved += 10;
      } else {
        moved += Math.abs(dx) + Math.abs(dy);
        this.view.x -= dx / this.view.scale; this.view.z -= dy / this.view.scale;
      }
      this.draw();
    });
    c.addEventListener('pointerup', (e) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (moved < 6 && this.data) {
        const w = this.toWorld(e.clientX, e.clientY);
        const wp = this.waypoint;
        if (wp && Math.hypot((wp.x - w.x) * this.view.scale, (wp.z - w.z) * this.view.scale) < 18) this.setWaypoint(null);
        else this.setWaypoint({ x: w.x, z: w.z });
        if (this.player) this.update(10, this.player);
        this.draw();
      }
    });
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const before = this.toWorld(e.clientX, e.clientY);
      this.view.scale = Math.min(4, Math.max(0.05, this.view.scale * Math.exp(-e.deltaY * 0.0015)));
      const after = this.toWorld(e.clientX, e.clientY);
      this.view.x += before.x - after.x; this.view.z += before.z - after.z;
      this.draw();
    }, { passive: false });
  }

  /** Path2D for one layer of a map chunk, built the first time it is drawn. */
  path(chunk, layer) {
    const cache = (chunk.paths ||= {});
    if (cache[layer]) return cache[layer];
    const { pts, starts } = chunk.layers[layer];
    const closed = !layer.startsWith('road') && layer !== 'rails';
    const p = new Path2D();
    for (let i = 0; i + 1 < starts.length; i++) {
      for (let k = starts[i]; k < starts[i + 1]; k++) (k === starts[i] ? p.moveTo : p.lineTo).call(p, pts[k * 2], pts[k * 2 + 1]);
      if (closed) p.closePath();
    }
    return (cache[layer] = p);
  }

  /** Building footprints of a loaded tile (the overview has none), from its collision outlines. */
  buildingsPath(t) {
    let p = this.buildingPaths.get(t);
    if (p) return p;
    p = new Path2D();
    const s = t.collide.solid, c = s.coords;
    for (let r = 0; r + 1 < s.ringStart.length; r++) {
      const a = s.ringStart[r], b = s.ringStart[r + 1];
      for (let k = a; k < b; k++) (k === a ? p.moveTo : p.lineTo).call(p, c[k * 2], c[k * 2 + 1]);
      p.closePath();
    }
    this.buildingPaths.set(t, p);
    return p;
  }

  draw() {
    if (!this.open) return;
    const g = this.g, dpr = this.dpr, { x, z, scale } = this.view;
    const W = this.W, H = this.H;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = SEA;
    g.fillRect(0, 0, W, H);
    if (!this.data) return;
    g.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (W / 2 - x * scale), dpr * (H / 2 - z * scale));
    const vx0 = x - W / 2 / scale, vx1 = x + W / 2 / scale, vz0 = z - H / 2 / scale, vz1 = z + H / 2 / scale;
    const vis = this.data.filter((c) => c.bbox[2] > vx0 && c.bbox[0] < vx1 && c.bbox[3] > vz0 && c.bbox[1] < vz1);
    const px = 1 / scale;
    const fill = (style, layer) => { g.fillStyle = style; for (const c of vis) if (c.layers[layer]) g.fill(this.path(c, layer)); };
    fill(LAND, 'land');
    fill(SEA, 'water');
    fill('#1a2b21', 'green');
    fill('#2a2a22', 'sand');
    fill('#1d2726', 'paved');
    if (scale > 0.18 && this.tiles) {
      g.fillStyle = '#2c3836';
      for (const t of this.tiles.tiles.values()) if (t.clip[2] > vx0 && t.clip[0] < vx1 && t.clip[3] > vz0 && t.clip[1] < vz1) g.fill(this.buildingsPath(t));
    }
    g.lineCap = 'round'; g.lineJoin = 'round';
    // Lanes grey, other roads pale, main roads orange; each with a dark casing.
    const roadStyle = [['#e0902f', Math.max(10, 2.6 * px)], ['#cfd2a8', Math.max(6, 1.9 * px)], ['#7d8782', Math.max(3.5, 1.3 * px)]];
    const groups = scale < 0.1 ? [1, 0] : [2, 1, 0];
    g.strokeStyle = '#05090a';
    for (const k of groups) { g.lineWidth = roadStyle[k][1] + 2.5 * px; for (const c of vis) if (c.layers[`road${k}`]) g.stroke(this.path(c, `road${k}`)); }
    for (const k of groups) { g.strokeStyle = roadStyle[k][0]; g.lineWidth = roadStyle[k][1]; for (const c of vis) if (c.layers[`road${k}`]) g.stroke(this.path(c, `road${k}`)); }
    g.strokeStyle = '#51605c'; g.lineWidth = 2 * px; g.setLineDash([6 * px, 5 * px]);
    for (const c of vis) if (c.layers.rails) g.stroke(this.path(c, 'rails'));
    g.setLineDash([]);
    // GPS route
    if (this.route) {
      g.lineWidth = Math.max(6, 5 * px);
      g.beginPath(); this.route.forEach(([rx, rz], i) => (i ? g.lineTo(rx, rz) : g.moveTo(rx, rz)));
      g.strokeStyle = 'rgba(193,59,217,0.35)'; g.lineWidth = Math.max(14, 11 * px); g.stroke();
      g.strokeStyle = '#d65cf0'; g.lineWidth = Math.max(6, 5 * px); g.stroke();
    }
    // Screen-space overlays
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const S = (wx, wz) => [(wx - x) * scale + W / 2, (wz - z) * scale + H / 2];
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const NARROW = '"Arial Narrow", "Roboto Condensed", "Helvetica Neue", system-ui, sans-serif';
    if (scale > 0.22 && this.labels) {
      g.font = `600 12px ${NARROW}`; g.fillStyle = '#b9c2bd'; g.strokeStyle = 'rgba(0,0,0,0.8)'; g.lineWidth = 3;
      for (const lb of this.labels) {
        const [sx, sy] = S(lb.x, lb.z);
        if (sx < -100 || sx > W + 100 || sy < -20 || sy > H + 20 || lb.len * scale < g.measureText(lb.name).width * 0.8) continue;
        let a = lb.a; if (a > Math.PI / 2) a -= Math.PI; if (a < -Math.PI / 2) a += Math.PI;
        g.save(); g.translate(sx, sy); g.rotate(a); g.strokeText(lb.name, 0, 0); g.fillText(lb.name, 0, 0); g.restore();
      }
    }
    const lat0 = this.index.origin.lat, lon0 = this.index.origin.lon, mp = this.index.metresPerDegree;
    // District names: big condensed white letters with a soft shadow.
    g.font = `700 ${scale > 0.3 ? 24 : scale > 0.12 ? 19 : 15}px ${NARROW}`;
    g.letterSpacing = '1px'; g.fillStyle = '#fff';
    g.shadowColor = 'rgba(0,0,0,0.9)'; g.shadowBlur = 8;
    for (const [name, lat, lon] of LABELS) {
      const [sx, sy] = S((lon - lon0) * mp.lon, -(lat - lat0) * mp.lat);
      if (sx < -150 || sx > W + 150 || sy < -30 || sy > H + 30) continue;
      g.fillText(name, sx, sy);
    }
    g.shadowBlur = 0; g.letterSpacing = '0px';
    // Round icons: dark disc, white ring, a glyph inside.
    const disc = (sx, sy, r, glyph, ring = '#fff', fill = '#0b1214', col = '#fff') => {
      g.fillStyle = fill; g.strokeStyle = ring; g.lineWidth = 2;
      g.beginPath(); g.arc(sx, sy, r, 0, 7); g.fill(); g.stroke();
      const name = EMOJI[String(glyph).replace('\uFE0F', '')];
      if (glyph === '!') { g.fillStyle = col; g.font = `800 ${Math.round(r * 1.25)}px system-ui, sans-serif`; g.fillText('!', sx, sy + 1); }
      else drawIcon(g, Array.isArray(name) ? name[0] : name || String(glyph), sx, sy, r * 1.15, col, 2.2);
    };
    for (const L of this.index.landmarks || []) {
      const [sx, sy] = S(L.x, L.z);
      disc(sx, sy, 9, 'star', '#fff', '#0b1214', '#ffd60a');
      if (scale > 0.15) { g.font = `600 12px ${NARROW}`; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.85)'; g.strokeText(L.name, sx, sy + 20); g.fillStyle = '#e8ecea'; g.fillText(L.name, sx, sy + 20); }
    }
    // Petrol pumps: icons when zoomed in, small dots across the whole city.
    const big = scale >= 0.1;
    for (const [fx, fz] of this.fuel) {
      const [sx, sy] = S(fx, fz);
      if (sx < -12 || sx > W + 12 || sy < -12 || sy > H + 12) continue;
      if (big) disc(sx, sy, 10, 'fuel', '#fff', '#0b1214');
      else { g.fillStyle = '#e8ecea'; g.beginPath(); g.arc(sx, sy, 3, 0, 7); g.fill(); }
    }
    // Missions and things to find: coloured discs with a white ring and "!" (or their own icon).
    for (const m of this.markers?.() || []) {
      const [sx, sy] = S(m.x, m.z);
      disc(sx, sy, Math.max(9, (m.r || 8) + 2), m.icon || '!', '#fff', m.color, '#fff');
    }
    if (this.waypoint) {
      const [sx, sy] = S(this.waypoint.x, this.waypoint.z);
      g.fillStyle = '#c13bd9'; g.strokeStyle = '#fff'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx - 9, sy - 16); g.arc(sx, sy - 18, 9, Math.PI * 0.85, Math.PI * 0.15); g.closePath(); g.fill(); g.stroke();
    }
    const p = this.player;
    if (p) {
      const [sx, sy] = S(p.pos.x, p.pos.z);
      g.save(); g.translate(sx, sy); g.rotate(Math.atan2(Math.cos(p.heading), Math.sin(p.heading)) - Math.PI / 2 + Math.PI);
      g.fillStyle = '#ffd60a'; g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.shadowColor = 'rgba(255,214,10,0.8)'; g.shadowBlur = 12;
      g.beginPath(); g.moveTo(0, -13); g.lineTo(10, 10); g.lineTo(0, 5); g.lineTo(-10, 10); g.closePath(); g.fill(); g.stroke();
      g.restore(); g.shadowBlur = 0;
    }
    // Scale bar
    const m = scale > 1 ? 50 : scale > 0.3 ? 200 : scale > 0.1 ? 500 : 1000;
    g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(24, H - 84, m * scale, 3);
    g.font = `600 12px ${NARROW}`; g.textAlign = 'left'; g.fillText(m >= 1000 ? `${m / 1000} km` : `${m} m`, 24, H - 96);
  }
}
