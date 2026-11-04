import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { WeightEntry } from '@/types/workout';
import { useUserStore } from './useUserStore';
import { uuid } from '@/utils/uuid';
import type { WeightChange } from '@/utils/weightSync';
import { weightStorage } from '@/services/weightStorage';
export { flushWeightStorage } from '@/services/weightStorage';

// Helper to get date string in local timezone (YYYY-MM-DD)
const getLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
export const weightDay = (entry: WeightEntry) => entry.localDate || getLocalDateString(new Date(entry.date));

interface WeightState {
  entries: WeightEntry[];
  pendingByOwner: Record<string, Record<string, WeightChange>>;
  entryOwners: Record<string, string>;
  lastMutationTime: number;
  acknowledgeChanges: (owner: string, mutationIds: string[]) => void;
  addEntry: (entry: WeightEntry) => void;
  updateEntry: (id: string, updates: Partial<WeightEntry>) => void;
  removeEntry: (id: string) => void;
  getEntriesInRange: (startDate: string, endDate: string) => WeightEntry[];
  getLatestEntry: () => WeightEntry | undefined;
  getEntryForDate: (date: Date) => WeightEntry | undefined;
  clearEntries: () => void;
}

function queueChanges(state: WeightState, entries: WeightEntry[], removed: string[]): Partial<WeightState> {
  const owner = useUserStore.getState().profile?.id;
  if (!owner || owner.length < 10 || ['__proto__', 'constructor', 'prototype'].includes(owner)) return {};
  const pending = { ...state.pendingByOwner[owner] };
  const entryOwners = { ...state.entryOwners };
  let lastMutationTime = state.lastMutationTime;
  const change = (id: string, entry: WeightEntry | null) => {
    lastMutationTime = Math.max(Date.now(), lastMutationTime + 1);
    const datedEntry = entry ?? state.entries.find(e => e.id === id);
    let timeZone: string | null = null;
    try { timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { /* native may lack IANA zones */ }
    pending[id] = { mutationId: uuid(), id, changedAt: new Date(lastMutationTime).toISOString(), entry,
      localDate: datedEntry ? weightDay(datedEntry) : null, timeZone };
    entryOwners[id] = owner;
  };
  // Queue deletions only for entries belonging to this profile. The approved
  // original device can separately contribute missing historical dates.
  for (const id of removed) if (entryOwners[id] === owner) change(id, null);
  for (const entry of entries) {
    if (!entryOwners[entry.id] || entryOwners[entry.id] === owner) change(entry.id, { ...entry });
  }
  return { pendingByOwner: { ...state.pendingByOwner, [owner]: pending }, entryOwners, lastMutationTime };
}

export const useWeightStore = create<WeightState>()(
  persist(
    (set, get) => ({
      entries: [],
      pendingByOwner: {},
      entryOwners: {},
      lastMutationTime: 0,
      acknowledgeChanges: (owner, mutationIds) => set((state) => {
        const acknowledged = new Set(mutationIds);
        const pending = Object.fromEntries(Object.entries(state.pendingByOwner[owner] || {})
          .filter(([, change]) => !acknowledged.has(change.mutationId)));
        return { pendingByOwner: { ...state.pendingByOwner, [owner]: pending } };
      }),

      addEntry: (entry) =>
        set((state) => {
          const entryDateStr = weightDay(entry);
          // Remove any existing entry for the same date
          const filteredEntries = state.entries.filter((e) => {
            const existingDateStr = weightDay(e);
            return existingDateStr !== entryDateStr;
          });
          // Add the new entry and sort by date descending
          return {
            ...queueChanges(state, [entry], state.entries.filter(e => !filteredEntries.includes(e) && e.id !== entry.id).map(e => e.id)),
            entries: [entry, ...filteredEntries].sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            ),
          };
        }),

      updateEntry: (id, updates) =>
        set((state) => {
          const entries = state.entries.map(e => e.id === id ? { ...e, ...updates, id } : e);
          const owner = useUserStore.getState().profile?.id;
          return { entries, ...(owner && state.entryOwners[id] === owner
            ? queueChanges(state, entries.filter(e => e.id === id), []) : {}) };
        }),

      removeEntry: (id) =>
        set((state) => ({
          ...queueChanges(state, [], [id]),
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
          const entryDateStr = weightDay(e);
          return entryDateStr === targetDateStr;
        });
      },

      clearEntries: () => set((state) => ({ entries: [], ...queueChanges(state, [], state.entries.map(e => e.id)) })),
    }),
    {
      name: 'weight-storage',
      storage: createJSONStorage(() => weightStorage),
    }
  )
);

export async function ensureWeightHistoryLoaded() {
  if (!useWeightStore.persist.hasHydrated()) await useWeightStore.persist.rehydrate();
  if (!useWeightStore.persist.hasHydrated()) throw new Error('Could not load weight history');
}
