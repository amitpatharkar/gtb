// Vehicle models uploaded to public/art/vehicles/<id>.glb (free Sketchfab cars and the like)
// turned into the fleet's own four parts (src/vehicles/fleet.js): paint (tinted per vehicle),
// glass, trim (vertex colours) and lamps (glow at night), in metres, +z forward, wheels on
// y = 0, plus a coarse far version. Called by scripts/art-index.mjs during the build.
//
// - The model's own textures are dropped (no real badges, logos or number plates): trim and
//   lamps keep their colours as vertex colours sampled from a 256 px copy of the texture,
//   which blurs small print away; paint is plain and takes each vehicle's own tint.
// - Parts are guessed from material and object names (body/paint, glass/window, light/lamp),
//   transparency and glow; with no named paint, the largest evenly coloured material is paint.
// - Orientation: Z-up files are stood up, the long side turned along z, and red lamps put at
//   the back (`flip` in src/vehicles/vehicleModels.js turns one that still comes out wrong).
// - Scaled to the real length of the type; slimmed with meshoptimizer.
import sharp from 'sharp';
import { MeshoptSimplifier } from 'meshoptimizer';
import { readGlb, readAccessor, imageBytes, GlbWriter, identity, mul, nodeMatrix, det3 } from './lib/glb.mjs';
import { VEHICLE_ART, lengthFor } from '../src/vehicles/vehicleModels.js';

const PARTS = ['paint', 'glass', 'trim', 'lamps'];
const NEAR = { paint: 2400, glass: 380, trim: 1800, lamps: 200 };
const FAR = { paint: 300, glass: 50, trim: 200, lamps: 30 };
const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); // sRGB byte/255 → linear

function classify(mat, names) {
  const n = `${mat?.name || ''} ${names}`;
  const pbr = mat?.pbrMetallicRoughness || {}, sg = mat?.extensions?.KHR_materials_pbrSpecularGlossiness;
  const f = pbr.baseColorFactor || sg?.diffuseFactor || [1, 1, 1, 1];
  const transmission = (mat?.extensions?.KHR_materials_transmission?.transmissionFactor || 0) > 0.3;
  if (/glass|window|windshield|windscreen|vidrio|\bglas\b|cristal|scheibe/i.test(n) || (mat?.alphaMode === 'BLEND' && f[3] < 0.9) || transmission) return 'glass';
  const em = mat?.emissiveFactor || [0, 0, 0];
  if (/head_?light|tail_?light|lamp|\blights?\b|_light|light_|indicator|blinker|brake|reflector|emissi/i.test(n) || Math.max(...em) > 0.3 || mat?.emissiveTexture) return 'lamps';
  if (/interior|inside|seat|tyre|tire|wheel|rim|rubber|chrome|plate|grill|dash/i.test(n)) return 'trim';
  if (/paint|body|carpaint|exterior|bodywork|shell|kaross|carroc|chassis/i.test(n)) return 'paint';
  return 'trim';
}

