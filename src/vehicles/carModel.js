// Car models: owner-uploaded GLB files (public/art/vehicles/, CC BY, credited in
// public/art/CREDITS.md), loaded as-is, turned to face +z, scaled to the real car's length and
// set on the ground. Wheels are found by node name, grouped into the four corners and moved
// into their own pivots so they can spin, steer and follow the suspension.
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const BASE = import.meta.env.BASE_URL;

// Visible names are parodies (no real brands). length: metres bumper to bumper. turn: extra
// rotation (radians) so the car faces +z. seat: driver's hip position (model space, right-hand drive).
// Handling numbers are a starting point; the tuning panel (F2) changes them live.
export const CARS = {
  ambassador: {
    file: 'hindustan_ambassador.glb', name: 'Hindostan Envoy', length: 4.33, turn: Math.PI, drive: 'rear', mass: 1150,
    accel: 3.6, top: 36, seat: [-0.36, 0.55, -0.25],
  },
  wagonr: {
    file: 'wagon_r_tkanimationsd742.glb', name: 'Wagon Arre', length: 3.6, turn: 0, drive: 'front', mass: 880,
    accel: 3.9, top: 40, seat: [-0.33, 0.55, -0.1],
  },
  sx4: {
    file: 'suzuki_sx4_sportback.glb', name: 'Zuzuki SX5', length: 4.15, turn: Math.PI, drive: 'front', mass: 1150,
    accel: 4.4, top: 48, seat: [-0.36, 0.55, -0.2],
  },
  city: {
    file: '2008_honda_city_v_at.glb', name: 'Handa Metro', length: 4.4, turn: 0, drive: 'front', mass: 1100,
    accel: 4.6, top: 50, seat: [-0.36, 0.55, -0.25],
  },
};

const WHEEL = /wheel|tire|tyre|rim\b|rim_|roda/i;
const NOT_WHEEL = /steer|stwheel|dummy|arch|well|mud|spare|brake|caliper|disc/i;
const HIDE = /plate|logo|badge|emblem|licen/i;
const NOT_PAINT = /glass|vidro|window|interior|interno|chrome|cromado|plastic|plastico|tyre|tire|rubber|black|preto|light|lamp|farol|indicator|mirror|grill|wiper/i;
// Common Mumbai car colours (sRGB).
const PAINTS = [0xf2f2f0, 0xe8e8e6, 0xb9bcbf, 0x8a8d90, 0x3c3f43, 0x15161a, 0x9b1b1e, 0x6b1420, 0x1f3f78, 0x2f5d8a, 0xc9b99a, 0x7b2f1d];

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const cache = new Map();

export function loadCarModel(id, colour) {
  if (!cache.has(id)) cache.set(id, loader.loadAsync(`${BASE}art/vehicles/${CARS[id].file}`).then((g) => prepare(id, g.scene)));
  return cache.get(id).then((proto) => instantiate(proto, colour));
}

