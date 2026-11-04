import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile, EquipmentSet } from '@/types/workout';

interface UserState {
  profile: UserProfile | null;
  isLoading: boolean;
  savedCustomInstructions: string[];
  isAudioMuted: boolean;
  setProfile: (profile: UserProfile) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  addEquipmentSet: (set: EquipmentSet) => void;
  updateEquipmentSet: (id: string, updates: Partial<EquipmentSet>) => void;
  deleteEquipmentSet: (id: string) => void;
  setDefaultEquipmentSet: (id: string) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  addCustomInstruction: (instruction: string) => void;
  clearCustomInstructions: () => void;
  toggleAudioMute: () => void;
}

// The weigh-in itself has a separate durable store. Let the form observe
// errors when refreshing this secondary copy of today's weight in the profile.
let profileWrite: Promise<void>;
const profileStorage = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
  setItem: (key: string, value: string) => (profileWrite = AsyncStorage.setItem(key, value)),
};
export async function mirrorWeightToProfile(weight: number) {
  useUserStore.getState().updateProfile({ weight });
  await profileWrite;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      profile: null,
      isLoading: false,
      savedCustomInstructions: [],
      isAudioMuted: false,

      setProfile: (profile) => set({ profile }),

      updateProfile: (updates) =>
        set((state) => ({
          profile: state.profile ? { ...state.profile, ...updates } : null,
        })),

      addEquipmentSet: (equipmentSet) =>
        set((state) => ({
          profile: state.profile
            ? {
                ...state.profile,
                equipmentSets: [...state.profile.equipmentSets, equipmentSet],
              }
            : null,
        })),

      updateEquipmentSet: (id, updates) =>
        set((state) => ({
          profile: state.profile
            ? {
                ...state.profile,
                equipmentSets: state.profile.equipmentSets.map((s) =>
                  s.id === id ? { ...s, ...updates } : s
                ),
              }
            : null,
        })),

      deleteEquipmentSet: (id) =>
        set((state) => ({
          profile: state.profile
            ? {
                ...state.profile,
                equipmentSets: state.profile.equipmentSets.filter((s) => s.id !== id),
              }
            : null,
        })),

      setDefaultEquipmentSet: (id) =>
        set((state) => ({
          profile: state.profile
            ? {
                ...state.profile,
                equipmentSets: state.profile.equipmentSets.map((s) => ({
                  ...s,
                  isDefault: s.id === id,
                })),
              }
            : null,
        })),

      completeOnboarding: () =>
        set((state) => ({
          profile: state.profile
            ? { ...state.profile, hasCompletedOnboarding: true }
            : null,
        })),

      resetOnboarding: () =>
        set((state) => ({
          profile: state.profile
            ? { ...state.profile, hasCompletedOnboarding: false }
            : null,
        })),

      addCustomInstruction: (instruction) =>
        set((state) => {
          const trimmed = instruction.trim();
          // Don't save empty or duplicate instructions
          if (!trimmed || state.savedCustomInstructions.includes(trimmed)) {
            return state;
          }
          // Add to beginning of array (most recent first), limit to 20
          return {
            savedCustomInstructions: [trimmed, ...state.savedCustomInstructions].slice(0, 20),
          };
        }),

      clearCustomInstructions: () => set({ savedCustomInstructions: [] }),

      toggleAudioMute: () =>
        set((state) => ({ isAudioMuted: !state.isAudioMuted })),
    }),
    {
      name: 'user-storage',
      storage: createJSONStorage(() => profileStorage),
    }
  )
);
