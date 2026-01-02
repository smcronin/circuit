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
import { Button, Input } from '@/components/common';
import { colors, spacing, typography, borderRadius } from '@/theme';
import { GOAL_SUGGESTIONS } from '@/utils/constants';
import { useUserStore } from '@/stores';

export default function EditGoalsModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const updateProfile = useUserStore((state) => state.updateProfile);
  const profile = useUserStore((state) => state.profile);

  // Parse existing goals to determine which suggestions are selected
  const parseExistingGoals = () => {
    const existingGoals = profile?.fitnessGoals || '';
    const selected: string[] = [];
    let customText = existingGoals;

    GOAL_SUGGESTIONS.forEach((suggestion) => {
      if (existingGoals.includes(suggestion)) {
        selected.push(suggestion);
        customText = customText.replace(suggestion, '').replace(/\.\s*/g, ' ').trim();
      }
    });

    return { selected, customText: customText.trim() };
  };

  const { selected: initialSelected, customText: initialCustom } = parseExistingGoals();
  const [goals, setGoals] = useState(initialCustom);
  const [selectedSuggestions, setSelectedSuggestions] = useState<string[]>(initialSelected);

  const toggleSuggestion = (suggestion: string) => {
    if (selectedSuggestions.includes(suggestion)) {
      setSelectedSuggestions(selectedSuggestions.filter((s) => s !== suggestion));
    } else {
      setSelectedSuggestions([...selectedSuggestions, suggestion]);
    }
  };

  const handleSave = () => {
    const combinedGoals = [
      ...selectedSuggestions,
      goals.trim() ? goals.trim() : null,
    ]
      .filter(Boolean)
      .join('. ');

    updateProfile({
      fitnessGoals: combinedGoals || 'General fitness',
    });

    router.back();
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        {/* Modal Handle */}
        <View style={styles.handleContainer}>
          <View style={styles.handle} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Goals</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
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
            numberOfLines={3}
            blurOnSubmit={true}
            containerStyle={styles.input}
          />
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title="Save Changes"
            onPress={handleSave}
            size="lg"
            fullWidth
            disabled={selectedSuggestions.length === 0 && !goals.trim()}
          />
        </View>
      </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.text,
  },
  headerSpacer: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
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
