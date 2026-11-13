// Minimap: land, roads (main roads brighter), petrol pumps and traffic around the
// player, rotating so the direction of travel is always up (like GTA's radar).

export class Minimap {
  constructor(canvas, tiles, fuel) {
    this.c = canvas;
    this.g = canvas.getContext('2d');
    this.tiles = tiles;
    this.fuel = fuel;
    this.scale = 0.32; // pixels per metre (canvas pixels)
    this.timer = 0;
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
    g.fillStyle = '#1f4a5c'; // sea
    g.fillRect(0, 0, W, H);
    g.translate(W / 2, H * 0.62);
    g.rotate(Math.PI + h); // heading up
    g.scale(scale, scale);
    g.translate(-px, -pz);
    // Land
    g.fillStyle = '#c9c1b0';
    for (const t of this.tiles.tiles.values()) {
      const [x0, z0, x1, z1] = t.clip;
      if (x1 < px - R || x0 > px + R || z1 < pz - R || z0 > pz + R) continue;
      const w = t.collide.walkable;
      g.beginPath();
      for (let r = 0; r < w.ringStart.length - 1; r++) {
        const s = w.ringStart[r], e = w.ringStart[r + 1];
        for (let k = s; k < e; k++) (k === s ? g.moveTo : g.lineTo).call(g, w.coords[k * 2], w.coords[k * 2 + 1]);
        g.closePath();
      }
      g.fill('evenodd');
    }
    // Roads
    g.lineCap = 'round';
    for (const pass of [0, 1]) {
      g.strokeStyle = pass ? '#ffffff' : '#7c7c80';
      for (const t of this.tiles.tiles.values()) {
        const [x0, z0, x1, z1] = t.clip;
        if (x1 < px - R || x0 > px + R || z1 < pz - R || z0 > pz + R) continue;
        const rd = t.collide.roads;
        for (let i = 0; i < rd.count; i++) {
          const o = i * 6, f = rd.segs[o + 5];
          if (!(f & 1) || !!(f & 4) !== !!pass) continue;
          g.lineWidth = Math.max(rd.segs[o + 4] * 2, 5 / scale);
          g.beginPath(); g.moveTo(rd.segs[o], rd.segs[o + 1]); g.lineTo(rd.segs[o + 2], rd.segs[o + 3]); g.stroke();
        }
      }
    }
    // Traffic dots and petrol pumps
    g.fillStyle = '#f7c600';
    for (const car of traffic?.cars || []) { g.beginPath(); g.arc(car.x, car.z, 3 / scale * 0.9, 0, 7); g.fill(); }
    for (const [x, z] of this.fuel) {
      if (Math.abs(x - px) > R || Math.abs(z - pz) > R) continue;
      g.fillStyle = '#0e8a4a';
      g.beginPath(); g.arc(x, z, 9 / scale * 0.9, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.font = `${14 / scale * 0.9}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.save(); g.translate(x, z); g.rotate(-(Math.PI + h)); g.fillText('⛽', 0, 0); g.restore();
    }
    g.restore();
    // Player arrow
    g.fillStyle = '#f7c600'; g.strokeStyle = '#000'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(W / 2, H * 0.62 - 11); g.lineTo(W / 2 + 8, H * 0.62 + 8); g.lineTo(W / 2, H * 0.62 + 4); g.lineTo(W / 2 - 8, H * 0.62 + 8); g.closePath();
    g.fill(); g.stroke();
    // North marker
    const nx = W / 2 + Math.sin(h + Math.PI) * (W / 2 - 12) * 0, ny = 14;
    g.fillStyle = '#fff'; g.font = 'bold 13px sans-serif'; g.textAlign = 'center';
    g.save(); g.translate(W / 2, H * 0.62); g.rotate(Math.PI + h); g.translate(0, -H * 0.62 + 14); g.rotate(-(Math.PI + h)); g.fillText('N', 0, 4); g.restore();
    void nx; void ny;
  }
}
