// Facade rules shared by the tile worker (3D parts) and the facade shader (painted parts),
// so a window that gets a balcony, an AC unit, a box grille or a drain pipe gets it in both
// places. The hash uses 32-bit integer maths, which gives identical results in JavaScript and
// GLSL. Every rule below has a GLSL twin in FEATURES_GLSL: change both together.
import { FACADE } from './tileFormat.js';

export { FACADE };
export const STYLE = { PLASTER: 0, WEATHERED: 1, DECO: 2, STONE: 3, BASALT: 4, CONCRETE: 5, GLASS: 6, SHED: 7, BRICK: 8 };
export const BAY = [3.3, 3.0, 3.4, 3.7, 3.7, 3.4, 1.6, 4.0, 3.2]; // metres per window column
export const SHOP_STOREY = 4.3;                                     // ground floor height with shops

/** Window rectangle inside one bay × storey cell: [x0, x1, y0, y1] (0..1). */
export const WINDOW_RECT = [
  [0.24, 0.76, 0.30, 0.80], [0.27, 0.73, 0.32, 0.79], [0.10, 0.90, 0.34, 0.74], [0.30, 0.70, 0.18, 0.84],
  [0.30, 0.70, 0.18, 0.84], [0.14, 0.86, 0.30, 0.80], [0.03, 0.97, 0.10, 0.94], [0.30, 0.70, 0.35, 0.75], [0.30, 0.70, 0.35, 0.75],
];

/**
 * Window types. PLAIN: white casement with a mullion · SLIDER: aluminium sliding panes ·
 * CASEMENT: old wooden casement with small panes and a fanlight · LOUVRE: wooden louvred
 * shutters (closed, open flat against the wall, or one leaf open) · DECO: steel window with
 * horizontal glazing bars · ARCH: Gothic pointed arch · ROUND: round-headed arch ·
 * PORTHOLE: round Art Deco stair window.
 */
export const WIN = { PLAIN: 0, SLIDER: 1, CASEMENT: 2, LOUVRE: 3, DECO: 4, ARCH: 5, ROUND: 6, PORTHOLE: 7 };
/** Louvre states (K.STATE): both leaves shut, both folded open against the wall, left shut + right open. */
export const LOUVRE = { SHUT: 0, OPEN: 1, HALF: 2 };
export const ARCH_SPRING = 0.62; // arched windows: the arch starts at this fraction of the opening's height
export const PIPE_X = 0.16;      // drain pipes run 0.16 m right of a bay line
export const AC_SIZE = [0.82, 0.55]; // outdoor AC unit, metres

/**
 * What a wall quad shows (facadeB.x; + CODE.TALL_GF when the ground floor is a shop storey):
 * WINDOWS window grid · SHOPS shopfronts below, windows above · BLANK plain wall · GALLERY chawl
 * corridor wall with doors · RAILING chawl gallery railing (with a fake view into the gallery) ·
 * TILES clay-tile or slate roof slope (vertex colour = roof colour) · GABLE gable end with a round
 * window · PLAQUE Art Deco name plaque.
 */
export const CODE = { WINDOWS: 0, SHOPS: 1, BLANK: 2, GALLERY: 3, RAILING: 4, TILES: 5, GABLE: 6, PLAQUE: 7, TALL_GF: 0.25 };
/** 3D facade parts (mesh/buildings.js → facadeParts.js): floats per instance (x, y, z, yaw, width, height, colour, variant). */
export const PART_FLOATS = 8;
/** 3D window parts (facadeParts.js): frame variants and shutter/arch variants (instance attribute). */
export const FRAME = { PLAIN: 0, SLIDER: 1, CASEMENT: 2, DECO: 3 };
export const SHUTTER = { SHUT: 0, OPEN: 1, HALF: 2 };
export const ARCHV = { POINTED: 0, ROUND: 1 };

