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
- `index.html` — page shell, heads-up display, touch buttons
- `src/main.js` — renderer, lights, chase camera, game loop
- `src/world.js` — current placeholder city: grid of blocks, roads, sea front (to be replaced by real Mumbai)
- `src/rickshaw.js` — placeholder auto-rickshaw made of primitives + arcade driving physics and box collisions
- `src/input.js` — keyboard (W A S D / arrows, Space brake) and on-screen touch controls
- `data/raw/mumbai-region.osm.pbf` — OpenStreetMap extract from extract.bbbike.org, 2026-11-13, ~34 megabytes.
  Bounding box 72.598,18.520 → 73.533,19.500 (Vasai-Virar to Alibag, coast to Lonavala).
  Contains ~277k building outlines (~28k with height or building:levels), ~161k road ways, ~4.5k railway ways.
  Raw input only — never ship it to the browser.

## Status
- Done: starter scene with drivable auto-rickshaw, chase camera, shadows, touch controls, auto-deploy workflow,
  raw Mumbai map data committed.
- Next (in order):
  1. **Map converter** (Node script, run in a GitHub Action or locally in the session): read the `.osm.pbf`,
     clip to Mumbai city (start with South Mumbai: Colaba, Gateway of India, CST, Marine Drive, Churchgate —
     roughly 18.890,72.795 → 18.975,72.860), project to local metres, extrude buildings
     (use `height`, else `building:levels` × 3.2 m, else a sensible guess by building type/area),
     build road meshes with widths by `highway` class, coastline/sea, parks/maidans, railway lines.
     Output compressed tiles (~500 m each) to `public/tiles/` plus an index file.
  2. **Tile streaming** in the game: load/unload tiles around the player; collisions from building footprints.
  3. **Playable character**: free rigged character (Quaternius or Mixamo) with idle/walk/run/jump,
     third-person controls, press E to enter/exit the auto-rickshaw.
  4. Traffic cars, pedestrians, then the first timed mission (for example a dabba delivery).
  5. Landmark models (Gateway of India, CST, Sea Link) and Mumbai flavour (kaali-peeli taxis, BEST buses, local trains).

## Testing in the session
- `npm run build` must pass.
- Visual check: `npx vite preview --port 4173`, then headless Chrome via Playwright with
  `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`, open `http://localhost:4173/gtb/`,
  hold keys, take a screenshot, and check console errors.
- The session sandbox usually cannot reach map servers (Overpass, Geofabrik); do data downloads in a GitHub Action if needed.

## Git
- Work on `main` for small changes unless the owner asks for pull requests.
- Commit author: `Amit Patharkar <amitpatharkar@users.noreply.github.com>`.
