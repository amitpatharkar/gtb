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

## Batch 3 (same day): 22 more models, all new game types

Same treatment as above (CC BY 4.0 checked against the Sketchfab API by title and triangle count; textures 512 px;
meshes at most 60k triangles; all 22 pass `buildVehicle()`). None maps to an existing fleet type, so each needs a
`VEHICLE_ART` entry (parody name, real length `len`, `base` type for handling and weight, `weight` = how common) and a
`FILE_TYPES` regex, then an eye check and a `VERIFIED` entry. Suggested starting values (lengths are real, in metres):

| File (base name) | id | Parody name | len | base | weight |
|---|---|---|---|---|---|
| `2013_honda_brio_amaze` | amaze | Honda Amayz | 3.99 | city | 0.3 |
| `honda_brio_satya_e_2019` | brio | Honda Breeo | 3.6 | i10 | 0.2 |
| `hyundai_i20_2010` | i20 | Hundai Ai-Twenty | 3.94 | i10 | 0.3 |
| `mg_hector` | hector | Em-Jee Hektor | 4.67 | innova | 0.15 |
| `kia_carnival_2011` | carnival | Kiya Carnivaal | 4.8 | innova | 0.05 |
| `hyundai_ix35_tucson` | ix35 | Hundai Ix-35 | 4.41 | creta | 0.06 |
| `hyundai_kona` | kona | Hundai Konaa | 4.17 | creta | 0.06 |
| `2017_hyundai_sonata__hybrid` | sonata | Hundai Sonaata | 4.9 | city | 0.05 |
| `hyundai_elantra_mk5_2010-2018` | elantra | Hundai Elantraa | 4.53 | city | 0.1 |
| `2011_suzuki_kizashi_sport` | kizashi | Maroti Kizaashi | 4.65 | city | 0.03 |
| `suzuki_grand_vitara_mk2_2005-2014` | gvitara | Maroti Grand Vitaara | 4.47 | creta | 0.06 |
| `toyota_land_cruiser` | lcruiser | Toyoda Land Crooser | 4.95 | innova | 0.05 |
| `2013_toyota_land_cruiser_prado` | prado | Toyoda Praado | 4.78 | innova | 0.05 |
| `toyota_land_cruiser_prado_2022` | prado22 | Toyoda Praado Nayi | 4.92 | innova | 0.04 |
| `1976_toyota_land_cruiser_fj40` | fj40 | Toyoda Jeep-Chalees | 3.85 | bolero | 0.03 |
| `toyota_hilux_1983` | hilux | Toyoda Haylux | 4.6 | bolero | 0.03 |
| `1976_ford_fiesta_mk1` | fiesta1 | Fored Fiyesta Puraani | 3.56 | alto | 0.03 |
| `low-poly_skoda_octavia_rs_2020` | octavia | Skoda Oktaavia | 4.69 | city | 0.04 |
| `2013_wuling_hongguang_s` | hongguang | Wuling Honggwang | 4.5 | ertiga | 0.03 |
| `2022_kia_ev6_gt-line` | ev6 | Kiya EV-Chhe | 4.68 | creta | 0.03 |
| `suzuki_grand_vitara` | gvitara2 | Maroti Grand Vitaara 2 | 4.5 | creta | 0.04 |
| `kia_carnival` | carnival2 | Kiya Carnivaal 2 | 5.1 | innova | 0.04 |

These car types are rare in Mumbai traffic, so keep the weights low and do not add all of them: the traffic batches
grow with every type (Low tier loads 12 types, Medium 24). Prefer amaze, i20, brio, hector, elantra, sonata, ix35, kona.
Five came out with **no paint part** (`2013_wuling_hongguang_s`, `2022_kia_ev6_gt-line`, `kia_carnival`, `mg_hector`,
`suzuki_grand_vitara`): leave them out of `VERIFIED` unless `classify()` is improved.
`2013_toyota_land_cruiser_prado` matched its Sketchfab model by title only (triangle count differs by 6 %): check the
credit line is right before using it.

Left out for licence: `2021-2023_hyundai_elantra_n` (CC BY-NC), `2024-hyundai-elantra-n` (CC BY-NC-SA),
`2024_hyundai_ioniq_5_n` (CC BY-NC). The game allows only CC0 and CC BY.
