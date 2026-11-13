import * as THREE from 'three';
import { input } from './input.js';
import { TileManager } from './world/tiles.js';
import { createMaterials } from './world/materials.js';
import { createEnvironment } from './world/environment.js';
import { setupCredits } from './credits.js';
import { TIERS, pickTier, cycleTier, query } from './settings.js';
import { TextureLibrary } from './world/textures.js';
import { createPost } from './render/post.js';
import { facadeDebug, facadeNight } from './world/facade.js';
import { createTaxi } from './vehicles/taxi.js';
import { Car } from './vehicles/car.js';
import { GameClock } from './sim/clock.js';
import { Traffic } from './sim/traffic.js';
import { FacadeParts } from './world/facadeParts.js';
import { Minimap } from './ui/minimap.js';
import { CityAudio } from './audio.js';
import { POINT } from './world/tileFormat.js';

const BASE = import.meta.env.BASE_URL;
const tierKey = TIERS[query.get('quality')] ? query.get('quality') : pickTier();
const tier = TIERS[tierKey];
const $ = (id) => document.getElementById(id);

// ------------------------------------------------------------------ renderer
const renderer = new THREE.WebGLRenderer({ antialias: !tier.ao && !tier.bloom, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, tier.pixelRatio));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.62;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.4, 2000);

setupCredits(BASE);
$('quality').textContent = `Graphics: ${tier.name}`;
$('quality').addEventListener('click', (e) => { e.preventDefault(); cycleTier(tierKey); });

// ------------------------------------------------------------------ world
const lib = await new TextureLibrary(renderer, BASE, tier).init();
const materials = createMaterials(renderer, lib, tier);
loadSignFonts(lib, materials.signs);
const tiles = new TileManager(scene, materials, tier);
const index = await tiles.init(`${BASE}tiles/`).catch((err) => { $('loading').textContent = String(err.message || err); throw err; });
const env = await createEnvironment(renderer, scene, index.bounds, tier, lib);
const post = createPost(renderer, scene, camera, tier);
const startHour = Number(query.get('hour'));
const clock = new GameClock(query.has('hour') && Number.isFinite(startHour) ? startHour : 17.25);
const traffic = new Traffic(scene, tiles, tier);
const facadeParts = new FacadeParts(scene, lib, materials.signs.texture, tier);
const audio = new CityAudio(lib);
const minimap = new Minimap($('minimap'), tiles, index.fuel || []);

// The player drives a kaali-peeli taxi (auto-rickshaws aren't allowed in South Mumbai).
const taxi = createTaxi();
scene.add(taxi.root);
const player = new Car(taxi);
const world = {
  hits: (x, z, r) => tiles.hits(x, z, r) || traffic.hits(x, z, r),
  groundHeight: (x, z) => tiles.groundHeight(x, z),
};
const spawn = index.spawn;
function respawn() {
  player.pos.set(spawn.x, 0.02, spawn.z);
  player.heading = spawn.heading;
  player.speed = 0;
  player.fuel = Math.max(player.fuel, 0.3);
}
respawn();

// Night lighting near the player: real lights on the closest street lamps, taxi headlamps.
const lampLights = Array.from({ length: tier.name === 'Low' ? 2 : 6 }, () => {
  const l = new THREE.PointLight(0xffd9a6, 0, 30, 1.8);
  scene.add(l);
  return l;
});
const headlamp = new THREE.SpotLight(0xfff1d6, 0, 70, 0.55, 0.6, 1.6);
headlamp.position.set(0, 0.7, 1.9);
headlamp.target.position.set(0, 0, 22);
taxi.root.add(headlamp, headlamp.target);

