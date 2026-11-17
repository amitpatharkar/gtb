import * as THREE from 'three';

// Room and shop atlas for the facade shader's fake interiors (interior mapping, facade.js),
// drawn on a canvas at start-up (no download). 8 × 4 cells, alpha premultiplied:
//   row 0  back walls of homes (alpha = furniture; the bare wall takes the room's paint colour):
//          TV and cabinet, steel cupboard, kitchen, showcase, bookshelf, bed, prayer shelf, office
//   row 1  furniture seen in the middle of the room (cut-outs) with a ceiling fan: sofa, dining
//          table, someone in a chair, fridge, bed end, desk, clothes stand, stool
//   row 2  back walls of shops: grocery, chemist, cloth, sweets, mobiles, hardware, garments, steel
//   row 3  cells 0–5: what hangs or stands just inside a shop (snack strips, counter and
//          shopkeeper, mannequins, grain sacks, buckets, garments); cells 6–7: eight Art Deco
//          building name plaques (made-up names), four per cell.
// A cell is one room wall: x across the room, y floor (bottom) to ceiling (top).

export const ROOM_ATLAS = { COLS: 8, ROWS: 4 };
const PLAQUES = ['SEA BREEZE', 'SHANTI NIWAS', 'MOONBEAM', 'SAGAR DARSHAN', 'GULMOHAR', 'ASHA KUNJ', 'SUNRISE COURT', 'NEELAMBARI'];

function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }

/** Room atlas texture; `scale` 1 = 256 px cells (Medium/High), 0.5 on Low. */
export function makeRoomAtlas(scale = 1) {
  const C = 256, W = C * 8, H = C * 4;
  const c = document.createElement('canvas');
  c.width = Math.round(W * scale); c.height = Math.round(H * scale);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.premultiplyAlpha = true;
  tex.anisotropy = 4;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const draw = (families = {}) => {
    const g = c.getContext('2d');
    g.setTransform(scale, 0, 0, scale, 0, 0);
    g.clearRect(0, 0, W, H);
    const cell = (col, row, fn) => { g.save(); g.translate(col * C, row * C); g.beginPath(); g.rect(0, 0, C, C); g.clip(); fn(g, rng(col * 31 + row * 7 + 3)); g.restore(); };
    HOME.forEach((fn, i) => cell(i, 0, fn));
    FURNITURE.forEach((fn, i) => cell(i, 1, fn));
    SHOP.forEach((fn, i) => cell(i, 2, fn));
    FRONT.forEach((fn, i) => cell(i, 3, fn));
    const font = families.latin2 || families.latin1 || 'Arial Black';
    PLAQUES.forEach((name, i) => cell(6 + (i >> 2), 3, (gg) => plaque(gg, name, (i & 3) * 64, font)));
    tex.needsUpdate = true;
  };
  draw();
  return { texture: tex, redraw: draw, cell: Math.round(C * scale) };
}

// 1 px ≈ 1.3 cm on a 3.3 m × 3.2 m wall: the floor is y = 256, the ceiling y = 0.
const R = (g, col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
const shade = (g, x, y, w, h, a = 0.25) => { const gr = g.createLinearGradient(x, y, x, y + h); gr.addColorStop(0, `rgba(255,255,255,${a * 0.4})`); gr.addColorStop(1, `rgba(0,0,0,${a})`); g.fillStyle = gr; g.fillRect(x, y, w, h); };
const PACK = ['#c0392b', '#e67e22', '#f1c40f', '#27ae60', '#2980b9', '#8e44ad', '#ecf0f1', '#d35400', '#16a085', '#e84393', '#2c3e50', '#fdcb6e'];

function calendar(g, x, y) { R(g, '#f4f1e8', x, y, 26, 36); R(g, '#c0392b', x, y, 26, 8); R(g, '#7f8c8d', x + 4, y + 12, 18, 18); g.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 4; i++) g.fillRect(x + 4, y + 14 + i * 4, 18, 1); }
function clock(g, x, y) { g.fillStyle = '#ecebe4'; g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill(); g.strokeStyle = '#333'; g.lineWidth = 1.5; g.stroke(); g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 6); g.moveTo(x, y); g.lineTo(x + 4, y + 2); g.stroke(); }
function frame(g, x, y, w, h, inner) { R(g, '#5a3b22', x, y, w, h); R(g, inner, x + 3, y + 3, w - 6, h - 6); }

