// Vehicle models uploaded by the owner to public/art/vehicles/<id>.glb (free models, CC0 or
// CC BY, credited in public/art/CREDITS.md). Plain data, shared by the build
// (scripts/art-vehicles.mjs: orients, scales, splits into the fleet's four parts, slims) and
// the game (src/vehicles/vehicleArt.js: hands the parts to traffic).
//
// A file named after an existing fleet type (alto, padmini, bus, auto…) replaces that type's
// close-up body; any other name adds a new type, which drives like `base`. Every name shown in
// the game is a parody. `len` is the real length in metres (the model is scaled to it);
// `flip: true` turns a model that came out facing backwards.

export const VEHICLE_ART = {
  // New types (real Mumbai regulars that the procedural fleet does not have).
  ambassador: { name: 'Hindustaan Embassador', len: 4.33, base: 'dzire', weight: 0.35, tints: [0xf4f4f2, 0xf4f4f2, 0x111111, 0xe9e0c8] },
  m800: { name: 'Maroti Aath-Sau', len: 3.34, base: 'alto', weight: 0.35, tints: [0xf4f4f2, 0xc0281f, 0x2a59b8, 0xe9e0c8, 0x8a8f95] },
  omni: { name: 'Maroti Omnee van', len: 3.37, base: 'eeco', weight: 0.3, tints: [0xf4f4f2, 0xf4f4f2, 0xc5c8cc, 0xc0281f] },
  nano: { name: 'Tota Nanu', len: 3.1, base: 'alto', weight: 0.2, tints: [0xf2c200, 0xc0281f, 0xf4f4f2, 0x2a59b8] },
  indica: { name: 'Tota Indeeka', len: 3.69, base: 'wagonr', weight: 0.35, tints: [0xf4f4f2, 0xc5c8cc, 0x8a8f95, 0x7a1f1f] },
  scorpio: { name: 'Mahendra Scorpyo', len: 4.46, base: 'bolero', weight: 0.35, tints: [0xf4f4f2, 0x1b1b1b, 0x8a8f95, 0x5a2a1a] },
  thar: { name: 'Mahendra Thaar', len: 3.98, base: 'bolero', weight: 0.15, tints: [0x1b1b1b, 0xc0281f, 0x4b5a3a, 0xf4f4f2] },
  sumo: { name: 'Tota Soomo', len: 4.25, base: 'bolero', weight: 0.2, tints: [0xf4f4f2, 0xc5c8cc, 0x8a8f95] },
  santro: { name: 'Hundai Santaro', len: 3.6, base: 'i10', weight: 0.3, tints: [0xf4f4f2, 0xc5c8cc, 0xc0281f, 0x1d3f7a] },
  // From the owner's Sketchfab collection (more Mumbai regulars).
  gypsy: { name: 'Maroti Gipsy', len: 4.01, base: 'bolero', weight: 0.1, tints: [0xf4f4f2, 0x2e3a2a, 0xc0281f] },
  zen: { name: 'Maroti Jen', len: 3.6, base: 'alto', weight: 0.2, tints: [0xc5c8cc, 0xf4f4f2, 0x7a1f1f, 0x2a59b8] },
  contessa: { name: 'Hindustaan Kontessa', len: 4.6, base: 'dzire', weight: 0.06, tints: [0xf4f4f2, 0x111111, 0x7a1f1f] },
  sierra: { name: 'Tota Siera', len: 4.41, base: 'bolero', weight: 0.06, tints: [0xc0281f, 0xf4f4f2, 0x2a59b8] },
  safari: { name: 'Tota Safaari', len: 4.65, base: 'innova', weight: 0.2, tints: [0xf4f4f2, 0x1b1b1b, 0x8a8f95] },
  tiago: { name: 'Tota Tiyago', len: 3.77, base: 'wagonr', weight: 0.35, tints: [0xf4f4f2, 0xc0281f, 0x2a59b8, 0x8a8f95] },
  punch: { name: 'Tota Panch', len: 3.83, base: 'i10', weight: 0.3, tints: [0xf4f4f2, 0x2f8f4e, 0xd8641a, 0x8a8f95] },
  verna: { name: 'Hundai Werna', len: 4.44, base: 'city', weight: 0.25, tints: [0xf4f4f2, 0x1b1b1b, 0x8a8f95, 0x7a1f1f] },
  ciaz: { name: 'Maroti Siyaz', len: 4.49, base: 'city', weight: 0.25, tints: [0xf4f4f2, 0xc5c8cc, 0x8a8f95, 0x5a2a1a] },
  baleno: { name: 'Maroti Baleeno', len: 3.99, base: 'swift', weight: 0.35, tints: [0xf4f4f2, 0x2a59b8, 0xc0281f, 0x8a8f95] },
  brezza: { name: 'Maroti Breeza', len: 3.99, base: 'creta', weight: 0.3, tints: [0xf4f4f2, 0xd8641a, 0x8a8f95, 0x1b1b1b] },
  seltos: { name: 'Kiya Seltoss', len: 4.36, base: 'creta', weight: 0.25, tints: [0xf4f4f2, 0x1b1b1b, 0xc0281f, 0x8a8f95] },
  fortuner: { name: 'Toyoda Fortunar', len: 4.79, base: 'innova', weight: 0.2, tints: [0xf4f4f2, 0x1b1b1b, 0x8a8f95] },
  xuv: { name: 'Mahendra XUV-Saat', len: 4.69, base: 'innova', weight: 0.2, tints: [0xf4f4f2, 0x1b1b1b, 0xc0281f, 0x8a8f95] },
  palio: { name: 'Fiyat Paliyo', len: 3.83, base: 'swift', weight: 0.08, tints: [0xc0281f, 0xf4f4f2, 0xc5c8cc] },
  punto: { name: 'Fiyat Pantu', len: 3.99, base: 'swift', weight: 0.08, tints: [0xf4f4f2, 0xc0281f, 0x1b1b1b] },
  linea: { name: 'Fiyat Liniya', len: 4.56, base: 'city', weight: 0.06, tints: [0xf4f4f2, 0x8a8f95, 0x1b1b1b] },
  uno: { name: 'Fiyat Unu', len: 3.69, base: 'alto', weight: 0.06, tints: [0xf4f4f2, 0xc0281f, 0x2a59b8] },
  getz: { name: 'Hundai Gets', len: 3.81, base: 'i10', weight: 0.15, tints: [0xc5c8cc, 0xf4f4f2, 0x2a59b8] },
  sx4: { name: 'Maroti Es-Ex-4', len: 4.49, base: 'dzire', weight: 0.12, tints: [0xf4f4f2, 0xc5c8cc, 0x1b1b1b] },
  triber: { name: 'Renolt Traiber', len: 3.99, base: 'ertiga', weight: 0.2, tints: [0xf4f4f2, 0xd8641a, 0x8a8f95] },
  spresso: { name: 'Maroti Es-Presso', len: 3.57, base: 'alto', weight: 0.25, tints: [0xd8641a, 0xf4f4f2, 0xc5c8cc] },
  jimny: { name: 'Maroti Jimmy', len: 3.99, base: 'thar', weight: 0.08, tints: [0xf2c200, 0x2e3a2a, 0xf4f4f2] },
};

