// Title screen (Continue / New game / Settings / Guide / Credits), GTA-style illustrated
// loading screens with tips, and the in-game pause menu. Settings are saved in this browser.

const KEY = 'gtb.settings';
export const DEFAULTS = { tier: 'low', volume: 0.8, sens: 1, invertY: false, hints: true, radio: true, speech: true };

export function loadSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEFAULTS }; }
}
export function saveSettings(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); localStorage.setItem('gtb.quality', s.tier); } catch { /* ignore */ } }

const GUIDE = `
<h3>Driving the taxi</h3>
<p><b>W/S</b> accelerate and reverse · <b>A/D</b> steer · <b>Space</b> brake · <b>H</b> horn · mouse to look around (click the game to capture the mouse, Esc to free it).</p>
<h3>On foot</h3>
<p><b>F</b> get out or back in · <b>WASD</b> walk where the camera looks · <b>Shift</b> run · <b>left click</b> punch or spray · <b>right click</b> aim · <b>V</b> kick · <b>G</b> insult · <b>1</b> fists, <b>2</b> pichkari · <b>C</b> colour · <b>[ ]</b> or wheel: pressure.</p>
<h3>Earning and spending</h3>
<p><b>J</b> or the Chalo app: go on taxi duty. Pick up passengers, follow the purple GPS route and drive smoothly for tips. <b>E</b> at a petrol pump to refuel and repair, or at a thela for vada pav and chai. <b>P</b> phone: food, groceries, shopping, payments. Rent for your Powai flat is ₹25,000.</p>
<h3>Police</h3>
<p>Red lights, wrong way on one-ways, driving on the footpath and street fights earn challan stars — but only if a constable or patrol car sees it. Stop by the constable to pay, or lose them by staying out of sight.</p>
<h3>Map</h3>
<p><b>Tab</b> (or tap the radar): the city map. Tap anywhere for a waypoint; the GPS shows the way. <b>T</b> skips an hour, <b>M</b> mutes, <b>R</b> resets to the start, <b>?</b> shows the key list.</p>`;

const TIPS = [
  'Cutting chai at a thela (E) brings your energy back. Bad air (AQI) tires you faster.',
  'Smooth rides earn tips. Hard braking, potholes and horn spam do not.',
  'Constables only fine what they see. Patrol cars lose you if you stay out of sight.',
  'Main roads are smooth. Colony lanes are bumpy and full of potholes.',
  'Rush hour is 9 to 11 in the morning and 6 to 8 in the evening. 3 AM is empty.',
  'Holi pichkari: right click to aim, wheel for pressure, C for colour. Not everyone is in the mood.',
  'Order vada pav on Bhookh and a delivery rider brings it to your window.',
  'Stray dogs chase fast taxis. Cows do not move for anyone.',
  'Red lights have countdown timers. Some drivers jump them anyway.',
  'Bumped someone? Stay and pay, or drive off and risk a hit-and-run challan.',
];

