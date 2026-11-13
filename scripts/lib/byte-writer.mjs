// Growable byte buffer that writes the varint encoding read by src/world/tileFormat.js.
import { DM } from '../../src/world/tileFormat.js';

export class ByteWriter {
  constructor() { this.buf = Buffer.alloc(1 << 16); this.pos = 0; }
  ensure(n) {
    if (this.pos + n <= this.buf.length) return;
    const b = Buffer.alloc(Math.max(this.buf.length * 2, this.pos + n));
    this.buf.copy(b, 0, 0, this.pos);
    this.buf = b;
  }
  u8(v) { this.ensure(1); this.buf[this.pos++] = v & 0xff; }
  uvar(v) {
    if (!(v >= 0) || !Number.isInteger(v)) throw new Error(`uvar needs a non-negative integer, got ${v}`);
    this.ensure(8);
    while (v > 0x7f) { this.buf[this.pos++] = (v % 128) | 0x80; v = Math.floor(v / 128); }
    this.buf[this.pos++] = v;
  }
  svar(v) { this.uvar(v >= 0 ? v * 2 : -v * 2 - 1); }
  string(s) {
    const b = Buffer.from(s, 'utf8');
    this.uvar(b.length);
    this.ensure(b.length);
    b.copy(this.buf, this.pos);
    this.pos += b.length;
  }
  /** Points [[x, z], ...] in metres relative to the tile centre (already de-duplicated). */
  points(pts) {
    this.uvar(pts.length);
    let px = 0, pz = 0;
    for (const [x, z] of pts) {
      const qx = Math.round(x * DM), qz = Math.round(z * DM);
      this.svar(qx - px); this.svar(qz - pz);
      px = qx; pz = qz;
    }
  }
  rings(rings) { this.uvar(rings.length); rings.forEach((r) => this.points(r)); }
  result() { return this.buf.subarray(0, this.pos); }
}

/** Round to the decimetre grid and drop repeated points. */
export function quantize(pts, ox, oz, closed) {
  const out = [];
  for (const [x, z] of pts) {
    const q = [Math.round((x - ox) * DM) / DM, Math.round((z - oz) * DM) / DM];
    const last = out[out.length - 1];
    if (!last || last[0] !== q[0] || last[1] !== q[1]) out.push(q);
  }
  if (closed && out.length > 1) {
    const a = out[0], b = out[out.length - 1];
    if (a[0] === b[0] && a[1] === b[1]) out.pop();
  }
  return out;
}
