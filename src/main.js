// Bombay Bawaal — boot and game loop.
// Order: renderer → physics → textures → world (tiles around the spawn) → sky → main character
// → cars and props → HUD. The simulation runs at a fixed 60 Hz (physics.STEP); rendering copies
// poses once per frame. window.__game exposes the game to headless tests (tests/smoke.mjs).
import * as THREE from 'three/webgpu';
import { createRenderer, pickTier } from './core/renderer.js';
import { createPhysics, STEP } from './core/physics.js';
import { Input } from './core/input.js';
import { Audio } from './core/audio.js';
import { TextureLibrary, createMaterials } from './world/materials.js';
import { World, AREA } from './world/world.js';
import { createSky } from './world/sky.js';
import { Y } from './world/levels.js';
import { Props } from './world/props.js';
import { loadHero } from './player/hero.js';
import { OnFoot } from './player/onFoot.js';
import { ChaseCamera } from './player/camera.js';
import { CARS, loadCarModel } from './vehicles/carModel.js';
import { Vehicle } from './vehicles/vehicle.js';
import { Weapons, WEAPONS } from './combat/weapons.js';
import { Particles } from './fx/particles.js';
import { Hud } from './ui/hud.js';
import { Menu } from './ui/menu.js';
import { Tuning } from './ui/tuning.js';
import { Nav } from './ui/nav.js';
import { placesFrom } from './ui/places.js';
import { WeaponWheel } from './ui/weaponWheel.js';
import { Phone } from './ui/phone.js';
import { Stats } from './game/stats.js';
import { Onboarding } from './game/onboarding.js';
import { GAME } from './brand.js';

const $ = (id) => document.getElementById(id);
const BASE = import.meta.env.BASE_URL;
const params = new URLSearchParams(location.search);
const AUTOMATION = navigator.webdriver || params.has('test');
const progress = (f, text) => { $('load-fill').style.width = `${Math.round(f * 100)}%`; if (text) $('load-text').textContent = text; };

