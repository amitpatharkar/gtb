# Rendering, realism and loading audit (2026-11-13)

No source files were changed by this audit.

**How I measured:** `npm run build` passes. I loaded the game in headless Chrome at 1280×720, three tiers, and took street-level shots at 7 places (Gateway, Marine Drive, Fort, Kalbadevi, Girgaon, Nariman Point, Colaba) at 11:00 and 20:30. There were no console errors.

| | Low | Medium | High |
|---|---|---|---|
| Downloaded before play | 20.2 MB, 92 requests | 40 MB, 130 requests | 71.7 MB, 166 requests |
| Shader programs | 57 | 66–77 | 78–83 |

- **High is over the 50 MB budget.** CLAUDE.md says about 34 MB.
- **Draw calls and triangles on Medium:** 340–470 calls and 1.1–4.3M triangles per frame, shadow pass included.
- **Girgaon breakdown:** the facade air-conditioner (AC) model alone is **1.21M of 2.78M visible triangles** (9,435 triangles × 128 copies, and it also casts shadows).
- **Load time on Low with a 20 Mbps throttle:** 14.5 s to playable. Only about 2 MB of that is actually needed to start.

## 1. What most limits "believable Mumbai at street level"
1. **The strip between road and building.** There are no compound walls or gates. Big bare "plot" concrete runs straight from the kerb to the buildings (Kalbadevi, Colaba, Nariman shots).
   - Black-and-yellow kerb paint goes on every road edge, including driveways (`src/world/mesh/ground.js:47-62`). It looks like a toy racetrack.
   - `roadPoor` reads as brown mud (`src/world/materials.js:84`).
   - No parked cars or two-wheelers anywhere.
2. **Building shapes.** Every building is a footprint pushed straight up, with one window grid per style (`src/world/facadeRules.js:9-13`) and identical white frames.
   - Missing: Art Deco curved corners, "eyebrow" sunshades and stepped crowns; Gothic gables and turrets outside the 5 landmarks; chawl galleries.
   - Only 1,018 of 8,469 buildings have a real height, so the skyline is uniform.
   - **Low, the default tier, has `partsRadius: 0`**, so facades are completely flat there.
3. **Ground-floor shops.** The fake rooms behind windows (interior mapping) already exist. But shop goods are a random saturated colour per 0.22 × 0.48 m cell (`src/world/facade.js:82`), which reads as a mosaic.
   - At night, tube lights (values 3–4, `facade.js:62,91`), street-lamp lights (intensity 90) and exposure 1.45 clip to white. A closed blue shutter turns white.
4. **Missing street clutter** from the guide's "five things": cable bundles, rooftop hoardings, awnings, blue street-name signs, drain pipes, stains.
5. **Lighting.** Shade is dark and muddy: I sampled shaded walls at RGB about 85–95, and 59,52,32 at Kalbadevi.
   - Causes: brown sky-light ground colour 0x6b5d4a (`src/world/environment.js:48`), sun 3.2 against sky 1.0, ACES tone mapping at exposure 0.62.
   - One HDRI serves every hour (`environment.js:9`) although 8 are downloaded. The night sky is just the day sky dimmed.
6. **The taxi is always in the middle of the frame**, and its black paint has env reflection 0.22 (`src/vehicles/taxi.js:77`). From behind it looks like a flat black box with no tail lamps.
7. **The camera ends up inside lamp posts and trees** in 2 of 7 shots. The camera only checks buildings (`src/main.js:252`).
8. **Nothing exists beyond 520–800 m**, so the Marine Drive and Back Bay view has no far skyline.

Already good: the sea, main-road asphalt, paver footpaths, haze, interior mapping.

## 2. What limits loading
- **Everything waits in a line, starting late.**
  - Nothing is fetched until the title-screen click (`main.js:58`).
  - Then `manifest.json` (121 KB), then 46–69 compressed textures (KTX2) and 4 TTF fonts (1.57 MB, `main.js:87`) all start together.
  - The sky image (HDR, 1.1 MB) is awaited (`main.js:92`, `environment.js:19`) while it competes with those textures.
  - Map tiles are only requested at `whenReady` (`main.js:273`).
- **3D models use 1k JPG textures, not KTX2.**
  - The AC model fetches **12 JPGs (7.4 MB)** to use mesh node 0 only (`main.js:98`).
  - Chair, crate and trash bag: 5.4 MB on Low. Characters: 3 MB on Low.
  - Model totals: 8.4 / 28 / 34 MB on Low / Medium / High.
- **Normal maps** are encoded as high-quality UASTC (`rdoQualityLevel: 1`, `scripts/assets/encode-worker.mjs:18`) at about 1.2 MB each. That is 26 of them on High, about 25 MB.
- **Shaders compile late and twice.** Nothing is compiled ahead of time. Materials start as flat colour and recompile when their textures arrive (`src/world/textures.js:77`), including the heavy facade shader. That means stalls during play on slow networks or on Windows.
- **Audio:** 6.8 MB of OGG is fetched and decoded on the first key press (`src/audio.js:26`).
- **Repeat visits:** there is no service worker, and GitHub Pages caches for only 10 minutes. Each deploy likely changes every file's version tag (ETag), so returning players probably re-download everything.
- **Minor:** Vite also puts a second copy of the Basis transcoder in `dist/assets` (585 KB deployed, never downloaded). It comes from KTX2Loader's default path.

## 3. Improvements ranked by realism gain per effort
Effort: S = small, M = medium, L = large.

1. **Simplify the AC and trash-bag models** (gltf-transform simplify to about 300 triangles, keep one texture set). `main.js:98`, `src/world/streetProps.js`.
   - Gain: about −1.2M triangles plus their shadow pass on Medium/High, −7 MB.
   - Effort: S.
