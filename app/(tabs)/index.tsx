import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Chip, Input } from '@/components/common';
import { CircuitLogo } from '@/components/CircuitLogo';
import { GeneratingWorkoutModal } from '@/components/GeneratingWorkoutModal';
import { CustomInstructionsHistoryModal } from '@/components/home/CustomInstructionsHistoryModal';
import { ProgrammedWorkoutsCard } from '@/components/home/ProgrammedWorkoutsCard';
import { colors, spacing, typography, borderRadius } from '@/theme';
import { DURATION_OPTIONS, WARMUP_COOLDOWN_THRESHOLD } from '@/utils/constants';
import { useUserStore, useWorkoutStore, useHistoryStore } from '@/stores';
import { generateWorkout, WorkoutSummary } from '@/services/openrouter';
import { flattenWorkout } from '@/utils';
import { getProgrammedWorkoutsForHome } from '@/data/programmedWorkouts';
import type { ProgrammedWorkout } from '@/data/programmedWorkouts';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const profile = useUserStore((state) => state.profile);
  const savedCustomInstructions = useUserStore((state) => state.savedCustomInstructions);
  const addCustomInstruction = useUserStore((state) => state.addCustomInstruction);
  const clearCustomInstructions = useUserStore((state) => state.clearCustomInstructions);
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
    includeWarmup,
    setIncludeWarmup,
    includeCooldown,
    setIncludeCooldown,
    isCustomDuration,
    setIsCustomDuration,
  } = useWorkoutStore();
  const getRecentSessions = useHistoryStore((state) => state.getRecentSessions);
  const workoutSummary = useHistoryStore((state) => state.workoutSummary);

  const [refreshing, setRefreshing] = useState(false);
  const [showCustomDuration, setShowCustomDuration] = useState(false);
  const [customDurationInput, setCustomDurationInput] = useState('');
  const [showInstructionsHistory, setShowInstructionsHistory] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Helper to update warmup/cooldown defaults based on duration
  const updateDurationWithDefaults = useCallback((duration: number) => {
    setSelectedDuration(duration);
    const shouldEnable = duration >= WARMUP_COOLDOWN_THRESHOLD;
    setIncludeWarmup(shouldEnable);
    setIncludeCooldown(shouldEnable);
  }, [setSelectedDuration, setIncludeWarmup, setIncludeCooldown]);

  const equipmentSets = profile?.equipmentSets || [];
  const selectedSet = equipmentSets.find((s) => s.id === selectedEquipmentSetId) ||
    equipmentSets.find((s) => s.isDefault) ||
    equipmentSets[0];
  const programmedHome = getProgrammedWorkoutsForHome();

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setGenerationError(null);
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  const handleOpenProgrammedWorkout = useCallback((programmedWorkout: ProgrammedWorkout) => {
    const workout = programmedWorkout.workout;
    const flattened = flattenWorkout(workout);

    setCurrentWorkout(workout);
    setFlattenedWorkout(flattened);
    router.push('/workout/review');
  }, [router, setCurrentWorkout, setFlattenedWorkout]);

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
        includeWarmup,
        includeCooldown,
      });

      const flattened = flattenWorkout(workout);

      // Save custom instructions to history (if provided)
      if (customInstructions) {
        addCustomInstruction(customInstructions);
      }

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
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
        }
      >
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <CircuitLogo size={96} />
            <View>
              <Text style={styles.appName}>Circuit</Text>
              <Text style={styles.subtitle}>AI-Powered Workouts</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <Ionicons name="person-circle-outline" size={36} color={colors.text} />
          </TouchableOpacity>
        </View>

        {programmedHome && (
          <ProgrammedWorkoutsCard
            title={programmedHome.title}
            dateLabel={programmedHome.dateLabel}
            isToday={programmedHome.isToday}
            workouts={programmedHome.workouts}
            onSelectWorkout={handleOpenProgrammedWorkout}
          />
        )}

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
            {DURATION_OPTIONS.map((option) => {
              const isSelected = selectedDuration === option.value && isCustomDuration === false;
              return (
                <Pressable
                  key={option.value}
                  style={({ pressed }) => [
                    styles.durationOption,
                    isSelected && styles.durationOptionSelected,
                    pressed && styles.durationOptionPressed,
                  ]}
                  onPress={() => {
                    setIsCustomDuration(false);
                    updateDurationWithDefaults(option.value);
                  }}
                >
                  <Text
                    style={[
                      styles.durationValue,
                      isSelected && styles.durationValueSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
            {/* Custom Duration Button */}
            <Pressable
              style={({ pressed }) => [
                styles.durationOption,
                isCustomDuration && styles.durationOptionSelected,
                pressed && styles.durationOptionPressed,
              ]}
              onPress={() => {
                setCustomDurationInput(isCustomDuration ? String(selectedDuration) : '');
                setShowCustomDuration(true);
              }}
            >
              {isCustomDuration ? (
                <Text style={[styles.durationValue, styles.durationValueSelected]}>
                  {selectedDuration} min
                </Text>
              ) : (
                <Ionicons name="add" size={20} color={colors.textSecondary} />
              )}
            </Pressable>
          </View>

          {/* Warmup/Cooldown Toggles */}
          <View style={styles.workoutOptionsRow}>
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setIncludeWarmup(!includeWarmup)}
            >
              <View style={[styles.checkbox, includeWarmup && styles.checkboxChecked]}>
                {includeWarmup && <Ionicons name="checkmark" size={14} color={colors.text} />}
              </View>
              <Text style={styles.checkboxLabel}>Warmup</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setIncludeCooldown(!includeCooldown)}
            >
              <View style={[styles.checkbox, includeCooldown && styles.checkboxChecked]}>
                {includeCooldown && <Ionicons name="checkmark" size={14} color={colors.text} />}
              </View>
              <Text style={styles.checkboxLabel}>Cooldown</Text>
            </TouchableOpacity>
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
            <Text style={[styles.sectionTitle, { flex: 1 }]}>Custom Instructions</Text>
            <View style={styles.instructionsActions}>
              {customInstructions ? (
                <TouchableOpacity
                  style={styles.instructionsActionButton}
                  onPress={() => setCustomInstructions('')}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={styles.instructionsActionButton}
                onPress={() => setShowInstructionsHistory(true)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
          <Input
            placeholder="e.g., Focus on upper body, include pull-ups, no jumping..."
            blurOnSubmit={true}
            value={customInstructions}
            onChangeText={setCustomInstructions}
            onFocus={() => {
              setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
              }, 100);
            }}
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

      {/* Custom Duration Modal */}
      <Modal visible={showCustomDuration} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Custom Duration</Text>
            <TextInput
              style={styles.customInput}
              keyboardType="number-pad"
              placeholder="Minutes"
              placeholderTextColor={colors.textMuted}
              value={customDurationInput}
              onChangeText={setCustomDurationInput}
              maxLength={3}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowCustomDuration(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={() => {
                  const mins = parseInt(customDurationInput, 10);
                  if (mins > 0 && mins <= 120) {
                    setSelectedDuration(mins);
                    setIsCustomDuration(true);
                    setShowCustomDuration(false);
                  }
                }}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>Set</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom Instructions History Modal */}
      <CustomInstructionsHistoryModal
        visible={showInstructionsHistory}
        onClose={() => setShowInstructionsHistory(false)}
        instructions={savedCustomInstructions}
        onSelect={setCustomInstructions}
        onClear={clearCustomInstructions}
      />

      {/* Generating Workout Modal */}
      <GeneratingWorkoutModal visible={isGenerating} />
    </KeyboardAvoidingView>
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
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  appName: {
    fontSize: typography['2xl'],
    fontWeight: typography.bold,
    color: colors.text,
  },
  subtitle: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginTop: 2,
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
    flex: 1,
  },
  instructionsActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  instructionsActionButton: {
    padding: spacing.xs,
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
  durationOptionPressed: {
    opacity: 0.7,
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
  workoutOptionsRow: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxLabel: {
    fontSize: typography.sm,
    color: colors.text,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.surface,
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
    width: '80%',
    maxWidth: 300,
  },
  modalTitle: {
    fontSize: typography.lg,
    fontWeight: typography.semibold,
    color: colors.text,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  customInput: {
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: typography.xl,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'flex-end',
  },
  modalButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
  },
  modalButtonPrimary: {
    backgroundColor: colors.primary,
  },
  modalButtonText: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.textSecondary,
  },
  modalButtonTextPrimary: {
    color: colors.text,
  },
});