// ------------------------------------------------------------------ camera
const camPos = new THREE.Vector3();
const lookAt = new THREE.Vector3();
function placeCamera(dt) {
  const back = 6.4 + Math.abs(player.speed) * 0.12;
  const target = new THREE.Vector3(player.pos.x - Math.sin(player.heading) * back, player.pos.y + 2.5, player.pos.z - Math.cos(player.heading) * back);
  if (dt === 0) camPos.copy(target);
  else camPos.lerp(target, 1 - Math.exp(-dt * 4.5));
  camera.position.copy(camPos);
  lookAt.set(player.pos.x + Math.sin(player.heading) * 2, player.pos.y + 1.2, player.pos.z + Math.cos(player.heading) * 2);
  camera.lookAt(lookAt);
}
placeCamera(0);

await tiles.whenReady(spawn.x, spawn.z, 350, (done, total) => { $('loading').textContent = `Loading ${index.name}… ${done}/${total}`; });
$('loading').remove();

// ------------------------------------------------------------------ controls
let teleporting = false;
async function teleportHome() {
  if (teleporting) return;
  teleporting = true;
  $('fade').classList.add('on');
  await new Promise((r) => setTimeout(r, 250));
  respawn();
  placeCamera(0);
  await tiles.whenReady(spawn.x, spawn.z, 250);
  $('fade').classList.remove('on');
  teleporting = false;
}
let message = '', messageTimer = 0;
const say = (text, seconds = 3) => { message = text; messageTimer = seconds; };
addEventListener('keydown', (e) => {
  audio.start();
  if (e.repeat) return;
  if (e.code === 'KeyQ') cycleTier(tierKey);
  if (e.code === 'KeyH') audio.play('horn', 0.9);
  if (e.code === 'KeyT') { clock.hour = (clock.hour + 1) % 24; say(`Time: ${clock.label}`, 1.5); }
  if (e.code === 'KeyM') audio.toggleMute();
  if (e.code === 'KeyF') refuel();
});
addEventListener('pointerdown', () => audio.start());
for (const id of ['btn-horn', 'btn-fuel']) {
  $(id)?.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.start(); if (id === 'btn-horn') audio.play('horn', 0.9); else refuel(); });
}

function nearestPump() {
  let best = null;
  for (const [x, z] of index.fuel || []) {
    const d = Math.hypot(x - player.pos.x, z - player.pos.z);
    if (!best || d < best.d) best = { d, x, z };
  }
  return best;
}
function refuel() {
  const p = nearestPump();
  if (!p || p.d > 16) { say('No petrol pump here — find ⛽ on the map'); return; }
  if (Math.abs(player.speed) > 1) { say('Stop at the pump to fill up'); return; }
  const litres = Math.round((1 - player.fuel) * 35);
  player.fuel = 1;
  player.condition = Math.min(1, player.condition + 0.2);
  say(litres ? `Filled ${litres} litres · ₹${litres * 103} · tyres and water checked` : 'Tank already full');
}

// ------------------------------------------------------------------ loop
window.__gtb = { tiles, player, scene, camera, renderer, post, env, lib, tier, facadeDebug, clock, traffic, materials, input, facadeParts };
const timer = new THREE.Timer();
let hudTimer = 0, lampTimer = 0, seaFactor = 0;
renderer.setAnimationLoop((time) => {
  timer.update(time);
  const dt = Math.min(timer.getDelta(), 0.05);
  if (input.reset) { input.reset = false; teleportHome(); }
  step(dt);
  post.render();
});

/** One simulation step (also used by headless tests). */
function step(dt) {
  clock.update(dt);
  player.update(dt, input, world);
  tiles.update(player.pos.x, player.pos.z);
  traffic.update(dt, player, clock);
  placeCamera(dt);
  env.update(dt, player.pos, clock);

  // Night: lit windows and signs, glowing lamps, real lights on the nearest lamp posts.
  const night = clock.night;
  facadeNight.value = night;
  facadeParts.update(dt, player, tiles, night);
  tiles.props.lampMat.emissiveIntensity = night * 9;
  taxi.lights.headMat.emissiveIntensity = 0.2 + night * 5;
  headlamp.intensity = night * 60;
  lampTimer -= dt;
  if (lampTimer <= 0) {
    lampTimer = 0.4;
    placeLampLights(night);
    seaFactor = nearSea();
  }
  for (const [x, z] of traffic.honks.splice(0)) {
    const d = Math.hypot(x - player.pos.x, z - player.pos.z);
    if (d < 80 && Math.random() < 0.6) audio.play(Math.random() < 0.25 ? 'truckHorn' : 'horn', 0.5 / (1 + d / 15));
  }
  audio.update(seaFactor, clock.traffic, clock.daylight);
  minimap.update(dt, player, traffic);
  hudTimer -= dt;
  messageTimer -= dt;
  if (hudTimer <= 0) { hudTimer = 0.2; updateHud(); }
}
window.__gtb.step = step;

