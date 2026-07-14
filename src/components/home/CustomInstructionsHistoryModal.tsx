import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, borderRadius, typography } from '@/theme';
import { Button } from '@/components/common';

interface Props {
  visible: boolean;
  onClose: () => void;
  instructions: string[];
  onSelect: (instruction: string) => void;
  onClear: () => void;
}

export function CustomInstructionsHistoryModal({
  visible,
  onClose,
  instructions,
  onSelect,
  onClear,
}: Props) {
  const handleSelect = (instruction: string) => {
    onSelect(instruction);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Instruction History</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {instructions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>No saved instructions yet</Text>
              <Text style={styles.emptySubtext}>
                Your custom instructions will appear here after generating workouts
              </Text>
            </View>
          ) : (
            <>
              <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
              >
                {instructions.map((instruction, index) => (
                  <Pressable
                    key={index}
                    style={({ pressed }) => [
                      styles.instructionItem,
                      pressed && styles.instructionItemPressed,
                    ]}
                    onPress={() => handleSelect(instruction)}
                  >
                    <Text style={styles.instructionText} numberOfLines={3}>
                      {instruction}
                    </Text>
                    <Ionicons
                      name="arrow-forward"
                      size={18}
                      color={colors.textMuted}
                    />
                  </Pressable>
                ))}
              </ScrollView>

              <View style={styles.footer}>
                <Button
                  title="Clear All"
                  onPress={onClear}
                  variant="outline"
                  fullWidth
                  icon={<Ionicons name="trash-outline" size={18} color={colors.error} />}
                  style={styles.clearButton}
                />
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typography.xl,
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  closeButton: {
    padding: spacing.xs,
  },
  content: {
    flexGrow: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  instructionItemPressed: {
    backgroundColor: colors.surfaceLight,
  },
  instructionText: {
    flex: 1,
    fontSize: typography.sm,
    color: colors.text,
    lineHeight: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxxl,
  },
  emptyText: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: typography.sm,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  clearButton: {
    borderColor: colors.error,
  },
});
