// Graphics quality tiers. Chosen automatically (phones start lower), changeable with
// the Graphics button or the Q key; the choice is remembered in this browser.

export const TIERS = {
  high: {
    name: 'High', pixelRatio: 1.5, msaa: 4, ao: true, bloom: true, normalMaps: true,
    shadowMapSize: 4096, shadowRange: 120, anisotropy: 8, trees: 1, detailRadius: 350, partsRadius: 150, loadRadius: 800,
  },
  medium: {
    name: 'Medium', pixelRatio: 1, msaa: 4, ao: false, bloom: true, normalMaps: false,
    shadowMapSize: 2048, shadowRange: 90, anisotropy: 4, trees: 0.8, detailRadius: 220, partsRadius: 70, loadRadius: 650,
  },
  low: {
    name: 'Low', pixelRatio: 1, msaa: 0, ao: false, bloom: false, normalMaps: false,
    shadowMapSize: 1024, shadowRange: 60, anisotropy: 8, trees: 0.5, detailRadius: 150, partsRadius: 0, loadRadius: 520,
  },
};
const ORDER = ['high', 'medium', 'low'];
const KEY = 'gtb.quality';

function stored() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

/** Low by default (it runs everywhere); Medium and High only when the player picks them. */
export function pickTier() {
  const saved = stored();
  if (saved && TIERS[saved]) return saved;
  return 'low';
}

/** Move to the next tier and reload (simplest way to rebuild every buffer and material). */
export function cycleTier(current) {
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
  try { localStorage.setItem(KEY, next); } catch { /* private mode: just reload */ }
  location.reload();
}

export const query = new URLSearchParams(location.search);
