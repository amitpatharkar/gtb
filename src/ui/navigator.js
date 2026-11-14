import * as THREE from 'three';

// Turn-by-turn directions for the GPS route: a panel with the next turn and distance,
// glowing chevrons on the road ahead, and spoken Hinglish prompts ("Aage se left lo").

const SAY = {
  left: ['Aage se left lo', 'Thoda aage, left'], right: ['Aage se right lo', 'Thoda aage, right'],
  nowLeft: ['Ab left'], nowRight: ['Ab right'], uturn: ['U-turn lo'], arrive: ['Aap pahunch gaye'], start: ['Chalo, seedha chalo'],
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export class Navigator {
  constructor(scene, cityMap, tiles) {
    this.map = cityMap;
    this.tiles = tiles;
    this.speech = true;
    this.el = document.getElementById('nav');
    this.said = new Set();
    this.lastWaypoint = null;
    const shape = new THREE.Shape([[-0.9, -0.5], [0, 0.45], [0.9, -0.5], [0.9, -0.05], [0, 0.85], [-0.9, -0.05]].map(([x, y]) => new THREE.Vector2(x, y)));
    // Laid flat facing up; the tip must point along +z (heading 0), so turn it round after laying it down.
    const geo = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2).rotateY(Math.PI).scale(1.25, 1, 2.2); // long, so they read from a low driving camera
    this.max = 14;
    this.arrows = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0xc13bd9).multiplyScalar(1.6), transparent: true, opacity: 0.88, depthWrite: false }), this.max);
    this.arrows.count = 0;
    this.arrows.frustumCulled = false;
    this.arrows.renderOrder = 2;
    scene.add(this.arrows);
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.p = new THREE.Vector3(); this.one = new THREE.Vector3(1, 1, 1);
  }

  speak(text) {
    if (!this.speech || !('speechSynthesis' in window)) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      const voices = speechSynthesis.getVoices();
      u.voice = voices.find((v) => v.lang === 'hi-IN') || voices.find((v) => v.lang === 'en-IN') || null;
      u.lang = u.voice?.lang || 'en-IN';
      u.rate = 1.05;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch { /* no speech on this browser */ }
  }

  /** Arc-length sampled route: point and heading at distance s. */
  at(route, cum, s) {
    let i = 1;
    while (i < route.length - 1 && cum[i] < s) i++;
    const a = route[i - 1], b = route[i], l = cum[i] - cum[i - 1] || 1;
    const t = Math.max(0, Math.min(1, (s - cum[i - 1]) / l));
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, Math.atan2(b[0] - a[0], b[1] - a[1])];
  }

  update(dt, body, driving) {
    const route = this.map.route, wp = this.map.waypoint;
    if (wp !== this.lastWaypoint) { this.said.clear(); this.lastWaypoint = wp; if (wp && route) this.speak(pick(SAY.start)); }
    if (!wp && this.el.dataset.on) { this.el.hidden = true; delete this.el.dataset.on; if (this.wasOn) this.speak(pick(SAY.arrive)); this.wasOn = false; }
    if (!route || !wp) { this.arrows.count = 0; return; }
    this.wasOn = true;
    // Cumulative distances along the route (it starts at the player).
    const cum = [0];
    for (let i = 1; i < route.length; i++) cum.push(cum[i - 1] + Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]));
    const total = cum[cum.length - 1];
    // Next turn: where the heading over the next 12 m differs from the last 10 m.
    let turn = null;
    for (let s = 14; s < Math.min(total - 6, 450); s += 3) {
      const h0 = this.heading(route, cum, s - 10, s), h1 = this.heading(route, cum, s, s + 12);
      let d = h1 - h0; d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) > 0.65) { turn = { s, dir: Math.abs(d) > 2.4 ? 'uturn' : d > 0 ? 'left' : 'right', at: this.at(route, cum, s + 14) }; break; }
    }
    // Panel.
    const fmt = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m / 10) * 10} m`);
    let html;
    if (turn) {
      const road = this.tiles.roadNameAt(turn.at[0], turn.at[1]);
      const icon = { left: '↰', right: '↱', uturn: '⮌' }[turn.dir];
      html = `<i>${icon}</i><div><b>${fmt(turn.s)}</b> ${turn.dir === 'uturn' ? 'U-turn' : `turn ${turn.dir}`}${road ? ` onto <u>${road}</u>` : ''}<small>${fmt(total)} to ${wp.label || 'waypoint'}</small></div>`;
      const key = `${Math.round(turn.at[0] / 8)},${Math.round(turn.at[1] / 8)}`;
      if (turn.s < 140 && turn.s > 50 && !this.said.has(key + 'far')) { this.said.add(key + 'far'); this.speak(pick(turn.dir === 'uturn' ? SAY.uturn : SAY[turn.dir])); }
      if (turn.s <= 35 && !this.said.has(key + 'now') && turn.dir !== 'uturn') { this.said.add(key + 'now'); this.speak(pick(turn.dir === 'left' ? SAY.nowLeft : SAY.nowRight)); }
    } else html = `<i>↑</i><div><b>Seedha chalo</b><small>${fmt(total)} to ${wp.label || 'waypoint'}</small></div>`;
    this.el.innerHTML = html;
    this.el.hidden = false;
    this.el.dataset.on = '1';
    // Chevrons on the road ahead (only while driving).
    let n = 0;
    if (driving) {
      for (let s = 8; s < Math.min(total - 2, 110) && n < this.max; s += 8) {
        let [x, z, h] = this.at(route, cum, s);
        // The route runs along the road's centre line; India keeps left, so draw it in the left lane.
        const r = this.tiles.roadAt?.(x, z, 3, true), hw = r ? this.tiles.segment(r.tile, r.index)[4] : 4;
        const off = Math.min(1.8, hw * 0.45);
        x += Math.cos(h) * off; z -= Math.sin(h) * off;
        this.q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, h);
        this.m.compose(this.p.set(x, this.tiles.groundHeight(x, z) + 0.07, z), this.q, this.one);
        this.arrows.setMatrixAt(n++, this.m);
      }
    }
    this.arrows.count = n;
    this.arrows.instanceMatrix.needsUpdate = true;
  }

  heading(route, cum, s0, s1) {
    const a = this.at(route, cum, Math.max(0, s0)), b = this.at(route, cum, s1);
    return Math.atan2(b[0] - a[0], b[1] - a[1]);
  }
}
