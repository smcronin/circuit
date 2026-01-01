import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Chip } from '@/components/common';
import { colors, spacing, typography, borderRadius } from '@/theme';
import { formatTimeVerbose } from '@/utils';

export default function ExerciseInfoModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    name: string;
    duration: string;
    description: string;
    muscleGroups: string;
    targetReps?: string;
    repRange?: string;
    equipment?: string;
    easier?: string;
    harder?: string;
  }>();

  const muscleGroups = params.muscleGroups?.split(',').filter(Boolean) || [];
  const equipment = params.equipment?.split(',').filter(Boolean) || [];

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <View style={styles.handle} />
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.exerciseName}>{params.name}</Text>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={18} color={colors.primary} />
            <Text style={styles.metaText}>
              {formatTimeVerbose(parseInt(params.duration || '0', 10))}
            </Text>
          </View>
          {params.targetReps && (
            <View style={styles.metaItem}>
              <Ionicons name="repeat-outline" size={18} color={colors.primary} />
              <Text style={styles.metaText}>{params.targetReps} reps</Text>
            </View>
          )}
          {params.repRange && (
            <View style={styles.metaItem}>
              <Ionicons name="repeat-outline" size={18} color={colors.primary} />
              <Text style={styles.metaText}>{params.repRange} reps</Text>
            </View>
          )}
        </View>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>How to Perform</Text>
          <Text style={styles.description}>{params.description}</Text>
        </Card>

        {muscleGroups.length > 0 && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Muscles Targeted</Text>
            <View style={styles.chipRow}>
              {muscleGroups.map((muscle, idx) => (
                <Chip key={idx} label={muscle} size="sm" />
              ))}
            </View>
          </Card>
        )}

        {equipment.length > 0 && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Equipment Needed</Text>
            <View style={styles.chipRow}>
              {equipment.map((item, idx) => (
                <Chip key={idx} label={item} size="sm" icon="fitness-outline" />
              ))}
            </View>
          </Card>
        )}

        {(params.easier || params.harder) && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Modifications</Text>
            {params.easier && (
              <View style={styles.modification}>
                <View style={[styles.modIcon, { backgroundColor: colors.success + '20' }]}>
                  <Ionicons name="remove-outline" size={16} color={colors.success} />
                </View>
                <View style={styles.modContent}>
                  <Text style={styles.modLabel}>Easier</Text>
                  <Text style={styles.modText}>{params.easier}</Text>
                </View>
              </View>
            )}
            {params.harder && (
              <View style={styles.modification}>
                <View style={[styles.modIcon, { backgroundColor: colors.error + '20' }]}>
                  <Ionicons name="add-outline" size={16} color={colors.error} />
                </View>
                <View style={styles.modContent}>
                  <Text style={styles.modLabel}>Harder</Text>
                  <Text style={styles.modText}>{params.harder}</Text>
                </View>
              </View>
            )}
          </Card>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button title="Got It" onPress={() => router.back()} fullWidth />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceLight,
    marginBottom: spacing.md,
  },
  closeButton: {
    position: 'absolute',
    right: spacing.md,
    top: spacing.md,
    padding: spacing.xs,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  exerciseName: {
    fontSize: typography['2xl'],
    fontWeight: typography.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: typography.base,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  modification: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  modIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modContent: {
    flex: 1,
  },
  modLabel: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.text,
    marginBottom: 2,
  },
  modText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
