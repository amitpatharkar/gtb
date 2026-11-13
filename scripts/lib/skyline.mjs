// Far skyline: the tall buildings of the whole map as oriented boxes, in one small file.
// The game draws them beyond the radius where real tiles are loaded, so towers show
// through the haze from far away (src/world/skyline.js reads this format).
//
// File: 'SKY1', uint32 count, float32 minX, float32 minZ, then per box 11 bytes:
//   uint16 x, uint16 z   centre, half-metres from (minX, minZ)
//   uint8 w, uint8 d     footprint, metres (along / across the longest wall)
//   uint8 angle          direction of the longest wall, 256 steps over 180°
//   uint8 h              height, 2 m steps
//   uint8 r, g, b        wall colour
import zlib from 'node:zlib';

const CELL = 200, PER_CELL = 6, MIN_H = 15, ALWAYS_H = 45;

/** Oriented box around a footprint ring ([[x, z], ...]): along its longest wall, same area. */
function boxOf(ring, area) {
  let best = 0, ang = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l > best) { best = l; ang = Math.atan2(b[1] - a[1], b[0] - a[0]); }
  }
  const c = Math.cos(ang), s = Math.sin(ang);
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const [x, z] of ring) { const u = x * c + z * s, v = -x * s + z * c; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
  const um = (u0 + u1) / 2, vm = (v0 + v1) / 2;
  // L-shapes and courtyards: shrink the box towards the real floor area.
  const k = Math.max(0.72, Math.min(1, Math.sqrt(area / Math.max(1, (u1 - u0) * (v1 - v0)))));
  return { x: um * c - vm * s, z: um * s + vm * c, w: (u1 - u0) * k, d: (v1 - v0) * k, ang: ((ang % Math.PI) + Math.PI) % Math.PI };
}

/**
 * @param {{ ring: number[][], area: number, h: number, color: number[] }[]} list candidates (world metres)
 * @param {number[]} box map bounds [minX, minZ, maxX, maxZ]
 * @returns {{ gz: Buffer, count: number }}
 */
export function buildSkyline(list, box) {
  const cells = new Map();
  for (const b of list) {
    if (b.h < MIN_H) continue;
    const o = boxOf(b.ring, b.area);
    if (o.w < 5 || o.d < 5) continue;
    const k = `${Math.floor(o.x / CELL)},${Math.floor(o.z / CELL)}`;
    (cells.get(k) || cells.set(k, []).get(k)).push({ ...o, h: b.h, color: b.color, vol: b.h * b.area });
  }
  const keep = [];
  for (const arr of cells.values()) {
    arr.sort((a, b) => b.vol - a.vol);
    arr.forEach((b, i) => { if (i < PER_CELL || b.h >= ALWAYS_H) keep.push(b); });
  }
  keep.sort((a, b) => Math.floor(a.z / CELL) - Math.floor(b.z / CELL) || a.x - b.x); // neighbours together: compresses better
  const buf = Buffer.alloc(16 + keep.length * 11);
  buf.write('SKY1', 0, 'ascii');
  buf.writeUInt32LE(keep.length, 4);
  buf.writeFloatLE(box[0], 8);
  buf.writeFloatLE(box[1], 12);
  let o = 16;
  for (const b of keep) {
    buf.writeUInt16LE(Math.max(0, Math.min(65535, Math.round((b.x - box[0]) * 2))), o);
    buf.writeUInt16LE(Math.max(0, Math.min(65535, Math.round((b.z - box[1]) * 2))), o + 2);
    buf[o + 4] = Math.min(255, Math.round(b.w));
    buf[o + 5] = Math.min(255, Math.round(b.d));
    buf[o + 6] = Math.round((b.ang / Math.PI) * 256) & 255;
    buf[o + 7] = Math.min(255, Math.round(b.h / 2));
    buf[o + 8] = b.color[0]; buf[o + 9] = b.color[1]; buf[o + 10] = b.color[2];
    o += 11;
  }
  return { gz: zlib.gzipSync(buf, { level: 9 }), count: keep.length };
}
