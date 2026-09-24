import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  STICKER_PALETTES,
  StickerBadge,
  StickerFrame,
  StickerLevelLine,
  StickerText,
  stickerStyles as s,
} from '@/components/share/stickers/sticker-parts';
import {
  bestOf,
  formatSetsCompact,
  formatStickerValue,
  type ExerciseStickerData,
  type StickerOptions,
  type StickerVariant,
} from '@/lib/share/sticker-data';

type ExerciseStickerProps = {
  data: ExerciseStickerData;
  variant: StickerVariant;
  options: StickerOptions;
};

export function ExerciseSticker({ data, variant, options }: ExerciseStickerProps) {
  const { t } = useTranslation();
  const palette = STICKER_PALETTES[variant];
  const best = bestOf(data.values);
  return (
    <StickerFrame variant={variant}>
      <View style={s.stack}>
        {data.isNewBest ? <StickerBadge label={t('share.newBest')} /> : null}
        <StickerText style={[s.title, { color: palette.text }, palette.shadow]} numberOfLines={2}>
          {data.name}
        </StickerText>
        {data.values.length > 0 ? (
          <View>
            <StickerText style={[s.hero, { color: palette.text }, palette.shadow]}>
              {formatSetsCompact(data.values, data.exerciseKind)}
            </StickerText>
            {data.perSide ? (
              <StickerText style={[s.small, { color: palette.muted }, palette.shadow]}>
                {t('share.perSide')}
              </StickerText>
            ) : null}
          </View>
        ) : null}
        {options.showBest && best != null ? (
          <StickerText style={[s.sub, { color: palette.muted }, palette.shadow]}>
            {t('share.bestSet', { value: formatStickerValue(best, data.exerciseKind) })}
          </StickerText>
        ) : null}
        {options.showLevel && data.level ? (
          <StickerLevelLine level={data.level} palette={palette} />
        ) : null}
      </View>
    </StickerFrame>
  );
}
