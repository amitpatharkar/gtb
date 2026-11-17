# Intro and first mission: brief (saved, not yet built)

Status: **not started.** Saved for later. Do not code until the owner's list of fixes is done.

## 1. Names (change everywhere)

| Before | After |
|---|---|
| Shabbir bhai | **Kapil** (the passenger to pick up) |
| Player (unnamed) | **Akash** |
| Mamaji (with any surname) | **Mamaji** only, never a surname |

Affected today: `src/game/missions.js` (lines around 84–90: `pickup: 'shabbir'`, `dropoff: 'shabbir'`, "Shabbir bhai" labels and lines), `src/game/story.js` line 74 (the `shabbir` cast entry and its default name). Rename the cast id too (`kapil`), so saves and scripts agree.

## 2. Intro cutscene (plays when a new game starts)

- Very high-resolution video, not in-engine. Length: to be set by the owner (the brief implies roughly 1–2 minutes).
- Scene 1, the train: Akash is in a local train coming into Mumbai. Two people in the crowded coach mug him and take his wallet, watch and other belongings. Keep it comic and non-violent (a quick snatch, no real harm), in line with the "toned-down" rule.
- Scene 2, the platform: he gets off at Chhatrapati Chai Terminus (the game's name for CST) and tells Mamaji what happened.
- Mamaji consoles him, says he has a taxi Akash can drive, and hands over the keys.
- Scene 3, the walk: Akash gives a one-to-two-line description of Mumbai while walking with Mamaji.
- Scene 4, the taxi: they reach the kaali-peeli taxi. Akash and Mamaji shake hands; Mamaji wishes him luck.
- The video ends; the game starts with Akash in the driver's seat.

Video notes:
- Must not add to the first load of about 50 MB (CLAUDE.md). Stream it only when the owner starts a new game, or load it in the background after the title screen.
- Subtitles in the game's style (Hinglish lines, English subtitles), with a Space-to-skip like the current cutscenes (`story.playScene`).
- Lines to be written by the owner or drafted and approved; no real film lines or characters.

## 3. First mission (replaces "Mumbai Meri Jaan")

- Mamaji's brief in the taxi: pick up **Kapil** from a spot nearby (owner's words: "somewhere near only"), then take him to the **Taj hotel**.
- Game name for the hotel: **Royal Chaj Mahal Palace** (the trademarked facade and name are altered, per CLAUDE.md; the landmark already exists as `src/world/landmarks.js`).
- Pick-up point: to be chosen (see open questions).
- Drop-off: the Royal Chaj Mahal Palace front, with Kapil's dialogue on arrival.
- Keep the existing failure rules: a time limit only if the owner wants one (the current mission has 240 s).

## 4. Open questions for the owner

1. **Pick-up spot:** "somewhere near only", does that mean near the terminus, in the Colaba/Fort area, or a specific landmark? Name one and the game will snap it to the nearest road.
2. **Video method:** free options only. Options: (a) render with Blender in a GitHub Action and ship as WebM/MP4 streamed on demand (small, high quality, needs a made-up 3D scene or footage); (b) real free stock footage (check licences in `docs/research/assets.md`); (c) animated stills with voice. Which does the owner want?
3. **Length and tone** of the cutscene (the brief implies about 1–2 minutes).
4. **Start order:** should the intro play on every "New" game only, or also after a reload?

## 5. Where it lives in the code (for later)

- `src/game/missions.js` — the `welcome` mission script (cut lines, goto, pickup, dropoff).
- `src/game/story.js` — `playScene`, cast table, `pickup`/`dropoff` handling.
- `src/ui/menu.js` — title → New game hook where the intro video would start.
- `src/world/landmarks.js` — Royal Chaj Mahal Palace.
