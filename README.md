# Bombay Bawaal — a fun, toned-down Mumbai open-world browser game

(Code name and repository: GTB.)

Built with [Three.js](https://threejs.org) and [Vite](https://vite.dev). Free from start to finish.

**Play:** https://amitpatharkar.github.io/gtb/

## How testing works
- Every push to `main` builds and deploys automatically (GitHub Actions → GitHub Pages). Open the link above about a minute later.
- To run it yourself: open the repository in GitHub Codespaces (or locally) and run `npm install` then `npm run dev`
  (this first converts the OpenStreetMap data into map tiles, about a minute).
- `npm run build` then `npm test` plays the built game headless (boot, driving, traffic, stealing a car, every
  mission, trains, night) and fails on errors or stutter; it also runs in GitHub Actions after every push.

## Controls
W A S D / arrow keys to drive, Space to brake (handbrake turn when steering), H horn, E refuel or repair at a
petrol pump (⛽ on the map) or buy a snack at a thela, F get out / take any vehicle, J taxi fares, Tab city map,
P phone, N radio, T jump one hour, M mute, R twice for a tow back to the Gateway, Q twice for graphics quality,
Esc pause, ? key list. On foot: mouse to look, left click punch or spray the Holi pichkari, X light a cracker.
On-screen buttons on phones. The full list is in the game's Guide.

You drive a kaali-peeli taxi from Colaba to Bandra, Juhu, Andheri, Kurla and Powai (autos only north of the Mahim
creek, as in real life), take fares, play missions, ride the local trains and get into trouble with the traffic
police. The clock runs a full day in 24 minutes: the sun moves, the city lights up at night, traffic peaks at rush
hours, and the air quality index (AQI) changes the haze.

## Map
Mumbai at real scale from Colaba to Bandra, Juhu, Andheri, Kurla and Powai, built from OpenStreetMap: real streets,
buildings, coastline, maidans and railway lines. South Mumbai streets are dressed from the owner's street survey
(`docs/research/street-library/`).
`npm run tiles` turns `data/raw/mumbai-region.osm.pbf` into small compressed map tiles in `public/tiles/`.

Map data © OpenStreetMap contributors, available under the Open Database License.

## Free assets
`docs/research/assets.json` lists free textures, skies, sounds, fonts and models (CC0, CC-BY or Open Font License only).
The "Build assets" GitHub Action downloads and compresses them into the `assets` branch; every deploy includes them.
All credits are in the game (Credits link, bottom right).

## Free stack
| Need | Tool |
|---|---|
| Code + version control | GitHub (public repository) |
| Build + deploy | GitHub Actions (free for public repositories) |
| Hosting | GitHub Pages |
| Cloud editor | GitHub Codespaces (free monthly hours) |
| Big assets later | Cloudflare R2 free tier, or a second Pages site |
| 3D models | Blender, Quaternius, Kenney, Poly Haven (free) |

## Structure
- `src/main.js` — renderer, camera, game loop
- `src/world/` — sky and sea, tile streaming and collisions, tile worker, materials, tile format
- `src/vehicles/` — taxi and car physics, the Indian traffic fleet, damage, taking vehicles, uploaded vehicle models
- `src/sim/` — clock, traffic, signals, police, people, street life, trains
- `src/game/` — save state, jobs, missions, collectibles, crackers
- `src/ui/` — menus, maps and GPS, phone, navigator
- `src/input.js` — keyboard and touch controls
- `scripts/build-tiles.mjs` — map converter (OpenStreetMap → tiles)
- `scripts/assets/` — asset pipeline (download, compress to KTX2, credits)
- `docs/gta-v-development-analysis.md` — how GTA V was made, and what GTB borrows from it
- `docs/research/` — Mumbai street guide, live check, free asset list
