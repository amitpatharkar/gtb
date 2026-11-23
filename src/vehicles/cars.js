// The car list, shared by the game (carModel.js) and the build (scripts/cars.mjs, which turns each
// upload in public/art/vehicles/ into a light game copy in public/art/cars/<id>.glb).
// Visible names are parodies (no real brands). length: metres bumper to bumper. turn: extra
// rotation (radians) so the car faces +z. seat: driver's hip position (model space, right-hand drive).
// Handling numbers are a starting point; the tuning panel (F2) changes them live.
export const CARS = {
  ambassador: {
    file: 'hindustan_ambassador.glb', name: 'Hindostan Envoy', length: 4.33, turn: Math.PI, drive: 'rear', mass: 1150,
    accel: 5.6, top: 40, seat: [-0.36, 0.55, -0.25],
  },
  wagonr: {
    file: 'wagon_r_tkanimationsd742.glb', name: 'Wagon Arre', length: 3.6, turn: 0, drive: 'front', mass: 880,
    accel: 6.2, top: 43, seat: [-0.33, 0.55, -0.1],
  },
  sx4: {
    file: 'suzuki_sx4_sportback.glb', name: 'Zuzuki SX5', length: 4.15, turn: Math.PI, drive: 'front', mass: 1150,
    accel: 7.0, top: 49, seat: [-0.36, 0.55, -0.2],
  },
  city: {
    file: '2008_honda_city_v_at.glb', name: 'Handa Metro', length: 4.4, turn: 0, drive: 'front', mass: 1100,
    accel: 7.4, top: 52, seat: [-0.36, 0.55, -0.25],
  },
};
