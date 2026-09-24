import { useTranslation } from 'react-i18next';

import {
  STICKER_PALETTES,
  StickerBadge,
  StickerFrame,
  StickerStack,
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
      <StickerStack style={s.stack}>
        {data.milestone ? (
          <StickerBadge
            label={data.milestone === 'newBest' ? t('share.newBest') : t('share.firstTime')}
          />
        ) : null}
        <StickerText style={[s.title, { color: palette.text }, palette.shadow]} numberOfLines={2}>
          {data.name}
        </StickerText>
        {data.values.length > 0 ? (
          <StickerStack>
            <StickerText
              style={[s.hero, { color: palette.text }, palette.shadow]}
              numberOfLines={1}
              adjustsFontSizeToFit>
              {formatSetsCompact(data.values, data.exerciseKind)}
            </StickerText>
            {data.perSide ? (
              <StickerText style={[s.small, { color: palette.muted }, palette.shadow]}>
                {t('share.perSide')}
              </StickerText>
            ) : null}
          </StickerStack>
        ) : null}
        {options.showBest && best != null ? (
          <StickerText style={[s.sub, { color: palette.muted }, palette.shadow]}>
            {t('share.bestSet', { value: formatStickerValue(best, data.exerciseKind) })}
          </StickerText>
        ) : null}
        {options.showLevel && data.level ? (
          <StickerLevelLine level={data.level} palette={palette} />
        ) : null}
      </StickerStack>
    </StickerFrame>
  );
}
