// Junction keys for the road graph: a segment end rounded to 0.5 m, packed into one number
// (number keys are much cheaper than "x,z" strings when the graph is rebuilt on tile loads).
// The road's height (decimetres, 0 at street level) is part of the key: a flyover passing over a
// street, or a tunnel under it, never joins it, even where both have an end in the same place.
const BIAS = 1 << 20, SPAN = 1 << 21, LEVEL = 2 ** 42;
export const endKey = (x, z, y = 0) => (Math.round(x * 2) + BIAS) * SPAN + (Math.round(z * 2) + BIAS) + Math.round(y * 10) * LEVEL;
export const keyXZ = (k) => { const b = k - Math.floor(k / LEVEL) * LEVEL; return [(Math.floor(b / SPAN) - BIAS) / 2, ((b % SPAN) - BIAS) / 2]; };
/** Height of a key's level (m, to the decimetre). */
export const keyY = (k) => Math.floor(k / LEVEL) / 10;
/** Key of segment end `end` (0 or 1) of a road segment s = [x0, z0, x1, z1, hw, flags, y0, y1]. */
export const segEndKey = (s, end) => endKey(s[end * 2], s[end * 2 + 1], s[6 + end]);
