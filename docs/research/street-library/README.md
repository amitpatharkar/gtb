# South Mumbai street asset library

Every named street of South Mumbai (Colaba → Byculla/Mazgaon, box 18.890,72.795 → 18.985,72.860), matched to the
game map, with a **street profile** that says what the street looks like at ground level and which assets to use.
Built 2026-11-14 from the game's own map data (`data/raw/mumbai-region.osm.pbf`) plus a Google Street View survey of 35 points
(observations written as text; **no Street View images are stored**, only links).

| File | What |
|---|---|
| `profiles.json` | 25 street profiles ("block guides" per street type): road section, buildings (styles, storeys, colours, ground floor, details), trees (incl. game point mix), lights, clutter, traffic, sounds, asset ids. Also 5 proposed new districts for the gaps in `scripts/lib/districts.mjs`. |
| `streets.json` | 847 named streets (≈395 km of centre line): OSM way ids, class, lanes, one-way, bridge, length, mid point (lat/lon **and game x/z**), bearing, district, profile (+ zones for long streets), counts from OSM (buildings, storeys, shops, trees, signals, bus stops), survey notes where surveyed. |
| `buildings-notable.json` | 460 notable buildings (heritage, worship, schools, hotels, offices, landmarks…) with OSM way id, lat/lon, game x/z, footprint, storeys, key tags and the street they face. |
| `survey.json` | The Street View survey: 35 stops with point, heading, date of imagery and written notes (open a stop with the link format below). |
| `tools/build_street_library.py` | Re-generates `streets.json` and `buildings-notable.json` from the `.osm.pbf` (Python + `osmium`, `shapely`). |

Street View link for any point: `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=LAT,LON&heading=H&pitch=0&fov=80`
(surveyed streets carry it as `streetview`).

## Coordinates (same as `scripts/build-tiles.mjs`)
Origin 19.03 N, 72.85 E (Mahim). `x = (lon − 72.85) × M_LON`, `z = −(lat − 19.03) × M_LAT`, metres,
with `M_LAT = 111132.92 − 559.82·cos(2φ) + 1.175·cos(4φ)` and `M_LON = 111412.84·cos φ − 93.5·cos 3φ` at φ = 19.03°
(≈110,692 and ≈105,273 m per degree). `game_xz` in the files already uses this. Bearing is a compass bearing
(0 = north, 90 = east) of the street at its mid point.

## How to match with the converter
- **Roads:** `osm_way_ids` are the OSM way ids of all pieces of the street. The converter reads the same ways
  (`roadsRaw[].id`), so a lookup `wayId → street` gives the profile for every road segment. Names follow the converter's
  rule (one name per road, variants merged) and keep the other spellings in `variants`.
- **Zones:** a few long streets change character (e.g. Shahid Bhagat Singh Marg = Colaba Causeway in the south, heritage
  boulevard by Kala Ghoda, arcade street near CST). Use `zones[].lat` (min, max latitude) to pick the profile per segment.
- **Buildings:** give each building the profile of the nearest named street within ~35 m (its frontage street);
  otherwise the district default (`profiles.json → new_districts` + `districts.mjs`). Profile `buildings.styles`
  use the `STYLE` names of `districts.mjs` (PLASTER, WEATHERED, DECO, STONE, BASALT, CONCRETE, GLASS, SHED, BRICK);
  "use district weights" means keep the district's own weights.
- **Notable buildings:** `id` = OSM way id (same as `buildingsRaw[].id`). Use them for hand-made facades, entrances,
  name boards with altered names, and mission/landmark places. Check names against the rules in `CLAUDE.md`
  (parody names for brands and trademarked buildings; never show private homes' names).
- **Trees:** `profiles[].trees.game_points` maps species to the game's point kinds (`POINT.RAIN_TREE`, `GULMOHAR`,
  `PEEPAL`, `PALM`) and `per_100m` gives density per side.
- **Assets:** ids without a prefix are in `docs/research/assets.json`; `game:XXX` are procedural kinds in
  `src/world/tileFormat.js` `POINT` (`LIGHT`, `SIGNAL`, `BUS_STOP`, `STALL`, `GARBAGE`, `TETRAPOD`, …).

## Profile sources
`profile_source` tells how confident a street's profile is:
`explicit` (surveyed or well known) > `name-rule` (name pattern, e.g. "…wadi", "Carnac", "Dockyard") >
`district-main` / `district-lane` (district default for main roads / lanes) > `rule:class` (service lanes, footways) >
`rule:flyover`. Streets with `survey` were visited in Street View.

## Key findings from the survey (apply everywhere)
1. **Median kerbs are BLACK-WHITE striped** (blocks ~0.6 m) almost everywhere in South Mumbai (Colaba Causeway, Madame Cama
   Road, Veer Nariman Road, Marine Drive islands, Lamington Road, Pedder Road, Ridge Road, Haji Ali); on Pedder Road and Ridge Road the
   footpath kerbs are black-white too. Black-yellow appears on footpath kerbs of some main roads and at junctions; lanes have plain grey kerbs.
2. **Planted medians** (2 m, dense hedges) with **decorative lamp posts** in the median: black triple-lantern heritage posts
   (Colaba Causeway), grey twin-globe or three-globe posts (Veer Nariman, Madame Cama); plain single-arm LED poles elsewhere.
3. **Parking defines the street edge:** kaali-peelis in long rows (taxi stands), cars nose-to-tail on both kerbs of every
   residential lane, two-wheelers in rows, double parking in Nariman Point.
4. **Fort arcades:** continuous Gothic stone arcades with shops inside on Dr Dadabhai Naoroji Road; Colaba Causeway has an
   arcade on the east side with stalls.
5. **Rain-tree tunnels** in Colaba/Fort lanes; palms on Marine Drive and in Cuffe Parade compounds.
6. **Construction netting:** about one building in ten wears green netting + scaffolding (Marine Drive too).
7. **Port edge:** white-washed dock walls with concertina wire, grey jersey-barrier medians and parked box tempos (P D'Mello Road).
8. **Bazaars:** orange/white plastic barricades, political flex banners on lamp posts, blue direction boards, stacked box signs,
   white cloth canopies over puja/flower stalls (Bhuleshwar), goods and sacks on the ground.
9. **Construction everywhere (2026):** blue corrugated metal hoardings with notice boards and green mesh fences around Metro and
   redevelopment sites; 30–40 storey towers rising behind 4-storey chawls in Bhendi Bazaar, Nagpada, Girgaon.
10. **New elevated roads:** T-shaped piers with orange pier caps (Haji Ali), galvanised W-beam barriers, blue-painted parapets (Eastern Freeway).
11. **Barricades:** yellow steel frames with blue boards (traffic police) and orange-white plastic water barriers.

## Gaps and next steps
- Only part of the streets have a survey; the rest use rules. Re-run the survey for streets with `profile_source`
  `district-*` in the busiest districts first (Bhendi Bazaar, Nagpada, Kalbadevi, Byculla).
- Five districts are **proposed** (not yet in `districts.mjs`): Bhendi Bazaar, Nagpada, Dongri Mandvi, Mumbai Central,
  Reay Road — they cover most of the 214 streets that currently fall back to the generic "Mumbai" style.
- Building outlines from OSM relations (multipolygons) are not in `buildings-notable.json` (way outlines only).
- Some Street View points snap to indoor photospheres or have no coverage (Navy Nagar, parts of P J Ramchandani Marg).

Map data © OpenStreetMap contributors (Open Database License). Street View is only linked, never copied.
