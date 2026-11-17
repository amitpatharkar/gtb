// Title screen (Continue / New game / Settings / Guide / Credits), GTA-style illustrated
// loading screens with tips, and the in-game pause menu. Settings are saved in this browser.

import { CHEATS } from '../game/cheats.js';
import { GAME } from '../brand.js';
import { pickTier } from '../settings.js';
import { SCENE_LIST, LOADING_ORDER } from './scenes.js';

const LOGO = `<img class="logo-img" src="${import.meta.env.BASE_URL}brand/logo.webp" alt="${GAME.name}" draggable="false">`;
const ICON = {
  play: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l12-7.5z" fill="currentColor"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" stroke-linecap="round"/></g></svg>',
  book: '<svg viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M4 5.5c3-1.2 5.5-1 8 .8 2.5-1.8 5-2 8-.8v13c-3-1.2-5.500-1-8 .8-2.500-1.800-5-2-8-.8z"/><path d="M12 6.300v13"/></g></svg>',
  people: '<svg viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="9" cy="8.500" r="3.200"/><path d="M3 19.500c.5-3.500 3-5.200 6-5.200s5.500 1.700 6 5.200"/><circle cx="17" cy="9.500" r="2.500"/><path d="M16.500 14.300c2.400 0 4 1.300 4.500 4"/></g></svg>',
  clock: '<svg viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="8.500"/><path d="M12 7v5.500l3.500 2"/></g></svg>',
};

const KEY = 'gtb.settings';
export const DEFAULTS = { tier: pickTier(), volume: 0.8, sens: 1, invertY: false, hints: true, radio: true, speech: true };

export function loadSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEFAULTS }; }
}
export function saveSettings(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); localStorage.setItem('gtb.quality', s.tier); } catch { /* ignore */ } }


