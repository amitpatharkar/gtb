import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { POINT } from './tileFormat.js';
import { Y } from './levels.js';

// Procedural street props, drawn as one instanced mesh per kind per tile.
// Trees use alpha-tested leaf cards with normals bent outwards (soft, round canopies).

const seeded = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Leaf cluster texture: many small leaves, optional flowers (gulmohar). */
function leafTexture(seed, greens, flowers) {
  return canvasTex(256, 256, (g) => {
    const rnd = seeded(seed);
    for (let i = 0; i < 520; i++) {
      const x = 128 + (rnd() - 0.5) * 230 * Math.sqrt(rnd()), y = 128 + (rnd() - 0.5) * 230 * Math.sqrt(rnd());
      const flower = flowers && rnd() < 0.42;
      const c = flower ? flowers[Math.floor(rnd() * flowers.length)] : greens[Math.floor(rnd() * greens.length)];
      g.fillStyle = c;
      g.save();
      g.translate(x, y);
      g.rotate(rnd() * 6.28);
      g.beginPath();
      g.ellipse(0, 0, flower ? 5 : 7 + rnd() * 6, flower ? 5 : 3 + rnd() * 2.5, 0, 0, 7);
      g.fill();
      g.restore();
    }
  });
}

/** Coconut palm frond: a rib with leaflets angled outwards. */
function frondTexture() {
  return canvasTex(256, 64, (g) => {
    const rnd = seeded(77);
    g.strokeStyle = '#6b6a2e'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, 32); g.lineTo(256, 32); g.stroke();
    for (let x = 6; x < 250; x += 4) {
      const len = 28 * Math.sin((x / 256) * Math.PI) + 4;
      const green = ['#3f6b21', '#4d7a2a', '#5a8633', '#6f8f3a'][Math.floor(rnd() * 4)];
      g.strokeStyle = green; g.lineWidth = 2.2;
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(x, 32); g.lineTo(x + len * 0.55, 32 + s * len); g.stroke(); }
    }
  });
}

/** Leaf cards scattered in an ellipsoid; normals point away from the canopy centre. */
function canopy(count, centre, radius, card, rnd) {
  const geos = [];
  for (let i = 0; i < count; i++) {
    const u = rnd() * Math.PI * 2, v = Math.acos(2 * rnd() - 1) * 0.75, r = 0.55 + rnd() * 0.45;
    const p = new THREE.Vector3(Math.sin(v) * Math.cos(u) * radius.x * r, Math.cos(v) * radius.y * r, Math.sin(v) * Math.sin(u) * radius.z * r);
    for (let k = 0; k < 2; k++) {
      const q = new THREE.PlaneGeometry(card, card);
      q.rotateY(rnd() * Math.PI + k * Math.PI / 2);
      q.rotateX((rnd() - 0.5) * 0.9);
      q.translate(p.x + centre.x, p.y + centre.y, p.z + centre.z);
      const pos = q.attributes.position, nrm = q.attributes.normal;
      for (let j = 0; j < pos.count; j++) {
        const n = new THREE.Vector3(pos.getX(j) - centre.x, (pos.getY(j) - centre.y) * 1.6, pos.getZ(j) - centre.z).normalize();
        nrm.setXYZ(j, n.x, n.y, n.z);
      }
      geos.push(q);
    }
  }
  return mergeGeometries(geos);
}

function trunk(height, r0, r1, branches, rnd) {
  const parts = [new THREE.CylinderGeometry(r1, r0, height, 12, 2).translate(0, height / 2, 0)];
  for (let i = 0; i < branches; i++) {
    const len = 2.2 + rnd() * 1.8, a = (i / branches) * Math.PI * 2 + rnd();
    const b = new THREE.CylinderGeometry(r1 * 0.35, r1 * 0.6, len, 7, 1).translate(0, len / 2, 0);
    b.rotateZ(0.7 + rnd() * 0.4); b.rotateY(a);
    b.translate(0, height * 0.9, 0);
    parts.push(b);
  }
  return mergeGeometries(parts);
}

