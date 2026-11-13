# GTB — a fun, toned-down Mumbai open-world browser game

Built with [Three.js](https://threejs.org) and [Vite](https://vite.dev). Free from start to finish.

**Play:** https://amitpatharkar.github.io/gtb/

## How testing works
- Every push to `main` builds and deploys automatically (GitHub Actions → GitHub Pages). Open the link above about a minute later.
- To run it yourself: open the repository in GitHub Codespaces (or locally) and run `npm install` then `npm run dev`
  (this first converts the OpenStreetMap data into map tiles, about 3 seconds).

## Controls
W A S D / arrow keys to drive, Space to brake, H horn, F refuel at a petrol pump (⛽ on the map), T jump one hour,
M mute, R go back to the start (towed, with some fuel), Q graphics quality. On-screen buttons on phones.

You drive a kaali-peeli taxi through South Mumbai (autos aren't allowed there). The clock runs a full day in
24 minutes: the sun moves, the city lights up at night, traffic peaks at rush hours, and the air quality index (AQI)
changes the haze.

## Map
South Mumbai (Colaba, Gateway of India, Fort, CST, Churchgate, Marine Drive, Malabar Hill) built from
OpenStreetMap: real streets, buildings, coastline, maidans and railway lines.
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
- `src/rickshaw.js` — placeholder auto-rickshaw and driving physics
- `src/input.js` — keyboard and touch controls
- `scripts/build-tiles.mjs` — map converter (OpenStreetMap → tiles)
- `scripts/assets/` — asset pipeline (download, compress to KTX2, credits)
- `docs/gta-v-development-analysis.md` — how GTA V was made, and what GTB borrows from it
- `docs/research/` — Mumbai street guide, live check, free asset list