const HOME = [
  // TV on a low cabinet, calendar, clock, photo.
  (g) => { R(g, '#6b4a2e', 70, 206, 120, 50); shade(g, 70, 206, 120, 50); R(g, '#4a321f', 76, 214, 50, 34); R(g, '#4a321f', 130, 214, 54, 34); R(g, '#111', 92, 150, 74, 46); R(g, '#1d2733', 95, 153, 68, 40); R(g, '#222', 125, 196, 10, 10); calendar(g, 22, 100); clock(g, 210, 70); frame(g, 100, 70, 44, 34, '#a08b6d'); },
  // Steel cupboard, mirror, clothes on hooks.
  (g) => { R(g, '#6f7a72', 18, 108, 76, 148); shade(g, 18, 108, 76, 148, 0.3); R(g, '#5d675f', 55, 112, 2, 140); R(g, '#c9c9c0', 49, 170, 4, 14); R(g, '#9fb2ba', 118, 96, 38, 54); R(g, '#6b4a2e', 115, 93, 44, 4); R(g, '#3a2a1a', 176, 92, 60, 4); [['#c0392b', 0], ['#2471a3', 18], ['#f4d03f', 36]].forEach(([c2, dx]) => { R(g, c2, 180 + dx, 96, 14, 58); shade(g, 180 + dx, 96, 14, 58); }); calendar(g, 120, 168); },
  // Kitchen: tiled dado, black platform, utensils on a shelf, gas cylinder.
  (g, r) => { R(g, '#e9e6dc', 0, 120, 256, 70); g.fillStyle = 'rgba(0,0,0,0.12)'; for (let x = 0; x < 256; x += 12) g.fillRect(x, 120, 1, 70); for (let y = 120; y < 190; y += 12) g.fillRect(0, y, 256, 1); R(g, '#202020', 0, 190, 256, 8); R(g, '#7a6a58', 0, 198, 256, 58); R(g, '#8e8e8e', 40, 182, 50, 8); R(g, '#b03a2e', 150, 206, 24, 44); R(g, '#8a2d24', 155, 200, 14, 8); R(g, '#5d4636', 0, 86, 256, 5); for (let x = 10; x < 250; x += 16 + r() * 8) { const s = 10 + r() * 8; const gr = g.createLinearGradient(x, 0, x + s, 0); gr.addColorStop(0, '#9aa0a3'); gr.addColorStop(0.5, '#f1f3f4'); gr.addColorStop(1, '#7d8386'); g.fillStyle = gr; g.fillRect(x, 86 - s * 1.1, s, s * 1.1); } },
  // Showcase with glass doors, framed picture.
  (g, r) => { R(g, '#6b4a2e', 40, 96, 176, 160); R(g, '#3a2a1a', 46, 102, 164, 96); for (let s = 0; s < 3; s++) { R(g, '#7a5a3a', 46, 132 + s * 32, 164, 3); for (let x = 52; x < 204; x += 12 + r() * 10) R(g, PACK[Math.floor(r() * PACK.length)], x, 112 + s * 32, 7, 18); } g.fillStyle = 'rgba(200,220,230,0.18)'; g.fillRect(46, 102, 80, 96); g.fillRect(130, 102, 80, 96); R(g, '#5a3b22', 46, 204, 164, 46); frame(g, 96, 40, 64, 44, '#7a8b6d'); },
  // Bookshelf and desk.
  (g, r) => { R(g, '#5a3b22', 20, 60, 110, 196); for (let s = 0; s < 5; s++) { R(g, '#3a2614', 26, 66 + s * 38, 98, 34); for (let x = 28; x < 120; x += 5 + r() * 4) R(g, PACK[Math.floor(r() * PACK.length)], x, 72 + s * 38 + r() * 8, 4 + r() * 3, 28 - r() * 8); } R(g, '#7a5a3a', 150, 180, 96, 8); R(g, '#5a3b22', 156, 188, 8, 68); R(g, '#5a3b22', 232, 188, 8, 68); R(g, '#333', 196, 150, 8, 30); R(g, '#f1c40f', 186, 142, 28, 10); calendar(g, 200, 90); },
  // Bed with a printed sheet, headboard, picture.
  (g, r) => { R(g, '#5a3b22', 30, 150, 196, 56); R(g, '#d35d6e', 26, 200, 204, 56); for (let i = 0; i < 40; i++) { g.fillStyle = PACK[Math.floor(r() * PACK.length)]; g.beginPath(); g.arc(30 + r() * 196, 206 + r() * 46, 3, 0, 7); g.fill(); } R(g, '#f3efe6', 44, 186, 60, 18); R(g, '#f3efe6', 152, 186, 60, 18); frame(g, 88, 70, 80, 54, '#5d8aa8'); },
  // Prayer shelf with a small lamp and marigolds, calendar.
  (g) => { R(g, '#7a5a3a', 90, 110, 76, 6); R(g, '#8a6a46', 96, 70, 64, 40); R(g, '#d8c27a', 102, 76, 52, 30); for (let x = 92; x < 166; x += 6) { g.fillStyle = x % 12 ? '#f39c12' : '#e67e22'; g.beginPath(); g.arc(x, 72 + Math.sin(x) * 2, 3, 0, 7); g.fill(); } g.fillStyle = '#ffd36b'; g.beginPath(); g.arc(128, 104, 3, 0, 7); g.fill(); calendar(g, 30, 96); R(g, '#3a4a5a', 196, 180, 40, 76); shade(g, 196, 180, 40, 76); },
  // Office: whiteboard, filing cabinets, chart.
  (g) => { R(g, '#f4f4f0', 30, 60, 120, 70); R(g, '#999', 30, 128, 120, 4); g.strokeStyle = '#2a5ab0'; g.lineWidth = 2; g.beginPath(); g.moveTo(40, 110); g.lineTo(70, 80); g.lineTo(100, 96); g.lineTo(136, 70); g.stroke(); for (let i = 0; i < 3; i++) { R(g, '#7f8a8c', 170 + i * 28, 150, 26, 106); shade(g, 170 + i * 28, 150, 26, 106); for (let k = 0; k < 4; k++) R(g, '#5d6668', 174 + i * 28, 158 + k * 24, 18, 3); } clock(g, 210, 70); },
];

