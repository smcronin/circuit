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
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { LinearGradient } from 'expo-linear-gradient';
import { SegmentedProgressBar, VerticalAutoScroll } from '@/components/common';
import { colors, fonts, spacing, typography } from '@/theme';
import { useTimerStore, useHistoryStore, useUserStore } from '@/stores';
import { formatTime, isRestItem, getItemTypeLabel } from '@/utils';
import { soundManager } from '@/services/audio';

// Renders a time string with every digit in a fixed-width slot so the clock
// never jitters as seconds tick, regardless of the display font's metrics.
function TimerDigits({
  text,
  fontSize,
  color = colors.text,
}: {
  text: string;
  fontSize: number;
  color?: string;
}) {
  return (
    <View style={digitStyles.row}>
      {text.split('').map((ch, i) => (
        <Text
          key={i}
          style={[
            digitStyles.char,
            {
              fontSize,
              lineHeight: Math.round(fontSize * 1.04),
              color,
              width: ch === ':' ? Math.ceil(fontSize * 0.3) : Math.ceil(fontSize * 0.56),
            },
          ]}
        >
          {ch}
        </Text>
      ))}
    </View>
  );
}

const digitStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  char: {
    fontFamily: fonts.display,
    textAlign: 'center',
    includeFontPadding: false,
  },
});

