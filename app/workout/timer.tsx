import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  AppState,
  Animated,
  ScrollView,
  Platform,
  LayoutChangeEvent,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { LinearGradient } from 'expo-linear-gradient';
import { SegmentedProgressBar, VerticalAutoScroll } from '@/components/common';
import { colors, fonts, spacing, typography, scaleFont, clamp } from '@/theme';
import { useTimerStore, useHistoryStore, useUserStore } from '@/stores';
import { formatTime, isRestItem, getItemTypeLabel, fitText, fitTimerDigits } from '@/utils';
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

// ─── Fluid stage sizing ─────────────────────────────────────────────────────
// The timer is read from across the room, so every type size is derived from
// the space actually measured on screen rather than from fixed breakpoints.
// Each state budgets its stage top-down: fixed chrome (kicker, side pill, rep
// target, instructions) is reserved first, then everything left over is split
// between the two "hero" elements. Long exercise names shrink and wrap into
// their own box, so they can never push the clock off screen.

interface StageBox {
  width: number;
  height: number;
}

interface WorkStageLayout {
  kicker: number;
  nameFontSize: number;
  nameLineHeight: number;
  nameLines: number;
  sideSize: number;
  digitsSize: number;
  repsSize: number;
  descriptionSize: number;
  descriptionLines: number;
  showDescription: boolean;
}

function computeWorkStage({
  width,
  height,
  name,
  digitsText,
  hasSide,
  hasReps,
  hasDescription,
}: StageBox & {
  name: string;
  digitsText: string;
  hasSide: boolean;
  hasReps: boolean;
  hasDescription: boolean;
}): WorkStageLayout {
  const kicker = clamp(Math.round(height * 0.038), 13, 24);
  const sideSize = hasSide ? clamp(Math.round(height * 0.046), 15, 30) : 0;
  const repsSize = hasReps ? clamp(Math.round(height * 0.038), 14, 26) : 0;

  // Instructions are the first thing to give up room — on a short stage they'd
  // otherwise eat the space the clock needs.
  const showDescription = hasDescription && height > 330;
  const descriptionSize = showDescription ? clamp(Math.round(height * 0.033), 13, 21) : 0;
  const descriptionLines = height < 420 ? 2 : 3;

  const chrome =
    kicker * 1.2 +
    spacing.sm +
    (hasSide ? sideSize * 1.15 + spacing.sm * 2 + spacing.sm : 0) +
    (hasReps ? repsSize * 1.35 + spacing.sm : 0) +
    (showDescription ? descriptionSize * 1.42 * descriptionLines + spacing.md : 0);

  // Never let chrome claim so much that the heroes collapse.
  const heroSpace = Math.max(height - chrome - spacing.md, height * 0.4);
  const nameBox = heroSpace * 0.42;
  const digitsBox = heroSpace * 0.58;

  const nameFit = fitText(name, {
    maxWidth: width,
    maxHeight: nameBox,
    maxLines: 3,
    maxFontSize: clamp(Math.min(height * 0.2, nameBox / 1.06), 20, 96),
    minFontSize: 20,
  });

  const digitsSize = fitTimerDigits(digitsText, width, clamp(digitsBox / 1.04, 40, 190));

  return {
    kicker,
    nameFontSize: nameFit.fontSize,
    nameLineHeight: nameFit.lineHeight,
    nameLines: 3,
    sideSize,
    digitsSize,
    repsSize,
    descriptionSize,
    descriptionLines,
    showDescription,
  };
}

interface RestStageLayout {
  kicker: number;
  digitsSize: number;
  nextLabelSize: number;
  nextFontSize: number;
  nextLineHeight: number;
  thenSize: number;
  showThen: boolean;
}

