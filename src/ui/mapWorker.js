// Web Worker behind the full-screen map and the GPS. It downloads the overview file once
// (src/world/overviewFormat.js), builds the road graph (one-ways directed, loose ends joined)
// and answers route requests with A*, so long trips (Gateway → Powai) never freeze the game.
// It also cuts the map's drawing data into 1 km chunks the main thread turns into Path2Ds.
import { decodeOverview, OVERVIEW_LAYER } from '../world/overviewFormat.js';
import { ROAD } from '../world/tileFormat.js';

const CHUNK = 1000; // metres
// Cost per metre by road class: like a taxi driver, prefer main roads a little and avoid
// service lanes and dirt tracks. MIN_COST keeps the A* distance estimate admissible.
const COST = { [ROAD.MOTORWAY]: 0.85, [ROAD.TRUNK]: 0.85, [ROAD.PRIMARY]: 0.9, [ROAD.SECONDARY]: 0.95, [ROAD.TERTIARY]: 1, [ROAD.LINK]: 0.95, [ROAD.RESIDENTIAL]: 1.1, [ROAD.LIVING]: 1.2, [ROAD.SERVICE]: 1.4, [ROAD.TRACK]: 1.6 };
const MIN_COST = 0.85;
const JOIN = 2.5;    // loose road ends this close to another node are joined (as in traffic.js)
const SEG_CELL = 50; // metres, grid for nearest-road queries
const UTURN = 60;    // extra cost (m) for starting the route behind the car

let graph = null;

self.onmessage = async (e) => {
  const { id, type } = e.data;
  try {
    let out = { result: null, transfer: [] };
    if (type === 'load') out = await load(e.data.url);
    else if (type === 'route') out = route(e.data);
    else if (type === 'random') out.result = randomNode(e.data);
    self.postMessage({ id, result: out.result }, out.transfer);
  } catch (err) {
    self.postMessage({ id, error: String((err && err.stack) || err) });
  }
};

