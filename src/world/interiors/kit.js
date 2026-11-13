import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { POSE, FLAG, outfit } from '../../sim/people.js';

// Building kit for hand-made rooms. A room is described in its own coordinates (metres,
// floor at y = 0, the street door in the wall z = 0, the room running towards +z) with a
// few shape helpers; everything that shares a material is merged into one mesh, so a whole
// interior costs a few dozen draw calls. Most surfaces take a colour per shape (vertex
// colours), so one "flat" material paints all the furniture.

const C = new THREE.Color();
const FONT = '"Baloo 2", "Noto Sans Devanagari", "Mukta", sans-serif';
export const font = (px, weight = 700, family = FONT) => `${weight} ${px}px ${family}`;

/** Colour as linear RGB: a hex number, or [hex, brightness] for lamps brighter than white. */
function rgb(color) {
  if (Array.isArray(color)) { C.set(color[0]).multiplyScalar(color[1]); return C; }
  return C.set(color ?? 0xffffff);
}

/** UVs in metres from the vertex positions (projected along the face normal), so tiling textures keep their real size. */
function boxUV(g) {
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (ay >= ax && ay >= az) { uv[i * 2] = x; uv[i * 2 + 1] = z; } else if (ax >= az) { uv[i * 2] = z; uv[i * 2 + 1] = y; } else { uv[i * 2] = x; uv[i * 2 + 1] = y; }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

/** Turn a shape inside out (to look at a dome or a vault from within). */
export function flip(g) {
  g = g.index ? g.toNonIndexed() : g;
  for (const name of Object.keys(g.attributes)) {
    const a = g.attributes[name], s = a.itemSize, arr = a.array;
    for (let i = 0; i < a.count; i += 3) for (let k = 0; k < s; k++) { const t = arr[(i + 1) * s + k]; arr[(i + 1) * s + k] = arr[(i + 2) * s + k]; arr[(i + 2) * s + k] = t; }
  }
  const n = g.attributes.normal.array;
  for (let i = 0; i < n.length; i++) n[i] = -n[i];
  return g;
}

/**
 * A point on an arch: t = 0 at the left springing, 1 at the right. Returns [x from -1 to 1,
 * height from 0 to 1]. 'pointed' is the Gothic arch (two arcs struck from the opposite
 * springings), 'round' a semicircle.
 */
function arc(t, kind) {
  if (kind === 'round') return [-Math.cos(t * Math.PI), Math.sin(t * Math.PI)];
  const side = t <= 0.5 ? -1 : 1, th = (1 - Math.abs(t - 0.5) * 2) * (Math.PI / 3);
  return [side * (2 * Math.cos(th) - 1), Math.sin(th) / Math.sin(Math.PI / 3)];
}

/** Outline of an arched opening (base at y0, arch from `spring` up to `peak`). */
function archPath(path, cx, y0, w, spring, peak, kind) {
  path.moveTo(cx - w / 2, y0);
  const N = 16;
  for (let i = 0; i <= N; i++) { const [x, r] = arc(i / N, kind); path.lineTo(cx + x * w / 2, y0 + spring + (peak - spring) * r); }
  path.lineTo(cx + w / 2, y0);
  path.lineTo(cx - w / 2, y0);
  return path;
}

/** All the geometry of one material. */
export class Geo {
  constructor() { this.list = []; }

  /** Any geometry already in place. `color` paints it (omit to keep its own vertex colours). */
  add(g, color, keepUV = false) {
    g = g.index ? g.toNonIndexed() : g;
    const n = g.attributes.position.count;
    if (color !== undefined || !g.attributes.color) {
      const c = rgb(color), col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    }
    if (!keepUV || !g.attributes.uv) boxUV(g);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    this.list.push(g);
    return this;
  }

  /** Box standing on y, centred on (x, z), optionally turned about the vertical. */
  box(x, y, z, w, h, d, color, ry = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (ry) g.rotateY(ry);
    return this.add(g.translate(x, y + h / 2, z), color);
  }

  /** Box between two corners. */
  span(x0, y0, z0, x1, y1, z1, color) {
    return this.add(new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), color);
  }

  /** Upright cylinder (or cone/taper with `top`), base at y. */
  cyl(x, y, z, r, h, color, seg = 12, top = r) {
    const g = new THREE.CylinderGeometry(top, r, h, seg).translate(x, y + h / 2, z);
    // Wrap textures around the shaft.
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, uv.getX(i) * Math.PI * 2 * r, p.getY(i));
    return this.add(g, color, true);
  }

  ball(x, y, z, r, color, sy = 1, seg = 10) {
    return this.add(new THREE.SphereGeometry(r, seg, Math.max(4, Math.round(seg * 0.6))).scale(1, sy, 1).translate(x, y, z), color);
  }

  /** Upright rectangle centred on (x, y, z), facing +z before turning by ry. `uv` = [u0, v0, u1, v1] for atlas pictures. */
  quad(x, y, z, w, h, ry = 0, color, uv) {
    const g = new THREE.PlaneGeometry(w, h);
    if (uv) { const a = g.attributes.uv; for (let i = 0; i < a.count; i++) a.setXY(i, uv[0] + a.getX(i) * (uv[2] - uv[0]), uv[1] + a.getY(i) * (uv[3] - uv[1])); }
    if (ry) g.rotateY(ry);
    return this.add(g.translate(x, y, z), color, !!uv);
  }

  /** Flat rectangle facing up (a floor, a table top, a rug). */
  floor(x0, z0, x1, z1, y, color, uv) {
    // Cut into cells of 4 m or less: one huge quad reaching behind the camera can lose depth precision.
    const g = new THREE.PlaneGeometry(Math.abs(x1 - x0), Math.abs(z1 - z0), Math.ceil(Math.abs(x1 - x0) / 4), Math.ceil(Math.abs(z1 - z0) / 4));
    if (uv) { const a = g.attributes.uv; for (let i = 0; i < a.count; i++) a.setXY(i, uv[0] + a.getX(i) * (uv[2] - uv[0]), uv[1] + a.getY(i) * (uv[3] - uv[1])); }
    return this.add(g.rotateX(-Math.PI / 2).translate((x0 + x1) / 2, y, (z0 + z1) / 2), color, !!uv);
  }

  /** Flat rectangle facing down (a ceiling). */
  ceiling(x0, z0, x1, z1, y, color) {
    return this.add(new THREE.PlaneGeometry(Math.abs(x1 - x0), Math.abs(z1 - z0), Math.ceil(Math.abs(x1 - x0) / 4), Math.ceil(Math.abs(z1 - z0) / 4)).rotateX(Math.PI / 2).translate((x0 + x1) / 2, y, (z0 + z1) / 2), color);
  }

  /**
   * Straight wall from (ax, az) to (bx, bz), `t` thick, with rectangular openings
   * [from, to, bottom, top] measured along the wall from a.
   */
  wall(ax, az, bx, bz, y0, y1, t, holes = [], color) {
    const len = Math.hypot(bx - ax, bz - az), ry = -Math.atan2(bz - az, bx - ax);
    const piece = (u0, u1, v0, v1) => {
      if (u1 - u0 < 0.01 || v1 - v0 < 0.01) return;
      const g = new THREE.BoxGeometry(u1 - u0, v1 - v0, t).translate((u0 + u1) / 2, (v0 + v1) / 2, 0).rotateY(ry).translate(ax, 0, az);
      this.add(g, color);
    };
    let u = 0;
    for (const [h0, h1, b, tp] of [...holes].sort((p, q) => p[0] - q[0])) {
      piece(u, h0, y0, y1); piece(h0, h1, y0, b); piece(h0, h1, tp, y1);
      u = h1;
    }
    piece(u, len, y0, y1);
    return this;
  }

  /**
   * Wall with arched openings: arches = [[centre along the wall, width, springing height, peak height, sill = 0]].
   * kind: 'pointed' or 'round'.
   */
  arches(ax, az, bx, bz, y0, y1, t, arches, color, kind = 'pointed') {
    const len = Math.hypot(bx - ax, bz - az), ry = -Math.atan2(bz - az, bx - ax);
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.lineTo(len, 0); s.lineTo(len, y1 - y0); s.lineTo(0, y1 - y0); s.lineTo(0, 0);
    for (const [cx, w, spring, peak, sill = 0] of arches) s.holes.push(archPath(new THREE.Path(), cx, sill, w, spring - sill, peak - sill, kind));
    const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: 4 }).translate(0, y0, -t / 2).rotateY(ry).translate(ax, 0, az);
    return this.add(g, color);
  }

  /** The inside of an arched vault running along z: pointed (Gothic) or round barrel. */
  vault(x0, x1, z0, z1, spring, peak, color, kind = 'pointed', seg = 14) {
    const pts = [];
    for (let i = 0; i <= seg; i++) { const [x, r] = arc(i / seg, kind); pts.push([(x0 + x1) / 2 + x * (x1 - x0) / 2, spring + (peak - spring) * r]); }
    const pos = [], nor = [], uv = [];
    let run = 0;
    for (let i = 0; i < seg; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1], l = Math.hypot(bx - ax, by - ay);
      const nx = (by - ay) / l, ny = -(bx - ax) / l; // pointing down into the room
      const v = [[ax, ay, z0, run, z0], [bx, by, z0, run + l, z0], [bx, by, z1, run + l, z1], [ax, ay, z1, run, z1]];
      for (const k of [0, 1, 2, 0, 2, 3]) { pos.push(v[k][0], v[k][1], v[k][2]); nor.push(nx, ny, 0); uv.push(v[k][3], v[k][4]); }
      run += l;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    return this.add(g, color, true);
  }

  /** A rib following the same curve as vault(), at one z (a stone arch across the room). */
  rib(x0, x1, z, spring, peak, w, d, color, kind = 'pointed', seg = 12) {
    let prev = null;
    for (let i = 0; i <= seg; i++) {
      const [x, r] = arc(i / seg, kind);
      const p = [(x0 + x1) / 2 + x * (x1 - x0) / 2, spring + (peak - spring) * r];
      if (prev) {
        const l = Math.hypot(p[0] - prev[0], p[1] - prev[1]) + 0.02, ang = Math.atan2(p[1] - prev[1], p[0] - prev[0]);
        this.add(new THREE.BoxGeometry(l, d, w).rotateZ(ang).translate((p[0] + prev[0]) / 2, (p[1] + prev[1]) / 2 - d * 0.35, z), color);
      }
      prev = p;
    }
    return this;
  }

  /** Everything added so far as one geometry (for instanced furniture). */
  merge() { return mergeGeometries(this.list); }
}

