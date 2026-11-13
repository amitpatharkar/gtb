import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';

// The KTX2 texture loader needs the Basis Universal transcoder (JavaScript + WebAssembly)
// next to the game. Copy the copy that ships with three.js, so versions always match.
function copyBasisTranscoder() {
  return {
    name: 'copy-basis-transcoder',
    buildStart() {
      const src = 'node_modules/three/examples/jsm/libs/basis';
      const dst = 'public/basis';
      fs.mkdirSync(dst, { recursive: true });
      for (const f of ['basis_transcoder.js', 'basis_transcoder.wasm']) fs.copyFileSync(path.join(src, f), path.join(dst, f));
    },
  };
}

// "base" must match the repository name so GitHub Pages serves assets correctly.
export default defineConfig({
  base: '/gtb/',
  plugins: [copyBasisTranscoder()],
  build: { chunkSizeWarningLimit: 1200 },
});
