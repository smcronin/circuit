import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, Card, Input } from '@/components/common';
import { colors, spacing, typography, borderRadius } from '@/theme';
import { useTimerStore, useHistoryStore } from '@/stores';
import { formatDuration } from '@/utils';

// Shiny trophy with animated shimmer effect
function ShimmerTrophy({ size = 64 }: { size?: number }) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );
    shimmer.start();
    return () => shimmer.stop();
  }, [shimmerAnim]);

  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-size * 2, size * 2],
  });

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 0.3, 0.5, 0.7, 1],
    outputRange: [0, 0.3, 0.6, 0.3, 0],
  });

  return (
    <View style={{ width: size, height: size, position: 'relative' }}>
      {/* Base trophy icon */}
      <Ionicons name="trophy" size={size} color={colors.warning} />

      {/* Shimmer overlay */}
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          overflow: 'hidden',
          opacity: shimmerOpacity,
        }}
      >
        <Animated.View
          style={{
            position: 'absolute',
            top: -size,
            left: 0,
            width: size * 0.4,
            height: size * 3,
            transform: [
              { translateX: shimmerTranslate },
              { rotate: '20deg' },
            ],
          }}
        >
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.8)', 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

function getRpeColor(value: number): string {
  if (value <= 3) return colors.success;
  if (value <= 6) return colors.warning;
  if (value <= 8) return colors.accent;
  return colors.error;
}

function getRpeLabel(value: number): string {
  if (value <= 2) return 'Very Easy';
  if (value <= 4) return 'Easy';
  if (value <= 6) return 'Moderate';
  if (value <= 8) return 'Hard';
  return 'Maximum';
}

export default function WorkoutCompleteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [rpe, setRpe] = useState<number | undefined>(undefined);
  const [notes, setNotes] = useState('');

  const session = useTimerStore((state) => state.session);
  const reset = useTimerStore((state) => state.reset);
  const history = useHistoryStore((state) => state.history);
  const updateSession = useHistoryStore((state) => state.updateSession);

  // Use parting words from workout, fall back to random quote for older workouts
  const motivationalQuote = useMemo(
    () => session?.workout?.partingWords || getMotivationalQuote(),
    [session?.workout?.partingWords]
  );

  // Random completion message - memoized so it doesn't change on re-renders
  const completionMessage = useMemo(() => getCompletionMessage(), []);

  const handleDone = () => {
    if (session && (rpe !== undefined || notes.trim())) {
      updateSession(session.id, {
        rpe,
        notes: notes.trim() || undefined,
      });
    }
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
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Celebration Header */}
        <View style={styles.celebrationHeader}>
          <View style={styles.iconContainer}>
            {isComplete ? (
              <ShimmerTrophy size={64} />
            ) : (
              <Ionicons name="fitness" size={64} color={colors.primary} />
            )}
          </View>
          <Text style={styles.title}>
            {isComplete ? 'Workout Complete!' : 'Great Effort!'}
          </Text>
          <Text style={styles.subtitle}>
            {isComplete
              ? completionMessage
              : `You completed ${session.percentComplete}% of your workout. Still awesome!`}
          </Text>
        </View>

        {/* Parting Words */}
        <View style={styles.quoteContainer}>
          <Ionicons name="chatbubble-outline" size={20} color={colors.textMuted} />
          <Text style={styles.quote}>
            {motivationalQuote}
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

        {/* RPE Input */}
        <Card style={styles.feedbackCard}>
          <Text style={styles.feedbackTitle}>How did it feel?</Text>
          <Text style={styles.feedbackSubtitle}>Rate your perceived exertion (optional)</Text>

          <View style={styles.rpeContainer}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
              <TouchableOpacity
                key={value}
                style={[
                  styles.rpeButton,
                  {
                    backgroundColor:
                      rpe === value ? getRpeColor(value) : getRpeColor(value) + '30',
                    borderColor: rpe === value ? getRpeColor(value) : 'transparent',
                  },
                ]}
                onPress={() => setRpe(rpe === value ? undefined : value)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.rpeText,
                    { color: rpe === value ? colors.text : getRpeColor(value) },
                  ]}
                >
                  {value}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.rpeLabels}>
            <Text style={styles.rpeLabel}>Easy</Text>
            <Text style={styles.rpeLabel}>Moderate</Text>
            <Text style={styles.rpeLabel}>Maximum</Text>
          </View>

          {rpe !== undefined && (
            <View style={styles.rpeSelectedContainer}>
              <Text style={[styles.rpeSelectedText, { color: getRpeColor(rpe) }]}>
                RPE {rpe}: {getRpeLabel(rpe)}
              </Text>
            </View>
          )}
        </Card>

        {/* Notes Input */}
        <Card style={styles.feedbackCard}>
          <Text style={styles.feedbackTitle}>Any notes?</Text>
          <Text style={styles.feedbackSubtitle}>
            Record how you felt, any issues, or thoughts (optional)
          </Text>
          <Input
            placeholder="e.g., Felt strong today, shoulder was tight..."
            value={notes}
            onChangeText={setNotes}
            multiline
            containerStyle={styles.notesInput}
          />
        </Card>
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
    </KeyboardAvoidingView>
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

