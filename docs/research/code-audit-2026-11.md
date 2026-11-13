# Code, gameplay and physics audit (2026-11-13)

I changed no repository files. Most findings come from reading the code. Items marked ✔ I also reproduced in Node; those scripts are in /tmp/claude-0/-home-user-gtb/a35c443e-baab-5d05-9fcc-621620fdf811/scratchpad/audit-a/.

- The baraat-in-`street.hits()` bug you mentioned is already fixed: street.js:664-675 now only checks cows and the broken-down taxi.
- Another session has uncommitted edits in traffic.js, fleet.js and main.js (the fleet now uses BatchedMesh, which also removes the per-car `new Vector3` allocation). Line numbers for traffic.js are for that working copy.

## A. Bugs (most valuable first)

1. **Reloading during a mission freezes the game** ✔. Location: story.js:106-130.
   - **Cause:** `lines`, `base`, `coloured` and `stepT` are only set in `enterStep()`, which never runs on load.
   - **Trigger:** a save taken during a cutscene, the "3 rides" task or the Holi task. Saves happen every 10 s, on `pagehide`, and in `changeQuality()` (main.js:171).
   - **Effect:** `update()` throws every frame (story.js:186, 226, 231), so the screen stays frozen until the player starts a New game. Other steps lose their waypoint, put passengers at (0,0), and get `stepT` = NaN, so time limits never fail.
   - **Fix:** add a `resume()` that re-enters the current step (skipping rewards), and set `stepT = 0` in the constructor. **S**
2. **The taxi can pass through buildings, and grazing a wall bounces it** ✔. Location: car.js:46, 53-62.
   - **Cause:** turning is never checked against collisions, and once the car overlaps something (`stuck`), every move is allowed.
   - **Node test results:**
     - Steering into a wall while driving parallel to it goes 8 m through the wall.
     - A car that already overlaps a wall drives 24 m through it.
     - A 10° graze at 20 m/s reverses the car and records a 21 m/s impact (−7 % condition, dents, crash sound).
   - **Fix:**
     - Have `hits` return a contact normal and depth (`polyHit` already computes `segDist`).
     - Push the car out along the normal and keep its sideways velocity, so it slides.
     - Use only the speed into the wall as the impact.
     - Split the step into smaller steps when it moves more than 0.5 m.
     - Check the turned position too. **M**
3. **Fines and fender-bender payments are free on foot.**
   - **Cause:** `police.update` and `street.update` receive the walker on foot (main.js:516-518). The walker has no `pay`, so police.js:377 and street.js:589 do `walker.money -= x` (giving NaN) and still clear the stars.
   - **Fix:** always pay through `state`. **S**
4. **The hawaldar (traffic constable) dialog locks up.** Location: police.js:328.
   - `deciding` is set to true and is never reset when you drive off (police.js:333) or when stars fade. After that you can never stop and pay a constable again, and the old choice box stays on screen and can add a second "evade" penalty.
   - `choice()` (main.js:436-443) does not close a previous menu, so two capture listeners stay active and one key press fires both (for example, paying for a repair and the challan).
   - **Fix:** reset `deciding` on every exit path; allow one choice box at a time; close it automatically when the player drives off. **S**
5. **Traffic and patrols ignore the parked taxi.**
   - traffic.js:194 and police.js:594 check against the active body, which is the walker when on foot. NPC cars and patrols drive through the parked taxi and leave it overlapped, which triggers bug 2 when you get back in.
   - Patrols treat the player as one 1.1 m circle, while the player's car uses two 0.8 m circles.
   - **Fix:** always pass both the taxi and the walker as obstacles. **S**
6. **Reload and reset exploits and losses.**
   - **Continue:** fuel resets to 0.6, condition to 1, position to the spawn and the clock to 5:15 pm. Only the quality-change resume keeps them (main.js:161-167).
   - **Q (quality change) or reload:** clears wanted stars and fines. Paid Bhookh/JhatPat orders (phone.js:92-94 → `jobs.riders`) are lost.
   - **R (main.js:466):** a free tow plus 30 % fuel from anywhere. On foot it moves only the taxi and leaves you stranded.
   - **Fix:** save position, fuel, condition, clock, police state and riders in `state.s`; make R a paid tow that also puts you back in the taxi. **S-M**
