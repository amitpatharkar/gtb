import * as THREE from 'three';
import { Y } from './levels.js';

// Facade shader: real wall textures (plaster, stone, concrete…) plus procedural Mumbai
// facade details computed per pixel — windows with reflective glass, curtains, grilles,
// balconies with clothes drying, AC units, sunshades (chajjas), monsoon stains, floor
// bands, plinths, roof parapets, and ground-floor shops with shutters and signboards.
//
// Per-vertex inputs (see src/world/mesh/buildings.js):
//   uv              x = metres along the wall, y = height in metres (also drives the textures)
//   facadeBay       running bay (window column) coordinate along each wall
//   facadeA         style + 0.5, seed, storey height, roof height
//   facadeShop      1 = ground-floor shops on this wall, 2 = blank wall (no windows)

const STYLE_GLSL = `
  // style: 0 plaster, 1 weathered, 2 deco, 3 stone, 4 basalt, 5 concrete, 6 glass, 7 shed, 8 brick
  vec4 windowRect(float st) {        // x0, x1, y0, y1 inside one bay × storey cell
    if (st < 0.5) return vec4(0.24, 0.76, 0.30, 0.80);
    if (st < 1.5) return vec4(0.27, 0.73, 0.32, 0.79);
    if (st < 2.5) return vec4(0.10, 0.90, 0.34, 0.74);
    if (st < 4.5) return vec4(0.30, 0.70, 0.18, 0.84);
    if (st < 5.5) return vec4(0.14, 0.86, 0.30, 0.80);
    if (st < 6.5) return vec4(0.03, 0.97, 0.10, 0.94);
    return vec4(0.30, 0.70, 0.35, 0.75);
  }
`;

const HELPERS = `
  float fHash(vec2 p) { p = fract(p * vec2(234.34, 435.345)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
  float fBox(vec2 p, vec4 r) { return step(r.x, p.x) * step(p.x, r.y) * step(r.z, p.y) * step(p.y, r.w); }
  float fBand(float v, float a, float b) { return step(a, v) * step(v, b); }
`;

