import { useEffect, useRef, useCallback } from 'react';

interface UseTimerOptions {
  onTick?: () => void;
  onComplete?: () => void;
  interval?: number;
}

export function useTimer(
  isRunning: boolean,
  options: UseTimerOptions = {}
) {
  const { onTick, onComplete, interval = 1000 } = options;
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startTimer = useCallback(() => {
    if (intervalRef.current) return;

    intervalRef.current = setInterval(() => {
      onTick?.();
    }, interval);
  }, [interval, onTick]);

  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isRunning) {
      startTimer();
    } else {
      stopTimer();
    }

    return () => {
      stopTimer();
    };
  }, [isRunning, startTimer, stopTimer]);

  return {
    startTimer,
    stopTimer,
  };
}

export function useCountdown(
  initialValue: number,
  onComplete?: () => void
) {
  const [value, setValue] = useState(initialValue);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (!isRunning) return;

    if (value <= 0) {
      setIsRunning(false);
      onComplete?.();
      return;
    }

    const timeout = setTimeout(() => {
      setValue(value - 1);
    }, 1000);

    return () => clearTimeout(timeout);
  }, [isRunning, value, onComplete]);

  const start = useCallback(() => {
    setValue(initialValue);
    setIsRunning(true);
  }, [initialValue]);

  const stop = useCallback(() => {
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    setValue(initialValue);
    setIsRunning(false);
  }, [initialValue]);

  return {
    value,
    isRunning,
    start,
    stop,
    reset,
  };
}

import { useState } from 'react';
