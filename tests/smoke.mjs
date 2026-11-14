// Headless smoke tests for the built game (dist/). Run after `npm run build`:
//   node tests/smoke.mjs            all checks on the Low tier
//   node tests/smoke.mjs --only=boot,drive --quality=medium
// Needs Playwright with Chromium (`npm i -g playwright && npx playwright install chromium`).
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
    for (let i = 0; i < 200; i++) g.step(0.05);
    g.toggleFoot(); for (let i = 0; i < 3; i++) g.step(0.05);
    const car = g.traffic.cars.filter((c) => !g.traffic.types[c.type].rider).sort((a, b) => Math.hypot(a.x - g.walker.pos.x, a.z - g.walker.pos.z) - Math.hypot(b.x - g.walker.pos.x, b.z - g.walker.pos.z))[0];
    if (!car) return { car: null };
    const T = g.traffic.types[car.type], h = car.heading;
    g.walker.pos.set(car.x - Math.cos(h) * (T.wid / 2 + 3.5), 0.2, car.z + Math.sin(h) * (T.wid / 2 + 3.5));
    g.step(0.05);
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

await browser.close();
server.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
