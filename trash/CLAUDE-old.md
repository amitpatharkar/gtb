# Bombay Bawaal (code name GTB) — Mumbai open-world browser game

A fun, toned-down, GTA-style open-world game set in the real Mumbai, playable in any web browser.
Not a hyper-real replica: comedy and chaos over violence (for example, a "wanted level" for breaking traffic rules).

Owner: Amit Patharkar (GitHub: amitpatharkar). Public name: **Bombay Bawaal** (decided 2026-11-13; "bawaal" = uproar),
set in one place, `src/brand.js`. "GTB" (the owner reads it as "Grand Theft Bombay") stays as the code name:
repository, web address `/gtb/`, save keys. Never put "Grand Theft …" or "GTA" in the visible name (Rockstar trademark).

## Hard rules
- **Everything must be free, start to finish.** No paid services, paid assets, or APIs with billing.
  Prefer: GitHub (public repository), GitHub Actions, GitHub Pages, GitHub Codespaces free hours,
  Cloudflare R2 free tier (later, for large assets), free asset packs (Quaternius, Kenney, Poly Haven, Mixamo), Blender.
- **Development happens in the cloud**, not on the owner's laptop. Test by pushing and opening the deployed site.
- **Graphics goal (updated 2026-11-13):** believable, realistic Mumbai at street level — "like I am actually driving
  or walking in Mumbai". Real photo-scanned materials (free, physically based), real-time shadows, good lighting;
  far beyond GTA Vice City. Not a drone-footage scan: realism comes from materials, district styles, street clutter,
  hand-made landmarks and lighting (detail where the camera looks).
- **Real scale (decided 2026-11-13):** Mumbai stays 1:1 (1 game metre = 1 real metre); the map grows outward.
- **Names:** real brands, logos and trademarked buildings (e.g. the Taj Mahal Palace facade) get altered names;
  ideas in `docs/research/mumbai-guide.md` and `mumbai-guide-2.md`. The ride app is **Kidhar** ("Chalo" is BEST's
  real app). Never use "Jhakaas" or "Bhidu" (court-protected catchphrases). No real celebrities (names, faces,
  voices): fictional stars with original house designs and altered house names (OpenStreetMap carries "Mannat",
  "Jalsa", "Antilia" — never show those). No 2008-attack, riot or gangster references; never mock poverty.
- **The plan:** `docs/plan.md` (phases 1–5, status per item) built from the reviews in `docs/research/*-2026-11.md`.
  Work through it in order; update the status column as items land.
- **Must stay light to load:** first load under ~50 megabytes; stream map tiles near the player;
  compress textures (KTX2) and models (Draco or meshopt). GitHub Pages site must stay under 1 gigabyte;
  no single file over 100 megabytes in git.
- Show "Map data © OpenStreetMap contributors" in the game (Open Database License requirement).
- No Google Photorealistic 3D Tiles (not free at scale; terms forbid game use).

