import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PeopleLibrary, SKIN_TONES, HAIR_COLOURS, LOD_DIST, dress } from './humans.js';
import { Motion, EXPRESSIONS } from './motion.js';

// People lineup (people.html): every body template in a row, in random Mumbai colours, to
// judge the people on a phone or laptop without starting the game. Buttons: new colours,
// face expressions, movement, level of detail, close-up.

const BASE = import.meta.env.BASE_URL;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fb3c4);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;
const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
sun.position.set(-6, 12, 9);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 6, bottom: -6, near: 1, far: 40 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
scene.add(sun, new THREE.HemisphereLight(0xcfe3ff, 0x5a4c3e, 0.5));
const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), new THREE.MeshStandardMaterial({ color: 0x8a8580, roughness: 0.95 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
scene.add(ground);

const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.05, 200);
camera.position.set(0, 1.6, 14);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.0, 0);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.495;

addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// --- colours worn on Mumbai streets
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const SHIRT_M = [0xf2f2ee, 0xdfe8f2, 0xbcd3ea, 0xe8e2d0, 0x9fb4c8, 0x7c2e3a, 0x3d4a5c, 0xc9b79c, 0x6f8f72, 0x2f3b55, 0xb85c38];
const TROUSER_M = [0x2a2d33, 0x3b3f47, 0x4a4036, 0x1d2430, 0x6b5d48, 0x252525, 0x5a5f66];
const TOP_F = [0xc0392b, 0xd35400, 0x8e44ad, 0x1f618d, 0x117a65, 0xd4ac0d, 0xe91e63, 0x16a085, 0xf39c12, 0x7d3c98, 0xf5e6c8, 0x2e86c1];
const BOTTOM_F = [0xf4efe6, 0x1c1c1c, 0x2c3e50, 0x7d3c98, 0xb03a2e, 0xd4ac0d, 0x5b2c6f, 0x1f3a5f];
function randomLook(p) {
  const female = p.sex === 'f', old = p.age > 58;
  const hair = p.palette?.hair ? HAIR_COLOURS[p.palette.hair] : old && Math.random() < 0.6 ? pick([HAIR_COLOURS.grey, HAIR_COLOURS.white]) : Math.random() < 0.85 ? HAIR_COLOURS.black : pick([HAIR_COLOURS.darkBrown, HAIR_COLOURS.henna]);
  return {
    skin: pick(SKIN_TONES), hair,
    top: female ? pick(TOP_F) : pick(SHIRT_M), bottom: female ? pick(BOTTOM_F) : pick(TROUSER_M),
    shoes: pick([0x1a1a1a, 0x3a2a1e, 0x6b4a32, 0xd8d4cc]), extra: pick(TOP_F), accent: pick([0xd9a21b, 0xe8c15a, 0xb3122a, 0x0f6b4f]),
  };
}

const FACES = [...Object.keys(EXPRESSIONS), 'talking'];

const lib = new PeopleLibrary(renderer, BASE, { msaa: true });
const people = [];
let faceI = 0, lodMode = -1, animI = 0, closeUp = false;
const info = document.getElementById('info'), who = document.getElementById('who');