const GUIDE = `
<h3>On a phone or tablet</h3>
<p><b>In a vehicle:</b> ◀ ▶ bottom left steer (slide your thumb across without lifting it) · <b>GAS</b> and <b>BRAKE</b> pedals bottom right (BRAKE turns into <b>REV</b> when you stop) · Ⓟ handbrake for slides · 🔊 horn · 🚪 get out · radio and TAXI duty above. <b>On foot:</b> put your left thumb down anywhere in the lower left for the joystick (push it all the way to run) · 👊/💦 attack (drag it to aim while you spray) · 🛡️ block or 🎯 aim · kick or colour, weapon swap, crackers (⟳ changes the type) and insults around it. Yellow buttons pop up when there is something to do right here: get in or steal a vehicle, fill up, buy a snack, go through a door, a train ticket, skip an hour. Drag anywhere else on the screen to look around; tap the radar for the map. ⏸ pauses (skip an hour, tow truck), ⛶ full screen, 📱 phone. Hold the phone sideways for the most room.</p>
<h3>Driving the taxi</h3>
<p><b>W/S</b> accelerate and reverse · <b>A/D</b> steer · <b>Space</b> brake · <b>H</b> horn · mouse to look around (click the game to capture the mouse, Esc to free it).</p>
<h3>On foot</h3>
<p><b>F</b> get out or back in · <b>WASD</b> walk where the camera looks · <b>Shift</b> run · <b>left click</b> punch or spray · <b>right click</b> aim · <b>V</b> kick · <b>G</b> insult · <b>1</b> fists, <b>2</b> pichkari, hold <b>B</b> for the weapon wheel (fists, pichkari, crackers) · <b>C</b> colour · <b>[ ]</b> or wheel: pressure.</p>
<h3>Earning and spending</h3>
<p><b>J</b> or the Kidhar app: go on taxi duty. Pick up passengers, follow the purple GPS route and drive smoothly for tips. In the suburbs (north of Bandra and Sion) you can also take an <b>auto-rickshaw</b> and press <b>J</b> for auto fares — but autos are not allowed in town. <b>E</b> at a petrol pump to refuel and repair, or at a thela for vada pav and chai. <b>P</b> phone: food, groceries, shopping, payments. Rent for your Powai flat is ₹25,000.</p>
<h3>Police</h3>
<p>Red lights, wrong way on one-ways, driving on the footpath and street fights earn challan stars — but only if a constable or patrol car sees it. Stop by the constable to pay, or lose them by staying out of sight.</p>
<h3>Map</h3>
<p><b>Tab</b> (or tap the radar): the city map. Tap anywhere for a waypoint; the GPS shows the way. <b>T</b> skips an hour, <b>M</b> mutes, <b>R</b> twice calls a tow truck back to the Gateway (₹300 from far away), <b>Q</b> twice changes the graphics, <b>?</b> shows the key list.</p>
<h3>Vehicles and crackers</h3>
<p>On foot, <b>F</b> within a few metres of any vehicle steals it: you run to the driver's door (the right side — India drives on the left), the car stops and the driver is pulled out. Your own taxi too, of course. Drivers object, and so do the police if a constable sees it. Your taxi stays where you left it (it shows on the map); <b>R</b> twice tows you and the taxi back to the Gateway. <b>Space</b> while steering at speed is a handbrake turn.</p>
<p><b>X</b> lights a firecracker a step ahead, <b>Z</b> changes the type: anar, chakri, ladi, sutli bomb, sky shot. No crackers after 10 pm if a constable is watching.</p>
<h3>Local trains</h3>
<p>Suburban locals run on the Western, Central and Harbour lines, every minute or two at rush hour and not at all from 1:15 to 4:15 at night, and they do not stop for taxis on the track. On foot at a station (🚆 on the map), <b>E</b> opens the ticket window: pick a stop, pay ₹5 to ₹20 and step off there a few minutes later.</p>
<h3>Missions and things to find</h3>
<p><b>Yellow markers</b> are the story, <b>blue markers</b> are side missions (some only at certain hours); both are on the map. Drive or walk into one to start; if you fail, go back to it to try again.</p>
<p>Thirty-two <b>golden cutting-chai glasses</b> are hidden at famous places across the city, from Colaba to Powai — walk or drive through them. There are easter eggs too. Look closely at Powai Lake.</p>
<h3>Going indoors</h3>
<p>On foot, a softly glowing door can be entered with <b>E</b>: Chhatrapati Chai Terminus (platform ticket, chai and vada pav), the Royal Chaj Mahal Palace (high tea in the Sea Lounge), Khyaali &amp; Co. Irani café (bun maska and chai) and your flat in Powai (sleep till 7 am, wardrobe). All four are on the map. <b>E</b> at the door inside takes you back to the street.</p>
<h3>Developer cheats</h3>
<p>Press <b>\`</b> (backquote; on a phone double-tap the clock) and type a code: ${CHEATS.map((c) => `<b>${c.code}</b> ${c.what}`).join(' · ')}.</p>`;

const TIPS = [
  'Cutting chai at a thela (E) brings your energy back. Bad air (AQI) tires you faster.',
  'Smooth rides earn tips. Hard braking, potholes and horn spam do not.',
  'Constables only fine what they see. Patrol cars lose you if you stay out of sight.',
  'Main roads are smooth. Colony lanes are bumpy and full of potholes.',
  'Rush hour is 9 to 11 in the morning and 6 to 8 in the evening. 3 AM is empty.',
  'Holi pichkari: right click to aim, wheel for pressure, C for colour. Not everyone is in the mood.',
  'Order vada pav on Bhookh and a delivery rider brings it to your window.',
  'Glowing doors can be entered on foot (E): the terminus, the palace hotel, an Irani café, your flat in Powai.',
  'Stray dogs chase fast taxis. Cows do not move for anyone.',
  'Red lights have countdown timers. Some drivers jump them anyway.',
  'Bumped someone? Stay and pay, or drive off and risk a hit-and-run challan.',
];

function el(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; }

