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
- **Graphics goal:** clearly better than GTA Vice City — physically based materials, real-time shadows,
  tone mapping, good lighting; stylised, not photorealistic.
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
- **Open decision — map compression:** the map is real scale (1 metre = 1 metre). South Mumbai is ~64 square kilometres,
  about half of GTA V's world, and a full north–south drive takes ~9 minutes. Consider compressing later (needs remixing,
  not a plain scale-down, or buildings and roads stop fitting the vehicles).

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
- `index.html` — page shell, heads-up display (speed, current road name), loading screen, OpenStreetMap credit, touch buttons
- `src/main.js` — renderer, chase camera, game loop, reset (R) with fade
- `src/world/environment.js` — gradient sky + environment map for reflections, sun with shadows, fog, sea plane
- `src/world/tiles.js` — `TileManager`: streams tiles (load within 700 m, unload past 950 m, props hidden past 300 m),
  builds meshes, answers collisions (`hits`: buildings, sea, map edge; roads and piers count as drivable over water)
- `src/world/tileWorker.js` — Web Worker: fetch + unzip + decode a tile, extrude buildings, triangulate ground,
  build road/rail ribbons and sea walls, pack collision grids
- `src/world/tileFormat.js` — binary tile format (shared by converter and worker)
- `src/world/materials.js` — procedural canvas textures (facades with windows, road markings, ballast) and materials
- `src/rickshaw.js` — placeholder auto-rickshaw made of primitives + arcade driving physics (circle vs world collisions)
- `src/input.js` — keyboard (W A S D / arrows, Space brake, R reset) and on-screen touch controls
- `scripts/build-tiles.mjs` — map converter (`npm run tiles`): reads the `.osm.pbf`, clips to a bounding box, projects to
  metres (x = east, z = south, origin = box centre), writes `public/tiles/<tx>_<tz>.bin.gz` + `index.json`.
  Options: `--bbox south,west,north,east --name "..." --spawn lat,lon`. Takes ~3 seconds for South Mumbai.
- `scripts/lib/` — own OpenStreetMap PBF reader, geometry helpers (ring merging, coastline → land polygons), byte writer
- `scripts/preview-tiles.mjs` — debug: draws all tiles as one top-down SVG (`npm run tiles:preview`)
- `public/tiles/` — generated, not committed (in `.gitignore`); `npm run build` regenerates it, so the deploy does too
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
- Next (in order):
  1. **Far level of detail:** merged low-detail meshes for tiles beyond the detail radius, so the view can reach further.
  2. **Camera polish:** keep the chase camera out of buildings.
  3. **Playable character**: free rigged character (Quaternius or Mixamo) with idle/walk/run/jump,
     third-person controls, press E to enter/exit the auto-rickshaw.
  4. Traffic cars, pedestrians, then the first timed mission (for example a dabba delivery).
  5. Landmark models (Gateway of India, CST, Sea Link) and Mumbai flavour (kaali-peeli taxis, BEST buses, local trains).

## Testing in the session
- `npm run build` must pass (it runs the converter first).
- Visual check: `npx vite preview --port 4173`, then headless Chrome via Playwright with
  `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`, open `http://localhost:4173/gtb/`,
  hold keys, take a screenshot, and check console errors. Headless frame rate is very low, so for driving tests call
  `window.__gtb.player.update(0.05, input, window.__gtb.tiles)` in a loop instead of holding keys in real time.
- `npx vite preview` serves `.bin.gz` with `Content-Encoding: gzip` (browser unzips); GitHub Pages serves it as
  `application/gzip` (the worker unzips with DecompressionStream). Test the second path with
  `python3 -m http.server` serving a folder that contains `dist` as `gtb`.
- The session sandbox usually cannot reach map servers (Overpass, Geofabrik); do data downloads in a GitHub Action if needed.

## Git
- Work on `main` for small changes unless the owner asks for pull requests.
- Commit author: `Amit Patharkar <amitpatharkar@users.noreply.github.com>`.
