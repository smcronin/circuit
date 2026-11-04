import { AppState, Platform } from 'react-native';
import { create } from 'zustand';
import { useUserStore } from '@/stores/useUserStore';
import { flushWeightStorage, useWeightStore, weightDay } from '@/stores/useWeightStore';
import type { WeightEntry } from '@/types/workout';
import { MAX_WEIGHT_CHANGES, type WeightChange } from '@/utils/weightSync';
import { stableJson } from '@/utils/historyMerge';

interface WeightDay { localDate: string; id: string; entry: WeightEntry | null }
interface Snapshot { days: WeightDay[]; acknowledged: string[]; canSeed: boolean }
export const useWeightConnection = create<{ status: 'loading' | 'saving' | 'saved' | 'offline' | 'unpaired'; code?: string }>(() => ({ status: 'loading' }));

// Apply a committed database snapshot. An edit still in the outbox takes
// precedence on this device until the server has processed that exact edit.
export function reconcileWeights(owner: string, result: Snapshot, sent: WeightChange[]) {
  const store = useWeightStore.getState();
  const ack = new Set(result.acknowledged);
  const accepted = new Set(sent.filter(change => ack.has(change.mutationId)).map(change => change.mutationId));
  const outstanding = Object.values(store.pendingByOwner[owner] || {}).filter(c => !accepted.has(c.mutationId));
  const pendingDays = new Set(outstanding.map(c => c.localDate));
  const pendingIds = new Set(outstanding.map(c => c.id));
  const entries = new Map(store.entries.map(e => [weightDay(e), e]));
  const entryOwners = { ...store.entryOwners };
  const knownDays = new Set<string>();
  for (const day of result.days) {
    knownDays.add(day.localDate);
    if (pendingDays.has(day.localDate) || pendingIds.has(day.id)) continue;
    if (day.entry) {
      entries.set(day.localDate, { ...day.entry, localDate: day.localDate });
      entryOwners[day.id] = owner;
    } else {
      entries.delete(day.localDate);
    }
  }
  const sorted = [...entries.values()].sort((a, b) => weightDay(b).localeCompare(weightDay(a)));
  const pending = Object.fromEntries(outstanding.map(c => [c.id, c]));
  if (stableJson(store.entries) !== stableJson(sorted) || stableJson(store.entryOwners) !== stableJson(entryOwners) ||
      Object.keys(store.pendingByOwner[owner] || {}).length !== outstanding.length) {
    useWeightStore.setState({ entries: sorted, entryOwners, pendingByOwner: { ...store.pendingByOwner, [owner]: pending } });
  }
  // Only the original, approved profile may contribute pre-sync device history.
  // Insert-if-absent on the server also protects newer values and deletions.
  return result.canSeed ? sorted.filter(e => !knownDays.has(weightDay(e)) && !pendingDays.has(weightDay(e)) &&
    (!entryOwners[e.id] || entryOwners[e.id] === owner)).slice(0, MAX_WEIGHT_CHANGES)
    .map(e => ({ id: e.id, entry: e, changedAt: e.date, mutationId: e.id, localDate: weightDay(e), timeZone: null })) : [];
}

export function initializeWeightDatabase() {
  let active = true;
  let timer: ReturnType<typeof setTimeout>;
  let running = false;
  let requested = false;
  let applying = false;
  let authorizedProfile: string | undefined;
  let request: AbortController | undefined;

  function schedule(delay = 0) {
    if (!active) return;
    clearTimeout(timer);
    timer = setTimeout(run, delay);
  }
  async function run() {
    if (!active || !useUserStore.persist.hasHydrated() || !useWeightStore.persist.hasHydrated()) return;
    if (running) { requested = true; return; }
    const owner = useUserStore.getState().profile?.id;
    if (!owner) return;
    running = true;
    let seeds: WeightChange[] = [];
    try {
      do {
        const changes = authorizedProfile === owner ?
          Object.values(useWeightStore.getState().pendingByOwner[owner] || {}).slice(0, MAX_WEIGHT_CHANGES) : [];
        request = new AbortController();
        const timeout = setTimeout(() => request?.abort(), 15000);
        let response: Response, body;
        try {
          response = await fetch(Platform.OS === 'web' ? '/api/weights' : 'https://circuit-five.vercel.app/api/weights', {
            method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profileId: owner, changes, seeds }), signal: request.signal,
          });
          body = await response.json();
        } finally { clearTimeout(timeout); }
        if (!active || useUserStore.getState().profile?.id !== owner) return;
        if (response.status === 401 && /^[A-Za-z0-9_-]{22}$/.test(body.deviceCode)) {
          authorizedProfile = undefined;
          useWeightConnection.setState({ status: 'unpaired', code: body.deviceCode });
          schedule(15000);
          return;
        }
        if (!response.ok || !Array.isArray(body.days) || !Array.isArray(body.acknowledged) ||
            !changes.every(c => body.acknowledged.includes(c.mutationId))) throw new Error('Unconfirmed weight sync');
        authorizedProfile = owner;
        applying = true;
        try { seeds = reconcileWeights(owner, body, changes); }
        finally { applying = false; }
        try { await flushWeightStorage(); }
        catch {
          // Reattempt a failed cache write even if the database was unchanged.
          useWeightStore.setState({});
          await flushWeightStorage();
        }
      } while (active && useUserStore.getState().profile?.id === owner &&
        (seeds.length || Object.keys(useWeightStore.getState().pendingByOwner[owner] || {}).length));
      if (active && useUserStore.getState().profile?.id === owner) useWeightConnection.setState({ status: 'saved', code: undefined });
    } catch {
      if (active && useUserStore.getState().profile?.id === owner) {
        useWeightConnection.setState({ status: 'offline', code: undefined });
        schedule(30000);
      }
    } finally {
      running = false;
      if (requested) { requested = false; schedule(); }
    }
  }
  const start = () => schedule();
  const listeners = [
    useUserStore.persist.onFinishHydration(start), useWeightStore.persist.onFinishHydration(start),
    useUserStore.subscribe((s, p) => {
      if (s.profile?.id !== p.profile?.id) {
        authorizedProfile = undefined;
        useWeightConnection.setState({ status: 'loading', code: undefined });
        start();
      }
    }),
    useWeightStore.subscribe((s, p) => {
      if (!applying && (s.entries !== p.entries || s.pendingByOwner !== p.pendingByOwner)) {
        useWeightConnection.setState({ status: 'saving' });
        schedule(150);
      }
    }),
  ];
  const state = AppState.addEventListener('change', value => { if (value === 'active') start(); });
  if (Platform.OS === 'web') { window.addEventListener('online', start); window.addEventListener('focus', start); }
  start();
  return () => {
    active = false;
    clearTimeout(timer);
    request?.abort();
    listeners.forEach(stop => stop());
    state.remove();
    if (Platform.OS === 'web') { window.removeEventListener('online', start); window.removeEventListener('focus', start); }
  };
}
