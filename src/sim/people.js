import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { dress, lookFor, finishBits, NOW, BIT, zoneAt, setWorldFrame, SKIN_TONES } from './looks.js';

// Light procedural people for crowds: one instanced mesh, ~800 triangles each, limbs
// swung in the vertex shader. The far crowd wears the same looks as the real characters
// near the camera (looks.js): kurtas and knee skirts, saris and lungis to the ankle, a
// dupatta or pallu, long hair, a bun or a plait, hard hats, Gandhi caps, turbans, school
// bags, shorts and long sleeves — shapes switched on per person by bits, colours packed into
// two attributes. Up to six Holi colour patches per person (blotchy splats that move with
// the limbs), so a few hundred people cost one draw call.
//
// People are plain objects; make them with `makePerson()` (every field the game ever sets on
// a person exists from the start, so all people share one object shape and the per-frame
// loops read their numbers without allocating).

export const POSE = { WALK: 0, STAND: 1, WAVE: 2, POINT: 3, ARGUE: 4, BAT: 5, SIT: 6, CROUCH: 7, FALLEN: 8, KICK: 9, PUSH: 10, PUNCH: 11, FIGHT: 12, THROW: 13, PEDAL: 14, RIDE: 15 };
/** CAP: peaked cap (police); SARI: a woman (her look decides what she wears); BERET: helmet or turban. */
export const FLAG = { CAP: 1, SARI: 2, BERET: 4 };
export { setWorldFrame, zoneAt };

/** Holi colours (pichkari, gulal, tomatoes use index 6 = red). */
export const HOLI_HEX = [0xff2e88, 0x1fbf4f, 0xffd400, 0x1e7bff, 0xff7a00, 0x9b30ff, 0xd8141c, 0x19c6c0, 0xff4fd8, 0xd4a017, 0x7cff3a, 0xffffff];
export const HOLI_NAMES = ['Gulabi', 'Hara', 'Peela', 'Neela', 'Kesari', 'Jamuni', 'Laal', 'Firozi', 'Rani', 'Sunehri', 'Tota hara', 'Safed'];
export const HOLI = HOLI_HEX.map((h) => new THREE.Color(h));
const SPLATS = 6;
const TURBAN_DEFAULT = new THREE.Color(0xd84315);

/**
 * A person with every field the game's systems use, in one fixed order (one object shape:
 * per-frame loops over people then read numbers without allocating). `props` fills in what
 * the caller knows; new per-person fields belong in this list.
 */
export function makePerson(props) {
  const p = {
    // where and how
    x: 0, y: 0, z: 0, heading: 0, phase: 0, pose: 1, amp: 1, speed: 1.3, flags: 0, scale: 1, h: 2.1,
    kind: '', shirt: null, pants: null, skin: null, look: null, patches: null,
    // drawing (people.js, characters.js)
    hero: false, noHero: false, keep: false, isPlayer: false, hidden: false, drawn: 0, body: null, tpl: '',
    model: null, build: null, shoe: null, hair: null, hatColor: null, wear: null, handPos: null,
    hitT: 0, swingN: 0, kickT: 0, kickN: 0,
    // fights (combat.js)
    free: false, combat: null, hp: 1, downT: 0, sprayer: false, sprayColour: 0, rolled: false,
    // street life (street.js)
    seg: null, dir: 1, t: 0, side: 1, off: 0, state: '', timer: 0, ox: 0, oz: 0, vx: 0, vz: 0, crossTo: 0, watch: null, dead: false,
    role: '', homeX: 0, homeZ: 0, baseHeading: 0, basePose: null, dance: undefined, line: '', said: false,
    // other systems (stars, story, jobs, police)
    fan: false, cop: false, name: '', placed: false, inTaxi: false, gone: false, task: null, idleT: 0, ux: 0, uz: 0, site: null,
  };
  return props ? Object.assign(p, props) : p;
}

/**
 * Add a colour patch to a person (object with x, y, z, heading, scale) at a world-space hit
 * point. Patches live in the person's rest-pose space (packed into one float each).
 */
