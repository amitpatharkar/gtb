// Facade kinds (src/world/tileFormat.js FACADE): which era of windows and which details a
// building gets, from its district, the street it fronts (street library profile) and its
// style. Stored in the high 4 bits of the building's style byte. The game turns it into window
// types (facadeRules.js), Art Deco corners and eyebrows, Gothic gables and turrets, chawl
// galleries and tiled roofs (src/world/mesh/buildings.js).
//
// Sources: docs/research/mumbai-guide.md (Marine Drive, Churchgate, Fort, Girgaon, Parel,
// Byculla, Dadar block guides) and the street library profiles.
import { STYLE } from './districts.mjs';
import { FACADE, BUILDING_FLAG } from '../../src/world/tileFormat.js';

/** 0..1 hash of an OSM id and a salt (full avalanche, so different salts are independent). */
function hash01(id, salt) {
  let h = Math.imul((id % 4294967296) | 0, 0x9e3779b1) ^ Math.imul(Math.floor(id / 4294967296) + salt * 0x632be5, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Share of low-rise plaster buildings that keep their pre-1960 windows (wooden casements and
// louvred shutters) by district; everything else gets modern aluminium sliders.
const OLD = {
  'Apollo Bunder': 0.6, 'Kala Ghoda': 0.7, Chowpatty: 0.6, 'Crawford Market': 0.85, 'Dhobi Talao': 0.85, Churchgate: 0.5,
  CST: 0.7, 'Ballard Estate': 0.6, Fort: 0.75, Kalbadevi: 0.9, Girgaon: 0.9, 'Grant Road': 0.75, Tardeo: 0.35,
  'Cuffe Parade': 0.15, Mazgaon: 0.75, Byculla: 0.75, 'Marine Drive': 0.5, 'Malabar Hill': 0.25, Colaba: 0.6,
  'Bhendi Bazaar': 0.9, Nagpada: 0.8, 'Dongri Mandvi': 0.85, 'Mumbai Central': 0.55, 'Reay Road': 0.6,
  'Haji Ali': 0.3, Worli: 0.3, 'Worli Koliwada': 0.7, 'Lower Parel': 0.35, Parel: 0.7, 'Sewri Wadala': 0.45,
  Prabhadevi: 0.45, Dadar: 0.7, Matunga: 0.65, Mahim: 0.6, Dharavi: 0.5, Sion: 0.35,
  'Bandra West': 0.3, Bandstand: 0.2, 'Bandra East': 0.3, Khar: 0.25, Santacruz: 0.3, 'Vile Parle': 0.35,
  Kurla: 0.4, 'Saki Naka': 0.3, Chembur: 0.25, Ghatkopar: 0.25,
};
// Share of 2–5 storey plaster blocks that are chawls (rooms off long open galleries).
const CHAWL = {
  Girgaon: 0.5, Parel: 0.45, Byculla: 0.35, Dadar: 0.3, 'Grant Road': 0.3, Mazgaon: 0.3, Kalbadevi: 0.15,
  'Bhendi Bazaar': 0.25, Nagpada: 0.3, 'Dongri Mandvi': 0.2, 'Mumbai Central': 0.25, 'Reay Road': 0.2,
  'Sewri Wadala': 0.25, Prabhadevi: 0.25, Worli: 0.15, 'Lower Parel': 0.2, Mahim: 0.12, Matunga: 0.1, Sion: 0.12,
  Kurla: 0.15, Ghatkopar: 0.1, 'Dhobi Talao': 0.15, Tardeo: 0.12,
};
const CHAWL_PROFILE = { 'girgaon-chawl-street': 0.6, 'byculla-mill-market': 0.4, 'arterial-mixed': 0.25, 'muslim-quarter-bazaar': 0.2, 'kalbadevi-gully': 0.12 };
// Victorian Gothic stone (pointed arches, gables, turrets): the Fort precinct and its maidan edge.
const GOTHIC = new Set(['Fort', 'Kala Ghoda', 'CST', 'Churchgate', 'Ballard Estate', 'Apollo Bunder', 'Crawford Market', 'Dhobi Talao']);
const GOTHIC_PROFILE = new Set(['heritage-boulevard', 'fort-arcade-commercial', 'fort-narrow-commercial']);
// Art Deco pastels (Marine Drive, Oval Maidan, Churchgate, Dadar Parsi Colony): about half the
// Deco blocks are repainted in one of these; the rest keep the street's cream and sand.
const DECO_PASTELS = [0xf3e3c3, 0xf0d5c6, 0xd9e7d6, 0xf3e4b0, 0xd8e3e8, 0xf2d6b8, 0xf6f1e6, 0xebdab2, 0xd3e4de, 0xf4dccf];
const CHURCH = new Set(['church', 'cathedral', 'chapel']);

/**
 * Facade kind for one building, plus a colour override (or null).
 * @param {object} o id, style, flags, type, h (m), levels, area (m²), district (districts.mjs
 *   entry), profile (street library profile or null)
 */
export function facadeKind({ id, style, flags, type, h, levels, area, district, profile }) {
  const dn = district?.name || '';
  const pid = profile?.id || '';
  const r = hash01(id, 41), r2 = hash01(id, 43);
  if (flags & BUILDING_FLAG.WALL) return { facade: FACADE.MODERN, color: null };
  if (style === STYLE.GLASS || style === STYLE.SHED || style === STYLE.BRICK) return { facade: FACADE.MODERN, color: null };
  if (style === STYLE.STONE || style === STYLE.BASALT) {
    const gothic = flags & BUILDING_FLAG.HERITAGE || CHURCH.has(type) || GOTHIC.has(dn) || GOTHIC_PROFILE.has(pid);
    return { facade: gothic ? FACADE.GOTHIC : FACADE.OLD, color: null };
  }
  if (style === STYLE.DECO) {
    // Hiranandani's neo-classical towers use the Deco wall style but are modern.
    if (h > 40 || dn === 'Hiranandani') return { facade: FACADE.MODERN, color: null };
    return { facade: FACADE.DECO, color: r2 < 0.5 ? DECO_PASTELS[Math.floor(hash01(id, 47) * DECO_PASTELS.length)] : null };
  }
  // Plaster, weathered, concrete.
  if (h <= 19 && levels >= 2 && area >= 140 && area <= 4000 && style !== STYLE.CONCRETE && !(flags & BUILDING_FLAG.HERITAGE)
    && ['yes', 'residential', 'apartments', 'house', 'terrace', 'commercial', 'retail'].includes(type || 'yes')) {
    const share = Math.max(CHAWL[dn] || 0, CHAWL_PROFILE[pid] || 0) * (style === STYLE.WEATHERED ? 1.2 : 0.8);
    if (r < share) return { facade: FACADE.CHAWL, color: null };
  }
  if (h <= 26) {
    let old = OLD[dn] ?? 0.12;
    if (style === STYLE.WEATHERED) old = Math.min(1, old + 0.2);
    if (style === STYLE.CONCRETE) old *= 0.35;
    if (r2 < old) return { facade: FACADE.OLD, color: null };
  }
  return { facade: FACADE.MODERN, color: null };
}