async function gunzipIfNeeded(buf) {
  const u8 = new Uint8Array(buf);
  if (u8[0] !== 0x1f || u8[1] !== 0x8b) return u8; // the server already unzipped it
  const stream = new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function load(url) {
  const t0 = performance.now();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const ov = decodeOverview(await gunzipIfNeeded(await res.arrayBuffer()));
  const t1 = performance.now();
  graph = buildGraph(ov);
  const t2 = performance.now();
  const transfer = [];
  const chunks = buildChunks(ov, transfer);
  return {
    result: {
      chunks, labels: labels(ov),
      stats: { nodes: graph.n, edges: graph.adj.length, roads: ov.roads.length, decodeMs: Math.round(t1 - t0), graphMs: Math.round(t2 - t1), chunkMs: Math.round(performance.now() - t2) },
    },
    transfer,
  };
}

// ------------------------------------------------------------------ road graph
function buildGraph(ov) {
  const q = ov.quant, OFF = 1 << 20;
  const ids = new Map();
  const xs = [], zs = [];
  const node = (x, z) => {
    const k = (Math.round(x * q) + OFF) * 2 * OFF + (Math.round(z * q) + OFF);
    let i = ids.get(k);
    if (i === undefined) { i = xs.length; ids.set(k, i); xs.push(x); zs.push(z); }
    return i;
  };
  const ea = [], eb = [], ew = [];
  const edge = (a, b, w) => { ea.push(a); eb.push(b); ew.push(w); };
  for (const r of ov.roads) {
    const l = r.line, k = COST[r.cls] ?? 1.3;
    let prev = node(l[0], l[1]);
    for (let i = 2; i < l.length; i += 2) {
      const cur = node(l[i], l[i + 1]);
      if (cur === prev) continue;
      const len = Math.hypot(xs[cur] - xs[prev], zs[cur] - zs[prev]);
      edge(prev, cur, len * k);
      if (!(r.flags & 1)) edge(cur, prev, len * k);
      prev = cur;
    }
  }
  const n = xs.length;
  const x = new Float64Array(xs), z = new Float64Array(zs);
  // Undirected neighbour counts, to find dead ends.
  const deg = new Uint16Array(n);
  const seen = new Set();
  for (let i = 0; i < ea.length; i++) {
    const a = Math.min(ea[i], eb[i]), b = Math.max(ea[i], eb[i]), key = a * n + b;
    if (seen.has(key)) continue;
    seen.add(key); deg[a]++; deg[b]++;
  }
  // Join loose ends that nearly touch another node (unconnected OpenStreetMap ways).
  const cell = (v) => Math.floor(v / 5);
  const near = new Map();
  for (let i = 0; i < n; i++) { const k = cell(x[i]) * 1e6 + cell(z[i]); (near.get(k) || near.set(k, []).get(k)).push(i); }
  let joined = 0;
  for (let i = 0; i < n; i++) {
    if (deg[i] > 1) continue;
    let best = -1, bd = JOIN * JOIN;
    for (let gx = -1; gx <= 1; gx++) for (let gz = -1; gz <= 1; gz++) {
      for (const j of near.get((cell(x[i]) + gx) * 1e6 + cell(z[i]) + gz) || []) {
        if (j === i || seen.has(Math.min(i, j) * n + Math.max(i, j))) continue;
        const d = (x[j] - x[i]) ** 2 + (z[j] - z[i]) ** 2;
        if (d < bd) { bd = d; best = j; }
      }
    }
    if (best < 0) continue;
    const w = Math.sqrt(bd) * 1.2;
    edge(i, best, w); edge(best, i, w);
    seen.add(Math.min(i, best) * n + Math.max(i, best));
    deg[i]++; deg[best]++; joined++;
  }
  // Compressed adjacency (CSR): edges out of node i are adj[start[i] .. start[i + 1]).
  const start = new Uint32Array(n + 1);
  for (const a of ea) start[a + 1]++;
  for (let i = 0; i < n; i++) start[i + 1] += start[i];
  const adj = new Int32Array(ea.length), cost = new Float32Array(ea.length), fill = start.slice(0, n);
  for (let i = 0; i < ea.length; i++) { const k = fill[ea[i]]++; adj[k] = eb[i]; cost[k] = ew[i]; }
  // Segment grid for "nearest road" (each undirected segment once).
  const segA = [], segB = [];
  for (let a = 0; a < n; a++) {
    for (let k = start[a]; k < start[a + 1]; k++) {
      const b = adj[k];
      if (a < b || !hasEdge({ start, adj }, b, a)) { segA.push(a); segB.push(b); }
    }
  }
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < n; i++) { x0 = Math.min(x0, x[i]); x1 = Math.max(x1, x[i]); z0 = Math.min(z0, z[i]); z1 = Math.max(z1, z[i]); }
  const nx = Math.max(1, Math.ceil((x1 - x0) / SEG_CELL) + 1), nz = Math.max(1, Math.ceil((z1 - z0) / SEG_CELL) + 1);
  const range = (s) => {
    const a = segA[s], b = segB[s];
    return [Math.floor((Math.min(x[a], x[b]) - x0) / SEG_CELL), Math.floor((Math.min(z[a], z[b]) - z0) / SEG_CELL), Math.floor((Math.max(x[a], x[b]) - x0) / SEG_CELL), Math.floor((Math.max(z[a], z[b]) - z0) / SEG_CELL)];
  };
  const cstart = new Uint32Array(nx * nz + 1);
  for (let s = 0; s < segA.length; s++) { const [i0, j0, i1, j1] = range(s); for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) cstart[j * nx + i + 1]++; }
  for (let c = 0; c < nx * nz; c++) cstart[c + 1] += cstart[c];
  const citems = new Int32Array(cstart[nx * nz]), cfill = cstart.slice(0, nx * nz);
  for (let s = 0; s < segA.length; s++) { const [i0, j0, i1, j1] = range(s); for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) citems[cfill[j * nx + i]++] = s; }
  return {
    n, x, z, deg, start, adj, cost, joined,
    seg: { a: new Int32Array(segA), b: new Int32Array(segB), x0, z0, nx, nz, start: cstart, items: citems },
    g: new Float64Array(n + 1), prev: new Int32Array(n + 1), done: new Uint8Array(n + 1),
  };
}

function hasEdge(G, a, b) {
  for (let k = G.start[a]; k < G.start[a + 1]; k++) if (G.adj[k] === b) return k;
  return -1;
}

/** Nearest road segment to (px, pz) within maxR: { a, b, t (0..1 from a), x, z, d }. */
function nearestSegment(px, pz, maxR = 400) {
  const G = graph, S = G.seg;
  let best = null;
  for (let r = 1; r * SEG_CELL <= maxR + SEG_CELL; r *= 2) {
    const ci = Math.floor((px - S.x0) / SEG_CELL), cj = Math.floor((pz - S.z0) / SEG_CELL);
    for (let j = Math.max(0, cj - r); j <= Math.min(S.nz - 1, cj + r); j++) {
      for (let i = Math.max(0, ci - r); i <= Math.min(S.nx - 1, ci + r); i++) {
        const c = j * S.nx + i;
        for (let k = S.start[c]; k < S.start[c + 1]; k++) {
          const s = S.items[k], a = S.a[s], b = S.b[s];
          const ax = G.x[a], az = G.z[a], dx = G.x[b] - ax, dz = G.z[b] - az;
          const l2 = dx * dx + dz * dz || 1;
          const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2));
          const qx = ax + dx * t, qz = az + dz * t, d = Math.hypot(qx - px, qz - pz);
          if (!best || d < best.d) best = { a, b, t, x: qx, z: qz, d };
        }
      }
    }
    if (best && best.d <= r * SEG_CELL) break;
  }
  return best && best.d <= maxR ? best : null;
}

