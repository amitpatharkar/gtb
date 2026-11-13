import * as THREE from 'three';
import { POSE, outfit } from '../sim/people.js';
import { LIGHT } from '../sim/signals.js';
import { POINT } from '../world/tileFormat.js';

// Side jobs and errands:
// - Taxi fares (Kidhar app or J): a passenger hails you nearby, you pick them up, the GPS
//   shows the way, and the fare depends on the meter, the time and how comfortable the
//   ride was (hard braking, crashes, potholes, horn spam, red lights and police chases
//   all annoy them). Good rides earn tips and stars.
// - Delivery riders bring food (Bhookh) and quick-commerce orders (JhatPat) to your window.
// - Stop next to a thela and press E to buy a snack.

const FARE_BASE = 33, FARE_KM = 22; // Mumbai kaali-peeli tariff (Sept 2026): ₹33 for the first 1.5 km
const rupees = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const pick = (a) => a[Math.floor(Math.random() * a.length)];

const PASSENGERS = [
  { kind: 'office', who: 'Office-goer in a hurry', hurry: 1.6, care: 0.8, tip: 1, lines: { hail: 'Taxi! Churchgate chaloge?', late: 'Jaldi chalo bhai, meeting hai!', rough: 'Arre aaraam se!', good: 'Badhiya, time pe pahuncha diya!' } },
  { kind: 'sari', who: 'Aunty with shopping bags', hurry: 0.7, care: 1.6, tip: 0.8, lines: { hail: 'Taxi! Bhaiya, meter se chalo.', late: 'Itna ghuma kyun rahe ho?', rough: 'Dheere! Saaman gir jayega!', good: 'Jeete raho beta!' } },
  { kind: 'casual', who: 'College student', hurry: 1.1, care: 0.9, tip: 0.3, lines: { hail: 'Taxi! Bhai, sasta mein chalo na.', late: 'Lecture miss ho jayega yaar!', rough: 'Bhai, Need for Speed nahi hai!', good: 'Mast chalaya bhai!' } },
  { kind: 'office', who: 'Businessman', hurry: 1.3, care: 1.2, tip: 2.2, lines: { hail: 'Taxi! Jaldi, important deal hai.', late: 'Time is money, bhai!', rough: 'Phone pe hoon, dhyan se!', good: 'Keep the change. Shabash!' } },
  { kind: 'casual', who: 'Tourist', hurry: 0.6, care: 1.1, tip: 1.6, lines: { hail: 'Taxi! Gateway of India… far?', late: 'Long way around, no?', rough: 'Whoa! Easy!', good: 'Amazing city! Thank you!' } },
];

// Bhookh delivery partner: pick the order up at a thela, deliver it hot. "Comfort" is the food.
const DELIVERY = { kind: 'worker', who: 'Bhookh order', hurry: 1.5, care: 1.2, tip: 0.6, delivery: true, lines: { hail: 'Order ready! Bhookh wala?', late: '(Customer is calling… food is getting cold)', rough: '(Chutney spilled…)', good: 'Garam garam! 5 star, bhai!' } };

export class Jobs {
  constructor({ scene, tiles, traffic, signals, people, bubbles, audio, police, cityMap, state, hud, street }) {
    Object.assign(this, { scene, tiles, traffic, signals, people, bubbles, audio, police, cityMap, state, hud, street });
    this.onDuty = false;
    this.ride = null;     // { stage: 'pickup'|'ride', passenger, ... }
    this.riders = [];     // delivery riders walking to the taxi
    this.cooldown = 0;
    this.panel = document.getElementById('job');
  }

