// An uploaded local-train coach with its interior (public/art/trains/<id>.glb) → the coach the
// player rides in (src/sim/trains.js shows it in place of the plain coach they board).
//
// Turned into the game's coach frame (z along the coach, x across, y up from the rail top),
// stretched to a real Mumbai EMU coach (20.73 m long, 3.66 m wide, 3.81 m high), benches,
// partitions and grilles simplified by vertex clustering, underframe and bogies added (the file
// has none), flat colours by part; the textured body keeps its picture. The doorway centres along
// the coach are measured from the openings in the body's side and stored in the file's extras
// (`doors`), so the rider stands in a real doorway.
import { readGlb, readAccessor, imageBytes, identity, mul, nodeMatrix, det3 } from './lib/glb.mjs';
import { Writer } from './people/glbwriter.mjs';
import { MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

const LEN = 20.73, WIDTH = 3.66, SOLE = 1.05, TOP = 3.81, FLOOR = 1.2;
// Per material of the uploaded file: the colour it gets (sRGB) and how much of it to keep.
const PARTS = {
  'Material_0.067': { col: 0xaeb4ba, cell: 0.025 },           // steel benches
  'Material.039': { col: 0x3a3f46, cell: 0.015 },             // ladder partitions beside the doorways
  'Material.003': { col: 0xdcddd8, cell: 0.05 },              // roof and ceiling
  'Material.046': { col: 0x8f9190, cell: 0.01 },              // floor and inner walls
  'Material.008': { col: 0x2b2d31, cell: 0.015 },             // window frames and bars
  'Material.031': { col: 0xd9dcd6, cell: 0.03 },              // end panel
};

export async function buildCoach(buf) {
  const { json, bin } = readGlb(buf);
  if ((json.extensionsRequired || []).length) throw new Error('compressed GLB');
  const prims = [];
  const walk = (ni, parent) => {
    const node = json.nodes[ni], m = mul(parent, nodeMatrix(node));
    if (node.mesh !== undefined) for (const p of json.meshes[node.mesh].primitives) {
      const pos = readAccessor(json, bin, p.attributes.POSITION, { float: true }).arr, n = pos.length / 3;
      const W = new Float64Array(n * 3);
      for (let i = 0; i < n; i++) {
        const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
        W[i * 3] = m[0] * x + m[4] * y + m[8] * z + m[12]; W[i * 3 + 1] = m[1] * x + m[5] * y + m[9] * z + m[13]; W[i * 3 + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
      }
      let idx = p.indices !== undefined ? Uint32Array.from(readAccessor(json, bin, p.indices).arr) : Uint32Array.from({ length: n }, (_, i) => i);
      if (det3(m) < 0) for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
      const mat = json.materials?.[p.material] || {};
      const uv = p.attributes.TEXCOORD_0 !== undefined ? readAccessor(json, bin, p.attributes.TEXCOORD_0, { float: true }).arr : null;
      const tex = mat.pbrMetallicRoughness?.baseColorTexture;
      prims.push({ W, idx, uv, name: mat.name || '', tex: tex ? json.textures[tex.index].source : null });
    }
    for (const c of node.children || []) walk(c, m);
  };
  for (const r of json.scenes[json.scene || 0].nodes) walk(r, identity());
  const body = prims.find((p) => p.tex !== null);
  if (!body) throw new Error('no textured body');
  // The body's box sets the fit.
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < body.W.length; i++) { lo[i % 3] = Math.min(lo[i % 3], body.W[i]); hi[i % 3] = Math.max(hi[i % 3], body.W[i]); }
  const xc = (lo[0] + hi[0]) / 2, zc = (lo[2] + hi[2]) / 2;
  const sAlong = LEN / (hi[0] - lo[0]), sAcross = WIDTH / (hi[2] - lo[2]), sUp = (TOP - SOLE) / (hi[1] - lo[1]);
  // File x (along) → coach z, file z (across) → coach -x: a turn, not a mirror.
  const to = (x, y, z) => [-(z - zc) * sAcross, SOLE + (y - lo[1]) * sUp, (x - xc) * sAlong];
  // Doorways: gaps in the body's near side at knee height, measured in the file.
  const doors = [];
  {
    const side = [], y = lo[1] + (hi[1] - lo[1]) * 0.18;
    for (let i = 0; i < body.idx.length; i += 3) {
      const [a, b, c] = [body.idx[i], body.idx[i + 1], body.idx[i + 2]].map((k) => [body.W[k * 3], body.W[k * 3 + 1], body.W[k * 3 + 2]]);
      if ((a[2] + b[2] + c[2]) / 3 > zc) continue;
      side.push([a, b, c]);
    }
    const covered = (x) => side.some(([a, b, c]) => {
      const d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
      if (Math.abs(d) < 1e-9) return false;
      const l1 = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / d, l2 = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / d;
      return l1 >= 0 && l2 >= 0 && l1 + l2 <= 1;
    });
    let open = null;
    for (let x = lo[0] + 0.3; x <= hi[0] - 0.3; x += 0.05) {
      const c = covered(x);
      if (!c && open === null) open = x;
      if (c && open !== null) { if (x - open > 0.8) doors.push(+(((open + x) / 2 - xc) * sAlong).toFixed(2)); open = null; }
    }
  }
  if (doors.length < 2) throw new Error(`found ${doors.length} doorway(s) in the body's side`);

  await MeshoptEncoder.ready;
  const lin = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  // Coloured parts → one primitive with vertex colours (flat normals per face).
  const P = [], N = [], C = [];
  const face = (a, b, c, col) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz);
    if (l < 1e-10) return;
    nx /= l; ny /= l; nz /= l;
    for (const p of [a, b, c]) { P.push(...p); N.push(nx, ny, nz); C.push(...col); }
  };
  let kept = 0, before = 0;
  for (const p of prims) {
    if (p === body) continue;
    const part = PARTS[p.name] || { col: 0xbfc2c4, cell: 0.03 };
    const V = new Float32Array(p.W.length);
    for (let i = 0; i < p.W.length; i += 3) V.set(to(p.W[i], p.W[i + 1], p.W[i + 2]), i);
    // Corners snapped to a grid of `cell` metres and merged (vertex clustering): the file's
    // benches are 3,000 triangles each, in loose pieces the edge-collapse simplifier cannot touch.
    const cell = part.cell, rep = new Map(), cid = new Uint32Array(V.length / 3), CP = [];
    for (let i = 0; i < V.length / 3; i++) {
      const k = `${Math.round(V[i * 3] / cell)},${Math.round(V[i * 3 + 1] / cell)},${Math.round(V[i * 3 + 2] / cell)}`;
      let j = rep.get(k);
      if (j === undefined) { rep.set(k, j = CP.length / 4); CP.push(0, 0, 0, 0); }
      CP[j * 4] += V[i * 3]; CP[j * 4 + 1] += V[i * 3 + 1]; CP[j * 4 + 2] += V[i * 3 + 2]; CP[j * 4 + 3]++;
      cid[i] = j;
    }
    for (let j = 0; j < CP.length; j += 4) { V[j / 4 * 3] = CP[j] / CP[j + 3]; V[j / 4 * 3 + 1] = CP[j + 1] / CP[j + 3]; V[j / 4 * 3 + 2] = CP[j + 2] / CP[j + 3]; }
    const seen = new Set(), out = [];
    for (let i = 0; i < p.idx.length; i += 3) {
      const a = cid[p.idx[i]], b = cid[p.idx[i + 1]], c = cid[p.idx[i + 2]];
      if (a === b || b === c || a === c) continue;
      const k = [a, b, c].sort((x, y) => x - y).join(',');
      if (seen.has(k)) continue;
      seen.add(k); out.push(a, b, c);
    }
    const idx = out;
    before += p.idx.length / 3;
    kept += idx.length / 3;
    const col = lin(part.col);
    for (let i = 0; i < idx.length; i += 3) face([...V.subarray(idx[i] * 3, idx[i] * 3 + 3)], [...V.subarray(idx[i + 1] * 3, idx[i + 1] * 3 + 3)], [...V.subarray(idx[i + 2] * 3, idx[i + 2] * 3 + 3)], col);
  }
  // What the file leaves out: the underframe, equipment boxes and two bogies.
  const box = (x0, x1, y0, y1, z0, z1, hex, skipBottom = true) => {
    const col = lin(hex), q = (a, b, c, d) => { face(a, b, c, col); face(a, c, d, col); };
    q([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]);
    if (!skipBottom) q([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]);
    q([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]); q([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]);
    q([x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]); q([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]);
  };
  box(-1.4, 1.4, 0.8, SOLE, -9.7, 9.7, 0x1c1c1e);
  box(-1.3, 1.3, 0.42, 0.8, -3.6, -1.0, 0x242426); box(-1.3, 1.3, 0.42, 0.8, 0.4, 3.4, 0x242426);
  for (const zb of [-7.2, 7.2]) { box(-1.25, 1.25, 0.34, 0.76, zb - 1.55, zb + 1.55, 0x1c1c1e); for (const sx of [-1, 1]) for (const zw of [zb - 1.25, zb + 1.25]) box(sx * 0.95 - 0.06, sx * 0.95 + 0.06, 0, 0.92, zw - 0.46, zw + 0.46, 0x4a4a4e); }

  // The body keeps its picture (shrunk to 512 px).
  const BP = [], BN = [], BU = [];
  for (let i = 0; i < body.idx.length; i += 3) {
    const ks = [body.idx[i], body.idx[i + 1], body.idx[i + 2]], v = ks.map((k) => to(body.W[k * 3], body.W[k * 3 + 1], body.W[k * 3 + 2]));
    const ux = v[1][0] - v[0][0], uy = v[1][1] - v[0][1], uz = v[1][2] - v[0][2], wx = v[2][0] - v[0][0], wy = v[2][1] - v[0][1], wz = v[2][2] - v[0][2];
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const l = Math.hypot(nx, ny, nz);
    if (l < 1e-10) continue;
    nx /= l; ny /= l; nz /= l;
    for (let k = 0; k < 3; k++) { BP.push(...v[k]); BN.push(nx, ny, nz); BU.push(body.uv[ks[k] * 2], body.uv[ks[k] * 2 + 1]); }
  }
  const png = await sharp(imageBytes(json, bin, body.tex)).resize(512, 512, { fit: 'fill' }).png({ compressionLevel: 9 }).toBuffer();

  const w = new Writer();
  const seq = (n) => Uint32Array.from({ length: n }, (_, i) => i);
  const nodes = [], meshes = [];
  const add = (name, Pa, Na, extra, material) => {
    const lo2 = [Infinity, Infinity, Infinity], hi2 = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < Pa.length; i++) { lo2[i % 3] = Math.min(lo2[i % 3], Pa[i]); hi2[i % 3] = Math.max(hi2[i % 3], Pa[i]); }
    const mid = lo2.map((v, k) => (v + hi2[k]) / 2), ext = lo2.map((v, k) => Math.max(0.01, (hi2[k] - v) / 2));
    const Q = Pa.map((v, i) => (v - mid[i % 3]) / ext[i % 3]);
    const attributes = { POSITION: w.q(Q, 3, 'i16', { minMax: true }), NORMAL: w.q(Na, 3, 'i8'), ...extra };
    meshes.push({ name, primitives: [{ attributes, indices: w.indices(seq(Pa.length / 3), Pa.length / 3), material }] });
    nodes.push({ name, mesh: meshes.length - 1, translation: mid, scale: ext });
  };
  const img = w.plain(new Uint8Array(png));
  add('body', BP, BN, { TEXCOORD_0: w.f32(BU, 2) }, 0);
  add('parts', P, N, { COLOR_0: w.q(C, 3, 'u8') }, 1);
  const glb = w.glb({
    asset: { version: '2.0', generator: 'gtb art-coach', extras: { doors } },
    extensionsUsed: ['EXT_meshopt_compression', 'KHR_mesh_quantization'], extensionsRequired: ['EXT_meshopt_compression', 'KHR_mesh_quantization'],
    scene: 0, scenes: [{ nodes: nodes.map((_, i) => i) }], nodes, meshes,
    images: [{ bufferView: img, mimeType: 'image/png' }], samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }], textures: [{ source: 0, sampler: 0 }],
    materials: [
      { name: 'coach', doubleSided: true, pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0.25, roughnessFactor: 0.45 } },
      { name: 'parts', doubleSided: true, pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0.2, roughnessFactor: 0.55 } },
    ],
  });
  return { glb, info: { doors, triangles: Math.round(kept + BP.length / 9), before: Math.round(before + body.idx.length / 3), len: LEN } };
}
