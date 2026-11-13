import * as THREE from 'three';
import { Geo, flip, canvasTexture, font } from './kit.js';

// Home: flat 1204, Lake Breeze Tower B, Powai — one bedroom, hall, kitchen, and a balcony
// twelve floors above the lake. E at the bed sleeps till 7 am, E at the steel almirah
// opens the wardrobe (the Ghar app), and the balcony is there for the view.

const H = 2.85;

/** The lake from the twelfth floor: haze, hills, far towers, water, the lakeside road below. */
function lakeView(g, w, h) {
  const hz = h * 0.4;
  const sky = g.createLinearGradient(0, 0, 0, hz);
  sky.addColorStop(0, '#7fa6cf'); sky.addColorStop(0.7, '#c4d3dc'); sky.addColorStop(1, '#e3ddcc');
  g.fillStyle = sky; g.fillRect(0, 0, w, hz + 2);
  // Hills of the national park behind the far shore.
  g.fillStyle = '#8fa392';
  g.beginPath(); g.moveTo(0, hz);
  for (let x = 0; x <= w; x += 16) g.lineTo(x, hz - 16 - 14 * Math.sin(x * 0.006) - 9 * Math.sin(x * 0.017 + 1) - 5 * Math.sin(x * 0.041));
  g.lineTo(w, hz); g.fill();
  // Far shore: trees and clusters of towers.
  g.fillStyle = '#5f7a5c'; g.fillRect(0, hz - 7, w, 9);
  for (let i = 0; i < 70; i++) {
    const x = (i * 131 + (i % 7) * 57) % w, th = 8 + ((i * 53) % 26), tw = 7 + (i % 4) * 2;
    if ((x > w * 0.36 && x < w * 0.5) || (i % 5 === 0)) continue; // a gap of open hillside
    g.fillStyle = ['#d8d2c4', '#c9c3b8', '#b9b6ad', '#e3d9c6'][i % 4]; g.fillRect(x, hz - 4 - th, tw, th);
  }
  // The lake.
  const lake = g.createLinearGradient(0, hz, 0, h * 0.78);
  lake.addColorStop(0, '#9fb4b6'); lake.addColorStop(1, '#5c7f84');
  g.fillStyle = lake; g.fillRect(0, hz + 2, w, h * 0.78 - hz);
  g.strokeStyle = 'rgba(235,240,236,0.35)'; g.lineWidth = 1;
  for (let i = 0; i < 260; i++) { const y = hz + 6 + ((i * 37) % (h * 0.36)), x = (i * 211) % w, l = 10 + (i % 9) * 6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y); g.stroke(); }
  // Somebody long and dark is sunning himself by the near bank (Powai's crocodiles are real).
  g.fillStyle = '#2f3a2c'; g.beginPath(); g.ellipse(w * 0.57, h * 0.765, 9, 2.2, 0, 0, 7); g.fill(); g.fillRect(w * 0.57 + 7, h * 0.763, 7, 1.6);
  // Near bank: trees, the promenade, the lakeside road with traffic, roofs.
  g.fillStyle = '#3f6b3c'; g.fillRect(0, h * 0.78, w, h * 0.06);
  for (let i = 0; i < 240; i++) { g.fillStyle = ['#2f5a31', '#3f7040', '#4b7a3e', '#2a4f2c'][i % 4]; g.beginPath(); g.arc((i * 97) % w, h * 0.78 + ((i * 13) % 22), 7 + (i % 5) * 2, 0, 7); g.fill(); }
  g.fillStyle = '#8f8a80'; g.fillRect(0, h * 0.845, w, h * 0.012);
  g.fillStyle = '#4c4c50'; g.fillRect(0, h * 0.86, w, h * 0.05);
  g.fillStyle = '#e8e4d8'; for (let x = 0; x < w; x += 26) g.fillRect(x, h * 0.884, 12, 1.5);
  for (let i = 0; i < 60; i++) { g.fillStyle = ['#f2f2f0', '#c0392b', '#f4c20d', '#2b2b2b', '#2e86c1', '#bdc3c7'][i % 6]; g.fillRect((i * 173) % w, h * (i % 2 ? 0.867 : 0.892), 9, 4); }
  g.fillStyle = '#3a6a38'; g.fillRect(0, h * 0.91, w, h * 0.09);
  for (let i = 0; i < 90; i++) { g.fillStyle = ['#b9b2a6', '#a59d90', '#8f6f5a', '#3f7040', '#2f5a31'][i % 5]; g.fillRect((i * 149) % w, h * 0.915 + ((i * 29) % (h * 0.07)), 14 + (i % 4) * 8, 9 + (i % 3) * 4); }
}