  // ------------------------------------------------------------------ taxi duty
  toggleDuty(player, mode = 'taxi') {
    if (this.onDuty && this.mode !== mode) { this.onDuty = false; this.ride = null; this.cityMap.setWaypoint(null); }
    this.mode = mode;
    if (this.onDuty) {
      if (this.ride?.stage === 'ride') this.endRide(player, 'abandon');
      this.ride = null;
      this.onDuty = false;
      this.cityMap.setWaypoint(null);
      this.hud.message('Off duty. Meter up.');
    } else {
      this.onDuty = true;
      this.cooldown = 2;
      this.hud.message(mode === 'delivery' ? 'Bhookh partner: online. Orders will come in soon.' : 'On duty: FOR HIRE. A fare will hail you soon.');
    }
    this.renderPanel(player);
  }

  /** A spot on a footpath 80–260 m away where a passenger stands and waves. */
  findSpot(player, min, max) {
    const segs = this.traffic.segList;
    for (let tries = 0; tries < 80 && segs.length; tries++) {
      const seg = segs[Math.floor(Math.random() * segs.length)], s = seg.s;
      if (seg.len < 8) continue;
      const mx = (s[0] + s[2]) / 2, mz = (s[1] + s[3]) / 2;
      const d = Math.hypot(mx - player.pos.x, mz - player.pos.z);
      if (d < min || d > max) continue;
      const side = Math.random() < 0.5 ? 1 : -1;
      const fx = (s[2] - s[0]) / seg.len, fz = (s[3] - s[1]) / seg.len;
      const lx = fz * side, lz = -fx * side, off = s[4] + 0.9;
      const x = mx + lx * off, z = mz + lz * off;
      if (this.tiles.hits(x, z, 0.3) || this.tiles.roadAt(x, z, 0.2, true)) continue;
      return { x, z, roadX: mx + lx * (s[4] - 1.2), roadZ: mz + lz * (s[4] - 1.2), heading: Math.atan2(-lx, -lz) };
    }
    return null;
  }

  /** A destination far enough away, on the road graph, with a place name. */
  async findDestination(player) {
    const n = await this.cityMap.randomPlace(player.pos.x, player.pos.z, 700, 2600);
    return n ? { x: n.x, z: n.z, name: this.placeName(n.x, n.z) } : null;
  }

  placeName(x, z) {
    const idx = this.cityMap.index;
    let best = null, bd = Infinity;
    for (const [name, lat, lon] of [
      ['Colaba Causeway', 18.9155, 72.8255], ['Cuffe Parade', 18.9145, 72.8205], ['Gateway (Apollo Bunder)', 18.9218, 72.8343], ['Nariman Point', 18.9255, 72.8225],
      ['Fort, Hutatma Chowk', 18.9330, 72.8325], ['Ballard Estate', 18.9395, 72.8425], ['Churchgate station', 18.9335, 72.8265], ['Marine Drive', 18.9440, 72.8230],
      ['CST station', 18.9400, 72.8355], ['Crawford Market', 18.9475, 72.8340], ['Kalbadevi', 18.9485, 72.8290], ['Girgaon Chowpatty', 18.9545, 72.8150],
      ['Malabar Hill', 18.9560, 72.8040], ['Dongri', 18.9580, 72.8370], ['Grant Road', 18.9630, 72.8160], ['Mazgaon', 18.9660, 72.8450], ['Charni Road', 18.9520, 72.8190],
      ['Metro Cinema junction', 18.9430, 72.8290], ['Regal Circle', 18.9255, 72.8320], ['Sassoon Dock', 18.9115, 72.8255],
      // The island city north of Byculla and the suburbs (real places, parody names for famous ones).
      ['Byculla station', 18.9765, 72.8325], ['Haji Aali Shrine', 18.9805, 72.8105], ['Mahalaxmi station', 18.9825, 72.8240],
      ['Lower Parel mills', 18.9970, 72.8270], ['Worli Sea Face', 19.0150, 72.8165], ['Worli Koliwada', 19.0237, 72.8168],
      ['Siddhi-Vinayaka Mandir', 19.0169, 72.8303], ['Parel, Lalbaug', 18.9960, 72.8410], ['Dadar station', 19.0190, 72.8435],
      ['Shivaji Park', 19.0270, 72.8385], ['Matunga, Five Gardens', 19.0255, 72.8560], ['Mahim', 19.0400, 72.8410],
      ['Dharavi', 19.0440, 72.8555], ['Sion circle', 19.0415, 72.8635], ['Bandra Bandstand', 19.0505, 72.8215],
      ['Bandra, Hill Road', 19.0556, 72.8330], ['Bandra station', 19.0545, 72.8405], ['Carter Road', 19.0650, 72.8228],
      ['BKC', 19.0650, 72.8650], ['Khar, Linking Road', 19.0700, 72.8350], ['Santacruz station', 19.0820, 72.8410],
      ['Juhu Beach', 19.0980, 72.8265], ['Juhu Tara Road', 19.1040, 72.8275], ['Vile Parle', 19.0995, 72.8440],
      ['Chhatrapati Udaan Airport', 19.0990, 72.8740], ['Kurla station', 19.0655, 72.8790], ['Andheri station', 19.1197, 72.8464],
      ['Andheri, Lokhandwala', 19.1420, 72.8270], ['Marol', 19.1180, 72.8790], ['Saki Naka', 19.1035, 72.8880],
      ['Chembur', 19.0600, 72.8990], ['Ghatkopar station', 19.0860, 72.9080], ['Powai Lake', 19.1241, 72.8977],
      ['Hiranandani Gardens', 19.1170, 72.9100],
    ]) {
      const px = (lon - idx.origin.lon) * idx.metresPerDegree.lon, pz = -(lat - idx.origin.lat) * idx.metresPerDegree.lat;
      const d = Math.hypot(px - x, pz - z);
      if (d < bd) { bd = d; best = name; }
    }
    return best || 'the address';
  }

