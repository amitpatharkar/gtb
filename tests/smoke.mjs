// Headless smoke tests for the built game (dist/). Run after `npm run build`:
//   node tests/smoke.mjs            all checks on the Low tier
//   node tests/smoke.mjs --only=boot,drive --quality=medium
//   checks: boot, drive, traffic, steal, missions, trains, night, touch (phone controls), clutter, people, flyover
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

await check('people', async () => {
  // Real characters near the camera wear their looks in one draw call each; the far crowd draws
  // the rest; looks vary by district (a Koli fishing village: nauvari saris), riders get bodies,
  // people share one object shape, and drawing them allocates nothing per step.
  const { page, errors } = await game('hour=10');
  await page.waitForFunction(() => window.__gtb.characters.ready, null, { timeout: 120000 });
  const info = await page.evaluate(async () => {
    const g = window.__gtb, C = g.characters, ix = g.tiles.index;
    for (let i = 0; i < 300; i++) g.step(0.05);
    const shown = C.pool.filter((c) => c.holder.visible);
    let meshes = 0, bad = 0;
    for (const c of shown) {
      let n = 0;
      c.holder.traverse((o) => { if (o.isMesh && o.visible) n++; });
      meshes = Math.max(meshes, n);
      if (!(c.geo.drawRange.count > 1000) || !Number.isFinite(c.holder.position.x + c.holder.position.y)) bad++;
    }
    const t = C.templates[0], pieces = Object.keys(t.ranges).length;
    const styles = new Set(g.street.peds.map((p) => p.look?.style));
    // Who dresses how in a koliwada (Worli) at 9 am.
    const koli = [];
    for (let i = 0; i < 400; i++) koli.push(g.outfit('sari', Math.random, 'koli', 9, false).look.style);
    const school = [];
    for (let i = 0; i < 200; i++) school.push(g.outfit('kid', Math.random, '', 9, false).look.style);
    // Riders on two-wheelers: persistent people astride (pose RIDE or PEDAL).
    const riders = g.traffic.riders.filter((r) => r.person && (r.person.pose === 15 || r.person.pose === 14)).length;
    // One object shape: every street pedestrian has the same keys in the same order.
    const keys = new Set(g.street.peds.map((p) => Object.keys(p).join(',')));
    // Gully cricket as real characters: a batter and a keeper near the camera.
    const kid = g.makePerson({ ...g.outfit('kid'), kind: 'kid', scale: 0.72, pose: 5, x: g.camera.position.x + 2, z: g.camera.position.z + 2, y: 0 });
    const keeper = g.makePerson({ ...g.outfit('kid'), kind: 'kid', scale: 0.72, pose: 7, x: g.camera.position.x + 3, z: g.camera.position.z + 2, y: 0 });
    const before = g.people.beforeEnd;
    g.people.beforeEnd = (list) => { list.push(kid, keeper); before(list); };
    for (let i = 0; i < 10; i++) g.step(0.05);
    g.people.beforeEnd = before;
    const t0 = performance.now(); for (let i = 0; i < 60; i++) g.step(1 / 60); const ms = (performance.now() - t0) / 60;
    return {
      heroes: shown.length, meshesPerCharacter: meshes, broken: bad, pieces, far: g.people.n, styles: styles.size,
      nauvariPct: Math.round(100 * koli.filter((s) => s === 'nauvari').length / koli.length), schoolPct: Math.round(100 * school.filter((s) => s === 'school').length / school.length),
      riders, pedShapes: keys.size, cricket: [kid.hero, keeper.hero], stepMs: +ms.toFixed(2),
    };
  });
  await page.close();
  const fails = noErrors(errors);
  if (info.heroes < 3) fails.push(`only ${info.heroes} real characters`);
  if (info.meshesPerCharacter !== 1) fails.push(`${info.meshesPerCharacter} meshes per character (one draw call each)`);
  if (info.broken) fails.push(`${info.broken} characters with no clothes drawn or a bad position`);
  if (info.pieces < 30) fails.push(`wardrobe has only ${info.pieces} pieces`);
  if (!info.far) fails.push('no far crowd');
  if (info.styles < 3) fails.push(`only ${info.styles} outfit styles on the street`);
  if (info.nauvariPct < 30) fails.push(`only ${info.nauvariPct} % nauvari saris in a koliwada`);
  if (info.schoolPct < 40) fails.push(`only ${info.schoolPct} % school uniforms on a school morning`);
  if (info.pedShapes > 1) fails.push(`${info.pedShapes} object shapes among pedestrians`);
  if (!info.cricket[0] || !info.cricket[1]) fails.push('cricketers are not real characters near the camera');
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

await check('flyover', async () => {
  // Up a flyover ramp onto its deck (the car rises with the road and never falls through), then
  // traffic on the sea link at deck height; the cable-stayed pylons are standing.
  const { page, errors } = await game('hour=11');
  const info = await page.evaluate(async () => {
    const g = window.__gtb, ix = g.tiles.index, T = g.tiles;
    const out = { pylons: ix.bridges?.pylons?.length || 0, cables: g.bridges?.cableCount || 0 };
    const at = (lat, lon) => [(lon - ix.origin.lon) * ix.metresPerDegree.lon, -(lat - ix.origin.lat) * ix.metresPerDegree.lat];
    // 1. Dadar's flyovers: a ramp that climbs to a deck.
    const [x, z] = at(19.0190, 72.8435);
    await T.whenReady(x, z, 420); g.player.pos.set(x, 0.02, z);
    for (let i = 0; i < 4; i++) g.step(0.05);
    const pathFrom = (seg, dir) => {
      const pts = [];
      for (let n = 0; n < 80; n++) {
        const s = seg.s;
        if (!pts.length) pts.push(dir > 0 ? [s[0], s[1], s[6]] : [s[2], s[3], s[7]]);
        pts.push(dir > 0 ? [s[2], s[3], s[7]] : [s[0], s[1], s[6]]);
        const fx = (s[2] - s[0]) * dir, fz = (s[3] - s[1]) * dir, fl = Math.hypot(fx, fz) || 1;
        let best = null, bs = 0.5;
        for (const o of g.traffic.ends.get(dir > 0 ? seg.k1 : seg.k0) || []) {
          if (o.seg === seg) continue;
          const d2 = o.end === 0 ? 1 : -1, ox = (o.seg.s[2] - o.seg.s[0]) * d2, oz = (o.seg.s[3] - o.seg.s[1]) * d2;
          const sc = (ox * fx + oz * fz) / (fl * (Math.hypot(ox, oz) || 1));
          if (sc > bs) { bs = sc; best = [o.seg, d2]; }
        }
        if (!best) break;
        [seg, dir] = best;
      }
      return pts;
    };
    let path = null;
    for (const seg of g.traffic.segList) {
      const s = seg.s;
      if (!(s[5] & 32) || s[4] < 2.5) continue;
      const dir = s[6] < 0.12 && s[7] > 0.2 ? 1 : s[7] < 0.12 && s[6] > 0.2 ? -1 : 0;
      if (!dir) continue;
      const pts = pathFrom(seg, dir);
      const top = Math.max(...pts.map((p) => p[2]));
      let len = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (top > 5.5 && len > 150 && (!path || len > path.len)) path = { pts, top, len };
    }
    if (!path) return { ...out, error: 'no flyover ramp found near Dadar' };
    const pts = path.pts, p = g.player.pos, world = { hits: (a, b, r, y, v) => T.hits(a, b, r, y, v), groundHeight: (a, b, y) => T.wheelHeight(a, b, y) };
    p.set(pts[0][0], 0.02, pts[0][1]);
    g.player.heading = Math.atan2(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]);
    g.player.speed = 0; g.player.vx = g.player.vz = 0; g.player.lastSpeed = 0; g.player.fuel = 1;
    const input = { fwd: false, back: false, left: false, right: false, brake: false, steer: 0 };
    let idx = 1, maxY = 0, fell = 0, travelled = 0, prevX = p.x, prevZ = p.z;
    for (let i = 0; i < 900 && idx < pts.length - 1; i++) {
      while (idx < pts.length - 1 && Math.hypot(pts[idx][0] - p.x, pts[idx][1] - p.z) < 9) idx++;
      const t = pts[idx];
      let a = Math.atan2(t[0] - p.x, t[1] - p.z) - g.player.heading; a = Math.atan2(Math.sin(a), Math.cos(a));
      input.steer = Math.max(-1, Math.min(1, a * 2.5)); input.fwd = g.player.speed < 11; input.brake = g.player.speed > 13;
      g.player.update(0.05, input, world);
      travelled += Math.hypot(p.x - prevX, p.z - prevZ); prevX = p.x; prevZ = p.z;
      maxY = Math.max(maxY, p.y);
      // The road here (nearest path point): the car must be on it, not fallen to the street below.
      let near = null, nd = Infinity;
      for (const q of pts) { const d = Math.hypot(q[0] - p.x, q[1] - p.z); if (d < nd) { nd = d; near = q; } }
      if (nd < 6 && near[2] > 3 && p.y < near[2] - 2) fell++;
    }
    Object.assign(out, { rampTop: +path.top.toFixed(1), maxY: +maxY.toFixed(1), travelled: Math.round(travelled), fell });
    // 2. Traffic on the sea link's deck, at deck height.
    const P = ix.bridges?.pylons?.[0];
    if (P) {
      await T.whenReady(P.x, P.z, 300);
      const rd = T.roadAt(P.x, P.z, 30, true, P.deck);
      if (rd) { const s = T.segment(rd.tile, rd.index); p.set((s[0] + s[2]) / 2, (s[6] + s[7]) / 2, (s[1] + s[3]) / 2); g.player.heading = Math.atan2(s[2] - s[0], s[3] - s[1]); }
      g.player.speed = 0; g.player.vx = g.player.vz = 0; g.player.lastSpeed = 0;
      for (let i = 0; i < 300; i++) g.step(0.05);
      let onDeck = 0, wrongY = 0;
      for (const c of g.traffic.cars) {
        const s = c.seg.s;
        if (!(s[5] & 32) || (s[6] + s[7]) / 2 < 4) continue;
        const t = c.dir > 0 ? c.t : 1 - c.t, y = s[6] + (s[7] - s[6]) * t;
        onDeck++;
        if (Math.abs(c.y - y) > 0.8) wrongY++;
      }
      Object.assign(out, { playerOnDeck: +p.y.toFixed(1), trafficOnDeck: onDeck, wrongY });
    }
    g.post.render();
    return out;
  });
  await page.close();
  const fails = noErrors(errors);
  if (info.error) fails.push(info.error);
  if (!info.pylons || info.cables < 100) fails.push('sea link pylons or stay cables missing');
  if (!(info.maxY > 5)) fails.push(`car did not climb the ramp onto the deck (max height ${info.maxY} m)`);
  if (info.fell) fails.push(`car fell through the deck ${info.fell} times`);
  if (!(info.playerOnDeck > 5)) fails.push(`player not kept on the sea link deck (y ${info.playerOnDeck})`);
  if (!(info.trafficOnDeck > 0)) fails.push('no traffic on the sea link deck');
  if (info.wrongY) fails.push(`${info.wrongY} cars on the deck away from its height`);
  return { info, fails };
});

await check('facades', async () => {
  // Facade kinds reach the game (tile style byte → worker → parts) and the facade shader with
  // its room atlas renders at Girgaon (chawls, louvres), Fort (Gothic arches, gables) and Marine
  // Drive (Art Deco) by night without errors; parts near the player are built.
  const { page, errors } = await game('hour=20.5');
  const info = await page.evaluate(async () => {
    const g = window.__gtb, ix = g.tiles.index, all = {}, near = {};
    for (const [lat, lon] of [[18.9540, 72.8190], [18.9325, 72.8318], [18.9440, 72.8236]]) {
      const x = (lon - ix.origin.lon) * ix.metresPerDegree.lon, z = -(lat - ix.origin.lat) * ix.metresPerDegree.lat;
      await g.tiles.whenReady(x, z, 250);
      g.player.pos.set(x, 0.1, z);
      for (let i = 0; i < 4; i++) g.step(0.05);
      g.facadeParts.rebuild(x, z, g.tiles);
      g.post.render();
      for (const [k, list] of Object.entries(g.facadeParts.meshes)) near[k] = (near[k] || 0) + list[0].count;
    }
    for (const t of g.tiles.tiles.values()) for (const [k, a] of Object.entries(t.facadeParts || {})) all[k] = (all[k] || 0) + a.length / 8;
    return { all, near: Object.values(near).reduce((a, b) => a + b, 0) };
  });
  await page.close();
  const fails = noErrors(errors);
  for (const k of ['frame', 'shutter', 'arch', 'enclosed', 'clothes', 'pipe', 'grille']) if (!info.all[k]) fails.push(`no ${k} parts in the loaded tiles`);
  if (!info.near) fails.push('no facade parts near the player');
  return { info, fails };
});

await browser.close();
server.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
