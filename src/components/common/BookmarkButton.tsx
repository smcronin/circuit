import React from 'react';
import { StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSavedWorkoutsStore } from '@/stores/useSavedWorkoutsStore';
import { borderRadius, colors, fonts, spacing, typography } from '@/theme';
import type { GeneratedWorkout } from '@/types/workout';

interface BookmarkButtonProps {
  workout: GeneratedWorkout;
  style?: ViewStyle;
}

export function BookmarkButton({ workout, style }: BookmarkButtonProps) {
  const isSaved = useSavedWorkoutsStore((state) =>
    state.savedWorkouts.some((saved) => saved.workout.id === workout.id)
  );
  const toggleWorkout = useSavedWorkoutsStore((state) => state.toggleWorkout);

  return (
    <TouchableOpacity
      style={[styles.button, isSaved && styles.buttonSaved, style]}
      onPress={() => toggleWorkout(workout)}
      activeOpacity={0.72}
      accessibilityRole="button"
      accessibilityLabel={isSaved ? 'Remove workout from saved workouts' : 'Save workout'}
      accessibilityState={{ selected: isSaved }}
    >
      <Ionicons
        name={isSaved ? 'bookmark' : 'bookmark-outline'}
        size={18}
        color={isSaved ? colors.primaryLight : colors.textSecondary}
      />
      <Text style={[styles.label, isSaved && styles.labelSaved]}>
        {isSaved ? 'Saved' : 'Save'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  buttonSaved: {
    borderColor: colors.primary + '80',
    backgroundColor: colors.primary + '1F',
  },
  label: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typography.sm,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  labelSaved: {
    color: colors.primaryLight,
  },
});
