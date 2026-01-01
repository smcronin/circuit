import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Button, ProgressBar } from '@/components/common';
import { colors, spacing, typography } from '@/theme';
import { useTimerStore, useHistoryStore } from '@/stores';
import { formatTime, isRestItem, getItemTypeLabel } from '@/utils';
import { soundManager } from '@/services/audio';

export default function TimerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    status,
    items,
    currentItemIndex,
    timeRemaining,
    totalElapsed,
    session,
    countdownValue,
    showCountdown,
    startCountdown,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    tick,
    skipToNext,
    goToPrevious,
    setCountdownValue,
    finishTransition,
    reset,
  } = useTimerStore();

  const addSession = useHistoryStore((state) => state.addSession);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const currentItem = items[currentItemIndex];
  const nextItem = items[currentItemIndex + 1];
  const itemAfterNext = items[currentItemIndex + 2];
  const nextIsRest = nextItem ? isRestItem(nextItem.type) : false;
  const progress = items.length > 0 ? (currentItemIndex + 1) / items.length : 0;
  const isRest = currentItem ? isRestItem(currentItem.type) : false;

  // Side-switching logic
  const hasSideSwitching = currentItem?.exercise?.switchSides ?? false;
  const exerciseDuration = currentItem?.duration ?? 0;
  const midpoint = Math.floor(exerciseDuration / 2);
  const isLeftSide = timeRemaining > midpoint;
  const currentSide = isLeftSide ? 'LEFT' : 'RIGHT';
  const prevTimeRef = useRef<number | null>(null);

  // Keep screen awake
  useEffect(() => {
    activateKeepAwakeAsync();
    return () => {
      deactivateKeepAwake();
    };
  }, []);

  // Start with countdown
  useEffect(() => {
    if (status === 'idle' && items.length > 0) {
      startCountdown();
    }
  }, []);

  // Countdown timer - plays 3, 2, 1, GO! (for both initial and transitions)
  useEffect(() => {
    if (status === 'countdown' || status === 'transition') {
      if (countdownValue > 0) {
        // Play distinct tone for each number (3, 2, 1)
        soundManager.playCountdownNumber(countdownValue);
        countdownRef.current = setTimeout(() => {
          setCountdownValue(countdownValue - 1);
        }, 1000);
      } else {
        // Play GO! sound then start
        soundManager.playGo();
        if (status === 'countdown') {
          startTimer();
        } else {
          finishTransition();
        }
      }
    }

    return () => {
      if (countdownRef.current) {
        clearTimeout(countdownRef.current);
      }
    };
  }, [status, countdownValue]);

  // Main timer
  useEffect(() => {
    if (status === 'running') {
      timerRef.current = setInterval(() => {
        tick();
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [status]);

  // Note: Sound on item change is now handled by the transition countdown

  // Warning sound at 3 seconds
  useEffect(() => {
    if (status === 'running' && timeRemaining === 3) {
      soundManager.playWarning();
    }
  }, [timeRemaining]);

  // Side switch sound - plays when crossing the midpoint
  useEffect(() => {
    if (status === 'running' && hasSideSwitching && prevTimeRef.current !== null) {
      const prevSideWasLeft = prevTimeRef.current > midpoint;
      const nowIsRight = timeRemaining <= midpoint && timeRemaining > 0;
      // Play switch sound exactly when crossing from left to right
      if (prevSideWasLeft && nowIsRight && timeRemaining === midpoint) {
        soundManager.playSideSwitch();
      }
    }
    prevTimeRef.current = timeRemaining;
  }, [timeRemaining, status, hasSideSwitching, midpoint]);

  // Pulse animation for countdown
  useEffect(() => {
    if (showCountdown) {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [countdownValue]);

  // Handle completion
  useEffect(() => {
    if (status === 'completed' && session) {
      soundManager.playWorkoutComplete();
      addSession(session);
      router.replace('/workout/complete');
    }
  }, [status]);

  const handlePauseResume = () => {
    if (status === 'running') {
      pauseTimer();
    } else if (status === 'paused') {
      resumeTimer();
    }
  };

  const handleStop = () => {
    Alert.alert(
      'End Workout',
      'Are you sure you want to end this workout early?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Workout',
          style: 'destructive',
          onPress: () => {
            stopTimer();
            if (session) {
              addSession({
                ...session,
                status: 'stopped_early',
                stoppedAt: new Date().toISOString(),
                completedItems: currentItemIndex,
                actualDurationWorked: totalElapsed,
                percentComplete: Math.round((currentItemIndex / items.length) * 100),
                estimatedCaloriesBurned: Math.round(
                  (session.workout.estimatedCalories * currentItemIndex) / items.length
                ),
              });
            }
            reset();
            router.replace('/(tabs)');
          },
        },
      ]
    );
  };

  const backgroundColor = isRest ? colors.timerRest : colors.timerActive;

  if (showCountdown && (status === 'countdown' || status === 'transition')) {
    const isTransition = status === 'transition';
    const upcomingItem = items[currentItemIndex];
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.countdownContainer}>
          <Text style={styles.getReady}>
            {isTransition ? 'NEXT UP' : 'GET READY'}
          </Text>
          <Animated.Text
            style={[styles.countdownNumber, { transform: [{ scale: pulseAnim }] }]}
          >
            {countdownValue || 'GO!'}
          </Animated.Text>
          <Text style={styles.firstExercise}>
            {isTransition ? upcomingItem?.name : `First up: ${items[0]?.name}`}
          </Text>
        </View>
      </View>
    );
  }

  if (!currentItem) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleStop} style={styles.closeButton}>
          <Ionicons name="close" size={28} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.progressInfo}>
          <Text style={styles.progressText}>
            {currentItemIndex + 1} / {items.length}
          </Text>
        </View>
        <View style={styles.closeButton} />
      </View>

      {/* Progress Bar */}
      <ProgressBar
        progress={progress}
        color={colors.text}
        backgroundColor="rgba(255,255,255,0.2)"
        height={4}
        style={styles.progressBar}
      />

      {/* Main Timer Display */}
      <View style={styles.timerContainer}>
        <Text style={styles.itemType}>{getItemTypeLabel(currentItem.type)}</Text>
        <Text style={styles.itemName}>{currentItem.name}</Text>
        {hasSideSwitching && (
          <Text style={styles.sideIndicator}>{currentSide} SIDE</Text>
        )}

        <Text style={styles.timerDisplay}>{formatTime(timeRemaining)}</Text>

        {currentItem.exercise?.targetReps && (
          <Text style={styles.repsTarget}>
            Target: {currentItem.exercise.targetReps} reps
          </Text>
        )}
        {currentItem.exercise?.repRange && (
          <Text style={styles.repsTarget}>
            Target: {currentItem.exercise.repRange} reps
          </Text>
        )}

        {currentItem.exercise?.description && (
          <Text style={styles.exerciseDescription} numberOfLines={4}>
            {currentItem.exercise.description}
          </Text>
        )}
      </View>

      {/* Up Next */}
      {nextItem && nextIsRest && itemAfterNext && (
        <View style={styles.upNext}>
          <Text style={styles.upNextLabel}>UP NEXT</Text>
          <Text style={styles.upNextName}>{nextItem.name} &bull; {itemAfterNext.name}</Text>
        </View>
      )}
      {nextItem && !nextIsRest && (
        <View style={styles.upNext}>
          <Text style={styles.upNextLabel}>UP NEXT</Text>
          <Text style={styles.upNextName}>{nextItem.name}</Text>
        </View>
      )}

      {/* Controls */}
      <View style={[styles.controls, { paddingBottom: insets.bottom + spacing.lg }]}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={goToPrevious}
          disabled={currentItemIndex === 0}
        >
          <Ionicons
            name="play-skip-back"
            size={28}
            color={currentItemIndex === 0 ? 'rgba(255,255,255,0.3)' : colors.text}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.mainControlButton}
          onPress={handlePauseResume}
        >
          <Ionicons
            name={status === 'running' ? 'pause' : 'play'}
            size={36}
            color={backgroundColor}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={skipToNext}
        >
          <Ionicons name="play-skip-forward" size={28} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Paused Overlay */}
      {status === 'paused' && (
        <View style={styles.pausedOverlay}>
          <Text style={styles.pausedText}>PAUSED</Text>
          <Text style={styles.pausedSubtext}>Tap play to resume</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressInfo: {
    alignItems: 'center',
  },
  progressText: {
    fontSize: typography.sm,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: typography.medium,
  },
  progressBar: {
    marginHorizontal: spacing.lg,
  },
  timerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  itemType: {
    fontSize: typography.sm,
    fontWeight: typography.bold,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  itemName: {
    fontSize: typography['3xl'],
    fontWeight: typography.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  sideIndicator: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: 'rgba(255,255,255,0.9)',
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    marginBottom: spacing.md,
    letterSpacing: 2,
    overflow: 'hidden',
  },
  timerDisplay: {
    fontSize: typography['7xl'],
    fontWeight: typography.bold,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  repsTarget: {
    fontSize: typography.lg,
    color: 'rgba(255,255,255,0.8)',
    marginTop: spacing.md,
  },
  exerciseDescription: {
    fontSize: typography.base,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    lineHeight: 22,
  },
  upNext: {
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  upNextLabel: {
    fontSize: typography.xs,
    fontWeight: typography.bold,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  upNextName: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.text,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    padding: spacing.lg,
    zIndex: 10,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainControlButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  getReady: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.textSecondary,
    letterSpacing: 2,
    marginBottom: spacing.xl,
  },
  countdownNumber: {
    fontSize: 120,
    fontWeight: typography.bold,
    color: colors.primary,
  },
  firstExercise: {
    fontSize: typography.lg,
    color: colors.textSecondary,
    marginTop: spacing.xxl,
  },
  pausedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  pausedText: {
    fontSize: typography['4xl'],
    fontWeight: typography.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  pausedSubtext: {
    fontSize: typography.base,
    color: colors.textSecondary,
  },
});
