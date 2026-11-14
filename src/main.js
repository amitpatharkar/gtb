import * as THREE from 'three';
import { input } from './input.js';
import { TileManager } from './world/tiles.js';
import { createMaterials } from './world/materials.js';
import { createEnvironment } from './world/environment.js';
import { setupCredits } from './credits.js';
import { TIERS, pickTier, query } from './settings.js';
import { TextureLibrary } from './world/textures.js';
import { createPost } from './render/post.js';
import { facadeDebug, facadeNight } from './world/facade.js';
import { createTaxi } from './vehicles/taxi.js';
import { Car } from './vehicles/car.js';
import { GameClock } from './sim/clock.js';
import { Traffic } from './sim/traffic.js';
import { FacadeParts } from './world/facadeParts.js';
import { Skyline } from './world/skyline.js';
import { Birds } from './sim/birds.js';
import { updateNightLights } from './world/nightLights.js';
import { Signals } from './sim/signals.js';
import { Police } from './sim/police.js';
import { PeopleRenderer, POSE, FLAG, HOLI, outfit } from './sim/people.js';
import { Bubbles } from './ui/bubbles.js';
import { StreetLife } from './sim/street.js';
import { Animals } from './sim/animals.js';
import { CityMap } from './ui/cityMap.js';
import { Navigator } from './ui/navigator.js';
import { Landmarks } from './world/landmarks.js';
import { StreetProps } from './world/streetProps.js';
import { Radio } from './radio.js';
import { Characters } from './sim/characters.js';
import { Cheats } from './game/cheats.js';
import { Garage } from './vehicles/garage.js';
import { Crackers } from './game/crackers.js';
import { Stars } from './game/stars.js';
import { Eggs } from './game/eggs.js';
import { Interiors } from './world/interiors.js';
import { Story } from './game/story.js';
import { GameState } from './game/state.js';
import { Jobs } from './game/jobs.js';
import { Phone } from './ui/phone.js';
import { Walker } from './player/walker.js';
import { Pichkari } from './player/pichkari.js';
import { SkidMarks } from './vehicles/skids.js';
import { TaxiDamage } from './vehicles/damage.js';
import { PropPhysics } from './world/propPhysics.js';
import { ViewControl } from './player/view.js';
import { Combat } from './player/combat.js';
import { Minimap } from './ui/minimap.js';
import { CityAudio } from './audio.js';
import { POINT } from './world/tileFormat.js';
import { titleScreen, loadingScreen, pauseMenu, loadSettings } from './ui/menu.js';

const BASE = import.meta.env.BASE_URL;

// ------------------------------------------------------------------ title screen
// A quality change mid-game saves where you are and reloads straight back into the game.
const RESUME_KEY = 'gtb.resume';
let resume = null;
try { resume = JSON.parse(sessionStorage.getItem(RESUME_KEY) || 'null'); sessionStorage.removeItem(RESUME_KEY); } catch { /* ignore */ }
let settings = loadSettings();
let newGame = false;
const skipMenu = resume || query.has('play') || query.has('quality') || query.has('hour');
// Warm the HTTP cache while the title screen is up: map index, asset manifest, the sky.
for (const u of ['tiles/index.json', 'media/manifest.json']) fetch(`${BASE}${u}`, { priority: 'high' }).catch(() => {});
fetch(`${BASE}media/manifest.json`).then((r) => r.json()).then((m) => {
  const sky = m.assets.find((a) => a.id === 'hdri-qwantani-late-afternoon-puresky');
  if (sky) fetch(`${BASE}media/${sky.files[0]}`, { priority: 'high' }).catch(() => {});
}).catch(() => {});
// Extras (characters, street-prop models, sign fonts) start downloading once play begins.
let markStarted;
const started = new Promise((r) => { markStarted = r; });
if (!skipMenu) {
  let save = null;
  try { const raw = JSON.parse(localStorage.getItem('gtb.save.v1') || 'null'); if (raw) save = { money: raw.money ?? 0, day: raw.day ?? 1, rides: raw.rides ?? 0 }; } catch { /* ignore */ }
  const choice = await titleScreen({ save });
  settings = choice.settings;
  newGame = choice.action === 'new';
}
const loader = loadingScreen();
const tierKey = TIERS[query.get('quality')] ? query.get('quality') : TIERS[settings.tier] ? settings.tier : pickTier();
const tier = TIERS[tierKey];
const $ = (id) => document.getElementById(id);

// ------------------------------------------------------------------ renderer
const renderer = new THREE.WebGLRenderer({ antialias: !tier.ao && !tier.bloom, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, tier.pixelRatio));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
// Khronos Neutral tone mapping: keeps paint and sky colours true (ACES turned Mumbai's cream
// and white buildings orange and muddied the shade). ?tone=aces|agx for comparisons.
renderer.toneMapping = { agx: THREE.AgXToneMapping, neutral: THREE.NeutralToneMapping, aces: THREE.ACESFilmicToneMapping }[query.get('tone')] ?? THREE.NeutralToneMapping;
renderer.exposureScale = Number(query.get('exposure')) || (renderer.toneMapping === THREE.NeutralToneMapping ? 1.05 : 1);
renderer.toneMappingExposure = 0.62;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.4, 2000);

setupCredits(BASE);
$('quality').textContent = `Graphics: ${tier.name}`;
$('quality').addEventListener('click', (e) => { e.preventDefault(); changeQuality(nextTier(tierKey)); });

