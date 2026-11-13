# Mumbai street guide for GTB

Research notes for making GTB look and feel like real Mumbai at street level. Compiled 2026-11-13.

**How to use:** coordinates are WGS84 lat/lon. Bounding boxes are `[south, west, north, east]` and are deliberately rough (good enough to pick a style zone per OSM building). Colours are suggestions sampled by eye from typical street scenes — vary them ±10 % per building and add dirt/monsoon streaks. All references are **links only** (Wikipedia, Google Street View, Mapillary); no photos were copied.

Street View link format used below: `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=LAT,LON` (opens the nearest panorama). Mapillary format: `https://www.mapillary.com/app/?lat=LAT&lng=LON&z=17`.

---

## 0. The five things that make a street read as "Mumbai"

1. **Black-and-yellow everything at ground level** — kerbs painted in alternating black/yellow stripes, kaali-peeli taxis, auto hoods (suburbs), road dividers, police barricades.
2. **Grey interlocking paver-block footpaths** (zig-zag "I-shape" pavers) with a high kerb (~20–30 cm), broken in places, with trees growing through.
3. **Facade clutter** — window AC units, rusty window grilles/"boxes", clothes drying, blue tarpaulins over roofs and balconies during monsoon, black water stains running down from every ledge.
4. **Overhead and wall-mounted chaos** — shop signs in Devanagari + Latin (often Gujarati/Urdu too), cable bundles, hoardings on rooftops, and dense ground-floor shops with rolling shutters.
5. **Haze** — warm, slightly brown-grey haze in the distance (visibility 2–5 km in dry season), soft shadows, sea-breeze palms on the western edge.

---

## A. Districts

### A1. South Mumbai (island city, detailed)

