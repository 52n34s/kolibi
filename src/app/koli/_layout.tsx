import { Stack } from 'expo-router';

import { MESH_STACK_SCREEN_OPTIONS } from '@/components/home/home-layout';
import { RegisteredPremiumRouteGate } from '@/components/premium/RegisteredPremiumRouteGate';

export default function KoliLayout() {
  return (
    <RegisteredPremiumRouteGate>
      <Stack screenOptions={MESH_STACK_SCREEN_OPTIONS}>
        <Stack.Screen name="index" options={{ title: '' }} />
        <Stack.Screen name="calorie-goal" options={{ title: '' }} />
        <Stack.Screen name="protein-goal" options={{ title: '' }} />
        <Stack.Screen name="macro-goals" options={{ title: '' }} />
        <Stack.Screen name="movement-goal" options={{ title: '' }} />
        <Stack.Screen name="training-goal" options={{ title: '' }} />
        <Stack.Screen name="target-weight" options={{ title: '' }} />
        <Stack.Screen name="training-log" options={{ title: '' }} />
        <Stack.Screen name="day/[date]" options={{ title: '' }} />
        <Stack.Screen name="supplements" options={{ title: '' }} />
        <Stack.Screen name="exercises" options={{ title: '' }} />
        <Stack.Screen name="exercise-edit" options={{ title: '' }} />
        <Stack.Screen name="workout-plan" options={{ title: '' }} />
        <Stack.Screen name="workout-template-edit" options={{ title: '' }} />
        <Stack.Screen name="workout-session/[id]" options={{ title: '' }} />
        <Stack.Screen name="exercise-progress/[exerciseId]" options={{ title: '' }} />
        <Stack.Screen name="workout-backfill" options={{ title: '' }} />
        <Stack.Screen name="export" options={{ title: '' }} />
      </Stack>
    </RegisteredPremiumRouteGate>
  );
}