/**
 * Uploads named as downloaded (Sketchfab file names) → game type: first match wins. Variants
 * that are not ordinary road cars (rally, convertible, half-built, wheels only…) are skipped,
 * and so is anything not on this list (cars Mumbai hardly sees).
 */
export const FILE_TYPES = [
  [/wrc|rally|cabriolet|convertible|in_progress|3d-printing|stls|escada|velg|unrefined|karimun/i, null],
  [/ambassador/i, 'ambassador'], [/contessa/i, 'contessa'], [/(maruti|suzuki)[_ -]*(suzuki[_ -]*)?800|ps1-style_maruti_800/i, 'm800'],
  [/alto/i, 'alto'], [/wagon[_ ]?r(?!.*karimun)/i, 'wagonr'], [/dzire/i, 'dzire'], [/swift/i, 'swift'], [/grand_i10|hyundai_i10/i, 'i10'],
  [/santro/i, 'santro'], [/creta/i, 'creta'], [/innova/i, 'innova'], [/ertiga/i, 'ertiga'], [/eeco/i, 'eeco'], [/scorpio/i, 'scorpio'],
  [/thar/i, 'thar'], [/bolero/i, 'bolero'], [/gypsy/i, 'gypsy'], [/zen/i, 'zen'], [/tata_ace/i, 'ace'], [/sierra/i, 'sierra'],
  [/safari/i, 'safari'], [/tiago/i, 'tiago'], [/punch/i, 'punch'], [/verna|accent/i, 'verna'], [/ciaz/i, 'ciaz'], [/baleno/i, 'baleno'],
  [/brezza/i, 'brezza'], [/seltos/i, 'seltos'], [/fortuner|endeavour|everest/i, 'fortuner'], [/xuv/i, 'xuv'], [/palio/i, 'palio'],
  [/punto/i, 'punto'], [/linea/i, 'linea'], [/fiat_uno/i, 'uno'], [/getz/i, 'getz'], [/sx4/i, 'sx4'], [/triber/i, 'triber'],
  [/s-presso/i, 'spresso'], [/jimny/i, 'jimny'],
];
/**
 * Uploaded files checked by eye after the conversion (scripts/art-vehicles.mjs): only these are
 * used. Many detailed models come out with missing panels or open doors; add a file here once
 * its close-up looks right (`node scripts/art-index.mjs --preview`, then look at it in the game).
 */
export const VERIFIED = new Set([
  '1993_fiat_punto', 'suzuki_sx4_sportback', '2011_suzuki_wagon_r_rr', '2013_suzuki_jimny', 'maruti_suzuki_alto_800_only_body_very_basic',
  'basic_old_hindustan_ambassador_car_only_body', 'fiat__linea_2006', 'fiat_uno_2001', 'hyundai_verna', 'hyundai_creta', 'hyundai_getz_2006',
  'hyundai_santro_xing', 'new_kia_seltos_2026', 'mahindra_-_thar_roxx', 'mahindra_scorpio', 'mahindra_xuv_7x0', 'maruti_800_ac',
  'maruti_suzuki_ciaz', 'maruti_suzuki_eeco_modified', 'maruti_suzuki_gypsy', 'maruti_zen_car_3d_model_free_to_use', 'tata_safari', 'tata_sierra',
]);
/** The game type for an uploaded file name: an exact type id, an alias match, or null (not used). */
export function typeForFile(name, fleetIds = []) {
  const base = name.replace(/\.glb$/i, '').toLowerCase();
  if (!VERIFIED.has(base) && !fleetIds.includes(base) && !VEHICLE_ART[base]) return null; // not checked yet
  if (fleetIds.includes(base) || VEHICLE_ART[base]) return base;
  for (const [re, id] of FILE_TYPES) if (re.test(base)) return id;
  return null;
}

/** Length to scale an uploaded model to: its table entry, the fleet type's length, its own size if plausible, else 4 m. */
export function lengthFor(id, ownLength, fleetLen = {}) {
  if (VEHICLE_ART[id]?.len) return VEHICLE_ART[id].len;
  if (fleetLen[id]) return fleetLen[id];
  return ownLength > 2.5 && ownLength < 13 ? ownLength : 4;
}
