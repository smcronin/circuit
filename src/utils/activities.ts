// ─── Recorded activity catalog and energy dispatch ──────────────────────────
// The GPS recorder tracks more than bike rides. Each activity keeps the same
// recording pipeline (filtering, distance, elevation) but needs its own energy
// model: the bike gets the physics model in cycling.ts, while foot travel uses
// Compendium-of-Physical-Activities MET values by speed plus an explicit
// vertical-work term, because MET tables assume level ground.

import type { RecordedActivity, RideSummary } from '@/types/ride';
import { energyForInterval, type EnergyIncrement, type RiderParams } from './cycling';

export interface ActivityMeta {
  /** Display name, e.g. on the recorder and in history. */
  label: string;
  /** Ionicons glyph for pickers and cards. */
  icon: string;
  focusAreas: string[];
  muscleGroups: string[];
}

export const ACTIVITY_META: Record<RecordedActivity, ActivityMeta> = {
  ride: {
    label: 'Bike Ride',
    icon: 'bicycle',
    focusAreas: ['cardio', 'endurance', 'aerobic base'],
    muscleGroups: ['quads', 'hamstrings', 'glutes', 'calves', 'cardiovascular system'],
  },
  run: {
    label: 'Run',
    icon: 'speedometer-outline',
    focusAreas: ['cardio', 'endurance'],
    muscleGroups: ['quads', 'hamstrings', 'glutes', 'calves', 'core', 'cardiovascular system'],
  },
  walk: {
    label: 'Walk',
    icon: 'footsteps-outline',
    focusAreas: ['cardio', 'recovery', 'longevity'],
    muscleGroups: ['quads', 'hamstrings', 'glutes', 'calves'],
  },
  hike: {
    label: 'Hike',
    icon: 'trail-sign-outline',
    focusAreas: ['cardio', 'endurance', 'lower body'],
    muscleGroups: ['quads', 'hamstrings', 'glutes', 'calves', 'core'],
  },
};

/** Picker order = declaration order, so a new activity can't be forgotten here. */
export const ACTIVITY_ORDER = Object.keys(ACTIVITY_META) as RecordedActivity[];

/** The activity a persisted summary was recorded as (absent = pre-activity ride). */
export function summaryActivity(summary: Pick<RideSummary, 'activity'>): RecordedActivity {
  return summary.activity ?? 'ride';
}

const GRAVITY = 9.80665;
/** Metabolic efficiency of vertical work on foot — mid-range of the 20-30% literature. */
const VERTICAL_EFFICIENCY = 0.25;
const JOULES_PER_KCAL = 4184;

/**
 * Compendium METs by ground speed. Piecewise tables rather than fitted curves:
 * the source data is a table, and a table is auditable against it.
 */
function footMets(activity: RecordedActivity, speedMps: number): number {
  const mph = speedMps * 2.23694;

  if (activity === 'run') {
    // Compendium codes 12030-12132. Below a jog, score it as walking.
    if (mph < 4) return walkMets(mph);
    if (mph < 5) return 6.0;
    if (mph < 6) return 8.3;
    if (mph < 7) return 9.8;
    if (mph < 8) return 11.0;
    if (mph < 9) return 11.8;
    if (mph < 10) return 12.8;
    return 14.5;
  }

  // Hiking carries a trail/terrain premium over pavement walking (code 17080
  // rates general hiking 6.0 vs ~3.5 for a 3 mph walk).
  const base = walkMets(mph);
  return activity === 'hike' ? base + 1.5 : base;
}

function walkMets(mph: number): number {
  // Compendium codes 17151-17231.
  if (mph < 2.0) return 2.0;
  if (mph < 2.5) return 2.8;
  if (mph < 3.0) return 3.0;
  if (mph < 3.5) return 3.5;
  if (mph < 4.0) return 4.3;
  if (mph < 4.5) return 5.0;
  return 7.0;
}

/**
 * Energy for one recording interval of the given activity.
 *
 * Foot activities: horizontal cost from the MET table, plus the metabolic cost
 * of any climbing (m·g·h at ~25% efficiency) since MET values assume flat
 * ground. Descent is not credited back — eccentric work still costs energy.
 * `workKJ` stays zero for foot travel; mechanical wheel-work is a bike concept
 * and reporting a fake number would be worse than none.
 */
export function activityEnergyForInterval(
  activity: RecordedActivity,
  speedMps: number,
  grade: number,
  distanceMeters: number,
  seconds: number,
  params: RiderParams
): EnergyIncrement {
  if (activity === 'ride') {
    return energyForInterval(speedMps, grade, seconds, params);
  }
  if (seconds <= 0 || !Number.isFinite(seconds)) return { workKJ: 0, kcal: 0 };

  const mets = footMets(activity, speedMps);
  const horizontalKcal = ((mets * 3.5 * params.riderMassKg) / 200) * (seconds / 60);

  const rise = Math.max(0, grade * distanceMeters);
  const verticalKcal =
    (params.riderMassKg * GRAVITY * rise) / VERTICAL_EFFICIENCY / JOULES_PER_KCAL;

  return { workKJ: 0, kcal: horizontalKcal + verticalKcal };
}
