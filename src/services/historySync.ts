import { Platform } from 'react-native';
import { useHistoryStore } from '@/stores/useHistoryStore';
import { useUserStore } from '@/stores/useUserStore';
import type { WorkoutHistory, WorkoutSession } from '@/types/workout';

const PRODUCTION_SYNC_URL = 'https://circuit-five.vercel.app/api/history-sync';
const SYNC_DEBOUNCE_MS = 1_500;

interface SyncResponse {
  ok: boolean;
  syncedSessions?: number;
  syncedAt?: string;
  error?: string;
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let syncInFlight = false;
let syncQueued = false;

function syncUrl(): string {
  return Platform.OS === 'web' ? '/api/history-sync' : PRODUCTION_SYNC_URL;
}

/**
 * Exact GPS traces are not needed for coaching or workout analytics. Keep them
 * on-device while preserving ride duration, distance, speed, elevation, and
 * energy data in the cloud snapshot.
 */
function prepareSessionForCloud(session: WorkoutSession): WorkoutSession {
  if (!session.ride) return session;

  return {
    ...session,
    ride: {
      ...session.ride,
      points: [],
    },
  };
}

export function prepareHistoryForCloud(history: WorkoutHistory): WorkoutHistory {
  return {
    ...history,
    sessions: history.sessions.map(prepareSessionForCloud),
  };
}

export async function syncHistoryToCloud(): Promise<SyncResponse> {
  const profile = useUserStore.getState().profile;
  if (!profile) return { ok: false, error: 'No Circuit profile is available' };

  const { history, workoutSummary } = useHistoryStore.getState();
  const response = await fetch(syncUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      profileId: profile.id,
      history: prepareHistoryForCloud(history),
      workoutSummary,
      sourceUpdatedAt: new Date().toISOString(),
    }),
  });

  const result = (await response.json().catch(() => ({}))) as SyncResponse;
  if (!response.ok || !result.ok) {
    throw new Error(result.error || `Workout history sync failed (${response.status})`);
  }

  return result;
}

async function flushHistorySync() {
  if (syncInFlight) {
    syncQueued = true;
    return;
  }

  syncInFlight = true;
  try {
    await syncHistoryToCloud();
  } catch (error) {
    // Local storage remains authoritative. A later app launch or history change
    // will retry without interrupting the workout flow.
    console.warn('Circuit cloud history sync deferred:', error);
  } finally {
    syncInFlight = false;
    if (syncQueued) {
      syncQueued = false;
      scheduleHistorySync();
    }
  }
}

function scheduleHistorySync() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    void flushHistorySync();
  }, SYNC_DEBOUNCE_MS);
}

/**
 * Starts once both persisted stores are hydrated. The first upload performs the
 * local-to-database migration; subsequent history mutations keep the snapshot
 * current. Returns a cleanup function for the root layout lifecycle.
 */
export function initializeHistorySync(): () => void {
  let active = true;
  let started = false;
  let unsubscribeHistory: (() => void) | undefined;

  const startWhenHydrated = () => {
    if (
      !active ||
      started ||
      !useUserStore.persist.hasHydrated() ||
      !useHistoryStore.persist.hasHydrated()
    ) {
      return;
    }

    started = true;
    void flushHistorySync();
    unsubscribeHistory = useHistoryStore.subscribe((state, previousState) => {
      if (
        state.history !== previousState.history ||
        state.workoutSummary !== previousState.workoutSummary
      ) {
        scheduleHistorySync();
      }
    });
  };

  const unsubscribeUserHydration = useUserStore.persist.onFinishHydration(startWhenHydrated);
  const unsubscribeHistoryHydration = useHistoryStore.persist.onFinishHydration(startWhenHydrated);
  startWhenHydrated();

  return () => {
    active = false;
    unsubscribeUserHydration();
    unsubscribeHistoryHydration();
    unsubscribeHistory?.();
    if (syncTimer) {
      clearTimeout(syncTimer);
      syncTimer = null;
    }
  };
}
