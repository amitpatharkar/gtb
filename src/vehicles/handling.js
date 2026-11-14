// Vehicle handling as data, the way GTA V's handling.meta does it: one table entry per vehicle
// type sets its body (mass, centre of mass, drag), drivetrain (drive force, gears, top speed,
// which wheels drive), brakes and steering, tyre grip (a grip curve that peaks at a slip angle
// and then falls to a sliding value), suspension (spring frequency, damping, anti-roll bar)
// and how much it suffers in crashes. car.js reads only this table, so a vehicle's feel is
// changed here, not in code. Classes give the defaults; each type overrides what differs.
//
// Units: kg, m, s; forces as accelerations (m/s²) so they mean the same for a scooter and a bus.

export const G = 9.81;

/**
 * Ground under a wheel. grip multiplies the tyre's grip (before the vehicle's off-road loss),
 * roll is rolling resistance (m/s²), bump is how much the surface shakes the body.
 * `loose` surfaces are where off-road loss (fTractionLossMult) applies.
 */
export const SURFACE = [
  { id: 'asphalt', grip: 1.0, roll: 0.12, bump: 0, loose: 0 },
  { id: 'worn', grip: 0.96, roll: 0.16, bump: 0.3, loose: 0 },      // patched tertiary roads
  { id: 'rough', grip: 0.9, roll: 0.24, bump: 1, loose: 0.15 },      // broken lanes
  { id: 'paved', grip: 0.92, roll: 0.16, bump: 0.2, loose: 0 },      // footpath pavers, plazas, plots
  { id: 'grass', grip: 0.62, roll: 0.9, bump: 0.6, loose: 1 },       // maidans, parks
  { id: 'sand', grip: 0.5, roll: 2.6, bump: 0.4, loose: 1 },         // Juhu, Chowpatty
  { id: 'dirt', grip: 0.7, roll: 0.7, bump: 0.8, loose: 0.8 },       // railway yards, building sites
  { id: 'wet', grip: 0.72, roll: 0.2, bump: 0, loose: 0 },           // a puddle under the wheel
];
export const SURF = Object.fromEntries(SURFACE.map((s, i) => [s.id.toUpperCase(), i]));

// ---------------------------------------------------------------- classes
// GTA names in brackets: fMass, vecCentreOfMassOffset, fInitialDragCoeff, fDriveBiasFront, …
const BASE = {
  // Body
  mass: 900,            // kg (fMass)
  front: 0.58,          // share of the weight on the front axle (centre of mass offset)
  comHeight: 0.52,      // m above the ground (vecCentreOfMassOffset.z)
  inertia: 1.0,         // yaw inertia multiplier (vecInertiaMultiplier)
  drag: 0.0011,         // aerodynamic drag, m/s² per (m/s)² (fInitialDragCoeff)
  downforce: 0.00008,   // extra grip per (m/s)² (fDownforceModifier: "downforce rises with speed")
  // Drivetrain
  driveBias: 1,         // 1 front-wheel drive, 0 rear, 0.5 four-wheel (fDriveBiasFront)
  gears: 5,             // (nInitialDriveGears)
  driveForce: 6.2,      // m/s² in first gear on a flat torque curve (fInitialDriveForce)
  topSpeed: 28,         // m/s at the rev limiter in top gear (fInitialDriveMaxFlatVel)
  shift: 0.22,          // s without drive while changing up (fClutchChangeRateScaleUpShift)
  reverse: 0.6,         // reverse drive force as a share of first gear
  // Brakes and steering
  brakeForce: 9,        // m/s² (fBrakeForce)
  brakeBias: 0.62,      // share on the front axle (fBrakeBiasFront)
  handbrake: 1,         // how hard the handbrake locks the rear (fHandBrakeForce)
  steerLock: 0.62,      // rad at walking pace (fSteeringLock)
  // Traction
  gripMax: 1.45,        // grip at the peak of the curve (fTractionCurveMax); high = "glued" GTA feel
  gripMin: 1.15,        // grip when sliding (fTractionCurveMin)
  slipPeak: 0.19,       // rad of slip angle where grip peaks (fTractionCurveLateral)
  gripBias: 0.5,        // front/rear grip split (fTractionBiasFront)
  offroadLoss: 0.6,     // share of the surface's grip loss felt on loose ground (fTractionLossMult)
  // Suspension
  spring: 1.6,          // Hz (fSuspensionForce)
  damping: 0.5,         // share of critical damping (fSuspensionCompDamp / ReboundDamp)
  travel: 0.13,         // m of droop before a wheel leaves the ground (fSuspensionLowerLimit)
  antiRoll: 0.6,        // anti-roll bar stiffness (fAntiRollBarForce)
  rollBias: 0.6,        // share of the anti-roll at the front (fAntiRollBarBiasFront): more = understeer
  // Assists (GTA's hidden arcade helpers)
  stability: 1,         // pulls back a yaw rate the steering did not ask for (no easy spin-outs)
  tipAssist: 1,         // slides instead of lifting the inside wheels (no easy rollovers)
  // Damage
  collisionDamage: 1,   // condition lost in crashes (fCollisionDamageMult)
  engineDamage: 1,      // how much a battered engine loses power and misfires (fEngineDamageMult)
  deformation: 1,       // how deep the dents go (fDeformationDamageMult)
  tyres: 1,             // puncture resistance (potholes)
  restitution: 0.18,    // bounce off walls
  // Two-wheelers
  wheelie: 0,           // lean-back pitch per unit of drive (0 = never lifts the front)
};

