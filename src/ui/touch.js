// Touch controls for phones and tablets, laid out the way big mobile open-world games do it:
// - Left thumb moves: a floating joystick on foot (it appears where the thumb lands and
//   follows a thumb that slides past its edge; a full push runs), ◀ ▶ steering in a vehicle
//   (one pad: slide the thumb across to change direction without lifting it).
// - Right thumb acts: brake and gas pedals with the handbrake and horn above them in a vehicle;
//   on foot a big attack button with aim/block, kick or colour and the weapon swap around it,
//   crackers and insults on an outer ring. Dragging the attack or aim button also turns the
//   camera, so you can spray and steer the aim with one thumb.
// - Context buttons pop up above the right thumb only when they mean something right now:
//   get in or steal a vehicle, fill up at a pump, buy a snack, enter a door, a train ticket,
//   skip an hour while a mission waits for one.
// - Anything that cannot be used here is hidden (indoors: no fists, crackers or vehicles), and
//   buttons show live state: the pichkari's colour, pressure and tank, the cracker type,
//   BRAKE turning into REV when stopped, duty on or off, a constable watching a theft.
// The rest of the screen is the camera: drag anywhere free to look around (view.js).

const I = (body, extra = '') => `<svg viewBox="0 0 24 24" aria-hidden="true" ${extra}>${body}</svg>`;
const ICON = {
  left: I('<path d="M16.5 4 5.5 12l11 8z" fill="currentColor" stroke="none"/>'),
  right: I('<path d="M7.5 4l11 8-11 8z" fill="currentColor" stroke="none"/>'),
  gas: I('<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M9.5 7h5M9.5 10.5h5M9.5 14h5M9.5 17.5h5"/>'),
  brake: I('<rect x="3.5" y="6" width="17" height="12" rx="2.5"/><path d="M7 10h10M7 14h10"/>'),
  handbrake: I('<circle cx="12" cy="12" r="6.2"/><path d="M10.3 15.2V8.8h2.4a1.9 1.9 0 0 1 0 3.8h-2.4"/><path d="M4.2 7.2a9.5 9.5 0 0 0 0 9.6M19.8 7.2a9.5 9.5 0 0 1 0 9.6"/>'),
  horn: I('<path d="M3 9.5v5h3.2L13 19V5L6.2 9.5z" fill="currentColor"/><path d="M16 9.2c1.4 1.5 1.4 4.1 0 5.6M18.6 6.6c2.9 3 2.9 7.8 0 10.8"/>'),
  door: I('<path d="M4 20V11l6.5-6.5H20V20z"/><path d="M4.5 12.5h15.5M15 15.5h3"/>'),
  radio: I('<rect x="3" y="8.5" width="18" height="11.5" rx="2"/><circle cx="15.5" cy="14.2" r="2.8"/><path d="M6.5 12.5h4M6.5 16h4M7 8.5 17 4"/>'),
  aim: I('<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><path d="M12 2.5v4.5M12 17v4.5M2.5 12H7M17 12h4.5"/>'),
  block: I('<path d="M12 3 5 6v5.5c0 4.6 2.9 7.8 7 9.5 4.1-1.7 7-4.9 7-9.5V6z"/><path d="M12 7v10M8 10.5h8" opacity=".55"/>'),
  pause: I('<path d="M8.5 5v14M15.5 5v14" stroke-width="3.4"/>'),
  full: I('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  swap: I('<path d="M5 9h12l-3-3M19 15H7l3 3"/>'),
};

const TEMPLATE = `
  <div class="t-zone" data-for="foot"></div>
  <div class="t-stick" data-for="foot"><i></i></div>

  <div class="t-steer" data-for="drive">
    <button class="t-btn big" data-side="left" aria-label="Steer left">${ICON.left}</button>
    <button class="t-btn big" data-side="right" aria-label="Steer right">${ICON.right}</button>
  </div>
  <div class="t-pedals" data-for="drive">
    <button class="t-btn pedal brake" data-side="left" aria-label="Brake / reverse">${ICON.brake}<small>BRAKE</small></button>
    <button class="t-btn pedal gas" data-side="right" aria-label="Accelerate">${ICON.gas}<small>GAS</small></button>
  </div>
  <button class="t-btn mid t-handbrake" data-for="drive" data-hold="brake" aria-label="Handbrake">${ICON.handbrake}</button>
  <button class="t-btn mid t-horn" data-for="drive" data-tap="horn" aria-label="Horn">${ICON.horn}</button>
  <button class="t-btn mid t-exit" data-for="drive" data-tap="door" aria-label="Get out">${ICON.door}</button>
  <button class="t-btn small t-radio" data-for="drive" data-tap="radio" aria-label="Next radio station">${ICON.radio}</button>
  <button class="t-btn small t-duty" data-for="drive" data-tap="duty" aria-label="Fare duty"><b>TAXI</b></button>

  <button class="t-btn big t-fire" data-for="foot" data-hold="fire" data-look aria-label="Attack"><span class="t-emoji"></span></button>
  <button class="t-btn mid arc t-aim" data-for="foot" data-hold="aim" data-look style="--cx:-1;--sy:0;--r:var(--r1)" aria-label="Aim / block"></button>
  <button class="t-btn mid arc t-kick" data-for="foot fists" data-tap="kick" style="--cx:-.7071;--sy:.7071;--r:var(--r1)" aria-label="Kick"><span class="t-emoji">🦵</span></button>
  <button class="t-btn mid arc t-colour" data-for="foot pichkari" data-tap="colour" style="--cx:-.7071;--sy:.7071;--r:var(--r1)" aria-label="Next colour"><i></i></button>
  <button class="t-btn mid arc t-weapon" data-for="foot" data-tap="weapon" style="--cx:0;--sy:1;--r:var(--r1)" aria-label="Switch weapon"><span class="t-emoji"></span>${ICON.swap}</button>
  <button class="t-btn small arc t-pressure" data-for="foot pichkari" data-tap="pressure" style="--cx:-1;--sy:0;--r:var(--r2)" aria-label="Pichkari pressure"><b></b><small>PRESSURE</small></button>
  <button class="t-btn small arc t-cracker" data-for="foot outdoor" data-tap="cracker" style="--cx:-.866;--sy:.5;--r:var(--r2)" aria-label="Light a cracker"><span class="t-emoji">🎆</span><small></small></button>
  <button class="t-btn tiny arc t-ctype" data-for="foot outdoor" data-tap="crackerType" style="--cx:-.866;--sy:.5;--r:var(--r2)" aria-label="Change cracker">⟳</button>
  <button class="t-btn small arc t-insult" data-for="foot outdoor" data-tap="insult" style="--cx:-.5;--sy:.866;--r:var(--r2)" aria-label="Insult"><span class="t-emoji">🗯️</span></button>

  <div class="t-dock">
    <button class="t-ctx" data-ctx="vehicle" data-tap="door" hidden><span class="t-emoji"></span><b></b></button>
    <button class="t-ctx" data-ctx="interact" data-tap="interact" hidden><span class="t-emoji"></span><b></b></button>
    <button class="t-ctx" data-ctx="wait" data-tap="time" hidden><span class="t-emoji">⏩</span><b>Skip hour</b></button>
  </div>

  <div class="t-util">
    <button class="t-btn util" data-tap="pause" aria-label="Pause">${ICON.pause}</button>
    <button class="t-btn util t-full" data-tap="fullscreen" aria-label="Full screen">${ICON.full}</button>
  </div>`;

const HOLD_KEYS = ['fwd', 'back', 'left', 'right', 'brake', 'fire', 'aim', 'run'];
/** A short buzz on phones that have it (browsers allow it only after the first tap). */
const buzz = (ms) => { if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(ms); };

export class TouchControls {
  /**
   * input: the shared input object (booleans, plus moveX/moveY/analog from the joystick).
   * view: the camera control (view.look turns the camera).
   * act: callbacks by name (horn, door, radio, duty, kick, colour, weapon, pressure, cracker,
   *      crackerType, insult, interact, time, pause, fullscreen).
   */
  constructor(input, view, act) {
    this.input = input;
    this.view = view;
    this.act = act;
    this.root = document.getElementById('touch');
    this.root.innerHTML = TEMPLATE;
    this.root.hidden = false;
    document.body.classList.add('touch');
    this.q = (s) => this.root.querySelector(s);
    this.cache = {};
    this.mode = '';
    Object.assign(input, { moveX: 0, moveY: 0, analog: false });
    this.wireButtons();
    this.wirePads();
    this.wireStick();
    // Nothing stays held when the page loses focus or the phone rotates.
    addEventListener('blur', () => this.releaseAll());
    addEventListener('resize', () => this.restStick());
    if (!document.fullscreenEnabled) this.q('.t-full').remove();
  }

  // ------------------------------------------------------------------ buttons
  wireButtons() {
    // Tap buttons fire on touch-down (no 300 ms wait, works while the other thumb is busy).
    for (const b of this.root.querySelectorAll('[data-tap]')) {
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (b.classList.contains('off')) return;
        b.classList.add('on');
        this.act[b.dataset.tap]?.();
        buzz(8);
      });
      for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => b.classList.remove('on'));
    }
    // Hold buttons keep their input key down; attack and aim also turn the camera when dragged.
    for (const b of this.root.querySelectorAll('[data-hold]')) {
      const k = b.dataset.hold;
      let last = null;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        b.setPointerCapture?.(e.pointerId);
        last = [e.clientX, e.clientY, e.pointerId];
        this.input[k] = true; b.classList.add('on');
      });
      b.addEventListener('pointermove', (e) => {
        if (!last || e.pointerId !== last[2] || !('look' in b.dataset)) return;
        this.view.look?.(e.clientX - last[0], e.clientY - last[1], 0.005);
        last[0] = e.clientX; last[1] = e.clientY;
      });
      const up = (e) => { if (last && e.pointerId !== last[2]) return; last = null; this.input[k] = false; b.classList.remove('on'); };
      for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, up);
    }
  }

  /**
   * Steering and pedals are pads of two buttons: the thumb that lands on a pad drives it until
   * it lifts, and which half it is over decides the key, so sliding across switches direction.
   */
  wirePads() {
    const pads = [[this.q('.t-steer'), 'left', 'right'], [this.q('.t-pedals'), 'back', 'fwd']];
    for (const [pad, keyL, keyR] of pads) {
      const btnL = pad.querySelector('[data-side="left"]'), btnR = pad.querySelector('[data-side="right"]');
      const thumbs = new Map(); // pointerId → 'L' | 'R' | ''
      const apply = () => {
        const vals = [...thumbs.values()];
        const l = vals.includes('L'), r = vals.includes('R');
        if (this.input[keyL] !== l || this.input[keyR] !== r) buzz(5);
        this.input[keyL] = l; this.input[keyR] = r;
        btnL.classList.toggle('on', l); btnR.classList.toggle('on', r);
      };
      const side = (x) => {
        const a = btnL.getBoundingClientRect(), b = btnR.getBoundingClientRect();
        const mid = (a.right + b.left) / 2, dead = Math.min(8, (b.left - a.right) / 2);
        return x < mid - dead ? 'L' : x > mid + dead ? 'R' : thumbs.size ? '' : 'L';
      };
      pad.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        pad.setPointerCapture?.(e.pointerId);
        thumbs.set(e.pointerId, side(e.clientX)); apply();
      });
      pad.addEventListener('pointermove', (e) => {
        if (!thumbs.has(e.pointerId)) return;
        const s = side(e.clientX);
        if (s && s !== thumbs.get(e.pointerId)) { thumbs.set(e.pointerId, s); apply(); }
      });
      const up = (e) => { if (thumbs.delete(e.pointerId)) apply(); };
      for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) pad.addEventListener(ev, up);
      pad.release = () => { thumbs.clear(); apply(); };
    }
  }

  // ------------------------------------------------------------------ joystick
  wireStick() {
    const zone = this.q('.t-zone'), stick = this.q('.t-stick'), knob = stick.querySelector('i');
    const s = this.stick = { id: null, bx: 0, by: 0, el: stick, knob };
    const R = () => stick.offsetWidth * 0.42 || 50; // knob travel
    const place = (x, y) => { s.bx = x; s.by = y; stick.style.transform = `translate(${x - stick.offsetWidth / 2}px, ${y - stick.offsetHeight / 2}px)`; };
    const move = (x, y) => {
      const r = R();
      let dx = x - s.bx, dy = y - s.by;
      let d = Math.hypot(dx, dy);
      // A thumb that slides past the ring drags the joystick along (easy to change direction).
      if (d > r * 1.3) { const k = (d - r * 1.3) / d; place(s.bx + dx * k, s.by + dy * k); dx = x - s.bx; dy = y - s.by; d = Math.hypot(dx, dy); }
      const c = Math.min(1, d / r), ux = d ? dx / d : 0, uy = d ? dy / d : 0;
      knob.style.transform = `translate(${ux * c * r}px, ${uy * c * r}px)`;
      // Dead zone in the middle, then a smooth ramp to full.
      const m = c < 0.12 ? 0 : (c - 0.12) / 0.88;
      this.input.moveX = ux * m; this.input.moveY = -uy * m;
      this.input.analog = true;
      stick.classList.toggle('run', m > 0.92);
    };
    zone.addEventListener('pointerdown', (e) => {
      if (s.id !== null) return;
      e.preventDefault();
      zone.setPointerCapture?.(e.pointerId);
      s.id = e.pointerId;
      stick.classList.add('live');
      const r = stick.offsetWidth / 2;
      place(Math.max(r + 6, Math.min(innerWidth - r - 6, e.clientX)), Math.max(r + 6, Math.min(innerHeight - r - 6, e.clientY)));
      move(e.clientX, e.clientY);
    });
    zone.addEventListener('pointermove', (e) => { if (e.pointerId === s.id) move(e.clientX, e.clientY); });
    const up = (e) => { if (e.pointerId === s.id) this.releaseStick(); };
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) zone.addEventListener(ev, up);
  }

  releaseStick() {
    const s = this.stick;
    s.id = null;
    this.input.moveX = this.input.moveY = 0;
    this.input.analog = false;
    s.knob.style.transform = '';
    s.el.classList.remove('live', 'run');
    this.restStick();
  }

  /** The faint joystick sits at its home spot while no thumb is on it. */
  restStick() {
    const s = this.stick;
    if (!s || s.id !== null) return;
    const el = s.el, w = el.offsetWidth || 120;
    const pad = parseFloat(getComputedStyle(this.root).getPropertyValue('--edge')) || 16;
    s.bx = pad + w / 2 + 8; s.by = innerHeight - pad - w / 2 - 8;
    el.style.transform = `translate(${s.bx - w / 2}px, ${s.by - w / 2}px)`;
  }

  releaseAll() {
    for (const k of HOLD_KEYS) this.input[k] = false;
    for (const b of this.root.querySelectorAll('.on')) b.classList.remove('on');
    this.q('.t-steer').release?.(); this.q('.t-pedals').release?.();
    if (this.stick) this.releaseStick();
  }

  // ------------------------------------------------------------------ state from the game
  /** Write a value into the page only when it changed (called five times a second). */
  set(key, value, fn) { if (this.cache[key] !== value) { this.cache[key] = value; fn(value); } }

  /**
   * s: { mode: 'drive' | 'foot' | 'hidden', indoor, weapon, colour, colourName, pressure, tank,
   *      cracker, fight, stopped, canExit, radio, duty (null hidden, false off, true on),
   *      vehicle: { icon, label, warn } | null, interact: { icon, label } | null, wait }
   */
  update(s) {
    const root = this.root;
    this.set('mode', s.mode, (m) => {
      this.releaseAll();
      root.dataset.mode = m;
      if (m === 'foot') requestAnimationFrame(() => this.restStick());
    });
    if (s.mode === 'hidden') return;
    this.set('indoor', !!s.indoor, (v) => root.classList.toggle('indoor', v));
    this.set('weapon', s.weapon, (w) => {
      root.dataset.weapon = w;
      this.q('.t-fire .t-emoji').textContent = w === 'pichkari' ? '💦' : '👊';
      this.q('.t-weapon .t-emoji').textContent = w === 'pichkari' ? '👊' : '💦';
      this.q('.t-aim').innerHTML = w === 'pichkari' ? ICON.aim : ICON.block;
      this.q('.t-aim').setAttribute('aria-label', w === 'pichkari' ? 'Aim' : 'Block');
    });
    this.set('colour', s.colour, (c) => { root.style.setProperty('--holi', c); });
    this.set('pressure', s.pressure, (p) => { this.q('.t-pressure b').textContent = '●'.repeat(p) + '○'.repeat(5 - p); });
    this.set('tank', Math.round((s.tank ?? 1) * 20), (t) => root.style.setProperty('--tank', `${t * 5}%`));
    this.set('cracker', s.cracker, (c) => { this.q('.t-cracker small').textContent = c; });
    this.set('fight', !!s.fight, (v) => root.classList.toggle('fight', v));
    this.set('stopped', !!s.stopped, (v) => { this.q('.t-pedals .brake small').textContent = v ? 'REV' : 'BRAKE'; });
    this.set('canExit', s.canExit !== false, (v) => this.q('.t-exit').classList.toggle('off', !v));
    this.set('radio', !!s.radio, (v) => { this.q('.t-radio').hidden = !v; });
    this.set('duty', s.duty, (d) => { const b = this.q('.t-duty'); b.hidden = d == null; b.classList.toggle('active', d === true); });
    this.set('vehicle', s.vehicle ? `${s.vehicle.icon}|${s.vehicle.label}|${s.vehicle.warn ? 1 : 0}` : '', (v) => this.context('vehicle', s.vehicle));
    this.set('interact', s.interact ? `${s.interact.icon}|${s.interact.label}` : '', () => this.context('interact', s.interact));
    this.set('wait', !!s.wait, (v) => { this.q('[data-ctx="wait"]').hidden = !v; });
  }

  context(name, c) {
    const b = this.q(`[data-ctx="${name}"]`);
    b.hidden = !c;
    if (!c) return;
    b.querySelector('.t-emoji').textContent = c.icon;
    b.querySelector('b').textContent = c.label;
    b.classList.toggle('warn', !!c.warn);
    b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); // replay the pop-in
  }
}
