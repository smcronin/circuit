import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Input, Chip } from '@/components/common';
import { colors, spacing, typography, borderRadius } from '@/theme';
import { useWorkoutStore, useTimerStore, useUserStore, useHistoryStore } from '@/stores';
import { flattenWorkout, formatDuration, formatTimeVerbose } from '@/utils';
import { generateWorkout, WorkoutSummary } from '@/services/openrouter';
import { DIFFICULTY_COLORS } from '@/utils/constants';
import { v4 as uuid } from 'uuid';

export default function WorkoutReviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    currentWorkout,
    flattenedWorkout,
    feedbackMessage,
    setFeedbackMessage,
    isGenerating,
    setIsGenerating,
    setCurrentWorkout,
    setFlattenedWorkout,
    setGenerationError,
    selectedDuration,
  } = useWorkoutStore();
  const initializeTimer = useTimerStore((state) => state.initializeTimer);
  const profile = useUserStore((state) => state.profile);
  const getRecentSessions = useHistoryStore((state) => state.getRecentSessions);

  const [showFeedback, setShowFeedback] = useState(false);

  if (!currentWorkout || !flattenedWorkout) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>No workout generated</Text>
        <Button title="Go Back" onPress={() => router.back()} />
      </View>
    );
  }

  const difficultyColor = DIFFICULTY_COLORS[currentWorkout.difficulty];

  const handleStartWorkout = () => {
    const session = {
      id: uuid(),
      workoutId: currentWorkout.id,
      workout: currentWorkout,
      status: 'in_progress' as const,
      startedAt: new Date().toISOString(),
      completedItems: 0,
      totalItems: flattenedWorkout.totalItems,
      percentComplete: 0,
      actualDurationWorked: 0,
      estimatedCaloriesBurned: 0,
    };

    initializeTimer(flattenedWorkout.items, session);
    router.push('/workout/timer');
  };

  const handleRegenerateWithFeedback = async () => {
    if (!profile || !feedbackMessage.trim()) return;

    setIsGenerating(true);
    setShowFeedback(false);

    try {
      const selectedSet = profile.equipmentSets.find((s) => s.isDefault) || profile.equipmentSets[0];
      const recentSessions = getRecentSessions(3);
      const recentWorkouts: WorkoutSummary[] = recentSessions.map((s) => ({
        name: s.workout.name,
        focusAreas: s.workout.focusAreas,
        exercisesUsed: s.workout.circuits.flatMap((c) => c.exercises.map((e) => e.name)),
        completedAt: s.completedAt || s.startedAt || '',
      }));

      const workout = await generateWorkout({
        userGoals: profile.fitnessGoals,
        equipmentAvailable: selectedSet?.equipment || [],
        requestedDuration: selectedDuration,
        recentWorkouts,
        userAge: profile.age,
        userWeight: profile.weight,
        feedback: feedbackMessage.trim(),
      });

      const flattened = flattenWorkout(workout);
      setCurrentWorkout(workout);
      setFlattenedWorkout(flattened);
      setFeedbackMessage('');
    } catch (error) {
      console.error('Regeneration failed:', error);
      setGenerationError(error instanceof Error ? error.message : 'Failed to regenerate');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review Workout</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Workout Header */}
        <View style={styles.workoutHeader}>
          <Text style={styles.workoutName}>{currentWorkout.name}</Text>
          <Text style={styles.workoutDescription}>{currentWorkout.description}</Text>

          <View style={styles.workoutMeta}>
            <Chip label={currentWorkout.difficulty} selected color={difficultyColor} />
            <View style={styles.metaStat}>
              <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.metaText}>
                {formatDuration(currentWorkout.actualDuration)}
              </Text>
            </View>
            <View style={styles.metaStat}>
              <Ionicons name="flame-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.metaText}>
                {currentWorkout.calorieRange.low}-{currentWorkout.calorieRange.high} cal
              </Text>
            </View>
          </View>

          {currentWorkout.focusAreas.length > 0 && (
            <View style={styles.focusAreas}>
              {currentWorkout.focusAreas.map((area, idx) => (
                <Chip key={idx} label={area} size="sm" />
              ))}
            </View>
          )}
        </View>

        {/* Warm Up */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: colors.success + '20' }]}>
              <Ionicons name="sunny-outline" size={18} color={colors.success} />
            </View>
            <Text style={styles.sectionTitle}>Warm Up</Text>
            <Text style={styles.sectionDuration}>
              {formatTimeVerbose(currentWorkout.warmUp.totalDuration)}
            </Text>
          </View>
          {currentWorkout.warmUp.exercises.map((exercise, idx) => (
            <ExerciseRow key={exercise.id} exercise={exercise} index={idx} />
          ))}
        </Card>

        {/* Circuits */}
        {currentWorkout.circuits.map((circuit, circuitIdx) => (
          <Card key={circuit.id} style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: colors.primary + '20' }]}>
                <Ionicons name="flash-outline" size={18} color={colors.primary} />
              </View>
              <View style={styles.sectionTitleContainer}>
                <Text style={styles.sectionTitle}>{circuit.name}</Text>
                <Text style={styles.sectionSubtitle}>
                  {circuit.rounds} rounds, {circuit.restBetweenRounds}s rest between
                </Text>
              </View>
              <Text style={styles.sectionDuration}>
                {formatTimeVerbose(circuit.totalDuration)}
              </Text>
            </View>
            {circuit.exercises.map((exercise, idx) => (
              <ExerciseRow key={exercise.id} exercise={exercise} index={idx} showRest={idx < circuit.exercises.length - 1} restDuration={circuit.restBetweenExercises} />
            ))}
          </Card>
        ))}

        {/* Cool Down */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: colors.timerRest + '20' }]}>
              <Ionicons name="moon-outline" size={18} color={colors.timerRest} />
            </View>
            <Text style={styles.sectionTitle}>Cool Down</Text>
            <Text style={styles.sectionDuration}>
              {formatTimeVerbose(currentWorkout.coolDown.totalDuration)}
            </Text>
          </View>
          {currentWorkout.coolDown.exercises.map((exercise, idx) => (
            <ExerciseRow key={exercise.id} exercise={exercise} index={idx} />
          ))}
        </Card>

        {/* Feedback Section */}
        <Card style={styles.feedbackSection}>
          <TouchableOpacity
            style={styles.feedbackToggle}
            onPress={() => setShowFeedback(!showFeedback)}
          >
            <Ionicons name="chatbubble-outline" size={20} color={colors.primary} />
            <Text style={styles.feedbackToggleText}>
              {showFeedback ? 'Cancel' : 'Want changes? Give feedback'}
            </Text>
            <Ionicons
              name={showFeedback ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>

          {showFeedback && (
            <View style={styles.feedbackForm}>
              <Input
                placeholder="e.g., 'More core exercises' or 'Replace push-ups with something easier'"
                value={feedbackMessage}
                onChangeText={setFeedbackMessage}
                multiline
                containerStyle={styles.feedbackInput}
              />
              <Button
                title={isGenerating ? 'Regenerating...' : 'Regenerate Workout'}
                onPress={handleRegenerateWithFeedback}
                loading={isGenerating}
                disabled={!feedbackMessage.trim() || isGenerating}
                fullWidth
              />
            </View>
          )}
        </Card>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          title="Start Workout"
          onPress={handleStartWorkout}
          size="lg"
          fullWidth
          icon={<Ionicons name="play" size={20} color={colors.text} />}
        />
      </View>
    </View>
  );
}

