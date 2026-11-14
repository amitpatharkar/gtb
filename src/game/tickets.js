// Tickets for the local trains and the metro, as Mumbai sells and checks them (research notes:
// docs/research/metro/research_notes/Mumbai local trains and stations/ticketing.md).
//
// Locals: single, return (valid to midnight of the next day) and monthly season tickets in
// second class, first class or AC; bought at the booking window, the ticket vending machine or
// the phone app (not within about 30 m of the tracks — the real app's rule). A ticket from A to B
// covers any trip between stations on the way from A to B (a return either way). No gates: ticket
// checkers at exits and in trains fine a traveller without a valid ticket ₹500 plus the fare
// (Jan Vishwas Act, 2026); a man in a ladies' coach pays ₹2,500.
// Metro: QR tickets for one trip on one line, priced by distance slabs, checked at the fare gates
// on the way in and out (Line 1, Line 3; the metro module does the gates).
// Fares (no change since May 2022): second class ₹5 up to 10 km and ₹5 more per slab; first class
// about 10× (₹25 minimum, Churchgate–Virar ₹100); AC ₹35 minimum (Churchgate–Virar ₹115). The exact
// kilometre slabs were not found; these follow the reported end points. Season tickets: monthly;
// quarterly is 2.7×.

const rupees = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
export const CLASSES = { II: 'Second class', I: 'First class', AC: 'AC local' };
const RANK = { II: 0, I: 1, AC: 2 };

/** Single-journey fare of a local trip of m metres. */
export function localFare(m, cls = 'II') {
  const km = m / 1000;
  if (cls === 'II') return km <= 10 ? 5 : km <= 20 ? 10 : km <= 45 ? 15 : 20;
  if (cls === 'I') return Math.min(100, Math.max(25, Math.round((20 + km * 1.35) / 5) * 5));
  return Math.min(115, Math.max(35, Math.round((30 + km * 1.45) / 5) * 5));
}

/** Monthly season ticket. */
export function localPass(m, cls = 'II') {
  const km = m / 1000;
  if (cls === 'II') return km <= 10 ? 100 : km <= 20 ? 155 : km <= 45 ? 225 : 320;
  if (cls === 'I') return Math.round(localFare(m, 'I') * 13 / 5) * 5;
  return Math.round(localFare(m, 'AC') * 18 / 5) * 5;
}

/**
 * Metro fare by distance. Lines 2A/7/3 and the rest of MMRDA's network share ₹10 slabs
 * (≤3 km ₹10, ≤12 ₹20, ≤18 ₹30, ≤24 ₹40, ≤30 ₹50, ≤36 ₹60, ≤42 ₹70, more ₹80); Line 1's
 * own slabs were not found (₹10–40, end to end ₹30–40), so it uses shorter ones.
 */
export function metroFare(m, line = '3') {
  const km = m / 1000;
  if (line === '1') return km <= 2 ? 10 : km <= 5 ? 20 : km <= 8 ? 30 : 40;
  for (const [lim, f] of [[3, 10], [12, 20], [18, 30], [24, 40], [30, 50], [36, 60], [42, 70]]) if (km <= lim) return f;
  return 80;
}

export class Tickets {
  /** ctx: state, clock, hud, audio, view (released while a panel is open). */
  constructor(ctx) {
    Object.assign(this, ctx);
    this.buildPanel();
  }

  get list() { return (this.state.s.tickets ||= []); }
  /** Game time in hours since the first day. */
  now() { return this.state.s.day * 24 + this.clock.hour; }
  endOfDay(extra = 0) { return (this.state.s.day + extra) * 24 + 24; }

  /** Drop used and expired tickets. */
  prune() {
    const t = this.now();
    const keep = this.list.filter((k) => k.until > t && (k.uses == null || k.uses > 0));
    if (keep.length !== this.list.length) { this.state.s.tickets = keep; this.state.changed(); }
  }

  /** Pay for and keep a ticket; false if the wallet is short. */
  buy(t, where = 'window') {
    if (!this.state.canAfford(t.price)) { this.hud.message(`${rupees(t.price)} — not enough in the wallet. Earn some fares first (J).`); return false; }
    this.state.pay(t.price, `${t.sys === 'metro' ? `Metro Line ${t.line}` : 'Local'} ${t.kind} ${t.from} → ${t.to}`);
    t.id = Date.now() + Math.floor(Math.random() * 1000);
    t.at = where;
    this.list.push(t);
    this.prune();
    this.state.changed();
    this.audio?.ui?.();
    return true;
  }