function fan(g) { R(g, '#333', 126, 0, 4, 22); R(g, '#3a3a3a', 120, 22, 16, 6); R(g, '#4a4a4a', 58, 24, 140, 3); }
const FURNITURE = [
  // Sofa and low table.
  (g) => { fan(g); R(g, '#7b3f2e', 40, 176, 150, 50); R(g, '#8e4a36', 40, 196, 150, 34); R(g, '#6b3324', 30, 176, 16, 60); R(g, '#6b3324', 184, 176, 16, 60); R(g, '#3a2a1a', 46, 230, 6, 26); R(g, '#3a2a1a', 178, 230, 6, 26); R(g, '#5a3b22', 200, 210, 44, 8); R(g, '#5a3b22', 204, 218, 4, 38); R(g, '#5a3b22', 236, 218, 4, 38); },
  // Dining table with chairs.
  (g) => { fan(g); R(g, '#6b4a2e', 60, 188, 136, 8); R(g, '#4a321f', 66, 196, 6, 60); R(g, '#4a321f', 184, 196, 6, 60); for (const x of [44, 100, 150, 206]) { R(g, '#5a3b22', x, 160, 6, 96); R(g, '#5a3b22', x, 204, 24, 5); } R(g, '#b9bcbe', 110, 176, 20, 12); R(g, '#c0392b', 140, 178, 14, 10); },
  // Someone in a plastic chair, a side table.
  (g) => { fan(g); R(g, '#d8d4c8', 90, 196, 60, 8); R(g, '#d8d4c8', 92, 204, 6, 52); R(g, '#d8d4c8', 142, 204, 6, 52); R(g, '#d8d4c8', 96, 150, 50, 50); g.fillStyle = '#2b2b2b'; g.beginPath(); g.arc(120, 128, 13, 0, 7); g.fill(); R(g, '#4a6a8a', 104, 140, 34, 58); R(g, '#3a3a4a', 108, 198, 26, 50); R(g, '#5a3b22', 180, 200, 40, 6); R(g, '#5a3b22', 196, 206, 6, 50); },
  // Fridge and a stool.
  (g) => { fan(g); R(g, '#d9dcdc', 160, 96, 64, 160); shade(g, 160, 96, 64, 160, 0.2); R(g, '#b9bcbe', 164, 150, 56, 2); R(g, '#8a8f90', 210, 112, 3, 28); R(g, '#c0392b', 166, 100, 14, 10); R(g, '#3471a8', 60, 216, 40, 6); R(g, '#3471a8', 64, 222, 5, 34); R(g, '#3471a8', 92, 222, 5, 34); },
  // End of a bed with a folded quilt.
  (g) => { fan(g); R(g, '#5a3b22', 30, 200, 190, 40); R(g, '#2e86c1', 30, 186, 190, 22); R(g, '#f1c40f', 140, 176, 60, 14); R(g, '#3a2a1a', 34, 240, 8, 16); R(g, '#3a2a1a', 208, 240, 8, 16); },
  // Desk, chair and computer.
  (g) => { fan(g); R(g, '#7a5a3a', 110, 180, 120, 8); R(g, '#5a3b22', 116, 188, 6, 68); R(g, '#5a3b22', 220, 188, 6, 68); R(g, '#1b1b1b', 150, 136, 50, 34); R(g, '#2c3e50', 153, 139, 44, 28); R(g, '#1b1b1b', 172, 170, 6, 10); R(g, '#222', 60, 170, 40, 60); R(g, '#222', 76, 230, 6, 26); },
  // Clothes drying stand and a bucket.
  (g) => { fan(g); R(g, '#9a9a9a', 50, 140, 150, 3); R(g, '#9a9a9a', 50, 140, 3, 116); R(g, '#9a9a9a', 197, 140, 3, 116); [['#c0392b', 60], ['#f4f4f0', 90], ['#2471a3', 120], ['#e67e22', 156]].forEach(([c2, x]) => R(g, c2, x, 143, 24, 50)); R(g, '#2e86c1', 210, 220, 30, 36); },
  // A stool (an almost empty room).
  (g) => { fan(g); R(g, '#c0392b', 100, 216, 40, 6); R(g, '#c0392b', 104, 222, 5, 34); R(g, '#c0392b', 132, 222, 5, 34); },
];

