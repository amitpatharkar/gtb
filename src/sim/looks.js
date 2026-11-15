import * as THREE from 'three';

// What people wear in Mumbai, by kind of person, district and hour: one `look` per person,
// chosen once and kept (the real characters near the camera and the far crowd both draw it).
// A look names the outfit style, hair, face details (moustache, beard, bindi, spectacles),
// headwear and accessories, and holds the extra colours (dupatta, lungi, border, hard hat…).
// The person's own shirt / pants / skin colours stay on the person (callers may set them).
//
// Districts: small boxes of latitude/longitude with a flavour — koli (koliwadas and fish
// docks: nauvari saris), south (Matunga, Sion, Chembur, Dharavi: more lungis and veshtis),
// bazaar (Kalbadevi, Bhendi Bazaar, Mohammed Ali Road, Kurla: kurta-pyjama, salwar-kameez),
// business (Nariman Point, Fort, BKC, Lower Parel: office wear, ID lanyards) and posh
// (Bandra, Juhu, Colaba, Malabar Hill, Powai: western clothes). Elsewhere a city-wide mix.

const C = (hex) => new THREE.Color(hex);
const pick = (a, r) => a[Math.min(a.length - 1, Math.floor(r * a.length))];
/** Weighted choice from [[value, weight], …]. */
function choose(table, r) {
  let sum = 0;
  for (let i = 0; i < table.length; i++) sum += table[i][1];
  let x = r * sum;
  for (let i = 0; i < table.length; i++) { x -= table[i][1]; if (x <= 0) return table[i][0]; }
  return table[table.length - 1][0];
}

// ---------------------------------------------------------------- districts
// [south, west, north, east, flavour]; the first box that contains the point wins.
const ZONES = [
  [18.905, 72.822, 18.915, 72.832, 'koli'],    // Colaba Koliwada, Sassoon Dock
  [19.015, 72.810, 19.027, 72.8205, 'koli'],   // Worli Koliwada
  [19.035, 72.834, 19.046, 72.842, 'koli'],    // Mahim Koliwada and beach
  [19.050, 72.817, 19.062, 72.826, 'koli'],    // Bandra Chimbai
  [19.064, 72.822, 19.074, 72.830, 'koli'],    // Khar Danda
  [19.125, 72.805, 19.140, 72.818, 'koli'],    // Versova Koliwada
  [18.955, 72.842, 18.966, 72.850, 'koli'],    // Bhaucha Dhakka fish wharf
  [19.020, 72.850, 19.035, 72.862, 'south'],   // Matunga
  [19.035, 72.845, 19.050, 72.880, 'south'],   // Dharavi, Sion Koliwada
  [19.045, 72.885, 19.070, 72.912, 'south'],   // Chembur
  [19.015, 72.855, 19.035, 72.872, 'south'],   // Antop Hill, Wadala
  [18.945, 72.824, 18.972, 72.846, 'bazaar'],  // Crawford Market, Kalbadevi, Bhendi Bazaar, Dongri, Nagpada
  [18.965, 72.828, 18.985, 72.842, 'bazaar'],  // Byculla
  [19.030, 72.835, 19.045, 72.845, 'bazaar'],  // Mahim
  [19.055, 72.842, 19.066, 72.853, 'bazaar'],  // Behrampada, Bandra East
  [19.058, 72.868, 19.085, 72.890, 'bazaar'],  // Kurla
  [18.918, 72.816, 18.931, 72.827, 'business'], // Nariman Point
  [18.928, 72.829, 18.945, 72.846, 'business'], // Fort, Ballard Estate, CST
  [19.055, 72.857, 19.075, 72.875, 'business'], // Bandra Kurla Complex
  [18.990, 72.818, 19.012, 72.836, 'business'], // Lower Parel, Worli offices
  [19.105, 72.858, 19.135, 72.888, 'business'], // Andheri East, SEEPZ
  [18.898, 72.805, 18.926, 72.830, 'posh'],     // Colaba, Cuffe Parade
  [18.940, 72.792, 18.966, 72.812, 'posh'],     // Malabar Hill
  [19.048, 72.815, 19.075, 72.842, 'posh'],     // Bandra West
  [19.085, 72.818, 19.118, 72.838, 'posh'],     // Juhu
  [19.118, 72.818, 19.140, 72.848, 'posh'],     // Lokhandwala, Andheri West
  [19.105, 72.893, 19.135, 72.920, 'posh'],     // Powai
];
const frame = { lat: 19.03, lon: 72.85, mLat: 110692.4, mLon: 105273.1 }; // the converter's fixed origin (Mahim)
/** Use the map's own origin and scale (tiles/index.json). */
export function setWorldFrame(index) {
  if (!index?.origin || !index.metresPerDegree) return;
  frame.lat = index.origin.lat; frame.lon = index.origin.lon; frame.mLat = index.metresPerDegree.lat; frame.mLon = index.metresPerDegree.lon;
}
/** District flavour at a world position: '', 'koli', 'south', 'bazaar', 'business' or 'posh'. */
export function zoneAt(x, z) {
  const lat = frame.lat - z / frame.mLat, lon = frame.lon + x / frame.mLon;
  for (let i = 0; i < ZONES.length; i++) { const Z = ZONES[i]; if (lat >= Z[0] && lat <= Z[2] && lon >= Z[1] && lon <= Z[3]) return Z[4]; }
  return '';
}
/** Where and when people are being dressed: set every frame from the player's position and the clock. */
export const NOW = { hour: 12, sunday: false, zone: '' };

