import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, fonts, spacing, typography, borderRadius } from '@/theme';
import { getRpeColor, getRpeLabel } from '@/utils/rpe';

interface RpeSelectorProps {
  value?: number;
  /** Tapping the selected value again deselects (passes undefined). */
  onChange: (value?: number) => void;
}

/**
 * The 1-10 RPE picker with the Easy/Moderate/Maximum caption row and the
 * selected-value readout. Shared by the workout-complete, edit-feedback, and
 * recorded-workout save screens so the app's most-touched input control can't
 * drift between them.
 */
export function RpeSelector({ value, onChange }: RpeSelectorProps) {
  return (
    <View>
      <View style={styles.row}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((rpe) => {
          const selected = value === rpe;
          return (
            <TouchableOpacity
              key={rpe}
              style={[
                styles.button,
                {
                  backgroundColor: selected ? getRpeColor(rpe) : getRpeColor(rpe) + '30',
                  borderColor: selected ? getRpeColor(rpe) : 'transparent',
                },
              ]}
              onPress={() => onChange(selected ? undefined : rpe)}
              activeOpacity={0.7}
            >
              <Text style={[styles.buttonText, { color: selected ? colors.text : getRpeColor(rpe) }]}>
                {rpe}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.captions}>
        <Text style={styles.caption}>Easy</Text>
        <Text style={styles.caption}>Moderate</Text>
        <Text style={styles.caption}>Maximum</Text>
      </View>

      {value !== undefined && (
        <View style={styles.readout}>
          <Text style={[styles.readoutText, { color: getRpeColor(value) }]}>
            RPE {value}: {getRpeLabel(value)}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 4,
  },
  button: {
    flex: 1,
    aspectRatio: 0.9,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typography.sm,
  },
  captions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  caption: {
    fontSize: 10,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  readout: {
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  readoutText: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typography.base,
    letterSpacing: 0.5,
  },
});
