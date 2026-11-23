# Bombay Bawaal (code name GTB) — open-world crime game in the real Mumbai, in the browser

Owner: Amit Patharkar (GitHub: amitpatharkar). Public name **Bombay Bawaal** (`src/brand.js`); "GTB" stays as the code
name (repository, web address `/gtb/`, save keys). Never put "Grand Theft …" or "GTA" in the visible name.

**Fresh start, 2026-11-23.** The owner found the old game sloppy (weird driving, paper walls, buildings on roads,
childish toys) and asked to start again, keeping only what matters. Everything else moved to `trash/` (see
`trash/README.md`; treat it as deleted, copy back only on request). The design is `docs/design.md`: read it first.
The old notes are in `trash/CLAUDE-old.md` (useful for how the map converter and research work).

## Hard rules
- **Everything free.** No paid services, assets or billed APIs. GitHub Pages / Actions, free asset packs
  (Poly Haven, ambientCG, Quaternius, Kenney, CC0/CC BY Sketchfab), Blender.
- **Development in the cloud.** Test by pushing and opening the deployed site. Every push to `main` deploys.
- **Look and behave like the real world**, not GTA 6 photorealism: solid buildings, real physics, real materials.
- **Real scale** (1 game metre = 1 real metre). The playable area is Colaba for now (`AREA` in `src/world/world.js`).
- **Tone (decided 2026-11-23):** a serious crime story with dark humour, like GTA 4/5. Guns are in. Still:
  fictional gangs only, no real underworld figures, nothing touching the 2008 attacks or riots, never mock
  poverty, no real celebrities. Real brands get parody names (cars: Hindostan Envoy, Wagon Arre, Zuzuki SX5,
  Handa Metro); no real logos or number plates (car textures are dropped for that reason).
- **Budgets:** reference machine MacBook Air M4 in Chrome, 60 fps on High; first load ≤ 150 MB on High; site < 1 GB;
  no file over 100 MB in git. Phones get Low.
- Show "Map data © OpenStreetMap contributors" in the game. No Google Photorealistic 3D Tiles.

## Way of working
- Fewer things, each done properly; feel before looks; depth in Colaba before growing the map.
- The owner plays 30–45 minutes a day and builds features one by one: keep `main` deployable, small steps.
- Keep answers short; spell out abbreviations when explaining technical topics.
- Research to reuse: `docs/research/` (Mumbai guides, street library, assets), `docs/knowledge/` (how Rockstar
  built GTA), `docs/gta-v-development-analysis.md`.

## Stack
- Three.js r187 **WebGPU renderer** (`three/webgpu`; falls back to WebGL 2 automatically, `?webgl` forces it; if
  the WebGPU device is lost the game reloads once on WebGL 2). Materials and effects in **TSL** (`three/tsl`):
  no `onBeforeCompile` (does not exist on the WebGPU path). Vite 8, plain JavaScript modules.
- **Rapier 0.21** (`@dimforge/rapier3d-compat`) physics. Ray casts only see colliders after a world step.
- `vite.config.js`: `base: '/gtb/'`, copies the Basis transcoder to `public/basis/`, build target es2022.

## Layout
- `index.html` — page shell: `#game`, HUD (`#hud`: messages, weapon, minimap + street + health/armour bars,
  speedometer, prompt, crosshair, vehicle name, OSM credit, stats), loading screen, pause menu.