export function makeFacadeMaterial(signAtlas) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  mat.userData.signs = { value: signAtlas };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.tSigns = mat.userData.signs;
    shader.uniforms.uNight = facadeNight;
    shader.uniforms.uFacadeDebug = facadeDebug;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float facadeBay; attribute vec4 facadeA; attribute float facadeShop;
        varying vec2 vFacadeP; varying float vBay; flat varying vec4 vFacadeA; flat varying float vShop;`)
      .replace('#include <uv_vertex>', `#include <uv_vertex>
        vFacadeP = uv; vBay = facadeBay; vFacadeA = facadeA; vShop = facadeShop;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec2 vFacadeP; varying float vBay; flat varying vec4 vFacadeA; flat varying float vShop;
        uniform sampler2D tSigns; uniform float uNight; uniform float uFacadeDebug;
        vec3 dbgColor = vec3(0.0);
        ${HELPERS}
        ${STYLE_GLSL}`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        float flatNormal = 0.0;
        vec3 facadeEmissive = vec3(0.0);
        {
          float st = vFacadeA.x - 0.5;
          float seed = floor(vFacadeA.y * 997.0) / 997.0;  // per-building constant (flat), quantised for stable hashing
          float storey = vFacadeA.z;
          float roofY = vFacadeA.w;
          float shop = vShop;
          float y = vFacadeP.y - ${Y.KERB.toFixed(2)};
          // Painted walls take the building's paint colour; the photo texture keeps its grain.
          if (st < 2.5 || st > 4.5 && st < 5.5) {
            vec3 texel = diffuseColor.rgb / max(vColor.rgb, vec3(0.02));
            float L = dot(texel, vec3(0.3, 0.59, 0.11));
            diffuseColor.rgb = mix(diffuseColor.rgb, L * 1.45 * vColor.rgb, st > 0.5 && st < 1.5 ? 0.55 : 0.85);
          }
          vec3 wallC = diffuseColor.rgb;

          // Rising damp and dirt near the ground, darker plinth.
          diffuseColor.rgb *= mix(0.72, 1.0, smoothstep(0.0, 1.6, y));
          if (y < 0.45) diffuseColor.rgb *= 0.78;

          // Parapet coping at the roof edge.
          if (vFacadeP.y > roofY + 0.78 && vFacadeP.y < roofY + 0.9) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.76, 0.72), 0.6);

          bool windows = shop < 1.5 && st < 6.5 && vFacadeP.y < roofY - 0.3 && y > 0.0;
          float gf = shop > 0.5 ? max(storey, 4.3) : 0.0;     // shop storey height

          if (windows && shop > 0.5 && y < gf) {
            // ---------- ground-floor shop
            float unit = floor(vBay);
            float lx = fract(vBay);
            float su = fHash(vec2(unit, seed * 97.0));
            float pillar = 1.0 - step(0.06, lx) * step(lx, 0.94);
            if (pillar < 0.5) {
              float signTop = gf - 0.2, signBot = gf - 1.15;
              if (y > signBot && y < signTop) {
                // Signboard from the generated atlas (8 × 16 boards).
                float idx = floor(su * 128.0);
                vec2 cell = vec2(mod(idx, 8.0), floor(idx / 8.0));
                vec2 suv = vec2((lx - 0.06) / 0.88, (y - signBot) / (signTop - signBot));
                vec4 sc = texture2D(tSigns, (cell + suv) / vec2(8.0, 16.0));
                diffuseColor.rgb = sc.rgb * 0.9;
                roughnessFactor = 0.45;
                flatNormal = 1.0;
                facadeEmissive = sc.rgb * uNight * step(0.5, fract(su * 13.0)) * 0.9;
              } else if (y > 0.22 && y < signBot - 0.05) {
                bool open = fract(su * 7.0) < 0.72;
                if (open) {
                  // Open shop: dark interior with goods and a warm tube light.
                  float shelf = fBand(fract((y - 0.2) / 0.55), 0.0, 0.12);
                  vec3 goods = vec3(fHash(vec2(floor(lx * 9.0), unit)), fHash(vec2(unit, floor(lx * 9.0))), fHash(vec2(floor(lx * 9.0) + 3.0, unit + 7.0)));
                  diffuseColor.rgb = mix(vec3(0.05, 0.045, 0.04), goods * 0.35, 0.55 * step(0.6, y) * (1.0 - shelf));
                  roughnessFactor = 0.9;
                  flatNormal = 1.0;
                  facadeEmissive = vec3(1.0, 0.85, 0.6) * (0.06 + 0.5 * uNight) * smoothstep(signBot - 0.6, signBot - 0.05, y);
                } else {
                  // Rolling shutter, painted grey/green/blue, ribbed.
                  vec3 sh = fract(su * 31.0) < 0.4 ? vec3(0.42, 0.44, 0.45) : fract(su * 31.0) < 0.7 ? vec3(0.22, 0.38, 0.30) : vec3(0.24, 0.32, 0.48);
                  float rib = 0.82 + 0.18 * sin(y * 70.0);
                  diffuseColor.rgb = sh * rib * (0.75 + 0.25 * fHash(vec2(floor(y * 3.0), unit)));
                  roughnessFactor = 0.55;
                  metalnessFactor = 0.35;
                  flatNormal = 1.0;
                }
              } else if (y <= 0.22) {
                diffuseColor.rgb = vec3(0.5, 0.48, 0.45);
              }
            }
          } else if (windows) {
            // ---------- upper storeys: one window per bay × storey cell
            float fy = (y - gf) / storey;
            float row = floor(fy);
            float ly = fract(fy);
            float col = floor(vBay);
            float lx = fract(vBay);
            vec2 id = vec2(col, row) + seed * 113.0;
            float h1 = fHash(id), h2 = fHash(id + 17.3), h3 = fHash(id + 41.7);
            vec4 r = windowRect(st);
            float inWin = fBox(vec2(lx, ly), r);
            // Gothic stone: pointed arch top.
            if (st > 2.5 && st < 4.5 && ly > 0.68) inWin *= step(abs(lx - 0.5), 0.2 * sqrt(max(0.0, (r.w - ly) / (r.w - 0.68))));
            bool balcony = (st < 1.5 || st > 4.5 && st < 5.5) && h3 < 0.22 && row > -0.5;
            float frameW = 0.035;

            // Floor bands (Art Deco gets bold horizontal bands).
            float band = st > 1.5 && st < 2.5 ? fBand(ly, 0.0, 0.09) : st > 5.5 && st < 6.5 ? fBand(ly, 0.0, 0.08) : fBand(ly, 0.0, 0.035);
            diffuseColor.rgb *= 1.0 - band * (st > 1.5 && st < 2.5 ? -0.08 : 0.12);
            if (st > 5.5 && st < 6.5) {
              // Glass curtain wall: spandrels at floor lines, mullions between panes.
              float mull = 1.0 - fBand(lx, 0.03, 0.97);
              if (band > 0.5 || mull > 0.5) { diffuseColor.rgb = vec3(0.32, 0.33, 0.34); roughnessFactor = 0.4; metalnessFactor = 0.6; flatNormal = 1.0; }
              else {
                diffuseColor.rgb = wallC * 0.35;
                roughnessFactor = 0.04 + 0.05 * h2;
                metalnessFactor = 0.65;
                flatNormal = 1.0;
                facadeEmissive = vec3(1.0, 0.92, 0.75) * uNight * step(0.55, h1) * 0.35;
              }
            } else if (balcony) {
              // Recessed balcony: shadowed interior, railing, clothes drying.
              float inB = fBox(vec2(lx, ly), vec4(0.08, 0.92, 0.06, 0.92));
              if (inB > 0.5) {
                diffuseColor.rgb = wallC * 0.32;
                float rail = step(ly, 0.42) * (step(0.75, fract(lx * 24.0)) + fBand(ly, 0.38, 0.42));
                if (rail > 0.5) diffuseColor.rgb = vec3(0.12, 0.12, 0.12);
                float cloth = fBand(ly, 0.48, 0.74) * step(0.45, h2) * step(0.35, fract(lx * 5.0 + h1));
                if (cloth > 0.5) diffuseColor.rgb = vec3(fHash(id + floor(lx * 5.0)), fHash(id + 3.0 + floor(lx * 5.0)), fHash(id + 9.0 + floor(lx * 5.0))) * 0.75 + 0.1;
                roughnessFactor = 0.9;
                flatNormal = 1.0;
                facadeEmissive = vec3(1.0, 0.8, 0.55) * uNight * step(0.6, h1) * 0.25 * step(0.45, ly);
              }
            } else if (inWin > 0.5) {
              float frame = 1.0 - fBox(vec2(lx, ly), r + vec4(frameW, -frameW, frameW, -frameW));
              float mid = fBand(lx, 0.5 * (r.x + r.y) - 0.012, 0.5 * (r.x + r.y) + 0.012);
              if (frame > 0.5 || mid > 0.5 && st < 2.5) {
                diffuseColor.rgb = st > 2.5 && st < 4.5 ? vec3(0.28, 0.22, 0.16) : vec3(0.82, 0.8, 0.76);
                roughnessFactor = 0.6;
              } else {
                // Glass: dark interior, sharp sky reflections; sometimes curtains.
                vec3 curtain = vec3(0.6 + 0.3 * h2, 0.45 + 0.3 * h3, 0.3 + 0.4 * h1);
                bool cur = h1 < 0.4;
                diffuseColor.rgb = cur ? curtain * 0.45 : vec3(0.025, 0.03, 0.035);
                roughnessFactor = cur ? 0.25 : 0.04;
                flatNormal = 1.0;
                // Rusty grilles on chawl windows.
                if ((st > 0.5 && st < 1.5 || h2 < 0.25) && step(0.82, fract(lx * 18.0)) + fBand(fract(ly * 4.0), 0.0, 0.08) > 0.5) {
                  diffuseColor.rgb = vec3(0.16, 0.1, 0.07);
                  roughnessFactor = 0.8;
                }
                facadeEmissive = (cur ? curtain : vec3(1.0, 0.86, 0.62)) * uNight * step(0.5, h3) * 0.45;
              }
            } else {
              // Wall around the window: sunshade (chajja) above, sill below, AC unit, monsoon streaks.
              float top = r.w;
              if (st < 2.5 || st > 4.5) {
                if (fBand(ly, top + 0.015, top + 0.07) * fBand(lx, r.x - 0.06, r.y + 0.06) > 0.5) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.7, 0.68, 0.64), 0.6);
              }
              float streak = fBand(lx, r.x, r.y) * step(ly, r.z) * smoothstep(0.0, r.z, ly) * fHash(vec2(floor(lx * 23.0), col + seed));
              diffuseColor.rgb *= 1.0 - 0.35 * streak * (st < 1.5 ? 1.0 : 0.5);
              if (st < 2.5 || st > 4.5 && st < 5.5) {
                float ac = fBox(vec2(lx, ly), vec4(r.y + 0.03, r.y + 0.24, 0.33, 0.52)) * step(h2, 0.38);
                if (ac > 0.5) {
                  diffuseColor.rgb = vec3(0.78, 0.78, 0.76) * (0.85 + 0.15 * step(0.5, fract(ly * 40.0)));
                  roughnessFactor = 0.5;
                  flatNormal = 1.0;
                }
                float acShadow = fBox(vec2(lx, ly), vec4(r.y + 0.03, r.y + 0.24, 0.26, 0.33)) * step(h2, 0.38);
                diffuseColor.rgb *= 1.0 - 0.35 * acShadow;
              }
            }
          }
        }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        if (flatNormal > 0.5) normal = normalize(vNormal) * faceDirection;
        if (uFacadeDebug > 0.5 && uFacadeDebug < 1.5) dbgColor = diffuseColor.rgb;
        if (uFacadeDebug > 1.5 && uFacadeDebug < 2.5) dbgColor = vec3(roughnessFactor);
        if (uFacadeDebug > 2.5 && uFacadeDebug < 3.5) dbgColor = normal * 0.5 + 0.5;
        if (uFacadeDebug > 3.5) dbgColor = vec3(fract(vBay), fract(vFacadeP.y / 3.2), flatNormal);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += facadeEmissive;`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        if (uFacadeDebug > 0.5) gl_FragColor = vec4(dbgColor, 1.0);`);
  };
  mat.customProgramCacheKey = () => 'gtb-facade-v1';
  return mat;
}

/** Debug view: 1 albedo, 2 roughness, 3 normal, 4 window grid. */
export const facadeDebug = { value: 0 };

/** 0 = day, 1 = night: lit windows, signs and shop interiors (driven by the clock). */
export const facadeNight = { value: 0 };

// ------------------------------------------------------------------ shop signboards

const PREFIX = [['Shree', 'श्री'], ['New', 'न्यू'], ['Bombay', 'बॉम्बे'], ['Royal', 'रॉयल'], ['Laxmi', 'लक्ष्मी'], ['Ganesh', 'गणेश'],
  ['Jai Hind', 'जय हिंद'], ['Famous', 'फेमस'], ['Krishna', 'कृष्ण'], ['Sai', 'साई'], ['Mahalaxmi', 'महालक्ष्मी'], ['Apna', 'अपना'],
  ['Mumbai', 'मुंबई'], ['Kohinoor', 'कोहिनूर'], ['Noor', 'नूर'], ['Zaveri', 'झवेरी'], ['Parsi', 'पारसी'], ['Gokul', 'गोकुळ']];
const TYPE = [['Stores', 'स्टोर्स'], ['Chemists', 'केमिस्ट'], ['Tailors', 'टेलर्स'], ['Jewellers', 'ज्वेलर्स'], ['Sweets', 'स्वीट्स'],
  ['Bakery', 'बेकरी'], ['Electricals', 'इलेक्ट्रिकल्स'], ['Medical', 'मेडिकल'], ['Hardware', 'हार्डवेअर'], ['Cafe', 'कॅफे'],
  ['Restaurant', 'रेस्टॉरंट'], ['Bhandar', 'भांडार'], ['Opticians', 'ऑप्टिशियन्स'], ['Footwear', 'फुटवेअर'], ['Stationery', 'स्टेशनरी'],
  ['Mobile Shop', 'मोबाईल शॉप'], ['Tea House', 'चहा हाऊस'], ['Vada Pav Centre', 'वडा पाव सेंटर'], ['Watch Co.', 'वॉच कं.'],
  ['Photo Studio', 'फोटो स्टुडिओ'], ['Cloth Centre', 'कापड सेंटर'], ['Xerox & Printing', 'झेरॉक्स'], ['Dry Fruits', 'ड्राय फ्रुट्स']];
const SUFFIX = ['', '', '', ' & Sons', ' Bros.', ' (Regd.)', ''];
const SIGN_BG = ['#D7261E', '#FFD200', '#1E4FA3', '#0E8A4A', '#EFE8D2', '#7A0F1E', '#F7F4EC', '#202020', '#E85D04', '#5A189A'];

/** Canvas atlas with 128 shop signs (8 × 16), Marathi in Devanagari over English, BMC-style. */
export function makeSignAtlas(fontFamilies = {}) {
  const W = 2048, H = 1024, cw = W / 8, ch = H / 16;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const draw = (families = fontFamilies) => {
    const g = c.getContext('2d');
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const latin = [families.latin1, families.latin2, families.latin3, 'Arial Black', 'Impact'].filter(Boolean);
    const deva = families.deva || 'sans-serif';
    for (let i = 0; i < 128; i++) {
      const x = (i % 8) * cw, y = Math.floor(i / 8) * ch;
      const bg = SIGN_BG[Math.floor(rnd() * SIGN_BG.length)];
      const light = ['#FFD200', '#EFE8D2', '#F7F4EC'].includes(bg);
      g.fillStyle = bg;
      g.fillRect(x, y, cw, ch);
      g.strokeStyle = light ? '#B3261E' : '#FFD200';
      g.lineWidth = 3;
      g.strokeRect(x + 3, y + 3, cw - 6, ch - 6);
      const [pe, pm] = PREFIX[Math.floor(rnd() * PREFIX.length)];
      const [te, tm] = TYPE[Math.floor(rnd() * TYPE.length)];
      const en = `${pe} ${te}${SUFFIX[Math.floor(rnd() * SUFFIX.length)]}`.toUpperCase();
      const mr = `${pm} ${tm}`;
      const fg = light ? (rnd() < 0.5 ? '#B3261E' : '#1E2A6E') : '#FFFFFF';
      g.fillStyle = fg;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = `bold 24px "${deva}"`;
      fitText(g, mr, x + cw / 2, y + ch * 0.32, cw - 16, 24, deva);
      g.font = `bold 20px "${latin[Math.floor(rnd() * latin.length)]}"`;
      fitText(g, en, x + cw / 2, y + ch * 0.74, cw - 14, 20, null);
      // Weathering: a little dirt and sun-fading.
      g.fillStyle = `rgba(60,50,40,${0.05 + rnd() * 0.12})`;
      g.fillRect(x, y + ch * (0.6 + rnd() * 0.4), cw, ch * 0.4);
    }
    tex.needsUpdate = true;
  };
  draw();
  return { texture: tex, redraw: draw };
}

function fitText(g, text, x, y, maxW, size, family) {
  let s = size;
  const fam = family ? `"${family}"` : g.font.split('px ')[1];
  while (s > 9 && g.measureText(text).width > maxW) { s -= 1; g.font = `bold ${s}px ${fam}`; }
  g.fillText(text, x, y);
}