// ------------------------------------------------------------------ world
const lib = await new TextureLibrary(renderer, BASE, tier).init();
const materials = createMaterials(renderer, lib, tier);
started.then(() => loadSignFonts(lib, materials.signs));
const tiles = new TileManager(scene, materials, tier);
loader.progress(0.1, 'Loading textures and the map…');
const index = await tiles.init(`${BASE}tiles/`).catch((err) => { $('loading').textContent = String(err.message || err); loader.progress(0, String(err.message || err)); throw err; });
loader.progress(0.2, 'Lighting the sky…');
const env = await createEnvironment(renderer, scene, index.bounds, tier, lib);
const post = createPost(renderer, scene, camera, tier);
const landmarks = new Landmarks(scene, index.landmarks || [], lib);
const streetProps = new StreetProps(scene, tiles, BASE, tier, started);
// (The Poly Haven AC model was 9k triangles and 7 MB of textures per copy; facade AC units
// stay procedural.)
const startHour = Number(query.get('hour'));
const clock = new GameClock(query.has('hour') && Number.isFinite(startHour) ? startHour : 17.25);
const traffic = new Traffic(scene, tiles, tier);
const facadeParts = new FacadeParts(scene, lib, materials.signs.texture, tier);
const skyline = new Skyline(scene, tiles, tier); // distant tall buildings beyond the loaded tiles
const signals = new Signals(scene);
traffic.signals = signals;
const people = new PeopleRenderer(scene, tier.name === 'Low' ? 280 : 520);
const characters = new Characters(scene, BASE, tier, lib, started);
let frameDt = 0;
people.beforeEnd = (list) => {
  interiors?.cull(list); // indoors, only the people in the room are drawn
  characters.update(frameDt, camera.position, list, onFoot || garage.seated ? walker.person : null);
};
const bubbles = new Bubbles(document.body);
const audio = new CityAudio(lib);
const radio = new Radio(audio);
const minimap = new Minimap($('minimap'), tiles, index.fuel || []);
const cityMap = new CityMap({ index, tiles, baseUrl: `${BASE}tiles/`, fuel: index.fuel || [], hud: { message: (t) => say(t, 4) } });
minimap.nav = cityMap;
const navigator = new Navigator(scene, cityMap, tiles);
$('minimap').addEventListener('click', () => cityMap.toggle(true, player));

// The player drives a kaali-peeli taxi (auto-rickshaws aren't allowed in South Mumbai).
const taxi = createTaxi();
scene.add(taxi.root);
const player = new Car(taxi);
const state = new GameState();
if (newGame) state.reset();
Object.defineProperty(player, 'money', { get: () => state.money, set: (v) => { state.money = v; } }); // ₹ in the wallet
player.pay = (amount, what) => state.pay(amount, what);
const hud = { message: (t) => say(t, 4) };
const police = new Police({ scene, tiles, traffic, signals, people, audio, bubbles, hud });
const animals = new Animals(scene);
const birds = new Birds(scene, tiles, audio); // pigeon flocks at famous spots, kites overhead
const street = new StreetLife({ scene, tiles, traffic, signals, people, animals, bubbles, audio, police, tier, hud });
// Clothes from the Ghar app wardrobe (bought on Dukaan).
function applyOutfit() {
  const o = state.s.outfit || 'default';
  const L = walker.look;
  if (o === 'jersey') { L.shirt.setHex(0x1d4fa0); L.pants.setHex(0xf0f0f0); }
  else if (o === 'kurta') { L.shirt.setHex(0xefe3c6); L.pants.setHex(0xf4f1ea); }
  else if (o === 'shades') { L.shirt.setHex(0x111111); L.pants.setHex(0x2b3a55); }
  else { L.shirt.setHex(0x1f8a8a); L.pants.setHex(0x24324a); }
}
const pichkari = new Pichkari(scene, { tiles, street, police, traffic, bubbles, audio, hud });
let combat = null; // created once the camera control exists (below)
const jobs = new Jobs({ scene, tiles, traffic, signals, people, bubbles, audio, police, cityMap, state, hud, street });
jobs.taxi = player;
const story = new Story({ scene, tiles, index, state, cityMap, hud, bubbles, people, jobs, street, clock, audio });
const phone = new Phone({ state, jobs, cityMap, clock, audio, player, onTier: () => changeQuality(nextTier(tierKey)), onPhoto: () => takePhoto() });
const propPhysics = new PropPhysics(scene, tiles, { bubbles, hud, state, audio });
const world = {
  hits: (x, z, r) => tiles.hits(x, z, r) || propPhysics.hits(x, z, r) || traffic.hits(x, z, r) || police.hits(x, z, r) || street.hits(x, z, r) || garage.taxiHits(x, z, r) || stars.hits(x, z, r),
  bodyAt: (x, z, r) => traffic.bodyAt(x, z, r), // other vehicles are pushed by mass rather than acting as walls
  groundHeight: (x, z) => { const y = tiles.wheelHeight(x, z); if (tiles.inPothole) world.pothole = true; return y; },
};
const spawn = index.spawn;
function respawn() {
  player.pos.set(spawn.x, 0.02, spawn.z);
  player.heading = spawn.heading;
  player.speed = 0;
  player.fuel = Math.max(player.fuel, 0.3);
}
respawn();
// Where the world was at the last save (taxi, clock, wanted level, orders on their way).
state.beforeSave = () => {
  if (teleporting) return;
  state.s.world = {
    ...(garage.home || { x: player.pos.x, z: player.pos.z, heading: player.heading, fuel: player.fuel, condition: player.condition }),
    hour: clock.hour, stars: police.stars, fines: police.fines, origin: JSON.stringify(index.origin),
    orders: jobs.riders.filter((r) => r.state === 'coming').map((r) => ({ app: r.app, items: r.items, eta: Math.max(20, r.eta - r.t) })),
  };
};
const saved = !newGame && !resume && state.s.world;
// Positions only make sense on the same map grid (the origin moves if the map is rebuilt differently).
if (saved && Number.isFinite(saved.x) && saved.origin === JSON.stringify(index.origin) && tiles.walkable(saved.x, saved.z)) {
  player.pos.set(saved.x, 0.02, saved.z);
  player.heading = saved.heading || 0;
  player.fuel = saved.fuel ?? player.fuel;
  player.condition = saved.condition ?? player.condition;
  if (Number.isFinite(saved.hour) && !query.has('hour')) clock.hour = saved.hour;
}
if (saved) {
  // Challans don't vanish with a reload; orders already paid for still arrive.
  police.stars = Math.min(5, saved.stars || 0); police.fines = saved.fines || 0;
  for (const o of saved.orders || []) {
    const look = outfit('casual');
    look.shirt = new THREE.Color(o.app === 'jhatpat' ? 0x2e9e44 : 0xf26722);
    jobs.riders.push({ app: o.app, items: o.items, eta: o.eta, t: 0, look, state: 'coming', person: null });
  }
}
if (resume) {
  player.pos.set(resume.x, 0.02, resume.z);
  player.heading = resume.heading;
  player.fuel = resume.fuel ?? player.fuel;
  player.condition = resume.condition ?? player.condition;
  if (Number.isFinite(resume.hour)) clock.hour = resume.hour;
}

/** Graphics changes rebuild every buffer, so save where we are and reload straight back in. */
function nextTier(t) { return { low: 'medium', medium: 'high', high: 'low' }[t] || 'low'; }
function changeQuality(next) {
  if (jobs.ride?.stage === 'ride') { say('Finish the ride before changing graphics', 3); return; }
  state.save();
  try {
    sessionStorage.setItem(RESUME_KEY, JSON.stringify({ x: player.pos.x, z: player.pos.z, heading: player.heading, hour: clock.hour, fuel: player.fuel, condition: player.condition }));
    localStorage.setItem('gtb.quality', next);
    const st = loadSettings(); st.tier = next; localStorage.setItem('gtb.settings', JSON.stringify(st));
  } catch { /* ignore */ }
  location.reload();
}