#### Colaba
- **BBox:** [18.895, 72.805, 18.925, 72.835]
- **Character:** Tourist + military + old residential tip of the island. Colaba Causeway is a dense arcaded shopping street with pavement stalls; side lanes are quiet, tree-shaded, with 1930s–50s apartment blocks.
- **Architecture:** Victorian/Edwardian arcaded blocks on the Causeway; Art Deco and 1950s modernist apartments; Navy Nagar barracks at the southern tip.
- **Storeys:** 3–6 (Causeway), 5–8 (lanes), towers up to 20+ at the edges.
- **Wall colours:** `#E8DCC0` (cream), `#D9C9A3` (buff), `#C9B48A` (old yellow), `#F1EDE4` (off-white), `#B8B1A3` (grey stucco), `#9A6B4E` (wood/brown trim).
- **Materials:** lime plaster on brick, some exposed basalt plinths, teak balconies and louvred shutters, cast-iron railings.
- **Roofs:** flat terraces with water tanks; some sloping Mangalore-tile roofs on older blocks; rooftop hoardings.
- **Ground floor:** colonnaded arcade (verandah) with shops behind — clothes, cafés (Irani style), jewellery, tourist trinkets; pavement stalls under the arcade selling bags, shoes, sunglasses; metal rolling shutters, painted signboards in English.
- **Footpath & kerb:** arcade floor = worn stone/tiles; outside: grey paver blocks; black-yellow kerb on main roads.
- **Trees:** rain trees, gulmohar, Indian almond, coconut palms near the seafront.
- **Clutter:** stall racks, tourists, tied-up stray dogs, parked taxis, motorbikes in rows, BEST bus stops.
- **People & vehicles:** tourists, backpackers, navy personnel, street sellers; taxis (no autos), BEST buses, private cars, motorbikes.
- **Sounds:** traffic + horns, hawker calls ("le lo, le lo"), crows, café chatter.
- **Refs:** [Wikipedia: Colaba](https://en.wikipedia.org/wiki/Colaba) · [Street View Colaba Causeway](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9200,72.8316) · [Mapillary](https://www.mapillary.com/app/?lat=18.9180&lng=72.8290&z=17)

#### Apollo Bunder
- **BBox:** [18.918, 72.830, 18.926, 72.838]
- **Character:** Waterfront plaza around the Gateway of India and the Taj hotel; huge crowds, ferry jetties, pigeons, balloon sellers. Wide stone promenade facing the harbour.
- **Architecture:** Indo-Saracenic (Gateway, Taj), Edwardian hotels and clubs (Radio Club), modern Taj tower.
- **Storeys:** 4–7; Taj tower ~20.
- **Wall colours:** `#D8B98A` (yellow basalt), `#C9A06B` (sandstone), `#E9E2D3` (white), `#8E3B2E` (Taj red dome tiles), `#6E7A80` (grey stone).
- **Materials:** yellow basalt, reinforced concrete, red tiles, cast iron lamp posts.
- **Roofs:** domes, flat roofs.
- **Ground floor:** ticket booths for ferries (Elephanta), hotel entrances, few shops.
- **Footpath & kerb:** large stone/concrete slabs, low sea wall with railings; security barricades.
- **Trees:** few — some palms and rain trees along the road.
- **Clutter:** police barricades and metal detectors, photographers with printers, balloon/peanut sellers, horse carriages (historically, now banned), ferry boats bobbing.
- **People & vehicles:** tourists, families, photographers, police; taxis, tourist buses.
- **Sounds:** sea lapping, ferry engines and horns, crowd murmur, pigeons, vendor calls.
- **Refs:** [Wikipedia: Apollo Bunder](https://en.wikipedia.org/wiki/Apollo_Bunder) · [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9218,72.8340) · [Mapillary](https://www.mapillary.com/app/?lat=18.9218&lng=72.8340&z=17)

#### Cuffe Parade
- **BBox:** [18.905, 72.812, 18.920, 72.826]
- **Character:** 1970s reclaimed land: tall residential towers and the World Trade Centre, next to the Machimar Nagar fishing village and slums on the seafront.
- **Architecture:** 1970s–90s concrete towers, glass office towers; fishing-village shacks.
- **Storeys:** towers 15–30; slums 1–3.
- **Wall colours:** `#E6E1D6`, `#CFC7B8`, `#9FA4A8` (stained concrete), `#7B8C99` (blue-grey glass), slum: `#3E7CB1` (blue tarp), `#B5462E` (rust).
- **Materials:** RCC with painted plaster, glass curtain walls; slums: corrugated sheet, tarpaulin, brick.
- **Roofs:** flat with water tanks / tarpaulin and tin sheets on shacks.
- **Ground floor:** compound walls with security cabins; few shops; fish drying racks in the village.
- **Footpath & kerb:** wide paver footpaths, black-yellow kerbs, compound walls.
- **Trees:** rain trees, ashoka (tall narrow), palms.
- **Clutter:** parked cars along compound walls, drivers waiting, fishing boats, nets.
- **People & vehicles:** office workers, drivers, fisherfolk (Koli community), joggers; cars, taxis, BEST buses.
- **Sounds:** traffic, seagulls/crows, boat engines.
- **Refs:** [Wikipedia: Cuffe Parade](https://en.wikipedia.org/wiki/Cuffe_Parade) · [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9125,72.8195) · [Mapillary](https://www.mapillary.com/app/?lat=18.9125&lng=72.8195&z=17)

#### Nariman Point
- **BBox:** [18.920, 72.818, 18.930, 72.826]
- **Character:** 1970s business district at the southern end of Marine Drive: tall office slabs, NCPA arts centre, wide roads, very quiet at night.
- **Architecture:** brutalist / international-style office towers, NCPA modernist halls.
- **Storeys:** 15–30.
- **Wall colours:** `#D6D2C8`, `#B9B4A9`, `#8C8F91`, `#5C6C78` (tinted glass), `#C7A66E` (NCPA warm stone).
- **Materials:** concrete, glass, granite cladding.
- **Roofs:** flat with antennae and signboards (company names on top).
- **Ground floor:** lobbies, banks, a few food stalls on the pavement at lunchtime.
- **Footpath & kerb:** wide paver footpaths, black-yellow kerbs, tetrapods along the sea edge.
- **Trees:** coconut palms, rain trees, peltophorum (yellow flowers).
- **Clutter:** office cars, drivers sitting on parapets, sandwich/chai stalls, security booths.
- **People & vehicles:** office crowds 9–6, then empty; cars, taxis, BEST buses.
- **Sounds:** waves, traffic during the day, quiet at night.
- **Refs:** [Wikipedia: Nariman Point](https://en.wikipedia.org/wiki/Nariman_Point) · [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9255,72.8228) · [Mapillary](https://www.mapillary.com/app/?lat=18.9255&lng=72.8228&z=17)

#### Churchgate
- **BBox:** [18.929, 72.822, 18.938, 72.830]
- **Character:** Terminus of the Western Railway suburban line; huge commuter waves, Art Deco cinemas and apartment blocks, the green maidans (Oval, Cross, Azad) to the east.
- **Architecture:** Art Deco (Eros, residential blocks), Indo-Saracenic (WR HQ), 1960s offices.
- **Storeys:** 4–7.
- **Wall colours:** `#EDE3CD` (Deco cream), `#D9C6A0`, `#C27B5A` (Agra red sandstone trim), `#F3EFE6`, `#7FA39A` (faded green).
- **Materials:** cement plaster with Deco reliefs, red sandstone accents, terrazzo.
- **Roofs:** flat with parapets and corner towers.
- **Ground floor:** restaurants, bookshops, banks, fast-food stalls; English signs dominate.
- **Footpath & kerb:** paver footpaths, subway (underpass) entrances, black-yellow kerbs, railings to channel commuters.
- **Trees:** rain trees, gulmohar along the maidans.
- **Clutter:** dense pedestrian streams, shoe-shine boys, newspaper stalls, taxi queues.
- **People & vehicles:** office commuters, college students; taxis, BEST buses.
- **Sounds:** train arrival/departure, station announcements, footsteps, horns.
- **Refs:** [Wikipedia: Churchgate](https://en.wikipedia.org/wiki/Churchgate) · [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9343,72.8265) · [Mapillary](https://www.mapillary.com/app/?lat=18.9343&lng=72.8265&z=17)

#### Marine Drive
- **BBox:** [18.928, 72.818, 18.955, 72.826] (a 3.6 km curve, "Queen's Necklace")
- **Character:** Sweeping 8-lane seafront boulevard with a continuous promenade, sea wall and tetrapods; a single row of Art Deco apartment blocks facing the sea.
- **Architecture:** Art Deco (1930s–40s) — streamlined curved corners, horizontal bands, "eyebrow" sunshades, ship-like balconies, stepped parapets, name plaques in Deco fonts.
- **Storeys:** 4–7 (uniform skyline ~20–25 m).
- **Wall colours:** `#F2EAD8` (cream), `#E7D7B6` (sand), `#E3C6A6` (peach), `#D6DDD9` (pale grey-green), `#CBB596` (stone), `#9C7B5B` (window frames).
- **Materials:** cement plaster, terrazzo, steel windows, wrought-iron railings with Deco patterns.
- **Roofs:** flat terraces, rooftop name boards, corner towers with flagpoles.
- **Ground floor:** mostly residential entrances and a few clubs/hotels; very few shops.
- **Footpath & kerb:** ~10 m wide promenade, grey concrete slabs, low sea-wall parapet (≈0.6 m high, ~0.6 m wide) where people sit; tetrapods (concrete 4-legged blocks) on the sea side; street lights in a continuous curve (the "necklace" at night — warm sodium/now white LED).
- **Trees:** coconut palms on the building side, a few rain trees.
- **Clutter:** joggers, couples on the wall, peanut and bhutta (corn) sellers, few parked cars; no hawker stalls.
- **People & vehicles:** walkers, joggers, couples, tourists; cars, taxis, BEST buses, bikes; fast traffic.
- **Sounds:** waves, wind, traffic, occasional horns, ice-cream cart bells.
- **Refs:** [Wikipedia: Marine Drive](https://en.wikipedia.org/wiki/Marine_Drive,_Mumbai) · [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9440,72.8233) · [UNESCO Victorian & Art Deco Ensemble](https://whc.unesco.org/en/list/1480/)

#### Fort
- **BBox:** [18.928, 72.830, 18.940, 72.840]
- **Character:** Historic CBD inside the old fort walls: Victorian Gothic banks and offices, narrow lanes with old printing presses, Irani cafés and street book stalls.
- **Architecture:** Victorian Gothic Revival (pointed arches, buff stone + blue-grey basalt), Indo-Saracenic, Edwardian neoclassical, Art Deco.
- **Storeys:** 3–6.
- **Wall colours:** `#CDB58A` (buff Kurla stone), `#5E5A55` (dark basalt), `#DCC9A6`, `#B65A3C` (red brick/tiles), `#E7E0D0` (white plaster), `#4F6B5A` (old green shutters).
- **Materials:** buff sandstone, dark basalt rubble, cast iron, teak, Minton floor tiles in arcades.
- **Roofs:** pitched with red tiles or slate, turrets, gables, flat behind parapets.
- **Ground floor:** colonnades with book stalls, stationers, banks, Irani cafés with bentwood chairs; signs in English and Marathi, many old brass/painted boards.
- **Footpath & kerb:** colonnade (arcade) walkways; grey paver footpaths; black-yellow kerb.
- **Trees:** rain trees, peepal growing out of old walls, gulmohar.
- **Clutter:** second-hand book stalls, shoeshine, parked motorbikes, cart pullers, cable bundles.
- **People & vehicles:** office clerks, lawyers, students; taxis, handcarts, BEST buses.
- **Sounds:** horns, office chatter, typewriters/printing (old), crows, temple bells occasionally.
- **Refs:** [Wikipedia: Fort, Mumbai](https://en.wikipedia.org/wiki/Fort,_Mumbai) · [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9338,72.8355) · [Mapillary](https://www.mapillary.com/app/?lat=18.9338&lng=72.8355&z=17)

#### Kala Ghoda
- **BBox:** [18.925, 72.829, 18.931, 72.835]
- **Character:** Art district: museums, galleries, design shops and cafés in restored heritage buildings; very walkable, trees over the streets.
- **Architecture:** Victorian Gothic, Indo-Saracenic (museum), Edwardian.
- **Storeys:** 2–5.
- **Wall colours:** `#D7C29A`, `#5B5752` (basalt), `#E8DFCC`, `#9E3F2D` (brick red), `#2E4A3F` (dark green doors).
- **Materials:** basalt, sandstone, timber, cast iron.
- **Roofs:** pitched tile, domes, turrets.
- **Ground floor:** cafés, boutiques, galleries; neat painted signs.
- **Footpath & kerb:** better-maintained paver footpaths, bollards, some stone paving.
- **Trees:** large rain trees creating a canopy.
- **Clutter:** art installations (Kala Ghoda festival, Feb), parked cars, street-art.
- **People & vehicles:** tourists, artists, office workers; cars, taxis.
- **Sounds:** calmer traffic, café chatter, birds.
- **Refs:** [Wikipedia: Kala Ghoda](https://en.wikipedia.org/wiki/Kala_Ghoda) · [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9280,72.8322) · [Mapillary](https://www.mapillary.com/app/?lat=18.9280&lng=72.8322&z=17)

#### Ballard Estate
- **BBox:** [18.934, 72.838, 18.944, 72.845]
- **Character:** Planned 1910s–20s port business district by the docks: uniform Edwardian neoclassical stone buildings, wide straight streets, quiet.
- **Architecture:** Edwardian neoclassical (George Wittet), uniform cornice lines.
- **Storeys:** 4–5 (uniform height).
- **Wall colours:** `#CBB99A` (Porbandar stone), `#BCA98A`, `#E1D5BF`, `#8A8277` (stained), `#6B5847` (wood).
- **Materials:** dressed stone facades, timber windows.
- **Roofs:** flat behind parapets.
- **Ground floor:** shipping offices, a few eateries; big wooden doors.
- **Footpath & kerb:** wide footpaths, stone kerbs painted black-yellow.
- **Trees:** rain trees, Indian almond.
- **Clutter:** parked cars, port trucks, container trailers near the docks.
- **People & vehicles:** office staff, dock workers; trucks, taxis.
- **Sounds:** port horns, trucks reversing, crows.
- **Refs:** [Wikipedia: Ballard Estate](https://en.wikipedia.org/wiki/Ballard_Estate) · [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9385,72.8410) · [Mapillary](https://www.mapillary.com/app/?lat=18.9385&lng=72.8410&z=17)

#### CST area (Chhatrapati Shivaji Maharaj Terminus)
- **BBox:** [18.937, 72.832, 18.945, 72.840]
- **Character:** Mumbai's busiest junction: the Gothic railway terminus facing the BMC building, endless commuters, the GPO, Azad Maidan to the west.
- **Architecture:** Victorian Gothic Revival + Indo-Saracenic (CSMT, BMC, GPO), 20th-century offices.
- **Storeys:** 3–6 (domes/towers to ~50–80 m).
- **Wall colours:** `#CFB487` (buff stone), `#4E4B47` (blue-grey basalt), `#B05A3B` (red accents), `#E9E2D2`, `#3B5E4A` (green dome copper patina).
- **Materials:** sandstone, basalt, Italian marble details, stained glass, wrought iron.
- **Roofs:** domes, spires, pitched tiled roofs.
- **Ground floor:** station concourse, subway (underground) with shops, food stalls (vada pav).
- **Footpath & kerb:** heavily used paver footpaths, railings, subway entrances, black-yellow kerbs; zebra crossings mostly via underpass.
- **Trees:** few at the junction; rain trees at Azad Maidan.
- **Clutter:** thousands of pedestrians, hawkers selling phone covers, taxis, barricades, police.
- **People & vehicles:** commuters, porters (red shirts), tourists; taxis, BEST buses, cars.
- **Sounds:** station announcements (Marathi/Hindi/English), train horns, crowd roar, horns.
- **Refs:** [Wikipedia: CSMT](https://en.wikipedia.org/wiki/Chhatrapati_Shivaji_Terminus) · [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9403,72.8350) · [Mapillary](https://www.mapillary.com/app/?lat=18.9403&lng=72.8350&z=17)

#### Dhobi Talao
- **BBox:** [18.940, 72.827, 18.947, 72.834]
- **Character:** Old Goan/Parsi/East-Indian neighbourhood near Metro cinema; Irani cafés, old cinemas, narrow streets mixing chawls and colonial blocks.
- **Architecture:** Victorian residential, chawls, Art Deco (Metro Cinema).
- **Storeys:** 3–5.
- **Wall colours:** `#E4D6B8`, `#C9A979`, `#A7C4C0` (faded aqua), `#D58B6A` (terracotta), `#F0EBDF`.
- **Materials:** plaster, timber balconies, Mangalore tiles.
- **Roofs:** sloping tile roofs + flat.
- **Ground floor:** Irani cafés, bakeries, small shops, garages.
- **Footpath & kerb:** narrow pavers, many breaks; parked bikes on footpath.
- **Trees:** occasional rain tree, peepal.
- **Clutter:** handcarts, parked motorbikes, cables.
- **People & vehicles:** residents, students; taxis, bikes.
- **Sounds:** café clatter, horns, church bells.
- **Refs:** [Wikipedia: Dhobitalao](https://en.wikipedia.org/wiki/Dhobitalao) · [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9435,72.8297) · [Mapillary](https://www.mapillary.com/app/?lat=18.9435&lng=72.8297&z=17)

#### Crawford Market
- **BBox:** [18.945, 72.832, 18.951, 72.838]
- **Character:** Wholesale market chaos around the Gothic market hall; fruit, dry fruits, pets, imported goods spilling onto streets; Mohammed Ali Road starts north-east.
- **Architecture:** Norman/Flemish Gothic market hall; dense 4–6 storey commercial blocks.
- **Storeys:** 3–6.
- **Wall colours:** `#C5A97C`, `#7A6A58`, `#D9CBB0`, `#B2552F`, `#5F7F6B`.
- **Materials:** buff + red stone, brick, corrugated iron sheds.
- **Roofs:** pitched tile/sheet, clock tower.
- **Ground floor:** open stalls, wholesale shops with goods stacked outside, gunny sacks, crates.
- **Footpath & kerb:** footpaths fully occupied by goods; vehicles squeeze through.
- **Trees:** few.
- **Clutter:** handcarts, porters carrying loads on heads, crates, tarps, tempos unloading.
- **People & vehicles:** traders, porters (hamaals), shoppers; tempos, handcarts, taxis.
- **Sounds:** bargaining, vendor shouts, carts rattling, horns.
- **Refs:** [Wikipedia: Crawford Market](https://en.wikipedia.org/wiki/Crawford_Market) · [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9474,72.8346) · [Mapillary](https://www.mapillary.com/app/?lat=18.9474&lng=72.8346&z=17)

#### Kalbadevi / Bhuleshwar
- **BBox:** [18.947, 72.824, 18.957, 72.836]
- **Character:** The densest old trading quarter: narrow lanes, Gujarati/Marwari merchants, temples every few metres, cloth and jewellery wholesale (Zaveri Bazaar), flower and puja markets.
- **Architecture:** 19th-century timber-framed merchant houses with carved wooden balconies, chawls.
- **Storeys:** 3–5.
- **Wall colours:** `#E3C58E` (ochre), `#B9D2C7` (mint), `#E7A57D` (salmon), `#F2ECD9`, `#8E5A3C` (carved teak).
- **Materials:** timber frames, plaster, carved wood brackets, tiles.
- **Roofs:** sloping Mangalore tile roofs, many patched with tin and tarps.
- **Ground floor:** tiny shops (2–3 m wide) with gaddi (mattress) seating, open fronts; signs in Gujarati + Devanagari + English, hand-painted boards.
- **Footpath & kerb:** barely any footpath; lanes shared by people, handcarts and bikes.
- **Trees:** almost none (peepal at temples).
- **Clutter:** cables, flower garlands, cows, handcarts, sacks, scooters.
- **People & vehicles:** traders, pilgrims, porters; handcarts, scooters, taxis on bigger roads.
- **Sounds:** temple bells, aarti, bargaining, bicycle bells.
- **Refs:** [Wikipedia: Bhuleshwar](https://en.wikipedia.org/wiki/Bhuleshwar) · [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9510,72.8290) · [Mapillary](https://www.mapillary.com/app/?lat=18.9510&lng=72.8290&z=17)

#### Girgaon
- **BBox:** [18.950, 72.812, 18.960, 72.826]
- **Character:** Old Marathi middle-class heartland: chawls, wadis (lanes) like Khotachiwadi with colourful Portuguese-style cottages, Ganesh festival pandals.
- **Architecture:** chawls (long galleries with rooms off a common corridor), East-Indian/Portuguese cottages, small temples.
- **Storeys:** 2–5 (cottages 2).
- **Wall colours:** `#F2D16B` (yellow), `#8FBF9F` (green), `#6CA0C8` (blue), `#E58F7C` (coral), `#F5F1E6`, `#7A4B2A` (wood balconies).
- **Materials:** plaster on brick, timber balconies/staircases, Mangalore tiles.
- **Roofs:** sloped tile roofs; flat on newer blocks.
- **Ground floor:** small shops, khanavals (eateries), sweet shops, Marathi signboards.
- **Footpath & kerb:** narrow pavers, open gutters on lanes.
- **Trees:** coconut, mango, banana in cottage yards; peepal.
- **Clutter:** clothes on lines, bikes, cables, festival banners.
- **People & vehicles:** families, elders, kids playing cricket; taxis, scooters.
- **Sounds:** pressure-cooker whistles, Marathi radio, kids, temple bells, crows.
- **Refs:** [Wikipedia: Girgaon](https://en.wikipedia.org/wiki/Girgaon) · [Street View Khotachiwadi](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9555,72.8200) · [Mapillary](https://www.mapillary.com/app/?lat=18.9555&lng=72.8200&z=17)

#### Chowpatty (Girgaon Chowpatty)
- **BBox:** [18.951, 72.810, 18.958, 72.818]
- **Character:** City beach at the northern end of Marine Drive: food stalls (bhel puri, pav bhaji, kulfi), evening crowds, Ganesh immersion site.
- **Architecture:** Art Deco blocks behind; temporary stall structures on the sand.
- **Storeys:** 4–7.
- **Wall colours:** `#EFE6D2`, `#E0C9A0`, stalls: `#D9312B` (red), `#F2B705` (yellow), `#2B6CB0` (blue).
- **Materials:** sand, concrete promenade, tin-and-tarp stalls.
- **Roofs:** stall canopies, umbrellas.
- **Ground floor:** row of numbered food stalls with neon/LED signs.
- **Footpath & kerb:** promenade slabs, steps down to sand.
- **Trees:** coconut palms.
- **Clutter:** balloon sellers, pony rides, toy sellers, umbrellas, plastic chairs.
- **People & vehicles:** families, couples; taxis at the road.
- **Sounds:** waves, crowd, vendor calls, music.
- **Refs:** [Wikipedia: Girgaon Chowpatty](https://en.wikipedia.org/wiki/Girgaon_Chowpatty) · [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9545,72.8150) · [Mapillary](https://www.mapillary.com/app/?lat=18.9545&lng=72.8150&z=17)

#### Malabar Hill / Walkeshwar
- **BBox:** [18.940, 72.792, 18.965, 72.812]
- **Character:** Wealthiest hill on the island: winding roads, gated apartment towers, old bungalows, Hanging Gardens, Banganga Tank and its temples down at Walkeshwar.
- **Architecture:** 1960s–2020s luxury towers; colonial bungalows; temple complexes and ghats at Banganga.
- **Storeys:** towers 15–40; bungalows 1–3; Banganga houses 2–4.
- **Wall colours:** `#F3F0E8`, `#DDD5C6`, `#B9B3A6`, `#8FA7A0` (green glass), Banganga: `#E8B04B`, `#D96B4A`, `#FFFFFF` (temple white).
- **Materials:** concrete, glass, stone ghats (basalt steps).
- **Roofs:** flat; temple shikharas.
- **Ground floor:** gates, security cabins, few shops on Walkeshwar Road (chemists, sweets).
- **Footpath & kerb:** good footpaths on top, steep lanes down to Banganga.
- **Trees:** dense canopy — rain trees, banyan, peepal, gulmohar, palms.
- **Clutter:** drivers, parked luxury cars, security, few hawkers.
- **People & vehicles:** residents, domestic staff, joggers, pilgrims at Banganga; cars, taxis.
- **Sounds:** birds (koels, parakeets), quiet traffic, temple bells.
- **Refs:** [Wikipedia: Malabar Hill](https://en.wikipedia.org/wiki/Malabar_Hill) · [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9555,72.8055) · [Mapillary](https://www.mapillary.com/app/?lat=18.9555&lng=72.8055&z=17)

#### Grant Road
- **BBox:** [18.958, 72.812, 18.968, 72.825]
- **Character:** Busy mixed commercial area around the station: electronics (Lamington Road), old cinemas, mixed communities.
- **Architecture:** 1920s–60s commercial blocks, chawls, some new towers.
- **Storeys:** 3–7.
- **Wall colours:** `#D8CBB3`, `#BFB09A`, `#9AA6A0`, `#D9A066`, `#EDE7DA`.
- **Materials:** plaster, concrete, glass shopfronts, metal awnings.
- **Roofs:** flat with hoardings and water tanks.
- **Ground floor:** electronics shops with big illuminated signs, repair shops, eateries; shutters.
- **Footpath & kerb:** crowded pavers, boxes and goods on footpath.
- **Trees:** few.
- **Clutter:** cartons, handcarts, signage overload, cables.
- **People & vehicles:** shoppers, delivery boys; taxis, BEST buses, tempos.
- **Sounds:** horns, shop music, trains.
- **Refs:** [Wikipedia: Grant Road](https://en.wikipedia.org/wiki/Grant_Road) · [Street View Lamington Rd](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9620,72.8185) · [Mapillary](https://www.mapillary.com/app/?lat=18.9620&lng=72.8185&z=17)

#### Tardeo
- **BBox:** [18.965, 72.808, 18.975, 72.820]
- **Character:** Transitional area of old industrial/commercial blocks and new high-rises (Imperial Towers), AC Market, Tardeo circle with heavy traffic.
- **Architecture:** 1960s concrete commercial, glass towers.
- **Storeys:** 4–10; towers 50–60.
- **Wall colours:** `#CFC9BC`, `#A8A39A`, `#E6E1D5`, `#6F8796` (glass), `#B7A07A`.
- **Materials:** concrete, glass.
- **Roofs:** flat.
- **Ground floor:** showrooms, car dealers, restaurants.
- **Footpath & kerb:** pavers, flyover nearby (Haji Ali junction).
- **Trees:** rain trees on main roads.
- **Clutter:** parked cars, signage.
- **People & vehicles:** shoppers, office staff; cars, taxis, BEST buses.
- **Sounds:** traffic.
- **Refs:** [Wikipedia: Tardeo](https://en.wikipedia.org/wiki/Tardeo) · [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9700,72.8140) · [Mapillary](https://www.mapillary.com/app/?lat=18.9700&lng=72.8140&z=17)

#### Byculla
- **BBox:** [18.965, 72.828, 18.985, 72.842]
- **Character:** Old mill and market district: Jijamata Udyan zoo and Bhau Daji Lad Museum, vegetable market, Victorian churches, chawls and new towers on mill land.
- **Architecture:** Victorian (museum, station), chawls, 1990s–2020s towers.
- **Storeys:** chawls 3–4; towers 30–60.
- **Wall colours:** `#D9C7A1`, `#C08A5C`, `#E5DDCB`, `#8E9C8D`, `#B34B3B`.
- **Materials:** brick, plaster, Mangalore tiles, concrete.
- **Roofs:** tile + flat.
- **Ground floor:** furniture shops, markets, garages, small eateries.
- **Footpath & kerb:** pavers, broken; flyover pillars (JJ flyover nearby).
- **Trees:** big rain trees, banyan near the zoo.
- **Clutter:** handcarts, tempos, wood/furniture outside shops.
- **People & vehicles:** residents, traders; taxis, trucks, BEST buses.
- **Sounds:** traffic, trains (Central line), azaan from nearby mosques, temple/church bells.
- **Refs:** [Wikipedia: Byculla](https://en.wikipedia.org/wiki/Byculla) · [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9770,72.8330) · [Mapillary](https://www.mapillary.com/app/?lat=18.9770&lng=72.8330&z=17)

#### Mazgaon
- **BBox:** [18.955, 72.840, 18.975, 72.852]
- **Character:** Hilly old dock neighbourhood: Mazagon Dock shipyard, old Portuguese churches, small hill garden, East-Indian and Chinese heritage.
- **Architecture:** colonial bungalows, chawls, dockyard sheds and cranes.
- **Storeys:** 2–6.
- **Wall colours:** `#E1D3B6`, `#A9B7A9`, `#C9785A`, `#7D8790` (shed grey), `#F2EEE4`.
- **Materials:** plaster, tile, corrugated steel sheds.
- **Roofs:** pitched tile, sheet-metal shed roofs.
- **Ground floor:** small shops, workshops, warehouses.
- **Footpath & kerb:** narrow, irregular.
- **Trees:** big old trees (banyan, rain tree).
- **Clutter:** trucks, containers near docks, cranes on skyline.
- **People & vehicles:** dock workers, residents; trucks, taxis.
- **Sounds:** ship horns, cranes, trucks.
- **Refs:** [Wikipedia: Mazagaon](https://en.wikipedia.org/wiki/Mazagaon) · [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9640,72.8450) · [Mapillary](https://www.mapillary.com/app/?lat=18.9640&lng=72.8450&z=17)

### A2. Central and north (brief)

| District | BBox [S,W,N,E] | Character | Style / storeys | Wall colours | Signature details |
|---|---|---|---|---|---|
| **Worli** | 18.990, 72.808, 19.025, 72.825 | Sea face promenade, Koliwada fishing village, luxury towers, BWSL approach | Glass towers 40–80; Koliwada 1–3 | `#E8E4DA` `#7F9AAE` `#3C6E9E` `#D9A441` | Worli Sea Face wall + tetrapods, dense high-rise skyline, fishing boats |
| **Lower Parel** | 18.990, 72.822, 19.010, 72.835 | Ex-textile mills turned malls/offices (Phoenix, Kamala Mills) | Mill sheds + chimneys; towers 30–60 | `#B65A3C` (mill brick) `#CFC9BC` `#6F8796` | Brick mill chimneys, glass towers, flyovers, Monorail |
| **Prabhadevi** | 19.010, 72.822, 19.022, 72.835 | Siddhivinayak temple area, mixed residential | 4–20 | `#F1E9D7` `#D9B44A` (temple gold) `#E5735A` | Flower/prasad stalls, temple queues, barricades |
| **Dadar** | 19.010, 72.835, 19.030, 72.850 | Marathi cultural centre, huge station, Shivaji Park maidan, flower market | 3–8, chawls + Deco | `#E7DCC2` `#F2D16B` `#8FBF9F` `#C77B4F` | Dadar flower market under the flyover, Shivaji Park cricket, crowded station bridges |
| **Mahim** | 19.030, 72.835, 19.045, 72.850 | Mahim Dargah, Mahim Causeway to Bandra, fishing colony, church | 2–8 | `#F3EFE6` `#4F8F6A` (dargah green) `#D9C7A1` | Dargah green, fair stalls, causeway over creek, mangroves |
| **Dharavi** | 19.035, 72.845, 19.050, 72.865 | One of Asia's largest informal settlements; leather, pottery, recycling industries | 1–4, self-built | `#3E7CB1` (blue tarp) `#9C4A2A` (rust) `#B8B2A6` (bare block) `#5E6B73` | Corrugated roofs with tarps & tyres, narrow lanes, kumbharwada kilns smoke, rooftop scrap |
| **Sion** | 19.035, 72.855, 19.050, 72.870 | Junction of highways, Sion Fort, hospital, mixed residential | 3–12 | `#D6CFC0` `#A9A397` `#E9E2D3` | Flyovers, Sion circle, small hill fort |
| **Bandra (W)** | 19.045, 72.818, 19.070, 72.845 | "Queen of the suburbs": Bandstand, Carter Road, Hill Road shopping, Catholic villages (Ranwar, Chimbai), street art, cafés | Bungalows 1–3; towers 10–30 | `#F2E6CC` `#89B5C4` `#E89A7A` `#FFFFFF` `#5C7A3A` | Portuguese-style villas with crosses, graffiti walls, sea promenades, Mount Mary church. **Autos start here** (north of Mahim Causeway) |

Refs (one Wikipedia + one Street View each): [Worli](https://en.wikipedia.org/wiki/Worli) · [SV](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=19.0000,72.8150) | [Lower Parel](https://en.wikipedia.org/wiki/Lower_Parel) · [SV](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9985,72.8280) | [Prabhadevi](https://en.wikipedia.org/wiki/Prabhadevi) · [SV](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=19.0170,72.8300) | [Dadar](https://en.wikipedia.org/wiki/Dadar) · [SV](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=19.0190,72.8430) | [Mahim](https://en.wikipedia.org/wiki/Mahim) · [SV](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=19.0400,72.8400) | [Dharavi](https://en.wikipedia.org/wiki/Dharavi) · [SV](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=19.0420,72.8540) | [Sion](https://en.wikipedia.org/wiki/Sion,_Mumbai) · [SV](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=19.0430,72.8620) | [Bandra](https://en.wikipedia.org/wiki/Bandra) · [SV](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=19.0500,72.8250)

---
## B. Landmarks

For each: real name → two playful in-game names. Footprint and height are **approximate** (from plans/photos/OSM) — refine from OSM `building:levels`/`height` tags where present. Links: Wikipedia + Google Street View (links only).

> **Trademark note:** The **Taj Mahal Palace** building facade is a registered trademark (first Indian building to get one, 2017). Do not model a close copy; make a generic domed hotel with a different silhouette/colours. Names of businesses (cinemas, BSE, Air India, Wankhede/MCA, turf club) are trademarks even if the building design isn't — always use parody names and never real logos. Religious sites: keep respectful, no destruction/violence mechanics there.

### B1. Gateway of India
- **In-game names:** "Doorway of Bombaystan" / "Gateway of Indiyaa"
- **Lat/lon:** 18.9220, 72.8347
- **Footprint / height:** ~48 × 18 m (arch block) / 26 m (central arch top)
- **Style:** Indo-Saracenic with Gujarati (Solanki) details
- **Materials & colours:** Yellow basalt + RCC; `#D2B07A`, shadows `#8C7350`
- **Model these:** Central 26 m arch with side halls, four corner turrets, intricate jali screens, waterfront steps down to the harbour, open plaza in front
- **Trademarked design?** No known trademark on the design (verify). Name is generic; parody anyway.
- **Refs:** [Wikipedia](https://en.wikipedia.org/wiki/Gateway_of_India) · [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9220,72.8347)

### B2. Taj Mahal Palace hotel
- **In-game names:** "Royal Chaj Mahal Palace" / "The Tajine Palace Hotel"
- **Lat/lon:** 18.9217, 72.8330
- **Footprint / height:** ~110 × 80 m (heritage wing) / ~45 m to central dome top; 7 storeys
- **Style:** Indo-Saracenic / Moorish-Gothic hotel
- **Materials & colours:** Grey-buff stone & cream plaster `#D9C9A8`, red tiled domes `#8E3B2E`, white trim
- **Model these:** Big central red dome, smaller corner domes/turrets, arched balconies, symmetrical sea-facing facade; modern tower wing (1973) behind
- **Trademarked design?** **YES — the building's facade was registered as a trademark in India (2017, IHCL).** Do NOT replicate closely: change dome colour/shape, proportions and name; keep it a generic 'grand domed sea-front hotel'.
- **Refs:** [Wikipedia](https://en.wikipedia.org/wiki/Taj_Mahal_Palace_Hotel) · [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9217,72.8330)

### B3. Chhatrapati Shivaji Maharaj Terminus (CSMT)
- **In-game names:** "Chhatrapati Chai Terminus" / "Victoria Junction Central (VJT)"
- **Lat/lon:** 18.9400, 72.8355
- **Footprint / height:** ~220 × 70 m main building (plus sheds) / ~50 m to central dome statue
- **Style:** Victorian Gothic Revival + Indian (UNESCO site)
- **Materials & colours:** Buff sandstone `#CDB083`, blue-grey basalt `#55524D`, red/white accents, green-grey dome `#5E6E66`
- **Model these:** Central ribbed dome with 'Progress' statue, pointed arches, turrets, gargoyles, rose windows, lion & tiger statues at gates, stone cladding bands
- **Trademarked design?** No trademark on design known (UNESCO heritage). Indian Railways owns its marks — avoid logos.
- **Refs:** [Wikipedia](https://en.wikipedia.org/wiki/Chhatrapati_Shivaji_Terminus) · [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9400,72.8355)

### B4. BMC Headquarters (Municipal Corporation Building)
- **In-game names:** "Bombay Municipal Committee Hall" / "BMC — Big Mumbai Council HQ"
- **Lat/lon:** 18.9405, 72.8344
- **Footprint / height:** ~90 × 70 m (triangular plot) / ~78 m central tower
- **Style:** Gothic Revival + Indo-Saracenic
- **Materials & colours:** Buff stone `#CBB08A`, basalt `#5C5853`, red trim
- **Model these:** Tall central tower with onion dome, gables, statue of 'Urbs Prima in Indis' above, faces CSMT across the junction
- **Trademarked design?** No known trademark.
- **Refs:** [Wikipedia](https://en.wikipedia.org/wiki/Brihanmumbai_Municipal_Corporation_Building) · [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9405,72.8344)

### B5. Rajabai Clock Tower
- **In-game names:** "Rajabhai Tick-Tock Tower" / "Rajabai Chime Spire"
- **Lat/lon:** 18.9297, 72.8305
- **Footprint / height:** ~16 × 16 m base / 85 m
- **Style:** Venetian/Gothic Revival (modelled on Big Ben/Giotto's campanile)
- **Materials & colours:** Buff Kurla stone `#C9AE80`, darker bands, stained glass
- **Model these:** Slender square tower in stages, clock faces, statues in niches, pointed top; stands within University of Mumbai Fort campus beside Gothic library
- **Trademarked design?** No known trademark.
- **Refs:** [Wikipedia](https://en.wikipedia.org/wiki/Rajabai_Clock_Tower) · [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9297,72.8305)

### B6. Flora Fountain (Hutatma Chowk)
- **In-game names:** "Flaura Fountain" / "Flora Fauna Fountain"
- **Lat/lon:** 18.9326, 72.8317
- **Footprint / height:** ~10 m diameter basin / ~10 m
- **Style:** Victorian neo-classical fountain
- **Materials & colours:** Portland stone painted white/cream `#EDE6D6`, statue of Roman goddess Flora
- **Model these:** Tiered fountain with Flora on top, mythological figures, in a busy roundabout plaza; Hutatma Smarak (martyrs memorial) nearby
- **Trademarked design?** No.
- **Refs:** [Wikipedia](https://en.wikipedia.org/wiki/Flora_Fountain) · [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9326,72.8317)

### B7. Bombay High Court
- **In-game names:** "Bombay Hi-Court" / "Bambai Bade Adalat"
- **Lat/lon:** 18.9310, 72.8300
- **Footprint / height:** ~170 × 50 m / ~54 m central tower
- **Style:** Gothic Revival (Early English)
- **Materials & colours:** Basalt `#5A5650` with buff stone dressings `#CFB58A`
- **Model these:** Long facade, central tower flanked by octagonal towers with statues of Justice and Mercy, pointed arches, faces Oval Maidan
- **Trademarked design?** No.
- **Refs:** [Wikipedia](https://en.wikipedia.org/wiki/Bombay_High_Court) · [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9310,72.8300)

### B8. Churchgate station + Western Railway HQ
- **In-game names:** "Churchgate Chai-Station" / "Westward Rail House"
- **Lat/lon:** 18.9348, 72.8272
- **Footprint / height:** Station ~120 × 40 m; HQ ~80 × 40 m / HQ dome ~50 m; station ~15 m
- **Style:** HQ: Indo-Saracenic/Gothic; station: 1930s modern
- **Materials & colours:** HQ buff stone `#CDB083` + basalt; station grey-cream concrete
- **Model these:** HQ with central dome and statue; station: long shed, 4 platforms, big subway; crowds pouring out
- **Trademarked design?** No (Indian Railways marks: avoid logos).
- **Refs:** [Wikipedia](https://en.wikipedia.org/wiki/Churchgate_railway_station) · [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9348,72.8272)

### B9. Marine Drive Art Deco buildings
- **In-game names:** "Marine Drive Decodence Row" / "Queens' Necklace Deco Mansions"
- **Lat/lon:** 18.9430, 72.8233
- **Footprint / height:** Row of ~20 blocks, each ~25 × 30 m / 18–25 m (4–7 storeys)
- **Style:** Art Deco (UNESCO Victorian & Art Deco Ensemble)
- **Materials & colours:** Cream `#F2EAD8`, sand `#E7D7B6`, peach `#E3C6A6`, pale green `#D6DDD9`
- **Model these:** Rounded corners, horizontal 'eyebrow' sunshades, vertical fins, porthole windows, stepped parapets, decorative name plaques ('Soona Mahal', 'Keval Mahal' style — make up your own)
- **Trademarked design?** No.
- **Refs:** [Wikipedia](https://en.wikipedia.org/wiki/Victorian_and_Art_Deco_Ensemble_of_Mumbai) · [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9430,72.8233)

### B10. Wankhede Stadium
- **In-game names:** "Wankhedi Cricket Bowl" / "Wakhede Stadium"
- **Lat/lon:** 18.9389, 72.8258
- **Footprint / height:** ~200 × 180 m / ~30 m roof
- **Style:** Modern stadium (1974, renovated 2011)
- **Materials & colours:** Concrete `#C9C6BF`, white roof membrane, blue seats `#2B5DA8`
- **Model these:** Cantilevered white tensile roof, floodlight towers, seating bowl, next to Churchgate railway line
- **Trademarked design?** Stadium name; MCA/team logos are trademarks — don't use.
- **Refs:** [Wikipedia](https://en.wikipedia.org/wiki/Wankhede_Stadium) · [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9389,72.8258)

### B11. Oval Maidan
- **In-game names:** "Oval Mai-Done" / "The Egg Maidan"
- **Lat/lon:** 18.9290, 72.8285
- **Footprint / height:** ~400 × 120 m / ground
- **Style:** Open ground (Gothic + Deco skyline either side)
- **Materials & colours:** Dry grass `#B7A86A` in winter, green `#5E8C3A` in monsoon, mud `#9B7B57`
- **Model these:** Many simultaneous cricket games, low railings, palms; Gothic High Court/University on east side, Art Deco row on west — the classic UNESCO view
- **Trademarked design?** No.
- **Refs:** [Wikipedia](https://en.wikipedia.org/wiki/Oval_Maidan) · [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9290,72.8285)

### B12. Haji Ali Dargah
- **In-game names:** "Haji Aali Shrine" / "Hajji Wali Island Dargah"
- **Lat/lon:** 18.9827, 72.8089
- **Footprint / height:** ~70 × 50 m island complex; causeway ~500 m / ~26 m minaret
- **Style:** Indo-Islamic
- **Materials & colours:** White marble/plaster `#F4F1EA`, green accents `#3E8E5E`
- **Model these:** White domed shrine with minarets on a tidal islet, narrow causeway submerged at high tide, lined with beggars and stalls
- **Trademarked design?** No (religious site — depict respectfully; no violence allowed there in-game).
- **Refs:** [Wikipedia](https://en.wikipedia.org/wiki/Haji_Ali_Dargah) · [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9827,72.8089)

### B13. Bandra–Worli Sea Link
- **In-game names:** "Bandra–Worry Sea Link" / "Sea Lynx Bridge"
- **Lat/lon:** 19.0335, 72.8180
- **Footprint / height:** 5.6 km long, 8 lanes / Main pylons ~128 m
- **Style:** Cable-stayed bridge
- **Materials & colours:** Grey concrete `#A9A9A3`, white cables, yellow/orange lights at night
- **Model these:** Two inverted-Y concrete towers with fan of cables over Bandra channel, long viaduct approaches on piers, toll plaza at Bandra end
- **Trademarked design?** No known trademark.
- **Refs:** [Wikipedia](https://en.wikipedia.org/wiki/Bandra-Worli_Sea_Link) · [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=19.0335,72.8180)

### B14. Mahalaxmi Racecourse
- **In-game names:** "Mahalakshmi Horse-Track" / "Royal Western Galloping Club"
- **Lat/lon:** 18.9830, 72.8190
- **Footprint / height:** ~1,100 × 650 m oval / Stands ~20 m
- **Style:** Colonial (1883) grandstands
- **Materials & colours:** White/cream stands `#EFEAE0`, green turf `#5F8F3F`, white rails
- **Model these:** Huge open oval track with white railings, Victorian grandstands with balconies, joggers' track around
- **Trademarked design?** Royal Western India Turf Club name is a mark — use parody.
- **Refs:** [Wikipedia](https://en.wikipedia.org/wiki/Mahalaxmi_Racecourse) · [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9830,72.8190)

### B15. Crawford Market (Mahatma Jyotiba Phule Mandai)
- **In-game names:** "Crawfish Market" / "Crowford Mandi"
- **Lat/lon:** 18.9476, 72.8344
- **Footprint / height:** ~110 × 80 m / ~39 m clock tower
- **Style:** Norman/Flemish Gothic
- **Materials & colours:** Buff Kurla stone `#C5A97C`, red Bassein stone `#A9553A`
- **Model these:** Clock tower over entrance, gabled market halls, bas-relief friezes (designed by Lockwood Kipling) above doors, fountain inside
- **Trademarked design?** No.
- **Refs:** [Wikipedia](https://en.wikipedia.org/wiki/Crawford_Market) · [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9476,72.8344)

### B16. Regal Cinema
- **In-game names:** "Regale Talkies" / "Royal Regal Picture Palace"
- **Lat/lon:** 18.9237, 72.8320
- **Footprint / height:** ~45 × 40 m / ~20 m
- **Style:** Art Deco (1933)
- **Materials & colours:** Cream `#ECE2CB` with peach/orange accents `#E2A06C`, neon letters
- **Model these:** Rounded corner facade facing Wellington Fountain/Colaba Causeway junction, vertical name fin, horizontal bands, posters
- **Trademarked design?** Cinema name is a business name — use parody.
- **Refs:** [Wikipedia](https://en.wikipedia.org/wiki/Special:Search?search=Regal+Cinema+Mumbai) · [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9237,72.8320)

### B17. Eros Cinema
- **In-game names:** "Eros-ion Cinema" / "Heros Cinema"
- **Lat/lon:** 18.9342, 72.8262
- **Footprint / height:** ~40 × 40 m / ~24 m
- **Style:** Art Deco (1938)
- **Materials & colours:** Cream `#EFE4CC` with red Agra sandstone `#B4603F` base, gold accents
- **Model these:** Curved corner block facing Churchgate station, stepped tower, large 'EROS'-style vertical sign (replace with parody), shops at ground floor
- **Trademarked design?** Name is a business mark — parody.
- **Refs:** [Wikipedia](https://en.wikipedia.org/wiki/Eros_Cinema) · [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9342,72.8262)

### B18. Banganga Tank
- **In-game names:** "Bangangaa Pond" / "Arrow-Ganga Tank"
- **Lat/lon:** 18.9458, 72.7942
- **Footprint / height:** Tank ~120 × 30 m / Steps; temples 10–20 m
- **Style:** Ancient temple tank (rebuilt 1715)
- **Materials & colours:** Dark basalt steps `#4A4743`, green water `#4C6B4F`, white/orange temples `#F2F0EA`/`#E58B35`
- **Model these:** Rectangular tank with stone steps on all sides, pole in the middle, small Hindu temples and old houses around, ducks, washing
- **Trademarked design?** No (sacred site — respectful).
- **Refs:** [Wikipedia](https://en.wikipedia.org/wiki/Banganga_Tank) · [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9458,72.7942)

### B19. Hanging Gardens (Pherozeshah Mehta Gardens)
- **In-game names:** "Hanging Gardnz" / "Dangling Gardens"
- **Lat/lon:** 18.9565, 72.8050
- **Footprint / height:** ~200 × 100 m / flat terrace on hilltop
- **Style:** Terraced garden (1881)
- **Materials & colours:** Grass `#5E8C3A`, hedges `#3E6B2F`, red gravel paths `#A55B3A`
- **Model these:** Topiary animals, terraced lawns, sunset view over Marine Drive; Kamala Nehru Park 'Old Woman's Shoe' across the road
- **Trademarked design?** No.
- **Refs:** [Wikipedia](https://en.wikipedia.org/wiki/Hanging_Gardens_of_Mumbai) · [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9565,72.8050)

### B20. Girgaon Chowpatty beach
- **In-game names:** "Chowpaati Beach" / "Chow-Party Beach"
- **Lat/lon:** 18.9545, 72.8152
- **Footprint / height:** ~1,000 × 80 m beach / sea level
- **Style:** Urban beach
- **Materials & colours:** Sand `#CDB98F`, sea `#4E6E73` (often brownish-green), stall colours
- **Model these:** Food stall row with numbered signs, statues/kiosks, kulfi carts, Ganesh immersion spot
- **Trademarked design?** No.
- **Refs:** [Wikipedia](https://en.wikipedia.org/wiki/Girgaon_Chowpatty) · [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9545,72.8152)

### B21. Mani Bhavan
- **In-game names:** "Mani Bhawan Smriti" / "Gem Villa Museum"
- **Lat/lon:** 18.9598, 72.8115
- **Footprint / height:** ~15 × 20 m / ~12 m (2 storeys + roof)
- **Style:** Gujarati-colonial residence
- **Materials & colours:** Cream/white `#F1EBDC`, dark wood balconies `#5A3A22`, red tiles
- **Model these:** Two-storey house with carved wooden balcony, museum of Gandhi's stay, in a leafy lane
- **Trademarked design?** No (museum — depict respectfully).
- **Refs:** [Wikipedia](https://en.wikipedia.org/wiki/Mani_Bhavan) · [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9598,72.8115)

### B22. Afghan Church (St John the Evangelist)
- **In-game names:** "St Jon the Afghan Kirk" / "Church of the Old Colaba Spire"
- **Lat/lon:** 18.9063, 72.8126
- **Footprint / height:** ~55 × 22 m / ~60 m spire
- **Style:** Gothic Revival (1858)
- **Materials & colours:** Buff Kurla stone `#C8AE84`, basalt `#57534E`, stained glass
- **Model these:** Tall needle spire visible across Colaba, pointed lancet windows, buttresses
- **Trademarked design?** No.
- **Refs:** [Wikipedia](https://en.wikipedia.org/wiki/Afghan_Church) · [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9063,72.8126)

### B23. Sassoon Dock
- **In-game names:** "Sasoon Fish Dock" / "Salmon Dock"
- **Lat/lon:** 18.9113, 72.8266
- **Footprint / height:** ~200 × 150 m / Gate block ~15 m
- **Style:** Victorian dock (1875)
- **Materials & colours:** Stone `#B9A27E`, rusty sheds `#8C4A2F`, colourful boats `#2A72C9` `#D93A2B` `#F2C230`
- **Model these:** Clock-tower gate, wholesale fish market, Koli women in saris with baskets, colourful trawlers, ice trucks, strong smell (sound: gulls, crows)
- **Trademarked design?** No.
- **Refs:** [Wikipedia](https://en.wikipedia.org/wiki/Sassoon_Docks) · [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9113,72.8266)

### B24. CSMVS (Prince of Wales Museum)
- **In-game names:** "Prince of Whales Museum" / "Chhatrapati Museum of Everything"
- **Lat/lon:** 18.9269, 72.8326
- **Footprint / height:** ~100 × 60 m / ~40 m dome
- **Style:** Indo-Saracenic (George Wittet)
- **Materials & colours:** Basalt `#5B5752` + yellow Kurla stone `#C9AE80`, white dome with tiled pattern
- **Model these:** Large central dome (Gol Gumbaz-inspired) with smaller domes, garden in front, Gateway-style arches
- **Trademarked design?** No.
- **Refs:** [Wikipedia](https://en.wikipedia.org/wiki/Chhatrapati_Shivaji_Maharaj_Vastu_Sangrahalaya) · [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9269,72.8326)

### B25. Asiatic Society / Town Hall
- **In-game names:** "Old Town Hall of Bombay" / "Asiatik Society Library"
- **Lat/lon:** 18.9318, 72.8364
- **Footprint / height:** ~80 × 40 m / ~22 m
- **Style:** Neoclassical (Doric)
- **Materials & colours:** White/cream stucco `#EEE8DB`
- **Model these:** Grand flight of ~30 steps up to a Doric portico with 8 columns facing Horniman Circle garden; film-shoot favourite
- **Trademarked design?** No.
- **Refs:** [Wikipedia](https://en.wikipedia.org/wiki/Asiatic_Society_of_Mumbai) · [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9318,72.8364)

### B26. Horniman Circle Gardens
- **In-game names:** "Horniman Square" / "Hornbill Circle"
- **Lat/lon:** 18.9325, 72.8350
- **Footprint / height:** ~120 m circle / garden + 4-storey ring
- **Style:** Victorian/Edwardian circus
- **Materials & colours:** Cream buildings with arcades `#E3D6BC`, green garden
- **Model these:** Circular garden with cast-iron fence, ring of uniform arcaded buildings (Elphinstone Building), banks
- **Trademarked design?** No.
- **Refs:** [Wikipedia](https://en.wikipedia.org/wiki/Horniman_Circle_Gardens) · [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9325,72.8350)

### B27. Bombay Stock Exchange (Phiroze Jeejeebhoy Towers)
- **In-game names:** "Bombay Stalk Exchange Tower" / "Dalal Tower of Moolah"
- **Lat/lon:** 18.9294, 72.8336
- **Footprint / height:** ~35 × 35 m / ~115 m (29 floors)
- **Style:** 1970s modernist tower
- **Materials & colours:** Grey concrete `#9C9A94`, dark windows, big ticker screens
- **Model these:** Square tower with vertical ribbing, LED share tickers at street level, on Dalal Street
- **Trademarked design?** **BSE name/logo are trademarks** — parody name and no logo.
- **Refs:** [Wikipedia](https://en.wikipedia.org/wiki/Bombay_Stock_Exchange) · [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9294,72.8336)

### B28. Air India Building, Nariman Point
- **In-game names:** "Air Indiana Building" / "Air Indulge Tower"
- **Lat/lon:** 18.9257, 72.8222
- **Footprint / height:** ~40 × 30 m / ~105 m (23 floors)
- **Style:** 1970s modernist
- **Materials & colours:** Concrete `#BDB8AE` with dark glass
- **Model these:** Tall slab with big rooftop red sign (make your own parody), at Marine Drive's southern end
- **Trademarked design?** **Air India name/Maharaja mascot are trademarks** — do not show; parody only.
- **Refs:** [Wikipedia](https://en.wikipedia.org/wiki/Air_India_Building) · [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9257,72.8222)

### B29. Siddhivinayak Temple
- **In-game names:** "Siddhi-Vinayaka Mandir" / "Shri Siddhi Ganpati Mandir"
- **Lat/lon:** 19.0169, 72.8303
- **Footprint / height:** ~40 × 40 m / ~30 m (gold-plated dome)
- **Style:** Modern Hindu temple (rebuilt 1990s)
- **Materials & colours:** White/pink marble `#F3E7E1`, gold dome `#D4A83A`
- **Model these:** Multi-tiered shikhara with gilded central dome, queue barricades, flower and prasad stalls outside
- **Trademarked design?** Temple trust marks — parody name, respectful depiction.
- **Refs:** [Wikipedia](https://en.wikipedia.org/wiki/Siddhivinayak_Temple,_Mumbai) · [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=19.0169,72.8303)

### B30. Mount Mary Basilica, Bandra
- **In-game names:** "Mount Marie Basilica" / "Our Lady of the Mount Bandra"
- **Lat/lon:** 19.0466, 72.8223
- **Footprint / height:** ~45 × 25 m / ~35 m twin spires
- **Style:** Gothic Revival (1904)
- **Materials & colours:** Grey/brown stone `#8D8273`, white trim
- **Model these:** Twin-spire facade on a hill with sea view, steps up, candle stalls; Bandra fair in September
- **Trademarked design?** No.
- **Refs:** [Wikipedia](https://en.wikipedia.org/wiki/Mount_Mary_Church,_Bandra) · [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=19.0466,72.8223)

### B31. Shivaji Park
- **In-game names:** "Shivaji Maidan Park" / "Dadar Cricket Kingdom"
- **Lat/lon:** 19.0270, 72.8380
- **Footprint / height:** ~420 × 280 m / ground
- **Style:** Open maidan with Deco-era buildings around
- **Materials & colours:** Mud `#A68A64`, grass patches, red/cream buildings
- **Model these:** Many cricket nets/pitches, Ganesh-temple, Mayor's bungalow, joggers' track, rallies
- **Trademarked design?** No.
- **Refs:** [Wikipedia](https://en.wikipedia.org/wiki/Shivaji_Park) · [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=19.0270,72.8380)

### B32. Mumba Devi Temple
- **In-game names:** "Mumbaa Devi Mandir" / "Mumbadevi Mata Mandir"
- **Lat/lon:** 18.9508, 72.8305
- **Footprint / height:** ~30 × 30 m / ~20 m
- **Style:** Hindu temple (1737 rebuild)
- **Materials & colours:** White/orange `#F2EFE7` `#E58B35`, silver crown inside
- **Model these:** Shikhara, tank courtyard, dense Bhuleshwar lanes around, flower sellers
- **Trademarked design?** No (sacred site).
- **Refs:** [Wikipedia](https://en.wikipedia.org/wiki/Mumba_Devi_Temple) · [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9508,72.8305)

---

## C. Vehicles

> Dimensions are typical real-world values (± ~5 %), good enough for 1:1 scale. Colours are sampled-by-eye suggestions. Never put real manufacturer badges/logos on models.

### C1. Kaali-peeli taxi — classic Premier Padmini (being phased out)
- **Real:** Premier Padmini (licensed Fiat 1100D). The last Padmini taxis were retired in Oct 2023 — keep a few as rare "vintage" spawns.
- **Size:** L 3.73 m × W 1.47 m × H 1.43 m, wheelbase 2.34 m, wheels ~0.55 m diameter.
- **Livery:** lower body black `#111111`, roof (and pillars above window line) yellow `#F7C600`; chrome bumpers `#C8C8C8`; small roof-carrier rack; "TAXI" light box was rare — instead a **meter flag** (old mechanical meter on the left front fender) or digital meter; yellow number plate with black text (commercial vehicle).
- **Details:** rounded boxy 1960s shape, round headlights, bench seat, driver's arm out of window, garlands/stickers on dashboard, curtain/"lace" on rear window.
- **Model plan:** shorten the Ambassador model (assets.json `vehicle-ambassador`) or build from a simple box sedan.

### C2. Kaali-peeli taxi — newer models
- **Real:** tall-boy hatchbacks and small sedans (Hyundai Santro, Maruti Suzuki Wagon R/Celerio, Tata Indica/Indigo historically). Use generic shapes.
- **Size:** L 3.6–3.9 m × W 1.5–1.65 m × H 1.55–1.7 m.
- **Livery:** same black body `#111111` + yellow roof `#F7C600`; yellow plate; LED "TAXI" sign on some.

### C3. Cool Cab (AC taxi)
- **Real:** Mumbai's air-conditioned meter taxis, historically Fiat/Hyundai/Maruti sedans and MPVs.
- **Livery:** blue body `#1F5AA6` with a grey/silver horizontal band `#BFC3C7` ; yellow number plate. (App cabs — Uber/Ola — are plain private-coloured cars with yellow plates.)

### C4. BEST buses
| Type | L × W × H | Colours / livery | Notes |
|---|---|---|---|
| Single-deck diesel/CNG (Ashok Leyland / Tata style) | 11–12 m × 2.6 m × 3.2 m | Bright red `#C8102E` lower body, cream/white band `#F2EEE4` at window line on older ones; many newer buses red with black glazing | Route number + destination LED board front (Marathi first, then English), entry rear / exit front; open door in traffic |
| Single-deck electric (2019+ e-buses, many leased) | 12 m (also 9 m midi) × 2.6 m × 3.4 m | Red `#D21F26` with black window band; some leased e-buses come in other liveries (white/blue) | Low floor, flat front, roof battery pods |
| Legacy double-decker (Ashok Leyland Titan) | ~10.5 m × 2.5 m × 4.4 m | Red `#C8102E`, cream band, black rubber window seals | **Retired Sept 2023** — use as rare vintage / open-top heritage tour bus |
| New electric double-decker (Switch EiV22, 2023+) | ~9.8 m × 2.6 m × 4.75 m | Red `#D21F26` body, large black tinted glazing on both decks, flat modern front | Two doors, two staircases; routes from CSMT/Colaba to Nariman Point etc. |

- **Bus stop:** steel shelter with red/blue frame, BEST logo panel (make a parody "BEZT" logo), route number board; often an ad panel. Shelters ~6 × 1.8 m, ~2.6 m tall.
- Refs: [Wikipedia: BEST](https://en.wikipedia.org/wiki/Brihanmumbai_Electric_Supply_and_Transport) · [Wikipedia: double-deckers in Mumbai](https://en.wikipedia.org/wiki/Double-decker_buses_in_Mumbai)

### C5. Auto-rickshaws
- **Real:** Bajaj RE / TVS King / Piaggio Ape style three-wheelers, CNG-powered.
- **Size:** L 2.63 m × W 1.30 m × H 1.71 m; wheelbase ~2.0 m; front wheel single.
- **Livery (Mumbai suburbs):** black lower body `#141414`, yellow canvas/metal hood `#F2C200`; many have green CNG markings/stickers; yellow commercial number plate; interior: rexine seat (black/red), driver's personal decor (stickers, LED, mini speakers, film-hero photos).
- **Rule — IMPORTANT for the game:** autos are **not allowed in South Mumbai / the island city south of Bandra (Mahim Causeway) and Sion**. They run only in the suburbs (Bandra/Sion northwards). So in Colaba, Fort, Marine Drive etc. **the player should spawn in a kaali-peeli taxi, not an auto**; autos should appear only north of the Mahim–Sion line.
- Refs: [Wikipedia: Auto rickshaw (India)](https://en.wikipedia.org/wiki/Auto_rickshaws_in_India) · [Wikipedia: Taxicabs of Mumbai](https://en.wikipedia.org/wiki/Taxicabs_of_Mumbai)

### C6. Mumbai local train (EMU)
- **Coach size:** ~20.7 m long × 3.66 m wide × ~3.9 m tall (rail to roof; pantograph adds ~1 m on motor coaches). Rakes are 12 or 15 coaches (~250 / ~310 m). Track: broad gauge 1,676 mm.
- **Look:** flat-sided stainless/steel boxes with **open doors (never closed — people hang out)**, barred windows, roof fans/vents. Newer rakes (Bombardier/Siemens/Medha) are white/silver with coloured bands; older Western Railway livery was maroon `#7A2430` + cream `#EFE2C2`; Central Railway older rakes were blue `#2C5A8C` + cream; AC rakes are white with blue/red stripes and closed sliding doors.
- **Markings:** "Ladies" coaches (green/red-yellow markings), "First class" coaches with yellow-red diagonal stripes, coach number stencils.
- **Sound:** two-tone horn, clattering bogies, doors open ("dhan-dhan"), station announcement chimes.
- Refs: [Wikipedia: Mumbai Suburban Railway](https://en.wikipedia.org/wiki/Mumbai_Suburban_Railway) · [Street View Churchgate platforms](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=18.9355,72.8272)

### C7. Trucks and tempos
- **Lorry (Tata/Ashok Leyland style, 2-axle):** L 7.5–9 m × W 2.5 m × H 3.3 m (with load up to 3.8 m). Cab painted orange `#E8742A`, yellow `#F2B705`, red `#C62828` or blue `#1D5FA8`; hand-painted wooden body with flowers, eyes, "HORN OK PLEASE", "USE DIPPER AT NIGHT", "BURI NAZAR WALE TERA MUH KALA" (evil-eye slogans), black tassels, lemon-and-chilli charm, tarpaulin over the load.
- **Tempo / mini-truck (pickup):** L 4–5 m, white/blue/green, often overloaded.
- **Water tanker:** blue/white tank, BMC tankers.
- **Garbage truck (BMC compactor):** green/yellow.

### C8. Two-wheelers
- **Scooters (Honda Activa / TVS Jupiter style):** L 1.85 m × W 0.7 m × H 1.15 m; colours white, grey, black, red, matte blue. Very common; women and older riders.
- **Motorbikes (Hero Splendor/Bajaj Pulsar/Royal Enfield style):** L 2.0–2.2 m; black, red, blue; delivery riders with big insulated food boxes (red/orange/green delivery boxes — parody brands).
- **Riders:** 2–3 people on a bike is common; helmets on driver mostly; dupatta/saree side-saddle pillion.

### C9. Handcarts and bicycles
- **Handcart (haath-gaadi / thela):** wooden flatbed ~2.4 × 1.0 m on two large spoked wheels (~0.9 m) with a front prop stick; pushed/pulled by 1–2 men; carries sacks, boxes, furniture, gas cylinders. Also **vegetable/fruit carts** (4 small wheels, ~1.8 × 1.0 m) with fruit pyramids, scale, umbrella.
- **Dabbawala bicycle:** heavy black roadster cycle (`#1A1A1A`) with long wooden crate/frame hanging from handlebar and carrier holding 20–30 tiffin boxes (aluminium/steel cylinders, cloth bags); dabbawalas wear white kurta-pyjama and white Gandhi cap; also carry crates on heads (long wooden trays ~1.8 m) at Churchgate/CST around 11 am–1 pm.
- **Delivery tricycle:** flatbed cargo cycle (bread, gas cylinders, water cans).
- **Bicycle:** old black roadster, milk delivery cans on the sides.

---

## D. Signage and brands

### D1. Shop signs
- **Types:** 1) fascia board above the shutter, full width of the shop (most common); 2) projecting vertical board / blade sign; 3) acrylic backlit box signs; 4) flex vinyl (printed plastic) banners — now dominant, cheap, glossy, often sun-faded; 5) painted on the wall itself (old shops, temples, chawls); 6) LED-edge-lit letters (newer shops); 7) rooftop hoardings (giant billboards on steel frames, often on top of old buildings).
- **Colours:** high-saturation backgrounds: red `#D7261E`, yellow `#FFD200`, blue `#1E4FA3`, green `#0E8A4A`, white boards with red/blue letters; old painted boards: off-white `#EFE8D2` with black/maroon letters and a coloured border; **jewellery/sweet shops** gold on maroon `#7A0F1E`.
- **Languages & scripts:** BMC rules require **Marathi in Devanagari** on shop signs (and it must be at least as prominent as other scripts). Typical stack: Devanagari (Marathi) on top or left, English (Latin) below/right; plus **Gujarati** in Kalbadevi/Bhuleshwar/Ghatkopar and **Urdu** in Mohammed Ali Road/Bhendi Bazaar/Mahim areas. Phone numbers in big digits, "Since 1952" claims, "& Sons", "Bros.", "Stores", "Bhandar", "Wala".
- **Hand-painted style:** thick drop-shadowed letters, outline + inline, gradient fills, small pictures (tea glass, scissors, tooth, tyre), ornamental borders; **truck art** style for vehicles. Fonts for this in assets.json: Yatra One, Modak, Rozha One, Kalam, Baloo 2.
- **Other common signs:** blue road-name plates with white text (Marathi + English), green direction boards on highways, "No Parking" (red circle) on poles, political banners with leaders' photos (avoid real people — use fictional), festival banners (Ganesh, Navratri).

### D2. 40 brand categories with parody names
(All names are invented and deliberately **not** sound-alikes of real brands; logos must be original.)

| # | Category (seen on streets/hoardings) | Parody brand |
|---|---|---|
| 1 | Packaged tea | **Kadak Kettle Chai** |
| 2 | Glucose biscuits | **Bambaiya Biskoot** |
| 3 | Cola | **Fizzwala Cola** |
| 4 | Lemon soda | **Nimbu Zing** |
| 5 | Mobile network | **Hello Hello 6G** |
| 6 | Second mobile network | **Tower Tower Telecom** |
| 7 | Smartphone | **Jugaad Phone X** |
| 8 | Paint company | **Rangoli Paints** |
| 9 | Cement | **Pakka Pillar Cement** |
| 10 | Two-wheeler maker | **Ghoda Motors** |
| 11 | Car maker | **Kismat Cars** |
| 12 | Public-sector bank | **Bank of Bombaystan** |
| 13 | Private bank | **Paisa Vasool Bank** |
| 14 | Life insurance | **Zindagi Shield Insurance** |
| 15 | Mutual funds / investing app | **Gullak Invest** |
| 16 | Payments app | **Scan-Karo Pay** |
| 17 | Food delivery app | **Bhookh Express** |
| 18 | 10-minute grocery app | **Abhi Ke Abhi Mart** |
| 19 | Online shopping | **Jhola Bazaar.com** |
| 20 | Jewellers | **Sona Chandi Palace** |
| 21 | Sarees / textiles | **Rani Resham Bhandar** |
| 22 | Innerwear / vests | **Banyan Boss** |
| 23 | Ice cream | **Thanda Thanda Kulfi Co.** |
| 24 | Dairy / butter | **Malai Mama Dairy** |
| 25 | Namkeen snacks | **Chakna King** |
| 26 | Instant noodles | **Do-Minute Noodles** |
| 27 | Mouth freshener (elaichi) | **Elaichi Express** |
| 28 | Detergent | **Jhakaas Wash Powder** |
| 29 | Soap | **Nahao Soap** |
| 30 | Toothpaste | **Chamak Daant** |
| 31 | Hair oil | **Nariyal Shine Oil** |
| 32 | Cinema chain | **Picture Palace Multiplex** |
| 33 | Film studio poster | **Bollyweird Pictures** |
| 34 | Cricket league team | **Bombay Batsmen** |
| 35 | Newspaper | **The Daily Bhel** |
| 36 | Fuel station | **Tanki Full Petroleum** |
| 37 | Airline | **Udaan Air** |
| 38 | Luxury real-estate ads | **Sky-High Luxuria Towers** |
| 39 | Coaching classes | **Topper Factory Classes** |
| 40 | Vada pav chain | **Jumbo Vada Junction** |

---

## E. Roads and street furniture

- **Lane markings:** white dashed lane lines (3 m dash / 4.5–6 m gap), white solid edge lines on major roads; yellow solid centre line rarely; zebra crossings white on black (often faded); "STOP" lines; bus-lane markings rare. Markings are **often worn/faded** — use partial alpha.
- **Road surface:** dark asphalt `#2E2E2E` on main roads, patched grey `#555555` squares, **concrete roads** `#B8B4AA` with expansion joints on many arterials (white-topping, 2020s), potholes in monsoon, speed breakers (humps) painted with black-yellow or white stripes.
- **Dividers:** concrete median ~0.5–1.0 m wide, 0.3–0.5 m high, **painted black-yellow stripes** `#1A1A1A`/`#F2C200` (each 0.5–0.6 m), with plants (bougainvillea, palms) or a steel railing/grille on top; on Marine Drive a planted divider with palms.
- **Kerb:** 20–30 cm high stone/concrete kerb, alternating black and yellow paint (some white-black); many footpaths have an extra step to buildings.
- **Footpaths:** grey interlocking concrete paver blocks (zig-zag "I-shape" or "dumbbell") `#8F8C86` with some red/terracotta `#9C4A33` bands; tactile yellow strips near crossings (new); broken patches, tree pits, manhole covers (round, cast-iron, "BMC").
- **Traffic signals:** dark grey/black pole with 3-lamp heads (red-amber-green) + countdown timers (red LED digits), mounted on side poles and cantilever arms; many signals have **solar panels**; traffic police booth or umbrella at big junctions.
- **Street lights:** tall grey galvanized poles (8–12 m) with single/double arm LED luminaires (white light now; old sodium orange on some streets); Marine Drive has a continuous curve of lamp posts; heritage cast-iron lamps in Fort/Kala Ghoda.
- **Overhead wires:** fewer in South Mumbai (mostly underground) — but **cable bundles strung along buildings**, telecom wires across lanes and on poles in Girgaon/Bhuleshwar/Dharavi; overhead catenary on railway lines.
- **Flyovers:** concrete box-girder flyovers on single round piers (JJ flyover, Kemps Corner, Dadar–Sion), with grey/white-painted parapets, often with sound barriers; dark under-flyover spaces used for parking, markets and hawkers.
- **Skywalks / FOBs:** steel foot over-bridges with blue/grey sheet roofs at stations.
- **Police barricades:** portable steel barricades painted yellow and black with "MUMBAI POLICE" (use a parody "BOMBAY POLICE"/"MUMBAI CITY POLICE" — fictional) — ~2.0 m long × 1.1 m high; also blue-white steel barricades and bamboo barricades during festivals.
- **Police chowky (booth):** small blue/white box cabin ~2 × 2 × 2.5 m.
- **Other unmistakably-Mumbai details:** BEST bus stop shelters; red **fire hydrants** rare; green/blue **dustbins**; **Ganpati pandals** (Aug–Sep); black-and-yellow taxis parked in rows; **paan stalls** (tiny wooden kiosks with mirrors and hanging packets); **chai tapri** (tea stall: a wooden box counter, kettle on stove, glasses, plastic stools); **vada pav carts**; **cobblers** under umbrellas; **newspaper vendors** on footpath sheets; **tetrapods** along sea walls; **water tanks** (black plastic Sintex-style `#222222`) on every roof; **satellite dishes** (DTH, small grey-white); **clothes drying** on balcony grilles; **blue tarpaulins** in monsoon; **crows** everywhere; **stray dogs** napping on footpaths; **cows** in old lanes.

---

## F. Quick references

- OpenStreetMap (map data already used by the game): https://www.openstreetmap.org/#map=14/18.94/72.83
- Mapillary (free street-level imagery; CC-BY-SA — reference only, do not copy into the repo): https://www.mapillary.com/app/?lat=18.94&lng=72.83&z=14
- UNESCO Victorian Gothic & Art Deco Ensemble map: https://whc.unesco.org/en/list/1480/
- CSMT UNESCO page: https://whc.unesco.org/en/list/945/
- Wikipedia: Architecture of Mumbai: https://en.wikipedia.org/wiki/Architecture_of_Mumbai
