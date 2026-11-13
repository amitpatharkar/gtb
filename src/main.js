import * as THREE from 'three';
import { buildWorld } from './world.js';
import { createRickshaw, Vehicle } from './rickshaw.js';
import { input } from './input.js';

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);

// Scene: warm Mumbai afternoon haze
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb9d3e3);
scene.fog = new THREE.Fog(0xc9d8e0, 60, 260);

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 600);

scene.add(new THREE.HemisphereLight(0xdfefff, 0x6b5a45, 1.1));
const sun = new THREE.DirectionalLight(0xffe2b8, 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const sc = sun.shadow.camera;
sc.left = -60; sc.right = 60; sc.top = 60; sc.bottom = -60; sc.near = 1; sc.far = 250;
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);

const { colliders } = buildWorld(scene);

const rickshaw = createRickshaw();
scene.add(rickshaw.root);
const player = new Vehicle(rickshaw);
player.pos.set(0, 0, 20); // start on the north–south road

// Chase camera
const camPos = new THREE.Vector3(0, 6, 10);
const lookAt = new THREE.Vector3();
const speedEl = document.getElementById('speed');

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  player.update(dt, input, colliders);

  const back = 7 + Math.abs(player.speed) * 0.15;
  const target = new THREE.Vector3(
    player.pos.x - Math.sin(player.heading) * back,
    3.5,
    player.pos.z - Math.cos(player.heading) * back
  );
  camPos.lerp(target, 1 - Math.exp(-dt * 4));
  camera.position.copy(camPos);
  lookAt.set(player.pos.x, 1.5, player.pos.z);
  camera.lookAt(lookAt);

  // Keep the shadow area centred on the player
  sun.position.set(player.pos.x + 40, 80, player.pos.z + 25);
  sun.target.position.copy(player.pos);

  speedEl.textContent = `${Math.round(Math.abs(player.speed) * 3.6)} km/h`;
  renderer.render(scene, camera);
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