  /** A thela 120-450 m away to pick a Bhookh order up from. */
  findStall(player) {
    const out = [];
    for (const t of this.tiles.tiles.values()) {
      const arr = t.points[POINT.STALL];
      if (!arr) continue;
      for (let i = 0; i < arr.length; i += 5) {
        const x = arr[i] + t.origin[0], z = arr[i + 2] + t.origin[1], d = Math.hypot(x - player.pos.x, z - player.pos.z);
        if (d > 120 && d < 450) out.push([x, z]);
      }
    }
    if (!out.length) return null;
    const [x, z] = pick(out);
    const r = this.tiles.roadAt(x, z, 12, true);
    if (!r) return null;
    const sg = this.tiles.segment(r.tile, r.index);
    const ax = sg[2] - sg[0], az = sg[3] - sg[1], l = Math.hypot(ax, az) || 1;
    const t = Math.max(0, Math.min(1, ((x - sg[0]) * ax + (z - sg[1]) * az) / (l * l)));
    const rx = sg[0] + ax * t, rz = sg[1] + az * t;
    return { x: x + (rx - x) * 0.3, z: z + (rz - z) * 0.3, roadX: rx, roadZ: rz, heading: Math.atan2(rx - x, rz - z) };
  }

  spawnFare(player) {
    const delivery = this.mode === 'delivery';
    const spot = delivery ? this.findStall(player) : this.findSpot(player, 80, 260);
    if (!spot) return;
    const type = delivery ? DELIVERY : pick(PASSENGERS);
    const person = { ...outfit(type.kind), x: spot.x, z: spot.z, y: this.tiles.groundHeight(spot.x, spot.z), heading: spot.heading, phase: 0, pose: POSE.WAVE, amp: 1, flags: type.kind === 'sari' ? 2 : 0, scale: 1, h: 2.2 };
    this.ride = { stage: 'pickup', type, person, spot, t: 0, wait: 0 };
    this.cityMap.routeTo(spot.roadX, spot.roadZ, 'Passenger');
    const dist = Math.round(Math.hypot(spot.x - player.pos.x, spot.z - player.pos.z));
    this.hud.message(delivery ? 'New Bhookh order! Pick it up at the thela (GPS).' : `Fare request: ${type.who}. Follow the GPS to pick them up.`);
    this.state.message(delivery ? 'Bhookh Partner' : 'Kidhar Partner', delivery ? `New order to pick up, ${dist} m away.` : `New ride request: ${type.who}, ${dist} m away.`);
  }

