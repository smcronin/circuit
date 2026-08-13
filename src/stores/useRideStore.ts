import { create } from 'zustand';
import type {
  RideAccumulators,
  RideGap,
  RidePoint,
  RideStats,
  RideStatus,
  RideSummary,
} from '@/types/ride';
import {
  GAP_THRESHOLD_MS,
  MAX_ACCURACY_M,
  MAX_PLAUSIBLE_SPEED_MPS,
  MOVING_THRESHOLD_MPS,
  accumulateElevationGain,
  evaluateFix,
  gradeBetween,
  resolveSpeedMps,
} from '@/utils/geo';
import { defaultRiderParams, energyForInterval, type RiderParams } from '@/utils/cycling';

// Stats are folded forward one fix at a time rather than recomputed from the
// full point list. A 2-hour ride is ~7,000 points and this runs on every fix
// while the phone is also drawing a live UI, so an O(n) recompute per fix would
// turn into O(n²) over the ride.

const emptyStats = (): RideStats => ({
  elapsedSeconds: 0,
  movingSeconds: 0,
  distanceMeters: 0,
  elevationGainMeters: 0,
  avgSpeedMps: 0,
  maxSpeedMps: 0,
  currentSpeedMps: 0,
  workKJ: 0,
  kcal: 0,
});

const emptyAccum = (): RideAccumulators => ({ smoothedAlt: null, altReference: null });

interface RideState {
  status: RideStatus;
  startedAt: number | null;
  endedAt: number | null;
  points: RidePoint[];
  gaps: RideGap[];
  stats: RideStats;
  accum: RideAccumulators;
  /** Total milliseconds spent explicitly paused, excluded from elapsed time. */
  pausedMs: number;
  pauseStartedAt: number | null;
  lastFixAt: number | null;
  /** Accuracy of the most recent fix in metres, for the signal indicator. */
  lastAccuracy: number | null;
  /**
   * When true, the next accepted fix becomes a fresh anchor: appended to the
   * track but banking no distance, time or energy. Set on resume, because the
   * previous point may be a coffee stop (or a recovered draft) away and would
   * otherwise be credited as riding.
   */
  awaitingAnchor: boolean;
  riderParams: RiderParams;
  /** Pocket lock — swallows touches so denim doesn't end the ride. */
  locked: boolean;

  start: (params: RiderParams) => void;
  addFix: (point: RidePoint) => void;
  tick: () => void;
  pause: () => void;
  resume: () => void;
  finish: () => void;
  reset: () => void;
  setLocked: (locked: boolean) => void;
  restore: (snapshot: RideSnapshot) => void;
  buildSummary: () => RideSummary | null;
}

/** The shape persisted to storage so a crash or reload doesn't lose a ride. */
export interface RideSnapshot {
  status: RideStatus;
  startedAt: number | null;
  endedAt: number | null;
  points: RidePoint[];
  gaps: RideGap[];
  stats: RideStats;
  accum: RideAccumulators;
  pausedMs: number;
  lastFixAt: number | null;
  riderParams: RiderParams;
}

