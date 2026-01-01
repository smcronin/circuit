import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card } from '@/components/common';
import { colors, spacing, typography, borderRadius } from '@/theme';
import { useTimerStore, useHistoryStore } from '@/stores';
import { formatDuration } from '@/utils';

export default function WorkoutCompleteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const session = useTimerStore((state) => state.session);
  const reset = useTimerStore((state) => state.reset);
  const history = useHistoryStore((state) => state.history);

  const handleDone = () => {
    reset();
    router.replace('/(tabs)');
  };

  const handleViewHistory = () => {
    reset();
    router.replace('/(tabs)/history');
  };

  if (!session) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Session data not found</Text>
        <Button title="Go Home" onPress={handleDone} />
      </View>
    );
  }

  const workout = session.workout;
  const isComplete = session.status === 'completed';

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Celebration Header */}
        <View style={styles.celebrationHeader}>
          <View style={styles.iconContainer}>
            <Ionicons
              name={isComplete ? 'trophy' : 'fitness'}
              size={64}
              color={isComplete ? colors.warning : colors.primary}
            />
          </View>
          <Text style={styles.title}>
            {isComplete ? 'Workout Complete!' : 'Great Effort!'}
          </Text>
          <Text style={styles.subtitle}>
            {isComplete
              ? 'You crushed it! Keep up the momentum.'
              : `You completed ${session.percentComplete}% of your workout.`}
          </Text>
        </View>

        {/* Workout Summary */}
        <Card style={styles.summaryCard}>
          <Text style={styles.workoutName}>{workout.name}</Text>

          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: colors.timerActive + '20' }]}>
                <Ionicons name="time-outline" size={24} color={colors.timerActive} />
              </View>
              <Text style={styles.statValue}>
                {formatDuration(session.actualDurationWorked)}
              </Text>
              <Text style={styles.statLabel}>Duration</Text>
            </View>

            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: colors.accent + '20' }]}>
                <Ionicons name="flame-outline" size={24} color={colors.accent} />
              </View>
              <Text style={styles.statValue}>{session.estimatedCaloriesBurned}</Text>
              <Text style={styles.statLabel}>Calories</Text>
            </View>

            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: colors.primary + '20' }]}>
                <Ionicons name="checkmark-circle-outline" size={24} color={colors.primary} />
              </View>
              <Text style={styles.statValue}>{session.completedItems}</Text>
              <Text style={styles.statLabel}>Exercises</Text>
            </View>
          </View>
        </Card>

        {/* Progress Stats */}
        <Card style={styles.progressCard}>
          <Text style={styles.progressTitle}>Your Progress</Text>

          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>Total Workouts</Text>
            <Text style={styles.progressValue}>{history.totalWorkoutsCompleted}</Text>
          </View>

          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>Total Minutes</Text>
            <Text style={styles.progressValue}>{history.totalMinutesWorked}</Text>
          </View>

          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>Total Calories</Text>
            <Text style={styles.progressValue}>{history.totalCaloriesBurned}</Text>
          </View>

          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>Current Streak</Text>
            <View style={styles.streakBadge}>
              <Ionicons name="flame" size={16} color={colors.accent} />
              <Text style={styles.streakValue}>{history.streak.current} days</Text>
            </View>
          </View>
        </Card>

        {/* Motivational Quote */}
        <View style={styles.quoteContainer}>
          <Ionicons name="chatbubble-outline" size={20} color={colors.textMuted} />
          <Text style={styles.quote}>
            {getMotivationalQuote()}
          </Text>
        </View>
      </ScrollView>

      {/* Footer Actions */}
      <View style={styles.footer}>
        <Button
          title="Done"
          onPress={handleDone}
          size="lg"
          fullWidth
        />
        <Button
          title="View History"
          onPress={handleViewHistory}
          variant="outline"
          size="lg"
          fullWidth
        />
      </View>
    </View>
  );
}

function getMotivationalQuote(): string {
  const quotes = [
    "The only bad workout is the one that didn't happen.",
    "Every rep brings you closer to your goals.",
    "Consistency beats perfection every time.",
    "You're stronger than you think.",
    "Today's workout is tomorrow's strength.",
    "Progress, not perfection.",
    "The pain you feel today is the strength you feel tomorrow.",
    "Your body can do it, it's your mind you have to convince.",
  ];
  return quotes[Math.floor(Math.random() * quotes.length)];
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
    padding: spacing.lg,
  },
  celebrationHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    paddingTop: spacing.xl,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography['3xl'],
    fontWeight: typography.bold,
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  summaryCard: {
    marginBottom: spacing.lg,
  },
  workoutName: {
    fontSize: typography.lg,
    fontWeight: typography.semibold,
    color: colors.text,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statValue: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.text,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: typography.xs,
    color: colors.textMuted,
  },
  progressCard: {
    marginBottom: spacing.lg,
  },
  progressTitle: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  progressLabel: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  progressValue: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.text,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accent + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  streakValue: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.accent,
  },
  quoteContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xxl,
  },
  quote: {
    flex: 1,
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  errorText: {
    fontSize: typography.base,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  footer: {
    padding: spacing.lg,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
