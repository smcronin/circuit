import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { colors, fonts, spacing, typography, borderRadius, shadows } from '@/theme';
import { useRideStore } from '@/stores/useRideStore';
import { useHistoryStore, useUserStore } from '@/stores';
import { useRideRecorder, isRideRecordingSupported } from '@/hooks/useRideRecorder';
import { RouteMap } from '@/components/ride';
import { PROGRAMMED_WORKOUTS } from '@/data/programmedWorkouts';
import { createRideWorkoutSession } from '@/utils/createRideWorkoutSession';
import { loadRideDraft, clearRideDraft } from '@/utils/rideDraft';
import { confirmAction } from '@/utils/confirm';
import { defaultRiderParams, toKilograms } from '@/utils/cycling';
import {
  formatDistance,
  formatSpeed,
  formatElevation,
  formatRideClock,
  distanceUnit,
  speedUnit,
  elevationUnit,
} from '@/utils/rideFormat';

/** Milliseconds the unlock button must be held. Long enough that a pocket can't do it. */
const UNLOCK_HOLD_MS = 1500;

export default function RideScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { programId } = useLocalSearchParams<{ programId?: string }>();

  const profile = useUserStore((s) => s.profile);
  const addSession = useHistoryStore((s) => s.addSession);

  const status = useRideStore((s) => s.status);
  const stats = useRideStore((s) => s.stats);
  const points = useRideStore((s) => s.points);
  const gaps = useRideStore((s) => s.gaps);
  const locked = useRideStore((s) => s.locked);
  const setLocked = useRideStore((s) => s.setLocked);
  const restore = useRideStore((s) => s.restore);
  const buildSummary = useRideStore((s) => s.buildSummary);
  const resetRide = useRideStore((s) => s.reset);

  const { error, signal, wakeLockLost, begin, pause, resume, stop } = useRideRecorder();

  const [checkedDraft, setCheckedDraft] = useState(false);
  const supported = useMemo(() => isRideRecordingSupported(), []);

  const units = useMemo(
    () => ({ imperial: (profile?.weightUnit ?? 'lbs') !== 'kg' }),
    [profile?.weightUnit]
  );

  const sourceWorkout = useMemo(() => {
    if (!programId) return undefined;
    return PROGRAMMED_WORKOUTS.find((pw) => pw.id === programId)?.workout;
  }, [programId]);

  const riderParams = useMemo(
    () => defaultRiderParams(toKilograms(profile?.weight, profile?.weightUnit ?? 'lbs')),
    [profile?.weight, profile?.weightUnit]
  );

  // ─── Recover an interrupted ride ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (useRideStore.getState().status !== 'idle') {
        setCheckedDraft(true);
        return;
      }
      const draft = await loadRideDraft();
      if (cancelled) return;
      if (!draft) {
        setCheckedDraft(true);
        return;
      }

      const minutes = Math.round((draft.stats.elapsedSeconds || 0) / 60);
      const resume = await confirmAction({
        title: 'Unfinished ride found',
        message: `There's a ride in progress with ${minutes} min recorded. Pick it back up, or throw it away?`,
        confirmLabel: 'Resume',
        cancelLabel: 'Discard',
      });
      if (cancelled) return;

      if (resume) {
        // Come back paused: he's holding the phone reading this dialog, not
        // riding, and resuming live would bank a bogus gap.
        restore({ ...draft, status: 'paused' });
      } else {
        void clearRideDraft();
      }
      // Always release the gate. This screen renders nothing until it flips, so
      // any path that forgets it leaves the recorder permanently blank.
      setCheckedDraft(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [restore]);

  const handleStart = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    begin(riderParams);
  }, [begin, riderParams]);

  const handleFinish = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    stop();
  }, [stop]);

  const handleSave = useCallback(() => {
    const summary = buildSummary();
    if (!summary) return;
    const session = createRideWorkoutSession({
      summary,
      sourceWorkout,
      imperial: units.imperial,
    });
    addSession(session);
    void clearRideDraft();
    resetRide();
    router.replace('/(tabs)/history');
  }, [addSession, buildSummary, resetRide, router, sourceWorkout, units.imperial]);

  const handleDiscard = useCallback(async () => {
    const discard = await confirmAction({
      title: 'Discard this ride?',
      message: 'The recorded GPS data will be deleted for good.',
      confirmLabel: 'Discard',
      cancelLabel: 'Keep',
      destructive: true,
    });
    if (!discard) return;
    void clearRideDraft();
    resetRide();
    router.back();
  }, [resetRide, router]);

  const handleExit = useCallback(async () => {
    if (status === 'recording' || status === 'paused') {
      const leave = await confirmAction({
        title: 'Leave the recorder?',
        message: 'Recording stops when you leave this screen.',
        confirmLabel: 'Leave',
        cancelLabel: 'Stay',
        destructive: true,
      });
      if (!leave) return;
    }
    router.back();
  }, [router, status]);

  const missedMinutes = useMemo(
    () => gaps.reduce((sum, g) => sum + (g.endedAt - g.startedAt), 0) / 60000,
    [gaps]
  );

  if (!checkedDraft) {
    return <View style={styles.container} />;
  }

  if (locked) {
    return (
      <LockedOverlay
        distance={formatDistance(stats.distanceMeters, units)}
        distanceUnit={distanceUnit(units)}
        clock={formatRideClock(stats.elapsedSeconds)}
        onUnlock={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setLocked(false);
        }}
      />
    );
  }

  // ─── Pre-ride ─────────────────────────────────────────────────────────────
  if (status === 'idle') {
    return (
      <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
        <ScreenHeader title="Record Ride" onClose={handleExit} />
        <ScrollView contentContainerStyle={styles.introBody} showsVerticalScrollIndicator={false}>
          <Text style={styles.introName}>{sourceWorkout?.name ?? 'Road Ride'}</Text>
          <Text style={styles.introCopy}>
            Circuit records straight from your phone's GPS — distance, speed, climbing, and
            calories, no Strava round trip.
          </Text>

          {!supported && (
            <Notice
              tone="error"
              icon="alert-circle"
              title="GPS isn't available here"
              body="Recording needs the browser location API. Open Circuit on your phone to record a ride."
            />
          )}

          <Notice
            tone="warning"
            icon="phone-portrait-outline"
            title="The screen has to stay on"
            body="iOS suspends the app the moment the phone locks, and GPS stops with it. Circuit holds the screen awake — pocket the phone unlocked, and use Pocket Lock so fabric can't press anything."
          />

          <Notice
            tone="muted"
            icon="battery-half-outline"
            title="Expect the battery hit"
            body="Screen on plus high-accuracy GPS runs roughly 15-20% per hour. Fine for a 45 minute Zone 2; worth a top-up before anything longer."
          />

          <TouchableOpacity
            style={styles.startButton}
            onPress={handleStart}
            activeOpacity={0.85}
            disabled={!supported}
          >
            <LinearGradient
              colors={colors.gradientSuccess}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.startGradient, !supported && styles.startDisabled]}
            >
              <Ionicons name="bicycle" size={30} color={colors.text} />
              <Text style={styles.startText}>Start Ride</Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.introFootnote}>
            Your location never leaves the phone. Circuit stores the track locally and draws the
            route itself — there's no map service in the loop.
          </Text>
        </ScrollView>
      </View>
    );
  }

  // ─── Post-ride summary ────────────────────────────────────────────────────
  if (status === 'finished') {
    // The map sits flush in the scroll body now, so it only loses the page gutter.
    const traceWidth = width - spacing.lg * 2;
    return (
      <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
        <ScreenHeader title="Ride Complete" />
        <ScrollView contentContainerStyle={styles.summaryBody} showsVerticalScrollIndicator={false}>
          <View style={styles.heroStat}>
            <Text style={styles.heroValue}>{formatDistance(stats.distanceMeters, units)}</Text>
            <Text style={styles.heroUnit}>{distanceUnit(units).toUpperCase()}</Text>
          </View>

          {points.length > 1 && (
            <RouteMap points={points} width={traceWidth} height={traceWidth * 0.68} />
          )}

          <View style={styles.summaryGrid}>
            <SummaryTile label="Moving" value={formatRideClock(stats.movingSeconds)} />
            <SummaryTile label="Elapsed" value={formatRideClock(stats.elapsedSeconds)} />
            <SummaryTile
              label={`Avg ${speedUnit(units)}`}
              value={formatSpeed(stats.avgSpeedMps, units)}
            />
            <SummaryTile
              label={`Max ${speedUnit(units)}`}
              value={formatSpeed(stats.maxSpeedMps, units)}
            />
            <SummaryTile
              label={`Climb ${elevationUnit(units)}`}
              value={formatElevation(stats.elevationGainMeters, units)}
            />
            <SummaryTile label="Calories" value={Math.round(stats.kcal).toLocaleString('en-US')} />
          </View>

          <View style={styles.energyNote}>
            <Ionicons name="flash-outline" size={14} color={colors.textMuted} />
            <Text style={styles.energyNoteText}>
              {Math.round(stats.workKJ).toLocaleString('en-US')} kJ of work, estimated from speed,
              grade, and your weight. No power meter, so treat it as a good approximation.
            </Text>
          </View>

          {missedMinutes >= 1 && (
            <Notice
              tone="warning"
              icon="cloud-offline-outline"
              title={`${Math.round(missedMinutes)} min not recorded`}
              body="GPS went quiet for a stretch — usually the screen locking. That distance isn't counted, so the totals are on the low side."
            />
          )}

          <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.85}>
            <LinearGradient
              colors={colors.gradientPrimary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.saveGradient}
            >
              <Ionicons name="checkmark-circle" size={22} color={colors.text} />
              <Text style={styles.saveText}>Save to History</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.discardButton} onPress={handleDiscard} activeOpacity={0.7}>
            <Text style={styles.discardText}>Discard Ride</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ─── Live recording ───────────────────────────────────────────────────────
  const isPaused = status === 'paused';

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.liveHeader}>
        <SignalPill signal={signal} paused={isPaused} />
        <TouchableOpacity onPress={handleExit} hitSlop={12}>
          <Ionicons name="close" size={24} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.liveBody, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.clock}>{formatRideClock(stats.elapsedSeconds)}</Text>
        <Text style={styles.clockLabel}>{isPaused ? 'Paused' : 'Elapsed'}</Text>

        <View style={styles.heroStat}>
          <Text style={styles.heroValue}>{formatDistance(stats.distanceMeters, units)}</Text>
          <Text style={styles.heroUnit}>{distanceUnit(units).toUpperCase()}</Text>
        </View>

        <View style={styles.liveGrid}>
          <LiveTile
            label={speedUnit(units)}
            value={formatSpeed(stats.currentSpeedMps, units)}
            caption="Now"
          />
          <LiveTile
            label={speedUnit(units)}
            value={formatSpeed(stats.avgSpeedMps, units)}
            caption="Average"
          />
          <LiveTile
            label={elevationUnit(units)}
            value={formatElevation(stats.elevationGainMeters, units)}
            caption="Climbed"
          />
          <LiveTile
            label="kcal"
            value={Math.round(stats.kcal).toLocaleString('en-US')}
            caption="Burned"
          />
        </View>

        {error === 'permission-denied' && (
          <Notice
            tone="error"
            icon="location-outline"
            title="Location permission denied"
            body="Allow location for Circuit in Settings › Safari › Location, then start the ride again."
          />
        )}
        {error === 'position-unavailable' && (
          <Notice
            tone="warning"
            icon="warning-outline"
            title="No position fix"
            body="The phone can't see enough satellites. Under trees or between buildings this usually clears in a minute."
          />
        )}
        {wakeLockLost && (
          <Notice
            tone="warning"
            icon="eye-off-outline"
            title="Screen may sleep"
            body="Circuit couldn't hold the screen awake. If the phone locks, recording stops until you wake it."
          />
        )}
        {missedMinutes >= 1 && (
          <Notice
            tone="warning"
            icon="cloud-offline-outline"
            title={`${Math.round(missedMinutes)} min missed`}
            body="GPS dropped out for a while — that distance isn't in your totals."
          />
        )}

        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.controlButton, styles.pauseButton]}
            onPress={isPaused ? resume : pause}
            activeOpacity={0.8}
          >
            <Ionicons name={isPaused ? 'play' : 'pause'} size={22} color={colors.text} />
            <Text style={styles.controlText}>{isPaused ? 'Resume' : 'Pause'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, styles.finishButton]}
            onPress={handleFinish}
            activeOpacity={0.8}
          >
            <Ionicons name="flag" size={20} color={colors.text} />
            <Text style={styles.controlText}>Finish</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.lockButton}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setLocked(true);
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="lock-closed-outline" size={18} color={colors.primaryLight} />
          <Text style={styles.lockButtonText}>Pocket Lock</Text>
        </TouchableOpacity>

        <Text style={styles.keepAwakeNote}>
          Keep the screen on. Locking the phone stops the recording.
        </Text>
      </ScrollView>
    </View>
  );
}