function palmGeometry(rnd) {
  const h = 9;
  const curve = new THREE.CubicBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.3, h * 0.35, 0), new THREE.Vector3(0.9, h * 0.7, 0.2), new THREE.Vector3(1.2, h, 0.3));
  const trunkG = new THREE.TubeGeometry(curve, 16, 0.18, 10, false);
  const top = curve.getPoint(1);
  const fronds = [];
  for (let i = 0; i < 13; i++) {
    const len = 4.2 + rnd() * 1.0, w = 1.1, seg = 6;
    const g = new THREE.PlaneGeometry(len, w, seg, 1).translate(len / 2, 0, 0);
    const pos = g.attributes.position;
    const droop = 1.6 + rnd() * 0.4;
    for (let j = 0; j < pos.count; j++) {
      const x = pos.getX(j), wv = pos.getY(j) * Math.sin((x / len) * Math.PI * 0.9 + 0.15);
      // Lies flat along x, sags towards the tip, folded into a shallow V across its width.
      pos.setXYZ(j, x, -Math.pow(Math.max(0, x / len), 1.8) * droop + Math.abs(wv) * 0.3, wv);
    }
    g.computeVertexNormals();
    g.rotateZ(0.25 + rnd() * 0.25);
    g.rotateY((i / 13) * Math.PI * 2 + rnd() * 0.3);
    g.translate(top.x, top.y, top.z);
    fronds.push(g);
  }
  const nuts = [];
  for (let i = 0; i < 5; i++) nuts.push(new THREE.SphereGeometry(0.15, 6, 5).translate(top.x + Math.cos(i * 1.3) * 0.25, top.y - 0.35, top.z + Math.sin(i * 1.3) * 0.25));
  return { trunk: mergeGeometries([trunkG, ...nuts]), leaves: mergeGeometries(fronds) };
}

/** Irregular blob texture (alpha) for potholes, puddles and stains. */
/** Clipped hedge: dense small leaves in several greens, a few darker gaps. */
function hedgeTexture() {
  return canvasTex(128, 128, (g) => {
    g.fillStyle = '#2f5a23'; g.fillRect(0, 0, 128, 128);
    let s = 7;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 900; i++) {
      const x = r() * 128, y = r() * 128, k = r();
      g.fillStyle = k < 0.12 ? '#1d3a17' : k < 0.5 ? '#3d7330' : k < 0.85 ? '#4f8a3a' : '#6aa04a';
      g.beginPath(); g.ellipse(x, y, 2 + r() * 3, 1.2 + r() * 2, r() * 3, 0, 7); g.fill();
    }
  });
}

/** Yellow lattice for tower-crane masts and jibs (alpha-tested): a frame with diagonal bracing. */
function latticeTexture() {
  return canvasTex(64, 64, (g) => {
    g.clearRect(0, 0, 64, 64);
    g.strokeStyle = '#e8b50f'; g.lineWidth = 5;
    g.strokeRect(2, 2, 60, 60);
    g.lineWidth = 3; g.beginPath(); g.moveTo(2, 2); g.lineTo(62, 62); g.moveTo(62, 2); g.lineTo(2, 62); g.stroke();
  });
}

/**
 * Flex banners on lamp posts (survey: "poles plastered with banners"): 8 made-up designs in one
 * atlas (4 × 2): festival greetings, a birthday, a cricket tournament, a health camp, a garba
 * night — cartoon faces, no real people, no parties.
 */
