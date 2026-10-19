import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { WorkoutSession, PostWorkoutFeedback } from '@/types/workout';
import type { SummarizedWorkoutHistory } from '@/types/llm';
import { historyStorage } from '@/services/historyStorage';
import { historyFromSessions, mergeHistory, stableJson, type HistoryData } from '@/utils/historyMerge';

interface HistoryState extends HistoryData {
  addSession: (session: WorkoutSession) => void;
  updateSession: (sessionId: string, feedback: PostWorkoutFeedback) => void;
  removeSession: (sessionId: string) => void;
  mergeRemoteHistory: (data: HistoryData) => void;
  getRecentSessions: (count: number) => WorkoutSession[];
  getSessionById: (sessionId: string) => WorkoutSession | undefined;
  setWorkoutSummary: (summary: SummarizedWorkoutHistory) => void;
  updateWorkoutSummary: (summary: string) => void;
  clearWorkoutSummary: () => void;
  clearHistory: () => void;
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      history: historyFromSessions([]),
      deletedSessions: {},
      workoutSummary: undefined,
      addSession: session => set(state => mergeHistory(state, { history: historyFromSessions([session]) })),
      updateSession: (sessionId, feedback) => set(state => ({
        history: historyFromSessions(state.history.sessions.map(s => s.id === sessionId
          ? { ...s, feedback: { ...s.feedback, ...feedback, updatedAt: new Date().toISOString() } } : s)),
      })),
      removeSession: sessionId => set(state => mergeHistory(state, {
        history: historyFromSessions([]), deletedSessions: { [sessionId]: new Date().toISOString() },
      })),
      mergeRemoteHistory: data => {
        const previous = get();
        const merged = mergeHistory(previous, data);
        if (stableJson({ history: previous.history, workoutSummary: previous.workoutSummary, deletedSessions: previous.deletedSessions }) !== stableJson(merged)) set(merged);
      },
      getRecentSessions: count => get().history.sessions.filter(s => s.status === 'completed' || s.status === 'stopped_early').slice(0, count),
      getSessionById: sessionId => get().history.sessions.find(s => s.id === sessionId),
      setWorkoutSummary: workoutSummary => set({ workoutSummary }),
      updateWorkoutSummary: summary => set(state => ({
        workoutSummary: state.workoutSummary ? { ...state.workoutSummary, summary, generatedAt: new Date().toISOString() } : undefined,
      })),
      clearWorkoutSummary: () => set({ workoutSummary: undefined }),
      clearHistory: () => set(state => ({
        history: historyFromSessions([]), workoutSummary: undefined,
        deletedSessions: { ...state.deletedSessions, ...Object.fromEntries(state.history.sessions.map(s => [s.id, new Date().toISOString()])) },
      })),
    }),
    {
      name: 'history-storage',
      storage: createJSONStorage(() => historyStorage),
      partialize: state => ({ history: state.history, workoutSummary: state.workoutSummary, deletedSessions: state.deletedSessions }),
      merge: (persisted, current) => ({ ...current, ...mergeHistory((persisted as HistoryData) || current, current) }),
    }
  )
);
