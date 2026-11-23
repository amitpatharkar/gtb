# Interface (UI/UX) — how Bombay Bawaal shows information

Built on 2026-11-23 from the principles in HNK Media's case study "GTA 5 UI/UX Design: A Deep Dive Into the
Interface, HUD, Navigation & Interaction" (https://hnkmedia.com/case-studies/gta-5-ui-ux-design/), applied to our
game. Section numbers (§) refer to that study. The one rule behind everything: **the right information at the
right time, without making the interface the main experience.**

## Priorities (§2–4)
| Level | What | Where |
| --- | --- | --- |
| High priority, always available | Radar with GPS route, health / armour / stamina, weapon + ammo, wanted level (once police exist) | Radar bottom left, weapon top right |
| Contextual, appears when relevant | Current objective, prompts with the right button, notifications, area/street name, speedometer in a car, crosshair when aiming, vehicle name | Objective + notifications top left, prompt bottom centre, area + speed bottom right |
| Secondary, on request | Stats, settings, message log, controls, credits | Pause menu |

**HUD modes (§20A)** in Settings: *Full* (everything stays), *Contextual* (default: weapon/ammo, bars and area names
fade out when nothing changes and come back when they matter), *Minimal* (radar only with a route).

## Radar and wayfinding (§5–7)
- GTA-style rounded rectangle, rotates with the camera, player arrow low on the radar (more road ahead), zooms out
  with speed, north marker on the edge.
- Choose a destination (map click, a place in the map list, phone Maps, or an objective) → route calculated on the
  whole road network (A* in `src/ui/mapWorker.js`, one-ways respected) → purple line on radar and map → distance
  counts down on the radar → "You have arrived" with a chime. Off the route for 2 s → it re-routes quietly.
- Points of interest on the radar and map: landmarks (altered names, `src/ui/places.js`), neighbourhoods, petrol pumps,
  parked cars; the waypoint is pinned to the radar edge when it's off-screen.

## Pause menu — information architecture (§8–9)
`MAP · BRIEF · STATS · SETTINGS · GAME` (Esc or Start; M opens the map directly). Header: where you are, Mumbai time,
time played. Footer: the buttons that work on this screen, for the device you use.
- **Map**: pan (drag / arrows / stick), zoom (wheel / triggers), click a street = waypoint; **filters** per category
  (§20B); places list (recognition rather than recall); the playable area is outlined, the rest of Mumbai dimmed.
- **Brief**: current objective and the notification log.
- **Stats**: progress (distance on foot / driven, top speed, shots, crashes, destinations reached…).
- **Settings**: every setting says what it does (§20C): graphics, HUD mode, guidance, camera sensitivity, invert,
  volume, vibration.
- **Game**: controls for your device, back to Apollo Bunder, replay the tutorial, car tuning, credits.

## Interaction (§10–11, §14)
- Contextual controls: walking up to a car offers "F Get in"; inside, the HUD switches to speed and gear and the
  weapon panel goes away (no separate "vehicle mode" to manage).
- **Weapon wheel** (hold Tab / LB): eight slots, all visible at once with name and ammo; point with the mouse or right
  stick, let go to equip; the game slows to a quarter while it's open. Empty slots show what's coming.
- Button glyphs follow the device you're using (keyboard or controller), everywhere (§17 consistency).

## Feedback (§12–13)
- Visual: hit marker on the crosshair, red screen edges when hurt (pulsing when health is low), objective box flashes
  green when done, notifications slide in and fade (never more than three).
- Audio: interface sounds for menus, the wheel, notifications, objective chime, hurt, wasted.
- Controller vibration: shots, crashes, getting hurt (Settings → off).
- Notifications appear when relevant → communicate → disappear; everything goes into Brief and the phone's Messages.

## Phone (§15–16)
A diegetic interface — an object in the character's hand: P / d-pad up. Maps (pick a place → route), Messages,
Contacts (empty for now), Settings. You can keep walking while it's out.

## Onboarding (§20D)
Seven objectives teach the controls by doing (look around → get in a car → drive to the Gateway of Indiyaa → get out →
pick the pistol from the wheel → shoot a crate → set your own waypoint). **Guidance** setting: *More* (objective +
the buttons), *Less* (objective only), *Off*, *Auto* (more on the first visit, less on visits 2–3, then off).

## Test it (§21)
The smoke test checks the HUD, the route, every menu tab, the wheel and the phone. The real test is the owner and
friends trying tasks ("find a setting", "drive to a place", "change weapon") and noting where they hesitate.

## Files
`src/ui/hud.js`, `nav.js`, `mapWorker.js`, `mapView.js`, `menu.js`, `weaponWheel.js`, `phone.js`, `glyphs.js`,
`icons.js`, `places.js`; `src/game/onboarding.js`, `stats.js`; styles in `src/style.css`; sounds in `src/core/audio.js` (`ui()`).
