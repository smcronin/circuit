import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Animated,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Button, SegmentedProgressBar, MarqueeText, VerticalAutoScroll } from '@/components/common';
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
    justCompletedItem,
    startCountdown,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    tick,
    skipToNext,
    goToPrevious,
    setCountdownValue,
    clearJustCompletedItem,
    reset,
  } = useTimerStore();

  const addSession = useHistoryStore((state) => state.addSession);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const currentItem = items[currentItemIndex];
  const nextItem = items[currentItemIndex + 1];
  const itemAfterNext = items[currentItemIndex + 2];
  const nextIsRest = nextItem ? isRestItem(nextItem.type) : false;
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

  // Initial countdown timer - plays 3, 2, 1, GO! before workout starts
  useEffect(() => {
    if (status === 'countdown') {
      if (countdownValue > 0) {
        // Play distinct tone for each number (3, 2, 1)
        soundManager.playCountdownNumber(countdownValue);
        countdownRef.current = setTimeout(() => {
          setCountdownValue(countdownValue - 1);
        }, 1000);
      } else {
        // Play GO! sound then start
        soundManager.playGo();
        startTimer();
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

  // Halfway warning tone (work only, not rests)
  // Only play if the midpoint is > 3 to avoid overlap with the ending countdown
  useEffect(() => {
    if (status === 'running' && !isRest && currentItem) {
      const itemMidpoint = Math.floor(currentItem.duration / 2);
      if (timeRemaining === itemMidpoint && itemMidpoint > 3) {
        soundManager.playWarning();
      }
    }
  }, [timeRemaining, status, isRest, currentItem]);

  // Countdown sounds during last 3 seconds of each item
  useEffect(() => {
    if (status === 'running' && timeRemaining <= 3 && timeRemaining >= 1) {
      soundManager.playCountdownNumber(timeRemaining);
    }
  }, [timeRemaining, status]);

  // GO sound when an item completes naturally
  useEffect(() => {
    if (justCompletedItem) {
      soundManager.playGo();
      clearJustCompletedItem();
    }
  }, [justCompletedItem, clearJustCompletedItem]);

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

  // Pulse animation for countdown (both initial and ending countdown)
  const isEndingCountdownActive = status === 'running' && timeRemaining <= 3 && timeRemaining >= 1;
  useEffect(() => {
    if (showCountdown || isEndingCountdownActive) {
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
  }, [countdownValue, timeRemaining, isEndingCountdownActive]);

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

  // Show countdown overlay: during initial countdown OR during last 3 seconds of any item
  const isEndingCountdown = status === 'running' && timeRemaining <= 3 && timeRemaining >= 1;
  const isInitialCountdown = showCountdown && status === 'countdown';

  if (isInitialCountdown || isEndingCountdown) {
    const upcomingItem = nextItem;
    const displayValue = isEndingCountdown ? timeRemaining : (countdownValue || 'GO!');
    const headerText = isEndingCountdown
      ? (isRest ? 'REST ENDING' : 'FINISHING')
      : 'GET READY';
    const subText = isEndingCountdown
      ? (upcomingItem ? `Next: ${upcomingItem.name}` : 'Final stretch!')
      : `First up: ${items[0]?.name}`;

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.countdownContainer}>
          <Text style={styles.getReady}>{headerText}</Text>
          <Animated.Text
            style={[styles.countdownNumber, { transform: [{ scale: pulseAnim }] }]}
          >
            {displayValue}
          </Animated.Text>
          <Text style={styles.firstExercise}>{subText}</Text>
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
      <SegmentedProgressBar
        items={items}
        currentItemIndex={currentItemIndex}
        height={6}
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
          <VerticalAutoScroll
            text={currentItem.exercise.description}
            style={styles.exerciseDescription}
            containerHeight={88}
            lineHeight={22}
            pauseDuration={3000}
          />
        )}
      </View>

      {/* Up Next */}
      {nextItem && nextIsRest && itemAfterNext && (
        <View style={styles.upNext}>
          <Text style={styles.upNextLabel}>UP NEXT</Text>
          <MarqueeText
            text={`${nextItem.name} • ${itemAfterNext.name}`}
            style={styles.upNextName}
            pauseDuration={3000}
            scrollSpeed={30}
          />
        </View>
      )}
      {nextItem && !nextIsRest && (
        <View style={styles.upNext}>
          <Text style={styles.upNextLabel}>UP NEXT</Text>
          <MarqueeText
            text={nextItem.name}
            style={styles.upNextName}
            pauseDuration={3000}
            scrollSpeed={30}
          />
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

      {/* Paused Overlay - positioned below header */}
      {status === 'paused' && (
        <View style={styles.pausedOverlay}>
          <View style={styles.pausedContent}>
            <Text style={styles.pausedText}>PAUSED</Text>

            {/* Exercise name with horizontal scroll if long */}
            <View style={styles.pausedExerciseNameContainer}>
              <MarqueeText
                text={currentItem.name}
                style={styles.pausedExerciseName}
              />
            </View>

            {/* Full instructions - user can scroll manually */}
            {currentItem.exercise?.description && (
              <ScrollView
                style={styles.pausedInstructions}
                contentContainerStyle={styles.pausedInstructionsContent}
                showsVerticalScrollIndicator={true}
              >
                <Text style={styles.pausedInstructionsText}>
                  {currentItem.exercise.description}
                </Text>
              </ScrollView>
            )}

            <Text style={styles.pausedSubtext}>Tap play to resume</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
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
    fontSize: typography['2xl'],
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
    position: 'absolute',
    top: 76, // header height (44 button + 16 padding top + 16 padding bottom)
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    zIndex: 5,
  },
  pausedContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  pausedText: {
    fontSize: typography['4xl'],
    fontWeight: typography.bold,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  pausedExerciseNameContainer: {
    width: '100%',
    marginBottom: spacing.md,
  },
  pausedExerciseName: {
    fontSize: typography['2xl'],
    fontWeight: typography.semibold,
    color: colors.text,
    textAlign: 'center',
  },
  pausedInstructions: {
    maxHeight: 200,
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    marginBottom: spacing.lg,
  },
  pausedInstructionsContent: {
    padding: spacing.md,
  },
  pausedInstructionsText: {
    fontSize: typography.base,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 22,
    textAlign: 'center',
  },
  pausedSubtext: {
    fontSize: typography.base,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
});
