// Keyboard input, exposed as simple booleans. Touch screens set the same fields from
// src/ui/touch.js, plus the joystick's analogue push (moveX right, moveY away; analog while held).
export const input = { fwd: false, back: false, left: false, right: false, brake: false, run: false, reset: false, fire: false, aim: false, moveX: 0, moveY: 0, analog: false };

const keyMap = {
  KeyW: 'fwd', ArrowUp: 'fwd',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'brake',
  ShiftLeft: 'run', ShiftRight: 'run',
  KeyR: 'reset',
};

addEventListener('keydown', (e) => {
  const k = keyMap[e.code];
  if (k) { input[k] = true; e.preventDefault(); }
});
// Alt-Tab or clicking away: nothing stays held down.
addEventListener('blur', () => { for (const k of Object.values(keyMap)) if (k !== 'reset') input[k] = false; });
addEventListener('keyup', (e) => {
  const k = keyMap[e.code];
  if (k && k !== 'reset') input[k] = false; // reset is cleared by the game once handled
});

