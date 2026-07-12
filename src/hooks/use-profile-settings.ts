import { useQuery } from '@tanstack/react-query';

import {
  fetchProfileSettings,
  fetchSubscription,
  getAvatarSignedUrl,
  resolvePremiumAccess,
} from '@/lib/profile';

function logSettingsLoadError(error: unknown) {
  console.error('[Settings] load failed:', error);

  if (error && typeof error === 'object') {
    const supabaseError = error as {
      code?: string;
      message?: string;
      details?: string;
      hint?: string;
    };

    console.error('[Settings] load failed details:', {
      code: supabaseError.code,
      message: supabaseError.message,
      details: supabaseError.details,
      hint: supabaseError.hint,
    });
  }
}

export function useProfileSettings(userId: string | undefined) {
  return useQuery({
    queryKey: ['profile-settings', userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) {
        throw new Error('Missing user id');
      }

      try {
        const [profile, subscription] = await Promise.all([
          fetchProfileSettings(userId),
          fetchSubscription(userId),
        ]);

        const avatarSignedUrl = await getAvatarSignedUrl(profile.avatar_url);
        const premiumAccess = resolvePremiumAccess(subscription);

        return {
          profile,
          subscription,
          avatarSignedUrl,
          premiumAccess,
        };
      } catch (error) {
        logSettingsLoadError(error);
        throw error;
      }
    },
  });
}
