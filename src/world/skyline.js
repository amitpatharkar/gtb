import * as THREE from 'three';
import { facadeNight } from './facade.js';

// Far skyline. Real tiles are only loaded within a few hundred metres of the player; beyond
// that the city would simply stop. This draws the tall buildings of the whole map as plain
// boxes (tiles/skyline.bin.gz, written by scripts/lib/skyline.mjs) wherever no tile is
// loaded: one instanced mesh, one draw call. They sit deep in the haze, so no detail is
// needed — only silhouettes by day and scattered lit windows by night. Fog is applied at
// half strength so towers a few kilometres off still show faintly, as they do in Mumbai.

async function gunzipIfNeeded(buf) {
  const u8 = new Uint8Array(buf);
  if (u8[0] !== 0x1f || u8[1] !== 0x8b) return u8; // the server already decompressed it
  const stream = new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export class Skyline {
  /**
   * @param {THREE.Scene} scene
   * @param {object} tiles TileManager (index.skyline names the file; tiles + size say what is loaded)
   * @param {object} tier quality tier (name)
   */
  constructor(scene, tiles, tier) {
    this.scene = scene;
    this.tiles = tiles;
    this.range = tier.name === 'High' ? 4200 : tier.name === 'Medium' ? 3300 : 2600;
    this.max = tier.name === 'High' ? 4500 : tier.name === 'Medium' ? 3200 : 2200;
    this.knee = tier.loadRadius || 520;
    this.at = { x: 1e9, z: 1e9, v: -1 };
    this.count = 0;
    this.load();
  }

  async load() {
    const info = this.tiles.index?.skyline;
    if (!info) return;
    try {
      const res = await fetch(this.tiles.baseUrl + info.file);
      if (!res.ok) return;
      const u8 = await gunzipIfNeeded(await res.arrayBuffer());
      const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
      if (String.fromCharCode(u8[0], u8[1], u8[2], u8[3]) !== 'SKY1') return;
      const n = dv.getUint32(4, true), minX = dv.getFloat32(8, true), minZ = dv.getFloat32(12, true);
      // x, z, w, d, angle, h + colour (linear)
      const box = new Float32Array(n * 6), col = new Float32Array(n * 3);
      const c = new THREE.Color();
      for (let i = 0, o = 16; i < n; i++, o += 11) {
        box[i * 6] = minX + dv.getUint16(o, true) / 2;
        box[i * 6 + 1] = minZ + dv.getUint16(o + 2, true) / 2;
        box[i * 6 + 2] = u8[o + 4]; box[i * 6 + 3] = u8[o + 5];
        box[i * 6 + 4] = (u8[o + 6] / 256) * Math.PI;
        box[i * 6 + 5] = u8[o + 7] * 2;
        c.setRGB(u8[o + 8] / 255, u8[o + 9] / 255, u8[o + 10] / 255, THREE.SRGBColorSpace);
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
      this.box = box; this.col = col; this.n = n;
      this.build();
    } catch { /* no skyline: the haze hides the edge of the world as before */ }
  }

  build() {
    const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0); // base on the ground
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uNight = facadeNight;
      sh.uniforms.uKnee = { value: this.knee };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vSkyPos; varying vec3 vSkyN; varying vec3 vSkySize;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vSkyPos = position; vSkyN = normal;
          vSkySize = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform float uNight; uniform float uKnee; varying vec3 vSkyPos; varying vec3 vSkyN; varying vec3 vSkySize;
          float skyHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          {
            // Windows: a grid of floors and bays on the four walls; a share of them lit at night.
            vec3 m = (vSkyPos + vec3(0.5, 0.0, 0.5)) * vSkySize;
            float along = abs(vSkyN.x) > 0.5 ? m.z : m.x;
            vec2 cell = vec2(floor(along / 3.6), floor(m.y / 3.3));
            vec2 f = fract(vec2(along / 3.6, m.y / 3.3));
            float win = step(0.22, f.x) * step(f.x, 0.78) * step(0.3, f.y) * step(f.y, 0.8) * step(abs(vSkyN.y), 0.5);
            float seed = skyHash(cell + floor(vSkySize.xz) * 7.0 + vSkyN.xz * 3.0);
            float lit = step(0.62, seed);
            // Far away the grid is smaller than a pixel: blend to the average glow instead of shimmering.
            #ifdef USE_FOG
              float fade = smoothstep(700.0, 2200.0, vFogDepth);
            #else
              float fade = 0.0;
            #endif
            float glow = mix(win * lit, 0.11, fade);
            totalEmissiveRadiance += vec3(1.0, 0.78, 0.45) * glow * uNight * 0.9;
            diffuseColor.rgb *= mix(1.0, 0.72, win * (1.0 - fade)); // dark glass by day
          }`)
        // Haze: the same as real buildings up to the tile radius (no jump when a tile loads),
        // then thinning out, so towers a few kilometres off stay faintly visible.
        .replace('#include <fog_fragment>', `#ifdef USE_FOG
            float skyDepth = vFogDepth < uKnee ? vFogDepth : uKnee + (vFogDepth - uKnee) * 0.3;
            float skyFog = 1.0 - exp(-fogDensity * fogDensity * skyDepth * skyDepth);
            gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, skyFog);
          #endif`);
    };
    const mesh = new THREE.InstancedMesh(geo, mat, this.max);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.max * 3), 3);
    mesh.count = 0;
    mesh.frustumCulled = false; // instances move with the player; the bounding sphere would go stale
    mesh.castShadow = false; mesh.receiveShadow = false;
    mesh.matrixAutoUpdate = false;
    mesh.name = 'skyline';
    this.mesh = mesh;
    this.scene.add(mesh);
  }

  /** Refresh which boxes are drawn when the player has moved or tiles have loaded/unloaded. */
  update(pos) {
    if (!this.mesh) return;
    const T = this.tiles;
    if (Math.hypot(pos.x - this.at.x, pos.z - this.at.z) < 120 && this.at.v === T.version) return;
    this.at = { x: pos.x, z: pos.z, v: T.version };
    const { box, col, n, mesh } = this, size = T.size, R2 = this.range * this.range;
    const m = mesh.instanceMatrix.array, ic = mesh.instanceColor.array;
    let k = 0;
    for (let i = 0; i < n && k < this.max; i++) {
      const x = box[i * 6], z = box[i * 6 + 1], dx = x - pos.x, dz = z - pos.z;
      if (dx * dx + dz * dz > R2) continue;
      if (T.tiles.has(`${Math.floor(x / size)},${Math.floor(z / size)}`)) continue; // the real building is there
      const w = box[i * 6 + 2], d = box[i * 6 + 3], a = box[i * 6 + 4], h = box[i * 6 + 5], c = Math.cos(a), s = Math.sin(a), o = k * 16;
      // Columns: local x (along the longest wall) → world (c, 0, s); y → up; z → (-s, 0, c).
      m[o] = c * w; m[o + 1] = 0; m[o + 2] = s * w; m[o + 3] = 0;
      m[o + 4] = 0; m[o + 5] = h; m[o + 6] = 0; m[o + 7] = 0;
      m[o + 8] = -s * d; m[o + 9] = 0; m[o + 10] = c * d; m[o + 11] = 0;
      m[o + 12] = x; m[o + 13] = 0; m[o + 14] = z; m[o + 15] = 1;
      ic[k * 3] = col[i * 3]; ic[k * 3 + 1] = col[i * 3 + 1]; ic[k * 3 + 2] = col[i * 3 + 2];
      k++;
    }
    mesh.count = k; this.count = k;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
  }
}
