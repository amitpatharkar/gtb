#!/usr/bin/env node
// Debug helper: draw all tiles in public/tiles as one top-down SVG map.
//   node scripts/preview-tiles.mjs [out.svg]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { decodeTile, AREA } from '../src/world/tileFormat.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'public/tiles');
const out = process.argv[2] || path.join(root, 'tiles-preview.svg');
const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
const { minX, minZ, maxX, maxZ } = index.bounds;
const AREA_FILL = {
  [AREA.LAND]: '#d8d2c4', [AREA.PAVED]: '#bdb6aa', [AREA.GRASS]: '#8fbf63', [AREA.PITCH]: '#a8cf72',
  [AREA.WOOD]: '#4f8a3c', [AREA.SAND]: '#ead9a4', [AREA.POOL]: '#5fc4e0', [AREA.PIER]: '#9a8f80',
  [AREA.PLATFORM]: '#a59d93', [AREA.DIRT]: '#b49a74', [AREA.RAILYARD]: '#a39a8c',
  [AREA.PLOT]: '#cfc8b8', [AREA.ROAD]: '#3b3b3e', [AREA.FOOTPATH]: '#9c9890',
};
const POINT_FILL = ['#2f6b2a', '#d2452b', '#4f8a3c', '#7dbb4f', '#ffd400', '#ff0000', '#0050ff'];
const f = (n) => n.toFixed(1);
const ring = (r, ox, oz) => {
  let d = '';
  for (let i = 0; i < r.length; i += 2) d += (i ? 'L' : 'M') + f(r[i] + ox) + ' ' + f(r[i + 1] + oz);
  return d;
};
const parts = [];
for (const [tx, tz] of index.tiles) {
  const t = decodeTile(new Uint8Array(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${tx}_${tz}.bin.gz`)))));
  const ox = (tx + 0.5) * t.size, oz = (tz + 0.5) * t.size;
  for (const a of t.areas) {
    if (a.kind === AREA.LAND) continue;
    const layer = a.kind === AREA.PLOT ? 0 : a.kind === AREA.ROAD || a.kind === AREA.FOOTPATH ? 0.5 : 0.2;
    parts.push([layer, `<path d="${a.rings.map((r) => ring(r, ox, oz) + 'Z').join('')}" fill="${AREA_FILL[a.kind]}" fill-rule="evenodd"/>`]);
  }
  for (const m of t.markings) parts.push([3.5, `<path d="${ring(m.line, ox, oz)}" stroke="#fff" stroke-width="${m.width}" fill="none"/>`]);
  for (const p of t.points) parts.push([4.5, `<circle cx="${f(p.x + ox)}" cy="${f(p.z + oz)}" r="${p.kind < 4 ? 2.5 * p.size : 1.2}" fill="${POINT_FILL[p.kind]}" opacity="0.85"/>`]);
  for (const r of t.rails) parts.push([2, `<path d="${ring(r.line, ox, oz)}" stroke="#6b4f3a" stroke-width="3" fill="none"/>`]);
  for (const r of t.roads) if (r.cls >= 9 && r.cls !== 11) parts.push([1, `<path d="${ring(r.line, ox, oz)}" stroke="#eee" stroke-width="${r.width}" fill="none" stroke-linecap="round"/>`]);
  for (const b of t.buildings) parts.push([4, `<path d="${b.rings.map((r) => ring(r, ox, oz) + 'Z').join('')}" fill="hsl(20,${Math.min(60, b.height)}%,${70 - Math.min(40, b.height / 3)}%)" stroke="#555" stroke-width="0.3" fill-rule="evenodd"/>`]);
  parts.push([5, `<rect x="${tx * t.size}" y="${tz * t.size}" width="${t.size}" height="${t.size}" fill="none" stroke="#f00" stroke-width="1" opacity="0.3"/>`]);
}
parts.sort((a, b) => a[0] - b[0]);
const s = index.spawn;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minZ} ${maxX - minX} ${maxZ - minZ}" width="${Math.round((maxX - minX) / 4)}" height="${Math.round((maxZ - minZ) / 4)}">
<rect x="${minX}" y="${minZ}" width="${maxX - minX}" height="${maxZ - minZ}" fill="#3d7fa6"/>
${parts.map((p) => p[1]).join('\n')}
<circle cx="${s.x}" cy="${s.z}" r="25" fill="#e00"/></svg>`;
fs.writeFileSync(out, svg);
console.log(`wrote ${out}`);
