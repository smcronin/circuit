export const colors = {
  // Primary - Electric Indigo
  primary: '#6366F1',
  primaryLight: '#818CF8',
  primaryDark: '#4F46E5',

  // Accent - Energetic Orange
  accent: '#F97316',
  accentLight: '#FB923C',
  accentDark: '#EA580C',

  // Status Colors
  success: '#22C55E',
  successLight: '#4ADE80',
  warning: '#EAB308',
  warningLight: '#FDE047',
  error: '#EF4444',
  errorLight: '#F87171',

  // Neutral - Dark Slate
  background: '#0F172A',
  surface: '#1E293B',
  surfaceLight: '#334155',
  surfaceHighlight: '#475569',
  border: '#475569',
  borderLight: '#64748B',

  // Text
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  textInverse: '#0F172A',

  // Timer Specific
  timerBackground: '#0F172A',
  timerActive: '#22C55E',
  timerRest: '#3B82F6',
  timerWarning: '#F97316',
  timerDanger: '#EF4444',

  // Gradients (use with LinearGradient)
  gradientPrimary: ['#6366F1', '#4F46E5'],
  gradientAccent: ['#F97316', '#EA580C'],
  gradientSuccess: ['#22C55E', '#16A34A'],
  gradientDark: ['#1E293B', '#0F172A'],
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
  // Font sizes
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  '5xl': 48,
  '6xl': 60,
  '7xl': 72,

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
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
};