// ------------------------------------------------------------------ A*
class Heap {
  constructor() { this.k = new Float64Array(1024); this.v = new Int32Array(1024); this.size = 0; }
  push(key, val) {
    if (this.size === this.k.length) {
      const k = new Float64Array(this.size * 2), v = new Int32Array(this.size * 2);
      k.set(this.k); v.set(this.v); this.k = k; this.v = v;
    }
    let i = this.size++;
    const K = this.k, V = this.v;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (K[p] <= key) break;
      K[i] = K[p]; V[i] = V[p]; i = p;
    }
    K[i] = key; V[i] = val;
  }
  pop() {
    const K = this.k, V = this.v, top = V[0], n = --this.size;
    if (n > 0) {
      const key = K[n], val = V[n];
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = -1, mk = key;
        if (l < n && K[l] < mk) { m = l; mk = K[l]; }
        if (r < n && K[r] < mk) { m = r; mk = K[r]; }
        if (m < 0) break;
        K[i] = K[m]; V[i] = V[m]; i = m;
      }
      K[i] = key; V[i] = val;
    }
    return top;
  }
}

/**
 * Route from (fx, fz) facing `heading` (radians, or null) to (gx, gz): starts and ends on the
 * nearest road segments, respects one-ways. Result: { path: Float32Array [x, z, ...] } or null.
 */
function route({ fx, fz, heading = null, gx, gz }) {
  const G = graph;
  if (!G) return { result: null, transfer: [] };
  const from = nearestSegment(fx, fz), to = nearestSegment(gx, gz);
  if (!from || !to) return { result: null, transfer: [] };
  const N = G.n, GOAL = N; // virtual goal node
  const g = G.g, prev = G.prev, done = G.done;
  g.fill(Infinity); prev.fill(-1); done.fill(0);
  const heap = new Heap();
  const h = (i) => Math.hypot(G.x[i] - to.x, G.z[i] - to.z) * MIN_COST;
  // Sources: drive on along the start segment to either end it allows (one-ways), with a
  // penalty for the end behind the car.
  const hx = heading == null ? 0 : Math.sin(heading), hz = heading == null ? 0 : Math.cos(heading);
  const source = (end, other) => {
    const k = hasEdge(G, other, end);
    if (k < 0) return;
    const len = Math.hypot(G.x[end] - from.x, G.z[end] - from.z);
    const ahead = (G.x[end] - from.x) * hx + (G.z[end] - from.z) * hz;
    const c = len * (G.cost[k] / Math.max(1e-3, Math.hypot(G.x[end] - G.x[other], G.z[end] - G.z[other]))) + (heading != null && ahead < 0 ? UTURN : 0);
    if (c < g[end]) { g[end] = c; heap.push(c + h(end), end); }
  };
  source(from.b, from.a);
  source(from.a, from.b);
  // Targets: the goal sits on segment (to.a, to.b); reach it from whichever end may drive in.
  const into = [];
  for (const [end, other, part] of [[to.a, to.b, to.t], [to.b, to.a, 1 - to.t]]) {
    const k = hasEdge(G, end, other);
    if (k >= 0) into.push([end, G.cost[k] * part]);
  }
  // Goal further along the same segment, in a direction we may drive: straight there.
  const same = from.a === to.a && from.b === to.b ? to.t : from.a === to.b && from.b === to.a ? 1 - to.t : -1;
  if (same >= 0 && hasEdge(G, same >= from.t ? from.a : from.b, same >= from.t ? from.b : from.a) >= 0) {
    const path = new Float32Array([to.x, to.z]);
    return { result: { path, cost: 0, expanded: 0 }, transfer: [path.buffer] };
  }
  let expanded = 0;
  while (heap.size) {
    const u = heap.pop();
    if (done[u]) continue;
    done[u] = 1;
    if (u === GOAL) break;
    expanded++;
    for (const [end, c] of into) if (end === u && g[u] + c < g[GOAL]) { g[GOAL] = g[u] + c; prev[GOAL] = u; heap.push(g[GOAL], GOAL); }
    for (let k = G.start[u]; k < G.start[u + 1]; k++) {
      const v = G.adj[k], ng = g[u] + G.cost[k];
      if (ng < g[v]) { g[v] = ng; prev[v] = u; heap.push(ng + h(v), v); }
    }
  }
  if (!done[GOAL]) return { result: null, transfer: [] };
  const nodes = [];
  for (let c = prev[GOAL]; c >= 0; c = prev[c]) nodes.push(c);
  nodes.reverse();
  const path = new Float32Array(nodes.length * 2 + 2);
  nodes.forEach((i, k) => { path[k * 2] = G.x[i]; path[k * 2 + 1] = G.z[i]; });
  path[nodes.length * 2] = to.x; path[nodes.length * 2 + 1] = to.z;
  return { result: { path, cost: g[GOAL], expanded }, transfer: [path.buffer] };
}

