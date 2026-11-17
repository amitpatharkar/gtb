// GLB writer for the people build: meshopt-compressed (EXT_meshopt_compression) buffer views
// with quantised attributes (KHR_mesh_quantization). Used by build-people.mjs and build-anims.mjs.
import { MeshoptEncoder } from 'meshoptimizer';

export class Writer {
  constructor() { this.bin = []; this.len = 0; this.fallback = 0; this.views = []; this.accessors = []; }
  push(bytes) { const pad = (4 - (this.len % 4)) % 4; if (pad) { this.bin.push(Buffer.alloc(pad)); this.len += pad; } const off = this.len; this.bin.push(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)); this.len += bytes.byteLength; return off; }
  /** Compressed view (EXT_meshopt_compression); `stride` bytes per element. */
  view(raw, count, stride, mode, target) {
    const enc = MeshoptEncoder.encodeGltfBuffer(new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength), count, stride, mode);
    const off = this.push(enc);
    const fbOff = this.fallback; this.fallback += Math.ceil((count * stride) / 4) * 4;
    this.views.push({ buffer: 1, byteOffset: fbOff, byteLength: count * stride, ...(mode === 'ATTRIBUTES' ? { byteStride: stride } : {}), ...(target ? { target } : {}),
      extensions: { EXT_meshopt_compression: { buffer: 0, byteOffset: off, byteLength: enc.byteLength, byteStride: stride, mode, count } } });
    return this.views.length - 1;
  }
  accessor(a) { this.accessors.push(a); return this.accessors.length - 1; }
  /** Float32 positions (vec3 → 12-byte stride). */
  f32(arr, n, minMax) {
    const count = arr.length / n;
    const acc = { bufferView: this.view(Float32Array.from(arr), count, n * 4, 'ATTRIBUTES', 34962), componentType: 5126, count, type: ['', 'SCALAR', 'VEC2', 'VEC3', 'VEC4'][n] };
    if (minMax) { acc.min = [0, 1, 2].slice(0, n).map((c) => Infinity); acc.max = acc.min.map(() => -Infinity); for (let i = 0; i < arr.length; i++) { const c = i % n; acc.min[c] = Math.min(acc.min[c], arr[i]); acc.max[c] = Math.max(acc.max[c], arr[i]); } }
    return this.accessor(acc);
  }
  /** Normalised integers padded to a 4-byte stride: kind 'i8' | 'u8' | 'i16' | 'u16'. */
  q(arr, n, kind, { normalized = true, minMax = false, scale = 1 } = {}) {
    const T = { i8: Int8Array, u8: Uint8Array, i16: Int16Array, u16: Uint16Array }[kind];
    const max = { i8: 127, u8: 255, i16: 32767, u16: 65535 }[kind];
    const lo = kind[0] === 'i' ? -1 : 0;
    const es = T.BYTES_PER_ELEMENT, per = Math.ceil((n * es) / 4) * 4 / es, count = arr.length / n;
    const out = new T(count * per);
    for (let i = 0; i < count; i++) for (let c = 0; c < n; c++) {
      const v = arr[i * n + c] * scale;
      out[i * per + c] = normalized ? Math.round(Math.max(lo, Math.min(1, v)) * max) : v;
    }
    const acc = { bufferView: this.view(out, count, per * es, 'ATTRIBUTES', 34962), componentType: { i8: 5120, u8: 5121, i16: 5122, u16: 5123 }[kind], count, type: ['', 'SCALAR', 'VEC2', 'VEC3', 'VEC4'][n], ...(normalized ? { normalized: true } : {}) };
    if (minMax) {
      acc.min = Array(n).fill(Infinity); acc.max = Array(n).fill(-Infinity);
      for (let i = 0; i < count; i++) for (let c = 0; c < n; c++) { const v = normalized ? out[i * per + c] / max : out[i * per + c]; acc.min[c] = Math.min(acc.min[c], v); acc.max[c] = Math.max(acc.max[c], v); }
    }
    return this.accessor(acc);
  }
  indices(idx, vc) {
    const big = vc > 65535, arr = big ? Uint32Array.from(idx) : Uint16Array.from(idx);
    return this.accessor({ bufferView: this.view(arr, idx.length, big ? 4 : 2, 'TRIANGLES', 34963), componentType: big ? 5125 : 5123, count: idx.length, type: 'SCALAR' });
  }
  /** Plain (uncompressed) data, e.g. inverse bind matrices. */
  plain(f32) { const off = this.push(f32); this.views.push({ buffer: 0, byteOffset: off, byteLength: f32.byteLength }); return this.views.length - 1; }
  glb(json) {
    const binBuf = Buffer.concat(this.bin);
    json.buffers = [{ byteLength: binBuf.length }, { byteLength: Math.max(4, this.fallback), extensions: { EXT_meshopt_compression: { fallback: true } } }];
    json.bufferViews = this.views; json.accessors = this.accessors;
    let js = Buffer.from(JSON.stringify(json)); js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
    const bb = Buffer.concat([binBuf, Buffer.alloc((4 - (binBuf.length % 4)) % 4)]);
    const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bb.length, 8);
    const ch = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.writeUInt32LE(type, 4); return b; };
    return Buffer.concat([head, ch(js.length, 0x4e4f534a), js, ch(bb.length, 0x004e4942), bb]);
  }
}

