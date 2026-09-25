import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { PillSegmentSwitcher } from '@/components/koli/pill-segment-switcher';
import {
  getOnboardingIdleCardStyle,
  ONBOARDING_ACCENT,
  ONBOARDING_CARD_RADIUS,
} from '@/components/onboarding/onboarding-styles';
import { useBuildUp } from '@/hooks/use-build-up';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { BUILD_UP_WEEK_OPTIONS, formatBuildUpSentence, type BuildUpWeeks } from '@/lib/build-up';

export type BuildUpCardProps = {
  /** Opens the measurements sheet; the button is hidden without it. */
  onOpenMeasurements?: () => void;
  className?: string;
};

/**
 * "Aufbau": weight (7-day average), waist, chest, upper arm and strength over
 * 4/8/12 weeks as one sentence. In-app only — never on a shareable image.
 */
export function BuildUpCard({ onOpenMeasurements, className }: BuildUpCardProps) {
  const { t, i18n } = useTranslation();
  const unitSystem = useUnitSystem();
  const [weeks, setWeeks] = useState<BuildUpWeeks>(4);
  const { summary, isLoading } = useBuildUp(weeks);

  const sentence = useMemo(
    () =>
      summary
        ? formatBuildUpSentence(summary, {
            unitSystem,
            locale: i18n.language,
            t: (key, options) => t(key, options) as string,
          })
        : null,
    [i18n.language, summary, t, unitSystem],
  );

  return (
    <View
      className={className}
      style={[getOnboardingIdleCardStyle(), { borderRadius: ONBOARDING_CARD_RADIUS }]}>
      <View className="px-4 py-4" style={{ overflow: 'hidden', borderRadius: ONBOARDING_CARD_RADIUS }}>
        <Text className="text-base font-semibold text-gray-900">
          {t('measurements.buildUp.title')}
        </Text>
        <View className="mt-3">
          <PillSegmentSwitcher
            compact
            value={String(weeks)}
            onChange={(id) => setWeeks(Number(id) as BuildUpWeeks)}
            segments={BUILD_UP_WEEK_OPTIONS.map((option) => ({
              id: String(option),
              label: t('measurements.buildUp.weeksOption', { count: option }),
            }))}
          />
        </View>
        {isLoading ? (
          <View className="items-center py-4">
            <ActivityIndicator color={ONBOARDING_ACCENT} />
          </View>
        ) : sentence ? (
          <>
            <Text className="mt-3 text-[15px] font-medium leading-5 text-gray-900">{sentence}</Text>
            <Text className="mt-2 text-xs text-gray-500">{t('measurements.buildUp.footnote')}</Text>
          </>
        ) : (
          <Text className="mt-3 text-sm text-gray-500">{t('measurements.buildUp.empty')}</Text>
        )}
        {onOpenMeasurements ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('measurements.buildUp.measureCta')}
            onPress={onOpenMeasurements}
            className="mt-3 flex-row items-center self-start">
            <Ionicons name="resize-outline" size={16} color={ONBOARDING_ACCENT} />
            <Text className="ml-1.5 text-sm font-semibold" style={{ color: ONBOARDING_ACCENT }}>
              {t('measurements.buildUp.measureCta')}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
