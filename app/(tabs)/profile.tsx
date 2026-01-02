import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Input } from '@/components/common';
import { colors, spacing, typography, borderRadius } from '@/theme';
import { useUserStore, useHistoryStore } from '@/stores';
import { ALL_EQUIPMENT } from '@/utils/constants';
import { v4 as uuid } from 'uuid';
import { summarizeWorkoutHistory } from '@/services/openrouter';
import { exportAllData, importAllData, getDataStats } from '@/utils/dataTransfer';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profile = useUserStore((state) => state.profile);
  const updateProfile = useUserStore((state) => state.updateProfile);
  const deleteEquipmentSet = useUserStore((state) => state.deleteEquipmentSet);
  const addEquipmentSet = useUserStore((state) => state.addEquipmentSet);
  const clearHistory = useHistoryStore((state) => state.clearHistory);
  const resetOnboarding = useUserStore((state) => state.resetOnboarding);
  const history = useHistoryStore((state) => state.history);
  const workoutSummary = useHistoryStore((state) => state.workoutSummary);
  const setWorkoutSummary = useHistoryStore((state) => state.setWorkoutSummary);
  const updateWorkoutSummary = useHistoryStore((state) => state.updateWorkoutSummary);
  const clearWorkoutSummary = useHistoryStore((state) => state.clearWorkoutSummary);
  const getRecentSessions = useHistoryStore((state) => state.getRecentSessions);

  const [showAddEquipment, setShowAddEquipment] = useState(false);
  const [newSetName, setNewSetName] = useState('');
  const [newSetNotes, setNewSetNotes] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [customEquipment, setCustomEquipment] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState('');
  const [trainingNotes, setTrainingNotes] = useState(profile?.trainingNotes || '');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isEditingMemory, setIsEditingMemory] = useState(false);
  const [editedMemory, setEditedMemory] = useState('');
  const [isGeneratingMemory, setIsGeneratingMemory] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const addCustomEquipmentItem = () => {
    const trimmed = customInput.trim();
    if (trimmed && !customEquipment.includes(trimmed)) {
      setCustomEquipment([...customEquipment, trimmed]);
      setCustomInput('');
    }
  };

  const removeCustomEquipment = (name: string) => {
    setCustomEquipment(customEquipment.filter((e) => e !== name));
  };

  const handleAddEquipmentSet = () => {
    if (!newSetName.trim()) return;

    const standardEquipment = selectedEquipment.map(
      (id) => ALL_EQUIPMENT.find((e) => e.id === id)?.name || id
    );

    addEquipmentSet({
      id: uuid(),
      name: newSetName.trim(),
      equipment: [...standardEquipment, ...customEquipment],
      notes: newSetNotes.trim() || undefined,
      isDefault: false,
    });

    setNewSetName('');
    setNewSetNotes('');
    setSelectedEquipment([]);
    setCustomEquipment([]);
    setCustomInput('');
    setShowAddEquipment(false);
  };

  const handleSaveTrainingNotes = () => {
    updateProfile({ trainingNotes: trainingNotes.trim() || undefined });
    setIsEditingNotes(false);
  };

  const handleDeleteSet = (id: string) => {
    Alert.alert(
      'Delete Equipment Set',
      'Are you sure you want to delete this equipment set?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteEquipmentSet(id) },
      ]
    );
  };

  const handleClearHistory = () => {
    Alert.alert(
      'Clear History',
      'This will delete all your workout history. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: clearHistory },
      ]
    );
  };

  const handleResetOnboarding = () => {
    Alert.alert(
      'Reset App',
      'This will reset the app and take you back to onboarding.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            resetOnboarding();
            router.replace('/onboarding');
          },
        },
      ]
    );
  };

  const handleGenerateMemory = async () => {
    const olderSessions = getRecentSessions(50).slice(5);
    if (olderSessions.length < 3) {
      Alert.alert(
        'Not Enough Data',
        'You need at least 8 completed workouts to generate a memory summary (5 recent + 3 for summary).'
      );
      return;
    }

    setIsGeneratingMemory(true);
    try {
      const summary = await summarizeWorkoutHistory(olderSessions);
      setWorkoutSummary(summary);
    } catch (error) {
      Alert.alert('Error', 'Failed to generate workout memory. Please try again.');
      console.error('Memory generation error:', error);
    } finally {
      setIsGeneratingMemory(false);
    }
  };

  const handleEditMemory = () => {
    setEditedMemory(workoutSummary?.summary || '');
    setIsEditingMemory(true);
  };

  const handleSaveMemory = () => {
    if (editedMemory.trim()) {
      updateWorkoutSummary(editedMemory.trim());
    }
    setIsEditingMemory(false);
  };

  const handleDeleteMemory = () => {
    Alert.alert(
      'Delete Workout Memory',
      'This will delete your workout memory summary. You can regenerate it later.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: clearWorkoutSummary },
      ]
    );
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const result = await exportAllData();
      if (result.success) {
        Alert.alert('Export Complete', 'Your data has been exported successfully.');
      } else {
        Alert.alert('Export Failed', result.error || 'An error occurred during export.');
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportData = () => {
    Alert.alert(
      'Import Data',
      'This will replace all your current data with the imported data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: async () => {
            setIsImporting(true);
            try {
              const result = await importAllData();
              if (result.success) {
                Alert.alert('Import Complete', 'Your data has been imported successfully.');
              } else {
                Alert.alert('Import Failed', result.error || 'An error occurred during import.');
              }
            } finally {
              setIsImporting(false);
            }
          },
        },
      ]
    );
  };

  const canGenerateMemory = getRecentSessions(50).slice(5).length >= 3;
  const dataStats = getDataStats();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Profile</Text>

        {/* Goals Section */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Fitness Goals</Text>
            <TouchableOpacity onPress={() => router.push('/modals/edit-goals')}>
              <Ionicons name="pencil" size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.goalsText}>{profile?.fitnessGoals || 'Not set'}</Text>
        </Card>

        {/* Training Notes Section */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Training Context</Text>
            <TouchableOpacity onPress={() => setIsEditingNotes(!isEditingNotes)}>
              <Ionicons
                name={isEditingNotes ? 'close' : 'pencil'}
                size={18}
                color={colors.primary}
              />
            </TouchableOpacity>
          </View>
          {isEditingNotes ? (
            <View>
              <Input
                placeholder="e.g., Can do pistol squats, handstand pushups, ring dips. Prefer compound movements. Bad left knee - avoid deep lunges."
                value={trainingNotes}
                onChangeText={setTrainingNotes}
                multiline
                numberOfLines={4}
                containerStyle={styles.input}
              />
              <Button title="Save" onPress={handleSaveTrainingNotes} size="sm" />
            </View>
          ) : (
            <Text style={styles.goalsText}>
              {profile?.trainingNotes || 'Add notes about your abilities, preferences, or limitations...'}
            </Text>
          )}
        </Card>

        {/* Workout Memory Section */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Workout Memory</Text>
            {workoutSummary && (
              <View style={styles.memoryActions}>
                <TouchableOpacity onPress={handleEditMemory} style={styles.memoryAction}>
                  <Ionicons name="pencil" size={18} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDeleteMemory} style={styles.memoryAction}>
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {isGeneratingMemory ? (
            <View style={styles.memoryLoading}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.memoryLoadingText}>Generating workout memory...</Text>
            </View>
          ) : workoutSummary ? (
            isEditingMemory ? (
              <View>
                <Input
                  value={editedMemory}
                  onChangeText={setEditedMemory}
                  multiline
                  numberOfLines={4}
                  containerStyle={styles.input}
                />
                <View style={styles.memoryEditButtons}>
                  <Button title="Save" onPress={handleSaveMemory} size="sm" />
                  <Button
                    title="Cancel"
                    onPress={() => setIsEditingMemory(false)}
                    size="sm"
                    variant="outline"
                  />
                </View>
              </View>
            ) : (
              <View>
                <Text style={styles.memoryText}>{workoutSummary.summary}</Text>
                <View style={styles.memoryMeta}>
                  <Text style={styles.memoryMetaText}>
                    Based on {workoutSummary.totalWorkouts} workouts ({workoutSummary.dateRange})
                  </Text>
                  {workoutSummary.averageRPE && (
                    <Text style={styles.memoryMetaText}>
                      Avg RPE: {workoutSummary.averageRPE.toFixed(1)}/10
                    </Text>
                  )}
                  <Text style={styles.memoryMetaText}>
                    Updated: {new Date(workoutSummary.generatedAt).toLocaleDateString()}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.regenerateButton}
                  onPress={handleGenerateMemory}
                  activeOpacity={0.7}
                >
                  <Ionicons name="refresh" size={14} color={colors.primary} />
                  <Text style={styles.regenerateText}>Regenerate</Text>
                </TouchableOpacity>
              </View>
            )
          ) : canGenerateMemory ? (
            <View>
              <Text style={styles.memoryEmptyText}>
                Generate a summary of your workout history to personalize future workouts.
              </Text>
              <Button
                title="Generate Workout Memory"
                onPress={handleGenerateMemory}
                size="sm"
                variant="outline"
              />
            </View>
          ) : (
            <Text style={styles.memoryEmptyText}>
              Complete at least 8 workouts to generate a workout memory summary.
              {history.sessions.length > 0 && ` (${history.sessions.length} completed so far)`}
            </Text>
          )}
        </Card>

        {/* Personal Info Section */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Personal Info</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Age</Text>
            <Text style={styles.infoValue}>{profile?.age || 'Not set'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Weight</Text>
            <Text style={styles.infoValue}>
              {profile?.weight ? `${profile.weight} ${profile.weightUnit}` : 'Not set'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Preferred Duration</Text>
            <Text style={styles.infoValue}>{profile?.preferredWorkoutDuration} min</Text>
          </View>
        </Card>

        {/* Equipment Sets Section */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Equipment Sets</Text>
            <TouchableOpacity onPress={() => setShowAddEquipment(!showAddEquipment)}>
              <Ionicons
                name={showAddEquipment ? 'close' : 'add'}
                size={22}
                color={colors.primary}
              />
            </TouchableOpacity>
          </View>

          {showAddEquipment && (
            <View style={styles.addEquipmentForm}>
              <Input
                label="Set Name"
                placeholder="e.g., Office Gym"
                value={newSetName}
                onChangeText={setNewSetName}
                containerStyle={styles.input}
              />
              <Input
                label="Equipment Notes (optional)"
                placeholder="e.g., Dumbbells: 5-25 lbs, Kettlebell: 35 lbs"
                value={newSetNotes}
                onChangeText={setNewSetNotes}
                multiline
                numberOfLines={2}
                containerStyle={styles.input}
              />
              <View style={styles.equipmentGrid}>
                {ALL_EQUIPMENT.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.equipmentChip,
                      selectedEquipment.includes(item.id) && styles.equipmentChipSelected,
                    ]}
                    onPress={() => {
                      if (selectedEquipment.includes(item.id)) {
                        setSelectedEquipment(selectedEquipment.filter((id) => id !== item.id));
                      } else {
                        setSelectedEquipment([...selectedEquipment, item.id]);
                      }
                    }}
                  >
                    <Text
                      style={[
                        styles.equipmentChipText,
                        selectedEquipment.includes(item.id) && styles.equipmentChipTextSelected,
                      ]}
                    >
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Custom Equipment */}
              <Text style={styles.customLabel}>Custom Equipment</Text>
              <View style={styles.customInputRow}>
                <Input
                  placeholder="Add your own..."
                  value={customInput}
                  onChangeText={setCustomInput}
                  containerStyle={styles.customInputField}
                  onSubmitEditing={addCustomEquipmentItem}
                />
                <TouchableOpacity
                  style={[styles.addCustomButton, !customInput.trim() && styles.addCustomButtonDisabled]}
                  onPress={addCustomEquipmentItem}
                  disabled={!customInput.trim()}
                >
                  <Ionicons name="add" size={20} color={customInput.trim() ? colors.text : colors.textMuted} />
                </TouchableOpacity>
              </View>
              {customEquipment.length > 0 && (
                <View style={styles.equipmentGrid}>
                  {customEquipment.map((name) => (
                    <TouchableOpacity
                      key={name}
                      style={[styles.equipmentChip, styles.equipmentChipSelected]}
                      onPress={() => removeCustomEquipment(name)}
                    >
                      <Text style={[styles.equipmentChipText, styles.equipmentChipTextSelected]}>
                        {name}
                      </Text>
                      <Ionicons name="close" size={12} color={colors.text} style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Button
                title="Add Equipment Set"
                onPress={handleAddEquipmentSet}
                disabled={!newSetName.trim()}
                fullWidth
              />
            </View>
          )}

          {profile?.equipmentSets.map((set) => (
            <View key={set.id} style={styles.equipmentSetItem}>
              <View style={styles.equipmentSetInfo}>
                <View style={styles.equipmentSetHeader}>
                  <Text style={styles.equipmentSetName}>{set.name}</Text>
                  {set.isDefault && (
                    <View style={styles.defaultBadge}>
                      <Text style={styles.defaultText}>Default</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.equipmentSetItems} numberOfLines={1}>
                  {set.equipment.length === 0
                    ? 'Bodyweight only'
                    : set.equipment.join(', ')}
                </Text>
                {set.notes && (
                  <Text style={styles.equipmentSetNotes} numberOfLines={2}>
                    {set.notes}
                  </Text>
                )}
              </View>
              <View style={styles.equipmentSetActions}>
                <TouchableOpacity
                  onPress={() => {
                    router.push({
                      pathname: '/modals/edit-equipment-set',
                      params: {
                        id: set.id,
                        name: set.name,
                        equipment: set.equipment.join(','),
                        notes: set.notes || '',
                        isDefault: set.isDefault ? 'true' : 'false',
                      },
                    });
                  }}
                  style={styles.actionButton}
                >
                  <Ionicons name="pencil" size={18} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDeleteSet(set.id)}
                  style={styles.actionButton}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </Card>

        {/* Data Backup Section */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Data Backup</Text>
          </View>
          <Text style={styles.backupDescription}>
            Export your data to transfer between devices or create a backup.
          </Text>
          <View style={styles.backupStats}>
            <Text style={styles.backupStatText}>
              {dataStats.workoutSessions} workouts, {dataStats.weightEntries} weight entries, {dataStats.equipmentSets} equipment sets
            </Text>
          </View>
          <View style={styles.backupButtons}>
            <TouchableOpacity
              style={styles.backupButton}
              onPress={handleExportData}
              disabled={isExporting}
            >
              {isExporting ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="download-outline" size={20} color={colors.primary} />
              )}
              <Text style={styles.backupButtonText}>Export Data</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.backupButton}
              onPress={handleImportData}
              disabled={isImporting}
            >
              {isImporting ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="cloud-upload-outline" size={20} color={colors.primary} />
              )}
              <Text style={styles.backupButtonText}>Import Data</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Danger Zone */}
        <Card style={styles.dangerSection}>
          <Text style={styles.dangerTitle}>Danger Zone</Text>
          <TouchableOpacity style={styles.dangerButton} onPress={handleClearHistory}>
            <Ionicons name="trash-outline" size={20} color={colors.error} />
            <Text style={styles.dangerButtonText}>Clear Workout History</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dangerButton} onPress={handleResetOnboarding}>
            <Ionicons name="refresh-outline" size={20} color={colors.error} />
            <Text style={styles.dangerButtonText}>Reset App</Text>
          </TouchableOpacity>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
    padding: spacing.lg,
  },
  title: {
    fontSize: typography['2xl'],
    fontWeight: typography.bold,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.text,
  },
  goalsText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: typography.sm,
    color: colors.text,
    fontWeight: typography.medium,
  },
  addEquipmentForm: {
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  input: {
    marginBottom: spacing.md,
  },
  equipmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  equipmentChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  equipmentChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  equipmentChipText: {
    fontSize: typography.xs,
    color: colors.textSecondary,
  },
  equipmentChipTextSelected: {
    color: colors.text,
  },
  customLabel: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  customInputField: {
    flex: 1,
    marginBottom: 0,
  },
  addCustomButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCustomButtonDisabled: {
    backgroundColor: colors.surface,
  },
  equipmentSetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  equipmentSetInfo: {
    flex: 1,
  },
  equipmentSetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 4,
  },
  equipmentSetName: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
    color: colors.text,
  },
  defaultBadge: {
    backgroundColor: colors.primary + '30',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  defaultText: {
    fontSize: typography.xs,
    color: colors.primary,
    fontWeight: typography.medium,
  },
  equipmentSetItems: {
    fontSize: typography.xs,
    color: colors.textSecondary,
  },
  equipmentSetNotes: {
    fontSize: typography.xs,
    color: colors.primary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  equipmentSetActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionButton: {
    padding: spacing.sm,
  },
  backupDescription: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  backupStats: {
    backgroundColor: colors.surfaceLight,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
  },
  backupStatText: {
    fontSize: typography.xs,
    color: colors.textMuted,
    textAlign: 'center',
  },
  backupButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  backupButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary + '15',
    borderRadius: borderRadius.md,
  },
  backupButtonText: {
    fontSize: typography.sm,
    color: colors.primary,
    fontWeight: typography.medium,
  },
  dangerSection: {
    marginBottom: spacing.xxl,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  dangerTitle: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.error,
    marginBottom: spacing.md,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  dangerButtonText: {
    fontSize: typography.sm,
    color: colors.error,
  },
  memoryActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  memoryAction: {
    padding: spacing.xs,
  },
  memoryLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  memoryLoadingText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  memoryText: {
    fontSize: typography.sm,
    color: colors.text,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  memoryMeta: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  memoryMetaText: {
    fontSize: typography.xs,
    color: colors.textMuted,
  },
  memoryEditButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  memoryEmptyText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  regenerateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  regenerateText: {
    fontSize: typography.sm,
    color: colors.primary,
    fontWeight: typography.medium,
  },
});