// ---------------------------------------------------------------- palettes (sRGB hex)
// Skin over a realistic Indian range, fair to deep; most people wheatish to brown.
export const SKIN_TONES = [[0xe0b592, 3], [0xd4a47f, 7], [0xc79572, 12], [0xb98563, 15], [0xab7756, 16], [0x9c6a4b, 14], [0x8c5d41, 12], [0x7c5139, 9], [0x6b4530, 6], [0x5a3a29, 4], [0x4b3022, 2]];
const HAIR_DARK = [0x0d0a08, 0x120d0a, 0x18110c, 0x1f160f, 0x2a1d13];
const HAIR_GREY = [0x6f6c68, 0x8f8b86, 0xb6b2ac, 0xd2cfca];
const HAIR_HENNA = [0x6a2a14, 0x7f3517, 0x5b2615];
const TSHIRT = [0xc0392b, 0x2e86c1, 0x27ae60, 0xf1c40f, 0x8e44ad, 0x34495e, 0xe67e22, 0xecf0f1, 0x16a085, 0x1c1c1c, 0x7f8c8d, 0xd35400, 0x2c3e50, 0xa93226, 0x5d6d7e, 0xf5b7b1];
const SHIRT = [0xf2f2f0, 0xbcd3ea, 0xe8e2d0, 0x9fb4c8, 0xd9c9e8, 0xc8d6c0, 0xe6d3b3, 0x8aa1b8, 0xb04a3a, 0x3d5a80, 0x6b8f71, 0xd8c3a5];
const OFFICE_SHIRT = [0xf4f4f2, 0xf4f4f2, 0xbcd3ea, 0xd6e2f0, 0xe9dcea, 0xdfe3e6, 0xf0e6d6, 0xc9d8e8];
const TROUSERS = [0x2a2d33, 0x3b3f47, 0x4a4036, 0x1d2430, 0x5c5446, 0x6e6a62, 0x22252b, 0x8a7b62];
const JEANS = [0x2f4a6d, 0x3a5a80, 0x263a55, 0x45607f, 0x1f2c3f];
const KURTA = [0xf4f1ea, 0xf4f1ea, 0xefe3c6, 0xdfe9f2, 0xe6efd9, 0xf3dfc4, 0xd9a441, 0x7b8fa6, 0x2f4f6f, 0xc0d0b0];
const PYJAMA = [0xf4f1ea, 0xefe9dc, 0xe8e2d4];
const SARI = [0xb3122a, 0x8e1b3a, 0xc2185b, 0xe65100, 0xf9a825, 0x2e7d32, 0x00897b, 0x1565c0, 0x6a1b9a, 0xad1457, 0xd84315, 0x558b2f, 0x0277bd, 0xf06292, 0x4e342e, 0xf3e5c0];
const SARI_BORDER = [0xd9a21b, 0xe8c15a, 0xc9a227, 0xb3122a, 0x0f6b4f, 0x1a237e, 0xf2efe6];
const BLOUSE = [0xb3122a, 0x1a237e, 0x2e7d32, 0xf9a825, 0x6a1b9a, 0x4e342e, 0xd84315, 0x00695c, 0xc2185b];
const KAMEEZ = [0xf8bbd0, 0xb2dfdb, 0xfff59d, 0xc5cae9, 0xffccbc, 0xd1c4e9, 0xe1bee7, 0x80cbc4, 0xef9a9a, 0x9fa8da, 0xc62828, 0x2e7d32, 0x283593, 0xf57f17, 0x00838f, 0xfafafa, 0x6d4c41];
const SALWAR = [0xfafafa, 0xf5f0e6, 0x212121, 0x283593, 0x6d4c41, 0xc62828, 0xffe082, 0x37474f];
const DUPATTA = [0xe91e63, 0xff9800, 0x9c27b0, 0x3f51b5, 0x009688, 0xffeb3b, 0xf44336, 0xfafafa, 0x8bc34a, 0xff5722, 0x795548];
const TOP = [0xffffff, 0x212121, 0xe57373, 0x64b5f6, 0xffd54f, 0x81c784, 0xba68c8, 0xf06292, 0x4db6ac, 0xff8a65, 0x90a4ae];
const LUNGI = [0x1a3d7c, 0x2e6b3a, 0x6d1f2a, 0x4a2f1d, 0x1f4f5f, 0x5b2c6f, 0x7a4a12, 0x223355];
const NAUVARI = [0xd81b60, 0xad1457, 0x2e7d32, 0xef6c00, 0x6a1b9a, 0x00838f, 0xc62828, 0x1565c0, 0xf9a825];
const HARDHAT = [0xf2c200, 0xf2c200, 0xf2f2f0, 0xff7a00, 0x1f5fbf];
const HIVIS = [0xff6a00, 0xc6f000, 0xff8a00];
const SHOES = [0x1a1a1a, 0x2b1d14, 0x3a2a1e, 0x6b4a32, 0xd8d4cc, 0x20242c];
const CHAPPALS = [0x3a2a1e, 0x5b3a22, 0x1a1a1a, 0x8a6a3a, 0xa0522d];
const RIBBON = [0xc62828, 0xfafafa, 0x1a237e, 0x2e7d32];
const LANYARD = [0x1565c0, 0xc62828, 0x2e7d32, 0x212121, 0xf57f17, 0x6a1b9a];
const SCHOOL_BOTTOM = [0x1a2440, 0x1a2440, 0x2b2f3a, 0x5a1a22, 0x3a3f4a];
const BAG = [0x1a237e, 0xc62828, 0x2e7d32, 0x212121, 0xf57f17, 0x6a1b9a, 0x00838f];
const TURBAN = [0xd84315, 0xf9a825, 0xc62828, 0xad1457, 0xfafafa];
const CAP = [0x1c1c1c, 0xc0392b, 0x2e86c1, 0xf2f2f0, 0x27ae60, 0x34495e];

