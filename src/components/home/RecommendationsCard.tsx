import { Ionicons } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { useMemo, useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

import {
  getOnboardingIdleCardStyle,
  ONBOARDING_CARD_RADIUS,
} from '@/components/onboarding/onboarding-styles';
import { GlassBottomSheet } from '@/components/shared/GlassBottomSheet';
import { BRAND_INDIGO, RECOMMENDATION_ACCENT, TEXT_SECONDARY } from '@/constants/brand';
import { useRequestCheckinQuestions } from '@/hooks/use-checkin';
import { useDeloadWeek } from '@/hooks/use-deload';
import { useRecommendations } from '@/hooks/use-recommendations';
import type {
  Recommendation,
  RecommendationAction,
  RecommendationKind,
  RecommendationTargetName,
} from '@/lib/recommendations/recommendations';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export type RecommendationActionHandlers = Partial<
  Record<RecommendationTargetName, (action: RecommendationAction) => void>
>;

type RecommendationsCardProps = {
  recommendations: readonly Recommendation[];
  /** Target → handler. A recommendation whose target has no handler shows without a button. */
  handlers: RecommendationActionHandlers;
  onDismiss: (kind: RecommendationKind) => void;
  className?: string;
};

/** Accent at ~12 % for the soft icon badge. */
const ACCENT_SOFT = `${RECOMMENDATION_ACCENT}1F`;

/**
 * Up to three recommendations on Today. Each is icon + one sentence; tapping
 * the card runs its action. The "why" (goal reason / check-in body) sits
 * behind a small info icon instead of a second line. Swipe sideways or tap ×
 * to hide it for three days.
 */
export function RecommendationsCard({
  recommendations,
  handlers,
  onDismiss,
  className,
}: RecommendationsCardProps) {
  const { t } = useTranslation();
  const [reasonKind, setReasonKind] = useState<RecommendationKind | null>(null);
  const reasonRec = recommendations.find((rec) => rec.kind === reasonKind) ?? null;

  if (recommendations.length === 0) {
    return null;
  }

  return (
    <View testID="home.recommendations" className={className ?? 'mb-4'}>
      <Text className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {t('recommendations.title')}
      </Text>
      <View style={{ gap: 8 }}>
        {recommendations.map((rec) => {
          const handler = handlers[rec.action.target];
          const secondary = rec.secondaryAction
            ? handlers[rec.secondaryAction.target]
            : undefined;
          return (
            <Swipeable
              key={rec.kind}
              overshootFriction={8}
              onSwipeableOpen={() => onDismiss(rec.kind)}
              renderRightActions={() => <View className="w-4" />}
              renderLeftActions={() => <View className="w-4" />}>
              <View
                testID={`home.recommendations.${rec.kind}`}
                style={[getOnboardingIdleCardStyle(), { borderRadius: ONBOARDING_CARD_RADIUS }]}>
                <Pressable
                  testID={`home.recommendations.${rec.kind}.action`}
                  accessibilityRole={handler ? 'button' : undefined}
                  accessibilityLabel={handler ? t(rec.action.labelKey) : undefined}
                  disabled={!handler}
                  onPress={handler ? () => handler(rec.action) : undefined}
                  className="flex-row items-center gap-3 py-3 pl-4 pr-9">
                  <View
                    className="h-8 w-8 items-center justify-center rounded-full"
                    style={{ backgroundColor: ACCENT_SOFT }}>
                    <Ionicons
                      name={rec.icon as IoniconName}
                      size={18}
                      color={RECOMMENDATION_ACCENT}
                    />
                  </View>
                  <View className="min-w-0 flex-1 flex-row items-center">
                    <Text className="flex-1 text-[15px] font-medium leading-5 text-gray-900">
                      {t(rec.message.key, rec.message.params)}
                    </Text>
                    {rec.reason ? (
                      <Pressable
                        testID={`home.recommendations.${rec.kind}.reason`}
                        accessibilityRole="button"
                        accessibilityLabel={t('recommendations.why')}
                        hitSlop={8}
                        onPress={(event) => {
                          event.stopPropagation();
                          setReasonKind(rec.kind);
                        }}
                        className="ml-1 p-1">
                        <Ionicons name="information-circle-outline" size={18} color={TEXT_SECONDARY} />
                      </Pressable>
                    ) : null}
                  </View>
                </Pressable>
                {secondary && rec.secondaryAction ? (
                  <Pressable
                    testID={`home.recommendations.${rec.kind}.secondaryAction`}
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() => secondary(rec.secondaryAction!)}
                    className="ml-14 self-start px-4 pb-3">
                    <Text className="text-sm font-semibold text-gray-500">
                      {t(rec.secondaryAction.labelKey)}
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  testID={`home.recommendations.${rec.kind}.dismiss`}
                  accessibilityRole="button"
                  accessibilityLabel={t('recommendations.dismiss')}
                  hitSlop={12}
                  onPress={() => onDismiss(rec.kind)}
                  className="absolute right-3 top-3">
                  <Ionicons name="close" size={18} color="#9CA3AF" />
                </Pressable>
              </View>
            </Swipeable>
          );
        })}
      </View>
      <GlassBottomSheet
        visible={reasonRec != null}
        onClose={() => setReasonKind(null)}
        presentation="center">
        {reasonRec?.reason ? (
          <>
            <Text style={{ fontSize: 15, lineHeight: 22, color: '#111827' }}>
              {t(reasonRec.reason.key, reasonRec.reason.params)}
            </Text>
            <Pressable
              testID="home.recommendations.reason.close"
              accessibilityRole="button"
              onPress={() => setReasonKind(null)}
              style={{
                marginTop: 16,
                backgroundColor: BRAND_INDIGO,
                borderRadius: 14,
                paddingVertical: 12,
                alignItems: 'center',
              }}>
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>
                {t('settings.common.ok')}
              </Text>
            </Pressable>
          </>
        ) : null}
      </GlassBottomSheet>
    </View>
  );
}

type TodayRecommendationsProps = {
  onOpenMeals: () => void;
  onOpenWeightSheet: () => void;
  onOpenMeasurements: () => void;
  onOpenTraining: () => void;
  className?: string;
};

/**
 * RecommendationsCard wired to useRecommendations. Screen-level targets come
 * in as callbacks; the exercise route and the check-in are handled here.
 */
export function TodayRecommendations({
  onOpenMeals,
  onOpenWeightSheet,
  onOpenMeasurements,
  onOpenTraining,
  className,
}: TodayRecommendationsProps) {
  const { recommendations, dismiss } = useRecommendations();
  const requestCheckin = useRequestCheckinQuestions();
  const { start: startDeloadWeek, dismiss: dismissDeloadWeek } = useDeloadWeek();

  const handlers = useMemo(
    (): RecommendationActionHandlers => ({
      meals: onOpenMeals,
      weightSheet: onOpenWeightSheet,
      measurementsSheet: onOpenMeasurements,
      training: onOpenTraining,
      checkin: requestCheckin,
      exerciseProgress: (action) => {
        if (action.target === 'exerciseProgress') {
          router.push(`/koli/exercise-progress/${action.exerciseId}` as Href);
        }
      },
      // Both writes make the card go away: the profile decides whether it shows.
      deloadStart: () => {
        void startDeloadWeek();
      },
      deloadDismiss: () => {
        void dismissDeloadWeek();
      },
    }),
    [
      dismissDeloadWeek,
      onOpenMeals,
      onOpenMeasurements,
      onOpenTraining,
      onOpenWeightSheet,
      requestCheckin,
      startDeloadWeek,
    ],
  );

  return (
    <RecommendationsCard
      recommendations={recommendations}
      handlers={handlers}
      onDismiss={dismiss}
      className={className}
    />
  );
}
