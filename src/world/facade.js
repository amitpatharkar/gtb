import * as THREE from 'three';
import { Y } from './levels.js';
import { WINDOW_RECT, CELL_HASH_GLSL, FEATURES_GLSL, K, SHOP_STOREY } from './facadeRules.js';

// Facade shader: real wall textures (plaster, stone, concrete…) plus Mumbai facade details
// computed per pixel. Windows and open shops use "interior mapping": a ray traced into a
// fake room behind the glass (walls, floor, ceiling, tube light, shelves of goods), so the
// inside has real depth and parallax from any angle. Near the player, 3D parts (sunshades,
// sills, frames, grilles, AC units, balconies, signboards) are added by facadeParts.js using
// the same per-window rules (facadeRules.js).
//
// Per-vertex inputs (see src/world/mesh/buildings.js):
//   uv            x = metres along the wall, y = height in metres (also drives the textures)
//   facadeBay     running bay (window column) coordinate along each wall
//   facadeA       style + 0.5, building seed (integer), storey height, roof height
//   facadeB       shop flag (1 = shops on this wall, 2 = blank wall), bay width in metres

const RECTS = WINDOW_RECT.map((r, i) => `if (st == ${i}) return vec4(${r.map((v) => v.toFixed(2)).join(', ')});`).join('\n    ');

