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

const NIGHT_MOBILITY_WORKOUT_ID = 'saved-night-mobility-10';
const nighttimeMobilityWorkout = starterSavedWorkouts.find(
  (savedWorkout) => savedWorkout.workout.id === NIGHT_MOBILITY_WORKOUT_ID
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
      version: 1,
      migrate: (persistedState, version) => {
        const state = persistedState as Pick<SavedWorkoutsState, 'savedWorkouts'>;

        if (
          version < 1 &&
          nighttimeMobilityWorkout &&
          Array.isArray(state.savedWorkouts) &&
          !state.savedWorkouts.some(
            (savedWorkout) => savedWorkout.workout.id === NIGHT_MOBILITY_WORKOUT_ID
          )
        ) {
          return {
            ...state,
            savedWorkouts: [...state.savedWorkouts, nighttimeMobilityWorkout],
          };
        }

        return state;
      },
    }
  )
);
