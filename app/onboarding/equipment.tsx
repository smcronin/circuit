import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input } from '@/components/common';
import { colors, spacing, typography, borderRadius } from '@/theme';
import { ALL_EQUIPMENT, EQUIPMENT_CATEGORIES, EQUIPMENT_PRESETS } from '@/utils/constants';
import { useUserStore } from '@/stores';
import { v4 as uuid } from 'uuid';

export default function OnboardingEquipment() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const updateProfile = useUserStore((state) => state.updateProfile);
  const profile = useUserStore((state) => state.profile);

  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [setName, setSetName] = useState('My Equipment');

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
    setSetName(preset.name);
  };

  const handleNext = () => {
    const equipmentSet = {
      id: uuid(),
      name: setName || 'My Equipment',
      equipment: selectedEquipment.map(
        (id) => ALL_EQUIPMENT.find((e) => e.id === id)?.name || id
      ),
      isDefault: true,
    };

    updateProfile({
      equipmentSets: [equipmentSet],
    });

    router.push('/onboarding/info');
  };

  const getEquipmentByCategory = (categoryId: string) => {
    return ALL_EQUIPMENT.filter((e) => e.category === categoryId);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.progress}>
            <View style={[styles.progressDot, styles.progressDotActive]} />
            <View style={[styles.progressDot, styles.progressDotActive]} />
            <View style={styles.progressDot} />
          </View>
        </View>

        <Text style={styles.title}>What equipment{'\n'}do you have?</Text>
        <Text style={styles.subtitle}>
          Select your available equipment. You can add more sets later.
        </Text>

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

        <Input
          label="Equipment set name"
          placeholder="e.g., Home Gym, Office..."
          value={setName}
          onChangeText={setSetName}
          containerStyle={styles.input}
        />

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
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {selectedEquipment.length === 0
            ? 'No equipment? No problem! We\'ll create bodyweight workouts.'
            : `${selectedEquipment.length} item${selectedEquipment.length !== 1 ? 's' : ''} selected`}
        </Text>
        <Button title="Continue" onPress={handleNext} size="lg" fullWidth />
      </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  backButton: {
    padding: spacing.sm,
    marginLeft: -spacing.sm,
  },
  progress: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceLight,
  },
  progressDotActive: {
    backgroundColor: colors.primary,
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
    marginBottom: spacing.xl,
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
