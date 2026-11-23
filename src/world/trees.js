// Street trees and lamp posts from the map points (src/world/tileFormat.js POINT): broadleaf
// trees (rain tree, gulmohar, peepal) as a branching trunk under a canopy of leaf cards whose
// normals point out of the crown (soft, volumetric light), coconut palms, and street lights.
// One instanced mesh per part per tile; every trunk and pole is a solid physics cylinder.
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { uv, vec3, float, mx_noise_float, smoothstep, positionWorld, mix } from 'three/tsl';
import { RAPIER, GROUP, groups } from '../core/physics.js';
import { POINT } from './tileFormat.js';
import { Y } from './levels.js';

let shared = null;
function rng(seed) { return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); }

function cardCloud(count, rx, ry, rz, cy, size, seed) {
  const r = rng(seed), geos = [];
  for (let i = 0; i < count; i++) {
    // A point in the crown ellipsoid, biased to the outside.
    let x, y, z;
    do { x = r() * 2 - 1; y = r() * 2 - 1; z = r() * 2 - 1; } while (x * x + y * y + z * z > 1);
    const k = 0.55 + 0.45 * Math.cbrt(r());
    x *= rx * k; y *= ry * k; z *= rz * k;
    const g = new THREE.PlaneGeometry(size * (0.8 + r() * 0.5), size * (0.8 + r() * 0.5));
    g.rotateX(r() * Math.PI); g.rotateY(r() * Math.PI * 2); g.rotateZ(r() * Math.PI);
    g.translate(x, cy + y, z);
    // Normals: out of the crown centre, so the canopy shades like a volume.
    const p = g.attributes.position, n = g.attributes.normal;
    for (let v = 0; v < p.count; v++) {
      const dx = p.getX(v) / rx, dy = (p.getY(v) - cy) / ry + 0.35, dz = p.getZ(v) / rz, l = Math.hypot(dx, dy, dz) || 1;
      n.setXYZ(v, dx / l, dy / l, dz / l);
    }
    geos.push(g);
  }
  return mergeGeometries(geos);
}

function trunk(height, r0, r1, branches, seed) {
  const r = rng(seed), geos = [];
  const t = new THREE.CylinderGeometry(r1, r0, height, 9, 1, true);
  t.translate(0, height / 2, 0);
  geos.push(t);
  for (let i = 0; i < branches; i++) {
    const len = height * (0.55 + r() * 0.35), b = new THREE.CylinderGeometry(r1 * 0.45, r1 * 0.75, len, 7, 1, true);
    b.translate(0, len / 2, 0);
    b.rotateZ(0.6 + r() * 0.5);
    b.rotateY((i / branches) * Math.PI * 2 + r());
    b.translate(0, height * (0.85 + r() * 0.1), 0);
    geos.push(b);
  }
  return mergeGeometries(geos);
}

function palmFronds(seed) {
  const r = rng(seed), geos = [];
  for (let i = 0; i < 14; i++) {
    const g = new THREE.PlaneGeometry(0.9, 4.2, 1, 4);
    const p = g.attributes.position;
    for (let v = 0; v < p.count; v++) { const yy = p.getY(v) + 2.1; p.setZ(v, -0.06 * yy * yy); p.setY(v, yy); }
    g.rotateX(-1.1 - r() * 0.5);
    g.rotateY((i / 14) * Math.PI * 2 + r() * 0.3);
    g.translate(0, 9.2, 0);
    geos.push(g);
  }
  const m = mergeGeometries(geos);
  m.computeVertexNormals();
  return m;
}

function lampGeometry() {
  const pole = new THREE.CylinderGeometry(0.07, 0.11, 8.5, 8); pole.translate(0, 4.25, 0);
  const arm = new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6); arm.rotateZ(Math.PI / 2 - 0.15); arm.translate(1.0, 8.35, 0);
  const head = new THREE.BoxGeometry(0.75, 0.16, 0.32); head.translate(2.05, 8.5, 0);
  const base = new THREE.CylinderGeometry(0.18, 0.2, 0.6, 8); base.translate(0, 0.3, 0);
  return mergeGeometries([pole, arm, head, base]);
}

