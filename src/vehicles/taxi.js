import * as THREE from 'three';

// Kaali-peeli taxi in the spirit of the classic Premier Padmini (no real badges):
// L 3.73 m, W 1.47 m, H 1.43 m, wheelbase 2.34 m, 0.55 m wheels. Black body, yellow roof
// and pillars, chrome bumpers, round headlamps, yellow commercial number plate.
// The model faces +z; the origin is on the ground between the axles.

const L = 3.73, W = 1.47, WB = 2.34, WHEEL_R = 0.28, TRACK = 1.24;

function sideShape(points) {
  const s = new THREE.Shape();
  points.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  return s;
}

/** Extrude a side profile (x = along the car, y = up) across the width, centred. */
function extrudeProfile(points, width, bevel) {
  const g = new THREE.ExtrudeGeometry(sideShape(points), {
    depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 6,
  });
  g.translate(0, 0, -(width - bevel * 2) / 2);
  g.rotateY(-Math.PI / 2); // profile x → car +z (forward)
  g.computeVertexNormals();
  return g;
}

/** Lower body outline with wheel arches cut into the bottom edge. */
function bodyProfile() {
  const pts = [];
  const arch = (cx, from, to) => {
    for (let a = from; a <= to + 1e-6; a += Math.PI / 10) pts.push([cx + Math.cos(a) * 0.36, 0.2 + Math.sin(a) * 0.36]);
  };
  const half = L / 2 - 0.06;
  pts.push([-half, 0.3], [-half - 0.02, 0.62], [-half + 0.08, 0.8], [-0.9, 0.84], [0.6, 0.84], [half - 0.18, 0.8], [half, 0.66], [half + 0.02, 0.36], [half - 0.1, 0.24]);
  arch(WB / 2, 0, Math.PI);
  pts.push([0.4, 0.24], [-0.4, 0.24]);
  arch(-WB / 2, 0, Math.PI);
  pts.push([-half + 0.08, 0.24]);
  return pts;
}

