// Player life outside the taxi: wallet, hunger and energy, things bought, messages and
// the taxi-driver record. Saved in this browser (localStorage) every few seconds.

const KEY = 'gtb.save.v1';

export const HOME = {
  name: 'Home',
  line1: 'Flat 1204, Lake Breeze Tower B',
  line2: 'Lakeside Road, near Powai Lake',
  city: 'Powai, Mumbai 400076',
  note: 'Powai is north of the current map; it joins when the city grows. Parcels from Dukaan are delivered there.',
};

const fresh = () => ({
  money: 2000, hunger: 0.8, energy: 0.9,
  owned: [],          // item ids bought (car extras, clothes)
  pending: [],        // parcels on the way: { id, name, dueHour, dueDay }
  messages: [
    { from: 'Aai', text: 'Beta, khana time pe kha lena. Aur taxi dhyan se chalana!', t: 0 },
    { from: 'Landlord (Powai)', text: 'Namaste. Rent ₹25,000 due on the 5th. Please transfer by UPI.', t: 0 },
    { from: 'Kidhar Partner', text: 'Welcome, driver! Go on duty in the Kidhar app (or press J) to get fares.', t: 0 },
  ],
  txns: [],           // { what, amount, t }
  rides: 0, ratingSum: 0, earned: 0, day: 1,
});

export class GameState {
  constructor() {
    this.s = fresh();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) Object.assign(this.s, JSON.parse(raw));
    } catch { /* private mode or blocked storage: play without saving */ }
    this.saveT = 5;
    this.listeners = new Set();
    addEventListener('pagehide', () => this.save());
  }

  get money() { return this.s.money; }
  set money(v) { this.s.money = Math.round(v); }
  get rating() { return this.s.rides ? this.s.ratingSum / this.s.rides : 0; }

  /** Purchases need the money; fines and bills can still push you into debt. */
  canAfford(amount) { return this.s.money >= amount; }

  pay(amount, what) {
    this.s.money -= Math.round(amount);
    this.s.txns.unshift({ what, amount: -Math.round(amount), t: Date.now() });
    this.s.txns.length = Math.min(this.s.txns.length, 40);
    this.changed();
  }

  earn(amount, what) {
    this.s.money += Math.round(amount);
    this.s.txns.unshift({ what, amount: Math.round(amount), t: Date.now() });
    this.s.txns.length = Math.min(this.s.txns.length, 40);
    this.changed();
  }

  message(from, text) {
    this.s.messages.unshift({ from, text, t: Date.now() });
    this.s.messages.length = Math.min(this.s.messages.length, 30);
    this.unread = (this.unread || 0) + 1;
    this.changed();
  }

  owns(id) { return this.s.owned.includes(id); }

  changed() { for (const f of this.listeners) f(); }

  update(dt, clock) {
    // In debt: a reminder now and then (purchases are blocked until you earn it back).
    if (this.s.money < 0) {
      this.debtT = (this.debtT ?? 0) - dt;
      if (this.debtT <= 0) { this.debtT = 300; this.message('Udhaar Recovery', `You owe ₹${Math.abs(this.s.money).toLocaleString('en-IN')}. Drive fares (J) and pay it back soon, bhai.`); }
    }
    // Hunger and energy drain with game time (1 real second = 1 game minute);
    // bad air tires you faster, chai and food bring you back.
    const gameHours = dt / 60 * (clock.speed / 60);
    this.s.hunger = Math.max(0, this.s.hunger - gameHours / 9);
    this.s.energy = Math.max(0, this.s.energy - gameHours / 16 * (1 + clock.aqi / 300) * (this.s.hunger < 0.15 ? 1.6 : 1));
    if (clock.hour < this.lastHour) this.s.day++;
    this.lastHour = clock.hour;
    this.saveT -= dt;
    if (this.saveT <= 0) { this.saveT = 10; this.save(); }
  }

  eat(amount) { this.s.hunger = Math.min(1, this.s.hunger + amount); this.changed(); }
  rest(amount) { this.s.energy = Math.min(1, this.s.energy + amount); this.changed(); }

  save() { try { localStorage.setItem(KEY, JSON.stringify(this.s)); } catch { /* ignore */ } }
  reset() { this.s = fresh(); this.save(); this.changed(); }
}
