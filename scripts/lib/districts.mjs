// District "block guides" from docs/research/mumbai-guide.md (section A1): which building
// styles, wall colours, tree density and shop density each area of South Mumbai has.
// Boxes are [south, west, north, east]; the smallest box containing a point wins.

export const STYLE = { PLASTER: 0, WEATHERED: 1, DECO: 2, STONE: 3, BASALT: 4, CONCRETE: 5, GLASS: 6, SHED: 7, BRICK: 8 };

const D = (name, bbox, styles, colours, trees, shops, extra = {}) => ({ name, bbox, styles, colours, trees, shops, ...extra });

const LIST = [
  D('Apollo Bunder', [18.918, 72.830, 18.926, 72.838], { STONE: 3, PLASTER: 4, DECO: 2, CONCRETE: 1 }, ['#D8B98A', '#C9A06B', '#E9E2D3', '#E8DCC0'], 0.6, 0.6),
  D('Kala Ghoda', [18.925, 72.829, 18.931, 72.835], { STONE: 5, BASALT: 2, PLASTER: 3 }, ['#D7C29A', '#E8DFCC', '#C9B48A', '#E1D5BF'], 0.8, 0.7),
  D('Nariman Point', [18.920, 72.818, 18.930, 72.826], { CONCRETE: 4, GLASS: 4, PLASTER: 2 }, ['#D6D2C8', '#B9B4A9', '#8C8F91', '#C7A66E'], 0.5, 0.2),
  D('Chowpatty', [18.951, 72.810, 18.958, 72.818], { PLASTER: 5, DECO: 2, WEATHERED: 3 }, ['#EFE6D2', '#E0C9A0', '#F3EFE6', '#E3C6A6'], 0.4, 0.6, { palms: true }),
  D('Crawford Market', [18.945, 72.832, 18.951, 72.838], { WEATHERED: 5, STONE: 2, PLASTER: 3 }, ['#C5A97C', '#D9CBB0', '#B2552F', '#E5DDCB'], 0.2, 0.95),
  D('Dhobi Talao', [18.940, 72.827, 18.947, 72.834], { WEATHERED: 4, PLASTER: 4, DECO: 2 }, ['#E4D6B8', '#C9A979', '#A7C4C0', '#D58B6A', '#F0EBDF'], 0.4, 0.85),
  D('Churchgate', [18.929, 72.822, 18.938, 72.830], { DECO: 6, PLASTER: 2, STONE: 2 }, ['#EDE3CD', '#D9C6A0', '#F3EFE6', '#7FA39A', '#E3C6A6'], 0.7, 0.5),
  D('CST', [18.937, 72.832, 18.945, 72.840], { STONE: 5, BASALT: 2, PLASTER: 3 }, ['#CFB487', '#E9E2D2', '#D9C9A3'], 0.4, 0.7),
  D('Ballard Estate', [18.934, 72.838, 18.944, 72.845], { STONE: 7, PLASTER: 3 }, ['#CBB99A', '#BCA98A', '#E1D5BF'], 0.6, 0.3),
  D('Fort', [18.928, 72.830, 18.940, 72.840], { STONE: 4, BASALT: 1, PLASTER: 3, WEATHERED: 2 }, ['#CDB58A', '#DCC9A6', '#E7E0D0', '#D9C9A3'], 0.6, 0.8),
  D('Kalbadevi', [18.947, 72.824, 18.957, 72.836], { WEATHERED: 6, PLASTER: 4 }, ['#E3C58E', '#B9D2C7', '#E7A57D', '#F2ECD9', '#D8CBB3'], 0.15, 0.95),
  D('Girgaon', [18.950, 72.812, 18.960, 72.826], { WEATHERED: 6, PLASTER: 4 }, ['#F2D16B', '#8FBF9F', '#6CA0C8', '#E58F7C', '#F5F1E6'], 0.3, 0.7),
  D('Grant Road', [18.958, 72.812, 18.968, 72.825], { WEATHERED: 4, PLASTER: 4, CONCRETE: 2 }, ['#D8CBB3', '#BFB09A', '#9AA6A0', '#D9A066', '#EDE7DA'], 0.35, 0.8),
  D('Tardeo', [18.965, 72.808, 18.975, 72.820], { CONCRETE: 4, PLASTER: 4, GLASS: 2 }, ['#CFC9BC', '#A8A39A', '#E6E1D5', '#B7A07A'], 0.4, 0.6),
  D('Cuffe Parade', [18.905, 72.812, 18.920, 72.826], { CONCRETE: 5, PLASTER: 3, GLASS: 2 }, ['#E6E1D6', '#CFC7B8', '#9FA4A8', '#DDD5C6'], 0.5, 0.3),
  D('Mazgaon', [18.955, 72.840, 18.975, 72.852], { WEATHERED: 4, PLASTER: 3, SHED: 3 }, ['#E1D3B6', '#A9B7A9', '#C9785A', '#F2EEE4'], 0.4, 0.5),
  D('Byculla', [18.965, 72.828, 18.985, 72.842], { WEATHERED: 5, PLASTER: 3, CONCRETE: 2 }, ['#D9C7A1', '#C08A5C', '#E5DDCB', '#8E9C8D'], 0.4, 0.7),
  D('Marine Drive', [18.928, 72.818, 18.955, 72.826], { DECO: 8, PLASTER: 2 }, ['#F2EAD8', '#E7D7B6', '#E3C6A6', '#D6DDD9', '#CBB596'], 0.5, 0.15, { palms: true }),
  D('Malabar Hill', [18.940, 72.792, 18.965, 72.812], { CONCRETE: 4, PLASTER: 5, GLASS: 1 }, ['#F3F0E8', '#DDD5C6', '#B9B3A6', '#E8E0CF'], 0.9, 0.2),
  D('Colaba', [18.895, 72.805, 18.925, 72.835], { PLASTER: 5, WEATHERED: 3, DECO: 2 }, ['#E8DCC0', '#D9C9A3', '#C9B48A', '#F1EDE4', '#B8B1A3'], 0.6, 0.7),
];
const DEFAULT = D('Mumbai', null, { PLASTER: 6, WEATHERED: 3, CONCRETE: 1 },
  ['#EEE6D3', '#E9DCC0', '#F2EEE6', '#E6D3A3', '#DCC8A0', '#E8C4A8', '#C9D3D8', '#D2DCCB'], 0.4, 0.5);

const area = (b) => (b[2] - b[0]) * (b[3] - b[1]);
const SORTED = LIST.slice().sort((a, b) => area(a.bbox) - area(b.bbox));

export function districtAt(lat, lon) {
  for (const d of SORTED) if (lat >= d.bbox[0] && lat <= d.bbox[2] && lon >= d.bbox[1] && lon <= d.bbox[3]) return d;
  return DEFAULT;
}

/** Weighted pick from { STYLE_NAME: weight } with a 0..1 random number. */
export function pickStyle(weights, r) {
  const entries = Object.entries(weights);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let acc = 0;
  for (const [name, w] of entries) { acc += w / total; if (r <= acc) return STYLE[name]; }
  return STYLE[entries[entries.length - 1][0]];
}