// Night lighting near the player: real lights on the closest street lamps, taxi headlamps.
const lampLights = Array.from({ length: tier.name === 'Low' ? 3 : 6 }, () => {
  const l = new THREE.PointLight(0xffd9a6, 0, 40, 1.6);
  scene.add(l);
  return l;
});
const headlamp = new THREE.SpotLight(0xfff1d6, 0, 130, 0.42, 0.5, 1.3);
const lowBeam = new THREE.SpotLight(0xfff1d6, 0, 30, 0.95, 0.8, 1.2); // wide light on the road just ahead
lowBeam.position.set(0, 0.7, 1.9);
lowBeam.target.position.set(0, 0, 9);
taxi.root.add(lowBeam, lowBeam.target);
headlamp.position.set(0, 0.7, 1.9);
headlamp.target.position.set(0, 0, 30);
taxi.root.add(headlamp, headlamp.target);
lowBeam.userData.reach = 7; headlamp.userData.reach = 20;
// Any vehicle on the street can be taken and driven (F next to it, on foot).
const garage = new Garage({ scene, player, taxi, traffic, street, police, bubbles, audio, hud, outfit, lamps: [lowBeam, headlamp] });
jobs.garage = garage; // fares can also be taken in an auto-rickshaw

// ------------------------------------------------------------------ on foot
const walker = new Walker(tiles);
state.listeners.add(applyOutfit);
applyOutfit();
const skids = new SkidMarks(scene);
const damage = new TaxiDamage(scene, taxi);
let onFoot = false;
const footWorld = { hits: (x, z, r) => tiles.hits(x, z, r) || propPhysics.hits(x, z, r) || traffic.hits(x, z, r) || police.hits(x, z, r) || street.hits(x, z, r) || taxiHits(x, z, r) || stars.hits(x, z, r) };
/** The vehicle the player left (taxi or borrowed) and the parked taxi are solid for people on foot. */
function taxiHits(x, z, r) {
  const fx = Math.sin(player.heading), fz = Math.cos(player.heading);
  for (const o of player.circles || [player.halfLength, -player.halfLength]) if ((x - player.pos.x - fx * o) ** 2 + (z - player.pos.z - fz * o) ** 2 < (r + player.radius) ** 2) return true;
  return garage.taxiHits(x, z, r);
}
/**
 * F: get out of the vehicle (driver's side, right-hand drive). On foot, F gets into the
 * nearest vehicle: the one you left, your taxi, or anybody else's (that is a theft).
 */
let footHints = 0;
function toggleFoot() {
  if (interiors?.inside) { say('Step outside first', 1.5); return; } // no vehicles indoors
  if (!onFoot) {
    if (Math.abs(player.speed) > 2) { say('Slow down to get out', 1.5); return; }
    const h = player.heading, rx = -Math.cos(h), rz = Math.sin(h), side = player.radius + 0.8;
    let x = player.pos.x + rx * side, z = player.pos.z + rz * side;
    if (tiles.hits(x, z, 0.3)) { x = player.pos.x - rx * side; z = player.pos.z - rz * side; }
    walker.pos.set(x, tiles.groundHeight(x, z), z);
    walker.heading = h; walker.speed = 0;
    onFoot = true;
    if (jobs.ride?.stage === 'ride') say('Your passenger is waiting in the taxi!', 3);
    // The long reminder only the first couple of times: it hides door prompts while it is up.
    if ((footHints = (footHints || 0) + 1) <= 2) say('On foot: mouse looks · WASD walk · Shift run · left click punch/spray · right click aim · V kick · G insult · 1 fists, 2 pichkari · X light a cracker (Z changes it) · E at a glowing door goes in · F near any vehicle steals it (run to the driver\'s door, pull them out)', 6);
  } else {
    // Nearest of: what you were driving, your parked taxi, anything else on the street.
    const wx = walker.pos.x, wz = walker.pos.z;
    const mine = Math.hypot(wx - player.pos.x, wz - player.pos.z) - player.radius - player.halfLength * 0.6;
    const home = garage.home ? Math.hypot(wx - garage.home.x, wz - garage.home.z) - 1.4 : Infinity;
    const other = garage.nearest(wx, wz, JACK_REACH);
    // Your own vehicles come first when you are standing next to them — unless something else
    // is clearly closer, or it is a vehicle lent to you for a mission.
    const own = Math.min(mine, home);
    if (own > 2.6 && !other) { say('Walk up to a vehicle to get in (F within a few metres)', 1.5); return; }
    if (own <= 2.6 && !(other && (other.v.lent || other.d < own - 0.6))) { if (home < mine) garage.toTaxi(); }
    else if (other.d > 1.2) { startJack(other); return; } // GTA-style: run to the driver's door first
    else takeVehicle(other);
    onFoot = false;
    walker.spraying = false;
  }
}

