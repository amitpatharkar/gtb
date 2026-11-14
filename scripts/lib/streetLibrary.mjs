// The South Mumbai street library (docs/research/street-library/, built by the owner from the
// map data plus a Street View survey): 847 named streets, each with a "street profile" — what
// the street looks like at ground level. The converter dresses every road by its profile:
// buildings along it (styles, storeys, colours, shops, construction netting), street trees
// (species and density), lamp posts, kerb paint, and, through the tiles, parking and street
// life at runtime. Streets not in the library keep the district rules (scripts/lib/districts.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { STYLE } from './districts.mjs';

/** Lamp post types (also understood by src/world/props.js): stored in the point's size. */
export const LAMP = { STANDARD: 0, TALL: 1, HERITAGE: 2, GLOBE: 3 };
export const lampSize = (type) => 1 + type * 0.25;

const has = (text, re) => re.test(String(text || ''));

/** Turn a profile's prose into numbers the converter and the game can use. */
function normalise(p, index) {
  const b = p.buildings || {}, sec = p.section || {}, tr = p.trees || {};
  const styles = b.styles && typeof b.styles === 'object' && Object.keys(b.styles).length ? Object.fromEntries(Object.entries(b.styles).filter(([k]) => k in STYLE)) : null;
  const storeys = Array.isArray(b.storeys) && b.storeys.length === 2 ? b.storeys : null;
  const colours = Array.isArray(b.colours) && b.colours.length ? b.colours.filter((c) => /^#[0-9a-f]{6}$/i.test(c)) : null;
  const gf = String(b.ground_floor || '');
  const shops = has(gf, /few shops|occasional/i) ? 0.25 : has(gf, /no shops|compound|gates|bungalow|residential entrances/i) ? 0.12
    : has(gf, /shop|store|stall|eater|restaurant|khanaval|showroom|godown|bazaar|market|cafe|caf[eé]|bank|office|workshop/i) ? 0.85 : null;
  const details = [...(b.details || []), ...(p.clutter || [])].join(' · ');
  const netting = has(details, /netting|scaffold/i) ? 0.1 : 0;
  const clutter = (p.clutter || []).join(' · ');
  const lights = String(p.lights || '');
  const lamp = has(lights, /triple|lantern|heritage/i) ? LAMP.HERITAGE : has(lights, /globe/i) ? LAMP.GLOBE : has(lights, /tall|galvanised|necklace|curve/i) ? LAMP.TALL : LAMP.STANDARD;
  const medianLamp = has(lights, /median/i) || has(sec.median, /lamp|post/i);
  const kerbText = String(sec.kerb || '');
  const kerb = has(kerbText, /black-white|black and white/i) ? 'bw' : has(kerbText, /black-yellow|black and yellow/i) ? 'by' : has(kerbText, /plain|grey|none/i) ? 'plain' : null;
  const median = has(sec.median, /black-white/i) ? 'bw' : has(sec.median, /black-yellow/i) ? 'by' : null;
  const planted = has(sec.median, /planted|hedge|garden|green/i);
  // Parking pressure at the kerb: 0 none … 1 nose-to-tail on both sides (+ double parking).
  const parking = has(clutter, /few parked|no parking/i) ? 0.15 : has(clutter, /double park/i) ? 1 : has(clutter, /nose-to-tail|both kerbs|rows of|parked cars|taxi stand|taxis parked/i) ? 0.8 : has(clutter, /parked/i) ? 0.55 : 0.45;
  return {
    id: p.id, index, label: p.label, styles, storeys, colours, shops, netting,
    treesPer100: typeof tr.per_100m === 'number' ? tr.per_100m : null, treeMix: tr.game_points && Object.keys(tr.game_points).length ? tr.game_points : null,
    lamp, medianLamp, kerb, median, planted, parking,
    stalls: has(clutter, /stall|thela|vendor|hawker|seller|cart/i) ? 1 : 0.4,
    construction: has(clutter, /corrugated|hoarding|construction site/i) ? 1 : 0,
    traffic: String(p.traffic || ''), sounds: p.sounds || [],
  };
}

/** Load the library. Returns null if the files are missing (the converter then uses districts only). */
export function loadStreetLibrary(root) {
  const dir = path.join(root, 'docs/research/street-library');
  if (!fs.existsSync(path.join(dir, 'streets.json')) || !fs.existsSync(path.join(dir, 'profiles.json'))) return null;
  const streets = JSON.parse(fs.readFileSync(path.join(dir, 'streets.json'), 'utf8'));
  const raw = JSON.parse(fs.readFileSync(path.join(dir, 'profiles.json'), 'utf8'));
  const profiles = new Map(raw.profiles.map((p, i) => [p.id, normalise(p, i + 1)]));
  const byWay = new Map();
  for (const s of streets) for (const id of s.osm_way_ids || []) byWay.set(id, s);
  return {
    profiles,
    streets,
    newDistricts: raw.new_districts || [],
    /** The profile for an OSM way (zones of long streets picked by latitude), or null. */
    forWay(id, lat) {
      const s = byWay.get(id);
      if (!s) return null;
      const zone = s.zones?.find((z) => lat >= z.lat[0] && lat < z.lat[1]);
      return profiles.get(zone?.profile || s.profile) || null;
    },
    /** What the game needs at runtime, by profile index (1-based; 0 = no profile). */
    runtimeTable() {
      return [...profiles.values()].map((p) => ({ id: p.id, parking: p.parking, stalls: p.stalls, traffic: p.traffic.slice(0, 120), sounds: p.sounds }));
    },
  };
}