/** Title screen. Resolves with { action: 'continue' | 'new', settings }. */
export function titleScreen({ save }) {
  return new Promise((resolve) => {
    const s = loadSettings();
    const bokeh = Array.from({ length: 12 }, (_, i) => `<span style="--x:${(i * 37 + 11) % 100}%;--s:${30 + (i * 53) % 80}px;--d:${9 + (i * 7) % 11}s;--l:${-(i * 1.7)}s;--h:${[320, 28, 45, 290][i % 4]}"></span>`).join('');
    const now = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const root = el(`<div id="title-screen"><div class="stage"><div class="art">${SCENE_LIST.seaLink()}</div></div><div class="bokeh">${bokeh}</div><div class="shade"></div>
      ${LOGO}
      <div class="town"><i></i>Mumbai, India<u></u>${ICON.clock}<b>${now()}</b></div>
      <div class="menu">
        ${save ? `<button data-a="continue" class="main"><i>${ICON.play}</i><span>Continue<small>₹${save.money.toLocaleString('en-IN')} · day ${save.day} · ${save.rides} rides</small></span></button>` : ''}
        <button data-a="new" class="${save ? '' : 'main'}"><i>${save ? ICON.plus : ICON.play}</i><span>${save ? 'New game' : 'Play'}</span></button>
        <button data-a="settings"><i>${ICON.gear}</i><span>Settings</span></button>
        <button data-a="guide"><i>${ICON.book}</i><span>Guide</span></button>
        <button data-a="credits"><i>${ICON.people}</i><span>Credits</span></button>
      </div>
      <div class="tagline">Apna City…<br>Apna Bawaal…<em></em></div>
      <div class="panel" hidden></div>
      <div class="foot">Map data © OpenStreetMap contributors · a fan-made parody, not affiliated with any real brand</div></div>`);
    const tick = setInterval(() => { const b = root.querySelector('.town b'); if (b) b.textContent = now(); }, 20000);
    // Depth: the picture and the logo drift against each other with the pointer.
    root.addEventListener('pointermove', (e) => {
      root.style.setProperty('--mx', ((e.clientX / innerWidth) * 2 - 1).toFixed(3));
      root.style.setProperty('--my', ((e.clientY / innerHeight) * 2 - 1).toFixed(3));
    });
    document.body.appendChild(root);
    const panel = root.querySelector('.panel');
    const showPanel = (html) => { panel.innerHTML = `<button class="close" data-a="close">✕</button>${html}`; panel.hidden = false; };
    const settingsHtml = () => `<h2>Settings</h2>
      <label>Graphics <select data-s="tier"><option value="low">Low (fastest; phones, office laptops)</option><option value="medium">Medium (most computers)</option><option value="high">High (strong graphics card)</option></select></label>
      <label>Volume <input data-s="volume" type="range" min="0" max="1" step="0.05"></label>
      <label>Mouse sensitivity <input data-s="sens" type="range" min="0.3" max="2.5" step="0.1"></label>
      <label><input data-s="invertY" type="checkbox"> Invert mouse up/down</label>
      <label><input data-s="hints" type="checkbox"> Show control hints</label>
      <label><input data-s="speech" type="checkbox"> Spoken GPS directions</label>
      <label><input data-s="radio" type="checkbox"> Taxi radio</label>`;
    const bind = () => {
      for (const i of panel.querySelectorAll('[data-s]')) {
        const k = i.dataset.s;
        if (i.type === 'checkbox') i.checked = !!s[k]; else i.value = s[k];
        i.onchange = () => { s[k] = i.type === 'checkbox' ? i.checked : i.type === 'range' ? Number(i.value) : i.value; saveSettings(s); };
      }
    };
    root.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (!a) return;
      if (a === 'continue' || a === 'new') {
        if (a === 'new' && save && !confirm('Start a new game? Your money, purchases and ratings will be reset.')) return;
        saveSettings(s);
        clearInterval(tick);
        root.remove();
        resolve({ action: a, settings: s });
      }
      if (a === 'settings') { showPanel(settingsHtml()); bind(); }
      if (a === 'guide') showPanel(`<h2>Guide</h2>${GUIDE}`);
      if (a === 'credits') { panel.hidden = true; document.getElementById('credits-open')?.click(); }
      if (a === 'close') panel.hidden = true;
    });
  });
}