// ─── Locked screen ──────────────────────────────────────────────────────────
// Deliberately near-black and nearly empty: it swallows every touch so denim
// can't pause the ride, and an OLED panel showing mostly black costs far less
// battery over 45 minutes than the full stats view.

interface LockedOverlayProps {
  distance: string;
  distanceUnit: string;
  clock: string;
  onUnlock: () => void;
}

function LockedOverlay({ distance, distanceUnit: unit, clock, onUnlock }: LockedOverlayProps) {
  const [progress, setProgress] = useState(0);
  const holdRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearHold = useCallback(() => {
    if (holdRef.current) {
      clearInterval(holdRef.current);
      holdRef.current = null;
    }
    setProgress(0);
  }, []);

  useEffect(() => clearHold, [clearHold]);

  const startHold = useCallback(() => {
    clearHold();
    const startedAt = Date.now();
    holdRef.current = setInterval(() => {
      const ratio = Math.min(1, (Date.now() - startedAt) / UNLOCK_HOLD_MS);
      setProgress(ratio);
      if (ratio >= 1) {
        clearHold();
        onUnlock();
      }
    }, 50);
  }, [clearHold, onUnlock]);

  return (
    <View style={styles.lockedContainer}>
      <View style={styles.lockedStats}>
        <Text style={styles.lockedDistance}>
          {distance}
          <Text style={styles.lockedUnit}> {unit}</Text>
        </Text>
        <Text style={styles.lockedClock}>{clock}</Text>
      </View>

      <TouchableOpacity
        style={styles.unlockPad}
        onPressIn={startHold}
        onPressOut={clearHold}
        activeOpacity={1}
      >
        <Ionicons name="lock-closed" size={22} color={colors.textMuted} />
        <Text style={styles.unlockText}>Hold to unlock</Text>
        <View style={styles.unlockTrack}>
          <View style={[styles.unlockFill, { width: `${progress * 100}%` }]} />
        </View>
      </TouchableOpacity>
    </View>
  );
}

