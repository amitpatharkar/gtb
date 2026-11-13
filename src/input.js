// Keyboard + touch input, exposed as simple booleans.
export const input = { fwd: false, back: false, left: false, right: false, brake: false, run: false, reset: false };

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
addEventListener('keyup', (e) => {
  const k = keyMap[e.code];
  if (k && k !== 'reset') input[k] = false; // reset is cleared by the game once handled
});

for (const btn of document.querySelectorAll('#touch button')) {
  const k = btn.dataset.key;
  const set = (v) => (e) => { e.preventDefault(); input[k] = v; btn.classList.toggle('on', v); };
  btn.addEventListener('pointerdown', set(true));
  btn.addEventListener('pointerup', set(false));
  btn.addEventListener('pointerleave', set(false));
  btn.addEventListener('pointercancel', set(false));
}