/** Illustrated scenes (inline SVG, original art) for the title and loading screens. */
const SCENES = [
  // Marine Drive at dusk: the Queen's Necklace.
  `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="s1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b1b4a"/><stop offset=".45" stop-color="#c2477a"/><stop offset=".75" stop-color="#ff9a3c"/></linearGradient><linearGradient id="w1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b2a5e"/><stop offset="1" stop-color="#0d0f24"/></linearGradient></defs>
  <rect width="1600" height="900" fill="url(#s1)"/><circle cx="1180" cy="520" r="70" fill="#ffd27a" opacity=".9"/>
  <path d="M0 470 L60 470 L60 380 L120 380 L120 430 L170 430 L170 330 L230 330 L230 420 L300 420 L300 300 L350 300 L350 410 L420 410 L420 360 L480 360 L480 440 L560 440 L560 390 L640 390 L640 450 L1600 520 L1600 900 L0 900 Z" fill="#1d1430"/>
  <path d="M0 560 Q 700 470 1600 640 L1600 900 L0 900 Z" fill="url(#w1)"/>
  <path d="M-20 600 Q 700 500 1620 690" stroke="#ffcf6b" stroke-width="5" fill="none" stroke-dasharray="2 26" stroke-linecap="round"/>
  <path d="M-20 600 Q 700 500 1620 690" stroke="#ffcf6b" stroke-width="22" fill="none" stroke-dasharray="2 26" stroke-linecap="round" opacity=".18"/></svg>`,
  // Kaali-peeli taxi.
  `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice"><rect width="1600" height="900" fill="#f7c600"/>
  <g fill="#111"><rect x="0" y="640" width="1600" height="260"/><path d="M0 640 L200 640 L200 420 L260 420 L260 640 L420 640 L420 300 L520 300 L520 640 L700 640 L700 460 L760 460 L760 640 L1600 640" opacity=".18"/></g>
  <g transform="translate(330 380) skewX(-8)"><rect x="0" y="160" width="900" height="170" rx="40" fill="#0b0b0b"/><path d="M200 165 L300 40 L640 40 L740 165 Z" fill="#f7c600" stroke="#0b0b0b" stroke-width="18"/><path d="M250 160 L325 70 L460 70 L460 160 Z M490 160 L490 70 L620 70 L690 160 Z" fill="#26313a"/><circle cx="210" cy="330" r="72" fill="#222" stroke="#bbb" stroke-width="16"/><circle cx="700" cy="330" r="72" fill="#222" stroke="#bbb" stroke-width="16"/><rect x="860" y="215" width="40" height="40" rx="20" fill="#fff6d5"/><rect x="370" y="250" width="160" height="40" fill="#f7c600"/><text x="450" y="280" font-family="Arial Black,Arial" font-size="28" text-anchor="middle">MH 01 T</text></g>
  <g stroke="#111" stroke-width="10" stroke-linecap="round" opacity=".5"><line x1="60" y1="520" x2="260" y2="520"/><line x1="20" y1="580" x2="240" y2="580"/><line x1="100" y1="460" x2="250" y2="460"/></g></svg>`,
  // Holi.
  `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice"><rect width="1600" height="900" fill="#fff4e0"/>
  <g opacity=".9"><circle cx="300" cy="250" r="230" fill="#ff2e88"/><circle cx="1250" cy="200" r="260" fill="#ffd400"/><circle cx="900" cy="700" r="300" fill="#1fbf4f"/><circle cx="200" cy="760" r="200" fill="#1e7bff"/><circle cx="1450" cy="720" r="190" fill="#9b30ff"/><circle cx="760" cy="260" r="150" fill="#ff7a00"/></g>
  <g fill="#1a1a1a"><circle cx="820" cy="300" r="70"/><path d="M740 380 Q820 360 900 380 L930 640 L710 640 Z"/><path d="M890 420 L1180 360 L1190 390 L905 470 Z"/><rect x="1150" y="340" width="120" height="44" rx="10"/><rect x="740" y="640" width="60" height="230"/><rect x="840" y="640" width="60" height="230"/></g>
  <g fill="#ff2e88"><circle cx="1330" cy="350" r="16"/><circle cx="1380" cy="330" r="12"/><circle cx="1430" cy="355" r="18"/><circle cx="1480" cy="320" r="10"/></g></svg>`,
  // Challan: the constable and the signal.
  `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="s4" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1a3a"/><stop offset="1" stop-color="#1d3f8f"/></linearGradient></defs><rect width="1600" height="900" fill="url(#s4)"/>
  <rect x="1180" y="120" width="70" height="780" fill="#222"/><rect x="1130" y="120" width="170" height="380" rx="20" fill="#111"/><circle cx="1215" cy="200" r="48" fill="#ff2a1a"/><circle cx="1215" cy="310" r="48" fill="#3a2a00"/><circle cx="1215" cy="420" r="48" fill="#002a10"/><text x="1215" y="590" font-family="monospace" font-size="80" fill="#ff2a1a" text-anchor="middle">27</text>
  <g fill="#f4f4f0"><circle cx="520" cy="300" r="75"/><path d="M420 390 Q520 360 620 390 L660 680 L380 680 Z"/></g><rect x="440" y="215" width="160" height="40" rx="14" fill="#f4f4f0"/><rect x="430" y="245" width="180" height="16" fill="#1d3f8f"/>
  <g fill="#1f2a44"><rect x="400" y="680" width="100" height="220"/><rect x="540" y="680" width="100" height="220"/></g><path d="M615 420 L860 300 L880 330 L640 470 Z" fill="#f4f4f0"/><circle cx="880" cy="305" r="22" fill="#8d5a3b"/></svg>`,
];

function el(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; }