// ------------------------------------------------------------------ taking a vehicle
// F within a few metres of any vehicle: the player runs to the driver's door (the right side:
// India drives on the left with right-hand drive), the vehicle stops, the driver is pulled out.
const JACK_REACH = 7;
let jack = null;
function startJack(target) {
  jack = { target, t: 0 };
  if (target.kind === 'traffic') target.v.held = 4; // the driver freezes (and then gets yanked out)
}
function takeVehicle(target) {
  if (jobs.onDuty && !jobs.ride) jobs.toggleDuty(player);
  garage.take(target, walker);
  onFoot = false;
  walker.spraying = false;
}
function updateJack(dt) {
  const { target } = jack, v = target.v, T = traffic.types[v.type];
  const list = target.kind === 'traffic' ? traffic.cars : target.kind === 'parked' ? traffic.parked : traffic.left;
  jack.t += dt;
  const moved = input.fwd || input.back || input.left || input.right;
  if (!T || !list.includes(v) || (moved && jack.t > 0.25) || walker.down > 0) { jack = null; return; }
  const h = v.heading, fx = Math.sin(h), fz = Math.cos(h), rx = -Math.cos(h), rz = Math.sin(h);
  const side = T.rider ? 0.7 : T.wid / 2 + 0.45, ahead = T.rider ? -0.1 : T.len * 0.08;
  const dx = v.x + rx * side + fx * ahead - walker.pos.x, dz = v.z + rz * side + fz * ahead - walker.pos.z, d = Math.hypot(dx, dz);
  if (d < 0.5 || jack.t > 3.5) { jack = null; takeVehicle(target); return; }
  const run = Math.min(d, 5.2 * dt), nx = walker.pos.x + (dx / d) * run, nz = walker.pos.z + (dz / d) * run;
  walker.heading = Math.atan2(dx, dz);
  walker.speed = 5.2;
  // Round the vehicle's body rather than through it: slide sideways if the straight line is blocked.
  if (!traffic.hits(nx, nz, 0.3) || d < 1.6) walker.pos.set(nx, tiles.groundHeight(nx, nz), nz);
  else { const sx = walker.pos.x + rx * run, sz = walker.pos.z + rz * run; walker.pos.set(sx, tiles.groundHeight(sx, sz), sz); }
  walker.phase += dt * 5.2 * 4.3;
}
/** HUD prompt on foot next to a vehicle. */
function vehiclePrompt() {
  if (!onFoot || interiors?.inside || jack) return '';
  const t = garage.nearest(walker.pos.x, walker.pos.z, JACK_REACH);
  const homeD = garage.home ? Math.hypot(walker.pos.x - garage.home.x, walker.pos.z - garage.home.z) : Infinity;
  if (homeD < 4 && (!t || t.d > homeD - 1.4)) return 'F: get in your kaali-peeli';
  if (!t) return '';
  const name = traffic.types[t.v.type]?.name || 'vehicle';
  if (t.v.lent) return `F: take the ${name} (lent to you)`;
  if (t.v.taken) return `F: get back in the ${name}`;
  return `F: steal the ${name}${t.kind === 'traffic' ? ' — the driver gets pulled out' : ''}${police.witness(walker.pos.x, walker.pos.z) ? ' · 👮 a constable is watching!' : ''}`;
}

// ------------------------------------------------------------------ camera
const camPos = new THREE.Vector3();
let interiors = null; // created below, once the systems it talks to exist
const lookAt = new THREE.Vector3();
const view = new ViewControl(renderer.domElement, input);
function placeCamera(dt) {
  // GTA-style orbit camera: behind the taxi (mouse to look around, it swings back), or over
  // the player's right shoulder on foot (closer and zoomed in while aiming).
  const a = onFoot ? walker : player;
  view.update(dt, a, onFoot);
  if (onFoot && view.idle > 2.5 && !view.aim && Math.abs(walker.speed) > 0.5) {
    // No mouse for a while (keyboard or touch): ease the camera in behind the player.
    let d = walker.heading - view.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
    view.yaw += d * Math.min(1, dt * 1.5);
  }
  const aim = onFoot && view.aim;
  const veh = garage.inTaxi ? null : garage.spec; // buses need the camera further back and higher
  const dist = onFoot ? (aim ? 1.9 : 3.6) : (veh ? veh.len * 1.15 + 2.4 : 6.4) + Math.abs(player.speed) * 0.12;
  const shoulder = onFoot ? (aim ? 0.6 : 0.4) : 0;
  const [fx, fy, fz] = view.forward();
  const rx = -Math.cos(view.yaw), rz = Math.sin(view.yaw);
  const px = a.pos.x + rx * shoulder, py = a.pos.y + (onFoot ? 1.55 : veh?.big ? 3.4 : 1.6), pz = a.pos.z + rz * shoulder;
  const target = new THREE.Vector3(px - fx * dist, Math.max(a.pos.y + 0.4, py - fy * dist), pz - fz * dist);
  // Keep the camera out of buildings: pull it in towards the player if a wall is in the way.
  // Indoors (interiors.js) the room does this itself: inside its walls and under its ceiling.
  if (interiors?.inside) interiors.keepCamera(a.pos, target);
  else for (let i = 1; i <= 8; i++) {
    const t = i / 8, x = px + (target.x - px) * t, z = pz + (target.z - pz) * t;
    if (tiles.hits(x, z, 0.25)) { const k = Math.max(0.15, (i - 1) / 8); target.x = px + (target.x - px) * k; target.z = pz + (target.z - pz) * k; break; }
  }
  if (story?.camera) {
    // Cutscene camera: slow orbit around whoever is talking.
    camPos.lerp(story.camera.pos, 1 - Math.exp(-dt * 3));
    camera.position.copy(camPos);
    camera.lookAt(story.camera.look);
    return;
  }
  if (dt === 0) camPos.copy(target);
  else camPos.lerp(target, 1 - Math.exp(-dt * (onFoot ? (aim ? 14 : 8) : 5)));
  camera.position.copy(camPos);
  lookAt.set(px + fx * 6, py + fy * 6 + (onFoot ? 0 : -0.4), pz + fz * 6);
  camera.lookAt(lookAt);
  const fov = aim ? 44 : 58;
  if (Math.abs(camera.fov - fov) > 0.1) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 10); camera.updateProjectionMatrix(); }
}
placeCamera(0);
combat = new Combat({ scene, street, police, bubbles, audio, hud, tiles, walker, pichkari, view });
pichkari.ctx.combat = combat;
garage.combat = combat;
// Phatake: firecrackers the player can light on foot (X; Z changes type); the city lights its own on evenings.
const crackers = new Crackers({ scene, tiles, audio, bubbles, street, police, traffic, hud, tier, renderer });
// Fan meets at two (fictional) film stars' houses, in Bandra and Juhu.
const stars = new Stars({ scene, tiles, index, people, bubbles, audio, hud, story, state, crackers, traffic });
// Places to walk into (E at a glowing door): the terminus, the palace hotel, an Irani café, the flat in Powai.
interiors = new Interiors({ scene, camera, renderer, tiles, index, lib, tier, env, clock, state, people, characters, bubbles, audio, hud, phone, view, walker, player, story, onFoot: () => onFoot, snapCamera: () => placeCamera(0) });
// Hidden golden cutting-chai glasses and easter eggs.
const eggs = new Eggs({ scene, tiles, index, state, hud, bubbles, people, audio, clock, damage });
combat.giveRose = (foe) => eggs.useRose(foe, (o, text) => bubbles.say(o, text, 3)); // Gandhigiri: G with a rose ends a fight
cityMap.markers = () => [...stars.markers(), ...story.markers(), ...eggs.markers(onFoot ? walker : player), ...interiors.markers()];
// Missions can reach into these systems (vehicle requirements, cracker counts, calling a star out, clearing challans).
Object.assign(story.world, { stars, garage, crackers, police });
crackers.onLit = (kind) => story.event('cracker', kind);
// Collisions with other vehicles: riders come off their bikes, drivers shout, hard hits are hit-and-run.
traffic.onRiderDown = (bike) => { garage.eject(bike, null, 'down'); if (!onFoot) police.offence('hitrun', player); };
traffic.onShunt = (car, dv) => { if (dv > 1.5) bubbles.say(car, ['Arre! Andha hai kya?!', 'Gaadi thok di!', 'Dekh ke chala!', 'Mera bumper!'][Math.floor(Math.random() * 4)], 2.5, 'driver'); };