// Paint colours shared by the 3D parts and the shader (building-wide pick with K.TINT).
export const WOOD_PAINT = [0x3f5a46, 0x4e3626, 0x2f6670, 0xd9d4c4, 0x3d5a80, 0x6e2e2a, 0x55704a, 0x2e4a3c];
export const ALU = [0xb9bcbe, 0xc9c6bd, 0x6b5a48, 0xe6e6e0];
export const STEEL = [0x2f3230, 0x34433a, 0x5e4a38, 0x3c3f46];
export const STONE_TRIM = [0xd9cba9, 0xcdbb94, 0x5b5852];
export const pick = (list, seed, k = K.TINT) => list[Math.floor(cellHash(-9, -9, seed, k) * list.length)];

// Hash channels (k) used for each decision. Building-wide picks use cell (-9, -9).
export const K = {
  BALCONY: 1, AC: 2, GRILLE: 3, CURTAIN: 4, LIT: 5, ROOM: 6, DEPTH: 7, SIGN: 8, OPEN: 9, SHUTTER: 10,
  KIND: 50, SWAP: 51, CAGE: 52, ENCLOSE: 53, PIPE: 54, STATE: 55, PATCH: 56, TINT: 57, DOOR: 58, CLOTHES: 59,
  FURN: 60, PORT: 61, PLAQUE: 62, LANCET: 63, DRAPE: 64, EYEBROW: 65, SLIDE: 66, STAIN: 67, GABLE: 68, ROOF: 69,
};

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

const { PLASTER, WEATHERED, DECO, STONE, BASALT, CONCRETE } = STYLE;
const painted = (st) => st === PLASTER || st === WEATHERED || st === CONCRETE;

/** Share of bay lines with a drain pipe, by facade kind. */
export const PIPE_SHARE = [0.11, 0.16, 0.08, 0.06, 0.2];
/** A drain pipe runs down the left side of window column `col` (PIPE_X right of its bay line). */
export function pipeAt(fk, col, seed) { return cellHash(col, -5, seed, K.PIPE) < PIPE_SHARE[fk]; }

/** The window type of one cell: the building's original windows; some flats changed theirs. */
export function windowKind(st, fk, col, row, seed) {
  if (st === STONE || st === BASALT) return fk === FACADE.GOTHIC ? WIN.ARCH : WIN.ROUND;
  const swap = cellHash(col, row, seed, K.SWAP) < (fk === FACADE.MODERN ? 0.12 : 0.25);
  if (st === DECO) {
    if (fk !== FACADE.DECO) return WIN.SLIDER;
    if (cellHash(-9, -9, seed, K.PORT) < 0.45 && col === 1 + Math.floor(cellHash(-8, -8, seed, K.PORT) * 3)) return WIN.PORTHOLE;
    return swap ? WIN.SLIDER : WIN.DECO;
  }
  const b = cellHash(-9, -9, seed, K.KIND);
  if (fk === FACADE.OLD || fk === FACADE.CHAWL) return swap ? WIN.SLIDER : b < 0.5 ? WIN.CASEMENT : WIN.LOUVRE;
  if (b < 0.18) return swap ? WIN.SLIDER : WIN.PLAIN;
  return swap ? WIN.PLAIN : WIN.SLIDER;
}

/** Window rectangle for a style and window type: old wooden windows are narrow and tall. */
export function windowRect(st, kind) {
  const r = WINDOW_RECT[st];
  if ((kind === WIN.CASEMENT || kind === WIN.LOUVRE) && painted(st)) return [0.31, 0.69, 0.22, 0.82];
  if (kind === WIN.SLIDER && painted(st)) return [r[0] - 0.04, r[1] + 0.04, r[2], r[3]];
  return r;
}

/** Centre of the outdoor AC unit in cell units [x, y]: beside the window, or under it if there is no room. */
export function acCentre(r, bw, storey) {
  const hx = AC_SIZE[0] / 2 / bw;
  const cx = r[1] + 0.05 + hx;
  if (cx + hx < 0.97) return [cx, 0.425];
  return [(r[0] + r[1]) / 2 + (r[1] - r[0]) * 0.22, r[2] - (0.05 + AC_SIZE[1] / 2) / storey];
}

