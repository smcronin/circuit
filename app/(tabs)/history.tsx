import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, Chip } from '@/components/common';
import { ManualWorkoutModal } from '@/components/history';
import { colors, fonts, spacing, typography, borderRadius } from '@/theme';
import { useHistoryStore, useWorkoutStore } from '@/stores';
import { WorkoutSession } from '@/types/workout';
import { formatDate, formatDuration, flattenWorkout, formatCompactNumber } from '@/utils';
import { DIFFICULTY_COLORS } from '@/utils/constants';

function getRpeColor(value: number): string {
  if (value <= 3) return colors.success;
  if (value <= 6) return colors.warning;
  if (value <= 8) return colors.accent;
  return colors.error;
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const history = useHistoryStore((state) => state.history);
  const removeSession = useHistoryStore((state) => state.removeSession);
  const { setCurrentWorkout, setFlattenedWorkout } = useWorkoutStore();
  const [showManualModal, setShowManualModal] = useState(false);

  const handleReplay = (session: WorkoutSession) => {
    const workout = session.workout;
    const flattened = flattenWorkout(workout);
    setCurrentWorkout(workout);
    setFlattenedWorkout(flattened);
    router.push('/workout/review');
  };

  const handleEditFeedback = (sessionId: string) => {
    router.push(`/workout/edit-feedback?sessionId=${sessionId}`);
  };

  const handleDeleteSession = (session: WorkoutSession) => {
    Alert.alert(
      'Delete Workout',
      `Are you sure you want to delete "${session.workout.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => removeSession(session.id),
        },
      ]
    );
  };

  // Compute stats at runtime from sessions (source of truth)
  const stats = useMemo(() => {
    const sessions = history.sessions;
    const totalWorkouts = sessions.filter((s) => s.status === 'completed').length;
    const totalMinutes = sessions.reduce(
      (sum, s) => sum + Math.round(s.actualDurationWorked / 60),
      0
    );
    const totalCalories = sessions.reduce(
      (sum, s) => sum + s.estimatedCaloriesBurned,
      0
    );
    return {
      totalWorkouts,
      totalMinutes,
      totalCalories,
      streak: history.streak.current,
    };
  }, [history.sessions, history.streak.current]);

  const renderSession = ({ item }: { item: WorkoutSession }) => {
    const isCompleted = item.status === 'completed';
    const isManual = item.workout.isManual === true;
    const difficultyColor = DIFFICULTY_COLORS[item.workout.difficulty];
    const hasNotes = item.feedback?.notes && item.feedback.notes.length > 0;

    return (
      <Card style={styles.sessionCard}>
        <View style={styles.sessionHeader}>
          <View style={styles.sessionTitle}>
            <View style={styles.titleRow}>
              <Text style={styles.workoutName}>{item.workout.name}</Text>
              {isManual && (
                <View style={styles.manualBadge}>
                  <Text style={styles.manualBadgeText}>Manual</Text>
                </View>
              )}
            </View>
            <View style={styles.sessionMeta}>
              <Text style={styles.sessionDate}>
                {formatDate(item.completedAt || item.startedAt || item.workout.createdAt)}
              </Text>
              {!isCompleted && (
                <View style={styles.incompleteBadge}>
                  <Text style={styles.incompleteText}>
                    {item.percentComplete}% complete
                  </Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.headerActions}>
            {!isManual && (
              <TouchableOpacity
                style={styles.replayButton}
                onPress={() => handleReplay(item)}
                activeOpacity={0.7}
              >
                <Ionicons name="refresh" size={18} color={colors.primary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeleteSession(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={18} color={colors.error} />
            </TouchableOpacity>
            <View style={[styles.statusIcon, isCompleted ? styles.statusComplete : styles.statusIncomplete]}>
              <Ionicons
                name={isCompleted ? 'checkmark' : 'pause'}
                size={16}
                color={isCompleted ? colors.success : colors.warning}
              />
            </View>
          </View>
        </View>

        <View style={styles.sessionStats}>
          <View style={styles.stat}>
            <Ionicons name="time-outline" size={16} color={colors.textMuted} />
            <Text style={styles.statValue}>
              {formatDuration(item.actualDurationWorked)}
            </Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="flame-outline" size={16} color={colors.textMuted} />
            <Text style={styles.statValue}>{formatCompactNumber(item.estimatedCaloriesBurned)} cal</Text>
          </View>
          <Chip
            label={item.workout.difficulty}
            size="sm"
            color={difficultyColor}
            selected
          />
          {item.feedback?.rpe && (
            <View
              style={[
                styles.rpeBadge,
                { backgroundColor: getRpeColor(item.feedback.rpe) + '20' },
              ]}
            >
              <Text
                style={[styles.rpeText, { color: getRpeColor(item.feedback.rpe) }]}
              >
                RPE {item.feedback.rpe}
              </Text>
            </View>
          )}
        </View>

        {item.workout.focusAreas.length > 0 && (
          <View style={styles.focusAreas}>
            {item.workout.focusAreas.slice(0, 3).map((area, idx) => (
              <Text key={idx} style={styles.focusArea}>
                {area}
              </Text>
            ))}
          </View>
        )}

        {/* Notes preview */}
        {hasNotes && (
          <View style={styles.notesPreview}>
            <Ionicons name="chatbubble-outline" size={14} color={colors.textMuted} />
            <Text style={styles.notesText} numberOfLines={2}>
              {item.feedback?.notes}
            </Text>
          </View>
        )}

        {/* Edit feedback button */}
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => handleEditFeedback(item.id)}
          activeOpacity={0.7}
        >
          <Ionicons name="pencil-outline" size={14} color={colors.primary} />
          <Text style={styles.editButtonText}>
            {item.feedback?.rpe || hasNotes ? 'Edit RPE/Notes' : 'Add RPE/Notes'}
          </Text>
        </TouchableOpacity>
      </Card>
    );
  };

  const ListHeader = () => (
    <View>
      <View style={styles.headerRow}>
        <Text style={styles.title}>History</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowManualModal(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="add-circle" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statCardValue}>{formatCompactNumber(stats.totalWorkouts)}</Text>
          <Text style={styles.statCardLabel} numberOfLines={1}>WODs</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statCardValue}>{formatCompactNumber(stats.totalMinutes)}</Text>
          <Text style={styles.statCardLabel} numberOfLines={1}>Mins</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statCardValue}>{formatCompactNumber(stats.totalCalories)}</Text>
          <Text style={styles.statCardLabel} numberOfLines={1}>Cals</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statCardValue}>{stats.streak}</Text>
          <Text style={styles.statCardLabel} numberOfLines={1}>Streak</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Recent Workouts</Text>
    </View>
  );

  const ListEmpty = () => (
    <View style={styles.empty}>
      <Ionicons name="fitness-outline" size={64} color={colors.surfaceLight} />
      <Text style={styles.emptyTitle}>No workouts yet</Text>
      <Text style={styles.emptyText}>
        Complete your first workout to see your history here
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <FlatList
        data={history.sessions}
        renderItem={renderSession}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        showsVerticalScrollIndicator={false}
      />
      <ManualWorkoutModal
        visible={showManualModal}
        onClose={() => setShowManualModal(false)}
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  addButton: {
    padding: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 4,
  },
  manualBadge: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  manualBadgeText: {
    fontSize: typography.xs,
    color: colors.primary,
    fontWeight: typography.medium,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
  },
  statCardValue: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.text,
    letterSpacing: 0.5,
  },
  statCardLabel: {
    fontSize: 10,
    fontWeight: typography.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: 2,
  },
  sectionTitle: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typography.lg,
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: spacing.md,
  },
  sessionCard: {
    marginBottom: spacing.md,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  sessionTitle: {
    flex: 1,
  },
  workoutName: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typography.lg,
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sessionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sessionDate: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  incompleteBadge: {
    backgroundColor: colors.warning + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  incompleteText: {
    fontSize: typography.xs,
    color: colors.warning,
    fontWeight: typography.medium,
  },
  statusIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusComplete: {
    backgroundColor: colors.success + '20',
  },
  statusIncomplete: {
    backgroundColor: colors.warning + '20',
  },
  sessionStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statValue: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  focusAreas: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    flexWrap: 'wrap',
  },
  focusArea: {
    fontSize: typography.xs,
    color: colors.textMuted,
    textTransform: 'capitalize',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  replayButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.error + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
  },
  emptyTitle: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typography.xl,
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  rpeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  rpeText: {
    fontSize: typography.xs,
    fontWeight: typography.semibold,
  },
  notesPreview: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.sm,
  },
  notesText: {
    flex: 1,
    fontSize: typography.xs,
    color: colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  editButtonText: {
    fontSize: typography.sm,
    color: colors.primary,
    fontWeight: typography.medium,
  },
});
