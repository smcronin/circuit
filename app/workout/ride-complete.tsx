import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, fonts, spacing, typography, borderRadius, shadows } from '@/theme';
import { Chip, Input, RpeSelector } from '@/components/common';
import { RouteMap } from '@/components/ride';
import { StatTile } from '@/components/ride/StatTile';
import { useRideStore } from '@/stores/useRideStore';
import { useHistoryStore, useUserStore } from '@/stores';
import { useRideUnits } from '@/hooks/useRideUnits';
import { PROGRAMMED_WORKOUTS } from '@/data/programmedWorkouts';
import { ACTIVITY_META, summaryActivity } from '@/utils/activities';
import {
  createRideWorkoutSession,
  resolveRecordedCalories,
} from '@/utils/createRideWorkoutSession';
import { clearRideDraft } from '@/utils/rideDraft';
import { confirmAction } from '@/utils/confirm';
import { generateManualWorkoutMetadata } from '@/services/openrouter/client';
import type { ManualWorkoutMetadataResponse } from '@/types/llm';
import type { RideSummary } from '@/types/ride';
import {
  formatDistance,
  formatSpeed,
  formatElevation,
  formatRideClock,
  distanceUnit,
  speedUnit,
  elevationUnit,
  type RideUnits,
} from '@/utils/rideFormat';

/** Prompt input for the metadata route — the same one manual logging uses. */
function describeRecording(
  summary: RideSummary,
  units: RideUnits
): { title: string; description: string } {
  const meta = ACTIVITY_META[summaryActivity(summary)];
  const { stats } = summary;
  const d = `${formatDistance(stats.distanceMeters, units)} ${distanceUnit(units)}`;
  const v = `${formatSpeed(stats.avgSpeedMps, units)} ${speedUnit(units)} average`;
  const climb = `${formatElevation(stats.elevationGainMeters, units)} ${elevationUnit(units)} of climbing`;
  const moving = Math.round(stats.movingSeconds / 60);
  return {
    title: `GPS-Recorded ${meta.label}`,
    description:
      `A GPS-recorded outdoor ${meta.label.toLowerCase()}: ${d} in ${moving} min of moving time, ${v}, ${climb}. ` +
      `Sensor-based calorie estimate from ${summary.calorieModel === 'physics' ? 'a cycling power model' : 'MET tables'}: ` +
      `${Math.round(stats.kcal)} kcal — treat that as the anchor for your estimate.`,
  };
}

type MetadataPhase = 'loading' | 'ready' | 'fallback';

