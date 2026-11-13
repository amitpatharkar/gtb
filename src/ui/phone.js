import { HOME } from '../game/state.js';

// The player's phone (P, or the phone button): parody apps for maps, taxi duty, food
// delivery, 10-minute groceries, online shopping, UPI payments, messages, a camera
// (photo mode), home address and settings. The game keeps running while it is open.

const rupees = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;

const FOOD = [
  { id: 'vadapav', name: 'Vada pav (2)', price: 45, hunger: 0.35 },
  { id: 'misal', name: 'Misal pav', price: 90, hunger: 0.45 },
  { id: 'pavbhaji', name: 'Pav bhaji', price: 140, hunger: 0.55 },
  { id: 'biryani', name: 'Chicken biryani', price: 260, hunger: 0.8 },
  { id: 'thali', name: 'Veg thali', price: 220, hunger: 0.75 },
  { id: 'frankie', name: 'Paneer frankie', price: 110, hunger: 0.4 },
  { id: 'chai', name: 'Cutting chai + bun maska', price: 60, hunger: 0.15, energy: 0.3 },
];
const QUICK = [
  { id: 'water', name: 'Mineral water 1 L', price: 20, energy: 0.1 },
  { id: 'energy', name: 'Energy drink', price: 110, energy: 0.45 },
  { id: 'chips', name: 'Masala chips', price: 20, hunger: 0.1 },
  { id: 'fuelcan', name: 'Petrol can 5 L', price: 560, fuel: 0.15 },
  { id: 'tyrekit', name: 'Puncture kit + coolant', price: 450, repair: 0.25 },
  { id: 'icecream', name: 'Kulfi', price: 50, hunger: 0.1, energy: 0.1 },
  { id: 'charger', name: 'Car phone charger', price: 299 },
];
const SHOP = [
  { id: 'perfume', name: 'Car perfume (sandalwood)', price: 399, desc: 'Passengers are a bit more forgiving.' },
  { id: 'seatcovers', name: 'Velvet seat covers', price: 1499, desc: 'Comfier rides, better tips.' },
  { id: 'horn', name: 'Musical horn', price: 899, desc: 'Ta-ra-ra-ra! Pedestrians are not impressed.' },
  { id: 'dashcam', name: 'Dashcam', price: 2499, desc: 'Proof for every argument.' },
  { id: 'shades', name: 'Aviator sunglasses', price: 699, desc: 'For walking around (coming soon).' },
  { id: 'jersey', name: 'Mumbai Tigers cricket jersey', price: 999, desc: 'Clothes for on foot (coming soon).' },
  { id: 'kurta', name: 'Festive kurta', price: 1299, desc: 'Clothes for on foot (coming soon).' },
];

const APPS = [
  ['maps', 'Maps', '🗺️', '#3b8ad9'], ['chalo', 'Chalo Driver', '🚕', '#f7c600'], ['bhookh', 'Bhookh', '🍛', '#f26722'],
  ['jhatpat', 'JhatPat', '⚡', '#2e9e44'], ['dukaan', 'Dukaan', '📦', '#1b4f8a'], ['paykaro', 'PayKaro', '💸', '#5f259f'],
  ['messages', 'Messages', '💬', '#27ae60'], ['camera', 'Camera', '📷', '#444'], ['home', 'Ghar', '🏠', '#b5651d'], ['settings', 'Settings', '⚙️', '#777'],
];

export class Phone {
  constructor({ state, jobs, cityMap, clock, audio, player, onTier, onPhoto }) {
    Object.assign(this, { state, jobs, cityMap, clock, audio, player, onTier, onPhoto });
    this.open = false;
    this.app = null;
    this.cart = [];
    this.el = document.createElement('div');
    this.el.id = 'phone';
    this.el.hidden = true;
    this.el.innerHTML = '<div class="bar"></div><div class="screen"></div><button class="homebtn" aria-label="Home"></button>';
    document.body.appendChild(this.el);
    this.bar = this.el.querySelector('.bar');
    this.screen = this.el.querySelector('.screen');
    this.el.querySelector('.homebtn').onclick = () => (this.app ? this.go(null) : this.toggle(false));
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.screen.addEventListener('click', (e) => this.click(e));
    state.listeners.add(() => this.open && this.render());
    this.barT = 0;
  }

  toggle(on = !this.open) {
    this.open = on;
    this.el.hidden = !on;
    if (on) { this.app = null; this.render(); }
  }

