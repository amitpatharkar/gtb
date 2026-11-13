# GTB — a fun, toned-down Mumbai open-world browser game

Built with [Three.js](https://threejs.org) and [Vite](https://vite.dev). Free from start to finish.

**Play:** https://amitpatharkar.github.io/gtb/

## How testing works
- Every push to `main` builds and deploys automatically (GitHub Actions → GitHub Pages). Open the link above about a minute later.
- To run it yourself: open the repository in GitHub Codespaces (or locally) and run `npm install` then `npm run dev`.

## Controls
W A S D / arrow keys to drive, Space to brake. On-screen buttons on phones.

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
- `src/main.js` — renderer, lights, camera, game loop
- `src/world.js` — city blocks, roads, sea front
- `src/rickshaw.js` — placeholder auto-rickshaw and driving physics
- `src/input.js` — keyboard and touch controls
