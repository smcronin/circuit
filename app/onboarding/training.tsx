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
import { useUserStore } from '@/stores';

const ABILITY_SUGGESTIONS = [
  'Pistol squats',
  'Handstand pushups',
  'One-arm pushups',
  'Muscle-ups',
  'Ring dips',
  'L-sits',
  'Pull-ups (10+)',
  'Dips (10+)',
  'Box jumps',
  'Double unders',
];

const PREFERENCE_SUGGESTIONS = [
  'Prefer compound movements',
  'Like HIIT/circuits',
  'Focus on form over speed',
  'Minimal jumping',
  'No burpees please',
  'Love core work',
];

export default function OnboardingTraining() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const updateProfile = useUserStore((state) => state.updateProfile);
  const profile = useUserStore((state) => state.profile);

  const [selectedAbilities, setSelectedAbilities] = useState<string[]>([]);
  const [selectedPreferences, setSelectedPreferences] = useState<string[]>([]);
  const [customNotes, setCustomNotes] = useState('');

  const toggleAbility = (ability: string) => {
    if (selectedAbilities.includes(ability)) {
      setSelectedAbilities(selectedAbilities.filter((a) => a !== ability));
    } else {
      setSelectedAbilities([...selectedAbilities, ability]);
    }
  };

  const togglePreference = (preference: string) => {
    if (selectedPreferences.includes(preference)) {
      setSelectedPreferences(selectedPreferences.filter((p) => p !== preference));
    } else {
      setSelectedPreferences([...selectedPreferences, preference]);
    }
  };

  const handleNext = () => {
    const notes = [
      selectedAbilities.length > 0 ? `Can do: ${selectedAbilities.join(', ')}` : null,
      selectedPreferences.length > 0 ? `Preferences: ${selectedPreferences.join(', ')}` : null,
      customNotes.trim() || null,
    ]
      .filter(Boolean)
      .join('. ');

    updateProfile({
      trainingNotes: notes || undefined,
    });

    router.push('/onboarding/equipment');
  };

  const handleSkip = () => {
    router.push('/onboarding/equipment');
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          style={styles.scrollView}
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
            <View style={styles.progressDot} />
            <View style={styles.progressDot} />
          </View>
        </View>

        <Text style={styles.title}>Tell us about{'\n'}your training</Text>
        <Text style={styles.subtitle}>
          This helps us tailor workouts to your skill level. Select any that apply.
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Advanced moves I can do</Text>
          <View style={styles.chips}>
            {ABILITY_SUGGESTIONS.map((ability) => (
              <TouchableOpacity
                key={ability}
                style={[
                  styles.chip,
                  selectedAbilities.includes(ability) && styles.chipSelected,
                ]}
                onPress={() => toggleAbility(ability)}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedAbilities.includes(ability) && styles.chipTextSelected,
                  ]}
                >
                  {ability}
                </Text>
                {selectedAbilities.includes(ability) && (
                  <Ionicons name="checkmark" size={16} color={colors.text} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Training preferences</Text>
          <View style={styles.chips}>
            {PREFERENCE_SUGGESTIONS.map((preference) => (
              <TouchableOpacity
                key={preference}
                style={[
                  styles.chip,
                  selectedPreferences.includes(preference) && styles.chipSelected,
                ]}
                onPress={() => togglePreference(preference)}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedPreferences.includes(preference) && styles.chipTextSelected,
                  ]}
                >
                  {preference}
                </Text>
                {selectedPreferences.includes(preference) && (
                  <Ionicons name="checkmark" size={16} color={colors.text} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Input
          label="Anything else?"
          placeholder="e.g., Bad left knee - avoid deep lunges. Currently rehabbing shoulder..."
          value={customNotes}
          onChangeText={setCustomNotes}
          multiline
          numberOfLines={3}
          containerStyle={styles.input}
        />
        </ScrollView>
      </TouchableWithoutFeedback>

      <View style={styles.footer}>
        <Button title="Continue" onPress={handleNext} size="lg" fullWidth />
        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
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
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
  chipTextSelected: {
    color: colors.text,
  },
  input: {
    marginBottom: spacing.xl,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
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
