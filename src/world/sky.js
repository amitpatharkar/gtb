// Sky and sunlight: a real photographed sky (HDRI) for the background and image-based
// lighting, a sun placed exactly where the photo's sun is (found from the brightest pixel), and
// a shadow box that follows the player, snapped to shadow-map texels so edges don't shimmer.
import * as THREE from 'three/webgpu';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

const BASE = import.meta.env.BASE_URL;
// The id must appear literally: scripts/ship-media.mjs ships only media named in src/.
const SKY = 'hdri-qwantani-late-afternoon-puresky';

/** Direction of the brightest region of an equirectangular HDR (the sun), plus the horizon colour. */
function analyse(tex) {
  const { data, width, height } = tex.image;
  const get = tex.type === THREE.HalfFloatType ? (i) => THREE.DataUtils.fromHalfFloat(data[i]) : (i) => data[i];
  const ch = data.length / (width * height);
  let best = -1, bx = 0, by = 0;
  const hz = [0, 0, 0];
  for (let y = 0; y < height / 2; y++) for (let x = 0; x < width; x += 2) {
    const i = (y * width + x) * ch;
    const l = get(i) * 0.2126 + get(i + 1) * 0.7152 + get(i + 2) * 0.0722;
    if (l > best) { best = l; bx = x; by = y; }
  }
  const row = Math.floor(height * 0.47);
  for (let x = 0; x < width; x += 4) { const i = (row * width + x) * ch; hz[0] += get(i); hz[1] += get(i + 1); hz[2] += get(i + 2); }
  const n = width / 4;
  // Equirectangular: u → longitude, v → latitude (three.js convention).
  const lon = (bx / width) * Math.PI * 2 - Math.PI, lat = Math.PI / 2 - (by / height) * Math.PI;
  const dir = new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)).normalize();
  // Keep the sun high enough for good street-level light (a low sun puts every street in shade).
  if (dir.y < 0.5) { dir.y = 0.5; dir.normalize(); }
  return { dir, horizon: new THREE.Color(hz[0] / n, hz[1] / n, hz[2] / n) };
}

export async function createSky(scene, tier) {
  const tex = await new HDRLoader().loadAsync(`${BASE}media/hdri/${SKY}.hdr`);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  const { dir, horizon } = analyse(tex);
  scene.background = tex;
  scene.environment = tex;
  scene.environmentIntensity = 0.9;
  scene.backgroundIntensity = 1.0;
  // Coastal haze: the sky's own horizon colour, a little darker.
  const haze = horizon.clone().multiplyScalar(0.85);
  const max = Math.max(haze.r, haze.g, haze.b, 1e-3);
  haze.multiplyScalar(Math.min(1, 0.62 / max));
  scene.fog = new THREE.Fog(haze, tier.drawDistance * 0.4, tier.drawDistance * 1.6);

  const sun = new THREE.DirectionalLight(0xfff1dc, 3.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(tier.shadow, tier.shadow);
  const s = tier.shadowBox;
  Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 600 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);

  const texel = (2 * s) / tier.shadow;
  const right = new THREE.Vector3(), up = new THREE.Vector3(), c = new THREE.Vector3();
  right.crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize();
  up.crossVectors(dir, right).normalize();
  return {
    sun, dir,
    /** Centre the shadow box on (x, y, z), snapped to whole shadow texels in light space. */
    follow(x, y, z) {
      c.set(x, y, z);
      const a = Math.round(c.dot(right) / texel) * texel, b = Math.round(c.dot(up) / texel) * texel, d = c.dot(dir);
      c.copy(right).multiplyScalar(a).addScaledVector(up, b).addScaledVector(dir, d);
      sun.target.position.copy(c);
      sun.position.copy(c).addScaledVector(dir, 300);
      sun.target.updateMatrixWorld();
    },
  };
}
