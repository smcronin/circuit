import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card } from '@/components/common';
import { CircuitLogo } from '@/components/CircuitLogo';
import { ProgrammedWorkoutsCard } from '@/components/home/ProgrammedWorkoutsCard';
import { colors, fonts, spacing, typography, borderRadius } from '@/theme';
import { useWorkoutStore, useHistoryStore } from '@/stores';
import { flattenWorkout } from '@/utils';
import { getLocalDateKey, getProgrammedWorkoutsForHome } from '@/data/programmedWorkouts';
import type { ProgrammedWorkout } from '@/data/programmedWorkouts';
import type { WorkoutSession } from '@/types/workout';

function completedSessionDateKey(session: WorkoutSession): string | null {
  if (!session.completedAt) {
    return null;
  }

  const completedAt = new Date(session.completedAt);
  if (Number.isNaN(completedAt.getTime())) {
    return null;
  }

  return getLocalDateKey(completedAt);
}

/**
 * Home is a launcher: today's program, then the two ways to start something —
 * generate a circuit, or record a GPS workout. The generator's controls live
 * on /workout/generate now.
 */
export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Field selectors, not the whole store: home stays mounted beneath the
  // pushed generator screen, and a whole-store subscription would re-render it
  // (and re-scan the program table below) on every keystroke typed there.
  const setCurrentWorkout = useWorkoutStore((state) => state.setCurrentWorkout);
  const setFlattenedWorkout = useWorkoutStore((state) => state.setFlattenedWorkout);
  const historySessions = useHistoryStore((state) => state.history.sessions);

  // The program schedule only changes with the date; computing it per render
  // hands a fresh array identity to every memo below.
  const programmedHome = useMemo(() => getProgrammedWorkoutsForHome(), []);
  const completedProgrammedWorkoutIds = useMemo(() => {
    if (!programmedHome?.isToday) {
      return new Set<string>();
    }

    const completedIds = new Set<string>();

    programmedHome.workouts.forEach((programmedWorkout) => {
      const hasCompletedSession = historySessions.some((session) => {
        if (session.status !== 'completed') {
          return false;
        }

        if (completedSessionDateKey(session) !== programmedWorkout.date) {
          return false;
        }

        return (
          session.workoutId === programmedWorkout.workout.id ||
          session.workout.id === programmedWorkout.workout.id ||
          session.workout.name === programmedWorkout.workout.name
        );
      });

      if (hasCompletedSession) {
        completedIds.add(programmedWorkout.id);
      }
    });

    return completedIds;
  }, [historySessions, programmedHome]);

  // Today's next unfinished programmed workout — the footer's primary action.
  const pendingProgrammedWorkout = useMemo(() => {
    if (!programmedHome?.isToday) return undefined;
    return programmedHome.workouts.find(
      (programmedWorkout) => !completedProgrammedWorkoutIds.has(programmedWorkout.id)
    );
  }, [programmedHome, completedProgrammedWorkoutIds]);

  const handleOpenProgrammedWorkout = useCallback(
    (programmedWorkout: ProgrammedWorkout) => {
      const workout = programmedWorkout.workout;

      // Recorded-activity days go to the GPS recorder, not the circuit timer.
      if (workout.activityType) {
        router.push({
          pathname: '/workout/ride',
          params: { programId: programmedWorkout.id },
        });
        return;
      }

      setCurrentWorkout(workout);
      setFlattenedWorkout(flattenWorkout(workout));
      router.push('/workout/review');
    },
    [router, setCurrentWorkout, setFlattenedWorkout]
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <CircuitLogo size={52} />
            <View>
              <Text style={styles.appName}>Circuit</Text>
              <Text style={styles.subtitle}>
                {new Date()
                  .toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
                  .toUpperCase()}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <Ionicons name="person-circle-outline" size={32} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {programmedHome && (
          <ProgrammedWorkoutsCard
            title={programmedHome.title}
            dateLabel={programmedHome.dateLabel}
            isToday={programmedHome.isToday}
            workouts={programmedHome.workouts}
            completedWorkoutIds={completedProgrammedWorkoutIds}
            onSelectWorkout={handleOpenProgrammedWorkout}
          />
        )}

        <ActionCard
          icon="flash"
          iconColor={colors.primary}
          title="Generate Workout"
          subtitle="An AI-built circuit for your equipment, time, and goals"
          onPress={() => router.push('/workout/generate')}
        />

        <ActionCard
          icon="navigate"
          iconColor={colors.success}
          title="Record Workout"
          subtitle="Track a ride, run, walk, or hike with your phone's GPS"
          onPress={() => router.push('/workout/ride')}
        />
      </ScrollView>

      {pendingProgrammedWorkout && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Button
            title="Start Today's Program"
            onPress={() => handleOpenProgrammedWorkout(pendingProgrammedWorkout)}
            size="lg"
            fullWidth
            icon={<Ionicons name="play" size={20} color={colors.text} />}
          />
        </View>
      )}
    </View>
  );
}

interface ActionCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}

function ActionCard({ icon, iconColor, title, subtitle, onPress }: ActionCardProps) {
  return (
    <Card onPress={onPress} style={styles.actionCard}>
      <View style={styles.actionRow}>
        <View style={[styles.actionIcon, { backgroundColor: iconColor + '1F' }]}>
          <Ionicons name={icon} size={26} color={iconColor} />
        </View>
        <View style={styles.actionCopy}>
          <Text style={styles.actionTitle}>{title}</Text>
          <Text style={styles.actionSubtitle}>{subtitle}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>
    </Card>
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
    marginBottom: spacing.lg,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  appName: {
    fontFamily: fonts.displayBlack,
    fontSize: 30,
    lineHeight: 32,
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: typography.semibold,
    color: colors.primaryLight,
    letterSpacing: 1.5,
  },
  profileButton: {
    padding: 4,
  },
  actionCard: {
    marginTop: spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCopy: {
    flex: 1,
    gap: 2,
  },
  actionTitle: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typography.xl,
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  actionSubtitle: {
    fontSize: typography.xs,
    color: colors.textMuted,
    lineHeight: 17,
  },
  footer: {
    padding: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    backgroundColor: colors.background,
  },
});
