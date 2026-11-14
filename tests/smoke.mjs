// Headless smoke tests for the built game (dist/). Run after `npm run build`:
//   node tests/smoke.mjs            all checks on the Low tier
//   node tests/smoke.mjs --only=boot,drive --quality=medium
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
async function game(query = '') {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
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
    g.input.fwd = true; for (let i = 0; i < 40; i++) g.step(0.05); g.input.fwd = false;
    return { car: car.type, took: !g.onFoot && type === car.type, secs: +(n * 0.05).toFixed(1), driverOut: g.street.peds.filter((p) => p.kind === 'driver').length, speed: +Math.abs(g.player.speed).toFixed(1) };
  });
  await page.close();
  const fails = noErrors(errors);
  if (!info.car) fails.push('no car to steal');
  else if (info.wrongTarget) fails.push('F would take ' + info.wrongTarget);
  else { if (!info.took) fails.push('did not get into the car'); if (info.driverOut < 1) fails.push('driver was not pulled out'); if (!(info.speed >= 3)) fails.push('stolen car did not drive'); }
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

await check('physics', async () => {
  // GTA-style physics in the real game: gears, a wall crash, shoving a parked car (rigid body),
  // a pedestrian bowled over (ragdoll reaction, then back up), a lamp post giving way, a
  // motorbike crash throwing the rider (F picks the bike up), traffic knocking you over.
  const { page, errors } = await game('hour=11');
  const info = await page.evaluate(() => {
    const g = window.__gtb, P = g.player, T = g.traffic, POINT_LIGHT = 4;
    g.story.s.done = g.story.missions.map((m) => m.id); // no mission markers (cutscenes)
    for (let i = 0; i < 40; i++) g.step(0.05);
    const out = {}, fin = () => Number.isFinite(P.pos.x + P.pos.z + P.vx + P.vz + P.yaw + P.heading);
    const place = (x, z, h, v = 0) => { P.pos.set(x, P.pos.y, z); P.heading = h; P.speed = v; P.vx = Math.sin(h) * v; P.vz = Math.cos(h) * v; P.lastSpeed = v; P.yaw = 0; P.fallen = 0; };
    const clearNear = (x, z, r, keep) => { for (const list of [T.cars, T.parked, T.left]) for (let i = list.length - 1; i >= 0; i--) if (list[i] !== keep && Math.hypot(list[i].x - x, list[i].z - z) < r) list.splice(i, 1); };
    const free = (x, z, r) => !g.tiles.hits(x, z, r) && !g.propPhysics.hits(x, z, r);
    // A wall straight ahead with a clear run-up: from the spawn, look round for one.
    function wallRun(x0, z0) {
      for (let k = 0; k < 32; k++) {
        const h = (k / 32) * Math.PI * 2, fx = Math.sin(h), fz = Math.cos(h);
        for (let d = 6; d < 60; d += 1) {
          if (g.tiles.hits(x0 + fx * d, z0 + fz * d, 0.9)) {
            if (d < 14) break;
            let ok = true; for (let e = 0; e < d - 2; e += 1) if (!free(x0 + fx * e, z0 + fz * e, 1.0)) { ok = false; break; }
            if (ok) return { h, d };
            break;
          }
        }
      }
      return null;
    }
    const sx = P.pos.x, sz = P.pos.z;
    // 1. Straight-line acceleration on the spawn road (traffic moved away).
    T.max = 0; clearNear(sx, sz, 400);
    {
      const rd = g.tiles.roadAt(sx, sz, 30, true), s = g.tiles.segment(rd.tile, rd.index);
      const h = Math.atan2(s[2] - s[0], s[3] - s[1]);
      place(sx, sz, h, 0); g.input.fwd = true;
      let t = 0; while (t < 3) { g.step(0.05); t += 0.05; }
      g.input.fwd = false;
      out.accel3s = +P.speed.toFixed(1); out.gear = P.gear;
      for (let i = 0; i < 60; i++) g.step(0.05);
    }
    // 2. Into a wall at 12 m/s: stops, takes damage, does not go through.
    {
      const w = wallRun(sx, sz);
      if (w) {
        place(sx, sz, w.h + 0.25, 12); const c0 = P.condition;
        for (let i = 0; i < 60; i++) g.step(0.05);
        const along = (P.pos.x - sx) * Math.sin(w.h) + (P.pos.z - sz) * Math.cos(w.h);
        out.wall = { dist: w.d, condLost: +(c0 - P.condition).toFixed(3), stoppedBefore: along < w.d, finite: fin() };
      } else out.wall = 'no wall found';
    }
    // 3. Shove a parked car: it slides into `left` and moves.
    {
      T.max = 0;
      for (let i = 0; i < 4; i++) g.step(0.05);
      const pick = () => T.parked.find((c) => !T.types[c.type].rider && !T.types[c.type].big && free(c.x - Math.sin(c.heading) * 9, c.z - Math.cos(c.heading) * 9, 1.1));
      let v = null;
      for (let k = 0; k < 12 && !v; k++) { place(sx + Math.sin(k) * 60 * (k % 4), sz + Math.cos(k) * 60 * (k % 4), 0, 0); for (let i = 0; i < 3; i++) g.step(0.05); v = pick(); }
      if (v) {
        place(v.x - Math.sin(v.heading) * 9, v.z - Math.cos(v.heading) * 9, v.heading, 0); g.step(0.05);
        v = T.parked.find((c) => Math.hypot(c.x - v.x, c.z - v.z) < 0.5) || v;
        const x0 = v.x, z0 = v.z, h = v.heading;
        clearNear(v.x, v.z, 12, v);
        place(v.x - Math.sin(h) * 9, v.z - Math.cos(h) * 9, h, 9);
        for (let i = 0; i < 50; i++) g.step(0.05);
        out.shove = { type: v.type, moved: +Math.hypot(v.x - x0, v.z - z0).toFixed(2), nowLeft: T.left.includes(v), finite: fin() };
      } else out.shove = 'no parked car';
    }
    // 4. A pedestrian in the way at 11 m/s: a ragdoll reaction, then back on their feet.
    {
      const p = g.street.peds.find((q) => q.kind !== 'kid' && (q.scale ?? 1) > 0.85 && !q.combat);
      if (p) {
        // Room for the run-up: put the person on open ground ahead of the car.
        let x = sx, z = sz, hh = 0;
        for (let k = 0; k < 16; k++) { hh = (k / 16) * 6.28; let ok = true; for (let e = 0; e < 14; e++) if (!free(sx + Math.sin(hh) * e, sz + Math.cos(hh) * e, 1)) { ok = false; break; } if (ok) break; }
        p.x = sx + Math.sin(hh) * 9; p.z = sz + Math.cos(hh) * 9; p.state = 'stand';
        g.combat.free(p, 'flee'); p.combat.t = 60;
        place(sx, sz, hh, 11);
        let rag = null; for (let i = 0; i < 30 && !rag; i++) { g.step(0.05); if (p.rag) rag = p.rag.r; }
        let maxY = 0; for (let i = 0; i < 40; i++) { g.step(0.05); maxY = Math.max(maxY, p.y); }
        for (let i = 0; i < 160 && p.rag; i++) g.step(0.05);
        out.ped = { reaction: rag, maxY: +maxY.toFixed(2), upAgain: !p.rag, finite: Number.isFinite(p.x + p.z) };
      } else out.ped = 'no ped';
    }
    // 5. A lamp post hit at 14 m/s gives way; the car carries on.
    {
      let lamp = null;
      for (const t of g.tiles.tiles.values()) {
        const arr = t.points?.[POINT_LIGHT]; if (!arr) continue;
        for (let i = 0; i < arr.length && !lamp; i += 5) {
          const x = arr[i] + t.origin[0], z = arr[i + 2] + t.origin[1];
          if (Math.hypot(x - sx, z - sz) > 300) continue;
          for (let k = 0; k < 8 && !lamp; k++) {
            const h = (k / 8) * 6.28, fx = Math.sin(h), fz = Math.cos(h);
            let ok = true; for (let e = 1.6; e < 16; e += 0.8) if (g.tiles.hits(x - fx * e, z - fz * e, 1.0)) { ok = false; break; }
            if (ok && !g.tiles.hits(x + fx * 4, z + fz * 4, 1.0)) lamp = { x, z, h, t, i: i / 5 };
          }
        }
        if (lamp) break;
      }
      if (lamp) {
        clearNear(lamp.x, lamp.z, 40);
        place(lamp.x - Math.sin(lamp.h) * 14, lamp.z - Math.cos(lamp.h) * 14, lamp.h, 14);
        let broke = false; for (let i = 0; i < 30; i++) { g.step(0.05); if (lamp.t.broken?.has(4 * 1048576 + lamp.i)) broke = true; }
        out.lamp = { broke, speedAfter: +Math.hypot(P.vx, P.vz).toFixed(1), finite: fin() };
      } else out.lamp = 'no lamp found';
    }
    // 6. A motorbike into a wall at 12 m/s: the rider is thrown, F picks the bike up.
    {
      const w = wallRun(sx, sz);
      if (w) {
        if (!g.onFoot) { place(sx + 40, sz + 40, w.h, 0); g.step(0.05); g.toggleFoot(); }
        const bike = { type: 'bike', x: sx - Math.sin(w.h) * 1, z: sz - Math.cos(w.h) * 1, heading: w.h, tint: new g.THREE.Color(0x222222), taken: true, pvx: 0, pvz: 0, spin: 0, roll: 0 };
        T.left.push(bike);
        g.walker.pos.set(bike.x - Math.cos(w.h) * 1.2, 0.2, bike.z + Math.sin(w.h) * 1.2);
        g.step(0.05); g.toggleFoot(); for (let i = 0; i < 40 && g.onFoot; i++) g.step(0.05);
        const onBike = g.garage.type === 'bike' && !g.onFoot;
        place(sx, sz, w.h, 12); g.input.fwd = true;
        let thrown = false, airborne = 0; for (let i = 0; i < 60; i++) { g.step(0.05); if (g.onFoot && g.walker.rag) { thrown = true; airborne = Math.max(airborne, g.walker.pos.y); } }
        g.input.fwd = false;
        let upAfter = -1; for (let i = 0; i < 200; i++) { g.step(0.05); if (!g.walker.rag && upAfter < 0) upAfter = i; }
        const fallen = P.fallen;
        g.walker.pos.set(P.pos.x + 1, 0.2, P.pos.z); g.step(0.05); g.toggleFoot(); for (let i = 0; i < 20; i++) g.step(0.05);
        out.bike = { onBike, thrown, airborne: +airborne.toFixed(2), bikeLying: !!fallen, upAfter: +(upAfter * 0.05).toFixed(1), backOn: !g.onFoot && !P.fallen, finite: fin() };
      } else out.bike = 'no wall';
    }
    // 7. On foot in front of a moving traffic car: knocked over.
    {
      if (!g.onFoot) g.toggleFoot();
      for (let i = 0; i < 4; i++) g.step(0.05);
      T.max = 30; for (let i = 0; i < 80 && !T.cars.length; i++) g.step(0.05);
      const c = T.cars[0];
      if (c) {
        c.speed = 8;
        g.walker.pos.set(c.x + Math.sin(c.heading) * 1, 0.2, c.z + Math.cos(c.heading) * 1); g.walker.down = 0; g.walker.rag = null;
        let r = null; for (let i = 0; i < 3 && !r; i++) { g.step(0.05); r = g.walker.rag?.r ?? null; }
        for (let i = 0; i < 160 && g.walker.rag; i++) g.step(0.05);
        out.walker = { reaction: r, upAgain: !g.walker.rag, health: +g.walker.health.toFixed(2) };
      } else out.walker = 'no traffic';
    }
    out.stepMs = +g.stepMs.toFixed(2);
    return out;
  });
  await page.close();
  const fails = noErrors(errors);
  const want = (ok, msg) => { if (!ok) fails.push(msg); };
  want(info.accel3s > 11 && info.accel3s < 20, `0–3 s acceleration ${info.accel3s} m/s`);
  want(info.gear >= 2, 'the gearbox did not change up');
  if (typeof info.wall === 'object') { want(info.wall.stoppedBefore, 'drove through a wall'); want(info.wall.condLost > 0, 'a 12 m/s wall crash did no damage'); want(info.wall.finite, 'NaN after a wall crash'); }
  if (typeof info.shove === 'object') want(info.shove.moved > 0.5 && info.shove.nowLeft, 'a parked car hit at 9 m/s did not move');
  if (typeof info.ped === 'object') { want(!!info.ped.reaction, 'a pedestrian hit at 11 m/s had no reaction'); want(info.ped.upAgain, 'a knocked-down pedestrian never got up'); }
  if (typeof info.lamp === 'object') { want(info.lamp.broke, 'a lamp post hit at 14 m/s did not give way'); want(info.lamp.speedAfter > 2, 'the car stopped dead at a broken lamp post'); }
  if (typeof info.bike === 'object') { want(info.bike.onBike, 'could not get on the bike'); want(info.bike.thrown, 'a 12 m/s bike crash did not throw the rider'); want(info.bike.backOn, 'F did not pick the dropped bike up'); }
  if (typeof info.walker === 'object') { want(!!info.walker.reaction, 'a car hitting the player on foot had no effect'); want(info.walker.upAgain, 'the player never got up'); }
  want(info.stepMs < 12, `mean step ${info.stepMs} ms`);
  return { info, fails };
});

await browser.close();
server.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