const MALE_MODELS = ['casual', 'casual2', 'worker', 'casual3', 'bald', 'oldclassy', 'suit', 'chef', 'doctor'];
const FEMALE_MODELS = ['casual', 'casual2', 'casual3', 'worker', 'oldclassy', 'suit', 'doctor'];

/** A canvas drawn once (or redrawn later through `texture.needsUpdate = true`). */
export function canvasTexture(w, h, draw, { repeat, aniso = 4, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  return t;
}

/** Many small pictures (signs, paintings, menus) packed into one texture = one draw call. */
export class Atlas {
  constructor(size = 2048, height = size) {
    this.w = size; this.h = height;
    this.canvas = document.createElement('canvas');
    this.canvas.width = size; this.canvas.height = height;
    this.g = this.canvas.getContext('2d');
    this.x = 0; this.y = 0; this.row = 0;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
  }

  /** Draw a w × h pixel picture; returns its UV rectangle [u0, v0, u1, v1]. */
  draw(w, h, paint) {
    if (this.x + w > this.w) { this.x = 0; this.y += this.row + 2; this.row = 0; }
    if (this.y + h > this.h) { console.warn('Interior sign atlas is full'); return [0, 0, 0.01, 0.01]; }
    const x = this.x, y = this.y, g = this.g;
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.translate(x, y);
    paint(g, w, h);
    g.restore();
    this.x += w + 2; this.row = Math.max(this.row, h);
    this.texture.needsUpdate = true;
    const uv = [x / this.w, 1 - (y + h) / this.h, (x + w) / this.w, 1 - y / this.h];
    uv.px = [x, y, w, h];
    return uv;
  }

  /** Paint a picture again (a departure board that changes). `uv` is what draw() returned. */
  repaint(uv, paint) {
    const [x, y, w, h] = uv.px, g = this.g;
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.translate(x, y);
    g.clearRect(0, 0, w, h);
    paint(g, w, h);
    g.restore();
    this.texture.needsUpdate = true;
  }
}

/** A person standing, sitting or walking in a room (the same objects street people use). */
export function person(kind, x, z, heading = 0, pose = POSE.STAND, extra = {}) {
  const o = outfit(kind === 'sari' ? 'sari' : kind === 'kid' ? 'kid' : kind === 'office' ? 'office' : kind === 'worker' ? 'worker' : 'casual');
  return {
    ...o, kind, x, z, y: 0, heading, pose, phase: Math.random() * 6, amp: 1, speed: 0,
    flags: kind === 'sari' ? FLAG.SARI : 0, scale: kind === 'kid' ? 0.7 : 0.94 + Math.random() * 0.1, h: kind === 'kid' ? 1.5 : 2.1,
    ...extra,
  };
}
export const hex = (h) => new THREE.Color(h);

/**
 * One room being built. `to(material)` gives the Geo of a material; `finish()` turns the
 * lot into meshes. Also collects what the interior system needs: where one can walk,
 * what is solid, things to use (E), people, lamps.
 */
export class Kit {
  constructor(lib, tier) {
    this.lib = lib; this.tier = tier;
    this.geos = new Map();
    this.mats = new Map();
    this.meshes = [];      // extra meshes (instanced furniture, moving parts)
    this.rooms = [];       // [x0, z0, x1, z1, ceiling]: the air one can be in (overlap them at doorways)
    this.solids = [];      // [x0, z0, x1, z1, tall]: furniture and pits; tall ones also stop the camera
    this.posts = [];       // [x, z, r, tall]: round obstacles
    this.ramps = [];       // [x0, z0, x1, z1, yA, yB, axis]: stairs; height runs from yA to yB along 'x' or 'z'
    this.spots = [];       // things to use: { x, z, r, prompt, act }
    this.people = [];
    this.lamps = [];       // [x, y, z, colour, intensity, distance]
    this.daylit = [];      // window materials that follow the daylight: { mat, night, day }
    this.ticks = [];       // per-frame updates: (dt, ctx) => {}
    this.standard();
  }

  mat(name, material) { this.mats.set(name, material); return material; }

  /** Photo-scanned material from the texture library; a flat colour until it has loaded. */
  scanned(name, id, size, flat, o = {}) {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, color: flat, ...o });
    this.lib?.apply(m, id, { size, onLoad: (x) => x.color.set(o.loaded ?? 0xffffff) });
    return this.mat(name, m);
  }

  /** A canvas-painted surface that repeats every `metres`. */
  painted(name, metres, px, draw, o = {}) {
    const map = canvasTexture(px, px, draw, { repeat: 1 / metres, aniso: this.tier?.anisotropy ?? 4 });
    return this.mat(name, new THREE.MeshStandardMaterial({ vertexColors: true, map, roughness: 0.6, ...o }));
  }

  standard() {
    const std = (o) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, ...o });
    this.mat('flat', std({}));                                   // painted things, cloth, anything matt
    this.mat('satin', std({ roughness: 0.42 }));                 // polished wood, enamel paint
    this.mat('gloss', std({ roughness: 0.14 }));                 // glazed tiles, lacquer, screens that are off
    this.mat('brass', std({ metalness: 1, roughness: 0.34 }));
    this.mat('steel', std({ metalness: 0.9, roughness: 0.38 }));
    this.mat('mirror', std({ metalness: 1, roughness: 0.13 }));  // a little dull, so lamps don't flare in it
    this.mat('glow', new THREE.MeshBasicMaterial({ vertexColors: true, fog: false })); // lamps, lit glass
    this.mat('glass', std({ transparent: true, opacity: 0.2, roughness: 0.16, depthWrite: false }));
    this.scanned('wood', 'tex-ph-brown-planks-03', 1.4, 0x7a5a3c);
    this.scanned('plaster', 'tex-ph-painted-plaster-wall', 2.6, 0xd9d2c2);   // old, weathered paint
    this.scanned('paint', 'tex-ph-beige-wall-001', 3, 0xe9e2d2, { loaded: 0xffffff }); // clean painted wall
    this.scanned('stone', 'tex-ph-sandstone-blocks-08', 2.4, 0xcdb083);
  }

  to(name) {
    if (!this.mats.has(name)) throw new Error(`Interior material "${name}" is not defined`);
    if (!this.geos.has(name)) this.geos.set(name, new Geo());
    return this.geos.get(name);
  }

  /** A sign/picture atlas material: lit by the room (`glow` = false) or shining by itself. */
  atlas(name, size = 1024, height = size, glow = false) {
    const a = new Atlas(size, height);
    this.mat(name, glow ? new THREE.MeshBasicMaterial({ map: a.texture, vertexColors: true, fog: false }) : new THREE.MeshStandardMaterial({ map: a.texture, vertexColors: true, roughness: 0.7 }));
    return a;
  }

  /** Repeated furniture: one geometry drawn many times. items = [[x, y, z, ry, scale]]. */
  instances(geo, material, items, { cast = true } = {}) {
    const mesh = new THREE.InstancedMesh(geo, typeof material === 'string' ? this.mats.get(material) : material, items.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
    items.forEach(([x, y, z, ry = 0, sc = 1], i) => {
      m.compose(p.set(x, y, z), q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, ry), s.set(sc, sc, sc));
      mesh.setMatrixAt(i, m);
    });
    mesh.castShadow = cast; mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    this.meshes.push(mesh);
    return mesh;
  }

  /** A warm lamp: a real light (a few per room) at (x, y, z). */
  lamp(x, y, z, color = 0xffd9a8, intensity = 30, distance = 16) { this.lamps.push([x, y, z, color, intensity, distance]); }

  /** A thing to use with E. `prompt` is a string or a function returning one. */
  spot(x, z, r, prompt, act) { this.spots.push({ x, z, r, prompt, act }); }

  /**
   * Which rigged character a person gets (see MODELS in sim/characters.js: Low loads the
   * first two of each list, Medium four, High all). `p.wear` names the ones that suit
   * them, best first; nobody indoors gets the hard-hat worker by chance.
   */
  model(p) {
    const female = (p.flags & FLAG.SARI) || p.kind === 'sari';
    const names = female ? FEMALE_MODELS : MALE_MODELS;
    const n = Math.min(names.length, this.tier?.name === 'High' ? 9 : this.tier?.name === 'Medium' ? 4 : 2);
    for (const w of p.wear || []) { const i = names.indexOf(w); if (i >= 0 && i < n) return i; }
    const plain = names.map((name, i) => i).filter((i) => i < n && names[i] !== 'worker' && names[i] !== 'chef' && names[i] !== 'doctor');
    return plain[Math.floor(Math.random() * plain.length)];
  }

  /** Add a person; standing people are solid. */
  add(p, solid = p.pose !== POSE.WALK && p.pose !== POSE.SIT) {
    p.model ??= this.model(p);
    this.people.push(p);
    if (solid) this.posts.push([p.x, p.z, 0.26, false]);
    return p;
  }

  /**
   * Floor, ceiling and four walls of a rectangular room, and the air inside it (`rooms`).
   * `gaps` = { s, n, w, e }: openings [[from, to, bottom, top]] in the wall on the street
   * side (s, z = z0), the far side (n), low x (w) or high x (e), measured from the wall's
   * low end. Materials: `floor`, `wall`, `ceil` (pass null to leave a surface out).
   */
  room(x0, z0, x1, z1, h, { floor = 'floor', wall = 'plaster', ceil = 'plaster', tint = 0xffffff, ceilTint = 0xf4f1ea, floorTint, gaps = {}, t = 0.3 } = {}) {
    if (floor) this.to(floor).floor(x0, z0, x1, z1, 0, floorTint);
    if (ceil) this.to(ceil).ceiling(x0, z0, x1, z1, h, ceilTint);
    if (wall) {
      const g = this.to(wall), add = (list, by) => (list || []).map(([a, b, c, d]) => [a + by, b + by, c, d]);
      if (gaps.s !== null) g.wall(x0 - t, z0 - t / 2, x1 + t, z0 - t / 2, 0, h, t, add(gaps.s, t), tint);
      if (gaps.n !== null) g.wall(x0 - t, z1 + t / 2, x1 + t, z1 + t / 2, 0, h, t, add(gaps.n, t), tint);
      if (gaps.w !== null) g.wall(x0 - t / 2, z0, x0 - t / 2, z1, 0, h, t, gaps.w, tint);
      if (gaps.e !== null) g.wall(x1 + t / 2, z0, x1 + t / 2, z1, 0, h, t, gaps.e, tint);
    }
    this.rooms.push([x0, z0, x1, z1, h]);
  }

  /** Window glass that glows with the daylight outside (dark at night). Tint per pane with the shape colour. */
  day() {
    if (!this.mats.has('day')) {
      const m = this.mat('day', new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
      this.daylit.push({ set: (d) => m.color.setScalar(0.05 + 1.5 * d) });
    }
    return this.to('day');
  }

  /**
   * A painted view outside the windows: `geo` (with UVs) shows the `day` picture, dimmed to
   * a dark blue at night, and, on a copy just in front, the `night` picture of lights
   * (drawn on black) that comes up after dark.
   */
  view(name, geo, [pw, ph], day, night) {
    const m = this.mat(`view-${name}`, new THREE.MeshBasicMaterial({ map: canvasTexture(pw, ph, day), fog: false, vertexColors: true }));
    this.to(`view-${name}`).add(geo, 0xffffff, true);
    this.daylit.push({ set: (d) => m.color.setRGB(0.04 + 0.96 * d, 0.06 + 0.94 * d, 0.12 + 0.88 * d) });
    if (!night) return;
    const l = this.mat(`viewlights-${name}`, new THREE.MeshBasicMaterial({ map: canvasTexture(pw, ph, night), fog: false, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.to(`viewlights-${name}`).add(geo.clone().scale(0.995, 1, 0.995), 0xffffff, true);
    this.daylit.push({ set: (d) => l.color.setScalar((1 - d) * 1.5) });
  }

  /**
   * The way back to the street: a glazed double door in the wall z = `z` (the room is on
   * its +z side), centred on x, with daylight behind the glass. Sets the E spot.
   */
  exitDoor(x, z, { w = 1.8, h = 2.4, frame = 0x4a2c1a, leaf = 0x5b3a22, label = 'E: go outside' } = {}) {
    const f = this.to('satin');
    f.box(x - w / 2 - 0.06, 0, z - 0.1, 0.12, h + 0.12, 0.34, frame); f.box(x + w / 2 + 0.06, 0, z - 0.1, 0.12, h + 0.12, 0.34, frame);
    f.box(x, h, z - 0.1, w + 0.24, 0.12, 0.34, frame);
    for (const s of [-1, 1]) {
      const cx = x + s * w / 4;
      // Each leaf: stiles and rails around two panes, a brass handle.
      f.box(cx - s * (w / 4 - 0.05), 0, z - 0.06, 0.1, h, 0.06, leaf); f.box(cx + s * (w / 4 - 0.05), 0, z - 0.06, 0.1, h, 0.06, leaf);
      for (const y of [0, 0.95, h - 0.12]) f.box(cx, y, z - 0.06, w / 2 - 0.02, y ? 0.12 : 0.3, 0.06, leaf);
      this.to('brass').box(x + s * 0.1, 1.0, z - 0.0, 0.03, 0.26, 0.05, 0xc9a24a);
    }
    this.day().quad(x, h / 2, z - 0.09, w, h, 0, 0xdfe6e2);
    this.to('flat').box(x, 0, z + 0.55, w * 0.8, 0.012, 0.7, 0x6a2a22); // doormat
    this.spot(x, z + 0.7, 1.5, label, (api) => api.leave());
    return { x, z: z + 1.3, heading: 0 };
  }

  /** Merge every material's geometry into meshes inside `group`. Returns draw-call and triangle counts. */
  finish(group, { noShadow = ['plaster', 'glow', 'glass'] } = {}) {
    let tris = 0;
    for (const [name, geo] of this.geos) {
      if (!geo.list.length) continue;
      const mesh = new THREE.Mesh(geo.merge(), this.mats.get(name));
      mesh.name = name;
      // Walls and ceilings never shade the room (the light comes "through" the roof); furniture does.
      mesh.castShadow = !noShadow.includes(name) && !/^(floor|ceil|wall|sign|screen|view)/.test(name);
      mesh.receiveShadow = true;
      group.add(mesh);
      tris += mesh.geometry.attributes.position.count / 3;
      geo.list.length = 0;
    }
    for (const m of this.meshes) { group.add(m); tris += (m.geometry.attributes.position.count / 3) * (m.count ?? 1); }
    return { calls: group.children.length, triangles: Math.round(tris) };
  }
}

/** Bentwood café chair (the sitter faces +z). About 270 triangles; use with Kit.instances(). */
export function bentwoodChair(wood = 0x3a2416, seat = 0x8a5a34) {
  const g = new Geo();
  const rod = (x, z, y0, y1, r = 0.014) => g.add(new THREE.CylinderGeometry(r, r, y1 - y0, 5, 1, true).translate(x, (y0 + y1) / 2, z), wood);
  g.add(new THREE.CylinderGeometry(0.2, 0.2, 0.035, 12).translate(0, 0.45, 0), seat);
  for (const [x, z] of [[-0.14, 0.14], [0.14, 0.14], [-0.15, -0.15], [0.15, -0.15]]) rod(x, z, 0, 0.44);
  for (const [r, y] of [[0.19, 0.68], [0.115, 0.6]]) {
    g.add(new THREE.TorusGeometry(r, 0.014, 4, 10, Math.PI).translate(0, y, -0.19), wood);
    rod(-r, -0.19, 0.44, y); rod(r, -0.19, 0.44, y);
  }
  return g.merge();
}

/** Small table on a pedestal: `top` colour, `w` wide; round or square. About 90 triangles. */
export function pedestalTable(w = 0.7, top = 0xf2efe8, base = 0x1c1c1e, round = false, h = 0.74) {
  const g = new Geo();
  if (round) g.add(new THREE.CylinderGeometry(w / 2, w / 2, 0.035, 18).translate(0, h, 0), top);
  else g.box(0, h - 0.018, 0, w, 0.035, w, top);
  g.add(new THREE.CylinderGeometry(0.035, 0.045, h - 0.04, 8, 1, true).translate(0, (h - 0.04) / 2 + 0.02, 0), base);
  g.add(new THREE.CylinderGeometry(0.1, 0.24, 0.05, 10).translate(0, 0.025, 0), base);
  return g.merge();
}

export { POSE, FLAG };