/** Bits the far crowd (people.js) draws: shapes beyond the old cap / sari / helmet flags. */
export const BIT = {
  KURTA: 8, LUNGI: 16, LONGHAIR: 32, BUN: 64, PLAIT: 128, DUPATTA: 256, HARDHAT: 512, GANDHI: 1024,
  SKIRT: 2048, BALD: 4096, PALLU: 8192, SHORTS: 16384, SLEEVES: 32768, BAG: 65536, SARI: 131072, TURBAN: 262144,
};

/**
 * A blank look: every field present from the start (one object shape for all looks).
 * Garments: '', 'kurta' (knee), 'kurtaShort' (mid-thigh), 'sari', 'lungi', 'lungiShort'
 * (folded to the knee), 'skirt' (school), 'nauvari'. Legs: 0 trousers, 1 shorts, 2 bare
 * below the knee, 3 sari cloth. Sleeves: 0 as modelled, 1 to the elbow, 2 full.
 */
function blank() {
  return {
    female: false, kid: false, age: 1, style: 'tshirt', seed: 0,
    hair: 'short', flowers: false, beard: 0, moustache: false, bindi: false, glasses: 0, hat: '',
    garment: '', pallu: false, dupatta: false, lanyard: false, tie: false, bag: false, bat: false,
    sleeves: 0, legs: 0, socks: false, belt: true, template: '',
    hairColor: C(0x120d0a), accA: C(0x808080), accB: C(0xd9a21b), vest: null, shoe: C(0x1a1a1a), patCol: C(0xffffff),
    patShirt: 0, patLegs: 0, patAcc: 0, gloss: 0, bits: 0,
  };
}