await tiles.whenReady(player.pos.x, player.pos.z, 350, (done, total) => {
  $('loading').textContent = `Loading ${index.name}… ${done}/${total}`;
  loader.progress(0.3 + 0.7 * (done / Math.max(1, total)), `Building ${index.name}… ${done}/${total}`);
});
// Map and sky are in: let the textures download, and give the street materials a moment.
lib.openGate();
loader.progress(0.97, 'Painting the streets…');
await Promise.race([lib.idle(), new Promise((r) => setTimeout(r, 2000))]);
// Compile the shaders now (in parallel where the browser can) rather than stalling the first frames.
placeCamera(0);
await renderer.compileAsync(scene, camera).catch(() => {});
$('loading').remove();
loader.done();
performance.mark('gtb-playable');
markStarted();

// ------------------------------------------------------------------ controls
let teleporting = false;
async function teleportHome() {
  if (teleporting) return;
  // R: a tow truck takes you and the taxi back to the Gateway (free if you're already close).
  const far = Math.hypot(player.pos.x - spawn.x, player.pos.z - spawn.z) > 150;
  teleporting = true;
  if (far) { state.pay(300, 'Tow to the Gateway'); say(state.money < 0 ? 'Tow truck: ₹300 on credit. Back at the Gateway.' : 'Tow truck: ₹300. Back at the Gateway.', 3); }
  if (onFoot) { onFoot = false; walker.spraying = false; }
  if (!garage.inTaxi) garage.toTaxi(); // a borrowed vehicle stays where it is
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
// The hawaldar waves you over and walks up: pay, argue or run.
police.onFlagGone = () => closeChoice?.(-1);
// Fines and settlements always come out of the wallet, on foot or in the taxi.
police.payFn = street.payFn = (amount, what) => state.pay(amount, what);

police.onFlagStop = (f, who) => {
  choice(`Hawaldar: "Challan ₹${police.fines.toLocaleString('en-IN')}, saheb."`, [
    [`Pay ₹${police.fines.toLocaleString('en-IN')}`, () => police.pay(false, f, who)],
    ['Argue ("Main toh dheere chala raha tha!")', () => police.argue(f, who)],
    ['Drive off (more stars)', () => police.flee(f)],
  ]);
};

// ------------------------------------------------------------------ settings, pause menu, hints
function applySettings(st) {
  settings = st;
  audio.setVolume(st.volume);
  view.sens = st.sens;
  view.invertY = st.invertY;
  $('help').classList.toggle('show', !!st.hints && helpTimer > 0);
}
let paused = false;
const pause = pauseMenu({
  paused: (on) => { paused = on; if (on) view.release(); audio.ctx?.[on ? 'suspend' : 'resume']?.(); },
  quality: (t) => changeQuality(t),
  settings: (st) => applySettings(st),
  quit: () => { state.save(); location.reload(); },
});
let helpTimer = 50; // the long key list shows for the first 50 s, then ? brings it back
applySettings(settings);

addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && !phone.open && !cityMap.open) { pause.toggle(); return; }
  if (pause.open) return;
  if ((e.code === 'Space' || e.code === 'Enter') && (story.lines?.length || story.ext) && story.camera) { story.skip(); return; }
  if (e.code === 'Slash') { helpTimer = helpTimer > 0 ? 0 : 30; $('help').classList.toggle('show', helpTimer > 0); }
  audio.start();
  if (e.repeat) return;
  if (e.code === 'Tab') { e.preventDefault(); view.release(); cityMap.toggle(!cityMap.open, player); return; }
  if (e.code === 'Escape' && cityMap.open) { cityMap.toggle(false); return; }
  if (cityMap.open) return;
  if (interiors.blocks(e.code)) return; // indoors: no vehicles, taxi duty, crackers, kicks or insults
  if (e.code === 'KeyQ') changeQuality(nextTier(tierKey));
  if (e.code === 'KeyH') honk();
  if (e.code === 'KeyP') { view.release(); phone.toggle(); }
  if (e.code === 'Escape' && phone.open) phone.toggle(false);
  if (e.code === 'KeyJ') { if (garage.inTaxi || garage.type === 'auto' || jobs.onDuty) jobs.toggleDuty(player); else say('Fare duty needs your kaali-peeli — or an auto-rickshaw in the suburbs', 2.5); }
  if (e.code === 'KeyF') toggleFoot();
  if (e.code === 'KeyN' && !onFoot) radio.next();
  if (e.code === 'KeyC' && onFoot) { pichkari.nextColour(e.shiftKey ? -1 : 1); if (combat.weapon !== 'pichkari') combat.setWeapon('pichkari'); }
  if (onFoot && e.code === 'Digit1') combat.setWeapon('fists');
  if (onFoot && e.code === 'Digit2') combat.setWeapon('pichkari');
  if (onFoot && e.code === 'KeyV') combat.kick();
  if (onFoot && e.code === 'KeyG') combat.abuse();
  if (onFoot && e.code === 'KeyX') crackers.playerLight(walker, clock);
  if (onFoot && e.code === 'KeyZ') crackers.next();
  if (onFoot && e.code === 'BracketRight') pichkari.setPressure(pichkari.pressure + 1);
  if (onFoot && e.code === 'BracketLeft') pichkari.setPressure(pichkari.pressure - 1);
  if (e.code === 'KeyE') interact();
  if (e.code === 'KeyT') { clock.hour = (clock.hour + 1) % 24; say(`Time: ${clock.label}`, 1.5); }
  if (e.code === 'KeyM') audio.toggleMute();
});
addEventListener('pointerdown', () => audio.start());
// A hidden tab stops sound (and the radio doesn't pile up missed notes on return).
document.addEventListener('visibilitychange', () => { audio.ctx?.[document.hidden ? 'suspend' : paused ? 'suspend' : 'resume']?.(); });
for (const [id, fn] of [['btn-kick', () => combat.kick()], ['btn-abuse', () => combat.abuse()], ['btn-weapon', () => combat.toggleWeapon()], ['btn-colour', () => { pichkari.nextColour(); combat.setWeapon('pichkari'); }]]) {
  $(id)?.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.start(); fn(); });
}
$('btn-door')?.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.start(); toggleFoot(); });
for (const id of ['btn-horn', 'btn-fuel']) {
  $(id)?.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.start(); if (id === 'btn-horn') honk(); else interact(); });
}

