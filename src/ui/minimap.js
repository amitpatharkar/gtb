// Minimap: land, roads (main roads brighter), petrol pumps and traffic around the
// player, rotating so the direction of travel is always up (like GTA's radar).

import { drawIcon } from './icons.js';

export class Minimap {
  constructor(canvas, tiles, fuel) {
    this.c = canvas;
    this.g = canvas.getContext('2d');
    this.tiles = tiles;
    this.fuel = fuel;
    this.scale = 0.32; // pixels per metre (canvas pixels)
    this.timer = 0;
  }

  /** Path2D outlines of a tile's land and its roads (minor and main). */
  paths(t) {
    const land = new Path2D(), main = new Path2D(), minor = new Path2D();
    const w = t.collide.walkable;
    for (let r = 0; r < w.ringStart.length - 1; r++) {
      const s = w.ringStart[r], e = w.ringStart[r + 1];
      for (let k = s; k < e; k++) (k === s ? land.moveTo : land.lineTo).call(land, w.coords[k * 2], w.coords[k * 2 + 1]);
      land.closePath();
    }
    const rd = t.collide.roads;
    for (let i = 0; i < rd.count; i++) {
      const o = i * 6, f = rd.segs[o + 5];
      if (!(f & 1)) continue;
      const p = f & 4 ? main : minor;
      p.moveTo(rd.segs[o], rd.segs[o + 1]); p.lineTo(rd.segs[o + 2], rd.segs[o + 3]);
    }
    return { land, main, minor };
  }

  update(dt, player, traffic) {
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.12;
    const { c, g, scale } = this;
    const W = c.width, H = c.height, R = (Math.hypot(W, H) / 2) / scale;
    const px = player.pos.x, pz = player.pos.z, h = player.heading;
    g.save();
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#0c262c'; // sea
    g.fillRect(0, 0, W, H);
    g.translate(W / 2, H * 0.62);
    g.rotate(Math.PI + h); // heading up
    g.scale(scale, scale);
    g.translate(-px, -pz);
    // Land and roads: one cached Path2D set per tile (built once, drawn with the transform).
    const vis = [];
    for (const t of this.tiles.tiles.values()) {
      const [x0, z0, x1, z1] = t.clip;
      if (x1 < px - R || x0 > px + R || z1 < pz - R || z0 > pz + R) continue;
      vis.push(t._radar ||= this.paths(t));
    }
    g.fillStyle = '#131c1b';
    for (const p of vis) g.fill(p.land, 'evenodd');
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = '#7d8782'; g.lineWidth = Math.max(7, 3.6 / scale);
    for (const p of vis) g.stroke(p.minor);
    g.strokeStyle = '#05090a'; g.lineWidth = Math.max(15, 6.4 / scale);
    for (const p of vis) g.stroke(p.main);
    g.strokeStyle = '#e0902f'; g.lineWidth = Math.max(11, 4.6 / scale);
    for (const p of vis) g.stroke(p.main);
    // GPS route and waypoint
    const nav = this.nav;
    if (nav?.route) {
      g.lineJoin = 'round';
      g.beginPath(); nav.route.forEach(([x, z], i) => (i ? g.lineTo(x, z) : g.moveTo(x, z)));
      g.strokeStyle = 'rgba(193,59,217,0.35)'; g.lineWidth = 15 / scale; g.stroke();
      g.strokeStyle = '#d65cf0'; g.lineWidth = 7 / scale; g.stroke();
    }
    if (nav?.waypoint) {
      // Clamp the marker to the radar edge when it is far away.
      const wx = nav.waypoint.x, wz = nav.waypoint.z, d = Math.hypot(wx - px, wz - pz), lim = (W * 0.45) / scale;
      const k = d > lim ? lim / d : 1;
      g.fillStyle = '#c13bd9'; g.strokeStyle = '#fff'; g.lineWidth = 2 / scale;
      g.beginPath(); g.arc(px + (wx - px) * k, pz + (wz - pz) * k, 8 / scale, 0, 7); g.fill(); g.stroke();
    }
    // Traffic dots and petrol pumps
    g.fillStyle = '#ffd60a';
    for (const car of traffic?.cars || []) { g.beginPath(); g.arc(car.x, car.z, 3 / scale * 0.9, 0, 7); g.fill(); }
    for (const [x, z] of this.fuel) {
      if (Math.abs(x - px) > R || Math.abs(z - pz) > R) continue;
      g.save(); g.translate(x, z); g.rotate(-(Math.PI + h)); g.scale(1 / scale, 1 / scale);
      g.fillStyle = '#0b1214'; g.strokeStyle = '#fff'; g.lineWidth = 1.6; g.beginPath(); g.arc(0, 0, 8, 0, 7); g.fill(); g.stroke();
      drawIcon(g, 'fuel', 0, 0, 10, '#fff', 2.2);
      g.restore();
    }
    g.restore();
    // Player arrow
    g.fillStyle = '#ffd60a'; g.strokeStyle = '#fff'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(W / 2, H * 0.62 - 11); g.lineTo(W / 2 + 8, H * 0.62 + 8); g.lineTo(W / 2, H * 0.62 + 4); g.lineTo(W / 2 - 8, H * 0.62 + 8); g.closePath();
    g.fill(); g.stroke();
    // North marker
    const nx = W / 2 + Math.sin(h + Math.PI) * (W / 2 - 12) * 0, ny = 14;
    g.fillStyle = '#fff'; g.font = 'bold 13px sans-serif'; g.textAlign = 'center';
    g.save(); g.translate(W / 2, H * 0.62); g.rotate(Math.PI + h); g.translate(0, -H * 0.62 + 14); g.rotate(-(Math.PI + h)); g.fillText('N', 0, 4); g.restore();
    void nx; void ny;
  }
}
