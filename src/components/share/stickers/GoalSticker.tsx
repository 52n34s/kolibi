import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import {
  STICKER_PALETTES,
  StickerBadge,
  StickerFrame,
  StickerLevelLine,
  StickerStack,
  StickerText,
  stickerStyles as s,
} from '@/components/share/stickers/sticker-parts';
import {
  formatSkillGoalCurrent,
  formatSkillGoalPeriod,
  formatSkillGoalTarget,
} from '@/components/training/skill-goal-text';
import { BRAND_MINT } from '@/constants/brand';
import type {
  GoalStickerData,
  StickerFormat,
  StickerOptions,
  StickerVariant,
} from '@/lib/share/sticker-data';

type GoalStickerProps = {
  data: GoalStickerData;
  variant: StickerVariant;
  options: StickerOptions;
  format?: StickerFormat;
};

/** Exercise, target, current value, bar and the expected period. No load, no body data. */
export function GoalSticker({ data, variant, options, format = 'sticker' }: GoalStickerProps) {
  const { t, i18n } = useTranslation();
  const palette = STICKER_PALETTES[variant];
  const percent = Math.round(Math.min(1, Math.max(0, data.progress)) * 100);
  return (
    <StickerFrame variant={variant} format={format}>
      <StickerStack style={s.stack}>
        <StickerBadge
          label={data.achieved ? t('skillGoal.sticker.achievedBadge') : t('skillGoal.sticker.badge')}
        />
        <StickerText
          style={[s.title, { color: palette.text }, palette.shadow]}
          numberOfLines={format === 'story' ? 1 : 2}
          adjustsFontSizeToFit={format === 'story'}
          minimumFontScale={0.6}>
          {data.name}
        </StickerText>
        <StickerText
          style={[s.sub, { color: palette.text }, palette.shadow]}
          numberOfLines={1}
          adjustsFontSizeToFit>
          {formatSkillGoalTarget(data.target, data.exerciseKind, t)}
        </StickerText>
        {data.current ? (
          <StickerText style={[s.small, { color: palette.muted }, palette.shadow]} numberOfLines={2}>
            {formatSkillGoalCurrent(data.current.value, data.current.kind, data.current.name, t)}
          </StickerText>
        ) : null}
        <StickerStack style={[styles.track, { backgroundColor: palette.faint }]}>
          <StickerStack
            style={[
              styles.fill,
              {
                width: `${Math.max(percent, 3)}%`,
                backgroundColor: data.achieved ? BRAND_MINT : palette.text,
              },
            ]}>
            {null}
          </StickerStack>
        </StickerStack>
        {data.period ? (
          <StickerText style={[s.sub, { color: palette.text }, palette.shadow]}>
            {formatSkillGoalPeriod(data.period, t, i18n.language)}
          </StickerText>
        ) : null}
        {options.showLevel && data.level ? (
          <StickerLevelLine level={data.level} palette={palette} />
        ) : null}
      </StickerStack>
    </StickerFrame>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 14,
    borderRadius: 7,
    overflow: 'hidden',
  },
  fill: {
    height: 14,
    borderRadius: 7,
  },
});
