import { decodeTile, AREA, ROAD, ROAD_FLAG } from '../world/tileFormat.js';

// Full-screen city map (Tab, or tap the radar), GTA style: pan and zoom over the whole map,
// tap to drop a waypoint, and the GPS draws the shortest legal route (one-ways respected)
// on the map and on the radar. The game pauses while the map is open.

const LABELS = [
  ['Colaba', 18.9105, 72.8165], ['Cuffe Parade', 18.9145, 72.8205], ['Apollo Bunder', 18.9225, 72.8335], ['Nariman Point', 18.9255, 72.8225],
  ['Fort', 18.9345, 72.8355], ['Ballard Estate', 18.9395, 72.8425], ['Churchgate', 18.9335, 72.8265], ['Marine Drive', 18.9440, 72.8230],
  ['Azad Maidan', 18.9395, 72.8325], ['Kalbadevi', 18.9485, 72.8290], ['Girgaon', 18.9545, 72.8180], ['Malabar Hill', 18.9560, 72.8040],
  ['Dongri', 18.9580, 72.8370], ['Grant Road', 18.9630, 72.8160], ['Mazgaon', 18.9660, 72.8450], ['Back Bay', 18.9300, 72.8150],
];
const nodeKey = (x, z) => `${Math.round(x * 2)},${Math.round(z * 2)}`;
const isVehicle = (cls) => cls !== ROAD.PEDESTRIAN && cls !== ROAD.FOOTWAY && cls !== ROAD.PIER;

class Heap {
  constructor() { this.a = []; }
  push(k, v) { const a = this.a; a.push([k, v]); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) { a[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } }
    return top[1];
  }
  get size() { return this.a.length; }
}

