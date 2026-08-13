// ─── Ride unit formatting ───────────────────────────────────────────────────
// Everything is stored in SI (metres, m/s) and converted only at the point of
// display, so switching units never touches recorded data.

const METERS_PER_MILE = 1609.344;
const METERS_PER_FOOT = 0.3048;
const MPS_TO_MPH = 2.2369362920544;
const MPS_TO_KPH = 3.6;

export interface RideUnits {
  imperial: boolean;
}

export const distanceUnit = (u: RideUnits) => (u.imperial ? 'mi' : 'km');
export const speedUnit = (u: RideUnits) => (u.imperial ? 'mph' : 'km/h');
export const elevationUnit = (u: RideUnits) => (u.imperial ? 'ft' : 'm');

export function distanceValue(meters: number, u: RideUnits): number {
  return u.imperial ? meters / METERS_PER_MILE : meters / 1000;
}

export function formatDistance(meters: number, u: RideUnits): string {
  const value = distanceValue(meters, u);
  return value < 10 ? value.toFixed(2) : value.toFixed(1);
}

export function speedValue(mps: number, u: RideUnits): number {
  return u.imperial ? mps * MPS_TO_MPH : mps * MPS_TO_KPH;
}

export function formatSpeed(mps: number, u: RideUnits): string {
  return speedValue(mps, u).toFixed(1);
}

export function formatElevation(meters: number, u: RideUnits): string {
  const value = u.imperial ? meters / METERS_PER_FOOT : meters;
  return Math.round(value).toLocaleString('en-US');
}

/** H:MM:SS once past an hour, M:SS below it — a ride clock, not a rest timer. */
export function formatRideClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** "42 min" / "1h 12m" for summary rows. */
export function formatRideDuration(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}