/** E: refuel at a pump (in the taxi), or buy a snack at a thela. */
function interact() {
  if (onFoot && interiors.interact()) return; // a door, or something to use indoors
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
  if (onFoot) { pichkari.nextColour(); combat.setWeapon('pichkari'); return; }
  if (state.owns('horn')) audio.musicalHorn?.(); else audio.play('horn', 0.9);
  street.onHorn();
  birds.scare(player.pos.x, player.pos.z, 10);
  jobs.honk();
  const ahead = traffic.honkedBy(player);
  if (ahead && Math.random() < 0.3) bubbles.say(ahead, ['Haan bhai, jaa!', 'Kitna horn!', 'Udd ke jaayega kya?'][Math.floor(Math.random() * 3)], 2, 'driver');
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
  const want = Math.round((1 - player.fuel) * 35);
  const afford = Math.max(0, Math.floor(state.money / 103));
  const litres = Math.min(want, afford);
  if (litres > 0) { state.pay(litres * 103, `Petrol ${litres} L`); player.fuel = Math.min(1, player.fuel + litres / 35); }
  say(want === 0 ? 'Tank already full' : litres < want ? (litres ? `Filled ${litres} L — that's all your money covers` : 'Not enough money for petrol — earn some with taxi fares (J)') : `Filled ${litres} L · ₹${litres * 103}`);
  if (player.condition < 0.9) repairMenu();
}

/** The pump mechanic: a cheap patch-up or a full repair, priced before you pay. */
function repairMenu() {
  const full = Math.round((1 - player.condition) * 1800 / 10) * 10 + 150;
  const patch = 350;
  choice('Pump mechanic: "Gaadi ka haal kharab hai, saheb."', [
    [`Patch-up · ₹${patch} · +30% (dents stay)`, () => { if (!state.canAfford(patch)) return say('Not enough money for the patch-up'); state.pay(patch, 'Patch-up at the pump'); player.condition = Math.min(1, player.condition + 0.3); say('Patched up. Runs better, still looks rough.'); }],
    [`Full repair · ₹${full} · like new`, () => { if (!state.canAfford(full)) return say('Not enough money for a full repair'); state.pay(full, 'Full repair at the pump'); player.condition = 1; damage.repair(); say('Good as new — dents out, lamps fixed.'); }],
    ['No thanks', () => {}],
  ]);
}

/** A small menu of choices (click or press 1, 2, 3…). */
let closeChoice = null;
function choice(title, options) {
  closeChoice?.(-1);
  const box = $('choice');
  box.innerHTML = `<b>${title}</b>${options.map(([label], i) => `<button data-i="${i}"><kbd>${i + 1}</kbd> ${label}</button>`).join('')}`;
  box.hidden = false;
  view.release();
  const done = (i) => { box.hidden = true; removeEventListener('keydown', key, true); closeChoice = null; options[i]?.[1](); };
  closeChoice = done;
  const key = (e) => { const i = Number(e.key) - 1; if (i >= 0 && i < options.length) { e.preventDefault(); e.stopPropagation(); done(i); } if (e.code === 'Escape') { e.stopPropagation(); done(options.length - 1); } };
  addEventListener('keydown', key, true);
  box.onclick = (e) => { const b = e.target.closest('button'); if (b) done(Number(b.dataset.i)); };
}

// ------------------------------------------------------------------ loop
window.__gtb = { THREE, garage, crackers, stars, eggs, tiles, player, scene, camera, renderer, post, env, lib, tier, facadeDebug, clock, traffic, materials, input, facadeParts, signals, police, people, bubbles, street, animals, cityMap, state, jobs, phone, walker, pichkari, skids, damage, propPhysics, view, landmarks, streetProps, radio, characters, story, get combat() { return combat; }, toggleFoot, get onFoot() { return onFoot; } };
window.__gtb.skyline = skyline;
window.__gtb.navigator = navigator;
window.__gtb.birds = birds;
{ const startle = crackers.startle.bind(crackers); crackers.startle = (x, z, r, by) => { birds.scare(x, z, r); return startle(x, z, r, by); }; } // crackers scare the pigeons too
window.__gtb.interiors = interiors;
const cheats = new Cheats(window.__gtb, (t, s) => say(t, s));
window.__gtb.cheat = (code) => cheats.enter(code);
window.__gtb.cheats = cheats;
const timer = new THREE.Timer();
// Shadows: redraw the shadow map every frame on High, every other frame below.
renderer.shadowMap.autoUpdate = false;
let frameNo = 0;
const crosshair = $('crosshair');
let hudTimer = 0, lampTimer = 0, seaFactor = 0;
renderer.setAnimationLoop((time) => {
  timer.update(time);
  const dt = Math.min(timer.getDelta(), 0.05);
  if (cityMap.open || paused) return; // paused while the map or the pause menu is open
  if (helpTimer > 0) { helpTimer -= dt; if (helpTimer <= 0) $('help').classList.remove('show'); }
  crosshair.hidden = !(onFoot && (view.aim || (combat.weapon === 'pichkari' && view.locked)));
  document.body.classList.toggle('onfoot', onFoot);
  document.body.classList.toggle('cutscene', !!story.camera);
  if (input.reset) { input.reset = false; teleportHome(); }
  step(dt);
  // Shadows every frame while anything near the camera moves fast (otherwise a moving car's own
  // shadow jumps behind it on alternate frames and the drive looks juddery); half rate when still.
  const moving = Math.abs(onFoot ? walker.speed || 0 : player.speed) > 1.5;
  renderer.shadowMap.needsUpdate = tier.name === 'High' || moving || (frameNo++ & 1) === 0;
  post.render();
});

