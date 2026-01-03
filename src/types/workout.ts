// ============================================
// CORE EXERCISE TYPES
// ============================================

export interface Exercise {
  id: string;
  name: string;
  duration: number; // seconds
  targetReps?: number;
  repRange?: string;
  description: string;
  muscleGroups: string[];
  equipment?: string[];
  switchSides?: boolean; // If true, exercise is split: first half LEFT SIDE, second half RIGHT SIDE
  modifications?: {
    easier?: string;
    harder?: string;
  };
}

// ============================================
// WORKOUT SECTION TYPES
// ============================================

export interface WarmUpSection {
  type: 'warmup';
  exercises: Exercise[];
  totalDuration: number;
}

export interface Circuit {
  id: string;
  name: string;
  rounds: number;
  restBetweenRounds: number;
  restBetweenExercises: number;
  exercises: Exercise[];
  totalDuration: number;
}

export interface CoolDownSection {
  type: 'cooldown';
  exercises: Exercise[];
  totalDuration: number;
}

// ============================================
// COMPLETE WORKOUT STRUCTURE
// ============================================

export interface GeneratedWorkout {
  id: string;
  createdAt: string;
  name: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  targetDuration: number;
  actualDuration: number;
  equipmentSetUsed: string;
  equipmentRequired: string[];
  equipment: EquipmentItem[]; // Detailed equipment list with descriptions for preparation
  warmUp: WarmUpSection;
  circuits: Circuit[];
  coolDown: CoolDownSection;
  restBetweenCircuits: number; // seconds, transition time between circuits
  estimatedCalories: number;
  calorieRange: { low: number; high: number };
  focusAreas: string[];
  muscleGroupsTargeted: string[];
  partingWords: string; // Motivational message displayed after workout completion
  isManual?: boolean; // True for manually logged workouts (no exercises, just metadata)
}

export interface EquipmentItem {
  name: string;
  notes?: string; // e.g., "Medium weight (10-15 lbs)", "Optional but recommended"
}

// ============================================
// TIMER TYPES
// ============================================

export type TimerItemType =
  | 'warmup_exercise'
  | 'circuit_exercise'
  | 'cooldown_exercise'
  | 'exercise_rest'
  | 'round_rest'
  | 'circuit_rest';

export interface TimerItem {
  id: string;
  type: TimerItemType;
  name: string;
  duration: number;
  exercise?: Exercise;
  circuitIndex?: number;
  roundIndex?: number;
  exerciseIndex?: number;
}

export interface FlattenedWorkout {
  workoutId: string;
  items: TimerItem[];
  totalDuration: number;
  totalItems: number;
}

// ============================================
// SESSION TRACKING
// ============================================

export type WorkoutStatus = 'pending' | 'in_progress' | 'completed' | 'stopped_early';

export interface PostWorkoutFeedback {
  rpe?: number; // Rate of Perceived Exertion 1-10
  notes?: string; // Free-text notes about the workout
  updatedAt?: string; // ISO timestamp of last edit
}

export interface WorkoutSession {
  id: string;
  workoutId: string;
  workout: GeneratedWorkout;
  status: WorkoutStatus;
  startedAt?: string;
  completedAt?: string;
  stoppedAt?: string;
  completedItems: number;
  totalItems: number;
  percentComplete: number;
  stoppedAtItem?: {
    circuitIndex?: number;
    roundIndex?: number;
    exerciseIndex?: number;
    itemName: string;
  };
  actualDurationWorked: number;
  estimatedCaloriesBurned: number;
  feedback?: PostWorkoutFeedback;
}

// ============================================
// USER PROFILE
// ============================================

export interface EquipmentSet {
  id: string;
  name: string;
  equipment: string[];
  notes?: string; // e.g., "Dumbbells: up to 20 lbs, Kettlebell: 35 lbs"
  isDefault?: boolean;
}

export interface UserProfile {
  id: string;
  createdAt: string;
  age?: number;
  weight?: number;
  goalWeight?: number;
  weightUnit: 'lbs' | 'kg';
  fitnessGoals: string;
  trainingNotes?: string; // Free-text for abilities, preferences, injuries, etc.
  equipmentSets: EquipmentSet[];
  preferredWorkoutDuration: number;
  hasCompletedOnboarding: boolean;
}

// ============================================
// WEIGHT TRACKING
// ============================================

export interface WeightEntry {
  id: string;
  date: string;
  weight: number;
  unit: 'lbs' | 'kg';
  notes?: string;
}

// ============================================
// HISTORY
// ============================================

export interface WorkoutHistory {
  sessions: WorkoutSession[];
  totalWorkoutsCompleted: number;
  totalMinutesWorked: number;
  totalCaloriesBurned: number;
  streak: {
    current: number;
    longest: number;
    lastWorkoutDate?: string;
  };
}
