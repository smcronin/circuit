import { GeneratedWorkout, WorkoutSession } from '@/types/workout';
import { ManualWorkoutMetadataResponse } from '@/types/llm';
import { uuid } from './uuid';

export interface CreateManualSessionParams {
  title: string;
  description: string;
  durationMinutes: number;
  date: Date;
  metadata: ManualWorkoutMetadataResponse;
}

export function createManualWorkoutSession(params: CreateManualSessionParams): WorkoutSession {
  const workoutId = uuid();
  const sessionId = uuid();
  const durationSeconds = params.durationMinutes * 60;

  // Create a minimal GeneratedWorkout structure for manual entries
  const workout: GeneratedWorkout = {
    id: workoutId,
    createdAt: params.date.toISOString(),
    name: params.title,
    description: params.description,
    difficulty: params.metadata.difficulty,
    targetDuration: durationSeconds,
    actualDuration: durationSeconds,
    equipmentSetUsed: 'Manual Entry',
    equipmentRequired: [],
    equipment: [], // No equipment details for manual entries
    warmUp: { type: 'warmup', exercises: [], totalDuration: 0 },
    circuits: [], // Empty circuits for manual workouts
    coolDown: { type: 'cooldown', exercises: [], totalDuration: 0 },
    restBetweenCircuits: 0,
    estimatedCalories: params.metadata.estimatedCalories,
    calorieRange: params.metadata.calorieRange,
    focusAreas: params.metadata.focusAreas,
    muscleGroupsTargeted: params.metadata.muscleGroupsTargeted,
    partingWords: "Great job logging your workout! Every session counts toward your goals.",
    isManual: true,
  };

  const session: WorkoutSession = {
    id: sessionId,
    workoutId: workoutId,
    workout: workout,
    status: 'completed', // Manual entries are always "completed"
    startedAt: params.date.toISOString(),
    completedAt: params.date.toISOString(),
    completedItems: 0, // N/A for manual
    totalItems: 0, // N/A for manual
    percentComplete: 100,
    actualDurationWorked: durationSeconds,
    estimatedCaloriesBurned: params.metadata.estimatedCalories,
    feedback: {
      notes: params.description, // Store original description as notes
      updatedAt: new Date().toISOString(),
    },
  };

  return session;
}