async function gunzipIfNeeded(buf) {
  const u8 = new Uint8Array(buf);
  if (u8[0] !== 0x1f || u8[1] !== 0x8b) return u8;
  const stream = new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export class CityMap {
  constructor({ index, baseUrl, fuel, hud }) {
    Object.assign(this, { index, baseUrl, fuel, hud });
    this.open = false;
    this.waypoint = null;
    this.route = null;
    this.routeT = 0;
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
    this.el.querySelector('.map-clear').onclick = () => { this.setWaypoint(null); this.draw(); };
    this.view = { x: 0, z: 0, scale: 0.12 };
    this.bindInput();
    addEventListener('resize', () => this.open && this.resize());
  }

  // ------------------------------------------------------------------ data
  async load() {
    if (this.data) return this.data;
    if (this.loading) return this.loading;
    this.loading = (async () => {
      const tiles = await Promise.all(this.index.tiles.map(async ([tx, tz]) => {
        const res = await fetch(`${this.baseUrl}${tx}_${tz}.bin.gz`);
        return decodeTile(await gunzipIfNeeded(await res.arrayBuffer()));
      }));
      const out = [];
      const nodes = new Map();
      const node = (x, z) => {
        const k = nodeKey(x, z);
        let n = nodes.get(k);
        if (!n) { n = { x, z, adj: [] }; nodes.set(k, n); }
        return n;
      };
      const names = new Map();
      for (const t of tiles) {
        const ox = (t.tx + 0.5) * t.size, oz = (t.tz + 0.5) * t.size;
        const layer = { land: new Path2D(), green: new Path2D(), sand: new Path2D(), buildings: new Path2D(), rails: new Path2D(), roads: [new Path2D(), new Path2D(), new Path2D(), new Path2D()], bbox: [ox - t.size / 2, oz - t.size / 2, ox + t.size / 2, oz + t.size / 2] };
        const ring = (p, r) => { for (let i = 0; i < r.length; i += 2) (i ? p.lineTo : p.moveTo).call(p, r[i] + ox, r[i + 1] + oz); p.closePath(); };
        for (const a of t.areas) {
          const p = a.kind === AREA.LAND ? layer.land : a.kind === AREA.GRASS || a.kind === AREA.PITCH || a.kind === AREA.WOOD ? layer.green : a.kind === AREA.SAND ? layer.sand : null;
          if (p) for (const r of a.rings) ring(p, r);
        }
        for (const b of t.buildings) ring(layer.buildings, b.rings[0]);
        for (const r of t.rails) { const l = r.line; for (let i = 0; i < l.length; i += 2) (i ? layer.rails.lineTo : layer.rails.moveTo).call(layer.rails, l[i] + ox, l[i + 1] + oz); }
        for (const r of t.roads) {
          const grp = r.cls <= ROAD.SECONDARY ? 0 : r.cls <= ROAD.LINK ? 1 : isVehicle(r.cls) ? 2 : 3;
          const p = layer.roads[grp], l = r.line;
          for (let i = 0; i < l.length; i += 2) (i ? p.lineTo : p.moveTo).call(p, l[i] + ox, l[i + 1] + oz);
          // Labels: longest piece of each main road name.
          if (r.name >= 0 && grp <= 1) {
            const nm = t.names[r.name];
            for (let i = 2; i < l.length; i += 2) {
              const len = Math.hypot(l[i] - l[i - 2], l[i + 1] - l[i - 1]);
              if (len > (names.get(nm)?.len || 60)) names.set(nm, { len, x: (l[i] + l[i - 2]) / 2 + ox, z: (l[i + 1] + l[i - 1]) / 2 + oz, a: Math.atan2(l[i + 1] - l[i - 1], l[i] - l[i - 2]) });
            }
          }
          // GPS graph (one-ways are directed).
          if (!isVehicle(r.cls)) continue;
          const oneway = r.flags & ROAD_FLAG.ONEWAY;
          for (let i = 2; i < l.length; i += 2) {
            const a = node(l[i - 2] + ox, l[i - 1] + oz), b = node(l[i] + ox, l[i + 1] + oz);
            if (a === b) continue;
            const len = Math.hypot(b.x - a.x, b.z - a.z);
            a.adj.push([b, len]);
            if (!oneway) b.adj.push([a, len]);
          }
        }
        out.push(layer);
      }
      // Join loose ends that nearly touch (as the traffic graph does).
      const grid = new Map();
      const cell = (x, z) => `${Math.floor(x / 5)},${Math.floor(z / 5)}`;
      for (const n of nodes.values()) (grid.get(cell(n.x, n.z)) || grid.set(cell(n.x, n.z), []).get(cell(n.x, n.z))).push(n);
      for (const n of nodes.values()) {
        if (n.adj.length > 1) continue;
        let best = null, bd = 6.25;
        for (let gx = -1; gx <= 1; gx++) for (let gz = -1; gz <= 1; gz++) {
          for (const m of grid.get(`${Math.floor(n.x / 5) + gx},${Math.floor(n.z / 5) + gz}`) || []) {
            if (m === n || n.adj.some(([o]) => o === m)) continue;
            const d = (m.x - n.x) ** 2 + (m.z - n.z) ** 2;
            if (d < bd) { bd = d; best = m; }
          }
        }
        if (best) { const len = Math.sqrt(bd); n.adj.push([best, len]); best.adj.push([n, len]); }
      }
      this.nodes = [...nodes.values()].filter((n) => n.adj.length);
      this.grid = new Map();
      for (const n of this.nodes) { const k = `${Math.floor(n.x / 40)},${Math.floor(n.z / 40)}`; (this.grid.get(k) || this.grid.set(k, []).get(k)).push(n); }
      this.labels = [...names].map(([name, v]) => ({ name, ...v }));
      this.data = out;
      return out;
    })();
    return this.loading;
  }

  nearest(x, z, heading = null) {
    let best = null, bs = Infinity;
    for (let r = 40; r <= 320 && !best; r *= 2) {
      for (let gx = Math.floor((x - r) / 40); gx <= Math.floor((x + r) / 40); gx++) for (let gz = Math.floor((z - r) / 40); gz <= Math.floor((z + r) / 40); gz++) {
        for (const n of this.grid.get(`${gx},${gz}`) || []) {
          const dx = n.x - x, dz = n.z - z, d = Math.hypot(dx, dz);
          if (d > r) continue;
          const behind = heading == null ? 0 : -((dx * Math.sin(heading) + dz * Math.cos(heading)) / (d || 1));
          const score = d + Math.max(0, behind) * 18;
          if (score < bs) { bs = score; best = n; }
        }
      }
    }
    return best;
  }

  path(from, to) {
    if (!from || !to) return null;
    const g = new Map([[from, 0]]), prev = new Map(), open = new Heap();
    open.push(0, from);
    let n = 0;
    while (open.size && n++ < 60000) {
      const cur = open.pop();
      if (cur === to) break;
      const gc = g.get(cur);
      for (const [nb, len] of cur.adj) {
        const ng = gc + len;
        if (ng < (g.get(nb) ?? Infinity)) { g.set(nb, ng); prev.set(nb, cur); open.push(ng + Math.hypot(nb.x - to.x, nb.z - to.z), nb); }
      }
    }
    if (from !== to && !prev.has(to)) return null;
    const out = [];
    for (let c = to; c; c = prev.get(c)) out.push([c.x, c.z]);
    return out.reverse();
  }

  setWaypoint(p) {
    this.waypoint = p;
    this.route = null;
    this.routeT = 0;
    if (p) this.goal = this.nearest(p.x, p.z);
  }

  /** Called every frame: keep the GPS route fresh while driving. */
  update(dt, player) {
    if (!this.waypoint || !this.data) return;
    if (Math.hypot(player.pos.x - this.waypoint.x, player.pos.z - this.waypoint.z) < 25) {
      this.hud.message(this.waypoint.label ? `Arrived: ${this.waypoint.label}` : 'You have arrived');
      this.setWaypoint(null);
      return;
    }
    this.routeT -= dt;
    if (this.routeT > 0) return;
    this.routeT = 1.5;
    const from = this.nearest(player.pos.x, player.pos.z, player.heading);
    const r = this.path(from, this.goal);
    this.route = r ? [[player.pos.x, player.pos.z], ...r, [this.waypoint.x, this.waypoint.z]] : null;
  }

  /** Route to a place from outside the map (phone apps, missions). */
  async routeTo(x, z, label) {
    await this.load();
    this.setWaypoint({ x, z, label });
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
    await this.load();
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
    const vis = this.data.filter((l) => l.bbox[2] > vx0 && l.bbox[0] < vx1 && l.bbox[3] > vz0 && l.bbox[1] < vz1);
    const px = 1 / scale;
    g.fillStyle = '#d6cfbf'; for (const l of vis) g.fill(l.land, 'evenodd');
    g.fillStyle = '#9cc286'; for (const l of vis) g.fill(l.green);
    g.fillStyle = '#ecdcae'; for (const l of vis) g.fill(l.sand);
    if (scale > 0.18) { g.fillStyle = '#bdb4a3'; for (const l of vis) g.fill(l.buildings); }
    g.lineCap = 'round'; g.lineJoin = 'round';
    const roadStyle = [['#ffffff', Math.max(12, 3 * px)], ['#f4efe4', Math.max(8, 2.4 * px)], ['#e9e3d6', Math.max(5, 1.6 * px)], ['#d9d2c4', Math.max(2, 0.8 * px)]];
    g.strokeStyle = '#8f887a';
    for (let k = 3; k >= 0; k--) { if (k === 3 && scale < 0.3) continue; g.lineWidth = roadStyle[k][1] + 1.5 * px; for (const l of vis) g.stroke(l.roads[k]); }
    for (let k = 3; k >= 0; k--) { if (k === 3 && scale < 0.3) continue; g.strokeStyle = roadStyle[k][0]; g.lineWidth = roadStyle[k][1]; for (const l of vis) g.stroke(l.roads[k]); }
    g.strokeStyle = '#6d6a66'; g.lineWidth = 2 * px; g.setLineDash([6 * px, 5 * px]); for (const l of vis) g.stroke(l.rails); g.setLineDash([]);
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
    g.font = '16px sans-serif';
    for (const [fx, fz] of this.fuel) { const [sx, sy] = S(fx, fz); g.fillStyle = '#0e8a4a'; g.beginPath(); g.arc(sx, sy, 11, 0, 7); g.fill(); g.fillStyle = '#fff'; g.fillText('⛽', sx, sy + 1); }
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