const BANNERS = [
  ['#c2185b', '#ffd54a', 'HARDIK SHUBHECHHA!', 'Happy Birthday', 'SONU BHAU', 1],
  ['#e65100', '#fff3c4', 'GANESHOTSAV 2026', 'Gully Mandal welcomes you', 'GANPATI BAPPA MORYA', 0],
  ['#1b5e20', '#f1f8e9', 'EID MUBARAK', 'From all the shopkeepers', 'of the bazaar', 2],
  ['#4a148c', '#f3e5f5', 'GARBA NIGHT', 'Navratri Utsav · 9 nights', 'Entry free', 0],
  ['#0d47a1', '#e3f2fd', 'GULLY PREMIER LEAGUE', 'Tennis-ball cricket', 'Prize ₹5,001', 3],
  ['#b71c1c', '#ffebee', 'FREE EYE CAMP', 'Sunday 9 am – 1 pm', 'Society hall', 2],
  ['#006064', '#e0f7fa', 'MERRY CHRISTMAS', '& Happy New Year', 'from Pinky Tai', 1],
  ['#f57f17', '#fffde7', 'SHUBH DEEPAVALI', 'Wishes from the', 'Mitra Mandal', 3],
];
function bannerAtlas() {
  return canvasTex(1024, 1024, (g) => {
    BANNERS.forEach(([bg, fg, title, l1, l2, faces], i) => {
      const x = (i % 4) * 256, y = Math.floor(i / 4) * 512;
      const gr = g.createLinearGradient(x, y, x + 256, y + 512); gr.addColorStop(0, bg); gr.addColorStop(1, '#222');
      g.fillStyle = gr; g.fillRect(x, y, 256, 512);
      g.fillStyle = fg; g.textAlign = 'center';
      g.font = 'bold 26px sans-serif'; g.fillText(title, x + 128, y + 60, 236);
      // Cartoon faces in circles (fictional people only).
      for (let k = 0; k < faces; k++) {
        const fx = x + 128 + (k - (faces - 1) / 2) * 70, fy = y + 190, r = 30;
        g.fillStyle = '#fff'; g.beginPath(); g.arc(fx, fy, r + 4, 0, 7); g.fill();
        g.fillStyle = ['#c68642', '#8d5524', '#e0ac69'][k % 3]; g.beginPath(); g.arc(fx, fy, r, 0, 7); g.fill();
        g.fillStyle = '#222'; g.beginPath(); g.arc(fx - 10, fy - 6, 3.5, 0, 7); g.arc(fx + 10, fy - 6, 3.5, 0, 7); g.fill();
        g.strokeStyle = '#222'; g.lineWidth = 3; g.beginPath(); g.arc(fx, fy + 4, 12, 0.2, Math.PI - 0.2); g.stroke();
        g.fillStyle = '#1a1a1a'; g.beginPath(); g.arc(fx, fy - 18, r * 0.85, Math.PI, 0); g.fill();
      }
      if (!faces) { g.fillStyle = fg; g.beginPath(); g.arc(x + 128, y + 200, 60, 0, 7); g.fill(); g.fillStyle = bg; g.font = 'bold 54px sans-serif'; g.fillText('✦', x + 128, y + 220); }
      g.fillStyle = fg; g.font = 'bold 24px sans-serif'; g.fillText(l1, x + 128, y + 320, 236);
      g.font = 'bold 30px sans-serif'; g.fillText(l2, x + 128, y + 370, 236);
      g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(x, y + 470, 256, 42);
      g.fillStyle = '#333'; g.font = '16px sans-serif'; g.fillText('Shri Ganesh Flex Printers', x + 128, y + 497);
    });
  });
}

function blobTexture(seed, inner, outer) {
  return canvasTex(128, 128, (g) => {
    const rnd = seeded(seed);
    const grd = g.createRadialGradient(64, 64, 6, 64, 64, 60);
    grd.addColorStop(0, inner); grd.addColorStop(0.75, inner); grd.addColorStop(1, outer);
    g.fillStyle = grd;
    g.beginPath();
    for (let a = 0; a <= 6.3; a += 0.3) {
      const r = 42 + rnd() * 18;
      g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
    }
    g.fill();
  });
}

function box(w, h, d, x, y, z, color) {
  const g = new THREE.BoxGeometry(w, h, d).translate(x, y, z);
  return paint(g, color);
}
function cyl(r0, r1, h, x, y, z, color, seg = 8) {
  return paint(new THREE.CylinderGeometry(r0, r1, h, seg).translate(x, y, z), color);
}
function paint(g, color) {
  const c = new THREE.Color(color), n = g.attributes.position.count, arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  if (g.index) g = g.toNonIndexed();
  return g;
}
const merge = (list) => mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g)));

