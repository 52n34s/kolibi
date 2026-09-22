import type { QueryClient } from '@tanstack/react-query';

export const PROFILE_SETTINGS_QUERY_KEY = 'profile-settings' as const;

export function profileSettingsQueryKey(userId: string) {
  return [PROFILE_SETTINGS_QUERY_KEY, userId] as const;
}

type ProfileSettingsCache = {
  profile: {
    target_weight_kg: number | null;
    progress_start_date: string | null;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

/** Optimistically patch target weight into the query GoalsPanel reads. */
export function setProfileSettingsTargetWeight(
  queryClient: QueryClient,
  userId: string,
  params: {
    targetWeightKg: number;
    progressStartDate: string | null;
  },
): boolean {
  const key = profileSettingsQueryKey(userId);
  const current = queryClient.getQueryData<ProfileSettingsCache>(key);

  if (!current?.profile) {
    return false;
  }

  queryClient.setQueryData<ProfileSettingsCache>(key, {
    ...current,
    profile: {
      ...current.profile,
      target_weight_kg: params.targetWeightKg,
      progress_start_date: params.progressStartDate,
    },
  });

  return true;
}
