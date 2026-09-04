import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { STARTER_SAVED_WORKOUTS } from '@/data/starterSavedWorkouts';
import type { GeneratedWorkout } from '@/types/workout';

export interface SavedWorkout {
  workout: GeneratedWorkout;
  savedAt: string;
}

interface SavedWorkoutsState {
  savedWorkouts: SavedWorkout[];
  saveWorkout: (workout: GeneratedWorkout) => void;
  removeWorkout: (workoutId: string) => void;
  toggleWorkout: (workout: GeneratedWorkout) => void;
  isWorkoutSaved: (workoutId: string) => boolean;
}

const starterSavedWorkouts: SavedWorkout[] = STARTER_SAVED_WORKOUTS.map((workout, index) => ({
  workout,
  savedAt: new Date(Date.UTC(2026, 6, 22, 12, index)).toISOString(),
}));

const MORNING_MOBILITY_WORKOUT_ID = 'saved-morning-mobility-5';
const NIGHT_MOBILITY_WORKOUT_ID = 'saved-night-mobility-10';
const JUMP_ROPE_VO2_WORKOUT_ID = 'saved-jump-rope-vo2-4x4';
const morningMobilityWorkout = starterSavedWorkouts.find(
  (savedWorkout) => savedWorkout.workout.id === MORNING_MOBILITY_WORKOUT_ID
);
const nighttimeMobilityWorkout = starterSavedWorkouts.find(
  (savedWorkout) => savedWorkout.workout.id === NIGHT_MOBILITY_WORKOUT_ID
);
const jumpRopeVo2Workout = starterSavedWorkouts.find(
  (savedWorkout) => savedWorkout.workout.id === JUMP_ROPE_VO2_WORKOUT_ID
);

export const useSavedWorkoutsStore = create<SavedWorkoutsState>()(
  persist(
    (set, get) => ({
      savedWorkouts: starterSavedWorkouts,

      saveWorkout: (workout) =>
        set((state) => {
          const existing = state.savedWorkouts.find((saved) => saved.workout.id === workout.id);
          if (existing) {
            return {
              savedWorkouts: state.savedWorkouts.map((saved) =>
                saved.workout.id === workout.id ? { ...saved, workout } : saved
              ),
            };
          }

          return {
            savedWorkouts: [{ workout, savedAt: new Date().toISOString() }, ...state.savedWorkouts],
          };
        }),

      removeWorkout: (workoutId) =>
        set((state) => ({
          savedWorkouts: state.savedWorkouts.filter((saved) => saved.workout.id !== workoutId),
        })),

      toggleWorkout: (workout) => {
        if (get().isWorkoutSaved(workout.id)) {
          get().removeWorkout(workout.id);
        } else {
          get().saveWorkout(workout);
        }
      },

      isWorkoutSaved: (workoutId) =>
        get().savedWorkouts.some((saved) => saved.workout.id === workoutId),
    }),
    {
      name: 'saved-workouts-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: 3,
      migrate: (persistedState, version) => {
        const state = persistedState as Pick<SavedWorkoutsState, 'savedWorkouts'>;

        if (!Array.isArray(state.savedWorkouts)) {
          return { ...state, savedWorkouts: starterSavedWorkouts };
        }

        let savedWorkouts = state.savedWorkouts;

        if (version < 1 && nighttimeMobilityWorkout) {
          const hasNighttimeMobility = savedWorkouts.some(
            (savedWorkout) => savedWorkout.workout.id === NIGHT_MOBILITY_WORKOUT_ID
          );

          if (!hasNighttimeMobility) {
            savedWorkouts = [...savedWorkouts, nighttimeMobilityWorkout];
          }
        }

        if (version < 2 && morningMobilityWorkout) {
          savedWorkouts = savedWorkouts.map((savedWorkout) =>
            savedWorkout.workout.id === MORNING_MOBILITY_WORKOUT_ID
              ? { ...savedWorkout, workout: morningMobilityWorkout.workout }
              : savedWorkout
          );
        }

        if (version < 3 && jumpRopeVo2Workout) {
          const hasJumpRopeVo2 = savedWorkouts.some(
            (savedWorkout) => savedWorkout.workout.id === JUMP_ROPE_VO2_WORKOUT_ID
          );

          if (!hasJumpRopeVo2) {
            savedWorkouts = [...savedWorkouts, jumpRopeVo2Workout];
          }
        }

        return { ...state, savedWorkouts };
      },
    }
  )
);
