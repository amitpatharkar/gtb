// Buildings for one tile: walls (one mesh per style), flat roofs with parapets, and the
// collision triangles for every building that touches the ground. Wall texture coordinates are
// metres (u along the wall, v up from the street), so the facade shader can lay out storeys
// and window bays in real units.
import { BUILDING_FLAG } from '../tileFormat.js';
import { Y } from '../levels.js';
import { MeshBuilder, wall, flatPolygon, linear, rand, pointInRing } from './builder.js';

export const STYLES = ['plaster', 'weathered', 'deco', 'stone', 'basalt', 'concrete', 'glass', 'shed', 'brick'];
const PARAPET = 0.9;
// facade attribute: [seed 0..1, storey height (m), flags, bay width (m)]
export const FACADE = { SHOPS: 1, BLANK: 2, GLASS: 4 };
const BAY = [3.3, 3.0, 3.4, 3.7, 3.7, 3.4, 1.6, 4.0, 3.2];

const srgbBytesToLinear = (c) => linear((c[0] << 16) | (c[1] << 8) | c[2]);

/**
 * keep(b): false drops a building (it stands on a road). Returns mesh builders keyed
 * `walls<style>`, `roof`, `wall` (compound walls) and collision triangle soup {pos, idx}.
 */
export function buildBlocks(t, keep) {
  const out = new Map();
  const get = (key) => out.get(key) || out.set(key, new MeshBuilder(4)).get(key);
  const colPos = [], colIdx = [];
  let dropped = 0;
  // Adds the triangles appended to builder m since vertex `from` / index `iFrom` to the collision soup.
  const toCollision = (m, from, iFrom) => {
    const base = colPos.length / 3;
    for (let v = from; v < m.count; v++) colPos.push(m.p[v * 3], m.p[v * 3 + 1], m.p[v * 3 + 2]);
    for (let i = iFrom; i < m.i.length; i++) colIdx.push(m.i[i] - from + base);
  };

  t.buildings.forEach((b, bi) => {
    if (!b.rings.length || b.rings[0].length < 6) return;
    if (!keep(b)) { dropped++; return; }
    const isWall = (b.flags & BUILDING_FLAG.WALL) !== 0;
    const style = Math.min(b.style, STYLES.length - 1);
    const seed = rand(t.tx * 7919 + bi, t.tz * 104729 + bi);
    const levels = b.levels || Math.max(1, Math.round((b.height - b.minHeight) / 3.2));
    const storey = isWall ? 3 : Math.min(4.2, Math.max(2.8, (b.height - Math.max(b.minHeight, 0)) / levels));
    const flags = isWall || style === 7 ? FACADE.BLANK : (b.flags & BUILDING_FLAG.SHOPS ? FACADE.SHOPS : 0) | (style === 6 ? FACADE.GLASS : 0);
    const col = srgbBytesToLinear(b.color);
    const y0 = b.minHeight > 0.5 ? b.minHeight : Y.ROAD - 0.3; // a little below the street: no gap on slopes
    const y1 = Math.max(b.height, y0 + 0.5);
    const m = get(isWall ? 'wall' : `walls${style}`);
    m.cur[0] = seed; m.cur[1] = storey; m.cur[2] = flags; m.cur[3] = BAY[style];
    const collide = !(b.flags & BUILDING_FLAG.NO_COLLIDE) && b.minHeight < 2.5;
    const v0 = m.count, i0 = m.i.length;

    // Walls: every ring edge, facing out of the solid part (holes face into the courtyard).
    const outer = b.rings[0];
    const inside = (x, z) => {
      let s = pointInRing(x, z, outer);
      for (let r = 1; r < b.rings.length; r++) if (pointInRing(x, z, b.rings[r])) s = !s;
      return s;
    };
    const parapet = !isWall && style !== 7 && y1 - y0 > 4 ? PARAPET : 0;
    for (const ring of b.rings) {
      const n = ring.length / 2;
      let u = 0;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const ax = ring[i * 2], az = ring[i * 2 + 1], bx = ring[j * 2], bz = ring[j * 2 + 1];
        const len = Math.hypot(bx - ax, bz - az);
        if (len < 0.02) continue;
        let nx = (bz - az) / len, nz = -(bx - ax) / len;
        if (inside((ax + bx) / 2 + nx * 0.05, (az + bz) / 2 + nz * 0.05)) { nx = -nx; nz = -nz; }
        // v is metres above the street, so the shader can find the ground floor.
        wall(m, ax, az, bx, bz, y0, y1 + parapet, nx, nz, u, u + len, y0 - Y.ROAD, y1 + parapet - Y.ROAD, col);
        if (parapet) {
          // Inner face of the parapet and its coping.
          const ix = -nx * 0.25, iz = -nz * 0.25;
          const r = get('roof');
          wall(r, ax + ix, az + iz, bx + ix, bz + iz, y1, y1 + parapet, -nx, -nz, u, u + len, 0, parapet, col);
          const c0 = r.v(ax, y1 + parapet, az, 0, 1, 0, u, 0, col), c1 = r.v(bx, y1 + parapet, bz, 0, 1, 0, u + len, 0, col);
          const c2 = r.v(bx + ix, y1 + parapet, bz + iz, 0, 1, 0, u + len, 0.25, col), c3 = r.v(ax + ix, y1 + parapet, az + iz, 0, 1, 0, u, 0.25, col);
          r.triUp(c0, c1, c2); r.triUp(c0, c2, c3);
        }
        u += len;
      }
    }
    if (collide) toCollision(m, v0, i0);
    // Roof (and, for raised buildings, the underside).
    const roof = get(isWall ? 'wall' : 'roof');
    const r0 = roof.count, ri0 = roof.i.length;
    flatPolygon(roof, b.rings, y1, isWall ? col : linear(0x9a948a), 0, 0);
    if (collide) toCollision(roof, r0, ri0);
    if (b.minHeight > 0.5) flatPolygon(roof, b.rings, y0, linear(0x777777), 0, 0, true);
  });
  return { builders: out, collision: { pos: colPos, idx: colIdx }, dropped };
}
