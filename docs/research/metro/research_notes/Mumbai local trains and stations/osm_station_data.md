# Suburban railway stations and long-distance terminals in the map box, as mapped in the local OpenStreetMap extract

Source for everything below unless a line says otherwise: the local extract `data/raw/mumbai-region.osm.pbf` (extract.bbbike.org, downloaded 2026-11-13; Map data © OpenStreetMap contributors, Open Database License), read by [scripts/research/stations-from-osm.mjs](../../../../../scripts/research/stations-from-osm.mjs), which writes [docs/research/metro/osm-stations.json](../../osm-stations.json) (1.67 MB). OpenStreetMap object links point at the live map, which may have changed since the extract. Game coordinates: x = east, z = south (north is −z), metres from Mahim 19.03 N, 72.85 E, the converter's projection. "Inferred" marks anything the script derived (assignment to a station, sides, widths, cross-sections) rather than read from a tag.

## 1. Which stations lie inside the map box, with names, lines and game coordinates?

### Takeaway
The box (18.890–19.140 N, 72.795–72.920 E) holds 43 stations: 17 on the Western line, 13 on the Central line, 21 on the Harbour line (counting interchanges once per line), plus the long-distance terminals Lokmanya Tilak Terminus and Bandra Terminus; 27 of them lie in South Mumbai (south of 19.045 N). Dadar is two separate stations in the data (Western "DDR" and Central "DR"). Ten stations have no Marathi name.

