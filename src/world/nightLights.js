import * as THREE from 'three';

// Night light on the city without hundreds of real lights. The ground and building materials
// get a small shader addition that adds two kinds of light by distance:
// - sodium-orange pools under the street lamps nearest the player (as seen on every Mumbai
//   road at night), which also wash the lower floors of the buildings beside them;
// - the headlight beams of the traffic around the player, as bright cones on the road ahead
//   of each car.
// Positions are uniforms refreshed a few times a second by main.js (`nightLights.update`).

const MAX_LAMPS = 32, MAX_CARS = 20;

export const nightUniforms = {
  uLamps: { value: Array.from({ length: MAX_LAMPS }, () => new THREE.Vector4()) }, // x, y (head height), z, strength
  uLampN: { value: 0 },
  uCars: { value: Array.from({ length: MAX_CARS }, () => new THREE.Vector4()) },   // x, z, forward x, forward z
  uCarN: { value: 0 },
  uNightGlow: { value: 0 },
  uOwnCar: { value: false }, // entry 0 of uCars is the player's vehicle (brighter: high beams)
};

const GLSL = /* glsl */ `
  uniform vec4 uLamps[${MAX_LAMPS}]; uniform int uLampN;
  uniform vec4 uCars[${MAX_CARS}]; uniform int uCarN;
  uniform float uNightGlow; uniform bool uOwnCar;
  varying vec3 vNightW;
  vec3 nightLight(vec3 p, vec3 n) {
    vec3 sum = vec3(0.0);
    // Street lamps: a bright pool below the head, fading by 16 m; walls facing the lamp catch it too.
    for (int i = 0; i < ${MAX_LAMPS}; i++) {
      if (i >= uLampN) break;
      vec3 d = uLamps[i].xyz - p;
      float h = length(d.xz);
      float r2 = h * h + d.y * d.y;
      float face = clamp(dot(n, normalize(d)) * 0.8 + 0.35, 0.0, 1.0);
      sum += vec3(1.0, 0.66, 0.34) * uLamps[i].w * 85.0 / (r2 + 36.0) * (1.0 - smoothstep(8.0, 16.0, h)) * face;
    }
    // Headlights: a cone on the road ahead of each car (only on surfaces near the ground).
    float low = 1.0 - smoothstep(0.4, 2.2, p.y);
    if (low > 0.0) for (int i = 0; i < ${MAX_CARS}; i++) {
      if (i >= uCarN) break;
      vec2 rel = p.xz - uCars[i].xy;
      float along = dot(rel, uCars[i].zw);
      if (along < 1.5 || along > 42.0) continue;
      float side = abs(rel.x * uCars[i].w - rel.y * uCars[i].z);
      float cone = 1.0 - smoothstep(0.6 + along * 0.13, 1.4 + along * 0.24, side);
      float fall = 1.0 - (along / 42.0) * (along / 42.0);
      sum += vec3(1.0, 0.94, 0.82) * cone * fall * (i == 0 && uOwnCar ? 2.6 : 1.5) * low;
    }
    // Walls catch less than the road (the lamps point down), and nothing gets brighter than a lit road.
    sum *= mix(0.5, 1.0, smoothstep(0.5, 0.9, n.y));
    return min(sum, vec3(3.0)) * uNightGlow;
  }
`;

/** Add the night light to a MeshStandardMaterial (non-instanced meshes: ground, walls). */
export function addNightLight(material) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, r) => {
    prev?.call(material, shader, r);
    Object.assign(shader.uniforms, nightUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vNightW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvNightW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${GLSL}`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        if (uNightGlow > 0.01) {
          // World-space face normal from the position derivatives, turned towards the camera.
          vec3 nW = normalize(cross(dFdx(vNightW), dFdy(vNightW)));
          if (dot(nW, cameraPosition - vNightW) < 0.0) nW = -nW;
          reflectedLight.directDiffuse += diffuseColor.rgb * nightLight(vNightW, nW);
        }`);
  };
  const prevKey = material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey = () => `${prevKey()}|night`;
  return material;
}

/**
 * Refresh lamp and headlight positions near `focus`. `lamps`: [x, z, strength] candidates
 * (street lamp heads), `cars`: traffic with x, z, heading, speed.
 */
export function updateNightLights(night, focus, lamps = [], cars = [], tier = null, own = null) {
  nightUniforms.uNightGlow.value = night;
  if (night < 0.02) { nightUniforms.uLampN.value = 0; nightUniforms.uCarN.value = 0; return; }
  const low = tier?.name === 'Low', maxL = low ? 16 : MAX_LAMPS, maxC = low ? 10 : MAX_CARS; // fewer per pixel on weak machines
  lamps.sort((a, b) => (a[0] - focus.x) ** 2 + (a[1] - focus.z) ** 2 - ((b[0] - focus.x) ** 2 + (b[1] - focus.z) ** 2));
  const L = nightUniforms.uLamps.value;
  let n = 0;
  for (const [x, z, k] of lamps) { if (n >= maxL) break; L[n++].set(x, 8.4, z, k); }
  nightUniforms.uLampN.value = n;
  const C = nightUniforms.uCars.value;
  let m = 0;
  // The player's own headlights first: real spotlights barely reach a road seen at a grazing angle.
  nightUniforms.uOwnCar.value = !!own;
  if (own) C[m++].set(own.pos.x, own.pos.z, Math.sin(own.heading), Math.cos(own.heading));
  const near = cars.filter((c) => (c.x - focus.x) ** 2 + (c.z - focus.z) ** 2 < 110 * 110).sort((a, b) => (a.x - focus.x) ** 2 + (a.z - focus.z) ** 2 - ((b.x - focus.x) ** 2 + (b.z - focus.z) ** 2));
  for (const c of near) { if (m >= maxC) break; C[m++].set(c.x, c.z, Math.sin(c.heading), Math.cos(c.heading)); }
  nightUniforms.uCarN.value = m;
}
