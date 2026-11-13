# How GTA V Was Made — Development Analysis

13 Nov 2026 · Amit. Reference for how GTB is built: we follow Rockstar's method where it is cheap
enough for a free, solo browser game (see section 10 and the "Design principles" section of `CLAUDE.md`).

## 1. Overview and scale

Grand Theft Auto V took about five years from first ideas to finished disc, and more than 1,000 people across seven Rockstar studios. It shipped in September 2013 and has been re-released on three console generations since.

| Item | Figure |
|---|---|
| Lead studio | Rockstar North, Edinburgh (core team of about 360) |
| Supporting studios | Rockstar Leeds, Lincoln, London, New England, San Diego, Toronto |
| Total team | 1,000+ (studio president Leslie Benzies: "probably more, much more") |
| Timeline | Early work from April 2008 (Grand Theft Auto IV launch); full production about 3 years; sent to manufacturing 25 August 2013 |
| Development budget | Over US$137 million (analyst estimate) |
| Development + marketing | About US$265 million (The Scotsman estimate), the most expensive game of its time |
| World size | About 130 square kilometres (49 square miles) |
| Releases | PlayStation 3 / Xbox 360 (2013) → PlayStation 4 / Xbox One (2014) → PC (2015) → PlayStation 5 / Xbox Series (2022) |

Rockstar runs as one connected company: every studio works on the current flagship, then all move together to the next one. Key leads were Leslie Benzies (producer), Dan Houser (writer), Aaron Garbut (art director) and Adam Fowler (technical director).

Sources: Wikipedia: Development of Grand Theft Auto V; MCV/Develop: Inside Rockstar North.

## 2. Planning and design principles

Rockstar's core rule is that the world is designed before the game: the city is the lead character, and missions are built around places that already exist.

**Principles**
- **The city is the star.** Dan Houser has said the lead character of every Grand Theft Auto is the city; the art director's job is to make it run and behave like a real place.
- **Idea first, then scope.** Four people (Leslie Benzies, Sam and Dan Houser, Aaron Garbut) shape each game's concept. For Grand Theft Auto V the first idea was simply a broad landscape with lots of outdoor space, because the team now understood its technology well.
- **One theme.** Money ran through everything, a reaction to the 2008 financial crisis.
- **Depth over breadth.** San Andreas (2004) had three cities; Grand Theft Auto V chose one city plus countryside, so the whole team could make it richer.
- **Real as a starting point, not a rulebook.** Los Angeles was the reference, but Garbut said the team was "not dictated by reality".
- **Nothing can be faked.** Once you can fly anywhere, every distant hill and rooftop has to exist as real geometry.
- **Satire everywhere.** Thousands of fake adverts, brands, radio adverts and talk shows carry the humour outside the story.
- **Never repeat yourself.** Each game must feel like a step up from the last.

