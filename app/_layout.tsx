import 'react-native-get-random-values'; // Must be first for uuid
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { soundManager } from '@/services/audio/SoundManager';

export default function RootLayout() {
  // Initialize audio on app start
  useEffect(() => {
    soundManager.initialize();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0F172A' },
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
