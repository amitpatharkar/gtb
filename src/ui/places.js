// Places in the playable area (world metres; x = east, z = south, from the converter's origin).
// Real landmarks get altered names (docs/research/mumbai-guide.md). Used by the map, the phone's
// Maps app, the GPS and onboarding. kind → map filter category and icon.
export const PLACES = [
  { id: 'gateway', name: 'Gateway of Indiyaa', kind: 'landmark', x: -1625, z: 11959 },
  { id: 'palace', name: 'Royal Chaj Mahal Palace', kind: 'landmark', x: -1781, z: 11966 },
  { id: 'regal', name: 'Regale Talkies', kind: 'landmark', x: -1895, z: 11766 },
  { id: 'museum', name: 'Prince of Whales Museum', kind: 'landmark', x: -1832, z: 11412 },
  { id: 'clocktower', name: 'Rajabhai Tick-Tock Tower', kind: 'landmark', x: -2053, z: 11102 },
  { id: 'afghan', name: 'St Jon the Afghan Kirk', kind: 'landmark', x: -3300, z: 13760 },
  { id: 'kalaghoda', name: 'Kala Ghoda', kind: 'area', x: -1874, z: 11290 },
  { id: 'causeway', name: 'Colaba Causeway market', kind: 'area', x: -1937, z: 12397 },
  { id: 'sassoon', name: 'Sassoon Dock', kind: 'area', x: -2463, z: 13138 },
  { id: 'radioclub', name: 'Apollo Bunder promenade', kind: 'area', x: -1684, z: 12100 },
];

// Map filter categories (pause map legend, §20B of the UI study: show only what you need).
export const CATEGORIES = {
  landmark: { label: 'Landmarks', colour: '#f2b705', icon: '★' },
  area: { label: 'Neighbourhoods', colour: '#9ad0ff', icon: '◆' },
  fuel: { label: 'Petrol pumps', colour: '#5fd38b', icon: '⛽' },
  car: { label: 'Parked cars', colour: '#4fa3ff', icon: '■' },
  waypoint: { label: 'Waypoint and route', colour: '#c46bff', icon: '◉' },
};

/** Points of interest from the map index too (petrol pumps inside the area). */
export function placesFrom(index, area) {
  const inside = (x, z) => x > area.minX && x < area.maxX && z > area.minZ && z < area.maxZ;
  const fuel = (index.fuel || []).filter(([x, z]) => inside(x, z)).map(([x, z], i) => ({ id: `fuel${i}`, name: 'Petrol pump', kind: 'fuel', x, z }));
  return [...PLACES.filter((p) => inside(p.x, p.z)), ...fuel];
}
