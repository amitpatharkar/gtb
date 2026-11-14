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
      <div class="map-top"><b>Map · ${index.name || 'Mumbai'}</b><span class="map-hint">Drag to move · scroll or pinch to zoom · tap to set a waypoint</span>
        <button class="map-clear">Clear route</button><button class="map-close" aria-label="Close">✕</button></div>
      <div class="map-legend"><i style="background:#fff"></i>Main road <i style="background:#a9a49b"></i>Lane <i style="background:#7fae6b"></i>Park
        <i style="background:#c13bd9"></i>GPS route <span>⛽ Petrol</span></div>
      <div class="map-credit">Map data © OpenStreetMap contributors</div>`;
    document.body.appendChild(this.el);
    this.canvas = this.el.querySelector('canvas');
    this.g = this.canvas.getContext('2d');
    this.el.querySelector('.map-close').onclick = () => this.toggle(false);
    this.el.querySelector('.map-clear').onclick = () => { this.setWaypoint(null, this.waypoint?.owner); this.draw(); };
    this.view = { x: 0, z: 0, scale: 0.12 };
    this.bindInput();
    addEventListener('resize', () => this.open && this.resize());
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
      const res = await this.call('load', { url: new URL(this.baseUrl + file, location.href).href });
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
  async toggle(on = !this.open, player = this.player) {
    this.open = on;
    this.el.hidden = !on;
    if (!on) return;
    this.player = player;
    this.resize();
    if (player) { this.view.x = player.pos.x; this.view.z = player.pos.z; this.view.scale = Math.max(this.view.scale, 0.35); }
    this.g.fillStyle = '#1f4a5c'; this.g.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.g.fillStyle = '#fff'; this.g.font = '20px sans-serif'; this.g.fillText('Loading map…', 30, 90);
    try { await this.load(); } catch { this.g.fillText('Map unavailable — try again in a moment', 30, 120); return; }
    this.draw();
  }

  resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    this.dpr = dpr;
    this.canvas.width = innerWidth * dpr;
    this.canvas.height = innerHeight * dpr;
    this.canvas.style.width = `${innerWidth}px`;
    this.canvas.style.height = `${innerHeight}px`;
  }

  toWorld(sx, sy) {
    const { x, z, scale } = this.view;
    return { x: x + (sx - innerWidth / 2) / scale, z: z + (sy - innerHeight / 2) / scale };
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
    const W = innerWidth, H = innerHeight;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#1f4a5c';
    g.fillRect(0, 0, W, H);
    if (!this.data) return;
    g.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (W / 2 - x * scale), dpr * (H / 2 - z * scale));
    const vx0 = x - W / 2 / scale, vx1 = x + W / 2 / scale, vz0 = z - H / 2 / scale, vz1 = z + H / 2 / scale;
    const vis = this.data.filter((c) => c.bbox[2] > vx0 && c.bbox[0] < vx1 && c.bbox[3] > vz0 && c.bbox[1] < vz1);
    const px = 1 / scale;
    const fill = (style, layer) => { g.fillStyle = style; for (const c of vis) if (c.layers[layer]) g.fill(this.path(c, layer)); };
    fill('#d6cfbf', 'land');
    fill('#1f4a5c', 'water');
    fill('#9cc286', 'green');
    fill('#ecdcae', 'sand');
    fill('#c9c3b8', 'paved');
    if (scale > 0.18 && this.tiles) {
      g.fillStyle = '#bdb4a3';
      for (const t of this.tiles.tiles.values()) if (t.clip[2] > vx0 && t.clip[0] < vx1 && t.clip[3] > vz0 && t.clip[1] < vz1) g.fill(this.buildingsPath(t));
    }
    g.lineCap = 'round'; g.lineJoin = 'round';
    // Main roads, tertiary roads and links, lanes (only when zoomed in far enough to read them).
    const roadStyle = [['#ffffff', Math.max(12, 3 * px)], ['#f4efe4', Math.max(8, 2.4 * px)], ['#e9e3d6', Math.max(5, 1.6 * px)]];
    const groups = scale < 0.1 ? [1, 0] : [2, 1, 0];
    g.strokeStyle = '#8f887a';
    for (const k of groups) { g.lineWidth = roadStyle[k][1] + 1.5 * px; for (const c of vis) if (c.layers[`road${k}`]) g.stroke(this.path(c, `road${k}`)); }
    for (const k of groups) { g.strokeStyle = roadStyle[k][0]; g.lineWidth = roadStyle[k][1]; for (const c of vis) if (c.layers[`road${k}`]) g.stroke(this.path(c, `road${k}`)); }
    g.strokeStyle = '#6d6a66'; g.lineWidth = 2 * px; g.setLineDash([6 * px, 5 * px]);
    for (const c of vis) if (c.layers.rails) g.stroke(this.path(c, 'rails'));
    g.setLineDash([]);
    // GPS route
    if (this.route) {
      g.strokeStyle = '#c13bd9'; g.lineWidth = Math.max(6, 5 * px);
      g.beginPath(); this.route.forEach(([rx, rz], i) => (i ? g.lineTo(rx, rz) : g.moveTo(rx, rz))); g.stroke();
    }
    // Screen-space overlays
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const S = (wx, wz) => [(wx - x) * scale + W / 2, (wz - z) * scale + H / 2];
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (scale > 0.22 && this.labels) {
      g.font = '600 12px system-ui, sans-serif'; g.fillStyle = '#3b3833';
      for (const lb of this.labels) {
        const [sx, sy] = S(lb.x, lb.z);
        if (sx < -100 || sx > W + 100 || sy < -20 || sy > H + 20 || lb.len * scale < g.measureText(lb.name).width * 0.8) continue;
        let a = lb.a; if (a > Math.PI / 2) a -= Math.PI; if (a < -Math.PI / 2) a += Math.PI;
        g.save(); g.translate(sx, sy); g.rotate(a); g.fillText(lb.name, 0, 0); g.restore();
      }
    }
    const lat0 = this.index.origin.lat, lon0 = this.index.origin.lon, mp = this.index.metresPerDegree;
    g.font = `800 ${scale > 0.3 ? 17 : 14}px system-ui, sans-serif`;
    for (const [name, lat, lon] of LABELS) {
      const [sx, sy] = S((lon - lon0) * mp.lon, -(lat - lat0) * mp.lat);
      g.lineWidth = 4; g.strokeStyle = 'rgba(255,255,255,0.85)'; g.strokeText(name.toUpperCase(), sx, sy);
      g.fillStyle = '#2b2925'; g.fillText(name.toUpperCase(), sx, sy);
    }
    // Landmarks: a star and the (parody) name.
    for (const L of this.index.landmarks || []) {
      const [sx, sy] = S(L.x, L.z);
      g.fillStyle = '#f7c600'; g.strokeStyle = '#000'; g.lineWidth = 2;
      g.font = '18px sans-serif'; g.strokeText('★', sx, sy); g.fillText('★', sx, sy);
      if (scale > 0.15) { g.font = '700 12px system-ui, sans-serif'; g.lineWidth = 3; g.strokeStyle = '#fff'; g.strokeText(L.name, sx, sy + 16); g.fillStyle = '#5a3c00'; g.fillText(L.name, sx, sy + 16); }
    }
    g.font = '16px sans-serif';
    // Petrol pumps: icons when zoomed in, small dots across the whole city.
    const big = scale >= 0.1;
    for (const [fx, fz] of this.fuel) {
      const [sx, sy] = S(fx, fz);
      if (sx < -12 || sx > W + 12 || sy < -12 || sy > H + 12) continue;
      g.fillStyle = '#0e8a4a'; g.beginPath(); g.arc(sx, sy, big ? 11 : 4, 0, 7); g.fill();
      if (big) { g.fillStyle = '#fff'; g.fillText('⛽', sx, sy + 1); }
    }
    for (const m of this.markers?.() || []) {
      const [sx, sy] = S(m.x, m.z);
      g.fillStyle = m.color; g.beginPath(); g.arc(sx, sy, m.r || 8, 0, 7); g.fill();
      if (m.icon) { g.fillStyle = '#fff'; g.font = '13px sans-serif'; g.fillText(m.icon, sx, sy + 1); }
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
      g.fillStyle = '#f7c600'; g.strokeStyle = '#000'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, -13); g.lineTo(10, 10); g.lineTo(0, 5); g.lineTo(-10, 10); g.closePath(); g.fill(); g.stroke();
      g.restore();
    }
    // Scale bar
    const m = scale > 1 ? 50 : scale > 0.3 ? 200 : scale > 0.1 ? 500 : 1000;
    g.fillStyle = '#fff'; g.fillRect(20, H - 34, m * scale, 4);
    g.font = '12px system-ui'; g.textAlign = 'left'; g.fillText(m >= 1000 ? `${m / 1000} km` : `${m} m`, 20, H - 46);
  }
}