  go(app) {
    this.app = app;
    if (app === 'messages') this.state.unread = 0;
    if (app === 'maps') { this.toggle(false); this.cityMap.toggle(true, this.player); return; }
    if (app === 'camera') { this.toggle(false); this.onPhoto(); return; }
    this.render();
  }

  click(e) {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const [act, arg] = t.dataset.act.split(':');
    const s = this.state;
    if (act === 'app') this.go(arg);
    if (act === 'back') this.go(null);
    if (act === 'duty') { this.jobs.toggleDuty(this.player); this.render(); }
    if (act === 'add') { const list = this.app === 'bhookh' ? FOOD : QUICK; this.cart.push(list.find((i) => i.id === arg)); this.render(); }
    if (act === 'clear') { this.cart = []; this.render(); }
    if (act === 'order') {
      if (!this.cart.length) return;
      const total = this.cart.reduce((a, i) => a + i.price, 0) + (this.app === 'bhookh' ? 35 : 15);
      if (!s.canAfford(total)) { this.toast(`Payment declined: you have ₹${Math.max(0, s.money)}. Earn with taxi fares (J).`); return; }
      s.pay(total, this.app === 'bhookh' ? 'Bhookh food order' : 'JhatPat order');
      this.jobs.order(this.app, this.cart, this.player);
      this.cart = [];
      this.toast(this.app === 'bhookh' ? 'Order placed! The rider will find you.' : 'Order placed! Arriving in minutes.');
    }
    if (act === 'buy') {
      const item = SHOP.find((i) => i.id === arg);
      if (s.owns(item.id) || s.s.pending.some((p) => p.id === item.id)) return;
      if (!s.canAfford(item.price)) { this.toast('Payment declined — not enough money.'); return; }
      s.pay(item.price, `Dukaan: ${item.name}`);
      s.s.pending.push({ id: item.id, name: item.name, due: this.now() + 120 });
      s.message('Dukaan', `Ordered ${item.name}. Delivery to ${HOME.line1}, ${HOME.city} in about 2 hours.`);
      this.toast('Ordered! Delivered to your home in Powai.');
    }
    if (act === 'rent') {
      if (!s.canAfford(25000)) { this.toast('Not enough money for rent yet.'); return; }
      s.pay(25000, 'Rent, Flat 1204 Powai');
      s.message('Landlord (Powai)', 'Rent received. Thank you! 🙏');
      this.toast('Rent paid.');
    }
    if (act === 'tier') this.onTier();
    if (act === 'mute') { this.audio.toggleMute(); this.render(); }
    if (act === 'reset' && confirm('Start over? Money, purchases and ratings will be reset.')) { s.reset(); this.render(); }
  }

  toast(text) {
    const d = document.createElement('div');
    d.className = 'toast';
    d.textContent = text;
    this.screen.appendChild(d);
    setTimeout(() => d.remove(), 2200);
    this.render();
  }

  /** Game time in minutes since day 1 (saved with the game, so parcels survive reloads). */
  now() { return (this.state.s.day * 24 + this.clock.hour) * 60; }

  /** Parcels arrive at home; status bar clock. */
  update(dt) {
    const s = this.state.s, now = this.now();
    for (const p of [...s.pending]) {
      if (now < p.due) continue;
      s.pending.splice(s.pending.indexOf(p), 1);
      s.owned.push(p.id);
      this.state.message('Dukaan', `Delivered: ${p.name} at ${HOME.line1}, Powai. Left with the watchman.`);
    }
    this.barT -= dt;
    if (this.open && this.barT <= 0) { this.barT = 1; this.renderBar(); }
  }

  renderBar() {
    const s = this.state;
    this.bar.innerHTML = `<span>${this.clock.label}</span><span>Jiyo 5G ▂▄▆ · ${Math.max(5, 100 - Math.floor(this.clock.hour * 3))}%</span>`;
    void s;
  }