/** Title screen. Resolves with { action: 'continue' | 'new', settings }. */
export function titleScreen({ save }) {
  return new Promise((resolve) => {
    const s = loadSettings();
    const scene = SCENES[Math.floor(Math.random() * SCENES.length)];
    const root = el(`<div id="title-screen"><div class="art">${scene}</div><div class="halftone"></div>
      <div class="logo"><b>GTB</b><span>MUMBAI</span><small>Bombay Bawaal</small></div>
      <div class="menu">
        ${save ? `<button data-a="continue" class="main">Continue<small>₹${save.money.toLocaleString('en-IN')} · day ${save.day} · ${save.rides} rides</small></button>` : ''}
        <button data-a="new" class="${save ? '' : 'main'}">${save ? 'New game' : 'Start'}</button>
        <button data-a="settings">Settings</button>
        <button data-a="guide">Guide</button>
        <button data-a="credits">Credits</button>
      </div>
      <div class="panel" hidden></div>
      <div class="foot">Map data © OpenStreetMap contributors · a fan-made parody, not affiliated with any real brand</div></div>`);
    document.body.appendChild(root);
    const panel = root.querySelector('.panel');
    const showPanel = (html) => { panel.innerHTML = `<button class="close" data-a="close">✕</button>${html}`; panel.hidden = false; };
    const settingsHtml = () => `<h2>Settings</h2>
      <label>Graphics <select data-s="tier"><option value="low">Low (fastest, recommended)</option><option value="medium">Medium</option><option value="high">High (strong GPU)</option></select></label>
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
  const order = [...SCENES.keys()].sort(() => Math.random() - 0.5);
  const root = el(`<div id="load-screen">${order.map((k, i) => `<div class="art${i ? '' : ' on'}">${SCENES[k]}</div>`).join('')}<div class="halftone"></div>
    <div class="logo small"><b>GTB</b><span>MUMBAI</span></div>
    <div class="bottom"><div class="tip"></div><div class="bar"><i></i></div><div class="status">Loading Mumbai…</div></div></div>`);
  document.body.appendChild(root);
  const arts = root.querySelectorAll('.art');
  let k = 0, t = 0;
  const tip = root.querySelector('.tip');
  const tips = [...TIPS].sort(() => Math.random() - 0.5);
  tip.textContent = tips[0];
  const timer = setInterval(() => {
    t++;
    if (t % 2 === 0) { arts[k].classList.remove('on'); k = (k + 1) % arts.length; arts[k].classList.add('on'); }
    tip.textContent = tips[t % tips.length];
  }, 3500);
  return {
    progress(f, text) { root.querySelector('.bar i').style.width = `${Math.round(Math.max(0, Math.min(1, f)) * 100)}%`; if (text) root.querySelector('.status').textContent = text; },
    done() { clearInterval(timer); root.classList.add('out'); setTimeout(() => root.remove(), 700); },
  };
}

/** In-game pause menu (Esc). handlers: resume, quality(tier), settings(s), quit. */
export function pauseMenu(handlers) {
  const root = el(`<div id="pause-screen" hidden><div class="halftone"></div><div class="logo small"><b>GTB</b><span>PAUSED</span></div>
    <div class="menu"><button data-a="resume" class="main">Resume</button><button data-a="settings">Settings</button><button data-a="guide">Guide</button><button data-a="quit">Save &amp; quit to title</button></div>
    <div class="panel" hidden></div></div>`);
  document.body.appendChild(root);
  const panel = root.querySelector('.panel');
  const s = loadSettings();
  root.addEventListener('click', (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'resume') api.toggle(false);
    if (a === 'guide') { panel.innerHTML = `<button class="close" data-a="close">✕</button><h2>Guide</h2>${GUIDE}`; panel.hidden = false; }
    if (a === 'close') panel.hidden = true;
    if (a === 'quit') handlers.quit();
    if (a === 'settings') {
      panel.innerHTML = `<button class="close" data-a="close">✕</button><h2>Settings</h2>
        <label>Graphics <select data-s="tier"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
        <p class="small">Changing graphics reloads the game; your position, time and money are kept.</p>
        <label>Volume <input data-s="volume" type="range" min="0" max="1" step="0.05"></label>
        <label>Mouse sensitivity <input data-s="sens" type="range" min="0.3" max="2.5" step="0.1"></label>
        <label><input data-s="invertY" type="checkbox"> Invert mouse up/down</label>
        <label><input data-s="hints" type="checkbox"> Show control hints</label>
        <label><input data-s="speech" type="checkbox"> Spoken GPS directions</label>
        <label><input data-s="radio" type="checkbox"> Taxi radio</label>`;
      panel.hidden = false;
      for (const i of panel.querySelectorAll('[data-s]')) {
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
    }
  });
  const api = {
    open: false,
    toggle(on = !api.open) { api.open = on; root.hidden = !on; panel.hidden = true; handlers.paused?.(on); },
  };
  return api;
}