export function createProps() {
  const rnd = seeded(2024);
  const bark = new THREE.MeshStandardMaterial({ color: 0x5b4a3c, roughness: 0.95 });
  const leafMat = (tex) => new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 });
  const greens = ['#2f5a1e', '#3a6b25', '#4a7a2c', '#5b8a33', '#36602a', '#47702f'];
  const vc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
  const metal = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.6 });

  const rain = { trunk: trunk(4.2, 0.42, 0.3, 5, rnd), leaves: canopy(26, new THREE.Vector3(0, 7.2, 0), new THREE.Vector3(6.5, 2.6, 6.5), 4.2, rnd) };
  const gul = { trunk: trunk(3.6, 0.3, 0.22, 4, rnd), leaves: canopy(20, new THREE.Vector3(0, 6.0, 0), new THREE.Vector3(5.5, 1.8, 5.5), 3.6, rnd) };
  const peepal = { trunk: trunk(3.8, 0.38, 0.28, 4, rnd), leaves: canopy(22, new THREE.Vector3(0, 7.0, 0), new THREE.Vector3(4.2, 3.4, 4.2), 3.8, rnd) };
  const palm = palmGeometry(rnd);
  const leafRain = leafMat(leafTexture(1, greens));
  const leafGul = leafMat(leafTexture(2, greens, ['#e63b1f', '#f0541e', '#d92b17', '#ff7a2e']));
  // The game's clock is December: gulmohars bloom in April–June, so most are plain feathery green.
  const leafGulGreen = leafMat(leafTexture(2, ['#3f7a25', '#4e8a2c', '#5c9634', '#47802a', '#36662a']));
  const leafPeepal = leafMat(leafTexture(3, ['#3c6e22', '#4f8a2a', '#5f9a35', '#2f5a1e']));
  const frondMat = new THREE.MeshStandardMaterial({ map: frondTexture(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75 });

  const lightG = merge([
    cyl(0.09, 0.13, 9, 0, 4.5, 0, 0x8d9296), cyl(0.05, 0.05, 2.0, 0, 0, 0, 0x8d9296).rotateX(Math.PI / 2).translate(0, 8.9, 1.0),
    box(0.35, 0.12, 0.7, 0, 8.85, 1.9, 0x5c6266),
  ]);
  const lampG = new THREE.BoxGeometry(0.3, 0.04, 0.6).translate(0, 8.78, 1.9);
  // Lamp-post types from the street library (point size encodes the type, see scripts/lib/streetLibrary.mjs):
  // 1 tall galvanised seafront pole, 2 black heritage post with three lanterns, 3 grey post with globes.
  const tallG = merge([
    cyl(0.1, 0.16, 11, 0, 5.5, 0, 0xa7adb2), cyl(0.05, 0.05, 2.5, 0, 0, 0, 0xa7adb2).rotateX(Math.PI / 2).translate(0, 10.9, 1.25),
    box(0.32, 0.1, 0.8, 0, 10.85, 2.4, 0x6a7076),
  ]);
  const tallLampG = new THREE.BoxGeometry(0.28, 0.04, 0.7).translate(0, 10.79, 2.4);
  const heritageG = (() => {
    const iron = 0x161616, parts = [cyl(0.24, 0.3, 0.7, 0, 0.35, 0, iron, 8), cyl(0.09, 0.13, 3.4, 0, 2.3, 0, iron, 8), cyl(0.16, 0.16, 0.12, 0, 1.0, 0, iron, 8)];
    parts.push(box(1.3, 0.07, 0.07, 0, 4.0, 0, iron), box(0.07, 0.07, 1.3, 0, 4.0, 0, iron)); // cross arms
    for (const [x, z] of [[0.62, 0], [-0.31, 0.54], [-0.31, -0.54]]) parts.push(box(0.26, 0.06, 0.26, x, 4.48, z, iron), cyl(0.04, 0.16, 0.14, x, 4.56, z, iron, 6));
    parts.push(cyl(0.03, 0.08, 0.5, 0, 4.4, 0, iron, 6));
    return merge(parts);
  })();
  const heritageLampG = merge([[0.62, 0], [-0.31, 0.54], [-0.31, -0.54]].map(([x, z]) => box(0.2, 0.36, 0.2, x, 4.25, z, 0xffffff)));
  const globeG = merge([cyl(0.2, 0.26, 0.5, 0, 0.25, 0, 0x6c7277, 8), cyl(0.07, 0.1, 4.6, 0, 2.6, 0, 0x6c7277, 8), box(1.4, 0.06, 0.06, 0, 4.7, 0, 0x6c7277)]);
  const globeLampG = merge([-0.7, 0, 0.7].map((x) => new THREE.SphereGeometry(0.22, 10, 8).translate(x, x === 0 ? 5.15 : 4.92, 0)));
  const stopG = merge([
    cyl(0.06, 0.06, 2.6, -1.8, 1.3, 0, 0x6b7075), cyl(0.06, 0.06, 2.6, 1.8, 1.3, 0, 0x6b7075),
    box(4.4, 0.1, 1.9, 0, 2.65, 0.2, 0xc0392b), box(4.2, 1.2, 0.05, 0, 1.6, -0.6, 0x1e4fa3),
    box(3.4, 0.08, 0.45, 0, 0.5, -0.35, 0x8d9296),
  ]);
  const garbageG = (() => {
    const parts = [];
    const cols = [0x1a1a1a, 0x23324a, 0xd9d6cf, 0x2e5d3a, 0x6b4a2e, 0xcfc28a];
    for (let i = 0; i < 9; i++) parts.push(paint(new THREE.IcosahedronGeometry(0.25 + rnd() * 0.25, 0).scale(1, 0.7, 1).translate((rnd() - 0.5) * 1.4, 0.15 + rnd() * 0.2, (rnd() - 0.5) * 0.9), cols[Math.floor(rnd() * cols.length)]));
    for (let i = 0; i < 6; i++) parts.push(box(0.25, 0.01, 0.18, (rnd() - 0.5) * 2.4, 0.01, (rnd() - 0.5) * 1.8, 0xeeeeee));
    return merge(parts);
  })();
  const stallG = (() => {
    // Thela: wooden handcart with two cycle wheels, goods and a striped umbrella.
    const parts = [
      box(1.9, 0.08, 1.0, 0, 0.85, 0, 0x8b5a2b), box(1.9, 0.18, 0.04, 0, 0.95, 0.5, 0x6b4423), box(1.9, 0.18, 0.04, 0, 0.95, -0.5, 0x6b4423),
      cyl(0.32, 0.32, 0.05, 0, 0, 0, 0x222222, 12).rotateX(Math.PI / 2).translate(0.4, 0.32, 0.55),
      cyl(0.32, 0.32, 0.05, 0, 0, 0, 0x222222, 12).rotateX(Math.PI / 2).translate(0.4, 0.32, -0.55),
      cyl(0.03, 0.03, 0.85, -0.85, 0.42, 0.4, 0x5a3a1e), cyl(0.03, 0.03, 0.85, -0.85, 0.42, -0.4, 0x5a3a1e),
      cyl(0.025, 0.025, 1.4, 0, 1.6, 0, 0x777777),
      paint(new THREE.ConeGeometry(1.3, 0.45, 8, 1, true).translate(0, 2.4, 0), 0xd7261e),
    ];
    const fruit = [0xf2b705, 0xd9312b, 0x7cb342, 0xff8f00, 0x8e24aa];
    for (let i = 0; i < 22; i++) parts.push(paint(new THREE.SphereGeometry(0.11, 6, 5).translate((rnd() - 0.5) * 1.6, 1.0 + rnd() * 0.15, (rnd() - 0.5) * 0.8), fruit[Math.floor(rnd() * fruit.length)]));
    return merge(parts);
  })();
  const fuelG = merge([
    box(14, 0.6, 9, 0, 5.6, 0, 0xf2f2f2), box(14.1, 0.25, 9.1, 0, 5.2, 0, 0x0e8a4a),
    cyl(0.25, 0.25, 5.2, -4, 2.6, -2.5, 0xdddddd), cyl(0.25, 0.25, 5.2, 4, 2.6, -2.5, 0xdddddd),
    cyl(0.25, 0.25, 5.2, -4, 2.6, 2.5, 0xdddddd), cyl(0.25, 0.25, 5.2, 4, 2.6, 2.5, 0xdddddd),
    box(0.8, 1.9, 0.5, -2.5, 0.95, 0, 0x0e8a4a), box(0.8, 1.9, 0.5, 2.5, 0.95, 0, 0x0e8a4a),
    box(2.6, 0.2, 1.2, -2.5, 0.1, 0, 0x9a9a9a), box(2.6, 0.2, 1.2, 2.5, 0.1, 0, 0x9a9a9a),
  ]);

  // Tetrapod: four stubby concrete legs pointing to the corners of a tetrahedron.
  const tetraG = (() => {
    const legs = [];
    const dirs = [[0, 1, 0], [0.943, -0.333, 0], [-0.471, -0.333, 0.816], [-0.471, -0.333, -0.816]];
    for (const [x, y, z] of dirs) {
      const leg = new THREE.CylinderGeometry(0.22, 0.42, 1.2, 8).translate(0, 0.6, 0);
      leg.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x, y, z)));
      legs.push(paint(leg, 0x9a958c));
    }
    return merge(legs);
  })();
  const concrete = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  const holeTex = blobTexture(5, 'rgba(38,34,30,1)', 'rgba(70,66,60,0)');
  const puddleTex = blobTexture(9, 'rgba(255,255,255,1)', 'rgba(255,255,255,0)');
  const decal = (size) => new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2);

  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff1d0, emissive: 0xffd9a0, emissiveIntensity: 0, roughness: 0.4 });
  // Lamp variants by type (index = type): [geometry, material, castShadow] lists like KINDS.
  const LIGHTS = [
    [[lightG, metal, true], [lampG, lampMat, false]],
    [[tallG, metal, true], [tallLampG, lampMat, false]],
    [[heritageG, metal, true], [heritageLampG, lampMat, false]],
    [[globeG, metal, true], [globeLampG, lampMat, false]],
  ];

  // Tower crane: lattice mast 1.6 m square × 30 m, jib 32 m forward, counter-jib 11 m back.
  const lattice = new THREE.MeshStandardMaterial({ map: latticeTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.3 });
  const latticeBox = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
  const crane = [
    [merge([latticeBox(1.6, 30, 1.6, 0, 15, 0), latticeBox(1.3, 1.3, 43, 0, 31.2, 10.5), latticeBox(1, 4.2, 1, 0, 33.6, 0)]), lattice, false],
    [merge([box(2.2, 2, 2.4, 0, 29.4, 1.6, 0xe8b50f), box(2.6, 2.4, 3.4, 0, 30.4, -8.5, 0x8a8781), cyl(0.04, 0.04, 16, 0, 22.6, 20, 0x333333, 4), box(0.6, 0.8, 0.8, 0, 14.4, 20, 0xe8b50f), box(2.8, 0.6, 2.8, 0, 0.3, 0, 0x8a8781)]), vc, false],
  ];
  // Water-filled barrier: 1.25 m long, tapered, orange with a white band near the top.
  const barrierG = merge([box(0.5, 0.55, 1.2, 0, Y.ROAD + 0.28, 0, 0xe8661a), box(0.36, 0.14, 1.2, 0, Y.ROAD + 0.62, 0, 0xf2f2ee), box(0.3, 0.12, 1.2, 0, Y.ROAD + 0.75, 0, 0xe8661a)]);
  // Police barricade: two legs, a top bar and a board, 1.8 m wide, facing local +z.
  const barricadeG = merge([box(0.07, 1.1, 0.07, -0.85, Y.KERB + 0.55, 0, 0xe2b40c), box(0.07, 1.1, 0.07, 0.85, Y.KERB + 0.55, 0, 0xe2b40c), box(1.8, 0.07, 0.07, 0, Y.KERB + 1.1, 0, 0xe2b40c), box(0.07, 0.04, 0.6, -0.85, Y.KERB + 0.02, 0, 0xe2b40c), box(0.07, 0.04, 0.6, 0.85, Y.KERB + 0.02, 0, 0xe2b40c), box(1.8, 0.07, 0.07, 0, Y.KERB + 0.25, 0, 0xe2b40c)]);
  const barricadeBoard = new THREE.PlaneGeometry(1.6, 0.55).translate(0, Y.KERB + 0.72, 0.045);
  const barricadeMat = new THREE.MeshStandardMaterial({ map: canvasTex(256, 96, (g) => { g.fillStyle = '#1d4fa3'; g.fillRect(0, 0, 256, 96); g.fillStyle = '#fff'; g.font = 'bold 26px sans-serif'; g.textAlign = 'center'; g.fillText('TRAFFIC POLICE', 128, 44); g.font = '17px sans-serif'; g.fillText('No entry · Keep left', 128, 76); }), side: THREE.DoubleSide, roughness: 0.6 });
  // Flex banners on lamp posts: 1 × 1.6 m at 2.9–4.5 m, across the footpath beside the pole,
  // one geometry per design (the point's size picks it, like lamp types).
  // One mesh for all designs: the geometry shows the atlas's first cell and each instance shifts
  // its UVs by its design (attribute aCell, see buildProps) — one draw call per tile.
  const bannerMat = new THREE.MeshStandardMaterial({ map: bannerAtlas(), side: THREE.DoubleSide, roughness: 0.7 });
  bannerMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aCell;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvMapUv += vec2(mod(aCell, 4.0) * 0.25, -floor(aCell / 4.0) * 0.5);');
  };
  bannerMat.customProgramCacheKey = () => 'banner-cells';
  const bannerG = new THREE.PlaneGeometry(1.0, 1.6).rotateY(Math.PI / 2).translate(0.13, 3.7, 0.55);
  { const uv = bannerG.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) / 4, 0.5 + uv.getY(k) / 2); }

  // kind → list of [geometry, material, castShadow, y]
  const KINDS = {
    [POINT.RAIN_TREE]: [[rain.trunk, bark, true], [rain.leaves, leafRain, true]],
    [POINT.GULMOHAR]: [[gul.trunk, bark, true], [gul.leaves, leafGul, true]],
    [POINT.PEEPAL]: [[peepal.trunk, bark, true], [peepal.leaves, leafPeepal, true]],
    [POINT.PALM]: [[palm.trunk, bark, true], [palm.leaves, frondMat, true]],
    [POINT.LIGHT]: [[lightG, metal, true], [lampG, lampMat, false]],
    // Signals are drawn by src/sim/signals.js (poles on the kerb at each approach, working lights).
    [POINT.BUS_STOP]: [[stopG, vc, true]],
    [POINT.POTHOLE]: [[decal(1), new THREE.MeshStandardMaterial({ map: holeTex, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 }), false, Y.ROAD + 0.004]],
    [POINT.PUDDLE]: [[decal(1.6), new THREE.MeshStandardMaterial({ color: 0x1c1d1e, alphaMap: puddleTex, transparent: true, depthWrite: false, roughness: 0.02, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 }), false, Y.ROAD + 0.006]],
    [POINT.GARBAGE]: [[garbageG, vc, true]],
    [POINT.STALL]: [[stallG, vc, true]],
    [POINT.FUEL]: [[fuelG, vc, true]],
    [POINT.TETRAPOD]: [[tetraG, concrete, true]],
    [POINT.BANNER]: [[bannerG, bannerMat, false]],
    // Construction: a tower crane (lattice mast, jib and counter-jib, cab, counterweight, hook), ~32 m at size 1.
    [POINT.CRANE]: crane,
    // Bazaar lane divider: orange water-filled plastic barrier with a white band.
    [POINT.BARRIER]: [[barrierG, vc, true]],
    // Traffic police barricade: yellow steel frame with a blue board.
    [POINT.BARRICADE]: [[barricadeG, vc, true], [barricadeBoard, barricadeMat, false]],
    // Planted medians: a clipped hedge 0.95 m wide and 0.8 m tall on the median; the point's size stretches it along the road.
    [POINT.HEDGE]: [[new THREE.BoxGeometry(0.95, 0.8, 1, 1, 1, 1).translate(0, Y.KERB + 0.4, 0), new THREE.MeshStandardMaterial({ map: hedgeTexture(), roughness: 0.95 }), true]],
  };
  // Gulmohar points (scripts/lib/streets.mjs treeKind: a quarter of the trees) by a hash of
  // the position: ~5 % in late bloom, 30 % drawn as rain trees (the shade tree that lines
  // most Mumbai streets), the rest green gulmohars.
  const GUL = {
    bloom: KINDS[POINT.GULMOHAR],
    rain: KINDS[POINT.RAIN_TREE],
    green: [[gul.trunk, bark, true], [gul.leaves, leafGulGreen, true]],
  };
  return { KINDS, LIGHTS, GUL, lampMat };
}

