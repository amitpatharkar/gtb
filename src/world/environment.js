import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { macroNoiseTexture } from './textures.js';

// Late-afternoon Mumbai. A real sky photo (HDRI) lights the city and shows behind it;
// it is turned so the sun sits low in the south-west, over the Arabian Sea.
// Without the media folder, a gradient sky is used instead.

const SKY_ID = 'hdri-qwantani-late-afternoon-puresky';
const SUN_AZIMUTH = new THREE.Vector3(-0.78, 0, 0.62).normalize(); // south-west (x = east, z = south)
const SEA_LEVEL = -0.7;

export async function createEnvironment(renderer, scene, bounds, tier, lib) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  let sunDir, sunColor, haze, skySun = null;

  const hdrUrl = lib.available && lib.url(SKY_ID);
  if (hdrUrl) {
    const hdr = await new HDRLoader().loadAsync(hdrUrl);
    const info = analyseSky(hdr);
    // Rotate the sky about the vertical axis so its sun points south-west.
    const yaw = Math.atan2(info.sun.z, info.sun.x) - Math.atan2(SUN_AZIMUTH.z, SUN_AZIMUTH.x);
    scene.backgroundRotation.set(0, yaw, 0);
    scene.environmentRotation.set(0, yaw, 0);
    sunDir = info.sun.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    skySun = info.sun.clone();
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = hdr;
    scene.backgroundIntensity = 1;
    // Lighting: the same sky with the sun disk removed (the sun is a separate shadow-casting light).
    scene.environment = pmrem.fromEquirectangular(info.withoutSun).texture;
    scene.environmentIntensity = 1;
    info.withoutSun.dispose();
    sunColor = new THREE.Color(1, 0.86, 0.68);
    haze = info.horizon;
  } else {
    sunDir = new THREE.Vector3(-0.62, 0.35, 0.5).normalize();
    sunColor = new THREE.Color(1, 0.86, 0.68);
    haze = new THREE.Color(0xcfcbbf);
    scene.background = haze.clone();
    scene.environment = pmrem.fromScene(gradientSky(haze), 0, 0.1, 2000).texture;
  }
  pmrem.dispose();

  // Warm, slightly brown Mumbai haze; dense enough to hide the streaming edge (~700 m).
  scene.fog = new THREE.FogExp2(haze, 0.0013);

  const hemi = new THREE.HemisphereLight(0xcfe0f0, 0x8a8c8e, lib.available ? 0.15 : 0.6); // grey concrete bounce, not brown
  scene.add(hemi);
  // Moonlight: a dim blue fill at night (no shadows).
  const moon = new THREE.DirectionalLight(0x8fa6d8, 0);
  moon.position.set(0.3, 1, -0.4);
  scene.add(moon);

  const sun = new THREE.DirectionalLight(sunColor, lib.available ? 3.2 : 2.0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(tier.shadowMapSize, tier.shadowMapSize);
  const r = tier.shadowRange;
  Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 900 });
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.05;
  scene.add(sun, sun.target);
  const texel = (2 * r) / tier.shadowMapSize;

  // Sea: a big plane below land level; land tiles sit on top of it.
  const pad = 6000;
  const w = bounds.maxX - bounds.minX + pad * 2, h = bounds.maxZ - bounds.minZ + pad * 2;
  const seaMat = seaMaterial(w, h);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(w, h), seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set((bounds.minX + bounds.maxX) / 2, SEA_LEVEL, (bounds.minZ + bounds.maxZ) / 2);
  sea.receiveShadow = true;
  // No depth writes and drawn early, so land, sea walls and roads always cover it.
  seaMat.depthWrite = false;
  sea.renderOrder = -1;
  scene.add(sea);

  const snap = new THREE.Vector3();
  const dayHaze = haze.clone(), nightHaze = new THREE.Color(0.05, 0.05, 0.07), duskTint = new THREE.Color(1.0, 0.62, 0.38);
  const smogTint = new THREE.Color(0.62, 0.52, 0.4);
  const tmp = new THREE.Color(), warm = new THREE.Color(1, 0.55, 0.3), white = new THREE.Color(1, 0.9, 0.8);
  const up = new THREE.Vector3(0, 1, 0);
  return {
    sun,
    sunDir,
    /** Move the sun with the clock; sky, haze and exposure follow daylight and air quality. */
    update(dt, focus, clock) {
      if (clock) {
        sunDir.copy(clock.sunDir);
        if (skySun) {
          // Keep the sky photo's sun disk on the real sun's bearing.
          const yaw = Math.atan2(skySun.z, skySun.x) - Math.atan2(sunDir.z, sunDir.x);
          scene.backgroundRotation.set(0, yaw, 0);
          scene.environmentRotation.set(0, yaw, 0);
        }
        const d = clock.daylight, n = clock.night, tw = clock.twilight;
        const elevDeg = THREE.MathUtils.radToDeg(clock.elevation);
        const smog = THREE.MathUtils.clamp((clock.aqi - 50) / 350, 0, 1);
        scene.backgroundIntensity = 0.03 + 0.97 * d;
        scene.environmentIntensity = 0.05 + 0.95 * d;
        sun.intensity = 3.2 * THREE.MathUtils.smoothstep(elevDeg, -1, 7) * (1 - 0.45 * smog);
        sun.color.copy(warm).lerp(white, THREE.MathUtils.smoothstep(elevDeg, 2, 30));
        hemi.intensity = 0.22 + 0.16 * n;   // shade fill by day; a little city glow at night — walls away from lamps go dark
        moon.intensity = 0.35 * n;
        // Haze: browner and thicker with worse air; dark at night with a dusk glow.
        tmp.copy(dayHaze).lerp(smogTint, smog * 0.35).lerp(duskTint.clone().multiplyScalar(dayHaze.r), tw * 0.35);
        scene.fog.color.copy(nightHaze).lerp(tmp, d);
        scene.fog.density = 0.0007 + clock.aqi * 0.0000072 + n * 0.00012;
        renderer.toneMappingExposure = THREE.MathUtils.lerp(1.15, 0.62, d) * (renderer.exposureScale || 1);
        seaMat.color.setRGB(0.17, 0.31, 0.34).multiplyScalar(0.25 + 0.75 * d);
      }
      // Shadow box follows the player; snap to whole texels so shadows don't shimmer.
      snap.set(Math.round(focus.x / texel) * texel, 0, Math.round(focus.z / texel) * texel);
      sun.target.position.copy(snap);
      sun.position.copy(snap).addScaledVector(sunDir.y > 0.02 ? sunDir : up, 400);
      seaMat.userData.time.value += dt;
    },
  };
}

