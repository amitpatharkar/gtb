// Renderer: Three.js WebGPU renderer (WebGL 2 fallback built in), quality tiers and the
// post-processing chain (multisampled scene → bloom → tone mapping → output).
import * as THREE from 'three/webgpu';
import { pass, renderOutput, vec4 } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';

export const TIERS = {
  // shadow: map size and half-extent of the shadow box around the player (metres)
  high: { name: 'High', scale: 1.0, maxPixelRatio: 2, samples: 4, bloom: true, shadow: 4096, shadowBox: 90, drawDistance: 800 },
  medium: { name: 'Medium', scale: 0.85, maxPixelRatio: 1.5, samples: 4, bloom: true, shadow: 2048, shadowBox: 70, drawDistance: 600 },
  low: { name: 'Low', scale: 0.75, maxPixelRatio: 1, samples: 0, bloom: false, shadow: 1024, shadowBox: 45, drawDistance: 400 },
};

export function pickTier() {
  const q = new URLSearchParams(location.search).get('quality');
  if (q && TIERS[q]) return q;
  try { const saved = localStorage.getItem('gtb.quality'); if (saved && TIERS[saved]) return saved; } catch { /* private mode */ }
  const phone = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 900;
  if (phone) return 'low';
  return navigator.gpu ? 'high' : 'medium';
}

export async function createRenderer(container, tierKey) {
  const tier = { key: tierKey, ...TIERS[tierKey] };
  let fellBack = false;
  try { fellBack = sessionStorage.getItem('gtb.webgl') === '1'; } catch { /* */ }
  const forceWebGL = new URLSearchParams(location.search).has('webgl') || fellBack;
  const renderer = new THREE.WebGPURenderer({ antialias: false, forceWebGL, powerPreference: 'high-performance' });
  await renderer.init();
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);
  renderer.domElement.id = 'view';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 3000);

  let pipeline = null;
  if (tier.samples || tier.bloom) {
    pipeline = new THREE.RenderPipeline(renderer);
    pipeline.outputColorTransform = false;
    const scenePass = pass(scene, camera, { samples: tier.samples });
    const color = scenePass.getTextureNode('output');
    let node = color;
    // Bloom from a clamped copy: the sun in the sky photo is thousands of times brighter than
    // anything else and would wash the whole screen white.
    if (tier.bloom) node = color.add(bloom(color.min(vec4(4, 4, 4, 1)), 0.16, 0.35, 0.95));
    pipeline.outputNode = renderOutput(node);
  }

  const backend = renderer.backend?.isWebGPUBackend ? 'WebGPU' : 'WebGL 2';
  // Safety net: if the WebGPU device is lost (driver trouble), reload once on WebGL 2.
  if (renderer.backend?.isWebGPUBackend) {
    renderer.backend.device?.lost.then((info) => {
      if (info.reason === 'destroyed') return;
      console.error('WebGPU device lost, restarting on WebGL 2:', info.message);
      try { sessionStorage.setItem('gtb.webgl', '1'); } catch { /* */ }
      location.reload();
    });
  }
  const resize = () => {
    const w = container.clientWidth || innerWidth, h = container.clientHeight || innerHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio, tier.maxPixelRatio) * tier.scale);
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  addEventListener('resize', resize);
  resize();

  return {
    THREE, renderer, scene, camera, tier, backend,
    render() { if (pipeline) pipeline.render(); else renderer.render(scene, camera); },
    resize,
  };
}
