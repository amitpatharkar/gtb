import * as THREE from 'three';
import { createRickshaw, Vehicle } from './rickshaw.js';
import { input } from './input.js';
import { TileManager } from './world/tiles.js';
import { createMaterials } from './world/materials.js';
import { createEnvironment } from './world/environment.js';

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.5, 2000);

const loadingEl = document.getElementById('loading');
const speedEl = document.getElementById('speed');
const roadEl = document.getElementById('road');
const fadeEl = document.getElementById('fade');

const tiles = new TileManager(scene, createMaterials(renderer));
const index = await tiles.init(`${import.meta.env.BASE_URL}tiles/`).catch((err) => {
  loadingEl.textContent = String(err.message || err);
  throw err;
});
const env = createEnvironment(renderer, scene, index.bounds);

const rickshaw = createRickshaw();
scene.add(rickshaw.root);
const player = new Vehicle(rickshaw);
const spawn = index.spawn;
const respawn = () => {
  player.pos.set(spawn.x, 0.1, spawn.z); // roads sit ~10 cm above the ground
  player.heading = spawn.heading;
  player.speed = 0;
};
respawn();

// Chase camera
const camPos = new THREE.Vector3();
const lookAt = new THREE.Vector3();
const placeCamera = (dt) => {
  const back = 7 + Math.abs(player.speed) * 0.15;
  const target = new THREE.Vector3(
    player.pos.x - Math.sin(player.heading) * back,
    3.6,
    player.pos.z - Math.cos(player.heading) * back
  );
  if (dt === 0) camPos.copy(target);
  else camPos.lerp(target, 1 - Math.exp(-dt * 4));
  camera.position.copy(camPos);
  lookAt.set(player.pos.x, 1.5, player.pos.z);
  camera.lookAt(lookAt);
};
placeCamera(0);

await tiles.whenReady(spawn.x, spawn.z, 350, (done, total) => {
  loadingEl.textContent = `Loading ${index.name}… ${done}/${total}`;
});
loadingEl.remove();

// Hide streaming behind a short fade whenever the player jumps far (Rockstar's trick).
let teleporting = false;
async function teleportHome() {
  if (teleporting) return;
  teleporting = true;
  fadeEl.classList.add('on');
  await new Promise((r) => setTimeout(r, 250));
  respawn();
  placeCamera(0);
  await tiles.whenReady(spawn.x, spawn.z, 250);
  fadeEl.classList.remove('on');
  teleporting = false;
}
window.__gtb = { tiles, player, scene, camera, renderer }; // handy for debugging in the console

const timer = new THREE.Timer();
let hudTimer = 0;
renderer.setAnimationLoop((time) => {
  timer.update(time);
  const dt = Math.min(timer.getDelta(), 0.05);
  if (input.reset) { input.reset = false; teleportHome(); }
  player.update(dt, input, tiles);
  tiles.update(player.pos.x, player.pos.z);
  placeCamera(dt);
  env.update(dt, player.pos, camera);

  hudTimer -= dt;
  if (hudTimer <= 0) {
    hudTimer = 0.25;
    speedEl.textContent = `${Math.round(Math.abs(player.speed) * 3.6)} km/h`;
    roadEl.textContent = tiles.roadNameAt(player.pos.x, player.pos.z);
  }
  renderer.render(scene, camera);
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