function init() {
  const leaf = (dark, light) => {
    const m = new THREE.MeshStandardNodeMaterial({ side: THREE.DoubleSide, alphaTest: 0.5 });
    const n = mx_noise_float(uv().mul(5.5).add(positionWorld.xz.mul(0.37)));
    const edge = smoothstep(0.5, 0.32, uv().sub(0.5).length());
    m.opacityNode = edge.mul(smoothstep(-0.25, 0.05, n)).add(edge.mul(0.15));
    m.colorNode = mix(vec3(...dark), vec3(...light), n.mul(0.5).add(0.5));
    m.roughnessNode = float(0.75);
    return m;
  };
  const bark = new THREE.MeshStandardNodeMaterial({ roughness: 0.95 });
  bark.colorNode = vec3(0.13, 0.11, 0.09).mul(mx_noise_float(positionWorld.mul(vec3(9, 1.2, 9))).mul(0.25).add(0.85));
  const palmBark = new THREE.MeshStandardNodeMaterial({ roughness: 0.9 });
  palmBark.colorNode = vec3(0.42, 0.37, 0.3).mul(mx_noise_float(positionWorld.mul(vec3(2, 14, 2))).mul(0.2).add(0.9));
  const lampMat = new THREE.MeshStandardNodeMaterial({ color: 0x6d7275, roughness: 0.45, metalness: 0.8 });
  shared = {
    kinds: {
      broad: { trunk: trunk(4.2, 0.42, 0.3, 4, 7), crown: cardCloud(70, 5.2, 2.4, 5.2, 7.0, 2.2, 11), trunkMat: bark, crownMat: leaf([0.06, 0.13, 0.03], [0.2, 0.32, 0.08]), radius: 0.4 },
      gulmohar: { trunk: trunk(3.6, 0.32, 0.24, 4, 3), crown: cardCloud(55, 4.6, 1.9, 4.6, 6.0, 2.0, 5), trunkMat: bark, crownMat: leaf([0.09, 0.17, 0.03], [0.3, 0.42, 0.1]), radius: 0.32 },
      peepal: { trunk: trunk(4.5, 0.55, 0.36, 5, 9), crown: cardCloud(80, 5.6, 3.0, 5.6, 8.0, 2.3, 13), trunkMat: bark, crownMat: leaf([0.05, 0.12, 0.03], [0.18, 0.3, 0.07]), radius: 0.5 },
      palm: { trunk: new THREE.CylinderGeometry(0.16, 0.24, 9.2, 8).translate(0, 4.6, 0), crown: palmFronds(3), trunkMat: palmBark, crownMat: leaf([0.12, 0.2, 0.05], [0.3, 0.42, 0.12]), radius: 0.22 },
    },
    lamp: { geo: lampGeometry(), mat: lampMat, radius: 0.12 },
  };
}

const KIND = { [POINT.RAIN_TREE]: 'broad', [POINT.GULMOHAR]: 'gulmohar', [POINT.PEEPAL]: 'peepal', [POINT.PALM]: 'palm' };

/** Add trees and lamps of one tile (points tile-local) to its group, colliders to its fixed body. */
export function dressTile(tile, group, body, world, tierKey) {
  if (!shared) init();
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const col = new THREE.Color();
  const lists = { broad: [], gulmohar: [], peepal: [], palm: [], lamp: [] };
  for (const [k, pts] of Object.entries(tile.points)) {
    const kind = KIND[k] || (Number(k) === POINT.LIGHT ? 'lamp' : null);
    if (!kind) continue;
    for (let i = 0; i < pts.length; i += 4) lists[kind].push([pts[i], pts[i + 1], pts[i + 2], pts[i + 3]]);
  }
  const keep = tierKey === 'low' ? 0.5 : 1;
  for (const [kind, items] of Object.entries(lists)) {
    if (!items.length) continue;
    const use = items.filter((_, i) => keep === 1 || (i * 7919) % 100 < keep * 100);
    const spec = kind === 'lamp' ? shared.lamp : shared.kinds[kind];
    const parts = kind === 'lamp' ? [[spec.geo, spec.mat]] : [[spec.trunk, spec.trunkMat], [spec.crown, spec.crownMat]];
    for (const [geo, mat] of parts) {
      const im = new THREE.InstancedMesh(geo, mat, use.length);
      use.forEach(([x, z, a, size], i) => {
        const sc = kind === 'lamp' ? 1 : 0.75 + size * 0.35;
        q.setFromAxisAngle(up, a + (kind === 'lamp' ? 0 : i * 1.7));
        im.setMatrixAt(i, m.compose(p.set(x, Y.KERB, z), q, s.set(sc, sc * (kind === 'lamp' ? 1 : 0.9 + ((i * 37) % 10) / 40), sc)));
        if (geo === spec.crown) im.setColorAt(i, col.setHSL(0.24 + ((i * 13) % 10) / 160, 0.5, 0.42 + ((i * 7) % 10) / 60));
      });
      im.castShadow = true; im.receiveShadow = true;
      im.computeBoundingSphere();
      group.add(im);
    }
    if (body) for (const [x, z, , size] of use) {
      const r = spec.radius * (kind === 'lamp' ? 1 : 0.75 + size * 0.35);
      world.createCollider(RAPIER.ColliderDesc.cylinder(2, r).setTranslation(x, 2 + Y.KERB, z).setCollisionGroups(groups(GROUP.WORLD)), body);
    }
  }
}
