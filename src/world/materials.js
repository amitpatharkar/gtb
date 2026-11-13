import * as THREE from 'three';

// Procedural textures drawn on canvases: no image downloads, nothing to license.

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function seeded(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function texture(c, { srgb = true, aniso = 1 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  return t;
}

/**
 * Facade: 4 × 4 windows (one window per bay and storey). White wall so the
 * per-building vertex colour tints it. Returns colour and roughness maps.
 */
function facadeTextures(aniso) {
  const S = 512, cell = S / 4;
  const [c, g] = canvas(S, S);
  const [rc, rg] = canvas(S, S);
  const rnd = seeded(42);
  g.fillStyle = '#f2f2f0';
  g.fillRect(0, 0, S, S);
  rg.fillStyle = '#e6e6e6'; // rough plaster
  rg.fillRect(0, 0, S, S);
  // Monsoon stains: faint vertical streaks.
  for (let i = 0; i < 70; i++) {
    const x = rnd() * S, w = 2 + rnd() * 10, h = 20 + rnd() * 200;
    g.fillStyle = `rgba(70,65,55,${0.03 + rnd() * 0.06})`;
    g.fillRect(x, rnd() * S, w, h);
  }
  const curtains = ['#c9a46b', '#b8625a', '#6b8fb3', '#d8c9a8', '#7a9c6b', '#e0d6c8'];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const x = col * cell, y = row * cell;
      // Floor slab band
      g.fillStyle = 'rgba(0,0,0,0.10)';
      g.fillRect(x, y + cell - 7, cell, 7);
      const wx = x + cell * 0.27, wy = y + cell * 0.24, ww = cell * 0.46, wh = cell * 0.44;
      // Window frame + sunshade (chajja) above it
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.fillRect(wx - 6, wy - 12, ww + 12, 7);
      g.fillStyle = '#d9d6cf';
      g.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
      // Glass, sometimes with curtains
      const grad = g.createLinearGradient(wx, wy, wx + ww, wy + wh);
      grad.addColorStop(0, '#6f8796');
      grad.addColorStop(1, '#34414b');
      g.fillStyle = grad;
      g.fillRect(wx, wy, ww, wh);
      rg.fillStyle = '#262626'; // glossy glass reflects the sky
      rg.fillRect(wx, wy, ww, wh);
      if (rnd() < 0.45) {
        g.fillStyle = curtains[Math.floor(rnd() * curtains.length)];
        const cw = ww * (0.3 + rnd() * 0.5);
        g.fillRect(rnd() < 0.5 ? wx : wx + ww - cw, wy, cw, wh);
        rg.fillStyle = '#b0b0b0';
        rg.fillRect(wx, wy, ww, wh);
      }
      // Window bars
      g.fillStyle = '#e8e4dc';
      g.fillRect(wx + ww / 2 - 1.5, wy, 3, wh);
      if (rnd() < 0.5) {
        g.fillStyle = 'rgba(30,30,30,0.55)';
        for (let k = 1; k < 6; k++) g.fillRect(wx + (ww * k) / 6, wy, 1.5, wh);
      }
      // Air-conditioner box below some windows
      if (rnd() < 0.35) {
        const ax = wx + rnd() * (ww - 34);
        g.fillStyle = '#d0d0cc';
        g.fillRect(ax, wy + wh + 6, 34, 18);
        g.fillStyle = '#9a9a96';
        for (let k = 0; k < 4; k++) g.fillRect(ax + 3, wy + wh + 9 + k * 4, 28, 1.5);
      }
    }
  }
  return { map: texture(c, { aniso }), roughnessMap: texture(rc, { srgb: false, aniso }) };
}

/** Asphalt with white edge lines and a dashed centre line. v runs along the road. */
function roadTexture(aniso) {
  const [c, g] = canvas(128, 256);
  const rnd = seeded(7);
  g.fillStyle = '#3c3c3e';
  g.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 2500; i++) {
    const v = 40 + rnd() * 40;
    g.fillStyle = `rgba(${v},${v},${v + 2},0.5)`;
    g.fillRect(rnd() * 128, rnd() * 256, 1.5, 1.5);
  }
  g.fillStyle = 'rgba(30,30,30,0.35)'; // tyre wear
  g.fillRect(22, 0, 16, 256); g.fillRect(90, 0, 16, 256);
  g.fillStyle = '#e8e6df';
  g.fillRect(4, 0, 3, 256); g.fillRect(121, 0, 3, 256);
  g.fillStyle = '#f2f0ea';
  g.fillRect(62, 0, 4, 128);
  return texture(c, { aniso });
}

/** Small greyscale grain that breaks up flat ground colours. */
function grainTexture(aniso) {
  const [c, g] = canvas(128, 128);
  const rnd = seeded(3);
  g.fillStyle = '#e6e6e6';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 4000; i++) {
    const v = 190 + rnd() * 65;
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(rnd() * 128, rnd() * 128, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  return texture(c, { aniso });
}

/** Ballast with one concrete sleeper; v repeats every 0.65 m along the track. */
function sleeperTexture(aniso) {
  const [c, g] = canvas(64, 64);
  const rnd = seeded(11);
  g.fillStyle = '#8a8070';
  g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 600; i++) {
    const v = 90 + rnd() * 90;
    g.fillStyle = `rgb(${v},${v - 8},${v - 20})`;
    g.fillRect(rnd() * 64, rnd() * 64, 2, 2);
  }
  g.fillStyle = '#b4afa6';
  g.fillRect(8, 22, 48, 20);
  return texture(c, { aniso });
}

export function createMaterials(renderer) {
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const facade = facadeTextures(aniso);
  const grain = grainTexture(aniso);
  return {
    walls: new THREE.MeshStandardMaterial({ vertexColors: true, map: facade.map, roughnessMap: facade.roughnessMap, roughness: 1, metalness: 0 }),
    roofs: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
    ground: new THREE.MeshStandardMaterial({
      vertexColors: true, map: grain, roughness: 1,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2,
    }),
    roadsPlain: new THREE.MeshStandardMaterial({
      vertexColors: true, map: grain, roughness: 0.92,
      polygonOffset: true, polygonOffsetFactor: 0.5, polygonOffsetUnits: 1,
    }),
    roadsMarked: new THREE.MeshStandardMaterial({ map: roadTexture(aniso), roughness: 0.88 }),
    railBed: new THREE.MeshStandardMaterial({
      map: sleeperTexture(aniso), roughness: 1,
      polygonOffset: true, polygonOffsetFactor: 0.5, polygonOffsetUnits: 1,
    }),
    railSteel: new THREE.MeshStandardMaterial({ color: 0xa6abb0, metalness: 0.85, roughness: 0.3 }),
    tank: new THREE.MeshStandardMaterial({ color: 0x1d1d1f, roughness: 0.55 }),
  };
}
