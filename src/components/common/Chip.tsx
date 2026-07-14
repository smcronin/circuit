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
  // A custom color renders as a tinted pill (translucent fill + colored text)
  // instead of a solid block — keeps small labels legible on dark surfaces.
  const tinted = Boolean(color && selected);

  const chipStyles = [
    styles.base,
    styles[`size_${size}`],
    variant === 'outline' ? styles.outline : styles.default,
    selected && !tinted && styles.selected,
    tinted && { backgroundColor: color + '26', borderColor: color + '55' },
    style,
  ];

  const textStyles = [
    styles.text,
    styles[`text_${size}`],
    selected && !tinted ? styles.textSelected : styles.textDefault,
    tinted && { color },
  ];

  const iconColor = tinted ? color : selected ? colors.text : colors.textSecondary;

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
    borderWidth: 1,
    borderColor: 'transparent',
  },
  default: {
    backgroundColor: colors.surfaceLight,
    borderColor: colors.hairline,
  },
  outline: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
  },
  selected: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryLight,
  },
  size_sm: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
  },
  size_md: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  text: {
    fontWeight: typography.semibold,
    textTransform: 'capitalize',
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
    color: '#FFFFFF',
  },
});
