// Sound: recorded Mumbai street ambience and a real horn (Freesound, credited in media/CREDITS.md),
// plus synthesised engine, tyre squeal, crashes and gunshots. Starts on the first key or click
// (browsers block sound until then).
const BASE = import.meta.env.BASE_URL;
// Ids must appear literally: scripts/ship-media.mjs ships only media named in src/.
const FILES = { street: 'sound-fs-221639', crows: 'sound-fs-289657', horn: 'sound-fs-170243' };

export class Audio {
  constructor() {
    this.ctx = null; this.buffers = {}; this.volume = 0.8;
    const start = () => { this.start(); removeEventListener('keydown', start); removeEventListener('mousedown', start); };
    addEventListener('keydown', start); addEventListener('mousedown', start);
  }

  async start() {
    if (this.ctx) return;
    const ctx = (this.ctx = new AudioContext());
    this.master = ctx.createGain(); this.master.gain.value = this.volume; this.master.connect(ctx.destination);
    // Noise buffer for squeal, crashes and shots.
    const n = ctx.sampleRate * 2, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    // Engine: two detuned saws through a low-pass filter.
    this.engine = ctx.createGain(); this.engine.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600; lp.Q.value = 2;
    this.engineFilter = lp;
    this.osc = [ctx.createOscillator(), ctx.createOscillator()];
    this.osc.forEach((o, i) => { o.type = 'sawtooth'; o.frequency.value = 40 + i * 0.7; o.connect(lp); o.start(); });
    lp.connect(this.engine); this.engine.connect(this.master);
    // Tyre squeal: band-passed noise.
    const sq = ctx.createBufferSource(); sq.buffer = buf; sq.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 6;
    this.squeal = ctx.createGain(); this.squeal.gain.value = 0;
    sq.connect(bp); bp.connect(this.squeal); this.squeal.connect(this.master); sq.start();
    // Ambience.
    for (const [k, id] of Object.entries(FILES)) {
      fetch(`${BASE}media/sounds/${id}.ogg`).then((r) => r.arrayBuffer()).then((a) => ctx.decodeAudioData(a)).then((b) => {
        this.buffers[k] = b;
        if (k === 'street' || k === 'crows') this.loop(b, k === 'street' ? 0.35 : 0.12);
      }).catch(() => {});
    }
  }

  loop(buffer, vol) {
    const s = this.ctx.createBufferSource(); s.buffer = buffer; s.loop = true;
    const g = this.ctx.createGain(); g.gain.value = vol;
    s.connect(g); g.connect(this.master); s.start();
  }

  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }

  /** rpm 0..1, load 0..1 (throttle), on: in a running car; slip: tyre slide 0..1. */
  car(on, rpm, load, slip) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engine.gain.setTargetAtTime(on ? 0.05 + load * 0.08 : 0, t, 0.1);
    const f = 32 + rpm * 120;
    this.osc[0].frequency.setTargetAtTime(f, t, 0.05);
    this.osc[1].frequency.setTargetAtTime(f * 1.5 + 0.7, t, 0.05);
    this.engineFilter.frequency.setTargetAtTime(300 + rpm * 1400 + load * 600, t, 0.05);
    this.squeal.gain.setTargetAtTime(on ? Math.min(0.12, slip * 0.15) : 0, t, 0.05);
  }

  burst({ dur = 0.3, freq = 800, q = 0.7, vol = 0.5, type = 'lowpass', decay = 6 } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
    void decay;
  }

  shot() {
    this.burst({ dur: 0.35, freq: 2400, q: 0.5, vol: 0.9 });
    this.burst({ dur: 0.9, freq: 300, q: 0.8, vol: 0.5 }); // the street echoes
  }
  crash(strength) { this.burst({ dur: 0.25 + strength * 0.05, freq: 500 + strength * 60, vol: Math.min(1, 0.2 + strength * 0.08) }); }
  click() { this.burst({ dur: 0.05, freq: 3000, type: 'highpass', vol: 0.2 }); }

  horn(on) {
    if (!this.ctx || !this.buffers.horn) return;
    if (on && !this.hornSrc) {
      const s = this.ctx.createBufferSource(); s.buffer = this.buffers.horn; s.loop = true; s.loopStart = 0.05; s.loopEnd = Math.min(0.35, this.buffers.horn.duration);
      const g = this.ctx.createGain(); g.gain.value = 0.6; s.connect(g); g.connect(this.master); s.start();
      this.hornSrc = s;
    } else if (!on && this.hornSrc) { this.hornSrc.stop(); this.hornSrc = null; }
  }
}
