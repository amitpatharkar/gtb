# Prompt for Claude in Chrome: visual references for the next systems

Paste the block below into Claude in Chrome. It saves its results into this folder.

```text
You are helping build GTB, a free open-world browser game set in real Mumbai at 1:1 scale
(repository: https://github.com/amitpatharkar/gtb, live game: https://amitpatharkar.github.io/gtb/).
Another Claude (cloud session) builds everything in code from written descriptions, so I need precise,
measurable visual notes, not images.

HARD RULES
- Use Google Street View, Mapillary, Wikipedia, news photos and YouTube walk/drive videos for research,
  but save LINKS only. Never copy photos into the repository.
- Free only; never pay or create accounts.
- Give sizes in metres, colours as hex codes, counts and proportions; say how common each thing is.

TASK 0 — Live check (10 minutes)
Open the live game on desktop Chrome. Drive for 2 minutes along Marine Drive and through Fort; press T a few
times to see night. Note frame rate, glitches, anything that looks wrong or un-Mumbai, and console errors.
Save as docs/research/live-check-2.md.

TASK 1 — Reference sheet → docs/research/visual-references.md
For each item: what it looks like, dimensions, colours (hex), materials, variants, where and when it appears in
South Mumbai, how people use it, 3 reference links.
 1. Street food stalls and thelas: vada pav cart, chai tapri, pav bhaji stall, bhel puri, sugarcane juice,
    fruit thela, coconut seller, pani puri, corn (bhutta) seller on Marine Drive. Include typical menu items and
    prices in ₹ (for an in-game food system).
 2. Irani cafés and small restaurants (outside view): signboards, chairs on the footpath, opening hours.
 3. People: typical clothing by group (office workers in Fort, dabbawalas, fishermen and Koli women in Colaba,
    college students, tourists at Gateway, hawkers, joggers on Marine Drive), colours and proportions.
 4. Mumbai Traffic Police: uniform (white shirt, navy trousers, cap/beret colour), booth/umbrella design,
    challan device, typical fines for common offences (signal jump, wrong way, no helmet, footpath parking) in ₹.
 5. Mumbai Police (law and order): uniform (khaki), patrol vehicle livery (car and bike), siren and light
    colours, police chowky design. Suggest a parody name and livery so it isn't a real logo.
 6. Flyovers in South Mumbai: JJ flyover, Kemps Corner, Marine Lines, Grant Road, Princess Street — start/end
    coordinates, deck height above road, width and lanes, pier shape and spacing, parapet style, what is under them.
 7. Road wear: potholes (size, depth, frequency by road type), patch repairs, garbage spots (what is in them,
    where they appear), monsoon waterlogging spots in South Mumbai (named locations, depth).
 8. Holi in Mumbai: pichkari designs and colours, colour powder (gulal) colours, water balloons, where
    celebrations happen; plus tomatoes (for a comedy throw mechanic): how they'd splat on walls/cars.
 9. Petrol/CNG pumps and car repair garages in South Mumbai: canopy colours of each brand (give parody names),
    pump layout, price boards, puncture-repair stalls.
10. Traffic mix by time of day on Marine Drive, P D'Mello Road and Kalbadevi Road: share of taxis, private cars,
    buses, two-wheelers, handcarts; typical speeds at rush hour vs night.
11. Air quality: typical AQI for South Mumbai by month and hour (CPCB data sources), what haze looks like at
    AQI 100, 200 and 300 (visibility in metres, sky colour).

Save the file on https://github.com/amitpatharkar/gtb with "Add file → Create new file", path
docs/research/visual-references.md, "Commit directly to the main branch". Reply with a short summary.
```
