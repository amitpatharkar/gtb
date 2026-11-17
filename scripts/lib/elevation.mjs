// Heights for roads that leave the ground: flyovers, road over-bridges, creek bridges and the sea
// link above it; tunnels, underpasses and their open cuts below it. OpenStreetMap only says
// bridge=yes / tunnel=yes and a layer; the heights are made here (all in metres, 0 = at grade):
//
// 1. Every bridge chain gets a deck height from what it crosses (sampled along it): another road
//    or a railway → a flyover (7 m, +6.5 m per extra layer; 7.6 m over the tracks for the overhead
//    wires), mostly open sea and long → a marine viaduct (9 m), some water → a creek bridge (3.2 m),
//    nothing mapped beneath → a flyover if it is long and important, else a culvert left at grade.
//    Tunnels go 9 m down (short underpasses 6.6 m).
// 2. Heights spread from the structures along the connected road graph at a design grade (5 %),
//    so the approach ways become ramps, but never past an at-grade junction (a node where two or
//    more ordinary roads meet is pinned to the ground) and never steeper than 6.5 % from one: a
//    bridge that ends right at a junction starts its ramp on the bridge itself.
// 3. Short vertical curves (smoothing), then the sea link rises over its two cable-stayed spans.
//
// Footbridges and skywalks are a second network (their stairs climb at up to 60 %).
// Roads are densified to a vertex every 8 m (footbridges 4 m) where heights change; extra
// vertices that only repeat a straight slope are dropped again at the end.
import * as G from './geometry.mjs';

const NET = [{ g: 0.05, gmax: 0.065, step: 8 }, { g: 0.45, gmax: 0.6, step: 4 }]; // vehicles, footways
export const DECK = { FIRST: 7.0, RAIL: 7.6, LAYER: 6.5, MARINE: 9.0, CREEK: 3.2, FOOT: 7.4, FOOT_CREEK: 2.6, TUNNEL: -9.0, UNDERPASS: -6.6 };
const AT_GRADE = 0.22;

/** Binary heap keyed by numbers (max-heap when sign = -1). */
class Heap {
  constructor(sign = 1) { this.k = []; this.v = []; this.sign = sign; }
  get size() { return this.k.length; }
  push(key, val) {
    const K = this.k, V = this.v; key *= this.sign;
    let i = K.length; K.push(key); V.push(val);
    while (i > 0) { const p = (i - 1) >> 1; if (K[p] <= key) break; K[i] = K[p]; V[i] = V[p]; i = p; }
    K[i] = key; V[i] = val;
  }
  pop() {
    const K = this.k, V = this.v, top = V[0], lk = K.pop(), lv = V.pop();
    if (K.length) {
      let i = 0; const n = K.length;
      for (;;) { const l = i * 2 + 1, r = l + 1; let m = i, mk = lk; if (l < n && K[l] < mk) { m = l; mk = K[l]; } if (r < n && K[r] < mk) m = r; if (m === i) break; K[i] = K[m]; V[i] = V[m]; i = m; }
      K[i] = lk; V[i] = lv;
    }
    return top;
  }
}

class Grid {
  constructor(cell) { this.cell = cell; this.map = new Map(); }
  add(bb, item) {
    const c = this.cell;
    for (let i = Math.floor(bb[0] / c); i <= Math.floor(bb[2] / c); i++)
      for (let j = Math.floor(bb[1] / c); j <= Math.floor(bb[3] / c); j++) {
        const k = i * 100003 + j;
        (this.map.get(k) || this.map.set(k, []).get(k)).push(item);
      }
  }
  near(x, z, r, fn) {
    const c = this.cell, seen = new Set();
    for (let i = Math.floor((x - r) / c); i <= Math.floor((x + r) / c); i++)
      for (let j = Math.floor((z - r) / c); j <= Math.floor((z + r) / c); j++)
        for (const it of this.map.get(i * 100003 + j) || []) {
          if (seen.has(it)) continue;
          seen.add(it);
          if (fn(it)) return true;
        }
    return false;
  }
}

const layerOf = (t) => { const l = parseInt(t.layer, 10); return Number.isFinite(l) ? Math.max(-5, Math.min(5, l)) : 0; };

