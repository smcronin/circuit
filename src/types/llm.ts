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

  warmUp: {
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

  coolDown: {
    exercises: Array<{
      name: string;
      duration: number;
      description: string;
      muscleGroups: string[];
    }>;
  };
}
