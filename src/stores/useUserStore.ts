import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile, EquipmentSet } from '@/types/workout';

interface UserState {
  profile: UserProfile | null;
  isLoading: boolean;
  setProfile: (profile: UserProfile) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  addEquipmentSet: (set: EquipmentSet) => void;
  updateEquipmentSet: (id: string, updates: Partial<EquipmentSet>) => void;
  deleteEquipmentSet: (id: string) => void;
  setDefaultEquipmentSet: (id: string) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      profile: null,
      isLoading: false,

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
    }),
    {
      name: 'user-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
