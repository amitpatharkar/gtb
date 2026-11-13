// Taxi radio (in the taxi only; N switches station, off is one of the stations).
// Music is synthesised on the fly (no copyrighted songs): a dholak-style beat, a drone and
// a little melody per station. Between songs an RJ talks through the browser's built-in
// speech voice: traffic updates from the real game state, fake ads for the in-game apps,
// AQI and weather, and gossip about the player's challans.

const STATIONS = [
  { name: 'Radio Chutney 98.3', tag: 'Bollywood beats', bpm: 104, root: 220, scale: [0, 2, 4, 7, 9, 12], swing: 0.12 },
  { name: 'Mumbai Masala 91.9', tag: 'Filmi dance hits', bpm: 128, root: 246.9, scale: [0, 3, 5, 7, 10, 12], swing: 0.05 },
  { name: 'Lavani Junction 104', tag: 'Marathi folk tempo', bpm: 142, root: 196, scale: [0, 2, 3, 7, 8, 12], swing: 0.18 },
  { name: 'Bakbak FM 101', tag: 'talk, traffic and ads', bpm: 0, root: 0, scale: [], swing: 0 },
  { name: 'Radio off', off: true },
];
const ADS = [
  'JhatPat! Das minute mein sab kuch. Doodh, bread, petrol ka dabba bhi!',
  'Bhookh pe order karo, garam vada pav seedha aapki khidki pe!',
  'Dukaan dot in. Car perfume, seat cover, aur musical horn. Pados waale jal jayenge!',
  'PayKaro. Rent bharo, challan bharo, sab ek UPI se.',
  'Chalo Driver. Gaadi chalao, paisa kamao. Aaj hi join karo!',
];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export class Radio {
  constructor(audio) {
    this.audio = audio;
    this.index = 0;
    this.on = false;      // playing (in the taxi, radio enabled)
    this.nextNote = 0;
    this.step = 0;
    this.talkT = 25;
    this.hudEl = document.getElementById('radio');
  }

  get station() { return STATIONS[this.index]; }

  next() {
    this.index = (this.index + 1) % STATIONS.length;
    this.showName();
    this.talkT = this.station.bpm === 0 ? 2 : 6;
    return this.station;
  }

  showName() {
    if (!this.hudEl) return;
    const s = this.station;
    this.hudEl.innerHTML = s.off ? '📻 Radio off' : `📻 <b>${s.name}</b> · ${s.tag}`;
    this.hudEl.classList.add('show');
    clearTimeout(this.hideT);
    this.hideT = setTimeout(() => this.hudEl.classList.remove('show'), 3500);
  }

  ensureBus() {
    const ctx = this.audio.ctx;
    if (!ctx || this.bus) return !!this.bus;
    this.bus = ctx.createGain();
    this.bus.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 3200; // a little "car speaker"
    this.bus.connect(lp).connect(this.audio.master);
    return true;
  }

  hit(t, freq, dur, type, vol, decay = dur) {
    const ctx = this.audio.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (type === 'sine' && freq < 200) o.frequency.exponentialRampToValueAtTime(freq * 0.55, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + decay);
    o.connect(g).connect(this.bus); o.start(t); o.stop(t + decay + 0.02);
  }

  noise(t, vol, dur, freq) {
    const ctx = this.audio.ctx, src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = this.audio.noiseBuf(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 2;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(bp).connect(g).connect(this.bus); src.start(t, Math.random() * 0.3, dur + 0.05);
  }

  /** Schedule the next bits of music a little ahead of time. */
  music() {
    const ctx = this.audio.ctx, s = this.station;
    if (!s.bpm) return;
    const beat = 60 / s.bpm / 2; // eighth notes
    while (this.nextNote < ctx.currentTime + 0.25) {
      const t = this.nextNote + (this.step % 2 ? beat * s.swing : 0);
      const k = this.step % 16;
      // Dholak: deep "dha" on 1 and 9, slaps on the off-beats, a ghost "ta" here and there.
      if (k === 0 || k === 8 || (k === 11 && s.bpm > 120)) this.hit(t, 95, 0.25, 'sine', 0.55);
      if (k === 4 || k === 12) this.noise(t, 0.35, 0.12, 900);
      if (k % 2 === 1 && Math.random() < 0.6) this.noise(t, 0.12, 0.05, 2600);
      // Drone on the root every bar; a melody on the scale with a little randomness.
      if (k === 0) this.hit(t, s.root / 2, beat * 16, 'sawtooth', 0.025, beat * 16);
      if (k % 2 === 0 && Math.random() < 0.75) {
        const note = s.scale[(this.mel = ((this.mel || 0) + (Math.random() < 0.5 ? 1 : -1) + s.scale.length) % s.scale.length)];
        this.hit(t, s.root * 2 ** (note / 12) * 2, beat * 1.8, 'triangle', 0.07, beat * 1.9);
      }
      this.nextNote += beat;
      this.step++;
    }
  }

  say(text) {
    if (!('speechSynthesis' in window)) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      const v = speechSynthesis.getVoices();
      u.voice = v.find((x) => x.lang === 'hi-IN') || v.find((x) => x.lang === 'en-IN') || null;
      u.lang = u.voice?.lang || 'en-IN';
      u.rate = 1.08; u.pitch = 1.1;
      this.speaking = true;
      u.onend = () => { this.speaking = false; };
      speechSynthesis.speak(u);
    } catch { /* no speech */ }
  }

  /** RJ chatter built from what is going on in the game. */
  talk(ctx) {
    const s = this.station, h = Math.floor(ctx.clock.hour), lines = [];
    lines.push(`Aap sun rahe hain ${s.name}. Mumbai mein abhi ${ctx.clock.label} ho rahe hain.`);
    lines.push(`Hawa ka haal: AQI ${ctx.clock.aqi}. ${ctx.clock.aqi > 200 ? 'Mask pehen lo, bhai log!' : 'Aaj saans le sakte ho, enjoy karo!'}`);
    if (ctx.clock.traffic > 0.85) lines.push(`Traffic update: rush hour chal raha hai. ${ctx.road || 'Marine Drive'} pe gaadiyan reng rahi hain.`);
    else if (h < 5) lines.push('Raat ke is waqt sadkein khaali hain. Dheere chalao, kutte jaag rahe hain!');
    if (ctx.police.stars) lines.push(`Breaking news! Ek kaali-peeli taxi police se bhaag rahi hai. ${ctx.police.stars} star ka challan! Kaun hai yeh?`);
    if (ctx.state.money < 0) lines.push('Udhaar mein ho? Chalo Driver pe ride lo, paisa kamao!');
    lines.push(pick(ADS));
    this.say(pick(lines));
  }

  update(dt, inTaxi, enabled, ctx) {
    const playing = inTaxi && enabled && !this.station.off && this.ensureBus();
    if (!this.bus) return;
    const target = playing ? (this.speaking ? 0.12 : 0.45) : 0;
    this.bus.gain.setTargetAtTime(target, this.audio.ctx.currentTime, 0.3);
    if (!playing) { if (this.on) { this.on = false; try { speechSynthesis.cancel(); } catch { /* ignore */ } } return; }
    if (!this.on) { this.on = true; this.nextNote = this.audio.ctx.currentTime + 0.1; this.showName(); }
    this.music();
    this.talkT -= dt;
    if (this.talkT <= 0 && !this.speaking) { this.talkT = this.station.bpm ? 45 + Math.random() * 30 : 14 + Math.random() * 8; this.talk(ctx); }
  }
}
