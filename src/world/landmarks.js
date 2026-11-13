import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Y } from './levels.js';

// Hand-built landmarks, fitted to their OpenStreetMap footprints (placement comes from the
// converter: index.landmarks). Parody names; the hotel is deliberately NOT a copy of the
// trademarked Taj facade (green domes, different massing). Lit with warm floodlights at night.
//  - Gateway of Indiyaa: yellow basalt arch, side halls, four turrets, jali parapet, steps
//  - Royal Chaj Mahal Palace: grand courtyard hotel with arched windows, domes, turrets
//  - Chhatrapati Chai Terminus: Gothic station, ribbed central dome, gables, corner turrets
//  - Big Mumbai Council HQ: Gothic block with a tall central tower and onion dome
//  - Rajabhai Tick-Tock Tower: 85 m clock tower with a lantern and spire

/** Box-projected UVs in metres, so tiling textures keep their real size on any face. */
function worldUV(g) {
  g = g.index ? g.toNonIndexed() : g;
  g.computeVertexNormals();
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (ay >= ax && ay >= az) { uv[i * 2] = x; uv[i * 2 + 1] = z; } else if (ax >= az) { uv[i * 2] = z; uv[i * 2 + 1] = y; } else { uv[i * 2] = x; uv[i * 2 + 1] = y; }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}
const box = (w, h, d, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z);

/** Pointed (Indo-Saracenic / Gothic) arch outline as a closed path, base at y0. */
function archPath(path, cx, y0, w, springH, peakH) {
  const r = w * 0.62;
  path.moveTo(cx - w / 2, y0);
  path.lineTo(cx - w / 2, y0 + springH);
  // Two arcs meeting at the peak.
  const steps = 10;
  for (let i = 1; i <= steps; i++) { const t = i / steps; path.lineTo(cx - w / 2 + (w / 2) * Math.sin(t * Math.PI / 2) ** 0.8, y0 + springH + (peakH - springH) * Math.sin(t * Math.PI / 2)); }
  for (let i = steps - 1; i >= 0; i--) { const t = i / steps; path.lineTo(cx + w / 2 - (w / 2) * Math.sin(t * Math.PI / 2) ** 0.8, y0 + springH + (peakH - springH) * Math.sin(t * Math.PI / 2)); }
  path.lineTo(cx + w / 2, y0);
  path.lineTo(cx - w / 2, y0);
  void r;
  return path;
}

/** A wall block (u across, y up) with arches cut through it, extruded `depth` along v. */
function archedBlock(u0, u1, h, depth, arches) {
  const s = new THREE.Shape();
  s.moveTo(u0, 0); s.lineTo(u1, 0); s.lineTo(u1, h); s.lineTo(u0, h); s.lineTo(u0, 0);
  for (const [cx, w, spring, peak] of arches) s.holes.push(archPath(new THREE.Path(), cx, 0, w, spring, peak));
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 6 }).translate(0, 0, -depth / 2);
}

function dome(r, y, squash = 1, ribs = 0) {
  const g = new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, squash, 1).translate(0, y, 0);
  if (!ribs) return g;
  // Ribbed dome: push every other longitude band out a little.
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const a = Math.atan2(p.getZ(i), p.getX(i));
    const k = 1 + 0.035 * Math.cos(a * ribs);
    p.setXYZ(i, p.getX(i) * k, p.getY(i), p.getZ(i) * k);
  }
  return g;
}
function onion(r, y) {
  const pts = [];
  for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push(new THREE.Vector2(r * Math.sin(t * Math.PI) * (1 + 0.35 * Math.sin(t * Math.PI * 0.9)) * (1 - t * 0.6), y + t * r * 2.2)); }
  pts.push(new THREE.Vector2(0.001, y + r * 2.6));
  return new THREE.LatheGeometry(pts, 20);
}
function turret(r, h, x, z, capR = r * 1.15) {
  return [new THREE.CylinderGeometry(r, r * 1.05, h, 8).translate(x, h / 2, z), new THREE.CylinderGeometry(capR, capR, 0.4, 8).translate(x, h + 0.2, z)];
}
function finial(x, y, z, h = 1.6) { return new THREE.ConeGeometry(0.12, h, 6).translate(x, y + h / 2, z); }
function crenels(u0, u1, v, y, step = 1.6) {
  const out = [];
  for (let u = u0 + step / 2; u < u1; u += step) out.push(box(step * 0.55, 0.9, 0.5, u, y, v));
  return out;
}