**How the world was planned (Garbut's process)**
1. Start with a literal map, not a design document.
2. Research online (Google Maps, Street View), then visit places in person.
3. Write a guide for every city block: intended look, Street View coordinates, and photos from location scouts.
4. Six to eight people spend 9 to 12 months blocking out a rough, drivable map, shaping the city "like a sculpture" and checking views down each street.
5. Level designers drive the blockout and feed back on what is fun; the map is reworked.
6. The art team grows (about 150 artists). Artists rotate between areas instead of owning one, so quality stays even.
7. Every area is raised to one quality bar; nothing is locked, and changes continue until release.

Sources: MCV/Develop: Inside Rockstar North, Part 4: The Art; GamesBeat: Dan Houser on making GTA V; GameSpot: Houser interview; Wikipedia.

## 3. Recreating Los Angeles as Los Santos

Los Santos is a compressed, remixed Los Angeles: about 130 square kilometres, roughly one-eightieth of Los Angeles County, built from heavy research but rearranged for fun.

**Research**
- Field trips around Southern California with tour guides and architectural historians.
- About 250,000 photographs and many hours of video; reportedly over 100 days of research in the city.
- Interviews with undercover police and FBI agents, organised-crime experts and gang members, plus a prison visit, to get behaviour and dialogue right.
- A New York research team worked with film-location crews to scout specific spots.
- Google Maps and Street View guided the road network; census data, virtual globes and documentaries guided where rich, poor and middle-class areas sit.

**Turning the real city into a game city**
- **Compression:** distances shrink, so a drive across town takes minutes, but the order of districts stays recognisable (downtown, beach, hills, port, airport).
- **Renamed districts:** Bunker Hill became Pillbox Hill, Bel Air became Richman, Hollywood became Vinewood; landmarks like the Griffith Observatory became the Galileo Observatory.
- **Landmark density:** Garbut said the real choice is how many real landmarks to use at the building level; the rest is invented to fit.
- **Countryside:** mountains, desert, the Salton Sea area (inspired by a trip to Bombay Beach) and forests were added. Wildlife fills them so they don't feel hollow, and the larger space allowed fixed-wing planes.
- **Scale check:** the finished map is big enough to hold San Andreas, Grand Theft Auto IV and Red Dead Redemption combined.

Sources: Wikipedia; GamesRadar: Why Los Santos is iconic; PlayStation LifeStyle: Garbut interview.

## 4. Technology: engine, streaming and rendering

The whole game rests on streaming: technical director Adam Fowler called it "the backbone of everything we do". A 130-square-kilometre world with no loading screens ran on consoles with only 512 megabytes of memory.

**Engine**
- Rockstar Advanced Game Engine (RAGE): in-house, started at Rockstar San Diego, first used for an open world in Grand Theft Auto IV (2008). It was overhauled for Grand Theft Auto V mainly to push draw distance.
- Bought-in middleware, kept to a minimum: Euphoria (NaturalMotion) for physics-driven character reactions, Bullet for physics, Scaleform for menus and heads-up display, Bink for video. Rockstar only buys a tool if it beats what they could build.
- Tools built for the game, not for their own sake: the five years between games went into optimising each system rather than just adding features.

**Streaming**
- Almost everything streams in and out around the player: models, textures, mission objects and even the navigation mesh that tells characters where they can walk.
- It stays stable for hours of play, with no loading pauses while driving.
- Hiding the limits: planes fly slower than real life so streaming can keep up; fast camera jumps are covered by a zoom-out-and-back animation that takes the roughly 5 seconds streaming needs.

**Level of detail (Rockstar's biggest strength)**
- Every area exists in several versions with fewer and fewer polygons. A distant car can be just two headlight glows; the full model appears as you approach.
- The whole Vinewood Hills area, several square kilometres, is drawn far away as one mesh of about 2,500 triangles and one texture. Up close the same area takes thousands of draw calls.
- Far-off street and car lights are tiny glowing squares batched together, so night skylines look full at little cost.
- Swaps between detail levels use a dither ("stipple") fade instead of a visible pop.

**How a frame is drawn (PC version, about 4,000 draw calls)**
1. Low-detail reflection map of the surroundings (used by cars and glass).
2. Culling: decide what is visible and at which detail level.
3. Deferred rendering: opaque objects write colour, surface direction, shininess and depth into five buffers at once.
4. Shadows: four cascades, sharp near the camera, cheaper far away; clouds also cast shadows.
5. Ambient occlusion (soft contact shadows), skin scattering, then lighting.
6. Water with its own small mirrored reflection, refraction and depth colour.
7. Atmosphere: light shafts, fog, sky and clouds.
8. Glass and particles, then bloom, film-style tone mapping with eye adaptation, anti-aliasing and slight lens distortion.

A reversed logarithmic depth buffer keeps far mountains from flickering, which matters when the view reaches across the whole map.

Sources: MCV/Develop: Inside Rockstar North, Part 3: The Tech; Adrian Courrèges: GTA V Graphics Study, Part 1 and Part 2 (level of detail and reflections); Wikipedia.

## 5. How the world behaves

Los Santos feels alive because of many cheap, layered systems that only run near the player, not because every person is fully simulated.

| System | How it works |
|---|---|
| Population spawning | Pedestrians and cars appear just out of view around the player and disappear behind them. The mix depends on the district: rich areas spawn expensive cars and well-dressed people, the beach spawns joggers and surfers. |
| Scenarios | Hand-placed "points of interest" where spawned characters do something specific: sit on a bench, smoke outside a shop, fix a car, sunbathe. Vehicle scenarios pick from about 145 themed vehicle sets (ambulances, construction trucks and so on). |
| Traffic | Cars follow lane paths baked into the road network, obey lights, honk and react to the player within a short range. Density was capped to protect streaming and physics on old hardware. |
| Ambient dialogue | Pools of short, reusable lines triggered by context (bumping someone, a crash, the weather). Replies are kept brief so each recorded line can be reused often. |
| Wanted level | One to five stars. Officers have vision cones shown on the mini-map; break line of sight and the stars flash, then clear after a timer. Higher stars add helicopters, tactical teams and longer searches. This replaced Grand Theft Auto IV's simple search circle. |
| Physics reactions | Euphoria makes people stumble, grab things and fall differently every time, instead of playing a fixed animation. |
| Dynamic events | Random encounters while exploring (a robbery, a broken-down car, an armoured van to intercept), borrowed from Red Dead Redemption. |
| Day, night and weather | A full day cycle and changing weather alter lighting, traffic and pedestrian behaviour; wet roads reflect headlights. |
| Wildlife | Deer, coyotes, birds and sea life fill the countryside so it doesn't feel empty. |
| Satire layer | Fake brands, billboards, shops, websites on the in-game phone and television shows make the world comment on itself. |

**Design trick:** most of the life is staging. Rockstar places scenarios where the player will look (pavements, shop fronts, junctions) and uses cheap distant crowds, so a city of "thousands" only ever simulates a few dozen nearby people in full.

Sources: GTA Wiki: Wanted Level in GTA V; GTA Wiki (Fandom): Vehicle scenarios; Game Developer: GTA V's pedestrian dialogue system; Wikipedia.

## 6. Assets and art production

Every building, car and person was hand-made by about 150 artists and then hand-reduced into cheaper distant versions; very little was procedurally generated.

| Asset type | How it was made |
|---|---|
| City and terrain | Blocked out first as simple shapes by 6 to 8 people, then detailed block by block from research photos. Artists rotated between districts to keep quality even. |
| Distant versions | Low-polygon stand-ins for whole districts and hills, likely tuned by hand by artists, used for distance, reflections and flying. |
| Vehicles | Fictional brands that blend real cars (no licensing fees). Built as a solid core plus detachable parts (doors, bumpers, bonnet, lights) that dent, break or fall off. Benzies noted cars once had four moving parts; now nearly everything moves. |
| Characters | Main cast captured with full performance capture: body, face and voice recorded together on a stage. |
| Pedestrians | Hand-made archetypes (beach, business, gang, tourist) with swappable clothes, props and ages, so crowds don't repeat obviously. |
| Animation | Motion-captured movement blended with Euphoria physics. The 2014 re-release alone added about 3,000 new weapon animations. |
| Props and signage | Thousands of fake brands, shopfronts, billboards and adverts; also the main home of the satire. |
| Lighting | Detailed time-of-day and weather lighting presets; Garbut called consistent lighting the key to a unified look on old hardware. |

**Production approach**
- Detail by layers: blockout, then hero landmarks, then streets, then props and life, then distant versions and optimisation.
- High-resolution source art from day one: PC development ran alongside the console versions, so art was authored above console quality and scaled down. That made the 2014, 2015 and 2022 re-releases far cheaper.
- Everything reusable: car interiors, engine sounds, pedestrian clothing and prop sets are shared across many models.

Sources: MCV/Develop: Inside Rockstar North, Part 4: The Art; MCV/Develop: Benzies interview; GTA Wiki: Vehicle damage; Adrian Courrèges: Graphics Study, Part 2; Wikipedia.

## 7. Audio, radio and voice

Audio carries much of the world's personality: about 150,000 lines of dialogue from roughly 700 actors, 17 radio stations, and the series' first original, mission-reactive score.

| Area | Key facts |
|---|---|
| Dialogue | 150,000+ lines, nearly double Grand Theft Auto IV's 80,000 on the same consoles. A typical pedestrian has about 200 lines. |
| Recording | Three studios recorded at once; up to about 100 pedestrian actors a week, about an hour each. Some ambient gang voices were recorded with real gang members for authenticity. |
| Radio | 241 licensed songs (cut down from 900+ planned) across 15 music stations plus 2 talk stations, each with its own DJ, adverts and comedy. |
| Score | First original score in the series, by Tangerine Dream, Woody Jackson, The Alchemist and Oh No, mixed by DJ Shadow. 20+ hours, built from layered "stems" that rise and fall with the action in each mission. |
| Audio engine | Tracks about 1,000 sounds at a time but only plays the 96 most important, ranked by loudness and distance. Many sounds are assembled live from small parts to save memory and add variety. |
| Vehicles | Engine sounds are recorded with several microphones and played back granularly so they follow engine speed exactly. Cars sound different near and far, and engines tick as they cool after hard driving. |

**Why it matters:** radio and pedestrian chatter are cheap compared with 3D art, yet they make every drive feel full and funny.

Sources: AudioTechnology: Grand Theft Audio; GamesRadar: GTA IV audio Q&A; MCV/Develop: real gang members voiced characters; Wikipedia.

## 8. Missions and content design

Missions are built on top of the finished map: designers pick existing locations, and the map is only moved when a story beat truly needs it.

**The heist structure (the game's signature)**
1. Case the target: scout the location in person (for example the jewellery store), spot cameras, entrances and guards.
2. Pick an approach: usually loud or quiet. Each unlocks different setup missions and needs different gear.
3. Prepare: short, free-form setup jobs, like stealing a getaway car or equipment, done whenever the player likes.
4. Hire a crew: cheap helpers take a smaller cut but perform worse; skilled ones cost more. Helpers who survive get better for later jobs.
5. Execute: a scripted set-piece whose difficulty and payout depend on earlier choices.

This turns a linear mission into a small decision game while staying fully scripted underneath. It grew out of Grand Theft Auto IV's popular bank-robbery mission, "Three Leaf Clover".

**Other content layers**
- Story missions with optional "gold medal" goals (time, accuracy, style) for replay value.
- Strangers and Freaks: short side-story chains marked by question marks on the map.
- Random events: robberies, hitchhikers, broken-down cars that pop up while driving.
- Activities: golf, tennis, racing, flight school, hunting, yoga, cinema and television, plus a stock market tied to in-game events.
- Collectibles and secrets hidden across the map to reward exploring.
- Online mode (October 2013): the same map reused for multiplayer jobs, races and later online heists, which kept the game earning for over a decade.

**Mission design principle:** use places the player already knows, keep each mission one clear idea (a chase, a stealth entry, a heist), and let the open world fill the gaps between missions.

Sources: MCV/Develop: Inside Rockstar North, Part 4: The Art; Game Informer: The Art of the Heist; Shamus Young: GTA V Heists; Wikipedia.

## 9. Execution: how production ran

Rockstar ran Grand Theft Auto V as one virtual studio across time zones, kept the map playable from early on, and treated the 2013 launch as the start of a 13-year product rather than the end.

**How the work was run**
- One shared plan, many studios: Edinburgh owned the vision and the map; other studios built systems, content, vehicles, audio and testing. Because "everything interacts with everything", leads talked daily or weekly.
- Playable map first: the blocked-out city was drivable within about a year, so designers tested missions and driving feel in the real layout for years before release.
- Constant iteration: nothing was locked; layouts, missions and tuning changed right up to the deadline.
- Fix the feel: driving was reworked to feel closer to racing games after complaints about Grand Theft Auto IV's heavy handling; hard lock-on aiming was replaced with a lock that breaks after a few seconds.
- Build for the future: PC (64-bit, DirectX 11) and high-resolution art were developed in parallel, which made later versions much easier.
- Dedicated testing: Rockstar Lincoln, one of the partner studios, specialises in quality assurance across the whole game.

| Date | Milestone |
|---|---|
| March 2026 | Grand Theft Auto V passes about 230 million copies sold (Take-Two) |
| March 2022 | PlayStation 5 and Xbox Series release |
| April 2015 | PC release, after three delays for polish; adds the Rockstar Editor replay tool |
| November 2014 | PlayStation 4 and Xbox One release: denser traffic, better vegetation and weather, first-person view |
| October 2013 | Grand Theft Auto Online launches on the same map |
| September 2013 | Launch on PlayStation 3 and Xbox 360; passes US$1 billion in sales within three days |
| 25 August 2013 | Development ends; game sent to manufacturing |
| About 2010 | Actor performance capture begins |
| April 2008 | Concept work starts as Grand Theft Auto IV ships |

Sources: MCV/Develop: Inside Rockstar North, Part 3; Wikipedia; Game Developer: GTA V surpasses 230 million; Instant Gaming: 230 million copies.

## 10. Lessons to apply to GTB

The parts of Rockstar's method that matter most for a free, solo browser game are the cheap ones: map first, streaming plus level of detail, staged life near the player, and humour through radio and signage.

| Grand Theft Auto V practice | GTB version |
|---|---|
| Literal map first, missions later | OpenStreetMap South Mumbai as the base; plan missions only after the city is drivable |
| Real city as a starting point, not a rulebook | Keep the street layout real but shrink distances and exaggerate landmarks (Gateway of India, CST, Marine Drive) |
| Compressed geography | Scale the map down (for example 1 game metre = 2 to 3 real metres) so a drive across South Mumbai takes 3 to 5 minutes |
| Block-by-block guides | One short note per area: Colaba (tourists, cafes), Fort (offices, old buildings), Marine Drive (sea, joggers), CST (crowds, trains) |
| Streaming is the backbone | Load 500-metre tiles around the player; unload behind |
| Aggressive level of detail | Far tiles as single merged meshes; near tiles with detail; distant lights as glowing points |
| Hide streaming limits | Cap vehicle speed; use camera tricks or a short fade when teleporting |
| Staged life, not full simulation | Spawn a few dozen pedestrians and cars near the player; hand-place "scenarios" (vada pav stalls, chai tapris, cricket in maidans) |
| District-based spawning | Kaali-peeli taxis and BEST buses in Fort, autos banned south of Bandra (true to Mumbai), fishermen in Colaba |
| Wanted level with sight cones | Traffic-police "challan" stars: break line of sight to escape |
| Satire through signage and radio | Fake brands and billboards, plus a Bollywood-style radio station with joke adverts; cheap and very funny |
| Euphoria-style reactions | Simple ragdoll physics for comedy falls (free physics engines like Rapier or cannon-es) |
| Reusable parts | Shared car interiors, clothing sets and prop packs from free libraries |
| Playable early, iterate forever | Deploy every push to GitHub Pages and keep testing the feel on phone and laptop |
| Plan for the future | Author assets at decent quality, export compressed versions for the web |

**Biggest takeaway:** Rockstar spent most of its effort on making the world believable from where the player stands. GTB can get the same feeling at tiny cost by putting detail only where the camera looks.