// ─── Small presentational pieces ────────────────────────────────────────────

function ScreenHeader({ title, onClose }: { title: string; onClose?: () => void }) {
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>{title}</Text>
      {onClose && (
        <TouchableOpacity onPress={onClose} hitSlop={12}>
          <Ionicons name="close" size={24} color={colors.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
}

function SignalPill({ signal, paused }: { signal: string; paused: boolean }) {
  const map: Record<string, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> =
    {
      good: { label: 'GPS Locked', color: colors.success, icon: 'navigate' },
      weak: { label: 'Weak GPS', color: colors.warning, icon: 'navigate-outline' },
      acquiring: { label: 'Finding GPS', color: colors.primaryLight, icon: 'navigate-outline' },
      none: { label: 'No Signal', color: colors.error, icon: 'navigate-circle-outline' },
    };
  const state = paused ? { label: 'Paused', color: colors.warning, icon: 'pause' as const } : map[signal] ?? map.none;

  return (
    <View style={[styles.signalPill, { backgroundColor: state.color + '1F' }]}>
      <Ionicons name={state.icon} size={13} color={state.color} />
      <Text style={[styles.signalText, { color: state.color }]}>{state.label}</Text>
    </View>
  );
}

function LiveTile({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <View style={styles.liveTile}>
      <Text style={styles.liveTileValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.liveTileLabel}>{label}</Text>
      <Text style={styles.liveTileCaption}>{caption}</Text>
    </View>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function Notice({
  tone,
  icon,
  title,
  body,
}: {
  tone: 'warning' | 'error' | 'muted';
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}) {
  const tint =
    tone === 'error' ? colors.error : tone === 'warning' ? colors.warning : colors.textSecondary;
  return (
    <View style={[styles.notice, { borderColor: tint + '3A', backgroundColor: tint + '12' }]}>
      <Ionicons name={icon} size={17} color={tint} style={styles.noticeIcon} />
      <View style={styles.noticeCopy}>
        <Text style={[styles.noticeTitle, { color: tint }]}>{title}</Text>
        <Text style={styles.noticeBody}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    fontFamily: fonts.displayBlack,
    fontSize: 28,
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },

  // Intro
  introBody: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  introName: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typography.xl,
    color: colors.primaryLight,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  introCopy: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    lineHeight: 21,
  },
  startButton: {
    marginTop: spacing.sm,
    borderRadius: borderRadius.full,
    ...shadows.glowSuccess,
  },
  startGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md + 4,
    borderRadius: borderRadius.full,
  },
  startDisabled: {
    opacity: 0.45,
  },
  startText: {
    fontFamily: fonts.displayBlack,
    fontSize: 24,
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  introFootnote: {
    fontSize: typography.xs,
    color: colors.textMuted,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: spacing.xs,
  },

  // Live
  liveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  liveBody: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  clock: {
    fontFamily: fonts.display,
    fontSize: 46,
    color: colors.text,
    textAlign: 'center',
    letterSpacing: 1,
  },
  clockLabel: {
    fontFamily: fonts.displayMedium,
    fontSize: typography.xs,
    color: colors.textMuted,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: -6,
  },
  heroStat: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: spacing.sm,
    marginVertical: spacing.md,
  },
  heroValue: {
    fontFamily: fonts.displayBlack,
    fontSize: 76,
    color: colors.text,
    letterSpacing: 1,
  },
  heroUnit: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typography.xl,
    color: colors.primaryLight,
    letterSpacing: 2,
  },
  liveGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  liveTile: {
    flexGrow: 1,
    flexBasis: '46%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  liveTileValue: {
    fontFamily: fonts.display,
    fontSize: 34,
    color: colors.text,
  },
  liveTileLabel: {
    fontFamily: fonts.displayMedium,
    fontSize: typography.xs,
    color: colors.primaryLight,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  liveTileCaption: {
    fontSize: 10,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
  },
  controls: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  controlButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
  },
  pauseButton: {
    backgroundColor: colors.surfaceHighlight,
  },
  finishButton: {
    backgroundColor: colors.error,
  },
  controlText: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typography.base,
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  lockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.primary + '4A',
    backgroundColor: colors.primary + '14',
  },
  lockButtonText: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typography.sm,
    color: colors.primaryLight,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  keepAwakeNote: {
    fontSize: typography.xs,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 17,
  },

  // Locked
  lockedContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'space-between',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  lockedStats: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedDistance: {
    fontFamily: fonts.displayBlack,
    fontSize: 64,
    color: colors.textSecondary,
  },
  lockedUnit: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typography.xl,
    color: colors.textMuted,
  },
  lockedClock: {
    fontFamily: fonts.display,
    fontSize: 30,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  unlockPad: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  unlockText: {
    fontFamily: fonts.displayMedium,
    fontSize: typography.sm,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  unlockTrack: {
    width: 180,
    height: 4,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceLight,
    overflow: 'hidden',
  },
  unlockFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },

  // Summary
  summaryBody: {
    padding: spacing.lg,
    paddingTop: 0,
    gap: spacing.md,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  summaryTile: {
    flexGrow: 1,
    flexBasis: '30%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
  },
  summaryValue: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.text,
  },
  summaryLabel: {
    fontSize: 10,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
  },
  energyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  energyNoteText: {
    flex: 1,
    fontSize: typography.xs,
    color: colors.textMuted,
    lineHeight: 17,
  },
  saveButton: {
    borderRadius: borderRadius.full,
    ...shadows.glowPrimary,
  },
  saveGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
  },
  saveText: {
    fontFamily: fonts.displayBlack,
    fontSize: typography.xl,
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 1.6,
  },
  discardButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  discardText: {
    fontFamily: fonts.displayMedium,
    fontSize: typography.sm,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },

  // Shared
  signalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
  },
  signalText: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typography.xs,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  noticeIcon: {
    marginTop: 1,
  },
  noticeCopy: {
    flex: 1,
    gap: 3,
  },
  noticeTitle: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typography.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  noticeBody: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    lineHeight: 17,
  },
});