function shelves(g, r, rows, color, fill) {
  for (let s = 0; s < rows; s++) {
    const y = 20 + s * (220 / rows);
    R(g, color, 0, y + 220 / rows - 6, 256, 6);
    fill(y, 220 / rows - 6, s);
  }
}
const SHOP = [
  // Grocery (kirana): packets, jars, tins; sacks at the bottom.
  (g, r) => { R(g, '#3a2a1a', 0, 0, 256, 256); shelves(g, r, 5, '#7a5a3a', (y, h) => { for (let x = 2; x < 254;) { const w = 8 + r() * 10, hh = h * (0.5 + r() * 0.45); R(g, PACK[Math.floor(r() * PACK.length)], x, y + h - hh, w - 1.5, hh); shade(g, x, y + h - hh, w - 1.5, hh, 0.2); x += w; } }); },
  // Chemist: white shelves, small boxes, green cross.
  (g, r) => { R(g, '#e8ebe8', 0, 0, 256, 256); shelves(g, r, 6, '#b8c0c0', (y, h) => { for (let x = 2; x < 254;) { const w = 6 + r() * 7; R(g, ['#ffffff', '#d6eaf8', '#d5f5e3', '#fdebd0', '#e8daef'][Math.floor(r() * 5)], x, y + h * (0.3 + r() * 0.3), w - 1, h); x += w; } }); R(g, '#1e8449', 110, 4, 36, 12); R(g, '#1e8449', 122, -8, 12, 36); },
  // Cloth shop: folded bolts in bright colours.
  (g, r) => { R(g, '#4a321f', 0, 0, 256, 256); shelves(g, r, 6, '#7a5a3a', (y, h) => { for (let x = 4; x < 252; x += 18) for (let k = 0; k < 3; k++) { R(g, PACK[Math.floor(r() * PACK.length)], x, y + h - (k + 1) * (h / 3.2), 16, h / 3.4); } }); },
  // Sweets: tiled wall, trays of sweets on glass shelves.
  (g, r) => { R(g, '#f3eee2', 0, 0, 256, 256); g.fillStyle = 'rgba(0,0,0,0.08)'; for (let x = 0; x < 256; x += 16) g.fillRect(x, 0, 1, 256); for (let y = 0; y < 256; y += 16) g.fillRect(0, y, 256, 1); for (let s = 0; s < 4; s++) { const y = 70 + s * 46; R(g, 'rgba(180,210,220,0.9)', 0, y + 30, 256, 3); for (let x = 6; x < 250; x += 40) { R(g, '#c9c9c9', x, y + 24, 34, 6); const col = ['#f5b041', '#f8c471', '#ffffff', '#e59866', '#f1948a', '#a9dfbf'][Math.floor(r() * 6)]; for (let k = 0; k < 7; k++) { g.fillStyle = col; g.beginPath(); g.arc(x + 4 + k * 4.4, y + 22 - (k % 2) * 3, 3, 0, 7); g.fill(); } } } calendar(g, 115, 18); },
  // Mobile phones: posters, boxes, a lit sign.
  (g, r) => { R(g, '#dfe6ea', 0, 0, 256, 256); for (let i = 0; i < 4; i++) { const x = 8 + i * 62; R(g, ['#1b4f72', '#6c3483', '#117864', '#b03a2e'][i], x, 12, 54, 70); R(g, '#111', x + 18, 22, 18, 34); R(g, '#5dade2', x + 20, 25, 14, 28); } shelves(g, r, 3, '#9aa7ae', (y, h) => { if (y < 80) return; for (let x = 4; x < 250; x += 14) R(g, ['#ffffff', '#222', '#ecf0f1', '#2e86c1'][Math.floor(r() * 4)], x, y + h - 22, 12, 22); }); },
  // Hardware: paint tins, pipes, coils, tools.
  (g, r) => { R(g, '#5d5348', 0, 0, 256, 256); g.fillStyle = 'rgba(0,0,0,0.25)'; for (let x = 6; x < 256; x += 10) for (let y = 6; y < 110; y += 10) g.fillRect(x, y, 2, 2); for (let i = 0; i < 14; i++) R(g, '#9aa0a3', 10 + r() * 230, 10 + r() * 80, 4, 20 + r() * 20); shelves(g, r, 3, '#6b5a48', (y, h) => { if (y < 100) return; for (let x = 4; x < 250; x += 22) { const col = PACK[Math.floor(r() * PACK.length)]; R(g, col, x, y + h - 26, 20, 26); R(g, '#ccc', x, y + h - 26, 20, 4); } }); },
  // Garments: shirts and kurtas on rails, shelves above.
  (g, r) => { R(g, '#efe8dc', 0, 0, 256, 256); shelves(g, r, 2, '#b9a58a', (y, h, s) => { if (s) return; for (let x = 4; x < 252; x += 14) R(g, PACK[Math.floor(r() * PACK.length)], x, y + h - 30, 12, 30); }); R(g, '#888', 0, 130, 256, 3); for (let x = 4; x < 250; x += 12) { const col = PACK[Math.floor(r() * PACK.length)]; R(g, col, x, 134, 11, 70 + r() * 30); shade(g, x, 134, 11, 90); } },
  // Steel utensils: shiny stacks.
  (g, r) => { R(g, '#4a4440', 0, 0, 256, 256); shelves(g, r, 5, '#6b5a48', (y, h) => { for (let x = 2; x < 254;) { const w = 14 + r() * 16, hh = h * (0.4 + r() * 0.55); const gr = g.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, '#7f8588'); gr.addColorStop(0.45, '#f4f6f7'); gr.addColorStop(1, '#6e7477'); g.fillStyle = gr; g.fillRect(x, y + h - hh, w - 2, hh); x += w; } }); },
];