function placeLampLights(night) {
  if (night < 0.05) { lampLights.forEach((l) => (l.intensity = 0)); return; }
  const near = [];
  for (const t of tiles.tiles.values()) {
    const arr = t.points[POINT.LIGHT];
    if (!arr) continue;
    for (let i = 0; i < arr.length; i += 5) {
      const ang = arr[i + 3];
      // The lamp head hangs 1.9 m out over the road.
      const x = arr[i] + t.origin[0] + Math.sin(ang) * 1.9, z = arr[i + 2] + t.origin[1] + Math.cos(ang) * 1.9;
      const d = (x - player.pos.x) ** 2 + (z - player.pos.z) ** 2;
      if (d < 120 * 120) near.push([d, x, z]);
    }
  }
  near.sort((a, b) => a[0] - b[0]);
  lampLights.forEach((l, i) => {
    const n = near[i];
    if (!n) { l.intensity = 0; return; }
    l.position.set(n[1], 8.6, n[2]);
    l.intensity = night * 55;
  });
}

/** 0..1: how much open sea is around the player (for wave sounds). */
function nearSea() {
  let wet = 0;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    if (!tiles.walkable(player.pos.x + Math.cos(a) * 45, player.pos.z + Math.sin(a) * 45)) wet++;
  }
  return Math.min(1, wet / 3);
}

function updateHud() {
  $('speed').textContent = `${Math.round(Math.abs(player.speed) * 3.6)} km/h`;
  $('road').textContent = tiles.roadNameAt(player.pos.x, player.pos.z);
  $('clock').textContent = clock.label;
  const [label, colour] = clock.aqiLabel;
  $('aqi').innerHTML = `AQI <b style="color:${colour}">${clock.aqi}</b> ${label}`;
  $('fuel-bar').style.width = `${Math.round(player.fuel * 100)}%`;
  $('fuel-bar').style.background = player.fuel < 0.15 ? '#e74c3c' : '#f7c600';
  $('cond-bar').style.width = `${Math.round(player.condition * 100)}%`;
  if (messageTimer <= 0) {
    const p = nearestPump();
    message = player.fuel <= 0 ? 'Out of fuel! Press R to get towed back' :
      p && p.d < 16 ? 'Petrol pump: stop and press F to fill up' :
      player.fuel < 0.12 ? 'Low fuel — find ⛽ on the map' :
      player.condition < 0.35 ? 'Car is battered: get it checked at a ⛽' : '';
  }
  $('message').textContent = message;
  $('message').style.opacity = message ? 1 : 0;
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  post.setSize(size.x, size.y);
});

/** Load the Devanagari + Latin sign fonts from media/ and redraw the shop signs with them. */
async function loadSignFonts(library, signs) {
  if (!library.available || !('FontFace' in window)) return;
  const want = { deva: ['font-baloo2', 'Baloo 2'], latin1: ['font-yatraone', 'Yatra One'], latin2: ['font-rozhaone', 'Rozha One'], latin3: ['font-teko', 'Teko'] };
  const families = {};
  await Promise.all(Object.entries(want).map(async ([slot, [id, family]]) => {
    const url = library.url(id);
    if (!url) return;
    try {
      const face = await new FontFace(family, `url(${url})`).load();
      document.fonts.add(face);
      families[slot] = family;
    } catch { /* keep the fallback font */ }
  }));
  signs.redraw(families);
}
