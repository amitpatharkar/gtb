// Weapon silhouettes for the HUD and the weapon wheel (inline SVG, white on transparent).
const svg = (w, h, d) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${h}'><path fill='white' d='${d}'/></svg>`)}")`;

export const ICONS = {
  fists: svg(64, 40, 'M14 14c0-4 3-6 6-6h22c4 0 7 3 7 7v4h3c3 0 5 2 5 5v4c0 6-5 10-11 10H26c-7 0-12-5-12-12zM20 12v8h6v-8zm8 0v8h6v-8zm8 0v8h6v-8z'),
  pistol: svg(64, 32, 'M4 6h50l3 3v6H32l-2 3h-6l-3 10c-1 2-2 3-4 3H9c-2 0-3-2-2-4l5-12H4z'),
  smg: svg(80, 32, 'M2 8h62v4h12v5H58l-4 4h-9l-2 9h-7l2-9h-6l-3 7h-7l3-7H18l-3 2H2z'),
  shotgun: svg(96, 28, 'M2 8h70l22 2v4L72 15H50l-6 3H26l-10 8H4l8-10H2z'),
  rifle: svg(96, 32, 'M2 9h22l6-3h40v3h24v4H70v3H52l-3 4h-8l-2 9h-7l3-9h-6l-3 3H18L4 17H2z'),
  throwable: svg(40, 40, 'M18 4h6v5h-6zM12 11h18c3 0 5 2 5 5v12c0 6-5 10-11 10h-6C12 38 7 34 7 28V16c0-3 2-5 5-5z'),
  melee: svg(80, 24, 'M4 10h46l26 1v3L50 15H4z M2 8h6v9H2z'),
  heavy: svg(96, 36, 'M8 10h62l18-4v24l-18-4H50l-4 8h-8l3-8H8l-6-4V14z'),
};
