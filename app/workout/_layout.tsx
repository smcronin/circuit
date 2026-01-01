import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function WorkoutLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="review" />
      <Stack.Screen name="timer" />
      <Stack.Screen name="complete" />
    </Stack>
  );
}
