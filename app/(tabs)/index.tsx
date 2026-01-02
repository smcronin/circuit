import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Chip, Input } from '@/components/common';
import { colors, spacing, typography, borderRadius } from '@/theme';
import { DURATION_OPTIONS } from '@/utils/constants';
import { useUserStore, useWorkoutStore, useHistoryStore } from '@/stores';
import { generateWorkout, WorkoutSummary } from '@/services/openrouter';
import { flattenWorkout } from '@/utils';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const profile = useUserStore((state) => state.profile);
  const {
    isGenerating,
    setIsGenerating,
    setGenerationError,
    generationError,
    setCurrentWorkout,
    setFlattenedWorkout,
    selectedEquipmentSetId,
    setSelectedEquipmentSetId,
    selectedDuration,
    setSelectedDuration,
    customInstructions,
    setCustomInstructions,
  } = useWorkoutStore();
  const getRecentSessions = useHistoryStore((state) => state.getRecentSessions);
  const workoutSummary = useHistoryStore((state) => state.workoutSummary);

  const [refreshing, setRefreshing] = useState(false);

  const equipmentSets = profile?.equipmentSets || [];
  const selectedSet = equipmentSets.find((s) => s.id === selectedEquipmentSetId) ||
    equipmentSets.find((s) => s.isDefault) ||
    equipmentSets[0];

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setGenerationError(null);
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  const handleGenerateWorkout = async () => {
    if (!profile) return;

    setIsGenerating(true);
    setGenerationError(null);

    try {
      // Get recent 5 workouts for full context (including RPE/notes)
      const recentSessions = getRecentSessions(5);
      const recentWorkouts: WorkoutSummary[] = recentSessions.map((s) => ({
        name: s.workout.name,
        focusAreas: s.workout.focusAreas,
        exercisesUsed: s.workout.circuits.flatMap((c) =>
          c.exercises.map((e) => e.name)
        ),
        completedAt: s.completedAt || s.startedAt || '',
        rpe: s.feedback?.rpe,
        notes: s.feedback?.notes,
      }));

      const workout = await generateWorkout({
        userGoals: profile.fitnessGoals,
        equipmentAvailable: selectedSet?.equipment || [],
        equipmentNotes: selectedSet?.notes,
        trainingNotes: profile.trainingNotes,
        requestedDuration: selectedDuration,
        recentWorkouts,
        olderWorkoutsSummary: workoutSummary,
        userAge: profile.age,
        userWeight: profile.weight,
        customInstructions: customInstructions || undefined,
      });

      const flattened = flattenWorkout(workout);

      setCurrentWorkout(workout);
      setFlattenedWorkout(flattened);
      router.push('/workout/review');
    } catch (error) {
      console.error('Workout generation failed:', error);
      setGenerationError(
        error instanceof Error ? error.message : 'Failed to generate workout'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAvoidingView
        style={[styles.container, { paddingTop: insets.top }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Ready to train?</Text>
            <Text style={styles.subtitle}>Generate your personalized workout</Text>
          </View>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <Ionicons name="person-circle-outline" size={36} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Equipment Selection */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="fitness-outline" size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>Equipment</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              {equipmentSets.length === 0 ? (
                <Chip label="Bodyweight Only" selected />
              ) : (
                equipmentSets.map((set) => (
                  <Chip
                    key={set.id}
                    label={set.name}
                    selected={set.id === (selectedSet?.id)}
                    onPress={() => setSelectedEquipmentSetId(set.id)}
                  />
                ))
              )}
              <Chip
                label="Add Set"
                icon="add"
                onPress={() => router.push('/(tabs)/profile')}
              />
            </View>
          </ScrollView>
          {selectedSet && selectedSet.equipment.length > 0 && (
            <Text style={styles.equipmentList}>
              {selectedSet.equipment.slice(0, 4).join(', ')}
              {selectedSet.equipment.length > 4 && ` +${selectedSet.equipment.length - 4} more`}
            </Text>
          )}
        </Card>

        {/* Duration Selection */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="time-outline" size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>Duration</Text>
          </View>
          <View style={styles.durationGrid}>
            {DURATION_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.durationOption,
                  selectedDuration === option.value && styles.durationOptionSelected,
                ]}
                onPress={() => setSelectedDuration(option.value)}
              >
                <Text
                  style={[
                    styles.durationValue,
                    selectedDuration === option.value && styles.durationValueSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Goals Preview */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="flag-outline" size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>Your Goals</Text>
          </View>
          <Text style={styles.goalsText} numberOfLines={2}>
            {profile?.fitnessGoals || 'No goals set'}
          </Text>
        </Card>

        {/* Custom Instructions */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="chatbubble-outline" size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>Custom Instructions</Text>
            <Text style={styles.optionalLabel}>(Optional)</Text>
          </View>
          <Input
            placeholder="e.g., Focus on upper body, include pull-ups, no jumping..."
            blurOnSubmit={true}
            value={customInstructions}
            onChangeText={setCustomInstructions}
            multiline
            numberOfLines={3}
          />
        </Card>

        {generationError && (
          <Card style={styles.errorCard}>
            <Ionicons name="warning-outline" size={24} color={colors.error} />
            <Text style={styles.errorText}>{generationError}</Text>
          </Card>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          title={isGenerating ? 'Generating...' : 'Generate Workout'}
          onPress={handleGenerateWorkout}
          size="lg"
          fullWidth
          loading={isGenerating}
          disabled={isGenerating}
          icon={!isGenerating && <Ionicons name="flash" size={20} color={colors.text} />}
        />
      </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  greeting: {
    fontSize: typography['2xl'],
    fontWeight: typography.bold,
    color: colors.text,
  },
  subtitle: {
    fontSize: typography.base,
    color: colors.textSecondary,
    marginTop: 4,
  },
  profileButton: {
    padding: spacing.xs,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.text,
  },
  optionalLabel: {
    fontSize: typography.sm,
    color: colors.textMuted,
    marginLeft: 'auto',
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  equipmentList: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  durationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  durationOption: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceLight,
  },
  durationOptionSelected: {
    backgroundColor: colors.primary,
  },
  durationValue: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.textSecondary,
  },
  durationValueSelected: {
    color: colors.text,
  },
  goalsText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: colors.error,
  },
  errorText: {
    flex: 1,
    fontSize: typography.sm,
    color: colors.error,
  },
  footer: {
    padding: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});
