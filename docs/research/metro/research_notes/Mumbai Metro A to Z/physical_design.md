# Physical design of the Mumbai Metro and Monorail (trains, viaducts, tunnels, stations, signage, sounds) — state as of November 2026

Research note, 2026-11-14. Method and source quality:
- In this session, direct page fetching was blocked for every outside site tried (DNS failure: en.wikipedia.org,
  themetrorailguy.com, railwaynews.net, alstom.com, and by curl also freepressjournal.in, kiwix mirrors, wikiwand).
  Only web search worked. So every finding below comes from search-result extracts and summaries of the linked pages,
  not from reading the full pages. Treat numbers as "reported by the linked page", and check them against the page
  (or Wikipedia, MMRDA/MMRCL documents) before relying on them for anything other than a game.
- Many numbers the owner asked for (exact car lengths, door counts, hex colours, announcement wording) were not found
  in any source the search could reach. They are listed under **Gaps**. Where a game needs a number anyway, the
  **Inferences** give clearly marked estimates.

---

## 0. Which lines physically exist and run (context for what to model), November 2026

### Takeaway
Running in November 2026: Line 1 (Blue, elevated), Lines 2A and 7 (Yellow and Red, elevated, one system), Line 3
(Aqua, underground, fully open since October 2025), Line 9 phase 1 and Line 2B phase 1 (both opened April 2026).
Line 4 (Green) was not yet open. The Monorail was suspended from 20 September 2025; it had all safety clearances by
mid-2026, but no source found confirms that passenger service had resumed by November 2026.