export default function RideCompleteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const profile = useUserStore((s) => s.profile);
  const addSession = useHistoryStore((s) => s.addSession);
  const units = useRideUnits();

  // Captured once at mount, never recomputed: the screen must stay stable
  // while the ride store is reset underneath it during save/discard.
  // (Recomputing from a store subscription here is what caused the
  // "No finished workout to save" flash on Save.)
  const [captured] = useState(() => {
    const store = useRideStore.getState();
    if (store.status !== 'finished') return null;
    return { summary: store.buildSummary(), programId: store.programId };
  });
  const summary = captured?.summary ?? null;

  const [rpe, setRpe] = useState<number | undefined>(undefined);
  const [notes, setNotes] = useState('');
  const [metadata, setMetadata] = useState<ManualWorkoutMetadataResponse | null>(null);
  const [metadataPhase, setMetadataPhase] = useState<MetadataPhase>('loading');
  const savedRef = useRef(false);

  const sourceWorkout = useMemo(() => {
    if (!captured?.programId) return undefined;
    return PROGRAMMED_WORKOUTS.find((pw) => pw.id === captured.programId)?.workout;
  }, [captured?.programId]);

  const activityMeta = ACTIVITY_META[summaryActivity(summary ?? {})];

  const missedMinutes = useMemo(
    () => (summary?.gaps ?? []).reduce((sum, g) => sum + (g.endedAt - g.startedAt), 0) / 60000,
    [summary?.gaps]
  );

  // ─── Metadata generation, triggered by the Finish click that got us here ──
  useEffect(() => {
    if (!summary) return;
    let cancelled = false;

    (async () => {
      try {
        const { title, description } = describeRecording(summary, units);
        const result = await generateManualWorkoutMetadata({
          title,
          description,
          durationMinutes: Math.max(1, Math.round(summary.stats.elapsedSeconds / 60)),
          userWeight: profile?.weight,
          userAge: profile?.age,
        });
        if (!cancelled) {
          setMetadata(result);
          setMetadataPhase('ready');
        }
      } catch (error) {
        console.error('Recorded workout metadata generation failed:', error);
        // The workout still saves — sensor stats carry it.
        if (!cancelled) setMetadataPhase('fallback');
      }
    })();

    return () => {
      cancelled = true;
    };
    // `summary` is captured once at mount, so this runs exactly once; units and
    // profile deps are intentionally omitted so a mid-screen profile change
    // can't re-bill the LLM.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary]);

  const handleSave = useCallback(() => {
    if (!summary || savedRef.current) return;
    savedRef.current = true;

    try {
      const session = createRideWorkoutSession({
        summary,
        sourceWorkout,
        metadata,
        feedback:
          rpe !== undefined || notes.trim()
            ? { rpe, notes: notes.trim() || undefined }
            : undefined,
      });
      addSession(session);
      void clearRideDraft();
      router.replace('/(tabs)/history');
      // Safe now: this screen renders from the mount-captured summary, so
      // resetting the store can't blank it mid-transition.
      useRideStore.getState().reset();
    } catch (error) {
      // Let the user retry rather than latching the button shut on a failure.
      savedRef.current = false;
      console.error('Saving recorded workout failed:', error);
    }
  }, [summary, sourceWorkout, metadata, rpe, notes, addSession, router]);

  const handleDiscard = useCallback(async () => {
    const discard = await confirmAction({
      title: 'Discard this workout?',
      message: 'The recorded GPS data will be deleted for good.',
      confirmLabel: 'Discard',
      cancelLabel: 'Keep',
      destructive: true,
    });
    if (!discard) return;
    void clearRideDraft();
    router.replace('/(tabs)');
    useRideStore.getState().reset();
  }, [router]);

  // Landed here without a finished recording (deep link, stale entry):
  // nothing to save, so offer the way home rather than an empty shell.
  if (!summary) {
    return (
      <View style={[styles.container, styles.emptyWrap, { paddingTop: insets.top }]}>
        <Ionicons name="bicycle-outline" size={48} color={colors.surfaceHighlight} />
        <Text style={styles.emptyText}>No finished workout to save.</Text>
        <TouchableOpacity onPress={() => router.replace('/(tabs)')} activeOpacity={0.8}>
          <Text style={styles.emptyLink}>Go Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { stats } = summary;
  const mapWidth = width - spacing.lg * 2;
  const effectiveCalories = resolveRecordedCalories(stats, metadata);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top + spacing.sm }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>{activityMeta.label} Complete</Text>

        <View style={styles.heroStat}>
          <Text style={styles.heroValue}>{formatDistance(stats.distanceMeters, units)}</Text>
          <Text style={styles.heroUnit}>{distanceUnit(units).toUpperCase()}</Text>
        </View>

        {summary.points.length > 1 && (
          <RouteMap points={summary.points} width={mapWidth} height={mapWidth * 0.68} />
        )}

        <View style={styles.grid}>
          <StatTile label="Moving" value={formatRideClock(stats.movingSeconds)} />
          <StatTile label="Elapsed" value={formatRideClock(stats.elapsedSeconds)} />
          <StatTile label={`Avg ${speedUnit(units)}`} value={formatSpeed(stats.avgSpeedMps, units)} />
          <StatTile label={`Max ${speedUnit(units)}`} value={formatSpeed(stats.maxSpeedMps, units)} />
          <StatTile
            label={`Climb ${elevationUnit(units)}`}
            value={formatElevation(stats.elevationGainMeters, units)}
          />
          <StatTile label="Calories" value={effectiveCalories.toLocaleString('en-US')} />
        </View>

        {missedMinutes >= 1 && (
          <View style={styles.gapNotice}>
            <Ionicons name="cloud-offline-outline" size={16} color={colors.warning} />
            <Text style={styles.gapNoticeText}>
              {Math.round(missedMinutes)} min not recorded — GPS dropped out, usually a locked
              screen. That distance isn't counted, so these totals are on the low side.
            </Text>
          </View>
        )}

        {/* ─── AI metadata ──────────────────────────────────────────────── */}
        <View style={styles.metaCard}>
          <View style={styles.metaHeader}>
            <Ionicons name="sparkles-outline" size={16} color={colors.accent} />
            <Text style={styles.metaTitle}>Workout Analysis</Text>
            {metadataPhase === 'loading' && (
              <ActivityIndicator size="small" color={colors.primaryLight} />
            )}
          </View>

          {metadataPhase === 'loading' && (
            <Text style={styles.metaPending}>
              Classifying focus areas, muscle groups, and calories…
            </Text>
          )}

          {metadataPhase === 'fallback' && (
            <Text style={styles.metaPending}>
              AI analysis unavailable — saving with sensor estimates and{' '}
              {activityMeta.label.toLowerCase()} defaults instead.
            </Text>
          )}

          {metadataPhase === 'ready' && metadata && (
            <View style={styles.metaBody}>
              <View style={styles.metaChips}>
                <Chip label={metadata.difficulty} size="sm" color={colors.accent} selected />
                {metadata.focusAreas.map((area) => (
                  <Chip key={area} label={area} size="sm" color={colors.primaryLight} selected />
                ))}
              </View>
              {metadata.muscleGroupsTargeted.length > 0 && (
                <Text style={styles.metaMuscles}>
                  {metadata.muscleGroupsTargeted.join(' · ')}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* ─── RPE + notes ──────────────────────────────────────────────── */}
        <View style={styles.feedbackCard}>
          <Text style={styles.feedbackTitle}>How hard was it?</Text>
          <RpeSelector value={rpe} onChange={setRpe} />
          <Input
            placeholder="Notes — route, legs, weather, anything worth remembering…"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />
        </View>

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

        {metadataPhase === 'loading' && (
          <Text style={styles.saveHint}>
            You can save now — the analysis just won't be attached.
          </Text>
        )}

        <TouchableOpacity style={styles.discardButton} onPress={handleDiscard} activeOpacity={0.7}>
          <Text style={styles.discardText}>Discard Workout</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  body: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  title: {
    fontFamily: fonts.displayBlack,
    fontSize: 28,
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  heroStat: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  heroValue: {
    fontFamily: fonts.displayBlack,
    fontSize: 64,
    color: colors.text,
  },
  heroUnit: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typography.xl,
    color: colors.primaryLight,
    letterSpacing: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  gapNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.warning + '3A',
    backgroundColor: colors.warning + '12',
  },
  gapNoticeText: {
    flex: 1,
    fontSize: typography.xs,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  metaCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  metaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaTitle: {
    flex: 1,
    fontFamily: fonts.displaySemiBold,
    fontSize: typography.sm,
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  metaPending: {
    fontSize: typography.xs,
    color: colors.textMuted,
    lineHeight: 17,
  },
  metaBody: {
    gap: spacing.sm,
  },
  metaChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  metaMuscles: {
    fontSize: typography.xs,
    color: colors.textMuted,
    textTransform: 'capitalize',
    lineHeight: 17,
  },
  feedbackCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  feedbackTitle: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typography.sm,
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
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
  saveHint: {
    fontSize: typography.xs,
    color: colors.textMuted,
    textAlign: 'center',
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
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  emptyText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  emptyLink: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typography.base,
    color: colors.primaryLight,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
});
