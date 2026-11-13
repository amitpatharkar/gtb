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
import { Signals } from './sim/signals.js';
import { Police } from './sim/police.js';
import { PeopleRenderer, POSE, FLAG } from './sim/people.js';
import { Bubbles } from './ui/bubbles.js';
import { StreetLife } from './sim/street.js';
import { Animals } from './sim/animals.js';
import { CityMap } from './ui/cityMap.js';
import { GameState } from './game/state.js';
import { Jobs } from './game/jobs.js';
import { Phone } from './ui/phone.js';
import { Walker } from './player/walker.js';
import { Pichkari } from './player/pichkari.js';
import { SkidMarks } from './vehicles/skids.js';
import { TaxiDamage } from './vehicles/damage.js';
import { PropPhysics } from './world/propPhysics.js';
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
const signals = new Signals(scene);
traffic.signals = signals;
const people = new PeopleRenderer(scene, tier.name === 'Low' ? 150 : 400);
const bubbles = new Bubbles(document.body);
const audio = new CityAudio(lib);
const minimap = new Minimap($('minimap'), tiles, index.fuel || []);
const cityMap = new CityMap({ index, baseUrl: `${BASE}tiles/`, fuel: index.fuel || [], hud: { message: (t) => say(t, 4) } });
minimap.nav = cityMap;
$('minimap').addEventListener('click', () => cityMap.toggle(true, player));

