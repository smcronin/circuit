import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, spacing, borderRadius } from '@/theme';

interface StatTileProps {
  label: string;
  value: string;
  /** 'lg' for the sparser 3-up grids (end-of-workout confirm). */
  size?: 'md' | 'lg';
}

/**
 * One stat in a recorded-workout grid. Shared by the save screen, the ride
 * detail screen, and the end-of-workout confirmation so the three grids a user
 * sees for the same workout stay pixel-identical.
 */
export function StatTile({ label, value, size = 'md' }: StatTileProps) {
  return (
    <View style={[styles.tile, size === 'lg' && styles.tileLg]}>
      <Text
        style={[styles.value, size === 'lg' && styles.valueLg]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexGrow: 1,
    flexBasis: '30%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
  },
  tileLg: {
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
  },
  value: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.text,
  },
  valueLg: {
    fontSize: 30,
  },
  label: {
    fontSize: 10,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
  },
});
