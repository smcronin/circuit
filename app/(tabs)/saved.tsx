import React, { useCallback } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSavedWorkoutsStore, useWorkoutStore } from '@/stores';
import type { SavedWorkout } from '@/stores';
import { borderRadius, colors, fonts, spacing, typography } from '@/theme';
import { flattenWorkout, formatDuration } from '@/utils';

function getSavedWorkoutVisual(workoutId: string): {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  backgroundColor: string;
} {
  if (workoutId === 'saved-morning-mobility-5') {
    return {
      icon: 'sunny-outline',
      color: colors.warning,
      backgroundColor: colors.warning + '18',
    };
  }

  if (workoutId === 'saved-jump-rope-snack-10') {
    return {
      icon: 'pulse-outline',
      color: colors.accent,
      backgroundColor: colors.accent + '18',
    };
  }

  return {
    icon: 'flash',
    color: colors.primaryLight,
    backgroundColor: colors.primary + '18',
  };
}

export default function SavedWorkoutsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const savedWorkouts = useSavedWorkoutsStore((state) => state.savedWorkouts);
  const removeWorkout = useSavedWorkoutsStore((state) => state.removeWorkout);
  const { setCurrentWorkout, setFlattenedWorkout } = useWorkoutStore();

  const handleOpen = useCallback(
    (savedWorkout: SavedWorkout) => {
      setCurrentWorkout(savedWorkout.workout);
      setFlattenedWorkout(flattenWorkout(savedWorkout.workout));
      router.push('/workout/review');
    },
    [router, setCurrentWorkout, setFlattenedWorkout]
  );

  const renderItem = useCallback(
    ({ item }: { item: SavedWorkout }) => {
      const { workout } = item;
      const visual = getSavedWorkoutVisual(workout.id);
      const movementCount =
        workout.warmUp.exercises.length +
        workout.coolDown.exercises.length +
        workout.circuits.reduce(
          (total, circuit) => total + circuit.exercises.length * circuit.rounds,
          0
        );

      return (
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.cardPressArea}
            onPress={() => handleOpen(item)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={`Open ${workout.name}`}
          >
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleArea}>
                <View style={[styles.cardIcon, { backgroundColor: visual.backgroundColor }]}>
                  <Ionicons name={visual.icon} size={20} color={visual.color} />
                </View>
                <View style={styles.cardHeading}>
                  <Text style={styles.cardName} numberOfLines={2}>
                    {workout.name}
                  </Text>
                  <Text style={styles.cardDescription} numberOfLines={2}>
                    {workout.description}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                <Text style={styles.metaText}>{formatDuration(workout.actualDuration)}</Text>
              </View>
              <View style={styles.metaDot} />
              <Text style={styles.metaText}>{movementCount} moves</Text>
              <View style={styles.metaDot} />
              <Text style={styles.metaText}>{workout.difficulty}</Text>
            </View>

            <View style={styles.focusRow}>
              {workout.focusAreas.slice(0, 3).map((area) => (
                <View key={area} style={styles.focusPill}>
                  <Text style={styles.focusText}>{area}</Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => removeWorkout(workout.id)}
            activeOpacity={0.72}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${workout.name} from saved workouts`}
          >
            <Ionicons name="bookmark" size={21} color={colors.primaryLight} />
          </TouchableOpacity>
        </View>
      );
    },
    [handleOpen, removeWorkout]
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={savedWorkouts}
        keyExtractor={(item) => item.workout.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.list,
          { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xxl },
          savedWorkouts.length === 0 && styles.emptyList,
        ]}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="bookmark" size={22} color={colors.primaryLight} />
            </View>
            <View>
              <Text style={styles.title}>Saved</Text>
              <Text style={styles.subtitle}>Your quick-access workout library</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="bookmark-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Nothing saved yet</Text>
            <Text style={styles.emptyText}>
              Use the bookmark on any workout review or completion screen.
            </Text>
            <TouchableOpacity
              style={styles.emptyAction}
              onPress={() => router.push('/(tabs)')}
              activeOpacity={0.72}
            >
              <Ionicons name="flash" size={16} color={colors.primaryLight} />
              <Text style={styles.emptyActionText}>Find a workout</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    gap: spacing.md,
  },
  emptyList: {
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary + '20',
    borderWidth: 1,
    borderColor: colors.primary + '45',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fonts.displayBlack,
    fontSize: 30,
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: typography.xs,
    fontWeight: typography.semibold,
    color: colors.primaryLight,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: 2,
  },
  card: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  cardPressArea: {
    padding: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingRight: 44,
  },
  cardTitleArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    minWidth: 0,
  },
  cardIcon: {
    width: 38,
    height: 38,
    flexShrink: 0,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeading: {
    flex: 1,
    minWidth: 0,
  },
  cardName: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typography.xl,
    lineHeight: 23,
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  cardDescription: {
    fontSize: typography.xs,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  removeButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    zIndex: 1,
    width: 36,
    height: 36,
    flexShrink: 0,
    borderRadius: 18,
    backgroundColor: colors.primary + '1C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.textMuted,
  },
  metaText: {
    fontSize: typography.xs,
    color: colors.textMuted,
    textTransform: 'capitalize',
  },
  focusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  focusPill: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceLight,
  },
  focusText: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  emptyTitle: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typography.xl,
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: spacing.md,
  },
  emptyText: {
    maxWidth: 300,
    fontSize: typography.sm,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  emptyAction: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary + '70',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  emptyActionText: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typography.sm,
    color: colors.primaryLight,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