const CLASS = {
  hatch: {},
  sedan: { mass: 1050, front: 0.6, inertia: 1.1, drag: 0.001, gripMax: 1.5, spring: 1.5, damping: 0.48 },
  mpv: { mass: 1250, front: 0.56, comHeight: 0.62, inertia: 1.25, drag: 0.00125, gripMax: 1.38, gripMin: 1.1, spring: 1.4, antiRoll: 0.5, tipAssist: 1 },
  suv: { mass: 1650, front: 0.55, comHeight: 0.7, inertia: 1.3, drag: 0.00135, driveBias: 0, gripMax: 1.34, gripMin: 1.1, offroadLoss: 0.3, spring: 1.3, damping: 0.42, travel: 0.18, antiRoll: 0.45, collisionDamage: 0.7, deformation: 0.7 },
  van: { mass: 950, front: 0.52, comHeight: 0.68, inertia: 1.15, drag: 0.0014, driveBias: 0, gripMax: 1.3, gripMin: 1.05, spring: 1.5, antiRoll: 0.4 },
  truck: { mass: 3200, front: 0.48, comHeight: 0.95, inertia: 1.6, drag: 0.0018, driveBias: 0, gears: 5, shift: 0.38, brakeForce: 6.5, brakeBias: 0.55, steerLock: 0.6, gripMax: 1.05, gripMin: 0.85, slipPeak: 0.17, offroadLoss: 0.4, spring: 1.3, damping: 0.4, travel: 0.16, antiRoll: 0.5, tipAssist: 0.92, collisionDamage: 0.45, deformation: 0.5, restitution: 0.1 },
  bus: { mass: 11000, front: 0.42, comHeight: 1.2, inertia: 2.2, drag: 0.0022, driveBias: 0, gears: 5, shift: 0.45, brakeForce: 5.5, brakeBias: 0.55, steerLock: 0.62, gripMax: 0.95, gripMin: 0.8, slipPeak: 0.16, spring: 1.1, damping: 0.38, travel: 0.15, antiRoll: 0.55, tipAssist: 0.95, collisionDamage: 0.3, deformation: 0.4, restitution: 0.08 },
  scooter: { mass: 110, front: 0.42, comHeight: 0.62, inertia: 0.9, drag: 0.002, driveBias: 0, gears: 1, shift: 0, brakeForce: 7, brakeBias: 0.55, steerLock: 0.7, gripMax: 1.25, gripMin: 0.95, slipPeak: 0.2, offroadLoss: 0.7, spring: 1.8, damping: 0.55, travel: 0.1, stability: 1.2, collisionDamage: 1.4, deformation: 0.6, restitution: 0.25, wheelie: 0.4 },
  bike: { mass: 115, front: 0.45, comHeight: 0.6, inertia: 0.9, drag: 0.0018, driveBias: 0, gears: 4, shift: 0.14, brakeForce: 8, brakeBias: 0.6, steerLock: 0.7, gripMax: 1.3, gripMin: 1.0, slipPeak: 0.2, offroadLoss: 0.6, spring: 1.7, damping: 0.5, travel: 0.12, stability: 1.2, collisionDamage: 1.4, deformation: 0.6, restitution: 0.25, wheelie: 0.75 },
  auto: { mass: 380, front: 0.32, comHeight: 0.62, inertia: 0.9, drag: 0.0022, driveBias: 0, gears: 4, shift: 0.3, brakeForce: 6.5, brakeBias: 0.4, steerLock: 0.7, gripMax: 1.05, gripMin: 0.88, slipPeak: 0.2, offroadLoss: 0.6, spring: 1.6, damping: 0.4, travel: 0.11, antiRoll: 0.2, tipAssist: 0.35, collisionDamage: 1.2, restitution: 0.2, threeWheeler: true },
  cycle: { mass: 20, front: 0.4, comHeight: 0.75, inertia: 0.8, drag: 0.004, driveBias: 0, gears: 1, shift: 0, brakeForce: 5, steerLock: 0.75, gripMax: 1.1, gripMin: 0.9, slipPeak: 0.22, offroadLoss: 0.5, spring: 2, damping: 0.5, travel: 0.06, stability: 1.3, collisionDamage: 1.5, restitution: 0.3, wheelie: 0.25 },
};

