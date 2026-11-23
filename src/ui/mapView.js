// Full map (pause menu → Map): the whole road network from the overview file, the playable
// area, places by category (filterable, §20B of the UI study), the player, the GPS route.
// Drag to pan, wheel to zoom, click a street to set a waypoint (click it again to clear it).
import { CATEGORIES } from './places.js';

const LAYER_STYLE = {
  land: ['fill', '#2c3230'], paved: ['fill', '#3a3d3a'], green: ['fill', '#2f4a32'], sand: ['fill', '#5a5440'], water: ['fill', '#173540'],
  rails: ['line', '#6b6355', 1.2], road2: ['line', '#7f847e', 1.4], road1: ['line', '#b8bbb3', 2.4], road0: ['line', '#d9cf9e', 3.6],
};

export class MapView {
  constructor(nav, area) {
    this.nav = nav; this.area = area;
    this.paths = null;
    this.scale = 0.35; // pixels per metre
    this.cx = 0; this.cz = 0;
    this.player = { x: 0, z: 0, heading: 0 };
  }

  /** Build the map in a container; onPick(x, z) when the player clicks a spot. */
  mount(el, { places, filters, onPick }) {
    this.places = places; this.filters = filters; this.onPick = onPick;
    el.innerHTML = '<div id="map-wrap"><canvas id="map-canvas"></canvas><div id="map-tip">Drag to move · wheel to zoom · click a street to set a waypoint</div></div>';
    const wrap = el.querySelector('#map-wrap'), cv = el.querySelector('#map-canvas');
    this.cv = cv; this.g = cv.getContext('2d');
    const fit = () => { const r = wrap.getBoundingClientRect(); cv.width = Math.max(10, r.width * devicePixelRatio); cv.height = Math.max(10, r.height * devicePixelRatio); this.draw(); };
    new ResizeObserver(fit).observe(wrap);
    let drag = null, moved = 0;
    cv.onpointerdown = (e) => { drag = { x: e.clientX, y: e.clientY }; moved = 0; cv.setPointerCapture(e.pointerId); };
    cv.onpointermove = (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      moved += Math.abs(dx) + Math.abs(dy);
      this.cx -= (dx * devicePixelRatio) / this.scale; this.cz -= (dy * devicePixelRatio) / this.scale;
      drag = { x: e.clientX, y: e.clientY };
      this.draw();
    };
    cv.onpointerup = (e) => {
      if (drag && moved < 6) { const r = cv.getBoundingClientRect(); const [x, z] = this.toWorld((e.clientX - r.left) * devicePixelRatio, (e.clientY - r.top) * devicePixelRatio); this.onPick?.(x, z); }
      drag = null;
    };
    cv.onwheel = (e) => {
      e.preventDefault();
      const r = cv.getBoundingClientRect(), mx = (e.clientX - r.left) * devicePixelRatio, my = (e.clientY - r.top) * devicePixelRatio;
      const [wx, wz] = this.toWorld(mx, my);
      this.scale = Math.min(4, Math.max(0.08, this.scale * (e.deltaY < 0 ? 1.2 : 1 / 1.2)));
      const [nx, nz] = this.toWorld(mx, my);
      this.cx += wx - nx; this.cz += wz - nz;
      this.draw();
    };
    this.nav.load().then(() => { this.build(); this.draw(); }).catch((e) => console.warn('map:', e));
    fit();
  }

  centreOn(x, z) { this.cx = x; this.cz = z; }
  toScreen(x, z) { return [(x - this.cx) * this.scale + this.cv.width / 2, (z - this.cz) * this.scale + this.cv.height / 2]; }
  toWorld(px, py) { return [(px - this.cv.width / 2) / this.scale + this.cx, (py - this.cv.height / 2) / this.scale + this.cz]; }
  pan(dx, dz) { this.cx += dx / this.scale; this.cz += dz / this.scale; this.draw(); }
  zoom(f) { this.scale = Math.min(4, Math.max(0.08, this.scale * f)); this.draw(); }

  build() {
    if (this.paths || !this.nav.map) return;
    this.paths = this.nav.map.chunks.map((c) => {
      const layers = {};
      for (const [name, { pts, starts }] of Object.entries(c.layers)) {
        const p = new Path2D();
        for (let i = 0; i + 1 < starts.length; i++) {
          for (let k = starts[i]; k < starts[i + 1]; k++) { if (k === starts[i]) p.moveTo(pts[k * 2], pts[k * 2 + 1]); else p.lineTo(pts[k * 2], pts[k * 2 + 1]); }
          if (LAYER_STYLE[name]?.[0] === 'fill') p.closePath();
        }
        layers[name] = p;
      }
      return { bbox: c.bbox, layers };
    });
  }