/** One simulation step (also used by headless tests). */
const NO_INPUT = {};
const PARKED = { ...NO_INPUT, brake: true };
function step(dt) {
  const t0 = performance.now();
  frameDt = dt;
  clock.update(dt);
  // The active body: the taxi, or the player on foot.
  const body = onFoot ? walker : player;
  // Indoors, the city carries on around the street door (interiors.anchor) while the walker is in the room.
  const indoors = !!interiors.inside;
  const active = indoors ? interiors.anchor : body;
  const cutscene = !!story.camera;
  player.update(dt, onFoot ? PARKED : cutscene ? NO_INPUT : input, world); // left on foot, the vehicle stands with its handbrake on
  // Tyre marks and car sounds.
  skids.track(player, player.slip || 0, player.braking);
  audio.squeal(onFoot ? 0 : player.slip || 0);
  audio.engine(player.speed, onFoot ? 0 : player.throttle || 0, !onFoot);
  if (player.impact) {
    if (player.impact > 2.5) {
      audio.crash(Math.min(1, player.impact / 14));
      if (garage.inTaxi) damage.impact(player.impactLocal[0], player.impactLocal[1], player.impact);
      propPhysics.impact(player.impact, Math.sin(player.heading), Math.cos(player.heading));
    }
    player.impact = 0;
  }
  damage.update(dt, garage.inTaxi ? player : garage.homeBody, camera);
  garage.update(dt);
  traffic.taxi = police.taxi = garage.inTaxi ? player : garage.homeBody; // NPC cars and patrols avoid the parked taxi
  if (!onFoot) propPhysics.sweep(player);
  propPhysics.update(dt, onFoot ? null : player);
  if (garage.inTaxi && player.condition > 0.97 && (damage.front || damage.rear)) damage.repair();
  if (onFoot && jack) updateJack(dt);
  if (onFoot && !jack) {
    walker.update(dt, cutscene ? NO_INPUT : input, indoors ? interiors.world : footWorld, state.s.energy, clock.aqi, view);
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
  people.cam = camera.position;
  people.focus = body.pos;
  people.begin();
  police.onFoot = onFoot;
  police.update(dt, active, clock);
  street.onFoot = onFoot;
  street.update(dt, active, clock);
  const fire = (input.fire || input.brake) && !indoors; // fists and pichkari stay holstered indoors
  combat.update(dt, { fire }, onFoot);
  if (!onFoot && !cutscene) combat.carVsPeople(player);
  crackers.update(dt, clock, active.pos, camera.position, onFoot ? walker : null);
  stars.update(dt, clock, active, clock.night);
  eggs.update(dt, { player, onFoot, walker });
  interiors.update(dt, onFoot); // doors on the street; indoors: the room's people, lights and things to use
  story.update(dt, { player, onFoot, walker });
  if (onFoot) walker.draw(people, combat.weapon);
  else if (garage.seated) {
    // Riding a two-wheeler or driving an auto: the player can be seen in the seat.
    const seat = garage.spec.seat ?? 0.9, back = -(garage.spec.seatZ ?? -0.28), L = walker.look;
    const P = (walker.person ||= { isPlayer: true, flags: 0, scale: 1, model: 0, hair: new THREE.Color(0x17110c) });
    Object.assign(P, { x: player.pos.x - Math.sin(player.heading) * back, y: player.pos.y + seat - 0.42, z: player.pos.z - Math.cos(player.heading) * back, heading: player.heading, phase: 0, pose: POSE.SIT, amp: 1, speed: 0, shirt: L.shirt, pants: L.pants, skin: L.skin, patches: walker.patches });
    people.add(P);
  }
  for (const r of traffic.riders) {
    // Riders sit astride their bikes (most wear helmets); auto drivers sit up front in khaki,
    // dabbawalas pedal in white caps; some autos carry a passenger on the bench.
    const T = traffic.types[r.type], seat = T?.seat ?? 0.92, back = -(T?.seatZ ?? -0.28);
    const sh = Math.sin(r.heading), ch = Math.cos(r.heading), L = r.look;
    if (T?.pedal) r.pedal = (r.pedal || 0) + dt * (r.speed || 0) * 1.7;
    people.add({ noHero: true, x: r.x - sh * back, y: seat - (T?.pedal ? 0.86 : 0.42), z: r.z - ch * back, heading: r.heading, phase: r.pedal || 0, pose: T?.pedal ? POSE.PEDAL : POSE.SIT, amp: 1, flags: L.helmet ? FLAG.BERET : L.cap ? FLAG.CAP : 0, scale: 1, shirt: L.shirt, pants: L.pants, skin: L.skin });
    if (r.pax && T.pax) people.add({ noHero: true, x: r.x + sh * T.pax.z - ch * 0.22, y: T.pax.seat - 0.42, z: r.z + ch * T.pax.z + sh * 0.22, heading: r.heading, phase: 0, pose: POSE.SIT, amp: 1, flags: r.pax.sari ? FLAG.SARI : 0, scale: 0.96, shirt: r.pax.shirt, pants: r.pax.pants, skin: r.pax.skin });
  }
  if (view.wheel) { pichkari.setPressure(pichkari.pressure - view.wheel); view.wheel = 0; }
  pichkari.update(dt, onFoot ? walker : null, onFoot && combat.weapon === 'pichkari' && fire, view);
  people.end();
  placeCamera(dt);
  bubbles.update(dt, camera);
  if (!interiors.inside) env.update(dt, active.pos, clock); // indoors the room lights itself (interiors.lights)

  // Night: lit windows and signs, glowing lamps, real lights on the nearest lamp posts.
  const night = clock.night;
  facadeNight.value = night;
  landmarks.update(night);
  streetProps.update(dt, active.pos);
  facadeParts.update(dt, player, tiles, night);
  skyline.update(active.pos);
  birds.update(dt, active, clock.daylight);
  tiles.props.lampMat.emissiveIntensity = night * 9;
  const lamps = damage.headlampFactor(player.condition);
  taxi.lights.headMat.emissiveIntensity = (0.2 + night * 5) * lamps;
  headlamp.intensity = night * 420 * lamps;
  lowBeam.intensity = night * 150 * lamps;
  lampTimer -= dt;
  if (lampTimer <= 0) {
    lampTimer = night > 0.05 ? 0.12 : 0.4; // headlight cones follow the traffic
    placeLampLights(night);
    seaFactor = nearSea();
  }
  for (const [x, z] of traffic.honks.splice(0)) {
    const d = Math.hypot(x - player.pos.x, z - player.pos.z);
    if (d < 80 && Math.random() < 0.6) audio.play(Math.random() < 0.25 ? 'truckHorn' : 'horn', 0.5 / (1 + d / 15));
  }
  audio.update(seaFactor, clock.traffic, clock.daylight);
  if (interiors.inside) interiors.ambience(audio); // the street is a murmur behind the walls
  radio.update(dt, !onFoot, settings.radio !== false, { clock, police, state, road: tiles.roadNameAt(player.pos.x, player.pos.z) });
  cityMap.update(dt, active);
  navigator.speech = settings.speech !== false;
  navigator.update(dt, active, !onFoot);
  state.update(dt, clock);
  jobs.focus = active;
  jobs.update(dt, player);
  phone.update(dt);
  minimap.update(dt, active, traffic);
  hudTimer -= dt;
  messageTimer -= dt;
  if (hudTimer <= 0) { hudTimer = 0.2; updateHud(); }
  cheats.update(dt);
  window.__gtb.stepMs = window.__gtb.stepMs * 0.9 + (performance.now() - t0) * 0.1 || 0;
}
window.__gtb.step = step;

function placeLampLights(night) {
  if (night < 0.05) { lampLights.forEach((l) => (l.intensity = 0)); updateNightLights(0); return; }
  const focus = interiors?.inside ? interiors.anchor.pos : onFoot ? walker.pos : player.pos;
  // Lamp heads near the player: the mapped street lights, plus (every half second) a light every
  // 30 m along the other streets, where the map has none — every road in Mumbai is lit at night.
  lampScan -= 1;
  if (lampScan <= 0 || !lampCache) { lampScan = 4; lampCache = gatherLamps(focus); }
  const near = lampCache.map(([x, z]) => [(x - player.pos.x) ** 2 + (z - player.pos.z) ** 2, x, z]).sort((a, b) => a[0] - b[0]);
  updateNightLights(night, focus, near.map(([, x, z]) => [x, z, 1]), traffic.cars, tier, onFoot || damage.headlampFactor(player.condition) < 0.3 ? null : player);
  lampLights.forEach((l, i) => {
    const n = near[i];
    if (!n || n[0] > 120 * 120) { l.intensity = 0; return; }
    l.position.set(n[1], 8.6, n[2]);
    l.intensity = night * 30; // street lamps light a pool, not the whole facade
  });
}
let lampScan = 0, lampCache = null;
function gatherLamps(focus) {
  const out = [], R = 170;
  const cell = new Set(), ck = (x, z) => `${Math.floor(x / 14)},${Math.floor(z / 14)}`;
  for (const t of tiles.tiles.values()) {
    const arr = t.points[POINT.LIGHT];
    if (!arr) continue;
    for (let i = 0; i < arr.length; i += 5) {
      const ang = arr[i + 3];
      // The lamp head hangs 1.9 m out over the road.
      const x = arr[i] + t.origin[0] + Math.sin(ang) * 1.9, z = arr[i + 2] + t.origin[1] + Math.cos(ang) * 1.9;
      if (Math.abs(x - focus.x) > R || Math.abs(z - focus.z) > R) continue;
      out.push([x, z]); cell.add(ck(x, z));
    }
  }
  for (const seg of traffic.segList || []) {
    const s = seg.s;
    if (s[4] < 2.5 || seg.len < 12) continue;
    const mx = (s[0] + s[2]) / 2, mz = (s[1] + s[3]) / 2;
    if (Math.abs(mx - focus.x) > R + seg.len / 2 || Math.abs(mz - focus.z) > R + seg.len / 2) continue;
    const fx = (s[2] - s[0]) / seg.len, fz = (s[3] - s[1]) / seg.len;
    // Same spacing phase for a road everywhere, so lights don't jump as the player moves.
    for (let d = 6 + (Math.abs(Math.round(s[0] + s[1])) % 30); d < seg.len - 3; d += 30) {
      const side = Math.round(d / 30) % 2 ? 1 : -1, o = Math.max(0, s[4] - 1.4) * side;
      const x = s[0] + fx * d + fz * o, z = s[1] + fz * d - fx * o;
      if (Math.abs(x - focus.x) > R || Math.abs(z - focus.z) > R || cell.has(ck(x, z))) continue;
      out.push([x, z]); cell.add(ck(x, z));
    }
  }
  return out;
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
  const here = onFoot ? walker : player;
  $('road').textContent = interiors.inside ? interiors.inside.name : tiles.roadNameAt(here.pos.x, here.pos.z);
  $('clock').textContent = clock.label;
  const [label, colour] = clock.aqiLabel;
  $('aqi').innerHTML = `AQI <b style="color:${colour}">${clock.aqi}</b> ${label}`;
  $('fuel-bar').style.width = `${Math.round((onFoot ? walker.stamina : player.fuel) * 100)}%`;
  $('fuel-bar').style.background = player.fuel < 0.15 ? '#e74c3c' : '#f7c600';
  $('cond-bar').style.width = `${Math.round((onFoot ? walker.health : player.condition) * 100)}%`;
  $('weapon').hidden = !onFoot;
  if (onFoot) {
    $('weapon').innerHTML = combat.weapon === 'pichkari'
      ? `💦 <b>Pichkari</b> <i style="background:#${HOLI[pichkari.colour].getHexString()}"></i>${pichkari.colourName} · Pressure ${'●'.repeat(pichkari.pressure)}${'○'.repeat(5 - pichkari.pressure)} · Tank ${Math.round(pichkari.tank * 100)}%`
      : '👊 <b>Fists</b> · click punch · V kick · G insult';
    $('weapon').innerHTML += ` · 🎆 X: ${crackers.current.name.split(' (')[0]}`;
    if (combat.weapon === 'fists') $('weapon').innerHTML = $('weapon').innerHTML.replace('click punch', 'click punch ×3 combo · right mouse block');
  }
  const foe = onFoot ? combat.foe : null;
  $('foe').hidden = !foe;
  if (foe) $('foe').innerHTML = `🥊 Opponent <i><b style="width:${Math.round(Math.max(0, Math.min(1, foe.hp ?? 1)) * 100)}%"></b></i>${combat.blocking ? ' · blocking' : ''}`;
  document.body.classList.toggle('hurt', onFoot && walker.hurt > 0.05);
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
      p && p.d < 16 ? 'Petrol pump: stop and press E to fill up' :
      player.fuel < 0.12 ? 'Low fuel — find ⛽ on the map' :
      player.condition < 0.35 ? 'Car is battered: get it checked at a ⛽' :
      state.s.hunger < 0.15 ? 'Pet mein chuhe daud rahe hain! Eat at a thela (E) or order on Bhookh (P)' :
      state.s.energy < 0.12 ? 'So tired… have a cutting chai (E at a thela)' : '';
    if (interiors.prompt && !police.flagger) message = interiors.prompt; // "E: enter …" at a door, things to use indoors
    if (!message && !police.flagger) message = vehiclePrompt();
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
