import * as THREE from 'three';

// City layout: a grid of blocks separated by roads, with the sea to the east
// (a stand-in for Marine Drive). All sizes are in metres.
export const BLOCK = 28;      // block width
export const ROAD = 12;       // road width
export const CELL = BLOCK + ROAD;
export const GRID = 5;        // blocks from centre in each direction
export const SEA_X = GRID * CELL + ROAD / 2;

const PALETTE = [0xe8d6a8, 0xf0c9b8, 0xd8e0e0, 0xe6b98a, 0xc9d6b0, 0xf2efe6, 0xd9a6a0, 0xb8c4d6];

// One shared window texture, tinted by each building's material colour.
function windowTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      g.fillStyle = Math.random() < 0.15 ? '#ffe9a8' : '#4a5560';
      g.fillRect(x * 16 + 4, y * 16 + 4, 8, 9);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter;
  return t;
}

export function buildWorld(scene) {
  const colliders = []; // axis-aligned boxes: { minX, maxX, minZ, maxZ }
  const half = GRID * CELL + ROAD / 2;

  // Asphalt ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2 + 200, half * 2 + 200),
    new THREE.MeshStandardMaterial({ color: 0x3a3a3c, roughness: 0.95 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Dashed lane markings along every road
  const dashGeo = new THREE.PlaneGeometry(0.25, 3);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xdddddd });
  const dashes = [];
  for (let i = -GRID; i <= GRID; i++) {
    const roadPos = i * CELL;
    for (let s = -half; s < half; s += 8) {
      dashes.push([roadPos, s, 0]);          // north–south road
      dashes.push([s, roadPos, Math.PI / 2]); // east–west road
    }
  }
  const dashMesh = new THREE.InstancedMesh(dashGeo, dashMat, dashes.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  dashes.forEach(([x, z, r], idx) => {
    e.set(-Math.PI / 2, 0, r);
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(x, 0.02, z), q, new THREE.Vector3(1, 1, 1));
    dashMesh.setMatrixAt(idx, m);
  });
  scene.add(dashMesh);

  // Blocks: raised pavement + buildings
  const tex = windowTexture();
  const pavementMat = new THREE.MeshStandardMaterial({ color: 0x9a948a, roughness: 1 });
  for (let i = -GRID; i < GRID; i++) {
    for (let j = -GRID; j < GRID; j++) {
      const cx = i * CELL + CELL / 2;
      const cz = j * CELL + CELL / 2;

      // Leave the centre block open as a maidan (cricket ground)
      if (i === 0 && j === 0) {
        const grass = new THREE.Mesh(
          new THREE.BoxGeometry(BLOCK, 0.3, BLOCK),
          new THREE.MeshStandardMaterial({ color: 0x7a9a4a, roughness: 1 })
        );
        grass.position.set(cx, 0.15, cz);
        grass.receiveShadow = true;
        scene.add(grass);
        continue;
      }

      const pave = new THREE.Mesh(new THREE.BoxGeometry(BLOCK, 0.3, BLOCK), pavementMat);
      pave.position.set(cx, 0.15, cz);
      pave.receiveShadow = true;
      scene.add(pave);

      // 2×2 buildings per block with random heights
      const bw = BLOCK / 2 - 2;
      for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const h = 8 + Math.random() * 34;
        const w = bw - Math.random() * 3;
        const d = bw - Math.random() * 3;
        const mat = new THREE.MeshStandardMaterial({
          color: PALETTE[(Math.random() * PALETTE.length) | 0],
          map: tex.clone(),
          roughness: 0.85,
        });
        mat.map.repeat.set(Math.max(1, Math.round(w / 6)), Math.max(1, Math.round(h / 6)));
        mat.map.needsUpdate = true;
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        const bx = cx + ox * (BLOCK / 4);
        const bz = cz + oz * (BLOCK / 4);
        b.position.set(bx, h / 2 + 0.3, bz);
        b.castShadow = true;
        b.receiveShadow = true;
        scene.add(b);
      }
      // Collide with the whole block footprint (pavement edge)
      colliders.push({ minX: cx - BLOCK / 2, maxX: cx + BLOCK / 2, minZ: cz - BLOCK / 2, maxZ: cz + BLOCK / 2 });
    }
  }

  // Sea + promenade wall to the east
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(400, half * 2 + 200),
    new THREE.MeshStandardMaterial({ color: 0x2f6f86, roughness: 0.25, metalness: 0.1 })
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(SEA_X + 200 + 4, 0.05, 0);
  scene.add(sea);

  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(4, 1, half * 2),
    new THREE.MeshStandardMaterial({ color: 0xbdb6a8 })
  );
  wall.position.set(SEA_X + 2, 0.5, 0);
  wall.castShadow = true;
  scene.add(wall);

  // World boundary
  colliders.push({ minX: SEA_X, maxX: SEA_X + 400, minZ: -1e4, maxZ: 1e4 });
  colliders.push({ minX: -1e4, maxX: -half, minZ: -1e4, maxZ: 1e4 });
  colliders.push({ minX: -1e4, maxX: 1e4, minZ: half, maxZ: 1e4 });
  colliders.push({ minX: -1e4, maxX: 1e4, minZ: -1e4, maxZ: -half });

  return { colliders };
}
