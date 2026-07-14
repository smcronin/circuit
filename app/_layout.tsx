import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { soundManager } from '@/services/audio/SoundManager';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import {
  BarlowCondensed_500Medium,
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
  BarlowCondensed_700Bold_Italic,
  BarlowCondensed_800ExtraBold,
} from '@expo-google-fonts/barlow-condensed';
import { colors } from '@/theme';

export default function RootLayout() {
  // Load Ionicons (needed on web) plus the Circuit display typeface
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
    BarlowCondensed_500Medium,
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
    BarlowCondensed_700Bold_Italic,
    BarlowCondensed_800ExtraBold,
  });

  // Initialize audio on app start
  useEffect(() => {
    soundManager.initialize();
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="workout" />
        <Stack.Screen
          name="modals/exercise-info"
          options={{
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="modals/edit-equipment-set"
          options={{
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="modals/edit-goals"
          options={{
            presentation: 'modal',
          }}
        />
      </Stack>
    </View>
  );
}
