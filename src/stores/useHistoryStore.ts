import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WorkoutSession, WorkoutHistory } from '@/types/workout';

interface HistoryState {
  history: WorkoutHistory;
  addSession: (session: WorkoutSession) => void;
  removeSession: (sessionId: string) => void;
  getRecentSessions: (count: number) => WorkoutSession[];
  clearHistory: () => void;
}

const initialHistory: WorkoutHistory = {
  sessions: [],
  totalWorkoutsCompleted: 0,
  totalMinutesWorked: 0,
  totalCaloriesBurned: 0,
  streak: { current: 0, longest: 0 },
};

const calculateStreak = (sessions: WorkoutSession[]): { current: number; longest: number; lastWorkoutDate?: string } => {
  const completedSessions = sessions
    .filter((s) => s.status === 'completed')
    .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());

  if (completedSessions.length === 0) {
    return { current: 0, longest: 0 };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastWorkout = new Date(completedSessions[0].completedAt!);
  lastWorkout.setHours(0, 0, 0, 0);

  const daysSinceLastWorkout = Math.floor(
    (today.getTime() - lastWorkout.getTime()) / (1000 * 60 * 60 * 24)
  );

  // If more than 1 day since last workout, streak is broken
  if (daysSinceLastWorkout > 1) {
    return { current: 0, longest: 0, lastWorkoutDate: completedSessions[0].completedAt };
  }

  // Calculate current streak
  let currentStreak = 1;
  let longestStreak = 1;
  let tempStreak = 1;

  for (let i = 1; i < completedSessions.length; i++) {
    const current = new Date(completedSessions[i - 1].completedAt!);
    const previous = new Date(completedSessions[i].completedAt!);
    current.setHours(0, 0, 0, 0);
    previous.setHours(0, 0, 0, 0);

    const dayDiff = Math.floor(
      (current.getTime() - previous.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (dayDiff === 1) {
      tempStreak++;
      if (i < completedSessions.length - 1 || daysSinceLastWorkout <= 1) {
        currentStreak = tempStreak;
      }
    } else if (dayDiff > 1) {
      longestStreak = Math.max(longestStreak, tempStreak);
      tempStreak = 1;
    }
  }

  longestStreak = Math.max(longestStreak, tempStreak);
  currentStreak = daysSinceLastWorkout <= 1 ? currentStreak : 0;

  return {
    current: currentStreak,
    longest: longestStreak,
    lastWorkoutDate: completedSessions[0].completedAt,
  };
};

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      history: initialHistory,

      addSession: (session) =>
        set((state) => {
          const isCompleted = session.status === 'completed';
          const minutesWorked = Math.round(session.actualDurationWorked / 60);
          const newSessions = [session, ...state.history.sessions];
          const streak = calculateStreak(newSessions);

          return {
            history: {
              sessions: newSessions,
              totalWorkoutsCompleted: isCompleted
                ? state.history.totalWorkoutsCompleted + 1
                : state.history.totalWorkoutsCompleted,
              totalMinutesWorked: state.history.totalMinutesWorked + minutesWorked,
              totalCaloriesBurned:
                state.history.totalCaloriesBurned + session.estimatedCaloriesBurned,
              streak,
            },
          };
        }),

      removeSession: (sessionId) =>
        set((state) => {
          const newSessions = state.history.sessions.filter((s) => s.id !== sessionId);
          const streak = calculateStreak(newSessions);
          return {
            history: {
              ...state.history,
              sessions: newSessions,
              streak,
            },
          };
        }),

      getRecentSessions: (count) => {
        const { history } = get();
        return history.sessions
          .filter((s) => s.status === 'completed' || s.status === 'stopped_early')
          .slice(0, count);
      },

      clearHistory: () => set({ history: initialHistory }),
    }),
    {
      name: 'history-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