7. **Audio after pausing.**
   - While paused or on the map, the loop returns early (main.js:461). On resume, radio.js:83 schedules every note it missed since `nextNote`, so hundreds of oscillators start at once. The same happens after the tab was hidden.
   - The siren, engine and tyre squeal keep playing while paused.
   - **Fix:** clamp `nextNote` to `currentTime`; suspend the audio context on pause and when the tab is hidden. **S**
8. **Small bugs, each S:**
   - Keys stay pressed after Alt-Tab, because input.js has no `blur` handler.
   - The HUD says "press F to fill up", but E refuels and F gets you out (main.js:637).
   - On foot, the road name and the fuel-bar colour follow the taxi (main.js:609, 614).
   - `#fade` exists twice (index.html:17 and :44, from the cheats commit). The one actually used sits inside `#hud` and is hidden during cutscenes.
   - Patrol taxis are removed but never disposed, so GPU memory leaks with every chase (police.js:483, 602).
   - At a dead end, NPC cars turn round even on one-way roads and drive the wrong way (traffic.js:161).
   - street.js:556 blames the nearest car's driver for any crash, including into a wall.
   - The baraat walks in a straight line through buildings (street.js:383).

## B. Gameplay and economy

9. **Taxi work loses money.**
   - **Cost:** 35 L at ₹103 per tank for about 60 km (car.js:68, main.js:416-419) is about ₹60 per km.
   - **Fare:** ₹28 base, ₹18.7 per km after 1.5 km, plus a ₹40 bonus (jobs.js:14, 226-235).
   - **Result:** a 3.5 km ride earns about ₹105 and burns about ₹225 of fuel, and the ₹25,000 rent can never be reached.
   - **Fix:** about 12 km per litre (roughly 400 km per tank), or about ₹5 per km; then tune fares. **S**
10. **Every stop counts as "hard braking".** The threshold at jobs.js:196 is −8.5 m/s², but the keyboard brake is −9 to −10.8 m/s², so each stop costs about 10 comfort per second. **Fix:** ramp brake force up while the key is held, and penalise jerky changes instead of braking itself. **S**
11. **The taxi drives through people.** `world.hits` (main.js:149) contains no people, and only walking pedestrians dodge (street.js:184). Crowds at stalls and bus stops, constables, cricket kids and the baraat are driven through with no reaction. **Fix:** test circles against nearby people and use the existing knock-down state plus a hit-and-run offence. **M**
12. **Other gaps:**
    - Fines are wiped when stars fade (police.js:580), so evading always beats paying.
    - There is no arrest on foot, and patrols only follow you.
    - E at a thela buys a random item (jobs.js:303).
    - Rent, zero hunger and zero energy have no consequences.
    - Failed missions have no retry checkpoint.

## C. Per-frame performance hotspots

13. **Tile lookups allocate strings.** `nearTiles` (tiles.js:184-189) builds 9 string keys per query. `groundHeight` and `hits` run per pedestrian (street.js:182), per pichkari drop (pichkari.js:212, 218, up to 420 drops), and per debris bit, dog and cop — thousands of strings per frame. **Fix:** numeric tile index, skip the ±1 tile margin for points, and give pedestrians their known kerb height. **M**
14. **`propPhysics.hits` scans every point.** It checks every tree, lamp and stall in 9 tiles (up to 531 per tile ✔), about 6 times per car step (propPhysics.js:34-36). **Fix:** a grid of points per tile. **S**
15. **Page HTML is rewritten every frame** at jobs.js:323, story.js:160/237 and navigator.js:81 (the navigator also redoes its turn search every frame). **Fix:** throttle, or write only when the text changes. **S**
16. **Traffic look-ahead checks every car against every car** (traffic.js:193, about 12,000 calls for 110 cars), and `signals.ahead` is a linear scan per car. **Fix:** spatial buckets. **S-M**
17. **Road graphs are rebuilt on every tile load or unload:** traffic (including a slow loose-end merge loop at traffic.js:106), signals and police. ✔ About 13 ms in Node for the traffic graph alone on 19 tiles, so each streaming event causes a hitch. **Fix:** build graphs per tile, incrementally. **M**
18. **City map** ✔: the first fare or map open decodes all tiles on the main thread (338 ms in Node for 163 tiles). The A* route search reruns every 1.5 s, averaging 2.6 ms and peaking at 15 ms (cityMap.js:161).

