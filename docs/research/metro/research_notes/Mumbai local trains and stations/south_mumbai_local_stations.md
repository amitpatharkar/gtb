# South Mumbai suburban railway stations: architecture, layout and look (as of November 2026)

How these notes were made: the sandbox blocked every page fetch, including en.wikipedia.org, wikiwand, Wikipedia mirrors such as wiki.krisyotam.com, indiarailinfo.com and freepressjournal.in. curl returned no HTTP response for any of them, and WebFetch failed with "host not found". So **every fact below comes from search-engine extracts (summaries of the linked pages), not from reading the full pages**. Treat single-source numbers as "to verify". Facts are marked with their date when the source is older than 2025. Station positions, platform outlines and track geometry should come from OpenStreetMap (`railway=platform`, `railway=station`, `bridge=yes` footways). These notes cover what a map cannot show.

## 1. Is the station list complete, and what are the stations called in November 2026?

### Takeaway
The brief's list is complete for the island city: 11 Western, 10 Central and 8 Harbour stops (CSMT, Masjid, Sandhurst Road and Mahim are shared), plus GTB Nagar and Chunabhatti on the Harbour line's Kurla arm. Eight British-era names have state approval to change (Currey Road → Lalbaug, Sandhurst Road → Dongri, Marine Lines → Mumbadevi, Charni Road → Girgaon, Cotton Green → Kalachowki, King's Circle → Tirthankar Parshvanath, and others). I found no Union Railway Ministry approval, so the boards most likely still show the old names. Only Elphinstone Road → Prabhadevi has actually taken effect.

### Cited Findings
- The Harbour line order from the south is Sandhurst Road, Dockyard Road, Reay Road, Cotton Green, Sewri, Wadala Road. At Wadala Road the line splits: one arm runs via King's Circle to join the Western line at Mahim, the other via Guru Tegh Bahadur Nagar (GTB Nagar) and Chunabhatti to Kurla. — [Harbour line, wikiwand (search extract)](https://wikiwand.com/en/articles/Harbour_line_(Mumbai_Suburban_Railway)); [Harbour line mirror](https://demo.azizisearch.com/lite/wikipedia/page/Harbour_line_(Mumbai_Suburban_Railway))
- March 2024: the Maharashtra government gave in-principle approval to rename eight suburban stations, including Curry Road → Lalbaug, Sandhurst Road → Dongri and Marine Lines → Mumbadevi. The names change only after the Union Railway Ministry approves. — [The Week / PTI, 12 Mar 2024](https://www.theweek.in/wire-updates/national/2024/03/12/bes14-mh-station-names.html)
- A later Maharashtra Legislative Council resolution covers seven stations: Currey Road → Lalbaug, Sandhurst Road → Dongri, Marine Lines → Mumbadevi, Charni Road → Girgaon and others. The extract was undated. — [Deccan Herald](https://www.deccanherald.com/india/maharashtra/maharashtra-council-passes-resolution-to-rename-seven-local-train-stations-3098254); [Free Press Journal](https://www.freepressjournal.in/amp/mumbai/maharashtra-legislative-council-passes-resolution-to-rename-7-mumbai-train-stations-emphasizing-marathi-heritage)
- Mumbai Central was also on the state cabinet's renaming list, waiting for Central approval. — [Tribune](https://www.tribuneindia.com/news/india/maharashtra-cabinet-approves-proposal-to-change-british-era-names-of-8-railway-stations-in-mumbai-600164/amp); [The Quint](https://www.thequint.com/neon/social-buzz/what-crime-did-mumbai-central-do-people-on-gov-changing-mumbai-station-names)
- Cotton Green → Kalachowki has state approval. — [Cotton Green railway station, Wikipedia (search extract)](https://en.wikipedia.org/wiki/Cotton_Green_railway_station)
- King's Circle: a proposal to rename it after the 23rd Tirthankara, Parshvanath. — [King's Circle railway station, Wikipedia (search extract)](https://en.wikipedia.org/wiki/King%27s_Circle_railway_station)
- Elphinstone Road → Prabhadevi was approved by the Union government in 2017. This is the precedent cited in the renaming coverage. — [search extract from the renaming results, e.g. Outlook India](https://www.outlookindia.com/national/lots-in-a-name-as-mumbais-railway-stations-are-renamed-heres-a-look-at-rich-history-behind-these-names)
- No search result reported Union Railway Ministry approval of the 2024 list. — search of 14 Nov 2026 (gap; see below)
- In 2025 or 2026 the renovated Vadala Road station prompted an online debate over "Wadala" vs "Vadala" on its new boards. Central Railway responded. — [Lokmat Times](https://www.lokmattimes.com/mumbai/wadala-or-vadala-name-confusion-at-renovated-mumbai-station-sparks-online-debate-central-railway-responds-a525/amp)

### Inferences
- For the game, use the current names on the boards: Currey Road, Sandhurst Road, Marine Lines, Charni Road, Cotton Green, King's Circle, Mumbai Central, Dockyard Road. Keep a data field for the proposed names in case the renaming lands. Prabhadevi is definitely the current name; "Elphinstone Road" survives only in speech and in the name of the bridge.
- GTB Nagar (Sion Koliwada) is probably inside the island city (Mumbai City district). Chunabhatti is probably just outside, in the Kurla taluka. Both lie inside the game's shipped map box (to 19.140° N), so build both.
- "Dadar" is two stations under one name (Western DDR, Central DR), and "Mahim Junction" serves both Western and Harbour trains. Model each as one complex with shared FOBs.

### Gaps
- I could not confirm whether the Centre approved the renamings in 2025–2026. Dockyard Road → Mazgaon is reported in other coverage but did not appear in an extract I saw.

## 2. Western line: Churchgate to Mahim Junction (platforms, FOBs, buildings)

### Takeaway
The Western line stations south of Dadar are mostly 3–4 platform through-stations on four tracks (two slow, two fast), with several FOBs each and a steady stream of new 8–12 m wide FOBs (2018–2026). Churchgate is a four-platform terminus under a 1957 seven-storey office block (the Western Railway headquarters). Mumbai Central is a 1930 terminus by Claude Batley with 5 main-line + 4 suburban platforms. Platform counts for Mahalaxmi, Prabhadevi, Matunga Road and Mahim conflict between sources.

### Cited Findings
**Churchgate (CCG, Western line terminus)**
- 4 platforms and 4 tracks; platforms 1–2 serve the slow line, 3–4 the fast line. — [cavac.at copy of Wikipedia (weak source, search extract)](https://cavac.at/cavacopedia/Churchgate%20railway%20station); [Wikipedia mirror](https://en.wikipedia.com/wiki/Churchgate_railway_station)
- Renovated in December 1926: a foot overbridge was added and the old level crossing was largely closed. — [cavac.at (weak)](https://cavac.at/cavacopedia/Churchgate%20railway%20station)
- Until 2010 the platforms took only 9- and 12-car trains; they were then extended for 15-car trains. — [Wikipedia mirror (search extract)](https://en.wikipedia.com/wiki/Churchgate_railway_station)
- The present station building is seven storeys, inaugurated 3 June 1957, and houses the Western Railway headquarters. The old BB&CI Railway headquarters across the road is the heritage building, in Venetian Gothic / Indo-Saracenic style. One source dates the station block to the 1970s; 1957 is better supported. — [TIFR Bombay architecture page](https://theory.tifr.res.in/bombay/architecture/building/churchgate.html); [FIBIS: Bombay Churchgate HQ and Station](https://wiki.fibis.org/w/Bombay_Churchgate_HQ_and_Station_BB&CIR)
- A redevelopment plan (undated DNA report) would clad the station building in reflective tinted glass on all sides, add lit false ceilings over the main concourse, level the platforms and extend new roofs over the full platform length. A conservation architect objected because of the heritage HQ next door. I found no confirmation that this was built. — [DNA India](https://www.dnaindia.com/mumbai/report-churchgate-to-get-a-touch-of-glass-1485859); [Karmayog / Shashank Rao: "A new, user-friendly Churchgate station"](https://karmayog.org/?p=15374)
- MRVC (Mumbai Railway Vikas Corporation) has studied putting the 5 km Churchgate–Mumbai Central stretch underground. This is a proposal only. — [Construction World](https://www.constructionworld.in/amp/transport-infrastructure/metro-rail-and-railways-infrastructure/mrvc-explores-underground-rail-corridors-in-south-mumbai/79451)

**Marine Lines**
- Under the Amrit Bharat Station Scheme (ABSS), Western Railway is building a new **12 m wide FOB**. Its 19 steel girders were launched in a night block on 30–31 May 2026, so the FOB was still under construction in June 2026. — [PropNewsTime, June 2026](https://propnewstime.com/latestnewsstories/MzExNTU=/marine-lines-station-foot-overbridge-work-advances-with-launch-of-19-steel-girders-during-major-rail-block)
- Marine Lines is one of the 8 Western Railway suburban ABSS stations, alongside Charni Road, Grant Road, Lower Parel and Prabhadevi. The target was December 2024. — [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-news-8-suburban-stations-of-wr-to-be-upgraded-by-december-2024-check-proposed-pictures)
- A Western Railway archive photo of the station around 1900 is on IRFCA. — [IRFCA gallery](https://irfca.org/gallery/Heritage/marine+lines+station.jpg.html)

**Charni Road**
- 4 platforms and 3 FOBs. A new North FOB opened on Monday 7 November (year not in the extract; probably 2022). It links to the existing bridge at the Mumbai Central end of platforms 2/3. — [Rail Analysis News](https://news.railanalysis.com/western-railway-commissions-new-foot-over-bridge-fob-at-charni-road-station/); [Mumbai Live](https://www.mumbailive.com/en/infrastructure/new-fob-linkway-at-charni-road-station-now-opened-for-commuters-75814)
- A skywalk-style FOB runs **parallel to the platform**. It was in poor condition for years and part of it once collapsed (minor injury). — [The Quint](https://www.thequint.com/news/india/charni-road-station-footover-bridge-collapse)
- MRVC built a new linkway and staircase in 28 days. — [Free Press Journal](https://www.freepressjournal.in/amp/mumbai/mumbai-mrvc-throws-open-new-linkway-staircase-at-charni-road-within-28-days)
- Opened 3 September 1868. — [Charni Road railway station, Wikipedia (search extract)](https://en.wikipedia.org/wiki/Charni_Road_railway_station)
- February 2026: Western Railway plans escalators, encroachment clearance and beautification at Mumbai Central, Grant Road and Charni Road. — [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-central-grant-road-charni-road-stations-to-get-escalators-beautification); [Free Press Journal (2)](https://www.freepressjournal.in/mumbai/western-railway-to-install-escalators-upgrade-facilities-at-key-south-mumbai-stations-commuters-concerns-discussed)

**Grant Road**
- New **10 m wide FOB**, one of nine FOBs Western Railway commissioned during the lockdown (2020). — [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-western-railway-opens-new-10-metre-wide-fob-at-grant-road-station)
- Grant Road was the first terminus of the BB&CI Railway and a stop on the first regular suburban service (12 April 1867). The present building dates from December 1969. — [Grant Road railway station, Wikipedia (search extract)](https://en.wikipedia.org/wiki/Grant_Road_railway_station)
- A 1960s photo of Grant Road (east) is on IRFCA. — [IRFCA](https://irfca.org/gallery/Heritage/grant-road-east-1960s.jpg.html)
- Frere Bridge (a road bridge between Charni Road and Grant Road) had new steel girders launched in a 2020 block. — search extract from [Western Line, Bharatpedia](https://en.bharatpedia.org/wiki/Western_Line_(Mumbai_Suburban_Railway)) results

**Mumbai Central (suburban side and terminus)**
- Designed by **Claude Batley** (professor of architecture at the Sir J. J. School of Art, 1924–43) and built by Shapoorji Pallonji in a record 21 months. Opened **18 December 1930**. — [mumbaimetroroute heritage page](https://mumbaimetroroute.com/places/mumbai-central-station-heritage); [FIBIS: Bombay Central Station](https://wiki.fibis.org/w/Bombay_Central_Station_BB&CIR)
- The style is disputed: one source calls it Art Deco, while Wikipedia's "Architecture of Mumbai" article calls it High Victorian Gothic. — [mumbaimetroroute](https://mumbaimetroroute.com/places/mumbai-central-station-heritage); contradicted by [Architecture of Mumbai, Wikipedia mirror](https://wikipedia.com/wiki/Architecture_of_Mumbai)
- The main-line section has **5 high-level platforms ending at a large concourse at the southern end**; the suburban section has **4 high-level platforms**. All platforms are linked by FOBs. — [Wanderlog (low-quality listing)](https://wanderlog.com/place/details/3903730/mumbai-central-railway-station-building)
- A FOB **50 m long and 10 m wide covering all platforms** was planned "by June" (undated). Separately, a newer main-line FOB has opened. — [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-foot-overbridge-covering-all-platforms-at-mumbai-central-station-by-june); [Free Press Journal (2)](https://www.freepressjournal.in/mumbai/mumbai-new-foot-over-bridge-at-mumbai-central-station-opened-for-public-use)
- Western Railway and the BMC opened a temporary FOB with a staircase into the station while the **Bellasis Road over-bridge** is rebuilt. — [Free Press Journal](https://www.freepressjournal.in/mumbai/western-railway-mcgm-open-temporary-fob-at-mumbai-central-amid-bellasis-road-over-bridge-reconstruction)

**Mahalaxmi**
- After the 1926 renovation, Mahalaxmi got 300 ft (91.44 m) long island platforms. This is a historical figure. One mirror and mumbaimetroroute list 4 platforms. — [Mahalaxmi railway station, Wikipedia mirror (search extract)](https://en.Wikipedia.com/wiki/Mahalaxmi_railway_station)

**Lower Parel**
- 3 platforms and 5 tracks per the Wikipedia infobox; mumbaimetroroute says 4. — [Lower Parel railway station, Wikipedia (search extract)](https://en.wikipedia.org/wiki/Lower_Parel_railway_station); contradicted by [mumbaimetroroute](https://mumbaimetroroute.com/mumbai-local-train/stations/lower-parel)
- Smart multilingual train indicators were installed at Lower Parel, Prabhadevi and other stations under ABSS in July 2025. — [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-news-western-railway-installs-smart-multilingual-train-indicators-at-key-suburban-stations-under-amrit-bharat-scheme)
- The Lower Parel road bridge took heavy traffic after the Elphinstone bridge closed in 2025. — [Free Press Journal](https://www.freepressjournal.in/mumbai/in-pics-heavy-traffic-on-lower-parel-bridge-after-elphinstone-bridge-closure-in-mumbai)

**Prabhadevi (formerly Elphinstone Road)**
- Western Railway has begun widening the western entry and exit of the **South FOB**. A toilet block was demolished and **an additional staircase** is planned. A 12 m wide FOB with stairs and lifts is proposed, but the BMC has not agreed on its site. — [Free Press Journal](https://www.freepressjournal.in/mumbai/western-railway-starts-prabhadevi-fob-expansion-work-additional-staircase-planned-to-improve-passenger-movement)
- **Two station exits were on the Elphinstone road over-bridge**, which was demolished in 2025–26 (see §6). — [India TV](https://www.indiatvnews.com/maharashtra/mumbai-elphinstone-bridge-closed-for-demolition-to-make-way-for-new-double-decker-connector-historic-125-years-old-structure-shut-2025-09-13-1007987)

**Matunga Road and Mahim Junction**
- Mahim Junction: the Wikipedia infobox gives 6 platforms and 6 tracks, as does an indiarailinfo tip ("6 PFs"); another listing says 4. The Harbour line's Bandra branch joins the Western line here. — [Mahim Junction, Wikipedia (search extract)](https://www.wikipedia.org/wiki/Mahim_railway_station); [mumbaimetroroute (4 platforms)](https://mumbaimetroroute.com/mumbai-local-train/stations/mahim)
- Western Railway reopened Mahim's **South FOB rebuilt in corrosion-resistant stainless steel** (2025). — [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-news-western-railway-reopens-mahim-station-south-foot-over-bridge-with-corrosion-resistant-stainless-steel-for-commuter-safety)
- A footbridge known as the "Matunga Z bridge" links the Matunga (Central) and Matunga Road (Western) area. As of 29 April 2013 the Western line had 102 FOBs and 8 subways. — [Western line, Wikipedia mirror (search extract)](https://en.wikipedia.com/wiki/Western_line_(Mumbai_Suburban_Railway))

### Inferences
- In the three stations between Churchgate and Mumbai Central (Marine Lines, Charni Road, Grant Road), the line runs in a cutting or at grade beside Marine Drive and the Queen's Road. They are four-track through-stations, typically one island platform for the slow pair plus side or island platforms for the fast pair. This is general knowledge, not verified here; check OSM platform polygons.
- New FOB widths come in a few standard sizes: 3.65 m (older or Army-built), 6 m, 8 m, 10 m and 12 m (ABSS and MUTP era). In the game, older FOBs should be narrow with steel plate girders and sheet roofs, and 2020s FOBs wide with stainless-steel railings and lifts.

### Gaps
- No verified platform type (island or side), width or length for Marine Lines, Charni Road, Grant Road, Mahalaxmi, Prabhadevi or Matunga Road.
- No description of canopy type for any Western line station in the extracts.
- No confirmation whether the Churchgate glass cladding was ever done (it seems not to have been).

## 3. Central line: CSMT to Sion (platforms, FOBs, buildings)

### Takeaway
CSMT has 18 platforms: 1–7 suburban (Harbour on 1–2 today) and 8–18 main line. A redevelopment with an elevated concourse over the main-line platforms is under way. Masjid has 4 platforms (2 Harbour + 2 main line). Sandhurst Road is India's first two-tier station: 2 Central platforms at ground level plus 2 Harbour platforms on a 527 m steel viaduct (1925). Byculla is a Grade IIA Victorian Gothic stone building (1887–91), restored in 2021–22 and winner of a UNESCO award. Currey Road has 2 platforms on 4 tracks (1884); Matunga 4 platforms (1883, all-women staff); Sion 4 platforms (1873).

### Cited Findings
**CSMT (suburban 1–7)**
- 18 platforms: 1–7 suburban, 8–18 long-distance. — [Deccan Herald (search extract)](https://deccanherald.com/india/maharashtra/csmt-can-now-accommodate-24-coach-trains-3048778)
- Plans for the Harbour line conflict. An older plan moves it from platforms 1–2 to an elevated corridor on the second-floor level at the P. D'Mello Road side, near platforms 18–19. A later plan would end Harbour trains at Sandhurst Road and give CSMT platforms 1–2 (and Masjid's) to main-line trains. — [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-harbour-line-set-to-change-track); [Construction World](https://www.constructionworld.in/transport-infrastructure/metro-rail-and-railways-infrastructure/central-railway--cr---will-harbour-line-trains-terminate-at-sandhurst-road-/61998)
- Platforms 5 and 6 were being extended (for longer trains). During the mega-block, which ran to 13 June, mail and express trains were short-terminated at Dadar and Thane. — [railway.supply](https://www.railway.supply/central-railway-expands-platforms-to-boost-15-car-train-services); [Free Press Journal](https://www.freepressjournal.in/mumbai/csmt-mega-block-extended-till-june-13-several-mail-express-trains-to-be-short-terminated-at-dadar-thane)

**Masjid (Masjid Bunder)**
- 4 platforms and 6 tracks: two platforms for the Harbour line and two for the main line. Fast trains do not stop. Opened 20 September 1875 (one older mirror says 1877). — [Masjid railway station, Wikipedia (search extract)](https://en.wikipedia.org/wiki/Masjid_railway_station); [mumbaimetroroute](https://mumbaimetroroute.com/mumbai-local-train/stations/masjid)
- The Masjid bridge was dismantled and rebuilt in a record 33 days (date not in the extract). — [togethervcan.in](https://togethervcan.in/?p=2788)

**Sandhurst Road**
- 4 platforms: 2 at ground level for the Central line and 2 elevated for the Harbour line. Billed as India's first two-tier station, with a **1,728 ft (527 m) long steel viaduct** carrying the Harbour line. The lower level opened 1 February 1925 and the upper level 3 February 1925, the day the electrified Harbour line opened. "Built 1921" is quoted for the upper level, but sources disagree on which level that date belongs to. — [Sandhurst Road railway station, Wikipedia (search extract)](https://en.wikipedia.org/wiki/Sandhurst_Road_railway_station); [Central Railway blog, 2009](https://centralrailwaymain.blogspot.com/2009/03/sandhurst-road.html)
- The Harbour line runs beside the Central line until just before Sandhurst Road, then turns east and runs **elevated as far as Sewri**. — [Harbour line, wikiwand (search extract)](https://wikiwand.com/en/articles/Harbour_line_(Mumbai_Suburban_Railway))
- A 2017 report said Central Railway planned to demolish the station to make room for the 5th and 6th lines between CSMT and Kurla. It had not happened as of the last extract. — [Sandhurst Road, Wikipedia (search extract)](https://en.wikipedia.org/wiki/Sandhurst_Road_railway_station)
- ABSS works: renovated booking office, new platform surface, drainage, repaired access ramp; about ₹16.4 crore. — [Construction World](https://www.constructionworld.in/transport-infrastructure/metro-rail-and-railways-infrastructure/modi-to-lay-foundation-stone-for-central-railway-redevelopment/51393); [PropNewsTime](https://propnewstime.com/latestnewsstories/MTczMzM=/mumbai-infrastructure-36-stations-to-be-upgraded-for-over-inr-1-800-crore-under-amrit-bharat-mission)

**Byculla** (heritage details in §8)
- ABSS: the east-side booking office is demolished and a new one built. Budget figures conflict (₹35.5 crore vs ₹135.5 crore). — [Construction World](https://www.constructionworld.in/transport-infrastructure/metro-rail-and-railways-infrastructure/modi-to-lay-foundation-stone-for-central-railway-redevelopment/51393); [PropScience](https://www.propscience.com/stories_detail/3446/mumbai-s-central-railway-unveils-rs-101-crore-redevelopment-for-key-stations); [PropNewsTime](https://propnewstime.com/latestnewsstories/MTczMzM=/mumbai-infrastructure-36-stations-to-be-upgraded-for-over-inr-1-800-crore-under-amrit-bharat-mission)
- "First look of the new Byculla" under ABSS (Hindi news, with renderings). — [Navbharat Live](https://navbharatlive.com/state/new-byculla-first-look-under-amrit-bharat-yojna-878758.html)

**Chinchpokli and Currey Road**
- Chinchpokli and Parel opened 9 December 1867; Currey Road opened 1 January 1884. New station buildings at Chinchpokli and Currey Road were built February 1893 – 1895. — [IRFCA: Timeline of Mumbai suburban station openings, Central Railway](https://irfca.org/docs/mumbai-cr-suburban-timeline.html)
- Currey Road: 2 platforms and 4 tracks per the infobox; mumbaimetroroute says 4 platforms. — [Currey Road railway station, Wikipedia (search extract)](https://en.wikipedia.org/wiki/Currey_Road_railway_station); [mumbaimetroroute](https://mumbaimetroroute.com/mumbai-local-train/stations/curry-road)
- Currey Road's second FOB (2014 tender): **30 m long and 3.5 m wide**, at the CSMT end, starting from the east-side platform; about ₹3 crore. A 2017 report says land acquisition delayed it. — [Hindustan Times via PressReader, 21 Aug 2014](https://www.pressreader.com/india/hindustan-times-st-mumbai/20140821/281891591443205)
- Chinchpokli, Matunga, Parel and Vadala Road (and Shahad) "get major upgrades" (2025 ABSS headline). — [Mumbai Live](https://www.mumbailive.com/en/civic/chinchpokli-matunga-parel-vadala-road-and-shahad-stations-get-major-upgrades-91061)

**Matunga and Sion**
- Matunga opened 1 October 1883 and has 4 platforms. It has had all-women staff since July 2017 (41 staff in 2017; 32 reported in 2025) and is in the Limca Book of Records 2018. — [Matunga railway station, Wikipedia (search extract)](https://en.wikipedia.org/wiki/Matunga_railway_station); [YourStory](https://yourstory.com/2018/01/mumbais-matunga-railway-station-creates-limca-record-hiring-women-staff); [Mumbaikar News 2025](https://www.mumbaikarnews.in/?p=14596)
- Sion has 4 platforms. An earlier station existed (1853); the present station opened 3 November 1873. One commuter post says only 2 platforms serve slow trains and fast trains skip it (anecdotal). — [Sion railway station (India), Wikipedia (search extract)](https://en.wikipedia.org/wiki/Sion_railway_station_(India))
- The Sion road over-bridge over the station was demolished and rebuilt (2024–25) for the 5th and 6th lines. — [Time Out Mumbai](https://www.timeout.com/mumbai/news/mumbais-sion-railway-overbridge-may-reopen-this-weekend-but-theres-a-catch-101526)

### Inferences
- With Masjid at "4 platforms / 6 tracks" and Currey Road at "2 platforms / 4 tracks", the Central line's slow pair has platforms while the fast pair often runs through without any. Chinchpokli and Currey Road are probably two side platforms on the slow lines only; this is consistent with fast trains not stopping, but verify in OSM.
- Sandhurst Road should be modelled as two stacked stations: ground-level Central platforms, with the Harbour viaduct (steel girders on piers) crossing at first-floor height.

### Gaps
- CSMT suburban platforms: no width, canopy type or concourse dimensions found. Also unconfirmed which Harbour plan (elevated deck or ending at Sandhurst Road) is being built in 2026.
- Chinchpokli platform count, and Parel and Sion canopy types: not found.

## 4. Harbour line: Dockyard Road to King's Circle and GTB Nagar (platforms, viaducts, buildings)

### Takeaway
South of Sewri the Harbour line runs on an elevated alignment. Reay Road (1910, Grade I) is a single-storey stone station with hooded segmental arches and a lean-to roof. Dockyard Road (1925) sits in a cutting through Mazagaon Hill. Cotton Green faces the Art Deco Cotton Exchange (1924). Vadala Road is a 4-platform junction (opened 1914). King's Circle is an elevated station. Few hard dimensions exist in the extracts.

### Cited Findings
- The Harbour line opened on 10 December 1910 as a double line from Kurla to Reay Road via Wadala and Sewri. — [Harbour line, wikiwand (search extract)](https://wikiwand.com/en/articles/Harbour_line_(Mumbai_Suburban_Railway))
- **Reay Road**: opened 1910 as the terminus of the Kurla–Reay Road line (GIP Railway). A single-storey building with an exposed stone masonry facade, hooded segmental arches along the front, rectangular pilasters and a lean-to roof. **Grade-I heritage structure.** — [Reay Road railway station, Wikipedia (search extract)](https://en.wikipedia.org/wiki/Reay_Road_railway_station); [wikiwand copy](https://wikwiand-revamp.pages.dev/en/Reay_Road)
- **Dockyard Road**: opened 12 November 1925, built by cutting away part of Mazagaon Hill. — [Harbour line, Wikipedia (search extract)](https://Www.wikipedia.org/wiki/Harbour_Line); photo record at the [Jio Institute repository](https://repository.jioinstitute.edu.in/concern/images/1ea0ac10-6012-486b-850a-90df63c5fbc3?locale=fr)
- **Cotton Green**: named after the Cotton Exchange building opposite (Art Deco, built 1924, cotton trading until 1945, since restored) and nearby warehouses. It serves Kalachowki, Ferbandar and Ghodapdeo. — [Cotton Green railway station, Wikipedia (search extract)](https://en.wikipedia.org/wiki/Cotton_Green_railway_station); [Cotton Green, Wikipedia](https://en.wikipedia.org/wiki/Cotton_Green)
- **Vadala Road**: 4 platforms. One page assigns platform 1 to trains towards Panvel and Goregaon, platforms 2–3 to trains starting or ending here, and platform 4 to trains towards CSMT (single unverified source). Opened February 1914 (reportedly under another name). — [wiki mirror](https://wiki.riteme.site/wiki/Vadala_Road); [wikiwand](https://wikiwand.com/en/Vadala_Road_railway_station); [indiarailinfo](https://srv1.indiarailinfo.com/station/timeline/9324/9172)
- **King's Circle** (code KCE): an **elevated station** next to Matunga (Central line), used only by CSMT/Panvel ↔ Bandra/Andheri/Goregaon trains. — [King's Circle railway station, Wikipedia (search extract)](https://en.wikipedia.org/wiki/King%27s_Circle_railway_station)
- **GTB Nagar and Chunabhatti**: they sit between Vadala Road and Kurla. The new elevated Kurla Harbour corridor starts after Chunabhatti, crosses the Santacruz–Chembur Link Road and rejoins ground level near Tilak Nagar; all Kurla Harbour operations will move onto it. — [Swarajya 2025](https://swarajyamag.com/amp/story/news-brief/kurlas-elevated-harbour-line-station-takes-shape-key-to-mumbai-suburban-railways-5th-and-6th-line-expansion); [Construction World](https://www.constructionworld.in/amp/transport-infrastructure/metro-rail-and-railways-infrastructure/kurla-gets-new-elevated-harbour-line-station/78947)

### Inferences
- Between Sandhurst Road and Sewri, model the Harbour stations as raised: on a viaduct, embankment or cutting through Mazagaon Hill at Dockyard Road. The extracts only say the line is "elevated up till Sewri", so set the exact height per station from OSM `layer`/`bridge` tags or Copernicus elevation.
- Reay Road is the best-documented heritage stop. Use basalt-grey exposed stone, segmental-arched openings with hood moulds, pilasters and a single-slope (lean-to) roof.

### Gaps
- No details found on Reay Road's restoration (colours, roof material, date) despite the brief's mention. No search result described a recent Reay Road restoration.
- Nothing found on Sewri, GTB Nagar or Chunabhatti platform layout, FOBs or buildings.
- No Harbour viaduct heights.

## 5. Dadar interchange: platform numbering, FOBs and the Western–Central links

### Takeaway
Since 9 December 2023 Dadar uses one numbering scheme: Western platforms 1–7 and Central platforms 8–14 (the old Central platform 2 was removed to widen platform 1; Central's 13–14 form the long-distance "Dadar Terminus"). The complex had about eight FOBs in a Western Railway official's undated count. In 2025–26 elevated decks are being added to tie the FOBs together. The slow platform for Kalyan-bound trains was widened from 7 m to 10.5 m, and Central platform 10 is being made double-discharge with 11.

### Cited Findings
- Renumbering took effect 9 December 2023. Central Railway's platforms (previously 1–7 or 1–8; sources differ) became 8–14, and Western Railway's 1–7 were unchanged. The old Central platform 2 was "surrendered" to widen platform 1. Mapping: old 3 → 9, 4 → 10, 5 → 11, 6 → 12, 7 → 13, 8 → 14. — [Business Standard / PTI](https://business-standard.com/india-news/new-platform-numbering-at-dadar-junction-from-dec-9-to-lessen-confusion-123092701539_1.html); [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbais-dadar-railway-station-to-undergo-platform-renumbering-for-better-clarity-efficiency); [mid-day, 9 Dec 2023](https://midday-re.vercel.app/mumbai/mumbai-news/article/mumbai-local-train-platform-number-changes-implemented-at-dadar-station-from-today-details-here-23324159)
- Wikipedia describes the Central long-distance platforms as "Dadar Central Terminus" / Dadar Terminus. Its layout table reads "station with seven tracks, one side and four island platforms" (inconsistent labelling; treat with caution). — [Dadar railway station, Wikipedia (search extract)](https://en.wikipedia.org/wiki/Dadar_railway_station)
- New Western Railway FOB, **8 m wide and 58 m long, at the southern end**, connects platforms 1, 2, 3 and 5 and the **east skywalk**; extension to platform 4 (fast, Churchgate-bound) was planned. A Western Railway official said Dadar has **eight FOBs**. — [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-new-western-railway-foot-over-bridge-comes-up-at-dadar-station); [Knocksense](https://www.knocksense.com/mumbai/knocksense-shorts-new-fob-to-come-up-at-mumbais-busiest-interchange-terminal-dadar-station)
- A 2014 commuter tip: the FOB at the Bandra end was not connected to Western platforms 1 and 2, so it was no use for reaching the Central side. — [indiarailinfo Dadar tips](https://d.indiarailinfo.com/station/tips/298?tt=0)
- The Central slow platform for Kalyan-bound trains was widened **from 7 m to 10.5 m**. — [Free Press Journal](https://www.freepressjournal.in/amp/mumbai/mumbai-central-railways-dadar-station-widening-project-nears-completion-move-to-enhance-commuter-experience)
- Central platform 10 is being converted to a **double-discharge** platform for down fast trains, so passengers can board or alight on both 10 and 11. Stalls on platform 10 were removed in phase 1. — [Free Press Journal](https://www.freepressjournal.in/amp/mumbai/mumbai-central-railway-converts-platform-10-in-dadar-station-into-double-discharge-platform-for-local-trains-work-underway); [Curly Tales](https://curlytales.com/mumbai-dadars-platform-10-11-soon-to-be-revamped-to-ease-commuter-congestion-on-existing-platform/amp/)
- April 2026: work on **elevated decks** linked to the FOBs (an "integrated deck system") is speeding up, for 2–3 lakh daily passengers; phase two is described separately. — [Free Press Journal, Apr 2026](https://www.freepressjournal.in/mumbai/dadar-railway-station-upgrade-gains-speed-elevated-decks-fob-links-to-ease-23-lakh-daily-passenger-rush); [OneIndia](https://oneindia.com/mumbai/dadar-station-revamp-moves-forward-what-phase-two-has-in-store-for-commuters-3909657.html)
- Western Railway is adding a new long-distance platform next to platform 7, possibly numbered "7A" to avoid renumbering the Central side. — [Free Press Journal](https://www.freepressjournal.in/amp/mumbai/mumbai-rail-infra-update-western-railway-to-add-new-platform-at-dadar-station-to-ease-long-distance-train-operations-7a-numbering-under-consideration)
- While Dadar's platforms were rebuilt, all Dadar-originating Central suburban trains were moved to start and end at Parel. The summary said "from 15 September 2018"; the article ID suggests 2023, so the date conflicts. — [ThePrint](https://theprint.in/india/mumbai-all-dadar-suburban-trains-to-originate-end-at-parel-station-due-to-platform-work/1759248)
- A Dadar FOB staircase was closed for repairs 16 March – 30 April (year not in the extract). — [Free Press Journal](https://www.freepressjournal.in/amp/mumbai/attention-commuters-dadar-station-fob-staircase-to-be-closed-for-repairs-from-march-16-to-april-30)

### Inferences
- In the game, number Dadar's platforms 1–14 from west to east: Western 1–7, then Central 8–14, matching the signs since December 2023. Put one long Western–Central link FOB at each end (Churchgate/CSMT end and Bandra/Kalyan end), plus the east skywalk. The road over-bridge north of the station (Tilak Bridge) is a separate road structure that traffic now uses instead of the Elphinstone bridge.
- 10.5 m is a good reference width for a rebuilt busy island platform; 7 m for an older one.

### Gaps
- Names and exact positions of all eight Dadar FOBs; where each staircase lands; booking office positions (east on Dr Ambedkar Road side vs west on Ranade Road / Senapati Bapat Marg). Not found in the extracts.

## 6. Prabhadevi (Elphinstone Road)–Parel: Army FOB 2018, Parel terminus, Elphinstone bridge

### Takeaway
The Indian Army's Bombay Sappers built a 73.1 m × 3.65 m steel FOB linking Elphinstone Road (now Prabhadevi, Western) with Parel (Central), opened 27 February 2018. It was built after a 2017 crowd crush; do not reference that event in the game. Parel became a suburban terminus on 3–4 March 2019, with a terminating line, a double-discharge platform and a 12 m east–west FOB. It got an ABSS facelift in 2025, which may itself be torn down for the 5th/6th lines and a new long-distance Parel terminus approved in late 2025. The 1913-era Elphinstone road over-bridge above both stations was closed in 2025 and demolished by spring 2026. A double-decker bridge (part of the Sewri–Worli connector) is being built in its place, due late 2026 or 2027.

### Cited Findings
- Army FOB: **73.1 m long, 3.65 m wide**, about ₹10.44 crore, opened to the public 27 February 2018. It links Elphinstone Road with Parel. The Bombay Sappers built three bridges in 117 days. Other reports give ~70 m (DNA) or 73 m × 6 m (LocalPress, an outlier). — [Moneylife / IANS](https://moneylife.in/article/3-fobs-built-by-indian-army-inaugurated-for-mumbai-rail-commuters/53226.html); [The Quint](https://www.thequint.com/news/india/army-unveils-new-bridge-in-elphinstone); [DNA photo gallery](https://www.dnaindia.com/mumbai/photo-gallery-in-pics-months-after-elphinstone-tragedy-army-builds-three-fobs-in-record-time-2589179); [LocalPress](https://localpress.co.in/?p=24921); [Asian Age](https://www.asianage.com/metros/mumbai/280218/cm-fadnavis-unveils-new-fob-at-elphinstone-road.html)
- The existing Elphinstone FOB was also widened about three months after September 2017. — [Scroll](https://scroll.in/latest/863496/scroll_in)
- Parel Suburban Terminus was inaugurated by Piyush Goyal and Devendra Fadnavis on 3 March 2019 (PTI); Wikipedia says 4 March 2019. — [Business Standard / PTI](https://www.business-standard.com/article/pti-stories/parel-suburban-terminus-inaugurated-119030300609_1.html); [Parel railway station, Wikipedia (search extract)](https://en.wikipedia.org/wiki/Parel_railway_station)
- Parel works: a terminating line with a double-discharge platform; new platform 1 (down slow) and 2 (terminus line); new island platforms served by a new **12 m wide east–west FOB**. — [RailPost](https://www.railpost.in/?p=1536)
- A 12 m wide FOB connects Parel to the Elphinstone side. Its eastern landing opened in late December 2018. — [Mumbai Live](https://www.mumbailive.com/en/transport/central-railway-opens-new-platform-and-foot-overbridge-at-parel-station-24857); [DNA](https://www.dnaindia.com/mumbai/report-new-platform-mini-bridges-to-passage-at-parel-station-2626427)
- Project cost about ₹51 crore; Parel footfall about 1.5 lakh per day. — [LatestLY](https://www.latestly.com/india/information/mumbai-local-update-new-platform-parel-station-commissioned-from-today-to-decongest-rush-during-peak-hours-220264.html/amp)
- Parel was among the first stations reopened after its ABSS upgrade (2025). That ₹19 crore upgrade "may be demolished within a year" for the 5th/6th lines and a terminus. — [Construction World](https://constructionworld.in/transport-infrastructure/metro-rail-and-railways-infrastructure/parel-among-first-to-open-after-amrit-bharat-station-upgrade/70610); [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbais-parel-railway-stations-19-crore-amrit-bharat-upgrade-may-be-demolished-within-a-year-for-new-rail-lines-terminus); [Navbharat Live](https://navbharatlive.com/maharashtra/mumbai/amrit-bharat-station-scheme-the-face-of-parel-railway-station-has-changed-1157280.html)
- A new long-distance Parel terminus was approved in late 2025. Central Railway plans 20 new platforms at four termini, about 5 of them at Parel. — [Swarajya](https://swarajyamag.com/amp/story/news-brief/mumbai-central-panel-clears-tilak-terminus-expansion-new-parel-terminus-to-ease-congestion-and-add-more-long-distance-trains); [Lokshahi](https://english.lokshahi.com/latest-news/local-travel-will-become-comfortable-20-new-stations-to-be-built-on-central-railway); [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-central-railway-proposes-new-parel-terminus-to-alleviate-csmt-congestion-expands-ltt-with-4-additional-platforms)
- Elphinstone road over-bridge: closure was announced from 10 April 2025, and official closure and demolition began around 12–13 September 2025. The last 132 m over the Central tracks between Parel and Currey Road came down overnight in 2026. It is being replaced by a **double-decker road over-bridge with open-web girders**, part of MMRDA's 4.5 km Sewri–Worli Elevated Corridor (₹1,286 crore), built by MahaRail. Completion is quoted as Sept/Dec 2026 or 2027 (sources conflict). Detours: Tilak Bridge (Dadar) and Currey Road bridge. — [The Week, 9 Apr 2025](https://www.theweek.in/wire-updates/national/2025/04/09/bes1-mh-bridge-closure.html); [India TV, 13 Sep 2025](https://www.indiatvnews.com/maharashtra/mumbai-elphinstone-bridge-closed-for-demolition-to-make-way-for-new-double-decker-connector-historic-125-years-old-structure-shut-2025-09-13-1007987); [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-news-115-year-old-elphinstone-road-bridge-demolished-after-complex-overnight-operation-14-trains-delayed); [ThePrint](https://theprint.in/india/mumbais-elphinstone-bridge-becomes-history-new-east-west-connector-to-rise/2897251)

### Inferences
- For November 2026: there is no road bridge at Elphinstone, or a half-built double-decker girder structure with construction hoardings. This makes a good "construction site" set piece. Prabhadevi's two former exits onto that bridge are closed; passengers use the Army FOB and the widened South FOB.
- The three Army FOBs are believed to be Elphinstone Road, Currey Road and Ambivli. This is general knowledge and not confirmed in the extracts.

### Gaps
- The exact November 2026 state of the double-decker bridge, and whether the Parel ABSS building has been demolished yet.

## 7. Long-distance terminals (outlines): CSMT main line, Mumbai Central, Dadar Terminus, LTT

### Takeaway
CSMT main line is platforms 8–18 behind the 1878–88 F. W. Stevens building, with an elevated concourse over 8–18 reportedly under construction. Mumbai Central main line has 5 platforms ending at a concourse at the south end of the 1930 building. Dadar Terminus is Central platforms 13–14. Lokmanya Tilak Terminus (Kurla) is usually given as 5 platforms, with 2–4 more under construction. A major upgrade (~₹5,000 crore) is planned.

### Cited Findings
- CSMT: platforms 8–18 handle long-distance trains. — [Deccan Herald](https://deccanherald.com/india/maharashtra/csmt-can-now-accommodate-24-coach-trains-3048778)
- CSMT redevelopment: Heritage Committee (BMC) approval obtained. Plans include buildings for passenger and parcel facilities, decks linking mail/express and suburban platforms, footbridges and skywalks. Platforms 16 and 17 were closed for 85 days (1 Feb – 26 Apr, year not given) for redevelopment. — [Construction World (heritage approval)](https://www.constructionworld.in/gold/transport-infrastructure/metro-rail-and-railways-infrastructure/csmt-redevelopment-project-has-received-approval-from-the-heritage-committee/33454); [Construction World (PF 16/17)](https://www.constructionworld.in/transport-infrastructure/metro-rail-and-railways-infrastructure/csmt-closes-platforms-16-and-17-for-85-day-redevelopment/85584)
- In May 2025 Chief Minister Fadnavis said CSMT is being redeveloped into the country's most modern railway station. — [The Week, 22 May 2025](https://www.theweek.in/wire-updates/national/2025/05/22/bes30-mh-csmt-fadnavis.html)
- A low-quality blog (March 2026) describes an elevated concourse over platforms 8–18, with foundation work on the P. D'Mello Road side. It is modelled on Rani Kamlapati (Bhopal), with departure and arrival halls, retail and a food court; the heritage building is restored, not demolished. — [IndianRailYatra blog mirror](https://all-blogs-8rl.pages.dev/IndianRailYatra.Blog/stations--csmt-redevelopment-update)
- An earlier CSMT redevelopment plan was shelved in July 2022 because of restructuring in Indian Railways. — [Business Standard, 2022](https://business-standard.com/article/economy-policy/mumbai-s-cstm-redevelopment-shelved-due-to-restructuring-in-indian-railways-122072001071_1.html)
- Mumbai Central: 5 high-level main-line platforms ending at a large concourse at the south end; Rajdhani Express terminal. — [Wanderlog](https://wanderlog.com/place/details/3903730/mumbai-central-railway-station-building)
- Dadar Terminus is the Central long-distance platforms (now 13–14). A 2012 plan to stop long-distance services there in favour of LTT did not happen as of the extracts. — [Dadar railway station, Wikipedia (search extract)](https://en.wikipedia.org/wiki/Dadar_railway_station)
- LTT: 5 platforms (totaltraininfo); Wikipedia mirror says 7. Two new platforms were "nearing completion by March", and 4 more are planned under the 20-new-platforms programme. About ₹5,000 crore of LTT upgrades were announced. — [totaltraininfo](https://www.totaltraininfo.com/station/ltt/8); [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-lokmanya-tilak-terminus-expansion-nears-completion-2-new-platforms-to-cater-to-summer-rush-by-march); [NBM&CW](https://www.nbmcw.com/news/railway-unveils-5-000-cr-tilak-teriminus-upgrades.html); [LTT, Wikipedia (search extract)](https://en.wikipedia.org/wiki/Lokmanya_Tilak_Terminus)

### Inferences
- In 2026 CSMT's main-line side is a live construction site (deck columns over 8–18 on the P. D'Mello Road side), while the suburban side (1–7) under the heritage train shed and the Stevens building facing D. N. Road remain the "postcard" view.

### Gaps
- The LTT platform total after 2025–26 work, Dadar Terminus platform lengths, and the CSMT deck's height and extent: not confirmed.

## 8. Heritage buildings: years, grades, styles, materials, colours

### Takeaway
Heritage stations to hand-build: CSMT (1878–88, F. W. Stevens, Victorian Gothic with Indian elements, octagonal ribbed dome with a ~14 ft "Progress" statue, UNESCO 2004), Byculla (1887–91 Gothic stone, Grade IIA, verandahs on cast-iron posts, restored 2021–22, UNESCO Award of Merit 2022), Reay Road (1910 stone, Grade I), the Churchgate BB&CI headquarters (Venetian Gothic / Indo-Saracenic, next to the 1957 station block) and Mumbai Central (1930, Batley; style disputed). Sandhurst Road is notable as a 1925 two-tier steel-viaduct station. Exact paint colours are not in any extract.

### Cited Findings
- CSMT: designed by F. W. Stevens; construction began 1878 and took about 10 years (1887 or 1888). Victorian Gothic Revival combined with Italian Gothic and Indian elements. The **octagonal ribbed dome** has eight dovetailed stone ribs rising from an octagonal drum to a crown ring, topped by the **statue of Progress (~14 ft)**, said to be carved by Thomas Earp. Renamed 1996; UNESCO World Heritage Site 2004. — [Google Arts & Culture](https://artsandculture.google.com/story/cQUBqFzBGzp0Jw); [Victorian Web](https://victorianweb.org/victorian/art/architecture/stevens/7.html); [TIFR Bombay architecture](https://theory.tifr.res.in/bombay/architecture/building/vt.html); [UNESCO document](https://whc.unesco.org/document/154660); [Smarthistory](https://smarthistory.org/?p=49465)
- Byculla: commissioned 1853. A wooden structure (1857) was later moved north, and the present **stone building dates from 1887–1891**, Victorian Gothic, **Grade IIA** under the 1995 Greater Bombay Heritage Regulations. — [HUDCO Design Awards 2022–23, p.69](https://hudco.org.in/writereaddata/EB/HUDCO-DA23/files/basic-html/page69.html); [Global Indian](https://globalindian.com/didyouknow/byculla-one-of-the-oldest-indian-railway-stations-with-gothic-style-of-architecture-has-received-the-unescos-asia-pacific-cultural-heritage-preservation-award-of-merit-for-restoration-work)
- Byculla details: verandah roofs on **cast-iron posts set on basalt walls**, with cast-iron railings between the posts. The lower verandah roof sits on **carved wooden brackets** fixed to the cast-iron posts. The west front verandah had been bricked in and was reopened. **Stained glass and timber panelling** restored, cast-iron railings and the platform 1 facade restored, paint layers stripped from the cast iron. Signage is now a **plain teak plank hung from recreated cast-iron brackets** (from original designs found on site). — [HUDCO p.69](https://hudco.org.in/writereaddata/EB/HUDCO-DA23/files/basic-html/page69.html); [HUDCO p.67](https://www.hudco.org.in/writereaddata/EB/HUDCO-DA23/files/basic-html/page67.html); [Mumbai Live](https://www.mumbailive.com/en/infrastructure/byculla-railway-station-regains-its-original-gothic-heritage-architectural-glory-73002)
- Byculla restoration was led pro bono by Abha Narain Lambah Associates, funded by the Bajaj Group (over ₹4 crore), and run by the NGO I Love Mumbai. Completed December 2021 / April 2022. **UNESCO Asia-Pacific Award of Merit** (announced Nov 2022, presented July 2023) and a HUDCO award. — [Free Press Journal](https://www.freepressjournal.in/corporate-gallery/prestigious-unesco-award-to-byculla-railway-station-heritage-restoration-project); [Deccan Herald](https://www.deccanherald.com/amp/story/india%2Fashwini-vaishnaw-felicitates-team-that-restored-mumbais-byculla-station-1240546.html); [ANLA project page](https://anla.vercel.app/projects/byculla-station-a-social-responsibility-initiative-of-abha-narain-lambah-associa); [Free Press Journal (completed, with pictures)](https://www.freepressjournal.in/mumbai/mumbai-beautification-and-heritage-restoration-work-of-byculla-station-completed-see-pics)
- Reay Road: Grade I; stone masonry, hooded segmental arches, rectangular pilasters, lean-to roof (1910). — [Reay Road, Wikipedia (search extract)](https://en.wikipedia.org/wiki/Reay_Road_railway_station)
- Churchgate: heritage BB&CI headquarters in Venetian Gothic / Indo-Saracenic; 1957 seven-storey station block. — [TIFR](https://theory.tifr.res.in/bombay/architecture/building/churchgate.html); [FIBIS](https://wiki.fibis.org/w/Bombay_Churchgate_HQ_and_Station_BB&CIR)
- Mumbai Central: Claude Batley, 1930, built in 21 months; Art Deco vs Gothic is disputed. — [mumbaimetroroute](https://mumbaimetroroute.com/places/mumbai-central-station-heritage); [Architecture of Mumbai mirror](https://wikipedia.com/wiki/Architecture_of_Mumbai)
- Cotton Exchange (opposite Cotton Green): Art Deco, 1924. — [Cotton Green, Wikipedia](https://en.wikipedia.org/wiki/Cotton_Green)

### Inferences
- Byculla's palette from the materials: dark grey basalt walls, buff or cream dressings (typical of Bombay Gothic), black or dark cast iron, teak brown boards. Unverified; take colours from photos.
- The CSMT stone is usually described elsewhere as yellow Malad stone, with blue-grey basalt and Porbandar/Italian marble dressings. This is not in my extracts, so it is a gap to verify.

### Gaps
- Heritage grades for Mumbai Central, Sandhurst Road, Grant Road, Charni Road, Marine Lines and Chinchpokli; exact paint colours; dimensions of the CSMT facade and dome. None were found.

## 9. Redevelopment 2023–2026 (Amrit Bharat, MUTP, 5th/6th lines)

### Takeaway
Amrit Bharat (ABSS) upgrades in the island city are mostly facelifts: new booking offices, platform surfaces and covers, signage, multilingual indicators, FOBs and lifts. On the Western side they cover Marine Lines, Charni Road, Grant Road, Lower Parel and Prabhadevi. On the Central side they cover Byculla, Sandhurst Road, Parel, Chinchpokli, Matunga and Vadala Road (several opened May 2025). Bigger changes come from the CSMT–Kurla 5th/6th lines, which threaten Sandhurst Road and Parel, and from the Dadar decks and the CSMT main-line deck.

### Cited Findings
- ABSS launch: Byculla and Sandhurst Road among 15 Central Railway suburban stations. — [Free Press Journal](https://www.freepressjournal.in/amp/mumbai/mumbai-news-pm-modi-launches-amrit-bharat-station-improvement-scheme)
- 22 May 2025: the Prime Minister inaugurated 103 ABSS stations, 12 in Maharashtra. — [The Week](https://www.theweek.in/wire-updates/national/2025/05/22/bes30-mh-csmt-fadnavis.html); [Mumbaikar News](https://www.mumbaikarnews.in/?p=15126)
- Western Railway's 8 suburban ABSS stations: Marine Lines, Charni Road, Grant Road, Lower Parel, Prabhadevi, Malad, Jogeshwari, Palghar (target Dec 2024, with planned images). — [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-news-8-suburban-stations-of-wr-to-be-upgraded-by-december-2024-check-proposed-pictures); [Swarajya](https://swarajyamag.com/infrastructure/mumbai-western-railway-gets-nod-to-redevelop-seven-stations-under-amrit-bharat-station-scheme)
- Upgrades at Chinchpokli, Matunga, Parel and Vadala Road include platform surfaces and "cover over platforms". — [Mumbai Live](https://www.mumbailive.com/en/civic/chinchpokli-matunga-parel-vadala-road-and-shahad-stations-get-major-upgrades-91061)
- Western Railway Mumbai division amenities plan of ₹2,206 crore. — [Deccan Herald](https://www.deccanherald.com/amp/story/india%2Fmaharashtra%2Frs-2206-crore-plan-to-improve-passenger-amenities-in-wrs-mumbai-division-3077538)
- Western Railway list of customer-amenity works completed in FY 2024-25 (PDF). — [wr.indianrailways.gov.in](https://wr.indianrailways.gov.in/cris//uploads/files/1749043448144-Works%20completed%20under%20PH-53%20Customer%20Amenities%20in%20FY%202024-25%20(1).pdf)
- 34 platforms are to be lengthened for 15-car trains under MUTP (₹33,000 crore programme). — [Free Press Journal](https://www.freepressjournal.in/mumbai/34-mumbai-railway-platforms-to-be-lengthened-for-15-coach-trains-as-part-of-33000-crore-urban-transport-upgrade)

### Inferences
- Visually, ABSS means new granite or vitrified-tile platform floors, new profiled-sheet covers, new stainless-steel FOB railings and digital indicators. Older heritage elements remain at Byculla and Reay Road.

### Gaps
- Per-station ABSS completion status for November 2026 (only Parel is confirmed reopened).

## 10. Common elements: platform height and length, name boards, furniture, indicators, roofs

### Takeaway
Platforms were raised to about 900 mm (840–920 mm band) above rail level around 2014–2017. Most island-city platforms take 12-car trains; 15-car extension is ongoing. Station name boards are black text on yellow, stacked in three languages (Marathi, Hindi, English). The 2024 tricolour board trial was scrapped. Amrit Bharat added multilingual smart indicators in July 2025. The extracts do not describe canopies, benches or water coolers.

### Cited Findings
- Platform height: in 2014 the Ministry moved Mumbai suburban platforms from 760–840 mm to the 840–920 mm band. A committee called 900 mm optimal and 920 mm the maximum. Western Railway said all suburban platforms were raised to 900 mm (it raised 56 in 2017 and reportedly all 166). — [Lok Sabha Committee on Petitions report](https://eparlib.nic.in/bitstream/123456789/65556/1/16_Petitions_36.pdf); [Business Standard / PTI 2017](https://business-standard.com/article/pti-stories/wr-raises-height-of-56-platforms-for-passenger-safety-117041700125_1.html); [togethervcan](https://togethervcan.in/?p=1852)
- Yellow boards with black text are used because black on yellow reads best and is visible from a distance (and "in the dark"). — [Mumbai Live](https://www.mumbailive.com/en/society/railway-station-names-written-on-yellow-board-visible-in-dark-76562)
- June 2024: new tricolour station boards (square, red ring, blue band) appeared at Borivli and Badlapur under revised Railway Board guidance. Mid-day reported on 28 June 2024 that they were scrapped. — [mid-day, 26 Jun 2024](https://midday-re.vercel.app/mumbai/mumbai-news/article/mumbai-one-of-citys-first-tricolour-signboards-at-borivli-station-23357144); [mid-day, 28 Jun 2024](https://midday-re.vercel.app/mumbai/mumbai-news/article/mumbai-tricolour-signboards-scrapped-23357843)
- Indian Railways has no official public typeface. Station boards are stacked trilingual (Hindi, English, regional script), historically hand-painted to standard patterns (design blog). — [Made Good Designs](https://madegooddesigns.com/indian-railways-font/)
- Multilingual smart train indicators were installed at Western Railway suburban stations (including Lower Parel and Prabhadevi) under ABSS in July 2025. — [Free Press Journal](https://www.freepressjournal.in/mumbai/mumbai-news-western-railway-installs-smart-multilingual-train-indicators-at-key-suburban-stations-under-amrit-bharat-scheme)
- Central Railway amenity upgrades include new platform indicators and GPS clocks at various stations. — [Mumbai Live](https://www.mumbailive.com/en/civic/cr-upgrades-key-passenger-amenities-at-dadar-panvel-badlapur-and-other-stations-91283)
- Stall removal on Dadar platform 10 shows that stalls stand on the platforms themselves. — [Free Press Journal](https://www.freepressjournal.in/amp/mumbai/mumbai-central-railway-converts-platform-10-in-dadar-station-into-double-discharge-platform-for-local-trains-work-underway)

### Inferences
- Platform deck height for the game: **0.90 m above rail top**. Platform length estimates (not sourced): a 12-car EMU is about 245–260 m (about 20–21 m per car), so 12-car platforms are about 270 m and 15-car platforms about 330–340 m. Check against OSM platform polygons, which will be more reliable.
- On the Mumbai suburban name boards the Marathi line is usually on top, then Hindi, then English. This is general knowledge; Mumbai's order differs from the generic "Hindi, English, regional" layout. Verify from photos before final art.

### Gaps
- Canopy types (steel truss with corrugated or profiled sheet, column spacing), bench types, water coolers and clocks are not described in any extract. Use photos or the owner's live check.

## 11. Published layouts, diagrams and drawings

### Takeaway
No full station floor plans were reachable. Station layout tables exist on Wikipedia pages (Dadar's is known to be inconsistent), indiarailinfo has station map pages, IRFCA has archive photos and a Central Railway opening timeline, and the HUDCO award book has Byculla restoration pages. OpenStreetMap remains the best geometry source.

### Cited Findings
- indiarailinfo station map page for Dadar (Western). — [indiarailinfo](https://m.indiarailinfo.com/station/map/dadar-western-ddr/298?tt=0)
- Wikipedia layout table for Dadar ("seven tracks, one side and four island platforms"). — [Dadar railway station, Wikipedia](https://en.wikipedia.org/wiki/Dadar_railway_station)
- IRFCA Central Railway suburban opening timeline; IRFCA heritage photo gallery (Marine Lines c.1900, Grant Road 1960s). — [IRFCA timeline](https://irfca.org/docs/mumbai-cr-suburban-timeline.html); [IRFCA Marine Lines](https://irfca.org/gallery/Heritage/marine+lines+station.jpg.html)
- HUDCO Design Awards 2022–23, Byculla restoration pages (pp. 67–73). — [HUDCO p.67](https://www.hudco.org.in/writereaddata/EB/HUDCO-DA23/files/basic-html/page67.html)
- Central Railway annex PDF on station works. — [cr.indianrailways.gov.in](https://cr.indianrailways.gov.in/cris//uploads/files/1709878532006-Anex%201.pdf)

### Inferences
- A GitHub Action, which has normal network access, could fetch the Wikipedia layout tables and indiarailinfo pages that the sandbox cannot. The game's OSM extract (`data/raw/mumbai-region.osm.pbf`) already holds platform polygons and footbridge ways for exact outlines.

### Gaps
- Official Indian Railways station plans: none found publicly. No sandbox access to Wikipedia full text.
