import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// Frame pipeline: scene → ambient occlusion (soft contact shadows, from depth only)
// → bloom (sun glare, glints) → film-style tone mapping → gentle colour grade.
// The low tier skips all of it and renders straight to the screen.

const GradeShader = {
  name: 'GradeShader',
  uniforms: { tDiffuse: { value: null }, vignette: { value: 0.22 }, warmth: { value: 0.035 }, saturation: { value: 1.08 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float vignette, warmth, saturation; varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, saturation);
      c.rgb += vec3(warmth, warmth * 0.35, -warmth * 0.6) * (1.0 - l);
      vec2 d = vUv - 0.5;
      c.rgb *= 1.0 - vignette * dot(d, d) * 2.2;
      gl_FragColor = c;
    }`,
};

// Low tier: no post-processing, so the grade is done by the browser's compositor instead —
// no extra render pass: a backdrop colour filter (saturation), a faint warm wash (lifts the
// shadows towards orange like the GradeShader's `warmth`) and a vignette, on one overlay.
// Tuned against Medium's GradeShader with screenshots.
const LOW_FILTER = 'saturate(1.12) sepia(0.04)';
const LOW_TINT = 'rgba(255, 150, 70, 0.04)';
// Medium's vignette darkens by 0.22 · 2.2 · d² (d = distance from the centre in screen
// units): about 12 % at the edge midpoints and 24 % in the corners. The same curve as stops.
const LOW_VIGNETTE = [[0, 0], [0.25, 0.015], [0.5, 0.06], [0.75, 0.135], [1, 0.24]];

function cssGrade() {
  const v = document.createElement('div');
  v.id = 'grade';
  // First in the page and positioned: painted over the canvas (which is not positioned) and
  // under every heads-up display element that comes later in the page. A filter on the
  // canvas itself would lift it over the HUD elements that have no z-index (clock, radar).
  const vignette = `radial-gradient(ellipse farthest-corner at 50% 50%, ${LOW_VIGNETTE.map(([at, a]) => `rgba(0,0,0,${a}) ${at * 100}%`).join(', ')})`;
  v.style.cssText = `position:fixed;inset:0;pointer-events:none;background:${vignette}, linear-gradient(${LOW_TINT}, ${LOW_TINT});-webkit-backdrop-filter:${LOW_FILTER};backdrop-filter:${LOW_FILTER}`;
  document.body.prepend(v);
  return { filter: LOW_FILTER, tint: LOW_TINT, vignette: LOW_VIGNETTE };
}

export function createPost(renderer, scene, camera, tier) {
  if (!tier.ao && !tier.bloom) {
    // `grade` lets photo mode apply the same look to saved pictures (render/photo.js).
    return { render: () => renderer.render(scene, camera), setSize() {}, grade: cssGrade() };
  }
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const opts = { type: THREE.HalfFloatType, samples: tier.msaa };
  if (tier.ao) opts.depthTexture = new THREE.DepthTexture(size.x, size.y);
  const target = new THREE.WebGLRenderTarget(size.x, size.y, opts);
  const composer = new EffectComposer(renderer, target);
  // Sizes given to the composer are already drawing-buffer pixels (main.js passes
  // getDrawingBufferSize). Left at the renderer's pixel ratio (1.5 on High) it would multiply
  // again: up to 2.25× the pixels for every pass. Set before the first addPass (which sizes it).
  composer.setPixelRatio(1);
  composer.addPass(new RenderPass(scene, camera));

  let gtao = null;
  if (tier.ao) {
    gtao = new GTAOPass(scene, camera, size.x, size.y, { depthTexture: composer.readBuffer.depthTexture });
    gtao.updateGtaoMaterial({ radius: 1.6, distanceExponent: 1.4, thickness: 2.5, scale: 1.0, samples: 12, distanceFallOff: 1 });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    gtao.blendIntensity = 0.9;
    composer.addPass(gtao);
  }
  if (tier.bloom) {
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.22, 0.35, 3.2));
  }
  composer.addPass(new OutputPass());
  composer.addPass(new ShaderPass(GradeShader));

  return {
    composer,
    render() {
      // The scene pass alternates between the composer's two buffers; point the
      // ambient-occlusion pass at whichever depth texture this frame writes.
      if (gtao) {
        const depth = composer.readBuffer.depthTexture;
        gtao.gtaoMaterial.uniforms.tDepth.value = depth;
        gtao.pdMaterial.uniforms.tDepth.value = depth;
        gtao.depthTexture = depth;
      }
      composer.render();
    },
    setSize(w, h) { composer.setSize(w, h); },
  };
}
