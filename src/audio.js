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

  toggleMute() {
    if (!this.ctx) return;
    this.muted = !this.muted;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.ctx.currentTime, 0.1);
  }
}
