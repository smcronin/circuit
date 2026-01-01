import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Input } from '@/components/common';
import { colors, spacing, typography, borderRadius } from '@/theme';
import { useUserStore, useHistoryStore } from '@/stores';
import { ALL_EQUIPMENT } from '@/utils/constants';
import { v4 as uuid } from 'uuid';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profile = useUserStore((state) => state.profile);
  const updateProfile = useUserStore((state) => state.updateProfile);
  const deleteEquipmentSet = useUserStore((state) => state.deleteEquipmentSet);
  const addEquipmentSet = useUserStore((state) => state.addEquipmentSet);
  const clearHistory = useHistoryStore((state) => state.clearHistory);
  const resetOnboarding = useUserStore((state) => state.resetOnboarding);

  const [showAddEquipment, setShowAddEquipment] = useState(false);
  const [newSetName, setNewSetName] = useState('');
  const [newSetNotes, setNewSetNotes] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [trainingNotes, setTrainingNotes] = useState(profile?.trainingNotes || '');
  const [isEditingNotes, setIsEditingNotes] = useState(false);

  const handleAddEquipmentSet = () => {
    if (!newSetName.trim()) return;

    const equipmentNames = selectedEquipment.map(
      (id) => ALL_EQUIPMENT.find((e) => e.id === id)?.name || id
    );

    addEquipmentSet({
      id: uuid(),
      name: newSetName.trim(),
      equipment: equipmentNames,
      notes: newSetNotes.trim() || undefined,
      isDefault: false,
    });

    setNewSetName('');
    setNewSetNotes('');
    setSelectedEquipment([]);
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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Profile</Text>

        {/* Goals Section */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Fitness Goals</Text>
            <TouchableOpacity onPress={() => router.push('/onboarding/goals')}>
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
              <TouchableOpacity
                onPress={() => handleDeleteSet(set.id)}
                style={styles.deleteButton}
              >
                <Ionicons name="trash-outline" size={18} color={colors.error} />
              </TouchableOpacity>
            </View>
          ))}
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
  deleteButton: {
    padding: spacing.sm,
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
});
