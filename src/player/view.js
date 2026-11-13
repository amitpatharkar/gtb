// GTA-style camera control. Click the game to capture the mouse (Esc releases it):
// - Mouse moves the camera around the taxi or the player; in the taxi it swings back
//   behind the car after a moment; on foot you walk where the camera looks.
// - Right mouse button (or the 🎯 button) aims over the shoulder; left button attacks
//   (punch, or spray with the pichkari); the wheel sets pichkari pressure.
// - On touch screens, drag on an empty part of the screen to look around.

export class ViewControl {
  constructor(canvas, input) {
    this.canvas = canvas;
    this.input = input;
    this.yaw = 0;            // absolute camera yaw (0 = looking towards +z)
    this.pitch = 0.12;       // up/down
    this.offset = 0;         // yaw relative to the car (in the car)
    this.idle = 9;           // seconds since the last mouse look
    this.aim = false;
    this.locked = false;
    this.wheel = 0;          // accumulated wheel clicks (consumed by the pichkari)
    this.enabled = true;
    this.sens = 1;
    this.invertY = false;
    const look = (dx, dy, k = 0.0024) => {
      if (!this.enabled) return;
      k *= this.sens;
      if (this.invertY) dy = -dy;
      this.offset -= dx * k;
      this.yaw -= dx * k;
      this.pitch = Math.max(-0.55, Math.min(0.9, this.pitch + dy * k));
      this.idle = 0;
    };
    canvas.addEventListener('click', () => {
      if (!this.enabled || this.locked || matchMedia('(pointer: coarse)').matches) return;
      canvas.requestPointerLock?.()?.catch?.(() => {});
    });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === canvas; if (!this.locked) { input.fire = false; this.mouseAim = false; } });
    document.addEventListener('mousemove', (e) => { if (this.locked) look(e.movementX, e.movementY); });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      if (e.button === 0) input.fire = true;
      if (e.button === 2) this.mouseAim = true;
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) input.fire = false;
      if (e.button === 2) this.mouseAim = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => { if (this.locked) { e.preventDefault(); this.wheel += Math.sign(e.deltaY); } }, { passive: false });
    // Touch: one-finger drag on the canvas looks around.
    const drags = new Map();
    canvas.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') drags.set(e.pointerId, [e.clientX, e.clientY]); });
    canvas.addEventListener('pointermove', (e) => {
      const d = drags.get(e.pointerId);
      if (!d) return;
      look(e.clientX - d[0], e.clientY - d[1], 0.006);
      drags.set(e.pointerId, [e.clientX, e.clientY]);
    });
    for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, (e) => drags.delete(e.pointerId));
  }

  release() { if (this.locked) document.exitPointerLock?.(); }

  /** Keep the camera yaw sensible for the current body (taxi or on foot). */
  update(dt, body, onFoot) {
    this.idle += dt;
    this.aim = onFoot && (!!this.mouseAim || !!this.input.aim);
    if (!onFoot) {
      // In the taxi: free look, then swing back behind the car.
      if (this.idle > 1.4) this.offset *= Math.exp(-dt * 2.5);
      this.offset = Math.atan2(Math.sin(this.offset), Math.cos(this.offset));
      this.yaw = body.heading + this.offset;
      if (this.idle > 1.4) this.pitch += (0.12 - this.pitch) * Math.min(1, dt * 2);
    } else {
      this.offset = 0;
    }
  }

  /** Unit vector the camera looks along (including pitch). */
  forward() {
    const c = Math.cos(this.pitch);
    return [Math.sin(this.yaw) * c, -Math.sin(this.pitch), Math.cos(this.yaw) * c];
  }
}
