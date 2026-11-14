// Minimal GLB (binary glTF 2.0) reading and writing for the art build (scripts/art-index.mjs,
// scripts/art-vehicles.mjs): uncompressed accessors only (Draco/meshopt-compressed files are
// refused), interleaved buffers and normalised integers supported.

const COMP = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const NORM = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 };
export const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

export function readGlb(buf) {
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB file');
  let o = 12, json = null, bin = null;
  while (o + 8 <= buf.length) {
    const len = buf.readUInt32LE(o), type = buf.readUInt32LE(o + 4), data = buf.subarray(o + 8, o + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(data.toString('utf8')); else if (type === 0x004e4942) bin = data;
    o += 8 + len;
  }
  if (!json) throw new Error('GLB without JSON');
  return { json, bin };
}

/** Accessor i as a fresh typed array ({ arr, n, a }); `float: true` converts to Float32 (normalised ints → 0…1). */
export function readAccessor(json, bin, i, { float = false } = {}) {
  const a = json.accessors[i], n = SIZE[a.type], T = COMP[a.componentType];
  if (!T || !n || a.sparse) throw new Error('unsupported accessor');
  const out = float ? new Float32Array(a.count * n) : new T(a.count * n);
  if (a.bufferView === undefined) return { arr: out, n, a };
  const bv = json.bufferViews[a.bufferView], es = T.BYTES_PER_ELEMENT, stride = bv.byteStride || n * es;
  const base = bin.byteOffset + (bv.byteOffset || 0) + (a.byteOffset || 0);
  const dv = new DataView(bin.buffer);
  const get = { 5120: (p) => dv.getInt8(p), 5121: (p) => dv.getUint8(p), 5122: (p) => dv.getInt16(p, true), 5123: (p) => dv.getUint16(p, true), 5125: (p) => dv.getUint32(p, true), 5126: (p) => dv.getFloat32(p, true) }[a.componentType];
  const scale = float && a.normalized ? 1 / NORM[a.componentType] : 1;
  for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) out[k * n + c] = get(base + k * stride + c * es) * scale;
  return { arr: out, n, a };
}

/** The bytes of image i (embedded or data URI), or null. */
export function imageBytes(json, bin, i) {
  const img = json.images?.[i];
  if (!img) return null;
  if (img.bufferView !== undefined) { const bv = json.bufferViews[img.bufferView]; return bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength); }
  if (img.uri?.startsWith('data:')) return Buffer.from(img.uri.split(',')[1], 'base64');
  return null;
}

/** Collects buffer views for a new GLB. */
export class GlbWriter {
  constructor() { this.chunks = []; this.views = []; this.accessors = []; this.length = 0; }
  view(bytes, target) {
    const pad = (4 - (this.length % 4)) % 4;
    if (pad) { this.chunks.push(Buffer.alloc(pad)); this.length += pad; }
    this.views.push({ buffer: 0, byteOffset: this.length, byteLength: bytes.byteLength, ...(target ? { target } : {}) });
    this.chunks.push(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)); this.length += bytes.byteLength;
    return this.views.length - 1;
  }
  /** Float32 vertex attribute (n components); returns the accessor index. */
  attribute(arr, n, minMax = false) {
    const acc = { bufferView: this.view(arr, 34962), componentType: 5126, count: arr.length / n, type: ['', 'SCALAR', 'VEC2', 'VEC3', 'VEC4'][n] };
    if (minMax) {
      acc.min = Array(n).fill(Infinity); acc.max = Array(n).fill(-Infinity);
      for (let i = 0; i < arr.length; i++) { const c = i % n; if (arr[i] < acc.min[c]) acc.min[c] = arr[i]; if (arr[i] > acc.max[c]) acc.max[c] = arr[i]; }
    }
    this.accessors.push(acc); return this.accessors.length - 1;
  }
  indices(idx, vertexCount) {
    const small = vertexCount < 65536, arr = small ? Uint16Array.from(idx) : Uint32Array.from(idx);
    this.accessors.push({ bufferView: this.view(arr, 34963), componentType: small ? 5123 : 5125, count: arr.length, type: 'SCALAR' });
    return this.accessors.length - 1;
  }
  /** The finished file; `json` gets bufferViews, accessors and buffers filled in. */
  build(json) {
    json.bufferViews = this.views; json.accessors = this.accessors; json.buffers = [{ byteLength: this.length }];
    const jsonBuf = Buffer.from(JSON.stringify(json)), jpad = (4 - (jsonBuf.length % 4)) % 4;
    const binBuf = Buffer.concat(this.chunks), bpad = (4 - (binBuf.length % 4)) % 4;
    const head = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8);
    head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + jsonBuf.length + jpad + 8 + binBuf.length + bpad, 8);
    jh.writeUInt32LE(jsonBuf.length + jpad, 0); jh.writeUInt32LE(0x4e4f534a, 4);
    bh.writeUInt32LE(binBuf.length + bpad, 0); bh.writeUInt32LE(0x004e4942, 4);
    return Buffer.concat([head, jh, jsonBuf, Buffer.alloc(jpad, 0x20), bh, binBuf, Buffer.alloc(bpad)]);
  }
}

// ---- 4×4 matrices, column-major like glTF
export const identity = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
export function mul(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return o;
}
export function nodeMatrix(node) {
  if (node.matrix) return node.matrix.slice();
  const [x, y, z, w] = node.rotation || [0, 0, 0, 1], [sx, sy, sz] = node.scale || [1, 1, 1], [tx, ty, tz] = node.translation || [0, 0, 0];
  return [
    (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
    2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    tx, ty, tz, 1,
  ];
}
export const det3 = (m) => m[0] * (m[5] * m[10] - m[9] * m[6]) - m[4] * (m[1] * m[10] - m[9] * m[2]) + m[8] * (m[1] * m[6] - m[5] * m[2]);
