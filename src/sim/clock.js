import * as THREE from 'three';

// 24-hour game clock for Mumbai (19° N), winter season. One real second is one game
// minute by default (a day lasts 24 minutes). Gives the sun direction, daylight,
// rush hours and an air-quality index (AQI) that follows Mumbai's daily cycle.

const LAT = 19.0 * (Math.PI / 180);
const DECLINATION = -18 * (Math.PI / 180); // early December
const SOLAR_NOON = 12.6;                   // Mumbai solar noon ≈ 12:36 IST

export class GameClock {
  constructor(hour = 17.25) {
    this.hour = hour;
    this.day = 1;
    this.speed = 60;      // game seconds per real second
    this.paused = false;
    this.sunDir = new THREE.Vector3();
    this.aqiSeed = Math.random();
    this.update(0);
  }

  update(dt) {
    if (!this.paused) {
      this.hour += (dt * this.speed) / 3600;
      if (this.hour >= 24) { this.hour -= 24; this.day++; this.aqiSeed = Math.random(); }
    }
    // Sun position (hour angle → elevation and azimuth).
    const H = ((this.hour - SOLAR_NOON) * 15 * Math.PI) / 180;
    const sinE = Math.sin(LAT) * Math.sin(DECLINATION) + Math.cos(LAT) * Math.cos(DECLINATION) * Math.cos(H);
    const elev = Math.asin(sinE);
    const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(LAT) - Math.tan(DECLINATION) * Math.cos(LAT)); // from south, + west
    // x = east, z = south: azimuth measured from south towards west.
    this.sunDir.set(-Math.sin(az) * Math.cos(elev), Math.sin(elev), Math.cos(az) * Math.cos(elev)).normalize();
    this.elevation = elev;
    const deg = (elev * 180) / Math.PI;
    this.daylight = THREE.MathUtils.smoothstep(deg, -7, 9);
    this.night = 1 - THREE.MathUtils.smoothstep(deg, -5, 5);
    this.twilight = Math.max(0, 1 - Math.abs(deg - 1) / 9);
    this.aqi = this.computeAqi();
  }

  /** Mumbai winter pattern: worst before dawn (still, cool air), cleanest late afternoon (sea breeze). */
  computeAqi() {
    const h = this.hour;
    const cycle = Math.cos(((h - 6.5) / 24) * Math.PI * 2);   // +1 at 06:30, −1 at 18:30
    const rush = Math.exp(-(((h - 9.5) / 1.6) ** 2)) * 25 + Math.exp(-(((h - 19) / 1.8) ** 2)) * 30;
    return Math.round(135 + 70 * cycle + rush + (this.aqiSeed - 0.5) * 60);
  }

  /** CPCB (India) AQI category and colour. */
  get aqiLabel() {
    const a = this.aqi;
    if (a <= 50) return ['Good', '#3bb54a'];
    if (a <= 100) return ['Satisfactory', '#a3c853'];
    if (a <= 200) return ['Moderate', '#f4d03f'];
    if (a <= 300) return ['Poor', '#f39c12'];
    if (a <= 400) return ['Very poor', '#e74c3c'];
    return ['Severe', '#8e1b1b'];
  }

  /** Traffic density 0..1: morning and evening rush, quiet after midnight. */
  get traffic() {
    const h = this.hour;
    const peak = Math.exp(-(((h - 9.75) / 1.5) ** 2)) + Math.exp(-(((h - 18.75) / 1.8) ** 2));
    const day = h > 7 && h < 23 ? 0.45 : h > 5.5 ? 0.25 : 0.12;
    return Math.min(1, day + peak * 0.55);
  }

  get label() {
    const h = Math.floor(this.hour), m = Math.floor((this.hour - h) * 60);
    const ampm = h < 12 ? 'AM' : 'PM';
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${ampm}`;
  }
}
