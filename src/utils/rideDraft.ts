// ─── Crash recovery for in-progress rides ───────────────────────────────────
// A ride is 45+ minutes of data that cannot be re-created. If the PWA reloads
// mid-ride — iOS evicting the tab, a stray refresh, a Vercel deploy landing —
// we want the ride back, not a shrug.
//
// This deliberately does NOT use zustand's `persist` middleware: that writes on
// every state change, which at ~1 fix/second means thousands of full-array
// serialisations per ride. Instead the caller snapshots on a throttle.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RideSnapshot } from '@/stores/useRideStore';

const DRAFT_KEY = 'ride-draft-v1';
const SAVE_INTERVAL_MS = 15_000;
/** Drafts older than this are stale — a forgotten ride, not a recoverable one. */
const MAX_DRAFT_AGE_MS = 12 * 60 * 60 * 1000;

let lastSaveAt = 0;

/** Persist a snapshot, at most once per SAVE_INTERVAL_MS. */
export async function saveRideDraft(snapshot: RideSnapshot, force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastSaveAt < SAVE_INTERVAL_MS) return;
  lastSaveAt = now;
  try {
    await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify({ savedAt: now, snapshot }));
  } catch {
    // A failed draft write must never interrupt an active recording.
  }
}

export async function loadRideDraft(): Promise<RideSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { savedAt: number; snapshot: RideSnapshot };
    if (!parsed?.snapshot || typeof parsed.savedAt !== 'number') return null;
    if (Date.now() - parsed.savedAt > MAX_DRAFT_AGE_MS) {
      await clearRideDraft();
      return null;
    }
    // Only an actually-started ride with data is worth restoring. Finished
    // drafts ARE restorable: a crash on the save screen shouldn't lose the
    // workout that was just recorded.
    if (!parsed.snapshot.startedAt || parsed.snapshot.points.length === 0) return null;

    return parsed.snapshot;
  } catch {
    return null;
  }
}

export async function clearRideDraft(): Promise<void> {
  lastSaveAt = 0;
  try {
    await AsyncStorage.removeItem(DRAFT_KEY);
  } catch {
    // Nothing useful to do here.
  }
}
