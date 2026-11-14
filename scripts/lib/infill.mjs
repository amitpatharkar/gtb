// Infill along empty street frontage. OpenStreetMap misses many building outlines in the dense
// old districts (Kalbadevi, Bhendi Bazaar, Girgaon, Dharavi, Kurla…): a review sampled 50–74 %
// of those blocks as bare concrete lots, where the real city is wall-to-wall. So the converter
// lines empty frontage with plots in the district's grain — narrow fronts facing the street,
// built up to the footpath, a second row behind in the densest areas. After this they are
// ordinary untagged buildings: heights, styles, colours and shops come from the district rules
// and the street library like everything else. Mapped buildings, parks, water, tracks, roads
// and footpaths are never built over.

/** Share of free frontage that gets built (0 = leave as mapped). Districts in lib/districts.mjs. */
const DENSITY = {
  'Kalbadevi': 0.95, 'Bhendi Bazaar': 0.95, 'Dongri Mandvi': 0.9, 'Crawford Market': 0.85, 'Dhobi Talao': 0.8,
  'Girgaon': 0.85, 'Grant Road': 0.8, 'Nagpada': 0.85, 'Byculla': 0.7, 'Mazgaon': 0.55, 'Mumbai Central': 0.65,
  'Reay Road': 0.45, 'Fort': 0.5, 'Colaba': 0.55, 'Chowpatty': 0.45, 'Tardeo': 0.4, 'CST': 0.35, 'Kala Ghoda': 0.3,
  'Apollo Bunder': 0.3, 'Churchgate': 0.3, 'Haji Ali': 0.3, 'Worli': 0.25, 'Worli Koliwada': 0.95, 'Lower Parel': 0.25,
  'Parel': 0.6, 'Sewri Wadala': 0.35, 'Prabhadevi': 0.5, 'Dadar': 0.7, 'Matunga': 0.5, 'Mahim': 0.65, 'Dharavi': 0.97,
  'Sion': 0.55, 'Bandra West': 0.35, 'Bandra East': 0.6, 'Khar': 0.35, 'Santacruz': 0.5, 'Vile Parle': 0.55,
  'Andheri West': 0.5, 'Andheri East': 0.55, 'Kurla': 0.85, 'Saki Naka': 0.85, 'Chembur': 0.4, 'Ghatkopar': 0.55,
  'Mumbai': 0.35,
  // Planned or green areas stay as mapped: Malabar Hill, Marine Drive, Nariman Point, Cuffe Parade,
  // Ballard Estate, BKC, Airport, Juhu, Bandstand, Powai, Hiranandani, Marol MIDC.
};
/** Plot grain: [front min, front max, depth min, depth max, gap, storey cap or 0]. */
const GRAIN = {
  bazaar: [5, 10, 9, 14, 0.15, 0],
  low: [3.5, 6, 5, 9, 0.35, 3], // fishing villages and self-built neighbourhoods: one to three storeys
  town: [7, 14, 10, 16, 0.8, 0],
};
const KIND = {
  'Kalbadevi': 'bazaar', 'Bhendi Bazaar': 'bazaar', 'Dongri Mandvi': 'bazaar', 'Crawford Market': 'bazaar', 'Dhobi Talao': 'bazaar',
  'Girgaon': 'bazaar', 'Grant Road': 'bazaar', 'Nagpada': 'bazaar', 'Kurla': 'bazaar', 'Saki Naka': 'bazaar', 'Dadar': 'bazaar',
  'Dharavi': 'low', 'Worli Koliwada': 'low',
};
// Road classes that get frontage (not motorways, trunk expressways, footways, tracks or piers).
const FRONTAGE = new Set([2, 3, 4, 5, 6, 7, 8]); // PRIMARY…SERVICE (see ROAD in src/world/tileFormat.js)

/**
 * @param o.vparts vehicle roads ({ pts, hw, fw, info: { cls, flags } }) · o.district(x, z) → { name }
 * @param o.free(x, z) is this point free to build on (no road, footpath, building, area, track)?
 * @param o.onLand(x, z) · o.hash(n, salt) → 0..1 · o.add(ring, levels) adds a building
 */
export function infill({ vparts, district, free, onLand, hash, add, BRIDGE = 1 }) {
  let made = 0, seed = 1;
  const rnd = () => hash(seed++, 77);
  const rectFree = (r) => {
    // Corners and edges first (cheap rejects), then the inside every ~2 m; land at the corners.
    const [A, B, C, D] = r, cx = (A[0] + C[0]) / 2, cz = (A[1] + C[1]) / 2;
    const pts = [[cx, cz], ...r.map(([x, z]) => [x + (cx - x) * 0.04, z + (cz - z) * 0.04])];
    for (const [x, z] of pts) if (!free(x, z)) return false;
    const nu = Math.max(2, Math.ceil(Math.hypot(B[0] - A[0], B[1] - A[1]) / 2)), nv = Math.max(2, Math.ceil(Math.hypot(D[0] - A[0], D[1] - A[1]) / 2));
    for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
      const u = 0.04 + (0.92 * i) / nu, v = 0.04 + (0.92 * j) / nv;
      const x = A[0] + (B[0] - A[0]) * u + (D[0] - A[0]) * v, z = A[1] + (B[1] - A[1]) * u + (D[1] - A[1]) * v;
      if (!free(x, z)) return false;
    }
    return r.every(([x, z]) => onLand(x, z));
  };
  for (const p of vparts) {
    if (!FRONTAGE.has(p.info.cls) || p.info.flags & BRIDGE || (p.layer || 0) !== 0) continue;
    for (const side of [-1, 1]) {
      for (let i = 1; i < p.pts.length; i++) {
        const a = p.pts[i - 1], b = p.pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (L < 8) continue;
        const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, nx = -uz * side, nz = ux * side;
        const d = district((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
        const density = DENSITY[d.name] ?? 0;
        if (!density) continue;
        const [f0, f1, d0, d1, gap, cap] = GRAIN[KIND[d.name] || 'town'];
        const front = p.hw + (p.fw || 0) + 0.45; // just behind the footpath (or the road edge)
        let t = 1.5 + rnd() * 2;
        while (t < L - 2) {
          const w = f0 + rnd() * (f1 - f0), depth = d0 + rnd() * (d1 - d0);
          if (t + w > L - 1) break;
          if (rnd() < density) {
            const ring = (o0, o1) => [
              [a[0] + ux * t + nx * o0, a[1] + uz * t + nz * o0], [a[0] + ux * (t + w) + nx * o0, a[1] + uz * (t + w) + nz * o0],
              [a[0] + ux * (t + w) + nx * o1, a[1] + uz * (t + w) + nz * o1], [a[0] + ux * t + nx * o1, a[1] + uz * t + nz * o1],
            ];
            const r = ring(front, front + depth);
            if (rectFree(r)) {
              add(r, cap ? 1 + Math.floor(rnd() * cap) : 0); made++;
              // The densest districts: another row behind (narrow lanes and back buildings).
              if (density >= 0.85 && rnd() < 0.55) {
                const r2 = ring(front + depth + 0.25, front + depth + 0.25 + d0 + rnd() * (d1 - d0));
                if (rectFree(r2)) { add(r2, cap ? 1 + Math.floor(rnd() * cap) : 0); made++; }
              }
            }
          }
          t += w + gap;
        }
      }
    }
  }
  return made;
}
