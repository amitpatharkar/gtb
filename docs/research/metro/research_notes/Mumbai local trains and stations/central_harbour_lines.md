# Central line, Harbour line, Trans-Harbour line and Port (Uran) line: stations, corridors, stopping patterns and timings (as of November 2026)

How these notes were made (read first). Two kinds of evidence are used and they are labelled separately:

- **[OSM]** = the local OpenStreetMap extract `data/raw/mumbai-region.osm.pbf` (extract.bbbike.org, 2026-11-13, box 72.598,18.520 → 73.533,19.500, so Kasara and the upper Kasara branch are cut off). The route relations of the "Mumbai Suburban Railway" network were read with a throw-away script (same reader as `scripts/lib/trains.mjs`). "km" values marked [OSM] are **measured along the mapped track** from the CSMT buffer stop (or from Thane / Nerul / CBD Belapur), not the official railway chainage; they agree with the official figures found to within about 1 km (CSMT–Kalyan 53.7 vs 54; CSMT–Panvel 49.0 vs 49; CSMT–Goregaon 26.9 vs 26). Platform numbers marked [OSM] are the `ref` tag that mappers put on each stop position (the place a train of that route stops) and can be stale. Map data © OpenStreetMap contributors (ODbL). Links point to the live object on openstreetmap.org.
- **Web** facts. In this session every direct page fetch failed (en.wikipedia.org, wikiwand.com, freepressjournal.in, mumbaimetroroute.com and indiarailinfo.com do not resolve from the sandbox), so **every web fact below comes only from search-engine extracts** of the cited page, not from reading the page itself. The session's web-search quota ran out before the last few questions (coach layout, Kalyan platform count) could be searched; those are listed as gaps.
- Game context: the shipped map box is 18.890,72.795 → 19.140,72.920 (CLAUDE.md). Coordinates below are WGS84; the game's projection is in `scripts/build-tiles.mjs` (section "projection", origin Mahim 19.03 N, 72.85 E).

## 1. Every station in order on each line: codes, distances, platforms, slow/fast/Harbour platforms, 15-car capability, interchanges

### Takeaway
The four lines have 26 stations CSMT–Kalyan (slow), then branches of 11 more stations to Kasara and 14 to Khopoli; Harbour has 25 stations CSMT–Panvel and 18 CSMT–Goregaon (sharing the first 8); Trans-Harbour has 8 stations Thane–Turbhe that then split to Vashi or to Nerul–Panvel; the Port/Uran line runs Nerul or CBD Belapur to Uran with 7–9 stops. The tables below give, per station, the code, the measured distance and the platform numbers used by slow, fast and Harbour trains as mapped in OSM; official km figures from the web are given where found.

### Cited Findings

