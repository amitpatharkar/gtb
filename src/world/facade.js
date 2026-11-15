import * as THREE from 'three';
import { Y } from './levels.js';
import { WINDOW_RECT, CELL_HASH_GLSL, FEATURES_GLSL, K, SHOP_STOREY, WIN, PIPE_X, ARCH_SPRING, AC_SIZE } from './facadeRules.js';

// Facade shader: real wall textures (plaster, stone, concrete…) plus Mumbai facade details
// computed per pixel. Windows and open shops use "interior mapping": a ray traced into a
// fake room behind the glass (walls, floor, ceiling, tube light), with the back wall and the
// furniture in the middle of the room taken from the room atlas (roomAtlas.js), so the inside
// has real depth and parallax from any angle, by day and lit at night. Window types follow the
// building's era (facadeRules.js): aluminium sliders, wooden casements, louvred shutters, Art
// Deco steel windows, Gothic pointed arches, portholes, box grilles and enclosed balconies.
// Chawl galleries (doors in a row, railings with saris drying), clay-tile roofs, gable vents,
// Art Deco name plaques, drain pipes, monsoon streaks under the roof line, algae and damp at
// the foot of the walls are painted here too. Near the player, 3D parts (facadeParts.js) are
// added by the same per-window rules.
//
// Per-vertex inputs (see src/world/mesh/buildings.js), flat per building:
//   uv            x = metres along the wall, y = height in metres (also drives the textures)
//   facadeBay     running bay (window column) coordinate along each wall
//   facadeA       style + 16 × facade kind + 0.5, building seed (integer), storey height, roof height
//   facadeB       facade code (CODE in facadeRules.js, + 0.25 = shop-height ground floor), bay width in metres

const RECTS = WINDOW_RECT.map((r, i) => `if (st == ${i}) return vec4(${r.map((v) => v.toFixed(2)).join(', ')});`).join('\n    ');
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const vec3 = (hex) => `vec3(${[16, 8, 0].map((sh) => lin(((hex >> sh) & 255) / 255).toFixed(4)).join(', ')})`;
const f = (v) => v.toFixed(3);

const GLSL = `
  ${CELL_HASH_GLSL}
  ${FEATURES_GLSL}
  vec4 windowRect(int st) {
    ${RECTS}
    return vec4(0.3, 0.7, 0.35, 0.75);
  }
  float fBox(vec2 p, vec4 r) { return step(r.x, p.x) * step(p.x, r.y) * step(r.z, p.y) * step(p.y, r.w); }
  float fBand(float v, float a, float b) { return step(a, v) * step(v, b); }

  // Window opening in cell space (1 inside): rectangle, Gothic pointed arch (equilateral, in the
  // opening's own proportions), round arch, or Art Deco porthole (metres).
  float winShape(int kind, vec2 p, vec4 r, float bw, float storey) {
    if (kind == ${WIN.PORTHOLE}) {
      vec2 c = vec2(r.x + r.y, r.z + r.w) * 0.5;
      float rad = min((r.y - r.x) * bw, (r.w - r.z) * storey) * 0.42;
      return step(length(vec2((p.x - c.x) * bw, (p.y - c.y) * storey)), rad);
    }
    if (p.x < r.x || p.x > r.y || p.y < r.z || p.y > r.w) return 0.0;
    if (kind == ${WIN.ARCH} || kind == ${WIN.ROUND}) {
      vec2 q = vec2((p.x - r.x) / (r.y - r.x), (p.y - r.z) / (r.w - r.z));
      if (q.y > ${f(ARCH_SPRING)}) {
        if (kind == ${WIN.ARCH}) {
          float dy = (q.y - ${f(ARCH_SPRING)}) / ${f((1 - ARCH_SPRING) / 0.866)};
          return step((q.x - 1.0) * (q.x - 1.0) + dy * dy, 1.0) * step(q.x * q.x + dy * dy, 1.0);
        }
        float dy = (q.y - ${f(ARCH_SPRING)}) / ${f(1 - ARCH_SPRING)}, dx = (q.x - 0.5) * 2.0;
        return step(dx * dx + dy * dy, 1.0);
      }
    }
    return 1.0;
  }

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
  // One cell of the room atlas (8 × 4 cells; row 0 at the top of the canvas = v 0.75..1).
  vec4 atlas(float cellX, float row, vec2 q, float lod) {
    q = clamp(q, vec2(0.004), vec2(0.996));
    return textureLod(tRooms, vec2((cellX + q.x) / 8.0, (3.0 - row + q.y) / 4.0), lod);
  }

  vec3 homeInterior(vec2 p, vec2 size, vec3 d, int col, int row, int seed, int st, float lod) {
    float depth = 3.2 + 2.5 * cellHash(col, row, seed, ${K.DEPTH});
    vec4 hit = roomHit(p, size, depth, d);
    vec3 h = hit.xyz;
    float r = cellHash(col, row, seed, ${K.ROOM});
    vec3 wall = mix(vec3(0.82, 0.78, 0.66), r < 0.33 ? vec3(0.62, 0.78, 0.74) : r < 0.66 ? vec3(0.86, 0.74, 0.62) : vec3(0.75, 0.75, 0.82), 0.6);
    vec3 c;
    if (hit.w < 0.5) {
      vec4 t = atlas(st == 6 ? 7.0 : floor(cellHash(col, row, seed, ${K.FURN}) * 7.0), 0.0, h.xy / size, lod);
      c = t.rgb + wall * (1.0 - t.a);
    } else if (hit.w < 1.5) {
      c = wall * 0.82;
      if (h.y < 1.9 && h.z > depth * 0.45 && d.x < 0.0) c = vec3(0.42, 0.28, 0.16);                         // wardrobe
    } else if (hit.w < 2.5) {
      float tile = mod(floor(h.x / 0.6) + floor(h.z / 0.6), 2.0);
      c = mix(vec3(0.55, 0.5, 0.44), vec3(0.42, 0.38, 0.34), tile);                                        // floor tiles
    } else {
      c = vec3(0.9, 0.88, 0.84);
      if (abs(h.x - size.x * 0.5) < 0.6 && abs(h.z - depth * 0.45) < 0.06) c = vec3(1.7, 1.65, 1.5);         // tube light
    }
    c *= 1.0 - 0.5 * h.z / depth;
    // Furniture in the middle of the room, with the ceiling fan (atlas cut-out).
    float zf = depth * (0.36 + 0.2 * cellHash(col, row, seed, 80));
    if (d.z > 0.0 && zf * d.z < h.z * d.z) {
      vec2 q = (p + d.xy * (zf / d.z)) / size;
      if (q.x > 0.0 && q.x < 1.0 && q.y > 0.0 && q.y < 1.0) {
        vec4 t = atlas(st == 6 ? 5.0 : floor(cellHash(col, row, seed, 81) * 8.0), 1.0, q, lod);
        c = t.rgb * (1.0 - 0.5 * zf / depth) + c * (1.0 - t.a);
      }
    }
    return c;
  }

  vec3 shopInterior(vec2 p, vec2 size, vec3 d, int unit, int seed, float lod) {
    float depth = 5.0 + 4.0 * cellHash(unit, -1, seed, ${K.DEPTH});
    vec4 hit = roomHit(p, size, depth, d);
    vec3 h = hit.xyz;
    vec3 c;
    if (hit.w < 1.5) {
      // Shelves of goods on the back wall (atlas), continuing along the side walls.
      float u = hit.w < 0.5 ? h.x / size.x : fract(h.z / size.x);
      vec4 t = atlas(floor(cellHash(unit, -1, seed, ${K.FURN}) * 8.0), 2.0, vec2(u, h.y / size.y), lod);
      c = t.rgb + vec3(0.6, 0.58, 0.55) * (1.0 - t.a);
      if (hit.w > 0.5) c *= 0.8;
      if (h.y > 2.6) c = vec3(0.85, 0.83, 0.78);
    } else if (hit.w < 2.5) {
      c = mix(vec3(0.6, 0.58, 0.55), vec3(0.5, 0.48, 0.45), mod(floor(h.x / 0.5) + floor(h.z / 0.5), 2.0));
    } else {
      c = vec3(0.9);
      if (abs(h.z - depth * 0.5) < 0.05 || abs(h.z - depth * 0.2) < 0.05) c = vec3(1.9, 1.85, 1.7);
    }
    c *= 1.0 - 0.35 * h.z / depth;
    if (d.z > 0.0) {
      // Counter across the shop, 1.4 m in, 0.95 m high.
      float tc = 1.4 / d.z;
      vec2 hc = p + d.xy * tc;
      if (hc.y < 0.95 && hc.y > 0.0 && hc.x > 0.0 && hc.x < size.x) c = vec3(0.42, 0.3, 0.2) * (0.8 + 0.2 * step(0.85, hc.y));
      // What hangs or stands just inside the shutter line (atlas cut-out, 0.5 m in).
      vec2 q = (p + d.xy * (0.5 / d.z)) / size;
      if (q.x > 0.0 && q.x < 1.0 && q.y > 0.0 && q.y < 1.0) {
        vec4 t = atlas(floor(cellHash(unit, -2, seed, ${K.FURN}) * 6.0), 3.0, q, lod);
        c = t.rgb + c * (1.0 - t.a);
      }
    }
    return c;
  }
`;

