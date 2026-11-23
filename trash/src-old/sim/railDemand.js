// How busy Mumbai's railways are, by hour, direction and station: one model for the local
// trains (src/sim/trains.js) and the metro (src/sim/metro.js).
//
// Sources (docs/research/metro/reports/, notes in research_notes/Mumbai local trains and
// stations/local_crowding_and_culture.md and research_notes/Mumbai Metro A to Z/):
//  - about 70–75 lakh trips a weekday on the locals; morning peak about 7:30–11 am towards
//    Churchgate and CSMT, evening peak about 5–9 pm (to 10:30 pm on the Virar side) out of town;
//    "super dense crush load" of 14–16 standing people per m² at peak: a 12-car rated for 3,504
//    carries 5,000–6,000+;
//  - busiest in the map: Dadar, Andheri, Kurla, Ghatkopar, CSMT, Churchgate, Bandra; Line 1 metro
//    runs near crush between Ghatkopar and Andheri, Line 3 is roomy;
//  - weekends carry about 0.58 of a weekday on the metro (Line 3, September 2026).
// The hourly shape is a model built from those figures (no operator publishes hourly counts).

/** Share of the day's riders by hour, 1 = the busiest hour. */
const HOUR = [0.1, 0.03, 0.02, 0.03, 0.1, 0.25, 0.45, 0.75, 0.95, 1.0, 0.85, 0.6, 0.52, 0.5, 0.5, 0.52, 0.6, 0.8, 1.0, 0.95, 0.8, 0.55, 0.35, 0.2];

/** How busy this hour is (0–1), smoothly between the hours. Weekends are flatter and quieter. */
export function hourIndex(hour, weekend = false) {
  const h = ((hour % 24) + 24) % 24, i = Math.floor(h), f = h - i;
  let v = HOUR[i] * (1 - f) + HOUR[(i + 1) % 24] * f;
  if (weekend) v = 0.58 * (0.55 * v + 0.45 * (h > 9 && h < 21 ? 0.85 : v));
  return v;
}

/**
 * Share of the hour's riders travelling towards town (Churchgate, CSMT, Cuffe Parade): most of
 * them in the morning, few in the evening.
 */
export function townShare(hour) {
  const h = ((hour % 24) + 24) % 24;
  const am = smooth(6.8, 7.8, h) * (1 - smooth(10.8, 11.8, h)), pm = smooth(16.2, 17.2, h) * (1 - smooth(21.0, 22.4, h));
  return 0.5 + 0.28 * am - 0.25 * pm;
}

function smooth(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

/** Daily footfall of stations relative to an ordinary one (the big interchanges carry 2–3×). */
const WEIGHT = {
  Churchgate: 2.2, 'Marine Lines': 0.8, 'Charni Road': 0.7, 'Grant Road': 1.0, 'Mumbai Central': 1.3, Mahalaxmi: 0.6, 'Lower Parel': 1.3,
  Prabhadevi: 1.0, Dadar: 3.0, 'Matunga Road': 0.6, 'Mahim Junction': 0.8, Bandra: 1.8, 'Khar Road': 0.8, 'Santa Cruz': 1.1, 'Vile Parle': 1.2,
  Andheri: 2.8, Jogeshwari: 1.0, 'Chhatrapati Chai Terminus': 2.4, Masjid: 0.9, 'Sandhurst Road': 0.6, Byculla: 1.0, Chinchpokli: 0.6,
  'Currey Road': 0.7, Parel: 1.2, Matunga: 0.8, Sion: 1.0, Kurla: 2.5, Vidyavihar: 0.8, Ghatkopar: 2.4, 'Dockyard Road': 0.5, 'Reay Road': 0.4,
  'Cotton Green': 0.6, Sewri: 0.6, 'Vadala Road': 1.0, 'Guru Tegh Bahadur Nagar': 0.6, 'Chuna Bhatti': 0.6, "King's Circle": 0.7,
  'Tilak Nagar': 0.8, Chembur: 1.4, Govandi: 0.9,
  // Metro (Line 1 and Line 3 names as the game shows them)
  'Marol Naka': 2.0, 'Airport Road': 1.2, Chakala: 1.4, 'Western Express Highway': 1.4, 'D. N. Nagar': 1.1, Versova: 1.0, 'Azad Nagar': 0.9,
  'Saki Naka': 1.3, 'Asalpha': 0.8, 'Jagruti Nagar': 0.8, 'Bandra Kurla Complex': 1.6, 'Cuffe Parade': 1.0, 'Hutatma Chowk': 1.2, 'Siddhi-Vinayaka Mandir': 1.3,
};
export function stationWeight(name) { return WEIGHT[name] ?? 0.9; }

/**
 * How full a train is (1 = every seat taken and the aisles full, about 1.4 = crush with people
 * at the doors). `toTown` is the direction, `fromTown` metres from the town terminus, `lineLen`
 * metres of the line in the map, `fast` for fast locals (fuller), `metro` for metro trains.
 */
export function trainLoad({ hour, toTown, fromTown, lineLen = 22000, fast = false, metro = 0, weekend = false }) {
  const idx = hourIndex(hour, weekend), share = toTown ? townShare(hour) : 1 - townShare(hour);
  let f = 0.15 + 1.2 * idx * (share / 0.5) * 0.62;
  // Into town the train empties at the big stations; out of town it fills at them.
  const k = Math.min(1, fromTown / Math.max(4000, lineLen * 0.45));
  f *= toTown ? 0.45 + 0.55 * k : 0.55 + 0.45 * k;
  if (fast) f *= 1.1;
  if (metro) f *= metro; // per line: Line 1 about 1, Line 3 about 0.35
  return Math.max(0.05, Math.min(1.5, f));
}

/** How much fuller or emptier each kind of coach is than the train as a whole (COACH_CLASS order). */
export const COACH_LOAD = [1, 0.75, 0.85, 0.6, 0.9, 0.5];

/**
 * People waiting on one side of a platform near the player: the hour's flow for that
 * direction, the station's size, and how long since the last train took them away.
 */
export function waiting({ name, hour, toTown, sinceTrain = 60, weekend = false }) {
  const idx = hourIndex(hour, weekend), share = toTown ? townShare(hour) : 1 - townShare(hour);
  const flow = stationWeight(name) * idx * (share / 0.5);
  return flow * (8 + Math.min(sinceTrain, 240) * 0.16);
}
