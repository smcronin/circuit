import React, { useMemo, useCallback, useState } from 'react';
import { View, Text, StyleSheet, SectionList, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, typography, borderRadius } from '@/theme';
import { useWorkoutStore, useHistoryStore } from '@/stores';
import { flattenWorkout, formatDuration } from '@/utils';
import {
  PROGRAMMED_WORKOUTS,
  PROGRAM_START_DATE,
  PROGRAM_END_DATE,
  getLocalDateKey,
  formatProgramDateLabel,
} from '@/data/programmedWorkouts';
import type { ProgrammedWorkout } from '@/data/programmedWorkouts';
import type { WorkoutSession } from '@/types/workout';

interface DateSection {
  date: string;
  dateLabel: string;
  relativeLabel: string | null;
  isPast: boolean;
  data: ProgrammedWorkout[];
}

function completedSessionDateKey(session: WorkoutSession): string | null {
  if (!session.completedAt) return null;
  const completedAt = new Date(session.completedAt);
  if (Number.isNaN(completedAt.getTime())) return null;
  return getLocalDateKey(completedAt);
}

function relativeLabelFor(dateKey: string, todayKey: string, tomorrowKey: string): string | null {
  if (dateKey === todayKey) return 'Today';
  if (dateKey === tomorrowKey) return 'Tomorrow';
  return null;
}