/** Facade texture: rows of pointed-arch windows with trim, on a wall colour. */
function arcadeTexture(wall, trim, glass = '#2b3440', bands = '#8a6d4c') {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = wall; g.fillRect(0, 0, 256, 256);
  g.fillStyle = bands; g.fillRect(0, 236, 256, 20);
  const win = (x, y, w, h) => {
    g.fillStyle = trim; g.beginPath(); g.moveTo(x - 8, y + h + 6); g.lineTo(x - 8, y + h * 0.35); g.quadraticCurveTo(x - 8, y - 14, x + w / 2, y - 18); g.quadraticCurveTo(x + w + 8, y - 14, x + w + 8, y + h * 0.35); g.lineTo(x + w + 8, y + h + 6); g.fill();
    g.fillStyle = glass; g.beginPath(); g.moveTo(x, y + h); g.lineTo(x, y + h * 0.35); g.quadraticCurveTo(x, y - 6, x + w / 2, y - 10); g.quadraticCurveTo(x + w, y - 6, x + w, y + h * 0.35); g.lineTo(x + w, y + h); g.fill();
    g.fillStyle = trim; g.fillRect(x + w / 2 - 2, y - 6, 4, h + 6); g.fillRect(x - 12, y + h + 4, w + 24, 8);
  };
  win(84, 70, 88, 150);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/** Jali (pierced stone screen) alpha texture. */
function jaliTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 64);
  g.globalCompositeOperation = 'destination-out';
  for (let y = 4; y < 64; y += 16) for (let x = 4; x < 64; x += 16) { g.beginPath(); g.moveTo(x + 4, y); g.lineTo(x + 8, y + 4); g.lineTo(x + 4, y + 8); g.lineTo(x, y + 4); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export class Landmarks {
  constructor(scene, list, lib) {
    this.group = new THREE.Group();
    this.lit = [];
    scene.add(this.group);
    const stoneMat = (hex, id = 'tex-ph-sandstone-blocks-08', size = 3) => {
      const m = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.85, emissive: 0xffb466, emissiveIntensity: 0 });
      lib?.apply(m, id, { size, onLoad: (x) => x.color.set(hex) });
      this.lit.push(m);
      return m;
    };
    this.mats = {
      basalt: stoneMat(0xd8b37c),
      trim: stoneMat(0xe8d2a6, 'tex-ph-sandstone-blocks-08', 1.5),
      buff: stoneMat(0xcdb083),
      grey: stoneMat(0x8a857c, 'tex-ph-stone-block-wall', 2.4),
      copper: new THREE.MeshStandardMaterial({ color: 0x4f8a7a, roughness: 0.45, metalness: 0.5 }),
      ribbed: new THREE.MeshStandardMaterial({ color: 0x5e6e66, roughness: 0.5, metalness: 0.3 }),
      gold: new THREE.MeshStandardMaterial({ color: 0xc9a043, roughness: 0.3, metalness: 0.9 }),
      roofRed: new THREE.MeshStandardMaterial({ color: 0x7b3a2a, roughness: 0.8 }),
      jali: new THREE.MeshStandardMaterial({ color: 0xe8d2a6, alphaMap: jaliTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 }),
      clock: new THREE.MeshStandardMaterial({ color: 0xf2efe6, emissive: 0xfff1c8, emissiveIntensity: 0, roughness: 0.4 }),
      hands: new THREE.MeshStandardMaterial({ color: 0x111111 }),
    };
    const arcade = (wall, trim) => {
      const tex = arcadeTexture(wall, trim);
      tex.repeat.set(1 / 4.2, 1 / 4.2);
      const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, emissive: 0xffc27a, emissiveIntensity: 0 });
      this.lit.push(m);
      return m;
    };
    this.mats.hotelWall = arcade('#d9c7a2', '#f3ead6');
    this.mats.stationWall = arcade('#cdb083', '#ead9b5');
    this.mats.bmcWall = arcade('#cbb08a', '#e4d4b2');
    this.byId = new Map(list.map((l) => [l.id, l]));
    for (const L of list) {
      const build = { gateway: this.gateway, palace: this.palace, terminus: this.terminus, bmc: this.bmc, clocktower: this.clocktower }[L.id];
      if (!build) continue;
      const g = new THREE.Group();
      build.call(this, g, L);
      g.position.set(L.x, Y.KERB, L.z);
      g.rotation.y = -L.angle;
      g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      this.group.add(g);
    }
  }

  add(group, geos, mat) {
    const g = mergeGeometries(geos.map((x) => worldUV(x)));
    const m = new THREE.Mesh(g, mat);
    group.add(m);
    return m;
  }

  // ------------------------------------------------------------------ Gateway
  gateway(g, L) {
    const W = Math.max(30, L.w), D = Math.max(14, L.d);
    const half = W / 2, cw = Math.min(17, W * 0.38);
    const M = this.mats;
    this.add(g, [box(W + 2, 1.2, D + 2, 0, 0, 0), box(W + 6, 0.4, D + 6, 0, -0.4, 0)], M.trim); // plinth
    // Central arch block and side halls with arches running right through.
    const central = archedBlock(-cw / 2, cw / 2, 19, D, [[0, cw * 0.55, 9.5, 15.5]]).translate(0, 1.2, 0);
    const side = (u0, u1) => archedBlock(u0, u1, 13.5, D * 0.8, [[(u0 + u1) / 2 - (u1 - u0) * 0.22, (u1 - u0) * 0.28, 5.5, 8.5], [(u0 + u1) / 2 + (u1 - u0) * 0.22, (u1 - u0) * 0.28, 5.5, 8.5]]).translate(0, 1.2, 0);
    this.add(g, [central, side(-half, -cw / 2), side(cw / 2, half)], M.basalt);
    // Bands, cornices and the attic storey with jali screens.
    const bands = [box(cw + 0.8, 0.5, D + 0.8, 0, 10.6, 0), box(cw + 1.2, 0.8, D + 1.2, 0, 19.6, 0), box(W - cw + 0.6, 0.4, D * 0.8 + 0.6, 0, 7, 0).translate(0, 0, 0),
      box(half - cw / 2 + 0.6, 0.7, D * 0.8 + 0.8, -(half + cw / 2) / 2, 14.2, 0), box(half - cw / 2 + 0.6, 0.7, D * 0.8 + 0.8, (half + cw / 2) / 2, 14.2, 0)];
    this.add(g, bands, M.trim);
    this.add(g, [box(cw - 1, 3.2, D - 1, 0, 20.4, 0), ...crenels(-cw / 2, cw / 2, D / 2 - 0.3, 23.6), ...crenels(-cw / 2, cw / 2, -D / 2 + 0.3, 23.6),
      ...crenels(-half, -cw / 2, D * 0.4 - 0.3, 14.9), ...crenels(cw / 2, half, D * 0.4 - 0.3, 14.9), ...crenels(-half, -cw / 2, -D * 0.4 + 0.3, 14.9), ...crenels(cw / 2, half, -D * 0.4 + 0.3, 14.9)], M.basalt);
    const jali = new THREE.Mesh(mergeGeometries([new THREE.PlaneGeometry(cw - 2, 2.2).translate(0, 22, D / 2 - 0.45), new THREE.PlaneGeometry(cw - 2, 2.2).translate(0, 22, -D / 2 + 0.45)]), M.jali);
    jali.material.alphaMap.repeat.set((cw - 2) / 0.8, 2.2 / 0.8);
    g.add(jali);
    // Four turrets on the central block, small domes and finials; a low central dome.
    const tur = [];
    const domes = [];
    for (const [x, z] of [[-cw / 2, D / 2], [cw / 2, D / 2], [-cw / 2, -D / 2], [cw / 2, -D / 2]]) {
      tur.push(...turret(1.5, 24, x, z));
      domes.push(dome(1.7, 24.4, 1.25, 8).translate(x, 0, z), finial(x, 26.4, z));
    }
    for (const [x, z] of [[-half, D * 0.4], [half, D * 0.4], [-half, -D * 0.4], [half, -D * 0.4]]) { tur.push(...turret(1, 16.5, x, z)); domes.push(dome(1.15, 16.9, 1.2, 8).translate(x, 0, z), finial(x, 18.2, z, 1)); }
    this.add(g, tur, M.basalt);
    this.add(g, [...domes, dome(5.5, 23.6, 0.55, 16)], M.trim);
    // Steps down to the water on one long side.
    this.add(g, [0, 1, 2, 3].map((k) => box(cw + 4, 0.3, 1.2, 0, -0.3 - k * 0.3, D / 2 + 1.6 + k * 1.2)), M.trim);
  }

  // ------------------------------------------------------------------ grand domed hotel (generic, not a facade copy)
  palace(g, L) {
    const W = L.w, D = L.d, wing = Math.min(20, D * 0.3), H = 27;
    const M = this.mats;
    // Courtyard block: four wings.
    this.add(g, [box(W, H, wing, 0, 0, D / 2 - wing / 2), box(W, H, wing, 0, 0, -D / 2 + wing / 2), box(wing, H, D - wing * 2, -W / 2 + wing / 2, 0, 0), box(wing, H, D - wing * 2, W / 2 - wing / 2, 0, 0)], M.hotelWall);
    // Cornices and a roof parapet.
    const ring = (y, h, out) => [box(W + out, h, out, 0, y, D / 2), box(W + out, h, out, 0, y, -D / 2), box(out, h, D + out, -W / 2, y, 0), box(out, h, D + out, W / 2, y, 0)];
    this.add(g, [...ring(H, 1.2, 1.2), ...ring(4.6, 0.5, 0.8), ...ring(H - 4.2, 0.4, 0.8)], M.trim);
    // Front (the wing facing the harbour/Gateway): central pavilion with a big copper dome.
    const gw = this.byId.get('gateway');
    let side = 1;
    if (gw) { const dx = gw.x - L.x, dz = gw.z - L.z, c = Math.cos(L.angle), s = Math.sin(L.angle); side = (-dx * s + dz * c) >= 0 ? 1 : -1; }
    const fz = side * (D / 2 - wing / 2);
    this.add(g, [box(30, H + 6, wing + 4, 0, 0, fz + side * 2), new THREE.CylinderGeometry(9.5, 10, 6, 16).translate(0, H + 9, fz)], M.hotelWall);
    this.add(g, [dome(9.5, H + 12, 1.15, 16).translate(0, 0, fz), new THREE.CylinderGeometry(1.2, 1.4, 2.5, 8).translate(0, H + 24, fz)], M.copper);
    this.add(g, [finial(0, H + 25, fz, 3)], M.gold);
    // Corner turrets with smaller domes, and a row of chhatris along the front.
    const tur = [], dm = [];
    for (const [x, z] of [[-W / 2, D / 2], [W / 2, D / 2], [-W / 2, -D / 2], [W / 2, -D / 2]]) { tur.push(...turret(4, H + 6, x, z)); dm.push(dome(4.4, H + 6.4, 1.2, 12).translate(x, 0, z)); }
    for (let k = -2; k <= 2; k++) { if (!k) continue; const x = k * (W / 6); tur.push(new THREE.CylinderGeometry(1.8, 1.8, 3, 8).translate(x, H + 1.5, fz)); dm.push(dome(2, H + 3, 1.2, 8).translate(x, 0, fz)); }
    this.add(g, tur, M.hotelWall);
    this.add(g, dm, M.copper);
    this.add(g, [box(W - wing * 2, 0.3, D - wing * 2, 0, 0.2, 0)], M.trim); // courtyard
  }

  // ------------------------------------------------------------------ Gothic railway terminus
  terminus(g, L) {
    const W = L.w, D = L.d, H = 22, M = this.mats;
    // E-shaped: long front range, three wings going back.
    const front = 26;
    this.add(g, [box(W, H, front, 0, 0, D / 2 - front / 2), box(22, H, D - front, -W / 2 + 11, 0, -front / 2), box(22, H, D - front, W / 2 - 11, 0, -front / 2), box(30, H + 6, D * 0.55, 0, 0, D / 2 - D * 0.275)], M.stationWall);
    // Basalt bands, gables with steep red roofs, corner turrets with spires.
    this.add(g, [box(W + 0.8, 0.8, front + 0.8, 0, 6, D / 2 - front / 2), box(W + 0.8, 0.8, front + 0.8, 0, H - 0.8, D / 2 - front / 2)], M.grey);
    const gable = (x, z, w, d, y) => {
      const s = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, w * 0.7)]);
      return new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }).translate(x, y, z - d / 2);
    };
    this.add(g, [gable(0, D / 2 - D * 0.275, 30, D * 0.55, H + 6), gable(-W / 2 + 11, -front / 2, 22, D - front, H), gable(W / 2 - 11, -front / 2, 22, D - front, H),
      ...[-3, -2, -1, 1, 2, 3].map((k) => gable(k * W / 7.5, D / 2 - front / 2, 9, front, H))], M.roofRed);
    // Central ribbed dome on a tall drum, with the 'Progress' figure as a slender finial.
    const cz = D / 2 - D * 0.2;
    this.add(g, [new THREE.CylinderGeometry(9, 9.5, 8, 16).translate(0, H + 18, cz)], M.stationWall);
    this.add(g, [dome(9, H + 22, 1.35, 16).translate(0, 0, cz)], M.ribbed);
    this.add(g, [new THREE.CylinderGeometry(0.5, 0.8, 4, 8).translate(0, H + 35, cz), finial(0, H + 37, cz, 3)], M.gold);
    const tur = [], sp = [];
    for (const [x, z] of [[-W / 2, D / 2], [W / 2, D / 2], [-15, D / 2], [15, D / 2], [-W / 2 + 11, -D / 2], [W / 2 - 11, -D / 2]]) { tur.push(...turret(2.2, H + 9, x, z)); sp.push(new THREE.ConeGeometry(2.6, 7, 8).translate(x, H + 12.5, z)); }
    this.add(g, tur, M.stationWall);
    this.add(g, sp, M.ribbed);
  }

  // ------------------------------------------------------------------ municipal HQ
  bmc(g, L) {
    const W = L.w * 0.85, D = L.d * 0.85, H = 24, M = this.mats;
    this.add(g, [box(W, H, 20, 0, 0, D / 2 - 10), box(20, H, D - 20, -W / 2 + 10, 0, -10)], M.bmcWall);
    this.add(g, [box(16, 62, 16, -W / 2 + 18, 0, D / 2 - 18)], M.bmcWall);
    this.add(g, [box(17, 1, 17, -W / 2 + 18, 30, D / 2 - 18), box(17, 1, 17, -W / 2 + 18, 46, D / 2 - 18)], M.grey);
    this.add(g, [onion(6, 62).translate(-W / 2 + 18, 0, D / 2 - 18)], M.ribbed);
    this.add(g, [finial(-W / 2 + 18, 77.5, D / 2 - 18, 3)], M.gold);
    const tur = [], sp = [];
    for (const [x, z] of [[W / 2, D / 2], [-W / 2, D / 2], [-W / 2, -D / 2]]) { tur.push(...turret(2, H + 7, x, z)); sp.push(new THREE.ConeGeometry(2.4, 6, 8).translate(x, H + 10, z)); }
    this.add(g, tur, M.bmcWall);
    this.add(g, sp, M.ribbed);
  }

  // ------------------------------------------------------------------ clock tower
  clocktower(g) {
    const M = this.mats;
    this.add(g, [box(16, 30, 16), box(13, 22, 13, 0, 30, 0), box(11.5, 10, 11.5, 0, 52, 0)], M.buff);
    this.add(g, [box(16.6, 0.8, 16.6, 0, 30, 0), box(13.6, 0.8, 13.6, 0, 52, 0), box(12, 0.8, 12, 0, 62, 0)], M.grey);
    // Clock faces on four sides.
    const faces = [], hands = [];
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2, c = Math.cos(a), s = Math.sin(a);
      faces.push(new THREE.CircleGeometry(3.2, 32).rotateY(a).translate(s * 5.82, 57, c * 5.82));
      hands.push(new THREE.BoxGeometry(0.25, 2.6, 0.1).translate(0, 1.1, 0).rotateZ(0.6).rotateY(a).translate(s * 5.9, 57, c * 5.9));
      hands.push(new THREE.BoxGeometry(0.25, 1.8, 0.1).translate(0, 0.8, 0).rotateZ(-1.9).rotateY(a).translate(s * 5.9, 57, c * 5.9));
    }
    g.add(new THREE.Mesh(mergeGeometries(faces), M.clock), new THREE.Mesh(mergeGeometries(hands), M.hands));
    // Open octagonal lantern, then the spire.
    const lantern = [];
    for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4; lantern.push(new THREE.CylinderGeometry(0.35, 0.35, 9, 6).translate(Math.cos(a) * 4.6, 67.3, Math.sin(a) * 4.6)); }
    lantern.push(new THREE.CylinderGeometry(5.2, 5.2, 0.8, 8).translate(0, 72.2, 0));
    this.add(g, lantern, M.buff);
    this.add(g, [new THREE.ConeGeometry(4.6, 12, 8).translate(0, 78.6, 0)], M.ribbed);
    this.add(g, [finial(0, 84.6, 0, 2.4)], M.gold);
  }

  /** Floodlights at night: warm glow on the stone, lit clock faces. */
  update(night) {
    for (const m of this.lit) m.emissiveIntensity = night * 0.35;
    this.mats.clock.emissiveIntensity = night * 1.2;
  }
}