/** A random junction or through-road node min..max metres from (x, z): { x, z } or null. */
function randomNode({ x, z, min, max }) {
  const G = graph;
  if (!G) return null;
  for (let tries = 0; tries < 6000; tries++) {
    const i = Math.floor(Math.random() * G.n);
    if (G.deg[i] < 2) continue;
    const d = Math.hypot(G.x[i] - x, G.z[i] - z);
    if (d >= min && d <= max) return { x: G.x[i], z: G.z[i] };
  }
  return null;
}

// ------------------------------------------------------------------ drawing data
// Per chunk, per layer: { pts: Float32Array, starts: Uint32Array (first point of each line or
// ring) }. Rings are filled with the nonzero rule (holes run the other way). Items bigger
// than two chunks go into one "big" chunk whose box covers them all.
const LAYERS = ['land', 'water', 'green', 'sand', 'paved', 'rails', 'road0', 'road1', 'road2'];
const LAYER_OF = { [OVERVIEW_LAYER.LAND]: 'land', [OVERVIEW_LAYER.WATER]: 'water', [OVERVIEW_LAYER.GREEN]: 'green', [OVERVIEW_LAYER.SAND]: 'sand', [OVERVIEW_LAYER.PAVED]: 'paved' };
const roadGroup = (cls) => (cls <= ROAD.SECONDARY ? 'road0' : cls <= ROAD.LINK ? 'road1' : 'road2');

function buildChunks(ov, transfer) {
  const chunks = new Map();
  const bboxOf = (lines) => {
    const b = [Infinity, Infinity, -Infinity, -Infinity];
    for (const l of lines) for (let i = 0; i < l.length; i += 2) {
      if (l[i] < b[0]) b[0] = l[i]; if (l[i + 1] < b[1]) b[1] = l[i + 1];
      if (l[i] > b[2]) b[2] = l[i]; if (l[i + 1] > b[3]) b[3] = l[i + 1];
    }
    return b;
  };
  const put = (layer, lines) => {
    const b = bboxOf(lines);
    const big = b[2] - b[0] > CHUNK * 2 || b[3] - b[1] > CHUNK * 2;
    const key = big ? 'big' : `${Math.floor((b[0] + b[2]) / 2 / CHUNK)},${Math.floor((b[1] + b[3]) / 2 / CHUNK)}`;
    let c = chunks.get(key);
    if (!c) { c = { bbox: [Infinity, Infinity, -Infinity, -Infinity], parts: {} }; chunks.set(key, c); }
    c.bbox = [Math.min(c.bbox[0], b[0]), Math.min(c.bbox[1], b[1]), Math.max(c.bbox[2], b[2]), Math.max(c.bbox[3], b[3])];
    (c.parts[layer] ||= []).push(...lines);
  };
  for (const L of ov.layers) for (const rings of L.polys) put(LAYER_OF[L.kind], rings);
  for (const l of ov.rails) put('rails', [l]);
  for (const r of ov.roads) put(roadGroup(r.cls), [r.line]);
  const out = [];
  for (const c of chunks.values()) {
    const layers = {};
    for (const name of LAYERS) {
      const lines = c.parts[name];
      if (!lines) continue;
      let n = 0;
      for (const l of lines) n += l.length;
      const pts = new Float32Array(n), starts = new Uint32Array(lines.length + 1);
      let o = 0;
      lines.forEach((l, i) => { starts[i] = o / 2; pts.set(l, o); o += l.length; });
      starts[lines.length] = o / 2;
      layers[name] = { pts, starts };
      transfer.push(pts.buffer, starts.buffer);
    }
    out.push({ bbox: c.bbox, layers });
  }
  return out;
}

/** Road name labels: the longest straight piece of each main road. */
function labels(ov) {
  const best = new Map();
  for (const r of ov.roads) {
    if (r.name < 0 || r.cls > ROAD.LINK) continue;
    const l = r.line, nm = ov.names[r.name];
    for (let i = 2; i < l.length; i += 2) {
      const len = Math.hypot(l[i] - l[i - 2], l[i + 1] - l[i - 1]);
      if (len > (best.get(nm)?.len || 60)) best.set(nm, { name: nm, len, x: (l[i] + l[i - 2]) / 2, z: (l[i + 1] + l[i - 1]) / 2, a: Math.atan2(l[i + 1] - l[i - 1], l[i] - l[i - 2]) });
    }
  }
  return [...best.values()];
}