  /** A new local ticket (not yet paid): kind single | return | pass. */
  local(from, to, m, cls, kind) {
    const now = this.now();
    const price = kind === 'pass' ? localPass(m, cls) : kind === 'return' ? localFare(m, cls) * 2 : localFare(m, cls);
    return {
      sys: 'local', from, to, m, cls, kind, price, bought: now,
      // Singles: start within 6 game hours (the real rule is one hour, but the game's clock runs 60× fast); returns to midnight next day; passes 30 days.
      until: kind === 'pass' ? now + 30 * 24 : kind === 'return' ? this.endOfDay(1) : now + 6,
      uses: kind === 'pass' ? null : kind === 'return' ? 2 : 1,
    };
  }

  metro(line, from, to, m) {
    const now = this.now();
    return { sys: 'metro', line, from, to, m, cls: 'II', kind: 'single', price: metroFare(m, line), bought: now, until: this.endOfDay(), uses: 1 };
  }

  /**
   * The ticket that covers a local trip from → to in a coach that needs class `need`
   * ('II', 'I', or 'AC' for an AC train). dist(a, b) is the rail distance between two stations.
   */
  findLocal(from, to, need, dist) {
    this.prune();
    const on = (a, b, x, y) => { const ab = dist(a, b); return ab < Infinity && dist(a, x) + dist(x, y) + dist(y, b) <= ab + 400; };
    let best = null;
    for (const t of this.list) {
      if (t.sys !== 'local') continue;
      if (need === 'AC' ? t.cls !== 'AC' : RANK[t.cls] < RANK[need]) continue;
      const fwd = on(t.from, t.to, from, to), back = (t.kind !== 'single') && on(t.to, t.from, from, to);
      if (!fwd && !back) continue;
      if (!best || (best.kind === 'pass') > (t.kind === 'pass')) best = t; // spend a single before touching a pass
    }
    return best;
  }

  /** A trip is over: singles are used up, returns lose one leg. */
  spend(t) {
    if (!t || t.uses == null) return;
    t.uses--;
    this.prune();
    this.state.changed();
  }

  findMetro(line, from) {
    this.prune();
    return this.list.find((t) => t.sys === 'metro' && t.line === line && t.from === from && !t.entered) || null;
  }

  /** A fine (pushes the wallet into debt if need be). */
  fine(amount, why) {
    this.state.pay(amount, why);
    this.hud.message(`${why}: ${rupees(amount)} fine. Receipt given. ${this.state.money < 0 ? 'You are now in debt.' : ''}`);
  }

  /** Short list of tickets held (for the panel and the phone). */
  describe() {
    this.prune();
    if (!this.list.length) return 'No tickets.';
    return this.list.map((t) => t.sys === 'metro'
      ? `Metro L${t.line} QR · ${t.from} → ${t.to}`
      : `${CLASSES[t.cls]} ${t.kind === 'pass' ? 'monthly pass' : t.kind} · ${t.from} ⇄ ${t.to}${t.kind === 'return' ? ` (${t.uses} left)` : ''}`).join('<br>');
  }