2. **Fix the loading order.**
   - Start fetching the manifest, tile index, HDR, nearby tiles and the transcoder while the title screen is showing.
   - Use fetch priority `high` for HDR and tiles; load textures, fonts and models with `low` priority or after the loading screen ends.
   - Gain: Low time-to-play at 20 Mbps from 14.5 s to about 3–4 s (estimate). 0 MB.
   - Effort: S.
3. **Quick default-tier fixes.**
   - Kerb paint only on main roads and junctions, plain grey kerbs elsewhere (`ground.js:60`).
   - Retint `roadPoor` to grey worn asphalt with less macro noise (`materials.js:84`).
   - Raise Low's anisotropy from 2 to 8 (`src/settings.js:15`).
   - Gain: high. Cost: about 0 ms. Effort: S.
4. **Keep the camera out of props:** check propPhysics in the camera pull-in (`main.js:252`), or fade props within 1.5 m. Effort: S.
5. **Lighting and colour-grade pass.**
   - Try AgX or Neutral tone mapping (both are in r187).
   - Grey-blue sky-light ground colour, more sky fill and less sun for a hazy look.
   - Night: cap the tube-light emissive at about 1.5, lamp lights at 25–35, exposure about 1.0.
   - Cost: 0 ms. Effort: S.
6. **Window depth in the facade shader:** offset the glass about 0.2 m back, using the view ray it already computes, with shaded side walls and sill.
   - Gives depth on every tier, including Low where 3D facade parts are off.
   - Cost: about 10 extra shader operations per pixel. Effort: S–M.
7. **Compound walls, gates and parked vehicles.**
   - Build walls in the tile worker along plot edges that face roads, with gaps at service roads, plus a security cabin.
   - Place static instanced parked cars and bikes (reuse the `src/vehicles/fleet.js` meshes) along lanes and inside compounds.
   - Cost: +3–6 draw calls, about 100k triangles near the player, 0 MB. Effort: M.
8. **Model pipeline: KTX2 textures and compressed geometry (meshopt)** for every glTF in the assets workflow.
   - Gain: models from 8 / 28 / 34 MB to about 1.5 / 4 / 6 MB; GPU memory roughly a quarter.
   - Effort: S–M.
9. **Re-encode normal maps** at 512 px, or with stronger compression (RDO λ about 4), or as ETC1S normal maps.
   - Gain: High back to about 35–40 MB. Effort: S.
10. **Compile shaders before play.** Give every material 1×1 placeholder textures in all slots so its shader is final from the start. Then `await renderer.compileAsync(scene, camera)` before `loader.done()` (`main.js:278`).
    - Gain: removes texture-arrival stalls. Effort: S.
11. **Facade variety and Mumbai shapes** (`src/world/mesh/buildings.js`).
    - Per-window types: aluminium sliders, wooden louvres, box grilles, enclosed balconies. Plus per-flat paint patches, drain pipes, AC drip stains.
    - Art Deco: rounded or chamfered street corners, 0.5 m eyebrow fins (deepen the strips at `buildings.js:122`), stepped parapets.
    - Chawl galleries for the weathered style; Gothic gables for heritage stone buildings.
    - Real heights from Google Open Buildings 2.5D (reachable from the session).
    - Effort: M–L.
12. **Shop and room atlas for the windows:** pre-render rooms in Blender (kirana shop, chemist, tailor, sweet shop, flat with ceiling fan, office) as a KTX2 texture array. It replaces the hash shelves (`facade.js:73-100`).
    - Cost: about 0.5 MB, same per-pixel work. Effort: M.
13. **Clutter layer.**
    - Cable bundles as sagging ribbons between facade anchors and lamp posts (one mesh per tile).
    - Rooftop hoardings with a parody-ad atlas (about 0.5 MB KTX2), awnings and tarps over shopfronts, blue street-name signs at junctions.
    - Ground stickers (decals) for stains and broken pavers near shops.
    - Effort: M.
14. **Replace street-lamp lights with painted light pools.** Six point lights and two spotlights are evaluated in every pixel all day (`main.js:183`), on top of the facade shader. Swap them for ground light-pool decals plus a facade glow near lamps; keep the headlamps as real lights.
    - Gain: about 1–3 ms per frame on integrated GPUs (estimate). Effort: S–M.
15. **Taxi polish:** clear-coat with env reflection about 1.0 on the black paint, rear glass with the interior visible, tail lamps, chrome bumpers. Effort: S–M.
16. **Skies by time of day:** lazy-load the downloaded sunset, misty and overcast HDRIs (1.1 MB each) and crossfade. Night: a sodium-glow gradient sky.
    - Separately, ship a pre-analysed, smaller HDR (or UltraHDR via `UltraHDRLoader`). That saves 0.8 MB and 50–150 ms of main-thread work in `analyseSky` (`environment.js:126-170`).
    - Effort: M.
17. **Far skyline stand-ins (impostors):** one merged low-poly box mesh per super-tile beyond the load radius, with lit windows at night (Queen's Necklace).
    - Cost: about 0.3–0.5 MB, +10 draw calls. Effort: M.
18. **Caching and small downloads.**
    - Service worker that caches media by content hash listed in the manifest.
    - Fonts: subset to WOFF2, or bake the shop-sign atlas at build time (−1.4 MB).
    - Trim the ambience loops to mono (−5 MB of audio).
    - Lazy-load textures only when a loaded tile uses them (sand, mud, gravel, tarpaulin).
    - Effort: S each.
19. **Later:** wet roads (puddle mask controls roughness and reflections, no screen-space reflections), cheap height fog with sun in-scatter, and the monsoon set.

All gains marked "estimate" are my estimates, not measurements.
