// Walls from the Street View survey (docs/research/street-library/README.md, key findings):
// compound walls with pillars and gates in front of set-back buildings (housing societies,
// bungalows, offices), white-washed dock walls with barbed wire along the port, and the blue
// corrugated hoardings or green mesh fences around construction sites ("construction
// everywhere, 2026"), with tower cranes and netted towers rising behind them.
//
// Every wall becomes a thin building outline flagged BUILDING_FLAG.WALL (it collides like a
// building); its `style` byte is the wall kind and its height the wall's height. The tile
// worker draws them (src/world/mesh/buildings.js, drawWall).

export const WALL = { COMPOUND: 0, SHEET: 1, MESH: 2, DOCK: 3, STONE: 4, PILLAR: 5, POST: 6, GATEPOST: 7 };

/** Share of set-back frontage behind a compound wall, by district (street profiles win where they say so). */
const COMPOUND = {
  'Malabar Hill': 0.95, 'Cuffe Parade': 0.75, 'Colaba': 0.6, 'Nariman Point': 0.5, 'Churchgate': 0.5, 'Marine Drive': 0.4, 'Tardeo': 0.6,
  'Haji Ali': 0.7, 'Worli': 0.7, 'Prabhadevi': 0.6, 'Dadar': 0.55, 'Matunga': 0.65, 'Mahim': 0.55, 'Sion': 0.55, 'Parel': 0.5,
  'Lower Parel': 0.5, 'Sewri Wadala': 0.5, 'Bandra West': 0.85, 'Bandstand': 0.85, 'Bandra East': 0.6, 'BKC': 0.6, 'Khar': 0.85,
  'Santacruz': 0.7, 'Juhu': 0.9, 'Vile Parle': 0.7, 'Andheri West': 0.7, 'Andheri East': 0.6, 'Marol MIDC': 0.6, 'Airport': 0.4,
  'Chembur': 0.75, 'Ghatkopar': 0.65, 'Powai': 0.8, 'Hiranandani': 0.8, 'Byculla': 0.45, 'Mazgaon': 0.45, 'Mumbai': 0.5,
  // Bazaars and chawl streets: shops right on the footpath, hardly any compounds.
  'Kalbadevi': 0.1, 'Bhendi Bazaar': 0.1, 'Crawford Market': 0.1, 'Dhobi Talao': 0.15, 'Dongri Mandvi': 0.1, 'Girgaon': 0.25,
  'Grant Road': 0.25, 'Nagpada': 0.25, 'Kurla': 0.3, 'Saki Naka': 0.3, 'Dharavi': 0, 'Worli Koliwada': 0,
};
/** Wall colours (sRGB hex): whitewash, cream, beige, pale grey; Colaba's red-and-white pillars. */
const PLASTER = [0xf2efe8, 0xeee6d3, 0xe3d6ba, 0xd9d6cf, 0xf2efe8];
const FRONTAGE = new Set([2, 3, 4, 5, 6, 7, 8]); // PRIMARY … SERVICE

/** Drop points that lie on the straight line between their neighbours (walls are stored as few points). */
export function straighten(pts, tol = 0.05) {
  if (pts.length < 3) return pts;
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out[out.length - 1], b = pts[i], c = pts[i + 1];
    const cross = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / (Math.hypot(c[0] - a[0], c[1] - a[1]) || 1);
    if (cross > tol) out.push(b);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** A wall along a polyline: a thin outline (thickness t), as a ring of [x, z]. */
export function wallRing(pts, t = 0.22) {
  const L = [], R = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
    L.push([pts[i][0] + nx * t / 2, pts[i][1] + nz * t / 2]); R.push([pts[i][0] - nx * t / 2, pts[i][1] - nz * t / 2]);
  }
  return [...L, ...R.reverse()];
}
const square = (x, z, s, ux, uz) => [[x - ux * s - uz * s, z - uz * s + ux * s], [x + ux * s - uz * s, z + uz * s + ux * s], [x + ux * s + uz * s, z + uz * s - ux * s], [x - ux * s + uz * s, z - uz * s - ux * s]];

/**
 * A run of wall from a polyline: the wall, pillars along it (kind PILLAR or POST) and, on long
 * runs, a gate gap with gate posts. add(ring, kind, height, colour).
 */
