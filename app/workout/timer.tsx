import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  AppState,
  Animated,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Button, SegmentedProgressBar, MarqueeText, VerticalAutoScroll } from '@/components/common';
import { colors, spacing, typography } from '@/theme';
import { useTimerStore, useHistoryStore, useUserStore } from '@/stores';
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
  const isAudioMuted = useUserStore((state) => state.isAudioMuted);
  const toggleAudioMute = useUserStore((state) => state.toggleAudioMute);

  // Sync audio mute state with sound manager
  useEffect(() => {
    soundManager.setAudioEnabled(!isAudioMuted);
  }, [isAudioMuted]);

  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  // Prevents double-saving when auto-save fires AND the user manually stops
  const autoSavedRef = useRef(false);

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
  const keepAwakeActivated = useRef(false);
  useEffect(() => {
    activateKeepAwakeAsync()
      .then(() => {
        keepAwakeActivated.current = true;
      })
      .catch(() => {
        // Silently fail on web or unsupported platforms
      });
    return () => {
      if (keepAwakeActivated.current) {
        try {
          deactivateKeepAwake();
        } catch {
          // Silently fail
        }
      }
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

  // Main timer - plays countdown sounds BEFORE ticking to eliminate delay
  useEffect(() => {
    if (status === 'running') {
      timerRef.current = setInterval(() => {
        const state = useTimerStore.getState();
        const currentTime = state.timeRemaining;

        // Play countdown sound BEFORE tick so it's synchronized with visual
        // If currentTime is 4, after tick it becomes 3, so play "3" now
        if (currentTime >= 2 && currentTime <= 4) {
          soundManager.playCountdownNumber(currentTime - 1);
        }

        tick();
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [status, tick]);

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

  // Play countdown sound immediately when an item STARTS at 3 seconds or less
  // (handles items with short durations, e.g., 3-second rests)
  const prevItemIndexRef = useRef(currentItemIndex);
  useEffect(() => {
    if (status === 'running' && prevItemIndexRef.current !== currentItemIndex) {
      // Item just changed - if it starts at <=3, play the sound immediately
      if (timeRemaining <= 3 && timeRemaining >= 1) {
        soundManager.playCountdownNumber(timeRemaining);
      }
    }
    prevItemIndexRef.current = currentItemIndex;
  }, [currentItemIndex, timeRemaining, status]);

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

  // Auto-save partial workout when the user closes the tab (web) or backgrounds
  // the app (native) mid-workout, so the session isn't silently lost.
  // We read directly from the store (not the closure) to get the latest values.
  useEffect(() => {
    const saveOnClose = () => {
      if (autoSavedRef.current) return;
      const {
        status: currentStatus,
        session: currentSession,
        currentItemIndex: idx,
        items: storeItems,
        totalElapsed: elapsed,
      } = useTimerStore.getState();

      if (!currentSession || currentStatus === 'idle' || currentStatus === 'completed') return;

      autoSavedRef.current = true;
      const closingItem = storeItems[idx];
      addSession({
        ...currentSession,
        status: 'stopped_early',
        stoppedAt: new Date().toISOString(),
        completedItems: idx,
        actualDurationWorked: elapsed,
        percentComplete: Math.round((idx / storeItems.length) * 100),
        estimatedCaloriesBurned: Math.round(
          (currentSession.workout.estimatedCalories * idx) / storeItems.length
        ),
        stoppedAtItem: closingItem
          ? {
              circuitIndex: closingItem.circuitIndex,
              roundIndex: closingItem.roundIndex,
              exerciseIndex: closingItem.exerciseIndex,
              itemName: closingItem.name,
            }
          : undefined,
      });
    };

    if (Platform.OS === 'web') {
      // visibilitychange fires reliably when a tab is hidden or closed.
      // beforeunload is a belt-and-suspenders fallback for hard closes.
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
          saveOnClose();
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('beforeunload', saveOnClose);
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('beforeunload', saveOnClose);
      };
    } else {
      const subscription = AppState.addEventListener('change', (nextAppState) => {
        if (nextAppState === 'background' || nextAppState === 'inactive') {
          saveOnClose();
        }
      });
      return () => subscription.remove();
    }
  // addSession is a stable zustand selector; no other deps needed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addSession]);

  const handlePauseResume = () => {
    if (status === 'running') {
      pauseTimer();
    } else if (status === 'paused') {
      resumeTimer();
    }
  };

  // Show the in-component confirmation overlay instead of Alert.alert.
  // Alert.alert maps to window.confirm() on web (React Native Web), which can
  // be blocked by popup blockers or silently swallowed in certain environments,
  // making the X button appear to do nothing.
  const handleStop = () => {
    setShowExitConfirm(true);
  };

  // Called when the user confirms "End Workout" in our custom overlay.
  // stopTimer() updates the store's session with stopped_early + stoppedAtItem;
  // we read from the store post-call so we get the complete data instead of the
  // stale closure value that was missing stoppedAtItem.
  const handleConfirmStop = () => {
    setShowExitConfirm(false);
    stopTimer();
    const updatedSession = useTimerStore.getState().session;
    if (updatedSession) {
      addSession(updatedSession);
    }
    reset();
    router.replace('/(tabs)');
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

    // Solid colors: green for work ending, blue for rest ending, dark for initial
    // Work ending = green (timerActive), Rest ending = blue (timerRest)
    const countdownBackgroundColor = isEndingCountdown
      ? (isRest ? colors.timerRest : colors.timerActive)
      : colors.background;

    // White text on colored backgrounds for contrast, primary on dark initial screen
    const countdownNumberColor = isEndingCountdown ? colors.text : colors.primary;
    const countdownTextColor = isEndingCountdown ? colors.text : colors.textSecondary;

    return (
      <View style={[styles.container, { backgroundColor: countdownBackgroundColor }]}>
        <View style={styles.countdownContainer}>
          <Text style={[styles.getReady, { color: countdownTextColor }]}>{headerText}</Text>
          <Animated.Text
            style={[
              styles.countdownNumber,
              {
                transform: [{ scale: pulseAnim }],
                color: countdownNumberColor,
              },
            ]}
          >
            {displayValue}
          </Animated.Text>
          <Text style={[styles.firstExercise, { color: countdownTextColor }]}>{subText}</Text>
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
        <TouchableOpacity onPress={toggleAudioMute} style={styles.closeButton}>
          <Ionicons
            name={isAudioMuted ? 'volume-mute' : 'volume-high'}
            size={24}
            color={isAudioMuted ? 'rgba(255,255,255,0.5)' : colors.text}
          />
        </TouchableOpacity>
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

      {/* Exit Confirmation Overlay — replaces Alert.alert, which falls back to
          window.confirm() on web and can be blocked or silently ignored. */}
      {showExitConfirm && (
        <View style={styles.exitConfirmOverlay}>
          <View style={styles.exitConfirmCard}>
            <Text style={styles.exitConfirmTitle}>End Workout?</Text>
            <Text style={styles.exitConfirmMessage}>
              Your progress will be saved to history.
            </Text>
            <View style={styles.exitConfirmButtons}>
              <TouchableOpacity
                style={styles.exitKeepGoingButton}
                onPress={() => setShowExitConfirm(false)}
              >
                <Text style={styles.exitKeepGoingText}>Keep Going</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.exitEndButton}
                onPress={handleConfirmStop}
              >
                <Text style={styles.exitEndText}>End Workout</Text>
              </TouchableOpacity>
            </View>
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
    color: colors.text, // Default, overridden dynamically during countdown
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
  exitConfirmOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  exitConfirmCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.xl,
    marginHorizontal: spacing.xl,
    width: '80%',
    maxWidth: 340,
    alignItems: 'center',
  },
  exitConfirmTitle: {
    fontSize: typography['2xl'],
    fontWeight: typography.bold,
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  exitConfirmMessage: {
    fontSize: typography.base,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  exitConfirmButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
  },
  exitKeepGoingButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  exitKeepGoingText: {
    fontSize: typography.base,
    fontWeight: typography.medium,
    color: colors.text,
  },
  exitEndButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 10,
    backgroundColor: colors.error,
    alignItems: 'center',
  },
  exitEndText: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.text,
  },
});
