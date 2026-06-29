import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Chip } from '@/components/common';
import type { ProgrammedWorkout } from '@/data/programmedWorkouts';
import { colors, spacing, typography, borderRadius } from '@/theme';
import { formatDuration } from '@/utils';

interface ProgrammedWorkoutsCardProps {
  title: string;
  dateLabel: string;
  isToday: boolean;
  workouts: ProgrammedWorkout[];
  completedWorkoutIds?: Set<string>;
  onSelectWorkout: (programmedWorkout: ProgrammedWorkout) => void;
}

export function ProgrammedWorkoutsCard({
  title,
  dateLabel,
  isToday,
  workouts,
  completedWorkoutIds,
  onSelectWorkout,
}: ProgrammedWorkoutsCardProps) {
  const allWorkoutsCompleted =
    isToday &&
    workouts.length > 0 &&
    workouts.every((programmedWorkout) => completedWorkoutIds?.has(programmedWorkout.id));

  return (
    <Card
      padding={allWorkoutsCompleted ? 'sm' : 'md'}
      style={allWorkoutsCompleted ? styles.completedCard : styles.card}
    >
      <View style={[styles.header, allWorkoutsCompleted && styles.compactHeader]}>
        <View style={allWorkoutsCompleted ? styles.completedIconBox : styles.iconBox}>
          <Ionicons
            name={allWorkoutsCompleted ? 'checkmark-circle' : 'calendar-outline'}
            size={20}
            color={allWorkoutsCompleted ? colors.success : colors.primary}
          />
        </View>
        <View style={styles.headerText}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, allWorkoutsCompleted && styles.compactTitle]}>
              {title}
            </Text>
            {!allWorkoutsCompleted && (
              <View style={[styles.statusPill, isToday ? styles.todayPill : styles.nextPill]}>
                <Text style={styles.statusPillText}>{isToday ? 'Today' : 'Upcoming'}</Text>
              </View>
            )}
          </View>
          <Text style={styles.dateLabel}>{dateLabel}</Text>
        </View>
      </View>

      <View style={allWorkoutsCompleted ? styles.compactWorkoutList : styles.workoutList}>
        {workouts.map((programmedWorkout, index) => {
          const workout = programmedWorkout.workout;
          const focusAreas = workout.focusAreas.slice(0, 3);
          const isCompleted = completedWorkoutIds?.has(programmedWorkout.id) ?? false;

          if (isCompleted) {
            return (
              <TouchableOpacity
                key={programmedWorkout.id}
                style={[
                  styles.compactWorkoutRow,
                  index > 0 && styles.compactWorkoutRowBorder,
                ]}
                activeOpacity={0.75}
                onPress={() => onSelectWorkout(programmedWorkout)}
              >
                <View style={styles.compactWorkoutContent}>
                  <View style={styles.compactWorkoutTitleArea}>
                    {!allWorkoutsCompleted && (
                      <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                    )}
                    <Text style={styles.compactSlot}>{programmedWorkout.slot}</Text>
                    <Text style={styles.compactWorkoutName} numberOfLines={1}>
                      {workout.name}
                    </Text>
                  </View>
                  <View style={styles.compactRedo}>
                    <Text style={styles.compactRedoText}>Redo</Text>
                    <Ionicons name="chevron-forward" size={17} color={colors.successLight} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={programmedWorkout.id}
              style={[styles.workoutRow, index > 0 && styles.workoutRowBorder]}
              activeOpacity={0.75}
              onPress={() => onSelectWorkout(programmedWorkout)}
            >
              <View style={styles.workoutHeader}>
                <Chip label={programmedWorkout.slot} size="sm" selected />
                <View style={styles.duration}>
                  <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                  <Text style={styles.durationText}>{formatDuration(workout.actualDuration)}</Text>
                </View>
              </View>

              <Text style={styles.workoutName} numberOfLines={1}>
                {workout.name}
              </Text>
              <Text style={styles.workoutDescription} numberOfLines={2}>
                {workout.description}
              </Text>

              <View style={styles.focusRow}>
                {focusAreas.map((area) => (
                  <Text key={area} style={styles.focusText} numberOfLines={1}>
                    {area}
                  </Text>
                ))}
              </View>

              <View style={styles.coachRow}>
                <Ionicons name="sparkles-outline" size={14} color={colors.accent} />
                <Text style={styles.coachNotes} numberOfLines={2}>
                  {programmedWorkout.coachNotes}
                </Text>
              </View>

              <View style={styles.openRow}>
                <Text style={styles.openText}>Open workout</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.primary} />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primaryDark,
  },
  completedCard: {
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.success,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  compactHeader: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedIconBox: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.md,
    backgroundColor: colors.success + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: typography.lg,
    fontWeight: typography.semibold,
    color: colors.text,
  },
  compactTitle: {
    fontSize: typography.base,
  },
  statusPill: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  todayPill: {
    backgroundColor: colors.success + '25',
  },
  nextPill: {
    backgroundColor: colors.surfaceLight,
  },
  statusPillText: {
    fontSize: typography.xs,
    fontWeight: typography.semibold,
    color: colors.textSecondary,
  },
  dateLabel: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  workoutList: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  compactWorkoutList: {
    borderTopWidth: 1,
    borderTopColor: colors.success + '30',
    paddingTop: spacing.xs,
  },
  workoutRow: {
    paddingTop: spacing.md,
  },
  workoutRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.md,
  },
  compactWorkoutRow: {
    paddingVertical: spacing.xs,
  },
  compactWorkoutRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
  },
  compactWorkoutContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  compactWorkoutTitleArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 0,
  },
  compactSlot: {
    flexShrink: 0,
    fontSize: typography.xs,
    fontWeight: typography.semibold,
    color: colors.successLight,
    backgroundColor: colors.success + '20',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  compactWorkoutName: {
    flex: 1,
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.text,
  },
  compactRedo: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  compactRedoText: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.successLight,
  },
  workoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  duration: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  durationText: {
    fontSize: typography.xs,
    color: colors.textMuted,
    fontWeight: typography.medium,
  },
  workoutName: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  workoutDescription: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  focusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  focusText: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    overflow: 'hidden',
    maxWidth: '45%',
  },
  coachRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  coachNotes: {
    flex: 1,
    fontSize: typography.xs,
    color: colors.textMuted,
    lineHeight: 18,
  },
  openRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
  },
  openText: {
    fontSize: typography.sm,
    color: colors.primary,
    fontWeight: typography.semibold,
  },
});
