# Art requests: models made with free online tools

The owner makes these with free web tools (by hand or with Claude in Chrome) and uploads
them to `public/art/models/`. **The game picks them up by file name, with no code change:**
the build lists the folder (`scripts/art-index.mjs`) and `src/world/art.js` uses each file
near the player — food carts stand in for the simple thela models, the shelter for the bus
stops, and the small props are scattered around stalls, garbage spots and junctions.

## Tools (free)

| Step | Site | Licence of what you make |
|---|---|---|
| 1. Picture of the object | FLUX.1 [schnell] on Hugging Face: https://huggingface.co/spaces/black-forest-labs/FLUX.1-schnell | Apache-2.0 model; images free to use |
| 2. Picture → 3D model (.glb) | TRELLIS (Microsoft) on Hugging Face: https://huggingface.co/spaces/JeffreyXiang/TRELLIS (or search Hugging Face for "TRELLIS") | MIT model; models free to use |
| Alternative for step 2 | Meshy free plan: https://www.meshy.ai (image or text to 3D) | Free-plan models are shared under CC BY 4.0 (credit needed) — check the page before using |

A free Hugging Face account gives a daily GPU allowance. If a site shows different terms,
stop and ask before using its output.

## Upload

1. https://github.com/amitpatharkar/gtb/tree/main/public/art/models → **Add file → Upload files**.
2. Drop the `.glb` (exact name from the list below), commit message `Art: add <name>.glb`,
   **Commit directly to the main branch**.
3. https://github.com/amitpatharkar/gtb/edit/main/public/art/CREDITS.md → add one line, e.g.
   `- models/vada-pav-cart.glb — picture: FLUX.1 [schnell] (Apache-2.0); 3D: TRELLIS (MIT) — 2026-11-14` → commit.
4. The site redeploys by itself in about two minutes.

Keep each file under 8 MB (in TRELLIS: simplify 0.95, texture size 1024; use 512 if bigger). The build
makes a light copy of every upload by itself (about 5,000 triangles for carts and the shelter, 900 for small
props, 512-pixel texture, smooth normals), so there is no need to simplify further by hand.
Browser extensions usually cannot open the computer's file picker: if the upload page asks
for a file, drag the downloaded `.glb` onto it yourself.

## The list (file name — height in game — picture prompt)

Every picture prompt ends with the same style line:
*"Single object, centred, whole object in view from a three-quarter front angle, plain white
background, soft even studio lighting, realistic photo, no people, no text, no logos, no brand names."*

1. `vada-pav-cart.glb` — 2.3 m — A Mumbai street-food handcart selling vada pav: wooden cart on two bicycle-style wheels with a steel counter, a big black iron kadhai on a small gas stove, a steel tray stacked with pav buns, small bowls of green chutney, a faded multicoloured beach umbrella on a pole above it, worn and well used.
2. `chai-tapri.glb` — 2.3 m — A tiny Mumbai roadside tea stall: a narrow booth of tin sheets and plywood about 1.5 m wide with a counter, a steel kettle on a single gas burner, rows of small glass tea cups, glass jars of biscuits, a faded blue tarpaulin sheet as roof, weathered paint.
3. `coconut-cart.glb` — 1.5 m — A tender-coconut seller's handcart from Mumbai: flat wooden cart on two wheels piled high with green tender coconuts, a few cut coconut shells in a basket, no knives.
4. `sugarcane-juice-cart.glb` — 2.1 m — An Indian sugarcane-juice cart: a wheeled cart carrying a steel juice-crushing machine with a big flywheel painted green, bundles of sugarcane stalks leaning on it, small brass bells on top, steel glasses on the counter.
5. `fruit-cart.glb` — 1.6 m — A Mumbai fruit seller's handcart: wooden cart on two wheels with neat pyramids of bananas, oranges, apples and papayas on a green cloth, a hand-held weighing scale hanging on a hook.
6. `bus-shelter.glb` — 2.7 m — A typical Mumbai city bus stop shelter: grey-painted steel frame, a curved red-and-silver metal roof about 5 m long, a long steel bench, an empty route-board panel, a little dusty.
7. `plastic-stool.glb` — 0.45 m — A cheap red plastic stool with a round seat and four legs, as used at Indian street-food stalls, slightly scuffed.
8. `lpg-cylinder.glb` — 0.85 m — A red domestic cooking-gas cylinder as used in India, with a black regulator on top, slightly scuffed.
9. `milk-can.glb` — 0.6 m — A large aluminium milk can with a lid and a handle, dented and scratched, as used by Indian milkmen.
10. `handcart.glb` — 1.0 m — An Indian wooden handcart: a flat wooden platform on two large spoked wheels with long wooden handles, carrying a few jute sacks.
11. `community-dustbin.glb` — 1.25 m — A large dark-green plastic municipal dustbin on wheels with a hinged lid, about 1.2 m tall, a bit dirty.
12. `police-barricade.glb` — 1.1 m — A yellow-and-black striped metal traffic barricade used on Indian roads, about 2 m wide on two feet, slightly rusty.

Notes: the side facing the camera in the picture becomes the front; carts are turned to
face the street automatically. Ask Claude Code to adjust a model's size or facing if it
looks wrong in the game (`ART` table in `src/world/art.js`).

## Vehicles (free models, credited)

Free vehicle models (for example from Sketchfab, downloaded as "Autoconverted format (glb)")
go in `public/art/vehicles/`, named after the game's vehicle type: `alto`, `wagonr`, `swift`,
`i10`, `dzire`, `city`, `ertiga`, `innova`, `bolero`, `creta`, `eeco`, `padmini`, `bus`, `ace`,
`tempo`, `scooter`, `bike`, `bullet`, `auto`, `cycle` replace that type's close-up body; new
types: `ambassador`, `m800`, `omni`, `nano`, `indica`, `scorpio`, `thar`, `sumo`, `santro`
(parody names in `src/vehicles/vehicleModels.js`). Only CC0 or CC BY (Attribution) licences;
one credit line per file in `public/art/CREDITS.md` (title, author, link, licence).

The build (`scripts/art-vehicles.mjs`) turns each file into the fleet's four parts (paint
tinted per car, glass, trim, lamps) with a far version: it drops the model's textures (no real
badges, logos or number plates), keeps the colours, stands it on its wheels, turns it to face
forward, scales it to the real length and slims it to about 6,500 triangles (800 far away).
If one comes out facing backwards, set `flip: true` for it in `vehicleModels.js`.