/** A small seeded generator (callers pass Math.random or their own). */
export function seeded(seed) {
  let s = (Math.floor(seed * 2147483646) % 2147483646) + 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

function skinTone(r, zone) {
  // The coast's Koli families and the south-Indian quarters lean a little deeper; posh areas a little fairer.
  const shift = zone === 'koli' || zone === 'south' ? 0.12 : zone === 'posh' ? -0.08 : 0;
  return C(choose(SKIN_TONES, Math.min(0.999, Math.max(0, r + shift))));
}

function hairColour(L, r, rnd) {
  if (L.age === 2) {
    if (r < 0.18) return C(pick(HAIR_HENNA, rnd()));
    return C(pick(HAIR_GREY, rnd()));
  }
  if (L.age === 1 && r < 0.08) return C(pick(HAIR_GREY.slice(0, 2), rnd())); // greying early
  return C(pick(HAIR_DARK, rnd()));
}

// ---------------------------------------------------------------- styles by place
const MEN = {
  '': [['tshirt', 32], ['shirt', 32], ['kurta', 9], ['lungi', 4]],
  koli: [['koli', 32], ['tshirt', 28], ['shirt', 24], ['lungi', 8]],
  south: [['lungi', 20], ['veshti', 7], ['shirt', 36], ['tshirt', 25], ['kurta', 6]],
  bazaar: [['tshirt', 24], ['shirt', 30], ['kurta', 26], ['lungi', 10]],
  business: [['shirt', 45], ['tshirt', 25], ['office', 20], ['kurta', 5]],
  posh: [['tshirt', 52], ['shirt', 32], ['kurta', 6], ['lungi', 1]],
};
const WOMEN = {
  '': [['sari', 32], ['salwar', 30], ['kurti', 18], ['western', 14], ['office', 4]],
  koli: [['nauvari', 55], ['sari', 28], ['salwar', 12], ['kurti', 5]],
  south: [['sari', 48], ['salwar', 26], ['kurti', 16], ['western', 8]],
  bazaar: [['sari', 28], ['salwar', 46], ['kurti', 16], ['western', 6]],
  business: [['salwar', 26], ['kurti', 28], ['western', 22], ['office', 12], ['sari', 12]],
  posh: [['western', 40], ['kurti', 26], ['salwar', 18], ['sari', 16]],
};

/**
 * Choose a look for a kind of person ('casual', 'office', 'worker', 'sari' (a woman), 'kid',
 * 'police', 'trafficCop', 'khaki', 'jogger', 'driver', 'rider', 'dabbawala', …).
 * Returns { shirt, pants, skin, look } (THREE colours: callers may still change them).
 */
export function dress(kind, rnd = Math.random, zone = NOW.zone, hour = NOW.hour, sunday = NOW.sunday) {
  const L = blank();
  L.seed = rnd();
  const female = kind === 'sari' || kind === 'woman';
  L.female = female;
  L.kid = kind === 'kid';
  L.age = L.kid ? 0 : rnd() < 0.16 ? 2 : rnd() < 0.3 ? 0 : 1;
  const skin = skinTone(rnd(), zone);
  let shirt = C(pick(TSHIRT, rnd())), pants = C(pick(rnd() < 0.45 ? JEANS : TROUSERS, rnd()));
  const day = hour >= 7 && hour < 19;
  let style;
  if (L.kid) {
    L.female = rnd() < 0.5;
    style = !sunday && hour >= 7 && hour < 17.5 && rnd() < 0.72 ? 'school' : 'kidCasual';
  } else if (kind === 'police' || kind === 'trafficCop' || kind === 'khaki') style = kind === 'khaki' ? 'khaki' : 'police';
  else if (kind === 'dabbawala') style = 'dabbawala';
  else if (kind === 'jogger') style = 'track';
  else if (female) {
    style = choose(WOMEN[zone] || WOMEN[''], rnd());
    if (kind === 'office' || (style === 'office' && !(hour >= 8 && hour < 20))) style = rnd() < 0.5 ? 'office' : 'kurti';
  } else if (kind === 'office') style = rnd() < (zone === 'business' ? 0.2 : 0.08) ? 'suit' : 'office';
  else if (kind === 'worker') {
    const r = rnd();
    style = day && r < 0.42 ? 'construction' : hour >= 9.5 && hour < 15 && r < 0.56 && zone !== 'posh' ? 'dabbawala'
      : r < 0.72 ? 'workShirt' : zone === 'south' || zone === 'koli' || r < 0.86 ? 'lungi' : 'kurta';
  } else style = choose(MEN[zone] || MEN[''], rnd());
  if (style === 'office' && !female && !(hour >= 7 && hour < 22) && rnd() < 0.5) style = 'shirt';
  L.style = style;

  // ---- clothes by style
  const set = (s, p) => { shirt = C(s); pants = C(p); };
  switch (style) {
    case 'tshirt': L.template = 'casual'; L.sleeves = rnd() < 0.15 ? 2 : 0; break;
    case 'shirt':
      set(pick(SHIRT, rnd()), pick(rnd() < 0.3 ? JEANS : TROUSERS, rnd())); L.template = 'shirt';
      L.sleeves = rnd() < 0.55 ? 2 : rnd() < 0.5 ? 1 : 0; L.patShirt = rnd() < 0.35 ? 1 : rnd() < 0.3 ? 2 : 0;
      L.patCol = shirt.clone().multiplyScalar(0.62); break;
    case 'office': case 'suit':
      if (female) { set(pick(OFFICE_SHIRT.concat(KAMEEZ.slice(0, 6)), rnd()), pick(TROUSERS, rnd())); L.sleeves = rnd() < 0.6 ? 2 : 1; L.template = 'shirt'; }
      else { set(pick(OFFICE_SHIRT, rnd()), pick(TROUSERS.slice(0, 5), rnd())); L.sleeves = rnd() < 0.7 ? 2 : 1; L.template = style === 'suit' ? 'suit' : 'shirt'; }
      L.patShirt = rnd() < 0.3 ? 2 : rnd() < 0.2 ? 1 : 0; L.patCol = shirt.clone().multiplyScalar(0.7);
      L.lanyard = rnd() < (zone === 'business' ? 0.6 : 0.35); L.accB.setHex(pick(LANYARD, rnd()));
      if (L.age === 0 && rnd() < 0.3) L.age = 1;
      break;
    case 'kurta':
      set(pick(KURTA, rnd()), pick(PYJAMA, rnd())); L.garment = 'kurta'; L.sleeves = 2; L.belt = false; L.template = 'casual';
      L.patShirt = rnd() < 0.15 ? 3 : 0; L.patCol = shirt.clone().multiplyScalar(0.8); break;
    case 'lungi': case 'veshti': case 'koli': {
      const veshti = style === 'veshti';
      L.garment = style === 'koli' || rnd() < 0.3 ? 'lungiShort' : 'lungi';
      if (veshti) { L.accA.setHex(0xf4f1ea); L.patAcc = 0; L.accB.setHex(pick([0xd9a21b, 0x2e7d32, 0xb3122a], rnd())); L.garment = 'lungi'; }
      else { L.accA.setHex(pick(LUNGI, rnd())); L.patAcc = rnd() < 0.8 ? 1 : 0; L.patCol.setHex(rnd() < 0.6 ? 0xe8e4d8 : pick(LUNGI, rnd())); }
      L.belt = false; L.template = rnd() < 0.5 ? 'vest' : 'casual';
      if (L.template === 'vest') set(0xf2f2ee, 0x333333); else set(pick(SHIRT.concat(TSHIRT), rnd()), 0x333333);
      L.legs = L.garment === 'lungiShort' ? 2 : 0; break;
    }
    case 'workShirt':
      set(pick([0x7f8c8d, 0x95a5a6, 0xa04000, 0x566573, 0x5d6d7e, 0x6e5a45, 0x2e4053], rnd()), pick([0x4d4d4d, 0x3e3a33, 0x5b5045, 0x2c3e50], rnd()));
      L.template = 'shirt'; L.sleeves = rnd() < 0.5 ? 2 : 0; break;
    case 'construction':
      set(pick([0x7f8c8d, 0x95a5a6, 0xa04000, 0x566573, 0x8a6e4b, 0x2e4053], rnd()), pick([0x4d4d4d, 0x3e3a33, 0x5b5045], rnd()));
      L.hat = 'hardhat'; L.accA.setHex(pick(HARDHAT, rnd())); L.vest = C(pick(HIVIS, rnd())); L.template = 'worker'; L.sleeves = rnd() < 0.5 ? 2 : 0; break;
    case 'dabbawala':
      set(0xf4f2ec, 0xf0ede4); L.garment = 'kurtaShort'; L.hat = 'gandhi'; L.sleeves = 2; L.belt = false; L.template = 'casual'; break;
    case 'police':
      if (kind === 'trafficCop') set(0xf4f4f0, 0x1f2a44); else set(0xb59a62, 0xa88d58);
      L.template = 'shirt'; L.sleeves = kind === 'trafficCop' ? 2 : 0; L.accA.copy(pants); break;
    case 'khaki': set(0xb39a68, 0x9a8457); L.template = 'shirt'; L.sleeves = 0; break;
    case 'track': set(pick(TSHIRT, rnd()), pick([0x1c1c1c, 0x2c3e50, 0x34495e, 0x5d6d7e], rnd())); L.template = 'casual'; break;
    case 'school':
      set(0xf6f6f4, pick(SCHOOL_BOTTOM, rnd())); L.tie = true; L.accA.copy(pants).lerp(C(0x8a1c1c), rnd() < 0.5 ? 0.6 : 0); L.patAcc = 4; L.patCol.setHex(pick([0xc9a227, 0xc62828, 0xf2f2f0], rnd()));
      L.bag = rnd() < 0.75; L.accB.setHex(pick(BAG, rnd())); L.socks = true; L.template = 'shirt';
      L.legs = 1; if (L.female) L.garment = 'skirt'; L.shoe.setHex(0x111111); break;
    case 'kidCasual': L.legs = 1; L.template = 'casual'; if (L.female && rnd() < 0.5) { L.garment = 'skirt'; pants = C(pick(KAMEEZ, rnd())); } break;
    case 'sari':
      set(pick(BLOUSE, rnd()), pick(SARI, rnd())); L.garment = 'sari'; L.pallu = true; L.legs = 3; L.belt = false; L.template = 'blouse';
      L.accB.setHex(pick(SARI_BORDER, rnd())); L.patLegs = rnd() < 0.4 ? 3 : 0; L.patCol = pants.clone().lerp(L.accB, 0.6); break;
    case 'nauvari':
      set(pick(BLOUSE, rnd()), pick(NAUVARI, rnd())); L.garment = 'nauvari'; L.pallu = true; L.legs = 2; L.belt = false; L.template = 'blouse';
      L.accB.setHex(pick(SARI_BORDER, rnd())); L.patLegs = rnd() < 0.55 ? 1 : 3; L.patCol = pants.clone().lerp(C(0xffffff), 0.35); break;
    case 'salwar':
      set(pick(KAMEEZ, rnd()), pick(SALWAR, rnd())); L.garment = 'kurta'; L.dupatta = rnd() < 0.85; L.sleeves = rnd() < 0.6 ? 1 : 2; L.belt = false; L.template = 'blouse';
      L.accA.setHex(pick(DUPATTA, rnd())); L.patShirt = rnd() < 0.45 ? 3 : 0; L.patCol = shirt.clone().lerp(L.accA, 0.7); L.patAcc = rnd() < 0.3 ? 3 : 0; break;
    case 'kurti':
      set(pick(KAMEEZ, rnd()), pick(JEANS.concat([0x212121, 0xfafafa]), rnd())); L.garment = 'kurtaShort'; L.sleeves = rnd() < 0.5 ? 1 : 0; L.belt = false; L.template = 'blouse';
      L.patShirt = rnd() < 0.4 ? 3 : 0; L.patCol = shirt.clone().multiplyScalar(0.7); L.dupatta = rnd() < 0.15; L.accA.setHex(pick(DUPATTA, rnd())); break;
    case 'western':
      set(pick(TOP, rnd()), pick(JEANS.concat([0x212121, 0xe8e2d4]), rnd())); L.template = 'casual'; L.sleeves = rnd() < 0.2 ? 2 : 0; break;
    default: L.template = 'casual';
  }

  // ---- hair, face, headwear
  const r = rnd;
  if (L.kid) {
    if (L.female) L.hair = style === 'school' ? choose([['twoPlaits', 55], ['pony', 25], ['bob', 20]], r()) : choose([['pony', 40], ['bob', 30], ['twoPlaits', 30]], r());
    else L.hair = choose([['crop', 60], ['short', 30], ['curly', 10]], r());
    L.accB = style === 'school' && L.hair === 'twoPlaits' ? C(pick(RIBBON, r())) : L.accB;
    if (L.female && r() < 0.12) L.bindi = true;
  } else if (L.female) {
    L.hair = style === 'nauvari' ? (r() < 0.85 ? 'bun' : 'plait')
      : style === 'western' ? choose([['long', 38], ['pony', 32], ['bob', 18], ['bun', 6], ['plait', 6]], r())
        : choose([['plait', 30], ['bun', 26], ['long', 20], ['pony', 18], ['bob', 6]], r());
    if (L.age === 2 && r() < 0.7) L.hair = 'bun';
    L.flowers = (L.hair === 'bun' || L.hair === 'plait') && r() < (style === 'nauvari' ? 0.8 : style === 'sari' ? 0.45 : 0.15);
    L.bindi = r() < (style === 'nauvari' ? 0.95 : style === 'sari' ? 0.8 : style === 'salwar' ? 0.5 : style === 'western' ? 0.15 : 0.35);
  } else {
    L.hair = L.age === 2 ? choose([['receding', 40], ['bald', 25], ['short', 20], ['slick', 15]], r())
      : choose([['short', 34], ['slick', 18], ['crop', 22], ['curly', 12], ['receding', 8], ['bald', 3]], r());
    const beard = r();
    if (style === 'police') { L.moustache = r() < 0.7; L.beard = 0; } else {
      const full = zone === 'bazaar' ? 0.14 : 0.06;
      L.beard = beard < full ? 2 : beard < full + 0.14 ? 1 : 0;
      L.moustache = L.beard > 0 ? r() < 0.85 : r() < (L.age === 2 ? 0.55 : 0.36);
    }
  }
  L.hairColor = hairColour(L, r(), r);
  if (L.hair === 'slick') L.gloss = 1;
  if (!L.kid) {
    const glassesP = L.age === 2 ? 0.4 : style === 'office' || style === 'suit' ? 0.3 : 0.12;
    if (r() < glassesP) L.glasses = 1;
    else if (day && r() < (zone === 'posh' ? 0.1 : 0.03) && style !== 'police') L.glasses = 2;
  } else if (r() < 0.06) L.glasses = 1;
  if (!L.hat && !L.female && !L.kid && day && (style === 'tshirt' || style === 'track') && r() < 0.07) { L.hat = 'cap'; L.accA.setHex(pick(CAP, r())); }
  if (style === 'koli' && r() < 0.2) { L.hat = 'cap'; L.accA.setHex(pick(CAP, r())); }

  // ---- footwear
  const sandals = ['lungi', 'veshti', 'koli', 'kurta', 'dabbawala', 'sari', 'nauvari', 'salwar'].includes(style);
  if (style !== 'school') L.shoe = C(pick(sandals ? CHAPPALS : SHOES, r()));
  if (style === 'track') L.shoe.setHex(pick([0xf2f2f0, 0x1a1a1a, 0x2e86c1], r()));

  finishBits(L);
  return { shirt, pants, skin, look: L };
}

/** The far crowd's shape bits for a look (a helmet is the old flag 4). */
export function finishBits(L) {
  let b = 0;
  if (L.hair === 'long' || L.hair === 'bob') b |= BIT.LONGHAIR;
  if (L.hair === 'bun' || L.hair === 'pony') b |= BIT.BUN;
  if (L.hair === 'plait' || L.hair === 'twoPlaits') b |= BIT.PLAIT;
  if (L.hair === 'bald') b |= BIT.BALD;
  if (L.garment === 'kurta' || L.garment === 'kurtaShort') b |= BIT.KURTA;
  if (L.garment === 'lungi') b |= BIT.LUNGI;
  if (L.garment === 'lungiShort') b |= BIT.SKIRT | BIT.LUNGI | BIT.SHORTS;
  if (L.garment === 'sari') b |= BIT.SARI;
  if (L.garment === 'skirt') b |= BIT.SKIRT;
  if (L.dupatta) b |= BIT.DUPATTA;
  if (L.pallu) b |= BIT.PALLU;
  if (L.hat === 'hardhat') b |= BIT.HARDHAT;
  if (L.hat === 'gandhi') b |= BIT.GANDHI;
  if (L.hat === 'turban') b |= BIT.TURBAN;
  if (L.hat === 'helmet') b |= 4;
  if (L.legs === 1 || L.legs === 2) b |= BIT.SHORTS;
  if (L.sleeves === 2) b |= BIT.SLEEVES;
  if (L.bag) b |= BIT.BAG;
  L.bits = b;
  return L;
}

/**
 * A look for someone made without one (callers that build people by hand): derived from
 * their colours, flags and kind, so the same person gets the same look every frame.
 */
const cache = new WeakMap();
export function lookFor(p) {
  if (p.look) return p.look;
  const key = p.shirt;
  if (key && cache.has(key)) return cache.get(key);
  const h = ((p.shirt?.getHex() || 0) * 31 + (p.pants?.getHex() || 0) * 17 + (p.skin?.getHex() || 0) + (p.flags || 0) * 7) % 1000003;
  const rnd = seeded(h / 1000003);
  const female = (p.flags & 2) || p.kind === 'sari';
  const cop = (p.flags & 1) && !female;
  const L = dress(cop ? 'police' : female ? 'sari' : p.kind === 'kid' || (p.scale ?? 1) < 0.85 ? 'kid' : 'casual', rnd, '', 12, true).look;
  // Their own clothes stay: keep shapes that suit any colour.
  if (L.style === 'nauvari' || L.style === 'school') { L.style = 'salwar'; L.garment = 'kurta'; L.legs = 0; L.tie = false; L.bag = false; L.socks = false; }
  if (female && L.style !== 'sari' && L.style !== 'salwar') { L.style = 'salwar'; L.garment = 'kurta'; L.dupatta = false; }
  if (p.flags & 4) { L.hat = 'turban'; L.accA.copy(p.hatColor || C(pick(TURBAN, rnd()))); }
  if (cop) { L.hat = ''; L.accA.copy(p.pants || L.accA); }
  if (!female && (L.garment === 'lungi' || L.garment === 'lungiShort')) { L.garment = ''; L.legs = 0; L.style = 'shirt'; }
  finishBits(L);
  if (key) cache.set(key, L);
  return L;
}

/** The player's look for a wardrobe choice (Ghar app): 'default', 'jersey', 'kurta', 'shades'. */
const PLAYER = new Map();
export function playerLook(wear = 'default') {
  let L = PLAYER.get(wear);
  if (L) return L;
  L = blank();
  L.style = wear === 'kurta' ? 'kurta' : 'tshirt'; L.template = 'casual'; L.seed = 0.31;
  L.hair = 'short'; L.hairColor.setHex(0x17110c);
  if (wear === 'kurta') { L.garment = 'kurta'; L.sleeves = 2; L.belt = false; L.shoe.setHex(0x5b3a22); }
  if (wear === 'shades') L.glasses = 2;
  finishBits(L);
  PLAYER.set(wear, L);
  return L;
}
