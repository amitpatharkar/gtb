import * as THREE from 'three';
import { endKey, keyXZ } from './roadKeys.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { POINT } from '../world/tileFormat.js';

// Working traffic signals at the real OpenStreetMap signal junctions. Each junction cycles
// two groups of approaches (main axis, cross axis): green → amber → all red. Poles stand on
// the left kerb before the stop line, facing the drivers, with a red LED countdown.
// Traffic stops at red (a few jump it); the player's crossings are checked by the police.

const GREEN_A = 17, GREEN_B = 13, AMBER = 3, ALL_RED = 2;
export const LIGHT = { GREEN: 0, AMBER: 1, RED: 2 };

const key = endKey;
const hash = (x, z) => { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); };

function digitsTexture() {
  // 100 cells (00..99), white digits on black; tinted red or green per signal.
  const c = document.createElement('canvas');
  c.width = 640; c.height = 640;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 640, 640);
  g.font = 'bold 50px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < 100; i++) {
    const x = (i % 10) * 64, y = Math.floor(i / 10) * 64;
    g.fillStyle = '#fff';
    g.fillText(String(i).padStart(2, '0'), x + 32, y + 34);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Signals {
  constructor(scene, cap = 900) {
    this.sites = [];
    this.approaches = [];
    this.version = -1;
    this.time = 0;
    this.cap = cap;
    const grey = new THREE.MeshStandardMaterial({ color: 0x2b2d2f, roughness: 0.6, metalness: 0.4 });
    const pole = mergeGeometries([
      new THREE.CylinderGeometry(0.07, 0.09, 3.6, 8).translate(0, 1.8, 0),
      new THREE.BoxGeometry(0.34, 1.0, 0.26).translate(0, 3.95, 0),
      new THREE.BoxGeometry(0.42, 0.06, 0.2).translate(0, 4.48, 0.06),               // visor
      new THREE.BoxGeometry(0.52, 0.36, 0.08).translate(0, 3.0, 0.02),               // countdown box
      new THREE.BoxGeometry(0.62, 0.04, 0.4).rotateX(-0.5).translate(0, 4.75, -0.05), // small solar panel
    ]);
    this.poles = this.instanced(pole, grey, true);
    const lampG = new THREE.CircleGeometry(0.1, 12);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.lamps = [4.25, 3.95, 3.65].map((y) => this.instanced(lampG.clone().translate(0, y, 0.135), lampMat, false));
    const digitMat = new THREE.MeshBasicMaterial({ map: digitsTexture(), color: 0xffffff });
    digitMat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float digit;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\nvMapUv = (vec2(mod(digit, 10.0), 9.0 - floor(digit / 10.0)) + uv) / 10.0;');
    };
    digitMat.customProgramCacheKey = () => 'gtb-signal-digits';
    const digitG = new THREE.PlaneGeometry(0.44, 0.28).translate(0, 3.0, 0.065);
    this.digitAttr = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
    digitG.setAttribute('digit', this.digitAttr);
    this.digits = this.instanced(digitG, digitMat, false);
    scene.add(this.poles, ...this.lamps, this.digits);
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.c = new THREE.Color();
  }

  instanced(geo, mat, shadow) {
    const m = new THREE.InstancedMesh(geo, mat, this.cap);
    m.count = 0;
    m.castShadow = shadow;
    m.receiveShadow = shadow;
    m.frustumCulled = false;
    if (!shadow) m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.cap * 3).fill(1), 3);
    return m;
  }

  /** Build junction sites from the signal points of the loaded tiles and the traffic road graph. */
  rebuild(tiles, traffic) {
    this.version = traffic.graphVersion;
    const pts = [];
    for (const t of tiles.tiles.values()) {
      const arr = t.points[POINT.SIGNAL];
      if (arr) for (let i = 0; i < arr.length; i += 5) pts.push([arr[i] + t.origin[0], arr[i + 2] + t.origin[1]]);
    }
    // Cluster signal nodes within 30 m (OSM often tags each arm of a junction).
    const clusters = [];
    for (const p of pts) {
      const c = clusters.find((c) => (c.x - p[0]) ** 2 + (c.z - p[1]) ** 2 < 900);
      if (c) { c.pts.push(p); c.x = c.pts.reduce((s, q) => s + q[0], 0) / c.pts.length; c.z = c.pts.reduce((s, q) => s + q[1], 0) / c.pts.length; }
      else clusters.push({ x: p[0], z: p[1], pts: [p] });
    }
    // Graph nodes: junctions have 3+ segment ends; mid-block crossings have 2.
    const nodes = [];
    for (const [k, list] of traffic.ends) {
      const [kx, kz] = keyXZ(k);
      nodes.push({ k, x: kx, z: kz, list });
    }
    const grid = new Map();
    for (const n of nodes) { const g = `${Math.floor(n.x / 40)},${Math.floor(n.z / 40)}`; (grid.get(g) || grid.set(g, []).get(g)).push(n); }
    const near = (x, z, r) => {
      const out = [];
      for (let gx = Math.floor((x - r) / 40); gx <= Math.floor((x + r) / 40); gx++) for (let gz = Math.floor((z - r) / 40); gz <= Math.floor((z + r) / 40); gz++) {
        for (const n of grid.get(`${gx},${gz}`) || []) if ((n.x - x) ** 2 + (n.z - z) ** 2 < r * r) out.push(n);
      }
      return out;
    };
    const old = new Map(this.sites.map((s) => [s.id, s]));
    this.sites = [];
    this.approaches = [];
    for (const c of clusters) {
      let members = [];
      for (const p of c.pts) for (const n of near(p[0], p[1], 22)) if (n.list.length >= 3 && !members.includes(n)) members.push(n);
      if (!members.length) {
        const two = near(c.x, c.z, 8).filter((n) => n.list.length === 2).sort((a, b) => (a.x - c.x) ** 2 + (a.z - c.z) ** 2 - (b.x - c.x) ** 2 - (b.z - c.z) ** 2);
        if (two.length) members = [two[0]];
      }
      if (!members.length) continue;
      const keys = new Set(members.map((n) => n.k));
      const cx = members.reduce((s, n) => s + n.x, 0) / members.length, cz = members.reduce((s, n) => s + n.z, 0) / members.length;
      const id = key(cx, cz);
      const prev = old.get(id);
      const site = prev || { id, x: cx, z: cz, offset: hash(cx, cz) * (GREEN_A + GREEN_B + 2 * (AMBER + ALL_RED)), approaches: [], cop: null, main: false };
      site.approaches = [];
      for (const n of members) {
        const maxHw = Math.max(...n.list.map((o) => o.seg.s[4]));
        for (const { seg, end } of n.list) {
          const s = seg.s;
          const dir = end === 1 ? 1 : -1;            // travel direction that arrives at this node
          if (dir < 0 && (s[5] & 2)) continue;       // one-way leaving the junction
          const ox = end === 1 ? s[0] : s[2], oz = end === 1 ? s[1] : s[3];
          if (keys.has(key(ox, oz))) continue;       // link inside the junction
          const fl = Math.hypot(n.x - ox, n.z - oz) || 1;
          const fx = (n.x - ox) / fl, fz = (n.z - oz) / fl;
          const back = Math.max(4, maxHw + 2.2);
          const sx = n.x - fx * back, sz = n.z - fz * back;
          if (members.length > 1 && Math.hypot(sx - cx, sz - cz) < Math.hypot(n.x - cx, n.z - cz) - 2) continue; // points inwards: inner carriageway
          const hw = s[4];
          const lx = fz, lz = -fx;                   // left of travel
          const ap = { site, x: sx, z: sz, fx, fz, hw, main: !!(s[5] & 4), oneway: !!(s[5] & 2), poleX: sx + lx * (hw + 0.7), poleZ: sz + lz * (hw + 0.7) };
          site.approaches.push(ap);
          site.main ||= ap.main;
        }
      }
      if (!site.approaches.length) continue;
      // Two phase groups: approaches roughly parallel to the first main approach, and the rest.
      const ref = site.approaches.find((a) => a.main) || site.approaches[0];
      for (const a of site.approaches) a.group = Math.abs(a.fx * ref.fx + a.fz * ref.fz) > 0.6 ? 0 : 1;
      this.sites.push(site);
      this.approaches.push(...site.approaches);
    }
  }

  /** Light for a phase group at a site, and seconds left in that state. */
  stateOf(site, group) {
    const cycle = GREEN_A + GREEN_B + 2 * (AMBER + ALL_RED);
    const t = (this.time + site.offset) % cycle;
    const a0 = GREEN_A, a1 = a0 + AMBER, a2 = a1 + ALL_RED, b0 = a2 + GREEN_B, b1 = b0 + AMBER;
    if (group === 0) {
      if (t < a0) return [LIGHT.GREEN, a0 - t];
      if (t < a1) return [LIGHT.AMBER, a1 - t];
      return [LIGHT.RED, cycle - t];
    }
    if (t < a2) return [LIGHT.RED, a2 - t];
    if (t < b0) return [LIGHT.GREEN, b0 - t];
    if (t < b1) return [LIGHT.AMBER, b1 - t];
    return [LIGHT.RED, cycle - t + a0 + AMBER + ALL_RED];
  }

  /**
   * Nearest stop line ahead of a vehicle at (x, z) heading (fx, fz) within `range` metres:
   * { ap, dist, light, left } or null. `lane` is how far the lane can be from the stop point.
   */
  ahead(x, z, fx, fz, range = 45) {
    let best = null;
    for (const ap of this.approaches) {
      if (ap.fx * fx + ap.fz * fz < 0.8) continue;
      const dx = ap.x - x, dz = ap.z - z;
      const along = dx * ap.fx + dz * ap.fz;
      if (along < -12 || along > range) continue;
      const lateral = Math.abs(dx * ap.fz - dz * ap.fx);
      if (lateral > ap.hw + 1.5) continue;
      if (!best || along < best.dist) best = { ap, dist: along };
    }
    if (best) [best.light, best.left] = this.stateOf(best.ap.site, best.ap.group);
    return best;
  }

  update(dt, tiles, traffic, focus, night = 0) {
    this.time += dt;
    // Rebuild after the traffic graph changed — but not in the same frame as the traffic
    // rebuild itself, so two big jobs never land on one frame.
    if (this.version !== traffic.graphVersion) { if (this.waited) { this.waited = false; this.rebuild(tiles, traffic); } else this.waited = true; }
    // Draw poles near the focus (instanced; all lights in view range).
    let n = 0;
    const on = [new THREE.Color(5, 0.35, 0.2), new THREE.Color(4.5, 2.2, 0.1), new THREE.Color(0.2, 4, 1.4)];
    const off = [new THREE.Color(0.08, 0.01, 0.01), new THREE.Color(0.07, 0.04, 0.0), new THREE.Color(0.0, 0.06, 0.03)];
    const glow = 1 + night * 0.6;
    for (const ap of this.approaches) {
      if (n >= this.cap) break;
      if ((ap.poleX - focus.x) ** 2 + (ap.poleZ - focus.z) ** 2 > 360000) continue;
      this.q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, Math.atan2(-ap.fx, -ap.fz));
      this.m.compose(new THREE.Vector3(ap.poleX, 0.2, ap.poleZ), this.q, new THREE.Vector3(1, 1, 1));
      this.poles.setMatrixAt(n, this.m);
      this.digits.setMatrixAt(n, this.m);
      const [light, left] = this.stateOf(ap.site, ap.group);
      for (let k = 0; k < 3; k++) {
        this.lamps[k].setMatrixAt(n, this.m);
        const lit = (k === 0 && light === LIGHT.RED) || (k === 1 && light === LIGHT.AMBER) || (k === 2 && light === LIGHT.GREEN);
        this.lamps[k].setColorAt(n, lit ? this.c.copy(on[k]).multiplyScalar(glow) : off[k]);
      }
      this.digitAttr.array[n] = Math.min(99, Math.ceil(left));
      this.digits.setColorAt(n, light === LIGHT.GREEN ? this.c.setRGB(0.1, 2.2 * glow, 0.5) : this.c.setRGB(2.4 * glow, 0.12, 0.04));
      n++;
    }
    for (const m of [this.poles, this.digits, ...this.lamps]) {
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    this.digitAttr.needsUpdate = true;
  }
}
