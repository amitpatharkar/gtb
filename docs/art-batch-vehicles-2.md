# Vehicle models, batch 2 (2026-11-17)

Uploaded by the owner's Claude Code session on branch `art/vehicles-batch-2`. Nothing in `src/` changed, so the
game behaves exactly as before until the steps below are done.

## What was added
- `public/art/vehicles/*.glb`: 18 CC BY 4.0 Sketchfab models. Licences and authors were checked against the
  Sketchfab API (matched by title, and by triangle count where titles clashed); credit lines are in
  `public/art/CREDITS.md`. Textures were shrunk to 512 px and meshes simplified to at most 60k triangles first
  (the build drops textures and simplifies to ~6.5k anyway). All 18 pass `buildVehicle()` in
  `scripts/art-vehicles.mjs` without errors.
- `docs/art-sources/kaali-peeli-taxi/`: the Mumbai kaali-peeli taxi as FBX + texture (CC BY 4.0, "Sunny khude 3d
  model"). Not converted yet; kept outside `public/` so it is not shipped.

## Why nothing shows in the game yet
`src/vehicles/vehicleModels.js` only uses a file if `typeForFile()` maps it to a type AND its name is in `VERIFIED`
(checked by eye). Do the following, in this order.

1. Build, run `node scripts/art-index.mjs --preview`, and look at each model in the game (`?play`).
2. For each one that looks right, add its base name to `VERIFIED`; add a `FILE_TYPES` regex if none matches.

| File (base name) | Maps to | Needs |
|---|---|---|
| `2020_maruti_suzuki_alto_800` | `alto` (regex matches) | eye check |
| `hindustan_ambassador` | `ambassador` | eye check |
| `maruti_suzuki_800_custom_edition`, `maruti_800_lowpoly_free_download`, `ps1-style_maruti_800_-_game_ready` | `m800` | eye check; pick one best |
| `2006_suzuki_sx4`, `suzuki_sx4_2008` | `sx4` | eye check |
| `hyundai_accent_5_doors_2005` | `verna` (regex `accent`) | eye check |
| `suzuki_jimny_ja22` | `jimny` | eye check |
| `maruti_suzuki_omni_small_van` | `omni` | eye check |
| `wagon_r_tkanimationsd742` | `wagonr` | eye check |
| `swift_dzire_2012`, `swift_dzire_2014` | `dzire` | eye check |
| `2008_honda_city_v_at` | `city` | add `[/honda_city/i, 'city']` to `FILE_TYPES` |
| `tata_indigo` | `indica` | add `[/indigo/i, 'indica']`; the model is only 1k triangles |
| `tata_harrier_2024`, `ford_figo_and_aspire`, `2022_suzuki_ignis` | new types | add `VEHICLE_ART` entries (parody name, real length, `base`) plus `FILE_TYPES` |

Eight of them came out of the converter with **no paint part** (`2006_suzuki_sx4`, `suzuki_sx4_2008`, `suzuki_jimny_ja22`,
`maruti_800_lowpoly_free_download`, `ps1-style_maruti_800_-_game_ready`, `tata_indigo`, `tata_harrier_2024`,
`ford_figo_and_aspire`): the car would not take the per-vehicle tint. The raw originals behave the same. Leave them
out of `VERIFIED` unless `classify()` in `scripts/art-vehicles.mjs` is improved for them.

## The taxi (highest value: it is the city's icon)
Convert `kaali-peeli-taxi.fbx` to GLB with `scripts/assets/fbx2glb.py` (Blender runs in GitHub Actions), embed the
texture, save as `public/art/vehicles/padmini.glb`. The fleet type `padmini` then gets its close-up body replaced
(file names equal to a fleet type skip the `VERIFIED` check, so look at it first). The player's own taxi is
procedural (`src/vehicles/taxi.js`) and is not replaced by this.

## Not uploaded (and why)
Rally, convertible, in-progress, 3D-printing and wheel-only files, cars Mumbai hardly sees (Land Cruiser, Hilux,
Ioniq, EV6, Kizashi, Elantra N, Octavia, Wuling, Fiesta…), duplicates (`(1)`, `(2)`, `(3)` copies), and models whose
licence could not be confirmed (`fiat_uno_1994`, `kia_seltos`, `mg_hector`, and others with no unambiguous Sketchfab
match). `honda-city.zip` holds a `.rar` that could not be opened here.