/** Find the sun (brightest pixel), a sun-free copy for lighting, and the horizon colour. */
function analyseSky(hdr) {
  const { data, width: w, height: h } = hdr.image;
  const half = data instanceof Uint16Array;
  const get = half ? (i) => THREE.DataUtils.fromHalfFloat(data[i]) : (i) => data[i];
  let best = -1, bestI = 0;
  for (let i = 0; i < w * h; i++) {
    const l = get(i * 4) + get(i * 4 + 1) + get(i * 4 + 2);
    if (l > best) { best = l; bestI = i; }
  }
  const px = bestI % w, py = Math.floor(bestI / w);
  const elev = (0.5 - (py + 0.5) / h) * Math.PI;
  const phi = ((px + 0.5) / w - 0.5) * Math.PI * 2;
  const sun = new THREE.Vector3(Math.cos(phi) * Math.cos(elev), Math.sin(elev), Math.sin(phi) * Math.cos(elev));

  // Copy with bright pixels squashed (the directional light provides the sun instead).
  // The visible sky keeps its sun, but capped: the photo's sun disk is thousands of times
  // brighter than white, and with bloom it washed out the whole screen whenever the camera
  // faced it.
  const out = new Float32Array(w * h * 4);
  const MAX = 6, CAP = 18;
  const set = half ? (i, v) => { data[i] = THREE.DataUtils.toHalfFloat(v); } : (i, v) => { data[i] = v; };
  let capped = false;
  for (let i = 0; i < w * h; i++) {
    const r = get(i * 4), g = get(i * 4 + 1), b = get(i * 4 + 2);
    const l = (r + g + b) / 3;
    const k = l > MAX ? MAX / l : 1;
    out[i * 4] = r * k; out[i * 4 + 1] = g * k; out[i * 4 + 2] = b * k; out[i * 4 + 3] = 1;
    if (l > CAP) { const c = CAP / l; set(i * 4, r * c); set(i * 4 + 1, g * c); set(i * 4 + 2, b * c); capped = true; }
  }
  if (capped) hdr.needsUpdate = true;
  const withoutSun = new THREE.DataTexture(out, w, h, THREE.RGBAFormat, THREE.FloatType);
  withoutSun.mapping = THREE.EquirectangularReflectionMapping;
  withoutSun.colorSpace = THREE.LinearSRGBColorSpace;
  withoutSun.flipY = hdr.flipY;
  withoutSun.needsUpdate = true;

  // Average sky colour just above the horizon (0.5°–4°) → fog colour that blends into the sky.
  const horizon = new THREE.Color(0, 0, 0);
  let n = 0;
  for (let y = Math.floor(h * (0.5 - 4 / 180)); y <= Math.floor(h * (0.5 - 0.5 / 180)); y++) {
    for (let x = 0; x < w; x += 2) {
      const i = (y * w + x) * 4;
      horizon.r += out[i]; horizon.g += out[i + 1]; horizon.b += out[i + 2]; n++;
    }
  }
  horizon.multiplyScalar(1 / n);
  // Mumbai haze is warmer and browner than a clean sky.
  horizon.lerp(new THREE.Color(horizon.r * 1.05, horizon.g * 0.98, horizon.b * 0.88), 0.7);
  return { sun, withoutSun, horizon };
}

