import { useQuery } from '@tanstack/react-query';

import { fetchOwnTemplates, hasTemplateFlag } from '@/lib/workouts/workouts-api';
import { workoutQueryKeys } from '@/lib/workouts/query-keys';
import { useAuthStore } from '@/stores/auth-store';

/** "Meine Vorlagen". `available` is false until the template migration ran. */
export function useOwnWorkoutTemplates(enabled = true) {
  const userId = useAuthStore((state) => state.session?.user?.id);

  const availability = useQuery({
    queryKey: ['workout-templates-flag'],
    enabled: Boolean(userId) && enabled,
    staleTime: Infinity,
    queryFn: () => hasTemplateFlag(),
  });

  const templates = useQuery({
    queryKey: userId ? workoutQueryKeys.ownTemplates(userId) : ['workout-templates-own'],
    enabled: Boolean(userId) && enabled && availability.data === true,
    staleTime: 60 * 1000,
    queryFn: () => fetchOwnTemplates(),
  });

  return { available: availability.data === true, ...templates };
}
