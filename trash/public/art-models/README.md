# Models made with free online tools

Upload `.glb` files here with the exact names listed in `docs/art-requests.md`
(for example `vada-pav-cart.glb`). The game finds them automatically on the next deploy:
`scripts/art-index.mjs` lists this folder during the build and `src/world/art.js` loads
whatever is listed. Keep each file under 8 MB. Add one line per file to `../CREDITS.md`.