function gradientSky(haze) {
  const s = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    uniforms: { zenith: { value: new THREE.Color(0x5d8fc2) }, horizon: { value: haze } },
    vertexShader: 'varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 zenith, horizon; varying vec3 vDir; void main() { float h = max(normalize(vDir).y, 0.0); gl_FragColor = vec4(mix(horizon, zenith, smoothstep(0.0, 0.65, h)), 1.0); }',
    side: THREE.BackSide,
  });
  s.add(new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), mat));
  return s;
}

/**
 * Murky Arabian Sea water: two scrolling ripple layers at different scales (no visible
 * tiling), Fresnel sky reflection from the environment map, colour varying with noise.
 */
function seaMaterial() {
  const mat = new THREE.MeshStandardMaterial({ color: 0x2c4f57, roughness: 0.13, metalness: 0 });
  const time = { value: 0 };
  mat.userData.time = time;
  mat.normalMap = waveNormals();
  mat.normalScale.set(0.55, 0.55);
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.uniforms.tMacro = { value: macroNoiseTexture() };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vSeaXZ;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvSeaXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vSeaXZ;\nuniform float uTime;\nuniform sampler2D tMacro;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float seaN = texture2D(tMacro, vSeaXZ / 160.0).r;
        diffuseColor.rgb *= 0.8 + 0.45 * seaN;`)
      .replace('#include <normal_fragment_maps>', `
        vec2 seaUv1 = vSeaXZ / 23.0 + vec2(uTime * 0.012, uTime * 0.007);
        vec2 seaUv2 = vSeaXZ / 61.0 + vec2(-uTime * 0.006, uTime * 0.011);
        vec2 seaUv3 = vSeaXZ / 7.3 + vec2(uTime * 0.02, -uTime * 0.017);
        vec3 seaN1 = texture2D(normalMap, seaUv1).xyz * 2.0 - 1.0;
        vec3 seaN2 = texture2D(normalMap, seaUv2).xyz * 2.0 - 1.0;
        vec3 seaN3 = texture2D(normalMap, seaUv3).xyz * 2.0 - 1.0;
        vec3 seaMapN = normalize(vec3((seaN1.xy + seaN2.xy * 1.3 + seaN3.xy * 0.5) * normalScale, 1.0));
        normal = normalize(tbn * seaMapN);`);
  };
  mat.customProgramCacheKey = () => 'gtb-sea';
  return mat;
}

/** Tileable ripple normal map from summed sine waves. */
function waveNormals() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const img = g.createImageData(S, S);
  const waves = [[3, 1, 0.0], [1, 4, 1.3], [5, -2, 2.1], [-4, 3, 0.7], [7, 5, 4.0], [-9, 6, 2.9], [11, -7, 1.1], [-13, -4, 5.2]];
  const height = (x, y) => {
    let hh = 0;
    for (const [a, b, p] of waves) hh += Math.sin(((a * x + b * y) / S) * Math.PI * 2 + p) / Math.hypot(a, b);
    return hh;
  };
  const n = new THREE.Vector3();
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = height(x + 1, y) - height(x - 1, y);
      const dy = height(x, y + 1) - height(x, y - 1);
      n.set(-dx * 6, -dy * 6, 1).normalize();
      const i = (y * S + x) * 4;
      img.data[i] = (n.x * 0.5 + 0.5) * 255;
      img.data[i + 1] = (n.y * 0.5 + 0.5) * 255;
      img.data[i + 2] = (n.z * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