  draw() {
    const g = this.g, cv = this.cv;
    if (!g || !cv.width) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#132a33'; g.fillRect(0, 0, cv.width, cv.height);
    const s = this.scale;
    if (this.paths) {
      g.setTransform(s, 0, 0, s, cv.width / 2 - this.cx * s, cv.height / 2 - this.cz * s);
      const [x0, z0] = this.toWorld(0, 0), [x1, z1] = this.toWorld(cv.width, cv.height);
      for (const name of Object.keys(LAYER_STYLE)) {
        const [kind, colour, w] = LAYER_STYLE[name];
        if (name === 'road2' && s < 0.2) continue;
        for (const c of this.paths) {
          const p = c.layers[name];
          if (!p || c.bbox[2] < x0 || c.bbox[0] > x1 || c.bbox[3] < z0 || c.bbox[1] > z1) continue;
          if (kind === 'fill') { g.fillStyle = colour; g.fill(p, 'nonzero'); }
          else { g.strokeStyle = colour; g.lineWidth = (w * devicePixelRatio) / s; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(p); }
        }
      }
      // The playable area (the rest of Mumbai is dimmed).
      const A = this.area;
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.beginPath(); g.rect(x0 - 10, z0 - 10, x1 - x0 + 20, z1 - z0 + 20); g.rect(A.maxX, A.minZ, A.minX - A.maxX, A.maxZ - A.minZ); g.fill('evenodd');
      g.strokeStyle = 'rgba(242,183,5,0.7)'; g.lineWidth = (2 * devicePixelRatio) / s; g.strokeRect(A.minX, A.minZ, A.maxX - A.minX, A.maxZ - A.minZ);
      // Route.
      const R = this.nav.route;
      if (R && this.filters.has('waypoint')) {
        g.beginPath(); for (let i = 0; i < R.length; i += 2) { if (i) g.lineTo(R[i], R[i + 1]); else g.moveTo(R[i], R[i + 1]); }
        g.strokeStyle = '#c46bff'; g.lineWidth = (5 * devicePixelRatio) / s; g.stroke();
      }
    } else {
      g.fillStyle = '#9aa'; g.font = `${14 * devicePixelRatio}px system-ui`; g.fillText('Loading the map…', 20, 30 * devicePixelRatio);
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    const dp = devicePixelRatio;
    const icon = (x, z, colour, ch, size, label) => {
      const [px, py] = this.toScreen(x, z);
      if (px < -20 || py < -20 || px > cv.width + 20 || py > cv.height + 20) return;
      g.font = `700 ${size * dp}px system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 4 * dp; g.strokeStyle = 'rgba(0,0,0,0.8)'; g.strokeText(ch, px, py); g.fillStyle = colour; g.fillText(ch, px, py);
      if (label && this.scale > 0.45) { g.font = `600 ${12 * dp}px system-ui`; g.textAlign = 'left'; g.lineWidth = 3 * dp; g.strokeText(label, px + 12 * dp, py); g.fillStyle = '#eee'; g.fillText(label, px + 12 * dp, py); }
    };
    for (const p of this.places) if (this.filters.has(p.kind)) icon(p.x, p.z, CATEGORIES[p.kind].colour, CATEGORIES[p.kind].icon, p.kind === 'fuel' ? 15 : 18, p.kind === 'fuel' ? '' : p.name);
    if (this.filters.has('car')) for (const c of this.cars || []) icon(c.x, c.z, CATEGORIES.car.colour, '■', 10);
    const t = this.nav.target;
    if (t) icon(t.x, t.z, t.objective ? '#f2b705' : '#c46bff', '◉', 24, t.label);
    // Player arrow.
    const [px, py] = this.toScreen(this.player.x, this.player.z);
    g.save(); g.translate(px, py); g.rotate(Math.PI - this.player.heading); g.scale(dp, dp);
    g.beginPath(); g.moveTo(0, -12); g.lineTo(8, 9); g.lineTo(0, 4); g.lineTo(-8, 9); g.closePath();
    g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2; g.stroke(); g.fill();
    g.restore();
  }
}
