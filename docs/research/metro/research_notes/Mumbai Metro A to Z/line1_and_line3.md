# Mumbai Metro Line 1 (Blue Line, Versova–Andheri–Ghatkopar) and Line 3 (Aqua Line, Cuffe Parade–BKC–Aarey JVLR) — fact record as of 14 Nov 2026

How this was researched (read first):
- Direct page fetches were blocked in this session (en.wikipedia.org, theprint.in, freepressjournal.in, mmrcl.com, mumbailive.com, themetrorailguy.com, metrorailnews.in all refused by the session's network proxy). Every web fact below comes from search-engine extracts of the cited pages, not from full reads. Treat single-source numbers with care; conflicts are flagged.
- Station order, coordinates, chainage (distance along the track), roads, localities, interchange walking distances and mapped entrances were measured directly from the project's own OpenStreetMap extract `data/raw/mumbai-region.osm.pbf` (dated 2026-11-13), using the route relations for each line. These are map-derived, not official MMRC/MMOPL chainages. Scripts are in the session scratchpad (not committed).
- OSM relation links: Line 1 [Versova→Ghatkopar](https://www.openstreetmap.org/relation/3808111), [Ghatkopar→Versova](https://www.openstreetmap.org/relation/7684032); Line 3 [Aarey JVLR→Cuffe Parade](https://www.openstreetmap.org/relation/7898597), [Cuffe Parade→Aarey JVLR](https://www.openstreetmap.org/relation/17876723).

## 1. Every station in order, with distances, layout, roads, localities and interchanges

### Takeaway
Line 1 has 12 elevated stations over about 11 km (10.90 km between the end stop positions in OSM); Line 3 has 27 stations over about 33 km (32.69 km between the end stops in OSM; official length 33.5 km), all underground except possibly the northern terminus Aarey JVLR. Key interchanges: Line 1 ↔ Line 3 at Marol Naka (~90–170 m apart), Line 1 ↔ Western Railway at Andheri and ↔ Central Railway at Ghatkopar; Line 3 ↔ Western Railway at Churchgate, Grant Road, Mumbai Central (Jagannath Shankar Sheth Metro), Mahalaxmi, Dadar; ↔ Central/Harbour at CSMT and Dadar; ↔ airport terminals T1 and T2; ↔ Monorail near Mahalaxmi.

### Cited Findings

**Line 1 — station table (all data from the OSM extract, relation [3808111](https://www.openstreetmap.org/relation/3808111) and nearby station/road/place/entrance nodes)**

Chainage = distance along the OSM track from the Versova stop position. Road = nearest named main road (distance from the stop). Interchange distance = straight line between station nodes (walking distance will be longer). "Entrances mapped" = `railway=subway_entrance` nodes within 350 m in OSM (incomplete mapping; 0 means "not mapped", not "no gates").

| # | Station (OSM name / Marathi) | Chainage km | Gap km | Lat, lon | Main road at the station | Locality (OSM place) | Interchanges / nearby (OSM distance) | Entrances mapped in OSM |
|---|---|---|---|---|---|---|---|---|
| 1 | Versova / वर्सोवा | 0.00 | – | 19.13028, 72.82139 | Jai Prakash (J P) Road | Seven Bungalows, Versova | depot spur nearby (see Q2) | 6 (gates 1–5 + one unnamed) |
| 2 | D. N. Nagar / डी. एन. नगर | 1.02 | 1.02 | 19.12818, 72.83081 | J P Road, Link Road (23 m) | Dadabhai Naoroji Nagar | Line 2A "Andheri (West)" station 125 m | 8 (gates 1–4, two lifts, A1/A2 of Line 2A) |
| 3 | Azad Nagar / आझाद नगर | 1.82 | 0.80 | 19.12681, 72.83827 | J P Road; Veera Desai Road 97 m | Azad Nagar | – | 0 |
| 4 | Andheri / अंधेरी (OSM station node "Andheri L1") | 3.25 | 1.43 | 19.12004, 72.84948 | Mathuradas Vasanji Road (Andheri–Kurla Road) | Andheri East | Andheri suburban station (Western line) 324 m | 0 |
| 5 | Western Express Highway / पश्चिम द्रुतगती महामार्ग | 4.19 | 0.93 | 19.11556, 72.85698 | M V Road (Andheri–Kurla Road) under the highway | Andheri East, Chakala | Line 7 "Gundavali" 225 m | 2 (gates 4, 5) |
| 6 | Chakala – J.B. Nagar / चकाला - जे. बी. नगर | 5.45 | 1.26 | 19.11191, 72.86824 | Andheri–Kurla Road | Kondivita, Chakala | – | 0 |
| 7 | Airport Road / विमानतळ रस्ता | 6.17 | 0.72 | 19.10991, 72.87480 | Andheri–Kurla Road | Navpada, Marol Village | Line 3 Marol Naka 427 m | 0 |
| 8 | Marol Naka / मरोळ नाका | 6.77 | 0.60 | 19.10795, 72.88011 | Andheri–Kurla Road; Makwana Road | Chimatpada, Saki Naka | Line 3 Marol Naka 86–173 m (OSM entrance named "Exit Gate 4 To Aqua Line") | 1 (gate 2) |
| 9 | Saki Naka / साकी नाका | 7.85 | 1.07 | 19.10322, 72.88851 | Sant Shitolebaba Maharaj Marg; 90 Feet Road | Mohli Village | – | 0 |
| 10 | Asalpha / असल्फा | 8.94 | 1.09 | 19.09610, 72.89541 | Sant Shitolebaba Maharaj Marg | Asalpha | – | 0 |
| 11 | Jagruti Nagar / जागृती नगर | 9.82 | 0.88 | 19.09217, 72.90260 | Ghatkopar–Andheri Link Road | Ghatkopar West | Ghatkopar suburban station 942 m | 0 |
| 12 | Ghatkopar / घाटकोपर | 10.90 | 1.09 | 19.08629, 72.90812 | Hirachand Desai Road; Station Road | Ghatkopar West (Kapol Wadi) | Ghatkopar suburban station (Central line) 71 m | 6 (gates 1A, 1B, 2A, 2B, 3, 4) |

- All three Line 1 track ways in OSM are tagged `bridge=yes`, `layer=2` (elevated viaduct end to end); the OSM track between the end buffers is 11.25 km — [OSM relation 3808111](https://www.openstreetmap.org/relation/3808111)
- OSM names the stop "Western Express Highway (eastbound)" and maps entrances with `wheelchair=no` at Versova, D N Nagar and WEH (lifts mapped only at D N Nagar) — [OSM relation 3808111](https://www.openstreetmap.org/relation/3808111)
- Line 1 is described as "fully elevated" with 12 stations over 11.40 km — [Wikipedia mirror (Kiwix, 2024)](https://kiwix.lema.org/wikipedia_en_all_mini_2024-02/A/Line_1_(Mumbai_Metro)); [Hexahome](https://www.hexahome.in/blog/guides/versova-ghatkopar-metro-route/)
- Ghatkopar metro station sits next to the Central Railway station and a skywalk links the railway foot-over-bridge to it; an older report said a gap of "a couple of feet" remained between skywalk and metro building — [DNA (old, ~2014)](https://www.dnaindia.com/mumbai/report-dna-special-mumbai-metro-local-integration-awaits-nod-1959478); [Ghatkopar metro station, Wikipedia (via search)](https://en.wikipedia.org/wiki/Ghatkopar_metro_station)
- At Andheri, the same old report said a structure was still needed to bridge the "barely 100 m" between the railway foot-over-bridge (East) and the metro station; officials promised it by commissioning — [DNA (old)](https://www.dnaindia.com/mumbai/report-dna-special-mumbai-metro-local-integration-awaits-nod-1959478)
- Line 3 Marol Naka is the metro-to-metro link with Line 1 — [ixigo route map](https://www.ixigo.com/metro/mumbai/route-map); [List of Mumbai Metro stations, Wikipedia (via search)](https://en.wikipedia.org/wiki/List_of_Mumbai_Metro_stations)

**Line 3 — station table (OSM extract, relation [17876723](https://www.openstreetmap.org/relation/17876723) Cuffe Parade → Aarey JVLR, plus station/road/place/entrance nodes)**

Chainage from the Cuffe Parade stop position. "Sponsor name" = the `official_name` in OSM (station naming rights; in the game these real brands need parody names). "Ref" = OSM `ref` code where mapped.

| # | Station (OSM name / Marathi) | Ref | Chainage km | Gap km | Lat, lon (station node) | Main road | Locality | Interchanges / nearby (straight-line from OSM) | Sponsor name in OSM | Entrances mapped |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Cuffe Parade / कफ परेड | CUP | 0.00 | – | 18.91357, 72.82072 | Captain Prakash Pethe Marg | Cuffe Parade | Backbay BEST bus depot ~550 m (OSM) | – | 0 |
| 2 | Vidhan Bhavan / विधान भवन | – | 1.47 | 1.47 | 18.92478, 72.82549 | Free Press Journal Road; Rajni Patel Marg | Nariman Point, Mantralaya | – | – | 0 |
| 3 | Churchgate / चर्चगेट | – | 2.30 | 0.83 | 18.93149, 72.82694 | Jamshedji Tata Road | Churchgate | Churchgate (Western line terminus) 445 m | "LIC – Churchgate Metro" | 6 (A2, A4, B1, B2 + 2) |
| 4 | Hutatma Chowk / हुतात्मा चौक | – | 3.03 | 0.73 | 18.93418, 72.83250 | Dr Dadabhai Naoroji Road (Flora Fountain) | Fort | Churchgate 579 m | "LIC – Hutatma Chowk" | 3 (B2–B4) |
| 5 | Chhatrapati Shivaji Maharaj Terminus / छत्रपती शिवाजी महाराज टर्मिनस | – | 3.93 | 0.91 | 18.94083, 72.83186 | Corporation Street | Bori Bunder | CSMT (Central + Harbour lines) 415 m | "Chhatrapati Shivaji Maharaj Terminus – kotak Metro" | 6 (A2, A3, B1, B2, 2 lifts) |
| 6 | Kalbadevi / काळबादेवी | – | 4.73 | 0.79 | 18.94633, 72.82719 | Jagannath Shankarsheth Marg | Kalbadevi | Marine Lines (Western) 371 m | – | 2 (A1, B1) |
| 7 | Girgaon / गिरगाव | – | 5.56 | 0.83 | 18.95210, 72.82221 | J S S Marg; Dr Babasaheb Jaykar Marg | Girgaon | Charni Road (Western) 416 m | – (OSM: toilets=yes) | 1 (B1) |
| 8 | Grant Road / ग्रँट रोड | – | 7.01 | 1.45 | 18.96322, 72.81804 | Dr Dadasaheb Bhadkamkar Marg | Gamdevi | Grant Road (Western) 234 m | – | 0 |
| 9 | Jagannath Shankar Sheth Metro / जगन्नाथ शंकर शेठ मेट्रो | MCLM | 7.83 | 0.82 | 18.96999, 72.82118 | Dr Anand Rao Nair Marg | Tardeo | Mumbai Central (Western) 201 m; Central BEST depot nearby | – | 0 |
| 10 | Mahalaxmi / महालक्ष्मी | – | 8.99 | 1.16 | 18.97947, 72.82540 | Sane Guruji Marg | Dhobi Ghat, Agripada | Mahalaxmi (Western) 362 m; Monorail Sant Gadge Maharaj Chowk 524 m | – | 0 |
| 11 | Science Museum / विज्ञान संग्रहालय (station node: "Science Centre") | – | 10.43 | 1.44 | 18.99089, 72.82135 | Dr E Moses Marg | Mahalakshmi | Mahalaxmi (Western) 976 m | – | 1 |
| 12 | Acharya Atre Chowk / आचार्य अत्रे चौक | – | 11.29 | 0.86 | 18.99782, 72.81772 | Dr E Moses Marg; Dr Annie Besant Road | Worli (Nehru Nagar) | Lower Parel 1.3 km | – | 1 (A4) |
| 13 | Worli / वरळी | WOR | 12.62 | 1.32 | 19.00861, 72.81927 | Dr Annie Besant Road | Worli | Prabhadevi 1.8 km | – | 0 |
| 14 | Siddhivinayak Temple / सिद्धिविनायक मंदिर | – | 14.25 | 1.63 | 19.01589, 72.83092 | (Shankar Ghanekar Marg 107 m) | Prabhadevi | Parel 968 m | – | 0 |
| 15 | Dadar / दादर | – | 15.60 | 1.35 | 19.02362, 72.83922 | Gokhale Road | Dadar West | Dadar (Western + Central) 630 m (node to node) | "SBI – Dadar Metro" | 3 (A1, A3, A4) |
| 16 | Shitala Devi Mandir / शितला देवी मंदिर | – | 17.31 | 1.72 | 19.03846, 72.84196 | Lady Jamshedji Road | Mahim (Wanjawadi, Kapad Bazar) | Mahim Junction 544 m | – | 5 (A1, A2, B1–B3) |
| 17 | Dharavi / धारावी | – | 18.80 | 1.49 | 19.04626, 72.84974 | 60 Feet Road; Mahim–Sion Link Road | Dharavi (Koliwada) | Mahim Junction 731 m | – | 0 |
| 18 | Bandra Kurla Complex (BKC) / वांद्रे कुर्ला कॉम्प्लेक्स | – | 20.79 | 1.98 | 19.06066, 72.85468 | Ramakrishna Paramahansa Marg | BKC (Government Colony) | Bandra 1.6 km; future Line 2B | "kotak – Bandra Kurla Complex" | 6 (A1–A4, B1, lifts) |
| 19 | Bandra Colony (no Marathi name in OSM stop) | VIDN | 21.95 | 1.17 | 19.06996, 72.84936 | – (no main road within 120 m) | Kalina (RPF Colony, Golibar) | Khar Road 973 m | "AU Bank – Bandra Colony" | 0 |
| 20 | Santacruz / सांताक्रूझ | – | 23.04 | 1.08 | 19.07929, 72.84712 | Kalina–Vakola flyover / service road | Anand Nagar | Santa Cruz (Western) 596 m | "ICICI Prudential Mutual Fund – Santacruz Metro" | 8 (A1, A2, B1, B2 + 4 lifts) |
| 21 | CSMIA Domestic (T1) / छ.शि.म.आं.वि. ट-१ | – | 25.03 | 1.99 | 19.09390, 72.85358 | Airport Road; Nehru Road | Shastri Nagar (Vile Parle E) | Airport Terminal 1; Vile Parle 1.2 km | – | 1 (A1) |
| 22 | Sahar Road / सहार रोड | SHRR | 26.85 | 1.82 | 19.10220, 72.86524 | I A Project Road; Sahar Elevated Road | Sahar Village | – | – | 0 |
| 23 | CSMIA International T2 / छ.शि.म.आं.वि. ट-२ | – | 27.86 | 1.01 | 19.10233, 72.87447 | Sahar Elevated Road | Navpada | Airport Terminal 2 | "SBI – Chhatrapati Shivaji Maharaj International Airport – T2" | 0 |
| 24 | Marol Naka / मरोळ नाका | – | 28.81 | 0.95 | 19.10850, 72.87858 | Maroshi Village Road; Andheri–Kurla Road 64 m | Chimatpada | Line 1 Marol Naka (see above) | "Fevicol Marol Naka" | 4 (A-2, 4, 5 + 1) |
| 25 | MIDC – Andheri / एम.आय.डी.सी. - अंधेरी | AND | 30.03 | 1.22 | 19.11735, 72.87360 | MIDC Road No. 7 / No. 16 | Kondivita, Shivaji Nagar | – | – | 0 |
| 26 | SEEPZ / सीप्झ | – | 31.28 | 1.26 | 19.12600, 72.87373 | Krantiveer Lakhuji Salve Marg | (Sariput Nagar 637 m) | – | – | 0 |
| 27 | Aarey JVLR / आरे कॉलनी | – | 32.69 | 1.41 | 19.13105, 72.88420 (stop) | – (Jogeshwari–Vikhroli Link Road area; no mapped main road within 120 m of the stop) | Sariput Nagar ~900 m | Jogeshwari (Western) 3.8 km | – | 1 (A1) |

- Source for the whole Line 3 table: [OSM relation 17876723](https://www.openstreetmap.org/relation/17876723) and [OSM relation 7898597](https://www.openstreetmap.org/relation/7898597) (station, entrance, road and place nodes from the same 2026-11-13 extract).
- In the opposite direction (Aarey JVLR → Cuffe Parade, relation 7898597) the stop gaps differ by up to ~0.3 km (e.g. Worli–Siddhivinayak 1.54 vs 1.63 km; Dharavi–BKC 1.96 vs 1.98 km); the end-to-end stop distance is the same 32.69 km — [OSM relation 7898597](https://www.openstreetmap.org/relation/7898597)
- In OSM all Line 3 track ways are tunnels (`tunnel=yes`, layer −1/−2) except the northernmost ways at Aarey JVLR (`layer=-1` and `layer=0`, no tunnel tag) — [OSM relation 7898597](https://www.openstreetmap.org/relation/7898597)
- Line 3 has 27 stations, 26 of them underground — [Aqua Line, Wikipedia (via search)](https://en.wikipedia.org/wiki/Aqua_Line_(Mumbai_Metro)); another Wikipedia-derived page says only "the northern terminus, Aarey Depot" is at grade — [MMRCL/Aqua Line Wikipedia redirect (via search)](https://en.wikipedia.org/wiki/MMRCL)
- Dadar, Mahalaxmi and Grant Road have island platforms; Mahalaxmi transfers to Mahalaxmi railway station and Sant Gadge Maharaj Chowk monorail station; Grant Road to Grant Road railway (Western line) — [List of Mumbai Metro stations (via search)](https://en.wikipedia.org/wiki/List_of_Mumbai_Metro_stations); [Mahalaxmi metro station (via search)](https://en.wikipedia.org/wiki/Mahalaxmi_metro_station)
- Dadar is the rail interchange with the Western and Central lines — [List of Mumbai Metro stations (via search)](https://en.wikipedia.org/wiki/List_of_Mumbai_Metro_stations)
- Sources disagree on Santacruz as an interchange (Yometro lists it; nobody else corroborates); ixigo claims six railway interchanges but names only Dadar and Mahalaxmi; others add Churchgate, CSMT and Mumbai Central — [Yometro](https://yometro.com/mumbai-metro-aqua-line-1403); [ixigo](https://www.ixigo.com/metro/mumbai/route-map)
- CSMIA T2 station is about 30 m underground near Terminal 2 at Sahar — [CSMIA T2 metro station, Wikipedia (via search)](https://en.wikipedia.org/wiki/Chhatrapati_Shivaji_Maharaj_International_Airport_-_T2_metro_station)
- Line 2B in OSM carries the note "Chembur is only a temporary terminus until the entire Line 2B is operational" (Diamond Garden/Shivaji Chowk/Deonar `start_date` 2026-04-08, Chembur 2026-08-13), i.e. the 2B link to BKC is not open in the extract — [OSM relation 20403808](https://www.openstreetmap.org/relation/20403808)

### Inferences
- The 10.90 km (Line 1) and 32.69 km (Line 3) between end stop positions are a little shorter than the official 11.4 km and 33.5 km because the official figures include track beyond the platforms (OSM total Line 1 track 11.25 km; Line 3 32.99 km). For a 1:1 game, the OSM polylines and stop positions are directly usable; they are the same data the game's converter already reads.
- Average stop spacing: Line 1 ≈ 0.99 km; Line 3 ≈ 1.26 km (shortest Hutatma Chowk–Churchgate 0.73 km; longest CSMIA T1–Santacruz ~1.99 km and BKC–Dharavi ~1.98 km).
- In the north section of Line 3 the two directions' stop positions are up to ~170 m apart at the same station (e.g. CSMIA T2, SEEPZ, Bandra Colony), consistent with stops mapped at the front of an 8-car train in each direction; use the station node for the platform centre.
- OSM `ref` codes suggest older working names: VIDN for Bandra Colony (formerly "Vidyanagari"), MCLM for Jagannath Shankar Sheth Metro (formerly "Mumbai Central Metro"); "Science Museum" (stop) vs "Science Centre" (station node) shows the name is in flux. Not confirmed by an official source.
- Line 1 runs above J P Road (Versova–Azad Nagar), then Andheri–Kurla Road (Andheri–Marol Naka–Saki Naka), then the Ghatkopar–Andheri Link Road to Ghatkopar — good streets for the elevated viaduct in the game.
- Mapped entrance counts are only a lower bound (OSM mapping is incomplete); Line 3 entrances are named A1/A2/B1… (two concourse sides A and B), Line 1 entrances are numbered gates (Ghatkopar 1A/1B/2A/2B/3/4).

### Gaps
- No official MMRC/MMOPL chainage table found; distances above are OSM measurements.
- Platform type (side or island) and number of platforms per station: verified only for Dadar, Mahalaxmi, Grant Road (island). Line 1 platform types not confirmed by any source found (commonly reported as side platforms, unverified). Whether any Line 3 stations (e.g. Kalbadevi, Girgaon) have stacked platforms could not be confirmed.
- Official number of entry/exit gates per station not found; OSM counts are partial.
- Station depths (beyond CSMIA T2 ~30 m) not found.
- Line 1 interchange status at Andheri (skywalk completion) and D N Nagar (Line 2A link) and WEH (Line 7 Gundavali link) is not confirmed by a 2025–2026 source; OSM shows the stations 125 m and 225 m apart respectively.

## 2. Line length, depots, operators and opening dates

### Takeaway
Line 1: 11.4 km, 12 stations, opened 8 June 2014, run by Mumbai Metro One Pvt Ltd (MMOPL: Reliance Infrastructure 74 %, MMRDA 26 %); the state's planned buy-out (₹4,000 crore) has not been completed as of Nov 2026 — instead MMOPL restructured its debt with NARCL in July 2026. Line 3: 33.5 km, 27 stations, MMRC (Mumbai Metro Rail Corporation), opened in three steps: Aarey JVLR–BKC (Oct 2024), BKC–Acharya Atre Chowk (May 2025), Acharya Atre Chowk–Cuffe Parade (inaugurated 8 Oct 2025, public 9 Oct 2025); depot at Aarey.

### Cited Findings
**Line 1**
- Opened 8 June 2014 — [Wikipedia mirror (Kiwix)](https://kiwix.lema.org/wikipedia_en_all_mini_2024-02/A/Line_1_(Mumbai_Metro)); [Railway Gazette, 9 Jun 2014](https://www.railwaygazette.com/urban/2014/06/09/mumbai-metro-opens/); [International Railway Journal](https://www.railjournal.com/passenger/metros/mumbai-opens-first-metro-line/)
- 11.40 km, fully elevated, 12 stations (one source says 12 km; Housing.com says 15 km — likely an error) — [Kiwix mirror](https://kiwix.lema.org/wikipedia_en_all_mini_2024-02/A/Line_1_(Mumbai_Metro)); [Housing.com](https://housing.com/news/mumbai-metro-line-1-route-stations-maps/)
- Cost ~₹4,321 crore, 84 % above the ₹2,356 crore in the March 2007 contract (one source gives ₹4,068 crore) — [Kiwix mirror](https://kiwix.lema.org/wikipedia_en_all_mini_2024-02/A/Line_1_(Mumbai_Metro)); [Housing.com](https://housing.com/news/know-about-mumbais-blue-line-metro-map)
- Depot: D N Nagar per Railway Gazette (2014); Wikipedia's Blue Line article lists "Four Bungalows" — [Railway Gazette](https://www.railwaygazette.com/urban/2014/06/09/mumbai-metro-opens/); [Blue Line, Wikipedia (via search)](https://en.wikipedia.org/wiki/Blue_Line_(Mumbai_Metro))
- OSM maps Line 1 yard tracks (`service=yard`, `bridge=viaduct`, layer 1) at about 19.1297–19.1322 N, 72.8244–72.8278 E, i.e. on an elevated spur between Versova and D N Nagar, north of J P Road — [OSM extract, way 287299822 and neighbours](https://www.openstreetmap.org/way/287299822)
- Ownership: Reliance Infrastructure 74 %, MMRDA 26 % of MMOPL — [Sahi.com](https://www.sahi.com/news/reliance-infrastructure-wins-157-64-crore-arbitration-award-from-mmrda-in-mumbai-metro-dispute-246-PE1_CORP)
- The Maharashtra cabinet gave in-principle approval to buy the line, with Reliance Infra's stake valued at ₹4,000 crore (article ~2 years old); MMRDA talks were reported at "an initial stage" — [Metro Rail Today](https://metrorailtoday.com/news/maharashtra-govt-approves-purchase-of-mumbai-metro-line-1-at-4000-crores); [Metro Rail News](https://metrorailnews.in/mmrda-may-take-over-operations-of-metro-one/)
- 9 July 2026: MMOPL signed a Master Restructuring Agreement with NARCL (National Asset Reconstruction Company) covering ₹2,771.32 crore of debt, averting insolvency; the lender gets governance oversight — [Social News XYZ, 10 Jul 2026](https://www.socialnews.xyz/2026/07/10/reliance-infras-mumbai-metro-one-signs-debt-restructuring-pact-with-narcl); [Whalesbook](https://www.whalesbook.com/news/English/bankingfinance/Reliance-Infrastructures-Mumbai-Metro-One-Restructures-indian-rupee2771-Crore-Debt/6a50dc90bfbc3f4042235c8a)
- 27 July 2026: arbitral award of ₹157.64 crore to Reliance Infrastructure against MMRDA over subordinated debt to MMOPL — [Business Upturn](https://businessupturn.com/business/reliance-infrastructure-awarded-rs-157-64-crore-in-mmrda-arbitration-case/)
- OSM tags the Line 1 route `operator=MMRDA` (mapper-entered, not authoritative) — [OSM relation 3808111](https://www.openstreetmap.org/relation/3808111)

**Line 3**
- Full length 33.5 km, 27 stations, Mumbai's first fully underground metro — [Outlook Traveller](https://www.outlooktraveller.com/News/mumbais-first-fully-underground-metro-line-is-now-openconnecting-south-to-north-in-record-time); [Metro Rail News project page](https://metrorailnews.in/projects/mumbai-metro-line-3/)
- Phase 1 (Aarey JVLR–BKC) inaugurated for commercial service 5 Oct 2024 (OSM `start_date=2024-10-05`) — [Railway News](https://railway-news.com/mumbai-metro-aqua-line-inaugurated-with-alstoms-driverless-trains/); [OSM relation 7898597](https://www.openstreetmap.org/relation/7898597)
- Phase 2A (BKC–Acharya Atre Chowk, 9.77 km — some sources 9.31 km — six stations: Dharavi, Shitaladevi, Dadar, Siddhivinayak, Worli, Acharya Atre Chowk) inaugurated by CM Devendra Fadnavis on 9 May 2025; public from 10 May 2025 — [Infra PPP World](https://www.infrapppworld.com/update/inauguration-of-phase-2a-of-mumbai-metro-line-3-from-bkc-to-acharya-atre-chowk-in-worli); [Free Press Journal](https://www.freepressjournal.in/mumbai/metro-line-3-phase-2-opens-up-to-worli-promises-boost-in-ridership-with-seamless-connectivity); [The Metro Rail Guy](https://themetrorailguy.com/mumbai-metro-aqua-line-information-route-map-fares-timings-tenders-status-updates/)
- Phase 2B (Acharya Atre Chowk–Cuffe Parade, 10.99 km) inaugurated by PM Modi on 8 Oct 2025 together with Navi Mumbai International Airport; open to the public 9 Oct 2025 (OSM `start_date=2025-10-09` on these stations) — [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-metro-3-phase-2b-ready-for-inauguration-today-pm-modi-to-throw-open-final-stretch-of-aqua-line-from-worli-to-cuffe-parade); [Cuffe Parade metro station, Wikipedia (via search)](https://en.wikipedia.org/wiki/Cuffe_Parade_metro_station); [Free Press Journal (timings)](https://www.freepressjournal.in/mumbai/mumbai-metro-3-operations-to-commence-from-october-9-know-timings-of-first-last-train-scheduled-on-aqua-line)
- Operator: Mumbai Metro Rail Corporation Ltd (OSM `operator`); MMRC announces timetable changes — [OSM relation 17876723](https://www.openstreetmap.org/relation/17876723); [Free Press Journal, Nov 2026](https://www.freepressjournal.in/mumbai/mumbai-metro-line-3-boosts-train-frequency-with-46-additional-weekday-trips-amid-rising-passenger-demand). One Mumbai Live headline attributes the fare announcement to "MMOCL" (conflict/possible error) — [Mumbai Live](https://www.mumbailive.com/en/transport/mumbai-metro-3-travel-from-aarey-to-cuffe-parade-in-60-nariman-point-to-airport-in-50-using-aqua-line-90050)
- Depot: at the northern end at Aarey ("Aarey Depot", described as at grade) — [Aqua Line, Wikipedia redirect (via search)](https://en.wikipedia.org/wiki/MMRCL)
- Rolling stock: 31 Alstom Metropolis trains of 8 cars (248 cars), designed in Bengaluru, built at Sri City (Andhra Pradesh); Alstom's Line 3 contract worth €452 million; driverless-capable; 24 trainsets delivered by Oct 2024 — [Alstom press release, Dec 2019](https://www.alstom.com/press-releases-news/2019/12/alstom-commences-manufacturing-rolling-stock-mumbai-metro-line-3-aqua); [Railway News](https://railway-news.com/mumbai-metro-aqua-line-inaugurated-with-alstoms-driverless-trains/)

### Inferences
- For the game, Line 1 is the older, privately run, crowded elevated line with money troubles; Line 3 is the new state-run underground line. A parody operator name is needed for both (real operator names and the sponsor station names are real brands).
- Line 3 phases in the game's timeline (December setting, 2026): the whole line is open.

### Gaps
- Line 3 operations and maintenance contractor (often reported as Delhi Metro Rail Corporation) not confirmed in this session.
- Exact public opening date of Phase 1 (commonly 7 Oct 2024) not confirmed; only the 5 Oct 2024 inauguration is sourced.
- Line 3 depot area, number of stabling lines and the Aarey car-shed history (tree-felling protests 2019, shed moved to Kanjurmarg and back) were not researched/verified here.
- No 2026 source confirms whether the MMRDA takeover of Line 1 is still planned.

## 3. Timings (first and last trains, weekdays/weekends, late-night extensions)

### Takeaway
Line 1: first train about 5:30 am from both ends; last trains around 11:25 pm (Versova) and 11:50 pm (Ghatkopar) per a guide checked October 2026 (other sources: ~11:30 pm). Line 3: first train 5:55 am from both Aarey JVLR and Cuffe Parade, last train 10:30 pm, arriving ~11:25 pm; weekends run on a separate timetable. Festival extensions: Ganeshotsav 2026 (14–25 Sep) Line 1 ran until 1:03 am, Line 3 until midnight; Line 1 added 28 late-night services for New Year 2026.

### Cited Findings
**Line 1**
- First train 5:30 am from Versova and Ghatkopar; last 11:25 pm from Versova, 11:50 pm from Ghatkopar (timetable "checked October 2026") — [Mumbai Metro Times](https://www.mumbaimetrotimes.com/mumbai-metro-timings-line-1/)
- 5:30 am first train also given by Rustomjee (Mar 2026), NoBroker, MetroEasy and the operator's schedule page — [Rustomjee](https://www.rustomjee.com/blog/mumbai-metro-line-1/); [NoBroker](https://www.nobroker.in/blog/mumbai-metro-line-1/); [Reliance Mumbai Metro schedule page](https://reliancemumbaimetro.com/metro-train-schedule)
- Stations open 5:30 am–11:30 pm daily per Hexahome — [Hexahome](https://www.hexahome.in/blog/guides/versova-ghatkopar-metro-route/)
- Conflict: Housing.com gives 6:30 am (Mon–Sat) and 8:30 am (Sun) first trains with 10:30 pm last — probably about a different line — [Housing.com](https://housing.com/news/mumbai-metro/); mumbaimetroroute.com gives a 6:00 am first train — [Mumbai Metro Route](https://mumbaimetroroute.com/)
- Weekend/holiday headways follow a separate, footfall-based schedule — [Mumbai Metro Times](https://www.mumbaimetrotimes.com/mumbai-metro-timings-line-1/)
- OSM route tags `opening_hours=5:30-24:00`, `interval=5` (mapper-entered) — [OSM relation 3808111](https://www.openstreetmap.org/relation/3808111)
- Ganeshotsav 2026 (14–25 Sep): last train from Versova 12:15 am, from Ghatkopar 12:40 am, arriving Versova 1:03 am — [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-metro-one-extends-services-until-103-am-from-september-14-to-25-for-ganeshotsav-2026); [LatestLY](https://www.latestly.com/india/news/mumbai-metro-one-extends-services-till-103-am-for-ganeshotsav-2026-7601354.html)
- New Year 2026: 28 additional late-night services on Versova–Ghatkopar — [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-new-year-2026-metro-one-to-run-28-additional-late-night-services-on-versovaghatkopar-line)

**Line 3**
- First train 5:55 am from both terminals (Aarey JVLR and Cuffe Parade); last trains leave 10:30 pm and complete the run by 11:25 pm — [Outlook Traveller](https://www.outlooktraveller.com/News/mumbais-first-fully-underground-metro-line-is-now-openconnecting-south-to-north-in-record-time); [Free Press Journal, Oct 2025](https://www.freepressjournal.in/mumbai/mumbai-metro-3-operations-to-commence-from-october-9-know-timings-of-first-last-train-scheduled-on-aqua-line); [Metro Rail News](https://metrorailnews.in/projects/mumbai-metro-line-3/)
- The 5:55 am start replaced a later start "from Monday, September 15" (2025, when only Aarey–Acharya Atre Chowk was open) — [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-metro-3-aqua-line-to-run-as-per-revised-timings-from-today-1st-train-to-depart-at-555-am-now-worli-to-cuffe-parade-stretch-opening-soon)
- Older (Phase 1-era) table: 6:30 am first train, 10:30 pm last; Sunday first train 8:30 am — [Yometro](https://yometro.com/mumbai-metro-aqua-line-1403)
- Weekend trains run on a separate timetable (Nov 2026) — [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-metro-line-3-boosts-train-frequency-with-46-additional-weekday-trips-amid-rising-passenger-demand)
- Ganeshotsav 2026: service until midnight (normally last train 10:30 pm from Aarey JVLR and Cuffe Parade) — [Time Out Mumbai](https://www.timeout.com/mumbai/news/mumbai-aqua-line-extends-its-operations-for-ganesh-chaturthi-090726); [CSR Journal](https://thecsrjournal.in/mumbai-metro-extends-aqua-line-services-until-midnight-for-ganeshotsav). One report says Lines 2A, 7 and 3 started at 6:30 am in that period — [Nativeplanet](https://www.nativeplanet.com/news/mumbai-metro-ganeshotsav-2026-extended-late-night-timings-early-morning-starts-011-24485.html) (single source)

### Inferences
- Game clock suggestion: Line 1 05:30–~23:50; Line 3 05:55–22:30 departures (last arrivals ~23:25); special late running on festival nights (Ganpati, New Year) as an event.
- Line 3 end-to-end running time ≈ 55 min (10:30 pm departure → 11:25 pm arrival).

### Gaps
- Current official Sunday/holiday first-train times for both lines not confirmed (8:30 am Sunday figures are old or single-source).
- Line 3 weekend timetable details (headway, trip count) not found.
- Extended hours for cricket matches or other events not found.

## 4. Frequency, running time, speed, fleet and trips per day

### Takeaway
Line 1: 16 four-car trains (CSR/CRRC Nanjing Puzhen), headway ~3.5 min at peak rising to ~8 min off-peak, ~20 min end to end; a revised pattern can raise daily trips to 482, and 22 extra coaches are being procured to make six-car trains. Line 3: 31 eight-car Alstom trains; since 2 Nov 2026, 337 weekday trips with a 4 min 25 s peak headway; ~55 min end to end.

### Cited Findings
**Line 1**
- 16 four-car trains built by CSR Nanjing (now CRRC Nanjing Puzhen); ~1,500 passengers per train (2014) — [Railway Gazette](https://www.railwaygazette.com/urban/2014/06/09/mumbai-metro-opens/); [CRRC Nanjing Puzhen, Wikipedia (via search)](https://en.wikipedia.org/wiki/CRRC_Nanjing_Puzhen)
- Headway 3 min 30 s at peak, rising gradually to 8 min off-peak — [Swarajya](https://swarajyamag.com/infrastructure/nine-years-into-service-mumbai-metro-line-one-trains-to-get-an-overhaul); [International Railway Journal](https://www.railjournal.com/passenger/metros/mumbai-opens-first-metro-line/) (2014 opening figure: 4 min peak / 8 min off-peak — [Railway Gazette](https://www.railwaygazette.com/urban/2014/06/09/mumbai-metro-opens/))
- End-to-end about 20 minutes (2014 sources); a route site gives Ghatkopar–Versova 26 min — [Railway Gazette](https://www.railwaygazette.com/urban/2014/06/09/mumbai-metro-opens/); [TrackMyMetro](https://trackmymetro.com/mumbai-metro/route/ghatkopar-to-versova)
- A new service pattern on Ghatkopar–Andheri can raise daily trips up to 482, with three extra trips per hour — [Lokmat Times](https://www.lokmattimes.com/mumbai/mumbai-metro-line-1-update-faster-connectivity-on-ghatkopar-andheri-stretch-with-new-service-pattern-to-reduce-platform-crowding-a525/)
- MMOPL has begun procuring 22 additional coaches to turn four-car trains into six-car trains (report ~Oct 2026); earlier the plan awaited NARCL approval; six-car capacity ~1,792 vs ~1,178 today (another source says ~1,750 per four-car train) — [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-metro-1-may-soon-get-six-coach-trains-to-ease-rush-hour-crowds); [Mumbai Live](https://www.mumbailive.com/en/transport/overcrowded-mumbai-metro-1-line-set-for-upgrade-with-six-coach-trains-90638); [Construction World](https://www.constructionworld.in/transport-infrastructure/metro-rail-and-railways-infrastructure/mumbai-metro-1-plans-six-coach-trains-to-ease-peak-hour-congestion/81099)
- Assessment for additional rakes to augment the 16 four-car trains had been initiated (social-media post) — [X post](https://x.com/haldilal/status/2038462127519023312) (low reliability)

**Line 3**
- 2 Nov 2026: 46 weekday trips added, 291 → 337; peak interval cut from 4 min 50 s to 4 min 25 s; earlier steps 282 trips (23 Jun 2026) and 291 (28 Sep 2026) — [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-metro-line-3-adds-46-weekday-trips-aqua-line-services-rise-to-337-as-peak-hour-waiting-time-drops); [Lokmat Times](https://www.lokmattimes.com/mumbai/mumbai-metro-3-adds-46-weekday-services-peak-hour-train-gap-reduced-to-4-minutes-25-seconds-a527/); [Mumbai Live](https://www.mumbailive.com/en/civic/mumbai-metro-aqua-line-adds-46-new-services-weekday-train-trips-increase-to-337-94923); [ThePrint/PTI](https://theprint.in/india/46-trips-added-to-mumbais-metro-line-3-daily-services-now-reach-337/3089676/)
- Phase 2A (May 2025): trains every 6 min 20 s; BKC–Acharya Atre Chowk ~15–20 min — [Oneindia](https://www.oneindia.com/mumbai/mumbai-metro-line-3-phase-2a-begins-operations-bkc-to-worli-in-15-minutes-4148573.html); [Infra PPP World](https://www.infrapppworld.com/update/inauguration-of-phase-2a-of-mumbai-metro-line-3-from-bkc-to-acharya-atre-chowk-in-worli)
- End-to-end estimates: ~54 min (Brokersaathi), "about an hour" (FPJ); Cuffe Parade–airport ~45 min (Republic) — [Brokersaathi](https://brokersaathi.com/blogs/mumbai-metro-line-3/); [Free Press Journal](https://www.freepressjournal.in/mumbai/living-in-cuffe-parade-want-to-catch-a-flight-from-csmia-t2-heres-how-you-can-reach-faster-with-mumbai-metro-3); [Republic World](https://www.republicworld.com/travel/cuffe-parade-to-mumbai-airport-in-just-45-minutes-know-mumbai-s-first-fully-underground-metro-aqua-line-s-route-and-fare-chart)
- Fleet: 31 × 8-car Alstom Metropolis — [Alstom](https://www.alstom.com/press-releases-news/2019/12/alstom-commences-manufacturing-rolling-stock-mumbai-metro-line-3-aqua)
- Network-wide Wikipedia infobox headway "4 minutes (peak); 8 minutes (off-peak)" — not Line 3 specific — [Mumbai Metro, Wikipedia (via search)](https://en.wikipedia.org/wiki/Mumbai_Metro)

### Inferences
- Line 3 average speed ≈ 33.5 km / 55 min ≈ 36 km/h; Line 1 ≈ 11.4 km / 20–26 min ≈ 26–34 km/h.
- Line 3: 337 weekday trips ≈ 168 per direction over ~16.6 h of service → mean headway ≈ 6 min (4 min 25 s peak, longer off-peak).
- Line 3 trains needed at a 4:25 peak with a ~55 min one-way run plus ~5 min turn-backs: about 120 min cycle / 4.4 min ≈ 27 trains — consistent with a 31-train fleet (estimate, not a reported number).
- Line 1: at a 3.5 min peak with ~20–22 min one-way plus turn-backs (~50 min cycle) ≈ 14–15 trains in service of 16 — consistent with the fleet (estimate).

### Gaps
- Official Line 3 off-peak and weekend headways, number of rakes in peak service, and the official end-to-end running time not found.
- Official current Line 1 trip count per day (before the up-to-482 change) and current off-peak headway not confirmed.

## 5. Fares, cards, passes and apps

### Takeaway
Line 3 fares rise by distance from ₹10 (up to 3 km) to ₹60 (30–36 km); Cuffe Parade–Aarey JVLR costs ₹60, Nariman Point–airport ₹50. Line 1 fares run ₹10–₹40 per most guides, but current sources disagree whether end-to-end is ₹30 or ₹40. Both lines take QR tickets; Line 1 sells WhatsApp trip passes and store-value passes; the state's "Mumbai One" app (launched 8 Oct 2025) sells one QR ticket across 11 operators including Metro Lines 1, 2A, 3 and 7.

### Cited Findings
**Line 3 fare slabs (single-journey ticket)**

| Distance | Fare (₹) |
|---|---|
| 0–3 km | 10 |
| 3–12 km | 20 |
| 12–18 km | 30 |
| 18–24 km | 40 |
| 24–30 km | 50 |
| 30–36 km | 60 |
| over 42 km (not reached on Line 3) | capped at 80 |

- Slab table and the ₹80 cap — [Mumbai Live](https://www.mumbailive.com/en/transport/mumbai-metro-3-travel-from-aarey-to-cuffe-parade-in-60-nariman-point-to-airport-in-50-using-aqua-line-90050); [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-metro-3-fare-travel-from-aarey-to-cuffe-parade-in-60-nariman-point-to-airport-in-50-using-aqua-line-check-ticket-rates-here)
- Aarey–Cuffe Parade (~33.5 km) ₹60; Nariman Point to airport ₹50 — [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-metro-3-fare-travel-from-aarey-to-cuffe-parade-in-60-nariman-point-to-airport-in-50-using-aqua-line-check-ticket-rates-here)
- Conflict: Mumbai Metro Times says up to ~₹70 end to end; others say "₹10 to ₹80" (the cap) — [Mumbai Metro Times](https://www.mumbaimetrotimes.com/mumbai-metro-line-3-aqua-line/)
- Phase 2A period fares ₹10–₹40 — [Oneindia](https://www.oneindia.com/mumbai/mumbai-metro-line-3-phase-2a-begins-operations-bkc-to-worli-in-15-minutes-4148573.html)
- Experts questioned whether fares are affordable when the full stretch opened — [Free Press Journal](https://www.freepressjournal.in/amp/mumbai/mumbai-metro-line-3-promises-faster-commutes-with-full-stretch-till-cuffe-parade-but-experts-question-fares)

**Line 1**
- Minimum ₹10, maximum ₹40 — [Mumbai Metro Times](https://www.mumbaimetrotimes.com/mumbai-metro/); [Rustomjee](https://www.rustomjee.com/blog/mumbai-metro-line-1/). Conflicts: NoBroker ₹10–₹80; MumbaiMetro.info max ₹60 — [NoBroker](https://www.nobroker.in/blog/mumbai-metro-line-1/); [MumbaiMetro.info](https://mumbaimetro.info/metro-lines/line-1)
- Versova–Ghatkopar token ₹30 (smart card ~5 % off ≈ ₹29; same-day return ₹60) per route aggregators — [Mumbai Metro Route](https://mumbaimetroroute.com/routes/versova-to-ghatkopar); [Hexahome](https://www.hexahome.in/blog/guides/versova-ghatkopar-metro-route/); [TrackMyMetro "₹30, 26 min"](https://trackmymetro.com/mumbai-metro/route/ghatkopar-to-versova)
- Older table (~2016): slabs ₹10/20/30/40 with smart-card fares ₹18/27/32 for the ₹20/30/40 slabs — [Wonderful Mumbai](https://wonderfulmumbai.com/mumbai-metro-line-1-versova-andheri-ghatkopar-corridor/)
- Smart-card discount given as ~10 % in normal hours by another site — [TrackMyMetro](https://trackmymetro.com/mumbai-metro/route/ghatkopar-to-versova)
- Passes: 30-journey trip pass ₹750 and monthly pass ₹1,100 (one site); another lists ₹500 for 30 journeys — [Hexahome](https://www.hexahome.in/blog/guides/versova-ghatkopar-metro-route/); [TRVO](https://www.trvo.in/passes/mmrda-line1-monthly); [Mumbai Metro Route](https://mumbaimetroroute.com/)
- Metro One launched WhatsApp-based Trip Passes and Store Value Passes that can be added to Google Wallet / Apple Wallet — [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-metro-one-launches-digital-passes-on-whatsapp-for-commuters)

**Mumbai One app / cards**
- PM Modi launched "Mumbai One" on 8 Oct 2025; live for download 9 Oct (5 am); one QR-based ticket across metro, monorail, buses and local trains — [The Week/PTI](https://www.theweek.in/wire-updates/national/2025/10/08/bes22-mh-app-mumbai-one.html); [LatestLY](https://www.latestly.com/technology/mumbai-one-app-to-be-available-for-download-from-october-9-know-key-features-of-indias-first-common-mobility-application-integrating-11-travel-services-7149922.html)
- 11 operators: suburban rail, Metro Lines 1, 2A, 3 and 7, Navi Mumbai Metro, Monorail, and BEST, TMT, MBMT, KDMT, NMMT buses — [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-one-app-launches-today-indias-first-unified-mobility-platform-goes-live-at-5-am-heres-what-it-offers); [Knocksense](https://www.knocksense.com/mumbai/indias-first-common-mobility-app-mumbai-one-integrates-11-public-transport-services)
- National Common Mobility Card (NCMC) does not fully cover Mumbai's suburban rail; Mumbai One fills the gap; pairing with NCMC for non-smartphone users is a future plan — [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-one-card-launches-today-know-how-it-will-ease-transporation-for-mumbaikars-in-mmr); [Musafir](https://in.musafir.com/blog/mumbai-one-app)
- 27,000+ registered users in the first 12 hours — [Metro Vaartha](https://english.metrovaartha.com/news/mumbai/mumbai-one-app-goes-live-gets-more-than-27k-registered-users-in-12-hours)
- No extra user fees (costs borne by MMRDA) — [Knocksense](https://www.knocksense.com/mumbai/indias-first-common-mobility-app-mumbai-one-integrates-11-public-transport-services)
- Monorail services were suspended as of a Feb 2026 review — [Bestpedia](https://bestpedia.in/2026/02)

### Inferences
- Applying the Line 3 slabs to the OSM chainage gives consistent results: Cuffe Parade–CSMIA T2 27.86 km → ₹50 (matches the "Nariman Point to airport ₹50" report); Cuffe Parade–Aarey 32.69 km (official 33.5) → ₹60. A game can compute fares from the chainage table in section 1.
- A simple game rule for Line 1: ₹10 / 20 / 30 / 40 by distance with ~5–10 % off for a card; real slab boundaries for Line 1 are unconfirmed.
- In-game ticketing should use parody names (the CLAUDE.md rule): a fictional unified app instead of "Mumbai One", and fictional sponsor names in place of the real bank/brand station sponsors.

### Gaps
- Official Line 1 slab boundaries (km) and the current end-to-end fare (₹30 vs ₹40) not confirmed from MMOPL.
- Line 3 card/QR discounts, Line 3 passes, and smart-card product names not found.
- Whether Line 1 accepts NCMC cards in 2026 not confirmed.

## 6. Ridership

### Takeaway
Line 1 carries about 5 lakh (500,000) passengers on a working day, with a record of 5,66,851 on 22 Aug 2025; 88 % of riders travel between Ghatkopar and Andheri. Line 3 started slowly (~20,000/day on the Aarey–BKC stretch) but after the full opening averaged 2,24,602 per weekday and 1,31,138 per weekend day in September 2026, with 7.2 crore (72 million) journeys in its first full year.

### Cited Findings
**Line 1**
- Record: 5,66,851 passengers on 22 Aug 2025, when combined metro + monorail ridership came within 9,668 of 10 lakh — [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-metro-monorail-near-10-lakh-daily-ridership-milestone)
- Average weekday ~5 lakh; record peak given as 5.47 lakh (conflicts with the above); short Ghatkopar–Andheri services introduced to ease rush hours — [Metro Rail Today](https://metrorailtoday.com/news/mumbai-metro-one-celebrates-11-years-of-transforming-urban-commute-with-over-111-crore-riders)
- 500,385 daily (Aug 2024, Wikipedia) — [Blue Line, Wikipedia (via search)](https://en.wikipedia.org/wiki/Blue_Line_(Mumbai_Metro))
- 111 crore commuters in 11 years (8 Jun 2025); 100 crore in 10 years — [The Week/PTI](https://www.theweek.in/wire-updates/national/2025/06/08/bes15-mh-metro-anniversary.html); [Knocksense](https://www.knocksense.com/mumbai/mumbais-ghatkopar-andheri-versova-metro-line-records-100-crore-commuters-in-10-years/)
- ~88 % of Line 1 passengers travel between Ghatkopar and Andheri — [Lokmat Times](https://www.lokmattimes.com/mumbai/mumbai-metro-line-1-update-faster-connectivity-on-ghatkopar-andheri-stretch-with-new-service-pattern-to-reduce-platform-crowding-a525/)
- Ghatkopar is the busiest station, ~115,000/day (May 2025) — [Grokipedia](https://grokipedia.com/page/Ghatkopar_metro_station) (low-reliability source)

**Line 3**
- Phase 1 (Aarey–BKC): ~20,000/day, "95 % short" of a 4 lakh projection; "only 46 passengers per service"; 16.38 lakh in 4 months (avg 13,317/day) — [Knocksense](https://www.knocksense.com/amp/story/mumbai/with-fewer-than-20k-daily-passengers-mumbai-metro-3-falls-95-short-of-400k-ridership-projection); [Free Press Journal](https://www.freepressjournal.in/amp/mumbai/mumbai-metro-3-struggles-with-ridership-only-46-passengers-travel-per-service-says-report); [India TV](https://www.indiatvnews.com/news/india-lakh-passengers-aqua-line-after-four-months-523451)
- Early days: 2 lakh+ in the first 10 days, Marol Naka highest footfall (39,887 over nine days) — [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-metro-3-over-2-lakh-passengers-travelled-through-aqua-line-in-10-days-after-launch-marol-naka-sees-highest-footfall)
- Phase 2A first Saturday: 26,758 riders between Aarey JVLR and Acharya Atre Chowk — [Free Press Journal](https://www.freepressjournal.in/mumbai/metro-line-3-phase-2-opens-up-to-worli-promises-boost-in-ridership-with-seamless-connectivity)
- After the full opening: 38.63 lakh in Oct 2025, 46.56 lakh in Dec 2025; weekday average ~1.48 lakh (Jan 2026) — [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-metro-3-ridership-more-than-doubles-after-aqua-line-opens-till-cuffe-parade-daily-footfall-hits-new-highs)
- Cumulative 3,02,71,168 by early Feb 2026, Marol Naka top station in January 2026 — [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-metro-aqua-line-3-crosses-3-crore-ridership-marol-naka-tops-january-footfall)
- 4 crore cumulative in April 2026 — [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-metro-3-aqua-line-achieves-mega-milestone-as-ridership-crosses-4-crore-mark-on-335-km-underground-corridor); [Mumbai Live](https://www.mumbailive.com/en/civic/mumbai-metro-3-crosses-4-crore-mark-ridership-on-fully-underground-corridor-92355)
- September 2026: weekday average 2,24,602; weekend average 1,31,138 — [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-metro-line-3-boosts-train-frequency-with-46-additional-weekday-trips-amid-rising-passenger-demand)
- First full year: 72,088,738 journeys; MMRC marked it with a commuter stamp trail and a time capsule to be opened in 2036 — [Urban Acres](https://urbanacres.in/mumbai-metro-aqua-line-crosses-7-2-crore-journeys-in-first-year/); [Lokmat Times](https://www.lokmattimes.com/mumbai/mumbai-metro-update-aqua-line-crosses-7-crore-passenger-journeys-in-first-year-of-full-route-operations-a525/amp/)

### Inferences
- Crowd density for the game: Line 1 is roughly twice as busy per day as Line 3 on a quarter of the length — the Ghatkopar–Andheri section at peak should look packed (the "Ghatkopar crush"); Line 3 is busy but roomier, with weekend traffic ~60 % of weekdays.
- The "Marol Naka busiest in 10 days after launch" figure (2 lakh in 10 days ≈ 20,000/day) matches Phase 1 levels, so it most likely dates from Oct 2024, not Oct 2025.

### Gaps
- No 2026 Line 1 daily average or record found.
- Line 3 single-day record and a 2026 station-by-station ranking (beyond Marol Naka topping January 2026) not found.

## 7. Notable events and quirks (game flavour)

### Takeaway
Best flavour: Line 3's Acharya Atre Chowk station flooding with muddy water on 26 May 2025 (earliest monsoon onset in 75 years), leaks at BKC, sponsor-branded station names, the stamp trail and 2036 time capsule; Line 1's packed Ghatkopar–Andheri trains, six-coach upgrade, festival late runs, and its owner's debt and arbitration fights with MMRDA.

### Cited Findings
- 26 May 2025: heavy rain inundated the underground Acharya Atre Chowk station (platforms, tracks and concourse filled with muddy water in viral videos); services suspended between Acharya Atre Chowk and Worli; Mumbai's earliest monsoon onset in 75 years — [The Week/PTI](https://www.theweek.in/wire-updates/national/2025/05/26/bom56-mh-rain-ld-metro.html); [DT Next](https://www.dtnext.in/headlines/mumbai-sees-earliest-monsoon-onset-in-75-years-aqua-line-station-inundated-834948)
- MMRC's explanation: an RCC water-retaining wall at an (under-construction) entry/exit collapsed after sudden ingress from an adjoining utility; a flood bund outside could not cope; MMRC called it "minor" and denied a tunnel leak; Aarey JVLR–Worli services ran normally — [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-metro-3-flooding-mmrc-issues-clarification-denies-tunnel-leak-after-rainwater-enters-acharya-atre-chowk-station)
- Services at Acharya Atre Chowk resumed (one report: Saturday 31 May 2025, 1 pm) — [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-metro-update-aqua-line-3-services-resume-at-acharya-atre-chowk-station-after-rain-disruption)
- Afterwards: plastic sheets, tarpaulins and makeshift concrete walls at entry points flush with the road; minister Ashish Shelar asked for a monsoon contingency plan for crowded metro stations (2 Jun 2025) — [The Week/PTI](https://www.theweek.in/wire-updates/national/2025/06/02/bes15-mh-rains-metro-rail-shelar.html); [Geosquare](https://www.geosquare.in/mumbais-37000-crore-metro-line-3-faces-monsoon-challenges-21695-news.html)
- BKC metro station leaks during a downpour; MP Varsha Gaikwad shared visuals — [Free Press Journal](https://www.freepressjournal.in/amp/mumbai/shame-aqualine-bkc-metro-station-leaks-as-mumbai-faces-heavy-downpour-mp-varsha-gaikwad-shares-visuals-bashing-authorities)
- Counterpoint: Aqua Line kept 100 % punctuality during torrential rains, carrying 14.48 lakh passengers in 9 days — [Free Press Journal](https://www.freepressjournal.in/amp/mumbai/mumbai-metro-aqua-line-maintains-100-per-cent-punctuality-during-torrential-rains-carries-over-1448-lakh-passengers-in-9-days)
- A study flagged accessibility and last-mile problems on the Aqua Line — [Governance Now](https://www.governancenow.com/news/regular-story/study-flags-accessibility-and-lastmile-challenges-on-mumbai-metro-aqua-line)
- Station naming rights: OSM `official_name` tags carry sponsor prefixes (a bank at CSMIA T2, Dadar; a private bank at BKC and CSMT; an insurer at Churchgate and Hutatma Chowk; an adhesive brand at Marol Naka; a small-finance bank at Bandra Colony; a mutual fund at Santacruz) — [OSM extract, Line 3 station nodes](https://www.openstreetmap.org/relation/17876723)
- Line 3 is Mumbai's first fully underground metro — [Outlook Traveller](https://www.outlooktraveller.com/News/mumbais-first-fully-underground-metro-line-is-now-openconnecting-south-to-north-in-record-time)
- First-year stamp trail and 2036 time capsule — [Urban Acres](https://urbanacres.in/mumbai-metro-aqua-line-crosses-7-2-crore-journeys-in-first-year/)
- Line 1: 88 % of trips on Ghatkopar–Andheri; new service pattern to cut platform crowding; six-coach trains being procured — [Lokmat Times](https://www.lokmattimes.com/mumbai/mumbai-metro-line-1-update-faster-connectivity-on-ghatkopar-andheri-stretch-with-new-service-pattern-to-reduce-platform-crowding-a525/); [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-metro-1-may-soon-get-six-coach-trains-to-ease-rush-hour-crowds)
- Line 1 trains got an overhaul after nine years in service — [Swarajya](https://swarajyamag.com/infrastructure/nine-years-into-service-mumbai-metro-line-one-trains-to-get-an-overhaul)
- Line 1 owner's money troubles: NARCL debt restructuring (Jul 2026), ₹157.64 crore arbitration award against MMRDA (Jul 2026) — [Social News XYZ](https://www.socialnews.xyz/2026/07/10/reliance-infras-mumbai-metro-one-signs-debt-restructuring-pact-with-narcl); [Business Upturn](https://businessupturn.com/business/reliance-infrastructure-awarded-rs-157-64-crore-in-mmrda-arbitration-case/)
- Festival late runs: Ganeshotsav 2026 (Line 1 to 1:03 am; Line 3 to midnight), New Year 2026 (Line 1 +28 services) — [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-metro-one-extends-services-until-103-am-from-september-14-to-25-for-ganeshotsav-2026); [Time Out Mumbai](https://www.timeout.com/mumbai/news/mumbai-aqua-line-extends-its-operations-for-ganesh-chaturthi-090726); [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-new-year-2026-metro-one-to-run-28-additional-late-night-services-on-versovaghatkopar-line)
- Old interchange gaps: Ghatkopar skywalk "a couple of feet" short of the metro; Andheri needing a ~100 m link — [DNA (old)](https://www.dnaindia.com/mumbai/report-dna-special-mumbai-metro-local-integration-awaits-nod-1959478)
- OSM mapper's note on Santacruz entrances: wheelchair ramps lead up from the pavement but there is no separate footpath to map them — [OSM extract, Santacruz entrances](https://www.openstreetmap.org/relation/17876723)

### Inferences
- Game-ready gags (all fictionalised): a monsoon event that floods one underground station entrance (sandbags/tarpaulins, "minor water ingress" announcements); sponsor-named stations with parody brands; a Line 1 "push-in" at Ghatkopar at peak; a passport-style stamp trail as a collectible; late "Ganpati specials" with crowds in festival clothes.
- Entrances flush with the road were the weak point in the 2025 flood — useful detail for modelling Line 3 entrances (raised plinths/steps after 2025).

### Gaps
- Line 1 fare-hike disputes (2014–2015 court case over fares) and the Aarey car-shed tree-felling protests (2019) were not researched in this session; both are known flavour topics but need sourcing before use.
- No detail found on Line 3 stacked platforms, station art/design themes, or announcements/jingles.