// The player drives a kaali-peeli taxi (auto-rickshaws aren't allowed in South Mumbai).
const taxi = createTaxi();
scene.add(taxi.root);
const player = new Car(taxi);
const state = new GameState();
Object.defineProperty(player, 'money', { get: () => state.money, set: (v) => { state.money = v; } }); // ₹ in the wallet
player.pay = (amount, what) => state.pay(amount, what);
const hud = { message: (t) => say(t, 4) };
const police = new Police({ scene, tiles, traffic, signals, people, audio, bubbles, hud });
const animals = new Animals(scene);
const street = new StreetLife({ scene, tiles, traffic, signals, people, animals, bubbles, audio, police, tier, hud });
const pichkari = new Pichkari(scene, { tiles, street, police, traffic, bubbles, audio, hud });
const jobs = new Jobs({ scene, tiles, traffic, signals, people, bubbles, audio, police, cityMap, state, hud, street });
jobs.taxi = player;
const phone = new Phone({ state, jobs, cityMap, clock, audio, player, onTier: () => cycleTier(tierKey), onPhoto: () => takePhoto() });
const propPhysics = new PropPhysics(scene, tiles, { bubbles, hud, state, audio });
const world = {
  hits: (x, z, r) => tiles.hits(x, z, r) || propPhysics.hits(x, z, r) || traffic.hits(x, z, r) || police.hits(x, z, r) || street.hits(x, z, r),
  groundHeight: (x, z) => tiles.wheelHeight(x, z),
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

// ------------------------------------------------------------------ on foot
const walker = new Walker(tiles);
const skids = new SkidMarks(scene);
const damage = new TaxiDamage(scene, taxi);
let onFoot = false;
const footWorld = { hits: (x, z, r) => tiles.hits(x, z, r) || propPhysics.hits(x, z, r) || traffic.hits(x, z, r) || police.hits(x, z, r) || street.hits(x, z, r) || taxiHits(x, z, r) };
function taxiHits(x, z, r) {
  const fx = Math.sin(player.heading) * 1.1, fz = Math.cos(player.heading) * 1.1;
  return (x - player.pos.x - fx) ** 2 + (z - player.pos.z - fz) ** 2 < (r + 0.8) ** 2 || (x - player.pos.x + fx) ** 2 + (z - player.pos.z - -fz) ** 2 < (r + 0.8) ** 2;
}
/** F: get out of the taxi (driver's side, it's right-hand drive) or back in. */
function toggleFoot() {
  if (!onFoot) {
    if (Math.abs(player.speed) > 2) { say('Slow down to get out', 1.5); return; }
    const h = player.heading, rx = -Math.cos(h), rz = Math.sin(h);
    let x = player.pos.x + rx * 1.6, z = player.pos.z + rz * 1.6;
    if (tiles.hits(x, z, 0.3)) { x = player.pos.x - rx * 1.6; z = player.pos.z - rz * 1.6; }
    walker.pos.set(x, tiles.groundHeight(x, z), z);
    walker.heading = h; walker.speed = 0;
    onFoot = true;
    if (jobs.ride?.stage === 'ride') say('Your passenger is waiting in the taxi!', 3);
    say('On foot: W/S walk, A/D turn, Shift run, Space pichkari, C colour, F back into the taxi', 5);
  } else {
    if (walker.pos.distanceTo(player.pos) > 4) { say('Walk to your taxi to get in', 1.5); return; }
    onFoot = false;
    walker.spraying = false;
  }
}

// ------------------------------------------------------------------ camera
const camPos = new THREE.Vector3();
const lookAt = new THREE.Vector3();
function placeCamera(dt) {
  // In the taxi: chase camera. On foot: closer, over the shoulder.
  const a = onFoot ? walker : player;
  const back = onFoot ? 3.8 : 6.4 + Math.abs(player.speed) * 0.12;
  const up = onFoot ? 1.9 : 2.5;
  const target = new THREE.Vector3(a.pos.x - Math.sin(a.heading) * back + (onFoot ? Math.cos(a.heading) * 0.5 : 0), a.pos.y + up, a.pos.z - Math.cos(a.heading) * back - (onFoot ? Math.sin(a.heading) * 0.5 : 0));
  // Keep the camera out of buildings: pull it in towards the player if a wall is in the way.
  const hx = a.pos.x, hz = a.pos.z;
  for (let i = 1; i <= 8; i++) {
    const t = i / 8, x = hx + (target.x - hx) * t, z = hz + (target.z - hz) * t;
    if (tiles.hits(x, z, 0.25)) { const k = Math.max(0.15, (i - 1) / 8); target.x = hx + (target.x - hx) * k; target.z = hz + (target.z - hz) * k; break; }
  }
  if (dt === 0) camPos.copy(target);
  else camPos.lerp(target, 1 - Math.exp(-dt * (onFoot ? 6 : 4.5)));
  camera.position.copy(camPos);
  lookAt.set(a.pos.x + Math.sin(a.heading) * 2, a.pos.y + (onFoot ? 1.45 : 1.2), a.pos.z + Math.cos(a.heading) * 2);
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
  if (e.code === 'Tab') { e.preventDefault(); cityMap.toggle(!cityMap.open, player); return; }
  if (e.code === 'Escape' && cityMap.open) { cityMap.toggle(false); return; }
  if (cityMap.open) return;
  if (e.code === 'KeyQ') cycleTier(tierKey);
  if (e.code === 'KeyH') honk();
  if (e.code === 'KeyP') phone.toggle();
  if (e.code === 'Escape' && phone.open) phone.toggle(false);
  if (e.code === 'KeyJ') jobs.toggleDuty(player);
  if (e.code === 'KeyF') toggleFoot();
  if (e.code === 'KeyC' && onFoot) pichkari.nextColour();
  if (e.code === 'KeyE') interact();
  if (e.code === 'KeyT') { clock.hour = (clock.hour + 1) % 24; say(`Time: ${clock.label}`, 1.5); }
  if (e.code === 'KeyM') audio.toggleMute();
});
addEventListener('pointerdown', () => audio.start());
$('btn-door')?.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.start(); toggleFoot(); });
for (const id of ['btn-horn', 'btn-fuel']) {
  $(id)?.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.start(); if (id === 'btn-horn') honk(); else interact(); });
}

/** E: refuel at a pump (in the taxi), or buy a snack at a thela. */
function interact() {
  if (!onFoot) {
    const p = nearestPump();
    if (p && p.d < 16) { refuel(); return; }
  }
  if (!jobs.buySnack(onFoot ? walker : player)) say(onFoot ? 'Walk up to a thela (food cart) and press E to buy a snack' : 'Stop at a petrol pump or next to a thela and press E', 2.5);
}

/** Knocked out on foot: wake up at the spawn, minus the hospital bill. */
function hospital() {
  state.pay(1500, 'Hospital bill');
  walker.health = 1;
  onFoot = false;
  respawn();
  placeCamera(0);
  say('You woke up in hospital. Bill: ₹1,500. Look both ways next time!', 5);
}

