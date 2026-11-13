# Live check — https://amitpatharkar.github.io/gtb/

Date: 2026-11-13 · Desktop Chrome 155 (macOS, Apple M4 GPU via ANGLE Metal) · window 1120×888, devicePixelRatio 2

## Load
- First paint / first contentful paint: **~0.8 s**; `load` event: **~0.9–1.1 s** (warm and cold-ish reloads).
- Main-thread requests: `index-*.js`, `index-*.css`, `tiles/index.json`, `tileWorker-*.js` (tiles are fetched inside the worker).
- Scene was fully visible (road, sea, buildings) within ~1 s; no loading screen needed at this size.
- JS heap after 30 s of driving: ~25 MB.

## Driving test (~30 s, W/A/S/D then R)
- Keys were sent as keyboard events (keydown/keyup sequence: W, W+A, W+D, S, W+D), then R once.
- Frame rate: **60 fps steady for all 31 seconds** sampled (requestAnimationFrame count per second: 60–61, no drops).
- Speedometer and street name HUD work ("Prem J. Ramchandani Road" at spawn). Reached ~22 km/h within a few seconds.
- **R reset worked**: auto-rickshaw returned to the spawn point facing down the road.

## Console
- **No errors or warnings** in the console during load or play. No uncaught `window.onerror` events.

## Visual issues / glitches noticed
1. **No collision with the sea wall / promenade edge**: steering left took the auto off the road, across the promenade and right to the water's edge, ending up facing the sea. Need kerb/sea-wall colliders (and maybe a water "reset" trigger).
2. Auto-rickshaw is a placeholder (yellow box top, black body, green lower band — colours are right, shape is not; no windscreen, no three-wheel stance).
3. Buildings are plain extruded boxes with a uniform window texture; all off-white/cream. No balconies, shop fronts, signs, AC units, colour variety or weathering.
4. Sea is a flat tiled normal-mapped plane with an obvious repeating pattern at distance; no shoreline foam or tetrapods (Marine Drive / Colaba sea walls have concrete tetrapods).
5. Promenade/footpath is one grey gravel-like texture; no kerb height visible, no black-yellow kerb paint, no paver blocks.
6. Sky is a flat hazy gradient; fog colour matches, but no sun direction cue, clouds or HDRI.
7. Empty streets: no traffic, pedestrians, trees (coconut palms on the seafront), street lights, wires or hawkers.
8. Road markings look good (dashed centre lines, edge lines); asphalt texture is clean but very uniform — needs wear, patches and oil stains.
9. Strong, soft contact shadow under the vehicle works well.

## Suggested next steps
- Add colliders for kerbs/sea wall; respawn if the vehicle enters water.
- Replace placeholder auto with a low-poly model (see assets.json) and add street props + trees along the seafront first, since that is the spawn view.
- Realism note: the player spawns in an **auto-rickshaw on a South Mumbai seafront road**. Autos are not permitted south of Bandra/Sion — spawn a kaali-peeli taxi there instead (see mumbai-guide.md § C5).
