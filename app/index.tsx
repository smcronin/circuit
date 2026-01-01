import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useUserStore } from '@/stores';
import { colors } from '@/theme';

export default function Index() {
  const profile = useUserStore((state) => state.profile);
  const [isHydrated, setIsHydrated] = useState(false);

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

  // Show loading while hydrating
  if (!isHydrated) {
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
