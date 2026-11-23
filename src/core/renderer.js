// Renderer: Three.js WebGPU renderer (WebGL 2 fallback built in), quality tiers and the
// post-processing chain, all from Three.js' own TSL nodes:
//   scene pass (colour + normals + metalness/roughness + motion vectors in one go)
//   → ambient occlusion (GTAO: soft contact shadows in corners, under cars and kerbs)
//   → screen-space reflections (wet asphalt, glass, car paint mirror the street)
//   → bloom (from a clamped copy: the sky photo's sun would wash the screen white)
//   → temporal anti-aliasing (TRAA: smooth edges without shimmer on thin lines and leaves)
//   → tone mapping and output.
import * as THREE from 'three/webgpu';
import {
  pass, mrt, output, normalView, velocity, metalness, roughness, vec2, vec4, packNormalToRGB, unpackRGBToNormal,
  sample, renderOutput, mix, vec3,
} from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { ssr } from 'three/addons/tsl/display/SSRNode.js';
import { traa } from 'three/addons/tsl/display/TRAANode.js';

export const TIERS = {
  // cascades: cascaded shadow maps (0 = one shadow box following the player of ±shadowBox m);
  // shadowFar: how far the cascades reach; shadow: map size per cascade.
  high: { name: 'High', scale: 1.0, maxPixelRatio: 2, taa: true, ao: true, ssr: false, bloom: true, shadow: 2048, cascades: 4, shadowFar: 450, shadowBox: 90, drawDistance: 800 },
  medium: { name: 'Medium', scale: 0.85, maxPixelRatio: 1.5, taa: true, ao: false, ssr: false, bloom: true, shadow: 2048, cascades: 3, shadowFar: 250, shadowBox: 70, drawDistance: 600 },
  low: { name: 'Low', scale: 0.75, maxPixelRatio: 1, taa: false, ao: false, ssr: false, bloom: false, shadow: 1024, cascades: 0, shadowFar: 0, shadowBox: 45, drawDistance: 400 },
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
  const params = new URLSearchParams(location.search);
  let fellBack = false;
  try { fellBack = sessionStorage.getItem('gtb.webgl') === '1'; } catch { /* */ }
  const forceWebGL = params.has('webgl') || fellBack;
  // Effects can be switched off one by one for comparisons: ?noao&notaa&nobloom. Screen-space
  // reflections are off by default (dark smudges on some surfaces in tests; wanted for wet roads
  // in the monsoon work): ?ssr turns them on.
  for (const k of ['ao', 'ssr', 'taa', 'bloom']) if (params.has(`no${k}`)) tier[k] = false;
  if (params.has('ssr')) tier.ssr = true;
  const renderer = new THREE.WebGPURenderer({ antialias: !tier.taa, forceWebGL, powerPreference: 'high-performance' });
  await renderer.init();
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);
  renderer.domElement.id = 'view';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 3000);
  // See-through effects (smoke, dust, sparks) get their own pass, drawn over the scene after
  // ambient occlusion; they hide behind walls by comparing with the scene's depth (soft particles).
  const fxScene = new THREE.Scene();
  renderer.setClearColor(0x000000, 0);

  let pipeline = null;
  const effects = {};
  if (tier.taa || tier.bloom || tier.ao || tier.ssr) {
    pipeline = new THREE.RenderPipeline(renderer);
    const scenePass = pass(scene, camera, { samples: tier.taa ? 0 : 4 });
    const targets = { output };
    if (tier.ao || tier.ssr) targets.normal = packNormalToRGB(normalView);
    if (tier.ssr) targets.metalrough = vec2(metalness, roughness);
    if (tier.taa) targets.velocity = velocity;
    scenePass.setMRT(mrt(targets));
    effects.targets = Object.keys(targets);
    const color = scenePass.getTextureNode('output');
    const depth = scenePass.getTextureNode('depth');
    let node = color;
    if (tier.ao || tier.ssr) {
      const normalTex = scenePass.getTextureNode('normal');
      const normal = sample((uv) => unpackRGBToNormal(normalTex.sample(uv)));
      if (tier.ao) {
        const a = (effects.ao = ao(depth, normal, camera));
        a.resolutionScale = 0.5;
        a.radius.value = 0.6;
        a.distanceExponent.value = 1.5;
        node = vec4(node.rgb.mul(a.getTextureNode().r), node.a);
      }
      if (tier.ssr) {
        const mr = scenePass.getTextureNode('metalrough');
        const r = (effects.ssr = ssr(color, depth, normal, { metalnessNode: mr.r, roughnessNode: mr.g, reflectNonMetals: true, camera }));
        r.resolutionScale = 0.5;
        r.maxDistance.value = 40;
        r.thickness.value = 0.35;
        // Only smooth surfaces mirror (glass, car paint, wet patches); rough asphalt and plaster don't.
        const smooth = mr.g.oneMinus().pow(4).mul(r.a).clamp(0, 1);
        node = vec4(mix(node.rgb, r.rgb.min(vec3(4)), smooth), node.a);
      }
    }
    effects.sceneDepth = depth;
    const fx = pass(fxScene, camera).getTextureNode('output');
    node = vec4(node.rgb.mul(fx.a.oneMinus()).add(fx.rgb), node.a);
    if (tier.bloom) node = node.add(bloom(node.min(vec4(4, 4, 4, 1)), 0.16, 0.35, 0.95));
    if (tier.taa) node = (effects.taa = traa(node, depth, scenePass.getTextureNode('velocity'), camera));
    pipeline.outputColorTransform = false;
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

  if (!pipeline) scene.add(fxScene); // Low: no post-processing, effects draw with the scene
  return {
    THREE, renderer, scene, camera, tier, backend, effects, fxScene,
    render() { if (pipeline) pipeline.render(); else renderer.render(scene, camera); },
    resize,
  };
}
