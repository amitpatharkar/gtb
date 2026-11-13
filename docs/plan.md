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
| 1.4 | Driving physics: slide along walls (contact normal by probing free space), sub-steps, no turning into walls, push-out when overlapping, impact = speed into the wall; 2D rigid-body car (velocity separate from heading, tyre grip, Space = handbrake drift). Still to do: mass pushes with NPC cars; people as obstacles (knock-down + hit-and-run) | M | 🟡 |
| 1.5 | Physics engine: keep custom car physics; add Rapier 0.19.3 (≈0.8 MB, lazily after the city appears) for debris, thelas, bins, garbage and "ragdoll-lite" knock-downs | M | ⬜ |
| 1.6 | Loading: map index, manifest and sky prefetched during the title screen; texture downloads gated until sky + nearby tiles are in; characters, street-prop models and sign fonts load after play starts; shaders compiled during the loading screen (`compileAsync`). Low at 20 Mbps: playable at 5.3 s after ~6.5 MB (was 18.9 MB before play). Still to do: service worker cache | S | 🟡 |
| 1.7 | Download size: Poly Haven AC model dropped (−1.2M triangles, −7 MB; facade ACs stay procedural) ✅; still to do: simplify trash bag, KTX2 + meshopt for every glTF in the pipeline (models 34 → ~6 MB on High), re-encode normal maps (High back under 45 MB), subset fonts, mono ambience | S–M | ⬜ |
| 1.8 | Per-frame performance: numeric tile lookups (no string keys), prop grid, throttle HTML writes, traffic spatial buckets, incremental road graphs, map/GPS from a small overview file in a worker | M | ⬜ |
| 1.9 | Developer cheat console (` key) | S | ✅ |

## Phase 2 — Look and feel of Mumbai at street level
| # | Item | Effort | Status |
|---|---|---|---|
| 2.1 | Indian traffic: lofted bodies at real sizes (Alto, WagonR, Swift, i10, Dzire, City, Ertiga, Innova, Bolero, Creta, Eeco, today's WagonR/Santro kaali-peelis, white app cabs with yellow plates, Cool Cab, vintage Padmini, BEST bus + electric double-decker, Tata Ace, 407 tempo, Activa, delivery scooter, Splendor, Bullet), one BatchedMesh per part, far LOD | M | ✅ first pass |
| 2.2 | More vehicles: police (white Scorpio N/Bolero, chequered band), BMC garbage compactors (white-blue), water tankers, ambulances (Eeco red cross), handcarts, milk and dabbawala cycles; autos only in the suburbs (black-yellow) | M | ⬜ |
| 2.3 | Street edge: compound walls, gates and watchmen on plastic chairs; parked cars and bikes; kerb paint only on main roads; grey worn lanes (not brown) | M | ⬜ |
| 2.4 | Light and colour: AgX/Neutral tone mapping, cooler sky fill, less contrast in shade; night caps (tube lights, lamps, exposure); HDRIs per time of day; painted light pools instead of many point lights | S–M | ⬜ |
| 2.5 | Facades: window depth in the shader (works on Low), per-window types (sliders, louvres, box grilles, enclosed balconies), Art Deco curves and eyebrow fins on Marine Drive, Gothic gables in Fort, chawl galleries; real heights from Google Open Buildings 2.5D; shop/room atlas behind windows | M–L | ⬜ |
| 2.6 | Clutter: cable bundles, rooftop hoardings with parody ads, awnings and tarps, blue street-name boards, drain pipes, stains | M | ⬜ |
| 2.7 | People: realistic CC0 bodies (Quaternius Universal Base Characters + Universal Animation Library; owner uploads the zip to a GitHub Release), Indian clothes (sari, salwar-kurta, lungi, school uniform, Koli nauvari), varied faces and hair; behaviour by district and hour | M–L | 🟡 chibi pack in, proportions fixed |
| 2.8 | Taxi polish: clear-coat reflections, tail lamps, chrome bumpers, interior through the rear glass | S–M | ⬜ |
| 2.9 | Far skyline stand-ins beyond the load radius; Queen's Necklace lights at night | M | ⬜ |

## Phase 3 — The city grows
| # | Item | Effort | Status |
|---|---|---|---|
| 3.1 | Converter: fixed origin (Mahim), per-tile UV wrapping, overview file (0.6 MB) for map and GPS, skip elevated metro, landmark distance limit, racecourse as grass, district guides north of Byculla, airport runways | M | ⬜ |
| 3.2 | Ship the island city + Bandra, Juhu, Andheri and Powai (`--bbox 18.890,72.795,19.140,72.920`: 1,007 tiles, 9.5 MB, streamed — per-player load unchanged) | S after 3.1 | ⬜ |
| 3.3 | Flyovers and bridges (~170 km: Sea Link, Coastal Road + tunnels, Eastern Freeway, JJ, Kemps Corner …) | L | ⬜ |
| 3.4 | Local trains on the OSM route relations (Western/Central/Harbour, 46 stations with platforms), timetable by game clock, ride by fade; Metro 3 underground fast travel | M–L | ⬜ |

## Phase 4 — Famous Mumbai: landmarks, interiors, life
| # | Item | Effort | Status |
|---|---|---|---|
| 4.1 | Interior system: exterior/interior "spaces", door triggers with a fade, ambient systems paused inside, procedural rooms | M | ⬜ |
| 4.2 | Interiors: CSMT Star Chamber booking hall + concourse; Royal Chaj Mahal Palace lobby, grand staircase, Sea Lounge; Irani café (reusable); Leopard Café; kirana shop; chawl room; the Powai flat | L | ⬜ |
| 4.3 | Landmarks (hand-built, altered names): Haji Ali with tides, Siddhivinayak, Dhulai Ghat, Wankhede, Mahalaxmi racecourse, Bandstand, Mount Mary, Sea Link, Juhu, Old Woman's Shoe, Mahaan Mandir talkies | L | ⬜ |
| 4.4 | Superstar fan meets: the fictional "King of Romance" at his Bandstand villa (birthday crowd) and the fictional "Shahenshah" at his Juhu bungalow (Sunday greeting), with cutscenes; original designs, no real names or likeness | M | ⬜ |
| 4.5 | Event calendar: Ganesh visarjan at Chowpatty, Dahi Handi pyramids, Navratri, Diwali lanterns, Holi, Christmas in Bandra, Ramzan nights on Mohammed Ali Road, Mumbai Marathon; traffic diversions | M | ⬜ |
| 4.6 | Monsoon: rain, wet roads, waterlogging at Hindmata/Milan subway when rain meets high tide, umbrellas, waves over Marine Drive | M | ⬜ |
| 4.7 | Daily life: dabbawala lunch rush, film shoots blocking roads, Koli fish market at dawn, maidan cricket, hawkers, "nahi jaayega" taxi refusals | M | ⬜ |

## Phase 5 — Missions, quests, easter eggs
| # | Item | Effort | Status |
|---|---|---|---|
| 5.1 | Mission framework v2: missions as data, saved step state, checkpoints, trigger volumes, mission-owned characters/vehicles, cutscene timelines | M | ⬜ |
| 5.2 | 20 Bollywood-homage missions (list in `mumbai-guide-2.md` §3: Mere Paas Meter Hai, Galat Dabba, Picture Abhi Baaki Hai, Penguin Ko Pakadna Naamumkin …) | L | ⬜ |
| 5.3 | Side jobs: dabbawala relay, BEST bus driver, tour guide, stunt driver and junior artist at Filmy City, Bhookh delivery (exists) | M | ⬜ |
| 5.4 | Easter eggs: crocodile in Powai Lake, the film that never leaves Mahaan Mandir, escaped penguin, wax taxi at Mount Mary, Gandhigiri calm-down, Old Woman's Shoe | S each | ⬜ |

## Needs the owner (free, a few minutes each)
1. Download "Universal Base Characters" from quaternius.itch.io (CC0, free) and attach the zip to a GitHub Release
   in this repository; the asset pipeline then picks it up (itch.io has no fixed download link).
2. Optional: a free Sketchfab API token as the repository secret `SKETCHFAB_API_TOKEN` unlocks 20 CC-BY models
   (mini truck, Royal Enfield, …) in the asset pipeline.
