import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

class SoundManager {
  private isInitialized = false;
  private audioContext: AudioContext | null = null;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      if (Platform.OS === 'web') {
        // Initialize Web Audio API for web platform
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      } else {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
        });
      }
      this.isInitialized = true;
    } catch (error) {
      console.warn('Audio initialization failed:', error);
    }
  }

  private async playTone(frequency: number, duration: number, type: OscillatorType = 'sine'): Promise<void> {
    if (Platform.OS !== 'web') return;

    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      // Resume audio context if suspended (browser autoplay policy)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = type;

      // Envelope for smoother sound
      const now = this.audioContext.currentTime;
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.3, now + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);

      oscillator.start(now);
      oscillator.stop(now + duration);
    } catch (error) {
      console.warn('Web audio playback failed:', error);
    }
  }

  async playCountdownTick(): Promise<void> {
    if (Platform.OS === 'web') {
      await this.playTone(880, 0.08, 'square'); // Short high beep
    } else {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (error) {
        console.warn('Haptic feedback failed:', error);
      }
    }
  }

  // Play distinct tones for 3, 2, 1 countdown
  async playCountdownNumber(count: number): Promise<void> {
    if (Platform.OS === 'web') {
      // Ascending tones: 3 = low, 2 = medium, 1 = high
      const frequencies: Record<number, number> = {
        3: 440,  // A4
        2: 554,  // C#5
        1: 659,  // E5
      };
      const freq = frequencies[count] || 440;
      await this.playTone(freq, 0.15, 'sine');
    } else {
      try {
        await Haptics.impactAsync(
          count === 1
            ? Haptics.ImpactFeedbackStyle.Heavy
            : Haptics.ImpactFeedbackStyle.Medium
        );
      } catch (error) {
        console.warn('Haptic feedback failed:', error);
      }
    }
  }

  // Play the "GO!" sound after countdown
  async playGo(): Promise<void> {
    if (Platform.OS === 'web') {
      // Strong double-beep GO sound
      await this.playTone(880, 0.12, 'square');  // A5
      setTimeout(() => this.playTone(1760, 0.2, 'square'), 120); // A6 (octave higher)
    } else {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (error) {
        console.warn('Haptic feedback failed:', error);
      }
    }
  }

  async playExerciseStart(): Promise<void> {
    if (Platform.OS === 'web') {
      // Two-tone ascending beep
      await this.playTone(523, 0.15, 'sine'); // C5
      setTimeout(() => this.playTone(659, 0.2, 'sine'), 150); // E5
    } else {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (error) {
        console.warn('Haptic feedback failed:', error);
      }
    }
  }

  async playRestStart(): Promise<void> {
    if (Platform.OS === 'web') {
      await this.playTone(392, 0.2, 'sine'); // G4 - lower, calming tone
    } else {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (error) {
        console.warn('Haptic feedback failed:', error);
      }
    }
  }

  async playWarning(): Promise<void> {
    if (Platform.OS === 'web') {
      // Quick double beep warning
      await this.playTone(1000, 0.1, 'square');
      setTimeout(() => this.playTone(1000, 0.1, 'square'), 150);
    } else {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } catch (error) {
        console.warn('Haptic feedback failed:', error);
      }
    }
  }

  async playWorkoutComplete(): Promise<void> {
    if (Platform.OS === 'web') {
      // Victory fanfare - ascending arpeggio
      await this.playTone(523, 0.15, 'sine'); // C5
      setTimeout(() => this.playTone(659, 0.15, 'sine'), 150); // E5
      setTimeout(() => this.playTone(784, 0.15, 'sine'), 300); // G5
      setTimeout(() => this.playTone(1047, 0.3, 'sine'), 450); // C6
    } else {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(async () => {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }, 200);
        setTimeout(async () => {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }, 400);
      } catch (error) {
        console.warn('Haptic feedback failed:', error);
      }
    }
  }

  async playButtonPress(): Promise<void> {
    if (Platform.OS === 'web') {
      await this.playTone(600, 0.05, 'sine'); // Very short subtle click
    } else {
      try {
        await Haptics.selectionAsync();
      } catch (error) {
        console.warn('Haptic feedback failed:', error);
      }
    }
  }
}

export const soundManager = new SoundManager();
