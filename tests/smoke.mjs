// Smoke test: plays the built game (dist/) headless and fails on anything a player would notice.
//   node tests/smoke.mjs [--only=boot,world,foot,drive,shoot] [--quality=low|medium|high] [--shots=dir]
// Checks: boots without console errors; Colaba loads with solid ground and buildings, and no
// building stands on a road; the player walks, climbs a kerb and jumps; every car spawns with
// four separate wheels, stays upright, accelerates, steers the right way and brakes; the pistol
// fires, uses ammo and reloads. The deploy workflow runs it on the exact build it publishes.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const only = args.only ? String(args.only).split(',') : null;
const quality = args.quality || 'low';
const shots = args.shots ? path.resolve(String(args.shots)) : null;
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
if (!fs.existsSync(path.join(dist, 'index.html'))) { console.error('dist/ is missing: run npm run build first'); process.exit(2); }

// Static server like GitHub Pages: .gz files are served as-is (the game unzips them itself).
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.gz': 'application/gzip', '.ktx2': 'image/ktx2', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.hdr': 'application/octet-stream', '.ogg': 'audio/ogg', '.bin': 'application/octet-stream', '.md': 'text/markdown' };
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

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
const IGNORE = /GPU stall|GL Driver|WebGPU is not available|No available adapters|favicon/;
page.on('console', (m) => { if (m.type() === 'error' && !IGNORE.test(m.text())) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`page error: ${e.message}`));
page.on('requestfailed', (r) => errors.push(`request failed: ${r.url()}`));
page.on('response', (r) => { if (r.status() >= 400 && !IGNORE.test(r.url())) errors.push(`HTTP ${r.status()}: ${r.url()}`); });

let failed = 0;
const want = (name) => !only || only.includes(name);
const check = (ok, msg) => { console.log(`${ok ? '  ok ' : '  FAIL'} ${msg}`); if (!ok) failed++; };
const shot = async (name) => { if (!shots) return; fs.mkdirSync(shots, { recursive: true }); await page.evaluate(() => window.__game.render()); await page.screenshot({ path: path.join(shots, `${name}.png`) }); };