export function addPatch(person, wx, wy, wz, colour, radius = 0.12) {
  const sc = person.scale || 1, h = person.heading || 0;
  const dx = wx - person.x, dz = wz - person.z;
  let lx = (dx * Math.cos(h) - dz * Math.sin(h)) / sc, lz = (dx * Math.sin(h) + dz * Math.cos(h)) / sc;
  const ly = Math.max(0.05, Math.min(1.85, (wy - (person.y || 0)) / sc));
  // Pull the point onto the body surface (around the body axis).
  const d = Math.hypot(lx, lz), surf = ly > 1.45 ? 0.1 : ly > 0.85 ? 0.16 : 0.12;
  if (d > surf) { lx *= surf / d; lz *= surf / d; }
  const xi = Math.round(Math.max(0, Math.min(1, lx + 0.5)) * 127), yi = Math.round((ly / 2) * 255), zi = Math.round(Math.max(0, Math.min(1, lz + 0.5)) * 127);
  const packed = xi + yi * 128 + zi * 32768;
  const code = colour + Math.max(0.05, Math.min(0.24, radius)) * 2;
  (person.patches ||= []).push([packed, code]);
  if (person.patches.length > SPLATS) person.patches.shift();
}

// Part ids (partLimb.x): what colours a vertex and which bit shows it.
const PART = {
  SKIN: 0, SHIRT: 1, PANTS: 2, HAIR: 3, SHOE: 4, CAP: 5, ANKLE: 6, HEADDOME: 8, GANDHI: 9, SHIN: 10, FOREARM: 11,
  KNEE: 12, DUPATTA: 16, PALLU: 17, BAG: 18, HAIRLONG: 19, BUN: 20, PLAIT: 21, BRIM: 22,
};
function piece(geo, part, limb) {
  geo = geo.index ? geo.toNonIndexed() : geo;
  const n = geo.attributes.position.count;
  const pl = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { pl[i * 2] = part; pl[i * 2 + 1] = limb; }
  geo.setAttribute('partLimb', new THREE.Float32BufferAttribute(pl, 2)); // packed to save attribute slots
  geo.deleteAttribute('uv');
  return geo;
}
const cyl = (r0, r1, h, seg, x, y, z, open = false) => new THREE.CylinderGeometry(r1, r0, h, seg, 1, open).translate(x, y + h / 2, z);

