import * as THREE from 'three';
import { HOARDING } from './mesh/hoardingMesh.js';
import { facadeNight } from './facade.js';

// Hoardings: Mumbai's skyline of advertisements. One canvas atlas (4 × 8 cells, 2:1 each)
// holds 30 parody ads plus two steel cells; the tile worker puts boards on rooftops along
// busy streets (mesh/hoardingMesh.js). Every brand, film and star here is made up — the
// apps are the game's own (Kidhar, Bhookh, JhatPat, PayKaro), the films star its fictional
// actors. Humour through systems: read them while stuck in traffic.

const ADS = [
  { big: 'KIDHAR?', deva: 'किधर?', sub: 'Jidhar bolo, udhar.', foot: 'Cabs · Autos · XL — download today', bg: ['#5b1fa6', '#2a0d57'], accent: '#ffd200', art: 'phone' },
  { big: 'BHOOKH', deva: 'भूख लगी?', sub: '30 minute, ya vada pav free*', foot: '*Traffic conditions apply', bg: ['#f26a1b', '#b83a00'], accent: '#fff3d6', art: 'plate' },
  { big: 'JHATPAT', deva: 'झटपट', sub: 'Dhaniya bhi 10 minute mein', foot: 'Groceries · Milk · Midnight noodles', bg: ['#12a150', '#065a2b'], accent: '#eaff8f', art: 'bag' },
  { big: 'PAYKARO', sub: 'Chhutta nahi hai? Scan karo.', foot: 'UPI · Bills · Recharge', bg: ['#1463d8', '#0a2f78'], accent: '#ffffff', art: 'qr' },
  { big: 'SKYLINE HEIGHTS', sub: '2 & 3 BHK · Sea view*', foot: '*From the terrace, on a clear day. Possession: soon-ish.', bg: ['#0f2244', '#07101f'], accent: '#e3b54a', art: 'tower' },
  { big: 'LAKE BREEZE', sub: 'Powai · Sample flat ready', foot: 'Lake view · Crocodile view (seasonal)', bg: ['#0c6b78', '#063540'], accent: '#c9f2ee', art: 'tower' },
  { big: "SHARMA SIR'S CLASSES", deva: 'शर्मा सर', sub: 'Engineering Entrance · 99.9%ile*', foot: '*Of the students who got 99.9%ile', bg: ['#ffd400', '#f2a900'], fg: '#a1121c', accent: '#1b2a6e', art: 'cap' },
  { big: 'MANGALDAS JEWELLERS', sub: 'Shaadi ho ya EMI — sona zaroori hai', foot: 'Since 1927 · Zaveri Bazaar', bg: ['#5c0d1c', '#2b050c'], accent: '#f1c75b', art: 'ring' },
  { big: 'DIL KA SIGNAL', sub: 'ARMAAN RAIZADA', foot: 'In cinemas this Diwali', bg: ['#7a0c12', '#12060a'], accent: '#ffcf4d', art: 'figure', film: true },
  { big: 'INSPECTOR TOOFAN 3', sub: 'VIKRAM OBEROI', foot: 'Is baar toofan… traffic mein phansega', bg: ['#10294f', '#060b16'], accent: '#ff7a1a', art: 'figure', film: true },
  { big: 'PYAAR KI TRAIN', sub: '30th glorious year!', foot: 'Daily 12:15 · Mahaan Mandir Talkies', bg: ['#a8145a', '#3d0620'], accent: '#ffe08a', art: 'heart', film: true },
  { big: 'BOLO 6G', sub: 'Ab buffering bhi fast', foot: 'Unlimited baatein · ₹299', bg: ['#d81b78', '#6d0a3d'], accent: '#ffffff', art: 'waves' },
  { big: 'CHATTAN CEMENT', sub: 'Saas hil gayi, deewar nahi.', foot: 'Grade 53 · Mazboot rishte', bg: ['#8d9399', '#4b5055'], accent: '#e2231a', art: 'bricks' },
  { big: 'TIGER BANIYAN', sub: 'Garmi mein bhi hero', foot: '100% cotton · 0% tension', bg: ['#f4f1e8', '#d9d2bf'], fg: '#c21f1f', accent: '#1b1b1b', art: 'vest' },
  { big: 'LIMCY', sub: 'Nimbu jaisa. Par zyada.', foot: 'Thanda served here', bg: ['#b6e62a', '#4f9c12'], fg: '#0e4d1b', accent: '#ffffff', art: 'sun' },
  { big: 'CUTTING KING', deva: 'कटिंग किंग चाय', sub: 'Aadhi glass, poora maza', foot: 'Kadak · Meetha · Mumbai', bg: ['#8a4a12', '#3d1e06'], accent: '#ffc24a', art: 'cup' },
  { big: "DR. BATLIWALA'S DENTAL", sub: 'Smile please. EMI available.', foot: 'Opp. the Irani café, 1st floor', bg: ['#e9fbf8', '#aee6dd'], fg: '#0d6b63', accent: '#0d6b63', art: 'tooth' },
  { big: 'BANK OF BAWAAL', sub: 'Home loan 8.5%*', foot: '*Conditions the size of this hoarding apply', bg: ['#0c5a3a', '#04281a'], accent: '#f4d35e', art: 'coin' },
  { big: 'ZINDAGI BIMA', sub: 'Kyunki signal sab todte hain', foot: 'Insurance · Since forever', bg: ['#1b4fa8', '#0b2250'], accent: '#ffd200', art: 'umbrella' },
  { big: 'SAAS, BAHU AUR WI-FI', sub: 'Mon–Fri · 9 pm', foot: 'Only on Chitra TV', bg: ['#e2458b', '#7c1247'], accent: '#fff0a8', art: 'tv', film: true },
  { big: 'MUMBAI MAHARAJAS', sub: 'T20 Bawaal League', foot: 'Home matches at the stadium · Tickets on PayKaro', bg: ['#123e9c', '#081a45'], accent: '#f5c542', art: 'ball' },
  { big: 'RAPIDLY ENGLISH ACADEMY', sub: 'Speak English in 30 days', foot: 'Above Hotel Sai · Fees ₹999', bg: ['#ffffff', '#e8e8e8'], fg: '#c8102e', accent: '#1b2a6e', art: 'abc' },
  { big: 'RADIO BAWAAL 93.5', sub: 'Traffic mein bhi tension nahi', foot: 'Tune in · press N in your taxi', bg: ['#1a1a1a', '#000000'], accent: '#ffd200', art: 'waves' },
  { big: 'MAHANAGAR PALIKA', deva: 'स्वच्छ मुंबई, सुंदर मुंबई', sub: 'Kachra dabbe mein. Shehar dil mein.', foot: 'Issued in public interest', bg: ['#f2f7ee', '#cfe3c2'], fg: '#17603a', accent: '#17603a', art: 'bin' },
  { big: 'MUMBAI CITY POLICE', deva: 'हेल्मेट घाला', sub: 'Helmet pehno. Signal mat todo.', foot: 'Hum dekh rahe hain.', bg: ['#14234d', '#0a1126'], accent: '#ffd200', art: 'eyes' },
  { big: 'SONA-SONA MATTRESS', sub: 'Neend aisi, alarm bhi so jaye', foot: 'Factory outlet · Lower Parel', bg: ['#2b2a6b', '#0f0e2e'], accent: '#f6e7a1', art: 'moon' },
  { big: 'CHAMAK DETERGENT', sub: 'Daag? Kaunsa daag?', foot: 'Now with extra chamak', bg: ['#1fb7d6', '#0b6f8a'], accent: '#ffffff', art: 'sparkle' },
  { big: 'HANDA AKTIVA', sub: 'Mileage ka maharaja', foot: 'Showroom: Linking Road', bg: ['#c8102e', '#6b0718'], accent: '#ffffff', art: 'scooter' },
  { big: 'MAROTI SWYFT', sub: 'Petrol kam, bawaal zyada', foot: 'On-road price: mat poochho', bg: ['#dfe4ea', '#9aa5b1'], fg: '#12356b', accent: '#c8102e', art: 'car' },
  { big: 'RANGEELA PICHKARI', deva: 'होली है!', sub: 'Bura na mano, Holi hai!', foot: 'Tank 2 litre · Range 12 metre', bg: ['#ff5aa5', '#7a2bd6'], accent: '#fff36b', art: 'splats' },
];

