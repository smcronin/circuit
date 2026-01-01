import { create } from 'zustand';
import { GeneratedWorkout, FlattenedWorkout } from '@/types/workout';

interface WorkoutState {
  currentWorkout: GeneratedWorkout | null;
  flattenedWorkout: FlattenedWorkout | null;
  isGenerating: boolean;
  generationError: string | null;
  feedbackMessage: string;
  selectedEquipmentSetId: string | null;
  selectedDuration: number;

  setCurrentWorkout: (workout: GeneratedWorkout) => void;
  setFlattenedWorkout: (workout: FlattenedWorkout) => void;
  clearCurrentWorkout: () => void;
  setIsGenerating: (isGenerating: boolean) => void;
  setGenerationError: (error: string | null) => void;
  setFeedbackMessage: (message: string) => void;
  clearFeedback: () => void;
  setSelectedEquipmentSetId: (id: string | null) => void;
  setSelectedDuration: (duration: number) => void;
}

export const useWorkoutStore = create<WorkoutState>((set) => ({
  currentWorkout: null,
  flattenedWorkout: null,
  isGenerating: false,
  generationError: null,
  feedbackMessage: '',
  selectedEquipmentSetId: null,
  selectedDuration: 30,

  setCurrentWorkout: (workout) => set({ currentWorkout: workout }),
  setFlattenedWorkout: (workout) => set({ flattenedWorkout: workout }),
  clearCurrentWorkout: () =>
    set({
      currentWorkout: null,
      flattenedWorkout: null,
      feedbackMessage: '',
    }),
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  setGenerationError: (error) => set({ generationError: error }),
  setFeedbackMessage: (message) => set({ feedbackMessage: message }),
  clearFeedback: () => set({ feedbackMessage: '' }),
  setSelectedEquipmentSetId: (id) => set({ selectedEquipmentSetId: id }),
  setSelectedDuration: (duration) => set({ selectedDuration: duration }),
}));
