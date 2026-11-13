import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Real 3D facade parts around the player: window frames, sills, sunshades (chajjas), rusty
// grille cages, AC units, balconies with railings and clothes, shop signboards and shutter
// boxes. Positions come from the tile worker (same rules as the facade shader). Every part
// type is one instanced mesh for the whole city; only parts within a radius of the player
// are drawn, refreshed as the player moves (detail only where the camera looks).

const CAP = { frame: 16000, sill: 16000, chajja: 13000, grille: 6000, ac: 5000, balcony: 4000, sign: 2500, shutterBox: 2500 };
const WHITE = new THREE.Color(1, 1, 1);

function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Window frame: a rectangular ring (front face + inner reveal), facing +z. */
function frameGeometry(border = 0.07, depth = 0.06) {
  const o = 0.5, i = 0.5 - border;
  const pos = [], nrm = [], idx = [];
  const quad = (a, b, c, d, n) => {
    const s = pos.length / 3;
    pos.push(...a, ...b, ...c, ...d);
    for (let k = 0; k < 4; k++) nrm.push(...n);
    idx.push(s, s + 1, s + 2, s, s + 2, s + 3);
  };
  const z = depth;
  quad([-o, -o, z], [o, -o, z], [o, -i, z], [-o, -i, z], [0, 0, 1]);
  quad([-o, i, z], [o, i, z], [o, o, z], [-o, o, z], [0, 0, 1]);
  quad([-o, -i, z], [-i, -i, z], [-i, i, z], [-o, i, z], [0, 0, 1]);
  quad([i, -i, z], [o, -i, z], [o, i, z], [i, i, z], [0, 0, 1]);
  quad([-i, -i, 0], [i, -i, 0], [i, -i, z], [-i, -i, z], [0, 1, 0]);   // reveals
  quad([-i, i, z], [i, i, z], [i, i, 0], [-i, i, 0], [0, -1, 0]);
  quad([-i, -i, z], [-i, i, z], [-i, i, 0], [-i, -i, 0], [1, 0, 0]);
  quad([i, -i, 0], [i, i, 0], [i, i, z], [i, -i, z], [-1, 0, 0]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2));
  g.setIndex(idx);
  return g;
}

