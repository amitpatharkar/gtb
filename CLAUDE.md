# GTB — Mumbai open-world browser game

A fun, toned-down, GTA-style open-world game set in the real Mumbai, playable in any web browser.
Not a hyper-real replica: comedy and chaos over violence (for example, a "wanted level" for breaking traffic rules).

Owner: Amit Patharkar (GitHub: amitpatharkar). Working title "GTB"; name candidates include
"Gully Theft Auto" and "Bombay Bawaal" (avoid "GTA" in the final public name — Rockstar trademark).

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
  ideas in `docs/research/mumbai-guide.md`.
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
- `index.html` — page shell, heads-up display (speed, road name, clock, AQI, minimap, fuel and car meters, messages),
  loading screen, OpenStreetMap credit, Credits panel, Graphics link, touch buttons (incl. horn and fuel)
- `src/main.js` — boot order (texture library → tiles → sky → post-processing → clock, traffic, audio, minimap),
  chase camera, `step(dt)` simulation (also called by headless tests via `window.__gtb.step`), night lights near the
  player, refuelling, HUD. URL options: `?quality=high|medium|low`, `?hour=20.5`.
- `src/settings.js` — quality tiers (High: ambient occlusion, 4096 shadows, normal maps; Medium (phones): no AO,
  no normal maps; Low: no post-processing). Q key / Graphics link cycles and reloads.
- `src/render/post.js` — composer: scene (MSAA, half-float) → GTAO ambient occlusion from depth only → bloom →
  ACES tone mapping → colour grade/vignette
- `src/world/environment.js` — HDRI sky (rotated so its sun follows the clock), sun-free copy for lighting, sun +
  moon lights, haze colour/density from daylight and AQI, sea shader (3 scrolling ripple layers, no visible tiling)
- `src/world/textures.js` — `TextureLibrary` (KTX2 from `media/`, progressive: flat colour until loaded; real-world
  texture size from the manifest), `addMacroVariation()` world-space anti-tiling noise
- `src/world/materials.js` — one material per worker mesh key (asphalt, pavers, plot concrete, grass, sand, kerb
  stripes, worn paint, sea wall, parapet, roofs incl. tarpaulin/rust) + one facade material per building style
- `src/world/facade.js` — facade shader (windows/glass reflections, curtains, grilles, balconies with clothes, AC units,
  sunshades, monsoon streaks, floor bands, parapet coping, ground-floor shops with shutters and signboards, lit windows
  at night) and the shop-sign atlas (128 boards, Marathi in Devanagari over English, BMC style; fonts from `media/`).
  Per-building attributes MUST stay `flat` varyings (interpolation noise + hashing = speckle). Debug:
  `window.__gtb.facadeDebug.value = 1..4` (albedo, roughness, normal, window grid).
- `src/world/props.js` — procedural instanced props by point kind: rain tree, gulmohar (in bloom), peepal, coconut palm
  (alpha-tested leaf cards), street light, traffic signal, BEST bus shelter, pothole and puddle decals, garbage pile,
  thela with umbrella, petrol pump canopy, sea-wall tetrapods
- `src/world/tiles.js` — `TileManager`: streams tiles, builds meshes/props, collisions (`hits`), `walkable`,
  `groundHeight` (asphalt 0.02 m, kerb level 0.2 m), `roadAt`, `roadNameAt`, `segment()`; `version` bumps on load/unload
- `src/world/tileWorker.js` + `src/world/mesh/` — worker: `ground.js` (ground layers, kerbs with paint strip, sea walls,
  parapet, tetrapods, markings, footways, rails), `buildings.js` (per-style walls with facade data, parapets, stair
  rooms, roof types, water tanks), `builder.js` (mesh helpers). Road segments: 6 floats `x0 z0 x1 z1 halfWidth flags`
  (flags 1 vehicle, 2 one-way, 4 main road).
- `src/world/tileFormat.js` — binary tile format v2 (buildings with style/levels/street-facing walls, areas incl.
  PLOT/ROAD/FOOTPATH, roads, rails, markings, points); `src/world/levels.js` — ground heights
- `src/vehicles/taxi.js` + `car.js` — procedural kaali-peeli taxi (Premier Padmini proportions, clear-coat paint) and car
  handling (bicycle steering, two collision circles, kerb bumps, body roll/pitch, fuel ~40 km per tank, condition)
- `src/sim/clock.js` — 24-hour clock (1 real s = 1 game min, T = +1 h), real sun path for Mumbai in December,
  daylight/night/twilight, AQI by hour (CPCB scale), traffic density by hour (rush 8–11, 17–21)
