// ─── Circuit "Midnight Voltage" design system ───────────────────────────────
// Near-black navy canvas, electric indigo energy, condensed athletic display
// type. Body copy stays on the system font for maximum legibility; the
// display font (Barlow Condensed) is reserved for headlines, numerals,
// buttons and kickers.

import { scaleFont } from './metrics';

export const colors = {
  // Primary - Electric Indigo
  primary: '#6C7CFF',
  primaryLight: '#96A5FF',
  primaryDark: '#4F46E5',

  // Accent - Ignition Orange
  accent: '#FF7E33',
  accentLight: '#FFA45C',
  accentDark: '#E85D04',

  // Status Colors
  success: '#34D399',
  successLight: '#6EE7B7',
  warning: '#FBBF24',
  warningLight: '#FDE68A',
  error: '#F1564E',
  errorLight: '#F98D87',

  // Neutral - Midnight Navy
  background: '#060A14',
  surface: '#0E1524',
  surfaceLight: '#1B2437',
  surfaceHighlight: '#293650',
  border: 'rgba(148, 163, 184, 0.16)',
  borderLight: 'rgba(148, 163, 184, 0.30)',
  hairline: 'rgba(255, 255, 255, 0.07)',

  // Text
  text: '#F6F7FB',
  textSecondary: '#9DA9C3',
  textMuted: '#62708C',
  textInverse: '#060A14',

  // Timer Specific
  timerBackground: '#060A14',
  timerActive: '#10B981',
  timerRest: '#3D74F6',
  timerWarning: '#FF7E33',
  timerDanger: '#F1564E',

  // Gradients (use with LinearGradient)
  gradientPrimary: ['#8B9AFF', '#6366F1'] as const,
  gradientAccent: ['#FF9A4D', '#F26419'] as const,
  gradientSuccess: ['#34D399', '#0D9488'] as const,
  gradientDark: ['#141C30', '#060A14'] as const,
  // Full-bleed timer phase backgrounds (top → bottom)
  gradientTimerWork: ['#0AA173', '#046C4E'] as const,
  gradientTimerRest: ['#2F63E8', '#1E3E9E'] as const,
};

// Display typeface (loaded in app/_layout.tsx via @expo-google-fonts).
// IMPORTANT: never pair these with a fontWeight style — the weight is baked
// into the family name, and fontWeight can force a fallback font on Android.
export const fonts = {
  display: 'BarlowCondensed_700Bold',
  displaySemiBold: 'BarlowCondensed_600SemiBold',
  displayMedium: 'BarlowCondensed_500Medium',
  displayBlack: 'BarlowCondensed_800ExtraBold',
  displayItalic: 'BarlowCondensed_700Bold_Italic',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

export const borderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const typography = {
  // Font sizes. The literals are the iPhone SE baseline; `scaleFont` grows them
  // on roomier devices so text is readable at arm's (or gym-floor's) length.
  // Spacing tokens deliberately do NOT scale — the extra room goes to the type.
  xs: scaleFont(12),
  sm: scaleFont(14),
  base: scaleFont(16),
  lg: scaleFont(18),
  xl: scaleFont(20),
  '2xl': scaleFont(24),
  '3xl': scaleFont(30),
  '4xl': scaleFont(36),
  '5xl': scaleFont(48),
  '6xl': scaleFont(60),
  '7xl': scaleFont(72),

  // Font weights (as strings for RN)
  light: '300' as const,
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 8,
  },
  // Colored glows for hero elements
  glowPrimary: {
    shadowColor: '#6C7CFF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  glowAccent: {
    shadowColor: '#FF7E33',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  glowSuccess: {
    shadowColor: '#34D399',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
};
