import { GAME } from '../brand.js';

// Photo mode: a 2D copy of the frame with the map credit burnt in (the Open Database License
// asks for "© OpenStreetMap contributors" wherever the map is shown, saved pictures included).

/**
 * Copy the WebGL canvas (call right after rendering, in the same task) and stamp the credit
 * in the bottom-right corner. `grade` (post.grade on Low) repeats the on-screen CSS colour
 * filter and vignette, so the picture looks like the game. Resolves to a PNG blob, or null.
 */
export function creditedPhoto(source, grade = null) {
  const c = document.createElement('canvas');
  c.width = source.width; c.height = source.height;
  const g = c.getContext('2d');
  if (grade?.filter && 'filter' in g) g.filter = grade.filter;
  g.drawImage(source, 0, 0);
  g.filter = 'none';
  if (grade?.tint) { g.fillStyle = grade.tint; g.fillRect(0, 0, c.width, c.height); }
  if (grade?.vignette) {
    // An ellipse to the corners, like CSS "farthest-corner": a circle, stretched.
    g.save();
    g.translate(c.width / 2, c.height / 2);
    g.scale(c.width / Math.SQRT2, c.height / Math.SQRT2);
    const v = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    for (const [at, a] of grade.vignette) v.addColorStop(at, `rgba(0,0,0,${a})`);
    g.fillStyle = v;
    g.fillRect(-Math.SQRT2, -Math.SQRT2, 2 * Math.SQRT2, 2 * Math.SQRT2);
    g.restore();
  }
  const text = `Map data © OpenStreetMap contributors · ${GAME.name}`;
  const px = Math.max(12, Math.round(c.height / 60));
  g.font = `600 ${px}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const w = g.measureText(text).width, pad = Math.round(px * 0.5);
  g.fillStyle = 'rgba(0, 0, 0, 0.45)';
  g.fillRect(c.width - w - pad * 3, c.height - px - pad * 3, w + pad * 2, px + pad * 2);
  g.fillStyle = 'rgba(255, 255, 255, 0.92)';
  g.textBaseline = 'middle';
  g.fillText(text, c.width - w - pad * 2, c.height - pad * 2 - px / 2);
  return new Promise((resolve) => c.toBlob(resolve, 'image/png'));
}
