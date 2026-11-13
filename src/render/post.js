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

export function createPost(renderer, scene, camera, tier) {
  if (!tier.ao && !tier.bloom) {
    return { render: () => renderer.render(scene, camera), setSize() {} };
  }
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const opts = { type: THREE.HalfFloatType, samples: tier.msaa };
  if (tier.ao) opts.depthTexture = new THREE.DepthTexture(size.x, size.y);
  const target = new THREE.WebGLRenderTarget(size.x, size.y, opts);
  const composer = new EffectComposer(renderer, target);
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
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.28, 0.55, 1.6));
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
