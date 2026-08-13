// ─── Ride recorder: GPS stream + screen wake lock ───────────────────────────
// Circuit runs as an installed PWA, so the only location source available is
// the browser Geolocation API. That API stops delivering the moment iOS
// suspends the page — which it does as soon as the screen locks. The wake lock
// is therefore not a nicety, it is the whole reason recording works at all, and
// this hook treats losing it as a first-class event rather than an edge case.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useRideStore, snapshotRide } from '@/stores/useRideStore';
import { saveRideDraft } from '@/utils/rideDraft';
import type { RidePoint, RideSignal } from '@/types/ride';
import type { RiderParams } from '@/utils/cycling';

const KEEP_AWAKE_TAG = 'circuit-ride';

/** Beyond this many metres of reported accuracy the fix is decorative. */
const WEAK_SIGNAL_M = 15;
/** No fix in this long and we tell the user the signal is gone. */
const SIGNAL_TIMEOUT_MS = 8000;

const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  // Never hand us a cached fix — for a moving bike, a 5-second-old position is
  // 100 metres of error.
  maximumAge: 0,
  timeout: 20_000,
};

export type RideError =
  | 'unsupported'
  | 'permission-denied'
  | 'position-unavailable'
  | 'timeout'
  | null;

function getGeolocation(): Geolocation | null {
  if (Platform.OS !== 'web') return null;
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
  return navigator.geolocation;
}

/** Whether this device can record a ride at all. */
export function isRideRecordingSupported(): boolean {
  return getGeolocation() !== null;
}

export interface UseRideRecorder {
  error: RideError;
  signal: RideSignal;
  /** True when the screen wake lock could not be held — recording will die on lock. */
  wakeLockLost: boolean;
  begin: (params: RiderParams) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
}

export function useRideRecorder(): UseRideRecorder {
  const status = useRideStore((s) => s.status);
  const lastAccuracy = useRideStore((s) => s.lastAccuracy);
  const lastFixAt = useRideStore((s) => s.lastFixAt);

  const [error, setError] = useState<RideError>(null);
  const [wakeLockLost, setWakeLockLost] = useState(false);
  const [signalStale, setSignalStale] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const isRecording = status === 'recording';

  // ─── GPS subscription ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!isRecording) return;

    const geo = getGeolocation();
    if (!geo) {
      setError('unsupported');
      return;
    }

    const onPosition = (position: GeolocationPosition) => {
      setError(null);
      const { coords, timestamp } = position;
      const point: RidePoint = {
        t: timestamp || Date.now(),
        lat: coords.latitude,
        lon: coords.longitude,
        alt: Number.isFinite(coords.altitude as number) ? (coords.altitude as number) : null,
        acc: Number.isFinite(coords.accuracy) ? coords.accuracy : 999,
        spd: Number.isFinite(coords.speed as number) ? (coords.speed as number) : null,
      };
      useRideStore.getState().addFix(point);
      void saveRideDraft(snapshotRide());
    };

    const onError = (err: GeolocationPositionError) => {
      if (err.code === 1) setError('permission-denied');
      else if (err.code === 2) setError('position-unavailable');
      else if (err.code === 3) setError('timeout');
    };

    watchIdRef.current = geo.watchPosition(onPosition, onError, GEOLOCATION_OPTIONS);

    return () => {
      if (watchIdRef.current !== null) {
        geo.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isRecording]);

  // ─── Screen wake lock ─────────────────────────────────────────────────────
  // iOS releases the wake lock whenever the page is hidden and does not give it
  // back on its own, so we re-acquire on every return to visibility.
  useEffect(() => {
    if (status !== 'recording' && status !== 'paused') return;

    let cancelled = false;

    const acquire = async () => {
      try {
        await activateKeepAwakeAsync(KEEP_AWAKE_TAG);
        if (!cancelled) setWakeLockLost(false);
      } catch {
        if (!cancelled) setWakeLockLost(true);
      }
    };

    void acquire();

    const onVisibility = () => {
      if (typeof document === 'undefined') return;
      if (document.visibilityState === 'visible') {
        void acquire();
        // Coming back from hidden means we were suspended; force a draft write
        // so whatever we did capture is durable.
        void saveRideDraft(snapshotRide(), true);
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }

    return () => {
      cancelled = true;
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
      try {
        deactivateKeepAwake(KEEP_AWAKE_TAG);
      } catch {
        // Already released.
      }
    };
  }, [status]);

  // ─── Clock + stale-signal detection ───────────────────────────────────────
  useEffect(() => {
    if (!isRecording) return;
    const id = setInterval(() => {
      useRideStore.getState().tick();
      const fixAt = useRideStore.getState().lastFixAt;
      setSignalStale(fixAt === null || Date.now() - fixAt > SIGNAL_TIMEOUT_MS);
    }, 1000);
    return () => clearInterval(id);
  }, [isRecording]);

  const begin = useCallback((params: RiderParams) => {
    setError(isRideRecordingSupported() ? null : 'unsupported');
    useRideStore.getState().start(params);
  }, []);

  const pause = useCallback(() => {
    useRideStore.getState().pause();
    void saveRideDraft(snapshotRide(), true);
  }, []);

  const resume = useCallback(() => {
    useRideStore.getState().resume();
  }, []);

  const stop = useCallback(() => {
    useRideStore.getState().finish();
    void saveRideDraft(snapshotRide(), true);
  }, []);

  let signal: RideSignal = 'none';
  if (isRecording) {
    if (lastFixAt === null) signal = 'acquiring';
    else if (signalStale) signal = 'none';
    else if (lastAccuracy !== null && lastAccuracy > WEAK_SIGNAL_M) signal = 'weak';
    else signal = 'good';
  }

  return { error, signal, wakeLockLost, begin, pause, resume, stop };
}