  async startRide(player) {
    const r = this.ride;
    const dest = await this.findDestination(player);
    if (!dest || this.ride !== r) return;
    r.stage = 'ride';
    r.dest = dest;
    r.t = 0;
    r.dist = 0;
    r.comfort = 100;
    r.complaintT = 0;
    const straight = Math.hypot(dest.x - player.pos.x, dest.z - player.pos.z);
    r.eta = (straight * 1.35) / 7.5 + 25; // seconds at a normal city pace
    r.last = { speed: player.speed, heading: player.heading, x: player.pos.x, z: player.pos.z };
    await this.cityMap.routeTo(dest.x, dest.z, dest.name);
    if (r.type.delivery) { this.bubbles.say(r.person, 'Yeh lo, garam hai! Jaldi pahunchana!', 2.6, 'vendor'); this.hud.message(`Order picked up. Deliver to ${dest.name} — drive smoothly, it's hot food.`); }
    else { this.bubbles.say(player.pos, `${dest.name} chalo!`, 2.6, 'driver'); this.hud.message(`Take them to ${dest.name}. Meter down!`); }
  }

  annoy(amount, line, player, reason = null) {
    const r = this.ride;
    if (reason && amount > 0.02) { r.reason = reason; r.reasonT = 1.5; }
    const extras = (this.state.owns('perfume') ? 0.85 : 1) * (this.state.owns('seatcovers') ? 0.85 : 1);
    r.comfort = Math.max(0, r.comfort - amount * r.type.care * extras);
    if (line && r.complaintT <= 0) { this.bubbles.say(player.pos, line, 2.4, 'driver'); r.complaintT = 4; }
  }

  updateRide(dt, player) {
    const r = this.ride;
    r.t += dt;
    r.complaintT -= dt;
    r.reasonT = (r.reasonT || 0) - dt;
    const P = player.pos;
    if (r.stage === 'pickup') {
      r.person.phase += dt * 3;
      r.person.y = this.tiles.groundHeight(r.person.x, r.person.z);
      const d = Math.hypot(r.person.x - P.x, r.person.z - P.z);
      if (d < 40 && !r.waved) { r.waved = true; this.bubbles.say(r.person, r.type.lines.hail, 3); }
      if (d < 7 && Math.abs(player.speed) < 1) {
        r.wait += dt;
        r.person.pose = POSE.WALK;
        const dx = P.x - r.person.x, dz = P.z - r.person.z, l = Math.hypot(dx, dz);
        const s = Math.min(l, 1.4 * dt);
        r.person.x += (dx / l) * s; r.person.z += (dz / l) * s; r.person.heading = Math.atan2(dx, dz);
        r.person.phase += dt * 5;
        if ((l < 1.6 || r.wait > 4) && !r.starting) { r.starting = true; this.startRide(player); }
      } else r.wait = 0;
      if (r.t > 150) { this.hud.message('The passenger got tired of waiting and took another taxi.'); this.ride = null; this.cooldown = 8; this.cityMap.setWaypoint(null); }
      if (r.stage === 'pickup' && !r.starting) this.people.add(r.person); // once they get in, they're in the taxi
      return;
    }
    if (r.stage !== 'ride' || !r.dest) return;
    // Comfort: jerks, hard braking, sharp turns at speed, crashes, bumps, horn, police.
    const accel = (player.speed - r.last.speed) / Math.max(dt, 1e-3);
    let dh = player.heading - r.last.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    const lateral = Math.abs((dh / Math.max(dt, 1e-3)) * player.speed);
    if (accel < -11.5 && player.speed > 3) this.annoy(10 * dt, r.type.lines.rough, player, 'Hard braking');
    if (accel > 4.8 && player.speed > 4) this.annoy(1.5 * dt, null, player, 'Jerky acceleration');
    if (lateral > 8.5) this.annoy(3 * dt * (lateral - 8.5), r.type.lines.rough, player, 'Sharp turn at speed');
    if (r.last.speed - Math.abs(player.speed) > 3) this.annoy(14, 'Arre! Thok di gaadi!', player, 'Crash!');
    if (player.bumped) { player.bumped = false; this.annoy(2.5, pick(['Gaddha!', 'Uff, yeh roads…', r.type.lines.rough]), player, 'Pothole / kerb'); }
    if (this.police.stars > 0) this.annoy(2 * dt, 'Police?! Mujhe utaar do!', player, 'Police chase');
    if (this.police.offences > (r.offences ?? this.police.offences)) this.annoy(10, 'Arre bhai, signal tha!', player, 'Broke a traffic rule');
    r.offences = this.police.offences;
    if (player.speed > 22) this.annoy(1.5 * dt, 'Bhai, dheere! Jaan pyaari hai!', player, 'Too fast');
    if (r.t > r.eta && r.complaintT <= 0 && Math.random() < dt * 0.15) this.annoy(2, r.type.lines.late, player);
    r.dist += Math.hypot(P.x - r.last.x, P.z - r.last.z);
    r.last = { speed: player.speed, heading: player.heading, x: P.x, z: P.z };
    // Arrived: stop near the destination.
    const left = Math.hypot(r.dest.x - P.x, r.dest.z - P.z);
    if (left < 22 && Math.abs(player.speed) < 1) this.endRide(player, 'done');
  }