/** GTA-style loading screen: big illustrated scenes cross-fading, tips, a progress bar. */
export function loadingScreen() {
  const root = el(`<div id="load-screen">${LOADING_ORDER.map((k, i) => `<div class="art${i ? '' : ' on'}">${SCENE_LIST[k]()}</div>`).join('')}<div class="shade"></div>
    ${LOGO}
    <div class="bottom"><div class="tip"><i>i</i><div><b>Pro Tip</b><span class="tt"></span></div></div>
      <div class="status">Loading Bombay Bawaal…</div><div class="barrow"><div class="bar"><i></i></div><b class="pct">0%</b></div></div>
    <div class="tagline">Mumbai<br>Never Stops…<em></em></div></div>`);
  document.body.appendChild(root);
  const arts = root.querySelectorAll('.art');
  let k = 0, t = 0;
  const tip = root.querySelector('.tip .tt');
  const tips = [...TIPS].sort(() => Math.random() - 0.5);
  tip.textContent = tips[0];
  const timer = setInterval(() => {
    t++;
    if (t % 2 === 0) { arts[k].classList.remove('on'); k = (k + 1) % arts.length; arts[k].classList.add('on'); }
    const box = root.querySelector('.tip'); box.classList.remove('swap'); void box.offsetWidth; box.classList.add('swap');
    tip.textContent = tips[t % tips.length];
  }, 4000);
  return {
    progress(f, text) {
      const pct = Math.round(Math.max(0, Math.min(1, f)) * 100);
      root.querySelector('.bar i').style.width = `${pct}%`;
      root.querySelector('.pct').textContent = `${pct}%`;
      if (text) root.querySelector('.status').textContent = text;
    },
    done() { clearInterval(timer); root.classList.add('out'); setTimeout(() => root.remove(), 700); },
  };
}

/** The Guide as list + detail: sections come from the <h3> headings of GUIDE. */
const GUIDE_PAGES = (() => {
  const out = []; let cur = null;
  for (const part of GUIDE.split(/(?=<h3>)/)) {
    const m = part.match(/<h3>(.*?)<\/h3>([\s\S]*)/);
    if (m) { cur = { title: m[1], html: m[2] }; out.push(cur); }
  }
  return out;
})();

const SETTINGS_HTML = `<div class="set">
  <label>Graphics <select data-s="tier"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
  <p class="small">Changing graphics reloads the game; your position, time and money are kept.</p>
  <label>Volume <input data-s="volume" type="range" min="0" max="1" step="0.05"></label>
  <label>Mouse sensitivity <input data-s="sens" type="range" min="0.3" max="2.5" step="0.1"></label>
  <label><input data-s="invertY" type="checkbox"> Invert mouse up/down</label>
  <label><input data-s="hints" type="checkbox"> Show control hints</label>
  <label><input data-s="speech" type="checkbox"> Spoken GPS directions</label>
  <label><input data-s="radio" type="checkbox"> Taxi radio</label></div>`;

const bar = (label, v, max, text) => `<div class="prow"><span>${label}</span><i><u style="width:${Math.round(Math.min(1, v / Math.max(1, max)) * 100)}%"></u></i><b>${text ?? `${v}/${max}`}</b></div>`;

/** Home page: the player's profile, in the style of a game hub. */
function homeHtml(p) {
  if (!p) return '<p class="small">Nothing to show yet.</p>';
  const rupees = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
  return `<div class="profile">
    <div class="who"><div class="avatar">🚕</div><div><h2>${p.name}</h2><p>${p.title}</p></div></div>
    <div class="facts"><div><small>Day</small><b>${p.day}</b></div><div><small>Time</small><b>${p.clock}</b></div><div><small>Money</small><b>${rupees(p.money)}</b></div>
      <div><small>Rides</small><b>${p.rides}</b></div><div><small>Rating</small><b>${p.rating ? p.rating.toFixed(1) + '★' : '–'}</b></div><div><small>Earned</small><b>${rupees(p.earned)}</b></div></div>
    <div class="prows">${bar('Missions', p.missions, p.missionsTotal)}${bar('Chai glasses', p.chai, 32)}${bar('Food', Math.round(p.hunger * 100), 100, `${Math.round(p.hunger * 100)}%`)}${bar('Energy', Math.round(p.energy * 100), 100, `${Math.round(p.energy * 100)}%`)}${bar('Unpaid challans', Math.min(5000, p.fines), 5000, rupees(p.fines))}</div>
  </div>
  <div class="cards3">
    <div class="tile"><small>Your ride</small><h4>${p.vehicle}</h4><div class="art">🚕</div><div class="spec"><span>Engine<b>${Math.round(p.condition * 100)}%</b></span><span>Fuel<b>${Math.round(p.fuel * 100)}%</b></span><span>Plate<b>MH 01 T</b></span></div></div>
    <div class="tile"><small>Today</small><h4>${p.clock}</h4><div class="art">🌤️</div><div class="spec"><span>Air quality<b>${p.aqi}</b></span><span>Stars<b>${'★'.repeat(p.stars) || '–'}</b></span></div></div>
  </div>`;
}