**Central main line, slow route CSMT → Kalyan** ([OSM relation 11491271](https://www.openstreetmap.org/relation/11491271) down, [11491270](https://www.openstreetmap.org/relation/11491270) up; fast route [9953730](https://www.openstreetmap.org/relation/9953730) / [9953729](https://www.openstreetmap.org/relation/9953729)). Code = OSM station `ref`. "Slow pf" / "Fast pf" = platform number on the stop position for trains going away from CSMT (down) / towards CSMT (up).

| # | Station | Code | km [OSM] | lat, lon | Slow pf down/up | Fast pf down/up | Notes |
|---|---|---|---|---|---|---|---|
| 1 | Mumbai CSMT | CSMT | 0.0 | 18.94062, 72.83527 | 3 / 4 | 5 / 6 | Harbour uses pf 1 (out) / 2 (in). Metro Line 3 station "Chhatrapati Shivaji Maharaj Terminus" mapped at 18.94083, 72.83186 |
| 2 | Masjid | MSD | 1.3 | 18.95183, 72.83821 | 3 / 4 | – (no fast halt) | Harbour pf 1 / 2 |
| 3 | Sandhurst Road | SNRD | 2.5 | 18.96184, 72.83936 | 1 / 2 | – | Harbour pf 3 / 4 on the upper (elevated) level |
| 4 | Byculla | BY | 4.3 | 18.97655, 72.83268 | (not tagged) | fast halt | OSM platforms 1, 2–3 (island), 4 |
| 5 | Chinchpokli | CHG | 5.5 | 18.98741, 72.83275 | (one island, 1–2) | – | |
| 6 | Currey Road | CRD | 6.2 | 18.99364, 72.83280 | 1 / 2 | – | |
| 7 | Parel | PR | 8.1 | 19.00957, 72.83751 | 1 / 3 | – | OSM platform refs include "2A;3" (terminal platform for Parel-starting locals) |
| 8 | Dadar (Central) | DR | 9.1 | 19.01746, 72.84273 | 7 / 9 (as mapped; see renumbering conflict below) | 11 / 12 | Western line Dadar is a separate code (DDR). Metro Line 3 "Dadar" mapped at 19.02362, 72.83922; monorail "Dadar East" at 19.01625, 72.85223 |
| 9 | Matunga | MTN | 10.5 | 19.02748, 72.85010 | 1 / 2 | – | (Matunga Road MRU is on the Western line) |
| 10 | Sion | SIN | 13.2 | 19.04751, 72.86383 | 1 / 2 | – | Flood-prone stretch Sion–Kurla |
| 11 | Kurla | CLA | 15.7 | 19.06533, 72.87890 | 1 / 4 | 5 / 6 | Harbour pf 7 (to Panvel) / 8 (to CSMT) |
| 12 | Vidyavihar | VVH | 18.2 | 19.07952, 72.89722 | 1 / 2 | – | |
| 13 | Ghatkopar | GC | 19.5 | 19.08572, 72.90797 | 1 / 2 | 3 / 4 | Metro Line 1 interchange |
| 14 | Vikhroli | VK | 23.2 | 19.11178, 72.92812 | 1 / 2 | (some fast halts, see §3) | OSM platforms 1, 2–3, 4 |
| 15 | Kanjur Marg | KJRD | 25.1 | 19.12864, 72.92810 | (not tagged) | – | |
| 16 | Bhandup | BND | 27.0 | 19.14298, 72.93789 | 1 / 2 | (a few peak fast halts) | OSM platforms 1, 2–3, 4 |
| 17 | Nahur | NHU | 28.6 | 19.15470, 72.94657 | 1 / 2 (one island) | – | |
| 18 | Mulund | MLND | 30.9 | 19.17252, 72.95693 | (not tagged) | (fast halt in some lists) | OSM platforms 1, 2–3, 4 |
| 19 | Thane | TNA | 33.5 | 19.18636, 72.97590 | 2 / 4 | 5 / 6 | Trans-Harbour trains use pf 9 (OSM; platform objects "9/10A", "10A1") |
| 20 | Kalva (Kalwa) | KLVA | 35.9 | 19.19536, 72.99677 | 1 / 2 | – | OSM platforms 1, 2–3, 4 |
| 21 | Mumbra | MBQ | 40.5 | 19.18993, 73.02347 | (not tagged) | – | 3 platform objects |
| 22 | Diva Junction | DIVA | 42.9 | 19.18889, 73.04206 | 1A or 1 / 2 | (fast halt in some lists) | Junction with the Vasai Road–Diva–Panvel/Roha line; OSM platforms 1A, 1–2, 3–4, 5–6, 7–8 |
| 23 | Kopar | KOPR | 47.4 | 19.21096, 73.07713 | – / 2 | – | OSM platforms 1, 1A, 1–2, 3, 4 |
| 24 | Dombivli | DI | 48.6 | 19.21800, 73.08644 | 2 / 3 | 4 / 5 | Fast route measures 46.4 km here (see corridor section) |
| 25 | Thakurli | THK | 50.1 | 19.22630, 73.09817 | (not tagged) | – | |
| 26 | Kalyan Junction | KYN | 53.7 | 19.23547, 73.13022 | 1 / 1A (as mapped for Kalyan-terminating trains) | Kasara trains pf 2 / 3, Khopoli trains pf 6 / 7 | Branch point for Kasara (north-east) and Karjat/Khopoli (south-east) |

— all rows [OSM relations above](https://www.openstreetmap.org/relation/11491271); station codes from the OSM station nodes in the same extract.

**Karjat / Khopoli branch** (continuation of [OSM 11514143](https://www.openstreetmap.org/relation/11514143) "CSMT → Khopoli (Fast)", km measured from CSMT along the fast route):

| # | Station | Code | km [OSM] | lat, lon | pf down / up [OSM] |
|---|---|---|---|---|---|
| 1 | Kalyan Junction | KYN | 53.6 | 19.23494, 73.13041 | 6 / 7 |
| 2 | Vithalwadi | VLDI | 55.8 | 19.22888, 73.14866 | – |
| 3 | Ulhasnagar | ULNR | 57.8 | 19.21796, 73.16341 | 1 / 2 |
| 4 | Ambarnath (Ambernath) | ABH | 60.2 | 19.21019, 73.18458 | – (OSM platforms 1, 1A, 2, 3) |
| 5 | Badlapur | BUD | 67.8 | 19.16682, 73.23899 | 2 / 3 (OSM platforms 1, 2, 3) |
| 6 | Vangani | VGI | 78.7 | 19.09438, 73.30093 | 1 / 2 |
| 7 | Shelu | SHLU | 82.7 | 19.06367, 73.31780 | 1 / 2 |
| 8 | Neral Junction | NRL | 86.7 | 19.02726, 73.31856 | – (Matheran narrow-gauge station NRLN alongside) |
| 9 | Bhivpuri Road | BVS | 93.5 | 18.97055, 73.33151 | 1 / 2 |
| 10 | Karjat | KJT | 100.2 | 18.91172, 73.32058 | 4 / 4 |
| 11 | Palasdhari | PDI | 103.4 | 18.88357, 73.32113 | 2 / 2 |
| 12 | Kelavli | KLY | 107.8 | 18.84528, 73.31879 | 1 / 1 |
| 13 | Dolavli | DLV | 109.0 | 18.83435, 73.32004 | 1 / 1 |
| 14 | Lowjee | LWJ | 112.3 | 18.80915, 73.33527 | – |
| 15 | Khopoli | KHPI | 114.8 | 18.78894, 73.34550 | 1 / 2 |

— [OSM 11514143](https://www.openstreetmap.org/relation/11514143) / [11514202](https://www.openstreetmap.org/relation/11514202)

**Kasara branch** ([OSM 11514142](https://www.openstreetmap.org/relation/11514142); the extract ends at 19.5° N, so only the first stations are measurable):

| # | Station | Code | km [OSM] | lat, lon |
|---|---|---|---|---|
| 1 | Kalyan Junction | KYN | 53.7 | 19.23589, 73.13183 |
| 2 | Shahad | SHAD | 56.7 | 19.24408, 73.15818 |
| 3 | Ambivli | ABY | 59.8 | 19.26829, 73.17209 |
| 4 | Titwala | TLA | 64.6 | 19.29640, 73.20299 |
| 5 | Khadavli | KDV | 72.3 | 19.35702, 73.21933 |
| 6–11 | Vasind, Asangaon, Atgaon, (Thansit?), Khardi, Umbermali, Kasara | Kasara = KSRA | outside extract | — |

- Kasara station code is KSRA; Kalyan Junction is about 54–55 km from CSMT; from Kalyan the line splits towards Kasara (67 km) and Khopoli (61 km) — [Wikipedia, Central line (search extract)](https://en.wikipedia.org/wiki/Central_line_(Mumbai_Suburban_Railway)); [Kasara railway station (search extract)](https://en.wikipedia.org/wiki/Kasara_railway_station)
- Third-party route pages give CSMT → Shahad 53, Ambivli 55, Titwala 57, Khadavli 59, Vasind 61, Asangaon 63 km and "CSMT–Kasara 71.9 km" — these disagree with the OSM measurements (Titwala 64.6, Khadavli 72.3) and look unreliable — [mumbaimetroroute CSMT–Asangaon (search extract)](https://mumbaimetroroute.com/mumbai-local-train/routes/cst-local-to-asangaon); [Kasara–CSMT (search extract)](https://mumbaimetroroute.com/mumbai-local-train/routes/kasara-to-cst-local)
- Kelavli's code is KLY (Khopoli branch) — [Kelavli railway station (search extract)](https://en.wikipedia.org/wiki/Kelavli_railway_station)

**Harbour line, CSMT → Panvel** ([OSM 8130328](https://www.openstreetmap.org/relation/8130328) down, [9622461](https://www.openstreetmap.org/relation/9622461) up). All Harbour trains stop at every station.

| # | Station | Code | km [OSM] | lat, lon | pf down / up [OSM] | Notes |
|---|---|---|---|---|---|---|
| 1 | Mumbai CSMT | CSMT | 0.0 | 18.94060, 72.83508 | 1 / 2 | |
| 2 | Masjid | MSD | 1.4 | 18.95183, 72.83807 | 1 / 2 | |
| 3 | Sandhurst Road | SNRD | 2.4 | 18.96087, 72.83954 | 3 / 4 | Upper level |
| 4 | Dockyard Road | DKRD | 3.2 | 18.96645, 72.84425 | 1 / 2 | Elevated |
| 5 | Reay Road | RRD | 4.4 | 18.97743, 72.84422 | 1 / 2 | |
| 6 | Cotton Green | CTGN | 5.5 | 18.98650, 72.84322 | 1 / 2 | |
| 7 | Sewri | SVE | 7.3 | 18.99875, 72.85452 | 1 / 2 | |
| 8 | Vadala Road (Wadala Road) | not tagged in OSM | 9.4 | 19.01614, 72.85885 | Panvel trains 2 / 4; Goregaon trains 1 / 3 | Junction for the Goregaon branch; monorail "Wadala Bridge" mapped at 19.01748, 72.85932 |
| 9 | Guru Tegh Bahadur Nagar | GTBN | 12.0 | 19.03805, 72.86428 | 1 / 2 | Monorail station of the same name at 19.03669, 72.87079 |
| 10 | Chunabhatti | CHF | 13.7 | 19.05183, 72.86899 | 1 / 2 | Flood-prone stretch Chunabhatti–Kurla |
| 11 | Kurla | CLA | 15.6 | 19.06493, 72.87923 | 7 / 8 | Interchange with main line |
| 12 | Tilak Nagar | TKNG | 16.8 | 19.06572, 72.89049 | 1 / 2 | (OSM relation lists Chembur before Tilak Nagar, but the track order is Kurla → Tilak Nagar → Chembur) |
| 13 | Chembur | CMBR | 18.0 | 19.06261, 72.90138 | 1 / 2 | Monorail "Chembur" mapped at 19.06121, 72.89759 |
| 14 | Govandi | GV | 19.8 | 19.05497, 72.91579 | 1 / 2 | |
| 15 | Mankhurd | MNKD | 21.7 | 19.04815, 72.93191 | 1 / 2 | Metro "Mankhurd" (Line 2B) mapped at 19.04922, 72.93123 |
| 16 | Vashi | VSH | 29.2 | 19.06321, 72.99896 | 3 / 4 | After the Thane Creek bridge; Trans-Harbour uses pf 1; OSM station tag `platforms=4` |
| 17 | Sanpada | SNCR | 30.3 | 19.06590, 73.00957 | 3 / 4 | |
| 18 | Juinagar | JNJ | 32.2 | 19.05590, 73.01830 | 3 / 4 | |
| 19 | Nerul | NEU | 34.7 | 19.03355, 73.01822 | 3 / 4 | Uran trains pf 5 / 6; OSM `platforms=6` |
| 20 | Seawoods–Darave | SWDV | 36.1 | 19.02196, 73.01931 | 1 / 2 | Uran trains pf 3 / 4; OSM `platforms=4` |
| 21 | CBD Belapur | BEPR | 38.5 | 19.01914, 73.03900 | 1 / 3 | Uran trains pf 4; OSM `platforms=4` |
| 22 | Kharghar | KHAG | 40.8 | 19.02599, 73.05920 | 1 / 2 | OSM `platforms=4` |
| 23 | Mansarovar | MANR | 43.7 | 19.01651, 73.08067 | 1 / 2 | |
| 24 | Khandeshwar | KNDS | 45.6 | 19.00742, 73.09525 | 1 / 2 | |
| 25 | Panvel | PNVL | 49.0 | 18.99028, 73.12132 | arrive 2 / depart 1 | Trans-Harbour to Thane leaves from pf 3 |

— [OSM 8130328](https://www.openstreetmap.org/relation/8130328), station nodes/ways e.g. [Vashi](https://www.openstreetmap.org/way/151768155), [Nerul](https://www.openstreetmap.org/way/572630813)

**Harbour line, CSMT → Goregaon** ([OSM 9623798](https://www.openstreetmap.org/relation/9623798) / [11093105](https://www.openstreetmap.org/relation/11093105)); stations 1–8 shared with the Panvel branch.

| # | Station | Code | km [OSM] | lat, lon | pf down / up [OSM] |
|---|---|---|---|---|---|
| 8 | Vadala Road | – | 9.4 | 19.01616, 72.85882 | 1 / 3 |
| 9 | King's Circle | KCE | 11.3 | 19.03204, 72.85744 | 1 / 2 |
| 10 | Mahim Junction | MM | 12.8 | 19.04086, 72.84709 | 5 / 6 (Harbour platforms at the Western line station) |
| 11 | Bandra | BA | 14.5 | 19.05479, 72.84084 | 6 / 7 |
| 12 | Khar Road | KHAR | 16.1 | 19.06909, 72.83988 | 1 / 2 |
| 13 | Santacruz | STC | 17.8 | 19.08390, 72.84174 | 1 / 2 |
| 14 | Vile Parle | VLP | 19.6 | 19.10013, 72.84377 | 1 / 2 |
| 15 | Andheri | ADH | 21.8 | 19.11934, 72.84644 | 1 / 2 |
| 16 | Jogeshwari (Harbour platforms, separate from the Western line platforms) | JOS | 24.2 | 19.14116, 72.84940 | 1 / 2 |
| 17 | Ram Mandir | RMAR | 25.4 | 19.15137, 72.84988 | 1 / 2 |
| 18 | Goregaon | GMN | 26.9 | 19.16486, 72.84924 | 1 / 2 |

- Harbour line table (web): total 73.84 km route length and 35 stations ([Wikipedia, Harbour line (search extract)](https://en.wikipedia.org/wiki/Harbour_line_(Mumbai_Suburban_Railway))); an aggregator gives CSMT–Panvel 54 km / 25 stations and the Goregaon branch 28 km / 18 stations ([mumbaimetroroute Harbour (search extract)](https://mumbaimetroroute.com/mumbai-local-train/lines/harbour)) — the 54 km conflicts with timetable listings (49 km) and OSM (49.0 km).
- Harbour codes in the Wikipedia table pair a suburban/indicator code with the mainline code: Panvel PL/PNVL, Vashi VA (suburban) / VSH (mainline), CBD Belapur BR/BEPR, Mankhurd M/MNKD — [Harbour line (search extract)](https://en.wikipedia.org/wiki/Harbour_line); [Vashi railway station (search extract)](https://en.wikipedia.org/wiki/Vashi_railway_station); [Mankhurd railway station (search extract)](https://en.wikipedia.org/wiki/Mankhurd_railway_station)
- Sandhurst Road has 4 platforms: 2 at ground level for the Central line and 2 elevated for the Harbour line; the upper-level Harbour station was built in 1921 — [Sandhurst Road railway station (search extract)](https://en.wikipedia.org/wiki/Sandhurst_Road_railway_station); [Mumbai fandom, Harbour Line (search extract)](https://mumbai.fandom.com/wiki/Harbour_Line)
- Dockyard Road is an elevated structure between Sandhurst Road and Reay Road — [Dockyard Road railway station (search extract)](https://en.wikipedia.org/wiki/Dockyard_Road_railway_station)
- The Harbour line was extended from Andheri to Goregaon in March 2018 (first service 29 March 2018) — [Goregaon railway station (search extract)](https://en.wikipedia.org/wiki/Goregaon_railway_station)

**Trans-Harbour line** ([OSM 11511942](https://www.openstreetmap.org/relation/11511942) Thane → Panvel, [11511951](https://www.openstreetmap.org/relation/11511951) Panvel → Thane, [8414240](https://www.openstreetmap.org/relation/8414240) Thane → Vashi, [11511950](https://www.openstreetmap.org/relation/11511950) Vashi → Thane). km from Thane.

| # | Station | Code | km [OSM] | lat, lon | Notes |
|---|---|---|---|---|---|
| 1 | Thane | TNA | 0.1 | 19.18582, 72.97607 | Trans-Harbour pf 9 (and 10) at the far east of the station |
| 2 | Digha Gaon | DIGH | 3.4 | 19.18071, 72.99444 | OSM `start_date=2024-01-12` |
| 3 | Airoli | AIRL | 6.0 | 19.15857, 72.99948 | |
| 4 | Rabale | RABE | 8.5 | 19.13692, 73.00279 | |
| 5 | Ghansoli | GNSL | 10.8 | 19.11642, 73.00706 | |
| 6 | Koparkhairane | KPHN | 12.4 | 19.10330, 73.01137 | |
| 7 | Turbhe | TUH | 15.6 | 19.07618, 73.01796 | Split: north-west to Sanpada/Vashi, south to Juinagar/Nerul; OSM `platforms=4` |
| 8a | Sanpada | SNCR | 17.6 | 19.06604, 73.00954 | Vashi branch |
| 9a | Vashi | VSH | 18.8 | 19.06344, 72.99885 | Trans-Harbour pf 1 |
| 8b | Juinagar | JNJ | 17.8 | 19.05589, 73.01858 | Panvel branch: pf 1 down / 2 up |
| 9b | Nerul | NEU | 20.3 | 19.03353, 73.01848 | |
| 10b | Seawoods–Darave | SWDV | 21.7 | 19.02196, 73.01931 | |
| 11b | CBD Belapur | BEPR | 24.1 | 19.01914, 73.03900 | |
| 12b | Kharghar | KHAG | 26.4 | 19.02599, 73.05920 | |
| 13b | Mansarovar | MANR | 29.3 | 19.01651, 73.08067 | |
| 14b | Khandeshwar | KNDS | 31.3 | 19.00742, 73.09525 | |
| 15b | Panvel | PNVL | ≈34.2–34.7 | 18.99028, 73.12132 | pf 3 for Trans-Harbour |

— [OSM 11511942](https://www.openstreetmap.org/relation/11511942); [Digha Gaon station way](https://www.openstreetmap.org/way/900607248)
- Thane station: Wikipedia gives 10 platforms and 10 tracks and calls it the origin and destination of all Trans-Harbour trains; two local guides say 9 platforms with 10 tracks; Trans-Harbour trains start from separate platforms 9 and 10 at the far east — [Thane railway station (search extract)](https://en.wikipedia.org/wiki/Thane_railway_station); [Trans-Harbour line (search extract)](https://en.wikipedia.org/wiki/Trans-Harbour_line_(Mumbai_Suburban_Railway)); [mumbaimetroroute Thane (search extract)](https://mumbaimetroroute.com/mumbai-local-train/stations/thane)
- Service patterns on the line: Thane–Vashi, Thane–Nerul, Thane–Belapur and Thane–Panvel — [Trans-Harbour line (search extract)](https://en.wikipedia.org/wiki/Trans-Harbour_line_(Mumbai_Suburban_Railway))
- Digha (Digha Gaon) station was reported about 70 % complete in an older article, with Thane–Vashi/Nerul trains to stop there first; Wikipedia ties its opening to a Prime Minister's inauguration on 12 January (year visible only via OSM `start_date=2024-01-12`) — [Free Press Journal (search extract)](https://www.freepressjournal.in/mumbai/navi-mumbai-digha-station-on-trans-harbour-line-to-be-ready-by-year-end); [Digha Gaon railway station (search extract)](https://en.wikipedia.org/wiki/Digha_Gaon_railway_station)

**Port line / Nerul–Uran line** ([OSM 11512075](https://www.openstreetmap.org/relation/11512075) Nerul → Uran, [8418422](https://www.openstreetmap.org/relation/8418422) Uran → Nerul, [11512076](https://www.openstreetmap.org/relation/11512076) Belapur → Uran, [11512072](https://www.openstreetmap.org/relation/11512072) Uran → Belapur).

| # | Station | Code [OSM] | km from Nerul / from CBD Belapur [OSM] | lat, lon | Notes |
|---|---|---|---|---|---|
| 1 | Nerul | NEU | 0.1 / – | 19.03356, 73.01796 | Uran trains pf 5 (out) / 6 (in) |
| 2 | Seawoods–Darave | SWDV | 1.6 / – | 19.02177, 73.01911 | pf 3 / 4; Nerul trains only |
| 1' | CBD Belapur | BEPR | – / 0.1 | 19.01885, 73.03924 | pf 4 |
| 3 | Targhar | TRGHR | (not in the route relations; station way at 18.98989, 73.03415, ≈3 km south of Belapur) | 18.98989, 73.03415 | Opened 15 Dec 2025 (see below); serves the Navi Mumbai airport area |
| 4 | Bamandongri (Baman-Dongri) | BMDR | 7.8 / 7.0 | 18.97514, 73.02447 | OSM `start_date=11 November, 2018`, `platforms=2` |
| 5 | Kharkopar | KARP | 9.8 / 8.9 | 18.95991, 73.01423 | End of phase 1 (2018); OSM `platforms=2` |
| 6 | Gavan (Gavhan) | not mapped | between Kharkopar and Shemtikhar (Gavan village at 18.956, 73.009) | — | Opened 15 Dec 2025 |
| 7 | Ranjanpada / Shemtikhar | RJNPD (up-direction stop tagged "SEMK") | 16.1 / 15.3 | 18.90921, 73.01592 | |
| 8 | Nhava Sheva | NHVSV | 19.3 / 18.4 | 18.89816, 72.98820 | |
| 9 | Dronagiri | DRNGR | 22.4 / 21.5 | 18.88127, 72.96468 | |
| 10 | Uran (Uran City) | UNCT | 23.8 / 22.9 | 18.87825, 72.95252 | Terminus |

— [OSM relations above](https://www.openstreetmap.org/relation/11512075); [Targhar station way](https://www.openstreetmap.org/way/648990356); [Kharkopar way](https://www.openstreetmap.org/way/648982743); [Bamandongri way](https://www.openstreetmap.org/way/648982741)
- Phase I Nerul/Belapur–Kharkopar: 12.4 km double line; Phase II Kharkopar–Uran: 14.3 km double line; total cost reported as Rs 1,782 crore; PM flagged off Kharkopar–Uran on 12 January 2024, when all phase-II stations except Gavan were complete; one phase-II list names Shematikhar, Nhava Sheva, Dronagiri and Uran, plus Gavan — [Port line, Wikipedia (search extract)](https://en.wikipedia.org/wiki/Port_line_(Mumbai_Suburban_Railway)); [Shematikhar railway station (search extract)](https://en.wikipedia.org/wiki/Shematikhar_railway_station)
- Central Railway: "From tomorrow 5 additional pairs of trains will ply between Belapur/Nerul–Uran section also 2 new stations Targhar and Gavan on Uran lines will be operationalised" (post dated 14 Dec 2025 → effective 15 Dec 2025) — [Central Railway on X (search extract)](https://x.com/Central_Railway/status/2000229614631915588?lang=en); [ThePrint (search extract)](https://theprint.in/india/five-additional-pairs-of-local-trains-on-belapur-uran-corridor-from-dec-15/2805689/)

**Big-station platform facts (web)**
- CSMT has 18 platforms: 1–7 for suburban EMUs, 8–18 for long-distance trains; platforms 10–14 are being extended for 24-coach trains — [Wikivoyage CSMT (search extract)](https://en.wikivoyage.org/wiki/Chhatrapati_Shivaji_Maharaj_Terminus); [Chhatrapati Shivaji Terminus, Wikipedia (search extract)](https://en.wikipedia.org/wiki/Chhatrapati_Shivaji_Terminus); [FPJ, CSMT platform extension 70 % (search extract)](https://www.freepressjournal.in/mumbai/mumbai-iconic-csmt-stations-platform-extension-project-reaches-70-completion)
- The Harbour line uses two separate platforms at CSMT (numbers not given in the extract); OSM has Harbour on 1 (out) and 2 (in), slow on 3/4, fast on 5/6 — [Mumbai Suburban Railway (search extract)](https://en.wikipedia.org/wiki/Mumbai_Suburban_Railway); [OSM 8130328](https://www.openstreetmap.org/relation/8130328)
- Kurla: 8 platforms, 10 tracks; platforms 1, 1A and 4 serve slow locals, 5 and 6 fast locals, 7 and 8 the Harbour line — [Kurla railway station (search extract)](https://en.wikipedia.org/wiki/Kurla_railway_station). OSM agrees (slow 1/4, fast 5/6, Harbour 7/8).
- Dadar renumbering, effective 9 December 2023: Western Railway kept platforms 1–7 and Central Railway's platforms were renumbered to continue the sequence, 8–14 (ANI, FPJ) or 8–15 (MumbaiLive); the old Central platform 2 was closed permanently to widen platform 1; Wikipedia lists 14 platforms, 7 per railway — [FPJ (search extract)](https://www.freepressjournal.in/mumbai/mumbai-dadar-railway-station-to-implement-platform-renumbering-from-dec-9-for-enhanced-commuter-clarity); [MumbaiLive (search extract)](https://www.mumbailive.com/en/transport/mumbai-local-news-changes-in-platform-numbers-of-dadar-station-from-9th-december-2023-81905); [India Gazette (search extract)](https://www.indiagazette.com/news/274059982/dadar-central-railway-gets-new-platform-numbers); [Dadar railway station (search extract)](https://en.wikipedia.org/wiki/Dadar_railway_station). OSM's Dadar (Central) stop positions say slow 7 (down) / 9 (up) and fast 11 / 12 — the "7" conflicts with the 8–14 renumbering.
- Diva Junction has 13 tracks — [Diva Junction railway station (search extract)](https://en.wikipedia.org/wiki/Diva_Junction_railway_station)

**15-car capability**
- CR extended platforms at Byculla, Kurla, Ghatkopar, Bhandup, Mulund and Dombivli from 270 m to 330 m for 15-coach trains; the first 15-car service ran CSMT–Kalyan in October 2012 — [Central line (search extract)](https://en.wikipedia.org/wiki/Central_line_(Mumbai_Suburban_Railway))
- Platform extension under way at 27 of 34 stations, target December 2025, for 15-coach locals on both fast and slow lines; listed stations include Ambivli, Ambernath, Badlapur, Kalwa, Mumbra, Titwala, Ulhasnagar and Vasind — [FPJ (search extract)](https://www.freepressjournal.in/mumbai/good-news-for-central-line-commuters-number-of-15-coach-locals-to-increase-as-platform-expansion-work-nears-completion)
- CR began extending platforms 5 and 6 at CSMT (the fast-line platforms in OSM); phase two covers the Kasara line incl. Titwala and Asangaon — [Curly Tales (search extract)](https://curlytales.com/after-mumbra-tragedy-central-railway-to-expedite-car-mumbai-locals-to-handle-rising-passenger-load/)

### Inferences
- Platform lengths for the game: a 12-car rake needs about 270 m of platform and a 15-car rake about 330 m (from the extension figures above). The game's `trains.mjs` assumes 245 m for a 12-coach train; that fits inside 270 m.
- Within the current game map box (lat ≤ 19.140, lon ≤ 72.920) the in-map stations are: main line CSMT → Ghatkopar (Vikhroli and Kanjur Marg lie about 0.8 km east of the box edge); Harbour CSMT → Govandi (Mankhurd just outside); Goregaon branch → Andheri (Jogeshwari just outside). Trans-Harbour and Uran lines are entirely outside (as the comment in `scripts/lib/trains.mjs` already notes).
- Platform pattern to copy in the game: slow lines use the outer/west platform pair and fast lines the inner/east pair at four-track stations (CSMT 3/4 vs 5/6, Kurla 1/4 vs 5/6, Ghatkopar 1/2 vs 3/4, Thane 2/4 vs 5/6, Dombivli 2/3 vs 4/5); the Harbour has its own pair (CSMT 1/2, Kurla 7/8, upper deck at Sandhurst Road). "Down" (away from CSMT) generally takes the lower number of a pair.
- "Ranjanpada" in OSM and "Shematikhar/Shemtikhar" in Wikipedia are very likely the same station (the up-direction stop position in OSM is tagged "SEMK"). Inferred, not confirmed.

### Gaps
- Official Central Railway chainage (km) for every station could not be read (Wikipedia tables blocked; extracts gave only CSMT 0, Kurla 15, Kalwa 36, Mumbra 40, Kalyan 54–55). The OSM-measured values are the best complete set.
- Codes for the stations beyond the extract on the Kasara branch (Vasind, Asangaon, Atgaon, Khardi, Umbermali; commonly written VSD, ASO, ATG, KE, UBR) and the official code of Vadala Road (commonly VDLR) were not confirmed by any source found. Whether a station at Thansit (between Atgaon and Khardi) is open in 2026 was not found.
- OSM codes BMDR, KARP, RJNPD, NHVSV, DRNGR, UNCT, TRGHR, DIGH may be mappers' choices rather than official Indian Railways codes; not verified.
- Platform counts per station come mostly from OSM platform objects (an island platform counts once), not from an official list. Kalyan Junction's platform count and slow/fast assignment were not found (search quota exhausted); OSM's 1/1A for Kalyan-terminating trains looks stale.
- Which stations can take 15-car trains on the slow lines in November 2026 (after the 2025 extension programme) was not confirmed station by station.

## 2. Corridors: slow and fast lines, 5th/6th lines, the Harbour line's own tracks, where lines share or cross

### Takeaway
CSMT–Kalyan is a four-track corridor (a slow pair and a fast pair) with a 5th/6th pair from Kurla/LTT to Kalyan (which, by the launch coverage, gives fast locals a path of their own apart from long-distance trains) since the Thane–Diva section was dedicated (February 2022 — month from general knowledge, the extract only says the reports are several years old); CSMT–Kurla/Parel 5th/6th lines are still being built (Kurla's new elevated Harbour station is part of that work and had not opened by the latest reports). The Harbour line has its own two tracks throughout: beside the main line out of CSMT, up onto an elevated deck at Sandhurst Road–Dockyard Road–Sewri, splitting at Vadala Road into the Panvel branch (via Kurla's own platforms 7/8 and the Thane Creek bridge) and the Goregaon branch (into the Western line corridor at Mahim). All lines are 1,676 mm broad gauge, 25 kV AC overhead.

### Cited Findings
- All Central and Harbour routes in the extract are tagged `gauge=1676`, `electrified=contact_line`, `voltage=25000`, `frequency=50` — [OSM 11491271](https://www.openstreetmap.org/relation/11491271), [OSM 8130328](https://www.openstreetmap.org/relation/8130328), [OSM 11511942](https://www.openstreetmap.org/relation/11511942)
- Measured lengths [OSM]: slow route CSMT–Kalyan 53.7 km; fast route 51.5 km. The fast route includes 1.32 km in the "Parsik Tunnel" (`layer=-1`), and between Thane and Dombivli measures 13.0 km against 15.2 km on the slow route via Kalwa and Mumbra — [OSM fast 9953730](https://www.openstreetmap.org/relation/9953730), [slow 11491271](https://www.openstreetmap.org/relation/11491271)
- Bridges/viaducts measured [OSM]: Harbour Panvel route 3.55 km of bridge (incl. the elevated Dockyard Road section and the Thane Creek crossing Mankhurd–Vashi), 0.57 km tunnel; Goregaon branch 1.75 km of bridge; Trans-Harbour 1.33 km bridge and 0.57 km tunnel; Uran line 2.47 km bridge and 0.44 km tunnel — [OSM 8130328](https://www.openstreetmap.org/relation/8130328), [9623798](https://www.openstreetmap.org/relation/9623798), [11511942](https://www.openstreetmap.org/relation/11511942), [11512075](https://www.openstreetmap.org/relation/11512075)
- Harbour line runs parallel to the Central line until just before Sandhurst Road, then turns east and runs elevated up to Sewri — [Mumbai fandom, Harbour Line (search extract)](https://mumbai.fandom.com/wiki/Harbour_Line); [Harbour line (search extract)](https://en.wikipedia.org/wiki/Harbour_line_(Mumbai_Suburban_Railway))
- At Wadala Road the Harbour line splits into two corridors, one to Panvel and the other to Goregaon; the Goregaon branch enters Mahim Junction to join the Western line corridor and ends at Goregaon — [Harbour line (search extract)](https://en.wikipedia.org/wiki/Harbour_line_(Mumbai_Suburban_Railway)); [99acres (search extract)](https://www.99acres.com/articles/harbour-line-mumbai.html)
- Thane–Diva 5th and 6th lines: dedicated by the Prime Minister (reports several years old; February 2022 is not shown in the extract), about Rs 620 crore, include a 1.4 km rail flyover; launch coverage says they enable 36 new suburban services (34 AC + 2 non-AC, CSMT–Kalyan/Kasara), give "effective utilisation of 6 lines between Kurla/LTT and Kalyan", and that "fast local trains will then get a dedicated path and new platforms have been built at Kalwa and Mumbra" — [Swarajya (search extract)](https://swarajyamag.com/news-brief/pm-inaugurates-two-additional-rail-lines-connecting-thane-diva-and-34-new-air-conditioned-local-train-services-for-mumbai)
- Earlier 5th/6th segments: Kalyan–Diva commissioned 12 January 2014 and Diva–Mumbra 8 June 2015 (Wikipedia table, slow-line context in the extract) — [Central line (search extract)](https://en.wikipedia.org/wiki/Central_line_(Mumbai_Suburban_Railway))
- Kurla elevated Harbour station (part of the CSMT–Kurla 5th/6th line project): tracks between Kurla and Tilak Nagar were shifted westward in a 14.5-hour block; the new station will have three platforms — CSMT-bound, Navi Mumbai-bound, and a central dead-end platform for trains terminating at Kurla; all ground-level Harbour operations at Kurla will move up; Harbour trains run on this diversion until the 5th/6th lines reach Parel. A 2025 report said the project was still incomplete after 10 years. No opening date found — [FPJ (search extract)](https://www.freepressjournal.in/mumbai/mumbai-railway-update-kurla-to-get-elevated-harbour-line-station-as-5th-and-6th-line-project-picks-up-pace); [Construction World (search extract)](https://www.constructionworld.in/transport-infrastructure/metro-rail-and-railways-infrastructure/kurla-gets-new-elevated-harbour-line-station/78947); [Oneindia (search extract)](https://www.oneindia.com/mumbai/kurla-station-deck-update-incomplete-bridges-missing-links-endless-delays-4117857.html)
- Kalyan–Badlapur 3rd/4th lines: reported 21 % complete in one report and expected to be finished by December 2026 — [MumbaiLive (search extract)](https://www.mumbailive.com/en/transport/work-on-kalyan-badlapur-3rd-4th-railway-line-will-be-done-by-december-2026-82966); Kalyan–Asangaon 4th line: land acquisition under way (report about 800 days old) — [Sarkaritel (search extract)](https://www.sarkaritel.com/new-suburban-corridor-among-12-rail-projects-underway-in-mumbai/)
- Airoli–Kalwa elevated link (3.3 km; its purpose — Trans-Harbour trains towards Kalyan without reversing at Thane — is inferred, not in the extract): Digha Gaon station commissioned, land acquisition for the rest; one article expected Diva–Airoli first phase by January 2026; status unconfirmed — [Know Your Town (search extract)](https://knowyourtown.co.in/kalwa-airoli-elevated-rail-project-to-bring-relief-to-daily-commuters/)
- Panvel–Karjat suburban corridor (29.6 km, Rs 2,782 crore): 85 % complete as of June 2026 with trial runs expected October–December 2026; not yet open as of July 2026 — [Mumbai Suburban Railway (search extract)](https://en.wikipedia.org/wiki/Mumbai_Suburban_Railway); [Panvel railway station (search extract)](https://en.wikipedia.org/wiki/Panvel_railway_station); [The Week, March 2026 (search extract)](https://www.theweek.in/news/biz-tech/2026/03/14/mumbai-local-train-network-upgrade.html)
- Goregaon–Borivali Harbour extension (7 km, Rs 826 crore): Wikipedia targets March 2028 (to Malad) and December 2028 (to Borivali); Western Railway earlier said 2026-27 for the first 2 km to Malad; an Rs 86.51-crore civil tender under MUTP-3A was floated — [Mumbai Suburban Railway (search extract)](https://en.wikipedia.org/wiki/Mumbai_Suburban_Railway); [Oneindia (search extract)](https://www.oneindia.com/mumbai/goregaon-borivli-harbour-line-phase-1-stretch-to-open-by-2026-27-says-western-railway-4027979.html); [FPJ tender (search extract)](https://www.freepressjournal.in/mumbai/mumbai-local-harbour-line-extension-moves-ahead-western-railway-floats-87-crore-tender-amid-land-acquisition-challenges)
- The Week (March 2026) frames the network upgrade as a Rs 52,000 crore plan, including the Panvel–Karjat corridor and the Goregaon–Borivali extension — [The Week (search extract)](https://www.theweek.in/news/biz-tech/2026/03/14/mumbai-local-train-network-upgrade.html)

### Inferences
- For the game (CSMT–Ghatkopar inside the map): model four main-line tracks (slow pair west, fast pair east at most stations) plus two Harbour tracks running alongside from CSMT to just before Sandhurst Road, then climbing to the upper deck there and swinging east (elevated Dockyard Road) to Sewri and Vadala Road; at Vadala Road a branch leaves north-west via King's Circle to Mahim. Harbour and main line meet again at Kurla (Harbour platforms 7/8 on the east side) — ground level in November 2026, as no source reports the elevated station open.
- The OSM fast route through the Parsik tunnel conflicts with the 2022 statement that fast locals get "new platforms at Kalwa and Mumbra"; either the OSM route is out of date or only some fast trains use the new lines. Unresolved; it does not affect the in-map section.
- No new track is expected to open inside the current game map in 2026 (Kurla elevated Harbour station and CSMT–Kurla 5th/6th lines still under construction per the latest reports found).

### Gaps
- Exact November 2026 status of the Kurla elevated Harbour station, the CSMT–Kurla/Parel 5th/6th lines, the Airoli–Kalwa link and the Kalyan–Badlapur 3rd/4th lines (none confirmed open).
- Where exactly the Harbour line crosses the main line around Kurla (flyover or level), and the track layout at Vadala Road junction, were not found; OSM geometry could answer this in a later pass.
- Official maximum speeds: no OSM `maxspeed` tags on any of these routes and no web figure found.

## 3. Stopping patterns: fast and semi-fast trains, Kasara/Karjat/Khopoli trains, "double fast"

### Takeaway
Slow locals stop everywhere; Harbour, Trans-Harbour and Uran trains are all slow (stop everywhere). Main-line fast locals run CSMT → Byculla → Dadar → Kurla → Ghatkopar → Thane → (Diva) → Dombivli → Kalyan, with some trains also calling at Vikhroli, Bhandup and Mulund (mostly at peaks). Beyond Kalyan, trains to Kasara, Karjat and Khopoli normally stop at all stations; some "semi-fast" trains exist. No source for a "double fast" pattern was found.

### Cited Findings
- "Slow locals halt at every station, while fast locals halts vary between Byculla, Dadar, Kurla, Ghatkopar, Vikhroli, Bhandup, Mulund, Thane, Diva, Dombivli and Kalyan Junction"; trains beyond Kalyan run as slow trains and stop at every station — [Central line (search extract)](https://en.wikipedia.org/wiki/Central_line_(Mumbai_Suburban_Railway)); [Mumbai Suburban Railway (search extract)](https://en.wikipedia.org/wiki/Mumbai_Suburban_Railway)
- A few fast trains stop at Bhandup, mostly during peak hours — [Bhandup (search extract)](https://en.wikipedia.org/wiki/Bhandup)
- The OSM fast routes (CSMT–Kalyan, –Kasara, –Khopoli) stop at CSMT, Byculla, Dadar, Kurla, Ghatkopar, Thane, Dombivli and Kalyan only — [OSM 9953730](https://www.openstreetmap.org/relation/9953730); [11514142](https://www.openstreetmap.org/relation/11514142); [11514143](https://www.openstreetmap.org/relation/11514143)
- Conflict: a route-planner site says Byculla and Diva are not fast stops on the routes it checked; a Dwello guide lists Dadar, Kurla, Ghatkopar and Thane as the fast stops — [mumbaimetroroute Thane–Byculla (search extract)](https://mumbaimetroroute.com/mumbai-local-train/routes/thane-to-byculla); [mumbaimetroroute Byculla–Diva (search extract)](https://mumbaimetroroute.com/mumbai-local-train/routes/byculla-to-diva); [Dwello (search extract)](https://dwello.in/news/mumbai-local-central-line-route-map-stations-fare)
- On block days fast/semi-fast trains are given extra halts at Kalwa, Mumbra and Diva ("trains will halt at Kalwa, Mumbra, and Diva stations in addition to their scheduled halts"; another notice: "halt at Thane, Kalwa, Mumbra, Diva and Dombivli … around 10 minutes behind schedule") — [Lokmat Times, 7 July 2024 block (search extract)](https://www.lokmattimes.com/mumbai/mumbai-mega-block-on-july-07-2024-local-train-services-to-be-affected-on-central-and-harbour-lines-on-sunday-check-details-a505/); [Lokmat Times, March 16 block (search extract)](https://www.lokmattimes.com/mumbai/mumbai-local-train-update-central-railway-announces-mega-block-on-march-16-a525/)
- Semi-fast example: train 95417 CSMT–Kasara "semi fast" is listed as passing Dombivli and Thakurli, reaching Kalyan at 18:06, then Titwala, Asangaon and the remaining stations to Kasara; go4mumbai's Kalyan board shows services marked "SEMI" (one to Asangaon) and a Karjat semi-fast; "Fast trains may stop" at Titwala — [RailYatri 95417 (search extract)](https://www.railyatri.in/time-table/95417); [go4mumbai Kalyan (search extract)](https://go4mumbai.com/stationinfo.php?stationid=kalyan); [go4mumbai Titwala (search extract)](https://go4mumbai.com/stationinfo.php?stationid=titwala); [erail 95409 CSTM–KSRA FAST (search extract)](https://erail.in/train-enquiry/95409)
- Kurla–Badlapur fast BL11 (95211): 8 halts, 1 h 01 min — [indiarailinfo BL11 (search extract)](https://d.indiarailinfo.com/train/-train-bl11-mumbai-csmt-badlapur-fast-local-95211/20559/6740/3154)
- All Harbour line services are slow (stop at all stations) — [Harbour line (search extract)](https://en.wikipedia.org/wiki/Harbour_line_(Mumbai_Suburban_Railway)); [indiarailinfo CSMT–Goregaon (search extract)](https://indiarailinfo.com/train/-train-mumbai-csmt-goregaon-slow-local-91393/18730/12282/8165)
- Karjat–Khopoli is worked largely by shuttles ("SKP" trains, e.g. 96007 SKP5 and 96017 SKP15 Karjat–Khopoli slow locals) besides through CSMT–Khopoli trains (e.g. KP6, 95006, Khopoli–CSMT fast) — [ixigo 96007 (search extract)](https://www.ixigo.com/trains/96007); [ixigo 96017 (search extract)](https://www.ixigo.com/trains/96017); [indiarailinfo KP6 (search extract)](https://indiarailinfo.com/train/-train-kp6-khopoli-mumbai-csmt-fast-local-95004a/75276/73/12282)
- A "CST–Panvel fast corridor" (a fast Harbour route) exists only as a proposal page; in it the existing Harbour journey CSMT–Panvel is quoted as 150 minutes (proposal-era figure, contradicted by today's timetables of about 80 minutes) — [CST–Panvel fast corridor (search extract)](https://en.wikipedia.org/wiki/CST%E2%80%93Panvel_fast_corridor)

### Inferences
- A game-ready default: main-line fast pattern = CSMT, Byculla, Dadar, Kurla, Ghatkopar, Thane, Dombivli, Kalyan (the OSM pattern), with some peak fast trains adding Vikhroli, Bhandup or Mulund and a few adding Diva (the share is a design choice; no source gives it). Inside the current map only the CSMT–Byculla–Dadar–Kurla–Ghatkopar part matters: fast trains skip Masjid, Sandhurst Road, Chinchpokli, Currey Road, Parel, Matunga, Sion and Vidyavihar.
- Kasara, Karjat, Khopoli, Badlapur, Ambernath and Titwala trains from CSMT are mostly fast to Kalyan and slow beyond; "semi-fast" trains add some intermediate stops (e.g. Dombivli–Thakurli–Kalyan, or skip some stops beyond Kalyan).

### Gaps
- No source was found for a "double fast" service on Central/Harbour. (It is a Western-line term in common speech; not verified here.)
- The exact list of fast trains that stop at Vikhroli, Bhandup, Mulund, Diva, Kalwa or Mumbra in the November 2026 timetable was not found.
- Whether Kalwa and Mumbra are now regular fast halts (after the 2022 5th/6th lines) is not confirmed.

## 4. Service numbers, AC and 15-car services, first and last trains, headways, run times and speeds

### Takeaway
Central Railway runs about 1,820 suburban services each weekday (all four lines together). Since 29 June 2026 there are 120 weekday AC services (92 main line, 28 Harbour); 15-car services rose from 32 to 54 on 15 August 2026. The Harbour line runs about 608 services; Trans-Harbour about 252 (December 2021); the Uran line 50 (since 15 December 2025). Typical run times: CSMT–Kalyan about 88–90 min slow and about 60 min fast; CSMT–Panvel about 80 min; CSMT–Goregaon about 55 min; Thane–Vashi about 29 min. Last trains leave CSMT shortly after midnight (Kasara 00:08, Karjat 00:12 in the timetable from 5 October 2024).

### Cited Findings
**Totals and AC**
- Total weekday suburban services on Central Railway: 1,820 (June 2026); one April item gives 1,810 — [FPJ, 12 services converted to AC from 29 June 2026 (search extract)](https://www.freepressjournal.in/mumbai/central-railway-converts-12-non-ac-local-services-into-ac-trains-from-june-29); [The Week, March 2026: "Central Railway's own data shows 1,820 suburban services a day" (search extract)](https://www.theweek.in/news/biz-tech/2026/03/14/mumbai-local-train-network-upgrade.html)
- From 29 June 2026, 12 non-AC main-line services became AC, taking CR to 120 AC services: 92 main line, 28 Harbour; the converted services run with non-AC rakes on Sundays and notified holidays; conversions replace non-AC trains, so the total stays 1,820 — [Gujarat Samachar (search extract)](https://english.gujaratsamachar.com/news/mumbai/mumbai-central-railway-increases-ac-local-services-to-120-with-12-new-trains-69201823551); [Aryan Age (search extract)](https://www.aryanage.com/article/39736/central-railway-expands-ac-local-services-in-mumbai-converts-12); [Travel And Tour World (search extract)](https://www.travelandtourworld.com/news/article/l1qnag3mgs96/)
- AC timeline 2026: Harbour AC locals resumed 26 January 2026 with 14 trips a day (replacing non-AC trains); main line went from 66 to 80 AC services on 16 April 2026 (+14); Harbour +14 from 1 May 2026 (table: Harbour 28, Main 80, total 108); +12 main line on 29 June → 120 — [Swarajya (search extract)](https://swarajyamag.com/news-brief/central-railway-to-introduce-14-new-ac-local-trains-on-mumbais-harbour-line-from-26-january); [Lokshahi (search extract)](https://english.lokshahi.com/maharashtra/big-relief-for-mumbai-commuters-harbour-line-ac-local-services-resume-from-january-26-with-14-daily-trips); [Deccan Herald, 14 main-line AC (search extract)](https://www.deccanherald.com/india/maharashtra/central-railway-adds-14-ac-local-train-services-on-mumbai-main-line-3492282); [HelloRail (search extract)](https://hellorail.in/news/mumbai-local-harbour-line-new-ac-trains-update/). One search summary said January 2026 brought the total to "94 (80 main + 14 Harbour)", which conflicts with the 66 → 80 main-line step in April; treated as an error.
- The last Harbour AC local of the day leaves CSMT at 20:00 (January 2026) — [Swarajya (search extract)](https://swarajyamag.com/news-brief/central-railway-to-introduce-14-new-ac-local-trains-on-mumbais-harbour-line-from-26-january)
- Harbour AC services carried about 40,017 passengers a day in their first phase (26 Jan–10 Feb 2026) — [FPJ, AC ridership surge (search extract)](https://www.freepressjournal.in/mumbai/central-railway-ac-locals-see-ridership-surge-commuters-demand-more-services)
- An earlier Trans-Harbour AC local had few riders (2020) — [PressReader/FPJ 2020 (search extract)](https://www.pressreader.com/india/the-free-press-journal/20200213/281685436852546)

**15-car**
- From 15 August 2026, 22 more main-line services upgraded from 12-car to 15-car, raising CR's 15-car services from 32 to 54 — [FPJ (search extract)](https://www.freepressjournal.in/mumbai/central-railway-to-add-22-more-15-coach-locals-from-august-15-to-ease-main-line-crowding); [TrainHelp news (search extract)](https://www.trainhelp.in/mumbai-local-train-news/)
- From 20 July 2026, 10 services moved to 15-car rakes, e.g. A11 CSMT → Ambernath dep. 09:15 and S48 Karjat → CSMT dep. 20:38 — [Railways Yearbook (search extract)](https://railwaysyearbook.in/mumbai-central-railway-to-add-10-new-15-car-local-train-services-from-july-20-2026/); [go4mumbai 15-car list (search extract)](https://go4mumbai.com/15car_cr_train.php)
- All Central line services have run as 12-car trains since November 2011 (15-car being the exception) — [Central line (search extract)](https://en.wikipedia.org/wiki/Central_line_(Mumbai_Suburban_Railway))
- Before the 2026 additions CR ran only 22 services with 15-car rakes (article from mid-2025) — [Curly Tales (search extract)](https://curlytales.com/after-mumbra-tragedy-central-railway-to-expedite-car-mumbai-locals-to-handle-rising-passenger-load/)

**Per line**
- Harbour line: about 608 services a day; daily ridership about 1 million (undated) — [Harbour line (search extract)](https://en.wikipedia.org/wiki/Harbour_line_(Mumbai_Suburban_Railway))
- Trans-Harbour: 252 services in both directions as of December 2021; an older FPJ article gave 292 trains on Thane–Vashi and Thane–Panvel, incl. 120 round trips Thane–Vashi — [Trans-Harbour line (search extract)](https://en.wikipedia.org/wiki/Trans-Harbour_line_(Mumbai_Suburban_Railway)); [FPJ Digha article (search extract)](https://www.freepressjournal.in/mumbai/navi-mumbai-digha-station-on-trans-harbour-line-to-be-ready-by-year-end)
- Uran line: 40 → 50 services from 15 December 2025 (Nerul–Uran–Nerul 4, Belapur–Uran–Belapur 6 added); first/last: from Uran 05:35 / 22:05, from Belapur 05:45 / 22:15, from Nerul 06:05 / 21:30; between about 10:30 and 17:30 intervals of up to 1.5 hours; ridership +12 % in 2025; no direct Uran–CSMT/Thane/Panvel trains yet — [ThePrint (search extract)](https://theprint.in/india/five-additional-pairs-of-local-trains-on-belapur-uran-corridor-from-dec-15/2805689/); [Daily Jagran (search extract)](https://www.thedailyjagran.com/maharashtra/mumbai-news-belapur-uran-suburban-line-gets-additional-trains-ahead-of-navi-mumbai-airport-opening-10286286); [FPJ (search extract)](https://www.freepressjournal.in/mumbai/special-gift-for-mumbaikars-maha-cm-devendra-fadnavis-after-10-new-local-train-services-approved-between-nerul-belapur-uran); [Newsband (search extract)](https://www.newsband.in/article_detail/urannerulbelapur-rail-line-sees-12-rise-in-passenger-traffic)

**Ridership**
- On 5 January 2026 Central Railway carried 72.18 lakh (7.218 million) commuters (busiest day); the whole network about 93 lakh on a typical working day per The Week — [The Week (search extract)](https://www.theweek.in/news/biz-tech/2026/03/14/mumbai-local-train-network-upgrade.html)
- Whole Mumbai Suburban Railway 61.95 lakh a day (2022–23); Central line 3.9 million a day (undated) — [Mumbai Suburban Railway (search extract)](https://en.wikipedia.org/wiki/Mumbai_Suburban_Railway); [Central line (search extract)](https://en.wikipedia.org/wiki/Central_line_(Mumbai_Suburban_Railway))

**Run times and speeds (timetable listings; fan-maintained, dates vary)**

| Run | Time | Distance, halts, speed | Source |
|---|---|---|---|
| CSMT → Kalyan slow (K63 / 97073) | 1 h 28 min | 54 km, average 37 km/h | [indiarailinfo K63 (search extract)](https://d.indiarailinfo.com/train/20608) |
| CSMT → Kalyan slow (K113 / 97143) | 1 h 30 min | 54 km, 24 halts | [Travelkhana 97143 (search extract)](https://www.travelkhana.com/travelkhana/utilities/train-stations/97143) |
| CSMT → Kalyan fast 15-car (K11) | 07:25 → 08:25 (60 min) | — | indiarailinfo results for CSMT–Kalyan locals (search extract; exact page not identified, e.g. [K17 page](https://indiarailinfo.com/train/timetable/k17-mumbai-csmt-kalyan-slow-local-97027/20592/12282/72)) |
| Kurla → Badlapur fast (BL11 / 95211) | 1 h 01 min | 8 halts | [indiarailinfo BL11 (search extract)](https://d.indiarailinfo.com/train/-train-bl11-mumbai-csmt-badlapur-fast-local-95211/20559/6740/3154) |
| Dadar → Badlapur fast (BL37 / 95235) | 18:53 → 20:01 (68 min) | — | [indiarailinfo BL37 (search extract)](https://indiarailinfo.com/train/timetable/all/57120/712/3154) |
| CSMT → Karjat fast (S5 / 95101 and others) | 1 h 56 min – 1 h 58 min | about 98 km | [Travelkhana 95101 (search extract)](https://www.travelkhana.com/travelkhana/utilities/train-stations/95101) |
| CSMT → Khopoli | 2 h 45 min (slow listing) | — | [indiarailinfo CSMT–Khopoli (search extract)](https://indiarailinfo.com/search/csmt-mumbai-csm-terminus-to-khpi-khopoli/12282/0/8356) |
| Karjat → Khopoli | 13 min (route guide) vs 25 min (timetable listing) | — | [mumbaimetroroute (search extract)](https://mumbaimetroroute.com/mumbai-local-train/routes/karjat-to-khopoli); [ixigo 96017 (search extract)](https://www.ixigo.com/trains/96017) |
| CSMT → Panvel (98027) | 06:00 → 07:20 (1 h 20 min) | 49 km, 23 halts, 36 km/h | [indiarailinfo 98027 (search extract)](https://indiarailinfo.com/train/timetable/mumbai-csmt-panvel-slow-local-98027/15637/12282/1250) |
| CSMT → Panvel (98251; 98001) | 22:50 → 00:10; 00:13 → 01:33 | 49 km, 23 halts | [98251 (search extract)](https://indiarailinfo.com/train/timetable/mumbai-csmt-panvel-slow-local-98251/165898/12282/1250); [98001 (search extract)](https://indiarailinfo.com/train/timetable/mumbai-csmt-panvel-slow-local-98001/15744/12282/1250) |
| Panvel → CSMT (98002) | 00:03 → 01:20 (1 h 17 min) | 49 km, 23 halts, 38 km/h | [indiarailinfo 98002 (search extract)](https://indiarailinfo.com/train/timetable/panvel-mumbai-csmt-slow-local-98002/17059/1250/12282) |
| CSMT → Goregaon (91393; 98755; 98759; 98751) | 53–56 min (e.g. 98759 17:37 → 18:31; 98751 15:48 → 16:43) | 26 km, 16 halts | [indiarailinfo 91393 (search extract)](https://indiarailinfo.com/train/-train-mumbai-csmt-goregaon-slow-local-91393/18730/12282/8165); [98759 (search extract)](https://indiarailinfo.com/train/blog/mumbai-csmt-goregaon-ac-slow-local-98759/18742/12282/8165); [Travelkhana 98755 (search extract)](https://www.travelkhana.com/travelkhana/utilities/train-stations/98755); [ixigo 98751 (search extract)](https://www.ixigo.com/trains/98751) |
| Vashi → Thane (99500) | 29 min | 18 km, 6 halts | [indiarailinfo 99500 (search extract)](https://indiarailinfo.com/train/-train-vashi-thane-slow-local-99500/19232/9362/467) |
| Vashi → Panvel (98017) | 06:11 → 06:42 (31 min) | 19 km, 8 halts | [indiarailinfo 98017 (search extract)](https://indiarailinfo.com/train/timetable/vashi-panvel-slow-local-98017/15963/9362/1250) |
| Kharghar → Vashi (98226) | 19 min | 11 km, 5 halts | [indiarailinfo 98226 (search extract)](https://indiarailinfo.com/train/-train-panvel-vashi-slow-local-98226/69061/8345/9362) |

**First and last trains**
- From 5 October (2024 timetable; the report is about 770 days old), the last CSMT–Kasara local leaves at 00:08 and the last CSMT–Karjat local at 00:12 (previously 00:24 to Karjat); passengers objected to the earlier timings — [Mumbai Press (search extract)](https://mumbaipress.com/mumbai-local-train-update-central-railways-new-timetable-comes-into-effect-check-full-list-of-revised-timings-stations/); [FPJ, timetable from October 5 (search extract)](https://www.freepressjournal.in/mumbai/mumbai-central-railway-announces-new-suburban-train-timetable-from-october-5-check-timings-last-train-departure-platform-shift-details-here); [MumbaiLive (search extract)](https://www.mumbailive.com/en/transport/mumbai-cr-reschedules-last-kasara-karjat-local-timings-upset-passengers-86068)
- First train from Karjat departs at 02:30; a Karjat station page lists first trains at 03:35 and 05:43 (directions unclear) — [FPJ, CR clarifies on new timetable (search extract)](https://www.freepressjournal.in/mumbai/central-railway-clarifies-on-new-timetable); [Mumbai Lifeline, Karjat (search extract)](https://www.mumbailifeline.com/station/central/karjat)
- Night trains seen in listings: Kalyan → Karjat slow 01:41 → 02:33; Kurla → Karjat 01:06 → 02:57 (aggregator); earliest CSMT → Karjat fast found 05:46 — [indiarailinfo S1 96101 (search extract)](https://indiarailinfo.com/train/timetable/s1-mumbai-csmt-karjat-slow-local-96101/18651/72/73); [metrotraintimings (search extract)](https://www.metrotraintimings.in/Mumbai/Local-Train-Timetable-from-Kurla-to-Karjat-00:00-24:00.htm); [Travelkhana 95101 (search extract)](https://www.travelkhana.com/travelkhana/utilities/train-stations/95101)
- Harbour: aggregators give first CSMT departure about 04:30 and last about 00:30; first from Panvel 04:15, last 00:45; erail lists a 00:13 CSMT–Panvel (matches 98001 above) — [MumbaiLocal.Info Harbour (search extract)](https://mumbaimetro.info/local-trains/harbour); [MumbaiLocal.Info Harbour timetable (search extract)](https://mumbaimetro.info/local-trains/harbour/timetable); [erail CSMT–Panvel (search extract)](https://erail.in/trains-between-stations/c-shivaji-maharaj-t-CSMT/panvel-PNVL)

**Headways**
- Harbour peak frequency: "every 3–4 min" in one guide vs "8–10 min (peak)" in another — [MumbaiLocal.Info Harbour (search extract)](https://mumbaimetro.info/local-trains/harbour); [mumbaimetroroute Harbour (search extract)](https://mumbaimetroroute.com/mumbai-local-train/lines/harbour)

### Inferences
- Average speeds for the game: slow trains about 36–37 km/h including stops (Kalyan 54 km in 88–90 min; Panvel 49 km in 77–80 min; Goregaon 26 km in 53–56 min, i.e. about 28–29 km/h on the denser Goregaon branch); fast trains about 54 km/h (CSMT–Kalyan in 60 min) to about 50 km/h (Karjat 98 km in 116–118 min). Station-to-station that means about 3.5 min per hop on the main-line slow route (54 km, 25 hops, 88 min), dwell included (the dwell itself was not found in a source).
- Rough headways from service totals: 1,820 weekday CR services minus about 608 Harbour, 252 Trans-Harbour and 50 Uran leaves about 900 main-line services (both directions, all branches) — roughly 450 per direction over about 20 hours, i.e. an average of one train per direction every ~2.7 min, denser at peaks. (Inferred; the services per line are from different years.)
- AC trains: about 92 of ~900 main-line services (≈10 %) and 28 of ~608 Harbour services (≈5 %) are AC on weekdays, and none on Sundays (converted services revert to non-AC rakes). 15-car trains: 54 of ~900 main-line services (≈6 %), all on the main line.
- Night gap: last CSMT departures around 00:08–00:15 and first around 04:00–04:30 give a 3½–4 hour no-train window at CSMT (first-train time not confirmed).

### Gaps
- The exact first train from CSMT on the main line (often quoted as about 04:00) was not confirmed by any source found.
- Peak headway on the main line (slow and fast) and the current Trans-Harbour and Harbour service counts for 2026 were not found.
- No official maximum speed for the EMUs or the line found (OSM has no `maxspeed` on these routes).
- Number of rakes, rake types (e.g. Bombardier/Medha/ICF) and 12-car coach composition (first class, ladies, luggage, senior citizens) not searched (quota exhausted).

## 5. Platform indicator conventions: destination letters, train codes, slow/fast markers

### Takeaway
Mumbai platform indicators traditionally show the destination as a one- or two-letter code (not the official station code): on Central/Harbour T = Thane, K = Kalyan, A = Ambernath, S = Karjat (south branch), N = Kasara (north branch), and CSMT = "ST"; Harbour codes include PL for Panvel, BR for CBD Belapur, V/VA for Vashi, M for Mankhurd. Timetable train names repeat these letters as prefixes with a running number (K17, BL11, S5, KP6, A11, S48), and five-digit numbers starting with 9 identify each EMU service. LED boards increasingly show full names.

### Cited Findings
- Platform indicator codes on Central/Harbour: A – Ambernath, K – Kalyan, N – Kasara, S – Karjat, T – Thane — [Mumbai Trains blog, "Reading indicators at Mumbai local train platforms" (2009) (search extract)](https://mumbai-trains.blogspot.com/2009/12/reading-indicators-at-mumbai-local.html?m=1); [Mumbai77, station short codes as seen on train indicators (search extract)](https://www.mumbai77.com/city/7062/travel/mumbai-railway-stations-short-codes/)
- CSMT, CST and VT all share the indicator code "ST"; some stations have more than one code (e.g. "A" and "AD" for Andheri); not every station has a code — a missing code usually means no locals start or end there; the Mumbai77 list covers Western, Central, Harbour, Trans-Harbour and Vasai–Diva routes — [Mumbai77 (search extract)](https://www.mumbai77.com/city/7062/travel/mumbai-railway-stations-short-codes/)
- Kasara is "N" and Karjat "S" because the lines branch north and south from Kalyan (blog comment) — [Mumbai Trains blog (search extract)](http://mumbai-trains.blogspot.com/2009/12/reading-indicators-at-mumbai-local.html)
- Panvel shows as "PL" (a reader says "PN" between Andheri and Mahim); "P" alone is rejected for Panvel by a 2010 comment; Wikipedia's Harbour table gives PL/PNVL, BR/BEPR (CBD Belapur), VA/VSH (Vashi), M/MNKD (Mankhurd) — [Mumbai Trains blog (search extract)](http://mumbai-trains.blogspot.com/2009/12/reading-indicators-at-mumbai-local.html); [Harbour line (search extract)](https://en.wikipedia.org/wiki/Harbour_line); [TripHippies (search extract)](https://www.triphippies.com/mumbai-local-train-map/)
- IRFCA: these special destination codes on suburban indicators are not official station codes but 1- or 2-letter mnemonics, and are falling out of use as LED boards show full names — [IRFCA FAQ, stations (search extract)](https://irfca.org/faq/faq-station.html)
- Train numbers: Mumbai-area EMUs have five-digit numbers starting with 9; before 2011 suburban services used 1–3 digit numbers, sometimes with letter prefixes/suffixes — [IRFCA FAQ, train numbers (search extract)](https://irfca.org/faq/faq-number.html); [Train numbering in India (search extract)](https://en.wikipedia.org/wiki/Train_numbering_in_India)
- Train code + number pairs seen in listings (Central): K17 / 97027 and K63 / 97073 CSMT–Kalyan slow; K85 / 97107; K127 / 97159; BL5 / 95205, BL7 / 95207, BL10 / 95204, BL11 / 95211, BL17 / 95217, BL35 / 95233, BL37 / 95235, BL48 / 95232, BL53 / 95241 (CSMT–Badlapur fast; odd numbers away from CSMT, even towards it); S5 / 95101 and S-17 / 95111 CSMT–Karjat fast; S1 / 96101 CSMT–Karjat slow; KP6 / 95006 Khopoli–CSMT fast; SKP5 / 96007 and SKP15 / 96017 Karjat–Khopoli; "N" 96402 (Kasara); A11 CSMT–Ambernath; S48 Karjat–CSMT — [indiarailinfo BL listings (search extract)](https://indiarailinfo.com/train/timetable/bl53-mumbai-csmt-badlapur-fast-local-95241/75570/12282/3154); [indiarailinfo BL48 (search extract)](https://m.indiarailinfo.com/train/-train-bl48-badlapur-mumbai-csmt-fast-local-95212/17365/3154/12282); [indiarailinfo K17 (search extract)](https://indiarailinfo.com/train/timetable/k17-mumbai-csmt-kalyan-slow-local-97027/20592/12282/72); [Travelkhana 97107 (search extract)](https://www.travelkhana.com/travelkhana/utilities/train-stations/97107); [Travelkhana 97159 (search extract)](https://www.travelkhana.com/travelkhana/utilities/train-stations/97159); [indiarailinfo S-17 (search extract)](https://d.indiarailinfo.com/train/timetable/18655/6740/73); [erail 96402 (search extract)](https://erail.in/train-enquiry/96402); [Railways Yearbook (search extract)](https://railwaysyearbook.in/mumbai-central-railway-to-add-10-new-15-car-local-train-services-from-july-20-2026/)
- Harbour and Trans-Harbour numbers: 98xxx (98001/98027/98251 CSMT → Panvel, 98002 Panvel → CSMT, 98017 Vashi → Panvel, 98226 Panvel → Vashi, 98751–98760 CSMT ↔ Goregaon), 91393 CSMT → Goregaon (a Western Railway-numbered Harbour train), 99500 Vashi → Thane — listings cited in §4

### Inferences
- A game indicator can use: train code (e.g. "K", "BL", "S", "N", "KP", "A", "T", "PL", "BR", "V", "M", "AD"), destination name, "S"/"F" for slow/fast, car count "12"/"15", and the departure time — the code-letter scheme above is sourced; the "S/F" and car-count markers follow the common Mumbai board layout but were not confirmed in a source this session.
- Numbering logic for generating plausible train numbers: 95xxx = main-line fast/through services (Karjat, Badlapur, Khopoli), 96xxx = slow beyond-Kalyan (Karjat, Kasara, Khopoli shuttles), 97xxx = CSMT–Kalyan slow, 98xxx = Harbour, 99xxx = Trans-Harbour; odd = away from CSMT, even = towards it. Inferred from the examples above, not from an official rule.

### Gaps
- The full Mumbai77 code table (all stations) could not be read; codes for Titwala, Dombivli, Badlapur on indicators, Goregaon/Andheri on the Harbour, and Trans-Harbour destinations (Nerul, Belapur, Panvel from Thane) remain unconfirmed beyond the letters above.
- Whether the indicator letters "BL" (Badlapur), "TL" (Titwala), "KP" (Khopoli), "D" (Dombivli) appear on boards (as opposed to train names) is unconfirmed.

## 6. Sunday mega blocks, disruptions and harmless flavour

### Takeaway
Almost every Sunday Central Railway takes one main-line section and one Harbour section out for maintenance from about 11:00 to 16:00: slow trains are diverted onto the fast lines (or vice versa) and run about 15 minutes late, and parts of the Harbour line are cut with special shuttle services. In the monsoon the classic trouble spots are Sion–Kurla and Chunabhatti–Kurla (Mithi river), plus Vikhroli–Kanjurmarg and Kurla–Tilak Nagar; CR has put in 210 heavy pumps.

### Cited Findings
- Sunday 8 November 2026: block on up and down slow lines Matunga–Mulund 11:05–15:55; down slow locals leaving CSMT 10:14–15:32 diverted to the down fast line and up slow locals from Thane 11:07–15:51 to the up fast line, both about 15 min late; Harbour Kurla–Vashi (or Panvel–Vashi) 11:10–16:10 (one outlet: 16:40); some CSMT–Vashi and Belapur–Panvel trains cancelled; specials CSMT–Kurla and Panvel–Vashi — [Newsband (search extract)](https://www.newsband.in/article_detail/central-railway-to-operate-mega-block-on-main-and-harbour-lines-on-sunday); [Lokshahi (search extract)](https://english.lokshahi.com/maharashtra/mumbai-local-alert-mega-block-on-central-railway-this-sunday-multiple-trains-cancelled-check-updated-timings-passengers-advised-to-plan-travel-ahead-11867791); [Indian Opinion (search extract)](https://indianopinion.org/central-railway-mega-block-on-main-harbour-lines-on-sunday/); [FPJ (search extract)](https://www.freepressjournal.in/mumbai/mumbai-local-train-update-central-harbour-lines-to-face-mega-block-tomorrow-several-services-cancelled-check-details-mumbai-news)
- Sunday 25 October 2026: block on up and down fast lines 11:05–15:45; up fast services leaving Thane 11:03–15:38 diverted to the up slow line at Mulund; about 15 min delays — [Lokmat Times (search extract)](https://www.lokmattimes.com/mumbai/mumbai-local-train-mega-block-on-october-25-2026-services-on-central-harbour-and-western-lines-to-be-disrupted-on-sunday-check-details-a517/amp/)
- During Harbour blocks, Trans-Harbour services keep running Thane–Vashi/Nerul; a Chhath Puja block covered Thane–Kalyan and Panvel–Vashi — [FPJ, Chhath Puja block (search extract)](https://freepressjournal.in/mumbai/mumbai-local-train-update-central-railway-announces-mega-block-on-thane-kalyan-panvel-vashi-routes-on-chhath-puja-check-timings-mumbai-news)
- Blocks are sometimes cancelled for big events (a 4 May mega block cancelled for NEET exam candidates) — [Careers360 (search extract)](https://news.careers360.com/central-railway-cancels-may-4-mega-block-for-neet-aspirants-convenience/amp)
- Long special blocks happen: a 63-hour mega block (services hit the day after), a 14.5-hour block Kurla–Tilak Nagar for the Kurla Harbour track shift, a Diva–Thane block (5th/6th line works) — [Deccan Herald (search extract)](https://www.deccanherald.com/amp/story/india/maharashtra/day-after-63-hour-mega-block-local-train-services-hit-on-central-railway-3049917); [FPJ Kurla elevated (search extract)](https://www.freepressjournal.in/mumbai/mumbai-railway-update-kurla-to-get-elevated-harbour-line-station-as-5th-and-6th-line-project-picks-up-pace); [FPJ Diva–Thane block (search extract)](https://www.freepressjournal.in/mumbai/diva-thane-block-central-railway-to-operate-almost-all-scheduled-local-trains-on-monday)
- Western Railway usually does night blocks instead of Sunday day blocks (same weekend reports) — [Newsband, "CR mega block on Sunday, WR to conduct night block" (search extract)](https://www.newsband.in/article_detail/cr-mega-block-on-sunday-wr-to-conduct-night-block)
- Monsoon 2026 preparation: 18 major flood-prone sites identified; works at 6 critical locations done incl. Sion–Kurla, Chunabhatti–Kurla, Vikhroli–Kanjurmarg and Kurla–Tilak Nagar; 210 heavy-duty dewatering pumps (12.5–100 HP) at 117 waterlogging-prone locations — [FPJ (search extract)](https://www.freepressjournal.in/mumbai/mumbai-rains-central-railway-fixes-6-major-waterlogging-spots-completes-key-safety-works-ahead-of-peak-monsoon); [MumbaiLive (search extract)](https://www.mumbailive.com/amp/en/civic/cr-installs-210-heavy-duty-dewatering-pumps-at-117-waterlogging-prone-locations-93361)
- In heavy rain, services were suspended Sion–Kurla (main line) and Chunabhatti–Kurla (Harbour) with water about 8 inches above the rails; the Harbour flooding is linked to the swollen Mithi river nearby — [FPJ, "Monsoon fury" (search extract)](https://www.freepressjournal.in/mumbai/mumbai-monsoon-fury-relentless-rains-paralyse-central-railway-thousands-stranded); [Deccan Herald, Harbour suspended (search extract)](https://www.deccanherald.com/amp/story/india%2Fmaharashtra%2Fmumbai-rains-local-train-services-on-harbour-line-suspended-due-to-flooded-tracks-3687042); [India.com (search extract)](https://www.india.com/news/india/mumbai-rain-bad-news-for-mumbaikars-as-local-train-suspended-between-csmt-and-thane-due-to-waterlogging-kurla-sion-central-line-harbour-line-8020043/)
- August 2020: main and Harbour services shut in the morning by waterlogging at Kurla, Wadala, Chunabhatti and Parel; 2017: delays of over 30 minutes from waterlogging between Sion and Kurla — [Hindustan Times via PressReader (search extract)](https://www.pressreader.com/india/hindustan-times-st-mumbai/20200805/281659667382638); [FPJ via PressReader (search extract)](https://www.pressreader.com/india/the-free-press-journal/20170628/281625305314445)
- Station flavour from OSM tags: Vashi station building has 7 levels and RailWire Wi-Fi; Nerul station is on layer 2 (elevated concourse) — [Vashi way](https://www.openstreetmap.org/way/151768155); [Nerul way](https://www.openstreetmap.org/way/572630813)

### Inferences
- A "mega block" game event: on Sundays 11:00–16:00 pick one main-line section (e.g. Matunga–Mulund) and close either the slow or the fast pair; trains of the closed pair switch to the other pair (skipping their platforms there — slow trains cannot stop at stations without fast-line platforms), run about 15 min late, and the station PA/radio announces it. On the Harbour, cut a section (e.g. Kurla–Vashi) and run shuttles on both sides. Inside the current map, a Matunga–Kurla slow-line block means slow trains run through Sion and Matunga without stopping.
- A monsoon event: water on the tracks Sion–Kurla and Chunabhatti–Kurla first (both inside the map), trains crawl or stop, Harbour cut back to Vadala Road/CSMT; ties in with the planned monsoon system (plan items 4.5).
- Content to avoid: the 2006 train bombings, the 2008 CSMT attack and riots (owner's rule). The 2025 accident near Mumbra in which crowded commuters fell from trains (the reason given for speeding up 15-car and door changes) is also best left out of game content.

### Gaps
- Complete list of regular mega-block sections and their rotation; whether night blocks are also used on Central in 2026.
- Signal-failure frequency and typical delay figures were not searched.
- Whether CR's monsoon fixes held in the 2026 monsoon (no post-monsoon report found).
