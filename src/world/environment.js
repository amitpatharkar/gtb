import * as THREE from 'three';

// Late-afternoon Mumbai: warm haze, sun low over the Arabian Sea (west), glossy sea.

export const SUN_DIR = new THREE.Vector3(-0.62, 0.55, 0.56).normalize();
const HAZE = 0xcfcbbf;   // horizon and fog colour (they must match)
const ZENITH = 0x5d8fc2;

/** Gradient sky dome with a soft sun; its horizon colour equals the fog colour. */
function skyDome() {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      zenith: { value: new THREE.Color(ZENITH) },
      horizon: { value: new THREE.Color(HAZE) },
      sunDir: { value: SUN_DIR.clone() },
      sunColor: { value: new THREE.Color(0xffd9a0) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 zenith, horizon, sunDir, sunColor;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = max(d.y, 0.0);
        vec3 col = mix(horizon, zenith, smoothstep(0.0, 0.65, h));
        float s = max(dot(d, sunDir), 0.0);
        col += sunColor * (pow(s, 900.0) * 12.0 + pow(s, 12.0) * 0.35 + pow(s, 3.0) * 0.08);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
    depthTest: false,
    depthWrite: false,
    fog: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), mat);
  sky.renderOrder = -2;
  sky.frustumCulled = false;
  return sky;
}

export function createEnvironment(renderer, scene, bounds) {
  scene.fog = new THREE.Fog(HAZE, 150, 700);
  scene.background = new THREE.Color(HAZE);

  // Bake the sky once into an environment map so glass, water and steel reflect it.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(skyDome());
  scene.environment = pmrem.fromScene(envScene, 0, 0.1, 2000).texture;
  scene.environmentIntensity = 0.45;
  pmrem.dispose();
  const sky = skyDome();
  scene.add(sky);

  const hemi = new THREE.HemisphereLight(0xd8e4ee, 0x6b5d4a, 0.55);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffd8a8, 1.9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -90; sc.right = 90; sc.top = 90; sc.bottom = -90; sc.near = 1; sc.far = 600;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);

  // Sea: one big plane below land level; the land tiles sit on top of it.
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshStandardMaterial({ color: 0x24627a, roughness: 0.16, metalness: 0, normalMap: waveNormals(), normalScale: new THREE.Vector2(0.35, 0.35) })
  );
  const pad = 6000;
  const w = bounds.maxX - bounds.minX + pad * 2, h = bounds.maxZ - bounds.minZ + pad * 2;
  sea.scale.set(w, h, 1);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set((bounds.minX + bounds.maxX) / 2, -0.7, (bounds.minZ + bounds.maxZ) / 2);
  sea.material.normalMap.repeat.set(w / 24, h / 24);
  sea.receiveShadow = true;
  // The sea writes no depth and draws right after the sky, so land, sea walls
  // and roads always cover it (no depth fighting with the ground at a distance).
  sea.material.depthWrite = false;
  sea.renderOrder = -1;
  scene.add(sea);

  return {
    sun,
    update(dt, focus, camera) {
      sky.position.copy(camera.position);
      // Keep the shadow area centred on the player.
      sun.position.copy(focus).addScaledVector(SUN_DIR, 300);
      sun.target.position.copy(focus);
      sea.material.normalMap.offset.x += dt * 0.004;
      sea.material.normalMap.offset.y += dt * 0.0025;
    },
  };
}

/** Tileable ripple normal map from a few summed sine waves. */
function waveNormals() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const img = g.createImageData(S, S);
  const waves = [[3, 1, 0.0], [1, 4, 1.3], [5, -2, 2.1], [-4, 3, 0.7], [7, 5, 4.0], [-9, 6, 2.9]];
  const height = (x, y) => {
    let h = 0;
    for (const [a, b, p] of waves) h += Math.sin(((a * x + b * y) / S) * Math.PI * 2 + p) / Math.hypot(a, b);
    return h;
  };
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = height(x + 1, y) - height(x - 1, y);
      const dy = height(x, y + 1) - height(x, y - 1);
      const n = new THREE.Vector3(-dx * 6, -dy * 6, 1).normalize();
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