const t0 = Date.now();
await page.goto(`${base}?test&quality=${quality}`);
await page.waitForFunction(() => window.__game || document.getElementById('load-text')?.textContent.startsWith('Could not'), null, { timeout: 180000 });
const boot = await page.evaluate(() => ({ ok: !!window.__game, text: document.getElementById('load-text').textContent }));
console.log(`boot: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
check(boot.ok, `the game starts (${boot.text})`);
if (!boot.ok) { console.log(errors.join('\n')); process.exit(1); }

if (want('world')) {
  console.log('world');
  const w = await page.evaluate(() => {
    const g = window.__game, s = g.world.index.spawn;
    g.step(10);
    // Buildings are solid: a ray along the street level hits walls in some direction.
    let walls = 0;
    for (let a = 0; a < 16; a++) { const h = g.physics.cast(s.x, 1.5, s.z, Math.sin(a / 2.55), 0, Math.cos(a / 2.55), 120); if (h && h.normal && Math.abs(h.normal.y) < 0.3) walls++; }
    return { tiles: g.world.tiles.size, ground: g.physics.groundAt(s.x, s.z), walls, stats: g.world.stats, street: g.world.roadNameAt(s.x, s.z) };
  });
  check(w.tiles >= 4, `${w.tiles} map tiles loaded around the spawn`);
  check(w.ground !== null && Math.abs(w.ground - 0.02) < 0.05, `solid asphalt under the spawn (y = ${w.ground?.toFixed(3)})`);
  check(w.walls >= 3, `buildings are solid (${w.walls} of 16 directions hit a wall)`);
  check(w.stats.dropped < w.stats.buildings * 0.05, `${w.stats.dropped} of ${w.stats.buildings} buildings dropped for standing on a road`);
  check(!!w.street, `street name shown (${w.street})`);
  await shot('world');
}

if (want('foot')) {
  console.log('on foot');
  const f = await page.evaluate(() => {
    const g = window.__game, p = g.player, s = g.world.index.spawn;
    const set = (k) => { g.input.forced.clear(); for (const x of k) g.input.forced.add(x); };
    p.place(s.x, 0.02, s.z, s.heading); g.step(10);
    const p0 = p.pos.clone();
    g.cam.yaw = s.heading; set(['forward']); g.step(120);
    const walked = p.pos.distanceTo(p0), anim = g.hero.current;
    // Towards the sea wall: up the kerb onto the footpath.
    g.cam.yaw = s.heading + Math.PI / 2; p.place(s.x, 0.02, s.z, g.cam.yaw); g.step(5);
    let maxY = 0; for (let i = 0; i < 12; i++) { g.step(20); maxY = Math.max(maxY, p.pos.y); }
    set([]); p.place(s.x, 0.02, s.z, s.heading); g.step(30);
    const y0 = p.pos.y; set(['jump']); g.step(2); set([]); let top = y0; for (let i = 0; i < 30; i++) { g.step(1); top = Math.max(top, p.pos.y); } g.step(60);
    return { walked, anim, maxY, jump: top - y0, landed: p.grounded };
  });
  check(f.walked > 5 && f.walked < 9, `walks forward (${f.walked.toFixed(1)} m in 2 s, clip "${f.anim}")`);
  check(f.maxY > 0.15, `steps up the kerb (y up to ${f.maxY.toFixed(2)} m)`);
  check(f.jump > 0.3 && f.landed, `jumps ${f.jump.toFixed(2)} m and lands`);
}

if (want('drive')) {
  console.log('cars');
  const d = await page.evaluate(() => {
    const g = window.__game, s = g.world.index.spawn;
    const fx = Math.sin(s.heading), fz = Math.cos(s.heading), rx = -fz, rz = fx;
    const y = g.physics.groundAt(s.x, s.z);
    const set = (k) => { g.input.forced.clear(); for (const x of k) g.input.forced.add(x); };
    const out = [];
    const seen = new Set();
    for (const car of g.cars) {
      if (seen.has(car.spec.name)) continue;
      seen.add(car.spec.name);
      if (g.driving) g.exit();
      g.cars.forEach((c, i) => { if (c !== car) { c.body.setTranslation({ x: s.x + rx * 60 + i * 7, y: 40, z: s.z + rz * 60 }, true); c.body.setBodyType(1, true); } });
      car.body.setBodyType(0, true);
      car.body.setTranslation({ x: s.x + rx * 1.5, y: y + 0.3, z: s.z + rz * 1.5 }, true);
      car.body.setRotation({ x: 0, y: Math.sin(s.heading / 2), z: 0, w: Math.cos(s.heading / 2) }, true);
      car.body.setLinvel({ x: 0, y: 0, z: 0 }, true); car.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      g.player.place(s.x + rx * 4.5, y, s.z + rz * 4.5, s.heading);
      g.step(30);
      const entered = g.enterNearest() && g.driving === car;
      set(['forward']); g.step(300);
      const kmh = car.speed * 3.6;
      const h0 = car.heading; set(['forward', 'right']); g.step(30); const turn = car.heading - h0;
      set(['back']); let n = 0; let minUp = 1; const v0 = car.speed * 3.6;
      while (car.speed > 0.3 && n < 600) { g.step(1); n++; const q = car.body.rotation(); minUp = Math.min(minUp, 1 - 2 * (q.x * q.x + q.z * q.z)); }
      set([]); g.step(30);
      out.push({ name: car.spec.name, wheels: car.wheels.filter((w) => w.pivot).length, entered, kmh, turn, stop: n / 60, v0, minUp });
    }
    if (g.driving) g.exit();
    g.cars.forEach((c) => c.body.setBodyType(0, true));
    return out;
  });
  for (const c of d) {
    check(c.wheels === 4, `${c.name}: four separate wheels`);
    check(c.entered, `${c.name}: player gets in`);
    check(c.kmh > 40 && c.kmh < 110, `${c.name}: accelerates to ${c.kmh.toFixed(0)} km/h in 5 s`);
    check(c.turn < -0.1, `${c.name}: steering right turns right (${(c.turn * 57.3).toFixed(0)}°)`);
    check(c.stop < 3.5, `${c.name}: brakes from ${c.v0.toFixed(0)} km/h to a stop in ${c.stop.toFixed(1)} s`);
    check(c.minUp > 0.8, `${c.name}: stays upright in a braking turn`);
  }
  check(d.length >= 3, `${d.length} car models spawn`);
  await shot('drive');
}

if (want('shoot')) {
  console.log('pistol');
  const s = await page.evaluate(() => {
    const g = window.__game;
    g.weapons.select(1);
    const before = g.weapons.state.clip;
    g.input.mouse.right = true; g.input.mouse.left = true; g.input.locked = true;
    for (let i = 0; i < 6; i++) g.step(12);
    g.input.mouse.left = false; g.step(6);
    const after = g.weapons.state.clip;
    g.weapons.reload();
    for (let i = 0; i < 20; i++) g.step(6);
    g.input.mouse.right = false; g.input.locked = false; g.step(2);
    return { before, after, reloaded: g.weapons.state.clip, reserve: g.weapons.state.reserve };
  });
  check(s.after < s.before, `fires (${s.before} → ${s.after} rounds)`);
  check(s.reloaded === 12, `reloads to ${s.reloaded} (${s.reserve} left)`);
}

// Frame time: the simulation must not stutter.
const perf = await page.evaluate(() => { const g = window.__game; let worst = 0; for (let i = 0; i < 60; i++) { const t = performance.now(); g.step(1); worst = Math.max(worst, performance.now() - t); } return worst; });
check(perf < 60, `worst simulation step ${perf.toFixed(1)} ms`);
check(errors.length === 0, `no console errors${errors.length ? `:\n    ${errors.slice(0, 10).join('\n    ')}` : ''}`);

await browser.close();
server.close();
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
