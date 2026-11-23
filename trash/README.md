# Trash — the old game (moved here on 2026-11-23)

The owner asked for a fresh start: everything that was not kept for the new game was moved here instead of
deleted, so nothing is lost. Nothing in this folder is built, shipped or tested. Treat it as deleted; copy a piece
back out only if the owner asks for it (rebuilt to the new standard, see `docs/design.md`).

| Here | What it was |
| --- | --- |
| `src-old/` | The old game's code: traffic, police and challans, trains, metro, interiors, missions, phone, radio, people (MakeHuman crowd), crackers, pichkari, cheats, easter eggs, the old UI |
| `index.html`, `people.html` | The old page shell and the people lineup page |
| `tests/smoke.mjs` | The old headless checks |
| `scripts/art-index.mjs`, `art-vehicles.mjs` | The old owner-model pipeline (vehicles split into four parts, wheels baked in) |
| `public/people/` | The 24 MakeHuman crowd templates and their atlas (the main character stays in `public/people/hero/`) |
| `public/art-models/` | Owner-made props (carts, bus shelter) |
| `public/brand/`, `public/fonts/` | The old logo and title font |
| `CLAUDE-old.md`, `plan-old.md`, `README-old.md` | The old project notes, plan and readme |

Kept (not in trash): the OpenStreetMap converter (`scripts/build-tiles.mjs`, `scripts/lib/`), the tile format
(`src/world/tileFormat.js`, `levels.js`, `overviewFormat.js`, `mesh/builder.js`, `mesh/ground.js`), the asset
pipeline and `assets` branch, the raw map data, the owner's vehicle uploads (`public/art/vehicles/`), the main
character (`public/people/hero/`, `scripts/people/`), all research in `docs/`.
