// Facade rules shared by the tile worker (3D parts) and the facade shader (painted parts),
// so a window that gets a balcony, an AC unit or a grille gets it in both places.
// The hash uses 32-bit integer maths, which gives identical results in JavaScript and GLSL.

export const STYLE = { PLASTER: 0, WEATHERED: 1, DECO: 2, STONE: 3, BASALT: 4, CONCRETE: 5, GLASS: 6, SHED: 7, BRICK: 8 };
export const BAY = [3.3, 3.0, 3.4, 3.7, 3.7, 3.4, 1.6, 4.0, 3.2]; // metres per window column
export const SHOP_STOREY = 4.3;                                     // ground floor height with shops

/** Window rectangle inside one bay × storey cell: [x0, x1, y0, y1] (0..1). */
export const WINDOW_RECT = [
  [0.24, 0.76, 0.30, 0.80], [0.27, 0.73, 0.32, 0.79], [0.10, 0.90, 0.34, 0.74], [0.30, 0.70, 0.18, 0.84],
  [0.30, 0.70, 0.18, 0.84], [0.14, 0.86, 0.30, 0.80], [0.03, 0.97, 0.10, 0.94], [0.30, 0.70, 0.35, 0.75], [0.30, 0.70, 0.35, 0.75],
];

// Hash channels (k) used for each decision.
export const K = { BALCONY: 1, AC: 2, GRILLE: 3, CURTAIN: 4, LIT: 5, ROOM: 6, DEPTH: 7, SIGN: 8, OPEN: 9, SHUTTER: 10 };

export function cellHash(col, row, seed, k) {
  let h = Math.imul(col | 0, 0x27d4eb2d) ^ Math.imul(row | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul(k | 0, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

export const CELL_HASH_GLSL = `
  float cellHash(int col, int row, int seed, int k) {
    uint h = (uint(col) * 0x27d4eb2du) ^ (uint(row) * 0x165667b1u) ^ (uint(seed) * 0x9e3779b1u) ^ (uint(k) * 0x85ebca6bu);
    h = (h ^ (h >> 15u)) * 0x2c1b3c6du;
    h = (h ^ (h >> 12u)) * 0x297a2d39u;
    h ^= h >> 15u;
    return float(h) / 4294967296.0;
  }`;

/** Which features a window cell has. Styles: balconies on plaster/weathered/concrete, AC units, grilles on chawls. */
export function cellFeatures(style, col, row, seed) {
  const balcony = (style === STYLE.PLASTER || style === STYLE.WEATHERED || style === STYLE.CONCRETE) && cellHash(col, row, seed, K.BALCONY) < 0.22;
  const acStyle = style <= STYLE.DECO || style === STYLE.CONCRETE;
  return {
    balcony,
    ac: !balcony && acStyle && cellHash(col, row, seed, K.AC) < 0.38,
    grille: !balcony && (style === STYLE.WEATHERED || ((style === STYLE.PLASTER || style === STYLE.CONCRETE) && cellHash(col, row, seed, K.GRILLE) < 0.25)),
  };
}

export const FEATURES_GLSL = `
  // Same rules as cellFeatures() in facadeRules.js.
  bool isBalcony(int st, int col, int row, int seed) { return (st == 0 || st == 1 || st == 5) && cellHash(col, row, seed, ${K.BALCONY}) < 0.22; }
  bool hasAC(int st, int col, int row, int seed) { return (st <= 2 || st == 5) && cellHash(col, row, seed, ${K.AC}) < 0.38; }
  bool hasGrille(int st, int col, int row, int seed) { return st == 1 || ((st == 0 || st == 5) && cellHash(col, row, seed, ${K.GRILLE}) < 0.25); }
`;