/**
 * Per vehicle type: its class plus what differs. Top speeds and drive forces keep the game's
 * earlier tuning (garage DRIVE), masses its kerb weights. The kaali-peeli is the 1960s
 * Premier Padmini: rear-wheel drive, four gears, soft springs, lots of body roll.
 */
export const HANDLING = {
  kaali: { cls: 'hatch', mass: 900, front: 0.56, comHeight: 0.56, driveBias: 0, gears: 4, driveForce: 6.4, topSpeed: 28, spring: 1.3, damping: 0.4, antiRoll: 0.35, gripMax: 1.45, gripMin: 1.18, collisionDamage: 0.9, wheelBase: 2.34, track: 1.27 }, // the player's own Padmini
  taxi: { cls: 'hatch', mass: 850, driveForce: 6.4, topSpeed: 28, comHeight: 0.58 }, // today's WagonR / Santro kaali-peelis in traffic
  padmini: { cls: 'hatch', mass: 900, front: 0.56, comHeight: 0.56, driveBias: 0, gears: 4, driveForce: 6.4, topSpeed: 26, spring: 1.3, damping: 0.4, antiRoll: 0.35 },
  alto: { cls: 'hatch', mass: 760, driveForce: 6.2, topSpeed: 27, comHeight: 0.5 },
  wagonr: { cls: 'hatch', mass: 850, driveForce: 6.4, topSpeed: 28, comHeight: 0.58 },
  taxiI10: { cls: 'hatch', mass: 900, driveForce: 6.6, topSpeed: 29 },
  i10: { cls: 'hatch', mass: 900, driveForce: 6.8, topSpeed: 30 },
  swift: { cls: 'hatch', mass: 900, driveForce: 7.9, topSpeed: 34, gripMax: 1.52, spring: 1.75, antiRoll: 0.7 },
  dzire: { cls: 'sedan', mass: 950, driveForce: 7.5, topSpeed: 33 },
  cabDzire: { cls: 'sedan', mass: 950, driveForce: 7.5, topSpeed: 33 },
  city: { cls: 'sedan', mass: 1150, driveForce: 8.6, topSpeed: 38, gripMax: 1.55, spring: 1.6, antiRoll: 0.65 },
  ertiga: { cls: 'mpv', mass: 1200, driveForce: 6.6, topSpeed: 31 },
  cabErtiga: { cls: 'mpv', mass: 1200, driveForce: 6.6, topSpeed: 31 },
  coolcab: { cls: 'mpv', mass: 1200, driveForce: 6.6, topSpeed: 31 },
  innova: { cls: 'mpv', mass: 1800, driveBias: 0, driveForce: 7, topSpeed: 34, comHeight: 0.68, collisionDamage: 0.75 },
  bolero: { cls: 'suv', mass: 1650, driveForce: 6, topSpeed: 29, comHeight: 0.78, gripMax: 1.28 },
  creta: { cls: 'suv', mass: 1300, driveBias: 1, driveForce: 7.7, topSpeed: 36, comHeight: 0.64, gripMax: 1.42 },
  eeco: { cls: 'van', mass: 950, driveForce: 5.5, topSpeed: 25 },
  ambulance: { cls: 'van', mass: 1000, driveForce: 6.6, topSpeed: 30, damping: 0.6 },
  ace: { cls: 'truck', mass: 1100, comHeight: 0.8, driveForce: 4, topSpeed: 20, gears: 4, inertia: 1.3, brakeForce: 7, collisionDamage: 0.8 },
  tempo: { cls: 'truck', mass: 3200, driveForce: 3.5, topSpeed: 21 },
  tanker: { cls: 'truck', mass: 7500, comHeight: 1.15, driveForce: 3.1, topSpeed: 19, tipAssist: 0.85, inertia: 1.9 },
  compactor: { cls: 'truck', mass: 8000, comHeight: 1.1, driveForce: 2.9, topSpeed: 17, inertia: 1.9 },
  bus: { cls: 'bus', driveForce: 2.9, topSpeed: 18 },
  school: { cls: 'bus', mass: 9000, driveForce: 2.8, topSpeed: 17 },
  decker: { cls: 'bus', mass: 15000, comHeight: 1.55, driveForce: 2.5, topSpeed: 16, tipAssist: 0.97 },
  scooter: { cls: 'scooter', driveForce: 7.2, topSpeed: 22 },
  delivery: { cls: 'scooter', mass: 120, driveForce: 7.2, topSpeed: 22 },
  bike: { cls: 'bike', driveForce: 8.8, topSpeed: 27 },
  bullet: { cls: 'bike', mass: 195, driveForce: 7.9, topSpeed: 30, comHeight: 0.62, wheelie: 0.95, gears: 5 },
  auto: { cls: 'auto', driveForce: 4.6, topSpeed: 17 },
  cycle: { cls: 'cycle', driveForce: 3.5, topSpeed: 8 },
  dabba: { cls: 'cycle', mass: 40, driveForce: 3.3, topSpeed: 8, comHeight: 0.85 },
};