## Design principles (Rockstar method, cheap version)
Full analysis: `docs/gta-v-development-analysis.md` (owner's notes on how GTA V was made). Follow these:
- **The city is the star; map first, missions later.** Make South Mumbai drivable and believable before adding systems.
- **Real as a starting point, not a rulebook.** Keep the real street layout; exaggerate landmarks; invent where fun needs it.
- **Streaming is the backbone; detail only where the camera looks.** Tiles stream around the player; far tiles get less
  detail (level of detail); hide limits with speed caps and short fades on teleports.
- **Staged life, not full simulation.** A few dozen people and cars spawned near the player; hand-placed "scenarios"
  (vada pav stalls, chai tapris, cricket in maidans); spawns depend on the district.
- **Humour through systems:** traffic-police "challan" wanted stars, fake brands and billboards, a Bollywood-style radio.
- **Playable early, iterate forever:** every push deploys; test feel on phone and laptop; nothing is locked.
- **Research first (Garbut's "block guides"):** `docs/research/mumbai-guide.md` has district guides (styles, colours,
  street life), 32 landmarks with altered names, vehicles and signage; use it when building each area.

## Talking to the owner
- Keep answers short and to the point.
- When explaining technical topics, spell out abbreviations in full.

## Stack
- Three.js (rendering) + Vite (dev server and build). Plain JavaScript modules, no framework.
- `vite.config.js` sets `base: '/gtb/'` for GitHub Pages — keep it in sync with the repository name.
- Deploy: `.github/workflows/deploy.yml` builds and publishes `dist/` to GitHub Pages on every push to `main`.
  Live URL: https://amitpatharkar.github.io/gtb/
  (Owner must have Settings → Pages → Source set to "GitHub Actions"; this was pending at handover.)

## Layout
- `people.html` — the people lineup page (see `src/people/lineup.js`)
- `index.html` — page shell, heads-up display (speed, road name, clock, AQI, minimap, fuel and car meters, messages),
  loading screen, OpenStreetMap credit, Credits panel, Graphics link, empty `#touch` (filled by `src/ui/touch.js`)
- `src/ui/touch.js` — phone/tablet controls (only with `(pointer: coarse)` or `?touch`; `body.touch`): left thumb =
  floating joystick on foot (`input.moveX/moveY/analog`, full push runs; walker.js reads it) or the ◀ ▶ steering pad
  in a vehicle; right thumb = brake/REV + gas pedals with handbrake, horn, door, radio, TAXI duty, or on foot the attack
  button (drag = `view.look`) with an arc of moves (CSS `--cx/--sy/--r` slots); context buttons in `.t-dock` (get in /
  steal, fill up, snack, door/indoor prompts, ticket, mission skip-hour). main.js `touchState()` (every HUD update)
  says what shows (`data-mode` drive/foot/hidden, weapon, indoor, fight…); actions are callbacks into main.js. Pads
  and holds use pointer capture; nothing stays held on mode change or blur. Pause menu has Skip an hour and Tow truck.
- `src/main.js` — boot order (texture library → tiles → sky → post-processing → clock, traffic, audio, minimap),
  chase camera, `step(dt)` simulation (also called by headless tests via `window.__gtb.step`), night lights near the
  player, refuelling, HUD. URL options: `?quality=high|medium|low`, `?hour=20.5`.
- `src/settings.js` — `detectTier()`: Medium on desktop WebGL 2, Low on phones/tablets/software; `TierProbe` falls back
  to Low if under 40 fps at resolution scale 0.6 (off once the player picks a tier: `gtb.tierChosen`). Quality tiers (High: ambient occlusion, 4096 shadows, normal maps; Medium: no AO, normal maps,
  bloom; Low: no post-processing, 3D facade parts within 45 m). First run: `detectTier()` picks Medium on dedicated or
  Apple-silicon graphics, Low elsewhere; main.js lowers the resolution on the fly when the frame rate drops
  (`dynRes`, off under automation). Q key / Graphics link cycles and reloads.
- `src/render/post.js` — Low has a CSS grade overlay `#grade` (`post.grade`); `src/render/photo.js` saves photos with the
  OpenStreetMap credit. Composer: scene (MSAA, half-float) → GTAO ambient occlusion from depth only → bloom →
  Neutral tone mapping (renderer, main.js) → colour grade/vignette
- `src/world/environment.js` — HDRI sky (rotated so its sun follows the clock), sun-free copy for lighting, sun +
  moon lights, haze colour/density from daylight and AQI, sea shader (3 scrolling ripple layers, no visible tiling)
- `src/world/textures.js` — `TextureLibrary` (KTX2 from `media/`, progressive: flat colour until loaded; real-world
  texture size from the manifest), `addMacroVariation()` world-space anti-tiling noise
- `src/world/materials.js` — one material per worker mesh key (asphalt, pavers, plot concrete, grass, sand, kerb
  stripes, worn paint, sea wall, parapet, roofs incl. tarpaulin/rust) + one facade material per building style
- `src/world/facadeRules.js` — facade rules shared by the tile worker (3D parts) and the facade shader (styles, bays,
  window rectangles, 32-bit integer hash identical in JavaScript and GLSL); `src/world/facadeParts.js` — real 3D facade
  parts near the player (frames, sills, chajjas, grille cages, AC units, balconies, signboards, shutter boxes), one
  instanced mesh per part type for the whole city
- `src/world/facade.js` — facade shader (far windows and fine patterns fade by screen size; shop goods 8–12 cm packets; windows/glass reflections, curtains, grilles, balconies with clothes, AC units,
  sunshades, monsoon streaks, floor bands, parapet coping, ground-floor shops with shutters and signboards, lit windows
  at night) and the shop-sign atlas (128 boards, Marathi in Devanagari over English, BMC style; fonts from `media/`).
  Per-building attributes MUST stay `flat` varyings (interpolation noise + hashing = speckle). Debug:
  `window.__gtb.facadeDebug.value = 1..4` (albedo, roughness, normal, window grid).
- `src/world/nightLights.js` — night light without real lights: `addNightLight(material)` patches the ground and
  wall materials (materials.js) with sodium pools under the nearest street lamps (mapped lamps + one every 30 m
  along every other street, `gatherLamps` in main.js) and headlight cones on the road ahead of nearby traffic and
  the player's car (entry 0, `uOwnCar`); `updateNightLights()` refreshes the uniforms every 0.12 s at night.
  environment.js switches the sky to a night texture (city glow, stars) after dusk — the sky photo has a sun.
- `src/world/skyline.js` — far skyline: tall buildings of the whole map as boxes (`tiles/skyline.bin.gz` from
  `scripts/lib/skyline.mjs`: 11 bytes per box, top 6 per 200 m cell + everything over 45 m), one InstancedMesh
  refreshed when the player moves 120 m or tiles change; boxes are skipped where a tile is loaded; fog is the
  same as real buildings up to `tier.loadRadius`, then compressed ×0.3; window glow at night via `facadeNight`.
- `src/world/hoardings.js` + `mesh/hoardingMesh.js` — rooftop hoardings: `ADS` (30 parody ads; every brand, film
  and star is made up) drawn into one 2048² canvas atlas (4 × 8 cells, last two = steel), redrawn with the sign
  fonts (`signs.redraw` in materials.js); the worker adds a board + posts over the longest street-facing wall of
  some buildings (mesh key `hoarding`, max 8 per tile); material is lit at night through `facadeNight`.
- `src/world/clutter.js` — `StreetClutter`: street clutter near the player from the clutter points (below) and the
  worker's `shutterBox` parts: unipoles (V of two boards showing the `ADS` atlas, `UNI`), blue street-name boards
  (two faces) and direction boards / overhead gantries (one panel per destination line), cable bundles (unit
  catenary `cable`, matrix = span × sag × side via `putSpan`), lane and stall tarpaulins (`sheet()`), shamiana over
  puja stalls, 6 shrine kinds, flower sellers, gates (leaves swing: open by day or within 7 m of the player, shut at night and then solid — `gateOpen` state per gate, `swingGates()` poses the leaves every frame; monobloc chair, some security cabins), shopfront
  awnings by the street profile's `awn` shares [cloth, striped, tarp, metal] (`AWN_DEFAULT` elsewhere). 4 draw calls:
  BatchedMesh `solid` (vertex colours, tinted per instance), BatchedMesh `cloth` (two-sided), InstancedMesh `boards`
  (`aRect` = atlas rectangle) and `ads` (`aAd` = ad cell). Board text: atlas of 512 × 128 cells (64, Low 32) drawn on
  demand per label with `renderer.copyTextureToTexture`, least recently used recycled, 14 new per refresh;
  `setFonts` chains `materials.signs.redraw`. Refreshes every 0.5 s after 12 m (`rebuild`, radii `R` by tier);
  `hits()` (allocation-free grid of poles, shrines, stalls, cabins) is chained onto `world`/`footWorld.hits` in main.js;
  `drawPeople(hour)` adds the seated watchmen (all day), flower sellers and stall keepers (by day). `counts` per kind.
- `src/world/props.js` — procedural instanced props by point kind: rain tree, gulmohar (December: ~5 % in bloom, 30 % drawn as rain trees), peepal, coconut palm
  (alpha-tested leaf cards), street light (4 types in the point's size: standard, tall, heritage triple lantern, globe —
  `LAMP` in `scripts/lib/streetLibrary.mjs`), traffic signal, BEST bus shelter, pothole and puddle decals, garbage pile,
  thela with umbrella, petrol pump canopy, sea-wall tetrapods, median hedge (`POINT.HEDGE`: size = length, from the
  street library's planted medians, `streets.mjs`), tower crane (`CRANE`, size scales it), orange-white water barrier
  (`BARRIER`, bazaar lane dividers), traffic-police barricade (`BARRICADE`, beside signal junctions), flex banner on a
  lamp post (`BANNER`: 8 made-up designs in one atlas, the size picks the design via the `aCell` attribute)
- `src/world/tiles.js` — `TileManager`: streams tiles, builds meshes/props, collisions (`hits`), `walkable`,
  `groundHeight` (asphalt 0.02 m, kerb level 0.2 m), `roadAt`, `roadNameAt`, `segment()`; `version` bumps on load/unload.
  Collision queries allocate nothing: numeric `tileKey` maps (`byKey`, `availableKeys`), `nearInto()` fills `tiles.near`;
  `roadHit(x, z, slack, vehicleOnly)` leaves its answer in `roadTile`/`roadIndex`/`roadDist` (`roadAt` wraps it)
- `src/world/tileWorker.js` + `src/world/mesh/` — worker: `ground.js` (ground layers, kerbs with paint strip, sea walls,
  parapet, tetrapods, markings, footways, rails), `buildings.js` (per-style walls with facade data, parapets, stair
  rooms, roof types, water tanks), `builder.js` (mesh helpers). Road segments: 6 floats `x0 z0 x1 z1 halfWidth flags`
  (flags 1 vehicle, 2 one-way, 4 main road, bits 8–15 street profile). Kerb paint: the street profile's
  (`ROAD_FLAG.KERB_BW/BY/PLAIN`), else black-yellow near main roads (`kerbPlain` elsewhere); median kerbs (another
  carriageway within 6.5 m beyond the kerb) black-white (`kerbBW`). Netting buildings get a green mesh wall (`netting`);
  `BUILDING_FLAG.ARCADE` (street library `arcade`) street walls: upper floors on the line, shops 2.8 m back behind
  piers under a ceiling (`arcadeWall` in buildings.js; the footprint still collides). Every building gets a
  contact-shade band on the ground along its walls (mesh key `contact`).
- `src/world/tileFormat.js` — binary tile format v3 (buildings with style/levels/street-facing walls and flags incl.
  `NETTING`, areas incl. PLOT/ROAD/FOOTPATH, roads with kerb/median flags and a street-profile byte, rails, markings,
  points, then optional `labels` (strings per tile + point index → string: board text; the worker hands them over as
  `t.labels[kind][instance]` for `LABELLED` kinds)); `src/world/levels.js` — ground heights. Clutter point kinds
  18–29: UNIPOLE, CABLES (size × 12 = span), NAME_BOARD ("English|मराठी"), DIR_BOARD / DIR_GANTRY ("Dadar|दादर|^;…",
  gantry size × 16 = span), TARP (size × 10 = span), STALL_TARP, SHAMIANA, SHRINE (size = 0.5 + 0.25 × kind), FLOWERS,
  GATE, HANDCART
- `src/vehicles/taxi.js` + `car.js` — procedural kaali-peeli taxi (Premier Padmini proportions, clear-coat paint) and car
  handling (bicycle steering, two collision circles, kerb bumps, body roll/pitch, fuel ~40 km per tank, condition);
  kerb and pothole jolts fire once per wheel event (`prevGF`/`prevGR`: kerb 7 % per axle, pothole 3 % per wheel +
  damage above 9 m/s), so the loss is the same at any frame rate
- `src/sim/clock.js` — 24-hour clock (1 real s = 1 game min, T = +1 h), real sun path for Mumbai in December,
  daylight/night/twilight, AQI by hour (CPCB scale), traffic density table by hour (≈5 % at 3 am, 100 % 9–11 and
  18–20) and `jam` (slower cruising at peaks)
- `src/sim/traffic.js` — **new per-car fields must be added to the spawn object, and fleet types keep one shape
  (`sameShape()`)**: mixed object shapes made every numeric read allocate. `driveCar` (per car), `gapAhead`
  (look-ahead), `gatherBlockers` (player at real length, the vehicle left while on foot = `traffic.car`, parked taxi,
  `left`, patrols via `traffic.police`, obstacles); `lanesOf` cached per segment (`seg.lanes`); vehicle mix cached per
  quarter hour (`pickType`); kerb parking forms kaali-peeli taxi ranks where the profile has `taxis` (`TAXI_RANK`).
  Handcarts: `HANDCART` points become parked carts on the footpath (`placeParked`, key `hc:x,z`, drawn at
  `groundHeight`); `spawn` turns 13 % of new vehicles on tiles with handcart points into a pulled `handcart` (7–21 h).
- `src/sim/traffic.js` (continued) — ambient traffic near the player (fleet from `src/vehicles/fleet.js`: taxis, hatchbacks,
  sedans, SUVs, BEST buses on main roads, tempos (more at night), motorbikes with riders), keeps LEFT, follows the
  road graph (loose ends within 2.5 m joined; per-tile segment data cached on `tile.graph`, numeric junction keys
  from `src/sim/roadKeys.js` — the rebuild runs on every tile load, keep it cheap; police build their graph lazily
  only while patrols are out, signals rebuild one frame later), lanes as painted by the converter (`lanesOf`: kerb
  lane 0 for two-wheelers/autos/buses, parked cars take the kerb lane on wide streets), overtakes on the RIGHT into a
  free lane or, on two-lane roads, into the oncoming lane only when clear (`laneFree`, `oncomingClear`), drifts back
  left; respects one-ways, stops at red (jumpers, amber gamblers, zebra creepers),
  stops for `obstacles` (cows, cricket, jaywalkers), draws `extras` (broken-down taxi), pull-overs, honks
- `src/vehicles/fleet.js` + `loft.js` — Indian traffic at real sizes with parody names (Alto, WagonR, Swift, i10,
  Dzire, City, Ertiga, Innova, Bolero, Creta, Eeco, WagonR/Santro kaali-peelis, white app cabs with yellow plates,
  Cool Cab, vintage Padmini, BEST bus + electric double-decker, Tata Ace, 407 tempo, Activa, delivery scooter,
  Splendor, Bullet). Bodies are lofted cross-sections (bonnet, raked glass, wheel arches, tumblehome); each type has
  near + far (LOD) geometry; traffic.js draws the whole fleet with one BatchedMesh per part (paint tinted per car,
  glass, trim with vertex colours, lamps) = 4 draw calls. Type fields: weight, night, mainRoad, big, rider, seat.
  Also: auto-rickshaw (`city: 0` = suburbs only, north of ~19.042° N (Mahim creek–Sion), `traffic.inSuburbs(z)`; `open` + `seat` +
  `seatZ` = visible khaki driver, `pax` = passenger on the bench), water tanker, garbage truck, ambulance, school
  bus, bicycle and dabbawala cycle (`slow` = others overtake, `pedal` = POSE.PEDAL), handcart (`pull`: weight 0, only
  on bazaar streets; the puller walks between the shafts at `seatZ`, main.js; taken by the player it is pulled on foot,
  shouts instead of a horn, `DRIVE` 3.2 m/s). The batches must keep
  `frustumCulled = false` (their bounding sphere is computed once; traffic vanished far from the start).
- `src/vehicles/skids.js` (tyre marks), `damage.js` (dents, loose bumpers, dying lamps, bonnet smoke; repair at pumps)
- `src/sim/signals.js` — working signals at OSM signal junctions: poles on the left kerb per approach, lamps and
  red/green countdowns, two phase groups; `ahead(x, z, fx, fz)` gives the next stop line and its light
- `src/sim/police.js` — (patrol car models pooled in `modelPool`; `buildGraph` clears patrol routes; `cancelStop()`
  when the hawaldar dialog is closed with Esc/click outside — `choice(title, options, onCancel)` in main.js) traffic constables (umbrella, 8 am–11 pm) at about half the main junctions catch or miss
  red-light jumpers; player offences (signal jump, wrong way on one-way, footpath driving, hit-and-run, colouring a
  policeman) count only when seen → challan stars and fines; stop by the constable to pay, or a fictional
  "Mumbai City Police" patrol car chases (A* on the road graph, siren, light bar); out of sight → stars fade
- `src/sim/people.js` — procedural people (one instanced mesh, limbs animated in the shader; poses walk/stand/wave/
  point/argue/bat/sit/crouch; flags cap/sari/helmet); `src/sim/animals.js` — stray dogs and humped cows
- `src/sim/birds.js` — pigeon flocks at famous spots (`SPOTS`: Gateway plaza, Dadar kabutarkhana, …) that peck about
  and take off when the player, a honk (`birds.scare`) or a cracker comes close, plus kites circling overhead;
  one instanced mesh, wings flap in the vertex shader (`aFlap`: 0 folded, 1 flapping, 2 gliding).
- `src/sim/trains.js` — local trains (loaded after play starts; `scripts/lib/trains.mjs` writes `tiles/trains.json`: lines
  from the OSM route relations, stations, turn-rounds; buildings over the tracks raised by the converter): one
  instanced mesh of coaches within ~1 km (20.73 m coaches at 21 m pitch, 3.66 m wide), timetable from the game clock
  (`Line.state`, 20 s dwell, first 4:15 / last ~1:00), `hits`/`bodyAt` (solid, heavy), `shove`, level crossings,
  `COACH_CLASS` per line (first class red-yellow stripes, ladies lime, luggage, disabled — `aOpt2` in the shader),
  AC locals (`AC_SHARE`, blue band, sliding doors `tr.doors`), doorway riders and door-hangers by load, platform crowds
  that grow between trains and board/alight (`stationLife`, `fillPlatform`, `toDoor`, `alighting`), booking office
  (`interact()` → tickets panel, `ticketGroups`), `nearestStation`, `ride()` = quick travel for tests/missions.
- `src/sim/trainRide.js` — riding a local: F at an open door boards (`tryBoard`), the walker stands in the doorway
  (`ride`), Space skips to the ticket's station (`skip`: moves `trains.t`, clock by the real trip time), F gets off
  (`alight`; jumping at a crawl); ticket checkers on board/at exits (₹500 + fare), RPF in the ladies coach (₹2,500);
  a train leaving the map drops you at its last stop. `src/sim/railDemand.js` — the rush model shared by locals and
  metro: `hourIndex`, `townShare` (peak direction), `stationWeight`, `trainLoad`, `waiting`, `COACH_LOAD`.
- `src/game/tickets.js` — tickets for locals (II/I/AC × single/return/monthly pass; `localFare`, `localPass`;
  `findLocal(from, to, need, dist)` = a ticket covering the trip) and metro QR (`metroFare` slabs, `findMetro`);
  the counter panel `open({ sys, from, groups, where, onBuy })`; `fine()`; saved in `state.s.tickets`. The phone app
  Tikitwala (`phone.tikitHtml`/`onTikit` in main.js) books from the nearest station (not within 35 m of it).
- `src/world/structures.js` — walkable structures above the street (platforms, footbridges, stairs, metro concourses):
  floors, ramps, walls, posts in a 16 m grid; `groundHeight(x, z, y, base)` (highest floor within a step of y),
  `hits(x, z, r, y)` (walls whose height span meets the body; `pass()` = an open fare gate). The walker passes its
  height (`footWorld`); vehicles collide at street level.
- `src/world/stations.js` + `scripts/lib/stations.mjs` (→ `tiles/stations.json`) — every railway station in the map:
  OSM platform outlines grown and cut back to 1.7 m from the track centres, tops 0.9 m above the rail (1.3 m), end
  ramps; footways on bridges → decks 7.5 m above the rail with parapets, roofs and piers off the tracks; mapped steps →
  stairs, generated where a platform or deck end has none; butterfly roofs on a column row (unless OSM maps a canopy,
  which the converter raises clear), benches, a stall, yellow boards (Marathi/Hindi/English), LED indicators
  (`drawIndicator`, next trains). Built a few ms per frame within 560 m (`job`), `buildNow(x, z)` after a teleport.
- `src/world/metro.js` + `scripts/lib/metro.mjs` (→ `tiles/metro.json`) — Line 1, the 2A/7/2B ends and the Monorail
  on viaducts (U-girders 13 m up on single piers, monorail beam 9.6 m; 400 m chunks), elevated stations at the mapped
  places (side platforms 14.05 m, concourse 7 m with counters, QR machines, security and fare gates, stairs to the
  street where they land clear), metro trains (`MLine` run profile, `METRO_LINES` headways and hours, sliding
  doors), ride (F board/alight, Space next station), tap in/out with excess fare; Line 3 = glass street entrances,
  E → ticket → underground trip to the other station's entrance; the closed monorail has parked trains.
- `src/sim/street.js` — street life near the player: pedestrians on footpaths (jaywalk, dodge the taxi, puddle splash),
  scenarios from map points (thela vendors calling + customers, bus-stop commuters, dogs by garbage that chase the taxi,
  cows on lanes, gully cricket, push-starting a broken-down taxi), red-light hawkers, bump-and-argue drivers
- `src/game/state.js` — saved player state (localStorage): money, hunger, energy, purchases, messages, rides; home
  address in Powai (`HOME`); `src/game/jobs.js` — taxi fares (J / Chalo app; meter, time, comfort → tips or cuts,
  rating), delivery riders, snacks at thelas (E); `jobs.garage` → fares also in an auto (`AUTO_BASE`/`AUTO_KM`,
  suburb destinations only; `garage.update(dt)` raises `police.offence('autozone')` for an auto in town)
- `src/player/view.js` — GTA-style camera control: click to capture the mouse (pointer lock), orbit around the taxi
  (swings back behind it) or over the shoulder on foot, right mouse aims (zoom + crosshair), wheel = pichkari pressure;
  touch: drag to look, 🎯 aim button
- `src/player/walker.js` — on foot (F out/in; camera-relative WASD, Shift run with stamina, health, pushed/knocked
  over); `src/player/pichkari.js` — gun-shaped Holi pichkari (left mouse/Space spray where the camera aims, C colour
  ×12, [ ] or wheel pressure 1–5, tank), drops, splats, colour patches on people (`addPatch` in people.js, 6 per
  person, shader splats in rest-pose space), NPC sprayers; `src/player/combat.js` — fists (punch), V kick, G insult
  (bleeped); NPC reactions (insult back, fight with punches/pushes, throw tomatoes/chappals, spray back ~1.5 %, flee,
  knocked down then limp away); ~4.5 % of passers-by start it; kids and animals never targets; police: brawl/assault
- `src/world/propPhysics.js` — solid trees/lamp posts/bus shelters/thelas, tree shake, bent poles, flying fruit,
  scattering garbage (simple rigid bits)
- `src/vehicles/garage.js` — take and drive any vehicle (F on foot next to a traffic, parked or left vehicle):
  swaps the player Car's model, size (collision `circles`), handling (`DRIVE`) and weight (`MASS`); the taxi stays
  parked (`garage.home`, `homeBody`), borrowed vehicles left behind go to `traffic.left`; ejected drivers become
  peds driven by combat.js; `police.offence('theft')`. Collisions: car.js asks `world.bodyAt()` (traffic.js) and
  exchanges momentum by mass; `traffic.shove()` slides/spins vehicles (`knock`/`recover` for driven cars, parked →
  `left` with `movedKeys`, two-wheelers `roll` over, `onRiderDown`); `combat.carVsPeople()` knocks people down.
- `src/game/crackers.js` — firecrackers: one additive `Points` particle system (packed arrays, swap-remove),
  synthesised bangs/crackle/hiss/whistle with distance delay; types anar, chakri, ladi, bomb, rocket (shells: peony,
  ring, willow, glitter); `playerLight()` (X, Z = next type), evening ambience (`shell()` over rooftops, peds
  lighting crackers), `startle()`; `police.offence('noise')` after 10 pm.
- `src/game/stars.js` — fan meets at two fictional film stars' houses (Bandra seafront villa "Khwaab", Juhu bungalow
  "Sangam"): `place()` finds open ground beside a nearby road once tiles are loaded and builds the gate, platform and
  villa front; fans + constables are persistent people objects; the star is out by the clock (`hours`, `sunday`) or
  via `callOut()` (cheat DARSHAN); `story.playScene(lines, cam, done)` is the generic ad-hoc cutscene (letterbox,
  subtitles, Space skips; `story.busy`); first meeting gives a gift (`state.s.fanMeets`). Never real names/likeness.
- `src/game/eggs.js` — things to find: 32 golden cutting-chai glasses (`CHAI` list of famous spots; snapped to the
  nearest road once tiles load; walk or drive through; saved in `state.s.eggs.chai`) and easter eggs built lazily
  near the player (crocodile in Powai Lake, Old Woman's Shoe, talkies marquee, flamingos, wax-taxi stall = daily
  full repair, rose stall = `useRose()` ends a fight via `combat.giveRose`, tower guard); `markers()` for the map.
- `src/game/cheats.js` — developer cheat console (` key or double-tap the clock; `window.__gtb.cheat(code)`):
  PAISAHIPAISA, CHALANMAAF, MAAMUCHUTTI, PETROLBHARO, AMRUT, SHAKTIMAAN, DHOOMMACHALE, JADOO (teleport to waypoint),
  SUBAHHOGAYI, DOPEHER, RAATHOGAYI, TRAFFICJAM, DARSHAN (stars step out), CHAIPILO (chai spots on the map), DEBUGKARO (stats line); listed in the Guide
- `src/ui/menu.js` — title screen (Continue/New/Settings/Guide/Credits), illustrated loading screens (original SVG
  art, tips), Esc pause menu; settings in localStorage (`gtb.settings`: tier — `pickTier()`: saved choice, else detected —, volume, mouse sensitivity,
  invert Y, hints, spoken GPS, radio). Graphics changes reload via `gtb.resume` (sessionStorage) back into the game.
  Tests skip the title with `?quality=`, `?hour=` or `?play`.
- `src/ui/scenes.js` — the dusk illustrations (inline SVG drawn in code: Gateway at sunset, Sea Link at night, local-train street,
  Marine Drive; seeded lights): the title uses `seaLink`, the loading screen cycles `LOADING_ORDER`. `public/brand/logo.webp` — the
  BOMBAY Bawaal logo (owner's artwork, background keyed out to alpha, car and edges faded), used by title, loading, hub and the HUD
  `#brand`; `Damion` script font (`public/fonts/`, SIL OFL) for the taglines. Title: flat menu with a magenta Play, "Mumbai, India"
  pill with the real local time; loading: Pro Tip + magenta bar + percentage.
- `src/ui/hud.js` — speedometer (40-segment dial, gear letter, fuel and lamps; shrinks to a number on foot / touch);
  `src/ui/wheel.js` — weapon wheel (hold B on foot: fists, pichkari, five cracker types; virtual cursor from mouse movement,
  `view.frozen` stops the camera). Desktop HUD (UI v3/v4 in `style.css`, scoped `body:not(.touch)`): place card, time card, wallet,
  hint bar by mode (`HINTS` in main.js), vitals and hotbar as slots, task cards in `#cards`. Esc hub = Home / Map / Guide / Settings.
- `src/ui/navigator.js` — turn-by-turn: next-turn panel, chevrons on the road, spoken Hinglish prompts (speechSynthesis)
- `src/radio.js` — taxi radio (N): synthesised stations + RJ speech (traffic, AQI, fake ads, police gossip)
- `src/world/landmarks.js` — hand-built Gateway of Indiyaa, Royal Chaj Mahal Palace (generic, not the trademarked
  facade), Chhatrapati Chai Terminus, BMC HQ, Rajabhai clock tower, fitted to OSM footprints (converter `LANDMARKS`:
  outline found by name, flagged `BUILDING_FLAG.HIDDEN` = collide only, `index.landmarks` = x, z, angle, w, d)
- `src/world/interiors.js` + `interiors/` (`kit.js` room-building kit, `terminus.js`, `palace.js`, `cafe.js`, `flat.js`)
  — places to walk into: glowing street doors (E on foot), fade, rooms built on first entry 4 km west of the map and
  300 m up, drawn alone on camera layer 1; `inside`, `anchor` (a stand-in at the street door: tiles, traffic,
  police, street life, jobs, minimap and GPS get it instead of the walker — `active` in `step()`), `world`
  (`hits`/`groundHeight` for the walker), `keepCamera`, `interact()`, `blocks(code)`, `cull(list)`, `markers()`,
  `enter(id)`/`exit()` (ids terminus, palace, cafe, flat). Nothing is saved indoors. Floors are cut into 4 m cells
  (a single large quad drew over objects in SwiftShader). On foot the vehicle left behind gets `PARKED` input
  (handbrake on) so traffic cannot push it away.
- `src/world/art.js` — owner-made models (free web tools, `docs/art-requests.md`) uploaded to `public/art/models/<id>.glb`
  (committed; `scripts/art-index.mjs` in `npm run build` writes `public/art/index.json` and a light copy of each upload in
  `public/art/opt/` — meshoptimizer simplification to a triangle budget, smooth normals, 512 px JPEG texture): `ART` table by
  id — `swap` (stands in for a procedural prop kind near the player: carts for thelas, a bus shelter; the procedural
  instance is zero-scaled meanwhile, `userData.orig` keeps its matrix) or `near` (clutter around map points).
  Credits per file in `public/art/CREDITS.md`.
- `src/vehicles/vehicleArt.js` + `vehicleModels.js` — owner-uploaded vehicle models (`public/art/vehicles/<id>.glb`, CC0/CC BY):
  `scripts/art-vehicles.mjs` (called by art-index) splits each into the fleet's four parts (textures dropped → no real
  logos; colours kept as vertex colours; oriented, scaled to the real length, near ~6.5k + far ~800 triangles) →
  `art/opt/vehicles/`; at runtime `traffic.useModel(id, near, far, info)` grows the batches (`setGeometrySize`) and
  replaces a fleet type's body or adds a new type (`VEHICLE_ART`: parody name, `base` type for handling/mass, `flip`).
  Only files with a credit line in `public/art/CREDITS.md` under CC0/CC BY are used; files named as downloaded map to
  types via `FILE_TYPES`, and only files in `VERIFIED` (checked by eye: many detailed models lose panels) are used —
  `node scripts/art-index.mjs --preview` ignores the credit gate for a local look. Loaded after play starts, most
  common first, Low 12 / Medium 24 types. Traffic car materials are double-sided (single-sheet panels).
  Batch 2 (2026-11-17; the list and the eye check are in `docs/art-batch-vehicles-2.md`): `VERIFIED` has amaze, i20, sonata,
  ix35, kona, ignis, omni; `FILE_TYPES` also maps honda_city, indigo, elantra, harrier, figo (not verified: shells with
  missing panels, two cars in one file, open roofs). `flip: true` in `VEHICLE_ART` turns a model whose lamp heuristic
  guessed wrong (i20, kona, omni). Several files for one type: `art-index.mjs` scores them (proportions, paint part, triangles)
  and uses the best. `HERO` in art-vehicles.mjs gives a model a bigger budget (padmini ~16k triangles).
  `loadVehicleArt(base, traffic, started, tier, hooks)` calls `hooks[id](near)` with the near parts (hooked ids load first).
  Rare cars and generations (second eye check, 2026-11-17): fiesta1, kizashi, octavia, carnival + carnival2 (2011 generation), gvitara2,
  hilux, endeavour, innova (2013 Kijang), alto2 (2020 generation, `split: true` takes 60 % at most of the Alto's weight). Rare weights add
  up to ~0.3, about one rare car per three Dzires (weight 0.9). Rejected for shards, open shells or no glass: FJ40, Prado ×2, Land
  Cruiser, Wuling, EV6, Fortuner 2015, Innova 2005/2008/2017, Baleno, Brezza, Palio, i10 ×2, Triber, Ertiga ×2, S-Presso ×2, Swift,
  Dzire 2012/2014, Punch ×2, Tiago, Grand Vitara Mk2, TUV300, Contessa, Ace stall. art-vehicles.mjs falls back to Sparse + Prune
  simplification when a model has 100k+ loose triangles (the Innova had 91k trim triangles left).
  **The kaali-peeli taxi** (`public/art/vehicles/padmini.glb`, Sunny khude, CC BY 4.0; source FBX in
  `docs/art-sources/kaali-peeli-taxi/`): `scripts/fbx-taxi.mjs` (no Blender needed) bakes the 2048 px photo texture into vertex
  colours, welds and simplifies 555k → 60k triangles and splits it by colour (black = paint, pale panes above the beltline =
  glass, orange = lamps, the rest incl. yellow roof and chrome = trim). Replaces the traffic Padmini's close-up body, and
  `taxi.useModel(near)` (taxi.js) also swaps the player's taxi body to it (wheels are baked in, so they no longer spin or steer;
  `damage.rebind()` after the swap; police cars stay procedural).
  **Car doors:** the scanned taxi has a working driver door (right side, `DOOR` box in taxi.js): `splitBox()` clips the paint, trim and
  glass exactly at the door box, the door hangs on a hinge at its front edge (`taxi.door.set(angle)`), a dark cabin block fills the
  opening; main.js opens it (1.1 rad) when the walker is within ~3.5 m of the taxi on foot and shuts it when you get in. Other vehicles
  (batched traffic cars) have no doors.
- `src/world/models.js` — glTF/GLB → instanced meshes (metres, base on ground); `src/world/streetProps.js` — Poly Haven
  chairs/crates at thelas, trash bags, bins, utility boxes near the player; facade AC parts use the Poly Haven aircon
- `src/sim/characters.js` — real people for the player and everyone near the camera (pool 11/20/30 within 34–46 m;
  people.js draws in two phases, `beforeEnd` picks heroes): MakeHuman bodies from `public/people/` (Low preloads 8
  templates, Medium 14, High all 24, spread over men/women/children). `templateFor()` picks a template by sex, child,
  the game's kind (`info.kinds`: office, casual, worker, sari, kid, police…), interior `wear` hints and build; stable per
  person (`p._tpl`). `dress()` sets the colour slots from the person (skin, hair, shirt → top, pants → bottom, shoes,
  Holi patches), police caps/helmets on the head bone hide the scalp hair (`uHideScalp`). `choose()` maps POSE →
  clip + expression (walk/walkFormal/jog/sprint by speed with `CLIP_SPEED`, sit, crouch, talk + angry for ARGUE, jab
  frozen = guard, jab/cross/hook per swing, hit reactions on `hitT` jumps, fall when knocked down, push, throw, aim for
  POINT, wave and kick as layers). Bodies of another template are swapped when the pool is full (≤ 2 builds a frame).
  Sitting: `t.sitPelvis` measured from the sit clip. Player's `handPos` = `hand_r`. Still procedural: the far crowd,
  riders on NPC bikes, cricket batting.
- `src/people/humans.js` — `PeopleLibrary`: index, the two atlas pages (KTX2), templates (GLB with EXT_meshopt_compression,
  `setMeshoptDecoder`), `instantiate()` (SkeletonUtils clone, own material per person, shared program); `anims()`
  turns the clips into deltas from the reference rest pose (AdditiveAnimationBlendMode: every body keeps its own
  proportions), `clipsFor(t)` scales the hip track by the template's pelvis height. The material: `_part` attribute
  (slot, alpha flag, roughness, scalp flag) → `uTint[8]` × atlas detail (linear 0.5 = texture average), hard alpha
  cutout for hair with alpha forced to 1 (partial alpha leaked into the post buffer = grey hair); two-sided (a
  garment is one sheet: looking into a sleeve or hem showed straight through). `SKIN_TONES`,
  `HAIR_COLOURS`, `LOD_DIST` (near/mid/far by tier). The atlas is rebuilt with every person each run (a changed set of
  textures moves every cell).
- `src/people/motion.js` — `Motion`: AnimationMixer cross-fades (`once` clips clamp), blinking, eye gaze (eye bones,
  ±32°), head/neck look-at (also lifts the library's head-down idle), `EXPRESSIONS` eased onto the face morphs,
  talking mouth, wave and kick layers. **Layered turns are undone before the mixer runs again** (`saved`/`undo()`):
  the mixer only writes a bone when its own result changes, so a turn on a bone the clip holds still would build up;
  `play()` also undoes first so a newly bound bone never records a layered pose as its rest.
- `src/people/hair.js` — `HairSprings`: the `hair_0…` bone chain person.py adds down braids, ponytails and long hair
  (one chain; two opened a parting gap) simulated as a Verlet chain at 60 steps/s: fixed lengths, gravity, drag, a
  pull back to the animated drape (0.14), body spheres (head, neck, upper back, clavicles) fitted per person so none
  reaches where the hair rests (`fit()`; average-man spheres pushed a slim woman's hair aside). People within 18 m.
- **Main character** (the player's body, owner's choice 2026-11-17): "Indian Man In Casuals" by Pixel_Monster
  (Sketchfab ar.jethin, CC BY 4.0; source `data/people/indian_man_in_casuals.glb`). `node scripts/people/build-hero.mjs`
  → `public/people/hero/`: `blender/hero.py` removes Sketchfab's 2× wrapper (170.9 cm), renames the Mixamo-style bones to
  the game skeleton (`game_name()`: Hips→pelvis, LeftArm→upperarm_l…; extra neck/twist bones keep own names) and writes
  `hero-high.glb` (as uploaded: 57k triangles, original 1K textures — the owner asked to keep his detail), `hero-medium`
  (60 %, JPEG) and `hero-low` (35 %, 512 px); `build-anims.mjs --target=… --out=…` retargets the 42 clips onto his own
  skeleton (limb directions measured joint to joint, `bone_dir`). Runtime: `PeopleLibrary.hero(tier)` /
  `instantiateHero()` (own materials, cut-outs write alpha 1, no face morphs), `characters.js` loads him after the crowd
  and the player's body switches to him (`heroT`); `dress()` leaves him alone. Credits panel reads `hero/info.json`.
- `src/people/lineup.js` + `people.html` — the people lineup page (the main character stands at the front) (`/gtb/people.html`): every template in random
  Mumbai colours, buttons for colours, faces, moves, detail level, close-up; `window.__people.show(id, clip,
  override, view, at)` poses one person for screenshots.
- `scripts/people/` — the people build (not part of `npm run build`; outputs are committed in `public/people/`):
  `build-people.mjs` (`--setup` downloads Blender 4.2, MPFB 2.0.18 and the MakeHuman asset packs into `.people-cache/`;
  runs `blender/person.py` 4 at once, ~5 s a person, rebuilds only changed specs; then the atlas — 4096² as two
  4096×2048 KTX2 pages because the encoder takes ≤ 12 Mpix, quadtree-packed so no cell crosses the middle —, merge,
  meshopt LOD budgets per part role (skin and garment edges `LockBorder` at every level, mid/far body skin
  inset 2/4 mm except the head; very dense garments simplify into ragged hems, so prefer ones under ~5k vertices), `glbwriter.mjs`; `--only=id`, `--force`, `--png` keeps atlas.png), `population.mjs`
  (who: 24 templates with heights, MakeHuman macros incl. ancestry mix, face targets, hair, clothes [role, asset,
  {tint, slot}], kinds), `blender/person.py` (MPFB human → height search → bake modelling shape keys, keep 14 face
  morphs from the ARKit face units, delete helpers and skin under clothes, **remove skin a garment covers**
  (`delete_covered`: ray along the skin normal meets a garment within 7 cm, area shrunk one ring so cuffs/hems keep
  no gap — MakeHuman's delete groups left legs and bellies that poked through as orange "tears"), **layer top and
  bottom** (tops hang over the waistband unless the asset name says tucked: `push_over` lifts the outer garment 6 mm
  over the inner, `push_under` sinks the inner 5 mm under, then the hidden inner part is cut; directions come from
  the body under the cloth because some garments face inward; MakeHuman `z_depth` values are unreliable), eye bones,
  a hair bone chain down long hair
  (`hair_chains`: vertices below the skull and behind its centre, 3–4 bones, weights blended along the chain), export + part metadata with
  licence/author; AGPL assets are refused), `build-anims.mjs` + `blender/retarget.py` (Quaternius UAL 1/2 → MPFB game
  skeleton: limbs calibrated to the source T-pose, world-space rotation deltas per frame, hips scaled by hip height,
  loops in place; then only rotations + pelvis kept, int16, three shared key blocks — one view per sampler made the
  JSON bigger than the data). `setup.mjs`: the MakeHuman file server drops connections, downloads use parallel
  resumed byte ranges (files2 mirror as fallback). Credits: `index.json` `credits` → Credits panel (CC BY by name).
- `src/game/story.js` + `missions.js` — the mission engine and its script. Two strands: story (yellow markers,
  Mamaji) and side missions (blue, open after the first story mission); every startable mission shows a marker in
  the world and on the map (`story.markers()`), with its giver waiting there; `hours` windows. Steps: `cut`
  (letterbox, camera on the speaker, Space skips), `goto` (with `on`: vehicle/taxi/two/foot/type, `limit`,
  `radius`, `minCondition`), `pickup`/`dropoff`, `waitHour`, `cargo` (fragile: hard braking, crashes, bumps and
  slides cost %), `lend` (a vehicle of a given type parked at the kerb for the mission: `traffic.left` entry with
  `lent` + `taken`, re-lent after a reload or if towed; F prefers it over the taxi), `pickup` with `on` (passenger in any
  vehicle; shown on the bench of an auto), `visit` (several stops), `race` (checkpoints; the clock starts when you ride off), `catch` (a
  runaway penguin on foot), `task` rides/colour/crackers (`story.event('cracker', kind)`), `pay` (a fee; waits until affordable), `call`, `reward`.
  Fail → retry from the marker. Script coordinates are places: `snap()` moves markers/targets onto the nearest
  road once tiles are loaded. `story.world` gives missions access to stars, garage, crackers, police.
  `story.playScene()` runs ad-hoc cutscenes. Saved in `state.s.story` (mission + step; re-entered after a reload).
  Titles tip their hat to Hindi films with a twist — never real titles, lines, songs or characters.
- `src/ui/minimap.js` — rotating radar (land, roads, traffic, petrol pumps, GPS route); `src/ui/cityMap.js` — full map
  (Tab / tap radar; pan, zoom, tap for a waypoint; game pauses; parked-taxi marker). GPS targets have owners
  (`routeTo(x, z, label, owner)`: 'mission', 'fare', 'user'): the newest shows, clearing one brings back the previous;
  no new fares while a mission is on (`jobs.paused`). Map and GPS use `tiles/overview.bin.gz` (roads +
  simplified land, ~0.5 MB, format in `src/world/overviewFormat.js`), loaded on first use by `src/ui/mapWorker.js`,
  which builds the road graph and runs A* off the main thread (one-ways respected, no step cap), picks random taxi
  destinations (`cityMap.randomPlace`) and cuts the drawing data into 1 km chunks;
  `src/ui/phone.js` — phone (P): Maps, Chalo Driver, Bhookh (food), JhatPat (quick commerce), Dukaan (shopping to
  home), PayKaro (UPI), Messages, Camera (photo mode), Ghar (home), Settings — all parody names;
  `src/ui/bubbles.js` — speech bubbles; `src/audio.js` — ambience, horns, synthesised whistle, siren, bark, engine
  (`engineKind` car/auto/bike/big/cycle and `hornKind` peep/bell, set by `garage.shape()`),
  tyre squeal, crash, spray, musical horn; starts on first key/tap
- `src/input.js` — keyboard (Shift = run); touch is `src/ui/touch.js`; keys in main.js: H horn, E interact
  (refuel + repair menu / snack), F out/in of the taxi, Tab map, P phone, J taxi duty, N radio, Esc pause, ? key list,
  on foot 1 fists / 2 pichkari, V kick, G insult, C colour, [ ] pressure, X light a cracker, Z cracker type,
  F into the nearest vehicle (anyone's; `vehicleChoice()` decides for F and its prompt); ` cheat console; T +1 hour,
  M mute, Q twice graphics, R twice tow to the Gateway (`pressedTwice`). Touch screens (`TOUCH`) get touch hints only
- `scripts/build-tiles.mjs` — converter (`npm run tiles`, ~55 s for the shipped box 18.890,72.795 → 19.140,72.920;
  `--bbox S,W,N,E`, fixed world origin `--origin` = Mahim 19.03,72.85 so coordinates never move as the map grows;
  writes `overview.bin.gz` and `skyline.bin.gz`; ground UVs wrap every 1,872 m (`UV_PERIOD` in tileWorker.js, a common multiple of the
  ground texture sizes in materials.js); private house names are blanked): v1 steps plus streets via Clipper (`lib/clip.mjs`:
  road surface union, footpaths by class, plots, parks cut out of plots), markings/crossings/trees/lights/stalls/
  garbage/potholes/puddles (`lib/streets.mjs`), building style + colour by district (`lib/districts.mjs`, from the
  research guide), OSM trees/signals/crossings/bus stops/petrol pumps from node tags. Index has `fuel` positions.
- `scripts/lib/` — PBF reader (with optional node tags), geometry, Clipper helpers, byte writer
- `scripts/lib/infill.mjs` — buildings on empty street frontage in the dense districts (OpenStreetMap misses many
  outlines there): `DENSITY`/`GRAIN` by district name (bazaar 5–10 m fronts, low-rise 3.5–6 m with 1–3 storeys,
  town 7–14 m), built up to the footpath, a second row behind where density ≥ 0.85; never on roads, footpaths,
  mapped buildings, areas or tracks; ~71k buildings (tagged `gtb:infill`), then ordinary untagged buildings.
- `scripts/lib/walls.mjs` — the survey's walls: compound walls with pillars and gates at the back of the footpath in front
  of set-back buildings (`COMPOUND` share by district, or the profile's `compound`), white dock walls with barbed wire
  on port roads, blue corrugated hoardings or green mesh round construction sites (OSM `landuse=construction` + infill
  redevelopment plots, `SITES` in infill.mjs) with a netted concrete tower (`gtb:site`) and a tower crane. Stored as
  thin building outlines with `BUILDING_FLAG.WALL` (style = kind, height = wall height; they collide); the worker's
  `drawWall` adds copings, pillars, steel posts and wire (mesh keys `compound`, `sheet`, `netting`, `wire`).
  Compound-wall gate gaps are reported through `gates` (→ POINT.GATE: watchman, chair, leaves).
- `scripts/lib/clutter.mjs` — `streetClutter()` (after the buildings and road names in build-tiles.mjs): street-name
  boards at junction corners (one per name within 90 m, lanes need a road word), direction boards 40–50 m before
  big junctions and gantries ~110 m out on arterials (`DESTINATIONS`: real places by the direction each arm leads,
  off-map Thane/Navi Mumbai/Borivali only within 16 km), unipoles (big junction corners, highway verges, flyover
  approaches; 7.5 m clear of buildings), cables and tarps wall to wall across lanes (walls ≥ 7.5 / 5.5 m tall,
  `heightAt` from the built tiles), stall tarps, flower sellers and puja canopies (Kalbadevi, Dadar, Prabhadevi, the
  profile's `flowers`, beside temples), shrines (OSM `amenity=place_of_worship` by `religion`, at some peepal trees,
  crosses in the wadis), handcarts on bazaar footpaths. `scripts/lib/devanagari.mjs` — `toDevanagari()`: dictionary,
  name endings, letters for initials, Devanagari digits, phonetic fallback; `learnDevanagari()` learns word spellings
  from roads with `name:mr` (used first when a road has one).
- `scripts/lib/streetLibrary.mjs` — the owner's South Mumbai street library (`docs/research/street-library/`: README,
  `streets.json` 847 streets → OSM way ids and zones, `profiles.json` 25 street profiles, `buildings-notable.json`,
  `survey.json`). `normalise()` turns each profile's prose into numbers (styles, storeys, colours, shop share, netting,
  tree density + species, lamp type, kerb/median paint, parking pressure, stalls); `forWay(id, lat)` gives a road its
  profile. The converter dresses each road by it (kerb flags, trees, lamps incl. median lamps on planted boulevards)
  and each untagged building by the profile of the nearest profiled street within 35 m (storeys, style, colour,
  shops, netting); `index.json` carries `profiles` (runtime table: parking, taxis, stalls, handcarts, `awn`), used by
  `traffic.setStreetProfiles()` for kerb parking and by clutter.js for awnings. Also `cables`, `tarps`, `handcarts`,
  `flowers` for lib/clutter.mjs. Streets outside the library keep the district rules (`lib/districts.mjs`, which also has the library's five
  new districts: Bhendi Bazaar, Nagpada, Dongri–Mandvi, Mumbai Central, Reay Road).
- `scripts/preview-tiles.mjs` — debug top-down SVG of all tiles (`npm run tiles:preview`)
- Caching after a deploy: map files carry `?v=index.generated` (`tiles.fileUrl()`; `tiles.fileTag` is the tag,
  `tiles.version` is the load counter), media `?v=manifest.shipped.version` (`lib.url()` + a DefaultLoadingManager URL
  modifier); both indexes are fetched `no-cache`. `public/sw.js` + `src/serviceWorker.js`: cache-first for versioned
  `media/` and `tiles/`, page loads `no-cache`, built game only, `?nosw` unregisters. A tile that fails to load is
  retried at 5/10/20 s and is a wall meanwhile. `art/index.json` is fetched `no-cache` and owner models load as `<file>?v=<content hash>`.
- Shaders: `textures.js` fills map slots with 1×1 stand-ins so programs compile once; use `post.compile(obj, camera,
  scene)` (composer-target variant), not `renderer.compileAsync`; `models.js setPrecompile` for models loaded in play.
- `public/tiles/`, `public/media/`, `public/basis/` — generated, not committed (`npm run build` makes tiles; deploy copies
  media from the `assets` branch, locally `npm run assets:pull`; Vite plugin copies the Basis transcoder)
- `src/credits.js` — in-game Credits panel
- `docs/knowledge/` — reference used only for building/improving the game (README lists files; e.g. how Rockstar's GTA
  series progressed)
- `docs/research/` — Mumbai street guide, live check, 130 free assets (`assets.json`/`assets.md`); metro and monorail A to Z
  and local trains and stations A to Z (`metro/reports/`, notes in `metro/research_notes/`; stations and tracks in
  game coordinates in `metro/osm-metro.json` and `metro/osm-stations.json` from `scripts/research/*-from-osm.mjs`)
- `scripts/assets/build-assets.mjs` + `.github/workflows/assets.yml` — asset pipeline → `assets` branch (see Status)
- `data/raw/mumbai-region.osm.pbf` — OpenStreetMap extract from extract.bbbike.org, 2026-11-13, ~34 megabytes.
  Bounding box 72.598,18.520 → 73.533,19.500 (Vasai-Virar to Alibag, coast to Lonavala).
  Contains ~277k building outlines (~28k with height or building:levels), ~161k road ways, ~4.5k railway ways.
  Raw input only — never ship it to the browser.

## Status
- Done: starter scene, auto-deploy workflow, raw Mumbai map data.
- Done (2026-11-13): **map converter + tile streaming**, first for South Mumbai (18.890,72.795 → 18.975,72.860).
  ~8,500 buildings (height → `building:levels` × 3.2 m → guess by type and footprint; courtyards and
  `building:part` supported), roads with widths by class/lanes (tunnels skipped, flyovers flat for now), coastline → land
  with sea walls, inland water as holes, parks/maidans/beaches/pitches, railways (broad gauge) — 163 tiles, 0.35 MB total,
  whole site ~1.4 MB. Game streams tiles in a Web Worker, collides with buildings/sea/map edge, shows the road name,
  OpenStreetMap credit on screen, spawns on P J Ramchandani Marg by the Gateway of India.
  Look: facade texture with windows/AC units/sunshades, rooftop water tanks, blue-tarpaulin roofs, marked roads,
  hazy late-afternoon sky with reflections. Known gaps: landmarks are plain blocks (Gateway has windows),
  ~1% of narrow Colaba lanes are blocked by building outlines that overlap the street, flyovers are flat,
  map beyond the box is open sea.
- Done (2026-11-13): research in `docs/research/`, asset pipeline + `assets` branch, in-game Credits panel.
  Live check by the owner's browser: 60 fps, no console errors.
- Done (2026-11-13, "go all out" realism pass): real HDRI sky and lighting, ambient occlusion and bloom, quality tiers;
  merged streets with raised paver footpaths, black-yellow kerbs, medians, lane markings, zebra crossings; district
  building styles with the facade shader and shop signs; ~15,700 trees, ~3,000 street lights, signals, bus stops, thelas,
  garbage, potholes, puddles, petrol pumps, tetrapods; kaali-peeli taxi; 24-hour clock with moving sun and night lights;
  AQI haze; left-hand traffic with rush hours; minimap; fuel and condition; city sound. First load ≈ 34 MB on High,
  ≈ 10 MB on Medium/Low. ~300 draw calls, ~570k triangles at the spawn on High.
- Done (2026-11-13, systems pass): 3D facade parts near the player; road quality by class (smooth main roads, worn
  tertiary, rough lanes with bumps and more potholes); working signals, traffic police, challan stars and patrol
  chases; street life and scenarios; full-screen map with GPS; traffic by hour; phone with parody apps, saved state,
  hunger/energy, Powai home address; taxi fare side job; delivery riders; on foot with the Holi pichkari; new traffic
  fleet with bikes; tyre marks, engine/squeal/crash sounds; taxi damage; solid street props with simple physics.
  ~350 draw calls, ~1M triangles on High; simulation ≈1.3 ms per step.
- Done (2026-11-13, playtest pass): title/loading/pause screens, Low default, resume after quality change, money floor
  (purchases need money; fines can cause debt), priced repair menu, no wear on straights, faster taxi, small bonnet smoke,
  camera-occluding people hidden, one name per road (converter merges variants), comfort reasons, brighter nights and
  headlights, hint line auto-hide; denser traffic (squeeze past, honking) and crowds; turn-by-turn with Hinglish speech;
  tier load radius and shadow throttling; landmarks; Poly Haven props; radio; Bhookh delivery job; wardrobe; hawaldar
  pay/argue/run; baraat and cricket-window events. Asset pipeline: Blender on Ubuntu needs `python3-numpy`;
  `_convert.log` next to each pack on the `assets` branch shows conversion results.
- Done (2026-11-13, night): easter eggs and chai glasses; autos (suburbs only), tankers, garbage trucks, ambulances,
  school buses, bicycles; auto duty; 22 missions (lent vehicles, fees); rooftop hoardings; far skyline; trousers,
  shoes and saris; engine voices; pigeons and kites; four interiors. Fix: traffic was invisible in the suburbs.
- Done (2026-11-13, evening — details and status per item in `docs/plan.md`): five reviews + plan; Indian traffic
  fleet (lofted bodies, BatchedMesh, LOD) and parked vehicles; driving physics (slide along walls, grip, handbrake,
  momentum exchange by mass, people knocked down); take and drive any vehicle; cheats; faster loading (prefetch, gated
  textures, deferred extras, compileAsync); full save (taxi, clock, challans, orders) and paid tow; Neutral tone
  mapping and night lighting; recessed windows; kerb paint only on main roads; real characters for everyone nearby
  (one draw call each, feet/run fixed); fist-fight combos/block/knockouts; firecrackers; the map from Colaba to
  Bandra, Juhu, Andheri, Kurla and Powai with an overview file and GPS in a worker. 979 tiles, 9.2 MB; site ~191 MB.
- Next (owner's goal: "GTA V Mumbai edition, maximised for a browser"; the live list with status is `docs/plan.md`):
  1. **Flyovers and bridges** (3.3): Sea Link, Coastal Road, JJ, Kemps Corner — all roads are flat today.
  2. **Monsoon and festivals** (4.5, 4.6): rain, wet roads, waterlogging; Ganesh visarjan, Navratri, Diwali lanterns.
  3. **Street realism from the survey** (`docs/research/street-library/`; profiles, kerbs, lamps, trees, netting
     and parking are in): planted medians, Fort arcades, construction hoardings, notable buildings, profile-driven
     stalls/crowds/sounds; owner-made models (`docs/art-requests.md`, `public/art/`).
  4. **People**: Indian clothes beyond saris, more character models, the far crowd.
  5. **More missions and side jobs** (`docs/research/mumbai-guide-2.md` §3), police chase challenges, races.

## Testing in the session
- `npm run build` must pass: converter (skips when the `"inputs"` hash in `index.json` is unchanged; `--force` rebuilds)
  → `scripts/art-index.mjs` → vite build → `scripts/ship-media.mjs` (keeps only the media ids named in `src`/`index.html`,
  warns about ids built at run time, slims the Poly Haven props to 600–2,400 triangles with 512 px textures, writes
  `manifest.shipped.version`). Site about 80 MB.
- Allocation per step: the browser's sampling heap profiler (`HeapProfiler.startSampling` with
  `includeObjectsCollectedByMajorGC`/`MinorGC` true) through Playwright's CDP session.
- `npm test` (= `node tests/smoke.mjs`, after a build; `--only=boot,drive,traffic,steal,missions,trains,ride,stations,metro,night,touch,clutter,people`,
  `--quality=medium`) plays the built game headless and fails on console errors, stutter (worst step > 60 ms),
  wrong-side traffic, a broken carjack, any mission that cannot be finished, trains that do not run, a too-dark night,
  missing street clutter (boards with text, cables, awnings, solid poles, a handcart that can be pulled), or people
  that don't load, place or move, or a player who isn't the main character (and the lineup page). In GitHub Actions
  `deploy.yml` runs build → smoke (on the Pages artifact) → deploy, so a failing check stops the deploy (Playwright
  1.63.0 is a devDependency). Add a check there for every new system. `touch` plays a landscape phone (844×390,
  real touch events through the Chrome DevTools Protocol): steering slide, two thumbs, pedals, door, joystick, context
  button, and fails if any two visible buttons overlap or leave the screen. Without the `assets` branch in
  `public/media` (`npm run assets:pull`) every check fails on 404s for media.
- Visual check: `npx vite preview --port 4173`, then headless Chrome via Playwright with
  `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`, open `http://localhost:4173/gtb/`,
  hold keys, take a screenshot, and check console errors. Headless frame rate is very low, so for driving tests call
  `window.__gtb.player.update(0.05, input, window.__gtb.tiles)` in a loop instead of holding keys in real time.
- `npx vite preview` serves `.bin.gz` with `Content-Encoding: gzip` (browser unzips); GitHub Pages serves it as
  `application/gzip` (the worker unzips with DecompressionStream). Test the second path with
  `python3 -m http.server` serving a folder that contains `dist` as `gtb`.
- The session sandbox usually cannot reach map servers (Overpass, Geofabrik) or asset sites (Poly Haven, ambientCG,
  Kenney, OpenGameArt, Sketchfab, Freesound); do downloads in a GitHub Action. It can reach npm, GitHub,
  raw.githubusercontent.com (Google Fonts files), Copernicus elevation (S3) and Google Open Buildings (Cloud Storage).
  It cannot open the live github.io site; ask the owner's Claude in Chrome for live checks.
- Headless driving/visual tests: call `window.__gtb.step(0.05)` in a loop (simulation without rendering), set
  `window.__gtb.input.fwd = true` etc., then `window.__gtb.post.render()` before a screenshot. `?hour=` sets the time.
  `window.__gtb` also exposes signals, police, street, people, animals, cityMap, state, jobs, phone, walker, pichkari,
  skids, damage, propPhysics and `toggleFoot()`. Load tiles with `await tiles.whenReady(x, z, r)` before `roadAt`.
- Asset pipeline test without network: point a small list at `file://` URLs
  (`node scripts/assets/build-assets.mjs --list my-list.json --out /tmp/x --cache /tmp/c`).

## Git
- Work on `main` for small changes unless the owner asks for pull requests.
- Commit author: `Amit Patharkar <amitpatharkar@users.noreply.github.com>`.
