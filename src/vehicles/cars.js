// The car list, shared by the game (carModel.js) and the build (scripts/cars.mjs, which turns each
// upload in public/art/vehicles/ into a light game copy in public/art/cars/<id>.glb).
// Visible names are parodies (no real brands). length: metres bumper to bumper. turn: extra
// rotation (radians) so the car faces +z. seat: driver's hip position (model space, right-hand drive).
// handling: this car's differences from the base handling (vehicle.js BASE_TUNE, the owner's tuned
// numbers). The tuning panel (F2) tunes the car you're in and can save numbers for that car only.
export const CARS = {
  ambassador: {
    file: 'hindustan_ambassador.glb', name: 'Hindostan Envoy', length: 4.33, turn: Math.PI, drive: 'rear', mass: 1150,
    accel: 5.6, top: 40, seat: [-0.36, 0.55, -0.25],
    // 1950s design: soft and wallowy, slow heavy steering, leans in corners, modest brakes.
    handling: { stiffness: 40, compression: 4.4, relaxation: 4.8, steerSpeed: 3.6, steerReturn: 5.8, steerMax: 0.62, frictionSlip: 1.9, antiRoll: 3, comHeight: 0.34, brake: 1.15, yawAssist: 0.5 },
  },
  wagonr: {
    file: 'wagon_r_tkanimationsd742.glb', name: 'Wagon Arre', length: 3.6, turn: 0, drive: 'front', mass: 880,
    accel: 6.2, top: 43, seat: [-0.33, 0.55, -0.1],
    // Tall, light city box: quick, light steering, a bit of lean, nervous at speed.
    handling: { stiffness: 48, steerSpeed: 5.2, steerMax: 0.7, steerFade: 0.09, frictionSlip: 2.0, comHeight: 0.35, antiRoll: 4.6, brake: 1.35, drag: 1.15 },
  },
  sx4: {
    file: 'suzuki_sx4_sportback.glb', name: 'Zuzuki SX5', length: 4.15, turn: Math.PI, drive: 'front', mass: 1150,
    accel: 7.0, top: 49, seat: [-0.36, 0.55, -0.2],
    // Sporty hatchback: the base numbers, a touch firmer and grippier.
    handling: { stiffness: 55, frictionSlip: 2.2 },
  },
  city: {
    file: '2008_honda_city_v_at.glb', name: 'Handa Metro', length: 4.4, turn: 0, drive: 'front', mass: 1100,
    accel: 7.4, top: 52, seat: [-0.36, 0.55, -0.25],
    // Low sedan: firm, planted, sharp steering, best brakes.
    handling: { stiffness: 58, compression: 5.9, relaxation: 6.5, steerSpeed: 5.0, frictionSlip: 2.25, comHeight: 0.28, brake: 1.55, yawAssist: 0.55 },
  },
};