export default function ProgramsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setCurrentWorkout, setFlattenedWorkout } = useWorkoutStore();
  const historySessions = useHistoryStore((state) => state.history.sessions);
  const [showPast, setShowPast] = useState(false);

  const todayKey = getLocalDateKey();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = getLocalDateKey(tomorrow);

  const completedIds = useMemo(() => {
    const ids = new Set<string>();
    PROGRAMMED_WORKOUTS.forEach((pw) => {
      const done = historySessions.some((session) => {
        if (session.status !== 'completed') return false;
        if (completedSessionDateKey(session) !== pw.date) return false;
        return (
          session.workoutId === pw.workout.id ||
          session.workout.id === pw.workout.id ||
          session.workout.name === pw.workout.name
        );
      });
      if (done) ids.add(pw.id);
    });
    return ids;
  }, [historySessions]);

  const { upcoming, past } = useMemo(() => {
    const byDate = new Map<string, ProgrammedWorkout[]>();
    PROGRAMMED_WORKOUTS.forEach((pw) => {
      const list = byDate.get(pw.date) || [];
      list.push(pw);
      byDate.set(pw.date, list);
    });

    const upcomingSections: DateSection[] = [];
    const pastSections: DateSection[] = [];
    [...byDate.entries()].forEach(([date, data]) => {
      const section: DateSection = {
        date,
        dateLabel: formatProgramDateLabel(date),
        relativeLabel: relativeLabelFor(date, todayKey, tomorrowKey),
        isPast: date < todayKey,
        data,
      };
      (section.isPast ? pastSections : upcomingSections).push(section);
    });
    upcomingSections.sort((a, b) => a.date.localeCompare(b.date));
    // Most recent past days first, right below the toggle
    pastSections.sort((a, b) => b.date.localeCompare(a.date));
    return { upcoming: upcomingSections, past: pastSections };
  }, [todayKey, tomorrowKey]);

  const sections = showPast ? [...upcoming, ...past] : upcoming;

  const handleOpen = useCallback(
    (pw: ProgrammedWorkout) => {
      // Recorded activities skip the circuit timer entirely — there are no
      // intervals to run, just GPS to record.
      if (pw.workout.activityType) {
        router.push({ pathname: '/workout/ride', params: { programId: pw.id } });
        return;
      }
      setCurrentWorkout(pw.workout);
      setFlattenedWorkout(flattenWorkout(pw.workout));
      router.push('/workout/review');
    },
    [router, setCurrentWorkout, setFlattenedWorkout]
  );

  const renderItem = useCallback(
    ({ item }: { item: ProgrammedWorkout }) => {
      const isDone = completedIds.has(item.id);
      const isRide = Boolean(item.workout.activityType);
      return (
        <TouchableOpacity
          style={[styles.row, isDone && styles.rowDone, isRide && !isDone && styles.rowRide]}
          activeOpacity={0.75}
          onPress={() => handleOpen(item)}
        >
          <View style={styles.rowTop}>
            <View
              style={[
                styles.slotPill,
                isDone && styles.slotPillDone,
                isRide && !isDone && styles.slotPillRide,
              ]}
            >
              <Text
                style={[
                  styles.slotText,
                  isDone && styles.slotTextDone,
                  isRide && !isDone && styles.slotTextRide,
                ]}
              >
                {item.slot}
              </Text>
            </View>
            <View style={styles.rowMeta}>
              <Ionicons name="time-outline" size={13} color={colors.textMuted} />
              <Text style={styles.rowMetaText}>{formatDuration(item.workout.actualDuration)}</Text>
            </View>
            {isDone ? (
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            ) : (
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            )}
          </View>
          <Text style={[styles.rowName, isDone && styles.rowNameDone]} numberOfLines={2}>
            {item.workout.name}
          </Text>
          <View style={styles.coachRow}>
            <Ionicons name="sparkles-outline" size={12} color={colors.accent} />
            <Text style={styles.coachText} numberOfLines={2}>
              {item.coachNotes}
            </Text>
          </View>
          {isRide && !isDone && (
            <View style={styles.recordCta}>
              <Ionicons name="bicycle" size={18} color={colors.background} />
              <Text style={styles.recordCtaText}>Record Ride</Text>
            </View>
          )}
        </TouchableOpacity>
      );
    },
    [completedIds, handleOpen]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: DateSection }) => (
      <View style={styles.dateHeader}>
        <Text style={[styles.dateText, section.isPast && styles.dateTextPast]}>
          {section.dateLabel}
        </Text>
        {section.relativeLabel && (
          <View
            style={[
              styles.datePill,
              section.relativeLabel === 'Today' ? styles.todayPill : styles.tomorrowPill,
            ]}
          >
            <Text
              style={[
                styles.datePillText,
                section.relativeLabel === 'Today' ? styles.todayPillText : styles.tomorrowPillText,
              ]}
            >
              {section.relativeLabel}
            </Text>
          </View>
        )}
        <View style={styles.dateRule} />
      </View>
    ),
    []
  );

  const ListHeader = (
    <View>
      <Text style={styles.title}>Programs</Text>
      <Text style={styles.subtitle}>
        {formatProgramDateLabel(PROGRAM_START_DATE).toUpperCase()} —{' '}
        {formatProgramDateLabel(PROGRAM_END_DATE).toUpperCase()} · SCHEDULED BLOCK
      </Text>
    </View>
  );

  const ListFooter = (
    <View style={styles.footerArea}>
      {past.length > 0 && (
        <TouchableOpacity
          style={styles.pastToggle}
          onPress={() => setShowPast(!showPast)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={showPast ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.primaryLight}
          />
          <Text style={styles.pastToggleText}>
            {showPast ? 'Hide past days' : `Show past days (${past.length})`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const ListEmpty = (
    <View style={styles.empty}>
      <Ionicons name="calendar-outline" size={56} color={colors.surfaceHighlight} />
      <Text style={styles.emptyTitle}>Nothing scheduled</Text>
      <Text style={styles.emptyText}>
        The current block has wrapped. Check back when the next program drops.
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  title: {
    fontFamily: fonts.displayBlack,
    fontSize: 30,
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: typography.semibold,
    color: colors.primaryLight,
    letterSpacing: 1.5,
    marginTop: 4,
    marginBottom: spacing.md,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  dateText: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typography.lg,
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  dateTextPast: {
    color: colors.textMuted,
  },
  datePill: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  todayPill: {
    backgroundColor: colors.success + '26',
  },
  tomorrowPill: {
    backgroundColor: colors.primary + '26',
  },
  datePillText: {
    fontSize: typography.xs,
    fontWeight: typography.semibold,
  },
  todayPillText: {
    color: colors.successLight,
  },
  tomorrowPillText: {
    color: colors.primaryLight,
  },
  dateRule: {
    flex: 1,
    height: 1,
    backgroundColor: colors.hairline,
  },
  row: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowDone: {
    opacity: 0.62,
    borderColor: colors.success + '3A',
  },
  rowRide: {
    borderColor: colors.success + '4A',
  },
  slotPillRide: {
    backgroundColor: colors.success + '26',
  },
  slotTextRide: {
    color: colors.successLight,
  },
  recordCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.success,
  },
  recordCtaText: {
    fontFamily: fonts.displayBlack,
    fontSize: typography.base,
    color: colors.background,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  slotPill: {
    backgroundColor: colors.primary + '26',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
  },
  slotPillDone: {
    backgroundColor: colors.success + '22',
  },
  slotText: {
    fontSize: typography.xs,
    fontWeight: typography.semibold,
    color: colors.primaryLight,
  },
  slotTextDone: {
    color: colors.successLight,
  },
  rowMeta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rowMetaText: {
    fontSize: typography.xs,
    color: colors.textMuted,
    fontWeight: typography.medium,
  },
  rowName: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typography.lg,
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  rowNameDone: {
    color: colors.textSecondary,
  },
  coachRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  coachText: {
    flex: 1,
    fontSize: typography.xs,
    color: colors.textMuted,
    lineHeight: 17,
  },
  footerArea: {
    marginTop: spacing.lg,
  },
  pastToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
  },
  pastToggleText: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typography.sm,
    color: colors.primaryLight,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typography.xl,
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: spacing.sm,
  },
  emptyText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
