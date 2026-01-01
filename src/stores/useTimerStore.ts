import { create } from 'zustand';
import { TimerItem, WorkoutSession } from '@/types/workout';

type TimerStatus = 'idle' | 'countdown' | 'running' | 'paused' | 'completed' | 'transition';

interface TimerState {
  status: TimerStatus;
  items: TimerItem[];
  currentItemIndex: number;
  timeRemaining: number;
  totalElapsed: number;
  session: WorkoutSession | null;
  countdownValue: number;
  showCountdown: boolean;

  initializeTimer: (items: TimerItem[], session: WorkoutSession) => void;
  startCountdown: () => void;
  startTimer: () => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopTimer: () => void;
  tick: () => void;
  moveToNextItem: () => void;
  startTransitionCountdown: () => void;
  finishTransition: () => void;
  skipToNext: () => void;
  goToPrevious: () => void;
  setCountdownValue: (value: number) => void;
  setShowCountdown: (show: boolean) => void;
  reset: () => void;
}

export const useTimerStore = create<TimerState>((set, get) => ({
  status: 'idle',
  items: [],
  currentItemIndex: 0,
  timeRemaining: 0,
  totalElapsed: 0,
  session: null,
  countdownValue: 3,
  showCountdown: false,

  initializeTimer: (items, session) => {
    set({
      status: 'idle',
      items,
      currentItemIndex: 0,
      timeRemaining: items[0]?.duration || 0,
      totalElapsed: 0,
      session,
    });
  },

  startCountdown: () => {
    set({ status: 'countdown', showCountdown: true, countdownValue: 3 });
  },

  startTimer: () => {
    set({ status: 'running', showCountdown: false });
  },

  pauseTimer: () => {
    set({ status: 'paused' });
  },

  resumeTimer: () => {
    set({ status: 'running' });
  },

  stopTimer: () => {
    const { session, currentItemIndex, totalElapsed, items } = get();
    const currentItem = items[currentItemIndex];
    if (session) {
      set({
        status: 'idle',
        session: {
          ...session,
          status: 'stopped_early',
          stoppedAt: new Date().toISOString(),
          completedItems: currentItemIndex,
          actualDurationWorked: totalElapsed,
          percentComplete: Math.round((currentItemIndex / items.length) * 100),
          stoppedAtItem: currentItem
            ? {
                circuitIndex: currentItem.circuitIndex,
                roundIndex: currentItem.roundIndex,
                exerciseIndex: currentItem.exerciseIndex,
                itemName: currentItem.name,
              }
            : undefined,
        },
      });
    }
  },

  tick: () => {
    const { status, timeRemaining, totalElapsed } = get();
    if (status !== 'running') return;

    if (timeRemaining > 1) {
      set({
        timeRemaining: timeRemaining - 1,
        totalElapsed: totalElapsed + 1,
      });
    } else {
      get().moveToNextItem();
    }
  },

  moveToNextItem: () => {
    const { currentItemIndex, items, session, totalElapsed } = get();
    const nextIndex = currentItemIndex + 1;

    if (nextIndex >= items.length) {
      // Workout complete
      const totalCalories = session?.workout.estimatedCalories || 0;
      const percentCompleted = 100;
      set({
        status: 'completed',
        session: session
          ? {
              ...session,
              status: 'completed',
              completedAt: new Date().toISOString(),
              completedItems: items.length,
              percentComplete: percentCompleted,
              actualDurationWorked: totalElapsed,
              estimatedCaloriesBurned: totalCalories,
            }
          : null,
      });
    } else {
      // Start transition countdown before next item
      set({
        status: 'transition',
        showCountdown: true,
        countdownValue: 3,
        currentItemIndex: nextIndex,
        timeRemaining: items[nextIndex].duration,
        totalElapsed: totalElapsed + 1,
      });
    }
  },

  startTransitionCountdown: () => {
    set({ status: 'transition', showCountdown: true, countdownValue: 3 });
  },

  finishTransition: () => {
    set({ status: 'running', showCountdown: false });
  },

  skipToNext: () => {
    const { currentItemIndex, items, timeRemaining, totalElapsed } = get();
    const nextIndex = currentItemIndex + 1;
    const skippedTime = timeRemaining;

    if (nextIndex >= items.length) {
      get().moveToNextItem();
    } else {
      set({
        currentItemIndex: nextIndex,
        timeRemaining: items[nextIndex].duration,
        totalElapsed: totalElapsed + (items[currentItemIndex].duration - skippedTime),
      });
    }
  },

  goToPrevious: () => {
    const { currentItemIndex, items } = get();
    if (currentItemIndex > 0) {
      const prevIndex = currentItemIndex - 1;
      set({
        currentItemIndex: prevIndex,
        timeRemaining: items[prevIndex].duration,
      });
    }
  },

  setCountdownValue: (value) => set({ countdownValue: value }),
  setShowCountdown: (show) => set({ showCountdown: show }),

  reset: () =>
    set({
      status: 'idle',
      items: [],
      currentItemIndex: 0,
      timeRemaining: 0,
      totalElapsed: 0,
      session: null,
      countdownValue: 3,
      showCountdown: false,
    }),
}));
