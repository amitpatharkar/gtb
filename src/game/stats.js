// Player statistics (pause menu → Stats): kept in this browser across sessions.
const KEY = 'gtb.stats';
export const STAT_LABELS = {
  sessions: ['Times played', (v) => v],
  timePlayed: ['Time played', (v) => `${Math.floor(v / 3600)} h ${Math.floor((v % 3600) / 60)} min`],
  walked: ['Distance on foot', (v) => `${(v / 1000).toFixed(2)} km`],
  driven: ['Distance driven', (v) => `${(v / 1000).toFixed(2)} km`],
  topSpeed: ['Top speed', (v) => `${Math.round(v * 3.6)} km/h`],
  carsEntered: ['Cars driven', (v) => v],
  crashes: ['Crashes', (v) => v],
  shots: ['Shots fired', (v) => v],
  hits: ['Shots that hit something that moves', (v) => v],
  jumps: ['Jumps', (v) => v],
  wasted: ['Times wasted', (v) => v],
  waypoints: ['Destinations reached', (v) => v],
};

export class Stats {
  constructor() {
    this.s = Object.fromEntries(Object.keys(STAT_LABELS).map((k) => [k, 0]));
    try { Object.assign(this.s, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* none */ }
    this.s.sessions++;
    this.saveIn = 0;
  }
  add(k, v = 1) { this.s[k] = (this.s[k] || 0) + v; }
  max(k, v) { if (v > (this.s[k] || 0)) this.s[k] = v; }
  tick(dt) { this.s.timePlayed += dt; this.saveIn -= dt; if (this.saveIn <= 0) { this.saveIn = 10; this.save(); } }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.s)); } catch { /* private mode */ } }
  rows() { return Object.entries(STAT_LABELS).map(([k, [label, fmt]]) => [label, fmt(this.s[k] || 0)]); }
}
