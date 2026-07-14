import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CircuitLogo } from '@/components/CircuitLogo';
import { colors, fonts, shadows } from '@/theme';

export default function OnboardingWelcome() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={colors.gradientDark}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <CircuitLogo size={96} />
        </View>

        <Text style={styles.title}>Circuit</Text>
        <Text style={styles.subtitle}>AI-POWERED TRAINING</Text>

        <View style={styles.features}>
          <FeatureItem
            icon="flash"
            title="Smart Generation"
            description="AI creates personalized workouts based on your goals"
          />
          <FeatureItem
            icon="time"
            title="Guided Timer"
            description="Follow along with automatic exercise timing"
          />
          <FeatureItem
            icon="stats-chart"
            title="Progress Tracking"
            description="Track your workout history and improvements"
          />
        </View>
      </View>

      <TouchableOpacity
        style={styles.buttonWrapper}
        activeOpacity={0.85}
        onPress={() => router.push('/onboarding/goals')}
      >
        <LinearGradient
          colors={colors.gradientPrimary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.button}
        >
          <Text style={styles.buttonText}>Get Started</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

function FeatureItem({
  icon,
  title,
  description,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
}) {
  return (
    <View style={styles.featureItem}>
      <View style={styles.featureIcon}>
        <Ionicons name={icon} size={22} color={colors.primaryLight} />
      </View>
      <View style={styles.featureText}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDescription}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 24,
    paddingTop: 60,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 136,
    height: 136,
    borderRadius: 68,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(108, 124, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    ...shadows.glowPrimary,
  },
  title: {
    fontFamily: fonts.displayBlack,
    fontSize: 52,
    lineHeight: 56,
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 4,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryLight,
    letterSpacing: 3,
    marginBottom: 44,
  },
  features: {
    width: '100%',
    gap: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  featureIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(108, 124, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(108, 124, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 17,
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: 14,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  buttonWrapper: {
    borderRadius: 999,
    ...shadows.glowPrimary,
  },
  button: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: fonts.displaySemiBold,
    color: '#FFFFFF',
    fontSize: 19,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
});