function personGeometry() {
  const parts = [];
  for (const s of [-1, 1]) {
    const leg = s < 0 ? 1 : 2, arm = s < 0 ? 3 : 4;
    parts.push(piece(cyl(0.07, 0.078, 0.4, 7, s * 0.09, 0.46, 0), PART.PANTS, leg));          // thigh
    parts.push(piece(cyl(0.058, 0.07, 0.41, 7, s * 0.09, 0.06, 0), PART.SHIN, leg));          // shin
    parts.push(piece(new THREE.BoxGeometry(0.1, 0.07, 0.24).translate(s * 0.09, 0.035, 0.04), PART.SHOE, leg));
    parts.push(piece(cyl(0.048, 0.055, 0.3, 6, s * 0.235, 1.08, 0), PART.SHIRT, arm));        // sleeve
    parts.push(piece(cyl(0.036, 0.044, 0.3, 6, s * 0.235, 0.8, 0), PART.FOREARM, arm));       // forearm
    parts.push(piece(new THREE.SphereGeometry(0.045, 6, 4).translate(s * 0.235, 0.78, 0), PART.SKIN, arm)); // hand
  }
  parts.push(piece(cyl(0.15, 0.135, 0.12, 10, 0, 0.84, 0).scale(1, 1, 0.7), PART.PANTS, 0));   // hips
  parts.push(piece(cyl(0.14, 0.175, 0.46, 10, 0, 0.94, 0).scale(1, 1, 0.66), PART.SHIRT, 0));  // torso
  parts.push(piece(new THREE.SphereGeometry(0.17, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.45, 0.66).translate(0, 1.39, 0), PART.SHIRT, 0)); // shoulders
  parts.push(piece(cyl(0.05, 0.05, 0.1, 6, 0, 1.42, 0), PART.SKIN, 0));                       // neck
  parts.push(piece(new THREE.SphereGeometry(0.105, 12, 9).scale(0.95, 1.18, 1.05).translate(0, 1.6, 0.01), PART.SKIN, 0)); // head
  parts.push(piece(new THREE.SphereGeometry(0.112, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.55).scale(0.98, 1.1, 1.08).translate(0, 1.62, -0.005), PART.HAIR, 0)); // hair
  parts.push(piece(new THREE.CylinderGeometry(0.115, 0.118, 0.07, 12).translate(0, 1.75, 0), PART.CAP, 0)); // police cap
  parts.push(piece(new THREE.BoxGeometry(0.2, 0.012, 0.09).translate(0, 1.72, 0.13), PART.CAP, 0));         // cap visor
  parts.push(piece(new THREE.SphereGeometry(0.125, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.75, 1.08).translate(0, 1.66, 0), PART.HEADDOME, 0)); // helmet / hard hat / turban
  parts.push(piece(new THREE.CylinderGeometry(0.16, 0.16, 0.012, 12).translate(0, 1.67, 0.02), PART.BRIM, 0)); // hard-hat brim
  parts.push(piece(new THREE.ConeGeometry(0.1, 0.07, 4).scale(0.7, 1, 1.4).translate(0, 1.75, 0), PART.GANDHI, 0)); // Gandhi cap
  parts.push(piece(cyl(0.3, 0.16, 0.8, 12, 0, 0.06, 0, true).scale(1, 1, 0.75), PART.ANKLE, 0));  // sari or lungi to the ankle
  parts.push(piece(cyl(0.21, 0.155, 0.42, 10, 0, 0.45, 0, true).scale(1, 1, 0.72), PART.KNEE, 0)); // kurta, school skirt or folded lungi
  parts.push(piece(cyl(0.185, 0.17, 0.07, 10, 0, 1.25, 0.005, true).scale(1, 1, 0.72), PART.DUPATTA, 0)); // dupatta round the shoulders
  parts.push(piece(new THREE.BoxGeometry(0.1, 0.62, 0.27).rotateZ(-0.62).translate(0.0, 1.13, 0), PART.PALLU, 0)); // pallu across the chest
  parts.push(piece(new THREE.BoxGeometry(0.21, 0.26, 0.09).translate(0, 1.18, -0.16), PART.BAG, 0));        // school bag
  parts.push(piece(new THREE.BoxGeometry(0.2, 0.3, 0.035).translate(0, 1.42, -0.105), PART.HAIRLONG, 0));    // long hair down the back
  parts.push(piece(new THREE.SphereGeometry(0.06, 6, 4).translate(0, 1.56, -0.115), PART.BUN, 0));           // bun
  parts.push(piece(cyl(0.022, 0.03, 0.42, 5, 0, 1.1, -0.125), PART.PLAIT, 0));                              // plait
  return mergeGeometries(parts);
}

