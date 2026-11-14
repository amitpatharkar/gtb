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
const NEAR = { paint: 3200, glass: 500, trim: 2600, lamps: 260 };
const FAR = { paint: 360, glass: 60, trim: 240, lamps: 40 };
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
  let b = bbox();
  const notes = [];
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
      const key = new Map(), P = [], N = [], C = [], idx = [];
      for (const g of gs) for (let i = 0; i < g.pos.length; i += 3) {
        const k = `${Math.round(g.pos[i] * 1e4)},${Math.round(g.pos[i + 1] * 1e4)},${Math.round(g.pos[i + 2] * 1e4)},${Math.round(g.nrm[i] * 50)},${Math.round(g.nrm[i + 1] * 50)},${Math.round(g.nrm[i + 2] * 50)},${Math.round(g.col[i] * 40)},${Math.round(g.col[i + 1] * 40)},${Math.round(g.col[i + 2] * 40)}`;
        let v = key.get(k);
        if (v === undefined) { v = P.length / 3; key.set(k, v); P.push(g.pos[i], g.pos[i + 1], g.pos[i + 2]); N.push(g.nrm[i], g.nrm[i + 1], g.nrm[i + 2]); C.push(g.col[i], g.col[i + 1], g.col[i + 2]); }
        idx.push(v);
      }
      let ind = Uint32Array.from(idx);
      const pos = Float32Array.from(P);
      if (ind.length / 3 > budget[part]) {
        let [out] = MeshoptSimplifier.simplify(ind, pos, 3, budget[part] * 3, error);
        if (out.length / 3 > budget[part] * 1.6) [out] = MeshoptSimplifier.simplify(ind, pos, 3, budget[part] * 3, error * 4);
        if (out.length >= 3) ind = out;
      }
      // Drop unused vertices.
      const remap = new Int32Array(P.length / 3).fill(-1); let used = 0;
      for (let i = 0; i < ind.length; i++) { if (remap[ind[i]] < 0) remap[ind[i]] = used++; ind[i] = remap[ind[i]]; }
      let fp = new Float32Array(used * 3), fn = new Float32Array(used * 3), fc = new Float32Array(used * 3);
      for (let v = 0; v < remap.length; v++) if (remap[v] >= 0) for (let k = 0; k < 3; k++) { fp[remap[v] * 3 + k] = P[v * 3 + k]; fn[remap[v] * 3 + k] = N[v * 3 + k]; fc[remap[v] * 3 + k] = C[v * 3 + k]; }
      if (!used) { fp = new Float32Array(9); fn = new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]); fc = new Float32Array(9); ind = Uint32Array.from([0, 1, 2]); used = 3; }
      counts[part] = ind.length / 3;
      meshes.push({ name: part, primitives: [{ attributes: { POSITION: w.attribute(fp, 3, true), NORMAL: w.attribute(fn, 3), COLOR_0: w.attribute(fc, 3) }, indices: w.indices(ind, used) }] });
      nodes.push({ name: part, mesh: meshes.length - 1 });
    }
    const out = w.build({ asset: { version: '2.0', generator: 'Bombay Bawaal art build' }, scene: 0, scenes: [{ nodes: nodes.map((_, i) => i) }], nodes, meshes });
    return { out, counts };
  };
  const near = make(NEAR, 0.004), far = make(FAR, 0.03);
  info.near = near.counts; info.far = far.counts;
  info.paint = groups.some((g) => g.part === 'paint');
  return { near: near.out, far: far.out, info };
}
