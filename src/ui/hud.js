// Speedometer for the heads-up display: a 270° dial of 40 segments (yellow, then orange, then red),
// speed numbers around it, the big speed in the middle with the gear letter, and lamps for fuel,
// engine and lights. Built once; update() only touches what changed. On foot (or a touch screen)
// CSS shrinks it to a plain number.

const N = 40, START = 135, SWEEP = 270, MAX = 120;
const SVG = 'http://www.w3.org/2000/svg';
const pt = (r, deg) => [130 + r * Math.cos((deg * Math.PI) / 180), 130 + r * Math.sin((deg * Math.PI) / 180)];

export function initSpeedo(el) {
  el.innerHTML = `<svg viewBox="0 0 260 260" aria-hidden="true"><g class="segs"></g><g class="ticks"></g></svg>
    <div class="num">0</div><div class="unit">km/h</div><div class="gear">P</div>
    <div class="fuel"><i>⛽</i><b>100%</b></div>
    <div class="lamps"><span class="eng" title="Car condition">🔧</span><span class="lamp" title="Lights">💡</span></div>`;
  const segs = el.querySelector('.segs'), ticks = el.querySelector('.ticks');
  const parts = [];
  for (let i = 0; i < N; i++) {
    const a0 = START + (i / N) * SWEEP + 0.5, a1 = START + ((i + 1) / N) * SWEEP - 0.5;
    const [x0, y0] = pt(90, a0), [x1, y1] = pt(90, a1);
    const p = document.createElementNS(SVG, 'path');
    p.setAttribute('d', `M${x0.toFixed(1)} ${y0.toFixed(1)}A90 90 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`);
    p.setAttribute('class', i / N < 0.5 ? 'y' : i / N < 0.75 ? 'o' : 'r');
    segs.appendChild(p); parts.push(p);
  }
  for (let v = 0; v <= MAX; v += 10) {
    const a = START + (v / MAX) * SWEEP;
    const [x0, y0] = pt(100, a), [x1, y1] = pt(105, a);
    const l = document.createElementNS(SVG, 'line');
    l.setAttribute('x1', x0); l.setAttribute('y1', y0); l.setAttribute('x2', x1); l.setAttribute('y2', y1);
    ticks.appendChild(l);
    if (v % 20 === 0) {
      const [tx, ty] = pt(118, a);
      const t = document.createElementNS(SVG, 'text');
      t.setAttribute('x', tx); t.setAttribute('y', ty + 6); t.setAttribute('text-anchor', 'middle'); t.textContent = v;
      ticks.appendChild(t);
    }
  }
  const num = el.querySelector('.num'), gear = el.querySelector('.gear'), fuel = el.querySelector('.fuel b');
  const eng = el.querySelector('.eng'), lamp = el.querySelector('.lamp');
  let lit = -1, shown = -1, g = '', f = -1;
  return {
    /** kmh, signed (negative = reverse), foot, fuel and cond 0..1, night. */
    update({ kmh, reverse, foot, fuel: fu, cond, night }) {
      if (kmh !== shown) { shown = kmh; num.textContent = kmh; }
      const n = Math.min(N, Math.round((kmh / (foot ? 30 : MAX)) * N));
      if (n !== lit) { lit = n; for (let i = 0; i < N; i++) parts[i].classList.toggle('on', i < n); }
      const gg = reverse ? 'R' : kmh < 1 ? 'P' : 'D';
      if (gg !== g) { g = gg; gear.textContent = gg; }
      const ff = Math.round(fu * 100);
      if (ff !== f) { f = ff; fuel.textContent = `${ff}%`; el.classList.toggle('lowfuel', fu < 0.15); }
      eng.classList.toggle('warn', cond < 0.35);
      lamp.classList.toggle('on', !!night);
      el.classList.toggle('foot', !!foot);
    },
  };
}
