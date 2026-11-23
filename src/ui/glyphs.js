// Button glyphs for prompts: the same action shows the key you'd press on the device you're
// using right now (keyboard + mouse, or an Xbox/PlayStation-style controller). One component
// everywhere, so players learn the pattern once (consistency, §17 of the UI study).
const KEY = {
  enter: 'F', jump: 'Space', sprint: 'Shift', aim: 'RMB', fire: 'LMB', reload: 'R', handbrake: 'Space', horn: 'H',
  map: 'M', phone: 'P', wheel: 'Tab', pause: 'Esc', back: 'Esc', cancel: 'Esc', select: 'Enter', tabs: 'Q / E', look: 'Mouse', move: 'W A S D',
  throttle: 'W', brake: 'S', walk: 'Alt',
};
const PAD = {
  enter: 'Y', jump: 'X', sprint: 'A', aim: 'LT', fire: 'RT', reload: 'B', handbrake: 'B', horn: 'L3',
  map: 'View', phone: '↑', wheel: 'LB', pause: 'Menu', back: 'B', cancel: 'B', select: 'A', tabs: 'LB / RB', look: 'Right stick', move: 'Left stick',
  throttle: 'RT', brake: 'LT', walk: '',
};
const PAD_COLOUR = { Y: '#e0b100', X: '#2f7de1', A: '#3aa63a', B: '#d43b2f' };

/** HTML for one key glyph. */
export function glyph(action, pad) {
  const k = (pad ? PAD : KEY)[action] ?? action;
  if (!k) return '';
  const c = pad && PAD_COLOUR[k];
  return `<kbd class="${pad ? 'pad' : ''}"${c ? ` style="background:${c};color:#fff"` : ''}>${k}</kbd>`;
}

/** "Press {enter} to get in" → HTML with glyphs for the current device. */
export function withGlyphs(text, pad) {
  return text.replace(/\{(\w+)\}/g, (_, a) => glyph(a, pad));
}