async function boot() {
  document.title = GAME.name;
  progress(0.02, 'Starting the graphics…');
  const tierKey = pickTier();
  const R = await createRenderer($('game'), tierKey);
  const { scene, camera, renderer, tier } = R;
  progress(0.06, 'Starting the physics…');
  const physics = await createPhysics();
  const input = new Input(renderer.domElement);
  const audio = new Audio();

  progress(0.08, 'Loading materials…');
  const lib = new TextureLibrary(renderer);
  await lib.init((f) => progress(0.08 + f * 0.42, 'Loading materials…'));
  const materials = createMaterials(lib);

  progress(0.5, 'Loading Colaba…');
  const world = new World(scene, physics, materials, tier);
  const index = await world.init();
  const [sky] = await Promise.all([
    createSky(scene, tier),
    world.whenReady(index.spawn.x, index.spawn.z, 320),
  ]);
  physics.world.step(); // scene queries (ray casts) only see colliders after a step
  progress(0.75, 'Loading the main character…');
  const hero = await loadHero(tierKey);
  scene.add(hero.object);
  const player = new OnFoot(physics, hero);
  const spawnY = physics.groundAt(index.spawn.x, index.spawn.z) ?? 0.2;
  player.place(index.spawn.x, spawnY, index.spawn.z, index.spawn.heading);

  const cam = new ChaseCamera(camera, physics);
  cam.yaw = index.spawn.heading;
  const weapons = new Weapons(scene, physics, audio);
  const particles = new Particles(R.fxScene, R.effects.sceneDepth || null);
  weapons.particles = particles;
  weapons.vehicles = () => cars.filter((c) => c !== driving);
  let gameClock = 0;
  weapons.attach(hero.hand);
  weapons.select(1);

  progress(0.85, 'Parking cars…');
  const cars = [];
  const props = new Props(scene, physics);
  await placeCarsAndProps(world, physics, scene, cars, props, index.spawn);

  // ------------------------------------------------------------------ interface (docs/ui.md)
  const places = placesFrom(index, AREA);
  const nav = new Nav(world);
  const hud = new Hud(world, nav, places);
  hud.onMessage = (k) => audio.ui(k);
  const stats = new Stats();
  const tuning = new Tuning(() => cars);
  const credits = await buildCredits();
  const wheel = new WeaponWheel(weapons, (k) => audio.ui(k));
  let paused = false;
  let onboarding = null;
  const menu = new Menu({
    tier, backend: R.backend, credits, nav, area: AREA,
    onResume: () => { paused = false; input.release(); if (!AUTOMATION) renderer.domElement.requestPointerLock?.(); },
    onSettings: (s) => {
      input.sensitivity = s.sensitivity; cam.invertY = s.invertY; audio.setVolume(s.volume); input.vibration = s.vibration;
      hud.setMode(s.hud);
      if (onboarding && s.guidance !== onboarding.setting) startOnboarding(s.guidance);
    },
    actions: {
      sound: (k) => audio.ui(k),
      waypoint: (x, z, label) => setWaypoint(x, z, label),
      home: () => respawn(),
      tutorial: () => { onboarding.reset(); onboarding.level = 'more'; },
      tuning: () => tuning.toggle(),
    },
  });
  const phone = new Phone({
    places, log: () => hud.log,
    onWaypoint: (x, z, name) => setWaypoint(x, z, name),
    onSettings: () => openMenu('settings'),
    sound: (k) => audio.ui(k),
  });
  const menuContext = () => ({
    stats, log: hud.log, nav, places, filters: hud.filters, pad: input.usingPad,
    objective: onboarding?.active ? onboarding.step.text : null, place: hud.last.area,
    cars: cars.filter((c) => c !== driving).map((c) => ({ x: c.position.x, z: c.position.z })),
    player: { x: (driving ? driving.position : player.pos).x, z: (driving ? driving.position : player.pos).z, heading: driving ? driving.heading : player.heading },
  });
  function openMenu(tab = 'map') {
    if (wheel.open) wheel.hide();
    if (phone.open) phone.close();
    paused = true; input.unlock(); menu.show(tab, menuContext());
  }
  document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement && !AUTOMATION && !menu.open && !hud.el.hidden) openMenu('map');
  });

  // ------------------------------------------------------------------ game state
  let driving = null;     // the Vehicle being driven, or null on foot
  let hitMarker = 0, fHeld = 0, underwater = 0, wastedT = 0, timeScale = 1;
  const tmp = new THREE.Vector3();
  const ob = { looked: 0, walked: 0, driving: false, arrived: null, userArrived: false, weapon: null, usedWheel: false, hitProp: false };

  function nearestCar(maxExtra = 1.6) {
    let best = null, bd = Infinity;
    for (const c of cars) {
      const p = c.position;
      const d = Math.hypot(p.x - player.pos.x, p.z - player.pos.z) - Math.max(c.model.dims.x, c.model.dims.z) / 2;
      if (d < maxExtra && d < bd && Math.abs(p.y - player.pos.y) < 2.5) { bd = d; best = c; }
    }
    return best;
  }

  function setWaypoint(x, z, label) {
    if (x === null || x === undefined) { nav.set('user', null); hud.message('Waypoint cleared.', 3); return; }
    if (x < AREA.minX || x > AREA.maxX || z < AREA.minZ || z > AREA.maxZ) { hud.message(`That's outside ${AREA.name} — the rest of Mumbai opens later.`, 4); audio.ui('back'); return; }
    const from = driving ? driving.position : player.pos;
    const name = label || world.roadNameAt(x, z) || 'Waypoint';
    nav.set('user', { x, z, label: name }, { x: from.x, z: from.z, heading: driving ? driving.heading : null }).then(() => { menu.mapView.draw(); });
    hud.message(`Waypoint set: <b>${name}</b> · ${Nav.distance(Math.hypot(x - from.x, z - from.z))} away. Follow the purple route.`, 5);
    audio.ui('select');
  }

  nav.onArrive = (owner, t) => {
    stats.add('waypoints');
    audio.ui('objective');
    if (owner === 'user') { ob.userArrived = true; hud.message(`You have arrived: <b>${t.label}</b>.`, 4, { sound: false }); }
    else ob.arrived = t.place;
  };

  function enterCar(car) {
    driving = car;
    car.driver = player;
    player.setActive(false);
    hero.object.visible = true;
    car.object.add(hero.object);
    const [sx, sy, sz] = car.spec.seat;
    // The driving pose bends the legs but keeps the hips 0.53 m above his feet: lower him onto the seat.
    hero.object.position.set(sx, sy - 0.53, sz);
    hero.object.rotation.set(0, 0, 0);
    hero.play('drive', 1, 0.25);
    weapons.gun.visible = false;
    car.body.wakeUp();
    hud.vehicleName(car.spec.name);
    cam.idle = 2;
    stats.add('carsEntered');
    input.rumble(0.1, 0.3, 120);
  }

  function exitCar() {
    const car = driving;
    // Out of the driver's door (right side), or the left if a wall is in the way.
    const half = car.model.dims.x / 2 + 0.55;
    let spot = null;
    for (const side of [-1, 1]) {
      const p = car.toWorld(side * half, 0.5, car.spec.seat[2], new THREE.Vector3());
      const g = physics.groundAt(p.x, p.z, p.y + 1.5, 4);
      const blocked = physics.cast(car.position.x, p.y, car.position.z, p.x - car.position.x, 0, p.z - car.position.z, 1, undefined, car.body);
      if (g !== null && !blocked) { spot = { x: p.x, y: g, z: p.z }; break; }
    }
    if (!spot) { const p = car.position; spot = { x: p.x, y: p.y + car.model.dims.y + 0.3, z: p.z }; }
    car.driver = null;
    car.control(null);
    scene.add(hero.object);
    player.setActive(true);
    player.place(spot.x, spot.y, spot.z, car.heading);
    weapons.gun.visible = weapons.weapon.id === 'pistol';
    driving = null;
    audio.car(false, 0, 0, 0);
  }

  function respawn() {
    if (driving) exitCar();
    const s = index.spawn, g = physics.groundAt(s.x, s.z) ?? 0.2;
    player.place(s.x, g, s.z, s.heading);
    player.health = 100; player.stamina = 100; player.knocked = 0;
    cam.yaw = s.heading;
  }

  // ------------------------------------------------------------------ onboarding (adaptive)
  function startOnboarding(level) {
    onboarding = new Onboarding(level, stats.s.sessions);
    onboarding.setting = level;
    onboarding.started = -1;
  }
  startOnboarding(menu.settings.guidance);

  function onboardingTick() {
    const o = onboarding;
    if (!o.active) { hud.objective(null); if (nav.targets.has('objective')) nav.set('objective', null); return; }
    const st = o.step;
    const ctx = {
      ...ob, driving: !!driving, weapon: weapons.weapon.id,
      nearestCar: () => { let b = null, bd = Infinity; for (const c of cars) { const d = c.position.distanceTo(player.pos); if (d < bd) { bd = d; b = c; } } return b && { x: b.position.x, z: b.position.z }; },
      nearestProp: () => { const it = props.items[0]; if (!it) return null; const p = it.body.translation(); return { x: p.x, z: p.z }; },
    };
    if (o.started !== st.id) {
      o.started = st.id;
      const tgt = st.place ? places.find((p) => p.id === st.place) : st.target?.(ctx);
      const from = driving ? driving.position : player.pos;
      if (tgt && st.id !== 'shoot' && st.id !== 'car') nav.set('objective', { x: tgt.x, z: tgt.z, label: tgt.name || '', place: st.place, objective: true }, { x: from.x, z: from.z, heading: driving ? driving.heading : null });
      else nav.set('objective', null);
      ob.arrived = null; ob.userArrived = false; ob.hitProp = false; ob.usedWheel = false;
    }
    hud.objective(o.level === 'more' && st.hint ? `${st.text}<br><small style="color:var(--dim)">${st.hint}</small>` : st.text);
    if (st.done(ctx)) {
      hud.objective(null, true);
      const finished = o.complete();
      audio.ui('objective');
      if (!o.step) hud.message('Tutorial done. Colaba is yours: explore, or set a destination on the map with {map}.', 7, { sound: false });
      else if (finished) hud.message(`Done: ${finished.text}`, 3, { sound: false });
    }
  }

  // ------------------------------------------------------------------ input actions
  function actions(dt) {
    if (wastedT > 0) return;
    if (input.pressed('pause')) { openMenu('map'); return; }
    if (input.pressed('map')) { openMenu('map'); return; }
    if (input.pressed('tuning')) tuning.toggle();
    if (input.pressed('phone') && !wheel.open) phone.toggle();
    if (phone.open) { phone.update(input); }
    // Weapon wheel: hold to open, let go to equip (on foot only).
    if (!driving && !phone.open) {
      if (input.pressed('wheel')) wheel.show();
      if (wheel.open) { wheel.update(input); if (!input.down('wheel')) { if (wheel.hide()) { ob.usedWheel = true; } } }
    } else if (wheel.open) wheel.hide();
    timeScale = wheel.open ? 0.25 : 1;
    if (!driving) {
      if (input.pressed('weapon1')) weapons.select(0);
      if (input.pressed('weapon2')) weapons.select(1);
      if (input.wheel && !wheel.open) weapons.select((weapons.current + (input.wheel > 0 ? 1 : WEAPONS.length - 1)) % WEAPONS.length);
      if (input.pressed('reload')) weapons.reload();
      const near = player.knocked > 0 ? null : nearestCar();
      hud.prompt(near ? `{enter} Get in · ${near.spec.name}` : '');
      if (input.pressed('enter') && near) { enterCar(near); return; }
    } else {
      audio.horn(input.down('horn'));
      if (input.down('enter')) fHeld += dt; else fHeld = 0;
      if (driving.flippedTime > 1) { hud.prompt('Hold {enter} to put the car back on its wheels'); if (fHeld > 0.6) { driving.rightUp(); fHeld = 0; } }
      else { hud.prompt(''); if (input.pressed('enter')) exitCar(); }
    }
  }

  function simulate() {
    const aiming = !driving && weapons.weapon.id === 'pistol' && (input.aim || input.fire) && !wheel.open;
    if (driving) driving.control(wastedT > 0 ? null : input); else player.step(wastedT > 0 || wheel.open ? IDLE : input, cam.yaw, aiming);
    for (const c of cars) c.step();
    // Cars knock the player over (the capsule lets a car through for a moment after).
    if (!driving && player.ghost <= 0) {
      for (const c of cars) {
        const v = c.body.linvel(), sp = Math.hypot(v.x, v.z);
        if (sp < 3.5) continue;
        const p = c.position, h = c.heading, dx = player.pos.x - p.x, dz = player.pos.z - p.z;
        const lx = dx * Math.cos(h) - dz * Math.sin(h), lz = dx * Math.sin(h) + dz * Math.cos(h);
        if (Math.abs(lx) < c.model.dims.x / 2 + 0.35 && Math.abs(lz) < c.model.dims.z / 2 + 0.35 && Math.abs(player.pos.y - p.y) < 1.5) {
          player.knock(v.x / sp, v.z / sp, sp); audio.crash(sp * 0.5);
          break;
        }
      }
    }
    physics.world.step();
  }
  const IDLE = { move: { x: 0, y: 0 }, down: () => false, pressed: () => false };

  // ------------------------------------------------------------------ loop
  let last = performance.now(), acc = 0, frames = 0, fpsT = 0, fps = 0, simMs = 0;
  const statsEl = $('stats');
  let showStats = params.has('stats');
  addEventListener('keydown', (e) => { if (e.code === 'Backquote') showStats = !showStats; });

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    input.update(dt);
    hud.pad = input.usingPad;
    $('click-to-play').hidden = paused || input.locked || AUTOMATION || input.usingPad;
    if (paused) menu.update(input);
    else {
      actions(dt);
      if (!wheel.open) cam.look(input);
      const t0 = performance.now();
      acc += dt * timeScale;
      let n = 0;
      while (acc >= STEP && n < 5) { simulate(); acc -= STEP; n++; }
      if (n === 5) acc = 0;
      simMs = performance.now() - t0;
      tick(dt * timeScale, dt);
    }
    try { R.render(); } catch (e) { if (!frame.failed) console.error('render failed:', e); frame.failed = true; }
    frames++; fpsT += dt;
    if (fpsT > 0.5) { fps = frames / fpsT; frames = 0; fpsT = 0; }
    if (showStats) {
      statsEl.hidden = false;
      const info = renderer.info.render;
      const p = driving ? driving.position : player.pos;
      statsEl.textContent = `${fps.toFixed(0)} fps · ${R.backend} · ${tier.name}\nsim ${simMs.toFixed(1)} ms · draw calls ${info.drawCalls ?? info.calls} · triangles ${(info.triangles / 1000).toFixed(0)}k\ntiles ${world.tiles.size} · bodies ${physics.world.bodies.len()}\nx ${p.x.toFixed(1)} z ${p.z.toFixed(1)} y ${p.y.toFixed(2)}`;
    } else statsEl.hidden = true;
  }

  /** Per rendered frame: copy physics poses, animate, feedback, camera, HUD, streaming. dt is game time, real is wall time. */
  function tick(dt, real = dt) {
    gameClock += dt;
    for (const c of cars) c.sync();
    props.sync();
    stats.tick(real);
    const aiming = !driving && weapons.weapon.id === 'pistol' && (input.aim || input.fire) && !wheel.open && wastedT <= 0;
    let shot = null;
    if (!driving) {
      shot = weapons.update(dt, input.fire && !wheel.open && wastedT <= 0 && player.knocked <= 0, camera, player.body);
      if (shot?.punch) { hero.play('jab', 1.4, 0.05); punch(); }
      if (shot && !shot.punch) {
        cam.kick(0.012); stats.add('shots'); input.rumble(0.25, 0.5, 70);
        const body = shot.collider?.parent();
        if (body?.isDynamic()) { hitMarker = 0.15; stats.add('hits'); if (props.items.some((it) => it.body === body)) ob.hitProp = true; }
      }
      player.sync(dt, aiming, weapons.cool > weapons.weapon.rate * 0.4 && weapons.weapon.id === 'pistol');
      stats.add('walked', player.speed * dt);
      ob.walked += player.speed * dt;
    } else {
      weapons.update(dt, false, camera, null);
      hero.update(dt);
      const slip = lateralSlip(driving);
      audio.car(true, Math.min(1, Math.abs(driving.speed) / driving.spec.top * 0.9 + 0.12 + (driving.gear > 0 ? (Math.abs(driving.speed) * 3.6 % 22) / 60 : 0)), input.throttle, slip);
      if (driving.crash > 3) {
        audio.crash(driving.crash); cam.shake = Math.min(1, driving.crash * 0.08); input.rumble(Math.min(1, driving.crash / 12), 0.6, 200);
        if (driving.crash > 4) { stats.add('crashes'); const p = driving.position; particles.crash(p.x, p.y + 0.6, p.z, driving.crash); }
      }
      // Tyre smoke from sliding or spinning rear wheels.
      const vc = driving.vc, spinning = input.throttle > 0.9 && Math.abs(driving.speed) < 6 && driving.spec.drive !== 'front';
      for (let i = 0; i < vc.numWheels(); i++) {
        if (!vc.wheelIsInContact(i)) continue;
        const side = Math.abs(vc.wheelSideImpulse(i) || 0) / (driving.spec.mass * 0.012);
        const hb = !driving.wheels[i].front && driving.handbrake && Math.abs(driving.speed) > 4;
        const amount = Math.max(side > 1 ? side - 1 : 0, hb ? 0.8 : 0, spinning && !driving.wheels[i].front ? 0.6 : 0);
        if (amount > 0.2 && Math.random() < amount * dt * 30) { const c = vc.wheelContactPoint(i); if (c) particles.tyreSmoke(c.x, c.y, c.z, Math.min(2, amount)); }
      }
      stats.add('driven', Math.abs(driving.speed) * dt);
      stats.max('topSpeed', Math.abs(driving.speed));
    }
    if (player.jumps) { stats.add('jumps', player.jumps); player.jumps = 0; }
    if (player.landed) { player.landed = false; particles.puff(player.pos.x, player.pos.y, player.pos.z, 6); }
    particles.update(gameClock);
    ob.looked += Math.abs(input.look.x) * 0.002 + Math.abs(input.look.y) * 0.002;
    hitMarker = Math.max(0, hitMarker - dt);
    // Getting hurt: red screen edges, a thud, the controller rumbles.
    while (player.damage.length) { const d = player.damage.pop(); hud.hurt(d); audio.ui('hurt'); input.rumble(Math.min(1, d / 40), 0.8, 180); }
    if (player.health <= 0 && wastedT <= 0) { wastedT = 3.5; $('wasted').hidden = false; audio.ui('wasted'); stats.add('wasted'); input.rumble(1, 1, 500); }
    if (wastedT > 0) { wastedT -= real; if (wastedT <= 0) { $('wasted').hidden = true; respawn(); } }
    // In the sea: no swimming yet — back to the street (and the car back to the kerb).
    const sink = driving ? driving.position.y : player.pos.y;
    if (sink < Y.SEA - 0.8) {
      underwater += dt;
      if (underwater > (driving ? 2 : 0.6)) {
        underwater = 0;
        const s = index.spawn, g = physics.groundAt(s.x, s.z) ?? 0.2;
        if (driving) { const car = driving; exitCar(); car.body.setTranslation({ x: s.x + 4, y: g + 0.4, z: s.z }, true); car.body.setRotation({ x: 0, y: Math.sin(s.heading / 2), z: 0, w: Math.cos(s.heading / 2) }, true); car.body.setLinvel({ x: 0, y: 0, z: 0 }, true); car.body.setAngvel({ x: 0, y: 0, z: 0 }, true); }
        player.place(s.x, g, s.z, s.heading);
        hud.message('Mumbai traffic is dangerous enough — no swimming. Back to Apollo Bunder.', 5);
      }
    } else underwater = 0;
    // Camera (tests can take it over with __game.freeCam).
    if (window.__game?.freeCam) { /* left alone */ } else if (driving) {
      const p = driving.position;
      tmp.set(p.x, p.y + driving.model.dims.y * 0.8, p.z);
      cam.update(real, tmp, 'car', driving.heading, Math.abs(driving.speed), driving.model.dims.z, driving.body);
    } else {
      tmp.set(player.pos.x, player.eye, player.pos.z);
      cam.update(real, tmp, aiming ? 'aim' : 'foot', player.heading, player.speed, 1, player.body);
    }
    const focus = driving ? driving.position : player.pos;
    sky.follow(focus.x, focus.y, focus.z);
    world.update(focus.x, focus.z);
    nav.update(real, focus.x, focus.z, driving ? driving.heading : null);
    onboardingTick();
    if (phone.open) phone.render();
    hud.update(real, {
      pad: input.usingPad,
      health: player.health, armour: player.armour, stamina: player.stamina, wanted: 0,
      weapon: weapons.weapon, ammo: weapons.state, reloading: weapons.reloading > 0,
      aiming, speed: driving?.speed || 0, gear: driving?.gear || 1, inCar: !!driving,
      x: focus.x, z: focus.z, yaw: cam.yaw, heading: driving ? driving.heading : player.heading,
      cars: cars.filter((c) => c !== driving).map((c) => c.position.clone()), hit: hitMarker > 0,
    });
  }

  function punch() {
    const fx = Math.sin(player.heading), fz = Math.cos(player.heading);
    const h = physics.cast(player.pos.x, player.pos.y + 1.2, player.pos.z, fx, 0, fz, 1.3, undefined, player.body);
    const body = h?.collider.parent();
    if (body?.isDynamic()) setTimeout(() => body.applyImpulseAtPoint({ x: fx * 40, y: 8, z: fz * 40 }, h.point, true), 180);
  }

  function lateralSlip(car) {
    let s = 0;
    for (let i = 0; i < car.vc.numWheels(); i++) s = Math.max(s, Math.abs(car.vc.wheelSideImpulse(i) || 0));
    return Math.min(1, s / (car.spec.mass * 0.05));
  }

  // ------------------------------------------------------------------ start
  progress(1, 'Ready');
  hud.start();
  hud.message(`<b>${AREA.name}, Mumbai.</b> ${AUTOMATION ? '' : 'Click to take control.'}`, 6, { sound: false });
  setTimeout(() => $('loading').classList.add('done'), 150);
  requestAnimationFrame((t) => { last = t; frame(t); });
  nav.load().catch((e) => console.warn('GPS:', e));

  window.__game = {
    THREE, R, scene, camera, renderer, physics, world, player, hero, cars, props, weapons, input, cam, hud, menu, sky, audio,
    nav, stats, phone, wheel, places, particles,
    get onboarding() { return onboarding; },
    get driving() { return driving; },
    get paused() { return paused; },
    enterNearest() { const c = nearestCar(6); if (c) enterCar(c); return !!c; },
    exit() { if (driving) exitCar(); },
    setWaypoint, openMenu, respawn,
    closeMenu() { if (menu.open) { menu.hide(); paused = false; } },
    /** Advance the simulation n fixed steps without rendering (headless tests). */
    step(n = 1) { for (let i = 0; i < n; i++) { input.update(STEP); actions(STEP); simulate(); } tick(STEP * n); },
    render() { R.render(); },
  };
}