### Cited Findings
- Line 1: 11.4 km, fully elevated, 12 stations, Versova to Ghatkopar (sources also give 10.8 km / 11.07 km) — [railway-technology.com](https://www.railway-technology.com/projects/mumbai-metro/); [Wikipedia, Line 1 (via search)](https://en.wikipedia.org/wiki/Line_1_(Mumbai_Metro))
- Line 2A: Dahisar (E) to D.N. Nagar, 18.6 km, 17 stations; Line 2B: D.N. Nagar to Mandale, 23.6 km, 22 stations; Line 7: Andheri (E) to Dahisar (E), 16.5 km, 16 stations — [ADB due-diligence report](https://ewsdata.rightsindevelopment.org/files/documents/07/ADB-49469-007_WRK3Opx.pdf)
- Lines 2A and 7 were inaugurated by the Prime Minister on 19 January (2023), with passenger services from the next day; an earlier first phase opened in April 2022 — [Railway Gazette](https://www.railwaygazette.com/metro/mumbai-metro-lines-extended-south/63432.article); [The Metro Rail Guy, April 2022](https://themetrorailguy.com/2022/04/02/pics-mumbai-metros-line-2a-line-7-inaugurated/)
- Line 2 (2A + 2B, 42.2 km) is officially the Yellow Line; Line 7 (with 7A and 9, 31 km) is the Red Line. Lines 2A and 7 share the Charkop depot — [The Metro Rail Guy, BEML Red Line rendering](https://themetrorailguy.com/2020/08/01/beml-reveals-mumbai-metro-red-lines-train-rendering/)
- Line 3 (Aqua Line): 33.5 km, 27 stations, 26 underground and 1 at grade (Aarey JVLR). First section inaugurated 5 October 2024 (commercial service from 7 October 2024); the line became fully operational a year later (final Worli–Cuffe Parade section opened 9 October 2025) — [Constructionworld](https://www.constructionworld.in/transport-infrastructure/metro-rail-and-railways-infrastructure/inaugural-colaba-seepz-metro--mumbai-s-underground-marvel/41593); [Wikipedia Aqua Line (via search)](https://en.wikipedia.org/wiki/Aqua_Line_(Mumbai_Metro)); [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-metro-line-3-becomes-fully-operational-promises-faster-sustainable-commute-across-city)
- Line 9 phase 1, Dahisar East to Kashigaon (4 stations: Dahisar East, Pandurang Wadi, Miragaon, Kashigaon; 4.5–5.6 km depending on source), was inaugurated 7 April 2026; commercial service began 8 April 2026 — [ThePrint/PTI](https://theprint.in/india/mumbai-metro-lines-9-and-2b-open-for-commuters/2899298); [Wikipedia, Kashigaon station (via search)](https://en.wikipedia.org/wiki/Kashigaon_metro_station)
- Line 2B phase 1 opened in April 2026: 5 stations (Diamond Garden (Chembur), Chhatrapati Shivaji Maharaj Chowk (Chembur), Deonar, Mankhurd, Mandale), about 5.5 km, fully elevated; one source gives 13 August 2026 for a Chembur station — [Gruppo FS Engineering](https://www.gruppofsengineering.it/en/media-and-contacts/news-and-press-releases/2026/4/17/phase-one-of-the-mumbai-metro-line-2b-starts-operating.html); [Time Out Mumbai](https://www.timeout.com/mumbai/news/mumbai-metro-gets-a-new-chembur-station-as-line-2b-expands-081426)
- Line 4 (Green): no section open to passengers per a recent project page; Wikipedia lists openings for December 2026 / 2027 — [Metro Rail News project page](https://metrorailnews.in/projects/mumbai-metro-line-4/); [Wikipedia Green Line (via search)](https://en.wikipedia.org/wiki/Green_Line_(Mumbai_Metro))
- Monorail: suspended from 20 September 2025 after repeated breakdowns; 10 new Medha–SMH Rail rakes plus a CBTC (communication-based train control) retrofit; independent safety certificate (Bureau Veritas) February 2026; final Commissioner of Metro Rail Safety clearance reported June 2026; still not reopened in late July 2026 reports; operations and maintenance contract to Power Mech Projects (letter of acceptance 8 April 2026) — [Free Press Journal](https://www.freepressjournal.in/mumbai/mmrda-gets-final-safety-clearance-for-monorail-seeks-state-nod-to-resume-services); [Free Press Journal, restart delayed](https://freepressjournal.in/mumbai/mumbai-monorail-restart-delayed-despite-safety-clearances-commuters-await-official-reopening-date-video); [Business Standard](https://www.business-standard.com/india-news/mmrda-temporarily-halts-mumbai-monorail-for-upgrades-fleet-overhaul-125092000131_1.html); [Constructionworld](https://www.constructionworld.in/amp/transport-infrastructure/metro-rail-and-railways-infrastructure/mmmocl-awards-mumbai-monorail-o-m-contract-to-power-mech-projects-/90666)

### Inferences
- For a game set in November 2026, the Monorail is best modelled as built (beams, stations, trains) but with an
  uncertain service state; a "reopened with new trains" state is plausible but not confirmed.

### Gaps
- No source confirmed Monorail service resumption between August and November 2026.
- Exact opening dates of Line 2B stations after phase 1 conflict between sources.

---

## 1. Rolling stock per line

### Takeaway
All metro lines are standard gauge (1,435 mm) with 25 kV AC overhead power; the Monorail is 750 V DC (third rail on
the beam). Car width is 3.2 m on Lines 1, 2A/7 and 3. Line 1 runs 4-car CRRC (ex-CSR) Nanjing Puzhen trains; Lines
2A/7 (and 2B, 9) run 6-car BEML stainless-steel trains; Line 3 runs 8-car Alstom Metropolis trains 177.2 m long built
at Sri City. Exact car lengths, heights and door counts were not found in reachable sources.

### Cited Findings

**Line 1 (Blue, Versova–Andheri–Ghatkopar; operator Mumbai Metro One Private Limited)**
- 16 four-car trains from CSR Nanjing Puzhen (now CRRC Nanjing Puzhen), Rs 6 billion contract; option for 18 six-car sets — [Railway Gazette 2008](https://railwaygazette.com/mumbai-car-order/33191.article); [Lok Sabha reply (eparlib)](https://eparlib.nic.in/bitstream/123456789/580900/1/85435.pdf)
- Power: 25 kV 50 Hz AC overhead catenary; standard gauge 1,435 mm (1,500 V DC belongs to the old suburban railway, not the metro) — [Wikipedia Blue Line infobox (via search)](https://en.wikipedia.org/wiki/Blue_Line_(Mumbai_Metro))
- Car width 3.2 m ("similar to the CRRC stock on the 11.4 km Line-1") — [The Metro Rail Guy](https://themetrorailguy.com/2020/01/18/dmrc-mmrda-inspect-mumbai-metro-line-2-7s-beml-rolling-stock/)
- Maximum speed about 80 km/h — [trainhelp.in](https://trainhelp.in/mumbai-metro/amp)
- Capacity: about 1,178 passengers per 4-car train, about 1,792 per 6-car train — [Constructionworld](https://www.constructionworld.in/transport-infrastructure/metro-rail-and-railways-infrastructure/mumbai-metro-one-plans-22-new-coaches-to-expand-capacity/98518); [Metro Rail News](https://www.metrorailnews.in/mumbai-metro-somaiya-asks-mmrda-and-reliance-to-increase-number-of-coaches-on-metro-1/); contradicted by "1,500 in 4 cars, 2,250 in 6" — [trainhelp.in](https://trainhelp.in/mumbai-metro/amp)
- Plans to add 22 coaches / move to six-coach trains to ease rush hour — [Constructionworld](https://www.constructionworld.in/amp/transport-infrastructure/metro-rail-and-railways-infrastructure/mumbai-metro-one-plans-22-new-coaches-to-expand-capacity/98518); [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-metro-1-may-soon-get-six-coach-trains-to-ease-rush-hour-crowds)

**Lines 2A and 7 (also 2B, 9) — BEML "MRS-1"**
- Original 2018 order: 378 cars = 63 six-car trains for Lines 2A, 2B and 7; later reporting gives 96 six-car trainsets (576 cars) after extensions — [Railway Gazette](https://www.railwaygazette.com/metro/beml-to-supply-378-metro-cars-to-mumbai/47603.article); [Metro Rail News](https://metrorailnews.in/mumbai-metro-beml-supplies-55th-driverless-metro-trainset-for-line-27/); [Free Press Journal](https://www.freepressjournal.in/mumbai/mmrda-orders-12-additional-train-sets-for-extension-of-mumbai-metro-2a-and-7)
- 3.2 m wide coaches, standard gauge, 25 kV overhead traction — [Railway Gazette](https://www.railwaygazette.com/metro/beml-to-supply-378-metro-cars-to-mumbai/47603.article); [PIB (government release)](https://pib.gov.in/PressReleasePage.aspx?PRID=1553627)
- Capacity: about 2,306 passengers per 6-car train with 298 seats — [PSU Connect](https://www.psuconnect.in/infopedia/beml-unveils-driverless-metro-train-set-for-line-2--7-in-mumbai); earlier figures: 1,800 per train / 300 per coach — [Railway Gazette](https://www.railwaygazette.com/metro/beml-to-supply-378-metro-cars-to-mumbai/47603.article)
- Signalling: CBTC for driverless operation ("Unattended Train Operation, GoA 4" = Grade of Automation 4) — [BEML press release](https://www.bemlindia.in/wp-content/uploads/2024/11/15072024.pdf); [Metro Rail News](https://metrorailnews.in/mumbai-metro-beml-supplies-55th-driverless-metro-trainset-for-line-27/)
- Body: stainless steel with "2J" (matt) finish, covered with coloured graphic films; first design (July 2019) had yellow top and bottom stripes; a 2020 BEML brochure showed a red-striped version — [The Metro Rail Guy](https://themetrorailguy.com/2020/08/01/beml-reveals-mumbai-metro-red-lines-train-rendering/)
- Air-conditioning, regenerative braking, CCTV — [Railway Gazette](https://www.railwaygazette.com/metro/beml-to-supply-378-metro-cars-to-mumbai/47603.article)

**Line 3 (Aqua) — Alstom Metropolis**
- 31 eight-car trains, 248 cars, contract about EUR 315 million (2018), "lightweight, fully furnished" — [Railway Gazette](https://www.railwaygazette.com/modes/alstom-to-supply-31-driverless-trains-to-mumbai/46843.article); [Railway News](https://railway-news.com/mumbai-metro-alstom-wins-contract-248-cars/)
- Width 3.2 m; train length about 180 m (contract-stage figure) — [Free Press Journal 2018 (PressReader)](https://www.pressreader.com/india/the-free-press-journal/20180720/281590946348063)
- Train length 177.2 m; about 3,000 passengers per train — [International Railway Journal](https://www.railjournal.com/passenger/metros/mumbai-metro-line-3-train-design-revealed/)
- Built at Alstom's Sri City plant (Andhra Pradesh) — [Wikipedia Aqua Line (via search)](https://en.wikipedia.org/wiki/Aqua_Line_(Mumbai_Metro)); [The Machine Maker](https://themachinemaker.com/news/alstom-trainset-for-mumbai-metro-line-3-eknath-shinde-flagged-off/)
- Generic Metropolis range (not the Mumbai order): car length 18–24 m (up to 25 m), width 2.7–3.2 m, 3–5 doors per side — [Alstom Metropolis product sheet](https://alstom.com/sites/alstom.com/files/2021/09/17/Alstom_Product_Sheet_Metropolis_EN.pdf)
- Power: 25 kV single-phase AC; rigid overhead conductor system (ROCS) in the tunnels — [Railway Gazette](https://www.railwaygazette.com/infrastructure/mumbai-metro-line-3-electrification-contracts-awarded/45998.article); [MMRCL project page](https://www.mmrcl.com/en/node/10)
- Signalling: Alstom Urbalis 400 CBTC; trains described as "driverless" / "highly automated" — [Railway Gazette](https://www.railwaygazette.com/infrastructure/mumbai-metro-line-3-electrification-contracts-awarded/45998.article); [Railway News](https://railway-news.com/mumbai-metro-aqua-line-inaugurated-with-alstoms-driverless-trains/); [Rolling Stock World](https://rollingstockworld.com/lrv/mumbai-opens-new-metro-line-with-alstoms-highly-automated-train/)
- Speed: top speed 90 km/h per a guide; trials run at up to 95 km/h — [MMRCL trial-run note](https://corporate.mmrcl.com/sites/default/files/MMRC-MML-3-About%20Train%20Trial%20Runs-August%202022-1_1.pdf); [Swarajya](https://swarajyamag.com/reports/tracking-mumbai-metro-line-3-with-84-per-cent-work-completed-phase-1-on-track-to-be-operational-by-2023)
- Design theme "Dynamic Fluidism": exterior "inspired by the vital flow of water"; interior beige (comfort) + arctic/aqua green (freshness), "inspired by the people of Mumbai ... who turn to the sea for peace" — [International Railway Journal](https://www.railjournal.com/passenger/metros/mumbai-metro-line-3-train-design-revealed/); [Zee Business (mock-up photos)](https://www.zeebiz.com/india/news-mumbai-metro-line-3-mock-up-trainset-unveiled-here-is-how-it-looks-see-pics-113771)
- Interior: high-density layout, three rows of grab rails, grab handles, poles, luggage space, a wheelchair space in every car, large emergency detrainment doors at the ends — [Alstom mock-up release (via search)](https://www.alstom.com/press-releases-news/2019/11/alstom-unveils-life-sized-mock-mumbai-metro-line-3-aqua-line-rolling); [Railway Technology](https://www.railway-technology.com/news/alstom-reveals-life-sized-mock-up-of-trainset-for-mumbai-metro-line-3/)

**Monorail (Line 1, Chembur–Sant Gadge Maharaj Chowk / Jacob Circle)**
- Scomi SUTRA: 750 V DC through a third rail / contact shoe on the beam; width 3.08 m including doors; height 4.72 m; floor height 2.1 m; end car 11.2 m, intermediate car 9.5 m — [Wikipedia, Scomi SUTRA (via search)](https://en.wikipedia.org/wiki/Scomi_SUTRA)
- New rakes: 10 four-car rakes from a Medha Servo Drives (Hyderabad) – SMH Rail (Malaysia) joint venture (2022, about Rs 590 crore); made in India; lighter (less load on beams and piers) and carry about 10 % more passengers — [Railway Technology](https://www.railway-technology.com/news/smh-rail-monorail-cars-india/); [Railpost](https://railpost.in/medha-bags-mumbai-monorail-order-for-10-rakes-delivery-starts-january-2023); [Free Malaysia Today](https://www.freemalaysiatoday.com/category//2022/04/27/smh-rail-wins-mumbai-monorail-project-worth-us85mil/)
- New trains come with "21 upgrades": CCTV in every coach, accessible seating, charging points, dynamic route maps; CBTC signalling — [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-monorail-to-restart-with-21-new-features-including-cctv-charging-points-dynamic-route-maps-advanced-cbtc-signalling)
- A new Medha rake was damaged during a system test (operator: internal trial) — [Metro Rail Today](https://metrorailtoday.com/news/new-mumbai-monorail-rake-by-medha-servo-drives-damaged-during-system-test)

### Inferences
- **Car lengths (estimates):** Line 3: 177.2 m / 8 cars ≈ 22.15 m per car (over couplers). Lines 2A/7: 6 cars on
  140 m platforms (see section 3) fits cars of about 21.5–22 m (train ≈ 130–135 m). Line 1: 4 cars of a similar
  3.2 m-wide standard-gauge design, probably about 20–22 m each (train ≈ 80–90 m). None of these per-car figures is sourced.
- **Unsourced typical values for Indian 3.2 m-wide standard-gauge metro cars (use as game defaults only):** body
  height about 3.8–3.9 m above rail, floor about 1.1 m above rail, 4 double doors per side about 1.4 m wide,
  longitudinal (side-facing) stainless-steel or composite seats, 3 rows of grab rails/poles, LCD route maps above doors.
- Capacity "per m²" splits (6 and 8 persons per m²) were not found; Indian tender capacities are usually quoted at
  6 persons per m² ("normal") and 8 per m² ("crush"); treat 2,306 (Line 2A/7) and 3,000 (Line 3) as crush-like figures.
- The Line 2A/7 trains run with a train operator in practice (an operator page notes door closing is "managed by Train
  Operator", see section 7), even though the stock is GoA 4-capable. For a game: show a driver cab with a person.
- Livery for a game: BEML trains = matt stainless body with line-colour film stripes (yellow for 2A, red for 7);
  Aqua Line = light body with aqua/teal-green accents and beige interior. Line 1 livery details were not found.

### Gaps
- Exact car length, height, floor height, door count and door width for any metro line: not found.
- Acceleration and braking rates: not found (Indian metro tenders commonly specify about 1.0 m/s² acceleration and
  about 1.1–1.3 m/s² service braking — unsourced general knowledge).
- Line 1 exterior livery and interior colours; Line 2A/7 interior seat colours: not found.
- Whether Line 3 actually runs in GoA 4 (unattended) today or with an attendant: not confirmed.
- Medha–SMH monorail rake capacity, speed and dimensions: not found.

---

## 2. Viaducts (piers, girders, heights, double-deckers)

### Takeaway
Elevated metro lines run on single piers in the road median carrying twin precast U-girders (one U per track),
spans mostly 25–28 m (Line 1 has many 26–30 m spans); the two-track deck is about 10.55 m wide; rail level is
typically about 13 m above ground (21 m where Line 2A crosses Line 1). Line 9 has a double-decker section (road
flyover on the lower deck, metro on top) in Mira–Bhayandar.

### Cited Findings
- Line 2A: U-girders standardised (designer Systra), maximum span 28 m "for optimised section and handling"; precast I-girders with cast-in-situ deck on curves under 300 m radius and at scissors crossovers; overall superstructure width 10.55 m at two-track locations (wider where 3–4 tracks) — [NBMCW, Line 2A precast paper](https://nbmcw.com/product-technology/precast/mumbai-metro-line-2a-use-of-precast-construction-in-urban-infrastructure-projects.html)
- Line 2A rail level generally about 13 m above ground; about 21 m at D.N. Nagar where it crosses Line 1 — [NBMCW](https://www.nbmcw.com/product-technology/precast/mumbai-metro-line-2a-use-of-precast-construction-in-urban-infrastructure-projects.html)
- Line 6 (DPR, detailed project report): standard span 25 m, precast twin U-girders on a single pier with pile/open foundations; twin U-girders need wide pier caps across the road — [NBMCW, Line 6](https://nbmcw.com/product-technology/precast/advantages-of-precast-concrete-technology-in-metro-project-line-06-mumbai-metro.html)
- Line 1: U-girders, with 247 girders in the 26–30 m span range; piers in the road median; about 4.5 m minimum clear distance from a pier to new structures; piles about 15 m deep (about 18 m for spans of 40 m and above) — [Scribd overview](https://www.scribd.com/presentation/438092507/Mumbai-Metro); [ResearchGate](https://www.researchgate.net/publication/341733838_A_Concept_of_Underpass_Metro_Elevated_Structure_in_Mumbai_Region)
- Preliminary design (unbuilt Ghatkopar–Mulund extension): U-girder depth 2.15 m, simply supported spans 25 m or 30 m; U-girders reduce the visual height — [Pedelta](https://www.pedelta.com/preliminary-design-of-viaduct-for-the-mumbai-metro-p-87-en)
- Where a metro crosses a road flyover, the bottom of the pier cap is at least 5.5 m above the flyover deck (Indian Roads Congress clearance) — [Railanalysis / MMRDA release (via search)](https://news.railanalysis.com/?p=36774)
- Line 2B passes over the Monorail at Vashi Naka (Chembur): U-girder about 18 m above ground, 5.6 m clear above the monorail beam — [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-news-metro-2b-to-ply-above-monorail-thanks-to-u-girder)
- Line 2B was permitted to cross Central Railway at a height of 13 m — [Wikipedia Line 2 (via search)](https://Www.wikipedia.org/wiki/Line_2_(Mumbai_Metro))
- Long steel spans: 42 m steel composite span (168 t) on Line 6 over Western Railway; 56 m girders over the Western Express Highway and Line 7 — [Free Press Journal](https://www.freepressjournal.in/mumbai/mmrda-achieves-major-engineering-milestone-on-mumbai-metro-line-6-completes-42m-steel-span-weighing-168-tonnes-over-western-railway); [The Metro Rail Guy](https://themetrorailguy.com/?p=50041)
- Double-decker: a 1 km double-decker flyover in Mira–Bhayandar combines a road flyover and the Line 9 metro viaduct (opened 2024); road on the first deck, metro on the second; a 65 m girder was launched near Bhayandar — [Deccan Herald](https://www.deccanherald.com/india/maharashtra/first-double-decker-flyover-with-metro-viaduct-in-mumbai-metropolitan-region-opens-to-traffic-3167670); [Free Press Journal](https://www.freepressjournal.in/mumbai/mmrda-achieves-key-milestone-as-it-launches-65-meter-girder-for-mumbais-double-decker-metro-line-9-near-bhayandar); [Wikipedia Line 9 (via search)](https://wikipedia.com/wiki/Line_9_(Mumbai_Metro))
- 2018 plans: Line 4 to be built with three flyovers on its alignment; Line 2B to share common piers with the proposed Kalanagar flyover (whether built this way is not confirmed) — [Asian Age](https://www.asianage.com/metros/mumbai/011018/metro-4-9-to-be-built-along-with-flyovers.html)
- Metro piers are painted in each line's colour: about 2,500 pillars marked by colour code — [Mumbai Live](https://www.mumbailive.com/en/transport/mumbai-metro-corridors-marked-with-2500-painted-pillars-as-per-decided-colour-codes-89446)

### Inferences
- **Game cross-section (two-track viaduct):** two U-girders side by side, total width ≈ 10.5 m, U depth ≈ 2.0–2.2 m,
  rail level ≈ 13 m above road → girder underside ≈ 11 m; single pier in the median (width roughly 1.8–2.0 m,
  unsourced) with a wide hammerhead pier cap (≈ 10–11 m across). Spans: 25–28 m (Lines 2A/7/2B/4/9), 26–30 m
  (Line 1); long steel spans 40–65 m over railways, highways and creeks.
- Each U-girder's side walls double as a low parapet/noise wall (U-girders hide the wheels); separate tall noise
  barriers were not reported on Mumbai metro viaducts.
- Pier colour bands: a band or full-height paint in the line colour (yellow on 2A/2B, red on 7/9, blue for Line 1)
  is a cheap and recognisable way to tell lines apart in the game.

### Gaps
- Official pier heights (typical and range), pier shape and dimensions per line: not found.
- Whether Line 1 uses U-girders throughout or box girders in places: only the Scribd overview (U-girders) was found.
- Noise barriers on Mumbai metro viaducts: no source found (search returned only the bullet-train corridor).

---

## 3. Elevated stations

### Takeaway
Lines 2A/7-style stations are three-level (street, concourse, platform) buildings cantilevered from single median
piers, with 140 m side platforms about 6.45 m above the concourse, rail level about 13 m above ground. Line 1 has 12
elevated side-platform stations (Ghatkopar has an island). Exact widths and roof geometry were not found.

### Cited Findings
- Line 2A stations: all "conceptualised as cantilever structure"; tracks, platform and concourse supported on a single pier in the median; three levels (street, concourse, platform); concourse and platform floors precast (cross arms, longitudinal girders, slab); platform about 6.45 m above concourse at all stations — [NBMCW](https://www.nbmcw.com/product-technology/precast/mumbai-metro-line-2a-use-of-precast-construction-in-urban-infrastructure-projects.html)
- Line 2A stations need 11 pier caps each to carry the 140 m long platforms on either side and the viaduct in the centre (i.e. side platforms) — [The Metro Rail Guy](https://themetrorailguy.com/2018/02/15/j-kumar-launches-1st-platform-pier-cap-for-mumbai-metro-line-2/)
- Line 7 stations were built on a single pier — [Wikipedia Line 7 mirror (via search)](https://exl.pages.dev/Line_7_(Mumbai_Metro))
- Escalators (pre-opening plan): 82 for Line 7, 105 for Line 2A — [togethervcan.in](https://togethervcan.in/?p=5379)
- Facade contracts covered e.g. Aarey, Dindoshi, Kurar and Poisar stations (Line 7) — [The Metro Rail Guy](https://themetrorailguy.com/2020/09/24/j-kumar-awarded-mumbai-metro-line-2-7s-station-facade-contracts/)
- Line 4 DPR: stations cantilevered leaving 10.5 m of road either side of the median; concourse below, platforms above; platforms planned for 8-car trains — [Line 4 DPR (SlideShare)](https://www.slideshare.net/slideshow/detailed-project-report-metro-line-4-updated/270780222)
- Line 1: 12 elevated stations with side platforms; Ghatkopar is an island platform — [Scribd](https://www.scribd.com/presentation/438092507/Mumbai-Metro); [Wikipedia Ghatkopar station (via search)](https://en.wikipedia.org/wiki/Ghatkopar_metro_station)
- An architecture portfolio describes a Mumbai metro station as a steel-and-glass canopy, a jaali (lattice)-like roof of curved steel plate girders with openings in polycarbonate sheet for daylight; non-air-conditioned, naturally ventilated platform (line not named) — [MGS Architecture](https://www.mgsarchitecture.in/architecture-design/projects/art-architecture.html)
- MMRDA metro stations are credited to the architecture practice Studio Archohm (lines not named) — [ArchDaily](https://www.archdaily.com/986084/mumbai-metro-archohm/{{img}}); [Archello](https://archello.com/project/mumbai-metro)
- Interchange links: a 58 m foot-over-bridge links Line 1 (Western Express Highway station) with Line 7 (Gundavali), built in 15 days; footbridges also link stations to malls (e.g. Devipada–Skycity Mall, Borivali) and four are planned on Line 4 to suburban stations — [Free Press Journal](https://www.freepressjournal.in/amp/mumbai/mumbai-mmrda-completes-58m-long-fob-linking-2-metro-lines-in-15-days); [Propnewstime](https://propnewstime.com/latestnewsstories/MTYxNjU=/mumbai-opens-fob-linking-devipada-metro-station-with-skycity-mall-in-borivali); [Swarajya](https://swarajyamag.com/amp/story/news-brief/four-foot-overbridges-planned-for-mumbai-metro-green-line-to-boost-last-mile-connectivity-link-suburban-railway-stations)
- Platform screen doors are fitted on Lines 2A and 7 (first in Mumbai elevated stations; glitches reported); transparent screen doors 1.2 m high reported for MMRDA lines — [Free Press Journal](https://www.freepressjournal.in/amp/mumbai/mumbai-metro-line-2a7-platform-screen-doors-at-metro-stations-report-glitch-watch-video); [Free Press Journal 2021 (PressReader)](https://www.pressreader.com/india/the-free-press-journal/20210301/281801401691304)
- Monorail stations: four escalators each (two street→concourse, two concourse→platform) — [Wikipedia Mumbai Monorail (via search)](https://en.wikipedia.org/wiki/Mumbai_Monorail)

### Inferences
- **Game model of a Line 2A/7 station (estimates built on the cited heights):** a box about 140–150 m long,
  roughly 20–24 m wide (wider than the 10.5 m viaduct because side platforms of about 4–5 m are added on each side;
  width unsourced), straddling the road on a row of single median piers with wide cross-arms; concourse floor about
  7–8 m above road (platform ≈ rail level + ≈1.1 m ≈ 14 m, minus 6.45 m); platform level ≈ 14 m. Entrances: stair
  + escalator pairs and a lift tower landing on the footpaths on both sides of the road (typically 2–4 entries).
- Roof: a long curved or pitched metal roof over the platforms with translucent strips, open or louvred side walls
  (naturally ventilated platforms); glazed or perforated metal facade panels on the concourse.
- Half-height (≈1.2 m) glass platform screen doors on 2A/7 platforms; Line 1 platforms have open edges (no source
  says Line 1 has screen doors).

### Gaps
- Station width, roof profile, concourse height above road, number of entries per station: not found as numbers.
- Line colour accents used inside 2A/7 stations: not found (signage uses a black background, see section 6).
- Line 1 platform length: not found (Line 1 was ordered with an option for 6-car trains, which suggests platforms
  sized for 6 cars — an inference only).

---

## 4. Underground (Line 3, Aqua Line)

### Takeaway
Twin single-track bored tunnels (17 tunnel boring machines, about 6.5–6.65 m excavated, 5.8 m finished inside
diameter), typically 15–25 m below the surface, 26 underground stations (20 cut-and-cover, 7 mined by NATM in the
dense old city), platform screen doors by Alstom, and heritage-sensitive street entrances (open-to-sky stone and
glass at Hutatma Chowk; a glass dome facing the CSMT terminus).

### Cited Findings
- 17 tunnel boring machines in 7 civil contracts dug about 55 km of tunnel with a 5.8 m finished diameter; average excavated diameter 6.5 m; two Robbins machines were 6.65 m — [MMRCL press release](https://corporate.mmrcl.com/sites/default/files/Press%20Release%20-%20MMRC%20achieves%20its%20Final%20Breakthrough%20at%20Mumbai%20Central%20Metro%20Station..pdf); [Tunnels and Tunnelling](https://tunnelsandtunnelling.com/?p=8412)
- Depth: tunnels "25–30 metres below the ground" (early MMRC note); TBMs with only 15–20 m of cover (TunnelTalk); average depth 15–25 m for the Cuffe Parade–Vidhan Bhavan–Churchgate–Hutatma Chowk package (SYSTRA); about 20 m average on one drive — [MMRCL media note](https://corporate.mmrcl.com/sites/default/files/Media%20Note_0.pdf); [TunnelTalk](https://tunneltalk.com/India-12Mar2020-Mumbai-Metro-Line-3-excavation-methods-advance-and-statistics.php); [SYSTRA](https://www.systra.com/india/project/mumbai-metro-line-3/)
- Airport T2 station about 30 m below ground (reported as deepest) — [Wikipedia, CSMIA T2 station (via search)](https://en.wikipedia.org/wiki/Chhatrapati_Shivaji_Maharaj_International_Airport_-_T2_metro_station)
- Construction: Hutatma Chowk, Kalbadevi, Girgaon, Grant Road, Shitladevi, Santacruz and Marol Naka built by NATM (mined); the other 20 underground stations by cut-and-cover — [Hexahome guide](https://www.hexahome.in/blog/guides/metro-line-3-mumbai/); [TunnelTalk](https://tunneltalk.com/India-12Mar2020-Mumbai-Metro-Line-3-excavation-methods-advance-and-statistics.php)
- Station boxes: Cuffe Parade and BKC stations up to 450 m long including crossovers; at Kalbadevi the road was too narrow, so two cut-and-cover boxes about 50.3 m apart with the platform section mined between them (the source says the spacing avoids "MML1 viaduct piers"; which structure that means at Kalbadevi is unclear) — [Indian Infrastructure, July 2026](https://indianinfrastructure.com/2026/07/03/tunnelling-through-complexity-mmrcls-experience-in-executing-indias-first-fully-underground-metro-corridor/)
- Kalbadevi, Girgaon, Hutatma Chowk are island-platform stations — [Wikipedia, List of Mumbai Metro stations (via search)](https://en.wikipedia.org/wiki/List_of_Mumbai_Metro_stations)
- Platform screen doors in every station, in Alstom's Package 12 (signalling, platform screen doors, telecom, SCADA) — [Alstom press release Oct 2024](https://www.alstom.com/press-releases-news/2024/10/mumbai-metro-aqua-line-inaugurated-commercial-operation-trains-and-signalling-solutions-supplied-alstom); [Aurum PropTech guide](https://www.aurumproptech.in/pulse/blog/mumbai-metro-line-3-status-route-stations-guide)
- Hutatma Chowk: entries/exits open to the sky, built from stone and glass, no canopies, designed with heritage architects, Mumbai Heritage Conservation Committee approval; everything except lift shafts and some ventilation structures is underground; escalators rated for outdoor use; public complaints about no roof in the rain — [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-news-mmrcl-faces-public-concern-over-open-air-design-at-hutatma-chowk-metro-station); [MMRCL statement on X](https://x.com/MumbaiMetro3/status/1972640535786741876)
- CSMT station: glass dome at the entrance framing the CSMT building, lattice-style roof admitting daylight, LED lighting at night, murals and art from Mumbai heritage; also described as glass facade with arched entrance — [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-metro-3-first-glimpses-of-iconic-csmt-station-on-aqua-line-unveiled-check-out-visuals); [The Aarch News](https://theaarchnews.com/?p=3440)
- Siddhivinayak station has 7 entry–exit points — [Wikipedia, Siddhivinayak station (via search)](https://en.wikipedia.org/wiki/Siddhivinayak_metro_station)
- Entries are numbered gates (e.g. "A2 gate lift" at Vidhan Bhavan, "A4 gate" at Churchgate), opened in stages — [Free Press Journal](https://www.freepressjournal.in/mumbai/attention-mumbaikars-metro-line-3-announces-opening-of-a2-gate-lift-at-vidhan-bhavan-station-to-ease-passenger-movement); [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-metro-3-passengers-take-note-churchgate-station-a4-gate-temporarily-closed-to-reopen-on-april-6)
- Press "first looks" describe Mahalaxmi, Science Centre (Worli), Cuffe Parade, Siddhivinayak and Dadar interiors as sleek and modern, without a named art theme — [Free Press Journal, Mahalaxmi](https://www.freepressjournal.in/mumbai/mumbai-metro-3-mahalaxmi-station-unveiled-first-inside-images-show-sleek-hub-connecting-to-heart-of-sobo-check-out-visuals); [Free Press Journal, Cuffe Parade](https://www.freepressjournal.in/mumbai/mumbai-metro-3-aqua-line-1st-visuals-of-cuffe-parade-station-unveiled-pics)

### Inferences
- **Game model:** tunnel tube inner diameter 5.8 m (lining ≈ 0.3–0.35 m, so 6.4–6.5 m outside); two tubes about
  12–15 m apart centre to centre between stations (unsourced); top of tunnel 15–25 m below street. Station box:
  island platform about 180–200 m long (to fit a 177.2 m train; unsourced), box roughly 20–25 m wide, 2 levels
  (concourse, platform) under the road; at street level only entrance kiosks (glass/steel canopy with escalator +
  stair, numbered A1, A2, B1…), lift boxes and ventilation shafts. Full-height glass screen doors are the usual
  choice for underground stations (Alstom supplied the doors; height not confirmed).
- Heritage zone entrances (Hutatma Chowk/Flora Fountain, CSMT, Kalbadevi, Girgaon): low, roofless stone-and-glass
  stair/escalator wells and small glass boxes, kept below the heritage skyline.

### Gaps
- Exact station box dimensions, platform length, concourse/platform depths per station, tunnel spacing: not found.
- Height of Line 3 platform screen doors (full or half): not confirmed by any reachable source.
- Station-by-station art themes (murals) beyond CSMT: not found.

---

## 5. Monorail

### Takeaway
A 19.5 km straddle-beam monorail (Chembur–Wadala–Sant Gadge Maharaj Chowk/Jacob Circle, 17 stations) on concrete
beams about 2–3 ft (0.6–0.9 m) wide, at least 5.5 m above the road; Scomi SUTRA trains 3.08 m wide and 4.72 m tall,
750 V DC; new Medha–SMH four-car trains.

### Cited Findings
- 19.54 km corridor between Sant Gadge Maharaj Chowk (Mahalaxmi/Jacob Circle) and Chembur; 17 stations; Wadala Depot between the ends — [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-monorail-to-restart-with-21-new-features-including-cctv-charging-points-dynamic-route-maps-advanced-cbtc-signalling); [Wikipedia, Mumbai Monorail (via search)](https://en.wikipedia.org/wiki/Mumbai_Monorail)
- Fully elevated, minimum height 5.5 m, higher in places — [Wikipedia, Mumbai Monorail (via search)](https://en.wikipedia.org/wiki/Mumbai_Monorail)
- The train straddles a beam "two to three feet wide"; a spec table lists "800 mm guide beam" (ambiguous) — [Wikipedia, Scomi SUTRA (via search)](https://en.wikipedia.org/wiki/Scomi_SUTRA)
- Train: 750 V DC third rail; 3.08 m wide incl. doors; 4.72 m high; floor 2.1 m; end car 11.2 m, middle car 9.5 m — [Wikipedia, Scomi SUTRA (via search)](https://en.wikipedia.org/wiki/Scomi_SUTRA)
- Stations: four escalators each (two street→concourse, two concourse→platform) — [Wikipedia, Mumbai Monorail (via search)](https://en.wikipedia.org/wiki/Mumbai_Monorail)
- Planned 12-rake fleet at an 8-minute interval; frequency goal from 20–25 min to 10 min — [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-monorail-to-resume-with-new-trains-cbtc-system-operational-losses-likely-to-continue); [Swarajya](https://swarajyamag.com/amp/story/infrastructure/mumbai-mmrda-to-receive-10-monorail-rakes-to-increase-frequency-to-10-minutes)
- Line 2B crosses over the monorail at Vashi Naka with 5.6 m clearance above the monorail beam — [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-news-metro-2b-to-ply-above-monorail-thanks-to-u-girder)

### Inferences
- **Game model:** two parallel concrete beams (one per direction), each about 0.7–0.8 m wide and about 1.5 m deep
  (depth unsourced; typical for straddle monorails), on T-shaped piers; beam top roughly 8–12 m above road in most
  places (unsourced; only the 5.5 m minimum clearance is sourced). A 4-car train ≈ 4 × ~10–11 m ≈ 41–43 m (the SUTRA
  table only gives a 2-car length of 23.7 m; four cars = 2 end + 2 middle ≈ 41.4 m).
- Station: short elevated platforms (≈ 45–50 m) between the beams or on both sides, steel roof, two-stage escalators.

### Gaps
- Exact beam width/depth, pier heights, platform length: not found from an official source.
- New Medha–SMH train dimensions, colours, capacity: not found.

---

## 6. Signage and wayfinding (line colours, fonts, languages, name boards)

### Takeaway
Official line colours come from MMRDA's "Brand Vision and Style Guidelines" (28 February 2020, by Systra): Line 1
Blue (by default, Metro One's own colour), Line 2 (A+B) Yellow, Line 3 Aqua, Line 4 Green, Line 5 Orange, Line 6
Pink, Line 7 (+7A, 9) Red, Line 8 Gold, Line 14 Magenta. MMRDA station signs use a black background; station name
boards on Line 3 are Marathi + English, other signs trilingual (Marathi, Hindi, English). No official hex values or
font names were found.

### Cited Findings
- MMRDA released "Brand Vision and Style Guidelines" setting design rules and official line colours; consultant Systra MVA; Line 3 (Aqua) was the only line with a colour before; Line 1 never got an official colour and defaults to blue, "the color utilized by Mumbai Metro One" — [The Metro Rail Guy](https://themetrorailguy.com/2020/02/29/mumbai-metros-official-line-colours-unveiled/); [SYSTRA branding project](https://www.systra.com/en/projects/branding-design-mumbai-metro-india/)
- Colours named in coverage: Line 1 Blue, 2A Yellow, 7 Red, 3 Aqua, 4 Green; Orange for Lines 5 and 12; Pink Line 6; Gold Line 8; Magenta Line 14; Red Line = 7 + 7A + 9; Yellow = 2A + 2B — [housing.com](https://housing.com/news/mumbai-metro/); [The Metro Rail Guy](https://themetrorailguy.com/2020/02/29/mumbai-metros-official-line-colours-unveiled/); [The Metro Rail Guy, Red Line](https://themetrorailguy.com/2020/08/01/beml-reveals-mumbai-metro-red-lines-train-rendering/)
- MMRDA chose a black background for signs across stations; colours make wayfinding "language agnostic"; Systra's signage design was based on Paris Métro, SNCF, Marseille métro and Algiers metro — [Metro Rail News](https://metrorailnews.in/mmrda-unveiled-colours-for-metro-7-2a-signages/)
- Line 3 station name boards in Marathi and English; concourse signage in Marathi, Hindi and English; the MetroConnect3 app in English, Hindi, Marathi — [Free Press Journal](https://www.freepressjournal.in/mumbai/metro-3-phase-2a-nears-completion-station-name-boards-in-marathi-and-english-being-installed); [Free Press Journal](https://www.freepressjournal.in/mumbai/from-bkc-to-siddhivinayak-in-15-mins-inside-mumbais-game-changing-metro-line-3); [Oneindia](https://www.oneindia.com/mumbai/metroconnect3-app-debuts-on-mumbai-metro-3-free-wi-fi-and-digital-tickets-simplify-commute-7884961.html)
- Line 2A/7 ticket scanners show origin, destination and time in Marathi, Hindi and English — [Free Press Journal](https://www.freepressjournal.in/mumbai/heres-how-the-travel-by-new-mumbai-metro-look-like)
- Line colours also painted on piers (about 2,500 pillars) — [Mumbai Live](https://www.mumbailive.com/en/transport/mumbai-metro-corridors-marked-with-2500-painted-pillars-as-per-decided-colour-codes-89446)

### Inferences
- **Game palette (approximations, not official values):** Blue `#1E5AA8`, Yellow `#F2C200`, Aqua `#00A6B4`,
  Red `#D7262E`, Green `#3AA935`, Orange `#F28C1E`, Pink `#E5559A`, Gold `#C9A227`, Magenta `#B5207E`. Check against
  photos; the guideline PDF would have the real values.
- Sign style for the game: black panels, white Latin text, white Devanagari (Marathi) above or beside English, a
  coloured line disc/bar with the line number; station name boards (running-in boards) on platform walls/screen-door
  headers; a generic sans-serif plus a Devanagari face (the game already ships Devanagari sign fonts).

### Gaps
- Official hex/Pantone values and typeface names: not found (the Brand Vision PDF was not reachable).
- Line 1 (Metro One) signage style: not found.

---

## 7. Sounds and announcements

### Takeaway
No reachable source quoted the actual announcement scripts, door chimes or warning beeps. Sources only confirm
public-address announcements in stations and trains, trilingual practice and that door closing on 2A/7 is handled by
the train operator.

### Cited Findings
- Announcements are played through the Passenger Announcement System; periodic in-train announcements about stations; door closing "managed by Train Operator" (Lines 2A/7 operator FAQ) — [MMMOCL FAQ](https://www.mmmocl.co.in/faq)
- Continuous announcements during a delay on Line 7 (wording not quoted) — [Free Press Journal](https://www.freepressjournal.in/mumbai/heres-how-the-travel-by-new-mumbai-metro-look-like)

### Inferences
- **Unverified, general-knowledge phrasing typical of Indian metros (use as placeholders, re-record originally):**
  - English: "Next station is ___. Doors will open on the left / right. Please mind the gap."
  - Hindi: "Agla station ___ hai. Darwaze baayin / daayin taraf khulenge."
  - Marathi: "Pudhil station ___. Darwaje daavikade / ujavikade ughadtil."
  - Order is usually Marathi → Hindi → English in Maharashtra (unverified).
- Sound design (generic, safe to synthesise): two- or three-tone chime before announcements; rapid beeps for 2–3 s
  while doors close; screen-door warning beep and flashing light; train sound = traction-motor whine rising with
  speed, rail joints are rare (continuous welded rail), squeal on tight curves, pantograph hiss; monorail = rubber
  tyres on concrete (quieter, tyre hum).

### Gaps
- Exact announcement texts, voice gender, chime melodies per line: not found. A rider's own recording (made by the
  owner) would be the reliable source; do not copy real recordings into the game.

---

## 8. Fare gates, ticket machines, security

### Takeaway
Stations have automatic fare collection flap gates (Line 1 alone: 125 entry + 122 exit gates), ticket vending
machines and ticket offices selling paper QR tickets, mobile QR (apps, WhatsApp), and bank-issued National Common
Mobility Cards (the MMRDA "Mumbai 1" card on 2A/7). Entry has frisking and an X-ray baggage scanner.

### Cited Findings
- Line 1: upgraded automatic fare collection accepts bank-issued NCMC (National Common Mobility Card) on all gates; 125 entry and 122 exit gates — [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-metro-one-modernises-afc-system-integrates-unified-payment-option-for-enhanced-commuter-convenience); [Indian Infrastructure, March 2026](https://indianinfrastructure.com/2026/03/06/digital-ticketing-building-a-future-ready-afc-system-for-mumbai-metro-line-1/)
- Line 1 tickets: paper QR from ticket counters and vending machines, mobile QR via apps and WhatsApp; QR wristband "TapTap" trial — [Mumbai Metro One FAQ](https://reliancemumbaimetro.com/metro-faq); [Knocksense](https://www.knocksense.com/amp/story/mumbai/say-hello-to-taptap-mumbai-metro-1-introduces-contactless-qr-coded-wristband-tickets)
- Lines 2A/7: "Mumbai 1 (NCMC)" card, recharge Rs 100–2,000; ticket vending machines sell paper QR and top up smart cards; tickets must be validated at entry and exit — [MMMOCL FAQ](https://www.mmmocl.co.in/faq); [MMMOCL station facilities](https://mmmocl.co.in/station-facilities.html)
- Line 1 baggage: up to 25 kg, max 80 × 50 × 30 cm, must pass through an X-ray baggage scanner — [Mumbai Metro One security page](https://reliancemumbaimetro.com/security)
- Line 3: entry checks with frisking and baggage scanning (a press sting got firecrackers through) — [Free Press Journal](https://www.freepressjournal.in/amp/mumbai/mumbai-metro-aqua-line-3-fpj-sting-exposes-how-explosives-went-undetected-raising-major-security-concerns-see-pics)

### Inferences
- **Game layout of a concourse:** street stairs → security (walk-through metal-detector frame, a table, an X-ray
  tunnel scanner about 2 m long, a guard with a hand wand, separate curtained frisking booth for women — the booth
  detail is general Indian-metro practice, unsourced) → ticket office window + 2–4 vending machines → a row of 6–12
  waist-high flap gates (about 0.55 m lane, 1 m tall cabinets with a QR reader and card pad) → paid area → stairs,
  escalators and lift up to the platform. Line 1 averages about 20 gates per station (247 gates / 12 stations).

### Gaps
- Gate brand, colours, per-station counts on 2A/7 and Line 3: not found.

---

## 9. Names, logos and designs the game must alter

### Takeaway
The operators and their brands are real organisations: Mumbai Metro One Private Limited (Line 1, Reliance Infra 74 %
/ MMRDA 26 %), Maha Mumbai Metro Operation Corporation (MMMOCL: 2A, 7, 2B, 9, Monorail), Mumbai Metro Rail
Corporation (MMRCL: Line 3), plus product names such as "Mumbai 1" card and "MetroConnect3". The game should use
generic or parody operator names and its own logos; plain line colours and descriptive names are safe.

### Cited Findings
- Mumbai Metro One Private Limited: 74 % Reliance Infrastructure, 26 % MMRDA; the state's 2024 plan to buy Reliance's stake (about Rs 4,000 crore) was cancelled in favour of a one-time debt settlement — [Outlook Business](https://www.outlookbusiness.com/news/maharashtra-cabinet-asks-mmrda-to-pursue-one-time-settlement-of-mumbai-metro-debt-with-lenders); [Swarajya](https://swarajyamag.com/infrastructure/why-maharashtra-govt-will-not-buy-out-reliance-infrastructures-stake-in-mumbai-metro-one)
- MMMOCL runs Lines 2A/7 and the Monorail; it issues the "Mumbai 1 (NCMC)" card — [MMMOCL FAQ](https://www.mmmocl.co.in/faq); [Constructionworld](https://www.constructionworld.in/amp/transport-infrastructure/metro-rail-and-railways-infrastructure/mmmocl-awards-mumbai-monorail-o-m-contract-to-power-mech-projects-/90666)
- MMRCL runs Line 3 and its app "MetroConnect3" — [Oneindia](https://www.oneindia.com/mumbai/metroconnect3-app-debuts-on-mumbai-metro-3-free-wi-fi-and-digital-tickets-simplify-commute-7884961.html)
- Line 1's blue is Metro One's corporate colour — [The Metro Rail Guy](https://themetrorailguy.com/2020/02/29/mumbai-metros-official-line-colours-unveiled/)

### Inferences
- Alter (do not show): "Mumbai Metro One"/"Metro One", Reliance names, "MMRDA", "MMMOCL"/"Maha Mumbai Metro",
  "MMRCL", "Mumbai 1" card, "MetroConnect3", "Aqua Line" as a branded name is low-risk but safest as plain "Line 3",
  manufacturer badges (Alstom, BEML, CRRC, Medha, Scomi), "Urbalis". Keep station names (they are place names).
- Parody suggestions in the game's style (check against `docs/research/mumbai-guide*.md` before use): operator
  "Bambai Metro Nigam" or "Mahanagar Metro" for MMRDA lines; "Metro Ek" for Line 1; "Bhuyari Metro" (underground)
  for Line 3; a neutral travel card such as "Ek Card"; an app name like "Chalo Metro" must be avoided ("Chalo" is BEST's
  real app) — use something like "Pohoch" (reach). The ride app in the game is already "Kidhar".
- Lines can keep their real numbers and colours (Line 1 blue, 2A yellow, 3 aqua, 7 red) — colours of public
  transport lines are generic wayfinding, not logos.

### Gaps
- Registered trademarks were not checked (no access to the Indian trademark registry from this session).
