// Worker thread: encode one PNG image to KTX2 (Basis Universal) with ktx2-encoder.
// Runs in parallel threads because each encode is single-threaded WebAssembly.
import { parentPort } from 'node:worker_threads';
import sharp from 'sharp';
import { encodeToKTX2 } from 'ktx2-encoder';

const imageDecoder = async (buf) => {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
};

// Presets: colour maps in sRGB (small ETC1S), normal maps as high-quality UASTC with
// Zstandard supercompression, packed occlusion/roughness/metalness maps in linear ETC1S.
const PRESETS = {
  color: { isUASTC: false, qualityLevel: 180, compressionLevel: 2, isPerceptual: true, isSetKTX2SRGBTransferFunc: true },
  data: { isUASTC: false, qualityLevel: 200, compressionLevel: 2, isPerceptual: false, isSetKTX2SRGBTransferFunc: false },
  normal: {
    isUASTC: true, needSupercompression: true, enableRDO: true, rdoQualityLevel: 1, uastcLDRQualityLevel: 1,
    isNormalMap: true, isPerceptual: false, isSetKTX2SRGBTransferFunc: false,
  },
};

parentPort.on('message', async ({ id, png, preset }) => {
  try {
    const out = await encodeToKTX2(new Uint8Array(png), {
      ...PRESETS[preset], generateMipmap: true, isKTX2File: true, enableDebug: false, imageDecoder,
    });
    const copy = out.slice(); // detach from the encoder's memory before transferring
    parentPort.postMessage({ id, ktx2: copy }, [copy.buffer]);
  } catch (err) {
    parentPort.postMessage({ id, error: String(err?.stack || err) });
  }
});
