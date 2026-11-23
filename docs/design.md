# Bombay Bawaal — design document (fresh start, 2026-11-23)

The old game grew sideways, one fun idea at a time. This restart goes deep instead of wide:
few systems, each done properly, in one small part of Mumbai first. The old code is in `trash/`
(kept in git, not built, not shipped).

## Goal
A third-person open-world crime game in the real Mumbai, playable in Chrome. It doesn't try for
GTA 6 photorealism; it should **look good and behave like the real world**: solid buildings,
believable driving, physics everywhere, controls that feel like a modern open-world game.

## Tone
- A serious crime story with dark humour, in the spirit of GTA 4/5. Satire through fake brands,
  radio and billboards, not through childish toys (no pichkari, no firecracker weapons).
- Guns are in. Three rules stay: **fictional gangs only, no real underworld figures, and nothing
  touching the 2008 attacks or riots.** Never mock poverty; no real celebrities; real brands get
  parody names (see `docs/research/mumbai-guide*.md`).
- "Grand Theft …" or "GTA" never appear in the visible name (Rockstar trademark).

## Pillars
1. **The city is solid.** Physics is the one source of truth for what you can stand on and hit.
   Nothing on the road, no paper walls.
2. **Feel first.** Driving, walking, aiming and the camera are tuned until they feel right on the
   reference machine before anything new is added.
3. **Depth in a small area.** Colaba (Causeway, Gateway of India, Kala Ghoda) until it passes the
   screenshot test, then grow outward.
4. **Real assets near the camera.** Real models and photo-scanned materials up close; simple
   stand-ins only far away.

## Reference machine and budgets
- MacBook Air M4, Chrome. Target: steady 60 frames per second on High after 10 minutes of driving
  (the Air has no fan and slows down when hot).
- Phones get a simpler Low setting.
- First load: up to 150 MB on High, much less on Low. No single file over 100 MB in git; site under 1 GB.

## Tech
- **Three.js WebGPU renderer** (`three/webgpu`), materials and effects in TSL (Three.js Shading
  Language). Falls back to WebGL 2 automatically where WebGPU is missing.
- **Rapier** physics (WebAssembly): static world colliders from the map tiles, a kinematic
  character controller on foot, a raycast-suspension vehicle controller for cars.
- Fixed 60 Hz simulation step; rendering interpolates.
- Map data: OpenStreetMap through the existing converter (`scripts/build-tiles.mjs`), streamed tiles.

## Controls (standard open-world PC layout; Xbox/PlayStation controller supported)
| Action | Keyboard + mouse | Controller |
| --- | --- | --- |
| Move / steer | W A S D | Left stick |
| Look | Mouse (click to capture) | Right stick |
| Sprint (on foot) | Shift | A / Cross (hold) |
| Jump | Space | X / Square |
| Enter / exit vehicle | F | Y / Triangle |
| Aim / shoot | Right mouse / left mouse | LT / RT |
| Accelerate / brake-reverse (car) | W / S | RT / LT |
| Handbrake | Space | B / Circle |
| Horn | H | Left stick press |
| Reload | R | B / Circle (on foot) |
| Weapon wheel (hold, point, let go) | Tab | LB |
| Weapon: fists / pistol | 1 / 2 or mouse wheel | — |
| Phone | P | D-pad up |
| Reset car upright | Hold F while stuck | — |
| Pause | Esc | Start |
| Map | M | View |
| Car tuning panel (development) | F2 | — |

## HUD (minimal, out of the way) — the full interface design is `docs/ui.md`
- Bottom left: round minimap (north up, player arrow), health bar and armour bar under it.
- Top right: weapon icon with ammo, wanted stars under it (once the police system lands).
- Bottom right in a vehicle: speed in km/h and gear.
- Bottom centre: one context prompt at a time ("F  Enter car").
- Top left: short messages that fade.
- Pause menu: Resume, Controls, Graphics, Credits.

## In scope for the foundation (built now)
1. New renderer, physics, input, game loop.
2. Colaba from the map tiles: roads with real kerbs, solid buildings, no building on a road.
3. On foot: the main character, third-person camera that never clips through walls, walk/run/jump.
4. Cars: a few real models with spinning and steering wheels, raycast suspension, weight transfer,
   handbrake slides, crashes; a tuning panel.
5. Pistol: aim, shoot, hits on the world and physics objects, ammo and reload.
6. The HUD above and a pause menu.

## Next, one by one (owner decides the order)
- Pedestrians (varied Indian characters) and their reactions; ragdolls.
- Traffic that drives on the left, signals; police and a wanted system that only knows what
  witnesses saw (the GTA 6 "heat" idea; see `docs/knowledge/`).
- Building kit per Mumbai style (chawl, Art Deco, Victorian Gothic, bazaar) for the near streets.
- Lighting and weather: day/night, monsoon with wet roads and reflections.
- Sound: engines, tyres, city ambience, radio.
- Missions with cutscenes; then the rest of the map.

## Out (moved to `trash/`)
Firecrackers, pichkari, cheats, easter eggs, fan meets, the phone, radio, taxi and delivery jobs,
trains, metro, interiors, the old UI, the old people and traffic. Any of these can come back,
rebuilt to the new standard, if the owner asks.