export const useRideStore = create<RideState>()((set, get) => ({
  status: 'idle',
  startedAt: null,
  endedAt: null,
  points: [],
  gaps: [],
  stats: emptyStats(),
  accum: emptyAccum(),
  pausedMs: 0,
  pauseStartedAt: null,
  lastFixAt: null,
  lastAccuracy: null,
  riderParams: defaultRiderParams(),
  locked: false,
  awaitingAnchor: false,

  start: (params) =>
    set({
      status: 'recording',
      startedAt: Date.now(),
      endedAt: null,
      points: [],
      gaps: [],
      stats: emptyStats(),
      accum: emptyAccum(),
      pausedMs: 0,
      pauseStartedAt: null,
      lastFixAt: null,
      lastAccuracy: null,
      riderParams: params,
      locked: false,
      awaitingAnchor: false,
    }),

  addFix: (point) => {
    const state = get();
    if (state.status !== 'recording') return;

    const previous = state.points.length ? state.points[state.points.length - 1] : null;

    // Fresh anchor after a resume: keep the point, bank nothing.
    if (state.awaitingAnchor) {
      if (point.acc > MAX_ACCURACY_M) {
        set({ lastAccuracy: point.acc });
        return;
      }
      const accum = { ...state.accum };
      accumulateElevationGain(accum, point.alt);
      set({
        points: [...state.points, point],
        accum,
        awaitingAnchor: false,
        lastFixAt: point.t,
        lastAccuracy: point.acc,
        stats: { ...state.stats, currentSpeedMps: 0 },
      });
      return;
    }

    const decision = evaluateFix(previous, point);

    if (!decision.accept) {
      // Still worth showing the user that a fix arrived and how bad it was.
      set({ lastAccuracy: point.acc });
      return;
    }

    const stats = { ...state.stats };
    const accum = { ...state.accum };
    const gaps = state.gaps;
    let nextGaps = gaps;

    // A long silence means iOS suspended us — almost always a locked screen.
    // Anchor to the new point without banking the distance: we genuinely do not
    // know whether he rode that line or drove it.
    const suspended =
      previous !== null && state.lastFixAt !== null && point.t - state.lastFixAt > GAP_THRESHOLD_MS;

    if (suspended && previous) {
      nextGaps = [
        ...gaps,
        {
          startedAt: state.lastFixAt as number,
          endedAt: point.t,
          skippedMeters: decision.distanceMeters,
        },
      ];
      accumulateElevationGain(accum, point.alt);
      set({
        points: [...state.points, point],
        gaps: nextGaps,
        accum,
        lastFixAt: point.t,
        lastAccuracy: point.acc,
        stats: { ...stats, currentSpeedMps: 0 },
      });
      return;
    }

    const seconds = decision.elapsedMs / 1000;
    const speed = Math.min(
      MAX_PLAUSIBLE_SPEED_MPS,
      resolveSpeedMps(point, decision.distanceMeters, decision.elapsedMs)
    );
    const isMoving = speed >= MOVING_THRESHOLD_MPS && decision.distanceMeters > 0;

    stats.distanceMeters += decision.distanceMeters;
    stats.currentSpeedMps = isMoving ? speed : 0;
    stats.maxSpeedMps = Math.max(stats.maxSpeedMps, isMoving ? speed : 0);
    stats.elevationGainMeters += accumulateElevationGain(accum, point.alt);

    if (isMoving && previous) {
      stats.movingSeconds += seconds;
      const grade = gradeBetween(previous, point, decision.distanceMeters);
      const energy = energyForInterval(speed, grade, seconds, state.riderParams);
      stats.workKJ += energy.workKJ;
      stats.kcal += energy.kcal;
    }

    stats.avgSpeedMps =
      stats.movingSeconds > 0 ? stats.distanceMeters / stats.movingSeconds : 0;

    set({
      points: [...state.points, point],
      stats,
      accum,
      lastFixAt: point.t,
      lastAccuracy: point.acc,
    });
  },

  // Driven by a 1Hz interval so the clock keeps running (and the "no signal"
  // state can appear) even when no fixes are arriving.
  tick: () => {
    const { status, startedAt, pausedMs, stats, lastFixAt } = get();
    if (status !== 'recording' || startedAt === null) return;

    const elapsedSeconds = Math.max(0, (Date.now() - startedAt - pausedMs) / 1000);
    // Decay the live speed readout if fixes have stopped, so a stale number
    // doesn't sit there looking authoritative.
    const stale = lastFixAt !== null && Date.now() - lastFixAt > 5000;

    set({
      stats: {
        ...stats,
        elapsedSeconds,
        currentSpeedMps: stale ? 0 : stats.currentSpeedMps,
      },
    });
  },

  pause: () => {
    if (get().status !== 'recording') return;
    set({ status: 'paused', pauseStartedAt: Date.now() });
  },

  resume: () => {
    const { status, pauseStartedAt, pausedMs } = get();
    if (status !== 'paused') return;
    const addedPause = pauseStartedAt ? Date.now() - pauseStartedAt : 0;
    set({
      status: 'recording',
      pausedMs: pausedMs + addedPause,
      pauseStartedAt: null,
      lastFixAt: Date.now(),
      // Whatever happened during the pause — a coffee stop, a drive home, a
      // reloaded draft — must not be credited as riding.
      awaitingAnchor: true,
    });
  },

  finish: () => {
    const { status, pauseStartedAt, pausedMs } = get();
    if (status === 'idle' || status === 'finished') return;
    const addedPause = status === 'paused' && pauseStartedAt ? Date.now() - pauseStartedAt : 0;
    set({
      status: 'finished',
      endedAt: Date.now(),
      pausedMs: pausedMs + addedPause,
      pauseStartedAt: null,
      locked: false,
    });
  },

  reset: () =>
    set({
      status: 'idle',
      startedAt: null,
      endedAt: null,
      points: [],
      gaps: [],
      stats: emptyStats(),
      accum: emptyAccum(),
      pausedMs: 0,
      pauseStartedAt: null,
      lastFixAt: null,
      lastAccuracy: null,
      locked: false,
      awaitingAnchor: false,
    }),

  setLocked: (locked) => set({ locked }),

  restore: (snapshot) =>
    set({
      status: snapshot.status,
      startedAt: snapshot.startedAt,
      endedAt: snapshot.endedAt,
      points: snapshot.points,
      gaps: snapshot.gaps,
      stats: snapshot.stats,
      accum: snapshot.accum,
      pausedMs: snapshot.pausedMs,
      // Treat everything since the last recorded fix as paused time. Without
      // this, a ride recovered an hour after the crash would count that hour as
      // elapsed ride time the moment it resumed.
      pauseStartedAt: snapshot.lastFixAt ?? Date.now(),
      lastFixAt: snapshot.lastFixAt,
      lastAccuracy: null,
      riderParams: snapshot.riderParams,
      locked: false,
      awaitingAnchor: true,
    }),

  buildSummary: () => {
    const { startedAt, endedAt, points, gaps, stats } = get();
    if (startedAt === null) return null;
    return {
      stats,
      points,
      gaps,
      startedAt: new Date(startedAt).toISOString(),
      endedAt: new Date(endedAt ?? Date.now()).toISOString(),
      calorieModel: 'physics',
    };
  },
}));

/** Snapshot the live ride for crash recovery. */
export function snapshotRide(): RideSnapshot {
  const s = useRideStore.getState();
  return {
    status: s.status,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    points: s.points,
    gaps: s.gaps,
    stats: s.stats,
    accum: s.accum,
    pausedMs: s.pausedMs,
    lastFixAt: s.lastFixAt,
    riderParams: s.riderParams,
  };
}