function computeRestStage({
  width,
  height,
  digitsText,
  nextName,
  hasThen,
}: StageBox & { digitsText: string; nextName: string; hasThen: boolean }): RestStageLayout {
  const kicker = clamp(Math.round(height * 0.04), 13, 26);
  const nextLabelSize = clamp(Math.round(height * 0.032), 11, 20);
  const showThen = hasThen && height > 380;
  const thenSize = showThen ? clamp(Math.round(height * 0.032), 13, 20) : 0;

  const chrome =
    kicker * 1.2 +
    spacing.sm +
    nextLabelSize * 1.4 +
    spacing.md +
    (showThen ? thenSize * 1.4 + spacing.sm : 0);

  const heroSpace = Math.max(height - chrome - spacing.md, height * 0.5);
  // During rest the clock leads and the upcoming exercise is the second hero —
  // it's what you need to read before the rest runs out.
  const digitsBox = heroSpace * 0.56;
  const nextBox = heroSpace * 0.44;

  const digitsSize = fitTimerDigits(digitsText, width, clamp(digitsBox / 1.04, 40, 200));

  const nextFit = fitText(nextName, {
    maxWidth: width,
    maxHeight: nextBox,
    maxLines: 3,
    maxFontSize: clamp(Math.min(height * 0.17, nextBox / 1.06), 18, 78),
    minFontSize: 18,
  });

  return {
    kicker,
    digitsSize,
    nextLabelSize,
    nextFontSize: nextFit.fontSize,
    nextLineHeight: nextFit.lineHeight,
    thenSize,
    showThen,
  };
}

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

  // Measured size of the main content area. Everything on the stage is sized
  // from this, so the layout adapts to any device without a breakpoint table.
  const [stage, setStage] = useState<StageBox>({ width: 0, height: 0 });
  const handleStageLayout = useCallback((event: LayoutChangeEvent) => {
    const { width: w, height: h } = event.nativeEvent.layout;
    setStage((prev) =>
      Math.abs(prev.width - w) < 1 && Math.abs(prev.height - h) < 1 ? prev : { width: w, height: h }
    );
  }, []);

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
    if (status === 'running' && !isRest && !hasSideSwitching && currentItem) {
      const itemMidpoint = Math.floor(currentItem.duration / 2);
      if (timeRemaining === itemMidpoint && itemMidpoint > 3) {
        soundManager.playWarning();
      }
    }
  }, [timeRemaining, status, isRest, hasSideSwitching, currentItem]);

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

  // The clock is sized from the *widest* string this step will ever show, so it
  // doesn't visibly resize as the minutes digit drops away.
  const timerText = formatTime(timeRemaining);
  const digitsSizingText =
    currentItem && formatTime(currentItem.duration).length > timerText.length
      ? formatTime(currentItem.duration)
      : timerText;

  // What's actually coming up. A rest step in between is a detail, not the
  // headline — surface the exercise you need to get ready for.
  const upNext = useMemo(() => {
    if (!nextItem) return null;
    if (nextIsRest && itemAfterNext) {
      return { name: itemAfterNext.name, restSeconds: nextItem.duration };
    }
    if (nextIsRest) return null;
    return { name: nextItem.name, restSeconds: null as number | null };
  }, [nextItem, nextIsRest, itemAfterNext]);

  // ─── Countdown overlay (initial 3-2-1 and end-of-step) ────────────────────
  if (isInitialCountdown || isEndingCountdown) {
    const upcomingItem = nextItem;
    const displayValue = isEndingCountdown ? timeRemaining : countdownValue || 'GO!';
    const headerText = isEndingCountdown ? (isRest ? 'REST ENDING' : 'FINISHING') : 'GET READY';
    const nextName = isEndingCountdown
      ? upcomingItem?.name ?? null
      : items[0]?.name ?? null;
    const nextLabel = isEndingCountdown ? 'NEXT' : 'FIRST UP';
    const fallbackText = isEndingCountdown ? 'Final stretch!' : null;

    // Gradient backdrops: deep green for work ending, deep blue for rest
    // ending, near-black navy for the initial countdown.
    const countdownGradient = isEndingCountdown
      ? isRest
        ? colors.gradientTimerRest
        : colors.gradientTimerWork
      : colors.gradientDark;

    // White text on colored backgrounds for contrast, electric indigo on the
    // dark initial screen.
    const countdownNumberColor = isEndingCountdown ? colors.text : colors.primaryLight;
    const countdownTextColor = isEndingCountdown ? 'rgba(255,255,255,0.85)' : colors.textSecondary;
    const countdownGlow = isEndingCountdown
      ? 'rgba(255,255,255,0.35)'
      : 'rgba(108,124,255,0.55)';

    const stageH = Math.max(height - insets.top - insets.bottom, 200);
    const stageW = Math.max(width - spacing.lg * 2, 200);
    const labelSize = clamp(Math.round(stageH * 0.028), 12, 22);
    const numberSize = clamp(Math.round(stageH * (isCompactLandscape ? 0.4 : 0.3)), 84, 260);
    // The upcoming exercise gets real size here — this screen is on for the
    // three seconds when knowing what's next matters most.
    const nextFit = fitText(nextName ?? fallbackText ?? '', {
      maxWidth: stageW,
      maxLines: isCompactLandscape ? 2 : 3,
      maxFontSize: clamp(stageH * (isCompactLandscape ? 0.09 : 0.075), 20, 60),
      minFontSize: 18,
    });

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient colors={countdownGradient} style={StyleSheet.absoluteFill} />
        <View
          style={[
            styles.countdownContainer,
            { paddingTop: insets.top, paddingBottom: insets.bottom },
          ]}
        >
          <Text
            style={[styles.getReady, { color: countdownTextColor, fontSize: labelSize }]}
          >
            {headerText}
          </Text>
          <Animated.Text
            style={[
              styles.countdownNumber,
              {
                fontSize: numberSize,
                lineHeight: Math.round(numberSize * 1.05),
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
          <View style={styles.countdownNextBlock}>
            {nextName && (
              <Text
                style={[
                  styles.countdownNextLabel,
                  { color: countdownTextColor, fontSize: Math.round(labelSize * 0.8) },
                ]}
              >
                {nextLabel}
              </Text>
            )}
            <Text
              style={[
                styles.countdownNextName,
                {
                  color: nextName ? colors.text : countdownTextColor,
                  fontSize: nextFit.fontSize,
                  lineHeight: nextFit.lineHeight,
                },
              ]}
              numberOfLines={isCompactLandscape ? 2 : 3}
            >
              {nextName ?? fallbackText}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (!currentItem) {
    return null;
  }

  const activeItem = currentItem;
  const description = activeItem.exercise?.description ?? null;
  const repsTargetText = activeItem.exercise?.targetReps
    ? `${activeItem.exercise.targetReps} reps`
    : activeItem.exercise?.repRange
      ? `${activeItem.exercise.repRange} reps`
      : null;

  // ─── Stage renderers ──────────────────────────────────────────────────────

  const renderRestStage = (box: StageBox) => {
    const nextName = upNext?.name ?? nextItem?.name ?? 'Workout complete';
    // The step after the one you're getting ready for, skipping another rest.
    const thenItem =
      itemAfterNext && isRestItem(itemAfterNext.type) ? items[currentItemIndex + 3] : itemAfterNext;
    const layout = computeRestStage({
      width: box.width,
      height: box.height,
      digitsText: digitsSizingText,
      nextName,
      hasThen: !!thenItem,
    });

    return (
      <>
        <Text style={[styles.itemType, { fontSize: layout.kicker }]}>RECOVER</Text>

        <TimerDigits text={timerText} fontSize={layout.digitsSize} />

        <View style={styles.restNextBlock}>
          <Text style={[styles.upNextLabel, { fontSize: layout.nextLabelSize }]}>UP NEXT</Text>
          <Text
            style={[
              styles.restNextName,
              { fontSize: layout.nextFontSize, lineHeight: layout.nextLineHeight },
            ]}
            numberOfLines={3}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {nextName}
          </Text>
          {layout.showThen && thenItem && (
            <Text style={[styles.restThen, { fontSize: layout.thenSize }]} numberOfLines={1}>
              THEN {thenItem.name}
            </Text>
          )}
        </View>
      </>
    );
  };

  // `allowDescription` is false in landscape, where the instructions live in
  // their own auto-scrolling column instead of on the stage.
  const renderWorkStage = (box: StageBox, allowDescription: boolean) => {
    const layout = computeWorkStage({
      width: box.width,
      height: box.height,
      name: activeItem.name,
      digitsText: digitsSizingText,
      hasSide: hasSideSwitching,
      hasReps: !!repsTargetText,
      hasDescription: allowDescription && !!description,
    });

    return (
      <>
        <Text style={[styles.itemType, { fontSize: layout.kicker }]}>
          {getItemTypeLabel(activeItem.type)}
        </Text>

        <Text
          style={[
            styles.itemName,
            { fontSize: layout.nameFontSize, lineHeight: layout.nameLineHeight },
          ]}
          numberOfLines={layout.nameLines}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {activeItem.name}
        </Text>

        {hasSideSwitching && (
          <Text
            style={[
              styles.sideIndicator,
              {
                fontSize: layout.sideSize,
                lineHeight: Math.round(layout.sideSize * 1.15),
                paddingHorizontal: Math.round(layout.sideSize * 0.9),
              },
            ]}
          >
            {currentSide} SIDE
          </Text>
        )}

        <TimerDigits text={timerText} fontSize={layout.digitsSize} />

        {repsTargetText && (
          <Text style={[styles.repsTarget, { fontSize: layout.repsSize }]} numberOfLines={1}>
            TARGET {repsTargetText}
          </Text>
        )}

        {layout.showDescription && description && (
          <Text
            style={[
              styles.exerciseDescriptionText,
              {
                fontSize: layout.descriptionSize,
                lineHeight: Math.round(layout.descriptionSize * 1.42),
              },
            ]}
            numberOfLines={layout.descriptionLines}
          >
            {description}
          </Text>
        )}
      </>
    );
  };

  const renderStage = (box: StageBox, allowDescription = true) =>
    isRest && upNext ? renderRestStage(box) : renderWorkStage(box, allowDescription);

  // The persistent footer only earns its space during work — in rest the
  // upcoming exercise is already the second hero on the stage.
  const renderUpNextBar = (compact = false) => {
    if (isRest || !upNext) return null;

    const barWidth = compact
      ? Math.max(width * 0.4 - spacing.md * 2, 140)
      : Math.max(width - spacing.lg * 2, 200);
    const fit = fitText(upNext.name, {
      maxWidth: barWidth,
      maxLines: 2,
      maxFontSize: compact ? clamp(height * 0.08, 16, 26) : clamp(height * 0.045, 20, 44),
      minFontSize: 15,
    });

    return (
      <View
        style={[
          styles.upNext,
          compact && styles.upNextLandscape,
          !compact && isCompactPortrait && styles.upNextCompactPortrait,
        ]}
      >
        <Text style={[styles.upNextLabel, { fontSize: compact ? scaleFont(10) : scaleFont(12) }]}>
          {upNext.restSeconds
            ? `UP NEXT · AFTER ${formatTime(upNext.restSeconds)} REST`
            : 'UP NEXT'}
        </Text>
        <Text
          style={[styles.upNextName, { fontSize: fit.fontSize, lineHeight: fit.lineHeight }]}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {upNext.name}
        </Text>
      </View>
    );
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
            paddingBottom: insets.bottom + (isCompactPortrait ? spacing.md : spacing.lg),
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
          <Ionicons name="play-skip-forward" size={useCompactControls ? 24 : 28} color={colors.text} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderPausedScreen = () => {
    const stageH = Math.max(
      height - insets.top - insets.bottom - (isCompactLandscape ? 120 : 220),
      200
    );
    const stageW = Math.max(width - spacing.lg * 2, 200);
    const nameFit = fitText(activeItem.name, {
      maxWidth: stageW,
      maxLines: 3,
      maxFontSize: clamp(stageH * 0.13, 22, 56),
      minFontSize: 20,
    });
    const pausedDigits = fitTimerDigits(
      digitsSizingText,
      stageW,
      clamp(stageH * 0.2, 40, 110)
    );

    return (
      <View style={[styles.pausedScreen, isCompactLandscape && styles.pausedScreenLandscape]}>
        <View style={[styles.pausedContent, isCompactLandscape && styles.pausedContentLandscape]}>
          <Text style={[styles.pausedText, isCompactLandscape && styles.pausedTextLandscape]}>
            PAUSED
          </Text>

          <Text
            style={[
              styles.pausedExerciseName,
              { fontSize: nameFit.fontSize, lineHeight: nameFit.lineHeight },
            ]}
            numberOfLines={3}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {activeItem.name}
          </Text>

          <View style={styles.pausedTimerBlock}>
            <TimerDigits text={timerText} fontSize={pausedDigits} />
            <Text style={styles.pausedTimerLabel}>REMAINING IN THIS STEP</Text>
          </View>

          {description &&
            (isCompactLandscape ? (
              <ScrollView
                style={[styles.pausedInstructions, styles.pausedInstructionsLandscape]}
                contentContainerStyle={styles.pausedInstructionsContent}
                showsVerticalScrollIndicator={true}
              >
                <Text style={[styles.pausedInstructionsText, styles.pausedInstructionsTextLandscape]}>
                  {description}
                </Text>
              </ScrollView>
            ) : (
              <View style={[styles.pausedInstructions, styles.pausedInstructionsPortrait]}>
                <Text style={styles.pausedInstructionsText} numberOfLines={4}>
                  {description}
                </Text>
              </View>
            ))}

          <Text style={[styles.pausedSubtext, isCompactLandscape && styles.pausedSubtextLandscape]}>
            Tap play to resume
          </Text>
        </View>

        {renderControls(isCompactLandscape)}
      </View>
    );
  };

  // Landscape splits the stage into two columns, so the hero column is measured
  // separately from the window.
  const landscapeStage: StageBox = {
    width: Math.max(stage.width - spacing.md * 2, 160),
    height: Math.max(stage.height - spacing.md, 160),
  };
  const portraitStage: StageBox = {
    width: Math.max(stage.width - spacing.md * 2, 200),
    height: Math.max(stage.height - spacing.md, 200),
  };

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
          style={[styles.closeButton, isCompactPortrait && styles.closeButtonCompactPortrait]}
        >
          <Ionicons name="close" size={isCompactPortrait ? 26 : 30} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTimeline}>
          <View style={[styles.headerMetric, styles.headerMetricLeft]}>
            <Text style={styles.headerMetricLabel}>ELAPSED</Text>
            <Text style={styles.headerMetricValue}>{formatTime(totalElapsed)}</Text>
          </View>
          <View style={styles.progressInfo}>
            <Text style={styles.headerMetricLabel}>STEP</Text>
            <Text style={styles.headerMetricValue}>
              {currentItemIndex + 1}/{items.length}
            </Text>
          </View>
          <View style={[styles.headerMetric, styles.headerMetricRight]}>
            <Text style={styles.headerMetricLabel}>LEFT</Text>
            <Text style={styles.headerMetricValue}>{formatTime(workoutTimeRemaining)}</Text>
          </View>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={isAudioMuted ? 'Unmute audio' : 'Mute audio'}
          onPress={toggleAudioMute}
          style={[styles.closeButton, isCompactPortrait && styles.closeButtonCompactPortrait]}
        >
          <Ionicons
            name={isAudioMuted ? 'volume-mute' : 'volume-high'}
            size={isCompactPortrait ? 24 : 26}
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
          <View style={styles.landscapePrimary} onLayout={handleStageLayout}>
            {stage.height > 0 && renderStage(landscapeStage, false)}
          </View>
          <View style={styles.landscapeSecondary}>
            {description && (
              <VerticalAutoScroll
                text={description}
                style={[styles.exerciseDescriptionText, styles.exerciseDescriptionTextLandscape]}
                containerHeight={56}
                lineHeight={20}
                pauseDuration={3000}
              />
            )}
            {renderUpNextBar(true)}
            {renderControls(true)}
          </View>
        </View>
      ) : (
        <>
          {/* Main Timer Display */}
          <View
            style={[styles.timerContainer, isCompactPortrait && styles.timerContainerCompactPortrait]}
            onLayout={handleStageLayout}
          >
            {stage.height > 0 && renderStage(portraitStage)}
          </View>

          {/* Up Next */}
          {renderUpNextBar()}

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
            <Text style={styles.exitConfirmMessage}>Your progress will be saved to history.</Text>
            <View style={styles.exitConfirmButtons}>
              <TouchableOpacity
                style={styles.exitKeepGoingButton}
                onPress={() => setShowExitConfirm(false)}
              >
                <Text style={styles.exitKeepGoingText}>Keep Going</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.exitEndButton} onPress={handleConfirmStop}>
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
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  headerLandscape: {
    paddingVertical: spacing.xs,
  },
  headerCompactPortrait: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  closeButton: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
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
    marginHorizontal: spacing.sm,
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
    fontFamily: fonts.displaySemiBold,
    fontSize: scaleFont(11),
    lineHeight: scaleFont(13),
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1,
  },
  headerMetricValue: {
    fontFamily: fonts.display,
    fontSize: scaleFont(22),
    lineHeight: scaleFont(25),
    color: colors.text,
    letterSpacing: 0.5,
  },
  progressInfo: {
    flex: 1,
    alignItems: 'center',
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  timerContainerCompactPortrait: {
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
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  itemName: {
    fontFamily: fonts.display,
    color: colors.text,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
    width: '100%',
  },
  sideIndicator: {
    fontFamily: fonts.displaySemiBold,
    color: colors.text,
    backgroundColor: 'rgba(0,0,0,0.28)',
    paddingVertical: spacing.xs,
    borderRadius: 999,
    marginBottom: spacing.sm,
    letterSpacing: 2.5,
    overflow: 'hidden',
    textAlign: 'center',
  },
  repsTarget: {
    fontFamily: fonts.displaySemiBold,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  restNextBlock: {
    width: '100%',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  restNextName: {
    fontFamily: fonts.display,
    color: colors.text,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    width: '100%',
  },
  restThen: {
    fontFamily: fonts.displaySemiBold,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  exerciseDescriptionText: {
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
    marginTop: spacing.md,
  },
  exerciseDescriptionTextLandscape: {
    fontSize: typography.sm,
    lineHeight: 20,
    paddingHorizontal: 0,
    marginTop: 0,
    textAlign: 'left',
  },
  upNext: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  upNextCompactPortrait: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  upNextLandscape: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 10,
    borderTopWidth: 0,
  },
  upNextLabel: {
    fontFamily: fonts.displaySemiBold,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 2,
    textAlign: 'center',
  },
  upNextName: {
    fontFamily: fonts.display,
    color: colors.text,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    width: '100%',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    padding: spacing.md,
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
  getReady: {
    fontFamily: fonts.displaySemiBold,
    color: colors.textSecondary,
    letterSpacing: 5,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  countdownNumber: {
    fontFamily: fonts.displayBlack,
    color: colors.text, // Default, overridden dynamically during countdown
    textAlign: 'center',
  },
  countdownNextBlock: {
    width: '100%',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  countdownNextLabel: {
    fontFamily: fonts.displaySemiBold,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  countdownNextName: {
    fontFamily: fonts.display,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    width: '100%',
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
    fontSize: typography['3xl'],
    color: colors.primaryLight,
    letterSpacing: 6,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  pausedTextLandscape: {
    fontSize: typography.xl,
    marginBottom: spacing.xs,
  },
  pausedExerciseName: {
    fontFamily: fonts.display,
    color: colors.text,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    width: '100%',
    marginBottom: spacing.sm,
  },
  pausedTimerBlock: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  pausedTimerLabel: {
    fontFamily: fonts.displaySemiBold,
    fontSize: scaleFont(11),
    lineHeight: scaleFont(13),
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1,
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
    lineHeight: Math.round(typography.base * 1.4),
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
    lineHeight: Math.round(typography.base * 1.4),
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
