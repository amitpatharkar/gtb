// GPS and wayfinding (§6–7 of the UI study): choose a destination → the route is calculated
// (A* in src/ui/mapWorker.js on the whole road network, one-ways respected) → it is drawn on the
// minimap and the full map → the remaining distance counts down → arriving confirms it.
// Off the route for a while → it quietly re-routes. One destination at a time, with an owner
// ('user' waypoint, 'objective'); the objective's route wins while it is active.
const BASE = import.meta.env.BASE_URL;
const ARRIVE = 22;       // metres
const OFF_ROUTE = 35;    // metres from the route before re-routing
const REROUTE_EVERY = 2; // seconds

export class Nav {
  constructor(world) {
    this.world = world;
    this.worker = null; this.ready = null;
    this.calls = new Map(); this.nextId = 1;
    this.targets = new Map(); // owner → { x, z, label }
    this.route = null;        // Float32Array [x, z, ...]
    this.remaining = 0;
    this.offTime = 0; this.timer = 0;
    this.onArrive = null;
    this.map = null;          // drawing chunks for the full map (from the worker)
  }

  load() {
    if (this.ready) return this.ready;
    this.worker = new Worker(new URL('./mapWorker.js', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e) => { const c = this.calls.get(e.data.id); if (!c) return; this.calls.delete(e.data.id); if (e.data.error) c.reject(new Error(e.data.error)); else c.resolve(e.data.result); };
    const tag = encodeURIComponent(this.world.index.generated || '');
    this.ready = this.call({ type: 'load', url: new URL(`${BASE}tiles/overview.bin.gz?v=${tag}`, location.href).href }).then((r) => { this.map = r; return r; });
    return this.ready;
  }

  call(msg) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => { this.calls.set(id, { resolve, reject }); this.worker.postMessage({ id, ...msg }); });
  }

  get target() { return this.targets.get('objective') || this.targets.get('user') || null; }

  /** Set (or clear with null) the destination for an owner. */
  async set(owner, t, from) {
    if (t) this.targets.set(owner, t); else this.targets.delete(owner);
    this.route = null; this.remaining = 0;
    if (this.target && from) await this.reroute(from.x, from.z, from.heading);
  }

  async reroute(x, z, heading = null) {
    const t = this.target;
    if (!t) return;
    await this.load();
    const r = await this.call({ type: 'route', fx: x, fz: z, heading, gx: t.x, gz: t.z }).catch(() => null);
    if (this.target !== t) return;
    this.route = r ? Float32Array.from([x, z, ...r.path]) : Float32Array.from([x, z, t.x, t.z]);
  }

  /** Per frame: distance left, arrival, re-routing when the player leaves the route. */
  update(dt, x, z, heading) {
    const t = this.target;
    if (!t) return;
    const d = Math.hypot(t.x - x, t.z - z);
    if (d < ARRIVE) {
      const owner = this.targets.get('objective') === t ? 'objective' : 'user';
      this.targets.delete(owner); this.route = null; this.remaining = 0;
      this.onArrive?.(owner, t);
      return;
    }
    if (!this.route) { this.timer -= dt; if (this.timer <= 0) { this.timer = REROUTE_EVERY; this.reroute(x, z, heading); } this.remaining = d; return; }
    // Distance along the route from the nearest point onwards.
    const R = this.route;
    let best = Infinity, at = 0, frac = 0;
    for (let i = 0; i + 3 < R.length; i += 2) {
      const ax = R[i], az = R[i + 1], dx = R[i + 2] - ax, dz = R[i + 3] - az, l2 = dx * dx + dz * dz || 1;
      const k = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
      const dd = Math.hypot(ax + dx * k - x, az + dz * k - z);
      if (dd < best) { best = dd; at = i; frac = k; }
    }
    let rem = best + Math.hypot(R[at + 2] - R[at], R[at + 3] - R[at + 1]) * (1 - frac);
    for (let i = at + 2; i + 3 < R.length; i += 2) rem += Math.hypot(R[i + 2] - R[i], R[i + 3] - R[i + 1]);
    this.remaining = rem;
    this.nearest = at;
    if (best > OFF_ROUTE) { this.offTime += dt; if (this.offTime > REROUTE_EVERY) { this.offTime = 0; this.reroute(x, z, heading); } }
    else this.offTime = 0;
  }

  /** "350 m" / "1.4 km". */
  static distance(m) { return m < 950 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(1)} km`; }
}
