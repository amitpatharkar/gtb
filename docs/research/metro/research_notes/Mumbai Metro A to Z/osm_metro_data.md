# Mumbai Metro and Monorail in the local OpenStreetMap extract (data for the game)

Source of everything below: the local extract `data/raw/mumbai-region.osm.pbf` (extract.bbbike.org, downloaded 2026-11-13; box 72.598,18.520 → 73.533,19.500). Map data © OpenStreetMap contributors, ODbL. Links of the form [r123](https://www.openstreetmap.org/relation/123) point to the same object on openstreetmap.org for lookup; the live object may have changed since the extract. Numbers (lengths, game coordinates, in-box shares) were computed by [scripts/research/metro-from-osm.mjs](../../../../../scripts/research/metro-from-osm.mjs) and are stored in [docs/research/metro/osm-metro.json](../../osm-metro.json) (0.78 MB). Anything derived by distance, name matching or geometry is marked "inferred" here and in the JSON.

**How to rerun.** From the repository root: `npm ci --ignore-scripts` (once, if `node_modules` is missing; only `pbf` and `lineclip` are needed), then `node scripts/research/metro-from-osm.mjs` (about 3 seconds). Options: `--input <pbf>`, `--out <json>`, `--tolerance <metres>` (polyline simplification, default 5). The script only reads the extract and writes the JSON. A newer extract can be dropped in and the script rerun unchanged.

**Game coordinates** use the converter's projection (copied from `scripts/build-tiles.mjs`, section "projection"): flat (equirectangular) metres around the fixed origin Mahim 19.03 N, 72.85 E; `x = (lon − 72.85) × 105273.103` (east), `z = −(lat − 19.03) × 110692.419` (**z points south**, north is −z); 1 unit = 1 m. The game's current map box (converter default `--bbox` 18.890,72.795 → 19.140,72.920) is x −5790.0 … 7369.1, z −12176.2 (north edge) … 15496.9 (south edge).

**What is in the JSON:** `lines` (19: route masters, stand-alone route relations, and lines mapped only as track ways), `routes` (23 route relations: ordered polyline per direction in `latlon` and `xz`, stops with `chainage` in metres along the polyline, lengths, in-box length), `stations` (206: names incl. `name:mr`/`name:hi`, lifecycle, lines, lat/lon, x/z, `inBox`, `level`, station buildings with outlines, stop positions, platforms with outlines, entrances, nearby metro and railway stations), `trackGroups` (38: every metro/monorail track way grouped by its OSM name, with km by lifecycle, structure, service and the merged main/service track polylines), `networks`, `issues` (46 data problems found by the script), `meta` (projection, box, licence, counts).

## Which metro, monorail and light-rail route relations and track ways exist in the extract, with their tags (lifecycle, elevated or underground)?

### Takeaway
The extract has 23 metro/monorail route relations: two directions each for Mumbai Metro Lines 1, 2 (= 2A, Andheri West–Dahisar East), 2B (Mandale–Chembur part), 3, 7 and 9 (Dahisar East–Kashigaon part), Navi Mumbai Metro Line 1 and the Monorail (whose relations are tagged closed), plus seven single "umbrella" relations for lines under construction or proposed (Pink/6, Line 2 Dahisar–Mandale, Green/4, Red/7+7A+9, Orange/5, Thane Ring Metro, Line 11). There is no light rail and no route=train metro. 485 track ways (588 km counting both tracks, depots and sidings) cover operational, under-construction and proposed lines; Line 3 is tagged underground (tunnel, layer −1/−2), everything else elevated (bridge=viaduct/yes, layer 1–5).

### Cited Findings
- 23 route relations qualify (route=subway, or disused:route=monorail, or route=construction with construction=subway, or a metro network/name); no route=light_rail or route=monorail relation is current, and no route=train relation carries a metro network — [osm-metro.json `routes`](../../osm-metro.json).
- Route masters: Line 1 [r7684062](https://www.openstreetmap.org/relation/7684062), Line 2 [r13989917](https://www.openstreetmap.org/relation/13989917), Line 2B [r20403815](https://www.openstreetmap.org/relation/20403815), Line 3 [r17876724](https://www.openstreetmap.org/relation/17876724), Line 7 [r13989918](https://www.openstreetmap.org/relation/13989918), Line 9 [r20403870](https://www.openstreetmap.org/relation/20403870), Navi Mumbai Metro Line 1 [r16533437](https://www.openstreetmap.org/relation/16533437), Monorail [r7684086](https://www.openstreetmap.org/relation/7684086). The network relation "Mumbai Metro" [r13994555](https://www.openstreetmap.org/relation/13994555) lists six of them (1, 2, 2B, 3, 7, 9) — not the Monorail or Navi Mumbai Metro.
- Line 1 relations carry `opening_hours=5:30-24:00`, `interval=5` — [r3808111](https://www.openstreetmap.org/relation/3808111). Monorail relations carry `interval=22`, `duration=42`, `disused=yes`, `disused:route=monorail`, no `route` tag, and `note=Line is closed with no known reopening date`; operator `Scomi`, network `MMRDA` — [r6567848](https://www.openstreetmap.org/relation/6567848), [r7684084](https://www.openstreetmap.org/relation/7684084). The monorail track ways themselves are still `railway=monorail` (no lifecycle prefix), `start_date` 2014-02-02 and 2019-03-03 — [osm-metro.json `trackGroups` "Mumbai Monorail Line 1"](../../osm-metro.json).
- Line 2B relations note "Chembur is only a temporary terminus until the entire Line 2B is operational" — [r20403808](https://www.openstreetmap.org/relation/20403808).
- OSM uses `ref=2` and the name "Line 2" for the Andheri West–Dahisar (East) service (2A); the eastern part is `ref=2B` — [r13989912](https://www.openstreetmap.org/relation/13989912), [r20403809](https://www.openstreetmap.org/relation/20403809).
- Track tags (all lines except the monorail): `gauge=1435`, `electrified=contact_line`, `voltage=25000`. Monorail: `electrified=rail`, `voltage=750`, no gauge. Line 1 ways are `tracks=1` (each direction its own way); `tracks=2` appears on some ways of Lines 2, 3, 5, 6, 7 and 11 even where each direction is a separate way — [osm-metro.json `trackGroups[].tags`](../../osm-metro.json).
- Structure by tags: Line 3 track is `tunnel=yes` with `layer=-1`/`-2` (at the Aarey JVLR end, two unnamed 0.64 km ways, one per direction, have `layer=-1` without `tunnel` and no tags at all respectively); Line 1 `bridge=viaduct`, layer 1–2; Lines 2/2A/2B/7/9 `bridge=viaduct` or `yes`, layer 2–3; Line 6 under construction `layer=5`; Line 7A mixes viaduct (layer 3) and tunnel (layer −2/−3); Line 11 (proposed) is mostly `tunnel=yes`, `layer=-1`, with 0.4 km of viaduct; Thane Ring Metro (proposed) 17.4 km viaduct + 10.2 km tunnel — table T3 below.
- Lifecycle dates on track ways: Line 1 `start_date=2014-06-08`; Lines 2 and 7 `start_date=2022-04-02`; Line 3 `start_date=2024-10-05` (Aarey–BKC part) and `2025-05-10` ("Worli to SEEPZ"); Navi Mumbai Metro `2023-11-17`; under construction: Line 4A `opening_date=2026-04`, Line 7A and Line 9 extension `2026-12`, Line 4 `2027-11`, Line 2B remainder `2027-12`; Thane Ring Metro (proposed) `2029` — table T3.
- Station dates: Line 3's 10 stations Aarey JVLR–BKC `start_date=2024-10-05`, its 9 stations Science Centre, Grant Road, Girgaon, Kalbadevi, CSMT, Hutatma Chowk, Churchgate, Vidhan Bhavan, Cuffe Parade `2025-10-09`, the other 8 (Dharavi … Acharya Atre Chowk, Mahalaxmi, Jagannath Shankar Sheth) no date; Line 2B Mandale and Mankhurd `2026-04-04`, Deonar, Shivaji Chowk, Diamond Garden `2026-04-08`, Chembur (Line 2B) `2026-08-13`; Line 9 stations `2026-04-08` — [osm-metro.json `stations[].dates`](../../osm-metro.json).
- Not metro, left out: the Mumbai–Ahmedabad high-speed rail (railway=construction, gauge 1435, highspeed=yes) and its "Mumbai BKC" station [w626938775](https://www.openstreetmap.org/way/626938775); two Harbour-line stations wrongly tagged `station=light_rail` (Mansarovar [n1435294693](https://www.openstreetmap.org/node/1435294693), Khandeshwar [n1645802025](https://www.openstreetmap.org/node/1645802025)).

#### T1 Route relations (lengths are the relation's member track, great-circle, full resolution)

| Relation | name | ref | route / lifecycle tags | network | operator | colour | from → to | stop members | track km (relation) | in box km | structure (km) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| [r3808111](https://www.openstreetmap.org/relation/3808111) | Line 1 (Versova → Ghatkopar) | 1 | route=subway | Mumbai Metro | MMRDA | blue | Versova → Ghatkopar | 12 | 11.24 | 11.24 | elevated 11.24 |
| [r6567848](https://www.openstreetmap.org/relation/6567848) | Mumbai Monorail Line 1: Chembur => Sant Gadge Maharaj Chowk (Jacob Circle) | Mono 1 | no route tag, disused:route=monorail, disused=yes | MMRDA | Scomi | aqua | Chembur → Sant Gadge Maharaj Chowk (Jacob Circle) | 17 | 19.66 | 19.66 | elevated 19.66 |
| [r7684032](https://www.openstreetmap.org/relation/7684032) | Line 1 (Ghatkopar → Versova) | 1 | route=subway | Mumbai Metro | MMRDA | blue | Ghatkopar → Versova | 12 | 11.23 | 11.23 | elevated 11.23 |
| [r7684084](https://www.openstreetmap.org/relation/7684084) | Mumbai Monorail Line 1: Sant Gadge Maharaj Chowk (Jacob Circle) => Chembur | Mono 1 | no route tag, disused:route=monorail, disused=yes | MMRDA | Scomi | aqua | Sant Gadge Maharaj Chowk (Jacob Circle) → Chembur | 17 | 19.65 | 19.65 | elevated 19.65 |
| [r7898597](https://www.openstreetmap.org/relation/7898597) | Line 3 (Aarey JVLR → Cuffe Parade) | 3 | route=subway | Mumbai Metro | Mumbai Metro Rail Corporation Ltd. | aqua | Aarey JVLR → Cuffe Parade | 27 | 32.99 | 32.99 | underground 32.99 |
| [r7898711](https://www.openstreetmap.org/relation/7898711) | Pink Line | 6 | route=construction, construction=subway, disused=yes |  |  | pink |  →  | 13 | 15.29 | 9.39 | elevated 15.29 |
| [r7898712](https://www.openstreetmap.org/relation/7898712) | Dahisar to Mandale Metro Line 2 | 2 | route=construction, construction=subway, disused=yes | Mumbai Metro |  | yellow | Dahisar → Mandale | 34 | 82.60 | 46.15 | at-grade 1.62, elevated 80.99 |
| [r7898732](https://www.openstreetmap.org/relation/7898732) | Green Line (u/c) | 4 | route=subway, construction=subway, disused=yes |  | MMMOCL | green | Chhattrapati Shivaji Maharaj Terminus → Shivaji Chowk in Mira Road | 34 | 77.71 | 21.60 | elevated 77.71 |
| [r7898769](https://www.openstreetmap.org/relation/7898769) | Red Line | 7 | route=construction, construction=subway, disused=yes | Mumbai Metro |  | red |  →  | 20 | 18.09 | 5.16 | elevated 17.17, at-grade 0.27, underground 0.64 |
| [r12608512](https://www.openstreetmap.org/relation/12608512) | Orange Line | 5 | route=construction | Mumbai Metro | MMMOCL | orange | Thane → Taloja | 0 | 25.07 | 0.00 | elevated 25.07 |
| [r12608513](https://www.openstreetmap.org/relation/12608513) | Thane Ring Metro |  | no route tag | Thane Ring Metro | MMRCL |  |  →  | 0 | 27.68 | 0.00 | underground 10.25, elevated 17.43 |
| [r13989912](https://www.openstreetmap.org/relation/13989912) | Line 2 (Andheri West → Dahisar (East)) | 2 | route=subway | Mumbai Metro | MMRDA | yellow | Andheri West → Dahisar (East) | 17 | 17.76 | 1.21 | elevated 17.76 |
| [r13989913](https://www.openstreetmap.org/relation/13989913) | Line 2 (Dahisar (East) → Andheri West) | 2 | route=subway | Mumbai Metro | MMRDA | yellow | Dahisar (East) → Andheri West | 17 | 17.74 | 1.22 | elevated 17.74 |
| [r13989914](https://www.openstreetmap.org/relation/13989914) | Line 7 (Gundavali → Dahisar (East)) | 7 | route=subway | Mumbai Metro | MMRDA | red | Gundavali → Dahisar (East) | 14 | 15.68 | 2.88 | elevated 15.68 |
| [r13989915](https://www.openstreetmap.org/relation/13989915) | Line 7 (Dahisar (East) → Gundavali) | 7 | route=subway | Mumbai Metro | MMRDA | red | Dahisar (East) → Gundavali | 14 | 15.68 | 2.88 | elevated 15.68 |
| [r16533435](https://www.openstreetmap.org/relation/16533435) | Line 1 (Pendhar → CBD Belapur) | N1 | route=subway | Navi Mumbai Metro | CIDCO | #77248B | Pendhar → CBD Belapur | 11 | 10.53 | 0.00 | elevated 10.53 |
| [r16533436](https://www.openstreetmap.org/relation/16533436) | Line 1 (CBD Belapur → Pendhar) | N1 | route=subway | Navi Mumbai Metro | CIDCO | #77248B | CBD Belapur → Pendhar | 11 | 10.53 | 0.00 | elevated 10.53 |
| [r17876723](https://www.openstreetmap.org/relation/17876723) | Line 3 (Cuffe Parade → Aarey JVLR) | 3 | route=subway | Mumbai Metro | Mumbai Metro Rail Corporation Ltd. | aqua | Cuffe Parade → Aarey JVLR | 27 | 32.99 | 32.99 | underground 32.35, at-grade 0.64 |
| [r19233909](https://www.openstreetmap.org/relation/19233909) | Mumbai Metro Line 11 |  | route=subway |  | MMRC |  | Anik Nagar Bus Depot Station → SMP Circle Station | 0 | 17.12 | 17.12 | underground 16.72, elevated 0.40 |
| [r20403808](https://www.openstreetmap.org/relation/20403808) | Line 2B (Mandale → Chembur) | 2B | route=subway | Mumbai Metro | MMRDA | yellow | Mandale → Chembur | 6 | 5.54 | 3.27 | elevated 5.54 |
| [r20403809](https://www.openstreetmap.org/relation/20403809) | Line 2B (Chembur → Mandale) | 2B | route=subway | Mumbai Metro | MMRDA | yellow | Chembur → Mandale | 6 | 5.54 | 3.27 | elevated 5.54 |
| [r20403864](https://www.openstreetmap.org/relation/20403864) | Line 9 (Kashigaon → Dahisar (East)) | 9 | route=subway | Mumbai Metro | MMRDA | red | Kashigaon → Dahisar (East) | 4 | 3.58 | 0.00 | elevated 3.58 |
| [r20403865](https://www.openstreetmap.org/relation/20403865) | Line 9 (Dahisar (East) → Kashigaon) | 9 | route=subway | Mumbai Metro | MMRDA | red | Dahisar (East) → Kashigaon | 4 | 3.56 | 0.00 | elevated 3.56 |

#### T2 Lines (route masters, stand-alone relations, and lines mapped only as track ways)

| line id (JSON) | OSM | name | status from tags | route km (mean of directions) | first→last stop km | in box km | stations | stations in box |
|---|---|---|---|---|---|---|---|---|
| mumbai-metro-1 | [r7684062](https://www.openstreetmap.org/relation/7684062) | Line 1 (Versova ↔ Ghatkopar) | operational | 11.239 | 10.898 | 11.239 | 12 | 12 |
| mumbai-monorail-1 | [r7684086](https://www.openstreetmap.org/relation/7684086) | Mumbai Monorail Line 1 | disused | 19.654 | 19.438 | 19.654 | 17 | 17 |
| mumbai-metro-2 | [r13989917](https://www.openstreetmap.org/relation/13989917) | Line 2 (Andheri West ↔ Dahisar (East)) | operational | 17.754 | 17.699 | 1.215 | 17 | 1 |
| mumbai-metro-7 | [r13989918](https://www.openstreetmap.org/relation/13989918) | Line 7 (Gundavali ↔ Dahisar (East)) | operational | 15.679 | 15.615 | 2.876 | 14 | 2 |
| navi-mumbai-metro-n1 | [r16533437](https://www.openstreetmap.org/relation/16533437) | Line 1 (CBD Belapur ⇔ Pendhar) | operational | 10.533 | 10.514 | 0 | 11 | 0 |
| mumbai-metro-3 | [r17876724](https://www.openstreetmap.org/relation/17876724) | Line 3 (Aarey Colony ↔ Cuffe Parade) | operational | 32.992 | 32.615 | 32.992 | 27 | 27 |
| mumbai-metro-2b | [r20403815](https://www.openstreetmap.org/relation/20403815) | Line 2B (Chembur ↔ Mandale) | operational | 5.54 | 5.447 | 3.269 | 6 | 4 |
| mumbai-metro-9 | [r20403870](https://www.openstreetmap.org/relation/20403870) | Line 9 (Dahisar (East) ↔ Kashigaon) | operational | 3.571 | 3.563 | 0 | 4 | 0 |
| mumbai-metro-6-relation-7898711 | [r7898711](https://www.openstreetmap.org/relation/7898711) | Pink Line | construction | 15.285 | 13.218 | 9.386 | 13 | 8 |
| mumbai-metro-2-relation-7898712 | [r7898712](https://www.openstreetmap.org/relation/7898712) | Dahisar to Mandale Metro Line 2 | construction | 82.603 | – | 46.145 | 28 | 15 |
| mumbai-metro-4-relation-7898732 | [r7898732](https://www.openstreetmap.org/relation/7898732) | Green Line (u/c) | construction | 77.711 | – | 21.601 | 33 | 9 |
| mumbai-metro-7-relation-7898769 | [r7898769](https://www.openstreetmap.org/relation/7898769) | Red Line | construction | 18.09 | 18.022 | 5.163 | 19 | 3 |
| mumbai-metro-5-relation-12608512 | [r12608512](https://www.openstreetmap.org/relation/12608512) | Orange Line | construction | 25.072 | – | 0 | 0 | 0 |
| thane-ring-metro-relation-12608513 | [r12608513](https://www.openstreetmap.org/relation/12608513) | Thane Ring Metro | proposed | 27.68 | – | 0 | 0 | 0 |
| mumbai-metro-line-11-relation-19233909 | [r19233909](https://www.openstreetmap.org/relation/19233909) | Mumbai Metro Line 11 | proposed | 17.118 | – | 17.118 | 0 | 0 |
| ways-mumbai-metro-line-5 | ways only | Mumbai Metro Line 5 | construction | 3.018 | – | 0 | – | – |
| ways-navi-mumbai-metro-line-1-stage-2 | ways only | Navi Mumbai Metro Line 1 - Stage 2 | construction | 11.271 | – | 0 | – | – |
| ways-orange-line-mumbai-metro-kalyan-taloja | ways only | Orange Line Mumbai Metro (Kalyan-Taloja) | construction | 21.561 | – | 0 | – | – |
| ways-thane-ring-metro-depot-spur | ways only | Thane Ring Metro depot spur | proposed | 1.518 | – | 0 | – | – |

#### T3 Track ways grouped by OSM name (all lifecycles; km = sum of all ways, i.e. both tracks where each direction is its own way; unnamed ways grouped as inferred)

| group (way name) | ways | km | lifecycle km | structure km | service km | layer | opening_date / start_date | in box km |
|---|---|---|---|---|---|---|---|---|
| (unnamed) connected to "Dahisar (W) to Mandale Metro (Line-2)" | 2 | 1.038 | operational 1.038 | at-grade 1.038 | yard 1.038 |  |  | 0 |
| (unnamed) connected to "Line 2" | 3 | 1.13 | operational 1.13 | elevated 1.13 | crossover 0.947, main 0.182 | 3 | 2022-04-02 | 0 |
| (unnamed) connected to "Line 4" | 2 | 0.104 | construction 0.104 | elevated 0.104 | crossover 0.104 | 3 | 2027-12 | 0.104 |
| (unnamed) connected to "Line 4A" | 2 | 1.848 | construction 1.848 | elevated 1.848 | spur 1.848 | 3 |  | 0 |
| (unnamed) connected to "Line 7" | 5 | 0.257 | operational 0.257 | elevated 0.257 | crossover 0.21, main 0.047 | 3 |  | 0.148 |
| (unnamed) connected to "Line 9" | 1 | 0.067 | operational 0.067 | elevated 0.067 | crossover 0.067 | 3 |  | 0 |
| (unnamed) connected to "Metro 2 Depot Line" | 60 | 9.917 | operational 9.917 | at-grade 8.421, elevated 1.496 | yard 9.603, crossover 0.064, main 0.25 | 1,3 | 2022-04-02 | 0 |
| (unnamed) connected to "Mumbai Metro Line 1" | 24 | 3.114 | operational 3.114 | at-grade 3.114 | yard 3.114 |  |  | 3.114 |
| (unnamed) connected to "Mumbai Monorail Line 1" | 1 | 0.047 | operational 0.047 | elevated 0.047 | yard 0.047 | 2 |  | 0.047 |
| (unnamed) connected to "Navi Mumbai Metro Line 1 - Stage 2" | 2 | 0.097 | construction 0.097 | elevated 0.097 | crossover 0.097 | 2 |  | 0 |
| (unnamed) connected to "Navi Mumbai Metro Line 1" | 26 | 8.231 | operational 8.231 | elevated 2.126, at-grade 6.105 | yard 8.193, crossover 0.038 | 1,2 | 2023-11-17 | 0 |
| (unnamed) in Mumbai Metro ref 3 route relations | 87 | 21.396 | operational 21.396 | at-grade 20.755, underground 0.64 | yard 19.839, main 1.516, crossover 0.04 | -1 | 2024-10-05 | 21.396 |
| (unnamed) railway=monorail, not connected to a named track | 31 | 3.319 | operational 3.319 | elevated 3.319 | yard 3.319 | 2,1 |  | 3.319 |
| Colaba to SEEPZ (Line-3) | 3 | 23.118 | operational 23.118 | underground 23.118 | main 23.118 | -1 |  | 23.118 |
| Dahisar (W) to Mandale Metro (Line-2) | 39 | 67.552 | operational 32.008, construction 35.544 | elevated 65.934, at-grade 1.617 | main 65.183, yard 2.369 | 3,2 | 2027-12, 2026-04 | 46.143 |
| Line 10 | 2 | 18.455 | proposed 18.455 | elevated 18.455 | main 18.455 | 3 |  | 0 |
| Line 11 | 4 | 17.118 | proposed 17.118 | underground 16.717, elevated 0.401 | main 17.118 | -1,2,1,3 |  | 17.118 |
| line 2 | 1 | 0.027 | operational 0.027 | elevated 0.027 | crossover 0.027 | 3 |  | 0 |
| Line 2 | 5 | 18.937 | operational 18.937 | elevated 18.937 | main 18.937 | 3 | 2022-04-02 | 0 |
| Line 4 | 6 | 66.187 | construction 66.187 | elevated 66.187 | main 66.187 | 3 | 2027-11 | 21.601 |
| Line 4A | 17 | 6.322 | construction 6.322 | elevated 6.322 | main 4.595, crossover 0.494, siding 1.004, yard 0.229 | 3 | 2026-04 | 0 |
| Line 6 | 2 | 30.562 | construction 30.562 | elevated 30.562 | main 30.562 | 5 |  | 18.713 |
| Line 7 | 12 | 32.65 | operational 32.65 | elevated 32.65 | main 32.581, crossover 0.069 | 3,2 | 2022-04-02 | 6.72 |
| Line 7A | 12 | 3.61 | construction 3.61 | underground 1.287, elevated 1.772, at-grade 0.551 | main 3.61 | -3,3,-2 | 2026-12 | 3.61 |
| Line 9 | 44 | 18.877 | construction 10.233, operational 8.643 | elevated 18.877 | main 17.907, yard 0.238, siding 0.561, crossover 0.171 | 3 | 2026-12, 2026-04 | 0 |
| Line-5: Thane - Bhiwandi - Kalyan | 3 | 25.072 | construction 25.072 | elevated 25.072 | main 25.072 | 3 |  | 0 |
| Metro 2 Depot Line | 4 | 1.938 | operational 1.938 | elevated 1.938 | yard 1.938 | 2 | 2022-04-02 | 0 |
| Mumbai Metro Line 1 | 51 | 27.215 | operational 27.215 | elevated 24.147, at-grade 3.068 | main 22.676, yard 4.429, siding 0.11 | 2,1 | 2014-06-08 | 27.215 |
| Mumbai Metro Line 3 | 4 | 23.226 | operational 23.226 | underground 23.226 | main 23.226 | -2,-1 | 2024-10-05 | 23.226 |
| Mumbai Metro Line 5 | 3 | 3.018 | construction 3.018 | elevated 3.018 | main 3.018 | 3 |  | 0 |
| Mumbai Monorail Line 1 | 4 | 39.309 | operational 39.309 | elevated 39.309 | main 39.309 | 2 | 2014-02-02, 2019-03-03 | 39.309 |
| Mumbai Monorail Phase1 | 1 | 0.085 | operational 0.085 | elevated 0.085 | siding 0.085 | 2 |  | 0.085 |
| Navi Mumbai Metro Line 1 | 10 | 22.671 | operational 22.671 | elevated 21.722, at-grade 0.949 | main 21.62, yard 0.949, crossover 0.103 | 2 | 2023-11-17 | 0 |
| Navi Mumbai Metro Line 1 - Stage 2 | 2 | 22.538 | construction 22.538 | elevated 22.538 | main 22.538 | 2 |  | 0 |
| Orange Line Mumbai Metro (Kalyan-Taloja) | 1 | 21.561 | construction 21.561 | elevated 21.561 | main 21.561 | 5 |  | 0 |
| Thane Ring Metro | 2 | 27.68 | proposed 27.68 | elevated 17.435, underground 10.246 | main 27.68 | 3 | 2029 | 0 |
| Thane Ring Metro depot spur | 3 | 1.673 | proposed 1.673 | elevated 1.378, at-grade 0.295 | spur 1.673 | 3 | 2029 | 0 |
| Worli to SEEPZ (Line-3) | 4 | 18.354 | operational 18.354 | underground 18.354 | main 18.354 | -2,-1 | 2025-05-10 | 18.354 |

### Inferences
- The OSM "route km" of a line (mean of its two direction relations) is the game-ready running length: Line 1 11.24 km, Line 2 (2A) 17.75 km, Line 2B (open part) 5.54 km, Line 3 32.99 km, Line 7 15.68 km, Line 9 (open part) 3.57 km, Navi Mumbai Metro Line 1 10.53 km, Monorail 19.65 km (table T2). Track-group km (T3) are about twice as long where each direction is mapped as its own way.
- For lines that exist only as umbrella relations or ways (2B remainder, 4, 4A, 5, 6, 7A, 9 extension, 10, 11, 12/Kalyan–Taloja, Thane Ring, Navi Mumbai "Stage 2"), use `trackGroups[].mainTrack` for the geometry: the umbrella relations mix both tracks, other lines' ways and gaps.
- For a working metro in the game, the Monorail's OSM status (relations tagged closed with "no known reopening date") is a design choice: the tracks and stations are fully mapped and could still be run.

### Gaps
- No route relation exists for Lines 4A, 6 (only the old "Pink Line" umbrella), 7A, 10, 12 (Kalyan–Taloja, mapped as one way named "Orange Line Mumbai Metro (Kalyan-Taloja)"), Navi Mumbai "Line 1 - Stage 2", or a route master for the under-construction lines.
- The extract has no `maxspeed`, platform-height or car-length tags on metro track; timetable tags exist only for Line 1 (`interval`, `opening_hours`) and the Monorail (`interval`, `duration`).

## Every station: names, lines, positions (lat/lon and game x/z), elevated or underground, entrances and platforms

### Takeaway
The script builds 206 station records: 108 on the operating lines (Monorail 17, Line 1 12, Line 2/2A 17, Line 2B 6, Line 3 27, Line 7 14, Line 9 4, Navi Mumbai Metro 11), 3 more objects tagged as working stations but on no route, 68 under construction and 27 proposed (15 on Line 11, 12 on the Thane Ring Metro). 111 of the 206 lie inside the game's map box. By the track at their stops, 81 of the 108 operating stations are elevated, 26 underground (all of Line 3 except Aarey JVLR, whose two tracks are tagged differently). 82 entrances and 119 platforms are mapped, concentrated on Lines 1, 2/2A, 3 and 7 and the Monorail.

### Cited Findings
- Station positions: the station node (`railway=station`, `public_transport=station`, `station=subway|monorail`) where one exists; else the centroid of the station way (Line 1 and most Navi Mumbai stations are mapped as `building=transportation`/`train_station` ways with station tags); else the mean of the stop positions (all of Line 6, most of Line 4, Line 9 extension; inferred). Stop areas (`public_transport=stop_area`, 108 metro ones) tie stations, stop positions, platforms and entrances together; other links are by name within 200 m or distance within 150 m (inferred, recorded per member in `link`) — [osm-metro.json `stations`](../../osm-metro.json).
- `name:mr` exists on 98 and `name:hi` on 51 of the 108 operating stations (tables T4). Eleven stations carry a `ref` code (Jagruti Nagar JNG, D. N. Nagar DNG, Ovaripada 701, Oshiwara 215, Aarey JVLR ARYJ, Bandra Colony VIDN, Sahar Road SHRR, MIDC - Andheri AND, Worli WOR, Jagannath Shankar Sheth MCLM, Cuffe Parade CUP). Sponsor names are in `official_name` (e.g. "HDFC Ergo Airport Road" [w311841874](https://www.openstreetmap.org/way/311841874), "Fevicol Marol Naka" [w311841876](https://www.openstreetmap.org/way/311841876), "Vivo D N Nagar" [w287299866](https://www.openstreetmap.org/way/287299866), "IndusInd Bank Chakala (J.B.Nagar)" [w331824153](https://www.openstreetmap.org/way/331824153), "Oberoi Garden City Aarey" [n9629564097](https://www.openstreetmap.org/node/9629564097), "Zurich Kotak Goregaon (East)" [n10576622722](https://www.openstreetmap.org/node/10576622722), "AU Bank - Bandra Colony" [n12074909129](https://www.openstreetmap.org/node/12074909129), "ICICI Prudential Mutual Fund - Santacruz Metro" [n12074909130](https://www.openstreetmap.org/node/12074909130), "kotak - Bandra Kurla Complex" [n5221297179](https://www.openstreetmap.org/node/5221297179), "SBI - Dadar Metro" [n12855459845](https://www.openstreetmap.org/node/12855459845), "LIC - Churchgate Metro" [n13207029319](https://www.openstreetmap.org/node/13207029319), "Chhatrapati Shivaji Maharaj Terminus - kotak Metro" [n13207029322](https://www.openstreetmap.org/node/13207029322)).
- Alternative names in the data: Kurar `alt_name=Pushpa Park`, Bangur Nagar `alt_name=Pahadi Goregaon`, Shimpoli `alt_name=Shimpawali`, Deonar `old_name=BSNL`, Sant Gadge Maharaj Chowk `alt_name=Jacob Circle`, Antop Hill and Guru Tegh Bahadur Nagar both `short_name=GTB Nagar`, Western Express Highway `short_name=WEH` — [osm-metro.json `stations`](../../osm-metro.json).
- Level by the track at the station's stop positions (`levelFromTrack`, inferred from the nearest track way's bridge/tunnel/layer tags): of the 108 operating stations 81 elevated, 26 underground (Line 3), Aarey JVLR "at-grade|underground" (its two tracks are tagged differently); by the station's own tags (`levelFromTags`) only some stations say anything (layer 1 on Line 1 and Navi Mumbai station ways; `location=underground`, `layer=-1` on the "Dadar Metro Station" building [w828171868](https://www.openstreetmap.org/way/828171868)).
- Entrances: 82 `railway=subway_entrance` nodes, all linked to a station (most through stop areas): Line 3 45 (Santacruz 8; BKC, Churchgate, CSMT 6 each), Line 1 24 (Versova, D. N. Nagar, Ghatkopar 6 each), Line 2/2A 8, Line 7 3, Navi Mumbai 2, Monorail 0. Several carry `ref` (A1, B2 …), destination names (e.g. "Ballard Estate, Fort;Bombay Gymkhana" at CSMT [n14100628905](https://www.openstreetmap.org/node/14100628905)), `wheelchair`, `level`, or `highway=elevator` (lifts) — table T6.
- Platforms: 119 metro platforms (ways/areas with `public_transport=platform` and `subway|monorail=yes`, or members of metro stop areas/routes): Line 2/2A 33, Line 7 24, Line 1 23, Monorail 15, Line 3 12 (only the 10 stations from Aarey JVLR to BKC), Line 9 6, plus 6 at under-construction Line 9 extension stations; none on Line 2B, Navi Mumbai Metro, or Line 3 south of BKC — [osm-metro.json `stations[].platforms`](../../osm-metro.json). Outlines are in the JSON (0.5 m simplification).
- Interchanges are not tagged; the JSON lists, as inferred, other metro stations within 400 m (`interchanges`) and main-line stations within 600 m (`nearbyRailStations`) — e.g. Marol Naka Line 1 ↔ Line 3 (two separate station objects, about 100 m apart), Dahisar (East) has three separate station nodes ([Line 2] [n9627118209](https://www.openstreetmap.org/node/9627118209), [Line 7] [n9627118208](https://www.openstreetmap.org/node/9627118208), [Line 9] [n13758670735](https://www.openstreetmap.org/node/13758670735)).

#### T4 Operating stations by line, in route order (level: from the track at the stops; from the station's tags; "–" = no value)

**Line 1 (Versova ↔ Ghatkopar)** (mumbai-metro-1, [r7684062](https://www.openstreetmap.org/relation/7684062)) — 12 stations, 12 inside the map box

| # | station (OSM) | name:mr | lat | lon | x | z | level (track; tags) | in box | entrances | platforms |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Versova ([w287299861](https://www.openstreetmap.org/way/287299861)) | वर्सोवा | 19.130260 | 72.821309 | -3020.4 | -11098.1 | elevated; elevated | yes | 6 | 2 |
| 2 | D. N. Nagar ([w287299866](https://www.openstreetmap.org/way/287299866)) | डी. एन. नगर | 19.128294 | 72.830289 | -2075 | -10880.4 | elevated; elevated | yes | 6 | 2 |
| 3 | Azad Nagar ([w331815667](https://www.openstreetmap.org/way/331815667)) | आझाद नगर | 19.126910 | 72.837648 | -1300.3 | -10727.2 | elevated; elevated | yes | 0 | 2 |
| 4 | Andheri L1 ([n6020955334](https://www.openstreetmap.org/node/6020955334)) | अंधेरी | 19.120564 | 72.848843 | -121.8 | -10024.7 | elevated; – | yes | 0 | 2 |
| 5 | Western Express Highway ([w331815671](https://www.openstreetmap.org/way/331815671)) | पश्चिम द्रुतगती महामार्ग | 19.115887 | 72.856359 | 669.5 | -9507 | elevated; elevated | yes | 2 | 2 |
| 6 | Chakala - J.B. Nagar ([w331824153](https://www.openstreetmap.org/way/331824153)) | चकाला - जे. बी. नगर | 19.112000 | 72.867647 | 1857.8 | -9076.8 | elevated; elevated | yes | 0 | 2 |
| 7 | Airport Road ([w311841874](https://www.openstreetmap.org/way/311841874)) | विमानतळ रस्ता | 19.110125 | 72.874166 | 2544.1 | -8869.2 | elevated; elevated | yes | 0 | 2 |
| 8 | Marol Naka ([w311841876](https://www.openstreetmap.org/way/311841876)) | मरोळ नाका | 19.108138 | 72.879522 | 3107.9 | -8649.3 | elevated; elevated | yes | 4 | 2 |
| 9 | Saki Naka ([w331824155](https://www.openstreetmap.org/way/331824155)) | साकी नाका | 19.103593 | 72.887935 | 3993.6 | -8146.2 | elevated; elevated | yes | 0 | 2 |
| 10 | Asalpha ([w331827626](https://www.openstreetmap.org/way/331827626)) | असल्फा | 19.096430 | 72.894882 | 4724.9 | -7353.3 | elevated; elevated | yes | 0 | 2 |
| 11 | Jagruti Nagar ([w311841875](https://www.openstreetmap.org/way/311841875)) | जागृती नगर | 19.092601 | 72.901802 | 5453.4 | -6929.5 | elevated; elevated | yes | 0 | 2 |
| 12 | Ghatkopar L1 ([w151205149](https://www.openstreetmap.org/way/151205149)) | घाटकोपर | 19.086493 | 72.908042 | 6110.3 | -6253.4 | elevated; elevated | yes | 6 | 1 |

**Mumbai Monorail Line 1** (mumbai-monorail-1, [r7684086](https://www.openstreetmap.org/relation/7684086)) — 17 stations, 17 inside the map box

| # | station (OSM) | name:mr | lat | lon | x | z | level (track; tags) | in box | entrances | platforms |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Sant Gadge Maharaj Chowk ([n3806743194](https://www.openstreetmap.org/node/3806743194)) |  | 18.983092 | 72.828587 | -2254.2 | 5192.3 | elevated; – | yes | 0 | 0 |
| 2 | Lower Parel ([n6498408219](https://www.openstreetmap.org/node/6498408219)) |  | 18.993120 | 72.831470 | -1950.7 | 4082.3 | elevated; – | yes | 0 | 0 |
| 3 | Mint Colony ([n3806743195](https://www.openstreetmap.org/node/3806743195)) |  | 18.994514 | 72.843309 | -704.4 | 3928 | elevated; – | yes | 0 | 0 |
| 4 | Ambedkar Nagar ([n3806743188](https://www.openstreetmap.org/node/3806743188)) |  | 19.001592 | 72.844227 | -607.7 | 3144.5 | elevated; – | yes | 0 | 0 |
| 5 | Naigaon ([n3806743196](https://www.openstreetmap.org/node/3806743196)) |  | 19.009539 | 72.847871 | -224.1 | 2264.8 | elevated; – | yes | 0 | 0 |
| 6 | Dadar East ([n3806743192](https://www.openstreetmap.org/node/3806743192)) |  | 19.016253 | 72.852227 | 234.5 | 1521.7 | elevated; – | yes | 0 | 0 |
| 7 | Wadala Bridge ([n3732540593](https://www.openstreetmap.org/node/3732540593)) |  | 19.017485 | 72.859317 | 980.8 | 1385.3 | elevated; – | yes | 0 | 0 |
| 8 | Acharya Atre Nagar ([n3806743187](https://www.openstreetmap.org/node/3806743187)) |  | 19.023647 | 72.863799 | 1452.7 | 703.2 | elevated; – | yes | 0 | 0 |
| 9 | Antop Hill ([n13284781018](https://www.openstreetmap.org/node/13284781018)) |  | 19.030181 | 72.866950 | 1784.4 | -20 | elevated; – | yes | 0 | 2 |
| 10 | Guru Tegh Bahadur Nagar ([n3806743193](https://www.openstreetmap.org/node/3806743193)) | गुरु तेग़ बहादुर नगर | 19.036687 | 72.870786 | 2188.2 | -740.2 | elevated; – | yes | 0 | 0 |
| 11 | Wadala Depot ([n632342238](https://www.openstreetmap.org/node/632342238)) | वडाळा डेपो | 19.038824 | 72.874025 | 2529.2 | -976.8 | elevated; – | yes | 0 | 2 |
| 12 | Bhakti Park ([n632340589](https://www.openstreetmap.org/node/632340589)) | भक्ती पार्क | 19.028972 | 72.877572 | 2902.6 | 113.8 | elevated; – | yes | 0 | 2 |
| 13 | Mysore Colony ([n1643263977](https://www.openstreetmap.org/node/1643263977)) | मैसुर कॉलनी | 19.027717 | 72.891440 | 4362.5 | 252.7 | elevated; elevated | yes | 0 | 2 |
| 14 | Bharat Petroleum ([n2647295137](https://www.openstreetmap.org/node/2647295137)) | भारत पेट्रोलियम | 19.035284 | 72.895555 | 4795.7 | -584.9 | elevated; – | yes | 0 | 2 |
| 15 | Fertilizer Township ([n2986295912](https://www.openstreetmap.org/node/2986295912)) | फर्टीलाईझर टाऊनशिप | 19.043878 | 72.893456 | 4574.7 | -1536.1 | elevated; – | yes | 0 | 2 |
| 16 | VNP & RC Marg Junction ([n2647295140](https://www.openstreetmap.org/node/2647295140)) | व्हि एन पी आणि आर सी मार्ग जंक्शन | 19.052642 | 72.894279 | 4661.4 | -2506.3 | elevated; – | yes | 0 | 1 |
| 17 | Chembur ([n632337506](https://www.openstreetmap.org/node/632337506)) | चेंबूर | 19.061213 | 72.897591 | 5010 | -3455 | elevated; – | yes | 0 | 2 |

**Line 2 (Andheri West ↔ Dahisar (East))** (mumbai-metro-2, [r13989917](https://www.openstreetmap.org/relation/13989917)) — 17 stations, 1 inside the map box

| # | station (OSM) | name:mr | lat | lon | x | z | level (track; tags) | in box | entrances | platforms |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Dahisar (East) [Line 2] ([n9627118209](https://www.openstreetmap.org/node/9627118209)) | दहिसर (पूर्व) | 19.251733 | 72.867332 | 1824.6 | -24544.2 | elevated; – | no | 0 | 0 |
| 2 | Anand Nagar ([n5219622347](https://www.openstreetmap.org/node/5219622347)) | आनंद नगर | 19.257209 | 72.866349 | 1721.1 | -25150.3 | elevated; elevated | no | 0 | 2 |
| 3 | Kandarpada ([n5219622346](https://www.openstreetmap.org/node/5219622346)) | कांदरपाडा | 19.256634 | 72.850504 | 53.1 | -25086.6 | elevated; – | no | 0 | 2 |
| 4 | Mandapeshwar - I.C. Colony ([n5219622345](https://www.openstreetmap.org/node/5219622345)) | मंडपेश्वर - आय.सी. कॉलनी | 19.249586 | 72.845800 | -442.1 | -24306.5 | elevated; – | no | 0 | 2 |
| 5 | Eksar ([n5219623047](https://www.openstreetmap.org/node/5219623047)) | एकसर | 19.240377 | 72.843446 | -690 | -23287.2 | elevated; elevated | no | 0 | 2 |
| 6 | Borivali (West) ([n5219622344](https://www.openstreetmap.org/node/5219622344)) | बोरिवली (पश्चिम) | 19.231393 | 72.840861 | -962.1 | -22292.6 | elevated; – | no | 0 | 3 |
| 7 | Shimpoli ([n5219623032](https://www.openstreetmap.org/node/5219623032)) | शिंपोली | 19.222833 | 72.840943 | -953.4 | -21345.2 | elevated; – | no | 0 | 2 |
| 8 | Kandivali (West) ([n5219622343](https://www.openstreetmap.org/node/5219622343)) | कांदिवली (पश्चिम) | 19.214004 | 72.837305 | -1336.4 | -20367.8 | elevated; – | no | 0 | 2 |
| 9 | Dahanukarwadi ([n5219622342](https://www.openstreetmap.org/node/5219622342)) | डहाणूकरवाडी | 19.206232 | 72.834807 | -1599.4 | -19507.5 | elevated; – | no | 0 | 2 |
| 10 | Valnai-Meeth Chowky ([n10576726763](https://www.openstreetmap.org/node/10576726763)) | वळनई-मीठ चौकी | 19.196829 | 72.833775 | -1708 | -18466.7 | elevated; – | no | 0 | 2 |
| 11 | Malad (West) ([n10576726762](https://www.openstreetmap.org/node/10576726762)) | मालाड (पश्चिम) | 19.185285 | 72.835861 | -1488.4 | -17188.9 | elevated; – | no | 0 | 2 |
| 12 | Lower Malad ([n10576726761](https://www.openstreetmap.org/node/10576726761)) | लोअर मालाड | 19.173098 | 72.836480 | -1423.3 | -15839.9 | elevated; – | no | 0 | 2 |
| 13 | Bangur Nagar ([n12196197980](https://www.openstreetmap.org/node/12196197980)) | बांगुर नगर | 19.162472 | 72.834871 | -1592.7 | -14663.7 | elevated; – | no | 0 | 2 |
| 14 | Goregaon (West) ([n10576726757](https://www.openstreetmap.org/node/10576726757)) | गोरेगाँव (पश्चिम) | 19.153024 | 72.835666 | -1508.9 | -13617.8 | elevated; – | no | 0 | 2 |
| 15 | Oshiwara ([n10576726756](https://www.openstreetmap.org/node/10576726756)) | ओशिवारा | 19.146035 | 72.833952 | -1689.4 | -12844.2 | elevated; – | no | 3 | 2 |
| 16 | Lower Oshiwara ([n10576726751](https://www.openstreetmap.org/node/10576726751)) | लोअर ओशिवरा | 19.140698 | 72.831714 | -1925 | -12253.4 | elevated; – | no | 3 | 2 |
| 17 | Andheri (West) ([n10576726748](https://www.openstreetmap.org/node/10576726748)) | अंधेरी (पश्चिम) | 19.129134 | 72.831431 | -1954.8 | -10973.3 | elevated; – | yes | 2 | 2 |

**Line 7 (Gundavali ↔ Dahisar (East))** (mumbai-metro-7, [r13989918](https://www.openstreetmap.org/relation/13989918)) — 14 stations, 2 inside the map box

| # | station (OSM) | name:mr | lat | lon | x | z | level (track; tags) | in box | entrances | platforms |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Dahisar (East) [Line 7] ([n9627118208](https://www.openstreetmap.org/node/9627118208)) | दहिसर (पूर्व) | 19.250698 | 72.866666 | 1754.5 | -24429.6 | elevated; – | no | 0 | 0 |
| 2 | Ovaripada ([n9629564105](https://www.openstreetmap.org/node/9629564105)) | ओवरीपाडा | 19.243149 | 72.864138 | 1488.3 | -23593.9 | elevated; – | no | 0 | 2 |
| 3 | Rashtriya Udyan ([n9629564104](https://www.openstreetmap.org/node/9629564104)) | राष्ट्रीय उद्यान | 19.234614 | 72.863137 | 1383 | -22649.2 | elevated; – | no | 1 | 0 |
| 4 | Devipada ([n9629564103](https://www.openstreetmap.org/node/9629564103)) | देवीपाडा | 19.224036 | 72.864325 | 1508 | -21478.3 | elevated; – | no | 0 | 2 |
| 5 | Magathane ([n9629564102](https://www.openstreetmap.org/node/9629564102)) | मगाठाणे | 19.216797 | 72.866801 | 1768.7 | -20677 | elevated; – | no | 0 | 2 |
| 6 | Poisar ([n9629564101](https://www.openstreetmap.org/node/9629564101)) | पोइसर | 19.203771 | 72.863323 | 1402.5 | -19235.2 | elevated; – | no | 0 | 2 |
| 7 | Akurli ([n9629564100](https://www.openstreetmap.org/node/9629564100)) | आकुर्ली | 19.198159 | 72.860491 | 1104.4 | -18613.9 | elevated; – | no | 0 | 2 |
| 8 | Kurar ([n9629564099](https://www.openstreetmap.org/node/9629564099)) | कुरार | 19.187300 | 72.858455 | 890.1 | -17411.9 | elevated; – | no | 0 | 2 |
| 9 | Dindoshi ([n9629564098](https://www.openstreetmap.org/node/9629564098)) | दिंडोशी | 19.179758 | 72.858298 | 873.5 | -16577.1 | elevated; – | no | 0 | 2 |
| 10 | Aarey ([n9629564097](https://www.openstreetmap.org/node/9629564097)) | आरे रोड जंक्शन | 19.169324 | 72.858792 | 925.5 | -15422.1 | elevated; elevated | no | 2 | 2 |
| 11 | Goregaon (East) ([n10576622722](https://www.openstreetmap.org/node/10576622722)) | गोरेगाव (पूर्व) | 19.152449 | 72.856597 | 694.4 | -13554.2 | elevated; – | no | 0 | 2 |
| 12 | Jogeshwari (East) ([n10576622721](https://www.openstreetmap.org/node/10576622721)) | जोगेश्वरी (पूर्व) | 19.142946 | 72.855185 | 545.8 | -12502.2 | elevated; elevated | no | 0 | 2 |
| 13 | Mogra ([n10576622712](https://www.openstreetmap.org/node/10576622712)) | मोगरा | 19.128436 | 72.855456 | 574.3 | -10896.2 | elevated; – | yes | 0 | 2 |
| 14 | Gundavali ([n10576622687](https://www.openstreetmap.org/node/10576622687)) | गुंदवली | 19.114513 | 72.855156 | 542.7 | -9354.9 | elevated; – | yes | 0 | 2 |

**Line 1 (CBD Belapur ⇔ Pendhar)** (navi-mumbai-metro-n1, [r16533437](https://www.openstreetmap.org/relation/16533437)) — 11 stations, 0 inside the map box

| # | station (OSM) | name:mr | lat | lon | x | z | level (track; tags) | in box | entrances | platforms |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | CBD Belapur ([n11335491947](https://www.openstreetmap.org/node/11335491947)) | सी बी डी बेलापूर | 19.020600 | 73.040266 | 20029.9 | 1040.5 | elevated; – | no | 0 | 0 |
| 2 | RBI Colony ([n11335491948](https://www.openstreetmap.org/node/11335491948)) | आर.बी.आय. कॉलनी | 19.022985 | 73.047943 | 20838.1 | 776.6 | elevated; elevated | no | 2 | 0 |
| 3 | Belpada ([w605163723](https://www.openstreetmap.org/way/605163723)) | बेलपाडा | 19.025273 | 73.054945 | 21575.2 | 523.2 | elevated; elevated | no | 0 | 0 |
| 4 | Utsav Chowk ([w605163722](https://www.openstreetmap.org/way/605163722)) | उत्सव चौक | 19.032547 | 73.059188 | 22021.9 | -281.9 | elevated; elevated | no | 0 | 0 |
| 5 | Kendriya Vihar ([w605163717](https://www.openstreetmap.org/way/605163717)) | केंद्रीय विहार | 19.037667 | 73.064078 | 22536.6 | -848.7 | elevated; elevated | no | 0 | 0 |
| 6 | Khargar Village ([w605163718](https://www.openstreetmap.org/way/605163718)) | खारघर गाव | 19.043109 | 73.074300 | 23612.8 | -1451.1 | elevated; elevated | no | 0 | 0 |
| 7 | Central Park ([w605163719](https://www.openstreetmap.org/way/605163719)) | सेंट्रल पार्क | 19.053613 | 73.075998 | 23791.5 | -2613.8 | elevated; elevated | no | 0 | 0 |
| 8 | Pethpada ([w605163720](https://www.openstreetmap.org/way/605163720)) | पेठपाडा | 19.063821 | 73.077365 | 23935.4 | -3743.7 | elevated; elevated | no | 0 | 0 |
| 9 | Sector-34 ([w605163721](https://www.openstreetmap.org/way/605163721)) | सेक्टर 34 | 19.073647 | 73.081814 | 24403.8 | -4831.4 | elevated; elevated | no | 0 | 0 |
| 10 | Panchanand ([w605163727](https://www.openstreetmap.org/way/605163727)) | पंचानंद | 19.074542 | 73.090771 | 25346.7 | -4930.4 | elevated; elevated | no | 0 | 0 |
| 11 | Pendhar ([n14078180443](https://www.openstreetmap.org/node/14078180443)) | पेंढार | 19.072212 | 73.097844 | 26091.3 | -4672.5 | elevated; elevated | no | 0 | 0 |

**Line 3 (Aarey Colony ↔ Cuffe Parade)** (mumbai-metro-3, [r17876724](https://www.openstreetmap.org/relation/17876724)) — 27 stations, 27 inside the map box

| # | station (OSM) | name:mr | lat | lon | x | z | level (track; tags) | in box | entrances | platforms |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Aarey JVLR ([w1330720641](https://www.openstreetmap.org/way/1330720641)) | आरे कॉलनी | 19.130556 | 72.884260 | 3606.6 | -11130.8 | at-grade|underground; – | yes | 1 | 2 |
| 2 | SEEPZ ([n5787704195](https://www.openstreetmap.org/node/5787704195)) | सीप्झ | 19.125999 | 72.873727 | 2497.8 | -10626.3 | underground; – | yes | 0 | 1 |
| 3 | MIDC - Andheri ([n5787704196](https://www.openstreetmap.org/node/5787704196)) | एम.आय.डी.सी. - अंधेरी | 19.117354 | 72.873597 | 2484.1 | -9669.4 | underground; – | yes | 0 | 1 |
| 4 | Marol Naka ([n5787704197](https://www.openstreetmap.org/node/5787704197)) | मरोळ नाका | 19.108504 | 72.878578 | 3008.5 | -8689.8 | underground; – | yes | 1 | 1 |
| 5 | Chhatrapati Shivaji Maharaj International Airport - T2 ([n5221297132](https://www.openstreetmap.org/node/5221297132)) | छत्रपती शिवाजी महाराज आंतरराष्ट्रीय विमानतळ – T2 | 19.102334 | 72.874469 | 2575.9 | -8006.8 | underground; – | yes | 0 | 1 |
| 6 | Sahar Road ([n12074909132](https://www.openstreetmap.org/node/12074909132)) | सहार रोड | 19.102196 | 72.865236 | 1604 | -7991.5 | underground; – | yes | 0 | 1 |
| 7 | Chhatrapati Shivaji Maharaj International Airport - T1 ([n12074909131](https://www.openstreetmap.org/node/12074909131)) | छत्रपती शिवाजी महाराज आंतरराष्ट्रीय विमानतळ – T1 | 19.093899 | 72.853577 | 376.5 | -7073.1 | underground; – | yes | 1 | 1 |
| 8 | Santacruz ([n12074909130](https://www.openstreetmap.org/node/12074909130)) | सांताक्रूझ | 19.079289 | 72.847119 | -303.3 | -5455.9 | underground; – | yes | 8 | 1 |
| 9 | Bandra Colony ([n12074909129](https://www.openstreetmap.org/node/12074909129)) |  | 19.069963 | 72.849360 | -67.4 | -4423.6 | underground; – | yes | 0 | 1 |
| 10 | Bandra Kurla Complex ([n5221297179](https://www.openstreetmap.org/node/5221297179)) | वांद्रे कुर्ला कॉम्प्लेक्स | 19.060663 | 72.854680 | 492.6 | -3394.2 | underground; – | yes | 6 | 2 |
| 11 | Dharavi ([n12855459847](https://www.openstreetmap.org/node/12855459847)) | धारावी | 19.046261 | 72.849741 | -27.3 | -1800 | underground; – | yes | 0 | 0 |
| 12 | Shitala Devi Mandir ([n12855459846](https://www.openstreetmap.org/node/12855459846)) | शितला देवी मंदिर | 19.038464 | 72.841965 | -845.9 | -936.9 | underground; – | yes | 5 | 0 |
| 13 | Dadar ([n12855459845](https://www.openstreetmap.org/node/12855459845)) | दादर | 19.023624 | 72.839221 | -1134.7 | 705.8 | underground; underground | yes | 3 | 0 |
| 14 | Siddhivinayak Temple ([n12857565156](https://www.openstreetmap.org/node/12857565156)) | सिद्धिविनायक मंदिर | 19.015894 | 72.830920 | -2008.6 | 1561.5 | underground; – | yes | 0 | 0 |
| 15 | Worli ([n12857565155](https://www.openstreetmap.org/node/12857565155)) | वरळी | 19.008606 | 72.819274 | -3234.6 | 2368.2 | underground; – | yes | 0 | 0 |
| 16 | Acharya Atre Chowk ([n12857565154](https://www.openstreetmap.org/node/12857565154)) | आचार्य अत्रे चौक | 18.997820 | 72.817720 | -3398.2 | 3562.1 | underground; – | yes | 1 | 0 |
| 17 | Science Centre ([n13192130536](https://www.openstreetmap.org/node/13192130536)) | विज्ञान संग्रहालय | 18.990895 | 72.821352 | -3015.9 | 4328.6 | underground; – | yes | 1 | 0 |
| 18 | Mahalaxmi ([n13192130535](https://www.openstreetmap.org/node/13192130535)) | महालक्ष्मी | 18.979467 | 72.825401 | -2589.7 | 5593.6 | underground; – | yes | 0 | 0 |
| 19 | Jagannath Shankar Sheth Metro ([n13192130534](https://www.openstreetmap.org/node/13192130534)) | जगन्नाथ शंकर शेठ मेट्रो | 18.969992 | 72.821180 | -3034 | 6642.4 | underground; – | yes | 0 | 0 |
| 20 | Grant Road ([n13207029325](https://www.openstreetmap.org/node/13207029325)) | ग्रँट रोड | 18.963218 | 72.818044 | -3364.1 | 7392.3 | underground; – | yes | 0 | 0 |
| 21 | Girgaon ([n13207029324](https://www.openstreetmap.org/node/13207029324)) | गिरगाव | 18.952102 | 72.822207 | -2925.9 | 8622.8 | underground; – | yes | 1 | 0 |
| 22 | Kalbadevi ([n13207029323](https://www.openstreetmap.org/node/13207029323)) | काळबादेवी | 18.946329 | 72.827193 | -2401 | 9261.7 | underground; – | yes | 2 | 0 |
| 23 | Chhatrapati Shivaji Maharaj Terminus ([n13207029322](https://www.openstreetmap.org/node/13207029322)) | छत्रपती शिवाजी महाराज टर्मिनस | 18.940833 | 72.831861 | -1909.5 | 9870.1 | underground; – | yes | 6 | 0 |
| 24 | Hutatma Chowk ([n13207029320](https://www.openstreetmap.org/node/13207029320)) | हुतात्मा चौक | 18.934185 | 72.832504 | -1841.9 | 10606 | underground; – | yes | 3 | 0 |
| 25 | Churchgate ([n13207029319](https://www.openstreetmap.org/node/13207029319)) | चर्चगेट | 18.931495 | 72.826939 | -2427.7 | 10903.8 | underground; – | yes | 6 | 0 |
| 26 | Vidhan Bhavan ([n13207029318](https://www.openstreetmap.org/node/13207029318)) | विधान भवन | 18.924781 | 72.825493 | -2579.9 | 11646.9 | underground; – | yes | 0 | 0 |
| 27 | Cuffe Parade ([n13207029317](https://www.openstreetmap.org/node/13207029317)) | कफ परेड | 18.913569 | 72.820715 | -3082.9 | 12888 | underground; – | yes | 0 | 0 |

**Line 2B (Chembur ↔ Mandale)** (mumbai-metro-2b, [r20403815](https://www.openstreetmap.org/relation/20403815)) — 6 stations, 4 inside the map box

| # | station (OSM) | name:mr | lat | lon | x | z | level (track; tags) | in box | entrances | platforms |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Chembur ([n5219622321](https://www.openstreetmap.org/node/5219622321)) | चेंबूर | 19.054130 | 72.892806 | 4506.4 | -2671 | elevated; – | yes | 0 | 0 |
| 2 | Diamond Garden ([n5219622393](https://www.openstreetmap.org/node/5219622393)) | डायमंड गार्डन | 19.051719 | 72.901838 | 5457.1 | -2404.1 | elevated; – | yes | 0 | 0 |
| 3 | Shivaji Chowk (Chembur) ([n13252997901](https://www.openstreetmap.org/node/13252997901)) | शिवाजी चौक (चेंबूर) | 19.047938 | 72.906981 | 5998.5 | -1985.6 | elevated; – | yes | 0 | 0 |
| 4 | Deonar ([n13252997906](https://www.openstreetmap.org/node/13252997906)) | देवनार | 19.044833 | 72.917495 | 7105.4 | -1641.9 | elevated; – | yes | 0 | 0 |
| 5 | Mankhurd ([n13252997911](https://www.openstreetmap.org/node/13252997911)) | मानखुर्द | 19.049217 | 72.931231 | 8551.4 | -2127.1 | elevated; – | no | 0 | 0 |
| 6 | Mandale ([n13252985100](https://www.openstreetmap.org/node/13252985100)) | मंडाले | 19.049592 | 72.938661 | 9333.6 | -2168.6 | elevated; – | no | 0 | 0 |

**Line 9 (Dahisar (East) ↔ Kashigaon)** (mumbai-metro-9, [r20403870](https://www.openstreetmap.org/relation/20403870)) — 4 stations, 0 inside the map box

| # | station (OSM) | name:mr | lat | lon | x | z | level (track; tags) | in box | entrances | platforms |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Dahisar (East) [Line 9] ([n13758670735](https://www.openstreetmap.org/node/13758670735)) | दहिसर (पूर्व) [लाईन ९] | 19.251080 | 72.867452 | 1837.2 | -24471.9 | elevated; – | no | 0 | 2 |
| 2 | Pandurang Wadi ([n13758670736](https://www.openstreetmap.org/node/13758670736)) | पांडुरंग वाडी | 19.259726 | 72.872486 | 2367.2 | -25429 | elevated; elevated | no | 0 | 2 |
| 3 | Miragaon ([n13758670737](https://www.openstreetmap.org/node/13758670737)) | मिरागाव | 19.271007 | 72.880698 | 3231.6 | -26677.6 | elevated; elevated | no | 0 | 2 |
| 4 | Kashigaon ([n13758670740](https://www.openstreetmap.org/node/13758670740)) | काशिगाव | 19.277666 | 72.880240 | 3183.4 | -27414.8 | elevated; – | no | 0 | 0 |

#### T5 Stations under construction or proposed, and station objects on no route (positions marked "inferred" are means of stop positions)

| station (OSM) | lifecycle | relation line(s) | near track groups (inferred, 150 m) | lat | lon | x | z | in box | position |
|---|---|---|---|---|---|---|---|---|---|
| Jogeshwari Metro Station (Harbour) - West ([w1170388401](https://www.openstreetmap.org/way/1170388401)) | operational |  |  | 19.141212 | 72.849295 | -74.2 | -12310.3 | no | osm: centroid of station way |
| ESIC Nagar ([n5219622841](https://www.openstreetmap.org/node/5219622841)) | construction | mumbai-metro-2-relation-7898712 | Dahisar (W) to Mandale Metro (Line-2) | 19.116574 | 72.829859 | -2120.3 | -9583.1 | yes | osm: station node |
| Prem Nagar ([n5219622335](https://www.openstreetmap.org/node/5219622335)) | construction |  | Dahisar (W) to Mandale Metro (Line-2) | 19.110043 | 72.837157 | -1352 | -8860.2 | yes | osm: station node |
| Indira Nagar ([n5219622821](https://www.openstreetmap.org/node/5219622821)) | construction | mumbai-metro-2-relation-7898712 | Dahisar (W) to Mandale Metro (Line-2) | 19.102888 | 72.836866 | -1382.6 | -8068.1 | yes | osm: station node |
| Nanavati Hospital ([n5219622334](https://www.openstreetmap.org/node/5219622334)) | construction | mumbai-metro-2-relation-7898712 | Dahisar (W) to Mandale Metro (Line-2) | 19.096079 | 72.839506 | -1104.8 | -7314.5 | yes | osm: station node |
| Khira Nagar ([n5219622327](https://www.openstreetmap.org/node/5219622327)) | construction | mumbai-metro-2-relation-7898712 | Dahisar (W) to Mandale Metro (Line-2) | 19.082919 | 72.837959 | -1267.6 | -5857.7 | yes | osm: station node |
| SG Barve Marg ([n5219622644](https://www.openstreetmap.org/node/5219622644)) | construction | mumbai-metro-2-relation-7898712 | Dahisar (W) to Mandale Metro (Line-2) | 19.075804 | 72.877407 | 2885.3 | -5070.1 | yes | osm: station node |
| Saraswat Nagar ([n5219622325](https://www.openstreetmap.org/node/5219622325)) | construction | mumbai-metro-2-relation-7898712 | Dahisar (W) to Mandale Metro (Line-2) | 19.074668 | 72.837553 | -1310.3 | -4944.4 | yes | osm: station node |
| Kurla Terminal ([n5219622634](https://www.openstreetmap.org/node/5219622634)) | construction | mumbai-metro-2-relation-7898712 | Dahisar (W) to Mandale Metro (Line-2) | 19.071817 | 72.885087 | 3693.7 | -4628.8 | yes | osm: station node |
| MTNL ([n5219622658](https://www.openstreetmap.org/node/5219622658)) | construction | mumbai-metro-2-relation-7898712 | Dahisar (W) to Mandale Metro (Line-2) | 19.070486 | 72.870629 | 2171.7 | -4481.5 | yes | osm: station node |
| National College ([n5219622332](https://www.openstreetmap.org/node/5219622332)) | construction | mumbai-metro-2-relation-7898712 | Dahisar (W) to Mandale Metro (Line-2) | 19.064822 | 72.837311 | -1335.8 | -3854.6 | yes | osm: station node |
| IL&FS ([n5219622663](https://www.openstreetmap.org/node/5219622663)) | construction | mumbai-metro-2-relation-7898712 | Dahisar (W) to Mandale Metro (Line-2) | 19.063642 | 72.860038 | 1056.8 | -3724 | yes | osm: station node |
| Kurla ([n5219622419](https://www.openstreetmap.org/node/5219622419)) | construction | mumbai-metro-2-relation-7898712 | Dahisar (W) to Mandale Metro (Line-2) | 19.062995 | 72.884714 | 3654.4 | -3652.3 | yes | osm: station node |
| EEH ([n5219622408](https://www.openstreetmap.org/node/5219622408)) | construction | mumbai-metro-2-relation-7898712, mumbai-metro-4-relation-7898732 | Dahisar (W) to Mandale Metro (Line-2), Line 4 | 19.057237 | 72.887060 | 3901.4 | -3014.9 | yes | osm: station node |
| MMRDA ([n5219622677](https://www.openstreetmap.org/node/5219622677)) | construction | mumbai-metro-2-relation-7898712 | Dahisar (W) to Mandale Metro (Line-2) | 19.054011 | 72.849391 | -64.1 | -2657.9 | yes | osm: station node |
| Wadala Depot ([n12902033364](https://www.openstreetmap.org/node/12902033364)) | proposed |  | Line 11 | 19.039484 | 72.876230 | 2761.3 | -1049.8 | yes | osm: station node |
| CGS Colony ([n12902033350](https://www.openstreetmap.org/node/12902033350)) | proposed |  | Line 11 | 19.029123 | 72.868860 | 1985.5 | 97 | yes | osm: station node |
| Ganesh Nagar ([n12902033343](https://www.openstreetmap.org/node/12902033343)) | proposed |  | Line 11 | 19.018525 | 72.865990 | 1683.3 | 1270.2 | yes | osm: station node |
| BPT Hospital ([n5225899320](https://www.openstreetmap.org/node/5225899320)) | proposed |  | Line 11 | 19.011870 | 72.862269 | 1291.6 | 2006.8 | yes | osm: station node |
| Sewri ([n10244200822](https://www.openstreetmap.org/node/10244200822)) | proposed |  | Line 11 | 18.998522 | 72.855046 | 531.3 | 3484.4 | yes | osm: station node |
| Hay Bunder ([n12902183202](https://www.openstreetmap.org/node/12902183202)) | proposed |  | Line 11 | 18.990282 | 72.854320 | 454.7 | 4396.4 | yes | osm: station node |
| Coal Bunder ([n10244200828](https://www.openstreetmap.org/node/10244200828)) | proposed |  | Line 11 | 18.981560 | 72.850157 | 16.5 | 5362 | yes | osm: station node |
| Reay Road ([n5225899286](https://www.openstreetmap.org/node/5225899286)) | proposed |  | Line 11 | 18.975965 | 72.843315 | -703.8 | 5981.3 | yes | osm: station node |
| Byculla ([n12902121976](https://www.openstreetmap.org/node/12902121976)) | proposed |  | Line 11 | 18.975611 | 72.833445 | -1742.8 | 6020.4 | yes | osm: station node |
| Nagpada Junction ([n5225899275](https://www.openstreetmap.org/node/5225899275)) | proposed |  | Line 11 | 18.966683 | 72.828741 | -2238 | 7008.7 | yes | osm: station node |
| Bhendi Bazaar ([n12902121982](https://www.openstreetmap.org/node/12902121982)) | proposed |  | Line 11 | 18.957314 | 72.831862 | -1909.4 | 8045.7 | yes | osm: station node |
| Crawford Market ([n9132436353](https://www.openstreetmap.org/node/9132436353)) | proposed |  | Line 11 | 18.947359 | 72.833734 | -1712.4 | 9147.8 | yes | osm: station node |
| CSMT Metro ([n5225899267](https://www.openstreetmap.org/node/5225899267)) | proposed |  | Line 11 | 18.940631 | 72.834782 | -1602.1 | 9892.5 | yes | osm: station node |
| Horniman Circle ([n12902121991](https://www.openstreetmap.org/node/12902121991)) | proposed |  | Line 11 | 18.932122 | 72.834286 | -1654.2 | 10834.4 | yes | osm: station node |
| SMP Circle ([n12902121997](https://www.openstreetmap.org/node/12902121997)) | proposed |  | Line 11 | 18.925260 | 72.832610 | -1830.8 | 11593.9 | yes | osm: station node |
| Kasarvadavli Station (stops [n5225899082](https://www.openstreetmap.org/node/5225899082) [n12238603158](https://www.openstreetmap.org/node/12238603158)) | construction | mumbai-metro-4-relation-7898732 | Line 4 | 19.267420 | 72.966624 | 12277.3 | -26280.6 | no | inferred mean of stop positions |
| Vijay Garden Station (stops [n5225899089](https://www.openstreetmap.org/node/5225899089) [n12238603766](https://www.openstreetmap.org/node/12238603766)) | construction | mumbai-metro-4-relation-7898732 | Line 4 | 19.258718 | 72.970111 | 12644.4 | -25317.3 | no | inferred mean of stop positions |
| Dongripada Station (stops [n8462729071](https://www.openstreetmap.org/node/8462729071) [n12238582458](https://www.openstreetmap.org/node/12238582458)) | construction | mumbai-metro-4-relation-7898732 | Line 4, Thane Ring Metro | 19.250579 | 72.973241 | 12973.9 | -24416.5 | no | inferred mean of stop positions |
| Tikujiniwadi Station (stops [n5225899099](https://www.openstreetmap.org/node/5225899099) [n12238603249](https://www.openstreetmap.org/node/12238603249)) | construction | mumbai-metro-4-relation-7898732 | Line 4 | 19.238358 | 72.975586 | 13220.8 | -23063.6 | no | inferred mean of stop positions |
| Manpada ([w1484919206](https://www.openstreetmap.org/way/1484919206)) | construction | mumbai-metro-4-relation-7898732 | Line 4 | 19.231404 | 72.976584 | 13325.9 | -22293.9 | no | osm: centroid of station way |
| Kapurbawdi Station ([n8342841400](https://www.openstreetmap.org/node/8342841400)) | construction | mumbai-metro-4-relation-7898732 | Line 4, Line-5: Thane - Bhiwandi - Kalyan, Mumbai Metro Line 5 | 19.224143 | 72.977425 | 13414.4 | -21490.1 | no | osm: station node |
| Majiwada Station (stops [n5225899110](https://www.openstreetmap.org/node/5225899110) [n12238603749](https://www.openstreetmap.org/node/12238603749)) | construction | mumbai-metro-4-relation-7898732 | Line 4 | 19.211574 | 72.975753 | 13238.4 | -20098.9 | no | inferred mean of stop positions |
| Cadbury Junction Station (stops [n9121318238](https://www.openstreetmap.org/node/9121318238)) | construction | mumbai-metro-4-relation-7898732 | Line 4 | 19.206418 | 72.970449 | 12680 | -19528.1 | no | inferred mean of stop positions |
| Mahapalika Bhavan Marg Station (stops [n9121318237](https://www.openstreetmap.org/node/9121318237) [n12238603060](https://www.openstreetmap.org/node/12238603060)) | construction | mumbai-metro-4-relation-7898732 | Line 4 | 19.201270 | 72.965047 | 12111.3 | -18958.3 | no | inferred mean of stop positions |
| RTO Thane Station (stops [n9126268648](https://www.openstreetmap.org/node/9126268648) [n12238603793](https://www.openstreetmap.org/node/12238603793)) | construction | mumbai-metro-4-relation-7898732 | Line 4 | 19.192956 | 72.962714 | 11865.7 | -18038 | no | inferred mean of stop positions |
| Teen Hath Naka ([w1411928576](https://www.openstreetmap.org/way/1411928576)) | construction | mumbai-metro-4-relation-7898732 | Line 4 | 19.187071 | 72.961538 | 11741.9 | -17386.6 | no | osm: centroid of station way |
| Mulund Check Naka Metro ([w1330126871](https://www.openstreetmap.org/way/1330126871)) | construction | mumbai-metro-4-relation-7898732 | Line 4 | 19.183457 | 72.950955 | 10627.9 | -16986.5 | no | osm: centroid of station way |
| Mulund Fire Station Metro ([w1330126872](https://www.openstreetmap.org/way/1330126872)) | construction | mumbai-metro-4-relation-7898732 | Line 4 | 19.175698 | 72.942541 | 9742 | -16127.6 | no | osm: centroid of station way |
| Sonapur Station (stops [n9126268645](https://www.openstreetmap.org/node/9126268645) [n12238603344](https://www.openstreetmap.org/node/12238603344)) | construction | mumbai-metro-4-relation-7898732 | Line 4 | 19.166209 | 72.938408 | 9306.9 | -15077.3 | no | inferred mean of stop positions |
| Shangrila Station (stops [n9126268644](https://www.openstreetmap.org/node/9126268644)) | construction | mumbai-metro-4-relation-7898732 | Line 4 | 19.153753 | 72.937517 | 9213.2 | -13698.5 | no | inferred mean of stop positions |
| Bhandup Station (W) (stops [n6038193885](https://www.openstreetmap.org/node/6038193885)) | construction | mumbai-metro-4-relation-7898732 | Line 4 | 19.146087 | 72.936059 | 9059.6 | -12849.9 | no | inferred mean of stop positions |
| Bhandup Mahapalika Station (stops [n5225899378](https://www.openstreetmap.org/node/5225899378) [n12238602996](https://www.openstreetmap.org/node/12238602996)) | construction | mumbai-metro-4-relation-7898732 | Line 4 | 19.138751 | 72.930752 | 8501 | -12038 | no | inferred mean of stop positions |
| Naval Housing Station (stops [n5225899381](https://www.openstreetmap.org/node/5225899381) [n12238603132](https://www.openstreetmap.org/node/12238603132)) | construction | mumbai-metro-4-relation-7898732 | Line 4 | 19.132898 | 72.927698 | 8179.5 | -11390 | no | inferred mean of stop positions |
| Surya Nagar Station (stops [n5225899391](https://www.openstreetmap.org/node/5225899391)) | construction | mumbai-metro-4-relation-7898732 | Line 4 | 19.117657 | 72.926084 | 8009.6 | -9703 | no | inferred mean of stop positions |
| Vikhroli Station (stops [n5225899397](https://www.openstreetmap.org/node/5225899397)) | construction | mumbai-metro-4-relation-7898732 | Line 4 | 19.109005 | 72.924577 | 7850.9 | -8745.2 | no | inferred mean of stop positions |
| Godrej Colony Station (stops [n5225899401](https://www.openstreetmap.org/node/5225899401)) | construction | mumbai-metro-4-relation-7898732 | Line 4 | 19.102908 | 72.920355 | 7406.5 | -8070.4 | no | inferred mean of stop positions |
| Shreyas Cinema Station (stops [n5225899404](https://www.openstreetmap.org/node/5225899404) [n12238603734](https://www.openstreetmap.org/node/12238603734)) | construction | mumbai-metro-4-relation-7898732 | Line 4 | 19.097646 | 72.916185 | 6967.5 | -7487.9 | yes | inferred mean of stop positions |
| Lakshmi Nagar Station (stops [n9132436411](https://www.openstreetmap.org/node/9132436411) [n12238603738](https://www.openstreetmap.org/node/12238603738)) | construction | mumbai-metro-4-relation-7898732 | Line 4 | 19.088986 | 72.918417 | 7202.4 | -6529.3 | yes | inferred mean of stop positions |
| Pant Nagar Station (stops [n9132436362](https://www.openstreetmap.org/node/9132436362)) | construction | mumbai-metro-4-relation-7898732 | Line 4 | 19.082177 | 72.912686 | 6599.1 | -5775.6 | yes | inferred mean of stop positions |
| Garodia Nagar Station (stops [n9132436363](https://www.openstreetmap.org/node/9132436363)) | construction | mumbai-metro-4-relation-7898732 | Line 4 | 19.072575 | 72.902318 | 5507.7 | -4712.7 | yes | inferred mean of stop positions |
| Amar Mahal Junction Station (stops [n9132436365](https://www.openstreetmap.org/node/9132436365) [n12238603355](https://www.openstreetmap.org/node/12238603355)) | construction | mumbai-metro-4-relation-7898732 | Line 4 | 19.067413 | 72.899975 | 5261.1 | -4141.3 | yes | inferred mean of stop positions |
| Suman Nagar Station (stops [n5225899453](https://www.openstreetmap.org/node/5225899453) [n12238603369](https://www.openstreetmap.org/node/12238603369)) | construction | mumbai-metro-4-relation-7898732 | Line 4 | 19.053879 | 72.883610 | 3538.2 | -2643.2 | yes | inferred mean of stop positions |
| Anik Nagar Bus Depot Station ([n9132436368](https://www.openstreetmap.org/node/9132436368)) | construction | mumbai-metro-4-relation-7898732 | Line 4, Line 11 | 19.045827 | 72.878634 | 3014.4 | -1751.9 | yes | osm: station node |
| Wadala TT Station (stops [n9132436369](https://www.openstreetmap.org/node/9132436369) [n12238602759](https://www.openstreetmap.org/node/12238602759)) | construction | mumbai-metro-4-relation-7898732 | Line 4, Mumbai Monorail Line 1 | 19.038063 | 72.880235 | 3182.9 | -892.6 | yes | inferred mean of stop positions |
| Gaimukh Station ([n8462729069](https://www.openstreetmap.org/node/8462729069)) | construction | mumbai-metro-4-relation-7898732 | Line 4A | 19.284435 | 72.946808 | 10191.3 | -28164 | no | osm: station node |
| Gowniwada Station ([n8462729070](https://www.openstreetmap.org/node/8462729070)) | construction | mumbai-metro-4-relation-7898732 | Line 4A | 19.276747 | 72.958227 | 11393.4 | -27313 | no | osm: station node |
| Swami Samarth Nagar Station (stops [n5219518738](https://www.openstreetmap.org/node/5219518738) [n12219587659](https://www.openstreetmap.org/node/12219587659)) | construction | mumbai-metro-6-relation-7898711 | Line 6 | 19.143677 | 72.819731 | -3186.5 | -12583.1 | no | inferred mean of stop positions |
| Adarsh Nagar Station (stops [n5219518752](https://www.openstreetmap.org/node/5219518752) [n12219566486](https://www.openstreetmap.org/node/12219566486)) | construction | mumbai-metro-6-relation-7898711 | Line 6 | 19.141818 | 72.833610 | -1725.4 | -12377.4 | no | inferred mean of stop positions |
| Lokhandwala Station (stops [n5219518747](https://www.openstreetmap.org/node/5219518747) [n12219566476](https://www.openstreetmap.org/node/12219566476)) | construction | mumbai-metro-6-relation-7898711 | Line 6 | 19.140679 | 72.827200 | -2400.2 | -12251.3 | no | inferred mean of stop positions |
| JVLR Station (stops [n9132708009](https://www.openstreetmap.org/node/9132708009) [n12219587427](https://www.openstreetmap.org/node/12219587427)) | construction | mumbai-metro-6-relation-7898711 | Line 6, Line 7 | 19.140530 | 72.854001 | 421.2 | -12234.9 | no | inferred mean of stop positions |
| Momin Nagar Station (stops [n9132708002](https://www.openstreetmap.org/node/9132708002) [n12219587411](https://www.openstreetmap.org/node/12219587411)) | construction | mumbai-metro-6-relation-7898711 | Line 6 | 19.139807 | 72.845968 | -424.4 | -12154.8 | yes | inferred mean of stop positions |
| Majas Depot Station (stops [n9132708010](https://www.openstreetmap.org/node/9132708010) [n12219587441](https://www.openstreetmap.org/node/12219587441)) | construction | mumbai-metro-6-relation-7898711 | Line 6 | 19.139244 | 72.861903 | 1253 | -12092.5 | yes | inferred mean of stop positions |
| Mahakali Caves Station (stops [n5219518799](https://www.openstreetmap.org/node/5219518799) [n12219587475](https://www.openstreetmap.org/node/12219587475)) | construction | mumbai-metro-6-relation-7898711 | Line 6 | 19.133494 | 72.874704 | 2600.6 | -11456 | yes | inferred mean of stop positions |
| SEEPZ Station (stops [n5219518806](https://www.openstreetmap.org/node/5219518806) [n12219587493](https://www.openstreetmap.org/node/12219587493)) | construction | mumbai-metro-6-relation-7898711 | Line 6 | 19.129388 | 72.882646 | 3436.8 | -11001.5 | yes | inferred mean of stop positions |
| Saki Vihar Road Station (stops [n5219518819](https://www.openstreetmap.org/node/5219518819) [n12219587511](https://www.openstreetmap.org/node/12219587511)) | construction | mumbai-metro-6-relation-7898711 | Line 6 | 19.126227 | 72.890526 | 4266.3 | -10651.5 | yes | inferred mean of stop positions |
| Kanjurmarg Station (stops [n5225899386](https://www.openstreetmap.org/node/5225899386) [n12219587638](https://www.openstreetmap.org/node/12219587638)) | construction | mumbai-metro-6-relation-7898711, mumbai-metro-4-relation-7898732 | Line 6, Line 4 | 19.125415 | 72.925255 | 7922.4 | -10561.8 | no | inferred mean of stop positions |
| Vikhroli Station (stops [n5219519273](https://www.openstreetmap.org/node/5219519273) [n12219587647](https://www.openstreetmap.org/node/12219587647)) | construction |  | Line 6 | 19.124753 | 72.936474 | 9103.4 | -10488.5 | no | inferred mean of stop positions |
| IIT Powai Station (stops [n9132708012](https://www.openstreetmap.org/node/9132708012) [n12219587586](https://www.openstreetmap.org/node/12219587586)) | construction | mumbai-metro-6-relation-7898711 | Line 6 | 19.124257 | 72.913732 | 6709.3 | -10433.6 | yes | inferred mean of stop positions |
| Powai Udyan Station (stops [n9132708011](https://www.openstreetmap.org/node/9132708011) [n12219587528](https://www.openstreetmap.org/node/12219587528)) | construction | mumbai-metro-6-relation-7898711 | Line 6 | 19.121601 | 72.898990 | 5157.4 | -10139.5 | yes | inferred mean of stop positions |
| Powai Lake Station (stops [n5219519239](https://www.openstreetmap.org/node/5219519239) [n12219587550](https://www.openstreetmap.org/node/12219587550)) | construction | mumbai-metro-6-relation-7898711 | Line 6 | 19.120031 | 72.905958 | 5890.9 | -9965.7 | yes | inferred mean of stop positions |
| Airport Colony Station ([n9131712733](https://www.openstreetmap.org/node/9131712733)) | construction | mumbai-metro-7-relation-7898769 | Line 7A | 19.105818 | 72.854017 | 422.9 | -8392.5 | yes | osm: station node |
| Shaheed Bhagat Singh Garden Station (stops [n9130240857](https://www.openstreetmap.org/node/9130240857) [n10299481473](https://www.openstreetmap.org/node/10299481473)) | construction | mumbai-metro-7-relation-7898769 | Line 9 | 19.295073 | 72.853792 | 399.2 | -29341.6 | no | inferred mean of stop positions |
| Shahid Bhagat Singh Garden ([n10299481539](https://www.openstreetmap.org/node/10299481539)) | construction |  | Line 9 | 19.294812 | 72.849362 | -67.2 | -29312.6 | no | osm: station node |
| Subhash Chandra Bose Ground ([n9130240851](https://www.openstreetmap.org/node/9130240851)) | construction |  | Line 9 | 19.294238 | 72.843129 | -723.3 | -29249.1 | no | osm: station node |
| Meditya Nagar Station (stops [n5226162351](https://www.openstreetmap.org/node/5226162351) [n10299481681](https://www.openstreetmap.org/node/10299481681)) | construction | mumbai-metro-7-relation-7898769 | Line 9 | 19.293708 | 72.860343 | 1088.9 | -29190.4 | no | inferred mean of stop positions |
| Sai Baba Nagar Station (stops [n9130240849](https://www.openstreetmap.org/node/9130240849) [n10299481683](https://www.openstreetmap.org/node/10299481683)) | construction | mumbai-metro-7-relation-7898769 | Line 9 | 19.284495 | 72.870869 | 2197 | -28170.6 | no | inferred mean of stop positions |
| Balkum ([w1484919200](https://www.openstreetmap.org/way/1484919200)) | construction |  | Line-5: Thane - Bhiwandi - Kalyan, Mumbai Metro Line 5 | 19.220555 | 72.987934 | 14520.8 | -21093 | no | osm: centroid of station way |
| CSIA T1 ([n5221295390](https://www.openstreetmap.org/node/5221295390)) | construction |  | Mumbai Metro Line 3 | 19.094241 | 72.853259 | 343.1 | -7110.9 | yes | osm: station node |
| Khandeshwar ([n11703145846](https://www.openstreetmap.org/node/11703145846)) | construction |  | Navi Mumbai Metro Line 1 - Stage 2 | 19.010273 | 73.094719 | 25762.3 | 2183.7 | no | osm: station node |
| Waghbil ([n13621005380](https://www.openstreetmap.org/node/13621005380)) | proposed |  | Thane Ring Metro | 19.263921 | 72.979427 | 13625.2 | -25893.3 | no | osm: station node |
| Waterfront ([n13621005391](https://www.openstreetmap.org/node/13621005391)) | proposed |  | Thane Ring Metro | 19.262495 | 72.988409 | 14570.8 | -25735.4 | no | osm: station node |
| Vijay Nagari ([n13621005346](https://www.openstreetmap.org/node/13621005346)) | proposed |  | Thane Ring Metro | 19.255467 | 72.973519 | 13003.2 | -24957.5 | no | osm: station node |
| Dongripada ([n13621005336](https://www.openstreetmap.org/node/13621005336)) | proposed |  | Thane Ring Metro, Line 4 | 19.248771 | 72.974732 | 13130.9 | -24216.3 | no | osm: station node |
| Patlipada ([n13621027119](https://www.openstreetmap.org/node/13621027119)) | proposed |  | Thane Ring Metro | 19.247301 | 72.983182 | 14020.5 | -24053.6 | no | osm: station node |
| Azad Nagar Bus Stop ([n8462838145](https://www.openstreetmap.org/node/8462838145)) | operational |  | Thane Ring Metro | 19.241037 | 72.980999 | 13790.7 | -23360.2 | no | osm: station node |
| Manpada ([n9392521746](https://www.openstreetmap.org/node/9392521746)) | proposed |  | Thane Ring Metro | 19.235478 | 72.971299 | 12769.5 | -22744.9 | no | osm: station node |
| Dr. Kashinath Ghanekar Natyagruha ([n13620913301](https://www.openstreetmap.org/node/13620913301)) | proposed |  | Thane Ring Metro | 19.229168 | 72.969884 | 12620.6 | -22046.4 | no | osm: station node |
| Neelkanth Terminal ([n13620907772](https://www.openstreetmap.org/node/13620907772)) | proposed |  | Thane Ring Metro | 19.221187 | 72.959392 | 11516 | -21162.9 | no | osm: station node |
| Ghandi Nagar ([n13620907777](https://www.openstreetmap.org/node/13620907777)) | proposed |  | Thane Ring Metro | 19.219113 | 72.967518 | 12371.5 | -20933.4 | no | osm: station node |
| Shivai Nagar ([n13620907750](https://www.openstreetmap.org/node/13620907750)) | proposed |  | Thane Ring Metro | 19.217390 | 72.954171 | 10966.4 | -20742.7 | no | osm: station node |
| Lokmanya Nagar Bus Depot ([n8462838052](https://www.openstreetmap.org/node/8462838052)) | proposed |  | Thane Ring Metro | 19.208858 | 72.951461 | 10681.1 | -19798.3 | no | osm: station node |
| Wagle Circle ([n13620907738](https://www.openstreetmap.org/node/13620907738)) | proposed |  | Thane Ring Metro | 19.196284 | 72.949250 | 10448.3 | -18406.3 | no | osm: station node |
| SBI-Dadar Metro ([n14144295508](https://www.openstreetmap.org/node/14144295508)) | operational |  | Worli to SEEPZ (Line-3) | 19.024655 | 72.839928 | -1060.3 | 591.7 | yes | osm: station node |

#### T6 Entrances per station

| station | entrances (ref or name; distance from station point) |
|---|---|
| Ghatkopar L1 ([w151205149](https://www.openstreetmap.org/way/151205149)) | Gate 1A [n12311733718](https://www.openstreetmap.org/node/12311733718) 77 m; Gate 1B [n12311733717](https://www.openstreetmap.org/node/12311733717) 89 m; Gate 2A [n12311587236](https://www.openstreetmap.org/node/12311587236) 55 m; Gate 2B [n12311587233](https://www.openstreetmap.org/node/12311587233) 65 m; Gate 3 [n4264598043](https://www.openstreetmap.org/node/4264598043) 60 m; Gate 4 [n12311733716](https://www.openstreetmap.org/node/12311733716) 50 m |
| Marol Naka ([w311841876](https://www.openstreetmap.org/way/311841876)) | 5 [n12307063898](https://www.openstreetmap.org/node/12307063898) 79 m; ? [n12307063893](https://www.openstreetmap.org/node/12307063893) 85 m; 4 [n12307114402](https://www.openstreetmap.org/node/12307114402) 26 m; 2 [n13381178009](https://www.openstreetmap.org/node/13381178009) 70 m |
| Versova ([w287299861](https://www.openstreetmap.org/way/287299861)) | 3 [n7159653239](https://www.openstreetmap.org/node/7159653239) 88 m; 1 [n6249729384](https://www.openstreetmap.org/node/6249729384) 73 m; ? [n6249730786](https://www.openstreetmap.org/node/6249730786) 72 m; 2 [n13240733191](https://www.openstreetmap.org/node/13240733191) 32 m; 5 [n13240659433](https://www.openstreetmap.org/node/13240659433) 81 m; 4 [n13240733188](https://www.openstreetmap.org/node/13240733188) 80 m |
| D. N. Nagar ([w287299866](https://www.openstreetmap.org/way/287299866)) | 4 [n6249729380](https://www.openstreetmap.org/node/6249729380) 79 m; ? (lift) [n12317694546](https://www.openstreetmap.org/node/12317694546) 48 m; ? (lift) [n12317694549](https://www.openstreetmap.org/node/12317694549) 48 m; 1 [n12317694545](https://www.openstreetmap.org/node/12317694545) 101 m; 2 [n12317694543](https://www.openstreetmap.org/node/12317694543) 19 m; 3 [n12317694541](https://www.openstreetmap.org/node/12317694541) 67 m |
| Western Express Highway ([w331815671](https://www.openstreetmap.org/way/331815671)) | 4 [n6233175522](https://www.openstreetmap.org/node/6233175522) 92 m; 5 [n6233172619](https://www.openstreetmap.org/node/6233172619) 101 m |
| Aarey ([n9629564097](https://www.openstreetmap.org/node/9629564097)) | A [n13382963172](https://www.openstreetmap.org/node/13382963172) 136 m; B [n13382963174](https://www.openstreetmap.org/node/13382963174) 26 m |
| Rashtriya Udyan ([n9629564104](https://www.openstreetmap.org/node/9629564104)) | B [n13387660175](https://www.openstreetmap.org/node/13387660175) 35 m |
| Andheri (West) ([n10576726748](https://www.openstreetmap.org/node/10576726748)) | A1 [n12946893142](https://www.openstreetmap.org/node/12946893142) 133 m; A2 [n14197793983](https://www.openstreetmap.org/node/14197793983) 73 m |
| Lower Oshiwara ([n10576726751](https://www.openstreetmap.org/node/10576726751)) | B1 [n13238493324](https://www.openstreetmap.org/node/13238493324) 102 m; B2 [n13238493326](https://www.openstreetmap.org/node/13238493326) 110 m; B2 (lift) [n13238493339](https://www.openstreetmap.org/node/13238493339) 59 m |
| Oshiwara ([n10576726756](https://www.openstreetmap.org/node/10576726756)) | B1 [n14158954596](https://www.openstreetmap.org/node/14158954596) 51 m; Oshiwara [n14158954592](https://www.openstreetmap.org/node/14158954592) 72 m; B2 (lift) [n13238493340](https://www.openstreetmap.org/node/13238493340) 68 m |
| RBI Colony ([n11335491948](https://www.openstreetmap.org/node/11335491948)) | ? [n10717929063](https://www.openstreetmap.org/node/10717929063) 9 m; ? [n10717929061](https://www.openstreetmap.org/node/10717929061) 20 m |
| Aarey JVLR ([w1330720641](https://www.openstreetmap.org/way/1330720641)) | A1 [n12307248578](https://www.openstreetmap.org/node/12307248578) 5 m |
| Santacruz ([n12074909130](https://www.openstreetmap.org/node/12074909130)) | B1 (lift) [n13238072459](https://www.openstreetmap.org/node/13238072459) 35 m; B1 [n13238072458](https://www.openstreetmap.org/node/13238072458) 78 m; B2 [n13238072460](https://www.openstreetmap.org/node/13238072460) 65 m; B2 (lift) [n13238072461](https://www.openstreetmap.org/node/13238072461) 60 m; A2 [n13238072462](https://www.openstreetmap.org/node/13238072462) 212 m; A2 (lift) [n13238072463](https://www.openstreetmap.org/node/13238072463) 165 m; A1 (lift) [n13238072464](https://www.openstreetmap.org/node/13238072464) 205 m; A1 [n13238072465](https://www.openstreetmap.org/node/13238072465) 248 m |
| Marol Naka ([n5787704197](https://www.openstreetmap.org/node/5787704197)) | A-2 [n12896168751](https://www.openstreetmap.org/node/12896168751) 32 m |
| Bandra Kurla Complex ([n5221297179](https://www.openstreetmap.org/node/5221297179)) | A1 [n12294377162](https://www.openstreetmap.org/node/12294377162) 155 m; A1 [n12294377161](https://www.openstreetmap.org/node/12294377161) 154 m; A2 [n12696004072](https://www.openstreetmap.org/node/12696004072) 121 m; A3 [n8443491305](https://www.openstreetmap.org/node/8443491305) 154 m; A4 [n14005709002](https://www.openstreetmap.org/node/14005709002) 186 m; B1 [n12696004073](https://www.openstreetmap.org/node/12696004073) 144 m |
| Chhatrapati Shivaji Maharaj International Airport - T1 ([n12074909131](https://www.openstreetmap.org/node/12074909131)) | A1 [n12946862339](https://www.openstreetmap.org/node/12946862339) 43 m |
| Dadar ([n12855459845](https://www.openstreetmap.org/node/12855459845)) | A1 (lift) [n13507403010](https://www.openstreetmap.org/node/13507403010) 103 m; A3 [n13507403014](https://www.openstreetmap.org/node/13507403014) 140 m; A4 [n13506627012](https://www.openstreetmap.org/node/13506627012) 90 m |
| Shitala Devi Mandir ([n12855459846](https://www.openstreetmap.org/node/12855459846)) | A2 [n13237759050](https://www.openstreetmap.org/node/13237759050) 133 m; B2 [n13237759056](https://www.openstreetmap.org/node/13237759056) 108 m; B3 [n13237759055](https://www.openstreetmap.org/node/13237759055) 19 m; B1 [n13237759057](https://www.openstreetmap.org/node/13237759057) 45 m; A1 [n13237759058](https://www.openstreetmap.org/node/13237759058) 66 m |
| Acharya Atre Chowk ([n12857565154](https://www.openstreetmap.org/node/12857565154)) | A4 [n12917242605](https://www.openstreetmap.org/node/12917242605) 227 m |
| Science Centre ([n13192130536](https://www.openstreetmap.org/node/13192130536)) | ? [n13420305654](https://www.openstreetmap.org/node/13420305654) 66 m |
| Churchgate ([n13207029319](https://www.openstreetmap.org/node/13207029319)) | A2 [n13471766151](https://www.openstreetmap.org/node/13471766151) 261 m; A4 [n14101276016](https://www.openstreetmap.org/node/14101276016) 164 m; B1 [n14101252997](https://www.openstreetmap.org/node/14101252997) 39 m; B2 [n14101252987](https://www.openstreetmap.org/node/14101252987) 36 m; ? [n13470129555](https://www.openstreetmap.org/node/13470129555) 224 m [inferred link]; ? [n13470129587](https://www.openstreetmap.org/node/13470129587) 220 m [inferred link] |
| Hutatma Chowk ([n13207029320](https://www.openstreetmap.org/node/13207029320)) | B2 [n13464335937](https://www.openstreetmap.org/node/13464335937) 60 m; B3 [n14100567595](https://www.openstreetmap.org/node/14100567595) 164 m; B4 [n14100628906](https://www.openstreetmap.org/node/14100628906) 265 m |
| Kalbadevi ([n13207029323](https://www.openstreetmap.org/node/13207029323)) | A1 [n13649538896](https://www.openstreetmap.org/node/13649538896) 6 m; B1 [n13649538883](https://www.openstreetmap.org/node/13649538883) 135 m |
| Chhatrapati Shivaji Maharaj Terminus ([n13207029322](https://www.openstreetmap.org/node/13207029322)) | A2 [n14100567574](https://www.openstreetmap.org/node/14100567574) 278 m; A3 [n14100628905](https://www.openstreetmap.org/node/14100628905) 268 m; A3 [n14100628916](https://www.openstreetmap.org/node/14100628916) 254 m; B1 [n14100567593](https://www.openstreetmap.org/node/14100567593) 110 m; B1 [n14100567592](https://www.openstreetmap.org/node/14100567592) 132 m; B2 [n14100567586](https://www.openstreetmap.org/node/14100567586) 109 m |
| Girgaon ([n13207029324](https://www.openstreetmap.org/node/13207029324)) | B1 [n14101252979](https://www.openstreetmap.org/node/14101252979) 42 m |

### Inferences
- For the game, `stations[].stops` (the stop positions on the track) are where trains should halt; `x`/`z` of the station is the place for the building/name board. Underground Line 3 stations need surface entrances: 45 mapped entrance points give real positions for 14 of its 27 stations.
- The Line 1 and Navi Mumbai station outlines (`buildings[].outline` and the station way itself) are usable as footprints for elevated station boxes; most Line 2/2A/7 stations have no building outline, only platforms.

### Gaps
- No station has platform counts or station depth/height; only 11 have `ref` codes.
- Line 2B (open part), Navi Mumbai Metro and all of Line 3 south of BKC have no mapped platforms; Line 2B, Line 9 and the Monorail have no entrances.
- The 15 proposed Line 11 stations are bare nodes (`railway=proposed`, `proposed=station`, a name; no line, network or route membership); the 12 proposed Thane Ring stations have `network` and `opening_date=2029` but no route stops; Line 10 and the Kalyan–Taloja line have no stations at all.

## Line geometry, line lengths, and how much lies inside the game's map box

### Takeaway
Every operating line has two clean direction relations (no gaps, stops in order, stop positions exactly on the track), so `routes[].polylines` are ready-made centrelines per direction with stop chainages. Inside the current map box: all of Line 1 (11.2 km, 12 stations), Line 3 (33.0 km, 27 stations) and the Monorail (19.7 km, 17 stations); the southern 1.2 km of Line 2A (1 station: Andheri West), 2.9 km of Line 7 (Gundavali, Mogra), 3.3 km of Line 2B (Chembur, Diamond Garden, Shivaji Chowk, Deonar); nothing of Line 9 or Navi Mumbai Metro. Under construction/proposed inside the box: the rest of Line 2B (14 stations, ESIC Nagar–EEH), Line 4's southern part (9 stations), 8 Line 6 stations, Line 7A (Airport Colony), and the whole of proposed Line 11 (17.1 km, 15 stations).

### Cited Findings
- Direction lengths, first-to-last-stop lengths and in-box lengths per route relation (polyline point counts after 5 m Douglas–Peucker simplification; chainage = metres along the polyline from its first point) — [osm-metro.json `routes`](../../osm-metro.json):

| relation | direction | km | first→last stop km | in box km | polyline points (5 m) | first stop at chainage (m) | last stop at chainage (m) |
|---|---|---|---|---|---|---|---|
| 3808111 | Line 1 (Versova → Ghatkopar) | 11.244 | 10.901 | 11.244 | 44 | 335 | 11236 |
| 6567848 | Mumbai Monorail Line 1: Chembur => Sant Gadge Maharaj Chowk (Jacob Circle) | 19.659 | 19.437 | 19.659 | 121 | 57 | 19494 |
| 7684032 | Line 1 (Ghatkopar → Versova) | 11.233 | 10.895 | 11.233 | 44 | 11 | 10906 |
| 7684084 | Mumbai Monorail Line 1: Sant Gadge Maharaj Chowk (Jacob Circle) => Chembur | 19.649 | 19.438 | 19.649 | 126 | 122 | 19560 |
| 7898597 | Line 3 (Aarey JVLR → Cuffe Parade) | 32.991 | 32.613 | 32.991 | 144 | 0 | 32613 |
| 7898711 | Pink Line | 15.285 | 13.218 | 9.386 | 103 | 0 | 13218 |
| 7898712 | Dahisar to Mandale Metro Line 2 | 82.603 | – | 46.145 | 368 | 39521 | 36405 |
| 7898732 | Green Line (u/c) | 77.711 | – | 21.601 | 322 | 363 | 33885 |
| 7898769 | Red Line | 18.09 | 18.022 | 5.163 | 63 | 0 | 18022 |
| 12608512 | Orange Line | 25.072 | – | 0 | 67 | – | – |
| 12608513 | Thane Ring Metro | 27.68 | – | 0 | 187 | – | – |
| 13989912 | Line 2 (Andheri West → Dahisar (East)) | 17.763 | 17.708 | 1.214 | 81 | 0 | 17708 |
| 13989913 | Line 2 (Dahisar (East) → Andheri West) | 17.744 | 17.69 | 1.215 | 82 | 0 | 17690 |
| 13989914 | Line 7 (Gundavali → Dahisar (East)) | 15.677 | 15.613 | 2.876 | 55 | 0 | 15613 |
| 13989915 | Line 7 (Dahisar (East) → Gundavali) | 15.68 | 15.617 | 2.875 | 55 | 0 | 15617 |
| 16533435 | Line 1 (Pendhar → CBD Belapur) | 10.531 | 10.512 | 0 | 51 | 0 | 10512 |
| 16533436 | Line 1 (CBD Belapur → Pendhar) | 10.534 | 10.516 | 0 | 51 | 0 | 10516 |
| 17876723 | Line 3 (Cuffe Parade → Aarey JVLR) | 32.993 | 32.617 | 32.993 | 144 | 298 | 32915 |
| 19233909 | Mumbai Metro Line 11 | 17.118 | – | 17.118 | 81 | – | – |
| 20403808 | Line 2B (Mandale → Chembur) | 5.539 | 5.516 | 3.269 | 24 | 0 | 5516 |
| 20403809 | Line 2B (Chembur → Mandale) | 5.541 | 5.378 | 3.269 | 24 | 165 | 5543 |
| 20403864 | Line 9 (Kashigaon → Dahisar (East)) | 3.577 | 3.569 | 0 | 14 | 0 | 3569 |
| 20403865 | Line 9 (Dahisar (East) → Kashigaon) | 3.565 | 3.557 | 0 | 14 | 0 | 3557 |

- Stations inside and outside the box, per line (route order) — [osm-metro.json `lines[].stationsInBox`, `stations[].inBox`](../../osm-metro.json):

| line | inside the box (in route order) | outside the box |
|---|---|---|
| Line 1 (Versova ↔ Ghatkopar) (mumbai-metro-1) | 12: Versova, D. N. Nagar, Azad Nagar, Andheri L1, Western Express Highway, Chakala - J.B. Nagar, Airport Road, Marol Naka, Saki Naka, Asalpha, Jagruti Nagar, Ghatkopar L1 | 0: – |
| Mumbai Monorail Line 1 (mumbai-monorail-1) | 17: Sant Gadge Maharaj Chowk, Lower Parel, Mint Colony, Ambedkar Nagar, Naigaon, Dadar East, Wadala Bridge, Acharya Atre Nagar, Antop Hill, Guru Tegh Bahadur Nagar, Wadala Depot, Bhakti Park, Mysore Colony, Bharat Petroleum, Fertilizer Township, VNP & RC Marg Junction, Chembur | 0: – |
| Line 2 (Andheri West ↔ Dahisar (East)) (mumbai-metro-2) | 1: Andheri (West) | 16: Dahisar (East) [Line 2], Anand Nagar, Kandarpada, Mandapeshwar - I.C. Colony, Eksar, Borivali (West), Shimpoli, Kandivali (West), Dahanukarwadi, Valnai-Meeth Chowky, Malad (West), Lower Malad, Bangur Nagar, Goregaon (West), Oshiwara, Lower Oshiwara |
| Line 7 (Gundavali ↔ Dahisar (East)) (mumbai-metro-7) | 2: Mogra, Gundavali | 12: Dahisar (East) [Line 7], Ovaripada, Rashtriya Udyan, Devipada, Magathane, Poisar, Akurli, Kurar, Dindoshi, Aarey, Goregaon (East), Jogeshwari (East) |
| Line 1 (CBD Belapur ⇔ Pendhar) (navi-mumbai-metro-n1) | 0: – | 11: CBD Belapur, RBI Colony, Belpada, Utsav Chowk, Kendriya Vihar, Khargar Village, Central Park, Pethpada, Sector-34, Panchanand, Pendhar |
| Line 3 (Aarey Colony ↔ Cuffe Parade) (mumbai-metro-3) | 27: Aarey JVLR, SEEPZ, MIDC - Andheri, Marol Naka, Chhatrapati Shivaji Maharaj International Airport - T2, Sahar Road, Chhatrapati Shivaji Maharaj International Airport - T1, Santacruz, Bandra Colony, Bandra Kurla Complex, Dharavi, Shitala Devi Mandir, Dadar, Siddhivinayak Temple, Worli, Acharya Atre Chowk, Science Centre, Mahalaxmi, Jagannath Shankar Sheth Metro, Grant Road, Girgaon, Kalbadevi, Chhatrapati Shivaji Maharaj Terminus, Hutatma Chowk, Churchgate, Vidhan Bhavan, Cuffe Parade | 0: – |
| Line 2B (Chembur ↔ Mandale) (mumbai-metro-2b) | 4: Chembur, Diamond Garden, Shivaji Chowk (Chembur), Deonar | 2: Mankhurd, Mandale |
| Line 9 (Dahisar (East) ↔ Kashigaon) (mumbai-metro-9) | 0: – | 4: Dahisar (East) [Line 9], Pandurang Wadi, Miragaon, Kashigaon |
| Pink Line (mumbai-metro-6-relation-7898711) | 8: Momin Nagar Station, Majas Depot Station, Mahakali Caves Station, SEEPZ Station, Saki Vihar Road Station, Powai Udyan Station, Powai Lake Station, IIT Powai Station | 5: Swami Samarth Nagar Station, Lokhandwala Station, Adarsh Nagar Station, JVLR Station, Kanjurmarg Station |
| Dahisar to Mandale Metro Line 2 (mumbai-metro-2-relation-7898712) | 15: MMRDA, IL&FS, MTNL, National College, Nanavati Hospital, ESIC Nagar, Saraswat Nagar, Khira Nagar, Chembur, Diamond Garden, Indira Nagar, Kurla, EEH, SG Barve Marg, Kurla Terminal | 13: Goregaon (West), Mankhurd, Oshiwara, Borivali (West), Mandapeshwar - I.C. Colony, Kandarpada, Anand Nagar, Malad (West), Dahanukarwadi, Kandivali (West), Lower Malad, Shimpoli, Eksar |
| Green Line (u/c) (mumbai-metro-4-relation-7898732) | 9: Shreyas Cinema Station, Lakshmi Nagar Station, Pant Nagar Station, Garodia Nagar Station, Amar Mahal Junction Station, EEH, Suman Nagar Station, Anik Nagar Bus Depot Station, Wadala TT Station | 24: Gaimukh Station, Gowniwada Station, Kasarvadavli Station, Vijay Garden Station, Dongripada Station, Tikujiniwadi Station, Manpada, Kapurbawdi Station, Majiwada Station, Cadbury Junction Station, Mahapalika Bhavan Marg Station, RTO Thane Station, Teen Hath Naka, Mulund Check Naka Metro, Mulund Fire Station Metro, Sonapur Station, Shangrila Station, Bhandup Station (W), Bhandup Mahapalika Station, Naval Housing Station, Kanjurmarg Station, Surya Nagar Station, Vikhroli Station, Godrej Colony Station |
| Red Line (mumbai-metro-7-relation-7898769) | 3: Mogra, Gundavali, Airport Colony Station | 16: Shaheed Bhagat Singh Garden Station, Meditya Nagar Station, Sai Baba Nagar Station, Miragaon, Dahisar (East) [Line 7], Ovaripada, Rashtriya Udyan, Devipada, Magathane, Poisar, Akurli, Kurar, Dindoshi, Aarey, Goregaon (East), Jogeshwari (East) |

- Under-construction and proposed stations near track groups that have no usable route relation (inferred: within 150 m of the group's track) — [osm-metro.json `stations[].nearTracks`](../../osm-metro.json):

| track group | stations within 150 m (inferred), inside box | outside box |
|---|---|---|
| Line 11 | Anik Nagar Bus Depot Station, CSMT Metro, Nagpada Junction, Reay Road, BPT Hospital, Crawford Market, Sewri, Coal Bunder, Ganesh Nagar, CGS Colony, Wadala Depot, Byculla, Bhendi Bazaar, Horniman Circle, SMP Circle, Hay Bunder | – |
| Line 6 | Mahakali Caves Station, SEEPZ Station, Saki Vihar Road Station, Powai Lake Station, Momin Nagar Station, Majas Depot Station, Powai Udyan Station, IIT Powai Station | Swami Samarth Nagar Station, Lokhandwala Station, Adarsh Nagar Station, Vikhroli Station, Kanjurmarg Station, JVLR Station |
| Line 4 | Anik Nagar Bus Depot Station, EEH, Shreyas Cinema Station, Suman Nagar Station, Pant Nagar Station, Garodia Nagar Station, Amar Mahal Junction Station, Wadala TT Station, Lakshmi Nagar Station | Kapurbawdi Station, Dongripada, Mulund Fire Station Metro, Teen Hath Naka, Manpada, Mulund Check Naka Metro, Kasarvadavli Station, Vijay Garden Station, Tikujiniwadi Station, Majiwada Station, Bhandup Mahapalika Station, Naval Housing Station, Kanjurmarg Station, Surya Nagar Station, Vikhroli Station, Godrej Colony Station, Bhandup Station (W), Dongripada Station, Mahapalika Bhavan Marg Station, Cadbury Junction Station, Shangrila Station, Sonapur Station, RTO Thane Station |
| Line 4A | – | Gaimukh Station, Gowniwada Station |
| Line 7A | Airport Colony Station | – |
| Dahisar (W) to Mandale Metro (Line-2) | Saraswat Nagar, Khira Nagar, National College, Nanavati Hospital, Prem Nagar, EEH, Kurla, Kurla Terminal, SG Barve Marg, MTNL, IL&FS, MMRDA, Indira Nagar, ESIC Nagar | – |
| Line 9 | – | Subhash Chandra Bose Ground, Shahid Bhagat Singh Garden, Meditya Nagar Station, Sai Baba Nagar Station, Shaheed Bhagat Singh Garden Station |
| Line 10 | – | – |
| Thane Ring Metro | – | Lokmanya Nagar Bus Depot, Manpada, Wagle Circle, Shivai Nagar, Neelkanth Terminal, Ghandi Nagar, Dr. Kashinath Ghanekar Natyagruha, Dongripada, Vijay Nagari, Waghbil, Waterfront, Patlipada, Dongripada Station |
| Line-5: Thane - Bhiwandi - Kalyan | – | Kapurbawdi Station, Balkum |
| Mumbai Metro Line 5 | – | Kapurbawdi Station, Balkum |
| Navi Mumbai Metro Line 1 - Stage 2 | – | Khandeshwar |
| Orange Line Mumbai Metro (Kalyan-Taloja) | – | – |

- Lower Oshiwara (Line 2A, lat 19.140698) and Jogeshwari (East) (Line 7, 19.142946) lie just north of the box edge (19.140) — [n10576726751](https://www.openstreetmap.org/node/10576726751), [n10576622721](https://www.openstreetmap.org/node/10576622721).
- Each direction of Lines 1, 2/2A, 2B, 3, 7, 9, Navi Mumbai 1 and the Monorail chains into one piece with 0 gaps; the track runs past the terminal stop by up to 335 m (Line 1 at Versova: first stop at chainage 335 m) — [osm-metro.json `routes[].gaps`, `stops[].chainage`](../../osm-metro.json).
- Track groups inside the box (both tracks summed, km): Line 1 27.2 (+3.1 of unnamed yard connected to it near D. N. Nagar), Line 3 64.7 main + 19.8 of unnamed yard connected to it near Aarey JVLR, Monorail 39.3 (+3.3 of unconnected unnamed monorail yard next to Wadala Depot station), "Dahisar (W) to Mandale Metro (Line-2)" 46.1, Line 4 21.6, Line 6 18.7, Line 7 6.7, Line 7A 3.6, Line 11 17.1 — table T3.

### Inferences
- Lengths compared with figures commonly published for these lines (background knowledge, not in the extract — verify before use): Line 1 about 11.4 km, Line 3 about 33.5 km, Line 2A about 18.6 km, Line 7 about 16.5 km, Monorail about 19.5 km, Navi Mumbai Line 1 about 11 km. The OSM direction lengths (11.24, 32.99, 17.75, 15.68, 19.65, 10.53 km) are within a few per cent, i.e. the mapped geometry is complete for these lines.
- The game can run Line 1, Line 3 and the Monorail entirely inside today's map; Lines 2A, 7 and 2B leave the box after 1–4 stations, so they need either the map to grow north/east or a fade-out at the edge.

### Gaps
- Directions are inferred for the umbrella relations: the member ways of "Pink Line" and "Green Line (u/c)" run against their stop order, so the script turned their main piece round (`reversedToStopOrder`); "Dahisar to Mandale Metro Line 2" and "Green Line (u/c)" split into 4 and 3 pieces, so their `firstToLastStopKm` is not given.
- Track heights are only `layer` values (1–5, −1…−3), not metres; viaduct and tunnel depths must come from elsewhere.

## Gaps and errors in the OpenStreetMap data (missing stations, partly mapped lines, names that differ)

### Takeaway
The operating lines are mapped completely and consistently; the problems are in naming (stop areas and stop positions on Lines 2A/7 and Navi Mumbai still carry older station names), stale or contradictory lifecycle tags (Monorail closed vs. tracks open; "construction" ways tagged railway=subway; an under-construction "CSIA T1" node next to the open T1 station; opening dates already past), umbrella relations that mix lines and contain stray members (a college, a hospital, a nursing home), and lines that exist only as ways or bare nodes.

### Cited Findings
- Name differences between a station's own objects (station node or way, stop area, stop positions) — [osm-metro.json `issues` kind "station name"](../../osm-metro.json):
  - Line 7: "Aarey" vs stop area "Aarey Road Junction" (building "Aarey Metro Station") [n9629564097](https://www.openstreetmap.org/node/9629564097); "Kurar" vs "Kurar Village" [n9629564099](https://www.openstreetmap.org/node/9629564099); "Akurli" vs "Bandongri" [n9629564100](https://www.openstreetmap.org/node/9629564100); "Poisar" vs stop area and stop positions "Mahindra & Mahindra" [n9629564101](https://www.openstreetmap.org/node/9629564101).
  - Line 2/2A: "Borivali (West)" vs "Don Bosco (Borivali West)" [n5219622344](https://www.openstreetmap.org/node/5219622344); "Mandapeshwar - I.C. Colony" vs "I.C. Colony" [n5219622345](https://www.openstreetmap.org/node/5219622345); "Kandarpada" vs stop area and stop positions "Rushi Sankul" [n5219622346](https://www.openstreetmap.org/node/5219622346); "Valnai-Meeth Chowky" vs "Valnai" [n10576726763](https://www.openstreetmap.org/node/10576726763).
  - Line 1: the station objects are named "Andheri L1" [n6020955334](https://www.openstreetmap.org/node/6020955334) and "Ghatkopar L1" [w151205149](https://www.openstreetmap.org/way/151205149) (stop areas "Andheri Metro Station" and "Ghatkopar"); the Western Express Highway stop positions are "Western Express Highway (eastbound)/(westbound)"; Marol Naka stops carry "(Line 1)"/"(Line 3)" — [r3808111](https://www.openstreetmap.org/relation/3808111).
  - Line 3: "Science Centre" (station) vs "Science Museum" (stop area, stop positions) [n13192130536](https://www.openstreetmap.org/node/13192130536); "Aarey JVLR" vs "Aarey Colony" [w1330720641](https://www.openstreetmap.org/way/1330720641); "MIDC - Andheri" vs "MIDC"; the airport stations' station nodes say "Chhatrapati Shivaji Maharaj International Airport - T1/T2" while stops say "CSMIA Domestic" / "CSMIA International T2".
  - Navi Mumbai Metro: station objects "RBI Colony", "Belpada", "Kendriya Vihar", "Khargar Village" (sic) vs stop areas "Sector 7", "CIDCO Science Park", "Sector 11", "Sector 14" [n11335491948](https://www.openstreetmap.org/node/11335491948), [w605163723](https://www.openstreetmap.org/way/605163723), [w605163717](https://www.openstreetmap.org/way/605163717), [w605163718](https://www.openstreetmap.org/way/605163718).
- Lifecycle contradictions: Monorail relations `disused=yes` but track `railway=monorail` and stations without lifecycle prefix [r7684086](https://www.openstreetmap.org/relation/7684086); 35 ways (Line 4A 17, 3.6 km; Line 7A 10, 3.0 km; Line 9 8, 1.0 km) are `railway=subway` and at the same time `construction=yes` + `construction:railway=subway` (T7); "CSIA T1" [n5221295390](https://www.openstreetmap.org/node/5221295390) is still `railway=construction` 51 m from the open T1 station; under-construction tags with `opening_date=2026-04` (Line 4A, Gowniwada) are earlier than the extract date.
- Duplicates and odd objects: a second Dadar Line 3 station node "SBI-Dadar Metro" [n14144295508](https://www.openstreetmap.org/node/14144295508) (the sponsor name of Dadar) 137 m from the Dadar station node; on the Line 9 extension a station node "Shahid Bhagat Singh Garden" [n10299481539](https://www.openstreetmap.org/node/10299481539) stands 466 m from the stop positions "Shaheed Bhagat Singh Garden Station" [n9130240857](https://www.openstreetmap.org/node/9130240857) (two spellings, two places); "Jogeshwari Metro Station (Harbour) - West" [w1170388401](https://www.openstreetmap.org/way/1170388401), a `building=train_station` with no line; "Azad Nagar Bus Stop" [n8462838145](https://www.openstreetmap.org/node/8462838145) is a Thane Ring Metro station tagged as an operating `railway=station`.
- Umbrella relations: "Red Line" [r7898769](https://www.openstreetmap.org/relation/7898769) runs on Line 7/7A track but lists four Line 9 stops 2.6–5.0 km off its track and has a college building (role "platform") and an apartment/hospital way (role "east") as members; "Mumbai Metro Line 11" [r19233909](https://www.openstreetmap.org/relation/19233909) has a nursing home as "platform" and no stops; "Dahisar to Mandale Metro Line 2" [r7898712](https://www.openstreetmap.org/relation/7898712) has 5 gaps and 6 untagged stop members; "Green Line (u/c)" [r7898732](https://www.openstreetmap.org/relation/7898732) includes proposed Line 10 track and 3 gaps.
- Partly mapped lines: the Line 4/4A umbrella relation lists 33 stops but only 9 of them have a station node or way (the rest are stop positions only); Line 6 has stop positions only; Line 10 and the Kalyan–Taloja line have no stations; the Orange Line (Line 5) relation [r12608512](https://www.openstreetmap.org/relation/12608512) has no stops and its track is split between two names ("Line-5: Thane - Bhiwandi - Kalyan" and "Mumbai Metro Line 5"); Navi Mumbai "Line 1 - Stage 2" (2 × 11.3 km under construction from Pendhar southwards to near Khandeshwar) has only one station node ("Khandeshwar", tagged construction and disused).
- Mode tagging: two Harbour-line suburban stations are `station=light_rail` (Mansarovar, Khandeshwar) — [n1435294693](https://www.openstreetmap.org/node/1435294693), [n1645802025](https://www.openstreetmap.org/node/1645802025).

#### T7 All data issues found by the script

- relation member — [r7898712](https://www.openstreetmap.org/relation/7898712): stop member [n11921363022](https://www.openstreetmap.org/node/11921363022) has no tags (no name, not a stop or station)
- relation member — [r7898712](https://www.openstreetmap.org/relation/7898712): stop member [n5219622356](https://www.openstreetmap.org/node/5219622356) has no tags (no name, not a stop or station)
- relation member — [r7898712](https://www.openstreetmap.org/relation/7898712): stop member [n5219622348](https://www.openstreetmap.org/node/5219622348) has no tags (no name, not a stop or station)
- relation member — [r7898712](https://www.openstreetmap.org/relation/7898712): stop member [n5219622341](https://www.openstreetmap.org/node/5219622341) has no tags (no name, not a stop or station)
- relation member — [r7898712](https://www.openstreetmap.org/relation/7898712): stop member [n5219622336](https://www.openstreetmap.org/node/5219622336) has no tags (no name, not a stop or station)
- relation member — [r7898712](https://www.openstreetmap.org/relation/7898712): stop member [n5219622337](https://www.openstreetmap.org/node/5219622337) has no tags (no name, not a stop or station)
- route gaps — [r7898712](https://www.openstreetmap.org/relation/7898712): 5 gap(s) between consecutive member ways (4 piece(s) after merging)
- route gaps — [r7898732](https://www.openstreetmap.org/relation/7898732): 3 gap(s) between consecutive member ways (3 piece(s) after merging)
- relation member — [r7898769](https://www.openstreetmap.org/relation/7898769): [w1113692659](https://www.openstreetmap.org/way/1113692659) (role "platform") is not a metro track or platform: {"name":"Asmita College of Arts and Commerce","building":"college"}
- relation member — [r7898769](https://www.openstreetmap.org/relation/7898769): [w358844406](https://www.openstreetmap.org/way/358844406) (role "east") is not a metro track or platform: {"name":"health care","building":"apartments","healthcare":"hospital"}
- stop off track — [r7898769](https://www.openstreetmap.org/relation/7898769): stop [n9130240857](https://www.openstreetmap.org/node/9130240857) "Shaheed Bhagat Singh Garden Station" is 5022 m from the route's track
- stop off track — [r7898769](https://www.openstreetmap.org/relation/7898769): stop [n5226162351](https://www.openstreetmap.org/node/5226162351) "Meditya Nagar Station" is 4722 m from the route's track
- stop off track — [r7898769](https://www.openstreetmap.org/relation/7898769): stop [n9130240849](https://www.openstreetmap.org/node/9130240849) "Sai Baba Nagar Station" is 3662 m from the route's track
- stop off track — [r7898769](https://www.openstreetmap.org/relation/7898769): stop [n5226162367](https://www.openstreetmap.org/node/5226162367) "Miragaon" is 2569 m from the route's track
- relation member — [r7898769](https://www.openstreetmap.org/relation/7898769): stop member [n5221297138](https://www.openstreetmap.org/node/5221297138) has no tags (no name, not a stop or station)
- relation member — [r19233909](https://www.openstreetmap.org/relation/19233909): [w1311520615](https://www.openstreetmap.org/way/1311520615) (role "platform") is not a metro track or platform: {"name":"Dawood Multispeciality Nursing Home","building":"hospital","healthcare":"hospital"}
- lifecycle tags — track group "(unnamed) connected to "Line 4A"": 2 way(s), 1.848 km, are railway=subway (= open) but also construction=yes / construction:railway=subway: [w1485342209](https://www.openstreetmap.org/way/1485342209), [w1485349486](https://www.openstreetmap.org/way/1485349486)
- lifecycle tags — track group "Line 4A": 15 way(s), 1.727 km, are railway=subway (= open) but also construction=yes / construction:railway=subway: [w1485342203](https://www.openstreetmap.org/way/1485342203), [w1485342204](https://www.openstreetmap.org/way/1485342204), [w1485342205](https://www.openstreetmap.org/way/1485342205), [w1485342206](https://www.openstreetmap.org/way/1485342206), [w1485342207](https://www.openstreetmap.org/way/1485342207), [w1485342208](https://www.openstreetmap.org/way/1485342208), [w1485342210](https://www.openstreetmap.org/way/1485342210), [w1485342211](https://www.openstreetmap.org/way/1485342211), [w1485342212](https://www.openstreetmap.org/way/1485342212), [w1485342213](https://www.openstreetmap.org/way/1485342213), [w1485342214](https://www.openstreetmap.org/way/1485342214), [w1485349481](https://www.openstreetmap.org/way/1485349481), [w1485349482](https://www.openstreetmap.org/way/1485349482), [w1485349484](https://www.openstreetmap.org/way/1485349484), [w1485349485](https://www.openstreetmap.org/way/1485349485)
- lifecycle tags — track group "Line 7A": 10 way(s), 2.966 km, are railway=subway (= open) but also construction=yes / construction:railway=subway: [w1134499128](https://www.openstreetmap.org/way/1134499128), [w1485677767](https://www.openstreetmap.org/way/1485677767), [w1485677769](https://www.openstreetmap.org/way/1485677769), [w1485677770](https://www.openstreetmap.org/way/1485677770), [w1485677771](https://www.openstreetmap.org/way/1485677771), [w1485677772](https://www.openstreetmap.org/way/1485677772), [w1485677775](https://www.openstreetmap.org/way/1485677775), [w1485677776](https://www.openstreetmap.org/way/1485677776), [w1485677777](https://www.openstreetmap.org/way/1485677777), [w1485677778](https://www.openstreetmap.org/way/1485677778)
- lifecycle tags — track group "Line 9": 8 way(s), 0.97 km, are railway=subway (= open) but also construction=yes / construction:railway=subway: [w1485689577](https://www.openstreetmap.org/way/1485689577), [w1485689578](https://www.openstreetmap.org/way/1485689578), [w1485689579](https://www.openstreetmap.org/way/1485689579), [w1485689580](https://www.openstreetmap.org/way/1485689580), [w1485689584](https://www.openstreetmap.org/way/1485689584), [w1485689587](https://www.openstreetmap.org/way/1485689587), [w1485689590](https://www.openstreetmap.org/way/1485689590), [w1485700153](https://www.openstreetmap.org/way/1485700153)
- station name — [n9629564097](https://www.openstreetmap.org/node/9629564097): different names on the station's objects: "Aarey", "Aarey Road Junction", "Aarey Metro Station"
- station name — [n9629564099](https://www.openstreetmap.org/node/9629564099): different names on the station's objects: "Kurar", "Kurar Village"
- station name — [n9629564100](https://www.openstreetmap.org/node/9629564100): different names on the station's objects: "Akurli", "Bandongri"
- station name — [n9629564101](https://www.openstreetmap.org/node/9629564101): different names on the station's objects: "Poisar", "Mahindra & Mahindra"
- station name — [n5219622344](https://www.openstreetmap.org/node/5219622344): different names on the station's objects: "Borivali (West)", "Don Bosco (Borivali West)"
- station name — [n5219622345](https://www.openstreetmap.org/node/5219622345): different names on the station's objects: "Mandapeshwar - I.C. Colony", "I.C. Colony"
- station name — [n5219622346](https://www.openstreetmap.org/node/5219622346): different names on the station's objects: "Kandarpada", "Rushi Sankul"
- station name — [n10576726763](https://www.openstreetmap.org/node/10576726763): different names on the station's objects: "Valnai-Meeth Chowky", "Valnai"
- station name — [n11335491948](https://www.openstreetmap.org/node/11335491948): different names on the station's objects: "RBI Colony", "Sector 7", "RBI Colony Station"
- station name — [w605163723](https://www.openstreetmap.org/way/605163723): different names on the station's objects: "Belpada", "CIDCO Science Park"
- station name — [w605163717](https://www.openstreetmap.org/way/605163717): different names on the station's objects: "Kendriya Vihar", "Sector 11"
- station name — [w605163718](https://www.openstreetmap.org/way/605163718): different names on the station's objects: "Khargar Village", "Sector 14", "Kharghar Village"
- station name — [w1330720641](https://www.openstreetmap.org/way/1330720641): different names on the station's objects: "Aarey JVLR", "Aarey Colony"
- station name — [n5787704196](https://www.openstreetmap.org/node/5787704196): different names on the station's objects: "MIDC - Andheri", "MIDC"
- station name — [n5221297132](https://www.openstreetmap.org/node/5221297132): different names on the station's objects: "Chhatrapati Shivaji Maharaj International Airport - T2", "CSMIA International T2"
- station name — [n12074909131](https://www.openstreetmap.org/node/12074909131): different names on the station's objects: "Chhatrapati Shivaji Maharaj International Airport - T1", "CSMIA Domestic"
- station name — [n13192130536](https://www.openstreetmap.org/node/13192130536): different names on the station's objects: "Science Centre", "Science Museum"
- station not in a route — [n8462838145](https://www.openstreetmap.org/node/8462838145): "Azad Nagar Bus Stop" (operational) is not a stop of any route relation
- station name — [n9132436368](https://www.openstreetmap.org/node/9132436368): different names on the station's objects: "Anik Nagar Bus Depot Station", "Anik Bus Depot"
- station not in a route — [n14144295508](https://www.openstreetmap.org/node/14144295508): "SBI-Dadar Metro" (operational) is not a stop of any route relation
- station name — [n5219622408](https://www.openstreetmap.org/node/5219622408): different names on the station's objects: "EEH", "Siddhartha Colony EEH Station"
- stale lifecycle — [n5221295390](https://www.openstreetmap.org/node/5221295390): "CSIA T1" is tagged construction but the operational station "Chhatrapati Shivaji Maharaj International Airport - T1" ([n12074909131](https://www.openstreetmap.org/node/12074909131), 51 m) stands next to it: a leftover from before the opening?
- station not in a route — [w1170388401](https://www.openstreetmap.org/way/1170388401): "Jogeshwari Metro Station (Harbour) - West" (operational) is not a stop of any route relation
- mode tags — [n1435294693](https://www.openstreetmap.org/node/1435294693): "Mansarovar" is station=light_rail but its network is "Mumbai Suburban Railway Network" (a suburban station; left out)
- mode tags — [n1645802025](https://www.openstreetmap.org/node/1645802025): "Khandeshwar" is station=light_rail but its network is "Mumbai Suburban Railway Network" (a suburban station; left out)
- mode tags — [r11511700](https://www.openstreetmap.org/relation/11511700): suburban stop area "Mansarovar" holds a station=light_rail station

### Inferences
- Names the operator uses, where OSM's own objects disagree (background knowledge, not in the extract — verify before showing in the game): Line 7 "Akurli" (formerly Bandongri), "Poisar" (formerly Mahindra & Mahindra), "Kurar", "Aarey"; Line 2A "Kandarpada" (formerly Rushi Sankul), "Mandapeshwar", "Borivali (W)", and, as far as I know, "Pahadi Goregaon" for Bangur Nagar (OSM has it as `alt_name`), "Pahadi Eksar" for Shimpoli and "Upper Dahisar" for Anand Nagar (not in the data); Navi Mumbai "Sector 7 Belapur", "Science Park", "Sector 11 Kharghar", "Sector 14 Kharghar" (OSM stop areas use these); Line 3 "Science Centre".
- For the game's naming rules (CLAUDE.md: no real brands): never show `official_name` values — they are sponsor brands (HDFC Ergo, Fevicol, Vivo, IndusInd, Oberoi, Zurich Kotak, AU Bank, ICICI Prudential, kotak, SBI, LIC). The local-train code already renames CSMT to "Chhatrapati Shivaji Maharaj Terminus" (`stationName()` in `scripts/lib/trains.mjs`); the Line 3 "Chhatrapati Shivaji Maharaj Terminus" station would need the same rule for consistency.
- The "construction" Line 4A/7A/9 ways tagged `railway=subway` and the past opening dates suggest mappers had started to switch these sections to "open"; the game should treat them as unfinished unless the owner decides otherwise.

### Gaps
- Official station lists and lengths were not checked against MMRDA/MMRC/CIDCO sources in this task (local data only); the background-knowledge names above are unverified.
- Whether the Monorail was running on 2026-11-13 cannot be told from the extract beyond the relation note; the Line 9 extension, Line 2B remainder, Line 4/4A and Line 7A statuses are as tagged, not as on the ground.
- The extract cannot show deletions: untagged stop members (6 in the Line 2 umbrella, 1 in Red Line) are probably leftovers of deleted or retagged station nodes, but that is an inference.
