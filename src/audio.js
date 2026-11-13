// City sound: traffic ambience, waves near the sea, crows by day, horns. Starts on the
// first key press or tap (browsers block sound before that). Files come from media/.

const IDS = {
  traffic: 'sound-fs-585731', street: 'sound-fs-221639', waves: 'sound-fs-648860',
  crows: 'sound-fs-289657', horn: 'sound-fs-170243', truckHorn: 'sound-fs-406888',
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
    if (!this.ctx || !this.buffers[name]) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers[name];
    const g = this.ctx.createGain();
    g.gain.value = volume;
    src.connect(g).connect(this.master);
    src.start(0, 0, Math.min(1.2, src.buffer.duration));
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

  toggleMute() {
    if (!this.ctx) return;
    this.muted = !this.muted;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.ctx.currentTime, 0.1);
  }
}
