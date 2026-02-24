import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Button, Input, Chip } from '@/components/common';
import { colors, spacing, borderRadius, typography } from '@/theme';
import {
  FOCUS_AREAS,
  MUSCLE_GROUPS,
  MANUAL_DURATION_OPTIONS,
  DIFFICULTY_COLORS,
} from '@/utils/constants';
import { createManualWorkoutSession } from '@/utils/createManualWorkoutSession';
import { generateManualWorkoutMetadata } from '@/services/openrouter/client';
import { ManualWorkoutMetadataResponse } from '@/types/llm';
import { useHistoryStore, useUserStore } from '@/stores';
import { formatDate } from '@/utils';

type ModalStep = 'form' | 'loading' | 'preview';

interface ManualWorkoutFormData {
  title: string;
  description: string;
  durationMinutes: number;
  date: Date;
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function ManualWorkoutModal({ visible, onClose }: Props) {
  const [step, setStep] = useState<ModalStep>('form');
  const [formData, setFormData] = useState<ManualWorkoutFormData>({
    title: '',
    description: '',
    durationMinutes: 30,
    date: new Date(),
  });
  const [metadata, setMetadata] = useState<ManualWorkoutMetadataResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const profile = useUserStore((state) => state.profile);
  const addSession = useHistoryStore((state) => state.addSession);

  const resetModal = useCallback(() => {
    setStep('form');
    setFormData({
      title: '',
      description: '',
      durationMinutes: 30,
      date: new Date(),
    });
    setMetadata(null);
    setError(null);
    setShowDatePicker(false);
    setSaving(false);
  }, []);

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const handleGenerateMetadata = async () => {
    if (!formData.title.trim() || !formData.description.trim()) {
      setError('Please fill in both title and description');
      return;
    }

    setError(null);
    setStep('loading');

    try {
      const result = await generateManualWorkoutMetadata({
        title: formData.title,
        description: formData.description,
        durationMinutes: formData.durationMinutes,
        userWeight: profile?.weight,
        userAge: profile?.age,
      });
      setMetadata(result);
      setStep('preview');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate metadata');
      setStep('form');
    }
  };

  const handleSave = async () => {
    if (!metadata) return;

    setSaving(true);
    try {
      const session = createManualWorkoutSession({
        title: formData.title,
        description: formData.description,
        durationMinutes: formData.durationMinutes,
        date: formData.date,
        metadata,
      });
      addSession(session);
      handleClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save workout');
      setSaving(false);
    }
  };

  const toggleFocusArea = (area: string) => {
    if (!metadata) return;
    const newAreas = metadata.focusAreas.includes(area)
      ? metadata.focusAreas.filter((a) => a !== area)
      : [...metadata.focusAreas, area];
    setMetadata({ ...metadata, focusAreas: newAreas });
  };

  const toggleMuscleGroup = (muscle: string) => {
    if (!metadata) return;
    const newMuscles = metadata.muscleGroupsTargeted.includes(muscle)
      ? metadata.muscleGroupsTargeted.filter((m) => m !== muscle)
      : [...metadata.muscleGroupsTargeted, muscle];
    setMetadata({ ...metadata, muscleGroupsTargeted: newMuscles });
  };

  const handleDateChange = (_event: unknown, selectedDate?: Date) => {
    // Keep the picker open on iOS (it's inline); close on Android after selection
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setFormData({ ...formData, date: selectedDate });
    }
  };