/**
 * Which features a window cell has. balcony: recessed open balcony · enclosed: a balcony closed
 * in with aluminium and glass, projecting · cage: box grille in front of the window · grille:
 * flat bars on the window · ac: outdoor AC unit · state: louvre state · open: slider/casement
 * pane open. fk: facade kind (FACADE).
 */
export function cellFeatures(st, fk, col, row, seed) {
  const kind = windowKind(st, fk, col, row, seed);
  const balconyCell = painted(st) && fk !== FACADE.CHAWL && cellHash(col, row, seed, K.BALCONY) < 0.22;
  const enclosed = balconyCell && fk === FACADE.MODERN && cellHash(col, row, seed, K.ENCLOSE) < 0.5;
  const cage = !balconyCell && (kind === WIN.SLIDER || kind === WIN.PLAIN) && cellHash(col, row, seed, K.CAGE) < (fk === FACADE.MODERN ? 0.3 : 0.14);
  const grille = !balconyCell && !cage && (kind === WIN.PLAIN || kind === WIN.SLIDER || kind === WIN.CASEMENT)
    && (st === WEATHERED || ((st === PLASTER || st === CONCRETE) && cellHash(col, row, seed, K.GRILLE) < 0.12));
  const ac = !balconyCell && kind !== WIN.LOUVRE && kind !== WIN.PORTHOLE && (st <= DECO || st === CONCRETE)
    && cellHash(col, row, seed, K.AC) < (fk === FACADE.MODERN ? 0.38 : 0.24) && !pipeAt(fk, col + 1, seed);
  const s = cellHash(col, row, seed, K.STATE);
  return {
    kind, balcony: balconyCell && !enclosed, enclosed, cage, grille, ac,
    state: s < 0.45 ? LOUVRE.SHUT : s < 0.78 ? LOUVRE.OPEN : LOUVRE.HALF,
    open: cellHash(col, row, seed, K.SLIDE) < 0.35,
  };
}

const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const vec3 = (hex) => `vec3(${[16, 8, 0].map((sh) => lin(((hex >> sh) & 255) / 255).toFixed(4)).join(', ')})`;
/** GLSL function returning entry floor(h × n) of a hex palette (linear colours, like three.js vertex colours). */
const paletteGLSL = (name, list) => `vec3 ${name}(float h) { int i = int(floor(h * ${list.length}.0));
    ${list.map((c, i) => `if (i == ${i}) return ${vec3(c)};`).join(' ')} return ${vec3(list[0])}; }`;

/**
 * Building-wide hashes, computed once per vertex (flat varyings, the same for the whole building):
 * vBuildingA = (TINT, KIND, PORT, PORT at -8), vBuildingB = (LANCET, DRAPE, PLAQUE, PIPE).
 */
export const BUILDING_HASH_GLSL = `
    vBuildingA = vec4(cellHash(-9, -9, seed, ${K.TINT}), cellHash(-9, -9, seed, ${K.KIND}), cellHash(-9, -9, seed, ${K.PORT}), cellHash(-8, -8, seed, ${K.PORT}));
    vBuildingB = vec4(cellHash(-9, -9, seed, ${K.LANCET}), cellHash(-9, -9, seed, ${K.DRAPE}), cellHash(-9, -9, seed, ${K.PLAQUE}), cellHash(-9, -9, seed, ${K.PIPE}));`;

