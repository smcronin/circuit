import type { GeneratedWorkout, PostWorkoutFeedback, WorkoutSession } from '@/types/workout';
import type { RideStats, RideSummary } from '@/types/ride';
import type { ManualWorkoutMetadataResponse } from '@/types/llm';
import { uuid } from './uuid';
import { ACTIVITY_META, summaryActivity } from './activities';

export interface CreateRideSessionParams {
  summary: RideSummary;
  /** The programmed workout this recording satisfies, when launched from Programs. */
  sourceWorkout?: GeneratedWorkout;
  /**
   * LLM-generated metadata (muscle groups, focus areas, calories). Optional:
   * when generation fails the session still saves, using the sensor-derived
   * calorie estimate and the activity's default classification.
   */
  metadata?: ManualWorkoutMetadataResponse | null;
  feedback?: PostWorkoutFeedback;
}

/**
 * The calorie count a recorded session saves and displays.
 *
 * The LLM refines the sensor estimate with context, but its parse layer
 * fabricates `durationMinutes * 7` when a response comes back partial — a
 * number indistinguishable from a real answer here. So the LLM may only adjust
 * the sensor estimate within a band; anything outside it is treated as the
 * fabricated fallback and the sensor number stands.
 */
export function resolveRecordedCalories(
  stats: RideStats,
  metadata?: ManualWorkoutMetadataResponse | null
): number {
  const sensor = Math.max(0, Math.round(stats.kcal));
  const llm = metadata?.estimatedCalories;
  if (!llm || !Number.isFinite(llm) || llm <= 0) return sensor;
  if (sensor === 0) return Math.round(llm);
  return Math.round(Math.min(sensor * 1.5, Math.max(sensor * 0.6, llm)));
}

/**
 * Turn a finished recording into a history entry.
 *
 * When the recording was launched from a programmed workout we reuse that
 * workout's identity so Programs can still mark the day complete — the match
 * there is on workout id/name, so a freshly minted id would leave Thursday
 * looking unridden. In that case the program's authored classification
 * (difficulty, focus areas, muscle groups) is kept; the LLM's applies only to
 * ad-hoc recordings, and even then only field-by-field where it returned
 * something non-empty.
 */
export function createRideWorkoutSession(params: CreateRideSessionParams): WorkoutSession {
  const { summary, sourceWorkout, metadata, feedback } = params;
  const { stats } = summary;
  const activity = summaryActivity(summary);
  const meta = ACTIVITY_META[activity];

  const durationSeconds = Math.round(stats.elapsedSeconds);
  const calories = resolveRecordedCalories(stats, metadata);

  // Empty arrays are the parse layer's "didn't answer" value — fall back.
  const focusAreas = metadata?.focusAreas?.length ? metadata.focusAreas : meta.focusAreas;
  const muscleGroups = metadata?.muscleGroupsTargeted?.length
    ? metadata.muscleGroupsTargeted
    : meta.muscleGroups;

  const workout: GeneratedWorkout = sourceWorkout
    ? {
        ...sourceWorkout,
        actualDuration: durationSeconds,
        estimatedCalories: calories,
        activityType: activity,
      }
    : {
        id: uuid(),
        createdAt: summary.startedAt,
        name: meta.label,
        description: `A GPS-recorded ${meta.label.toLowerCase()}.`,
        difficulty: metadata?.difficulty ?? 'intermediate',
        targetDuration: durationSeconds,
        actualDuration: durationSeconds,
        equipmentSetUsed: activity === 'ride' ? 'Road Bike' : 'None',
        equipmentRequired: activity === 'ride' ? ['Road Bike'] : [],
        equipment: activity === 'ride' ? [{ name: 'Road Bike' }] : [],
        warmUp: { type: 'warmup', exercises: [], totalDuration: 0 },
        circuits: [],
        coolDown: { type: 'cooldown', exercises: [], totalDuration: 0 },
        restBetweenCircuits: 0,
        estimatedCalories: calories,
        calorieRange:
          metadata?.calorieRange ?? {
            low: Math.round(calories * 0.85),
            high: Math.round(calories * 1.15),
          },
        focusAreas,
        muscleGroupsTargeted: muscleGroups,
        partingWords:
          'Miles in the bank. Steady aerobic work is the quiet stuff that compounds.',
        activityType: activity,
      };

  const hasFeedback = feedback && (feedback.rpe !== undefined || feedback.notes);

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
    ...(hasFeedback
      ? { feedback: { ...feedback, updatedAt: new Date().toISOString() } }
      : {}),
  };
}