const GLSL = `
  ${CELL_HASH_GLSL}
  ${FEATURES_GLSL}
  vec4 windowRect(int st) {
    ${RECTS}
    return vec4(0.3, 0.7, 0.35, 0.75);
  }
  float fBox(vec2 p, vec4 r) { return step(r.x, p.x) * step(p.x, r.y) * step(r.z, p.y) * step(p.y, r.w); }
  float fBand(float v, float a, float b) { return step(a, v) * step(v, b); }

  // Trace a ray into a box room behind the wall. p: entry point (x along wall, y up) in metres
  // from the room's lower-left corner; size: room width and height; d: ray (x along, y up, z in).
  // Returns the hit point and which surface: 0 back wall, 1 side wall, 2 floor, 3 ceiling.
  vec4 roomHit(vec2 p, vec2 size, float depth, vec3 d) {
    float tx = d.x > 0.0 ? (size.x - p.x) / max(d.x, 1e-4) : p.x / max(-d.x, 1e-4);
    float ty = d.y > 0.0 ? (size.y - p.y) / max(d.y, 1e-4) : p.y / max(-d.y, 1e-4);
    float tz = depth / max(d.z, 1e-4);
    float t = min(min(tx, ty), tz);
    vec3 h = vec3(p, 0.0) + d * t;
    float face = t == tz ? 0.0 : t == tx ? 1.0 : d.y < 0.0 ? 2.0 : 3.0;
    return vec4(h, face);
  }

  vec3 homeInterior(vec2 p, vec2 size, vec3 d, int col, int row, int seed) {
    float depth = 3.2 + 2.5 * cellHash(col, row, seed, ${K.DEPTH});
    vec4 hit = roomHit(p, size, depth, d);
    vec3 h = hit.xyz;
    float r = cellHash(col, row, seed, ${K.ROOM});
    vec3 wall = mix(vec3(0.82, 0.78, 0.66), r < 0.33 ? vec3(0.62, 0.78, 0.74) : r < 0.66 ? vec3(0.86, 0.74, 0.62) : vec3(0.75, 0.75, 0.82), 0.6);
    vec3 c;
    if (hit.w < 0.5) {
      c = wall;
      if (h.x > size.x * 0.58 && h.x < size.x * 0.82 && h.y < 2.1) c = vec3(0.35, 0.22, 0.14);               // door
      if (h.x > size.x * 0.12 && h.x < size.x * 0.42 && h.y > 1.1 && h.y < 1.8) c = vec3(0.4, 0.45, 0.42); // picture / cupboard
    } else if (hit.w < 1.5) {
      c = wall * 0.82;
      if (h.y < 1.9 && h.z > depth * 0.45 && d.x < 0.0) c = vec3(0.42, 0.28, 0.16);                         // wardrobe
    } else if (hit.w < 2.5) {
      float tile = mod(floor(h.x / 0.6) + floor(h.z / 0.6), 2.0);
      c = mix(vec3(0.55, 0.5, 0.44), vec3(0.42, 0.38, 0.34), tile);                                        // floor tiles
    } else {
      c = vec3(0.9, 0.88, 0.84);
      if (abs(h.x - size.x * 0.5) < 0.6 && abs(h.z - depth * 0.45) < 0.06) c = vec3(3.0, 2.9, 2.6);          // tube light
    }
    return c * (1.0 - 0.5 * h.z / depth);
  }

  vec3 shopInterior(vec2 p, vec2 size, vec3 d, int unit, int seed) {
    float depth = 5.0 + 4.0 * cellHash(unit, -1, seed, ${K.DEPTH});
    // Counter across the shop, 1.4 m in, 0.95 m high.
    if (d.z > 0.0) {
      float tc = 1.4 / d.z;
      vec2 hc = p + d.xy * tc;
      if (hc.y < 0.95 && hc.y > 0.0 && hc.x > 0.0 && hc.x < size.x) return vec3(0.42, 0.3, 0.2) * (0.8 + 0.2 * step(0.85, hc.y));
    }
    vec4 hit = roomHit(p, size, depth, d);
    vec3 h = hit.xyz;
    vec3 c;
    if (hit.w < 1.5) {
      // Shelves of goods on the back and side walls.
      float along = hit.w < 0.5 ? h.x : h.z;
      float shelf = fract(h.y / 0.48);
      vec3 goods = vec3(cellHash(int(floor(along / 0.22)), int(floor(h.y / 0.48)), seed + unit, 11),
                        cellHash(int(floor(along / 0.22)), int(floor(h.y / 0.48)), seed + unit, 12),
                        cellHash(int(floor(along / 0.22)), int(floor(h.y / 0.48)), seed + unit, 13));
      c = shelf < 0.1 ? vec3(0.5, 0.42, 0.32) : mix(goods * 0.9 + 0.1, vec3(0.75), 0.25) * step(0.18, fract(along / 0.22) + 0.2);
      if (h.y > 2.3) c = vec3(0.85, 0.83, 0.78);
    } else if (hit.w < 2.5) {
      c = mix(vec3(0.6, 0.58, 0.55), vec3(0.5, 0.48, 0.45), mod(floor(h.x / 0.5) + floor(h.z / 0.5), 2.0));
    } else {
      c = vec3(0.9);
      if (abs(h.z - depth * 0.5) < 0.05 || abs(h.z - depth * 0.2) < 0.05) c = vec3(4.0, 3.9, 3.6);
    }
    return c * (1.0 - 0.35 * h.z / depth);
  }
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
        attribute float facadeBay; attribute vec4 facadeA; attribute vec2 facadeB;
        varying vec2 vFacadeP; varying float vBay; flat varying vec4 vFacadeA; flat varying vec2 vFacadeB;`)
      .replace('#include <uv_vertex>', `#include <uv_vertex>
        vFacadeP = uv; vBay = facadeBay; vFacadeA = facadeA; vFacadeB = facadeB;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec2 vFacadeP; varying float vBay; flat varying vec4 vFacadeA; flat varying vec2 vFacadeB;
        uniform sampler2D tSigns; uniform float uNight; uniform float uFacadeDebug;
        vec3 dbgColor = vec3(0.0);
        ${GLSL}`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        float flatNormal = 0.0;
        vec3 facadeEmissive = vec3(0.0);
        {
          int st = int(vFacadeA.x);
          int seed = int(vFacadeA.y + 0.5);
          float storey = vFacadeA.z;
          float roofY = vFacadeA.w;
          float shop = vFacadeB.x;
          float bw = vFacadeB.y;
          float y = vFacadeP.y - ${Y.KERB.toFixed(2)};
          // Painted walls take the building's paint colour; the photo texture keeps its grain.
          if (st <= 2 || st == 5) {
            vec3 texel = diffuseColor.rgb / max(vColor.rgb, vec3(0.02));
            float L = dot(texel, vec3(0.3, 0.59, 0.11));
            diffuseColor.rgb = mix(diffuseColor.rgb, L * 1.45 * vColor.rgb, st == 1 ? 0.55 : 0.85);
          }
          vec3 wallC = diffuseColor.rgb;

          // View ray in wall space (x along the wall's u direction, y up, z into the wall).
          vec3 Nv = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
          vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
          vec3 Tu = normalize(cross(Nv, upV));
          vec3 Vv = normalize(-vViewPosition);
          vec3 ray = normalize(vec3(dot(Vv, Tu), dot(Vv, upV), dot(Vv, -Nv)));
          float lightsOn = 0.12 + uNight * 0.9;

          // Rising damp and dirt near the ground, darker plinth.
          diffuseColor.rgb *= mix(0.72, 1.0, smoothstep(0.0, 1.6, y));
          if (y < 0.45) diffuseColor.rgb *= 0.78;
          if (vFacadeP.y > roofY + 0.78 && vFacadeP.y < roofY + 0.9) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.76, 0.72), 0.6);

          bool windows = shop < 1.5 && st < 7 && vFacadeP.y < roofY - 0.3 && y > 0.0;
          float gf = shop > 0.5 ? max(storey, ${SHOP_STOREY.toFixed(1)}) : 0.0;

          if (windows && shop > 0.5 && y < gf) {
            // ---------- ground-floor shop
            int unit = int(floor(vBay));
            float lx = fract(vBay);
            bool pillar = lx < 0.06 || lx > 0.94;
            float signTop = gf - 0.2, signBot = gf - 1.15;
            if (!pillar) {
              if (y > signBot && y < signTop) {
                float idx = floor(cellHash(unit, -1, seed, ${K.SIGN}) * 128.0);
                vec2 cell = vec2(mod(idx, 8.0), floor(idx / 8.0));
                // Walls run right-to-left when seen from outside, so read the sign backwards.
                vec2 suv = vec2(1.0 - (lx - 0.06) / 0.88, (y - signBot) / (signTop - signBot));
                vec4 sc = texture2D(tSigns, (cell + suv) / vec2(8.0, 16.0));
                diffuseColor.rgb = sc.rgb * 0.9;
                roughnessFactor = 0.45;
                flatNormal = 1.0;
                facadeEmissive = sc.rgb * uNight * 0.8;
              } else if (y > 0.22 && y < signBot - 0.05) {
                bool open = cellHash(unit, -1, seed, ${K.OPEN}) < 0.75;
                if (open) {
                  vec2 p = vec2((lx - 0.06) * bw, y - 0.22);
                  vec2 size = vec2(0.88 * bw, signBot - 0.27);
                  vec3 c = shopInterior(p, size, ray, unit, seed);
                  diffuseColor.rgb = vec3(0.0);
                  roughnessFactor = 1.0;
                  flatNormal = 1.0;
                  facadeEmissive = c * (0.32 + 0.5 * uNight);
                } else {
                  float sh = cellHash(unit, -1, seed, ${K.SHUTTER});
                  vec3 shc = sh < 0.4 ? vec3(0.42, 0.44, 0.45) : sh < 0.7 ? vec3(0.22, 0.38, 0.30) : vec3(0.24, 0.32, 0.48);
                  diffuseColor.rgb = shc * (0.82 + 0.18 * sin(y * 70.0));
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
            int row = int(floor(fy));
            float ly = fract(fy);
            int col = int(floor(vBay));
            float lx = fract(vBay);
            vec4 r = windowRect(st);
            float inWin = fBox(vec2(lx, ly), r);
            if ((st == 3 || st == 4) && ly > 0.68) inWin *= step(abs(lx - 0.5), 0.2 * sqrt(max(0.0, (r.w - ly) / (r.w - 0.68))));
            bool balcony = isBalcony(st, col, row, seed);
            float band = st == 2 ? fBand(ly, 0.0, 0.09) : st == 6 ? fBand(ly, 0.0, 0.08) : fBand(ly, 0.0, 0.035);
            diffuseColor.rgb *= 1.0 - band * (st == 2 ? -0.08 : 0.12);
            vec2 roomP = vec2(lx * bw, ly * storey);
            vec2 roomS = vec2(bw, storey);
            if (st == 6) {
              // Glass curtain wall: spandrels at floor lines, mullions between panes, offices behind.
              float mull = 1.0 - fBand(lx, 0.03, 0.97);
              if (band > 0.5 || mull > 0.5) { diffuseColor.rgb = vec3(0.32, 0.33, 0.34); roughnessFactor = 0.4; metalnessFactor = 0.6; flatNormal = 1.0; }
              else {
                vec3 room = homeInterior(roomP, roomS, ray, col, row, seed);
                diffuseColor.rgb = wallC * 0.3;
                roughnessFactor = 0.05;
                metalnessFactor = 0.55;
                flatNormal = 1.0;
                facadeEmissive = room * (0.05 + uNight * step(0.45, cellHash(col, row, seed, ${K.LIT})) * 0.6);
              }
            } else if (balcony) {
              // Recessed balcony: a shallow room with a door, railing and clothes painted for distance.
              float inB = fBox(vec2(lx, ly), vec4(0.08, 0.92, 0.06, 0.92));
              if (inB > 0.5) {
                vec4 hit = roomHit(vec2((lx - 0.08) * bw, (ly - 0.06) * storey), vec2(0.84 * bw, 0.86 * storey), 1.3, ray);
                vec3 c = wallC * (hit.w < 0.5 ? 0.55 : 0.4);
                if (hit.w < 0.5 && hit.x > 0.84 * bw * 0.35 && hit.x < 0.84 * bw * 0.6 && hit.y < 2.1) c = vec3(0.28, 0.18, 0.11);
                diffuseColor.rgb = c;
                float rail = step(ly, 0.42) * (step(0.75, fract(lx * 24.0)) + fBand(ly, 0.38, 0.42));
                if (rail > 0.5) diffuseColor.rgb = vec3(0.12);
                float cloth = fBand(ly, 0.48, 0.74) * step(0.45, cellHash(col, row, seed, ${K.CURTAIN})) * step(0.35, fract(lx * 5.0));
                if (cloth > 0.5) diffuseColor.rgb = vec3(cellHash(col, int(lx * 5.0), seed, 21), cellHash(col, int(lx * 5.0), seed, 22), cellHash(col, int(lx * 5.0), seed, 23)) * 0.75 + 0.1;
                roughnessFactor = 0.9;
                flatNormal = 1.0;
              }
            } else if (inWin > 0.5) {
              float frameW = 0.035;
              float frame = 1.0 - fBox(vec2(lx, ly), r + vec4(frameW, -frameW, frameW, -frameW));
              float mid = fBand(lx, 0.5 * (r.x + r.y) - 0.012, 0.5 * (r.x + r.y) + 0.012);
              if (frame > 0.5 || (mid > 0.5 && st <= 2)) {
                diffuseColor.rgb = (st == 3 || st == 4) ? vec3(0.28, 0.22, 0.16) : vec3(0.82, 0.8, 0.76);
                roughnessFactor = 0.6;
              } else {
                // Glass with a room behind it; some windows have curtains half drawn.
                vec3 room = homeInterior(roomP, roomS, ray, col, row, seed);
                float lit = step(0.5, cellHash(col, row, seed, ${K.LIT}));
                bool curtain = cellHash(col, row, seed, ${K.CURTAIN}) < 0.4;
                if (curtain) {
                  float tcu = 0.12 / max(ray.z, 1e-3);
                  float cx = roomP.x / bw + ray.x * tcu / bw;
                  bool leftHalf = cellHash(col, row, seed, 31) < 0.5;
                  if ((leftHalf && cx < 0.5 * (r.x + r.y)) || (!leftHalf && cx > 0.5 * (r.x + r.y))) {
                    room = vec3(0.55 + 0.35 * cellHash(col, row, seed, 32), 0.4 + 0.3 * cellHash(col, row, seed, 33), 0.3 + 0.4 * cellHash(col, row, seed, 34));
                  }
                }
                diffuseColor.rgb = vec3(0.02, 0.025, 0.03);
                roughnessFactor = 0.05;
                flatNormal = 1.0;
                facadeEmissive = room * (0.1 + uNight * lit * 0.75);
                if (hasGrille(st, col, row, seed) && step(0.82, fract(lx * 18.0)) + fBand(fract(ly * 4.0), 0.0, 0.08) > 0.5) {
                  diffuseColor.rgb = vec3(0.16, 0.1, 0.07);
                  roughnessFactor = 0.8;
                  facadeEmissive *= 0.2;
                }
              }
            } else {
              // Wall around the window: sunshade (chajja), monsoon streaks, AC unit (painted for distance).
              if (st <= 2 || st >= 5) {
                if (fBand(ly, r.w + 0.015, r.w + 0.07) * fBand(lx, r.x - 0.06, r.y + 0.06) > 0.5) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.7, 0.68, 0.64), 0.6);
              }
              float streak = fBand(lx, r.x, r.y) * step(ly, r.z) * smoothstep(0.0, r.z, ly) * cellHash(int(floor(lx * 23.0)), col, seed, 40);
              diffuseColor.rgb *= 1.0 - 0.35 * streak * (st == 1 ? 1.0 : 0.5);
              if (hasAC(st, col, row, seed)) {
                float ac = fBox(vec2(lx, ly), vec4(r.y + 0.03, r.y + 0.24, 0.33, 0.52));
                if (ac > 0.5) { diffuseColor.rgb = vec3(0.78, 0.78, 0.76) * (0.85 + 0.15 * step(0.5, fract(ly * 40.0))); roughnessFactor = 0.5; flatNormal = 1.0; }
                diffuseColor.rgb *= 1.0 - 0.35 * fBox(vec2(lx, ly), vec4(r.y + 0.03, r.y + 0.24, 0.26, 0.33));
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
  mat.customProgramCacheKey = () => 'gtb-facade-v2';
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