/** In-game hub (Esc, or ⏸ on touch screens): Home (profile), Map, Guide, Settings. handlers: resume, quality(tier),
 *  settings(s), quit, abandon, skipHour, tow, map, profile. */
export function pauseMenu(handlers) {
  const root = el(`<div id="pause-screen" hidden>
    <div class="topbar"><nav><button data-tab="home" class="on">Home</button><button data-tab="map">Map</button><button data-tab="guide">Guide</button><button data-tab="settings">Settings</button></nav>
      ${LOGO}</div>
    <div class="rail"><button data-a="resume" title="Resume (Esc)">▶</button><button data-a="hour" title="Skip an hour (T)">⏩</button><button data-a="tow" title="Call a tow truck (R R)">🛻</button><button data-a="abandon" title="Abandon mission" hidden>✕</button><span></span><button data-a="quit" title="Save &amp; quit to title">⏻</button></div>
    <div class="page"></div></div>`);
  document.body.appendChild(root);
  const page = root.querySelector('.page');
  const s = loadSettings();
  let tab = 'home', guideIx = 0;
  const bindSettings = () => {
    for (const i of page.querySelectorAll('[data-s]')) {
      const k = i.dataset.s;
      if (i.type === 'checkbox') i.checked = !!s[k]; else i.value = s[k];
      i.onchange = () => {
        const old = s.tier;
        s[k] = i.type === 'checkbox' ? i.checked : i.type === 'range' ? Number(i.value) : i.value;
        saveSettings(s);
        if (k === 'tier' && s.tier !== old) handlers.quality(s.tier);
        else handlers.settings(s);
      };
    }
  };
  const render = () => {
    for (const b of root.querySelectorAll('[data-tab]')) b.classList.toggle('on', b.dataset.tab === tab);
    page.className = `page ${tab}`;
    if (tab === 'home') page.innerHTML = homeHtml(handlers.profile?.());
    if (tab === 'guide') {
      page.innerHTML = `<div class="glist">${GUIDE_PAGES.map((g, i) => `<button data-g="${i}" class="${i === guideIx ? 'on' : ''}">${g.title}</button>`).join('')}</div>
        <div class="gbody"><h2>${GUIDE_PAGES[guideIx].title}</h2>${GUIDE_PAGES[guideIx].html}</div>`;
    }
    if (tab === 'settings') { page.innerHTML = `<h2>Settings</h2>${SETTINGS_HTML}`; bindSettings(); }
  };
  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]')?.dataset.tab;
    if (t === 'map') { api.toggle(false); handlers.map?.(); return; }
    if (t) { tab = t; render(); return; }
    const g = e.target.closest('[data-g]')?.dataset.g;
    if (g !== undefined) { guideIx = Number(g); render(); return; }
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'resume') api.toggle(false);
    if (a === 'quit') handlers.quit();
    if (a === 'abandon') { handlers.abandon?.(); api.toggle(false); }
    if (a === 'hour') { handlers.skipHour?.(); api.toggle(false); }
    if (a === 'tow') { api.toggle(false); handlers.tow?.(); }
  });
  const api = {
    open: false,
    toggle(on = !api.open) {
      api.open = on; root.hidden = !on;
      if (on) { tab = 'home'; render(); }
      root.querySelector('[data-a="abandon"]').hidden = !handlers.canAbandon?.();
      handlers.paused?.(on);
    },
  };
  return api;
}
