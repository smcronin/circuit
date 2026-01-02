import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WeightEntry } from '@/types/workout';

// Helper to get date string in local timezone (YYYY-MM-DD)
const getLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

interface WeightState {
  entries: WeightEntry[];
  addEntry: (entry: WeightEntry) => void;
  updateEntry: (id: string, updates: Partial<WeightEntry>) => void;
  removeEntry: (id: string) => void;
  getEntriesInRange: (startDate: string, endDate: string) => WeightEntry[];
  getLatestEntry: () => WeightEntry | undefined;
  getEntryForDate: (date: Date) => WeightEntry | undefined;
  clearEntries: () => void;
}

export const useWeightStore = create<WeightState>()(
  persist(
    (set, get) => ({
      entries: [],

      addEntry: (entry) =>
        set((state) => {
          const entryDateStr = getLocalDateString(new Date(entry.date));
          // Remove any existing entry for the same date
          const filteredEntries = state.entries.filter((e) => {
            const existingDateStr = getLocalDateString(new Date(e.date));
            return existingDateStr !== entryDateStr;
          });
          // Add the new entry and sort by date descending
          return {
            entries: [entry, ...filteredEntries].sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            ),
          };
        }),

      updateEntry: (id, updates) =>
        set((state) => ({
          entries: state.entries.map((e) =>
            e.id === id ? { ...e, ...updates } : e
          ),
        })),

      removeEntry: (id) =>
        set((state) => ({
          entries: state.entries.filter((e) => e.id !== id),
        })),

      getEntriesInRange: (startDate, endDate) => {
        const { entries } = get();
        const start = new Date(startDate).getTime();
        const end = new Date(endDate).getTime();
        return entries.filter((e) => {
          const date = new Date(e.date).getTime();
          return date >= start && date <= end;
        });
      },

      getLatestEntry: () => {
        const { entries } = get();
        return entries[0];
      },

      getEntryForDate: (date: Date) => {
        const { entries } = get();
        const targetDateStr = getLocalDateString(date);
        return entries.find((e) => {
          const entryDateStr = getLocalDateString(new Date(e.date));
          return entryDateStr === targetDateStr;
        });
      },

      clearEntries: () => set({ entries: [] }),
    }),
    {
      name: 'weight-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