export const FEATURES_GLSL = `
  ${paletteGLSL('woodPaint', WOOD_PAINT)}
  ${paletteGLSL('aluColour', ALU)}
  ${paletteGLSL('steelColour', STEEL)}
  ${paletteGLSL('stoneTrim', STONE_TRIM)}
  // Same rules as facadeRules.js (windowKind, windowRect, pipeAt, acCentre, cellFeatures).
  bool paintedSt(int st) { return st == 0 || st == 1 || st == 5; }
  float pipeShare(int fk) { return fk == 0 ? ${PIPE_SHARE[0]} : fk == 1 ? ${PIPE_SHARE[1]} : fk == 2 ? ${PIPE_SHARE[2]} : fk == 3 ? ${PIPE_SHARE[3]} : ${PIPE_SHARE[4]}; }
  bool pipeAt(int fk, int col, int seed) { return cellHash(col, -5, seed, ${K.PIPE}) < pipeShare(fk); }
  int windowKind(int st, int fk, int col, int row, int seed) {
    if (st == 3 || st == 4) return fk == 3 ? ${WIN.ARCH} : ${WIN.ROUND};
    bool swap = cellHash(col, row, seed, ${K.SWAP}) < (fk == 0 ? 0.12 : 0.25);
    if (st == 2) {
      if (fk != 2) return ${WIN.SLIDER};
      if (vBuildingA.z < 0.45 && col == 1 + int(floor(vBuildingA.w * 3.0))) return ${WIN.PORTHOLE};
      return swap ? ${WIN.SLIDER} : ${WIN.DECO};
    }
    float b = vBuildingA.y;
    if (fk == 1 || fk == 4) return swap ? ${WIN.SLIDER} : b < 0.5 ? ${WIN.CASEMENT} : ${WIN.LOUVRE};
    if (b < 0.18) return swap ? ${WIN.SLIDER} : ${WIN.PLAIN};
    return swap ? ${WIN.PLAIN} : ${WIN.SLIDER};
  }
  vec4 kindRect(int st, int kind, vec4 r) {
    if ((kind == ${WIN.CASEMENT} || kind == ${WIN.LOUVRE}) && paintedSt(st)) return vec4(0.31, 0.69, 0.22, 0.82);
    if (kind == ${WIN.SLIDER} && paintedSt(st)) return r + vec4(-0.04, 0.04, 0.0, 0.0);
    return r;
  }
  vec2 acCentre(vec4 r, float bw, float storey) {
    float hx = ${(AC_SIZE[0] / 2).toFixed(3)} / bw;
    float cx = r.y + 0.05 + hx;
    if (cx + hx < 0.97) return vec2(cx, 0.425);
    return vec2((r.x + r.y) * 0.5 + (r.y - r.x) * 0.22, r.z - (0.05 + ${(AC_SIZE[1] / 2).toFixed(3)}) / storey);
  }
  bool isBalconyCell(int st, int fk, int col, int row, int seed) { return paintedSt(st) && fk != 4 && cellHash(col, row, seed, ${K.BALCONY}) < 0.22; }
  bool isEnclosed(int st, int fk, int col, int row, int seed) { return isBalconyCell(st, fk, col, row, seed) && fk == 0 && cellHash(col, row, seed, ${K.ENCLOSE}) < 0.5; }
  bool hasCage(int fk, int kind, int col, int row, int seed) { return (kind == ${WIN.SLIDER} || kind == ${WIN.PLAIN}) && cellHash(col, row, seed, ${K.CAGE}) < (fk == 0 ? 0.3 : 0.14); }
  bool hasGrille(int st, int kind, int col, int row, int seed) {
    return (kind == ${WIN.PLAIN} || kind == ${WIN.SLIDER} || kind == ${WIN.CASEMENT}) && (st == 1 || ((st == 0 || st == 5) && cellHash(col, row, seed, ${K.GRILLE}) < 0.12));
  }
  bool hasAC(int st, int fk, int kind, int col, int row, int seed) {
    return kind != ${WIN.LOUVRE} && kind != ${WIN.PORTHOLE} && (st <= 2 || st == 5) && cellHash(col, row, seed, ${K.AC}) < (fk == 0 ? 0.38 : 0.24) && !pipeAt(fk, col + 1, seed);
  }
  int louvreState(int col, int row, int seed) { float s = cellHash(col, row, seed, ${K.STATE}); return s < 0.45 ? 0 : s < 0.78 ? 1 : 2; }
`;
