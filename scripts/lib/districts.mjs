// District "block guides" from docs/research/mumbai-guide.md (sections A1 and A2) and
// mumbai-guide-2.md: which building styles, wall colours, tree density and shop density each
// area has. Boxes are [south, west, north, east]; the smallest box containing a point wins.
// Optional extras: palms (coconut palms on streets), tall (styles for buildings over ~10
// storeys) and lv (storey guesses for untagged outlines, see buildingHeights in the converter):
//   cap: at most this many storeys · bungalows: footprints up to this area (m²) get 1–3 storeys
//   towers: [min footprint m², share, min storeys, max storeys] for big residential/office blocks

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

  // ---- Proposed by the street library (docs/research/street-library/README.md, profiles.json new_districts)
  D('Bhendi Bazaar', [18.955, 72.828, 18.966, 72.836], { WEATHERED: 6, PLASTER: 3, CONCRETE: 1 }, ['#E8DCC0', '#B9D2C7', '#4F8F6A', '#D9C7A1', '#F3EFE6'], 0.15, 0.95),
  D('Nagpada', [18.962, 72.822, 18.972, 72.832], { WEATHERED: 5, PLASTER: 3, CONCRETE: 2 }, ['#E3D6BA', '#D9C7A1', '#9AA6A0', '#E8DCC0', '#4F8F6A'], 0.25, 0.85),
  D('Dongri Mandvi', [18.950, 72.834, 18.962, 72.845], { WEATHERED: 6, PLASTER: 3, SHED: 1 }, ['#C5A97C', '#D9CBB0', '#E5DDCB', '#B2552F', '#8E9C8D'], 0.15, 0.9),
  D('Mumbai Central', [18.968, 72.812, 18.980, 72.828], { CONCRETE: 4, PLASTER: 3, WEATHERED: 3 }, ['#D6CFC0', '#E3D6BA', '#CFC9BC', '#EDE7DA'], 0.35, 0.7),
  D('Reay Road', [18.975, 72.840, 18.995, 72.860], { SHED: 4, WEATHERED: 3, PLASTER: 3 }, ['#E9E6DE', '#B8B2A6', '#C9C1B1', '#8C4A2F'], 0.3, 0.4),

  // ---- Central island city (guide A2)
  D('Haji Ali', [18.975, 72.805, 18.990, 72.825], { CONCRETE: 4, PLASTER: 4, GLASS: 2 }, ['#E9E4D8', '#D6D0C2', '#F2EEE4', '#C9C1B1'], 0.5, 0.5,
    { tall: { CONCRETE: 4, GLASS: 3, PLASTER: 3 }, lv: { towers: [700, 0.45, 12, 35] } }),
  D('Worli', [18.990, 72.808, 19.025, 72.825], { CONCRETE: 4, PLASTER: 3, GLASS: 3 }, ['#E8E4DA', '#7F9AAE', '#D9D2C4', '#D9A441', '#F1EEE6'], 0.45, 0.35,
    { tall: { GLASS: 4, CONCRETE: 4, PLASTER: 2 }, lv: { towers: [800, 0.55, 18, 50] } }),
  D('Worli Koliwada', [19.017, 72.812, 19.026, 72.8195], { WEATHERED: 6, PLASTER: 3, SHED: 1 }, ['#F2D16B', '#6CA0C8', '#E58F7C', '#8FBF9F', '#F5F1E6', '#C9B9E0'], 0.15, 0.6, { lv: { cap: 3 } }),
  D('Lower Parel', [18.990, 72.822, 19.010, 72.835], { BRICK: 2, SHED: 2, CONCRETE: 3, GLASS: 3 }, ['#B65A3C', '#CFC9BC', '#6F8796', '#E2DCCF'], 0.3, 0.4,
    { tall: { GLASS: 5, CONCRETE: 4, PLASTER: 1 }, lv: { towers: [1000, 0.5, 15, 45] } }),
  D('Parel', [18.990, 72.835, 19.012, 72.848], { WEATHERED: 4, CONCRETE: 3, PLASTER: 3 }, ['#E3D6BA', '#C9B48A', '#A9B7A9', '#D58B6A', '#EDE7DA'], 0.35, 0.8,
    { tall: { CONCRETE: 5, GLASS: 2, PLASTER: 3 }, lv: { towers: [900, 0.35, 15, 40] } }),
  D('Sewri Wadala', [18.995, 72.848, 19.030, 72.870], { SHED: 3, PLASTER: 3, CONCRETE: 3, WEATHERED: 1 }, ['#D6CFC0', '#B8B2A6', '#E9E2D3', '#C2B6A2'], 0.3, 0.45,
    { lv: { towers: [1200, 0.3, 10, 25] } }),
  D('Prabhadevi', [19.010, 72.822, 19.022, 72.835], { PLASTER: 4, CONCRETE: 3, WEATHERED: 2, GLASS: 1 }, ['#F1E9D7', '#D9B44A', '#E5735A', '#E7DCC2', '#CFC9BC'], 0.45, 0.65,
    { tall: { CONCRETE: 4, GLASS: 3, PLASTER: 3 }, lv: { towers: [900, 0.4, 15, 40] } }),
  D('Dadar', [19.010, 72.835, 19.030, 72.850], { WEATHERED: 4, PLASTER: 4, DECO: 2 }, ['#E7DCC2', '#F2D16B', '#8FBF9F', '#C77B4F', '#F2ECDD'], 0.35, 0.9),
  D('Matunga', [19.020, 72.850, 19.035, 72.860], { DECO: 3, PLASTER: 4, WEATHERED: 3 }, ['#EDE3CD', '#D9C6A0', '#F3EFE6', '#E3C6A6', '#B9D2C7'], 0.55, 0.7),
  D('Mahim', [19.030, 72.835, 19.045, 72.850], { PLASTER: 5, WEATHERED: 4, CONCRETE: 1 }, ['#F3EFE6', '#4F8F6A', '#D9C7A1', '#E8DCC0', '#CBB596'], 0.4, 0.7),
  D('Dharavi', [19.035, 72.845, 19.050, 72.860], { WEATHERED: 5, SHED: 3, PLASTER: 2 }, ['#3E7CB1', '#9C4A2A', '#B8B2A6', '#5E6B73', '#C9C1B1', '#D8CFBF'], 0.1, 0.9,
    { lv: { cap: 4 } }),
  D('Sion', [19.035, 72.860, 19.052, 72.875], { PLASTER: 4, CONCRETE: 3, WEATHERED: 3 }, ['#D6CFC0', '#A9A397', '#E9E2D3', '#E3D6BA'], 0.35, 0.7),

  // ---- Western suburbs
  D('Bandra West', [19.045, 72.818, 19.070, 72.845], { PLASTER: 6, CONCRETE: 3, DECO: 1 }, ['#F2E6CC', '#89B5C4', '#E89A7A', '#FFFFFF', '#E9D9B8', '#C9DCC0'], 0.75, 0.55,
    { lv: { bungalows: 220, towers: [900, 0.35, 10, 25] } }),
  D('Bandstand', [19.040, 72.815, 19.070, 72.8255], { PLASTER: 5, CONCRETE: 4, GLASS: 1 }, ['#F4EFE4', '#F2E6CC', '#DCE6E4', '#FFFFFF', '#E9D9B8'], 0.6, 0.3,
    { palms: true, tall: { CONCRETE: 4, PLASTER: 4, GLASS: 2 }, lv: { bungalows: 260, towers: [700, 0.5, 12, 26] } }),
  D('Bandra East', [19.052, 72.840, 19.070, 72.857], { PLASTER: 4, CONCRETE: 3, WEATHERED: 3 }, ['#E3D6BA', '#D6CFC0', '#E9E2D3', '#C9C1B1'], 0.35, 0.65),
  D('BKC', [19.055, 72.857, 19.072, 72.872], { GLASS: 6, CONCRETE: 4 }, ['#D6D2C8', '#B9B4A9', '#8C8F91'], 0.5, 0.1,
    { tall: { GLASS: 6, CONCRETE: 4 }, lv: { towers: [1200, 0.8, 8, 22] } }),
  D('Khar', [19.065, 72.825, 19.078, 72.845], { PLASTER: 5, CONCRETE: 4, DECO: 1 }, ['#F2E6CC', '#EDE3CD', '#E9D9B8', '#DCE6E4', '#F3F0E8'], 0.7, 0.5,
    { lv: { bungalows: 200, towers: [900, 0.3, 10, 22] } }),
  D('Santacruz', [19.078, 72.825, 19.092, 72.850], { PLASTER: 5, CONCRETE: 3, WEATHERED: 2 }, ['#EEE6D3', '#E9DCC0', '#D2DCCB', '#E8C4A8', '#F2EEE6'], 0.55, 0.65),
  D('Juhu', [19.085, 72.818, 19.118, 72.835], { PLASTER: 5, CONCRETE: 4, GLASS: 1 }, ['#F4EFE4', '#EADFC8', '#F2E2D0', '#DCE6E4', '#FFFFFF'], 0.75, 0.25,
    { palms: true, tall: { CONCRETE: 4, PLASTER: 4, GLASS: 2 }, lv: { bungalows: 320, towers: [800, 0.35, 8, 20] } }),
  D('Vile Parle', [19.092, 72.835, 19.110, 72.855], { PLASTER: 5, WEATHERED: 3, CONCRETE: 2 }, ['#EEE6D3', '#E6D3A3', '#D2DCCB', '#E8C4A8', '#F2EEE6'], 0.5, 0.7),
  D('Airport', [19.080, 72.855, 19.105, 72.885], { SHED: 4, CONCRETE: 3, GLASS: 3 }, ['#D6D2C8', '#C9C4B8', '#E6E1D5'], 0.3, 0.1),
  D('Andheri West', [19.110, 72.818, 19.145, 72.845], { CONCRETE: 4, PLASTER: 4, WEATHERED: 2 }, ['#E6E1D5', '#D6CFC0', '#EEE6D3', '#C9D3D8', '#E8C4A8'], 0.45, 0.75,
    { tall: { CONCRETE: 5, PLASTER: 3, GLASS: 2 }, lv: { towers: [800, 0.45, 8, 22] } }),
  D('Andheri East', [19.105, 72.845, 19.145, 72.880], { CONCRETE: 4, PLASTER: 3, WEATHERED: 2, SHED: 2, GLASS: 1 }, ['#D6CFC0', '#E6E1D5', '#C9C4B8', '#E3D6BA'], 0.35, 0.7,
    { tall: { CONCRETE: 4, GLASS: 4, PLASTER: 2 }, lv: { towers: [1000, 0.35, 8, 20] } }),
  D('Marol MIDC', [19.110, 72.865, 19.135, 72.885], { SHED: 4, CONCRETE: 3, GLASS: 2, PLASTER: 1 }, ['#C2B6A2', '#D6D2C8', '#B9B4A9'], 0.3, 0.4),

  // ---- Eastern suburbs
  D('Kurla', [19.055, 72.872, 19.090, 72.895], { WEATHERED: 5, PLASTER: 4, SHED: 1 }, ['#E3D6BA', '#B9D2C7', '#E7A57D', '#D8CBB3', '#C9C1B1'], 0.25, 0.9),
  D('Saki Naka', [19.090, 72.880, 19.115, 72.895], { WEATHERED: 4, SHED: 3, PLASTER: 3 }, ['#D8CBB3', '#B8B2A6', '#E3D6BA', '#9AA6A0'], 0.2, 0.85),
  D('Chembur', [19.040, 72.880, 19.075, 72.920], { PLASTER: 5, CONCRETE: 4, WEATHERED: 1 }, ['#EEE6D3', '#E9DCC0', '#D6CFC0', '#F2EEE6'], 0.55, 0.6,
    { lv: { towers: [900, 0.35, 10, 24] } }),
  D('Ghatkopar', [19.075, 72.895, 19.100, 72.920], { PLASTER: 5, CONCRETE: 3, WEATHERED: 2 }, ['#EEE6D3', '#E6D3A3', '#D6CFC0', '#E8C4A8'], 0.4, 0.8,
    { lv: { towers: [900, 0.35, 10, 24] } }),
  D('Powai', [19.100, 72.880, 19.145, 72.925], { CONCRETE: 4, PLASTER: 4, WEATHERED: 1, GLASS: 1 }, ['#EEE6D3', '#E6E1D5', '#D6CFC0', '#F2EEE6'], 0.6, 0.45,
    { tall: { CONCRETE: 4, PLASTER: 4, GLASS: 2 }, lv: { towers: [700, 0.5, 12, 26] } }),
  // Hiranandani Gardens: cream and peach neo-classical towers with cornices and domes.
  D('Hiranandani', [19.108, 72.902, 19.125, 72.918], { DECO: 6, PLASTER: 3, CONCRETE: 1 }, ['#F3E6CC', '#EEDCC0', '#F6EFE2', '#E9D2B0', '#F1E0D2'], 0.85, 0.35,
    { tall: { DECO: 6, PLASTER: 3, CONCRETE: 1 }, lv: { towers: [500, 0.85, 16, 32] } }),
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