  render() {
    this.renderBar();
    const s = this.state, d = s.s;
    const head = (title, colour) => `<div class="apphead" style="background:${colour}"><button data-act="back">‹</button>${title}</div>`;
    let html = '';
    switch (this.app) {
      case null: {
        html = `<div class="widget"><div class="w-time">${this.clock.label}</div><div>AQI ${this.clock.aqi} · ${rupees(d.money)}</div>
          <div class="meters"><span>🍽️ ${Math.round(d.hunger * 100)}%</span><span>⚡ ${Math.round(d.energy * 100)}%</span><span>⭐ ${s.rating ? s.rating.toFixed(1) : '–'}</span></div></div>
          <div class="grid">${APPS.map(([id, name, icon, col]) => `<button data-act="app:${id}"><i style="background:${col}">${icon}</i><span>${name}${id === 'messages' && s.unread ? ` (${s.unread})` : ''}</span></button>`).join('')}</div>`;
        break;
      }
      case 'chalo': {
        const j = this.jobs;
        html = `${head('Chalo Driver', '#d4a900')}<div class="pad">
          <div class="big">${j.onDuty ? '🟢 On duty' : '⚪ Off duty'}</div>
          <button class="primary" data-act="duty">${j.onDuty ? 'Go off duty' : 'Go on duty (J)'}</button>
          <p>Rides: <b>${d.rides}</b> · Rating: <b>${s.rating ? s.rating.toFixed(2) : '–'}★</b> · Earned: <b>${rupees(d.earned)}</b></p>
          <p class="small">Meter: ₹28 for the first 1.5 km, then ₹18.7 per km. Smooth, quick rides earn tips; hard braking, crashes, potholes, horn spam, red lights and police chases cost you.</p></div>`;
        break;
      }
      case 'bhookh': case 'jhatpat': {
        const list = this.app === 'bhookh' ? FOOD : QUICK;
        const total = this.cart.reduce((a, i) => a + i.price, 0);
        html = `${head(this.app === 'bhookh' ? 'Bhookh · food delivery' : 'JhatPat · 10-minute delivery', this.app === 'bhookh' ? '#f26722' : '#2e9e44')}
          <div class="pad"><p class="small">Delivering to: your current location (taxi)</p>
          ${list.map((i) => `<div class="row"><span>${i.name}</span><b>${rupees(i.price)}</b><button data-act="add:${i.id}">Add</button></div>`).join('')}
          <div class="cart">Cart: ${this.cart.length ? this.cart.map((i) => i.name).join(', ') : 'empty'}<br>Total ${rupees(total)} + ${this.app === 'bhookh' ? '₹35 delivery' : '₹15 handling'}</div>
          <button class="primary" data-act="order">Place order</button> <button data-act="clear">Clear</button></div>`;
        break;
      }
      case 'dukaan':
        html = `${head('Dukaan · shopping', '#1b4f8a')}<div class="pad"><p class="small">Ships to: ${HOME.line1}, ${HOME.city}</p>
          ${SHOP.map((i) => { const own = s.owns(i.id), pend = d.pending.some((p) => p.id === i.id); return `<div class="row"><span>${i.name}<br><small>${i.desc}</small></span><b>${rupees(i.price)}</b><button data-act="buy:${i.id}" ${own || pend ? 'disabled' : ''}>${own ? 'Owned' : pend ? 'Shipping' : 'Buy'}</button></div>`; }).join('')}</div>`;
        break;
      case 'paykaro':
        html = `${head('PayKaro · UPI', '#5f259f')}<div class="pad"><div class="big">${rupees(d.money)}</div><p class="small">UPI ID: driver1204@paykaro</p>
          <button data-act="rent">Pay rent ₹25,000 (Powai flat)</button>
          <h4>Recent</h4>${d.txns.slice(0, 14).map((t) => `<div class="row"><span>${t.what}</span><b class="${t.amount < 0 ? 'bad' : 'good'}">${t.amount < 0 ? '−' : '+'}${rupees(Math.abs(t.amount))}</b></div>`).join('') || '<p class="small">No payments yet.</p>'}</div>`;
        break;
      case 'messages':
        html = `${head('Messages', '#27ae60')}<div class="pad">${d.messages.map((m) => `<div class="msg"><b>${m.from}</b><br>${m.text}</div>`).join('')}</div>`;
        break;
      case 'home':
        html = `${head('Ghar · home', '#b5651d')}<div class="pad"><div class="big">🏠 ${HOME.line1}</div><p>${HOME.line2}<br>${HOME.city}</p><p class="small">${HOME.note}</p>
          <h4>At home</h4><p>${d.owned.length ? d.owned.map((id) => SHOP.find((i) => i.id === id)?.name || id).join(', ') : 'Nothing yet — shop on Dukaan.'}</p>
          ${d.pending.length ? `<h4>On the way</h4><p>${d.pending.map((p) => p.name).join(', ')}</p>` : ''}</div>`;
        break;
      case 'settings':
        html = `${head('Settings', '#666')}<div class="pad"><button data-act="tier">Graphics quality (reloads)</button><br><br>
          <button data-act="mute">Sound on/off</button><br><br><button data-act="reset">Reset saved game</button>
          <p class="small">Keys: P phone · Tab map · J taxi duty · E buy snack at a thela · H horn</p></div>`;
        break;
    }
    this.screen.innerHTML = html;
  }
}
