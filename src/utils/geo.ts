// ─── GPS geometry and fix filtering ─────────────────────────────────────────
// Consumer GPS is noisy in ways that quietly wreck ride stats: a phone sitting
// at a traffic light will "wander" tens of metres, and raw altitude drifts far
// more than the hills you actually climbed. Every constant below exists to stop
// one of those specific failure modes.

import type { RidePoint, RideAccumulators } from '@/types/ride';

const EARTH_RADIUS_M = 6371008.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

// ─── Filter thresholds ──────────────────────────────────────────────────────

/** Drop fixes worse than this. Urban canyons routinely emit 50-100m garbage. */
export const MAX_ACCURACY_M = 25;
/** Above this the "fix" is a teleport, not a bike. 30 m/s = 67 mph. */
export const MAX_PLAUSIBLE_SPEED_MPS = 30;
/** Below this we call it stopped, so it stops accruing moving time. ~1.8 mph. */
export const MOVING_THRESHOLD_MPS = 0.8;
/** Below this we hold off banking distance — slower than any real walk, even uphill. ~0.7 mph. */
export const STILL_SPEED_MPS = 0.3;
/** Ignore sub-second fixes; they add noise and no information. */
export const MIN_FIX_INTERVAL_MS = 500;
/** No fix for this long means the recorder was suspended — log a gap. */
export const GAP_THRESHOLD_MS = 10_000;

/** Weight of each new altitude sample in the EMA. Low: altitude is the noisiest channel. */
const ALT_SMOOTHING = 0.2;
/** Only bank climbing once smoothed altitude clears the reference by this much. */
const ELEVATION_THRESHOLD_M = 3;

export type FixRejection =
  | 'inaccurate'
  | 'too-soon'
  | 'implausible-speed'
  | 'within-noise';

export interface FixDecision {
  accept: boolean;
  reason?: FixRejection;
  /** Metres to bank: straight line from the anchor (0 for the first, or within noise). */
  distanceMeters: number;
  /** Straight-line metres from the anchor, reported even when within noise. */
  displacementMeters: number;
  /** Milliseconds since the anchor — the span `distanceMeters` covers (0 for the first). */
  elapsedMs: number;
}

const reject = (reason: FixRejection): FixDecision => ({
  accept: false,
  reason,
  distanceMeters: 0,
  displacementMeters: 0,
  elapsedMs: 0,
});

/**
 * Decide whether a new fix is real movement or noise.
 *
 * The `within-noise` rule is the one that matters most: a stationary phone
 * reporting ±10m accuracy will produce a random walk that silently inflates
 * distance by a mile over a coffee stop. Requiring movement to clear a fraction
 * of the reported accuracy filters that out.
 *
 * Crucially, that movement is measured from the `anchor` — the last point that
 * banked distance — not from the previous fix. At 1 fix/second a walker covers
 * ~1.4m and a runner ~3m per fix, both under the noise floor; comparing
 * consecutive fixes threw away nearly every step of a run. Measuring from the
 * anchor lets slow progress accumulate across fixes until it clears the floor,
 * while a stationary phone's jitter stays pinned near the anchor.
 */
export function evaluateFix(
  previous: RidePoint | null,
  next: RidePoint,
  anchor: RidePoint | null = previous
): FixDecision {
  if (next.acc > MAX_ACCURACY_M) {
    return reject('inaccurate');
  }
  if (!previous) {
    return { accept: true, distanceMeters: 0, displacementMeters: 0, elapsedMs: 0 };
  }

  const stepMs = next.t - previous.t;
  if (stepMs < MIN_FIX_INTERVAL_MS) {
    return reject('too-soon');
  }

  // Teleport check is per fix: a single bad fix shouldn't be averaged away over the span.
  const stepMeters = haversineMeters(previous.lat, previous.lon, next.lat, next.lon);
  if (stepMeters / (stepMs / 1000) > MAX_PLAUSIBLE_SPEED_MPS) {
    return reject('implausible-speed');
  }

  const from = anchor ?? previous;
  const elapsedMs = next.t - from.t;
  const displacementMeters = haversineMeters(from.lat, from.lon, next.lat, next.lon);

  // Noise floor scales with the reported accuracy of the *worse* of the two fixes.
  const noiseFloor = Math.max(3, Math.max(from.acc, next.acc) * 0.5);
  // A stationary phone's jitter can still wander past the floor, but it does so
  // slowly — and the device's Doppler speed knows it's standing still. Holding
  // the anchor only delays banking: real movement is credited in full once the
  // pace since the anchor shows it.
  const stillish = resolveSpeedMps(next, displacementMeters, elapsedMs) < STILL_SPEED_MPS;
  if (displacementMeters < noiseFloor || stillish) {
    // Stopped, or not yet far enough to tell — keep the anchor and bank nothing yet.
    return { accept: true, reason: 'within-noise', distanceMeters: 0, displacementMeters, elapsedMs };
  }

  return { accept: true, distanceMeters: displacementMeters, displacementMeters, elapsedMs };
}

/**
 * Fold a new altitude sample into the running elevation gain.
 *
 * Integrating raw GPS altitude is the classic way to report 900ft of climbing
 * on a pancake-flat ride: the ±10-20m noise is one-sided once you only sum the
 * positives. Smoothing first, then requiring a 3m confirmed rise, kills nearly
 * all of it. Mutates `accum` and returns the metres of gain to add.
 */
export function accumulateElevationGain(
  accum: RideAccumulators,
  altitude: number | null
): number {
  if (altitude === null || !Number.isFinite(altitude)) return 0;

  if (accum.smoothedAlt === null) {
    accum.smoothedAlt = altitude;
    accum.altReference = altitude;
    return 0;
  }

  accum.smoothedAlt = accum.smoothedAlt + ALT_SMOOTHING * (altitude - accum.smoothedAlt);
  const reference = accum.altReference ?? accum.smoothedAlt;
  const delta = accum.smoothedAlt - reference;

  if (delta > ELEVATION_THRESHOLD_M) {
    accum.altReference = accum.smoothedAlt;
    return delta;
  }
  if (delta < -ELEVATION_THRESHOLD_M) {
    // Descending: move the reference down so the next climb measures from here.
    accum.altReference = accum.smoothedAlt;
  }
  return 0;
}

/**
 * Grade (rise/run) from the EMA-smoothed altitude, clamped to real-road range.
 *
 * Raw per-fix altitude deltas are dominated by GPS jitter: at walking speed a
 * ±2m altitude wobble over a 1.4m step saturates the clamp on every fix, and
 * an energy model that integrates max(0, grade) banks hundreds of phantom
 * kilocalories on flat ground. The EMA (α=0.2) attenuates that noise ~5× while
 * still tracking sustained grades — the per-fix delta of an EMA converges to
 * the true slope on a steady climb.
 */
export function smoothedGradeBetween(
  prevSmoothedAlt: number | null,
  nextSmoothedAlt: number | null,
  distanceMeters: number
): number {
  if (distanceMeters < 1 || prevSmoothedAlt === null || nextSmoothedAlt === null) return 0;
  const grade = (nextSmoothedAlt - prevSmoothedAlt) / distanceMeters;
  return Math.max(-0.2, Math.min(0.2, grade));
}

/** Ground speed for a fix, preferring the device's Doppler value over differentiation. */
export function resolveSpeedMps(
  point: RidePoint,
  distanceMeters: number,
  elapsedMs: number
): number {
  if (point.spd !== null && Number.isFinite(point.spd) && point.spd >= 0) {
    return point.spd;
  }
  if (elapsedMs <= 0) return 0;
  return distanceMeters / (elapsedMs / 1000);
}