const ANIM_GLSL = `
  attribute vec2 partLimb;
  attribute vec4 aAnim;   // phase, pose, stride amplitude, flags (+ look bits)
  vec3 rotX(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c); }
  vec3 rotZ(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x * c - p.y * s, p.x * s + p.y * c, p.z); }
  bool bit(float f, float b) { return mod(floor(f / b), 2.0) >= 1.0; }
  // Swing angles (about x, about z) for this vertex's limb.
  vec2 limbAngles(float limb) {
    float ph = aAnim.x, pose = aAnim.y, amp = aAnim.z;
    float side = (limb == 1.0 || limb == 3.0) ? -1.0 : 1.0;
    bool leg = limb > 0.5 && limb < 2.5, arm = limb > 2.5;
    float sw = sin(ph);
    if (pose < 0.5) return leg ? vec2(sw * 0.5 * amp * side, 0.0) : vec2(-sw * 0.38 * amp * side, side * 0.06);
    if (pose < 1.5) return arm ? vec2(sin(ph * 0.5) * 0.04, side * 0.07) : vec2(0.0);
    if (pose < 2.5) return limb == 4.0 ? vec2(-1.55, 0.25 + sin(ph * 2.2) * 0.45) : arm ? vec2(0.0, -0.07) : vec2(0.0);
    if (pose < 3.5) return limb == 4.0 ? vec2(-1.5, 0.15) : arm ? vec2(0.0, -0.07) : vec2(0.0);
    if (pose < 4.5) return arm ? vec2(-0.7 - 0.55 * max(0.0, sin(ph * 1.7 + side * 1.6)), side * 0.35) : vec2(0.0);
    if (pose < 5.5) return arm ? vec2(-0.9 + sin(ph) * 0.9, side < 0.0 ? 0.35 : -0.35) : vec2(0.0);
    if (pose < 6.5) return leg ? vec2(-1.45, side * 0.08) : arm ? vec2(-0.45, side * 0.1) : vec2(0.0);
    if (pose < 7.5) return leg ? vec2(-1.1, side * 0.25) : arm ? vec2(-0.9 + sin(ph) * 0.3, side * 0.2) : vec2(0.0);
    if (pose < 8.5) return arm ? vec2(-0.2, side * 0.6) : leg ? vec2(0.0, side * 0.12) : vec2(0.0);               // fallen (body rotated below)
    if (pose < 9.5) return limb == 2.0 ? vec2(-1.3, 0.0) : leg ? vec2(0.25, 0.0) : arm ? vec2(-0.6, side * 0.5) : vec2(0.0); // kick
    if (pose < 10.5) return arm ? vec2(-1.45, -side * 0.12) : leg ? vec2(side * 0.25, 0.0) : vec2(0.0);       // push
    if (pose < 11.5) return arm ? vec2((sw * side > 0.0) ? -1.55 : -0.85, -side * 0.15) : leg ? vec2(side * 0.18, 0.0) : vec2(0.0); // punches
    if (pose < 12.5) return arm ? vec2(-0.95 + sin(ph * 2.0 + side) * 0.12, -side * 0.2) : leg ? vec2(side * 0.22, 0.0) : vec2(0.0); // guard
    if (pose < 13.5) return limb == 4.0 ? vec2(-2.7 + max(0.0, sin(ph)) * 1.6, 0.1) : arm ? vec2(-0.3, -0.1) : vec2(0.0);     // throw
    if (pose < 14.5) return leg ? vec2(-0.52 + sw * 0.34 * side, side * 0.07) : vec2(-0.95, side * 0.1);    // pedalling a bicycle
    return leg ? vec2(-1.45, side * 0.14) : vec2(-1.05, side * 0.08);                                       // riding: hands on the handlebar
  }
  // Is this part worn? (flags: 1 cap, 2 a woman, 4 helmet; then the look's bits)
  bool worn(float part, float f, float pose) {
    bool cap = bit(f, 1.0), helmet = bit(f, 4.0);
    bool hardhat = bit(f, ${BIT.HARDHAT}.0), turban = bit(f, ${BIT.TURBAN}.0), gandhi = bit(f, ${BIT.GANDHI}.0);
    // Seated, crouching or riding: skirts give way to the legs (coloured like the cloth).
    bool seated = (pose > 5.5 && pose < 7.5) || pose > 13.5;
    if ((part == 6.0 || part == 12.0) && seated) return false;
    if (part == 3.0) return !(cap || helmet || hardhat || turban || bit(f, ${BIT.BALD}.0));
    if (part == 5.0) return cap;
    if (part == 8.0) return (helmet || hardhat || turban) && !cap;
    if (part == 22.0) return hardhat;
    if (part == 9.0) return gandhi;
    if (part == 6.0) return bit(f, ${BIT.SARI}.0) || bit(f, ${BIT.LUNGI}.0);
    if (part == 12.0) return bit(f, ${BIT.KURTA}.0) || bit(f, ${BIT.SKIRT}.0);
    if (part == 16.0) return bit(f, ${BIT.DUPATTA}.0);
    if (part == 17.0) return bit(f, ${BIT.PALLU}.0);
    if (part == 18.0) return bit(f, ${BIT.BAG}.0);
    if (part == 19.0) return bit(f, ${BIT.LONGHAIR}.0) && !helmet;
    if (part == 20.0) return bit(f, ${BIT.BUN}.0) && !helmet;
    if (part == 21.0) return bit(f, ${BIT.PLAIT}.0);
    return true;
  }
  vec3 animate(vec3 p, bool isNormal) {
    float part = partLimb.x, limb = partLimb.y;
    float flags = aAnim.w;
    if (!worn(part, flags, aAnim.y)) return vec3(0.0);
    // A lungi is a narrower tube than a sari.
    if (part == 6.0 && !bit(flags, ${BIT.SARI}.0)) p.xz *= vec2(0.66, 0.78);
    float pose = aAnim.y;
    if (limb > 0.5) {
      vec2 a = limbAngles(limb);
      vec3 pivot = limb < 2.5 ? vec3(limb == 1.0 ? -0.09 : 0.09, 0.86, 0.0) : vec3(limb == 3.0 ? -0.235 : 0.235, 1.38, 0.0);
      if (limb < 2.5 && (part == 10.0 || part == 4.0) && pose > 5.5 && (pose < 7.5 || pose > 13.5)) {
        // Seated, crouching or riding: the shin hangs down from the knee.
        vec3 knee = vec3(pivot.x, 0.46, 0.0);
        if (isNormal) p = rotX(p, a.x + 1.4); else p = knee + rotX(p - knee, 1.4);
        if (!isNormal) p = pivot + rotZ(rotX(p - pivot, a.x), a.y);
      } else {
        if (isNormal) p = rotZ(rotX(p, a.x), a.y);
        else p = pivot + rotZ(rotX(p - pivot, a.x), a.y);
      }
    }
    if (pose > 7.5 && pose < 8.5) {
      // Knocked down: lying on the back.
      p = rotX(p, -1.5);
      if (!isNormal) p += vec3(0.0, 0.14, 0.9);
    } else if (!isNormal) {
      if ((pose > 5.5 && pose < 6.5) || pose > 14.5) p.y -= 0.42;  // sitting on a stool, kerb or bike
      if (pose > 6.5 && pose < 7.5) p.y -= 0.3;                // crouching
      if (pose > 11.5 && pose < 12.5) p.y += abs(sin(aAnim.x * 2.0)) * 0.03; // bouncing in a fight
      if (pose < 0.5) p.y += abs(sin(aAnim.x)) * 0.03 * aAnim.z; // bob while walking
    }
    return p;
  }
`;