const FRONT = [
  // Strips of snack packets hanging from the top.
  (g, r) => { for (let x = 6; x < 250; x += 22 + r() * 10) { const col = PACK[Math.floor(r() * PACK.length)]; for (let k = 0; k < 6; k++) { R(g, col, x, 4 + k * 15, 14, 13); R(g, 'rgba(255,255,255,0.35)', x + 2, 6 + k * 15, 10, 3); } } },
  // Glass counter, till and the shopkeeper behind.
  (g) => { g.fillStyle = '#2b2b2b'; g.beginPath(); g.arc(160, 132, 13, 0, 7); g.fill(); R(g, '#f4f4f0', 144, 145, 34, 46); R(g, 'rgba(170,200,210,0.55)', 0, 186, 256, 70); R(g, '#7f8c8d', 0, 182, 256, 5); R(g, '#3a3a3a', 70, 166, 30, 18); R(g, '#c0392b', 20, 200, 30, 20); R(g, '#f1c40f', 200, 204, 24, 16); },
  // Two mannequins in bright clothes.
  (g) => { for (const [x, c1, c2] of [[70, '#c0392b', '#f1c40f'], [180, '#1f618d', '#e8daef']]) { g.fillStyle = '#e8d3b8'; g.beginPath(); g.arc(x, 92, 10, 0, 7); g.fill(); R(g, c1, x - 18, 104, 36, 60); R(g, c2, x - 22, 160, 44, 90); R(g, '#333', x - 2, 250, 4, 6); } },
  // Open sacks of grain and a weighing scale.
  (g, r) => { for (let x = 6; x < 250; x += 50) { R(g, '#d8c9a4', x, 196, 44, 60); shade(g, x, 196, 44, 60); g.fillStyle = ['#f5f0e1', '#f4d03f', '#ca6f1e', '#82705a'][Math.floor(r() * 4)]; g.beginPath(); g.ellipse(x + 22, 198, 20, 6, 0, 0, 7); g.fill(); } R(g, '#5d6d7e', 110, 150, 40, 8); R(g, '#5d6d7e', 128, 120, 4, 30); },
  // Plastic buckets, mugs and brooms hanging.
  (g, r) => { for (let x = 8; x < 250; x += 30) { const col = ['#e74c3c', '#2e86c1', '#27ae60', '#f1c40f', '#8e44ad'][Math.floor(r() * 5)]; R(g, '#666', x + 11, 0, 2, 10 + r() * 20); R(g, col, x, 26 + r() * 20, 24, 26); } for (let x = 20; x < 240; x += 70) R(g, '#c8a165', x, 160, 8, 96); },
  // Garments hanging at the front and a stool.
  (g, r) => { R(g, '#777', 0, 8, 256, 3); for (let x = 6; x < 250; x += 26) { const col = PACK[Math.floor(r() * PACK.length)]; R(g, col, x, 12, 22, 80 + r() * 30); shade(g, x, 12, 22, 100); } R(g, '#2e86c1', 110, 226, 34, 6); R(g, '#2e86c1', 114, 232, 5, 24); R(g, '#2e86c1', 136, 232, 5, 24); },
];

/** A name plaque (dark bronze capitals and a thin border; 256 × 64). */
function plaque(g, name, y, font) {
  g.save();
  g.translate(0, y);
  g.strokeStyle = 'rgba(70,50,30,0.9)'; g.lineWidth = 3;
  g.strokeRect(6, 6, 244, 52);
  g.fillStyle = '#3d2c1c';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  let s = 40;
  g.font = `${s}px "${font}", "Arial Black", sans-serif`;
  while (s > 14 && g.measureText(name).width > 226) { s -= 2; g.font = `${s}px "${font}", "Arial Black", sans-serif`; }
  g.fillText(name, 128, 34);
  g.restore();
}
