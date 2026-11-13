// Robust polygon operations with Clipper (integer coordinates, centimetre grid).
// Used for street surfaces: road offsets with round ends, unions and differences.
import { createRequire } from 'node:module';

const ClipperLib = createRequire(import.meta.url)('clipper-lib');
const { Clipper, ClipperOffset, ClipType, PolyType, PolyFillType, JoinType, EndType, PolyTree, Paths } = ClipperLib;
export const SCALE = 100;

export const toPath = (ring) => ring.map(([x, z]) => ({ X: Math.round(x * SCALE), Y: Math.round(z * SCALE) }));
export const fromPath = (p) => p.map(({ X, Y }) => [X / SCALE, Y / SCALE]);
export const rectPath = ([x0, z0, x1, z1]) => toPath([[x0, z0], [x1, z0], [x1, z1], [x0, z1]]);

/** polygon-clipping MultiPolygon ([[outer, hole...], ...]) → flat Clipper paths (use even-odd fill). */
export function mpToPaths(mp) {
  const out = [];
  for (const poly of mp) for (const ring of poly) {
    const r = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring;
    if (r.length >= 3) out.push(toPath(r));
  }
  return out;
}

/**
 * Buffer polylines into one merged surface. groups: [{ delta: halfWidthMetres, lines: [[[x,z],...], ...] }]
 * Round joins and round ends, then a union of everything.
 */
export function bufferLines(groups, arcTolerance = 0.08) {
  const c = new Clipper();
  let any = false;
  for (const { delta, lines } of groups) {
    if (!lines.length || delta <= 0) continue;
    const co = new ClipperOffset(2, arcTolerance * SCALE);
    co.AddPaths(lines.map(toPath), JoinType.jtRound, EndType.etOpenRound);
    const sol = new Paths();
    co.Execute(sol, delta * SCALE);
    if (sol.length) { c.AddPaths(sol, PolyType.ptSubject, true); any = true; }
  }
  if (!any) return [];
  const out = new Paths();
  c.Execute(ClipType.ctUnion, out, PolyFillType.pftNonZero, PolyFillType.pftNonZero);
  return out;
}

function run(type, subj, clip, subjFill, clipFill, tree) {
  const c = new Clipper();
  if (subj.length) c.AddPaths(subj, PolyType.ptSubject, true);
  if (clip.length) c.AddPaths(clip, PolyType.ptClip, true);
  const out = tree ? new PolyTree() : new Paths();
  c.Execute(type, out, subjFill, clipFill);
  return out;
}
const EO = PolyFillType.pftEvenOdd;
export const union = (a, b = []) => run(ClipType.ctUnion, a, b, EO, EO);
export const intersect = (a, b) => (a.length && b.length ? run(ClipType.ctIntersection, a, b, EO, EO) : []);
export const difference = (a, b) => (!a.length ? [] : !b.length ? a : run(ClipType.ctDifference, a, b, EO, EO));

/** Paths → polygons with holes ([[outer, hole...], ...]) in metres, small slivers dropped. */
export function toPolygons(paths, minArea = 0.5) {
  if (!paths.length) return [];
  const tree = run(ClipType.ctUnion, Clipper.CleanPolygons(paths, 0.03 * SCALE), [], EO, EO, true);
  const ex = ClipperLib.JS.PolyTreeToExPolygons(tree);
  const s2 = SCALE * SCALE;
  return ex
    .filter((e) => e.outer.length >= 3 && Math.abs(Clipper.Area(e.outer)) / s2 >= minArea)
    .map((e) => [fromPath(e.outer), ...e.holes.filter((h) => h.length >= 3 && Math.abs(Clipper.Area(h)) / s2 >= 0.05).map(fromPath)]);
}

export function areaOf(paths) {
  return paths.reduce((s, p) => s + Clipper.Area(p), 0) / (SCALE * SCALE);
}