- `src/sim/traffic.js` — ambient traffic near the player (taxis, hatchbacks, sedans, BEST buses on main roads, tempos),
  keeps LEFT, follows the road graph across tiles, respects one-ways, slows for cars and the player, honks
- `src/ui/minimap.js` — rotating radar (land, roads, traffic, petrol pumps); `src/audio.js` — Web Audio ambience
  (traffic, street, waves near the sea, crows by day), horns; starts on first key/tap
- `src/rickshaw.js` — old auto-rickshaw (unused in South Mumbai; keep for the suburbs, where autos are allowed)
- `src/input.js` — keyboard and touch; extra keys handled in main.js: H horn, F refuel, T +1 hour, M mute, Q graphics
- `scripts/build-tiles.mjs` — converter (`npm run tiles`, ~7 s): v1 steps plus streets via Clipper (`lib/clip.mjs`:
  road surface union, footpaths by class, plots, parks cut out of plots), markings/crossings/trees/lights/stalls/
  garbage/potholes/puddles (`lib/streets.mjs`), building style + colour by district (`lib/districts.mjs`, from the
  research guide), OSM trees/signals/crossings/bus stops/petrol pumps from node tags. Index has `fuel` positions.
- `scripts/lib/` — PBF reader (with optional node tags), geometry, Clipper helpers, byte writer
- `scripts/preview-tiles.mjs` — debug top-down SVG of all tiles (`npm run tiles:preview`)
- `public/tiles/`, `public/media/`, `public/basis/` — generated, not committed (`npm run build` makes tiles; deploy copies
  media from the `assets` branch, locally `npm run assets:pull`; Vite plugin copies the Basis transcoder)
- `src/credits.js` — in-game Credits panel
- `docs/research/` — Mumbai street guide, live check, 130 free assets (`assets.json`/`assets.md`)
- `scripts/assets/build-assets.mjs` + `.github/workflows/assets.yml` — asset pipeline → `assets` branch (see Status)
- `data/raw/mumbai-region.osm.pbf` — OpenStreetMap extract from extract.bbbike.org, 2026-11-13, ~34 megabytes.
  Bounding box 72.598,18.520 → 73.533,19.500 (Vasai-Virar to Alibag, coast to Lonavala).
  Contains ~277k building outlines (~28k with height or building:levels), ~161k road ways, ~4.5k railway ways.
  Raw input only — never ship it to the browser.

## Status
- Done: starter scene, auto-deploy workflow, raw Mumbai map data.
- Done (2026-11-13): **map converter + tile streaming** for South Mumbai (18.890,72.795 → 18.975,72.860).
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
- Next (in order) — the owner's wishlist, grouped into systems:
  1. **On foot**: playable character (Quaternius rigged characters + animation library are in `assets.json`, need
     pipeline stage 2), E to enter/exit the taxi, health, tiredness/stamina (AQI lowers it), hunger and food from stalls/
     cafés (vada pav, chai), clothes (swap outfits), money (₹, taxi fares as income).
  2. **Pedestrians** (staged near the player, district mixes) and **scenarios** (chai tapri, cricket on maidans, hawkers).
  3. **Police**: traffic police "challan" stars for traffic offences (red lights, wrong way, footpath driving), Mumbai
     Police cars (parody livery), line-of-sight escape.
  4. **Comedy items**: tomatoes to throw, pichkari (Holi water gun) — needs character + simple physics.
  5. **Flyovers**: converter keeps bridge/layer roads separate, raised decks with ramps and piers (JJ, Kemps Corner).
  6. **Traffic depth**: signals cycling, junction yielding, autos/2-wheelers in the suburbs, honking AI.
  7. **Car upkeep**: maintenance at garages, tyre punctures from potholes, CNG vs petrol.
  8. **Weather**: monsoon rain (wet roads, puddles grow, waterlogging), more sky HDRIs per time of day.
  9. Pipeline stage 2 (models via glTF Transform, Sketchfab token), far level of detail, landmarks (altered names),
     bigger map (whole island), heights from Google Open Buildings 2.5D, hills from Copernicus elevation.

## Testing in the session
- `npm run build` must pass (it runs the converter first).
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
- Asset pipeline test without network: point a small list at `file://` URLs
  (`node scripts/assets/build-assets.mjs --list my-list.json --out /tmp/x --cache /tmp/c`).

## Git
- Work on `main` for small changes unless the owner asks for pull requests.
- Commit author: `Amit Patharkar <amitpatharkar@users.noreply.github.com>`.