/** The same view after dark: lit windows across the water, road lamps, reflections. */
function lakeLights(g, w, h) {
  const hz = h * 0.4;
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 420; i++) {
    const x = (i * 131 + (i % 7) * 57) % w, y = hz - 6 - ((i * 53) % 30);
    if (x > w * 0.36 && x < w * 0.5) continue;
    g.fillStyle = ['#ffd58a', '#fff0c8', '#ffb45e', '#cfe6ff'][i % 4]; g.fillRect(x, y, 2, 2);
    g.fillStyle = 'rgba(255,200,120,0.12)'; g.fillRect(x, hz + 4, 2, 10 + (i % 5) * 6);
  }
  for (let x = 0; x < w; x += 22) { g.fillStyle = '#ffb060'; g.beginPath(); g.arc(x, h * 0.855, 2.2, 0, 7); g.fill(); g.fillStyle = 'rgba(255,170,90,0.2)'; g.beginPath(); g.arc(x, h * 0.87, 8, 0, 7); g.fill(); }
  for (let i = 0; i < 40; i++) { g.fillStyle = i % 2 ? '#fff3d0' : '#ff5a4a'; g.fillRect((i * 173) % w, h * (i % 2 ? 0.869 : 0.894), 3, 2); }
  for (let i = 0; i < 80; i++) { g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect((i * 389) % w, (i * 71) % (hz * 0.8), 1.5, 1.5); }
  g.fillStyle = '#e8ecf4'; g.beginPath(); g.arc(w * 0.68, hz * 0.3, 11, 0, 7); g.fill();
}

