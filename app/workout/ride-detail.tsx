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
import { useHistoryStore, useUserStore } from '@/stores';
import { RouteMap } from '@/components/ride';
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
  const weightUnit = useUserStore((s) => s.profile?.weightUnit);
  const units = useMemo(() => ({ imperial: (weightUnit ?? 'lbs') !== 'kg' }), [weightUnit]);

  const ride = session?.ride;

  const missedMinutes = useMemo(
    () => (ride?.gaps ?? []).reduce((sum, g) => sum + (g.endedAt - g.startedAt), 0) / 60000,
    [ride?.gaps]
  );

  if (!session || !ride) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
        <Header onClose={() => router.back()} title="Ride" />
        <View style={styles.empty}>
          <Ionicons name="bicycle-outline" size={48} color={colors.surfaceHighlight} />
          <Text style={styles.emptyText}>This ride's GPS data is no longer available.</Text>
        </View>
      </View>
    );
  }

  const mapWidth = width - spacing.lg * 2;
  const { stats } = ride;

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <Header onClose={() => router.back()} title="Ride" />
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
          <Tile label="Moving" value={formatRideClock(stats.movingSeconds)} />
          <Tile label="Elapsed" value={formatRideClock(stats.elapsedSeconds)} />
          <Tile label={`Avg ${speedUnit(units)}`} value={formatSpeed(stats.avgSpeedMps, units)} />
          <Tile label={`Max ${speedUnit(units)}`} value={formatSpeed(stats.maxSpeedMps, units)} />
          <Tile
            label={`Climb ${elevationUnit(units)}`}
            value={formatElevation(stats.elevationGainMeters, units)}
          />
          <Tile label="Calories" value={Math.round(stats.kcal).toLocaleString('en-US')} />
        </View>

        <View style={styles.note}>
          <Ionicons name="flash-outline" size={14} color={colors.textMuted} />
          <Text style={styles.noteText}>
            {Math.round(stats.workKJ).toLocaleString('en-US')} kJ of work, estimated from speed,
            grade, and your weight.
          </Text>
        </View>

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

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.tileLabel}>{label}</Text>
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
  tile: {
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
  tileValue: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.text,
  },
  tileLabel: {
    fontSize: 10,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
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