### Cited Findings
- 41 stations come from `railway=station` nodes and 2 from station area outlines with no node: Bandra Terminus ([way/107303404](https://www.openstreetmap.org/way/107303404)) and Vadala Road ([way/1343435452](https://www.openstreetmap.org/way/1343435452), `railway=station`, stop area [relation/11507866](https://www.openstreetmap.org/relation/11507866) ref VDLR) — [osm-stations.json `stations[].link`](../../osm-stations.json)
- Lines come from the 64 `route=train` relations in the extract: a station gets a line when a relation lists a stop there (matched by stop area membership, else same name within 800 m, else nearest station within 350 m; the match is recorded per stop in `routeStops[].link`). Fast/slow comes from the relation names ("Western Line (fast): Churchgate => Virar", relation [11094509](https://www.openstreetmap.org/relation/11094509)) — [osm-stations.json `stations[].lines`](../../osm-stations.json)
- Western "fast" stops in the data: Churchgate, Marine Lines, Charni Road, Grant Road, Mumbai Central, Dadar, Bandra, Andheri; Central "fast" stops: CSMT, Byculla, Dadar, Kurla, Ghatkopar — [osm-stations.json `stations[].lines.suburban`](../../osm-stations.json)
- Long-distance route relations stopping in the box: CSMT 4 (terminus of 3), Mumbai Central 4 (terminus of 4), Dadar Central 5 (terminus of 1, 11021 Chalukya Express), LTT 5 (terminus of 5), Bandra Terminus 1 (12908 Maharashtra Sampark Kranti); none lists a stop at Dadar Western — [osm-stations.json `stations[].lines.longDistance`](../../osm-stations.json)
- Dadar: Western node [node/2630075004](https://www.openstreetmap.org/node/2630075004) (ref DDR, operator WR) and Central node [node/2630075003](https://www.openstreetmap.org/node/2630075003) (ref DR, alt_name "Dadar (Central)"), tied together by the stop area group "Dadar" [relation/11508028](https://www.openstreetmap.org/relation/11508028) — [osm-stations.json](../../osm-stations.json)
- CSMT node [node/12176277888](https://www.openstreetmap.org/node/12176277888): name "Mumbai CSMT", name:mr "मुंबई सीएसएमटी", official_name "Mumbai Chhatrapati Shivaji Maharaj Terminus", old_name "Victoria Terminus", ref CSMT; stop area group "Mumbai CSMT" [relation/18043333](https://www.openstreetmap.org/relation/18043333) — [osm-stations.json](../../osm-stations.json)
- No name:mr on: Lokmanya Tilak Terminus, Bandra Terminus, Chembur, Govandi, Guru Tegh Bahadur Nagar, Vadala Road, Sewri, Cotton Green, Reay Road, Dockyard Road (the script also looks in the stop area and station area relations) — [osm-stations.json `gaps`](../../osm-stations.json)
- Operator tags contradict the route relations at two stations: Parel ([node/3501418212](https://www.openstreetmap.org/node/3501418212), operator=WR, IR:zone=CR:CSMT) and Currey Road ([node/2444001671](https://www.openstreetmap.org/node/2444001671), operator=WR) are stops only of Central Line relations — [osm-stations.json](../../osm-stations.json)
- Just outside the box (in the 0.01° margin, not in `stations`): Kanjur Marg and Vikhroli (72.928 E) and Jogeshwari (Harbour Line) ([node/12189351698](https://www.openstreetmap.org/node/12189351698), 19.1412 N); the Western Jogeshwari node is inside — [osm-stations.json `nearbyOutsideBox`](../../osm-stations.json)
- Four `public_transport=station` outlines are not railway stations and were left out (listed in `otherStationAreas`): Mumbai International Cruise Terminal (ferry), Bhaucha Dhakka (ferry wharf), "Mumbai BKC" ([way/626938775](https://www.openstreetmap.org/way/626938775), `railway=construction`, `construction=train_station`) and "Andheri M1" ([way/911875199](https://www.openstreetmap.org/way/911875199), a metro building) — [osm-stations.json `otherStationAreas`](../../osm-stations.json)
- Table: identity, lines and position of every station. "Node" = the station node (or outline centroid); "Frame centre" = middle of the mapped platforms (inferred; platforms over 1.5 × the median length left out, e.g. Dadar Western's 922 m platform 5); "Axis" = compass bearing of the longest platform; "(S)" = South Mumbai — [osm-stations.json `stations[].position`, `frame`](../../osm-stations.json)

| Station | name:mr | Code | Lines (route relations) | Node x, z | Frame centre x, z | Axis ° | Platform span m |
|---|---|---|---|---|---|---|---|
| Jogeshwari (Western Line) | जोगेश्‍वरी | JOS | W slow | -112, -11746.1 | -105.1, -11789.5 | 7.5 | 283.4 |
| Andheri | अंधेरी | ADH | H; W fast/slow | -376.8, -9928.8 | -370, -9704.8 | 7.6 | 838.2 |
| Vile Parle | विले पार्ले | VLP | H; W slow | -631.2, -7738.5 | -630.2, -7716.2 | 7.9 | 402.8 |
| Ghatkopar | घाटकोपर | GC | C fast/slow | 6144.5, -6164.8 | 6112.4, -6161 | 57.2 | 453.5 |
| Santa Cruz | सांताक्रूझ | STC | H; W slow | -867.8, -5703.1 | -859.7, -5857.6 | 8.6 | 502.7 |
| Vidyavihar | विद्याविहार | VVH | C slow | 4960.1, -5483.9 | 4992.2, -5494.5 | 51.3 | 267 |
| Lokmanya Tilak Terminus | — | LTT | LD×5 (terminus of 5) | 4419.1, -4368.6 | 4396.7, -4437.4 | 49.2 | 778.7 |
| Khar Road | खार रोड | KHAR | H; W slow | -1048.4, -4233 | -1039.4, -4352.7 | 8.5 | 288.5 |
| Tilak Nagar | टिळक नगर | TKNG | H | 4260.4, -3961.2 | 4238.7, -3957.3 | 284.2 | 275.3 |
| Kurla | कुर्ला | CLA | H; C fast/slow | 3093, -3905.2 | 3070.4, -3889.3 | 52.3 | 365.5 |
| Bandra Terminus | — | BDTS | LD×1 (terminus of 1) | -924.1, -3651.1 | -940.7, -3574.6 | 0.7 | 704.7 |
| Chembur | — | CMBR | H | 5383.7, -3612.1 | 5409.4, -3600 | 295.3 | 295.5 |
| Govandi | — | GV | H | 6850.1, -2808.1 | 6859.9, -2808.8 | 304.4 | 283 |
| Bandra | वांद्रे | BA | H; W fast/slow | -1029.5, -2765 | -983.7, -2734.8 | 341.5 | 463.8 |
| Chuna Bhatti | चुना भट्टी | CHF | H | 2010.4, -2409.8 | 2012.4, -2334.3 | 356.1 | 354.7 |
| Sion | शीव | SIN | C slow | 1398.4, -1828.8 | 1466.4, -1946.4 | 33 | 271 |
| Mahim Junction (S) | माहिम जंक्शन | MM | H; W slow | -357.5, -1180.4 | -328.6, -1195.3 | 338 | 330.3 |
| Guru Tegh Bahadur Nagar (S) | — | GTBN | H | 1510.2, -886.1 | 1492, -868.4 | 40 | 279.8 |
| King's Circle (S) | किंग्ज सर्कल | KCE | H | 814.6, -186.2 | 752.6, -248.1 | 304.7 | 209.1 |
| Matunga Road (S) | माटुंगा रोड | MRU | W slow | -349.4, 241.9 | -327.6, 177.1 | 16.5 | 311.1 |
| Matunga (S) | माटुंगा | MTN | C slow | 15.4, 283.9 | 38, 263.1 | 33.5 | 270.1 |
| Dadar (DDR) (S) | दादर | DDR | W fast/slow | -752.9, 1192.5 | -732.5, 1183.9 | 28.9 | 396.3 |
| Dadar (DR) (S) | दादर | DR | C fast/slow; LD×5 (terminus of 1) | -734.1, 1397.4 | -640.5, 1276.9 | 33.3 | 938.5 |
| Vadala Road (S) | — | — | H | 940.1, 1526.7 | 938.5, 1535.5 | 37.9 | 348.9 |
| Parel (S) | परळ | PR | C slow | -1298.9, 2271.2 | -1286.4, 2254.8 | 31.2 | 412 |
| Prabhadevi (S) | प्रभादेवी | PBHD | W slow | -1484.7, 2493.7 | -1477.7, 2478.4 | 29 | 335.7 |
| Sewri (S) | — | SVE | H | 465.5, 3455.9 | 464.2, 3487.6 | 21.9 | 268.4 |
| Lower Parel (S) | लोअर परळ | PL | W slow | -2076.4, 3799 | -2103.4, 3835 | 22.8 | 314.4 |
| Currey Road (S) | करी रोड | CRD | C slow | -1804.8, 4012.8 | -1805.7, 4043.4 | 0.8 | 266.7 |
| Chinchpokli (S) | चिंचपोकळी | CHG | C slow | -1824.2, 4737.8 | -1811.5, 4788.3 | 0 | 271.3 |
| Cotton Green (S) | — | CTGN | H | -642.5, 4739.1 | -706.6, 4816.6 | 37 | 205.1 |
| Mahalaxmi (S) | महालक्ष्मी | MX | W slow | -2714, 5255.6 | -2737.3, 5291.6 | 34.4 | 294.4 |
| Reay Road (S) | — | RRD | H | -621, 5805.8 | -614, 5784.7 | 347 | 260.3 |
| Byculla (S) | भायखळा | BY | C fast/slow | -1811.4, 5908.6 | -1811.2, 5926.1 | 0.5 | 365.9 |
| Mumbai Central (S) | मुंबई सेंट्रल | MMCT | W fast/slow; LD×4 (terminus of 4) | -3230.3, 6687.4 | -3225.1, 6502.9 | 5.1 | 476.8 |
| Dockyard Road (S) | — | DKRD | H | -574, 6920.9 | -613.7, 7037.8 | 17.7 | 204.2 |
| Grant Road (S) | ग्रँट रोड | GTR | W fast/slow | -3597.6, 7377.1 | -3549.2, 7330.8 | 23.4 | 369.2 |
| Sandhurst Road (S) | सँडहर्स्ट रोड | SNRD | H; C slow | -1118.9, 7646.2 | -1125.9, 7486.2 | 38.8 | 274.9 |
| Masjid (S) | मस्जिद | MSD | H; C slow | -1244.6, 8601.4 | -1243.4, 8607.5 | 359.3 | 279.4 |
| Charni Road (S) | चर्नी रोड | CYR | W fast/slow | -3343.5, 8651.3 | -3359.8, 8641.5 | 308.1 | 434.8 |
| Marine Lines (S) | मरीन लाइन्स | MEL | W fast/slow | -2766.7, 9324.3 | -2773.2, 9317.8 | 326.8 | 307.2 |
| Mumbai CSMT (S) | मुंबई सीएसएमटी | CSMT | H; C fast/slow; LD×4 (terminus of 3) | -1496.4, 9907.8 | -1480.1, 9679 | 355.9 | 442.2 |
| Churchgate (S) | चर्चगेट | CCG | W fast/slow | -2403, 10462.7 | -2402.9, 10439.9 | 352.3 | 358 |

### Inferences
- For building a station, the frame centre and axis are a better anchor than the station node: the node is 120–230 m off the platform centre at Andheri, Santa Cruz, Khar Road, Mumbai Central, Sandhurst Road, Dadar Central and CSMT (inferred from the two columns above).
- "W fast" stops between Churchgate and Mumbai Central come from the relations as mapped; whether every fast train really calls there is not something this extract can confirm.

### Gaps
- The long-distance relations in the extract are a sample (about 30 relations, many crossing the whole country), so "LD" counts show only that some long-distance trains are mapped, not how many call. Dadar Western's long-distance stops are not in any relation.
- Bandra Terminus and LTT have no stop area relation.

## 2. What does the data give per station: platforms, tracks, footbridges, roofs, buildings, entrances and station areas?

### Takeaway
Every station in the box has its platforms mapped, almost all as outlines (129 of 130), so lengths, widths and the tracks along each edge are known; the longest platform of a suburban station is mostly 260–355 m (190–210 m at Dockyard Road, Cotton Green and King's Circle) and platforms are mostly 5–11 m wide; the terminals reach 546–655 m. Footbridges are well mapped (100 networks with 124 spans over the tracks, at 41 stations) but only 9 networks carry a width tag. Roofs are mapped at 20 stations, station buildings at 39, entrances at only 13, and a proper station area polygon at only 3; no platform has a height tag.

### Cited Findings
- Platforms: 130 counted (129 outlines, 1 line at Vile Parle); 5 duplicate outlines left out of the counts (Bandra [relation/10664920](https://www.openstreetmap.org/relation/10664920) = [relation/10664919](https://www.openstreetmap.org/relation/10664919) and [relation/10664921](https://www.openstreetmap.org/relation/10664921) = [relation/10664922](https://www.openstreetmap.org/relation/10664922); LTT [way/1562064400](https://www.openstreetmap.org/way/1562064400) ≈ [relation/11205337](https://www.openstreetmap.org/relation/11205337); two Andheri platform nodes); 10 `railway=platform_edge` lines at Bandra and LTT carry the number of each platform face and are attached to their outline (`platforms[].edges`) — [osm-stations.json](../../osm-stations.json)
- Length and width are inferred from each outline as the rectangle of equal area and perimeter (the bounding rectangle of a curved platform is far too wide: Dadar Western platform 5 bounds 38.5 m wide but averages 9.8 m); both are in the file (`lengthM/widthM`, `boundingLengthM/boundingWidthM`) — [osm-stations.json `platforms[]`](../../osm-stations.json)
- Platform tags across the 130: `covered` 31, `shelter` 40, `lit` 45, `wheelchair` 16, `tactile_paving` 12, `level` 11, `layer` 6, `height` 0 — [osm-stations.json `platforms[].tags`](../../osm-stations.json)
- Tracks along platforms (inferred: track centreline within 4 m of the outline for at least 40 m or 30 % of the platform): over 265 platform edges the platform-edge-to-track-centreline distance has a median of 2.25 m (10th–90th percentile 1.56–3.25 m); each entry names the track way, side (compass), the services on it and its `service`/`usage` — [osm-stations.json `platforms[].tracks`](../../osm-stations.json)
- Raised levels in the data: Sandhurst Road's Harbour tracks are `bridge=viaduct, layer=1` ([way/1289154825](https://www.openstreetmap.org/way/1289154825), [way/1289154826](https://www.openstreetmap.org/way/1289154826)) with both Harbour platforms on `layer=1`; Bandra platform 2/3 is `layer=1`; LTT platforms 2/3, 4/5 and "platform 0" are `layer=-1`; Chinchpokli 1/2 is `level=-1`; no bridge or layer tag on the tracks along Kurla's platforms — [osm-stations.json `platforms[].tags`, `tracks[].tags`](../../osm-stations.json)
- Footbridges: 100 connected networks of `bridge=yes`/`layer≥1` footways that cross main-line tracks, with their steps (6 of them touch platforms of two stations and are listed under both, e.g. Dadar Western/Central, Parel/Prabhadevi); 124 spans over the tracks (inferred by grouping track crossings along the station); 51 networks partly `covered=yes`; 409 steps ways, 31 escalator ways (`conveying`) and 12 lift nodes (`highway=elevator`) on them; in all, 18 lift nodes are linked to 8 stations (Andheri 3, Kurla 3, Vadala Road 3, Govandi 2, Dadar Western 2, Parel 2, CSMT 2, Ghatkopar 1) — [osm-stations.json `footbridges[]`](../../osm-stations.json)
- Width tags on footbridges (9 networks): Khar Road 6 m ([way/48806654](https://www.openstreetmap.org/way/48806654)), Bandra Terminus 6, Mahim Junction 6.5/5/12, Dadar 12 ([way/49684320](https://www.openstreetmap.org/way/49684320), shared by both Dadars) and 6 ([way/49684321](https://www.openstreetmap.org/way/49684321)), Vadala Road 3, Parel and Prabhadevi (shared network) 14/3.5/6/8, Parel 6/4 and 6, Prabhadevi 6, Currey Road 5; everywhere else the file uses a script default of 4 m (steps 2.5 m), marked `widthSource: "default"` — [osm-stations.json `footbridges[].widthTaggedM`](../../osm-stations.json)
- Named skywalks joined to station footbridges: "Santacruz Skywalk" (network 2,264 m), "Bandra East Skywalk" (826 m), "Sky Walk (Vile Parle (west))" (617 m), "Vidyavihar Station Skywalk" (470 m), "Bandra Skywalk" (237 m), "Chembur Station Middle FOB" (629 m); unnamed elevated walkways that cross no track at Sion (260 m) and Cotton Green (468 m) — [osm-stations.json `footbridges[].name`](../../osm-stations.json)
- Pedestrian subways under the tracks: Churchgate (112 m, crosses 4 tracks) and Bandra Terminus (67 m, 6 tracks); other tunnel paths at Churchgate (262 m), Grant Road and CSMT — [osm-stations.json `footbridges[]` kind subway/tunnel](../../osm-stations.json)
- Two footway ways at Grant Road are tagged `footway=sidewalk` on a bridge (a road overbridge's pavement) and are kept apart as "road-bridge sidewalk" — [osm-stations.json](../../osm-stations.json)
- 20 more footways cross tracks 170–700 m from the nearest station platforms and are not assigned (list in `unassignedFootbridges`; table below) — [osm-stations.json `unassignedFootbridges`](../../osm-stations.json)
- Buildings assigned to stations: 145 — 66 roofs or platform structures (`building=roof`, `building:part=roof` or mostly over a platform), 66 station buildings (`building=train_station`/`transportation` or a station name), 12 over the tracks, 1 on a platform. CSMT alone has 24 roof pieces, among them `building:part=roof` with `roof:shape=gabled` over platforms 1–7 ([way/1315579597](https://www.openstreetmap.org/way/1315579597), [way/1315579598](https://www.openstreetmap.org/way/1315579598)) and the heritage building [way/107441516](https://www.openstreetmap.org/way/107441516) (`building:levels=7`) — [osm-stations.json `buildings[]`](../../osm-stations.json)
- Entrances: no `railway=train_station_entrance` node exists in the box; 31 `entrance=*` nodes are linked to 13 stations (on a station building, platform or footbridge outline, or within 25 m) — Dadar Western 7, Currey Road 5, Churchgate 4 — [osm-stations.json `entrances[]`](../../osm-stations.json)
- Ticket points (`shop=ticket`, ticket vending machines, "booking/ticket" names): 94 at 13 stations, most at Dadar Western (30), Andheri (15), Dadar Central (12), Santa Cruz (9) and CSMT (8) — [osm-stations.json `tickets[]`](../../osm-stations.json)
- Station area polygons (`railway=station` / `public_transport=station`) exist only at Kurla (2,399 m², [way/427199220](https://www.openstreetmap.org/way/427199220)), Bandra Terminus (83,169 m², [way/107303404](https://www.openstreetmap.org/way/107303404)) and Vadala Road (13,566 m², [way/1343435452](https://www.openstreetmap.org/way/1343435452)); 38 stations sit inside `landuse=railway` polygons (outline clipped to the station when over 250,000 m²; none at Khar Road, Tilak Nagar, Bandra Terminus, Govandi, Guru Tegh Bahadur Nagar) — [osm-stations.json `stationAreas[]`](../../osm-stations.json)
- Table: structures per station. Platforms = counted platforms (outlines), "+n dup" = duplicates left out; Tracks = tracks cut by the middle cross-section / distinct tracks along the platforms; Score = the script's 0–10 detail score (inferred) — [osm-stations.json `stations[].summary`](../../osm-stations.json)

| Station | Platforms (outlines) | Numbers mapped | Longest m | Widths m | Tracks mid-section / along platforms | FOB networks (spans over tracks) | Skywalk / subway / other | Roofs | Station bldgs | Entrances | Lifts | Ticket points | Station area | Score | Game stops |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Jogeshwari (Western Line) | 2 (2) | 1, 2, 3, 4 | 280.9 | 7.5–9.4 | 8 / 4 | 2 (2) | 0 / 0 / 0 | 0 | 3 | 0 | 0 | 1 | no | 8 | 2 |
| Andheri | 5 (5) +2 dup | 1, 2, 3, 4, 5, 6, 7, 8, 9 | 615.9 | 6–10.3 | 10 / 15 | 2 (5) | 0 / 0 / 0 | 0 | 4 | 1 | 3 | 15 | no | 8.5 | 6 |
| Vile Parle | 4 (3) | none | 315.9 | 5.7–8.7 | 7 / 7 | 4 (4) | 0 / 0 / 0 | 0 | 0 | 0 | 0 | 0 | no | 5.3 | 4 |
| Ghatkopar | 3 (3) | 1, 2, 3, 4 | 396.5 | 7.6–8.2 | 6 / 5 | 5 (5) | 0 / 0 / 0 | 3 | 2 | 0 | 1 | 3 | no | 9 | 4 |
| Santa Cruz | 3 (3) | 1, 2, 3, 4, 5, 6 | 272.2 | 7.5–9.4 | 7 / 10 | 1 (2) | 0 / 0 / 0 | 0 | 3 | 1 | 0 | 9 | no | 8.5 | 4 |
| Vidyavihar | 2 (2) | 1, 2 | 268.8 | 7.1–9 | 8 / 2 | 2 (2) | 0 / 0 / 0 | 1 | 2 | 0 | 0 | 0 | no | 8 | 2 |
| Lokmanya Tilak Terminus | 5 (5) +1 dup | 1, 2, 3, 4, 5, 6, 7 | 654.6 | 9.3–20.9 | 13 / 7 | 1 (1) | 0 / 0 / 0 | 1 | 1 | 0 | 0 | 0 | no | 8 | 0 |
| Khar Road | 4 (4) | 1A, 1, 2, 3, 4, 5, 6 | 287.1 | 8.3–9.7 | 7 / 6 | 1 (3) | 0 / 0 / 0 | 1 | 1 | 1 | 0 | 5 | no | 9.5 | 4 |
| Tilak Nagar | 2 (2) | 1, 2 | 275.3 | 8.7–9.1 | 2 / 2 | 2 (2) | 0 / 0 / 1 | 0 | 1 | 2 | 0 | 0 | no | 8.5 | 2 |
| Kurla | 3 (3) | 1, 2, 5, 6, 7, 8 | 339.5 | 8.5–9.5 | 11 / 7 | 4 (7) | 0 / 0 / 0 | 4 | 2 | 0 | 3 | 0 | yes | 9.5 | 6 |
| Bandra Terminus | 4 (4) | 1, 2, 3, 4, 5, 6, 7 | 640.8 | 6.5–12.1 | 9 / 8 | 1 (4) | 0 / 1 / 0 | 0 | 2 | 0 | 0 | 0 | yes | 8.5 | 0 |
| Chembur | 1 (1) | none | 293.4 | 11–11 | 2 / 2 | 2 (2) | 0 / 0 / 0 | 0 | 1 | 0 | 0 | 4 | no | 7 | 2 |
| Govandi | 2 (2) | none | 282.1 | 7.6–8.8 | 2 / 2 | 4 (4) | 0 / 0 / 0 | 0 | 1 | 0 | 2 | 0 | no | 7 | 2 |
| Bandra | 4 (4) +2 dup | 1, 2, 3, 4, 5, 6, 7 | 342 | 6.6–9.2 | 7 / 11 | 4 (5) | 0 / 0 / 0 | 6 | 2 | 0 | 0 | 1 | no | 9 | 6 |
| Chuna Bhatti | 2 (2) | 1, 2 | 354.8 | 6.7–10.7 | 2 / 2 | 2 (2) | 0 / 0 / 0 | 0 | 0 | 0 | 0 | 0 | no | 7 | 2 |
| Sion | 2 (2) | 1, 2, 3 | 270.5 | 7–9 | 4 / 3 | 3 (3) | 1 / 0 / 0 | 1 | 1 | 0 | 0 | 0 | no | 9 | 2 |
| Mahim Junction | 4 (4) | 1, 2, 3, 5, 6 | 280.6 | 5–9.5 | 10 / 10 | 2 (6) | 0 / 0 / 0 | 0 | 2 | 0 | 0 | 0 | no | 7 | 4 |
| Guru Tegh Bahadur Nagar | 1 (1) | none | 280.2 | 10.7–10.7 | 2 / 1 | 3 (3) | 0 / 0 / 0 | 0 | 2 | 0 | 0 | 0 | no | 7 | 2 |
| King's Circle | 2 (2) | 1, 2 | 209.1 | 5.5–6.5 | 2 / 2 | 1 (1) | 0 / 0 / 0 | 0 | 0 | 0 | 0 | 0 | no | 7 | 2 |
| Matunga Road | 1 (1) | none | 309.3 | 10.8–10.8 | 6 / 2 | 2 (2) | 0 / 0 / 0 | 0 | 1 | 0 | 0 | 0 | no | 7 | 2 |
| Matunga | 2 (2) | 1, 2, 3, 4 | 269.6 | 7.7–9.2 | 5 / 4 | 2 (3) | 0 / 0 / 0 | 2 | 0 | 0 | 0 | 0 | no | 8 | 2 |
| Dadar (DDR) | 4 (4) | 1, 2, 3, 4, 5 | 922.3 | 5.6–10 | 5 / 6 | 5 (7) | 0 / 0 / 0 | 2 | 1 | 7 | 2 | 30 | no | 9.5 | 8 |
| Dadar (DR) | 5 (5) | 8, 9, 9A, 10, 11, 12, 13, 14 | 612.7 | 7.1–10 | 7 / 7 | 6 (8) | 0 / 0 / 1 | 3 | 2 | 0 | 0 | 12 | no | 9 | 8 |
| Vadala Road | 3 (3) | 1, 2, 3, 4 | 289.2 | 6.4–9.9 | 7 / 4 | 3 (3) | 0 / 0 / 0 | 0 | 3 | 0 | 3 | 0 | yes | 8.5 | 4 |
| Parel | 3 (3) | 1, 2, 2A, 3 | 411.1 | 6.3–7.7 | 7 / 5 | 3 (4) | 0 / 0 / 0 | 2 | 1 | 0 | 2 | 1 | no | 8 | 2 |
| Prabhadevi | 1 (1) | 1, 2 | 334.3 | 9.1–9.1 | 7 / 5 | 4 (6) | 0 / 0 / 0 | 0 | 3 | 2 | 0 | 0 | no | 8.5 | 2 |
| Sewri | 2 (2) | none | 267.4 | 6.3–6.7 | 3 / 3 | 3 (3) | 0 / 0 / 0 | 0 | 1 | 0 | 0 | 0 | no | 7 | 4 |
| Lower Parel | 2 (2) | 1, 2, 3 | 291.2 | 8.3–9.4 | 6 / 3 | 2 (2) | 0 / 0 / 0 | 0 | 1 | 0 | 0 | 0 | no | 8 | 2 |
| Currey Road | 1 (1) | 1, 2 | 266.7 | 8–8 | 4 / 2 | 3 (3) | 0 / 0 / 0 | 1 | 2 | 5 | 0 | 0 | no | 9.5 | 2 |
| Chinchpokli | 1 (1) | 1, 2 | 271.5 | 7–7 | 4 / 2 | 2 (2) | 0 / 0 / 0 | 1 | 1 | 0 | 0 | 0 | no | 9 | 2 |
| Cotton Green | 2 (2) | none | 205.7 | 5.2–6.5 | 2 / 2 | 0 (0) | 1 / 0 / 0 | 0 | 1 | 0 | 0 | 0 | no | 5 | 4 |
| Mahalaxmi | 1 (1) | 1, 2 | 291.6 | 9.5–9.5 | 7 / 4 | 2 (3) | 0 / 0 / 0 | 0 | 1 | 0 | 0 | 0 | no | 8 | 2 |
| Reay Road | 2 (2) | 1, 2 | 260 | 7.5–8.8 | 2 / 2 | 2 (2) | 0 / 0 / 0 | 0 | 1 | 0 | 0 | 0 | no | 8 | 4 |
| Byculla | 3 (3) | 1, 2, 3, 4 | 333.9 | 6.7–8.5 | 4 / 4 | 3 (3) | 0 / 0 / 0 | 1 | 1 | 0 | 0 | 0 | no | 9 | 4 |
| Mumbai Central | 6 (6) | 1, 2, 12, 3, 4, 5 | 546.1 | 7.7–49.5 | 12 / 14 | 3 (4) | 0 / 0 / 1 | 6 | 2 | 2 | 0 | 4 | no | 8.5 | 4 |
| Dockyard Road | 2 (2) | none | 192.6 | 5.3–5.7 | 2 / 2 | 0 (0) | 0 / 0 / 1 | 0 | 1 | 0 | 0 | 0 | no | 5 | 4 |
| Grant Road | 3 (3) | 1, 2, 3, 4 | 320.4 | 5.7–9 | 6 / 7 | 3 (3) | 0 / 0 / 3 | 1 | 2 | 0 | 0 | 0 | no | 9 | 4 |
| Sandhurst Road | 3 (3) | 1, 2 | 299.8 | 5.3–7.5 | 13 / 4 | 1 (2) | 0 / 0 / 0 | 3 | 1 | 1 | 0 | 0 | no | 8.5 | 6 |
| Masjid | 2 (2) | 1, 2, 3, 4 | 278.9 | 5.7–6.7 | 8 / 4 | 2 (2) | 0 / 0 / 0 | 2 | 1 | 0 | 0 | 0 | no | 9 | 6 |
| Charni Road | 3 (3) | 1, 2, 3, 4 | 286.1 | 5.3–6.8 | 4 / 5 | 2 (3) | 0 / 0 / 0 | 0 | 1 | 1 | 0 | 0 | no | 8.5 | 4 |
| Marine Lines | 3 (3) | 1, 2, 3, 4 | 298.9 | 6.1–6.8 | 4 / 8 | 3 (3) | 0 / 0 / 0 | 0 | 1 | 2 | 0 | 0 | no | 8.5 | 4 |
| Mumbai CSMT | 14 (14) | 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18 | 637.4 | 4.3–11.6 | 21 / 29 | 2 (3) | 0 / 0 / 1 | 24 | 5 | 2 | 2 | 8 | no | 9.5 | 8 |
| Churchgate | 6 (6) | 1, 2, 3, 4 | 346.9 | 3.5–8 | 4 / 7 | 2 (2) | 0 / 1 / 2 | 1 | 2 | 4 | 0 | 1 | no | 8.5 | 4 |

- Table: South Mumbai stations, the middle cross-section across the station (inferred from the mapped outlines and track centrelines; positions in metres are in `crossSections[].items[].offsetM/fromM/toM`), and the gaps found — [osm-stations.json `crossSections`, `gaps`](../../osm-stations.json)

| Station | Middle cross-section, from the negative to the positive side (T = track with its services; [P n w] = platform n, w metres wide) | Gaps |
|---|---|---|
| Mahim Junction (E positive) | [P1 4.8] T(W slow) T(W slow) [P2/3 8.8] T(W fast+LD) T(W fast+LD) [P? 4.9] T(H) [P5/6 9.9] T(H) T(yard) T(yard) T(yard) T(yard) | 1 of 4 platform(s) without a number (ref/local_ref/name); no platform roofs mapped; no station area polygon (railway=station / public_transport=station); no entrances mapped; platform numbers missing from the mapped refs: 4 |
| Guru Tegh Bahadur Nagar (SE positive) | T(H) [P? 10.3] T(H) | 1 of 1 platform(s) without a number (ref/local_ref/name); no footbridge width tagged; no platform roofs mapped; no station area polygon (railway=station / public_transport=station); no entrances mapped; no Marathi name (name:mr) |
| King's Circle (NE positive) | [P1 4.7] T(H) T(H) [P2 6.5] | no footbridge width tagged; no platform roofs mapped; no station building identified; no station area polygon (railway=station / public_transport=station); no entrances mapped |
| Matunga Road (E positive) | T(W slow) [P? 11.7] T(W slow) T(W fast+LD) T(W fast+LD) T T(yard) | 1 of 1 platform(s) without a number (ref/local_ref/name); no footbridge width tagged; no platform roofs mapped; no station area polygon (railway=station / public_transport=station); no entrances mapped |
| Matunga (SE positive) | T(siding) T(C slow) [P1/2 9.2] T(C slow) T(C fast+LD) [P3/4 7.7] T(C fast+LD) | no footbridge width tagged; no station building identified; no station area polygon (railway=station / public_transport=station); no entrances mapped |
| Dadar (DDR) (SE positive) | [P1 6.9] T(W slow) T(W slow) [P2/3 11.7] T(W fast+LD) T(W fast+LD) [P4 6.3] T [P5 11.1] | no station area polygon (railway=station / public_transport=station) |
| Dadar (DR) (SE positive) | T T(C slow) T(siding) T(C slow) [P9/9A 10.5] T(LD) [P10/11 6.2] T(C fast+LD) T(C fast+LD) [P12 5.3] [P13/14 19.4] | no station area polygon (railway=station / public_transport=station); no entrances mapped; platform numbers missing from the mapped refs: 1, 2, 3, 4, 5, 6, 7 |
| Vadala Road (SE positive) | [P1 6.3] T(H) T(H) [P2/3 9.6] T(H) T(H) [P4 7.8] T(yard) T(siding) T(yard) | no platform roofs mapped; no entrances mapped; no Marathi name (name:mr) |
| Parel (SE positive) | T T(yard) T(C slow) [P1/2 7.6] T [P2A/3 8.1] T(C slow) T(C fast+LD) [P? 6.3] T(C fast+LD) | 1 of 3 platform(s) without a number (ref/local_ref/name); no station area polygon (railway=station / public_transport=station); no entrances mapped |
| Prabhadevi (SE positive) | T(yard) T(W slow) [P1/2 9.5] T(W slow) T(W fast+LD) T(W fast+LD) T T(C slow) | no platform roofs mapped; no station area polygon (railway=station / public_transport=station) |
| Sewri (E positive) | [P? 6.6] T(H) T(H) [P? 6.9] T(siding) | 2 of 2 platform(s) without a number (ref/local_ref/name); no footbridge width tagged; no platform roofs mapped; no station area polygon (railway=station / public_transport=station); no entrances mapped; no Marathi name (name:mr) |
| Lower Parel (SE positive) | T(yard) [P1 9.9] T(W slow) T(W slow) [P2/3 10.6] T(W fast+LD) T(W fast+LD) T | no footbridge width tagged; no platform roofs mapped; no station area polygon (railway=station / public_transport=station); no entrances mapped |
| Currey Road (E positive) | T(C slow) [P1/2 8] T(C slow) T(C fast+LD) T(C fast+LD) | no station area polygon (railway=station / public_transport=station) |
| Chinchpokli (E positive) | T(C slow) [P1/2 6.7] T(C slow) T(C fast+LD) T(C fast+LD) | no footbridge width tagged; no station area polygon (railway=station / public_transport=station); no entrances mapped |
| Cotton Green (SE positive) | [P? 7] T(H) T(H) [P? 5.7] | 2 of 2 platform(s) without a number (ref/local_ref/name); no foot overbridge crossing the tracks mapped; no footbridge width tagged; no platform roofs mapped; no station area polygon (railway=station / public_transport=station); no entrances mapped; no Marathi name (name:mr) |
| Mahalaxmi (SE positive) | T(yard) T(W slow) [P1/2 9.8] T(W slow) T(W fast+LD) T(W fast+LD) T T(yard) | no footbridge width tagged; no platform roofs mapped; no station area polygon (railway=station / public_transport=station); no entrances mapped |
| Reay Road (E positive) | [P1 7.5] T(H) T(H) [P2 8.8] | no footbridge width tagged; no platform roofs mapped; no station area polygon (railway=station / public_transport=station); no entrances mapped; no Marathi name (name:mr) |
| Byculla (E positive) | [P1 6.9] T(C slow) T(C slow) [P2/3 8.5] T(C fast+LD) T(C fast+LD) [P4 8.9] | no footbridge width tagged; no station area polygon (railway=station / public_transport=station); no entrances mapped |
| Mumbai Central (E positive) | T(yard) T(W slow) [P1/2 9.7] T(W slow) T(W fast) [P3/4 9.2] T(W fast) T(siding) T(yard) T(LD) [P1/12 12.3] T(LD) T(LD) [P3/4 13.4] T T [P5 13.4] | 1 of 6 platform(s) without a number (ref/local_ref/name); 1 platform(s) with no track found along an edge; no footbridge width tagged; no station area polygon (railway=station / public_transport=station); platform numbers missing from the mapped refs: 6, 7, 8, 9, 10, 11 |
| Dockyard Road (E positive) | [P? 5.1] T(H) T(H) [P? 4.9] | 2 of 2 platform(s) without a number (ref/local_ref/name); no foot overbridge crossing the tracks mapped; no footbridge width tagged; no platform roofs mapped; no station area polygon (railway=station / public_transport=station); no entrances mapped; no Marathi name (name:mr) |
| Grant Road (SE positive) | [P1 7.8] T(W slow) T(W slow) [P2/3 6.6] T(W fast) T(W fast) [P4 8.2] T(yard) T(yard) | no footbridge width tagged; no station area polygon (railway=station / public_transport=station); no entrances mapped |
| Sandhurst Road (SE positive) | T(C slow) [P1/2 12.5] T(C slow) T(C fast+LD) T(C fast+LD) T(yard) T(siding) T(siding) T(yard) T(yard) [P? 5.1] T(H) T(yard) T(H) [P? 5.1] T(yard) | 2 of 3 platform(s) without a number (ref/local_ref/name); no footbridge width tagged; no station area polygon (railway=station / public_transport=station) |
| Masjid (E positive) | T(H) [P1/2 6.6] T(H) T(C slow) [P3/4 5.8] T(C slow) T(C fast+LD) T(LD) T(C fast+LD) T(siding) | no footbridge width tagged; no station area polygon (railway=station / public_transport=station); no entrances mapped |
| Charni Road (NE positive) | [P1 11.1] T(W slow) T(W slow) [P2/3 5.7] T(W fast) T(W fast) [P4 6.2] | no footbridge width tagged; no platform roofs mapped; no station area polygon (railway=station / public_transport=station) |
| Marine Lines (NE positive) | [P1 6.8] T(W slow) T(W slow) [P2/3 7.1] T(W fast) T(W fast) [P4 7.1] | no footbridge width tagged; no platform roofs mapped; no station area polygon (railway=station / public_transport=station) |
| Mumbai CSMT (E positive) | T(H) [P1/2 6.5] T(H) [P2/3 7.9] T(C slow) [P3/4 7.5] T(C slow) [P4/5 8.5] T(C fast) [P5/6 5] T(C fast) [P6/7 12.6] T(siding) [P7/8 4.3] T(LD) [P8/9 8] T(LD) T(siding) T(siding) T(siding) T [P10/11 8.2] T T [P12/13 10.6] T T [P14/15 10.6] T T [P16/17 10.1] T T [P18 11] | no footbridge width tagged; no station area polygon (railway=station / public_transport=station) |
| Churchgate (E positive) | [P1 4.8] T(W slow) [P1/2 7.4] T [P2/3 7.3] T [P3/4 7.3] T(W fast) [P4 3.8] | 1 of 6 platform(s) without a number (ref/local_ref/name); 1 platform(s) with no track found along an edge; no footbridge width tagged; no station area polygon (railway=station / public_transport=station) |

- Table: footways that cross tracks but lie too far from any station's platforms to be assigned — [osm-stations.json `unassignedFootbridges`](../../osm-stations.json)

| Nearest station | Distance m | Tracks crossed | Deck m | Name | Ways |
|---|---|---|---|---|---|
| Charni Road (CYR) | 468 | 4 | 25.7 | — | way/48050550, way/48050551, way/48050549 |
| Charni Road (CYR) | 476 | 4 | 22.8 | — | way/48050556, way/48050557, way/48050555 |
| Grant Road (GTR) | 211 | 5 | 356.9 | — | way/48750038, way/48806924, way/48750046 |
| Grant Road (GTR) | 204 | 5 | 355.3 | — | way/48750042, way/48806921, way/48749229 |
| Mahim Junction (MM) | 497 | 5 | 74 | — | way/53350007, way/990599354, way/990599352 |
| Masjid (MSD) | 251 | 7 | 39.1 | — | way/72272670, way/1206787114, way/1206787113 |
| Marine Lines (MEL) | 323 | 4 | 84.1 | — | way/107607541, way/987803974, way/987803973 |
| Churchgate (CCG) | 274 | 6 | 88.3 | — | way/107607544, way/988125062, way/988125061 … |
| Kurla (CLA) | 170 | 8 | 86.6 | Foot over bridge | way/122303833, way/427199209 |
| Kurla (CLA) | 510 | 7 | 50.5 | — | way/122303835, way/427199193, way/427199188 |
| Chuna Bhatti (CHF) | 701 | 7 | 58.6 | — | way/122303836, way/1353492609, way/1353492607 … |
| King's Circle (KCE) | 216 | 4 | 38.5 | — | way/205623808 |
| Guru Tegh Bahadur Nagar (GTBN) | 271 | 2 | 36.8 | — | way/235867421 |
| Guru Tegh Bahadur Nagar (GTBN) | 585 | 4 | 34.5 | — | way/236391223, way/236391224, way/122166650 |
| Guru Tegh Bahadur Nagar (GTBN) | 224 | 2 | 46.2 | — | way/260760414 |
| Reay Road (RRD) | 391 | 1 | 73.7 | — | way/625809296 |
| Vadala Road | 596 | 2 | 58.2 | — | way/626382672 |
| Kurla (CLA) | 296 | 10 | 122.5 | — | way/940627933, way/1523671895, way/1523671894 |
| Vile Parle (VLP) | 509 | 8 | 52.3 | — | way/1123427090, way/1123427088, way/1123427089 |
| Chembur (CMBR) | 206 | 2 | 19.4 | — | way/1127314719 |

### Inferences
- Churchgate's outlines put a platform strip on both sides of each of its four tracks (side strips 1 and 4 only 3.5–4.8 m wide), and CSMT's middle section crosses 21 tracks with suburban platforms 1–7 (Harbour and Central) west of the long-distance platforms 8–18 (from the cross-sections above).
- A footbridge network can hold several physical bridges joined by a long deck (Dadar's 1,038 m network, Grant Road's 789 m); `spansOverTracks` (with its position along the station) is the better count of bridges to build.
- Platform height has to come from outside this data (no `height` tag anywhere).

### Gaps
- 34 of 43 stations have no width on any of their footbridges; 4 m is a placeholder, not data.
- 23 stations have no platform roof mapped (e.g. Andheri, Santa Cruz, Charni Road, Marine Lines, Mahalaxmi, Lower Parel), although 31 platforms carry `covered=yes` and 40 `shelter=yes`: roof outlines must be drawn by hand from those tags.
- Escalators and lifts are mapped at a few big stations only; steps exist almost everywhere.

## 3. Which stations have good OpenStreetMap detail, and which have gaps to fill by hand?

### Takeaway
Detail is good across the box: 24 stations score 8.5 or more out of 10 (CSMT, both Dadars, Kurla, Khar Road, Currey Road at the top); the weakest are Vile Parle (no platform numbers, one line platform, no station building), Cotton Green and Dockyard Road (no footbridge across the tracks, no numbers, no roofs). The universal gaps are station area polygons (missing at 40), entrances (missing at 30), footbridge widths (34) and roofs (23).

### Cited Findings
- Gap counts across the 43 stations: no station area polygon 40; no footbridge width 34; no entrance 30; no platform roof 23; some platforms without a number 15 (Vile Parle, Vidyavihar, LTT, Chembur, Govandi, Mahim Junction, Guru Tegh Bahadur Nagar, Matunga Road, Parel, Sewri, Cotton Green, Mumbai Central, Dockyard Road, Sandhurst Road, Churchgate); no Marathi name 10; no station building 4 (Vile Parle, Chuna Bhatti, King's Circle, Matunga); no footbridge across the tracks 2 (Cotton Green, Dockyard Road); a platform as a line only 1 (Vile Parle) — [osm-stations.json `stations[].gaps`](../../osm-stations.json)
- Detail scores (inferred, 0–10): 9.5 Khar Road, Kurla, Dadar Western, Currey Road, CSMT; 9 Ghatkopar, Bandra, Sion, Dadar Central, Chinchpokli, Byculla, Grant Road, Masjid; 8.5 Andheri, Santa Cruz, Tilak Nagar, Bandra Terminus, Vadala Road, Prabhadevi, Mumbai Central, Sandhurst Road, Charni Road, Marine Lines, Churchgate; 8 Jogeshwari, Vidyavihar, LTT, Matunga, Parel, Lower Parel, Mahalaxmi, Reay Road; 7 Chembur, Govandi, Chuna Bhatti, Mahim Junction, Guru Tegh Bahadur Nagar, King's Circle, Matunga Road, Sewri; 5.3 Vile Parle; 5 Cotton Green, Dockyard Road — [osm-stations.json `index[].detailScore`](../../osm-stations.json)
- Platform numbering gaps: Kurla's refs are 1, 2, 5, 6, 7, 8 (3 and 4 missing); Mahim Junction lacks 4; Dadar Central's refs start at 8 (Dadar Western has 1–5); Mumbai Central's express platform [way/807749599](https://www.openstreetmap.org/way/807749599) has ref "1/12" but name "Platform 1, 2 (express)", while the local platforms are also numbered 1–4 by name — [osm-stations.json `platforms[].refs`](../../osm-stations.json)
- Data issues found (8): the duplicates above; two outlines with no track along them that look like concourses (Mumbai Central [way/207540456](https://www.openstreetmap.org/way/207540456), 49.5 m × 118 m, `covered=yes`; LTT "platform 0" [relation/11205336](https://www.openstreetmap.org/relation/11205336)); a small Churchgate outline with no track ([way/803121203](https://www.openstreetmap.org/way/803121203)); platform outlines overlapping a track centreline at Guru Tegh Bahadur Nagar ([way/427248431](https://www.openstreetmap.org/way/427248431), 46 samples) and Dadar Western platform 1 ([way/220303381](https://www.openstreetmap.org/way/220303381)) — [osm-stations.json `issues`](../../osm-stations.json)
- Three platforms carry only `public_transport=platform` without `railway=platform`: Andheri 8/9 ([way/257491053](https://www.openstreetmap.org/way/257491053)), LTT 6/7 ([way/1502513589](https://www.openstreetmap.org/way/1502513589)), Khar Road 1A ([way/1467362003](https://www.openstreetmap.org/way/1467362003)) — [osm-stations.json `platforms[].tags`](../../osm-stations.json)
- A track tagged `bridge=boardwalk, layer=2` runs along Sewri's platforms ([way/398294953](https://www.openstreetmap.org/way/398294953)) — [osm-stations.json `tracks[]`](../../osm-stations.json)

### Inferences
- South Mumbai is in good shape for building: all 27 stations there have platform outlines with tracks along them; the hand-work is mostly roofs (missing at 14 of the 27), footbridge widths, entrances and numbering at the Harbour stations (Sewri, Cotton Green, Dockyard Road, Sandhurst Road's elevated Harbour platforms).
- Cotton Green and Dockyard Road need their crossing footbridge (or subway) placed by hand; the data has only a skywalk-type walkway at Cotton Green that does not cross the tracks.

### Gaps
- The score only counts what is mapped; it cannot tell whether a mapped platform, roof or bridge matches today's real layout. A visual check against imagery is still needed for stations being rebuilt (Parel/Prabhadevi footbridges, Andheri, Dadar).

## 4. Which metro and monorail stations interchange with the local stations?

### Takeaway
From the existing metro extract (not duplicated here), operational metro or monorail stations stand within 450 m of 13 local stations: Ghatkopar (Line 1, 92 m), Vadala Road (Monorail Wadala Bridge, 147 m), Currey Road (Monorail Lower Parel, 150 m), Grant Road (Line 3, 195 m), Mumbai Central (Line 3 Jagannath Shankar Sheth, 201 m), Andheri (Line 1, 272 m), Lower Parel (Monorail, 291 m), Mahalaxmi (Line 3, 336 m), Marine Lines (Line 3 Kalbadevi, 371 m), Chembur (Monorail, 405 m), CSMT (Line 3, 415 m), Charni Road (Line 3 Girgaon, 419 m), Churchgate (Line 3, 442 m); Dadar Western is 619 m from Line 3 Dadar. Distances run from the metro station point to the local station node or platform centre, whichever is nearer.

### Cited Findings
- Table: metro and monorail stations (any status) within 700 m of each local station, with their id in osm-metro.json — [osm-stations.json `stations[].metroNearby`](../../osm-stations.json), from [osm-metro.json](../../osm-metro.json)

| Station | Metro / monorail stations within 700 m (osm-metro.json id; lines; status; level; distance) |
|---|---|
| Jogeshwari (Western Line) | Momin Nagar Station (stops:9132708002; mumbai-metro-6-relation-7898711; construction; elevated; 485 m)<br>Jogeshwari Metro Station (Harbour) - West (way/1170388401; no line; operational; unknown; 522 m)<br>JVLR Station (stops:9132708009; mumbai-metro-6-relation-7898711; construction; elevated; 689 m) |
| Andheri | Andheri L1 (node/6020955334; mumbai-metro-1; operational; elevated; 272 m) |
| Vile Parle | Nanavati Hospital (node/5219622334; mumbai-metro-2-relation-7898712; construction; elevated; 622 m) |
| Ghatkopar | Ghatkopar L1 (way/151205149; mumbai-metro-1; operational; elevated; 92 m)<br>Pant Nagar Station (stops:9132436362; mumbai-metro-4-relation-7898732; construction; elevated; 598 m) |
| Santa Cruz | Khira Nagar (node/5219622327; mumbai-metro-2-relation-7898712; construction; elevated; 408 m)<br>Santacruz (node/12074909130; mumbai-metro-3; operational; underground; 616 m) |
| Khar Road | National College (node/5219622332; mumbai-metro-2-relation-7898712; construction; elevated; 475 m)<br>Saraswat Nagar (node/5219622325; mumbai-metro-2-relation-7898712; construction; elevated; 651 m) |
| Tilak Nagar | Kurla (node/5219622419; mumbai-metro-2-relation-7898712; construction; elevated; 659 m) |
| Kurla | Kurla (node/5219622419; mumbai-metro-2-relation-7898712; construction; elevated; 616 m) |
| Bandra Terminus | National College (node/5219622332; mumbai-metro-2-relation-7898712; construction; elevated; 459 m) |
| Chembur | Chembur (node/632337506; mumbai-monorail-1; operational; elevated; 405 m)<br>Amar Mahal Junction Station (stops:9132436365; mumbai-metro-4-relation-7898732; construction; elevated; 543 m) |
| Mahim Junction | Shitala Devi Mandir (node/12855459846; mumbai-metro-3; operational; underground; 546 m)<br>Dharavi (node/12855459847; mumbai-metro-3; operational; underground; 676 m) |
| Guru Tegh Bahadur Nagar | Guru Tegh Bahadur Nagar (node/3806743193; mumbai-monorail-1; operational; elevated; 694 m) |
| Dadar (DDR) | Dadar (node/12855459845; mumbai-metro-3; operational; underground; 619 m)<br>SBI-Dadar Metro (node/14144295508; no line; operational; underground; 675 m) |
| Vadala Road | Wadala Bridge (node/3732540593; mumbai-monorail-1; operational; elevated; 147 m)<br>BPT Hospital (node/5225899320; no line; proposed; underground; 589 m) |
| Sewri | Sewri (node/10244200822; no line; proposed; underground; 67 m) |
| Lower Parel | Lower Parel (node/6498408219; mumbai-monorail-1; operational; elevated; 291 m) |
| Currey Road | Lower Parel (node/6498408219; mumbai-monorail-1; operational; elevated; 150 m) |
| Chinchpokli | Sant Gadge Maharaj Chowk (node/3806743194; mumbai-monorail-1; operational; elevated; 599 m)<br>Lower Parel (node/6498408219; mumbai-monorail-1; operational; elevated; 668 m) |
| Mahalaxmi | Mahalaxmi (node/13192130535; mumbai-metro-3; operational; underground; 336 m)<br>Sant Gadge Maharaj Chowk (node/3806743194; mumbai-monorail-1; operational; elevated; 464 m) |
| Reay Road | Reay Road (node/5225899286; no line; proposed; underground; 194 m) |
| Byculla | Byculla (node/12902121976; no line; proposed; underground; 116 m) |
| Mumbai Central | Jagannath Shankar Sheth Metro (node/13192130534; mumbai-metro-3; operational; underground; 201 m) |
| Grant Road | Grant Road (node/13207029325; mumbai-metro-3; operational; underground; 195 m) |
| Charni Road | Girgaon (node/13207029324; mumbai-metro-3; operational; underground; 419 m) |
| Marine Lines | Kalbadevi (node/13207029323; mumbai-metro-3; operational; underground; 371 m) |
| Mumbai CSMT | CSMT Metro (node/5225899267; no line; proposed; underground; 107 m)<br>Chhatrapati Shivaji Maharaj Terminus (node/13207029322; mumbai-metro-3; operational; underground; 415 m)<br>Crawford Market (node/9132436353; no line; proposed; underground; 580 m) |
| Churchgate | Churchgate (node/13207029319; mumbai-metro-3; operational; underground; 442 m)<br>Hutatma Chowk (node/13207029320; mumbai-metro-3; operational; underground; 579 m) |

- Stop area groups in the data that link locals and metro: "Andheri" [relation/7684033](https://www.openstreetmap.org/relation/7684033) groups the Line 1 stop area [relation/4657061](https://www.openstreetmap.org/relation/4657061) (station "Andheri L1", node/6020955334 in osm-metro.json) with the suburban "Andheri Railway Station" stop area [relation/7684031](https://www.openstreetmap.org/relation/7684031) — [osm-metro.json](../../osm-metro.json), extract

### Inferences
- Line 3 runs under the Western line's South Mumbai stations (Churchgate, Marine Lines→Kalbadevi, Charni Road→Girgaon 419 m, Grant Road, Mumbai Central, Mahalaxmi), so one underground interchange pattern can be reused there.

### Gaps
- Several proposed underground stations next to local stations (CSMT Metro 107 m, Byculla 116 m, Reay Road 194 m, Sewri 67 m) have no line in osm-metro.json; their status is "proposed" as tagged, and which line they belong to is not in this data.

## 5. What does the game already build at stations, and how is the extraction rerun?

### Takeaway
Today the converter draws `railway=platform` outlines as paved ground 0.21 m high, uses platform edges to place each train stop, raises buildings mapped over the tracks clear of the trains, and draws footbridges as flat 2.2 m footways at kerb height across the tracks; Harbour viaduct tracks stay on the ground. This data adds what is missing for real stations: platform numbers and tracks per edge, footbridge networks with landings, roofs and buildings per station, cross-sections, and gaps. Rerun with `node scripts/research/stations-from-osm.mjs` (about 7 s).

### Cited Findings
- Platform outlines: `classifyArea` returns `AREA.PLATFORM` for `railway=platform` ([scripts/build-tiles.mjs:127](../../../../../scripts/build-tiles.mjs)); the tile worker draws it as "paved" at `Y.KERB + 0.01` ([src/world/mesh/ground.js:15](../../../../../src/world/mesh/ground.js)), with `Y.KERB = 0.2` m ([src/world/levels.js](../../../../../src/world/levels.js)). Outlines with only `public_transport=platform` are not drawn (same rule).
- Train stops: platform ways (`railway=platform` or `public_transport=platform` + `train=yes`) and `railway=platform` multipolygon outlines become platform edges for `buildTrainLines` ([scripts/build-tiles.mjs:362, :433](../../../../../scripts/build-tiles.mjs)); a stop moves to the middle of the platform stretch whose edge is within 4.9 m of the track (`PLATFORM`), with a 12-coach train of 252 m (`TRAIN`, changed from 245 in the working tree today) ([scripts/lib/trains.mjs](../../../../../scripts/lib/trains.mjs)). Run on this extract it gives 12 lines, 144 stops at 40 station names; LTT and Bandra Terminus get none (suburban services only) — [osm-stations.json `stations[].game`](../../osm-stations.json)
- Station names for unnamed stops come from `railway=station|halt` nodes ([scripts/build-tiles.mjs:345](../../../../../scripts/build-tiles.mjs)); CSMT is shown as "Chhatrapati Shivaji Maharaj Terminus" (`stationName` in [scripts/lib/trains.mjs](../../../../../scripts/lib/trains.mjs)).
- Buildings over the tracks (8 m or more of track inside, or roof/station types reaching over a coach) are raised to `TRAIN_CLEARANCE = 6.2` m: roofs and big halls become a thin roof (+0.8 m), small station buildings a booking office (+3.2 m), and they stop colliding ([scripts/build-tiles.mjs:607–631, :941–947](../../../../../scripts/build-tiles.mjs)).
- Footways: `highway=footway` 2.2 m and `steps` 2 m default widths ([scripts/build-tiles.mjs:156–157](../../../../../scripts/build-tiles.mjs)); `bridge=yes` only sets `ROAD_FLAG.BRIDGE` ([:171](../../../../../scripts/build-tiles.mjs)); the worker draws footways as flat ribbons at `Y.KERB + 0.012` ([src/world/mesh/ground.js:163–175](../../../../../src/world/mesh/ground.js)). Bridged rails keep only `RAIL_FLAG.BRIDGE` ([:182](../../../../../scripts/build-tiles.mjs)), so the Sandhurst Road Harbour viaduct is flat.
- At run time, `src/sim/trains.js` puts waiting people along the platform edge (`stationLife`), opens the ticket window with E, rides by fade and shows station markers on the map ([src/sim/trains.js](../../../../../src/sim/trains.js)); the plan lists "raised platforms and edges" as still to do ([docs/plan.md, item 3.4](../../../../plan.md)).
- Rerun: `node scripts/research/stations-from-osm.mjs [--input data/raw/mumbai-region.osm.pbf] [--out docs/research/metro/osm-stations.json] [--metro docs/research/metro/osm-metro.json] [--tolerance 0.5]`; needs the repository's npm packages (pbf, lineclip, clipper-lib); reads the extract three times (relations, nodes, ways) and imports `scripts/lib/trains.mjs`, so the `game` block follows changes to that library — [scripts/research/stations-from-osm.mjs](../../../../../scripts/research/stations-from-osm.mjs)
- File layout: `meta` (source, ODbL, extract date 2026-11-13, projection, field notes, defaults, counts), `index` (one summary row per station), `stations[]` (names and codes, `lines`, `routeStops`, `stopAreas`, `frame`, `summary`, `gaps`, `platforms[]` with outline/edges/tracks, `crossSections[]`, `tracks[]` with clipped centrelines, `footbridges[]` with ways/ends/spans/lifts, `buildings[]`, `stationAreas[]`, `entrances`, `lifts`, `tickets`, `gates`, `game`, `metroNearby`), `nearbyOutsideBox`, `unassignedPlatforms`, `unassignedFootbridges`, `otherStationAreas`, `issues`. Outlines and lines carry both `xz` (game metres) and `latlon`, simplified at 0.5 m — [osm-stations.json `meta`](../../osm-stations.json)

### Inferences
- The JSON can drive a station builder directly: raise each platform outline to a platform height, put the footbridge decks (`footbridges[].ways[].line`) at a deck height with stairs at the `ends` that fall on platforms (`onPlatform`), and drape `buildings[]` of class "roof or platform structure" over the platforms at roof height.
- The three `public_transport=platform`-only outlines will be missing from the game until the converter also accepts that tag.

### Gaps
- Heights of platforms, footbridge decks and roofs are not in the data (no `height`, few `level` tags); they need defaults chosen for the game.