function getCompletionMessage(): string {
  const messages = [
    // Classic encouragement
    "You crushed it! Keep up the momentum.",
    "Absolutely demolished that workout!",
    "Another one in the books. Legend status.",
    "That's how it's done! Pure dedication.",

    // Gym bro energy
    "Gains: secured. Excuses: rejected.",
    "The weights feared you today. As they should.",
    "Somewhere, a treadmill just told its friends about you.",
    "You didn't come this far to only come this far.",
    "Beast mode: activated and completed.",
    "The gym just filed a noise complaint. Too much crushing it.",

    // Playful & funny
    "Your muscles are writing you a thank you note.",
    "Plot twist: you're the main character.",
    "Netflix asked if you're still watching. You said no, you're busy winning.",
    "Couch potatoes everywhere are shaking.",
    "Your future self just sent a thank you text.",
    "Sweat is just your fat crying. Let it out.",
    "You just made your bed jealous—it wanted to keep you longer.",

    // Hype & motivation
    "Champions don't hit snooze. And neither did you.",
    "One more workout closer to the best version of you.",
    "You showed up. That's already more than most.",
    "Discipline: 1, Excuses: 0.",
    "The only thing getting crushed today was that workout.",
    "You're not just building muscle, you're building character.",

    // Light-hearted
    "Workout complete. Snack earned.",
    "You vs. You, and you won again.",
    "Your gym clothes are proud of you.",
    "High five! ...Okay, maybe after your arms recover.",
    "You're officially allowed to say 'I worked out today' with smugness.",
    "Remember this feeling next time the couch calls.",

    // Wholesome
    "Every drop of sweat was worth it.",
    "Your body thanks you. Your mind thanks you. We thank you.",
    "Progress isn't always visible, but it's always happening.",
    "You just invested in yourself. Best ROI there is.",
    "Small steps, big changes. You're living proof.",

    // Silly gym bro
    "Do you even lift? Yes. Yes you do.",
    "Somewhere, Arnold is nodding approvingly.",
    "The iron never lies. And today it said you're awesome.",
    "You came, you saw, you conquered... then stretched.",
    "Protein shake unlocked.",
  ];
  return messages[Math.floor(Math.random() * messages.length)];
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
  feedbackCard: {
    marginBottom: spacing.lg,
  },
  feedbackTitle: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  feedbackSubtitle: {
    fontSize: typography.sm,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  rpeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  rpeButton: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 32,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  rpeText: {
    fontSize: typography.sm,
    fontWeight: typography.bold,
  },
  rpeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  rpeLabel: {
    fontSize: typography.xs,
    color: colors.textMuted,
  },
  rpeSelectedContainer: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
  rpeSelectedText: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
  },
  notesInput: {
    marginTop: spacing.xs,
  },
});
