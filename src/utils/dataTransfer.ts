import * as DocumentPicker from 'expo-document-picker';
import { Platform, Share } from 'react-native';
import { useUserStore } from '@/stores/useUserStore';
import { useHistoryStore } from '@/stores/useHistoryStore';
import { useWeightStore } from '@/stores/useWeightStore';

const APP_DATA_VERSION = 1;

interface ExportedData {
  version: number;
  exportedAt: string;
  userProfile: ReturnType<typeof useUserStore.getState>['profile'];
  workoutHistory: ReturnType<typeof useHistoryStore.getState>['history'];
  workoutSummary: ReturnType<typeof useHistoryStore.getState>['workoutSummary'];
  weightEntries: ReturnType<typeof useWeightStore.getState>['entries'];
}

export const exportAllData = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    const userState = useUserStore.getState();
    const historyState = useHistoryStore.getState();
    const weightState = useWeightStore.getState();

    const exportData: ExportedData = {
      version: APP_DATA_VERSION,
      exportedAt: new Date().toISOString(),
      userProfile: userState.profile,
      workoutHistory: historyState.history,
      workoutSummary: historyState.workoutSummary,
      weightEntries: weightState.entries,
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const fileName = `circuit-backup-${new Date().toISOString().split('T')[0]}.json`;

    if (Platform.OS === 'web') {
      // Web: trigger download
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      // Native (Expo Go): Use Share API with the data as text
      // User can copy/paste or share to Notes/Files app
      await Share.share({
        message: jsonString,
        title: fileName,
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Export error:', error);
    return { success: false, error: String(error) };
  }
};

export const importAllData = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    let jsonString: string;

    if (Platform.OS === 'web') {
      // Web: file input
      jsonString = await new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (!file) {
            reject(new Error('No file selected'));
            return;
          }
          const text = await file.text();
          resolve(text);
        };
        input.oncancel = () => reject(new Error('Cancelled'));
        input.click();
      });
    } else {
      // Native: document picker
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) {
        return { success: false, error: 'No file selected' };
      }

      // Read file using fetch (works in Expo Go)
      const response = await fetch(result.assets[0].uri);
      jsonString = await response.text();
    }

    const importedData: ExportedData = JSON.parse(jsonString);

    // Validate the data structure
    if (!importedData.version || !importedData.exportedAt) {
      return { success: false, error: 'Invalid backup file format' };
    }

    // Restore user profile
    if (importedData.userProfile) {
      useUserStore.getState().setProfile(importedData.userProfile);
    }

    // Restore workout history
    if (importedData.workoutHistory) {
      useHistoryStore.setState({
        history: importedData.workoutHistory,
        workoutSummary: importedData.workoutSummary,
      });
    }

    // Restore weight entries
    if (importedData.weightEntries) {
      useWeightStore.setState({
        entries: importedData.weightEntries,
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Import error:', error);
    return { success: false, error: String(error) };
  }
};

export const getDataStats = () => {
  const userState = useUserStore.getState();
  const historyState = useHistoryStore.getState();
  const weightState = useWeightStore.getState();

  return {
    hasProfile: !!userState.profile,
    equipmentSets: userState.profile?.equipmentSets?.length || 0,
    workoutSessions: historyState.history.sessions.length,
    weightEntries: weightState.entries.length,
  };
};