export default function TimerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isPortrait = height >= width;
  const isCompactLandscape = width > height && height <= 560;
  // Short phones have substantially less usable height after the header,
  // controls, and safe areas are accounted for. Keep all of the workout's
  // essential information in view by tightening the secondary UI first.
  const isCompactPortrait = isPortrait && height <= 740;
  const isVeryCompactPortrait = isPortrait && height <= 640;

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
  const workoutTimeRemaining = items.reduce((remaining, item, index) => {
    if (index < currentItemIndex) return remaining;
    if (index === currentItemIndex) return remaining + timeRemaining;
    return remaining + item.duration;
  }, 0);

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

    // Gradient backdrops: deep green for work ending, deep blue for rest
    // ending, near-black navy for the initial countdown.
    const countdownGradient = isEndingCountdown
      ? (isRest ? colors.gradientTimerRest : colors.gradientTimerWork)
      : colors.gradientDark;

    // White text on colored backgrounds for contrast, electric indigo on the
    // dark initial screen.
    const countdownNumberColor = isEndingCountdown ? colors.text : colors.primaryLight;
    const countdownTextColor = isEndingCountdown
      ? 'rgba(255,255,255,0.85)'
      : colors.textSecondary;
    const countdownGlow = isEndingCountdown
      ? 'rgba(255,255,255,0.35)'
      : 'rgba(108,124,255,0.55)';

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient colors={countdownGradient} style={StyleSheet.absoluteFill} />
        <View style={[styles.countdownContainer, isCompactLandscape && styles.countdownContainerLandscape]}>
          <Text
            style={[
              styles.getReady,
              isCompactLandscape && styles.getReadyLandscape,
              { color: countdownTextColor },
            ]}
          >
            {headerText}
          </Text>
          <Animated.Text
            style={[
              styles.countdownNumber,
              isCompactLandscape && styles.countdownNumberLandscape,
              {
                transform: [{ scale: pulseAnim }],
                color: countdownNumberColor,
                textShadowColor: countdownGlow,
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 32,
              },
            ]}
          >
            {displayValue}
          </Animated.Text>
          <Text
            style={[
              styles.firstExercise,
              isCompactLandscape && styles.firstExerciseLandscape,
              { color: countdownTextColor },
            ]}
            numberOfLines={isCompactLandscape ? 1 : 2}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {subText}
          </Text>
        </View>
      </View>
    );
  }

  if (!currentItem) {
    return null;
  }

  const activeItem = currentItem;

  const renderTimerDetails = (compact = false) => (
    <>
      <Text
        style={[
          styles.itemType,
          compact && styles.itemTypeLandscape,
          isCompactPortrait && styles.itemTypeCompactPortrait,
        ]}
      >
        {/* "REST / Rest" reads redundant — swap the kicker on rest steps */}
        {isRest ? 'RECOVER' : getItemTypeLabel(activeItem.type)}
      </Text>
      <Text
        style={[
          styles.itemName,
          compact && styles.itemNameLandscape,
          isCompactPortrait && styles.itemNameCompactPortrait,
          isVeryCompactPortrait && styles.itemNameVeryCompactPortrait,
        ]}
        numberOfLines={3}
        adjustsFontSizeToFit
        minimumFontScale={0.55}
      >
        {activeItem.name}
      </Text>
      {hasSideSwitching && (
        <Text
          style={[
            styles.sideIndicator,
            compact && styles.sideIndicatorLandscape,
            isCompactPortrait && styles.sideIndicatorCompactPortrait,
          ]}
        >
          {currentSide} SIDE
        </Text>
      )}

      <View style={styles.timerDisplayWrapper}>
        <TimerDigits
          text={formatTime(timeRemaining)}
          fontSize={
            compact ? 76 : isVeryCompactPortrait ? 80 : isCompactPortrait ? 92 : 112
          }
        />
      </View>

      {activeItem.exercise?.targetReps && (
        <Text
          style={[
            styles.repsTarget,
            compact && styles.repsTargetLandscape,
            isCompactPortrait && styles.repsTargetCompactPortrait,
          ]}
        >
          Target: {activeItem.exercise.targetReps} reps
        </Text>
      )}
      {activeItem.exercise?.repRange && (
        <Text
          style={[
            styles.repsTarget,
            compact && styles.repsTargetLandscape,
            isCompactPortrait && styles.repsTargetCompactPortrait,
          ]}
        >
          Target: {activeItem.exercise.repRange} reps
        </Text>
      )}
    </>
  );

  const renderExerciseDescription = (compact = false) => {
    if (!activeItem.exercise?.description) return null;

    return (
      <View
        style={[
          styles.exerciseDescriptionWrapper,
          compact && styles.exerciseDescriptionWrapperLandscape,
          isCompactPortrait && styles.exerciseDescriptionWrapperCompactPortrait,
        ]}
      >
        {compact ? (
          <VerticalAutoScroll
            text={activeItem.exercise.description}
            style={[styles.exerciseDescriptionText, styles.exerciseDescriptionTextLandscape]}
            containerHeight={56}
            lineHeight={20}
            pauseDuration={3000}
          />
        ) : (
          <Text
            style={[
              styles.exerciseDescriptionText,
              isCompactPortrait && styles.exerciseDescriptionTextCompactPortrait,
            ]}
          >
            {activeItem.exercise.description}
          </Text>
        )}
      </View>
    );
  };

  const renderUpNext = (compact = false) => {
    if (nextItem && nextIsRest && itemAfterNext) {
      return (
        <View
          style={[
            styles.upNext,
            compact && styles.upNextLandscape,
            isCompactPortrait && styles.upNextCompactPortrait,
          ]}
        >
          <Text
            style={[
              styles.upNextLabel,
              compact && styles.upNextLabelLandscape,
              isCompactPortrait && styles.upNextLabelCompactPortrait,
            ]}
          >
            UP NEXT
          </Text>
          <Text
            style={[
              styles.upNextName,
              compact && styles.upNextNameLandscape,
              isCompactPortrait && styles.upNextNameCompactPortrait,
            ]}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.55}
          >
            {nextItem.name} • {itemAfterNext.name}
          </Text>
        </View>
      );
    }

    if (nextItem && !nextIsRest) {
      return (
        <View
          style={[
            styles.upNext,
            compact && styles.upNextLandscape,
            isCompactPortrait && styles.upNextCompactPortrait,
          ]}
        >
          <Text
            style={[
              styles.upNextLabel,
              compact && styles.upNextLabelLandscape,
              isCompactPortrait && styles.upNextLabelCompactPortrait,
            ]}
          >
            UP NEXT
          </Text>
          <Text
            style={[
              styles.upNextName,
              compact && styles.upNextNameLandscape,
              isCompactPortrait && styles.upNextNameCompactPortrait,
            ]}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.55}
          >
            {nextItem.name}
          </Text>
        </View>
      );
    }

    return null;
  };

  const renderControls = (compact = false) => {
    const useCompactControls = compact || isCompactPortrait;

    return (
      <View
        style={[
          styles.controls,
          compact && styles.controlsLandscape,
          isCompactPortrait && styles.controlsCompactPortrait,
          !compact && {
            paddingBottom: insets.bottom + (isCompactPortrait ? spacing.sm : spacing.lg),
          },
        ]}
      >
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Previous exercise"
          style={[
            styles.controlButton,
            compact && styles.controlButtonLandscape,
            isCompactPortrait && styles.controlButtonCompactPortrait,
          ]}
          onPress={goToPrevious}
          disabled={currentItemIndex === 0}
        >
          <Ionicons
            name="play-skip-back"
            size={useCompactControls ? 24 : 28}
            color={currentItemIndex === 0 ? 'rgba(255,255,255,0.3)' : colors.text}
          />
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={status === 'running' ? 'Pause workout' : 'Resume workout'}
          style={[
            styles.mainControlButton,
            compact && styles.mainControlButtonLandscape,
            isCompactPortrait && styles.mainControlButtonCompactPortrait,
          ]}
          onPress={handlePauseResume}
        >
          <Ionicons
            name={status === 'running' ? 'pause' : 'play'}
            size={useCompactControls ? 30 : 36}
            color={backgroundColor}
          />
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Next exercise"
          style={[
            styles.controlButton,
            compact && styles.controlButtonLandscape,
            isCompactPortrait && styles.controlButtonCompactPortrait,
          ]}
          onPress={skipToNext}
        >
          <Ionicons
            name="play-skip-forward"
            size={useCompactControls ? 24 : 28}
            color={colors.text}
          />
        </TouchableOpacity>
      </View>
    );
  };

  const renderPausedScreen = () => (
    <View
      style={[
        styles.pausedScreen,
        isCompactLandscape && styles.pausedScreenLandscape,
      ]}
    >
      <View
        style={[
          styles.pausedContent,
          isCompactLandscape && styles.pausedContentLandscape,
        ]}
      >
        <Text style={[styles.pausedText, isCompactLandscape && styles.pausedTextLandscape]}>
          PAUSED
        </Text>

        <Text
          style={[
            styles.pausedExerciseName,
            isCompactLandscape && styles.pausedExerciseNameLandscape,
          ]}
          numberOfLines={3}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {activeItem.name}
        </Text>

        <View style={styles.pausedTimerBlock}>
          <TimerDigits
            text={formatTime(timeRemaining)}
            fontSize={isCompactLandscape ? 44 : 60}
          />
          <Text style={styles.pausedTimerLabel}>REMAINING IN THIS STEP</Text>
        </View>

        {activeItem.exercise?.description && (
          isCompactLandscape ? (
            <ScrollView
              style={[styles.pausedInstructions, styles.pausedInstructionsLandscape]}
              contentContainerStyle={styles.pausedInstructionsContent}
              showsVerticalScrollIndicator={true}
            >
              <Text style={[styles.pausedInstructionsText, styles.pausedInstructionsTextLandscape]}>
                {activeItem.exercise.description}
              </Text>
            </ScrollView>
          ) : (
            <View style={[styles.pausedInstructions, styles.pausedInstructionsPortrait]}>
              <Text style={styles.pausedInstructionsText}>
                {activeItem.exercise.description}
              </Text>
            </View>
          )
        )}

        <Text style={[styles.pausedSubtext, isCompactLandscape && styles.pausedSubtextLandscape]}>
          Tap play to resume
        </Text>
      </View>

      {renderControls(isCompactLandscape)}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor, paddingTop: insets.top }]}>
      <LinearGradient
        colors={isRest ? colors.gradientTimerRest : colors.gradientTimerWork}
        style={StyleSheet.absoluteFill}
      />
      {/* Header */}
      <View
        style={[
          styles.header,
          isCompactLandscape && styles.headerLandscape,
          isCompactPortrait && styles.headerCompactPortrait,
          isCompactLandscape && {
            paddingLeft: Math.max(insets.left, spacing.sm),
            paddingRight: Math.max(insets.right, spacing.sm),
          },
        ]}
      >
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="End workout"
          onPress={handleStop}
          style={[
            styles.closeButton,
            isCompactLandscape && styles.closeButtonLandscape,
            isCompactPortrait && styles.closeButtonCompactPortrait,
          ]}
        >
          <Ionicons
            name="close"
            size={isCompactLandscape || isCompactPortrait ? 24 : 28}
            color={colors.text}
          />
        </TouchableOpacity>
        <View style={styles.headerTimeline}>
          <View style={[styles.headerMetric, styles.headerMetricLeft]}>
            <Text style={styles.headerMetricLabel}>ELAPSED</Text>
            <Text style={styles.headerMetricValue}>{formatTime(totalElapsed)}</Text>
          </View>
          <View style={styles.progressInfo}>
            <Text style={styles.headerMetricLabel}>STEP</Text>
            <Text style={styles.progressText}>
              {currentItemIndex + 1} / {items.length}
            </Text>
          </View>
          <View style={[styles.headerMetric, styles.headerMetricRight]}>
            <Text style={styles.headerMetricLabel}>REMAINING</Text>
            <Text style={styles.headerMetricValue}>{formatTime(workoutTimeRemaining)}</Text>
          </View>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={isAudioMuted ? 'Unmute audio' : 'Mute audio'}
          onPress={toggleAudioMute}
          style={[
            styles.closeButton,
            isCompactLandscape && styles.closeButtonLandscape,
            isCompactPortrait && styles.closeButtonCompactPortrait,
          ]}
        >
          <Ionicons
            name={isAudioMuted ? 'volume-mute' : 'volume-high'}
            size={isCompactLandscape || isCompactPortrait ? 22 : 24}
            color={isAudioMuted ? 'rgba(255,255,255,0.5)' : colors.text}
          />
        </TouchableOpacity>
      </View>

      {/* Progress Bar */}
      <SegmentedProgressBar
        items={items}
        currentItemIndex={currentItemIndex}
        height={isCompactLandscape || isCompactPortrait ? 4 : 6}
        style={[
          styles.progressBar,
          isCompactLandscape && styles.progressBarLandscape,
          isCompactPortrait && styles.progressBarCompactPortrait,
        ]}
      />

      {status === 'paused' ? (
        renderPausedScreen()
      ) : isCompactLandscape ? (
        <View
          style={[
            styles.landscapeContent,
            {
              paddingLeft: Math.max(insets.left, spacing.md),
              paddingRight: Math.max(insets.right, spacing.md),
              paddingBottom: Math.max(insets.bottom, spacing.sm),
            },
          ]}
        >
          <View style={styles.landscapePrimary}>
            {renderTimerDetails(true)}
          </View>
          <View style={styles.landscapeSecondary}>
            {renderExerciseDescription(true)}
            {renderUpNext(true)}
            {renderControls(true)}
          </View>
        </View>
      ) : (
        <>
          {/* Main Timer Display */}
          <View
            style={[
              styles.timerContainer,
              isCompactPortrait && styles.timerContainerCompactPortrait,
            ]}
          >
            {renderTimerDetails()}
            {renderExerciseDescription()}
          </View>

          {/* Up Next */}
          {renderUpNext()}

          {/* Controls */}
          {renderControls()}
        </>
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
  headerLandscape: {
    paddingVertical: spacing.xs,
  },
  headerCompactPortrait: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonLandscape: {
    width: 40,
    height: 40,
  },
  closeButtonCompactPortrait: {
    width: 40,
    height: 40,
  },
  headerTimeline: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.xs,
  },
  headerMetric: {
    flex: 1,
    minWidth: 0,
  },
  headerMetricLeft: {
    alignItems: 'flex-start',
  },
  headerMetricRight: {
    alignItems: 'flex-end',
  },
  headerMetricLabel: {
    fontSize: 9,
    lineHeight: 11,
    fontWeight: typography.bold,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.7,
  },
  headerMetricValue: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 17,
    lineHeight: 20,
    color: colors.text,
    letterSpacing: 0.5,
  },
  progressInfo: {
    flex: 0.9,
    alignItems: 'center',
  },
  progressText: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 17,
    lineHeight: 20,
    color: colors.text,
    letterSpacing: 0.5,
  },
  progressBar: {
    marginHorizontal: spacing.lg,
  },
  progressBarLandscape: {
    marginHorizontal: spacing.md,
  },
  progressBarCompactPortrait: {
    marginHorizontal: spacing.md,
  },
  timerContainer: {
    flex: 1,
    minHeight: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  timerContainerCompactPortrait: {
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  landscapeContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.md,
    minHeight: 0,
    paddingTop: spacing.sm,
  },
  landscapePrimary: {
    flex: 1.25,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  landscapeSecondary: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: spacing.sm,
  },
  itemType: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 15,
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  itemTypeLandscape: {
    fontSize: 13,
    marginBottom: spacing.xs,
  },
  itemTypeCompactPortrait: {
    fontSize: 13,
    marginBottom: 2,
  },
  itemName: {
    fontFamily: fonts.display,
    fontSize: 40,
    color: colors.text,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    width: '100%',
  },
  itemNameLandscape: {
    fontSize: 30,
    marginBottom: spacing.xs,
    maxWidth: '100%',
  },
  itemNameCompactPortrait: {
    fontSize: 34,
    marginBottom: 2,
  },
  itemNameVeryCompactPortrait: {
    fontSize: 30,
  },
  sideIndicator: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typography.xl,
    color: colors.text,
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    marginBottom: spacing.md,
    letterSpacing: 2.5,
    overflow: 'hidden',
  },
  sideIndicatorLandscape: {
    fontSize: typography.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  sideIndicatorCompactPortrait: {
    fontSize: typography.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  timerDisplayWrapper: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  repsTarget: {
    fontSize: typography.lg,
    color: 'rgba(255,255,255,0.8)',
    marginTop: spacing.md,
  },
  repsTargetLandscape: {
    fontSize: typography.sm,
    marginTop: spacing.xs,
  },
  repsTargetCompactPortrait: {
    fontSize: typography.sm,
    marginTop: 2,
  },
  exerciseDescriptionWrapper: {
    marginTop: spacing.md,
    width: '100%',
  },
  exerciseDescriptionWrapperLandscape: {
    marginTop: 0,
    width: '100%',
  },
  exerciseDescriptionWrapperCompactPortrait: {
    marginTop: spacing.sm,
    width: '100%',
  },
  exerciseDescriptionText: {
    fontSize: typography.base,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    lineHeight: 22,
  },
  exerciseDescriptionTextLandscape: {
    fontSize: typography.sm,
    lineHeight: 20,
    paddingHorizontal: 0,
    textAlign: 'left',
  },
  exerciseDescriptionTextCompactPortrait: {
    fontSize: 15,
    lineHeight: 21,
    paddingHorizontal: spacing.sm,
  },
  upNext: {
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.16)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  upNextLandscape: {
    alignItems: 'stretch',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  upNextCompactPortrait: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  upNextLabel: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  upNextLabelLandscape: {
    marginBottom: 2,
    textAlign: 'center',
  },
  upNextLabelCompactPortrait: {
    marginBottom: 2,
  },
  upNextName: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 22,
    color: colors.text,
    lineHeight: 26,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    width: '100%',
  },
  upNextNameLandscape: {
    fontSize: 17,
    lineHeight: 20,
  },
  upNextNameCompactPortrait: {
    fontSize: 19,
    lineHeight: 22,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    padding: spacing.lg,
    zIndex: 10,
  },
  controlsLandscape: {
    gap: spacing.md,
    paddingHorizontal: 0,
    paddingTop: spacing.xs,
    paddingBottom: 0,
  },
  controlsCompactPortrait: {
    gap: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonLandscape: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  controlButtonCompactPortrait: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  mainControlButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 8,
  },
  mainControlButtonLandscape: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  mainControlButtonCompactPortrait: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  countdownContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  countdownContainerLandscape: {
    paddingHorizontal: spacing.xl,
  },
  getReady: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typography.xl,
    color: colors.textSecondary,
    letterSpacing: 5,
    textTransform: 'uppercase',
    marginBottom: spacing.xl,
  },
  getReadyLandscape: {
    fontSize: typography.sm,
    marginBottom: spacing.md,
  },
  countdownNumber: {
    fontFamily: fonts.displayBlack,
    fontSize: 148,
    lineHeight: 156,
    color: colors.text, // Default, overridden dynamically during countdown
  },
  countdownNumberLandscape: {
    fontSize: 96,
    lineHeight: 104,
  },
  firstExercise: {
    fontSize: typography.lg,
    color: colors.textSecondary,
    marginTop: spacing.xxl,
    textAlign: 'center',
  },
  firstExerciseLandscape: {
    fontSize: typography.base,
    marginTop: spacing.md,
    maxWidth: '86%',
  },
  pausedScreen: {
    flex: 1,
    minHeight: 0,
    backgroundColor: colors.timerBackground,
  },
  pausedScreenLandscape: {
    paddingHorizontal: spacing.md,
  },
  pausedContent: {
    flex: 1,
    minHeight: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  pausedContentLandscape: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  pausedText: {
    fontFamily: fonts.displayBlack,
    fontSize: typography['4xl'],
    color: colors.primaryLight,
    letterSpacing: 6,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  pausedTextLandscape: {
    fontSize: typography['2xl'],
    marginBottom: spacing.sm,
  },
  pausedExerciseName: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.text,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    width: '100%',
    marginBottom: spacing.sm,
  },
  pausedExerciseNameLandscape: {
    fontSize: typography.lg,
    marginBottom: spacing.xs,
  },
  pausedTimerBlock: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  pausedTimerLabel: {
    fontSize: 9,
    lineHeight: 11,
    fontWeight: typography.bold,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.8,
  },
  pausedInstructions: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    marginBottom: spacing.sm,
  },
  pausedInstructionsPortrait: {
    padding: spacing.md,
  },
  pausedInstructionsLandscape: {
    maxHeight: 96,
    marginBottom: spacing.sm,
    borderRadius: 8,
  },
  pausedInstructionsContent: {
    padding: spacing.sm,
  },
  pausedInstructionsText: {
    fontSize: typography.base,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 22,
    textAlign: 'center',
  },
  pausedInstructionsTextLandscape: {
    fontSize: typography.sm,
    lineHeight: 20,
    textAlign: 'left',
  },
  pausedSubtext: {
    fontSize: typography.base,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  pausedSubtextLandscape: {
    fontSize: typography.sm,
    marginTop: spacing.xs,
  },
  exitConfirmOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(2,4,10,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  exitConfirmCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.xl,
    marginHorizontal: spacing.xl,
    width: '80%',
    maxWidth: 340,
    alignItems: 'center',
  },
  exitConfirmTitle: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typography['2xl'],
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
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
    borderRadius: 999,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
  },
  exitKeepGoingText: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typography.base,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.text,
  },
  exitEndButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 999,
    backgroundColor: '#D93A36',
    alignItems: 'center',
  },
  exitEndText: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typography.base,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.text,
  },
});
