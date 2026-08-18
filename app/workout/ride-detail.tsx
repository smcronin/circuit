import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { colors, fonts, spacing, typography, borderRadius } from '@/theme';
import { useHistoryStore } from '@/stores';
import { RouteMap, StatTile } from '@/components/ride';
import { useRideUnits } from '@/hooks/useRideUnits';
import { ACTIVITY_META, summaryActivity } from '@/utils/activities';
import { formatDateFull } from '@/utils';
import {
  formatDistance,
  formatSpeed,
  formatElevation,
  formatRideClock,
  distanceUnit,
  speedUnit,
  elevationUnit,
} from '@/utils/rideFormat';

/** The recorded route and full stats for a past ride. */
export default function RideDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();

  const session = useHistoryStore((s) =>
    sessionId ? s.history.sessions.find((entry) => entry.id === sessionId) : undefined
  );
  const units = useRideUnits();

  const ride = session?.ride;
  const activityMeta = ACTIVITY_META[summaryActivity(ride ?? {})];

  const missedMinutes = useMemo(
    () => (ride?.gaps ?? []).reduce((sum, g) => sum + (g.endedAt - g.startedAt), 0) / 60000,
    [ride?.gaps]
  );

  if (!session || !ride) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
        <Header onClose={() => router.back()} title="Workout" />
        <View style={styles.empty}>
          <Ionicons name="navigate-outline" size={48} color={colors.surfaceHighlight} />
          <Text style={styles.emptyText}>This workout's GPS data is no longer available.</Text>
        </View>
      </View>
    );
  }

  const mapWidth = width - spacing.lg * 2;
  const { stats } = ride;

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <Header onClose={() => router.back()} title={activityMeta.label} />
      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.name}>{session.workout.name}</Text>
        <Text style={styles.date}>{formatDateFull(ride.startedAt)}</Text>

        <View style={styles.heroStat}>
          <Text style={styles.heroValue}>{formatDistance(stats.distanceMeters, units)}</Text>
          <Text style={styles.heroUnit}>{distanceUnit(units).toUpperCase()}</Text>
        </View>

        {ride.points.length > 1 && (
          <RouteMap points={ride.points} width={mapWidth} height={mapWidth * 0.85} />
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
          {/* The saved figure, not raw stats.kcal — the LLM-refined value the
              history card and totals use. Two screens, one number. */}
          <StatTile
            label="Calories"
            value={Math.round(session.estimatedCaloriesBurned).toLocaleString('en-US')}
          />
        </View>

        {/* Wheel-work is a bike concept; foot activities record workKJ = 0. */}
        {stats.workKJ >= 1 && (
          <View style={styles.note}>
            <Ionicons name="flash-outline" size={14} color={colors.textMuted} />
            <Text style={styles.noteText}>
              {Math.round(stats.workKJ).toLocaleString('en-US')} kJ of work, estimated from speed,
              grade, and your weight.
            </Text>
          </View>
        )}

        {missedMinutes >= 1 && (
          <View style={styles.warning}>
            <Ionicons name="cloud-offline-outline" size={16} color={colors.warning} />
            <Text style={styles.warningText}>
              {Math.round(missedMinutes)} min went unrecorded — GPS dropped out, usually a locked
              screen. That distance isn't counted here.
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.editButton}
          onPress={() => router.push(`/workout/edit-feedback?sessionId=${session.id}`)}
          activeOpacity={0.7}
        >
          <Ionicons name="pencil-outline" size={15} color={colors.primary} />
          <Text style={styles.editText}>
            {session.feedback?.rpe || session.feedback?.notes ? 'Edit RPE/Notes' : 'Add RPE/Notes'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function Header({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>{title}</Text>
      <TouchableOpacity onPress={onClose} hitSlop={12}>
        <Ionicons name="close" size={24} color={colors.textMuted} />
      </TouchableOpacity>
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
  body: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  name: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typography.xl,
    color: colors.primaryLight,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  date: {
    fontSize: typography.xs,
    color: colors.textMuted,
    marginTop: -spacing.sm,
  },
  heroStat: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  heroValue: {
    fontFamily: fonts.displayBlack,
    fontSize: 68,
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
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  noteText: {
    flex: 1,
    fontSize: typography.xs,
    color: colors.textMuted,
    lineHeight: 17,
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.warning + '3A',
    backgroundColor: colors.warning + '12',
  },
  warningText: {
    flex: 1,
    fontSize: typography.xs,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  editButton: {
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
  editText: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typography.sm,
    color: colors.primaryLight,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  emptyText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