function plateTexture(text) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#f7d000'; g.fillRect(0, 0, 256, 64);
  g.strokeStyle = '#111'; g.lineWidth = 4; g.strokeRect(3, 3, 250, 58);
  g.fillStyle = '#111'; g.font = 'bold 38px "Arial Narrow", Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 128, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createTaxi() {
  const root = new THREE.Group();
  const body = new THREE.Group(); // rolls and pitches on the suspension
  root.add(body);

  const black = new THREE.MeshPhysicalMaterial({ color: 0x0b0b0c, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.06 });
  const yellow = new THREE.MeshPhysicalMaterial({ color: 0xf7c600, roughness: 0.38, clearcoat: 0.9, clearcoatRoughness: 0.08 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, metalness: 1, roughness: 0.16 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0d1114, roughness: 0.04, metalness: 0.1, clearcoat: 1 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff6dd, emissive: 0xfff1c8, emissiveIntensity: 0.2, roughness: 0.1 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x8a0d0d, emissive: 0xff2010, emissiveIntensity: 0.15, roughness: 0.3 });

  const add = (geo, mat, parent = body) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  add(extrudeProfile(bodyProfile(), W, 0.07), black);
  // Glasshouse: dark glass core, yellow roof and pillars over it.
  const cabin = [[-1.3, 0.83], [-1.0, 1.36], [0.5, 1.37], [0.95, 0.83]];
  add(extrudeProfile(cabin, 1.3, 0.04), glass);
  const roof = [[-1.0, 1.3], [-0.97, 1.43], [0.52, 1.44], [0.55, 1.31]];
  add(extrudeProfile(roof, 1.34, 0.05), yellow);
  for (const [x0, x1] of [[-1.3, -1.0], [-0.2, -0.1], [0.92, 0.53]]) {
    // Pillars (C, B, A) on each side, yellow above the waist line.
    for (const side of [-1, 1]) {
      const p = extrudeProfile([[x0 - 0.04, 0.84], [x1 - 0.05, 1.33], [x1 + 0.05, 1.33], [x0 + 0.06, 0.84]], 0.07, 0.015);
      p.translate(side * 0.635, 0, 0);
      add(p, yellow);
    }
  }
  // Bumpers, grille, lamps, plates.
  add(new THREE.BoxGeometry(W + 0.04, 0.12, 0.12).translate(0, 0.36, L / 2 + 0.02), chrome);
  add(new THREE.BoxGeometry(W + 0.04, 0.12, 0.12).translate(0, 0.36, -L / 2 - 0.02), chrome);
  add(new THREE.BoxGeometry(0.62, 0.2, 0.04).translate(0, 0.6, L / 2 - 0.02), dark);
  add(new THREE.BoxGeometry(0.66, 0.24, 0.02).translate(0, 0.6, L / 2 - 0.035), chrome);
  for (const s of [-1, 1]) {
    add(new THREE.CylinderGeometry(0.095, 0.095, 0.06, 16).rotateX(Math.PI / 2).translate(s * 0.53, 0.62, L / 2 - 0.0), headMat);
    add(new THREE.TorusGeometry(0.1, 0.018, 6, 16).translate(s * 0.53, 0.62, L / 2 + 0.03), chrome);
    add(new THREE.BoxGeometry(0.16, 0.1, 0.05).translate(s * 0.58, 0.62, -L / 2 + 0.02), tailMat);
    // Door handles and a thin chrome waist strip.
    add(new THREE.BoxGeometry(0.02, 0.025, 2.6).translate(s * (W / 2 + 0.005), 0.72, 0), chrome);
    // Wing mirrors.
    add(new THREE.BoxGeometry(0.04, 0.09, 0.12).translate(s * (W / 2 + 0.08), 0.98, 0.75), black);
  }
  const plate = new THREE.MeshStandardMaterial({ map: plateTexture('MH 01 T 4721'), roughness: 0.5 });
  add(new THREE.PlaneGeometry(0.5, 0.12).translate(0, 0.46, L / 2 + 0.09), plate);
  add(new THREE.PlaneGeometry(0.5, 0.12).rotateY(Math.PI).translate(0, 0.52, -L / 2 - 0.06), plate);
  // Roof carrier rack.
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.03, 0.03, 1.2).translate(s * 0.5, 1.5, -0.25), chrome);
  for (const z of [-0.8, -0.25, 0.3]) add(new THREE.BoxGeometry(1.03, 0.025, 0.03).translate(0, 1.5, z), chrome);
  for (const [x, z] of [[-0.5, -0.8], [0.5, -0.8], [-0.5, 0.3], [0.5, 0.3]]) add(new THREE.BoxGeometry(0.03, 0.07, 0.03).translate(x, 1.46, z), chrome);
  // Dark interior and seats seen through the glass.
  add(new THREE.BoxGeometry(1.2, 0.45, 1.9).translate(0, 0.95, -0.2), dark);

  // Wheels: tyre + chrome hubcap; front pair steers.
  const tyreG = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.17, 18).rotateZ(Math.PI / 2);
  const capG = new THREE.CylinderGeometry(0.12, 0.12, 0.18, 14).rotateZ(Math.PI / 2);
  const wheels = [], steerers = [];
  for (const [x, z] of [[-TRACK / 2, WB / 2], [TRACK / 2, WB / 2], [-TRACK / 2, -WB / 2], [TRACK / 2, -WB / 2]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, WHEEL_R, z);
    const spin = new THREE.Group();
    pivot.add(spin);
    add(tyreG, rubber, spin);
    add(capG, chrome, spin);
    root.add(pivot);
    wheels.push(spin);
    if (z > 0) steerers.push(pivot);
  }
  return { root, body, wheels, steerers, lights: { headMat, tailMat }, wheelRadius: WHEEL_R, wheelBase: WB };
}
