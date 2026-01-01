import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '@/theme';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: 'default' | 'outline';
  size?: 'sm' | 'md';
  style?: ViewStyle;
  color?: string;
}

export function Chip({
  label,
  selected = false,
  onPress,
  icon,
  variant = 'default',
  size = 'md',
  style,
  color,
}: ChipProps) {
  const chipStyles = [
    styles.base,
    styles[`size_${size}`],
    variant === 'outline' ? styles.outline : styles.default,
    selected && styles.selected,
    color && selected && { backgroundColor: color },
    style,
  ];

  const textStyles = [
    styles.text,
    styles[`text_${size}`],
    selected ? styles.textSelected : styles.textDefault,
  ];

  const iconColor = selected ? colors.text : colors.textSecondary;

  return (
    <TouchableOpacity
      style={chipStyles}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      {icon && <Ionicons name={icon} size={size === 'sm' ? 14 : 18} color={iconColor} />}
      <Text style={textStyles}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: borderRadius.full,
  },
  default: {
    backgroundColor: colors.surfaceLight,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  selected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  size_sm: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  size_md: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  text: {
    fontWeight: typography.medium,
  },
  text_sm: {
    fontSize: typography.xs,
  },
  text_md: {
    fontSize: typography.sm,
  },
  textDefault: {
    color: colors.textSecondary,
  },
  textSelected: {
    color: colors.text,
  },
});
