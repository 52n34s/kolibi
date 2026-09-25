import { Ionicons } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import {
  getOnboardingIdleCardStyle,
  ONBOARDING_CARD_RADIUS,
} from '@/components/onboarding/onboarding-styles';
import { BRAND_INDIGO, RECOMMENDATION_ACCENT } from '@/constants/brand';
import { useProfileSettings } from '@/hooks/use-profile-settings';
import {
  readFocusAreasNudgeDismissed,
  shouldShowFocusAreasNudge,
  writeFocusAreasNudgeDismissed,
} from '@/lib/recommendations/focus-areas-nudge';
import { recommendationStorage } from '@/lib/recommendations/dismissals-storage';
import { useAuthStore } from '@/stores/auth-store';

/** Accent at ~12 %, same badge as the recommendations. */
const ACCENT_SOFT = `${RECOMMENDATION_ACCENT}1F`;

/**
 * The one-time card that asks for focus areas, a week after signing up. Tap
 * leads to the goals screen, × makes it go away for good.
 */
export function FocusAreasNudgeCard({ className }: { className?: string }) {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.session?.user);
  const userId = user?.id;
  const { data } = useProfileSettings(userId);
  const [dismissed, setDismissed] = useState(() =>
    userId ? readFocusAreasNudgeDismissed(recommendationStorage, userId) : true,
  );

  const show = useMemo(
    () =>
      userId != null &&
      data?.profile != null &&
      shouldShowFocusAreasNudge({
        accountCreatedAt: user?.created_at ?? null,
        focusAreas: data.profile.focus_areas,
        dismissed,
        nowMs: Date.now(),
      }),
    [data?.profile, dismissed, user?.created_at, userId],
  );

  if (!show) {
    return null;
  }

  return (
    <View
      testID="home.focusAreasNudge"
      className={className ?? 'mb-4'}
      style={[getOnboardingIdleCardStyle(), { borderRadius: ONBOARDING_CARD_RADIUS }]}>
      <View className="flex-row items-start gap-3 px-4 py-3">
        <View
          className="mt-0.5 h-8 w-8 items-center justify-center rounded-full"
          style={{ backgroundColor: ACCENT_SOFT }}>
          <Ionicons name="compass-outline" size={18} color={RECOMMENDATION_ACCENT} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[15px] font-medium leading-5 text-gray-900">
            {t('today.focusAreasNudge.title')}
          </Text>
          <Pressable
            testID="home.focusAreasNudge.action"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() =>
              router.push({ pathname: '/koli', params: { segment: 'goals' } } as Href)
            }
            className="mt-1.5 flex-row items-center self-start py-1">
            <Text className="text-sm font-semibold" style={{ color: BRAND_INDIGO }}>
              {t('today.focusAreasNudge.action')}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={BRAND_INDIGO} />
          </Pressable>
        </View>
        <Pressable
          testID="home.focusAreasNudge.dismiss"
          accessibilityRole="button"
          accessibilityLabel={t('recommendations.dismiss')}
          hitSlop={12}
          onPress={() => {
            if (userId) {
              writeFocusAreasNudgeDismissed(recommendationStorage, userId, new Date());
            }
            setDismissed(true);
          }}
          className="pt-0.5">
          <Ionicons name="close" size={18} color="#9CA3AF" />
        </Pressable>
      </View>
    </View>
  );
}