export async function buildVehicle(file, id, fleetLen = {}) {
  const { json, bin } = readGlb(file);
  const req = json.extensionsRequired || [];
  if (req.some((e) => /draco|meshopt|basisu/i.test(e))) throw new Error(`compressed file (${req.join(', ')}); upload the "glb" download instead`);
  await MeshoptSimplifier.ready;

  // Textures → small raw copies for colour sampling.
  const pics = await Promise.all((json.images || []).map(async (_, i) => {
    const bytes = imageBytes(json, bin, i);
    if (!bytes) return null;
    try {
      const { data, info } = await sharp(bytes).resize(256, 256, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      return { data, w: info.width, h: info.height };
    } catch { return null; }
  }));
  const texOf = (t) => (t === undefined ? null : pics[json.textures?.[t.index]?.source] || null);

  // Every triangle in world space, grouped by part (then by material for the paint guess).
  const groups = []; // { part, mat, pos: [], nrm: [], col: [], area }
  const walk = (ni, parent) => {
    const node = json.nodes[ni], m = mul(parent, nodeMatrix(node));
    if (node.mesh !== undefined) {
      const mesh = json.meshes[node.mesh], flipWinding = det3(m) < 0;
      for (const prim of mesh.primitives) {
        if ((prim.mode ?? 4) !== 4 || prim.attributes.POSITION === undefined) continue;
        const mat = json.materials?.[prim.material];
        const part = classify(mat, `${mesh.name || ''} ${node.name || ''}`);
        const P = readAccessor(json, bin, prim.attributes.POSITION, { float: true }).arr;
        const N = prim.attributes.NORMAL !== undefined ? readAccessor(json, bin, prim.attributes.NORMAL, { float: true }).arr : null;
        const pbr = mat?.pbrMetallicRoughness || {}, sg = mat?.extensions?.KHR_materials_pbrSpecularGlossiness;
        const tex = texOf(pbr.baseColorTexture ?? sg?.diffuseTexture);
        const uvSet = (pbr.baseColorTexture ?? sg?.diffuseTexture)?.texCoord || 0;
        const UV = tex && prim.attributes[`TEXCOORD_${uvSet}`] !== undefined ? readAccessor(json, bin, prim.attributes[`TEXCOORD_${uvSet}`], { float: true }).arr : null;
        const VC = prim.attributes.COLOR_0 !== undefined ? readAccessor(json, bin, prim.attributes.COLOR_0, { float: true }) : null;
        const f = pbr.baseColorFactor || sg?.diffuseFactor || [1, 1, 1, 1];
        const count = P.length / 3;
        const idx = prim.indices !== undefined ? readAccessor(json, bin, prim.indices).arr : Uint32Array.from({ length: count }, (_, i) => i);
        const g = { part, mat: prim.material ?? -1, pos: [], nrm: [], col: [], area: 0 };
        const vp = new Float32Array(count * 3), vn = new Float32Array(count * 3), vc = new Float32Array(count * 3);
        for (let v = 0; v < count; v++) {
          const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
          vp[v * 3] = m[0] * x + m[4] * y + m[8] * z + m[12]; vp[v * 3 + 1] = m[1] * x + m[5] * y + m[9] * z + m[13]; vp[v * 3 + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
          if (N) {
            const a = N[v * 3], b = N[v * 3 + 1], c = N[v * 3 + 2];
            let nx = m[0] * a + m[4] * b + m[8] * c, ny = m[1] * a + m[5] * b + m[9] * c, nz = m[2] * a + m[6] * b + m[10] * c;
            const l = Math.hypot(nx, ny, nz) || 1; vn[v * 3] = nx / l; vn[v * 3 + 1] = ny / l; vn[v * 3 + 2] = nz / l;
          }
          let r = f[0], gg = f[1], b = f[2];
          if (tex && UV) {
            let u = UV[v * 2] % 1, w = UV[v * 2 + 1] % 1; if (u < 0) u += 1; if (w < 0) w += 1;
            const px = Math.min(tex.w - 1, Math.floor(u * tex.w)), py = Math.min(tex.h - 1, Math.floor(w * tex.h)), o = (py * tex.w + px) * 4;
            r *= lin(tex.data[o] / 255); gg *= lin(tex.data[o + 1] / 255); b *= lin(tex.data[o + 2] / 255);
          }
          if (VC) { r *= VC.arr[v * VC.n]; gg *= VC.arr[v * VC.n + 1]; b *= VC.arr[v * VC.n + 2]; }
          vc[v * 3] = r; vc[v * 3 + 1] = gg; vc[v * 3 + 2] = b;
        }
        for (let t = 0; t + 2 < idx.length; t += 3) {
          const tri = flipWinding ? [idx[t], idx[t + 2], idx[t + 1]] : [idx[t], idx[t + 1], idx[t + 2]];
          const [a, b, c] = tri.map((k) => k * 3);
          const ux = vp[b] - vp[a], uy = vp[b + 1] - vp[a + 1], uz = vp[b + 2] - vp[a + 2], wx = vp[c] - vp[a], wy = vp[c + 1] - vp[a + 1], wz = vp[c + 2] - vp[a + 2];
          const cx = uy * wz - uz * wy, cy = uz * wx - ux * wz, cz = ux * wy - uy * wx, ar = Math.hypot(cx, cy, cz);
          if (ar < 1e-12) continue;
          g.area += ar / 2;
          for (const k of [a, b, c]) {
            g.pos.push(vp[k], vp[k + 1], vp[k + 2]);
            if (N) g.nrm.push(vn[k], vn[k + 1], vn[k + 2]); else g.nrm.push(cx / ar, cy / ar, cz / ar);
            g.col.push(vc[k], vc[k + 1], vc[k + 2]);
          }
        }
        if (g.pos.length) groups.push(g);
      }
    }
    for (const c of node.children || []) walk(c, m);
  };
  const scene = json.scenes?.[json.scene ?? 0];
  const roots = scene ? scene.nodes : json.nodes.map((_, i) => i).filter((i) => !json.nodes.some((n) => n.children?.includes(i)));
  for (const r of roots) walk(r, identity());
  if (!groups.length) throw new Error('no triangles');

  // No part called paint: the biggest evenly coloured material (not an atlas) is the body.
  if (!groups.some((g) => g.part === 'paint')) {
    const byMat = new Map();
    for (const g of groups) if (g.part === 'trim') { const e = byMat.get(g.mat) || byMat.set(g.mat, { area: 0, gs: [] }).get(g.mat); e.area += g.area; e.gs.push(g); }
    const total = groups.reduce((s, g) => s + (g.part === 'trim' ? g.area : 0), 0);
    let best = null;
    for (const [, e] of byMat) {
      let s = 0, s2 = 0, k = 0;
      for (const g of e.gs) for (let i = 0; i < g.col.length; i += 9) { const L = 0.2126 * g.col[i] + 0.7152 * g.col[i + 1] + 0.0722 * g.col[i + 2]; s += L; s2 += L * L; k++; }
      const mean = s / k, sd = Math.sqrt(Math.max(0, s2 / k - mean * mean));
      if (e.area > total * 0.22 && sd < 0.08 && mean > 0.03 && (!best || e.area > best.area)) best = e;
    }
    if (best) for (const g of best.gs) g.part = 'paint';
  }
  // Lamps: clean lamp colours (red at the back, amber indicators, white-yellow heads).
  for (const g of groups) if (g.part === 'lamps') for (let i = 0; i < g.col.length; i += 3) {
    const r = g.col[i], gg = g.col[i + 1], b = g.col[i + 2];
    const c = r > gg * 1.8 && r > b * 1.8 ? (gg > r * 0.35 ? [1, 0.45, 0.05] : [0.9, 0.05, 0.04]) : [1, 0.97, 0.88];
    g.col[i] = c[0]; g.col[i + 1] = c[1]; g.col[i + 2] = c[2];
  }

  // Orientation and size.
  const all = (fn) => { for (const g of groups) for (let i = 0; i < g.pos.length; i += 3) fn(g, i); };
  const bbox = () => { const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]; all((g, i) => { for (let k = 0; k < 3; k++) { b[k] = Math.min(b[k], g.pos[i + k]); b[k + 3] = Math.max(b[k + 3], g.pos[i + k]); } }); return b; };
  const turn = (fn) => all((g, i) => { for (const arr of [g.pos, g.nrm]) { const [x, y, z] = fn(arr[i], arr[i + 1], arr[i + 2]); arr[i] = x; arr[i + 1] = y; arr[i + 2] = z; } });
  // Stray objects (a ground plane, a turntable, a spare wheel beside the car, a light rig) would
  // throw the size and orientation off: keep what lies within the bulk of the vertices.
  {
    const n = groups.reduce((s, g) => s + g.pos.length / 3, 0), ax = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
    let k = 0;
    all((g, i) => { ax[0][k] = g.pos[i]; ax[1][k] = g.pos[i + 1]; ax[2][k] = g.pos[i + 2]; k++; });
    const lim = ax.map((a) => { a.sort(); const lo = a[Math.floor(n * 0.02)], hi = a[Math.floor(n * 0.98)], m = (hi - lo) * 0.12; return [lo - m, hi + m]; });
    const inside = (g, i) => lim.every(([lo, hi], c) => g.pos[i + c] >= lo && g.pos[i + c] <= hi);
    let dropped = 0;
    for (const g of groups) {
      const P = [], N = [], C = [];
      for (let i = 0; i < g.pos.length; i += 9) {
        if (!(inside(g, i) && inside(g, i + 3) && inside(g, i + 6))) { dropped++; continue; }
        for (let j = 0; j < 9; j++) { P.push(g.pos[i + j]); N.push(g.nrm[i + j]); C.push(g.col[i + j]); }
      }
      g.pos = P; g.nrm = N; g.col = C;
    }
    if (dropped) groups.splice(0, groups.length, ...groups.filter((g) => g.pos.length));
    if (!groups.length) throw new Error('nothing left after trimming stray objects');
    if (dropped > 50) var trimmed = dropped; // reported below
  }
  let b = bbox();
  const notes = [];
  if (typeof trimmed !== 'undefined') notes.push(`${trimmed} stray triangles dropped`);
  if (b[4] - b[1] > Math.max(b[3] - b[0], b[5] - b[2]) * 1.2) { turn((x, y, z) => [x, z, -y]); notes.push('stood up (Z-up file)'); b = bbox(); }
  if (b[3] - b[0] > (b[5] - b[2]) * 1.15) { turn((x, y, z) => [z, y, -x]); notes.push('turned 90°'); b = bbox(); }
  let red = [0, 0], white = [0, 0];
  for (const g of groups) if (g.part === 'lamps') for (let i = 0; i < g.col.length; i += 3) { const z = g.pos[i + 2]; if (g.col[i + 1] < 0.2) { red[0] += z; red[1]++; } else if (g.col[i + 1] > 0.9) { white[0] += z; white[1]++; } }
  const zc = (b[2] + b[5]) / 2, rz = red[1] ? red[0] / red[1] : null, wz = white[1] ? white[0] / white[1] : null;
  let flip = rz !== null && wz !== null ? rz > wz : rz !== null ? rz > zc : wz !== null ? wz < zc : false;
  if (VEHICLE_ART[id]?.flip) flip = !flip;
  if (flip) { turn((x, y, z) => [-x, y, -z]); notes.push('turned round'); b = bbox(); }
  const own = b[5] - b[2], len = lengthFor(id, own, fleetLen), s = len / own;
  const cx = (b[0] + b[3]) / 2, cz = (b[2] + b[5]) / 2;
  all((g, i) => { g.pos[i] = (g.pos[i] - cx) * s; g.pos[i + 1] = (g.pos[i + 1] - b[1]) * s; g.pos[i + 2] = (g.pos[i + 2] - cz) * s; });
  const info = { len: +len.toFixed(2), wid: +((b[3] - b[0]) * s).toFixed(2), hgt: +((b[4] - b[1]) * s).toFixed(2), notes };

  // Per part: weld identical vertices, simplify to the budget, write.
  const make = (budget, error) => {
    const w = new GlbWriter(), nodes = [], meshes = [], counts = {};
    for (const part of PARTS) {
      const gs = groups.filter((g) => g.part === part);
      // Weld by position only (flat-shaded exports split every corner, which stops the
      // simplifier), with the colour averaged per welded vertex.
      const key = new Map(), P = [], C = [], cn = [], idx = [];
      for (const g of gs) for (let i = 0; i < g.pos.length; i += 3) {
        const k = `${Math.round(g.pos[i] * 1e4)},${Math.round(g.pos[i + 1] * 1e4)},${Math.round(g.pos[i + 2] * 1e4)}`;
        let v = key.get(k);
        if (v === undefined) { v = P.length / 3; key.set(k, v); P.push(g.pos[i], g.pos[i + 1], g.pos[i + 2]); C.push(0, 0, 0); cn.push(0); }
        C[v * 3] += g.col[i]; C[v * 3 + 1] += g.col[i + 1]; C[v * 3 + 2] += g.col[i + 2]; cn[v]++;
        idx.push(v);
      }
      for (let v = 0; v < cn.length; v++) for (let c = 0; c < 3; c++) C[v * 3 + c] /= cn[v];
      let ind = Uint32Array.from(idx);
      const pos = Float32Array.from(P);
      if (ind.length / 3 > budget[part]) {
        let [out] = MeshoptSimplifier.simplify(ind, pos, 3, budget[part] * 3, error);
        for (let e = error * 4; out.length / 3 > budget[part] * 1.5 && e < 0.5; e *= 3) [out] = MeshoptSimplifier.simplify(ind, pos, 3, budget[part] * 3, e); // (no 'Prune': car bodies are many separate panels)
        if (out.length >= 3) ind = out;
      }
      // Unwelded output with crease normals: a corner averages the faces round its vertex that
      // bend less than 40° from its own face (smooth panels, sharp edges stay sharp).
      const nt = ind.length / 3, F = new Float32Array(nt * 3), A = new Float32Array(nt), around = new Map();
      for (let t = 0; t < nt; t++) {
        const a = ind[t * 3] * 3, b2 = ind[t * 3 + 1] * 3, c = ind[t * 3 + 2] * 3;
        const ux = P[b2] - P[a], uy = P[b2 + 1] - P[a + 1], uz = P[b2 + 2] - P[a + 2], wx = P[c] - P[a], wy = P[c + 1] - P[a + 1], wz = P[c + 2] - P[a + 2];
        const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx, l = Math.hypot(nx, ny, nz) || 1;
        F[t * 3] = nx / l; F[t * 3 + 1] = ny / l; F[t * 3 + 2] = nz / l; A[t] = l;
        for (let k = 0; k < 3; k++) { const v = ind[t * 3 + k]; (around.get(v) || around.set(v, []).get(v)).push(t); }
      }
      let used = nt * 3;
      let fp = new Float32Array(used * 3), fn = new Float32Array(used * 3), fc = new Float32Array(used * 3);
      const COS = Math.cos((40 * Math.PI) / 180);
      for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++) {
        const v = ind[t * 3 + k], o = (t * 3 + k) * 3;
        let sx = 0, sy = 0, sz = 0;
        for (const u of around.get(v)) {
          if (F[u * 3] * F[t * 3] + F[u * 3 + 1] * F[t * 3 + 1] + F[u * 3 + 2] * F[t * 3 + 2] < COS) continue;
          sx += F[u * 3] * A[u]; sy += F[u * 3 + 1] * A[u]; sz += F[u * 3 + 2] * A[u];
        }
        const l = Math.hypot(sx, sy, sz) || 1;
        fn[o] = sx / l; fn[o + 1] = sy / l; fn[o + 2] = sz / l;
        for (let c = 0; c < 3; c++) { fp[o + c] = P[v * 3 + c]; fc[o + c] = C[v * 3 + c]; }
      }
      // Corners with the same vertex and normal are shared again (indexed output, smaller file).
      {
        const key = new Map(), keep = [], idx2 = new Uint32Array(used);
        for (let i = 0; i < used; i++) {
          const k = `${ind[i]},${Math.round(fn[i * 3] * 90)},${Math.round(fn[i * 3 + 1] * 90)},${Math.round(fn[i * 3 + 2] * 90)}`;
          let v = key.get(k);
          if (v === undefined) { v = keep.length; key.set(k, v); keep.push(i); }
          idx2[i] = v;
        }
        const P2 = new Float32Array(keep.length * 3), N2 = new Float32Array(keep.length * 3), C2 = new Float32Array(keep.length * 3);
        keep.forEach((i, v) => { for (let c = 0; c < 3; c++) { P2[v * 3 + c] = fp[i * 3 + c]; N2[v * 3 + c] = fn[i * 3 + c]; C2[v * 3 + c] = fc[i * 3 + c]; } });
        fp = P2; fn = N2; fc = C2; ind = idx2; used = keep.length;
      }
      if (!nt) { fp = new Float32Array(9); fn = new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]); fc = new Float32Array(9); ind = Uint32Array.from([0, 1, 2]); used = 3; }
      counts[part] = ind.length / 3;
      // Positions as 16-bit integers in the part's box (the node's scale and translation restore
      // metres), normals and colours as bytes: about a third of the floats' size.
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < fp.length; i += 3) for (let c = 0; c < 3; c++) { lo[c] = Math.min(lo[c], fp[i + c]); hi[c] = Math.max(hi[c], fp[i + c]); }
      const ctr = lo.map((l, c) => (l + hi[c]) / 2), ext = Math.max(1e-4, ...lo.map((l, c) => (hi[c] - l) / 2));
      const qp = new Float32Array(fp.length);
      for (let i = 0; i < fp.length; i += 3) for (let c = 0; c < 3; c++) qp[i + c] = (fp[i + c] - ctr[c]) / ext;
      meshes.push({ name: part, primitives: [{ attributes: { POSITION: w.quantised(qp, 3, 'i16', true), NORMAL: w.quantised(fn, 3, 'i8'), COLOR_0: w.quantised(fc, 3, 'u8') }, indices: w.indices(ind, used) }] });
      nodes.push({ name: part, mesh: meshes.length - 1, translation: ctr, scale: [ext, ext, ext] });
    }
    const out = w.build({ asset: { version: '2.0', generator: 'Bombay Bawaal art build' }, extensionsUsed: ['KHR_mesh_quantization'], extensionsRequired: ['KHR_mesh_quantization'], scene: 0, scenes: [{ nodes: nodes.map((_, i) => i) }], nodes, meshes });
    return { out, counts };
  };
  const near = make(NEAR, 0.004), far = make(FAR, 0.03);
  info.near = near.counts; info.far = far.counts;
  info.paint = groups.some((g) => g.part === 'paint');
  return { near: near.out, far: far.out, info };
}
