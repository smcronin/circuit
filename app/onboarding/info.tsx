import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input } from '@/components/common';
import { colors, spacing, typography, borderRadius } from '@/theme';
import { DURATION_OPTIONS } from '@/utils/constants';
import { useUserStore } from '@/stores';

export default function OnboardingInfo() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const updateProfile = useUserStore((state) => state.updateProfile);
  const completeOnboarding = useUserStore((state) => state.completeOnboarding);
  const profile = useUserStore((state) => state.profile);

  const [age, setAge] = useState(profile?.age?.toString() || '');
  const [weight, setWeight] = useState(profile?.weight?.toString() || '');
  const [weightUnit, setWeightUnit] = useState<'lbs' | 'kg'>(profile?.weightUnit || 'lbs');
  const [preferredDuration, setPreferredDuration] = useState(
    profile?.preferredWorkoutDuration || 30
  );

  const handleComplete = () => {
    updateProfile({
      age: age ? parseInt(age, 10) : undefined,
      weight: weight ? parseFloat(weight) : undefined,
      weightUnit,
      preferredWorkoutDuration: preferredDuration,
    });

    completeOnboarding();
    router.replace('/(tabs)');
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
          keyboardShouldPersistTaps="handled"
        >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.progress}>
            <View style={[styles.progressDot, styles.progressDotActive]} />
            <View style={[styles.progressDot, styles.progressDotActive]} />
            <View style={[styles.progressDot, styles.progressDotActive]} />
            <View style={[styles.progressDot, styles.progressDotActive]} />
          </View>
        </View>

        <Text style={styles.title}>Almost there!</Text>
        <Text style={styles.subtitle}>
          Help us personalize your experience. All fields are optional.
        </Text>

        <View style={styles.form}>
          <Input
            label="Age"
            placeholder="Enter your age"
            value={age}
            onChangeText={(text) => setAge(text.replace(/[^0-9]/g, ''))}
            keyboardType="numeric"
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
              containerStyle={styles.inputContainer}
          />

          <View style={styles.weightRow}>
            <View style={styles.weightInput}>
              <Input
                label="Weight"
                placeholder="Enter weight"
                value={weight}
                onChangeText={(text) => setWeight(text.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"

                returnKeyType="done"

                onSubmitEditing={Keyboard.dismiss}

              />
            </View>
            <View style={styles.unitToggle}>
              <Text style={styles.unitLabel}>Unit</Text>
              <View style={styles.unitButtons}>
                <TouchableOpacity
                  style={[styles.unitButton, weightUnit === 'lbs' && styles.unitButtonActive]}
                  onPress={() => setWeightUnit('lbs')}
                >
                  <Text
                    style={[styles.unitText, weightUnit === 'lbs' && styles.unitTextActive]}
                  >
                    lbs
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.unitButton, weightUnit === 'kg' && styles.unitButtonActive]}
                  onPress={() => setWeightUnit('kg')}
                >
                  <Text
                    style={[styles.unitText, weightUnit === 'kg' && styles.unitTextActive]}
                  >
                    kg
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.durationSection}>
            <Text style={styles.durationLabel}>Preferred workout duration</Text>
            <View style={styles.durationGrid}>
              {DURATION_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.durationOption,
                    preferredDuration === option.value && styles.durationOptionSelected,
                  ]}
                  onPress={() => setPreferredDuration(option.value)}
                >
                  <Text
                    style={[
                      styles.durationValue,
                      preferredDuration === option.value && styles.durationValueSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                  <Text
                    style={[
                      styles.durationDesc,
                      preferredDuration === option.value && styles.durationDescSelected,
                    ]}
                  >
                    {option.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

          <View style={[styles.footer, { paddingBottom: insets.bottom || spacing.lg }]}>
            <Button title="Start Training" onPress={handleComplete} size="lg" fullWidth />
            <TouchableOpacity onPress={handleComplete} style={styles.skipButton}>
              <Text style={styles.skipText}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
    flexGrow: 1,
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  backButton: {
    padding: spacing.sm,
    marginLeft: -spacing.sm,
  },
  progress: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceLight,
  },
  progressDotActive: {
    backgroundColor: colors.primary,
  },
  title: {
    fontSize: typography['3xl'],
    fontWeight: typography.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.base,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
  form: {
    gap: spacing.lg,
    flex: 1,
  },
  inputContainer: {
    marginBottom: 0,
  },
  weightRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  weightInput: {
    flex: 1,
  },
  unitToggle: {
    width: 100,
  },
  unitLabel: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  unitButtons: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  unitButton: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  unitButtonActive: {
    backgroundColor: colors.primary,
  },
  unitText: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.textSecondary,
  },
  unitTextActive: {
    color: colors.text,
  },
  durationSection: {
    marginTop: spacing.md,
  },
  durationLabel: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  durationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  durationOption: {
    width: '31%',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  durationOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  durationValue: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.text,
  },
  durationValueSelected: {
    color: colors.text,
  },
  durationDesc: {
    fontSize: typography.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  durationDescSelected: {
    color: colors.text,
    opacity: 0.8,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  skipText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
});

