import { Text, View, TouchableOpacity, StyleSheet } from 'react-native';
import { useHistorySaveStore } from '@/stores/useHistorySaveStore';
import { persistWorkoutHistory } from '@/services/historySync';
import { useHistoryStore } from '@/stores/useHistoryStore';
import { colors, spacing } from '@/theme';

export function HistorySaveStatus() {
  const { local, cloud } = useHistorySaveStore();
  const failed = cloud === 'error' || local === 'error';
  const message = cloud === 'saved'
    ? (local === 'error' ? 'Saved to cloud. Device storage needs attention.' : 'History saved to cloud')
    : cloud === 'syncing' ? 'Saving history…'
    : local === 'saved' ? 'Saved on this device. Cloud sync pending.'
    : local === 'error' ? 'History is not safely saved yet. Please retry before closing.' : 'Saving history…';
  const retry = () => {
    // Re-enqueue the current state if its prior local write failed.
    useHistoryStore.setState({ history: useHistoryStore.getState().history });
    void persistWorkoutHistory();
  };
  return <View style={styles.container} accessibilityLiveRegion="polite">
    <Text style={[styles.text, failed && styles.warning]}>{message}</Text>
    {failed ? <TouchableOpacity onPress={retry} accessibilityRole="button" accessibilityLabel="Retry saving workout history"><Text style={styles.retry}>Retry save</Text></TouchableOpacity> : null}
  </View>;
}
const styles = StyleSheet.create({
  container: { paddingVertical: spacing.sm, gap: spacing.xs },
  text: { color: colors.textMuted, fontSize: 13 },
  warning: { color: colors.warning },
  retry: { color: colors.primaryLight, fontSize: 15, paddingVertical: spacing.sm },
});
