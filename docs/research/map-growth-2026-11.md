# Growing the map beyond South Mumbai (2026-11-13)

> Overview images (`overview-c.png` 1.15 MB, `bandra-c.png` 0.75 MB, `powai-c.png` 0.60 MB) were not copied into the
> repository because each is over 400 KB. The scratchpad paths below are from the session that wrote this report.

## GTB map growth: what the converter can do now and what must change first

I made no changes to the repository. All runs used a copy at `/tmp/claude-0/-home-user-gtb/a35c443e-baab-5d05-9fcc-621620fdf811/scratchpad/mapx/gtb`, with `node_modules` linked rather than copied. Note: `git status` now shows edits to `src/main.js`, `src/sim/traffic.js` and `src/vehicles/fleet.js`, plus a new `src/vehicles/loft.js`. Those are not mine; another session is editing the repository at the same time.

### 1. Bounding box, origin, tile grid and precision
- **Where they are set:**
  - Bounding box: `scripts/build-tiles.mjs:38` (`--bbox S,W,N,E`). There is no code limit on its size.
  - Margin of 0.01° read around the box: `:39`. Tile size of 500 m: `:40`. Spawn point: `:41`.
  - **The origin is the centre of the box** (`:50`). The projection is a simple flat (equirectangular) one, with metres per degree taken at the box centre (`:52-54`). The box in metres is set at `:60`; the tile grid is `floor(x/500)` from the origin (`:387`). The origin is written to `index.json` (`:897`).
  - Only one box is supported; there is no way to join several boxes.
- **Changing the box moves the origin.** Every world coordinate and tile number changes with it.
  - The client copes: `story.js:9`, `jobs.js:99` and `cityMap.js:317` convert latitude/longitude through `index.origin`, and the sea plane is sized from `bounds` (`environment.js:67`).
  - The only raw x/z kept is the quality-change resume in sessionStorage (`main.js:175`). After a deploy that can cause one wrong respawn.
  - The current origin is 18.9325, 72.8275 (near Churchgate), not the Gateway.
  - **Recommendation:** add an `--origin` option and fix it centrally, for example Mahim at 19.03, 72.85, so the map can keep growing without coordinates moving.
- **Flat projection error:** under 0.1 % across 28 km, so the 1:1 scale holds.
- **Float precision at 25 km:** a single-precision (float32) number steps in 1 mm at 8–16 km and 2 mm at 16–32 km.
  - Tile data is relative to each tile's centre, tile groups sit at that centre (`tiles.js:98`), and Three.js builds the camera transforms in double precision. Geometry and the camera therefore do not jitter.
  - Instanced traffic and people placed in world space get at most 2 mm of error, which is less than a pixel.
  - **The real risk is ground texture coordinates (UVs).** They are absolute world metres stored as float32 (`mesh/builder.js:75`, `:108-110`). At 20 km and beyond they step by about 1–2 texels on 1 m paver and asphalt textures, so ground textures look blocky. This would hit Powai if the origin stays at Churchgate (22 km away).
  - Fix: wrap the UVs per tile (local position plus the tile origin modulo 256 m).
  - The world-space noise and sea shaders (`textures.js:129`, `environment.js:193`) are fine.
- **Verdict:** with a central origin and wrapped UVs, no floating origin is needed up to about 30 km from it. Revisit only for the wider metropolitan region (40 km and more).

### 2. Converter runs

| Run | Box (S,W → N,E) | Tiles | Gzipped | Raw | Largest tile | Time | Peak memory |
|---|---|---|---|---|---|---|---|
| Today | 18.890,72.795 → 18.975,72.860 | 163 | 1.43 MB | 1.87 MB | 23 KB | 8 s | 0.29 GB |
| (a) island city | → 19.070,72.885 | 457 | 4.66 MB | 6.18 MB | 35 KB | 29 s | 0.70 GB |
| (b) + western suburbs to Andheri | → 19.140,72.880 | 653 | 7.08 MB | 9.41 MB | 30 KB | 49 s | 1.0 GB |
| (c) + Powai (one box) | → 19.140,72.920 | 1007 | 9.55 MB | 12.67 MB | 31 KB | 57 s | 1.26 GB |
| Stress test: Greater Mumbai incl. the national park | 18.890,72.775 → 19.300,72.990 | 3158 | 20.3 MB | 26.8 MB | 29 KB | 196 s | 2.0 GB |