const cache = new Map();

/**
 * The full handling for a vehicle type (class defaults + overrides + layout from its size).
 * `spec` is the fleet type ({ len, wid, rider, open, base }) for vehicles from traffic; the
 * player's own taxi ('kaali') passes null and uses its own wheelbase and track.
 */
export function handlingFor(type, spec = null) {
  const key = type || 'kaali';
  let h = cache.get(key); // one fleet type per key, so the size it was first built with stays right
  if (h) return h;
  const own = HANDLING[key] || (spec?.base && HANDLING[spec.base]) || HANDLING.alto;
  h = { ...BASE, ...CLASS[own.cls || 'hatch'], ...own, type: key };
  const len = spec?.len ?? 3.73, wid = spec?.wid ?? 1.47;
  h.wheelBase ??= Math.max(1.15, len * (spec?.rider ? 0.66 : h.cls === 'bus' ? 0.55 : 0.63));
  h.track ??= spec?.rider ? 0 : Math.max(0.9, wid * 0.86);
  h.twoWheeler = !!spec?.rider;
  h.length = len; h.width = wid;
  // Front single wheel: the auto can only lean on the triangle between its three wheels.
  h.tipTrack = h.threeWheeler ? h.track * 0.58 : h.track;
  cache.set(key, h);
  return h;
}

/** Kerb weights by type (kg), for collisions with vehicles the player does not drive. */
export const MASS = Object.fromEntries(Object.entries(HANDLING).map(([k, o]) => [k, o.mass ?? CLASS[o.cls]?.mass ?? BASE.mass]));
