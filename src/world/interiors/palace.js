import * as THREE from 'three';
import { Geo, flip, POSE, FLAG, person, hex, font } from './kit.js';

// The lobby of the Royal Chaj Mahal Palace: a generic grand heritage hotel (deliberately
// not the look of any real one). Marble floor, columns, a grand staircase under a painted
// dome, chandeliers, the reception desk with its row of world clocks, sofas, a turbaned
// doorman — and, through an arch, the Sea Lounge with tables at tall windows over the
// harbour. E at the reserved window table: high tea.

const H = 7.5;           // lobby ceiling
const CREAM = 0xfffaf0, GOLD = 0xc9a24a, DARKWOOD = 0x5a3a22, MARBLE = 0xece5d6, RED = 0x8c1c24;

/** The harbour from the lounge windows: sea, boats, the Gateway of Indiyaa on its quay. */
function harbour(g, w, h) {
  const hz = h * 0.45;
  const sky = g.createLinearGradient(0, 0, 0, hz);
  sky.addColorStop(0, '#86aacd'); sky.addColorStop(0.75, '#cdd8dc'); sky.addColorStop(1, '#e6dfcd');
  g.fillStyle = sky; g.fillRect(0, 0, w, hz + 1);
  g.fillStyle = '#9aa89c'; g.beginPath(); g.moveTo(0, hz); for (let x = 0; x <= w; x += 20) g.lineTo(x, hz - 5 - 6 * Math.sin(x * 0.004 + 1) - 3 * Math.sin(x * 0.013)); g.lineTo(w, hz); g.fill(); // far shore across the harbour
  const sea = g.createLinearGradient(0, hz, 0, h);
  sea.addColorStop(0, '#93aeb3'); sea.addColorStop(1, '#3f6670');
  g.fillStyle = sea; g.fillRect(0, hz, w, h - hz);
  g.strokeStyle = 'rgba(240,245,240,0.3)'; g.lineWidth = 1;
  for (let i = 0; i < 320; i++) { const y = hz + 4 + ((i * 41) % (h - hz - 60)), x = (i * 197) % w, l = 8 + (i % 7) * 7; g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y); g.stroke(); }
  // Boats: ferry launches, fishing boats, a couple of sails.
  const boat = (x, y, s, hull, cabin) => { g.fillStyle = hull; g.beginPath(); g.moveTo(x - 20 * s, y); g.lineTo(x + 22 * s, y); g.lineTo(x + 16 * s, y + 7 * s); g.lineTo(x - 15 * s, y + 7 * s); g.fill(); g.fillStyle = cabin; g.fillRect(x - 10 * s, y - 7 * s, 18 * s, 7 * s); };
  [[120, 0.5, '#2d4f7c', '#f1ede2'], [330, 0.8, '#b3432f', '#f1ede2'], [520, 0.6, '#f1ede2', '#2d6f8c'], [700, 1.3, '#1f3a5c', '#f4f0e4'], [900, 0.55, '#3a6b4a', '#e9e2cf'], [1010, 1.0, '#b88a2a', '#f1ede2'], [1230, 0.7, '#2d4f7c', '#f1ede2'], [1480, 1.1, '#8a3b2e', '#f4f0e4'], [1700, 0.6, '#f1ede2', '#a33'], [1900, 0.9, '#1f3a5c', '#f4f0e4']]
    .forEach(([x, s, a, b], i) => boat(x, hz + 14 + s * 60 + (i % 3) * 12, s, a, b));
  for (const [x, s] of [[430, 0.7], [1350, 0.9]]) { g.fillStyle = '#f6f3ea'; g.beginPath(); g.moveTo(x, hz + 30 * s); g.lineTo(x, hz - 6 * s); g.lineTo(x + 22 * s, hz + 30 * s); g.fill(); g.fillStyle = '#31495a'; g.fillRect(x - 12 * s, hz + 30 * s, 40 * s, 5 * s); }
  // The quay and the great arch (the game's own Gateway), to one side of the view.
  g.fillStyle = '#b9b2a2'; g.fillRect(w * 0.56, h * 0.74, w * 0.44, h * 0.26);
  g.fillStyle = '#8f897c'; g.fillRect(w * 0.56, h * 0.74, w * 0.44, 5);
  const gx = w * 0.78, gy = h * 0.74;
  g.fillStyle = '#d2ae74'; g.fillRect(gx - 70, gy - 112, 140, 112); g.fillRect(gx - 122, gy - 80, 52, 80); g.fillRect(gx + 70, gy - 80, 52, 80);
  g.fillStyle = '#c29a5e'; for (const x of [-70, 58]) g.fillRect(gx + x, gy - 134, 12, 134);
  g.fillStyle = '#e4cfa2'; g.beginPath(); g.arc(gx, gy - 112, 30, Math.PI, 0); g.fill();
  g.fillStyle = '#93aeb3'; g.beginPath(); g.moveTo(gx - 26, gy); g.lineTo(gx - 26, gy - 56); g.quadraticCurveTo(gx, gy - 96, gx + 26, gy - 56); g.lineTo(gx + 26, gy); g.fill();
  for (const x of [-100, 92]) { g.beginPath(); g.moveTo(gx + x - 8, gy); g.lineTo(gx + x - 8, gy - 36); g.quadraticCurveTo(gx + x + 4, gy - 58, gx + x + 16, gy - 36); g.lineTo(gx + x + 16, gy); g.fill(); }
  for (let i = 0; i < 46; i++) { g.fillStyle = ['#c0392b', '#f1c40f', '#2e86c1', '#f4f4f0', '#27ae60', '#8e44ad'][i % 6]; g.fillRect(w * 0.57 + ((i * 61) % (w * 0.42)), h * 0.77 + ((i * 17) % 40), 4, 9); } // people on the quay
}
function harbourLights(g, w, h) {
  const hz = h * 0.45;
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) { const x = (i * 149) % w; g.fillStyle = ['#ffd58a', '#fff0c8', '#ffb45e'][i % 3]; g.fillRect(x, hz - 3 - (i % 5), 2, 2); g.fillStyle = 'rgba(255,200,120,0.1)'; g.fillRect(x, hz + 2, 2, 8 + (i % 6) * 5); }
  [[120, 0.5], [330, 0.8], [520, 0.6], [700, 1.3], [900, 0.55], [1010, 1.0], [1230, 0.7], [1480, 1.1], [1700, 0.6], [1900, 0.9]].forEach(([x, s], i) => { const y = hz + 10 + s * 60 + (i % 3) * 12; g.fillStyle = '#ffe2a8'; g.fillRect(x - 6 * s, y - 4 * s, 12 * s, 3 * s); g.fillStyle = i % 2 ? '#ff5a4a' : '#6dff8a'; g.fillRect(x + 18 * s, y, 3, 3); g.fillStyle = 'rgba(255,220,150,0.12)'; g.fillRect(x - 6 * s, y + 8 * s, 12 * s, 26 * s); });
  const gx = w * 0.78, gy = h * 0.74, glow = g.createLinearGradient(0, gy, 0, gy - 140);
  glow.addColorStop(0, 'rgba(255,190,110,0.85)'); glow.addColorStop(1, 'rgba(255,170,90,0.15)');
  g.fillStyle = glow; g.fillRect(gx - 122, gy - 134, 244, 134); // the floodlit arch
  for (let x = w * 0.56; x < w; x += 34) { g.fillStyle = '#ffc070'; g.beginPath(); g.arc(x, gy + 4, 2.5, 0, 7); g.fill(); g.fillStyle = 'rgba(255,180,100,0.18)'; g.beginPath(); g.arc(x, gy + 16, 12, 0, 7); g.fill(); }
  for (let i = 0; i < 70; i++) { g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect((i * 389) % w, (i * 71) % (hz * 0.8), 1.5, 1.5); }
}