export function addRun(pts, kind, h, color, add, { gate = 24, rnd = Math.random } = {}) {
  // Arc lengths, then cut a gate out of long runs.
  const s = [0];
  for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = s[s.length - 1];
  if (L < 2) return 0;
  const at = (t) => {
    let i = 1; while (i < s.length - 1 && s[i] < t) i++;
    const k = (t - s[i - 1]) / ((s[i] - s[i - 1]) || 1), a = pts[i - 1], b = pts[i];
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, (b[0] - a[0]) / ((s[i] - s[i - 1]) || 1), (b[1] - a[1]) / ((s[i] - s[i - 1]) || 1)];
  };
  const slice = (t0, t1) => { const out = [at(t0).slice(0, 2)]; for (let i = 1; i < s.length - 1; i++) if (s[i] > t0 && s[i] < t1) out.push(pts[i]); out.push(at(t1).slice(0, 2)); return out; };
  const pieces = [];
  if (gate && L > gate) {
    const g0 = L * (0.3 + rnd() * 0.4) - 2.1, g1 = g0 + 4.2;
    pieces.push([0, g0], [g1, L]);
    for (const t of [g0 - 0.3, g1 + 0.3]) { const [x, z, ux, uz] = at(t); add(square(x, z, 0.3, ux, uz), WALL.GATEPOST, h + 0.5, color); }
  } else pieces.push([0, L]);
  // Pillars and fence posts are drawn by the tile worker along each wall (not stored).
  let n = 0;
  for (const [t0, t1] of pieces) {
    if (t1 - t0 < 1) continue;
    add(wallRing(straighten(slice(t0, t1)), kind === WALL.MESH ? 0.06 : kind === WALL.SHEET ? 0.12 : 0.22), kind, h, color); n++;
  }
  return n;
}

/**
 * Compound walls at the back of the footpath, in front of set-back buildings; dock walls on port
 * roads. o: { vparts, district(x, z), free(x, z), buildingWithin(x, z, r), hash(n, salt), add }.
 */
export function compoundWalls({ vparts, district, free, buildingWithin, hash, add, BRIDGE = 1 }) {
  let walls = 0, seed = 3;
  const rnd = () => hash(seed++, 41);
  for (const p of vparts) {
    if (!FRONTAGE.has(p.info.cls) || p.info.flags & BRIDGE) continue;
    const prof = p.profile, dock = !!prof?.dock;
    for (const side of [-1, 1]) {
      for (let i = 1; i < p.pts.length; i++) {
        const a = p.pts[i - 1], b = p.pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (L < 10) continue;
        const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, nx = -uz * side, nz = ux * side;
        const d = district((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
        const share = dock ? 0.9 : prof && prof.compound ? prof.compound : COMPOUND[d.name] ?? 0.4;
        if (!share) continue;
        const off = p.hw + (p.fw || 0) + 0.32;
        // Points along the back of the footpath that are free, with a set-back building behind
        // (a compound) — or anything on a port road (the dock estate behind its wall).
        let run = [];
        const flush = () => {
          if (run.length >= (dock ? 11 : 4) && rnd() < share) { // dock walls only as long runs (no stubs)
            const kind = dock ? 0 : 0;
            const color = dock ? 0xf4f3ee : d.name === 'Colaba' && rnd() < 0.4 ? 0xb2453a : PLASTER[Math.floor(rnd() * PLASTER.length)];
            const stone = !dock && (d.name === 'Malabar Hill' || prof?.id === 'malabar-hill-ridge') && rnd() < 0.5;
            walls += addRun(run, dock ? 3 : stone ? 4 : kind, dock ? 2.8 : stone ? 2.2 : 1.5 + rnd() * 0.5, stone ? 0x6e655c : color, add,
              { gate: dock ? 90 : 22 + rnd() * 10, rnd });
          }
          run = [];
        };
        for (let t = 2.5; t <= L - 2.5; t += 2) {
          const x = a[0] + ux * t + nx * off, z = a[1] + uz * t + nz * off;
          const ok = free(x, z) && free(x + nx * 0.4, z + nz * 0.4)
            && (dock ? !buildingWithin(x + nx * 2, z + nz * 2, 2.5) : !buildingWithin(x + nx * 1.2, z + nz * 1.2, 1.4) && buildingWithin(x + nx * 12, z + nz * 12, 9.5));
          if (ok) run.push([x, z]); else flush();
        }
        flush();
      }
    }
  }
  return walls;
}

/** Fence around a construction site ring ([[x, z]…], closed or not): blue sheets or green mesh. */
export function siteFence(ring, ok, add, rnd) {
  const kind = rnd() < 0.7 ? WALL.SHEET : WALL.MESH, color = kind === WALL.SHEET ? 0x2f63b8 : 0x2e7a3c;
  let n = 0, run = [];
  const flush = () => { if (run.length >= 2) n += addRun(run, kind, 2.6, color, add, { gate: 18, rnd }); run = []; };
  const pts = ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring : [...ring, ring[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const steps = Math.max(1, Math.ceil(L / 1.5));
    for (let k = 0; k <= steps; k++) {
      if (k === 0 && i > 1) continue;
      const x = a[0] + ((b[0] - a[0]) * k) / steps, z = a[1] + ((b[1] - a[1]) * k) / steps;
      if (ok(x, z)) run.push([x, z]); else flush();
    }
  }
  flush();
  return n;
}
