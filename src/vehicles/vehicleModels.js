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
};

/** Length to scale an uploaded model to: its table entry, the fleet type's length, its own size if plausible, else 4 m. */
export function lengthFor(id, ownLength, fleetLen = {}) {
  if (VEHICLE_ART[id]?.len) return VEHICLE_ART[id].len;
  if (fleetLen[id]) return fleetLen[id];
  return ownLength > 2.5 && ownLength < 13 ? ownLength : 4;
}
