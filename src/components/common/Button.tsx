import React from 'react';
import {
  Pressable,
  Text,
  View,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';
import { soundManager } from '@/services/audio';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  icon,
  style,
  textStyle,
}: ButtonProps) {
  const handlePress = async () => {
    if (disabled || loading) return;
    await soundManager.playButtonPress();
    onPress();
  };

  const isGradient = variant === 'primary' && !disabled && !loading;
  const isDim = disabled || loading;

  const textStyles = [
    styles.text,
    styles[`text_${variant}`],
    styles[`text_${size}`],
    isDim && styles.textDisabled,
    textStyle,
  ];

  const spinnerColor =
    variant === 'outline' || variant === 'ghost' ? colors.primaryLight : colors.text;

  const content = loading ? (
    <ActivityIndicator color={spinnerColor} size="small" />
  ) : (
    <>
      {icon}
      <Text style={textStyles} numberOfLines={1}>
        {title}
      </Text>
    </>
  );

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.wrapper,
        isGradient && styles.wrapperGlow,
        fullWidth && styles.fullWidth,
        pressed && !isDim && styles.pressed,
        style,
      ]}
    >
      {isGradient ? (
        <LinearGradient
          colors={colors.gradientPrimary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.inner, styles[`size_${size}`]]}
        >
          {content}
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.inner,
            styles[variant],
            styles[`size_${size}`],
            isDim && styles.disabled,
          ]}
        >
          {content}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: borderRadius.full,
  },
  wrapperGlow: {
    ...shadows.glowPrimary,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.92,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  primary: {
    backgroundColor: colors.primaryDark,
  },
  secondary: {
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: '#D93A36',
  },
  size_sm: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md + spacing.xs,
    minHeight: 36,
  },
  size_md: {
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
  },
  size_lg: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    minHeight: 56,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.45,
  },
  text: {
    fontFamily: fonts.displaySemiBold,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  text_primary: {
    color: colors.text,
  },
  text_secondary: {
    color: colors.text,
  },
  text_outline: {
    color: colors.primaryLight,
  },
  text_ghost: {
    color: colors.primaryLight,
  },
  text_danger: {
    color: colors.text,
  },
  text_sm: {
    fontSize: 15,
  },
  text_md: {
    fontSize: 18,
  },
  text_lg: {
    fontSize: 20,
  },
  textDisabled: {
    opacity: 0.8,
  },
});
