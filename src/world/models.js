import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Real 3D models (glTF/GLB from the asset pipeline: Poly Haven, Kenney, Quaternius) turned
// into instanced meshes: node transforms baked in, one merged geometry per material,
// rescaled to real-world size and sat on the ground.

const loader = new GLTFLoader();
const cache = new Map();

/** Load a model and return [{ geometry, material }] in metres (base at y = 0, centred). */
export function loadParts(url, { size, axis = 'height', node = null, keepMaps = ['map', 'normalMap'] } = {}) {
  const key = `${url}|${size}|${axis}|${node}`;
  if (cache.has(key)) return cache.get(key);
  const p = loader.loadAsync(url).then((gltf) => {
    gltf.scene.updateMatrixWorld(true);
    const byMat = new Map();
    let k = 0;
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      if (node !== null && k++ !== node) return;
      const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const m = mats[0];
      // Keep only colour and normal maps (lighter on memory); fold roughness into a constant.
      for (const slot of ['roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap']) if (!keepMaps.includes(slot) && m[slot]) { m[slot].dispose(); m[slot] = null; }
      m.needsUpdate = true;
      (byMat.get(m) || byMat.set(m, []).get(m)).push(g.index ? g.toNonIndexed() : g);
    });
    let parts = [...byMat].map(([material, geos]) => ({ material, geometry: mergeGeometries(geos) }));
    // Normalise: base on the ground, centred, scaled to the requested size.
    const bb = new THREE.Box3();
    for (const p of parts) { p.geometry.computeBoundingBox(); bb.union(p.geometry.boundingBox); }
    const dim = bb.getSize(new THREE.Vector3());
    const s = size ? size / (axis === 'height' ? dim.y : axis === 'width' ? dim.x : Math.max(dim.x, dim.z)) : 1;
    const c = bb.getCenter(new THREE.Vector3());
    for (const p of parts) p.geometry.translate(-c.x, -bb.min.y, -c.z).scale(s, s, s);
    parts.size = dim.multiplyScalar(s);
    return parts;
  });
  cache.set(key, p);
  return p;
}

/** Many copies of one model: one InstancedMesh per material, filled each refresh. */
export class Instancer {
  constructor(scene, parts, max, shadow = true) {
    this.meshes = parts.map(({ geometry, material }) => {
      const m = new THREE.InstancedMesh(geometry, material, max);
      m.count = 0;
      m.castShadow = shadow;
      m.receiveShadow = true;
      m.frustumCulled = false;
      scene.add(m);
      return m;
    });
    this.max = max;
    this.n = 0;
  }
  begin() { this.n = 0; }
  put(matrix) { if (this.n >= this.max) return; for (const m of this.meshes) m.setMatrixAt(this.n, matrix); this.n++; }
  end() { for (const m of this.meshes) { m.count = this.n; m.instanceMatrix.needsUpdate = true; } }
}
