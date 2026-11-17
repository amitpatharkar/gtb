// Headless smoke tests for the built game (dist/). Run after `npm run build`:
//   node tests/smoke.mjs            all checks on the Low tier
//   node tests/smoke.mjs --only=boot,drive --quality=medium
//   checks: boot, drive, traffic, steal, missions, trains, night, touch (phone controls)
// Needs Playwright with Chromium (a devDependency: `npx playwright install chromium`; a global
// install found through NODE_PATH works too). In CI it runs inside deploy.yml, before the deploy.
// Serves dist/ the way GitHub Pages does (under /gtb/, .gz files as plain application/gzip)
// and drives the game through window.__gtb with the simulation stepped by hand (headless
// rendering is far too slow to play in real time). Exits non-zero if any check fails.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// require() so a globally installed Playwright (NODE_PATH) is found too.
const { chromium } = createRequire(import.meta.url)('playwright');

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const only = args.only ? String(args.only).split(',') : null;
const quality = args.quality || 'low';
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
if (!fs.existsSync(path.join(dist, 'index.html'))) { console.error('dist/ is missing: run npm run build first'); process.exit(2); }

// ---------------------------------------------------------------- static server (like Pages)
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.gz': 'application/gzip', '.ktx2': 'image/ktx2', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.hdr': 'application/octet-stream', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.bin': 'application/octet-stream' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (!url.startsWith('/gtb/')) { res.writeHead(404); res.end(); return; }
  let file = path.join(dist, url.slice(5));
  if (!file.startsWith(dist)) { res.writeHead(403); res.end(); return; }
  try { if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html'); } catch { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}/gtb/`;

// ---------------------------------------------------------------- harness
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
async function game(query = '', { touch = false } = {}) {
  // touch: a landscape phone (touch screen, coarse pointer) instead of a desktop window.
  const page = await browser.newPage(touch ? { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true } : { viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(`${e.message} @ ${(e.stack || '').split('\n')[1] || ''}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${base}?quality=${quality}&${query}`);
  await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 180000 });
  await page.evaluate(() => window.__gtb.renderer.setAnimationLoop(null));
  return { page, errors };
}
async function check(name, fn) {
  if (only && !only.includes(name)) return;
  const t0 = Date.now();
  try {
    const out = await fn();
    const fails = out.fails || [];
    results.push({ name, ok: !fails.length, secs: ((Date.now() - t0) / 1000).toFixed(0), info: out.info, fails });
  } catch (e) { results.push({ name, ok: false, secs: ((Date.now() - t0) / 1000).toFixed(0), fails: [String(e.message || e).split('\n')[0]] }); }
  const r = results[results.length - 1];
  console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${name} (${r.secs} s) ${r.info ? JSON.stringify(r.info) : ''}${r.fails.length ? `\n     ${r.fails.join('\n     ')}` : ''}`);
}
const noErrors = (errors) => errors.filter((e) => !/KHR_parallel_shader_compile/.test(e)).map((e) => `console: ${e}`);

// ---------------------------------------------------------------- checks
await check('boot', async () => {
  const { page, errors } = await game('hour=10');
  const info = await page.evaluate(() => { const g = window.__gtb; for (let i = 0; i < 40; i++) g.step(0.05); g.post.render(); return { tier: g.tier.name, tiles: g.tiles.loadedCount, cars: g.traffic.cars.length, peds: g.street.peds.length }; });
  await page.close();
  const fails = noErrors(errors);
  if (!info.tiles) fails.push('no tiles loaded');
  if (!info.cars) fails.push('no traffic');
  return { info, fails };
});

await check('drive', async () => {
  // Drive across many tiles; the worst simulation step must stay small (stutter guard).
  const { page, errors } = await game('hour=11');
  const info = await page.evaluate(async () => {
    const g = window.__gtb;
    let worst = 0, sum = 0, n = 0;
    g.input.fwd = true;
    for (let leg = 0; leg < 10; leg++) {
      for (let i = 0; i < 60; i++) {
        const t = performance.now(); g.step(1 / 60); const d = performance.now() - t;
        if (leg > 0) { worst = Math.max(worst, d); sum += d; n++; }
        if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0));
      }
      const h = g.player.heading, x = g.player.pos.x + Math.sin(h) * 300, z = g.player.pos.z + Math.cos(h) * 300;
      const rd = g.tiles.roadAt(x, z, 120, true);
      if (rd) { const s = g.tiles.segment(rd.tile, rd.index); g.player.pos.set((s[0] + s[2]) / 2, 0.02, (s[1] + s[3]) / 2); g.player.heading = Math.atan2(s[2] - s[0], s[3] - s[1]); } else g.player.heading += 1.2;
    }
    g.input.fwd = false;
    const p = g.player.pos;
    return { meanMs: +(sum / n).toFixed(2), worstMs: +worst.toFixed(1), finite: Number.isFinite(p.x + p.y + p.z) };
  });
  await page.close();
  const fails = noErrors(errors);
  if (!info.finite) fails.push('player position is not finite');
  if (info.worstMs > 60) fails.push(`worst step ${info.worstMs} ms (stutter)`);
  return { info, fails };
});

await check('traffic', async () => {
  // India keeps left: almost no car on the wrong side of a two-way road except while overtaking.
  const { page, errors } = await game('hour=10');
  const info = await page.evaluate(async () => {
    const g = window.__gtb, ix = g.tiles.index;
    const x = (72.8435 - ix.origin.lon) * ix.metresPerDegree.lon, z = -(19.0190 - ix.origin.lat) * ix.metresPerDegree.lat; // Dadar
    await g.tiles.whenReady(x, z, 300); g.player.pos.set(x, 0.02, z);
    for (let i = 0; i < 300; i++) g.step(0.05);
    let samples = 0, wrong = 0, overlaps = 0;
    for (let i = 0; i < 400; i++) {
      g.step(0.05);
      if (i % 10) continue;
      for (const c of g.traffic.cars) {
        if (c.knock > 0) continue;
        samples++;
        if (!(c.seg.s[5] & 2) && c.lane < -0.3 && !c.overtake) wrong++;
        for (const o of g.traffic.cars) if (o !== c && Math.hypot(o.x - c.x, o.z - c.z) < 1.4 && !g.traffic.types[o.type].rider && !g.traffic.types[c.type].rider) overlaps++;
      }
    }
    return { samples, wrongSidePct: +(100 * wrong / Math.max(1, samples)).toFixed(2), overlapPairs: overlaps / 2 };
  });
  await page.close();
  const fails = noErrors(errors);
  if (info.samples < 200) fails.push('too little traffic');
  if (info.wrongSidePct > 1) fails.push(`${info.wrongSidePct} % of cars on the wrong side`);
  return { info, fails };
});

await check('steal', async () => {
  // On foot, F a few metres from a moving car: run to the driver's door, pull the driver out, drive off.
  const { page, errors } = await game('hour=11');
  const info = await page.evaluate(() => {
    const g = window.__gtb;
    g.story.s.done = g.story.missions.map((m) => m.id); // no mission marker by the spawn (driving into it starts a cutscene)
    for (let i = 0; i < 200; i++) g.step(0.05);
    g.toggleFoot(); for (let i = 0; i < 3; i++) g.step(0.05);
    // A car with open road ahead, not pointing at the player's parked taxi (it would drive into it).
    const clearAhead = (c) => { const fx = Math.sin(c.heading), fz = Math.cos(c.heading); for (let d = 4; d <= 24; d += 2) if (g.tiles.hits(c.x + fx * d, c.z + fz * d, 1.2)) return false; return fx * (c.x - g.player.pos.x) + fz * (c.z - g.player.pos.z) > 0; };
    const car = g.traffic.cars.filter((c) => !g.traffic.types[c.type].rider && Math.hypot(c.x - g.player.pos.x, c.z - g.player.pos.z) > 12 && clearAhead(c)).sort((a, b) => Math.hypot(a.x - g.walker.pos.x, a.z - g.walker.pos.z) - Math.hypot(b.x - g.walker.pos.x, b.z - g.walker.pos.z))[0];
    if (!car) return { car: null };
    const T = g.traffic.types[car.type], h = car.heading;
    g.walker.pos.set(car.x - Math.cos(h) * (T.wid / 2 + 3.5), 0.2, car.z + Math.sin(h) * (T.wid / 2 + 3.5));
    // Only this car within reach (kerbside parking would otherwise be nearer), and a clear road ahead.
    const clear = (list) => { for (let i = list.length - 1; i >= 0; i--) if (list[i] !== car && Math.hypot(list[i].x - car.x, list[i].z - car.z) < 40) list.splice(i, 1); };
    clear(g.traffic.parked); clear(g.traffic.cars); clear(g.traffic.left);
    g.step(0.05);
    const target = g.garage.nearest(g.walker.pos.x, g.walker.pos.z, 7);
    if (!target || target.v !== car) return { car: car.type, wrongTarget: target ? target.kind + ':' + target.v.type : 'none' };
    const peds = g.street.peds.length;
    g.toggleFoot();
    let n = 0; for (; n < 120 && g.onFoot; n++) g.step(0.05);
    const type = g.garage.type;
    // Peak speed: the stolen vehicle may drive off and then bump into something within the 2 s.
    let top = 0;
    g.input.fwd = true; for (let i = 0; i < 40; i++) { g.step(0.05); top = Math.max(top, Math.abs(g.player.speed)); } g.input.fwd = false;
    return { car: car.type, took: !g.onFoot && type === car.type, secs: +(n * 0.05).toFixed(1), driverOut: g.street.peds.filter((p) => p.kind === 'driver').length, speed: +top.toFixed(1) };
  });
  await page.close();
  const fails = noErrors(errors);
  if (!info.car) fails.push('no car to steal');
  else if (info.wrongTarget) fails.push('F would take ' + info.wrongTarget);
  else { if (!info.took) fails.push('did not get into the car'); if (info.driverOut < 1) fails.push('driver was not pulled out'); if (info.speed < 3) fails.push('stolen car did not drive'); }
  return { info, fails };
});

await check('missions', async () => {
  // Every mission plays through end to end (steps completed by teleporting, the way a player would).
  const { page, errors } = await game('hour=11');
  const res = await page.evaluate(async () => {
    const g = window.__gtb, S = g.story, T = g.THREE, out = [];
    for (let i = 0; i < 10; i++) g.step(0.05);
    const tp = async (x, z) => {
      await g.tiles.whenReady(x, z, 260);
      const rd = g.tiles.roadAt(x, z, 60, true);
      let px = x, pz = z;
      if (rd) { const s = g.tiles.segment(rd.tile, rd.index); const dx = s[2] - s[0], dz = s[3] - s[1], l2 = dx * dx + dz * dz || 1; const k = Math.max(0, Math.min(1, ((x - s[0]) * dx + (z - s[1]) * dz) / l2)); px = s[0] + dx * k; pz = s[1] + dz * k; }
      const a = g.onFoot ? g.walker : g.player;
      a.pos.set(px, 0.02, pz); if (!g.onFoot) { a.speed = 0; a.vx = a.vz = 0; a.lastSpeed = 0; }
      for (let i = 0; i < 3; i++) g.step(0.05);
    };
    const give = (type) => {
      if (!g.onFoot) g.toggleFoot();
      const w = g.walker; w.pos.set(g.player.pos.x + 9, 0.2, g.player.pos.z + 9);
      g.traffic.left.push({ type, x: w.pos.x + (g.traffic.types[type].wid / 2 + 0.6), z: w.pos.z, heading: 0, tint: new T.Color(0xc0281f), taken: true, fuel: 1, condition: 1 });
      g.toggleFoot(); for (let i = 0; i < 80 && g.onFoot; i++) g.step(0.05);
    };
    const takeLent = (type) => {
      const v = g.traffic.left.find((q) => q.lent || q.type === type);
      if (!v) return;
      const Tt = g.traffic.types[type], h = v.heading;
      if (!g.onFoot) g.toggleFoot();
      g.walker.pos.set(v.x - Math.cos(h) * (Tt.wid / 2 + 0.7), g.walker.pos.y, v.z + Math.sin(h) * (Tt.wid / 2 + 0.7));
      // Passing traffic right at the door would be the nearer vehicle: keep the test about the lent one.
      for (let i = g.traffic.cars.length - 1; i >= 0; i--) if (Math.hypot(g.traffic.cars[i].x - v.x, g.traffic.cars[i].z - v.z) < 15) g.traffic.cars.splice(i, 1);
      g.step(0.05); g.toggleFoot(); for (let i = 0; i < 80 && g.onFoot; i++) g.step(0.05);
    };
    const needType = (st) => { if (typeof st.on === 'string' && g.traffic.types[st.on] && g.garage.type !== st.on && st.on !== 'swift') takeLent(st.on); };
    for (const m of S.missions) {
      const rec = { id: m.id };
      try {
        S.fail('test reset');
        S.s.done = S.missions.filter((x) => x.id !== m.id && (x.id !== 'ghar' || m.id === 'permit') && x.id !== 'permit').map((x) => x.id);
        if (g.onFoot) { g.walker.pos.set(g.player.pos.x + 1.5, 0.2, g.player.pos.z); g.toggleFoot(); }
        if (!g.garage.inTaxi) { g.toggleFoot(); g.garage.toTaxi(); if (g.onFoot) { g.walker.pos.set(g.player.pos.x + 1.5, 0.2, g.player.pos.z); g.toggleFoot(); } }
        g.clock.hour = m.hours ? (m.hours[0] + 0.5) % 24 : 11;
        await tp(m.at[0], m.at[1]);
        g.player.pos.set(m.at[0], 0.02, m.at[1]);
        for (let i = 0; i < 4 && S.s.active !== m.id; i++) g.step(0.05);
        if (S.s.active !== m.id) { rec.error = 'did not start'; out.push(rec); continue; }
        let guard = 0;
        while (S.s.active === m.id && guard++ < 400) {
          const st = m.steps[S.s.step];
          if (!st) break;
          if (S.camera) { S.skip(); g.step(0.05); continue; }
          const key = Object.keys(st).find((k) => ['goto', 'pickup', 'dropoff', 'waitHour', 'cargo', 'visit', 'race', 'catch', 'task', 'call', 'reward', 'lend', 'pay'].includes(k));
          if (key === 'goto') {
            needType(st);
            if (st.minCondition && st.on === 'taxi') { g.player.condition = 1; g.damage.repair?.(); }
            if (st.on === 'two' && !g.garage.rider) give('scooter');
            if (st.on === 'swift' && g.garage.type !== 'swift') give('swift');
            if (st.on === 'foot' && !g.onFoot) g.toggleFoot();
            const t = S.target; await tp(t[0], t[1]);
            const a = g.onFoot ? g.walker : g.player; a.pos.set(t[0], a.pos.y, t[1]); g.step(0.05);
          } else if (key === 'pickup') {
            needType(st);
            const p = S.person(st.pickup); g.player.pos.set(p.x + 2.5, 0.02, p.z); g.player.speed = 0; g.player.vx = g.player.vz = 0; g.player.lastSpeed = 0; g.step(0.05);
          } else if (key === 'pay') { g.state.s.money = Math.max(g.state.s.money, st.pay + 100); g.step(0.05); }
          else if (key === 'waitHour') { g.clock.hour = (st.waitHour[0] + st.waitHour[1]) / 2; g.step(0.05); }
          else if (key === 'visit') { needType(st); const t = S.todo.find((x) => !x.done); await tp(t.x, t.z); g.player.pos.set(t.x, 0.02, t.z); g.step(0.05); }
          else if (key === 'race') {
            if (!g.garage.rider) give('scooter');
            if (!S.armed) { g.player.speed = 6; g.player.vx = 0; g.player.vz = 6; g.player.lastSpeed = 6; g.step(0.016); }
            else { let c = S.cps[S.cp]; await tp(c[0], c[1]); g.step(0.05); c = S.cps[S.cp] || c; g.player.pos.set(c[0], 0.02, c[1]); g.step(0.05); }
          } else if (key === 'catch') { if (!g.onFoot) g.toggleFoot(); g.walker.pos.set(S.runner.x + 0.5, 0.2, S.runner.z); g.step(0.016); }
          else if (key === 'task') {
            if (st.task === 'rides') { g.state.s.rides += st.count; g.state.s.ratingSum += st.count * 4.5; g.step(0.05); }
            else if (st.task === 'colour') { if (!g.onFoot) g.toggleFoot(); for (let k = 0; k < 40 && g.street.peds.length < st.count; k++) g.step(0.05); g.street.peds.slice(0, st.count + 2).forEach((p) => (p.patches = [[0, 1, 0, 0]])); g.step(0.05); }
            else if (st.task === 'crackers') { if (!g.onFoot) g.toggleFoot(); for (const [k, n] of Object.entries(st.need)) for (let i = 0; i < n; i++) S.event('cracker', k); g.step(0.05); }
            else g.step(0.05);
          } else g.step(0.05);
        }
        rec.ok = S.s.done.includes(m.id);
        if (!rec.ok) rec.stuck = `${S.s.step}: ${document.getElementById('objective')?.textContent?.slice(0, 90)}`;
      } catch (e) { rec.error = e.message; }
      out.push(rec);
    }
    return out;
  });
  await page.close();
  const fails = [...noErrors(errors), ...res.filter((r) => !r.ok).map((r) => `${r.id}: ${r.error || r.stuck}`)];
  return { info: { missions: res.length, passed: res.filter((r) => r.ok).length }, fails };
});

await check('trains', async () => {
  // Local trains near Dadar: they appear, move along the track, and cost little per step.
  const { page, errors } = await game('hour=9');
  await page.waitForFunction(() => window.__gtb.trains, null, { timeout: 60000 });
  const info = await page.evaluate(async () => {
    const g = window.__gtb, T = g.trains;
    const st = T.lines.flatMap((l) => l.stations).find((s) => /dadar/i.test(s.name));
    if (!st) return { station: null };
    g.player.pos.set(st.x + st.fz * 40, 0.02, st.z - st.fx * 40);
    await g.tiles.whenReady(g.player.pos.x, g.player.pos.z, 250);
    for (let i = 0; i < 4; i++) g.step(0.05);
    const first = new Map([...T.trains.values()].map((t) => [t.key, [t.x, t.z]]));
    let worst = 0;
    for (let i = 0; i < 300; i++) { const t0 = performance.now(); g.step(0.05); worst = Math.max(worst, performance.now() - t0); }
    const now = [...T.trains.values()];
    const moved = now.filter((t) => first.has(t.key) && Math.hypot(t.x - first.get(t.key)[0], t.z - first.get(t.key)[1]) > 20).length;
    return { station: st.name, trains: now.length, moved, finite: now.every((t) => Number.isFinite(t.x) && Number.isFinite(t.z)), worstMs: +worst.toFixed(1), markers: T.markers().length };
  });
  await page.close();
  const fails = noErrors(errors);
  if (!info.station) fails.push('no Dadar station');
  else {
    if (info.trains < 1) fails.push('no trains near Dadar');
    if (info.moved < 1) fails.push('no train moved');
    if (!info.finite) fails.push('train position is not a number');
    if (info.worstMs > 60) fails.push(`worst step ${info.worstMs} ms`);
    if (info.markers < 10) fails.push('stations missing on the map');
  }
  return { info, fails };
});

await check('ride', async () => {
  // Board a local at Dadar with a ticket, ride it, skip ahead, get off; tickets and checkers work.
  const { page, errors } = await game('hour=9');
  await page.waitForFunction(() => window.__gtb.trains?.ride, null, { timeout: 60000 });
  const info = await page.evaluate(async () => {
    const g = window.__gtb, T = g.trains, R = T.ride;
    const st = T.stops.find((s) => s.name === 'Dadar' && s.line.route === 'W' && !s.line.fast && s.line.dir === 'up');
    if (!st) return { station: null };
    g.player.pos.set(st.x + st.fz * 30, 0.02, st.z - st.fx * 30);
    await g.tiles.whenReady(st.x, st.z, 250);
    g.toggleFoot();
    g.walker.pos.set(st.x, 0.3, st.z);
    g.state.s.money = 5000;
    // Wait for a train of this line standing at Dadar.
    let tr = null;
    for (let i = 0; i < 6000 && !tr; i++) {
      g.step(0.05);
      for (const t of T.trains.values()) if (t.line === st.line && t.leg?.station === st.i && t.n === 12 && t.leg.T - t.left > 3 && t.left > 6 && (!t.ac || t.doors > 0.9)) tr = t;
    }
    if (!tr) return { station: st.name, train: false };
    const bought = g.tickets.buy(g.tickets.local('Dadar', 'Churchgate', 10600, 'II', 'single'));
    // Stand at a door on the platform side and board.
    const i = 5, up = tr.line.dir === 'up', tx = up ? tr.sn[i] : -tr.sn[i], tz = up ? tr.cs[i] : -tr.cs[i], l = st.side === 2 || !st.side ? 1 : st.side;
    // st.side is right (1) / left (-1) of travel; the ride frame's right is that of the town-ward direction (the same for an up line).
    g.walker.pos.set(tr.cx[i] + tx * 6.6 - tz * l * 2.4, 1.3, tr.cz[i] + tz * 6.6 + tx * l * 2.4);
    const boarded = R.tryBoard() && R.active;
    const p0 = [g.walker.pos.x, g.walker.pos.z];
    for (let k = 0; k < 900 && R.active; k++) g.step(0.05);
    const moved = Math.hypot(g.walker.pos.x - p0[0], g.walker.pos.z - p0[1]);
    const target = R.target()?.name;
    await R.skip();
    for (let k = 0; k < 20; k++) g.step(0.05);
    const at = R.active ? R.stopOf(R.r.tr)?.name : null;
    const off = R.active && R.alight();
    let worst = 0;
    for (let k = 0; k < 100; k++) { const t0 = performance.now(); g.step(0.05); worst = Math.max(worst, performance.now() - t0); }
    return { station: st.name, train: true, ac: tr.ac, bought, boarded, moved: Math.round(moved), target, at, off, riding: R.active, tickets: g.tickets.list.length, money: g.state.s.money, worstMs: +worst.toFixed(1) };
  });
  await page.close();
  const fails = noErrors(errors);
  if (!info.station) fails.push('no Dadar stop');
  else if (!info.train) fails.push('no train stopped at Dadar');
  else {
    if (!info.bought) fails.push('could not buy a ticket');
    if (!info.boarded) fails.push('could not board');
    if (info.moved < 30) fails.push('the rider did not move with the train');
    if (!info.at || info.at !== info.target) fails.push(`skip ended at ${info.at}, wanted ${info.target}`);
    if (!info.off || info.riding) fails.push('could not get off');
    if (info.money !== 4990) fails.push(`wallet ${info.money}, expected 4990 (₹10 ticket, no fine)`);
    if (info.worstMs > 60) fails.push(`worst step ${info.worstMs} ms`);
  }
  return { info, fails };
});

await check('stations', async () => {
  // Raised platforms and foot overbridges: stand on a platform at its real height, climb a stair
  // to the bridge deck; building the biggest stations (Dadar, CSMT) costs no stutter.
  const { page, errors } = await game('hour=10');
  await page.waitForFunction(() => window.__gtb.stations && window.__gtb.trains, null, { timeout: 90000 });
  const info = await page.evaluate(async () => {
    const g = window.__gtb, S = g.stations, st = S.list.find((s) => s.name === 'Charni Road');
    if (!st) return { station: null };
    const all = st.decks.flatMap((d) => d.stairs);
    const s = all.find((q) => q.y1 > 1 && !q.gen) || all.find((q) => q.y1 > 1);
    g.player.pos.set(s.x1 + 30, 0.02, s.z1 + 30);
    await g.tiles.whenReady(s.x1, s.z1, 300);
    g.toggleFoot();
    S.buildNow(s.x1, s.z1);
    const L = Math.hypot(s.x0 - s.x1, s.z0 - s.z1), ux = (s.x0 - s.x1) / L, uz = (s.z0 - s.z1) / L;
    g.walker.pos.set(s.x1 - ux * 1.5, s.y1, s.z1 - uz * 1.5);
    for (let i = 0; i < 30; i++) g.step(0.05);
    const onPlatform = +g.walker.pos.y.toFixed(2);
    g.view.yaw = Math.atan2(ux, uz); g.input.fwd = true;
    for (let i = 0; i < 300; i++) g.step(0.05);
    g.input.fwd = false;
    const onDeck = +g.walker.pos.y.toFixed(2);
    // The big ones: no step over 60 ms while they are built.
    let worst = 0;
    for (const name of ['Dadar', 'Chhatrapati Chai Terminus', 'Churchgate']) {
      const b = S.list.find((q) => q.name === name);
      if (!b) continue;
      g.walker.pos.set(b.cx, 0.3, b.cz);
      await g.tiles.whenReady(b.cx, b.cz, 250);
      for (let i = 0; i < 40; i++) { const t0 = performance.now(); g.step(0.05); worst = Math.max(worst, performance.now() - t0); }
    }
    return { station: st.name, onPlatform, onDeck, built: S.list.filter((q) => q.built).length, worstMs: +worst.toFixed(1) };
  });
  await page.close();
  const fails = noErrors(errors);
  if (!info.station) fails.push('no Charni Road station');
  else {
    if (Math.abs(info.onPlatform - 1.3) > 0.1) fails.push(`platform height ${info.onPlatform}, expected 1.3`);
    if (info.onDeck < 7.4) fails.push(`did not climb to the footbridge (y ${info.onDeck})`);
    if (info.worstMs > 60) fails.push(`worst step ${info.worstMs} ms while building stations`);
  }
  return { info, fails };
});

await check('metro', async () => {
  // Line 1 at Saki Naka: ticket, fare gate, board, ride to the next station, off, tap out;
  // a Line 3 trip underground from Churchgate; the closed monorail runs no trains.
  const { page, errors } = await game('hour=9');
  await page.waitForFunction(() => window.__gtb.metro && window.__gtb.tickets, null, { timeout: 90000 });
  const info = await page.evaluate(async () => {
    const g = window.__gtb, M = g.metro, T = g.tickets, s = M.stations.find((o) => o.name === 'Saki Naka' && o.ref === '1');
    if (!s) return { station: null };
    g.state.s.money = 5000;
    g.player.pos.set(s.x + 40, 0.02, s.z + 40);
    await g.tiles.whenReady(s.x, s.z, 350);
    g.toggleFoot();
    M.buildNow(s.x, s.z);
    const f = s.frame, at = (a, t, y) => g.walker.pos.set(s.x + f.ux * a + f.vx * t, y, s.z + f.uz * a + f.vz * t);
    // Concourse, unpaid side, by the gates, with a ticket to the next station.
    const L = M.lines.find((l) => l.ref === '1' && l.stations.some((o) => o.name === 'Saki Naka'));
    const i = L.stations.findIndex((o) => o.name === 'Saki Naka'), next = L.stations[i + 1] || L.stations[i - 1];
    const bought = T.buy(T.metro('1', 'Saki Naka', next.name, Math.abs(next.d - L.stations[i].d)));
    at(10.5, 0, f.yc + 0.05);
    for (let k = 0; k < 10; k++) g.step(0.05);
    const tapped = !!M.tapped;
    // Platform beside the train when one stands there with its doors open.
    let tr = null;
    for (let k = 0; k < 6000 && !tr; k++) { g.step(0.05); for (const q of M.trains.values()) if (q.line === L && q.leg?.station === i && q.doors > 0.95 && q.left > 8) tr = q; }
    if (!tr) return { station: s.name, train: false, bought, tapped };
    const c = 1, al = 2.65 * (L.car / 21.9);
    const side = (() => { const tt = (tr.cx[c] - s.x) * f.vx + (tr.cz[c] - s.z) * f.vz; return tt > 0 ? 1 : -1; })();
    // The platform side of the train, in the train's lateral frame (cs, -sn).
    const px = tr.cx[c] + tr.sn[c] * al, pz = tr.cz[c] + tr.cs[c] * al, lat = (s.x + f.vx * side * 6.5 - px) * tr.cs[c] - (s.z + f.vz * side * 6.5 - pz) * tr.sn[c];
    const ls = lat > 0 ? 1 : -1;
    g.walker.pos.set(px + tr.cs[c] * ls * 2.0, f.yp, pz - tr.sn[c] * ls * 2.0);
    const boarded = M.tryBoard() && !!M.r;
    const p0 = [g.walker.pos.x, g.walker.pos.z];
    for (let k = 0; k < 5000 && M.r && !(M.r.tr.leg?.station >= 0 && M.r.tr.line.stations[M.r.tr.leg.station].name === next.name && M.r.tr.doors > 0.95); k++) g.step(0.05);
    const moved = Math.round(Math.hypot(g.walker.pos.x - p0[0], g.walker.pos.z - p0[1]));
    const riding = !!M.r, off = riding && M.alight() && !M.r;
    const offY = +g.walker.pos.y.toFixed(2);
    // Line 3 from Churchgate to Dadar.
    const cg = M.stations.find((o) => o.ref === '3' && o.name === 'Churchgate');
    g.walker.pos.set(cg.x, 0.3, cg.z);
    await g.tiles.whenReady(cg.x, cg.z, 250);
    M.buildNow(cg.x, cg.z);
    const L3 = M.lines.find((l) => l.ref === '3'), a3 = L3.stations.find((o) => o.name === 'Churchgate'), b3 = L3.stations.find((o) => o.name === 'Dadar');
    const t3 = T.metro('3', 'Churchgate', 'Dadar', Math.abs(b3.d - a3.d));
    T.buy(t3);
    await M.underground(cg, t3);
    const dadar = M.stations.find((o) => o.ref === '3' && o.name === 'Dadar');
    const up = Math.round(Math.hypot(g.walker.pos.x - dadar.x, g.walker.pos.z - dadar.z));
    const mono = [...M.trains.values()].filter((q) => q.line.closed && q.parked == null).length;
    let worst = 0;
    for (let k = 0; k < 60; k++) { const t0 = performance.now(); g.step(0.05); worst = Math.max(worst, performance.now() - t0); }
    return { station: s.name, train: true, bought, tapped, boarded, moved, off, offY, platform: f.yp, line3: up, monoRunning: mono, money: g.state.s.money, worstMs: +worst.toFixed(1) };
  });
  await page.close();
  const fails = noErrors(errors);
  if (!info.station) fails.push('no Saki Naka metro station');
  else if (!info.train) fails.push('no Line 1 train stopped at Saki Naka');
  else {
    if (!info.bought || !info.tapped) fails.push('ticket or gate failed');
    if (!info.boarded) fails.push('could not board the metro');
    if (info.moved < 300) fails.push(`the rider moved only ${info.moved} m`);
    if (!info.off || Math.abs(info.offY - info.platform) > 0.6) fails.push(`did not step off onto the platform (y ${info.offY})`);
    if (info.line3 > 400) fails.push(`Line 3 trip ended ${info.line3} m from Dadar`);
    if (info.monoRunning) fails.push('the closed monorail runs trains');
    if (info.worstMs > 60) fails.push(`worst step ${info.worstMs} ms`);
  }
  return { info, fails };
});

await check('night', async () => {
  // At 10 pm the road ahead must be visible (lamp pools, headlights).
  const { page, errors } = await game('hour=22');
  const info = await page.evaluate(async () => {
    const g = window.__gtb, ix = g.tiles.index;
    const x = (72.8420 - ix.origin.lon) * ix.metresPerDegree.lon, z = -(19.0205 - ix.origin.lat) * ix.metresPerDegree.lat;
    await g.tiles.whenReady(x, z, 300);
    const rd = g.tiles.roadAt(x, z, 80, true); const s = g.tiles.segment(rd.tile, rd.index);
    g.player.pos.set((s[0] + s[2]) / 2, 0.02, (s[1] + s[3]) / 2); g.player.heading = Math.atan2(s[2] - s[0], s[3] - s[1]);
    g.clock.hour = 22;
    for (let i = 0; i < 60; i++) g.step(0.05);
    g.post.render();
    const gl = g.renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let sum = 0, n = 0;
    for (let i = 0; i < px.length; i += 16) { sum += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]; n++; }
    return { mean: +(sum / n).toFixed(1) };
  });
  await page.close();
  const fails = noErrors(errors);
  if (info.mean < 30) fails.push(`night frame too dark (mean ${info.mean} of 255)`);
  return { info, fails };
});

await check('touch', async () => {
  // Phone controls on a landscape phone, driven by real touch events: the steering pad (slide
  // from ◀ to ▶ without lifting), pedals with two thumbs at once, getting out, the joystick (a full
  // push runs), the context button that gets back in. No two visible buttons may overlap.
  const { page, errors } = await game('hour=11', { touch: true });
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, pts = []) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
  const centre = (sel) => page.evaluate((q) => { const r = document.querySelector(q).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, sel);
  const step = (n) => page.evaluate((k) => { for (let i = 0; i < k; i++) window.__gtb.step(0.05); }, n);
  const read = () => page.evaluate(() => { const g = window.__gtb, i = g.input, t = document.getElementById('touch'); return { mode: t.dataset.mode, left: i.left, right: i.right, fwd: i.fwd, back: i.back, analog: i.analog, moveY: i.moveY, speed: g.player.speed, onFoot: g.onFoot }; });
  const overlaps = async () => {
    await page.waitForTimeout(400); // pop-in animations
    return page.evaluate(() => {
      const els = [...document.querySelectorAll('#touch .t-btn, #touch .t-ctx, #btn-phone, #minimap')].filter((e) => e.offsetParent && !e.closest('[hidden]'));
      const box = els.map((e) => ({ n: e.getAttribute('aria-label') || e.textContent.trim() || e.id, r: e.getBoundingClientRect(), round: getComputedStyle(e).borderRadius === '50%' }));
      const out = [];
      for (let i = 0; i < box.length; i++) {
        const a = box[i].r;
        if (a.left < 0 || a.top < 0 || a.right > innerWidth || a.bottom > innerHeight) out.push(`${box[i].n} off screen`);
        for (let j = i + 1; j < box.length; j++) {
          const b = box[j].r;
          const hit = box[i].round && box[j].round
            ? Math.hypot(a.x + a.width / 2 - b.x - b.width / 2, a.y + a.height / 2 - b.y - b.height / 2) < (a.width + b.width) / 2 - 1
            : a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
          if (hit) out.push(`${box[i].n} × ${box[j].n}`);
        }
      }
      return out;
    });
  };
  const fails = [];
  await step(6);
  let s = await read();
  if (s.mode !== 'drive') fails.push(`controls not in drive mode (${s.mode})`);
  fails.push(...(await overlaps()).map((o) => `drive: ${o}`));
  // Steering: press ◀, slide to ▶, lift.
  const L = await centre('.t-steer [data-side="left"]'), R = await centre('.t-steer [data-side="right"]');
  await touch('touchStart', [L]); s = await read();
  if (!s.left || s.right) fails.push('◀ does not steer left');
  await touch('touchMove', [R]); s = await read();
  if (!s.right || s.left) fails.push('sliding from ◀ to ▶ does not switch to right');
  await touch('touchEnd'); s = await read();
  if (s.left || s.right) fails.push('steering stays held after lifting');
  // Two thumbs: steer and gas together.
  const gas = await centre('.t-pedals .gas');
  await touch('touchStart', [L, gas]); s = await read();
  if (!s.left || !s.fwd) fails.push('steering and gas do not work together');
  await touch('touchEnd');
  await touch('touchStart', [gas]); await step(40); await touch('touchEnd');
  s = await read();
  if (s.speed < 2) fails.push(`gas pedal: speed only ${s.speed.toFixed(1)} m/s`);
  if (!(await page.evaluate(() => document.querySelector('.t-exit').classList.contains('off')))) fails.push('the door button is not dimmed while moving');
  const brake = await centre('.t-pedals .brake');
  await touch('touchStart', [brake]); for (let i = 0; i < 30 && (await read()).speed > 0.3; i++) await step(5); await touch('touchEnd');
  await step(5);
  if ((await page.evaluate(() => document.querySelector('.t-pedals .brake small').textContent)) !== 'REV') fails.push('brake pedal does not turn into REV when stopped');
  // Get out with the door button.
  const door = await centre('.t-exit');
  await touch('touchStart', [door]); await touch('touchEnd'); await step(2);
  s = await read();
  if (!s.onFoot || s.mode !== 'foot') fails.push(`door button: onFoot ${s.onFoot}, mode ${s.mode}`);
  fails.push(...(await overlaps()).map((o) => `on foot: ${o}`));
  if (await page.evaluate(() => document.querySelector('[data-ctx="vehicle"]').hidden)) fails.push('no "get in" button next to the taxi');
  const wpn = await centre('.t-weapon');
  await touch('touchStart', [wpn]); await touch('touchEnd'); await step(2);
  if ((await page.evaluate(() => window.__gtb.combat.weapon)) !== 'pichkari') fails.push('weapon button does not switch to the pichkari');
  fails.push(...(await overlaps()).map((o) => `pichkari: ${o}`));
  // Joystick: thumb down in the lower left, pushed all the way up (runs), then lifted.
  const start = await page.evaluate(() => [window.__gtb.walker.pos.x, window.__gtb.walker.pos.z]);
  await touch('touchStart', [[170, 300]]); await touch('touchMove', [[170, 220]]); await touch('touchMove', [[170, 150]]);
  s = await read();
  if (!s.analog || s.moveY < 0.9) fails.push(`joystick: analog ${s.analog}, push ${s.moveY?.toFixed(2)}`);
  await step(30);
  const walked = await page.evaluate(([x, z]) => Math.hypot(window.__gtb.walker.pos.x - x, window.__gtb.walker.pos.z - z), start);
  await touch('touchEnd'); s = await read();
  if (s.analog || s.moveY) fails.push('joystick stays pushed after lifting');
  if (walked < 3) fails.push(`joystick walked only ${walked.toFixed(1)} m in 1.5 s`);
  // Back by the taxi: the context button gets in.
  await page.evaluate(([x, z]) => { window.__gtb.walker.pos.x = x; window.__gtb.walker.pos.z = z; }, start);
  await step(5);
  const ctx = await page.evaluate(() => { const b = document.querySelector('[data-ctx="vehicle"]'); return b.hidden ? null : b.textContent.trim(); });
  if (!ctx) fails.push('no "get in" button back by the taxi');
  else { await touch('touchStart', [await centre('[data-ctx="vehicle"]')]); await touch('touchEnd'); await step(2); }
  s = await read();
  if (s.onFoot) fails.push('the context button did not get back in');
  await page.close();
  return { info: { walked: +walked.toFixed(1), ctx }, fails: [...noErrors(errors), ...fails] };
});

await check('clutter', async () => {
  // Street clutter in the Kalbadevi / Crawford Market bazaars: street-name boards with their text in
  // the atlas, cables and tarps, awnings, gates with watchmen, parked handcarts (one can be pulled);
  // poles and shrines are solid; the refreshes stay cheap.
  const { page, errors } = await game('hour=11');
  const info = await page.evaluate(async () => {
    const g = window.__gtb, ix = g.tiles.index, C = g.clutter;
    const at = (lat, lon) => [(lon - ix.origin.lon) * ix.metresPerDegree.lon, -(lat - ix.origin.lat) * ix.metresPerDegree.lat];
    g.story.s.done = g.story.missions.map((m) => m.id);
    const [x, z] = at(18.9488, 72.8318);
    await g.tiles.whenReady(x, z, 300); g.player.pos.set(x, 0.02, z);
    let worst = 0;
    for (let i = 0; i < 80; i++) { const t0 = performance.now(); g.step(0.05); worst = Math.max(worst, performance.now() - t0); }
    const K = (k) => C.counts[k] || 0;
    const solidAt = C.nSolid ? C.hits(C.solids[0], C.solids[1], 0.2) : false, solidFar = C.hits(x + 5000, z, 0.3);
    const res = { nameBoards: K(20), dirBoards: K(21) + K(22), cables: K(19), tarps: K(23) + K(24), gates: K(28), shrines: K(26), boards: C.boards.count, solid: C.solid.n, cloth: C.cloth.n, folk: C.folkList.length, cells: C.atlas.cells.size, solidAt, solidFar, worstMs: +worst.toFixed(1) };
    // Pull a parked handcart: F next to it, walk it forward.
    const cart = g.traffic.parked.find((v) => v.type === 'handcart');
    res.handcarts = g.traffic.parked.filter((v) => v.type === 'handcart').length;
    if (cart) {
      g.toggleFoot(); for (let i = 0; i < 3; i++) g.step(0.05);
      const h = cart.heading;
      g.walker.pos.set(cart.x - Math.cos(h) * 1.4, 0.2, cart.z + Math.sin(h) * 1.4);
      for (const list of [g.traffic.cars, g.traffic.parked]) for (let i = list.length - 1; i >= 0; i--) if (list[i] !== cart && Math.hypot(list[i].x - cart.x, list[i].z - cart.z) < 12) list.splice(i, 1);
      g.step(0.05); g.toggleFoot(); for (let i = 0; i < 80 && g.onFoot; i++) g.step(0.05);
      res.pulled = !g.onFoot && g.garage.type === 'handcart';
      g.input.fwd = true; let top = 0; for (let i = 0; i < 80; i++) { g.step(0.05); top = Math.max(top, Math.abs(g.player.speed)); } g.input.fwd = false;
      res.cartTop = +top.toFixed(2);
    }
    return res;
  });
  await page.close();
  const fails = noErrors(errors);
  if (info.nameBoards < 2 || info.cells < 2 || info.boards < 4) fails.push(`street-name boards missing (${info.nameBoards} points, ${info.cells} atlas cells, ${info.boards} faces)`);
  if (info.cables < 2) fails.push('no cable bundles over the bazaar lanes');
  if (info.cloth < 5) fails.push('no awnings or tarps');
  if (info.solid < 20) fails.push('solid clutter missing');
  if (!info.solidAt || info.solidFar) fails.push('clutter collisions wrong');
  if (!info.handcarts) fails.push('no handcarts parked in the bazaar');
  else if (!info.pulled) fails.push('could not take a handcart');
  else if (info.cartTop < 0.8 || info.cartTop > 3.6) fails.push(`handcart speed ${info.cartTop} m/s`);
  if (info.worstMs > 60) fails.push(`worst step ${info.worstMs} ms`);
  return { info, fails };
});

await check('people', async () => {
  // Real people (MakeHuman bodies from public/people) near the player on foot: templates load,
  // bodies are placed and animated, the player has one, building bodies doesn't stutter;
  // the people lineup page (people.html) loads without errors.
  const { page, errors } = await game('hour=10');
  await page.waitForFunction(() => window.__gtb.characters.ready, null, { timeout: 120000 });
  const info = await page.evaluate(() => {
    const g = window.__gtb;
    g.toggleFoot();
    // Step until passers-by come within the bodies' radius (they spawn further out along the
    // footpaths), up to 30 s of game time.
    const c = g.characters;
    const others = () => c.pool.filter((b) => b.holder.visible && !b.who?.isPlayer).length;
    let worst = 0;
    for (let i = 0; i < 600 && (i < 120 || others() < 2); i++) { const t = performance.now(); g.step(0.05); if (i > 10) worst = Math.max(worst, performance.now() - t); }
    const shown = c.pool.filter((b) => b.holder.visible);
    const bad = shown.filter((b) => !Number.isFinite(b.holder.position.x) || !b.motion.current).length;
    const b = shown.find((x) => !x.who?.isPlayer);
    const bone = b?.person.bones.get('lowerarm_l'), q0 = bone?.quaternion.clone();
    for (let i = 0; i < 10; i++) g.step(0.05);
    const moved = bone ? 1 - Math.abs(q0.dot(bone.quaternion)) > 1e-7 : false;
    g.post.render();
    return { templates: c.templates.length, shown: shown.length, player: shown.some((x) => x.who?.isPlayer), bad, moved, worstMs: +worst.toFixed(1) };
  });
  await page.close();
  const fails = noErrors(errors);
  if (!info.templates) fails.push('no body templates loaded');
  if (info.shown < 2) fails.push(`only ${info.shown} real people shown`);
  if (!info.player) fails.push('the player on foot has no body');
  if (info.bad) fails.push(`${info.bad} bodies unplaced or without motion`);
  if (!info.moved) fails.push('people do not move (no animation)');
  if (info.worstMs > 60) fails.push(`worst step ${info.worstMs} ms`);
  const lp = await browser.newPage({ viewport: { width: 800, height: 500 } });
  const lpErrors = [];
  lp.on('pageerror', (e) => lpErrors.push(e.message));
  lp.on('console', (m) => { if (m.type() === 'error') lpErrors.push(m.text()); });
  await lp.goto(`${base}people.html`);
  await lp.waitForFunction(() => window.__people?.people.filter(Boolean).length > 0, null, { timeout: 180000 }).catch(() => lpErrors.push('lineup did not load'));
  info.lineup = await lp.evaluate(() => window.__people?.people.filter(Boolean).length || 0);
  await lp.close();
  fails.push(...lpErrors.map((e) => `lineup: ${e}`));
  return { info, fails };
});

await browser.close();
server.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