async function start() {
  await lib.init();
  const list = lib.people;
  const gap = 0.9;
  const x0 = -((list.length - 1) * gap) / 2;
  await Promise.all(list.map(async (p, i) => {
    const person = await lib.make(p.id, randomLook(p));
    person.root.position.set(x0 + i * gap, 0, 0);
    scene.add(person.root);
    person.motion = new Motion(person, lib);
    people[i] = person;
  }));
  // The main character, at the front of the line, as he looks on High.
  try {
    const t = await lib.hero('High');
    const hero = lib.instantiateHero(t);
    hero.root.position.set(x0 - gap * 1.6, 0, 0.4);
    scene.add(hero.root);
    hero.motion = new Motion(hero, lib);
    people.push(hero);
  } catch (e) { console.warn('main character:', e.message); }
  info.textContent = `${list.length} people · ${(list.reduce((a, p) => a + p.bytes, 0) / 1048576).toFixed(1)} MB + atlas`;
  who.textContent = 'Drag to look around, pinch or scroll to zoom. Heights: ' + list.map((p) => `${p.id.replace(/_/g, ' ')} ${Math.round(p.heightCm)} cm`).join(' · ');
  /** For tests: pose one person, alone, and frame the camera on them (view 'front' | 'side' | 'face'). */
  const show = (id, clip, override = {}, view = 'front', at) => {
    const p = people.find((x) => x.id === id);
    for (const q of people) q.root.visible = q === p;
    p.override = override;
    lodMode = override.lod ?? -1;
    const a = p.motion.play(clip, { fade: 0, time: at, speed: at !== undefined ? 0 : 1 });
    const x = p.root.position.x, h = p.info.heightCm / 100, z0 = p.root.position.z;
    if (view === 'face') { controls.target.set(x, h - 0.12, z0); camera.position.set(x + 0.12, h - 0.1, z0 + 0.7); }
    else if (view === 'torso') { controls.target.set(x, h * 0.7, 0); camera.position.set(x + 0.35, h * 0.72, 1.3); }
    else if (view === 'torsoSide') { controls.target.set(x, h * 0.7, 0); camera.position.set(x + 1.3, h * 0.72, 0.25); }
    else if (view === 'back') { controls.target.set(x, h * 0.75, 0); camera.position.set(x + 0.6, h * 0.85, -2.2); }
    else if (view === 'side') { controls.target.set(x, h * 0.55, 0); camera.position.set(x + 3.4, h * 0.6, 0.2); }
    else { controls.target.set(x, h * 0.55, 0); camera.position.set(x + 0.2, h * 0.6, 3.4); }
    return !!a;
  };
  window.__people = { lib, people, scene, camera, renderer, controls, THREE, show };
}

document.getElementById('look').onclick = () => { for (const p of people) dress(p, randomLook(p.info)); };
document.getElementById('face').onclick = (e) => { faceI = (faceI + 1) % FACES.length; e.target.textContent = `Face: ${FACES[faceI]}`; };
document.getElementById('lod').onclick = (e) => { lodMode = lodMode >= 2 ? -1 : lodMode + 1; e.target.textContent = `Detail: ${lodMode < 0 ? 'auto' : ['near', 'mid', 'far'][lodMode]}`; };
document.getElementById('anim').onclick = (e) => { animI = (animI + 1) % Motion.LIST.length; e.target.textContent = `Move: ${Motion.LIST[animI]}`; for (const p of people) p.motion?.play(['wave', 'kick'].includes(Motion.LIST[animI]) ? (Motion.LIST[animI] === 'kick' ? 'jab' : 'idle') : Motion.LIST[animI], Motion.LIST[animI] === 'kick' ? { speed: 0, time: 0.08 } : {}); };
document.getElementById('close').onclick = (e) => {
  closeUp = !closeUp; e.target.classList.toggle('on', closeUp);
  const p = people[Math.floor(Math.random() * people.length)];
  if (!p) return;
  const head = p.bones.get('head'), v = new THREE.Vector3();
  head.getWorldPosition(v);
  controls.target.copy(closeUp ? v : new THREE.Vector3(0, 1, 0));
  camera.position.copy(closeUp ? v.clone().add(new THREE.Vector3(0.25, 0.05, 0.9)) : new THREE.Vector3(0, 1.6, 14));
};

let last = performance.now(), t = 0;
renderer.setAnimationLoop(() => {
  const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
  t += dt;
  controls.update();
  const v = new THREE.Vector3();
  for (const p of people) {
    if (!p) continue;
    p.root.getWorldPosition(v);
    const d = v.distanceTo(camera.position);
    p.setLod(lodMode >= 0 ? lodMode : d < LOD_DIST.High[0] ? 0 : d < LOD_DIST.High[1] ? 1 : 2);
    const name = Motion.LIST[animI];
    const o = p.override || {};
    p.motion?.update(dt, { lookAt: camera, heading: 0, expression: o.expression ?? (FACES[faceI] === 'talking' ? 'neutral' : FACES[faceI]),
      talking: o.talking ?? FACES[faceI] === 'talking', wave: o.wave ?? name === 'wave', kick: o.kick ?? name === 'kick', kickAt: o.kickAt });
  }
  renderer.render(scene, camera);
});

start().catch((e) => { info.textContent = `failed: ${e.message}`; console.error(e); });
