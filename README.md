# Bombay Bawaal — an open-world crime game in the real Mumbai, in your browser

(Code name and repository: GTB.) Free from start to finish.

**Play:** https://amitpatharkar.github.io/gtb/ (Chrome on a laptop or desktop; a mouse or a game controller helps).

This is a fresh start (2026-11-23): fewer systems, each done properly, in Colaba first. The design is in
[`docs/design.md`](docs/design.md); the old game is kept in [`trash/`](trash/README.md).

## What's in it
- Colaba, Apollo Bunder and Kala Ghoda at real scale from OpenStreetMap: roads with real kerbs, footpaths, sea wall,
  solid buildings with windows and shopfronts, street trees and lights.
- Three.js WebGPU renderer (falls back to WebGL 2), photo-scanned materials, a real photographed sky, shadows.
- Rapier physics: everything solid, a physics character on foot, cars on raycast suspension.
- Four real car models with spinning, steering wheels; a pistol; crates and bins to push around.

## Controls
| | Keyboard + mouse | Controller |
| --- | --- | --- |
| Move | W A S D | Left stick |
| Look | Mouse (click the game first) | Right stick |
| Sprint / jump | Shift / Space | A / X |
| Get in or out of a car | F | Y |
| Aim / shoot / reload | Right mouse / left mouse / R | LT / RT / B |
| Drive / brake, reverse / handbrake | W / S / Space | RT / LT / B |
| Horn | H | Left stick press |
| Menu | Esc | Start |
| Car tuning panel | F2 | |
| Frame-rate and position readout | ` (backquote) | |

## Development
- `npm install`, then `npm run dev` (first converts the OpenStreetMap data into map tiles, about a minute).
- `npm run build`, then `npm test`: plays the built game headless and fails on errors, stutter or broken physics.
- Every push to `main` builds, tests and deploys to GitHub Pages.

Map data © OpenStreetMap contributors (Open Database License).
