// ─── Cycling power and energy model ─────────────────────────────────────────
// Without a power meter, calories have to be inferred. We integrate a standard
// road-cycling power equation over the ride (rolling resistance + gravity +
// aerodynamic drag), then convert mechanical work to metabolic energy. This is
// broadly what Strava does for a rider with no power data, and unlike a flat
// MET table it actually rewards climbing into a headwind.

const GRAVITY = 9.80665;
/** Air density at sea level, 15°C. Fine for New England riding. */
const AIR_DENSITY = 1.225;
/** Rolling resistance: decent road tyres on asphalt. */
const CRR = 0.005;
/** Drag area (m²) for a rider on the hoods. Tucked is ~0.30, upright ~0.42. */
const CDA = 0.36;
/** Chain and bearing losses. */
const DRIVETRAIN_EFFICIENCY = 0.97;
/**
 * Gross metabolic efficiency of cycling — trained and untrained riders both sit
 * near 20-25%. The happy accident of this number: 1 kJ of mechanical work costs
 * almost exactly 1 kcal, which is why power meters can quote them interchangeably.
 */
const GROSS_EFFICIENCY = 0.24;
const JOULES_PER_KCAL = 4184;

/** Bike + shoes + bottles + tools, kg. */
export const DEFAULT_BIKE_MASS_KG = 9;
/** 165 lb — the fallback when the profile has no weight recorded. */
export const DEFAULT_RIDER_MASS_KG = 74.8;

/**
 * Metabolic floor while riding, in METs. The physics model reports zero cost
 * for coasting downhill, which is wrong — you're still a running engine holding
 * a bike upright. 1.5 METs is roughly "sitting up, doing something".
 */
const MIN_RIDING_METS = 1.5;

export const LBS_TO_KG = 0.45359237;

export interface RiderParams {
  riderMassKg: number;
  bikeMassKg: number;
  crr: number;
  cda: number;
}

export function defaultRiderParams(riderMassKg = DEFAULT_RIDER_MASS_KG): RiderParams {
  return {
    riderMassKg,
    bikeMassKg: DEFAULT_BIKE_MASS_KG,
    crr: CRR,
    cda: CDA,
  };
}

/** Convert a profile weight to kilograms. */
export function toKilograms(weight: number | undefined, unit: 'lbs' | 'kg'): number {
  if (!weight || !Number.isFinite(weight) || weight <= 0) return DEFAULT_RIDER_MASS_KG;
  return unit === 'kg' ? weight : weight * LBS_TO_KG;
}

/**
 * Mechanical power at the wheel, watts, for a given speed and grade.
 *
 * Returns 0 rather than a negative number when gravity is doing the work —
 * you cannot "un-burn" calories coasting down the far side of a hill.
 */
export function cyclingPowerWatts(
  speedMps: number,
  grade: number,
  params: RiderParams
): number {
  if (speedMps <= 0) return 0;

  const totalMass = params.riderMassKg + params.bikeMassKg;
  const angle = Math.atan(grade);

  const rolling = params.crr * totalMass * GRAVITY * Math.cos(angle);
  const gravity = totalMass * GRAVITY * Math.sin(angle);
  const drag = 0.5 * AIR_DENSITY * params.cda * speedMps * speedMps;

  const watts = (rolling + gravity + drag) * speedMps;
  return Math.max(0, watts);
}

export interface EnergyIncrement {
  /** Mechanical work at the wheel over this interval, kilojoules. */
  workKJ: number;
  /** Metabolic energy over this interval, kilocalories. */
  kcal: number;
}

/**
 * Energy cost of one interval of riding. Called once per accepted GPS fix, so
 * the integration step is roughly one second.
 */
export function energyForInterval(
  speedMps: number,
  grade: number,
  seconds: number,
  params: RiderParams
): EnergyIncrement {
  if (seconds <= 0 || !Number.isFinite(seconds)) return { workKJ: 0, kcal: 0 };

  const wheelWatts = cyclingPowerWatts(speedMps, grade, params);
  const riderWatts = wheelWatts / DRIVETRAIN_EFFICIENCY;

  const mechanicalJoules = riderWatts * seconds;
  const metabolicJoules = mechanicalJoules / GROSS_EFFICIENCY;
  const modelKcal = metabolicJoules / JOULES_PER_KCAL;

  // MET floor: kcal/min = MET × 3.5 × kg / 200
  const floorKcal = ((MIN_RIDING_METS * 3.5 * params.riderMassKg) / 200) * (seconds / 60);

  return {
    workKJ: (wheelWatts * seconds) / 1000,
    kcal: Math.max(modelKcal, floorKcal),
  };
}

/**
 * Compendium-of-Physical-Activities MET value for a given average speed.
 * Only used as a sanity fallback when a ride produced no usable speed data.
 */
export function metsForAverageSpeed(speedMps: number): number {
  const mph = speedMps * 2.23694;
  if (mph < 10) return 4.0;
  if (mph < 12) return 6.8;
  if (mph < 14) return 8.0;
  if (mph < 16) return 10.0;
  if (mph < 20) return 12.0;
  return 15.8;
}

/** Whole-ride MET fallback estimate, kilocalories. */
export function metCalories(
  avgSpeedMps: number,
  movingSeconds: number,
  riderMassKg: number
): number {
  const mets = metsForAverageSpeed(avgSpeedMps);
  return ((mets * 3.5 * riderMassKg) / 200) * (movingSeconds / 60);
}
