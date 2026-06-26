import { useHistoryStore, useUserStore, useWeightStore } from '@/stores';
import type { UserProfile, WorkoutHistory, WeightEntry } from '@/types/workout';
import type { SummarizedWorkoutHistory } from '@/types/llm';

const DEV_SEED_BACKUP_PATH = '/dev-seed-circuit-backup.json';
const CURRENT_PROGRAM_PRIORITY =
  'Current programming priority: improve body composition and metabolic health, with Zone 2 cardio for LDL support; keep climbing strength as a secondary, fun training theme.';

function withCurrentProgramPriority(fitnessGoals: string): string {
  const cleanedGoals = fitnessGoals.replace(CURRENT_PROGRAM_PRIORITY, '').trim();
  return cleanedGoals ? `${CURRENT_PROGRAM_PRIORITY}\n\n${cleanedGoals}` : CURRENT_PROGRAM_PRIORITY;
}

interface ExportedData {
  version: number;
  exportedAt: string;
  userProfile: UserProfile | null;
  workoutHistory?: WorkoutHistory;
  workoutSummary?: SummarizedWorkoutHistory;
  weightEntries?: WeightEntry[];
  savedCustomInstructions?: string[];
  isAudioMuted?: boolean;
}

interface HydratableStore {
  persist?: {
    hasHydrated: () => boolean;
    onFinishHydration: (callback: () => void) => () => void;
  };
}

function waitForHydration(store: HydratableStore): Promise<void> {
  if (!store.persist || store.persist.hasHydrated()) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let unsubscribe = () => {};
    const timeout = setTimeout(() => {
      unsubscribe();
      resolve();
    }, 1500);
    unsubscribe = store.persist!.onFinishHydration(() => {
      clearTimeout(timeout);
      unsubscribe();
      resolve();
    });
  });
}

export async function seedDevAppDataFromBackup(): Promise<boolean> {
  if (!__DEV__) {
    return false;
  }

  await Promise.all([
    waitForHydration(useUserStore),
    waitForHydration(useHistoryStore),
    waitForHydration(useWeightStore),
  ]);

  if (useUserStore.getState().profile) {
    return false;
  }

  const response = await fetch(DEV_SEED_BACKUP_PATH, { cache: 'no-store' });
  if (!response.ok) {
    return false;
  }

  const importedData = (await response.json()) as ExportedData;
  if (!importedData.version || !importedData.exportedAt || !importedData.userProfile) {
    return false;
  }

  useUserStore.getState().setProfile({
    ...importedData.userProfile,
    fitnessGoals: withCurrentProgramPriority(importedData.userProfile.fitnessGoals),
    hasCompletedOnboarding: true,
  });

  useUserStore.setState({
    savedCustomInstructions: importedData.savedCustomInstructions ?? [],
    isAudioMuted: importedData.isAudioMuted ?? false,
  });

  if (importedData.workoutHistory) {
    useHistoryStore.setState({
      history: importedData.workoutHistory,
      workoutSummary: importedData.workoutSummary,
    });
  }

  if (importedData.weightEntries) {
    useWeightStore.setState({
      entries: importedData.weightEntries,
    });
  }

  return true;
}

export function applyDevCurrentProgramPreferences(): void {
  if (!__DEV__) {
    return;
  }

  const profile = useUserStore.getState().profile;
  if (!profile || profile.fitnessGoals.startsWith(CURRENT_PROGRAM_PRIORITY)) {
    return;
  }

  useUserStore.getState().updateProfile({
    fitnessGoals: withCurrentProgramPriority(profile.fitnessGoals),
  });
}
