import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, Chip } from '@/components/common';
import { colors, spacing, typography, borderRadius } from '@/theme';
import { useHistoryStore, useWorkoutStore } from '@/stores';
import { WorkoutSession } from '@/types/workout';
import { formatDate, formatDuration, flattenWorkout } from '@/utils';
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
  const { setCurrentWorkout, setFlattenedWorkout } = useWorkoutStore();

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

  const stats = {
    totalWorkouts: history.totalWorkoutsCompleted,
    totalMinutes: history.totalMinutesWorked,
    totalCalories: history.totalCaloriesBurned,
    streak: history.streak.current,
  };

  const renderSession = ({ item }: { item: WorkoutSession }) => {
    const isCompleted = item.status === 'completed';
    const difficultyColor = DIFFICULTY_COLORS[item.workout.difficulty];
    const hasNotes = item.feedback?.notes && item.feedback.notes.length > 0;

    return (
      <Card style={styles.sessionCard}>
        <View style={styles.sessionHeader}>
          <View style={styles.sessionTitle}>
            <Text style={styles.workoutName}>{item.workout.name}</Text>
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
            <TouchableOpacity
              style={styles.replayButton}
              onPress={() => handleReplay(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh" size={18} color={colors.primary} />
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
            <Text style={styles.statValue}>{item.estimatedCaloriesBurned} cal</Text>
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
      <Text style={styles.title}>History</Text>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statCardValue}>{stats.totalWorkouts}</Text>
          <Text style={styles.statCardLabel}>Workouts</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statCardValue}>{stats.totalMinutes}</Text>
          <Text style={styles.statCardLabel}>Minutes</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statCardValue}>{stats.totalCalories}</Text>
          <Text style={styles.statCardLabel}>Calories</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statCardValue}>{stats.streak}</Text>
          <Text style={styles.statCardLabel}>Day Streak</Text>
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
    fontSize: typography['2xl'],
    fontWeight: typography.bold,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  statCardValue: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.text,
  },
  statCardLabel: {
    fontSize: typography.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.text,
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
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.text,
    marginBottom: 4,
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
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
  },
  emptyTitle: {
    fontSize: typography.lg,
    fontWeight: typography.semibold,
    color: colors.text,
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
