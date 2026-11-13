// City sound: traffic ambience, waves near the sea, crows by day, horns. Starts on the
// first key press or tap (browsers block sound before that). Files come from media/.

const IDS = {
  traffic: 'sound-fs-585731', street: 'sound-fs-221639', waves: 'sound-fs-648860',
  crows: 'sound-fs-289657', horn: 'sound-fs-170243', truckHorn: 'sound-fs-406888',
};

/** Engine voices: base pitch and range (Hz), gears and their speed span (m/s), filter, level, putt-putt depth. */
const ENGINES = {
  car: { base: 34, range: 70, gears: 4, span: 6.5, lp: 300, gain: 1, putt: 0 },
  auto: { base: 52, range: 85, gears: 4, span: 4.4, lp: 520, gain: 0.9, putt: 0.45 },
  bike: { base: 58, range: 120, gears: 5, span: 5.6, lp: 620, gain: 0.8, putt: 0.12 },
  big: { base: 22, range: 44, gears: 5, span: 3.8, lp: 220, gain: 1.35, putt: 0 },
  cycle: { base: 34, range: 0, gears: 1, span: 9, lp: 200, gain: 0, putt: 0 },
};

export class CityAudio {
  constructor(lib) {
    this.lib = lib;
    this.ctx = null;
    this.loops = {};
    this.buffers = {};
    this.muted = false;
  }

  async start() {
    if (this.ctx || !this.lib.available) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(this.ctx.destination);
    await Promise.all(Object.entries(IDS).map(async ([name, id]) => {
      const url = this.lib.url(id);
      if (!url) return;
      try {
        const buf = await (await fetch(url)).arrayBuffer();
        this.buffers[name] = await this.ctx.decodeAudioData(buf);
      } catch { /* format not supported here: stay silent */ }
    }));
    for (const name of ['traffic', 'street', 'waves', 'crows']) {
      const b = this.buffers[name];
      if (!b) continue;
      const src = this.ctx.createBufferSource();
      src.buffer = b; src.loop = true;
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      src.connect(gain).connect(this.master);
      src.start(0, Math.random() * b.duration);
      this.loops[name] = gain;
    }
  }

  set(name, v) {
    const g = this.loops[name];
    if (g) g.gain.setTargetAtTime(v, this.ctx.currentTime, 0.4);
  }

  /** Mix ambience: sea proximity 0..1, traffic density 0..1, daylight 0..1. */
  update(sea, traffic, daylight) {
    if (!this.ctx) return;
    this.set('traffic', 0.25 + 0.35 * traffic);
    this.set('street', (0.1 + 0.3 * traffic) * (1 - sea * 0.6));
    this.set('waves', 0.7 * sea);
    this.set('crows', 0.25 * daylight * (1 - sea * 0.5));
  }

  play(name, volume = 1) {
    // The horn depends on what is being driven: a bicycle rings, an auto and bikes peep.
    if (name === 'horn' && this.hornKind === 'bell') { this.bell(); return; }
    if (!this.ctx || !this.buffers[name]) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers[name];
    if (name === 'horn' && this.hornKind === 'peep') src.playbackRate.value = 1.55;
    const g = this.ctx.createGain();
    g.gain.value = volume;
    src.connect(g).connect(this.master);
    src.start(0, 0, Math.min(1.2, src.buffer.duration));
  }

