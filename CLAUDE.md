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
- `src/credits.js` — in-game Credits panel (OpenStreetMap, code libraries, every shipped asset from `media/manifest.json`)
- `docs/research/` — research done in the owner's browser by Claude in Chrome: `mumbai-guide.md`, `live-check.md`,
  `assets.json` (130 free assets with licence, author, attribution, download URLs; flags `login_required`,
  `fallback`, `heavy`) and `assets.md` (same, readable, plus Credits). Only CC0, CC-BY and Open Font License.
- `scripts/assets/build-assets.mjs` — asset pipeline (`npm run assets`): downloads what `assets.json` lists,
  textures → KTX2 at 1024 px (`color.ktx2` sRGB, `normal.ktx2` OpenGL-style, `orm.ktx2` = red occlusion /
  green roughness / blue metalness), sky HDRIs → 1K `.hdr`, sounds → `.ogg`, fonts → `.ttf` + licence;
  writes `manifest.json` (files, licence, attribution, real-world size in metres for Poly Haven textures) and `CREDITS.md`.
  Encoding uses `ktx2-encoder` (WebAssembly Basis Universal) in worker threads. Skips login-only, fallback and heavy
  entries; models (trees, vehicles, props, characters) are stage 2.
- `.github/workflows/assets.yml` — runs the pipeline in GitHub Actions when `assets.json` or the scripts change
  (or by hand), force-pushes the result to the **`assets` branch** (one commit, replaced each time), then redeploys.
  The session sandbox cannot reach most asset sites, so downloads happen there.
- `public/media/` — built assets, not committed; the deploy copies the `assets` branch here;
  locally run `npm run assets:pull`. (Not `public/assets/`: Vite uses `dist/assets/` for its own code.)
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
- Next (in order):
  1. **Real materials and lighting:** use `media/` textures (KTX2Loader + Basis transcoder) for walls by district style,
     roads, footpaths, sand, grass; HDRI sky for lighting/reflections; ambient occlusion, bloom, colour grading;
     less repetitive sea.
  2. **Realism fixes from the live check:** spawn in a kaali-peeli taxi (autos are banned south of Bandra/Sion);
     raised footpaths with black-yellow kerbs (block driving onto the promenade); coconut palms on the seafront.
  3. **Pipeline stage 2 (models):** optimise glTF/FBX models with glTF Transform (meshopt + KTX2); login-only
     Sketchfab models need a free API token saved as the GitHub secret `SKETCHFAB_API_TOKEN`; bake the heavy
     gulmohar/peepal trees into tree cards.
  4. **District architecture kit**, then **landmarks** (altered names), **bigger map** (whole island), heights from
     Google Open Buildings 2.5D and hills from Copernicus elevation (both reachable from the sandbox).
  5. **Far level of detail** and **camera** kept out of buildings.
  6. **Playable character**: free rigged character (Quaternius or Mixamo) with idle/walk/run/jump,
     third-person controls, press E to enter/exit the auto-rickshaw.
  7. Traffic cars, pedestrians, then the first timed mission (for example a dabba delivery).
  8. Mumbai flavour: BEST buses, local trains, hawkers, fake-brand hoardings, radio.

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
- Asset pipeline test without network: point a small list at `file://` URLs
  (`node scripts/assets/build-assets.mjs --list my-list.json --out /tmp/x --cache /tmp/c`).

## Git
- Work on `main` for small changes unless the owner asks for pull requests.
- Commit author: `Amit Patharkar <amitpatharkar@users.noreply.github.com>`.
