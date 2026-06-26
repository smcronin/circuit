import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useUserStore } from '@/stores';
import { colors } from '@/theme';
import {
  applyDevCurrentProgramPreferences,
  seedDevAppDataFromBackup,
} from '@/utils/devSeedAppData';

export default function Index() {
  const profile = useUserStore((state) => state.profile);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [hasTriedDevSeed, setHasTriedDevSeed] = useState(false);

  useEffect(() => {
    // Wait for zustand to hydrate from AsyncStorage
    const unsubscribe = useUserStore.persist.onFinishHydration(() => {
      setIsHydrated(true);
    });

    // Check if already hydrated
    if (useUserStore.persist.hasHydrated()) {
      setIsHydrated(true);
    }

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isHydrated || profile || isSeeding || hasTriedDevSeed) {
      return;
    }

    let isMounted = true;
    setIsSeeding(true);
    setHasTriedDevSeed(true);

    seedDevAppDataFromBackup()
      .catch((error) => {
        console.warn('Dev backup seed skipped:', error);
      })
      .finally(() => {
        if (isMounted) {
          setIsSeeding(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [hasTriedDevSeed, isHydrated, profile, isSeeding]);

  useEffect(() => {
    if (isHydrated && profile) {
      applyDevCurrentProgramPreferences();
    }
  }, [isHydrated, profile]);

  // Show loading while hydrating
  if (!isHydrated || isSeeding) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Route based on onboarding status
  if (profile?.hasCompletedOnboarding) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/onboarding" />;
}