/** Room atlas stand-in until roomAtlas.js draws the real one (keeps the program the same). */
const NO_ROOMS = (() => { const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1); t.needsUpdate = true; return t; })();

export function makeFacadeMaterial(signAtlas, rooms = null) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  mat.userData.signs = { value: signAtlas };
  mat.userData.rooms = { value: rooms?.texture || NO_ROOMS };
  mat.userData.roomCell = { value: rooms?.cell || 256 };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.tSigns = mat.userData.signs;
    shader.uniforms.tRooms = mat.userData.rooms;
    shader.uniforms.uRoomCell = mat.userData.roomCell;
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
        uniform sampler2D tSigns; uniform sampler2D tRooms; uniform float uRoomCell; uniform float uNight; uniform float uFacadeDebug;
        vec3 dbgColor = vec3(0.0);
        ${GLSL}`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        float flatNormal = 0.0;
        vec3 facadeEmissive = vec3(0.0);
        {
          int sx = int(vFacadeA.x);
          int st = sx & 15;
          int fk = sx >> 4;
          int seed = int(vFacadeA.y + 0.5);
          float storey = vFacadeA.z;
          float roofY = vFacadeA.w;
          float codeF = vFacadeB.x + 0.01;
          int code = int(codeF);
          bool tallGF = fract(codeF) > 0.2;
          float bw = vFacadeB.y;
          // Screen-space size of the facade grid (here, outside any branch, where derivatives are defined).
          vec2 fwF = vec2(fwidth(vBay), fwidth(vFacadeP.y));
          float fwU = fwidth(vFacadeP.x);
          float roomLod = log2(max(1.0, uRoomCell * fwF.x * 1.3));
          float y = vFacadeP.y - ${Y.KERB.toFixed(2)};
          float tint = cellHash(-9, -9, seed, ${K.TINT});
          if (code == 5) {
            // ---------- roof slope: Mangalore clay tiles (warm colour) or slate (grey-blue)
            vec2 p = vFacadeP;
            bool slate = vColor.b > vColor.r;
            float rowH = slate ? 0.27 : 0.34, tw = slate ? 0.3 : 0.24;
            float row = floor(p.y / rowH), fy = fract(p.y / rowH);
            float xo = p.x / tw + mod(row, 2.0) * 0.5, fx = fract(xo);
            float th = cellHash(int(floor(xo)), int(row), seed, 70);
            vec3 c = vColor.rgb * (0.84 + 0.28 * th);
            c *= slate ? 0.88 + 0.12 * fy : (0.72 + 0.28 * sin(3.14159 * fx)) * (0.8 + 0.2 * smoothstep(0.0, 0.4, fy));
            c *= 1.0 - 0.42 * smoothstep(0.8, 1.0, fy);                       // shadow under the next row's lip
            c *= 0.82 + 0.18 * cellHash(int(floor(p.x / 0.9)), int(floor(p.y / 1.6)), seed, 71); // weathering
            float tilePx = max(fwidth(p.x) / tw, fwidth(p.y) / rowH);
            c = mix(c, vColor.rgb * (slate ? 0.84 : 0.72), smoothstep(0.25, 0.6, tilePx));
            diffuseColor.rgb = c;
            roughnessFactor = slate ? 0.6 : 0.82;
            metalnessFactor = 0.0;
            flatNormal = 1.0;
          } else {
          // Painted walls take the building's paint colour; the photo texture keeps its grain.
          if (st <= 2 || st == 5) {
            vec3 texel = diffuseColor.rgb / max(vColor.rgb, vec3(0.02));
            float L = dot(texel, vec3(0.3, 0.59, 0.11));
            diffuseColor.rgb = mix(diffuseColor.rgb, L * 1.45 * vColor.rgb, st == 1 ? 0.55 : 0.85);
          }
          float gf = code == 1 ? max(storey, ${SHOP_STOREY.toFixed(1)}) : 0.0;
          // Old buildings: some flats repainted their own part of the wall.
          if ((fk == 1 || fk == 4) && (st <= 1 || st == 5) && code <= 1 && y > gf) {
            int pc = int(floor(vBay)), pr = int(floor((y - gf) / storey));
            if (cellHash(pc, pr, seed, ${K.PATCH}) < 0.16) diffuseColor.rgb *= mix(vec3(0.86, 0.9, 0.96), vec3(1.1, 1.05, 0.92), cellHash(pc, pr, seed, 82));
          }
          vec3 wallC = diffuseColor.rgb;

          // View ray in wall space (x along the wall's u direction, y up, z into the wall).
          vec3 Nv = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
          vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
          vec3 Tu = normalize(cross(Nv, upV));
          vec3 Vv = normalize(-vViewPosition);
          vec3 ray = normalize(vec3(dot(Vv, Tu), dot(Vv, upV), dot(Vv, -Nv)));

          // Weathering: damp and algae at the foot of the wall (ragged top), black monsoon streaks
          // hanging from the roof edge (0.22 m columns of random length).
          if (st != 6 && code != 7) {
            float sK = (fk == 1 || fk == 4 || st == 1) ? 1.0 : fk == 3 ? 0.75 : 0.55;
            float xc = vFacadeP.x / 0.7, x0 = floor(xc);
            float dh = mix(cellHash(int(x0), 5, seed, ${K.STAIN}), cellHash(int(x0) + 1, 5, seed, ${K.STAIN}), smoothstep(0.0, 1.0, fract(xc)));
            float damp = 1.0 - smoothstep(0.0, 0.6 + 1.4 * dh, y);
            diffuseColor.rgb *= mix(vec3(1.0), vec3(0.6, 0.64, 0.55), damp * (0.5 + 0.5 * sK));
            if (y < 0.45) diffuseColor.rgb *= 0.8;
            float sc = vFacadeP.x / 0.22, si = floor(sc);
            float Ls = 0.5 + 4.0 * pow(cellHash(int(si), 3, seed, ${K.STAIN}), 2.0);
            float dTop = roofY + 0.8 - vFacadeP.y;
            float s1 = step(0.0, dTop) * (1.0 - smoothstep(0.0, Ls, dTop)) * (0.35 + 0.65 * cellHash(int(si), 4, seed, ${K.STAIN}));
            s1 *= 1.0 - abs(fract(sc) - 0.5) * 1.3;
            float sAvg = step(0.0, dTop) * (1.0 - smoothstep(0.0, 2.4, dTop)) * 0.42;
            s1 = mix(s1, sAvg, smoothstep(0.25, 0.7, fwU / 0.22));
            diffuseColor.rgb *= mix(vec3(1.0), vec3(0.42, 0.46, 0.38), s1 * sK);       // greenish-black algae
          }
          if (vFacadeP.y > roofY + 0.78 && vFacadeP.y < roofY + 0.9) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.76, 0.72), 0.6);
          vec3 wallS = diffuseColor.rgb;
          bool wallPx = true;

          bool windows = code <= 1 && st < 7 && vFacadeP.y < roofY - 0.3 && y > 0.0;
          float g1 = tallGF ? max(storey, ${SHOP_STOREY.toFixed(1)}) : storey; // chawl galleries start above the ground floor
          int grow = int(floor((y - g1) / storey));
          vec3 dado = min(woodPaint(fract(tint * 7.31)) * 1.7 + 0.05, vec3(0.7));

          if (windows && code == 1 && y < gf) {
            // ---------- ground-floor shop
            int unit = int(floor(vBay));
            float lx = fract(vBay);
            bool pillar = lx < 0.06 || lx > 0.94;
            float signTop = gf - 0.2, signBot = gf - 1.15;
            if (!pillar) {
              wallPx = false;
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
                  vec3 c = shopInterior(p, size, ray, unit, seed, roomLod);
                  diffuseColor.rgb = vec3(0.0);
                  roughnessFactor = 1.0;
                  flatNormal = 1.0;
                  facadeEmissive = c * (0.12 + 0.5 * uNight); // by day a shop is dimmer than the street outside
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
            // How big a window cell is on screen (cells per pixel): fine patterns (bars, slats,
            // railings, streaks) fade to their average under ~1 px per bar, and the whole cell to
            // its average under ~5 px per window — no crawling edges far away.
            float cellPx = max(fwF.x, fwF.y / storey);
            float hf = smoothstep(0.02, 0.06, cellPx);
            float far = smoothstep(0.12, 0.3, cellPx);
            bool balconyCell = isBalconyCell(st, fk, col, row, seed);
            bool enclosed = balconyCell && fk == 0 && cellHash(col, row, seed, ${K.ENCLOSE}) < 0.5;
            bool balcony = balconyCell && !enclosed;
            int kind = windowKind(st, fk, col, row, seed);
            vec4 r = kindRect(st, kind, windowRect(st));
            float inWin = winShape(kind, vec2(lx, ly), r, bw, storey);
            int lst = louvreState(col, row, seed);
            float lit = step(0.5, cellHash(col, row, seed, ${K.LIT}));
            float band = st == 2 ? fBand(ly, 0.0, 0.09) : st == 6 ? fBand(ly, 0.0, 0.08) : fBand(ly, 0.0, 0.035);
            diffuseColor.rgb *= 1.0 - band * (st == 2 ? -0.08 : 0.12);
            wallS = diffuseColor.rgb;
            vec2 roomP = vec2(lx * bw, ly * storey);
            vec2 roomS = vec2(bw, storey);
            if (st == 6) {
              // Glass curtain wall: spandrels at floor lines, mullions between panes, offices behind.
              wallPx = false;
              float mull = 1.0 - fBand(lx, 0.03, 0.97);
              if (band > 0.5 || mull > 0.5) { diffuseColor.rgb = vec3(0.32, 0.33, 0.34); roughnessFactor = 0.4; metalnessFactor = 0.6; flatNormal = 1.0; }
              else {
                vec3 room = far < 0.999 ? homeInterior(roomP, roomS, ray, col, row, seed, st, roomLod) : vec3(0.6, 0.6, 0.62);
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
                wallPx = false;
                vec4 hit = roomHit(vec2((lx - 0.08) * bw, (ly - 0.06) * storey), vec2(0.84 * bw, 0.86 * storey), 1.3, ray);
                vec3 c = wallC * (hit.w < 0.5 ? 0.55 : 0.4);
                if (hit.w < 0.5 && hit.x > 0.84 * bw * 0.35 && hit.x < 0.84 * bw * 0.6 && hit.y < 2.1) c = vec3(0.28, 0.18, 0.11);
                diffuseColor.rgb = c;
                float rail = step(ly, 0.42) * min(1.0, mix(step(0.75, fract(lx * 24.0)) + fBand(ly, 0.38, 0.42), 0.32, hf));
                diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.12), rail);
                float cloth = fBand(ly, 0.48, 0.74) * step(0.45, cellHash(col, row, seed, ${K.CURTAIN})) * step(0.35, fract(lx * 5.0));
                if (cloth > 0.5) diffuseColor.rgb = vec3(cellHash(col, int(lx * 5.0), seed, 21), cellHash(col, int(lx * 5.0), seed, 22), cellHash(col, int(lx * 5.0), seed, 23)) * 0.75 + 0.1;
                roughnessFactor = 0.9;
                flatNormal = 1.0;
              }
            } else if (enclosed) {
              // Balcony closed in: aluminium sliding glass over a solid panel, or a grille box.
              float inB = fBox(vec2(lx, ly), vec4(0.08, 0.92, 0.06, 0.92));
              if (inB > 0.5) {
                wallPx = false;
                vec2 q = vec2((lx - 0.08) / 0.84, (ly - 0.06) / 0.86);
                vec2 bp = vec2((lx - 0.08) * bw, (ly - 0.06) * storey), bs = vec2(0.84 * bw, 0.86 * storey);
                if (cellHash(col, row, seed, ${K.CAGE}) < 0.3) {
                  vec4 hit = roomHit(bp, bs, 1.3, ray);
                  vec3 c = wallC * (hit.w < 0.5 ? 0.5 : 0.38);
                  float bars = min(1.0, mix(step(0.78, fract(bp.x / 0.11)) + fBand(fract(q.y * 5.0), 0.0, 0.07) + step(q.y, 0.04), 0.3, hf));
                  diffuseColor.rgb = mix(c, vec3(0.13, 0.1, 0.08), bars);
                  roughnessFactor = 0.85;
                } else {
                  vec3 alu = aluColour(tint);
                  bool frm = abs(q.x - 0.333) < 0.012 || abs(q.x - 0.667) < 0.012 || q.x < 0.02 || q.x > 0.98 || abs(q.y - 0.3) < 0.015 || q.y > 0.97;
                  if (q.y < 0.3) { diffuseColor.rgb = vec3(0.78, 0.76, 0.72) * (0.92 + 0.08 * mix(step(0.5, fract(bp.x * 8.0)), 0.5, hf)); roughnessFactor = 0.8; }
                  else if (frm) { diffuseColor.rgb = alu; roughnessFactor = 0.4; metalnessFactor = 0.5; }
                  else {
                    vec3 room = far < 0.999 ? homeInterior(bp, bs, ray, col, row, seed, st, roomLod) : vec3(0.6, 0.55, 0.45);
                    diffuseColor.rgb = vec3(0.025, 0.035, 0.04);
                    roughnessFactor = 0.06;
                    metalnessFactor = 0.3;
                    facadeEmissive = room * (0.07 + uNight * lit * 0.7);
                  }
                }
                flatNormal = 1.0;
              }
            } else if (inWin > 0.5 && far >= 0.999) {
              // Far away: just the glow of lit windows (the cell average comes below).
              wallPx = false;
              facadeEmissive = vec3(0.62, 0.55, 0.45) * (0.1 + uNight * lit * 0.75) * (kind == ${WIN.LOUVRE} && lst == 0 ? 0.25 : 1.0);
            } else if (inWin > 0.5) {
              // Window recess: the glass sits ~0.18 m behind the wall face. At an angle the view
              // ray meets the reveal first: the sill catches the light, sides and head are in shade.
              wallPx = false;
              float recess = 0.18 / max(ray.z, 0.08);
              vec2 gp = roomP + ray.xy * recess;
              vec2 g01 = gp / roomS;
              if (winShape(kind, g01, r, bw, storey) < 0.5) {
                diffuseColor.rgb = wallC * (g01.y < r.z ? 0.92 : g01.y > r.w ? 0.42 : 0.6);
                roughnessFactor = 0.9;
                flatNormal = 1.0;
              } else {
                lx = g01.x; ly = g01.y; roomP = gp; // frame, glass and room are drawn on the recessed plane
                vec2 q = vec2((lx - r.x) / (r.y - r.x), (ly - r.z) / (r.w - r.z)); // 0..1 across the opening
                vec2 qs = vec2((r.y - r.x) * bw, (r.w - r.z) * storey);            // opening size, metres
                bool stone = st == 3 || st == 4;
                float solid = 0.0;   // frame or bars
                vec3 solidC = vec3(0.82, 0.8, 0.76);
                bool open = false, slats = false;
                if (kind == ${WIN.PLAIN}) {
                  solid = max(1.0 - fBox(q, vec4(0.07, 0.93, 0.07, 0.93)), fBand(q.x, 0.485, 0.515));
                } else if (kind == ${WIN.SLIDER}) {
                  solid = max(1.0 - fBox(q, vec4(0.045, 0.955, 0.045, 0.955)), fBand(q.x, 0.472, 0.528));
                  solidC = aluColour(tint);
                  open = q.x > 0.5 && cellHash(col, row, seed, ${K.SLIDE}) < 0.35;
                } else if (kind == ${WIN.CASEMENT}) {
                  float bars = (q.y < 0.7 ? max(fBand(abs(q.x - 0.5), 0.0, 0.018), max(fBand(abs(q.x - 0.28), 0.0, 0.01), fBand(abs(q.x - 0.72), 0.0, 0.01))) : max(fBand(abs(q.x - 0.35), 0.0, 0.01), fBand(abs(q.x - 0.65), 0.0, 0.01)))
                    + fBand(q.y, 0.7, 0.745) + (q.y < 0.7 ? fBand(abs(q.y - 0.33), 0.0, 0.01) + fBand(abs(q.y - 0.52), 0.0, 0.01) : 0.0);
                  solid = max(1.0 - fBox(q, vec4(0.06, 0.94, 0.06, 0.94)), min(1.0, mix(bars, 0.18, hf)));
                  solidC = woodPaint(tint);
                  open = q.x < 0.5 && q.y < 0.7 && cellHash(col, row, seed, ${K.SLIDE}) < 0.3;
                } else if (kind == ${WIN.DECO}) {
                  float bars = fBand(abs(q.y - 0.28), 0.0, 0.008) + fBand(abs(q.y - 0.52), 0.0, 0.008) + fBand(abs(q.y - 0.74), 0.0, 0.008) + fBand(abs(q.x - 0.333), 0.0, 0.008) + fBand(abs(q.x - 0.667), 0.0, 0.008);
                  solid = max(1.0 - fBox(q, vec4(0.035, 0.965, 0.035, 0.965)), min(1.0, mix(bars, 0.12, hf)));
                  solidC = steelColour(tint);
                } else if (kind == ${WIN.LOUVRE}) {
                  solid = max(1.0 - fBox(q, vec4(0.05, 0.95, 0.05, 0.95)), fBand(q.x, 0.49, 0.51));
                  solidC = woodPaint(tint);
                  slats = lst == 0 || (lst == 2 && q.x < 0.5);
                } else if (kind == ${WIN.ARCH} || kind == ${WIN.ROUND}) {
                  // Gothic: green louvres in some buildings, else glazing with a mullion, a transom at
                  // the springing and a round tracery light in the head.
                  solidC = vec3(0.1, 0.07, 0.05);
                  slats = kind == ${WIN.ARCH} && cellHash(-9, -9, seed, ${K.LANCET}) < 0.45;
                  float bars = fBand(abs(q.x - 0.5), 0.0, 0.02) * step(q.y, ${f(ARCH_SPRING)}) + fBand(abs(q.y - ${f(ARCH_SPRING)}), 0.0, 0.012);
                  if (kind == ${WIN.ARCH}) { float d = length(vec2((q.x - 0.5) * qs.x, (q.y - 0.8) * qs.y)); bars += fBand(abs(d - 0.18 * qs.x), 0.0, 0.03); }
                  else if (q.y > ${f(ARCH_SPRING)}) { float a = atan(q.y - ${f(ARCH_SPRING)}, (q.x - 0.5) * qs.x / qs.y); bars += fBand(abs(fract(a / 0.5236 + 0.5) - 0.5), 0.0, 0.06); }
                  solid = min(1.0, mix(bars, 0.15, hf));
                  if (slats) { solid = fBand(q.x, 0.49, 0.51); solidC = woodPaint(tint); }
                } else {
                  // Porthole: a thick steel ring; a stairwell behind.
                  float d = length(vec2((q.x - 0.5) * qs.x, (q.y - 0.5) * qs.y)) / (min(qs.x, qs.y) * 0.42);
                  solid = step(0.8, d) + fBand(abs(q.x - 0.5) * qs.x, 0.0, 0.02);
                  solidC = steelColour(tint);
                }
                if (solid > 0.5) {
                  diffuseColor.rgb = stone && kind != ${WIN.ARCH} && kind != ${WIN.ROUND} ? vec3(0.28, 0.22, 0.16) : solidC;
                  roughnessFactor = kind == ${WIN.SLIDER} ? 0.4 : 0.6;
                  metalnessFactor = kind == ${WIN.SLIDER} || kind == ${WIN.DECO} ? 0.4 : 0.0;
                  flatNormal = 1.0;
                } else if (slats) {
                  // Wooden louvres: slats every 6.5 cm, lit from above; a lit room glows between them.
                  float s = fract(q.y * qs.y / 0.065);
                  float sh = mix(0.6 + 0.4 * smoothstep(0.0, 0.7, s) * (1.0 - smoothstep(0.85, 1.0, s)), 0.8, hf);
                  diffuseColor.rgb = woodPaint(tint) * sh;
                  roughnessFactor = 0.75;
                  flatNormal = 1.0;
                  facadeEmissive = vec3(1.0, 0.85, 0.6) * uNight * lit * 0.5 * mix(step(0.88, s), 0.12, hf);
                } else {
                  // Glass (or an open pane) with a room behind it; some windows have curtains half drawn.
                  vec3 room = kind == ${WIN.PORTHOLE} ? vec3(0.32, 0.3, 0.28) : homeInterior(roomP, roomS, ray, col, row, seed, st, roomLod);
                  bool curtain = cellHash(col, row, seed, ${K.CURTAIN}) < 0.4 && kind != ${WIN.PORTHOLE};
                  if (curtain) {
                    float tcu = 0.12 / max(ray.z, 1e-3);
                    float cx = roomP.x / bw + ray.x * tcu / bw;
                    bool leftHalf = cellHash(col, row, seed, 31) < 0.5;
                    if ((leftHalf && cx < 0.5 * (r.x + r.y)) || (!leftHalf && cx > 0.5 * (r.x + r.y))) {
                      room = vec3(0.55 + 0.35 * cellHash(col, row, seed, 32), 0.4 + 0.3 * cellHash(col, row, seed, 33), 0.3 + 0.4 * cellHash(col, row, seed, 34));
                    }
                  }
                  // A TV's blue light in some dark rooms at night.
                  if (lit < 0.5 && cellHash(col, row, seed, 83) < 0.12) room += vec3(0.05, 0.1, 0.22) * uNight * 2.0;
                  diffuseColor.rgb = open ? vec3(0.0) : vec3(0.02, 0.025, 0.03);
                  roughnessFactor = open ? 1.0 : 0.05;
                  flatNormal = 1.0;
                  facadeEmissive = room * ((open ? 0.16 : 0.1) + uNight * lit * 0.75);
                  if (open && kind == ${WIN.SLIDER} && cellHash(col, row, seed, 84) < 0.5) {
                    diffuseColor.rgb = vec3(0.09); facadeEmissive *= 0.55;                       // mosquito mesh
                  }
                  bool barsOn = hasGrille(st, kind, col, row, seed) || hasCage(fk, kind, col, row, seed);
                  if (barsOn) {
                    float bars = min(1.0, mix(step(0.82, fract(lx * 18.0)) + fBand(fract(ly * 4.0), 0.0, 0.08), 0.26, hf));
                    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.1, 0.07), bars);
                    roughnessFactor = mix(roughnessFactor, 0.8, bars);
                    facadeEmissive *= 1.0 - 0.8 * bars;
                  }
                }
              }
            } else {
              // Wall around the window: sunshade (chajja), louvres folded open, Gothic voussoirs,
              // Deco grooves, AC unit, monsoon streaks and drips (painted for distance).
              float W = r.y - r.x, cxw = (r.x + r.y) * 0.5;
              bool chajja = (st <= 1 || st == 5 || (st == 2 && fk != 2));
              if (chajja && kind != ${WIN.PORTHOLE}) {
                if (fBand(ly, r.w + 0.015, r.w + 0.07) * fBand(lx, r.x - 0.06, r.y + 0.06) > 0.5) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.7, 0.68, 0.64), 0.6);
                // Water runs off the ends of the sunshade.
                float dx = min(abs(lx - (r.x - 0.05)), abs(lx - (r.y + 0.05))) * bw;
                float drip = (1.0 - smoothstep(0.015, 0.09, dx)) * step(ly, r.w) * smoothstep(r.w - 1.5 / storey, r.w, ly);
                diffuseColor.rgb *= 1.0 - 0.35 * mix(drip, 0.1 * step(ly, r.w), hf) * (fk == 0 ? 0.6 : 1.0);
              }
              if (kind == ${WIN.LOUVRE} && lst != 0 && ly > r.z + 0.05 * (r.w - r.z) && ly < r.w - 0.05 * (r.w - r.z)) {
                float leaf = fBand(lx, cxw + 0.5 * W, cxw + 0.94 * W) + (lst == 1 ? fBand(lx, cxw - 0.94 * W, cxw - 0.5 * W) : 0.0);
                if (leaf > 0.5) {
                  float s = fract(ly * storey / 0.065);
                  diffuseColor.rgb = woodPaint(tint) * mix(0.55 + 0.35 * smoothstep(0.0, 0.7, s), 0.72, hf);
                  roughnessFactor = 0.75;
                  flatNormal = 1.0;
                  wallPx = false;
                }
              }
              if (kind == ${WIN.ARCH} || kind == ${WIN.ROUND}) {
                // Voussoirs round the arch head (Gothic: buff and blue basalt alternating) and a sill course.
                float ring = winShape(kind, vec2(lx, ly), r + vec4(-0.05, 0.05, 0.0, 0.05), bw, storey) * (1.0 - winShape(kind, vec2(lx, ly), r, bw, storey));
                float spring = r.z + (r.w - r.z) * ${f(ARCH_SPRING)};
                if (ring > 0.5 && ly > spring - 0.01) {
                  float a = atan((ly - spring) * storey, (lx - cxw) * bw);
                  float v = mod(floor(a * 9.0 / 3.14159), 2.0);
                  diffuseColor.rgb = fk == 3 && v > 0.5 ? vec3(0.17, 0.17, 0.17) : wallC * 1.12;
                }
                if (fk == 3 && fBand(ly, r.z - 0.035, r.z - 0.005) > 0.5) diffuseColor.rgb = vec3(0.2, 0.2, 0.19);
              }
              if (fk == 2 && st == 2 && cellHash(-9, -9, seed, ${K.EYEBROW} + 20) < 0.6) {
                float g = fBand(abs(ly - 0.1), 0.0, 0.006) + fBand(abs(ly - 0.14), 0.0, 0.006) + fBand(abs(ly - 0.18), 0.0, 0.006);
                diffuseColor.rgb *= 1.0 - 0.25 * min(1.0, mix(g, 0.04, hf));
              }
              float streak = fBand(lx, r.x, r.y) * step(ly, r.z) * smoothstep(0.0, r.z, ly) * mix(cellHash(int(floor(lx * 23.0)), col, seed, 40), 0.5, hf);
              diffuseColor.rgb *= 1.0 - 0.35 * streak * (st == 1 ? 1.0 : 0.5);
              if (!balconyCell && hasAC(st, fk, kind, col, row, seed)) {
                vec2 ac = acCentre(r, bw, storey);
                vec2 da = vec2(abs(lx - ac.x) * bw, (ly - ac.y) * storey);
                if (da.x < ${f(AC_SIZE[0] / 2)} && abs(da.y) < ${f(AC_SIZE[1] / 2)}) {
                  diffuseColor.rgb = vec3(0.78, 0.78, 0.76) * (0.85 + 0.15 * mix(step(0.5, fract(ly * 40.0)), 0.5, hf)); roughnessFactor = 0.5; flatNormal = 1.0; wallPx = false;
                } else if (da.x < 0.05 && da.y < -${f(AC_SIZE[1] / 2)} && da.y > -1.4) diffuseColor.rgb *= 1.0 - 0.35 * (1.0 + da.y / 1.4) * (1.0 - hf); // drip stain
              }
            }
            if (far > 0.0 && st != 6 && !balcony) {
              // A few pixels per window: the cell's average colour and gloss (wall and dark
              // glass by area) instead of window edges and glints that shimmer. The glow of lit
              // windows stays per pixel: at night small bright windows read better than an
              // averaged grey block.
              float A = enclosed ? 0.55 : (r.y - r.x) * (r.w - r.z) * 0.8;
              vec3 glassAvg = (kind == ${WIN.LOUVRE} && lst == 0) || (kind == ${WIN.ARCH} && cellHash(-9, -9, seed, ${K.LANCET}) < 0.45) ? woodPaint(tint) * 0.7 : vec3(0.03);
              diffuseColor.rgb = mix(diffuseColor.rgb, mix(wallS * 0.9, glassAvg, A), far);
              roughnessFactor = mix(roughnessFactor, mix(0.9, 0.3, A), far);
              metalnessFactor = mix(metalnessFactor, 0.0, far);
            }
          } else if (code == 3 && y > g1 - 0.05) {
            // ---------- chawl gallery: one room per bay — a door, a barred window, a tube light
            int room = int(floor(vBay));
            float lxM = fract(vBay) * bw, lyM = y - g1 - float(grow) * storey;
            float roomLit = step(0.35, cellHash(room, grow, seed, ${K.LIT}));
            if (lyM < 1.2) diffuseColor.rgb = mix(diffuseColor.rgb, dado, 0.85);              // oil-paint dado
            if (abs(lyM - 1.2) < 0.02) diffuseColor.rgb *= 0.7;
            if (lxM > 0.35 && lxM < 1.3 && lyM < 2.1) {
              wallPx = false;
              vec3 dc = woodPaint(cellHash(room, grow, seed, ${K.DOOR}));
              bool open = cellHash(room, grow, seed, 85) < 0.45;
              if (lxM < 0.41 || lxM > 1.24 || lyM > 2.04) diffuseColor.rgb = dc * 0.7;
              else if (open) {
                diffuseColor.rgb = vec3(0.03);
                facadeEmissive = vec3(0.6, 0.55, 0.45) * (0.1 + 0.7 * uNight * roomLit);
                if (lyM > 0.8 && cellHash(room, grow, seed, 86) < 0.7) {                      // cloth curtain in the doorway
                  vec3 cc = vec3(cellHash(room, grow, seed, 87), cellHash(room, grow, seed, 88), cellHash(room, grow, seed, 89));
                  diffuseColor.rgb = (cc * cc * 0.7 + 0.1) * (0.85 + 0.15 * sin(lxM * 40.0));
                  facadeEmissive *= 0.3;
                }
              } else diffuseColor.rgb = dc * (0.82 + 0.18 * fBox(vec2(fract((lxM - 0.41) / 0.415), fract(lyM / 0.68)), vec4(0.12, 0.88, 0.12, 0.88)));
              roughnessFactor = 0.7;
              flatNormal = 1.0;
            } else if (lxM > 1.75 && lxM < bw - 0.3 && lyM > 0.9 && lyM < 1.9) {
              wallPx = false;
              float wx = (lxM - 1.75) / (bw - 2.05), wy = (lyM - 0.9);
              bool frm = wx < 0.06 || wx > 0.94 || wy < 0.06 || wy > 0.94 || abs(wx - 0.5) < 0.03;
              bool bar = fract(lxM / 0.12) < 0.18 && !frm;
              diffuseColor.rgb = frm ? woodPaint(tint) : bar ? vec3(0.1, 0.09, 0.08) : vec3(0.02);
              roughnessFactor = frm || bar ? 0.7 : 0.1;
              facadeEmissive = frm || bar ? vec3(0.0) : vec3(0.6, 0.55, 0.45) * (0.06 + 0.7 * uNight * roomLit);
              flatNormal = 1.0;
            } else {
              if (lxM > 1.38 && lxM < 1.62 && lyM > 1.35 && lyM < 1.68) diffuseColor.rgb = lyM > 1.6 ? vec3(0.6, 0.08, 0.06) : vec3(0.85, 0.83, 0.78); // calendar
              if (lyM > 2.36 && lyM < 2.42 && abs(lxM - 0.82) < 0.6) {                          // tube light
                diffuseColor.rgb = vec3(0.9);
                facadeEmissive = vec3(1.2, 1.25, 1.2) * uNight * roomLit;
              }
            }
          } else if (code == 4) {
            // ---------- chawl gallery railing: balusters with the corridor seen between them, saris drying
            wallPx = false;
            int room = int(floor(vBay));
            float lxM = fract(vBay) * bw, xM = vBay * bw, lyM = y - g1 - float(grow) * storey;
            float rk = cellHash(-9, -9, seed, ${K.DRAPE});
            vec3 railC = rk < 0.4 ? vec3(0.03, 0.06, 0.04) : rk < 0.75 ? vec3(0.17, 0.09, 0.05) : wallC;
            bool solid;
            if (rk < 0.4) solid = fract(xM / 0.11) < 0.22 || lyM > 0.93 || lyM < 0.08 || (lyM > 0.42 && lyM < 0.47);
            else if (rk < 0.75) solid = abs(fract(xM / 0.16) - 0.5) < 0.12 + 0.05 * sin(lyM * 14.0) || lyM > 0.9 || lyM < 0.1;
            else solid = lyM < 0.55 || lyM > 0.92 || fract(xM / 0.12) < 0.2 || abs(fract(lyM / 0.12) - 0.5) < 0.1;
            float t = ${f(1.6)} / max(ray.z, 0.05);
            vec2 bp = vec2(xM, lyM) + ray.xy * t;
            vec3 behind;
            if (bp.y < 0.0) behind = vec3(0.26, 0.16, 0.12);
            else {
              float bl = fract(bp.x / bw) * bw;
              behind = bl > 0.35 && bl < 1.3 && bp.y < 2.1 ? woodPaint(cellHash(int(floor(bp.x / bw)), grow, seed, ${K.DOOR})) : bp.y < 1.2 ? dado : wallC;
              behind *= 0.55;
            }
            vec3 c = solid ? railC : behind;
            c = mix(c, mix(behind, railC, rk < 0.4 ? 0.35 : rk < 0.75 ? 0.45 : 0.75), smoothstep(0.03, 0.08, fwU));
            // Saris, towels and bedsheets over the railing.
            if (cellHash(room, grow, seed, ${K.DRAPE} + 1) < 0.45) {
              float x0 = 0.25 + 0.6 * cellHash(room, grow, seed, 90), x1 = x0 + 0.7 + 0.9 * cellHash(room, grow, seed, 91);
              float drop = 0.35 + 0.5 * cellHash(room, grow, seed, 92);
              if (lxM > x0 && lxM < min(x1, bw - 0.1) && lyM > 1.0 - drop) {
                vec3 cc = vec3(cellHash(room, grow, seed, 93), cellHash(room, grow, seed, 94), cellHash(room, grow, seed, 95));
                cc = cc * cc * 0.8 + 0.08;
                c = mix(cc, vec3(0.75, 0.55, 0.12), step(lyM, 1.0 - drop + 0.07) * 0.8) * (0.85 + 0.15 * sin(lxM * 23.0));
              }
            }
            diffuseColor.rgb = c;
            roughnessFactor = 0.8;
            metalnessFactor = 0.0;
            flatNormal = 1.0;
          } else if (code == 6) {
            // ---------- gable end: a round window (Gothic) or vent (chawl roofs) in the middle
            vec2 pm = vec2((vBay - 0.5) * bw, vFacadeP.y - roofY - 0.42 * storey);
            float R0 = clamp(0.1 * bw, 0.25, 0.75), d = length(pm);
            if (d < R0) {
              wallPx = false;
              bool bar = abs(pm.x) < 0.03 || abs(pm.y) < 0.03;
              diffuseColor.rgb = bar ? wallC * 1.1 : vec3(0.04, 0.045, 0.05);
              roughnessFactor = bar ? 0.9 : 0.15;
              flatNormal = 1.0;
              facadeEmissive = bar ? vec3(0.0) : vec3(0.5, 0.45, 0.35) * uNight * 0.15;
            } else if (d < R0 + 0.1) diffuseColor.rgb = wallC * 1.12;
          } else if (code == 7) {
            // ---------- Art Deco name plaque (bronze letters, room atlas)
            wallPx = false;
            float idx = floor(cellHash(-9, -9, seed, ${K.PLAQUE}) * 8.0);
            vec2 pq = vec2(1.0 - clamp(vBay, 0.0, 1.0), clamp((vFacadeP.y - roofY) / storey, 0.0, 1.0));
            vec4 t = textureLod(tRooms, vec2((6.0 + floor(idx / 4.0) + clamp(pq.x, 0.004, 0.996)) / 8.0, (3.0 - mod(idx, 4.0) + clamp(pq.y, 0.02, 0.98)) / 16.0), log2(max(1.0, uRoomCell * fwF.x)));
            diffuseColor.rgb = t.rgb + wallC * 1.05 * (1.0 - t.a);
            roughnessFactor = mix(roughnessFactor, 0.4, t.a);
            metalnessFactor = 0.45 * t.a;
            flatNormal = 1.0;
          }

          // Drain pipes down the left side of some window columns (same rule as the 3D pipes),
          // with dark water stains round them.
          if (code <= 1 && st < 6) {
            int pcol = int(floor(vBay));
            float px = fract(vBay) * bw - ${f(PIPE_X)};
            if (abs(px) < 0.4 && pipeAt(fk, pcol, seed) && vFacadeP.y < roofY + 0.35 && (code == 0 || y > gf - 0.6)) {
              float stain = (1.0 - smoothstep(0.05, 0.38, abs(px))) * (0.25 + 0.35 * cellHash(int(floor(vFacadeP.y / 0.8)), pcol, seed, ${K.STAIN}));
              if (wallPx) diffuseColor.rgb *= 1.0 - stain * (fk == 0 ? 0.7 : 1.0);
              float pv = 1.0 - smoothstep(0.03, 0.08, fwU);
              if (abs(px) < 0.05 && pv > 0.0) {
                vec3 pc = fk == 0 ? (cellHash(-9, -9, seed, ${K.PIPE}) < 0.5 ? ${vec3(0x8d8f8c)} : ${vec3(0xd2cdc2)}) : fk == 2 ? wallC : ${vec3(0x3d3732)};
                diffuseColor.rgb = mix(diffuseColor.rgb, pc * (0.55 + 0.45 * sqrt(max(0.0, 1.0 - px * px / 0.0025))), pv);
                roughnessFactor = mix(roughnessFactor, 0.55, pv);
                metalnessFactor = mix(metalnessFactor, 0.0, pv);
                facadeEmissive *= 1.0 - pv;
                flatNormal = max(flatNormal, pv);
              }
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
  mat.customProgramCacheKey = () => 'gtb-facade-v3';
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
