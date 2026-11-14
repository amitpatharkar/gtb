# GTB improvement plan (from 2026-11-13)

Goal (owner): "Mumbai as it is" — a believable, playable Mumbai in the browser, GTA-style but family-friendly
(no blood, comedy over violence), everything free. First make the existing game solid and realistic, then add
content: missions, quests, easter eggs and Bollywood homage.

Built from five reviews (full reports in `docs/research/`):
- `code-audit-2026-11.md` — gameplay, logic, physics, performance (file:line references)
- `graphics-loading-audit-2026-11.md` — realism at street level, loading, measured MB and draw calls per tier
- `vehicles-assets-2026-11.md` — Mumbai traffic mix, real car sizes and parody names, free assets, physics engines
- `map-growth-2026-11.md` — growing the map to Bandra/Juhu/Powai, landmarks found in OpenStreetMap, local trains
- `mumbai-guide-2.md` — 60 famous places (with interiors), daily life, festivals, 20 Bollywood-homage missions, slang

## Rules that came out of the research
- Rename real brands: the ride app is **Kidhar** (Chalo is BEST's real app). Never use "Jhakaas" or "Bhidu"
  (protected catchphrases). No real celebrity names, faces or voices: fictional stars only, with original house
  designs and altered house names (never "Mannat", "Jalsa", "Antilia" — OpenStreetMap carries those names).
- Never reference the 2008 attacks, riots or gangsters; never mock poverty (Dharavi is a place of work and pride).
- Avoid Mixamo (no redistribution) and any non-commercial or share-alike licence.

Effort: S small, M medium, L large. ✅ done · 🟡 in progress · ⬜ to do.

## Phase 1 — Fix the foundation
| # | Item | Effort | Status |
|---|---|---|---|
| 1.1 | Crash and freeze bugs: night baraat crash, mission reload freeze (story re-enters the saved step), fines free on foot, hawaldar dialog lock and double choice boxes, traffic/patrols driving through the parked taxi, radio note pile-up and sound while paused, stuck keys after Alt-Tab, HUD says F for fuel, road name on foot, patrol GPU leak, duplicate fade | S | ✅ |
| 1.2 | Economy: Mumbai tariff ₹33 + ₹22/km, ~300 km per tank, braking comfort only for emergency stops | S | ✅ |
| 1.3 | Save everything that matters: taxi position, fuel, condition, clock, wanted stars and fines, orders on their way ✅; R = ₹300 tow (free near the Gateway, on credit if broke) that puts you back in the taxi ✅. Still to do: consequences for rent/hunger/energy; mission retry checkpoints | S–M | 🟡 |
| 1.4 | Driving physics: slide along walls (contact normal by probing free space), sub-steps, no turning into walls, push-out when overlapping, impact = speed into the wall; 2D rigid-body car (velocity separate from heading, tyre grip, Space = handbrake drift). Mass pushes with NPC cars and people knocked down (hit-and-run) ✅ (R2) | M | ✅ |
| 1.5 | Physics engine: keep custom car physics; add Rapier 0.19.3 (≈0.8 MB, lazily after the city appears) for debris, thelas, bins, garbage and "ragdoll-lite" knock-downs | M | ⬜ |
| 1.6 | Loading: map index, manifest and sky prefetched during the title screen; texture downloads gated until sky + nearby tiles are in; characters, street-prop models and sign fonts load after play starts; shaders compiled during the loading screen (`compileAsync`). Low at 20 Mbps: playable at 5.3 s after ~6.5 MB (was 18.9 MB before play). Still to do: service worker cache | S | 🟡 |
| 1.7 | Download size: Poly Haven AC model dropped (−1.2M triangles, −7 MB; facade ACs stay procedural) ✅; still to do: simplify trash bag, KTX2 + meshopt for every glTF in the pipeline (models 34 → ~6 MB on High), re-encode normal maps (High back under 45 MB), subset fonts, mono ambience | S–M | ⬜ |
| 1.8 | Per-frame performance: incremental road graphs with numeric keys ✅, map/GPS from a small overview file in a worker ✅ (3.1); in progress (review 2026-11-14): numeric tile lookups, fewer allocations per step, throttled HTML writes | M | 🟡 |
| 1.9 | Developer cheat console (` key) | S | ✅ |

## Owner requests added 2026-11-13 (evening)
| # | Item | Effort | Status |
|---|---|---|---|
| R1 | Steal and drive any vehicle (traffic, parked or one you left): F on foot next to it; driver pulled out and fights, throws things or runs; ₹5,000 theft challan if a constable sees; per-type top speed, acceleration, size and weight (BEST double-decker to scooter); the kaali-peeli stays where you left it (F next to it to return; R tows you back to it); taxi duty only in the taxi | M | ✅ |
| R2 | Collision physics: momentum exchange by mass (scooter 110 kg … bus 11 t): parked cars are shoved, spin and stay moved; traffic cars are knocked aside, brake, then steer back; two-wheelers fall over and riders come off; people jump clear at a crawl and are knocked down at speed (they get up; hit-and-run if seen) | M | ✅ |
| R3 | Fist fights: left-right-heavy punch combo, kick finisher after two punches, block with right mouse (1/5 damage, no knock-back), opponents wind up before they swing and are interrupted when hit, flinch and guard animations on the real characters, knockouts (lie flat, then limp away), opponent bar on the HUD, red flash when hit, bystanders stop to watch and comment, a long fight can draw in the opponent's friend | M | ✅ |
| R5 | Firecrackers (`crackers.js`): on foot X lights one, Z changes type — anar fountain, chakri spinner, ladi string, sutli bomb (people flinch, car alarms chirp), sky shot (peony, ring, willow, glitter shells); the city lights its own on evenings (sky shots over the rooftops, people lighting anars on the footpath); ₹500 challan after 10 pm if a constable sees | M | ✅ |
| R6 | Character bugs: feet in the ground (leg-bone scaling removed; height and foot level measured from the animated poses) ✅; running (longer stride, faster cadence, upper-body lean) ✅; old procedural figures (one draw call per character → 11/20/30 real characters within 34–46 m, incl. police with caps, seated and knocked-down people) ✅. Still procedural: far crowd, riders on NPC bikes, cricket poses | M | ✅ |
| R7 | Adult characters and body builds: the pack's child proportions rebuilt on the skeleton (legs ×1.45 with re-baked foot and pelvis animation, head ×0.56, shorter torso, wider shoulders, longer arms); builds slim, average, fit (player), muscular, heavy, stocky, lanky, kid; men 1.73 m, women 1.6 m | M | ✅ |
| R8 | Name: the game is "Bombay Bawaal" (`src/brand.js`); GTB stays as the code name, web address and save keys | S | ✅ |
| R9 | Sun glare: the sky photo's sun disk is capped, so facing the sun no longer whites out the screen with bloom on Medium/High | S | ✅ |
| R4 | Better rendering: continues in Phase 2 (lighting ✅, window depth ✅, facades, clutter, people) | — | 🟡 |

## Phase 2 — Look and feel of Mumbai at street level
| # | Item | Effort | Status |
|---|---|---|---|
| 2.1 | Indian traffic: lofted bodies at real sizes (Alto, WagonR, Swift, i10, Dzire, City, Ertiga, Innova, Bolero, Creta, Eeco, today's WagonR/Santro kaali-peelis, white app cabs with yellow plates, Cool Cab, vintage Padmini, BEST bus + electric double-decker, Tata Ace, 407 tempo, Activa, delivery scooter, Splendor, Bullet), one BatchedMesh per part, far LOD | M | ✅ first pass |
| 2.2 | More vehicles: auto-rickshaws (black with a yellow hood, khaki driver, passengers on the bench; only north of the Bandra–Sion line, where they are about a third of the traffic and the kaali-peelis thin out), water tankers, municipal garbage trucks, ambulances (Eeco), yellow school buses, bicycles and dabbawala cycles (riders pedal; traffic overtakes them) ✅ — all can be taken and driven. Auto duty for the player ✅: J in an auto takes fares at auto-meter rates (₹26 for 1.5 km, then ₹17 a km), destinations stay in the suburbs, the passenger sits on the bench; driving an auto into town is a ₹500 challan if a constable sees it. Still to do: police Scorpio in ambient traffic, handcarts | M | 🟡 |
| 2.3 | Street edge: kerb paint only along main roads (plain concrete kerbs elsewhere) ✅; grey broken lanes instead of brown mud ✅; sharper ground on Low (anisotropy 8) ✅. parked cars nose-to-tail and angled rows of scooters/bikes along streets ≥ 9 m wide, seeded per segment (same cars when you return), solid, drawn in the traffic batches ✅. Still to do: compound walls, gates and watchmen on plastic chairs | M | 🟡 |
| 2.4 | Light and colour: Neutral tone mapping (true cream/white walls, cleaner shade), grey concrete bounce instead of brown, more shade fill by day ✅; nights: lamp lights 90→30, window tube lights halved, landmark floodlights fade upwards and keep their texture, less flat night fill ✅. Still to do: HDRIs per time of day; painted light pools instead of point lights | S–M | 🟡 |
| 2.5 | Facades: window depth in the shader (glass recessed 0.18 m with lit sill and shaded reveals, on every tier) ✅; still to do: per-window types (sliders, louvres, box grilles, enclosed balconies), Art Deco curves and eyebrow fins on Marine Drive, Gothic gables in Fort, chawl galleries; real heights from Google Open Buildings 2.5D; shop/room atlas behind windows | M–L | 🟡 |
| 2.6 | Clutter: rooftop hoardings ✅ — boards on steel posts over the street-facing wall of about one mid-rise building in eight (more on shopping streets), 30 parody ads on one canvas atlas (the game's own apps, fictional films and stars, cement, coaching classes, builders, public-interest boards), floodlit at night; still to do: roadside unipoles, cable bundles, awnings and tarps, blue street-name boards, drain pipes, stains | M | 🟡 |
| 2.7 | People: realistic CC0 bodies (Quaternius Universal Base Characters + Universal Animation Library; owner uploads the zip to a GitHub Release), Indian clothes (sari, salwar-kurta, lungi, school uniform, Koli nauvari), varied faces and hair; behaviour by district and hour Full-length trousers and shoes on adults instead of the pack's shorts and bare feet ✅. Saris with a border and pallu on most nearby women ✅. | M–L | 🟡 chibi pack in, proportions fixed |
| 2.8 | Taxi polish: clear-coat reflections, tail lamps, chrome bumpers, interior through the rear glass | S–M | ⬜ |
| 2.9 | Far skyline ✅: the converter writes the 17,206 buildings of 15 m and more as oriented boxes (`skyline.bin.gz`, 133 KB); the game draws those within 2.6–4.2 km whose tile is not loaded as one instanced mesh, with haze that matches real tiles at the load radius and thins out beyond, and lit windows at night. Still to do: Queen's Necklace street lights from afar, far ground colour | M | 🟡 |
| 2.10 | Street library ✅ (owner's survey, `docs/research/street-library/`, `scripts/lib/streetLibrary.mjs`): 847 South Mumbai streets → 25 profiles; 2,276 road pieces dressed by their profile — kerb paint (black-white on Marine Drive, Causeway and boulevards, black-yellow on bazaar streets, plain on lanes), black-white median kerbs, tree density and species, lamp type (standard, tall, heritage triple lantern, globe; median lamps on planted boulevards), kerb parking pressure; 6,959 untagged buildings take storeys, style, colours and shops from their street, 286 under green construction netting; five new districts. Still to do: planted medians, Fort arcades, corrugated site hoardings, notable buildings, stalls/crowds/sounds by profile at runtime | M | 🟡 |
| 2.11 | Dense districts filled in ✅ (`scripts/lib/infill.mjs`): OpenStreetMap misses many outlines in Kalbadevi, Bhendi Bazaar, Girgaon, Dharavi, Kurla… (50–74 % of those blocks were bare concrete); empty frontage now gets rows of buildings in the district's grain (71,014 added, 54k → 125k buildings; tiles 9.3 → 10.3 MB; +11 % triangles, +3 draw calls). Still to do: back lots inside big blocks, Google Open Buildings outlines (CC BY 4.0) where free | M | ✅ |

## Phase 3 — The city grows
| # | Item | Effort | Status |
|---|---|---|---|
| 3.1 | Converter: fixed origin (Mahim, `--origin`), ground UVs wrapped every 1,872 m, overview file (0.5 MB) for the map and GPS with routing in a Web Worker (no step cap; Gateway → Powai 26.7 km), elevated metro/monorail skipped, landmark distance limit, racecourse as grass, 30 district guides from Haji Ali to Hiranandani, airport runways/aprons, private house names blanked | M | ✅ |
| 3.2 | Shipped: the island city + Bandra, Juhu, Andheri, Kurla and Powai (`--bbox 18.890,72.795,19.140,72.920`: 979 tiles, 9.2 MB, streamed — load at the spawn unchanged, ~75 KB on Low); new map labels and taxi destinations; "GPS route home" in the Ghar app. Known gaps: bridges/Sea Link at ground level (3.3), tetrapods on lake shores, sparse Dharavi outlines, converter now ~55 s per build | S after 3.1 | ✅ |
| 3.3 | Flyovers and bridges (~170 km: Sea Link, Coastal Road + tunnels, Eastern Freeway, JJ, Kemps Corner …) | L | ⬜ |
| 3.4 | Local trains ✅ (`scripts/lib/trains.mjs` → `tiles/trains.json`, `src/sim/trains.js`): Western (Churchgate–Jogeshwari), Central (Chhatrapati Chai Terminus–Ghatkopar) and Harbour lines on the real tracks, 12 lines, 270 km, 40 stations; timetable by the game clock, rakes turn round at the termini; tickets at the station window (E, ₹5–20), ride by fade (about 2.3 game minutes per station); solid and far heavier than cars; level crossings with waiting traffic and people; buildings over the tracks raised (platform roofs, footbridge offices); horn, rumble, clack. Still to do: raised platforms and edges, crossing barriers, ride view from inside, interchange tickets, Metro 3 underground fast travel | M–L | 🟡 |

## Phase 4 — Famous Mumbai: landmarks, interiors, life
| # | Item | Effort | Status |
|---|---|---|---|
| 4.1 | Interior system ✅ (`src/world/interiors.js` + `interiors/kit.js`): glowing street doors (E), a fade, rooms built on first entry far off the map and drawn alone on their own camera layer, room collisions and camera, indoor lighting, things to use (E), the city keeps running around the door (`interiors.anchor`); vehicles, weapons and crackers are disabled indoors | M | ✅ |
| 4.2 | Interiors ✅ first four: Chhatrapati Chai Terminus (star-vaulted booking hall, ticket windows, concourse with indicator boards on the game clock, train shed with a local; platform ticket, weighing machine, chai), Royal Chaj Mahal Palace (lobby, grand staircase, Sea Lounge with high tea), Khyaali & Co. Irani café (bun maska and chai), flat 1204 in Powai (sleep till 7 am and save, wardrobe, lake-view balcony). Still to do: Leopard Café, kirana shop, chawl room, police chowki; landmark collision outlines; police and cutscenes while indoors | L | 🟡 |
| 4.3 | Landmarks (hand-built, altered names): Haji Ali with tides, Siddhivinayak, Dhulai Ghat, Wankhede, Mahalaxmi racecourse, Bandstand, Mount Mary, Sea Link, Juhu, Old Woman's Shoe, Mahaan Mandir talkies | L | ⬜ |
| 4.4 | Superstar fan meets (`stars.js`): fictional Armaan Raizada, "the Badshah of Romance", at villa "Khwaab" on the Bandra seafront (out daily at 11 am and 5 pm) and fictional Vikram Oberoi, "the Legend", at bungalow "Sangam" in Juhu (Sundays ~5 pm = every 7th game day): gate, platform, fans and constables, cheering, sky shots at night, a cutscene when you drive up, a gift the first time, ★ on the map, cheat DARSHAN. Original designs, no real names or likeness. Still to do: birthday mega-crowd, cake-delivery mission | M | ✅ |
| 4.5 | Event calendar: Ganesh visarjan at Chowpatty, Dahi Handi pyramids, Navratri, Diwali lanterns, Holi, Christmas in Bandra, Ramzan nights on Mohammed Ali Road, Mumbai Marathon; traffic diversions | M | ⬜ |
| 4.6 | Monsoon: rain, wet roads, waterlogging at Hindmata/Milan subway when rain meets high tide, umbrellas, waves over Marine Drive | M | ⬜ |
| 4.7 | Daily life: dabbawala lunch rush, film shoots blocking roads, Koli fish market at dawn, maidan cricket, hawkers, "nahi jaayega" taxi refusals — done so far: pigeon flocks at the Gateway, the kabutarkhanas, stations and seafronts that take off when you come close, kites circling overhead; school buses, dabbawalas, garbage trucks and milk cycles by the clock | M | 🟡 |

## Phase 5 — Missions, quests, easter eggs
| # | Item | Effort | Status |
|---|---|---|---|
| 5.1 | Mission framework v2: script in `missions.js`, engine in `story.js`; story (yellow) and side (blue) strands with several missions on offer at once, givers waiting at the markers, markers on the map; steps: cutscene, drive (with vehicle requirements), passenger, fragile cargo, multi-stop errand, checkpoint race, chase on foot, counters (rides, colour, crackers), hooks into other systems; time limits, retry from the marker, re-entry after a reload; markers and targets snap to the nearest road | M | ✅ |
| 5.2 | Missions: 5 story (Mumbai Meri Jaan, Marine Drive Ki Shaam, Pehli Sawaari, Holi Hai!, Ghar Ka Rasta → Powai) + 9 side: Mere Paas Meter Hai, Galat Dabba, Picture Abhi Baaki Hai, Penguin Ko Pakadna Naamumkin Hai, Hawaldar Khush Hua, Dhoom-Dhaam (bike race), Rangeela Re-Take (bring a Swyft to a film shoot), Romance Ka Badshah (cake to the star's villa), Phatakon Ki Raat; + 5 with a borrowed vehicle (the mission lends it, parked at the kerb with a marker): Auto No. 1 (Salim bhai's auto in Bandra, two fares by the meter, the passenger rides on the bench), Jal Bin Society (water tanker to three Juhu societies without sloshing), Dadi Bhai M.B.B.S. (ambulance from Shivaji Park to Parel, gently), Taare Bus Stop Par (school bus round in Matunga before the bell, mornings), Doodhwala Express (milk round on a bicycle in Girgaon, dawn). Then: Permit Raj (story, after reaching Powai: get the taxi to the RTO in good condition and pay the permit fee — the new `pay` step waits until you can afford it), BEST Of Luck (drive a full BEST bus on its route) and Bombay Darshan (a double-decker tour to Hanging Gardens for the sunset). All 22 play through in the headless test. Next: more ideas in `mumbai-guide-2.md` §3 | L | 🟡 |
| 5.3 | Side jobs: dabbawala relay, BEST bus driver, tour guide, stunt driver and junior artist at Filmy City, Bhookh delivery (exists) | M | ⬜ |
| 5.4 | Collectibles and easter eggs (`eggs.js`): 32 golden cutting-chai glasses at famous spots across the whole map (₹300 each, ₹4,000 every eighth, ₹25,000 for all; nearby ones show on the map; cheat CHAIPILO shows all); easter eggs: the Powai Lake crocodile, the Old Woman's Shoe, Mahaan Mandir Talkies (one film for 30 years), Sewri flamingos, Seth Dhanraj Tower's guard, a wax taxi at the hilltop church (full repair once a day, ₹50), Gandhigiri roses (G with a rose ends a fight). Still to do: escaped-penguin sightings elsewhere, Elephanta ferry | S each | ✅ |

## Needs the owner (free, a few minutes each)
1. Download "Universal Base Characters" from quaternius.itch.io (CC0, free) and attach the zip to a GitHub Release
   in this repository; the asset pipeline then picks it up (itch.io has no fixed download link).
2. Optional: a free Sketchfab API token as the repository secret `SKETCHFAB_API_TOKEN` unlocks 20 CC-BY models
   (mini truck, Royal Enfield, …) in the asset pipeline.