export function buildPalace(k, api) {
  // Polished cream marble, 1.2 m slabs with small dark-green insets.
  k.painted('floor', 2.4, 512, (g) => {
    g.fillStyle = '#e8dfcc'; g.fillRect(0, 0, 512, 512);
    for (let n = 0; n < 70; n++) { g.strokeStyle = `rgba(${150 + Math.random() * 60},${130 + Math.random() * 50},${100 + Math.random() * 40},${0.08 + Math.random() * 0.14})`; g.lineWidth = 1 + Math.random() * 2; g.beginPath(); let x = Math.random() * 512, y = Math.random() * 512; g.moveTo(x, y); for (let i = 0; i < 6; i++) { x += (Math.random() - 0.5) * 120; y += (Math.random() - 0.3) * 90; g.lineTo(x, y); } g.stroke(); }
    g.strokeStyle = 'rgba(120,105,80,0.5)'; g.lineWidth = 2;
    for (const v of [0, 256]) { g.beginPath(); g.moveTo(v, 0); g.lineTo(v, 512); g.moveTo(0, v); g.lineTo(512, v); g.stroke(); }
    g.fillStyle = '#23402f';
    for (const [x, y] of [[0, 0], [256, 0], [0, 256], [256, 256], [512, 0], [0, 512], [512, 512], [256, 512], [512, 256]]) { g.beginPath(); g.moveTo(x, y - 26); g.lineTo(x + 26, y); g.lineTo(x, y + 26); g.lineTo(x - 26, y); g.fill(); }
  }, { roughness: 0.16 });
  // Lounge carpet: deep teal with a small gold motif.
  k.painted('carpet', 1.6, 256, (g) => {
    g.fillStyle = '#1f4c50'; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = '#c9a24a'; g.lineWidth = 3;
    for (const [x, y] of [[64, 64], [192, 192]]) { g.beginPath(); g.arc(x, y, 30, 0, 7); g.stroke(); g.beginPath(); g.moveTo(x - 44, y); g.lineTo(x + 44, y); g.moveTo(x, y - 44); g.lineTo(x, y + 44); g.stroke(); }
    g.fillStyle = '#2c6468'; for (const [x, y] of [[192, 64], [64, 192]]) { g.beginPath(); g.moveTo(x, y - 34); g.lineTo(x + 34, y); g.lineTo(x, y + 34); g.lineTo(x - 34, y); g.fill(); }
  }, { roughness: 0.95 });
  // The inside of the dome: cream, gold ribs, a ring of rosettes.
  k.painted('dome', 1, 512, (g) => {
    const bg = g.createLinearGradient(0, 0, 0, 512); bg.addColorStop(0, '#fbf3df'); bg.addColorStop(1, '#e7d6b4'); g.fillStyle = bg; g.fillRect(0, 0, 512, 512);
    g.fillStyle = '#c9a24a'; for (let i = 0; i < 16; i++) g.fillRect(i * 32 - 2, 40, 5, 472);
    g.fillRect(0, 36, 512, 8); g.fillRect(0, 486, 512, 26);
    for (let i = 0; i < 16; i++) for (const [y, r] of [[420, 9], [330, 7.5], [245, 6], [170, 4.5]]) { g.beginPath(); g.arc(i * 32 + 16, y, r, 0, 7); g.fill(); }
  }, { roughness: 0.7 });
  const paint = k.to('paint'), floor = k.to('floor'), wood = k.to('wood'), flat = k.to('flat'), satin = k.to('satin'), gloss = k.to('gloss');
  const brass = k.to('brass'), glass = k.to('glass'), glow = k.to('glow');

  // ------------------------------------------------------------------ shell
  k.rooms.push([-10, 0, 10, 24.4, H], [10.4, 3, 22, 19, 5.2], [9.2, 9.5, 11.6, 12.5, 4.3]);
  floor.floor(-10, 0, 10.4, 24.4, 0);
  k.to('carpet').floor(10.4, 3, 22, 19, 0);
  // Street wall: the doors between four tall arched windows.
  paint.arches(-10.3, -0.15, 10.3, -0.15, 0, H, 0.3, [[10.3, 2.64, 2.92, 2.94], [3.3, 1.8, 4.2, 5.1, 0.9], [6.8, 1.8, 4.2, 5.1, 0.9], [13.8, 1.8, 4.2, 5.1, 0.9], [17.3, 1.8, 4.2, 5.1, 0.9]], CREAM, 'round');
  for (const x of [-7, -3.5, 3.5, 7]) {
    k.day().quad(x, 3.0, -0.2, 1.8, 4.2, 0, 0xe9efe9);
    for (const dx of [-0.3, 0.3]) brass.box(x + dx, 0.9, -0.14, 0.04, 4.1, 0.04, GOLD);
    for (const y of [2.0, 3.1, 4.2]) brass.box(x, y, -0.14, 1.8, 0.04, 0.04, GOLD);
    satin.box(x, 0.84, 0.02, 2.0, 0.06, 0.3, MARBLE);
    for (const s of [-1, 1]) flat.box(x + s * 1.02, 0.5, 0.1, 0.34, 4.9, 0.1, RED); // drapes
  }
  paint.wall(-10.15, 0, -10.15, 24.4, 0, H, 0.3, [], CREAM);
  paint.wall(-10.3, 24.55, 10.3, 24.55, 0, H, 0.3, [], CREAM);
  paint.arches(10.2, 0, 10.2, 24.4, 0, H, 0.4, [[11, 3.4, 3.1, 4.8]], CREAM, 'round');
  // Lounge walls; its far wall is all windows.
  paint.wall(10.4, 2.85, 22.3, 2.85, 0, 5.2, 0.3, [], CREAM); paint.wall(10.4, 19.15, 22.3, 19.15, 0, 5.2, 0.3, [], CREAM);
  paint.arches(22.15, 3, 22.15, 19, 0, 5.2, 0.3, [1.6, 4.8, 8, 11.2, 14.4].map((u) => [u, 2.1, 3.3, 4.35, 0.5]), CREAM, 'round');
  paint.ceiling(10.4, 3, 22, 19, 5.2, 0xf7f3e8);
  paint.ceiling(-10, 0, 10, 13.3, H, 0xf7f3e8);
  // Ceiling around the dome: a slab with a round opening, then the drum and the dome.
  const DZ = 18.8, DR = 5.5;
  const ring = new THREE.Shape(); ring.moveTo(-10, 13.3); ring.lineTo(10, 13.3); ring.lineTo(10, 24.4); ring.lineTo(-10, 24.4); ring.lineTo(-10, 13.3);
  ring.holes.push(new THREE.Path().absarc(0, DZ, DR, 0, Math.PI * 2, true));
  paint.add(new THREE.ShapeGeometry(ring, 24).rotateX(Math.PI / 2).translate(0, H, 0), 0xf7f3e8);
  paint.add(flip(new THREE.CylinderGeometry(DR, DR, 2.0, 32, 1, true).translate(0, H + 1.0, DZ)), CREAM);
  k.to('dome').add(flip(new THREE.SphereGeometry(DR, 32, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.85, 1).translate(0, H + 2.0, DZ)), 0xffffff, true);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.39; k.day().quad(Math.sin(a) * (DR - 0.04), H + 1.05, DZ + Math.cos(a) * (DR - 0.04), 1.5, 1.1, a + Math.PI, 0xf2f0e2); }
  brass.add(new THREE.TorusGeometry(DR - 0.05, 0.09, 6, 32).rotateX(Math.PI / 2).translate(0, H + 0.05, DZ), GOLD);
  brass.add(new THREE.TorusGeometry(DR - 0.05, 0.07, 6, 32).rotateX(Math.PI / 2).translate(0, H + 2.0, DZ), GOLD);
  glow.add(new THREE.CircleGeometry(0.7, 16).rotateX(Math.PI / 2).translate(0, H + 2.0 + DR * 0.85 - 0.06, DZ), [0xfff0d0, 2.2]);
  // Wall dressing: dark panelled dado, gilt rails, a cornice.
  const dado = (x0, z0, x1, z1) => { wood.span(x0, 0, z0, x1, 1.15, z1, 0x8a6a48); brass.span(x0 - 0.01, 1.15, z0 - 0.01, x1 + 0.01, 1.2, z1 + 0.01, GOLD); };
  dado(-10, 0, -9.96, 24.4); dado(9.96, 0, 10, 9.3); dado(9.96, 12.7, 10, 24.4); dado(-10, 24.36, 10, 24.4);
  dado(10.4, 3, 22, 3.04); dado(10.4, 18.96, 22, 19); dado(10.4, 3, 10.44, 9.3); dado(10.4, 12.7, 10.44, 19);
  for (const [x0, z0, x1, z1] of [[-10, 0, -9.9, 24.4], [9.9, 0, 10, 24.4], [-10, 0, 10, 0.1], [-10, 24.3, 10, 24.4]]) satin.span(x0, H - 0.3, z0, x1, H, z1, 0xfaf5e8);
  // Beams of the coffered ceiling over the front hall.
  for (const z of [3, 8, 13.2]) satin.span(-10, H - 0.28, z - 0.18, 10, H, z + 0.18, 0xfaf5e8);
  for (const x of [-6.2, 6.2]) satin.span(x - 0.18, H - 0.28, 0, x + 0.18, H, 13.2, 0xfaf5e8);

  // ------------------------------------------------------------------ columns
  const column = (x, z, h, r = 0.36) => {
    satin.cyl(x, 0, z, r + 0.14, 0.34, 0xd9cfba, 12); satin.cyl(x, 0.34, z, r, h - 0.85, 0xe9dfca, 16); brass.cyl(x, h - 0.51, z, r + 0.05, 0.14, GOLD, 12); satin.cyl(x, h - 0.37, z, r + 0.22, 0.37, 0xefe6d2, 12, r + 0.04);
    k.posts.push([x, z, r + 0.14, true]);
  };
  for (const x of [-6.2, 6.2]) for (const z of [3, 8, 13.2]) column(x, z, H);
  for (const x of [-2.5, 2.5]) column(x, 13.4, 4.95, 0.28);

  // ------------------------------------------------------------------ the grand staircase
  const RISE = 2.6 / 16, RUN = 0.3, S0 = 16.5, L0 = S0 + 16 * RUN; // landing starts at L0 = 21.3
  for (let i = 0; i < 16; i++) {
    const z0 = S0 + i * RUN, y = (i + 1) * RISE;
    satin.span(-1.8, 0, z0, 1.8, y, z0 + RUN + 0.01, MARBLE);
    flat.span(-0.95, y, z0 - 0.012, 0.95, y + 0.012, z0 + RUN, RED); flat.span(-0.95, y - RISE, z0 - 0.014, 0.95, y, z0 - 0.002, 0x7a1820);
    for (const s of [-1, 1]) brass.box(s * 0.95, y + 0.012, z0 + 0.03, 0.03, 0.02, 0.03, GOLD); // stair rods
  }
  satin.span(-4.5, 0, L0, 4.5, 2.6, 24.4, MARBLE);
  flat.span(-3.6, 2.6, L0 + 0.35, 3.6, 2.612, 24.0, RED);
  k.ramps.push([-1.8, S0, 1.8, L0, 0, 2.6, 'z'], [-4.5, L0, 4.5, 24.4, 2.6, 2.6, 'z']);
  // The two upper flights double back along the sides, up to the gallery (residents only).
  const RISE2 = 2.6 / 14;
  for (const s of [-1, 1]) {
    for (let j = 0; j < 14; j++) {
      const z1 = L0 - j * RUN, y = 2.6 + (j + 1) * RISE2;
      satin.span(s * 2.4, 0, z1 - RUN - 0.01, s * 4.5, y, z1, MARBLE);
      flat.span(s * 2.95, y, z1 - RUN, s * 3.95, y + 0.012, z1 + 0.012, RED);
    }
    k.solids.push(s > 0 ? [1.82, 17.0, 4.5, L0, true] : [-4.5, 17.0, -1.82, L0, true], s > 0 ? [4.5, L0, 4.72, 24.4, false] : [-4.72, L0, -4.5, 24.4, false]);
    // Velvet rope across the foot of the upper flight.
    for (const x of [2.45, 4.45]) { brass.cyl(s * x, 2.6, L0 + 0.12, 0.035, 0.95, GOLD, 8); brass.ball(s * x, 3.58, L0 + 0.12, 0.06, GOLD); }
    flat.span(s * 2.45, 3.33, L0 + 0.1, s * 4.45, 3.41, L0 + 0.14, RED);
    k.solids.push(s > 0 ? [2.3, L0 - 0.1, 4.5, L0 + 0.3, false] : [-4.5, L0 - 0.1, -2.3, L0 + 0.3, false]);
    // Gallery: along the side wall and across the front of the stair well.
    satin.span(s * 4.5, 4.95, 13.3, s * 10, 5.2, 24.4, MARBLE); satin.span(s * 2.4, 4.95, 13.3, s * 4.5, 5.2, 17.1, MARBLE);
    for (const z of [15.5, 19.5, 22.6]) { wood.span(s * 9.9, 5.2, z - 0.55, s * 9.96, 7.3, z + 0.55, DARKWOOD); brass.box(s * 9.88, 6.2, z + 0.4, 0.03, 0.12, 0.03, GOLD); }
  }
  // Balustrades: brass rail on slim balusters; newel posts with lamp globes at the foot of the stair.
  const rail = (x0, y0, z0, x1, y1, z1, hgt = 0.95) => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 0.34));
    for (let i = 0; i <= n; i++) { const t = i / n; brass.box(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z0 + (z1 - z0) * t, 0.035, hgt, 0.035, GOLD); }
    const g = new THREE.BoxGeometry(0.09, 0.07, Math.hypot(len, y1 - y0) + 0.06);
    g.rotateX(-Math.atan2(y1 - y0, len)).rotateY(Math.atan2(x1 - x0, z1 - z0)).translate((x0 + x1) / 2, (y0 + y1) / 2 + hgt, (z0 + z1) / 2);
    wood.add(g, 0x6a4326);
  };
  for (const s of [-1, 1]) {
    rail(s * 1.82, RISE, S0 + 0.15, s * 1.82, 2.6, L0);                      // central flight
    rail(s * 1.82, 2.6, L0, s * 2.4, 2.6, L0);                                // landing front, beside it
    rail(s * 2.4, 2.6 + RISE2, L0 - 0.15, s * 2.4, 5.2, 17.1);                // upper flight, inner side
    rail(s * 2.4, 5.2, 17.1, s * 2.4, 5.2, 13.35); rail(s * 2.4, 5.2, 13.35, s * 9.9, 5.2, 13.35); // gallery edges
    rail(s * 4.5, 5.2, 21.3, s * 4.5, 5.2, 24.3);
    satin.box(s * 1.82, 0, S0 + 0.02, 0.3, 1.25, 0.3, MARBLE); brass.cyl(s * 1.82, 1.25, S0 + 0.02, 0.03, 0.35, GOLD, 6); glow.ball(s * 1.82, 1.72, S0 + 0.02, 0.15, [0xffe6b8, 3], 1, 10);
    k.posts.push([s * 1.82, S0 + 0.02, 0.24, false]);
    k.solids.push(s > 0 ? [1.74, S0, 1.92, L0, false] : [-1.92, S0, -1.74, L0, false]);
  }

  // ------------------------------------------------------------------ chandeliers
  const frame = new Geo(), crystal = new Geo();
  frame.add(new THREE.CylinderGeometry(0.02, 0.02, 1.6, 5).translate(0, 0.8, 0), GOLD);
  for (const [r, y, n] of [[0.95, 0, 12], [0.55, -0.35, 8]]) {
    frame.add(new THREE.TorusGeometry(r, 0.03, 5, 20).rotateX(Math.PI / 2).translate(0, y, 0), GOLD);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r;
      crystal.add(new THREE.CylinderGeometry(0.022, 0.022, 0.16, 5).translate(x, y + 0.12, z), [0xfff0cc, 4.5]);     // candle lamps
      crystal.add(new THREE.OctahedronGeometry(0.06).scale(1, 1.8, 1).translate(x * 0.94, y - 0.16, z * 0.94), [0xfff7e6, 1.5]); // drops
    }
  }
  crystal.add(new THREE.OctahedronGeometry(0.16).scale(1, 1.6, 1).translate(0, -0.72, 0), [0xfff7e6, 1.7]);
  const hang = [[0, 5.6, 4.6, 0, 1.15], [0, 5.6, 10.6, 0.4, 1.15], [0, 7.6, DZ, 0.2, 2.1], [16.2, 3.8, 7.4, 0, 0.9], [16.2, 3.8, 14.6, 0.5, 0.9]];
  brass.cyl(0, 10.9, DZ, 0.03, 3.2, GOLD, 5); // the long chain of the big one under the dome
  k.instances(frame.merge(), 'brass', hang, { cast: false }); k.instances(crystal.merge(), 'glow', hang, { cast: false });
  k.lamp(0, 5.3, 7.6, 0xffdfb0, 36, 20); k.lamp(0, 6.6, DZ, 0xffe2b8, 44, 22); k.lamp(16.2, 3.5, 11, 0xffdcae, 26, 16); k.lamp(-7.2, 2.8, 7.5, 0xffd9a8, 9, 9);
  k.lamp(0, 5.3, 2.5, 0xffdfb0, 14, 14); k.lamp(16.2, 3.5, 5, 0xffdcae, 10, 12);

  // ------------------------------------------------------------------ way out, and the long red carpet
  const spawn = k.exitDoor(0, 0, { w: 2.4, h: 2.8, frame: 0xb8913a, leaf: 0xb8913a, label: 'E: go out to the street' });
  flat.floor(-1.25, 1.3, 1.25, 16.3, 0.006, 0x9a7a2e); flat.floor(-1.1, 1.45, 1.1, 16.15, 0.009, RED);

  // ------------------------------------------------------------------ reception (the side wall on the right as you come in)
  wood.span(-8.5, 0, 4.4, -7.75, 1.08, 10.6, 0x7a5636); satin.span(-8.6, 1.08, 4.3, -7.65, 1.14, 10.7, MARBLE); brass.span(-7.76, 0.5, 4.4, -7.74, 0.56, 10.6, GOLD);
  k.solids.push([-8.62, 4.3, -7.63, 10.7, false]);
  for (const z of [5.4, 9.6]) { brass.cyl(-8.1, 1.14, z, 0.07, 0.03, GOLD, 8); brass.cyl(-8.1, 1.17, z, 0.012, 0.24, GOLD, 5); glow.cyl(-8.1, 1.4, z, 0.11, 0.14, [0xffdfae, 2.4], 10, 0.07); }
  brass.ball(-7.95, 1.17, 7.5, 0.05, GOLD, 0.7); satin.box(-8.15, 1.14, 7.0, 0.3, 0.03, 0.42, 0x3a2416); // the bell and the register
  // Key rack and the row of world clocks.
  wood.span(-9.94, 1.35, 5.4, -9.84, 2.75, 9.6, 0x6a4a30);
  for (let i = 0; i <= 12; i++) satin.span(-9.84, 1.35, 5.4 + i * 0.35 - 0.012, -9.78, 2.75, 5.4 + i * 0.35 + 0.012, 0x3a2416);
  for (let j = 0; j <= 4; j++) satin.span(-9.84, 1.35 + j * 0.35 - 0.012, 5.4, -9.78, 1.35 + j * 0.35 + 0.012, 9.6, 0x3a2416);
  for (let i = 0; i < 12; i++) for (let j = 0; j < 4; j++) if ((i * 5 + j * 3) % 4) brass.box(-9.8, 1.42 + j * 0.35, 5.575 + i * 0.35, 0.02, 0.12, 0.03, GOLD);
  const A = k.atlas('signs', 2048, 1024);
  const clocks = A.draw(900, 200, (g, w, h) => {
    g.fillStyle = '#23402f'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#c9a24a'; g.lineWidth = 6; g.strokeRect(5, 5, w - 10, h - 10);
    [['MUMBAI', 0], ['LONDON', -5.5], ['NEW YORK', -10.5], ['TOKYO', 3.5]].forEach(([city, off], i) => {
      const cx = 115 + i * 223, cy = 84, t = 10.2 + off;
      g.fillStyle = '#f7f2e2'; g.beginPath(); g.arc(cx, cy, 58, 0, 7); g.fill(); g.strokeStyle = '#c9a24a'; g.lineWidth = 6; g.stroke();
      g.strokeStyle = '#222'; g.lineWidth = 5; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.sin(t / 12 * 6.283) * 28, cy - Math.cos(t / 12 * 6.283) * 28); g.stroke();
      g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.sin(t * 6.283) * 44, cy - Math.cos(t * 6.283) * 44); g.stroke();
      g.fillStyle = '#e9d9a8'; g.textAlign = 'center'; g.font = font(26, 700); g.fillText(city, cx, 180);
    });
  });
  k.to('signs').quad(-9.83, 3.5, 7.5, 4.2, 0.93, Math.PI / 2, undefined, clocks);
  const plate = (text, sub, w = 640, h = 150) => A.draw(w, h, (g) => {
    g.fillStyle = '#23402f'; g.fillRect(0, 0, w, h); g.strokeStyle = '#c9a24a'; g.lineWidth = 6; g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = '#e8c874'; g.textAlign = 'center'; g.font = font(sub ? 58 : 70, 800, '"Rozha One", "Baloo 2", serif'); g.fillText(text, w / 2, sub ? 70 : 98, w - 40);
    if (sub) { g.font = font(40, 600); g.fillText(sub, w / 2, 124, w - 40); }
  });
  k.to('signs').quad(-9.83, 4.55, 7.5, 2.6, 0.6, Math.PI / 2, undefined, plate('RECEPTION', 'स्वागत कक्ष'));
  k.to('signs').quad(9.97, 5.5, 11, 3.2, 0.75, -Math.PI / 2, undefined, plate('SEA LOUNGE', 'सी लाउंज · High tea 3 – 6'));
  k.to('signs').quad(0, 3.75, 24.37, 3.0, 0.7, Math.PI, undefined, plate('ROYAL CHAJ MAHAL PALACE', 'est. 1903 · Bombay'));
  // Paintings in gilt frames (landscapes and still lifes; nobody's portrait).
  const painting = (kind) => A.draw(300, 220, (g, w, h) => {
    if (kind === 0) { const s = g.createLinearGradient(0, 0, 0, h); s.addColorStop(0, '#e8b77a'); s.addColorStop(0.55, '#f0d9a8'); s.addColorStop(0.56, '#3f6f7c'); s.addColorStop(1, '#1f4250'); g.fillStyle = s; g.fillRect(0, 0, w, h); g.fillStyle = '#2a2a2a'; g.fillRect(150, 96, 60, 10); g.fillStyle = '#f4efe0'; g.beginPath(); g.moveTo(178, 96); g.lineTo(178, 40); g.lineTo(206, 96); g.fill(); }
    else if (kind === 1) { g.fillStyle = '#5f7f5a'; g.fillRect(0, 0, w, h); g.fillStyle = '#c9d6c0'; g.fillRect(0, 0, w, 90); for (let i = 0; i < 9; i++) { g.fillStyle = ['#2f5a31', '#3f7040', '#7a5a34'][i % 3]; g.beginPath(); g.arc(20 + i * 34, 96 + (i % 3) * 14, 34, 0, 7); g.fill(); } g.fillStyle = '#d9c9a0'; g.fillRect(0, 170, w, 50); }
    else if (kind === 2) { g.fillStyle = '#3a2a22'; g.fillRect(0, 0, w, h); g.fillStyle = '#8a5a34'; g.fillRect(0, 150, w, 70); for (const [x, y, r, c] of [[110, 120, 34, '#c0392b'], [170, 128, 28, '#e0a030'], [140, 86, 26, '#d96a2b'], [205, 100, 20, '#7a9a3a']]) { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } g.fillStyle = '#b8913a'; g.fillRect(100, 150, 110, 14); }
    else { g.fillStyle = '#d9c7a2'; g.fillRect(0, 0, w, h); g.fillStyle = '#b89a6a'; g.fillRect(0, 150, w, 70); g.fillStyle = '#8a6a44'; g.fillRect(60, 60, 180, 90); g.fillStyle = '#6a4a30'; g.beginPath(); g.arc(150, 60, 46, Math.PI, 0); g.fill(); for (let i = 0; i < 5; i++) { g.fillStyle = '#3a2a1c'; g.fillRect(76 + i * 34, 96, 16, 54); } }
    g.strokeStyle = '#b8913a'; g.lineWidth = 18; g.strokeRect(0, 0, w, h); g.strokeStyle = '#7a5a1e'; g.lineWidth = 3; g.strokeRect(12, 12, w - 24, h - 24);
  });
  const P = [painting(0), painting(1), painting(2), painting(3)];
  [[-9.83, 2.7, 2.4, Math.PI / 2, 0], [-9.83, 2.7, 18.6, Math.PI / 2, 1], [-9.83, 2.7, 21.9, Math.PI / 2, 3], [9.97, 2.7, 3.4, -Math.PI / 2, 2], [9.97, 2.7, 6.6, -Math.PI / 2, 1], [9.97, 2.7, 16, -Math.PI / 2, 0], [9.97, 2.7, 20, -Math.PI / 2, 3],
    [-6, 3.6, 24.37, Math.PI, 2], [6, 3.6, 24.37, Math.PI, 0], [13, 2.6, 3.07, 0, 3], [17, 2.6, 3.07, 0, 0]].forEach(([x, y, z, ry, i]) => k.to('signs').quad(x, y, z, 1.5, 1.1, ry, undefined, P[i]));
  // Lifts beyond the desk: brass doors, an arrow lit above each.
  for (const z of [13.6, 15.6]) { brass.span(-9.95, 0, z - 0.6, -9.9, 2.3, z + 0.6, 0xb89a4a); satin.span(-9.92, 0, z - 0.01, -9.88, 2.3, z + 0.01, 0x5a4a1e); glow.box(-9.9, 2.45, z, 0.02, 0.1, 0.16, [0xffb060, 2.5]); }

  // ------------------------------------------------------------------ flowers under the first chandelier, palms, luggage trolley
  satin.cyl(0, 0, 8.3, 0.25, 0.72, 0x3a2416, 10, 0.12); satin.cyl(0, 0.72, 8.3, 0.85, 0.05, MARBLE, 20); brass.cyl(0, 0.77, 8.3, 0.16, 0.34, GOLD, 12, 0.24);
  for (let i = 0; i < 46; i++) { const a = i * 2.4, r = 0.06 + (i % 6) * 0.075, y = 1.13 + ((i * 7) % 11) * 0.06 - (i % 6) * 0.03; flat.ball(Math.cos(a) * r * 0.9, y, 8.3 + Math.sin(a) * r * 0.9, 0.08 + (i % 3) * 0.02, [0xe7e2d2, 0xd9486a, 0xf2a03c, 0x3f8a46, 0xf4d6dc, 0x2f6b34][i % 6], 1, 7); }
  k.posts.push([0, 8.3, 0.9, false]);
  const palm = (x, z) => {
    brass.cyl(x, 0, z, 0.2, 0.46, GOLD, 10, 0.28); satin.cyl(x, 0.46, z, 0.05, 1.0, 0x6b4a2e, 6);
    for (let i = 0; i < 7; i++) { const a = i * 0.9; flat.add(new THREE.SphereGeometry(0.5, 6, 4).scale(1, 0.12, 0.3).rotateZ(0.5).rotateY(a).translate(x + Math.cos(a) * 0.36, 1.6 + (i % 2) * 0.12, z - Math.sin(a) * 0.36), i % 2 ? 0x2f6b34 : 0x3d8442); }
    k.posts.push([x, z, 0.3, false]);
  };
  palm(-9.2, 1.0); palm(9.2, 1.0); palm(-9.2, 11.6); palm(9.2, 13.6); palm(11.2, 3.8); palm(21.2, 18.3);
  brass.span(-6.3, 0.16, 11.2, -5.1, 0.2, 11.9, GOLD); for (const [x, z] of [[-6.3, 11.2], [-5.1, 11.2], [-6.3, 11.9], [-5.1, 11.9]]) { brass.cyl(x, 0.2, z, 0.018, 1.5, GOLD, 5); satin.cyl(x, 0, z, 0.05, 0.1, 0x1c1c1c, 6); }
  brass.add(new THREE.TorusGeometry(0.35, 0.018, 5, 12, Math.PI).rotateY(Math.PI / 2).translate(-6.3, 1.7, 11.55), GOLD); brass.add(new THREE.TorusGeometry(0.35, 0.018, 5, 12, Math.PI).rotateY(Math.PI / 2).translate(-5.1, 1.7, 11.55), GOLD);
  flat.box(-5.7, 0.2, 11.55, 0.9, 0.3, 0.55, 0x6a3a22); flat.box(-5.75, 0.5, 11.55, 0.75, 0.26, 0.5, 0x2f4a6a); flat.box(-5.65, 0.76, 11.5, 0.5, 0.2, 0.36, 0x7a1f1f);
  k.solids.push([-6.4, 11.1, -5.0, 12.0, false]);

  // ------------------------------------------------------------------ sofas by the front windows
  const sofaG = new Geo(), armG = new Geo();
  const seat = (g, w) => {
    const n = Math.max(1, Math.round(w / 0.7)), cw = (w - 0.36) / n;
    g.box(0, 0.1, 0, w, 0.32, 0.8, 0x7a2a2e); g.box(0, 0.42, -0.32, w, 0.46, 0.18, 0x6d2428);
    for (const s of [-1, 1]) g.box(s * (w / 2 - 0.08), 0.42, 0.04, 0.16, 0.22, 0.72, 0x6d2428);
    for (let i = 0; i < n; i++) g.box(-w / 2 + 0.18 + cw * (i + 0.5), 0.42, 0.06, cw - 0.03, 0.1, 0.6, 0x8c3338);
    for (const [x, z] of [[-w / 2 + 0.08, -0.34], [w / 2 - 0.08, -0.34], [-w / 2 + 0.08, 0.34], [w / 2 - 0.08, 0.34]]) g.box(x, 0, z, 0.06, 0.1, 0.06, 0x2a1a10);
  };
  seat(sofaG, 2.1); seat(armG, 0.95);
  k.instances(sofaG.merge(), 'flat', [[5.8, 0, 3.2, 0], [5.8, 0, 6.6, Math.PI]]);
  k.instances(armG.merge(), 'flat', [[3.9, 0, 4.9, Math.PI / 2], [7.7, 0, 4.9, -Math.PI / 2], [-3.4, 0, 3.0, 0.5], [-4.9, 0, 4.4, 1.2]]);
  k.solids.push([4.7, 2.75, 6.9, 3.65, false], [4.7, 6.15, 6.9, 7.05, false]);
  k.posts.push([3.9, 4.9, 0.5, false], [7.7, 4.9, 0.5, false], [-3.4, 3.0, 0.5, false], [-4.9, 4.4, 0.5, false]);
  flat.floor(3.3, 2.5, 8.3, 7.3, 0.006, 0x23402f); flat.floor(3.6, 2.8, 8.0, 7.0, 0.009, 0x9a7a2e); flat.floor(3.8, 3.0, 7.8, 6.8, 0.012, 0x2c5a44); // rug
  wood.box(5.8, 0.36, 4.9, 1.3, 0.05, 0.7, 0x6a4326); for (const [dx, dz] of [[-0.55, -0.27], [0.55, -0.27], [-0.55, 0.27], [0.55, 0.27]]) satin.box(5.8 + dx, 0, 4.9 + dz, 0.05, 0.36, 0.05, 0x2a1a10);
  brass.cyl(5.6, 0.41, 4.9, 0.1, 0.02, GOLD, 10); flat.ball(5.6, 0.5, 4.9, 0.08, 0xd9486a, 1, 6); flat.box(6.1, 0.41, 4.85, 0.3, 0.02, 0.22, 0xf2efe6, 0.3);
  k.solids.push([5.1, 4.5, 6.5, 5.3, false]);
  wood.box(-4.3, 0.5, 3.4, 0.5, 0.04, 0.5, 0x6a4326, 0.8); satin.cyl(-4.3, 0, 3.4, 0.04, 0.5, 0x2a1a10, 6);

  // ------------------------------------------------------------------ Sea Lounge
  // Windows: slim glazing bars; the harbour beyond.
  for (const u of [1.6, 4.8, 8, 11.2, 14.4]) {
    const z = 3 + u;
    glass.span(22.1, 0.5, z - 1.05, 22.12, 4.35, z + 1.05, 0xd8ecea);
    for (const dz of [-0.35, 0.35]) satin.box(22.08, 0.5, z + dz, 0.04, 3.5, 0.04, 0xfaf5e8);
    for (const y of [1.6, 2.7, 3.3]) satin.box(22.08, y, z, 0.04, 0.04, 2.1, 0xfaf5e8);
    satin.span(21.86, 0.44, z - 1.1, 22.3, 0.5, z + 1.1, MARBLE);
    for (const s of [-1, 1]) flat.box(21.95, 0.4, z + s * 1.22, 0.1, 4.2, 0.3, 0xd9c79a);
  }
  k.view('harbour', new THREE.PlaneGeometry(150, 56).rotateY(-Math.PI / 2).translate(64, 1.6 - 0.55 * 56 + 28, 11), [2048, 768], harbour, harbourLights);
  // Tables in white cloths with a tea stand; upholstered chairs.
  const tableG = new Geo();
  tableG.add(new THREE.CylinderGeometry(0.5, 0.56, 0.74, 16).translate(0, 0.37, 0), 0xf6f3ea);
  tableG.add(new THREE.CylinderGeometry(0.012, 0.012, 0.36, 5).translate(0, 0.92, 0), GOLD);
  for (const [y, r] of [[0.8, 0.17], [0.94, 0.13], [1.08, 0.09]]) tableG.add(new THREE.CylinderGeometry(r, r, 0.012, 10).translate(0, y, 0), 0xfaf8f0);
  for (let i = 0; i < 6; i++) tableG.add(new THREE.SphereGeometry(0.03, 5, 4).translate(Math.cos(i * 1.05) * 0.1, 0.83 + (i % 3) * 0.14, Math.sin(i * 1.05) * (0.1 - (i % 3) * 0.02)), [0xe8b0c0, 0xd9a05a, 0x6b3b1e][i % 3]);
  for (const s of [-1, 1]) { tableG.add(new THREE.CylinderGeometry(0.07, 0.07, 0.008, 10).translate(0.02, 0.746, s * 0.3), 0xfaf8f0); tableG.add(new THREE.CylinderGeometry(0.036, 0.028, 0.055, 8).translate(0.02, 0.775, s * 0.3), 0xfaf8f0); }
  const chairG = new Geo();
  chairG.box(0, 0.4, 0, 0.5, 0.1, 0.5, 0x2c6468); chairG.box(0, 0.5, -0.22, 0.5, 0.5, 0.07, 0x2c6468); for (const [x, z] of [[-0.21, -0.21], [0.21, -0.21], [-0.21, 0.21], [0.21, 0.21]]) chairG.box(x, 0, z, 0.045, 0.4, 0.045, 0x3a2416);
  const tables = [[20.3, 4.6], [20.3, 7.8], [20.3, 11], [20.3, 14.2], [20.3, 17.4], [16.6, 5.4], [16.6, 8.4], [16.6, 13.6], [16.6, 16.6]];
  const chairs = [], lseats = [];
  for (const [x, z] of tables) { k.posts.push([x, z, 0.62, false]); for (const s of [-1, 1]) { chairs.push([x, 0, z + s * 0.86, s > 0 ? Math.PI : 0]); lseats.push([x, z + s * 0.86, s > 0 ? Math.PI : 0]); k.posts.push([x, z + s * 0.86, 0.26, false]); } }
  k.instances(tableG.merge(), 'satin', tables.map(([x, z]) => [x, 0, z, 0]));
  k.instances(chairG.merge(), 'flat', chairs);
  brass.box(20.3, 0.745, 7.55, 0.14, 0.09, 0.02, GOLD, 0.3); // "Reserved"
  // Grand piano, and the pianist's bench.
  gloss.add(new THREE.CylinderGeometry(0.9, 0.9, 0.3, 14, 1, false, 0, Math.PI).rotateY(Math.PI / 2).scale(1, 1, 1.25).translate(12.6, 0.85, 16.3), 0x0e0e10);
  gloss.box(12.6, 0.7, 15.55, 1.5, 0.3, 0.5, 0x0e0e10); gloss.add(new THREE.BoxGeometry(1.5, 0.03, 1.5).rotateZ(0.5).translate(12.95, 1.38, 16.4), 0x0e0e10);
  satin.box(12.6, 0.86, 15.36, 1.3, 0.03, 0.16, 0xf6f3ea); for (let i = 0; i < 9; i++) satin.box(12.06 + i * 0.135, 0.89, 15.33, 0.05, 0.02, 0.1, 0x111111);
  for (const [x, z] of [[12.0, 15.5], [13.2, 15.5], [12.6, 17.0]]) gloss.cyl(x, 0, z, 0.05, 0.7, 0x0e0e10, 8);
  flat.box(12.6, 0.4, 14.85, 0.8, 0.08, 0.34, 0x5a1d24); for (const x of [12.25, 12.95]) satin.box(x, 0, 14.85, 0.05, 0.4, 0.3, 0x0e0e10);
  k.solids.push([11.7, 14.6, 13.6, 17.6, false]);
  // The patisserie table along the end wall.
  flat.span(14, 0, 18.1, 19, 0.78, 18.9, 0xf6f3ea); k.solids.push([13.9, 18.0, 19.1, 19, false]);
  for (let i = 0; i < 5; i++) { const x = 14.5 + i; brass.cyl(x, 0.78, 18.5, 0.02, 0.3, GOLD, 5); for (const [y, r] of [[0.84, 0.2], [0.98, 0.15], [1.1, 0.1]]) satin.cyl(x, y, 18.5, r, 0.012, 0xfaf8f0, 10); for (let j = 0; j < 5; j++) flat.ball(x + Math.cos(j * 1.3) * 0.12, 0.88 + (j % 2) * 0.14, 18.5 + Math.sin(j * 1.3) * 0.1, 0.035, [0xe8b0c0, 0xd9a05a, 0x6b3b1e, 0xf4e2b0][j % 4], 1, 5); }
  brass.cyl(14.05, 0.78, 18.45, 0.13, 0.4, GOLD, 10, 0.09); brass.cyl(18.95, 0.78, 18.45, 0.13, 0.4, GOLD, 10, 0.09); // tea urns

  // ------------------------------------------------------------------ people
  const turban = hex(0xb3261e);
  const doorman = k.add(person('office', 2.0, 1.5, Math.PI * 0.85, POSE.STAND, { shirt: hex(0xf4f1e8), pants: hex(0xf4f1e8), flags: FLAG.BERET, hatColor: turban, build: 'muscular', scale: 1.04, wear: ['suit', 'casual2'] }));
  const desk = [k.add(person('sari', -9.1, 6.2, Math.PI / 2, POSE.STAND, { wear: ['suit', 'casual2'], shirt: hex(0x7a1f3a), pants: hex(0xb3264a) })), k.add(person('office', -9.1, 8.9, Math.PI / 2, POSE.STAND, { shirt: hex(0x1f2a44), pants: hex(0x1f2a44), wear: ['suit', 'casual'] }))];
  k.add(person('office', -7.1, 8.8, -Math.PI / 2, POSE.STAND, { wear: ['oldclassy', 'casual3'] }));
  const bellboy = k.add(person('office', -5.7, 12.5, Math.PI, POSE.STAND, { shirt: hex(0x7a1f1f), pants: hex(0x1c1c1c), flags: FLAG.CAP, wear: ['casual', 'casual2'] }));
  const sat = (x, z, ry, kind, extra) => k.add(person(kind, x, z, ry, POSE.SIT, { y: 0.1, ...extra })); // sofa seats are 52 cm up
  const loungers = [sat(5.3, 3.25, 0, 'office', { wear: ['suit', 'oldclassy'] }), sat(6.3, 3.25, 0, 'sari', { wear: ['oldclassy', 'suit'] }), sat(5.9, 6.55, Math.PI, 'casual'), sat(3.95, 4.9, Math.PI / 2, 'office', { wear: ['oldclassy'] })];
  const diners = [0, 1, 4, 5, 8, 9, 10, 13, 14, 16, 17].map((i, n) => sat(lseats[i][0], lseats[i][1], lseats[i][2], ['office', 'sari', 'casual', 'sari', 'office', 'kid'][n % 6], { y: 0.08, wear: n % 2 ? ['suit', 'oldclassy'] : undefined }));
  const pianist = sat(12.6, 14.85, 0, 'office', { y: 0.06, shirt: hex(0x16161a), pants: hex(0x16161a), wear: ['suit', 'oldclassy'] });
  const waiterLook = { shirt: hex(0xf6f4ee), pants: hex(0x15151a), wear: ['suit', 'casual2', 'casual'] };
  const steward = k.add(person('office', 15.2, 17.4, Math.PI, POSE.STAND, waiterLook));
  // Walkers: two guests strolling the lobby, a waiter doing rounds of the lounge.
  const stroll = (p, route, speed) => { let leg = 0, rest = 0; p.speed = speed; return (dt, a) => {
    if (rest > 0) { rest -= dt; p.pose = POSE.STAND; return; }
    const [tx, tz] = route[leg], dx = tx - p.lx, dz = tz - p.lz, d = Math.hypot(dx, dz);
    if (d < 0.2) { leg = (leg + 1) % route.length; if (Math.random() < 0.35) rest = 1.5 + Math.random() * 4; return; }
    if (Math.hypot(a.me.x - p.lx, a.me.z - p.lz) < 0.9) { p.pose = POSE.STAND; return; }
    p.lx += (dx / d) * speed * dt; p.lz += (dz / d) * speed * dt; p.heading = Math.atan2(dx, dz); p.phase += dt * speed * 4.3; p.pose = POSE.WALK;
  }; };
  const g1 = k.add(person('sari', -3, 6, 0, POSE.WALK, { wear: ['oldclassy', 'suit'] })), g2 = k.add(person('office', 3, 12, 0, POSE.WALK, { wear: ['suit', 'oldclassy', 'casual3'] }));
  const waiter = k.add(person('office', 18.4, 6.5, 0, POSE.WALK, waiterLook));
  k.ticks.push(stroll(g1, [[-3, 2.4], [-3, 14.5], [-8.6, 15], [-8.6, 12.3], [-3.6, 12], [-3, 6]], 1.0), stroll(g2, [[3, 14.8], [8.4, 15], [8.4, 9], [3.2, 8.6], [2.6, 2.2], [8.6, 1.8], [8.8, 8.2], [3, 9]], 1.15),
    stroll(waiter, [[18.4, 5], [18.4, 17.2], [15, 17.3], [14.4, 11], [12.2, 11], [14.4, 9.4], [18.4, 9.6]], 1.2));
  // The doorman's welcome (with a word about the footwear), and lobby murmur.
  let stage = 0, sayT = 5, teaT = 0;
  k.ticks.push((dt, a) => {
    for (const p of [...loungers, ...diners, pianist]) p.phase += dt;
    doorman.heading = Math.atan2(a.me.x - doorman.lx, a.me.z - doorman.lz);
    if (stage === 0 && a.sinceEnter > 0.9) { stage = 1; doorman.pose = POSE.WAVE; a.say(doorman, 'Welcome to the Royal Chaj Mahal Palace, sir!', 3.2); }
    if (stage === 1 && a.sinceEnter > 4.6) { stage = 2; doorman.pose = POSE.STAND; a.say(doorman, 'Chappals, sir? …No problem. We shall call them open-toe loafers.', 4.2); }
    doorman.phase += dt * 3;
    teaT = Math.max(0, teaT - dt);
    sayT -= dt;
    if (sayT > 0) return;
    sayT = 8 + Math.random() * 9;
    const near = (p) => Math.hypot(a.me.x - p.lx, a.me.z - p.lz);
    const who = [desk[0], desk[1], bellboy, steward, waiter, ...loungers, ...diners].filter((p) => near(p) < 6).sort((p, q) => near(p) - near(q))[0];
    if (!who) return;
    const lines = who === bellboy ? ['Luggage, sir? …Only a taxi meter? Very good, sir.', 'Lift is that side, sir. Residents only.']
      : desk.includes(who) ? ['Good day! A room with the harbour view starts at ₹38,000, sir.', 'Checking in, sir? …Just looking. Of course.', 'The Sea Lounge is serving high tea.']
      : who === steward || who === waiter ? ['High tea is served at the window tables, sir.', 'One masala chai, in bone china. Coming, sir.', 'The scones are warm, sir.']
      : ['The view never gets old.', 'Is that a taxi driver? How charming.', 'They say the building faces the wrong way. Nonsense!', 'Two sugars. No — three.', 'This sandwich has no crust. Where did it go?'];
    a.say(who, lines[Math.floor(Math.random() * lines.length)], 3);
  });

  // ------------------------------------------------------------------ things to do
  k.spot(20.3, 7.8, 2.0, (a) => (teaT > 0 ? 'A proper high tea. Pinky finger out.' : 'E: high tea at the reserved window table (₹450)'), (a) => {
    if (teaT > 0) return;
    if (!a.buy(450, 'High tea, Sea Lounge')) { a.say(steward, 'Perhaps just a glass of water, sir? That is complimentary.', 3.5); return; }
    teaT = 20;
    a.state.eat(0.7); a.state.rest(0.4);
    a.say(waiter, 'Your high tea, sir: finger sandwiches, scones, and masala chai.', 3.5);
    a.msg('High tea — ₹450. Three tiers of tiny food and a harbour view. Food and energy up.');
  });
  k.spot(-7.3, 7.5, 1.3, 'E: ring the bell at reception', (a) => { a.tone([2093, 2093], 0.09, 0.1); a.say(desk[0], ['Yes, sir? Rooms from ₹38,000 a night. Breakfast included!', 'The taxi stand is outside, sir. Oh — you ARE the taxi.', 'Do you have a reservation, sir? …In this life?'][Math.floor(Math.random() * 3)], 3.5); });
  k.spot(0, 23, 1.8, 'The gallery above is for residents. The view down the staircase is free.', () => {});

  return {
    spawn,
    ambient: [0xfff7ec, 0xd8cdb8, 1.7], key: [0.12, 1, -0.1, 1.25, 0xfff6ea], env: 0.6, exposure: 0.95,
    sound: [0.015, 0.05, 0],
  };
}
