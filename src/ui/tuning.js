// Car tuning panel (F2): the handling numbers of the car you're in (or the one you're next to),
// applied live to every car of that model. Each car model keeps its own numbers: "Save for this
// car" stores them in this browser (gtb.tune.<car id>); "Copy numbers" puts them on the clipboard,
// with the car's id, to send over so they can become that car's defaults in cars.js.
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { BASE_TUNE, TUNE_VERSION } from '../vehicles/vehicle.js';

const RANGES = {
  stiffness: [10, 80, 1], compression: [0.5, 8, 0.1], relaxation: [0.5, 8, 0.1], suspensionRest: [0.1, 0.4, 0.01],
  suspensionTravel: [0.05, 0.4, 0.01], frictionSlip: [0.5, 5, 0.05], sideStiffness: [0.3, 2, 0.05], rearGripHandbrake: [0.1, 1, 0.05],
  engine: [0.3, 3, 0.05], brake: [0.2, 3, 0.05], steerMax: [0.2, 0.9, 0.01], steerSpeed: [0.5, 8, 0.1], steerReturn: [1, 12, 0.1],
  steerFade: [0, 0.15, 0.005], yawAssist: [0, 1.5, 0.05], comHeight: [0.15, 0.6, 0.01], antiRoll: [0, 10, 0.1], drag: [0, 2, 0.01], rolling: [0, 0.05, 0.001],
};

export class Tuning {
  /** getCar(): the car to tune (driven or nearest); getCars(): every car (same model shares numbers). */
  constructor(getCar, getCars) { this.gui = null; this.getCar = getCar; this.getCars = getCars; this.car = null; }

  toggle() { if (this.gui) this.close(); else this.open(); }
  close() { this.gui?.destroy(); this.gui = null; this.car = null; }

  open() {
    const car = this.getCar();
    if (!car) return;
    this.car = car;
    const id = car.model.id, T = car.tune;
    const sameModel = () => this.getCars().filter((c) => c.model.id === id);
    const apply = () => { for (const c of sameModel()) { if (c.tune !== T) Object.assign(c.tune, T); c.applyTune(); } };
    const gui = (this.gui = new GUI({ title: `Tuning: ${car.spec.name} (F2)` }));
    for (const [k, [a, b, s]] of Object.entries(RANGES)) gui.add(T, k, a, b, s).onChange(apply);
    gui.add({ save: () => { try { localStorage.setItem(`gtb.tune.${id}`, JSON.stringify({ ...T, version: TUNE_VERSION })); } catch { /* */ } } }, 'save').name(`Save for this car`);
    gui.add({ copy: () => navigator.clipboard?.writeText(JSON.stringify({ car: id, ...T }, null, 1)) }, 'copy').name('Copy numbers');
    gui.add({ reset: () => {
      try { localStorage.removeItem(`gtb.tune.${id}`); } catch { /* */ }
      Object.assign(T, BASE_TUNE, car.spec.handling || {}); apply(); gui.controllersRecursive().forEach((c) => c.updateDisplay());
    } }, 'reset').name('Reset this car');
  }

  /** Follow the player into another car while the panel is open. */
  follow() { if (this.gui && this.getCar() && this.getCar() !== this.car) { this.close(); this.open(); } }
}