const box = (w, h, d, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
function colored(g, hex) {
  g = g.index ? g.toNonIndexed() : g;
  const c = new THREE.Color(hex), arr = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < arr.length; i += 3) { arr[i] = c.r; arr[i + 1] = c.g; arr[i + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

export class FacadeParts {
  constructor(scene, lib, signAtlas, tier) {
    this.radius = tier.partsRadius ?? 0;
    this.meshes = {};
    this.timer = 0;
    this.last = new THREE.Vector3(1e9, 0, 0);
    if (!this.radius) return;
    const plaster = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92 });
    lib.apply(plaster, 'tex-ph-painted-plaster-wall', { size: 1.2 });
    const paint = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 });
    const bars = canvasTex(64, 64, (g) => {
      g.clearRect(0, 0, 64, 64);
      g.fillStyle = '#2a1d16';
      for (let x = 2; x < 64; x += 8) g.fillRect(x, 0, 2.5, 64);
      g.fillRect(0, 0, 64, 3); g.fillRect(0, 30, 64, 2); g.fillRect(0, 61, 64, 3);
    });
    const grilleMat = new THREE.MeshStandardMaterial({ map: bars, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.7, metalness: 0.4 });
    const railMat = new THREE.MeshStandardMaterial({ map: bars, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.5, color: 0x9a9a9a });
    const vents = canvasTex(64, 32, (g) => {
      g.fillStyle = '#d9d9d4'; g.fillRect(0, 0, 64, 32);
      g.fillStyle = '#8c8c88'; for (let y = 3; y < 30; y += 3) g.fillRect(4, y, 56, 1.2);
      g.fillStyle = '#6a6a66'; g.beginPath(); g.arc(46, 16, 11, 0, 7); g.fill();
    });
    const acMat = new THREE.MeshStandardMaterial({ map: vents, roughness: 0.5 });
    const vc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide });
    const metal = new THREE.MeshStandardMaterial({ color: 0x5d6063, roughness: 0.5, metalness: 0.5 });

    // Grille cage: front and sides (bars texture), solid top cap.
    const cage = mergeGeometries([
      new THREE.PlaneGeometry(1, 1).translate(0, 0, 0.3),
      new THREE.PlaneGeometry(0.3, 1).rotateY(Math.PI / 2).translate(-0.5, 0, 0.15),
      new THREE.PlaneGeometry(0.3, 1).rotateY(Math.PI / 2).translate(0.5, 0, 0.15),
      new THREE.PlaneGeometry(1, 0.3).rotateX(-Math.PI / 2).translate(0, 0.5, 0.15),
    ]);
    // Balcony railing (bars texture) and clothes on a line.
    const rail = mergeGeometries([
      new THREE.PlaneGeometry(1, 1).translate(0, 0.55, 1.0),
      new THREE.PlaneGeometry(1.0, 1).rotateY(Math.PI / 2).translate(-0.5, 0.55, 0.5),
      new THREE.PlaneGeometry(1.0, 1).rotateY(Math.PI / 2).translate(0.5, 0.55, 0.5),
    ]);
    const clothCols = [0xc0392b, 0x2e86c1, 0xf4d03f, 0x27ae60, 0xffffff, 0x8e44ad, 0xe67e22];
    const clothes = mergeGeometries(Array.from({ length: 5 }, (_, i) =>
      colored(new THREE.PlaneGeometry(0.16, 0.45 + (i % 3) * 0.12).translate(-0.36 + i * 0.18, 1.35 - (i % 3) * 0.06, 0.55), clothCols[(i * 3) % clothCols.length])));
    const ac = mergeGeometries([box(0.82, 0.55, 0.32, 0, 0, 0.16), box(0.05, 0.05, 0.45, -0.3, -0.3, 0.22), box(0.05, 0.05, 0.45, 0.3, -0.3, 0.22)]);
    const signFace = new THREE.PlaneGeometry(1, 1).translate(0, 0, 0.13);
    const signBack = box(1.02, 1.02, 0.11, 0, 0, 0.06);

    const signMat = new THREE.MeshStandardMaterial({ map: signAtlas, roughness: 0.45, emissive: 0xffffff, emissiveMap: signAtlas, emissiveIntensity: 0 });
    signMat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float signIdx;')
        .replace('#include <uv_vertex>', `#include <uv_vertex>
          vec2 cellXY = vec2(mod(signIdx, 8.0), floor(signIdx / 8.0));
          #ifdef USE_MAP
            vMapUv = (cellXY + uv) / vec2(8.0, 16.0);
          #endif
          #ifdef USE_EMISSIVEMAP
            vEmissiveMapUv = (cellXY + uv) / vec2(8.0, 16.0);
          #endif`);
    };
    signMat.customProgramCacheKey = () => 'gtb-signboard';
    this.signMat = signMat;

    const make = (name, geo, mat, cap, shadow, extraAttr) => {
      const m = new THREE.InstancedMesh(geo, mat, cap);
      m.count = 0;
      m.castShadow = shadow;
      m.receiveShadow = true;
      m.frustumCulled = false;
      if (extraAttr) geo.setAttribute(extraAttr, new THREE.InstancedBufferAttribute(new Float32Array(cap), 1));
      scene.add(m);
      return m;
    };
    this.meshes = {
      frame: [make('frame', frameGeometry(), paint, CAP.frame, false)],
      sill: [make('sill', box(1.12, 0.07, 0.16, 0, -0.035, 0.08), plaster, CAP.sill, false)],
      chajja: [make('chajja', box(1.3, 0.08, 0.55, 0, 0, 0.27), plaster, CAP.chajja, true)],
      grille: [make('grille', cage, grilleMat, CAP.grille, true)],
      ac: [make('ac', ac, acMat, CAP.ac, true)],
      balcony: [make('balconySlab', box(1, 0.16, 1.05, 0, -0.08, 0.52), plaster, CAP.balcony, true),
        make('balconyRail', rail, railMat, CAP.balcony, true), make('balconyClothes', clothes, vc, CAP.balcony, true)],
      sign: [make('signFace', signFace, signMat, CAP.sign, false, 'signIdx'), make('signBack', signBack, metal, CAP.sign, true)],
      shutterBox: [make('shutterBox', box(1, 1, 0.3, 0, 0, 0.15), metal, CAP.shutterBox, true)],
    };
    for (const list of Object.values(this.meshes)) for (const m of list) {
      if (m.material === plaster || m.material === paint) m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(m.instanceMatrix.count * 3).fill(1), 3);
    }
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.s = new THREE.Vector3(); this.p = new THREE.Vector3(); this.c = new THREE.Color();
  }

  update(dt, player, tiles, night = 0) {
    if (!this.radius) return;
    this.signMat.emissiveIntensity = night * 0.9;
    this.timer -= dt;
    const changed = this.version !== tiles.version; // tiles loaded or unloaded: refresh at once
    if (this.timer > 0 && !changed) return;
    if (this.last.distanceToSquared(player.pos) < 100 && !changed) return;
    this.timer = 0.5;
    this.last.copy(player.pos);
    this.version = tiles.version;
    this.rebuild(player.pos.x, player.pos.z, tiles);
  }

  rebuild(px, pz, tiles) {
    const R = this.radius, R2 = R * R;
    const up = THREE.Object3D.DEFAULT_UP;
    for (const [type, meshes] of Object.entries(this.meshes)) {
      let n = 0;
      const cap = meshes[0].instanceMatrix.count;
      const signAttr = type === 'sign' ? meshes[0].geometry.attributes.signIdx : null;
      for (const t of tiles.tiles.values()) {
        const arr = t.facadeParts?.[type];
        if (!arr) continue;
        const [x0, z0, x1, z1] = t.clip;
        if (Math.max(x0 - px, 0, px - x1) > R + 60 || Math.max(z0 - pz, 0, pz - z1) > R + 60) continue;
        const ox = t.origin[0], oz = t.origin[1];
        for (let i = 0; i < arr.length && n < cap; i += 7) {
          const x = arr[i] + ox, z = arr[i + 2] + oz;
          if ((x - px) ** 2 + (z - pz) ** 2 > R2) continue;
          this.q.setFromAxisAngle(up, arr[i + 3]);
          const flat = type === 'sill' || type === 'chajja' || type === 'balcony' || type === 'shutterBox';
          this.s.set(type === 'ac' ? 1 : arr[i + 4], flat ? (type === 'shutterBox' ? arr[i + 5] : 1) : type === 'ac' ? 1 : arr[i + 5], 1);
          this.m.compose(this.p.set(x, arr[i + 1], z), this.q, this.s);
          for (const m of meshes) {
            m.setMatrixAt(n, this.m);
            if (m.instanceColor) m.setColorAt(n, this.c.setHex(arr[i + 6]).lerp(WHITE, type === 'frame' ? 0 : 0.25));
          }
          if (signAttr) signAttr.array[n] = arr[i + 6];
          n++;
        }
      }
      for (const m of meshes) {
        m.count = n;
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
      }
      if (signAttr) signAttr.needsUpdate = true;
    }
  }
}
