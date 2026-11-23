// Adaptive onboarding (§20D of the UI study): a short chain of objectives that teaches the
// controls by doing. How much it explains depends on the Guidance setting:
//   more  — new players: every step with a hint showing the button
//   less  — returning players: the objectives, no hints
//   off   — experienced players: nothing
// "auto" picks more on the first visit, less on visits 2–3, off after that.
// Each step: text (the current objective), hint (prompt with {action} glyphs), target (GPS),
// done(ctx) → true when completed.
export const STEPS = [
  { id: 'look', text: 'Look around Apollo Bunder.', hint: 'Move the camera with {look}. Walk with {move}, sprint with {sprint}.', done: (c) => c.looked > 2 && c.walked > 8 },
  { id: 'car', text: 'Get into a parked car.', hint: 'Walk up to a car and press {enter}.', target: (c) => c.nearestCar(), done: (c) => c.driving },
  { id: 'drive', text: 'Drive to the Gateway of Indiyaa.', hint: 'Accelerate {throttle}, brake and reverse {brake}, handbrake {handbrake}. Follow the purple route on the radar.', place: 'gateway', done: (c) => c.arrived === 'gateway' },
  { id: 'exit', text: 'Get out of the car.', hint: 'Press {enter} to get out.', done: (c) => !c.driving },
  { id: 'wheel', text: 'Pick the pistol from the weapon wheel.', hint: 'Hold {wheel}, point at the pistol, let go.', done: (c) => c.weapon === 'pistol' && c.usedWheel },
  { id: 'shoot', text: 'Shoot a crate on the promenade.', hint: 'Aim with {aim}, shoot with {fire}, reload with {reload}.', target: (c) => c.nearestProp(), done: (c) => c.hitProp },
  { id: 'map', text: 'Set your own destination on the map.', hint: 'Open the map with {map}, click a street to set a waypoint, then follow the route.', done: (c) => c.userArrived },
];

export class Onboarding {
  constructor(level, sessions) {
    this.level = level === 'auto' ? (sessions <= 1 ? 'more' : sessions <= 3 ? 'less' : 'off') : level;
    let doneIds = [];
    try { doneIds = JSON.parse(localStorage.getItem('gtb.onboarding') || '[]'); } catch { /* none */ }
    this.done = new Set(doneIds);
    this.step = null;
    this.next();
  }
  get active() { return this.level !== 'off' && !!this.step; }
  next() { this.step = STEPS.find((s) => !this.done.has(s.id)) || null; this.started = 0; }
  complete() {
    this.done.add(this.step.id);
    try { localStorage.setItem('gtb.onboarding', JSON.stringify([...this.done])); } catch { /* */ }
    const finished = this.step;
    this.next();
    return finished;
  }
  reset() { this.done.clear(); try { localStorage.removeItem('gtb.onboarding'); } catch { /* */ } this.next(); }
}