function prepare(id, scene) {
  const spec = CARS[id];
  const root = new THREE.Group();
  root.add(scene);
  // Drop flat ground planes (baked shadow cards) that some uploads include.
  scene.updateMatrixWorld(true);
  const flat = [];
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const s = new THREE.Box3().setFromObject(o, true).getSize(new THREE.Vector3());
    if (s.y < 0.01 * Math.max(s.x, s.z) && (/plane|shadow|ground|floor/i.test(o.name) || Math.min(s.x, s.z) > 0.5 * Math.max(s.x, s.z))) flat.push(o);
  });
  for (const o of flat) o.removeFromParent();
  // Lengthwise along z.
  scene.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(scene, true);
  const size = box.getSize(new THREE.Vector3());
  const holder = new THREE.Group();
  root.add(holder); holder.add(scene);
  holder.rotation.y = (size.x > size.z ? Math.PI / 2 : 0) + spec.turn;
  holder.scale.setScalar(spec.length / Math.max(size.x, size.z));
  root.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(holder, true);
  const c = box.getCenter(new THREE.Vector3());
  holder.position.set(-c.x, -box.min.y, -c.z);
  root.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(holder, true);
  const dims = box.getSize(new THREE.Vector3());

  // Wheels: top-most nodes whose name says wheel/tyre/rim.
  const found = [];
  scene.traverse((o) => {
    if (!WHEEL.test(o.name) || NOT_WHEEL.test(o.name)) return;
    for (let p = o.parent; p; p = p.parent) if (found.includes(p)) return;
    found.push(o);
  });
  const corners = new Map();
  for (const o of found) {
    const b = new THREE.Box3().setFromObject(o, true);
    if (b.isEmpty()) continue;
    const s = b.getSize(new THREE.Vector3());
    // A node holding several wheels spans most of the car: skip it.
    if (s.x > dims.x * 0.6 || s.z > dims.z * 0.45 || s.y > dims.y * 0.7) continue;
    const m = b.getCenter(new THREE.Vector3());
    const key = `${m.x > 0 ? 'L' : 'R'}${m.z > 0 ? 'F' : 'B'}`; // +x is the car's left when it faces +z
    const e = corners.get(key) || { box: new THREE.Box3(), nodes: [] };
    e.box.union(b); e.nodes.push(o);
    corners.set(key, e);
  }
  const wheels = [];
  if (corners.size === 4) {
    for (const [key, e] of corners) {
      const centre = e.box.getCenter(new THREE.Vector3());
      const s = e.box.getSize(new THREE.Vector3());
      const radius = Math.max(s.y, s.z) / 2;
      const pivot = new THREE.Group();
      pivot.name = `wheel ${key}`;
      pivot.position.copy(centre);
      root.add(pivot);
      pivot.updateMatrixWorld(true);
      for (const n of e.nodes) pivot.attach(n);
      wheels.push({ key, centre, radius, front: key[1] === 'F', left: key[0] === 'L', pivotName: pivot.name });
    }
  }
  // No textures: they carry real badges and number plates. Colours, gloss and glass stay.
  // The paint is the biggest-area material that is not glass, trim, rubber or lights.
  const area = new Map();
  const tri = new THREE.Triangle(), a = new THREE.Vector3(), b = new THREE.Vector3(), c3 = new THREE.Vector3();
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    if (HIDE.test(o.name) || [o.material].flat().some((m) => HIDE.test(m?.name || ''))) o.visible = false;
    o.material = [o.material].flat().map((m) => {
      const c = m.clone();
      // A dropped colour texture is replaced by its average colour (tyres stay dark, glass tinted).
      if (m.map && c.color) c.color.multiply(averageColour(m.map));
      if (m.emissiveMap && c.emissive) c.emissive.multiply(averageColour(m.emissiveMap));
      for (const k of ['map', 'emissiveMap', 'aoMap']) c[k] = null;
      return c;
    });
    if (o.material.length === 1) o.material = o.material[0];
    let wheel = false;
    for (let p = o; p; p = p.parent) if (/^wheel /.test(p.name)) wheel = true;
    const mat = [o.material].flat()[0];
    if (wheel || NOT_PAINT.test(mat.name) || NOT_PAINT.test(o.name) || mat.transparent) return;
    const g = o.geometry, pos = g.attributes.position, idx = g.index;
    let sum = 0;
    const n = idx ? idx.count : pos.count;
    for (let i = 0; i < n; i += 3 * Math.max(1, Math.floor(n / 6000))) {
      const i0 = idx ? idx.getX(i) : i, i1 = idx ? idx.getX(i + 1) : i + 1, i2 = idx ? idx.getX(i + 2) : i + 2;
      tri.set(a.fromBufferAttribute(pos, i0).applyMatrix4(o.matrixWorld), b.fromBufferAttribute(pos, i1).applyMatrix4(o.matrixWorld), c3.fromBufferAttribute(pos, i2).applyMatrix4(o.matrixWorld));
      sum += tri.getArea() * Math.max(1, Math.floor(n / 6000));
    }
    area.set(mat.name || mat.uuid, (area.get(mat.name || mat.uuid) || 0) + sum);
  });
  const paint = [...area.entries()].sort((x, y) => y[1] - x[1])[0]?.[0];
  // Without separable wheels: estimate where they are (the model's own wheels stay fixed).
  if (!wheels.length) {
    const r = 0.3, wb = spec.length * 0.31, tr = dims.x / 2 - 0.15;
    for (const [l, f] of [[1, 1], [0, 1], [1, 0], [0, 0]]) wheels.push({ key: `${l ? 'L' : 'R'}${f ? 'F' : 'B'}`, centre: new THREE.Vector3(l ? tr : -tr, r, f ? wb : -wb), radius: r, front: !!f, left: !!l, pivotName: null });
  }
  console.info(`car ${id}: ${found.length} wheel nodes, ${corners.size} corners, ${dims.x.toFixed(2)} × ${dims.y.toFixed(2)} × ${dims.z.toFixed(2)} m, paint "${paint}"`);
  return { id, spec, root, wheels, dims, paint };
}

const avgCache = new WeakMap();
/** Average colour of a texture (linear), from a tiny downscaled copy. */
function averageColour(tex) {
  if (avgCache.has(tex)) return avgCache.get(tex);
  const out = new THREE.Color(0.5, 0.5, 0.5);
  try {
    const img = tex.image, cv = document.createElement('canvas');
    cv.width = cv.height = 8;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, 8, 8);
    const d = g.getImageData(0, 0, 8, 8).data;
    let r = 0, gr = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 16) continue; r += d[i]; gr += d[i + 1]; b += d[i + 2]; n++; }
    if (n) out.setRGB(r / n / 255, gr / n / 255, b / n / 255, THREE.SRGBColorSpace);
  } catch { /* not drawable */ }
  avgCache.set(tex, out);
  return out;
}

function instantiate(proto, colour) {
  const root = proto.root.clone(true);
  // Own paint material per car, in a random Mumbai colour.
  const hex = colour ?? PAINTS[Math.floor(Math.random() * PAINTS.length)];
  let paintMat = null;
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.material = [o.material].flat().map((m) => {
      if ((m.name || m.uuid) !== proto.paint) return m;
      let inWheel = false;
      for (let p = o; p; p = p.parent) if (/^wheel /.test(p.name)) inWheel = true;
      if (inWheel) return m;
      paintMat ||= Object.assign(m.clone(), {});
      paintMat.color.setHex(hex);
      if ('clearcoat' in paintMat) { paintMat.clearcoat = 1; paintMat.clearcoatRoughness = 0.08; }
      paintMat.roughness = Math.min(paintMat.roughness ?? 0.4, 0.35);
      paintMat.metalness = Math.max(paintMat.metalness ?? 0, 0.3);
      return paintMat;
    });
    if (o.material.length === 1) o.material = o.material[0];
  });
  const wheels = proto.wheels.map((w) => ({ ...w, centre: w.centre.clone(), pivot: w.pivotName ? root.getObjectByName(w.pivotName) : null }));
  return { id: proto.id, spec: proto.spec, root, wheels, dims: proto.dims.clone() };
}