/** sRGB hex → packed float (24 bits fit a float exactly). */
const pack = (c) => (c ? c.getHex() : 0x808080);
const PACK_GLSL = `
  vec3 unpack(float v) { vec3 c = vec3(floor(v / 65536.0), mod(floor(v / 256.0), 256.0), mod(v, 256.0)) / 255.0; return pow(c, vec3(2.2)); }
`;

export class PeopleRenderer {
  constructor(scene, max = 400) {
    this.max = max;
    const geo = personGeometry();
    const dyn = (n) => new THREE.InstancedBufferAttribute(new Float32Array(max * n), n).setUsage(THREE.DynamicDrawUsage);
    this.anim = dyn(4); this.col0 = dyn(4); this.col1 = dyn(4);
    this.splat = [dyn(4), dyn(4), dyn(4)]; // 6 patches: (packed position, colour code) × 2 per vec4
    geo.setAttribute('aAnim', this.anim);
    geo.setAttribute('aCol0', this.col0); // shirt, pants, skin, hair (packed sRGB)
    geo.setAttribute('aCol1', this.col1); // look colour A (dupatta, lungi, hat), B (bag, border), -, -
    this.splat.forEach((a, i) => geo.setAttribute(`aSplat${i}`, a));

    const vert = (shader, colour) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${ANIM_GLSL}${colour ? `${PACK_GLSL} attribute vec4 aCol0; attribute vec4 aCol1;
          attribute vec4 aSplat0; attribute vec4 aSplat1; attribute vec4 aSplat2;
          varying vec3 vTint; varying vec3 vRest; flat varying vec4 vS0; flat varying vec4 vS1; flat varying vec4 vS2;` : ''}`)
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nobjectNormal = animate(objectNormal, true);')
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n${colour ? 'vRest = position; vS0 = aSplat0; vS1 = aSplat1; vS2 = aSplat2;' : ''}\ntransformed = animate(transformed, false);${colour ? `
          float part = partLimb.x, fl = aAnim.w;
          vec3 shirt = unpack(aCol0.x), pants = unpack(aCol0.y), skin = unpack(aCol0.z), hair = unpack(aCol0.w), accA = unpack(aCol1.x), accB = unpack(aCol1.y);
          vTint = part == 0.0 ? skin : part == 1.0 ? shirt : part == 2.0 ? (bit(fl, ${BIT.LUNGI}.0) ? accA : pants) : part == 3.0 || part > 18.5 && part < 21.5 ? hair
            : part == 4.0 ? vec3(0.03, 0.022, 0.018) : part == 5.0 || part == 8.0 || part == 22.0 || part == 16.0 ? accA : part == 9.0 ? vec3(0.9, 0.89, 0.85)
            : part == 6.0 ? (bit(fl, ${BIT.SARI}.0) ? pants : accA)
            : part == 10.0 ? (bit(fl, ${BIT.SHORTS}.0) ? skin : bit(fl, ${BIT.LUNGI}.0) ? accA : pants)
            : part == 11.0 ? (bit(fl, ${BIT.SLEEVES}.0) ? shirt : skin)
            : part == 12.0 ? (bit(fl, ${BIT.KURTA}.0) ? shirt : bit(fl, ${BIT.LUNGI}.0) ? accA : pants)
            : part == 17.0 ? pants : part == 18.0 ? accB : skin;` : ''}`);
    };
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
    const holi = { value: HOLI.map((c) => c.clone()) };
    mat.onBeforeCompile = (shader) => {
      vert(shader, true);
      shader.uniforms.uHoli = holi;
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec3 vTint; varying vec3 vRest; flat varying vec4 vS0; flat varying vec4 vS1; flat varying vec4 vS2;
          uniform vec3 uHoli[12];
          float blotch(vec3 p) { return fract(sin(dot(floor(p * 22.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
          vec4 patchAt(float packed, float code) {
            if (code < 0.0) return vec4(0.0);
            float zi = floor(packed / 32768.0), rem = packed - zi * 32768.0, yi = floor(rem / 128.0), xi = rem - yi * 128.0;
            vec3 c = vec3(xi / 127.0 - 0.5, yi / 255.0 * 2.0, zi / 127.0 - 0.5);
            float ci = floor(code), r = (code - ci) * 0.5;
            float d = distance(vRest * vec3(1.0, 0.8, 1.0), c * vec3(1.0, 0.8, 1.0));
            float edge = r * (0.65 + 0.55 * blotch(vRest + c));
            float a = 1.0 - smoothstep(edge * 0.75, edge, d);
            return vec4(uHoli[int(ci)], a * 0.92);
          }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          diffuseColor.rgb *= vTint;
          vec4 sp;
          sp = patchAt(vS0.x, vS0.y); diffuseColor.rgb = mix(diffuseColor.rgb, sp.rgb, sp.a);
          sp = patchAt(vS0.z, vS0.w); diffuseColor.rgb = mix(diffuseColor.rgb, sp.rgb, sp.a);
          sp = patchAt(vS1.x, vS1.y); diffuseColor.rgb = mix(diffuseColor.rgb, sp.rgb, sp.a);
          sp = patchAt(vS1.z, vS1.w); diffuseColor.rgb = mix(diffuseColor.rgb, sp.rgb, sp.a);
          sp = patchAt(vS2.x, vS2.y); diffuseColor.rgb = mix(diffuseColor.rgb, sp.rgb, sp.a);
          sp = patchAt(vS2.z, vS2.w); diffuseColor.rgb = mix(diffuseColor.rgb, sp.rgb, sp.a);`);
    };
    mat.customProgramCacheKey = () => 'gtb-people-v3';
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    depth.onBeforeCompile = (shader) => vert(shader, false);
    depth.customProgramCacheKey = () => 'gtb-people-depth-v3';

    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.customDepthMaterial = depth;
    this.mesh.count = 0;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.n = 0;
    this.pending = [];
    this.frameNo = 0;
    this.clock = null;     // the game clock (main.js): hour and Sundays for who wears what
    this.zoneT = 0;
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.p = new THREE.Vector3(); this.s = new THREE.Vector3();
  }

  begin() {
    this.n = 0; this.pending.length = 0; this.frameNo++;
    // Who gets dressed how: the hour, the day and the district around the player.
    if (this.clock) { NOW.hour = this.clock.hour; NOW.sunday = (this.clock.day | 0) % 7 === 0; }
    if (this.focus && --this.zoneT <= 0) { this.zoneT = 30; NOW.zone = zoneAt(this.focus.x, this.focus.z); }
  }

  /** Hide people right in front of the lens or between the camera and the player. */
  occludes(p) {
    if (!this.cam || p.isPlayer || p.keep) return false; // keep: someone riding with the player
    const c = this.cam, f = this.focus;
    const px = p.x - c.x, py = (p.y || 0) + 1.2 - c.y, pz = p.z - c.z;
    if (px * px + py * py + pz * pz < 4) return true;
    if (!f) return false;
    const fx = f.x - c.x, fy = f.y + 1 - c.y, fz = f.z - c.z, ff = fx * fx + fy * fy + fz * fz || 1;
    const t = (px * fx + py * fy + pz * fz) / ff;
    if (t <= 0 || t >= 0.92) return false;
    const dx = px - fx * t, dy = py - fy * t, dz = pz - fz * t;
    return dx * dx + dy * dy + dz * dz < 1.0;
  }

  /** Queue a person for this frame (written in end(), after real characters pick theirs). */
  add(p) { this.pending.push(p); }

  write(p) {
    if (this.n >= this.max || this.occludes(p)) return;
    const i = this.n++;
    this.q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, p.heading);
    const sc = p.scale ?? 1;
    this.m.compose(this.p.set(p.x, p.y || 0, p.z), this.q, this.s.set(sc, sc, sc));
    this.mesh.setMatrixAt(i, this.m);
    const L = p.look || lookFor(p);
    this.anim.setXYZW(i, p.phase ?? 0, p.pose ?? 0, p.amp ?? 1, ((p.flags || 0) & 5) | L.bits);
    this.col0.setXYZW(i, pack(p.shirt), pack(p.pants), pack(p.skin), pack(p.hair || L.hairColor));
    this.col1.setXYZW(i, pack(p.flags & 1 ? p.pants : p.flags & 4 && !L.hat ? p.hatColor || TURBAN_DEFAULT : L.accA), pack(L.accB), 0, 0);
    const pt = p.patches;
    for (let k = 0; k < 3; k++) {
      const a = pt ? pt[k * 2] : null, b = pt ? pt[k * 2 + 1] : null;
      this.splat[k].setXYZW(i, a ? a[0] : 0, a ? a[1] : -1, b ? b[0] : 0, b ? b[1] : -1);
    }
  }

  end() {
    const list = this.pending;
    this.beforeEnd?.(list);   // real rigged characters take the nearest people (p.hero)
    for (let i = 0; i < list.length; i++) if (!list[i].hero) this.write(list[i]);
    this.mesh.count = this.n;
    // Upload only the instances drawn this frame, not the whole buffers (the range replaces any
    // left from frames that were stepped but not drawn: everything below n was just written).
    if (!this.n) return;
    for (const a of this.attrs || (this.attrs = [this.mesh.instanceMatrix, this.anim, this.col0, this.col1, ...this.splat])) {
      a.clearUpdateRanges();
      a.addUpdateRange(0, this.n * a.itemSize);
      a.needsUpdate = true;
    }
  }

  /**
   * Someone on a traffic two-wheeler or auto (traffic.riders): one persistent person per
   * vehicle (a real character when near), astride the seat with hands on the handlebar,
   * pedalling a bicycle; an auto's passenger on the back bench.
   */
  rider(r, T, dt) {
    const sh = Math.sin(r.heading), ch = Math.cos(r.heading), seat = T?.seat ?? 0.92, back = -(T?.seatZ ?? -0.28);
    let p = r.person;
    if (!p) {
      const L = r.look, rnd = Math.random;
      const kind = T?.dabbawala ? 'dabbawala' : T?.open ? 'khaki' : !T?.pedal && T?.rider && T?.len < 1.95 && rnd() < 0.22 ? 'sari' : 'casual';
      const o = dress(kind, rnd);
      if (L.helmet) { o.look.hat = 'helmet'; o.look.accA.setHSL(rnd(), 0.5, 0.25); }
      if (kind === 'sari') {
        // Women ride scooters in salwar-kameez or jeans (no sari skirt astride).
        if (o.look.garment === 'sari' || o.look.garment === 'nauvari') { o.look.garment = 'kurta'; o.look.pallu = false; o.look.legs = 0; o.look.style = 'salwar'; o.look.dupatta = true; }
        o.look.garment = o.look.garment === 'kurta' ? 'kurtaShort' : o.look.garment;
        L.shirt = o.shirt; L.pants = o.pants; L.skin = o.skin;
      } else if (o.look.garment === 'lungi' || o.look.garment === 'sari') { o.look.garment = 'lungiShort'; o.look.legs = 2; }
      if (o.look.garment === 'kurta') o.look.garment = 'kurtaShort';
      finishBits(o.look);
      L.look = o.look; // a rider pulled off the bike (garage.eject) keeps the same look
      p = r.person = makePerson({ kind, shirt: L.shirt, pants: L.pants, skin: L.skin, look: o.look, flags: kind === 'sari' ? FLAG.SARI : 0, scale: 0.97 + rnd() * 0.06 });
    }
    if (T?.pedal) r.pedal += dt * (r.speed || 0) * 1.7;
    p.x = r.x - sh * back; p.z = r.z - ch * back; p.y = seat - (T?.pedal ? 0.86 : 0.42);
    p.heading = r.heading; p.phase = r.pedal; p.pose = T?.pedal ? POSE.PEDAL : POSE.RIDE;
    this.add(p);
    if (r.pax && T?.pax) {
      let q = r.paxPerson;
      if (!q) {
        const o = dress(r.pax.sari ? 'sari' : 'casual');
        q = r.paxPerson = makePerson({ kind: r.pax.sari ? 'sari' : 'casual', shirt: r.pax.shirt, pants: r.pax.pants, skin: r.pax.skin, look: o.look, flags: r.pax.sari ? FLAG.SARI : 0, scale: 0.96 });
      }
      q.x = r.x + sh * T.pax.z - ch * 0.22; q.z = r.z + ch * T.pax.z + sh * 0.22; q.y = T.pax.seat - 0.42;
      q.heading = r.heading; q.pose = POSE.SIT;
      this.add(q);
    }
  }
}
// Clothing palettes (sRGB) by kind of person: looks.js chooses; these stay for callers that read them.
const C = (hex) => new THREE.Color(hex);
export const SKIN = SKIN_TONES.map(([h]) => C(h));
/**
 * Clothes for a kind of person ('casual', 'office', 'worker', 'sari' (a woman), 'kid',
 * 'police', 'trafficCop', 'khaki', 'jogger', 'dabbawala'): { shirt, pants, skin, look },
 * by district, hour and day (see looks.js). `rnd` makes it repeatable.
 */
export function outfit(kind, rnd = Math.random, zone = NOW.zone, hour = NOW.hour, sunday = NOW.sunday) {
  return dress(kind, rnd, zone, hour, sunday);
}