  honk() { if (this.ride?.stage === 'ride') this.annoy(1.5, pick(['Itna horn kyun?', 'Kaan pak gaye!']), { pos: this.lastPlayerPos || { x: 0, z: 0 } }, 'Horn'); }

  endRide(player, how) {
    const r = this.ride;
    this.ride = null;
    this.cityMap.setWaypoint(null);
    this.cooldown = 6 + Math.random() * 10;
    if (how === 'abandon') {
      this.hud.message('The passenger got out angry. No fare.');
      this.state.s.rides++; this.state.s.ratingSum += 1;
      return;
    }
    const km = r.dist / 1000;
    const meter = r.type.delivery ? 45 + km * 12 : FARE_BASE + Math.max(0, km - 1.5) * FARE_KM;
    const late = Math.max(0, r.t - r.eta) / r.eta;
    let stars = 5 - (100 - r.comfort) / 22 - late * 2 * r.type.hurry;
    stars = Math.max(1, Math.min(5, stars));
    let tip = 0, cut = 0;
    if (stars >= 4.3) tip = Math.round(meter * 0.15 * r.type.tip + 10 * r.type.tip);
    if (r.comfort < 45) cut = Math.round(meter * 0.25);
    if (late > 0.5) cut += Math.round(meter * 0.1);
    const bonus = r.type.delivery ? 0 : 40; // Kidhar pays drivers a per-ride incentive on top of the meter
    const total = Math.max(0, Math.round(meter + tip - cut + bonus));
    this.state.earn(total, r.type.delivery ? `Bhookh delivery to ${r.dest.name}` : `Taxi fare to ${r.dest.name}`);
    this.state.s.rides++;
    this.state.s.ratingSum += stars;
    this.state.s.earned += total;
    const line = stars >= 4 ? r.type.lines.good : stars >= 2.5 ? 'Theek hai.' : 'Kabhi nahi baithunga tumhari taxi mein!';
    this.bubbles.say(player.pos, line, 3, 'driver');
    this.hud.message(`${r.type.delivery ? `Delivery pay ${rupees(meter)}` : `Fare ${rupees(meter)} + Kidhar bonus ${rupees(bonus)}`}${tip ? ` + tip ${rupees(tip)}` : ''}${cut ? ` − ${rupees(cut)} (${r.type.delivery ? 'cold or spilled food' : 'unhappy'})` : ''} = ${rupees(total)} · ${'★'.repeat(Math.round(stars))}${'☆'.repeat(5 - Math.round(stars))}`);
    this.state.message('PayKaro', `Credited ${rupees(total)} for a ride to ${r.dest.name}. Rating ${stars.toFixed(1)}★.`);
  }