  const handleWebDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Parse as local date (YYYY-MM-DD) so we don't get UTC midnight offset issues
    const [year, month, day] = e.target.value.split('-').map(Number);
    if (year && month && day) {
      const selected = new Date(year, month - 1, day);
      setFormData({ ...formData, date: selected });
    }
  };

  const renderFormStep = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <Input
        label="Workout Title"
        placeholder="e.g., Climbing Session, Morning Run"
        value={formData.title}
        onChangeText={(text) => setFormData({ ...formData, title: text })}
      />

      <View style={styles.inputSpacing}>
        <Input
          label="Description"
          placeholder="Describe what you did... e.g., 45 minutes bouldering, sent 3 V6s and 3 V3s"
          value={formData.description}
          onChangeText={(text) => setFormData({ ...formData, description: text })}
          multiline
          numberOfLines={4}
        />
      </View>

      <View style={styles.inputSpacing}>
        <Text style={styles.label}>Duration</Text>
        <View style={styles.durationGrid}>
          {MANUAL_DURATION_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              style={[
                styles.durationButton,
                formData.durationMinutes === option.value && styles.durationButtonSelected,
              ]}
              onPress={() => setFormData({ ...formData, durationMinutes: option.value })}
            >
              <Text
                style={[
                  styles.durationButtonText,
                  formData.durationMinutes === option.value && styles.durationButtonTextSelected,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.inputSpacing}>
        <Text style={styles.label}>Date</Text>
        {Platform.OS === 'web' ? (
          // On web, @react-native-community/datetimepicker renders behind Modal overlays.
          // Use a native HTML date input instead — it reliably opens the browser's
          // calendar picker regardless of stacking context.
          <View style={styles.dateButton}>
            <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
            <input
              type="date"
              value={formData.date.toISOString().split('T')[0]}
              max={new Date().toISOString().split('T')[0]}
              onChange={handleWebDateChange}
              style={{
                background: 'transparent',
                border: 'none',
                color: colors.text,
                fontSize: 16,
                fontFamily: 'inherit',
                cursor: 'pointer',
                outline: 'none',
                flex: 1,
              }}
            />
          </View>
        ) : (
          // On native, tap to reveal an inline spinner-style picker so it renders
          // inside the Modal rather than launching a dialog that stacks behind it.
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePicker((prev) => !prev)}
          >
            <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.dateButtonText}>{formatDate(formData.date.toISOString())}</Text>
          </TouchableOpacity>
        )}
      </View>

      {showDatePicker && Platform.OS !== 'web' && (
        <DateTimePicker
          value={formData.date}
          mode="date"
          // Use 'spinner' on both iOS and Android so the picker renders inline
          // within the Modal scroll view. The default Android 'calendar' dialog
          // appears on a separate window layer and gets hidden behind the Modal.
          display="spinner"
          maximumDate={new Date()}
          onChange={handleDateChange}
          themeVariant="dark"
        />
      )}

      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.buttonContainer}>
        <Button
          title="Generate Metadata"
          onPress={handleGenerateMetadata}
          fullWidth
          disabled={!formData.title.trim() || !formData.description.trim()}
        />
      </View>
    </ScrollView>
  );

  const renderLoadingStep = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.loadingText}>Analyzing your workout...</Text>
      <Text style={styles.loadingSubtext}>
        Estimating calories and identifying muscle groups
      </Text>
    </View>
  );

  const renderPreviewStep = () => {
    if (!metadata) return null;

    return (
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.previewHeader}>
          <Text style={styles.previewTitle}>{formData.title}</Text>
          <Text style={styles.previewSubtitle}>
            {formData.durationMinutes} min • {formatDate(formData.date.toISOString())}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Difficulty</Text>
          <View style={styles.difficultyRow}>
            {(['beginner', 'intermediate', 'advanced'] as const).map((level) => (
              <Chip
                key={level}
                label={level}
                selected={metadata.difficulty === level}
                onPress={() => setMetadata({ ...metadata, difficulty: level })}
                color={DIFFICULTY_COLORS[level]}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Estimated Calories: {metadata.estimatedCalories}
          </Text>
          <Text style={styles.calorieRange}>
            Range: {metadata.calorieRange.low} - {metadata.calorieRange.high} cal
          </Text>
          <View style={styles.calorieAdjust}>
            <TouchableOpacity
              style={styles.adjustButton}
              onPress={() =>
                setMetadata({
                  ...metadata,
                  estimatedCalories: Math.max(0, metadata.estimatedCalories - 50),
                })
              }
            >
              <Ionicons name="remove" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.calorieValue}>{metadata.estimatedCalories}</Text>
            <TouchableOpacity
              style={styles.adjustButton}
              onPress={() =>
                setMetadata({
                  ...metadata,
                  estimatedCalories: metadata.estimatedCalories + 50,
                })
              }
            >
              <Ionicons name="add" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Focus Areas</Text>
          <View style={styles.chipGrid}>
            {FOCUS_AREAS.map((area) => (
              <Chip
                key={area}
                label={area}
                selected={metadata.focusAreas.includes(area)}
                onPress={() => toggleFocusArea(area)}
                size="sm"
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Muscle Groups</Text>
          <View style={styles.chipGrid}>
            {MUSCLE_GROUPS.map((muscle) => (
              <Chip
                key={muscle}
                label={muscle}
                selected={metadata.muscleGroupsTargeted.includes(muscle)}
                onPress={() => toggleMuscleGroup(muscle)}
                size="sm"
              />
            ))}
          </View>
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <View style={styles.buttonRow}>
          <Button
            title="Back"
            onPress={() => setStep('form')}
            variant="outline"
            style={styles.backButton}
          />
          <Button
            title="Save Workout"
            onPress={handleSave}
            loading={saving}
            style={styles.saveButton}
          />
        </View>
      </ScrollView>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {step === 'form' && 'Log Manual Workout'}
              {step === 'loading' && 'Analyzing...'}
              {step === 'preview' && 'Review & Edit'}
            </Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {step === 'form' && renderFormStep()}
          {step === 'loading' && renderLoadingStep()}
          {step === 'preview' && renderPreviewStep()}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: typography.lg,
    fontWeight: typography.semibold,
    color: colors.text,
  },
  closeButton: {
    padding: spacing.xs,
  },
  content: {
    padding: spacing.lg,
  },
  inputSpacing: {
    marginTop: spacing.lg,
  },
  label: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  durationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  durationButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  durationButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  durationButtonText: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
    color: colors.textSecondary,
  },
  durationButtonTextSelected: {
    color: colors.text,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  dateButtonText: {
    fontSize: typography.base,
    color: colors.text,
  },
  buttonContainer: {
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  errorText: {
    color: colors.error,
    fontSize: typography.sm,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxxl,
  },
  loadingText: {
    fontSize: typography.lg,
    fontWeight: typography.semibold,
    color: colors.text,
    marginTop: spacing.lg,
  },
  loadingSubtext: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  previewHeader: {
    marginBottom: spacing.lg,
  },
  previewTitle: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.text,
  },
  previewSubtitle: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  difficultyRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  calorieRange: {
    fontSize: typography.sm,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  calorieAdjust: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  adjustButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calorieValue: {
    fontSize: typography['2xl'],
    fontWeight: typography.bold,
    color: colors.text,
    minWidth: 80,
    textAlign: 'center',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  backButton: {
    flex: 1,
  },
  saveButton: {
    flex: 2,
  },
});
