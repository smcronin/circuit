import { useWeightStore, ensureWeightHistoryLoaded, flushWeightStorage } from '@/stores/useWeightStore';
import { parseWeightChanges } from './weightSync';
import type { WeightEntry } from '../types/workout';

// A recovery file contains only known measurements. It never replaces a
// profile, workout, existing day or pending upload, even if imported twice.
export async function restoreMissingWeights(rows: unknown) {
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > 100) throw new Error('Invalid weight recovery file');
  const entries = parseWeightChanges(rows.map(entry => ({
    id: entry?.id, mutationId: entry?.id, changedAt: entry?.date,
    timeZone: null, localDate: null, entry,
  }))).map(change => change.entry as WeightEntry);
  await ensureWeightHistoryLoaded();
  const { entries: current, getEntryForDate } = useWeightStore.getState();
  const ids = new Set(current.map(entry => entry.id));
  const days = new Set<string>();
  const missing = entries.filter(entry => {
    const date = new Date(entry.date);
    const day = date.toDateString();
    if (ids.has(entry.id) || days.has(day) || getEntryForDate(date)) return false;
    ids.add(entry.id);
    days.add(day);
    return true;
  });
  // Persist even on retry: a previous write may have failed after updating RAM.
  useWeightStore.setState({ entries: [...current, ...missing].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)) });
  await flushWeightStorage();
  return missing.length;
}