## D. Architecture debt

- **Physics:**
  - Collision is a true/false `hits(x,z,r)` combined across five systems (main.js:149). There are no contact normals, no contact identities (propPhysics uses a `lastHit` side channel) and no masses.
  - Movement is integrated separately in about seven places, with a variable step of up to 0.05 s.
  - Needed first: one physics layer returning normal, depth and what was hit; a fixed 60 Hz step; contact events feeding damage, police and street life.
- **Bigger map:**
  - The full map needs a routing graph and overview map built by the converter, not loading every tile.
  - Place names, map labels and mission positions are hard-coded South Mumbai tables (jobs.js:92-98, cityMap.js:7-12, story.js:26-33).
  - Graphs must be incremental.
  - At about 28 km from the origin (suburbs), single-precision coordinates will need the world origin shifted with the player.
- **Interiors:**
  - Ground height is only "road" or "kerb", and buildings are solid blocks.
  - Camera collision and police line of sight both use `tiles.hits`.
  - Needs an exterior/interior "space" concept, door triggers with a fade, and ambient systems paused inside.
- **Missions:**
  - Missions are hard-coded in the Story constructor, with step state that isn't saved.
  - There are no trigger volumes and no mission-owned entities (traffic deletes cars beyond 320 m).
  - There are no cutscene camera timelines, and the save has no versioning (the `gtb.save.v1` blob is merged shallowly).

## E. Is Rapier worth it?

**Measurements** (rapier3d-compat 0.21.0, Node on a desktop CPU):

| What | Result |
|---|---|
| Download, compat build | 4.3 MB raw / 1.65 MB gzipped |
| Download, standard build | 3.1 MB wasm / 1.17 MB gzipped |
| WebAssembly start-up | 68 ms |
| One raycast vehicle on flat ground | 0.23 ms per 60 Hz step |
| + 2,000 static building boxes | 1.07 ms per step |
| + 110 kinematic traffic cars, or + 200 debris bits | about 1.45 ms per step |
| 8,000 static boxes | about 2 ms per step |

Expect 3-5× slower on mid-range phones. That is more than the whole current simulation (about 1.3 ms per step) unless colliders are limited to roughly 150 m around the player.

**My opinion: not for the car yet.** The world is flat 2.5D and arcade feel matters more than real suspension. Raycast vehicles in flat cities need a lot of tuning (flipping, catching on kerbs, false contacts at tile seams). Do fix 2 plus a simple 2D rigid-body car instead:
- velocity kept separate from heading;
- sideways tyre grip, which gives drifts and handbrake turns;
- mass-based pushes against NPC cars.

That is effort M with zero extra download.

**When Rapier becomes worth it:**
- once flyovers and ramps exist, because then real 3D contact matters;
- or as a lazily loaded "debris and knock-down" layer: taxi, NPC cars and people as kinematic bodies; props, garbage, fruit and knocked-down people as dynamic bodies within about 60 m.

**Integration points:**
- **car.js `update()`:** use Rapier's raycast vehicle controller and read back position, heading and speed for the HUD, police and jobs.
- **tiles.js load/unload:** add and remove static colliders per tile, built in tileWorker.js from the convex parts of `collide.solid`.
- **traffic.js and police.js:** kinematic bodies.
- **propPhysics.js:** dynamic bodies for loose bits; fixed colliders for trees and lamps.
- **combat.js and walker.js knock-downs:** a capsule push plus a fall animation (true ragdolls would be L).
- **main.js `step()`:** a fixed-step physics update whose contact events feed `damage.impact`, `propPhysics.impact`, `street.checkBump` and police hit-and-run. `__gtb.step` must keep working for headless tests.

**Risk:** high for Rapier (driving feel can get worse, async start-up, phone CPU, and every system's movement code changes) versus low for improving the custom physics step by step.

**Scratch files:** in /tmp/claude-0/-home-user-gtb/a35c443e-baab-5d05-9fcc-621620fdf811/scratchpad/audit-a/
- story-test.mjs
- car-test.mjs
- graph.mjs
- astar.mjs
- rapier-bench.mjs