/** Small pictures made of plain shapes, in the right-hand third of an ad. */
function drawArt(g, kind, cx, cy, s, col, rnd) {
  g.save();
  g.translate(cx, cy);
  g.fillStyle = col; g.strokeStyle = col; g.lineWidth = s * 0.07; g.lineCap = 'round'; g.lineJoin = 'round';
  const circle = (x, y, r, fill = true) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); fill ? g.fill() : g.stroke(); };
  const rr = (x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
  switch (kind) {
    case 'phone': rr(-s * 0.3, -s * 0.55, s * 0.6, s * 1.1, s * 0.08); g.stroke(); circle(0, -s * 0.05, s * 0.12); g.beginPath(); g.moveTo(-s * 0.1, s * 0.02); g.lineTo(0, s * 0.3); g.lineTo(s * 0.1, s * 0.02); g.fill(); break;
    case 'plate': circle(0, 0, s * 0.5, false); circle(0, 0, s * 0.32); break;
    case 'bag': rr(-s * 0.38, -s * 0.25, s * 0.76, s * 0.75, s * 0.06); g.fill(); g.beginPath(); g.arc(0, -s * 0.25, s * 0.2, Math.PI, 0); g.stroke(); break;
    case 'qr': for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) if (rnd() < 0.55 || (i < 2 && j < 2) || (i > 3 && j < 2) || (i < 2 && j > 3)) g.fillRect(-s * 0.5 + i * s * 0.17, -s * 0.5 + j * s * 0.17, s * 0.14, s * 0.14); break;
    case 'tower': g.fillRect(-s * 0.32, -s * 0.6, s * 0.3, s * 1.15); g.fillRect(s * 0.04, -s * 0.3, s * 0.3, s * 0.85); g.fillStyle = 'rgba(0,0,0,0.35)'; for (let y = 0; y < 9; y++) { g.fillRect(-s * 0.27, -s * 0.54 + y * s * 0.12, s * 0.2, s * 0.05); if (y > 2) g.fillRect(s * 0.09, -s * 0.54 + y * s * 0.12, s * 0.2, s * 0.05); } break;
    case 'cap': g.beginPath(); g.moveTo(-s * 0.55, -s * 0.1); g.lineTo(0, -s * 0.35); g.lineTo(s * 0.55, -s * 0.1); g.lineTo(0, s * 0.15); g.closePath(); g.fill(); g.fillRect(-s * 0.25, s * 0.05, s * 0.5, s * 0.25); break;
    case 'ring': circle(0, s * 0.12, s * 0.36, false); g.beginPath(); g.moveTo(-s * 0.16, -s * 0.3); g.lineTo(0, -s * 0.55); g.lineTo(s * 0.16, -s * 0.3); g.lineTo(0, -s * 0.16); g.closePath(); g.fill(); break;
    case 'figure': circle(0, -s * 0.32, s * 0.2); g.beginPath(); g.moveTo(-s * 0.48, s * 0.6); g.quadraticCurveTo(-s * 0.45, -s * 0.06, 0, -s * 0.08); g.quadraticCurveTo(s * 0.45, -s * 0.06, s * 0.48, s * 0.6); g.closePath(); g.fill(); break;
    case 'heart': g.beginPath(); g.moveTo(0, s * 0.42); g.bezierCurveTo(-s * 0.8, -s * 0.1, -s * 0.3, -s * 0.6, 0, -s * 0.2); g.bezierCurveTo(s * 0.3, -s * 0.6, s * 0.8, -s * 0.1, 0, s * 0.42); g.fill(); break;
    case 'waves': for (let i = 1; i <= 3; i++) { g.beginPath(); g.arc(-s * 0.35, s * 0.3, s * 0.28 * i, -Math.PI / 2, 0); g.stroke(); } circle(-s * 0.35, s * 0.3, s * 0.08); break;
    case 'bricks': for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) g.fillRect(-s * 0.55 + c * s * 0.38 + (r % 2) * s * 0.19 - s * 0.1, -s * 0.4 + r * s * 0.22, s * 0.34, s * 0.18); break;
    case 'vest': g.beginPath(); g.moveTo(-s * 0.32, -s * 0.5); g.lineTo(-s * 0.16, -s * 0.5); g.quadraticCurveTo(0, -s * 0.1, s * 0.16, -s * 0.5); g.lineTo(s * 0.32, -s * 0.5); g.lineTo(s * 0.36, s * 0.55); g.lineTo(-s * 0.36, s * 0.55); g.closePath(); g.fill(); break;
    case 'sun': circle(0, 0, s * 0.3); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(a) * s * 0.4, Math.sin(a) * s * 0.4); g.lineTo(Math.cos(a) * s * 0.55, Math.sin(a) * s * 0.55); g.stroke(); } break;
    case 'cup': g.beginPath(); g.moveTo(-s * 0.28, -s * 0.4); g.lineTo(s * 0.28, -s * 0.4); g.lineTo(s * 0.2, s * 0.45); g.lineTo(-s * 0.2, s * 0.45); g.closePath(); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = s * 0.04; for (const x of [-0.1, 0.08]) { g.beginPath(); g.moveTo(s * x, -s * 0.5); g.quadraticCurveTo(s * (x + 0.1), -s * 0.62, s * x, -s * 0.74); g.stroke(); } break;
    case 'tooth': rr(-s * 0.3, -s * 0.45, s * 0.6, s * 0.6, s * 0.2); g.fill(); g.beginPath(); g.moveTo(-s * 0.26, 0); g.lineTo(-s * 0.14, s * 0.5); g.lineTo(-s * 0.02, s * 0.1); g.lineTo(s * 0.02, s * 0.1); g.lineTo(s * 0.14, s * 0.5); g.lineTo(s * 0.26, 0); g.fill(); break;
    case 'coin': circle(0, 0, s * 0.42, false); g.font = `bold ${s * 0.6}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('₹', 0, s * 0.03); break;
    case 'umbrella': g.beginPath(); g.arc(0, 0, s * 0.5, Math.PI, 0); g.closePath(); g.fill(); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, s * 0.45); g.arc(-s * 0.08, s * 0.45, s * 0.08, 0, Math.PI); g.stroke(); break;
    case 'tv': rr(-s * 0.5, -s * 0.35, s, s * 0.65, s * 0.06); g.stroke(); g.beginPath(); g.moveTo(-s * 0.2, s * 0.45); g.lineTo(s * 0.2, s * 0.45); g.stroke(); circle(0, -s * 0.03, s * 0.12); break;
    case 'ball': circle(0, 0, s * 0.36); g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = s * 0.03; g.beginPath(); g.arc(-s * 0.5, 0, s * 0.6, -0.55, 0.55); g.stroke(); g.beginPath(); g.arc(s * 0.5, 0, s * 0.6, Math.PI - 0.55, Math.PI + 0.55); g.stroke(); break;
    case 'abc': g.font = `bold ${s * 0.6}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Aa', 0, -s * 0.1); g.font = `bold ${s * 0.28}px sans-serif`; g.fillText('→ अ', 0, s * 0.36); break;
    case 'bin': g.fillRect(-s * 0.26, -s * 0.2, s * 0.52, s * 0.66); g.fillRect(-s * 0.34, -s * 0.34, s * 0.68, s * 0.1); g.fillRect(-s * 0.1, -s * 0.44, s * 0.2, s * 0.1); break;
    case 'eyes': for (const x of [-0.26, 0.26]) { g.beginPath(); g.ellipse(s * x, 0, s * 0.22, s * 0.14, 0, 0, Math.PI * 2); g.stroke(); circle(s * x, 0, s * 0.08); } break;
    case 'moon': circle(0, 0, s * 0.4); g.globalCompositeOperation = 'destination-out'; circle(s * 0.18, -s * 0.1, s * 0.34); g.globalCompositeOperation = 'source-over'; break;
    case 'sparkle': for (const [x, y, k] of [[0, 0, 1], [s * 0.38, -s * 0.36, 0.45], [-s * 0.36, s * 0.3, 0.5]]) { g.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, r = (i % 2 ? 0.1 : 0.4) * s * k; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); g.fill(); } break;
    case 'scooter': circle(-s * 0.36, s * 0.3, s * 0.16, false); circle(s * 0.38, s * 0.3, s * 0.16, false); g.beginPath(); g.moveTo(-s * 0.36, s * 0.3); g.lineTo(-s * 0.2, -s * 0.05); g.lineTo(s * 0.15, -s * 0.05); g.lineTo(s * 0.2, s * 0.3); g.moveTo(s * 0.38, s * 0.3); g.lineTo(s * 0.25, -s * 0.35); g.lineTo(s * 0.1, -s * 0.35); g.stroke(); break;
    case 'car': rr(-s * 0.55, -s * 0.02, s * 1.1, s * 0.3, s * 0.08); g.fill(); g.beginPath(); g.moveTo(-s * 0.32, 0); g.lineTo(-s * 0.2, -s * 0.26); g.lineTo(s * 0.18, -s * 0.26); g.lineTo(s * 0.34, 0); g.closePath(); g.fill(); g.fillStyle = '#16181c'; circle(-s * 0.32, s * 0.28, s * 0.13); circle(s * 0.32, s * 0.28, s * 0.13); break;
    case 'splats': for (const c of ['#22d3ee', '#fde047', '#4ade80', '#fb923c']) { g.fillStyle = c; const x = (rnd() - 0.5) * s * 0.9, y = (rnd() - 0.5) * s * 0.9; circle(x, y, s * (0.14 + rnd() * 0.12)); for (let i = 0; i < 5; i++) circle(x + (rnd() - 0.5) * s * 0.5, y + (rnd() - 0.5) * s * 0.5, s * 0.04); } break;
    default: break;
  }
  g.restore();
}