function honk() {
  if (onFoot) { pichkari.nextColour(); return; }
  if (state.owns('horn')) audio.musicalHorn?.(); else audio.play('horn', 0.9);
  street.onHorn();
  jobs.honk();
}
$('btn-phone').addEventListener('click', (e) => { e.preventDefault(); audio.start(); phone.toggle(); });

/** Camera app: hide the HUD for one frame and save a screenshot. */
function takePhoto() {
  document.body.classList.add('photo');
  post.render();
  renderer.domElement.toBlob((blob) => {
    document.body.classList.remove('photo');
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gtb-mumbai-${Date.now()}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    say('Photo saved', 2);
  });
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
  if (litres) state.pay(litres * 103, `Petrol ${litres} L`);
  player.fuel = 1;
  // The pump's mechanic fixes dents, bumpers and lamps too (for a price).
  const repair = Math.round((1 - player.condition) * 4000 / 50) * 50;
  if (repair > 0) state.pay(repair, 'Repairs at the pump');
  player.condition = 1;
  say(`${litres ? `Filled ${litres} L · ₹${litres * 103}` : 'Tank already full'}${repair > 0 ? ` · repairs ₹${repair}` : ' · tyres and water checked'}`);
}

// ------------------------------------------------------------------ loop
window.__gtb = { tiles, player, scene, camera, renderer, post, env, lib, tier, facadeDebug, clock, traffic, materials, input, facadeParts, signals, police, people, bubbles, street, animals, cityMap, state, jobs, phone, walker, pichkari, skids, damage, propPhysics, toggleFoot, get onFoot() { return onFoot; } };
const timer = new THREE.Timer();
let hudTimer = 0, lampTimer = 0, seaFactor = 0;
renderer.setAnimationLoop((time) => {
  timer.update(time);
  const dt = Math.min(timer.getDelta(), 0.05);
  if (cityMap.open) return; // paused while the map is open
  if (input.reset) { input.reset = false; teleportHome(); }
  step(dt);
  post.render();
});

