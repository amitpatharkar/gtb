import * as THREE from 'three';
import { Geo, POSE, person, hex, font, bentwoodChair, pedestalTable } from './kit.js';

// Khyaali & Co., an Irani café (fictional; the design is reusable for others): chequered
// floor, pista-green walls over dark wood panelling, mirrors, bentwood chairs at marble-top
// tables, glass biscuit jars on the counter, the owner at his till and a hand-painted board
// of rules. E at the counter: bun maska and chai.

const RULES = ['No credit', 'No combing hair', 'No discussing politics', 'No talking to cashier', 'No sitting long', 'No outside food', 'No change — give exact', 'No leg on chair', 'No free advice', 'No asking for WiFi'];
const MENU = [['Bun maska', 35], ['Brun maska', 40], ['Irani chai', 25], ['Mawa cake', 40], ['Kheema pav', 140], ['Akuri on toast', 110], ['Caramel custard', 70], ['Raspberry soda', 50]];

export function buildCafe(k, api) {
  const X = 4.5, Z = 12, H = 4.2;
  // Chequered floor: 45 cm cream and black tiles, a little worn.
  k.painted('floor', 0.9, 256, (g) => {
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      g.fillStyle = (i + j) % 2 ? '#e9e2d0' : '#2a2826'; g.fillRect(i * 128, j * 128, 128, 128);
    }
    for (let n = 0; n < 500; n++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,250,235' : '60,50,40'},${Math.random() * 0.12})`; g.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 5, 1 + Math.random() * 2); }
    g.strokeStyle = 'rgba(90,80,70,0.55)'; g.lineWidth = 2; g.strokeRect(0, 0, 128, 128); g.strokeRect(128, 128, 128, 128); g.strokeRect(128, 0, 128, 128); g.strokeRect(0, 128, 128, 128);
  }, { roughness: 0.32 });
  const PISTA = 0xbfd8b8, WOOD = 0x8a6a4a, DARK = 0x3a2416;
  k.room(-X, 0, X, Z, H, {
    tint: PISTA, ceilTint: 0xf2eee2,
    gaps: { s: [[X - 1.02, X + 1.02, 0, 2.52], [0.5, 3.1, 0.9, 3.1], [2 * X - 3.1, 2 * X - 0.5, 0.9, 3.1]], n: [[6.7, 7.9, 0, 2.2]] },
  });
  const wood = k.to('wood'), flat = k.to('flat'), satin = k.to('satin'), brass = k.to('brass'), glow = k.to('glow'), glass = k.to('glass'), mirror = k.to('mirror');

  // Dark wood panelling to shoulder height with a rail on top.
  for (const [x0, z0, x1, z1] of [[-X, 0, -X + 0.04, Z], [X - 0.04, 0, X, Z], [-X, Z - 0.04, 2.2, Z], [3.4, Z - 0.04, X, Z]]) {
    wood.span(x0, 0, z0, x1, 1.3, z1, WOOD);
    satin.span(x0 - 0.015, 1.3, z0 - 0.015, x1 + 0.015, 1.36, z1 + 0.015, DARK);
  }
  for (const [x0, x1] of [[-X, -1.02], [1.02, X]]) wood.span(x0, 0, 0, x1, 0.84, 0.04, WOOD);
  // Ceiling beams, fans' down-rods and milk-glass lamps.
  for (const z of [3, 6, 9]) wood.span(-X, H - 0.22, z - 0.1, X, H, z + 0.1, 0x6a4a30);
  for (const [x, z] of [[-2.2, 2.2], [2.2, 2.2], [-2.2, 5.2], [2.2, 5.2], [-2.2, 8.2], [2.2, 8.2]]) {
    brass.cyl(x, 3.25, z, 0.012, H - 3.25, 0xb08d3c, 5);
    glow.ball(x, 3.12, z, 0.16, [0xffe2b0, 3.4], 1, 10);
    brass.cyl(x, 3.24, z, 0.07, 0.05, 0xb08d3c, 8, 0.03);
  }
  k.lamp(0, 3.1, 2.4, 0xffd9a0, 14, 11); k.lamp(0, 3.1, 6.4, 0xffd9a0, 14, 11); k.lamp(-1.5, 3.0, 10, 0xffd9a0, 12, 9);

  // Street side: the door between two big windows of frosted panes in wooden frames.
  const spawn = k.exitDoor(0, 0, { frame: DARK, leaf: 0x55331c });
  for (const s of [-1, 1]) {
    const cx = s * 2.7;
    k.day().quad(cx, 2.0, -0.2, 2.6, 2.2, 0, 0xe8efe6);
    for (const x of [-1.3, -0.43, 0.43, 1.3]) satin.box(cx + x, 0.9, -0.15, 0.07, 2.2, 0.1, DARK);
    for (const y of [0.9, 2.2, 3.03]) satin.box(cx, y, -0.15, 2.67, 0.07, 0.1, DARK);
    satin.box(cx, 0.84, -0.02, 2.8, 0.06, 0.34, DARK); // sill
  }
  k.day().quad(0, 2.82, -0.2, 1.8, 0.5, 0, 0xe8efe6);

  // Mirrors in wooden frames along both walls.
  for (const s of [-1, 1]) for (const z of [2.6, 5.4, 8.2]) {
    if (s > 0 && z > 8) continue; // the rules board hangs there
    mirror.quad(s * (X - 0.05), 2.35, z, 1.5, 1.6, -s * Math.PI / 2, 0xaab4b0);
    satin.box(s * (X - 0.03), 1.5, z, 0.05, 0.07, 1.64, DARK); satin.box(s * (X - 0.03), 3.15, z, 0.05, 0.07, 1.64, DARK);
    satin.box(s * (X - 0.03), 1.5, z - 0.79, 0.05, 1.72, 0.07, DARK); satin.box(s * (X - 0.03), 1.5, z + 0.79, 0.05, 1.72, 0.07, DARK);
  }

  // Signs, all in one texture: the rules, the menu, old photographs, the wash-basin notice.
  const A = k.atlas('signs', 1024, 1024);
  const rules = A.draw(400, 600, (g, w, h) => {
    g.fillStyle = '#f3e7c6'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#7a1f1f'; g.lineWidth = 10; g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = '#7a1f1f'; g.textAlign = 'center'; g.font = font(40, 800);
    g.fillText('KHYAALI & CO.', w / 2, 62);
    g.font = font(30, 700); g.fillText('नियम · RULES', w / 2, 104);
    g.fillStyle = '#1c1a17'; g.font = font(30, 600); g.textAlign = 'left';
    RULES.forEach((r, i) => g.fillText(`${i + 1}. ${r}`, 34, 156 + i * 40));
    g.fillStyle = '#7a1f1f'; g.textAlign = 'center'; g.font = font(26, 700);
    g.fillText('All are welcome.', w / 2, h - 44); g.font = font(20, 500); g.fillText('— by order, Management', w / 2, h - 18);
  });
  k.to('signs').quad(X - 0.06, 2.35, 8.3, 1.1, 1.65, -Math.PI / 2, undefined, rules);
  satin.box(X - 0.03, 1.5, 8.3, 0.04, 1.72, 1.18, DARK);
  const menu = A.draw(480, 360, (g, w, h) => {
    g.fillStyle = '#1e2a24'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#8a6a44'; g.lineWidth = 12; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = '#f6f1dc'; g.textAlign = 'center'; g.font = font(34, 700); g.fillText('आजचा मेनू · MENU', w / 2, 52);
    g.font = font(27, 500);
    MENU.forEach(([name, price], i) => { g.textAlign = 'left'; g.fillText(name, 34, 100 + i * 31); g.textAlign = 'right'; g.fillText(`₹${price}`, w - 34, 100 + i * 31); });
    g.fillStyle = '#ffd36b'; g.textAlign = 'center'; g.font = font(24, 700); g.fillText('Bun maska + chai combo  ₹60', w / 2, h - 22);
  });
  k.to('signs').quad(0.9, 2.5, Z - 0.04, 1.6, 1.2, Math.PI, undefined, menu);
  // Sepia photographs of an older city (drawn, not real pictures).
  const photo = (seed) => A.draw(240, 180, (g, w, h) => {
    g.fillStyle = '#d9c49a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#b89c6c'; g.fillRect(0, h * 0.62, w, h);
    g.fillStyle = '#6b5333';
    for (let i = 0; i < 6; i++) { const bx = ((i * 53 + seed * 31) % 200), bh = 40 + ((i * 37 + seed * 17) % 60); g.fillRect(bx, h * 0.62 - bh, 34, bh); g.fillRect(bx + 12, h * 0.62 - bh - 14, 10, 14); }
    g.fillRect(20 + seed * 40, h * 0.7, 70, 22); g.fillRect(34 + seed * 40, h * 0.66, 40, 12); // a tram or a Victoria
    g.strokeStyle = '#3a2416'; g.lineWidth = 14; g.strokeRect(0, 0, w, h);
    g.strokeStyle = '#efe4c8'; g.lineWidth = 4; g.strokeRect(14, 14, w - 28, h - 28);
  });
  for (const [z, s] of [[4, 0], [6.8, 1]]) k.to('signs').quad(-X + 0.06, 2.3, z, 0.6, 0.45, Math.PI / 2, undefined, photo(s));
  k.to('signs').quad(X - 0.06, 2.3, 4, 0.6, 0.45, -Math.PI / 2, undefined, photo(2));
  const notice = A.draw(260, 90, (g, w, h) => {
    g.fillStyle = '#fbf6e6'; g.fillRect(0, 0, w, h); g.strokeStyle = '#1d3a5c'; g.lineWidth = 5; g.strokeRect(3, 3, w - 6, h - 6);
    g.fillStyle = '#1d3a5c'; g.textAlign = 'center'; g.font = font(22, 700); g.fillText('DO NOT COMB HAIR', w / 2, 36); g.fillText('IN WASH BASIN', w / 2, 66);
  });
  k.to('signs').quad(X - 0.06, 2.05, 1.0, 0.6, 0.21, -Math.PI / 2, undefined, notice);
  // The wash basin under it.
  satin.box(X - 0.28, 0.78, 1.0, 0.44, 0.14, 0.52, 0xf4f4f0); satin.box(X - 0.3, 0, 1.0, 0.14, 0.78, 0.14, 0xf4f4f0);
  brass.cyl(X - 0.1, 0.92, 1.0, 0.015, 0.16, 0xc8c8c8, 6);
  mirror.quad(X - 0.055, 1.55, 1.0, 0.4, 0.5, -Math.PI / 2, 0xaab4b0);
  k.solids.push([X - 0.52, 0.7, X, 1.3, false]);

  // Tables with marble tops, bentwood chairs.
  const tables = [], chairs = [], settings = [], seats = [];
  const spots = [[-3.1, 2.7, 2], [3.1, 3.2, 2], [-3.1, 5.3, 4], [0, 4.6, 4], [3.1, 5.8, 4], [-3.1, 7.9, 2], [0.6, 7.4, 4], [3.2, 8.5, 2]];
  for (const [tx, tz, n] of spots) {
    tables.push([tx, 0, tz]);
    k.posts.push([tx, tz, 0.38, false]);
    const around = n === 4 ? [[0.64, 0, -Math.PI / 2], [-0.64, 0, Math.PI / 2], [0, 0.64, Math.PI], [0, -0.64, 0]] : [[0.64, 0, -Math.PI / 2], [-0.64, 0, Math.PI / 2]];
    for (const [dx, dz, ry] of around) {
      chairs.push([tx + dx, 0, tz + dz, ry + (Math.random() - 0.5) * 0.25]);
      seats.push([tx + dx, tz + dz, ry]);
      k.posts.push([tx + dx, tz + dz, 0.2, false]);
    }
    if (Math.random() < 0.75) settings.push([tx + (Math.random() - 0.5) * 0.2, 0.757, tz + (Math.random() - 0.5) * 0.2, Math.random() * 6]);
  }
  k.instances(pedestalTable(0.72, 0xf1eee6, 0x1b1b1d), 'satin', tables);
  k.instances(bentwoodChair(DARK, 0x7a4a26), 'satin', chairs);
  // A glass of chai on a saucer and a buttered bun on a plate.
  const set = new Geo();
  set.add(new THREE.CylinderGeometry(0.07, 0.05, 0.012, 10).translate(-0.12, 0.006, 0.05), 0xf6f6f2);
  set.add(new THREE.CylinderGeometry(0.032, 0.026, 0.085, 8).translate(-0.12, 0.054, 0.05), 0xa8642c);
  set.add(new THREE.CylinderGeometry(0.1, 0.07, 0.012, 12).translate(0.1, 0.006, -0.04), 0xf6f6f2);
  set.add(new THREE.SphereGeometry(0.06, 8, 5).scale(1, 0.6, 1).translate(0.1, 0.045, -0.04), 0xc98a3c);
  k.instances(set.merge(), 'satin', settings, { cast: false });

  // The counter at the back: wood front, marble top, a glass case of cakes, biscuit jars, the till.
  const CZ = 9.75;
  wood.span(-4.2, 0, CZ - 0.32, -0.7, 1.02, CZ + 0.32, 0x9a7a58);
  satin.span(-4.25, 1.02, CZ - 0.38, -0.65, 1.07, CZ + 0.38, 0xefece4);
  satin.span(-4.2, 0, CZ - 0.34, -0.7, 0.1, CZ - 0.32, DARK);
  k.solids.push([-4.5, CZ - 0.4, -0.65, CZ + 0.4, false]);
  // Glass case with three shelves of cakes and buns.
  glass.span(-2.5, 1.07, CZ - 0.3, -0.8, 1.62, CZ + 0.3, 0xcfe4e0);
  satin.span(-2.52, 1.62, CZ - 0.32, -0.78, 1.65, CZ + 0.32, DARK);
  for (const y of [1.09, 1.34]) for (let i = 0; i < 9; i++) {
    const x = -2.4 + i * 0.19, c = [0xc98a3c, 0xe8c27a, 0x6b3b1e, 0xf2d6a0, 0xd9a05a][(i + (y > 1.2 ? 2 : 0)) % 5];
    if (i % 3 === 0) flat.box(x, y, CZ, 0.14, 0.09, 0.2, c); else flat.ball(x, y + 0.05, CZ + (i % 2 ? 0.08 : -0.08), 0.06, c, 0.7, 7);
  }
  // Biscuit jars with red lids.
  for (let i = 0; i < 5; i++) {
    const x = -4.0 + i * 0.3;
    flat.cyl(x, 1.07, CZ - 0.05, 0.095, 0.2, [0xd9b47a, 0xc98a3c, 0xe6d2a0, 0x8a5a34, 0xf0e0b8][i], 10);
    glass.cyl(x, 1.07, CZ - 0.05, 0.11, 0.27, 0xd8ebe6, 10);
    satin.cyl(x, 1.34, CZ - 0.05, 0.115, 0.03, 0xa3231f, 10);
  }
  // The till: a brass cash register.
  brass.box(-3.05, 1.07, CZ + 0.05, 0.36, 0.2, 0.34, 0xb08d3c); brass.box(-3.05, 1.27, CZ + 0.12, 0.3, 0.18, 0.16, 0xb08d3c);
  flat.box(-3.05, 1.29, CZ - 0.02, 0.26, 0.02, 0.14, 0x1c1c1c, 0);
  // Shelves behind: jars, tins and soda bottles.
  for (const y of [1.2, 1.75, 2.3]) {
    wood.span(-4.3, y, Z - 0.34, -0.9, y + 0.04, Z - 0.02, 0x7a5a3c);
    for (let i = 0; i < 16; i++) {
      const x = -4.15 + i * 0.21, r = (i * 7 + Math.round(y * 10)) % 5;
      if (r < 2) satin.cyl(x, y + 0.04, Z - 0.18, 0.06, 0.2 + r * 0.05, [0xb3261e, 0x1d5c8a, 0xd9a520, 0x2e7d4f][(i + r) % 4], 8);
      else if (r < 4) flat.box(x, y + 0.04, Z - 0.18, 0.13, 0.16 + r * 0.03, 0.13, [0xe9d8a6, 0x8c2f39, 0x33658a, 0xf6ae2d][(i + r) % 4]);
      else satin.cyl(x, y + 0.04, Z - 0.18, 0.035, 0.26, 0xd0306a, 6, 0.018);
    }
  }
  satin.box(-2.6, 2.95, Z - 0.03, 0.42, 0.42, 0.04, 0xf4f1e6); satin.box(-2.6, 3.15, Z - 0.05, 0.02, 0.16, 0.02, 0x111111, 0); // wall clock
  // Kitchen door (staff only) with a round window.
  wood.span(2.2, 0, Z + 0.02, 3.4, 2.2, Z + 0.08, 0xa5855f);
  satin.add(new THREE.CylinderGeometry(0.17, 0.17, 0.03, 14).rotateX(Math.PI / 2).translate(2.8, 1.5, Z + 0.01), 0x20262a); // porthole
  k.solids.push([2.1, Z - 0.1, 3.5, Z + 0.4, true]);

  // People: the owner behind his counter, a waiter, customers.
  const owner = k.add(person('office', -2.2, CZ + 0.95, Math.PI, POSE.STAND, { shirt: hex(0xf3f1ea), pants: hex(0x3a3a3e), hair: hex(0xc9c9c9), build: 'heavy', wear: ['oldclassy', 'bald', 'casual2'] }));
  const sit = (i, kind, extra) => { const [x, z, ry] = seats[i]; return k.add(person(kind, x, z, ry, POSE.SIT, { y: 0.04, ...extra })); };
  const guests = [sit(0, 'office'), sit(1, 'casual'), sit(4, 'sari'), sit(5, 'office'), sit(7, 'casual'), sit(11, 'casual'), sit(12, 'kid'), sit(17, 'office'), sit(19, 'sari')];
  // The waiter walks a round between the kitchen door and the tables.
  const route = [[2.8, 11.3], [1.7, 10.6], [1.7, 6.1], [-1.6, 6.3], [-1.7, 3.6], [1.6, 3.6], [1.7, 6.1], [1.7, 10.6]];
  const waiter = k.add(person('office', 2.8, 11.3, Math.PI, POSE.WALK, { shirt: hex(0xf5f5f0), pants: hex(0x1f1f24), speed: 1.1, wear: ['casual3', 'casual'] }));
  let leg = 0, pause = 0, sayT = 4, greeted = false, lingered = false;
  k.ticks.push((dt, a) => {
    // Waiter.
    if (pause > 0) { pause -= dt; waiter.pose = POSE.STAND; }
    else {
      const [tx, tz] = route[leg], dx = tx - waiter.lx, dz = tz - waiter.lz, d = Math.hypot(dx, dz);
      const blocked = Math.hypot(a.me.x - waiter.lx, a.me.z - waiter.lz) < 0.9;
      if (d < 0.15) { leg = (leg + 1) % route.length; if (leg % 2 === 0) pause = 1.5 + Math.random() * 2.5; }
      else if (!blocked) { waiter.lx += (dx / d) * 1.1 * dt; waiter.lz += (dz / d) * 1.1 * dt; waiter.heading = Math.atan2(dx, dz); waiter.phase += dt * 4.7; }
      waiter.pose = blocked ? POSE.STAND : POSE.WALK;
    }
    for (const p of guests) p.phase += dt;
    // The owner greets you, watches the rules, and everyone murmurs now and then.
    owner.heading = Math.atan2(a.me.x - owner.lx, a.me.z - owner.lz);
    if (!greeted && a.sinceEnter > 1.2) { greeted = true; a.say(owner, 'Aao dikra, aao! Baitho. Rules board padh lena.', 3.5); }
    if (!lingered && a.sinceEnter > 75) { lingered = true; a.say(owner, 'Rule number five, dikra: no sitting long!', 3.5); }
    sayT -= dt;
    if (sayT <= 0) {
      sayT = 7 + Math.random() * 8;
      const who = guests[Math.floor(Math.random() * guests.length)];
      if (Math.hypot(a.me.x - who.lx, a.me.z - who.lz) < 5) a.say(who, ['Ek paani kam chai!', 'Bun maska mein maska kam hai aaj.', 'Politics nahi, baba. Rule number three.', 'Mawa cake khatam hone se pehle le lo.', 'Yahan ki chai… bas, poocho mat.', 'Bill? Abhi toh baithe hain!'][Math.floor(Math.random() * 6)], 2.6);
    }
  });

  // E at the counter.
  k.spot(-2.3, CZ - 0.95, 1.7, 'E: bun maska + Irani chai (₹60)', (a) => {
    if (!a.buy(60, 'Bun maska + chai')) { a.say(owner, 'No credit, dikra. Rule number one.', 3); return; }
    a.state.eat(0.4); a.state.rest(0.1);
    a.say(owner, ['Ek bun maska, ek chai — garam garam!', 'Maska zyada lagaya hai, dikra. Khao.', 'Dunk karke khana. Rule nahi hai, par chahiye.'][Math.floor(Math.random() * 3)], 3.2);
    a.msg('Bun maska + Irani chai — ₹60. Soft bun, too much butter, sweet milky chai. Food up.');
  });

  return {
    spawn,
    ambient: [0xfff0d6, 0xc8b89c, 1.9], key: [0.1, 1, -0.4, 1.5, 0xfff1dc], env: 0.55, exposure: 0.95,
    sound: [0.07, 0.12, 0],
  };
}