  // ------------------------------------------------------------------ deliveries to the window
  order(app, items, player) {
    const eta = app === 'jhatpat' ? 40 + Math.random() * 30 : 70 + Math.random() * 60; // real seconds
    const look = outfit('casual');
    look.shirt = new THREE.Color(app === 'jhatpat' ? 0x2e9e44 : 0xf26722);
    this.riders.push({ app, items, eta, t: 0, look, state: 'coming', person: null });
    this.state.message(app === 'jhatpat' ? 'JhatPat' : 'Bhookh', `Order placed: ${items.map((i) => i.name).join(', ')}. Arriving in about ${Math.round(eta / 60 * 10) / 10 < 1 ? '1' : Math.ceil(eta / 60)} min at your location.`);
  }

  updateRiders(dt, player) {
    for (const r of [...this.riders]) {
      r.t += dt;
      if (r.state === 'coming' && r.t >= r.eta) {
        const spot = this.findSpot(player, 15, 40) || { x: player.pos.x + 15, z: player.pos.z };
        r.person = { ...r.look, x: spot.x, z: spot.z, y: 0.2, heading: 0, phase: 0, pose: POSE.WALK, amp: 1.2, flags: 0, scale: 1, h: 2.2 };
        r.state = 'walking';
        this.hud.message(`${r.app === 'jhatpat' ? 'JhatPat' : 'Bhookh'} delivery partner is here — stop the taxi!`);
      }
      if (r.state === 'walking' || r.state === 'leaving') {
        const p = r.person;
        const fx = Math.sin(player.heading), fz = Math.cos(player.heading);
        const tx = r.state === 'walking' ? player.pos.x - fz * 1.3 : r.leaveX, tz = r.state === 'walking' ? player.pos.z + fx * 1.3 : r.leaveZ;
        const dx = tx - p.x, dz = tz - p.z, l = Math.hypot(dx, dz);
        if (l > 60 && r.state === 'walking') { p.x = tx - (dx / l) * 30; p.z = tz - (dz / l) * 30; } // the rider catches up by bike
        if (l > 0.5) { const s = Math.min(l, 3.2 * dt); p.x += (dx / l) * s; p.z += (dz / l) * s; p.heading = Math.atan2(dx, dz); p.pose = POSE.WALK; p.phase += dt * 8; }
        else if (r.state === 'walking') {
          if (Math.abs(player.speed) < 1) this.deliver(r, player);
        } else { this.riders.splice(this.riders.indexOf(r), 1); continue; }
        p.y = this.tiles.groundHeight(p.x, p.z);
        this.people.add(p);
      }
    }
  }

  deliver(r, player) {
    r.state = 'leaving';
    r.leaveX = r.person.x + (r.person.x - player.pos.x) * 15; r.leaveZ = r.person.z + (r.person.z - player.pos.z) * 15;
    this.bubbles.say(r.person, pick(['Order aa gaya, saheb! 5 star dena!', 'Aapka order! Rating zaroor dena.', 'Garam garam, enjoy!']), 3);
    const notes = [];
    for (const it of r.items) {
      if (it.hunger) this.state.eat(it.hunger);
      if (it.energy) this.state.rest(it.energy);
      const taxi = this.taxi || player;
      if (it.fuel) taxi.fuel = Math.min(1, taxi.fuel + it.fuel);
      if (it.repair) taxi.condition = Math.min(1, taxi.condition + it.repair);
      notes.push(it.name);
    }
    this.hud.message(`Delivered: ${notes.join(', ')}`);
  }