/** One simulation step (also used by headless tests). */
const NO_INPUT = {};
function step(dt) {
  clock.update(dt);
  // The active body: the taxi, or the player on foot.
  const active = onFoot ? walker : player;
  player.update(dt, onFoot ? NO_INPUT : input, world);
  // Tyre marks and car sounds.
  skids.track(player, player.slip || 0, player.braking);
  audio.squeal(onFoot ? 0 : player.slip || 0);
  audio.engine(player.speed, onFoot ? 0 : player.throttle || 0, !onFoot);
  if (player.impact) {
    if (player.impact > 2.5) {
      audio.crash(Math.min(1, player.impact / 14));
      damage.impact(player.impactLocal[0], player.impactLocal[1], player.impact);
      propPhysics.impact(player.impact, Math.sin(player.heading), Math.cos(player.heading));
    }
    player.impact = 0;
  }
  damage.update(dt, player);
  if (!onFoot) propPhysics.sweep(player);
  propPhysics.update(dt, onFoot ? null : player);
  if (player.condition > 0.97 && (damage.front || damage.rear)) damage.repair();
  if (onFoot) {
    walker.update(dt, input, footWorld, state.s.energy, clock.aqi);
    // Careless drivers knock you over.
    for (const c of traffic.cars) {
      if (c.speed > 2 && Math.hypot(c.x - walker.pos.x, c.z - walker.pos.z) < 1.5 && walker.down <= 0) {
        walker.knock(0.08 + c.speed * 0.02);
        bubbles.say(c, 'Arre! Dekh ke chal!', 2, 'driver');
      }
    }
    if (walker.health <= 0) hospital();
  } else walker.health = Math.min(1, walker.health + dt * 0.002);
  tiles.update(active.pos.x, active.pos.z);
  traffic.update(dt, active, clock);
  signals.update(dt, tiles, traffic, active.pos, clock.night);
  people.begin();
  police.onFoot = onFoot;
  police.update(dt, active, clock);
  street.onFoot = onFoot;
  street.update(dt, active, clock);
  if (onFoot) walker.draw(people);
  for (const r of traffic.riders) {
    // Motorbike riders sit astride, hands on the handlebar; most wear helmets.
    people.add({ x: r.x - Math.sin(r.heading) * 0.15, y: 0.5, z: r.z - Math.cos(r.heading) * 0.15, heading: r.heading, phase: 0, pose: POSE.SIT, amp: 1, flags: r.look.helmet ? FLAG.BERET : 0, scale: 1, ...r.look });
  }
  pichkari.update(dt, onFoot ? walker : null, onFoot && input.brake);
  people.end();
  placeCamera(dt);
  bubbles.update(dt, camera);
  env.update(dt, active.pos, clock);

  // Night: lit windows and signs, glowing lamps, real lights on the nearest lamp posts.
  const night = clock.night;
  facadeNight.value = night;
  facadeParts.update(dt, player, tiles, night);
  tiles.props.lampMat.emissiveIntensity = night * 9;
  const lamps = damage.headlampFactor(player.condition);
  taxi.lights.headMat.emissiveIntensity = (0.2 + night * 5) * lamps;
  headlamp.intensity = night * 60 * lamps;
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
  cityMap.update(dt, onFoot ? walker : player);
  state.update(dt, clock);
  jobs.focus = onFoot ? walker : player;
  jobs.update(dt, player);
  phone.update(dt);
  minimap.update(dt, onFoot ? walker : player, traffic);
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
  $('speed').textContent = `${Math.round(Math.abs((onFoot ? walker : player).speed) * 3.6)} km/h`;
  $('fuel-label').textContent = onFoot ? 'Stamina' : 'Fuel';
  $('cond-label').textContent = onFoot ? 'Health' : 'Car';
  $('road').textContent = tiles.roadNameAt(player.pos.x, player.pos.z);
  $('clock').textContent = clock.label;
  const [label, colour] = clock.aqiLabel;
  $('aqi').innerHTML = `AQI <b style="color:${colour}">${clock.aqi}</b> ${label}`;
  $('fuel-bar').style.width = `${Math.round((onFoot ? walker.stamina : player.fuel) * 100)}%`;
  $('fuel-bar').style.background = player.fuel < 0.15 ? '#e74c3c' : '#f7c600';
  $('cond-bar').style.width = `${Math.round((onFoot ? walker.health : player.condition) * 100)}%`;
  $('food-bar').style.width = `${Math.round(state.s.hunger * 100)}%`;
  $('food-bar').style.background = state.s.hunger < 0.2 ? '#e74c3c' : '#f39c12';
  $('energy-bar').style.width = `${Math.round(state.s.energy * 100)}%`;
  $('btn-phone').dataset.unread = state.unread || '';
  $('money').textContent = `₹${player.money.toLocaleString('en-IN')}`;
  $('money').classList.toggle('debt', player.money < 0);
  const w = $('wanted');
  w.textContent = police.stars ? '★'.repeat(police.stars) + '☆'.repeat(5 - police.stars) : '';
  w.title = police.fines ? `Unpaid challans: ₹${police.fines.toLocaleString('en-IN')}` : '';
  w.classList.toggle('blink', police.stars > 0 && police.unseen > 0.6);
  if (messageTimer <= 0) {
    if (police.flagger) message = 'Traffic police is waving you down: stop next to him to pay the challan';
    else if (police.stars >= 2 && police.patrols.length) message = 'Police chasing! Stop to pay up, or get out of sight';
    const p = nearestPump();
    if (!police.flagger && !(police.stars >= 2 && police.patrols.length)) message = player.fuel <= 0 ? 'Out of fuel! Press R to get towed back' :
      p && p.d < 16 ? 'Petrol pump: stop and press F to fill up' :
      player.fuel < 0.12 ? 'Low fuel — find ⛽ on the map' :
      player.condition < 0.35 ? 'Car is battered: get it checked at a ⛽' :
      state.s.hunger < 0.15 ? 'Pet mein chuhe daud rahe hain! Eat at a thela (E) or order on Bhookh (P)' :
      state.s.energy < 0.12 ? 'So tired… have a cutting chai (E at a thela)' : '';
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