function fit(g, text, x, y, maxW, size, weight, family, align = 'left') {
  let s = size;
  g.textAlign = align;
  do { g.font = `${weight} ${s}px ${family}`; s -= 2; } while (s > 10 && g.measureText(text).width > maxW);
  g.fillText(text, x, y);
}

/** The ad atlas: { texture, redraw(fontFamilies) }. Drawn once fonts are in (or after a moment). */
export function makeHoardingAtlas() {
  const W = 2048, H = 2048, cw = W / HOARDING.COLS, ch = H / HOARDING.ROWS;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g0 = c.getContext('2d');
  g0.fillStyle = '#8a8f96'; g0.fillRect(0, 0, W, H);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const draw = (families = {}) => {
    const g = c.getContext('2d');
    let seed = 41;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const q = (f) => (f ? `"${f}", ` : '');
    const head = [`${q(families.latin2)}"Arial Black", Impact, sans-serif`, `${q(families.latin3)}Impact, "Arial Black", sans-serif`, `${q(families.latin1)}"Arial Black", sans-serif`];
    const body = `${q(families.latin3)}"Arial Narrow", Arial, sans-serif`;
    const deva = `${q(families.deva)}sans-serif`;
    ADS.forEach((ad, i) => {
      const x = (i % HOARDING.COLS) * cw, y = Math.floor(i / HOARDING.COLS) * ch;
      g.save();
      g.beginPath(); g.rect(x, y, cw, ch); g.clip();
      const grad = g.createLinearGradient(x, y, x + cw, y + ch);
      grad.addColorStop(0, ad.bg[0]); grad.addColorStop(1, ad.bg[1]);
      g.fillStyle = grad; g.fillRect(x, y, cw, ch);
      const fg = ad.fg || '#ffffff';
      // A soft disc behind the picture, then the picture.
      g.globalAlpha = 0.16; g.fillStyle = ad.accent; g.beginPath(); g.arc(x + cw * 0.83, y + ch * 0.44, ch * 0.5, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
      drawArt(g, ad.art, x + cw * 0.83, y + ch * 0.44, ch * 0.42, ad.accent, rnd);
      g.textBaseline = 'middle';
      const left = x + cw * 0.045, textW = cw * 0.62;
      let ty = y + ch * (ad.deva ? 0.17 : 0.2);
      if (ad.deva) { g.fillStyle = ad.accent; fit(g, ad.deva, left, ty, textW, 44, '700', deva); ty += ch * 0.24; }
      if (ad.film) { g.fillStyle = ad.accent; fit(g, ad.sub, left, ty - ch * 0.02, textW, 30, '700', body); ty += ch * 0.22; }
      g.fillStyle = fg;
      g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 6; g.shadowOffsetY = 2;
      fit(g, ad.big, left, ty + ch * 0.05, textW, ad.deva || ad.film ? 62 : 74, '900', head[i % head.length]);
      g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetY = 0;
      if (!ad.film) { g.fillStyle = ad.accent; fit(g, ad.sub, left, ty + ch * (ad.deva ? 0.27 : 0.33), textW, 34, '700', body); }
      // Foot strip.
      g.fillStyle = 'rgba(0,0,0,0.42)'; g.fillRect(x, y + ch * 0.84, cw, ch * 0.16);
      g.fillStyle = '#ffffff'; fit(g, ad.foot, left, y + ch * 0.925, cw * 0.9, 22, '600', body);
      // Poster edge and a little weather.
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 6; g.strokeRect(x + 3, y + 3, cw - 6, ch - 6);
      g.fillStyle = `rgba(70,60,45,${0.04 + rnd() * 0.08})`; g.fillRect(x, y, cw, ch);
      for (let k = 0; k < 3; k++) { g.fillStyle = `rgba(40,35,28,${0.03 + rnd() * 0.05})`; g.fillRect(x + rnd() * cw, y, 6 + rnd() * 22, ch * (0.3 + rnd() * 0.7)); }
      g.restore();
    });
    // Steel: a lattice for the back of the boards, plain for posts and edges.
    for (const [cellIdx, lattice] of [[HOARDING.BACK, true], [HOARDING.STEEL, false]]) {
      const x = (cellIdx % HOARDING.COLS) * cw, y = Math.floor(cellIdx / HOARDING.COLS) * ch;
      g.fillStyle = lattice ? '#5b6066' : '#666b71'; g.fillRect(x, y, cw, ch);
      if (!lattice) continue;
      g.strokeStyle = '#3c4045'; g.lineWidth = 7;
      for (let k = 0; k <= 8; k++) { g.beginPath(); g.moveTo(x + (k / 8) * cw, y); g.lineTo(x + (k / 8) * cw, y + ch); g.stroke(); }
      for (let k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(x, y + (k / 4) * ch); g.lineTo(x + cw, y + (k / 4) * ch); g.stroke(); }
      g.lineWidth = 3; g.strokeStyle = '#484d53';
      for (let k = 0; k < 8; k++) { g.beginPath(); g.moveTo(x + (k / 8) * cw, y); g.lineTo(x + ((k + 1) / 8) * cw, y + ch); g.stroke(); }
      g.fillStyle = 'rgba(120,70,40,0.18)'; for (let k = 0; k < 14; k++) g.fillRect(x + rnd() * cw, y + rnd() * ch, 10 + rnd() * 40, 4 + rnd() * 30); // rust
    }
    tex.needsUpdate = true;
  };
  // Without the sign fonts (no media library), still draw — a moment after start-up.
  const idle = window.requestIdleCallback || ((f) => setTimeout(f, 1500));
  let drawn = false;
  idle(() => { if (!drawn) draw(); });
  return { texture: tex, redraw: (families) => { drawn = true; draw(families); } };
}

/** Board material: the printed vinyl, floodlit after dark (follows the facade night value). */
export function makeHoardingMaterial(texture) {
  const mat = new THREE.MeshStandardMaterial({ map: texture, emissiveMap: texture, emissive: 0xffffff, emissiveIntensity: 0.7, roughness: 0.75, metalness: 0, vertexColors: true });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = facadeNight;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance *= 0.14 + uNight; // printed vinyl never goes as dark as a wall in shade');
  };
  return mat;
}