async function placeCarsAndProps(world, physics, scene, cars, props, spawn) {
  // Parked at the left kerb (India drives on the left) of the streets near the spawn.
  const segs = world.segmentsNear(spawn.x, spawn.z, 140).filter((s) => s.len > 14 && s.hw > 3).sort((a, b) => Math.hypot((a.ax + a.bx) / 2 - spawn.x, (a.az + a.bz) / 2 - spawn.z) - Math.hypot((b.ax + b.bx) / 2 - spawn.x, (b.az + b.bz) / 2 - spawn.z));
  const ids = Object.keys(CARS);
  let k = 0;
  const used = [];
  for (const s of segs) {
    if (k >= 8) break;
    const dx = (s.bx - s.ax) / s.len, dz = (s.bz - s.az) / s.len;
    const lx = dz, lz = -dx; // left of travel
    for (const f of [0.3, 0.7]) {
      if (k >= 8) break;
      const x = s.ax + dx * s.len * f + lx * (s.hw - 1.15), z = s.az + dz * s.len * f + lz * (s.hw - 1.15);
      if (used.some((u) => Math.hypot(u[0] - x, u[1] - z) < 7)) continue;
      const g = physics.groundAt(x, z, 30, 40);
      if (g === null || g > 0.12) continue; // must be on the asphalt
      used.push([x, z]);
      const id = ids[k % ids.length];
      const model = await loadCarModel(id).catch((e) => { console.warn('car', id, e); return null; });
      if (!model) continue;
      const car = new Vehicle(physics, model, x, g + 0.05, z, Math.atan2(dx, dz));
      scene.add(car.object);
      car.sync();
      cars.push(car);
      k++;
    }
  }
  // A few crates and bins on the footpath by the spawn.
  const s = segs[0];
  if (s) {
    const dx = (s.bx - s.ax) / s.len, dz = (s.bz - s.az) / s.len, rx = -dz, rz = dx;
    const kinds = ['crate', 'crate', 'plastic', 'plastic', 'bin', 'crate', 'plastic', 'bin'];
    let i = 0;
    for (const kind of kinds) {
      const x = spawn.x + rx * (s.hw + 2.2) + dx * (4 + i * 1.4), z = spawn.z + rz * (s.hw + 2.2) + dz * (4 + i * 1.4);
      const g = physics.groundAt(x, z, 30, 40);
      if (g !== null) await props.add(kind, x, g, z, i * 0.7).catch((e) => console.warn('prop', kind, e));
      i++;
    }
    props.syncAll();
  }
}

async function buildCredits() {
  let carLines = [];
  try {
    const md = await fetch(`${BASE}art/CREDITS.md`).then((r) => r.text());
    const files = Object.values(CARS).map((c) => c.file);
    carLines = md.split('\n').filter((l) => files.some((f) => l.includes(`vehicles/${f}`))).map((l) => l.replace(/^- /, ''));
  } catch { /* offline */ }
  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  return `
    <p><b>Map data © OpenStreetMap contributors</b> (Open Database License).</p>
    <p><b>Main character:</b> "Indian Man In Casuals" by Pixel_Monster, CC BY 4.0.</p>
    <p><b>Cars</b> (CC BY 4.0):</p><ul>${carLines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
    <p><b>Materials, sky and props:</b> Poly Haven and ambientCG (CC0). <b>Sounds:</b> Freesound contributors (see media/CREDITS.md).
    <b>Animations:</b> Quaternius Universal Animation Library (CC0).</p>
    <p>Physics: Rapier (Apache 2.0). Rendering: three.js (MIT).</p>`;
}

boot().catch((e) => {
  console.error(e);
  $('load-text').textContent = `Could not start: ${e.message}`;
});
