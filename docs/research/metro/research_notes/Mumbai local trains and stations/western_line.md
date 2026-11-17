# Mumbai Suburban Railway: Western line (Churchgate–Virar–Dahanu Road), state as of November 2026

How this was researched (read this first):
- Only GitHub could be reached from this session. Wikipedia, Western Railway, news sites and timetable sites were all blocked for fetching, and the shared web-search budget ran out after about ten searches. Facts marked **(search extract)** come only from search-result summaries. Nobody opened the page behind them.
- Two primary datasets were analysed locally instead. Every number derived from them can be reproduced.
  1. **The real Western Railway (WR) suburban timetable as published on trainhelp.in**, scraped into CSV files and committed to GitHub on 2024-01-30 ([Umang-Lodaya/Mumbai-Local-TimeTable-Extractor, data/Table - 24…50.csv](https://github.com/Umang-Lodaya/Mumbai-Local-TimeTable-Extractor/tree/ba5005759da90af0fbd8b8988f9863b1629fef11/data)). It has all 37 Western stations, train numbers, 12/15-car labels, AC labels and day notes. Its 199 trains in the 92xxx series match the 199 15-car services Western Railway announced from 15 Aug 2023, so it is very likely the timetable in force from late 2023 into early 2024. I parsed 1,253 of its trains, against the ~1,394 the timetable had at the time, so about 90 %. The parse is my own work, so treat the counts as ±10 %. The numbers are labelled "TT 2023-24" below.
  2. **The project's own OpenStreetMap extract** (`data/raw/mumbai-region.osm.pbf`, extract.bbbike.org, 2026-11-13). It gives station codes (`ref`), coordinates, the Western line route relations ([slow, Churchgate→Virar r11511060](https://www.openstreetmap.org/relation/11511060), [slow, Virar→Churchgate r11511059](https://www.openstreetmap.org/relation/11511059), [fast, Churchgate→Virar r11094509](https://www.openstreetmap.org/relation/11094509), [fast, Virar→Churchgate r11094508](https://www.openstreetmap.org/relation/11094508)), platforms and tracks. The extract ends at 19.5° N, so it covers nothing north of Virar. These numbers are labelled "OSM" below.
- Scratch scripts used, which are not part of the game: `/tmp/claude-0/-home-user-gtb/031a8613-98e7-5c09-ac25-29227fe81d45/scratchpad/scripts/` (`parse_wr.py`, `an1–an5.py`, `wr_chain.mjs`, `wr_plat.mjs`).

## Every station from Churchgate to Dahanu Road: codes, distances, platforms, halts, interchanges

### Takeaway
The line has 37 stations: 29 from Churchgate to Virar (about 60.2 km of track) and 8 more to Dahanu Road. Every Churchgate–Virar code below comes from OpenStreetMap, and the kilometre figures are measured along the mapped slow track. Fast trains always halt at Churchgate, Mumbai Central, Dadar, Bandra, Andheri and Borivali. Most of them also halt at Marine Lines, Charni Road and Grant Road. North of Borivali most fast trains stop at every station. Mahalaxmi, Lower Parel, Prabhadevi, Matunga Road, Mahim, Khar Road, Santacruz, Vile Parle and Ram Mandir are served only by slow trains.

### Cited Findings

**Station table, Churchgate → Virar.**
- Sources for the columns:
  - Code: the OSM `ref` tag.
  - km: OSM chainage along the slow down track from the Churchgate stop.
  - Slow run time: median minutes from the previous station, down (northbound) / up (southbound), from the TT 2023-24 timetable.
  - Who stops: stop patterns derived from the same timetable.
- Platform refs and lengths are as mapped in OSM. Lengths are the longest vertex-to-vertex distance of the platform outline. Some outlines include mainline or Central Railway platforms within 400 m.
- "Tracks" is the number of mapped running lines that cross a 180 m line drawn across the station (OSM). It is noisy.

| # | Station (timetable spelling) | Code | km | Slow min from previous (down/up) | Who stops (TT 2023-24) | OSM platform refs (longest m) | OSM tracks | Interchanges within ~1 km (OSM straight line) |
|---|---|---|---|---|---|---|---|---|
| 1 | Churchgate | CCG | 0.00 | – | all trains (terminus) | 1, 1;2, 2;3, 3;4, 4 (347) | 4 | Metro Line 3 "Churchgate" 444 m (opened 2025-10-09); Hutatma Chowk (M3) 579 m |
| 2 | Marine Lines | MEL | 1.51 | 3/4 | slow + most fast | 1, 2;3, 4 (301) | 4 | Kalbadevi (M3) 370 m |
| 3 | Charni Road | CYR | 2.46 | 2/3 | slow + most fast | 1, 2;3, 4 (280) | 4 | Girgaon (M3) 419 m |
| 4 | Grant Road | GTR | 3.74 | 3/2 | slow + most fast | 2;3, 4 (323) | 3–4 | Grant Road (M3) 233 m |
| 5 | Mumbai Central (local), timetable "M'BAI CENTRAL (L)" | MMCT | 4.61 | 2/2 | all trains | 1;2, 3;4 (351); mainline terminus platforms beside it (up to 544) | 3 south / 7 north | Mumbai Central mainline terminus; Jagannath Shankar Sheth (M3) |
| 6 | Mahalaxmi | MX | 6.02 | 3/3 | slow only | 1;2 (294) | 5 | Mahalaxmi (M3) 361 m; Sant Gadge Maharaj Chowk monorail 464 m |
| 7 | Lower Parel | PL | 7.64 | 3/3 | slow only | 1, 1;2, 2;3 (277) | 5 | Lower Parel monorail 311 m; Currey Road (Central line) 346 m |
| 8 | Prabhadevi (OSM `old_name` Elphinstone Road) | PBHD | 9.09 | 3/3 | slow only | 1;2, 2A;3 (412, may include Parel) | 9–10 (with Central line) | Parel (Central line) 290 m |
| 9 | Dadar | DDR | 10.58 | 2/2 | all trains | Western and Central together: 1, 2;3, 4, 5, 8, 9;9A, 10;11, 12, 13;14 | 5 | Dadar Central line station (code DR) 207 m; Dadar (M3) 620 m |
| 10 | Matunga Road | MRU | 11.68 | 2/4 | slow only | 1;2, 3;4 (270) | 5 | Matunga (Central line) 367 m |
| 11 | Mahim Jn. | MM | 13.11 | 3/3 | slow only (Harbour line platforms too) | 1, 2;3, "Platform 5,6" (275) | 6 | Harbour line; Shitala Devi Mandir (M3) 546 m |
| 12 | Bandra | BA | 14.79 | 4/3 | all trains (Harbour line too) | only "1" mapped (266) | 6 | Harbour line |
| 13 | Khar Road | KHAR | 16.43 | 3/4 | slow only (Harbour line too) | 1, 1A, 1;2, 2;3, 3;4, 4;5, 5;6 | 8 | Harbour line |
| 14 | Santa Cruz | STC | 17.83 | 2/3 | slow only (Harbour line too) | 1;2, 3;4, 5;6 (273) | 7 | Santacruz (M3) 615 m |
| 15 | Vile Parle | VLP | 19.89 | 3/3 | slow only (Harbour line too) | 4 unnumbered (315) | 7 | Harbour line |
| 16 | Andheri | ADH | 22.06 | 5/4 | all trains (Harbour line too) | 1, 2;3, 4-5, 6;7, 8-9 (616) | 7 | Metro Line 1 "Andheri" 272 m; Harbour line |
| 17 | Jogeshwari | JOS | 23.94 | 3/5 | slow + semi-fast | 1, 1;2, 2, 3;4 (281) | 7 | Separate "Jogeshwari (Harbour Line)" station node 563 m north |
| 18 | Ram Mandir | RMAR | 25.65 | 3/3 | slow only (semi-fasts skip it) | 2 unnumbered (261) | 7 | Harbour line; Goregaon (East) metro 696 m |
| 19 | Goregaon | GMN | 27.15 | 2/2 | slow + semi-fast; Harbour line terminus | 4;5 + 3 unnumbered (308) | 5–7 | Harbour line terminus |
| 20 | Malad | MDD | 29.59 | 4/3 | slow + semi-fast | 3 unnumbered (337) | 5 | – |
| 21 | Kandivali (timetable "Kandivli") | KILE | 31.56 | 3/3 | slow + semi-fast | 3 unnumbered (368) | 4 | – |
| 22 | Borivali | BVI | 34.27 | 6/6 | all trains (some morning up fasts flagged "Passing (will not halt at BVI)") | 2, 3, 4;5, 6;7, 8;9, 10 (624) | 5 (cross-section too short) | Metro Line 7 Rashtriya Udyan 865 m, Devipada 921 m |
| 23 | Dahisar | DIC | 36.64 | 4/5 | slow + most Virar fasts | 1, 2;3, 4 (363) | 4 | Metro Lines 2A/7/9 "Dahisar (East)" 754–850 m (Line 9 node opened 2026-04-08) |
| 24 | Mira Road | MIRA | 40.21 | 5/4 | slow + most Virar fasts | 1, 2;3, 4 (354) | 4 | – |
| 25 | Bhayandar | BYR | 43.54 | 5/5 | all Virar-bound trains | 1;2, 3;4, 5, 6 (458) | 6–7 | – |
| 26 | Naigaon | NIG | 48.21 | 6/6 | slow + most Virar fasts | 1, 2;3, 4 (324) | 4 | – |
| 27 | Vasai Road | BSR | 51.92 | 5/5 | all Virar-bound trains | 1, 2;3, 4;5, 6;7 (615) | 7 | Central Railway Vasai Road–Diva MEMU line |
| 28 | Nalla Sopara | NSP | 56.14 | 5/5 | slow + most Virar fasts | 3 unnumbered (382) | 4 | – |
| 29 | Virar | VR | 60.23 | 7/6 | terminus for most trains; Dahanu trains run on | 3 unnumbered (683) | 2–4 | – |

Sources for the whole table:
- OSM: [r11511060](https://www.openstreetmap.org/relation/11511060) (stops, chainage), station node `ref` tags and platform/track ways in the project extract.
- Timetable: [TT 2023-24 CSVs](https://github.com/Umang-Lodaya/Mumbai-Local-TimeTable-Extractor/tree/ba5005759da90af0fbd8b8988f9863b1629fef11/data).
- The up direction ([r11511059](https://www.openstreetmap.org/relation/11511059)) measures 60.17 km from Virar to Churchgate, and the fast line ([r11094509](https://www.openstreetmap.org/relation/11094509)) the same 60.23 km to Virar.

**North of Virar (Dahanu Road branch).**
- Stations in order, with their timetable spelling: Vaiterna (Vaitarna), SAPHALE, Kelve Road, PALGHAR, Umroli, BOISAR, Vangaon, DAHANU ROAD — [TT 2023-24, Table 50](https://github.com/Umang-Lodaya/Mumbai-Local-TimeTable-Extractor/tree/ba5005759da90af0fbd8b8988f9863b1629fef11/data).
- The timetable header confirms only the codes VR, CCG, BVI, DDR and DRD (trains "93001 VR DRD", "93003 CCG DRD") — [TT 2023-24, Table 50](https://github.com/Umang-Lodaya/Mumbai-Local-TimeTable-Extractor/tree/ba5005759da90af0fbd8b8988f9863b1629fef11/data).
- Slow run times, down direction, median minutes:
  - Virar–Vaitarna 10, Vaitarna–Saphale 8, Saphale–Kelve Road 6, Kelve Road–Palghar 8.
  - Palghar–Umroli 6, Umroli–Boisar 6, Boisar–Vangaon 8, Vangaon–Dahanu Road 19.
  - The 19 min likely includes terminal padding.
  - Virar→Dahanu Road takes 80 min median down (n=19) and 70 min up — [TT 2023-24](https://github.com/Umang-Lodaya/Mumbai-Local-TimeTable-Extractor/tree/ba5005759da90af0fbd8b8988f9863b1629fef11/data).
- Dahanu Road has 3 platforms **(search extract; the site was not named)**.
- Total line length: one site gives 123.78 km, another "about 120 km with 37 stations" **(search extract; MumbaiHop / allthingsMUMBAI / mumbaimetroroute station-list pages)** — [MumbaiHop](https://mumbaihop.com/mumbai-western-line-station-list/), [allthingsMUMBAI](https://allthingsmumbai.com/mumbai-western-line-station-list/).

**Codes, names and renamings.**
- OSM `ref` codes: CCG, MEL, CYR, GTR, MMCT, MX, PL, PBHD, DDR, MRU, MM, BA, KHAR, STC, VLP, ADH, JOS, RMAR, GMN, MDD, KILE, BVI, DIC, MIRA, BYR, NIG, BSR, NSP, VR — OSM station nodes in the project extract.
- Churchgate has two codes on Wikipedia: "CH" (suburban) and "CCG" (mainline); its Western line table lists "CH/CCG" **(search extract)** — [Wikipedia: Churchgate railway station](https://en.wikipedia.org/wiki/Churchgate_railway_station).
- A travel site lists "Churchgate C/CCG, Marine Lines MEL, Charni Road CYR, Grant Road GTR" **(search extract)** — [TripHippies](https://www.triphippies.com/mumbai-local-train-map/).
- Prabhadevi: OSM tags `old_name=Elphinstone Road`, `official_name=Prabhadevi`. The 2023-24 timetable already prints "Prabhadevi" — OSM node; [TT 2023-24](https://github.com/Umang-Lodaya/Mumbai-Local-TimeTable-Extractor/tree/ba5005759da90af0fbd8b8988f9863b1629fef11/data).
- Mumbai Central:
  - The mainline terminus node carries `ref=MMCT`, `old_name=Bellasis Road`, `station=terminal`, `start_date=1930-12-18`.
  - The suburban stop is mapped as "Mumbai Central (local)".
  - The timetable prints "M'BAI CENTRAL (L)", where (L) means the local station.
  - Sources: OSM nodes; [TT 2023-24](https://github.com/Umang-Lodaya/Mumbai-Local-TimeTable-Extractor/tree/ba5005759da90af0fbd8b8988f9863b1629fef11/data).
- Timetable spellings that differ from OSM: "Mahalakshmi" (OSM "Mahalaxmi"), "Santa Cruz" (OSM "Santa Cruz", signs often "Santacruz"), "Kandivli" (OSM "Kandivali"), "Nalla Sopara"/"Nallasopara", "Mahim Jn." — [TT 2023-24](https://github.com/Umang-Lodaya/Mumbai-Local-TimeTable-Extractor/tree/ba5005759da90af0fbd8b8988f9863b1629fef11/data).
- OSM `start_date` tags give game flavour, e.g. "since 1867" plaques:
  - Churchgate 1867-04-12; Marine Lines, Charni Road, Mahalaxmi, Lower Parel, Prabhadevi and Matunga Road 1867.
  - Dadar 1868; Bandra 1869; Khar Road 1924-07-01; Andheri 1928.
  - Source: OSM nodes. These are mapper-entered and unverified.

**Harbour line interchanges.**
- The Harbour line (Central Railway) shares the corridor north of Mahim. Its timetable station list runs: … Vadala Road, King's Circle, Mahim Jn, Bandra, Khar Road, Santacruz, Vileparle, Andheri, Jogeshwari, "Ramnagar" (a typo for Ram Mandir), Goregaon — [TT tables 20–23 (Harbour, CSMT–Goregaon–Panvel)](https://github.com/Umang-Lodaya/Mumbai-Local-TimeTable-Extractor/tree/ba5005759da90af0fbd8b8988f9863b1629fef11/data).
- OSM names the parallel tracks "Central Railway (Harbour Line)" at Mahim, Bandra, Khar Road, Santa Cruz, Vile Parle, Andheri, Jogeshwari, Ram Mandir and Goregaon — OSM rail ways in the extract.
- Harbour route relations exist for "Mumbai CSMT → Goregaon" and the reverse. The Harbour Line CSMT→Panvel relation tags `opening_hours 04:00-01:00` and `interval 15` — [OSM r9623798](https://www.openstreetmap.org/relation/9623798), [r11093105](https://www.openstreetmap.org/relation/11093105), [r8130328](https://www.openstreetmap.org/relation/8130328).

**Other interchanges.**
- Central line at Dadar: the Central "Dadar" node (`ref=DR`, `alt_name=Dadar (Central)`) is 207 m from Western Dadar (`ref=DDR`) — OSM nodes.
- Vasai Road: Central Railway's Vasai Road–Diva line (MEMU) has its own route relations from Vasai Road — [OSM r11491143](https://www.openstreetmap.org/relation/11491143), [r11491096](https://www.openstreetmap.org/relation/11491096).
- Metro distances (straight line from station nodes) are in the table above. The repository's metro report also gives Churchgate (Line 3) as 445 m from the Western line terminus — `docs/research/metro/reports/Mumbai Metro A to Z.md` (this repo).

**Platform facts from the web.**
- Churchgate has 4 platforms: "1-2 for slow line & 3-4 for fast line" **(search extract)** — [India Rail Info blog post 5780410](https://indiarailinfo.com/blog/post/5780410); [Wikipedia: Churchgate](https://en.wikipedia.org/wiki/Churchgate_railway_station).
- Distances in other sources (older and rounded): Marine Lines 2 km, Dadar 11, Bandra 15, Andheri 22, Borivali 34, Virar 60 (Republic World, ~2017) **(search extract)** — [Republic World](https://www.republicworld.com/travel/explore-mumbai-with-mumbai-local-train-route-map-and-railway-stations-list-central-railway-western-railway-harbour-line).
- MumbaiHop and allthingsMUMBAI give shorter figures (Dadar 9, Bandra 13, Andheri 18) that conflict with the OSM chainage **(search extract)** — [MumbaiHop](https://mumbaihop.com/mumbai-western-line-station-list/).

### Inferences
- **For a 1:1 game, use the OSM chainage, not the rounded web tables.** It matches Republic World's rounded figures to within 0.5 km at every listed station: Dadar 10.58 → 11, Bandra 14.79 → 15, Andheri 22.06 → 22, Borivali 34.27 → 34, Virar 60.23 → 60. The MumbaiHop-style figures are wrong.
- Fast-line platforms:
  - The fast line has platforms at Churchgate, Marine Lines, Charni Road, Grant Road, Mumbai Central, Dadar, Bandra and Andheri.
  - Between Andheri and Borivali it has platforms at Jogeshwari, Goregaon, Malad and Kandivali, but **not Ram Mandir**. In the timetable, semi-fast trains (fast to Andheri, then on the fast line) halt at Jogeshwari, Goregaon, Malad and Kandivali and always skip Ram Mandir.
  - Mahalaxmi, Lower Parel, Prabhadevi, Matunga Road, Mahim, Khar Road, Santacruz and Vile Parle never see a fast halt.
- 15-car capability:
  - The 2023-24 timetable runs 15-car trains on all-stations runs between Andheri and Virar, for example the Virar–Andheri 15-car slow calling at Jogeshwari, Ram Mandir, Goregaon, Malad, Kandivali, Borivali, Dahisar, Mira Road, Bhayandar, Naigaon, Vasai Road and Nalla Sopara.
  - It also runs them on fast runs from Churchgate and Dadar to Virar, calling at Mumbai Central, Dadar, Bandra and Andheri (Churchgate–Virar 15-car fasts also call at Marine Lines, Charni Road and Grant Road).
  - So by 2023 at least these platforms took 15-car trains: the slow platforms from Andheri to Virar, and the fast-line halts Churchgate, Marine Lines, Charni Road, Grant Road, Mumbai Central, Dadar, Bandra, Andheri, Borivali, Bhayandar and Vasai Road.
  - No 15-car train in the 2023-24 timetable calls at the slow-only stations between Mumbai Central and Vile Parle.
- Platform length rule of thumb for the game: the existing game code uses 245 m for a 12-coach train (`scripts/lib/trains.mjs`, `TRAIN = 245`), so a 15-coach train is about 306 m. Mapped platforms of roughly 300 m or more (Dahisar, Mira Road, Naigaon, Borivali, Vasai Road, Bhayandar) fit 15-car trains. This is an inference from OSM geometry, not an official list.
- Andheri (platforms 1–9, Harbour 8–9) and Borivali (platforms up to 10) are the big hubs in OSM. At Dadar the platform refs run up to 14 across the Western and Central stations together, which suggests one continuous numbering. I could not verify which numbers are Western.

### Gaps
- Official Western Railway chainage (km posts) and official platform counts per station were not available, because Wikipedia and WR pages were blocked. The OSM numbers above are the best available.
- Codes north of Virar were not confirmed in any source this session, other than VR and DRD in the timetable header. Commonly used codes: Vaitarna VTN, Saphale SAH, Kelve Road KLV, Palghar PLG, Umroli UOI, Boisar BOR, Vangaon VGN. These are from background knowledge and must be verified. Distances north of Virar are also missing: the OSM extract stops at 19.5° N.
- Western Railway's official list of 15-car-capable platforms in 2026 was not found.
- The renaming dates are background knowledge only, not checked this session: Elphinstone Road → Prabhadevi in 2018, and Mumbai Central's code BCT → MMCT.
- It is unclear whether Churchgate's suburban code "CH" (a Wikipedia claim) is still in use. OSM and the timetable both use CCG.

## Corridors: slow and fast lines, 5th/6th lines, stopping patterns, Harbour extension

### Takeaway
There are four suburban tracks (up/down slow and up/down fast) from Churchgate to Virar.
- From Mumbai Central north, a separate mainline track runs alongside, tagged "Mumbai - Delhi Railway" in OSM.
- The Harbour line's own pair of tracks runs alongside from Mahim to Goregaon.
- In the 2023-24 timetable, 62 % of Churchgate departures were slow (all stations) and 38 % fast.
- Fast trains come in three kinds:
  - a standard fast stopping at Marine Lines, Charni Road, Grant Road, Mumbai Central, Dadar, Bandra, Andheri and Borivali, then usually all stations to Virar;
  - a "direct" fast that also skips Marine Lines, Charni Road and Grant Road;
  - a semi-fast that is fast to Andheri, then calls at Jogeshwari, Goregaon, Malad and Kandivali.
- A minority of Virar fasts skip the small stations north of Borivali.
- Since 2025–26 the 6th line from Mumbai Central to Borivali is reported complete (unverified). The Borivali–Virar 5th/6th lines (about 30 % done, target 2029) and the Harbour line extension from Goregaon to Borivali are both still under construction in November 2026.

### Cited Findings
**Tracks (OSM).**
- At Churchgate, Marine Lines and Charni Road, 4 tracks are named "Western Railway (Slow)" and "WesternRailway(Fast)". Mahalaxmi, Lower Parel, Dadar and Matunga Road show 5 tracks, the fifth named "Mumbai - Delhi Railway".
- From Mahim to Goregaon, 6–8 tracks include "Central Railway (Harbour Line)".
- North of Borivali, Dahisar, Mira Road, Naigaon and Nalla Sopara show 4 tracks named "Western Railway Virar to Borivali". Bhayandar and Vasai Road show 6–7 (loops and sidings).
- Source: OSM rail ways in the project extract, cross-sections at each station.
- OSM route tags (mapper estimates): fast `duration 01:25`, slow `duration 01:40`, `interval 15`, `opening_hours 4:00-1:00` — [OSM r11094509](https://www.openstreetmap.org/relation/11094509), [r11511060](https://www.openstreetmap.org/relation/11511060).

**Stopping patterns (TT 2023-24): trains covering all of Churchgate–Borivali, by halts.**
- All stations: 199 down / 208 up.
- CCG–MEL–CYR–GTR–MMCT–DDR–BA–ADH–BVI (standard fast): 113 down / 107 up.
- CCG–MMCT–DDR–BA–ADH–BVI (direct fast, skips Marine Lines, Charni Road and Grant Road): 38 down / 37 up.
- CCG–MEL–CYR–GTR–MMCT–DDR–BA–ADH–JOS–GMN–MDD–KILE–BVI (semi-fast, fast to Andheri, then Ram Mandir skipped): 22 down / 24 up. Plus 5 up trains of the same kind without Marine Lines, Charni Road and Grant Road.
- Between Dadar and Andheri, 547 trains run slow (via Matunga Road, Mahim, Khar Road, Santacruz and Vile Parle) and 405 fast (Dadar–Bandra–Andheri only).
- Source: [TT 2023-24](https://github.com/Umang-Lodaya/Mumbai-Local-TimeTable-Extractor/tree/ba5005759da90af0fbd8b8988f9863b1629fef11/data).

**North of Borivali (TT 2023-24): trains covering Borivali–Virar.**
- All stations: 201 down / 182 up.
- BVI–BYR–BSR–VR ("double fast", skips Dahisar, Mira Road, Naigaon and Nalla Sopara): 22 down / 13 up.
- BVI–BYR–NIG–BSR–VR: 9 up.
- BVI–DIC–MIRA–BYR–NSP–VR: 8 up.
- Source: [TT 2023-24](https://github.com/Umang-Lodaya/Mumbai-Local-TimeTable-Extractor/tree/ba5005759da90af0fbd8b8988f9863b1629fef11/data).

**Dahanu Road trains (93xxx, 12-car).**
- From Churchgate they call at Churchgate, Marine Lines, Charni Road, Grant Road, Mumbai Central, Dadar, Bandra, Andheri, Borivali, Bhayandar, Vasai Road and Virar, then every station to Dahanu Road.
- Others start at Virar, Borivali or Dadar.
- About 19 trains each way between Virar and Dahanu Road; 8 down trains start at Churchgate.
- Source: [TT 2023-24, Table 50](https://github.com/Umang-Lodaya/Mumbai-Local-TimeTable-Extractor/tree/ba5005759da90af0fbd8b8988f9863b1629fef11/data).

**Origin–destination mix of down trains (TT 2023-24, top pairs).**

| Route | Type | Down trains |
|---|---|---|
| Churchgate→Borivali | slow | 168 |
| Churchgate→Virar | fast | 98 |
| Churchgate→Borivali | fast | 49 |
| Churchgate→Goregaon | slow | 47 |
| Andheri→Virar | slow | 39 |
| Borivali→Virar | slow | 31 |
| Churchgate→Virar | slow | 20 |
| Dadar→Virar | fast | 18 (11 of them 15-car) |
| Churchgate→Andheri | slow | 17 |
| Churchgate→Bandra | slow | 17 |
| Churchgate→Bhayandar | slow | 16 |
| Churchgate→Bhayandar | fast | 9 |
| Churchgate→Dahanu Road | – | 8 |
| Churchgate→Vasai Road | fast | 7 |
| Churchgate→Malad | fast | 7 |
| Mahalaxmi→Borivali | slow | 7 |

Up trains mirror this list. Source: [TT 2023-24](https://github.com/Umang-Lodaya/Mumbai-Local-TimeTable-Extractor/tree/ba5005759da90af0fbd8b8988f9863b1629fef11/data).

**Mumbai Central–Borivali 6th line.**
- The project is 30 track km and Rs 919 crore under MUTP-II (Mumbai Urban Transport Project). Phase I, Khar–Goregaon, was commissioned earlier; Phase II covers Goregaon–Borivali **(search extract)** — [Wikipedia: Borivali railway station](https://en.wikipedia.org/wiki/Borivali_railway_station); [Wikipedia: Mumbai Urban Transport Project](https://en.wikipedia.org/wiki/Mumbai_Urban_Transport_Project).
- The Kandivali–Borivali stretch had a 30-day block from 20 Dec 2025 to 18 Jan 2026 **(search extract)** — [India TV News](https://www.indiatvnews.com/maharashtra/mumbai-locals-hit-as-350-western-railway-trains-to-remain-cancelled-daily-between-december-26-29-2025-12-24-1023191).
- About 350 Western Railway trains were cancelled daily from 26 to 29 Dec 2025 **(search extract)** — same source.
- A personal blog's MUTP status report dated 15 Aug 2026 lists "6th track, Mumbai Central–Borivali" as completed. It is not official **(search extract)** — [rajendrabaklekar.in](https://rajendrabaklekar.in/2026/08/16/mumbais-great-railway-rebuild-mutp-status-report-august-15-2026/).

**Borivali–Virar 5th and 6th lines.**
- About 30 % physically complete as of August 2026; target 2029 under MUTP-IIIA **(search extract)** — [WowNews24x7](https://www.wownews24x7.com/mumbai-borivali-virar-rail-expansion-passes-30-mark); [rajendrabaklekar.in](https://rajendrabaklekar.in/2026/08/16/mumbais-great-railway-rebuild-mutp-status-report-august-15-2026/).

**Harbour line, Goregaon→Borivali.**
- Rs 825 crore, about 8 km in two phases:
  - Phase 1, Goregaon–Malad (~2 km), by 2026-27.
  - Phase 2, Malad–Borivali (~5 km), by 2027-28.
  - **(search extract)** — [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-wr-plans-to-extend-harbour-line-from-goregaon-to-borivali-project-to-cost-825-cr-check-details-inside); [Oneindia](https://www.oneindia.com/mumbai/goregaon-borivli-harbour-line-phase-1-stretch-to-open-by-2026-27-says-western-railway-4027979.html).
- Construction started by December 2024, including an elevated station at Malad **(search extract)** — [India Rail Info news](https://indiarailinfo.com/news/post/western-railway-updates-goregaon-borivli-harbour-line-project-finally-underway-news/593843).
- One report gives a March 2027 target. The project needs 2,731 m² of land and the demolition of 16 three-storey railway buildings, affecting 520 residents **(search extract)** — [News On Projects](https://newsonprojects.com/site/projects?id=65155); [Construction Week India](https://www.constructionweekonline.in/business/western-railway-plans-extension-of-harbour-railway-line-till-borivali).
- No 2026 progress report was found.

**Capacity plans.** Western Railway plans to "nearly double train handling by 2030" across Mumbai and other cities. Only the headline was seen **(search extract)** — [Free Press Journal](https://www.freepressjournal.in/mumbai/western-railway-plans-major-capacity-expansion-to-nearly-double-train-handling-by-2030-across-mumbai-and-key-cities).

### Inferences
- **Game model:**
  - Four tracks: slow pair on one side, fast pair on the other.
  - Churchgate platforms 1–2 serve slow trains and 3–4 fast trains.
  - Slow trains call everywhere.
  - Fast trains call at Churchgate, Marine Lines, Charni Road, Grant Road, Mumbai Central, Dadar, Bandra, Andheri and Borivali; about 1 in 4 skips Marine Lines, Charni Road and Grant Road.
  - About 1 fast train in 8 is a semi-fast (22 of 173 fast down trains): fast to Andheri, then Jogeshwari, Goregaon, Malad and Kandivali.
  - North of Borivali, about 85–90 % of trains call at every station; the rest call only at Bhayandar and Vasai Road.
- In the map box, the game's existing OSM-based trains already use one track per service and direction (`scripts/lib/trains.mjs`). Slow trains should take the "Western Railway (Slow)" ways and fast trains the "(Fast)" ways. The fast route relation [r11094509](https://www.openstreetmap.org/relation/11094509) lists only fast halts south of Borivali, but still lists every station north of Borivali.
- A 5th line seems to be mapped at Malad but not at Kandivali (5 vs 4 tracks crossing). The OSM extract may lag behind the Kandivali–Borivali work of Dec 2025–Jan 2026. Do not rely on OSM for 6th-line geometry north of Goregaon.

### Gaps
- No official Western Railway or MRVC (Mumbai Railway Vikas Corporation) confirmation was found of the 6th line's full completion, or of whether the Mumbai Central–Khar section is done. MRVC and WR pages were unreachable and the search budget was exhausted.
- No 2026 progress figure was found for the Harbour line extension to Borivali.
- The 2026 stopping patterns may differ from the 2023-24 timetable. In particular, new AC fast patterns and the September 2026 timetable revision were not checked line by line. See the next section for the 2026 data route.

## Service numbers: daily services, AC, 15-car, first and last trains, headways, run times, speeds

### Takeaway
- **Daily services and fleet mix.** By November 2026 Western Railway runs about **1,414 suburban services per weekday**. About **145–147** are AC, up from 79 in 2023 and 109 in late 2024. 15-car services numbered about 211–213 in 2024, plus 17 conversions on 1 May 2026.
- **First and last trains.** The famous first train leaves Churchgate at **04:15 for Virar** and the last at **01:00 for Borivali**. The first up train leaves Virar at about 03:25.
- **Peak headway.** In the peaks Churchgate dispatches a train every 2–3 minutes, about 30 or more per hour on 4 platforms.
- **Run times.** Churchgate–Borivali takes 65 min by slow train and 46 min by fast. Churchgate–Virar takes 83 min by fast and about 103 min by slow. Churchgate–Dahanu Road takes about 2 h 37 min.

### Cited Findings
**Totals over time.**

| Date | Total services | AC (weekday) | 15-car | Source |
|---|---|---|---|---|
| Aug 2023 | 1,394 | 79 | 150 → 199 from 15 Aug 2023 (49 converted) | [Deccan Herald (PTI)](https://www.deccanherald.com/india/maharashtra/mumbai-western-railway-to-convert-49-suburban-local-train-services-to-15-coach-from-august-15-2647121) **(search extract)** |
| 27 Nov 2024 | 1,406 (unchanged) | 96 → 109 (weekend 52 → 65) | 213 per Wikipedia; 211 per Free Press Journal | [Rail Analysis India](https://railanalysis.in/rail-news/western-railway-to-introduce-additional-ac-local-train-services-on-mumbai-suburban-section/); [Yatri Railways](https://yatrirailways.com/everything-you-need-to-know-about-the-western-railways-13-new-ac-local-trains-in-mumbai); [Wikipedia: Western line](https://en.wikipedia.org/wiki/Western_line_(Mumbai_Suburban_Railway)); [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-news-suburban-rail-network-reports-52-drop-in-deaths-on-western-line-amid-major-safety-push) **(search extracts)** |
| 26 Jan 2026 | – | +12 AC announced (the report reportedly cited 109 AC at the time, which conflicts with the next row) | – | [Free Press Journal](https://www.freepressjournal.in/mumbai/western-railway-to-add-12-more-ac-local-services-from-january-26-boosting-peak-hour-comfort-for-daily-commuters) **(search extract)** |
| 19 Feb 2026 | 1,410 → 1,414 | 121 → 133 (11 converted + 1 new); weekend 77 → 106 | – | [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-western-railway-to-introduce-12-more-ac-local-trains-3-non-ac-services-from-19th-feb) **(search extract)** |
| 1 May 2026 | unchanged | 133 → 145 (12 non-AC trains converted); weekend 106 → 118 | +17 (17 12-car trains made 15-car) | [Lokmat Times](https://www.lokmattimes.com/mumbai/mumbai-local-train-update-wr-expands-15-coach-ac-services-across-suburban-network-from-may-1-a525/) **(search extract)** |
| 1 Sep 2026 | 6 services added, total reported as 1,414 (single outlet) | 145 → 147 | – | [Kordinate](https://kordinate.world/western-railway-mumbai-local-train-september-2026-schedule/); [The Traveler](https://www.thetraveler.org/western-railway-adds-six-mumbai-locals-ahead-of-september-rush/) **(search extract)** |

The whole suburban system (all operators) runs 2,342 services and carries more than 7.5 million commuters daily **(search extract, undated)** — [Wikipedia: Mumbai Suburban Railway](https://en.wikipedia.org/wiki/Mumbai_Suburban_Railway).

**Train numbering in the timetable (TT 2023-24).**
- Odd numbers run down (northbound, away from Churchgate); even numbers run up.
- 90xxx: ordinary 12-car (877 parsed).
- 91xxx: late-night trains (40).
- 92xxx: mostly 15-car (174 of 199 labelled "15 CAR").
- 93xxx: Dahanu Road (38).
- 94xxx: AC, labelled "Air Condition" (99).
- An "A" suffix marks variants, e.g. 90727A "ON SUN ONLY".
- Source: [TT 2023-24](https://github.com/Umang-Lodaya/Mumbai-Local-TimeTable-Extractor/tree/ba5005759da90af0fbd8b8988f9863b1629fef11/data).

**First and last trains (TT 2023-24).**
- From Churchgate:
  - First: 04:15 Virar slow (90011), 04:18 Borivali, 04:38 Borivali, 04:40 Virar fast.
  - Last: 00:38 Borivali, 00:43 Bhayandar, 00:50 Virar (arrives about 02:30), **01:00 Borivali slow (91055)**.
- From Virar (up): first 03:25 to Churchgate (90006), 03:35 to Borivali, 03:45 fast to Churchgate. Last 23:49 to Churchgate, 23:57 to Dahisar, **00:05 to Churchgate (91024), arriving 01:45**.
- From Borivali (up): first 03:50 (arrives Churchgate 04:56). Last ex-Borivali starter 00:30.
- First arrival at Churchgate: 04:50 (90002 from Andheri).
- Dahanu Road: first arrival 06:50 (from Virar); first departure 04:40 to Churchgate; last departure 22:45 to Virar; last arrival 23:05.
- AC trains from Churchgate run from about 05:45 to 21:57.
- Wikipedia agrees: "the earliest train departs at 4:15 for Virar, and the last train departs at 1:00 towards Borivali" **(search extract)** — [Wikipedia: Churchgate railway station](https://en.wikipedia.org/wiki/Churchgate_railway_station).
- Timetable source: [TT 2023-24](https://github.com/Umang-Lodaya/Mumbai-Local-TimeTable-Extractor/tree/ba5005759da90af0fbd8b8988f9863b1629fef11/data).

**Down departures from Churchgate per hour (TT 2023-24, ~90 % parse; slow/fast in brackets).**

| Hour | Trains | Slow / fast |
|---|---|---|
| 04h | 6 | 5 / 1 |
| 05h | 15 | 8 / 7 |
| 06h | 20 | 11 / 9 |
| 07h | 30 | 18 / 11 |
| 08h | 27 | 14 / 11 |
| 09h | 31 | 17 / 13 |
| 10h | 32 | 18 / 13 |
| 11h | 30 | 13 / 13 |
| 12h | 26 | 16 / 10 |
| 13h | 20 | 14 / 6 |
| 14h | 24 | 15 / 9 |
| 15h | 24 | 15 / 9 |
| 16h | 20 | 17 / 3 |
| 17h | 28 | 16 / 12 |
| 18h | 27 | 17 / 10 |
| 19h | 29 | 16 / 13 |
| 20h | 27 | 16 / 11 |
| 21h | 23 | 14 / 8 |
| 22h | 18 | 11 / 7 |
| 23h | 15 | 11 / 4 |
| 00h | 9 | 9 / 0 |
| 01h | 1 | – |

- Churchgate arrivals peak in the 07–11h window at 25–32 per hour.
- The median gap between Churchgate departures is 3 min all day. In the 17–20h peak, the most common gap is 3 min, and 0–1 min gaps are frequent when slow and fast trains leave together from different platforms.
- At Andheri, up to 35–36 trains per hour per direction pass or stop (08h and 18h down, 10h up).
- Source: [TT 2023-24](https://github.com/Umang-Lodaya/Mumbai-Local-TimeTable-Extractor/tree/ba5005759da90af0fbd8b8988f9863b1629fef11/data).

**Run times (TT 2023-24, median minutes, range in brackets).**
- Churchgate–Borivali: slow 65 (62–70) down / 67 up; standard fast 46 (40–51) down / 47 up; semi-fast 53 (50–60).
- Churchgate–Dadar: slow 21, fast 17. Churchgate–Bandra: slow 31, fast 23. Churchgate–Andheri: slow 44, fast 32.
- Dadar–Andheri: slow 23, fast 15. Andheri–Borivali: slow 22, fast 14.
- Churchgate–Virar: fast 83 (67–89) both ways; double fast 77; all stations 103 (100–109).
- Borivali–Virar: slow 37; double fast 30.5.
- Churchgate–Dahanu Road: 156.5 (147–168).
- Fast sections between halts:
  - Churchgate→Mumbai Central direct: 8 down / 9 up.
  - Mumbai Central→Dadar 7, Dadar→Bandra 6, Bandra→Andheri 9, Andheri→Borivali 14.
  - Borivali→Bhayandar 10–10.5, Bhayandar→Vasai Road 8–9, Vasai Road→Virar 10–11.
- Source: [TT 2023-24](https://github.com/Umang-Lodaya/Mumbai-Local-TimeTable-Extractor/tree/ba5005759da90af0fbd8b8988f9863b1629fef11/data).

**Machine-readable 2026 timetable (best route to "exactly like real life").**
- The m-Indicator app's timetable database is published as `https://cdn.mobond.com/mi/mumbaidb.zip`.
  - About 1.3 MB; `version.txt` reads `20260417`, last modified 17 Apr 2026.
  - Updates are irregular.
- An MIT-licensed decoder, `pipeline/decode_mumbaidb.py`, outputs:
  - `trains.csv`: train number, origin, destination, service pattern, notes;
  - `timetable_by_train.csv`: stop order, time, **platform** and **platform side L/R/B**;
  - `stations.csv`.
- Reference counts for version 20260417: 20 line codes including `W`; 5,714 trains across all lines; 3,442 trains with official numbers.
- Service patterns are free text: `S` (slow, 4,901 trains network-wide), `F`, `F*`, `F-Adh`, etc. Notes carry "15 CAR", "AC", "Not on Sunday" and "AC, General on Saturday and Sunday".
- There is no day-of-week field: weekday and Sunday validity exist only in the notes.
- The data is a proprietary compilation by Mobond. The repository claims no licence over it and does not commit it.
- Source: [jollySleeper/mumbai-local-timetable, BUILD_SPEC.md (2026-10-27)](https://github.com/jollySleeper/mumbai-local-timetable/blob/efa20a3419d7dfac3325531eaffd9036a1add198/BUILD_SPEC.md).

### Inferences
- **Peak headway:** with about 90 % of trains parsed, Churchgate dispatched 27–32 trains per hour in the peaks. The real figure is probably about 30–34, which works out to one train every **~2 minutes per terminus** and about 3–4 minutes per track.
- **Average speeds, from OSM km and timetable minutes:**
  - Churchgate–Borivali slow: 34.27 km / 65 min ≈ **32 km/h**.
  - Churchgate–Borivali fast: 34.27 / 46 ≈ **45 km/h**.
  - Churchgate–Virar fast: 60.23 / 83 ≈ **44 km/h**.
  - Churchgate–Virar all stations: ≈ 35 km/h.
  - Andheri→Borivali non-stop: 12.2 km / 14 min ≈ 52 km/h.
  - These figures include stops. Typical slow-train station spacing is 1.0–2.7 km south of Borivali, with 2–6 minutes between stations; north of Borivali it is 2.4–4.7 km, with 4–7 minutes.
- **Time window:** there are no Churchgate departures between 01:00 and 04:15, and Virar's first up train leaves at about 03:25. The game should run a roughly 3-hour night gap.
- **2026 scaling of the 2023-24 timetable:**
  - Total services: about +1.4 % (1,394 → 1,414).
  - AC services: about 79 → 147. Most of the new AC trains were converted from existing non-AC slots, not added.
  - 15-car services: about 199 → roughly 230 (213 + 17; the exact 2026 number was not found).
  - A game can keep the 2023-24 slot pattern, flag about 10 % of trains as AC, and flag about 16 % as 15-car.
- If the owner wants real 2026 times, the m-Indicator database is the most complete source. It should be downloaded in a GitHub Action (cdn.mobond.com was not reachable from this sandbox), used only to derive patterns, and not shipped, because its licence is unclear. Its per-stop platform number and side (L/R/B) would tell the game which side the doors open.

### Gaps
- The official 2026 count of 15-car services and the exact peak headway in seconds (official figure) were not found.
- Maximum and average speeds were not found as official figures. The usual maximum of the EMU (electric multiple unit) rakes, about 100–110 km/h, is background knowledge only.
- The September 2026 timetable details were not verified: which 6 services were added, and whether the total became 1,420 or stayed 1,414.
- The timetable has minute resolution, so dwell times cannot be derived from it.

## Train indicators, destination codes and labels

### Takeaway
The official timetable labels each train by destination code, number and length ("BVI 90551 12 CAR", "VR 92121 15 CAR") and uses S/F for slow/fast. Destination codes seen in Western timetable headers: BVI, VR, BYR, GMN, ADH, BA, BSR, NSP, DRD, DDR, MDD, DIC, MX, CCG. I could not verify the exact abbreviations on the physical platform indicator boards, such as "BO" or "A".

### Cited Findings
- Train header format, e.g. "BVI 90551 12 CAR", "VR 92121 15 CAR", "BSR 92153 15 CAR", "DRD 93033 12 CAR", "BVI* 90727A 12 CAR". The asterisk marks a special note. Some tables spell destinations out instead ("Borivali 90030 12 CAR", "Bhayandar 90034", "Goregoan 90160", "Nalla Sopara 92008") — [TT 2023-24, tables 25–49](https://github.com/Umang-Lodaya/Mumbai-Local-TimeTable-Extractor/tree/ba5005759da90af0fbd8b8988f9863b1629fef11/data).
- Fast-train halts are printed in capitals in the station column (CHURCHGATE, M'BAI CENTRAL (L), DADAR, BANDRA, ANDHERI, BORIVALI, VIRAR; up tables add BHAYANDAR and VASAI ROAD; the Dahanu table adds SAPHALE, PALGHAR, BOISAR, DAHANU ROAD) — [TT 2023-24](https://github.com/Umang-Lodaya/Mumbai-Local-TimeTable-Extractor/tree/ba5005759da90af0fbd8b8988f9863b1629fef11/data).
- Note strings in the timetable:
  - "NOT ON SUNDAYS & HOLIDAYS", "ON SUN ONLY", "# NOT ON SUNDAY";
  - "*Ladies spl On Sun Gen" / "*Ladies Special On Sun.General" (a ladies special that runs as a general train on Sunday);
  - "AC ON SAT & SUN" (an ordinary rake swapped to AC at weekends) and "# Non AC on SATURDAY & SUNDAY" (an AC slot run with an ordinary rake at weekends);
  - "* Passing (Will not halt at BVI)".
  - Source: [TT 2023-24](https://github.com/Umang-Lodaya/Mumbai-Local-TimeTable-Extractor/tree/ba5005759da90af0fbd8b8988f9863b1629fef11/data).
- m-Indicator's data uses service pattern `S`/`F`/`F*` plus notes "15 CAR", "AC", "Not on Sunday", and platform numbers such as `3|4` — [jollySleeper BUILD_SPEC.md](https://github.com/jollySleeper/mumbai-local-timetable/blob/efa20a3419d7dfac3325531eaffd9036a1add198/BUILD_SPEC.md).

### Inferences
- A faithful game indicator row could read: time · destination (code or short name) · S/F · 12/15 · "AC" or "LADIES" where it applies. The fields come from the timetable; the exact board layout is a design choice.
- Counts of note types in the 2023-24 timetable:
  - The "Ladies special" footnote appears in the evening down tables (first stop 17:00–20:59) and the morning up tables (06:00–09:59). The parser attaches a table footnote to every train in that table section, so its count of 72 trains is only an upper bound; the real number of ladies specials is likely much smaller;
  - about 149 carry a "NOT ON SUN" note;
  - 15 run as AC only on Saturday and Sunday;
  - 36 AC slots run non-AC on Saturday and Sunday.
  - Treat these as ±10 % (parse coverage).

### Gaps
- The abbreviations on physical Western platform indicators (e.g. whether Borivali shows as "BO" or "BVI", Andheri as "A" or "ADH") were not verified; no source was reachable. Indicator languages and colours were not verified either. Ask the owner, or check photos in a later session.

## Sunday and holiday timetables, mega blocks, night blocks

### Takeaway
Sunday service is a reduced version of the weekday timetable, set by per-train notes rather than a separate timetable. Ladies specials run as general trains, and some AC slots swap rakes at weekends. Weekend AC services are fewer than weekday ones: 118 against 145 from May 2026. The only 2025–26 block found was a long infrastructure block (Kandivali–Borivali, December 2025–January 2026), not a routine Sunday mega block.

### Cited Findings
- In the 2023-24 timetable, Sunday and holiday variation is carried only in notes ("NOT ON SUNDAYS & HOLIDAYS", "ON SUN ONLY", "Ladies Special On Sun. General") — [TT 2023-24](https://github.com/Umang-Lodaya/Mumbai-Local-TimeTable-Extractor/tree/ba5005759da90af0fbd8b8988f9863b1629fef11/data).
- Network-wide railway data has no day-of-week field; Sunday validity lives only in the note text — [jollySleeper BUILD_SPEC.md](https://github.com/jollySleeper/mumbai-local-timetable/blob/efa20a3419d7dfac3325531eaffd9036a1add198/BUILD_SPEC.md).
- Weekend AC services: 52 → 65 (Nov 2024), 77 → 106 (Feb 2026), 106 → 118 (May 2026) **(search extracts)** — [Rail Analysis India](https://railanalysis.in/rail-news/western-railway-to-introduce-additional-ac-local-train-services-on-mumbai-suburban-section/); [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-western-railway-to-introduce-12-more-ac-local-trains-3-non-ac-services-from-19th-feb); [Lokmat Times](https://www.lokmattimes.com/mumbai/mumbai-local-train-update-wr-expands-15-coach-ac-services-across-suburban-network-from-may-1-a525/).
- Kandivali–Borivali 6th-line block: 20 Dec 2025–18 Jan 2026, with about 350 trains cancelled daily from 26 to 29 Dec 2025 **(search extract)** — [India TV News](https://www.indiatvnews.com/maharashtra/mumbai-locals-hit-as-350-western-railway-trains-to-remain-cancelled-daily-between-december-26-29-2025-12-24-1023191).

### Inferences
- Sunday rule of thumb for the game: drop the slots marked "NOT ON SUN". The parser found the note on about 149 trains, about 12 % of the 2023-24 trains, but the figure may be inflated in the same way as the ladies footnote. Then turn ladies specials into general trains, and run about 25 fewer AC trains (145 → 118) by using ordinary rakes in those slots.
- The nightly window with no trains (about 01:00–04:00 south of Borivali) is when maintenance happens, so game night blocks fit there.

### Gaps
- The routine Western Railway Sunday "mega block" pattern was not found because the search budget ran out: typical hours, sections, whether WR now prefers night blocks to daytime Sunday blocks, and fast-line diversions to the slow line. Look for a WR press release ("jumbo block", "mega block") in a later session.

## Notable stations' quirks and harmless game flavour

### Takeaway
Station flavour that holds up in the data:
- Churchgate is a 4-platform dead-end terminus facing the new underground Metro Line 3, about 445 m away.
- Mumbai Central has a local station ("(L)") beside a big mainline terminus.
- Dadar's Western and Central stations sit side by side, about 200 m apart.
- Andheri (9 platforms, with Harbour line and Metro Line 1) and Borivali (10 platforms) are the big suburban hubs.
- Ram Mandir is a slow-only station between Jogeshwari and Goregaon.
- Virar is the classic end of the "Virar fast".

### Cited Findings
- Churchgate:
  - 4 platforms, 1–2 slow and 3–4 fast **(search extract)** — [India Rail Info](https://indiarailinfo.com/blog/post/5780410).
  - OSM maps platform refs 1, 2;3, 3;4 and 4, up to about 347 m long — OSM extract.
  - Metro Line 3 "Churchgate" (official name with a sponsor prefix "LIC –") is 444 m away, `start_date` 2025-10-09 — OSM node; `docs/research/metro/reports/Mumbai Metro A to Z.md`.
- Dadar:
  - The Western (DDR) and Central (DR) station nodes are 207 m apart.
  - Platform refs mapped across both run 1–14, including a "9A".
  - Metro Line 3 Dadar is about 620–676 m away.
  - Source: OSM extract.
- Mumbai Central:
  - Suburban stop "Mumbai Central (local)" next to the mainline terminus (`station=terminal`, `old_name=Bellasis Road`, since 1930-12-18).
  - The suburban timetable prints "M'BAI CENTRAL (L)".
  - Sources: OSM; [TT 2023-24](https://github.com/Umang-Lodaya/Mumbai-Local-TimeTable-Extractor/tree/ba5005759da90af0fbd8b8988f9863b1629fef11/data).
- Andheri: platform refs 1, 2;3, 4-5, 6;7, 8-9 (the Harbour line uses the 8–9 end); Metro Line 1 station 272 m away — OSM extract; [TT Harbour tables](https://github.com/Umang-Lodaya/Mumbai-Local-TimeTable-Extractor/tree/ba5005759da90af0fbd8b8988f9863b1629fef11/data).
- Borivali: platform refs 2 to 10. It is the turnback for the most common service (Churchgate–Borivali, about 168 down slow trains a day) — OSM extract; [TT 2023-24](https://github.com/Umang-Lodaya/Mumbai-Local-TimeTable-Extractor/tree/ba5005759da90af0fbd8b8988f9863b1629fef11/data).
- Goregaon: terminus of the Harbour line from CSMT, and turnback for about 47 Churchgate slow trains a day — [TT 2023-24](https://github.com/Umang-Lodaya/Mumbai-Local-TimeTable-Extractor/tree/ba5005759da90af0fbd8b8988f9863b1629fef11/data).
- Dadar as a Western terminus: about 18 Dadar–Virar fasts a day, 11 of them 15-car — [TT 2023-24](https://github.com/Umang-Lodaya/Mumbai-Local-TimeTable-Extractor/tree/ba5005759da90af0fbd8b8988f9863b1629fef11/data).
- Mahalaxmi: Metro Line 3 at 361 m and Sant Gadge Maharaj Chowk (Jacob Circle) monorail at 464 m. Lower Parel: monorail at 311 m and Currey Road (Central line) at 346 m — OSM extract.
- Vasai Road: 7 platform refs. It is the meeting point with Central Railway's Vasai Road–Diva MEMU line — OSM extract; [OSM r11491143](https://www.openstreetmap.org/relation/11491143).
- Jogeshwari has a separate "Jogeshwari (Harbour Line)" station node 563 m north of the Western station — OSM extract.

### Inferences
- Harmless flavour hooks supported by the timetable:
  - the 04:15 "first local" and the 01:00 "last local" from Churchgate;
  - the 00:05 last train out of Virar reaching Churchgate at 01:45;
  - evening down and morning up "Ladies special" trains, which run as general trains on Sundays;
  - weekend-only AC swaps;
  - Dadar-starting 15-car Virar fasts;
  - morning up fast trains that run through Borivali without stopping.
- For a believable Churchgate in the game: trains arrive, unload and leave from the same platform. Slow trains use platforms 1–2 and fast trains 3–4. The OSM line-building comment notes that the last few hundred metres into Churchgate use one platform track in both directions (`scripts/lib/trains.mjs` header).

### Gaps
- Not found, because sources were blocked or the search budget ran out:
  - Dadar's foot-overbridges: count, names, the 2024 platform renumbering details;
  - Churchgate's concourse layout and building details;
  - Andheri's skywalks and the Gokhale bridge;
  - Borivali's platform-to-line assignment;
  - Ram Mandir's opening date and why it is slow-only.
- Station architecture is covered elsewhere in this research set and was not part of this note.
