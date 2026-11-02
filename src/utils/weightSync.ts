import type { WeightEntry } from '../types/workout';

export const MAX_WEIGHT_CHANGES = 100;
export const MAX_WEIGHT_RECORDS = 5_000;

export interface WeightChange {
  mutationId: string;
  id: string;
  changedAt: string;
  entry: WeightEntry | null;
  localDate: string | null;
  timeZone: string | null;
}

export interface SyncedWeight extends WeightEntry {
  localDate: string | null;
  timeZone: string | null;
  updatedAt: string;
  mutationId: string;
}

export interface WeightTracking {
  records: Record<string, SyncedWeight>;
  deleted: Record<string, { changedAt: string; mutationId: string }>;
}

const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const identifier = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 200 &&
  !['__proto__', 'constructor', 'prototype'].includes(value);
const timestamp = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return false;
  return validDate(value.slice(0, 10)) && Number(value.slice(11, 13)) < 24 &&
    Number(value.slice(14, 16)) < 60 && Number(value.slice(17, 19)) < 60 && Number.isFinite(Date.parse(value));
};
function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

/** Strict projection: no caller-supplied fields can enter workout responses. */
export function parseWeightChanges(value: unknown): WeightChange[] {
  if (!Array.isArray(value) || value.length > MAX_WEIGHT_CHANGES) throw new Error('Invalid weight changes');
  return value.map(change => {
    if (!object(change) || !identifier(change.id) || !identifier(change.mutationId) || !timestamp(change.changedAt)) {
      throw new Error('Invalid weight change');
    }
    if (change.localDate !== null && (typeof change.localDate !== 'string' || !validDate(change.localDate))) throw new Error('Invalid weight date');
    if (change.timeZone !== null) {
      if (typeof change.timeZone !== 'string' || change.timeZone.length > 100) throw new Error('Invalid weight time zone');
      try { new Intl.DateTimeFormat('en', { timeZone: change.timeZone }); }
      catch { throw new Error('Invalid weight time zone'); }
    }
    let entry: WeightEntry | null = null;
    if (change.entry !== null) {
      const raw = change.entry;
      if (!object(raw) || raw.id !== change.id || !timestamp(raw.date) ||
        typeof raw.weight !== 'number' || !Number.isFinite(raw.weight) || raw.weight <= 0 ||
        (raw.unit !== 'lbs' && raw.unit !== 'kg') ||
        (raw.notes !== undefined && (typeof raw.notes !== 'string' || raw.notes.length > 1_000))) {
        throw new Error('Invalid weight entry');
      }
      entry = { id: change.id, date: raw.date, weight: raw.weight, unit: raw.unit,
        ...(raw.notes === undefined ? {} : { notes: raw.notes as string }) };
    }
    return { id: change.id, mutationId: change.mutationId, changedAt: change.changedAt,
      localDate: change.localDate as string | null, timeZone: change.timeZone as string | null, entry };
  });
}

/** Timestamp + mutation ID makes retries and out-of-order delivery deterministic. */
export function mergeWeightChanges(previous: WeightTracking | null, changes: WeightChange[]): WeightTracking | null {
  if (!changes.length) return previous;
  const records = { ...previous?.records };
  const deleted = { ...previous?.deleted };
  for (const change of changes) {
    const current = records[change.id];
    const tombstone = deleted[change.id];
    const lastAt = current?.updatedAt || tombstone?.changedAt;
    const lastId = current?.mutationId || tombstone?.mutationId || '';
    if (lastAt && (Date.parse(change.changedAt) < Date.parse(lastAt) ||
      (Date.parse(change.changedAt) === Date.parse(lastAt) && change.mutationId <= lastId))) continue;
    if (change.entry) {
      records[change.id] = { ...change.entry, localDate: change.localDate, timeZone: change.timeZone,
        updatedAt: change.changedAt, mutationId: change.mutationId };
      delete deleted[change.id];
    } else {
      delete records[change.id];
      deleted[change.id] = { changedAt: change.changedAt, mutationId: change.mutationId };
    }
  }
  if (new Set([...Object.keys(records), ...Object.keys(deleted)]).size > MAX_WEIGHT_RECORDS) throw new Error('Weight tracking capacity reached');
  return { records, deleted };
}

export function weightContext(tracking: WeightTracking | null, requestUrl: URL,
  status: 'available' | 'not_synced' | 'owner_ambiguous' | 'owner_mismatch', syncedAt: string | null) {
  const bounded = (name: string, fallback: number, min: number, max: number) => {
    const value = requestUrl.searchParams.get(name);
    const parsed = value && /^\d+$/.test(value) ? Number(value) : NaN;
    return Number.isSafeInteger(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
  };
  const limit = bounded('weightLimit', 50, 1, 200);
  const offset = bounded('weightOffset', 0, 0, MAX_WEIGHT_RECORDS);
  const all = status === 'available' ? Object.values(tracking?.records || {}).sort((a, b) =>
    Date.parse(b.date) - Date.parse(a.date) || a.id.localeCompare(b.id)) : [];
  const entries = all.slice(offset, offset + limit).map(({ mutationId: _mutationId, ...entry }) => entry);
  return { status, totalEntries: status === 'available' ? all.length : null,
    returnedEntries: entries.length, limit, offset,
    nextOffset: offset + entries.length < all.length ? offset + entries.length : null,
    syncedAt: status === 'available' ? syncedAt : null,
    provenance: 'circuit-weight-store', dateSemantics: 'user-selected date; not a verified measurement instant',
    entries };
}
