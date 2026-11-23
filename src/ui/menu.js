// Pause menu (Esc, or when the mouse is released): Resume, Controls, Settings, Credits.
import { TIERS } from '../core/renderer.js';

const $ = (id) => document.getElementById(id);
const CONTROLS = [
  ['Move', 'W A S D', 'Left stick'], ['Look', 'Mouse (click to capture)', 'Right stick'], ['Sprint', 'Shift', 'A'],
  ['Walk slowly', 'Alt', ''], ['Jump', 'Space', 'X'], ['Enter / exit vehicle', 'F', 'Y'], ['Aim / shoot', 'Right / left mouse', 'LT / RT'],
  ['Reload', 'R', 'B'], ['Fists / pistol', '1 / 2 or wheel', 'D-pad ← →'], ['Accelerate / brake, reverse', 'W / S', 'RT / LT'],
  ['Handbrake', 'Space', 'B'], ['Horn', 'H', 'Left stick press'], ['Put a flipped car back', 'Hold F', ''],
  ['Pause', 'Esc', 'Start'], ['Car tuning panel', 'F2', ''],
];
const SETTINGS_KEY = 'gtb.settings';

export function loadSettings() {
  try { return { volume: 0.8, sensitivity: 1, invertY: false, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; }
  catch { return { volume: 0.8, sensitivity: 1, invertY: false }; }
}

export class Menu {
  constructor({ tier, backend, onResume, onSettings, credits }) {
    this.open = false;
    this.onResume = onResume;
    this.settings = loadSettings();
    $('tab-controls').innerHTML = `<table>${CONTROLS.map(([a, k, p]) => `<tr><td>${a}</td><td>${k}</td><td>${p}</td></tr>`).join('')}</table>`;
    const s = this.settings;
    $('tab-settings').innerHTML = `
      <label>Graphics <select id="set-quality">${Object.entries(TIERS).map(([k, t]) => `<option value="${k}" ${k === tier.key ? 'selected' : ''}>${t.name}</option>`).join('')}</select></label>
      <label>Volume <input id="set-volume" type="range" min="0" max="1" step="0.05" value="${s.volume}"></label>
      <label>Mouse sensitivity <input id="set-sens" type="range" min="0.3" max="2.5" step="0.05" value="${s.sensitivity}"></label>
      <label>Invert vertical look <input id="set-invert" type="checkbox" ${s.invertY ? 'checked' : ''}></label>
      <div class="note">Renderer: ${backend}. Changing graphics reloads the game.</div>`;
    $('tab-credits').innerHTML = credits;
    $('set-quality').onchange = (e) => { try { localStorage.setItem('gtb.quality', e.target.value); } catch { /* */ } const u = new URL(location.href); u.searchParams.delete('quality'); location.href = u.href; };
    const save = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch { /* */ } onSettings(this.settings); };
    $('set-volume').oninput = (e) => { s.volume = Number(e.target.value); save(); };
    $('set-sens').oninput = (e) => { s.sensitivity = Number(e.target.value); save(); };
    $('set-invert').onchange = (e) => { s.invertY = e.target.checked; save(); };
    for (const b of document.querySelectorAll('#pause nav button')) {
      b.onclick = () => {
        if (b.dataset.tab === 'resume') { this.hide(); this.onResume(); return; }
        for (const sec of ['controls', 'settings', 'credits']) $(`tab-${sec}`).hidden = sec !== b.dataset.tab;
        for (const o of document.querySelectorAll('#pause nav button')) o.classList.toggle('on', o === b);
      };
    }
    onSettings(s);
  }
  show() { this.open = true; $('pause').hidden = false; }
  hide() { this.open = false; $('pause').hidden = true; }
}
