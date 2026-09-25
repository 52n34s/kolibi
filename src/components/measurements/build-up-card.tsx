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
import { RECOMMENDATION_ACCENT } from '@/constants/brand';
import { useBuildUp } from '@/hooks/use-build-up';
import { useUnitSystem } from '@/hooks/use-unit-system';
import {
  BUILD_UP_WEEK_OPTIONS,
  buildUpTiles,
  buildUpVerdictForGoal,
  formatBuildUpSentence,
  formatBuildUpTileValue,
  formatExerciseGainDelta,
  topExerciseGains,
  type BuildUpTile,
  type BuildUpTileKey,
  type BuildUpWeeks,
} from '@/lib/build-up';
import type { GoalCategory } from '@/lib/goal-category';

export type BuildUpCardProps = {
  /** Opens the measurements sheet; the button is hidden without it. */
  onOpenMeasurements?: () => void;
  /** Opens the weight sheet (Today shows this card instead of the weight card). */
  onOpenWeight?: () => void;
  /** Picks the verdict + tile coloring; falls back to the long sentence without one. */
  goalCategory?: GoalCategory | null;
  className?: string;
};

const TILE_LABEL_KEY: Record<BuildUpTileKey, string> = {
  weight: 'history.weight.tabs.weight',
  waist: 'measurements.fields.waist',
  chest: 'measurements.fields.chest',
  arm: 'measurements.fields.arm',
};

const TILE_OPEN_SHEET: Record<BuildUpTileKey, 'weight' | 'measurements'> = {
  weight: 'weight',
  waist: 'measurements',
  chest: 'measurements',
  arm: 'measurements',
};

/**
 * "Aufbau": weight (7-day average), waist, chest, upper arm and strength over
 * 4/8/12 weeks. With a matching goal (muscle, strength, losing weight) this
 * shows as a short verdict and a 2×2 tile grid; other goals keep the long
 * sentence. In-app only — never on a shareable image.
 */
