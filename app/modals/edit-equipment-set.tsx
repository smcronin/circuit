import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input } from '@/components/common';
import { colors, spacing, typography, borderRadius } from '@/theme';
import { ALL_EQUIPMENT, EQUIPMENT_CATEGORIES, EQUIPMENT_PRESETS } from '@/utils/constants';
import { useUserStore } from '@/stores';

export default function EditEquipmentSetModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    id: string;
    name: string;
    equipment: string;
    notes: string;
    isDefault: string;
  }>();

  const updateEquipmentSet = useUserStore((state) => state.updateEquipmentSet);
  const setDefaultEquipmentSet = useUserStore((state) => state.setDefaultEquipmentSet);

  // Convert equipment names back to IDs for selection (standard equipment)
  // and extract custom equipment (names not in ALL_EQUIPMENT)
  const parseEquipment = (equipmentNames: string[]) => {
    const standardIds: string[] = [];
    const custom: string[] = [];

    equipmentNames.forEach((name) => {
      const found = ALL_EQUIPMENT.find((e) => e.name === name);
      if (found) {
        standardIds.push(found.id);
      } else if (name.trim()) {
        custom.push(name);
      }
    });

    return { standardIds, custom };
  };

  const initialEquipment = params.equipment ? params.equipment.split(',').filter(Boolean) : [];
  const { standardIds: initialEquipmentIds, custom: initialCustomEquipment } = parseEquipment(initialEquipment);

  const [selectedEquipment, setSelectedEquipment] = useState<string[]>(initialEquipmentIds);
  const [customEquipment, setCustomEquipment] = useState<string[]>(initialCustomEquipment);
  const [customInput, setCustomInput] = useState('');
  const [setName, setSetName] = useState(params.name || '');
  const [notes, setNotes] = useState(params.notes || '');
  const [isDefault, setIsDefault] = useState(params.isDefault === 'true');

  const toggleEquipment = (id: string) => {
    if (selectedEquipment.includes(id)) {
      setSelectedEquipment(selectedEquipment.filter((e) => e !== id));
    } else {
      setSelectedEquipment([...selectedEquipment, id]);
    }
  };

  const applyPreset = (presetKey: keyof typeof EQUIPMENT_PRESETS) => {
    const preset = EQUIPMENT_PRESETS[presetKey];
    setSelectedEquipment(preset.equipment);
    setCustomEquipment([]);
  };

  const addCustomEquipment = () => {
    const trimmed = customInput.trim();
    if (trimmed && !customEquipment.includes(trimmed)) {
      setCustomEquipment([...customEquipment, trimmed]);
      setCustomInput('');
    }
  };

  const removeCustomEquipment = (name: string) => {
    setCustomEquipment(customEquipment.filter((e) => e !== name));
  };

  const handleSave = () => {
    if (!params.id) return;

    const standardEquipment = selectedEquipment.map(
      (id) => ALL_EQUIPMENT.find((e) => e.id === id)?.name || id
    );

    updateEquipmentSet(params.id, {
      name: setName || 'My Equipment',
      equipment: [...standardEquipment, ...customEquipment],
      notes: notes.trim() || undefined,
    });

    if (isDefault && params.isDefault !== 'true') {
      setDefaultEquipmentSet(params.id);
    }

    router.back();
  };

  const getEquipmentByCategory = (categoryId: string) => {
    return ALL_EQUIPMENT.filter((e) => e.category === categoryId);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
    >
      {/* Modal Handle */}
      <View style={styles.handleContainer}>
        <View style={styles.handle} />
      </View>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Equipment Set</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Edit your{'\n'}equipment</Text>
        <Text style={styles.subtitle}>
          Update your equipment selection and preferences.
        </Text>

        {/* Quick Presets */}
        <View style={styles.presets}>
          <Text style={styles.presetsLabel}>Quick presets:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.presetsList}>
              {Object.entries(EQUIPMENT_PRESETS).map(([key, preset]) => (
                <TouchableOpacity
                  key={key}
                  style={styles.presetChip}
                  onPress={() => applyPreset(key as keyof typeof EQUIPMENT_PRESETS)}
                >
                  <Text style={styles.presetText}>{preset.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Set Name Input */}
        <Input
          label="Equipment set name"
          placeholder="e.g., Home Gym, Office..."
          value={setName}
          onChangeText={setSetName}
          containerStyle={styles.input}
        />

        {/* Notes Input */}
        <Input
          label="Equipment notes (optional)"
          placeholder="e.g., Dumbbells: 5-50 lbs, Kettlebell: 35 lbs"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={2}
          containerStyle={styles.input}
        />

        {/* Default Toggle */}
        <TouchableOpacity
          style={styles.defaultToggle}
          onPress={() => setIsDefault(!isDefault)}
        >
          <View style={[styles.checkbox, isDefault && styles.checkboxSelected]}>
            {isDefault && <Ionicons name="checkmark" size={14} color={colors.text} />}
          </View>
          <Text style={styles.defaultToggleText}>Set as default equipment</Text>
        </TouchableOpacity>

        {/* Equipment by Category */}
        {EQUIPMENT_CATEGORIES.map((category) => (
          <View key={category.id} style={styles.category}>
            <Text style={styles.categoryTitle}>{category.name}</Text>
            <View style={styles.equipmentGrid}>
              {getEquipmentByCategory(category.id).map((equipment) => (
                <TouchableOpacity
                  key={equipment.id}
                  style={[
                    styles.equipmentItem,
                    selectedEquipment.includes(equipment.id) && styles.equipmentItemSelected,
                  ]}
                  onPress={() => toggleEquipment(equipment.id)}
                >
                  <Ionicons
                    name={equipment.icon as keyof typeof Ionicons.glyphMap}
                    size={24}
                    color={
                      selectedEquipment.includes(equipment.id)
                        ? colors.text
                        : colors.textSecondary
                    }
                  />
                  <Text
                    style={[
                      styles.equipmentName,
                      selectedEquipment.includes(equipment.id) && styles.equipmentNameSelected,
                    ]}
                  >
                    {equipment.name}
                  </Text>
                  {selectedEquipment.includes(equipment.id) && (
                    <View style={styles.checkmark}>
                      <Ionicons name="checkmark" size={14} color={colors.text} />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Custom Equipment Section */}
        <View style={styles.category}>
          <Text style={styles.categoryTitle}>Custom Equipment</Text>
          <View style={styles.customInputRow}>
            <Input
              placeholder="Add your own equipment..."
              value={customInput}
              onChangeText={setCustomInput}
              containerStyle={styles.customInput}
              onSubmitEditing={addCustomEquipment}
            />
            <TouchableOpacity
              style={[styles.addButton, !customInput.trim() && styles.addButtonDisabled]}
              onPress={addCustomEquipment}
              disabled={!customInput.trim()}
            >
              <Ionicons name="add" size={24} color={customInput.trim() ? colors.text : colors.textMuted} />
            </TouchableOpacity>
          </View>
          {customEquipment.length > 0 && (
            <View style={styles.equipmentGrid}>
              {customEquipment.map((name) => (
                <TouchableOpacity
                  key={name}
                  style={[styles.equipmentItem, styles.equipmentItemSelected]}
                  onPress={() => removeCustomEquipment(name)}
                >
                  <Ionicons name="fitness-outline" size={24} color={colors.text} />
                  <Text style={[styles.equipmentName, styles.equipmentNameSelected]}>
                    {name}
                  </Text>
                  <View style={styles.removeIcon}>
                    <Ionicons name="close" size={14} color={colors.text} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {selectedEquipment.length + customEquipment.length === 0
            ? 'No equipment? No problem! Bodyweight workouts only.'
            : `${selectedEquipment.length + customEquipment.length} item${selectedEquipment.length + customEquipment.length !== 1 ? 's' : ''} selected`}
        </Text>
        <Button
          title="Save Changes"
          onPress={handleSave}
          size="lg"
          fullWidth
          disabled={!setName.trim()}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.text,
  },
  headerSpacer: {
    width: 32,
  },
  scrollView: {
    flex: 1,
    padding: spacing.lg,
  },
  title: {
    fontSize: typography['3xl'],
    fontWeight: typography.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.base,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 24,
  },
  presets: {
    marginBottom: spacing.lg,
  },
  presetsLabel: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  presetsList: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  presetChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
  input: {
    marginBottom: spacing.md,
  },
  defaultToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
    paddingVertical: spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  defaultToggleText: {
    fontSize: typography.sm,
    color: colors.text,
  },
  category: {
    marginBottom: spacing.xl,
  },
  categoryTitle: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  equipmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  equipmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  equipmentItemSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  equipmentName: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
  equipmentNameSelected: {
    color: colors.text,
  },
  checkmark: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  customInput: {
    flex: 1,
    marginBottom: 0,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: {
    backgroundColor: colors.surface,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  footerText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