const hash2 = (x, z) => { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); };

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

/** Instanced meshes for one tile's point features. data: { kind: Float32Array [x,y,z,angle,size]… } */
export function buildProps(props, data, treeShare = 1) {
  const group = new THREE.Group();
  for (const kind in data) {
    const parts = props.KINDS[kind];
    if (!parts) continue;
    const arr = data[kind];
    const tree = kind <= POINT.PALM;
    const n = arr.length / 5;
    const all = [];
    for (let i = 0; i < n; i++) if (!tree || (i * 0.618) % 1 < treeShare) all.push(i);
    if (!all.length) continue;
    // Street lamps come in types (point size 1, 1.25, 1.5, 1.75): one set of meshes per type.
    const look = (i) => { const h = hash2(arr[i * 5], arr[i * 5 + 2]); return h < 0.05 ? 'bloom' : h < 0.35 ? 'rain' : 'green'; };
    const groups = kind == POINT.LIGHT && props.LIGHTS ? props.LIGHTS.map((ps, v) => [ps, all.filter((i) => Math.round((arr[i * 5 + 4] - 1) * 4) === v)])
      : kind == POINT.GULMOHAR && props.GUL ? Object.entries(props.GUL).map(([k, ps]) => [ps, all.filter((i) => look(i) === k)])
      : [[parts, all]];
    for (const [gparts, keep] of groups) {
    if (!keep.length) continue;
    for (const [pi, [geo, mat, shadow, y]] of gparts.entries()) {
      // Banners: each instance picks its design from the point's size (8 cells of one atlas).
      const g2 = kind == POINT.BANNER ? geo.clone().setAttribute('aCell', new THREE.InstancedBufferAttribute(Float32Array.from(keep, (i) => Math.max(0, Math.min(7, Math.round((arr[i * 5 + 4] - 0.5) / 0.2)))), 1)) : geo;
      const mesh = new THREE.InstancedMesh(g2, mat, keep.length);
      mesh.userData.part = pi; // 0 = trunk for trees, base for stalls (art.js swaps owner-made models in by part 0)
      keep.forEach((i, k) => {
        const s = arr[i * 5 + 4];
        _q.setFromAxisAngle(_up, arr[i * 5 + 3]);
        _p.set(arr[i * 5], y ?? arr[i * 5 + 1], arr[i * 5 + 2]);
        const sc = kind == POINT.POTHOLE || kind == POINT.PUDDLE || tree ? s : 1;
        if (kind == POINT.HEDGE) _s.set(1, 1, s); // stretched along the road
        else if (kind == POINT.CRANE) _s.set(s, s, s);
        else _s.set(sc, tree ? 0.8 + s * 0.25 : sc, sc);
        _m.compose(_p, _q, _s);
        mesh.setMatrixAt(k, _m);
      });
      mesh.castShadow = !!shadow;
      mesh.receiveShadow = !tree;
      mesh.computeBoundingSphere();
      mesh.userData.kind = Number(kind);
      mesh.userData.index = keep; // instance k is point keep[k] (for shaking trees, bending poles)
      group.add(mesh);
    }
    }
  }
  return group;
}
