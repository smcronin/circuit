import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { StateStorage } from 'zustand/middleware';
import { mergeHistory, stableJson } from '../utils/historyMerge';
import { useHistorySaveStore } from '../stores/useHistorySaveStore';

let database: Promise<IDBDatabase> | undefined;
let pending: Promise<void> = Promise.resolve();
let lastError: unknown;

function openDatabase() {
  if (!database) database = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('circuit-history', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('history');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Workout storage is busy. Close other Circuit tabs and retry.'));
  }).catch(error => { database = undefined; throw error; });
  return database;
}

async function read(key: string): Promise<string | null> {
  if (Platform.OS !== 'web') return AsyncStorage.getItem(key);
  try {
    const db = await openDatabase();
    const stored = await new Promise<string | null>((resolve, reject) => {
      const request = db.transaction('history').objectStore('history').get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
    if (stored) return stored;
  } catch {
    // Keep the legacy copy readable even if IndexedDB is unavailable.
  }
  return AsyncStorage.getItem(key);
}

async function write(key: string, value: string) {
  if (Platform.OS !== 'web') return AsyncStorage.setItem(key, value);
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('history', 'readwrite');
    const store = tx.objectStore('history');
    const request = store.get(key);
    request.onsuccess = () => {
      try {
        const incoming = JSON.parse(value);
        // The read + merge + write is one transaction, including across tabs.
        if (request.result) {
          const previous = JSON.parse(request.result);
          incoming.state = mergeHistory(previous.state, incoming.state);
        }
        store.put(stableJson(incoming), key);
      } catch (error) { tx.abort(); reject(error); }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Workout storage was interrupted'));
  });
  // Retain the legacy localStorage copy for recovery. New writes use IndexedDB.
}

export async function flushHistoryStorage(): Promise<void> {
  await pending;
  if (lastError) throw lastError;
}

export const historyStorage: StateStorage = {
  getItem: read,
  setItem: (key, value) => {
    useHistorySaveStore.setState({ local: 'saving' });
    pending = pending.then(async () => {
      try {
        await write(key, value);
        lastError = undefined;
        useHistorySaveStore.setState({ local: 'saved' });
      } catch (error) {
        lastError = error;
        useHistorySaveStore.setState({ local: 'error' });
      }
    });
    return pending;
  },
  // Explicit history deletion is represented by tombstones, not clearing storage.
  removeItem: async () => { throw new Error('Use clearHistory to safely remove workout history'); },
};