  // ---------------------------------------------------------------- the counter panel
  buildPanel() {
    const css = document.createElement('style');
    css.textContent = `
#ticket-panel { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 31; width: min(470px, 94vw); max-height: 86vh; display: flex; flex-direction: column; background: #0b0d12f4; color: #fff; border-top: 5px solid #f7c600; border-radius: 8px; font: 14px system-ui, sans-serif; box-shadow: 0 12px 40px #000a; }
#ticket-panel[hidden] { display: none; }
#ticket-panel header { padding: 12px 16px 6px; }
#ticket-panel header b { font-size: 17px; }
#ticket-panel header small { display: block; opacity: .75; margin-top: 3px; }
#ticket-panel .opts { display: flex; flex-wrap: wrap; gap: 6px; padding: 4px 14px; }
#ticket-panel .opts button { flex: 1; min-width: 70px; background: #ffffff14; color: #fff; border: 0; padding: 6px 8px; border-radius: 6px; font: 600 13px system-ui, sans-serif; cursor: pointer; }
#ticket-panel .opts button.on { background: #f7c600; color: #111; }
#ticket-panel .list { overflow-y: auto; padding: 0 10px 6px; }
#ticket-panel h4 { margin: 10px 6px 4px; font: 700 12px system-ui, sans-serif; letter-spacing: .06em; text-transform: uppercase; }
#ticket-panel h4 i { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; }
#ticket-panel .list button { display: flex; justify-content: space-between; gap: 12px; width: 100%; text-align: left; background: #ffffff14; color: #fff; border: 0; margin: 3px 0; padding: 8px 12px; border-radius: 6px; font: 600 14px system-ui, sans-serif; cursor: pointer; }
#ticket-panel .list button.sel, #ticket-panel .list button:hover { background: #f7c60055; }
#ticket-panel .list button span { opacity: .8; font-weight: 500; white-space: nowrap; }
#ticket-panel .held { margin: 4px 14px; padding: 6px 10px; background: #ffffff0d; border-radius: 6px; font-size: 12px; opacity: .85; }
#ticket-panel footer { padding: 6px 16px 10px; font-size: 12px; opacity: .7; }`;
    document.head.appendChild(css);
    const p = this.panel = document.createElement('div');
    p.id = 'ticket-panel';
    p.hidden = true;
    document.body.appendChild(p);
    p.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.cls) { this.cfg.cls = b.dataset.cls; this.render(); }
      else if (b.dataset.kind) { this.cfg.kind = b.dataset.kind; this.render(); }
      else if (b.dataset.i) this.choose(Number(b.dataset.i));
    });
    addEventListener('keydown', (e) => {
      if (!this.cfg) return;
      const n = this.options.length;
      if (e.code === 'Escape') this.close();
      else if (e.code === 'ArrowDown' || e.code === 'ArrowUp') { if (n) this.select((this.sel + (e.code === 'ArrowDown' ? 1 : n - 1)) % n); }
      else if (e.code === 'Enter' || e.code === 'NumpadEnter') this.choose(this.sel);
      else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        const ks = this.cfg.kinds, i = ks.indexOf(this.cfg.kind);
        this.cfg.kind = ks[(i + (e.code === 'ArrowRight' ? 1 : ks.length - 1)) % ks.length]; this.render();
      } else if (/^Digit[1-3]$/.test(e.code) && this.cfg.classes.length > 1) {
        const c = this.cfg.classes[Number(e.code.slice(5)) - 1];
        if (c) { this.cfg.cls = c; this.render(); }
      } else return;
      e.preventDefault(); e.stopPropagation();
    }, true);
  }

  get isOpen() { return !!this.cfg; }

  /**
   * Open a ticket counter. cfg: { title, sub, sys 'local' | 'metro', from, line (metro),
   * groups: [{ name, colour, stops: [{ name, m }] }], where 'window' | 'machine' | 'app' }.
   */
  open(cfg) {
    this.cfg = { cls: 'II', kind: 'single', ...cfg, classes: cfg.sys === 'metro' ? ['II'] : ['II', 'I', 'AC'], kinds: cfg.sys === 'metro' ? ['single'] : ['single', 'return', 'pass'] };
    this.sel = 0;
    this.render();
    this.panel.hidden = false;
    this.view?.release?.();
  }

  close() { this.panel.hidden = true; this.cfg = null; this.options = []; }

  render() {
    const c = this.cfg;
    this.options = [];
    let html = '';
    for (const g of c.groups) {
      html += `<h4><i style="background:${g.colour}"></i>${g.name}</h4>`;
      for (const s of g.stops) {
        if (s.name === c.from) continue;
        const t = c.sys === 'metro' ? this.metro(g.line, c.from, s.name, s.m) : this.local(c.from, s.name, s.m, c.cls, c.kind);
        html += `<button data-i="${this.options.length}">${s.name}<span>${rupees(t.price)} · ${(s.m / 1000).toFixed(1)} km</span></button>`;
        this.options.push(t);
      }
    }
    const opts = c.sys === 'metro' ? '' : `<div class="opts">${c.classes.map((k, i) => `<button data-cls="${k}" class="${k === c.cls ? 'on' : ''}">${i + 1} ${CLASSES[k]}</button>`).join('')}</div>
      <div class="opts">${c.kinds.map((k) => `<button data-kind="${k}" class="${k === c.kind ? 'on' : ''}">${k === 'pass' ? 'Monthly pass' : k === 'return' ? 'Return' : 'Single'}</button>`).join('')}</div>`;
    this.panel.innerHTML = `<header><b>${c.title}</b><small>${c.sub || ''}</small></header>${opts}<div class="list">${html}</div>
      <div class="held">🎫 ${this.describe()}</div>
      <footer>↑ ↓ Enter, or click · ${c.sys === 'metro' ? '' : '1–3 class · ← → single / return / pass · '}Esc closes · Wallet ${rupees(this.state.money)}</footer>`;
    this.select(Math.min(this.sel, this.options.length - 1));
  }

  select(i) {
    this.sel = Math.max(0, i);
    this.panel.querySelectorAll('.list button').forEach((b, k) => { b.classList.toggle('sel', k === this.sel); if (k === this.sel) b.scrollIntoView?.({ block: 'nearest' }); });
  }

  choose(i) {
    const t = this.options?.[i];
    if (!t || !this.cfg) return;
    const where = this.cfg.where || 'window', done = this.cfg.onBuy;
    if (!this.buy(t, where)) return;
    this.close();
    const what = t.sys === 'metro' ? `QR ticket ${t.from} → ${t.to} (Line ${t.line})` : `${CLASSES[t.cls]} ${t.kind === 'pass' ? 'monthly pass' : t.kind} ${t.from} → ${t.to}`;
    this.hud.message(`🎫 ${what}: ${rupees(t.price)}. ${t.sys === 'metro' ? 'Tap it at the gates.' : t.kind === 'single' ? 'Start within 6 hours (game time).' : ''}`);
    done?.(t);
  }
}