function ExerciseRow({
  exercise,
  index,
  showRest,
  restDuration,
}: {
  exercise: { name: string; duration: number; description: string; targetReps?: number; repRange?: string };
  index: number;
  showRest?: boolean;
  restDuration?: number;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <TouchableOpacity
        style={styles.exerciseRow}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.exerciseIndex}>
          <Text style={styles.exerciseIndexText}>{index + 1}</Text>
        </View>
        <View style={styles.exerciseInfo}>
          <Text style={styles.exerciseName}>{exercise.name}</Text>
          <Text style={styles.exerciseMeta}>
            {formatTimeVerbose(exercise.duration)}
            {exercise.targetReps && ` • ${exercise.targetReps} reps`}
            {exercise.repRange && ` • ${exercise.repRange} reps`}
          </Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'information-circle-outline'}
          size={20}
          color={colors.textMuted}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.exerciseDescription}>
          <Text style={styles.exerciseDescriptionText}>{exercise.description}</Text>
        </View>
      )}

      {showRest && restDuration && (
        <View style={styles.restIndicator}>
          <Ionicons name="pause" size={12} color={colors.textMuted} />
          <Text style={styles.restText}>{restDuration}s rest</Text>
        </View>
      )}
    </>
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
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.sm,
  },
  headerTitle: {
    flex: 1,
    fontSize: typography.lg,
    fontWeight: typography.semibold,
    color: colors.text,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
    padding: spacing.lg,
  },
  workoutHeader: {
    marginBottom: spacing.lg,
  },
  workoutName: {
    fontSize: typography['2xl'],
    fontWeight: typography.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  workoutDescription: {
    fontSize: typography.base,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 22,
  },
  workoutMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  metaStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  focusAreas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  sectionTitleContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.text,
  },
  sectionSubtitle: {
    fontSize: typography.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  sectionDuration: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  exerciseIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  exerciseIndexText: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.textSecondary,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
    color: colors.text,
    marginBottom: 2,
  },
  exerciseMeta: {
    fontSize: typography.xs,
    color: colors.textMuted,
  },
  exerciseDescription: {
    marginLeft: 36,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.sm,
  },
  exerciseDescriptionText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  restIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginLeft: 36,
    marginBottom: spacing.sm,
  },
  restText: {
    fontSize: typography.xs,
    color: colors.textMuted,
  },
  feedbackSection: {
    marginBottom: spacing.xxl,
  },
  feedbackToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  feedbackToggleText: {
    flex: 1,
    fontSize: typography.sm,
    color: colors.primary,
    fontWeight: typography.medium,
  },
  feedbackForm: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  feedbackInput: {
    marginBottom: spacing.md,
  },
  errorText: {
    fontSize: typography.base,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  footer: {
    padding: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});