  /** Bicycle bell: "tring-tring". */
  bell() {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    for (const start of [0, 0.16, 0.42, 0.58]) {
      for (const [f, v] of [[2350, 0.09], [3520, 0.05], [5230, 0.025]]) {
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0, t0 + start);
        g.gain.linearRampToValueAtTime(v, t0 + start + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0008, t0 + start + 0.3);
        o.connect(g).connect(this.master);
        o.start(t0 + start); o.stop(t0 + start + 0.32);
      }
    }
  }

  /** Traffic police whistle (synthesised): two sharp trilled blasts. */
  whistle(volume = 1) {
    if (!this.ctx || volume < 0.02) return;
    const t0 = this.ctx.currentTime;
    for (const [start, len] of [[0, 0.22], [0.3, 0.5]]) {
      const osc = this.ctx.createOscillator(), trill = this.ctx.createOscillator(), depth = this.ctx.createGain(), g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 2900;
      trill.frequency.value = 38;
      depth.gain.value = 140;
      trill.connect(depth).connect(osc.frequency);
      g.gain.setValueAtTime(0, t0 + start);
      g.gain.linearRampToValueAtTime(0.22 * volume, t0 + start + 0.02);
      g.gain.setValueAtTime(0.22 * volume, t0 + start + len - 0.04);
      g.gain.linearRampToValueAtTime(0, t0 + start + len);
      osc.connect(g).connect(this.master);
      osc.start(t0 + start); trill.start(t0 + start);
      osc.stop(t0 + start + len + 0.05); trill.stop(t0 + start + len + 0.05);
    }
  }

  /** Stray dog bark (filtered noise bursts). */
  bark(volume = 1) {
    if (!this.ctx || volume < 0.03) return;
    if (!this.noise) {
      const b = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.5, this.ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noise = b;
    }
    const t0 = this.ctx.currentTime;
    for (const start of [0, 0.22]) {
      const src = this.ctx.createBufferSource(), bp = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
      src.buffer = this.noise;
      bp.type = 'bandpass'; bp.Q.value = 3;
      bp.frequency.setValueAtTime(900, t0 + start);
      bp.frequency.exponentialRampToValueAtTime(420, t0 + start + 0.12);
      g.gain.setValueAtTime(0, t0 + start);
      g.gain.linearRampToValueAtTime(0.5 * volume, t0 + start + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + start + 0.14);
      src.connect(bp).connect(g).connect(this.master);
      src.start(t0 + start, Math.random() * 0.3, 0.16);
    }
  }

  /** Two-tone police siren; volume 0 stops it. */
  siren(volume) {
    if (!this.ctx) return;
    if (!this.sirenNode) {
      if (volume < 0.01) return;
      const osc = this.ctx.createOscillator(), lfo = this.ctx.createOscillator(), depth = this.ctx.createGain(), g = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 760;
      lfo.type = 'square';
      lfo.frequency.value = 1.6;
      depth.gain.value = 170;
      lfo.connect(depth).connect(osc.frequency);
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 1800;
      g.gain.value = 0;
      osc.connect(lp).connect(g).connect(this.master);
      osc.start(); lfo.start();
      this.sirenNode = { osc, lfo, g };
    }
    this.sirenNode.g.gain.setTargetAtTime(Math.min(0.12, volume * 0.12), this.ctx.currentTime, 0.2);
  }

  /** Pichkari spray hiss (looping filtered noise), level 0..1. */
  spray(level) {
    if (!this.ctx) return;
    if (!this.sprayNode) {
      if (level < 0.01) return;
      const len = this.ctx.sampleRate;
      const b = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = this.ctx.createBufferSource(), bp = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
      src.buffer = b; src.loop = true;
      bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 0.8;
      g.gain.value = 0;
      src.connect(bp).connect(g).connect(this.master);
      src.start();
      this.sprayNode = g;
    }
    this.sprayNode.gain.setTargetAtTime(level * 0.08, this.ctx.currentTime, 0.05);
  }

  /**
   * Engine: rough sawtooth hum with fake gears; 0 volume when on foot. `engineKind` (set by
   * the garage) changes its voice: 'car' (the old taxi), 'auto' (a two-stroke putt-putt),
   * 'bike', 'big' (bus, truck) or 'cycle' (silent).
   */
  engine(speed, throttle, on = true) {
    if (!this.ctx) return;
    if (!this.engineNode) {
      const a = this.ctx.createOscillator(), b = this.ctx.createOscillator(), lp = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
      const putt = this.ctx.createOscillator(), depth = this.ctx.createGain(), trem = this.ctx.createGain();
      a.type = 'sawtooth'; b.type = 'square'; b.detune.value = -1200;
      lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 2;
      g.gain.value = 0;
      // Tremolo for the auto's putt-putt: an LFO on a gain stage after the filter.
      putt.type = 'square'; putt.frequency.value = 11; depth.gain.value = 0; trem.gain.value = 1;
      putt.connect(depth).connect(trem.gain);
      a.connect(lp); b.connect(lp); lp.connect(trem).connect(g).connect(this.master);
      a.start(); b.start(); putt.start();
      this.engineNode = { a, b, lp, g, putt, depth };
    }
    const K = ENGINES[this.engineKind] || ENGINES.car;
    const v = Math.abs(speed), gear = Math.min(K.gears - 1, Math.floor(v / K.span));
    const rpm = 0.22 + Math.min(1, (v - gear * K.span) / K.span) * 0.7 + throttle * 0.08;
    const f = K.base + rpm * K.range, t = this.ctx.currentTime;
    const n = this.engineNode;
    n.a.frequency.setTargetAtTime(f, t, 0.08); n.b.frequency.setTargetAtTime(f, t, 0.08);
    n.lp.frequency.setTargetAtTime(K.lp + rpm * 500 + throttle * 200, t, 0.1);
    n.putt.frequency.setTargetAtTime(8 + rpm * 16, t, 0.1);
    n.depth.gain.setTargetAtTime(K.putt, t, 0.2);
    n.g.gain.setTargetAtTime(on ? (0.035 + throttle * 0.03 + rpm * 0.02) * K.gain : 0, t, 0.15);
  }

  /** Tyre squeal, level 0..1. */
  squeal(level) {
    if (!this.ctx) return;
    if (!this.squealNode) {
      if (level < 0.01) return;
      const a = this.ctx.createOscillator(), b = this.ctx.createOscillator(), lfo = this.ctx.createOscillator(), depth = this.ctx.createGain(), bp = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
      a.type = 'sawtooth'; b.type = 'sawtooth'; a.frequency.value = 1150; b.frequency.value = 1190;
      lfo.frequency.value = 9; depth.gain.value = 45;
      lfo.connect(depth); depth.connect(a.frequency); depth.connect(b.frequency);
      bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 4;
      g.gain.value = 0;
      a.connect(bp); b.connect(bp); bp.connect(g).connect(this.master);
      a.start(); b.start(); lfo.start();
      this.squealNode = g;
    }
    this.squealNode.gain.setTargetAtTime(Math.min(1, level) * 0.06, this.ctx.currentTime, 0.04);
  }

  /** Crash: a thump and a metallic clank. */
  crash(intensity) {
    if (!this.ctx || intensity < 0.05) return;
    const t0 = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * 0.4);
    const b = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.18));
    const src = this.ctx.createBufferSource(), lp = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    src.buffer = b; lp.type = 'lowpass'; lp.frequency.value = 700 + intensity * 1200;
    g.gain.value = 0.5 * intensity;
    src.connect(lp).connect(g).connect(this.master);
    src.start(t0);
    const o = this.ctx.createOscillator(), og = this.ctx.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(220, t0); o.frequency.exponentialRampToValueAtTime(90, t0 + 0.25);
    og.gain.setValueAtTime(0.15 * intensity, t0); og.gain.exponentialRampToValueAtTime(0.001, t0 + 0.3);
    o.connect(og).connect(this.master); o.start(t0); o.stop(t0 + 0.32);
  }

  noiseBuf() {
    if (!this.noise) {
      const b = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.5, this.ctx.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noise = b;
    }
    return this.noise;
  }

  /** Dhishoom: a punch landing. */
  punch(v = 1) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime, src = this.ctx.createBufferSource(), lp = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    src.buffer = this.noiseBuf(); lp.type = 'lowpass'; lp.frequency.value = 500;
    g.gain.setValueAtTime(0.6 * v, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
    src.connect(lp).connect(g).connect(this.master); src.start(t0, 0, 0.14);
    const o = this.ctx.createOscillator(), og = this.ctx.createGain();
    o.frequency.setValueAtTime(140, t0); o.frequency.exponentialRampToValueAtTime(50, t0 + 0.12);
    og.gain.setValueAtTime(0.4 * v, t0); og.gain.exponentialRampToValueAtTime(0.001, t0 + 0.14);
    o.connect(og).connect(this.master); o.start(t0); o.stop(t0 + 0.15);
  }

  /** Swish of a swing or a throw. */
  whoosh() {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime, src = this.ctx.createBufferSource(), bp = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    src.buffer = this.noiseBuf(); bp.type = 'bandpass'; bp.Q.value = 1.5;
    bp.frequency.setValueAtTime(400, t0); bp.frequency.exponentialRampToValueAtTime(1800, t0 + 0.15);
    g.gain.setValueAtTime(0.0, t0); g.gain.linearRampToValueAtTime(0.18, t0 + 0.05); g.gain.linearRampToValueAtTime(0, t0 + 0.18);
    src.connect(bp).connect(g).connect(this.master); src.start(t0, 0.1, 0.2);
  }

  /** Breaking glass: a crash of bright noise and a few tinkles. */
  glass() {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const src = this.ctx.createBufferSource(), hp = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    src.buffer = this.noiseBuf(); hp.type = 'highpass'; hp.frequency.value = 2500;
    g.gain.setValueAtTime(0.4, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.4);
    src.connect(hp).connect(g).connect(this.master); src.start(t0, 0, 0.45);
    for (let i = 0; i < 6; i++) {
      const o = this.ctx.createOscillator(), og = this.ctx.createGain(), st = t0 + 0.05 + Math.random() * 0.5;
      o.frequency.value = 3000 + Math.random() * 3000;
      og.gain.setValueAtTime(0.05, st); og.gain.exponentialRampToValueAtTime(0.0005, st + 0.15);
      o.connect(og).connect(this.master); o.start(st); o.stop(st + 0.16);
    }
  }

  /** The TV-censor beep over a gaali. */
  bleep() {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.frequency.value = 1000;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.08, t0 + 0.01); g.gain.setValueAtTime(0.08, t0 + 0.32); g.gain.linearRampToValueAtTime(0, t0 + 0.34);
    o.connect(g).connect(this.master); o.start(t0); o.stop(t0 + 0.36);
  }

  /** Musical horn (Dukaan upgrade): a cheeky little tune. */
  musicalHorn() {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const notes = [523, 523, 523, 698, 880, 523, 523, 523, 698, 880];
    notes.forEach((f, i) => {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = f;
      const st = t0 + i * 0.13;
      g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(0.09, st + 0.01); g.gain.setValueAtTime(0.09, st + 0.1); g.gain.linearRampToValueAtTime(0, st + 0.12);
      o.connect(g).connect(this.master); o.start(st); o.stop(st + 0.13);
    });
  }

  toggleMute() {
    if (!this.ctx) return;
    this.muted = !this.muted;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume ?? 0.8, this.ctx.currentTime, 0.1);
  }

  setVolume(v) {
    this.volume = v;
    if (this.ctx && !this.muted) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
  }
}
