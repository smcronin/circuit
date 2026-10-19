import { AppState, Platform } from 'react-native';
import { useHistoryStore } from '@/stores/useHistoryStore';
import { useUserStore } from '@/stores/useUserStore';
import { useHistorySaveStore } from '@/stores/useHistorySaveStore';
import { flushHistoryStorage } from './historyStorage';
import type { WorkoutHistory, WorkoutSession } from '@/types/workout';
import type { HistoryData } from '@/utils/historyMerge';

const PRODUCTION_SYNC_URL = 'https://circuit-five.vercel.app/api/history-sync';
interface SyncResponse extends Partial<HistoryData> {
  ok: boolean;
  protocolVersion?: number;
  syncedSessions?: number;
  revision?: number;
  error?: string;
}
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let inFlight: Promise<SyncResponse> | null = null;
let applyingRemote = false;
let active = false;

function prepareSessionForCloud(session: WorkoutSession): WorkoutSession {
  return session.ride ? { ...session, ride: { ...session.ride, points: [] } } : session;
}

export function prepareHistoryForCloud(history: WorkoutHistory): WorkoutHistory {
  return { ...history, sessions: history.sessions.map(prepareSessionForCloud) };
}

async function uploadAndReconcile(): Promise<SyncResponse> {
  const profile = useUserStore.getState().profile;
  if (!profile) throw new Error('No Circuit profile is available');
  const captured = useHistoryStore.getState();
  useHistorySaveStore.setState({ cloud: 'syncing', message: undefined });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(Platform.OS === 'web' ? '/api/history-sync' : PRODUCTION_SYNC_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
      body: JSON.stringify({
        profileId: profile.id, protocolVersion: 2,
        history: prepareHistoryForCloud(captured.history), workoutSummary: captured.workoutSummary,
        deletedSessions: captured.deletedSessions, sourceUpdatedAt: new Date().toISOString(),
      }),
    });
    const result = await response.json() as SyncResponse;
    if (!response.ok || !result.ok || result.protocolVersion !== 2 || !result.history) {
      throw new Error(result.error || 'History sync could not be confirmed');
    }
    if (profile.id !== useUserStore.getState().profile?.id) return result;
    const current = useHistoryStore.getState();
    const changedWhileSaving = current.history !== captured.history || current.deletedSessions !== captured.deletedSessions || current.workoutSummary !== captured.workoutSummary;
    applyingRemote = true;
    try { current.mergeRemoteHistory(result as HistoryData); }
    finally { applyingRemote = false; }
    useHistorySaveStore.setState({ cloud: changedWhileSaving ? 'pending' : 'saved', message: undefined });
    if (changedWhileSaving) scheduleHistorySync();
    return result;
  } catch (error) {
    useHistorySaveStore.setState({ cloud: 'error', message: 'Cloud sync failed. Your workout will be retried.' });
    scheduleHistorySync(30000);
    throw error;
  } finally { clearTimeout(timeout); }
}

export async function syncHistoryToCloud(): Promise<SyncResponse> {
  // A caller finishing a workout must wait for its own latest state, not an
  // unrelated upload that started before the workout/feedback was added.
  while (inFlight) await inFlight.catch(() => undefined);
  const request = uploadAndReconcile();
  inFlight = request;
  try { return await request; }
  finally { if (inFlight === request) inFlight = null; }
}

export async function persistWorkoutHistory(): Promise<boolean> {
  const [local, cloud] = await Promise.allSettled([flushHistoryStorage(), syncHistoryToCloud()]);
  return local.status === 'fulfilled' || cloud.status === 'fulfilled';
}

function scheduleHistorySync(delay = 1500) {
  if (!active) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    void syncHistoryToCloud().catch(() => undefined);
  }, delay);
}

export function initializeHistorySync(): () => void {
  active = true;
  let started = false;
  const startWhenHydrated = () => {
    if (!active || started || !useUserStore.persist.hasHydrated() || !useHistoryStore.persist.hasHydrated()) return;
    started = true;
    if (useUserStore.getState().profile) scheduleHistorySync(0);
  };
  const unsubscribeHistory = useHistoryStore.subscribe((state, previous) => {
    if (!applyingRemote && (state.history !== previous.history || state.workoutSummary !== previous.workoutSummary || state.deletedSessions !== previous.deletedSessions)) {
      useHistorySaveStore.setState({ cloud: 'pending' });
      if (started) scheduleHistorySync();
    }
  });
  const unsubscribeProfile = useUserStore.subscribe((state, previous) => {
    if (started && state.profile?.id !== previous.profile?.id && state.profile) scheduleHistorySync(0);
  });
  const unsubscribeUserHydration = useUserStore.persist.onFinishHydration(startWhenHydrated);
  const unsubscribeHistoryHydration = useHistoryStore.persist.onFinishHydration(startWhenHydrated);
  const resume = () => {
    if (!started) return;
    // Refresh other tabs' durable writes before sending this tab's state.
    void useHistoryStore.persist.rehydrate();
    scheduleHistorySync();
  };
  const appState = AppState.addEventListener('change', state => { if (state === 'active') resume(); });
  if (Platform.OS === 'web') {
    window.addEventListener('online', resume);
    window.addEventListener('focus', resume);
  }
  startWhenHydrated();
  return () => {
    active = false;
    unsubscribeHistory(); unsubscribeProfile(); unsubscribeUserHydration(); unsubscribeHistoryHydration(); appState.remove();
    if (Platform.OS === 'web') { window.removeEventListener('online', resume); window.removeEventListener('focus', resume); }
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = null;
  };
}