export function BuildUpCard({
  onOpenMeasurements,
  onOpenWeight,
  goalCategory = null,
  className,
}: BuildUpCardProps) {
  const { t, i18n } = useTranslation();
  const unitSystem = useUnitSystem();
  const [weeks, setWeeks] = useState<BuildUpWeeks>(4);
  const { summary, isLoading } = useBuildUp(weeks);
  const verdict = buildUpVerdictForGoal(goalCategory);

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

  const tiles = useMemo(
    () => (summary && verdict ? buildUpTiles(summary, verdict) : null),
    [summary, verdict],
  );
  const exerciseGains = useMemo(
    () => (summary ? topExerciseGains(summary.exerciseGains) : []),
    [summary],
  );
  const hasData = verdict
    ? Boolean(
        summary &&
          (tiles?.some((tile) => tile.direction != null) ||
            summary.levelUps > 0 ||
            summary.exerciseGains.length > 0),
      )
    : sentence != null;

  function openSheetForTile(key: BuildUpTileKey) {
    if (TILE_OPEN_SHEET[key] === 'weight') {
      onOpenWeight?.();
    } else {
      onOpenMeasurements?.();
    }
  }

  return (
    <View
      className={className}
      style={[getOnboardingIdleCardStyle(), { borderRadius: ONBOARDING_CARD_RADIUS }]}>
      <View className="px-4 py-4" style={{ overflow: 'hidden', borderRadius: ONBOARDING_CARD_RADIUS }}>
        <View className="flex-row items-center justify-between">
          <Text className="text-base font-semibold text-gray-900">
            {t('measurements.buildUp.title')}
          </Text>
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
        ) : !hasData ? (
          <Text className="mt-3 text-sm text-gray-500">{t('measurements.buildUp.empty')}</Text>
        ) : verdict && tiles ? (
          <>
            <Text className="mt-3 text-[17px] font-semibold text-gray-900">
              {t(`measurements.buildUp.verdict${verdict === 'gain' ? 'Gain' : 'Lose'}`)}
            </Text>
            <View className="mt-3 flex-row flex-wrap" style={{ gap: 8 }}>
              {tiles.map((tile) => (
                <BuildUpMetricTile
                  key={tile.key}
                  tile={tile}
                  label={t(TILE_LABEL_KEY[tile.key])}
                  valueText={formatBuildUpTileValue(tile, unitSystem, i18n.language, (key, options) =>
                    t(key, options) as string,
                  )}
                  onPress={tile.direction == null ? () => openSheetForTile(tile.key) : undefined}
                />
              ))}
            </View>
            {summary && (summary.levelUps > 0 || exerciseGains.length > 0) ? (
              <View className="mt-3">
                <View className="flex-row items-baseline justify-between">
                  <Text className="text-sm font-semibold text-gray-900">
                    {t('measurements.buildUp.strengthLabel')}
                  </Text>
                  {summary.levelUps > 0 ? (
                    <Text className="text-sm font-medium" style={{ color: RECOMMENDATION_ACCENT }}>
                      {t('measurements.buildUp.levelUps', { count: summary.levelUps })}
                    </Text>
                  ) : null}
                </View>
                {exerciseGains.map((gain) => (
                  <View key={gain.exerciseId} className="mt-1 flex-row items-center justify-between">
                    <Text className="flex-1 pr-2 text-sm text-gray-700" numberOfLines={1}>
                      {gain.exerciseName}
                    </Text>
                    <Text className="text-sm font-medium text-gray-500">
                      {formatExerciseGainDelta(gain, i18n.language, (key, options) => t(key, options) as string)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
            <Text className="mt-3 text-xs text-gray-500">{t('measurements.buildUp.footnote')}</Text>
          </>
        ) : sentence ? (
          <>
            <Text className="mt-3 text-[15px] font-medium leading-5 text-gray-900">{sentence}</Text>
            <Text className="mt-2 text-xs text-gray-500">{t('measurements.buildUp.footnote')}</Text>
          </>
        ) : null}
        {onOpenWeight || onOpenMeasurements ? (
          <View className="mt-3 flex-row" style={{ gap: 8 }}>
            {onOpenWeight ? (
              <BuildUpPillButton
                testID="buildUp.weigh"
                icon="scale-outline"
                label={t('measurements.buildUp.weighCta')}
                onPress={onOpenWeight}
              />
            ) : null}
            {onOpenMeasurements ? (
              <BuildUpPillButton
                icon="resize-outline"
                label={t('measurements.buildUp.measureCta')}
                onPress={onOpenMeasurements}
              />
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const GOOD_TILE_BACKGROUND = 'rgba(15, 118, 110, 0.1)';
const NEUTRAL_TILE_BACKGROUND = 'rgba(17, 24, 39, 0.04)';

function BuildUpMetricTile({
  tile,
  label,
  valueText,
  onPress,
}: {
  tile: BuildUpTile;
  label: string;
  valueText: string | null;
  onPress?: () => void;
}) {
  const color = tile.isGood ? RECOMMENDATION_ACCENT : '#6B7280';
  const Wrapper = onPress ? Pressable : View;

  return (
    <Wrapper
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={{
        flexBasis: '48%',
        flexGrow: 1,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: tile.isGood ? GOOD_TILE_BACKGROUND : NEUTRAL_TILE_BACKGROUND,
      }}>
      <Text className="text-xs font-medium text-gray-500">{label}</Text>
      <View className="mt-0.5 flex-row items-center" style={{ gap: 3 }}>
        <Text className="text-sm font-semibold" style={{ color: valueText ? color : '#9CA3AF' }}>
          {valueText ?? '–'}
        </Text>
        {tile.direction === 'up' || tile.direction === 'down' ? (
          <Ionicons
            name={tile.direction === 'up' ? 'arrow-up' : 'arrow-down'}
            size={12}
            color={color}
          />
        ) : null}
      </View>
    </Wrapper>
  );
}

function BuildUpPillButton({
  icon,
  label,
  onPress,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="flex-row items-center"
      style={{
        gap: 6,
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: 'rgba(79, 70, 229, 0.08)',
      }}>
      <Ionicons name={icon} size={16} color={ONBOARDING_ACCENT} />
      <Text className="text-sm font-semibold" style={{ color: ONBOARDING_ACCENT }}>
        {label}
      </Text>
    </Pressable>
  );
}
