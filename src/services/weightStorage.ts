import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { WeightEntry } from '../types/workout';
import type { WeightChange } from '../utils/weightSync';

interface Snapshot {
  entries: WeightEntry[];
  pendingByOwner: Record<string, Record<string, WeightChange>>;
  entryOwners: Record<string, string>;
  lastMutationTime: number;
}
type Stored = { state: Partial<Snapshot>; version: number };
let dbPromise: Promise<IDBDatabase> | undefined;
let baseline: Stored | undefined;
let pending = Promise.resolve();
let lastError: unknown;

function database() {
  if (!dbPromise) dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open('circuit-weights', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('weights');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Weight storage is busy'));
  }).catch(err => { dbPromise = undefined; throw err; });
  return dbPromise;
}

// A stale tab can acknowledge an upload long after another tab saved a weight.
// Apply only this tab's changes, comparing removals to the version it observed.
function patchMap<T>(disk: Record<string, T> = {}, before: Record<string, T> = {}, after: Record<string, T> = {}) {
  const result = { ...disk };
  for (const id of Object.keys(before)) {
    if (!Object.hasOwn(after, id) && JSON.stringify(before[id]) === JSON.stringify(disk[id])) delete result[id];
  }
  for (const [id, value] of Object.entries(after)) {
    if (JSON.stringify(value) !== JSON.stringify(before[id])) result[id] = value;
  }
  return result;
}
const byId = (entries: WeightEntry[] = []) => Object.fromEntries(entries.map(entry => [entry.id, entry]));
function merge(disk: Stored, before: Partial<Snapshot>, after: Stored): Stored {
  const current = after.state;
  const saved = disk.state;
  const pendingByOwner = { ...saved.pendingByOwner };
  for (const owner of Object.keys({ ...before.pendingByOwner, ...current.pendingByOwner })) {
    pendingByOwner[owner] = patchMap(saved.pendingByOwner?.[owner], before.pendingByOwner?.[owner], current.pendingByOwner?.[owner]);
  }
  return { version: after.version, state: {
    entries: Object.values(patchMap(byId(saved.entries), byId(before.entries), byId(current.entries)))
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date)),
    entryOwners: patchMap(saved.entryOwners, before.entryOwners, current.entryOwners),
    pendingByOwner,
    lastMutationTime: Math.max(saved.lastMutationTime || 0, current.lastMutationTime || 0),
  } };
}

async function read(key: string) {
  if (Platform.OS !== 'web') return AsyncStorage.getItem(key);
  await pending;
  const db = await database();
  const saved = await new Promise<Stored | undefined>((resolve, reject) => {
    const req = db.transaction('weights').objectStore('weights').get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  // Import the old snapshot as-is, including unacknowledged edits. Do not
  // remove the legacy copy or upload historical measurements as a side effect.
  const value = saved ? JSON.stringify(saved) : await AsyncStorage.getItem(key);
  baseline = value ? JSON.parse(value) : { version: 0, state: {} };
  return value;
}

async function write(key: string, value: string) {
  if (Platform.OS !== 'web') return AsyncStorage.setItem(key, value);
  if (!baseline) throw new Error('Weight history has not been loaded yet');
  const before = baseline;
  const after: Stored = JSON.parse(value);
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('weights', 'readwrite');
    const store = tx.objectStore('weights');
    const req = store.get(key);
    req.onsuccess = () => {
      try { store.put(req.result ? merge(req.result, before.state, after) : after, key); }
      catch (err) { tx.abort(); reject(err); }
    };
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error || new Error('Weight save was interrupted'));
  });
  baseline = after;
}

export async function flushWeightStorage() {
  await pending;
  if (lastError) throw lastError;
}
export const weightStorage = {
  getItem: read,
  setItem(key: string, value: string) {
    pending = pending.then(() => write(key, value)).then(
      () => { lastError = undefined; },
      err => { lastError = err; },
    );
    return pending;
  },
  removeItem: async () => { throw new Error('Use clearEntries to remove weights'); },
};
