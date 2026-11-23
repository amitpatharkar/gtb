// Junction keys for the road graph: a segment end rounded to 0.5 m, packed into one number
// (number keys are much cheaper than "x,z" strings when the graph is rebuilt on tile loads).
const BIAS = 1 << 20, SPAN = 1 << 21;
export const endKey = (x, z) => (Math.round(x * 2) + BIAS) * SPAN + (Math.round(z * 2) + BIAS);
export const keyXZ = (k) => [(Math.floor(k / SPAN) - BIAS) / 2, ((k % SPAN) - BIAS) / 2];
