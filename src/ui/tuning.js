// Car tuning panel (F2): sliders for the handling numbers in vehicle.js TUNE, applied live to
// every car. "Save" keeps them in this browser; "Copy" puts them on the clipboard to send over.
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { TUNE } from '../vehicles/vehicle.js';

const RANGES = {
  stiffness: [10, 80, 1], compression: [0.5, 8, 0.1], relaxation: [0.5, 8, 0.1], suspensionRest: [0.1, 0.4, 0.01],
  suspensionTravel: [0.05, 0.4, 0.01], frictionSlip: [0.5, 5, 0.05], sideStiffness: [0.3, 2, 0.05], rearGripHandbrake: [0.1, 1, 0.05],
  engine: [0.3, 3, 0.05], brake: [0.2, 3, 0.05], steerMax: [0.2, 0.9, 0.01], steerSpeed: [0.5, 8, 0.1], steerFade: [0, 0.15, 0.005],
  drag: [0, 1.5, 0.01], rolling: [0, 0.05, 0.001],
};

export class Tuning {
  constructor(getCars) {
    this.gui = null; this.getCars = getCars;
  }
  toggle() {
    if (this.gui) { this.gui.destroy(); this.gui = null; return; }
    const gui = (this.gui = new GUI({ title: 'Car tuning (F2)' }));
    for (const [k, [a, b, s]] of Object.entries(RANGES)) gui.add(TUNE, k, a, b, s).onChange(() => { for (const c of this.getCars()) c.applyTune(); });
    gui.add({ save: () => { try { localStorage.setItem('gtb.tune', JSON.stringify(TUNE)); } catch { /* */ } } }, 'save').name('Save in this browser');
    gui.add({ copy: () => navigator.clipboard?.writeText(JSON.stringify(TUNE, null, 1)) }, 'copy').name('Copy numbers');
    gui.add({ reset: () => { try { localStorage.removeItem('gtb.tune'); } catch { /* */ } location.reload(); } }, 'reset').name('Reset to defaults');
  }
}
