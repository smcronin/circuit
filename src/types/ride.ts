// ─── GPS ride recording ─────────────────────────────────────────────────────
// Circuit records rides directly from the phone's GPS instead of round-tripping
// through Strava. Everything here is derived from the raw browser Geolocation
// stream, so the types stay close to what `GeolocationPosition` actually gives
// us — including the accuracy fields, which the filters depend on.

/** A single accepted GPS fix. Kept deliberately small: a 2h ride is ~7k of these. */
export interface RidePoint {
  /** Epoch milliseconds of the fix. */
  t: number;
  lat: number;
  lon: number;
  /** Metres above the WGS84 ellipsoid, or null when the device won't say. */
  alt: number | null;
  /** Horizontal accuracy in metres (68% confidence, per spec). */
  acc: number;
  /** Device-reported ground speed in m/s. More accurate than differentiating position. */
  spd: number | null;
}

/**
 * A stretch of time where the recorder was not receiving fixes — almost always
 * because the screen locked and iOS suspended the PWA. Tracked explicitly so
 * the summary can admit what it missed rather than silently drawing a straight
 * line through it.
 */
export interface RideGap {
  startedAt: number;
  endedAt: number;
  /** Straight-line metres between the fix before and the fix after the gap. */
  skippedMeters: number;
}

export interface RideStats {
  /** Wall-clock seconds from start to now, minus time explicitly paused. */
  elapsedSeconds: number;
  /** Seconds actually spent above the moving threshold — the denominator for average speed. */
  movingSeconds: number;
  distanceMeters: number;
  elevationGainMeters: number;
  /** distance / movingSeconds. */
  avgSpeedMps: number;
  maxSpeedMps: number;
  currentSpeedMps: number;
  /** Mechanical work at the wheel, kilojoules. */
  workKJ: number;
  kcal: number;
}

/** Internal accumulators the incremental stats update needs between fixes. */
export interface RideAccumulators {
  /** EMA-smoothed altitude, metres. GPS altitude is far too noisy to integrate raw. */
  smoothedAlt: number | null;
  /** Last altitude confirmed as a real change, metres. */
  altReference: number | null;
}

export type RideStatus = 'idle' | 'recording' | 'paused' | 'finished';

/**
 * What kind of workout the GPS recorder is tracking. Determines the energy
 * model (physics for the bike, MET tables for foot travel) and the labels.
 */
export type RecordedActivity = 'ride' | 'run' | 'walk' | 'hike';

/** GPS signal quality, derived from the most recent fix's accuracy. */
export type RideSignal = 'none' | 'acquiring' | 'weak' | 'good';

/**
 * The persisted summary attached to a completed WorkoutSession. The full point
 * list rides along so the route can be redrawn and exported later.
 */
export interface RideSummary {
  stats: RideStats;
  points: RidePoint[];
  gaps: RideGap[];
  startedAt: string;
  endedAt: string;
  /** Which calorie model produced `stats.kcal` — surfaced so the number is auditable. */
  calorieModel: 'physics' | 'met';
  /** Absent on rides recorded before activities existed — read as 'ride'. */
  activity?: RecordedActivity;
}
