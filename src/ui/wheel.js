// Weapon wheel (hold B on foot): a radial menu for fists, the pichkari and the five cracker types.
// Move the mouse to aim at a sector (a virtual cursor, so it also works while the pointer is locked),
// release B to equip. The camera stops turning while it is open. A small panel shows the stats of
// the sector under the cursor.

const SVG = 'http://www.w3.org/2000/svg';
const R0 = 88, R1 = 178, C = 200, GAP = 1.6;
const pt = (r, deg) => [C + r * Math.cos((deg * Math.PI) / 180), C + r * Math.sin((deg * Math.PI) / 180)];

/** What the wheel offers. stats: 0..1 bars (label, value). */
export const WHEEL_ITEMS = [
  { id: 'fists', icon: '👊', name: 'Fists', note: 'Click: punch combo · right mouse: block', stats: [['Punch', 0.5], ['Speed', 0.8], ['Reach', 0.2], ['Mess', 0.1]] },
  { id: 'pichkari', icon: '💦', name: 'Pichkari', note: 'Holi spray gun · C colour · [ ] pressure', stats: [['Reach', 0.7], ['Tank', 1], ['Colour', 0.9], ['Mess', 1]] },
  { id: 'cracker:anar', icon: '🌸', name: 'Anar', note: 'Flower pot: a fountain of sparks', stats: [['Bang', 0.2], ['Sparkle', 0.9], ['Fuse', 0.4], ['Risk', 0.2]] },
  { id: 'cracker:chakri', icon: '🌀', name: 'Chakri', note: 'Ground spinner', stats: [['Bang', 0.2], ['Sparkle', 0.6], ['Fuse', 0.4], ['Risk', 0.4]] },
  { id: 'cracker:ladi', icon: '🧨', name: 'Ladi', note: 'A string of crackers', stats: [['Bang', 0.7], ['Sparkle', 0.2], ['Fuse', 0.5], ['Risk', 0.6]] },
  { id: 'cracker:bomb', icon: '💣', name: 'Sutli bomb', note: 'One loud bang. Not after 10 pm', stats: [['Bang', 1], ['Sparkle', 0], ['Fuse', 1], ['Risk', 0.9]] },
  { id: 'cracker:rocket', icon: '🚀', name: 'Sky shot', note: 'Shell bursts over the rooftops', stats: [['Bang', 0.6], ['Sparkle', 1], ['Fuse', 0.6], ['Risk', 0.5]] },
];

export class WeaponWheel {
  /** @param {{ current: () => string, detail: (id: string) => string, pick: (id: string) => void, view?: object }} o */
  constructor(o) {
    Object.assign(this, o);
    this.open = false;
    this.sel = 0;
    this.vx = 0; this.vy = 0;
    const n = WHEEL_ITEMS.length, step = 360 / n;
    this.el = document.createElement('div');
    this.el.id = 'wheel';
    this.el.hidden = true;
    this.el.innerHTML = `<div class="disc"><svg viewBox="0 0 400 400"><g class="sectors"></g></svg><div class="icons"></div>
      <div class="mid"><b></b><small></small><i class="hint">Release B to equip</i></div><div class="dot"></div></div><div class="stats"></div>`;
    document.body.appendChild(this.el);
    const g = this.el.querySelector('.sectors'), icons = this.el.querySelector('.icons');
    this.paths = [];
    this.nodes = [];
    WHEEL_ITEMS.forEach((it, i) => {
      const a0 = -90 - step / 2 + i * step + GAP / 2, a1 = a0 + step - GAP;
      const [ax, ay] = pt(R1, a0), [bx, by] = pt(R1, a1), [cx, cy] = pt(R0, a1), [dx, dy] = pt(R0, a0);
      const p = document.createElementNS(SVG, 'path');
      p.setAttribute('d', `M${ax} ${ay}A${R1} ${R1} 0 0 1 ${bx} ${by}L${cx} ${cy}A${R0} ${R0} 0 0 0 ${dx} ${dy}Z`);
      g.appendChild(p); this.paths.push(p);
      const [ix, iy] = pt((R0 + R1) / 2, -90 + i * step);
      const node = document.createElement('div');
      node.className = 'ico';
      node.style.left = `${(ix / 400) * 100}%`; node.style.top = `${(iy / 400) * 100}%`;
      node.innerHTML = `<i>${it.icon}</i><small></small>`;
      icons.appendChild(node); this.nodes.push(node);
    });
    this.mid = this.el.querySelector('.mid');
    this.statsEl = this.el.querySelector('.stats');
    this.dot = this.el.querySelector('.dot');
    document.addEventListener('mousemove', (e) => {
      if (!this.open) return;
      this.vx += e.movementX || 0; this.vy += e.movementY || 0;
      const len = Math.hypot(this.vx, this.vy);
      if (len > 110) { this.vx *= 110 / len; this.vy *= 110 / len; }
      this.dot.style.transform = `translate(${this.vx * 0.9}px, ${this.vy * 0.9}px)`;
      if (len > 28) {
        const ang = (Math.atan2(this.vy, this.vx) * 180) / Math.PI + 90 + step / 2;
        this.choose(Math.floor((((ang % 360) + 360) % 360) / step) % n);
      }
    });
  }

  choose(i) {
    if (i === this.sel && this._drawn) return;
    this.sel = i; this._drawn = true;
    const it = WHEEL_ITEMS[i];
    this.paths.forEach((p, k) => p.classList.toggle('on', k === i));
    this.nodes.forEach((n, k) => n.classList.toggle('on', k === i));
    this.mid.querySelector('b').textContent = it.name;
    this.mid.querySelector('small').textContent = this.detail(it.id) || it.note;
    this.statsEl.innerHTML = it.stats.map(([l, v]) => `<div><span>${l}</span><u><s style="width:${Math.round(v * 100)}%"></s></u></div>`).join('') + `<p>${it.note}</p>`;
  }

  show() {
    if (this.open) return;
    this.open = true; this.vx = this.vy = 0;
    this.dot.style.transform = '';
    if (this.view) this.view.frozen = true;
    const cur = WHEEL_ITEMS.findIndex((it) => it.id === this.current());
    this._drawn = false;
    this.nodes.forEach((n, k) => { n.querySelector('small').textContent = this.detail(WHEEL_ITEMS[k].id, true) || ''; });
    this.choose(Math.max(0, cur));
    this.el.hidden = false;
    document.body.classList.add('wheel-open');
  }

  /** Close; equips the sector under the cursor unless cancelled. */
  hide(pick = true) {
    if (!this.open) return;
    this.open = false;
    this.el.hidden = true;
    document.body.classList.remove('wheel-open');
    if (this.view) this.view.frozen = false;
    if (pick) this.pick(WHEEL_ITEMS[this.sel].id);
  }
}