**It works.** There were no crashes and no polygon-clipping failures. Coastline, Mahim creek, the Mithi river and Powai Lake (a multipolygon that correctly becomes a hole in the land) all come out right.
- Overview images: `/tmp/claude-0/-home-user-gtb/a35c443e-baab-5d05-9fcc-621620fdf811/scratchpad/mapx/overview-c.png`, `/tmp/claude-0/-home-user-gtb/a35c443e-baab-5d05-9fcc-621620fdf811/scratchpad/mapx/bandra-c.png`, `/tmp/claude-0/-home-user-gtb/a35c443e-baab-5d05-9fcc-621620fdf811/scratchpad/mapx/powai-c.png`.
- **Work per tile in the game stays close to today's.** I ran the game's mesh builders in Node on every tile of (c):
  - triangles per tile: median 13k, 95th percentile 40k, maximum 72k (Worli Koliwada, 1,141 buildings); today's maximum is 54k;
  - build time per tile: maximum 159 ms (today 87 ms).

**Problems found:**
- **Flattened bridges.** Box (c) has about 170 km of significant bridge carriageway; today's box has about 20 km.
  - Main ones: Eastern Freeway 26.6 km (both directions), Atal Setu 14.7 km inside the box, Sea Link 7.4 km, Coastal Road about 7 km, Santa Cruz–Chembur Link Road 4.0, Lalbaug 4.7, Sahar Elevated Road 4.3, J. J. 4.2, plus the Sion, King's Circle, Andheri and Gokhale flyovers.
  - Bridges over the sea become sea-level causeways; they stay drivable because roads count as walkable (`tiles.js:204`).
  - Flyovers lie on top of the streets below, so asphalt and traffic overlap.
  - Tunnels (8.9 km, including the Coastal Road tunnel) are dropped, which leaves dead ends.
- **Elevated metro on the ground.** `classifyRail` (`:121`) keeps `railway=subway` unless it is a tunnel. About 42 km of elevated Metro lines 1, 2A, 7 and 2B would be laid as ground track down Andheri–Kurla Road, Link Road and the Western Express Highway.
- **Wrong landmark.** The landmark matcher (`:628`) has no distance limit. In every larger box, BMC matches "BMC Building No E4", a wrong 37 × 10 m building, instead of the 87 × 83 m headquarters.
- **Paved racecourse.** Mahalaxmi Racecourse is tagged as a stadium, so `classifyArea` turns it into one 1 × 1.4 km paved area.
- **No district styles north of Byculla.** `districts.mjs` only covers South Mumbai; everything else gets the default style. Garbage piles stay at about 1,500–1,600 in every box (no garbage in the new areas) and Juhu gets no palms.
- **Heights.** Only 3 % of outlines carry storeys or height in Powai and Dharavi (6–10 % elsewhere). The South Mumbai guess (`:185`) makes Hiranandani's real 20–40-storey towers 4–10 storeys. Google Open Buildings 2.5D heights would fix this.
- **Airport runways are blank land**, because aeroway tags are ignored.
- **Slow steps in the converter:** per-tile linear scans (`:492`, `:516`), the pitch check (`:579`) and the building-parts check (`:661`). The Greater Mumbai run spent 48 s placing trees in park forests. Add spatial grids, and cache tiles in GitHub Actions: `npm run build` reruns the converter on every push, which would add 1–3 minutes per deploy.

### 3. Named features in the extract

| Feature | Outline in OSM | Coordinates |
|---|---|---|
| CSMT | building way 107441517 (122 × 117 m) plus a train-shed relation 18045768 | 18.9400, 72.8365 |
| Gateway of India | building way 28845634 | 18.9220, 72.8346 |
| Taj Mahal Palace | building way 28846517 | 18.9221, 72.8331 |
| Haji Ali Dargah | mosque buildings plus a 64 × 86 m site; causeway tagged as cycleway | 18.9828, 72.8090 |
| Siddhivinayak | building 27036332 plus temple grounds | 19.0169, 72.8304 |
| Mannat | no named building; plot outline "Mannat Lands End" plus attraction point | 19.0468, 72.8201 |
| Jalsa | building way 255383845 (house); Janak is also mapped at 19.1059, 72.8272 | 19.1050, 72.8276 |
| Prateeksha | **not in OSM**; needs a hand-placed point (location to verify) | — |
| Sea Link | motorway bridge ways 56683663 and 289540742 | about 19.038, 72.819 |
| Juhu Beach | beach area, 0.8 × 4.2 km | 19.1080, 72.8230 |
| Girgaum Chowpatty | beach area | 18.9548, 72.8114 |
| Marine Drive | primary road plus a promenade area | 18.930–18.955 |
| Wankhede Stadium | stadium area plus pitch | 18.9385, 72.8255 |
| Mahalaxmi Racecourse | stadium/recreation area, 1.0 × 1.4 km | 18.9856, 72.8187 |
| Dhobi Ghat | commercial area | 18.9829, 72.8252 |
| Dharavi | suburb point, admin boundary 1.8 × 1.9 km; about 800 buildings/km² | 19.0445, 72.8586 |
| Bandstand promenade | cycleway way 31184544; Galaxy Apartments building 356285038 | 19.0510, 72.8214 |
| Mount Mary Church | church building 281241933 | 19.0466, 72.8226 |
| Shivaji Park | park area, 374 × 409 m | 19.0267, 72.8384 |
| Powai Lake | water relation 8546709 | 19.1281, 72.9059 |
| Hiranandani Gardens | neighbourhood area 1.4 × 1.4 km plus parks and hospital | 19.1183, 72.9116 |
| Airport | aerodrome area, 4.0 × 2.5 km | 19.0920, 72.8660 |
| Film City | studio relation 8757021 (outside all three boxes) | 19.1585, 72.8894 |

