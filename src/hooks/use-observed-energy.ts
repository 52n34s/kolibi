import { useQuery } from '@tanstack/react-query';

import { localDateKey, parseDateOnly } from '@/lib/day-window';
import type { ActivityLevel, BiologicalSex } from '@/lib/calorie-goal-math';
import { fetchObservedEnergyEstimate } from '@/lib/observed-energy-data';

export function useObservedEnergy(params: {
  userId: string | undefined;
  biologicalSex: BiologicalSex | null | undefined;
  birthDate: string | null | undefined;
  heightCm: number | null | undefined;
  weightKg: number | null | undefined;
  activityLevel: ActivityLevel | null | undefined;
  healthConnected: boolean;
}) {
  const ready =
    Boolean(params.userId) &&
    params.birthDate != null &&
    params.activityLevel != null &&
    params.heightCm != null &&
    params.weightKg != null;

  return useQuery({
    queryKey: [
      'observed-energy',
      params.userId,
      localDateKey(),
      params.healthConnected,
      params.weightKg,
    ],
    enabled: ready,
    queryFn: async () => {
      if (
        !params.userId ||
        !params.birthDate ||
        !params.activityLevel ||
        params.heightCm == null ||
        params.weightKg == null
      ) {
        throw new Error('Missing profile for observed energy');
      }

      return fetchObservedEnergyEstimate({
        userId: params.userId,
        biologicalSex: params.biologicalSex ?? 'prefer_not_to_say',
        birthDate: parseDateOnly(params.birthDate),
        heightCm: params.heightCm,
        weightKg: params.weightKg,
        activityLevel: params.activityLevel,
        healthConnected: params.healthConnected,
      });
    },
  });
}
