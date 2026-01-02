import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input } from '@/components/common';
import { colors, spacing, typography, borderRadius } from '@/theme';
import { GOAL_SUGGESTIONS } from '@/utils/constants';
import { useUserStore } from '@/stores';
import { v4 as uuid } from 'uuid';

export default function OnboardingGoals() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setProfile = useUserStore((state) => state.setProfile);
  const updateProfile = useUserStore((state) => state.updateProfile);
  const profile = useUserStore((state) => state.profile);

  const [goals, setGoals] = useState(profile?.fitnessGoals || '');
  const [selectedSuggestions, setSelectedSuggestions] = useState<string[]>([]);

  const toggleSuggestion = (suggestion: string) => {
    if (selectedSuggestions.includes(suggestion)) {
      setSelectedSuggestions(selectedSuggestions.filter((s) => s !== suggestion));
    } else {
      setSelectedSuggestions([...selectedSuggestions, suggestion]);
    }
  };

  const handleNext = () => {
    const combinedGoals = [
      ...selectedSuggestions,
      goals.trim() ? goals.trim() : null,
    ]
      .filter(Boolean)
      .join('. ');

    // If no profile exists, create one. Otherwise just update goals.
    if (!profile) {
      setProfile({
        id: uuid(),
        createdAt: new Date().toISOString(),
        fitnessGoals: combinedGoals || 'General fitness',
        equipmentSets: [],
        preferredWorkoutDuration: 30,
        weightUnit: 'lbs',
        hasCompletedOnboarding: false,
      });
    } else {
      updateProfile({
        fitnessGoals: combinedGoals || 'General fitness',
      });
    }

    router.push('/onboarding/training');
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.progress}>
            <View style={[styles.progressDot, styles.progressDotActive]} />
            <View style={styles.progressDot} />
            <View style={styles.progressDot} />
            <View style={styles.progressDot} />
          </View>
        </View>

        <Text style={styles.title}>What are your{'\n'}fitness goals?</Text>
        <Text style={styles.subtitle}>
          Select what applies or write your own. This helps us create better workouts for you.
        </Text>

        <View style={styles.suggestions}>
          {GOAL_SUGGESTIONS.map((suggestion) => (
            <TouchableOpacity
              key={suggestion}
              style={[
                styles.suggestionChip,
                selectedSuggestions.includes(suggestion) && styles.suggestionChipSelected,
              ]}
              onPress={() => toggleSuggestion(suggestion)}
            >
              <Text
                style={[
                  styles.suggestionText,
                  selectedSuggestions.includes(suggestion) && styles.suggestionTextSelected,
                ]}
              >
                {suggestion}
              </Text>
              {selectedSuggestions.includes(suggestion) && (
                <Ionicons name="checkmark" size={18} color={colors.text} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        <Input
          label="Or describe your goals"
          placeholder="e.g., Train for a 5K, recover from knee surgery..."
          value={goals}
          onChangeText={setGoals}
          multiline
          containerStyle={styles.input}
        />
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="Continue"
          onPress={handleNext}
          size="lg"
          fullWidth
          disabled={selectedSuggestions.length === 0 && !goals.trim()}
        />
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
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  suggestionChip: {
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
  suggestionChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  suggestionText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
  suggestionTextSelected: {
    color: colors.text,
  },
  input: {
    marginBottom: spacing.xl,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
