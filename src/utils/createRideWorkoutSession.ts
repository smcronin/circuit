import type { GeneratedWorkout, WorkoutSession } from '@/types/workout';
import type { RideSummary } from '@/types/ride';
import { uuid } from './uuid';

export interface CreateRideSessionParams {
  summary: RideSummary;
  /** The programmed workout this ride satisfies, when launched from Programs. */
  sourceWorkout?: GeneratedWorkout;
  imperial: boolean;
}

/**
 * Turn a finished recording into a history entry.
 *
 * When the ride was launched from a programmed workout we reuse that workout's
 * identity so Programs can still mark the day complete — the match there is on
 * workout id/name, so a freshly minted id would leave Thursday looking unridden.
 */
export function createRideWorkoutSession(params: CreateRideSessionParams): WorkoutSession {
  const { summary, sourceWorkout, imperial } = params;
  const { stats } = summary;
  const units = { imperial };

  const durationSeconds = Math.round(stats.elapsedSeconds);
  const calories = Math.round(stats.kcal);

  const base: GeneratedWorkout = sourceWorkout ?? {
    id: uuid(),
    createdAt: summary.startedAt,
    name: 'Road Ride',
    description: 'A GPS-recorded bike ride.',
    difficulty: 'intermediate',
    targetDuration: durationSeconds,
    actualDuration: durationSeconds,
    equipmentSetUsed: 'Road Bike',
    equipmentRequired: ['Road Bike'],
    equipment: [{ name: 'Road Bike' }],
    warmUp: { type: 'warmup', exercises: [], totalDuration: 0 },
    circuits: [],
    coolDown: { type: 'cooldown', exercises: [], totalDuration: 0 },
    restBetweenCircuits: 0,
    estimatedCalories: calories,
    calorieRange: { low: Math.round(calories * 0.85), high: Math.round(calories * 1.15) },
    focusAreas: ['cardio', 'endurance', 'aerobic base'],
    muscleGroupsTargeted: ['quads', 'hamstrings', 'glutes', 'calves', 'cardiovascular system'],
    partingWords: 'Miles in the bank. Steady aerobic work is the quiet stuff that compounds.',
    activityType: 'ride',
  };

  const workout: GeneratedWorkout = {
    ...base,
    // Actuals from the ride replace the plan's estimates.
    actualDuration: durationSeconds,
    estimatedCalories: calories,
    activityType: 'ride',
  };

  return {
    id: uuid(),
    workoutId: workout.id,
    workout,
    status: 'completed',
    startedAt: summary.startedAt,
    completedAt: summary.endedAt,
    completedItems: 1,
    totalItems: 1,
    percentComplete: 100,
    actualDurationWorked: durationSeconds,
    estimatedCaloriesBurned: calories,
    ride: summary,
    // Notes are deliberately left empty. The ride panel already shows distance,
    // speed and climb, and pre-filling notes would hide the "Add RPE/Notes"
    // prompt — which is where the actual coaching signal comes from.
  };
}
