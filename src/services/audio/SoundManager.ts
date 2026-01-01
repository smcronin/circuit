import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Sound file imports
const SOUND_FILES = {
  countdown3: require('../../../assets/sounds/countdown-3.wav'),
  countdown2: require('../../../assets/sounds/countdown-2.wav'),
  countdown1: require('../../../assets/sounds/countdown-1.wav'),
  go: require('../../../assets/sounds/go.wav'),
  exerciseStart: require('../../../assets/sounds/exercise-start.wav'),
  restStart: require('../../../assets/sounds/rest-start.wav'),
  warning: require('../../../assets/sounds/warning.wav'),
  tick: require('../../../assets/sounds/tick.wav'),
  click: require('../../../assets/sounds/click.wav'),
  sideSwitch: require('../../../assets/sounds/side-switch.wav'),
  complete: require('../../../assets/sounds/complete.wav'),
};

type SoundName = keyof typeof SOUND_FILES;

class SoundManager {
  private isInitialized = false;
  private audioContext: AudioContext | null = null;
  private sounds: Map<SoundName, Audio.Sound> = new Map();
  private audioEnabled = true;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      if (Platform.OS === 'web') {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      } else {
        // Configure audio mode for iOS/Android
        // MixWithOthers allows our sounds to play alongside Spotify, podcasts, etc.
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
          interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
          shouldDuckAndroid: true, // Lower other audio volume slightly when playing
          playThroughEarpieceAndroid: false,
        });

        // Preload all sounds
        await this.preloadSounds();
      }
      this.isInitialized = true;
    } catch (error) {
      console.warn('Audio initialization failed:', error);
    }
  }

  private async preloadSounds(): Promise<void> {
    const soundNames = Object.keys(SOUND_FILES) as SoundName[];

    for (const name of soundNames) {
      try {
        const { sound } = await Audio.Sound.createAsync(SOUND_FILES[name], {
          shouldPlay: false,
        });
        this.sounds.set(name, sound);
      } catch (error) {
        console.warn(`Failed to load sound ${name}:`, error);
      }
    }
  }

  setAudioEnabled(enabled: boolean): void {
    this.audioEnabled = enabled;
  }

  private async playSound(name: SoundName): Promise<void> {
    if (!this.audioEnabled) return;

    if (Platform.OS === 'web') {
      // Use Web Audio API for web
      await this.playWebTone(name);
    } else {
      // Play bundled sound on native
      try {
        const sound = this.sounds.get(name);
        if (sound) {
          await sound.setPositionAsync(0);
          await sound.playAsync();
        }
      } catch (error) {
        console.warn(`Failed to play sound ${name}:`, error);
      }
    }
  }

  private async playWebTone(name: SoundName): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    // Map sound names to frequencies and durations for web
    const toneConfigs: Record<SoundName, { freq: number; duration: number; type?: OscillatorType }> = {
      countdown3: { freq: 440, duration: 0.15 },
      countdown2: { freq: 554, duration: 0.15 },
      countdown1: { freq: 659, duration: 0.15 },
      go: { freq: 880, duration: 0.2, type: 'square' },
      exerciseStart: { freq: 523, duration: 0.15 },
      restStart: { freq: 392, duration: 0.2 },
      warning: { freq: 1000, duration: 0.1, type: 'square' },
      tick: { freq: 880, duration: 0.05, type: 'square' },
      click: { freq: 600, duration: 0.03 },
      sideSwitch: { freq: 784, duration: 0.1 },
      complete: { freq: 523, duration: 0.15 },
    };

    const config = toneConfigs[name];
    await this.playTone(config.freq, config.duration, config.type || 'sine');
  }

  private async playTone(frequency: number, duration: number, type: OscillatorType = 'sine'): Promise<void> {
    if (!this.audioContext) return;

    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = type;

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

  private async playHaptic(style: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'selection'): Promise<void> {
    if (Platform.OS === 'web') return;

    try {
      switch (style) {
        case 'light':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'medium':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case 'heavy':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;
        case 'success':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case 'warning':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          break;
        case 'selection':
          await Haptics.selectionAsync();
          break;
      }
    } catch (error) {
      console.warn('Haptic feedback failed:', error);
    }
  }

  async playCountdownTick(): Promise<void> {
    await Promise.all([
      this.playSound('tick'),
      this.playHaptic('light'),
    ]);
  }

  async playCountdownNumber(count: number): Promise<void> {
    const soundMap: Record<number, SoundName> = {
      3: 'countdown3',
      2: 'countdown2',
      1: 'countdown1',
    };

    await Promise.all([
      this.playSound(soundMap[count] || 'countdown1'),
      this.playHaptic(count === 1 ? 'heavy' : 'medium'),
    ]);
  }

  async playGo(): Promise<void> {
    await Promise.all([
      this.playSound('go'),
      this.playHaptic('success'),
    ]);
  }

  async playExerciseStart(): Promise<void> {
    await Promise.all([
      this.playSound('exerciseStart'),
      this.playHaptic('success'),
    ]);
  }

  async playRestStart(): Promise<void> {
    await Promise.all([
      this.playSound('restStart'),
      this.playHaptic('medium'),
    ]);
  }

  async playWarning(): Promise<void> {
    await Promise.all([
      this.playSound('warning'),
      this.playHaptic('heavy'),
    ]);
  }

  async playWorkoutComplete(): Promise<void> {
    await Promise.all([
      this.playSound('complete'),
      this.playHaptic('success'),
    ]);
  }

  async playButtonPress(): Promise<void> {
    await Promise.all([
      this.playSound('click'),
      this.playHaptic('selection'),
    ]);
  }

  async playSideSwitch(): Promise<void> {
    await Promise.all([
      this.playSound('sideSwitch'),
      this.playHaptic('warning'),
    ]);
  }

  // Cleanup when app is closing
  async unload(): Promise<void> {
    for (const sound of this.sounds.values()) {
      try {
        await sound.unloadAsync();
      } catch (error) {
        // Ignore unload errors
      }
    }
    this.sounds.clear();
    this.isInitialized = false;
  }
}

export const soundManager = new SoundManager();