- `src/main.js` — boot (renderer → physics → textures → world tiles round the spawn → sky → hero → cars and props →
  HUD), fixed 60 Hz simulation (`simulate()`), per-frame `tick()` (pose sync, weapons, camera, HUD, streaming), enter
  and exit cars (driver's door on the right, India), sea → respawn at Apollo Bunder. `window.__game` for tests:
  `step(n)` (n fixed steps + one tick), `enterNearest()`, `exit()`, `freeCam`, `input.forced` (Set of actions).
- `src/core/renderer.js` — tiers `high|medium|low` (`?quality=`, saved `gtb.quality`): one scene pass with colour,
  normals, metalness/roughness and motion vectors → GTAO ambient occlusion (High) → screen-space reflections (off by
  default, `?ssr`: dark smudges in tests) → bloom (clamped input: the sky's sun is huge) → TRAA temporal anti-aliasing
  (High, Medium; MSAA on Low) → ACES tone mapping. `?noao&notaa&nobloom` for comparisons. Cascaded shadow maps (High 4,
  Medium 3) in `sky.js`.
- `src/core/physics.js` — world, `STEP`, collision `GROUP`s and `groups()`, `cast()` and `groundAt()`.
- `src/core/input.js` — actions from keyboard/mouse (pointer lock) and standard gamepads: `down/pressed/released`,
  `move`, `look`, `throttle/brake/steer`, `aim/fire`.
- `src/core/audio.js` — Freesound street ambience and horn; synthesised engine, tyre squeal, crash, gunshot.
- `src/world/world.js` — streams map tiles (worker), meshes + one fixed trimesh collider per tile, invisible walls
  round `AREA`, sea plane, `roadNameAt`, `segmentsNear`, `whenReady`.
- `src/world/worldWorker.js` — decode tile, build ground (`mesh/ground.js`), buildings (`mesh/blocks.js`), collision
  soup (solid ground + land underneath + buildings), points, minimap road lines, named segments. **Drops buildings
  that stand on a road** (a vehicle road's centre line runs > 5 m inside the outline, 14 m for service roads).
- `src/world/mesh/blocks.js` — walls per style (`STYLES`), parapets, roofs; wall UVs in metres; `facade` attribute
  [seed, storey height, flags (SHOPS/BLANK/GLASS), bay width].
- `src/world/materials.js` — `TextureLibrary` (KTX2 from `media/`, real-world sizes from the manifest; ids must be
  written literally so `scripts/ship-media.mjs` ships them), ground surfaces (asphalt desaturated), painted kerbs,
  TSL facade (windows, frames, curtains, glass reflections, monsoon streaks, ground-floor shutters and sign bands),
  sea with analytic ripples.
- `src/world/sky.js` — HDRI sky + lighting; the sun light sits where the photo's sun is (brightest pixel, kept ≥ 30°
  up); fog from the horizon colour; shadow box follows the player, snapped to texels.
- `src/world/trees.js` — broadleaf trees (leaf-card crowns with outward normals), palms, street lights from the map
  points; instanced per tile; solid cylinders.
- `src/world/props.js` — Poly Haven crates and bins as dynamic bodies.
- `src/world/tileFormat.js`, `levels.js`, `overviewFormat.js`, `mesh/builder.js`, `mesh/ground.js` — kept from the
  old game; shared with the converter.
- `src/player/hero.js` — main character (`public/people/hero/`, CC BY Pixel_Monster) and his 42 clips (additive deltas).
- `src/player/onFoot.js` — kinematic character controller (capsule 1.7 m, autostep 0.38 m for kerbs, snap to
  ground, pushes props), run 3.6 / sprint 6.4 / walk 1.5 m/s, jump, animation by real speed.
- `src/player/camera.js` — orbit / over-the-shoulder aim / car chase (swings behind when you stop looking around),
  ray-cast so it never goes through walls.
- `src/vehicles/cars.js` — `CARS` list shared with `scripts/cars.mjs` (glTF-Transform + meshoptimizer: each upload →
  `public/art/cars/<id>.glb`, textures folded into colours, simplified, meshopt-compressed; ~2 MB for four cars).
- `src/vehicles/carModel.js` — loads `art/cars/<id>.glb` (`CARS`: file, parody name, length, `turn` to face +z, drive, mass, accel, top speed,
  seat). Loads the owner's GLB as uploaded, drops flat ground planes, scales to real length, finds wheels by name and
  moves them into pivots, drops textures (average colour kept), picks the paint material by area and repaints each car.
- `src/vehicles/vehicle.js` — Rapier `DynamicRayCastVehicleController` (forward axis z), `TUNE` handling numbers
  (tuning panel F2 saves to `gtb.tune`), engine fading to top speed, brakes ≈ 0.8 g, handbrake drops rear grip,
  drag and rolling resistance, anti-roll torque while ≥ 2 wheels touch, `rightUp()`.
- `src/combat/weapons.js` — fists and pistol (12 + 60, hitscan from the camera, muzzle flash light, tracer, reload).
  The ray tests the world and props with Rapier and cars by their real shape (three-mesh-bvh trees built in
  carModel.js; shots through windows fly on); bullet holes on walls (instanced) and on car panels (decals parented
  to the car, 24 max); impulse on dynamic bodies.
- `src/fx/particles.js` — GPU particles (tyre smoke, dust, debris, sparks): spawned once into a ring of instanced
  attributes, moved/grown/faded in TSL from a game-time uniform (pause and slow motion apply). Drawn in their own
  pass (`R.fxScene`, composited after ambient occlusion) and hidden behind walls by the scene depth (soft particles).
- **Interface: read `docs/ui.md`** (built from a GTA V UI/UX study): `src/ui/hud.js` (priorities, HUD modes full /
  contextual / minimal, GTA-style rectangular radar with route, blips, distance; health/armour/stamina strip; objective,
  notifications with log, prompts with device glyphs `{action}` from `glyphs.js`, area names), `nav.js` (GPS: owners
  'user' / 'objective', A* in `mapWorker.js` on `tiles/overview.bin.gz`, re-route, arrival), `mapView.js` (full map,
  filters), `menu.js` (MAP/BRIEF/STATS/SETTINGS/GAME, settings with explanations, keyboard and controller navigation),
  `weaponWheel.js` (hold Tab/LB, slow motion), `phone.js` (P: Maps, Messages, Contacts, Settings), `places.js`
  (landmarks with altered names, map categories), `icons.js`, `tuning.js` (lil-gui). `src/game/onboarding.js`
  (adaptive tutorial, Guidance setting), `stats.js` (`gtb.stats`).
- `src/player/onFoot.js` also has health (falls and cars hurt; recovers to half), stamina (sprint), `knock()` (a car
  hits you: under 6 m/s thrown and down 1.6 s; harder → `goLimp()`), WASTED → respawn at Apollo Bunder.
- `src/player/ragdoll.js` — Rapier ragdoll: 11 capsules (pelvis, chest, head, arms, legs) with spherical joints, built
  from the current pose and speed; bones copy the capsules; group `RAGDOLL_GROUP` (hits world, cars, props); after
  it settles (2–5 s) the capsule player comes back where the hips lie and plays the get-up clip.
- `scripts/build-tiles.mjs` + `scripts/lib/` — OpenStreetMap converter (`npm run tiles`, ~75 s, skips when inputs
  are unchanged; details in `trash/CLAUDE-old.md`). `scripts/ship-media.mjs` — ships only media ids and art files
  named in `src/`. `scripts/assets/` — asset pipeline → `assets` branch (`npm run assets:pull` locally).
- `public/art/vehicles/` — owner's car uploads (CC BY, credits in `public/art/CREDITS.md`; only files named in
  `CARS` ship). `public/people/hero/` — main character. `public/tiles/`, `public/media/`, `public/basis/` generated.

## Status
- Done (2026-11-23, fresh start): design doc; old game to `trash/`; WebGPU + TSL renderer; Rapier world; Colaba
  with solid buildings, kerbs, trees, lights; main character on foot; four cars with real wheels and suspension;
  pistol; HUD, pause menu, tuning panel; smoke test.
- Not verified here: the WebGPU path renders (headless WebGPU in the sandbox loses its device even on a bare test);
  the WebGL 2 path is what the tests and screenshots use. Ask the owner how it runs on the Mac.
- Done (2026-11-23, later): light car models (glTF-Transform), cascaded shadows, TRAA, GTAO, GPU particles,
  exact hits (three-mesh-bvh), ragdoll, the full GTA-style interface (`docs/ui.md`).
- Not used, on purpose: Takram atmosphere/clouds and Spark splats (WebGL-only libraries, not compatible with the
  WebGPU renderer); Recast Navigation + Yuka wait for pedestrians/traffic; Google Open Buildings (free, CC BY 4.0 /
  ODbL; per-S2-cell files of 0.8–1.2 GB) needs a GitHub Action to download and merge into the converter.
- Next (owner picks the order, see `docs/design.md`): pedestrians (Recast + Yuka); traffic; police and wanted system;
  Mumbai building kit; day/night and monsoon; sound; missions; the rest of the map.

## Testing in the session
- `npm run build` (tiles → cars → vite → ship-media; ~76 MB site) then `npm test` (`tests/smoke.mjs`, `--only=world,
  foot,drive,shoot,ui`, `--quality=`, `--shots=dir` for screenshots). Runs in the deploy workflow before every deploy; add a
  check for every new system.
- Without `public/media` (`npm run assets:pull`) everything 404s.
- Headless Chromium uses SwiftShader WebGL 2 (`--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`).
  Drive the game through `window.__game.step(n)` and `input.forced`; set `__game.freeCam = true` to place the camera.
- The sandbox cannot reach the live github.io site; ask the owner for live checks.

## Git
- Commit author: `Amit Patharkar <amitpatharkar@users.noreply.github.com>`.