The extract stores nodes in dense blocks, so the existing reader's `nodeTags: true` option returns node tags; I used it for this search.

### 4. Railways and local trains
- **Track in box (c):** 262 km of main-line track (each track mapped separately), 142 km of yard track and 44 km of sidings.
- **Route relations exist with ordered ways and stops:**
  - Western Line slow (29 stops) and fast (16);
  - Central Line slow (26 stops) and fast;
  - Harbour Line to Panvel (25 stops) and to Goregaon (18).
- **Stations:** 46 suburban station points are in the box, and **all of them have platform outlines within 300 m** (179 platform ways, 154 of them closed areas). Metro and monorail stations mostly have no platforms.
- **Running trains is feasible.** The converter currently drops connectivity (tracks are cut into per-tile pieces). It needs a new step that exports one polyline per service and direction from the route relations, with station distances along the line. That file would be under about 100 KB gzipped.
  - In the game, trains (12-car, about 240 m) would move along those polylines on a timetable driven by the game clock, appear only near the player, and dwell at platforms.
  - Riding a train would be a fade between stations.
  - Road bridges over the tracks are flat for now, so cars would cross the tracks at the same level until flyovers are built.

### 5. Recommendation
- **Target box:** (c) `--bbox 18.890,72.795,19.140,72.920`, or (a) first if something is needed live this week. Box (a) already includes Bandstand, Mannat, Mount Mary, the whole Sea Link, Haji Ali, Siddhivinayak, Shivaji Park and Dharavi. Keep the extra eastern area in (c) (Kurla and Ghatkopar, about 2.5 MB), because it carries the roads that connect Powai to the city.
- **Must fix before shipping (c):**
  1. **The full map and GPS download every tile.** `cityMap.load` (`cityMap.js:66`) runs when opening the map (Tab), going on taxi duty (`jobs.js:78`) or routing from the phone or missions. That is 1.4 MB today and would be 9.5 MB for (c), plus a 149,000-node road graph built on the main thread (1.1 s in Node, slower on phones).
     - The route search stops after 60,000 steps (`:161`), but Gateway to Hiranandani needs 74,386, so **GPS to Powai fails**.
     - Fix: have the converter write a separate overview file (vehicle roads plus simplified land: **0.57 MB gzipped** for (c)), build the graph in a worker, and raise the limit or route over main roads first for long trips.
  2. A fixed central origin (`--origin`) and wrapped UVs.
  3. Small converter fixes: leave out elevated metro, add a distance limit to landmark matching, make the racecourse grass, add district guides for Worli, Dadar, Dharavi, Bandra, Juhu, Andheri and Powai, and use real heights for the suburbs.
  4. Then flyovers (already "Next" item 4): about 170 km of bridges, the most visible remaining flaw.
- **Keep the 500 m tiles.** Do add a distant skyline layer: outlines of buildings 25 m or taller are only **0.11 MB gzipped** for (c) (6,300 buildings). The camera's far limit is 2000 m (`main.js:78`), so the skyline would need it raised or its own render pass.
- **GitHub Pages size:** tiles are generated at build time and not committed, so git is unaffected. The site goes from about 181 MB to about 190 MB with (c), or about 200 MB with the whole of Greater Mumbai. `index.json` grows from 3.6 KB to 16.6 KB.
- **Load time for the player stays the same.** Tiles within the 800 m High radius come to about 111 KB at the Gateway, 236 KB at Worli/Dadar, 230 KB at Dharavi, 162 KB at Hiranandani and 112 KB at Juhu, against 147 KB today. Only the full-map download in item 1 grows with the size of the map.

Scripts and logs are in `/tmp/claude-0/-home-user-gtb/a35c443e-baab-5d05-9fcc-621620fdf811/scratchpad/tools/` and `/tmp/claude-0/-home-user-gtb/a35c443e-baab-5d05-9fcc-621620fdf811/scratchpad/mapx/`. The full landmark search is in `features.txt` and the railway analysis in `rail.txt` in that folder.