export function buildFlat(k, api) {
  // Vitrified floor tiles, 60 cm.
  k.painted('floor', 1.2, 256, (g) => {
    g.fillStyle = '#d9cfbc'; g.fillRect(0, 0, 256, 256);
    for (let n = 0; n < 900; n++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,250,240' : '150,135,110'},${Math.random() * 0.1})`; g.fillRect(Math.random() * 256, Math.random() * 256, 3 + Math.random() * 12, 1 + Math.random() * 3); }
    g.strokeStyle = 'rgba(120,110,95,0.6)'; g.lineWidth = 2;
    for (const v of [0, 128]) { g.beginPath(); g.moveTo(v, 0); g.lineTo(v, 256); g.moveTo(0, v); g.lineTo(256, v); g.stroke(); }
  }, { roughness: 0.28 });
  // White glazed kitchen tiles, 15 cm.
  k.painted('tiles', 0.6, 128, (g) => {
    g.fillStyle = '#f1f0ea'; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = '#b9b6ac'; g.lineWidth = 2;
    for (let v = 0; v <= 128; v += 32) { g.beginPath(); g.moveTo(v, 0); g.lineTo(v, 128); g.moveTo(0, v); g.lineTo(128, v); g.stroke(); }
  }, { roughness: 0.2 });
  const WALL = 0xf0e6d2, DOOR = 0x9a7550, STEEL = 0x9aa7a0;
  const plaster = k.to('paint'), floor = k.to('floor'), wood = k.to('wood'), flat = k.to('flat'), satin = k.to('satin'), gloss = k.to('gloss');
  const steel = k.to('steel'), glass = k.to('glass'), glow = k.to('glow'), brass = k.to('brass'), tiles = k.to('tiles');

  // ---- shell: hall, kitchen (east), bedroom (west), balcony (north)
  k.rooms.push([-2.6, 0, 2.6, 6.4, H], [2.8, 0, 5.2, 3.2, H], [-6.5, 1.8, -2.8, 6.4, H], [-2.6, 6.7, 2.6, 7.9, H]);
  k.rooms.push([1.8, 0.6, 3.6, 2.8, 2.3], [-3.6, 2.97, -1.8, 4.03, 2.1], [0.15, 5.6, 1.75, 7.5, 2.3]); // doorways
  floor.floor(-2.8, 0, 2.8, 6.7, 0); floor.floor(2.8, 0, 5.2, 3.2, 0); floor.floor(-6.5, 1.8, -2.8, 6.4, 0);
  floor.floor(-2.6, 6.7, 2.6, 7.95, 0, 0xb9b2a4);
  plaster.ceiling(-2.6, 0, 2.6, 6.4, H, 0xf6f4ee); plaster.ceiling(2.6, 0, 5.2, 3.2, H, 0xf6f4ee); plaster.ceiling(-6.5, 1.8, -2.6, 6.4, H, 0xf6f4ee);
  plaster.ceiling(-2.6, 6.4, 2.6, 7.95, H, 0xe6e2d8);
  plaster.wall(-2.9, -0.15, 5.5, -0.15, 0, H, 0.3, [[2.28, 3.52, 0, 2.22]], WALL);                         // south (front door)
  plaster.wall(-2.7, 0, -2.7, 6.4, 0, H, 0.2, [[0.5, 1.35, 0, 2.1], [2.95, 4.05, 0, 2.1]], WALL);     // hall | bath, bedroom
  plaster.wall(2.7, 0, 2.7, 6.4, 0, H, 0.2, [[0.5, 2.9, 0, 2.3]], WALL);                              // hall | kitchen
  plaster.wall(2.6, 3.3, 5.5, 3.3, 0, H, 0.2, [], WALL);                                             // kitchen north
  plaster.wall(5.35, -0.3, 5.35, 3.4, 0, H, 0.3, [[1.3, 2.6, 1.25, 2.1]], WALL);                      // kitchen east (window)
  plaster.wall(-2.9, 6.55, 2.9, 6.55, 0, H, 0.3, [[1.0, 4.8, 0, 2.3]], WALL);                         // hall north (sliding door)
  plaster.wall(-6.8, 1.7, -2.8, 1.7, 0, H, 0.2, [], WALL);                                           // bedroom south
  plaster.wall(-6.65, 1.6, -6.65, 6.7, 0, H, 0.3, [], WALL);                                         // bedroom west
  plaster.wall(-6.8, 6.55, -2.8, 6.55, 0, H, 0.3, [[0.9, 3.1, 0.9, 2.2]], WALL);                      // bedroom north (window)
  // Balcony: side walls, a slab edge and a steel-and-glass railing.
  plaster.wall(-2.75, 6.7, -2.75, 8.0, 0, H, 0.3, [], 0xe6dfd0); plaster.wall(2.75, 6.7, 2.75, 8.0, 0, H, 0.3, [], 0xe6dfd0);
  glass.span(-2.6, 0.12, 7.92, 2.6, 1.05, 7.95, 0xcfe4e0);
  steel.span(-2.6, 1.05, 7.9, 2.6, 1.1, 7.97, STEEL); steel.span(-2.6, 0, 7.9, 2.6, 0.12, 7.97, 0xd8d4cc);
  for (let x = -2.6; x <= 2.61; x += 1.3) steel.box(x, 0, 7.935, 0.05, 1.08, 0.05, STEEL);
  // The lake, on a half-cylinder 45 m out, and tree tops far below.
  const R = 45;
  const cyl = flip(new THREE.CylinderGeometry(R, R, 70, 40, 1, true, -Math.PI / 2, Math.PI).translate(0, -5.3, 7));
  { const uv = cyl.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i)); }
  k.view('lake', cyl, [2048, 512], lakeView, lakeLights);
  k.view('ground', new THREE.CircleGeometry(R, 24, 0, Math.PI).rotateX(-Math.PI / 2).rotateY(Math.PI).translate(0, -40.2, 7), [8, 8], (g) => { g.fillStyle = '#35603a'; g.fillRect(0, 0, 8, 8); });

  // ---- doors and windows
  const spawn = k.exitDoor(0, 0, { w: 1.0, h: 2.1, frame: 0x6a4a30, leaf: DOOR, label: 'E: go down to the street' });
  // (The front door is a solid flush door, so cover the glazing with a panel.)
  wood.span(-0.5, 0, -0.1, 0.5, 2.1, -0.04, 0xb08a60);
  brass.box(0.38, 1.0, -0.03, 0.04, 0.14, 0.05, 0xc9a24a);
  wood.span(-2.72, 0, 0.5, -2.66, 2.1, 1.35, 0xb08a60); brass.box(-2.63, 1.0, 1.25, 0.05, 0.12, 0.04, 0xc9a24a);   // bathroom door, shut
  wood.span(-2.86, 0, 4.08, -2.8, 2.1, 5.15, 0xb08a60);                                                           // bedroom door, open against the wall
  // Sliding balcony door: one pane shut, one slid open; sheer curtains pushed aside.
  steel.span(-1.9, 2.26, 6.48, 1.9, 2.3, 6.62, STEEL); steel.span(-1.9, 0, 6.5, -1.86, 2.3, 6.6, STEEL); steel.span(1.86, 0, 6.5, 1.9, 2.3, 6.6, STEEL); steel.span(-0.03, 0, 6.5, 0.03, 2.3, 6.56, STEEL);
  glass.span(-1.86, 0.03, 6.52, 0.0, 2.26, 6.54, 0xcfe4e0); glass.span(-1.8, 0.03, 6.57, 0.06, 2.26, 6.59, 0xcfe4e0);
  for (const x of [-2.25, 2.25]) flat.box(x, 0.05, 6.33, 0.5, 2.4, 0.08, 0xe9e2cf);
  satin.span(-2.5, 2.46, 6.3, 2.5, 2.5, 6.36, 0x6a4a30);
  // Bedroom window: grille and glass; kitchen window: frosted.
  glass.span(-5.9, 0.9, 6.5, -3.7, 2.2, 6.52, 0xcfe4e0);
  for (let x = -5.9; x <= -3.69; x += 0.44) steel.box(x, 0.9, 6.6, 0.025, 1.3, 0.025, 0x55606a);
  satin.span(-5.95, 0.84, 6.38, -3.65, 0.9, 6.5, 0xe9e4d8);
  flat.box(-6.1, 0.3, 6.33, 0.4, 2.1, 0.08, 0x8fa9b8); flat.box(-3.5, 0.3, 6.33, 0.4, 2.1, 0.08, 0x8fa9b8); satin.span(-6.4, 2.4, 6.3, -3.2, 2.44, 6.36, 0x6a4a30);
  k.day().quad(5.3, 1.675, 1.65, 1.3, 0.85, -Math.PI / 2, 0xe6ece8);

  // ---- hall: sofa and TV, coffee table, dining table, shoe rack
  const sofa = (x, z) => {
    flat.box(x, 0.12, z, 0.85, 0.3, 2.0, 0x4a7a86); flat.box(x - 0.34, 0.42, z, 0.2, 0.42, 2.0, 0x437079);
    for (const dz of [-0.92, 0.92]) flat.box(x, 0.3, z + dz, 0.85, 0.32, 0.18, 0x437079);
    for (const dz of [-0.6, 0, 0.6]) flat.box(x + 0.06, 0.42, z + dz, 0.6, 0.1, 0.56, 0x5b8c98);
    flat.box(x - 0.18, 0.52, z - 0.62, 0.14, 0.36, 0.4, 0xe0a030, 0.2); flat.box(x - 0.18, 0.52, z + 0.6, 0.14, 0.36, 0.4, 0xb8402f, -0.15);
    k.solids.push([x - 0.45, z - 1.02, x + 0.45, z + 1.02, false]);
  };
  sofa(-2.12, 5.25);
  flat.floor(-1.5, 4.2, 1.3, 6.2, 0.006, 0x8c3b2e); flat.floor(-1.35, 4.35, 1.15, 6.05, 0.008, 0xd9c7a0); flat.floor(-1.15, 4.55, 0.95, 5.85, 0.01, 0x8c3b2e); // rug
  wood.box(-0.3, 0.32, 5.25, 0.55, 0.05, 1.0, 0xb89468); for (const [dx, dz] of [[-0.22, -0.42], [0.22, -0.42], [-0.22, 0.42], [0.22, 0.42]]) satin.box(-0.3 + dx, 0, 5.25 + dz, 0.04, 0.32, 0.04, 0x3a2a1c);
  k.solids.push([-0.6, 4.72, 0, 5.78, false]);
  flat.box(-0.3, 0.37, 5.05, 0.2, 0.012, 0.28, 0xf2efe8, 0.3); satin.cyl(-0.28, 0.37, 5.55, 0.04, 0.09, 0xd8d8d4, 8); // newspaper, steel tumbler
  // TV unit and the telly (cricket is on).
  wood.box(2.36, 0, 5.2, 0.42, 0.45, 1.7, 0x8a6a48); k.solids.push([2.1, 4.3, 2.6, 6.1, false]);
  gloss.box(2.44, 0.62, 5.2, 0.05, 0.74, 1.24, 0x101114); satin.box(2.4, 0.45, 5.2, 0.2, 0.17, 0.3, 0x18191c);
  const S = k.atlas('screens', 512, 512, true);
  const tv = S.draw(480, 280, (g, w, h) => {
    g.fillStyle = '#2f7a3a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#3d8f48'; for (let i = 0; i < 6; i++) g.fillRect(i * 80, 0, 40, h);
    g.fillStyle = '#d9c9a0'; g.fillRect(w / 2 - 14, 60, 28, 150);
    g.fillStyle = '#fff'; g.fillRect(w / 2 - 20, 76, 40, 2); g.fillRect(w / 2 - 20, 192, 40, 2);
    for (const [x, y, c] of [[w / 2, 84, '#1d4fa0'], [w / 2 + 4, 186, '#f2c200'], [120, 120, '#f2c200'], [360, 90, '#f2c200'], [300, 220, '#f2c200'], [90, 230, '#f2c200']]) { g.fillStyle = c; g.fillRect(x - 3, y - 9, 6, 12); g.fillStyle = '#5b3a22'; g.fillRect(x - 2, y - 13, 4, 4); }
    g.fillStyle = 'rgba(10,20,50,0.88)'; g.fillRect(0, h - 46, w, 46);
    g.fillStyle = '#fff'; g.font = font(24, 700); g.textAlign = 'left'; g.fillText('MUMBAI TIGERS  187/4  (18.2)', 12, h - 16);
    g.fillStyle = '#ffd34d'; g.textAlign = 'right'; g.fillText('need 12 off 10', w - 12, h - 16);
    g.fillStyle = '#d7263d'; g.fillRect(8, 8, 74, 26); g.fillStyle = '#fff'; g.font = font(18, 800); g.textAlign = 'center'; g.fillText('LIVE', 45, 27);
  });
  k.to('screens').quad(2.41, 0.99, 5.2, 1.16, 0.66, -Math.PI / 2, undefined, tv);
  // Tube light over the TV, wall clock, a calendar by the front door.
  glow.box(2.56, 2.32, 5.2, 0.05, 0.05, 1.2, [0xf2f6ff, 2.6]); satin.box(2.58, 2.3, 5.2, 0.03, 0.09, 1.3, 0xe8e8e4);
  k.lamp(1.6, 2.2, 5.2, 0xf0f5ff, 7, 8); k.lamp(-1.3, 1.7, 5.5, 0xffcf90, 5, 6); k.lamp(3.9, 2.5, 1.6, 0xf4f6ff, 6, 6); k.lamp(-4.7, 2.3, 4.2, 0xffd9a8, 6, 7);
  // Floor lamp by the sofa, money plant by the balcony door.
  satin.cyl(-2.2, 0, 6.12, 0.13, 0.03, 0x2a2a2c, 10); satin.cyl(-2.2, 0.03, 6.12, 0.015, 1.35, 0x2a2a2c, 6); glow.cyl(-2.2, 1.36, 6.12, 0.17, 0.26, [0xffd9a0, 2.2], 12, 0.12);
  satin.cyl(2.2, 0, 6.05, 0.16, 0.3, 0xb5651d, 10, 0.2); for (let i = 0; i < 7; i++) flat.ball(2.2 + Math.cos(i * 2.2) * 0.14, 0.45 + i * 0.09, 6.05 + Math.sin(i * 2.2) * 0.14, 0.13, i % 2 ? 0x2f7d3a : 0x3d9148, 0.8, 6);
  k.posts.push([2.2, 6.05, 0.22, false], [-2.2, 6.12, 0.16, false]);
  // Dining table for two against the wall.
  wood.box(-2.1, 0.7, 2.2, 0.75, 0.04, 1.1, 0xb89468); for (const [dx, dz] of [[-0.3, -0.48], [0.3, -0.48], [-0.3, 0.48], [0.3, 0.48]]) satin.box(-2.1 + dx, 0, 2.2 + dz, 0.05, 0.7, 0.05, 0x3a2a1c);
  for (const dz of [-0.85, 0.85]) { satin.box(-2.05, 0.42, 2.2 + dz, 0.4, 0.04, 0.4, 0x6a4a30); satin.box(-2.05, 0.42, 2.2 + dz + Math.sign(dz) * 0.19, 0.4, 0.45, 0.03, 0x6a4a30); for (const [ax, az] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) satin.box(-2.05 + ax, 0, 2.2 + dz + az, 0.03, 0.42, 0.03, 0x6a4a30); }
  steel.cyl(-2.15, 0.74, 2.05, 0.09, 0.2, 0xcfd3d3, 10); steel.cyl(-2.15, 0.94, 2.05, 0.03, 0.03, 0xcfd3d3, 6); // a steel tiffin
  flat.cyl(-2.0, 0.74, 2.45, 0.11, 0.015, 0xf4f4f0, 12);
  k.solids.push([-2.6, 1.3, -1.7, 3.0, false]);
  // Shoe rack and umbrella by the door.
  wood.box(1.75, 0, 0.22, 0.9, 0.5, 0.32, 0x8a6a48); k.solids.push([1.25, 0, 2.25, 0.42, false]);
  for (const [x, c] of [[1.45, 0x1c1c1c], [1.75, 0x7a4a26], [2.05, 0x2e5c8a]]) flat.box(x, 0.5, 0.22, 0.2, 0.08, 0.26, c);
  // Wall things: clock, calendar, a small wooden shelf with a brass diya.
  const P = k.atlas('signs', 512, 512);
  const cal = P.draw(200, 280, (g, w, h) => {
    g.fillStyle = '#fbf7ea'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c0392b'; g.fillRect(0, 0, w, 96); g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = font(26, 800); g.fillText('डिसेंबर', w / 2, 40); g.font = font(22, 700); g.fillText('DECEMBER', w / 2, 76);
    g.fillStyle = '#222'; g.font = font(17, 600);
    for (let d = 1; d <= 31; d++) { g.fillStyle = (d + 1) % 7 === 0 ? '#c0392b' : '#222'; g.fillText(String(d), 22 + ((d + 1) % 7) * 26, 128 + Math.floor((d + 1) / 7) * 30); }
    g.fillStyle = '#1d5c8a'; g.font = font(15, 700); g.fillText('Shree Lakshmi Kirana & General', w / 2, h - 12, w - 12);
  });
  k.to('signs').quad(-1.3, 1.7, 0.012, 0.4, 0.56, 0, undefined, cal);
  const clockFace = P.draw(128, 128, (g, w) => {
    g.fillStyle = '#f7f4ec'; g.beginPath(); g.arc(w / 2, w / 2, 62, 0, 7); g.fill(); g.strokeStyle = '#2a2a2c'; g.lineWidth = 7; g.stroke();
    g.fillStyle = '#222'; for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.fillRect(w / 2 + Math.sin(a) * 50 - 2, w / 2 - Math.cos(a) * 50 - 2, 4, 4); }
    g.lineWidth = 5; g.beginPath(); g.moveTo(w / 2, w / 2); g.lineTo(w / 2 + 22, w / 2 - 14); g.stroke(); g.lineWidth = 3; g.beginPath(); g.moveTo(w / 2, w / 2); g.lineTo(w / 2 - 8, w / 2 - 44); g.stroke();
  });
  k.to('signs').quad(2.59, 2.0, 3.6, 0.34, 0.34, -Math.PI / 2, undefined, clockFace);
  wood.box(1.3, 1.5, 0.1, 0.5, 0.03, 0.2, 0x8a6a48); brass.cyl(1.3, 1.53, 0.1, 0.035, 0.03, 0xc9a24a, 8, 0.05); glow.ball(1.3, 1.585, 0.1, 0.018, [0xffb347, 4], 1.6, 6);
  // The signed film poster hangs over the sofa once Vikram Oberoi has given it to you.
  const poster = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.9).rotateY(Math.PI / 2).translate(-2.58, 1.75, 5.25), new THREE.MeshStandardMaterial({ roughness: 0.5, map: canvasTexture(256, 372, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#f6b042'); bg.addColorStop(1, '#8c1c13'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1a0d08'; g.beginPath(); g.arc(w / 2, 150, 34, 0, 7); g.fill(); g.fillRect(w / 2 - 52, 184, 104, 130); // a silhouette, nobody in particular
    g.fillStyle = '#fff3c4'; g.textAlign = 'center'; g.font = font(34, 800); g.fillText('SANGAM KE', w / 2, 46); g.fillText('SITARE', w / 2, 84);
    g.font = '600 20px "Kalam", cursive'; g.fillStyle = '#fff'; g.fillText('Taxi-wale dost ke liye —', w / 2, h - 44); g.fillText('V. Oberoi', w / 2 + 40, h - 18);
    g.strokeStyle = '#2a1a0c'; g.lineWidth = 12; g.strokeRect(0, 0, w, h);
  }) }));
  poster.visible = false;
  k.meshes.push(poster);

  // ---- kitchen: platform along the east and north walls, fridge, utensil rack
  tiles.span(5.18, 0.86, 0, 5.2, 1.25, 3.2); tiles.span(5.18, 1.25, 0, 5.2, 2.1, 1.0); tiles.span(5.18, 1.25, 2.3, 5.2, 2.1, 3.2); tiles.span(2.8, 0.86, 3.18, 5.2, 2.1, 3.2);
  satin.span(4.6, 0, 0.75, 5.2, 0.82, 3.2, 0xd9cdb4); satin.span(2.95, 0, 2.6, 4.6, 0.82, 3.2, 0xd9cdb4);       // cabinets
  gloss.span(4.56, 0.82, 0.72, 5.2, 0.87, 3.2, 0x1e2022); gloss.span(2.92, 0.82, 2.56, 4.6, 0.87, 3.2, 0x1e2022); // granite
  k.solids.push([4.5, 0.7, 5.2, 3.2, false], [2.9, 2.5, 4.6, 3.2, false]);
  for (let z = 1.0; z < 2.5; z += 0.6) satin.box(4.59, 0.08, z + 0.28, 0.02, 0.66, 0.54, 0xcbbd9f);
  // Sink under the window, stove with a pressure cooker and a kadhai on the north counter, chimney above.
  steel.span(4.72, 0.8, 1.3, 5.12, 0.875, 2.0, 0xc8cccc); steel.cyl(5.08, 0.87, 1.65, 0.015, 0.25, 0xc8cccc, 6); steel.box(4.98, 1.1, 1.65, 0.2, 0.025, 0.025, 0xc8cccc);
  steel.box(3.75, 0.87, 2.88, 0.72, 0.06, 0.4, 0xb9bdbd); for (const x of [3.55, 3.95]) satin.cyl(x, 0.93, 2.88, 0.08, 0.015, 0x1a1a1a, 10);
  steel.cyl(3.55, 0.945, 2.88, 0.1, 0.13, 0xc9cdcd, 12); satin.cyl(3.55, 1.075, 2.88, 0.105, 0.02, 0xc9cdcd, 12); satin.box(3.68, 1.03, 2.88, 0.14, 0.025, 0.03, 0x161616);
  satin.cyl(3.95, 0.945, 2.88, 0.07, 0.06, 0x2a2a2c, 12, 0.13);
  steel.box(3.75, 1.75, 3.0, 0.76, 0.12, 0.42, 0x8f9696); steel.box(3.75, 1.87, 3.08, 0.3, 0.98, 0.24, 0x8f9696);
  satin.span(4.3, 1.5, 2.86, 5.18, 2.2, 3.18, 0xd9cdb4); satin.span(2.92, 1.5, 2.86, 3.32, 2.2, 3.18, 0xd9cdb4);   // wall cabinets
  satin.cyl(4.2, 0, 0.3, 0.15, 0.6, 0xb3261e, 10); satin.cyl(4.2, 0.6, 0.3, 0.06, 0.1, 0xb3261e, 8); k.posts.push([4.2, 0.3, 0.2, false]); // the spare gas cylinder
  // Fridge, water filter, steel rack with plates and dabbas.
  satin.box(3.25, 0, 0.36, 0.66, 1.68, 0.66, 0x8c2f39); satin.box(3.25, 1.1, 0.7, 0.62, 0.012, 0.012, 0x5a1d24); steel.box(3.52, 0.9, 0.71, 0.03, 0.5, 0.03, 0xc8cccc);
  k.solids.push([2.9, 0, 3.6, 0.72, true]);
  satin.box(4.25, 1.35, 0.1, 0.3, 0.45, 0.16, 0xf4f6f6); satin.box(4.25, 1.4, 0.19, 0.2, 0.2, 0.02, 0x2e86c1);
  for (const y of [1.05, 1.4]) { steel.span(4.55, y, 0.02, 5.15, y + 0.015, 0.26, 0xc8cccc); for (let i = 0; i < 5; i++) steel.cyl(4.63 + i * 0.11, y + 0.015, 0.14, 0.045, 0.1 + (i % 3) * 0.04, 0xd0d4d4, 8); }
  k.spot(3.25, 1.2, 0.95, 'E: look in the fridge', (a) => a.msg(['Fridge: half a lemon, a jar of Aai’s achaar and yesterday’s dal.', 'Fridge: one mango from May. It has seen things.', 'Fridge: cold water in old cola bottles. Classic.'][Math.floor(Math.random() * 3)]));

  // ---- bedroom: bed, bedside table, steel almirah, desk under the window
  const BX = -5.45, BZ = 4.1;
  wood.box(BX, 0, BZ, 2.05, 0.3, 1.6, 0x7a5a3c); wood.box(BX - 1.0, 0, BZ, 0.06, 0.95, 1.64, 0x7a5a3c);
  flat.box(BX + 0.02, 0.3, BZ, 1.98, 0.16, 1.52, 0xf0ede4);
  flat.box(BX + 0.42, 0.46, BZ, 1.15, 0.05, 1.54, 0x9c3a2c); flat.box(BX + 0.42, 0.51, BZ, 0.5, 0.012, 1.54, 0xc79a3a);       // block-print razai
  for (const dz of [-0.4, 0.4]) flat.box(BX - 0.7, 0.46, BZ + dz, 0.4, 0.1, 0.62, 0xf6f4ee);
  k.solids.push([BX - 1.05, BZ - 0.82, BX + 1.03, BZ + 0.82, false]);
  wood.box(-6.25, 0, 5.25, 0.42, 0.5, 0.42, 0x7a5a3c); glow.cyl(-6.25, 0.62, 5.25, 0.1, 0.16, [0xffd9a0, 2], 10, 0.07); satin.cyl(-6.25, 0.5, 5.25, 0.05, 0.12, 0x8a6a48, 8);
  k.solids.push([-6.5, 5.0, -6.0, 5.5, false]);
  // Steel almirah with a mirror on one door, a suitcase on top.
  const AX = -4.3, AZ = 2.08;
  satin.box(AX, 0, AZ, 1.0, 1.95, 0.5, 0x6f8478); satin.box(AX, 0.02, AZ + 0.255, 0.012, 1.9, 0.012, 0x4f6257);
  k.to('mirror').quad(AX + 0.25, 1.15, AZ + 0.262, 0.36, 1.1, 0, 0xaab4b0);
  for (const s of [-1, 1]) steel.box(AX + s * 0.06, 1.0, AZ + 0.27, 0.02, 0.16, 0.03, 0xd0d4d4);
  flat.box(AX, 1.95, AZ, 0.75, 0.24, 0.42, 0x2f4a6a); satin.box(AX, 2.02, AZ + 0.22, 0.2, 0.03, 0.03, 0x1a1a1a);
  k.solids.push([AX - 0.52, 1.8, AX + 0.52, AZ + 0.27, true]);
  // Desk and chair under the window.
  wood.box(-3.45, 0.72, 5.95, 1.1, 0.04, 0.55, 0xb89468); for (const [dx, dz] of [[-0.5, -0.22], [0.5, -0.22], [-0.5, 0.22], [0.5, 0.22]]) satin.box(-3.45 + dx, 0, 5.95 + dz, 0.04, 0.72, 0.04, 0x3a2a1c);
  satin.box(-3.5, 0.76, 6.0, 0.34, 0.02, 0.24, 0x2a2a2e); satin.box(-3.5, 0.78, 6.12, 0.34, 0.22, 0.015, 0x2a2a2e, 0);        // laptop
  flat.box(-3.05, 0.76, 5.9, 0.16, 0.05, 0.22, 0xd9a520);                                                                    // the taxi-meter rate card and a diary
  satin.box(-3.45, 0.42, 5.35, 0.42, 0.04, 0.42, 0x3a3a40); satin.box(-3.45, 0.42, 5.15, 0.42, 0.45, 0.03, 0x3a3a40); satin.cyl(-3.45, 0, 5.35, 0.03, 0.42, 0x2a2a2c, 6);
  k.solids.push([-4.05, 5.62, -2.85, 6.4, false], [-3.7, 5.1, -3.2, 5.6, false]);

  // ---- ceiling fans (hall and bedroom), turning
  const fg = new Geo();
  fg.add(new THREE.CylinderGeometry(0.09, 0.11, 0.1, 10).translate(0, -0.3, 0), 0xf2efe6); fg.add(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 5).translate(0, -0.15, 0), 0xd8d4c8);
  for (let i = 0; i < 3; i++) fg.add(new THREE.BoxGeometry(0.56, 0.008, 0.13).translate(0.36, -0.31, 0).rotateY((i * Math.PI * 2) / 3), 0xf2efe6);
  const fans = k.instances(fg.merge(), 'satin', [[0, H, 3.4], [-4.6, H, 4.2]], { cast: false });
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s1 = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0), pos = [new THREE.Vector3(0, H, 3.4), new THREE.Vector3(-4.6, H, 4.2)];
  let spin = 0;
  k.ticks.push((dt) => {
    spin += dt * 7;
    pos.forEach((p, i) => { m.compose(p, q.setFromAxisAngle(up, spin + i), s1); fans.setMatrixAt(i, m); });
    fans.instanceMatrix.needsUpdate = true;
  });

  // ---- things to do
  k.spot(BX + 1.3, BZ, 1.3, 'E: sleep till 7:00 AM', (a) => a.blackout(() => {
    a.clock.hour = 7;
    a.state.rest(1);
    a.state.save();
    a.msg('Good morning, Mumbai! 7:00 AM — slept like a log. Energy full.');
  }));
  k.spot(AX, AZ + 0.8, 1.0, 'E: open the almirah (wardrobe)', (a) => { a.view.release(); a.phone.toggle(true); a.phone.go('home'); });
  k.spot(0, 7.3, 1.0, 'The lake from the twelfth floor. (Is that log… moving?)', () => {});

  return {
    spawn,
    ambient: [0xfff4e6, 0xd6cab6, 1.8], key: [0.05, 1, 0.5, 1.5, 0xfff3e0], env: 0.5, exposure: 0.95,
    sound: [0.05, 0.01, 0.12],
    enter: (a) => {
      poster.visible = !!a.state.s.fanMeets?.legend;
      if (a.clock.hour >= 21 || a.clock.hour < 5) a.msg('Home. Flat 1204. The bed is that way (E to sleep).');
      else a.msg('Home sweet home — flat 1204. Bed: sleep till 7 am. Almirah: wardrobe. Balcony: the lake.');
    },
  };
}
