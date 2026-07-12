import { Stack } from 'expo-router';

import { MESH_STACK_SCREEN_OPTIONS } from '@/components/home/home-layout';

export default function KoliLayout() {
  return (
    <Stack screenOptions={MESH_STACK_SCREEN_OPTIONS}>
      <Stack.Screen name="index" options={{ title: '' }} />
      <Stack.Screen name="calorie-goal" options={{ title: '' }} />
    </Stack>
  );
}
