// Graphics quality tiers. Chosen automatically (phones start lower), changeable with
// the Graphics button or the Q key; the choice is remembered in this browser.

export const TIERS = {
  high: {
    name: 'High', pixelRatio: 1.5, msaa: 4, ao: true, bloom: true, normalMaps: true,
    shadowMapSize: 4096, shadowRange: 120, anisotropy: 16, trees: 1, detailRadius: 350, partsRadius: 150, loadRadius: 800,
  },
  medium: {
    name: 'Medium', pixelRatio: 1, msaa: 4, ao: false, bloom: true, normalMaps: true,
    shadowMapSize: 2048, shadowRange: 90, anisotropy: 8, trees: 0.8, detailRadius: 220, partsRadius: 70, loadRadius: 650,
  },
  low: {
    name: 'Low', pixelRatio: 1, msaa: 0, ao: false, bloom: false, normalMaps: false,
    shadowMapSize: 1024, shadowRange: 60, anisotropy: 8, trees: 0.5, detailRadius: 150, partsRadius: 45, loadRadius: 520,
  },
};
const ORDER = ['high', 'medium', 'low'];
const KEY = 'gtb.quality';

function stored() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

/**
 * First run: Medium on any desktop with a real WebGL 2 graphics chip (integrated Intel Iris
 * Xe and AMD chips included — they manage Medium), Low on phones and tablets and with
 * software rendering. The frame rate is watched in-game: the resolution drops when it
 * struggles (main.js), and if even that is not enough the game falls back to Low
 * (TierProbe below), so a generous guess is safe.
 */
export function detectTier() {
  try {
    const ua = navigator.userAgent;
    if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return 'low';
    if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return 'low'; // iPad in desktop mode
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return 'low';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    if (/SwiftShader|llvmpipe|softpipe|Software|Basic Render|Microsoft Basic/i.test(gpu)) return 'low';
    return 'medium';
  } catch { return 'low'; }
}

// Did the player pick the graphics tier themselves? (Q, the Graphics link, the phone, or a
// Graphics menu in the title or pause screen.) Then the automatic fallback leaves it alone.
const CHOSEN = 'gtb.tierChosen';
export function markTierChosen() { try { localStorage.setItem(CHOSEN, '1'); } catch { /* private mode */ } }
function tierChosen() { try { return localStorage.getItem(CHOSEN) === '1'; } catch { return true; } }
addEventListener('change', (e) => { if (e.target?.matches?.('select[data-s="tier"]')) markTierChosen(); }, true);

/**
 * In the first minutes of play on an automatically chosen tier above Low: if the frame rate
 * stays under 40 fps for 10 s even at the lowest dynamic resolution (scale 0.6), switch to
 * Low (saved). Off under automation, with ?quality=, and once the player chose a tier.
 */
export class TierProbe {
  constructor(tierKey) {
    this.on = tierKey !== 'low' && !navigator.webdriver && !query.has('quality') && !tierChosen();
    this.t = 0; this.acc = 0; this.frames = 0;
  }
  /** Call once per drawn frame with its real duration; returns true once: fall back to Low. */
  update(dt, scale) {
    if (!this.on) return false;
    this.t += dt;
    if (this.t > 150) { this.on = false; return false; }
    if (this.t < 4 || scale > 0.61) { this.acc = 0; this.frames = 0; return false; } // let the resolution settle first
    this.acc += dt; this.frames++;
    if (this.acc < 10) return false;
    this.on = false;
    return this.frames / this.acc < 40;
  }
}

/** The saved choice, or a guess from the hardware on the first run. */
export function pickTier() {
  const saved = stored();
  if (saved && TIERS[saved]) return saved;
  return detectTier();
}

/** Move to the next tier and reload (simplest way to rebuild every buffer and material). */
export function cycleTier(current) {
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
  try { localStorage.setItem(KEY, next); } catch { /* private mode: just reload */ }
  location.reload();
}

export const query = new URLSearchParams(location.search);