  // ------------------------------------------------------------------ snacks at thelas
  buySnack(player) {
    if (Math.abs(player.speed) > 1) return false;
    for (const f of this.street.fixtures.values()) {
      if (f.type !== 'stall' || !f.people.length) continue;
      if (Math.hypot(f.x - player.pos.x, f.z - player.pos.z) > 9) continue;
      const menu = [['Vada pav', 20, 0.25, 0], ['Cutting chai', 15, 0.05, 0.25], ['Bhutta', 30, 0.2, 0], ['Pav bhaji', 120, 0.55, 0.05], ['Nimbu paani', 25, 0.05, 0.15], ['Fruit plate', 60, 0.3, 0.05]];
      const [name, price, hunger, energy] = pick(menu);
      if (!this.state.canAfford(price)) { this.hud.message(`₹${price} for ${name.toLowerCase()} — you're broke. Drive some fares (J).`); return true; }
      this.state.pay(price, name);
      this.state.eat(hunger); this.state.rest(energy);
      this.bubbles.say(f.people[0], `Ek ${name.toLowerCase()}, ${rupees(price)}!`, 2.5, 'vendor');
      this.hud.message(`${name} — ${rupees(price)}. Hunger and energy up.`);
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------------ frame
  update(dt, player) {
    this.lastPlayerPos = player.pos;
    if (this.onDuty && !this.ride) {
      this.cooldown -= dt;
      if (this.cooldown <= 0) { this.cooldown = 5; this.spawnFare(player); }
    }
    if (this.ride) this.updateRide(dt, player);
    this.updateRiders(dt, this.focus || player);
    this.renderPanel(player);
  }

  renderPanel(player) {
    const el = this.panel;
    if (!el) return;
    const r = this.ride;
    if (!this.onDuty && !this.riders.length) { el.hidden = true; return; }
    el.hidden = false;
    const rows = [];
    if (this.onDuty && !r) rows.push(this.mode === 'delivery' ? '<b class="hire">BHOOKH PARTNER</b> waiting for an order…' : '<b class="hire">FOR HIRE</b> waiting for a fare…');
    if (r?.stage === 'pickup') rows.push(`<b>Pick up:</b> ${r.type.who} · ${Math.round(Math.hypot(r.person.x - player.pos.x, r.person.z - player.pos.z))} m`);
    if (r?.stage === 'ride' && r.dest) {
      const km = r.dist / 1000, meter = r.type.delivery ? 45 + km * 12 : FARE_BASE + Math.max(0, km - 1.5) * FARE_KM;
      const left = Math.round(Math.hypot(r.dest.x - player.pos.x, r.dest.z - player.pos.z));
      const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
      const late = r.t > r.eta;
      const c = Math.round(r.comfort);
      rows.push(`<b>To:</b> ${r.dest.name} · ${left} m`);
      rows.push(`<b>${r.type.delivery ? 'Pay' : 'Meter'}</b> ${rupees(meter)} · <b>Time</b> <span class="${late ? 'bad' : ''}">${fmt(r.t)}</span> / ${fmt(r.eta)} · ${Math.round(Math.abs(player.speed) * 3.6)} km/h`);
      rows.push(`<b>${r.type.delivery ? 'Food' : 'Comfort'}</b> <span class="bar"><i style="width:${c}%;background:${c > 70 ? '#4caf50' : c > 40 ? '#f4d03f' : '#e74c3c'}"></i></span> ${c}%${r.reasonT > 0 ? ` <span class="bad">▼ ${r.reason}</span>` : ''}`);
    }
    for (const d of this.riders) if (d.state === 'coming') rows.push(`${d.app === 'jhatpat' ? '🟢 JhatPat' : '🟠 Bhookh'} order: ${Math.max(0, Math.ceil(d.eta - d.t))} s`);
    else if (d.state === 'walking') rows.push(`${d.app === 'jhatpat' ? '🟢' : '🟠'} Delivery partner is here — stop to collect`);
    el.innerHTML = rows.join('<br>');
  }
}
