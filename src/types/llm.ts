// ============================================
// WORKOUT SUMMARY FOR LLM CONTEXT
// ============================================

export interface WorkoutSummary {
  name: string;
  focusAreas: string[];
  exercisesUsed: string[];
  completedAt: string;
  rpe?: number;
  notes?: string;
}

export interface SummarizedWorkoutHistory {
  totalWorkouts: number;
  dateRange: string; // e.g., "Dec 1 - Dec 28, 2024"
  summary: string; // LLM-generated summary
  averageRPE?: number;
  commonFocusAreas: string[];
  frequentExercises: string[];
  generatedAt: string; // ISO timestamp
}

// ============================================
// MANUAL WORKOUT METADATA
// ============================================

export interface ManualWorkoutInput {
  title: string;
  description: string;
  durationMinutes: number;
  userWeight?: number;
  userAge?: number;
}

export interface ManualWorkoutMetadataResponse {
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedCalories: number;
  calorieRange: { low: number; high: number };
  focusAreas: string[];
  muscleGroupsTargeted: string[];
}

// ============================================
// LLM RESPONSE SCHEMA
// ============================================

// LLM Response Schema - what OpenRouter returns
export interface LLMWorkoutResponse {
  name: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedCalories: number;
  calorieRange: { low: number; high: number };
  focusAreas: string[];
  muscleGroupsTargeted: string[];
  equipmentRequired: string[];
  equipment?: Array<{
    name: string;
    notes?: string;
  }>;
  partingWords?: string;
  restBetweenCircuits?: number; // seconds, transition time between circuits

  warmUp?: {
    exercises: Array<{
      name: string;
      duration: number;
      description: string;
      muscleGroups: string[];
    }>;
  };

  circuits: Array<{
    name: string;
    rounds: number;
    restBetweenRounds: number;
    restBetweenExercises: number;
    exercises: Array<{
      name: string;
      duration: number;
      targetReps?: number;
      repRange?: string;
      description: string;
      muscleGroups: string[];
      equipment?: string[];
      modifications?: {
        easier?: string;
        harder?: string;
      };
    }>;
  }>;

  coolDown?: {
    exercises: Array<{
      name: string;
      duration: number;
      description: string;
      muscleGroups: string[];
    }>;
  };
}
