// Input: keyboard + mouse (pointer lock) and Xbox/PlayStation controllers (standard mapping),
// turned into named actions. Game code asks for actions, never for keys.
//
//   input.down('sprint')      held this frame
//   input.pressed('enter')    went down since the last frame (edge)
//   input.move                {x, y} on-foot movement, -1..1 (y = forward)
//   input.look                {x, y} camera look this frame (mouse pixels or stick × dt)
//   input.throttle / brake / steer   vehicle controls, 0..1 / 0..1 / -1..1

const KEYS = {
  forward: ['KeyW', 'ArrowUp'], back: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'], jump: ['Space'], handbrake: ['Space'], enter: ['KeyF'], horn: ['KeyH'],
  reload: ['KeyR'], weapon1: ['Digit1'], weapon2: ['Digit2'], pause: ['Escape', 'KeyP'], tuning: ['F2'],
  map: ['KeyM'], camera: ['KeyV'], walk: ['AltLeft', 'AltRight'], crouch: ['KeyC', 'ControlLeft'],
};
// Standard gamepad buttons: 0 A, 1 B, 2 X, 3 Y, 4 LB, 5 RB, 6 LT, 7 RT, 8 Back, 9 Start,
// 10 left stick, 11 right stick, 12–15 d-pad up/down/left/right.
const PAD = { sprint: [0], jump: [2], handbrake: [1], reload: [1], enter: [3], horn: [10], pause: [9], map: [8], weapon1: [14], weapon2: [15], camera: [11] };
const DEAD = 0.15;
const dz = (v) => (Math.abs(v) < DEAD ? 0 : (v - Math.sign(v) * DEAD) / (1 - DEAD));

export class Input {
  constructor(el) {
    this.el = el;
    this.keys = new Set();
    this.prev = new Set();
    this.now = new Set();
    this.mouse = { dx: 0, dy: 0, wheel: 0, left: false, right: false };
    this.move = { x: 0, y: 0 };
    this.look = { x: 0, y: 0 };
    this.throttle = 0; this.brake = 0; this.steer = 0;
    this.aim = false; this.fire = false;
    this.usingPad = false;
    this.locked = false;
    this.sensitivity = 1;
    this.enabled = true;
    // Headless tests and the tuning panel can set actions directly.
    this.forced = new Set();

    addEventListener('keydown', (e) => {
      if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      this.keys.add(e.code); this.usingPad = false;
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.mouse.left = this.mouse.right = false; });
    el.addEventListener('mousedown', (e) => {
      if (!this.locked && this.enabled) { el.requestPointerLock?.(); }
      if (e.button === 0) this.mouse.left = true;
      if (e.button === 2) this.mouse.right = true;
      this.usingPad = false;
    });
    addEventListener('mouseup', (e) => { if (e.button === 0) this.mouse.left = false; if (e.button === 2) this.mouse.right = false; });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => { if (this.locked) { this.mouse.dx += e.movementX; this.mouse.dy += e.movementY; } });
    addEventListener('wheel', (e) => { this.mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === el; });
  }

  isDown(action) {
    if (this.forced.has(action)) return true;
    for (const k of KEYS[action] || []) if (this.keys.has(k)) return true;
    if (action === 'aim' && this.mouse.right) return true;
    if (action === 'fire' && this.mouse.left && this.locked) return true;
    const pad = this.pad;
    if (pad) {
      for (const b of PAD[action] || []) if (pad.buttons[b]?.pressed) return true;
      if (action === 'aim' && pad.buttons[6]?.value > 0.4) return true;
      if (action === 'fire' && pad.buttons[7]?.value > 0.4) return true;
    }
    return false;
  }

  /** Call once per rendered frame, before the game reads input. dt in seconds. */
  update(dt) {
    this.pad = [...(navigator.getGamepads?.() || [])].find((p) => p && p.connected && p.mapping === 'standard') || null;
    this.prev = this.now;
    this.now = new Set();
    for (const a of [...Object.keys(KEYS), 'aim', 'fire']) if (this.enabled && this.isDown(a)) this.now.add(a);

    const kx = (this.now.has('right') ? 1 : 0) - (this.now.has('left') ? 1 : 0);
    const ky = (this.now.has('forward') ? 1 : 0) - (this.now.has('back') ? 1 : 0);
    let mx = kx, my = ky, lx = 0, ly = 0, throttle = this.now.has('forward') ? 1 : 0, brake = this.now.has('back') ? 1 : 0;
    const pad = this.pad;
    if (pad && this.enabled) {
      const ax = dz(pad.axes[0] || 0), ay = dz(pad.axes[1] || 0), rx = dz(pad.axes[2] || 0), ry = dz(pad.axes[3] || 0);
      if (ax || ay || rx || ry || pad.buttons.some((b) => b.pressed)) this.usingPad = true;
      if (ax || ay) { mx = ax; my = -ay; }
      lx = rx * 900 * dt; ly = ry * 600 * dt; // stick → equivalent mouse pixels per frame
      throttle = Math.max(throttle, pad.buttons[7]?.value || 0);
      brake = Math.max(brake, pad.buttons[6]?.value || 0);
    }
    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }
    this.move.x = this.enabled ? mx : 0; this.move.y = this.enabled ? my : 0;
    this.look.x = (this.mouse.dx * this.sensitivity) + lx;
    this.look.y = (this.mouse.dy * this.sensitivity) + ly;
    this.mouse.dx = this.mouse.dy = 0;
    this.wheel = this.mouse.wheel; this.mouse.wheel = 0;
    this.throttle = this.enabled ? throttle : 0;
    this.brake = this.enabled ? brake : 0;
    this.steer = this.enabled ? (pad && Math.abs(dz(pad.axes[0] || 0)) > 0 ? dz(pad.axes[0]) : kx) : 0;
    this.aim = this.now.has('aim');
    this.fire = this.now.has('fire');
  }

  down(action) { return this.now.has(action); }
  pressed(action) { return this.now.has(action) && !this.prev.has(action); }
  released(action) { return !this.now.has(action) && this.prev.has(action); }
  release() { this.keys.clear(); this.forced.clear(); this.mouse.left = this.mouse.right = false; }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
}