/**
 * @param o.roads road pieces ({ id, tags, info: { cls, width, flags }, pts, ids, hw }); every piece
 *   that ends up off the ground gets `hs` (height per vertex) and the ELEVATED flag, with pts/ids densified
 * @param o.net(cls) → 0 vehicle network, 1 footway network, -1 ignore
 * @param o.onLand(x, z) · o.rails [{ pts }] · o.flags { BRIDGE, TUNNEL, ELEVATED }
 * @param o.pylons [{ name, x, z, deck, reach }]: cable-stayed spans (the deck rises to `deck` within `reach`)
 * @param o.isMain(cls) roads important enough to be a flyover with nothing mapped beneath
 */
export function elevate({ roads, net, onLand, rails, flags: F, pylons = [], isMain, log }) {
  const t0 = Date.now();
  for (const r of roads) {
    r.net = net(r.info.cls);
    r.struct = r.net < 0 ? 0 : r.info.flags & F.BRIDGE ? 1 : r.info.flags & F.TUNNEL ? -1 : 0;
    r.osmLayer = layerOf(r.tags);
  }
  const structs = roads.filter((r) => r.struct);
  if (!structs.length) return { pylons: [], stats: {} };

  // ---- what each structure crosses
  const roadGrid = new Grid(25), railGrid = new Grid(25), structGrid = new Grid(25);
  for (const r of roads) {
    if (r.net !== 0) continue;
    for (let i = 1; i < r.pts.length; i++) {
      const a = r.pts[i - 1], b = r.pts[i], pad = r.hw;
      (r.struct ? structGrid : roadGrid).add([Math.min(a[0], b[0]) - pad, Math.min(a[1], b[1]) - pad, Math.max(a[0], b[0]) + pad, Math.max(a[1], b[1]) + pad], { a, b, r });
    }
  }
  for (const rl of rails) for (let i = 1; i < rl.pts.length; i++) {
    const a = rl.pts[i - 1], b = rl.pts[i];
    railGrid.add([Math.min(a[0], b[0]) - 3, Math.min(a[1], b[1]) - 3, Math.max(a[0], b[0]) + 3, Math.max(a[1], b[1]) + 3], { a, b });
  }
  // Chains: structure pieces of one kind that share a node.
  const parent = new Map(structs.map((r) => [r, r]));
  const find = (r) => { while (parent.get(r) !== r) { parent.set(r, parent.get(parent.get(r))); r = parent.get(r); } return r; };
  const byNode = new Map();
  for (const r of structs) for (const id of [r.ids[0], r.ids[r.ids.length - 1]]) {
    const k = `${r.net}:${r.struct}:${id}`;
    const o = byNode.get(k);
    if (o) parent.set(find(r), find(o)); else byNode.set(k, r);
  }
  for (const r of structs) {
    const ids = new Set(r.ids);
    let len = 0, wet = 0, road = false, rail = false, lower = -9;
    for (let i = 1; i < r.pts.length; i++) {
      const a = r.pts[i - 1], b = r.pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / 5));
      for (let k = 0; k < n; k++) {
        const x = a[0] + ((b[0] - a[0]) * (k + 0.5)) / n, z = a[1] + ((b[1] - a[1]) * (k + 0.5)) / n;
        if (!onLand(x, z)) wet += L / n;
        if (r.struct < 0) continue;
        // A road beneath: an ordinary vehicle road (not this structure's own approaches).
        if (!road) road = roadGrid.near(x, z, 14, ({ a: p, b: q, r: o }) => !o.ids.some((id) => ids.has(id)) && G.segDist2([x, z], p, q) < ((r.hw + o.hw) * 0.7) ** 2);
        if (!rail) rail = railGrid.near(x, z, r.hw + 3, ({ a: p, b: q }) => G.segDist2([x, z], p, q) < (r.hw + 2.5) ** 2);
        structGrid.near(x, z, 14, ({ a: p, b: q, r: o }) => {
          const lo = Math.max(1, o.osmLayer);
          if (o !== r && o.struct > 0 && lo < Math.max(1, r.osmLayer) && !o.ids.some((id) => ids.has(id)) && G.segDist2([x, z], p, q) < ((r.hw + o.hw) * 0.7) ** 2) lower = Math.max(lower, lo);
          return false;
        });
      }
      len += L;
    }
    Object.assign(r, { len, wet, below: { road, rail, lower } });
  }
  const chains = new Map();
  for (const r of structs) {
    const c = find(r);
    const ch = chains.get(c) || chains.set(c, { len: 0, wet: 0, road: false, rail: false, lower: -9, main: false, pieces: [] }).get(c);
    ch.len += r.len; ch.wet += r.wet; ch.road ||= r.below.road; ch.rail ||= r.below.rail; ch.lower = Math.max(ch.lower, r.below.lower); ch.main ||= isMain(r.info.cls);
    ch.pieces.push(r);
  }
  const stats = { flyover: 0, marine: 0, creek: 0, culvert: 0, tunnel: 0, foot: 0, km: 0 };
  for (const ch of chains.values()) {
    const wetShare = ch.wet / (ch.len || 1), minLayer = Math.min(...ch.pieces.map((r) => Math.max(1, r.osmLayer)));
    for (const r of ch.pieces) {
      if (r.struct < 0) {
        const L = Math.min(-1, r.osmLayer || -1);
        r.target = (ch.len > 300 ? DECK.TUNNEL : DECK.UNDERPASS) + DECK.LAYER * (L + 1);
        stats.tunnel++;
        continue;
      }
      const extra = DECK.LAYER * (Math.max(1, r.osmLayer) - minLayer);
      let base;
      if (r.net === 1) base = ch.road || ch.rail ? DECK.FOOT : wetShare > 0.3 ? DECK.FOOT_CREEK : ch.len > 30 ? DECK.FOOT - 0.8 : 0;
      else if (ch.road || ch.rail || ch.lower > -9) base = ch.rail ? DECK.RAIL : DECK.FIRST;
      else if (wetShare > 0.45 && ch.len > 450) base = DECK.MARINE;
      else if (wetShare > 0.05) base = DECK.CREEK;
      else if (ch.len >= 50 && ch.main) base = DECK.FIRST;
      else base = 0;
      if (!base) { r.struct = 0; stats.culvert++; continue; } // a culvert over a nallah: stays a street
      // Over another deck: one layer's height above that deck at least.
      r.target = r.below.lower > -9 && r.net === 0 ? Math.max(base + extra, DECK.FIRST + DECK.LAYER * r.below.lower) : base + extra;
      stats[r.net === 1 ? 'foot' : base === DECK.MARINE ? 'marine' : base === DECK.CREEK ? 'creek' : 'flyover']++;
    }
  }

  // ---- the road graph around the structures (densified)
  const live = roads.filter((r) => r.struct);
  const region = new Grid(400);
  for (const r of live) { const bb = G.bboxOf(r.pts); region.add([bb[0] - 400, bb[1] - 400, bb[2] + 400, bb[3] + 400], r); }
  let synth = -1;
  const cands = [];
  for (const r of roads) {
    if (r.net < 0) continue;
    if (!r.struct) {
      const bb = G.bboxOf(r.pts), cx = (bb[0] + bb[2]) / 2, cz = (bb[1] + bb[3]) / 2;
      if (!region.near(cx, cz, Math.max(bb[2] - bb[0], bb[3] - bb[1]) / 2 + 1, (o) => o.net === r.net)) continue;
    }
    const step = NET[r.net].step, pts = [], ids = [], orig = [];
    for (let i = 0; i < r.pts.length; i++) {
      if (i) {
        const a = r.pts[i - 1], b = r.pts[i], n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step);
        for (let k = 1; k < n; k++) { pts.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]); ids.push(synth--); orig.push(0); }
      }
      pts.push(r.pts[i]); ids.push(r.ids[i]); orig.push(1);
    }
    cands.push({ r, pts, ids, orig });
  }
  // Edge kinds at each node: ordinary (nb), bridge (sb), tunnel (tb).
  const kinds = new Map();
  for (const c of cands) for (let i = 0; i < c.ids.length; i++) {
    const k = `${c.r.net}:${c.ids[i]}`, e = kinds.get(k) || kinds.set(k, [0, 0, 0]).get(k), n = (i > 0) + (i < c.ids.length - 1);
    e[c.r.struct > 0 ? 1 : c.r.struct < 0 ? 2 : 0] += n;
  }
  // A ground road mapped through a node in the middle of a bridge (or tunnel) is a mapping slip,
  // not a junction: it keeps its own node at ground level.
  const keyOf = (c, i) => {
    const k = `${c.r.net}:${c.ids[i]}`;
    if (c.r.struct) return k;
    const e = kinds.get(k);
    return (e[1] >= 2 || e[2] >= 2) && e[0] >= 2 ? `${k}#g` : k;
  };
  const index = new Map(), X = [], Z = [], NN = [], adj = [];
  const nodeOf = (k, x, z, nt) => {
    let i = index.get(k);
    if (i === undefined) { i = X.length; index.set(k, i); X.push(x); Z.push(z); NN.push(nt); adj.push([]); }
    return i;
  };
  for (const c of cands) {
    c.nodes = c.ids.map((_, i) => nodeOf(keyOf(c, i), c.pts[i][0], c.pts[i][1], c.r.net));
    for (let i = 1; i < c.nodes.length; i++) {
      const a = c.nodes[i - 1], b = c.nodes[i];
      if (a === b) continue;
      const d = Math.hypot(X[b] - X[a], Z[b] - Z[a]);
      adj[a].push(b, d, c.r.struct); adj[b].push(a, d, c.r.struct);
    }
  }
  const pinned = [], target = [];
  const pinOf = (i) => {
    const nbs = new Set(); let nb = 0;
    for (let k = 0; k < adj[i].length; k += 3) { nbs.add(adj[i][k]); if (!adj[i][k + 2]) nb++; }
    return nbs.size >= 3 && nb >= 2 ? 1 : 0; // an at-grade junction
  };
  for (let i = 0; i < X.length; i++) pinned.push(pinOf(i));
  const setTargets = () => {
    target.length = 0;
    for (let i = 0; i < X.length; i++) target.push(0);
    for (const c of cands) {
      if (!c.r.struct) continue;
      for (const n of c.nodes) {
        if (pinned[n]) continue;
        target[n] = c.r.struct > 0 ? Math.max(target[n], c.r.target) : Math.min(target[n], c.r.target);
      }
    }
  };
  // Heights spread at the design grade (up from decks, down from tunnels); pinned nodes stay put;
  // never steeper than gmax from an at-grade junction.
  const solve = () => {
    const N = X.length;
    const spread = (sign) => {
      const h = new Float64Array(N), heap = new Heap(-1);
      for (let i = 0; i < N; i++) if (target[i] * sign > 0) { h[i] = target[i] * sign; heap.push(h[i], i); }
      while (heap.size) {
        const n = heap.pop(), g = NET[NN[n]].g, a = adj[n];
        for (let k = 0; k < a.length; k += 3) {
          const m = a[k], v = h[n] - g * a[k + 1];
          if (v > h[m] + 1e-6 && !pinned[m]) { h[m] = v; heap.push(v, m); }
        }
      }
      return h;
    };
    const up = spread(1), down = spread(-1);
    const dist = new Float64Array(N).fill(Infinity), heap = new Heap(1);
    for (let i = 0; i < N; i++) if (pinned[i]) { dist[i] = 0; heap.push(0, i); }
    while (heap.size) {
      const n = heap.pop(), a = adj[n];
      for (let k = 0; k < a.length; k += 3) {
        const m = a[k], d = dist[n] + a[k + 1];
        if (d < dist[m] - 1e-6) { dist[m] = d; heap.push(d, m); }
      }
    }
    const out = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const cap = NET[NN[i]].gmax * dist[i];
      out[i] = up[i] > 0 ? Math.min(up[i], cap) : down[i] > 0 ? -Math.min(down[i], cap) : 0;
    }
    return out;
  };
  setTargets();
  let H = solve();
  // A flyover squashed by junctions on its approach (side lanes mapped onto the ramp: in Mumbai they
  // meet a service road beside it) keeps its height: those side lanes are cut off at the ramp's
  // foot (a ground node of their own) and the ramp runs on, straight, until it has room to land.
  let detached = 0;
  const moveEdge = (from, to, m) => {
    // The edge from–m becomes to–m.
    const a = adj[from];
    for (let k = 0; k < a.length; k += 3) if (a[k] === m) { adj[to].push(m, a[k + 1], a[k + 2]); a.splice(k, 3); break; }
    const b = adj[m];
    for (let k = 0; k < b.length; k += 3) if (b[k] === from) { b[k] = to; break; }
  };
  for (const c of cands) {
    if (c.r.struct <= 0 || c.r.target < DECK.FIRST - 0.01 || c.r.net !== 0) continue;
    let top = 0;
    for (const n of c.nodes) top = Math.max(top, H[n]);
    if (top > c.r.target - 1.5) continue;
    for (const [end, inner] of [[c.nodes[0], c.nodes[1]], [c.nodes[c.nodes.length - 1], c.nodes[c.nodes.length - 2]]]) {
      let prev = inner, cur = end, run = 0;
      while (run < c.r.target / NET[0].gmax + 12) {
        const a = adj[cur], dx = X[cur] - X[prev], dz = Z[cur] - Z[prev], dl = Math.hypot(dx, dz) || 1;
        let next = -1, best = 0.82, len = 0;
        for (let k = 0; k < a.length; k += 3) {
          const m = a[k];
          if (m === prev) continue;
          const ex = X[m] - X[cur], ez = Z[m] - Z[cur], el = Math.hypot(ex, ez) || 1, dot = (ex * dx + ez * dz) / (el * dl);
          if (dot > best) { best = dot; next = m; len = a[k + 1]; }
        }
        if (next < 0) break;
        if (pinned[cur]) {
          // Side roads off to a ground node; the straight line carries on up.
          const side = [];
          for (let k = 0; k < a.length; k += 3) if (a[k] !== prev && a[k] !== next) side.push(a[k]);
          const pieces = cands.filter((o) => o.nodes.includes(cur));
          // Only where every road through here is either the through line or a side road.
          const clean = pieces.every((o) => {
            const i = o.nodes.indexOf(cur), nb = [o.nodes[i - 1], o.nodes[i + 1]].filter((v) => v !== undefined);
            const through = nb.filter((v) => v === prev || v === next).length, off = nb.filter((v) => side.includes(v)).length;
            return !(through && off);
          });
          if (!clean || !side.length) break;
          const g = X.length;
          X.push(X[cur]); Z.push(Z[cur]); NN.push(NN[cur]); adj.push([]); pinned.push(1);
          for (const m of side) moveEdge(cur, g, m);
          for (const o of pieces) {
            const i = o.nodes.indexOf(cur), nb = [o.nodes[i - 1], o.nodes[i + 1]].filter((v) => v !== undefined);
            if (nb.some((v) => side.includes(v))) o.nodes[i] = g;
          }
          pinned[cur] = 0;
          detached++;
        }
        if (cands.some((o) => o.r.struct && o.nodes.includes(next))) break; // reached another structure
        run += len; prev = cur; cur = next;
      }
    }
  }
  if (detached) { setTargets(); H = solve(); }
  const N = X.length;
  // Vertical curves: a few rounds of smoothing along simple chains (junctions keep their height).
  const two = new Int32Array(N * 2).fill(-1);
  for (let i = 0; i < N; i++) {
    const nbs = [...new Set(adj[i].filter((_, k) => k % 3 === 0))];
    if (nbs.length === 2 && !pinned[i]) { two[i * 2] = nbs[0]; two[i * 2 + 1] = nbs[1]; }
  }
  for (let it = 0; it < 4; it++) {
    const next = Float64Array.from(H);
    for (let i = 0; i < N; i++) {
      const a = two[i * 2], b = two[i * 2 + 1];
      if (a < 0 || (H[i] === 0 && H[a] === 0 && H[b] === 0)) continue;
      next[i] = 0.25 * H[a] + 0.5 * H[i] + 0.25 * H[b];
    }
    H = next;
  }
  // Cable-stayed spans: the deck climbs to its navigation height around each pylon.
  const placed = [];
  for (const p of pylons) {
    const on = cands.filter((c) => c.r.struct > 0 && p.match.test(`${c.r.tags.name || ''} ${c.r.tags.alt_name || ''}`));
    if (!on.length) continue;
    let base = 0, bd = Infinity;
    for (const c of on) for (const n of c.nodes) { const d = Math.hypot(X[n] - p.x, Z[n] - p.z); if (d < bd) { bd = d; base = H[n]; } }
    for (const c of on) for (const n of c.nodes) {
      const d = Math.hypot(X[n] - p.x, Z[n] - p.z);
      if (d >= p.reach) continue;
      const w = 0.5 * (1 + Math.cos((Math.PI * d) / p.reach));
      H[n] = Math.max(H[n], H[n] + (p.deck - H[n]) * w);
    }
    // Where the two carriageways pass the pylon: nearest point on each, and the direction along.
    const hits = [];
    for (const c of on) {
      let best = null;
      for (let i = 1; i < c.pts.length; i++) {
        const a = c.pts[i - 1], b = c.pts[i], d = G.segDist2([p.x, p.z], a, b);
        if (!best || d < best.d) best = { d, a, b, hw: c.r.hw };
      }
      if (best && best.d < 60 * 60) hits.push(best);
    }
    if (!hits.length) continue;
    const proj = ({ a, b }) => { const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.z - a[1]) * dz) / l2)); return [a[0] + dx * t, a[1] + dz * t]; };
    const pts = hits.map(proj);
    const cx = pts.reduce((s, q) => s + q[0], 0) / pts.length, cz = pts.reduce((s, q) => s + q[1], 0) / pts.length;
    const dir = Math.atan2(hits[0].b[0] - hits[0].a[0], hits[0].b[1] - hits[0].a[1]);
    let gap = 0;
    for (const q of pts) gap = Math.max(gap, Math.abs((q[0] - cx) * Math.cos(dir) - (q[1] - cz) * Math.sin(dir)));
    const hw = Math.max(...hits.map((h) => h.hw));
    placed.push({ name: p.name, x: Math.round(cx * 10) / 10, z: Math.round(cz * 10) / 10, angle: Math.round(dir * 1000) / 1000, deck: p.deck, base: Math.round(base * 10) / 10, reach: p.reach, top: p.top, span: p.span, half: Math.round((gap + hw) * 10) / 10, hw });
  }

  // ---- write heights back to the pieces
  let lifted = 0, km = 0;
  for (const c of cands) {
    const hs = c.nodes.map((n) => Math.round(H[n] * 100) / 100);
    if (hs.every((h) => Math.abs(h) < 0.01)) continue;
    // Drop added vertices that only repeat a straight slope (1-D Douglas–Peucker on arc length/height).
    const s = [0];
    for (let i = 1; i < c.pts.length; i++) s.push(s[i - 1] + Math.hypot(c.pts[i][0] - c.pts[i - 1][0], c.pts[i][1] - c.pts[i - 1][1]));
    const keep = c.orig.slice();
    keep[0] = keep[keep.length - 1] = 1;
    const stack = [];
    let prev = 0;
    for (let i = 1; i < keep.length; i++) if (keep[i]) { if (i - prev > 1) stack.push([prev, i]); prev = i; }
    while (stack.length) {
      const [a, b] = stack.pop();
      let worst = 0.03, idx = -1;
      for (let i = a + 1; i < b; i++) {
        const lin = hs[a] + ((hs[b] - hs[a]) * (s[i] - s[a])) / (s[b] - s[a] || 1);
        if (Math.abs(hs[i] - lin) > worst) { worst = Math.abs(hs[i] - lin); idx = i; }
      }
      if (idx >= 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
    }
    const r = c.r;
    r.pts = c.pts.filter((_, i) => keep[i]);
    r.ids = c.ids.filter((_, i) => keep[i]);
    r.hs = hs.filter((_, i) => keep[i]);
    r.info = { ...r.info, flags: r.info.flags | F.ELEVATED };
    lifted++;
    for (let i = 1; i < r.pts.length; i++) if (Math.abs(r.hs[i]) > AT_GRADE || Math.abs(r.hs[i - 1]) > AT_GRADE) km += Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]) / 1000;
  }
  stats.km = Math.round(km * 10) / 10;
  let low = 0;
  for (const c of cands) if (c.r.struct > 0 && c.r.net === 0 && c.r.target >= DECK.FIRST - 0.01 && Math.max(...c.nodes.map((n) => H[n])) < c.r.target - 1.5) low++;
  stats.detached = detached; stats.low = low;
  log?.(`elevation: ${stats.flyover} flyover, ${stats.marine} marine, ${stats.creek} creek and ${stats.foot} foot bridge pieces, ${stats.tunnel} tunnel pieces, ${stats.culvert} culverts left at grade → ${lifted} roads off the ground (${stats.km} km); ${detached} side roads cut off at ramps, ${low} flyover pieces still under clearance; ${placed.length} pylons (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  return { pylons: placed, stats };
}

/** Parts of a polyline where the height stays within ±lim of the ground (cut points interpolated). */
export function groundParts(pts, hs, lim = AT_GRADE) {
  if (!hs) return [pts];
  const out = [];
  let cur = [];
  const cut = (i, j) => {
    // Where the height crosses ±lim between vertices i and j.
    const a = hs[i], b = hs[j], edge = Math.abs(a) > lim ? Math.sign(a) * lim : Math.sign(b) * lim;
    const t = (edge - a) / (b - a || 1);
    return [pts[i][0] + (pts[j][0] - pts[i][0]) * t, pts[i][1] + (pts[j][1] - pts[i][1]) * t];
  };
  for (let i = 0; i < pts.length; i++) {
    const inside = Math.abs(hs[i]) <= lim;
    if (i) {
      const was = Math.abs(hs[i - 1]) <= lim;
      if (was && !inside) { cur.push(cut(i - 1, i)); if (cur.length > 1) out.push(cur); cur = []; }
      else if (!was && inside) cur.push(cut(i - 1, i));
      else if (!was && !inside && Math.sign(hs[i]) !== Math.sign(hs[i - 1])) { /* passes through grade: ignore */ }
    }
    if (inside) cur.push(pts[i]);
  }
  if (cur.length > 1) out.push(cur);
  return out;
}

/** Parts of a polyline with heights where `test(h)` holds, as { pts, hs } (cut points interpolated at `edge`). */
export function heightParts(pts, hs, test, edge) {
  const out = [];
  let cur = null;
  const at = (i, j) => {
    const t = (edge - hs[i]) / (hs[j] - hs[i] || 1);
    return [[pts[i][0] + (pts[j][0] - pts[i][0]) * t, pts[i][1] + (pts[j][1] - pts[i][1]) * t], edge];
  };
  for (let i = 0; i < pts.length; i++) {
    const ok = test(hs[i]);
    if (i) {
      const was = test(hs[i - 1]);
      if (was !== ok) {
        const [p, h] = at(i - 1, i);
        if (was) { cur.pts.push(p); cur.hs.push(h); if (cur.pts.length > 1) out.push(cur); cur = null; }
        else cur = { pts: [p], hs: [h] };
      }
    }
    if (ok) { if (!cur) cur = { pts: [], hs: [] }; cur.pts.push(pts[i]); cur.hs.push(hs[i]); }
  }
  if (cur && cur.pts.length > 1) out.push(cur);
  return out;
}

/**
 * Clip a polyline with heights to a rectangle [x0, z0, x1, z1]: parts { pts, hs, s0 }, where s0
 * is the distance along the whole line to the part's first point (heights interpolated at cuts).
 */
export function clipWithHeights(pts, hs, [x0, z0, x1, z1]) {
  const out = [];
  let cur = null, s = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
    // Liang–Barsky
    let t0 = 0, t1 = 1, ok = true;
    for (const [p, q] of [[-dx, a[0] - x0], [dx, x1 - a[0]], [-dz, a[1] - z0], [dz, z1 - a[1]]]) {
      if (p === 0) { if (q < 0) { ok = false; break; } continue; }
      const r = q / p;
      if (p < 0) { if (r > t1) { ok = false; break; } if (r > t0) t0 = r; } else { if (r < t0) { ok = false; break; } if (r < t1) t1 = r; }
    }
    if (ok && t1 > t0) {
      const P = (t) => [a[0] + dx * t, a[1] + dz * t], Hh = (t) => hs[i - 1] + (hs[i] - hs[i - 1]) * t;
      if (!cur || t0 > 0) { if (cur && cur.pts.length > 1) out.push(cur); cur = { pts: [P(t0)], hs: [Hh(t0)], s0: s + L * t0 }; }
      cur.pts.push(P(t1)); cur.hs.push(Hh(t1));
      if (t1 < 1) { if (cur.pts.length > 1) out.push(cur); cur = null; }
    } else if (cur) { if (cur.pts.length > 1) out.push(cur); cur = null; }
    s += L;
  }
  if (cur && cur.pts.length > 1) out.push(cur);
  return out;
}
